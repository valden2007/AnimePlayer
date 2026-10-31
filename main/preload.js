const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  providersList: () => ipcRenderer.invoke('providers:list'),
  search: (provider, query, page) => ipcRenderer.invoke('search', { provider, query, page }),
  getTitle: (provider, id) => ipcRenderer.invoke('getTitle', { provider, id }),
  getEpisodes: (provider, id) => ipcRenderer.invoke('getEpisodes', { provider, id }),
  getStream: (provider, episodeId, quality) => ipcRenderer.invoke('getStream', { provider, episodeId, quality }),
  getVoices: (provider, titleId, episodeId) => ipcRenderer.invoke('getVoices', { provider, titleId, episodeId }),
  diagSources: (title) => ipcRenderer.invoke('diagSources', { title }),
  capturePage: () => ipcRenderer.invoke('capturePage'),
  getIndexInfo: () => ipcRenderer.invoke('getIndexInfo'),
  getLibrary: () => ipcRenderer.invoke('getLibrary'),
  setLibrary: (data) => ipcRenderer.invoke('setLibrary', data),
  getCatalog: (provider, opts) => ipcRenderer.invoke('getCatalog', { provider, opts }),
  getGenres: (provider) => ipcRenderer.invoke('getGenres', { provider }),
  getYears: (provider) => ipcRenderer.invoke('getYears', { provider }),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url)
});
