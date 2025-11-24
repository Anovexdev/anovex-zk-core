import { db } from "./db";
import { deposits, withdrawals, balances, transactions, monitorSessions, tokenHoldings } from "@shared/schema";
import { eq, and, sql, or, desc, isNull } from "drizzle-orm";
import { getExchangeStatus, createDepositStep2Exchange } from "./bridge-protocol";
import { storage } from "./storage";
import { getPrivacyRelayNodeBalance, sendTronFromPrivacyRelayNode } from "./chain-connector";
import { sendSolFromLiquidityRouterNode } from "./jupiter";
import { processSwapJobs } from "./swap-job-processor";
import { bot } from "./telegram-bot";
import { InlineKeyboard } from "grammy";
import { getSolanaPrice } from "./coingecko";

const POLLING_INTERVAL = 15000; // 15 seconds (optimized from 5s)
const MONITOR_REFRESH_INTERVAL = 30000; // 30 seconds (optimized from 20s)

/**
 * Edit Telegram message with updated deposit/withdrawal status
 */
async function updateTelegramMessage(
  chatId: string,
  messageId: string,
  statusMessage: string,
  refreshCallbackData?: string
) {
  if (!bot) return; // Bot not configured
  
  try {
    const keyboard = new InlineKeyboard();
    if (refreshCallbackData) {
      keyboard.text("🔄 Refresh Status", refreshCallbackData);
    }
    
    await bot.api.editMessageText(
      parseInt(chatId),
      parseInt(messageId),
      statusMessage,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
  } catch (error: any) {
    // Silently ignore "message is not modified" errors
    if (!error?.description?.includes("message is not modified")) {
      console.error(`[TELEGRAM] Failed to edit message:`, error.message);
    }
  }
}

/**
 * Generate deposit status message (matches telegram/handlers/deposit.ts)
 */
async function getDepositStatusMessage(deposit: any): Promise<string> {
  let statusEmoji = "⏳";
  let statusText = "";
  let step = 1;

  switch (deposit.status) {
    case 'waiting_step1':
      statusEmoji = "⏳";
      statusText = "Initiating ZK Relay Routing";
      step = 1;
      break;
    case 'waiting_step2':
      if (!deposit.step1CompletedAt) {
        statusEmoji = "🔄";
        statusText = "Privacy Network Synchronization";
        step = 2;
      } else {
        statusEmoji = "⚡";
        statusText = "Shadow Liquidity Conversion Active";
        step = 3;
      }
      break;
    case 'finished':
      statusEmoji = "✅";
      statusText = "Stealth Settlement Complete";
      step = 6;
      break;
    case 'failed':
      statusEmoji = "❌";
      statusText = "Transaction Failed";
      step = 0;
      break;
    default:
      statusEmoji = "⏳";
      statusText = "Routing Transaction";
      step = 1;
  }

  let message =
    `${statusEmoji} *Deposit Status*\n\n` +
    `*Step ${step}/6: ${statusText}*\n\n` +
    `${getDepositStepDescription(step)}\n\n` +
    `Amount: ${deposit.solAmount || "—"} SOL`;

  // Add ANVscan link if deposit is finished
  if (deposit.status === 'finished' && deposit.id) {
    try {
      const txResults = await db.select()
        .from(transactions)
        .where(eq(transactions.depositId, deposit.id))
        .limit(1);
      
      if (txResults.length > 0) {
        const txHash = txResults[0].txhash;
        message += `\n\n🔍 [View on ANVscan Explorer](https://anvscan.com/tx/${txHash})`;
      }
    } catch (error) {
      console.error("Error fetching deposit transaction hash:", error);
      // Continue without ANVscan link if query fails
    }
  }

  return message;
}

function getDepositStepDescription(step: number): string {
  const descriptions = [
    "Awaiting stealth relay synchronization",
    "ZK relay network coordinating transaction obfuscation",
    "Shadow liquidity conversion routing initiated",
    "Atomic swap execution via Anovex Liquidity Engine",
    "Return-path asset conversion with MEV protection",
    "Stealth balance credited to anonymous vault"
  ];
  
  if (step >= 1 && step <= 6) {
    return descriptions[step - 1];
  }
  
  return "Routing transaction via ZK network...";
}

/**
 * Generate withdrawal status message (matches telegram/handlers/withdraw.ts)
 */
async function getWithdrawalStatusMessage(withdrawal: any): Promise<string> {
  let statusEmoji = "⏳";
  let statusText = "";
  let step = 1;

  switch (withdrawal.status) {
    case 'waiting_step1':
      statusEmoji = "⏳";
      statusText = "PRIVACY RELAY INITIALIZATION";
      step = 1;
      break;
    case 'waiting_step2':
      statusEmoji = "🔄";
      statusText = "ROUTING THROUGH ZK NETWORK";
      step = 2;
      break;
    case 'finished':
      statusEmoji = "✅";
      statusText = "STEALTH DELIVERY COMPLETE";
      step = 2;
      break;
    case 'failed':
      statusEmoji = "❌";
      statusText = "PROCESS FAILED";
      step = 0;
      break;
    default:
      statusEmoji = "⏳";
      statusText = "PRIVACY RELAY INITIALIZATION";
      step = 1;
  }

  // Use solSent if finished, otherwise solDeducted
  const amount = withdrawal.status === 'finished' 
    ? (withdrawal.solSent || withdrawal.solDeducted || "—")
    : (withdrawal.solDeducted || "—");

  const destAddress = withdrawal.destinationAddress;
  const truncatedDest = destAddress 
    ? `${destAddress.slice(0, 8)}...${destAddress.slice(-8)}`
    : "—";

  let message =
    `${statusEmoji} *WITHDRAWAL STATUS*\n\n` +
    `*Step ${step}/2: ${statusText}*\n\n` +
    `${getWithdrawalStepDescription(step)}\n\n` +
    `Amount: ${amount} SOL\n` +
    `Destination: \`${truncatedDest}\``;

  // Add ANVscan explorer link when finished
  if (withdrawal.status === 'finished') {
    try {
      const txRecord = await db.select()
        .from(transactions)
        .where(eq(transactions.withdrawalId, withdrawal.id))
        .limit(1);
      
      if (txRecord.length > 0 && txRecord[0].txhash) {
        const anxHash = txRecord[0].txhash;
        const explorerUrl = `https://anvscan.com/tx/${anxHash}`;
        message += `\n\n🔗 Order ID: \`${anxHash}\`\n🔍 [View on ANVscan Explorer](${explorerUrl})`;
      }
    } catch (error) {
      console.error('[POLLING] Failed to fetch ANX hash for withdrawal:', error);
    }
  }

  return message;
}

function getWithdrawalStepDescription(step: number): string {
  switch (step) {
    case 1:
      return "Atomic routing via ZK relay network with MEV protection";
    case 2:
      return "Stealth delivery complete - assets transferred anonymously";
    default:
      return "Executing withdrawal via shadow network...";
  }
}

/**
 * Background polling job for deposit/withdrawal/swap automation
 * Runs every 15 seconds to check pending operations (optimized from 5s)
 * Auto-triggers Step 2 when Step 1 finishes
 * Auto-credits balance when Step 2 finishes
 * Executes pending swap jobs in background
 */
export function startDepositPolling() {
  console.log('🔄 Starting background polling job (15-second intervals)...');
  
  // Run immediately on startup
  processDeposits();
  processWithdrawals();
  processSwapJobs();
  refreshMonitorSessions();
  
  // Then run every 15 seconds
  setInterval(() => {
    processDeposits();
  }, POLLING_INTERVAL);
  
  setInterval(() => {
    processWithdrawals();
  }, POLLING_INTERVAL);
  
  setInterval(() => {
    processSwapJobs(); // Process swap jobs in background
  }, POLLING_INTERVAL);
  
  // Refresh monitor sessions every 20 seconds
  setInterval(() => {
    refreshMonitorSessions();
  }, MONITOR_REFRESH_INTERVAL);
  
  console.log('✅ Polling job started - deposits/withdrawals/swaps/monitors will auto-process');
}

/**
 * Process pending deposits:
 * - waiting_step1 → Check if Step 1 finished → Auto-trigger Step 2
 * - waiting_step2 → Check if Step 2 finished → Credit balance
 */
async function processDeposits() {
  try {
    // Find deposits stuck in waiting_step1 or waiting_step2
    const pendingDeposits = await db
      .select()
      .from(deposits)
      .where(
        or(
          eq(deposits.status, 'waiting_step1'),
          eq(deposits.status, 'waiting_step2')
        )
      );
    
    if (pendingDeposits.length === 0) {
      return; // No pending deposits
    }
    
    console.log(`[POLLING] Found ${pendingDeposits.length} pending deposits to process`);
    
    // Track processed deposits to prevent double-processing in same cycle
    const processedIds = new Set<string>();
    
    for (const deposit of pendingDeposits) {
      // Skip if already processed in this cycle
      if (processedIds.has(deposit.id)) {
        continue;
      }
      
      try {
        if (deposit.status === 'waiting_step1') {
          await processStep1(deposit);
        } else if (deposit.status === 'waiting_step2') {
          await processStep2(deposit);
        }
        
        // Mark as processed to prevent duplicate processing
        processedIds.add(deposit.id);
      } catch (error: any) {
        console.error(`[POLLING] Error processing deposit ${deposit.id}:`, error.message);
        // Continue processing other deposits even if one fails
      }
    }
  } catch (error: any) {
    console.error('[POLLING] Error in processDeposits:', error.message);
  }
}

/**
 * Check Step 1 status and auto-trigger Step 2 if finished
 * AUTOMATED RECOVERY: For stuck deposits without exchange ID, auto-detect TRX balance
 */
async function processStep1(deposit: any) {
  if (!deposit.step1ExchangeId) {
    // AUTOMATED RECOVERY: Deposit stuck without exchange ID
    // Check if TRX already arrived at Privacy Relay Node
    try {
      const trxBalance = await getPrivacyRelayNodeBalance();
      
      // If TRX balance >= 10 TRX, auto-trigger Step 2 (assumes user sent SOL)
      if (trxBalance >= 10) {
        console.log(`[AUTO-RECOVERY] Deposit ${deposit.id} stuck! TRX balance: ${trxBalance.toFixed(2)} TRX detected.`);
        console.log(`[AUTO-RECOVERY] Auto-triggering Step 2 with ${trxBalance.toFixed(2)} TRX...`);
        
        // Get Liquidity Router Node
        const solanaWallet = await storage.getSystemWallet("liquidity_router_node");
        if (!solanaWallet) {
          console.error('[AUTO-RECOVERY] System wallet not initialized');
          return;
        }
        
        // Create Step 2: TRX → SOL
        const step2Exchange = await createDepositStep2Exchange(
          trxBalance.toString(),
          solanaWallet.address
        );
        
        console.log(`[AUTO-RECOVERY] Step 2 exchange response:`, JSON.stringify(step2Exchange));
        
        if (!step2Exchange || !step2Exchange.publicId) {
          console.error(`[AUTO-RECOVERY] Failed to create Step 2 - invalid response:`, step2Exchange);
          return;
        }
        
        // Send TRX from Privacy Relay Node to Step 2 exchange address
        console.log(`[AUTO-RECOVERY] Sending ${trxBalance.toFixed(4)} TRX to Step 2 exchange address: ${step2Exchange.addressFrom}`);
        
        try {
          const txId = await sendTronFromPrivacyRelayNode(
            step2Exchange.addressFrom,
            trxBalance
          );
          
          console.log(`[AUTO-RECOVERY] ✅ TRX sent successfully! TX: ${txId}`);
          
          // Update deposit: Skip Step 1, go to Step 2 (ONLY if TRX send succeeded)
          await db.update(deposits)
            .set({
              trxAmount: trxBalance.toString(),
              step2ExchangeId: step2Exchange.publicId,
              status: 'waiting_step2',
              step1CompletedAt: new Date(),
            })
            .where(eq(deposits.id, deposit.id));
          
          console.log(`[AUTO-RECOVERY] ✅ Deposit ${deposit.id} recovered! Step 2: ${step2Exchange.publicId}`);
        } catch (error: any) {
          console.error(`[AUTO-RECOVERY] Failed to send TRX:`, error.message);
          console.error(`[AUTO-RECOVERY] Deposit ${deposit.id} remains in waiting_step1 - will retry next cycle`);
          // Don't update status - keep deposit in waiting_step1 for retry
          return;
        }
      } else {
        console.log(`[POLLING] Deposit ${deposit.id} has no Step 1 exchange ID & insufficient TRX (${trxBalance.toFixed(2)} TRX), waiting...`);
      }
    } catch (error: any) {
      console.error(`[AUTO-RECOVERY] Failed to check TRX balance:`, error.message);
    }
    return;
  }
  
  try {
    // Check Step 1 status via SimpleSwap API
    const step1Exchange = await getExchangeStatus(deposit.step1ExchangeId);
    
    if (step1Exchange.status === 'finished') {
      console.log(`[POLLING] ✅ Step 1 finished for deposit ${deposit.id}, auto-triggering Step 2...`);
      
      const trxReceived = step1Exchange.amountTo || "0";
      if (parseFloat(trxReceived) <= 0) {
        console.error(`[POLLING] Invalid TRX amount for deposit ${deposit.id}: ${trxReceived}`);
        return;
      }
      
      // Get Liquidity Router Node (Solana pool wallet)
      const solanaWallet = await storage.getSystemWallet("liquidity_router_node");
      if (!solanaWallet) {
        console.error('[POLLING] System wallet not initialized');
        return;
      }
      
      // Create Step 2 exchange: TRX → SOL to Liquidity Router Node
      const step2Exchange = await createDepositStep2Exchange(
        trxReceived,
        solanaWallet.address
      );
      
      console.log(`[POLLING] Step 2 exchange created: ${step2Exchange.publicId}`);
      console.log(`[POLLING] Sending ${trxReceived} TRX to Step 2 address: ${step2Exchange.addressFrom}`);
      
      // CRITICAL: Send TRX from Privacy Relay Node to Step 2 exchange address
      try {
        const txId = await sendTronFromPrivacyRelayNode(
          step2Exchange.addressFrom,
          parseFloat(trxReceived)
        );
        
        console.log(`[POLLING] ✅ TRX sent successfully! TX: ${txId}`);
        
        // Update deposit status to waiting_step2 (ONLY after successful TRX send)
        await db.update(deposits)
          .set({
            trxAmount: trxReceived,
            step2ExchangeId: step2Exchange.publicId,
            status: 'waiting_step2',
            // Don't set step1CompletedAt yet - save it for step2 completion
          })
          .where(eq(deposits.id, deposit.id));
        
        console.log(`[POLLING] ✅ Step 2 initiated for deposit ${deposit.id}: ${step2Exchange.publicId}`);
        
        // Edit Telegram message to show Step 1→Step 2 transition
        if (deposit.telegramChatId && deposit.telegramMessageId) {
          const updatedDeposit = { ...deposit, status: 'waiting_step2' };
          const statusMessage = await getDepositStatusMessage(updatedDeposit);
          await updateTelegramMessage(
            deposit.telegramChatId,
            deposit.telegramMessageId,
            statusMessage,
            `refresh_deposit_${deposit.id}`
          );
          console.log(`[TELEGRAM] ✅ Message updated for deposit ${deposit.id} (Step 1→Step 2)`);
        }
      } catch (error: any) {
        console.error(`[POLLING] Failed to send TRX to Step 2:`, error.message);
        console.error(`[POLLING] Deposit ${deposit.id} remains in waiting_step1 - will retry next cycle`);
        // Don't update status - keep deposit in waiting_step1 for retry
        return;
      }
      
    } else if (step1Exchange.status === 'failed' || step1Exchange.status === 'refunded' || step1Exchange.status === 'expired') {
      console.log(`[POLLING] ❌ Step 1 ${step1Exchange.status} for deposit ${deposit.id}`);
      
      // Update deposit to failed status
      await db.update(deposits)
        .set({
          status: 'failed',
        })
        .where(eq(deposits.id, deposit.id));
      
      // Update transaction to failed (using depositId foreign key)
      await db.execute(sql`
        UPDATE ${transactions}
        SET status = 'failed'
        WHERE deposit_id = ${deposit.id}
          AND status = 'pending'
      `);
      
      // Edit Telegram message to show failed state
      if (deposit.telegramChatId && deposit.telegramMessageId) {
        const updatedDeposit = { ...deposit, status: 'failed' };
        const statusMessage = await getDepositStatusMessage(updatedDeposit);
        await updateTelegramMessage(
          deposit.telegramChatId,
          deposit.telegramMessageId,
          statusMessage
          // No refresh button on failed status
        );
        console.log(`[TELEGRAM] ✅ Message updated for deposit ${deposit.id} (FAILED)`);
      }
    }
    // Otherwise still waiting (confirming, exchanging, sending, etc)
    
  } catch (error: any) {
    console.error(`[POLLING] Error checking Step 1 for deposit ${deposit.id}:`, error.message);
  }
}

/**
 * Check Step 2 status and credit balance if finished
 */
async function processStep2(deposit: any) {
  if (!deposit.step2ExchangeId) {
    console.log(`[POLLING] Deposit ${deposit.id} has no Step 2 exchange ID, skipping`);
    return;
  }
  
  try {
    // Check Step 2 status via SimpleSwap API
    const step2Exchange = await getExchangeStatus(deposit.step2ExchangeId);
    
    if (step2Exchange.status === 'finished') {
      console.log(`[POLLING] ✅ Step 2 finished for deposit ${deposit.id}, crediting balance...`);
      
      const solReceived = step2Exchange.amountTo || "0";
      if (parseFloat(solReceived) <= 0) {
        console.error(`[POLLING] Invalid SOL amount for deposit ${deposit.id}: ${solReceived}`);
        return;
      }
      
      // Use transaction to ensure atomicity (prevent double-credit race condition)
      await db.transaction(async (tx) => {
        // 1. Update deposit status with optimistic locking (only if still waiting_step2)
        const [updatedDeposit] = await tx.update(deposits)
          .set({
            solReceived,
            status: 'finished',
            step1CompletedAt: new Date(), // Mark step 1 as complete when deposit finishes
            step2CompletedAt: new Date(),
          })
          .where(and(
            eq(deposits.id, deposit.id),
            eq(deposits.status, 'waiting_step2')
          ))
          .returning();
        
        // If no rows updated, another polling job already processed this
        if (!updatedDeposit) {
          console.log(`[POLLING] ⏭️  Deposit ${deposit.id} already processed by concurrent job`);
          return; // Exit transaction - idempotent!
        }
        
        // 2. Credit balance (platform absorbs fees - user gets original deposit amount)
        const creditAmount = deposit.solAmount || solReceived;
        if (!creditAmount || parseFloat(creditAmount) <= 0) {
          console.error(`[POLLING] Invalid credit amount for deposit ${deposit.id}: ${creditAmount}`);
          throw new Error(`Invalid credit amount: ${creditAmount}`);
        }
        
        await tx.execute(sql`
          UPDATE ${balances}
          SET 
            sol_balance = sol_balance + ${creditAmount}::decimal,
            updated_at = NOW()
          WHERE wallet_id = ${deposit.walletId}
        `);
        
        // 3. Update transaction status from pending → completed (using depositId foreign key)
        await tx.execute(sql`
          UPDATE ${transactions}
          SET status = 'completed'
          WHERE deposit_id = ${deposit.id}
            AND status = 'pending'
        `);
        
        console.log(`[POLLING] ✅ Deposit complete: ${creditAmount} SOL credited to wallet ${deposit.walletId} (received ${solReceived} SOL from bridge, platform absorbed fees)`);
      });
      
      // Edit Telegram message to show completion
      if (deposit.telegramChatId && deposit.telegramMessageId) {
        const updatedDeposit = { ...deposit, status: 'finished', solReceived };
        const statusMessage = await getDepositStatusMessage(updatedDeposit);
        await updateTelegramMessage(
          deposit.telegramChatId,
          deposit.telegramMessageId,
          statusMessage
          // No refresh button on finished status
        );
        console.log(`[TELEGRAM] ✅ Message updated for deposit ${deposit.id} (FINISHED)`);
      }
      
    } else if (step2Exchange.status === 'failed' || step2Exchange.status === 'refunded' || step2Exchange.status === 'expired') {
      console.log(`[POLLING] ❌ Step 2 ${step2Exchange.status} for deposit ${deposit.id}`);
      
      // Update deposit to failed status
      await db.update(deposits)
        .set({
          status: 'failed',
        })
        .where(eq(deposits.id, deposit.id));
      
      // Update transaction to failed (using depositId foreign key)
      await db.execute(sql`
        UPDATE ${transactions}
        SET status = 'failed'
        WHERE deposit_id = ${deposit.id}
          AND status = 'pending'
      `);
      
      // Edit Telegram message to show failed state
      if (deposit.telegramChatId && deposit.telegramMessageId) {
        const updatedDeposit = { ...deposit, status: 'failed' };
        const statusMessage = await getDepositStatusMessage(updatedDeposit);
        await updateTelegramMessage(
          deposit.telegramChatId,
          deposit.telegramMessageId,
          statusMessage
          // No refresh button on failed status
        );
        console.log(`[TELEGRAM] ✅ Message updated for deposit ${deposit.id} (FAILED - Step 2)`);
      }
    }
    // Otherwise still waiting
    
  } catch (error: any) {
    console.error(`[POLLING] Error checking Step 2 for deposit ${deposit.id}:`, error.message);
  }
}

/**
 * Process pending withdrawals:
 * - waiting_step1 → Check if Step 1 finished → Auto-trigger Step 2
 * - waiting_step2 → Check if Step 2 finished → Mark complete
 */
async function processWithdrawals() {
  try {
    // Find withdrawals stuck in waiting_step1 or waiting_step2
    const pendingWithdrawals = await db
      .select()
      .from(withdrawals)
      .where(
        or(
          eq(withdrawals.status, 'waiting_step1'),
          eq(withdrawals.status, 'waiting_step2')
        )
      );
    
    if (pendingWithdrawals.length === 0) {
      return; // No pending withdrawals
    }
    
    console.log(`[POLLING] Found ${pendingWithdrawals.length} pending withdrawals to process`);
    
    for (const withdrawal of pendingWithdrawals) {
      try {
        if (withdrawal.status === 'waiting_step1') {
          await processWithdrawalStep1(withdrawal);
        } else if (withdrawal.status === 'waiting_step2') {
          await processWithdrawalStep2(withdrawal);
        }
      } catch (error: any) {
        console.error(`[POLLING] Error processing withdrawal ${withdrawal.id}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('[POLLING] Error in processWithdrawals:', error.message);
  }
}

/**
 * Check withdrawal Step 1 status and auto-trigger Step 2 if finished
 */
async function processWithdrawalStep1(withdrawal: any) {
  if (!withdrawal.step1ExchangeId) {
    console.log(`[POLLING] Withdrawal ${withdrawal.id} has no Step 1 exchange ID, skipping`);
    return;
  }
  
  try {
    const step1Exchange = await getExchangeStatus(withdrawal.step1ExchangeId);
    console.log(`[POLLING] Withdrawal ${withdrawal.id} Step 1 status: ${step1Exchange.status}`);
    
    // AUTO-RETRY: If exchange waiting for SOL payment, retry sending SOL
    // Idempotency: Only send if step1TxId is null/empty (SOL never sent) AND exchange.txFrom is null (SimpleSwap hasn't received)
    const exchange: any = step1Exchange;
    
    // CRITICAL: Detect and release stuck PROCESSING locks (e.g., from process crashes)
    // If lock held for > 2 minutes, assume process crashed and reset for retry
    if (withdrawal.step1TxId === 'PROCESSING') {
      const lockAge = Date.now() - new Date(withdrawal.updatedAt).getTime();
      if (lockAge > 120000) { // 2 minutes timeout
        console.log(`[POLLING] ⚠️  Releasing stuck PROCESSING lock for withdrawal ${withdrawal.id} (held for ${Math.round(lockAge/1000)}s)`);
        
        // Compare-and-swap: Only reset if still PROCESSING (avoid racing with live sender)
        const resetResult = await db.update(withdrawals)
          .set({ step1TxId: null, updatedAt: new Date() })
          .where(and(
            eq(withdrawals.id, withdrawal.id),
            eq(withdrawals.step1TxId, 'PROCESSING')
          ))
          .returning();
        
        if (resetResult.length === 0) {
          console.log(`[POLLING] Lock was already released by another process - skipping`);
          return;
        }
        
        console.log(`[POLLING] Stuck lock released successfully - will retry send below`);
        // Fall through to retry send below
      } else {
        console.log(`[POLLING] Withdrawal ${withdrawal.id} is being processed by another request (lock age: ${Math.round(lockAge/1000)}s) - skipping`);
        return; // Still actively processing, skip this cycle
      }
    }
    
    const isNotProcessing = !withdrawal.step1TxId || withdrawal.step1TxId === '';
    if (step1Exchange.status === 'waiting' && isNotProcessing && !exchange.txFrom) {
      console.log(`[POLLING] ⚠️  Withdrawal ${withdrawal.id} Step 1 waiting for SOL payment - auto-retrying send...`);
      
      try {
        // CRITICAL ATOMIC LOCK: Acquire lock BEFORE sending to prevent duplicate sends
        // This prevents race conditions where multiple polling cycles try to send simultaneously
        // MUST update updatedAt atomically for stuck lock detection
        const lockResult = await db.update(withdrawals)
          .set({ step1TxId: 'PROCESSING', updatedAt: new Date() })
          .where(and(
            eq(withdrawals.id, withdrawal.id),
            or(
              isNull(withdrawals.step1TxId),
              eq(withdrawals.step1TxId, '')
            )
          ))
          .returning();
        
        if (lockResult.length === 0) {
          console.log(`[POLLING] Another process is already sending SOL for withdrawal ${withdrawal.id} - skipping`);
          return; // Already being processed
        }
        
        console.log(`[POLLING] 🔒 Atomic lock acquired - sending SOL now`);
        
        const solAmount = parseFloat(withdrawal.solDeducted || "0");
        if (solAmount <= 0) {
          console.error(`[POLLING] Invalid SOL amount for withdrawal ${withdrawal.id}: ${solAmount}`);
          
          // Release lock on validation failure
          // MUST update updatedAt to prevent timeout mis-classification
          await db.update(withdrawals)
            .set({ step1TxId: null, updatedAt: new Date() })
            .where(eq(withdrawals.id, withdrawal.id));
          return;
        }
        
        const depositAddress = exchange.address_from || exchange.addressFrom;
        console.log(`[POLLING] Sending ${solAmount.toFixed(9)} SOL to Step 1 exchange address: ${depositAddress}`);
        
        const txId = await sendSolFromLiquidityRouterNode(
          depositAddress,
          solAmount
        );
        
        console.log(`[POLLING] ✅ SOL sent successfully! TX: ${txId}`);
        
        // Update withdrawal with real TX ID
        await db.update(withdrawals)
          .set({ step1TxId: txId })
          .where(eq(withdrawals.id, withdrawal.id));
        
        console.log(`[POLLING] Withdrawal ${withdrawal.id} Step 1 will advance once SimpleSwap confirms receipt`);
      } catch (error: any) {
        console.error(`[POLLING] Failed to send SOL for withdrawal ${withdrawal.id}:`, error.message);
        
        // CRITICAL: Release lock on failure so next polling cycle can retry
        // MUST update updatedAt to prevent timeout mis-classification
        await db.update(withdrawals)
          .set({ step1TxId: null, updatedAt: new Date() })
          .where(eq(withdrawals.id, withdrawal.id));
        
        console.error(`[POLLING] Will retry next polling cycle (15 seconds)`);
      }
      
      return; // Exit early - wait for next cycle to check if SOL was received
    }
    
    if (step1Exchange.status === 'finished' && !withdrawal.step2ExchangeId) {
      console.log(`[POLLING] ✅ Withdrawal Step 1 finished for ${withdrawal.id}, auto-triggering Step 2...`);
      
      const trxReceived = step1Exchange.amountTo || "0";
      if (parseFloat(trxReceived) <= 0) {
        console.error(`[POLLING] Invalid TRX amount for withdrawal ${withdrawal.id}: ${trxReceived}`);
        return;
      }
      
      // Import withdrawal Step 2 exchange creation from bridge-protocol.ts
      const { createWithdrawStep2Exchange } = await import('./bridge-protocol.js');
      const step2Exchange = await createWithdrawStep2Exchange(
        trxReceived,
        withdrawal.destinationAddress
      );
      
      console.log(`[POLLING] Step 2 exchange created: ${step2Exchange.publicId}`);
      console.log(`[POLLING] Sending ${trxReceived} TRX to Step 2 address: ${step2Exchange.addressFrom}`);
      
      // CRITICAL: Send TRX from Privacy Relay Node to Step 2 exchange address
      // (Same logic as deposit flow line 189-214)
      try {
        const txId = await sendTronFromPrivacyRelayNode(
          step2Exchange.addressFrom,
          parseFloat(trxReceived)
        );
        
        console.log(`[POLLING] ✅ TRX sent successfully! TX: ${txId}`);
        
        // Calculate expected SOL to be sent (from Step 2 exchange)
        const solExpected = step2Exchange.amountTo || "0";
        
        // Update withdrawal status to waiting_step2 (ONLY after successful TRX send)
        await db.update(withdrawals)
          .set({
            trxAmount: trxReceived,
            solSent: solExpected,
            step2ExchangeId: step2Exchange.publicId,
            status: 'waiting_step2',
            step1CompletedAt: new Date(),
          })
          .where(eq(withdrawals.id, withdrawal.id));
        
        console.log(`[POLLING] ✅ Withdrawal Step 2 initiated: ${step2Exchange.publicId}, expecting ${solExpected} SOL`);
        
        // Edit Telegram message to show Step 1→Step 2 transition
        if (withdrawal.telegramChatId && withdrawal.telegramMessageId) {
          const updatedWithdrawal = { ...withdrawal, status: 'waiting_step2' };
          const statusMessage = await getWithdrawalStatusMessage(updatedWithdrawal);
          await updateTelegramMessage(
            withdrawal.telegramChatId,
            withdrawal.telegramMessageId,
            statusMessage,
            `refresh_withdraw_${withdrawal.id}`
          );
          console.log(`[TELEGRAM] ✅ Message updated for withdrawal ${withdrawal.id} (Step 1→Step 2)`);
        }
      } catch (error: any) {
        console.error(`[POLLING] Failed to send TRX to Step 2:`, error.message);
        
        // CRITICAL: Save step2ExchangeId even on TRX send failure to prevent duplicate exchange creation
        // This ensures idempotency - next polling cycle will skip Step 2 creation and retry TRX send
        await db.update(withdrawals)
          .set({ step2ExchangeId: step2Exchange.publicId })
          .where(eq(withdrawals.id, withdrawal.id));
        
        console.error(`[POLLING] Withdrawal ${withdrawal.id} remains in waiting_step1 - will retry TRX send next cycle`);
        // Don't update status - keep withdrawal in waiting_step1 for retry
        return;
      }
      
    } else if (step1Exchange.status === 'failed' || step1Exchange.status === 'refunded' || step1Exchange.status === 'expired') {
      console.log(`[POLLING] ❌ Withdrawal Step 1 ${step1Exchange.status} for ${withdrawal.id}`);
      
      // Idempotency guard: Only refund if withdrawal is still in waiting_step1 status
      const [updated] = await db.update(withdrawals)
        .set({ status: 'failed' })
        .where(and(
          eq(withdrawals.id, withdrawal.id),
          eq(withdrawals.status, 'waiting_step1')
        ))
        .returning();
      
      if (!updated) {
        console.log(`[POLLING] ⏭️  Withdrawal ${withdrawal.id} already failed, skipping refund`);
        return;
      }
      
      // Refund balance to user (only executes if status was successfully updated)
      await db.execute(sql`
        UPDATE ${balances}
        SET sol_balance = sol_balance + ${withdrawal.solDeducted}::decimal, updated_at = NOW()
        WHERE wallet_id = ${withdrawal.walletId}
      `);
      
      // Update transaction to failed (using CTE for PostgreSQL with precision handling)
      await db.execute(sql`
        WITH target AS (
          SELECT id FROM ${transactions}
          WHERE wallet_id = ${withdrawal.walletId}
            AND type = 'withdraw'
            AND status = 'pending'
            AND ROUND(amount::numeric, 6) = ROUND(${withdrawal.solDeducted}::numeric, 6)
          ORDER BY timestamp DESC
          LIMIT 1
        )
        UPDATE ${transactions}
        SET status = 'failed'
        WHERE id IN (SELECT id FROM target)
      `);
      
      // Edit Telegram message to show failed state
      if (withdrawal.telegramChatId && withdrawal.telegramMessageId) {
        const updatedWithdrawal = { ...withdrawal, status: 'failed' };
        const statusMessage = await getWithdrawalStatusMessage(updatedWithdrawal);
        await updateTelegramMessage(
          withdrawal.telegramChatId,
          withdrawal.telegramMessageId,
          statusMessage
          // No refresh button on failed status
        );
        console.log(`[TELEGRAM] ✅ Message updated for withdrawal ${withdrawal.id} (FAILED - Step 1)`);
      }
    }
    
  } catch (error: any) {
    console.error(`[POLLING] Error checking withdrawal Step 1 for ${withdrawal.id}:`, error.message);
  }
}

/**
 * Check withdrawal Step 2 status and mark complete if finished
 */
async function processWithdrawalStep2(withdrawal: any) {
  if (!withdrawal.step2ExchangeId) {
    console.log(`[POLLING] Withdrawal ${withdrawal.id} has no Step 2 exchange ID, skipping`);
    return;
  }
  
  try {
    const step2Exchange = await getExchangeStatus(withdrawal.step2ExchangeId);
    console.log(`[POLLING] Withdrawal ${withdrawal.id} Step 2 status: ${step2Exchange.status}`);
    
    if (step2Exchange.status === 'finished') {
      console.log(`[POLLING] ✅ Withdrawal Step 2 finished for ${withdrawal.id}, marking complete...`);
      
      // Capture actual SOL sent and transaction hash from exchange response
      const actualSolSent = step2Exchange.amountTo || withdrawal.solSent || withdrawal.solDeducted;
      const txHash = step2Exchange.txTo; // Solana transaction hash from SimpleSwap
      
      if (txHash) {
        console.log(`[POLLING] Transaction hash captured: ${txHash}`);
      } else {
        console.warn(`[POLLING] WARNING: No transaction hash (txTo) in SimpleSwap response for withdrawal ${withdrawal.id}`);
      }
      
      await db.transaction(async (tx) => {
        const [updated] = await tx.update(withdrawals)
          .set({
            solSent: actualSolSent,
            step2TxTo: txHash,
            status: 'finished',
            step2CompletedAt: new Date(),
          })
          .where(and(
            eq(withdrawals.id, withdrawal.id),
            eq(withdrawals.status, 'waiting_step2')
          ))
          .returning();
        
        if (!updated) {
          console.log(`[POLLING] ⏭️  Withdrawal ${withdrawal.id} already processed`);
          return;
        }
        
        // Update transaction to completed (using CTE for PostgreSQL with precision handling)
        await tx.execute(sql`
          WITH target AS (
            SELECT id FROM ${transactions}
            WHERE wallet_id = ${withdrawal.walletId}
              AND type = 'withdraw'
              AND status = 'pending'
              AND ROUND(amount::numeric, 6) = ROUND(${withdrawal.solDeducted}::numeric, 6)
            ORDER BY timestamp DESC
            LIMIT 1
          )
          UPDATE ${transactions}
          SET status = 'completed'
          WHERE id IN (SELECT id FROM target)
        `);
        
        console.log(`[POLLING] ✅ Withdrawal complete: ${actualSolSent} SOL sent to ${withdrawal.destinationAddress}`);
      });
      
      // Edit Telegram message to show completion
      if (withdrawal.telegramChatId && withdrawal.telegramMessageId) {
        const updatedWithdrawal = { ...withdrawal, status: 'finished', solSent: actualSolSent };
        const statusMessage = await getWithdrawalStatusMessage(updatedWithdrawal);
        await updateTelegramMessage(
          withdrawal.telegramChatId,
          withdrawal.telegramMessageId,
          statusMessage
          // No refresh button on finished status
        );
        console.log(`[TELEGRAM] ✅ Message updated for withdrawal ${withdrawal.id} (FINISHED)`);
      }
      
    } else if (step2Exchange.status === 'failed' || step2Exchange.status === 'refunded' || step2Exchange.status === 'expired') {
      console.log(`[POLLING] ❌ Withdrawal Step 2 ${step2Exchange.status} for ${withdrawal.id}`);
      
      // Idempotency guard: Only refund if withdrawal is still in waiting_step2 status
      const [updated] = await db.update(withdrawals)
        .set({ status: 'failed' })
        .where(and(
          eq(withdrawals.id, withdrawal.id),
          eq(withdrawals.status, 'waiting_step2')
        ))
        .returning();
      
      if (!updated) {
        console.log(`[POLLING] ⏭️  Withdrawal ${withdrawal.id} already failed, skipping refund`);
        return;
      }
      
      // Refund balance to user (only executes if status was successfully updated)
      await db.execute(sql`
        UPDATE ${balances}
        SET sol_balance = sol_balance + ${withdrawal.solDeducted}::decimal, updated_at = NOW()
        WHERE wallet_id = ${withdrawal.walletId}
      `);
      
      // Update transaction to failed (using CTE for PostgreSQL with precision handling)
      await db.execute(sql`
        WITH target AS (
          SELECT id FROM ${transactions}
          WHERE wallet_id = ${withdrawal.walletId}
            AND type = 'withdraw'
            AND status = 'pending'
            AND ROUND(amount::numeric, 6) = ROUND(${withdrawal.solDeducted}::numeric, 6)
          ORDER BY timestamp DESC
          LIMIT 1
        )
        UPDATE ${transactions}
        SET status = 'failed'
        WHERE id IN (SELECT id FROM target)
      `);
      
      // Edit Telegram message to show failed state
      if (withdrawal.telegramChatId && withdrawal.telegramMessageId) {
        const updatedWithdrawal = { ...withdrawal, status: 'failed' };
        const statusMessage = await getWithdrawalStatusMessage(updatedWithdrawal);
        await updateTelegramMessage(
          withdrawal.telegramChatId,
          withdrawal.telegramMessageId,
          statusMessage
          // No refresh button on failed status
        );
        console.log(`[TELEGRAM] ✅ Message updated for withdrawal ${withdrawal.id} (FAILED - Step 2)`);
      }
    }
    
  } catch (error: any) {
    console.error(`[POLLING] Error checking withdrawal Step 2 for ${withdrawal.id}:`, error.message);
  }
}

/**
 * Refresh active monitor sessions with latest prices
 * Runs every 20 seconds to update monitor messages
 */
async function refreshMonitorSessions() {
  if (!bot) return; // Bot not configured
  
  try {
    // Get all active monitor sessions
    const activeSessions = await db.select()
      .from(monitorSessions)
      .where(eq(monitorSessions.isActive, true));
    
    if (activeSessions.length === 0) {
      return; // No active sessions
    }
    
    console.log(`[MONITOR] Refreshing ${activeSessions.length} active monitor sessions`);
    
    for (const session of activeSessions) {
      try {
        // Get current token index
        const currentIndex = parseInt(session.currentTokenIndex);
        
        // Get token holdings for this wallet (filter out zero-balance)
        const allHoldings = await db.select()
          .from(tokenHoldings)
          .where(eq(tokenHoldings.walletId, session.walletId));
        
        const holdings = allHoldings.filter(h => parseFloat(h.amount) > 0);
        
        // Build updated message (handle both empty and non-empty holdings)
        let message: string;
        let keyboard: any;
        
        try {
          if (holdings.length === 0) {
            // No tokens - show "All tokens sold" message with simple keyboard
            message = await buildMonitorMessageForPolling(session.walletId, 0, session.tradeMode as 'buy' | 'sell', holdings);
            keyboard = buildEmptyMonitorKeyboard();
            
            // Reset index to 0 for when user buys new tokens
            if (currentIndex !== 0) {
              await db.update(monitorSessions)
                .set({ 
                  currentTokenIndex: "0",
                  updatedAt: new Date()
                })
                .where(eq(monitorSessions.id, session.id));
            }
            
            console.log(`[MONITOR] Session ${session.id} showing "All tokens sold" state`);
          } else {
            // CRITICAL: Clamp index to valid range BEFORE building messages
            // This prevents crashes when holdings shrink (e.g., token just sold)
            const tokenIndex = currentIndex >= holdings.length ? 0 : currentIndex;
            
            // CRITICAL: Always persist the clamped index to prevent repeated overruns
            if (tokenIndex !== currentIndex) {
              await db.update(monitorSessions)
                .set({ 
                  currentTokenIndex: tokenIndex.toString(),
                  updatedAt: new Date()
                })
                .where(eq(monitorSessions.id, session.id));
            }
            
            message = await buildMonitorMessageForPolling(session.walletId, tokenIndex, session.tradeMode as 'buy' | 'sell', holdings);
            keyboard = buildMonitorKeyboardForPolling(tokenIndex, holdings.length, session.tradeMode as 'buy' | 'sell', holdings[tokenIndex].mint);
          }
        } catch (buildError: any) {
          // Price fetch or other build error - skip this cycle (session stays active)
          console.error(`[MONITOR] Error building message for session ${session.id}, skipping this cycle:`, buildError.message);
          continue;
        }
        
        // Update message
        await bot.api.editMessageText(
          session.chatId,
          parseInt(session.messageId),
          message,
          {
            parse_mode: "Markdown",
            reply_markup: keyboard
          }
        );
        
      } catch (sessionError: any) {
        // ONLY deactivate if message was actually deleted, NOT if just "not modified"
        if (sessionError?.description?.includes("message to edit not found")) {
          // Message was deleted - deactivate session
          await db.update(monitorSessions)
            .set({ isActive: false })
            .where(eq(monitorSessions.id, session.id));
          
          console.log(`[MONITOR] Deactivated session ${session.id} (message deleted)`);
        } else if (!sessionError?.description?.includes("message is not modified")) {
          // Log other errors (skip "message is not modified" - it's harmless)
          console.error(`[MONITOR] Error refreshing session ${session.id}:`, sessionError.message || sessionError);
        }
        // "message is not modified" is OK - just skip this refresh cycle
      }
    }
  } catch (error: any) {
    console.error(`[MONITOR] Error in refresh loop:`, error.message);
  }
}

async function buildMonitorMessageForPolling(walletId: string, tokenIndex: number, tradeMode: 'buy' | 'sell', holdings: any[]): Promise<string> {
  // Get SOL balance
  const balanceRecord = await db.select()
    .from(balances)
    .where(eq(balances.walletId, walletId))
    .limit(1);
  
  const solBalance = balanceRecord.length > 0 ? parseFloat(balanceRecord[0].solBalance) : 0;
  const solPrice = await getSolanaPrice();
  
  // CRITICAL: Return early if no holdings to prevent undefined access
  if (holdings.length === 0) {
    return (
      `📊 *LIVE MONITOR*\n\n` +
      `🎉 *All Tokens Sold!*\n\n` +
      `You only have SOL in your portfolio.\n\n` +
      `💰 *SOL Balance:* ${solBalance.toFixed(4)} ($${(solBalance * solPrice).toFixed(2)})\n\n` +
      `Paste a token contract address to start trading!\n\n` +
      `Use /stopmonitor to stop monitoring.`
    );
  }
  
  // Clamp index to valid range
  if (tokenIndex >= holdings.length) {
    tokenIndex = 0;
  }

  const holding = holdings[tokenIndex];
  const amount = parseFloat(holding.amount);
  const pendingAmount = parseFloat(holding.pendingInAmount || "0");
  const totalAmount = amount + pendingAmount;
  const entryPrice = parseFloat(holding.averageEntryPrice || "0");
  const currentPrice = parseFloat(holding.lastPriceUsd || "0") || entryPrice;
  const costBasis = parseFloat(holding.totalCostBasis || "0");
  const currentValue = amount * currentPrice;
  const pnl = currentValue - costBasis;
  const pnlPercent = costBasis > 0 ? ((pnl / costBasis) * 100) : 0;
  
  const pnlEmoji = pnl >= 0 ? "🟢" : "🔴";
  const pnlDisplay = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
  const pnlPercentDisplay = pnlPercent >= 0 ? `+${pnlPercent.toFixed(2)}%` : `${pnlPercent.toFixed(2)}%`;
  
  const modeEmoji = tradeMode === 'buy' ? '🟢' : '🔴';
  const modeLabel = tradeMode === 'buy' ? 'BUY' : 'SELL';
  
  let message = `📊 *LIVE MONITOR* ${modeEmoji} ${modeLabel} MODE\n\n`;
  message += `*Token ${tokenIndex + 1}/${holdings.length}:* ${holding.symbol}\n\n`;
  
  if (pendingAmount > 0) {
    message += `📦 *Amount:* ${totalAmount.toFixed(4)} ⏳\n`;
    message += `_Confirmed: ${amount.toFixed(4)} | Pending: ${pendingAmount.toFixed(4)}_\n\n`;
  } else {
    message += `📦 *Amount:* ${totalAmount.toFixed(4)}\n\n`;
  }
  
  message += `📈 *Entry Price:* $${entryPrice.toFixed(6)}\n`;
  message += `💎 *Current Price:* $${currentPrice.toFixed(6)}\n`;
  message += `${pnlEmoji} *PNL:* ${pnlDisplay} (${pnlPercentDisplay})\n\n`;
  message += `💰 *SOL Balance:* ${solBalance.toFixed(4)} ($${(solBalance * solPrice).toFixed(2)})\n\n`;
  message += `_Auto-refreshing every 20s..._\n`;
  message += `Use /stopmonitor to stop`;
  
  return message;
}

function buildMonitorKeyboardForPolling(currentIndex: number, totalTokens: number, tradeMode: 'buy' | 'sell', tokenMint: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // Navigation row (always present) - Simple callback data without extra params
  keyboard
    .text("◀️ Prev", "monitor_prev")
    .text("▶️ Next", "monitor_next");
  keyboard.row();
  
  if (tradeMode === 'buy') {
    // BUY Mode: SOL amount buttons
    keyboard
      .text("0.1 SOL", `monitor_buy_${tokenMint}_0.1`)
      .text("0.25 SOL", `monitor_buy_${tokenMint}_0.25`)
      .text("0.5 SOL", `monitor_buy_${tokenMint}_0.5`);
    keyboard.row();
    
    keyboard
      .text("1 SOL", `monitor_buy_${tokenMint}_1`)
      .text("2 SOL", `monitor_buy_${tokenMint}_2`)
      .text("5 SOL", `monitor_buy_${tokenMint}_5`);
    keyboard.row();
    
    keyboard
      .text("📝 Custom SOL", `monitor_custom_buy_${tokenMint}`)
      .text("🔴 Sell Mode", `monitor_toggle_sell_${tokenMint}`);
  } else {
    // SELL Mode: Percentage buttons
    keyboard
      .text("25%", `monitor_sell_${tokenMint}_25`)
      .text("50%", `monitor_sell_${tokenMint}_50`)
      .text("75%", `monitor_sell_${tokenMint}_75`)
      .text("100%", `monitor_sell_${tokenMint}_100`);
    keyboard.row();
    
    keyboard.text("🟢 Buy Mode", `monitor_toggle_buy_${tokenMint}`);
  }
  
  return keyboard;
}

function buildEmptyMonitorKeyboard(): InlineKeyboard {
  // Simple keyboard for empty holdings state - just instructs user
  const keyboard = new InlineKeyboard();
  // No interactive buttons - user should paste token address or use /stopmonitor
  return keyboard;
}
