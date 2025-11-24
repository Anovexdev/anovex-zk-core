import { Context, InlineKeyboard } from "grammy";
import { getWallet, setConversationState } from "../../telegram-bot.js";
import { db } from "../../db";
import { withdrawals, balances, transactions, wallets } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { storage } from "../../storage.js";
import { createWithdrawStep1Exchange } from "../../bridge-protocol.js";
import { getSolanaPrice } from "../../coingecko.js";
import { PublicKey } from "@solana/web3.js";
import { generateAnxTxHash } from "../../swap-helpers.js";
import crypto from "crypto";

export async function handleWithdraw(ctx: Context, withdrawalId?: string) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    const wallet = await getWallet(telegramUserId);
    
    if (!wallet) {
      await ctx.reply(
        `⚠️ *No Wallet Found*\n\n` +
        `You need to create a wallet first.\n\n` +
        `Use /start to generate or import a wallet.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    let withdrawal;
    
    if (withdrawalId) {
      // Refresh existing withdrawal
      const withdrawals_list = await db.select()
        .from(withdrawals)
        .where(and(
          eq(withdrawals.walletId, wallet.id),
          eq(withdrawals.id, withdrawalId)
        ))
        .limit(1);
      
      if (withdrawals_list.length === 0) {
        await ctx.answerCallbackQuery("Withdrawal not found");
        return;
      }
      withdrawal = withdrawals_list[0];
    } else {
      // Get most recent withdrawal
      const recent = await db.select()
        .from(withdrawals)
        .where(eq(withdrawals.walletId, wallet.id))
        .orderBy(desc(withdrawals.createdAt))
        .limit(1);

      if (recent.length > 0 && recent[0].status !== 'finished') {
        withdrawal = recent[0];
      }
    }

    if (withdrawal) {
      // Show withdrawal status with refresh button
      const statusMessage = await getWithdrawalStatusMessage(withdrawal);
      const keyboard = new InlineKeyboard();
      
      if (withdrawal.status !== 'finished' && withdrawal.status !== 'failed') {
        keyboard.text("🔄 Refresh Status", `refresh_withdraw_${withdrawal.id}`);
      }

      if (ctx.callbackQuery) {
        try {
          await ctx.editMessageText(statusMessage, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
          
          // Capture telegram info from refresh button click for future polling edits
          if (ctx.callbackQuery.message && ctx.chat) {
            await db.update(withdrawals)
              .set({
                telegramChatId: ctx.chat.id.toString(),
                telegramMessageId: ctx.callbackQuery.message.message_id.toString(),
              })
              .where(eq(withdrawals.id, withdrawal.id));
          }
        } catch (editError: any) {
          // Ignore "message is not modified" error (happens when status hasn't changed)
          if (editError?.description?.includes("message is not modified")) {
            // Silently ignore - status is already up to date
            await ctx.answerCallbackQuery("✅ Status is up to date");
          } else {
            throw editError; // Re-throw other errors
          }
        }
      } else {
        const message = await ctx.reply(statusMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
        
        // Save telegram info for polling to edit message during step transitions
        if (message && ctx.chat) {
          await db.update(withdrawals)
            .set({
              telegramChatId: ctx.chat.id.toString(),
              telegramMessageId: message.message_id.toString(),
            })
            .where(eq(withdrawals.id, withdrawal.id));
        }
      }
    } else {
      // No pending withdrawal - ask for amount
      setConversationState(telegramUserId, 'waiting_withdraw_amount');
      
      // Get current balance
      const balance = await storage.getBalance(wallet.id);
      const solBalance = parseFloat(balance?.solBalance || "0");
      
      const message =
        `💸 *Withdraw Funds*\n\n` +
        `Your balance: ${solBalance.toFixed(4)} SOL\n\n` +
        `Please enter the amount of SOL you wish to withdraw.\n\n` +
        `*Example:* \`0.5\` or \`1.0\`\n\n` +
        `📋 *Requirements:*\n` +
        `• Minimum: 0.05 SOL\n` +
        `• Network fees absorbed by platform\n` +
        `• Complete anonymity via ZK relay network\n` +
        `• Processing time: 2-5 minutes`;

      await ctx.reply(message, { parse_mode: "Markdown" });
    }
  } catch (error) {
    console.error("Error in /withdraw:", error);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery("❌ Failed to fetch withdrawal status");
    } else {
      await ctx.reply("❌ Failed to fetch withdrawal status. Please try again.");
    }
  }
}

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
    `${getStepDescription(step)}\n\n` +
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
      console.error('[WITHDRAW] Failed to fetch ANX hash for withdrawal:', error);
    }
  }

  return message;
}

function getStepDescription(step: number): string{
  switch (step) {
    case 1:
      return "Atomic routing via ZK relay network with MEV protection";
    case 2:
      return "Stealth delivery complete - assets transferred anonymously";
    default:
      return "Executing withdrawal via shadow network...";
  }
}

// Handler for when user sends withdrawal amount
export async function handleWithdrawAmount(ctx: Context, amount: string) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount < 0.05) {
      await ctx.reply("❌ Invalid amount entered. The minimum withdrawal requirement is 0.05 SOL.\n\nPlease enter a valid amount:");
      return;
    }

    const wallet = await getWallet(telegramUserId);
    
    if (!wallet) {
      setConversationState(telegramUserId, null);
      await ctx.reply(
        `⚠️ *No Wallet Found*\n\n` +
        `You need to create a wallet first.\n\n` +
        `Use /start to generate or import a wallet.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Check balance
    const balance = await storage.getBalance(wallet.id);
    const currentSolBalance = parseFloat(balance?.solBalance || "0");
    
    // Calculate total deduction (amount + estimated fees)
    // SimpleSwap charges ~0.5% network fee, we add 1% buffer for safety
    const estimatedFees = numAmount * 0.01;
    const totalDeduction = numAmount + estimatedFees;
    
    if (currentSolBalance < totalDeduction) {
      await ctx.reply(
        `❌ *Insufficient Balance*\n\n` +
        `Your balance: ${currentSolBalance.toFixed(4)} SOL\n` +
        `Required: ${totalDeduction.toFixed(4)} SOL (includes network fees)\n\n` +
        `💡 Try withdrawing ${(currentSolBalance * 0.99).toFixed(4)} SOL or less.\n\n` +
        `Please enter a smaller amount:`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Store amount in database (persisted across bot restarts) and ask for destination address
    await db.update(wallets)
      .set({ pendingWithdrawAmount: numAmount.toString() })
      .where(eq(wallets.id, wallet.id));
    
    setConversationState(telegramUserId, 'waiting_withdraw_address');
    
    await ctx.reply(
      `✅ Amount confirmed: *${numAmount.toFixed(4)} SOL*\n\n` +
      `Please enter your destination Solana address (32-44 characters).`,
      { parse_mode: "Markdown" }
    );
  } catch (error: any) {
    console.error("Error processing withdrawal amount:", error);
    setConversationState(telegramUserId, null);
    await ctx.reply("❌ Unable to process withdrawal. Please try again with /withdraw");
  }
}

// Handler for when user sends destination address
export async function handleWithdrawAddress(ctx: Context, address: string) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    // Validate Solana address using PublicKey constructor
    try {
      new PublicKey(address);
    } catch (err) {
      await ctx.reply("❌ Invalid Solana address.\n\nPlease enter a valid Solana address:");
      return;
    }
    
    const wallet = await getWallet(telegramUserId);
    
    if (!wallet) {
      await ctx.reply(
        `⚠️ *No Wallet Found*\n\n` +
        `You need to create a wallet first.\n\n` +
        `Use /start to generate or import a wallet.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Read pending amount from database (persisted across bot restarts)
    const amount = parseFloat(wallet.pendingWithdrawAmount || "0");
    
    if (!amount || amount <= 0) {
      await ctx.reply(
        `⚠️ *No Pending Withdrawal*\n\n` +
        `Please start a new withdrawal with /withdraw`,
        { parse_mode: "Markdown" }
      );
      setConversationState(telegramUserId, null);
      return;
    }
    
    // Check for pending withdrawals
    const existingWithdrawals = await db
      .select()
      .from(withdrawals)
      .where(and(
        eq(withdrawals.walletId, wallet.id),
        sql`${withdrawals.status} IN ('waiting_step1', 'waiting_step2')`
      ));
    
    if (existingWithdrawals.length > 0) {
      await ctx.reply(
        `⚠️ *Pending Withdrawal Detected*\n\n` +
        `You already have a pending withdrawal.\n` +
        `Please wait for it to complete before creating a new one.\n\n` +
        `Use /withdraw to check status.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Get SOL price for USD display
    const solPrice = await getSolanaPrice();
    const usdAmount = amount * solPrice;
    
    // Calculate total deduction (amount + 1% fee buffer)
    const estimatedFees = amount * 0.01;
    const totalDeduction = amount + estimatedFees;
    
    // Get Privacy Relay Node
    const tronWallet = await storage.getSystemWallet("privacy_relay_node");
    if (!tronWallet) {
      throw new Error("System wallet not initialized");
    }
    
    // ATOMIC TRANSACTION: Deduct balance + create exchange + create records
    const result = await db.transaction(async (tx) => {
      // 1. Deduct total SOL (amount + fee buffer) from balance
      const updatedBalances = await tx.execute(sql`
        UPDATE ${balances}
        SET 
          sol_balance = sol_balance - ${totalDeduction.toString()}::decimal,
          updated_at = NOW()
        WHERE wallet_id = ${wallet.id}
          AND sol_balance >= ${totalDeduction.toString()}::decimal
        RETURNING *
      `);
      
      if (updatedBalances.rowCount === 0) {
        throw new Error("Insufficient balance or concurrent withdrawal detected");
      }
      
      // 2. Create Step 1 exchange: SOL → TRX to Privacy Relay Node
      const step1Exchange = await createWithdrawStep1Exchange(
        amount.toFixed(9),
        tronWallet.address
      );
      
      // 3. Create withdrawal record
      const [withdrawal] = await tx.insert(withdrawals).values({
        walletId: wallet.id,
        destinationAddress: address,
        step1ExchangeId: step1Exchange.publicId,
        step2ExchangeId: null,
        solDeducted: amount.toFixed(9),
        trxAmount: null,
        solSent: null,
        status: 'waiting_step1',
        step1TxId: null,
        step2TxTo: null,
      }).returning();
      
      // 4. Create transaction record (visible in explorer)
      await tx.insert(transactions).values({
        walletId: wallet.id,
        txhash: generateAnxTxHash('withdraw'),
        type: 'withdraw',
        instructions: 'transfer out',
        withdrawalId: withdrawal.id, // Link transaction to withdrawal
        tokenAddress: null,
        tokenSymbol: 'SOL',
        amount: amount.toFixed(9),
        priceUsd: solPrice.toFixed(2),
        status: 'pending',
      });
      
      return { withdrawal, step1Exchange };
    });
    
    // Show withdrawal confirmation
    const message =
      `✅ *Withdrawal Initiated*\n\n` +
      `Amount: *${amount.toFixed(4)} SOL* (≈ $${usdAmount.toFixed(2)})\n` +
      `Destination: \`${address.slice(0, 8)}...${address.slice(-8)}\`\n\n` +
      `⚡ *Privacy Routing Active*\n\n` +
      `Your withdrawal will be processed through:\n` +
      `1️⃣ Shadow liquidity routing\n` +
      `2️⃣ ZK relay network coordination\n` +
      `3️⃣ Stealth delivery to destination\n\n` +
      `🔒 Complete transaction privacy guaranteed\n\n` +
      `Processing time: 2-5 minutes`;

    const keyboard = new InlineKeyboard()
      .text("🔄 Check Status", `refresh_withdraw_${result.withdrawal.id}`);

    const sentMessage = await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    
    // Save telegram info for real-time polling updates
    if (sentMessage && ctx.chat) {
      await db.update(withdrawals)
        .set({
          telegramChatId: ctx.chat.id.toString(),
          telegramMessageId: sentMessage.message_id.toString(),
        })
        .where(eq(withdrawals.id, result.withdrawal.id));
    }
    
    // Clear conversation state and pending amount in database after successful withdrawal
    setConversationState(telegramUserId, null);
    await db.update(wallets)
      .set({ pendingWithdrawAmount: null })
      .where(eq(wallets.id, wallet.id));
    
  } catch (error: any) {
    console.error("Error creating withdrawal:", error);
    
    // Clear state on error
    setConversationState(telegramUserId, null);
    
    // Try to clear pending amount from database (best effort)
    try {
      const wallet = await getWallet(telegramUserId);
      if (wallet) {
        await db.update(wallets)
          .set({ pendingWithdrawAmount: null })
          .where(eq(wallets.id, wallet.id));
      }
    } catch (cleanupError) {
      console.error("Error clearing pending amount:", cleanupError);
    }
    
    if (error.message?.includes("Insufficient balance")) {
      await ctx.reply("❌ Insufficient balance. Please try again with a smaller amount.");
    } else {
      await ctx.reply("❌ Unable to initiate withdrawal. Please try again later.");
    }
  }
}
