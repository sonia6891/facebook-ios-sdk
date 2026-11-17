// 遊戲頁面與桌面外殼之間唯一的通道：存檔鏡像、成就、全螢幕、離開。
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('fsDesktop', {
  mirror: (key, json) => ipcRenderer.send('fs-mirror', String(key), json == null ? null : String(json)),
  load: key => ipcRenderer.sendSync('fs-load', String(key)),
  unlock: id => ipcRenderer.send('fs-unlock', String(id)),
  fullscreen: () => ipcRenderer.send('fs-fullscreen'),
  quit: () => ipcRenderer.send('fs-quit')
});
