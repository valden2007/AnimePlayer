const { BaseProvider } = require('./base');
const { cachedFetch } = require('./http');

const BASE = 'https://api.jikan.moe/v4';

function img(u) {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  return u;
}

function normalizeTitle(r) {
  const year = r.aired?.from ? parseInt(String(r.aired.from).slice(0, 4), 10) : null;
  return {
    id: r.mal_id,
    alias: null,
    provider: 'jikan',
    name: r.title || r.title_english || 'Без названия',
    nameEn: r.title_english || null,
    poster: img(r.images?.jpg?.large_image_url || r.images?.jpg?.image_url),
    description: r.synopsis || '',
    genres: (r.genres || []).map(g => g.name).filter(Boolean),
    year: year,
    status: r.status === 'Currently Airing' ? 'Онгоинг' : (r.status === 'Finished Airing' ? 'Завершён' : (r.status || '')),
    episodesTotal: r.episodes || null,
    rating: r.score || null,
    type: r.type || null,
    shikimoriId: null
  };
}

class JikanProvider extends BaseProvider {
  constructor() { super('jikan', 'Jikan (MyAnimeList)'); }

  async _fetch(url) {
    return cachedFetch(url, {
      headers: { 'User-Agent': 'AnimePlayer/1.0' },
      ttl: 5 * 60 * 1000,
      minInterval: 350, // Jikan rate limit ~3 req/sec
      timeoutMs: 10000,
      retries: 1
    });
  }

  async search(query, page = 1) {
    const url = `${BASE}/anime?q=${encodeURIComponent(query)}&limit=20&page=${page}&sfw=true`;
    const data = await this._fetch(url);
    const list = data?.data || [];
    return list.map(normalizeTitle);
  }

  async getTitle(id) {
    const data = await this._fetch(`${BASE}/anime/${encodeURIComponent(id)}/full`);
    return normalizeTitle(data?.data || data);
  }

  async getEpisodes(id) {
    return [];
  }

  async getStream(episodeId, quality) {
    return null;
  }

  async getCatalog(opts = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(opts.limit || 20));
    if (opts.page) params.set('page', opts.page);
    if (opts.search) params.set('q', opts.search);
    if (opts.genres && opts.genres.length) params.set('genres', opts.genres.join(','));
    if (opts.status === 'ongoing') params.set('status', 'airing');
    if (opts.status === 'released') params.set('status', 'complete');
    if (opts.sorting === 'RATING_DESC') params.set('order_by', 'score');
    if (opts.sorting === 'FRESH_AT_DESC') params.set('order_by', 'start_date');
    params.set('sort', 'desc');
    params.set('sfw', 'true');
    const url = `${BASE}/anime?${params.toString()}`;
    const data = await this._fetch(url);
    const arr = data?.data || [];
    return arr.map(normalizeTitle);
  }

  async getGenres() {
    // Jikan genres
    try {
      const data = await this._fetch(`${BASE}/genres/anime`);
      const arr = data?.data || [];
      return arr.map(g => ({ id: g.mal_id, name: g.name }));
    } catch {
      return [];
    }
  }

  async getYears() {
    const cur = new Date().getFullYear();
    const out = [];
    for (let y = cur; y >= 1960; y--) out.push(y);
    return out;
  }

  async getSimilar(id) {
    try {
      const data = await this._fetch(`${BASE}/anime/${encodeURIComponent(id)}/recommendations`);
      const arr = data?.data || [];
      return arr.map(r => normalizeTitle(r.entry)).filter(Boolean);
    } catch {
      return [];
    }
  }
}

module.exports = { JikanProvider };
