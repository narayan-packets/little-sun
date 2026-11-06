import { logger } from '../logger.mjs';

const OLLAMA_DEFAULT_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

/**
 * Maps Little Sun internal model IDs to Ollama model names if needed.
 */
export const OLLAMA_MODEL_ALIASES = {
  'sun-max': 'gemma4:e2b',
  'sun-infinity': 'gemma4:e4b',
  'gemma-4-e2b': 'gemma4:e2b',
  'gemma-4-e4b': 'gemma4:e4b',
  'gemma4-e2b': 'gemma4:e2b',
  'gemma4-e4b': 'gemma4:e4b',
};

/**
 * Base Backend Adapter interface.
 */
export class BaseBackendAdapter {
  constructor(name) {
    this.name = name;
  }

  async streamChat() {
    throw new Error('streamChat must be implemented by adapter subclass');
  }
}

/**
 * Ollama Backend Adapter: formats multimodal requests (images array, audio chunks, text)
 * and streams tokens via NDJSON from Ollama's /api/chat.
 */
export class OllamaBackendAdapter extends BaseBackendAdapter {
  constructor({ ollamaUrl = OLLAMA_DEFAULT_URL } = {}) {
    super('ollama');
    this.ollamaUrl = ollamaUrl.replace(/\/+$/, '');
  }

  resolveOllamaModelName(rawModelId = '') {
    const trimmed = rawModelId.trim().toLowerCase();
    if (OLLAMA_MODEL_ALIASES[trimmed]) {
      return OLLAMA_MODEL_ALIASES[trimmed];
    }
    return rawModelId.trim() || 'gemma4:e2b';
  }

  async isAvailable() {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels() {
    try {
      const res = await fetch(`${this.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data.models) ? data.models : [];
      }
    } catch {
      // not reachable
    }
    return [];
  }

  async streamChat({
    modelId,
    sanitizedMessages = [],
    processedMedia = [],
    dynamicSystemPrompt = '',
    temperature = 0.7,
    signal,
    thinking = true,
    onToken,
    onThinking,
    onStatus,
    onError,
    onDone,
  }) {
    const targetModel = this.resolveOllamaModelName(modelId);
    if (typeof onStatus === 'function') {
      onStatus('generating');
    }

    // 1. Build messages array for Ollama /api/chat
    const ollamaMessages = [];

    // System prompt
    if (dynamicSystemPrompt) {
      ollamaMessages.push({
        role: 'system',
        content: dynamicSystemPrompt,
      });
    }

    // Separate previous history and the active user turn
    const chatMessages = sanitizedMessages.filter((m) => m.role !== 'system');
    const history = chatMessages.slice(0, -1);
    const lastUserMsg = chatMessages[chatMessages.length - 1] || { role: 'user', content: '' };

    for (const hist of history) {
      ollamaMessages.push({
        role: hist.role || 'user',
        content: hist.content || '',
      });
    }

    // 2. Prepare user content, images, and audio for the active turn
    let userText = lastUserMsg.content || '';
    const imagesArray = [];
    let audioContext = '';

    for (const item of processedMedia) {
      if (item.type === 'text') {
        userText += item.formattedMarkdown || `\n\n**${item.filename}:**\n${item.text}\n`;
      } else if (item.type === 'image') {
        if (item.base64) {
          imagesArray.push(item.base64);
        }
      } else if (item.type === 'audio') {
        const chunkInfo = item.isChunked
          ? `${item.chunks.length} sequential segments (total duration: ${item.totalDuration?.toFixed(1) || '?'}s)`
          : `duration: ${item.totalDuration?.toFixed(1) || '<30'}s`;
        audioContext += `\n\n[Audio Attachment: \`${item.filename}\` — 16 kHz mono WAV, ${chunkInfo}]`;
      } else if (item.type === 'unsupported') {
        userText += `\n\n[System Note: ${item.reason}]`;
      }
    }

    if (audioContext) {
      userText += audioContext;
    }

    // Assemble final user turn with images array per Ollama specifications:
    // { "role": "user", "content": "<prompt text>", "images": ["<base64_string>"] }
    const finalUserMessage = {
      role: 'user',
      content: userText || '(Attachment uploaded)',
    };
    if (imagesArray.length > 0) {
      finalUserMessage.images = imagesArray;
    }

    ollamaMessages.push(finalUserMessage);

    const payload = {
      model: targetModel,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: Number(temperature) || 0.7,
      },
    };

    logger.log(
      'OLLAMA',
      `Forwarding to Ollama /api/chat (model=${targetModel}, messages=${ollamaMessages.length}, images=${imagesArray.length})`
    );

    let res;
    try {
      res = await fetch(`${this.ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err) {
      const msg = `Failed to connect to local Ollama server at ${this.ollamaUrl}: ${err.message}`;
      logger.log('ERR', msg);
      if (typeof onError === 'function') onError(msg);
      return;
    }

    if (!res.ok || !res.body) {
      let errDetail = '';
      try {
        const errJson = await res.json();
        errDetail = errJson.error || JSON.stringify(errJson);
      } catch {
        errDetail = await res.text().catch(() => `HTTP ${res.status}`);
      }

      if (errDetail.includes('does not support multimodal')) {
        const cleanMsg = `Model "${targetModel}" does not have multimodal vision enabled in Ollama. Please load a vision-projector enabled model to inspect images.`;
        logger.log('WARN', cleanMsg);
        if (typeof onError === 'function') onError(cleanMsg);
        return;
      }

      const fullError = `Ollama server error (HTTP ${res.status}): ${errDetail}`;
      logger.log('ERR', fullError);
      if (typeof onError === 'function') onError(fullError);
      return;
    }

    // 3. Read streaming NDJSON response from Ollama
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed);
            if (chunk.error) {
              if (typeof onError === 'function') onError(chunk.error);
              return;
            }
            // Stream reasoning trace when model supports thinking and thinking is enabled
            const thinkingChunk = chunk.message?.thinking;
            if (typeof thinkingChunk === 'string' && thinkingChunk.length > 0) {
              if (thinking !== false && typeof onThinking === 'function') {
                onThinking(thinkingChunk);
              }
            }

            const token = chunk.message?.content;
            if (typeof token === 'string' && token.length > 0) {
              tokenCount += 1;
              if (typeof onToken === 'function') onToken(token);
            }
            if (chunk.done) {
              const evalTokens = chunk.eval_count || tokenCount;
              if (typeof onDone === 'function') onDone(evalTokens);
              return;
            }
          } catch {
            // ignore malformed NDJSON line
          }
        }
      }

      if (typeof onDone === 'function') {
        onDone(tokenCount);
      }
    } catch (streamErr) {
      if (signal?.aborted) return;
      logger.log('ERR', `Ollama stream aborted: ${streamErr.message}`);
      if (typeof onError === 'function') onError(streamErr.message);
    }
  }
}

/**
 * Llama.cpp Server Adapter: fallback OpenAI-compatible runner.
 */
export class LlamaServerAdapter extends BaseBackendAdapter {
  constructor({ llamaManager, llamaPort = 8089 } = {}) {
    super('llama-server');
    this.llama = llamaManager;
    this.llamaPort = Number(llamaPort);
  }

  async streamChat({
    modelId,
    sanitizedMessages = [],
    processedMedia = [],
    dynamicSystemPrompt = '',
    temperature = 0.7,
    chatId = null,
    signal,
    onToken,
    onStatus,
    onError,
    onDone,
  }) {
    if (!this.llama) {
      throw new Error('LlamaManager instance required for LlamaServerAdapter');
    }

    const modelCfg = await this.llama.ensureLoaded(
      modelId,
      () => {
        if (typeof onStatus === 'function') onStatus('loading_model');
      },
      chatId
    );

    this.llama.beginProcessing();
    if (typeof onStatus === 'function') onStatus('generating');

    const chatMessages = sanitizedMessages.filter((m) => m.role !== 'system');
    const localImageParts = [];
    let attachedTextContext = '';

    for (const item of processedMedia) {
      if (item.type === 'text') {
        attachedTextContext += item.formattedMarkdown || `\n\n**${item.filename}:**\n${item.text}\n`;
      } else if (item.type === 'image' && item.dataUrl) {
        localImageParts.push({
          type: 'image_url',
          image_url: { url: item.dataUrl },
        });
      } else if (item.type === 'audio') {
        attachedTextContext += `\n\n[Audio Attachment: \`${item.filename}\` (${item.totalDuration?.toFixed(1) || '?'}s)]`;
      }
    }

    if (attachedTextContext && chatMessages.length > 0) {
      const lastIdx = chatMessages.length - 1;
      if (chatMessages[lastIdx].role === 'user') {
        chatMessages[lastIdx] = {
          ...chatMessages[lastIdx],
          content: `${chatMessages[lastIdx].content}${attachedTextContext}`,
        };
      }
    }

    const upstreamMessages = [
      { role: 'system', content: dynamicSystemPrompt || modelCfg.systemPrompt },
      ...chatMessages.map((m, idx) => {
        if (idx === chatMessages.length - 1 && m.role === 'user' && localImageParts.length > 0) {
          return {
            role: 'user',
            content: [
              { type: 'text', text: m.content },
              ...localImageParts,
            ],
          };
        }
        return m;
      }),
    ];

    let upstreamRes;
    try {
      upstreamRes = await fetch(`http://127.0.0.1:${this.llamaPort}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: upstreamMessages,
          stream: true,
          temperature: modelCfg.temperature ?? temperature ?? 0.7,
          max_tokens: modelCfg.maxTokens ?? 4096,
        }),
        signal,
      });
    } catch (fetchErr) {
      this.llama.finishProcessing();
      if (typeof onError === 'function') onError(fetchErr.message);
      return;
    }

    // Graceful fallback if mmproj not loaded in llama-server
    if (!upstreamRes.ok && localImageParts.length > 0) {
      logger.log('WARN', `llama-server rejected image_url. Retrying with textual attachment metadata...`);
      const fallbackMessages = chatMessages.map((m, idx) => {
        if (idx === chatMessages.length - 1 && m.role === 'user') {
          return {
            role: 'user',
            content: `${m.content}\n\n[Note: Image attached but active model lacks an mmproj projector file in models/.]`,
          };
        }
        return m;
      });

      upstreamRes = await fetch(`http://127.0.0.1:${this.llamaPort}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: dynamicSystemPrompt || modelCfg.systemPrompt }, ...fallbackMessages],
          stream: true,
          temperature: modelCfg.temperature ?? temperature ?? 0.7,
          max_tokens: modelCfg.maxTokens ?? 4096,
        }),
        signal,
      });
    }

    if (!upstreamRes.ok || !upstreamRes.body) {
      this.llama.finishProcessing();
      const errText = await upstreamRes.text().catch(() => '');
      const msg = errText ? `Model generation error: ${errText.slice(0, 150)}` : 'Model generation failed.';
      if (typeof onError === 'function') onError(msg);
      return;
    }

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payloadStr = trimmed.slice(5).trim();
          if (!payloadStr || payloadStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payloadStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
              tokenCount += 1;
              if (typeof onToken === 'function') onToken(delta);
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }

      this.llama.finishProcessing();
      if (typeof onDone === 'function') onDone(tokenCount);
    } catch (err) {
      this.llama.finishProcessing();
      if (signal?.aborted) return;
      if (typeof onError === 'function') onError(err.message);
    }
  }
}

/**
 * Adapter Factory: dispatches chat requests dynamically to Ollama or LlamaServer.
 */
export class BackendAdapterFactory {
  constructor({ ollamaUrl = OLLAMA_DEFAULT_URL, llamaManager, llamaPort = 8089 } = {}) {
    this.ollamaAdapter = new OllamaBackendAdapter({ ollamaUrl });
    this.llamaAdapter = new LlamaServerAdapter({ llamaManager, llamaPort });
  }

  async selectAdapter({ modelId, preferredBackend = process.env.DEFAULT_BACKEND || 'auto' } = {}) {
    const rawId = (modelId || '').toLowerCase().trim();

    // 1. Explicit preference
    if (preferredBackend === 'ollama') {
      return this.ollamaAdapter;
    }
    if (preferredBackend === 'llama') {
      return this.llamaAdapter;
    }

    // 2. Auto selection: check if Ollama has the model or is requested
    const isOllamaRunning = await this.ollamaAdapter.isAvailable();
    if (isOllamaRunning) {
      const ollamaModels = await this.ollamaAdapter.listModels();
      const resolvedName = this.ollamaAdapter.resolveOllamaModelName(rawId);
      const hasModelInOllama = ollamaModels.some(
        (m) => m.name === resolvedName || m.name.startsWith(resolvedName.split(':')[0])
      );

      if (hasModelInOllama || rawId.includes('gemma') || rawId.includes('ollama')) {
        logger.log('ADAPTER', `Routing chat request to OllamaBackendAdapter (model="${resolvedName}")`);
        return this.ollamaAdapter;
      }
    }

    // 3. Fallback to llama-server
    logger.log('ADAPTER', `Routing chat request to LlamaServerAdapter (model="${modelId}")`);
    return this.llamaAdapter;
  }
}
