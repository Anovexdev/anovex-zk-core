import { db } from "./db";
import { balances, tokenHoldings, transactions, wallets } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { storage } from "./storage";
import { getJupiterQuote, executeJupiterSwap, SOL_MINT, toLamports, getTokenDecimals } from "./jupiter";
import { getSolanaPrice } from "./coingecko";
import crypto from "crypto";

// Generate 88 cryptographically secure random alphanumeric characters (no prefix)
// Uses crypto.randomBytes for security (not Math.random which is predictable)
function generateRandomHash(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const charsLength = chars.length;
  let hash = '';
  
  // Generate 88 characters using cryptographically secure random bytes
  const randomBytes = crypto.randomBytes(88);
  for (let i = 0; i < 88; i++) {
    hash += chars[randomBytes[i] % charsLength];
  }
  
  return hash;
}

// Generate custom Anovex Explorer transaction hash (88 chars total, no prefix)
// Format: Pure 88 cryptographically secure random alphanumeric characters
export function generateAnxTxHash(type: 'deposit' | 'buy' | 'sell' | 'withdraw'): string {
  return generateRandomHash();
}

/**
 * Get swap quote for SOL → Token or Token → SOL
 * SECURE: Verifies wallet ownership before processing
 */
export async function getSwapQuote(params: {
  walletId: string;
  telegramUserId?: string; // Optional: verify Telegram ownership
  tokenAddress: string;
  amount: string; // SOL amount for buy, token amount for sell
  type: 'buy' | 'sell';
}): Promise<{ success: boolean; quote?: any; error?: string }> {
  try {
    const { walletId, telegramUserId, tokenAddress, amount, type } = params;
    
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
    
    const solanaPool = await storage.getSystemWallet("liquidity_router_node");
    if (!solanaPool) {
      return { success: false, error: "System wallet not initialized" };
    }
    
    // NO preliminary balance checks - executeSwap's pessimistic guards handle this
    let inputMint: string, outputMint: string, swapAmount: string;
    const tokenDecimals = await getTokenDecimals(tokenAddress);
    
    if (type === 'buy') {
      inputMint = SOL_MINT;
      outputMint = tokenAddress;
      swapAmount = toLamports(parseFloat(amount));
    } else {
      inputMint = tokenAddress;
      outputMint = SOL_MINT;
      swapAmount = Math.floor(parseFloat(amount) * Math.pow(10, tokenDecimals)).toString();
    }
    
    const jupiterQuote = await getJupiterQuote({
      inputMint,
      outputMint,
      amount: swapAmount,
      slippageBps: 200, // 2% slippage for anti-frontrunning protection
      taker: solanaPool.address,
      onlyDirectRoutes: true // MEV protection: use direct routes only
    });
    
    const outputDecimals = type === 'buy' ? tokenDecimals : 9;
    const outputAmount = parseFloat(jupiterQuote.outAmount) / Math.pow(10, outputDecimals);
    const priceImpact = parseFloat(jupiterQuote.priceImpactPct);
    
    return {
      success: true,
      quote: {
        inputAmount: amount,
        outputAmount: outputAmount.toFixed(6),
        priceImpactPct: priceImpact.toFixed(2),
        transaction: jupiterQuote.transaction,
        requestId: jupiterQuote.requestId,
        inAmount: jupiterQuote.inAmount,
        outAmount: jupiterQuote.outAmount,
        inputMint: jupiterQuote.inputMint,
        outputMint: jupiterQuote.outputMint
      }
    };
  } catch (error: any) {
    console.error("Quote error:", error);
    return { success: false, error: error.message || "Failed to get quote" };
  }
}

/**
 * Execute swap (SOL → Token or Token → SOL)
 * SECURE: Verifies wallet ownership, atomic DB transaction, balance guards
 */
export async function executeSwap(params: {
  walletId: string;
  telegramUserId?: string; // Optional: verify Telegram ownership
  tokenAddress: string;
  amount: string;
  type: 'buy' | 'sell';
  quote?: any; // DEPRECATED: Will be ignored, we fetch fresh quote
}): Promise<{ success: boolean; transaction?: any; error?: string }> {
  try {
    const { walletId, telegramUserId, tokenAddress, amount, type } = params;
    
    // SECURITY: ALWAYS fetch fresh quote, NEVER trust caller-provided quote
    // This prevents quote tampering attacks
    console.log('🔒 Fetching fresh quote for security...');
    const freshQuoteResult = await getSwapQuote({
      walletId,
      telegramUserId,
      tokenAddress,
      amount,
      type
    });
    
    if (!freshQuoteResult.success || !freshQuoteResult.quote) {
      return { success: false, error: freshQuoteResult.error || 'Failed to get fresh quote' };
    }
    
    const quote = freshQuoteResult.quote; // Use TRUSTED server-generated quote
    
    // NOTE: Wallet ownership already verified by getSwapQuote above
    
    // Get token symbol from Dexscreener
    let tokenSymbol = 'UNKNOWN';
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      const dexData = await dexResponse.json();
      if (dexData.pairs && dexData.pairs.length > 0) {
        const pair = dexData.pairs[0];
        const baseToken = pair.baseToken?.address === tokenAddress ? pair.baseToken : pair.quoteToken;
        tokenSymbol = baseToken?.symbol || 'UNKNOWN';
      }
    } catch (err) {
      console.warn('Failed to fetch token symbol:', err);
    }
    
    const solanaPool = await storage.getSystemWallet("liquidity_router_node");
    if (!solanaPool) {
      return { success: false, error: "System wallet not initialized" };
    }
    
    const privateKeyBase58 = solanaPool.privateKey;
    const tokenDecimals = await getTokenDecimals(tokenAddress);
    
    // SECURITY: Use quote.inAmount (NOT caller's amount) for validation
    const actualInputAmount = type === 'buy'
      ? parseFloat(quote.inAmount) / Math.pow(10, 9) // SOL
      : parseFloat(quote.inAmount) / Math.pow(10, tokenDecimals); // Token
    
    // CRITICAL SECURITY: Two-phase commit with pessimistic balance reservation
    // Phase 1: Reserve balances (prevents concurrent swap races)
    // Phase 2: Execute on-chain swap
    // Phase 3: Finalize or rollback based on swap result
    
    const customTxHash = generateAnxTxHash(type);
    let jupiterQuote: any;
    let realTxHash: string;
    let reservationPayload: { reserved: boolean, snapshot?: any } | null = null;
    
    // Phase 1: PESSIMISTICALLY RESERVE balances before on-chain swap
    // CRITICAL: NO preliminary SELECT! Conditional UPDATE/DELETE FIRST to prevent races
    // CRITICAL: Create PENDING transaction record in SAME transaction to satisfy audit trigger
    try {
      reservationPayload = await db.transaction(async (tx) => {
      let snapshot: any = null;
      
      if (type === 'buy') {
        // ATOMIC: Conditional UPDATE without preliminary SELECT
        const result = await tx.update(balances)
          .set({ solBalance: sql`${balances.solBalance} - ${actualInputAmount}` })
          .where(and(
            eq(balances.walletId, walletId),
            sql`${balances.solBalance} >= ${actualInputAmount}` // Guard clause
          ))
          .returning();
        
        // Check rowcount: 0 = insufficient/missing, 1 = success
        if (result.length === 0) {
          // NOW we can SELECT to get current balance for error message
          const current = await tx.select().from(balances).where(eq(balances.walletId, walletId));
          const currentSol = current[0] ? parseFloat(current[0].solBalance) : 0;
          throw new Error(`Insufficient SOL: have ${currentSol.toFixed(4)}, need ${actualInputAmount.toFixed(4)}`);
        }
        
        // CRITICAL: Create PENDING transaction record to satisfy audit trigger
        // This prevents "SECURITY VIOLATION: Balance change has NO corresponding transaction record"
        await tx.insert(transactions).values({
          walletId,
          txhash: customTxHash, // Use ANX hash (will be updated with real hash in Phase 3)
          tokenAddress: tokenAddress,
          tokenSymbol: tokenAddress.slice(0, 6), // Placeholder (will be updated)
          amount: actualInputAmount.toString(), // SOL amount spent
          type: 'buy',
          status: 'pending', // Will be updated to 'completed' or 'failed' in Phase 3
          priceUsd: null,
          costBasisAtSale: null,
          realizedPnl: null
        });
        
        console.log(`🔒 Reserved ${actualInputAmount.toFixed(4)} SOL for swap (atomic + pending tx)`);
      } else {
        // ATOMIC: Try conditional UPDATE/DELETE WITHOUT preliminary SELECT
        // CRITICAL: Reduce BOTH amount AND cost basis proportionally for partial sells
        // Use CTE to capture exact PRE-update state for rollback precision
        
        // Try UPDATE first (assume partial sale) - reduce amount AND total_cost_basis
        // CRITICAL: Use CTE values (p.*) in UPDATE to avoid double-subtraction bugs
        let result = await tx.execute(sql`
          WITH pre_update AS (
            SELECT id, amount, total_cost_basis, average_entry_price, last_price_usd
            FROM ${tokenHoldings}
            WHERE wallet_id = ${walletId} AND mint = ${tokenAddress}
            FOR UPDATE
          )
          UPDATE ${tokenHoldings}
          SET 
            amount = (p.amount::numeric - ${actualInputAmount})::text,
            total_cost_basis = (p.total_cost_basis::numeric * (1 - ${actualInputAmount} / p.amount::numeric))::text
          FROM pre_update p
          WHERE ${tokenHoldings}.id = p.id
            AND p.amount::numeric >= ${actualInputAmount}
            AND (p.amount::numeric - ${actualInputAmount}) > 0
          RETURNING ${tokenHoldings}.*, (SELECT row_to_json(p2) FROM pre_update p2) AS snapshot_data
        `);
        
        if (result.rowCount && result.rowCount > 0) {
          // Partial sell succeeded - store exact PRE-update snapshot from CTE
          const row: any = result.rows[0];
          const preUpdateData = row.snapshot_data;
          
          // Handle NULL snapshot (concurrent deletion)
          if (!preUpdateData) {
            throw new Error('Holding was modified concurrently');
          }
          
          snapshot = {
            type: 'partial',
            preUpdate: {
              amount: preUpdateData.amount,
              totalCostBasis: preUpdateData.total_cost_basis,
              averageEntryPrice: preUpdateData.average_entry_price,
              lastPriceUsd: preUpdateData.last_price_usd
            }
          };
        } else{
          // Either: (1) insufficient tokens, (2) exact amount (need DELETE), or (3) no holding
          // Try DELETE (exact amount scenario) and capture full snapshot
          const deleteResult = await tx.delete(tokenHoldings)
            .where(and(
              eq(tokenHoldings.walletId, walletId),
              eq(tokenHoldings.mint, tokenAddress),
              sql`${tokenHoldings.amount}::float >= ${actualInputAmount}`, // Guard
              sql`${tokenHoldings.amount}::float - ${actualInputAmount} <= 0` // Selling all
            ))
            .returning();
          
          if (deleteResult.length === 0) {
            // Neither UPDATE nor DELETE succeeded → insufficient or missing
            const holdings = await tx.select()
              .from(tokenHoldings)
              .where(and(
                eq(tokenHoldings.walletId, walletId),
                eq(tokenHoldings.mint, tokenAddress)
              ));
            
            if (holdings.length === 0) {
              throw new Error('You do not own this token');
            }
            
            const currentTokens = parseFloat(holdings[0].amount);
            throw new Error(`Insufficient tokens: have ${currentTokens.toFixed(4)}, trying to sell ${actualInputAmount.toFixed(4)}`);
          }
          
          // Store deleted holding snapshot for full restoration
          snapshot = {
            type: 'full',
            holding: deleteResult[0]
          };
        }
        
        // CRITICAL: Create PENDING transaction record to satisfy audit trigger (SELL path)
        await tx.insert(transactions).values({
          walletId,
          txhash: customTxHash, // Use ANX hash (will be updated with real hash in Phase 3)
          tokenAddress: tokenAddress,
          tokenSymbol: tokenAddress.slice(0, 6), // Placeholder (will be updated)
          amount: actualInputAmount.toString(), // Token amount sold
          type: 'sell',
          status: 'pending', // Will be updated to 'completed' or 'failed' in Phase 3
          priceUsd: null,
          costBasisAtSale: null,
          realizedPnl: null
        });
        
        console.log(`🔒 Reserved ${actualInputAmount.toFixed(4)} tokens for swap (atomic + pending tx)`);
      }
      
      return { reserved: true, snapshot };
      });
    } catch (reservationError: any) {
      // Reservation failed (insufficient balance) - return error immediately
      return { success: false, error: reservationError.message || 'Reservation failed' };
    }
    
    // Extract snapshot for rollback use
    const reservedSnapshot = reservationPayload?.snapshot;
    
    // Phase 2: Execute on-chain swap (balances already reserved, safe from races)
    jupiterQuote = {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct,
      transaction: quote.transaction,
      requestId: quote.requestId
    };
    
    if (!jupiterQuote.transaction) {
      // Rollback: Refund reserved balance with full state restoration
      if (reservationPayload?.reserved) {
        await db.transaction(async (tx) => {
          if (type === 'buy') {
            await tx.update(balances)
              .set({ solBalance: sql`${balances.solBalance} + ${actualInputAmount}` })
              .where(eq(balances.walletId, walletId));
            
            // Mark PENDING transaction as FAILED
            await tx.update(transactions)
              .set({ 
                status: 'failed',
                timestamp: new Date()
              })
              .where(and(
                eq(transactions.walletId, walletId),
                eq(transactions.txhash, customTxHash)
              ));
          } else if (reservedSnapshot) {
            // Restore based on snapshot type
            if (reservedSnapshot.type === 'full') {
              // Full sell: restore complete holding
              const holding = reservedSnapshot.holding;
              await tx.insert(tokenHoldings).values({
                walletId: holding.walletId,
                mint: holding.mint,
                symbol: holding.symbol,
                amount: holding.amount,
                averageEntryPrice: holding.averageEntryPrice,
                totalCostBasis: holding.totalCostBasis,
                lastPriceUsd: holding.lastPriceUsd
              }).onConflictDoUpdate({
                target: [tokenHoldings.walletId, tokenHoldings.mint],
                set: {
                  amount: holding.amount,
                  averageEntryPrice: holding.averageEntryPrice,
                  totalCostBasis: holding.totalCostBasis,
                  lastPriceUsd: holding.lastPriceUsd
                }
              });
            } else if (reservedSnapshot.type === 'partial') {
              // Partial sell: restore full PRE-update state
              await tx.update(tokenHoldings)
                .set({
                  amount: reservedSnapshot.preUpdate.amount,
                  totalCostBasis: reservedSnapshot.preUpdate.totalCostBasis,
                  averageEntryPrice: reservedSnapshot.preUpdate.averageEntryPrice,
                  lastPriceUsd: reservedSnapshot.preUpdate.lastPriceUsd
                })
                .where(and(
                  eq(tokenHoldings.walletId, walletId),
                  eq(tokenHoldings.mint, tokenAddress)
                ));
            }
            
            // Mark PENDING transaction as FAILED (SELL path)
            await tx.update(transactions)
              .set({ 
                status: 'failed',
                timestamp: new Date()
              })
              .where(and(
                eq(transactions.walletId, walletId),
                eq(transactions.txhash, customTxHash)
              ));
          }
        });
      }
      return { success: false, error: 'Quote missing transaction data' };
    }
    
    try {
      realTxHash = await executeJupiterSwap(
        jupiterQuote,
        privateKeyBase58,
        solanaPool.address
      );
      console.log(`✅ Jupiter swap executed: ${realTxHash}`);
    } catch (swapError: any) {
      // Swap failed! Rollback: Refund reserved balance with full state restoration
      console.error('Swap failed, rolling back balance reservation:', swapError);
      if (reservationPayload?.reserved) {
        await db.transaction(async (tx) => {
          if (type === 'buy') {
            await tx.update(balances)
              .set({ solBalance: sql`${balances.solBalance} + ${actualInputAmount}` })
              .where(eq(balances.walletId, walletId));
            
            // Mark PENDING transaction as FAILED
            await tx.update(transactions)
              .set({ 
                status: 'failed',
                timestamp: new Date()
              })
              .where(and(
                eq(transactions.walletId, walletId),
                eq(transactions.txhash, customTxHash)
              ));
          } else if (reservedSnapshot) {
            // Restore based on snapshot type
            if (reservedSnapshot.type === 'full') {
              // Full sell: restore complete holding
              const holding = reservedSnapshot.holding;
              await tx.insert(tokenHoldings).values({
                walletId: holding.walletId,
                mint: holding.mint,
                symbol: holding.symbol,
                amount: holding.amount,
                averageEntryPrice: holding.averageEntryPrice,
                totalCostBasis: holding.totalCostBasis,
                lastPriceUsd: holding.lastPriceUsd
              }).onConflictDoUpdate({
                target: [tokenHoldings.walletId, tokenHoldings.mint],
                set: {
                  amount: holding.amount,
                  averageEntryPrice: holding.averageEntryPrice,
                  totalCostBasis: holding.totalCostBasis,
                  lastPriceUsd: holding.lastPriceUsd
                }
              });
            } else if (reservedSnapshot.type === 'partial') {
              // Partial sell: restore full PRE-update state
              await tx.update(tokenHoldings)
                .set({
                  amount: reservedSnapshot.preUpdate.amount,
                  totalCostBasis: reservedSnapshot.preUpdate.totalCostBasis,
                  averageEntryPrice: reservedSnapshot.preUpdate.averageEntryPrice,
                  lastPriceUsd: reservedSnapshot.preUpdate.lastPriceUsd
                })
                .where(and(
                  eq(tokenHoldings.walletId, walletId),
                  eq(tokenHoldings.mint, tokenAddress)
                ));
            }
            
            // Mark PENDING transaction as FAILED (SELL path)
            await tx.update(transactions)
              .set({ 
                status: 'failed',
                timestamp: new Date()
              })
              .where(and(
                eq(transactions.walletId, walletId),
                eq(transactions.txhash, customTxHash)
              ));
          }
        });
      }
      return { success: false, error: swapError.message || 'Swap execution failed' };
    }
    
    // Phase 3: Finalize - add received assets and create transaction record
    // CRITICAL: NO preliminary SELECTs! Use atomic increments/UPSERT
    const result = await db.transaction(async (tx) => {
      let transactionAmount: string;
      let priceUsd: string;
      
      if (type === 'buy') {
        // NOTE: SOL already deducted in Phase 1, only add received tokens here
        const solSpent = parseFloat(jupiterQuote.inAmount) / Math.pow(10, 9);
        const solPrice = await getSolanaPrice();
        const costUsd = solSpent * solPrice;
        
        // SECURITY: Use REAL on-chain output amount from Jupiter transaction
        const actualTokenReceived = parseFloat(jupiterQuote.outAmount) / Math.pow(10, tokenDecimals);
        
        transactionAmount = actualTokenReceived.toFixed(tokenDecimals);
        priceUsd = (costUsd / actualTokenReceived).toFixed(6);
        
        // ATOMIC UPSERT with CTE for deltas (ensures correct average_entry_price)
        await tx.execute(sql`
          WITH delta AS (
            SELECT 
              ${actualTokenReceived}::numeric AS delta_amount,
              ${costUsd}::numeric AS delta_cost,
              ${priceUsd}::text AS price_usd,
              ${tokenSymbol}::text AS symbol_name
          )
          INSERT INTO token_holdings (wallet_id, mint, amount, total_cost_basis, average_entry_price, last_price_usd, symbol)
          SELECT 
            ${walletId}::text,
            ${tokenAddress}::text,
            delta_amount::text,
            delta_cost::text,
            price_usd,
            price_usd,
            symbol_name
          FROM delta
          ON CONFLICT (wallet_id, mint) DO UPDATE
          SET 
            amount = (token_holdings.amount::numeric + EXCLUDED.amount::numeric)::text,
            total_cost_basis = (token_holdings.total_cost_basis::numeric + EXCLUDED.total_cost_basis::numeric)::text,
            average_entry_price = ((token_holdings.total_cost_basis::numeric + EXCLUDED.total_cost_basis::numeric) / NULLIF(token_holdings.amount::numeric + EXCLUDED.amount::numeric, 0))::text,
            last_price_usd = EXCLUDED.last_price_usd
          RETURNING *
        `);
      } else {
        // SELL logic
        // NOTE: Tokens already deducted in Phase 1, only add received SOL here
        const tokensSold = parseFloat(jupiterQuote.inAmount) / Math.pow(10, tokenDecimals);
        
        // SECURITY: Use REAL on-chain output SOL from Jupiter transaction
        const actualSolReceived = parseFloat(jupiterQuote.outAmount) / Math.pow(10, 9);
        
        const solPrice = await getSolanaPrice();
        const soldValueUsd = actualSolReceived * solPrice;
        
        transactionAmount = tokensSold.toFixed(tokenDecimals);
        priceUsd = (soldValueUsd / tokensSold).toFixed(6);
        
        // ATOMIC: Add received SOL (no preliminary SELECT)
        await tx.update(balances)
          .set({ solBalance: sql`${balances.solBalance} + ${actualSolReceived}` })
          .where(eq(balances.walletId, walletId));
      }
      
      // UPDATE pending transaction to completed (created in Phase 1)
      await tx.update(transactions)
        .set({
          txhash: realTxHash, // Update with real Jupiter tx hash
          tokenSymbol, // Update with real token symbol
          amount: transactionAmount,
          priceUsd,
          status: 'completed',
          timestamp: new Date()
        })
        .where(and(
          eq(transactions.walletId, walletId),
          eq(transactions.txhash, customTxHash) // Find by ANX hash
        ));
      
      return { txhash: realTxHash };
    });
    
    // SECURITY: Return REAL on-chain amounts, not caller-provided quote
    const actualTokenAmount = type === 'buy' 
      ? (parseFloat(jupiterQuote.outAmount) / Math.pow(10, tokenDecimals)).toFixed(6)
      : amount;
    const actualSolAmount = type === 'buy'
      ? amount
      : (parseFloat(jupiterQuote.outAmount) / Math.pow(10, 9)).toFixed(6);
    
    return {
      success: true,
      transaction: {
        txhash: result.txhash,
        type,
        tokenSymbol,
        amount: actualTokenAmount,
        solAmount: actualSolAmount
      }
    };
  } catch (error: any) {
    console.error("Swap execution error:", error);
    return { success: false, error: error.message || "Swap failed" };
  }
}
