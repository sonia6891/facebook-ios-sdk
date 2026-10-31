#!/usr/bin/env node
/* 用隨機玩家跑大量人生，檢查規則不會崩潰，並回報分布。用法：node simulate.js [人生數] */
'use strict';
const assert = require('assert');
const G = require('../js/engine.js');
const D = require('../js/data.js');

const N = Number(process.argv[2] || 5000);

// 資料一致性：商朝至民國年年有朝代、史事落在範圍內、人物生卒合理
for (let y = D.ERAS[0].start; y <= 1949; y++) {
  const e = D.ERAS.filter(x => y >= x.start && y <= x.end);
  assert.strictEqual(e.length, 1, `${y} 應只屬於一個朝代，實得 ${e.map(x => x.name)}`);
}
D.ERAS.forEach(e => assert(e.start <= e.end && e.cities.length, e.name));
D.HISTORY.forEach(h => { assert(h.y >= D.ERAS[0].start && h.y <= 1949 && h.fact && h.alt && h.title, h.title); });
assert.strictEqual(new Set(D.HISTORY.map(h => h.y)).size, D.HISTORY.length, '史事年份不可重複');
D.FIGURES.forEach(f => assert(f[1] < f[2] && D.SKILLS[f[3]], f[0]));
assert.strictEqual(G.ganzhi(1984), '甲子'); assert.strictEqual(G.ganzhi(1911), '辛亥'); assert.strictEqual(G.ganzhi(-1), '庚申'); assert.strictEqual(G.ganzhi(1644), '甲申');

const eraHits = {}, deathCauses = {}, legacy = {};
const lifes = [], careful = []; let kids = 0, married = 0, hit = 0, div3 = 0, evs = 0, years = 0, turns = 0, ill = 0;
const actionUse = {}, eventUse = {};

function check(s, tag) {
  for (const k of ['hp', 'mood', 'money', 'fame', 'virtue', 'year', 'age']) assert(Number.isFinite(s[k]), `${tag}: ${k}=${s[k]}`);
  for (const k in s.skills) assert(Number.isFinite(s.skills[k]) && s.skills[k] >= 0 && s.skills[k] <= 100, `${tag}: ${k}`);
  assert(!/undefined|NaN|\[object/.test(JSON.stringify(s.pending.map(p => [p.title, p.text, p.choices.map(c => c.label + c.hint)]))), `${tag} 文字異常 ${JSON.stringify(s.pending[0])}`);
}

for (let i = 0; i < N; i++) {
  const fate = G.drawFate(i * 7919 + 3);
  eraHits[fate.eraId] = (eraHits[fate.eraId] || 0) + 1;
  const s = G.newLife(fate);
  const R = { rng: i * 31 + 1 };
  const r = () => { R.rng = (R.rng * 1664525 + 1013904223) | 0; return (R.rng >>> 0) / 4294967296; };
  let guard = 0;
  while (s.alive) {
    assert(++guard < 3000, '人生無法結束');
    while (s.pending.length && s.alive) {
      const ev = G.top(s);
      eventUse[ev.id] = (eventUse[ev.id] || 0) + 1; evs++;
      const open = ev.choices.filter(c => !c.off);
      assert(open.length, `事件 ${ev.id} 沒有可選項`);
      // 重新解析 pending 前保險檢查
      const before = JSON.stringify(s).length;
      assert(before < 2e6, '存檔過大');
      // 偶數局模擬用心的玩家：生病找最好的醫生，其餘事件隨機
      const c = (i % 2 === 0 && ev.id === 'illness') ? open[0] : open[Math.floor(r() * open.length)];
      const res = G.resolve(s, c.i, r() < .3 ? '小寶' : undefined);
      assert(res && typeof res.text === 'string', ev.id);
      check(s, ev.id);
    }
    if (!s.alive) break;
    const list = G.actionList(s).filter(a => !a.off);
    let act = list.length && r() < .92 ? list[Math.floor(r() * list.length)] : null;
    if (i % 2 === 0 && list.length) {
      const want = s.hp < 55 ? 'rest' : s.age < 15 ? 'study' : !s.job ? 'seekjob' : !G.spouse(s) && s.age < 40 ? 'match' : s.money < 15 ? 'work' : null;
      if (['seekjob', 'match'].includes(want) && s.triedY === s.year) act = list.find(a => a.id === 'work') || act;
      else { act = list.find(a => a.id === want) || act; s.triedY = s.year; }
    }
    if (act && s.ap > 0) {
      actionUse[act.id] = (actionUse[act.id] || 0) + 1;
      G.doAction(s, act.id); turns++;
      check(s, act.id);
      continue;
    }
    if (s.pending.length) continue;
    assert(G.endYear(s));
    years++;
    check(s, 'endYear');
  }
  JSON.parse(JSON.stringify(s));
  assert(s.biography && s.biography.paragraphs.length >= 2);
  const txt = G.bioText(s);
  assert(!/undefined|NaN|\[object/.test(txt), '傳記文字異常：' + txt);
  lifes.push(s.age);
  if (i % 2 === 0) careful.push(s.age);
  const cause = s.death.cause.replace(/.*不治$/, '病故').replace(/^死於.*/, '死於時局');
  deathCauses[cause] = (deathCauses[cause] || 0) + 1;
  legacy[s.biography.legacy.n] = (legacy[s.biography.legacy.n] || 0) + 1;
  kids += G.children(s).length;
  if (s.npcs.some(n => ['spouse', 'late', 'ex'].includes(n.rel))) married++;
  if (s.hist.length) hit++;
  if (s.div.some(d => d.tier === 3)) div3++;
  if (s.log.some(l => l.k === 'ill')) ill++;
}

// 隨機性：每個朝代都要抽到，且比例接近平均
D.ERAS.forEach(e => {
  const share = (eraHits[e.id] || 0) / N;
  assert(share > .5 / D.ERAS.length && share < 1.5 / D.ERAS.length, `${e.name} 抽中比例異常 ${share}`);
});

// 同一 seed 重現
const a = G.newLife(G.drawFate(42)), b = G.newLife(G.drawFate(42));
assert.strictEqual(JSON.stringify(a), JSON.stringify(b), '相同 seed 應得到相同人生');

// 所有動作與事件至少出現過
const neverA = G.ACTIONS.map(x => x.id).filter(id => !actionUse[id]);
const neverE = Object.keys(G.EVENTS).filter(id => !eventUse[id]);

lifes.sort((x, y) => x - y);
const avg = lifes.reduce((t, x) => t + x, 0) / N;
const pct = p => lifes[Math.floor(N * p)];
console.log(`人生 ${N}｜平均壽命 ${avg.toFixed(1)}｜p5 ${pct(.05)} p25 ${pct(.25)} p50 ${pct(.5)} p75 ${pct(.75)} p95 ${pct(.95)} max ${lifes[N - 1]}`);
console.log(`用心玩家平均壽命 ${(careful.reduce((t, x) => t + x, 0) / careful.length).toFixed(1)}`);
console.log(`15 歲前夭折 ${(lifes.filter(x => x < 15).length / N * 100).toFixed(1)}%｜已婚 ${(married / N * 100).toFixed(0)}%｜平均子女 ${(kids / N).toFixed(2)}｜得過病 ${(ill / N * 100).toFixed(0)}%`);
console.log(`遇到史事 ${(hit / N * 100).toFixed(0)}%｜改寫歷史 ${(div3 / N * 100).toFixed(1)}%`);
console.log('評定', legacy);
console.log('死因', Object.entries(deathCauses).sort((x, y) => y[1] - x[1]).slice(0, 12).map(x => x.join(':')).join('  '));
console.log('朝代抽中', D.ERAS.map(e => e.name + ':' + (eraHits[e.id] || 0)).join(' '));
if (neverA.length) console.log('未觸發動作', neverA.join(','));
if (neverE.length) console.log('未觸發事件', neverE.join(','));
console.log('OK');
