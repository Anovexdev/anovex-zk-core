// Helius Token Metadata Service
// Fetch token symbol, name, decimals, and logo using Helius DAS API

import { getTokenDecimals } from "./jupiter";
import { validateTokenDecimals } from "./token-metadata";

interface TokenMetadata {
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

/**
 * Fetch token metadata from Helius DAS (Digital Asset Standard) API
 * More reliable than Dexscreener for Solana tokens
 */
export async function getTokenMetadata(mintAddress: string): Promise<TokenMetadata | null> {
  try {
    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
      console.warn('[Helius] API key not found, cannot fetch token metadata');
      return null;
    }

    // Try Helius DAS API endpoint (correct format)
    const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-metadata',
        method: 'getAsset',
        params: {
          id: mintAddress,
          displayOptions: {
            showCollectionMetadata: true,
            showFungible: true
          }
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Helius] HTTP ${response.status}: ${errorText}`);
      console.error(`[Helius] URL used: ${url.replace(apiKey, 'REDACTED')}`);
      return null;
    }

    const data = await response.json();
    
    if (data.error) {
      console.error('[Helius] API error:', data.error);
      return null;
    }

    const asset = data.result;
    if (!asset) {
      console.warn(`[Helius] No asset data found for ${mintAddress}`);
      return null;
    }

    // Extract metadata from DAS response
    const content = asset.content;
    const tokenInfo = asset.token_info;

    // CRITICAL: Handle Helius decimals (may be string "9" or undefined)
    const rawDecimals = tokenInfo?.decimals;
    
    // Check for missing or empty decimals (before Number() conversion!)
    if (rawDecimals === undefined || rawDecimals === null ||
        (typeof rawDecimals === 'string' && rawDecimals.trim() === '')) {
      console.warn(`[Helius] No valid decimals provided for ${mintAddress} - triggering fallback`);
      return null; // Trigger Dexscreener fallback
    }
    
    // Convert to number and validate (empty strings already caught above)
    const parsedDecimals = Number(rawDecimals);
    const decimalsValidation = validateTokenDecimals(parsedDecimals, 'Helius');
    if (decimalsValidation.kind === 'error') {
      console.error(`[Helius] ❌ ${decimalsValidation.reason} - triggering fallback`);
      return null; // Trigger Dexscreener fallback (not hard throw!)
    }

    const metadata: TokenMetadata = {
      symbol: content?.metadata?.symbol || tokenInfo?.symbol || 'UNKNOWN',
      name: content?.metadata?.name || 'Unknown Token',
      decimals: decimalsValidation.decimals, // ✅ Validated!
      logoURI: content?.links?.image || content?.files?.[0]?.uri,
    };

    console.log(`[Helius] ✅ Fetched metadata for ${mintAddress}: ${metadata.symbol}`);
    return metadata;

  } catch (error: any) {
    console.error('[Helius] Error fetching token metadata:', error.message);
    return null;
  }
}

/**
 * Fallback 2: Try CoinGecko API
 */
async function getTokenMetadataFromCoinGecko(mintAddress: string): Promise<Partial<TokenMetadata> | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/solana/contract/${mintAddress}`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) {
      console.warn(`[CoinGecko] HTTP ${response.status} for ${mintAddress}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.symbol && data.name) {
      console.log(`[CoinGecko] ✅ Found metadata: ${data.symbol.toUpperCase()}`);
      return {
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        logoURI: data.image?.large || data.image?.small,
      };
    }
    
    return null;
  } catch (error: any) {
    console.warn(`[CoinGecko] Error: ${error.message}`);
    return null;
  }
}

/**
 * Fallback 3: Try Jupiter Token List API
 */
async function getTokenMetadataFromJupiter(mintAddress: string): Promise<Partial<TokenMetadata> | null> {
  try {
    const response = await fetch('https://token.jup.ag/all');
    if (!response.ok) {
      console.warn(`[Jupiter] HTTP ${response.status}`);
      return null;
    }
    
    const tokens = await response.json();
    const token = tokens.find((t: any) => t.address === mintAddress);
    
    if (token && token.symbol) {
      console.log(`[Jupiter] ✅ Found metadata: ${token.symbol}`);
      return {
        symbol: token.symbol,
        name: token.name || token.symbol,
        logoURI: token.logoURI,
      };
    }
    
    return null;
  } catch (error: any) {
    console.warn(`[Jupiter] Error: ${error.message}`);
    return null;
  }
}

/**
 * Fallback 1: Try Dexscreener + Jupiter decimals
 * CRITICAL: Must fetch real decimals from Jupiter to avoid balance corruption
 */
async function getTokenMetadataFromDexscreener(mintAddress: string): Promise<TokenMetadata | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const pair = data.pairs[0];
      const token = pair.baseToken?.address === mintAddress ? pair.baseToken : pair.quoteToken;
      
      // CRITICAL: Fetch real decimals from Jupiter - FAIL FAST if invalid
      let decimals: number;
      try {
        const fetchedDecimals = await getTokenDecimals(mintAddress);
        const decimalsValidation = validateTokenDecimals(fetchedDecimals, 'Jupiter+Dexscreener');
        if (decimalsValidation.kind === 'error') {
          console.error(`[Dexscreener] ❌ ${decimalsValidation.reason} - FAILING`);
          throw new Error(`Invalid decimals from Jupiter: ${decimalsValidation.reason}`);
        }
        decimals = decimalsValidation.decimals; // ✅ Validated!
        console.log(`[Dexscreener] Fetched decimals from Jupiter: ${decimals}`);
      } catch (error) {
        console.error(`[Dexscreener] Failed to fetch valid decimals from Jupiter`);
        throw error; // Propagate error instead of defaulting to 9
      }
      
      return {
        symbol: token?.symbol || 'UNKNOWN',
        name: token?.name || 'Unknown Token',
        decimals: decimals, // Real decimals from Jupiter (validated)
      };
    }
    
    return null;
  } catch (error) {
    console.error('[Dexscreener] Error fetching token metadata:', error);
    return null;
  }
}

/**
 * Get token metadata with comprehensive fallback chain
 * CRITICAL: Never returns CA prefix - throws error if metadata cannot be found
 * 
 * Fallback chain:
 * 1. Helius (primary - most reliable for Solana)
 * 2. Dexscreener + Jupiter decimals
 * 3. CoinGecko (if Dexscreener returns UNKNOWN symbol)
 * 4. Jupiter Token List (if CoinGecko fails)
 */
export async function getTokenMetadataWithFallback(mintAddress: string): Promise<TokenMetadata> {
  // Try Helius first (most reliable)
  const heliusMetadata = await getTokenMetadata(mintAddress);
  if (heliusMetadata && heliusMetadata.symbol !== 'UNKNOWN') {
    return heliusMetadata;
  }

  // Fallback 1: Dexscreener + Jupiter decimals
  const dexMetadata = await getTokenMetadataFromDexscreener(mintAddress);
  
  // If Dexscreener provides complete metadata, use it
  if (dexMetadata && dexMetadata.symbol !== 'UNKNOWN') {
    console.log(`[Metadata] ✅ Using Dexscreener: ${dexMetadata.symbol}`);
    return dexMetadata;
  }
  
  // If Dexscreener has valid decimals but UNKNOWN symbol, try enrichment
  if (dexMetadata && dexMetadata.symbol === 'UNKNOWN') {
    console.log(`[Metadata] Dexscreener has decimals but UNKNOWN symbol - trying enrichment providers`);
    
    // Fallback 2: CoinGecko
    const coinGeckoMetadata = await getTokenMetadataFromCoinGecko(mintAddress);
    if (coinGeckoMetadata && coinGeckoMetadata.symbol && coinGeckoMetadata.symbol !== 'UNKNOWN') {
      console.log(`[Metadata] ✅ Enriched with CoinGecko: ${coinGeckoMetadata.symbol}`);
      // Explicitly construct complete TokenMetadata with all required fields
      const enrichedMetadata: TokenMetadata = {
        symbol: coinGeckoMetadata.symbol,
        name: coinGeckoMetadata.name || 'Unknown Token', // Required field with fallback
        decimals: dexMetadata.decimals, // Validated decimals from Dexscreener
        logoURI: coinGeckoMetadata.logoURI, // Optional field
      };
      return enrichedMetadata;
    }
    
    // Fallback 3: Jupiter Token List
    const jupiterMetadata = await getTokenMetadataFromJupiter(mintAddress);
    if (jupiterMetadata && jupiterMetadata.symbol && jupiterMetadata.symbol !== 'UNKNOWN') {
      console.log(`[Metadata] ✅ Enriched with Jupiter: ${jupiterMetadata.symbol}`);
      // Explicitly construct complete TokenMetadata with all required fields
      const enrichedMetadata: TokenMetadata = {
        symbol: jupiterMetadata.symbol,
        name: jupiterMetadata.name || jupiterMetadata.symbol, // Required field with symbol fallback
        decimals: dexMetadata.decimals, // Validated decimals from Dexscreener
        logoURI: jupiterMetadata.logoURI, // Optional field
      };
      return enrichedMetadata;
    }
    
    // All enrichment providers failed, but we have valid decimals
    // Return with UNKNOWN symbol as last resort (better than crashing)
    console.warn(`[Metadata] ⚠️ All providers failed to resolve symbol for ${mintAddress} - using UNKNOWN`);
    return dexMetadata;
  }

  // If all fallbacks exhausted (no decimals or network errors), throw error
  console.error(`[Metadata] ❌ CRITICAL: No metadata found for ${mintAddress}`);
  throw new Error(`Unable to fetch token metadata for ${mintAddress}. Token may not exist or API services are down.`);
}
