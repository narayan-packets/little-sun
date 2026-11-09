import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.mjs';

/**
 * Temporary file tracking for deterministic ephemeral cleanup.
 */
export class TempTracker {
  constructor() {
    this.files = new Set();
  }

  track(filePath) {
    if (filePath && typeof filePath === 'string') {
      this.files.add(path.resolve(filePath));
    }
    return filePath;
  }

  cleanup() {
    for (const filePath of this.files) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          logger.log('CLEANUP', `Deleted ephemeral file: ${path.basename(filePath)}`);
        }
      } catch (err) {
        logger.log('WARN', `Could not delete temp file ${filePath}: ${err.message}`);
      }
    }
    this.files.clear();
  }
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'json', 'py', 'js', 'ts', 'jsx', 'tsx', 'html', 'css',
  'sql', 'sh', 'bash', 'yaml', 'yml', 'xml', 'log', 'env', 'toml',
  'tsv', 'csv', 'c', 'cpp', 'h', 'hpp', 'java', 'rs', 'go', 'rb', 'php'
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'tiff'
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'm4a', 'webm', 'flac', 'aac', 'opus'
]);

const DOCUMENT_EXTENSIONS = new Set([
  'pdf', 'docx', 'doc', 'rtf'
]);

export class MediaPreprocessor {
  constructor({ tmpDir = path.resolve(process.cwd(), 'tmp', 'downloads') } = {}) {
    this.tmpDir = tmpDir;
    try {
      if (!fs.existsSync(this.tmpDir)) {
        fs.mkdirSync(this.tmpDir, { recursive: true });
      }
    } catch {
      // directory exists or created
    }
  }

  /**
   * Determine whether a file is text, image, audio, or document.
   */
  classifyFileType(filename = '', mimeType = '') {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mime = (mimeType || '').toLowerCase();

    if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) {
      return 'image';
    }
    if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) {
      return 'audio';
    }
    if (TEXT_EXTENSIONS.has(ext) || mime.startsWith('text/') || mime === 'application/json' || mime === 'application/javascript') {
      return 'text';
    }
    if (DOCUMENT_EXTENSIONS.has(ext) || mime.includes('pdf') || mime.includes('document')) {
      return 'document';
    }
    return 'unknown';
  }

  /**
   * Downloads a remote attachment (or writes a base64/data-url) to a tracked temporary file.
   */
  async stageAttachment(attachment, tempTracker) {
    const cleanName = path.basename(attachment.name || 'file').replace(/[^a-zA-Z0-9.-]/g, '_');
    const localPath = path.join(this.tmpDir, `${Date.now()}_${cleanName}`);
    tempTracker.track(localPath);

    if (attachment.url && attachment.url.startsWith('data:')) {
      const match = attachment.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const buf = Buffer.from(match[2], 'base64');
        fs.writeFileSync(localPath, buf);
        return { localPath, cleanName, mimeType: match[1], size: buf.length };
      }
    }

    if (attachment.url && /^https?:\/\//i.test(attachment.url)) {
      const parsedUrl = new URL(attachment.url);
      const host = parsedUrl.hostname.toLowerCase();
      // Block SSRF to loopback, link-local, and internal addresses
      if (
        host === 'localhost' ||
        host.startsWith('127.') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host === '169.254.169.254' ||
        host === '::1' ||
        host.startsWith('172.16.') || host.startsWith('172.17.') || host.startsWith('172.18.') ||
        host.startsWith('172.19.') || host.startsWith('172.2') || host.startsWith('172.30.') || host.startsWith('172.31.')
      ) {
        throw new Error('Access to local/private network addresses is blocked.');
      }

      logger.log('FILE', `Downloading ephemeral attachment: ${cleanName}`);
      const res = await fetch(attachment.url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        throw new Error(`Failed to download attachment: HTTP ${res.status}`);
      }

      const contentLength = Number(res.headers.get('content-length') || 0);
      const MAX_BYTES = 50 * 1024 * 1024;
      if (contentLength > MAX_BYTES) {
        throw new Error('Attachment exceeds maximum allowed size of 50MB');
      }

      const fileStream = fs.createWriteStream(localPath);
      let downloaded = 0;
      if (res.body) {
        const reader = res.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            downloaded += value.length;
            if (downloaded > MAX_BYTES) {
              fileStream.destroy();
              try { fs.unlinkSync(localPath); } catch {}
              throw new Error('Attachment exceeds maximum allowed size of 50MB');
            }
            fileStream.write(Buffer.from(value));
          }
        } finally {
          fileStream.end();
          try { await reader.cancel(); } catch {}
          reader.releaseLock();
        }
      }

      const mimeType = res.headers.get('content-type') || '';
      logger.log('FILE', `Downloaded to local disk: ${cleanName} (${downloaded} bytes)`);
      return { localPath, cleanName, mimeType, size: downloaded };
    }

    throw new Error(`Invalid attachment reference for ${cleanName}`);
  }

  /**
   * Main processing pipeline: inspects model capabilities, preprocesses text, images, or audio,
   * enforcing envelope limits and converting to Ollama/adapter formats.
   */
  async processAttachment(attachment, modelCaps, tempTracker) {
    const staged = await this.stageAttachment(attachment, tempTracker);
    const category = this.classifyFileType(staged.cleanName, staged.mimeType);

    // 1. Text files: extract UTF-8 and append directly to prompt
    if (category === 'text') {
      const buf = fs.readFileSync(staged.localPath);
      const fullText = buf.toString('utf8');
      const truncated = fullText.length > 50000
        ? fullText.slice(0, 50000) + '\n\n[File truncated to 50,000 characters]'
        : fullText;
      const ext = path.extname(staged.cleanName).toLowerCase().replace('.', '') || 'txt';
      return {
        type: 'text',
        filename: staged.cleanName,
        text: truncated,
        formattedMarkdown: `\n\n**Attached Document \`${staged.cleanName}\`:**\n\`\`\`${ext}\n${truncated}\n\`\`\`\n`,
      };
    }

    // 2. Image files: normalize, resize if needed, auto-orient, encode to Base64 for Ollama images array
    if (category === 'image') {
      if (!modelCaps.supportsVision) {
        return {
          type: 'unsupported',
          category: 'image',
          filename: staged.cleanName,
          reason: `Model "${modelCaps.canonicalName}" is text-only and does not support image analysis.`,
        };
      }

      const normalizedImg = await this.normalizeImage(staged.localPath, modelCaps.maxImageDimension, tempTracker);
      return {
        type: 'image',
        filename: staged.cleanName,
        base64: normalizedImg.base64,
        dataUrl: normalizedImg.dataUrl,
        width: normalizedImg.width,
        height: normalizedImg.height,
        mimeType: normalizedImg.mimeType,
      };
    }

    // 3. Audio files: check 30s envelope, resample to 16 kHz mono WAV, chunk if exceeding limit
    if (category === 'audio') {
      if (!modelCaps.supportsAudio) {
        return {
          type: 'unsupported',
          category: 'audio',
          filename: staged.cleanName,
          reason: `Model "${modelCaps.canonicalName}" does not support direct audio analysis.`,
        };
      }

      const processedAudio = await this.normalizeAudio(
        staged.localPath,
        staged.cleanName,
        modelCaps.audioEnvelope,
        tempTracker
      );
      return {
        type: 'audio',
        filename: staged.cleanName,
        ...processedAudio,
      };
    }

    // 4. Documents (e.g. PDF): text fallback
    if (category === 'document') {
      return {
        type: 'text',
        filename: staged.cleanName,
        text: `[Attached Document: ${staged.cleanName} (${(staged.size / 1024).toFixed(1)} KB)]`,
        formattedMarkdown: `\n\n[Attached Document: \`${staged.cleanName}\` (${(staged.size / 1024).toFixed(1)} KB)]\n`,
      };
    }

    return {
      type: 'unsupported',
      category: 'unknown',
      filename: staged.cleanName,
      reason: `Unsupported media format for ${staged.cleanName}`,
    };
  }

  /**
   * Normalizes image using ffmpeg: caps maximum dimension, auto-orients, and converts to PNG/JPEG.
   */
  async normalizeImage(inputPath, maxDimension = 1536, tempTracker) {
    let width = 0;
    let height = 0;

    // Probe dimensions with ffprobe
    try {
      const probeJson = execFileSync(
        'ffprobe',
        ['-v', 'quiet', '-print_format', 'json', '-show_streams', inputPath],
        { encoding: 'utf8', timeout: 5000 }
      );
      const parsed = JSON.parse(probeJson);
      const vStream = (parsed.streams || []).find((s) => s.codec_type === 'video') || parsed.streams?.[0];
      if (vStream) {
        width = Number(vStream.width || 0);
        height = Number(vStream.height || 0);
      }
    } catch {
      // ffprobe unavailable or errored
    }

    const maxDim = Math.max(width, height);
    let targetPath = inputPath;

    // Resize and normalize orientation if exceeds max dimension
    if (maxDim > maxDimension || maxDim === 0) {
      const outputPath = path.join(
        this.tmpDir,
        `norm_${Date.now()}_${path.basename(inputPath, path.extname(inputPath))}.jpg`
      );
      tempTracker.track(outputPath);

      try {
        const scaleFilter = maxDimension > 0 ? `scale='min(${maxDimension},iw)':-1` : 'scale=iw:ih';
        execFileSync(
          'ffmpeg',
          ['-y', '-i', inputPath, '-vf', scaleFilter, '-auto-orient', '-q:v', '2', outputPath],
          { stdio: ['ignore', 'ignore', 'ignore'], timeout: 10000 }
        );
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          targetPath = outputPath;
          logger.log('MEDIA', `Normalized image to ${maxDimension}px max dimension: ${path.basename(outputPath)}`);
        }
      } catch (err) {
        logger.log('WARN', `Image normalization fallback: ${err.message}`);
      }
    }

    const buf = fs.readFileSync(targetPath);
    const base64 = buf.toString('base64');
    return {
      base64,
      dataUrl: `data:image/jpeg;base64,${base64}`,
      width,
      height,
      mimeType: 'image/jpeg',
    };
  }

  /**
   * Resamples audio to 16 kHz mono WAV and segments into <= 30-second chunks (Gemma 4 envelope).
   */
  async normalizeAudio(inputPath, filename, envelope = { maxDurationSec: 30, sampleRate: 16000, channels: 1 }, tempTracker) {
    const maxDurationSec = envelope.maxDurationSec || 30;
    const sampleRate = envelope.sampleRate || 16000;
    const channels = envelope.channels || 1;

    // 1. Probe audio duration
    let durationSec = 0;
    try {
      const probeJson = execFileSync(
        'ffprobe',
        ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
        { encoding: 'utf8', timeout: 5000 }
      );
      const parsed = JSON.parse(probeJson);
      durationSec = parseFloat(parsed.format?.duration || parsed.streams?.[0]?.duration || 0);
    } catch {
      durationSec = 0;
    }

    // 2. Resample to standard 16 kHz mono WAV
    const resampledPath = path.join(
      this.tmpDir,
      `resampled_${Date.now()}_${path.basename(inputPath, path.extname(inputPath))}.wav`
    );
    tempTracker.track(resampledPath);

    try {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-i', inputPath,
          '-ar', String(sampleRate),
          '-ac', String(channels),
          '-c:a', 'pcm_s16le',
          resampledPath,
        ],
        { stdio: ['ignore', 'ignore', 'ignore'], timeout: 15000 }
      );
    } catch (ffmpegErr) {
      logger.log('WARN', `Audio resampling failed, using raw buffer: ${ffmpegErr.message}`);
      const rawBuf = fs.readFileSync(inputPath);
      return {
        isChunked: false,
        chunks: [{ base64: rawBuf.toString('base64'), duration: durationSec || 1 }],
        totalDuration: durationSec,
        sampleRate,
        channels,
      };
    }

    // 3. Chunk audio if it exceeds max duration limit (30 seconds)
    const chunks = [];
    if (durationSec > maxDurationSec) {
      logger.log(
        'MEDIA',
        `Audio duration (${durationSec.toFixed(1)}s) exceeds limit (${maxDurationSec}s). Chunking into sequential segments...`
      );

      const chunkPattern = path.join(
        this.tmpDir,
        `chunk_${Date.now()}_%03d.wav`
      );

      try {
        execFileSync(
          'ffmpeg',
          [
            '-y',
            '-i', resampledPath,
            '-f', 'segment',
            '-segment_time', String(maxDurationSec),
            '-c', 'copy',
            chunkPattern,
          ],
          { stdio: ['ignore', 'ignore', 'ignore'], timeout: 15000 }
        );

        // Find all generated segment files
        const dir = path.dirname(chunkPattern);
        const prefix = path.basename(chunkPattern).replace('%03d.wav', '');
        const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.wav')).sort();

        for (let i = 0; i < files.length; i++) {
          const segPath = path.join(dir, files[i]);
          tempTracker.track(segPath);
          const buf = fs.readFileSync(segPath);
          chunks.push({
            index: i,
            duration: Math.min(maxDurationSec, Math.max(0, durationSec - i * maxDurationSec)),
            base64: buf.toString('base64'),
          });
        }
      } catch (chunkErr) {
        logger.log('WARN', `Audio chunking error: ${chunkErr.message}`);
      }
    }

    if (chunks.length === 0) {
      const buf = fs.readFileSync(resampledPath);
      chunks.push({
        index: 0,
        duration: durationSec || 1,
        base64: buf.toString('base64'),
      });
    }

    logger.log('MEDIA', `Processed audio "${filename}": ${chunks.length} chunk(s), duration=${durationSec.toFixed(1)}s, 16kHz mono WAV`);

    return {
      isChunked: chunks.length > 1,
      chunks,
      totalDuration: durationSec,
      sampleRate,
      channels,
    };
  }
}
