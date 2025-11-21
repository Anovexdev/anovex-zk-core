import fetch from 'node-fetch';

/**
 * Pricing Service - Token price discovery with caching
 * 
 * Strategy:
 * 1. Jupiter Quote API (primary) - Real-time SOL/Solana DEX liquidity
 * 2. Dexscreener API (fallback) - Aggregated price data
 * 3. 60-second cache per mint to control rate limits
 */

interface PriceCache {
  price: number;
  timestamp: number;
}

const priceCache = new Map<string, PriceCache>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get token price in USD using Jupiter Quote API
 * @param mint SPL token mint address
 * @param decimals Token decimals (default: 9 for most SPL tokens)
 * @returns Price in USD or null if not found
 */
async function getJupiterPrice(mint: string, decimals: number = 9): Promise<number | null> {
  try {
    // Jupiter Quote: 1 token → USDC
    // Using 1 token as input amount (scaled by token's actual decimals)
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const ONE_TOKEN = Math.pow(10, decimals); // 1 token scaled to its decimals (e.g., 1B for 9-decimal token)

    const response = await fetch(
      `https://quote-api.jup.ag/v6/quote?inputMint=${mint}&outputMint=${USDC_MINT}&amount=${ONE_TOKEN}&slippageBps=50`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    
    if (!data.outAmount) {
      return null;
    }

    // Convert USDC lamports to USD (USDC has 6 decimals)
    const priceUsd = parseFloat(data.outAmount) / 1_000_000;
    return priceUsd;
  } catch (error) {
    console.error(`[Pricing] Jupiter API error for ${mint}:`, error);
    return null;
  }
}

/**
 * Get token price from Dexscreener (fallback)
 * @param mint SPL token mint address
 * @returns Price in USD or null if not found
 */
async function getDexscreenerPrice(mint: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as any;
    
    if (!data.pairs || data.pairs.length === 0) {
      return null;
    }

    // Get highest liquidity pair for most accurate price
    const sortedPairs = data.pairs.sort((a: any, b: any) => 
      parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
    );

    const priceUsd = parseFloat(sortedPairs[0].priceUsd);
    return isNaN(priceUsd) ? null : priceUsd;
  } catch (error) {
    console.error(`[Pricing] Dexscreener API error for ${mint}:`, error);
    return null;
  }
}

/**
 * Known stablecoins with fixed $1 peg
 * These are always priced at $1 regardless of DEX liquidity
 */
const STABLECOINS: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.0, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0, // USDT
  '7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT': 1.0, // UXD Protocol
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 1.0, // Bonk-pegged USD
};

/**
 * Get token price in USD with caching
 * Priority: 
 *   1. Stablecoin hardcoding ($1 for USDC/USDT/etc)
 *   2. Dexscreener (primary) - returns price per token directly, no decimals needed
 * 
 * @param mint SPL token mint address
 * @returns Price in USD per token, or null if not available
 */
export async function getTokenPrice(mint: string): Promise<number | null> {
  // ✅ FIX: Check stablecoin hardcoding first
  if (STABLECOINS[mint]) {
    return STABLECOINS[mint];
  }
  
  // Check cache
  const cached = priceCache.get(mint);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.price;
  }

  // Use Dexscreener (returns price per token, no decimals needed)
  let price = await getDexscreenerPrice(mint);

  // Cache result (even if null, to prevent rapid retries)
  if (price !== null) {
    priceCache.set(mint, {
      price,
      timestamp: Date.now()
    });
  }

  return price;
}

/**
 * Get multiple token prices in parallel
 * @param mints Array of SPL token mint addresses
 * @returns Map of mint → price (null if not found)
 */
export async function getTokenPrices(mints: string[]): Promise<Map<string, number | null>> {
  const pricePromises = mints.map(async (mint) => {
    const price = await getTokenPrice(mint);
    return { mint, price };
  });

  const results = await Promise.all(pricePromises);
  
  const priceMap = new Map<string, number | null>();
  for (const { mint, price } of results) {
    priceMap.set(mint, price);
  }

  return priceMap;
}

interface MetadataCache {
  metadata: { price: number; logoURI?: string };
  timestamp: number;
}

const metadataCache = new Map<string, MetadataCache>();

/**
 * Get token metadata (price + logo) from Dexscreener with caching and retry
 * @param mint SPL token mint address
 * @returns Object with price and logoURI, or null if not found
 */
export async function getTokenMetadata(mint: string): Promise<{ price: number; logoURI?: string } | null> {
  // Check cache first
  const cached = metadataCache.get(mint);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.metadata;
  }

  let lastError: any = null;
  
  // Try up to 2 times with exponential backoff
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (!response.ok) {
        if (attempt < 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms backoff
          continue;
        }
        return null;
      }

      const data = await response.json() as any;
      
      if (!data.pairs || data.pairs.length === 0) {
        return null;
      }

      const sortedPairs = data.pairs.sort((a: any, b: any) => 
        parseFloat(b.liquidity?.usd || '0') - parseFloat(a.liquidity?.usd || '0')
      );

      const pair = sortedPairs[0];
      const priceUsd = parseFloat(pair.priceUsd);
      
      if (isNaN(priceUsd)) {
        return null;
      }

      const metadata = {
        price: priceUsd,
        logoURI: pair.baseToken?.logoURI
      };

      // Cache successful result
      metadataCache.set(mint, {
        metadata,
        timestamp: Date.now()
      });

      return metadata;
    } catch (error) {
      lastError = error;
      if (attempt < 1) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms backoff
        continue;
      }
    }
  }

  console.error(`[Pricing] Dexscreener metadata error for ${mint} after retries:`, lastError);
  return null;
}

/**
 * Clear price cache (for testing/maintenance)
 */
export function clearPriceCache() {
  priceCache.clear();
}
