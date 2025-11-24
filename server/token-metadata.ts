// Comprehensive Token Metadata Validation Utilities
// Ensures type safety and correctness for all token metadata operations

export type DecimalsValidationResult =
  | { kind: 'ok'; decimals: number }
  | { kind: 'error'; reason: string };

/**
 * CRITICAL: Validates token decimals to prevent NaN corruption and balance errors
 * 
 * Enforces ALL safety constraints:
 * 1. Must be a number (not string, undefined, null)
 * 2. Must be finite (not NaN, Infinity, -Infinity)
 * 3. Must be an integer (not 3.5, 6.7, etc)
 * 4. Must be non-negative (not -1, -9, etc)
 * 
 * @param value - The decimals value to validate
 * @param source - Source of the value for logging (e.g., "Helius", "Jupiter", "Dexscreener")
 * @returns Validated decimals or error with reason
 */
export function validateTokenDecimals(
  value: any,
  source: string
): DecimalsValidationResult {
  // Check 1: Must be a number type
  if (typeof value !== 'number') {
    return {
      kind: 'error',
      reason: `[${source}] Decimals is not a number (type: ${typeof value}, value: ${value})`
    };
  }

  // Check 2: Must be finite (rejects NaN, Infinity, -Infinity)
  if (!Number.isFinite(value)) {
    return {
      kind: 'error',
      reason: `[${source}] Decimals is not finite (value: ${value})`
    };
  }

  // Check 3: Must be an integer (rejects 3.5, 6.7, etc)
  if (!Number.isInteger(value)) {
    return {
      kind: 'error',
      reason: `[${source}] Decimals is not an integer (value: ${value})`
    };
  }

  // Check 4: Must be non-negative (0 is valid for special tokens/NFTs)
  if (value < 0) {
    return {
      kind: 'error',
      reason: `[${source}] Decimals is negative (value: ${value})`
    };
  }

  // All checks passed! ✅
  return { kind: 'ok', decimals: value };
}

/**
 * Safe wrapper for validateTokenDecimals that returns validated value or default
 * 
 * Use this when you want to fallback to a default value on validation failure
 * For critical paths where failure should abort the operation, use validateTokenDecimals directly
 * 
 * @param value - The decimals value to validate
 * @param source - Source of the value for logging
 * @param defaultValue - Fallback value (default: 9 for most Solana tokens)
 * @returns Validated decimals or default value
 */
export function getValidatedDecimalsOrDefault(
  value: any,
  source: string,
  defaultValue: number = 9
): number {
  const result = validateTokenDecimals(value, source);
  
  if (result.kind === 'error') {
    console.warn(`⚠️ ${result.reason}, using default ${defaultValue}`);
    return defaultValue;
  }
  
  return result.decimals;
}
