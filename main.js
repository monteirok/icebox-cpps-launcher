const { app, BrowserWindow, shell, session, globalShortcut, Menu, ipcMain, BrowserView, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Graceful shutdown so IDEs don't report SIGINT errors
function setupGracefulExit() {
  let exiting = false;
  const exitClean = () => {
    if (exiting) return;
    exiting = true;
    try { if (app && app.quit) app.quit(); } catch {}
    // Ensure process ends with success code
    setTimeout(() => { try { process.exit(0); } catch {} }, 200);
  };
  process.on('SIGINT', exitClean);
  process.on('SIGTERM', exitClean);
  // Windows support when started via npm scripts
  if (process.platform === 'win32') {
    process.on('message', (msg) => { if (msg === 'graceful-exit') exitClean(); });
  }
}
setupGracefulExit();

// Hotkey settings
const defaultHotkeys = {
  openURL: 'CmdOrCtrl+O',
  saveLink: 'CmdOrCtrl+S',
  cancelModal: 'Escape',
  openMenu: 'Escape',
  toggleDevTools: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
  toggleFullscreen: 'F11'
};
let currentHotkeys = { ...defaultHotkeys };
let settingsPath = '';
function readHotkeys() {
  try {
    settingsPath = settingsPath || path.join(app.getPath('userData'), 'hotkeys.json');
    if (fs.existsSync(settingsPath)) {
      const obj = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) || {};
      if (obj && obj.hotkeys && typeof obj.hotkeys === 'object') {
        currentHotkeys = { ...defaultHotkeys, ...obj.hotkeys };
      }
    }
  } catch {}
}
function writeHotkeys() {
  try {
    settingsPath = settingsPath || path.join(app.getPath('userData'), 'hotkeys.json');
    const dir = path.dirname(settingsPath);
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    fs.writeFileSync(settingsPath, JSON.stringify({ hotkeys: currentHotkeys }, null, 2));
  } catch {}
}

function normalizeKey(str) { return String(str || '').trim(); }
function eventMatches(input, accel) {
  try {
    accel = normalizeKey(accel);
    if (!accel) return false;
    const key = (input.key || '').toUpperCase();
    const want = accel.toUpperCase();
    const has = (m) => /CMDORCTRL/.test(m) ? (input.meta || input.control) : (m === 'SHIFT' ? input.shift : m === 'ALT' ? input.alt : m === 'COMMAND' ? input.meta : m === 'CTRL' || m === 'CONTROL' ? input.control : false);
    const parts = want.split('+').map(s => s.trim());
    const base = parts[parts.length - 1];
    const mods = new Set(parts.slice(0, -1));
    // Check modifiers
    for (const m of ['SHIFT','ALT','COMMAND','CTRL','CONTROL','CMDORCTRL']) {
      if (mods.has(m)) {
        if (!has(m)) return false;
      } else {
        if (m === 'SHIFT' && input.shift) return false;
        if ((m === 'ALT') && input.alt) return false;
        if ((m === 'COMMAND') && input.meta) return false;
        if ((m === 'CTRL' || m === 'CONTROL') && input.control) return false;
        if (m === 'CMDORCTRL' && (input.meta || input.control) && !mods.has('CMDORCTRL')) {/* no-op */}
      }
    }
    // Base key
    if (/^F\d{1,2}$/.test(base)) return key === base;
    if (base === 'ESC' || base === 'ESCAPE') return key === 'ESCAPE';
    return key === base.toUpperCase();
  } catch { return false; }
}

function loadPrompt(win) {
  if (!win || win.isDestroyed()) return;
  win.loadFile(path.join(__dirname, '/html/prompt.html'));
}

function isSafeExternalUrl(u) {
  try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:'; }
  catch { return false; }
}


// Overlay toolbar (BrowserView) for external pages
let overlayView = null;
let contentView = null; // external website lives here to avoid overlaying content
const OVERLAY_BAR_HEIGHT = 56; // visual toolbar height for layout
let overlayViewHeight = OVERLAY_BAR_HEIGHT; // actual BrowserView height (expands when dropdowns open)
function createOverlay(win) {
  if (!win || win.isDestroyed()) return null;
  if (overlayView && overlayView.webContents && !overlayView.webContents.isDestroyed()) return overlayView;
  overlayView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '/overlay-preload.js')
    }
  });
  try { win.addBrowserView(overlayView); } catch {}
  try { overlayView.setBackgroundColor('#00000000'); } catch {}
  try { overlayView.webContents.loadFile(path.join(__dirname, '/html/overlay.html')); } catch {}
  positionOverlay(win);
  sendOverlayConfig(win);
  return overlayView;
}

function positionOverlay(win) {
  if (!win || win.isDestroyed() || !overlayView || (overlayView.webContents && overlayView.webContents.isDestroyed())) return;
  const bounds = win.getBounds();
  try { overlayView.setBounds({ x: 0, y: 0, width: bounds.width, height: overlayViewHeight }); } catch {}
  try { win.setTopBrowserView && win.setTopBrowserView(overlayView); } catch {}
}

function ensureContentView(win) {
  if (!win || win.isDestroyed()) return null;
  if (contentView && contentView.webContents && !contentView.webContents.isDestroyed()) return contentView;
  contentView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webgl: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  try { win.addBrowserView(contentView); } catch {}
  attachContentHandlers(contentView);
  positionContentView(win);
  return contentView;
}

function positionContentView(win) {
  if (!win || win.isDestroyed() || !contentView || (contentView.webContents && contentView.webContents.isDestroyed())) return;
  const bounds = win.getBounds();
  const h = Math.max(0, bounds.height - OVERLAY_BAR_HEIGHT);
  try { contentView.setBounds({ x: 0, y: OVERLAY_BAR_HEIGHT, width: bounds.width, height: h }); } catch {}
}

function destroyContentView(win) {
  try { if (win && contentView) { win.removeBrowserView(contentView); contentView.destroy(); } } catch {}
  contentView = null;
}

function attachContentHandlers(view) {
  try {
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
  } catch {}
  try {
    view.webContents.on('page-title-updated', (_evt, title) => {
      const url = view.webContents.getURL();
      if (url && !url.startsWith('file:')) {
        const key = normalizeUrl(url);
        if (key && title) pendingTitles.set(key, String(title));
      }
    });
  } catch {}
  try {
    view.webContents.on('will-navigate', (event, url) => { if (!isSafeExternalUrl(url)) event.preventDefault(); });
  } catch {}
}

async function openInContentView(win, url) {
  try {
    if (!isSafeExternalUrl(url)) return;
    createOverlay(win);
    const v = ensureContentView(win);
    positionOverlay(win);
    positionContentView(win);
    await v.webContents.loadURL(url);
    // Keep overlay on top
    try { win.setTopBrowserView && win.setTopBrowserView(overlayView); } catch {}
  } catch {}
}

function sendOverlayConfig(win) {
  if (!overlayView || (overlayView.webContents && overlayView.webContents.isDestroyed())) return;
  const paddingLeft = process.platform === 'darwin' ? 80 : 8;
  try { overlayView.webContents.send('overlay:config', { paddingLeft, height: OVERLAY_BAR_HEIGHT }); } catch {}
}


function createWindow() {
  const iconIcns = path.join(__dirname, '/build/icon.icns');
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    // Use .icns for macOS runs; other platforms ignore or use their own formats
    icon: process.platform === 'darwin' ? iconIcns : undefined,
    webPreferences: {
      // Security-minded defaults:
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '/preload.js'),
      // Good for games:
      webgl: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  // Load the local prompt UI first, then navigate to the provided link
  loadPrompt(win);

  // Open target="_blank" etc. in the OS browser instead of new Electron windows
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Optional: force desktop UA if site mis-detects
  // win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/Electron\/[\d.]+ /, ''));

  // Allow pointer lock/fullscreen for games; add app shortcuts
  win.webContents.on('before-input-event', (_, input) => {
    if (input.type !== 'keyDown') return;
    if (eventMatches(input, currentHotkeys.toggleFullscreen)) {
      win.setFullScreen(!win.isFullScreen());
      return;
    }
    if (eventMatches(input, currentHotkeys.openMenu)) {
      const focused = BrowserWindow.getFocusedWindow() || win;
      if (focused) {
        try { destroyContentView(focused); } catch {}
        try { if (overlayView && !overlayView.webContents.isDestroyed()) { focused.removeBrowserView(overlayView); } } catch {}
        loadPrompt(focused);
      }
      return;
    }
    // Toggle DevTools (customizable + F12 fallback)
    if (eventMatches(input, currentHotkeys.toggleDevTools) || (input.key === 'F12')) {
      if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
      else win.webContents.openDevTools({ mode: 'detach' });
      return;
    }
  });

  // Capture titles of sites we navigate to for backfilling saved link names
  win.webContents.on('page-title-updated', (_evt, title) => {
    const url = win.webContents.getURL();
    if (url && !url.startsWith('file:')) {
      const key = normalizeUrl(url);
      if (key && title) pendingTitles.set(key, String(title));
    }
  });
  // Prevent external pages from navigating to non-http(s) schemes
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const cur = win.webContents.getURL();
      const onExternal = cur && !cur.startsWith('file:');
      if (onExternal && !isSafeExternalUrl(url)) event.preventDefault();
    } catch {}
  });

  // When prompt UI loads, apply any pending titles to saved links
  win.webContents.on('did-finish-load', () => {
    const u = win.webContents.getURL();
    if (u && u.startsWith('file:') && u.endsWith('/html/prompt.html')) {
      // If no content view is active, hide the overlay
      if (!contentView) {
        try { if (overlayView && !overlayView.webContents.isDestroyed()) { win.removeBrowserView(overlayView); } } catch {}
        overlayViewHeight = OVERLAY_BAR_HEIGHT;
      }
      applyPendingTitles(win);
    } else {
      // External page is handled by BrowserView now
      createOverlay(win);
      positionOverlay(win);
      positionContentView(win);
      sendOverlayConfig(win);
    }
  });
  win.on('resize', () => { positionOverlay(win); positionContentView(win); sendOverlayConfig(win); });
  win.on('move', () => { positionOverlay(win); positionContentView(win); sendOverlayConfig(win); });

  // When this window is closed, terminate the app (all platforms)
  win.on('closed', () => {
    try { destroyContentView(win); } catch {}
    try { app.quit(); } catch {}
  });

  return win;
}

// Some game sites need autoplay for audio—relax this policy
app.whenReady().then(async () => {
  // Set the dock icon to the packaged icns during dev and prod on macOS
  try {
    if (process.platform === 'darwin') {
      const icns = nativeImage.createFromPath(path.join(__dirname, '/build/icon.icns'));
      if (!icns.isEmpty()) app.dock.setIcon(icns);
    }
  } catch {}
  // Tighten permissions (deny by default; allow fullscreen only)
  try {
    const allow = new Set(['fullscreen','pointerLock']);
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allow.has(permission));
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allow.has(permission)));
  } catch {}
  // Load hotkeys from disk
  readHotkeys();
  const win = createWindow();

  // Minimal application menu with a shortcut to open the links UI
  const template = [
    {
      label: 'App',
      submenu: [
        { label: 'Open Saved Links', accelerator: currentHotkeys.openMenu || 'Esc', click: () => { const w = BrowserWindow.getFocusedWindow() || win; try { destroyContentView(w); } catch {} try { if (overlayView && !overlayView.webContents.isDestroyed()) { w.removeBrowserView(overlayView); } } catch {} loadPrompt(w); } },
        { label: 'Settings…', accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,', click: () => { try { destroyContentView(win); } catch {} try { if (overlayView && !overlayView.webContents.isDestroyed()) { win.removeBrowserView(overlayView); } } catch {} try { win.loadFile(path.join(__dirname, '/html/settings.html')); } catch {} } },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    // Add standard Edit menu so copy/paste/select-all shortcuts work
    { role: 'editMenu' },
    // View menu with DevTools toggle
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'toggleDevTools', accelerator: currentHotkeys.toggleDevTools || (process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I') }
      ]
    }
  ];
  try { Menu.setApplicationMenu(Menu.buildFromTemplate(template)); } catch {}

  // No global shortcut; handled per-window in before-input-event
});

// Always quit when all windows are closed, including on macOS
app.on('window-all-closed', () => { app.quit(); });

// No auto-recreate behavior; closing the window exits the app
// app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Clean up shortcuts
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch {} });

// Overlay toolbar IPC
ipcMain.on('overlay:open', (_evt, url) => {
  try {
    const w = BrowserWindow.getFocusedWindow();
    if (w && url && isSafeExternalUrl(url)) openInContentView(w, url);
  } catch {}
});
ipcMain.on('overlay:home', () => {
  try {
    const w = BrowserWindow.getFocusedWindow();
    if (w) {
      destroyContentView(w);
      try { if (overlayView && !overlayView.webContents.isDestroyed()) { w.removeBrowserView(overlayView); } } catch {}
      overlayViewHeight = OVERLAY_BAR_HEIGHT;
      loadPrompt(w);
    }
  } catch {}
});
ipcMain.on('overlay:height', (_evt, h) => {
  try {
    overlayViewHeight = Math.max(OVERLAY_BAR_HEIGHT, Math.min(Number(h) || OVERLAY_BAR_HEIGHT, 460));
    const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (w) { positionOverlay(w); /* content remains fixed under bar height */ }
  } catch {}
});
ipcMain.on('overlay:devtools', () => {
  try {
    const w = BrowserWindow.getFocusedWindow();
    if (!w) return;
    if (w.webContents.isDevToolsOpened()) w.webContents.closeDevTools();
    else w.webContents.openDevTools({ mode: 'detach' });
  } catch {}
});

// Resolve a page title for a given URL in a hidden window
ipcMain.handle('resolve-title', async (_evt, url) => {
  try {
    if (!isSafeExternalUrl(url)) return '';
    const temp = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    let resolved = false;
    let title = '';
    const cleanup = () => { try { temp.destroy(); } catch {} };
    const tryResolve = (t) => {
      if (resolved) return;
      if (typeof t === 'string' && t.trim()) { title = t.trim(); resolved = true; cleanup(); }
    };
    temp.webContents.once('page-title-updated', (_e, t) => tryResolve(t));
    temp.webContents.once('did-finish-load', () => tryResolve(temp.webContents.getTitle()));
    await temp.loadURL(url);
    // Fallback timeout
    await new Promise((r) => setTimeout(r, 2500));
    tryResolve(temp.webContents.getTitle());
    cleanup();
    return title || '';
  } catch {
    return '';
  }
});

// Keep track of titles for URLs we've opened so we can backfill names later
const pendingTitles = new Map();

function normalizeUrl(u) {
  try { return new URL(u).toString(); } catch { return ''; }
}

function applyPendingTitles(win) {
  if (!win || win.isDestroyed() || pendingTitles.size === 0) return;
  const mapObj = Object.fromEntries(pendingTitles);
  const code = `(() => {
    try {
      const pending = ${JSON.stringify(mapObj)};
      const raw = localStorage.getItem('savedLinks');
      let arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return;
      const titleize = (s) => (s || '').split(/[^a-zA-Z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const derive = (href) => { try { const u = new URL(href); const host = u.hostname.replace(/^www\./,''); const parts = host.split('.'); const core = parts.length > 2 ? parts[parts.length-2] : parts[0]; return titleize(core); } catch { return ''; } };
      let changed = false;
      arr = arr.map(l => {
        const key = l && l.url ? new URL(l.url).toString() : '';
        const t = key ? pending[key] : '';
        if (t && (!l.name || l.name === derive(l.url))) { l.name = t; changed = true; }
        return l;
      });
      if (changed) localStorage.setItem('savedLinks', JSON.stringify(arr));
    } catch {}
  })();`;
  try { win.webContents.executeJavaScript(code).then(() => { pendingTitles.clear(); }).catch(() => {}); } catch {}
}
// Hotkeys IPC
ipcMain.handle('hotkeys:get', async () => {
  try { return { ...currentHotkeys }; } catch { return { ...defaultHotkeys }; }
});
ipcMain.handle('hotkeys:set', async (_evt, map) => {
  try {
    if (!map || typeof map !== 'object') return false;
    currentHotkeys = { ...defaultHotkeys, ...map };
    writeHotkeys();
    // Rebuild menu to reflect new accelerators
    try {
      const focused = BrowserWindow.getFocusedWindow();
      const w = focused || (BrowserWindow.getAllWindows()[0]);
      if (w) {
        const template = [
          {
            label: 'App',
            submenu: [
              { label: 'Open Saved Links', accelerator: currentHotkeys.openMenu || 'Esc', click: () => { try { destroyContentView(w); } catch {} try { if (overlayView && !overlayView.webContents.isDestroyed()) { w.removeBrowserView(overlayView); } } catch {} loadPrompt(w); } },
              { label: 'Settings…', accelerator: process.platform === 'darwin' ? 'Cmd+,' : 'Ctrl+,', click: () => { try { destroyContentView(w); } catch {} try { if (overlayView && !overlayView.webContents.isDestroyed()) { w.removeBrowserView(overlayView); } } catch {} try { w.loadFile(path.join(__dirname, '/html/settings.html')); } catch {} } },
              { type: 'separator' },
              { role: 'quit' }
            ]
          },
          { role: 'editMenu' },
          {
            label: 'View',
            submenu: [
              { role: 'reload' },
              { role: 'togglefullscreen' },
              { type: 'separator' },
              { role: 'toggleDevTools', accelerator: currentHotkeys.toggleDevTools || (process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I') }
            ]
          }
        ];
        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
      }
    } catch {}
    return true;
  } catch { return false; }
});
ipcMain.handle('hotkeys:reset', async () => {
  try { currentHotkeys = { ...defaultHotkeys }; writeHotkeys(); return true; } catch { return false; }
});
