import { Context } from "grammy";
import { getWallet } from "../../telegram-bot.js";
import { db } from "../../db";
import { balances, tokenHoldings, transactions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSolanaPrice } from "../../coingecko.js";

export async function handlePortfolio(ctx: Context) {
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

    // Get balance
    const balanceRecord = await db.select()
      .from(balances)
      .where(eq(balances.walletId, wallet.id))
      .limit(1);
    
    const solBalance = balanceRecord.length > 0 ? parseFloat(balanceRecord[0].solBalance) : 0;
    
    // Get SOL price
    const solPrice = await getSolanaPrice();
    const solUsdValue = solBalance * solPrice;
    
    // Get token holdings with current prices
    const holdings = await db.select()
      .from(tokenHoldings)
      .where(eq(tokenHoldings.walletId, wallet.id));
    
    // Calculate unrealized PnL
    let unrealizedPnl = 0;
    let totalTokenValue = 0;
    
    const enrichedHoldings = holdings.map(holding => {
      const amount = parseFloat(holding.amount);
      const pendingAmount = parseFloat(holding.pendingInAmount || "0");
      const totalAmount = amount + pendingAmount; // Show confirmed + pending
      const entryPrice = parseFloat(holding.averageEntryPrice || "0");
      // Fallback to entryPrice if no current price available (unlisted tokens)
      const currentPrice = parseFloat(holding.lastPriceUsd || "0") || entryPrice;
      
      const costBasis = parseFloat(holding.totalCostBasis || "0");
      const currentValue = amount * currentPrice; // Only confirmed tokens for PnL
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? ((pnl / costBasis) * 100) : 0;
      
      unrealizedPnl += pnl;
      totalTokenValue += currentValue;
      
      return {
        symbol: holding.symbol,
        amount: totalAmount.toFixed(4), // Show total (confirmed + pending)
        confirmedAmount: amount.toFixed(4),
        pendingAmount: pendingAmount.toFixed(4),
        hasPending: pendingAmount > 0, // Flag to show pending indicator
        entryPrice: entryPrice.toFixed(6),
        currentPrice: currentPrice.toFixed(6),
        unrealizedPnl: pnl.toFixed(2),
        pnlPercent: pnlPercent.toFixed(2),
      };
    });
    
    // Calculate realized PnL from completed SELL transactions
    const sellTransactions = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.walletId, wallet.id),
        eq(transactions.type, 'sell'),
        eq(transactions.status, 'completed')
      ));
    
    const realizedPnl = sellTransactions.reduce((sum, tx) => {
      return sum + parseFloat(tx.realizedPnl || "0");
    }, 0);
    
    // Calculate win rate
    const profitableSells = sellTransactions.filter(tx => parseFloat(tx.realizedPnl || "0") > 0).length;
    const winRate = sellTransactions.length > 0 ? ((profitableSells / sellTransactions.length) * 100) : 0;
    
    const summary = {
      totalPnl: (unrealizedPnl + realizedPnl).toFixed(2),
      unrealizedPnl: unrealizedPnl.toFixed(2),
      realizedPnl: realizedPnl.toFixed(2),
      winRate: winRate.toFixed(0),
      totalTrades: sellTransactions.length,
    };

    let message = `🔒 *STEALTH PORTFOLIO*\n\n`;

    // Summary stats with privacy-focused presentation
    const totalPnl = parseFloat(summary.totalPnl);
    const pnlPrefix = totalPnl >= 0 ? "+" : "";
    const pnlEmoji = totalPnl >= 0 ? "🟢" : "🔴";
    
    message += `${pnlEmoji} *Total PnL:* ${pnlPrefix}$${summary.totalPnl}\n`;
    message += `📈 *Unrealized:* $${summary.unrealizedPnl}\n`;
    message += `💎 *Realized:* $${summary.realizedPnl}\n`;
    message += `🎯 *Win Rate:* ${summary.winRate}%\n`;
    message += `📊 *Total Trades:* ${summary.totalTrades}\n\n`;

    // Holdings - Always show SOL balance first
    message += `*💼 CURRENT HOLDINGS*\n`;
    
    // 1. SOL Balance (always show)
    message += `\n1. *SOL*\n`;
    message += `   Amount: ${solBalance.toFixed(4)}\n`;
    message += `   Value: $${solUsdValue.toFixed(2)}\n`;
    message += `   Price: $${solPrice.toFixed(2)}\n`;
    
    // 2. Token Holdings (if any)
    if (enrichedHoldings.length > 0) {
      enrichedHoldings.forEach((holding: any, index: number) => {
        const pnlValue = parseFloat(holding.unrealizedPnl);
        const pnlPercentValue = parseFloat(holding.pnlPercent);
        const pnlEmoji = pnlValue >= 0 ? "🟢" : "🔴";
        
        // Format PnL with proper sign handling
        const pnlDisplay = pnlValue >= 0 ? `+$${holding.unrealizedPnl}` : `-$${Math.abs(pnlValue).toFixed(2)}`;
        const pnlPercentDisplay = pnlPercentValue >= 0 ? `+${holding.pnlPercent}%` : `${holding.pnlPercent}%`;
        
        message += `\n${index + 2}. *${holding.symbol}*\n`;
        
        // Show pending indicator if tokens are pending
        if (holding.hasPending) {
          message += `   Amount: ${holding.amount} ⏳\n`;
          message += `   _Confirmed: ${holding.confirmedAmount} | Pending: ${holding.pendingAmount}_\n`;
        } else {
          message += `   Amount: ${holding.amount}\n`;
        }
        
        message += `   Entry: $${holding.entryPrice}\n`;
        message += `   Current: $${holding.currentPrice}\n`;
        message += `   ${pnlEmoji} PNL: ${pnlDisplay} (${pnlPercentDisplay})\n`;
      });
    } else {
      message += `\n*No token holdings*\nPaste a token contract address to start trading!`;
    }

    message += `\n\n💡 Use /pnl to generate a shareable PnL card`;

    await ctx.reply(message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in /portfolio:", error);
    await ctx.reply("❌ Failed to fetch portfolio. Please try again.");
  }
}
