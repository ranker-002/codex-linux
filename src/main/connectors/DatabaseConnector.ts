import { EventEmitter } from 'events';
import log from 'electron-log';

export interface DatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mongodb' | 'sqlite';
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
  filename?: string;
  connectionString?: string;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: Array<{ name: string; type: string }>;
}

export class DatabaseConnector extends EventEmitter {
  private config: DatabaseConfig | null = null;
  private client: any = null;
  private connected = false;

  constructor() {
    super();
  }

  async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;

    try {
      switch (config.type) {
        case 'postgresql':
          await this.connectPostgres(config);
          break;
        case 'mysql':
          await this.connectMysql(config);
          break;
        case 'mongodb':
          await this.connectMongodb(config);
          break;
        case 'sqlite':
          await this.connectSqlite(config);
          break;
        default:
          throw new Error(`Unsupported database type: ${config.type}`);
      }

      this.connected = true;
      log.info(`Connected to ${config.type} database`);
      this.emit('connected');
    } catch (error) {
      log.error('Database connection failed:', error);
      throw error;
    }
  }

  private async connectPostgres(config: DatabaseConfig): Promise<void> {
    const { Client } = await import('pg');
    this.client = new Client({
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database,
      user: config.username,
      password: config.password,
      connectionString: config.connectionString,
    });
    await this.client.connect();
  }

  private async connectMysql(config: DatabaseConfig): Promise<void> {
    const mysql = await import('mysql2/promise');
    this.client = await mysql.createPool({
      host: config.host || 'localhost',
      port: config.port || 3306,
      database: config.database,
      user: config.username,
      password: config.password,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  private async connectMongodb(config: DatabaseConfig): Promise<void> {
    const { MongoClient } = await import('mongodb');
    const url = config.connectionString || 
      `mongodb://${config.username}:${config.password}@${config.host || 'localhost'}:${config.port || 27017}/${config.database}`;
    this.client = new MongoClient(url);
    await this.client.connect();
  }

  private async connectSqlite(config: DatabaseConfig): Promise<void> {
    const Database = (await import('better-sqlite3')).default;
    this.client = new Database(config.filename || config.database);
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;

    try {
      if (this.config?.type === 'postgresql') {
        await this.client.end();
      } else if (this.config?.type === 'mongodb') {
        await this.client.close();
      } else if (this.config?.type === 'mysql') {
        await this.client.end();
      } else if (this.config?.type === 'sqlite') {
        this.client.close();
      }
    } catch (error) {
      log.error('Disconnect error:', error);
    }

    this.connected = false;
    this.client = null;
    this.emit('disconnected');
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to database');
    }

    try {
      switch (this.config?.type) {
        case 'postgresql':
          return await this.queryPostgres(sql, params);
        case 'mysql':
          return await this.queryMysql(sql, params);
        case 'mongodb':
          return await this.queryMongodb(sql, params);
        case 'sqlite':
          return await this.querySqlite(sql, params);
        default:
          throw new Error('Unknown database type');
      }
    } catch (error) {
      log.error('Query error:', error);
      throw error;
    }
  }

  private async queryPostgres(sql: string, params?: any[]): Promise<QueryResult> {
    const result = await this.client.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map((f: any) => ({ name: f.name, type: f.dataTypeID })),
    };
  }

  private async queryMysql(sql: string, params?: any[]): Promise<QueryResult> {
    const [rows, fields] = await this.client.execute(sql, params);
    return {
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0,
      fields: fields?.map((f: any) => ({ name: f.name, type: f.type })),
    };
  }

  private async queryMongodb(sql: string, params?: any[]): Promise<QueryResult> {
    // MongoDB uses a simple SQL-like syntax for this wrapper
    const [collection, operation] = sql.split('.');
    const collectionObj = this.client.db().collection(collection);

    if (operation?.trim() === 'find') {
      const docs = await collectionObj.find(params?.[0] || {}).toArray();
      return { rows: docs, rowCount: docs.length };
    } else if (operation?.trim() === 'insert') {
      const result = await collectionObj.insertOne(params?.[0] || {});
      return { rows: [result], rowCount: 1 };
    } else if (operation?.trim() === 'update') {
      const result = await collectionObj.updateOne(params?.[0], params?.[1]);
      return { rows: [result], rowCount: result.modifiedCount };
    } else if (operation?.trim() === 'delete') {
      const result = await collectionObj.deleteOne(params?.[0]);
      return { rows: [result], rowCount: result.deletedCount };
    }

    return { rows: [], rowCount: 0 };
  }

  private async querySqlite(sql: string, params?: any[]): Promise<QueryResult> {
    const stmt = this.client.prepare(sql);
    const isSelect = sql.trim().toLowerCase().startsWith('select');

    if (isSelect) {
      const rows = stmt.all(...(params || []));
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(...(params || []));
      return { rows: [], rowCount: info.changes };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConfig(): DatabaseConfig | null {
    return this.config ? { ...this.config, password: '***' } : null;
  }

  cleanup(): void {
    this.disconnect();
    this.removeAllListeners();
  }
}

export default DatabaseConnector;
