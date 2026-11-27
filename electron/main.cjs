// Movie max desktop: standalone app UI (renderer/) with its own frameless window.
// Data comes from the active MovieMax domain (Firebase), cached for offline start.
const { app, BrowserWindow, ipcMain, net, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SITE = "https://luofilm.site";
const ACTIVE_SITE_DOC = "https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents/app_settings/active_site?key=AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0";
const file = (n) => path.join(app.getPath("userData"), n);
const readJson = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), "utf8")); } catch { return d; } };
const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

let site = null;
async function activeSite() {
  if (site) return site;
  try {
    const doc = await (await net.fetch(ACTIVE_SITE_DOC, { signal: timeout(4000) })).json();
    const u = new URL(doc.fields.value.stringValue);
    if (u.protocol === "https:") { site = u.origin; fs.writeFileSync(file("site.json"), JSON.stringify({ site })); return site; }
  } catch {}
  site = readJson("site.json", {}).site || DEFAULT_SITE;
  return site;
}

ipcMain.handle("feed", async () => {
  const s = await activeSite();
  try {
    const res = await fetch(`${s}/api/public/app-latest`, { signal: timeout(20000) });
    const body = await res.json();
    if (Array.isArray(body.items) && body.items.length) {
      const data = { at: Date.now(), site: s, items: body.items };
      fs.writeFileSync(file("feed.json"), JSON.stringify(data));
      return { ...data, offline: false };
    }
  } catch {}
  const cached = readJson("feed.json", null);
  return cached ? { ...cached, offline: true } : { items: [], site: s, offline: true };
});

ipcMain.handle("api", async (_e, p) => {
  if (typeof p !== "string" || !/^[\w\-/?=&%.]+$/.test(p)) return { error: "bad" };
  const s = await activeSite();
  const key = "c-" + p.replace(/[^\w]/g, "_").slice(0, 120) + ".json";
  // Try the active site, then the built-in domain, using Chromium's network stack (system proxy/certs).
  for (const base of [...new Set([s, DEFAULT_SITE, "https://www.luofilm.site"])]) {
    try {
      const res = await net.fetch(`${base}/api/public/desktop/${p}`, { signal: timeout(25000) });
      if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) continue;
      const body = await res.json();
      if (base !== s) { site = base; fs.writeFileSync(file("site.json"), JSON.stringify({ site })); }
      fs.writeFileSync(file(key), JSON.stringify(body)); return body;
    } catch {}
  }
  const c = readJson(key, null);
  return c ? { ...c, offline: true } : { offline: true };
});

const FB_KEY = "AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0";
const READ_USER = `new Promise((ok) => { const r = indexedDB.open("firebaseLocalStorageDb"); r.onerror = () => ok(null);
  r.onsuccess = () => { try { const q = r.result.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
  q.onsuccess = () => { const u = (q.result || []).map((x) => x.value).find((v) => v && v.uid && v.stsTokenManager); ok(u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL, refreshToken: u.stsTokenManager.refreshToken } : null); };
  q.onerror = () => ok(null); } catch { ok(null); } }; })`;
const notifyAccount = () => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("account-changed"));
async function account() {
  const acc = readJson("account.json", null); if (!acc?.refreshToken) return { user: null };
  const user = { uid: acc.uid, email: acc.email, name: acc.name, photo: acc.photo };
  try {
    const t = await (await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_KEY}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acc.refreshToken)}`, signal: timeout(10000) })).json();
    if (!t.id_token) { if (t.error) { fs.rmSync(file("account.json"), { force: true }); return { user: null }; } throw 0; }
    if (t.refresh_token && t.refresh_token !== acc.refreshToken) fs.writeFileSync(file("account.json"), JSON.stringify({ ...acc, refreshToken: t.refresh_token }));
    const rows = await (await fetch("https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents:runQuery", { method: "POST", headers: { authorization: `Bearer ${t.id_token}`, "content-type": "application/json" }, signal: timeout(10000),
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "luo_subscriptions" }], where: { fieldFilter: { field: { fieldPath: "user_id" }, op: "EQUAL", value: { stringValue: acc.uid } } } } }) })).json();
    const val = (f) => f && (f.stringValue ?? f.timestampValue ?? f.integerValue ?? f.doubleValue);
    const live = (Array.isArray(rows) ? rows : []).map((r) => r.document?.fields).filter(Boolean)
      .map((f) => ({ status: String(val(f.status) || "").toLowerCase(), expires: val(f.expires_at), plan: val(f.plan_name) }))
      .filter((x) => x.status === "active" && (!x.expires || Date.parse(x.expires) > Date.now()))
      .sort((a, b) => Date.parse(b.expires || 0) - Date.parse(a.expires || 0))[0];
    const out = { user, subscribed: !!live, plan: live?.plan || null, expires: live?.expires || null };
    fs.writeFileSync(file("sub.json"), JSON.stringify(out)); return out;
  } catch { const c = readJson("sub.json", null); return c && c.user?.uid === acc.uid ? { ...c, offline: true } : { user, subscribed: false }; }
}
ipcMain.handle("account", () => account());
ipcMain.handle("logout", async () => {
  fs.rmSync(file("account.json"), { force: true }); fs.rmSync(file("sub.json"), { force: true });
  const s = await activeSite(); const w = new BrowserWindow({ show: false });
  await w.loadURL(s + "/profile").catch(() => {}); await w.webContents.executeJavaScript(`indexedDB.deleteDatabase("firebaseLocalStorageDb")`).catch(() => {}); w.destroy();
});

let login = null;
ipcMain.handle("login", async (e, p) => {
  const s = await activeSite();
  const parent = BrowserWindow.fromWebContents(e.sender);
  if (!login || login.isDestroyed()) {
    login = new BrowserWindow({ parent, modal: true, width: 460, height: 640, resizable: false, backgroundColor: "#101217", title: "Movie max account", autoHideMenuBar: true, icon: path.join(__dirname, "icon.ico") });
    login.webContents.setWindowOpenHandler(({ url }) => /accounts\.google\.com|whop\.com|paypal\.com/.test(url) || url.startsWith(s) ? { action: "allow" } : (shell.openExternal(url), { action: "deny" }));
  }
  login.loadURL(s + (p === "/plans" ? "/plans" : "/profile")); login.show();
  const w = login, poll = setInterval(async () => {
    if (w.isDestroyed()) { clearInterval(poll); notifyAccount(); return; }
    const u = await w.webContents.executeJavaScript(READ_USER).catch(() => null);
    if (u?.refreshToken) { const had = readJson("account.json", null)?.uid === u.uid; fs.writeFileSync(file("account.json"), JSON.stringify(u)); if (!had) { notifyAccount(); if (p !== "/plans") { clearInterval(poll); w.close(); } } }
  }, 1500);
});

const dls = new Map(); let dlSeq = 0;
const dlInfo = () => [...dls.values()].map(({ item, ...d }) => ({ ...d, received: item?.getReceivedBytes() ?? d.received, total: item?.getTotalBytes() || d.total, paused: item?.isPaused() ?? false }));
const pushDl = () => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("dl", dlInfo()));
ipcMain.handle("dl-start", (e, { url, name, poster }) => {
  if (!/^https:\/\//.test(url) && !/^http:\/\/localhost/.test(url)) return;
  const id = ++dlSeq; dls.set(id, { id, name, poster, state: "starting", received: 0, total: 0 });
  pendingDl.push(id); e.sender.downloadURL(url); pushDl();
});
const pendingDl = [];
ipcMain.handle("dl-list", () => dlInfo());
ipcMain.handle("dl-act", (_e, { id, a }) => {
  const d = dls.get(id); if (!d) return;
  if (a === "pause") d.item?.pause(); else if (a === "resume") d.item?.canResume() && d.item.resume();
  else if (a === "cancel") { d.item?.cancel(); dls.delete(id); } else if (a === "open" && d.path) shell.showItemInFolder(d.path);
  else if (a === "remove") dls.delete(id);
  pushDl();
});
app.whenReady().then(() => require("electron").session.defaultSession.on("will-download", (_e, item) => {
  const id = pendingDl.shift(); const d = id && dls.get(id); if (!d) return;
  const dir = path.join(app.getPath("videos"), "Movie max"); fs.mkdirSync(dir, { recursive: true });
  d.path = path.join(dir, item.getFilename()); item.setSavePath(d.path); d.item = item; d.state = "downloading";
  let t = 0; item.on("updated", (_ev, st) => { d.state = st === "interrupted" ? "paused" : "downloading"; if (Date.now() - t > 700) { t = Date.now(); pushDl(); } });
  item.once("done", (_ev, st) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.item = null; d.state = st === "completed" ? "done" : "failed"; pushDl(); });
}));

let player = null;
ipcMain.handle("watch", async (_e, p) => {
  const s = await activeSite();
  if (typeof p !== "string" || !p.startsWith("/")) return;
  if (!player || player.isDestroyed()) {
    player = new BrowserWindow({ width: 1200, height: 720, backgroundColor: "#07080c", title: "Movie max Player", autoHideMenuBar: true, icon: path.join(__dirname, "icon.ico") });
    player.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  }
  player.loadURL(s + p); player.show(); player.focus();
});
ipcMain.handle("open", async (_e, p) => { const s = await activeSite(); shell.openExternal(/^https?:/.test(p) ? p : s + p); });
ipcMain.on("win", (e, a) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (a === "min") w.minimize(); else if (a === "max") w.isMaximized() ? w.unmaximize() : w.maximize(); else w.close();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1240, height: 780, minWidth: 960, minHeight: 600, frame: false, backgroundColor: "#0b0c10", title: "Movie max",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, webviewTag: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

if (!app.requestSingleInstanceLock()) app.exit(0);
app.on("second-instance", () => { const [w] = BrowserWindow.getAllWindows(); if (w?.isMinimized()) w.restore(); w?.focus(); });
app.on("window-all-closed", () => app.quit());
app.whenReady().then(createWindow);
