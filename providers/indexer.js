const fs = require('fs');
const path = require('path');

function normalize(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

class AniLibriaIndexer {
  constructor(userDataPath) {
    this.userDataPath = userDataPath || process.cwd();
    this.cacheFile = path.join(this.userDataPath, 'anilibria_index.json');
    this.entries = [];
    this.apiTotal = 0;
    this.ready = false;
    this.building = false;
  }

  async ensure() {
    if (this.ready) return;
    if (this.building) {
      while (this.building) await new Promise(r => setTimeout(r, 100));
      return;
    }
    this.building = true;
    try {
      // try cache
      if (fs.existsSync(this.cacheFile)) {
        const raw = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
        const age = Date.now() - (raw.ts || 0);
        if (age < 24 * 60 * 60 * 1000 && Array.isArray(raw.entries)) {
          this.entries = raw.entries;
          this.ready = true;
          this.building = false;
          // refresh in background
          this.refresh().catch(() => {});
          return;
        }
      }
      await this.refresh();
    } catch (e) {
      this.ready = true;
    } finally {
      this.building = false;
    }
  }

  async refresh() {
    const BASE = 'https://anilibria.top/api/v1';
    const entries = [];
    let page = 1;
    while (true) {
      const url = `${BASE}/anime/catalog/releases?page=${page}&limit=50&f[sorting]=YEAR_ASC`;
      const res = await fetch(url, { headers: { 'User-Agent': 'AnimePlayer/1.0' } });
      if (!res.ok) break;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.data || []);
      if (!arr.length) break;
      for (const r of arr) {
        const names = [r.name?.main, r.name?.english, r.name?.alternative].filter(Boolean);
        entries.push({
          id: r.id,
          names: names.map(normalize),
          year: r.year || null,
          type: r.type?.value || null,
          episodes: r.episodes_total || (Array.isArray(r.episodes) ? r.episodes.length : null),
          hasStream: Array.isArray(r.episodes) ? r.episodes.length > 0 : (r.episodes_total || 0) > 0
        });
      }
      const meta = data?.meta;
      if (meta?.total_items) this.apiTotal = meta.total_items;
      const totalPages = meta?.last_page || meta?.pages;
      if (totalPages && page >= totalPages) break;
      if (!totalPages && arr.length < 50) break;
      page++;
      await new Promise(r => setTimeout(r, 200));
    }
    this.entries = entries;
    this.apiTotal = entries.length;
    this.ready = true;
    try {
      fs.mkdirSync(this.userDataPath, { recursive: true });
      fs.writeFileSync(this.cacheFile, JSON.stringify({ ts: Date.now(), entries }));
    } catch {}
  }

  lookup(title) {
    if (!this.ready || !title) return null;
    const names = [title.name, title.nameEn].filter(Boolean).map(normalize);
    const year = title.year;
    const type = title.type;
    let best = null, bestScore = 0;
    for (const e of this.entries) {
      if (year && e.year && e.year !== year) continue;
      if (type && e.type && e.type !== type && !(type === 'TV' && e.type === 'TV')) continue;
      let score = 0;
      for (const n of names) {
        if (!n) continue;
        if (e.names.includes(n)) score += 10;
        else if (e.names.some(en => en.includes(n) || n.includes(en))) score += 3;
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (bestScore < 8) return null;
    // episode count sanity
    if (title.episodesTotal && best.episodes && Math.abs(best.episodes - title.episodesTotal) > Math.max(5, title.episodesTotal * 0.3)) {
      // still allow if name exact
      if (bestScore < 10) return null;
    }
    return best;
  }
}

module.exports = { AniLibriaIndexer, normalize };
