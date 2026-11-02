import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { useAppState } from '../state/store';

export const ModelPicker: React.FC = () => {
  const { models, selectedModelId, setSelectedModelId, isStreaming } = useAppState();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const currentModel =
    models.find((m) => m.id === selectedModelId) ||
    models[0] ||
    null;

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={isStreaming || models.length === 0}
        onClick={() => {
          if (models.length === 0) return;
          setOpen((v) => !v);
        }}
        className="min-h-[44px] px-3 py-1.5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer disabled:cursor-default"
        style={{
          color: 'var(--text)',
          backgroundColor: open ? 'var(--surface-2)' : 'transparent',
          borderRadius: 'var(--radius-sm)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate max-w-[180px] sm:max-w-[260px]">
          {currentModel ? currentModel.name : 'Little Sun'}
        </span>
        {models.length > 0 && (
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
            style={{ color: 'var(--text-muted)' }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && models.length > 0 && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 mt-1 w-56 p-1.5 z-40 border shadow-lg origin-top-left"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {models.map((model) => {
              const isSelected = model.id === (currentModel?.id || selectedModelId);
              return (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={!model.available}
                  onClick={() => {
                    if (!model.available) return;
                    setSelectedModelId(model.id);
                    setOpen(false);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 flex items-center justify-between gap-2 text-left text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? 'var(--surface-2)' : 'transparent',
                    color: 'var(--text)',
                  }}
                >
                  <span className="font-medium truncate">{model.name}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

