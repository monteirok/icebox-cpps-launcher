<div align="center">
  <img src="/assets/images/logo.png" alt="Logo" style="display:block;width:800px;margin-bottom:.2rem;">
</div>

---

<div style="padding:.8rem;">
  <p style="font-size:.94rem;color:#222;">
    Icebox Launcher is a lightweight Electron wrapper and CPPS launcher/manager with a polished in‑app toolbar, customizable hotkeys, and macOS universal builds.
  </p>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">🚀 Features</h3>
  <ul>
    <li>Saved links as cards with name + host, auto‑fetched favicon, and dynamic background color derived from the favicon for readable contrast.</li>
    <li>Pin/unpin links. Pinned links show in a dedicated section and are ordered by most‑recent pin.</li>
    <li>Drag‑and‑drop reordering among visible cards while preserving the Pinned/Unpinned split.</li>
    <li>Overflow handling via a compact "More" dropdown for additional saved links.</li>
    <li>Inline Edit and Delete actions. Edit lets you change name and URL.</li>
    <li>Smart save: when saving a URL, the app tries to resolve the site title in the background to prefill the name.</li>
    <li>Overlay toolbar on external pages with Links/View/Tools/Help menus (open saved links, toggle fullscreen, clear saved links).</li>
    <li>Settings page to customize hotkeys; preferences persist to user data.</li>
    <li>Secure defaults: sandboxed renderer, contextIsolation enabled, no nodeIntegration, external windows open in the OS browser, and only fullscreen/pointerLock permissions allowed.</li>
  </ul>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">⚡ Quick Start</h3>
  <ul>
    <li><b>Prerequisites:</b> Node.js 18+</li>
    <li><b>Install & Run:</b>
      <ul>
        <li><code>npm install</code></li>
        <li><code>npm start</code></li>
      </ul>
    </li>
  </ul>
  <p style="font-size:.94rem;">This opens the main menu (Saved Links UI).</p>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">⌨️ Hotkeys</h3>
  <ul>
    <li>Defaults:
      <ul>
        <li><code>Cmd/Ctrl+O</code> — Open URL</li>
        <li><code>Cmd/Ctrl+S</code> — Save Link</li>
        <li><code>Esc</code> — Cancel dialogs / Return to menu</li>
        <li><code>F11</code> — Toggle Fullscreen</li>
        <li><code>Alt+Cmd+I</code> (mac) or <code>Ctrl+Shift+I</code> (win/linux) — Toggle DevTools</li>
      </ul>
    </li>
    <li>All hotkeys are configurable in <b>Settings…</b> (App → Settings or the in‑app toolbar → Tools → Settings).</li>
  </ul>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">🗂️ Project Structure</h3>
  <ul>
    <li><code>main.js</code> — Electron main process (window creation, security, overlay toolbar, hotkeys, title resolution)</li>
    <li><code>html/prompt.html</code> — Main menu UI (save/open links, cards, pinning, drag‑and‑drop, favicon color logic)</li>
    <li><code>html/settings.html</code> — Hotkeys editor (reads/writes user hotkeys)</li>
    <li><code>overlay-preload.js</code> + <code>html/overlay.html</code> — In‑page toolbar for external sites</li>
    <li><code>preload.js</code> — Exposes safe APIs to the renderer</li>
  </ul>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">📦 Build</h3>
  <ul>
    <li>macOS universal build (DMG + ZIP): <code>npm run mac</code></li>
    <li>Artifacts are written to <code>dist/</code>. Code signing is disabled by default (<code>identity: null</code>); configure it for distribution if needed.</li>
    <li>Windows/Linux packaging is not configured yet.</li>
  </ul>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">🖼️ Screenshots</h3>
  <p style="font-size:.94rem;color:#222;">Add screenshots under <code>assets/images/</code> and reference them here. For example:</p>
  <div align="center">
    <img src="assets/images/logo.png" alt="Sample artwork" style="max-width:880px;width:100%;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.2);" />
  </div>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">🛠️ Tips</h3>
  <ul>
    <li>Saved links are stored in <code>localStorage.savedLinks</code> (per‑user). To wipe them: Tools → Clear Saved Links.</li>
    <li>Hotkeys are stored at <code>[userData]/hotkeys.json</code> and update the app menu accelerators live.</li>
    <li>New windows/tabs from sites open in your default browser; the app keeps a single window.</li>
  </ul>

  <h3 style="margin-bottom:.4rem;color:#ffc70f;letter-spacing:0.08rem;">📄 License</h3>
  <ul>
    <li>ISC</li>
  </ul>
</div>
