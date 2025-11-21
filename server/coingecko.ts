/**
 * CoinGecko API integration for real-time SOL/USD price
 * Free tier: No API key required, ~10-50 calls/min
 * Implements 5-minute caching to avoid rate limits
 */

import fetch from "node-fetch";

interface PriceCache {
  price: number;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let priceCache: PriceCache | null = null;

const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

/**
 * Get current SOL/USD price from CoinGecko
 * Returns cached price if less than 5 minutes old
 */
export async function getSolanaPrice(): Promise<number> {
  // Return cached price if valid
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.price;
  }
  
  try {
    const response = await fetch(
      `${COINGECKO_API}?ids=solana&vs_currencies=usd`
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data: any = await response.json();
    const price = data.solana?.usd;
    
    if (!price || typeof price !== 'number') {
      throw new Error("Invalid price data from CoinGecko");
    }
    
    // Update cache
    priceCache = {
      price,
      timestamp: Date.now(),
    };
    
    return price;
  } catch (error) {
    console.error("Failed to fetch SOL price from CoinGecko:", error);
    
    // Return cached price if available (even if expired)
    if (priceCache) {
      console.warn("Using stale price cache due to API error");
      return priceCache.price;
    }
    
    // Fallback price if no cache available
    console.warn("Using fallback SOL price: $150");
    return 150; // Fallback price
  }
}

/**
 * Convert SOL amount to USD
 */
export async function solToUsd(solAmount: number): Promise<number> {
  const price = await getSolanaPrice();
  return solAmount * price;
}

/**
 * Convert USD amount to SOL
 */
export async function usdToSol(usdAmount: number): Promise<number> {
  const price = await getSolanaPrice();
  return usdAmount / price;
}
