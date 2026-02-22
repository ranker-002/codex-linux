import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { Play, Square, Trash2, FolderOpen } from 'lucide-react';

interface TerminalProps {
  worktreePath: string;
  onCommand?: (command: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ worktreePath, onCommand }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      rows: 20
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();

    // Write initial prompt
    term.writeln(`\x1b[32m➜\x1b[0m  \x1b[34m${worktreePath}\x1b[0m`);
    term.write('$ ');

    // Handle input
    let currentLine = '';
    term.onData(data => {
      const code = data.charCodeAt(0);
      
      if (code === 13) { // Enter
        term.writeln('');
        if (currentLine.trim()) {
          executeCommand(currentLine.trim());
        } else {
          term.write('$ ');
        }
        currentLine = '';
      } else if (code === 127) { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code >= 32 && code <= 126) { // Printable characters
        currentLine += data;
        term.write(data);
      }
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [worktreePath]);

  const executeCommand = async (command: string) => {
    if (!xtermRef.current) return;
    
    setIsRunning(true);
    setCurrentCommand(command);
    
    if (onCommand) {
      onCommand(command);
    }

    try {
      const result = await window.electronAPI.terminal.execute({
        command,
        cwd: worktreePath
      });

      if (result.stdout) {
        xtermRef.current.writeln(result.stdout);
      }
      
      if (result.stderr) {
        xtermRef.current.writeln(`\x1b[31m${result.stderr}\x1b[0m`);
      }

      if (result.error) {
        xtermRef.current.writeln(`\x1b[31mError: ${result.error}\x1b[0m`);
      }
    } catch (error) {
      xtermRef.current.writeln(`\x1b[31mFailed to execute command\x1b[0m`);
    }

    setIsRunning(false);
    xtermRef.current.write('\x1b[32m➜\x1b[0m  \x1b[34m$\x1b[0m ');
  };

  const clearTerminal = () => {
    xtermRef.current?.clear();
    xtermRef.current?.writeln(`\x1b[32m➜\x1b[0m  \x1b[34m${worktreePath}\x1b[0m`);
    xtermRef.current?.write('$ ');
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] rounded-lg overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border-b border-[#3e3e3e]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Terminal</span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-400 truncate max-w-xs">{worktreePath}</span>
        </div>
        
        <div className="flex items-center gap-1">
          {isRunning && (
            <div className="flex items-center gap-1 text-xs text-yellow-500 mr-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Running...
            </div>
          )}
          
          <button
            onClick={() => {
              if (isRunning) {
                window.electronAPI.terminal.kill();
              }
            }}
            disabled={!isRunning}
            className="p-1.5 hover:bg-[#3e3e3e] rounded disabled:opacity-50"
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 text-red-400" />
          </button>
          
          <button
            onClick={clearTerminal}
            className="p-1.5 hover:bg-[#3e3e3e] rounded"
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div ref={terminalRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  );
};