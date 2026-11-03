import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Clock,
  Code,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  File as GenericFileIcon,
  Maximize2,
  Music,
  Pause,
  Play,
  Subtitles,
  Video as VideoIcon,
  Volume2,
  X,
} from 'lucide-react';

interface ImageCardProps {
  src: string;
  alt?: string;
}

export function downloadTextAsFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

export async function downloadMediaFile(url: string, defaultName: string) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch {
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export const ImageCard: React.FC<ImageCardProps> = ({ src, alt = 'Generated Image' }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanAlt = alt.trim() || 'Generated Image';
  const fileName = `little-sun-${cleanAlt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now()}.png`;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    await downloadMediaFile(src, fileName);
    setDownloading(false);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const isExpired = useMemo(() => {
    try {
      const match = /(?:[?&]exp=|\#exp=)(\d+)/.exec(src);
      if (match && match[1]) {
        return Date.now() > Number(match[1]);
      }
    } catch {
      // ignore
    }
    return false;
  }, [src]);

  if (isExpired) {
    return (
      <div
        className="my-2.5 px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs select-none max-w-sm"
        style={{
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[var(--text)]">Attachment expired</div>
          <div className="text-[11px] text-[var(--text-muted)]">Preview removed to save storage (1-hour limit)</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="my-2.5 px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs select-none max-w-sm"
        style={{
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[var(--text)]">Attachment expired & removed</div>
          <div className="text-[11px] text-[var(--text-muted)]">File was deleted from storage per 1-hour privacy policy.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="group relative my-3 w-fit max-w-full rounded-xl overflow-hidden border shadow-xs transition-all duration-200"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {!loaded && (
          <div
            className="min-h-[160px] min-w-[240px] max-w-md w-full py-12 px-6 animate-pulse flex items-center justify-center text-xs"
            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
          >
            Loading visual…
          </div>
        )}

        <img
          src={src}
          alt={cleanAlt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          onClick={() => setLightboxOpen(true)}
          className={`block max-w-full max-h-[70vh] sm:max-h-[560px] w-auto h-auto object-contain cursor-zoom-in transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0 h-0 w-0'
          }`}
        />

        {loaded && (
          <div className="p-2 sm:p-2.5 border-t flex items-center justify-between gap-2 text-xs bg-[var(--surface-2)]/90 backdrop-blur-xs min-w-[220px]">
            <span
              className="text-[11px] sm:text-xs truncate font-medium flex-1 max-w-[200px] sm:max-w-xs"
              style={{ color: 'var(--text-muted)' }}
              title={cleanAlt}
            >
              {cleanAlt}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="h-8 px-2 inline-flex items-center gap-1 rounded border transition-colors cursor-pointer text-xs"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: copied ? 'var(--success)' : 'var(--text)',
                }}
                title="Copy link"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="h-8 px-2.5 inline-flex items-center gap-1 rounded font-medium border transition-transform active:scale-95 cursor-pointer text-xs"
                style={{
                  backgroundColor: 'var(--accent)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent-contrast)',
                }}
                title="Download image"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloading ? 'Saving…' : 'Download'}</span>
              </button>

              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="h-8 w-8 inline-flex items-center justify-center rounded border transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
                title="Expand fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxOpen(false)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md select-none"
          >
            <div
              className="w-full max-w-5xl flex items-center justify-between mb-3 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-medium truncate max-w-[70%] text-neutral-200">
                {cleanAlt}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] text-white cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <motion.div
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              transition={{ duration: 0.18 }}
              className="relative max-w-5xl max-h-[85vh] overflow-hidden rounded-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={src}
                alt={cleanAlt}
                className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

interface VideoCardProps {
  src: string;
  title?: string;
}

export const VideoCard: React.FC<VideoCardProps> = ({ src, title = 'Generated Video' }) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanTitle = title.trim() || 'Generated Video';
  const fileName = `little-sun-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now()}.mp4`;

  const handleDownload = async () => {
    setDownloading(true);
    await downloadMediaFile(src, fileName);
    setDownloading(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="my-3.5 max-w-full sm:max-w-lg md:max-w-xl rounded-xl overflow-hidden border shadow-xs"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="relative w-full aspect-video bg-black flex items-center justify-center">
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-contain"
        >
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="p-2.5 sm:p-3 border-t flex items-center justify-between gap-2 bg-[var(--surface-2)]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <VideoIcon className="w-4 h-4 shrink-0 text-[var(--accent)]" />
          <span
            className="text-xs truncate font-medium"
            style={{ color: 'var(--text-muted)' }}
            title={cleanTitle}
          >
            {cleanTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="h-8 px-2.5 inline-flex items-center gap-1 rounded border transition-colors cursor-pointer text-xs"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: copied ? 'var(--success)' : 'var(--text)',
            }}
            title="Copy video link"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="h-8 px-3 inline-flex items-center gap-1.5 rounded font-medium border transition-transform active:scale-95 cursor-pointer text-xs"
            style={{
              backgroundColor: 'var(--accent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
            title="Download video"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloading ? 'Saving…' : 'Download'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* AudioCard: Audio Generation Output (Whisper / TTS / Audio Models)         */
/* ========================================================================= */

interface AudioCardProps {
  src: string;
  title?: string;
}

export const AudioCard: React.FC<AudioCardProps> = ({ src, title = 'Generated Audio' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanTitle = title.trim() || 'Audio Output';
  const fileName = `little-sun-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now()}.mp3`;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play();
      setIsPlaying(true);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    await downloadMediaFile(src, fileName);
    setDownloading(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isExpired = useMemo(() => {
    try {
      const match = /(?:[?&]exp=|\#exp=)(\d+)/.exec(src);
      if (match && match[1]) {
        return Date.now() > Number(match[1]);
      }
    } catch {
      // ignore
    }
    return false;
  }, [src]);

  if (isExpired) {
    return (
      <div
        className="my-2.5 px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs select-none max-w-sm"
        style={{
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[var(--text)]">Audio expired</div>
          <div className="text-[11px] text-[var(--text-muted)]">Audio file removed to save storage (1-hour limit)</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="my-3 max-w-full sm:max-w-md rounded-xl overflow-hidden border shadow-xs"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="p-3 sm:p-3.5 flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full inline-flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-contrast)',
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Info & Living Waveform */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
              {cleanTitle}
            </div>
            <div className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Living Waveform Bars when playing */}
          <div className="flex items-end gap-1 h-3.5 w-full">
            {[40, 80, 55, 95, 30, 70, 100, 60, 45, 85, 65, 35].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-full transition-all duration-200"
                style={{
                  height: isPlaying ? `${Math.max(20, (h * ((currentTime * 10 + i) % 10)) / 10)}%` : '25%',
                  backgroundColor: isPlaying ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded border transition-colors cursor-pointer text-xs"
            style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            title="Copy audio link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 rounded border transition-colors cursor-pointer text-xs"
            style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
            title="Download audio"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* SvgCard: Interactive Live SVG Output & Download                           */
/* ========================================================================= */

interface SvgCardProps {
  code: string;
  title?: string;
}

export const SvgCard: React.FC<SvgCardProps> = ({ code, title = 'Vector Graphic (SVG)' }) => {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const cleanTitle = title.trim() || 'vector-graphic';
  const fileName = `little-sun-${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now()}.svg`;

  const handleDownload = () => {
    downloadTextAsFile(code, fileName, 'image/svg+xml');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="my-3 max-w-full sm:max-w-lg rounded-xl overflow-hidden border shadow-xs"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header Bar */}
      <div className="p-2 sm:p-2.5 border-b flex items-center justify-between text-xs bg-[var(--surface-2)]">
        <div className="flex items-center gap-1.5 font-medium truncate" style={{ color: 'var(--text)' }}>
          <FileCode className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="truncate">{cleanTitle}</span>
          <span className="text-[10px] px-1 py-0.2 rounded border bg-[var(--surface)] text-[var(--text-muted)]">
            SVG
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowCode((v) => !v)}
            className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors"
            style={{ borderColor: 'var(--border)' }}
            title={showCode ? 'View rendered graphic' : 'View SVG XML code'}
          >
            {showCode ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
            <span className="hidden sm:inline">{showCode ? 'Render' : 'Code'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors"
            style={{ borderColor: 'var(--border)' }}
            title="Copy SVG XML"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="h-7 px-2.5 inline-flex items-center gap-1 rounded font-medium border text-xs cursor-pointer active:scale-95"
            style={{
              backgroundColor: 'var(--accent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
            title="Download .svg"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Content: Rendered SVG or Code */}
      {showCode ? (
        <pre
          className="p-3 text-xs font-mono overflow-x-auto max-h-[360px]"
          style={{ backgroundColor: 'var(--code-bg)', color: 'var(--text)' }}
        >
          {code}
        </pre>
      ) : (
        <div
          className="p-4 sm:p-6 flex items-center justify-center max-h-[420px] overflow-hidden"
          style={{ backgroundColor: 'var(--surface)' }}
          dangerouslySetInnerHTML={{ __html: code }}
        />
      )}
    </div>
  );
};

/* ========================================================================= */
/* SubtitleCard: Subtitles (.SRT / .VTT) Output & Download                   */
/* ========================================================================= */

export interface SubtitleCue {
  id: number;
  start: string;
  end: string;
  text: string;
}

export function parseTimestampToMs(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.replace(/[\[\]\(\)]/g, '').trim();
  const parts = clean.split(':');
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let ms = 0;

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    const secParts = parts[2].split(/[,\.]/);
    seconds = parseInt(secParts[0], 10) || 0;
    if (secParts[1]) {
      ms = parseInt(secParts[1].padEnd(3, '0').slice(0, 3), 10) || 0;
    }
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10) || 0;
    const secParts = parts[1].split(/[,\.]/);
    seconds = parseInt(secParts[0], 10) || 0;
    if (secParts[1]) {
      ms = parseInt(secParts[1].padEnd(3, '0').slice(0, 3), 10) || 0;
    }
  } else if (parts.length === 1) {
    const secParts = parts[0].split(/[,\.]/);
    seconds = parseInt(secParts[0], 10) || 0;
    if (secParts[1]) {
      ms = parseInt(secParts[1].padEnd(3, '0').slice(0, 3), 10) || 0;
    }
  }
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
}

export function formatMsToTimecode(ms: number, format: 'srt' | 'vtt'): string {
  const safeMs = Math.max(0, ms);
  const hours = Math.floor(safeMs / 3600000);
  const minutes = Math.floor((safeMs % 3600000) / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  const millis = safeMs % 1000;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(millis).padStart(3, '0');
  const sep = format === 'vtt' ? '.' : ',';
  return `${hh}:${mm}:${ss}${sep}${mmm}`;
}

export function normalizeSubtitleTrack(
  rawCode: string,
  targetFormat: 'srt' | 'vtt' = 'srt'
): {
  normalizedCode: string;
  cues: SubtitleCue[];
} {
  const trimmed = (rawCode || '').trim();
  if (!trimmed) {
    return { normalizedCode: '', cues: [] };
  }

  const cues: SubtitleCue[] = [];
  const arrowRegex = /(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)\s*(?:-->|->|–|-)\s*(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)/;

  if (arrowRegex.test(trimmed)) {
    const rawBlocks = trimmed.replace(/\r\n/g, '\n').split(/\n\s*\n/);
    let cueIndex = 1;

    for (const block of rawBlocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      const arrowLineIdx = lines.findIndex((l) => arrowRegex.test(l));
      if (arrowLineIdx === -1) continue;

      const m = arrowRegex.exec(lines[arrowLineIdx]);
      if (!m) continue;

      const startMs = parseTimestampToMs(m[1]);
      const endMs = parseTimestampToMs(m[2]);
      const textLines = lines.slice(arrowLineIdx + 1);
      const text = textLines.join('\n').trim();

      cues.push({
        id: cueIndex++,
        start: formatMsToTimecode(startMs, targetFormat),
        end: formatMsToTimecode(endMs > startMs ? endMs : startMs + 2500, targetFormat),
        text: text || '…',
      });
    }
  }

  // If no arrow cues were found, parse line-by-line timestamped format (e.g. 00:00.000 English Welcome...)
  if (cues.length === 0) {
    const rawLines = trimmed.replace(/\r\n/g, '\n').split('\n');
    const parsedEntries: Array<{ startMs: number; rawText: string }> = [];
    const lineTimeRegex = /^\s*(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)(?:\]|\))?\s+(.*)$/;

    for (const line of rawLines) {
      const match = lineTimeRegex.exec(line);
      if (match) {
        const ms = parseTimestampToMs(match[1]);
        parsedEntries.push({
          startMs: ms,
          rawText: match[2].trim(),
        });
      }
    }

    if (parsedEntries.length > 0) {
      // Check if there is a repeated language token like "English " or "[English] " across the cues
      const langPrefixRegex = /^(?:[A-Za-z]{2,12}:?\s+|\[[A-Za-z]{2,12}\]\s*)/;
      const prefixes = parsedEntries.map((e) => {
        const m = langPrefixRegex.exec(e.rawText);
        return m ? m[0].trim().toLowerCase() : '';
      });
      const firstPrefix = prefixes[0];
      const matchCount = firstPrefix ? prefixes.filter((p) => p === firstPrefix).length : 0;
      const isLanguageCommon = matchCount >= parsedEntries.length * 0.4;

      for (let i = 0; i < parsedEntries.length; i++) {
        const cur = parsedEntries[i];
        let text = cur.rawText;
        if (isLanguageCommon && firstPrefix && text.toLowerCase().startsWith(firstPrefix)) {
          text = text.slice(firstPrefix.length).trim();
          if (text.startsWith(':')) text = text.slice(1).trim();
        }

        const next = parsedEntries[i + 1];
        let endMs: number;
        if (next && next.startMs > cur.startMs) {
          endMs = next.startMs;
        } else {
          endMs = cur.startMs + Math.max(2000, Math.min(5000, text.length * 60));
        }

        cues.push({
          id: i + 1,
          start: formatMsToTimecode(cur.startMs, targetFormat),
          end: formatMsToTimecode(endMs, targetFormat),
          text: text || '…',
        });
      }
    }
  }

  let normalizedCode = '';
  if (cues.length > 0) {
    if (targetFormat === 'vtt') {
      normalizedCode =
        'WEBVTT\n\n' +
        cues.map((c) => `${c.id}\n${c.start} --> ${c.end}\n${c.text}`).join('\n\n');
    } else {
      normalizedCode = cues
        .map((c) => `${c.id}\n${c.start} --> ${c.end}\n${c.text}`)
        .join('\n\n');
    }
  } else {
    normalizedCode = trimmed;
  }

  return { normalizedCode, cues };
}

export function getMimeTypeForFilename(filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'doc':
    case 'docx':
      return 'application/msword;charset=utf-8;';
    case 'rtf':
      return 'application/rtf;charset=utf-8;';
    case 'csv':
      return 'text/csv;charset=utf-8;';
    case 'json':
      return 'application/json;charset=utf-8;';
    case 'html':
    case 'htm':
      return 'text/html;charset=utf-8;';
    case 'md':
    case 'markdown':
      return 'text/markdown;charset=utf-8;';
    case 'srt':
      return 'application/x-subrip;charset=utf-8;';
    case 'vtt':
      return 'text/vtt;charset=utf-8;';
    case 'svg':
      return 'image/svg+xml;charset=utf-8;';
    default:
      return 'text/plain;charset=utf-8;';
  }
}

/**
 * Normalizes filenames by excluding impossible binary file formats:
 * - .docx cannot be generated as raw text; convert to .doc (which opens natively and cleanly in Word without corruption)
 * - .xlsx/.xls cannot be generated as raw text; convert to .csv (which opens natively in Excel)
 * - .pptx cannot be generated as raw text; convert to .doc
 * - .pdf cannot be generated as raw text; convert to .doc
 */
export function normalizeDownloadFilename(filename: string): string {
  if (!filename) return 'document.txt';
  let clean = filename.trim();
  clean = clean
    .replace(/\.docx$/i, '.doc')
    .replace(/\.xlsx?$/i, '.csv')
    .replace(/\.pptx?$/i, '.doc')
    .replace(/\.pdf$/i, '.doc');
  return clean;
}

export function prepareDocumentContent(
  content: string,
  rawFilename: string
): { data: string; mime: string } {
  const filename = normalizeDownloadFilename(rawFilename);
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const mime = getMimeTypeForFilename(filename);

  if (ext === 'doc' || ext === 'docx') {
    if (!content.includes('<html') && !content.startsWith('{\\rtf')) {
      const escapedBody = content
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return '<p style="margin: 0; min-height: 12pt;">&nbsp;</p>';
          return `<p style="margin: 0 0 6pt 0;">${trimmed
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</p>`;
        })
        .join('\n');

      const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${filename}</title>
<!--[if gte mso 9]>
<xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
  <w:DoNotOptimizeForBrowser/>
 </w:WordDocument>
</xml>
<![endif]-->
<style>
body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11.5pt; line-height: 1.6; color: #1e1e1e; margin: 1in; }
p { margin: 0 0 6pt 0; }
</style>
</head>
<body>
${escapedBody}
</body>
</html>`;
      return { data: wordHtml, mime: 'application/msword;charset=utf-8;' };
    }
  }

  // Prepend UTF-8 BOM for CSV/TSV so Excel opens unicode/accents correctly
  if (ext === 'csv' || ext === 'tsv') {
    const hasBom = content.charCodeAt(0) === 0xfeff;
    return { data: hasBom ? content : '\uFEFF' + content, mime };
  }

  // Markdown files: clean UTF-8
  if (ext === 'md' || ext === 'markdown') {
    return { data: content, mime: 'text/markdown;charset=utf-8;' };
  }

  // HTML files: ensure valid html structure if bare body
  if (ext === 'html' || ext === 'htm') {
    if (!content.toLowerCase().includes('<html')) {
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${filename}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: 0 auto; color: #1f2937; }
</style>
</head>
<body>
${content}
</body>
</html>`;
      return { data: fullHtml, mime };
    }
  }

  return { data: content, mime };
}

interface SubtitleCardProps {
  code: string;
  format?: 'srt' | 'vtt';
}

export const SubtitleCard: React.FC<SubtitleCardProps> = ({ code, format = 'srt' }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'cues' | 'raw'>('cues');
  const ext = format.toLowerCase() as 'srt' | 'vtt';
  const fileName = `little-sun-subtitles-${Date.now()}.${ext}`;

  const { normalizedCode, cues } = useMemo(
    () => normalizeSubtitleTrack(code, ext),
    [code, ext]
  );

  const handleDownload = () => {
    downloadTextAsFile(
      normalizedCode,
      fileName,
      ext === 'vtt' ? 'text/vtt' : 'application/x-subrip'
    );
  };

  const handleDownloadDoc = () => {
    const docText =
      cues.length > 0
        ? cues.map((c) => c.text).join('\n')
        : normalizedCode;
    const docName = `little-sun-subtitles-${Date.now()}.doc`;
    const { data, mime } = prepareDocumentContent(docText, docName);
    downloadTextAsFile(data, docName, mime);
  };

  const handleDownloadMd = () => {
    let mdContent = `# Subtitle Track (${ext.toUpperCase()})\n\n`;
    if (cues.length > 0) {
      cues.forEach((c) => {
        mdContent += `- **${c.start} → ${c.end}**: ${c.text}\n`;
      });
    } else {
      mdContent += normalizedCode;
    }
    const mdName = `little-sun-subtitles-${Date.now()}.md`;
    downloadTextAsFile(mdContent, mdName, 'text/markdown;charset=utf-8;');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="my-3 max-w-full sm:max-w-xl rounded-xl overflow-hidden border shadow-xs"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header Bar: Mobile-optimized 2-tier or single desktop bar */}
      <div className="p-2 sm:p-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-[var(--surface-2)]">
        {/* Title row: Icon, Subtitle Track, format badge, cue count, and on mobile the primary download button */}
        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Subtitles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <span className="font-semibold text-xs sm:text-sm whitespace-nowrap" style={{ color: 'var(--text)' }}>
              Subtitle Track
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border bg-[var(--surface)] text-[var(--text-muted)] shrink-0">
              {ext}
            </span>
            {cues.length > 0 && (
              <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                · {cues.length} {cues.length === 1 ? 'cue' : 'cues'}
              </span>
            )}
          </div>

          {/* On mobile only: primary download button in top row */}
          <button
            type="button"
            onClick={handleDownload}
            className="sm:hidden h-7 px-2.5 inline-flex items-center gap-1.5 rounded font-medium border text-xs cursor-pointer active:scale-95 shrink-0"
            style={{
              backgroundColor: 'var(--accent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
            title={`Download .${ext}`}
          >
            <Download className="w-3 h-3" />
            <span>.{ext}</span>
          </button>
        </div>

        {/* Action Toolbar: ViewMode, Copy, Doc, Md, and Desktop Download */}
        <div className="flex items-center flex-wrap gap-1 sm:gap-1.5 shrink-0">
          {cues.length > 0 && (
            <button
              type="button"
              onClick={() => setViewMode((v) => (v === 'cues' ? 'raw' : 'cues'))}
              className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors active:scale-95"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              title={viewMode === 'cues' ? 'View raw subtitle code' : 'View formatted cue cards'}
            >
              {viewMode === 'cues' ? <Code className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{viewMode === 'cues' ? 'Code' : 'Cues'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors active:scale-95"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            title="Copy subtitle text"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadDoc}
            className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors active:scale-95"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            title="Download dialogue as Word .doc document"
          >
            <FileText className="w-3 h-3 text-[var(--accent)]" />
            <span>.doc</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMd}
            className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors active:scale-95"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            title="Download dialogue as Markdown .md file"
          >
            <FileText className="w-3 h-3 text-amber-500" />
            <span>.md</span>
          </button>

          {/* Desktop primary download button */}
          <button
            type="button"
            onClick={handleDownload}
            className="hidden sm:inline-flex h-7 px-2.5 items-center gap-1.5 rounded font-medium border text-xs cursor-pointer active:scale-95"
            style={{
              backgroundColor: 'var(--accent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
            title={`Download .${ext}`}
          >
            <Download className="w-3 h-3" />
            <span>Download .{ext}</span>
          </button>
        </div>
      </div>

      {/* Body: Formatted Cues or Raw Code */}
      {viewMode === 'cues' && cues.length > 0 ? (
        <div
          className="p-2.5 sm:p-3 space-y-1.5 max-h-[300px] overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {cues.map((cue) => {
            const speakerMatch = cue.text.match(/^([^:\n]{1,24}):\s*(.*)$/s);
            return (
              <div
                key={cue.id}
                className="p-2 sm:p-2.5 rounded-lg border transition-colors flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5 text-xs"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="flex items-center gap-1.5 shrink-0 select-none">
                  <span className="text-[10px] font-mono font-medium opacity-60">#{cue.id}</span>
                  <span
                    className="text-[10.5px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {cue.start} → {cue.end}
                  </span>
                </div>
                <div
                  className="text-[13px] leading-relaxed break-words font-medium"
                  style={{ color: 'var(--text)' }}
                >
                  {speakerMatch ? (
                    <>
                      <span className="font-semibold text-[var(--accent)]">{speakerMatch[1]}: </span>
                      <span>{speakerMatch[2]}</span>
                    </>
                  ) : (
                    cue.text
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <pre
          className="p-3 text-xs font-mono overflow-x-auto max-h-[260px] m-0"
          style={{ backgroundColor: 'var(--code-bg)', color: 'var(--text)', whiteSpace: 'pre-wrap' }}
        >
          {normalizedCode}
        </pre>
      )}
    </div>
  );
};

/* ========================================================================= */
/* FileDownloadCard: Document (DOCX, PDF, CSV, TXT, etc.) File Output        */
/* ========================================================================= */

interface FileDownloadCardProps {
  filename: string;
  url?: string;
  content?: string;
  fileType?: string;
}

export const FileDownloadCard: React.FC<FileDownloadCardProps> = ({
  filename: rawFilename,
  url,
  content,
  fileType,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const filename = useMemo(() => normalizeDownloadFilename(rawFilename), [rawFilename]);
  const ext = (fileType || filename.split('.').pop() || 'file').toLowerCase();
  const hasContent = typeof content === 'string' && content.length > 0;
  const contentBytes = hasContent ? new Blob([content]).size : 0;
  const sizeLabel = useMemo(() => {
    if (!contentBytes) return null;
    if (contentBytes < 1024) return `${contentBytes} B`;
    return `${(contentBytes / 1024).toFixed(1)} KB`;
  }, [contentBytes]);

  const handleDownload = async () => {
    setDownloading(true);
    if (content) {
      const { data, mime } = prepareDocumentContent(content, filename);
      downloadTextAsFile(data, filename, mime);
    } else if (url) {
      await downloadMediaFile(url, filename);
    }
    setDownloading(false);
  };

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  const getIcon = () => {
    if (['md', 'markdown'].includes(ext)) return <FileText className="w-4 h-4 text-amber-500" />;
    if (['csv', 'xlsx', 'xls', 'tsv'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    if (['docx', 'doc', 'rtf'].includes(ext)) return <FileText className="w-4 h-4 text-sky-500" />;
    if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-rose-500" />;
    if (['txt', 'log'].includes(ext)) return <FileText className="w-4 h-4 text-[var(--accent)]" />;
    if (['srt', 'vtt'].includes(ext)) return <Subtitles className="w-4 h-4 text-sky-500" />;
    if (['svg', 'json', 'py', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'sql', 'sh'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-purple-500" />;
    }
    return <GenericFileIcon className="w-4 h-4 text-[var(--text-muted)]" />;
  };

  return (
    <div
      className="my-3 max-w-full sm:max-w-xl rounded-xl overflow-hidden border shadow-xs"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs bg-[var(--surface-2)]">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="p-1.5 rounded-lg bg-[var(--surface)] border shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              {getIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-xs font-semibold truncate"
                style={{ color: 'var(--text)' }}
                title={filename}
              >
                {filename}
              </div>
              <div className="text-[10px] uppercase font-mono mt-0.5 text-[var(--text-muted)] flex items-center gap-1.5">
                <span>{ext} Document</span>
                {sizeLabel && <span>· {sizeLabel}</span>}
              </div>
            </div>
          </div>

          {/* Primary mobile download button in top row */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="sm:hidden h-7 px-2.5 inline-flex items-center gap-1.5 rounded font-medium border text-xs cursor-pointer active:scale-95 shrink-0"
            style={{
              backgroundColor: 'var(--accent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
            title={`Download ${filename}`}
          >
            <Download className="w-3 h-3" />
            <span>{downloading ? '…' : 'Save'}</span>
          </button>
        </div>

        <div className="flex items-center flex-wrap gap-1 sm:gap-1.5 shrink-0">
          {hasContent && (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors active:scale-95"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              title={showPreview ? 'Hide file preview' : 'View file content'}
            >
              {showPreview ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
              <span>{showPreview ? 'Hide' : 'Preview'}</span>
            </button>
          )}

          {hasContent && (
            <button
              type="button"
              onClick={handleCopy}
              className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors active:scale-95"
              style={{ borderColor: 'var(--border)' }}
              title="Copy file content"
            >
              {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="hidden sm:inline-flex h-7 px-2.5 items-center gap-1.5 rounded font-medium border text-xs cursor-pointer active:scale-95"
            style={{
              backgroundColor: 'var(--accent)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-contrast)',
            }}
            title={`Download ${filename}`}
          >
            <Download className="w-3 h-3" />
            <span>{downloading ? 'Saving…' : 'Download'}</span>
          </button>
        </div>
      </div>

      {showPreview && hasContent && (
        <pre
          className="p-3 text-xs font-mono overflow-x-auto max-h-[260px] m-0 border-t"
          style={{
            backgroundColor: 'var(--code-bg)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
        </pre>
      )}
    </div>
  );
};
