/* 產生繁體→簡體的對照表 js/t2s.js。
   用法：先在任一資料夾 npm install opencc-js，然後
     OPENCC_DIR=<那個資料夾>/node_modules/opencc-js node make_t2s.js
   遊戲文字改過之後重跑一次即可。對照表只收遊戲裡實際出現的字。 */
const fs = require('fs');
const path = require('path');
const OpenCC = require(process.env.OPENCC_DIR || 'opencc-js');
const conv = OpenCC.Converter({ from: 'tw', to: 'cn' });

const root = path.join(__dirname, '..');
const files = ['index.html', 'js/data.js', 'js/engine.js', 'js/ui.js', 'js/look.js', 'js/audio.js'];
const text = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

// 逐段（連續的中文字）轉換，這樣「乾坤」「著書」這類詞會照詞義轉，不會被逐字誤轉
const runs = [...new Set(text.match(/[㐀-鿿]+/g) || [])];
const seen = {}; // 繁體字 → { 簡體字: 次數 }
const ctx = {};  // 繁體字 → { 前字+後字: 簡體字 }
for (const run of runs) {
  const out = conv(run);
  if (out.length !== run.length) continue; // 長度變了就無法逐字對齊，極少見
  for (let i = 0; i < run.length; i++) {
    const t = run[i], s = out[i];
    (seen[t] = seen[t] || {})[s] = (seen[t][s] || 0) + 1;
    (ctx[t] = ctx[t] || {})[(run[i - 1] || '') + '|' + (run[i + 1] || '')] = s;
  }
}
let from = '', to = '';
const amb = {};
for (const t of Object.keys(seen).sort()) {
  const outs = Object.keys(seen[t]).sort((a, b) => seen[t][b] - seen[t][a]);
  if (outs.length === 1) { if (outs[0] !== t) { from += t; to += outs[0]; } continue; }
  // 同一個字在不同詞裡轉法不同：記下預設轉法，以及和預設不同的前後文
  const rules = {};
  for (const k of Object.keys(ctx[t])) if (ctx[t][k] !== outs[0]) rules[k] = ctx[t][k];
  amb[t] = { d: outs[0], r: rules };
}
const body = `/* 由 tools/make_t2s.js 產生，請勿手改。繁體→簡體對照：${from.length} 個單一轉法的字，${Object.keys(amb).length} 個依前後文決定的字。 */
(function (root) {
  root.FS_T2S = { from: ${JSON.stringify(from)}, to: ${JSON.stringify(to)}, amb: ${JSON.stringify(amb)} };
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(root, 'js', 't2s.js'), body);
console.log(`字數 ${from.length}，依前後文 ${Object.keys(amb).length}：${Object.keys(amb).join('')}`);
