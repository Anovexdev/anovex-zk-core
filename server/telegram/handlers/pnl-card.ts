import { Context, InputFile } from "grammy";
import { getWallet } from "../../telegram-bot.js";
import { createCanvas, type CanvasRenderingContext2D } from "canvas";

export async function handlePnlCard(ctx: Context) {
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

    // Fetch portfolio data
    const response = await fetch(`http://localhost:5000/api/portfolio?walletId=${wallet.id}`);
    const data = await response.json();

    if (!data.success) {
      await ctx.reply("❌ Failed to generate PnL card.");
      return;
    }

    const { summary, holdings } = data;

    // Generate landscape PnL card (1200x630px)
    const canvas = createCanvas(1200, 630);
    const ctx2d = canvas.getContext("2d") as any;

    // Dark gradient background (deep purple to black)
    const gradient = ctx2d.createLinearGradient(0, 0, 1200, 630);
    gradient.addColorStop(0, "#1a0033");
    gradient.addColorStop(0.5, "#0a0015");
    gradient.addColorStop(1, "#1a0033");
    ctx2d.fillStyle = gradient;
    ctx2d.fillRect(0, 0, 1200, 630);

    // Subtle grid pattern overlay
    ctx2d.strokeStyle = "rgba(124, 58, 237, 0.1)";
    ctx2d.lineWidth = 1;
    for (let i = 0; i < 1200; i += 40) {
      ctx2d.beginPath();
      ctx2d.moveTo(i, 0);
      ctx2d.lineTo(i, 630);
      ctx2d.stroke();
    }
    for (let i = 0; i < 630; i += 40) {
      ctx2d.beginPath();
      ctx2d.moveTo(0, i);
      ctx2d.lineTo(1200, i);
      ctx2d.stroke();
    }

    // Header with brand styling
    ctx2d.fillStyle = "#ffffff";
    ctx2d.font = "bold 52px sans-serif";
    ctx2d.fillText("ANOVEX", 50, 85);
    
    ctx2d.font = "28px sans-serif";
    ctx2d.fillStyle = "#a78bfa";
    ctx2d.fillText("STEALTH TRADING PERFORMANCE", 50, 125);

    // Stats cards
    const cardY = 150;
    const cardHeight = 200;
    const cardWidth = 330;

    // Total PNL Card
    drawStatCard(ctx2d, 50, cardY, cardWidth, cardHeight, 
      "Total PnL", 
      `$${summary.totalPnl}`,
      parseFloat(summary.totalPnl) >= 0 ? "#10b981" : "#ef4444"
    );

    // Win Rate Card
    drawStatCard(ctx2d, 430, cardY, cardWidth, cardHeight, 
      "Win Rate", 
      `${summary.winRate}%`,
      "#a78bfa"
    );

    // Total Trades Card
    drawStatCard(ctx2d, 810, cardY, cardWidth, cardHeight, 
      "Total Trades", 
      `${summary.totalTrades}`,
      "#ffffff"
    );

    // Top performers section
    ctx2d.fillStyle = "#ffffff";
    ctx2d.font = "bold 26px sans-serif";
    ctx2d.fillText("TOP HOLDINGS", 50, 420);

    // Filter out SOL (it's balance, not a token holding with PnL)
    const tokenHoldings = holdings.filter((h: any) => h.symbol !== 'SOL');
    const topHoldings = tokenHoldings.slice(0, 4);
    
    if (topHoldings.length > 0) {
      let xPos = 50;
      topHoldings.forEach((holding: any, index: number) => {
        const rankBadge = (index + 1).toString();
        const pnlValue = parseFloat(holding.unrealizedPnl);
        const pnlPercentValue = parseFloat(holding.pnlPercent);
        const pnlColor = pnlValue >= 0 ? "#10b981" : "#ef4444";
        
        // Format PnL display with proper signs (fix double-sign bug)
        const pnlDisplay = pnlValue >= 0 
          ? `+$${holding.unrealizedPnl}` 
          : `-$${Math.abs(pnlValue).toFixed(2)}`;
        const pnlPercentDisplay = pnlPercentValue >= 0 
          ? `+${holding.pnlPercent}%` 
          : `${holding.pnlPercent}%`;

        // Rank badge
        ctx2d.fillStyle = "#7c3aed";
        ctx2d.beginPath();
        ctx2d.arc(xPos + 15, 465, 18, 0, Math.PI * 2);
        ctx2d.fill();

        ctx2d.fillStyle = "#ffffff";
        ctx2d.font = "bold 20px sans-serif";
        ctx2d.fillText(rankBadge, xPos + (rankBadge.length > 1 ? 8 : 12), 473);

        // Token symbol
        ctx2d.fillStyle = "#ffffff";
        ctx2d.font = "24px sans-serif";
        ctx2d.fillText(holding.symbol, xPos + 45, 472);

        // PnL value (fixed formatting)
        ctx2d.fillStyle = pnlColor;
        ctx2d.font = "bold 22px sans-serif";
        ctx2d.fillText(pnlDisplay, xPos, 510);

        // PnL percentage (fixed formatting)
        ctx2d.fillStyle = "#a78bfa";
        ctx2d.font = "18px sans-serif";
        ctx2d.fillText(pnlPercentDisplay, xPos, 540);

        xPos += 280;
      });
    } else {
      ctx2d.fillStyle = "#6b7280";
      ctx2d.font = "22px sans-serif";
      ctx2d.fillText("Start trading to build your portfolio", 50, 480);
    }

    // Footer with branding
    ctx2d.fillStyle = "#6b7280";
    ctx2d.font = "20px sans-serif";
    ctx2d.fillText("Privacy-first trading platform", 50, 590);

    ctx2d.fillStyle = "#a78bfa";
    ctx2d.font = "bold 24px sans-serif";
    ctx2d.fillText("@anovexbot", 900, 600);

    // Save and send image
    const buffer = canvas.toBuffer("image/png");
    await ctx.replyWithPhoto(new InputFile(buffer), {
      caption: "📊 Your trading performance card is ready!",
    });
  } catch (error) {
    console.error("Error generating PnL card:", error);
    await ctx.reply("❌ Failed to generate PnL card. Please try again.");
  }
}

function drawStatCard(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  valueColor: string
) {
  // Card background with border
  ctx.fillStyle = "#1a1a2e";
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 16);
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.fillStyle = "#9ca3af";
  ctx.font = "22px sans-serif";
  ctx.fillText(label, x + 20, y + 50);

  // Value
  ctx.fillStyle = valueColor;
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(value, x + 20, y + 120);
}
