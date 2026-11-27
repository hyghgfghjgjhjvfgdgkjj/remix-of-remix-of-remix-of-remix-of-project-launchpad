const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('movieMaxDesktop', {
  session: () => ipcRenderer.invoke('desktop-session'),
  ready: () => ipcRenderer.invoke('desktop-ready'),
  close: () => ipcRenderer.send('desktop-close'),
});