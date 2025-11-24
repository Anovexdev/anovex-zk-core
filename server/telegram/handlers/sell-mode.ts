import { Context, InlineKeyboard } from "grammy";

export async function handleSellMode(ctx: Context, contractAddress: string) {
  const isCallback = !!ctx.callbackQuery;
  let callbackAnswered = false;

  try {
    if (!ctx.from) {
      if (isCallback) {
        await ctx.answerCallbackQuery("❌ Invalid request");
        callbackAnswered = true;
      }
      return;
    }

    // Create sell mode keyboard with percentage presets
    const keyboard = new InlineKeyboard()
      .text("25%", `sell_${contractAddress}_25%`)
      .text("50%", `sell_${contractAddress}_50%`)
      .text("75%", `sell_${contractAddress}_75%`)
      .row()
      .text("100%", `sell_${contractAddress}_100%`)
      .row()
      .text("🟢 BUY", `trade_${contractAddress}`);

    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    await ctx.answerCallbackQuery("💎 Sell mode activated");
    callbackAnswered = true;
  } catch (error) {
    console.error("Error in sell mode:", error);
    
    if (isCallback && !callbackAnswered) {
      try {
        await ctx.answerCallbackQuery("❌ Failed to switch to sell mode");
        callbackAnswered = true;
      } catch (ackError) {
        console.error("Failed to acknowledge callback:", ackError);
      }
    }
  } finally {
    // Safety net: ensure callback is ALWAYS acknowledged
    if (isCallback && !callbackAnswered) {
      try {
        await ctx.answerCallbackQuery();
      } catch (ackError) {
        console.error("Failed to acknowledge callback in finally:", ackError);
      }
    }
  }
}
