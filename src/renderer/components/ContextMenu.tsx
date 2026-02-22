import React, { useState, useEffect, useRef } from 'react';

interface ContextMenuItem {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  x,
  y,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu on screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] bg-card border border-border rounded-md shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, index) =>
        item.divider ? (
          <div key={index} className="my-1 border-t border-border" />
        ) : (
          <button
            key={index}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
              item.disabled
                ? 'text-muted-foreground cursor-not-allowed'
                : 'hover:bg-muted text-foreground'
            }`}
            onClick={() => {
              if (!item.disabled) {
                item.action();
                onClose();
              }
            }}
            disabled={item.disabled}
          >
            <div className="flex items-center gap-2">
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              <span>{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-xs text-muted-foreground ml-4">
                {item.shortcut}
              </span>
            )}
          </button>
        )
      )}
    </div>
  );
};

// Hook for context menu
export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
  }>({
    visible: false,
    x: 0,
    y: 0,
    items: [],
  });

  const showContextMenu = (
    e: React.MouseEvent,
    items: ContextMenuItem[]
  ) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  const hideContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  };
};

// Common context menu presets
export const FileContextMenu = (
  filePath: string,
  onOpen: () => void,
  onCopy: () => void,
  onDelete: () => void
): ContextMenuItem[] => [
  { label: 'Open', action: onOpen, shortcut: 'Enter' },
  { label: 'Copy Path', action: onCopy, shortcut: 'Ctrl+C' },
  { divider: true } as ContextMenuItem,
  { label: 'Delete', action: onDelete, shortcut: 'Del' },
];

export const AgentContextMenu = (
  agentId: string,
  onChat: () => void,
  onPause: () => void,
  onDelete: () => void
): ContextMenuItem[] => [
  { label: 'Chat', action: onChat },
  { label: 'Pause', action: onPause },
  { divider: true } as ContextMenuItem,
  { label: 'Delete', action: onDelete },
];