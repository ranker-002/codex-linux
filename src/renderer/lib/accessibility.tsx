import React, { useState, useEffect, useCallback, KeyboardEvent, MouseEvent } from 'react';

export interface AriaAttributes {
  role?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
  ariaHidden?: boolean;
  ariaDisabled?: boolean;
  ariaExpanded?: boolean;
  ariaPressed?: boolean;
  ariaSelected?: boolean;
  ariaChecked?: boolean;
  ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
  ariaLive?: 'off' | 'polite' | 'assertive';
  ariaAtomic?: boolean;
  ariaBusy?: boolean;
}

export interface KeyboardHandler {
  onEnter?: () => void;
  onSpace?: () => void;
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onHome?: () => void;
  onEnd?: () => void;
  onTab?: (shiftKey?: boolean) => void;
  onDelete?: () => void;
  onBackspace?: () => void;
  onCharacter?: (char: string) => void;
}

export function useKeyboard(keyHandlers: KeyboardHandler) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, shiftKey, ctrlKey, metaKey, altKey } = event;
    
    if (ctrlKey || metaKey || altKey) {
      return;
    }

    switch (key) {
      case 'Enter':
        keyHandlers.onEnter?.();
        event.preventDefault();
        break;
      case ' ':
        keyHandlers.onSpace?.();
        event.preventDefault();
        break;
      case 'Escape':
        keyHandlers.onEscape?.();
        event.preventDefault();
        break;
      case 'ArrowUp':
        keyHandlers.onArrowUp?.();
        event.preventDefault();
        break;
      case 'ArrowDown':
        keyHandlers.onArrowDown?.();
        event.preventDefault();
        break;
      case 'ArrowLeft':
        keyHandlers.onArrowLeft?.();
        event.preventDefault();
        break;
      case 'ArrowRight':
        keyHandlers.onArrowRight?.();
        event.preventDefault();
        break;
      case 'Home':
        keyHandlers.onHome?.();
        event.preventDefault();
        break;
      case 'End':
        keyHandlers.onEnd?.();
        event.preventDefault();
        break;
      case 'Tab':
        keyHandlers.onTab?.(shiftKey);
        break;
      case 'Delete':
        keyHandlers.onDelete?.();
        event.preventDefault();
        break;
      case 'Backspace':
        keyHandlers.onBackspace?.();
        event.preventDefault();
        break;
      default:
        if (key.length === 1) {
          keyHandlers.onCharacter?.(key);
        }
    }
  }, [keyHandlers]);

  return { handleKeyDown };
}

export function useFocusTrap(isActive: boolean) {
  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([]);
  const [initialFocus, setInitialFocus] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const getFocusableElements = () => {
      const selector = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');

      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(selector)
      ).filter(el => el.offsetParent !== null);

      setFocusableElements(elements);
      
      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];
      
      setInitialFocus(firstElement || null);
      
      return { first: firstElement, last: lastElement };
    };

    const { first, last } = getFocusableElements();

    const handleTabKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey as EventListener);
    first?.focus();

    return () => {
      document.removeEventListener('keydown', handleTabKey as EventListener);
      initialFocus?.focus();
    };
  }, [isActive]);

  return { focusableElements, initialFocus };
}

export function useAnnounce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (message) {
      setAnnouncement('');
      setTimeout(() => setAnnouncement(message), 50);
    }
  }, [message]);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

export interface AriaMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  shortcut?: string;
  divider?: boolean;
}

export interface UseMenuProps {
  items: AriaMenuItem[];
  onSelect: (id: string) => void;
}

export function useMenu({ items, onSelect }: UseMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const enabledItems = items.filter(item => !item.disabled);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => 
          prev < enabledItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => 
          prev > 0 ? prev - 1 : enabledItems.length - 1
        );
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(enabledItems.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        const selectedItem = enabledItems[activeIndex];
        if (selectedItem) {
          onSelect(selectedItem.id);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  }, [items, activeIndex, onSelect]);

  const open = useCallback(() => {
    setIsOpen(true);
    setActiveIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    activeIndex,
    open,
    close,
    handleKeyDown,
    items
  };
}

export function useSkipLink(targetId: string) {
  const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    target?.focus();
    target?.scrollIntoView({ behavior: 'smooth' });
  }, [targetId]);

  return { handleClick };
}

export interface FocusableProps {
  tabIndex?: number;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function createAriaProps(
  type: 'button' | 'dialog' | 'menu' | 'menuitem' | 'tab' | 'treeitem' | 'combobox' | 'listbox' | 'option' | 'gridcell' | 'checkbox' | 'radio' | 'slider' | 'switch' | 'textbox' | 'searchbox' | 'spinbutton',
  props: AriaAttributes
): AriaAttributes {
  return {
    role: type,
    ...props
  };
}
