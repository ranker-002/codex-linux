import React, { useState } from 'react';
import { Worktree } from '../../shared/types';
import { GitBranch, Plus, Folder, Trash2, GitMerge } from 'lucide-react';

interface WorktreePanelProps {
  worktrees: Worktree[];
  onCreateWorktree: (repoPath: string, name: string) => Promise<Worktree>;
}

export const WorktreePanel: React.FC<WorktreePanelProps> = ({
  worktrees,
  onCreateWorktree
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorktreeConfig, setNewWorktreeConfig] = useState({
    repoPath: '',
    name: ''
  });

  const handleCreate = async () => {
    try {
      await onCreateWorktree(newWorktreeConfig.repoPath, newWorktreeConfig.name);
      setShowCreateModal(false);
      setNewWorktreeConfig({ repoPath: '', name: '' });
    } catch (error) {
      console.error('Failed to create worktree:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Worktrees</h2>
          <p className="text-sm text-muted-foreground">Isolated workspaces for agents</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New Worktree
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {worktrees.map(worktree => (
            <div
              key={worktree.name}
              className="p-4 bg-card border border-border rounded-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{worktree.name}</span>
                </div>
                {worktree.isMain && (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    Main
                  </span>
                )}
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  <span className="truncate">{worktree.path}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  <span>{worktree.branch}</span>
                </div>
                <div className="text-xs font-mono truncate">
                  {worktree.commit?.slice(0, 8)}
                </div>
              </div>

              {!worktree.isMain && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <button className="flex-1 px-3 py-1.5 text-sm bg-muted rounded-md hover:bg-muted/80">
                    <GitMerge className="w-4 h-4 inline mr-1" />
                    Merge
                  </button>
                  <button className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {worktrees.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
              <GitBranch className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No worktrees yet</p>
              <p className="text-sm">Create a worktree to isolate agent changes</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[500px]">
            <h2 className="text-lg font-semibold mb-4">Create New Worktree</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Repository Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWorktreeConfig.repoPath}
                    onChange={e => setNewWorktreeConfig({ ...newWorktreeConfig, repoPath: e.target.value })}
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md"
                    placeholder="/path/to/repo"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.dialog.selectFolder();
                      if (path) setNewWorktreeConfig({ ...newWorktreeConfig, repoPath: path });
                    }}
                    className="px-3 py-2 bg-muted rounded-md"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Worktree Name</label>
                <input
                  type="text"
                  value={newWorktreeConfig.name}
                  onChange={e => setNewWorktreeConfig({ ...newWorktreeConfig, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="feature-branch"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newWorktreeConfig.repoPath || !newWorktreeConfig.name}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
              >
                Create Worktree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};