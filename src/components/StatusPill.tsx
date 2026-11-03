import React from 'react';
import { type LaptopUiStatus, useAppState } from '../state/store';
import { SunMark, type SunVisualState } from './SunMark';
import { CloudMark, type CloudVisualState } from './CloudMark';

const STATUS_ARIA_LABELS: Record<LaptopUiStatus, string> = {
  offline: 'Local Model state: Offline',
  sleeping: 'Local Model state: Idle',
  waking: 'Local Model state: Waking up',
  ready: 'Local Model state: Ready',
  busy: 'Local Model state: Active',
};

export const StatusPill: React.FC = () => {
  const { mode, laptopStatus, cloudStatus, isStreaming, streamingStage } = useAppState();

  if (mode === 'cloud') {
    let cloudVisual: CloudVisualState = 'idle';
    let cloudLabel = 'Cloud API: Ready';

    if (cloudStatus === 'unconfigured') {
      cloudVisual = 'offline';
      cloudLabel = 'Cloud API: API Key required';
    } else if (isStreaming || cloudStatus === 'generating') {
      cloudVisual = 'generating';
      cloudLabel = 'Cloud API: Generating response';
    } else {
      cloudVisual = 'idle';
      cloudLabel = 'Cloud API: Ready';
    }

    return (
      <div
        className="min-h-[38px] min-w-[38px] px-1.5 inline-flex items-center justify-center shrink-0 select-none"
        role="status"
        aria-live="polite"
        aria-label={cloudLabel}
        title={cloudLabel}
      >
        <CloudMark size={22} state={cloudVisual} animated={cloudVisual === 'generating'} />
      </div>
    );
  }

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
