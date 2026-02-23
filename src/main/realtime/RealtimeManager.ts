import { EventEmitter } from 'events';
import log from 'electron-log';
import { RealtimeConfig, SpeechRecognitionResult, SpeechSynthesisOptions } from '../../shared/types';

export class RealtimeManager extends EventEmitter {
  private config: RealtimeConfig;
  private isListening = false;
  private recognition: any = null;
  private audioContext: AudioContext | null = null;

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

  // Speech-to-Text (STT) - Browser Web Speech API
  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported in this browser');
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language || 'en-US';

      this.recognition.onresult = (event: any) => {
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; i++) {
          const result = results[i];
          if (result.isFinal) {
            const speechResult: SpeechRecognitionResult = {
              transcript: result[0].transcript,
              confidence: result[0].confidence,
              isFinal: true,
              timestamp: new Date(),
            };
            this.emit('speech:final', speechResult);
          } else {
            const interimResult: SpeechRecognitionResult = {
              transcript: result[0].transcript,
              confidence: result[0].confidence,
              isFinal: false,
              timestamp: new Date(),
            };
            this.emit('speech:interim', interimResult);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        log.error('Speech recognition error:', event.error);
        this.emit('speech:error', { error: event.error });
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          this.recognition.start();
        }
      };

      this.recognition.start();
      this.isListening = true;
      this.emit('listening:started');

      log.info('Speech recognition started');
    } catch (error) {
      log.error('Failed to start speech recognition:', error);
      throw error;
    }
  }

  stopListening(): void {
    if (!this.isListening || !this.recognition) return;

    this.recognition.stop();
    this.isListening = false;
    this.emit('listening:stopped');

    log.info('Speech recognition stopped');
  }

  isActive(): boolean {
    return this.isListening;
  }

  // Text-to-Speech (TTS)
  async loadVoices(): Promise<SpeechSynthesisVoice[]> {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        const loadVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          resolve(voices);
        };

        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
        setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
      } else {
        resolve([]);
      }
    });
  }

  getVoices(): SpeechSynthesisVoice[] {
    if ('speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }

  async speak(options: SpeechSynthesisOptions): Promise<void> {
    if (!('speechSynthesis' in window)) {
      throw new Error('Speech synthesis not supported');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(options.text);
      
      if (options.voice) {
        const voice = this.getVoices().find(v => v.name === options.voice || v.voiceURI === options.voice);
        if (voice) {
          utterance.voice = voice;
        }
      }

      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      utterance.onend = () => {
        this.emit('speech:end');
        resolve();
      };

      utterance.onerror = (event) => {
        log.error('Speech synthesis error:', event);
        this.emit('speech:error', { error: event.error });
        reject(new Error(event.error));
      };

      window.speechSynthesis.speak(utterance);
      this.emit('speech:start');

      log.debug('Speaking:', options.text.substring(0, 50) + '...');
    });
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.emit('speech:stopped');
    }
  }

  // OpenAI Realtime API support
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

  // Audio Context for PCM audio processing
  async initAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  cleanup(): void {
    this.stopListening();
    this.stopSpeaking();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.removeAllListeners();
    log.info('RealtimeManager cleaned up');
  }
}

export default RealtimeManager;
