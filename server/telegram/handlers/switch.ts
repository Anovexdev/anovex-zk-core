import { Context, InlineKeyboard } from "grammy";
import { getAllWallets, setActiveWallet, getWallet } from "../../telegram-bot.js";

export async function handleSwitch(ctx: Context) {
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
    
    if (allWallets.length === 1) {
      await ctx.reply(
        `ℹ️ *Only One Wallet*\n\n` +
        `You only have one wallet. Create or import more wallets using /start to switch between them.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const activeWallet = await getWallet(telegramUserId);
    const keyboard = new InlineKeyboard();
    
    allWallets.forEach((wallet, index) => {
      const isActive = wallet.id === activeWallet?.id;
      const label = wallet.walletName || `Wallet ${index + 1}`;
      const statusEmoji = isActive ? "🟢" : "⚪";
      const buttonText = `${statusEmoji} ${label}`;
      
      keyboard.text(buttonText, `switch_wallet_${wallet.id}`).row();
    });
    
    await ctx.reply(
      `🔄 *SWITCH ACTIVE WALLET*\n\n` +
      `Select which wallet to activate:\n\n` +
      `🟢 = Currently Active\n` +
      `⚪ = Inactive`,
      { 
        parse_mode: "Markdown",
        reply_markup: keyboard
      }
    );
  } catch (error) {
    console.error("Error in /switch:", error);
    await ctx.reply("❌ Failed to switch wallet. Please try again.");
  }
}

// Callback handler for wallet switching
export async function handleSwitchWallet(ctx: Context, walletId: string) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    const success = await setActiveWallet(walletId, telegramUserId);
    
    if (success) {
      // Get the newly activated wallet info
      const newActiveWallet = await getWallet(telegramUserId);
      
      await ctx.editMessageText(
        `✅ *WALLET SWITCHED*\n\n` +
        `💼 *Active Wallet:*\n\`${newActiveWallet?.walletAddress}\`\n\n` +
        `All commands will now use this wallet.`,
        { parse_mode: "Markdown" }
      );
      await ctx.answerCallbackQuery("✅ Wallet switched successfully");
    } else {
      await ctx.answerCallbackQuery("❌ Failed to switch wallet");
    }
  } catch (error) {
    console.error("Error switching wallet:", error);
    await ctx.answerCallbackQuery("❌ Failed to switch wallet");
  }
}
