const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { ProviderManager } = require('../providers/manager');

function libraryFile() { return path.join(app.getPath('userData'), 'library.json'); }
function readLibrary() {
  try { return JSON.parse(fs.readFileSync(libraryFile(), 'utf-8')); } catch { return { items: {} }; }
}
function writeLibrary(data) {
  const f = libraryFile();
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  if (fs.existsSync(f)) fs.unlinkSync(f);
  fs.renameSync(tmp, f);
}

let mainWindow = null;
let providers = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f13',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load renderer:', code, desc);
  });
  mainWindow.webContents.on('console-message', (_e, level, msg) => {
    const fs = require('fs');
    fs.appendFileSync('C:/Users/PC/AppData/Local/Temp/opencode/main_start.log', 'CONSOLE[' + level + '] ' + msg + '\\n', 'utf-8');
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function registerIpc() {
  ipcMain.handle('providers:list', () => providers.list());
  ipcMain.handle('search', async (_e, { provider, query, page }) => providers.search(provider, query, page));
  ipcMain.handle('getTitle', async (_e, { provider, id }) => providers.getTitle(provider, id));
  ipcMain.handle('getEpisodes', async (_e, { provider, id }) => providers.getEpisodes(provider, id));
  ipcMain.handle('getSimilar', async (_e, { provider, id }) => providers.getSimilar(provider, id));
  ipcMain.handle('getStream', async (_e, { provider, episodeId, quality }) => providers.getStream(provider, episodeId, quality));
  ipcMain.handle('getCatalog', async (_e, { provider, opts }) => providers.getCatalog(provider, opts));
  ipcMain.handle('getGenres', async (_e, { provider }) => providers.getGenres(provider));
  ipcMain.handle('getYears', async (_e, { provider }) => providers.getYears(provider));
  ipcMain.handle('getIndexInfo', async () => providers.getIndexInfo());
  ipcMain.handle('getLibrary', async () => readLibrary());
  ipcMain.handle('setLibrary', async (_e, data) => { writeLibrary(data); return { ok: true }; });
  ipcMain.handle('diagSources', async (_e, { title }) => {
    const test = title || 'Атака титанов';
    const results = [];
    // AniLibria
    {
      const start = Date.now();
      try {
        const r = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(test)}`, { headers: { 'User-Agent': 'AnimePlayer/1.0' } });
        const data = await r.json();
        const arr = Array.isArray(data) ? data : (data?.data || []);
        results.push({ name: 'AniLibria', ok: r.ok, status: r.status, time: Date.now() - start, count: arr.length, error: r.ok ? '' : `HTTP ${r.status}` });
      } catch (e) {
        results.push({ name: 'AniLibria', ok: false, status: 0, time: Date.now() - start, count: 0, error: e.message });
      }
    }
    // Shikimori
    {
      const start = Date.now();
      try {
        const r = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(test)}&limit=10`, { headers: { 'User-Agent': 'AnimePlayer/1.0' } });
        const data = await r.json();
        const arr = Array.isArray(data) ? data : [];
        results.push({ name: 'Shikimori', ok: r.ok, status: r.status, time: Date.now() - start, count: arr.length, error: r.ok ? '' : `HTTP ${r.status}` });
      } catch (e) {
        results.push({ name: 'Shikimori', ok: false, status: 0, time: Date.now() - start, count: 0, error: e.message });
      }
    }
    return { ok: true, data: results };
  });
  ipcMain.handle('openExternal', async (_e, url) => { await shell.openExternal(url); });
  ipcMain.handle('capturePage', async () => {
    const img = await mainWindow.webContents.capturePage();
    return img.toPNG().toString('base64');
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  const fs = require('fs');
  fs.writeFileSync('C:/Users/PC/AppData/Local/Temp/opencode/main_start.log', 'STARTED\n', 'utf-8');
  providers = new ProviderManager(app.getPath('userData'));
  registerIpc();
  createWindow();

  // auto-updater (only in packaged app)
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-available');
  });
  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Обновление',
      message: 'Новая версия загружена. Перезапустить сейчас?',
      buttons: ['Перезапустить', 'Позже']
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.on('error', (err) => { console.error('AutoUpdater error:', err); });
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
