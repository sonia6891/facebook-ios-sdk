/* 浮生千年：以程式繪製的工筆淡彩 2.5D 城鎮。全部是 SVG，沒有外部圖檔。 */
(function (root) {
  'use strict';
  const TW = 46, TH = 23, OX = 640, OY = 196;
  const P = (gx, gy, h) => [(gx - gy) * TW + OX, (gx + gy) * TH + OY - (h || 0)];
  const f1 = n => Math.round(n * 10) / 10;
  const pt = p => f1(p[0]) + ' ' + f1(p[1]);
  const poly = (pts, fill, extra) => `<polygon points="${pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${fill}" ${extra || ''}/>`;
  const line = (a, b, st, w, op) => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${st}" stroke-width="${w}"${op ? ` opacity="${op}"` : ''}/>`;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const INK = '#3a342b';

  function rng(seed) { let x = seed | 0 || 1; return () => { x = (x * 1664525 + 1013904223) | 0; return (x >>> 0) / 4294967296; }; }

  // 不同時代的建築語彙
  const STYLES = {
    thatch: { roof: '#b39b69', roof2: '#9c8556', tile: false, wall: '#d9c6a0', wall2: '#bfa981', post: '#6d5a40', curl: 0, ridge: '#6b5a3c', rh: 1.05, over: .16 },
    han: { roof: '#6e736b', roof2: '#5a605a', tile: true, wall: '#e0d3b8', wall2: '#c5b597', post: '#6a3f2c', curl: .15, ridge: '#2f3330', rh: .78, over: .22 },
    tang: { roof: '#6b7770', roof2: '#566259', tile: true, wall: '#eadfc9', wall2: '#cfc0a2', post: '#a2452f', curl: .5, ridge: '#2c3532', rh: .72, over: .3 },
    song: { roof: '#5f7478', roof2: '#4c5f64', tile: true, wall: '#eee5d2', wall2: '#d3c6ac', post: '#7c4a34', curl: .8, ridge: '#28373b', rh: .86, over: .27 },
    ming: { roof: '#4f6a70', roof2: '#3f565c', tile: true, wall: '#efe6d3', wall2: '#d2c5aa', post: '#973f2c', curl: 1.05, ridge: '#22343a', rh: .9, over: .28 },
    modern: { roof: '#7b6e60', roof2: '#675c50', tile: true, wall: '#c98d6d', wall2: '#a97356', post: '#5a4436', curl: .1, ridge: '#3b352e', rh: .55, over: .14, brick: true }
  };

  // 城鎮九處可點擊地點；group 對應底部行動分類
  function locations(s) {
    const y = s ? s.year : 1000;
    return [
      { id: 'yamen', g: 'world', gx: 3.9, gy: .9, w: 3, d: 1.9, h: 62, name: y < -221 ? '宗廟' : y >= 1912 ? '市政廳' : '官署', big: true },
      { id: 'temple', g: 'health', gx: 8.6, gy: .9, w: 1.7, d: 1.7, h: 48, name: y < 67 ? '祭壇' : y >= 1912 ? '廟宇' : '寺廟', tower: y >= 67, altar: y < 67 },
      { id: 'school', g: 'study', gx: 1.1, gy: 3.7, w: 2.3, d: 1.6, h: 46, name: y < -221 ? '庠序' : y >= 1912 ? '學校' : y >= 1900 ? '學堂' : '私塾' },
      { id: 'home', g: 'family', gx: 4.3, gy: 4.1, w: 2.2, d: 1.8, h: 44, name: '家宅', yard: true },
      { id: 'teahouse', g: 'social', gx: 8, gy: 4, w: 2.1, d: 1.7, h: 64, name: y >= 618 ? '茶館' : '酒肆', floors: 2, flag: true },
      { id: 'market', g: 'work', gx: 11, gy: 3.2, w: 1.8, d: 3, h: 0, name: y >= 1912 ? '商場' : '市集', stalls: true },
      { id: 'workshop', g: 'work', gx: 1.1, gy: 7, w: 2.5, d: 1.5, h: 42, name: y >= 1912 ? '工廠' : '工坊', smoke: true },
      { id: 'clinic', g: 'health', gx: 4.4, gy: 7.4, w: 1.9, d: 1.5, h: 42, name: y >= 1912 ? '醫院' : y < -221 ? '巫醫舍' : '醫館', flag2: true },
      { id: 'fields', g: 'work', gx: 8.1, gy: 7.8, w: 4.4, d: 4.2, h: 0, name: '田野', crop: true }
    ];
  }

  function roof(st, gx, gy, w, d, h, opts) {
    opts = opts || {};
    const o = st.over, g = opts.glaze;
    const a = P(gx - o, gy - o, h), b = P(gx + w + o, gy - o, h), c = P(gx + w + o, gy + d + o, h), e = P(gx - o, gy + d + o, h);
    const rh = (opts.rh || st.rh) * Math.min(w, d) * 30;
    const long = w >= d;
    const r1 = long ? P(gx + d * .42, gy + d / 2, h + rh) : P(gx + w / 2, gy + w * .42, h + rh);
    const r2 = long ? P(gx + w - d * .42, gy + d / 2, h + rh) : P(gx + w / 2, gy + d - w * .42, h + rh);
    const up = st.curl * 9;
    const lift = q => [q[0], q[1] - up];
    const col = g ? g[0] : st.roof, col2 = g ? g[1] : st.roof2;
    // 正面（朝左下）與側面（朝右下）；曲線屋緣讓屋角上翹
    const front = long ? `M${pt(lift(e))} Q${pt([(e[0] + c[0]) / 2, (e[1] + c[1]) / 2 + up * .5])} ${pt(lift(c))} L${pt(r2)} L${pt(r1)} Z`
      : `M${pt(lift(e))} Q${pt([(e[0] + c[0]) / 2, (e[1] + c[1]) / 2 + up * .5])} ${pt(lift(c))} L${pt(r2)} Z`;
    const side = long ? `M${pt(lift(c))} Q${pt([(c[0] + b[0]) / 2, (c[1] + b[1]) / 2 + up * .5])} ${pt(lift(b))} L${pt(r2)} Z`
      : `M${pt(lift(c))} Q${pt([(c[0] + b[0]) / 2, (c[1] + b[1]) / 2 + up * .5])} ${pt(lift(b))} L${pt(r1)} L${pt(r2)} Z`;
    const west = `M${pt(lift(a))} L${pt(lift(e))} L${pt(long ? r1 : r2)} ${long ? '' : `L${pt(r1)}`} Z`;
    let out = `<path d="${west}" fill="${col2}" stroke="${INK}" stroke-width=".7"/>`;
    out += `<path d="${side}" fill="${col2}" stroke="${INK}" stroke-width=".8"/>`;
    out += `<path d="${front}" fill="${col}" stroke="${INK}" stroke-width=".8"/>`;
    // 瓦壟：工筆的細線
    if (st.tile) {
      let tiles = '';
      const n = Math.max(6, Math.round((c[0] - e[0]) / 7));
      for (let i = 1; i < n; i++) {
        const t = i / n, base = lerp(e, c, t);
        const sag = Math.sin(t * Math.PI) * up * .5 - up * (1 - Math.sin(t * Math.PI));
        const topT = long ? clamp01((t - .2) / .6) : .5;
        const top = long ? lerp(r1, r2, topT) : r1;
        tiles += `M${f1(base[0])} ${f1(base[1] + sag)}L${f1(top[0] * .9 + base[0] * .1)} ${f1(top[1] * .9 + base[1] * .1)}`;
      }
      const m = Math.max(3, Math.round((b[0] - c[0]) / -9));
      for (let i = 1; i < Math.abs(m) + 2; i++) {
        const t = i / (Math.abs(m) + 2), base = lerp(c, b, t), top = long ? r2 : lerp(r2, r1, t);
        tiles += `M${f1(base[0])} ${f1(base[1] - up * .3)}L${f1(top[0] * .85 + base[0] * .15)} ${f1(top[1] * .85 + base[1] * .15)}`;
      }
      out += `<path d="${tiles}" stroke="${INK}" stroke-width=".45" opacity=".42" fill="none"/>`;
    } else {
      // 茅草：不規則短線
      let lines = '';
      const R = rng(Math.round(gx * 97 + gy * 13));
      for (let i = 0; i < 46; i++) {
        const t = R(), q = R() * .85;
        const base = lerp(e, c, t), top = lerp(r1, r2, t);
        const pp = lerp(base, top, q);
        lines += `M${f1(pp[0])} ${f1(pp[1])}l${f1(R() * 3 - 1.5)} ${f1(5 + R() * 5)}`;
      }
      out += `<path d="${lines}" stroke="#7a6642" stroke-width=".6" opacity=".7" fill="none"/>`;
    }
    // 正脊與鴟尾
    out += `<path d="M${pt(r1)}L${pt(r2)}" stroke="${st.ridge}" stroke-width="3.2" stroke-linecap="round"/>`;
    if (st.curl > .3) {
      const s2 = st.curl * 5;
      out += `<path d="M${pt(r1)}q${-s2} ${-s2 * .8} ${-s2 * .2} ${-s2 * 1.7}M${pt(r2)}q${s2} ${-s2 * .8} ${s2 * .2} ${-s2 * 1.7}" stroke="${st.ridge}" stroke-width="2.3" fill="none" stroke-linecap="round"/>`;
    }
    return out;
  }
  const clamp01 = v => Math.max(0, Math.min(1, v));

  function walls(st, gx, gy, w, d, h, opts) {
    opts = opts || {};
    const c0 = P(gx + w, gy + d), l0 = P(gx, gy + d), r0 = P(gx + w, gy);
    const c1 = P(gx + w, gy + d, h), l1 = P(gx, gy + d, h), r1 = P(gx + w, gy, h);
    let out = poly([l0, c0, c1, l1], st.wall, `stroke="${INK}" stroke-width=".8"`);
    out += poly([c0, r0, r1, c1], st.wall2, `stroke="${INK}" stroke-width=".8"`);
    // 檐柱
    const posts = Math.max(3, Math.round(w * 2));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      out += line(lerp(l0, c0, t), lerp(l1, c1, t), st.post, st.brick ? 0 : 2.2);
    }
    const sidePosts = Math.max(2, Math.round(d * 1.6));
    for (let i = 1; i < sidePosts; i++) {
      const t = i / sidePosts;
      out += line(lerp(c0, r0, t), lerp(c1, r1, t), st.post, st.brick ? 0 : 1.8);
    }
    // 額枋
    out += line(lerp(l1, l0, .1), lerp(c1, c0, .1), st.post, st.brick ? .5 : 2);
    out += line(lerp(c1, c0, .1), lerp(r1, r0, .1), st.post, st.brick ? .5 : 1.6);
    if (st.brick) {
      let lines = '';
      for (let i = 1; i < 7; i++) { const a = lerp(l0, l1, i / 7), b = lerp(c0, c1, i / 7), e = lerp(r0, r1, i / 7); lines += `M${pt(a)}L${pt(b)}L${pt(e)}`; }
      out += `<path d="${lines}" stroke="#6b4a36" stroke-width=".4" opacity=".55" fill="none"/>`;
    }
    // 門與窗
    const door = opts.door == null ? .5 : opts.door, dw = .13;
    const dA = lerp(l0, c0, door - dw), dB = lerp(l0, c0, door + dw);
    const hgt = Math.min(h * .68, 30);
    out += poly([dA, dB, [dB[0], dB[1] - hgt], [dA[0], dA[1] - hgt]], st.brick ? '#4a3a2e' : '#5b3b2b', `stroke="${INK}" stroke-width=".7"`);
    out += line([(dA[0] + dB[0]) / 2, (dA[1] + dB[1]) / 2], [(dA[0] + dB[0]) / 2, (dA[1] + dB[1]) / 2 - hgt], '#2c2018', .7);
    [.16, .84].forEach(t => {
      const m = lerp(l0, c0, t), wd = 11, ht = Math.min(h * .4, 18), base = m[1] - h * .34, skew = (c0[1] - l0[1]) / (c0[0] - l0[0]);
      const q = [[m[0] - wd, base + wd * -skew], [m[0] + wd, base + wd * skew], [m[0] + wd, base + wd * skew - ht], [m[0] - wd, base + wd * -skew - ht]];
      out += poly(q, st.brick ? '#3f4a4a' : '#8a7858', `stroke="${INK}" stroke-width=".6"`);
      if (!st.brick) out += `<path d="M${pt(lerp(q[0], q[3], .5))}L${pt(lerp(q[1], q[2], .5))}M${pt(lerp(q[0], q[1], .5))}L${pt(lerp(q[3], q[2], .5))}" stroke="${INK}" stroke-width=".4"/>`;
    });
    return out;
  }
  function plinth(gx, gy, w, d, h, col) {
    const m = .15;
    const pa = P(gx - m, gy + d + m), pb = P(gx + w + m, gy + d + m), pc = P(gx + w + m, gy - m);
    return poly([P(gx - m, gy + d + m, h), P(gx + w + m, gy + d + m, h), P(gx + w + m, gy - m, h), P(gx - m, gy - m, h)], col || '#d8d0bd', `stroke="${INK}" stroke-width=".5"`) +
      poly([pa, pb, [pb[0], pb[1] - h], [pa[0], pa[1] - h]], '#b5ab96', `stroke="${INK}" stroke-width=".5"`) +
      poly([pb, pc, [pc[0], pc[1] - h], [pb[0], pb[1] - h]], '#9f9580', `stroke="${INK}" stroke-width=".5"`);
  }

  function house(st, l) {
    const { gx, gy, w, d, h } = l;
    let out = plinth(gx, gy, w, d, 5);
    const glaze = l.big && !st.brick && st !== STYLES.thatch ? ['#7c6a3c', '#62552f'] : null;
    if (st.brick) {
      out += walls(st, gx, gy, w, d, h * .95, { door: .5 });
      const hh = h * .95;
      out += poly([P(gx, gy + d, hh), P(gx + w, gy + d, hh), P(gx + w, gy, hh), P(gx, gy, hh)], '#8c7a66', `stroke="${INK}" stroke-width=".8"`);
      out += line(P(gx, gy + d, hh + 5), P(gx + w, gy + d, hh + 5), '#6b5a48', 3) + line(P(gx + w, gy + d, hh + 5), P(gx + w, gy, hh + 5), '#5e4f3f', 3);
      return out;
    }
    if (l.floors === 2) {
      out += walls(st, gx, gy, w, d, h * .5, { door: .5 });
      out += roof(st, gx, gy, w, d, h * .5, { rh: .22 });
      out += walls(st, gx + .15, gy + .15, w - .3, d - .3, h * .36, {}).replace(/translate/g, '').replace(/<polygon/g, `<polygon transform="translate(0 ${-h * .62})"`).replace(/<line/g, `<line transform="translate(0 ${-h * .62})"`).replace(/<path/g, `<path transform="translate(0 ${-h * .62})"`);
      out += roof(st, gx + .15, gy + .15, w - .3, d - .3, h * .98, {});
      return out;
    }
    out += walls(st, gx, gy, w, d, h, { door: .5 });
    out += roof(st, gx, gy, w, d, h, { glaze });
    return out;
  }
  function pagoda(st, l) {
    let out = plinth(l.gx - .2, l.gy - .2, l.w + .4, l.d + .4, 6);
    let lvl = 0, w = l.w, g = l.gx, gg = l.gy;
    for (let i = 0; i < 5; i++) {
      const fh = 28 - i * 2;
      const ws = walls(st, g, gg, w, w, fh, { door: .5 });
      out += ws.replace(/<(polygon|line|path)/g, `<$1 transform="translate(0 ${-lvl})"`);
      out += `<g transform="translate(0 ${-lvl})">${roof(st, g, gg, w, w, fh, { rh: .34 })}</g>`;
      lvl += fh + 10;
      g += w * .1; gg += w * .1; w *= .8;
    }
    const tip = P(g + w * .5 - w * .1, gg + w * .5 - w * .1, lvl - 8);
    out += line(tip, [tip[0], tip[1] - 26], INK, 2);
    out += `<circle cx="${f1(tip[0])}" cy="${f1(tip[1] - 12)}" r="3.5" fill="#a8843f" stroke="${INK}" stroke-width=".6"/>`;
    return out;
  }
  function altar(l) {
    let out = plinth(l.gx - .2, l.gy - .2, l.w + .4, l.d + .4, 8);
    out += `<g transform="translate(0 -8)">${plinth(l.gx + .15, l.gy + .15, l.w - .3, l.d - .3, 7)}</g>`;
    const c = P(l.gx + l.w / 2, l.gy + l.d / 2, 16);
    // 青銅鼎
    out += `<g transform="translate(${f1(c[0])} ${f1(c[1])})"><path d="M-13 -20 C-14 -4 14 -4 13 -20Z" fill="#59766c" stroke="${INK}" stroke-width=".9"/><path d="M-12 -20h24M-8 -24v4M8 -24v4M-9 -8l-3 9M9 -8l3 9M0 -6v8" stroke="${INK}" stroke-width="1.5" fill="none"/></g>`;
    return out;
  }
  function stalls(l, st, season) {
    const R = rng(77);
    let out = '';
    const cols = ['#a84d38', '#6d8a78', '#c9a24f', '#5c7787', '#b17144'];
    for (let i = 0; i < 6; i++) {
      const gx = l.gx + .05 + (i % 2) * 1, gy = l.gy + Math.floor(i / 2) * 1.05;
      const a = P(gx, gy + .7), b = P(gx + .7, gy + .7), c = P(gx + .7, gy), h = 22;
      out += poly([a, b, c, P(gx, gy)], '#cdbb96', `stroke="${INK}" stroke-width=".5"`);
      out += poly([a, b, [b[0], b[1] - 10], [a[0], a[1] - 10]], '#a48b63', `stroke="${INK}" stroke-width=".5"`);
      // 貨物
      for (let k = 0; k < 3; k++) { const q = lerp(a, b, .2 + k * .3); out += `<circle cx="${f1(q[0])}" cy="${f1(q[1] - 13)}" r="3.4" fill="${cols[(i + k) % 5]}" stroke="${INK}" stroke-width=".4"/>`; }
      // 棚
      out += line(a, [a[0], a[1] - h - 8], INK, .9) + line(b, [b[0], b[1] - h - 8], INK, .9);
      const col = cols[Math.floor(R() * 5)];
      out += poly([[a[0] - 6, a[1] - h - 2], [b[0] + 6, b[1] - h - 2], [(c[0]) + 6, c[1] - h - 12], [P(gx, gy)[0] - 6, P(gx, gy)[1] - h - 12]], st.brick ? '#b5724e' : col, `stroke="${INK}" stroke-width=".7" opacity=".92"`);
    }
    return out;
  }
  function crops(l, season, year) {
    const c = ['#a9bd7d', '#86a668', '#c8a95a', '#b4ab8f'][season];
    const c2 = ['#8fa968', '#6f9057', '#b08e41', '#9d9379'][season];
    let out = '';
    const R = rng(13);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const gx = l.gx + i * 2.2, gy = l.gy + j * 2.1;
      out += poly([P(gx, gy), P(gx + 2, gy), P(gx + 2, gy + 1.9), P(gx, gy + 1.9)], (i + j) % 2 ? c : c2, `stroke="#7a6a48" stroke-width=".8"`);
      let rows = '';
      for (let k = 1; k < 9; k++) {
        const a = P(gx + k / 9 * 2, gy + .05), b = P(gx + k / 9 * 2, gy + 1.85);
        rows += `M${pt(a)}L${pt(b)}`;
        if (season < 3) for (let q = 0; q < 8; q++) { const m = lerp(a, b, q / 8 + R() * .04); rows += `M${f1(m[0])} ${f1(m[1])}l${f1(R() * 1.6 - .8)} -${f1(3 + season * 1.5)}`; }
      }
      out += `<path d="${rows}" stroke="#4f5b37" stroke-width=".55" opacity=".62" fill="none"/>`;
    }
    return out;
  }
  function tree(gx, gy, season, kind, seed) {
    const R = rng(seed);
    const b = P(gx, gy);
    let out = `<ellipse cx="${f1(b[0] + 6)}" cy="${f1(b[1] + 2)}" rx="15" ry="5" fill="#5a4c33" opacity=".16"/>`;
    const h = 28 + R() * 16;
    out += `<path d="M${f1(b[0])} ${f1(b[1])}C${f1(b[0] - 3)} ${f1(b[1] - h * .4)} ${f1(b[0] + 3)} ${f1(b[1] - h * .6)} ${f1(b[0])} ${f1(b[1] - h)}" stroke="#4d3f2d" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (kind === 'willow') {
      const col = ['#a9c07f', '#7f9f68', '#c6b367', '#a9a792'][season];
      let lines = '';
      for (let i = 0; i < 18; i++) { const x = b[0] + (R() - .5) * 34, y0 = b[1] - h - R() * 8; lines += `M${f1(b[0] + (x - b[0]) * .2)} ${f1(b[1] - h - 2)}Q${f1(x)} ${f1(y0 - 6)} ${f1(x + (R() - .5) * 6)} ${f1(y0 + 24 + R() * 16)}`; }
      return out + `<path d="${lines}" stroke="${col}" stroke-width="1.5" fill="none"/>`;
    }
    if (season === 3) {
      let lines = '';
      for (let i = 0; i < 7; i++) { const an = -Math.PI * (.15 + R() * .7); lines += `M${f1(b[0])} ${f1(b[1] - h * .7)}l${f1(Math.cos(an) * 20)} ${f1(Math.sin(an) * 20)}l${f1((R() - .5) * 8)} ${f1(-6 - R() * 5)}`; }
      out += `<path d="${lines}" stroke="#4d3f2d" stroke-width="1.3" fill="none"/>`;
      for (let i = 0; i < 4; i++) out += `<ellipse cx="${f1(b[0] + (R() - .5) * 28)}" cy="${f1(b[1] - h - R() * 10)}" rx="8" ry="3" fill="#f6f4ec" opacity=".9"/>`;
      return out;
    }
    const pal = kind === 'pine' ? [['#6f8a68', '#5d7a5c'], ['#587a58', '#486a4b'], ['#60805d', '#4f7050']][season]
      : [['#d9a7a0', '#e3bdb3', '#9dba7f'], ['#7ea26b', '#6b9460', '#92b078'], ['#c98f42', '#b56a38', '#d4ad57']][season];
    for (let i = 0; i < 7; i++) {
      const x = b[0] + (R() - .5) * 30, y = b[1] - h - (R() - .3) * 18, r = 9 + R() * 8;
      out += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${pal[Math.floor(R() * pal.length)]}" opacity=".9" stroke="${INK}" stroke-width=".4" stroke-opacity=".55"/>`;
    }
    return out;
  }

  function mountains(seed, season) {
    const R = rng(seed);
    const layers = [
      { base: 215, amp: 95, col: '#9cb0ad', op: .5, step: 90 },
      { base: 255, amp: 75, col: '#7f9a91', op: .6, step: 70 },
      { base: 300, amp: 48, col: '#6b8a7c', op: .55, step: 54 }
    ];
    let out = '';
    layers.forEach((l, i) => {
      let d = `M-420 ${l.base + 120}`, x = -420;
      while (x < 1700) {
        const nx = x + l.step * (.6 + R() * .9), pk = l.base - R() * l.amp;
        d += ` Q${f1(x + (nx - x) * .4)} ${f1(pk)} ${f1(nx)} ${f1(l.base - R() * l.amp * .35)}`;
        x = nx;
      }
      d += ` L1700 ${l.base + 120} Z`;
      out += `<path d="${d}" fill="url(#mt${i})" opacity="${l.op}" filter="url(#soft)"/>`;
      // 皴法細線
      if (i === 2) out += `<path d="${d}" fill="none" stroke="#3f5850" stroke-width=".5" opacity=".28"/>`;
      if (season === 3 && i < 2) out += `<path d="${d}" fill="#f4f2ea" opacity=".3"/>`;
    });
    return out;
  }

  function figure(col, hat, scale) {
    const sc = scale || 1;
    return `<g transform="scale(${sc})"><ellipse cx="1" cy="1" rx="6" ry="2" fill="#3a2f20" opacity=".22"/><path d="M-4.5 0L-3 -13Q0 -16 3 -13L4.5 0Z" fill="${col}" stroke="${INK}" stroke-width=".5"/><circle cx="0" cy="-17" r="3.3" fill="#ecd7b8" stroke="${INK}" stroke-width=".5"/><path d="${hat === 2 ? 'M-5 -18.5L0 -23L5 -18.5Z' : hat === 1 ? 'M-3.2 -18Q0 -24 3.2 -18Z' : 'M-3.3 -17.5Q0 -22 3.3 -17.5Z'}" fill="${hat === 2 ? '#c6ab72' : '#3b3128'}" stroke="${INK}" stroke-width=".4"/></g>`;
  }

  /** 組出整個城鎮 SVG。key 相同時 UI 不需重畫，避免動畫重來。 */
  function townSvg(opts) {
    const { style, season, seed, s, war, compact } = opts;
    const st = STYLES[style] || STYLES.song;
    const locs = locations(s);
    const R = rng(seed);
    const grass = ['#cfd7ad', '#bfcf9a', '#d9cf9f', '#e6e4d8'][season];
    const grass2 = ['#bcc994', '#aabf84', '#c8ba80', '#d5d3c6'][season];
    const water = season === 3 ? '#c5d4d2' : '#a9c6c2';
    const fontSize = compact ? 34 : 19;

    let defs = `<defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7e3cf"/><stop offset=".55" stop-color="#efe8d4"/><stop offset="1" stop-color="#e9dfc4"/></linearGradient>
      <linearGradient id="mt0" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f9794"/><stop offset="1" stop-color="#e8e3cd"/></linearGradient>
      <linearGradient id="mt1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f7f76"/><stop offset="1" stop-color="#e5e1c9"/></linearGradient>
      <linearGradient id="mt2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f7263"/><stop offset="1" stop-color="#dcdcc0"/></linearGradient>
      <radialGradient id="stain"><stop offset="0" stop-color="#8ca06b" stop-opacity=".32"/><stop offset="1" stop-color="#8ca06b" stop-opacity="0"/></radialGradient>
      <linearGradient id="river" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${water}"/><stop offset="1" stop-color="#8fb4b1"/></linearGradient>
      <filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.3"/></filter>
      <filter id="mist" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
    </defs>`;

    let bg = `<rect x="-1500" y="-1500" width="4300" height="4300" fill="url(#sky)"/>`;
    bg += `<circle cx="1010" cy="92" r="42" fill="#f5efd2" stroke="#d9c98f" stroke-width=".8"/>`;
    bg += mountains(seed + 3, season);
    bg += `<ellipse cx="640" cy="300" rx="900" ry="32" fill="#f5f0de" opacity=".75" filter="url(#mist)"/>`;
    // 祥雲與飛鳥
    let birds = '';
    for (let i = 0; i < 5; i++) { const x = 180 + i * 34 + R() * 20, y = 90 + R() * 40; birds += `M${f1(x)} ${f1(y)}q5 -5 9 0q5 -5 9 0`; }
    bg += `<g class="birds"><path d="${birds}" stroke="#4a4438" stroke-width="1" fill="none"/></g>`;

    // 地面
    let ground = poly([P(-1.2, -1.2), P(14, -1.2), P(14, 14), P(-1.2, 14)], grass, `stroke="#8a7a58" stroke-width="1"`);
    for (let i = 0; i < 16; i++) { const p = P(R() * 13, R() * 13); ground += `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(50 + R() * 70)}" ry="${f1(20 + R() * 25)}" fill="url(#stain)"/>`; }
    ground += poly([P(-1.2, 14), P(14, 14), [P(14, 14)[0], P(14, 14)[1] + 26], [P(-1.2, 14)[0], P(-1.2, 14)[1] + 26]], '#b39f77', `stroke="#6d5c40" stroke-width=".8"`);
    ground += poly([P(14, -1.2), P(14, 14), [P(14, 14)[0], P(14, 14)[1] + 26], [P(14, -1.2)[0], P(14, -1.2)[1] + 26]], '#9d8a65', `stroke="#6d5c40" stroke-width=".8"`);

    // 城牆（後方，後世城市才有磚砌雉堞）
    if (style !== 'thatch') {
      const wallH = 22;
      let wl = poly([P(-1, -1, 0), P(13.6, -1, 0), P(13.6, -1, wallH), P(-1, -1, wallH)], style === 'han' ? '#bcae8d' : '#a8a596', `stroke="${INK}" stroke-width=".7"`);
      wl += poly([P(-1, -1, 0), P(-1, 13.6, 0), P(-1, 13.6, wallH), P(-1, -1, wallH)], style === 'han' ? '#c9bc9d' : '#b8b5a6', `stroke="${INK}" stroke-width=".7"`);
      let cren = '';
      for (let i = 0; i < 30; i++) { const a = P(-1 + i * .5, -1, wallH), b = P(-1 + i * .5 + .25, -1, wallH); cren += `M${pt(a)}L${f1(a[0])} ${f1(a[1] - 5)}L${f1(b[0])} ${f1(b[1] - 5)}L${pt(b)}`; }
      for (let i = 0; i < 30; i++) { const a = P(-1, -1 + i * .5, wallH), b = P(-1, -1 + i * .5 + .25, wallH); cren += `M${pt(a)}L${f1(a[0])} ${f1(a[1] - 5)}L${f1(b[0])} ${f1(b[1] - 5)}L${pt(b)}`; }
      wl += `<path d="${cren}" stroke="${INK}" stroke-width=".7" fill="none"/>`;
      ground += wl;
    } else {
      // 上古聚落：夯土垣與籬笆
      let f = '';
      for (let i = 0; i < 44; i++) { const a = P(-1 + i * .33, -1), c = [a[0], a[1] - 13]; f += `M${pt(a)}L${pt(c)}`; }
      for (let i = 0; i < 44; i++) { const a = P(-1, -1 + i * .33), c = [a[0], a[1] - 13]; f += `M${pt(a)}L${pt(c)}`; }
      ground += `<path d="${f}" stroke="#6b5a3c" stroke-width="1.4"/>`;
    }

    // 道路
    const road = season === 3 ? '#d8d2bd' : '#d9c9a1';
    const roadPoly = (a0, a1, b0, b1) => poly([P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)], road, `stroke="#a4916a" stroke-width=".6"`);
    ground += roadPoly(-1, 13.6, 3, 3.45) + roadPoly(-1, 13.6, 6.45, 6.95) + roadPoly(3.55, 4, -1, 13.8) + roadPoly(7, 7.5, -1, 13.8) + roadPoly(10.4, 10.8, -1, 7);
    // 路面石板細線
    let dots = '';
    for (let i = 0; i < 80; i++) { const a = P(-1 + i * .18, 6.5 + R() * .4); dots += `M${pt(a)}l3 1`; }
    for (let i = 0; i < 70; i++) { const a = P(3.6 + R() * .36, -1 + i * .2); dots += `M${pt(a)}l-3 1`; }
    ground += `<path d="${dots}" stroke="#8a7a58" stroke-width=".5" opacity=".6"/>`;

    // 河與橋
    ground += `<path d="M${pt(P(-1.2, 10.2))} C${pt(P(2, 10.2))} ${pt(P(4.5, 10.6))} ${pt(P(7.6, 11.3))} S${pt(P(7.5, 13))} ${pt(P(7.9, 14))} L${pt(P(5.4, 14))} C${pt(P(5.1, 13))} ${pt(P(4.7, 12))} ${pt(P(3, 11.9))} S${pt(P(-.6, 11.7))} ${pt(P(-1.2, 11.7))}Z" fill="url(#river)" stroke="#5e7f7b" stroke-width=".9"/>`;
    let ripples = '';
    for (let i = 0; i < 26; i++) { const p = P(-.6 + R() * 6.8, 10.5 + R() * 1.3); ripples += `M${pt(p)}q5 -2 11 0`; }
    ground += `<path class="ripple" d="${ripples}" stroke="#eef5ee" stroke-width=".9" fill="none" opacity=".75"/>`;
    // 石拱橋
    const bA = P(3.55, 9.9, 0), bB = P(4, 9.9, 0), bC = P(4, 12.1, 0), bD = P(3.55, 12.1, 0);
    ground += `<path d="M${pt(bA)}Q${pt(lerp(lerp(bA, bD, .5), [0, 0], 0).map((v, i) => (i ? v - 26 : v)))} ${pt(bD)}L${pt(bC)}Q${pt(lerp(bB, bC, .5).map((v, i) => (i ? v - 26 : v)))} ${pt(bB)}Z" fill="#c9bfa8" stroke="${INK}" stroke-width=".8"/>`;

    // 船
    const boat = P(1.2, 10.9);
    ground += `<g class="boat" transform="translate(${f1(boat[0])} ${f1(boat[1])})"><path d="M-22 0Q0 9 22 -3L18 -8Q0 -2 -18 -6Z" fill="#6f5a3f" stroke="${INK}" stroke-width=".7"/><path d="M-9 -5Q0 -17 10 -7Z" fill="#c9b184" stroke="${INK}" stroke-width=".6"/><path d="M15 -8l14 -16" stroke="${INK}" stroke-width="1"/></g>`;

    // 物件依遠近排序
    const items = [];
    const add = (g, html, loc) => items.push({ g, html, loc });
    locs.forEach(l => {
      let html = '';
      if (l.crop) html = crops(l, season, s ? s.year : 1000);
      else if (l.stalls) html = stalls(l, st, season);
      else if (l.tower) html = pagoda(st, l);
      else if (l.altar) html = altar(l);
      else html = house(st, l);
      if (l.yard) { // 家宅院牆
        const c = st.brick ? '#8c7158' : '#c7b897', h = 12;
        html = poly([P(l.gx - .45, l.gy + l.d + .5, 0), P(l.gx + l.w + .45, l.gy + l.d + .5, 0), P(l.gx + l.w + .45, l.gy + l.d + .5, h), P(l.gx - .45, l.gy + l.d + .5, h)].slice(0, 4), c, `stroke="${INK}" stroke-width=".6"`) + html;
      }
      if (l.flag || l.flag2) {
        const p = P(l.gx + l.w + .05, l.gy + l.d, l.h * (l.floors ? .55 : .7));
        const col = l.flag ? '#a84d38' : '#47685f', ch = l.flag ? (s && s.year >= 618 ? '茶' : '酒') : '醫';
        html += `<g transform="translate(${f1(p[0])} ${f1(p[1])})"><path d="M0 0v-40" stroke="${INK}" stroke-width="1.2"/><path class="banner" d="M0 -40h22v24l-6 -4l-6 4l-5 -4l-5 4Z" fill="${col}" stroke="${INK}" stroke-width=".5"/><text x="11" y="-24" font-size="11" text-anchor="middle" fill="#f8efdb">${ch}</text></g>`;
      }
      if (l.smoke) {
        const p = P(l.gx + .4, l.gy + .3, l.h + 34);
        html += `<g class="smoke" transform="translate(${f1(p[0])} ${f1(p[1])})"><circle r="5" fill="#8d8a7e" opacity=".35"/><circle cx="5" cy="-12" r="8" fill="#8d8a7e" opacity=".25"/><circle cx="-2" cy="-26" r="11" fill="#8d8a7e" opacity=".15"/></g>`;
      }
      const c = P(l.gx + l.w / 2, l.gy + l.d / 2);
      add(l.gx + l.gy + (l.crop ? -8 : l.w * .5 + l.d * .5), `<g class="spot" data-loc="${l.id}" data-group="${l.g}" tabindex="0" role="button" aria-label="${l.name}">${html}</g>`, l);
    });

    // 樹與雜屋
    [[.4, 1.6, 'pine'], [-.3, 5, 'tree'], [.3, 9.3, 'willow'], [2.8, 9.3, 'willow'], [6.4, 9.7, 'willow'], [6.6, 2.2, 'tree'], [12.6, .5, 'pine'], [11.4, 1.2, 'tree'], [7.6, 2.4, 'tree'], [5.9, 3.5, 'tree'], [3.2, 2.2, 'tree'], [13.2, 7.6, 'tree'], [7.2, 12.2, 'tree'], [-.4, 12.8, 'willow'], [11, 12.8, 'tree'], [9.5, 6.9, 'tree']].forEach((t, i) => {
      add(t[0] + t[1], tree(t[0], t[1], season, t[2], seed + i * 17 + 3));
    });
    [[.1, -.1, 1.3, 1.2], [1.8, -.2, 1.2, 1.2], [12, 8, 1.3, 1.2], [.3, 12.4, 1.3, 1.1], [2.2, 12.5, 1.2, 1]].forEach((b, i) => {
      const html = house(st, { gx: b[0], gy: b[1], w: b[2], d: b[3], h: 26 });
      add(b[0] + b[1] + .5, html);
    });
    // 井
    const w = P(6.7, 5.7);
    add(12.4, `<g transform="translate(${f1(w[0])} ${f1(w[1])})"><ellipse cx="0" cy="-3" rx="9" ry="4.5" fill="#6e6a60" stroke="${INK}" stroke-width=".7"/><ellipse cx="0" cy="-5" rx="6" ry="3" fill="#2f3b3a"/></g>`);
    items.sort((a, b) => a.g - b.g);
    let world = items.map(x => x.html).join('');

    // 戰亂：遠處烽煙
    let warFx = '';
    if (war) {
      [[150, 290], [1120, 310], [320, 230]].forEach((p, i) => {
        warFx += `<g class="warsmoke" style="animation-delay:${i * -3}s" transform="translate(${p[0]} ${p[1]})"><path d="M0 0C-8 -24 14 -36 -2 -62C-12 -80 16 -94 4 -120" stroke="#3c3630" stroke-width="10" fill="none" opacity=".33" filter="url(#soft)" stroke-linecap="round"/></g>`;
      });
    }

    // 行人（路上走動）
    const walkers = [];
    const routes = [
      [P(-1, 6.7), P(13.4, 6.7)], [P(13.4, 3.2), P(-1, 3.2)], [P(3.8, -1), P(3.8, 13.6)], [P(7.25, 13.5), P(7.25, -1)],
      [P(10.6, -1), P(10.6, 6.7)], [P(-1, 3.2), P(13.2, 3.2)], [P(3.8, 13.4), P(3.8, -.8)], [P(13.4, 6.7), P(-1, 6.7)]
    ];
    const robe = ['#a84d38', '#5e7c74', '#c9a24f', '#8a6d9e', '#66808f', '#7b5f49', '#b78965', '#4f6c5f'];
    routes.forEach((r, i) => {
      const dur = 42 + R() * 46, begin = -R() * dur;
      walkers.push(`<g><animateMotion dur="${f1(dur)}s" begin="${f1(begin)}s" repeatCount="indefinite" path="M${pt(r[0])}L${pt(r[1])}"/>${figure(robe[i], i % 3)}</g>`);
    });

    // 雪
    let snow = '';
    if (season === 3) {
      for (let i = 0; i < 90; i++) { const x = -100 + R() * 1500, y = R() * 760; snow += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(.7 + R() * 1.6)}" fill="#fff" opacity=".8"/>`; }
      snow = `<g class="snow">${snow}</g>`;
    } else if (season === 0) {
      for (let i = 0; i < 26; i++) { const x = 80 + R() * 1120, y = 210 + R() * 500; snow += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="2.1" ry="1.1" fill="#e9b9b0" opacity=".8" transform="rotate(${f1(R() * 90)} ${f1(x)} ${f1(y)})"/>`; }
      snow = `<g class="petals">${snow}</g>`;
    }

    // 地名牌
    let labels = '';
    locs.forEach(l => {
      const lift = l.h ? l.h + (l.tower ? 150 : l.floors ? 38 : 36) : 44;
      const anchor = l.crop ? P(l.gx + l.w / 2, l.gy + l.d / 2, 20) : l.stalls ? P(l.gx + 1, l.gy + 1.6, lift) : P(l.gx + l.w / 2, l.gy + l.d / 2, lift);
      const w2 = l.name.length * fontSize + (compact ? 22 : 16), h2 = fontSize + (compact ? 14 : 10);
      labels += `<g class="tag" data-loc="${l.id}" data-group="${l.g}" transform="translate(${f1(anchor[0])} ${f1(anchor[1])})"><rect x="${f1(-w2 / 2)}" y="${f1(-h2 / 2)}" width="${f1(w2)}" height="${f1(h2)}" rx="2" fill="#f8f1dd" stroke="#7a2e22" stroke-width="${compact ? 2 : 1.2}"/><rect x="${f1(-w2 / 2 + 2.5)}" y="${f1(-h2 / 2 + 2.5)}" width="${f1(w2 - 5)}" height="${f1(h2 - 5)}" fill="none" stroke="#a84d38" stroke-width=".5"/><text y="${f1(fontSize * .36)}" text-anchor="middle" font-size="${fontSize}" fill="#3f2a20" font-weight="600">${l.name}</text></g>`;
    });

    return `<svg class="town" viewBox="70 76 1140 690" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="古代城鎮全景">${defs}${bg}${warFx}<g>${ground}</g><g>${world}</g><g class="people" pointer-events="none">${walkers.join('')}</g><g id="playerMark" pointer-events="none"></g>${snow}<g>${labels}</g><rect class="paperlayer" x="-1500" y="-1500" width="4300" height="4300" pointer-events="none"/></svg>`;
  }

  function playerFigure(s) {
    const col = s.sex === 'm' ? '#7a2e22' : '#a84d62';
    const sc = s.age < 7 ? .75 : s.age < 15 ? .95 : 1.25;
    return `<g class="pm-inner">${figure(col, s.sex === 'm' ? 1 : 0, sc)}<path d="M-6 -46l6 8l6 -8z" fill="#a84d38" stroke="#fff5e3" stroke-width="1"/></g>`;
  }
  function placeOf(s, locId) {
    const l = locations(s).find(x => x.id === locId) || locations(s)[3];
    const p = P(l.gx + l.w / 2 + (l.crop ? 0 : .1), l.gy + l.d + (l.crop ? -2 : .35));
    return p;
  }

  // 人物小像：隨時代、性別與年齡變化的工筆半身
  function portrait(s) {
    const old = s.age >= 60, kid = s.age < 12;
    const hair = old ? '#c9c5b8' : '#2b2622';
    const style = s.year < -221 ? 0 : s.year < 618 ? 1 : s.year < 1280 ? 2 : s.year < 1912 ? 3 : 4;
    const robe = s.sex === 'm' ? ['#6c7a5e', '#6a4f3e', '#44606a', '#3f5563', '#3a4656'][style] : ['#a2705e', '#a65a55', '#b4656e', '#6b7fa0', '#6d8f9a'][style];
    let head = '';
    if (kid) head = s.sex === 'm' ? `<circle cx="36" cy="22" r="5" fill="${hair}"/><circle cx="60" cy="22" r="5" fill="${hair}"/>` : `<circle cx="34" cy="26" r="6" fill="${hair}"/><circle cx="62" cy="26" r="6" fill="${hair}"/>`;
    else if (s.sex === 'm') head = style === 4 ? `<path d="M31 34Q31 18 48 18Q65 18 65 34Q57 26 48 27Q38 27 31 34Z" fill="${hair}"/>` : style === 3 ? `<path d="M30 30Q48 12 66 30Z" fill="#2f2a26"/><circle cx="48" cy="17" r="3" fill="#a84d38"/>` : `<path d="M32 32Q33 16 48 16Q63 16 64 32Q56 26 48 26Q40 26 32 32Z" fill="${hair}"/><rect x="43" y="8" width="10" height="11" rx="2" fill="#2f2a26"/>`;
    else head = style === 4 ? `<path d="M30 42Q28 16 48 16Q68 16 66 42Q62 28 48 27Q34 28 30 42Z" fill="${hair}"/>` : `<path d="M30 40Q28 17 48 16Q68 17 66 40Q60 27 48 27Q36 27 30 40Z" fill="${hair}"/><ellipse cx="48" cy="12" rx="11" ry="6" fill="${hair}"/><path d="M58 11l10 -4" stroke="#a8843f" stroke-width="1.6"/><circle cx="68" cy="7" r="1.8" fill="#a84d38"/>`;
    const beard = s.sex === 'm' && s.age >= 35 ? `<path d="M44 49Q48 ${old ? 62 : 56} 52 49" fill="${hair}" stroke="${hair}" stroke-width=".6"/>` : '';
    const face = kid ? 16 : 17;
    return `<svg viewBox="0 0 96 96" class="portrait" role="img" aria-label="人物小像"><rect width="96" height="96" fill="#efe6d0"/><circle cx="48" cy="48" r="44" fill="#e6dcc0" stroke="#bda87f" stroke-width=".6"/><path d="M14 96Q18 62 48 60Q78 62 82 96Z" fill="${robe}" stroke="#3a342b" stroke-width=".8"/><path d="M38 62L48 78L58 62" fill="#f0e6d0" stroke="#3a342b" stroke-width=".7"/><path d="M48 78V96" stroke="#3a342b" stroke-width=".6"/><ellipse cx="48" cy="38" rx="${face * .9}" ry="${face}" fill="#efd8b9" stroke="#3a342b" stroke-width=".7"/>${head}<path d="M41 37q2.5 -1.6 5 0M51 37q2.5 -1.6 5 0" stroke="#2c2520" stroke-width="1" fill="none"/><circle cx="43.5" cy="39" r=".9" fill="#2c2520"/><circle cx="53.5" cy="39" r=".9" fill="#2c2520"/><path d="M45 47q3.2 2 6 0" stroke="#8c4a3a" stroke-width=".9" fill="none"/>${old ? '<path d="M38 43q3 2 6 1M52 44q3 1 6 -1" stroke="#a48c70" stroke-width=".5" fill="none"/>' : ''}${beard}</svg>`;
  }

  const api = { townSvg, playerFigure, placeOf, portrait, locations };
  root.FS_ART = api;
})(typeof window !== 'undefined' ? window : globalThis);
