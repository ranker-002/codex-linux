import React, { useState, useRef } from 'react';
import { CodeChange, ChangeStatus } from '../../shared/types';
import { 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight,
  FileCode,
  GitCommit,
  GitPullRequest,
  MessageSquare,
  MessageCirclePlus,
  Send,
  Trash2
} from 'lucide-react';

interface LineComment {
  id: string;
  lineNumber: number;
  content: string;
  author: string;
  createdAt: Date;
}

interface DiffViewerProps {
  changes: CodeChange[];
  onApprove: (changeId: string) => void;
  onReject: (changeId: string, comment?: string) => void;
  onApply: (changeId: string) => void;
  onAddLineComment?: (changeId: string, lineNumber: number, comment: string) => void;
  onDeleteLineComment?: (commentId: string) => void;
  initialComments?: Record<string, LineComment[]>;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  changes,
  onApprove,
  onReject,
  onApply,
  onAddLineComment,
  onDeleteLineComment,
  initialComments = {}
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('unified');
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<Record<string, LineComment[]>>(initialComments);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const currentChange = changes[currentIndex];

  const parseDiff = (diff: string) => {
    const lines: { 
      type: 'header' | 'addition' | 'deletion' | 'context'; 
      content: string; 
      oldLineNum?: number;
      newLineNum?: number;
    }[] = [];
    const diffLines = diff.split('\n');
    let oldLine = 0;
    let newLine = 0;
    
    for (const line of diffLines) {
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          oldLine = parseInt(match[1]) - 1;
          newLine = parseInt(match[2]) - 1;
        }
        lines.push({ type: 'header', content: line });
      } else if (line.startsWith('+')) {
        newLine++;
        lines.push({ type: 'addition', content: line.slice(1), newLineNum: newLine });
      } else if (line.startsWith('-')) {
        oldLine++;
        lines.push({ type: 'deletion', content: line.slice(1), oldLineNum: oldLine });
      } else if (line.startsWith(' ')) {
        oldLine++;
        newLine++;
        lines.push({ type: 'context', content: line.slice(1), oldLineNum: oldLine, newLineNum: newLine });
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

  const handleLineClick = (lineIndex: number) => {
    setSelectedLine(lineIndex === selectedLine ? null : lineIndex);
    if (lineIndex !== selectedLine) {
      setTimeout(() => commentInputRef.current?.focus(), 100);
    }
  };

  const handleAddComment = (lineNumber: number) => {
    if (!newComment.trim() || !currentChange) return;

    const comment: LineComment = {
      id: `comment-${Date.now()}`,
      lineNumber,
      content: newComment.trim(),
      author: 'You',
      createdAt: new Date()
    };

    const changeId = currentChange.id;
    setComments(prev => ({
      ...prev,
      [changeId]: [...(prev[changeId] || []), comment]
    }));

    onAddLineComment?.(changeId, lineNumber, newComment.trim());
    setNewComment('');
    setSelectedLine(null);
  };

  const handleDeleteComment = (commentId: string) => {
    if (!currentChange) return;

    const changeId = currentChange.id;
    setComments(prev => ({
      ...prev,
      [changeId]: prev[changeId]?.filter(c => c.id !== commentId) || []
    }));

    onDeleteLineComment?.(commentId);
  };

  const getLineComments = (lineNumber: number): LineComment[] => {
    if (!currentChange) return [];
    return comments[currentChange.id]?.filter(c => c.lineNumber === lineNumber) || [];
  };

  if (!currentChange) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] p-8">
        <GitPullRequest className="w-16 h-16 mb-4 opacity-30" />
        <h3 className="text-lg font-medium">No Changes to Review</h3>
        <p className="text-sm mt-2">All changes have been reviewed</p>
      </div>
    );
  }

  const stats = getStats(currentChange.diff);
  const diffLines = parseDiff(currentChange.diff);
  const lineCommentsCount = comments[currentChange.id]?.length || 0;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-card)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="font-medium truncate max-w-md text-[var(--text-primary)]">
              {currentChange.filePath}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--success)]">+{stats.additions}</span>
            <span className="text-[var(--error)]">-{stats.deletions}</span>
          </div>

          {lineCommentsCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
              <MessageSquare className="w-3 h-3" />
              {lineCommentsCount}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">
            {currentIndex + 1} of {changes.length}
          </span>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-md disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentIndex(Math.min(changes.length - 1, currentIndex + 1))}
              disabled={currentIndex === changes.length - 1}
              className="p-1.5 hover:bg-[var(--bg-hover)] rounded-md disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'unified'
                ? 'bg-[var(--a-500)] text-[var(--text-inverse)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === 'split'
                ? 'bg-[var(--a-500)] text-[var(--text-inverse)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            Split
          </button>
        </div>

        <span className={`text-xs px-2 py-1 rounded-full ${
          currentChange.status === ChangeStatus.PENDING ? 'bg-[rgba(232,184,74,0.1)] text-[var(--warning)]' :
          currentChange.status === ChangeStatus.APPROVED ? 'bg-[rgba(60,200,120,0.1)] text-[var(--success)]' :
          currentChange.status === ChangeStatus.REJECTED ? 'bg-[rgba(232,90,106,0.1)] text-[var(--error)]' :
          'bg-[rgba(104,144,244,0.1)] text-[var(--info)]'
        }`}>
          {currentChange.status}
        </span>
      </div>

      {/* Diff Content */}
      <div className="flex-1 overflow-auto bg-[var(--bg-app)]">
        {viewMode === 'unified' ? (
          <div className="font-mono text-sm">
            {diffLines.map((line, idx) => {
              const lineNumber = line.newLineNum || line.oldLineNum || idx;
              const lineComments = getLineComments(lineNumber);
              const isSelected = selectedLine === idx;

              return (
                <div key={idx}>
                  <div
                    onClick={() => line.type !== 'header' && handleLineClick(idx)}
                    className={`flex px-4 py-0.5 group cursor-pointer transition-colors ${
                      line.type === 'addition' ? 'bg-[rgba(60,200,120,0.1)] hover:bg-[rgba(60,200,120,0.18)]' :
                      line.type === 'deletion' ? 'bg-[rgba(232,90,106,0.1)] hover:bg-[rgba(232,90,106,0.18)]' :
                      line.type === 'header' ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]' :
                      'hover:bg-[var(--bg-hover)]'
                    } ${isSelected ? 'ring-2 ring-[var(--a-500)] ring-inset' : ''}`}
                  >
                    {/* Line numbers */}
                    <div className="flex gap-2 w-20 flex-shrink-0 text-[var(--text-muted)] select-none">
                      <span className="w-8 text-right">
                        {line.oldLineNum || ''}
                      </span>
                      <span className="w-8 text-right">
                        {line.newLineNum || ''}
                      </span>
                    </div>

                    {/* Change indicator */}
                    <span className={`w-6 flex-shrink-0 select-none ${
                      line.type === 'addition' ? 'text-[var(--success)]' :
                      line.type === 'deletion' ? 'text-[var(--error)]' :
                      'text-[var(--text-muted)]'
                    }`}>
                      {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                    </span>

                    {/* Content */}
                    <span className={`flex-1 ${
                      line.type === 'addition' ? 'text-[var(--success)]' :
                      line.type === 'deletion' ? 'text-[var(--error)]' :
                      'text-[var(--text-secondary)]'
                    }`}>
                      {line.content || ' '}
                    </span>

                    {/* Comment indicator */}
                    {line.type !== 'header' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLineClick(idx);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--bg-hover)] rounded transition-opacity"
                        title="Add comment"
                      >
                        <MessageCirclePlus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      </button>
                    )}
                  </div>

                  {/* Line comments */}
                  {lineComments.length > 0 && (
                    <div className="bg-[var(--bg-elevated)] border-l-2 border-[var(--a-500)] ml-4 mr-4 my-1 rounded-r">
                      {lineComments.map((comment) => (
                        <div key={comment.id} className="p-3 border-b border-[var(--border-subtle)] last:border-b-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                              <span className="font-medium text-[var(--text-primary)]">{comment.author}</span>
                              <span>•</span>
                              <span>{new Date(comment.createdAt).toLocaleString()}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              className="p-1 hover:bg-[var(--bg-hover)] rounded opacity-0 hover:opacity-100 transition-opacity"
                              title="Delete comment"
                            >
                              <Trash2 className="w-3 h-3 text-[var(--text-muted)]" />
                            </button>
                          </div>
                          <p className="text-sm mt-1 text-[var(--text-secondary)]">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment input */}
                  {isSelected && line.type !== 'header' && (
                    <div className="px-4 py-2 bg-[var(--a-bg-xs)] border-l-2 border-[var(--a-500)] ml-4 mr-4 my-1 rounded-r">
                      <textarea
                        ref={commentInputRef}
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add a comment on this line..."
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] resize-none placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--a-500)]"
                        rows={2}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment(lineNumber);
                          }
                          if (e.key === 'Escape') {
                            setSelectedLine(null);
                            setNewComment('');
                          }
                        }}
                      />
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setSelectedLine(null);
                            setNewComment('');
                          }}
                          className="px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddComment(lineNumber)}
                          disabled={!newComment.trim()}
                          className="flex items-center gap-1 px-3 py-1 bg-[var(--a-500)] text-[var(--text-inverse)] rounded-[var(--radius-sm)] text-xs hover:bg-[var(--a-400)] disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          Comment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0 font-mono text-sm">
            {/* Split view implementation with line numbers */}
            <div className="border-r border-[var(--border-subtle)]">
              <div className="px-2 py-1 bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)] sticky top-0">
                Before
              </div>
              {diffLines.map((line, idx) => (
                <div
                  key={`old-${idx}`}
                  className={`flex px-2 py-0.5 ${
                    line.type === 'deletion' ? 'bg-[rgba(232,90,106,0.1)] text-[var(--error)]' : ''
                  } ${line.type === 'header' ? 'text-[var(--text-muted)] text-xs' : 'text-[var(--text-secondary)]'}`}
                >
                  <span className="w-8 text-right text-[var(--text-muted)] select-none mr-2">
                    {line.oldLineNum || ''}
                  </span>
                  <span>{line.content || ' '}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="px-2 py-1 bg-[var(--bg-elevated)] text-xs text-[var(--text-muted)] sticky top-0">
                After
              </div>
              {diffLines.map((line, idx) => (
                <div
                  key={`new-${idx}`}
                  className={`flex px-2 py-0.5 ${
                    line.type === 'addition' ? 'bg-[rgba(60,200,120,0.1)] text-[var(--success)]' : ''
                  } ${line.type === 'header' ? 'text-[var(--text-muted)] text-xs' : 'text-[var(--text-secondary)]'}`}
                >
                  <span className="w-8 text-right text-[var(--text-muted)] select-none mr-2">
                    {line.newLineNum || ''}
                  </span>
                  <span>{line.content || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReject(currentChange.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--error)] hover:bg-[rgba(232,90,106,0.1)] rounded-[var(--radius-md)] transition-colors"
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
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[rgba(60,200,120,0.1)] text-[var(--success)] hover:bg-[rgba(60,200,120,0.18)] rounded-[var(--radius-md)] transition-colors"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>

          {currentChange.status === ChangeStatus.APPROVED && (
            <button
              onClick={() => onApply(currentChange.id)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-[var(--a-500)] text-[var(--text-inverse)] hover:bg-[var(--a-400)] rounded-[var(--radius-md)] transition-colors"
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

export default DiffViewer;
