const { BaseStreamProvider } = require('./base');

class YouTubeStreamProvider extends BaseStreamProvider {
  constructor() { super('youtube', 'YouTube'); }
  isAvailable() { return true; }
  async findTitle(shikimoriId, title) { return null; }
  async getVoices(titleId, episode) {
    if (!episode || !episode.youtubeId) return [];
    return [{ id: 'youtube', name: 'YouTube', providerId: this.id, titleId: null, qualityMax: 1080, type: 'iframe', link: `https://www.youtube.com/embed/${episode.youtubeId}` }];
  }
  async getStream(titleId, episode, voiceId, quality) {
    if (voiceId === 'youtube' && episode.youtubeId) {
      return { url: `https://www.youtube.com/embed/${episode.youtubeId}`, type: 'iframe', qualities: [] };
    }
    return null;
  }
}
module.exports = { YouTubeStreamProvider };
