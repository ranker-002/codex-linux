import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileText, Folder } from 'lucide-react';

interface MentionAutocompleteProps {
  input: string;
  cursorPosition: number;
  projectPath: string;
  onSelect: (filePath: string) => void;
  onClose: () => void;
}

interface FileItem {
  path: string;
  name: string;
  isDirectory: boolean;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  input,
  cursorPosition,
  projectPath,
  onSelect,
  onClose
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract mention query from input
  useEffect(() => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [input, cursorPosition]);

  // Load files from project recursively
  useEffect(() => {
    const loadFiles = async () => {
      if (!projectPath || !showDropdown) return;
      
      try {
        const fileItems: FileItem[] = [];
        
        const scanDirectory = async (dirPath: string, basePath: string) => {
          try {
            const entries = await window.electronAPI.fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = `${dirPath}/${entry.name}`;
              const relativePath = fullPath.replace(basePath + '/', '');
              
              // Skip node_modules and hidden files
              if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                continue;
              }
              
              fileItems.push({
                path: relativePath,
                name: entry.name,
                isDirectory: entry.isDirectory()
              });
              
              // Recursively scan directories
              if (entry.isDirectory()) {
                await scanDirectory(fullPath, basePath);
              }
            }
          } catch (error) {
            // Skip directories we can't read
            console.debug('Skipping directory:', dirPath);
          }
        };
        
        await scanDirectory(projectPath, projectPath);
        setFiles(fileItems);
      } catch (error) {
        console.error('Failed to load files:', error);
      }
    };

    loadFiles();
  }, [projectPath, showDropdown]);

  // Filter files based on query
  useEffect(() => {
    if (!mentionQuery) {
      // Show recent/frequent files when no query
      setFilteredFiles(files.slice(0, 10));
    } else {
      const query = mentionQuery.toLowerCase();
      const filtered = files
        .filter(file => 
          file.name.toLowerCase().includes(query) ||
          file.path.toLowerCase().includes(query)
        )
        .slice(0, 10);
      setFilteredFiles(filtered);
    }
    setSelectedIndex(0);
  }, [mentionQuery, files]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredFiles.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          handleSelect(filteredFiles[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [showDropdown, filteredFiles, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown, onClose]);

  const handleSelect = (file: FileItem) => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const textAfterCursor = input.slice(cursorPosition);
    
    // Replace the mention query with the selected file path
    const mentionStart = textBeforeCursor.lastIndexOf('@');
    const newTextBeforeCursor = textBeforeCursor.slice(0, mentionStart) + `@${file.path}`;
    
    onSelect(newTextBeforeCursor + textAfterCursor);
    onClose();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary text-primary-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!showDropdown || filteredFiles.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 w-80 max-h-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50"
    >
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">
          {mentionQuery ? 'Matching files' : 'Recent files'}
        </span>
      </div>
      
      <div className="overflow-y-auto max-h-52">
        {filteredFiles.map((file, index) => (
          <button
            key={file.path}
            onClick={() => handleSelect(file)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-primary/10'
                : 'hover:bg-muted'
            }`}
          >
            {file.isDirectory ? (
              <Folder className="w-4 h-4 text-yellow-500" />
            ) : (
              <FileText className="w-4 h-4 text-blue-500" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">
                {highlightMatch(file.name, mentionQuery)}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {highlightMatch(file.path, mentionQuery)}
              </div>
            </div>
          </button>
        ))}
      </div>
      
      <div className="px-3 py-2 border-t border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex gap-2">
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>Esc to close</span>
        </div>
        <span>{filteredFiles.length} files</span>
      </div>
    </div>
  );
};

export default MentionAutocomplete;
