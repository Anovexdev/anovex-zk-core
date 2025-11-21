import { db } from "./db";
import { balances, tokenHoldings, transactions, swapJobs, wallets } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getJupiterQuote, getTokenDecimals, toLamports } from "./jupiter";
import { generateAnxTxHash } from "./swap-helpers";
import { getTokenMetadataWithFallback } from "./helius-metadata";
import { validateTokenDecimals } from "./token-metadata";

/**
 * Create instant sell order - Phase 1 (Synchronous)
 * Returns ANX hash immediately, swap executes in background
 */
export async function createInstantSellOrder(params: {
  walletId: string;
  telegramUserId?: string;
  tokenAddress: string;
  tokenAmount: string; // Amount of tokens to sell
  telegramChatId?: string; // For message editing after completion
  telegramMessageId?: string; // For message editing after completion
}): Promise<{ success: boolean; anxHash?: string; expectedSol?: string; error?: string }> {
  try {
    const { walletId, telegramUserId, tokenAddress, tokenAmount, telegramChatId, telegramMessageId } = params;
    
    // Verify wallet ownership if telegramUserId provided
    if (telegramUserId) {
      const wallet = await db.select()
        .from(wallets)
        .where(and(
          eq(wallets.id, walletId),
          eq(wallets.telegramUserId, telegramUserId),
          eq(wallets.isActive, true)
        ))
        .limit(1);
      
      if (wallet.length === 0) {
        return { success: false, error: "Unauthorized: Wallet does not belong to this user" };
      }
    }
    
    // Check token holdings
    const holdingRows = await db.select()
      .from(tokenHoldings)
      .where(and(
        eq(tokenHoldings.walletId, walletId),
        eq(tokenHoldings.mint, tokenAddress)
      ))
      .limit(1);
    
    if (holdingRows.length === 0) {
      return { success: false, error: "You don't hold this token" };
    }
    
    const currentHolding = parseFloat(holdingRows[0].amount || '0');
    const sellAmount = parseFloat(tokenAmount);
    
    // CRITICAL: Guard against zero/negative sell amounts (prevents NaN in cost basis calculation)
    if (sellAmount <= 0) {
      return { success: false, error: "Sell amount must be greater than zero" };
    }
    
    // CRITICAL: Guard against zero holdings (prevents division by zero)
    if (currentHolding <= 0) {
      const pendingAmount = parseFloat(holdingRows[0].pendingInAmount || '0');
      if (pendingAmount > 0) {
        return { success: false, error: "Tokens still confirming on-chain. Please wait for settlement before selling." };
      }
      return { success: false, error: "No confirmed tokens to sell" };
    }
    
    if (currentHolding < sellAmount) {
      return { success: false, error: `Insufficient holdings: ${currentHolding.toFixed(4)} available, ${sellAmount.toFixed(4)} required` };
    }
    
    // Fetch token metadata from Helius (ensure we have real symbol, not CA prefix)
    let tokenSymbol = holdingRows[0].symbol;
    let tokenDecimals: number;
    
    // If symbol looks like CA prefix (6 chars), fetch from Helius
    if (!tokenSymbol || tokenSymbol.length === 6) {
      console.log(`📊 Fetching token metadata from Helius for ${tokenAddress}...`);
      try {
        const metadata = await getTokenMetadataWithFallback(tokenAddress);
        tokenSymbol = metadata.symbol;
        tokenDecimals = metadata.decimals; // Pre-validated by metadata service
      } catch (error: any) {
        console.error(`❌ Failed to fetch token metadata: ${error.message}`);
        return { 
          success: false, 
          error: `Unable to fetch token information for ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}. This token may not exist or metadata services are temporarily unavailable. Please try again later.` 
        };
      }
    } else {
      // Fetch decimals from Jupiter
      const rawDecimals = await getTokenDecimals(tokenAddress);
      
      // CRITICAL: Validate decimals BEFORE using in Math.pow
      const decimalsValidation = validateTokenDecimals(rawDecimals, 'Jupiter');
      if (decimalsValidation.kind === 'error') {
        console.error(`❌ ${decimalsValidation.reason}`);
        return {
          success: false,
          error: `Invalid token decimals for ${tokenSymbol}. Unable to process sell order. Please contact support.`
        };
      }
      tokenDecimals = decimalsValidation.decimals; // ✅ Validated!
    }
    
    // Fetch fresh Jupiter quote with system wallet as taker
    console.log(`📊 Fetching Jupiter quote for ${tokenAmount} ${tokenSymbol} sell...`);
    // ✅ tokenDecimals is guaranteed to be valid (finite, integer, >= 0) at this point
    const swapAmount = Math.floor(sellAmount * Math.pow(10, tokenDecimals));
    
    // Get system wallet address for taker parameter
    const { storage } = await import("./storage");
    const systemWallet = await storage.getSystemWallet("liquidity_router_node");
    if (!systemWallet || !systemWallet.address) {
      throw new Error("System wallet not initialized");
    }
    
    const jupiterQuote = await getJupiterQuote({
      inputMint: tokenAddress,
      outputMint: 'So11111111111111111111111111111111111111112', // SOL mint
      amount: swapAmount.toString(),
      slippageBps: 200, // 2% slippage
      taker: systemWallet.address, // System wallet as taker for swap execution
      onlyDirectRoutes: true // MEV protection
    });
    
    const expectedSolAmount = parseFloat(jupiterQuote.outAmount) / 1e9; // SOL has 9 decimals
    
    // Generate ANX hash
    const anxHash = generateAnxTxHash('sell');
    
    // Phase 1: Atomic DB transaction to reserve tokens + create PENDING tx + enqueue swap job
    const result = await db.transaction(async (tx) => {
      // 1. Create PENDING transaction record FIRST (audit trigger requires this BEFORE balance change)
      const txResult = await tx.insert(transactions).values({
        walletId,
        txhash: anxHash,
        type: 'sell',
        tokenAddress,
        tokenSymbol: tokenSymbol, // Real token symbol from Helius or holdings
        amount: sellAmount.toString(),
        solValue: expectedSolAmount.toString(), // SOL received for sell
        instructions: 'sell', // Transaction type for explorer display
        priceUsd: null, // Will be updated when swap completes
        status: 'pending',
        costBasisAtSale: '0', // Will be calculated in step 2 after atomic deduction
        realizedPnl: null // Will be calculated when swap completes
      }).returning({ id: transactions.id });
      
      const transactionId = txResult[0].id;
      
      // 2. CRITICAL: Atomic token deduction with guard (prevents race condition exploit)
      // Calculate cost basis proportionally and deduct atomically in a CTE
      // Uses WHERE amount >= sellAmount to ensure we NEVER go negative
      const deductResult = await tx.execute(sql`
        WITH current_holding AS (
          SELECT amount, total_cost_basis
          FROM ${tokenHoldings}
          WHERE wallet_id = ${walletId}
            AND mint = ${tokenAddress}
          FOR UPDATE
        ),
        proportional_deduction AS (
          SELECT 
            ${sellAmount}::numeric as sell_amount,
            amount,
            total_cost_basis,
            CASE 
              WHEN amount > 0 THEN total_cost_basis * (${sellAmount}::numeric / amount)
              ELSE 0
            END as cost_basis_to_deduct
          FROM current_holding
        )
        UPDATE ${tokenHoldings}
        SET 
          amount = amount - (SELECT sell_amount FROM proportional_deduction),
          total_cost_basis = total_cost_basis - (SELECT cost_basis_to_deduct FROM proportional_deduction),
          updated_at = NOW()
        WHERE wallet_id = ${walletId}
          AND mint = ${tokenAddress}
          AND amount >= ${sellAmount}::numeric
        RETURNING 
          amount as remaining_amount,
          (SELECT cost_basis_to_deduct FROM proportional_deduction) as cost_basis_deducted
      `);
      
      // Verify row was actually updated (prevents oversell from race conditions)
      if (deductResult.rowCount === 0) {
        throw new Error(`Insufficient holdings: ${sellAmount.toFixed(4)} tokens required`);
      }
      
      // Extract cost basis for transaction record update
      const costBasisDeducted = deductResult.rows[0]?.cost_basis_deducted || '0';
      
      // 3. Update transaction with actual cost basis deducted
      await tx.update(transactions)
        .set({ costBasisAtSale: costBasisDeducted.toString() })
        .where(eq(transactions.id, transactionId));
      
      // 4. Create swap job for background processing
      // ✅ Decimals already validated above - safe to store
      await tx.insert(swapJobs).values({
        walletId,
        transactionId,
        type: 'sell',
        tokenMint: tokenAddress,
        tokenSymbol: tokenSymbol, // Real token symbol from Helius or holdings
        tokenDecimals: tokenDecimals.toString(), // ✅ Validated (finite, integer, >= 0)
        solAmount: expectedSolAmount.toString(),
        tokenAmount: sellAmount.toString(),
        jupiterQuote: JSON.stringify(jupiterQuote),
        telegramChatId: telegramChatId || null, // Store for message editing
        telegramMessageId: telegramMessageId || null, // Store for message editing
        status: 'pending'
      });
      
      console.log(`✅ Instant sell order created: ${anxHash} (${sellAmount.toFixed(6)} tokens → ${expectedSolAmount.toFixed(6)} SOL pending)`);
      
      return { anxHash, expectedSol: expectedSolAmount.toFixed(6) };
    });
    
    return { 
      success: true, 
      anxHash: result.anxHash,
      expectedSol: result.expectedSol
    };
    
  } catch (error: any) {
    console.error("Instant sell order failed:", error);
    
    // Handle database constraint violation (duplicate pending transaction)
    // Note: Postgres auto-lowercases constraint names
    if (error.code === '23505' && error.constraint === 'onependingtransactionperwallettype') {
      return { 
        success: false, 
        error: "⏳ You already have a pending sell transaction. Please wait for it to complete before creating another order." 
      };
    }
    
    return { success: false, error: error.message || "Failed to create sell order" };
  }
}
