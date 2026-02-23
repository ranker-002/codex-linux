import { EventEmitter } from 'events';
import log from 'electron-log';
import { RealtimeConfig } from '../../shared/types';

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

export interface SpeechSynthesisOptions {
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export class RealtimeManager extends EventEmitter {
  private config: RealtimeConfig;
  private isListening = false;
  private isSpeaking = false;

  constructor() {
    super();
    this.config = {
      provider: 'openai',
      enableSTT: false,
      enableTTS: false,
      language: 'en-US',
      model: 'gpt-4o-audio-preview',
      voice: 'alloy',
    };
  }

  async initialize(config?: Partial<RealtimeConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    log.info('RealtimeManager initialized', { 
      provider: this.config.provider,
      stt: this.config.enableSTT,
      tts: this.config.enableTTS 
    });
  }

  configure(config: Partial<RealtimeConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('Realtime configuration updated');
  }

  getConfig(): RealtimeConfig {
    return { ...this.config };
  }

  // Speech-to-Text - handled by renderer via IPC
  async startListening(): Promise<void> {
    if (this.isListening) return;
    this.isListening = true;
    this.emit('listening:started');
    log.info('Speech recognition started (renderer handling)');
  }

  stopListening(): void {
    if (!this.isListening) return;
    this.isListening = false;
    this.emit('listening:stopped');
    log.info('Speech recognition stopped');
  }

  isActive(): boolean {
    return this.isListening;
  }

  // Speech recognition results from renderer
  handleSpeechResult(result: SpeechRecognitionResult): void {
    this.emit('speech:result', result);
  }

  handleSpeechError(error: { error: string }): void {
    this.emit('speech:error', error);
  }

  // Text-to-Speech - handled by renderer via IPC
  async speak(options: SpeechSynthesisOptions): Promise<void> {
    if (this.isSpeaking) {
      this.stopSpeaking();
    }
    
    this.isSpeaking = true;
    this.emit('speech:start');
    this.emit('speak:request', options);
    log.debug('TTS requested:', options.text.substring(0, 50) + '...');
  }

  onSpeechEnd(): void {
    this.isSpeaking = false;
    this.emit('speech:end');
  }

  onSpeechError(error: Error): void {
    this.isSpeaking = false;
    this.emit('speech:error', { error: error.message });
  }

  stopSpeaking(): void {
    if (!this.isSpeaking) return;
    this.isSpeaking = false;
    this.emit('speech:stop');
    this.emit('speech:stopped');
  }

  isSpeakingActive(): boolean {
    return this.isSpeaking;
  }

  // Available voices
  prepareRealtimeConnection(options: {
    apiKey: string;
    model?: string;
    voice?: string;
  }): { ready: boolean; message: string } {
    log.info('Preparing OpenAI Realtime connection...');
    
    this.emit('realtime:ready', {
      model: options.model || this.config.model,
      voice: options.voice || this.config.voice,
      provider: this.config.provider,
    });

    return { 
      ready: true, 
      message: 'Realtime API connection prepared. Use frontend SDK for actual connection.' 
    };
  }

  cleanup(): void {
    this.stopListening();
    this.stopSpeaking();
    this.removeAllListeners();
    log.info('RealtimeManager cleaned up');
  }
}

export default RealtimeManager;
