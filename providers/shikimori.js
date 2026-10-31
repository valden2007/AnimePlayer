const { BaseProvider } = require('./base');
const { cachedFetch } = require('./http');

const BASE = 'https://shikimori.one';

function img(u) {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  return BASE + u;
}

function normalizeTitle(r) {
  const year = r.aired_on ? parseInt(String(r.aired_on).slice(0, 4), 10) : null;
  return {
    id: r.id,
    alias: null,
    provider: 'shikimori',
    name: r.russian || r.name || 'Без названия',
    nameEn: r.name || null,
    poster: img(r.image?.original || r.image?.preview),
    description: r.description || '',
    genres: (r.genres || []).map(g => g.russian || g.name).filter(Boolean),
    year: year,
    status: r.status === 'ongoing' ? 'Онгоинг' : (r.status === 'released' ? 'Завершён' : (r.status || '')),
    episodesTotal: r.episodes_aired || r.episodes || null,
    rating: r.score ? parseFloat(r.score) : null,
    type: r.kind ? r.kind.toUpperCase() : null
  };
}

class ShikimoriProvider extends BaseProvider {
  constructor() { super('shikimori', 'Shikimori'); }

  async _fetch(url) {
    return cachedFetch(url, {
      headers: { 'User-Agent': 'AnimePlayer/1.0' },
      ttl: 5 * 60 * 1000,
      minInterval: 200
    });
  }

  async search(query, page = 1) {
    const url = `${BASE}/api/animes?search=${encodeURIComponent(query)}&limit=20&page=${page}`;
    const data = await this._fetch(url);
    const list = Array.isArray(data) ? data : (data?.animes || []);
    return list.map(normalizeTitle);
  }

  async getTitle(id) {
    const data = await this._fetch(`${BASE}/api/animes/${encodeURIComponent(id)}`);
    return normalizeTitle(data);
  }

  async getEpisodes(id) {
    // Shikimori не предоставляет прямые потоки; возвращаем пустой список.
    return [];
  }

  async getStream(episodeId, quality) {
    throw new Error('Источник не предоставляет видеопотоки');
  }

  async getCatalog(opts = {}) {
    const params = new URLSearchParams();
    params.set('limit', String(opts.limit || 20));
    if (opts.page) params.set('page', opts.page);
    // kind tv by default
    params.set('kind', 'tv,movie,ova,ona,special');
    if (opts.search) params.set('search', opts.search);
    if (opts.genres && opts.genres.length) params.set('genre', opts.genres.join(','));
    if (opts.yearFrom && opts.yearTo) params.set('season', `${opts.yearFrom}_${opts.yearTo}`);
    else if (opts.yearFrom) params.set('season', String(opts.yearFrom));
    // sorting
    const orderMap = { 'FRESH_AT_DESC': 'aired_on', 'RATING_DESC': 'ranked', 'FAVORITES_DESC': 'popularity' };
    params.set('order', orderMap[opts.sorting] || 'ranked');
    if (opts.status && opts.status !== 'all') params.set('status', opts.status);
    else params.set('status', 'ongoing,released');
    const url = `${BASE}/api/animes?${params.toString()}`;
    const data = await this._fetch(url);
    const arr = Array.isArray(data) ? data : (data?.animes || []);
    return arr.map(normalizeTitle);
  }

  async getGenres() {
    const data = await this._fetch(`${BASE}/api/genres`);
    const arr = Array.isArray(data) ? data : [];
    const seen = new Set();
    const out = [];
    for (const g of arr) {
      if (g.entry_type && g.entry_type !== 'Anime') continue;
      const name = g.russian || g.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ id: g.id, name });
    }
    return out;
  }

  async getYears() {
    const cur = new Date().getFullYear();
    const out = [];
    for (let y = cur; y >= 1960; y--) out.push(y);
    return out;
  }
}

module.exports = { ShikimoriProvider };
