import React from 'react';

export type CloudVisualState = 'idle' | 'offline' | 'waking' | 'generating';

interface CloudMarkProps {
  size?: number;
  animated?: boolean;
  state?: CloudVisualState;
  className?: string;
}

export const CloudMark: React.FC<CloudMarkProps> = ({
  size = 28,
  animated = false,
  state,
  className = '',
}) => {
  const resolvedState: CloudVisualState = state
    ? state
    : animated
      ? 'generating'
      : 'idle';

  const isOffline = resolvedState === 'offline';
  const isGlowing = resolvedState === 'generating' || resolvedState === 'waking' || animated;

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
      } ${isGlowing ? 'cloud-glowing-active' : ''} ${className}`}
      aria-hidden="true"
    >
      <defs>
        {/* Soft amber radial glow filter for cloud */}
        <radialGradient id="cloud-glow-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <filter id="cloud-ambient-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>

      {/* Radiant Glowing Background Aura when generating */}
      {isGlowing && (
        <path
          d="M9 22C6.23858 22 4 19.7614 4 17C4 14.4183 5.95552 12.2934 8.48074 12.0308C9.28828 8.57211 12.3855 6 16.0824 6C20.3015 6 23.7745 9.30909 23.9877 13.5225C26.2891 14.1504 28 16.2758 28 18.8C28 21.6719 25.6719 24 22.8 24L9 24"
          fill="url(#cloud-glow-grad)"
          filter="url(#cloud-ambient-blur)"
          className="cloud-aura-animated"
        />
      )}

      {/* Main Architectural Cloud Path */}
      <path
        d="M9 22C6.23858 22 4 19.7614 4 17C4 14.4183 5.95552 12.2934 8.48074 12.0308C9.28828 8.57211 12.3855 6 16.0824 6C20.3015 6 23.7745 9.30909 23.9877 13.5225C26.2891 14.1504 28 16.2758 28 18.8C28 21.6719 25.6719 24 22.8 24L9 24"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isGlowing ? 'cloud-core-animated' : ''}
      />

      {/* Internal warm core or luminous signal node */}
      <circle
        cx="16"
        cy="15"
        r="2"
        fill="currentColor"
        className={isGlowing ? 'cloud-core-animated' : 'opacity-80'}
      />

      {/* Secondary accent dots inside cloud */}
      <circle
        cx="11.5"
        cy="17"
        r="1"
        fill="currentColor"
        className={isGlowing ? 'cloud-dot-1' : 'opacity-50'}
      />
      <circle
        cx="20.5"
        cy="17"
        r="1"
        fill="currentColor"
        className={isGlowing ? 'cloud-dot-2' : 'opacity-50'}
      />
    </svg>
  );
};

