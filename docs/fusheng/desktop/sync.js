// 把上一層的網頁版（index.html、style.css、js、assets）複製到 game/，桌面版與網頁版永遠同一份內容。
const fs = require('fs');
const path = require('path');
const src = process.env.FUSHENG_SRC || path.join(__dirname, '..');
const dst = path.join(__dirname, 'game');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'style.css', 'js', 'assets']) fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true });
console.log('已同步遊戲內容到', dst);
