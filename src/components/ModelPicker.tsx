import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Cloud, Search, Sun, Zap } from 'lucide-react';
import { useAppState } from '../state/store';

export const ModelPicker: React.FC = () => {
  const {
    mode,
    setMode,
    models,
    selectedModelId,
    setSelectedModelId,
    isStreaming,
  } = useAppState();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    setSearch('');
  }, [open, mode]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
  }, [models, search]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={isStreaming}
        onClick={() => setOpen((v) => !v)}
        className="min-h-[44px] px-2.5 sm:px-3 py-1.5 inline-flex items-center gap-1.5 sm:gap-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
        style={{
          color: 'var(--text)',
          backgroundColor: open ? 'var(--surface-2)' : 'transparent',
          borderRadius: 'var(--radius-sm)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {mode === 'cloud' ? (
          <Cloud className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
        ) : (
          <Sun className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
        )}

        <span className="truncate max-w-[140px] sm:max-w-[220px]">
          {currentModel ? currentModel.name : mode === 'cloud' ? 'Select Cloud Model' : 'Little Sun'}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 opacity-60 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 mt-1.5 w-76 sm:w-88 max-w-[calc(100vw-1.5rem)] p-2 z-40 border shadow-xl origin-top-left flex flex-col max-h-[460px]"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {/* Mode Switcher Segmented Control */}
            <div
              className="grid grid-cols-2 p-1 border select-none mb-2 rounded-lg"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => setMode('local')}
                className={`min-h-[32px] px-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  mode === 'local'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Zap className="w-3 h-3 text-[var(--accent)]" />
                <span>Local Mode</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('cloud')}
                className={`min-h-[32px] px-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  mode === 'cloud'
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-semibold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                <Cloud className="w-3 h-3 text-[var(--accent)]" />
                <span>Cloud API</span>
              </button>
            </div>

            {/* Search filter when more than 4 models */}
            {models.length > 4 && (
              <div className="px-1 py-1 mb-1.5">
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search models…"
                    className="w-full text-xs bg-transparent border-none outline-none"
                    style={{ color: 'var(--text)' }}
                  />
                </div>
              </div>
            )}

            {/* Model List with Vertical Space for Longer Model Names */}
            <div className="overflow-y-auto space-y-1 pr-0.5 flex-1 max-h-[320px]">
              {filteredModels.length === 0 ? (
                <div className="py-6 text-center text-xs space-y-1 px-3" style={{ color: 'var(--text-muted)' }}>
                  {mode === 'cloud' ? (
                    <>
                      <p className="font-medium" style={{ color: 'var(--text)' }}>No cloud models available</p>
                      <p className="text-[11px]">Add an API key in Settings &gt; Cloud API.</p>
                    </>
                  ) : (
                    <p>No local models available.</p>
                  )}
                </div>
              ) : (
                filteredModels.map((model) => {
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
                      className="w-full min-h-[46px] px-3 py-2 flex items-start justify-between gap-2.5 text-left text-xs sm:text-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                      style={{
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'var(--surface-2)' : 'transparent',
                        color: 'var(--text)',
                      }}
                    >
                      {/* Vertical room for longer model names */}
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="font-medium whitespace-normal break-words leading-snug">
                          {model.name}
                        </div>
                        {model.contextSize && (
                          <div className="text-[10px] opacity-60 font-mono mt-0.5">
                            {Math.round(model.contextSize / 1024)}k ctx
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 shrink-0 text-[var(--accent)] mt-1" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
