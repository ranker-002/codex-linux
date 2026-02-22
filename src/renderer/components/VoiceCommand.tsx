import React, { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceCommandProps {
  onCommand: (transcript: string) => void;
  disabled?: boolean;
}

export const VoiceCommand: React.FC<VoiceCommandProps> = ({
  onCommand,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onresult = (event) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setTranscript(transcript);

        if (event.results[current].isFinal) {
          onCommand(transcript);
          setTranscript('');
          setIsListening(false);
        }
      };

      rec.onerror = (event) => {
        setError(event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, [onCommand]);

  const toggleListening = useCallback(() => {
    if (!recognition) {
      setError('Speech recognition not supported');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [recognition, isListening]);

  const supportedCommands = [
    'Create a new agent',
    'Open file [filename]',
    'Search for [query]',
    'Run tests',
    'Commit changes',
    'Explain this code',
    'Refactor this function',
  ];

  if (!recognition) {
    return (
      <button
        disabled
        className="p-2 text-muted-foreground cursor-not-allowed"
        title="Voice commands not supported in this browser"
      >
        <MicOff className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleListening}
        disabled={disabled}
        className={`p-2 rounded-full transition-all ${
          isListening
            ? 'bg-red-500 text-white animate-pulse'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
        } disabled:opacity-50`}
        title={isListening ? 'Stop listening' : 'Start voice command'}
      >
        {isListening ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {isListening && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg p-3 shadow-lg whitespace-nowrap z-50">
          <div className="text-sm font-medium mb-2">
            {transcript || 'Listening...'}
          </div>
          <div className="text-xs text-muted-foreground">
            Try saying: "Create a new agent" or "Explain this code"
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground rounded-lg p-2 text-xs whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
};