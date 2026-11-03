export interface ChatMessagePayload {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatContextUsage {
  historyTokens: number;
  draftTokens: number;
  reservedOutputTokens: number;
  totalTokens: number;
  usableInputLimit: number;
  contextSize: number;
  maxTurnTokens: number;
  usageRatio: number;
  usagePercent: number;
  remainingTokens: number;
  isNearLimit: boolean;
  isChatLimitReached: boolean;
  isDraftOverTurnLimit: boolean;
}

/**
 * Rough token estimate per spec section 7.6: characters / 4
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Computes exact token and context window usage for an isolated chat instance.
 */
export function computeChatContextUsage<T extends ChatMessagePayload>(
  messages: T[],
  draftText = '',
  contextSize = 16384,
  maxTokens = 4096
): ChatContextUsage {
  const systemOverhead = 96;
  const reservedOutputTokens = Math.min(maxTokens, Math.floor(contextSize * 0.25));
  const usableInputLimit = Math.max(512, contextSize - reservedOutputTokens - systemOverhead);

  let historyTokens = 0;
  for (const msg of messages) {
    historyTokens += estimateTokens(msg.content) + 4;
  }

  const draftTokens = draftText.trim() ? estimateTokens(draftText.trim()) + 4 : 0;
  const totalTokens = historyTokens + draftTokens;
  const remainingTokens = Math.max(0, usableInputLimit - totalTokens);
  const usageRatio = usableInputLimit > 0 ? Math.min(1, totalTokens / usableInputLimit) : 1;
  const usagePercent = Math.min(100, Math.round(usageRatio * 100));

  // History alone has exhausted the chat instance's context window (less than 64 tokens left for a prompt)
  // or history + current draft exceeds the usable context window
  const isChatLimitReached =
    historyTokens >= usableInputLimit - 64 ||
    (messages.length > 0 && totalTokens > usableInputLimit);

  // Single message draft exceeds max turn size
  const isDraftOverTurnLimit = draftTokens > maxTokens;

  // Show minimal warning bar when >= 80% of context window is used or when limit is reached
  const isNearLimit = usageRatio >= 0.8 || isChatLimitReached || isDraftOverTurnLimit;

  return {
    historyTokens,
    draftTokens,
    reservedOutputTokens,
    totalTokens,
    usableInputLimit,
    contextSize,
    maxTurnTokens: maxTokens,
    usageRatio,
    usagePercent,
    remainingTokens,
    isNearLimit,
    isChatLimitReached,
    isDraftOverTurnLimit,
  };
}

/**
 * Trims conversation history to fit within (contextSize - reservedOutput - 96) tokens.
 * Always keeps at least the newest (latest user) message.
 */
export function trimMessagesForContext<T extends ChatMessagePayload>(
  messages: T[],
  contextSize = 16384,
  maxTokens = 4096
): ChatMessagePayload[] {
  if (messages.length === 0) return [];

  const reservedOutput = Math.min(maxTokens, Math.floor(contextSize * 0.25));
  const budget = Math.max(512, contextSize - reservedOutput - 96);
  const selected: ChatMessagePayload[] = [];
  let usedTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content) + 4;

    if (selected.length === 0) {
      // Always keep at least the latest message
      selected.unshift({ role: msg.role, content: msg.content });
      usedTokens += msgTokens;
      continue;
    }

    if (usedTokens + msgTokens > budget) {
      break;
    }

    selected.unshift({ role: msg.role, content: msg.content });
    usedTokens += msgTokens;
  }

  return selected;
}

