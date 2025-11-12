const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  resolveTitle: async (url) => {
    try { return await ipcRenderer.invoke('resolve-title', url); } catch { return ''; }
  },
  // Open external URL in content view below overlay
  openURL: (url) => { try { ipcRenderer.send('overlay:open', url); } catch {} },
  // Return to main menu
  goHome: () => { try { ipcRenderer.send('overlay:home'); } catch {} },
  // Hotkey settings API
  getHotkeys: async () => {
    try { return await ipcRenderer.invoke('hotkeys:get'); } catch { return null; }
  },
  saveHotkeys: async (map) => {
    try { return await ipcRenderer.invoke('hotkeys:set', map); } catch { return false; }
  },
  resetHotkeys: async () => {
    try { return await ipcRenderer.invoke('hotkeys:reset'); } catch { return false; }
  }
});
