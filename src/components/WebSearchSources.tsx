import React from 'react';
import { ExternalLink, Globe } from 'lucide-react';

export interface WebSourceItem {
  title: string;
  url: string;
}

interface WebSearchSourcesProps {
  sources: WebSourceItem[];
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

export const WebSearchSources: React.FC<WebSearchSourcesProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="my-3.5 pt-3 border-t border-[var(--border)] select-none">
      <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>
        <Globe className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
        <span>Sources ({sources.length})</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sources.map((item, idx) => {
          const domain = extractDomain(item.url);
          const faviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;

          return (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs no-underline transition-all hover:border-[var(--accent)] hover:shadow-xs active:scale-[0.98] max-w-full"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
              title={item.title}
            >
              <img
                src={faviconUrl}
                alt=""
                className="w-3.5 h-3.5 rounded-sm shrink-0 opacity-80 group-hover:opacity-100"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-medium truncate max-w-[150px] sm:max-w-[220px]">
                {item.title}
              </span>
              <span
                className="text-[10px] px-1 py-0.2 rounded font-mono shrink-0"
                style={{
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text-muted)',
                }}
              >
                {domain}
              </span>
              <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-40 group-hover:opacity-100 shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
};

