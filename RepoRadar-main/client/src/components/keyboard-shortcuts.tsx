import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = () => {
  const [, setLocation] = useLocation();

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      metaKey: true,
      action: () => {
        const searchInput = document.querySelector('[data-testid="input-search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      description: '⌘K - Focus search'
    },
    {
      key: 'n',
      metaKey: true,
      action: () => setLocation('/analyze'),
      description: '⌘N - New analysis'
    },
    {
      key: 'h',
      metaKey: true,
      action: () => setLocation('/'),
      description: '⌘H - Go home'
    },
    {
      key: 'd',
      metaKey: true,
      action: () => setLocation('/analytics'),
      description: '⌘D - Dashboard'
    },
    {
      key: 'p',
      metaKey: true,
      action: () => setLocation('/profile'),
      description: '⌘P - Profile'
    },
    {
      key: '/',
      action: () => {
        const searchInput = document.querySelector('[data-testid="input-search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: '/ - Quick search'
    }
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      // Only allow certain shortcuts in input fields
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const searchInput = document.querySelector('[data-testid="input-search"]') as HTMLInputElement;
        if (searchInput && searchInput !== target) {
          searchInput.focus();
          searchInput.select();
        }
      }
      return;
    }

    for (const shortcut of shortcuts) {
      const matchesKey = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const matchesCtrl = !shortcut.ctrlKey || event.ctrlKey;
      const matchesMeta = !shortcut.metaKey || event.metaKey;
      const matchesShift = !shortcut.shiftKey || event.shiftKey;

      if (matchesKey && matchesCtrl && matchesMeta && matchesShift) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }
  }, [setLocation]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return shortcuts;
};

// Keyboard shortcuts help modal component
export const KeyboardShortcutsHelp = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const shortcuts = useKeyboardShortcuts();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-300">{shortcut.description.split(' - ')[1]}</span>
              <kbd className="px-2 py-1 text-xs bg-gray-800 rounded border border-gray-600">
                {shortcut.description.split(' - ')[0]}
              </kbd>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1 bg-gray-800 rounded">?</kbd> to toggle this help
          </p>
        </div>
      </div>
    </div>
  );
};