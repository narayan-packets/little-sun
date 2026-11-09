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
 * Native tool definition for Ollama function calling.
 */
export const SEARCH_WEB_TOOL = {
  type: 'function',
  function: {
    name: 'search_web',
    description: 'Search the live web for recent news, real-time facts, current weather, scores, or events.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query keywords to find relevant information on the web',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Determines whether a message warrants live web search.
 * Filters out greetings, farewells, acknowledgments, math, and code generation.
 */
export function shouldPerformWebSearch(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  if (clean.length < 2) return false;
  const lower = clean.toLowerCase();

  // Farewells, acknowledgments, greetings
  if (/^(?:bye|goodbye|cya|see you|good night|gn|catch you later|take care)[\s!.]*$/i.test(lower)) return false;
  if (/^(?:hi|hello|hey|yo|howdy|sup|greetings|good\s+(?:morning|afternoon|evening|day))[\s!.,?]*$/i.test(lower)) return false;
  if (/^(?:ok|okay|k|cool|nice|great|awesome|understood|got it|thanks|thank you|thx|cheers|sure|yes|no|yep|nope)[\s!.]*$/i.test(lower)) return false;
  if (/^(?:who are you|what are you|what is your name|how are you|how are you doing|how's it going|what can you do)[\s!.,?]*$/i.test(lower)) return false;

  // Code / syntax requests (local model handles)
  if (/^(?:write|create|implement|give me|generate|code|show me)\s+(?:a\s+)?(?:python|javascript|typescript|c\+\+|rust|java|html|css|sql|function|script|code|component|regex|class|algorithm)/i.test(lower)) {
    return false;
  }

  // Math expressions
  if (/^[0-9+\-*/^().\s=%]+$/.test(clean) || /^(?:calculate|compute|solve|what is)\s+[0-9+\-*/^().\s]+$/i.test(lower)) {
    return false;
  }

  // Explicit search triggers
  if (/\b(?:search|search for|google|browse|lookup|look up|check online|find out|source)\b/i.test(lower)) {
    return true;
  }

  // Real-time factual inquiry keywords
  if (/\b(?:weather|forecast|temperature|rain|snow|humidity|climate|stock|price|crypto|bitcoin|btc|eth|market|score|match|game|news|latest|recent|current|today|tomorrow|yesterday|election|release date|version|specs|who won|who is)\b/i.test(lower)) {
    return true;
  }

  // Questions seeking factual information with question mark
  if (/^(?:what|when|where|who|why|how much|how many|is it|did|does|can you find)\b/i.test(lower) && clean.includes('?')) {
    return true;
  }

  const words = clean.split(/\s+/).length;
  if (words <= 4) return false;

  return true;
}

/**
 * Strips conversational fluff, preambles, and postambles to produce crisp search keywords.
 */
export function formulateCleanSearchKeywords(text) {
  if (!text || typeof text !== 'string') return '';
  let q = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .split('\n')[0]
    .trim();

  // Strip conversational preambles
  const preambles = [
    /^(?:can you|could you|please|kindly)\s+(?:tell me|find|search|lookup|look up|check|browse)\s+(?:about|for|if)?/i,
    /^(?:tell me|search for|search|lookup|look up|browse for|check out|find out|find)\s+(?:about|for|if)?/i,
    /^(?:i want to know|i would like to know|i need to know|do you know|can you find)\s+(?:if|about|what|when|where|who)?/i,
    /^(?:what is|what are|what was|what were|who is|who was|who are|where is|when is|how is)\s+/i,
    /^(?:what's|who's|where's|when's|how's)\s+/i,
    /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening)|umm+|uh+)\s*[,.!?:]*\s*/i,
  ];

  let prev = '';
  while (prev !== q) {
    prev = q;
    for (const p of preambles) {
      q = q.replace(p, '').trim();
    }
  }

  // Strip trailing formatting directives
  const postambles = [
    /\s+(?:in a table|as a table|in table format|in bullet points|step by step|in detail|briefly|in 2 sentences|in one sentence|please|thanks|thank you)\s*$/i,
    /\s+(?:answer in short|give me a summary|give me a list|summarize this)\s*$/i,
  ];
  for (const p of postambles) {
    q = q.replace(p, '').trim();
  }

  q = q.replace(/[?!:;"]+/g, ' ').replace(/\s+/g, ' ').trim();
  return q.slice(0, 100);
}

/**
 * Real-time streaming filter that separates <think>...</think>, <thought>...</thought>,
 * and <reasoning>...</reasoning> blocks from normal response tokens across SSE chunk boundaries.
 */
export class ThinkTagStreamFilter {
  constructor({ onToken, onThinking, thinkingEnabled = true }) {
    this.onToken = onToken;
    this.onThinking = onThinking;
    this.thinkingEnabled = thinkingEnabled;
    this.isInsideThink = false;
    this.tagBuffer = '';
  }

  feedContent(chunk) {
    if (!chunk || typeof chunk !== 'string') return;
    let str = this.tagBuffer + chunk;
    this.tagBuffer = '';

    while (str.length > 0) {
      if (!this.isInsideThink) {
        const openIdx = str.search(/<(?:think|thought|reasoning)>/i);
        if (openIdx === -1) {
          const partialMatch = str.match(/<[a-z]{0,8}$/i);
          if (partialMatch) {
            const emitText = str.slice(0, partialMatch.index);
            if (emitText && typeof this.onToken === 'function') {
              this.onToken(emitText);
            }
            this.tagBuffer = partialMatch[0];
            return;
          } else {
            if (typeof this.onToken === 'function') {
              this.onToken(str);
            }
            return;
          }
        } else {
          const before = str.slice(0, openIdx);
          if (before && typeof this.onToken === 'function') {
            this.onToken(before);
          }
          const tagMatch = str.slice(openIdx).match(/^<(?:think|thought|reasoning)>/i);
          const tagLen = tagMatch ? tagMatch[0].length : 7;
          this.isInsideThink = true;
          str = str.slice(openIdx + tagLen);
        }
      } else {
        const closeIdx = str.search(/<\/(?:think|thought|reasoning)>/i);
        if (closeIdx === -1) {
          const partialMatch = str.match(/<\/[a-z]{0,9}$/i);
          if (partialMatch) {
            const thinkText = str.slice(0, partialMatch.index);
            if (thinkText && this.thinkingEnabled && typeof this.onThinking === 'function') {
              this.onThinking(thinkText);
            }
            this.tagBuffer = partialMatch[0];
            return;
          } else {
            if (this.thinkingEnabled && typeof this.onThinking === 'function') {
              this.onThinking(str);
            }
            return;
          }
        } else {
          const thinkText = str.slice(0, closeIdx);
          if (thinkText && this.thinkingEnabled && typeof this.onThinking === 'function') {
            this.onThinking(thinkText);
          }
          const tagMatch = str.slice(closeIdx).match(/^<\/(?:think|thought|reasoning)>/i);
          const tagLen = tagMatch ? tagMatch[0].length : 8;
          this.isInsideThink = false;
          str = str.slice(closeIdx + tagLen);
        }
      }
    }
  }

  flush() {
    if (this.tagBuffer) {
      if (this.isInsideThink) {
        if (this.thinkingEnabled && typeof this.onThinking === 'function') {
          this.onThinking(this.tagBuffer);
        }
      } else {
        if (typeof this.onToken === 'function') {
          this.onToken(this.tagBuffer);
        }
      }
      this.tagBuffer = '';
    }
  }
}

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
 * Supports both Native Tool Calling (search_web) and Fallback Search Injection.
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
    webSearch = false,
    supportsTools = false,
    searchFn = null,
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

    // 3. Web Search Strategy Determination
    const useTools = Boolean(webSearch && supportsTools && typeof searchFn === 'function');
    const useFallbackSearch = Boolean(webSearch && !useTools && typeof searchFn === 'function');
    const distinctRetrievedSources = [];

    // Fallback Path: For models where supportsTools === false (e.g. Sun Light / Llama 3.2 1B)
    if (useFallbackSearch && shouldPerformWebSearch(userText)) {
      const searchKeywords = formulateCleanSearchKeywords(userText);
      if (searchKeywords && searchKeywords.length >= 2) {
        try {
          logger.log('NET', `Fallback search for model "${targetModel}": "${searchKeywords}"`);
          const searchResults = await searchFn(searchKeywords, 6);
          if (Array.isArray(searchResults) && searchResults.length > 0) {
            const seen = new Set();
            for (const r of searchResults) {
              if (r.url && !seen.has(r.url)) {
                seen.add(r.url);
                distinctRetrievedSources.push({ title: r.title || r.url, url: r.url });
              }
            }
            const injectedBlock = `\n\n[Live Web Search Results for "${searchKeywords}"]:\n` +
              searchResults.map((r, i) => `${i + 1}. Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.url}`).join('\n\n') +
              `\n\nAnswer the user factually based on these real-time web search results.`;

            const sysMsg = ollamaMessages.find((m) => m.role === 'system');
            if (sysMsg) {
              sysMsg.content += injectedBlock;
            } else {
              ollamaMessages.unshift({ role: 'system', content: injectedBlock.trim() });
            }
          }
        } catch (searchErr) {
          logger.log('WARN', `Fallback search error: ${searchErr.message}`);
        }
      }
    }

    const payload = {
      model: targetModel,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: Number(temperature) || 0.7,
      },
    };

    if (useTools) {
      payload.tools = [SEARCH_WEB_TOOL];
    }

    logger.log(
      'OLLAMA',
      `Forwarding to Ollama /api/chat (model=${targetModel}, messages=${ollamaMessages.length}, images=${imagesArray.length}, tools=${useTools})`
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

    // 4. Read streaming NDJSON response from Ollama
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;
    let streamedTokens = '';
    const accumulatedToolCalls = [];

    const thinkFilter = new ThinkTagStreamFilter({
      onToken: (tok) => {
        tokenCount += 1;
        streamedTokens += tok;
        if (typeof onToken === 'function') onToken(tok);
      },
      onThinking: (th) => {
        if (thinking !== false && typeof onThinking === 'function') {
          onThinking(th);
        }
      },
      thinkingEnabled: thinking !== false,
    });

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

            // Collect native tool calls if emitted
            if (chunk.message?.tool_calls && Array.isArray(chunk.message.tool_calls)) {
              accumulatedToolCalls.push(...chunk.message.tool_calls);
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
              thinkFilter.feedContent(token);
            }
          } catch {
            // ignore malformed NDJSON line
          }
        }
      }
    } finally {
      try { await reader.cancel(); } catch {}
      reader.releaseLock();
    }

    try {
      // 5. If Native Tool Call was triggered, execute tool and initiate follow-up pass
      if (accumulatedToolCalls.length > 0 && typeof searchFn === 'function') {
        ollamaMessages.push({
          role: 'assistant',
          content: '',
          tool_calls: accumulatedToolCalls,
        });

        for (const call of accumulatedToolCalls) {
          if (call.function?.name === 'search_web') {
            let callQuery = '';
            try {
              const args = typeof call.function.arguments === 'string'
                ? JSON.parse(call.function.arguments)
                : call.function.arguments;
              callQuery = args?.query || '';
            } catch {
              callQuery = String(call.function.arguments || '');
            }

            if (callQuery) {
              logger.log('TOOL', `Executing native tool search_web: "${callQuery}"`);
              let searchResults = [];
              try {
                searchResults = await searchFn(callQuery, 6);
                logger.log('TOOL', `search_web returned ${searchResults.length} result(s) for "${callQuery}"`);
                const seen = new Set();
                for (const r of searchResults) {
                  if (r.url && !seen.has(r.url)) {
                    seen.add(r.url);
                    distinctRetrievedSources.push({ title: r.title || r.url, url: r.url });
                  }
                }
              } catch (toolErr) {
                logger.log('WARN', `Tool search_web failed: ${toolErr.message}`);
              }

              ollamaMessages.push({
                role: 'tool',
                content: JSON.stringify({ results: searchResults }),
              });
            }
          }
        }

        // Stream follow-up pass with tool output
        const followUpPayload = {
          model: targetModel,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: Number(temperature) || 0.7,
          },
        };

        const res2 = await fetch(`${this.ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(followUpPayload),
          signal,
        });

        if (res2.ok && res2.body) {
          const reader2 = res2.body.getReader();
          let buffer2 = '';
          try {
            while (true) {
              const { done, value } = await reader2.read();
              if (done) break;
              buffer2 += decoder.decode(value, { stream: true });
              const lines2 = buffer2.split('\n');
              buffer2 = lines2.pop() || '';

              for (const line of lines2) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  const chunk2 = JSON.parse(trimmed);
                  if (chunk2.message?.thinking) {
                    if (thinking !== false && typeof onThinking === 'function') {
                      onThinking(chunk2.message.thinking);
                    }
                  }
                  const tok2 = chunk2.message?.content;
                  if (typeof tok2 === 'string' && tok2.length > 0) {
                    thinkFilter.feedContent(tok2);
                  }
                } catch {
                  // ignore
                }
              }
            }
          } finally {
            try { await reader2.cancel(); } catch {}
            reader2.releaseLock();
          }
        }
      }

      thinkFilter.flush();

      // 6. Append Sources block if search was conducted and sources were found
      if (distinctRetrievedSources.length > 0 && !streamedTokens.includes('### Sources')) {
        const sourcesBlock = `\n\n### Sources\n${distinctRetrievedSources.map((s) => `- [${s.title}](${s.url})`).join('\n')}`;
        streamedTokens += sourcesBlock;
        if (typeof onToken === 'function') onToken(sourcesBlock);
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
    thinking = true,
    webSearch = false,
    supportsTools = false,
    searchFn = null,
    onToken,
    onThinking,
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

    // Web search injection for LlamaServer if enabled
    const distinctRetrievedSources = [];
    const lastUserMsg = chatMessages[chatMessages.length - 1];
    if (webSearch && typeof searchFn === 'function' && lastUserMsg && shouldPerformWebSearch(lastUserMsg.content)) {
      const searchKeywords = formulateCleanSearchKeywords(lastUserMsg.content);
      if (searchKeywords && searchKeywords.length >= 2) {
        try {
          logger.log('NET', `LlamaServer web search: "${searchKeywords}"`);
          const searchResults = await searchFn(searchKeywords, 6);
          if (Array.isArray(searchResults) && searchResults.length > 0) {
            const seen = new Set();
            for (const r of searchResults) {
              if (r.url && !seen.has(r.url)) {
                seen.add(r.url);
                distinctRetrievedSources.push({ title: r.title || r.url, url: r.url });
              }
            }
            const injectedBlock = `\n\n[Live Web Search Results for "${searchKeywords}"]:\n` +
              searchResults.map((r, i) => `${i + 1}. Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.url}`).join('\n\n') +
              `\n\nAnswer the user factually based on these real-time web search results.`;
            dynamicSystemPrompt = (dynamicSystemPrompt || modelCfg.systemPrompt || '') + injectedBlock;
          }
        } catch (searchErr) {
          logger.log('WARN', `LlamaServer search error: ${searchErr.message}`);
        }
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
    let streamedTokens = '';

    const thinkFilter = new ThinkTagStreamFilter({
      onToken: (tok) => {
        tokenCount += 1;
        streamedTokens += tok;
        if (typeof onToken === 'function') onToken(tok);
      },
      onThinking: (th) => {
        if (thinking !== false && typeof onThinking === 'function') {
          onThinking(th);
        }
      },
      thinkingEnabled: thinking !== false,
    });

    let processingFinished = false;
    const safeFinish = () => {
      if (!processingFinished) {
        processingFinished = true;
        this.llama.finishProcessing();
      }
    };

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
            const delta = parsed.choices?.[0]?.delta;

            // 1. Direct reasoning_content (emitted by llama-server for reasoning models like DeepSeek/Qwen)
            const reasoningDelta = delta?.reasoning_content;
            if (typeof reasoningDelta === 'string' && reasoningDelta.length > 0) {
              if (thinking !== false && typeof onThinking === 'function') {
                onThinking(reasoningDelta);
              }
            }

            // 2. Content delta (which may also contain <think>...</think> tags)
            const contentDelta = delta?.content;
            if (typeof contentDelta === 'string' && contentDelta.length > 0) {
              thinkFilter.feedContent(contentDelta);
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }

      thinkFilter.flush();

      if (distinctRetrievedSources.length > 0 && !streamedTokens.includes('### Sources')) {
        const sourcesBlock = `\n\n### Sources\n${distinctRetrievedSources.map((s) => `- [${s.title}](${s.url})`).join('\n')}`;
        if (typeof onToken === 'function') onToken(sourcesBlock);
      }

      safeFinish();
      if (typeof onDone === 'function') onDone(tokenCount);
    } catch (err) {
      safeFinish();
      if (signal?.aborted) return;
      if (typeof onError === 'function') onError(err.message);
    } finally {
      safeFinish();
      try { await reader.cancel(); } catch {}
      reader.releaseLock();
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
