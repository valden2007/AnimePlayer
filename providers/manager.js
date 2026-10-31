const { AniLibriaProvider } = require('./anilibria');
const { ShikimoriProvider } = require('./shikimori');
const { AniLibriaIndexer } = require('./indexer');

class ProviderManager {
  constructor(userDataPath) {
    this.providers = [new AniLibriaProvider(), new ShikimoriProvider()];
    this.indexer = new AniLibriaIndexer(userDataPath);
    this.indexer.ensure().catch(() => {});
  }

  getIndexInfo() { return { ready: this.indexer.ready, indexCount: this.indexer.entries.length, apiTotal: this.indexer.apiTotal }; }
  list() { return this.providers.map(p => ({ id: p.id, name: p.name })); }
  _order(preferredId) {
    if (!preferredId) return [...this.providers];
    const pref = this.providers.find(p => p.id === preferredId);
    const rest = this.providers.filter(p => p.id !== preferredId);
    return pref ? [pref, ...rest] : [...this.providers];
  }
  _get(id) { return this.providers.find(p => p.id === id) || this.providers[0]; }

  async search(preferredId, query, page) {
    const errs = [];
    for (const p of this._order(preferredId)) {
      try {
        const data = await p.search(query, page);
        return { provider: p.id, data };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    throw new Error('Поиск недоступен. ' + errs.join(' | '));
  }

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
        return { provider: p.id, data: out };
      } catch (e) { errs.push(`${p.name}: ${e.message}`); }
    }
    throw new Error('Каталог недоступен. ' + errs.join(' | '));
  }

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
