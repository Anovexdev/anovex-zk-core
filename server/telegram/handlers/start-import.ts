import { Context } from "grammy";
import { setConversationState } from "../../telegram-bot.js";

export async function handleStartImport(ctx: Context) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  
  try {
    // Set conversation state to wait for private key
    setConversationState(telegramUserId, 'waiting_private_key');
    
    await ctx.reply(
      `📥 *Import Existing Wallet*\n\n` +
      `Please send your private key as a JSON array.\n\n` +
      `*Format:* \`[64,23,145,78,...]\`\n\n` +
      `⚠️ *Security Reminder:*\n` +
      `• Only import keys you trust\n` +
      `• Your key will be encrypted before storage\n` +
      `• Delete your message after import completes\n\n` +
      `📋 *Example:*\n` +
      `\`[64,23,145,78,92,156,...(64 numbers total)]\`\n\n` +
      `Send the complete 64-byte array now:`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error in start import:", error);
    await ctx.reply("❌ Failed to initiate import. Please try again.");
  }
}
