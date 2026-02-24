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
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div>
          <h2 
            className="text-[18px] font-medium text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}
          >
            Worktrees
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">Isolated workspaces for agents</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] hover:bg-[var(--teal-400)] text-[13px] font-medium transition-colors"
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
              className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] hover:border-[var(--border-accent)] hover:translate-y-[-2px] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-[var(--text-muted)]" />
                  <span className="font-medium text-[13px] text-[var(--text-primary)]">{worktree.name}</span>
                </div>
                {worktree.isMain && (
                  <span className="badge badge-teal text-[10px]">
                    Main
                  </span>
                )}
              </div>

              <div className="space-y-2 text-[12px] text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4" />
                  <span className="truncate">{worktree.path}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4" />
                  <span>{worktree.branch}</span>
                </div>
                <div className="text-[11px] font-[var(--font-mono)] text-[var(--teal-300)] truncate">
                  {worktree.commit?.slice(0, 8)}
                </div>
              </div>

              {!worktree.isMain && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border-faint)]">
                  <button className="flex-1 px-3 py-1.5 text-[12px] bg-[var(--bg-hover)] rounded-[var(--radius-sm)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition-colors">
                    <GitMerge className="w-4 h-4 inline mr-1" />
                    Merge
                  </button>
                  <button className="p-1.5 text-[var(--error)] hover:bg-[rgba(232,90,106,0.1)] rounded-[var(--radius-sm)] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {worktrees.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
              <GitBranch className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-[15px] font-medium text-[var(--text-primary)]">No worktrees yet</p>
              <p className="text-[12px]">Create a worktree to isolate agent changes</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-[rgba(3,7,9,0.8)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 w-[500px]">
            <h2 className="text-[16px] font-medium text-[var(--text-primary)] mb-4">Create New Worktree</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Repository Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWorktreeConfig.repoPath}
                    onChange={e => setNewWorktreeConfig({ ...newWorktreeConfig, repoPath: e.target.value })}
                    className="flex-1 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                    placeholder="/path/to/repo"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.dialog.selectFolder();
                      if (path) setNewWorktreeConfig({ ...newWorktreeConfig, repoPath: path });
                    }}
                    className="px-3 py-2 bg-[var(--bg-hover)] rounded-[var(--radius-md)] hover:bg-[var(--bg-active)] text-[13px] text-[var(--text-secondary)] transition-colors"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Worktree Name</label>
                <input
                  type="text"
                  value={newWorktreeConfig.name}
                  onChange={e => setNewWorktreeConfig({ ...newWorktreeConfig, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                  placeholder="feature-branch"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newWorktreeConfig.repoPath || !newWorktreeConfig.name}
                className="px-4 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] disabled:opacity-50 text-[13px] font-medium transition-colors hover:bg-[var(--teal-400)]"
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
