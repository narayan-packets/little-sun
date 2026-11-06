import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  FileText,
  Quote,
  Table as TableIcon,
  Terminal,
  WrapText,
} from 'lucide-react';
import { copyTextToClipboard } from '../lib/markdown';
import { InlineMathSpan, MathVisualCard } from './MathVisualizer';
import {
  AudioCard,
  downloadTextAsFile,
  FileDownloadCard,
  ImageCard,
  normalizeDownloadFilename,
  SubtitleCard,
  SvgCard,
  VideoCard,
} from './MediaViewer';
import { WebSearchSources, type WebSourceItem } from './WebSearchSources';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

const MATH_LANGS = new Set([
  'math',
  'latex',
  'tex',
  'katex',
  'equation',
  'formula',
  'plot',
  'graph',
  'function',
  'calc',
]);

function looksLikeMathBlock(code: string): boolean {
  const t = code.trim();
  if (!t || t.length < 2) return false;
  if (
    /\\(?:frac|sqrt|sum|int|prod|lim|alpha|beta|gamma|theta|pi|sin|cos|tan|cdot|times|div|pm|leq|geq|neq|approx|infty|begin\{(?!tabular))/i.test(
      t
    )
  ) {
    return true;
  }
  if (
    /^(?:[fghy]\s*\(\s*x\s*\)|y)\s*=\s*[-+0-9xX^*/().\s\\a-zA-Z]+$/m.test(t) &&
    !t.includes('const ') &&
    !t.includes('def ') &&
    !t.includes('return ') &&
    !t.includes(';')
  ) {
    return true;
  }
  // Standalone polynomial / algebraic equation:
  if (/^[-+0-9xX^*/().\s\\a-zA-Z×÷±_]+\s*=\s*[-+0-9xX^*/().\s\\a-zA-Z×÷±_]+$/m.test(t)) {
    if (
      /[xX\^]/.test(t) &&
      !t.includes('const ') &&
      !t.includes('let ') &&
      !t.includes('var ') &&
      !t.includes(';') &&
      !t.includes('"') &&
      !t.includes("'")
    ) {
      return true;
    }
  }
  // Arithmetic calculation: e.g. 19 * 99 = 1881, 19 * 99
  if (/^\s*\d+(?:\.\d+)?\s*[-+*/×÷]\s*\d+(?:\.\d+)?(?:\s*[-+*/×÷=]\s*\d+(?:\.\d+)?)*\s*$/m.test(t)) {
    return true;
  }
  return false;
}

function looksLikeSvg(code: string): boolean {
  const t = code.trim();
  return (t.startsWith('<svg') || t.startsWith('<?xml')) && t.includes('<svg') && t.includes('</svg>');
}

const SUBTITLE_LANGS = new Set([
  'srt',
  'vtt',
  'sub',
  'subtitle',
  'subtitles',
  'subrip',
  'webvtt',
  'sbv',
  'caption',
  'captions',
]);

const DOC_FILE_LANGS = new Set([
  'doc',
  'document',
  'md',
  'markdown',
  'txt',
  'textfile',
  'rtf',
  'csv',
  'tsv',
  'jsonfile',
  'htmlfile',
]);

function parseFileDownloadCard(lang: string, code: string) {
  const normalized = (lang || '').toLowerCase().trim();
  if (
    normalized.startsWith('file:') ||
    normalized.startsWith('filename:') ||
    normalized.startsWith('file=') ||
    normalized.startsWith('filename=') ||
    normalized.startsWith('export:') ||
    normalized.startsWith('export=')
  ) {
    const rawFname = normalized.replace(/^(?:file|filename|export)[:=]/i, '').trim() || 'document.txt';
    const fname = normalizeDownloadFilename(rawFname);
    return <FileDownloadCard filename={fname} content={code} />;
  }
  if (DOC_FILE_LANGS.has(normalized)) {
    let ext = normalized === 'document' ? 'doc' : normalized;
    if (ext === 'markdown') ext = 'md';
    if (ext === 'textfile') ext = 'txt';
    if (ext === 'jsonfile') ext = 'json';
    if (ext === 'htmlfile') ext = 'html';
    return <FileDownloadCard filename={`document.${ext}`} content={code} />;
  }
  return null;
}

function looksLikeVtt(code: string): boolean {
  const t = code.trim();
  return /^WEBVTT\b/i.test(t) || /^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/m.test(t);
}

function looksLikeSubtitle(code: string): boolean {
  const t = code.trim();
  if (!t || t.length < 8) return false;

  // Standard cue arrow format (e.g. 00:00:01,000 --> 00:00:04,000 or 00:01 -> 00:05 or 00:01 - 00:05)
  if (
    /\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?\s*(?:-->|->|–|-)\s*\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?/m.test(
      t
    )
  ) {
    return true;
  }

  // WEBVTT header
  if (/^WEBVTT\b/i.test(t)) {
    return true;
  }

  // Line-by-line timestamped subtitles (e.g. 00:00.000 English Welcome to the movie "Big Buck Bunny"!)
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;

  let timestampedLines = 0;
  const lineTimeRegex = /^(?:\[|\()?(\d{1,2}:\d{2}(?::\d{2})?(?:[,\.]\d{1,3})?)(?:\]|\))?\s+(.*)$/;

  for (const line of lines) {
    const match = lineTimeRegex.exec(line);
    if (match) {
      const remainder = match[2].trim();
      // Ensure not server logs like "12:00:01 INFO ..."
      if (!/^(?:INFO|WARN|ERROR|DEBUG|TRACE|FATAL)\b/i.test(remainder)) {
        timestampedLines++;
      }
    }
  }

  return timestampedLines >= 2 && timestampedLines / lines.length >= 0.35;
}

function isStandaloneMathLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length < 2) return false;

  // Ignore markdown headings, blockquotes, list markers, code keywords, links, and lines that already contain inline math or code
  if (/^(?:#{1,6}\s|>|[-*+]\s|\d+\.\s|const\s|let\s|var\s|function\s|return\s|import\s|export\s|\/\/|\/\*)/.test(t)) {
    return false;
  }
  if (t.includes(';') || t.includes('http:') || t.includes('https:') || t.includes('`') || t.includes('math-inline:')) {
    return false;
  }

  // Reject sentences that contain common conversational / explanatory English prose words
  if (/\b(?:the|is|are|was|were|of|to|and|in|for|we|can|find|calculate|use|let|step|determine|solve|formula|equation|discriminant|root|roots|value|values|symbol|process|explanation|goal|now|then|first|second|two|both|positive|negative|standard|form)\b/i.test(t)) {
    return false;
  }

  // Reject lines containing more than 2 regular English words
  const words = (t.match(/\b[a-zA-Z]{3,}\b/g) || []).filter(
    (w) => !/^(?:sin|cos|tan|cot|sec|csc|log|ln|lim|det|dim|ker|max|min|sup|inf|arg|deg|gcd|mod|exp)$/i.test(w)
  );
  if (words.length > 2) {
    return false;
  }

  // LaTeX commands
  if (
    /\\(?:frac|sqrt|sum|int|prod|lim|alpha|beta|gamma|theta|pi|cdot|times|div|pm|leq|geq|neq|approx|infty|sin|cos|tan)(?![a-zA-Z])/i.test(
      t
    )
  ) {
    return true;
  }

  // Braces are only allowed if LaTeX, powers, or subscripts
  if (t.includes('{') || t.includes('}')) {
    if (!/\\|\^|_/.test(t)) return false;
  }

  // Arithmetic equation or expression: e.g. 19 * 99 = 1881, 19 * 99, 125 / 5 = 25
  if (/^\s*\d+(?:\.\d+)?\s*[-+*/×÷]\s*\d+(?:\.\d+)?(?:\s*[-+*/×÷=]\s*\d+(?:\.\d+)?)*\s*$/.test(t)) {
    return true;
  }

  // Function or polynomial equation: e.g. x^2 + 2x + 1 = 0, f(x) = x^2 - 4, y = 2x + 3, 2x^2 + 3x - 5 = 0, x + 1 = 0, x = -1
  if (t.includes('=')) {
    const parts = t.split('=');
    if (parts.length === 2) {
      const lhs = parts[0].trim();
      const rhs = parts[1].trim();
      const hasMathVar =
        /(?<![a-zA-Z])[a-zA-Z](?![a-zA-Z])/.test(lhs) ||
        /(?<![a-zA-Z])[a-zA-Z](?![a-zA-Z])/.test(rhs);
      const isSimpleMathChars =
        /^[-+0-9a-zA-Z^*/().\s\\×÷±_{}]+$/.test(lhs) &&
        /^[-+0-9a-zA-Z^*/().\s\\×÷±_{}]+$/.test(rhs);
      if (hasMathVar && isSimpleMathChars) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalizes display math ($$ ... $$, \[ ... \], \begin{...} ... \end{...}) into fenced ```math blocks
 * and inline math ($ ... $, \( ... \)) into `math-inline:...` code spans
 * while leaving regular fenced code blocks untouched.
 */
function preprocessMathMarkdown(raw: string): string {
  if (!raw) return raw;

  let text = raw;

  // Convert HTML underline and ins tags into markdown underline anchors
  text = text.replace(/<(?:u|ins)>([\s\S]*?)<\/(?:u|ins)>/gi, (_, inner) => `[${inner}](#underline)`);

  // 1. Convert LaTeX display environments into fenced math blocks
  text = text.replace(
    /\\begin\{(?:equation|align|aligned|gather|matrix|pmatrix|bmatrix)\*?\}[\s\S]*?\\end\{(?:equation|align|aligned|gather|matrix|pmatrix|bmatrix)\*?\}/g,
    (match) => `\n\n\`\`\`math\n${match.trim()}\n\`\`\`\n\n`
  );

  // 2. Convert \[ ... \] display math into fenced math blocks
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
    return `\n\n\`\`\`math\n${inner.trim()}\n\`\`\`\n\n`;
  });

  // 3. Convert $$ ... $$ display math into fenced math blocks
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
    return `\n\n\`\`\`math\n${inner.trim()}\n\`\`\`\n\n`;
  });

  // 4. Convert \( ... \) inline math into `math-inline:...`
  text = text.replace(/\\\(([^\n]+?)\\\)/g, (_, inner) => {
    return `\`math-inline:${inner.trim()}\``;
  });

  // 5. Convert $ ... $ inline math (avoiding currency like $10 or $50)
  text = text.replace(
    /(?<![\\$\d])\$(?!\s)((?:\\.|[^$\n])+?)(?<!\s)\$(?!\d)/g,
    (match, inner) => {
      const trimmed = inner.trim();
      if (/^\d+(?:[.,]\d+)?\s/.test(trimmed)) return match;
      return `\`math-inline:${trimmed}\``;
    }
  );

  // 6. Split by all fenced code blocks (both existing ones and the newly converted math blocks)
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts
    .map((segment, index) => {
      // Odd indices are fenced code blocks — leave completely untouched!
      if (index % 2 === 1) return segment;

      const lines = segment.split('\n');
      const processedLines = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (isStandaloneMathLine(trimmed)) {
          return `\n\`\`\`math\n${trimmed}\n\`\`\`\n`;
        }

        let inlineProcessed = line;
        inlineProcessed = inlineProcessed.replace(
          /(?<![`\\a-zA-Z0-9])([a-zA-Z]\s*[-+]\s*\d+\s*=\s*[-+]?\d+)(?![`a-zA-Z0-9])/g,
          '`math-inline:$1`'
        );
        inlineProcessed = inlineProcessed.replace(
          /(?<![`\\a-zA-Z0-9])([a-zA-Z]\s*=\s*[-+]?\d+(?:\.\d+)?)(?![`a-zA-Z0-9])/g,
          '`math-inline:$1`'
        );
        return inlineProcessed;
      });

      return processedLines.join('\n');
    })
    .join('');
}

/**
 * Repairs unclosed code fences, unwraps conversational sentences accidentally
 * enclosed in backticks, and separates conversational postscripts that got trapped
 * inside an unclosed code block.
 */
function repairUnclosedFences(raw: string, isStreaming?: boolean): string {
  if (!raw) return raw;

  // 1. Unwrap conversational sentences accidentally trapped inside triple backticks:
  // e.g. ```\nIf you need help with something else, feel free to ask!\n```
  let text = raw.replace(
    /```(?:[a-zA-Z0-9_-]+)?\s*\n\s*((?:If you (?:need|have|would|want)|Feel free to|Let me know|Hope this helps|Please note|I hope|Thank you)[^\n`]+)\s*\n```/gi,
    '\n\n$1\n\n'
  );

  // 2. Count triple backtick fences
  const fenceMatches = text.match(/```/g);
  const fenceCount = fenceMatches ? fenceMatches.length : 0;

  // If fence count is odd, there is an unclosed code block!
  if (fenceCount % 2 === 1) {
    const lastFenceIdx = text.lastIndexOf('```');
    const afterFence = text.slice(lastFenceIdx + 3);

    // Look for conversational postscripts after double newline inside the unclosed block:
    // e.g. \n\nIf you need help with something else, feel free to ask!
    // or \n\nPlease note that the content provided is from the movie...
    const postscriptRegex = /\n\s*\n\s*(\b(?:If you (?:need|have|would|want)|Feel free to|Let me know|Hope this helps|Please note|Note:|I hope|Don't hesitate|You can also)[^\n]*[\s\S]*)$/i;
    const postscriptMatch = postscriptRegex.exec(afterFence);

    if (postscriptMatch) {
      const splitPos = lastFenceIdx + 3 + postscriptMatch.index;
      text = text.slice(0, splitPos) + '\n```\n\n' + postscriptMatch[1].trim();
    } else if (!isStreaming) {
      // If not streaming and generation has ended, automatically close the unclosed code block
      text = text.trimEnd() + '\n```\n';
    }
  }

  return text;
}

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  py: 'Python',
  python: 'Python',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  shell: 'Shell',
  cmd: 'Command Prompt',
  bat: 'Batch',
  batch: 'Batch',
  ps1: 'PowerShell',
  powershell: 'PowerShell',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  html: 'HTML',
  xml: 'XML',
  svg: 'SVG',
  css: 'CSS',
  scss: 'SCSS',
  sql: 'SQL',
  md: 'Markdown',
  markdown: 'Markdown',
  txt: 'Text',
  text: 'Text',
  plaintext: 'Plain Text',
  c: 'C',
  cpp: 'C++',
  cs: 'C#',
  csharp: 'C#',
  java: 'Java',
  go: 'Go',
  golang: 'Go',
  rs: 'Rust',
  rust: 'Rust',
  php: 'PHP',
  rb: 'Ruby',
  ruby: 'Ruby',
  swift: 'Swift',
  kt: 'Kotlin',
  kotlin: 'Kotlin',
  dockerfile: 'Dockerfile',
  env: 'Environment',
  ini: 'Config',
};

const SHELL_LANGS = new Set([
  'sh',
  'bash',
  'zsh',
  'shell',
  'cmd',
  'bat',
  'batch',
  'ps1',
  'powershell',
  'console',
  'terminal',
]);

const TEXT_LANGS = new Set(['txt', 'text', 'plaintext', 'md', 'markdown', 'quote', 'prompt']);

const CODE_KEYWORDS = new Set([
  'const',
  'let',
  'var',
  'function',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'default',
  'import',
  'from',
  'export',
  'async',
  'await',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'class',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'public',
  'private',
  'protected',
  'static',
  'readonly',
  'def',
  'elif',
  'except',
  'lambda',
  'with',
  'as',
  'pass',
  'yield',
  'in',
  'is',
  'not',
  'and',
  'or',
  'True',
  'False',
  'None',
  'true',
  'false',
  'null',
  'undefined',
  'void',
  'int',
  'float',
  'double',
  'char',
  'bool',
  'boolean',
  'string',
  'struct',
  'fn',
  'mut',
  'pub',
  'use',
  'mod',
  'match',
  ' impl',
  'where',
  'package',
  'func',
  'defer',
  'go',
  'select',
  'SELECT',
  'FROM',
  'WHERE',
  'INSERT',
  'INTO',
  'VALUES',
  'UPDATE',
  'SET',
  'DELETE',
  'CREATE',
  'TABLE',
  'JOIN',
  'LEFT',
  'INNER',
  'ORDER',
  'BY',
  'GROUP',
  'LIMIT',
]);

function highlightCodeLine(line: string, isPlainText: boolean): React.ReactNode {
  if (isPlainText || !line) {
    return line || '\u00A0';
  }

  const trimmed = line.trimStart();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('-- ') ||
    trimmed.startsWith('REM ') ||
    trimmed.startsWith('::')
  ) {
    return <span style={{ color: 'var(--syntax-comment)', fontStyle: 'italic' }}>{line}</span>;
  }

  // Tokenize strings, comments, numbers, function calls, and identifiers
  const tokenRegex =
    /(\/\/.*$|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*(?=\s*\()|\b[A-Za-z_]\w*\b)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];

    if (token.startsWith('//') || token.startsWith('#')) {
      nodes.push(
        <span key={match.index} style={{ color: 'var(--syntax-comment)', fontStyle: 'italic' }}>
          {token}
        </span>
      );
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith('`')) {
      nodes.push(
        <span key={match.index} style={{ color: 'var(--syntax-string)' }}>
          {token}
        </span>
      );
    } else if (/^\d/.test(token)) {
      nodes.push(
        <span key={match.index} style={{ color: 'var(--syntax-number)' }}>
          {token}
        </span>
      );
    } else if (CODE_KEYWORDS.has(token)) {
      nodes.push(
        <span key={match.index} style={{ color: 'var(--syntax-keyword)', fontWeight: 500 }}>
          {token}
        </span>
      );
    } else if (line.slice(match.index + token.length).trimStart().startsWith('(')) {
      nodes.push(
        <span key={match.index} style={{ color: 'var(--syntax-fn)' }}>
          {token}
        </span>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : line;
}

function extractNodeText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractNodeText(node.props.children);
  }
  return '';
}

interface CodeBlockProps {
  language: string;
  code: string;
  isStreaming?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code, isStreaming }) => {
  const normalizedLang = (language || '').toLowerCase().trim();
  const isTextBlock =
    TEXT_LANGS.has(normalizedLang) ||
    (!normalizedLang && !code.includes('{') && !code.includes(';') && !code.includes('def ') && !code.includes('const ') && !code.includes('import '));

  const isShellBlock = SHELL_LANGS.has(normalizedLang);

  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      return false;
    }
    return isTextBlock;
  });
  const [isCollapsed, setIsCollapsed] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);
  const lineCount = lines.length;

  // If the block contains only a conversational sign-off (e.g. "If you need help with something else, feel free to ask!"),
  // render it as regular text rather than an awkward code box
  if (
    (!normalizedLang || isTextBlock) &&
    lineCount <= 3 &&
    /^(?:If you (?:need|have|would|want)|Feel free to|Let me know|Hope this helps|Please note|I hope|Thank you|You're welcome)\b/i.test(
      code.trim()
    )
  ) {
    return <p className="my-2 text-[15px] leading-relaxed">{code.trim()}</p>;
  }

  const showLineNumbers = !isTextBlock && !isShellBlock && lineCount > 1;
  const canCollapse = !isStreaming && lineCount > 32;
  const displayedLines = canCollapse && isCollapsed ? lines.slice(0, 18) : lines;

  const displayLabel = useMemo(() => {
    if (normalizedLang && LANGUAGE_LABELS[normalizedLang]) {
      return LANGUAGE_LABELS[normalizedLang];
    }
    if (normalizedLang) {
      return normalizedLang.toUpperCase();
    }
    return isTextBlock ? 'Snippet' : 'Code';
  }, [normalizedLang, isTextBlock]);

  const HeaderIcon = isShellBlock ? Terminal : isTextBlock ? FileText : Code2;

  const defaultExtension = useMemo(() => {
    const l = normalizedLang;
    if (['python', 'py'].includes(l)) return 'py';
    if (['javascript', 'js'].includes(l)) return 'js';
    if (['typescript', 'ts'].includes(l)) return 'ts';
    if (['tsx'].includes(l)) return 'tsx';
    if (['jsx'].includes(l)) return 'jsx';
    if (['bash', 'sh', 'shell', 'zsh'].includes(l)) return 'sh';
    if (['powershell', 'ps1'].includes(l)) return 'ps1';
    if (['batch', 'bat', 'cmd'].includes(l)) return 'bat';
    if (['html', 'htm'].includes(l)) return 'html';
    if (['css', 'scss'].includes(l)) return 'css';
    if (['json'].includes(l)) return 'json';
    if (['yaml', 'yml'].includes(l)) return 'yaml';
    if (['markdown', 'md'].includes(l)) return 'md';
    if (['sql'].includes(l)) return 'sql';
    if (['csv'].includes(l)) return 'csv';
    if (['svg'].includes(l)) return 'svg';
    if (['c'].includes(l)) return 'c';
    if (['cpp', 'c++'].includes(l)) return 'cpp';
    if (['rust', 'rs'].includes(l)) return 'rs';
    if (['go', 'golang'].includes(l)) return 'go';
    if (['java'].includes(l)) return 'java';
    return isTextBlock ? 'txt' : 'txt';
  }, [normalizedLang, isTextBlock]);

  const targetFilename = useMemo(() => {
    const firstLines = lines.slice(0, 2).join('\n');
    const m = /(?:#|\/\/|<!--|\/\*|--|REM)\s*(?:filename|file)[:=]\s*([a-zA-Z0-9_\-\.\/]+)/i.exec(firstLines);
    if (m && m[1]) {
      return m[1].trim().split('/').pop() || `file.${defaultExtension}`;
    }
    const cleanLabel = (displayLabel || 'file').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleanLabel || 'snippet'}.${defaultExtension}`;
  }, [lines, defaultExtension, displayLabel]);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownload = () => {
    downloadTextAsFile(code, targetFilename);
  };

  return (
    <div
      className="my-3.5 first:mt-0 last:mb-0 w-full max-w-full min-w-0 border overflow-hidden"
      style={{
        borderColor: 'var(--border)',
        borderRadius: '12px',
        backgroundColor: 'var(--code-bg)',
      }}
    >
      {/* Top Toolbar */}
      <div
        className="px-3 py-1.5 flex items-center justify-between gap-2 border-b select-none"
        style={{
          backgroundColor: 'var(--code-header)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* macOS subtle window controls */}
          <div className="flex items-center gap-1.5 mr-1 shrink-0" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] opacity-80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] opacity-80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] opacity-80" />
          </div>
          <HeaderIcon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
          <span
            className="text-xs font-medium truncate"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}
          >
            {displayLabel}
          </span>
          {lineCount > 1 && (
            <span className="text-[11px] opacity-75 shrink-0">
              · {lineCount} {lineCount === 1 ? 'line' : 'lines'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Wrap Toggle (mobile viewports only) */}
          <button
            type="button"
            onClick={() => setWrapLines((v) => !v)}
            className="md:hidden min-h-[30px] px-2 py-1 inline-flex items-center gap-1 text-xs transition-colors cursor-pointer active:scale-95"
            style={{
              color: wrapLines ? 'var(--accent)' : 'var(--text-muted)',
              backgroundColor: wrapLines ? 'var(--surface)' : 'transparent',
              borderRadius: '6px',
            }}
            title={wrapLines ? 'Disable line wrapping' : 'Wrap long lines'}
            aria-label={wrapLines ? 'Disable line wrapping' : 'Wrap long lines'}
          >
            <WrapText className="w-3.5 h-3.5 shrink-0" />
            <span>Wrap</span>
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[30px] px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer active:scale-95"
            style={{
              color: copied ? 'var(--success)' : 'var(--text)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
            }}
            aria-label={copied ? 'Copied to clipboard' : 'Copy code'}
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--success)' }} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 shrink-0" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Download / Save File Button */}
          <button
            type="button"
            onClick={handleDownload}
            className="min-h-[30px] px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer active:scale-95"
            style={{
              color: 'var(--text)',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
            }}
            aria-label={`Save as ${targetFilename}`}
            title={`Save as ${targetFilename}`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] sm:text-xs">Save</span>
          </button>
        </div>
      </div>

      {/* Code / Text Body */}
      <div
        className={`w-full max-w-full py-3 px-3.5 ${
          wrapLines ? 'overflow-x-hidden' : 'overflow-x-auto'
        }`}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
        }}
      >
        <pre
          className={`m-0 text-[13.5px] sm:text-sm leading-[1.6] ${
            wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
          }`}
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
            tabSize: 2,
          }}
        >
          <code>
            {displayedLines.map((line, idx) => (
              <div key={idx} className="table-row">
                {showLineNumbers && (
                  <span
                    className="table-cell pr-3.5 text-right select-none opacity-45 text-[12px]"
                    style={{ color: 'var(--text-muted)', minWidth: '1.75rem' }}
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </span>
                )}
                <span className="table-cell">
                  {highlightCodeLine(line, isTextBlock)}
                  {idx < displayedLines.length - 1 ? '\n' : ''}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      {/* Expand / Collapse Footer for long code blocks */}
      {canCollapse && (
        <button
          type="button"
          onClick={() => setIsCollapsed((v) => !v)}
          className="w-full py-1.5 px-3 border-t flex items-center justify-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--code-header)',
            borderColor: 'var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          {isCollapsed ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Show all {lineCount} lines</span>
            </>
          ) : (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Collapse code block</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

const InlineCodePill: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [copied, setCopied] = useState(false);
  const text = extractNodeText(children).trim();

  const handleCopy = async () => {
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <code
      onClick={handleCopy}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCopy();
        }
      }}
      title="Tap to copy"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.86em] transition-colors cursor-pointer break-all sm:break-normal active:scale-95"
      style={{
        fontFamily: 'var(--font-mono)',
        backgroundColor: 'var(--surface-2)',
        border: `1px solid ${copied ? 'var(--success)' : 'var(--border)'}`,
        color: copied ? 'var(--success)' : 'var(--text)',
        borderRadius: '6px',
      }}
    >
      <span>{children}</span>
      {copied && <Check className="w-3 h-3 shrink-0 inline" style={{ color: 'var(--success)' }} />}
    </code>
  );
};

const BlockquoteWithCopy: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [copied, setCopied] = useState(false);
  const rawText = useMemo(() => extractNodeText(children).trim(), [children]);

  const handleCopy = async () => {
    if (!rawText) return;
    const ok = await copyTextToClipboard(rawText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <blockquote
      className="my-3.5 first:mt-0 last:mb-0 p-3.5 border-l-4 relative group/quote"
      style={{
        backgroundColor: 'var(--surface-2)',
        borderColor: 'var(--accent)',
        borderRadius: '0 10px 10px 0',
        color: 'var(--text)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" style={{ color: 'var(--accent)' }} />
        {rawText.length > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[26px] px-2 py-0.5 inline-flex items-center gap-1 text-[11px] font-medium transition-opacity cursor-pointer shrink-0 active:scale-95"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: copied ? 'var(--success)' : 'var(--text-muted)',
              borderRadius: '6px',
            }}
            title="Copy quoted text"
            aria-label="Copy quoted text"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" style={{ color: 'var(--success)' }} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
      <div className="text-[15px] leading-relaxed [&>p:last-child]:mb-0">{children}</div>
    </blockquote>
  );
};

const TableWithCopy: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyTable = async () => {
    const el = tableRef.current;
    if (!el) return;
    const rows = Array.from(el.querySelectorAll('tr'));
    const tsv = rows
      .map((row) =>
        Array.from(row.querySelectorAll('th, td'))
          .map((cell) => (cell.textContent || '').trim())
          .join('\t')
      )
      .join('\n');
    const ok = await copyTextToClipboard(tsv);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div
      className="my-3.5 first:mt-0 last:mb-0 w-full max-w-full min-w-0 border overflow-hidden"
      style={{
        borderColor: 'var(--border)',
        borderRadius: '12px',
        backgroundColor: 'var(--surface)',
      }}
    >
      <div
        className="px-3 py-1.5 flex items-center justify-between border-b text-xs select-none"
        style={{
          backgroundColor: 'var(--code-header)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <div className="flex items-center gap-1.5">
          <TableIcon className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            Table
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyTable}
          className="min-h-[28px] px-2 py-0.5 inline-flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer active:scale-95"
          style={{
            color: copied ? 'var(--success)' : 'var(--text)',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
          }}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div
        className="w-full max-w-full overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
      >
        <table ref={tableRef} className="m-0 w-full border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isStreaming }) => {
  const { cleanContent, sources } = useMemo(() => {
    const sourcesMatch = /###\s*Sources\s*\r?\n([\s\S]*?)(?=(?:\r?\n#{1,3}\s|$))/i.exec(content);
    let stripped = content;
    const sourcesList: WebSourceItem[] = [];

    if (sourcesMatch) {
      const linkRegex = /[-*]\s*\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
      let m: RegExpExecArray | null;
      while ((m = linkRegex.exec(sourcesMatch[1])) !== null) {
        sourcesList.push({ title: m[1].trim(), url: m[2].trim() });
      }
      stripped = content.replace(sourcesMatch[0], '').trimEnd();
    }

    const repaired = repairUnclosedFences(stripped, isStreaming);
    return {
      cleanContent: preprocessMathMarkdown(repaired),
      sources: sourcesList,
    };
  }, [content, isStreaming]);

  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p({ children }) {
          return <p>{children}</p>;
        },
        li({ children }) {
          return <li>{children}</li>;
        },
        h1({ children }) {
          return <h1>{children}</h1>;
        },
        h2({ children }) {
          return <h2>{children}</h2>;
        },
        h3({ children }) {
          return <h3>{children}</h3>;
        },
        h4({ children }) {
          return <h4>{children}</h4>;
        },
        pre({ children }) {
          // Extract the inner <code> element from <pre> so even 1-line unlabeled fenced blocks render as CodeBlock
          const childArray = React.Children.toArray(children);
          const firstChild = childArray[0];

          if (
            React.isValidElement<{ className?: string; children?: React.ReactNode }>(firstChild)
          ) {
            const className = firstChild.props.className || '';
            const langMatch = /language-([\w+-]+)/.exec(className);
            const language = (langMatch ? langMatch[1] : '').toLowerCase();
            const rawCode = extractNodeText(firstChild.props.children).replace(/\n$/, '');

            if (MATH_LANGS.has(language) || (!language && looksLikeMathBlock(rawCode))) {
              return <MathVisualCard code={rawCode} isStreaming={isStreaming} />;
            }

            if (language === 'svg' || looksLikeSvg(rawCode)) {
              return <SvgCard code={rawCode} />;
            }
            if (SUBTITLE_LANGS.has(language) || looksLikeSubtitle(rawCode)) {
              const isVtt = language === 'vtt' || looksLikeVtt(rawCode);
              return <SubtitleCard code={rawCode} format={isVtt ? 'vtt' : 'srt'} />;
            }
            const fileCard = parseFileDownloadCard(language, rawCode);
            if (fileCard) {
              return fileCard;
            }

            return (
              <CodeBlock
                language={language}
                code={rawCode}
                isStreaming={isStreaming}
              />
            );
          }

          const fallbackCode = extractNodeText(children).replace(/\n$/, '');
          if (looksLikeMathBlock(fallbackCode)) {
            return <MathVisualCard code={fallbackCode} isStreaming={isStreaming} />;
          }
          if (looksLikeSvg(fallbackCode)) {
            return <SvgCard code={fallbackCode} />;
          }
          if (looksLikeSubtitle(fallbackCode)) {
            return <SubtitleCard code={fallbackCode} format={looksLikeVtt(fallbackCode) ? 'vtt' : 'srt'} />;
          }
          return <CodeBlock language="" code={fallbackCode} isStreaming={isStreaming} />;
        },
        code({ className, children }) {
          // If ReactMarkdown invokes code outside of <pre>, it's an inline code span
          const textContent = extractNodeText(children);
          if (textContent.startsWith('math-inline:')) {
            return <InlineMathSpan latex={textContent.slice('math-inline:'.length)} />;
          }
          if (className || textContent.includes('\n')) {
            const langMatch = /language-([\w+-]+)/.exec(className || '');
            const language = (langMatch ? langMatch[1] : '').toLowerCase();
            const cleanCode = textContent.replace(/\n$/, '');
            if (MATH_LANGS.has(language) || (!language && looksLikeMathBlock(cleanCode))) {
              return <MathVisualCard code={cleanCode} isStreaming={isStreaming} />;
            }
            if (language === 'svg' || looksLikeSvg(cleanCode)) {
              return <SvgCard code={cleanCode} />;
            }
            if (SUBTITLE_LANGS.has(language) || looksLikeSubtitle(cleanCode)) {
              const isVtt = language === 'vtt' || looksLikeVtt(cleanCode);
              return <SubtitleCard code={cleanCode} format={isVtt ? 'vtt' : 'srt'} />;
            }
            const fileCard = parseFileDownloadCard(language, cleanCode);
            if (fileCard) {
              return fileCard;
            }
            return (
              <CodeBlock
                language={language}
                code={cleanCode}
                isStreaming={isStreaming}
              />
            );
          }
          return <InlineCodePill>{children}</InlineCodePill>;
        },
        blockquote({ children }) {
          return <BlockquoteWithCopy>{children}</BlockquoteWithCopy>;
        },
        table({ children }) {
          return <TableWithCopy>{children}</TableWithCopy>;
        },
        img({ src, alt }) {
          if (!src) return null;
          const isVideo = /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src);
          if (isVideo) {
            return <VideoCard src={src} title={alt} />;
          }
          const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?.*)?$/i.test(src);
          if (isAudio) {
            return <AudioCard src={src} title={alt || 'Audio'} />;
          }
          return <ImageCard src={src} alt={alt} />;
        },
        a({ href, children }) {
          if (!href) return <a>{children}</a>;
          if (href === '#underline') {
            return <span className="underline underline-offset-2 font-medium">{children}</span>;
          }
          const isVid = /\.(mp4|webm|mov)(\?.*)?$/i.test(href);
          const isImg = /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(href);
          const isDoc = /\.(docx?|pdf|csv|xlsx?|txt|rtf|srt|vtt|zip)(\?.*)?$/i.test(href);
          const textLabel = extractNodeText(children);
          const isAudio =
            /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?.*)?$/i.test(href) ||
            /^data:audio\//i.test(href) ||
            textLabel.toLowerCase().startsWith('audio:');

          if (isVid) {
            return <VideoCard src={href} title={textLabel || 'Video'} />;
          }
          if (isAudio) {
            const cleanTitle = textLabel.replace(/^audio:\s*/i, '').trim() || 'Audio Track';
            return <AudioCard src={href} title={cleanTitle} />;
          }
          if (isImg) {
            return <ImageCard src={href} alt={textLabel || 'Image'} />;
          }
          if (isDoc) {
            const rawFname = href.split('/').pop()?.split('?')[0] || 'document';
            return (
              <FileDownloadCard
                filename={textLabel && !textLabel.startsWith('http') ? textLabel : rawFname}
                url={href}
              />
            );
          }
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[var(--accent)] hover:opacity-80 transition-opacity break-all sm:break-normal"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {cleanContent}
    </ReactMarkdown>
    {sources.length > 0 && <WebSearchSources sources={sources} />}
  </>
  );
};

