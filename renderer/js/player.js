const Player = {
  video: null,
  hls: null,
  current: null,
  onEnded: null,
  clickTimer: null,
  hideTimer: null,
  upscaleMode: 'off',
  gl: null,
  upscaleProgram: null,
  upscaleCanvas: null,
  upscaleTexture: null,
  upscaleRaf: null,
  upscaleFps: [],
  _resizeObserver: null,

  init() {
    this.video = document.getElementById('video');
    const wrap = document.getElementById('playerWrap');
    this.video.addEventListener('timeupdate', () => this.saveProgress());
    this.video.addEventListener('ended', () => { if (this.onEnded) this.onEnded(); });
    this.video.addEventListener('loadedmetadata', () => this.updateTime());
    this.video.addEventListener('timeupdate', () => this.updateTime());
    this.video.addEventListener('timeupdate', () => this.handleSkipSegments());
    document.getElementById('skipBtn').addEventListener('click', (e) => { e.stopPropagation(); this.skipSegment(); });

    // click handling on wrapper
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.controls')) return;
      if (this.clickTimer) clearTimeout(this.clickTimer);
      this.clickTimer = setTimeout(() => {
        this.togglePlay();
        this.showPlayIcon();
        if (document.activeElement) document.activeElement.blur();
      }, 250);
    });
    wrap.addEventListener('dblclick', (e) => {
      if (e.target.closest('.controls')) return;
      if (this.clickTimer) { clearTimeout(this.clickTimer); this.clickTimer = null; }
      this.fullscreen();
    });

    // auto-hide controls
    wrap.addEventListener('mousemove', () => this.resetHideTimer());
    wrap.addEventListener('mouseleave', () => this.resetHideTimer());
    document.addEventListener('fullscreenchange', () => { this.resetHideTimer(); this.syncCanvasSize(); });

    const ups = document.getElementById('upscaleSelect');
    if (ups) ups.addEventListener('change', (e) => this.setUpscale(e.target.value));
    const speedSel = document.getElementById('speedSelect');
    if (speedSel) speedSel.addEventListener('change', (e) => this.setSpeed(parseFloat(e.target.value)));
    const subSel = document.getElementById('subtitleSelect');
    if (subSel) subSel.addEventListener('change', (e) => this.setSubtitle(e.target.value));

    this.initUpscale();
  },

  resetHideTimer() {
    const wrap = document.getElementById('playerWrap');
    wrap.classList.remove('hide-ui');
    if (this.hideTimer) clearTimeout(this.hideTimer);
    if (document.fullscreenElement) {
      this.hideTimer = setTimeout(() => wrap.classList.add('hide-ui'), 3000);
    }
  },

  showPlayIcon() {
    const icon = document.getElementById('playIcon');
    icon.textContent = this.video.paused ? '▶' : '⏸';
    icon.classList.add('show');
    clearTimeout(this._iconTimer);
    this._iconTimer = setTimeout(() => icon.classList.remove('show'), 600);
  },

  // --- upscale (WebGL) ---
  initUpscale() {
    this.upscaleCanvas = document.getElementById('upscaleCanvas');
    const gl = this.upscaleCanvas.getContext('webgl2') || this.upscaleCanvas.getContext('webgl');
    this.gl = gl;
    if (!gl) {
      const sel = document.getElementById('upscaleSelect');
      if (sel) { sel.disabled = true; sel.title = 'WebGL недоступен'; }
      return;
    }
    const vs = 'attribute vec2 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; void main(){ gl_Position=vec4(a_position,0,1); v_texCoord=a_texCoord; }';
    const fs = 'precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_image; uniform vec2 u_resolution; uniform float u_strength; void main(){ vec2 px=1.0/u_resolution; vec4 c=texture2D(u_image,v_texCoord); vec4 tl=texture2D(u_image,v_texCoord+vec2(-px.x,-px.y)); vec4 t=texture2D(u_image,v_texCoord+vec2(0,-px.y)); vec4 tr=texture2D(u_image,v_texCoord+vec2(px.x,-px.y)); vec4 l=texture2D(u_image,v_texCoord+vec2(-px.x,0)); vec4 r=texture2D(u_image,v_texCoord+vec2(px.x,0)); vec4 bl=texture2D(u_image,v_texCoord+vec2(-px.x,px.y)); vec4 b=texture2D(u_image,v_texCoord+vec2(0,px.y)); vec4 br=texture2D(u_image,v_texCoord+vec2(px.x,px.y)); vec4 lap=(tl+t+tr+l+r+bl+b+br-8.0*c); gl_FragColor=clamp(c-lap*u_strength,0.0,1.0); }';
    const prog = gl.createProgram();
    const vsh = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vsh, vs); gl.compileShader(vsh);
    const fsh = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fsh, fs); gl.compileShader(fsh);
    gl.attachShader(prog, vsh); gl.attachShader(prog, fsh); gl.linkProgram(prog);
    this.upscaleProgram = prog;
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, 1,1,1,0]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position'); const tc = gl.getAttribLocation(prog, 'a_texCoord');
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(tc); gl.vertexAttribPointer(tc, 2, gl.FLOAT, false, 16, 8);
    this.upscaleTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.upscaleTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // ResizeObserver for canvas sync
    this.syncCanvasSize();
    const wrap = document.getElementById('playerWrap');
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.syncCanvasSize());
      this._resizeObserver.observe(wrap);
    } else {
      window.addEventListener('resize', () => this.syncCanvasSize());
      document.addEventListener('fullscreenchange', () => this.syncCanvasSize());
    }
  },

  syncCanvasSize() {
    if (!this.gl || !this.upscaleCanvas) return;
    const wrap = document.getElementById('playerWrap');
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth || 640;
    const cssH = wrap.clientHeight || 360;
    const expectedW = Math.round(cssW * dpr);
    const expectedH = Math.round(cssH * dpr);
    const canvas = this.upscaleCanvas;
    // Invariant check
    if (canvas.width !== expectedW || canvas.height !== expectedH) {
      console.warn('Canvas size mismatch: expected', expectedW, expectedH, 'got', canvas.width, canvas.height);
      canvas.width = expectedW;
      canvas.height = expectedH;
    }
    const gl = this.gl;
    gl.viewport(0, 0, canvas.width, canvas.height);
    this._lastCanvasSize = { w: canvas.width, h: canvas.height, cssW, cssH, dpr };
  },

  setUpscale(mode) {
    this.upscaleMode = mode;
    if (mode === 'off') {
      if (this.upscaleRaf) cancelAnimationFrame(this.upscaleRaf);
      this.upscaleRaf = null;
      document.getElementById('upscaleCanvas').classList.add('hidden');
      document.getElementById('video').classList.remove('hidden');
      document.getElementById('video').style.opacity = '1';
      return;
    }
    if (!this.gl) {
      showToast('Улучшение недоступно (нет WebGL)');
      document.getElementById('upscaleSelect').value = 'off';
      return;
    }
    document.getElementById('video').style.opacity = '0';
    document.getElementById('upscaleCanvas').classList.remove('hidden');
    this.syncCanvasSize();
    this.upscaleFps = [];
    this.upscaleLoop();
  },

  upscaleLoop() {
    const gl = this.gl;
    const video = this.video;
    const canvas = this.upscaleCanvas;
    if (!video || video.paused || video.ended) {
      this.upscaleRaf = requestAnimationFrame(() => this.upscaleLoop());
      return;
    }
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 360;
    this.syncCanvasSize();
    const cw = canvas.width;
    const ch = canvas.height;
    const containerAspect = cw / ch;
    const videoAspect = vw / vh;
    let vpW, vpH, vpX, vpY;
    if (containerAspect > videoAspect) {
      vpH = ch;
      vpW = Math.round(vpH * videoAspect);
      vpX = Math.round((cw - vpW) / 2);
      vpY = 0;
    } else {
      vpW = cw;
      vpH = Math.round(vpW / videoAspect);
      vpX = 0;
      vpY = Math.round((ch - vpH) / 2);
    }
    gl.viewport(vpX, vpY, vpW, vpH);
    gl.useProgram(this.upscaleProgram);
    gl.bindTexture(gl.TEXTURE_2D, this.upscaleTexture);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch {}
    const strength = this.upscaleMode === 'strong' ? 0.6 : 0.3;
    gl.uniform1f(gl.getUniformLocation(this.upscaleProgram, 'u_strength'), strength);
    gl.uniform2f(gl.getUniformLocation(this.upscaleProgram, 'u_resolution'), vw, vh);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const now = performance.now();
    this.upscaleFps.push(now);
    while (this.upscaleFps.length && now - this.upscaleFps[0] > 2000) this.upscaleFps.shift();
    if (this.upscaleFps.length > 60) {
      const fps = (this.upscaleFps.length - 1) / ((now - this.upscaleFps[0]) / 1000);
      if (fps < 20) {
        showToast('Улучшение отключено: низкий FPS');
        this.setUpscale('off');
        document.getElementById('upscaleSelect').value = 'off';
        return;
      }
    }
    this.upscaleRaf = requestAnimationFrame(() => this.upscaleLoop());
  },

  async load(provider, title, episode, episodes, voices) {
    const idx = episodes.findIndex(e => e.id === episode.id);
    const voiceList = voices && voices.length ? voices : [{ id: 'anilibria', name: 'AniLibria' }];
    const savedVoice = (Storage.settings().voices || {})[title.id];
    let currentVoice = savedVoice && voiceList.find(v => v.id === savedVoice) ? savedVoice : voiceList[0].id;
    this.current = { provider, title, episode, episodes, index: idx >= 0 ? idx : 0, voices: voiceList, voice: currentVoice };
    this._skippedOpening = false;
    this._skippedEnding = false;
    this._autoNextTriggered = false;
    document.getElementById('epLabel').textContent = `${title.name} — ${episode.name}`;

    const vsel = document.getElementById('voiceSelect');
    if (vsel) {
      vsel.innerHTML = '';
      for (const v of voiceList) {
        const o = document.createElement('option');
        o.value = v.id; o.textContent = v.name;
        vsel.appendChild(o);
      }
      vsel.value = currentVoice;
      vsel.onchange = () => this.changeVoice(vsel.value);
    }

    const sel = document.getElementById('qualitySelect');
    sel.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto'; autoOpt.textContent = 'Авто';
    sel.appendChild(autoOpt);
    const qs = Object.keys(episode.streams || {}).sort((a, b) => Number(a) - Number(b));
    for (const q of qs) {
      const o = document.createElement('option');
      o.value = q; o.textContent = (q === '2160' ? '2160p (4K)' : q + 'p');
      sel.appendChild(o);
    }
    const preferred = Storage.settings().quality || 'auto';
    if ([...sel.options].some(o => o.value === preferred)) sel.value = preferred;
    else sel.value = 'auto';

    const voiceObj = this.current.voices.find(v => v.id === this.current.voice);
    if (voiceObj && voiceObj.type === 'iframe') {
      document.getElementById('video').classList.add('hidden');
      const iframe = document.getElementById('iframePlayer');
      iframe.classList.remove('hidden');
      if (voiceObj.link) iframe.src = voiceObj.link;
    } else {
      document.getElementById('iframePlayer').classList.add('hidden');
      document.getElementById('video').classList.remove('hidden');
      await this.playQuality(sel.value);
    }

    const prog = Storage.progress()[episode.id];
    if (prog && prog.time && prog.time < (this.video.duration || 9999)) {
      this.video.currentTime = prog.time;
    }
    const savedSpeed = Storage.settings().speed || 1;
    this.video.playbackRate = savedSpeed;
    const speedSel = document.getElementById('speedSelect');
    if (speedSel) speedSel.value = String(savedSpeed);
    const savedVol = Storage.settings().volume;
    if (typeof savedVol === 'number') this.video.volume = savedVol;
    this.resetHideTimer();
    if (this.upscaleMode !== 'off') this.syncCanvasSize();
  },

  async playQuality(q) {
    const voiceObj = this.current.voices && this.current.voices.find(v => v.id === this.current.voice);
    if (voiceObj && voiceObj.type === 'iframe') return;
    const { provider, episode } = this.current;
    Storage.setSettings(Object.assign(Storage.settings(), { quality: q }));
    let quality = q === 'auto' ? (episode.streams && Object.keys(episode.streams).sort((a, b) => Number(b) - Number(a))[0]) : q;
    let url = episode.streams && episode.streams[quality];
    if (!url) {
      try {
        const r = await API.stream(provider, episode.id, quality);
        url = r.url;
      } catch (e) {
        showToast('Не удалось получить поток: ' + e.message);
        return;
      }
    }
    if (this.hls) { this.hls.destroy(); this.hls = null; }
    if (url && url.includes('.m3u8')) {
      if (window.Hls && Hls.isSupported()) {
        this.hls = new Hls();
        this.hls.loadSource(url);
        this.hls.attachMedia(this.video);
        this.hls.on(Hls.Events.MANIFEST_PARSED, () => { this.video.play().catch(() => {}); });
        this.hls.on(Hls.Events.ERROR, (ev, data) => {
          if (data.fatal) showToast('Ошибка воспроизведения HLS');
        });
      } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
        this.video.src = url;
        this.video.play().catch(() => {});
      }
    } else if (url) {
      this.video.src = url;
      this.video.play().catch(() => {});
    }
  },

  async changeVoice(voiceId) {
    if (!this.current) return;
    const voiceObj = this.current.voices.find(v => v.id === voiceId);
    this.current.voice = voiceId;
    const voices = Storage.settings().voices || {};
    voices[this.current.title.id] = voiceId;
    Storage.setSettings(Object.assign(Storage.settings(), { voices }));
    if (voiceObj && voiceObj.type === 'iframe') {
      document.getElementById('video').classList.add('hidden');
      const iframe = document.getElementById('iframePlayer');
      iframe.classList.remove('hidden');
      if (voiceObj.link) iframe.src = voiceObj.link;
    } else {
      document.getElementById('iframePlayer').classList.add('hidden');
      document.getElementById('video').classList.remove('hidden');
      const t = this.video.currentTime;
      this.updateQualityOptions(this.current.episode);
      await this.playQuality(document.getElementById('qualitySelect').value);
      this.video.currentTime = t;
      this.video.play().catch(() => {});
    }
  },

  updateQualityOptions(episode) {
    const sel = document.getElementById('qualitySelect');
    const prev = sel.value;
    sel.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto'; autoOpt.textContent = 'Авто';
    sel.appendChild(autoOpt);
    const qs = Object.keys(episode.streams || {}).sort((a, b) => Number(a) - Number(b));
    for (const q of qs) {
      const o = document.createElement('option');
      o.value = q; o.textContent = (q === '2160' ? '2160p (4K)' : q + 'p');
      sel.appendChild(o);
    }
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    else sel.value = 'auto';
  },

  saveProgress() {
    if (!this.current) return;
    const ep = this.current.episode;
    const prog = Storage.progress();
    const watched = this.video.duration && (this.video.currentTime / this.video.duration) > 0.9;
    prog[ep.id] = { time: this.video.currentTime, duration: this.video.duration, titleId: this.current.title.id, titleName: this.current.title.name, provider: this.current.provider, episodeId: ep.id, watched, ts: Date.now() };
    Storage.setProgress(prog);
  },

  updateTime() {
    const v = this.video;
    const cur = formatTime(v.currentTime || 0);
    const dur = formatTime(v.duration || 0);
    document.getElementById('time').textContent = `${cur} / ${dur}`;
    const seek = document.getElementById('seek');
    if (v.duration) seek.value = (v.currentTime / v.duration * 100).toFixed(2);
  },

  togglePlay() {
    if (this.video.paused) this.video.play(); else this.video.pause();
    document.getElementById('playPause').textContent = this.video.paused ? '▶' : '⏸';
    this.showPlayIcon();
  },

  seekBy(delta) {
    this.video.currentTime = Math.max(0, Math.min(this.video.duration || 0, this.video.currentTime + delta));
  },

  setVolume(v) { this.video.volume = v; Storage.setSettings(Object.assign(Storage.settings(), { volume: v })); },

  setSpeed(v) {
    this.video.playbackRate = v;
    Storage.setSettings(Object.assign(Storage.settings(), { speed: v }));
  },

  setSubtitle(url) {
    const video = this.video;
    for (const t of video.querySelectorAll('track')) t.remove();
    if (url) {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = 'Субтитры';
      track.srclang = 'ru';
      track.src = url;
      track.default = true;
      video.appendChild(track);
    }
  },

  loadSubtitleFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vtt,.srt,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target.result;
        let vtt = text;
        if (file.name.endsWith('.srt')) {
          vtt = 'WEBVTT\n\n' + text.replace(/(\d+)\n(\d{2}:\d{2}:\d{2}),(\d{3}) --> (\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1\n$2.$3 --> $4.$5');
        }
        const blob = new Blob([vtt], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        this.setSubtitle(url);
        showToast('Субтитры загружены');
      };
      reader.readAsText(file);
    };
    input.click();
  },

  fullscreen() {
    const w = document.getElementById('playerWrap');
    if (document.fullscreenElement) document.exitFullscreen();
    else w.requestFullscreen();
  },

  async togglePip() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await this.video.requestPictureInPicture();
      }
    } catch (e) {
      showToast('PiP недоступен: ' + e.message);
    }
  },

  currentSegment() {
    if (!this.current) return null;
    const ep = this.current.episode;
    const t = this.video.currentTime;
    if (ep.opening && typeof ep.opening.start === 'number' && t >= ep.opening.start && t < ep.opening.stop) return 'opening';
    if (ep.ending && typeof ep.ending.start === 'number' && t >= ep.ending.start && t < ep.ending.stop) return 'ending';
    return null;
  },

  skipSegment() {
    if (!this.current) return;
    const ep = this.current.episode;
    const seg = this.currentSegment();
    const settings = Storage.settings();
    if (seg === 'opening' && ep.opening && typeof ep.opening.stop === 'number') {
      this.video.currentTime = ep.opening.stop;
      this._skippedOpening = true;
    } else if (seg === 'ending' && ep.ending && typeof ep.ending.stop === 'number') {
      this.video.currentTime = ep.ending.stop;
      this._skippedEnding = true;
      if (settings.autoNextAfterEnding) {
        if (!this._autoNextTriggered) { this._autoNextTriggered = true; this.nextEpisode(); }
      }
    } else {
      const skip = Number(settings.skipSeconds || 85);
      this.video.currentTime = Math.min(this.video.duration || Infinity, this.video.currentTime + skip);
    }
  },

  handleSkipSegments() {
    if (!this.current) return;
    const ep = this.current.episode;
    const btn = document.getElementById('skipBtn');
    const settings = Storage.settings();
    const seg = this.currentSegment();
    if (seg) {
      btn.textContent = seg === 'opening' ? 'Пропустить опенинг' : 'Пропустить эндинг';
      btn.classList.remove('hidden');
      if (seg === 'opening' && settings.autoSkipOpening && !this._skippedOpening) {
        this._skippedOpening = true;
        this.video.currentTime = ep.opening.stop;
      }
      if (seg === 'ending' && settings.autoSkipEnding && !this._skippedEnding) {
        this._skippedEnding = true;
        this.video.currentTime = ep.ending.stop;
        if (settings.autoNextAfterEnding && !this._autoNextTriggered) {
          this._autoNextTriggered = true;
          setTimeout(() => this.nextEpisode(), 500);
        }
      }
    } else {
      if (!ep.opening && !ep.ending) {
        btn.textContent = `Пропустить ${settings.skipSeconds || 85} сек`;
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    }
  },

  nextEpisode() {
    const c = this.current;
    if (!c) return;
    if (c.index + 1 < c.episodes.length) {
      const next = c.episodes[c.index + 1];
      App.openPlayer(c.provider, c.title, next, c.episodes);
    } else {
      showToast('Это последняя серия');
    }
  },

  prevEpisode() {
    const c = this.current;
    if (!c) return;
    if (c.index - 1 >= 0) {
      const prev = c.episodes[c.index - 1];
      App.openPlayer(c.provider, c.title, prev, c.episodes);
    }
  }
};

function formatTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

window.Player = Player;
window.formatTime = formatTime;
