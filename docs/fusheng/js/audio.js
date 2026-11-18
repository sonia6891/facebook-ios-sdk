/* 浮生千年：音樂與音效。
   音效、環境聲與兩首配樂取自《古人有嘻哈》專案（assets/audio/）；另有一種由程式即時彈奏的撥弦配樂。
   音檔放不出來時（檔案缺少或瀏覽器不支援），音效會退回即時合成，遊戲照常進行。 */
(function (root) {
  'use strict';
  const KEY = 'fusheng.audio.v1', DIR = 'assets/audio/';
  let conf = { music: true, sfx: true, amb: true, mode: 'synth', vmusic: 1, vsfx: 1, vamb: 1 };
  try { conf = Object.assign(conf, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* 用預設值 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(conf)); } catch (e) { /* 存不了也照常播放 */ } };
  const MODES = [['synth', '撥弦（即時彈奏）'], ['city', '城鎮曲'], ['calm', '靜謐曲']];
  let unlocked = false;

  /* ---------- 音檔 ---------- */
  const VOL = { tap: .35, page: .5, paper: .6, act: .5, good: .55, cheer: .6, bad: .5, worse: .55, year: .6, end: .7, coin: .55, bell: .5, birth: .6, door: .45, tea: .5, steps: .5, joy: .5 };
  const pool = {}, broken = {};
  function file(name) {
    if (broken[name]) return null;
    if (!pool[name]) {
      const a = new Audio(DIR + name + '.ogg');
      a.preload = 'auto';
      a.addEventListener('error', () => { broken[name] = true; });
      pool[name] = a;
    }
    return pool[name];
  }
  function playFile(name) {
    const base = file(name);
    if (!base) return false;
    // 同一個音效可能連續觸發，複製一份才不會互相打斷
    const a = base.paused ? base : base.cloneNode();
    a.volume = Math.min(1, (VOL[name] || .5) * conf.vsfx);
    try { a.currentTime = 0; } catch (e) { /* 還沒載入完成 */ }
    const p = a.play();
    if (p && p.catch) p.catch(() => { broken[name] = true; synth(name); });
    return true;
  }

  /* ---------- 即時合成（撥弦配樂，以及音檔失效時的備用音效） ---------- */
  let ctx = null, master = null, musicGain = null, sfxGain = null, timer = null, step = 0, pos = 5;
  const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25];
  function ensure() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0;
    sfxGain = ctx.createGain(); sfxGain.gain.value = .7;
    const delay = ctx.createDelay(1.2), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = .33; fb.gain.value = .32; wet.gain.value = .3;
    musicGain.connect(master); musicGain.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    sfxGain.connect(master);
    return true;
  }
  function pluck(freq, when, dur, vol, out) {
    const t = when || ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0008, t + dur);
    g.connect(out);
    [[1, 'triangle', 1], [2, 'sine', .28], [3, 'sine', .1]].forEach(([mul, type, amp]) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq * mul, t);
      og.gain.value = amp; o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + .05);
    });
  }
  function tick() {
    if (!ctx || !conf.music || conf.mode !== 'synth') return;
    const t = ctx.currentTime + .05;
    step++;
    if (step % 8 === 1) pluck(SCALE[[0, 3, 0, 4][(step >> 3) % 4]] / 2, t, 3.6, .16, musicGain);
    if (Math.random() < .78) {
      pos = Math.max(2, Math.min(SCALE.length - 1, pos + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      pluck(SCALE[pos], t, 2.4, .13 + Math.random() * .05, musicGain);
      if (Math.random() < .22) pluck(SCALE[Math.max(0, pos - 2)], t + .18, 2.0, .08, musicGain);
    }
  }
  const SYNTH = {
    tap: () => pluck(880, 0, .12, .1, sfxGain),
    good: () => [587.33, 739.99, 880, 1174.66].forEach((f, i) => pluck(f, ctx.currentTime + i * .1, .9, .17, sfxGain)),
    bad: () => { pluck(196, 0, .9, .2, sfxGain); pluck(185, ctx.currentTime + .16, 1.1, .18, sfxGain); },
    year: () => [220, 293.66, 369.99].forEach((f, i) => pluck(f, ctx.currentTime + i * .13, 1.3, .16, sfxGain)),
    end: () => [293.66, 246.94, 220, 185, 146.83].forEach((f, i) => pluck(f, ctx.currentTime + i * .34, 2.6, .2, sfxGain))
  };
  const ALIAS = { cheer: 'good', joy: 'good', coin: 'good', bell: 'good', birth: 'year', worse: 'bad', page: 'tap', paper: 'tap', door: 'tap', tea: 'tap', steps: 'tap', act: 'tap' };
  function synth(name) {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const fn = SYNTH[name] || SYNTH[ALIAS[name]];
    try { if (fn) fn(); } catch (e) { /* 音效失敗不影響遊戲 */ }
  }

  /* ---------- 配樂與環境聲（循環播放，切換時淡入淡出） ---------- */
  const loops = {};
  function loop(key, name, vol) {
    let l = loops[key];
    if (!l) l = loops[key] = { el: null, name: '', target: 0 };
    if (l.name !== name) {
      if (l.el) { const old = l.el; fade(old, 0, () => old.pause()); }
      l.name = name;
      l.el = name ? new Audio(DIR + name + '.ogg') : null;
      if (l.el) { l.el.loop = true; l.el.volume = 0; }
    }
    l.target = vol;
    if (l.el && unlocked) { if (vol > 0) { const p = l.el.play(); if (p && p.catch) p.catch(() => {}); } fade(l.el, vol, vol > 0 ? null : () => l.el && l.el.pause()); }
  }
  function fade(el, to, done) {
    clearInterval(el._f);
    el._f = setInterval(() => {
      const d = to - el.volume;
      if (Math.abs(d) < .02) { el.volume = to; clearInterval(el._f); if (done) done(); return; }
      el.volume = Math.max(0, Math.min(1, el.volume + Math.sign(d) * .02));
    }, 40);
  }
  let ambName = '';
  function applyMusic() {
    const on = conf.music;
    loop('bgm', on && conf.mode === 'city' ? 'bgm_city' : on && conf.mode === 'calm' ? 'bgm_calm' : '', .32 * conf.vmusic);
    if (ensure()) {
      musicGain.gain.setTargetAtTime(on && conf.mode === 'synth' ? .5 * conf.vmusic : 0, ctx.currentTime, .3);
      sfxGain.gain.setTargetAtTime(.7 * conf.vsfx, ctx.currentTime, .05);
      if (on && conf.mode === 'synth' && !timer) timer = setInterval(tick, 900);
    }
  }
  function applyAmb() { loop('amb', conf.amb ? ambName : '', .22 * conf.vamb); }

  /* ---------- 對外 ---------- */
  function play(name) {
    if (!conf.sfx) return;
    if (!playFile(name)) synth(name);
  }
  function ambience(name) { ambName = name || ''; applyAmb(); }
  function set(kind, on) {
    conf[kind] = !!on; save();
    if (kind === 'music') applyMusic();
    if (kind === 'amb') applyAmb();
  }
  function nextMode() {
    const i = MODES.findIndex(m => m[0] === conf.mode);
    conf.mode = MODES[(i + 1) % MODES.length][0]; save();
    applyMusic();
    return modeName();
  }
  function setVol(kind, v) { conf['v' + kind] = Math.max(0, Math.min(1, v)); save(); if (kind === 'music' || kind === 'sfx') applyMusic(); if (kind === 'amb') applyAmb(); }
  const vol = kind => (conf['v' + kind] == null ? 1 : conf['v' + kind]);
  const modeName = () => (MODES.find(m => m[0] === conf.mode) || MODES[0])[1];
  // 瀏覽器規定要使用者先點一下才能出聲
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (ensure() && ctx.state === 'suspended') ctx.resume();
    applyMusic(); applyAmb();
  }
  if (root.addEventListener) { root.addEventListener('pointerdown', unlock, { once: true }); root.addEventListener('keydown', unlock, { once: true }); }
  root.FS_AUDIO = { play, set, get: k => conf[k], ambience, nextMode, modeName, setVol, vol };
})(typeof window !== 'undefined' ? window : globalThis);
