import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronRight, ChevronDown, RefreshCw, Search, Filter } from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
  isLoading?: boolean;
}

interface FileExplorerProps {
  rootPath: string;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  fileFilter?: string[];
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  rootPath,
  onFileSelect,
  selectedFile,
  fileFilter
}) => {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadDirectory = useCallback(async (path: string): Promise<FileNode[]> => {
    try {
      const entries = await window.electronAPI.fs.readdir(path, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (entry.name.startsWith('.') && entry.name !== '.git') continue;
        if (entry.name === 'node_modules') continue;
        if (entry.name === 'dist') continue;
        if (entry.name === 'build') continue;

        const fullPath = `${path}/${entry.name}`;
        const node: FileNode = {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'directory' : 'file'
        };

        if (entry.isDirectory()) {
          node.children = [];
        }

        nodes.push(node);
      }

      // Sort: directories first, then files
      return nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error) {
      console.error('Failed to load directory:', error);
      return [];
    }
  }, []);

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    const root: FileNode = {
      name: rootPath.split('/').pop() || 'root',
      path: rootPath,
      type: 'directory',
      expanded: true,
      children: await loadDirectory(rootPath)
    };
    setTree(root);
    setIsLoading(false);
  }, [rootPath, loadDirectory]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const toggleNode = async (node: FileNode, parentPath: string[]) => {
    if (node.type !== 'directory') {
      onFileSelect(node.path);
      return;
    }

    const updateTree = (current: FileNode, path: string[]): FileNode => {
      if (path.length === 0) {
        return {
          ...current,
          expanded: !current.expanded,
          children: current.expanded ? current.children : undefined
        };
      }

      if (!current.children) return current;

      return {
        ...current,
        children: current.children.map(child => 
          child.name === path[0] ? updateTree(child, path.slice(1)) : child
        )
      };
    };

    if (!node.children || node.children.length === 0) {
      // Load children
      const children = await loadDirectory(node.path);
      const updateTreeWithChildren = (current: FileNode, path: string[]): FileNode => {
        if (path.length === 0) {
          return { ...current, expanded: true, children };
        }
        if (!current.children) return current;
        return {
          ...current,
          children: current.children.map(child => 
            child.name === path[0] ? updateTreeWithChildren(child, path.slice(1)) : child
          )
        };
      };
      setTree(prev => prev ? updateTreeWithChildren(prev, [...parentPath, node.name]) : null);
    } else {
      setTree(prev => prev ? updateTree(prev, [...parentPath, node.name]) : null);
    }
  };

  const filterNodes = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes;
    
    return nodes.reduce<FileNode[]>((acc, node) => {
      const matches = node.name.toLowerCase().includes(query.toLowerCase());
      
      if (node.type === 'directory' && node.children) {
        const filteredChildren = filterNodes(node.children, query);
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren, expanded: true });
        }
      } else if (matches) {
        acc.push(node);
      }
      
      return acc;
    }, []);
  };

  const renderNode = (node: FileNode, depth: number = 0, parentPath: string[] = []): React.ReactNode => {
    const isSelected = selectedFile === node.path;
    const paddingLeft = depth * 16 + 8;

    return (
      <div key={node.path}>
        <div
          onClick={() => toggleNode(node, parentPath)}
          className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-muted transition-colors ${
            isSelected ? 'bg-primary/10 text-primary' : ''
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {node.type === 'directory' && (
            <span className="w-4 h-4 flex items-center justify-center">
              {node.expanded ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
            </span>
          )}
          
          {node.type === 'directory' ? (
            <Folder className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-blue-500'}`} />
          ) : (
            <File className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
          )}
          
          <span className="text-sm truncate">{node.name}</span>
        </div>

        {node.type === 'directory' && node.expanded && node.children && (
          <div>
            {node.children.map(child => 
              renderNode(child, depth + 1, [...parentPath, node.name])
            )}
          </div>
        )}
      </div>
    );
  };

  const filteredTree = tree && searchQuery 
    ? { ...tree, children: filterNodes(tree.children || [], searchQuery) }
    : tree;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">Explorer</span>
          <button
            onClick={loadTree}
            className="p-1.5 hover:bg-muted rounded-md"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-md text-sm"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-auto py-2">
        {filteredTree ? (
          renderNode(filteredTree)
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {isLoading ? 'Loading...' : 'No files'}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
        {tree?.children?.length || 0} items
      </div>
    </div>
  );
};