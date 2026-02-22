import crypto from 'crypto';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

export class SecurityManager {
  private algorithm = 'aes-256-gcm';
  private keyFile: string;
  private masterKey: Buffer | null = null;

  constructor() {
    this.keyFile = path.join(app.getPath('userData'), 'encryption.key');
  }

  async initialize(): Promise<void> {
    try {
      // Try to load existing key
      const keyData = await fs.readFile(this.keyFile);
      this.masterKey = keyData;
    } catch {
      // Generate new key if doesn't exist
      this.masterKey = crypto.randomBytes(32);
      await fs.mkdir(path.dirname(this.keyFile), { recursive: true });
      await fs.writeFile(this.keyFile, this.masterKey, { mode: 0o600 });
    }
  }

  encrypt(text: string): string {
    if (!this.masterKey) {
      throw new Error('Security manager not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();
    
    // Return IV + authTag + encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    if (!this.masterKey) {
      throw new Error('Security manager not initialized');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
    (decipher as any).setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  async rotateKey(): Promise<void> {
    // Decrypt all existing data with old key
    // Generate new key
    // Re-encrypt all data with new key
    // Save new key
    const newKey = crypto.randomBytes(32);
    
    // Backup old key
    const backupFile = this.keyFile + '.backup';
    await fs.copyFile(this.keyFile, backupFile);
    
    // Save new key
    await fs.writeFile(this.keyFile, newKey, { mode: 0o600 });
    
    this.masterKey = newKey;
  }

  // Secure comparison to prevent timing attacks
  secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}