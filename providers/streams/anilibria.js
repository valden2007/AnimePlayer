const { BaseStreamProvider } = require('./base');

class AniLibriaStreamProvider extends BaseStreamProvider {
  constructor() { super('anilibria', 'AniLibria'); }
  isAvailable() { return true; }
  async findTitle(shikimoriId, title) {
    if (title && title.anilibriaId) return title.anilibriaId;
    if (title && title.id && title.provider === 'anilibria') return title.id;
    return null;
  }
  async getVoices(titleId, episode) {
    return [{ id: 'anilibria', name: 'AniLibria', providerId: this.id, titleId, qualityMax: 1080, type: 'hls' }];
  }
  async getStream(titleId, episode, voiceId, quality) {
    // quality handled by caller using episode.streams; return metadata only
    return { url: null, type: 'hls', qualities: Object.keys(episode.streams || {}) };
  }
}
module.exports = { AniLibriaStreamProvider };
