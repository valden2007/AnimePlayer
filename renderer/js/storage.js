const Storage = {
  get(key, def = null) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  favs: () => Storage.get('favs', []),
  setFavs: (v) => Storage.set('favs', v),
  progress: () => Storage.get('progress', {}),
  setProgress: (v) => Storage.set('progress', v),
  history: () => Storage.get('searchHistory', []),
  setHistory: (v) => Storage.set('searchHistory', v),
  settings: () => Storage.get('settings', { provider: null, quality: '720' }),
  setSettings: (v) => Storage.set('settings', v)
};
window.Storage = Storage;
