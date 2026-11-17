/* 浮生千年：音樂與音效。全部用瀏覽器即時合成（五聲音階的撥弦聲），不需要任何音檔。 */
(function (root) {
  'use strict';
  const KEY = 'fusheng.audio.v1';
  let ctx = null, master = null, musicGain = null, sfxGain = null, timer = null, step = 0;
  let conf = { music: true, sfx: true };
  try { conf = Object.assign(conf, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* 用預設值 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(conf)); } catch (e) { /* 存不了也照常播放 */ } };

  // 宮商角徵羽：D 宮五聲音階，橫跨三個八度
  const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25];

  function ensure() {
    if (ctx) return true;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = conf.music ? .5 : 0;
    sfxGain = ctx.createGain(); sfxGain.gain.value = conf.sfx ? .7 : 0;
    // 簡單的迴響：兩道延遲回授，讓撥弦有餘韻
    const delay = ctx.createDelay(1.2), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = .33; fb.gain.value = .32; wet.gain.value = .3;
    musicGain.connect(master); musicGain.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    sfxGain.connect(master);
    return true;
  }
  // 撥弦：三角波加一點泛音，快起慢收
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
      o.frequency.exponentialRampToValueAtTime(freq * mul * .996, t + dur);
      og.gain.value = amp; o.connect(og); og.connect(g);
      o.start(t); o.stop(t + dur + .05);
    });
  }
  // 背景音樂：在音階上慢慢遊走，偶爾留白、偶爾加一個低音
  let pos = 5;
  function tick() {
    if (!ctx || !conf.music) return;
    const t = ctx.currentTime + .05;
    step++;
    if (step % 8 === 1) pluck(SCALE[[0, 3, 0, 4][(step >> 3) % 4]] / 2, t, 3.6, .16, musicGain);
    if (Math.random() < .78) {
      pos = Math.max(2, Math.min(SCALE.length - 1, pos + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
      pluck(SCALE[pos], t, 2.4, .13 + Math.random() * .05, musicGain);
      if (Math.random() < .22) pluck(SCALE[Math.max(0, pos - 2)], t + .18, 2.0, .08, musicGain);
    }
  }
  function startMusic() {
    if (!ensure() || timer) return;
    timer = setInterval(tick, 900);
  }
  const SFX = {
    tap: () => pluck(880, 0, .12, .1, sfxGain),
    act: () => { pluck(293.66, 0, .5, .2, sfxGain); pluck(440, ctx.currentTime + .09, .5, .16, sfxGain); },
    good: () => [587.33, 739.99, 880, 1174.66].forEach((f, i) => pluck(f, ctx.currentTime + i * .1, .9, .17, sfxGain)),
    bad: () => { pluck(196, 0, .9, .2, sfxGain); pluck(185, ctx.currentTime + .16, 1.1, .18, sfxGain); },
    year: () => [220, 293.66, 369.99].forEach((f, i) => pluck(f, ctx.currentTime + i * .13, 1.3, .16, sfxGain)),
    event: () => { pluck(659.25, 0, .5, .12, sfxGain); pluck(493.88, ctx.currentTime + .12, .7, .12, sfxGain); },
    end: () => [293.66, 246.94, 220, 185, 146.83].forEach((f, i) => pluck(f, ctx.currentTime + i * .34, 2.6, .2, sfxGain))
  };
  function play(name) {
    if (!conf.sfx || !ensure() || !SFX[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    try { SFX[name](); } catch (e) { /* 音效失敗不影響遊戲 */ }
  }
  function set(kind, on) {
    conf[kind] = !!on; save();
    if (!ensure()) return;
    if (kind === 'music') { musicGain.gain.setTargetAtTime(on ? .5 : 0, ctx.currentTime, .3); if (on) startMusic(); }
    if (kind === 'sfx') sfxGain.gain.setTargetAtTime(on ? .7 : 0, ctx.currentTime, .05);
  }
  // 瀏覽器規定要使用者先點一下才能出聲
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (conf.music) startMusic();
  }
  root.addEventListener && root.addEventListener('pointerdown', unlock, { once: true });
  root.addEventListener && root.addEventListener('keydown', unlock, { once: true });
  root.FS_AUDIO = { play, set, get: k => conf[k] };
})(typeof window !== 'undefined' ? window : globalThis);
