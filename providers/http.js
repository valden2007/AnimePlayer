const fs = require('fs');
const path = require('path');

const memoryCache = new Map();
let diskCache = {};
let diskCachePath = null;

/**
 * Sleep for given milliseconds.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const lastRequest = {};
async function rateLimit(host, minInterval) {
  const now = Date.now();
  const last = lastRequest[host] || 0;
  const wait = minInterval - (now - last);
  if (wait > 0) await sleep(wait);
  lastRequest[host] = Date.now();
}

function initDiskCache(userDataPath) {
  if (!userDataPath) return;
  diskCachePath = path.join(userDataPath, 'http_cache.json');
  try {
    if (fs.existsSync(diskCachePath)) {
      diskCache = JSON.parse(fs.readFileSync(diskCachePath, 'utf-8'));
    }
  } catch { diskCache = {}; }
}

function saveDiskCache() {
  if (!diskCachePath) return;
  try {
    fs.writeFileSync(diskCachePath, JSON.stringify(diskCache), 'utf-8');
  } catch {}
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

/**
 * Cached fetch with retry, timeout and disk cache.
 * @param {string} url - URL to fetch.
 * @param {Object} [opts] - Options.
 * @param {number} [opts.ttl] - Cache TTL in ms.
 * @param {number} [opts.minInterval] - Min interval between requests to same host.
 * @param {number} [opts.timeoutMs] - Request timeout in ms.
 * @param {number} [opts.retries] - Number of retries.
 * @param {boolean} [opts.disk] - Use disk cache.
 * @param {Object} [opts.headers] - Request headers.
 * @returns {Promise<any>} Parsed JSON response.
 */
async function cachedFetch(url, opts = {}) {
  const ttl = opts.ttl || 0;
  const minInterval = opts.minInterval || 0;
  const timeoutMs = opts.timeoutMs || 15000;
  const retries = opts.retries || 2;
  const useDisk = opts.disk || false;
  const host = new URL(url).host;

  // memory cache
  if (ttl > 0) {
    const c = memoryCache.get(url);
    if (c && Date.now() - c.ts < ttl) return c.data;
  }
  // disk cache
  if (useDisk && ttl > 0 && diskCache[url]) {
    const c = diskCache[url];
    if (Date.now() - c.ts < ttl) {
      memoryCache.set(url, c);
      return c.data;
    }
  }

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (minInterval > 0) await rateLimit(host, minInterval);
      const res = await fetchWithTimeout(url, { headers: opts.headers }, timeoutMs);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entry = { ts: Date.now(), data };
      if (ttl > 0) {
        memoryCache.set(url, entry);
        if (useDisk) { diskCache[url] = entry; saveDiskCache(); }
      }
      return data;
    } catch (e) {
      lastError = e;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  // offline fallback: return stale cache
  if (memoryCache.get(url)) return memoryCache.get(url).data;
  if (diskCache[url]) return diskCache[url].data;
  throw lastError || new Error('Network error');
}

module.exports = { cachedFetch, sleep, initDiskCache };
