import React, { useState, useCallback } from 'react';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { SplitPane } from './SplitPane';
import { X, FileCode } from 'lucide-react';

interface CodeWorkspaceProps {
  rootPath?: string;
}

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({ rootPath = '/' }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLanguage, setFileLanguage] = useState<string>('plaintext');
  const [isLoading, setIsLoading] = useState(false);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'md': 'markdown',
      'mdx': 'markdown',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'cs': 'csharp',
      'rb': 'ruby',
      'php': 'php',
      'sql': 'sql',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'dockerfile': 'dockerfile',
      'toml': 'ini',
      'ini': 'ini',
    };
    return langMap[ext || ''] || 'plaintext';
  };

  const handleFileSelect = useCallback(async (path: string) => {
    if (openFiles.includes(path)) {
      setActiveFile(path);
      return;
    }

    setIsLoading(true);
    try {
      const content = await window.electronAPI.fs.readFile(path);
      setFileContent(content);
      setSelectedFile(path);
      setFileLanguage(getLanguageFromPath(path));
      setOpenFiles(prev => [...prev, path]);
      setActiveFile(path);
    } catch (error) {
      console.error('Failed to read file:', error);
    } finally {
      setIsLoading(false);
    }
  }, [openFiles]);

  const handleCloseFile = (path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newOpenFiles = openFiles.filter(f => f !== path);
    setOpenFiles(newOpenFiles);
    
    if (activeFile === path) {
      setActiveFile(newOpenFiles[newOpenFiles.length - 1] || null);
    }
  };

  const handleSaveFile = useCallback(async (content: string) => {
    if (!activeFile) return;
    
    try {
      await window.electronAPI.fs.writeFile(activeFile, content);
      setFileContent(content);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [activeFile]);

  const getFileName = (path: string): string => {
    return path.split('/').pop() || path;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      {openFiles.length > 0 && (
        <div className="flex items-center bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] overflow-x-auto">
          {openFiles.map(file => (
            <div
              key={file}
              onClick={() => setActiveFile(file)}
              className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-r border-[var(--border-subtle)] min-w-0 ${
                activeFile === file 
                  ? 'bg-[var(--bg-app)] text-[var(--text-primary)]' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <FileCode className="w-4 h-4 flex-shrink-0" />
              <span className="truncate max-w-32">{getFileName(file)}</span>
              <button
                onClick={(e) => handleCloseFile(file, e)}
                className="ml-1 p-0.5 hover:bg-[var(--bg-hover)] rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        <SplitPane
          direction="horizontal"
          defaultRatio={0.2}
          minSize={150}
          maxSize={400}
        >
          <div className="h-full overflow-hidden">
            <FileExplorer
              rootPath={rootPath}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile || undefined}
            />
          </div>
          
          <div className="h-full overflow-hidden bg-[var(--bg-app)]">
            {activeFile ? (
              <CodeEditor
                value={fileContent}
                language={fileLanguage}
                onChange={(value) => setFileContent(value || '')}
                onSave={handleSaveFile}
                height="100%"
                dataTestid="code-workspace-editor"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                <div className="text-center">
                  <FileCode className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Select a file to edit</p>
                  <p className="text-sm mt-2">Or use the file explorer to browse</p>
                </div>
              </div>
            )}
          </div>
        </SplitPane>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-4">
          {activeFile && (
            <>
              <span>{getFileName(activeFile)}</span>
              <span>{fileLanguage}</span>
              <span>{fileContent.split('\n').length} lines</span>
            </>
          )}
        </div>
        <div>
          {isLoading && <span className="text-[var(--a-400)]">Loading...</span>}
        </div>
      </div>
    </div>
  );
};

export default CodeWorkspace;
