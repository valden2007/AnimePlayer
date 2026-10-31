const cache = new Map();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// simple per-host rate limiter
const lastRequest = {};
async function rateLimit(host, minInterval) {
  const now = Date.now();
  const last = lastRequest[host] || 0;
  const wait = minInterval - (now - last);
  if (wait > 0) await sleep(wait);
  lastRequest[host] = Date.now();
}

async function cachedFetch(url, opts = {}) {
  const ttl = opts.ttl || 0;
  const minInterval = opts.minInterval || 0;
  const host = new URL(url).host;
  if (ttl > 0) {
    const c = cache.get(url);
    if (c && Date.now() - c.ts < ttl) return c.data;
  }
  if (minInterval > 0) await rateLimit(host, minInterval);
  const res = await fetch(url, opts.headers ? { headers: opts.headers } : {});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (ttl > 0) cache.set(url, { ts: Date.now(), data });
  return data;
}

module.exports = { cachedFetch };
