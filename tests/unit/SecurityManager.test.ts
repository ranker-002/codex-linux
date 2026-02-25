import { SecurityManager } from '../../src/main/security/SecurityManager';
import crypto from 'crypto';
import * as fs from 'fs/promises';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test'),
  },
}));

jest.mock('fs/promises');

describe('SecurityManager', () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    securityManager = new SecurityManager();
  });

  describe('encrypt/decrypt', () => {
    beforeEach(async () => {
      (fs.readFile as unknown as jest.Mock).mockRejectedValue(new Error('no key'));
      (fs.mkdir as unknown as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);

      await securityManager.initialize();
    });

    it('should encrypt and decrypt text correctly', () => {
      const originalText = 'sensitive-api-key-12345';
      
      const encrypted = securityManager.encrypt(originalText);
      const decrypted = securityManager.decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toBe(originalText);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const text = 'test-data';
      
      const encrypted1 = securityManager.encrypt(text);
      const encrypted2 = securityManager.encrypt(text);

      expect(encrypted1).not.toBe(encrypted2);
      expect(securityManager.decrypt(encrypted1)).toBe(text);
      expect(securityManager.decrypt(encrypted2)).toBe(text);
    });

    it('should throw error if not initialized', () => {
      const newManager = new SecurityManager();
      
      expect(() => newManager.encrypt('test')).toThrow('Security manager not initialized');
      expect(() => newManager.decrypt('test:iv:auth')).toThrow('Security manager not initialized');
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => securityManager.decrypt('invalid-data')).toThrow('Invalid encrypted data format');
    });
  });

  describe('hash', () => {
    it('should produce consistent hashes', () => {
      const data = 'test-data';
      
      const hash1 = securityManager.hash(data);
      const hash2 = securityManager.hash(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should produce different hashes for different data', () => {
      const hash1 = securityManager.hash('data1');
      const hash2 = securityManager.hash('data2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate tokens of specified length', () => {
      const token = securityManager.generateSecureToken(32);
      
      // base64url encoding of 32 bytes = 43 characters
      expect(token).toHaveLength(43);
    });

    it('should generate unique tokens', () => {
      const token1 = securityManager.generateSecureToken();
      const token2 = securityManager.generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('secureCompare', () => {
    it('should return true for equal strings', () => {
      expect(securityManager.secureCompare('test', 'test')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(securityManager.secureCompare('test', 'test2')).toBe(false);
    });

    it('should return false for different length strings', () => {
      expect(securityManager.secureCompare('test', 'tes')).toBe(false);
    });
  });
});