import { EventEmitter } from 'events';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';

export type ConnectionEventType = 
  | 'connect' 
  | 'disconnect' 
  | 'error' 
  | 'message' 
  | 'subscribe' 
  | 'unsubscribe';

export interface StreamMessage {
  id: string;
  type: string;
  event: string;
  data: unknown;
  timestamp: Date;
}

export interface ClientInfo {
  id: string;
  socketId: string;
  userId?: string;
  metadata: Record<string, unknown>;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
}

export interface StreamSubscription {
  channel: string;
  clientId: string;
  subscribedAt: Date;
}

export interface WebSocketServerConfig {
  port: number;
  cors?: {
    origin: string | string[];
    methods: string[];
    credentials: boolean;
  };
  pingInterval: number;
  pingTimeout: number;
  maxPayloadSize: number;
}

export interface ServerStats {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  totalBytes: number;
  channels: number;
}

export class WebSocketManager extends EventEmitter {
  private io: SocketIOServer | null = null;
  private clients: Map<string, ClientInfo> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();
  private config: WebSocketServerConfig;
  private messageCount = 0;
  private bytesTransferred = 0;

  constructor(config?: Partial<WebSocketServerConfig>) {
    super();
    this.config = {
      port: config?.port || 3001,
      cors: config?.cors || {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingInterval: config?.pingInterval || 25000,
      pingTimeout: config?.pingTimeout || 20000,
      maxPayloadSize: config?.maxPayloadSize || 1e6,
    };
  }

  configure(config: Partial<WebSocketServerConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('WebSocketManager configured', {
      port: this.config.port,
      pingInterval: this.config.pingInterval,
    });
  }

  getConfig(): WebSocketServerConfig {
    return { ...this.config };
  }

  initialize(httpServer?: HttpServer): void {
    if (this.io) {
      log.warn('WebSocket server already initialized');
      return;
    }

    const server = httpServer || this.createStandaloneServer();

    this.io = new SocketIOServer(server, {
      cors: this.config.cors,
      pingInterval: this.config.pingInterval,
      pingTimeout: this.config.pingTimeout,
      maxHttpBufferSize: this.config.maxPayloadSize,
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    log.info('WebSocket server initialized', { port: this.config.port });
  }

  private createStandaloneServer(): HttpServer {
    const http = require('http');
    return http.createServer();
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const clientId = uuidv4();
      const clientInfo: ClientInfo = {
        id: clientId,
        socketId: socket.id,
        metadata: {},
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscriptions: new Set(),
      };

      this.clients.set(clientId, clientInfo);
      this.emit('client:connected', { clientId, socketId: socket.id });

      socket.on('authenticate', (data: { userId?: string; metadata?: Record<string, unknown> }) => {
        clientInfo.userId = data.userId;
        if (data.metadata) {
          clientInfo.metadata = { ...clientInfo.metadata, ...data.metadata };
        }
        socket.emit('authenticated', { clientId });
        log.info(`Client authenticated: ${clientId}`, { userId: data.userId });
      });

      socket.on('subscribe', (channel: string) => {
        this.subscribeClient(clientId, channel);
        socket.emit('subscribed', { channel });
      });

      socket.on('unsubscribe', (channel: string) => {
        this.unsubscribeClient(clientId, channel);
        socket.emit('unsubscribed', { channel });
      });

      socket.on('message', (data: unknown) => {
        this.handleMessage(clientId, data);
      });

      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });

      socket.on('disconnect', (reason: string) => {
        this.handleDisconnect(clientId, reason);
      });

      socket.on('error', (error: Error) => {
        this.emit('error', { clientId, error });
        log.error(`WebSocket error for client ${clientId}:`, error);
      });

      socket.emit('connected', { clientId, serverTime: Date.now() });
    });
  }

  private subscribeClient(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(channel);

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(clientId);

    this.emit('client:subscribed', { clientId, channel });
    log.debug(`Client ${clientId} subscribed to ${channel}`);
  }

  private unsubscribeClient(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);

    const channelSubs = this.subscriptions.get(channel);
    if (channelSubs) {
      channelSubs.delete(clientId);
      if (channelSubs.size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    this.emit('client:unsubscribed', { clientId, channel });
  }

  private handleMessage(clientId: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();
    this.messageCount++;

    if (data && typeof data === 'object') {
      const msg = data as { size?: number };
      if (msg.size) {
        this.bytesTransferred += msg.size;
      }
    }

    this.emit('message:received', { clientId, data });
  }

  private handleDisconnect(clientId: string, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.forEach((channel) => {
      this.unsubscribeClient(clientId, channel);
    });

    this.clients.delete(clientId);
    this.emit('client:disconnected', { clientId, reason });
    log.info(`Client disconnected: ${clientId}`, { reason });
  }

  sendToClient(clientId: string, event: string, data: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client || !this.io) return false;

    const socket = this.io.sockets.sockets.get(client.socketId);
    if (!socket) return false;

    const message: StreamMessage = {
      id: uuidv4(),
      type: 'event',
      event,
      data,
      timestamp: new Date(),
    };

    socket.emit(event, data);
    this.messageCount++;
    this.bytesTransferred += JSON.stringify(data).length;

    return true;
  }

  broadcast(event: string, data: unknown, channel?: string): number {
    if (!this.io) return 0;

    let targetSockets: Socket[];

    if (channel) {
      const channelSubs = this.subscriptions.get(channel);
      if (!channelSubs) return 0;

      targetSockets = Array.from(channelSubs)
        .map((cid) => this.clients.get(cid))
        .filter((c): c is ClientInfo => c !== undefined)
        .map((c) => this.io!.sockets.sockets.get(c.socketId))
        .filter((s): s is Socket => s !== undefined);
    } else {
      targetSockets = Array.from(this.io.sockets.sockets.values());
    }

    const message: StreamMessage = {
      id: uuidv4(),
      type: 'broadcast',
      event,
      data,
      timestamp: new Date(),
    };

    this.io.emit(event, data);
    this.messageCount += targetSockets.length;
    this.bytesTransferred += JSON.stringify(data).length * targetSockets.length;

    return targetSockets.length;
  }

  publish(channel: string, event: string, data: unknown): number {
    const channelSubs = this.subscriptions.get(channel);
    if (!channelSubs || !this.io) return 0;

    const message: StreamMessage = {
      id: uuidv4(),
      type: 'publish',
      event,
      data,
      timestamp: new Date(),
    };

    channelSubs.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        const socket = this.io!.sockets.sockets.get(client.socketId);
        if (socket) {
          socket.emit(event, data);
        }
      }
    });

    const count = channelSubs.size;
    this.messageCount += count;
    this.bytesTransferred += JSON.stringify(data).length * count;

    return count;
  }

  sendStream(clientId: string, event: string, dataChunks: unknown[]): void {
    const client = this.clients.get(clientId);
    if (!client || !this.io) return;

    const socket = this.io.sockets.sockets.get(client.socketId);
    if (!socket) return;

    dataChunks.forEach((chunk, index) => {
      setTimeout(() => {
        socket.emit(event, { chunk, index, total: dataChunks.length });
        this.messageCount++;
      }, index * 50);
    });
  }

  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  listClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getChannels(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getChannelSubscribers(channel: string): string[] {
    const subs = this.subscriptions.get(channel);
    return subs ? Array.from(subs) : [];
  }

  disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client || !this.io) return false;

    const socket = this.io.sockets.sockets.get(client.socketId);
    if (socket) {
      socket.disconnect(true);
    }

    return true;
  }

  getStats(): ServerStats {
    return {
      totalConnections: this.clients.size,
      activeConnections: this.clients.size,
      totalMessages: this.messageCount,
      totalBytes: this.bytesTransferred,
      channels: this.subscriptions.size,
    };
  }

  shutdown(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    this.clients.clear();
    this.subscriptions.clear();
    this.emit('server:shutdown');
    log.info('WebSocket server shut down');
  }

  cleanup(): void {
    this.shutdown();
    this.removeAllListeners();
    log.info('WebSocketManager cleaned up');
  }
}

export default WebSocketManager;
