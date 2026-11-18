// 把上一層的網頁版（index.html、style.css、js、assets）複製到 game/，桌面版與網頁版永遠同一份內容。
// 另外把字型放進程式裡，沒有網路也是同一套字。
const fs = require('fs');
const path = require('path');
const src = process.env.FUSHENG_SRC || path.join(__dirname, '..');
const dst = path.join(__dirname, 'game');
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const f of ['index.html', 'style.css', 'js', 'assets']) fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true });

// 繁體用 Noto Serif TC，簡體用 Noto Serif SC；兩套都放進去，切換語言不用連網
const weights = ['400', '600', '700', '900'];
const fontPkgs = ['noto-serif-tc', 'noto-serif-sc'].map(n => path.join(__dirname, 'node_modules', '@fontsource', n)).filter(p => fs.existsSync(p));
if (fontPkgs.length) {
  const out = path.join(dst, 'fonts');
  fs.mkdirSync(path.join(out, 'files'), { recursive: true });
  const links = [];
  let n = 0;
  for (const pkg of fontPkgs) {
    const tag = path.basename(pkg).slice(-2); // tc 或 sc
    for (const w of weights) {
      fs.copyFileSync(path.join(pkg, `${w}.css`), path.join(out, `${tag}-${w}.css`));
      links.push(`<link rel="stylesheet" href="fonts/${tag}-${w}.css">`);
      for (const f of fs.readdirSync(path.join(pkg, 'files'))) {
        if (f.includes(`-${w}-normal.woff2`)) { fs.copyFileSync(path.join(pkg, 'files', f), path.join(out, 'files', f)); n++; }
      }
    }
  }
  const page = path.join(dst, 'index.html');
  let html = fs.readFileSync(page, 'utf8');
  html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '').replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/, links.join('\n') + '\n');
  fs.writeFileSync(page, html);
  console.log(`已內建字型 ${n} 個檔案（${fontPkgs.length} 套）`);
} else console.log('找不到字型套件，改用系統字型（先執行 npm install）');
console.log('已同步遊戲內容到', dst);
