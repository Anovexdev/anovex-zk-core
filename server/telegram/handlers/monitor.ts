import { Context, InlineKeyboard } from "grammy";
import { getWallet, setConversationState, customBuyContractAddress } from "../../telegram-bot.js";
import { db } from "../../db";
import { balances, tokenHoldings, monitorSessions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getSolanaPrice } from "../../coingecko.js";
import { getTokenPrices } from "../../pricing.js";
import { createInstantBuyOrder } from "../../instant-buy.js";
import { createInstantSellOrder } from "../../instant-sell.js";

export async function handleMonitor(ctx: Context) {
  if (!ctx.from) return;

  const telegramUserId = ctx.from.id.toString();
  const chatId = ctx.chat?.id.toString();
  
  if (!chatId) return;
  
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

    // CLEANUP: Find and delete all old monitor sessions + messages first
    const oldSessions = await db.select()
      .from(monitorSessions)
      .where(eq(monitorSessions.chatId, chatId));
    
    if (oldSessions.length > 0) {
      console.log(`🧹 Cleaning up ${oldSessions.length} old monitor session(s) for chat ${chatId}`);
      
      for (const oldSession of oldSessions) {
        // Try to unpin old message
        try {
          await ctx.api.unpinChatMessage(parseInt(chatId), parseInt(oldSession.messageId));
          console.log(`📌 Unpinned old monitor message ${oldSession.messageId}`);
        } catch (unpinError: any) {
          console.log(`⚠️ Could not unpin message ${oldSession.messageId}: ${unpinError.message}`);
        }
        
        // Try to delete old message
        try {
          await ctx.api.deleteMessage(chatId, parseInt(oldSession.messageId));
          console.log(`🗑️ Deleted old monitor message ${oldSession.messageId}`);
        } catch (deleteError: any) {
          console.log(`⚠️ Could not delete message ${oldSession.messageId}: ${deleteError.message}`);
        }
      }
      
      // Delete all old sessions from database
      await db.delete(monitorSessions)
        .where(eq(monitorSessions.chatId, chatId));
      console.log(`✅ Cleaned up all old sessions for chat ${chatId}`);
    }

    // Get token holdings (filter out zero-balance holdings)
    const allHoldings = await db.select()
      .from(tokenHoldings)
      .where(eq(tokenHoldings.walletId, wallet.id));
    
    // Filter out holdings with zero or negative amounts
    const holdings = allHoldings.filter(h => parseFloat(h.amount) > 0);

    // CRITICAL: Create session even when holdings are empty to enable persistent monitoring
    let message: string;
    let keyboard: any;
    
    if (holdings.length === 0) {
      // Show "All tokens sold" state from the start
      message = await buildMonitorMessage(wallet.id, 0, 'buy');
      keyboard = buildEmptyMonitorKeyboard();
    } else {
      // Show first token
      message = await buildMonitorMessage(wallet.id, 0, 'buy');
      keyboard = buildMonitorKeyboard(0, holdings.length, 'buy', holdings[0].mint);
    }
    
    const sentMessage = await ctx.reply(message, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });

    // Auto-pin the NEW monitor message
    try {
      await ctx.api.pinChatMessage(parseInt(chatId), sentMessage.message_id, {
        disable_notification: true // Silent pin to avoid notification spam
      });
      console.log(`📌 Monitor message pinned for chat ${chatId}`);
    } catch (pinError: any) {
      console.warn(`⚠️ Failed to pin monitor message (may lack permissions):`, pinError.message);
      // Don't fail the whole operation if pinning fails
    }

    // Create NEW PERMANENT session (never auto-deleted)
    
    await db.insert(monitorSessions).values({
      chatId,
      messageId: sentMessage.message_id.toString(),
      walletId: wallet.id,
      currentTokenIndex: "0",
      tradeMode: 'buy',
      isActive: true,
    });

    console.log(`✅ Monitor session created for chat ${chatId}`);
  } catch (error) {
    console.error("Error in /monitor:", error);
    await ctx.reply("❌ Failed to start monitoring. Please try again.");
  }
}

async function buildMonitorMessage(walletId: string, tokenIndex: number, tradeMode: 'buy' | 'sell'): Promise<string> {
  // Get SOL balance
  const balanceRecord = await db.select()
    .from(balances)
    .where(eq(balances.walletId, walletId))
    .limit(1);
  
  const solBalance = balanceRecord.length > 0 ? parseFloat(balanceRecord[0].solBalance) : 0;
  const solPrice = await getSolanaPrice();
  
  // Get token holdings (filter out zero-balance holdings)
  const allHoldings = await db.select()
    .from(tokenHoldings)
    .where(eq(tokenHoldings.walletId, walletId));
  
  const holdings = allHoldings.filter(h => parseFloat(h.amount) > 0);

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
  
  // ✅ FIX: Fetch live prices for ALL holdings
  const mints = holdings.map(h => h.mint);
  const priceMap = await getTokenPrices(mints);
  
  // ✅ FIX: Update in-memory holdings with fresh prices FIRST (before DB update)
  for (const holding of holdings) {
    const livePrice = priceMap.get(holding.mint);
    if (livePrice !== null && livePrice !== undefined) {
      holding.lastPriceUsd = livePrice.toFixed(6);
      holding.lastPriceUpdatedAt = new Date();
    }
  }
  
  // ✅ FIX: Update DB with fresh prices (fire-and-forget for performance)
  // Database updates happen async to not block monitor display
  for (const holding of holdings) {
    const livePrice = priceMap.get(holding.mint);
    if (livePrice !== null && livePrice !== undefined) {
      db.update(tokenHoldings)
        .set({
          lastPriceUsd: livePrice.toFixed(6),
          lastPriceUpdatedAt: new Date()
        })
        .where(eq(tokenHoldings.id, holding.id))
        .catch(err => console.error(`Failed to update price for ${holding.symbol}:`, err));
    }
  }

  // ✅ NEW: Calculate total portfolio value (all holdings → USD → SOL)
  let totalPortfolioValueUsd = 0;
  for (const h of holdings) {
    const holdingAmount = parseFloat(h.amount);
    const holdingPrice = parseFloat(h.lastPriceUsd || "0") || parseFloat(h.averageEntryPrice || "0");
    totalPortfolioValueUsd += holdingAmount * holdingPrice;
  }
  const totalPortfolioValueSol = totalPortfolioValueUsd / solPrice;
  
  // Clamp index to valid range
  if (tokenIndex >= holdings.length) {
    tokenIndex = 0;
  }

  const holding = holdings[tokenIndex];
  const amount = parseFloat(holding.amount);
  const pendingAmount = parseFloat(holding.pendingInAmount || "0");
  const totalAmount = amount + pendingAmount;
  const entryPrice = parseFloat(holding.averageEntryPrice || "0");
  
  // ✅ FIX: Use live price from in-memory updated holding (already refreshed above)
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
  
  // ✅ NEW: Show total portfolio value (if all sold → SOL equivalent)
  message += `💼 *Portfolio Value:* ${totalPortfolioValueSol.toFixed(4)} SOL ($${totalPortfolioValueUsd.toFixed(2)})\n`;
  message += `💰 *SOL Balance:* ${solBalance.toFixed(4)} SOL ($${(solBalance * solPrice).toFixed(2)})\n`;
  message += `💵 *Total Wallet:* ${(solBalance + totalPortfolioValueSol).toFixed(4)} SOL\n\n`;
  
  message += `_Auto-refreshing every 20s..._\n`;
  message += `Use /stopmonitor to stop`;
  
  return message;
}

function buildMonitorKeyboard(currentIndex: number, totalTokens: number, tradeMode: 'buy' | 'sell', tokenMint: string): InlineKeyboard {
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
  // Empty keyboard for when all tokens are sold
  const keyboard = new InlineKeyboard();
  // No interactive buttons - user should paste token address or use /stopmonitor
  return keyboard;
}

export async function handleMonitorCallback(ctx: Context, data: string) {
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;
  
  console.log(`[MONITOR] Received callback: "${data}"`);
  
  try {
    // Get active monitor session
    const sessions = await db.select()
      .from(monitorSessions)
      .where(and(
        eq(monitorSessions.chatId, chatId),
        eq(monitorSessions.isActive, true)
      ))
      .limit(1);
    
    if (sessions.length === 0) {
      console.log(`[MONITOR] No active session found for chat ${chatId}`);
      await ctx.answerCallbackQuery("❌ No active monitor session found");
      return;
    }
    
    const session = sessions[0];
    console.log(`[MONITOR] Session found: index=${session.currentTokenIndex}, mode=${session.tradeMode}`);
    
    // Handle navigation
    if (data === "monitor_prev") {
      console.log(`[MONITOR] Handling PREV navigation`);
      const currentIndex = parseInt(session.currentTokenIndex);
      const allHoldings = await db.select()
        .from(tokenHoldings)
        .where(eq(tokenHoldings.walletId, session.walletId));
      
      // CRITICAL: Filter out zero-balance holdings to match buildMonitorMessage
      const holdings = allHoldings.filter(h => parseFloat(h.amount) > 0);
      
      if (holdings.length === 0) {
        // Show "All tokens sold" message with empty keyboard (best-effort)
        try {
          const message = await buildMonitorMessage(session.walletId, 0, session.tradeMode as 'buy' | 'sell');
          const keyboard = buildEmptyMonitorKeyboard();
          
          await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
        } catch (editError: any) {
          // Ignore edit failures - polling will refresh soon
          if (!editError?.description?.includes("message is not modified")) {
            console.log(`[MONITOR] Empty state edit failed (polling will fix):`, editError.message);
          }
        }
        
        await ctx.answerCallbackQuery("All tokens sold!");
        return;
      }
      
      // CRITICAL: Clamp index to valid range before calculating newIndex
      const safeCurrentIndex = currentIndex >= holdings.length ? 0 : currentIndex;
      const newIndex = safeCurrentIndex === 0 ? holdings.length - 1 : safeCurrentIndex - 1;
      
      await db.update(monitorSessions)
        .set({ 
          currentTokenIndex: newIndex.toString(),
          updatedAt: new Date()
        })
        .where(eq(monitorSessions.id, session.id));
      
      // Try to update message immediately for instant UX (best-effort)
      // If it fails (race with polling), polling will fix it soon - no big deal
      try {
        const message = await buildMonitorMessage(session.walletId, newIndex, session.tradeMode as 'buy' | 'sell');
        const keyboard = buildMonitorKeyboard(newIndex, holdings.length, session.tradeMode as 'buy' | 'sell', holdings[newIndex].mint);
        
        await ctx.editMessageText(message, {
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
      } catch (editError: any) {
        // Ignore edit failures - polling will refresh soon
        if (!editError?.description?.includes("message is not modified")) {
          console.log(`[MONITOR] Navigation edit failed (polling will fix):`, editError.message);
        }
      }
      
      await ctx.answerCallbackQuery();
    } else if (data === "monitor_next") {
      const currentIndex = parseInt(session.currentTokenIndex);
      const allHoldings = await db.select()
        .from(tokenHoldings)
        .where(eq(tokenHoldings.walletId, session.walletId));
      
      // CRITICAL: Filter out zero-balance holdings to match buildMonitorMessage
      const holdings = allHoldings.filter(h => parseFloat(h.amount) > 0);
      
      if (holdings.length === 0) {
        // Show "All tokens sold" message with empty keyboard (best-effort)
        try {
          const message = await buildMonitorMessage(session.walletId, 0, session.tradeMode as 'buy' | 'sell');
          const keyboard = buildEmptyMonitorKeyboard();
          
          await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
        } catch (editError: any) {
          // Ignore edit failures - polling will refresh soon
          if (!editError?.description?.includes("message is not modified")) {
            console.log(`[MONITOR] Empty state edit failed (polling will fix):`, editError.message);
          }
        }
        
        await ctx.answerCallbackQuery("All tokens sold!");
        return;
      }
      
      // CRITICAL: Clamp index to valid range before calculating newIndex
      const safeCurrentIndex = currentIndex >= holdings.length ? 0 : currentIndex;
      const newIndex = (safeCurrentIndex + 1) % holdings.length;
      
      await db.update(monitorSessions)
        .set({ 
          currentTokenIndex: newIndex.toString(),
          updatedAt: new Date()
        })
        .where(eq(monitorSessions.id, session.id));
      
      // Try to update message immediately for instant UX (best-effort)
      // If it fails (race with polling), polling will fix it soon - no big deal
      try {
        const message = await buildMonitorMessage(session.walletId, newIndex, session.tradeMode as 'buy' | 'sell');
        const keyboard = buildMonitorKeyboard(newIndex, holdings.length, session.tradeMode as 'buy' | 'sell', holdings[newIndex].mint);
        
        await ctx.editMessageText(message, {
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
      } catch (editError: any) {
        // Ignore edit failures - polling will refresh soon
        if (!editError?.description?.includes("message is not modified")) {
          console.log(`[MONITOR] Navigation edit failed (polling will fix):`, editError.message);
        }
      }
      
      await ctx.answerCallbackQuery();
    } else if (data.startsWith("monitor_toggle_")) {
      const newMode = data.includes("_buy_") ? 'buy' : 'sell';
      const tokenMint = data.split("_").pop() || "";
      
      const currentIndex = parseInt(session.currentTokenIndex);
      const allHoldings = await db.select()
        .from(tokenHoldings)
        .where(eq(tokenHoldings.walletId, session.walletId));
      
      // CRITICAL: Filter out zero-balance holdings to match buildMonitorMessage
      const holdings = allHoldings.filter(h => parseFloat(h.amount) > 0);
      
      if (holdings.length === 0) {
        // Show "All tokens sold" message with empty keyboard (best-effort)
        try {
          const message = await buildMonitorMessage(session.walletId, 0, session.tradeMode as 'buy' | 'sell');
          const keyboard = buildEmptyMonitorKeyboard();
          
          await ctx.editMessageText(message, {
            parse_mode: "Markdown",
            reply_markup: keyboard
          });
        } catch (editError: any) {
          // Ignore edit failures - polling will refresh soon
          if (!editError?.description?.includes("message is not modified")) {
            console.log(`[MONITOR] Empty state edit failed (polling will fix):`, editError.message);
          }
        }
        
        await ctx.answerCallbackQuery("All tokens sold!");
        return;
      }
      
      // CRITICAL: Clamp index to valid range before using
      const safeIndex = currentIndex >= holdings.length ? 0 : currentIndex;
      
      await db.update(monitorSessions)
        .set({ 
          tradeMode: newMode,
          currentTokenIndex: safeIndex.toString(),
          updatedAt: new Date()
        })
        .where(eq(monitorSessions.id, session.id));
      
      // Try to update message immediately for instant UX (best-effort)
      try {
        const message = await buildMonitorMessage(session.walletId, safeIndex, newMode);
        const keyboard = buildMonitorKeyboard(safeIndex, holdings.length, newMode, holdings[safeIndex].mint);
        
        await ctx.editMessageText(message, {
          parse_mode: "Markdown",
          reply_markup: keyboard
        });
      } catch (editError: any) {
        // Ignore edit failures - polling will refresh soon
        if (!editError?.description?.includes("message is not modified")) {
          console.log(`[MONITOR] Mode toggle edit failed (polling will fix):`, editError.message);
        }
      }
      
      await ctx.answerCallbackQuery(`Switched to ${newMode.toUpperCase()} mode`);
    } else if (data.startsWith("monitor_buy_")) {
      // Quick BUY: monitor_buy_{tokenMint}_{amount}
      const parts = data.split("_");
      const tokenMint = parts[2];
      const solAmount = parts[3];
      
      await ctx.answerCallbackQuery("🟢 Executing BUY order...");
      
      // Get wallet for telegram user
      const telegramUserId = ctx.from?.id.toString();
      if (!telegramUserId) {
        await ctx.answerCallbackQuery("❌ User not found");
        return;
      }
      
      const wallet = await getWallet(telegramUserId);
      if (!wallet) {
        await ctx.answerCallbackQuery("❌ Wallet not found");
        return;
      }
      
      // Execute instant buy (DON'T pass messageId - let polling handle monitor refresh)
      const result = await createInstantBuyOrder({
        walletId: wallet.id,
        telegramUserId,
        tokenAddress: tokenMint,
        solAmount,
      });
      
      if (!result.success) {
        await ctx.answerCallbackQuery(`❌ BUY Failed: ${result.error || "Unknown error"}`);
        return;
      }
      
      // Send notification (polling will auto-refresh monitor)
      await ctx.answerCallbackQuery(`✅ BUY: ${solAmount} SOL`);
    } else if (data.startsWith("monitor_sell_")) {
      // Quick SELL: monitor_sell_{tokenMint}_{percentage}
      const parts = data.split("_");
      const tokenMint = parts[2];
      const percentage = parseInt(parts[3]);
      
      await ctx.answerCallbackQuery("🔴 Executing SELL order...");
      
      // Get wallet for telegram user
      const telegramUserId = ctx.from?.id.toString();
      if (!telegramUserId) {
        await ctx.answerCallbackQuery("❌ User not found");
        return;
      }
      
      const wallet = await getWallet(telegramUserId);
      if (!wallet) {
        await ctx.answerCallbackQuery("❌ Wallet not found");
        return;
      }
      
      // Get current token holdings to calculate amount
      const holdingRecords = await db.select()
        .from(tokenHoldings)
        .where(and(
          eq(tokenHoldings.walletId, wallet.id),
          eq(tokenHoldings.mint, tokenMint)
        ))
        .limit(1);
      
      if (holdingRecords.length === 0) {
        await ctx.answerCallbackQuery("❌ No holdings found for this token");
        return;
      }
      
      const holding = holdingRecords[0];
      const confirmedAmount = parseFloat(holding.amount);
      const pendingAmount = parseFloat(holding.pendingInAmount || '0');
      
      // CRITICAL: Guard against selling while tokens are still pending confirmation
      if (confirmedAmount <= 0) {
        if (pendingAmount > 0) {
          await ctx.answerCallbackQuery("⏳ Tokens still confirming on-chain. Please wait ~10 seconds.");
        } else {
          await ctx.answerCallbackQuery("❌ No confirmed tokens to sell");
        }
        return;
      }
      
      const sellAmount = (confirmedAmount * percentage) / 100;
      
      if (sellAmount <= 0) {
        await ctx.answerCallbackQuery("❌ Insufficient token balance");
        return;
      }
      
      // Execute instant sell (DON'T pass messageId - let polling handle monitor refresh)
      const result = await createInstantSellOrder({
        walletId: wallet.id,
        telegramUserId,
        tokenAddress: tokenMint,
        tokenAmount: sellAmount.toString(),
      });
      
      if (!result.success) {
        await ctx.answerCallbackQuery(`❌ SELL Failed: ${result.error || "Unknown error"}`);
        return;
      }
      
      // Send notification (polling will auto-refresh monitor)
      await ctx.answerCallbackQuery(`✅ SELL: ${percentage}% (${sellAmount.toFixed(4)} tokens)`);
    } else if (data.startsWith("monitor_custom_buy_")) {
      // Custom SOL amount buy
      const tokenMint = data.replace("monitor_custom_buy_", "");
      const userId = ctx.from?.id.toString();
      
      if (userId) {
        setConversationState(userId, 'waiting_custom_buy_amount');
        customBuyContractAddress.set(userId, tokenMint);
        
        await ctx.answerCallbackQuery();
        await ctx.reply(
          `✏️ *Enter Custom SOL Amount*\n\n` +
          `Please enter the amount of SOL you want to spend.\n\n` +
          `Example: \`0.15\` or \`0.075\``,
          { parse_mode: "Markdown" }
        );
      }
    } else {
      await ctx.answerCallbackQuery();
    }
  } catch (error) {
    console.error("Error in monitor callback:", error);
    await ctx.answerCallbackQuery("❌ Failed to process action");
  }
}

export async function handleStopMonitor(ctx: Context) {
  if (!ctx.from) return;
  
  const chatId = ctx.chat?.id.toString();
  if (!chatId) return;
  
  try {
    // Get active monitor session
    const sessions = await db.select()
      .from(monitorSessions)
      .where(and(
        eq(monitorSessions.chatId, chatId),
        eq(monitorSessions.isActive, true)
      ))
      .limit(1);
    
    if (sessions.length === 0) {
      await ctx.reply("❌ No active monitor session found");
      return;
    }
    
    const session = sessions[0];
    
    // Deactivate session
    await db.update(monitorSessions)
      .set({ isActive: false })
      .where(eq(monitorSessions.id, session.id));
    
    // Unpin the monitor message first
    try {
      await ctx.api.unpinChatMessage(parseInt(chatId), parseInt(session.messageId));
      console.log(`📌 Monitor message unpinned for chat ${chatId}`);
    } catch (unpinError: any) {
      console.warn(`⚠️ Failed to unpin monitor message:`, unpinError.message);
      // Continue even if unpinning fails
    }
    
    // Delete the monitor message
    try {
      await ctx.api.deleteMessage(chatId, parseInt(session.messageId));
    } catch (deleteError) {
      console.log("Could not delete monitor message (may already be deleted)");
    }
    
    await ctx.reply("✅ Monitor stopped");
    console.log(`✅ Monitor session stopped for chat ${chatId}`);
  } catch (error) {
    console.error("Error in /stopmonitor:", error);
    await ctx.reply("❌ Failed to stop monitoring");
  }
}
