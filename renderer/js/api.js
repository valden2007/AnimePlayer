const API = {
  async providers() { return window.api.providersList(); },
  async search(provider, query, page = 1) { return window.api.search(provider, query, page); },
  async title(provider, id) { return window.api.getTitle(provider, id); },
  async episodes(provider, id) { return window.api.getEpisodes(provider, id); },
  async similar(provider, id) { return window.api.getSimilar(provider, id); },
  async stream(provider, episodeId, quality) { return window.api.getStream(provider, episodeId, quality); },
  async voices(provider, titleId, episodeId) { return window.api.getVoices(provider, titleId, episodeId); },
  async diagSources(title) { return window.api.diagSources(title); },
  async capturePage() { return window.api.capturePage(); },
  async indexInfo() { return window.api.getIndexInfo(); },
  async library() { return window.api.getLibrary(); },
  async saveLibrary(data) { return window.api.setLibrary(data); },
  async catalog(provider, opts) { return window.api.getCatalog(provider, opts); },
  async genres(provider) { return window.api.getGenres(provider); },
  async years(provider) { return window.api.getYears(provider); }
};
window.API = API;
