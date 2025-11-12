const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  open: (url) => { try { ipcRenderer.send('overlay:open', url); } catch {} },
  home: () => { try { ipcRenderer.send('overlay:home'); } catch {} },
  setHeight: (h) => { try { ipcRenderer.send('overlay:height', Number(h)||0); } catch {} },
  onConfig: (cb) => ipcRenderer.on('overlay:config', (_e, cfg) => { try { cb(cfg); } catch {} }),
  devtools: () => { try { ipcRenderer.send('overlay:devtools'); } catch {} }
});
