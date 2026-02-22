import React, { useState } from 'react';
import { GitCommit, GitBranch, GitPullRequest, Check, X, FileText, RefreshCw } from 'lucide-react';

interface GitPanelProps {
  repoPath: string;
  onCommit: (message: string) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ repoPath, onCommit }) => {
  const [stagedFiles, setStagedFiles] = useState<string[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<string[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const status = await window.electronAPI.git.status(repoPath);
      setStagedFiles(status.staged);
      setUnstagedFiles(status.unstaged);
    } catch (error) {
      console.error('Failed to load git status:', error);
    }
    setIsLoading(false);
  };

  const handleStage = async (file: string) => {
    // In a real implementation, this would call git add
    setUnstagedFiles(prev => prev.filter(f => f !== file));
    setStagedFiles(prev => [...prev, file]);
  };

  const handleUnstage = async (file: string) => {
    setStagedFiles(prev => prev.filter(f => f !== file));
    setUnstagedFiles(prev => [...prev, file]);
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.length === 0) return;
    
    try {
      await window.electronAPI.git.commit({
        repoPath,
        message: commitMessage,
        files: stagedFiles
      });
      setCommitMessage('');
      setStagedFiles([]);
      onCommit(commitMessage);
    } catch (error) {
      console.error('Failed to commit:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Git</span>
        </div>
        <button
          onClick={loadStatus}
          disabled={isLoading}
          className="p-2 hover:bg-muted rounded-md disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Staged Changes */}
      <div className="flex-1 overflow-auto p-4">
        {stagedFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-green-500 mb-2 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Staged Changes ({stagedFiles.length})
            </h3>
            <div className="space-y-1">
              {stagedFiles.map(file => (
                <div
                  key={file}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500/5 rounded-md group"
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{file}</span>
                  <button
                    onClick={() => handleUnstage(file)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 text-red-500 rounded"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {unstagedFiles.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Changes ({unstagedFiles.length})
            </h3>
            <div className="space-y-1">
              {unstagedFiles.map(file => (
                <div
                  key={file}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-muted rounded-md group cursor-pointer"
                  onClick={() => handleStage(file)}
                >
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{file}</span>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-green-500/10 text-green-500 rounded">
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {stagedFiles.length === 0 && unstagedFiles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <GitCommit className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No changes</p>
            <p className="text-xs mt-1">Working tree clean</p>
          </div>
        )}
      </div>

      {/* Commit Section */}
      {stagedFiles.length > 0 && (
        <div className="p-4 border-t border-border bg-background/50">
          <textarea
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm resize-none h-20 mb-3"
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            <GitCommit className="w-4 h-4" />
            Commit {stagedFiles.length} files
          </button>
        </div>
      )}
    </div>
  );
};