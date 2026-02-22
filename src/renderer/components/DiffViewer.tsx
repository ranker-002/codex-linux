import React, { useState } from 'react';
import { CodeChange, ChangeStatus } from '../shared/types';
import { 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight,
  FileCode,
  GitCommit,
  GitPullRequest,
  MessageSquare
} from 'lucide-react';

interface DiffViewerProps {
  changes: CodeChange[];
  onApprove: (changeId: string) => void;
  onReject: (changeId: string, comment?: string) => void;
  onApply: (changeId: string) => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  changes,
  onApprove,
  onReject,
  onApply
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');

  const currentChange = changes[currentIndex];
  const pendingChanges = changes.filter(c => c.status === ChangeStatus.PENDING);

  const parseDiff = (diff: string) => {
    const lines: { type: 'header' | 'addition' | 'deletion' | 'context'; content: string; lineNum?: number }[] = [];
    const diffLines = diff.split('\n');
    
    for (const line of diffLines) {
      if (line.startsWith('@@')) {
        lines.push({ type: 'header', content: line });
      } else if (line.startsWith('+')) {
        lines.push({ type: 'addition', content: line.slice(1) });
      } else if (line.startsWith('-')) {
        lines.push({ type: 'deletion', content: line.slice(1) });
      } else if (line.startsWith(' ')) {
        lines.push({ type: 'context', content: line.slice(1) });
      } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
        lines.push({ type: 'header', content: line });
      }
    }
    
    return lines;
  };

  const getStats = (diff: string) => {
    const additions = (diff.match(/^\+/gm) || []).length;
    const deletions = (diff.match(/^-/gm) || []).length;
    return { additions, deletions };
  };

  if (!currentChange) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <GitPullRequest className="w-16 h-16 mb-4 opacity-30" />
        <h3 className="text-lg font-medium">No Changes to Review</h3>
        <p className="text-sm mt-2">All changes have been reviewed</p>
      </div>
    );
  }

  const stats = getStats(currentChange.diff);
  const diffLines = parseDiff(currentChange.diff);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium truncate max-w-md">
              {currentChange.filePath}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-500">+{stats.additions}</span>
            <span className="text-red-500">-{stats.deletions}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} of {changes.length}
          </span>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 hover:bg-muted rounded-md disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentIndex(Math.min(changes.length - 1, currentIndex + 1))}
              disabled={currentIndex === changes.length - 1}
              className="p-1.5 hover:bg-muted rounded-md disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'unified' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'split' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            Split
          </button>
        </div>

        <span className={`text-xs px-2 py-1 rounded-full ${
          currentChange.status === ChangeStatus.PENDING ? 'bg-yellow-500/10 text-yellow-500' :
          currentChange.status === ChangeStatus.APPROVED ? 'bg-green-500/10 text-green-500' :
          currentChange.status === ChangeStatus.REJECTED ? 'bg-red-500/10 text-red-500' :
          'bg-blue-500/10 text-blue-500'
        }`}>
          {currentChange.status}
        </span>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto bg-background">
        {viewMode === 'unified' ? (
          <div className="font-mono text-sm">
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={`flex px-4 py-0.5 ${
                  line.type === 'addition' ? 'bg-green-500/10' :
                  line.type === 'deletion' ? 'bg-red-500/10' :
                  line.type === 'header' ? 'bg-muted/50 text-muted-foreground' :
                  ''
                }`}
              >
                <span className={`w-6 flex-shrink-0 select-none ${
                  line.type === 'addition' ? 'text-green-500' :
                  line.type === 'deletion' ? 'text-red-500' :
                  'text-muted-foreground'
                }`}>
                  {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                </span>
                <span className={`${
                  line.type === 'addition' ? 'text-green-700 dark:text-green-300' :
                  line.type === 'deletion' ? 'text-red-700 dark:text-red-300' :
                  ''
                }`}>
                  {line.content || ' '}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0 font-mono text-sm">
            {/* Split view implementation */}
            <div className="border-r border-border">
              <div className="px-2 py-1 bg-muted text-xs text-muted-foreground sticky top-0">
                Before
              </div>
              {diffLines.filter(l => l.type !== 'addition').map((line, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-0.5 ${
                    line.type === 'deletion' ? 'bg-red-500/10 text-red-700 dark:text-red-300' : ''
                  }`}
                >
                  {line.content || ' '}
                </div>
              ))}
            </div>
            <div>
              <div className="px-2 py-1 bg-muted text-xs text-muted-foreground sticky top-0">
                After
              </div>
              {diffLines.filter(l => l.type !== 'deletion').map((line, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-0.5 ${
                    line.type === 'addition' ? 'bg-green-500/10 text-green-700 dark:text-green-300' : ''
                  }`}
                >
                  {line.content || ' '}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Comment Section */}
      {showComment && (
        <div className="px-4 py-3 border-t border-border bg-background/50">
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Add a comment about this change..."
            className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm resize-none h-20"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-background/50">
        <button
          onClick={() => setShowComment(!showComment)}
          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {showComment ? 'Hide Comment' : 'Add Comment'}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onReject(currentChange.id, comment);
              setComment('');
              setShowComment(false);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
            Reject
          </button>
          
          <button
            onClick={() => {
              onApprove(currentChange.id);
              if (currentIndex < changes.length - 1) {
                setCurrentIndex(currentIndex + 1);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-md transition-colors"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>

          {currentChange.status === ChangeStatus.APPROVED && (
            <button
              onClick={() => onApply(currentChange.id)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
            >
              <GitCommit className="w-4 h-4" />
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
};