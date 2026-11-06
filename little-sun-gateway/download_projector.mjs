#!/usr/bin/env node
/**
 * Little Sun - Multimodal Projector Manager & Downloader
 * 
 * Manages multimodal vision and audio projectors (mmproj) for local models
 * across Ollama and llama.cpp / llama-server.
 * 
 * Usage:
 *   node download_projector.mjs list
 *   node download_projector.mjs download <model-key>
 *   node download_projector.mjs sync-ollama
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, 'models');

export const PROJECTOR_CATALOG = {
  'gemma4-e2b': {
    name: 'Gemma 4 E2B Multimodal Projector (Vision & Audio)',
    family: 'gemma4',
    url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/mmproj-BF16.gguf',
    filename: 'mmproj-gemma-4-E2B.gguf',
    modelMatch: 'e2b',
    ollamaTag: 'gemma4:e2b',
    expectedSizeMB: 941,
  },
  'gemma4-e4b': {
    name: 'Gemma 4 E4B Multimodal Projector (Vision & Audio)',
    family: 'gemma4',
    url: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/mmproj-BF16.gguf',
    filename: 'mmproj-gemma-4-E4B.gguf',
    modelMatch: 'e4b',
    ollamaTag: 'gemma4:e4b',
    expectedSizeMB: 945,
  },
  'qwen2-vl-7b': {
    name: 'Qwen 2 / 2.5 VL 7B Projector (Vision)',
    family: 'qwen2vl',
    url: 'https://huggingface.co/Qwen/Qwen2-VL-7B-Instruct-GGUF/resolve/main/mmproj-Qwen2-VL-7B-Instruct-f16.gguf',
    filename: 'mmproj-qwen2-vl-7b.gguf',
    modelMatch: 'qwen2',
    ollamaTag: 'qwen2-vl:7b',
    expectedSizeMB: 830,
  },
  'llava-1.6-7b': {
    name: 'LLaVA 1.6 Vicuna/Mistral 7B Projector (Vision)',
    family: 'llava',
    url: 'https://huggingface.co/cjpais/llava-1.6-vicuna-7b-gguf/resolve/main/mmproj-model-f16.gguf',
    filename: 'mmproj-llava-1.6-7b.gguf',
    modelMatch: 'llava',
    ollamaTag: 'llava:7b',
    expectedSizeMB: 600,
  },
  'minicpm-v-2_6': {
    name: 'MiniCPM-V 2.6 Projector (Vision)',
    family: 'minicpmv',
    url: 'https://huggingface.co/openbmb/MiniCPM-V-2_6-gguf/resolve/main/mmproj-model-f16.gguf',
    filename: 'mmproj-minicpm-v-2_6.gguf',
    modelMatch: 'minicpm',
    ollamaTag: 'minicpm-v:latest',
    expectedSizeMB: 750,
  },
};

export function listProjectorStatus() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  const filesOnDisk = fs.readdirSync(MODELS_DIR);
  console.log('\n--- Little Sun Multimodal Models & Projectors ---\n');
  
  for (const [key, info] of Object.entries(PROJECTOR_CATALOG)) {
    const targetPath = path.join(MODELS_DIR, info.filename);
    const exists = fs.existsSync(targetPath);
    let sizeStr = 'Not downloaded';
    if (exists) {
      const stats = fs.statSync(targetPath);
      sizeStr = `Installed (${(stats.size / (1024 * 1024)).toFixed(1)} MB)`;
    }
    console.log(`[${key}] ${info.name}`);
    console.log(`  File: ${info.filename} -> ${sizeStr}`);
    console.log(`  Ollama tag: ${info.ollamaTag}\n`);
  }
}

export function downloadProjector(key) {
  const info = PROJECTOR_CATALOG[key];
  if (!info) {
    console.error(`Unknown model projector key: "${key}". Available keys:`, Object.keys(PROJECTOR_CATALOG).join(', '));
    process.exit(1);
  }

  const destPath = path.join(MODELS_DIR, info.filename);
  console.log(`Downloading ${info.name}...`);
  console.log(`From: ${info.url}`);
  console.log(`To:   ${destPath}\n`);

  try {
    execFileSync('curl.exe', ['-L', info.url, '-o', destPath, '--progress-bar'], {
      stdio: 'inherit',
    });
    console.log(`\nSuccessfully downloaded ${info.filename}!\n`);
  } catch (err) {
    console.error(`Download failed: ${err.message}`);
    process.exit(1);
  }
}

export function syncOllamaModel(key) {
  const info = PROJECTOR_CATALOG[key];
  if (!info) return;

  const mmprojPath = path.join(MODELS_DIR, info.filename);
  if (!fs.existsSync(mmprojPath)) {
    console.log(`Projector ${info.filename} not found on disk. Download it first via: node download_projector.mjs download ${key}`);
    return;
  }

  // Find matching base GGUF model in models/
  const filesOnDisk = fs.readdirSync(MODELS_DIR);
  const baseModel = filesOnDisk.find(
    (f) =>
      f.toLowerCase().includes(info.modelMatch) &&
      !f.toLowerCase().includes('mmproj') &&
      f.toLowerCase().endsWith('.gguf')
  );

  if (!baseModel) {
    console.log(`Base model matching "${info.modelMatch}" not found in models/ directory.`);
    return;
  }

  const baseModelPath = path.join(MODELS_DIR, baseModel);
  const modelfileContent = [
    `FROM ${baseModelPath}`,
    `FROM ${mmprojPath}`,
    `TEMPLATE {{ .Prompt }}`,
    `RENDERER ${info.family}`,
    `PARSER ${info.family}`,
    `PARAMETER stop <turn|>`,
  ].join('\n');

  const modelfilePath = path.join(MODELS_DIR, `Modelfile.${key}`);
  fs.writeFileSync(modelfilePath, modelfileContent, 'utf8');

  console.log(`Creating Ollama model "${info.ollamaTag}" from Modelfile...`);
  try {
    const res = spawnSync('ollama', ['create', info.ollamaTag, '-f', modelfilePath], {
      stdio: 'inherit',
      encoding: 'utf8',
    });
    if (res.status === 0) {
      console.log(`Model "${info.ollamaTag}" is now live in Ollama with vision capabilities!`);
    }
  } catch (err) {
    console.error(`Failed to register with Ollama: ${err.message}`);
  }
}

const command = process.argv[2] || 'list';
const targetKey = process.argv[3];

if (command === 'list') {
  listProjectorStatus();
} else if (command === 'download' && targetKey) {
  downloadProjector(targetKey);
  syncOllamaModel(targetKey);
} else if (command === 'sync-ollama') {
  for (const k of Object.keys(PROJECTOR_CATALOG)) {
    syncOllamaModel(k);
  }
} else {
  console.log('Usage: node download_projector.mjs [list | download <key> | sync-ollama]');
}
