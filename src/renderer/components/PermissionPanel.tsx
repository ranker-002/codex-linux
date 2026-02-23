import React from 'react';
import { PermissionRequest } from '../../shared/types';
import { 
  FileEdit, 
  Terminal, 
  Wrench, 
  Check, 
  X,
  Clock,
  AlertCircle
} from 'lucide-react';

interface PermissionPanelProps {
  requests: PermissionRequest[];
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  onViewDetails?: (request: PermissionRequest) => void;
}

const getActionIcon = (type: string) => {
  switch (type) {
    case 'edit':
      return <FileEdit className="w-4 h-4" />;
    case 'command':
      return <Terminal className="w-4 h-4" />;
    case 'tool':
      return <Wrench className="w-4 h-4" />;
    default:
      return <AlertCircle className="w-4 h-4" />;
  }
};

const getActionColor = (type: string) => {
  switch (type) {
    case 'edit':
      return 'text-blue-500 bg-blue-500/10';
    case 'command':
      return 'text-yellow-500 bg-yellow-500/10';
    case 'tool':
      return 'text-purple-500 bg-purple-500/10';
    default:
      return 'text-gray-500 bg-gray-500/10';
  }
};

export const PermissionPanel: React.FC<PermissionPanelProps> = ({
  requests,
  onApprove,
  onReject,
  onViewDetails
}) => {
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Check className="w-16 h-16 mb-4 opacity-30" />
        <h3 className="text-lg font-medium">No Pending Permissions</h3>
        <p className="text-sm mt-2 text-center">
          All actions have been approved or rejected
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-500" />
          <h3 className="font-medium">Pending Permissions</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {requests.length} pending
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${getActionColor(request.type)}`}>
                  {getActionIcon(request.type)}
                </div>
                <div>
                  <span className="font-medium capitalize">{request.type}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {request.action}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(request.createdAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Details */}
            {request.details && Object.keys(request.details).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                {request.type === 'edit' && request.details.filePath && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">File: </span>
                    <code className="bg-background px-1.5 py-0.5 rounded text-xs">
                      {request.details.filePath}
                    </code>
                  </div>
                )}
                {request.type === 'command' && request.details.command && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Command: </span>
                    <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">
                      {request.details.command}
                    </code>
                  </div>
                )}
                {request.details.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {request.details.description}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              {onViewDetails && (
                <button
                  onClick={() => onViewDetails(request)}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  View Details
                </button>
              )}
              <button
                onClick={() => onReject(request.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => onApprove(request.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PermissionPanel;
