const { BaseProvider } = require('./base');
const { cachedFetch } = require('./http');

const BASE = 'https://kitsu.io/api/edge';

function normalizeTitle(r) {
  const a = r.attributes || {};
  const year = a.startDate ? parseInt(String(a.startDate).slice(0, 4), 10) : null;
  return {
    id: r.id,
    alias: null,
    provider: 'kitsu',
    name: a.titles?.ru_jp || a.titles?.en_jp || a.canonicalTitle || 'Без названия',
    nameEn: a.canonicalTitle || null,
    poster: a.posterImage?.large || a.posterImage?.medium || a.posterImage?.small || null,
    description: a.synopsis || a.description || '',
    genres: [],
    year: year,
    status: a.status === 'current' ? 'Онгоинг' : (a.status === 'finished' ? 'Завершён' : (a.status || '')),
    episodesTotal: a.episodeCount || null,
    rating: a.averageRating ? parseFloat(a.averageRating) : null,
    type: a.subtype || a.showType || null,
    shikimoriId: null
  };
}

class KitsuProvider extends BaseProvider {
  constructor() { super('kitsu', 'Kitsu'); }

  async _fetch(url) {
    return cachedFetch(url, {
      headers: { 'Accept': 'application/vnd.api+json', 'User-Agent': 'AnimePlayer/1.0' },
      ttl: 5 * 60 * 1000,
      minInterval: 200,
      timeoutMs: 10000,
      retries: 1
    });
  }

  async search(query, page = 1) {
    const url = `${BASE}/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=20&page[offset]=${(page - 1) * 20}`;
    const data = await this._fetch(url);
    const list = data?.data || [];
    return list.map(normalizeTitle);
  }

  async getTitle(id) {
    const data = await this._fetch(`${BASE}/anime/${encodeURIComponent(id)}`);
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
    params.set('page[limit]', String(opts.limit || 20));
    if (opts.page) params.set('page[offset]', String((opts.page - 1) * (opts.limit || 20)));
    if (opts.search) params.set('filter[text]', opts.search);
    if (opts.sorting === 'RATING_DESC') params.set('sort', '-averageRating');
    if (opts.sorting === 'FRESH_AT_DESC') params.set('sort', '-startDate');
    const url = `${BASE}/anime?${params.toString()}`;
    const data = await this._fetch(url);
    const arr = data?.data || [];
    return arr.map(normalizeTitle);
  }

  async getGenres() {
    return [];
  }

  async getYears() {
    const cur = new Date().getFullYear();
    const out = [];
    for (let y = cur; y >= 1960; y--) out.push(y);
    return out;
  }

  async getSimilar(id) {
    return [];
  }
}

module.exports = { KitsuProvider };
