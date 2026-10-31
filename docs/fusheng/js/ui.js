/* 浮生千年：畫面與互動。規則都在 engine.js，這裡只負責顯示與存檔。 */
(function () {
  'use strict';
  const G = window.FS_ENGINE, D = window.FS_DATA, A = window.FS_ART;
  const $ = id => document.getElementById(id);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SAVE = 'fusheng.save.v2', ARCHIVE = 'fusheng.archive.v2';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無痕或停用儲存時，遊戲仍可玩 */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* 同上 */ } }
  };

  let answers = [], fate = null, s = null, tab = 'people', openGroup = null, artKey = '';
  const GROUPS = [
    { id: 'study', n: '學藝', i: '學' }, { id: 'work', n: '工作', i: '業' }, { id: 'social', n: '交友', i: '友' },
    { id: 'family', n: '家庭', i: '家' }, { id: 'health', n: '養生', i: '養' }, { id: 'world', n: '世事', i: '世' }
  ];
  const SEASONS = ['春', '夏', '秋', '冬'];

  function show(id) {
    document.querySelectorAll('.screen').forEach(x => x.classList.add('hidden'));
    $(id).classList.remove('hidden');
    scrollTo(0, 0);
  }

  /* ---------- 首頁 ---------- */
  function home() {
    show('home');
    $('homeArt').innerHTML = A.townSvg({ style: 'song', season: 0, seed: 1105, s: { year: 1105 }, war: false, compact: false });
    $('homeArt').firstElementChild.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    $('btnContinue').classList.toggle('hidden', !store.get(SAVE));
  }
  $('btnContinue').onclick = () => {
    const saved = store.get(SAVE);
    if (saved && saved.v === 2) { s = saved; enterGame(); }
  };
  $('btnQuiz').onclick = () => { answers = []; show('quiz'); renderQuiz(); };
  $('btnSkip').onclick = () => { answers = []; openDraw(); };
  $('btnArchive').onclick = renderArchive;

  function renderQuiz() {
    const i = answers.length;
    if (i >= D.QUESTIONS.length) { openDraw(); return; }
    const q = D.QUESTIONS[i];
    $('qProgress').textContent = `第 ${i + 1} 問．共 ${D.QUESTIONS.length} 問`;
    $('qText').textContent = q[0];
    $('qChoices').innerHTML = '';
    [q[1], q[2]].forEach((t, j) => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = t;
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
    let st = '';
    for (let i = 0; i < 13; i++) st += `<i style="transform:rotate(${(i - 6) * 3.4}deg)"></i>`;
    $('sticks').innerHTML = st;
  }
  $('btnDraw').onclick = () => {
    $('btnDraw').disabled = true;
    $('sticks').classList.add('shake');
    setTimeout(() => {
      $('sticks').classList.remove('shake');
      const idx = Math.floor(Math.random() * 13);
      $('sticks').children[idx].classList.add('out');
      fate = G.drawFate(null, answers.length === 6 ? answers.slice() : null);
      const era = D.ERAS.find(e => e.id === fate.eraId);
      const fam = D.FAMILIES.find(f => f.id === fate.familyId);
      $('fateBox').innerHTML = `<b>${esc(era.name)}．${esc(fate.city)}</b>${esc(G.yearLabel(fate.year))}（${esc(G.ganzhi(fate.year))}年）<br>${esc(fam.name)}．${fate.sex === 'm' ? '男' : '女'}孩<br>你將以「${esc(fate.name)}」之名降生。`;
      $('btnDraw').disabled = false;
      $('btnDraw').classList.add('hidden');
      $('btnBegin').classList.remove('hidden');
    }, 1500);
  };
  $('btnBegin').onclick = () => {
    if (!fate) return;
    s = G.newLife(fate);
    enterGame();
  };

  /* ---------- 主畫面 ---------- */
  function enterGame() {
    show('game');
    artKey = '';
    openGroup = null;
    renderAll();
    setNarr('你睜開眼睛，來到了這個世上。', []);
    pumpEvents();
  }
  function renderAll() {
    renderTop(); renderLeft(); renderRight(); renderActions(); renderStage(); renderPop();
  }
  const sealFor = n => (n.length > 2 ? n.slice(0, 2) : n);
  const seasonIdx = () => (s.ap <= 0 && s.apMax > 0 ? 3 : s.season);

  function renderTop() {
    const era = G.eraAt(s.year);
    $('tSeal').textContent = sealFor(era.name);
    $('tPlace').textContent = s.city;
    $('tEra').textContent = era.name;
    $('tYear').textContent = G.yearLabel(s.year);
    $('tGanzhi').textContent = G.dateLabel(s);
    $('tAge').textContent = s.age + ' 歲';
    const hp = Math.round(s.hp), mood = Math.round(s.mood);
    $('tHp').textContent = hp; $('tMood').textContent = mood;
    $('mHp').style.width = hp + '%'; $('mMood').style.width = mood + '%';
    $('tCoinLabel').textContent = G.coin(s);
    $('tMoney').textContent = Math.round(s.money);
    $('tFame').textContent = Math.round(s.fame);
    $('tVirtue').textContent = Math.round(s.virtue);
    $('tSeason').textContent = SEASONS[seasonIdx()];
    let ap = '';
    for (let i = 0; i < s.apMax; i++) ap += `<i class="${i < s.ap ? 'on' : ''}"></i>`;
    $('tAp').innerHTML = ap;
  }
  function renderLeft() {
    $('pPortrait').innerHTML = A.portrait(s);
    $('pName').textContent = s.name;
    $('pJob').textContent = G.curJob(s);
    $('pFamily').textContent = `${s.famName}．${s.sex === 'm' ? '男' : '女'}．屬${G.zodiac(s.birthYear)}`;
    $('pTraits').textContent = s.traits.label;
    $('pSkills').innerHTML = Object.keys(D.SKILLS).map(k => {
      const v = Math.round(s.skills[k]);
      return `<div class="sk"><span>${D.SKILLS[k]}</span><div class="m"><span style="width:${v}%"></span></div><em>${v}</em></div>`;
    }).join('');
    $('pIlls').innerHTML = s.ills.length ? s.ills.map(i => `<span class="ill">${esc(i.n)}${i.chronic ? '（宿疾）' : ''}</span>`).join('') : '<span class="muted">目前無病無痛</span>';
    const rows = [];
    s.projects.forEach(p => rows.push(`${esc(p.n)}${p.done ? '（已落成）' : `（尚需 ${p.left} 年）`}`));
    s.works.forEach(w => rows.push(esc(w.n)));
    s.breakthroughs.forEach(id => rows.push(esc(D.BREAKTHROUGHS.find(b => b.id === id).n)));
    $('pProjects').innerHTML = rows.length ? rows.map(r => `<div>・${r}</div>`).join('') : '<span class="muted">尚未留下什麼</span>';
  }
  function renderRight() {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    const b = $('tabBody');
    if (tab === 'people') b.innerHTML = peopleHtml();
    else if (tab === 'world') b.innerHTML = worldHtml();
    else if (tab === 'chron') b.innerHTML = chronHtml();
    else b.innerHTML = histHtml();
  }
  function peopleHtml() {
    const row = n => `<div class="pp ${n.alive ? '' : 'gone'}"><b>${esc(n.label || '')} ${esc(n.name)}</b><span class="aff">${n.alive ? '情誼 ' + Math.round(n.aff) : (n.gone ? n.note || '離去' : '已故')}</span><small>${n.age} 歲${n.jobName ? '．' + esc(n.jobName) : ''}${n.blurb ? '．' + esc(n.blurb) : ''}${n.trait ? '．性情' + esc(n.trait) : ''}</small></div>`;
    const sec = (title, list) => (list.length ? `<div class="sect">${title}</div>${list.map(row).join('')}` : '');
    const by = rels => s.npcs.filter(n => rels.includes(n.rel));
    const html = sec('婚姻', by(['spouse', 'late', 'ex'])) + sec('子女', by(['child'])) + sec('父母手足', by(['parent', 'sibling'])) + sec('師友', by(['mentor', 'friend', 'figure'])) + sec('對手', by(['rival']));
    return html || '<p class="muted">身邊暫時無人。</p>';
  }
  function worldHtml() {
    const era = G.eraAt(s.year);
    const w = s.world;
    const bar = (n, v) => `<div class="wbar"><span>${n}</span><div class="m"><span style="width:${Math.round(v)}%"></span></div><em>${Math.round(v)}</em></div>`;
    const near = D.HISTORY.filter(h => h.y > s.year && h.y <= s.year + 30)[0];
    const figs = D.FIGURES.filter(f => s.year >= f[1] && s.year <= f[2]).slice(0, 4);
    const exam = { noble: '世卿世祿', merit: '軍功爵制', chaju: '察舉徵辟', jiupin: '九品中正', keju: '科舉取士', modern: '新式學制與文官考試', none: '科舉暫停，由吏入仕' }[G.examSystem(s.year)];
    return `<div class="sect">當世</div><p>${esc(era.name)}，${esc(s.city)}。選官之法：${exam}。</p>
      <div class="sect">世局</div>${bar('安定', w.stable)}${bar('繁榮', w.rich)}${bar('文教', w.learn)}
      <p class="muted">世局會隨你的作為與時代起伏，也會影響收入、瘟疫與兵禍。</p>
      <div class="sect">坊間消息</div><p>${esc(s.news || '街坊無事。')}</p>
      ${near ? `<div class="sect">史書在前</div><p>${near.y - s.year} 年後（${esc(G.yearLabel(near.y))}）將是「${esc(near.title)}」。活到那天，有機會參與其中。</p>` : ''}
      ${figs.length ? `<div class="sect">當世人物</div><p>${figs.map(f => esc(f[0])).join('、')}</p>` : ''}`;
  }
  function chronHtml() {
    return s.log.slice(-40).reverse().map(l => `<div class="lg ${l.k}"><em>${l.age} 歲</em>${esc(l.t)}</div>`).join('');
  }
  function histHtml() {
    let h = `<p class="muted">你影響史事的力量取決於聲望、官階與本領。目前左右大局的機會約 ${Math.round(G.histChance(s) * 100)}%。</p>`;
    if (s.div.length) h += '<div class="sect">歷史偏移</div>' + s.div.slice().reverse().map(d => `<div class="hcard t${d.tier}"><b>${esc(d.title)}</b>．${esc(G.yearLabel(d.y))}<br>${esc(d.alt)}</div>`).join('');
    if (s.hist.length) h += '<div class="sect">親歷史事</div>' + s.hist.slice().reverse().map(x => `<div class="lg hist"><em>${x.age} 歲</em>${esc(x.title)}</div>`).join('');
    else if (!s.div.length) h += '<p>此生尚未親歷載入史冊的大事。</p>';
    return h;
  }
  function renderActions() {
    $('actBar').innerHTML = GROUPS.map(g => `<button class="act-btn ${openGroup === g.id ? 'on' : ''}" data-g="${g.id}" aria-expanded="${openGroup === g.id}"><i>${g.i}</i>${g.n}</button>`).join('');
    document.querySelectorAll('.act-btn').forEach(b => { b.onclick = () => togglePop(b.dataset.g); });
    const y = $('btnYear');
    y.textContent = s.age < 3 ? '長大一歲' : '過此一年';
    y.classList.toggle('pulse', s.ap <= 0);
  }
  function togglePop(g) { openGroup = openGroup === g ? null : g; renderActions(); renderPop(); }
  function renderPop() {
    const pop = $('actPop');
    if (!openGroup) { pop.classList.add('hidden'); return; }
    const group = GROUPS.find(x => x.id === openGroup);
    const list = G.actionList(s).filter(a => a.g === openGroup);
    pop.classList.remove('hidden');
    pop.innerHTML = `<h4><span>${group.n}．剩餘 ${s.ap} 次行動</span><button aria-label="關閉" id="popClose">×</button></h4>` + list.map(a => `<button class="item" data-id="${a.id}" ${a.off ? 'disabled' : ''}><b>${esc(a.label)}</b><small>${esc(a.off ? a.why : a.hint)}</small></button>`).join('');
    $('popClose').onclick = () => togglePop(openGroup);
    pop.querySelectorAll('.item').forEach(b => { b.onclick = () => act(b.dataset.id); });
  }

  /* ---------- 城鎮 ---------- */
  function renderStage() {
    const era = G.eraAt(s.year);
    const compact = window.innerWidth < 720;
    const sea = seasonIdx();
    const war = s.world.stable < 34;
    const key = [era.style, sea, war, compact, s.year < 67, s.year < 618, s.year >= 1912, s.city].join('|');
    if (key !== artKey) {
      artKey = key;
      const seed = [...s.city].reduce((t, c) => t + c.charCodeAt(0), 0) + 7;
      $('stage').innerHTML = A.townSvg({ style: era.style, season: sea, seed, s, war, compact });
      $('stage').querySelectorAll('[data-group]').forEach(n => {
        const open = () => { s.loc = n.dataset.loc; openGroup = n.dataset.group; movePlayer(); renderActions(); renderPop(); };
        n.addEventListener('click', open);
        n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    }
    movePlayer();
  }
  function movePlayer() {
    const m = document.getElementById('playerMark');
    if (!m) return;
    const p = A.placeOf(s, s.loc);
    m.innerHTML = A.playerFigure(s);
    m.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
  }
  // 行動對應到城鎮地點，讓人物真的走過去
  const ACTION_LOC = { study: 'school', martial: 'yamen', craftl: 'workshop', tradel: 'market', medl: 'clinic', farml: 'fields', mentor: 'school', work: null, seekjob: 'market', exam: 'yamen', invest: 'market', project: 'yamen', meet: 'teahouse', tavern: 'teahouse', seek: 'teahouse', visitf: 'teahouse', filial: 'home', match: 'home', teach: 'home', homecare: 'home', divorce: 'home', rest: 'home', tonic: 'clinic', doctor: 'clinic', pray: 'temple', travel: 'market', charity: 'temple', petition: 'yamen', write: 'school', invent: 'workshop' };
  const JOB_LOC = { farm: 'fields', craft: 'workshop', weave: 'workshop', trade: 'market', doctor: 'clinic', soldier: 'yamen', clerk: 'yamen', teacher: 'school', cleric: 'temple', artist: 'teahouse' };

  function deltaHtml(ds) {
    return (ds || []).map(d => `<span class="delta ${d.v > 0 ? 'up' : 'down'}">${esc(d.k)}${d.v > 0 ? '+' : ''}${d.v}</span>`).join('');
  }
  function setNarr(text, ds) { $('narr').innerHTML = `${esc(text)}${deltaHtml(ds)}`; }

  function act(id) {
    s.loc = ACTION_LOC[id] || (s.job ? JOB_LOC[s.job.id] : 'market') || s.loc;
    const res = G.doAction(s, id);
    if (res) setNarr(res.text, res.deltas);
    afterStep();
  }
  function afterStep() {
    store.set(SAVE, s);
    if (!s.alive) { finishLife(); return; }
    renderAll();
    pumpEvents();
  }
  $('btnYear').onclick = () => {
    if (s.pending.length) { pumpEvents(); return; }
    openGroup = null;
    const before = s.log.length;
    G.endYear(s);
    const fresh = s.log.slice(before).filter(l => l.k !== 'life');
    setNarr(fresh.length ? fresh[fresh.length - 1].t : `${s.age} 歲這一年開始了。${s.news || ''}`, []);
    afterStep();
  };
  document.querySelectorAll('.tab').forEach(t => { t.onclick = () => { tab = t.dataset.tab; renderRight(); }; });
  $('btnMenu').onclick = () => { store.set(SAVE, s); home(); };

  /* ---------- 事件卡 ---------- */
  const TAGS = { hist: '史事', bad: '變故', ill: '疾病', family: '家事', life: '人生' };
  function pumpEvents() {
    const ev = G.top(s);
    if (!ev) { $('modal').classList.add('hidden'); return; }
    openGroup = null; renderPop();
    $('modal').classList.remove('hidden');
    const card = $('evCard');
    card.className = 'ev-card ' + (ev.kind || 'life');
    $('evTag').textContent = TAGS[ev.kind] || '人生';
    $('evTitle').textContent = ev.title;
    $('evText').textContent = ev.text;
    const input = $('evInput');
    input.classList.toggle('hidden', !ev.input);
    input.value = '';
    input.placeholder = ev.input || '';
    const box = $('evChoices');
    box.innerHTML = '';
    ev.choices.forEach(c => {
      const b = document.createElement('button');
      b.className = 'choice'; b.disabled = c.off;
      b.innerHTML = `<b>${esc(c.label)}</b>${c.off && c.why ? `<small>${esc(c.why)}</small>` : c.hint ? `<small>${esc(c.hint)}</small>` : ''}`;
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
      // 結果留在卡上，讀完再繼續
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
    $('modal').classList.add('hidden');
    store.del(SAVE);
    archive(s);
    renderEnding(s);
  }
  function archive(life) {
    const list = store.get(ARCHIVE) || [];
    if (!list.some(x => x.id === life.birthYear + life.name + life.death.year)) {
      list.unshift({ id: life.birthYear + life.name + life.death.year, name: life.name, eraId: life.eraId, era: D.ERAS.find(e => e.id === life.eraId).name, city: life.birthCity, born: life.birthYear, age: life.age, cause: life.death.cause, rank: life.biography.legacy.n, title: life.biography.title, text: G.bioText(life) });
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
      <div class="eyebrow">浮生一夢．此生已畢</div>
      <h2>《${esc(life.name)}傳》</h2>
      <p><span class="rank">${esc(b.legacy.n)}</span>${esc(b.title)}．享年 ${life.age} 歲．${esc(life.death.cause)}</p>
      <p class="muted" style="margin-top:6px">${esc(b.legacy.d)}</p>
      <div class="endstats">
        <div><b>${st.fame}</b><small>聲望</small></div><div><b>${st.virtue}</b><small>德行</small></div><div><b>${st.money}</b><small>遺產（${esc(G.coin(life))}）</small></div>
        <div><b>${st.children}</b><small>子女</small></div><div><b>${life.met.length}</b><small>名士之交</small></div><div><b>${b.div.filter(d => d.tier >= 2).length}</b><small>影響史事</small></div>
      </div>
      <div class="bio">${b.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</div>
      <div class="epitaph">${esc(b.epitaph)}</div>
      ${div}
      <h3>生平年表</h3><div class="tl">${tl}</div>
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
      ${list.length ? list.map((x, i) => `<div class="arc"><b>${esc(x.name)}</b>　${esc(x.era)}．${esc(x.city)}．享年 ${x.age} 歲．${esc(x.rank)}<br><span class="muted">${esc(x.title)}．${esc(x.cause)}</span><br><button class="btn ghost" data-read="${i}" style="padding:4px 10px;margin-top:5px;font-size:13px">讀傳記</button></div>`).join('') : '<p>還沒有走完任何一世。</p>'}
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

  addEventListener('keydown', e => { if (e.key === 'Escape' && openGroup) togglePop(openGroup); });
  let resizeT;
  addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (s && !$('game').classList.contains('hidden')) renderStage(); }, 200); });
  home();
})();
