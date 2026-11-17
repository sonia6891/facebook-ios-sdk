/* 浮生千年：畫面與互動。規則都在 engine.js，美術對應在 look.js，這裡只負責顯示與存檔。 */
(function () {
  'use strict';
  const G = window.FS_ENGINE, D = window.FS_DATA, L = window.FS_LOOK;
  const AU = window.FS_AUDIO || { play() {}, set() {}, get() { return false; } };
  const oddsTag = v => (v == null ? '' : `<span class="odds ${v >= 65 ? 'hi' : v >= 40 ? 'mid' : 'lo'}">成功率 ${v}%</span>`);
  const $ = id => document.getElementById(id);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SAVE = 'fusheng.save.v2', ARCHIVE = 'fusheng.archive.v2', ACHKEY = 'fusheng.ach.v1';
  // 桌面版（Steam）會提供 fsDesktop：把存檔另寫成檔案供雲端同步、解鎖 Steam 成就、全螢幕與離開
  const desk = window.fsDesktop || null;
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { const j = JSON.stringify(v); try { localStorage.setItem(k, j); } catch (e) { /* 無痕或停用儲存時，遊戲仍可玩 */ } if (desk) desk.mirror(k, j); },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } if (desk) desk.mirror(k, null); }
  };
  // 換了電腦、瀏覽器存檔是空的，就從桌面版的存檔檔案讀回來
  if (desk) [SAVE, ARCHIVE, ACHKEY].forEach(k => { try { if (localStorage.getItem(k) == null) { const j = desk.load(k); if (j) localStorage.setItem(k, j); } } catch (e) { /* 讀不到就當作新玩家 */ } });

  /* ---------- 成就 ---------- */
  const ACH = [
    ['first_life', '初入人間', '走完第一世', (l, done) => done],
    ['long_life', '古稀之年', '活到七十歲', l => l.age >= 70],
    ['official', '金榜題名', '通過選官考核，踏入仕途', l => !!l.flags.entered],
    ['wealthy', '家財萬貫', '積蓄達到 500', l => l.money >= 500],
    ['landlord', '良田美宅', '名下產業達五處', l => (l.assets || []).length >= 5],
    ['family', '兒孫滿堂', '養育四名子女', l => l.npcs.filter(n => n.rel === 'child').length >= 4],
    ['lineage', '三代傳家', '家族延續到第三代', l => (l.gen || 1) >= 3],
    ['author', '著書立說', '留下一部著作', l => l.works.length >= 1],
    ['builder', '造福鄉里', '完成一項地方事業', l => l.projects.some(p => p.done)],
    ['friends', '名士之交', '結識三位當世名士', l => l.met.length >= 3],
    ['virtue', '德高望重', '德行達到 60', l => l.virtue >= 60],
    ['history', '改寫歷史', '左右一件載入史冊的大事', l => l.div.some(d => d.tier >= 2)],
    ['legend', '扭轉乾坤', '徹底改變一件大事的結局', l => l.div.some(d => d.tier >= 3)],
    ['eras5', '五朝過客', '在五個不同時代走完人生', () => new Set((store.get(ARCHIVE) || []).map(x => x.eraId)).size >= 5],
    ['eras21', '千年一夢', '二十一個時代都走過一世', () => new Set((store.get(ARCHIVE) || []).map(x => x.eraId)).size >= D.ERAS.length]
  ];
  function checkAch(life, done) {
    const got = store.get(ACHKEY) || {};
    let fresh = false;
    ACH.forEach(([id, n, d, test]) => {
      if (got[id]) return;
      let ok = false;
      try { ok = !!test(life, done); } catch (e) { ok = false; }
      if (!ok) return;
      got[id] = Date.now(); fresh = true;
      toast(`成就解鎖：${n}`, d);
      if (desk) desk.unlock(id);
    });
    if (fresh) store.set(ACHKEY, got);
  }
  let toastT, toastBusy = false;
  const toastQ = [];
  function toast(title, sub) { toastQ.push([title, sub]); if (!toastBusy) nextToast(); }
  function nextToast() {
    const item = toastQ.shift();
    if (!item) { toastBusy = false; return; }
    toastBusy = true;
    let el = $('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.innerHTML = `<b>${esc(item[0])}</b><small>${esc(item[1] || '')}</small>`;
    el.classList.add('on');
    AU.play('good');
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.classList.remove('on'); setTimeout(nextToast, 380); }, toastQ.length ? 1900 : 3200);
  }
  // 志向與才能的喜訊：引擎記在 s.cheer，畫面播完就清掉
  function showCheer() {
    if (!s || !s.cheer || !s.cheer.length) return;
    s.cheer.forEach(c => toast(c.t, c.d));
    s.cheer = [];
  }

  let answers = [], fate = null, s = null, sheet = null, actTab = 'study', picked = null;
  const GROUPS = [
    { id: 'study', n: '學習' }, { id: 'work', n: '工作' }, { id: 'social', n: '社交' },
    { id: 'family', n: '家庭' }, { id: 'health', n: '養生' }, { id: 'world', n: '世事' }
  ];
  const SK_ICON = { wen: '書', wu: '武', gong: '匠', shang: '商', yi: '醫', nong: '農' };

  function show(id) {
    document.querySelectorAll('.screen').forEach(x => x.classList.add('hidden'));
    $(id).classList.remove('hidden');
    scrollTo(0, 0);
  }

  /* ---------- 首頁 ---------- */
  function home() {
    show('home');
    $('btnContinue').classList.toggle('hidden', !store.get(SAVE));
    $('btnExit').classList.toggle('hidden', !desk);
  }
  $('btnExit').onclick = () => { if (desk) desk.quit(); };
  $('btnContinue').onclick = () => {
    const saved = store.get(SAVE);
    if (saved && saved.v === 2) { s = saved; if (!s.loc || !L.PLACES.some(p => p.id === s.loc)) s.loc = 'town'; enterGame(); }
  };
  $('btnQuiz').onclick = () => { answers = []; show('quiz'); renderQuiz(); };
  $('btnSkip').onclick = () => { answers = []; openDraw(); };
  $('btnArchive').onclick = renderArchive;

  function renderQuiz() {
    const i = answers.length;
    if (i >= D.QUESTIONS.length) { openDraw(); return; }
    const q = D.QUESTIONS[i];
    $('qProgress').textContent = `人格測驗．第 ${i + 1} 問／${D.QUESTIONS.length}`;
    $('qText').textContent = q[0];
    $('qChoices').innerHTML = '';
    [q[1], q[2]].forEach((t, j) => {
      const b = document.createElement('button');
      b.className = 'answer'; b.textContent = t;
      b.onclick = () => { answers.push(j ? 'B' : 'A'); renderQuiz(); };
      $('qChoices').appendChild(b);
    });
  }

  /* ---------- 抽籤 ---------- */
  function openDraw() {
    show('draw');
    fate = null;
    $('fateBox').innerHTML = '<p class="muted">手執籤筒，命運尚未揭曉。</p>';
    $('btnDraw').classList.remove('hidden');
    $('btnBegin').classList.add('hidden');
    $('drawStick').classList.remove('out');
  }
  $('btnDraw').onclick = () => {
    $('btnDraw').disabled = true;
    $('tube').classList.add('shake');
    setTimeout(() => {
      $('tube').classList.remove('shake');
      $('drawStick').classList.add('out');
      fate = G.drawFate(null, answers.length === 6 ? answers.slice() : null);
      const era = D.ERAS.find(e => e.id === fate.eraId);
      const fam = D.FAMILIES.find(f => f.id === fate.familyId);
      $('fateBox').innerHTML = `<b>${esc(era.name)}．${esc(fate.city)}</b>${esc(G.yearLabel(fate.year))}（${esc(G.ganzhi(fate.year))}年）<br>${esc(fam.name)}．${fate.sex === 'm' ? '男' : '女'}孩<br>你將以「${esc(fate.name)}」之名降生。${answers.length === 6 ? `<br>人格：<b class="persona inline">${esc(G.persona({ code: answers.join('') }).name)}</b>` : ''}`;
      $('btnDraw').disabled = false;
      $('btnDraw').classList.add('hidden');
      $('btnBegin').classList.remove('hidden');
    }, 1400);
  };
  $('btnBegin').onclick = () => {
    if (!fate) return;
    s = G.newLife(fate);
    s.loc = 'home';
    enterGame();
  };

  /* ---------- 主畫面 ---------- */
  function enterGame() {
    show('game');
    closeSheet();
    fxSeason = -1;
    renderAll();
    setNarr(s.age === 0 ? '你睜開眼睛，來到了這個世上。' : `${s.age} 歲的你，回到了${s.city}。`, []);
    pumpEvents();
  }
  function renderAll() {
    renderTop(); renderSides(); renderStage(); renderNav();
    if (sheet) renderSheet();
  }
  const pct = v => Math.max(0, Math.min(100, Math.round(v)));
  function moneyText(v) {
    const c = G.coin(s), n = Math.round(v);
    return `${n} ${c}`;
  }

  function renderTop() {
    const era = G.eraAt(s.year);
    const cal = G.calendar(s);
    $('tHead').src = L.player(s, true);
    $('tName').textContent = s.name;
    $('tFam').textContent = `${s.famName}．${G.persona(s.traits).name}`;
    $('tAge').textContent = s.age + '歲';
    $('tJob').textContent = s.age < 6 ? '幼童' : G.curJob(s);
    const reign = s.year < 1912 ? G.reignLabel(s.year) : '';
    $('tEra').textContent = `${era.name}${reign ? '．' + reign : ''}（${s.year < 0 ? '前' + -s.year : s.year}年）`;
    $('tPlace').textContent = s.city;
    const hp = pct(s.hp), mood = pct(s.mood), sta = pct(s.sta == null ? 100 : s.sta);
    $('tHp').textContent = hp; $('tMood').textContent = mood; $('tSta').textContent = sta;
    $('mHp').style.width = hp + '%'; $('mMood').style.width = mood + '%'; $('mSta').style.width = sta + '%';
    $('tCoinLabel').textContent = '錢財';
    $('tMoney').textContent = moneyText(s.money);
    $('tSeason').textContent = cal.season;
    $('tSeason').dataset.s = cal.seasonIdx;
    $('tDay').textContent = cal.month + cal.day;
    $('tWeather').textContent = cal.weather + ' ' + cal.icon;
    let ap = '';
    for (let i = 0; i < s.apMax; i++) ap += `<i class="${i < s.ap ? 'on' : ''}"></i>`;
    $('tAp').innerHTML = ap;
    $('tAp').title = `今年剩餘行動 ${s.ap}／${s.apMax}`;
  }

  function renderSides() {
    $('goals').innerHTML = G.goals(s).map(g => `<div class="goal ${g.done ? 'done' : ''}"><i></i><span>${esc(g.t)}${g.max > 1 ? `（${g.cur}/${g.max}）` : ''}</span></div>`).join('') || '<p class="muted">隨遇而安。</p>';
    $('hints').innerHTML = hints().map(h => `<div class="hint ${h[0]}"><i>${h[0] === 'warn' ? '!' : ''}</i><span>${esc(h[1])}</span></div>`).join('');
    $('skills').innerHTML = Object.keys(D.SKILLS).map(k => `<div class="sk"><i>${SK_ICON[k]}</i><span>${D.SKILLS[k]}</span><b>${Math.round(s.skills[k])}</b></div>`).join('');
    const close = s.npcs.filter(n => n.alive && !n.gone && ['parent', 'spouse', 'child', 'mentor', 'friend', 'sibling'].includes(n.rel))
      .sort((a, b) => relOrder(a) - relOrder(b) || b.aff - a.aff).slice(0, 3);
    $('rels').innerHTML = close.length ? close.map(n => `<div class="rel"><img src="${L.npc(s, n, true)}" alt=""><span>${esc(n.label || '')}</span><b>${esc(n.name)}</b><em>親密 ${Math.round(n.aff)}</em></div>`).join('') : '<p class="muted">身邊暫時無人。</p>';
  }
  const relOrder = n => ({ spouse: 0, parent: 1, child: 2, mentor: 3, sibling: 4, friend: 5 }[n.rel] ?? 9);
  function hints() {
    const out = [];
    if (s.pending.length) out.push(['warn', '有事待你決定']);
    if (s.ills.length) out.push(['warn', '身染' + s.ills.map(i => i.n).join('、')]);
    if (s.ap > 0) out.push(['', `今年還可行動 ${s.ap} 次`]);
    else if (s.apMax > 0) out.push(['warn', '今年時光已盡，可過此一年']);
    else out.push(['', '年紀尚幼，靜待長大']);
    const near = D.HISTORY.filter(h => h.y > s.year && h.y <= s.year + 20)[0];
    if (near) out.push(['', `${near.y - s.year} 年後：${near.title}`]);
    if (s.news) out.push(['', s.news]);
    return out.slice(0, 4);
  }

  /* ---------- 場景 ---------- */
  let sceneSrc = '';
  function renderStage() {
    if (!L.PLACES.some(p => p.id === s.loc)) s.loc = 'town';
    const src = L.scene(s, s.loc);
    if (src !== sceneSrc) {
      sceneSrc = src;
      const img = $('sceneImg');
      img.classList.add('fade');
      img.onload = () => img.classList.remove('fade');
      img.src = src;
    }
    const place = L.PLACES.find(p => p.id === s.loc);
    $('sceneName').textContent = s.loc === 'town' ? s.city : `${place.n}．${s.city}`;
    const tags = s.loc === 'town'
      ? L.PLACES.filter(p => p.tag).map(p => `<button class="ptag" data-loc="${p.id}" style="left:${p.tag[0]}%;top:${p.tag[1]}%">${p.n}</button>`).join('')
      : `<button class="ptag back" data-loc="town" style="left:50%;top:14%">回到街上</button>`;
    $('sceneTags').innerHTML = tags;
    $('sceneTags').querySelectorAll('.ptag').forEach(b => { b.onclick = () => goPlace(b.dataset.loc, true); });
    // 主角與身邊的人
    const comp = companion();
    $('actors').innerHTML = `<img class="actor me" src="${L.player(s)}" alt="${esc(s.name)}" style="--h:${heightOf(s.age)}">` +
      (comp ? `<img class="actor npc" src="${L.npc(s, comp)}" alt="${esc(comp.name)}" title="${esc((comp.label || '') + ' ' + comp.name)}" style="--h:${heightOf(comp.age)}">` : '');
    $('crowd').innerHTML = crowdOf(comp);
    $('stage').dataset.loc = ['town', 'street', 'lane', 'market'].includes(s.loc) ? 'out' : 'in';
    renderFx();
  }
  const heightOf = age => (age < 3 ? .5 : age < 10 ? .66 : age < 16 ? .84 : 1).toString();
  // 場景裡的其他人：先放你認識的人，再補上街坊。位置是 [左右%, 離底部 vh, 大小]，越遠的越小。
  const SLOTS = {
    town: [[40, 31, .52], [65, 31, .5], [17, 26, .52], [86, 27, .5], [46, 37, .38]],
    market: [[27, 25, .62], [71, 25, .62], [39, 31, .5], [62, 32, .48]],
    street: [[29, 27, .56], [72, 26, .58], [60, 33, .44]],
    lane: [[31, 26, .58], [69, 28, .54]],
    school: [[33, 26, .55], [67, 26, .55], [58, 32, .44]],
    workshop: [[69, 25, .6], [31, 28, .54]],
    home: [[29, 23, .7], [73, 23, .7]],
    study: [[71, 23, .66]], clinic: [[71, 23, .66]]
  };
  function crowdOf(comp) {
    const set = L.setOf(s.year), seed = [...(s.city + s.loc)].reduce((n, c) => n + c.charCodeAt(0), Math.abs(s.year));
    const known = rels => s.npcs.filter(n => n.alive && !n.gone && rels.includes(n.rel) && n !== comp).map(n => ({ src: L.npc(s, n), age: n.age, title: `${n.label || ''} ${n.name}` }));
    const ev = who => ({ src: L.evActor(s, who), age: 30 });
    const anyone = i => { const sex = (seed + i) % 2 ? 'm' : 'f', age = [24, 44, 62, 12, 34][(seed + i * 3) % 5], cls = ['poor', 'middle', 'poor', 'gentry'][(seed + i) % 4]; return { src: L.sprite(set, cls, sex, age), age }; };
    let list;
    switch (s.loc) {
      case 'home': list = known(['spouse', 'parent', 'child', 'sibling']); break;
      case 'market': list = [ev('merchant'), ...known(['friend']), anyone(1), anyone(2), anyone(3)]; break;
      case 'street': list = [ev('official'), ev('soldier'), anyone(4)]; break;
      case 'lane': list = [ev('child'), ev('oldwoman'), ...known(['friend'])]; break;
      case 'school': list = [{ src: L.sprite(set, 'middle', 'm', 13), age: 13 }, { src: L.sprite(set, 'poor', 'm', 8), age: 8 }, { src: L.sprite(set, 'gentry', 'm', 14), age: 14 }]; break;
      case 'workshop': list = [{ src: L.sprite(set, 'poor', 'm', 45), age: 45 }, { src: L.sprite(set, 'poor', 'f', 30), age: 30 }]; break;
      case 'clinic': list = [ev('healer')]; break;
      case 'study': list = known(['mentor']); break;
      default: list = [ev('elder'), anyone(1), s.year >= 67 ? ev('monk') : anyone(5), ...known(['friend']), anyone(2), anyone(3)];
    }
    const slots = SLOTS[s.loc] || [];
    return list.filter(x => x.src).slice(0, slots.length).map((x, i) => {
      const [left, bottom, size] = slots[i];
      return `<img class="bystander" src="${x.src}" alt="" ${x.title ? `title="${esc(x.title)}"` : ''} style="left:${left}%;bottom:${bottom}vh;--h:${(size * Number(heightOf(x.age))).toFixed(2)};--d:${(i * .7).toFixed(1)}s">`;
    }).join('');
  }
  // 四季：春落花、夏螢火、秋落葉、冬飄雪
  let fxSeason = -1;
  function renderFx() {
    const k = G.calendar(s).seasonIdx;
    if (k === fxSeason) return;
    fxSeason = k;
    const n = [14, 9, 14, 22][k];
    let h = '';
    for (let i = 0; i < n; i++) {
      const r = (i * 9301 + 49297) % 233280 / 233280, r2 = (i * 4099 + 12345) % 9973 / 9973;
      h += `<i style="left:${(r * 100).toFixed(1)}%;--delay:${(-r2 * 14).toFixed(1)}s;--dur:${(9 + r * 9).toFixed(1)}s;--sway:${(r2 * 60 - 30).toFixed(0)}px;--size:${(6 + r2 * 7).toFixed(0)}px;top:${k === 1 ? (30 + r2 * 45).toFixed(0) + '%' : '-4%'}"></i>`;
    }
    $('fx').className = 'fx s' + k;
    $('fx').innerHTML = h;
  }
  function companion() {
    const by = rels => s.npcs.find(n => n.alive && !n.gone && rels.includes(n.rel));
    if (s.age < 10) return by(['parent']);
    if (s.loc === 'home') return by(['spouse']) || by(['parent']) || by(['child']);
    if (s.loc === 'school' || s.loc === 'study') return by(['mentor']);
    if (s.loc === 'market' || s.loc === 'lane') return by(['friend']);
    return null;
  }
  function goPlace(loc, openActs) {
    s.loc = loc;
    renderStage();
    store.set(SAVE, s);
    const p = L.PLACES.find(x => x.id === loc);
    if (openActs && p && p.g) { actTab = p.g[0]; openSheet('act'); }
  }

  // 行動對應到地點，畫面跟著人走
  const ACTION_LOC = { study: 'school', martial: 'street', craftl: 'workshop', tradel: 'market', medl: 'clinic', farml: 'town', mentor: 'school', seekjob: 'market', exam: 'school', invest: 'market', project: 'street', meet: 'town', tavern: 'market', seek: 'street', visitf: 'lane', filial: 'home', match: 'home', teach: 'home', homecare: 'home', divorce: 'home', rest: 'home', tonic: 'clinic', doctor: 'clinic', pray: 'town', travel: 'town', charity: 'lane', petition: 'street', write: 'study', invent: 'workshop' };
  const JOB_LOC = { farm: 'town', craft: 'workshop', weave: 'workshop', trade: 'market', doctor: 'clinic', soldier: 'town', clerk: 'street', teacher: 'school', cleric: 'town', artist: 'study' };

  function deltaHtml(ds) {
    return (ds || []).map(d => `<span class="delta ${d.v > 0 ? 'up' : 'down'}">${esc(d.k)}${d.v > 0 ? '+' : ''}${d.v}</span>`).join('');
  }
  function setNarr(text, ds) { $('narr').innerHTML = `${esc(text)}${deltaHtml(ds)}`; floatDeltas(ds); }
  function floatDeltas(ds) {
    const box = $('floats');
    if (!box || !ds || !ds.length) return;
    ds.slice(0, 5).forEach((d, i) => {
      const el = document.createElement('span');
      el.className = 'float ' + (d.v > 0 ? 'up' : 'down');
      el.textContent = `${d.k} ${d.v > 0 ? '+' : ''}${d.v}`;
      el.style.setProperty('--i', i);
      el.style.setProperty('--x', ((i % 2 ? 1 : -1) * (30 + i * 16)) + 'px');
      box.appendChild(el);
      setTimeout(() => el.remove(), 2300);
    });
  }

  function act(id) {
    s.loc = ACTION_LOC[id] || (s.job ? JOB_LOC[s.job.id] : 'market') || s.loc;
    const res = G.doAction(s, id);
    if (res) { setNarr(res.text, res.deltas); AU.play(mood(res.deltas)); }
    picked = null;
    afterStep();
  }
  // 依數值變化挑音效：錢或健康掉得多就是壞消息
  const mood = ds => { const sum = (ds || []).reduce((n, d) => n + (d.v > 0 ? 1 : -1) * Math.min(3, Math.abs(d.v) / 4 + 1), 0); return sum < -1 ? 'bad' : sum > 2 ? 'good' : 'act'; };
  function afterStep() {
    store.set(SAVE, s);
    if (!s.alive) { finishLife(); return; }
    checkAch(s, false);
    showCheer();
    renderAll();
    pumpEvents();
  }
  function passYear() {
    if (s.pending.length) { pumpEvents(); return; }
    closeSheet();
    AU.play('year');
    const before = s.log.length;
    G.endYear(s);
    const fresh = s.log.slice(before).filter(l => l.k !== 'life');
    setNarr(fresh.length ? fresh[fresh.length - 1].t : `${s.age} 歲這一年開始了。${s.news || ''}`, []);
    afterStep();
  }
  $('btnYear').onclick = passYear;
  function renderNav() {
    $('btnYearT').textContent = s.age < 3 ? '長大一歲' : '過此一年';
    $('btnYear').classList.toggle('pulse', s.ap <= 0);
    document.querySelectorAll('.nav[data-nav]').forEach(b => b.classList.toggle('on', sheet === b.dataset.nav));
  }
  document.querySelectorAll('.nav[data-nav]').forEach(b => {
    b.onclick = () => {
      const k = b.dataset.nav;
      if (k === 'sys') { openSheet('sys'); return; }
      if (sheet === k) closeSheet(); else openSheet(k);
    };
  });
  $('relMore').onclick = () => openSheet('family');

  /* ---------- 面板 ---------- */
  const TITLES = { act: '生活排程', map: '地圖', char: '人物養成', family: '家庭與親友', bag: '行囊', world: '世事', bio: '傳記', sys: '系統' };
  function openSheet(k) { sheet = k; picked = null; $('sheet').classList.remove('hidden'); renderSheet(); renderNav(); }
  function closeSheet() { sheet = null; $('sheet').classList.add('hidden'); if (s) renderNav(); }
  $('sheetClose').onclick = closeSheet;
  $('sheet').addEventListener('click', e => { if (e.target === $('sheet')) closeSheet(); });

  function renderSheet() {
    $('sheetTitle').textContent = TITLES[sheet];
    const body = $('sheetBody');
    body.className = 'sheet-body k-' + sheet;
    body.innerHTML = ({ act: actHtml, map: mapHtml, char: charHtml, family: familyHtml, bag: bagHtml, world: worldHtml, bio: bioHtml, sys: sysHtml }[sheet])();
    bindSheet(body);
  }
  function bindSheet(body) {
    body.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { actTab = b.dataset.tab; picked = null; renderSheet(); }; });
    body.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => { picked = b.dataset.pick; renderSheet(); }; });
    const go = body.querySelector('#doAct');
    if (go) go.onclick = () => { const id = picked; closeSheet(); act(id); };
    body.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => { closeSheet(); goPlace(b.dataset.go, false); }; });
    const h = body.querySelector('#sysHome');
    if (h) h.onclick = () => { store.set(SAVE, s); closeSheet(); home(); };
    const y = body.querySelector('#sysYear');
    if (y) y.onclick = passYear;
    const ex = body.querySelector('#sysExport');
    if (ex) ex.onclick = () => download(JSON.stringify(s), `浮生千年_存檔_${s.name}_${s.age}歲.json`, 'application/json');
    const im = body.querySelector('#sysImport'), file = body.querySelector('#sysFile');
    if (im) im.onclick = () => file.click();
    if (file) file.onchange = () => {
      const f = file.files[0];
      if (!f) return;
      f.text().then(txt => {
        const d = JSON.parse(txt);
        if (!d || d.v !== 2 || !d.alive || !d.skills || !Array.isArray(d.npcs)) throw new Error('bad');
        s = d; store.set(SAVE, s); closeSheet(); enterGame();
      }).catch(() => { body.querySelector('#sysMsg').textContent = '這個檔案不是可用的存檔。'; });
    };
    const mu = body.querySelector('#sysMusic'), sf = body.querySelector('#sysSfx');
    if (mu) mu.onclick = () => { AU.set('music', !AU.get('music')); renderSheet(); };
    if (sf) sf.onclick = () => { AU.set('sfx', !AU.get('sfx')); AU.play('tap'); renderSheet(); };
    const fu = body.querySelector('#sysFull');
    if (fu) fu.onclick = () => desk.fullscreen();
    const exit = body.querySelector('#sysExit');
    if (exit) exit.onclick = () => { store.set(SAVE, s); desk.quit(); };
    const q = body.querySelector('#sysQuit');
    if (q) q.onclick = () => {
      if (q.dataset.sure) { store.del(SAVE); closeSheet(); home(); }
      else { q.dataset.sure = '1'; q.textContent = '再按一次確定放棄（不會留下傳記）'; }
    };
  }

  function actHtml() {
    const all = G.actionList(s);
    const list = all.filter(a => a.g === actTab);
    const thisYear = s.log.filter(l => l.age === s.age).slice(-8);
    const cal = G.calendar(s);
    const cur = picked && list.find(a => a.id === picked);
    return `<div class="sched">
      <div class="paper-col">
        <h5>本年行程（${cal.season}．${cal.month}${cal.day}）</h5>
        <div class="today">${thisYear.length ? thisYear.map(l => `<div><em>${l.k === 'major' ? '要事' : l.k === 'hist' ? '史事' : '日常'}</em>${esc(l.t)}</div>`).join('') : '<p class="muted">這一年還沒有安排。</p>'}</div>
        <div class="apline">剩餘行動 <b>${s.ap}</b>／${s.apMax}．體力 <b>${Math.round(s.sta ?? 100)}</b></div>
      </div>
      <div class="paper-col">
        <h5>可安排的活動</h5>
        <div class="gtabs">${GROUPS.map(g => `<button data-tab="${g.id}" class="${g.id === actTab ? 'on' : ''}">${g.n}</button>`).join('')}</div>
        <div class="acts">${list.map(a => `<button class="arow ${a.id === picked ? 'on' : ''}" data-pick="${a.id}" ${a.off ? 'disabled' : ''}><b>${esc(a.label)}</b><small>${esc(a.off ? a.why : a.hint)}</small><em>${a.odds != null && !a.off ? oddsTag(a.odds) : ''}${a.sta ? '體力 -' + a.sta : a.id === 'rest' ? '體力 +30' : ''}</em></button>`).join('')}</div>
        <div class="preview">${cur ? `<h6>預估效果</h6><p>${esc(cur.hint)}．用去一次行動${cur.sta ? `、體力 ${cur.sta}` : ''}${cur.odds != null ? '．' + oddsTag(cur.odds) : ''}</p><button id="doAct" class="btn primary">安排此事</button>` : '<p class="muted">選一件事，看看預估效果。</p>'}</div>
      </div>
    </div>`;
  }
  function mapHtml() {
    return `<p class="muted">走到哪裡，畫面就到哪裡；在街上點地名，也能直接安排該處的事。</p><div class="places">${L.PLACES.map(p => `<button class="place ${p.id === s.loc ? 'on' : ''}" data-go="${p.id}"><img src="${L.scene(s, p.id)}" alt="" loading="lazy"><b>${p.id === 'town' ? s.city + '街坊' : p.n}</b></button>`).join('')}</div>`;
  }
  function charHtml() {
    const st = L.stage(s.age);
    const bar = (n, v, c) => `<div class="sbar"><span>${n}</span><div class="bar ${c}"><span style="width:${pct(v)}%"></span></div><b>${pct(v)}/100</b></div>`;
    const rows = [];
    s.projects.forEach(p => rows.push(`${esc(p.n)}${p.done ? '（已落成）' : `（尚需 ${p.left} 年）`}`));
    s.works.forEach(w => rows.push(esc(w.n)));
    s.breakthroughs.forEach(id => rows.push(esc(D.BREAKTHROUGHS.find(b => b.id === id).n)));
    return `<div class="grow">
      <div class="grow-fig"><img src="${L.player(s)}" alt=""></div>
      <div class="grow-info">
        <h4>${esc(s.name)}</h4>
        <div class="kv2"><label>年齡</label><span>${s.age} 歲</span><label>身分</label><span>${esc(G.curJob(s))}</span><label>朝代</label><span>${esc(G.eraAt(s.year).name)}</span><label>籍貫</label><span>${esc(s.birthCity)}</span></div>
        <h5>狀態</h5>${bar('健康', s.hp, 'hp')}${bar('心情', s.mood, 'mood')}${bar('體力', s.sta ?? 100, 'sta')}
        <h5>性格與天賦</h5><p><b class="persona">${esc(G.persona(s.traits).name)}</b>　${esc(s.traits.label)}<br><span class="muted">${esc(G.persona(s.traits).giftText)}</span></p>
        <h5>身體</h5><p>${s.ills.length ? s.ills.map(i => esc(i.n) + (i.chronic ? '（宿疾）' : '')).join('、') : '目前無病無痛'}</p>
      </div>
      <div class="grow-side">
        <h5>核心能力</h5>${Object.keys(D.SKILLS).map(k => `<div class="sbar"><span>${D.SKILLS[k]}</span><div class="bar skl"><span style="width:${pct(s.skills[k])}%"></span></div><b>${Math.round(s.skills[k])}</b></div>`).join('')}
        <h5>人生階段</h5>
        <div class="stages">${L.STAGES.map(([id, n]) => `<div class="${id === st ? 'on' : ''}"><img src="${L.sprite(L.setOf(s.year), L.clsOf(s), s.sex, L.STAGES.find(x => x[0] === id)[2] + 1, true)}" alt=""><span>${n}</span></div>`).join('')}</div>
        <h5>志向</h5>${ambHtml()}
        <h5>才能（${G.perksOf(s).length}／${G.PERKS.length}）</h5>${perkHtml()}
        <h5>人生目標</h5>${G.goals(s).filter(g => !g.amb).map(g => `<div class="goal ${g.done ? 'done' : ''}"><i></i><span>${esc(g.t)}${g.max > 1 ? `（${g.cur}/${g.max}）` : ''}</span></div>`).join('')}
        <h5>志業</h5><p>${rows.length ? rows.join('、') : '尚未留下什麼'}</p>
      </div>
    </div>`;
  }
  function ambHtml() {
    const a = G.ambition(s);
    if (!a) return `<p class="muted">${s.age < 12 ? '十二歲時立志。' : '尚未立志，過了這一年就會問你。'}</p>`;
    return `<p><b class="persona">${esc(a.n)}</b>　<span class="muted">${esc(a.d)}</span></p><div class="steps">${a.steps.map((st, i) => `<div class="${i < s.amb.stage ? 'done' : i === s.amb.stage ? 'now' : ''}"><i>${i < s.amb.stage ? '✓' : i + 1}</i>${esc(st[0])}</div>`).join('')}</div>`;
  }
  function perkHtml() {
    const have = G.perksOf(s);
    const next = G.PERKS.filter(p => !have.includes(p)).filter((p, i, arr) => arr.findIndex(x => x.k === p.k) === i)
      .sort((x, y) => (x.at - s.skills[x.k]) - (y.at - s.skills[y.k])).slice(0, 3);
    return `<div class="perks">${have.map(p => `<span class="perk on" title="${esc(p.d)}">${esc(p.n)}<small>${esc(p.d)}</small></span>`).join('')}${next.map(p => `<span class="perk" title="${esc(p.d)}">${esc(p.n)}<small>${D.SKILLS[p.k]} ${Math.round(s.skills[p.k])}／${p.at}</small></span>`).join('')}</div>`;
  }
  function familyHtml() {
    const row = n => `<div class="pp ${n.alive ? '' : 'gone'}"><img src="${L.npc(s, n, true)}" alt=""><div><b>${esc(n.label || '')} ${esc(n.name)}</b><small>${n.age} 歲${n.jobName ? '．' + esc(n.jobName) : ''}${n.blurb ? '．' + esc(n.blurb) : ''}${n.trait ? '．性情' + esc(n.trait) : ''}${(n.mem || []).length ? `<br><i class="mem">記得：${n.mem.slice(-2).map(m => esc(m.t)).join('；')}</i>` : ''}</small></div><span class="aff">${n.alive ? '親密 ' + Math.round(n.aff) : (n.gone ? n.note || '離去' : '已故')}</span></div>`;
    const sec = (title, list) => (list.length ? `<div class="sect">${title}</div>${list.map(row).join('')}` : '');
    const by = rels => s.npcs.filter(n => rels.includes(n.rel));
    return (sec('婚姻', by(['spouse', 'late', 'ex'])) + sec('子女', by(['child'])) + sec('父母手足', by(['parent', 'sibling'])) + sec('師友', by(['mentor', 'friend', 'figure'])) + sec('對手', by(['rival']))) || '<p class="muted">身邊暫時無人。</p>';
  }
  function bagHtml() {
    const inv = (s.inv || []).map(i => (typeof i === 'string' ? i : i.n)).filter(Boolean);
    return `<div class="bag"><div class="sect">錢財</div><p class="big">${esc(moneyText(s.money))}</p>
      <p class="muted">每年的開銷與收成會在過年時結算。</p>
      <div class="sect">產業</div>${(s.assets || []).length ? `<p>${Object.values(s.assets.reduce((m, a) => { (m[a.id] = m[a.id] || { n: a.n, c: 0, inc: 0 }); m[a.id].c++; m[a.id].inc += a.income; return m; }, {})).map(g => esc(g.n) + (g.c > 1 ? ` ×${g.c}` : '') + (g.inc ? `（年入約 ${g.inc}）` : '')).join('、')}</p><p class="muted">合計年入約 ${s.assets.reduce((n, a) => n + a.income, 0)} ${esc(G.coin(s))}，世局安定時多些，亂世少些。可在「行動→工作→置辦產業」添置。</p>` : '<p>尚無田產鋪面。年滿十八後可在「行動→工作→置辦產業」添置。</p>'}
      ${s.gen > 1 ? `<div class="sect">家世</div><p>此家第 ${s.gen} 代。先人：${s.forebears.map(f => esc(f.name) + '（' + esc(f.rank) + '）').join('、')}</p>` : ''}
      <div class="sect">隨身之物</div><p>${inv.length ? inv.map(esc).join('、') : '身無長物'}</p>
      <div class="sect">著作與事業</div><p>${[...s.works.map(w => w.n), ...s.projects.map(p => p.n + (p.done ? '（已落成）' : '（興建中）'))].map(esc).join('、') || '尚無'}</p>
      <div class="sect">聲望與德行</div><p>聲望 ${Math.round(s.fame)}．德行 ${Math.round(s.virtue)}</p></div>`;
  }
  function worldHtml() {
    const era = G.eraAt(s.year);
    const w = s.world;
    const bar = (n, v) => `<div class="sbar"><span>${n}</span><div class="bar gold"><span style="width:${pct(v)}%"></span></div><b>${Math.round(v)}</b></div>`;
    const near = D.HISTORY.filter(h => h.y > s.year && h.y <= s.year + 30)[0];
    const figs = D.FIGURES.filter(f => s.year >= f[1] && s.year <= f[2]).slice(0, 6);
    const exam = { noble: '世卿世祿', merit: '軍功爵制', chaju: '察舉徵辟', jiupin: '九品中正', keju: '科舉取士', modern: '新式學制與文官考試', none: '科舉暫停，由吏入仕' }[G.examSystem(s.year)];
    let h = `<div class="sect">當世</div><p>${esc(era.name)}，${esc(s.city)}。${esc(G.dateLabel(s))}。選官之法：${exam}。</p>
      <div class="sect">世局</div>${bar('安定', w.stable)}${bar('繁榮', w.rich)}${bar('文教', w.learn)}
      <p class="muted">世局會隨你的作為與時代起伏，也會影響收入、瘟疫與兵禍。</p>
      <div class="sect">坊間消息</div><p>${esc(s.news || '街坊無事。')}</p>
      ${near ? `<div class="sect">史書在前</div><p>${near.y - s.year} 年後（${esc(G.yearLabel(near.y))}）將是「${esc(near.title)}」。活到那天，有機會參與其中。</p>` : ''}
      ${figs.length ? `<div class="sect">當世人物</div><p>${figs.map(f => esc(f[0])).join('、')}</p>` : ''}
      <div class="sect">史冊</div><p class="muted">你影響史事的力量取決於聲望、官階與本領。目前左右大局的機會約 ${Math.round(G.histChance(s) * 100)}%。</p>`;
    if (s.div.length) h += s.div.slice().reverse().map(d => `<div class="hcard t${d.tier}"><b>${esc(d.title)}</b>．${esc(G.yearLabel(d.y))}<br>${esc(d.alt)}</div>`).join('');
    if (s.hist.length) h += s.hist.slice().reverse().map(x => `<div class="lg hist"><em>${x.age} 歲</em>${esc(x.title)}</div>`).join('');
    return h;
  }
  function bioHtml() {
    return `<p class="muted">此生紀事，最近的在上。</p>` + s.log.slice(-60).reverse().map(l => `<div class="lg ${l.k}"><em>${l.age} 歲</em>${esc(l.t)}</div>`).join('');
  }
  function sysHtml() {
    return `<p>進度會在每次行動後自動存檔在這個瀏覽器裡。換裝置或清除瀏覽資料前，可以先匯出存檔。</p><div class="home-actions"><button id="sysYear" class="btn primary">${s.age < 3 ? '長大一歲' : '過此一年'}</button><button id="sysHome" class="btn">存檔並回首頁</button><button id="sysExport" class="btn">匯出存檔</button><button id="sysImport" class="btn">匯入存檔</button><button id="sysMusic" class="btn">音樂：${AU.get('music') ? '開' : '關'}</button><button id="sysSfx" class="btn">音效：${AU.get('sfx') ? '開' : '關'}</button><button id="sysQuit" class="btn ghost">放棄此生</button>${desk ? '<button id="sysFull" class="btn">切換全螢幕</button><button id="sysExit" class="btn">存檔並離開遊戲</button>' : ''}</div><input id="sysFile" type="file" accept="application/json,.json" class="hidden"><p id="sysMsg" class="muted" style="margin-top:8px"></p>
      <p class="fine">美術取自《浮生千年》Unity 專案：目前畫好前秦（漢晉）與唐兩組人物與場景，其他時代暫借最接近的一組。人物與個人遭遇為遊戲虛構；歷史事件取材自史實，「偏移」內容屬假想。</p>`;
  }

  /* ---------- 事件卡 ---------- */
  const TAGS = { hist: '史事', bad: '變故', ill: '疾病', family: '家事', life: '人生' };
  function actorFor(ev) {
    const id = (ev.id || '') + ' ' + (ev.title || '');
    const m = [[/thief|賊|盜|bandit/i, 'bandit'], [/levy|corvee|徵|兵|戰/i, 'soldier'], [/beggar|乞/i, 'oldwoman'], [/lostChild|孩|童/i, 'child'], [/debt|債|creditor/i, 'creditor'], [/match|媒|親事/i, 'oldwoman'], [/mentor|師/i, 'elder'], [/windfall|商|rival/i, 'merchant'], [/promote|官|exam|科|上書/i, 'official'], [/pray|僧|寺|道/i, 'monk']];
    for (const [re, who] of m) if (re.test(id)) return L.evActor(s, who);
    if (ev.kind === 'ill') return L.evActor(s, 'healer');
    if (ev.kind === 'hist') return L.evActor(s, 'official');
    if (ev.kind === 'bad') return L.evActor(s, 'elder');
    return '';
  }
  function pumpEvents() {
    const ev = G.top(s);
    if (!ev) { $('modal').classList.add('hidden'); return; }
    closeSheet();
    if ($('modal').classList.contains('hidden')) AU.play('event');
    $('modal').classList.remove('hidden');
    const card = $('evCard');
    card.className = 'ev-card ' + (ev.kind || 'life');
    const who = actorFor(ev);
    $('evActor').classList.toggle('hidden', !who);
    if (who) $('evActor').src = who;
    $('evTag').textContent = TAGS[ev.kind] || '人生';
    $('evTitle').textContent = ev.title;
    $('evText').textContent = ev.text;
    const input = $('evInput');
    input.classList.toggle('hidden', !ev.input);
    input.value = '';
    input.placeholder = ev.input || '';
    const box = $('evChoices');
    box.innerHTML = '';
    box.classList.toggle('many', ev.choices.length > 5);
    card.classList.toggle('wide', ev.choices.length > 5);
    ev.choices.forEach(c => {
      const b = document.createElement('button');
      b.className = 'choice'; b.disabled = c.off;
      b.innerHTML = `<b>${esc(c.label)}${c.odds != null && !c.off ? oddsTag(c.odds) : ''}</b>${c.off && c.why ? `<small>${esc(c.why)}</small>` : c.hint ? `<small>${esc(c.hint)}</small>` : ''}`;
      b.onclick = () => choose(c.i);
      box.appendChild(b);
    });
    const first = box.querySelector('button:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
    card.scrollTop = 0;
  }
  function choose(i) {
    const input = $('evInput').classList.contains('hidden') ? undefined : $('evInput').value;
    const res = G.resolve(s, i, input);
    if (!res) { pumpEvents(); return; }
    store.set(SAVE, s);
    renderAll();
    if (res.text) {
      AU.play(s.alive ? mood(res.deltas) : 'end');
      $('evTag').textContent = '後來';
      if (!s.alive) $('evTitle').textContent = '命數已盡';
      $('evText').innerHTML = esc(res.text) + '<br>' + deltaHtml(res.deltas);
      $('evInput').classList.add('hidden');
      setNarr(res.text, res.deltas);
      const box = $('evChoices');
      box.innerHTML = '';
      const b = document.createElement('button');
      b.className = 'btn primary';
      b.textContent = s.alive ? '繼續' : '回望此生';
      b.onclick = () => { if (!s.alive) finishLife(); else { pumpEvents(); renderAll(); } };
      box.appendChild(b);
      b.focus({ preventScroll: true });
    } else if (!s.alive) finishLife();
    else pumpEvents();
  }

  /* ---------- 結局 ---------- */
  function finishLife() {
    AU.play('end');
    $('modal').classList.add('hidden');
    closeSheet();
    store.del(SAVE);
    archive(s);
    checkAch(s, true);
    renderEnding(s);
  }
  function archive(life) {
    const list = store.get(ARCHIVE) || [];
    if (!list.some(x => x.id === life.birthYear + life.name + life.death.year)) {
      list.unshift({ id: life.birthYear + life.name + life.death.year, name: life.name, eraId: life.eraId, era: D.ERAS.find(e => e.id === life.eraId).name, city: life.birthCity, born: life.birthYear, age: life.age, score: G.lifeScore(life).total, grade: G.lifeScore(life).grade, cause: life.death.cause, rank: life.biography.legacy.n, title: life.biography.title, text: G.bioText(life) });
      store.set(ARCHIVE, list.slice(0, 60));
    }
  }
  function renderEnding(life) {
    show('ending');
    const b = life.biography;
    const st = b.stats;
    const tl = b.timeline.map(t => `<div class="${t.k}"><em>${esc(G.yearLabel(t.y))}．${t.age} 歲</em><span>${esc(t.t)}</span></div>`).join('');
    const div = b.div.length ? `<h3>可能的另一段歷史</h3>${b.div.map(d => `<div class="div-card t${d.tier}"><b>${esc(d.title)}</b><small>正史：${esc(d.fact)}</small>此生：${esc(d.alt)}</div>`).join('')}` : '';
    $('endBody').innerHTML = `
      <img class="end-art" src="${L.ending(life)}" alt="">
      <div class="eyebrow">浮生一夢．此生已畢</div>
      <h2>《${esc(life.name)}傳》</h2>
      <p><span class="rank">${esc(b.legacy.n)}</span>${esc(b.title)}．享年 ${life.age} 歲．${esc(life.death.cause)}</p>
      <p class="muted" style="margin-top:6px">${esc(b.legacy.d)}</p>
      <div class="endstats">
        <div><b>${st.fame}</b><small>聲望</small></div><div><b>${st.virtue}</b><small>德行</small></div><div><b>${st.money}</b><small>遺產（${esc(G.coin(life))}）</small></div>
        <div><b>${st.children}</b><small>子女</small></div><div><b>${life.met.length}</b><small>名士之交</small></div><div><b>${b.div.filter(d => d.tier >= 2).length}</b><small>影響史事</small></div>
      </div>
      ${scoreHtml(life)}
      <div class="bio">${b.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="epitaph">${esc(b.epitaph)}</div>
      ${div}
      <h3>生平年表</h3><div class="tl">${tl}</div>
      ${heirHtml(life)}
      <div class="home-actions">
        <button id="btnAgain" class="btn primary">再抽一世</button>
        <button id="btnCopy" class="btn">複製傳記</button>
        <button id="btnSaveTxt" class="btn">下載傳記</button>
        <button id="btnHome" class="btn ghost">回首頁</button>
      </div>
      <p class="fine">人物與個人遭遇為遊戲虛構；歷史事件取材自史實，上古年份為約數，「偏移」內容屬假想。</p>`;
    bioButtons(G.bioText(life), life.name);
    $('btnAgain').onclick = () => { answers = []; openDraw(); };
    $('btnHome').onclick = home;
    document.querySelectorAll('[data-heir]').forEach(b => {
      b.onclick = () => {
        const next = G.continueAs(life, Number(b.dataset.heir));
        if (!next) return;
        s = next; store.set(SAVE, s); enterGame();
      };
    });
  }
  function scoreHtml(life) {
    const sc = G.lifeScore(life);
    const past = (store.get(ARCHIVE) || []).map(x => x.score || 0).sort((a, b) => b - a);
    const rank = past.filter(v => v > sc.total).length + 1;
    const best = rank === 1 && past.length > 1;
    return `<div class="score"><div class="score-main"><span class="grade">${sc.grade}</span><div><b>${sc.total}</b><small>人生評分${past.length > 1 ? `．歷世第 ${rank} 名（共 ${past.length} 世）` : ''}${best ? '．新紀錄' : ''}</small></div></div>
      <div class="score-parts">${sc.parts.map(p => `<span>${p[0]} <b>${p[1]}</b></span>`).join('')}</div></div>`;
  }
  function heirHtml(life) {
    const hs = G.heirs(life);
    if (!hs.length) return '';
    return `<h3>家族延續</h3><p class="muted">可以不再抽籤，改由在世的子女接續這個家：承襲部分家產、產業、家學與名聲，時代照原來的年份往下走。</p>
      <div class="heirs">${hs.map(n => `<button class="heir" data-heir="${n.id}"><img src="${L.npc(life, n, true)}" alt=""><b>${esc(n.name)}</b><small>${n.sex === 'm' ? '子' : '女'}．${n.age} 歲</small></button>`).join('')}</div>`;
  }
  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type: (type || 'text/plain') + ';charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bioButtons(text, name) {
    $('btnCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(text); $('btnCopy').textContent = '已複製'; }
      catch (e) { $('btnCopy').textContent = '瀏覽器不允許複製，請改用下載'; }
    };
    $('btnSaveTxt').onclick = () => {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = `浮生千年_${name}傳.txt`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }

  /* ---------- 浮生錄 ---------- */
  function renderArchive() {
    show('archive');
    const list = store.get(ARCHIVE) || [];
    const seen = new Set(list.map(x => x.eraId));
    $('archiveBody').innerHTML = `<div class="eyebrow">千年浮生錄</div><h2>走過的人生</h2>
      <p class="muted">只是記錄，不影響抽籤：每個時代隨時都可能抽到，也沒有需要解鎖的內容。</p>
      <div class="eras">${D.ERAS.map(e => `<div class="${seen.has(e.id) ? 'on' : ''}">${esc(e.name)}</div>`).join('')}</div>
      ${list.length ? list.map((x, i) => `<div class="arc"><b>${esc(x.name)}</b>　${esc(x.era)}．${esc(x.city)}．享年 ${x.age} 歲．${esc(x.rank)}${x.score ? `．評分 ${x.score}（${esc(x.grade || '')}）` : ''}<br><span class="muted">${esc(x.title)}．${esc(x.cause)}</span><br><button class="btn ghost" data-read="${i}" style="padding:4px 10px;margin-top:5px;font-size:13px">讀傳記</button></div>`).join('') : '<p>還沒有走完任何一世。</p>'}
      <h3>成就（${Object.keys(store.get(ACHKEY) || {}).length}／${ACH.length}）</h3>
      <div class="achs">${ACH.map(([id, n, d]) => `<div class="${(store.get(ACHKEY) || {})[id] ? 'on' : ''}"><b>${esc(n)}</b><small>${esc(d)}</small></div>`).join('')}</div>
      <div id="arcRead"></div>
      <div class="home-actions"><button id="arcHome" class="btn primary">回首頁</button></div>`;
    $('arcHome').onclick = home;
    document.querySelectorAll('[data-read]').forEach(b => {
      b.onclick = () => {
        const t = list[Number(b.dataset.read)].text;
        $('arcRead').innerHTML = `<div class="bio">${t.split('\n').filter(Boolean).map(p => `<p style="text-indent:0">${esc(p)}</p>`).join('')}</div>`;
        $('arcRead').scrollIntoView({ behavior: 'smooth' });
      };
    });
  }

  addEventListener('keydown', e => { if (e.key === 'Escape' && sheet) closeSheet(); });
  // 所有按鈕都有輕輕一聲
  document.addEventListener('click', e => { if (e.target.closest('button')) AU.play('tap'); }, true);
  home();
})();
