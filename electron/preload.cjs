const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mm", {
  api: (p) => ipcRenderer.invoke("api", p),
  login: (p) => ipcRenderer.invoke("login", p),
  open: (p) => ipcRenderer.invoke("open", p),
  win: (a) => ipcRenderer.send("win", a),
  dlStart: (o) => ipcRenderer.invoke("dl-start", o),
  dlList: () => ipcRenderer.invoke("dl-list"),
  dlAct: (id, a) => ipcRenderer.invoke("dl-act", { id, a }),
  account: () => ipcRenderer.invoke("account"),
  emailAuth: (o) => ipcRenderer.invoke("email-auth", o),
  onClock: (f) => ipcRenderer.on("clock-wrong", () => f()),
  logout: () => ipcRenderer.invoke("logout"),
  onAccount: (f) => ipcRenderer.on("account-changed", () => f()),
  onDl: (f) => ipcRenderer.on("dl", (_e, l) => f(l)),
});
