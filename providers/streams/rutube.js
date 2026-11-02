const { BaseStreamProvider } = require('./base');

class RutubeStreamProvider extends BaseStreamProvider {
  constructor() { super('rutube', 'Rutube'); }
  isAvailable() { return true; }
  async findTitle(shikimoriId, title) { return null; } // uses episode.rutubeId
  async getVoices(titleId, episode) {
    if (!episode || !episode.rutubeId) return [];
    return [{ id: 'rutube', name: 'Rutube', providerId: this.id, titleId: null, qualityMax: 1080, type: 'iframe', link: `https://rutube.ru/play/embed/${episode.rutubeId}` }];
  }
  async getStream(titleId, episode, voiceId, quality) {
    if (voiceId === 'rutube' && episode.rutubeId) {
      return { url: `https://rutube.ru/play/embed/${episode.rutubeId}`, type: 'iframe', qualities: [] };
    }
    return null;
  }
}
module.exports = { RutubeStreamProvider };
