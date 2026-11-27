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

const FS = "https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents";
const ADMIN_EMAILS = ["mainplatform.nexus@gmail.com", "p0760734679@luofilm.site"];
let idToken = null;
const fsVal = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === "boolean" ? { booleanValue: v } : { stringValue: String(v) };
async function fsWrite(coll, id, obj, update) {
  const fields = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fsVal(v)]));
  const url = update ? `${FS}/${coll}/${id}?${Object.keys(obj).map((k) => "updateMask.fieldPaths=" + k).join("&")}` : `${FS}/${coll}?documentId=${id}`;
  const r = await net.fetch(url, { method: update ? "PATCH" : "POST", headers: { authorization: `Bearer ${idToken.token}`, "content-type": "application/json" }, body: JSON.stringify({ fields }), signal: timeout(12000) });
  if (!r.ok) throw new Error("save failed " + r.status);
}
// In-app mobile money: transaction + subscription rows written with the user's own Firebase token, deposit via the site's pawaPay endpoint.
ipcMain.handle("pay", async (_e, o) => {
  const st = await account(); if (!st.user || !idToken) return { status: "failed", message: "Log in first" };
  const plan = o?.plan || {}; const price = Number(plan.price); if (!(price > 0) || !plan.id) return { status: "failed", message: "Pick a plan" };
  const id = require("node:crypto").randomUUID(); const now = new Date().toISOString();
  const tx = { id, user_id: st.user.uid, plan_id: String(plan.id), plan_name: String(plan.name || plan.id), tier: String(o.tier || "vip"), duration_days: Number(plan.days) || 30, device_limit: Number(plan.devices) || 1, amount: price, base_amount: price, currency: "UGX", country: "UG", kind: "payment", status: "pending", method: "mobile_money", reference: `LUO-${Date.now()}-${id.slice(0, 8)}`, note: `Subscription — ${plan.name}`, source: "desktop", created_at: now };
  try {
    await fsWrite("luo_transactions", id, tx);
    const s = await activeSite();
    const r = await (await net.fetch(`${s}/api/public/desktop/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: o.phone, amount: price, reference: tx.reference, description: tx.note }), signal: timeout(30000) })).json();
    if (!r.internal_reference) { await fsWrite("luo_transactions", id, { status: "failed" }, true).catch(() => {}); return { status: "failed", message: r.message || "Payment did not start" }; }
    const phone = String(o.phone).replace(/\D/g, "");
    await fsWrite("luo_transactions", id, { internal_reference: r.internal_reference, msisdn: phone, phone, used_at: now }, true).catch(() => {});
    payments.set(id, { tx, dep: r.internal_reference, site: s });
    return { status: "pending", id, message: r.message || "Approve the prompt on your phone" };
  } catch { return { status: "failed", message: "Could not reach the payment service" }; }
});
const payments = new Map();
ipcMain.handle("pay-status", async (_e, id) => {
  const p = payments.get(id); if (!p) return { status: "failed", message: "Unknown payment" };
  try {
    const r = await (await net.fetch(`${p.site}/api/public/desktop/pay-status/${p.dep}`, { signal: timeout(15000) })).json();
    if (r.status === "success" && !p.done) {
      p.done = true; await account(); const now = new Date().toISOString();
      const cur = readJson("sub.json", null); const base = cur?.subscribed && cur.expires && Date.parse(cur.expires) > Date.now() ? Date.parse(cur.expires) : Date.now();
      const t = p.tx; const sid = require("node:crypto").randomUUID();
      await fsWrite("luo_transactions", id, { status: "completed", completed_at: now }, true).catch(() => {});
      await fsWrite("luo_subscriptions", sid, { id: sid, user_id: t.user_id, transaction_id: id, plan_id: t.plan_id, plan_name: t.plan_name, tier: t.tier, device_limit: t.device_limit, amount: t.amount, currency: "UGX", status: "active", starts_at: now, started_at: now, expires_at: new Date(base + t.duration_days * 864e5).toISOString(), source: "desktop", created_at: now });
      notifyAccount();
    } else if (r.status === "failed") await fsWrite("luo_transactions", id, { status: "failed" }, true).catch(() => {});
    return r;
  } catch { return { status: "pending", message: "Waiting for confirmation" }; }
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
    const t = await (await net.fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_KEY}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acc.refreshToken)}`, signal: timeout(10000) })).json();
    if (!t.id_token) { if (t.error) { fs.rmSync(file("account.json"), { force: true }); return { user: null }; } throw 0; }
    if (t.refresh_token && t.refresh_token !== acc.refreshToken) fs.writeFileSync(file("account.json"), JSON.stringify({ ...acc, refreshToken: t.refresh_token }));
    const rows = await (await net.fetch("https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents:runQuery", { method: "POST", headers: { authorization: `Bearer ${t.id_token}`, "content-type": "application/json" }, signal: timeout(10000),
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "luo_subscriptions" }], where: { fieldFilter: { field: { fieldPath: "user_id" }, op: "EQUAL", value: { stringValue: acc.uid } } } } }) })).json();
    idToken = { uid: acc.uid, token: t.id_token, at: Date.now() };
    const val = (f) => f && (f.stringValue ?? f.timestampValue ?? f.integerValue ?? f.doubleValue);
    const em = String(acc.email || "").toLowerCase();
    let admin = ADMIN_EMAILS.includes(em);
    if (!admin) { try { const rr = await (await net.fetch(FS + ":runQuery", { method: "POST", headers: { authorization: `Bearer ${t.id_token}`, "content-type": "application/json" }, signal: timeout(8000),
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "user_roles" }], where: { fieldFilter: { field: { fieldPath: "user_id" }, op: "EQUAL", value: { stringValue: acc.uid } } } } }) })).json();
      admin = (Array.isArray(rr) ? rr : []).some((r) => ["admin", "staff"].includes(r.document?.fields?.role?.stringValue)); } catch {} }
    const live = (Array.isArray(rows) ? rows : []).map((r) => r.document?.fields).filter(Boolean)
      .map((f) => ({ status: String(val(f.status) || "").toLowerCase(), expires: val(f.expires_at), plan: val(f.plan_name) }))
      .filter((x) => x.status === "active" && (!x.expires || Date.parse(x.expires) > Date.now()))
      .sort((a, b) => Date.parse(b.expires || 0) - Date.parse(a.expires || 0))[0];
    const out = { user, admin, subscribed: !!live || admin, plan: live?.plan || null, expires: live?.expires || null };
    fs.writeFileSync(file("sub.json"), JSON.stringify(out)); return out;
  } catch { const c = readJson("sub.json", null); return c && c.user?.uid === acc.uid ? { ...c, offline: true } : { user, subscribed: false }; }
}
ipcMain.handle("account", () => account());
ipcMain.handle("logout", async () => {
  fs.rmSync(file("account.json"), { force: true }); fs.rmSync(file("sub.json"), { force: true });
  const s = await activeSite(); const w = new BrowserWindow({ show: false });
  await w.loadURL(s + "/profile").catch(() => {}); await w.webContents.executeJavaScript(`indexedDB.deleteDatabase("firebaseLocalStorageDb")`).catch(() => {}); w.destroy();
});

const AUTH_ERR = { EMAIL_NOT_FOUND: "No account with that email", INVALID_PASSWORD: "Wrong password", INVALID_LOGIN_CREDENTIALS: "Wrong email or password", EMAIL_EXISTS: "That email already has an account", USER_DISABLED: "This account is disabled", TOO_MANY_ATTEMPTS_TRY_LATER: "Too many tries, wait a moment" };
ipcMain.handle("email-auth", async (_e, o) => {
  const email = String(o?.email || "").slice(0, 200), password = String(o?.password || "").slice(0, 200);
  const call = async (ep, body) => (await net.fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${ep}?key=${FB_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: timeout(15000) })).json();
  try {
    if (o?.mode === "reset") { const r = await call("sendOobCode", { requestType: "PASSWORD_RESET", email }); return r.error ? { error: AUTH_ERR[r.error.message] || "Could not send reset email" } : { ok: true }; }
    const r = await call(o?.mode === "up" ? "signUp" : "signInWithPassword", { email, password, returnSecureToken: true });
    if (r.error) { const k = String(r.error.message).split(" ")[0]; return { error: AUTH_ERR[k] || (k.startsWith("WEAK_PASSWORD") ? "Password must be at least 6 characters" : "Sign-in failed") }; }
    let name = r.displayName || "";
    if (o?.mode === "up" && o.name) { await call("update", { idToken: r.idToken, displayName: String(o.name).slice(0, 80) }).catch(() => {}); name = o.name; }
    fs.writeFileSync(file("account.json"), JSON.stringify({ uid: r.localId, email: r.email, name, photo: r.profilePicture || null, refreshToken: r.refreshToken }));
    notifyAccount(); return { ok: true };
  } catch { return { error: "No connection to the sign-in service" }; }
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
const dlInfo = () => [...dls.values()].map(({ item, last, ...d }) => ({ ...d, received: item?.getReceivedBytes() ?? d.received, total: item?.getTotalBytes() || d.total, paused: item?.isPaused() ?? false }));
const pushDl = () => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("dl", dlInfo()));
ipcMain.handle("dl-start", (e, { url, name, poster }) => {
  if (!/^https:\/\//.test(url) && !/^http:\/\/localhost/.test(url)) return;
  const id = ++dlSeq; dls.set(id, { id, name, poster, url, state: "starting", received: 0, total: 0, speed: 0 });
  pendingDl.push(id); e.sender.downloadURL(url); pushDl();
});
const pendingDl = [];
ipcMain.handle("dl-list", () => dlInfo());
ipcMain.handle("dl-all", (_e, a) => { for (const d of dls.values()) { if (a === "pause") d.item?.pause(); if (a === "resume" && d.item?.canResume()) d.item.resume(); if (a === "clear" && (d.state === "done" || d.state === "failed")) dls.delete(d.id); } pushDl(); });
ipcMain.handle("dl-folder", () => { const dir = path.join(app.getPath("videos"), "Movie max"); fs.mkdirSync(dir, { recursive: true }); shell.openPath(dir); });
ipcMain.handle("dl-act", (_e, { id, a }) => {
  const d = dls.get(id); if (!d) return;
  if (a === "pause") d.item?.pause(); else if (a === "resume") d.item?.canResume() && d.item.resume();
  else if (a === "cancel") { d.item?.cancel(); dls.delete(id); } else if (a === "open" && d.path) shell.showItemInFolder(d.path);
  else if (a === "remove") dls.delete(id);
  else if (a === "delete") { if (d.path) fs.rmSync(d.path, { force: true }); dls.delete(id); }
  else if (a === "retry" && d.url) { Object.assign(d, { state: "starting", received: 0, total: 0, speed: 0 }); pendingDl.push(id); BrowserWindow.getAllWindows()[0]?.webContents.downloadURL(d.url); }
  pushDl();
});
// A wrong PC clock makes valid certificates look expired; accept only that error, only for our own services, and tell the user once.
const OUR_HOSTS = /(^|\.)(luofilm\.site|googleapis\.com|aoneroom\.com|r2\.dev|workers\.dev|deno\.dev|netlify\.app)$/;
let clockWarned = false;
app.whenReady().then(() => require("electron").session.defaultSession.setCertificateVerifyProc((req, cb) => {
  if (req.verificationResult === "net::ERR_CERT_DATE_INVALID" && OUR_HOSTS.test(req.hostname)) {
    if (!clockWarned) { clockWarned = true; setTimeout(() => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("clock-wrong")), 1500); }
    return cb(0);
  }
  cb(-3);
}));
app.whenReady().then(() => require("electron").session.defaultSession.on("will-download", (_e, item) => {
  const id = pendingDl.shift(); const d = id && dls.get(id); if (!d) return;
  const dir = path.join(app.getPath("videos"), "Movie max"); fs.mkdirSync(dir, { recursive: true });
  d.path = path.join(dir, item.getFilename()); item.setSavePath(d.path); d.item = item; d.state = "downloading";
  let t = 0; item.on("updated", (_ev, st) => { d.state = st === "interrupted" ? "paused" : "downloading"; const now = Date.now(); if (now - t > 700) { const b = item.getReceivedBytes(); d.speed = d.last ? Math.max(0, (b - d.last.b) / ((now - d.last.t) / 1000)) : 0; d.last = { b, t: now }; t = now; pushDl(); } });
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
