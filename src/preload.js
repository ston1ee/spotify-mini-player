const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startAuth: () => ipcRenderer.invoke('start-auth'),
  getCurrentPlayback: () => ipcRenderer.invoke('get-current-playback'),
  nextTrack: () => ipcRenderer.invoke('next-track'),
  previousTrack: () => ipcRenderer.invoke('previous-track'),
  togglePlayPause: () => ipcRenderer.invoke('toggle-play-pause'),
  getLyrics: (trackId) => ipcRenderer.invoke('get-lyrics', trackId),
  setWindowLock: (locked) => ipcRenderer.invoke('set-window-lock', locked),
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('set-window-opacity', opacity),
  onAuthSuccess: (callback) => ipcRenderer.on('auth-success', callback)
});