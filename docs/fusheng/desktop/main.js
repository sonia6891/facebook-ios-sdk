// 浮生千年桌面版外殼：把網頁版原封不動放進視窗裡。遊戲規則與畫面都在 game/（由 sync.js 從上一層複製）。
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

if (!app.requestSingleInstanceLock()) app.quit();
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 768, minWidth: 1120, minHeight: 660,
    useContentSize: true, backgroundColor: '#f4eedf', title: '浮生千年', show: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'game', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // F11 或 Alt+Enter 切換全螢幕
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Enter' && input.alt)) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // 遊戲內不開新視窗；外部連結交給系統瀏覽器
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) e.preventDefault(); });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
