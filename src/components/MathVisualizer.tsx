import React, { useMemo, useRef, useState } from 'react';
import katex from 'katex';
import {
  Calculator,
  Check,
  Copy,
  LineChart,
  Maximize2,
  Minimize2,
  Sigma,
} from 'lucide-react';
import { copyTextToClipboard } from '../lib/markdown';

export interface QuadraticAnalysis {
  a: number;
  b: number;
  c: number;
  disc: number;
  vertexX: number;
  vertexY: number;
  roots: number[];
  yIntercept: number;
  axisOfSymmetry: number;
}

export interface LinearAnalysis {
  m: number;
  b: number;
  rootX: number;
  yIntercept: number;
}

export interface PlotKeyPoint {
  label: string;
  x: number;
  y: number;
  color?: string;
}

export function parseQuadraticAnalysis(raw: string): QuadraticAnalysis | null {
  let s = raw.trim()
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/^\$\$|\$\$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\{(\d+)\}/g, '$1')
    .replace(/\s+/g, '')
    .replace(/^y=|^f\(x\)=|^g\(x\)=/, '');

  if (s.includes('=')) {
    const parts = s.split('=');
    if (parts[1] === '0') {
      s = parts[0];
    } else {
      s = `${parts[0]}-(${parts[1]})`;
    }
  }

  s = s.replace(/--/g, '+').replace(/\+-|-\+/g, '-');
  
  const quadMatch = /([+-]?\d*(?:\.\d+)?)x\^2/.exec(s);
  if (!quadMatch) return null;

  let a = 1;
  if (quadMatch[1] === '' || quadMatch[1] === '+') a = 1;
  else if (quadMatch[1] === '-') a = -1;
  else a = parseFloat(quadMatch[1]);

  const remainder = s.replace(quadMatch[0], '');
  const linearMatch = /([+-]?\d*(?:\.\d+)?)x(?!\^)/.exec(remainder);

  let b = 0;
  if (linearMatch) {
    if (linearMatch[1] === '' || linearMatch[1] === '+') b = 1;
    else if (linearMatch[1] === '-') b = -1;
    else b = parseFloat(linearMatch[1]);
  }

  const afterLinear = linearMatch ? remainder.replace(linearMatch[0], '') : remainder;
  const constMatch = /([+-]?\d+(?:\.\d+)?)/.exec(afterLinear);
  const c = constMatch ? parseFloat(constMatch[1]) : 0;

  if (isNaN(a) || a === 0) return null;

  const disc = b * b - 4 * a * c;
  const rawVx = -b / (2 * a);
  const vertexX = Math.abs(rawVx) < 1e-12 ? 0 : rawVx;
  const rawVy = a * vertexX * vertexX + b * vertexX + c;
  const vertexY = Math.abs(rawVy) < 1e-12 ? 0 : rawVy;

  let roots: number[] = [];
  if (disc > 1e-9) {
    const r1 = (-b + Math.sqrt(disc)) / (2 * a);
    const r2 = (-b - Math.sqrt(disc)) / (2 * a);
    roots = [Math.min(r1, r2), Math.max(r1, r2)].map((r) => (Math.abs(r) < 1e-12 ? 0 : r));
  } else if (Math.abs(disc) <= 1e-9) {
    roots = [vertexX];
  }

  return {
    a,
    b,
    c,
    disc,
    vertexX,
    vertexY,
    roots,
    yIntercept: c,
    axisOfSymmetry: vertexX,
  };
}

export function parseLinearAnalysis(raw: string): LinearAnalysis | null {
  let s = raw.trim()
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/^\$\$|\$\$/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\s+/g, '')
    .replace(/^y=|^f\(x\)=|^g\(x\)=/, '');

  if (s.includes('^2')) return null;

  if (s.includes('=')) {
    const parts = s.split('=');
    if (parts[1] === '0') {
      s = parts[0];
    } else {
      s = `${parts[0]}-(${parts[1]})`;
    }
  }

  s = s.replace(/--/g, '+').replace(/\+-|-\+/g, '-');
  const linearMatch = /([+-]?\d*(?:\.\d+)?)x/.exec(s);
  if (!linearMatch) return null;

  let m = 1;
  if (linearMatch[1] === '' || linearMatch[1] === '+') m = 1;
  else if (linearMatch[1] === '-') m = -1;
  else m = parseFloat(linearMatch[1]);

  const remainder = s.replace(linearMatch[0], '');
  const constMatch = /([+-]?\d+(?:\.\d+)?)/.exec(remainder);
  const b = constMatch ? parseFloat(constMatch[1]) : 0;

  if (isNaN(m) || m === 0) return null;

  const rootX = -b / m;
  return { m, b, rootX, yIntercept: b };
}

/**
 * Converts common LaTeX math notation into a safe JS-evaluable expression in terms of x.
 */
function latexToJsExpression(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;

  // Strip display wrappers or environment tags
  s = s
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/^\$\$|\$\$/g, '')
    .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\,/g, '')
    .replace(/\\;/g, '')
    .replace(/\\quad|\\qquad/g, '')
    .trim();

  // If multi-line, pick the first line that looks like a function definition or expression
  const lines = s
    .split(/\\\\|\n/)
    .map((l) => l.replace(/&/g, '').trim())
    .filter(Boolean);
  if (lines.length > 1) {
    const fnLine = lines.find(
      (l) => /^(?:[fghy]\s*\(\s*x\s*\)|y)\s*=/i.test(l) || /x/.test(l)
    );
    s = fnLine || lines[lines.length - 1];
  }

  // Handle equations like f(x) = ..., g(x) = ..., y = ..., or lhs = rhs
  if (s.includes('=')) {
    const parts = s.split('=').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const lhs = parts[0];
      const rhs = parts[parts.length - 1];
      if (/^(?:[fghy]\s*\(\s*x\s*\)|y)$/i.test(lhs)) {
        s = rhs;
      } else if (!lhs.includes('x') && rhs.includes('x')) {
        s = rhs;
      } else if (lhs.includes('x') && !rhs.includes('x') && /^[-+]?\d+(?:\.\d+)?$/.test(rhs)) {
        // e.g. x^2 - 4 = 0 -> plot x^2 - 4 - (rhs)
        s = `(${lhs}) - (${rhs})`;
      } else if (!lhs.includes('x') && !rhs.includes('x')) {
        // Arithmetic equation like 19 * 99 = 1881 or 1+1=2 -> evaluate lhs
        s = lhs;
      } else {
        s = rhs;
      }
    }
  }

  // Convert \frac{a}{b} iteratively
  for (let i = 0; i < 6; i++) {
    const next = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))');
    if (next === s) break;
    s = next;
  }

  // Convert \sqrt[n]{a} and \sqrt{a}
  s = s.replace(/\\sqrt\s*\[([^\][]+)\]\s*\{([^{}]+)\}/g, 'Math.pow(($2), 1/($1))');
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'Math.sqrt($1)');
    if (next === s) break;
    s = next;
  }

  // Replace standard LaTeX functions & constants
  s = s
    .replace(/\\cdot|\\times|×/g, '*')
    .replace(/\\div|÷/g, '/')
    .replace(/\\pi\b/g, 'Math.PI')
    .replace(/\bpi\b/gi, 'Math.PI')
    .replace(/\\(?:sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|abs)\b/g, (m) => `Math.${m.slice(1)}`)
    .replace(/\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|abs|sqrt)\s*\(/gi, (_, fn) => `Math.${fn.toLowerCase()}(`)
    .replace(/\\ln\b/g, 'Math.log')
    .replace(/\bln\s*\(/gi, 'Math.log(')
    .replace(/\\log\b/g, 'Math.log10')
    .replace(/\blog\s*\(/gi, 'Math.log10(');

  // Convert |expr| absolute value bars
  s = s.replace(/\|([^|]+)\|/g, 'Math.abs($1)');

  // Convert braces { ... } to parentheses ( ... )
  s = s.replace(/\{/g, '(').replace(/\}/g, ')');

  // Convert Caret power ^ to **
  s = s.replace(/\^/g, '**');

  // Handle Euler's constant e
  s = s.replace(/(?<![A-Za-z0-9_.])e(?![A-Za-z0-9_])/g, 'Math.E');

  // Implicit multiplication:
  // 2x -> 2*x, 2(x) -> 2*(x), )x -> )*x, )( -> )*(, xMath -> x*Math
  s = s
    .replace(/(\d)\s*(x\b|Math\.|\()/gi, '$1*$2')
    .replace(/(\))\s*(\d|x\b|Math\.|\()/gi, '$1*$2')
    .replace(/\b(x)\s*(\(|Math\.)/gi, '$1*$2');

  // Ensure only safe tokens remain
  const stripped = s
    .replace(/Math\.(?:PI|E|sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|abs|sqrt|log|log10|pow)/g, '')
    .replace(/[0-9xX+\-*/().,\s]/g, '');

  if (stripped.length > 0) {
    return null;
  }

  return s;
}

export interface ParsedMathInfo {
  isPlottableFunction: boolean;
  fn?: (x: number) => number;
  formulaLabel: string;
  constantResult: number | null;
  steps: string[];
  quadratic: QuadraticAnalysis | null;
  linear: LinearAnalysis | null;
  keyPoints: PlotKeyPoint[];
}

export function analyzeMathContent(raw: string): ParsedMathInfo {
  const clean = raw.trim();
  const rawLines = clean
    .replace(/^\\\[|\\\]$/g, '')
    .replace(/^\$\$|\$\$/g, '')
    .replace(/\\begin\{(?:aligned|align\*?|gather\*?|eqnarray\*?)\}|\\end\{(?:aligned|align\*?|gather\*?|eqnarray\*?)\}/g, '')
    .split(/\\\\|\n/)
    .map((l) => l.replace(/&/g, '').trim())
    .filter(Boolean);

  const quad = parseQuadraticAnalysis(clean);
  const lin = quad ? null : parseLinearAnalysis(clean);

  const keyPoints: PlotKeyPoint[] = [];
  if (quad) {
    keyPoints.push({ label: 'Vertex', x: quad.vertexX, y: quad.vertexY, color: 'var(--accent)' });
    quad.roots.forEach((r, idx) => {
      keyPoints.push({
        label: quad.roots.length > 1 ? `Root ${idx + 1}` : 'Double Root',
        x: r,
        y: 0,
        color: 'var(--success)',
      });
    });
    keyPoints.push({ label: 'Y-int', x: 0, y: quad.yIntercept, color: 'var(--text-muted)' });
  } else if (lin) {
    keyPoints.push({ label: 'Root', x: lin.rootX, y: 0, color: 'var(--success)' });
    keyPoints.push({ label: 'Y-int', x: 0, y: lin.yIntercept, color: 'var(--text-muted)' });
  }

  const jsExpr = latexToJsExpression(clean);
  if (jsExpr) {
    const hasX = /\bx\b/i.test(jsExpr);
    if (hasX) {
      try {
        const compiled = new Function('x', `"use strict"; return (${jsExpr});`) as (
          x: number
        ) => number;
        // Test evaluation across sample points to verify it produces finite real values
        const sampleXs = [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4];
        let validCount = 0;
        for (const sx of sampleXs) {
          const y = compiled(sx);
          if (typeof y === 'number' && Number.isFinite(y)) {
            validCount++;
          }
        }
        if (validCount >= 3) {
          return {
            isPlottableFunction: true,
            fn: compiled,
            formulaLabel: rawLines[0] || clean,
            constantResult: null,
            steps: rawLines.length > 1 ? rawLines : [],
            quadratic: quad,
            linear: lin,
            keyPoints,
          };
        }
      } catch {
        // Not a valid single-variable function
      }
    } else {
      // Constant numeric expression (no x)
      try {
        const val = new Function(`"use strict"; return (${jsExpr});`)();
        if (typeof val === 'number' && Number.isFinite(val)) {
          return {
            isPlottableFunction: false,
            formulaLabel: clean,
            constantResult: val,
            steps: rawLines.length > 1 ? rawLines : [],
            quadratic: null,
            linear: null,
            keyPoints: [],
          };
        }
      } catch {
        // Ignore
      }
    }
  }

  // If equation has an evaluated right hand side, e.g. = 14 or = 1^2 + 2^2 + 3^2
  let constantResult: number | null = null;
  const eqParts = clean.split('=');
  if (eqParts.length >= 2) {
    const lastPart = eqParts[eqParts.length - 1].trim();
    const numMatch = /^[-+]?\d+(?:\.\d+)?$/.exec(lastPart);
    if (numMatch) {
      constantResult = parseFloat(numMatch[0]);
    } else {
      const jsLast = latexToJsExpression(lastPart);
      if (jsLast && !/x/i.test(jsLast)) {
        try {
          const val = new Function(`"use strict"; return (${jsLast});`)();
          if (typeof val === 'number' && Number.isFinite(val)) {
            constantResult = val;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return {
    isPlottableFunction: false,
    formulaLabel: clean,
    constantResult,
    steps: rawLines.length > 1 ? rawLines : [],
    quadratic: quad,
    linear: lin,
    keyPoints,
  };
}

export function formatMathNum(n: number): string {
  if (!Number.isFinite(n)) return 'Undefined';
  if (Math.abs(n) < 1e-10) return '0';
  if (Math.abs(n) >= 1e6 || (Math.abs(n) > 0 && Math.abs(n) < 1e-4)) {
    return n.toExponential(3);
  }
  return Number(n.toFixed(4)).toString();
}

export function renderLatexToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });
  } catch {
    return latex;
  }
}

export const InlineMathSpan: React.FC<{ latex: string }> = ({ latex }) => {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => renderLatexToHtml(latex, false), [latex]);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(latex);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCopy();
        }
      }}
      title="Tap to copy math expression"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 align-middle transition-colors cursor-pointer active:scale-95"
      style={{
        backgroundColor: 'var(--surface-2)',
        border: `1px solid ${copied ? 'var(--success)' : 'var(--border)'}`,
        borderRadius: '6px',
        color: 'var(--text)',
      }}
    >
      <span
        className="text-[0.95em] leading-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {copied && (
        <Check
          className="w-3 h-3 shrink-0 inline"
          style={{ color: 'var(--success)' }}
        />
      )}
    </span>
  );
};

export interface FunctionPlotterProps {
  fn: (x: number) => number;
  exactRoots?: number[];
  keyPoints?: PlotKeyPoint[];
}

export const FunctionPlotter: React.FC<FunctionPlotterProps> = ({
  fn,
  exactRoots,
  keyPoints = [],
}) => {
  const [domainSpan, setDomainSpan] = useState<number>(8);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const width = 560;
  const height = 240;
  const padX = 40;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const { segments, yMin, yMax, roots, yIntercept } = useMemo(() => {
    const steps = 240;
    const xMin = -domainSpan;
    const xMax = domainSpan;
    const pts: { x: number; y: number | null }[] = [];
    const validYs: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      let y: number | null = null;
      try {
        const val = fn(x);
        if (typeof val === 'number' && Number.isFinite(val) && Math.abs(val) < 1e4) {
          y = val;
          validYs.push(val);
        }
      } catch {
        y = null;
      }
      pts.push({ x, y });
    }

    let minY = validYs.length ? Math.min(...validYs) : -5;
    let maxY = validYs.length ? Math.max(...validYs) : 5;

    // Ensure reasonable height span
    if (Math.abs(maxY - minY) < 1e-3) {
      minY -= 2;
      maxY += 2;
    } else {
      const margin = (maxY - minY) * 0.12;
      minY = Math.max(-200, minY - margin);
      maxY = Math.min(200, maxY + margin);
    }

    // Include x-axis if close
    if (minY > 0 && minY < (maxY - minY) * 0.5) minY = - (maxY * 0.1);
    if (maxY < 0 && Math.abs(maxY) < (maxY - minY) * 0.5) maxY = Math.abs(minY) * 0.1;

    const toSvgX = (x: number) => padX + ((x - xMin) / (xMax - xMin)) * plotW;
    const toSvgY = (y: number) => padY + (1 - (y - minY) / (maxY - minY)) * plotH;

    // Build continuous path segments (breaking on asymptotes)
    const builtSegments: string[] = [];
    let currentCmds: string[] = [];
    let prevY: number | null = null;

    for (const pt of pts) {
      if (pt.y === null || pt.y < minY - (maxY - minY) || pt.y > maxY + (maxY - minY)) {
        if (currentCmds.length > 1) {
          builtSegments.push(currentCmds.join(' '));
        }
        currentCmds = [];
        prevY = null;
        continue;
      }

      if (prevY !== null && Math.abs(pt.y - prevY) > (maxY - minY) * 0.85) {
        if (currentCmds.length > 1) {
          builtSegments.push(currentCmds.join(' '));
        }
        currentCmds = [];
      }

      const sx = toSvgX(pt.x).toFixed(2);
      const sy = toSvgY(pt.y).toFixed(2);
      currentCmds.push(currentCmds.length === 0 ? `M ${sx} ${sy}` : `L ${sx} ${sy}`);
      prevY = pt.y;
    }
    if (currentCmds.length > 1) {
      builtSegments.push(currentCmds.join(' '));
    }

    // Detect roots: both exact analytical roots and numerical sign changes / extrema
    const detectedRoots: { x: number; sx: number; sy: number }[] = [];
    const rootXSet = new Set<string>();

    if (exactRoots && exactRoots.length > 0) {
      for (const r of exactRoots) {
        if (r >= xMin && r <= xMax) {
          const key = r.toFixed(3);
          if (!rootXSet.has(key)) {
            rootXSet.add(key);
            detectedRoots.push({ x: r, sx: toSvgX(r), sy: toSvgY(0) });
          }
        }
      }
    }

    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      if (p0.y !== null && p1.y !== null) {
        if (Math.abs(p0.y) < 1e-6) {
          const key = p0.x.toFixed(3);
          if (!rootXSet.has(key)) {
            rootXSet.add(key);
            detectedRoots.push({ x: p0.x, sx: toSvgX(p0.x), sy: toSvgY(0) });
          }
        } else if (p0.y * p1.y < 0 && Math.abs(p1.y - p0.y) < (maxY - minY) * 0.5) {
          const rootX = p0.x - p0.y * ((p1.x - p0.x) / (p1.y - p0.y));
          const key = rootX.toFixed(3);
          if (!rootXSet.has(key)) {
            rootXSet.add(key);
            detectedRoots.push({ x: rootX, sx: toSvgX(rootX), sy: toSvgY(0) });
          }
        } else if (i > 1 && Math.abs(p0.y) < 0.08) {
          // Local extremum touching axis (e.g. repeated roots like (x+1)^2=0)
          const pPrev = pts[i - 2];
          if (pPrev.y !== null && (p0.y - pPrev.y) * (p1.y - p0.y) <= 0) {
            const key = p0.x.toFixed(2);
            if (!rootXSet.has(key)) {
              rootXSet.add(key);
              detectedRoots.push({ x: p0.x, sx: toSvgX(p0.x), sy: toSvgY(0) });
            }
          }
        }
      }
    }

    // Y-intercept at x=0
    let yInt: { y: number; sx: number; sy: number } | null = null;
    try {
      const y0 = fn(0);
      if (typeof y0 === 'number' && Number.isFinite(y0) && y0 >= minY && y0 <= maxY) {
        yInt = { y: y0, sx: toSvgX(0), sy: toSvgY(y0) };
      }
    } catch {
      yInt = null;
    }

    return {
      segments: builtSegments,
      yMin: minY,
      yMax: maxY,
      roots: detectedRoots.slice(0, 6),
      yIntercept: yInt,
    };
  }, [fn, domainSpan, plotW, plotH, exactRoots]);

  const xMin = -domainSpan;
  const xMax = domainSpan;
  const toSvgX = (x: number) => padX + ((x - xMin) / (xMax - xMin)) * plotW;
  const toSvgY = (y: number) => padY + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  const axisY = Math.min(padY + plotH, Math.max(padY, toSvgY(0)));
  const axisX = toSvgX(0);

  const handlePointerMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width;
    const clampedSvgX = Math.max(padX, Math.min(padX + plotW, relX));
    const mathX = xMin + ((clampedSvgX - padX) / plotW) * (xMax - xMin);
    setHoverX(mathX);
  };

  let hoverPoint: { x: number; y: number; slope: number; sx: number; sy: number } | null = null;
  if (hoverX !== null) {
    try {
      const y = fn(hoverX);
      const h = 1e-4;
      const slope = (fn(hoverX + h) - fn(hoverX - h)) / (2 * h);
      if (typeof y === 'number' && Number.isFinite(y)) {
        hoverPoint = {
          x: hoverX,
          y,
          slope: Number.isFinite(slope) ? slope : 0,
          sx: toSvgX(hoverX),
          sy: Math.max(padY, Math.min(padY + plotH, toSvgY(y))),
        };
      }
    } catch {
      hoverPoint = null;
    }
  }

  return (
    <div
      className="border-t pt-3 mt-3 select-none"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Plot Toolbar & Live Coordinate Readout */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 mb-2">
        <div
          className="flex items-center gap-3 text-xs tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
        >
          {hoverPoint ? (
            <>
              <span>
                x = <strong style={{ color: 'var(--text)' }}>{formatMathNum(hoverPoint.x)}</strong>
              </span>
              <span>·</span>
              <span>
                f(x) = <strong style={{ color: 'var(--accent)' }}>{formatMathNum(hoverPoint.y)}</strong>
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                f&apos;(x) = <strong style={{ color: 'var(--text)' }}>{formatMathNum(hoverPoint.slope)}</strong>
              </span>
            </>
          ) : (
            <span>
              Interactive plot · Domain [{xMin}, {xMax}] (hover or drag to inspect)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDomainSpan((s) => Math.max(2, s / 2))}
            className="min-h-[28px] px-2 py-0.5 inline-flex items-center gap-1 text-xs border transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
              borderRadius: '6px',
            }}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Zoom in</span>
          </button>
          <button
            type="button"
            onClick={() => setDomainSpan((s) => Math.min(32, s * 2))}
            className="min-h-[28px] px-2 py-0.5 inline-flex items-center gap-1 text-xs border transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
              borderRadius: '6px',
            }}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Zoom out</span>
          </button>
        </div>
      </div>

      {/* SVG Coordinate Plane */}
      <div
        className="w-full overflow-hidden border"
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--border)',
          borderRadius: '10px',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block touch-none cursor-crosshair"
          onMouseMove={(e) => handlePointerMove(e.clientX)}
          onMouseLeave={() => setHoverX(null)}
          onTouchMove={(e) => {
            if (e.touches[0]) {
              handlePointerMove(e.touches[0].clientX);
            }
          }}
        >
          <defs>
            <clipPath id="ls-math-plot-clip">
              <rect x={padX} y={padY} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Subtle Grid Lines */}
          {[-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75].map((ratio) => {
            const gx = padX + (ratio + 1) * 0.5 * plotW;
            const gy = padY + (ratio + 1) * 0.5 * plotH;
            return (
              <g key={ratio} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" opacity="0.65">
                <line x1={gx} y1={padY} x2={gx} y2={padY + plotH} />
                <line x1={padX} y1={gy} x2={padX + plotW} y2={gy} />
              </g>
            );
          })}

          {/* Coordinate Axes */}
          <line
            x1={padX}
            y1={axisY}
            x2={padX + plotW}
            y2={axisY}
            stroke="var(--text-muted)"
            strokeWidth="1.25"
            opacity="0.6"
          />
          <line
            x1={axisX}
            y1={padY}
            x2={axisX}
            y2={padY + plotH}
            stroke="var(--text-muted)"
            strokeWidth="1.25"
            opacity="0.6"
          />

          {/* Axis Labels */}
          <text
            x={padX + 4}
            y={axisY - 6}
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            x = {xMin}
          </text>
          <text
            x={padX + plotW - 4}
            y={axisY - 6}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            x = +{xMax}
          </text>
          <text
            x={axisX + 6}
            y={padY + 11}
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            y = {formatMathNum(yMax)}
          </text>
          <text
            x={axisX + 6}
            y={padY + plotH - 4}
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            y = {formatMathNum(yMin)}
          </text>

          {/* Function Curve Segments */}
          <g clipPath="url(#ls-math-plot-clip)">
            {segments.map((d, idx) => (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* Additional custom key points (e.g. Vertex) */}
            {keyPoints.map((kp, i) => {
              if (kp.x < xMin || kp.x > xMax || kp.y < yMin || kp.y > yMax) return null;
              const sx = toSvgX(kp.x);
              const sy = toSvgY(kp.y);
              return (
                <g key={`kp-${i}`}>
                  <circle
                    cx={sx}
                    cy={sy}
                    r="4.5"
                    fill={kp.color || 'var(--accent)'}
                    stroke="var(--bg)"
                    strokeWidth="2"
                  />
                  <text
                    x={sx + 6}
                    y={sy - 6}
                    fill="var(--text)"
                    fontSize="9.5"
                    fontWeight="500"
                    fontFamily="var(--font-mono)"
                  >
                    {kp.label}
                  </text>
                </g>
              );
            })}

            {/* Highlighted Roots (x-intercepts) */}
            {roots.map((r, i) => (
              <circle
                key={`root-${i}`}
                cx={r.sx}
                cy={r.sy}
                r="3.5"
                fill="var(--bg)"
                stroke="var(--accent)"
                strokeWidth="2"
              />
            ))}

            {/* Highlighted y-intercept */}
            {yIntercept && (
              <circle
                cx={yIntercept.sx}
                cy={yIntercept.sy}
                r="3.5"
                fill="var(--accent)"
              />
            )}

            {/* Interactive Scrubbing Crosshair */}
            {hoverPoint && (
              <g>
                <line
                  x1={hoverPoint.sx}
                  y1={padY}
                  x2={hoverPoint.sx}
                  y2={padY + plotH}
                  stroke="var(--accent)"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <circle
                  cx={hoverPoint.sx}
                  cy={hoverPoint.sy}
                  r="5"
                  fill="var(--accent)"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              </g>
            )}
          </g>
        </svg>
      </div>
    </div>
  );
};

export interface MathVisualCardProps {
  code: string;
  isStreaming?: boolean;
}

export const MathVisualCard: React.FC<MathVisualCardProps> = ({ code, isStreaming }) => {
  const [copied, setCopied] = useState(false);
  const [showGraph, setShowGraph] = useState(true);

  const cleanLatex = useMemo(() => {
    return code
      .replace(/^\\\[|\\\]$/g, '')
      .replace(/^\$\$|\$\$/g, '')
      .trim();
  }, [code]);

  const html = useMemo(() => renderLatexToHtml(cleanLatex, true), [cleanLatex]);
  const info = useMemo(() => analyzeMathContent(cleanLatex), [cleanLatex]);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(cleanLatex);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const titleLabel = info.isPlottableFunction
    ? info.quadratic
      ? 'Quadratic Function & Graph'
      : info.linear
        ? 'Linear Function & Graph'
        : 'Function & Graph'
    : info.steps.length > 1
      ? 'Mathematical Derivation'
      : info.constantResult !== null
        ? 'Calculation'
        : 'Mathematical Expression';

  const HeaderIcon = info.isPlottableFunction
    ? LineChart
    : info.constantResult !== null
      ? Calculator
      : Sigma;

  return (
    <div
      className="my-3.5 first:mt-0 last:mb-0 w-full max-w-full min-w-0 border overflow-hidden"
      style={{
        borderColor: 'var(--border)',
        borderRadius: '12px',
        backgroundColor: 'var(--surface)',
      }}
    >
      {/* Top Header Bar */}
      <div
        className="px-3.5 py-2 flex items-center justify-between gap-2 border-b select-none"
        style={{
          backgroundColor: 'var(--code-header)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <HeaderIcon className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
            {titleLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {info.isPlottableFunction && !isStreaming && (
            <button
              type="button"
              onClick={() => setShowGraph((v) => !v)}
              className="min-h-[28px] px-2.5 py-0.5 inline-flex items-center gap-1 text-xs font-medium border transition-colors cursor-pointer"
              style={{
                backgroundColor: showGraph ? 'var(--surface)' : 'transparent',
                borderColor: 'var(--border)',
                color: showGraph ? 'var(--accent)' : 'var(--text-muted)',
                borderRadius: '6px',
              }}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>{showGraph ? 'Hide graph' : 'Show graph'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[28px] px-2.5 py-0.5 inline-flex items-center gap-1.5 text-xs font-medium border transition-colors cursor-pointer active:scale-95"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: copied ? 'var(--success)' : 'var(--text)',
              borderRadius: '6px',
            }}
            aria-label="Copy math expression"
            title="Copy LaTeX"
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
      </div>

      {/* Main Typeset Math Stage */}
      <div className="p-4 sm:p-5 overflow-x-auto">
        <div
          className="ls-katex-display text-center py-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Analytical Key Properties Pills for Quadratic or Linear Functions */}
        {!isStreaming && info.quadratic && (
          <div className="mt-3.5 pt-3 border-t flex flex-wrap items-center gap-2 text-xs" style={{ borderColor: 'var(--border)' }}>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Vertex: <strong style={{ color: 'var(--accent)' }}>({formatMathNum(info.quadratic.vertexX)}, {formatMathNum(info.quadratic.vertexY)})</strong>
            </span>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Roots: <strong style={{ color: 'var(--success)' }}>
                {info.quadratic.roots.length > 0
                  ? info.quadratic.roots.map((r) => `x = ${formatMathNum(r)}`).join(', ')
                  : 'No real roots'}
              </strong>
            </span>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Y-int: <strong>(0, {formatMathNum(info.quadratic.yIntercept)})</strong>
            </span>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Axis: <strong>x = {formatMathNum(info.quadratic.axisOfSymmetry)}</strong>
            </span>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Δ = <strong>{formatMathNum(info.quadratic.disc)}</strong>
            </span>
          </div>
        )}

        {!isStreaming && info.linear && (
          <div className="mt-3.5 pt-3 border-t flex flex-wrap items-center gap-2 text-xs" style={{ borderColor: 'var(--border)' }}>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Root: <strong style={{ color: 'var(--success)' }}>x = {formatMathNum(info.linear.rootX)}</strong>
            </span>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Slope m: <strong style={{ color: 'var(--accent)' }}>{formatMathNum(info.linear.m)}</strong>
            </span>
            <span
              className="px-2.5 py-1 font-medium border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Y-int: <strong>(0, {formatMathNum(info.linear.yIntercept)})</strong>
            </span>
          </div>
        )}

        {/* Step-by-step derivation breakdown when multiple lines are present */}
        {!isStreaming && info.steps.length > 1 && (
          <div
            className="mt-4 pt-3 border-t space-y-2"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="text-[11px] font-medium tracking-wide uppercase"
              style={{ color: 'var(--text-muted)' }}
            >
              Step-by-step breakdown
            </div>
            <div className="space-y-1.5">
              {info.steps.map((step, idx) => {
                const isFinal = idx === info.steps.length - 1;
                return (
                  <div
                    key={idx}
                    className="px-3 py-2 flex items-center justify-between gap-3 border text-sm overflow-x-auto"
                    style={{
                      backgroundColor: isFinal ? 'var(--surface-2)' : 'var(--bg)',
                      borderColor: isFinal ? 'var(--accent)' : 'var(--border)',
                      borderRadius: '8px',
                    }}
                  >
                    <span
                      className="text-xs font-medium tabular-nums shrink-0"
                      style={{
                        color: isFinal ? 'var(--accent)' : 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {isFinal ? 'Result' : `0${idx + 1}`.slice(-2)}
                    </span>
                    <div
                      className="flex-1 min-w-0 text-right overflow-x-auto"
                      dangerouslySetInnerHTML={{
                        __html: renderLatexToHtml(step, false),
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Evaluated Numeric Result Callout */}
        {!isStreaming && info.constantResult !== null && (
          <div
            className="mt-3 pt-3 border-t flex items-center justify-between gap-2 text-xs tabular-nums"
            style={{ borderColor: 'var(--border)', fontFamily: 'var(--font-mono)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Evaluated Value</span>
            <span
              className="px-2.5 py-1 font-semibold"
              style={{
                backgroundColor: 'var(--surface-2)',
                color: 'var(--accent)',
                borderRadius: '6px',
              }}
            >
              = {formatMathNum(info.constantResult)}
            </span>
          </div>
        )}

        {/* Interactive Function Plotter when function of x is detected */}
        {!isStreaming && info.isPlottableFunction && info.fn && showGraph && (
          <FunctionPlotter
            fn={info.fn}
            exactRoots={info.quadratic ? info.quadratic.roots : info.linear ? [info.linear.rootX] : undefined}
            keyPoints={info.keyPoints}
          />
        )}
      </div>
    </div>
  );
};
