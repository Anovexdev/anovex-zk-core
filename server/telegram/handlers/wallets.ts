import { Context, InlineKeyboard } from "grammy";
import { getAllWallets, getWallet } from "../../telegram-bot.js";

export async function handleWallets(ctx: Context) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    const allWallets = await getAllWallets(telegramUserId);
    
    if (allWallets.length === 0) {
      await ctx.reply(
        `⚠️ *No Wallets Found*\n\n` +
        `You haven't created any wallets yet.\n\n` +
        `Use /start to generate or import a wallet.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const activeWallet = await getWallet(telegramUserId);
    
    let message = `💼 *YOUR WALLETS* (${allWallets.length})\n\n`;
    
    allWallets.forEach((wallet, index) => {
      const isActive = wallet.id === activeWallet?.id;
      const statusEmoji = isActive ? "🟢" : "⚪";
      const statusText = isActive ? "ACTIVE" : "Inactive";
      const walletName = wallet.walletName || `Wallet ${index + 1}`;
      
      message += `${statusEmoji} *${walletName}* (${statusText})\n`;
      message += `   \`${wallet.walletAddress}\`\n\n`;
    });
    
    message += `💡 *Commands:*\n`;
    message += `/switch - Change active wallet\n`;
    message += `/start - Generate or import new wallet`;
    
    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in /wallets:", error);
    await ctx.reply("❌ Failed to retrieve wallets. Please try again.");
  }
}
