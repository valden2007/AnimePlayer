const { BaseProvider } = require('./base');
const { cachedFetch } = require('./http');

const BASE = 'https://anilibria.top';
const API = BASE + '/api/v1';

function img(u) {
  if (!u) return null;
  if (u.startsWith('http')) return u;
  return BASE + u;
}

function normalizeTitle(r) {
  return {
    id: r.id,
    alias: r.alias,
    provider: 'anilibria',
    name: r.name?.main || r.name?.english || 'Без названия',
    nameEn: r.name?.english || null,
    poster: img(r.poster?.optimized?.src || r.poster?.src || r.poster?.preview),
    description: r.description || '',
    genres: (r.genres || []).map(g => (typeof g === 'string' ? g : g.name)).filter(Boolean),
    year: r.year || null,
    status: r.is_ongoing ? 'Онгоинг' : 'Завершён',
    episodesTotal: r.episodes_total || (Array.isArray(r.episodes) ? r.episodes.length : null),
    rating: r.shikimori?.rating || r.mal?.rating || r.rating?.average || null,
    shikimoriId: r.shikimori?.id || null,
    rutubeId: r.player?.rutube?.id || null,
    youtubeId: r.player?.youtube?.id || null,
    type: r.type?.description || r.type?.value || null
  };
}

function normalizeEpisode(e, releaseId) {
  const streams = {};
  if (e.hls_480) streams['480'] = e.hls_480;
  if (e.hls_720) streams['720'] = e.hls_720;
  if (e.hls_1080) streams['1080'] = e.hls_1080;
  return {
    id: e.id,
    number: e.ordinal || e.sort_order,
    name: e.name || `Серия ${e.ordinal || e.sort_order}`,
    duration: e.duration || null,
    opening: e.opening || null,
    ending: e.ending || null,
    rutubeId: e.rutube_id || null,
    youtubeId: e.youtube_id || null,
    streams
  };
}

/**
 * AniLibria API provider.
 * @extends BaseProvider
 */
class AniLibriaProvider extends BaseProvider {
  constructor() { super('anilibria', 'AniLibria'); }

  async _fetch(url) {
    return cachedFetch(url, {
      headers: { 'User-Agent': 'AnimePlayer/1.0' },
      ttl: 5 * 60 * 1000,
      minInterval: 100,
      disk: true
    });
  }

  /**
   * Search titles.
   * @param {string} query - Search query.
   * @param {number} [page] - Page number.
   * @returns {Promise<Array>} Normalized titles.
   */
  async search(query, page = 1) {
    const url = `${API}/app/search/releases?query=${encodeURIComponent(query)}`;
    const data = await this._fetch(url);
    const list = Array.isArray(data) ? data : (data?.data || data?.items || []);
    return list.map(normalizeTitle);
  }

  /**
   * Get title details.
   * @param {string|number} id - Title id.
   * @returns {Promise<Object>} Normalized title.
   */
  async getTitle(id) {
    const data = await this._fetch(`${API}/anime/releases/${encodeURIComponent(id)}`);
    return normalizeTitle(data);
  }

  /**
   * Get episodes for a title.
   * @param {string|number} id - Title id.
   * @returns {Promise<Array>} Normalized episodes.
   */
  async getEpisodes(id) {
    const data = await this._fetch(`${API}/anime/releases/${encodeURIComponent(id)}`);
    const eps = Array.isArray(data.episodes) ? data.episodes : [];
    return eps.map(e => normalizeEpisode(e, id));
  }

  async getVoices(titleId, episodeId) {
    return [{ id: 'anilibria', name: 'AniLibria' }];
  }

  async getStream(episodeId, quality = '720') {
    const data = await this._fetch(`${API}/anime/releases/episodes/${encodeURIComponent(episodeId)}`);
    const key = `hls_${quality}`;
    if (data[key]) return data[key];
    // fallback to any available
    return data.hls_720 || data.hls_1080 || data.hls_480 || null;
  }

  /**
   * Get catalog.
   * @param {Object} [opts] - Catalog options.
   * @returns {Promise<Array>} Normalized titles.
   */
  async getCatalog(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', opts.page);
    if (opts.limit) params.set('limit', opts.limit || 24);
    else params.set('limit', '24');
    const f = [];
    // build f[...] manually
    const q = [];
    if (opts.genres && opts.genres.length) q.push(`f[genres]=${opts.genres.join(',')}`);
    if (opts.yearFrom) q.push(`f[years][from_year]=${opts.yearFrom}`);
    if (opts.yearTo) q.push(`f[years][to_year]=${opts.yearTo}`);
    if (opts.search) q.push(`f[search]=${encodeURIComponent(opts.search)}`);
    if (opts.sorting) q.push(`f[sorting]=${opts.sorting}`);
    if (opts.type) q.push(`f[types]=${opts.type}`);
    if (opts.publishStatus) q.push(`f[publish_statuses]=${opts.publishStatus}`);
    if (opts.status === 'ongoing') q.push('f[publish_statuses]=IS_ONGOING');
    if (opts.status === 'released') q.push('f[publish_statuses]=IS_NOT_ONGOING');
    const url = `${API}/anime/catalog/releases?${params.toString()}${q.length ? '&' + q.join('&') : ''}`;
    const data = await this._fetch(url);
    let arr = Array.isArray(data) ? data : (data?.data || data?.items || data?.releases || []);
    if (opts.rating) {
      arr = arr.filter(r => {
        const rt = r.shikimori?.rating || r.mal?.rating || r.rating?.average;
        return !rt || Number(rt) >= opts.rating;
      });
    }
    return arr.map(normalizeTitle);
  }

  /**
   * Get genres.
   * @returns {Promise<Array>} Genres list.
   */
  async getGenres() {
    const data = await this._fetch(`${API}/anime/catalog/references/genres`);
    const arr = Array.isArray(data) ? data : (data?.data || []);
    return arr.map(g => ({ id: g.id, name: g.name || g.label }));
  }

  /**
   * Get years range.
   * @returns {Promise<Array<number>>} Years list.
   */
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

module.exports = { AniLibriaProvider };
