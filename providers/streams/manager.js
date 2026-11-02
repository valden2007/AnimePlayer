const { AniLibriaStreamProvider } = require('./anilibria');
const { RutubeStreamProvider } = require('./rutube');
const { YouTubeStreamProvider } = require('./youtube');

class StreamManager {
  constructor() {
    this.providers = [new AniLibriaStreamProvider(), new RutubeStreamProvider(), new YouTubeStreamProvider()];
  }
  async getVoices(title, episode) {
    const available = this.providers.filter(p => p.isAvailable());
    const tasks = available.map(async p => {
      try {
        const titleId = await p.findTitle(title?.shikimoriId || (title?.provider === 'shikimori' ? title.id : null), title);
        if (!titleId) return [];
        const voices = await p.getVoices(titleId, episode?.number || episode?.ordinal || 1);
        return voices.map(v => Object.assign({}, v, { providerId: p.id, providerName: p.name, titleId }));
      } catch { return []; }
    });
    const settled = await Promise.all(tasks.map(t => Promise.race([t, new Promise(r => setTimeout(() => r([]), 6000))])));
    return settled.flat();
  }
}
module.exports = { StreamManager };
