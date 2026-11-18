/* 浮生千年：語言。遊戲文字以繁體中文寫成；選簡體時，畫面上的字在顯示前逐字轉換（對照表在 t2s.js）。
   存檔內容不受影響，隨時可以切換。 */
(function (root) {
  'use strict';
  const KEY = 'fusheng.lang.v1';
  let lang = 'zh-Hant';
  try { lang = localStorage.getItem(KEY) || lang; } catch (e) { /* 用預設值 */ }
  const T = root.FS_T2S || { from: '', to: '', amb: {} };
  const map = {};
  for (let i = 0; i < T.from.length; i++) map[T.from[i]] = T.to[i];

  function toHans(str) {
    if (!str) return str;
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      const a = T.amb[c];
      if (a) {
        // 同一個字有兩種轉法時，看前後各一個字來決定
        const prev = str[i - 1] || '', next = str[i + 1] || '';
        let hit = a.r[prev + '|' + next];
        if (hit == null) for (const k in a.r) { const [p, n] = k.split('|'); if ((p && p === prev) || (n && n === next)) { hit = a.r[k]; break; } }
        out += hit == null ? a.d : hit;
      } else out += map[c] || c;
    }
    return out;
  }
  const t = str => (lang === 'zh-Hans' ? toHans(str) : str);

  function fixNode(node) {
    if (node.nodeType === 3) { if (node.parentNode && node.parentNode.hasAttribute && node.parentNode.hasAttribute('data-raw')) return; const v = toHans(node.nodeValue); if (v !== node.nodeValue) node.nodeValue = v; return; }
    if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.hasAttribute('data-raw')) return; // data-raw：保留原字（例如語言切換鈕）
    for (const attr of ['title', 'placeholder', 'alt', 'aria-label']) {
      const v = node.getAttribute && node.getAttribute(attr);
      if (v) { const n = toHans(v); if (n !== v) node.setAttribute(attr, n); }
    }
    for (const child of node.childNodes) fixNode(child);
  }
  function start() {
    document.documentElement.lang = lang;
    if (lang !== 'zh-Hans') return;
    document.title = toHans(document.title);
    fixNode(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') fixNode(m.target);
        else if (m.type === 'attributes') fixNode(m.target);
        else m.addedNodes.forEach(fixNode);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'alt', 'aria-label'] });
  }
  function set(next) {
    try { localStorage.setItem(KEY, next); } catch (e) { /* 存不了就只在這次生效 */ }
    location.reload(); // 換回繁體需要原文，重新載入最單純；進度已自動存檔
  }
  root.FS_LANG = { get: () => lang, set, t, toggle: () => set(lang === 'zh-Hans' ? 'zh-Hant' : 'zh-Hans'), other: () => (lang === 'zh-Hans' ? '繁體中文' : '简体中文') };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})(typeof window !== 'undefined' ? window : globalThis);
