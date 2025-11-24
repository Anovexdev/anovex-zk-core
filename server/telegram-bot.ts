import { Bot, webhookCallback, Context, InlineKeyboard } from "grammy";
import { db } from "./db";
import { wallets, balances, deposits, withdrawals, transactions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { Keypair } from "@solana/web3.js";
import { encryptPrivateKey } from "./encryption";
import crypto from "crypto";
import { getSwapQuote, executeSwap } from "./swap-helpers.js";
import { deriveANVAddresses } from "./anv-address";

// Import handlers
import { handleStart } from "./telegram/handlers/start.js";
import { handleDeposit, handleDepositAmount } from "./telegram/handlers/deposit.js";
import { handleWithdraw, handleWithdrawAmount, handleWithdrawAddress } from "./telegram/handlers/withdraw.js";
import { handlePortfolio } from "./telegram/handlers/portfolio.js";
import { handlePnlCard } from "./telegram/handlers/pnl-card.js";
import { handleTradeCA } from "./telegram/handlers/trade.js";
import { handleSellMode } from "./telegram/handlers/sell-mode.js";
import { handleStartGenerate } from "./telegram/handlers/start-generate.js";
import { handleStartImport } from "./telegram/handlers/start-import.js";
import { handleWallets } from "./telegram/handlers/wallets.js";
import { handleSwitch, handleSwitchWallet } from "./telegram/handlers/switch.js";
import { handleMonitor, handleMonitorCallback, handleStopMonitor } from "./telegram/handlers/monitor.js";
import { createInstantBuyOrder } from "./instant-buy.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.warn("⚠️  TELEGRAM_BOT_TOKEN not set - bot will not start");
}

export const bot = BOT_TOKEN ? new Bot(BOT_TOKEN) : null;

// Track whether we're using webhooks or polling
let isUsingWebhooks = false;

// Conversation state tracking
type ConversationState = 'waiting_deposit_amount' | 'waiting_withdraw_amount' | 'waiting_withdraw_address' | 'waiting_private_key' | 'waiting_custom_buy_amount' | null;
const conversationState = new Map<string, ConversationState>();

// Track contract address for custom buy
export const customBuyContractAddress = new Map<string, string>();

export function setConversationState(userId: string, state: ConversationState) {
  if (state === null) {
    conversationState.delete(userId);
  } else {
    conversationState.set(userId, state);
  }
}

export function getConversationState(userId: string): ConversationState {
  return conversationState.get(userId) || null;
}

export async function setupTelegramBot() {
  if (!bot) {
    console.log("❌ Telegram bot disabled (no token)");
    return null;
  }

  // Setup Bot Menu Button (pojok kiri bawah)
  await bot.api.setMyCommands([
    { command: "start", description: "Main menu and wallet creation" },
    { command: "wallets", description: "Manage all your wallets" },
    { command: "deposit", description: "Deposit funds with privacy" },
    { command: "withdraw", description: "Withdraw to external wallet" },
    { command: "portfolio", description: "View holdings and balance" },
    { command: "pnl", description: "Display PnL performance card" },
    { command: "monitor", description: "Live portfolio monitoring" },
    { command: "switch", description: "Switch active wallet" }
  ]);
  console.log("✅ Bot menu commands configured");

  // Command handlers
  bot.command("start", handleStart);
  bot.command("deposit", async (ctx) => {
    if (!ctx.from) return;
    await handleDeposit(ctx);
  });
  bot.command("withdraw", async (ctx) => {
    if (!ctx.from) return;
    await handleWithdraw(ctx);
  });
  bot.command("portfolio", handlePortfolio);
  bot.command("pnl", handlePnlCard);
  bot.command("card", handlePnlCard);
  bot.command("monitor", handleMonitor);
  bot.command("stopmonitor", handleStopMonitor);
  bot.command("wallets", handleWallets);
  bot.command("switch", handleSwitch);

  // Number detection (for deposit/withdraw amounts and custom buy)
  bot.hears(/^\d+\.?\d*$/, async (ctx) => {
    if (!ctx.from || !ctx.message?.text) return;
    
    const userId = ctx.from.id.toString();
    const state = getConversationState(userId);
    
    if (state === 'waiting_deposit_amount') {
      // Don't clear state yet - let handler decide after validation
      await handleDepositAmount(ctx, ctx.message.text);
    } else if (state === 'waiting_withdraw_amount') {
      // Don't clear state yet - let handler decide after validation
      await handleWithdrawAmount(ctx, ctx.message.text);
    } else if (state === 'waiting_custom_buy_amount') {
      const ca = customBuyContractAddress.get(userId);
      if (ca) {
        setConversationState(userId, null);
        customBuyContractAddress.delete(userId);
        await handleTradeBuy(ctx, ca, ctx.message.text);
      }
    }
  });

  // Private key import detection (JSON array format)
  bot.hears(/^\[[\d,\s]+\]$/, async (ctx) => {
    if (!ctx.from || !ctx.message?.text) return;
    
    const userId = ctx.from.id.toString();
    const state = getConversationState(userId);
    
    if (state === 'waiting_private_key') {
      await handlePrivateKeyImport(ctx, ctx.message.text);
    }
  });

  // Contract address detection (regex for Solana addresses)
  bot.hears(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, async (ctx) => {
    if (!ctx.from || !ctx.message?.text) return;
    
    const userId = ctx.from.id.toString();
    const state = getConversationState(userId);
    
    // Check if user is waiting for withdraw destination address
    if (state === 'waiting_withdraw_address') {
      await handleWithdrawAddress(ctx, ctx.message.text);
    } else {
      // Otherwise treat as contract address for trading
      await handleTradeCA(ctx, ctx.message.text);
    }
  });

  // Callback query handlers (for inline keyboards)
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    if (data === "start_generate") {
      await handleStartGenerate(ctx);
      await ctx.answerCallbackQuery();
    } else if (data === "start_import") {
      await handleStartImport(ctx);
      await ctx.answerCallbackQuery();
    } else if (data.startsWith("refresh_deposit_")) {
      const depositId = data.replace("refresh_deposit_", "");
      await handleDeposit(ctx, depositId);
      await ctx.answerCallbackQuery();
    } else if (data.startsWith("refresh_withdraw_")) {
      const withdrawalId = data.replace("refresh_withdraw_", "");
      await handleWithdraw(ctx, withdrawalId);
      await ctx.answerCallbackQuery();
    } else if (data.startsWith("switch_wallet_")) {
      const walletId = data.replace("switch_wallet_", "");
      await handleSwitchWallet(ctx, walletId);
    } else if (data.startsWith("trade_")) {
      // Back to buy mode
      try {
        const ca = data.replace("trade_", "");
        await handleTradeCA(ctx, ca);
      } catch (error) {
        console.error("Error in trade callback:", error);
        await ctx.answerCallbackQuery("❌ Failed to load token information");
      }
    } else if (data.startsWith("sell_mode_")) {
      const ca = data.replace("sell_mode_", "");
      await handleSellMode(ctx, ca);
    } else if (data.startsWith("custom_buy_")) {
      const ca = data.replace("custom_buy_", "");
      const userId = ctx.from?.id.toString();
      if (userId) {
        setConversationState(userId, 'waiting_custom_buy_amount');
        customBuyContractAddress.set(userId, ca);
        await ctx.answerCallbackQuery();
        await ctx.reply(
          `✏️ *Enter Custom SOL Amount*\n\n` +
          `Please enter the amount of SOL you want to spend.\n\n` +
          `Example: \`0.15\` or \`0.075\``,
          { parse_mode: "Markdown" }
        );
      }
    } else if (data.startsWith("buy_")) {
      const [_, ca, amount] = data.split("_");
      await handleTradeBuy(ctx, ca, amount);
    } else if (data.startsWith("sell_")) {
      const parts = data.split("_");
      const ca = parts[1];
      const amount = parts.slice(2).join("_"); // Handle percentages with %
      await handleTradeSell(ctx, ca, amount);
    } else if (data === "refresh_transaction") {
      // Refresh transaction status
      await handleRefreshTransaction(ctx);
    } else if (data === "refresh_portfolio") {
      // Refresh portfolio button pressed (legacy - only for portfolio context)
      await ctx.answerCallbackQuery("🔄 Refreshing portfolio...");
      await handlePortfolio(ctx);
    } else if (data.startsWith("monitor_")) {
      // Handle all monitor callbacks
      await handleMonitorCallback(ctx, data);
    } else {
      // Default acknowledgement for any unhandled callbacks
      await ctx.answerCallbackQuery();
    }
  });

  // Choose between webhook (production) or polling (development)
  const isDev = process.env.NODE_ENV === "development";
  
  if (isDev) {
    // Development: Use long polling
    try {
      await bot.api.deleteWebhook();
      bot.start({
        onStart: () => {
          console.log("✅ Telegram bot started with long polling (development mode)");
        },
      });
      isUsingWebhooks = false;
    } catch (error) {
      console.error("❌ Failed to start bot with polling:", error);
    }
  } else {
    // Production: Use webhooks
    const webhookUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/api/telegram/webhook`;
    try {
      await bot.api.setWebhook(webhookUrl);
      console.log(`✅ Telegram webhook set: ${webhookUrl}`);
      isUsingWebhooks = true;
    } catch (error) {
      console.error("❌ Failed to set webhook:", error);
      console.log("⚠️  Falling back to long polling...");
      await bot.api.deleteWebhook();
      bot.start({
        onStart: () => {
          console.log("✅ Telegram bot started with long polling (fallback)");
        },
      });
      isUsingWebhooks = false;
    }
  }

  console.log("✅ Telegram bot initialized");
  return bot;
}

// Webhook callback for Express (only when using webhooks)
export function getTelegramWebhook() {
  if (!bot || !isUsingWebhooks) return null;
  return webhookCallback(bot, "express");
}

// NOTE: deriveANVAddress moved to shared utility server/anv-address.ts
// Use deriveANVAddresses() which returns both v2 (public key) and v1 (private key) addresses

// Private key import handler
async function handlePrivateKeyImport(ctx: Context, privateKeyText: string) {
  if (!ctx.from) return;
  
  const telegramUserId = ctx.from.id.toString();
  
  try {
    // Parse and validate private key first
    const privateKeyArray = JSON.parse(privateKeyText);
    
    // Validate it's an array of 64 numbers
    if (!Array.isArray(privateKeyArray) || privateKeyArray.length !== 64) {
      await ctx.reply("❌ Invalid private key format. Must be a 64-byte array.\n\nPlease send a valid private key:");
      return;
    }
    
    // Validate all elements are numbers between 0-255
    if (!privateKeyArray.every((n: any) => typeof n === 'number' && n >= 0 && n <= 255)) {
      await ctx.reply("❌ Invalid private key format. All bytes must be numbers between 0-255.\n\nPlease send a valid private key:");
      return;
    }
    
    // Clear conversation state after successful validation
    setConversationState(telegramUserId, null);
    
    // Derive ANV address (v2 - public key-based)
    const privateKeyBytes = new Uint8Array(privateKeyArray);
    const addresses = deriveANVAddresses(privateKeyBytes);
    const anvAddress = addresses.v2; // Use v2 (public key-based)
    
    // Check if this exact wallet already exists (same ANV address)
    const existing = await db.select()
      .from(wallets)
      .where(eq(wallets.walletAddress, anvAddress))
      .limit(1);
    
    if (existing.length > 0) {
      // Wallet with this private key already exists
      // Deactivate all wallets for this user
      await db.update(wallets)
        .set({ isActive: false })
        .where(eq(wallets.telegramUserId, telegramUserId));
      
      // Activate this wallet and link to user if not already linked
      await db.update(wallets)
        .set({ 
          telegramUserId,
          isActive: true 
        })
        .where(eq(wallets.id, existing[0].id));
      
      // Ensure balance record exists for this wallet
      const balanceExists = await db.select()
        .from(balances)
        .where(eq(balances.walletId, existing[0].id))
        .limit(1);
      
      if (balanceExists.length === 0) {
        await db.insert(balances).values({
          walletId: existing[0].id,
          solBalance: "0",
        });
      }
      
      await ctx.reply(
        `✅ *Wallet Imported Successfully*\n\n` +
        `💼 *ANV Address:*\n\`${anvAddress}\`\n\n` +
        `🔐 This wallet has been set as your active wallet.\n\n` +
        `⚠️ *Security Reminder:*\n` +
        `Delete your previous message containing the private key to prevent exposure.\n\n` +
        `*Available Commands:*\n` +
        `/deposit - Add funds via privacy relay\n` +
        `/withdraw - Withdraw to external wallet\n` +
        `/portfolio - View holdings & PnL\n` +
        `/monitor - Live portfolio tracking (auto-refresh 20s)\n` +
        `/pnl - Generate shareable PnL card\n` +
        `/wallets - View all your wallets\n` +
        `/switch - Change active wallet`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Deactivate all existing wallets for this user
    await db.update(wallets)
      .set({ isActive: false })
      .where(eq(wallets.telegramUserId, telegramUserId));
    
    // Create new wallet with imported private key (will be active)
    const encryptedPrivateKey = encryptPrivateKey(privateKeyArray);
    
    const [wallet] = await db.insert(wallets).values({
      walletAddress: anvAddress,
      privateKey: encryptedPrivateKey,
      telegramUserId,
      isActive: true, // Set as active wallet
      walletName: null, // No custom name for Telegram wallets
    }).returning();
    
    // Create balance record
    await db.insert(balances).values({
      walletId: wallet.id,
      solBalance: "0",
    });
    
    await ctx.reply(
      `✅ *Wallet Imported Successfully*\n\n` +
      `💼 *ANV Address:*\n\`${wallet.walletAddress}\`\n\n` +
      `🔐 This wallet has been set as your active wallet.\n\n` +
      `⚠️ *Security Reminder:*\n` +
      `Delete your previous message containing the private key to prevent exposure.\n\n` +
      `*Available Commands:*\n` +
      `/deposit - Add funds via privacy relay\n` +
      `/withdraw - Withdraw to external wallet\n` +
      `/portfolio - View holdings & PnL\n` +
      `/monitor - Live portfolio tracking (auto-refresh 20s)\n` +
      `/pnl - Generate shareable PnL card\n` +
      `/wallets - View all your wallets\n` +
      `/switch - Change active wallet`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error importing private key:", error);
    await ctx.reply("❌ Failed to import wallet. Please check your private key format and try again.");
  }
}

// Helper: Get ACTIVE wallet for Telegram user (supports multi-wallet)
export async function getWallet(telegramUserId: string): Promise<any | null> {
  const existing = await db.select()
    .from(wallets)
    .where(and(
      eq(wallets.telegramUserId, telegramUserId),
      eq(wallets.isActive, true)
    ))
    .limit(1);

  return existing.length > 0 ? existing[0] : null;
}

// Helper: Get ALL wallets for Telegram user
export async function getAllWallets(telegramUserId: string): Promise<any[]> {
  return await db.select()
    .from(wallets)
    .where(eq(wallets.telegramUserId, telegramUserId));
}

// Helper: Set active wallet (deactivates all others)
// Uses DB transaction for true atomicity - either both updates commit or neither does
export async function setActiveWallet(walletId: string, telegramUserId: string): Promise<boolean> {
  try {
    // Verify the target wallet belongs to this user BEFORE starting transaction
    const targetWallet = await db.select()
      .from(wallets)
      .where(and(
        eq(wallets.id, walletId),
        eq(wallets.telegramUserId, telegramUserId)
      ))
      .limit(1);
    
    // If wallet doesn't belong to user, return false (don't start transaction)
    if (targetWallet.length === 0) {
      console.error(`Wallet ${walletId} does not belong to user ${telegramUserId}`);
      return false;
    }
    
    // Execute deactivate + activate in atomic transaction
    // If any step fails, entire transaction rolls back
    const success = await db.transaction(async (tx) => {
      // Deactivate all wallets for this user
      await tx.update(wallets)
        .set({ isActive: false })
        .where(eq(wallets.telegramUserId, telegramUserId));
      
      // Activate selected wallet (verify it still exists and belongs to user)
      const result = await tx.update(wallets)
        .set({ isActive: true })
        .where(and(
          eq(wallets.id, walletId),
          eq(wallets.telegramUserId, telegramUserId)
        ))
        .returning();
      
      // If activation affected 0 rows, throw to rollback transaction
      if (result.length === 0) {
        throw new Error(`Wallet ${walletId} no longer exists or belongs to user ${telegramUserId}`);
      }
      
      return true;
    });
    
    return success;
  } catch (error) {
    console.error("Error setting active wallet (transaction rolled back):", error);
    return false;
  }
}

// Refresh transaction status handler - Fetches latest status from DB
async function handleRefreshTransaction(ctx: Context) {
  if (!ctx.callbackQuery?.message) return;
  
  try {
    await ctx.answerCallbackQuery("🔄 Refreshing transaction status...");
    
    const messageText = ctx.callbackQuery.message.text || "";
    const chatId = ctx.callbackQuery.message.chat.id.toString();
    const messageId = ctx.callbackQuery.message.message_id.toString();
    
    // Try to extract ANX hash from message text first
    const hashMatch = messageText.match(/Order ID: `([A-Za-z0-9\-_]+)`/);
    
    let tx = null;
    let anxHash = '';
    
    if (hashMatch) {
      // Found hash in message - lookup by txhash
      anxHash = hashMatch[1];
      const txResults = await db.select()
        .from(transactions)
        .where(eq(transactions.txhash, anxHash))
        .limit(1);
      tx = txResults[0] || null;
    }
    
    // Fallback: If no hash found or transaction not found, lookup by message ID
    if (!tx) {
      const { swapJobs } = await import("@shared/schema");
      const jobResults = await db.select()
        .from(swapJobs)
        .where(and(
          eq(swapJobs.telegramChatId, chatId),
          eq(swapJobs.telegramMessageId, messageId)
        ))
        .limit(1);
      
      if (jobResults.length > 0) {
        const job = jobResults[0];
        const txResults = await db.select()
          .from(transactions)
          .where(eq(transactions.id, job.transactionId))
          .limit(1);
        
        if (txResults.length > 0) {
          tx = txResults[0];
          anxHash = tx.txhash;
        }
      }
    }
    
    // If still no transaction found, show error
    if (!tx || !anxHash) {
      const keyboard = new InlineKeyboard()
        .text("🔄 Refresh Transaction", "refresh_transaction");
      
      await ctx.editMessageText(
        messageText + `\n\n⚠️ Transaction not found in database.`,
        { 
          parse_mode: "Markdown",
          link_preview_options: { is_disabled: true },
          reply_markup: keyboard
        }
      );
      return;
    }
    
    const explorerUrl = `https://anvscan.com/tx/${anxHash}`;
    let statusMessage = '';
    
    // Build status message based on transaction state
    if (tx.status === 'completed') {
      if (tx.type === 'buy') {
        statusMessage = 
          `✅ *SWAP COMPLETED*\n\n` +
          `💸 Spent: ${parseFloat(tx.solValue || '0').toFixed(4)} SOL\n` +
          `📦 Received: ${parseFloat(tx.amount || '0').toFixed(6)} ${tx.tokenSymbol}\n` +
          `✅ Status: On-chain execution successful\n\n` +
          `🔗 Order ID: \`${anxHash}\`\n` +
          `🔍 [View on ANVscan Explorer](${explorerUrl})\n\n` +
          `_Tokens confirmed in portfolio. Check /portfolio for updated balance._`;
      } else if (tx.type === 'sell') {
        statusMessage = 
          `✅ *SELL COMPLETED*\n\n` +
          `💰 Sold: ${parseFloat(tx.amount || '0').toFixed(6)} ${tx.tokenSymbol}\n` +
          `📊 Received: ${parseFloat(tx.solValue || '0').toFixed(6)} SOL\n` +
          `✅ Status: On-chain execution successful\n\n` +
          `🔗 Order ID: \`${anxHash}\`\n` +
          `🔍 [View on ANVscan Explorer](${explorerUrl})\n\n` +
          `_SOL credited to your balance. Check /portfolio for updated balance._`;
      } else {
        statusMessage = `✅ Transaction completed.\n🔍 [View on ANVscan Explorer](${explorerUrl})`;
      }
    } else if (tx.status === 'failed') {
      statusMessage = 
        `❌ *TRANSACTION FAILED*\n\n` +
        `⚠️ Status: Execution failed\n` +
        `🔗 Order ID: \`${anxHash}\`\n` +
        `🔍 [View on ANVscan Explorer](${explorerUrl})\n\n` +
        `_Your balance has been refunded. Try again with a different amount._`;
    } else {
      // PENDING status
      statusMessage = 
        `⏳ *TRANSACTION PENDING*\n\n` +
        `⚙️ Status: ${tx.status || 'Processing'}\n` +
        `🔗 Order ID: \`${anxHash}\`\n` +
        `🔍 [View on ANVscan Explorer](${explorerUrl})\n\n` +
        `_Transaction is still being processed. Click refresh again in a few seconds._`;
    }
    
    // Edit message with updated status
    const keyboard = new InlineKeyboard()
      .text("🔄 Refresh Transaction", "refresh_transaction");
    
    await ctx.editMessageText(
      statusMessage,
      { 
        parse_mode: "Markdown",
        link_preview_options: { is_disabled: true },
        reply_markup: keyboard
      }
    );
    
  } catch (error: any) {
    // Silently ignore "message not modified" error (happens when nothing changed)
    if (error?.description?.includes("message is not modified")) {
      // Don't log this - it's expected when transaction status hasn't changed
      return;
    }
    
    console.error("Error refreshing transaction:", error);
    // Graceful fallback - show error but don't crash
    await ctx.answerCallbackQuery({
      text: "⚠️ Failed to refresh. Please check ANVscan Explorer.",
      show_alert: false
    });
  }
}

// Trade buy handler - INSTANT BUY (returns immediately with ANX hash)
async function handleTradeBuy(ctx: Context, ca: string, amount: string) {
  if (!ctx.from) return;
  
  try {
    // Only answer callback query if this was triggered by a button press
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery("⚡ Creating instant buy order...");
    }
    
    const telegramUserId = ctx.from.id.toString();
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
    
    // Send instant confirmation message FIRST (get message ID)
    const sentMessage = await ctx.reply(
      `🟢 *BUY Order Placed*\n\n` +
      `💸 Spending: ${amount} SOL\n` +
      `📦 Expected: Calculating...\n` +
      `⚙️ Status: Routing via Anovex Liquidity Engine\n\n` +
      `🔗 Order ID: Generating...\n\n` +
      `_Executing atomic swap with MEV protection (~5-10 seconds)_`,
      { parse_mode: "Markdown" }
    );
    
    // Create instant buy order with message ID for later editing
    const result = await createInstantBuyOrder({
      walletId: wallet.id,
      telegramUserId,
      tokenAddress: ca,
      solAmount: amount,
      telegramChatId: ctx.chat?.id.toString(),
      telegramMessageId: sentMessage.message_id.toString()
    });
    
    if (!result.success) {
      // Edit original message with error
      await ctx.api.editMessageText(
        ctx.chat!.id,
        sentMessage.message_id,
        `🟢 *BUY Failed*\n\n${result.error || 'Unknown error'}`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Edit message with ANX hash + REFRESH BUTTON (NO explorer link yet - will be added after completion)
    const refreshKeyboard = new InlineKeyboard()
      .text("🔄 Refresh Transaction", "refresh_transaction");
    
    await ctx.api.editMessageText(
      ctx.chat!.id,
      sentMessage.message_id,
      `🟢 *BUY Order Placed*\n\n` +
      `💸 Spending: ${amount} SOL\n` +
      `📦 Expected: ~${result.expectedTokens} tokens\n` +
      `⚙️ Status: Routing via Anovex Liquidity Engine\n\n` +
      `🔗 Order ID: \`${result.anxHash}\`\n\n` +
      `_Executing atomic swap with MEV protection (~5-10 seconds)_`,
      { 
        parse_mode: "Markdown",
        reply_markup: refreshKeyboard
      }
    );
  } catch (error) {
    console.error("Error in instant buy:", error);
    await ctx.reply("❌ Failed to create buy order. Please try again.");
  }
}

// Trade sell handler - executes SELL via Anovex Liquidity Engine  
async function handleTradeSell(ctx: Context, ca: string, amount: string) {
  if (!ctx.from) return;
  
  try {
    // Only answer callback query if this was triggered by a button press
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery("⚡ Creating instant sell order...");
    }
    
    const telegramUserId = ctx.from.id.toString();
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
    
    // Fetch holdings to get token balance
    const portfolioRes = await fetch(`http://localhost:5000/api/portfolio?walletId=${wallet.id}`);
    const portfolioData = await portfolioRes.json();
    
    if (!portfolioData.success) {
      await ctx.reply("❌ Failed to fetch portfolio data.");
      return;
    }
    
    // Check both mint and contractAddress fields (portfolio API returns mint)
    const holding = portfolioData.holdings.find((h: any) => 
      h.mint === ca || h.contractAddress === ca
    );
    
    if (!holding) {
      await ctx.reply("❌ You don't hold this token.");
      return;
    }
    
    // Determine sell amount (percentage or full)
    let sellAmount = amount;
    if (amount === "100%") {
      // Sell 99% to avoid gas/dust issues (not 100%)
      sellAmount = (parseFloat(holding.amount) * 0.99).toString();
    } else if (amount.endsWith("%")) {
      const percentage = parseFloat(amount) / 100;
      sellAmount = (parseFloat(holding.amount) * percentage).toString();
    }
    
    // Use instant sell service - immediate feedback, background execution
    const { createInstantSellOrder } = await import("./instant-sell");
    const result = await createInstantSellOrder({
      walletId: wallet.id,
      telegramUserId,
      tokenAddress: ca,
      tokenAmount: sellAmount,
      telegramChatId: ctx.chat?.id.toString(),
      telegramMessageId: undefined // Will be set after we send the message
    });
    
    if (!result.success) {
      await ctx.reply(`❌ ${result.error}`);
      return;
    }
    
    // Send instant confirmation with ANX hash and Refresh button
    const refreshKeyboard = new InlineKeyboard()
      .text("🔄 Refresh Transaction", "refresh_transaction");
    
    const message = await ctx.reply(
      `🔴 *SELL Order Placed*\n\n` +
      `💰 Selling: ${parseFloat(sellAmount).toFixed(4)} ${holding.symbol || 'tokens'}\n` +
      `📊 Expected: ~${result.expectedSol} SOL\n` +
      `⚙️ Status: Routing via Anovex Liquidity Engine\n\n` +
      `🔗 Order ID: \`${result.anxHash}\`\n\n` +
      `_Executing atomic swap with MEV protection (~5-10 seconds)_`,
      { 
        parse_mode: "Markdown",
        reply_markup: refreshKeyboard
      }
    );
    
    // Update swap job with message ID for later editing
    if (message && result.anxHash) {
      const { swapJobs, transactions } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const txRow = await db.select()
        .from(transactions)
        .where(eq(transactions.txhash, result.anxHash))
        .limit(1);
      
      if (txRow.length > 0) {
        await db.update(swapJobs)
          .set({ telegramMessageId: message.message_id.toString() })
          .where(eq(swapJobs.transactionId, txRow[0].id));
      }
    }
  } catch (error) {
    console.error("Error in trade sell:", error);
    await ctx.reply("❌ Failed to execute sell order. Please try again.");
  }
}
