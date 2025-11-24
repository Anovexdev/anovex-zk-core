import { db } from "./db";
import { balances, tokenHoldings, transactions, swapJobs, wallets } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getJupiterQuote, getTokenDecimals, toLamports } from "./jupiter";
import { generateAnxTxHash } from "./swap-helpers";
import { getTokenMetadataWithFallback } from "./helius-metadata";
import { validateTokenDecimals } from "./token-metadata";
import crypto from "crypto";

/**
 * Create instant buy order - Phase 1 (Synchronous)
 * Returns ANX hash immediately, swap executes in background
 */
export async function createInstantBuyOrder(params: {
  walletId: string;
  telegramUserId?: string;
  tokenAddress: string;
  solAmount: string; // Amount of SOL to spend
  telegramChatId?: string; // For message editing after completion
  telegramMessageId?: string; // For message editing after completion
}): Promise<{ success: boolean; anxHash?: string; expectedTokens?: string; error?: string }> {
  try {
    const { walletId, telegramUserId, tokenAddress, solAmount, telegramChatId, telegramMessageId } = params;
    
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
    
    // Fetch token metadata from Helius (symbol, name, decimals)
    console.log(`📊 Fetching token metadata from Helius for ${tokenAddress}...`);
    let tokenMetadata;
    try {
      tokenMetadata = await getTokenMetadataWithFallback(tokenAddress);
    } catch (error: any) {
      console.error(`❌ Failed to fetch token metadata: ${error.message}`);
      return { 
        success: false, 
        error: `Unable to fetch token information for ${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}. This token may not exist or metadata services are temporarily unavailable. Please try again later.` 
      };
    }
    const tokenSymbol = tokenMetadata.symbol;
    
    // CRITICAL: Validate decimals BEFORE using in calculations
    const decimalsValidation = validateTokenDecimals(tokenMetadata.decimals, 'TokenMetadata');
    if (decimalsValidation.kind === 'error') {
      console.error(`❌ ${decimalsValidation.reason}`);
      return {
        success: false,
        error: `Invalid token decimals for ${tokenSymbol}. Token metadata may be corrupted. Please contact support.`
      };
    }
    const tokenDecimals = decimalsValidation.decimals; // ✅ Validated!
    
    // Fetch fresh Jupiter quote with system wallet as taker
    console.log(`📊 Fetching Jupiter quote for ${solAmount} SOL → ${tokenSymbol}...`);
    const swapAmount = toLamports(parseFloat(solAmount));
    
    // Get system wallet address for taker parameter
    const { storage } = await import("./storage");
    const systemWallet = await storage.getSystemWallet("liquidity_router_node");
    if (!systemWallet || !systemWallet.address) {
      throw new Error("System wallet not initialized");
    }
    
    const jupiterQuote = await getJupiterQuote({
      inputMint: 'So11111111111111111111111111111111111111112', // SOL mint
      outputMint: tokenAddress,
      amount: swapAmount,
      slippageBps: 200, // 2% slippage
      taker: systemWallet.address, // System wallet as taker for swap execution
      onlyDirectRoutes: true // MEV protection
    });
    
    const expectedTokenAmount = parseFloat(jupiterQuote.outAmount) / Math.pow(10, tokenDecimals);
    
    // Generate ANX hash
    const anxHash = generateAnxTxHash('buy');
    
    // Phase 1: Atomic DB transaction to reserve SOL + create PENDING tx + enqueue swap job
    const result = await db.transaction(async (tx) => {
      const requiredAmount = parseFloat(solAmount);
      
      // 1. Create PENDING transaction record FIRST (audit trigger requires this BEFORE balance change)
      const txResult = await tx.insert(transactions).values({
        walletId,
        txhash: anxHash,
        type: 'buy',
        tokenAddress,
        tokenSymbol: tokenSymbol, // Real token symbol from Helius
        amount: expectedTokenAmount.toString(),
        solValue: solAmount, // SOL spent for buy
        instructions: 'buy', // Transaction type for explorer display
        priceUsd: null, // Will be updated when swap completes
        status: 'pending'
      }).returning({ id: transactions.id });
      
      const transactionId = txResult[0].id;
      
      // 2. CRITICAL: Atomic balance deduction with guard (prevents race condition exploit)
      // Uses WHERE sol_balance >= amount to ensure we NEVER go negative
      const updatedBalances = await tx.execute(sql`
        UPDATE ${balances}
        SET 
          sol_balance = sol_balance - ${requiredAmount.toString()}::decimal,
          updated_at = NOW()
        WHERE wallet_id = ${walletId}
          AND sol_balance >= ${requiredAmount.toString()}::decimal
        RETURNING *
      `);
      
      // Verify row was actually updated (prevents overdraft from race conditions)
      if (updatedBalances.rowCount === 0) {
        throw new Error(`Insufficient balance: ${requiredAmount.toFixed(4)} SOL required`);
      }
      
      // 3. Create swap job for background processing
      // ✅ Decimals already validated above - safe to store
      await tx.insert(swapJobs).values({
        walletId,
        transactionId,
        type: 'buy',
        tokenMint: tokenAddress,
        tokenSymbol: tokenSymbol, // Real token symbol from Helius
        tokenDecimals: tokenDecimals.toString(), // ✅ Validated (finite, integer, >= 0)
        solAmount: solAmount,
        tokenAmount: expectedTokenAmount.toString(),
        jupiterQuote: JSON.stringify(jupiterQuote),
        telegramChatId: telegramChatId || null, // Store for message editing
        telegramMessageId: telegramMessageId || null, // Store for message editing
        status: 'pending'
      });
      
      // 4. Update token_holdings with pendingInAmount (instant portfolio feedback)
      await tx.insert(tokenHoldings).values({
        walletId,
        mint: tokenAddress,
        symbol: tokenSymbol, // Real token symbol from Helius
        amount: '0',
        pendingInAmount: expectedTokenAmount.toString(),
        averageEntryPrice: null,
        totalCostBasis: null,
        lastPriceUsd: null
      }).onConflictDoUpdate({
        target: [tokenHoldings.walletId, tokenHoldings.mint],
        set: {
          symbol: tokenSymbol, // Update symbol if changed
          pendingInAmount: sql`${tokenHoldings.pendingInAmount} + ${expectedTokenAmount}`,
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Instant buy order created: ${anxHash} (${expectedTokenAmount.toFixed(6)} tokens pending)`);
      
      return { anxHash, expectedTokens: expectedTokenAmount.toFixed(6) };
    });
    
    return { 
      success: true, 
      anxHash: result.anxHash,
      expectedTokens: result.expectedTokens
    };
    
  } catch (error: any) {
    console.error("Instant buy order failed:", error);
    
    // Handle database constraint violation (duplicate pending transaction)
    // Note: Postgres auto-lowercases constraint names
    if (error.code === '23505' && error.constraint === 'onependingtransactionperwallettype') {
      return { 
        success: false, 
        error: "⏳ You already have a pending buy transaction. Please wait for it to complete before creating another order." 
      };
    }
    
    return { success: false, error: error.message || "Failed to create buy order" };
  }
}
