import { getDirectGatewayUrl, getGatewayUrl } from './gateway';

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
  if (
    /\b(today('?s)?|now|current|tonight|this year|this month|this week)\b/i.test(q) &&
    /\b(date|day|time|year|month|hour|minute|clock)\b/i.test(q)
  ) {
    return true;
  }
  return (
    /\b(what('?s| is) (the )?(current )?(date|time|day|year|month))\b/i.test(q) ||
    /\bwhat time is (it|now)\b/i.test(q) ||
    /\bwhat day is (it|today)\b/i.test(q) ||
    /\b(today('?s)? date|current (date|time|year)|date of today|date today|time right now|current time)\b/i.test(q) ||
    /\b(what is today|what date is it|what day is today)\b/i.test(q)
  );
}

/**
 * Detects whether a message genuinely warrants external web search.
 * Filters out conversational chatter, greetings, farewells, acknowledgments,
 * math, programming tasks, and creative writing to avoid hallucinations.
 */
export function shouldPerformWebSearch(text: string): boolean {
  if (!text) return false;
  const clean = text.trim();
  if (clean.length < 2) return false;

  // 1. Clock / date questions handled by system prompt, not web search
  if (isTemporalQuery(clean)) return false;

  const lower = clean.toLowerCase();

  // 2. Farewells & partings (NEVER search the web for goodbyes)
  const farewellPattern =
    /^(?:okay\s+|ok\s+|well\s+)?(?:bye|goodbye|cya|see you|good night|gn|catch you later|take care|have a good (?:day|night)|peace out)[\s!.]*$/i;
  if (farewellPattern.test(lower)) return false;

  // 3. Simple standalone greetings
  const greetingPattern =
    /^(?:hi|hello|hey|yo|howdy|sup|greetings|good\s+(?:morning|afternoon|evening|day))[\s!.,?]*$/i;
  if (greetingPattern.test(lower)) return false;

  // 4. Acknowledgments, thanks, short confirmations
  const ackPattern =
    /^(?:ok|okay|k|cool|nice|great|awesome|understood|got it|thanks|thank you|thx|cheers|sure|yes|no|yep|nope)[\s!.]*$/i;
  if (ackPattern.test(lower)) return false;

  // 5. Identity, small-talk, chatbot self-inquiries
  const smallTalkPattern =
    /^(?:who are you|what are you|what is your name|how are you|how are you doing|how's it going|what can you do|are you (?:ai|robot|real|human|stupid|smart))[\s!.,?]*$/i;
  if (smallTalkPattern.test(lower)) return false;

  // 6. Code / script / syntax requests (local model capability)
  if (
    /^(?:write|create|implement|give me|generate|code|show me)\s+(?:a\s+)?(?:python|javascript|typescript|c\+\+|rust|java|html|css|sql|function|script|code|component|regex|class|algorithm)/i.test(
      lower
    )
  ) {
    return false;
  }

  // 7. Math expressions & arithmetic
  if (
    /^[0-9+\-*/^().\s=%]+$/.test(clean) ||
    /^(?:calculate|compute|solve|what is)\s+[0-9+\-*/^().\s]+$/i.test(lower)
  ) {
    return false;
  }

  // 8. Creative writing
  if (/^(?:write|generate|tell me)\s+(?:a\s+)?(?:poem|story|haiku|joke|riddle|song|essay|pun)/i.test(lower)) {
    return false;
  }

  // Positive triggers: explicit search directives
  const explicitSearch = /\b(?:search|search for|google|browse|lookup|look up|check online|find out|source)\b/i.test(lower);
  if (explicitSearch) return true;

  // Real-time factual inquiry keywords: weather, news, stocks, sports, current releases, etc.
  const realTimeFacts =
    /\b(?:weather|forecast|temperature|rain|snow|humidity|climate|stock|price|crypto|bitcoin|btc|eth|market|score|match|game|news|latest|recent|current|today|tomorrow|yesterday|election|release date|version|specs|who won|who is)\b/i.test(
      lower
    );
  if (realTimeFacts) return true;

  // Questions seeking external factual answers (who, when, where, how much) with question mark
  const factualQuestion = /^(?:what|when|where|who|why|how much|how many|is it|did|does|can you find)\b/i.test(lower);
  if (factualQuestion && clean.includes('?')) return true;

  // Short queries (<= 4 words) without positive signals should not search
  const words = clean.split(/\s+/).length;
  if (words <= 4) return false;

  return true;
}

/**
 * Strips verbose website branding suffixes from scraped search result titles
 * (e.g. "Nalasopara Forecast - The Weather Channel | Weather.com" -> "Nalasopara Forecast")
 */
export function cleanSourceTitle(rawTitle: string, hostname?: string): string {
  if (!rawTitle) return '';
  let clean = rawTitle
    .replace(/<[^>]+>/g, '')
    .replace(/\s*[-–—|:]\s*(?:The\s+)?(?:Weather Channel|AccuWeather|Wikipedia|YouTube|Reddit|GitHub|Twitter|X|BBC|CNN|Forbes|Bloomberg|Reuters|Yahoo|MSN|Google|Baidu).*$/i, '')
    .trim();

  if (hostname) {
    const domainPrefix = hostname.split('.')[0];
    if (domainPrefix && domainPrefix.length > 2) {
      const reg = new RegExp(`\\s*[-–—|:]\\s*${domainPrefix}.*$`, 'i');
      clean = clean.replace(reg, '').trim();
    }
  }

  return clean || rawTitle;
}

/**
 * Extracts contextual search query for follow-up questions
 * (e.g. if user asks "Weekly forecast?" after discussing "Nallasopara East", produces "Weekly forecast Nallasopara East")
 */
export function extractContextualSearchQuery(
  text: string,
  history: Array<{ role: string; content: string }> = []
): string {
  const baseQuery = extractSearchQuery(text);
  const words = baseQuery.split(/\s+/);

  // If the query is already self-contained (>= 5 words), return it directly
  if (words.length >= 5) {
    return baseQuery;
  }

  // Look for prior user turns in history to find referenced locations/entities
  const priorUserTurns = history
    .filter((m) => m.role === 'user')
    .slice(-3, -1); // previous 2 user messages

  if (priorUserTurns.length > 0) {
    const lastUserMsg = priorUserTurns[priorUserTurns.length - 1].content;
    // Extract location or entity after "in", "at", "for", "about"
    const match = lastUserMsg.match(/\b(?:in|at|for|about|of)\s+([A-Z][a-zA-Z0-9\s]+?)(?:\s+(?:tomorrow|today|yesterday|this|next|[.?!]|$))/i);
    if (match && match[1]) {
      const entity = match[1].trim();
      if (!baseQuery.toLowerCase().includes(entity.toLowerCase())) {
        return `${baseQuery} ${entity}`.trim();
      }
    }
  }

  return baseQuery;
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

  // Strip conversational greetings & fillers repeatedly from beginning
  let prev = '';
  while (prev !== q) {
    prev = q;
    q = q.replace(
      /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening|day)|nice to meet you|nice to meet with you|greetings|umm+|uh+|please|can you tell me|tell me|could you tell me|do you know)\s*[,.!?:]*\s*/i,
      ''
    );
  }

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
 * 1. Little Sun Gateway Search (Live DuckDuckGo scraping, fresh web news/facts, real clean URLs)
 * 2. Wikipedia Search API (Open CORS, factual background)
 * 3. DuckDuckGo Instant Answers & Topics (general definitions)
 * 4. Hacker News / Algolia API (fresh technology, software, startup, & world discussions)
 */
export async function performWebSearch(
  query: string,
  limit = 4,
  onRateLimit?: (seconds: number) => void,
  accessToken?: string
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

  // 3. Engine 1 (Primary): Little Sun Gateway Live DuckDuckGo search (fresh news, stocks, events)
  const candidateGateway = getDirectGatewayUrl() || getGatewayUrl();
  if (candidateGateway && !candidateGateway.includes('/gateway-proxy')) {
    try {
      const searchUrl = `${candidateGateway}/search?q=${encodeURIComponent(cleanQuery)}&limit=${limit}`;
      let token = accessToken;
      if (!token && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        token = 'local-preview-token';
      }
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const gRes = await fetch(searchUrl, {
        headers,
        signal: AbortSignal.timeout(6500),
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (Array.isArray(gData.results) && gData.results.length > 0) {
          searchTimestamps.push(Date.now());
          return gData.results.slice(0, limit);
        }
      }
    } catch {
      // Continue to public multi-engine fallbacks
    }
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
  if (!results || results.length === 0) return '';
  const lines = results.map(
    (r, i) => `[Source ${i + 1}] "${cleanSourceTitle(r.title)}": ${r.snippet.slice(0, 240)}`
  );
  return `\n\n[Live Web Search Facts for "${query}"]:\n${lines.join('\n')}\n\n(Directive: Synthesize the facts above directly into your response without reciting URLs, without repeating previous turn answers, and without conversational lecturing.)`;
}
