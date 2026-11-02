/**
 * Main application controller.
 * @namespace App
 */
const App = {
  state: {
    provider: null,
    view: 'home',
    currentTitle: null,
    currentEpisodes: [],
    streamProvider: null,
    streamTitleId: null,
    searchTimer: null,
    filterTimer: null,
    lastQuery: '',
    previousView: 'home',
    previousScroll: 0,
    resultsPage: 1,
    resultsHasMore: false,
    resultsTotal: 0,
    resultsItems: [],
    newestPage: 1,
    newestHasMore: false,
    popularPage: 1,
    popularHasMore: false
  },

  async init() {
    console.log('App.init started');
    Player.init();
    const list = await API.providers();
    const sel = document.getElementById('providerSelect');
    sel.innerHTML = '';
    for (const p of list) {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      sel.appendChild(o);
    }
    const saved = Storage.settings().provider;
    if (saved && list.find(p => p.id === saved)) {
      sel.value = saved;
      this.state.provider = saved;
    } else {
      this.state.provider = list[0]?.id || null;
      sel.value = this.state.provider;
    }
    sel.addEventListener('change', () => {
      this.state.provider = sel.value;
      Storage.setSettings(Object.assign(Storage.settings(), { provider: sel.value }));
      this.loadFilters();
      if (this.state.view === 'home') this.loadHome();
    });

    this.state.library = (await API.library()) || { items: {}, collections: {} };
    if (!this.state.library.items) this.state.library.items = {};
    if (!this.state.library.collections) this.state.library.collections = {};
    this.migrateLibrary();
    await this.loadFilters();
    this.bindEvents();
    await this.loadHome();
    this.showView('home');

    // event delegation for cards
    document.getElementById('app').addEventListener('click', (e) => {
      const card = e.target.closest('.card');
      if (!card) return;
      const provider = card.dataset.provider;
      const id = card.dataset.id;
      if (provider && id) {
        this.openTitle(provider, id);
      }
    });
  },

  bindEvents() {
    document.getElementById('logo').addEventListener('click', () => this.showView('home'));
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(this.state.searchTimer);
      if (!q) { this.hideSuggestions(); return; }
      this.state.searchTimer = setTimeout(() => this.doSearchSuggest(q), 300);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (q) this.openSearch(q);
      }
    });
    // filters auto-apply
    ['genreFilter','yearFromFilter','yearToFilter','statusFilter','sortFilter','onlyStreamFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.scheduleFilterApply());
    });
    document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());

    document.getElementById('backBtn').addEventListener('click', () => this.goBack());
    document.getElementById('backFromPlayer').addEventListener('click', () => {
      if (this.state.currentTitle) this.openTitle(this.state.provider, this.state.currentTitle.id); else this.showView('home');
    });
    const backFromLib = document.getElementById('backFromLib');
    if (backFromLib) backFromLib.addEventListener('click', () => this.showView('home'));

    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('libBtn').addEventListener('click', () => this.showView('library'));
    document.getElementById('contBtn').addEventListener('click', () => this.showView('favorites'));
    const favToggle = document.getElementById('favToggle');
    if (favToggle) favToggle.addEventListener('click', () => this.toggleFav());
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) statusSelect.addEventListener('change', () => this.setStatus(statusSelect.value));
    const favStar = document.getElementById('favStar');
    if (favStar) favStar.addEventListener('click', () => this.toggleFavoriteStar());

    // player controls stop propagation
    const controlsBar = document.getElementById('controlsBar');
    if (controlsBar) controlsBar.addEventListener('click', (e) => e.stopPropagation());
    document.getElementById('playPause').addEventListener('click', (e) => { e.stopPropagation(); Player.togglePlay(); });
    document.getElementById('seek').addEventListener('input', (e) => {
      e.stopPropagation();
      const v = Player.video;
      if (v.duration) v.currentTime = v.duration * (e.target.value / 100);
    });
    document.getElementById('volume').addEventListener('input', (e) => { e.stopPropagation(); Player.setVolume(parseFloat(e.target.value)); });
    document.getElementById('muteBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      Player.video.muted = !Player.video.muted;
      document.getElementById('muteBtn').textContent = Player.video.muted ? '🔇' : '🔊';
    });
    document.getElementById('qualitySelect').addEventListener('change', (e) => { e.stopPropagation(); Player.playQuality(e.target.value); });
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) voiceSelect.addEventListener('change', (e) => { e.stopPropagation(); Player.changeVoice(e.target.value); });
    document.getElementById('fsBtn').addEventListener('click', (e) => { e.stopPropagation(); Player.fullscreen(); });
    document.getElementById('nextEpBtn').addEventListener('click', (e) => { e.stopPropagation(); Player.nextEpisode(); });
    const markBtn = document.getElementById('markCompletedBtn');
    if (markBtn) markBtn.addEventListener('click', (e) => { e.stopPropagation(); this.markCompleted(); });
    document.getElementById('prevEp').addEventListener('click', () => Player.prevEpisode());
    document.getElementById('nextEp').addEventListener('click', () => Player.nextEpisode());

    document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMoreResults());
    document.getElementById('loadMoreNewest').addEventListener('click', () => this.loadMoreNewest());
    document.getElementById('loadMorePopular').addEventListener('click', () => this.loadMorePopular());
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      this.renderLibrary();
    }));
    const libSearch = document.getElementById('libSearch');
    if (libSearch) libSearch.addEventListener('input', () => this.renderLibrary());
    const libSort = document.getElementById('libSort');
    if (libSort) libSort.addEventListener('change', () => this.renderLibrary());

    // hotkeys
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('settingsModal');
        if (modal && !modal.classList.contains('hidden')) {
          modal.classList.add('hidden');
          return;
        }
      }
      if (this.state.view !== 'player') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); Player.togglePlay(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); Player.seekBy(-10); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); Player.seekBy(10); }
      else if (e.key === 'f' || e.key === 'F') { Player.fullscreen(); }
      else if (e.key === 'm' || e.key === 'M') { Player.video.muted = !Player.video.muted; }
      else if (e.key === 's' || e.key === 'S') { Player.skipSegment(); }
    });

    Player.onEnded = () => {
      const c = Player.current;
      if (c && c.index + 1 >= c.episodes.length) {
        const btn = document.getElementById('markCompletedBtn');
        if (btn) {
          btn.classList.remove('hidden');
          clearTimeout(btn._t);
          btn._t = setTimeout(() => btn.classList.add('hidden'), 10000);
        }
      } else {
        Player.nextEpisode();
      }
    };
  },

  async loadFilters() {
    // genres from active provider
    try {
      const g = await API.genres(this.state.provider);
      const sel = document.getElementById('genreFilter');
      sel.innerHTML = '<option value="">Все жанры</option>';
      for (const x of (g.data || [])) {
        const o = document.createElement('option');
        o.value = x.id; o.textContent = x.name;
        sel.appendChild(o);
      }
    } catch {}
    // years: full range 1960..current
    const cur = new Date().getFullYear();
    for (const id of ['yearFromFilter','yearToFilter']) {
      const sel = document.getElementById(id);
      sel.innerHTML = `<option value="">${id === 'yearFromFilter' ? 'Год от' : 'Год до'}</option>`;
      for (let y = cur; y >= 1960; y--) {
        const o = document.createElement('option');
        o.value = y; o.textContent = y;
        sel.appendChild(o);
      }
    }
  },

  scheduleFilterApply() {
    clearTimeout(this.state.filterTimer);
    this.state.filterTimer = setTimeout(() => this.loadHome(), 400);
  },

  resetFilters() {
    document.getElementById('genreFilter').value = '';
    document.getElementById('yearFromFilter').value = '';
    document.getElementById('yearToFilter').value = '';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('sortFilter').value = 'FRESH_AT_DESC';
    this.loadHome();
  },

  filtersActive() {
    return !!(document.getElementById('genreFilter').value ||
      document.getElementById('yearFromFilter').value ||
      document.getElementById('yearToFilter').value ||
      document.getElementById('statusFilter').value !== 'all');
  },

  showView(name) {
    this.state.view = name;
    for (const v of ['Home','Search','Title','Player','Library']) {
      const el = document.getElementById('view' + v);
      if (el) el.classList.toggle('hidden', v.toLowerCase() !== name.toLowerCase());
    }
    if (name === 'library') this.renderLibrary();
  },

  async loadHome() {
    this.showView('home');
    const genre = document.getElementById('genreFilter').value;
    const yearFrom = document.getElementById('yearFromFilter').value;
    const yearTo = document.getElementById('yearToFilter').value;
    const sorting = document.getElementById('sortFilter').value;

    const newestSection = document.getElementById('newestSection');
    const popularSection = document.getElementById('popularSection');
    const resultsSection = document.getElementById('resultsSection');

    if (!this.filtersActive()) {
      // normal home
      newestSection.classList.remove('hidden');
      popularSection.classList.remove('hidden');
      resultsSection.classList.add('hidden');

      const newestGrid = document.getElementById('newestGrid');
      newestGrid.innerHTML = this.skeletons(12);
      this.state.newestPage = 1;
      try {
        const curY = new Date().getFullYear();
        const opts = { limit: 12, page: 1, sorting: 'FRESH_AT_DESC', status: 'all', yearFrom: String(curY - 1), yearTo: String(curY) };
        const r = await API.catalog(this.state.provider, opts);
        let items = r.data || [];
        items = items.filter(t => !t.year || (t.year >= curY - 1 && t.year <= curY));
        this.renderGrid(newestGrid, items);
        this.state.newestHasMore = (r.data || []).length >= 12;
        const btnN = document.getElementById('loadMoreNewest');
        btnN.classList.toggle('hidden', !this.state.newestHasMore);
      } catch (e) {
        newestGrid.innerHTML = `<div class="empty">${e.message}</div>`;
      }
      const popularGrid = document.getElementById('popularGrid');
      popularGrid.innerHTML = this.skeletons(12);
      this.state.popularPage = 1;
      try {
        const opts = { limit: 12, page: 1, sorting: 'RATING_DESC', status: 'released', yearTo: String(new Date().getFullYear()) };
        const r = await API.catalog(this.state.provider, opts);
        let items = r.data || [];
        const curY = new Date().getFullYear();
        items = items.filter(t => !t.year || t.year <= curY);
        this.renderGrid(popularGrid, items);
        this.state.popularHasMore = (r.data || []).length >= 12;
        const btnP = document.getElementById('loadMorePopular');
        btnP.classList.toggle('hidden', !this.state.popularHasMore);
      } catch (e) {
        popularGrid.innerHTML = `<div class="empty">${e.message}</div>`;
      }
    } else {
      // filtered results
      newestSection.classList.add('hidden');
      popularSection.classList.add('hidden');
      resultsSection.classList.remove('hidden');

      this.state.resultsPage = 1;
      this.state.resultsItems = [];
      const grid = document.getElementById('resultsGrid');
      grid.innerHTML = this.skeletons(8);
      document.getElementById('resultsEmpty').classList.add('hidden');
      document.getElementById('loadMoreBtn').classList.add('hidden');

      const opts = { limit: 20, page: 1, sorting };
      if (genre) opts.genres = [genre];
      if (yearFrom) opts.yearFrom = yearFrom;
      if (yearTo) opts.yearTo = yearTo;
      const st = document.getElementById('statusFilter').value;
      if (st && st !== 'all') opts.status = st;
      else opts.status = 'all';
      opts.onlyWithStream = document.getElementById('onlyStreamFilter').checked;

      try {
        const r = await API.catalog(this.state.provider, opts);
        const items = r.data || [];
        this.state.resultsItems = items;
        this.state.resultsHasMore = items.length >= 20;
        grid.innerHTML = '';
        if (!items.length) {
          document.getElementById('resultsEmpty').classList.remove('hidden');
        } else {
          this.renderGrid(grid, items);
        }
        document.getElementById('resultsCount').textContent = `(${items.length}${this.state.resultsHasMore ? '+' : ''})`;
        if (this.state.resultsHasMore) document.getElementById('loadMoreBtn').classList.remove('hidden');
      } catch (e) {
        grid.innerHTML = `<div class="empty">${e.message}</div>`;
      }
    }
  },

  async loadMoreResults() {
    this.state.resultsPage++;
    const genre = document.getElementById('genreFilter').value;
    const yearFrom = document.getElementById('yearFromFilter').value;
    const yearTo = document.getElementById('yearToFilter').value;
    const sorting = document.getElementById('sortFilter').value;
    const opts = { limit: 20, page: this.state.resultsPage, sorting };
    if (genre) opts.genres = [genre];
    if (yearFrom) opts.yearFrom = yearFrom;
    if (yearTo) opts.yearTo = yearTo;
    const st = document.getElementById('statusFilter').value;
    if (st && st !== 'all') opts.status = st;
    else opts.status = 'all';
    opts.onlyWithStream = document.getElementById('onlyStreamFilter').checked;
    const btn = document.getElementById('loadMoreBtn');
    btn.disabled = true; btn.textContent = 'Загрузка...';
    try {
      const r = await API.catalog(this.state.provider, opts);
      const items = r.data || [];
      const grid = document.getElementById('resultsGrid');
      this.renderGridAppend(grid, items);
      this.state.resultsItems = this.state.resultsItems.concat(items);
      this.state.resultsHasMore = items.length >= 20;
      document.getElementById('resultsCount').textContent = `(${this.state.resultsItems.length}${this.state.resultsHasMore ? '+' : ''})`;
      if (this.state.resultsHasMore) {
        btn.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Показать ещё';
      } else {
        btn.classList.add('hidden');
      }
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Показать ещё';
      showToast(e.message);
    }
  },

  async loadMoreNewest() {
    this.state.newestPage++;
    const btn = document.getElementById('loadMoreNewest');
    btn.disabled = true; btn.textContent = 'Загрузка...';
    try {
      const curY = new Date().getFullYear();
      const opts = { limit: 12, page: this.state.newestPage, sorting: 'FRESH_AT_DESC', status: 'all', yearFrom: String(curY - 1), yearTo: String(curY) };
      const r = await API.catalog(this.state.provider, opts);
      let items = r.data || [];
      items = items.filter(t => !t.year || (t.year >= curY - 1 && t.year <= curY));
      const grid = document.getElementById('newestGrid');
      this.renderGridAppend(grid, items);
      this.state.newestHasMore = (r.data || []).length >= 12;
      if (this.state.newestHasMore) { btn.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Показать ещё'; }
      else btn.classList.add('hidden');
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Показать ещё';
      showToast(e.message);
    }
  },

  async loadMorePopular() {
    this.state.popularPage++;
    const btn = document.getElementById('loadMorePopular');
    btn.disabled = true; btn.textContent = 'Загрузка...';
    try {
      const opts = { limit: 12, page: this.state.popularPage, sorting: 'RATING_DESC', status: 'released', yearTo: String(new Date().getFullYear()) };
      const r = await API.catalog(this.state.provider, opts);
      let items = r.data || [];
      const curY = new Date().getFullYear();
      items = items.filter(t => !t.year || t.year <= curY);
      const grid = document.getElementById('popularGrid');
      this.renderGridAppend(grid, items);
      this.state.popularHasMore = (r.data || []).length >= 12;
      if (this.state.popularHasMore) { btn.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'Показать ещё'; }
      else btn.classList.add('hidden');
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Показать ещё';
      showToast(e.message);
    }
  },

  renderGridAppend(container, items) {
    container.classList.remove('skeleton-grid');
    for (const t of items) {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.provider = t.provider || this.state.provider;
      card.dataset.id = t.id;
      card.innerHTML = `
        <img src="${t.poster || ''}" alt="" loading="lazy" decoding="async">
        ${t.hasStream ? '<span class="badge-stream">Есть серии</span>' : ''}
        <div class="info">
          <div class="title">${escapeHtml(t.name)}</div>
          <div class="sub">${t.year || ''} ${t.type || ''}</div>
        </div>`;
      const img = card.querySelector('img');
      if (img) {
        img.onerror = () => { img.src = posterPlaceholder(t.name); img.onerror = null; };
        if (!t.poster) img.src = posterPlaceholder(t.name);
      }
      container.appendChild(card);
    }
  },

  skeletons(n) {
    return Array(n).fill('<div class="card"><img alt=""><div class="info"><div class="title">&nbsp;</div></div></div>').join('');
  },

  renderGrid(container, items) {
    container.classList.remove('skeleton-grid');
    container.innerHTML = '';
    if (!items || !items.length) {
      container.innerHTML = '<div class="empty">Пусто</div>';
      return;
    }
    for (const t of items) {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.provider = t.provider || this.state.provider;
      card.dataset.id = t.id;
      card.innerHTML = `
        <img src="${t.poster || ''}" alt="" loading="lazy" decoding="async">
        ${t.hasStream ? '<span class="badge-stream">Есть серии</span>' : ''}
        <div class="info">
          <div class="title">${escapeHtml(t.name)}</div>
          <div class="sub">${t.year || ''} ${t.type || ''}</div>
        </div>`;
      const img = card.querySelector('img');
      if (img) {
        img.onerror = () => { img.src = posterPlaceholder(t.name); img.onerror = null; };
        if (!t.poster) img.src = posterPlaceholder(t.name);
      }
      container.appendChild(card);
    }
  },

  async doSearchSuggest(q) {
    try {
      const r = await API.search(this.state.provider, q);
      const items = r.data || [];
      const sug = document.getElementById('searchSuggestions');
      sug.innerHTML = '';
      for (const t of items.slice(0, 8)) {
        const d = document.createElement('div');
        d.textContent = t.name;
        d.dataset.provider = t.provider || this.state.provider;
        d.dataset.id = t.id;
        d.addEventListener('click', () => {
          document.getElementById('searchInput').value = t.name;
          this.hideSuggestions();
          this.openTitle(t.provider || this.state.provider, t.id);
        });
        sug.appendChild(d);
      }
      sug.classList.toggle('hidden', items.length === 0);
    } catch {
      this.hideSuggestions();
    }
  },

  hideSuggestions() {
    document.getElementById('searchSuggestions').classList.add('hidden');
  },

  openSearch(q) {
    this.hideSuggestions();
    this.state.lastQuery = q;
    const h = Storage.history();
    if (!h.includes(q)) { h.unshift(q); Storage.setHistory(h.slice(0, 20)); }
    this.showView('search');
    document.getElementById('searchTitle').textContent = `Результаты: ${q}`;
    const grid = document.getElementById('searchGrid');
    grid.innerHTML = this.skeletons(8);
    document.getElementById('searchEmpty').classList.add('hidden');
    API.search(this.state.provider, q).then(r => {
      const items = r.data || [];
      if (!items.length) {
        grid.innerHTML = '';
        document.getElementById('searchEmpty').classList.remove('hidden');
      } else {
        this.renderGrid(grid, items);
      }
      if (r.provider && r.provider !== this.state.provider) {
        this.state.provider = r.provider;
        document.getElementById('providerSelect').value = r.provider;
      }
    }).catch(e => {
      grid.innerHTML = `<div class="empty">${e.message}</div>`;
    });
  },

  async openTitle(provider, id) {
    this.state.previousView = this.state.view;
    this.state.previousScroll = window.scrollY;
    this.state.provider = provider || this.state.provider;
    document.getElementById('providerSelect').value = this.state.provider;
    this.showView('title');
    document.getElementById('titleName').textContent = 'Загрузка...';
    document.getElementById('titleDesc').textContent = '';
    document.getElementById('titleGenres').innerHTML = '';
    document.getElementById('titleMeta').textContent = '';
    document.getElementById('titlePoster').src = '';
    document.getElementById('episodesList').innerHTML = this.skeletons(6);

    try {
      const t = await API.title(this.state.provider, id);
      this.state.currentTitle = t.data;
      this.state.currentTitle.provider = t.provider;
      const prov = t.provider;
      this.state.provider = prov;
      document.getElementById('providerSelect').value = prov;
      const title = t.data;
      document.getElementById('titleName').textContent = title.name;
      document.getElementById('titleName').classList.remove('skeleton-text');
      document.getElementById('titlePoster').src = title.poster || '';
      document.getElementById('titlePoster').classList.remove('skeleton');
      document.getElementById('titleDesc').textContent = title.description || '';
      document.getElementById('titleMeta').textContent = [title.year, title.type, title.status, title.rating ? `★ ${title.rating}` : ''].filter(Boolean).join(' • ');
      document.getElementById('titleGenres').innerHTML = (title.genres || []).map(g => `<span>${escapeHtml(g)}</span>`).join('');
      this.updateFavToggle();
      const addColBtn = document.getElementById('addCollectionBtn');
      if (addColBtn) addColBtn.onclick = () => {
        const name = prompt('Название коллекции');
        if (name) { this.createCollection(name); this.addToCollection(name, title); showToast('Добавлено в коллекцию'); }
      };
      const item = this.getLibraryItem(title);
      const statusSelect = document.getElementById('statusSelect');
      if (statusSelect) statusSelect.value = item && item.status ? item.status : '';
      const favStar = document.getElementById('favStar');
      if (favStar) favStar.textContent = (item && item.favorite) ? '★' : '☆';

      // episodes: if shikimori, try find on anilibria for streams
      let episodes = [];
      let epProvider = prov;
      if (prov === 'shikimori') {
        try {
          const sr = await API.search('anilibria', title.name);
          const candidates = sr.data || [];
          const match = candidates.find(c => !title.year || c.year === title.year) || candidates[0];
          if (match) {
            const er = await API.episodes('anilibria', match.id);
            episodes = er.data || [];
            epProvider = 'anilibria';
            this.state.streamProvider = 'anilibria';
            this.state.streamTitleId = match.id;
          }
        } catch {}
      } else {
        const er = await API.episodes(prov, id);
        episodes = er.data || [];
        this.state.streamProvider = prov;
        this.state.streamTitleId = id;
      }
      this.state.currentEpisodes = episodes;
      // similar
      const similarGrid = document.getElementById('similarGrid');
      similarGrid.innerHTML = '';
      const sid = (prov === 'shikimori') ? title.id : (title.shikimoriId || null);
      if (sid) {
        try {
          const sr = await API.similar('shikimori', sid);
          const items = sr.data || [];
          if (items.length) this.renderGrid(similarGrid, items);
          else similarGrid.innerHTML = '<div class="empty">Нет похожих</div>';
        } catch {
          similarGrid.innerHTML = '';
        }
      } else {
        similarGrid.innerHTML = '<div class="empty">Нет данных</div>';
      }

      const list = document.getElementById('episodesList');
      list.innerHTML = '';
      if (!episodes.length) {
        list.innerHTML = '<div class="empty">Нет доступных серий для этого тайтла</div>';
      } else {
        episodes.forEach((e, i) => {
          const row = document.createElement('div');
          row.className = 'ep';
          row.dataset.provider = epProvider;
          row.dataset.id = e.id;
          row.innerHTML = `<span class="num">${e.number || i+1}</span><span class="name">${escapeHtml(e.name)}</span>`;
          row.addEventListener('click', () => this.openPlayer(epProvider, title, e, episodes));
          list.appendChild(row);
        });
      }
    } catch (e) {
      console.error('openTitle error:', e);
      document.getElementById('titleName').textContent = 'Ошибка';
      document.getElementById('episodesList').innerHTML = `<div class="empty">${escapeHtml(e && e.stack ? e.stack : (e && e.message ? e.message : String(e)))}</div>`;
      showToast(e && e.message ? e.message : String(e));
    }
  },

  goBack() {
    const view = this.state.previousView || 'home';
    this.showView(view);
    if (view === 'home') {
      // filters preserved in selects; reload to ensure data
      this.loadHome();
    }
    setTimeout(() => window.scrollTo(0, this.state.previousScroll || 0), 50);
  },

  async openPlayer(provider, title, episode, episodes) {
    this.state.provider = provider || this.state.provider;
    const item = this.getLibraryItem(title);
    if (!item || !item.status) this.setLibraryItem(title, { status: 'watching' });
    this.showView('player');
    const voices = [{ id: 'anilibria', name: 'AniLibria' }];
    if (episode.rutubeId) voices.push({ id: 'rutube', name: 'Rutube', type: 'iframe', link: 'https://rutube.ru/play/embed/' + episode.rutubeId });
    if (episode.youtubeId) voices.push({ id: 'youtube', name: 'YouTube', type: 'iframe', link: 'https://www.youtube.com/embed/' + episode.youtubeId });
    Player.load(provider, title, episode, episodes, voices);
  },

  libraryKey(title) {
    const name = String(title.name || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim().replace(/\s+/g,' ');
    return name + '|' + (title.year || '');
  },

  migrateLibrary() {
    const lib = this.state.library;
    if (!lib.collections) lib.collections = {};
    if (Object.keys(lib.items).length) return;
    const favs = Storage.favs();
    for (const f of favs) {
      const key = String(f.name||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim().replace(/\s+/g,' ') + '|' + (f.year || '');
      lib.items[key] = { provider: f.provider, id: f.id, name: f.name, poster: f.poster, status: 'favorite', favorite: true, addedAt: Date.now() };
    }
    const prog = Storage.progress();
    for (const p of Object.values(prog)) {
      // cannot get title name easily; skip migration of progress into library
    }
    API.saveLibrary(lib).catch(()=>{});
  },

  getLibraryItem(title) {
    const key = this.libraryKey(title);
    return this.state.library.items[key] || null;
  },

  setLibraryItem(title, patch) {
    const key = this.libraryKey(title);
    const cur = this.state.library.items[key] || { provider: title.provider || this.state.provider, id: title.id, name: title.name, poster: title.poster, addedAt: Date.now() };
    this.state.library.items[key] = Object.assign(cur, patch, { updatedAt: Date.now() });
    API.saveLibrary(this.state.library).catch(()=>{});
    return this.state.library.items[key];
  },

  toggleFavoriteStar() {
    const title = this.state.currentTitle;
    if (!title) return;
    const item = this.getLibraryItem(title) || this.setLibraryItem(title, {});
    item.favorite = !item.favorite;
    this.setLibraryItem(title, { favorite: item.favorite });
    document.getElementById('favStar').textContent = item.favorite ? '★' : '☆';
    showToast(item.favorite ? 'В избранном' : 'Убрано из избранного');
  },

  markCompleted() {
    const title = this.state.currentTitle;
    if (!title) return;
    this.setLibraryItem(title, { status: 'completed' });
    document.getElementById('markCompletedBtn').classList.add('hidden');
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) statusSelect.value = 'completed';
    showToast('Отмечено как просмотренное');
  },

  createCollection(name) {
    if (!name) return;
    if (!this.state.library.collections[name]) {
      this.state.library.collections[name] = { name, items: [], createdAt: Date.now() };
      API.saveLibrary(this.state.library).catch(()=>{});
    }
  },

  addToCollection(name, title) {
    const col = this.state.library.collections[name];
    if (!col) return;
    const key = this.libraryKey(title);
    if (!col.items.includes(key)) {
      col.items.push(key);
      API.saveLibrary(this.state.library).catch(()=>{});
    }
  },

  removeFromCollection(name, title) {
    const col = this.state.library.collections[name];
    if (!col) return;
    const key = this.libraryKey(title);
    col.items = col.items.filter(k => k !== key);
    API.saveLibrary(this.state.library).catch(()=>{});
  },

  renderCollections() {
    const list = document.getElementById('collectionsList');
    if (!list) return;
    list.innerHTML = '';
    const cols = Object.values(this.state.library.collections || {});
    if (!cols.length) { list.innerHTML = '<div class="empty">Нет коллекций</div>'; return; }
    for (const col of cols) {
      const div = document.createElement('div');
      div.className = 'collection';
      div.innerHTML = `<h3>${escapeHtml(col.name)} (${col.items.length})</h3>`;
      const grid = document.createElement('div');
      grid.className = 'grid';
      for (const key of col.items) {
        const item = this.state.library.items[key];
        if (!item) continue;
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.provider = item.provider;
        card.dataset.id = item.id;
        card.innerHTML = `<img src="${item.poster || ''}" alt=""><div class="info"><div class="title">${escapeHtml(item.name)}</div></div>`;
        grid.appendChild(card);
      }
      div.appendChild(grid);
      list.appendChild(div);
    }
  },

  setStatus(status) {
    const title = this.state.currentTitle;
    if (!title || !status) return;
    this.setLibraryItem(title, { status });
    // auto set watching on first view already handled elsewhere
  },

  toggleFav() {
    const title = this.state.currentTitle;
    if (!title) return;
    const favs = Storage.favs();
    const idx = favs.findIndex(f => f.id === title.id && f.provider === (title.provider || this.state.provider));
    if (idx >= 0) favs.splice(idx, 1);
    else favs.unshift({ id: title.id, provider: title.provider || this.state.provider, name: title.name, poster: title.poster });
    Storage.setFavs(favs);
    this.updateFavToggle();
    showToast(idx >= 0 ? 'Удалено из избранного' : 'Добавлено в избранное');
  },

  updateFavToggle() {
    const title = this.state.currentTitle;
    if (!title) return;
    const item = this.getLibraryItem(title);
    const favStar = document.getElementById('favStar');
    if (favStar) favStar.textContent = (item && item.favorite) ? '★' : '☆';
  },

  openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');
    const firstInput = modal.querySelector('input, button, select');
    if (firstInput) firstInput.focus();
    API.indexInfo().then(r => {
      const d = r.data || r;
      document.getElementById('indexInfo').textContent = `Индекс AniLibria: ${d.indexCount || 0} / ${d.apiTotal || 0} (готов: ${d.ready ? 'да' : 'нет'})`;
    }).catch(() => {});
    const s = Storage.settings();
    document.getElementById('autoSkipOpening').checked = !!s.autoSkipOpening;
    document.getElementById('autoSkipEnding').checked = !!s.autoSkipEnding;
    document.getElementById('autoNextAfterEnding').checked = s.autoNextAfterEnding !== false;
    document.getElementById('skipSecondsInput').value = s.skipSeconds || 85;
    ['autoSkipOpening','autoSkipEnding','autoNextAfterEnding'].forEach(id => {
      document.getElementById(id).onchange = () => {
        const ns = Storage.settings();
        ns[id] = document.getElementById(id).checked;
        Storage.setSettings(ns);
      };
    });
    document.getElementById('skipSecondsInput').onchange = () => {
      const ns = Storage.settings();
      ns.skipSeconds = Number(document.getElementById('skipSecondsInput').value) || 85;
      Storage.setSettings(ns);
    };
    document.getElementById('closeSettingsBtn').onclick = () => modal.classList.add('hidden');
    document.getElementById('diagSourcesBtn').onclick = async () => {
      const out = document.getElementById('diagOutput');
      out.textContent = 'Проверка...';
      const r = await API.diagSources('Атака титанов');
      const lines = (r.data || []).map(x => `${x.name}: ${x.ok ? 'OK' : 'FAIL'} | HTTP ${x.status} | ${x.time} мс | результатов: ${x.count}${x.error ? ' | ' + x.error : ''}`);
      out.textContent = lines.join('\\n');
    };
    document.getElementById('copyDiagBtn').onclick = async () => {
      const text = document.getElementById('diagOutput').textContent;
      try { await navigator.clipboard.writeText(text); showToast('Скопировано'); } catch { showToast('Не удалось скопировать'); }
    };
    document.getElementById('exportLibBtn').onclick = () => {
      const data = JSON.stringify(this.state.library, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'anime-library.json'; a.click();
      URL.revokeObjectURL(url);
    };
    document.getElementById('importLibBtn').onclick = () => document.getElementById('importLibFile').click();
    document.getElementById('importLibFile').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        this.state.library = data;
        await API.saveLibrary(data);
        showToast('Импортировано');
        this.renderLibrary();
      } catch { showToast('Ошибка импорта'); }
    };
  },

  renderStats() {
    const block = document.getElementById('statsBlock');
    if (!block) return;
    const items = Object.values(this.state.library.items || {});
    const byStatus = { watching: 0, planned: 0, completed: 0, on_hold: 0 };
    for (const it of items) if (byStatus[it.status] !== undefined) byStatus[it.status]++;
    const favCount = items.filter(x => x.favorite).length;
    const prog = Storage.progress();
    const watchedEps = Object.keys(prog).length;
    let totalSec = 0;
    for (const p of Object.values(prog)) totalSec += (p.time || 0);
    const hours = (totalSec / 3600).toFixed(1);
    // favorite genres
    const genreCount = {};
    for (const it of items) {
      // genres not stored in library item; skip
    }
    block.innerHTML = `
      <div class="stat"><div class="num">${items.length}</div><div class="label">Всего</div></div>
      <div class="stat"><div class="num">${byStatus.watching}</div><div class="label">Смотрю</div></div>
      <div class="stat"><div class="num">${byStatus.planned}</div><div class="label">В планах</div></div>
      <div class="stat"><div class="num">${byStatus.completed}</div><div class="label">Просмотрено</div></div>
      <div class="stat"><div class="num">${byStatus.on_hold}</div><div class="label">Отложено</div></div>
      <div class="stat"><div class="num">${favCount}</div><div class="label">Избранное</div></div>
      <div class="stat"><div class="num">${watchedEps}</div><div class="label">Серий начато</div></div>
      <div class="stat"><div class="num">${hours}</div><div class="label">Часов просмотрено</div></div>
    `;
  },

  renderLibrary() {
    this.renderStats();
    const tab = document.querySelector('.tab.active')?.dataset.tab || 'all';
    const grid = document.getElementById('libGrid');
    const collectionsView = document.getElementById('collectionsView');
    if (tab === 'collections') {
      grid.classList.add('hidden');
      collectionsView.classList.remove('hidden');
      this.renderCollections();
      // wire create button
      const btn = document.getElementById('createCollectionBtn');
      if (btn) btn.onclick = () => {
        const name = document.getElementById('newCollectionName').value.trim();
        if (name) { this.createCollection(name); document.getElementById('newCollectionName').value = ''; this.renderCollections(); }
      };
      return;
    } else {
      grid.classList.remove('hidden');
      collectionsView.classList.add('hidden');
    }
    grid.innerHTML = '';
    const q = (document.getElementById('libSearch')?.value || '').toLowerCase();
    const sort = document.getElementById('libSort')?.value || 'added';
    let items = Object.entries(this.state.library.items || {}).map(([key, v]) => ({ key, ...v }));
    if (tab === 'favorite') items = items.filter(x => x.favorite);
    else if (tab !== 'all') items = items.filter(x => x.status === tab);
    if (q) items = items.filter(x => (x.name || '').toLowerCase().includes(q));
    if (sort === 'name') items.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    else items.sort((a,b) => (b.addedAt||0) - (a.addedAt||0));
    // update tab counts
    const allItems = Object.values(this.state.library.items || {});
    document.querySelectorAll('.tab').forEach(t => {
      const tabName = t.dataset.tab;
      let count = 0;
      if (tabName === 'all') count = allItems.length;
      else if (tabName === 'favorite') count = allItems.filter(x => x.favorite).length;
      else count = allItems.filter(x => x.status === tabName).length;
      t.textContent = t.textContent.split(' (')[0] + ` (${count})`;
    });
    if (!items.length) { grid.innerHTML = '<div class="empty">Пусто</div>'; }
    else {
      for (const it of items) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.provider = it.provider;
        card.dataset.id = it.id;
        const badge = it.status ? `<span class="badge-stream">${it.status}</span>` : '';
        card.innerHTML = `
          <img src="${it.poster || ''}" alt="" loading="lazy">
          ${badge}
          <div class="info">
            <div class="title">${escapeHtml(it.name)}</div>
          </div>`;
        const img = card.querySelector('img');
        if (img) { img.onerror = () => { img.src = posterPlaceholder(it.name); img.onerror = null; }; if (!it.poster) img.src = posterPlaceholder(it.name); }
        grid.appendChild(card);
      }
    }
    // continue watching
    const contGrid = document.getElementById('contGrid');
    contGrid.innerHTML = '';
    const prog = Storage.progress();
    const pitems = Object.values(prog).sort((a,b) => b.ts - a.ts).slice(0, 12);
    if (!pitems.length) contGrid.innerHTML = '<div class="empty">Пусто</div>';
    else {
      for (const p of pitems) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.provider = p.provider;
        card.dataset.id = p.titleId;
        card.innerHTML = `<div class="info"><div class="title">${escapeHtml(p.titleName || 'Аниме')}</div><div class="sub">Серия ${p.episodeId} • ${formatTime(p.time)} / ${formatTime(p.duration || 0)}</div></div>`;
        contGrid.appendChild(card);
      }
    }
    const hist = document.getElementById('historyList');
    hist.innerHTML = '';
    for (const q of Storage.history()) {
      const d = document.createElement('div');
      d.textContent = q;
      d.addEventListener('click', () => { document.getElementById('searchInput').value = q; this.openSearch(q); });
      hist.appendChild(d);
    }
  },

  renderFavorites() {
    const favGrid = document.getElementById('favGrid');
    favGrid.innerHTML = '';
    const favs = Storage.favs();
    if (!favs.length) favGrid.innerHTML = '<div class="empty">Пусто</div>';
    else {
      for (const f of favs) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.provider = f.provider;
        card.dataset.id = f.id;
        card.innerHTML = `<img src="${f.poster || ''}" alt=""><div class="info"><div class="title">${escapeHtml(f.name)}</div></div>`;
        favGrid.appendChild(card);
      }
    }
    const contGrid = document.getElementById('contGrid');
    contGrid.innerHTML = '';
    const prog = Storage.progress();
    const items = Object.values(prog).sort((a,b) => b.ts - a.ts).slice(0, 12);
    if (!items.length) contGrid.innerHTML = '<div class="empty">Пусто</div>';
    else {
      for (const p of items) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.provider = p.provider;
        card.dataset.id = p.titleId;
        card.innerHTML = `<div class="info"><div class="title">${escapeHtml(p.titleName || 'Аниме')}</div><div class="sub">Серия ${p.episodeId} • ${formatTime(p.time)} / ${formatTime(p.duration || 0)}</div></div>`;
        contGrid.appendChild(card);
      }
    }
    const hist = document.getElementById('historyList');
    hist.innerHTML = '';
    for (const q of Storage.history()) {
      const d = document.createElement('div');
      d.textContent = q;
      d.addEventListener('click', () => {
        document.getElementById('searchInput').value = q;
        this.openSearch(q);
      });
      hist.appendChild(d);
    }
  }
};

function posterPlaceholder(name) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="100%" height="100%" fill="#1e1e28"/><text x="50%" y="50%" fill="#9a9ab0" font-family="sans-serif" font-size="14" text-anchor="middle">${String(name||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 3000);
}
window.showToast = showToast;
window.App = App;

document.addEventListener('DOMContentLoaded', () => App.init());
