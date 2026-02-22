import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, RefreshCw, ExternalLink, Maximize2, Minimize2, Smartphone, Monitor, Tablet } from 'lucide-react';

interface AppPreviewProps {
  projectPath: string;
  port?: number;
  onPortChange?: (port: number) => void;
}

export const AppPreview: React.FC<AppPreviewProps> = ({
  projectPath,
  port = 3000,
  onPortChange,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [url, setUrl] = useState(`http://localhost:${port}`);
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const viewModes = {
    desktop: { width: '100%', height: '100%' },
    tablet: { width: '768px', height: '1024px' },
    mobile: { width: '375px', height: '667px' },
  };

  const startServer = async () => {
    setIsLoading(true);
    try {
      // Detect package.json and start command
      const packageJson = await window.electronAPI.fs.readFile(
        `${projectPath}/package.json`
      );
      const pkg = JSON.parse(packageJson);
      const startCommand = pkg.scripts?.dev || pkg.scripts?.start || 'npm start';

      // Start dev server
      await window.electronAPI.terminal.execute({
        command: startCommand,
        cwd: projectPath,
      });

      // Wait for server to be ready
      await waitForServer(url);
      
      setIsRunning(true);
      addLog(`Server started on ${url}`);
    } catch (error) {
      addLog(`Error: ${error}`);
    }
    setIsLoading(false);
  };

  const stopServer = async () => {
    await window.electronAPI.terminal.kill();
    setIsRunning(false);
    addLog('Server stopped');
  };

  const refreshPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
      addLog('Preview refreshed');
    }
  };

  const waitForServer = async (url: string, timeout = 30000): Promise<void> => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Server failed to start within timeout');
  };

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const openExternal = () => {
    window.electronAPI.shell.openExternal(url);
  };

  return (
    <div className={`flex flex-col bg-card ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={startServer}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isLoading ? 'Starting...' : 'Start'}
            </button>
          ) : (
            <button
              onClick={stopServer}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}

          <button
            onClick={refreshPreview}
            disabled={!isRunning}
            className="p-2 hover:bg-muted rounded-md disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="h-6 w-px bg-border mx-2" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('desktop')}
              className={`p-2 rounded-md ${viewMode === 'desktop' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('tablet')}
              className={`p-2 rounded-md ${viewMode === 'tablet' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`p-2 rounded-md ${viewMode === 'mobile' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              const newPort = parseInt(e.target.value.split(':')[2]) || port;
              onPortChange?.(newPort);
            }}
            className="px-3 py-1.5 bg-background border border-input rounded-md text-sm w-48"
          />

          <button
            onClick={openExternal}
            className="p-2 hover:bg-muted rounded-md"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-muted rounded-md"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center p-4 overflow-auto">
          {isRunning ? (
            <div
              className="bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
              style={viewModes[viewMode]}
            >
              <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                title="App Preview"
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              <Monitor className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">App Preview</p>
              <p className="text-sm mt-2">Start the dev server to see your app</p>
            </div>
          )}
        </div>

        {/* Logs Panel */}
        <div className="w-80 border-l border-border bg-card flex flex-col">
          <div className="px-4 py-2 border-b border-border font-medium text-sm">
            Server Logs
          </div>
          <div className="flex-1 overflow-auto p-2 font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className="text-muted-foreground py-0.5">
                {log}
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-muted-foreground italic">No logs yet...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};