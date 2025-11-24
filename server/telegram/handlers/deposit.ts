import { Context, InlineKeyboard } from "grammy";
import { getWallet, setConversationState } from "../../telegram-bot.js";
import { db } from "../../db";
import { deposits, systemWallets, transactions } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { createDepositStep1Exchange } from "../../bridge-protocol.js";
import { storage } from "../../storage.js";
import { getSolanaPrice } from "../../coingecko.js";
import { generateAnxTxHash } from "../../swap-helpers.js";
import crypto from "crypto";

export async function handleDeposit(ctx: Context, depositId?: string) {
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

    let deposit;
    
    if (depositId) {
      // Refresh existing deposit
      const deposits_list = await db.select()
        .from(deposits)
        .where(and(
          eq(deposits.walletId, wallet.id),
          eq(deposits.id, depositId)
        ))
        .limit(1);
      
      if (deposits_list.length === 0) {
        await ctx.answerCallbackQuery("Deposit not found");
        return;
      }
      deposit = deposits_list[0];
    } else {
      // Get most recent deposit or create new one
      const recent = await db.select()
        .from(deposits)
        .where(eq(deposits.walletId, wallet.id))
        .orderBy(desc(deposits.createdAt))
        .limit(1);

      const terminalStates = ['finished', 'failed', 'refunded', 'expired'];
      if (recent.length > 0 && !terminalStates.includes(recent[0].status)) {
        deposit = recent[0];
      } else {
        // No active deposit - ask for amount
        setConversationState(telegramUserId, 'waiting_deposit_amount');
        
        const message =
          `💰 *Deposit Funds*\n\n` +
          `Please enter the amount of SOL you wish to deposit.\n\n` +
          `*Example:* \`0.5\` or \`1.0\`\n\n` +
          `📋 *Requirements:*\n` +
          `• Minimum: 0.05 SOL\n` +
          `• All network fees covered by platform\n` +
          `• Complete anonymity via ZK relay network\n` +
          `• Processing time: 2-5 minutes`;

        await ctx.reply(message, { parse_mode: "Markdown" });
        return;
      }
    }

    // Show deposit status with refresh button
    const statusMessage = await getDepositStatusMessage(deposit);
    const keyboard = new InlineKeyboard();
    
    if (deposit.status !== 'finished' && deposit.status !== 'failed') {
      keyboard.text("🔄 Refresh Status", `refresh_deposit_${deposit.id}`);
    }

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(statusMessage, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
        
        // Capture telegram info from refresh button click for future polling edits
        if (ctx.callbackQuery.message && ctx.chat) {
          await db.update(deposits)
            .set({
              telegramChatId: ctx.chat.id.toString(),
              telegramMessageId: ctx.callbackQuery.message.message_id.toString(),
            })
            .where(eq(deposits.id, deposit.id));
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
        await db.update(deposits)
          .set({
            telegramChatId: ctx.chat.id.toString(),
            telegramMessageId: message.message_id.toString(),
          })
          .where(eq(deposits.id, deposit.id));
      }
    }
  } catch (error) {
    console.error("Error in /deposit:", error);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery("❌ Unable to retrieve deposit status");
    } else {
      await ctx.reply("❌ Unable to retrieve deposit status. Please try again later.");
    }
  }
}

// New handler for when user sends amount
export async function handleDepositAmount(ctx: Context, amount: string) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount < 0.05) {
      // Keep state active so user can retry
      await ctx.reply("❌ Invalid amount entered. The minimum deposit requirement is 0.05 SOL.\n\nPlease enter a valid amount:");
      return;
    }

    // Clear conversation state after successful validation
    setConversationState(telegramUserId, null);

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
    
    // Get SOL price for USD display
    const solPrice = await getSolanaPrice();
    const usdAmount = numAmount * solPrice;
    
    // Get Privacy Relay Node (TRON Bridge)
    const tronWallet = await storage.getSystemWallet("privacy_relay_node");
    if (!tronWallet) {
      throw new Error("System wallet not initialized");
    }
    
    // Create Step 1 exchange: SOL → TRX to Privacy Relay Node
    const step1Exchange = await createDepositStep1Exchange(
      numAmount.toString(),
      tronWallet.address
    );
    
    // Save deposit record AND transaction record (for history persistence)
    const deposit = await storage.createDeposit({
      walletId: wallet.id,
      step1DepositAddress: step1Exchange.addressFrom,
      step1ExchangeId: step1Exchange.publicId,
      solAmount: numAmount.toFixed(9),
      status: 'waiting_step1'
    });
    
    // Create transaction record immediately (visible in explorer)
    await db.insert(transactions).values({
      walletId: wallet.id,
      txhash: generateAnxTxHash('deposit'),
      type: 'deposit',
      instructions: 'transfer in',
      tokenAddress: null,
      tokenSymbol: 'SOL',
      amount: numAmount.toFixed(9),
      solValue: numAmount.toFixed(9),
      priceUsd: solPrice.toFixed(2),
      status: 'pending',
      depositId: deposit.id,
    });

    // Show deposit address and instructions
    const message =
      `✅ *Deposit Address Created*\n\n` +
      `Please send exactly *${numAmount.toFixed(4)} SOL* (≈ $${usdAmount.toFixed(2)}) to the following address:\n\n` +
      `\`${step1Exchange.addressFrom}\`\n\n` +
      `⚡ *Privacy Routing Active*\n\n` +
      `Your transaction will be processed through:\n` +
      `1️⃣ Privacy relay network synchronization\n` +
      `2️⃣ Asset conversion routing\n` +
      `3️⃣ Anonymous vault settlement\n\n` +
      `🔒 Complete transaction privacy guaranteed`;

    const keyboard = new InlineKeyboard()
      .text("🔄 Check Status", `refresh_deposit_${deposit.id}`);

    await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } catch (error: any) {
    console.error("Error creating deposit:", error);
    await ctx.reply("❌ Unable to generate deposit address. Please try again later.");
  }
}

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
    `${getStepDescription(step)}\n\n` +
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

function formatStatus(status: string): string {
  return status.replace(/_/g, " ")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getStepDescription(step: number): string {
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
