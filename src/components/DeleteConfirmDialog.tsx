import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: 'trash' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  icon = 'trash',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);

  // Handle outside click & Esc key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node) && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    // Auto focus safe cancel button on mount
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    // Prevent background scrolling while dialog is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isLoading, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.60)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ls-confirm-dialog-title"
          aria-describedby="ls-confirm-dialog-desc"
        >
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full sm:max-w-[420px] border-t sm:border shadow-2xl rounded-t-2xl sm:rounded-xl overflow-hidden"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            {/* Mobile Sheet Drag Indicator */}
            <div className="pt-3 pb-1 sm:hidden flex justify-center">
              <div
                className="w-10 h-1 rounded-full opacity-60"
                style={{ backgroundColor: 'var(--border)' }}
              />
            </div>

            <div
              className="p-5 sm:p-6"
              style={{
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
              }}
            >
              {/* Header with Icon and Close Button */}
              <div className="flex items-start justify-between gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor:
                      icon === 'trash'
                        ? 'rgba(229, 103, 90, 0.14)'
                        : 'rgba(217, 130, 43, 0.14)',
                    color: icon === 'trash' ? 'var(--danger)' : 'var(--accent)',
                  }}
                >
                  {icon === 'trash' ? (
                    <Trash2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-[var(--surface-2)] disabled:opacity-50"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Description */}
              <div className="mt-3.5 space-y-1.5">
                <h3
                  id="ls-confirm-dialog-title"
                  className="text-base sm:text-lg font-semibold tracking-tight leading-snug"
                  style={{ color: 'var(--text)' }}
                >
                  {title}
                </h3>
                <div
                  id="ls-confirm-dialog-desc"
                  className="text-xs sm:text-sm leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {description}
                </div>
              </div>

              {/* Action Buttons (Stacked on Mobile with 48px touch targets, Inline on Desktop) */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-2 mt-6">
                <button
                  ref={cancelBtnRef}
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="w-full sm:w-auto min-h-[48px] sm:min-h-[38px] px-4 py-2 text-sm font-medium rounded-lg border transition-all cursor-pointer active:scale-[0.99] text-center flex items-center justify-center disabled:opacity-50 hover:bg-[var(--surface-2)]"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  {cancelLabel}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await onConfirm();
                  }}
                  disabled={isLoading}
                  className="w-full sm:w-auto min-h-[48px] sm:min-h-[38px] px-5 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer active:scale-[0.99] text-white flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--danger)',
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    confirmLabel
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
