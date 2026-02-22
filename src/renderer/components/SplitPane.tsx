import React, { useState, useCallback } from 'react';

interface SplitPaneProps {
  children: [React.ReactNode, React.ReactNode];
  direction?: 'horizontal' | 'vertical';
  defaultSplit?: number;
  minSize?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  children,
  direction = 'horizontal',
  defaultSplit = 50,
  minSize = 200,
}) => {
  const [split, setSplit] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;

      const container = e.currentTarget as HTMLElement;
      const rect = container.getBoundingClientRect();

      let newSplit;
      if (direction === 'horizontal') {
        newSplit = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        newSplit = ((e.clientY - rect.top) / rect.height) * 100;
      }

      // Apply min size constraints
      const minPercent = (minSize / (direction === 'horizontal' ? rect.width : rect.height)) * 100;
      newSplit = Math.max(minPercent, Math.min(100 - minPercent, newSplit));

      setSplit(newSplit);
    },
    [isDragging, direction, minSize]
  );

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        className="overflow-hidden"
        style={{
          [isHorizontal ? 'width' : 'height']: `${split}%`,
          [isHorizontal ? 'height' : 'width']: '100%',
        }}
      >
        {children[0]}
      </div>

      <div
        className={`${
          isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
        } bg-border hover:bg-primary transition-colors flex-shrink-0`}
        onMouseDown={handleMouseDown}
        style={{
          userSelect: 'none',
        }}
      >
        <div
          className={`${
            isHorizontal ? 'w-full h-8' : 'h-full w-8'
          } mx-auto my-auto flex items-center justify-center`}
        >
          <div
            className={`${
              isHorizontal ? 'w-0.5 h-4' : 'w-4 h-0.5'
            } bg-muted-foreground/30 rounded-full`}
          />
        </div>
      </div>

      <div
        className="overflow-hidden flex-1"
        style={{
          [isHorizontal ? 'width' : 'height']: `${100 - split}%`,
        }}
      >
        {children[1]}
      </div>
    </div>
  );
};

// Multi-pane layout component
interface Pane {
  id: string;
  content: React.ReactNode;
  title: string;
}

interface MultiPaneLayoutProps {
  panes: Pane[];
  activePaneId: string;
  onPaneChange: (id: string) => void;
  onPaneClose?: (id: string) => void;
}

export const MultiPaneLayout: React.FC<MultiPaneLayoutProps> = ({
  panes,
  activePaneId,
  onPaneChange,
  onPaneClose,
}) => {
  const activePane = panes.find((p) => p.id === activePaneId);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card">
        {panes.map((pane) => (
          <div
            key={pane.id}
            className={`group flex items-center gap-2 px-4 py-2 text-sm cursor-pointer border-r border-border transition-colors ${
              pane.id === activePaneId
                ? 'bg-background text-foreground border-t-2 border-t-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            onClick={() => onPaneChange(pane.id)}
          >
            <span className="truncate max-w-[150px]">{pane.title}</span>
            {onPaneClose && panes.length > 1 && (
              <button
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onPaneClose(pane.id);
                }}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activePane?.content}
      </div>
    </div>
  );
};