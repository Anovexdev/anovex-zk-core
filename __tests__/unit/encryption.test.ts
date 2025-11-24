import { describe, it, expect, beforeEach } from 'vitest';
import { encryptPrivateKey, decryptPrivateKey, verifyPrivateKey } from '../../server/encryption';
import crypto from 'crypto';

describe('Encryption Utils', () => {
  let testPrivateKey: number[];

  beforeEach(() => {
    testPrivateKey = Array.from(crypto.randomBytes(64));
  });

  it('should encrypt and decrypt private keys correctly', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const decrypted = decryptPrivateKey(encrypted);

    expect(decrypted).toEqual(testPrivateKey);
    expect(encrypted).not.toEqual(JSON.stringify(testPrivateKey));
    expect(encrypted.split('.')).toHaveLength(4);
  });

  it('should generate unique salts for each encryption', () => {
    const encrypted1 = encryptPrivateKey(testPrivateKey);
    const encrypted2 = encryptPrivateKey(testPrivateKey);

    expect(encrypted1).not.toEqual(encrypted2);
    
    const [salt1] = encrypted1.split('.');
    const [salt2] = encrypted2.split('.');
    expect(salt1).not.toEqual(salt2);
  });

  it('should generate unique IVs for each encryption', () => {
    const encrypted1 = encryptPrivateKey(testPrivateKey);
    const encrypted2 = encryptPrivateKey(testPrivateKey);

    const [, iv1] = encrypted1.split('.');
    const [, iv2] = encrypted2.split('.');
    expect(iv1).not.toEqual(iv2);
  });

  it('should use authentication tag (GCM mode)', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const [, , tag] = encrypted.split('.');
    
    expect(tag).toBeDefined();
    expect(tag.length).toBeGreaterThan(0);
    
    const tagBuffer = Buffer.from(tag, 'base64');
    expect(tagBuffer.length).toBe(16);
  });

  it('should fail decryption with tampered data', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const [salt, iv, tag, ciphertext] = encrypted.split('.');
    
    const tamperedCiphertext = Buffer.from(ciphertext, 'base64');
    tamperedCiphertext[0] ^= 1;
    const tampered = [salt, iv, tag, tamperedCiphertext.toString('base64')].join('.');
    
    expect(() => decryptPrivateKey(tampered)).toThrow();
  });

  it('should verify matching private keys', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const isValid = verifyPrivateKey(testPrivateKey, encrypted);
    
    expect(isValid).toBe(true);
  });

  it('should reject non-matching private keys', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const wrongKey = Array.from(crypto.randomBytes(64));
    const isValid = verifyPrivateKey(wrongKey, encrypted);
    
    expect(isValid).toBe(false);
  });

  it('should handle 64-byte Solana keypairs', () => {
    const solanaSizeKey = Array.from(crypto.randomBytes(64));
    const encrypted = encryptPrivateKey(solanaSizeKey);
    const decrypted = decryptPrivateKey(encrypted);
    
    expect(decrypted.length).toBe(64);
    expect(decrypted).toEqual(solanaSizeKey);
  });

  it('should encode components as base64', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const [salt, iv, tag, ciphertext] = encrypted.split('.');
    
    const isBase64 = (str: string) => {
      try {
        return Buffer.from(str, 'base64').toString('base64') === str;
      } catch {
        return false;
      }
    };
    
    expect(isBase64(salt)).toBe(true);
    expect(isBase64(iv)).toBe(true);
    expect(isBase64(tag)).toBe(true);
    expect(isBase64(ciphertext)).toBe(true);
  });

  it('should use salt length of 64 bytes', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const [saltB64] = encrypted.split('.');
    const salt = Buffer.from(saltB64, 'base64');
    
    expect(salt.length).toBe(64);
  });

  it('should use IV length of 16 bytes', () => {
    const encrypted = encryptPrivateKey(testPrivateKey);
    const [, ivB64] = encrypted.split('.');
    const iv = Buffer.from(ivB64, 'base64');
    
    expect(iv.length).toBe(16);
  });
});
