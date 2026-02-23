import React, { useState } from 'react';
import { GitPullRequest, CheckCircle, XCircle, AlertTriangle, Loader2, Send, MessageSquare } from 'lucide-react';

export interface CodeChange {
  id: string;
  filePath: string;
  diff: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ReviewComment {
  id: string;
  lineNumber: number;
  content: string;
  author: string;
  createdAt: Date;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: string;
  timestamp: Date;
}

export interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'logic' | 'performance' | 'style' | 'bug';
  message: string;
  line?: number;
  file: string;
}

interface CodeReviewPanelProps {
  changes: CodeChange[];
  isReviewing: boolean;
  reviewResult?: ReviewResult;
  onStartReview: () => void;
  onApproveChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  onAddComment: (changeId: string, lineNumber: number, comment: string) => void;
  onResolveComment: (commentId: string) => void;
}

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

const getSeverityIcon = (severity: ReviewIssue['severity']) => {
  switch (severity) {
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case 'info':
      return <MessageSquare className="w-4 h-4 text-blue-500" />;
  }
};

const getCategoryColor = (category: ReviewIssue['category']): string => {
  switch (category) {
    case 'security':
      return 'bg-red-500/10 text-red-500';
    case 'logic':
      return 'bg-purple-500/10 text-purple-500';
    case 'performance':
      return 'bg-orange-500/10 text-orange-500';
    case 'bug':
      return 'bg-yellow-500/10 text-yellow-500';
    case 'style':
      return 'bg-blue-500/10 text-blue-500';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const CodeReviewPanel: React.FC<CodeReviewPanelProps> = ({
  changes,
  isReviewing,
  reviewResult,
  onStartReview,
  onApproveChange,
  onRejectChange,
  onAddComment,
  onResolveComment,
}) => {
  const [selectedChange, setSelectedChange] = useState<string | null>(
    changes.length > 0 ? changes[0].id : null
  );

  const currentChange = changes.find(c => c.id === selectedChange);

  const errorCount = reviewResult?.issues.filter(i => i.severity === 'error').length || 0;
  const warningCount = reviewResult?.issues.filter(i => i.severity === 'warning').length || 0;

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5" />
            <h3 className="font-semibold">Code Review</h3>
          </div>
          
          <button
            onClick={onStartReview}
            disabled={isReviewing || changes.length === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors',
              isReviewing
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {isReviewing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reviewing...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Review Code
              </>
            )}
          </button>
        </div>
      </div>

      {/* Review Summary */}
      {reviewResult && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium">{errorCount} errors</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">{warningCount} warnings</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{reviewResult.summary}</p>
        </div>
      )}

      {/* Issues List */}
      {reviewResult && reviewResult.issues.length > 0 && (
        <div className="px-4 py-3 border-b border-border max-h-48 overflow-y-auto">
          <h4 className="text-sm font-medium mb-2">Issues Found</h4>
          <div className="space-y-2">
            {reviewResult.issues.map((issue, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-lg',
                  issue.severity === 'error' && 'bg-red-500/10',
                  issue.severity === 'warning' && 'bg-yellow-500/10',
                  issue.severity === 'info' && 'bg-blue-500/10'
                )}
              >
                {getSeverityIcon(issue.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded', getCategoryColor(issue.category))}>
                      {issue.category}
                    </span>
                    <span className="text-sm font-medium truncate">{issue.file}</span>
                    {issue.line && (
                      <span className="text-xs text-muted-foreground">line {issue.line}</span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5">{issue.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Changes List */}
      <div className="flex-1 overflow-y-auto">
        {changes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <GitPullRequest className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">No changes to review</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {changes.map((change) => (
              <div
                key={change.id}
                onClick={() => setSelectedChange(change.id)}
                className={cn(
                  'p-3 cursor-pointer transition-colors',
                  selectedChange === change.id
                    ? 'bg-primary/10'
                    : 'hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{change.filePath}</span>
                    {change.status === 'approved' && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {change.status === 'rejected' && (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {currentChange && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApproveChange(currentChange.id)}
              disabled={currentChange.status === 'approved'}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                currentChange.status === 'approved'
                  ? 'bg-green-500/20 text-green-500 cursor-not-allowed'
                  : 'hover:bg-green-500/10 text-green-500'
              )}
            >
              <CheckCircle className="w-4 h-4" />
              Approve
            </button>
            
            <button
              onClick={() => onRejectChange(currentChange.id)}
              disabled={currentChange.status === 'rejected'}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                currentChange.status === 'rejected'
                  ? 'bg-red-500/20 text-red-500 cursor-not-allowed'
                  : 'hover:bg-red-500/10 text-red-500'
              )}
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeReviewPanel;
