import React, { useState, useCallback, useEffect } from 'react';
import { Search, Replace, ChevronDown, ChevronUp, X, FileText } from 'lucide-react';
import { debounce } from 'lodash';

interface SearchReplaceProps {
  rootPath: string;
  onClose: () => void;
}

interface SearchMatch {
  file: string;
  line: number;
  column: number;
  content: string;
}

export const SearchReplace: React.FC<SearchReplaceProps> = ({
  rootPath,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [filePattern, setFilePattern] = useState('*');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const [includeIgnored, setIncludeIgnored] = useState(false);

  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setMatches([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await window.electronAPI.search.files({
          query,
          path: rootPath,
          pattern: filePattern !== '*' ? filePattern : undefined,
        });

        const allMatches: SearchMatch[] = [];
        results.forEach((result: any) => {
          result.matches.forEach((match: any) => {
            allMatches.push({
              file: result.path,
              line: match.line,
              column: match.content.indexOf(query) + 1,
              content: match.content,
            });
          });
        });

        setMatches(allMatches);
        setCurrentMatchIndex(0);
      } catch (error) {
        console.error('Search failed:', error);
      }
      setIsSearching(false);
    }, 300),
    [rootPath, filePattern]
  );

  useEffect(() => {
    performSearch(searchQuery);
  }, [searchQuery, performSearch]);

  const handleReplace = async () => {
    if (!replaceQuery.trim() || matches.length === 0) return;

    let replaced = 0;
    for (const match of matches) {
      try {
        const content = await window.electronAPI.fs.readFile(match.file);
        const lines = content.split('\n');
        
        if (lines[match.line - 1]) {
          const searchRegex = isRegex
            ? new RegExp(searchQuery, caseSensitive ? 'g' : 'gi')
            : new RegExp(
                searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                caseSensitive ? 'g' : 'gi'
              );
          
          lines[match.line - 1] = lines[match.line - 1].replace(
            searchRegex,
            replaceQuery
          );
          
          await window.electronAPI.fs.writeFile(match.file, lines.join('\n'));
          replaced++;
        }
      } catch (error) {
        console.error(`Failed to replace in ${match.file}:`, error);
      }
    }

    // Refresh search
    performSearch(searchQuery);
  };

  const navigateMatch = (direction: 'prev' | 'next') => {
    if (matches.length === 0) return;
    
    if (direction === 'next') {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    } else {
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  };

  const highlightMatch = (content: string, query: string) => {
    if (!query) return content;
    
    const parts = content.split(new RegExp(`(${query})`, caseSensitive ? 'g' : 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-900 dark:text-yellow-100">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold">
          {showReplace ? 'Search & Replace' : 'Search'}
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md"
            autoFocus
          />
        </div>

        {/* Replace Input */}
        {showReplace && (
          <div className="relative">
            <Replace className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              placeholder="Replace..."
              className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md"
            />
          </div>
        )}

        {/* Options */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsRegex(!isRegex)}
            className={`px-2 py-1 text-xs rounded ${
              isRegex ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            .*
          </button>
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`px-2 py-1 text-xs rounded ${
              caseSensitive ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            Aa
          </button>
          <button
            onClick={() => setWholeWord(!wholeWord)}
            className={`px-2 py-1 text-xs rounded ${
              wholeWord ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            ""
          </button>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/80"
          >
            {showReplace ? 'Hide Replace' : 'Show Replace'}
          </button>
        </div>

        {/* File Pattern */}
        <input
          type="text"
          value={filePattern}
          onChange={(e) => setFilePattern(e.target.value)}
          placeholder="Files to include (e.g., *.ts)"
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
        />

        {/* Replace Actions */}
        {showReplace && matches.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleReplace}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
            >
              Replace All ({matches.length})
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Searching...
          </div>
        ) : matches.length > 0 ? (
          <div>
            <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border flex items-center justify-between">
              <span>{matches.length} results</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateMatch('prev')}
                  className="p-1 hover:bg-muted rounded"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <span>{currentMatchIndex + 1}</span>
                <button
                  onClick={() => navigateMatch('next')}
                  className="p-1 hover:bg-muted rounded"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            {matches.map((match, index) => (
              <div
                key={`${match.file}-${match.line}`}
                className={`px-4 py-2 border-b border-border cursor-pointer ${
                  index === currentMatchIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
                }`}
                onClick={() => setCurrentMatchIndex(index)}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <FileText className="w-3 h-3" />
                  <span className="truncate">{match.file.replace(rootPath, '')}</span>
                  <span>:{match.line}</span>
                </div>
                <code className="text-xs font-mono block truncate">
                  {highlightMatch(match.content, searchQuery)}
                </code>
              </div>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No results</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};