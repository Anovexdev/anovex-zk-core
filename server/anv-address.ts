import crypto from 'crypto';
import { Keypair } from '@solana/web3.js';

/**
 * Derives ANV address from Solana public key (v2 - RECOMMENDED)
 * 
 * This is the secure, standard approach that derives the user-facing
 * ANV address from the PUBLIC key, not the private key.
 * 
 * @param publicKeyBytes - Solana public key bytes (32 bytes)
 * @returns ANV address (format: ANV + 41 alphanumeric chars)
 */
export function deriveANVAddressV2(publicKeyBytes: Uint8Array): string {
  if (publicKeyBytes.length !== 32) {
    throw new Error(`Invalid public key length: ${publicKeyBytes.length}. Expected 32 bytes.`);
  }
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const hash = crypto.createHash('sha256').update(publicKeyBytes).digest();
  
  let result = 'ANV';
  for (let i = 0; i < 41; i++) {
    result += chars[hash[i % hash.length] % chars.length];
  }
  return result;
}

/**
 * Derives ANV address from private key (v1 - LEGACY)
 * 
 * This is the legacy approach that uses the PRIVATE KEY to derive
 * the ANV address. This has security implications (exposes key material)
 * and is only kept for backwards compatibility with existing wallets.
 * 
 * @param privateKeyBytes - Solana private key bytes (64 bytes for full keypair or 32 bytes for seed)
 * @returns ANV address (format: ANV + 41 alphanumeric chars)
 */
export function deriveANVAddressV1(privateKeyBytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const hash = crypto.createHash('sha256').update(privateKeyBytes).digest();
  
  let result = 'ANV';
  for (let i = 0; i < 41; i++) {
    result += chars[hash[i % hash.length] % chars.length];
  }
  return result;
}

/**
 * Derives both v2 (public key) and v1 (private key) ANV addresses
 * 
 * Use this when you need to check both versions for migration purposes.
 * The v2 address should be used going forward, but v1 is provided for
 * backwards compatibility lookups.
 * 
 * @param privateKeyBytes - Full Solana keypair bytes (64 bytes)
 * @returns Object with v2 (public key-based) and v1 (private key-based) addresses
 */
export function deriveANVAddresses(privateKeyBytes: Uint8Array): {
  v2: string;  // Public key-based (RECOMMENDED)
  v1: string;  // Private key-based (LEGACY)
} {
  if (privateKeyBytes.length !== 64) {
    throw new Error(`Invalid keypair length: ${privateKeyBytes.length}. Expected 64 bytes.`);
  }
  
  // Solana keypair format: first 32 bytes = seed/secret, last 32 bytes = public key
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  const publicKeyBytes = keypair.publicKey.toBytes();
  
  return {
    v2: deriveANVAddressV2(publicKeyBytes),
    v1: deriveANVAddressV1(privateKeyBytes)
  };
}

/**
 * Helper: Get public key bytes from private key bytes
 */
export function getPublicKeyFromPrivateKey(privateKeyBytes: Uint8Array): Uint8Array {
  if (privateKeyBytes.length !== 64) {
    throw new Error(`Invalid keypair length: ${privateKeyBytes.length}. Expected 64 bytes.`);
  }
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  return keypair.publicKey.toBytes();
}
