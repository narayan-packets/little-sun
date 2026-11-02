import React from 'react';

export type SunVisualState = 'idle' | 'offline' | 'waking';

interface SunMarkProps {
  size?: number;
  animated?: boolean;
  state?: SunVisualState;
  className?: string;
}

export const SunMark: React.FC<SunMarkProps> = ({
  size = 28,
  animated = false,
  state,
  className = '',
}) => {
  const resolvedState: SunVisualState = state
    ? state
    : animated
      ? 'waking'
      : 'idle';

  const isOffline = resolvedState === 'offline';
  const isWaking = resolvedState === 'waking' || animated;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none transition-all duration-300 ${
        isOffline
          ? 'opacity-35 text-[var(--text-muted)]'
          : 'text-[var(--accent)] opacity-100'
      } ${className}`}
      aria-hidden="true"
    >
      {/* Central Solar Core & Ring */}
      <circle
        cx="16"
        cy="16"
        r="4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        className={isWaking ? 'sun-core-animated' : ''}
      />
      <circle
        cx="16"
        cy="16"
        r="2"
        fill="currentColor"
        className={isWaking ? 'sun-core-animated' : ''}
      />

      {/* Minimal Architectural Rays */}
      <g
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className={isWaking ? 'sun-rays-animated' : ''}
        style={{ transformOrigin: '16px 16px' }}
      >
        {/* Cardinal */}
        <line x1="16" y1="3.2" x2="16" y2="6.6" />
        <line x1="16" y1="25.4" x2="16" y2="28.8" />
        <line x1="3.2" y1="16" x2="6.6" y2="16" />
        <line x1="25.4" y1="16" x2="28.8" y2="16" />

        {/* Diagonal */}
        <line x1="6.9" y1="6.9" x2="9.3" y2="9.3" />
        <line x1="22.7" y1="22.7" x2="25.1" y2="25.1" />
        <line x1="25.1" y1="6.9" x2="22.7" y2="9.3" />
        <line x1="9.3" y1="22.7" x2="6.9" y2="25.1" />
      </g>
    </svg>
  );
};
