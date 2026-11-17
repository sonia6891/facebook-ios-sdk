// 把上一層的網頁版（index.html、style.css、js、assets）複製到 game/，桌面版與網頁版永遠同一份內容。
// 另外把字型放進程式裡，沒有網路也是同一套字。
const fs = require('fs');
const path = require('path');
const src = process.env.FUSHENG_SRC || path.join(__dirname, '..');
const dst = path.join(__dirname, 'game');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'style.css', 'js', 'assets']) fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true });

const fontPkg = path.join(__dirname, 'node_modules', '@fontsource', 'noto-serif-tc');
const weights = ['400', '600', '700', '900'];
if (fs.existsSync(fontPkg)) {
  const out = path.join(dst, 'fonts');
  fs.mkdirSync(path.join(out, 'files'), { recursive: true });
  let n = 0;
  for (const w of weights) {
    fs.copyFileSync(path.join(fontPkg, `${w}.css`), path.join(out, `${w}.css`));
    for (const f of fs.readdirSync(path.join(fontPkg, 'files'))) {
      if (f.includes(`-${w}-normal.woff2`)) { fs.copyFileSync(path.join(fontPkg, 'files', f), path.join(out, 'files', f)); n++; }
    }
  }
  const page = path.join(dst, 'index.html');
  let html = fs.readFileSync(page, 'utf8');
  html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '').replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/, weights.map(w => `<link rel="stylesheet" href="fonts/${w}.css">`).join('\n') + '\n');
  fs.writeFileSync(page, html);
  console.log(`已內建字型 ${n} 個檔案`);
} else console.log('找不到字型套件，改用系統字型（先執行 npm install）');
console.log('已同步遊戲內容到', dst);
