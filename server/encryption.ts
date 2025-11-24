import crypto from 'crypto';

/**
 * AES-256-GCM Encryption Module
 * 
 * SECURITY PROPERTIES:
 * - Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
 * - Key Derivation: PBKDF2 with 100,000 iterations (NIST recommended)
 * - Salt: 64 bytes of cryptographically secure random data (per encryption)
 * - IV: 16 bytes of cryptographically secure random data (per encryption)
 * - Authentication Tag: 16 bytes (protects against tampering)
 * 
 * THREAT MODEL:
 * - Protects private keys at rest in database
 * - Prevents unauthorized key extraction from database dumps
 * - Detects tampering via GCM authentication tag
 * - Unique salt/IV per encryption prevents rainbow table attacks
 * 
 * RECOMMENDATIONS FOR PRODUCTION:
 * - Store ENCRYPTION_KEY in secure secret management system
 * - Rotate ENCRYPTION_KEY periodically with re-encryption migration
 * - Use hardware security module (HSM) for key storage if available
 * - Monitor for failed authentication tag validations (tampering attempts)
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // GCM standard IV length
const SALT_LENGTH = 64; // High-entropy salt for PBKDF2
const TAG_LENGTH = 16; // GCM authentication tag length
const KEY_LENGTH = 32; // AES-256 requires 32-byte key

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

if (!ENCRYPTION_KEY) {
  console.warn('⚠️  ENCRYPTION_KEY not set! Private keys will not be encrypted properly.');
}

/**
 * Derive encryption key from master key using PBKDF2
 * 
 * SECURITY: Uses 100,000 iterations to make brute-force attacks expensive
 * Each unique salt produces a different derived key
 * 
 * @param salt - Unique salt buffer (64 bytes)
 * @returns Derived encryption key (32 bytes)
 */
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    ENCRYPTION_KEY,
    salt,
    100000, // NIST recommended minimum
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt private key (byte array) to encrypted string
 * @param privateKey - 64-byte array from Solana keypair
 * @returns Encrypted string: salt.iv.tag.encrypted
 */
export function encryptPrivateKey(privateKey: number[]): string {
  if (!ENCRYPTION_KEY) {
    // Fallback: return as JSON (unencrypted) if no key set
    return JSON.stringify(privateKey);
  }

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Derive key from master key + salt
  const key = deriveKey(salt);
  
  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  // Convert array to buffer and encrypt
  const privateKeyBuffer = Buffer.from(privateKey);
  const encrypted = Buffer.concat([
    cipher.update(privateKeyBuffer),
    cipher.final()
  ]);
  
  // Get authentication tag
  const tag = cipher.getAuthTag();
  
  // Combine: salt.iv.tag.encrypted (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64')
  ].join('.');
}

/**
 * Decrypt encrypted private key back to byte array
 * @param encryptedData - Encrypted string from database
 * @returns 64-byte array
 */
export function decryptPrivateKey(encryptedData: string): number[] {
  if (!ENCRYPTION_KEY) {
    // Fallback: parse as JSON if no encryption key
    try {
      return JSON.parse(encryptedData);
    } catch {
      throw new Error('Failed to decrypt private key');
    }
  }

  try {
    // Split encrypted data
    const parts = encryptedData.split('.');
    if (parts.length !== 4) {
      // Might be old unencrypted data, try parsing as JSON
      return JSON.parse(encryptedData);
    }

    const [saltB64, ivB64, tagB64, encryptedB64] = parts;
    
    // Decode from base64
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    
    // Derive key
    const key = deriveKey(salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Convert buffer to array
    return Array.from(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt private key');
  }
}

/**
 * Verify if two private keys match (handles encrypted comparison)
 * @param inputKey - Plain 64-byte array from user login
 * @param storedEncrypted - Encrypted string from database
 * @returns True if keys match
 */
export function verifyPrivateKey(inputKey: number[], storedEncrypted: string): boolean {
  try {
    const decryptedKey = decryptPrivateKey(storedEncrypted);
    
    // Compare arrays
    if (decryptedKey.length !== inputKey.length) return false;
    
    return decryptedKey.every((byte, index) => byte === inputKey[index]);
  } catch {
    return false;
  }
}
