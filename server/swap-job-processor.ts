import { db } from "./db";
import { swapJobs, transactions, tokenHoldings, balances, wallets } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { executeJupiterSwap } from "./jupiter";
import { storage } from "./storage";
import { getSolanaPrice } from "./coingecko";
import { getTokenMetadataWithFallback } from "./helius-metadata";
import { validateTokenDecimals } from "./token-metadata";
import { getTokenPrice } from "./pricing";

/**
 * Process pending swap jobs in background (Phase 2 - Asynchronous)
 * Executes Jupiter swaps and updates transaction records
 * 
 * CURRENT IMPLEMENTATION: Timer-based recovery with atomic operations
 * 
 * SECURITY PROTECTIONS:
 * ✅ Atomic job claim (compare-and-set) prevents double-execution of pending jobs
 * ✅ Conditional chainTxhash store (WHERE chainTxhash IS NULL) detects duplicate swaps
 * ✅ Duplicate detection skips settlement to prevent double-crediting
 * ✅ Idempotent swap execution (skip if chainTxhash exists)
 * ✅ Idempotent settlement (safe to re-run)
 * 
 * KNOWN LIMITATIONS (Edge Cases):
 * ⚠️  Timer-based recovery (2min threshold) can interfere with slow swaps (>2min)
 * ⚠️  Duplicate swap detection happens AFTER on-chain execution (wasted gas, potential slippage)
 * ⚠️  Duplicate detection leaves job in 'processing' state (manual intervention needed)
 * 
 * PRODUCTION RECOMMENDATION:
 * For multi-worker deployments with high reliability requirements, implement lease/heartbeat mechanism:
 * 1. Add columns: worker_id (varchar), lease_expiration (timestamp)
 * 2. Workers claim jobs by setting worker_id + lease_expiration (e.g., NOW() + 5 minutes)
 * 3. Workers periodically extend lease_expiration (heartbeat every 30 seconds)
 * 4. Recovery only reclaims jobs where lease_expiration < NOW() (no heartbeat = crashed worker)
 * 5. This prevents recovery from interfering with active workers, even for slow swaps
 * 
 * CURRENT SAFETY LEVEL: Safe for single-worker deployments and typical swap latencies (<2min)
 */
export async function processSwapJobs(): Promise<void> {
  try {
    // CRASH RECOVERY: Revert STALE 'processing' jobs WITHOUT chainTxhash back to 'pending'
    // SAFETY: Only revert jobs older than 2 minutes to avoid interfering with active workers
    // These are jobs that crashed AFTER claim but BEFORE on-chain swap execution
    const staleThresholdMinutes = 2;
    const stuckJobs = await db.update(swapJobs)
      .set({ 
        status: 'pending',
        processedAt: null // Clear processedAt to retry fresh
      })
      .where(
        sql`${swapJobs.status} = 'processing' 
            AND ${swapJobs.chainTxhash} IS NULL 
            AND ${swapJobs.processedAt} < NOW() - INTERVAL '${sql.raw(staleThresholdMinutes.toString())} minutes'`
      )
      .returning({ id: swapJobs.id });
    
    if (stuckJobs.length > 0) {
      console.log(`♻️  Reverted ${stuckJobs.length} stale processing jobs (>${staleThresholdMinutes}min old) back to pending (pre-swap crash recovery)`);
    }
    
    // Fetch pending swap jobs AND stuck 'processing' jobs with chainTxhash (post-swap crash recovery)
    // IDEMPOTENCY: Jobs stuck in 'processing' with chainTxhash need settlement completion
    const pendingJobs = await db.select()
      .from(swapJobs)
      .where(
        sql`${swapJobs.status} = 'pending' OR (${swapJobs.status} = 'processing' AND ${swapJobs.chainTxhash} IS NOT NULL)`
      )
      .limit(5); // Process max 5 jobs per cycle
    
    if (pendingJobs.length === 0) {
      return; // No jobs to process
    }
    
    console.log(`🔄 Processing ${pendingJobs.length} swap jobs (pending + post-swap recovery)...`);
    
    for (const job of pendingJobs) {
      try {
        // RECOVERY vs NEW JOB: Handle differently based on current status
        const isRecoveryJob = job.status === 'processing' && job.chainTxhash;
        
        if (!isRecoveryJob) {
          // NEW JOB: ATOMIC CLAIM to prevent concurrent worker race
          // Compare-and-set: Mark processing ONLY if still pending
          const claimResult = await db.update(swapJobs)
            .set({ 
              status: 'processing',
              processedAt: new Date()
            })
            .where(
              sql`${swapJobs.id} = ${job.id} AND ${swapJobs.status} = 'pending'`
            )
            .returning({ id: swapJobs.id });
          
          // If no row was updated, another worker claimed this job - skip it
          if (claimResult.length === 0) {
            console.log(`⏭️  Job ${job.id} already claimed by another worker - skipping`);
            continue;
          }
          
          console.log(`✅ Successfully claimed job ${job.id} for processing`);
        } else {
          // RECOVERY JOB: Already marked 'processing' with chainTxhash - proceed to settlement
          console.log(`♻️  Recovering stuck job ${job.id} (chainTxhash: ${job.chainTxhash})`);
        }
        
        // CRITICAL: Validate decimals FIRST - FAIL FAST BEFORE executing swap
        // Explicitly check for empty/undefined/null (allows "0" for zero-decimal tokens!)
        if (job.tokenDecimals === undefined || job.tokenDecimals === null || job.tokenDecimals === '') {
          console.error(`❌ [SwapJob] Missing token decimals for job ${job.id} - ABORTING SWAP`);
          await db.update(swapJobs)
            .set({ 
              status: 'failed',
              failureReason: `Missing token decimals field`,
              completedAt: new Date()
            })
            .where(eq(swapJobs.id, job.id));
          
          await db.update(transactions)
            .set({ status: 'failed' })
            .where(eq(transactions.id, job.transactionId));
          
          continue; // Skip WITHOUT executing swap
        }
        
        const parsedDecimals = Number(job.tokenDecimals);
        const decimalsValidation = validateTokenDecimals(parsedDecimals, 'SwapJob');
        
        if (decimalsValidation.kind === 'error') {
          // FAIL FAST: Mark job as failed WITHOUT executing swap
          console.error(`❌ ${decimalsValidation.reason} for job ${job.id} - ABORTING SWAP`);
          await db.update(swapJobs)
            .set({ 
              status: 'failed',
              failureReason: `Invalid token decimals: ${job.tokenDecimals}. ${decimalsValidation.reason}`,
              completedAt: new Date()
            })
            .where(eq(swapJobs.id, job.id));
          
          await db.update(transactions)
            .set({ status: 'failed' })
            .where(eq(transactions.id, job.transactionId));
          
          continue; // Skip to next job WITHOUT executing swap
        }
        
        const tokenDecimals = decimalsValidation.decimals; // ✅ Validated (finite, integer, >= 0)
        
        // Parse Jupiter quote
        const jupiterQuote = JSON.parse(job.jupiterQuote);
        
        // Use SOLANA_WALLET_SECRET directly (NOT encrypted DB key)
        const solanaWalletSecret = process.env.SOLANA_WALLET_SECRET;
        if (!solanaWalletSecret) {
          throw new Error("SOLANA_WALLET_SECRET not configured");
        }
        
        // Get liquidity router address for logging
        const solanaPool = await storage.getSystemWallet("liquidity_router_node");
        const walletAddress = solanaPool?.address || 'unknown';
        
        // Execute swap on-chain (only after validation passes!)
        // IDEMPOTENCY CHECK: Skip if swap already executed (crash recovery)
        let realTxHash = job.chainTxhash;
        
        if (!realTxHash) {
          console.log(`🚀 Executing Jupiter swap for job ${job.id}...`);
          realTxHash = await executeJupiterSwap(
            jupiterQuote,
            solanaWalletSecret, // ✅ Use env var directly!
            walletAddress
          );
          
          console.log(`✅ Swap executed: ${realTxHash}`);
          
          // CRITICAL: Store tx hash IMMEDIATELY - but ONLY if still NULL (prevents race with another worker)
          const storeResult = await db.update(swapJobs)
            .set({ chainTxhash: realTxHash })
            .where(
              sql`${swapJobs.id} = ${job.id} AND ${swapJobs.chainTxhash} IS NULL`
            )
            .returning({ id: swapJobs.id });
          
          if (storeResult.length === 0) {
            // Another worker already executed and stored txhash - this is a duplicate execution!
            // SAFETY: Skip this job entirely - the first worker will complete settlement correctly
            // Do NOT refund or credit - that would cause double-crediting
            console.warn(`⚠️  DUPLICATE SWAP DETECTED: Job ${job.id} already has chainTxhash from another worker. Skipping settlement for our duplicate swap ${realTxHash} to prevent double-crediting.`);
            continue; // Skip to next job WITHOUT settlement
          }
          
          console.log(`📝 Stored chainTxhash for job ${job.id}: ${realTxHash}`);
        } else {
          console.log(`♻️ Recovering job ${job.id} with existing chainTxhash: ${realTxHash}`);
        }
        
        // ✅ FIX: Fetch live market price BEFORE transaction to prevent blocking
        // (Only needed for BUY jobs - fetched outside transaction to avoid row locks)
        let liveMarketPrice: number | null = null;
        if (job.type === 'buy') {
          try {
            liveMarketPrice = await getTokenPrice(job.tokenMint);
          } catch (err) {
            console.warn(`Failed to fetch live market price for ${job.tokenSymbol}:`, err);
            // Will use purchase price as fallback inside transaction
          }
        }
        
        // Update transaction and holdings atomically (idempotent - safe to re-run)
        await db.transaction(async (tx) => {
          if (job.type === 'buy') {
            // ========== BUY JOB PROCESSING ==========
            const tokenReceived = parseFloat(jupiterQuote.outAmount) / Math.pow(10, tokenDecimals);
            const solSpent = parseFloat(job.solAmount);
            
            // CRITICAL: Always update legacy CA prefix symbols to real names
            let finalTokenSymbol = job.tokenSymbol;
            const isLegacyPrefix = !finalTokenSymbol || finalTokenSymbol.length === 6 || finalTokenSymbol === 'UNKNOWN';
            
            if (isLegacyPrefix) {
              console.log(`🔄 [BUY] Updating legacy CA prefix symbol "${finalTokenSymbol}" for ${job.tokenMint}...`);
              try {
                const metadata = await getTokenMetadataWithFallback(job.tokenMint);
                finalTokenSymbol = metadata.symbol;
                console.log(`✅ [BUY] Updated to real symbol: ${finalTokenSymbol}`);
              } catch (error: any) {
                console.error(`⚠️ Failed to fetch metadata for BUY finalization: ${error.message}`);
                // CRITICAL: Use safe placeholder instead of CA prefix
                finalTokenSymbol = 'UNKNOWN';
              }
            }
            
            // Get SOL price for cost basis calculation
            const solPrice = await getSolanaPrice();
            const costUsd = solSpent * solPrice;
            const pricePerToken = costUsd / tokenReceived;
          
          // Update transaction to COMPLETED (keep ANV txhash, only update chainTxhash)
          await tx.update(transactions)
            .set({
              // ✅ DON'T overwrite txhash - keep ANV-BUY-xxx format!
              chainTxhash: realTxHash, // Store real blockchain hash here
              tokenSymbol: finalTokenSymbol, // Real token symbol from Helius
              amount: tokenReceived.toString(),
              solValue: job.solAmount, // ✅ FIX: Preserve SOL spent for Explorer
              instructions: 'buy', // ✅ FIX: Preserve instructions for Explorer
              priceUsd: pricePerToken.toString(),
              status: 'completed',
              timestamp: new Date()
            })
            .where(eq(transactions.id, job.transactionId));
          
            // Move pendingInAmount to amount in token_holdings
            const holdingRows = await tx.select()
              .from(tokenHoldings)
              .where(and(
                eq(tokenHoldings.walletId, job.walletId),
                eq(tokenHoldings.mint, job.tokenMint)
              ))
              .limit(1);
            
            if (holdingRows.length > 0) {
              const holding = holdingRows[0];
              const currentAmount = parseFloat(holding.amount || '0');
              const currentCostBasis = parseFloat(holding.totalCostBasis || '0');
              const newAmount = currentAmount + tokenReceived;
              const newCostBasis = currentCostBasis + costUsd;
              const newAvgPrice = newCostBasis / newAmount;
              
              // ✅ FIX: Use pre-fetched live market price (fetched outside transaction to avoid blocking)
              // Fall back to purchase price if market price fetch failed
              const finalMarketPrice = (liveMarketPrice !== null && liveMarketPrice !== undefined) 
                ? liveMarketPrice 
                : pricePerToken;
              
              await tx.update(tokenHoldings)
                .set({
                  symbol: finalTokenSymbol, // Update symbol to real token name
                  amount: sql`${tokenHoldings.amount} + ${tokenReceived}`,
                  // CRITICAL FIX: Clear pending with numeric literal to prevent negative values
                  pendingInAmount: sql`0::numeric`,
                  totalCostBasis: newCostBasis.toString(),
                  averageEntryPrice: newAvgPrice.toString(), // Weighted average entry price
                  lastPriceUsd: finalMarketPrice.toString(), // LIVE market price (not purchase price!)
                  lastPriceUpdatedAt: new Date(),
                  updatedAt: new Date()
                })
                .where(and(
                  eq(tokenHoldings.walletId, job.walletId),
                  eq(tokenHoldings.mint, job.tokenMint)
                ));
            }
            
            // Mark swap job as completed
            await tx.update(swapJobs)
              .set({
                status: 'completed',
                completedAt: new Date()
              })
              .where(eq(swapJobs.id, job.id));
            
            console.log(`✅ BUY job ${job.id} completed: ${tokenReceived.toFixed(6)} tokens received`);
            
          } else if (job.type === 'sell') {
            // ========== SELL JOB PROCESSING ==========
            // Get actual SOL received (SOL has 9 decimals)
            const solReceived = parseFloat(jupiterQuote.outAmount) / 1e9;
            const tokensSold = parseFloat(job.tokenAmount || '0');
            
            // CRITICAL: Always update legacy CA prefix symbols to real names
            let finalTokenSymbol = job.tokenSymbol;
            const isLegacyPrefix = !finalTokenSymbol || finalTokenSymbol.length === 6 || finalTokenSymbol === 'UNKNOWN';
            
            if (isLegacyPrefix) {
              console.log(`🔄 [SELL] Updating legacy CA prefix symbol "${finalTokenSymbol}" for ${job.tokenMint}...`);
              try {
                const metadata = await getTokenMetadataWithFallback(job.tokenMint);
                finalTokenSymbol = metadata.symbol;
                console.log(`✅ [SELL] Updated to real symbol: ${finalTokenSymbol}`);
              } catch (error: any) {
                console.error(`⚠️ Failed to fetch metadata for SELL finalization: ${error.message}`);
                // CRITICAL: Use safe placeholder instead of CA prefix
                finalTokenSymbol = 'UNKNOWN';
              }
            }
            
            // Fetch transaction for cost basis
            const txRows = await tx.select()
              .from(transactions)
              .where(eq(transactions.id, job.transactionId))
              .limit(1);
            
            // Calculate realized PnL if cost basis exists
            let realizedPnl = null;
            const solPrice = await getSolanaPrice();
            const saleValueUsd = solReceived * solPrice;
            
            if (txRows.length > 0 && txRows[0].costBasisAtSale) {
              const costBasis = parseFloat(txRows[0].costBasisAtSale);
              realizedPnl = (saleValueUsd - costBasis).toString();
            }
            
            // Update transaction to COMPLETED
            await tx.update(transactions)
              .set({
                chainTxhash: realTxHash,
                tokenSymbol: finalTokenSymbol, // Real token symbol from Helius
                amount: tokensSold.toString(),
                solValue: solReceived.toString(), // ✅ FIX: Preserve SOL received for Explorer
                instructions: 'sell', // ✅ FIX: Preserve instructions for Explorer
                priceUsd: (saleValueUsd / tokensSold).toString(), // Price per token
                realizedPnl: realizedPnl,
                status: 'completed',
                timestamp: new Date()
              })
              .where(eq(transactions.id, job.transactionId));
            
            // Credit SOL to balance
            await tx.update(balances)
              .set({
                solBalance: sql`${balances.solBalance} + ${solReceived}`,
                updatedAt: new Date()
              })
              .where(eq(balances.walletId, job.walletId));
            
            // Check if holding should be deleted (amount = 0 after sell)
            const remainingHoldings = await tx.select()
              .from(tokenHoldings)
              .where(and(
                eq(tokenHoldings.walletId, job.walletId),
                eq(tokenHoldings.mint, job.tokenMint)
              ))
              .limit(1);
            
            if (remainingHoldings.length > 0) {
              const finalAmount = parseFloat(remainingHoldings[0].amount);
              if (finalAmount <= 0) {
                // Delete holding with zero balance (100% sold)
                await tx.delete(tokenHoldings)
                  .where(and(
                    eq(tokenHoldings.walletId, job.walletId),
                    eq(tokenHoldings.mint, job.tokenMint)
                  ));
                console.log(`🧹 Deleted zero-balance holding for ${job.tokenSymbol} (${job.tokenMint})`);
              } else {
                // ✅ FIX: Partial sell - Fetch FRESH market price and update
                // DO NOT use sale execution price (can differ from current market)
                let freshPrice: number | null = null;
                try {
                  freshPrice = await getTokenPrice(job.tokenMint);
                } catch (err) {
                  console.warn(`Failed to fetch fresh price for ${job.tokenSymbol}:`, err);
                }
                
                const updateFields: any = {
                  symbol: finalTokenSymbol, // Update symbol if changed
                };
                
                // Only update price if we successfully fetched one
                if (freshPrice !== null && freshPrice !== undefined) {
                  updateFields.lastPriceUsd = freshPrice.toString();
                  updateFields.lastPriceUpdatedAt = new Date();
                }
                
                await tx.update(tokenHoldings)
                  .set(updateFields)
                  .where(and(
                    eq(tokenHoldings.walletId, job.walletId),
                    eq(tokenHoldings.mint, job.tokenMint)
                  ));
              }
            }
            
            // Mark swap job as completed
            await tx.update(swapJobs)
              .set({
                status: 'completed',
                completedAt: new Date()
              })
              .where(eq(swapJobs.id, job.id));
            
            console.log(`✅ SELL job ${job.id} completed: ${tokensSold.toFixed(6)} tokens → ${solReceived.toFixed(6)} SOL`);
          }
        });
        
        // Send Telegram notification (edit existing message OR send new message)
        try {
          const { bot } = await import("./telegram-bot.js");
          
          if (!bot) {
            console.warn(`⚠️  Bot is null - cannot send notification for job ${job.id}`);
            return;
          }
          
          // CRITICAL: Fetch transaction details for ANX hash
          const txDetails = await db.select()
            .from(transactions)
            .where(eq(transactions.id, job.transactionId))
            .limit(1);
          
          if (txDetails.length === 0 || !txDetails[0].txhash) {
            console.error(`❌ No transaction hash found for job ${job.id}, transaction ${job.transactionId} - cannot send notification`);
            return;
          }
          
          const anxHash = txDetails[0].txhash;
          const explorerUrl = `https://anvscan.com/tx/${anxHash}`;
          
          let message = '';
          
          if (job.type === 'buy') {
            // Safe parsing for failure notifications (use default if invalid)
            const parsedDecimals = parseInt(job.tokenDecimals || '9');
            const tokenDecimals = !isNaN(parsedDecimals) && parsedDecimals >= 0 ? parsedDecimals : 9;
            const tokenReceived = parseFloat(jupiterQuote.outAmount) / Math.pow(10, tokenDecimals);
            
            message = 
              `🟢 *BUY Completed*\n\n` +
              `💸 Spent: ${parseFloat(job.solAmount).toFixed(4)} SOL\n` +
              `📦 Received: ${tokenReceived.toFixed(6)} tokens\n` +
              `✅ Status: On-chain execution successful\n\n` +
              `🔗 Order ID: \`${anxHash}\`\n` +
              `🔍 [View on ANVscan Explorer](${explorerUrl})\n\n` +
              `_Tokens confirmed in portfolio. Check /portfolio for updated balance._`;
              
          } else if (job.type === 'sell') {
            const solReceived = parseFloat(jupiterQuote.outAmount) / 1e9;
            const tokensSold = parseFloat(job.tokenAmount || '0');
            
            message = 
              `🔴 *SELL Completed*\n\n` +
              `💰 Sold: ${tokensSold.toFixed(6)} ${job.tokenSymbol}\n` +
              `📊 Received: ${solReceived.toFixed(6)} SOL\n` +
              `✅ Status: On-chain execution successful\n\n` +
              `🔗 Order ID: \`${anxHash}\`\n` +
              `🔍 [View on ANVscan Explorer](${explorerUrl})\n\n` +
              `_SOL credited to your balance. Check /portfolio for updated balance._`;
          }
          
          const replyMarkup = {
            inline_keyboard: [[
              { text: "🔄 Refresh Transaction", callback_data: "refresh_transaction" }
            ]]
          };
          
          // Try to edit existing message first (if IDs provided)
          if (job.telegramChatId && job.telegramMessageId) {
            try {
              console.log(`📱 Editing Telegram message for job ${job.id} (chat: ${job.telegramChatId}, msg: ${job.telegramMessageId})`);
              // DON'T use parseInt - keeps full 64-bit chat ID as string
              await bot.api.editMessageText(
                job.telegramChatId,
                parseInt(job.telegramMessageId),
                message,
                { 
                  parse_mode: "Markdown",
                  link_preview_options: { is_disabled: true },
                  reply_markup: replyMarkup
                }
              );
              console.log(`✅ Telegram message edited successfully for ${job.type.toUpperCase()} job ${job.id}`);
            } catch (editError: any) {
              console.error(`❌ Failed to edit Telegram message for job ${job.id}:`, editError.message);
              // Fallback: Try sending new message instead
              throw editError; // Let outer catch handle fallback
            }
          } else {
            // No message to edit - lookup wallet owner and send NEW message
            const walletOwner = await db.select()
              .from(wallets)
              .where(eq(wallets.id, job.walletId))
              .limit(1);
            
            if (walletOwner.length === 0 || !walletOwner[0].telegramUserId) {
              console.log(`⚠️  No Telegram user ID for wallet ${job.walletId} - skipping notification`);
              return;
            }
            
            const telegramUserId = walletOwner[0].telegramUserId;
            try {
              console.log(`📱 Sending NEW Telegram message for job ${job.id} to user ${telegramUserId}`);
              await bot.api.sendMessage(
                telegramUserId, // Already string, no parseInt needed
                message,
                {
                  parse_mode: "Markdown",
                  link_preview_options: { is_disabled: true },
                  reply_markup: replyMarkup
                }
              );
              console.log(`✅ NEW Telegram message sent successfully for ${job.type.toUpperCase()} job ${job.id}`);
            } catch (sendError: any) {
              console.error(`❌ Failed to send NEW Telegram message for job ${job.id}:`, sendError.message);
              throw sendError; // Bubble up for logging
            }
          }
        } catch (telegramError: any) {
          console.error(`❌ Telegram notification failed for job ${job.id}:`, telegramError.message);
          console.error(`❌ Full error:`, telegramError);
        }
        
      } catch (error: any) {
        console.error(`❌ Swap job ${job.id} failed:`, error.message);
        
        // Rollback: Mark transaction as failed FIRST, then refund (audit trigger compliance)
        await db.transaction(async (tx) => {
          // 1. Mark transaction as failed FIRST (before balance change)
          await tx.update(transactions)
            .set({
              status: 'failed',
              timestamp: new Date()
            })
            .where(eq(transactions.id, job.transactionId));
          
          if (job.type === 'buy') {
            // 2. Refund SOL (trigger sees failed transaction above)
            await tx.update(balances)
              .set({
                solBalance: sql`${balances.solBalance} + ${parseFloat(job.solAmount)}`,
                updatedAt: new Date()
              })
              .where(eq(balances.walletId, job.walletId));
            
            // 3. Remove pendingInAmount
            await tx.update(tokenHoldings)
              .set({
                pendingInAmount: sql`${tokenHoldings.pendingInAmount} - ${parseFloat(job.tokenAmount || '0')}`,
                updatedAt: new Date()
              })
              .where(and(
                eq(tokenHoldings.walletId, job.walletId),
                eq(tokenHoldings.mint, job.tokenMint)
              ));
            
            console.log(`🔄 BUY job ${job.id} rolled back, SOL refunded to user`);
            
          } else if (job.type === 'sell') {
            // 2. Refund tokens back to holdings WITH cost basis restoration
            // Fetch transaction for cost basis snapshot
            const txRows = await tx.select()
              .from(transactions)
              .where(eq(transactions.id, job.transactionId))
              .limit(1);
            
            const costBasisToRestore = txRows.length > 0 && txRows[0].costBasisAtSale 
              ? parseFloat(txRows[0].costBasisAtSale) 
              : 0;
            
            // Get current holdings to recalculate average entry price
            const holdingRows = await tx.select()
              .from(tokenHoldings)
              .where(and(
                eq(tokenHoldings.walletId, job.walletId),
                eq(tokenHoldings.mint, job.tokenMint)
              ))
              .limit(1);
            
            if (holdingRows.length > 0) {
              const currentCostBasis = parseFloat(holdingRows[0].totalCostBasis || '0');
              const currentAmount = parseFloat(holdingRows[0].amount || '0');
              const tokensToRestore = parseFloat(job.tokenAmount || '0');
              
              const newCostBasis = currentCostBasis + costBasisToRestore;
              const newAmount = currentAmount + tokensToRestore;
              const newAvgPrice = newAmount > 0 ? newCostBasis / newAmount : 0;
              
              await tx.update(tokenHoldings)
                .set({
                  amount: sql`${tokenHoldings.amount} + ${tokensToRestore}`,
                  totalCostBasis: newCostBasis.toString(),
                  averageEntryPrice: newAvgPrice.toString(),
                  updatedAt: new Date()
                })
                .where(and(
                  eq(tokenHoldings.walletId, job.walletId),
                  eq(tokenHoldings.mint, job.tokenMint)
                ));
              
              console.log(`🔄 SELL job ${job.id} rolled back: ${tokensToRestore.toFixed(6)} tokens + $${costBasisToRestore.toFixed(2)} cost basis restored`);
            } else {
              console.warn(`⚠️  No holding found for SELL rollback - cannot restore tokens`);
            }
          }
          
          // 4. Mark job as failed
          await tx.update(swapJobs)
            .set({
              status: 'failed',
              failureReason: error.message,
              completedAt: new Date()
            })
            .where(eq(swapJobs.id, job.id));
        });
      }
    }
    
  } catch (error: any) {
    console.error("Swap job processing error:", error);
  }
}
