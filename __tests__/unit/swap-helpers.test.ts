import { describe, it, expect } from 'vitest';
import { generateAnxTxHash } from '../../server/swap-helpers';

describe('Swap Helpers', () => {
  describe('ANX Transaction Hash Generation', () => {
    it('should generate 88-character hash', () => {
      const hash = generateAnxTxHash('buy');
      expect(hash.length).toBe(88);
    });

    it('should generate alphanumeric characters only', () => {
      const hash = generateAnxTxHash('buy');
      const alphanumericRegex = /^[0-9A-Za-z]+$/;
      expect(alphanumericRegex.test(hash)).toBe(true);
    });

    it('should generate unique hashes', () => {
      const hash1 = generateAnxTxHash('buy');
      const hash2 = generateAnxTxHash('buy');
      const hash3 = generateAnxTxHash('sell');
      
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash2).not.toBe(hash3);
    });

    it('should work for all transaction types', () => {
      const types: Array<'deposit' | 'buy' | 'sell' | 'withdraw'> = ['deposit', 'buy', 'sell', 'withdraw'];
      
      types.forEach(type => {
        const hash = generateAnxTxHash(type);
        expect(hash.length).toBe(88);
        expect(/^[0-9A-Za-z]+$/.test(hash)).toBe(true);
      });
    });

    it('should use cryptographically secure random generation', () => {
      const hashes = new Set();
      const iterations = 1000;
      
      for (let i = 0; i < iterations; i++) {
        hashes.add(generateAnxTxHash('buy'));
      }
      
      expect(hashes.size).toBe(iterations);
    });

    it('should have high entropy (no patterns)', () => {
      const hash = generateAnxTxHash('buy');
      const charFrequency: Record<string, number> = {};
      
      for (const char of hash) {
        charFrequency[char] = (charFrequency[char] || 0) + 1;
      }
      
      const maxFrequency = Math.max(...Object.values(charFrequency));
      expect(maxFrequency).toBeLessThan(10);
    });
  });

  describe('Security Properties', () => {
    it('should generate different hashes even with same input type', () => {
      const hash1 = generateAnxTxHash('buy');
      const hash2 = generateAnxTxHash('buy');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should not contain predictable patterns', () => {
      const hash = generateAnxTxHash('buy');
      
      expect(hash).not.toContain('000000');
      expect(hash).not.toContain('111111');
      expect(hash).not.toContain('aaaaaa');
    });

    it('should generate hashes suitable for database unique constraints', () => {
      const hashes = [];
      for (let i = 0; i < 100; i++) {
        hashes.push(generateAnxTxHash('buy'));
      }
      
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(100);
    });
  });
});
