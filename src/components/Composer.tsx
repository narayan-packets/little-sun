import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowUp,
  Brain,
  Clock,
  FileText,
  Globe,
  MoreVertical,
  Paperclip,
  Plus,
  RotateCcw,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { AttachmentItem, useAppState } from '../state/store';
import { uploadEphemeralFile } from '../lib/supabase';
import { getModelModalityInfo } from '../lib/modality';

function formatCompactTokens(n: number): string {
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(n);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // Strictly under 30 MB

export interface ComposerProps {
  isHero?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({ isHero = false }) => {
  const {
    session,
    models,
    selectedModelId,
    activeChatId,
    composerDraft,
    setComposerDraft,
    contextUsage,
    laptopStatus,
    mode,
    cloudStatus,
    isAccessRestricted,
    isStreaming,
    failedSend,
    isWebSearchActive,
    searchCooldown,
    toggleWebSearch,
    isThinkingActive,
    toggleThinking,
    sendMessage,
    stopGenerating,
    startNewChat,
    continueInNewChat,
    clearFailedSendError,
    memoryNotification,
    clearMemoryNotification,
  } = useAppState();

  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeModel = models.find((m) => m.id === selectedModelId);
  const supportsThinking = Boolean(
    activeModel?.supportsThinking ?? activeModel?.thinking ?? false
  );
  const modelInfo = useMemo(
    () => getModelModalityInfo(selectedModelId, activeModel?.name, activeModel),
    [selectedModelId, activeModel]
  );
  const [isModalityDismissed, setIsModalityDismissed] = useState(false);

  // Clear attachments if switching to Cloud mode
  useEffect(() => {
    if (mode === 'cloud' && attachments.length > 0) {
      setAttachments([]);
    }
  }, [mode, attachments.length]);

  // Reset modality warning dismissal if user adds or changes attachments
  useEffect(() => {
    setIsModalityDismissed(false);
  }, [attachments]);

  const hasImageAttachment = attachments.some((a) => a.type === 'image');
  const hasAudioAttachment = attachments.some((a) => a.type === 'audio');

  const unsupportedModalityMessage = useMemo(() => {
    if (isModalityDismissed) return null;
    if (hasImageAttachment && !modelInfo.supportsImages && hasAudioAttachment && !modelInfo.supportsAudio) {
      return 'Model only supports text. Switch to a multimodal model for images and audio.';
    }
    if (hasImageAttachment && !modelInfo.supportsImages) {
      return 'Model only supports text. Switch to a vision-capable model to analyze images.';
    }
    if (hasAudioAttachment && !modelInfo.supportsAudio) {
      return 'Model does not support audio inputs.';
    }
    return null;
  }, [isModalityDismissed, hasImageAttachment, hasAudioAttachment, modelInfo]);

  // Close 3-dot dropdown menu on click outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const isOffline =
    mode === 'cloud'
      ? typeof navigator !== 'undefined' && !navigator.onLine
      : laptopStatus === 'offline';
  const {
    totalTokens,
    usableInputLimit,
    draftTokens,
    maxTurnTokens,
    usagePercent,
    isNearLimit,
    isChatLimitReached,
    isDraftOverTurnLimit,
  } = contextUsage;

  const isInputBlocked = isOffline || isChatLimitReached || isAccessRestricted;
  const isSendDisabled =
    isInputBlocked ||
    isDraftOverTurnLimit ||
    (!composerDraft.trim() && attachments.length === 0);

  // Desktop auto-focus on composer when on a new/fresh chat
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile =
      window.matchMedia('(max-width: 767px)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    if (!isMobile && textareaRef.current && !activeChatId && !isInputBlocked) {
      textareaRef.current.focus();
    }
  }, [activeChatId, isInputBlocked]);

  // Auto-grow textarea smoothly up to ~6 lines (approx 160-180px)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = 38;
    const nextHeight = Math.min(180, Math.max(minH, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
  }, [composerDraft, isHero]);

  if (isAccessRestricted) {
    return null;
  }

  const validateAndProcessFile = async (file: File): Promise<AttachmentItem | null> => {
    // File upload is disabled in Cloud mode
    if (mode === 'cloud') {
      setUploadError('File upload is disabled in Cloud mode.');
      return null;
    }

    // 1. Strict size check under 30 MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`"${file.name}" exceeds the 30 MB limit (${sizeMb} MB). Files must be under 30 MB.`);
      return null;
    }

    const mime = file.type.toLowerCase();
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // Ephemeral upload to Supabase Storage (1-hour expiration timestamp)
    const uploadRes = await uploadEphemeralFile(session?.user?.id || 'guest', file);

    // 1. Strict type check: Audio
    if (
      mime.startsWith('audio/') ||
      ['mp3', 'wav', 'ogg', 'm4a', 'webm', 'flac', 'aac', 'opus', 'weba'].includes(ext)
    ) {
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: 'audio',
        dataUrl: uploadRes.url,
        storagePath: uploadRes.path,
      };
    }

    // 2. Strict type check: Image
    if (
      mime.startsWith('image/') ||
      ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'ico'].includes(ext)
    ) {
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: 'image',
        dataUrl: uploadRes.url,
        storagePath: uploadRes.path,
      };
    }

    // 3. Strict type check: Text / Document
    if (
      mime.startsWith('text/') ||
      [
        'txt',
        'md',
        'json',
        'csv',
        'tsv',
        'py',
        'js',
        'ts',
        'jsx',
        'tsx',
        'html',
        'css',
        'xml',
        'yaml',
        'yml',
        'c',
        'cpp',
        'rs',
        'go',
        'java',
        'sql',
        'sh',
        'log',
        'srt',
        'vtt',
        'env',
        'toml',
        'pdf',
        'docx',
      ].includes(ext)
    ) {
      const rawText = await file.text().catch(() => '');
      const maxContextChars = 50000;
      const textContent =
        rawText.length > maxContextChars
          ? `${rawText.slice(0, maxContextChars)}\n\n[File truncated to first 50,000 characters to fit model context window]`
          : rawText;
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        type: 'text',
        textContent,
        dataUrl: uploadRes.url,
        storagePath: uploadRes.path,
      };
    }

    setUploadError(
      `"${file.name}" is not supported. Please upload text documents, images, or audio files under 30 MB.`
    );
    return null;
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadError(null);

    const processed: AttachmentItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const item = await validateAndProcessFile(files[i]);
      if (item) processed.push(item);
    }

    if (processed.length > 0) {
      setAttachments((prev) => [...prev, ...processed]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInputBlocked || mode === 'cloud') return;
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    setUploadError(null);

    const processed: AttachmentItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const item = await validateAndProcessFile(files[i]);
      if (item) processed.push(item);
    }

    if (processed.length > 0) {
      setAttachments((prev) => [...prev, ...processed]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = () => {
    if (isSendDisabled || isStreaming) return;
    sendMessage(composerDraft, attachments);
    setAttachments([]);
    setUploadError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;

    const isMobileViewport =
      typeof window !== 'undefined' &&
      (window.matchMedia('(max-width: 767px)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0);

    if (isMobileViewport) {
      return;
    }

    if (!e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={
        isHero
          ? 'w-full'
          : 'w-full px-3 sm:px-5 pt-3 shrink-0 relative z-10'
      }
      style={
        isHero
          ? undefined
          : {
              background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 24%)',
              paddingBottom: 'calc(0.85rem + env(safe-area-inset-bottom))',
            }
      }
    >
      <div className="w-full max-w-[720px] mx-auto">
        {/* Hidden file input for Text, Images, and Audio */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,audio/*,text/*,.txt,.md,.json,.csv,.tsv,.py,.js,.ts,.tsx,.jsx,.html,.css,.xml,.yaml,.yml,.c,.cpp,.rs,.go,.java,.sql,.sh,.log,.srt,.vtt,.env,.toml,.pdf,.docx,.mp3,.wav,.ogg,.m4a,.webm,.flac,.aac,.opus,.weba"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Memory Stored / Forgotten Notification Pill */}
        <AnimatePresence>
          {memoryNotification && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.96 }}
              className="mb-2 px-3 py-1.5 text-xs rounded-full border inline-flex items-center gap-2 shadow-2xs select-none max-w-full"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <Brain className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
              <span className="truncate">{memoryNotification}</span>
              <button
                type="button"
                onClick={() => clearMemoryNotification()}
                className="p-0.5 rounded-full hover:bg-neutral-500/15 cursor-pointer shrink-0 ml-auto"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3 text-[var(--text-muted)]" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload validation error notice (Mobile & Desktop optimized) */}
        <AnimatePresence>
          {uploadError && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="mb-2 px-3.5 py-2.5 text-xs rounded-xl border flex items-start sm:items-center justify-between gap-2.5 shadow-xs"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
              }}
              role="alert"
            >
              <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0 text-[var(--danger)]" />
                <span className="break-words leading-relaxed text-[11px] sm:text-xs">{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={() => setUploadError(null)}
                className="p-1 rounded-md hover:bg-neutral-500/10 cursor-pointer shrink-0 min-h-[28px] min-w-[28px] flex items-center justify-center -mr-1"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context window / token limit feedback */}
        <AnimatePresence initial={false}>
          {isNearLimit && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mb-2 px-3.5 py-2.5 border flex flex-col gap-1.5 shadow-xs"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor:
                  isChatLimitReached || isDraftOverTurnLimit
                    ? 'var(--danger)'
                    : 'var(--border)',
                borderRadius: '14px',
              }}
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        isChatLimitReached || isDraftOverTurnLimit
                          ? 'var(--danger)'
                          : 'var(--accent)',
                    }}
                  />
                  <span
                    className="font-medium truncate"
                    style={{
                      color:
                        isChatLimitReached || isDraftOverTurnLimit
                          ? 'var(--danger)'
                          : 'var(--text)',
                    }}
                  >
                    {isChatLimitReached
                      ? 'Context limit reached'
                      : isDraftOverTurnLimit
                        ? 'Draft exceeds single-turn allowance'
                        : `Context capacity · ${usagePercent}% utilized`}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {isDraftOverTurnLimit && !isChatLimitReached
                      ? `${formatCompactTokens(draftTokens)} / ${formatCompactTokens(maxTurnTokens)} tokens`
                      : `${formatCompactTokens(totalTokens)} / ${formatCompactTokens(usableInputLimit)} tokens`}
                  </span>

                  {isChatLimitReached && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={continueInNewChat}
                        className="min-h-[28px] px-2.5 py-1 inline-flex items-center gap-1 text-[11px] font-medium border transition-transform active:scale-95 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text)',
                          borderRadius: '6px',
                        }}
                      >
                        <span>Continue</span>
                      </button>
                      <button
                        type="button"
                        onClick={startNewChat}
                        className="min-h-[28px] px-2.5 py-1 inline-flex items-center gap-1 text-[11px] font-medium transition-transform active:scale-95 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-contrast)',
                          borderRadius: '6px',
                        }}
                      >
                        <Plus className="w-3 h-3" />
                        <span>New chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ultra-thin context usage progress bar */}
              <div
                className="w-full h-1 overflow-hidden"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderRadius: '9999px',
                }}
              >
                <div
                  className="h-full transition-all duration-200"
                  style={{
                    width: `${
                      isDraftOverTurnLimit && !isChatLimitReached
                        ? Math.min(100, Math.round((draftTokens / maxTurnTokens) * 100))
                        : usagePercent
                    }%`,
                    backgroundColor:
                      isChatLimitReached || isDraftOverTurnLimit
                        ? 'var(--danger)'
                        : 'var(--accent)',
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {failedSend && (
          <div
            className="mb-2.5 px-3.5 py-2 flex items-center justify-between gap-3 text-xs border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-sm)',
            }}
            role="alert"
          >
            <span className="truncate">{failedSend.error}</span>
            <div className="flex items-center gap-2 shrink-0">
              {!isOffline && !isChatLimitReached && (
                <button
                  type="button"
                  onClick={() => {
                    const retryText = failedSend.text || composerDraft;
                    clearFailedSendError();
                    if (retryText.trim()) {
                      sendMessage(retryText);
                    }
                  }}
                  className="min-h-[34px] px-2.5 py-1 inline-flex items-center gap-1 font-medium border cursor-pointer"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text)',
                    borderRadius: '6px',
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Composer Card with File Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`composer-card flex flex-col border transition-all ${
            isHero
              ? 'px-3.5 py-2 sm:px-4 sm:py-2.5 min-h-[54px] sm:min-h-[58px] shadow-sm hover:shadow-md'
              : 'px-3 py-1.5 sm:px-3.5 sm:py-2 min-h-[50px] sm:min-h-[54px]'
          }`}
          style={{
            backgroundColor: isInputBlocked ? 'var(--surface-2)' : 'var(--surface)',
            borderColor:
              isChatLimitReached || isDraftOverTurnLimit
                ? 'var(--danger)'
                : 'var(--border)',
            borderRadius: isHero ? '24px' : '22px',
          }}
        >
          {/* Attachment Chips Header (Images & Text documents) */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2 mb-1.5 border-b border-[var(--border)]">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs max-w-[240px] transition-all"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  {att.type === 'image' && att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="w-5 h-5 rounded object-cover shrink-0"
                    />
                  ) : att.type === 'audio' ? (
                    <Volume2 className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
                  )}
                  <span className="truncate font-medium flex-1 text-[11px]" title={att.name}>
                    {att.name}
                  </span>
                  <span
                    className="text-[10px] shrink-0 font-mono"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {formatFileSize(att.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-0.5 rounded hover:text-[var(--danger)] cursor-pointer"
                    style={{ color: 'var(--text-muted)' }}
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Responsive Unsupported Modality Feedback Notification (Mobile & Desktop optimized) */}
          <AnimatePresence>
            {unsupportedModalityMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 4, marginBottom: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div
                  className="flex items-start sm:items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs border shadow-xs"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: 'var(--text)',
                  }}
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                    <span className="text-[11px] sm:text-xs leading-relaxed break-words" style={{ color: 'var(--text-muted)' }}>
                      <strong className="font-semibold text-amber-500 mr-1">Modality Notice:</strong>
                      {unsupportedModalityMessage}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalityDismissed(true)}
                    className="p-1 rounded-md hover:bg-neutral-500/15 cursor-pointer shrink-0 min-h-[26px] min-w-[26px] flex items-center justify-center -mr-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    aria-label="Dismiss modality notice"
                    title="Dismiss notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Input Row - Well-positioned icons matching composer height and width */}
          <div className="flex items-center gap-1.5 sm:gap-2 w-full">
            {/* 3-Dot Options Dropdown (Attach File & Web Search - Local Mode only) */}
            {mode === 'local' && (
              <div ref={menuRef} className="relative shrink-0 flex items-center self-center">
                <button
                  type="button"
                  disabled={isInputBlocked}
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className="h-9 w-9 sm:h-9.5 sm:w-9.5 inline-flex items-center justify-center rounded-full transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 relative"
                  style={{
                    color: isWebSearchActive ? 'var(--accent)' : 'var(--text-muted)',
                    backgroundColor: isMenuOpen ? 'var(--surface-2)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text)';
                    e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color =
                      isWebSearchActive ? 'var(--accent)' : 'var(--text-muted)';
                    e.currentTarget.style.backgroundColor = isMenuOpen ? 'var(--surface-2)' : 'transparent';
                  }}
                  title="Options (Attach file, Web search)"
                  aria-label="Options"
                >
                  <MoreVertical className="w-4 h-4" />
                  {(isWebSearchActive || (supportsThinking && isThinkingActive)) && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />
                  )}
                </button>

                {/* Floating Dropdown Popover */}
                <AnimatePresence>
                  {isMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      className="absolute left-0 bottom-full mb-2 w-56 p-1 rounded-2xl border shadow-xl z-50 select-none backdrop-blur-md"
                      style={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                      }}
                    >
                      {/* Item 1: Attach File */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
                      >
                        <div className="flex items-center gap-2.5">
                          <Paperclip className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                            Attach file
                          </span>
                        </div>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          &lt; 30 MB
                        </span>
                      </button>

                      <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />

                      {/* Item 2: Web Search */}
                      <button
                        type="button"
                        onClick={() => {
                          toggleWebSearch();
                        }}
                        className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
                      >
                        <div className="flex items-center gap-2.5">
                          <Globe
                            className="w-4 h-4"
                            style={{
                              color: isWebSearchActive ? 'var(--accent)' : 'var(--text-muted)',
                            }}
                          />
                          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                            Web search
                          </span>
                        </div>

                        {searchCooldown > 0 ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                            {searchCooldown}s
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors"
                            style={{
                              backgroundColor: isWebSearchActive ? 'var(--accent)' : 'var(--surface-2)',
                              borderColor: isWebSearchActive ? 'var(--accent)' : 'var(--border)',
                              color: isWebSearchActive ? 'var(--accent-contrast)' : 'var(--text-muted)',
                            }}
                          >
                            {isWebSearchActive ? 'ON' : 'OFF'}
                          </span>
                        )}
                      </button>

                      {/* Item 3: Thinking Mode (for supported models) */}
                      {supportsThinking && (
                        <>
                          <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
                          <button
                            type="button"
                            onClick={() => {
                              toggleThinking();
                            }}
                            className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
                          >
                            <div className="flex items-center gap-2.5">
                              <Brain
                                className="w-4 h-4"
                                style={{
                                  color: isThinkingActive ? 'var(--accent)' : 'var(--text-muted)',
                                }}
                              />
                              <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                                Thinking
                              </span>
                            </div>

                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors"
                              style={{
                                backgroundColor: isThinkingActive ? 'var(--accent)' : 'var(--surface-2)',
                                borderColor: isThinkingActive ? 'var(--accent)' : 'var(--border)',
                                color: isThinkingActive ? 'var(--accent-contrast)' : 'var(--text-muted)',
                              }}
                            >
                              {isThinkingActive ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Active Web Search Badge centered right after 3-dot menu */}
            {mode === 'local' && isWebSearchActive && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 transition-all select-none shadow-2xs self-center"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              >
                {searchCooldown > 0 ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {searchCooldown}s
                    </span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                    <span className="text-[11px] hidden sm:inline">Search</span>
                    <button
                      type="button"
                      onClick={toggleWebSearch}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-neutral-500/15 cursor-pointer"
                      title="Disable web search"
                      aria-label="Disable web search"
                    >
                      <X className="w-3 h-3 text-[var(--text-muted)]" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Active Thinking Badge centered right after 3-dot menu / search badge */}
            {mode === 'local' && supportsThinking && isThinkingActive && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 transition-all select-none shadow-2xs self-center"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              >
                <Brain className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <span className="text-[11px] hidden sm:inline">Thinking</span>
                <button
                  type="button"
                  onClick={toggleThinking}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-neutral-500/15 cursor-pointer"
                  title="Disable thinking mode"
                  aria-label="Disable thinking mode"
                >
                  <X className="w-3 h-3 text-[var(--text-muted)]" />
                </button>
              </div>
            )}

            {/* Auto-growing Textarea matching composer height */}
            <textarea
              ref={textareaRef}
              rows={1}
              disabled={isInputBlocked}
              value={composerDraft}
              onChange={(e) => setComposerDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isOffline
                  ? 'Network currently offline'
                  : isChatLimitReached
                    ? 'Chat limit reached — start a new chat'
                    : mode === 'cloud' && cloudStatus === 'unconfigured'
                      ? 'Configure API key in Settings > Cloud API…'
                      : isHero
                        ? 'How can I help you today?'
                        : 'Reply to Little Sun…'
              }
              className="composer-textarea flex-1 max-h-[180px] min-h-[38px] py-1.5 px-2 bg-transparent border-0 resize-none disabled:cursor-not-allowed outline-none text-[15px] sm:text-base leading-normal"
              style={{
                color: 'var(--text)',
              }}
            />

            {/* Send / Stop Button - Matching 3-dot button height and style */}
            {isStreaming ? (
              <button
                type="button"
                onClick={stopGenerating}
                className="h-9 w-9 sm:h-9.5 sm:w-9.5 inline-flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'var(--text)',
                  color: 'var(--bg)',
                  borderRadius: '9999px',
                }}
                aria-label="Stop generating"
                title="Stop generating"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSendDisabled}
                onClick={handleSend}
                className="h-9 w-9 sm:h-9.5 sm:w-9.5 inline-flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                  borderRadius: '9999px',
                }}
                aria-label="Send message"
                title="Send message"
              >
                <ArrowUp className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
