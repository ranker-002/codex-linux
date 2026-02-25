import React, { useState, useCallback } from 'react';
import { FileCode, FolderOpen, X, Save, Plus, File, ChevronRight, ChevronDown, Search } from 'lucide-react';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileItem[];
  content?: string;
}

interface FileExplorerPanelProps {
  files: FileItem[];
  selectedFile: string | null;
  onFileSelect: (path: string) => void;
  onFileCreate: (path: string, type: 'file' | 'folder') => void;
  onFileDelete: (path: string) => void;
  onFileRename: (oldPath: string, newPath: string) => void;
}

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

const FileIcon = ({ type, isOpen }: { type: 'file' | 'folder'; isOpen: boolean }) => {
  if (type === 'folder') {
    return isOpen ? (
      <FolderOpen className="w-4 h-4 text-[var(--warning)]" />
    ) : (
      <FolderOpen className="w-4 h-4 text-[var(--warning)]" />
    );
  }
  return <File className="w-4 h-4 text-[var(--text-muted)]" />;
};

export const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({
  files,
  selectedFile,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileRename,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'file' | 'folder'>('file');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleCreateFile = (parentPath: string) => {
    if (!newFileName.trim()) return;
    const fullPath = parentPath ? `${parentPath}/${newFileName}` : newFileName;
    onFileCreate(fullPath, newFileType);
    setShowNewFileInput(null);
    setNewFileName('');
  };

  const handleRename = (path: string) => {
    if (!editName.trim()) return;
    onFileRename(path, editName);
    setEditingFile(null);
    setEditName('');
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  };

  const filterFiles = (items: FileItem[], query: string): FileItem[] => {
    if (!query) return items;
    return items.filter(item => {
      if (item.name.toLowerCase().includes(query.toLowerCase())) return true;
      if (item.children) {
        const filtered = filterFiles(item.children, query);
        return filtered.length > 0;
      }
      return false;
    });
  };

  const renderFile = (item: FileItem, depth: number = 0) => {
    const isFolder = item.type === 'folder';
    const isExpanded = expandedFolders.has(item.path);
    const isSelected = selectedFile === item.path;
    const isEditing = editingFile === item.path;

    return (
      <div key={item.path}>
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1 cursor-pointer rounded-md transition-colors group',
            isSelected && 'bg-[var(--a-bg-xs)] text-[var(--a-400)]',
            !isSelected && 'hover:bg-[var(--bg-hover)]'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(item.path);
            } else {
              onFileSelect(item.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, item.path)}
        >
          {isFolder ? (
            <button className="p-0.5 hover:bg-[var(--bg-hover)] rounded">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          
          <FileIcon type={item.type} isOpen={isExpanded} />
          
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(item.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(item.path);
                if (e.key === 'Escape') setEditingFile(null);
              }}
              className="flex-1 px-1 py-0.5 text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm truncate">{item.name}</span>
          )}
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu(null);
              setShowNewFileInput(item.path);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--bg-hover)] rounded transition-opacity"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        
        {isFolder && isExpanded && item.children && (
          <div>
            {item.children.map(child => renderFile(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredFiles = filterFiles(files, searchQuery);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-card)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-2">
          <FileCode className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Files</span>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] placeholder:text-[var(--text-disabled)]"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto p-2">
        {filteredFiles.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No files</p>
          </div>
        ) : (
          filteredFiles.map(file => renderFile(file))
        )}
        
        {/* New file input */}
        {showNewFileInput !== null && (
          <div className="px-2 py-1">
            <div className="flex items-center gap-1">
              <FileIcon type={newFileType} isOpen={false} />
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile(showNewFileInput);
                  if (e.key === 'Escape') setShowNewFileInput(null);
                }}
                onBlur={() => handleCreateFile(showNewFileInput)}
                placeholder={newFileType === 'file' ? 'filename.ext' : 'folder name'}
                className="flex-1 px-2 py-1 text-sm bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded"
                autoFocus
              />
              <button
                onClick={() => setNewFileType(newFileType === 'file' ? 'folder' : 'file')}
                className="p-1 hover:bg-[var(--bg-hover)] rounded text-xs"
              >
                {newFileType === 'file' ? 'Folder' : 'File'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Root actions */}
      <div className="px-3 py-2 border-t border-[var(--border-subtle)] flex gap-2">
        <button
          onClick={() => {
            setShowNewFileInput('');
            setNewFileType('file');
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-secondary)]"
        >
          <Plus className="w-3 h-3" />
          New File
        </button>
        <button
          onClick={() => {
            setShowNewFileInput('');
            setNewFileType('folder');
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-[var(--bg-hover)] rounded transition-colors text-[var(--text-secondary)]"
        >
          <Plus className="w-3 h-3" />
          New Folder
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-md shadow-lg py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                const file = files.find(f => f.path === contextMenu.path);
                if (file) {
                  setEditingFile(contextMenu.path);
                  setEditName(file.name);
                }
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--bg-hover)] flex items-center gap-2 text-[var(--text-secondary)]"
            >
              Rename
            </button>
            <button
              onClick={() => {
                onFileDelete(contextMenu.path);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--bg-hover)] flex items-center gap-2 text-[var(--error)]"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default FileExplorerPanel;
