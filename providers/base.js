// Единый интерфейс провайдера.
// Каждый провайдер реализует: search, getTitle, getEpisodes, getStream, getCatalog, getGenres, getYears, name, id.

class BaseProvider {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }
  async search(query, page = 1) { throw new Error('not implemented'); }
  async getTitle(id) { throw new Error('not implemented'); }
  async getEpisodes(id) { throw new Error('not implemented'); }
  async getStream(episodeId, quality) { throw new Error('not implemented'); }
  async getVoices(titleId, episodeId) { return []; }
  async getCatalog(opts) { throw new Error('not implemented'); }
  async getGenres() { throw new Error('not implemented'); }
  async getYears() { throw new Error('not implemented'); }
}

module.exports = { BaseProvider };
