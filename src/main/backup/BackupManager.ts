import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { createWriteStream, createReadStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import log from 'electron-log';
import { format } from 'date-fns';

interface BackupMetadata {
  id: string;
  timestamp: string;
  version: string;
  size: number;
  checksum: string;
  contents: string[];
}

interface Migration {
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

export class BackupManager {
  private backupDir: string;
  private dataDir: string;
  private maxBackups = 10;

  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.dataDir = path.join(app.getPath('userData'), 'data');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async createBackup(): Promise<BackupMetadata> {
    const timestamp = new Date();
    const backupId = `backup-${format(timestamp, 'yyyy-MM-dd-HHmmss')}`;
    const backupPath = path.join(this.backupDir, `${backupId}.json.gz`);

    try {
      // List files to backup
      const files = await this.listBackupFiles();
      
      // Create backup archive
      await this.createArchive(files, backupPath);

      // Calculate checksum
      const checksum = await this.calculateChecksum(backupPath);
      
      // Get file size
      const stats = await fs.stat(backupPath);

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: timestamp.toISOString(),
        version: app.getVersion(),
        size: stats.size,
        checksum,
        contents: files,
      };

      // Save metadata
      await fs.writeFile(
        path.join(this.backupDir, `${backupId}.json`),
        JSON.stringify(metadata, null, 2)
      );

      // Clean old backups
      await this.cleanupOldBackups();

      log.info(`Backup created: ${backupId}`);
      return metadata;
    } catch (error) {
      log.error('Failed to create backup:', error);
      throw error;
    }
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, `${backupId}.json.gz`);
    const metadataPath = path.join(this.backupDir, `${backupId}.json`);

    try {
      // Verify backup exists
      await fs.access(backupPath);
      
      // Read metadata
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata: BackupMetadata = JSON.parse(metadataContent);

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(backupPath);
      if (currentChecksum !== metadata.checksum) {
        throw new Error('Backup checksum mismatch - file may be corrupted');
      }

      // Create restore point
      await this.createBackup();

      // Extract backup
      await this.extractArchive(backupPath, this.dataDir);

      log.info(`Backup restored: ${backupId}`);
    } catch (error) {
      log.error('Failed to restore backup:', error);
      throw error;
    }
  }

  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const metadataFiles = files.filter(f => f.endsWith('.json'));

      const backups: BackupMetadata[] = [];
      for (const file of metadataFiles) {
        const content = await fs.readFile(path.join(this.backupDir, file), 'utf-8');
        backups.push(JSON.parse(content));
      }

      return backups.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      log.error('Failed to list backups:', error);
      return [];
    }
  }

  async deleteBackup(backupId: string): Promise<void> {
    try {
      const backupPath = path.join(this.backupDir, `${backupId}.json.gz`);
      const metadataPath = path.join(this.backupDir, `${backupId}.json`);

      await fs.unlink(backupPath).catch(() => {});
      await fs.unlink(metadataPath).catch(() => {});

      log.info(`Backup deleted: ${backupId}`);
    } catch (error) {
      log.error('Failed to delete backup:', error);
      throw error;
    }
  }

  async exportBackup(backupId: string, exportPath: string): Promise<void> {
    const backupPath = path.join(this.backupDir, `${backupId}.json.gz`);
    await fs.copyFile(backupPath, exportPath);
  }

  async importBackup(importPath: string): Promise<BackupMetadata> {
    const filename = path.basename(importPath);
    const backupId = filename.replace('.json.gz', '');
    const backupPath = path.join(this.backupDir, filename);

    await fs.copyFile(importPath, backupPath);

    // Calculate metadata
    const checksum = await this.calculateChecksum(backupPath);
    const stats = await fs.stat(backupPath);

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date().toISOString(),
      version: app.getVersion(),
      size: stats.size,
      checksum,
      contents: [],
    };

    await fs.writeFile(
      path.join(this.backupDir, `${backupId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    return metadata;
  }

  private async listBackupFiles(): Promise<string[]> {
    const files: string[] = [];

    async function walk(dir: string, baseDir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          await walk(fullPath, baseDir);
        } else {
          files.push(relativePath);
        }
      }
    }

    await walk(this.dataDir, this.dataDir);
    return files;
  }

  private async createArchive(files: string[], outputPath: string): Promise<void> {
    const backup = {
      files: {} as Record<string, string>,
      timestamp: new Date().toISOString(),
    };

    for (const file of files) {
      const content = await fs.readFile(path.join(this.dataDir, file), 'utf-8');
      backup.files[file] = content;
    }

    const jsonContent = JSON.stringify(backup, null, 2);
    const compressed = await this.compress(jsonContent);
    await fs.writeFile(outputPath, compressed);
  }

  private async extractArchive(archivePath: string, outputDir: string): Promise<void> {
    const compressed = await fs.readFile(archivePath);
    const jsonContent = await this.decompress(compressed);
    const backup = JSON.parse(jsonContent.toString());

    for (const [filePath, content] of Object.entries(backup.files)) {
      const fullPath = path.join(outputDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content as string);
    }
  }

  private async compress(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip();
      const chunks: Buffer[] = [];

      gzip.on('data', chunk => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      gzip.end(data);
    });
  }

  private async decompress(data: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];

      gunzip.on('data', chunk => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks).toString()));
      gunzip.on('error', reject);

      gunzip.end(data);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async cleanupOldBackups(): Promise<void> {
    const backups = await this.listBackups();

    if (backups.length > this.maxBackups) {
      const toDelete = backups.slice(this.maxBackups);

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  }

  async cleanup(): Promise<void> {
    log.info('Backup manager cleanup completed');
  }
}