import { Context, InlineKeyboard } from "grammy";
import { getWallet } from "../../telegram-bot.js";
import { getTokenMetadataWithFallback } from "../../helius-metadata.js";
import { getTokenPrice } from "../../pricing.js";

export async function handleTradeCA(ctx: Context, contractAddressOverride?: string) {
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

    const telegramUserId = ctx.from.id.toString();
    const contractAddress = contractAddressOverride || (ctx.message?.text?.trim());
    
    // Validate contract address exists
    if (!contractAddress) {
      if (isCallback) {
        await ctx.answerCallbackQuery("❌ Invalid contract address");
        callbackAnswered = true;
      } else {
        await ctx.reply("❌ Invalid contract address. Please paste a valid Solana token address.");
      }
      return;
    }
    
    const wallet = await getWallet(telegramUserId);
    
    if (!wallet) {
      const message = `⚠️ *No Wallet Found*\n\n` +
        `You need to create a wallet first.\n\n` +
        `Use /start to generate or import a wallet.`;
      
      if (isCallback) {
        await ctx.answerCallbackQuery("⚠️ No wallet found");
        callbackAnswered = true;
        await ctx.reply(message, { parse_mode: "Markdown" });
      } else {
        await ctx.reply(message, { parse_mode: "Markdown" });
      }
      return;
    }

    // Send instant loading message FIRST (don't make user wait!)
    const loadingMsg = await ctx.reply(
      `⏳ *Loading token info...*\n\n\`${contractAddress}\`\n\n_Fetching data from multi-provider network..._`,
      { parse_mode: "Markdown" }
    );
    
    // 🚀 PARALLEL EXECUTION - Fetch ALL data at once (2-5s instead of 17-35s)
    const [metadataResult, priceResult, marketResult, holdingResult] = await Promise.allSettled([
      // 1. Token metadata (Helius → Dexscreener → CoinGecko → Jupiter)
      getTokenMetadataWithFallback(contractAddress),
      
      // 2. Token price (with 60s cache)
      getTokenPrice(contractAddress),
      
      // 3. Market data from Dexscreener (liquidity, volume, MC)
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`)
        .then(res => {
          if (!res.ok) {
            console.log(`[Trade] Dexscreener HTTP ${res.status} for ${contractAddress}`);
            return null;
          }
          return res.json();
        })
        .catch((err) => {
          console.error('[Trade] Dexscreener fetch failed (non-critical):', err);
          return null;
        }),
      
      // 4. User holdings
      fetch(`http://localhost:5000/api/portfolio?walletId=${wallet.id}`)
        .then(res => res.json())
        .catch((err) => {
          console.error('[Trade] Holdings fetch failed (non-critical):', err);
          return { success: false };
        })
    ]);
    
    // Extract metadata (REQUIRED)
    let tokenMetadata;
    if (metadataResult.status === 'rejected' || !metadataResult.value) {
      const errorMsg = metadataResult.status === 'rejected' 
        ? (metadataResult.reason?.message || String(metadataResult.reason) || 'Unknown error')
        : 'Metadata services unavailable.';
      
      console.error(`[Trade] Metadata fetch failed: ${errorMsg}`);
      
      await ctx.api.editMessageText(
        loadingMsg.chat.id,
        loadingMsg.message_id,
        `❌ Token not found. Please check the contract address.\n\n${errorMsg}`
      );
      if (isCallback) {
        await ctx.answerCallbackQuery("❌ Token not found");
        callbackAnswered = true;
      }
      return;
    }
    tokenMetadata = metadataResult.value;
    
    // Extract price (REQUIRED)
    const tokenPrice = priceResult.status === 'fulfilled' ? priceResult.value : null;
    if (!tokenPrice) {
      const priceError = priceResult.status === 'rejected' 
        ? String(priceResult.reason)
        : 'Price service returned null';
      console.error(`[Trade] Price fetch failed for ${contractAddress}:`, priceError);
      
      await ctx.api.editMessageText(
        loadingMsg.chat.id,
        loadingMsg.message_id,
        `⚠️ *${tokenMetadata.symbol}*\n\n\`${contractAddress}\`\n\n❌ Price data unavailable. Token may have low liquidity.`
      );
      if (isCallback) {
        await ctx.answerCallbackQuery("❌ Price unavailable");
        callbackAnswered = true;
      }
      return;
    }
    
    // Extract market data (OPTIONAL - silently fail in UX, errors already logged in catch above)
    let marketData: { liquidity?: number; volume24h?: number; marketCap?: number } = {};
    if (marketResult.status === 'fulfilled' && marketResult.value?.pairs?.[0]) {
      const pair = marketResult.value.pairs[0];
      marketData = {
        liquidity: pair.liquidity?.usd || 0,
        volume24h: pair.volume?.h24 || 0,
        marketCap: pair.fdv || 0
      };
    } else if (marketResult.status === 'fulfilled' && !marketResult.value) {
      console.log(`[Trade] Dexscreener returned null/empty for ${contractAddress}`);
    } else if (marketResult.status === 'fulfilled' && marketResult.value && !marketResult.value.pairs?.[0]) {
      console.log(`[Trade] Dexscreener returned no pairs for ${contractAddress}`);
    }
    
    // Extract holdings (OPTIONAL - silently fail in UX, errors already logged in catch above)
    let holdingInfo = '';
    if (holdingResult.status === 'fulfilled' && holdingResult.value?.success) {
      const portfolioData = holdingResult.value;
      const holding = portfolioData.holdings.find((h: any) => 
        h.mint === contractAddress || h.contractAddress === contractAddress
      );
      
      if (holding) {
        const amount = parseFloat(holding.amount || '0');
        const confirmedAmount = parseFloat(holding.confirmedAmount || holding.amount || '0');
        const pendingAmount = parseFloat(holding.pendingAmount || '0');
        
        if (pendingAmount > 0) {
          holdingInfo = `\n💼 *Your Holdings:* ${confirmedAmount.toFixed(4)} ⏳ (+${pendingAmount.toFixed(4)} pending)\n`;
        } else if (amount > 0) {
          holdingInfo = `\n💼 *Your Holdings:* ${amount.toFixed(4)} ${tokenMetadata.symbol}\n`;
        }
      }
    } else if (holdingResult.status === 'fulfilled' && !holdingResult.value?.success) {
      // API responded but returned success: false (already logged above in catch)
      console.log('[Trade] Holdings API returned success: false');
    }

    // Build rich token card
    let message = `🪙 *${tokenMetadata.symbol}*\n\n`;
    message += `\`${contractAddress}\`\n`;
    message += holdingInfo; // Show holdings if user has any
    message += `\n💵 Price: $${tokenPrice.toFixed(6)}\n`;
    
    // Add market data if available (from Dexscreener)
    if (marketData.marketCap && marketData.marketCap > 0) {
      message += `📊 MC: $${formatNumber(marketData.marketCap)}\n`;
    }
    if (marketData.liquidity && marketData.liquidity > 0) {
      message += `💧 Liquidity: $${formatNumber(marketData.liquidity)}\n`;
    }
    if (marketData.volume24h && marketData.volume24h > 0) {
      message += `🔄 24h Volume: $${formatNumber(marketData.volume24h)}\n`;
    }

    // Create inline keyboard with preset amounts
    const keyboard = new InlineKeyboard()
      .text("0.1 SOL", `buy_${contractAddress}_0.1`)
      .text("0.25 SOL", `buy_${contractAddress}_0.25`)
      .text("0.5 SOL", `buy_${contractAddress}_0.5`)
      .row()
      .text("1 SOL", `buy_${contractAddress}_1`)
      .text("2 SOL", `buy_${contractAddress}_2`)
      .text("5 SOL", `buy_${contractAddress}_5`)
      .row()
      .text("✏️ Custom SOL", `custom_buy_${contractAddress}`)
      .text("🔴 SELL", `sell_mode_${contractAddress}`);

    // Edit the loading message with actual token data
    await ctx.api.editMessageText(
      loadingMsg.chat.id,
      loadingMsg.message_id,
      message,
      {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }
    );
    
    // Acknowledge callback if this was triggered by button
    if (isCallback) {
      await ctx.answerCallbackQuery("🔷 Token info loaded");
      callbackAnswered = true;
    }
  } catch (error) {
    console.error("Error in trade CA handler:", error);
    
    if (isCallback && !callbackAnswered) {
      try {
        await ctx.answerCallbackQuery("❌ Failed to fetch token info");
        callbackAnswered = true;
      } catch (ackError) {
        console.error("Failed to acknowledge callback:", ackError);
      }
    } else if (!isCallback) {
      await ctx.reply("❌ Failed to fetch token info. Please check the contract address.");
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

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(2) + "K";
  }
  return num.toFixed(2);
}
