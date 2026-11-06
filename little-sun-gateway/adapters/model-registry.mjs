import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../logger.mjs';
import { OLLAMA_MODEL_ALIASES } from './backend-adapters.mjs';

const OLLAMA_DEFAULT_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

/**
 * Static registry of model families and modality envelopes.
 */
const MODEL_FAMILY_PRESETS = {
  gemma4: {
    modalities: ['text', 'image', 'audio'],
    maxImageDimension: 1536,
    audioEnvelope: {
      maxDurationSec: 30, // Gemma 4 audio hard limit is 30s
      sampleRate: 16000,   // 16 kHz
      channels: 1,         // Mono
      format: 'wav',
    },
  },
  vision_standard: {
    modalities: ['text', 'image'],
    maxImageDimension: 2048,
    audioEnvelope: null,
  },
  audio_only: {
    modalities: ['audio'],
    maxImageDimension: 0,
    audioEnvelope: {
      maxDurationSec: 30,
      sampleRate: 16000,
      channels: 1,
      format: 'wav',
    },
  },
  text_only: {
    modalities: ['text'],
    maxImageDimension: 0,
    audioEnvelope: null,
  },
};

export class ModelRegistry {
  constructor({ ollamaUrl = OLLAMA_DEFAULT_URL, gatewayDir = process.cwd() } = {}) {
    this.ollamaUrl = ollamaUrl.replace(/\/+$/, '');
    this.gatewayDir = gatewayDir;
    this.cache = new Map();
  }

  /**
   * Determine model envelope and supported modalities through dynamic Ollama discovery
   * and local configuration registry fallback.
   */
  async getModelCapabilities(modelId) {
    const rawId = (typeof modelId === 'string' && modelId.trim()) ? modelId.trim() : 'default';
    if (this.cache.has(rawId)) {
      return this.cache.get(rawId);
    }

    const caps = {
      modelId: rawId,
      canonicalName: rawId,
      supportsVision: false,
      supportsAudio: false,
      supportsText: true,
      supportsThinking: false,
      supportsTools: false,
      maxImageDimension: 1536,
      audioEnvelope: {
        maxDurationSec: 30,
        sampleRate: 16000,
        channels: 1,
        format: 'wav',
      },
      source: 'heuristic',
    };

    // 1. Check local models.json first
    try {
      const modelsJsonPath = path.resolve(this.gatewayDir, 'models.json');
      if (fs.existsSync(modelsJsonPath)) {
        const rawJson = fs.readFileSync(modelsJsonPath, 'utf8');
        const parsed = JSON.parse(rawJson);
        const targetModel = (parsed.models || []).find(
          (m) => m.id === rawId || m.name?.toLowerCase() === rawId.toLowerCase()
        );
        if (targetModel) {
          caps.canonicalName = targetModel.name || rawId;
          const modalities = Array.isArray(targetModel.modalities) ? targetModel.modalities : ['text'];
          caps.supportsVision = modalities.includes('image') || modalities.includes('vision');
          caps.supportsAudio = modalities.includes('audio');
          caps.supportsText = modalities.includes('text') || modalities.length === 0;
          caps.supportsThinking = Boolean(targetModel.supportsThinking ?? targetModel.thinking ?? false);
          caps.supportsTools = Boolean(targetModel.supportsTools ?? targetModel.tools ?? false);
          caps.source = 'models.json';
        }
      }
    } catch {
      // ignore models.json read error
    }

    // 2. Query Ollama /api/show for dynamic inspection
    const lookupName = OLLAMA_MODEL_ALIASES[rawId.toLowerCase()] || rawId;
    try {
      const showRes = await fetch(`${this.ollamaUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: lookupName }),
        signal: AbortSignal.timeout(3000),
      });

      if (showRes.ok) {
        const showData = await showRes.json();
        const families = Array.isArray(showData.details?.families)
          ? showData.details.families
          : [showData.details?.family].filter(Boolean);
        const capabilities = Array.isArray(showData.capabilities) ? showData.capabilities : [];

        // Check for vision capability in Ollama metadata
        const hasVisionFamily = families.some((f) =>
          ['clip', 'mllama', 'llava', 'qwen2vl', 'minicpmv'].includes(f.toLowerCase())
        );
        const hasVisionCapability = capabilities.includes('vision') || capabilities.includes('images');

        // Check for Gemma 4 (supports both vision and audio)
        const isGemma4 =
          families.some((f) => f.toLowerCase().includes('gemma4')) ||
          rawId.toLowerCase().includes('gemma4') ||
          rawId.toLowerCase().includes('gemma-4') ||
          lookupName.toLowerCase().includes('gemma4');

        if (hasVisionCapability || hasVisionFamily) {
          caps.supportsVision = true;
          caps.maxImageDimension = MODEL_FAMILY_PRESETS.vision_standard.maxImageDimension;
        } else if (isGemma4) {
          caps.supportsVision = hasVisionCapability;
          caps.supportsAudio = true;
          caps.maxImageDimension = MODEL_FAMILY_PRESETS.gemma4.maxImageDimension;
          caps.audioEnvelope = { ...MODEL_FAMILY_PRESETS.gemma4.audioEnvelope };
        }

        // Check audio capability
        if (families.some((f) => f.toLowerCase().includes('whisper')) || rawId.toLowerCase().includes('whisper')) {
          caps.supportsAudio = true;
          caps.supportsVision = false;
        }

        caps.source = 'ollama_api_show';
        logger.log(
          'ADAPTER',
          `Ollama detected model "${lookupName}": vision=${caps.supportsVision}, audio=${caps.supportsAudio}`
        );
      }
    } catch {
      // Ollama not reachable or timeout; continue with registry heuristics
    }

    // 3. Fallback name heuristics if not resolved
    if (caps.source === 'heuristic') {
      const lower = rawId.toLowerCase();
      if (lower.includes('gemma-4') || lower.includes('gemma4') || lower === 'sun-max' || lower === 'sun-infinity') {
        caps.supportsVision = true;
        caps.supportsAudio = true;
        caps.maxImageDimension = MODEL_FAMILY_PRESETS.gemma4.maxImageDimension;
        caps.audioEnvelope = { ...MODEL_FAMILY_PRESETS.gemma4.audioEnvelope };
      } else if (lower.includes('llava') || lower.includes('qwen-vl') || lower.includes('vision') || lower.includes('minicpm-v')) {
        caps.supportsVision = true;
        caps.maxImageDimension = MODEL_FAMILY_PRESETS.vision_standard.maxImageDimension;
      } else if (lower.includes('whisper') || lower === 'sun-audio') {
        caps.supportsAudio = true;
        caps.supportsVision = false;
      }
    }

    this.cache.set(rawId, caps);
    return caps;
  }
}
