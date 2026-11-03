export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

/**
 * Detects whether a query is asking for current date, time, or calendar info,
 * which should be resolved from the system's real-time clock rather than search engines.
 */
export function isTemporalQuery(query: string): boolean {
  const q = query.toLowerCase().trim();
  return (
    /\b(what('?s| is) (the )?(current )?(date|time|day|year|month))\b/i.test(q) ||
    /\bwhat time is (it|now)\b/i.test(q) ||
    /\b(today('?s)? date|current (date|time|year)|what day is (it|today))\b/i.test(q) ||
    /\b(date of today|date today|time right now|current time)\b/i.test(q)
  );
}

/**
 * Extracts a concise search query from user prompt text by stripping markdown,
 * greetings, and conversational preamble.
 */
export function extractSearchQuery(text: string): string {
  let q = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .split('\n')[0]
    .trim();

  // Strip conversational greetings & fillers from beginning
  q = q.replace(
    /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening)|nice to meet you|nice to meet with you|umm+|uh+|please|can you tell me|tell me|could you)\s*[,.!?:]*\s*/i,
    ''
  );
  q = q.replace(/^(?:hello|hi|hey|nice to meet with you|umm+|uh+)\s*[,.!?:]*\s*/i, '');

  return q.slice(0, 80).trim();
}

// Client-side protective rate limiting (prevents upstream IP throttling by public engines)
const MAX_SEARCHES_PER_MINUTE = 8;
const RATE_WINDOW_MS = 60 * 1000;
const searchTimestamps: number[] = [];
let upstreamCooldownUntil = 0;

export function getSearchCooldownSeconds(): number {
  const now = Date.now();
  if (now < upstreamCooldownUntil) {
    return Math.max(1, Math.ceil((upstreamCooldownUntil - now) / 1000));
  }

  while (searchTimestamps.length > 0 && now - searchTimestamps[0] > RATE_WINDOW_MS) {
    searchTimestamps.shift();
  }

  if (searchTimestamps.length >= MAX_SEARCHES_PER_MINUTE) {
    const oldest = searchTimestamps[0];
    return Math.max(1, Math.ceil((oldest + RATE_WINDOW_MS - now) / 1000));
  }

  return 0;
}

/**
 * Free, zero-API-key Multi-Engine Web Search:
 * 1. DuckDuckGo Instant Answers & Topics (general knowledge & definitions)
 * 2. Wikipedia Live API (encyclopedic, historical, & factual background)
 * 3. Hacker News / Algolia API (fresh technology, software, startup, & world discussions)
 */
export async function performWebSearch(
  query: string,
  limit = 4,
  onRateLimit?: (seconds: number) => void
): Promise<WebSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // 1. Clock/temporal inquiries are answered via system clock, not search engines
  if (isTemporalQuery(cleanQuery)) {
    return [];
  }

  // 2. Check local client rate-limit window
  const cooldownSec = getSearchCooldownSeconds();
  if (cooldownSec > 0) {
    if (onRateLimit) onRateLimit(cooldownSec);
    return [];
  }

  searchTimestamps.push(Date.now());
  const results: WebSearchResult[] = [];
  const seenUrls = new Set<string>();

  // Engine 1: DuckDuckGo Instant Answers & Topics
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(3500) });
    if (res.status === 429) {
      upstreamCooldownUntil = Date.now() + 30 * 1000;
      if (onRateLimit) onRateLimit(30);
    } else if (res.ok) {
      const data = await res.json();
      if (data.AbstractText && data.AbstractURL && !seenUrls.has(data.AbstractURL)) {
        seenUrls.add(data.AbstractURL);
        results.push({
          title: data.Heading || cleanQuery,
          snippet: data.AbstractText,
          url: data.AbstractURL,
        });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= limit) break;
          const text = topic.Text || topic.Result;
          const firstUrl = topic.FirstURL;
          if (text && firstUrl && !seenUrls.has(firstUrl)) {
            seenUrls.add(firstUrl);
            const cleanText = text.replace(/<[^>]+>/g, '').trim();
            results.push({
              title: cleanText.split(' - ')[0] || cleanText.slice(0, 48),
              snippet: cleanText,
              url: firstUrl,
            });
          }
        }
      }
    }
  } catch {
    // Continue to Wikipedia fallback
  }

  // Engine 2: Wikipedia Search API (Open CORS, 100% free, real-time facts)
  if (results.length < limit) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*&srlimit=${limit}`;
      const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(3500) });
      if (res.status === 429) {
        upstreamCooldownUntil = Date.now() + 30 * 1000;
        if (onRateLimit) onRateLimit(30);
      } else if (res.ok) {
        const data = await res.json();
        const searchList = data.query?.search;
        if (Array.isArray(searchList)) {
          for (const item of searchList) {
            if (results.length >= limit) break;
            const itemUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`;
            if (!seenUrls.has(itemUrl)) {
              seenUrls.add(itemUrl);
              const cleanSnippet = (item.snippet || '')
                .replace(/<[^>]+>/g, '')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&amp;/g, '&')
                .trim();
              if (cleanSnippet) {
                results.push({
                  title: item.title,
                  snippet: cleanSnippet,
                  url: itemUrl,
                });
              }
            }
          }
        }
      }
    } catch {
      // Continue to next engine
    }
  }

  // Engine 3: Hacker News / Algolia Live Search API (Tech, software, breaking discussions)
  if (results.length < limit) {
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(cleanQuery)}&tags=story&hitsPerPage=${limit}`;
      const res = await fetch(hnUrl, { signal: AbortSignal.timeout(3500) });
      if (res.status === 429) {
        upstreamCooldownUntil = Date.now() + 30 * 1000;
        if (onRateLimit) onRateLimit(30);
      } else if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.hits)) {
          for (const hit of data.hits) {
            if (results.length >= limit) break;
            const itemUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
            if (itemUrl && !seenUrls.has(itemUrl)) {
              seenUrls.add(itemUrl);
              const title = hit.title || cleanQuery;
              const snippet = (hit._highlightResult?.story_text?.value || hit.story_text || title)
                .replace(/<[^>]+>/g, '')
                .trim();
              results.push({
                title,
                snippet: snippet || title,
                url: itemUrl,
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return results.slice(0, limit);
}

/**
 * Formats retrieved search results into a clean, concise prompt context block.
 * Tightly budgeted to preserve context window tokens and avoid model overexplanation.
 */
export function formatSearchResultsForPrompt(query: string, results: WebSearchResult[]): string {
  if (results.length === 0) return '';
  const trimmed = results.slice(0, 3);
  const lines = trimmed.map(
    (r, i) => `[Source ${i + 1}] "${r.title}": ${r.snippet.slice(0, 220)}`
  );
  return `\n\n[Live Web Search Facts for "${query}"]:\n${lines.join('\n')}\n\n(Directive: Synthesize the facts above directly into your response without repeating the search query, without lecturing, and without overexplaining.)\n\n### Sources\n${trimmed.map((r) => `- [${r.title}](${r.url})`).join('\n')}`;
}
