import { Context, InlineKeyboard } from "grammy";
import { getWallet } from "../../telegram-bot.js";

export async function handleStart(ctx: Context) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    // Get active wallet (if exists)
    const wallet = await getWallet(telegramUserId);

    if (wallet) {
      // Existing user - show welcome back message
      await ctx.reply(
        `✅ *Welcome Back to Anovex*\n\n` +
        `💼 *Active Wallet:*\n\`${wallet.walletAddress}\`\n\n` +
        `🔐 *Privacy-First Trading*\n` +
        `All transactions are routed through our ZK relay network to ensure complete anonymity.\n\n` +
        `*Available Commands:*\n` +
        `/deposit - Add funds via privacy relay\n` +
        `/withdraw - Withdraw to external wallet\n` +
        `/portfolio - View holdings & PnL\n` +
        `/pnl - Generate shareable PnL card\n` +
        `/wallets - View all your wallets\n` +
        `/switch - Change active wallet\n\n` +
        `*Quick Trade:*\n` +
        `Just paste a token contract address to start trading!`,
        { parse_mode: "Markdown" }
      );
    } else {
      // New user - show wallet creation options
      const keyboard = new InlineKeyboard()
        .text("🆕 Generate New Wallet", "start_generate")
        .row()
        .text("📥 Import Existing Wallet", "start_import");

      await ctx.reply(
        `🔒 *Welcome to Anovex*\n\n` +
        `Privacy-focused decentralized trading with complete transaction anonymity.\n\n` +
        `*Choose an option to get started:*`,
        { 
          parse_mode: "Markdown",
          reply_markup: keyboard
        }
      );
    }
  } catch (error) {
    console.error("Error in /start:", error);
    await ctx.reply("❌ Failed to initialize wallet. Please try again.");
  }
}
