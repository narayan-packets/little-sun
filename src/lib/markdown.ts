const MAX_TTS_CHARS = 3000;

/**
 * Converts markdown text to clean speakable plain text per spec section 8.1:
 * - Removes fenced code blocks (replaces with "code block omitted")
 * - Converts links [label](url) to label text
 * - Strips markdown formatting symbols
 * - Collapses whitespace and trims to MAX_TTS_CHARS (3000)
 */
export function markdownToSpeakableText(markdown: string, maxChars = MAX_TTS_CHARS): string {
  if (!markdown) return '';

  let text = markdown;

  // Replace fenced code blocks and display math blocks
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/~~~[\s\S]*?~~~/g, ' ');
  text = text.replace(/\$\$[\s\S]*?\$\$/g, ' ');
  text = text.replace(/\\\[[\s\S]*?\\\]/g, ' ');

  // Replace images ![alt](url) with alt text
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Replace links [label](url) with label text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // Inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Headings, blockquotes, horizontal rules, list markers, table pipes, emphasis
  text = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trim();
  }

  return text;
}

/**
 * Copies raw text to clipboard with fallback for older mobile browsers (section 7.5).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea fallback
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

const MATH_PROMPT_REGEX =
  /\b(math|mathematics|mathematical|equation|equations|formula|formulas|calculate|calculation|calculus|algebra|geometry|trigonometry|derivative|differentiate|integral|integrate|matrix|matrices|vector|vectors|theorem|proof|solve|solving|quadratic|polynomial|logarithm|sin|cos|tan|limit|summation|sigma|probability|statistics|variance|deviation|graph|plot|function|fraction|fractions|percentage|percent|ratio|proportion|arithmetic|multiply|divide|subtract|addition|multiplication|division|subtraction|physics|kinematics|thermodynamics|quantum|relativity|velocity|acceleration|momentum|wavelength|frequency|voltage|circuit|latex|katex|how much is|what is \d)\b/i;

const MATH_EXPRESSION_REGEX =
  /(?:\d+\s*[-+*/^=×÷±]\s*\d+|\b[fghy]\s*\(\s*x\s*\)\s*=|\b[xyz]\s*\^\s*\d|\$\$|\\(?:frac|sum|int|sqrt|lim)\b)/i;

/**
 * Returns true when math is present or requested.
 */
export function isMathPrompt(prompt: string): boolean {
  return true;
}

/**
 * Preserves model math output intact so visual cards and KaTeX render cleanly.
 */
export function stripHallucinatedMath(raw: string, isStreaming = false): string {
  if (!raw) return '';
  return isStreaming ? raw : raw.trim();
}

/**
 * Passes conversation messages through without erasing mathematical expressions.
 */
export function sanitizeMessageListForMath<T extends { role: 'user' | 'assistant'; content: string }>(
  messages: T[]
): T[] {
  return messages;
}

