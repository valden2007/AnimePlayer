const { AniLibriaProvider } = require('./anilibria');
const { ShikimoriProvider } = require('./shikimori');
const { JikanProvider } = require('./jikan');
const { KitsuProvider } = require('./kitsu');
const { AniListProvider } = require('./anilist');
const { AniLibriaIndexer } = require('./indexer');
const { initDiskCache } = require('./http');

/**
 * Manages data providers with automatic fallback.
 * @param {string} [userDataPath] - Path to user data directory for caching.
 */
class ProviderManager {
  constructor(userDataPath) {
    initDiskCache(userDataPath);
    this.providers = [new AniLibriaProvider(), new ShikimoriProvider(), new JikanProvider(), new KitsuProvider(), new AniListProvider()];
    this.indexer = new AniLibriaIndexer(userDataPath);
    setTimeout(() => this.indexer.ensure().catch(() => {}), 5000);
  }

  /**
   * Get index info.
   * @returns {{ready: boolean, indexCount: number, apiTotal: number}}
   */
  getIndexInfo() { return { ready: this.indexer.ready, indexCount: this.indexer.entries.length, apiTotal: this.indexer.apiTotal }; }

  /**
   * Get similar titles.
   * @param {string|null} providerId - Preferred provider id.
   * @param {string|number} id - Title id.
   * @returns {Promise<{provider: string, data: Array}>}
   */
  async getSimilar(providerId, id) {
    const errs = [];
    for (const p of this._order(providerId)) {
      try {
        const data = await p.getSimilar(id);
        if (data && data.length) return { provider: p.id, data };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    return { provider: providerId, data: [] };
  }
  list() { return this.providers.map(p => ({ id: p.id, name: p.name })); }
  _order(preferredId) {
    if (!preferredId) return [...this.providers];
    const pref = this.providers.find(p => p.id === preferredId);
    const rest = this.providers.filter(p => p.id !== preferredId);
    return pref ? [pref, ...rest] : [...this.providers];
  }
  _get(id) { return this.providers.find(p => p.id === id) || this.providers[0]; }

  /**
   * Search across providers with fallback.
   * @param {string|null} preferredId - Preferred provider id.
   * @param {string} query - Search query.
   * @param {number} [page] - Page number.
   * @returns {Promise<{provider: string, data: Array}>}
   */
  async search(preferredId, query, page) {
    const errs = [];
    for (const p of this._order(preferredId)) {
      try {
        const data = await p.search(query, page);
        return { provider: p.id, data, partial: false };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    // Fallback: offline index for anilibria
    if (preferredId === 'anilibria' || !preferredId) {
      await this.indexer.ensure();
      if (this.indexer.ready && this.indexer.entries.length) {
        const q = (query || '').toLowerCase().trim();
        const matched = this.indexer.entries.filter(e => {
          return e.names.some(n => n.includes(q));
        }).slice(0, 30).map(e => ({
          id: e.id,
          alias: null,
          provider: 'anilibria',
          name: e.names[0] || 'Без названия',
          nameEn: null,
          poster: null,
          description: '',
          genres: [],
          year: e.year,
          status: e.hasStream ? 'Онгоинг' : 'Завершён',
          episodesTotal: e.episodes,
          rating: null,
          type: e.type,
          hasStream: e.hasStream,
          anilibriaId: e.id
        }));
        if (matched.length) {
          return { provider: 'anilibria', data: matched, partial: true };
        }
      }
    }
    throw new Error('Поиск недоступен. ' + errs.join(' | '));
  }

  /**
   * Get title details with fallback.
   * @param {string|null} preferredId - Preferred provider id.
   * @param {string|number} id - Title id.
   * @returns {Promise<{provider: string, data: Object}>}
   */
  async getTitle(preferredId, id) {
    const errs = [];
    for (const p of this._order(preferredId)) {
      try {
        const data = await p.getTitle(id);
        return { provider: p.id, data };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    throw new Error('Не удалось получить тайтл. ' + errs.join(' | '));
  }

  /**
   * Get episodes with fallback.
   * @param {string|null} preferredId - Preferred provider id.
   * @param {string|number} id - Title id.
   * @returns {Promise<{provider: string, data: Array}>}
   */
  async getEpisodes(preferredId, id) {
    const errs = [];
    for (const p of this._order(preferredId)) {
      try {
        const data = await p.getEpisodes(id);
        return { provider: p.id, data };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    throw new Error('Не удалось получить эпизоды. ' + errs.join(' | '));
  }

  /**
   * Get catalog with fallback.
   * @param {string|null} preferredId - Preferred provider id.
   * @param {Object} [opts] - Catalog options.
   * @returns {Promise<{provider: string, data: Array}>}
   */
  async getCatalog(preferredId, opts) {
    const errs = [];
    for (const p of this._order(preferredId)) {
      try {
        const data = await p.getCatalog(opts);
        let out = data;
        if (p.id === 'shikimori') {
          await this.indexer.ensure();
          out = data.map(t => {
            const m = this.indexer.lookup(t);
            return Object.assign({}, t, { hasStream: !!m, anilibriaId: m ? m.id : null });
          });
          if (opts.onlyWithStream) out = out.filter(t => t.hasStream);
        } else {
          out = data.map(t => Object.assign({}, t, { hasStream: true, anilibriaId: t.id }));
        }
        return { provider: p.id, data: out, partial: false };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    // Fallback: offline index for anilibria
    if (preferredId === 'anilibria' || !preferredId) {
      await this.indexer.ensure();
      if (this.indexer.ready && this.indexer.entries.length) {
        let entries = [...this.indexer.entries];
        // filter by genre? index has no genres, skip
        if (opts.yearFrom) entries = entries.filter(e => !e.year || e.year >= Number(opts.yearFrom));
        if (opts.yearTo) entries = entries.filter(e => !e.year || e.year <= Number(opts.yearTo));
        if (opts.onlyWithStream) entries = entries.filter(e => e.hasStream);
        // sort
        if (opts.sorting === 'RATING_DESC') entries.sort((a,b) => (b.id||0)-(a.id||0));
        else entries.sort((a,b) => (b.year||0)-(a.year||0) || (b.id||0)-(a.id||0));
        const page = opts.page || 1;
        const limit = opts.limit || 20;
        const start = (page - 1) * limit;
        const sliced = entries.slice(start, start + limit);
        const out = sliced.map(e => ({
          id: e.id,
          alias: null,
          provider: 'anilibria',
          name: e.names[0] || 'Без названия',
          nameEn: null,
          poster: null,
          description: '',
          genres: [],
          year: e.year,
          status: e.hasStream ? 'Онгоинг' : 'Завершён',
          episodesTotal: e.episodes,
          rating: null,
          type: e.type,
          hasStream: e.hasStream,
          anilibriaId: e.id
        }));
        return { provider: 'anilibria', data: out, partial: true };
      }
    }
    throw new Error('Каталог недоступен. ' + errs.join(' | '));
  }

  /**
   * Get genres with fallback.
   * @param {string|null} preferredId - Preferred provider id.
   * @returns {Promise<{provider: string, data: Array}>}
   */
  async getGenres(preferredId) {
    const errs = [];
    for (const p of this._order(preferredId)) {
      try {
        const data = await p.getGenres();
        return { provider: p.id, data };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    throw new Error('Жанры недоступны. ' + errs.join(' | '));
  }

  /**
   * Get years with fallback.
   * @param {string|null} preferredId - Preferred provider id.
   * @returns {Promise<{provider: string, data: Array}>}
   */
  async getYears(preferredId) {
    const errs = [];
    for (const p of this._order(preferredId)) {
      try {
        const data = await p.getYears();
        return { provider: p.id, data };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    throw new Error('Годы недоступны. ' + errs.join(' | '));
  }

  async getVoices(providerId, titleId, episodeId) {
    const p = this._get(providerId);
    try {
      const voices = await p.getVoices(titleId, episodeId);
      return { provider: p.id, data: voices };
    } catch (e) {
      return { provider: p.id, data: [] };
    }
  }

  async getStream(providerId, episodeId, quality) {
    const p = this._get(providerId);
    try {
      const url = await p.getStream(episodeId, quality);
      return { provider: p.id, url };
    } catch (e) {
      throw new Error(`${p.name}: ${e.message}`);
    }
  }
}

module.exports = { ProviderManager };
