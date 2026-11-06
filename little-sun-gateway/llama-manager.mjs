import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.mjs';

const GATEWAY_DIR = path.dirname(fileURLToPath(import.meta.url));

function findGgufFiles(modelsDir) {
  const results = [];
  if (!fs.existsSync(modelsDir)) return results;

  try {
    const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    for (const entry of entries) {
      const lower = entry.name.toLowerCase();
      if (lower.includes('mmproj') || lower.includes('projector') || lower.includes('imatrix')) {
        continue;
      }
      if (entry.isFile() && lower.endsWith('.gguf')) {
        results.push(`models/${entry.name}`);
      } else if (entry.isDirectory()) {
        const subDir = path.join(modelsDir, entry.name);
        try {
          const subFiles = fs.readdirSync(subDir, { withFileTypes: true });
          for (const sub of subFiles) {
            const subLower = sub.name.toLowerCase();
            if (subLower.includes('mmproj') || subLower.includes('projector') || subLower.includes('imatrix')) {
              continue;
            }
            if (sub.isFile() && subLower.endsWith('.gguf')) {
              results.push(`models/${entry.name}/${sub.name}`);
            }
          }
        } catch {
          // ignore unreadable subdir
        }
      }
    }
  } catch {
    // ignore scan error
  }
  return results;
}

export class LlamaManager {
  constructor({ llamaPort = 8089 } = {}) {
    this.llamaPort = Number(llamaPort);
    this.gatewayDir = GATEWAY_DIR;
    this.llamaBin = process.env.LLAMA_BIN || 'bin/llama-server.exe';
    this.idleUnloadSeconds = Number(process.env.IDLE_UNLOAD_SECONDS || 60);
    this.modelsConfigPath = path.resolve(this.gatewayDir, 'models.json');
    this.modelsDir = path.resolve(this.gatewayDir, 'models');

    this.state = 'unloaded'; // 'unloaded' | 'loading' | 'ready' | 'processing'
    this.currentModelId = null;
    this.currentModelName = null;
    this.activeChatId = null;
    this.proc = null;
    this.idleTimer = null;
    this.idleDeadlineMs = null;

    try {
      if (!fs.existsSync(this.modelsDir)) {
        fs.mkdirSync(this.modelsDir, { recursive: true });
      }
    } catch {
      // ignore mkdir error
    }

    // Perform initial scan on startup and watch models/ directory for live changes
    this.readConfig();
    this.startModelsWatcher();
  }

  startModelsWatcher() {
    try {
      if (fs.existsSync(this.modelsDir)) {
        fs.watch(this.modelsDir, { persistent: false }, () => {
          this.readConfig();
        });
      }
    } catch {
      // fs.watch may not be supported on all filesystems
    }

    // Periodic check every 5s in case files are moved/copied into models/ while running
    this.scanInterval = setInterval(() => {
      this.readConfig();
    }, 5000);
    if (this.scanInterval.unref) {
      this.scanInterval.unref();
    }
  }

  resolveGatewayPath(relOrAbsPath) {
    if (!relOrAbsPath || typeof relOrAbsPath !== 'string') return '';
    const trimmed = relOrAbsPath.trim();
    if (!trimmed) return '';
    if (path.isAbsolute(trimmed)) return trimmed;
    const fromGateway = path.resolve(this.gatewayDir, trimmed);
    if (fs.existsSync(fromGateway)) return fromGateway;
    return path.resolve(process.cwd(), trimmed);
  }

  isFileOnDisk(filePath) {
    const resolved = this.resolveGatewayPath(filePath);
    if (!resolved) return false;
    try {
      return fs.existsSync(resolved) && fs.statSync(resolved).isFile();
    } catch {
      return false;
    }
  }

  readConfig() {
    const defaultSystemPrompt =
      "You are Little Sun, a calm, direct, and thoughtful personal assistant. Answer questions concisely, naturally, and accurately. Do not overexplain or lecture. Never claim you cannot create files; you have full capability to generate downloadable files directly using ```file:<filename>.<ext> blocks (e.g. ```file:README.md, ```file:subtitles.doc, or ```file:data.csv), which automatically renders an interactive card with 1-click Download, Copy, and Preview in the UI. When calculations or math are involved, use LaTeX ($$...$$ for display and $...$ for inline math). When generating subtitles or SRT files, output standard SubRip format inside ```srt blocks with cue numbers and arrow timecodes (00:00:00,000 --> 00:00:02,000). Speak with natural intelligence.";

    let cfg = {
      default: '',
      systemPrompt: defaultSystemPrompt,
      models: [],
    };

    let needsWrite = false;

    try {
      if (fs.existsSync(this.modelsConfigPath)) {
        const raw = fs.readFileSync(this.modelsConfigPath, 'utf8').trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          const rawSysPrompt = typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt.trim() : '';
          const isLegacyMathPrompt = rawSysPrompt.includes('interactive graphs');
          if (isLegacyMathPrompt) {
            needsWrite = true;
          }
          cfg = {
            default: typeof parsed.default === 'string' ? parsed.default : '',
            systemPrompt:
              rawSysPrompt && !isLegacyMathPrompt
                ? rawSysPrompt
                : defaultSystemPrompt,
            models: Array.isArray(parsed.models) ? parsed.models : [],
          };
        } else {
          needsWrite = true;
        }
      } else {
        needsWrite = true;
      }
    } catch {
      needsWrite = true;
    }

    // Discover all .gguf files inside little-sun-gateway/models/
    const ggufRelPaths = findGgufFiles(this.modelsDir);

    // 1. Remove placeholder/template entries (e.g. sun-core.gguf / sun-light.gguf) that do not exist on disk
    const cleanedModels = [];
    for (const m of cfg.models) {
      if (!m || typeof m !== 'object') {
        needsWrite = true;
        continue;
      }
      const rawFile = typeof m.file === 'string' ? m.file.trim() : '';
      const normFile = rawFile.replace(/\\/g, '/').toLowerCase();
      const isTemplateMissing =
        (normFile === 'models/sun-core.gguf' || normFile === 'models/sun-light.gguf') &&
        !this.isFileOnDisk(rawFile);
      const isProjectorOrImatrix =
        normFile.includes('mmproj') || normFile.includes('projector') || normFile.includes('imatrix');

      if (isTemplateMissing || isProjectorOrImatrix) {
        needsWrite = true;
        continue;
      }
      cleanedModels.push(m);
    }
    cfg.models = cleanedModels;

    // 2. Attach or auto-register every .gguf file found in models/
    for (const relPath of ggufRelPaths) {
      const normTarget = relPath.replace(/\\/g, '/').toLowerCase();

      const alreadyRegistered = cfg.models.some(
        (m) =>
          typeof m.file === 'string' &&
          m.file.trim().replace(/\\/g, '/').toLowerCase() === normTarget
      );

      if (alreadyRegistered) continue;

      // Check if user left an entry with an empty "file": "" waiting to be bound
      const emptySlot = cfg.models.find(
        (m) => !m.file || typeof m.file !== 'string' || m.file.trim() === ''
      );

      if (emptySlot) {
        emptySlot.file = relPath;
        if (!emptySlot.id || typeof emptySlot.id !== 'string' || !emptySlot.id.trim()) {
          emptySlot.id = `model-${cfg.models.indexOf(emptySlot) + 1}`;
        }
        if (!emptySlot.name || typeof emptySlot.name !== 'string' || !emptySlot.name.trim()) {
          const idx = cfg.models.indexOf(emptySlot) + 1;
          emptySlot.name = idx === 1 ? 'Sun Core' : idx === 2 ? 'Sun Light' : `Model ${idx}`;
        }
        emptySlot.enabled = emptySlot.enabled !== false;
        emptySlot.contextSize = emptySlot.contextSize || 16384;
        emptySlot.threads = emptySlot.threads || 4;
        emptySlot.temperature = emptySlot.temperature ?? 0.7;
        emptySlot.maxTokens = emptySlot.maxTokens || 4096;
        needsWrite = true;
        logger.log('LLM', `Bound GGUF model on disk: ${relPath} -> "${emptySlot.name}"`);
        continue;
      }

      // Create a new model entry with a privacy-safe alias
      const usedIds = new Set(cfg.models.map((m) => m.id));
      let index = cfg.models.length + 1;
      let cleanId = index === 1 ? 'sun-core' : index === 2 ? 'sun-light' : `model-${index}`;
      while (usedIds.has(cleanId)) {
        index += 1;
        cleanId = `model-${index}`;
      }

      const defaultAlias =
        cfg.models.length === 0
          ? 'Sun Core'
          : cfg.models.length === 1
            ? 'Sun Light'
            : `Model ${cfg.models.length + 1}`;

      cfg.models.push({
        id: cleanId,
        name: defaultAlias,
        file: relPath,
        enabled: true,
        contextSize: 16384,
        threads: 4,
        temperature: 0.7,
        maxTokens: 4096,
      });
      needsWrite = true;
      logger.log('LLM', `Auto-discovered GGUF model on disk: ${relPath} -> "${defaultAlias}"`);
    }

    // 3. Auto-link multimodal projectors (mmproj) for any model matching filename patterns
    try {
      if (fs.existsSync(this.modelsDir)) {
        const allFiles = fs.readdirSync(this.modelsDir, { withFileTypes: true });
        const projectorFiles = allFiles
          .filter((e) => e.isFile() && e.name.toLowerCase().includes('mmproj') && e.name.toLowerCase().endsWith('.gguf'))
          .map((e) => `models/${e.name}`);

        for (const m of cfg.models) {
          if (!m.mmproj && m.file) {
            const baseFileName = path.basename(m.file, path.extname(m.file)).toLowerCase();
            const match = projectorFiles.find((p) => {
              const pLower = path.basename(p).toLowerCase();
              if (baseFileName.includes('e4b') && pLower.includes('e4b')) return true;
              if (baseFileName.includes('e2b') && pLower.includes('e2b')) return true;
              if (baseFileName.includes('qwen2') && pLower.includes('qwen2')) return true;
              if (baseFileName.includes('llava') && pLower.includes('llava')) return true;
              if (baseFileName.includes('minicpm') && pLower.includes('minicpm')) return true;
              return false;
            });
            if (match) {
              m.mmproj = match;
              needsWrite = true;
              logger.log('LLM', `Auto-linked multimodal projector for ${m.name}: ${match}`);
            }
          }
        }
      }
    } catch {
      // ignore projector scan error
    }

    // 4. Ensure cfg.default points to an available model on disk
    const availableModels = cfg.models.filter(
      (m) => m.enabled !== false && typeof m.file === 'string' && this.isFileOnDisk(m.file)
    );
    if (availableModels.length > 0) {
      const currentDefaultValid = availableModels.some((m) => m.id === cfg.default);
      if (!currentDefaultValid) {
        cfg.default = availableModels[0].id;
        needsWrite = true;
      }
    } else if (cfg.models.length === 0 && cfg.default !== '') {
      cfg.default = '';
      needsWrite = true;
    }


    if (needsWrite) {
      try {
        fs.writeFileSync(this.modelsConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
      } catch {
        // ignore write error
      }
    }

    return cfg;
  }

  updateModelsConfig(updates) {
    const cfg = this.readConfig();
    if (typeof updates.default === 'string') {
      cfg.default = updates.default;
    }
    if (Array.isArray(updates.models)) {
      for (const patch of updates.models) {
        const target = (cfg.models || []).find((m) => m.id === patch.id);
        if (target) {
          if (typeof patch.name === 'string' && patch.name.trim()) {
            target.name = patch.name.trim();
          }
          if (typeof patch.enabled === 'boolean') {
            target.enabled = patch.enabled;
          }
        }
      }
    }
    fs.writeFileSync(this.modelsConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
    logger.log('LLM', 'Updated models configuration (models.json)');
    return this.getModelsList();
  }

  getModelsList() {
    const cfg = this.readConfig();
    const validModels = (cfg.models || []).filter(
      (m) => m && m.enabled !== false && typeof m.file === 'string' && m.file.trim() !== ''
    );
    const defaultId = cfg.default || (validModels[0]?.id ?? '');

    return validModels.map((m, idx) => {
      const available = this.isFileOnDisk(m.file);
      const id = m.id || `model-${idx + 1}`;
      const modalities = Array.isArray(m.modalities) ? [...m.modalities] : (m.modality ? [m.modality] : ['text']);
      const hasMmproj = Boolean(m.mmproj && this.isFileOnDisk(m.mmproj));
      if (hasMmproj && !modalities.includes('image')) {
        modalities.push('image');
      }
      const supportsImages = modalities.includes('image') || modalities.includes('vision');
      const supportsAudio = modalities.includes('audio');
      const supportsThinking = Boolean(m.supportsThinking ?? m.thinking ?? false);
      const supportsTools = Boolean(m.supportsTools ?? m.tools ?? false);
      return {
        id,
        name: (typeof m.name === 'string' && m.name.trim()) || `Model ${idx + 1}`,
        available,
        enabled: true,
        isDefault: id === defaultId,
        contextSize: m.contextSize || 16384,
        maxTokens: m.maxTokens || 4096,
        modalities,
        supportsImages,
        supportsAudio,
        supportsThinking,
        thinking: supportsThinking,
        supportsTools,
        tools: supportsTools,
        hasProjector: hasMmproj,
      };
    });
  }

  getModelConfig(modelId) {
    const cfg = this.readConfig();
    const validModels = (cfg.models || []).filter(
      (m) => m && m.enabled !== false && typeof m.file === 'string' && m.file.trim() !== ''
    );
    if (validModels.length === 0) return null;

    const availableModels = validModels.filter((m) => this.isFileOnDisk(m.file));
    const pool = availableModels.length > 0 ? availableModels : validModels;

    const targetId = modelId || cfg.default;
    const found = pool.find((m) => m.id === targetId) || pool[0];
    if (!found) return null;

    const displayName = (typeof found.name === 'string' && found.name.trim()) || 'Little Sun';
    const identityPrompt = [
      cfg.systemPrompt || defaultSystemPrompt,
      `Identity: You are "${displayName}" under Little Sun. Respond with clarity, precision, and natural intelligence without lecturing or overexplaining.`,
    ].join('\n');

    return {
      ...found,
      name: displayName,
      systemPrompt: identityPrompt,
    };
  }

  getStatus() {
    let idleSecondsLeft = null;
    if (this.state === 'ready' && this.idleDeadlineMs) {
      idleSecondsLeft = Math.max(0, Math.ceil((this.idleDeadlineMs - Date.now()) / 1000));
    }
    return {
      state: this.state,
      modelId: this.currentModelId,
      modelName: this.currentModelName,
      activeChatId: this.activeChatId,
      idleSecondsLeft,
    };
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.idleDeadlineMs = null;
  }

  startIdleTimer() {
    this.clearIdleTimer();
    if (this.state !== 'ready') return;
    const ms = this.idleUnloadSeconds * 1000;
    this.idleDeadlineMs = Date.now() + ms;
    this.idleTimer = setTimeout(() => {
      logger.log(
        'LLM',
        `Idle timeout (${this.idleUnloadSeconds}s) reached — unloading ${this.currentModelName || this.currentModelId}`
      );
      this.unload();
    }, ms);
  }

  async eraseSlotCache() {
    if (!this.proc || this.state === 'unloaded') return;
    try {
      await fetch(`http://127.0.0.1:${this.llamaPort}/slots/0?action=erase`, {
        method: 'POST',
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      // Older llama-server builds may ignore /slots/0?action=erase
    }
  }

  async switchChatInstance(nextChatId, { action = 'sleep' } = {}) {
    const prevChatId = this.activeChatId;
    this.activeChatId = nextChatId || null;

    if (action === 'kill') {
      if (this.proc) {
        logger.log('LLM', `Killing previous chat instance (${prevChatId || 'none'}) and freeing model memory`);
        await this.unload();
      }
      this.activeChatId = nextChatId || null;
      return;
    }

    if (prevChatId && prevChatId !== nextChatId && this.proc) {
      logger.log(
        'LLM',
        `Sleeping previous chat instance (${prevChatId.slice(0, 8)}) -> isolating new chat (${(nextChatId || 'new').slice(0, 8)})`
      );
      await this.eraseSlotCache();
      if (this.state === 'ready') {
        this.startIdleTimer();
      }
    }
  }

  async unload() {
    this.clearIdleTimer();
    const proc = this.proc;
    this.proc = null;
    this.currentModelId = null;
    this.currentModelName = null;
    this.activeChatId = null;
    this.state = 'unloaded';

    if (proc && proc.pid) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${proc.pid} /t /f`, { stdio: 'ignore' });
        } else {
          proc.kill('SIGTERM');
        }
      } catch {
        // Process already exited
      }
    }
  }

  async ensureLoaded(modelId, onColdStart, chatId = null) {
    const modelCfg = this.getModelConfig(modelId);
    if (!modelCfg) {
      throw new Error(
        'No GGUF models found. Place a .gguf file in little-sun-gateway/models/ and it will be detected automatically.'
      );
    }

    const modelPath = this.resolveGatewayPath(modelCfg.file);
    if (!modelPath || !fs.existsSync(modelPath)) {
      throw new Error(`Model file not found on disk: ${modelCfg.file}`);
    }

    this.clearIdleTimer();

    if (this.state === 'ready' && this.currentModelId === modelCfg.id && this.proc) {
      if (chatId && this.activeChatId && this.activeChatId !== chatId) {
        await this.eraseSlotCache();
      }
      this.activeChatId = chatId || this.activeChatId;
      this.currentModelName = modelCfg.name;
      return modelCfg;
    }

    if (this.proc || this.currentModelId !== modelCfg.id) {
      await this.unload();
    }

    this.activeChatId = chatId || null;

    this.state = 'loading';
    this.currentModelId = modelCfg.id;
    this.currentModelName = modelCfg.name;
    if (typeof onColdStart === 'function') {
      onColdStart();
    }

    if (modelCfg.file && /whisper/i.test(modelCfg.file)) {
      throw new Error(
        `Whisper model "${modelCfg.name}" is an audio transcription model and cannot be hosted via llama-server. Please select a chat-compatible LLM.`
      );
    }

    const loadStart = Date.now();
    logger.log('LLM', `Cold-starting llama-server with model "${modelCfg.name}" (${modelCfg.file})...`);

    const binPath = this.resolveGatewayPath(this.llamaBin);
    const args = [
      '-m',
      modelPath,
      '--host',
      '127.0.0.1',
      '--port',
      String(this.llamaPort),
      '-c',
      String(modelCfg.contextSize || 16384),
      '-t',
      String(modelCfg.threads || 4),
      '-np',
      '1',
    ];

    // Detect and attach multimodal vision projector (--mmproj) if explicitly configured or matches architecture
    let mmprojPath = null;
    if (typeof modelCfg.mmproj === 'string' && modelCfg.mmproj.trim()) {
      const resolved = this.resolveGatewayPath(modelCfg.mmproj);
      if (fs.existsSync(resolved)) mmprojPath = resolved;
    }
    if (!mmprojPath && modelCfg.file) {
      try {
        const baseFileName = path.basename(modelCfg.file, path.extname(modelCfg.file)).toLowerCase();
        const isVisionCapable = baseFileName.includes('gemma-4') || baseFileName.includes('gemma4') ||
                                baseFileName.includes('llava') || baseFileName.includes('qwen2-vl');
        if (isVisionCapable) {
          const entries = fs.readdirSync(this.modelsDir);
          const mmMatch = entries.find((e) => {
            const eLower = e.toLowerCase();
            if (!eLower.includes('mmproj') || !eLower.endsWith('.gguf')) return false;
            if (baseFileName.includes('e4b') && eLower.includes('e4b')) return true;
            if (baseFileName.includes('e2b') && eLower.includes('e2b')) return true;
            if (baseFileName.includes('qwen') && eLower.includes('qwen')) return true;
            if (baseFileName.includes('llava') && eLower.includes('llava')) return true;
            return false;
          });
          if (mmMatch) {
            mmprojPath = path.join(this.modelsDir, mmMatch);
          }
        }
      } catch {}
    }
    if (mmprojPath) {
      args.push('--mmproj', mmprojPath);
      logger.log('LLM', `Attached multimodal vision projector: ${path.basename(mmprojPath)}`);
    }

    const child = spawn(binPath, args, {
      stdio: ['ignore', 'ignore', 'ignore'],
      windowsHide: true,
    });

    this.proc = child;

    child.on('exit', (code) => {
      if (this.proc === child) {
        this.proc = null;
        this.currentModelId = null;
        this.currentModelName = null;
        this.state = 'unloaded';
        this.clearIdleTimer();
        logger.log('LLM', `llama-server process exited (code=${code ?? 0})`);
      }
    });

    await this.waitForHealth(90000);
    this.state = 'ready';
    const elapsedSec = ((Date.now() - loadStart) / 1000).toFixed(1);
    logger.log('LLM', `Model "${modelCfg.name}" loaded and ready in ${elapsedSec}s`);
    return modelCfg;
  }

  async waitForHealth(timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    const url = `http://127.0.0.1:${this.llamaPort}/health`;

    while (Date.now() < deadline) {
      if (!this.proc) {
        throw new Error('llama-server exited before becoming ready');
      }
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          return;
        }
      } catch {
        // Still starting
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    await this.unload();
    throw new Error('Timed out waiting for llama-server to load model');
  }

  beginProcessing() {
    this.clearIdleTimer();
    this.state = 'processing';
  }

  finishProcessing() {
    if (this.proc) {
      this.state = 'ready';
      this.startIdleTimer();
    } else {
      this.state = 'unloaded';
    }
  }
}
