import React, { useState, useCallback, useEffect } from 'react';
import { Search, FileText, Loader2, X, ChevronRight } from 'lucide-react';
import { debounce } from 'lodash';

interface SearchResult {
  path: string;
  matches: Array<{ line: number; content: string }>;
}

interface SearchPanelProps {
  rootPath: string;
  onFileSelect: (path: string) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ rootPath, onFileSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pattern, setPattern] = useState('');
  const [selectedResult, setSelectedResult] = useState<number | null>(null);

  const performSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const searchResults = await window.electronAPI.search.files({
          query: searchQuery,
          path: rootPath,
          pattern: pattern || undefined
        });
        setResults(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
      }
      setIsSearching(false);
    }, 300),
    [rootPath, pattern]
  );

  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSelectedResult(null);
  };

  const highlightMatch = (content: string, searchTerm: string) => {
    const parts = content.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-yellow-900 dark:text-yellow-100">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Search Header */}
      <div className="p-4 border-b border-border">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search in files..."
            className="w-full pl-10 pr-10 py-2 bg-background border border-input rounded-md"
            autoFocus
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            placeholder="File pattern (e.g., *.js)"
            className="flex-1 px-3 py-1.5 bg-background border border-input rounded-md text-sm"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : results.length > 0 ? (
          <div className="divide-y divide-border">
            {results.map((result, resultIndex) => (
              <div key={result.path} className="p-3 hover:bg-muted/50">
                <button
                  onClick={() => {
                    setSelectedResult(resultIndex);
                    onFileSelect(result.path);
                  }}
                  className="flex items-center gap-2 text-sm font-medium text-primary hover:underline mb-2"
                >
                  <FileText className="w-4 h-4" />
                  {result.path.replace(rootPath, '')}
                  <span className="text-xs text-muted-foreground">
                    ({result.matches.length} matches)
                  </span>
                </button>

                <div className="space-y-1">
                  {result.matches.slice(0, 3).map((match, matchIndex) => (
                    <div
                      key={matchIndex}
                      className="flex items-start gap-3 px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted rounded cursor-pointer"
                      onClick={() => onFileSelect(result.path)}
                    >
                      <span className="text-xs text-muted-foreground w-8 flex-shrink-0">
                        {match.line}
                      </span>
                      <code className="flex-1 truncate font-mono text-xs">
                        {highlightMatch(match.content, query)}
                      </code>
                    </div>
                  ))}
                  {result.matches.length > 3 && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                      +{result.matches.length - 3} more matches
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : query.length >= 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">No results found</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">Type to search</p>
            <p className="text-xs mt-1">Search across all files in the workspace</p>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {results.length > 0 && (
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
          {results.length} files with {results.reduce((sum, r) => sum + r.matches.length, 0)} matches
        </div>
      )}
    </div>
  );
};