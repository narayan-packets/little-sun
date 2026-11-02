import React from 'react';
import { type LaptopUiStatus, useAppState } from '../state/store';
import { SunMark, type SunVisualState } from './SunMark';

const STATUS_ARIA_LABELS: Record<LaptopUiStatus, string> = {
  offline: 'Model state: Offline',
  sleeping: 'Model state: Idle',
  waking: 'Model state: Waking up',
  ready: 'Model state: Ready',
  busy: 'Model state: Active',
};

export const StatusPill: React.FC = () => {
  const { laptopStatus, isStreaming, streamingStage } = useAppState();

  let visualState: SunVisualState = 'idle';
  if (laptopStatus === 'offline') {
    visualState = 'offline';
  } else if (
    laptopStatus === 'waking' ||
    laptopStatus === 'busy' ||
    isStreaming ||
    streamingStage === 'loading_model'
  ) {
    visualState = 'waking';
  } else {
    visualState = 'idle';
  }

  const label = STATUS_ARIA_LABELS[laptopStatus];

  return (
    <div
      className="min-h-[38px] min-w-[38px] px-1.5 inline-flex items-center justify-center shrink-0 select-none"
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
    >
      <SunMark size={22} state={visualState} />
    </div>
  );
};
