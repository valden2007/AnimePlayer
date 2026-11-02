const cache = new Map();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const lastRequest = {};
async function rateLimit(host, minInterval) {
  const now = Date.now();
  const last = lastRequest[host] || 0;
  const wait = minInterval - (now - last);
  if (wait > 0) await sleep(wait);
  lastRequest[host] = Date.now();
}

async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, Object.assign({}, opts, { signal: controller.signal }));
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function cachedFetch(url, opts = {}) {
  const ttl = opts.ttl || 0;
  const minInterval = opts.minInterval || 0;
  const timeoutMs = opts.timeoutMs || 15000;
  const retries = opts.retries || 2;
  const host = new URL(url).host;

  if (ttl > 0) {
    const c = cache.get(url);
    if (c && Date.now() - c.ts < ttl) return c.data;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (minInterval > 0) await rateLimit(host, minInterval);
      const res = await fetchWithTimeout(url, { headers: opts.headers }, timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (ttl > 0) cache.set(url, { ts: Date.now(), data });
      return data;
    } catch (e) {
      lastError = e;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastError || new Error('Network error');
}

module.exports = { cachedFetch, sleep };
