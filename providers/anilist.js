const { BaseProvider } = require('./base');
const { cachedFetch } = require('./http');

const BASE = 'https://graphql.anilist.co';

function normalizeTitle(r) {
  const title = r.title || {};
  return {
    id: r.id,
    alias: null,
    provider: 'anilist',
    name: title.english || title.romaji || title.native || 'Без названия',
    nameEn: title.english || title.romaji || null,
    poster: r.coverImage?.large || r.coverImage?.medium || null,
    description: r.description || '',
    genres: r.genres || [],
    year: r.startDate?.year || null,
    status: r.status === 'RELEASING' ? 'Онгоинг' : (r.status === 'FINISHED' ? 'Завершён' : (r.status || '')),
    episodesTotal: r.episodes || null,
    rating: r.averageScore ? r.averageScore / 10 : null,
    type: r.format || null,
    shikimoriId: null
  };
}

class AniListProvider extends BaseProvider {
  constructor() { super('anilist', 'AniList'); }

  async _fetch(query, variables) {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'AnimePlayer/1.0' },
      body: JSON.stringify({ query, variables })
    });
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
    return res.json();
  }

  async search(q, page = 1) {
    const query = `query ($search: String, $page: Int) { Page(page: $page, perPage: 20) { media(search: $search, type: ANIME) { id title { romaji english native } description coverImage { large medium } genres startDate { year } status episodes averageScore format } } }`;
    const data = await this._fetch(query, { search: q, page });
    const list = data?.data?.Page?.media || [];
    return list.map(normalizeTitle);
  }

  async getTitle(id) {
    const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id title { romaji english native } description coverImage { large medium } genres startDate { year } status episodes averageScore format } }`;
    const data = await this._fetch(query, { id: Number(id) });
    return normalizeTitle(data?.data?.Media || {});
  }

  async getEpisodes(id) {
    return [];
  }

  async getStream(episodeId, quality) {
    return null;
  }

  async getCatalog(opts = {}) {
    let query = 'query ($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { media(type: ANIME, sort: POPULARITY_DESC) { id title { romaji english native } description coverImage { large medium } genres startDate { year } status episodes averageScore format } } }';
    const data = await this._fetch(query, { page: opts.page || 1, perPage: opts.limit || 20 });
    const arr = data?.data?.Page?.media || [];
    return arr.map(normalizeTitle);
  }

  async getGenres() {
    return [];
  }

  async getYears() {
    const cur = new Date().getFullYear();
    const out = [];
    for (let y = cur; y >= 1960; y--) out.push(y);
    return out;
  }

  async getSimilar(id) {
    const query = `query ($id: Int) { Media(id: $id, type: ANIME) { recommendations { nodes { mediaRecommendation { id title { romaji english native } description coverImage { large medium } genres startDate { year } status episodes averageScore format } } } } }`;
    const data = await this._fetch(query, { id: Number(id) });
    const arr = data?.data?.Media?.recommendations?.nodes || [];
    return arr.map(n => normalizeTitle(n.mediaRecommendation)).filter(Boolean);
  }
}

module.exports = { AniListProvider };
