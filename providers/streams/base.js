class BaseStreamProvider {
  constructor(id, name) { this.id = id; this.name = name; }
  isAvailable() { return true; }
  async findTitle(shikimoriId, title) { return null; }
  async getVoices(titleId, episode) { return []; }
  async getStream(titleId, episode, voiceId, quality) { return null; }
}
module.exports = { BaseStreamProvider };
