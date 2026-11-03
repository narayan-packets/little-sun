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

interface SubtitleCardProps {
  code: string;
  format?: 'srt' | 'vtt';
}

export const SubtitleCard: React.FC<SubtitleCardProps> = ({ code, format = 'srt' }) => {
  const [copied, setCopied] = useState(false);
  const ext = format.toLowerCase();
  const fileName = `little-sun-subtitles-${Date.now()}.${ext}`;

  const handleDownload = () => {
    downloadTextAsFile(code, fileName, ext === 'vtt' ? 'text/vtt' : 'application/x-subrip');
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
      <div className="p-2 sm:p-2.5 border-b flex items-center justify-between text-xs bg-[var(--surface-2)]">
        <div className="flex items-center gap-1.5 font-medium truncate" style={{ color: 'var(--text)' }}>
          <Subtitles className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Subtitle Track</span>
          <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded border bg-[var(--surface)] text-[var(--text-muted)]">
            {ext}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="h-7 px-2 inline-flex items-center gap-1 rounded border text-xs cursor-pointer hover:bg-[var(--surface)] transition-colors"
            style={{ borderColor: 'var(--border)' }}
            title="Copy subtitle text"
          >
            {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
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
            title={`Download .${ext}`}
          >
            <Download className="w-3 h-3" />
            <span>Download .{ext}</span>
          </button>
        </div>
      </div>

      <pre
        className="p-3 text-xs font-mono overflow-x-auto max-h-[220px]"
        style={{ backgroundColor: 'var(--code-bg)', color: 'var(--text)' }}
      >
        {code}
      </pre>
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
  filename,
  url,
  content,
  fileType,
}) => {
  const [downloading, setDownloading] = useState(false);
  const ext = (fileType || filename.split('.').pop() || 'file').toLowerCase();

  const handleDownload = async () => {
    setDownloading(true);
    if (content) {
      downloadTextAsFile(content, filename);
    } else if (url) {
      await downloadMediaFile(url, filename);
    }
    setDownloading(false);
  };

  const getIcon = () => {
    if (['csv', 'xlsx', 'xls'].includes(ext)) return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    if (['docx', 'doc', 'pdf', 'txt', 'rtf'].includes(ext)) return <FileText className="w-4 h-4 text-[var(--accent)]" />;
    if (['srt', 'vtt'].includes(ext)) return <Subtitles className="w-4 h-4 text-sky-500" />;
    if (['svg', 'json', 'py', 'js', 'html'].includes(ext)) return <FileCode className="w-4 h-4 text-purple-500" />;
    return <GenericFileIcon className="w-4 h-4 text-[var(--text-muted)]" />;
  };

  return (
    <div
      className="my-2.5 max-w-full sm:max-w-md rounded-xl p-3 border flex items-center justify-between gap-3 shadow-xs"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="p-2 rounded-lg bg-[var(--surface-2)] shrink-0">
          {getIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }} title={filename}>
            {filename}
          </div>
          <div className="text-[10px] uppercase font-mono mt-0.5 text-[var(--text-muted)]">
            {ext} Document
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg font-medium border text-xs cursor-pointer active:scale-95 shrink-0"
        style={{
          backgroundColor: 'var(--accent)',
          borderColor: 'var(--accent)',
          color: 'var(--accent-contrast)',
        }}
        title={`Download ${filename}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>{downloading ? 'Saving…' : 'Download'}</span>
      </button>
    </div>
  );
};
