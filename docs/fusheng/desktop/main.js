// 浮生千年桌面版外殼：把網頁版原封不動放進視窗裡。遊戲規則與畫面都在 game/（由 sync.js 從上一層複製）。
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) app.quit();
let win = null;

/* ---------- 存檔檔案：遊戲每次存檔都另寫一份到 saves/，Steam 雲端同步這個資料夾 ---------- */
const saveDir = path.join(app.getPath('userData'), 'saves');
const KEYS = { 'fusheng.save.v2': 'save.json', 'fusheng.archive.v2': 'archive.json', 'fusheng.ach.v1': 'achievements.json' };
ipcMain.on('fs-mirror', (e, key, json) => {
  const name = KEYS[key];
  if (!name) return;
  try {
    fs.mkdirSync(saveDir, { recursive: true });
    const file = path.join(saveDir, name);
    if (json == null) fs.rmSync(file, { force: true });
    else { fs.writeFileSync(file + '.tmp', json); fs.renameSync(file + '.tmp', file); } // 先寫暫存檔再改名，斷電也不會留下半個存檔
  } catch (err) { console.error('存檔寫入失敗', err.message); }
});
ipcMain.on('fs-load', (e, key) => {
  const name = KEYS[key];
  try { e.returnValue = name ? fs.readFileSync(path.join(saveDir, name), 'utf8') : null; } catch (err) { e.returnValue = null; }
});

/* ---------- Steam：有裝 steamworks.js、找得到 App ID、Steam 正在執行時才啟用；否則安靜略過 ---------- */
let steam = null;
function initSteam() {
  try {
    const idFile = [path.join(path.dirname(app.getPath('exe')), 'steam_appid.txt'), path.join(__dirname, 'steam_appid.txt')].find(f => fs.existsSync(f));
    const appId = Number(process.env.FUSHENG_STEAM_APPID || (idFile ? fs.readFileSync(idFile, 'utf8').trim() : 0));
    if (!appId) return;
    steam = require('steamworks.js').init(appId);
    console.log('Steam 已連線：', steam.localplayer.getName());
  } catch (err) { steam = null; console.log('未啟用 Steam：', err.message); }
}
ipcMain.on('fs-unlock', (e, id) => {
  try { if (steam && !steam.achievement.isActivated(id)) steam.achievement.activate(id); } catch (err) { console.error('成就解鎖失敗', err.message); }
});
ipcMain.on('fs-fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.on('fs-quit', () => app.quit());

function createWindow() {
  win = new BrowserWindow({
    width: 1366, height: 768, minWidth: 1120, minHeight: 660,
    useContentSize: true, backgroundColor: '#f4eedf', title: '浮生千年', show: false,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
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
app.whenReady().then(() => { initSteam(); createWindow(); });
app.on('window-all-closed', () => app.quit());
