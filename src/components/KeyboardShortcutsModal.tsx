import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Keyboard, X } from 'lucide-react';
import { useAppState } from '../state/store';

const SHORTCUT_ITEMS = [
  {
    keys: ['Ctrl / ⌘', 'K'],
    altKeys: ['Ctrl / ⌘', 'Shift', 'O'],
    description: 'Start a new conversation',
  },
  {
    keys: ['Enter'],
    description: 'Send message in composer',
  },
  {
    keys: ['Shift', 'Enter'],
    description: 'Insert new line in composer',
  },
  {
    keys: ['Esc'],
    description: 'Close settings or dialogs',
  },
  {
    keys: ['?'],
    altKeys: ['Ctrl / ⌘', '/'],
    description: 'Toggle this keyboard shortcuts guide',
  },
];

export const KeyboardShortcutsModal: React.FC = () => {
  const { isShortcutsOpen, setIsShortcutsOpen } = useAppState();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isShortcutsOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsShortcutsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isShortcutsOpen, setIsShortcutsOpen]);

  return (
    <AnimatePresence>
      {isShortcutsOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ls-shortcuts-title"
        >
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[440px] border shadow-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
            }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 id="ls-shortcuts-title" className="text-sm font-semibold tracking-tight">
                  Keyboard Shortcuts
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsShortcutsOpen(false)}
                className="p-1 rounded transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Close shortcuts dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="p-5 space-y-3.5 divide-y divide-[var(--border)]">
              {SHORTCUT_ITEMS.map((item, idx) => (
                <div
                  key={item.description}
                  className={`flex items-center justify-between gap-3 text-xs ${
                    idx > 0 ? 'pt-3' : ''
                  }`}
                >
                  <span className="font-medium" style={{ color: 'var(--text)' }}>
                    {item.description}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 text-[11px] font-mono border rounded shadow-2xs font-semibold"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>

                    {item.altKeys && (
                      <>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          or
                        </span>
                        <div className="flex items-center gap-1">
                          {item.altKeys.map((k) => (
                            <kbd
                              key={k}
                              className="px-1.5 py-0.5 text-[10px] font-mono border rounded shadow-2xs"
                              style={{
                                backgroundColor: 'var(--surface-2)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer tip */}
            <div
              className="px-5 py-3 border-t text-[11px] flex items-center justify-between"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <span>Press <kbd className="font-mono text-[10px] px-1 py-0.5 border rounded bg-[var(--surface)]">Esc</kbd> to close</span>
              <span>Available anywhere</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

