import React, { useState, useEffect, useCallback } from 'react';
import { ComputerTask, ComputerAction, UIElement } from '../../shared/types';

interface ComputerUsePanelProps {
  onExecuteTask?: (description: string, goal: string) => Promise<string>;
  onCancelTask?: (taskId: string) => Promise<boolean>;
  activeTask?: ComputerTask;
  screenshots?: string[];
  isRunning?: boolean;
}

export const ComputerUsePanel: React.FC<ComputerUsePanelProps> = ({
  onExecuteTask,
  onCancelTask,
  activeTask,
  screenshots = [],
  isRunning = false
}) => {
  const [description, setDescription] = useState('');
  const [goal, setGoal] = useState('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<number>(-1);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    if (screenshots.length > 0) {
      setSelectedScreenshot(screenshots.length - 1);
    }
  }, [screenshots.length]);

  const handleExecute = useCallback(async () => {
    if (!description || !goal || !onExecuteTask) return;
    
    try {
      await onExecuteTask(description, goal);
      setDescription('');
      setGoal('');
    } catch (error) {
      console.error('Failed to execute task:', error);
    }
  }, [description, goal, onExecuteTask]);

  const handleCancel = useCallback(async () => {
    if (activeTask && onCancelTask) {
      await onCancelTask(activeTask.id);
    }
  }, [activeTask, onCancelTask]);

  const getActionIcon = (action: ComputerAction): string => {
    switch (action.type) {
      case 'click': return '🖱️';
      case 'doubleClick': return '🖱️🖱️';
      case 'type': return '⌨️';
      case 'scroll': return '📜';
      case 'key': return '🔑';
      case 'wait': return '⏱️';
      case 'screenshot': return '📸';
      default: return '⚡';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'cancelled': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">🖥️ Computer Using Agent</h2>
        <p className="text-gray-400 text-sm">
          Let AI interact with your computer interface to complete tasks
        </p>
      </div>

      {/* Task Input */}
      {!isRunning && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Task Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Book a flight to Paris"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Describe what you want to achieve..."
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            onClick={handleExecute}
            disabled={!description || !goal}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors"
          >
            Execute Task
          </button>
        </div>
      )}

      {/* Active Task Status */}
      {activeTask && (
        <div className={`bg-gray-800 rounded-lg p-4 mb-4 border-l-4 ${
          activeTask.status === 'running' ? 'border-blue-500' :
          activeTask.status === 'completed' ? 'border-green-500' :
          activeTask.status === 'failed' ? 'border-red-500' : 'border-yellow-500'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold">{activeTask.description}</h3>
              <p className="text-sm text-gray-400">{activeTask.goal}</p>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(activeTask.status)}`}>
              {activeTask.status.toUpperCase()}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Progress</span>
              <span>{activeTask.currentStep} / {activeTask.maxSteps} steps</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(activeTask.currentStep / activeTask.maxSteps) * 100}%` }}
              />
            </div>
          </div>

          {isRunning && (
            <button
              onClick={handleCancel}
              className="mt-3 text-red-400 hover:text-red-300 text-sm font-medium"
            >
              Cancel Task
            </button>
          )}

          {activeTask.error && (
            <div className="mt-3 p-2 bg-red-900/30 border border-red-500/30 rounded text-red-400 text-sm">
              Error: {activeTask.error}
            </div>
          )}
        </div>
      )}

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <div className="flex-1 bg-gray-800 rounded-lg p-4 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Screenshots</h3>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOverlay}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                  className="rounded"
                />
                Show Elements
              </label>
            </div>
          </div>

          <div className="flex-1 bg-gray-900 rounded overflow-hidden relative">
            {selectedScreenshot >= 0 && screenshots[selectedScreenshot] && (
              <img
                src={screenshots[selectedScreenshot]}
                alt={`Screenshot ${selectedScreenshot + 1}`}
                className="w-full h-full object-contain"
              />
            )}
            
            {/* Navigation */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-gray-800/90 px-3 py-1 rounded-full">
              <button
                onClick={() => setSelectedScreenshot(Math.max(0, selectedScreenshot - 1))}
                disabled={selectedScreenshot <= 0}
                className="text-gray-400 hover:text-white disabled:opacity-30"
              >
                ←
              </button>
              <span className="text-sm text-gray-300">
                {selectedScreenshot + 1} / {screenshots.length}
              </span>
              <button
                onClick={() => setSelectedScreenshot(Math.min(screenshots.length - 1, selectedScreenshot + 1))}
                disabled={selectedScreenshot >= screenshots.length - 1}
                className="text-gray-400 hover:text-white disabled:opacity-30"
              >
                →
              </button>
            </div>
          </div>

          {/* Thumbnails */}
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
            {screenshots.map((screenshot, index) => (
              <button
                key={index}
                onClick={() => setSelectedScreenshot(index)}
                className={`flex-shrink-0 w-20 h-14 rounded overflow-hidden border-2 ${
                  index === selectedScreenshot ? 'border-blue-500' : 'border-transparent'
                }`}
              >
                <img
                  src={screenshot}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions Log */}
      {activeTask && activeTask.actions.length > 0 && (
        <div className="mt-4 bg-gray-800 rounded-lg p-4 max-h-48 overflow-y-auto">
          <h3 className="font-semibold mb-2">Actions Log</h3>
          <div className="space-y-1">
            {activeTask.actions.map((action: ComputerAction, index: number) => (
              <div
                key={index}
                className="flex items-center gap-2 text-sm p-1 hover:bg-gray-700 rounded"
              >
                <span className="text-lg">{getActionIcon(action)}</span>
                <span className="text-gray-300 capitalize">{action.type}</span>
                {action.value && (
                  <span className="text-gray-500 truncate">"{action.value}"</span>
                )}
                {action.target?.coordinates && (
                  <span className="text-gray-500 text-xs">
                    at ({action.target.coordinates.x}, {action.target.coordinates.y})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComputerUsePanel;
