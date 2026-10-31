/* 浮生千年：遊戲規則。不碰 DOM，狀態全可 JSON 序列化，瀏覽器與 Node 模擬共用。 */
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.FS_DATA;
  const { ERAS, AFTER_ERA, NAMES, FAMILIES, SKILLS, JOBS, DISEASES, HISTORY, FIGURES, BREAKTHROUGHS, REIGNS } = D;

  /* ---------- 亂數 ---------- */
  function rnd(s) { // mulberry32，狀態存在 s.rng，存檔後可接續
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const ri = (s, a, b) => a + Math.floor(rnd(s) * (b - a + 1));
  const chance = (s, p) => rnd(s) < p;
  const pick = (s, arr) => arr[Math.floor(rnd(s) * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function weighted(s, arr, w) {
    const total = arr.reduce((t, x) => t + w(x), 0);
    let r = rnd(s) * total;
    for (const x of arr) { r -= w(x); if (r <= 0) return x; }
    return arr[arr.length - 1];
  }

  /* ---------- 曆法與時代 ---------- */
  const eraAt = y => ERAS.find(e => y >= e.start && y <= e.end) || AFTER_ERA;
  const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥', ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬';
  function astro(y) { return y < 0 ? y + 1 : y; } // 公元前 1 年 = 天文 0 年
  function ganzhi(y) {
    const n = ((astro(y) - 4) % 60 + 60) % 60;
    return STEMS[n % 10] + BRANCHES[n % 12];
  }
  const zodiac = y => ZODIAC[((astro(y) - 4) % 12 + 12) % 12];
  const yearLabel = y => (y < 0 ? '公元前 ' + (-y) + ' 年' : '公元 ' + y + ' 年');
  function reignLabel(y) {
    const r = REIGNS.find(x => y >= x[0] && y <= x[1]);
    if (!r || y < 0) return '';
    if (r[2].includes('前後') || r[2].includes('時期') || r[2] === '武周') return r[2];
    const n = y - r[0] + 1;
    const cn = '元二三四五六七八九十'.split('');
    const num = n <= 10 ? cn[n - 1] : n < 20 ? '十' + cn[n - 11] : n % 10 === 0 ? cn[n / 10 - 1] + '十' : cn[Math.floor(n / 10) - 1] + '十' + cn[n % 10 - 1];
    return r[2] + num + '年';
  }
  function dateLabel(s) {
    return (s.year < 1912 && reignLabel(s.year) ? reignLabel(s.year) + '．' : s.year >= 1912 && s.year <= 1949 ? '民國' + (s.year === 1912 ? '元' : s.year - 1911) + '年．' : '') + ganzhi(s.year) + zodiac(s.year) + '年';
  }
  function examSystem(y) {
    if (y < -221) return 'noble';
    if (y <= -207) return 'merit';
    if (y <= 219) return 'chaju';
    if (y <= 604) return 'jiupin';
    if (y >= 1280 && y < 1315) return 'none';
    if (y <= 1905) return 'keju';
    return 'modern';
  }
  const femaleOpen = s => s.year >= 1898; // 經正女學之後，女子入學與就業開始可能
  const modern = s => s.year >= 1912;
  const buddhist = s => s.year >= 67;

  function jobName(s, id, rank) {
    if (id === 'cleric' && !buddhist(s)) return ['小巫', '巫祝', '大祝', '卜筮宗師'][rank];
    if (id === 'clerk' && s.year < -221) return ['小史', '大夫家臣', '大夫', '卿相'][rank];
    return JOBS[id].names[modern(s) ? 1 : 0][rank];
  }
  const curJob = s => (s.job ? jobName(s, s.job.id, s.job.rank) : (s.age < 15 ? '童稚' : '閒居'));

  /* ---------- 建立人生 ---------- */
  // 每個朝代機率相同，朝代內每一年機率相同；沒有任何選代或解鎖。
  function drawFate(seed, answers) {
    const s = { rng: seed == null ? (Date.now() ^ (Math.random() * 1e9)) | 0 : seed | 0 };
    const era = pick(s, ERAS);
    const year = ri(s, era.start, era.end);
    const cities = era.cities.filter(c => (c.min == null || year >= c.min) && (c.max == null || year <= c.max));
    const city = pick(s, cities.length ? cities : era.cities);
    const family = weighted(s, FAMILIES, f => f.w);
    const sex = chance(s, .5) ? 'm' : 'f';
    return { seed: s.rng, eraId: era.id, year, city: city.n, regime: city.r, familyId: family.id, sex, name: makeName(s, era, sex), answers: answers || null };
  }
  function makeName(s, era, sex, sur) {
    const pool = NAMES[era.names];
    const surname = sur != null ? sur : pick(s, pool.sur);
    return surname + pick(s, pool[sex]);
  }
  const surnameOf = (s, name, era) => {
    const pool = NAMES[era.names].sur;
    return pool.find(x => x && name.startsWith(x)) || '';
  };

  function traitsFrom(s, answers) {
    const a = answers && answers.length === 6 ? answers : Array.from({ length: 6 }, () => (chance(s, .5) ? 'A' : 'B'));
    return {
      code: a.join(''),
      label: [a[0] === 'A' ? '熱心' : '審慎', a[1] === 'A' ? '務實' : '好學', a[3] === 'A' ? '守成' : '變通', a[5] === 'A' ? '敢闖' : '持重'].join('．'),
      charm: 40 + (a[0] === 'A' ? 10 : 0) + (a[2] === 'B' ? 10 : 0) + ri(s, -10, 12),
      wit: 40 + (a[1] === 'B' ? 12 : 0) + (a[4] === 'B' ? 8 : 0) + ri(s, -10, 12),
      nerve: 35 + (a[5] === 'A' ? 15 : 0) + (a[4] === 'A' ? 8 : 0) + ri(s, -8, 12),
      steady: a[3] === 'A',
      ethic: a[2] === 'A'
    };
  }

  function newLife(fate) {
    const era = ERAS.find(e => e.id === fate.eraId);
    const fam = FAMILIES.find(f => f.id === fate.familyId);
    const s = {
      v: 2, rng: fate.seed, eraId: era.id, birthYear: fate.year, year: fate.year, age: 0, sex: fate.sex, name: fate.name,
      city: fate.city, regime: fate.regime, birthCity: fate.city, familyId: fam.id, famName: fam.name,
      hp: 88, con: 0, mood: 72, fame: 0, virtue: 0, money: fam.money,
      skills: { wen: 0, wu: 0, gong: 0, shang: 0, yi: 0, nong: 0 },
      job: null, jobHist: [], exam: 0, disguise: false, schooled: false,
      ap: 0, apMax: 0, season: 0, npcs: [], nextId: 1, spouseId: null, mentorId: null, ills: [],
      log: [], hist: [], seen: [], div: [], world: { stable: 50, rich: 50, learn: 50 }, projects: [], works: [], inv: [], breakthroughs: [],
      met: [], flags: {}, pending: [], alive: true, death: null, loc: 'home', news: '', famineYears: 0
    };
    s.traits = traitsFrom(s, fate.answers);
    s.con = clamp(62 + (fam.rank >= 3 ? 6 : 0) + ri(s, -14, 18), 30, 95);
    s.skills[fam.skill] = ri(s, 1, 5);

    const era2 = era;
    const fatherName = makeName(s, era2, 'm', surnameOf(s, s.name, era2));
    // 手足都比你大，母親的年紀要生得出最大的那一個
    const sibAges = Array.from({ length: ri(s, 0, 3) }, () => ri(s, 1, 10));
    const motherAge = Math.max(ri(s, 17, 32), 16 + Math.max(0, ...sibAges));
    addNpc(s, { name: fatherName, sex: 'm', age: motherAge + ri(s, 0, 9), rel: 'parent', label: '父親', aff: 65, job: fam.job, status: fam.rank });
    addNpc(s, { name: makeName(s, era2, 'f'), sex: 'f', age: motherAge, rel: 'parent', label: '母親', aff: 80, job: 'home', status: fam.rank });
    for (const older of sibAges) {
      const sx = chance(s, .5) ? 'm' : 'f';
      addNpc(s, { name: makeName(s, era2, sx, surnameOf(s, s.name, era2)), sex: sx, age: older, rel: 'sibling', label: (sx === 'm' ? '兄長' : '姊姊'), aff: 60, status: fam.rank });
    }
    const where = fate.regime && !era.name.includes(fate.regime) ? fate.regime + '．' : '';
    say(s, `生於${era.name}${where}${s.city}的${fam.name}，取名「${s.name}」。`, null, 'major');
    pushBirth(s);
    syncAp(s);
    return s;
  }

  function addNpc(s, o) {
    const n = Object.assign({ id: s.nextId++, alive: true, aff: 50, age: 20, status: 1, job: null }, o);
    s.npcs.push(n);
    return n;
  }
  const npc = (s, id) => s.npcs.find(n => n.id === id);
  const spouse = s => (s.spouseId ? npc(s, s.spouseId) : null);
  const children = (s, alive) => s.npcs.filter(n => n.rel === 'child' && (!alive || n.alive));
  const parents = s => s.npcs.filter(n => n.rel === 'parent' && n.alive);
  const friends = s => s.npcs.filter(n => ['friend', 'mentor', 'figure'].includes(n.rel) && n.alive);

  /* ---------- 效果與紀錄 ---------- */
  const STAT_LABEL = { hp: '健康', mood: '心境', money: '積蓄', fame: '聲望', virtue: '德行', ...SKILLS };
  function eff(s, e) {
    const out = [];
    if (!e) return out;
    for (const k in e) {
      const v = Math.round(e[k]);
      if (!v) continue;
      if (k in s.skills) s.skills[k] = clamp(s.skills[k] + v, 0, 100);
      else if (k === 'hp') s.hp = clamp(s.hp + v, 0, maxHp(s));
      else if (k === 'mood') s.mood = clamp(s.mood + v, 0, 100);
      else if (k === 'money') s.money = Math.round(s.money + v);
      else if (k === 'fame') s.fame = Math.max(0, s.fame + v);
      else if (k === 'virtue') s.virtue = clamp(s.virtue + v, -100, 100);
      out.push({ k: STAT_LABEL[k] || k, v });
    }
    return out;
  }
  function say(s, text, e, kind) {
    const deltas = eff(s, e);
    s.log.push({ y: s.year, age: s.age, t: text, k: kind || 'life' });
    if (s.log.length > 500) s.log = s.log.filter((l, i) => l.k === 'major' || l.k === 'hist' || i > s.log.length - 300);
    return { text, deltas };
  }
  function maxHp(s) {
    const base = 100 - Math.max(0, s.age - 45) * .35;
    return clamp(base - s.ills.reduce((t, i) => t + (i.chronic || 0), 0) * 1.5, 18, 100);
  }
  function pushEvent(s, id, ctx) {
    const def = EVENTS[id];
    const c = ctx || {};
    const ev = { id, ctx: c, title: tval(def.title, s, c), text: tval(def.text, s, c), input: def.input ? tval(def.input, s, c) : null,
      kind: def.kind || 'life', choices: resolveChoices(s, def, c) };
    if (def.front) s.pending.unshift(ev); else s.pending.push(ev);
    return ev;
  }
  const tval = (v, s, c) => (typeof v === 'function' ? v(s, c) : v);
  function resolveChoices(s, def, c) {
    return tval(def.choices, s, c).map((ch, i) => ({ i, label: ch.t, hint: ch.hint || '', off: ch.req ? !ch.req(s, c) : false, why: ch.why || '' }));
  }
  // 前一個事件可能已改變狀態，所以顯示與結算時都以當下狀態重算選項。
  function top(s) {
    const ev = s.pending[0];
    if (ev) ev.choices = resolveChoices(s, EVENTS[ev.id], ev.ctx);
    return ev || null;
  }
  function resolve(s, idx, input) {
    const ev = top(s);
    if (!ev) return null;
    const def = EVENTS[ev.id];
    if (input != null) ev.ctx.input = input;
    const ch = tval(def.choices, s, ev.ctx)[idx];
    if (!ch || (ch.req && !ch.req(s, ev.ctx))) return null;
    s.pending.shift();
    const res = ch.fx(s, ev.ctx) || { text: '', deltas: [] };
    afterChange(s);
    return res;
  }
  function afterChange(s) {
    if (s.alive && s.hp <= 0) die(s, s.lastHurt || (s.age >= 60 ? '壽終正寢' : '積勞成疾'));
    s.lastHurt = null; // 舊傷不該成為多年後的死因
  }
  function hurt(s, why) { s.lastHurt = why; }


  /* ---------- 行動點 ---------- */
  function apFor(age) { return age < 3 ? 0 : age < 7 ? 1 : age < 13 ? 2 : age < 72 ? 3 : age < 82 ? 2 : 1; }
  function syncAp(s) { s.apMax = apFor(s.age); s.ap = s.apMax; s.season = 0; }
  function spend(s) { s.ap = Math.max(0, s.ap - 1); s.season = clamp(s.apMax ? Math.floor((s.apMax - s.ap) / s.apMax * 3) : 0, 0, 3); }

  /* ---------- 行動定義 ---------- */
  const skillGain = (s, base) => base + s.traits.wit / 40 + (s.mentorId && npc(s, s.mentorId) && npc(s, s.mentorId).alive ? 2 : 0);
  function canRead(s) {
    if (s.schooled) return true;
    if (s.sex === 'f' && !femaleOpen(s)) return FAMILIES.find(f => f.id === s.familyId).rank >= 2;
    return true;
  }
  const costLvl = s => clamp(eraAt(s.year).turb, .1, 1);
  const livingCost = s => 5 + s.age / 20;

  const ACTIONS = [
    // 學藝
    { id: 'study', g: 'study', label: s => (modern(s) ? '上學讀書' : s.age < 7 ? '認字描紅' : '讀書習字'), hint: '文墨提升', min: 4,
      why: s => (canRead(s) ? '' : '此世女子難以入學；或可在家偷學'), run: s => {
        const cost = s.age < 15 && parents(s).length ? 0 : 2;
        const g = skillGain(s, 3) * (s.sex === 'f' && !femaleOpen(s) ? .8 : 1);
        return say(s, pick(s, ['你埋首書卷，字跡日漸工整。', '燈下溫書，終於讀懂了前人的道理。', '老師一句點撥，令你茅塞頓開。']), { wen: g, money: -cost, mood: -1 });
      } },
    { id: 'martial', g: 'study', label: '習武強身', hint: '武藝與體魄', min: 6, run: s => {
      s.con = clamp(s.con + .4, 20, 98);
      return say(s, pick(s, ['晨起練功，拳腳漸有章法。', '隨老兵學了幾招，掌心磨出了繭。']), { wu: skillGain(s, 3), hp: 1, mood: 1 });
    } },
    { id: 'craftl', g: 'study', label: '學手藝', hint: '匠藝提升', min: 6, run: s => say(s, pick(s, ['你在工坊裡看師傅下料，自己也學著做。', '手上多了幾道傷，做出的東西也像樣了。']), { gong: skillGain(s, 3) }) },
    { id: 'tradel', g: 'study', label: '學做買賣', hint: '商道提升', min: 8, run: s => say(s, pick(s, ['你跟著掌櫃學看貨與談價。', '你學會了分辨成色，也學會了察言觀色。']), { shang: skillGain(s, 3), money: 1 }) },
    { id: 'medl', g: 'study', label: '學醫辨藥', hint: '醫術提升', min: 8, run: s => say(s, pick(s, ['你隨藥農入山，認得了幾味新藥。', '你背誦脈訣，也開始替鄰人把脈。']), { yi: skillGain(s, 2.6) }) },
    { id: 'farml', g: 'study', label: '學耕種', hint: '農桑提升', min: 6, run: s => say(s, pick(s, ['你學著看天時、選種子。', '下田一整日，腰痠背痛，卻也懂了節氣。']), { nong: skillGain(s, 3.2), money: 1, hp: -1 }) },
    { id: 'mentor', gate: true, g: 'study', label: '拜師求藝', hint: '尋找師父（可大增進步）', min: 7, noAp: true, avail: s => (s.mentorId && npc(s, s.mentorId).alive ? '你已有師父' : ''), run: s => { pushEvent(s, 'mentorOffer', { opts: mentorOptions(s) }); return null; } },

    // 工作
    { id: 'work', g: 'work', label: s => (s.job ? '勤於本業：' + curJob(s) : '打零工'), hint: '賺錢、累積經驗', min: 8, run: doWork },
    { id: 'seekjob', g: 'work', label: s => (s.job ? '改行轉業' : '謀一份差事'), hint: '選擇職業', min: 13, noAp: true, run: s => { pushEvent(s, 'jobChoice', {}); return null; } },
    { id: 'exam', g: 'work', label: s => examLabel(s), hint: s => examHint(s), min: 14, avail: examAvail, run: doExam },
    { id: 'invest', g: 'work', label: '投資買賣', hint: '可能賺也可能賠', min: 18, avail: s => (s.money < 20 ? '本錢不足 20' : ''), run: doInvest },
    { id: 'project', gate: true, g: 'world', label: '興辦地方事業', hint: '修橋、義學、義倉等', min: 22, noAp: true, run: s => { pushEvent(s, 'projectChoice', {}); return null; } },

    // 交友
    { id: 'meet', g: 'social', label: '外出結交', hint: '認識新朋友', min: 5, run: doMeet },
    { id: 'tavern', g: 'social', label: s => (s.year >= 618 ? '茶館聽書' : '酒肆閒談'), hint: '打聽世事、心境回升', min: 10, run: doTavern },
    { id: 'seek', g: 'social', label: '拜訪當世名士', hint: '尋訪歷史人物', min: 14, avail: s => (figuresNow(s).length ? '' : '此時此地，未聞名士'), run: doSeekFigure },
    { id: 'visitf', gate: true, g: 'social', label: '探望親友', hint: '增進情誼', min: 5, noAp: true, avail: s => (friends(s).length + s.npcs.filter(n => n.alive && (n.rel === 'sibling' || n.rel === 'parent')).length ? '' : '身邊已無親友'), run: s => { pushEvent(s, 'visitChoice', {}); return null; } },

    // 家庭
    { id: 'filial', g: 'family', label: '孝養雙親', hint: '德行、親情', min: 4, avail: s => (parents(s).length ? '' : '雙親已不在'), run: doFilial },
    { id: 'match', g: 'family', label: s => (spouse(s) ? '家庭和睦' : '議親說媒'), hint: s => (spouse(s) ? '陪伴配偶，子嗣機會提升' : '挑選對象成家'), min: 15, noAp: s => !spouse(s), run: doMatch },
    { id: 'teach', g: 'family', label: '教養子女', hint: '子女學識提升', min: 18, avail: s => (children(s, true).filter(c => c.age < 18 && c.age > 2).length ? '' : '眼下沒有需要教養的孩子'), run: doTeach },
    { id: 'homecare', g: 'family', label: '操持家務', hint: '省錢、心境回升', min: 8, run: s => say(s, pick(s, ['你把家裡收拾妥當，日子雖平淡也踏實。', '一家人圍爐吃飯，都說今年還過得去。']), { mood: 4, money: 2 }) },
    { id: 'divorce', gate: true, g: 'family', label: '和離', hint: '結束這段婚姻', min: 18, avail: s => (spouse(s) ? '' : '尚未成婚'), noAp: true, run: s => { pushEvent(s, 'divorceAsk', {}); return null; } },

    // 健康
    { id: 'rest', g: 'health', label: '靜養調息', hint: '健康回復', min: 3, run: s => say(s, pick(s, ['你歇了一季，氣色好了些。', '清茶淡飯，早睡早起。']), { hp: 7, mood: 4 }) },
    { id: 'tonic', g: 'health', label: '進補延年', hint: '花錢補身', min: 18, avail: s => (s.money < 12 ? '需 12 ' + coin(s) : ''), run: s => { s.con = clamp(s.con + .6, 20, 98); return say(s, '你買了些補品，吃得講究了。', { hp: 10, money: -12, mood: 2 }); } },
    { id: 'doctor', gate: true, g: 'health', label: '延醫問診', hint: '治療身上的病', min: 3, avail: s => (s.ills.length ? '' : '眼下無病'), noAp: true, run: s => { pushEvent(s, 'illness', { illId: s.ills[0].id, voluntary: true }); return null; } },
    { id: 'pray', g: 'health', label: s => (buddhist(s) ? '燒香祈福' : '祭祀占卜'), hint: '心境回升，略有天意', min: 6, run: s => say(s, pick(s, ['你敬了一炷香，心裡安定不少。', '卜得一吉，便覺日子有盼頭。']), { mood: 7, money: -1, virtue: 1 }) },

    // 世事
    { id: 'travel', gate: true, g: 'world', label: '遊歷他鄉', hint: '見世面，或可遷居', min: 15, noAp: true, avail: s => (s.money < 10 ? '盤纏不足 10' : ''), run: s => { pushEvent(s, 'travelChoice', { opts: travelOptions(s) }); return null; } },
    { id: 'charity', g: 'world', label: '濟弱行善', hint: '德行與聲望', min: 14, avail: s => (s.money < 8 ? '需 8 ' + coin(s) : ''), run: s => say(s, pick(s, ['你施粥贈藥，街坊都記著你的好。', '你替孤老人家修好了屋頂。']), { money: -8, virtue: 4, fame: 2, mood: 3 }) },
    { id: 'petition', g: 'world', label: s => (modern(s) ? '投書報章' : '上書言事'), hint: '需文墨，影響世局', min: 18, avail: s => (s.skills.wen < 25 ? '文墨需達 25' : ''), run: doPetition },
    { id: 'write', gate: true, g: 'world', label: '著書立說', hint: '留名後世', min: 25, avail: s => (s.skills.wen + bestSkill(s) < 80 ? '學識尚不足以著述' : ''), noAp: true, run: s => { pushEvent(s, 'bookChoice', {}); return null; } },
    { id: 'invent', g: 'world', label: '鑽研創制', hint: '有望改變歷史', min: 20, avail: s => (availableBreakthroughs(s).length ? '' : '此時無從著手'), run: doInvent }
  ];
  const coin = s => eraAt(s.year).coin;
  function bestSkill(s) { return Math.max(...Object.values(s.skills)); }

  function actionList(s) {
    return ACTIONS.map(a => {
      const min = a.min || 0;
      let reason = s.age < min ? `${min} 歲以後才能` : '';
      if (!reason && a.avail) reason = a.avail(s) || '';
      if (!reason && a.why) reason = a.why(s) || '';
      const free = typeof a.noAp === 'function' ? a.noAp(s) : a.noAp;
      if (!reason && (!free || a.gate) && s.ap <= 0) reason = '今年的時光已用盡';
      return { id: a.id, g: a.g, label: tval(a.label, s), hint: tval(a.hint, s), off: !!reason, why: reason };
    });
  }
  function doAction(s, id) {
    const a = ACTIONS.find(x => x.id === id);
    const item = actionList(s).find(x => x.id === id);
    if (!a || !item || item.off || s.pending.length || !s.alive) return null;
    const free = typeof a.noAp === 'function' ? a.noAp(s) : a.noAp;
    if (!free) spend(s);
    const res = a.run(s);
    afterChange(s);
    return res;
  }

  function doWork(s) {
    if (!s.job) {
      const pay = 3 + bestSkill(s) / 12 + Math.floor(rnd(s) * 3);
      const key = Object.keys(s.skills).sort((a, b) => s.skills[b] - s.skills[a])[0];
      return say(s, pick(s, ['你到處打零工，勉強餬口。', '碼頭、田間、店鋪，有活便做。']), { money: pay, hp: -1, [key]: 1 });
    }
    const j = JOBS[s.job.id];
    const prosper = .7 + s.world.rich / 160;
    const pay = Math.round(j.pay[s.job.rank] * .45 * prosper * (.8 + rnd(s) * .4));
    const skillup = 1.4 + rnd(s) * 1.4;
    s.job.xp += 16 + s.skills[j.skill] / 8;
    const r = { money: pay, [j.skill]: skillup, mood: -1, hp: -1, fame: s.job.rank >= 1 && chance(s, .5) ? s.job.rank : 0 };
    let line = pick(s, [`你在${curJob(s)}的位子上兢兢業業。`, '手上的事一件接著一件，倒也充實。', '這一季的差事不算輕鬆，好在收入尚可。']);
    if (s.job.id === 'soldier' && eraAt(s.year).turb > .4 && chance(s, .15)) { r.hp -= ri(s, 5, 18); hurt(s, '戰陣負傷不治'); r.fame += 3; line = '一場小戰，你帶傷而歸，也得了賞。'; }
    const res = say(s, line, r);
    tryPromote(s, res);
    return res;
  }
  function tryPromote(s, res) {
    const j = JOBS[s.job.id], next = s.job.rank + 1;
    if (next > 3 || s.job.xp < 100 || s.skills[j.skill] < j.req[next]) return;
    if (s.job.id === 'clerk' && next === 1 && !s.flags.entered) return; // 官職第一道門檻看選官制度
    if (s.job.id === 'trade' && s.money < next * 30) return;
    s.job.xp = 0; s.job.rank = next;
    const line = `升任${curJob(s)}，名聲漸起。`;
    say(s, line, { fame: next * 5, mood: 8 }, 'major');
    res.text += `　${line}`;
  }

  function examLabel(s) {
    return { noble: '遊說權貴求仕', merit: '求取軍功爵', chaju: '求舉孝廉', jiupin: '求品評入仕', keju: ['應童試', '應鄉試', '應會試', '已中進士'][Math.min(3, s.exam)], modern: '參加新式考試', none: '入吏求進' }[examSystem(s.year)];
  }
  function examHint(s) {
    return { noble: '世卿世祿，需家世或聲望', merit: '軍功授爵，需武藝', chaju: '需德行與聲望', jiupin: '門第決定品第', keju: '三年一科，看文墨', modern: '需文墨，可留學任職', none: '元初廢科舉，只能由吏入仕' }[examSystem(s.year)];
  }
  function examAvail(s) {
    if (s.flags.entered) return '已有功名在身';
    if (s.sex === 'f' && !femaleOpen(s) && !s.disguise) return '此世女子不得應舉（可改行時女扮男裝）';
    const sys = examSystem(s.year);
    if (sys === 'keju' && s.year >= 960 && (s.year % 3) !== 0) return `今年不開科（下科在 ${s.year + 3 - (((s.year % 3) + 3) % 3)} 年）`;
    if (sys === 'keju' && s.exam > 2) return '已中進士';
    return '';
  }
  function doExam(s) {
    const sys = examSystem(s.year);
    const fam = FAMILIES.find(f => f.id === s.familyId);
    const w = s.skills.wen;
    const enter = text => {
      s.flags.entered = true;
      if (!s.job || s.job.id !== 'clerk') setJob(s, 'clerk', 1); else s.job.rank = Math.max(1, s.job.rank);
      return say(s, text, { fame: 14, mood: 14 }, 'major');
    };
    if (sys === 'keju') {
      const lv = s.exam, need = [20, 42, 62][lv];
      const p = clamp((w - need) / 28 + .22, .03, .88);
      if (chance(s, p)) {
        s.exam++;
        const titles = ['秀才', '舉人', '進士'];
        if (s.exam >= 3) return enter(`金榜題名，中了進士！授官${jobName(s, 'clerk', 1)}。`);
        return say(s, `考中${titles[lv]}，鄉里都來道賀。`, { fame: 6 + lv * 3, mood: 12, money: -3 }, 'major');
      }
      return say(s, pick(s, ['榜上無名，你默默收拾行囊。', '差了幾名，只能再等下一科。']), { mood: -8, money: -3 });
    }
    const score = {
      noble: fam.rank * 15 + s.fame * .7 + w * .4,
      merit: s.skills.wu * .8 + s.fame * .3,
      chaju: s.virtue * .8 + s.fame * .6 + w * .3,
      jiupin: fam.rank * 18 + s.fame * .4 + w * .2,
      modern: w * .9 + s.fame * .2 - 8,
      none: w * .4 + s.fame * .5
    }[sys];
    const p = clamp((score - 30) / 40, .04, .8);
    if (chance(s, p)) return enter({ noble: '得權貴賞識，你終於躋身士大夫之列。', merit: '你憑軍功受爵，得了一官半職。', chaju: '郡守舉你為孝廉，徵召入仕。', jiupin: '中正官評定了你的品第，得以入仕。', modern: '你通過考試，取得公職。', none: '你由吏入官，終於有了品秩。' }[sys]);
    return say(s, pick(s, ['門路未通，空候了一季。', '對方敷衍了幾句，便請你回去。']), { mood: -5, money: -2 });
  }
  function doInvest(s) {
    const stake = Math.round(Math.max(20, s.money * .35));
    const p = clamp(.42 + s.skills.shang / 170 + s.world.rich / 700 - eraAt(s.year).turb * .15, .2, .85);
    if (chance(s, p)) {
      const gain = Math.round(stake * (.25 + rnd(s) * .9));
      return say(s, pick(s, ['你押對了時機，貨到價漲。', '一批貨順利出手，賺了一筆。']), { money: gain, shang: 2, mood: 4 });
    }
    const loss = Math.round(stake * (.3 + rnd(s) * .55));
    return say(s, pick(s, ['貨在路上遇雨，折了本錢。', '市面忽然轉冷，你只得賠本出清。']), { money: -loss, shang: 1, mood: -6 });
  }
  function doMeet(s) {
    if (friends(s).length >= 10) return say(s, '你與人寒暄一番，但知交已滿，只是淺交。', { mood: 2 });
    const sex = chance(s, .6) ? s.sex : (s.sex === 'm' ? 'f' : 'm');
    const n = addNpc(s, { name: makeName(s, eraAt(s.year), sex), sex, age: clamp(s.age + ri(s, -6, 8), 5, 80), rel: 'friend', label: '友人', aff: 30 + s.traits.charm / 3 + ri(s, 0, 15), status: ri(s, 0, 3), job: pick(s, Object.keys(JOBS)) });
    return say(s, `你結識了${n.name}，${pick(s, ['談得頗為投機', '一見如故', '約好下回再聚'])}。`, { mood: 5 });
  }
  function doTavern(s) {
    const next = HISTORY.find(h => h.y > s.year && h.y <= s.year + 8);
    let line;
    if (next && chance(s, .75)) line = `坊間議論紛紛：${rumor(next)}（史載此後將有「${next.title}」）`;
    else line = pick(s, ['說書人講到精彩處，滿堂喝采。', '你聽了一耳朵的家長里短，倒也痛快。', '幾個外地客談起遠方的貨價與兵事。']);
    s.news = line;
    return say(s, line, { mood: 5, money: -1, fame: chance(s, .3) ? 1 : 0 });
  }
  function rumor(h) {
    return { war: '兵馬調動頻繁，怕是要打仗了。', fall: '朝局不穩，人心惶惶。', revolt: '民間怨氣甚重，已有人聚眾。', reform: '朝廷恐怕要有大動作。', plague: '遠處傳來怪事，人人自危。', culture: '有能人正在做一件了不起的事。', explore: '聽說朝廷在挑選遠行之人。' }[h.t];
  }
  function figuresNow(s) {
    return FIGURES.filter(f => s.year >= f[1] + 16 && s.year <= f[2] && !s.met.includes(f[0]));
  }
  function doSeekFigure(s) {
    const list = figuresNow(s);
    const f = pick(s, list);
    const skill = f[3];
    const ok = chance(s, clamp(.3 + (s.fame + s.skills[skill]) / 110, .3, .92));
    if (!ok) return say(s, `你慕名尋訪${f[0]}，卻未能得見。`, { mood: -2, money: -2 });
    s.met.push(f[0]);
    addNpc(s, { name: f[0], sex: ['婦好', '卓文君', '班昭', '武則天', '李清照', '黃道婆', '秋瑾', '林徽因'].includes(f[0]) ? 'f' : 'm', age: s.year - f[1], rel: 'figure', label: '名士', aff: 45, deathYear: f[2], blurb: f[4], status: 3 });
    return say(s, `你竟有緣拜會${f[0]}（${f[4]}），一席話勝讀十年書。`, { [skill]: 8, fame: 6, mood: 8 }, 'major');
  }
  function doFilial(s) {
    parents(s).forEach(p => { p.aff = clamp(p.aff + 6, 0, 100); });
    return say(s, pick(s, ['你替父母分憂，老人家眼裡有了笑意。', '飯桌上一家人說了好久的話。']), { virtue: 3, mood: 3, money: -2 });
  }
  function doMatch(s) {
    if (!spouse(s)) {
      if (s.age < minMarry(s)) return say(s, '年紀尚小，家裡說再等等。', null);
      pushEvent(s, 'matchChoice', { cands: makeCandidates(s) });
      return null;
    }
    const sp = spouse(s);
    sp.aff = clamp(sp.aff + 8, 0, 100);
    s.flags.intimate = 2;
    return say(s, pick(s, [`你與${sp.name}閒話家常，彼此更貼心了。`, `一同看了場戲，${sp.name}笑得很開心。`]), { mood: 8, money: -1 });
  }
  function minMarry(s) { return s.year >= 1912 ? 18 : s.sex === 'f' ? 14 : 16; }
  function makeCandidates(s) {
    const sex = s.sex === 'm' ? 'f' : 'm';
    return [0, 1, 2].map(() => {
      const st = clamp(FAMILIES.find(f => f.id === s.familyId).rank + (s.job ? s.job.rank - 1 : 0) + ri(s, -2, 2), 0, 4);
      const trait = pick(s, ['溫厚', '機敏', '勤快', '爽朗', '多才', '持家', '寡言', '好強']);
      return { name: makeName(s, eraAt(s.year), sex), sex, age: clamp(s.age + ri(s, -4, 4), minMarry(s) - 1, 70), status: st, trait, price: 4 + st * 6, aff: 40 + ri(s, 0, 25), job: pick(s, ['farm', 'craft', 'trade', 'teacher', 'weave']) };
    });
  }
  const STATUS = ['貧戶', '小戶', '殷實人家', '書香門第', '官宦世家'];
  function doTeach(s) {
    const kids = children(s, true).filter(c => c.age < 18 && c.age > 2);
    kids.forEach(c => { c.edu = clamp((c.edu || 0) + 6 + s.skills.wen / 12, 0, 100); c.aff = clamp(c.aff + 4, 0, 100); });
    return say(s, `你耐心教${kids.map(k => k.name).slice(0, 3).join('、')}識字明理。`, { mood: 5, virtue: 1 });
  }
  function doPetition(s) {
    const power = power_(s, 'wen');
    const ok = chance(s, clamp(power / 100, .08, .7));
    if (ok) {
      s.world.stable = clamp(s.world.stable + 2, 0, 100);
      s.world.learn = clamp(s.world.learn + 2, 0, 100);
      return say(s, pick(s, ['你的建言被採納了幾分，地方稅賦有了調整。', '言論傳開，連官府都來請教。']), { fame: 6, virtue: 2, mood: 5 });
    }
    if (eraAt(s.year).turb > .5 && chance(s, .15)) { hurt(s, '因言獲罪'); return say(s, '你的文字觸怒了權貴，被打了一頓板子。', { hp: -12, mood: -10, fame: 3 }); }
    return say(s, '文字如石沉大海，並無回音。', { mood: -2, fame: 1 });
  }
  function availableBreakthroughs(s) {
    return BREAKTHROUGHS.filter(b => s.year >= b.min && s.year < b.y && !s.breakthroughs.includes(b.id) && s.skills[b.skill] >= 55);
  }
  function doInvent(s) {
    const list = availableBreakthroughs(s);
    const b = list[0];
    s.flags['rd_' + b.id] = (s.flags['rd_' + b.id] || 0) + 12 + s.skills[b.skill] / 5 + s.traits.wit / 10;
    if (s.flags['rd_' + b.id] >= 100) {
      s.breakthroughs.push(b.id);
      const early = b.y - s.year;
      addDiv(s, { title: b.n, tier: 3, y: s.year, fact: `史載此事要到公元 ${b.y} 年前後才成熟。`, alt: `你比歷史早了約 ${early} 年完成${b.n}。${b.alt}` });
      s.world.rich = clamp(s.world.rich + 6, 0, 100); s.world.learn = clamp(s.world.learn + 6, 0, 100);
      return say(s, `經年鑽研，你竟然做出了「${b.n}」！比史冊所載早了約 ${early} 年。`, { fame: 45, mood: 20, [b.skill]: 5 }, 'major');
    }
    return say(s, `你反覆試驗「${b.n}」，進度約 ${Math.round(s.flags['rd_' + b.id])}%。`, { [b.skill]: 1, money: -3, mood: -1 });
  }
  function mentorOptions(s) {
    const kinds = ['wen', 'wu', 'gong', 'shang', 'yi', 'nong'].filter(k => k !== 'wen' || canRead(s));
    const title = { wen: '老塾師', wu: '退伍老兵', gong: '老匠人', shang: '老掌櫃', yi: '老郎中', nong: '老莊稼把式' };
    const pool = kinds.sort(() => rnd(s) - .5).slice(0, 3);
    return pool.map(k => ({ kind: k, name: makeName(s, eraAt(s.year), chance(s, .85) ? 'm' : 'f'), title: title[k], fee: 3 + ri(s, 0, 8) }));
  }
  function travelOptions(s) {
    const e = eraAt(s.year);
    const list = (e.cities.length ? e.cities : []).filter(c => c.n !== s.city && (c.min == null || s.year >= c.min) && (c.max == null || s.year <= c.max));
    return list.sort(() => rnd(s) - .5).slice(0, 3).map(c => ({ n: c.n, r: c.r }));
  }
  function setJob(s, id, rank) {
    if (s.job) s.jobHist.push({ id: s.job.id, rank: s.job.rank, name: curJob(s) });
    s.job = { id, rank: rank || 0, xp: 0, since: s.year };
  }

  /* ---------- 影響力 ---------- */
  function power_(s, skill) {
    return s.fame * .55 + (s.job ? s.job.rank * 14 : 0) + (skill ? s.skills[skill] * .35 : bestSkill(s) * .35) + (s.traits.nerve - 40) * .25 + s.virtue * .1;
  }
  function addDiv(s, d) {
    s.div.push(d);
    s.log.push({ y: s.year, age: s.age, t: `【歷史偏移】${d.alt}`, k: 'hist' });
  }

  /* ---------- 事件表 ---------- */
  const EVENTS = {};
  const E = (id, def) => { EVENTS[id] = def; };

  function pushBirth(s) { pushEvent(s, 'birth', {}); }
  E('birth', { title: '呱呱墜地', text: s => `這一年是${yearLabel(s.year)}，${eraAt(s.year).name}。你生於${s.city}的${s.famName}。第一聲啼哭，${parents(s)[0].name}激動得說不出話來。`, choices: () => [
    { t: '放聲大哭', hint: '一聲啼哭驚四鄰', fx: s => { s.con = clamp(s.con + 3, 20, 98); return say(s, '你的哭聲響亮，鄰居都說這孩子命硬。', { hp: 2 }); } },
    { t: '靜靜看著這個世界', hint: '好奇寧靜', fx: s => { s.traits.wit += 3; return say(s, '你睜著眼睛四處看，大人都說這孩子有靈氣。', { mood: 3 }); } },
    { t: '對母親笑了一下', hint: '惹人疼愛', fx: s => { s.traits.charm += 3; return say(s, '母親抱著你，覺得這一切苦都值了。', { mood: 5 }); } }
  ] });

  E('enlighten', { title: '七歲啟蒙', text: s => `你七歲了。${parents(s)[0] ? parents(s)[0].name + '在飯後' : '家中長輩'}談起你往後的路。`, choices: s => {
    const fam = FAMILIES.find(f => f.id === s.familyId);
    const cost = 4;
    const opts = [
      { t: modern(s) ? '上新式小學' : examSystem(s.year) === 'noble' ? '入庠序識字' : '入塾讀書', hint: `學費 ${cost}，文墨大增`, req: st => canRead(st) || st.money >= cost * 3, fx: st => { st.schooled = true; return say(st, '你背上書袋，第一次走進學堂。', { wen: 8, money: -cost, mood: 4 }, 'major'); } },
      { t: '跟著家人學本事', hint: `學${SKILLS[fam.skill]}`, fx: st => say(st, `你跟著長輩學起了${SKILLS[fam.skill]}。`, { [fam.skill]: 9, mood: 2 }, 'major') },
      { t: s.sex === 'f' && !femaleOpen(s) ? '學女紅紡織' : '下田幫工', hint: s.sex === 'f' && !femaleOpen(s) ? '匠藝提升' : '農桑提升', fx: st => (st.sex === 'f' && !femaleOpen(st) ? say(st, '你學會了穿針引線，手越來越巧。', { gong: 9, money: 2 }, 'major') : say(st, '你跟著下田，知道了一粥一飯的來處。', { nong: 9, money: 2 }, 'major')) }
    ];
    return opts;
  } });

  E('comingOfAge', { title: s => (s.sex === 'm' ? '行冠禮' : '行笄禮'), text: s => (modern(s) ? '你成年了，要自己決定往後的路。' : `你${s.age}歲，已是大人了。長輩替你行了${s.sex === 'm' ? '冠' : '笄'}禮，說往後要靠自己。`), choices: () => [
    { t: '選定職業', hint: '立刻謀一份差事', fx: s => { pushEvent(s, 'jobChoice', { first: true }); return say(s, '你決定不再依靠家裡，開始找自己的營生。', null, 'major'); } },
    { t: '再求學幾年', hint: '文墨 +6', fx: s => say(s, '你決定多讀幾年書。', { wen: 6, mood: 2 }, 'major') },
    { t: '離家闖蕩', hint: '聲望與風險', fx: s => say(s, '你背起包袱離家，想看看外面的世界。', { fame: 3, money: 4, mood: 6, hp: -2 }, 'major') }
  ] });

  E('jobChoice', { title: '謀生之路', text: s => (s.job ? `你現在是${curJob(s)}，要改行嗎？` : '這世道該靠什麼吃飯？每種行當都有門檻。'), choices: s => {
    const list = Object.keys(JOBS).filter(id => !s.job || s.job.id !== id);
    return list.map(id => {
      const j = JOBS[id];
      const blocked = !j.female && s.sex === 'f' && !femaleOpen(s);
      const name = jobName(s, id, 0);
      const need = j.req[0];
      return {
        t: blocked ? `女扮男裝做${name}` : name,
        hint: `${SKILLS[j.skill]}${need ? ' ≥ ' + need : ''}；年入約 ${j.pay[0]} ${coin(s)}${blocked ? '；有被識破之險' : ''}`,
        req: st => st.skills[j.skill] >= need,
        fx: st => {
          if (st.ap > 0) spend(st);
          if (blocked) st.disguise = true;
          const startRank = st.flags.entered && id === 'clerk' ? 1 : 0;
          setJob(st, id, startRank);
          return say(st, `你開始做${curJob(st)}。${blocked ? '對外你換了男裝與名字，這個祕密不能讓人知道。' : ''}`, { mood: 5 }, 'major');
        }
      };
    }).concat([{ t: '再想想', hint: '不改變', fx: () => ({ text: '你決定再看看。', deltas: [] }) }]);
  } });

  E('mentorOffer', { title: '拜師', text: '打聽了一番，幾位師傅願意見你。', choices: (s, c) => c.opts.map(o => ({
    t: `${o.title}${o.name}`, hint: `專長${SKILLS[o.kind]}；束脩 ${o.fee}`, req: st => st.money >= o.fee,
    fx: st => {
      spend(st);
      const m = addNpc(st, { name: o.name, sex: 'm', age: ri(st, 45, 68), rel: 'mentor', label: '師父', aff: 55, kind: o.kind, status: 2 });
      st.mentorId = m.id;
      return say(st, `你拜${o.name}為師，專心學習${SKILLS[o.kind]}。`, { [o.kind]: 8, money: -o.fee, mood: 4 }, 'major');
    }
  })).concat([{ t: '暫且作罷', fx: () => ({ text: '你謝過師傅們，打算再想想。', deltas: [] }) }]) });

  E('visitChoice', { title: '探望親友', text: '要去看誰呢？', choices: s => {
    const list = s.npcs.filter(n => n.alive && ['parent', 'sibling', 'friend', 'mentor', 'figure'].includes(n.rel)).slice(0, 8);
    return list.map(n => ({ t: `${n.label}${n.name}`, hint: `情誼 ${Math.round(n.aff)}${n.age ? '．' + n.age + ' 歲' : ''}`, fx: st => {
      if (st.ap <= 0) return { text: '今年實在抽不開身。', deltas: [] };
      spend(st);
      const nn = npc(st, n.id);
      nn.aff = clamp(nn.aff + 10, 0, 100);
      const gift = nn.aff > 80 && chance(st, .25);
      return say(st, `你去看了${nn.name}，${pick(st, ['聊了一整個下午', '一起吃了頓飯', '聽他們說了近來的事'])}。${gift ? '臨走時對方硬塞了些東西。' : ''}`, { mood: 6, money: gift ? ri(st, 2, 8) : 0, virtue: 1 });
    } })).concat([{ t: '改日再說', fx: () => ({ text: '你想了想，今天還是算了。', deltas: [] }) }]);
  } });

  E('matchChoice', { title: s => (modern(s) ? '相親' : '媒人登門'), text: s => (modern(s) ? '親友介紹了幾位對象。新時代講究自由戀愛，但你也得看緣分。' : (parents(s).length ? '父母之命，媒妁之言。' : '媒人') + '遞上幾份庚帖。'), choices: (s, c) => c.cands.map(p => ({
    t: `${p.name}（${p.age} 歲）`, hint: `${STATUS[p.status]}．性情${p.trait}；聘禮 ${p.price}`, req: st => st.money >= p.price,
    fx: st => marry(st, p)
  })).concat([{ t: '都不合意', hint: '再等等', fx: st => say(st, '你婉拒了媒人，家裡嘆了口氣。', { mood: -2 }) }]) });
  function marry(s, p) {
    const n = addNpc(s, { name: p.name, sex: p.sex, age: p.age, rel: 'spouse', label: p.sex === 'm' ? '丈夫' : '妻子', aff: p.aff + 10, status: p.status, trait: p.trait, job: p.job });
    s.spouseId = n.id;
    s.flags.intimate = 1;
    return say(s, `你與${p.status >= 3 ? '出身' + STATUS[p.status] + '的' : ''}${p.name}成婚。花燭之夜，${pick(s, ['兩人都有些手足無措', '燭火照著新人的臉', '窗外的笑鬧聲久久未散'])}。`, { money: -p.price, mood: 15, fame: 2 }, 'major');
  }

  E('divorceAsk', { title: '和離', text: s => `你與${spouse(s).name}的情分（${Math.round(spouse(s).aff)}）走到這裡了嗎？和離後，子女多半仍留在家中。`, choices: () => [
    { t: '好聚好散', hint: '心境大減，名聲受損', req: s => !!spouse(s), fx: s => { spend(s); const sp = spouse(s); sp.rel = 'ex'; sp.label = '前配偶'; s.spouseId = null; return say(s, `你與${sp.name}和離，各自生歡喜。`, { mood: -10, fame: -2 }, 'major'); } },
    { t: '再試一次', hint: '情誼 +10', fx: s => { const sp = spouse(s); sp.aff = clamp(sp.aff + 10, 0, 100); return say(s, '你還是捨不得，兩人坐下來談了一夜。', { mood: 2 }); } }
  ] });

  const PROJECTS = [
    { id: 'bridge', n: '修橋鋪路', cost: 40, yrs: 2, effect: { rich: 5 }, fame: 12, line: '行人商旅再也不必涉水。' },
    { id: 'school', n: '興辦義學', cost: 60, yrs: 3, effect: { learn: 8 }, fame: 16, line: '窮人家的孩子也有書可讀。' },
    { id: 'granary', n: '設立義倉', cost: 50, yrs: 2, effect: { stable: 6 }, fame: 14, line: '荒年不再家家斷炊。' },
    { id: 'canal', n: '開渠灌田', cost: 80, yrs: 4, effect: { rich: 8, stable: 3 }, fame: 22, line: '千畝良田從此水旱無憂。' },
    { id: 'gazette', n: '編修方志', cost: 35, yrs: 3, effect: { learn: 5 }, fame: 15, line: '鄉里之事，都有了文字可考。', req: s => s.skills.wen >= 40 },
    { id: 'clinic', n: '開設藥局', cost: 45, yrs: 2, effect: { stable: 3 }, fame: 12, line: '小病有藥，大疫有備。', req: s => s.skills.yi >= 30 }
  ];
  E('projectChoice', { title: '地方事業', text: s => `你想為${s.city}留下些什麼？積蓄 ${s.money} ${coin(s)}。工程要連年投入，建成後將載入地方志。`, choices: s => PROJECTS.filter(p => !s.projects.some(x => x.id === p.id)).map(p => ({
    t: p.n, hint: `耗 ${p.cost} ${coin(s)}．${p.yrs} 年${p.req && !p.req(s) ? '．所學不足' : ''}`, req: st => st.money >= p.cost && (!p.req || p.req(st)),
    fx: st => { if (st.ap > 0) spend(st); st.projects.push({ id: p.id, n: p.n, left: p.yrs, done: false, startY: st.year }); return say(st, `你開始籌辦「${p.n}」。`, { money: -p.cost, fame: 3 }, 'major'); }
  })).concat([{ t: '暫不興辦', fx: () => ({ text: '你決定再積攢些力量。', deltas: [] }) }]) });

  const BOOK_KIND = { wen: '詩文集', wu: '兵法論', gong: '工藝圖說', shang: '貨殖錄', yi: '醫方集', nong: '農書' };
  E('bookChoice', { title: '著書立說', text: '你想留下什麼樣的文字？一部書要花一整年心血。', choices: s => Object.keys(SKILLS).filter(k => s.skills[k] >= 35 && !s.works.some(w => w.kind === k)).map(k => ({
    t: BOOK_KIND[k], hint: `以${SKILLS[k]}（${Math.round(s.skills[k])}）為本`,
    fx: st => {
      spend(st);
      const q = st.skills[k] + st.skills.wen * .5;
      const fame = Math.round(q / 5);
      const title = pick(st, ['', '', '雜', '新', '要', '續']);
      const n = `《${st.name}${title}${BOOK_KIND[k]}》`;
      st.works.push({ kind: k, n, q: Math.round(q), y: st.year });
      st.world.learn = clamp(st.world.learn + 2, 0, 100);
      return say(st, `你完成了${n}，${q > 90 ? '士林爭相傳抄' : q > 60 ? '在同行間流傳' : '只在親友間傳閱'}。`, { fame, mood: 10, [k]: 2 }, 'major');
    }
  })).concat([{ t: '再積累幾年', fx: () => ({ text: '你覺得還沒想透，便把筆放下。', deltas: [] }) }]) });

  E('travelChoice', { title: '遊歷他鄉', text: s => `要去哪裡？現在的你住在${s.city}。`, choices: (s, c) => c.opts.map(o => ({
    t: `遷居${o.n}`, hint: `花費 10．屬${o.r}`, req: st => st.money >= 10,
    fx: st => { spend(st); st.city = o.n; st.regime = o.r; return say(st, `你舉家遷到了${o.n}，一切都要重新開始。`, { money: -10, fame: 2, mood: 6, hp: -3 }, 'major'); }
  })).concat([
    { t: '只是走走', hint: '花費 8，見識增長', req: st => st.money >= 8, fx: st => { spend(st); const k = pick(st, Object.keys(st.skills)); return say(st, pick(st, ['你一路看山看水，也見識了各地風俗。', '旅途中遇見了形形色色的人。']), { money: -8, mood: 12, fame: 1, [k]: 2 }); } },
    { t: '不去了', fx: () => ({ text: '你還是留在了家裡。', deltas: [] }) }
  ]) });

  // 疾病
  E('illness', { title: s => `${illsById(s)}纏身`, text: (s, c) => { const i = s.ills.find(x => x.id === c.illId) || s.ills[0]; return `你得了${i ? i.n : '怪病'}，身子一日不如一日。該怎麼辦？`; }, kind: 'ill', front: true, choices: (s, c) => {
    const i = () => s.ills.find(x => x.id === c.illId) || s.ills[0];
    const label = buddhist(s) ? '求神拜佛' : '祭祀禳災';
    const docName = modern(s) ? '上醫院' : '請郎中';
    const cure = (st, p, cost, line, extra) => {
      const ill = st.ills.find(x => x.id === c.illId) || st.ills[0];
      if (!ill) return { text: '身體已無大礙。', deltas: [] };
      if (c.voluntary && st.ap > 0) spend(st);
      const ok = chance(st, clamp(p - (ill.sev - 15) / 80, .05, .97));
      if (ok) {
        if (ill.chronic) { ill.chronic = Math.max(1, ill.chronic - 1); return say(st, `${line}${ill.n}緩解了，但成了得長期調理的老毛病。`, { hp: 8, money: -cost, mood: 3 }, 'ill'); }
        st.ills = st.ills.filter(x => x !== ill);
        return say(st, `${line}${ill.n}漸漸好了。`, Object.assign({ hp: 8, money: -cost, mood: 6 }, extra || {}), 'ill');
      }
      hurt(st, ill.n + '不治');
      return say(st, `${line}可${ill.n}仍未見起色。`, { hp: -Math.round(ill.sev * .4), money: -cost, mood: -6 }, 'ill');
    };
    return [
      { t: `${docName}診治`, hint: '花費 10，有相當把握', req: st => st.money >= 10, fx: st => cure(st, .62, 10, '郎中開了方子，') },
      { t: '請名醫', hint: '花費 30，把握較高', req: st => st.money >= 30, fx: st => cure(st, .86, 30, '名醫妙手，') },
      { t: '自己配藥', hint: `靠醫術（${Math.round(s.skills.yi)}）`, req: st => st.skills.yi >= 15, fx: st => cure(st, .35 + st.skills.yi / 110, 2, '你自己抓藥煎服，', { yi: 2 }) },
      { t: label, hint: '花費 2，聽天由命', fx: st => cure(st, .28, 2, '你虔誠禱告，', { virtue: 1 }) },
      { t: '硬撐過去', hint: '不花錢，風險高', fx: st => cure(st, .22 + st.con / 300, 0, '你咬牙硬撐，') }
    ];
  } });
  function illsById(s) { return s.ills.length ? s.ills[0].n : '病痛'; }

  // 子女誕生
  E('childBirth', { title: '喜添新丁', text: (s, c) => `${s.sex === 'f' ? '經過一番生死掙扎，你' : spouse(s) ? spouse(s).name : '妻子'}${s.sex === 'f' ? '' : '為你'}生下了${c.sex === 'm' ? '一個男孩' : '一個女孩'}。要取什麼名字？`, input: () => '或自己取個名字', kind: 'family', choices: (s, c) => c.names.map(nm => ({
    t: nm, fx: st => bornChild(st, c, nm)
  })).concat([{ t: '用上面輸入的名字', hint: '空白則由長輩決定', fx: st => bornChild(st, c, (c.input || '').trim().slice(0, 6) || c.names[0]) }]) });
  function bornChild(s, c, nm) {
    const surname = s.sex === 'm' ? surnameOf(s, s.name, eraAt(s.year)) : (spouse(s) ? surnameOf(s, spouse(s).name, eraAt(s.year)) : surnameOf(s, s.name, eraAt(s.year)));
    const full = nm.startsWith(surname) ? nm : surname + nm;
    addNpc(s, { name: full, sex: c.sex, age: 0, rel: 'child', label: c.sex === 'm' ? '子' : '女', aff: 80, edu: s.skills.wen / 6, status: 1 });
    return say(s, `你的孩子${full}出生了。`, { mood: 16, money: -3 }, 'major');
  }

  // 子女教育與前程
  E('childSchool', { title: '子女啟蒙', text: (s, c) => `${npc(s, c.id).name}到了啟蒙的年紀。`, kind: 'family', choices: (s, c) => [
    { t: '送去讀書', hint: '花費 6', req: st => st.money >= 6, fx: st => { const k = npc(st, c.id); k.edu = clamp(k.edu + 18, 0, 100); return say(st, `你送${k.name}去讀書。`, { money: -6, mood: 3, virtue: 1 }); } },
    { t: '帶在身邊學本事', hint: '傳授家學', fx: st => { const k = npc(st, c.id); k.edu = clamp(k.edu + 10, 0, 100); k.fromParent = true; return say(st, `你把一身本事教給${k.name}。`, { mood: 4 }); } },
    { t: '先幫家裡幹活', hint: '省錢，孩子少學', fx: st => { const k = npc(st, c.id); k.aff = clamp(k.aff - 5, 0, 100); return say(st, `${k.name}早早開始幫家裡幹活。`, { money: 3 }); } }
  ] });
  E('childFuture', { title: '兒女前程', text: (s, c) => { const k = npc(s, c.id); return `${k.name}長大成人了。接下來要走哪一條路？`; }, kind: 'family', choices: (s, c) => {
    const k = npc(s, c.id);
    const opts = [];
    const jobs = k.edu > 55 ? ['teacher', 'clerk', 'doctor'] : k.edu > 25 ? ['trade', 'craft', 'doctor'] : ['farm', 'craft', 'soldier'];
    const parentJob = s.job && s.job.id;
    if (parentJob && !jobs.includes(parentJob)) jobs.unshift(parentJob);
    jobs.slice(0, 3).forEach(id => {
      const allow = JOBS[id].female || k.sex === 'm' || femaleOpen(s);
      const real = allow ? id : 'weave';
      opts.push({ t: `成為${jobName(s, real, 0)}`, hint: '為其安排前程', fx: st => { const kk = npc(st, c.id); kk.job = real; kk.jobName = jobName(st, real, kk.edu > 70 ? 2 : kk.edu > 35 ? 1 : 0); return say(st, `${kk.name}成了${kk.jobName}。`, { mood: 6 }, 'major'); } });
    });
    return opts;
  } });

  // 通用生活事件
  const LIFE = [
    { id: 'matchVisit', w: 2, cond: s => !spouse(s) && s.age >= minMarry(s) && s.age <= 40, push: s => pushEvent(s, 'matchChoice', { cands: makeCandidates(s) }) },
    { id: 'loveMatch', w: .6, cond: s => !spouse(s) && s.age >= minMarry(s) && s.age < 35 && friends(s).some(f => f.sex !== s.sex && f.age >= minMarry(s) - 1) },
    { id: 'friendNeed', w: 1.5, cond: s => friends(s).length > 0 && s.age >= 12 },
    { id: 'rival', w: .7, cond: s => s.job && s.age >= 18 && !s.npcs.some(n => n.rel === 'rival' && n.alive) },
    { id: 'rivalMove', w: 1, cond: s => s.npcs.some(n => n.rel === 'rival' && n.alive) },
    { id: 'windfall', w: .8, cond: s => s.age >= 10 },
    { id: 'thief', w: .9, cond: s => s.money > 25 },
    { id: 'corvee', w: 1.8, cond: s => s.age >= 16 && s.age < 55 && s.sex === 'm' && s.year < 1912 && !(s.job && s.job.rank >= 2) },
    { id: 'levy', w: 1.3, cond: s => s.age >= 16 && s.age < 50 && (s.sex === 'm' || s.disguise) && eraAt(s.year).turb > .35 && !(s.job && s.job.id === 'soldier') },
    { id: 'drought', w: 1.2, cond: s => s.age >= 12 },
    { id: 'localTrouble', w: 1, cond: s => s.age >= 20 && s.fame >= 15 },
    { id: 'promoteChance', w: 1, cond: s => s.job && s.job.rank < 3 },
    { id: 'lostChild', w: .7, cond: s => s.age >= 13 },
    { id: 'beggar', w: 1, cond: s => s.age >= 12 },
    { id: 'childQuestion', w: .6, cond: s => children(s, true).some(c => c.age >= 12) },
    { id: 'exposed', w: 4, cond: s => s.disguise && s.sex === 'f' && !femaleOpen(s) }
  ];
  E('loveMatch', { title: '情愫暗生', text: (s, c) => `相識多年的${npc(s, c.id).name}，這些日子總找藉口來看你。`, kind: 'family', choices: (s, c) => [
    { t: modern(s) ? '自由戀愛，成婚' : '不顧媒妁，私定終身', hint: modern(s) ? '成家' : '聲望可能受損', fx: st => { const n = npc(st, c.id); n.rel = 'spouse'; n.label = n.sex === 'm' ? '丈夫' : '妻子'; n.aff = 80; st.spouseId = n.id; st.flags.intimate = 1; return say(st, `你與${n.name}結為夫妻，雖不合禮數，卻都心甘情願。`, { mood: 22, fame: modern(st) ? 1 : -3 }, 'major'); } },
    { t: '維持朋友情誼', hint: '情誼 +5', fx: st => { const n = npc(st, c.id); n.aff = clamp(n.aff + 5, 0, 100); return say(st, `你和${n.name}依舊以朋友相稱。`, { mood: -2 }); } }
  ] });
  E('friendNeed', { title: '友人有難', text: (s, c) => `${npc(s, c.id).name}${pick(s, ['家裡遭了官司', '欠下一筆債', '遇到了難處'])}，上門來向你求助。`, choices: (s, c) => [
    { t: '傾囊相助', hint: '花費 15', req: st => st.money >= 15, fx: st => { const n = npc(st, c.id); n.aff = clamp(n.aff + 25, 0, 100); n.owes = true; return say(st, `你拿出積蓄幫了${n.name}，對方紅了眼眶。`, { money: -15, virtue: 5, mood: 3, fame: 2 }); } },
    { t: '幫忙出主意', hint: '情誼 +8', fx: st => { const n = npc(st, c.id); n.aff = clamp(n.aff + 8, 0, 100); return say(st, `你陪著${n.name}想了一夜的辦法。`, { virtue: 2 }); } },
    { t: '愛莫能助', hint: '情誼大減', fx: st => { const n = npc(st, c.id); n.aff = clamp(n.aff - 18, 0, 100); return say(st, `你婉拒了${n.name}，心裡也不好受。`, { mood: -3, virtue: -2 }); } }
  ] });
  E('rival', { title: '同行相忌', text: (s, c) => `同行${c.name}處處與你較勁，在外說了不少風涼話。`, choices: (s, c) => [
    { t: '正面較量', hint: '比本事', fx: st => { addNpc(st, { name: c.name, sex: c.sex, age: st.age + ri(st, -8, 8), rel: 'rival', label: '對手', aff: 10, status: 2 }); return say(st, `你與${c.name}成了對手，看誰笑到最後。`, { fame: 2, mood: -1 }); } },
    { t: '登門化解', hint: '可能多個朋友', fx: st => { addNpc(st, { name: c.name, sex: c.sex, age: st.age + ri(st, -8, 8), rel: 'friend', label: '友人', aff: 42, status: 2 }); return say(st, `你提了一壺酒登門，竟與${c.name}冰釋前嫌。`, { virtue: 3, mood: 3 }); } },
    { t: '不予理會', fx: st => say(st, '你只當耳旁風，專心做自己的事。', { mood: -1 }) }
  ] });
  E('rivalMove', { title: '對手出招', text: (s, c) => `${npc(s, c.id).name}暗中使了絆子，想搶你的生意與名聲。`, choices: (s, c) => [
    { t: '以牙還牙', hint: '有輸有贏', fx: st => { const n = npc(st, c.id); if (chance(st, .35 + st.traits.nerve / 180)) { n.alive = false; n.gone = true; n.rel = 'rival'; n.note = '敗走他鄉'; return say(st, `你反手一擊，${n.name}灰溜溜地離開了${st.city}。`, { fame: 5, mood: 6, virtue: -3 }, 'major'); } return say(st, '反擊沒成，還賠了些錢。', { money: -8, mood: -6 }); } },
    { t: '報官評理', hint: '花費 5', req: st => st.money >= 5, fx: st => say(st, '官府各打五十大板，事情總算壓了下來。', { money: -5, mood: -2, fame: 1 }) },
    { t: '隱忍', fx: st => say(st, '你忍了下來，把氣吞進肚子裡。', { mood: -5, virtue: 2, hp: -1 }) }
  ] });
  E('windfall', { title: '意外之財', text: '你在舊屋牆角翻出了一個沉甸甸的陶罐。', choices: () => [
    { t: '收起來', hint: '發一筆財', fx: s => say(s, '罐裡是前人藏的錢，你悄悄收好了。', { money: ri(s, 12, 40), mood: 8 }) },
    { t: '交給里正', hint: '德行與聲望', fx: s => say(s, '你把東西交了上去，鄉里傳為美談。', { virtue: 8, fame: 5, mood: 3 }) }
  ] });
  E('thief', { title: '失竊', text: '半夜有賊摸進了家門！', kind: 'bad', choices: () => [
    { t: '上前搏鬥', hint: '看武藝', fx: s => (chance(s, .3 + s.skills.wu / 120) ? say(s, '你一棍把賊打跑了。', { fame: 2, mood: 4 }) : (hurt(s, '遭盜賊重傷'), say(s, '賊人身手了得，你挨了一刀。', { hp: -ri(s, 8, 22), money: -Math.round(s.money * .2), mood: -8 }))) },
    { t: '裝睡保命', hint: '損失錢財', fx: s => say(s, '第二天，家裡少了不少東西。', { money: -Math.round(s.money * .25), mood: -6 }) }
  ] });
  E('corvee', { title: '徭役', text: s => `官府徵發${s.city}丁壯服役，${s.year >= 605 && s.year < 620 ? '聽說是要開河與東征，' : ''}已有人走了就沒回來。`, kind: 'bad', choices: () => [
    { t: '應役', hint: '健康受損', fx: s => { hurt(s, '死於徭役'); return say(s, '你服了一季苦役，回來時瘦得脫了相。', { hp: -ri(s, 6, 16), mood: -8, nong: 1 }); } },
    { t: '納錢代役', hint: '花費 12', req: s => s.money >= 12, fx: s => say(s, '花錢消災，總算免了這趟苦差。', { money: -12, mood: -1 }) },
    { t: '躲進山裡', hint: '可能被抓', fx: s => (chance(s, .55) ? say(s, '你在山裡躲了幾個月，總算躲過一劫。', { mood: -3, hp: -2 }) : (hurt(s, '逃役受刑而亡'), say(s, '你被抓了回來，打了一頓板子，又多罰了一倍。', { hp: -18, money: -6, mood: -12, fame: -2 }))) }
  ] });
  E('levy', { title: '抓丁入伍', text: '兵荒馬亂，軍爺到村裡點人頭，把青壯都趕到了場上。', kind: 'bad', choices: () => [
    { t: '從軍去', hint: '成為士卒', fx: s => { if (s.job) s.flags.oldJob = s.job.id; setJob(s, 'soldier', 0); return say(s, '你被編入行伍，領了一身破舊的戎裝。', { wu: 4, mood: -6 }, 'major'); } },
    { t: '賄賂放行', hint: '花費 18', req: s => s.money >= 18, fx: s => say(s, '你塞了銀錢，軍爺假裝沒看見你。', { money: -18, mood: -3 }) },
    { t: '連夜逃走', hint: '有風險', fx: s => (chance(s, .6) ? say(s, '你連夜翻牆逃走，躲過一劫。', { mood: -4, money: -3 }) : (hurt(s, '逃兵被殺'), say(s, '你被追上了，險些丟了性命。', { hp: -30, mood: -10 }))) }
  ] });
  E('drought', { title: s => (eraAt(s.year).turb > .4 ? '兵後大荒' : pick(s, ['大旱', '蝗災', '水患'])), text: '今年收成極差，米價翻了又翻，街上開始出現逃荒的人。', kind: 'bad', choices: () => [
    { t: '開倉濟鄰', hint: '花費 20，德行大增', req: s => s.money >= 20, fx: s => { s.world.stable = clamp(s.world.stable + 1, 0, 100); return say(s, '你把自家存糧分給了街坊，大家都記在心裡。', { money: -20, virtue: 10, fame: 8, mood: 2 }); } },
    { t: '節衣縮食', hint: '健康下降', fx: s => { hurt(s, '餓死於荒年'); return say(s, '全家喝了幾個月的稀粥，終於熬了過去。', { hp: -ri(s, 5, 14), mood: -6 }); } },
    { t: '囤糧待價', hint: '賺錢，但德行受損', fx: s => say(s, '你低買高賣賺了一筆，卻也聽到了背後的咒罵。', { money: ri(s, 15, 35), virtue: -10, fame: -2, shang: 2 }) }
  ] });
  E('localTrouble', { title: '鄉里之爭', text: s => `${s.city}有兩族為水源爭執不下，有人請你出面調解。`, choices: () => [
    { t: '秉公調解', hint: '看聲望與德行', fx: s => { if (chance(s, clamp(.35 + (s.fame + s.virtue) / 150, .2, .9))) { s.world.stable = clamp(s.world.stable + 2, 0, 100); return say(s, '兩族握手言和，你的話在鄉里很有份量。', { fame: 8, virtue: 4, mood: 4 }); } return say(s, '雙方都不服氣，反倒埋怨起你來。', { fame: -2, mood: -5 }); } },
    { t: '偏袒一方得好處', hint: '得錢，失德', fx: s => say(s, '收了好處，你替一邊說了話。', { money: 15, virtue: -8, fame: 1 }) },
    { t: '不蹚渾水', fx: s => say(s, '你推說有事，沒有去。', { mood: -1 }) }
  ] });
  E('promoteChance', { title: '機緣', text: s => `有位貴人注意到你在「${curJob(s)}」上的表現，要交一樁大差事給你。`, choices: () => [
    { t: '接下差事', hint: '成敗看本事', req: s => !!s.job, why: '你已不在其位', fx: s => { const j = JOBS[s.job.id]; const sk = s.skills[j.skill]; if (chance(s, clamp(.3 + sk / 130, .3, .92))) { s.job.xp += 55; const r = say(s, '你把事情辦得漂亮極了，貴人大為賞識。', { fame: 8, money: 12, mood: 8, [j.skill]: 3 }); tryPromote(s, r); return r; } return say(s, '差事搞砸了，還要你賠一些損失。', { money: -8, mood: -8, fame: -2 }); } },
    { t: '婉拒', hint: '求穩', fx: s => say(s, '你覺得還是腳踏實地的好。', { mood: 1 }) }
  ] });
  E('lostChild', { title: '路邊小事', text: '你在街上看見一個走失的孩子，哭得上氣不接下氣。', choices: () => [
    { t: '陪他找家人', hint: '德行', fx: s => say(s, '找了半日，孩子的父母千恩萬謝。', { virtue: 4, mood: 4, fame: 1 }) },
    { t: '趕路要緊', fx: s => say(s, '你看了一眼，還是走了。', { virtue: -1 }) }
  ] });
  E('beggar', { title: '街頭奇人', text: '一位衣衫襤褸的老人攔住了你，說你骨骼清奇，要傳你一門本事。', choices: () => [
    { t: '請教一二', hint: '隨機學得一技', fx: s => { const k = pick(s, Object.keys(s.skills)); return chance(s, .65) ? say(s, `老人竟真有兩下子，你學到了些${SKILLS[k]}的竅門。`, { [k]: ri(s, 3, 7), mood: 4, money: -1 }) : say(s, '說了半天，只是想騙你一頓飯。', { money: -2, mood: -2 }); } },
    { t: '給他一碗飯', hint: '德行', fx: s => say(s, '你給了他一碗飯，他咧嘴笑了。', { money: -1, virtue: 3, mood: 2 }) },
    { t: '揮手走開', fx: s => say(s, '你皺皺眉頭，快步離開了。', null) }
  ] });
  E('childQuestion', { title: '親子之間', text: (s, c) => `${npc(s, c.id).name}${pick(s, ['跟你頂了嘴', '想去遠方闖蕩', '說不想走你安排的路'])}。`, kind: 'family', choices: (s, c) => [
    { t: '好好談談', hint: '親情 +12', fx: st => { const k = npc(st, c.id); k.aff = clamp(k.aff + 12, 0, 100); return say(st, `你和${k.name}坐下來談，彼此都紅了眼眶。`, { mood: 4 }); } },
    { t: '嚴加管教', hint: '親情下降，學識增加', fx: st => { const k = npc(st, c.id); k.aff = clamp(k.aff - 10, 0, 100); k.edu = clamp((k.edu || 0) + 6, 0, 100); return say(st, `你狠狠訓了${k.name}一頓。`, { mood: -3 }); } }
  ] });
  E('exposed', { title: '身分被識破', text: '有人察覺了你的女兒身，當眾揭穿，四周一片譁然。', kind: 'bad', choices: () => [
    { t: '坦然承認', hint: '失去職位，名聲兩極', fx: s => { s.disguise = false; const old = curJob(s); s.job = null; s.flags.entered = false; return say(s, `你當眾承認了，${old}的差事沒了，但也有人佩服你的膽識。`, { fame: 12, mood: -10, virtue: 2 }, 'major'); } },
    { t: '買通對方', hint: '花費 30', req: s => s.money >= 30, fx: s => say(s, '你花錢堵住了那人的嘴，這一關暫時過了。', { money: -30, mood: -4 }) },
    { t: '遠走他鄉', hint: '放棄一切', fx: s => { s.job = null; s.disguise = false; s.flags.entered = false; return say(s, '你連夜離開，把過往的身分都留在了身後。', { money: -5, mood: -12 }, 'major'); } }
  ] });
  function ctxFor(s, id) {
    if (id === 'loveMatch') return { id: pick(s, friends(s).filter(f => f.sex !== s.sex && f.age >= minMarry(s) - 1)).id };
    if (id === 'friendNeed') return { id: pick(s, friends(s)).id };
    if (id === 'rival') { const sx = chance(s, .75) ? 'm' : 'f'; return { name: makeName(s, eraAt(s.year), sx), sex: sx }; }
    if (id === 'rivalMove') return { id: s.npcs.find(n => n.rel === 'rival' && n.alive).id };
    if (id === 'childQuestion') return { id: pick(s, children(s, true).filter(c => c.age >= 12)).id };
    return {};
  }

  // 史事事件
  const TIPS = {
    war: ['遠避戰火', '留守護鄉', '獻策於軍前'], fall: ['收拾細軟逃難', '守在鄉里', '力挽狂瀾'], revolt: ['閉門自保', '暗助百姓', '居中斡旋'],
    reform: ['順勢而為', '靜觀其變', '上書參與'], plague: ['閉戶自保', '施藥救人', '倡議防治'], culture: ['聽聽就好', '前往見證', '親身投入'], explore: ['聽聽就好', '資助遠行', '親身同行']
  };
  E('history', { kind: 'hist', front: true, title: (s, c) => HISTORY[c.h].title, text: (s, c) => `${yearLabel(s.year)}，${HISTORY[c.h].fact}`, choices: (s, c) => {
    const h = HISTORY[c.h], tips = TIPS[h.t];
    const danger = ['war', 'fall', 'revolt', 'plague'].includes(h.t);
    const adult = s.age >= 14;
    const p = histChance(s);
    return [
      { t: tips[0], hint: danger ? '最安全，但可能破財' : '不受影響', fx: st => {
        record(st, c.h, 0);
        if (!danger) return say(st, `你${tips[0]}，這件事成了日後與人閒談的話題。`, { mood: 1 }, 'hist');
        return say(st, `「${h.title}」來時，你${tips[0]}，保住了性命。`, { money: -Math.round(Math.max(0, st.money) * .22), mood: -8, hp: -2 }, 'hist');
      } },
      { t: tips[1], hint: danger ? '德行與風險並存' : '增長見識', req: () => adult, why: '年紀太小', fx: st => {
        record(st, c.h, 1);
        st.world.stable = clamp(st.world.stable + 1, 0, 100);
        if (danger && chance(st, .24)) { hurt(st, `死於${h.title}`); return say(st, `「${h.title}」之際，你${tips[1]}，卻險些把命搭上。`, { hp: -ri(st, 15, 42), virtue: 8, fame: 6, mood: -8 }, 'hist'); }
        return say(st, `「${h.title}」之際，你${tips[1]}，被鄉里記了下來。`, danger ? { virtue: 8, fame: 8, mood: 2 } : { fame: 5, mood: 5, wen: 2 }, 'hist');
      } },
      { t: tips[2], hint: `影響歷史的機會約 ${Math.round(p * 100)}%`, req: () => adult, why: '年紀太小', fx: st => {
        const roll = rnd(st);
        if (roll < p) {
          record(st, c.h, 3);
          addDiv(st, { title: h.title, tier: 3, y: st.year, fact: h.fact, alt: h.alt });
          shift(st, h.t, 8);
          return say(st, `你竟然真的改變了「${h.title}」的走向。${h.alt}`, { fame: 35, virtue: 10, mood: 18 }, 'major');
        }
        if (roll < p + .32) {
          record(st, c.h, 2);
          addDiv(st, { title: h.title, tier: 2, y: st.year, fact: h.fact, alt: `大勢未變，但你救下了${st.city}的一些人，地方志留下了你的名字。` });
          shift(st, h.t, 3);
          return say(st, `你改變不了「${h.title}」的大局，但${st.city}有許多人因你活了下來。`, { fame: 16, virtue: 6, mood: 6 }, 'hist');
        }
        record(st, c.h, 1);
        if (danger && chance(st, .3)) { hurt(st, `死於${h.title}`); return say(st, `你想力挽狂瀾，卻被捲入「${h.title}」的漩渦。`, { hp: -ri(st, 22, 60), fame: 4, mood: -12 }, 'hist'); }
        return say(st, `你人微言輕，「${h.title}」依舊如史書所載般發生。`, { fame: 3, mood: -5 }, 'hist');
      } }
    ];
  } });
  function histChance(s) { return clamp((power_(s) - 30) / 170, .01, .4); }
  function record(s, idx, tier) { s.hist.push({ idx, title: HISTORY[idx].title, y: s.year, age: s.age, tier }); }
  function shift(s, t, n) {
    const w = s.world;
    if (['war', 'fall', 'revolt', 'plague'].includes(t)) w.stable = clamp(w.stable + n, 0, 100);
    else if (t === 'reform') { w.rich = clamp(w.rich + n, 0, 100); w.learn = clamp(w.learn + n / 2, 0, 100); }
    else { w.learn = clamp(w.learn + n, 0, 100); w.rich = clamp(w.rich + n / 2, 0, 100); }
  }

  // 改朝換代
  E('eraChange', { kind: 'hist', front: true, title: (s, c) => `天下易幟：${c.name}`, text: (s, c) => (c.name === AFTER_ERA.name ? `時間來到${yearLabel(s.year)}，舊時代已經過去，你的人生卻還要繼續。` : `舊朝的名字不再被人提起。從今往後，人們稱這個時代為「${c.name}」。`), choices: () => [
    { t: '繼續過日子', fx: s => say(s, `你看著改朝換代，日子還得過下去。`, { mood: -2 }) },
    { t: '趁勢而起', hint: '聲望與風險', fx: s => { if (chance(s, .5)) return say(s, '新朝用人之際，你抓住了機會。', { fame: 8, mood: 6, money: 8 }, 'major'); hurt(s, '亂世喪命'); return say(s, '風頭太盛，反倒惹來了麻煩。', { hp: -10, money: -10, mood: -6 }); } }
  ] });

  // 死訊
  E('npcDeath', { title: (s, c) => c.title, text: (s, c) => c.text, kind: 'bad', choices: (s, c) => [
    { t: c.ok || '節哀順變', fx: st => say(st, c.log, c.eff, 'major') }
  ] });

  /* ---------- 年度結算 ---------- */
  function endYear(s) {
    if (!s.alive || s.pending.length) return false;
    s.year++; s.age++;
    syncAp(s);
    const era = eraAt(s.year), prev = eraAt(s.year - 1);
    if (era.id !== prev.id && era.name !== prev.name) { s.regime = ''; pushEvent(s, 'eraChange', { name: era.name }); s.world.stable = clamp(s.world.stable - 6, 0, 100); }

    // 世局緩慢回歸基準（朝代動盪越高，安定越低）
    const target = clamp(80 - era.turb * 70, 12, 85);
    s.world.stable += (target - s.world.stable) * .12;
    s.world.rich += (clamp(70 - era.turb * 45, 20, 80) - s.world.rich) * .05;

    economy(s);
    bodyYear(s);
    npcYear(s);
    familyYear(s);
    careerYear(s);
    projectYear(s);
    milestones(s);
    worldNews(s);
    rollEvents(s);
    afterChange(s);
    if (s.alive) lastCheck(s);
    return true;
  }
  function economy(s) {
    const adult = s.age >= 15;
    if (adult) {
      const n = 1 + (spouse(s) ? 1 : 0) + children(s, true).filter(c => c.age < 15).length * .5;
      const cost = Math.round(4 * n);
      s.money -= cost;
      if (s.job) { const j = JOBS[s.job.id]; s.money += Math.round(j.pay[s.job.rank] * .55 * (.75 + s.world.rich / 200)); }
      const sp = spouse(s);
      if (sp && sp.job && sp.job !== 'home') s.money += 3 + sp.status;
      if (s.money < 0) {
        const lacking = -s.money;
        s.mood = clamp(s.mood - 3 - lacking / 10, 0, 100);
        s.hp = clamp(s.hp - Math.min(8, 1 + lacking / 12), 0, 100);
        if (s.money < -40) { s.money = -40; hurt(s, '貧病交加'); }
      }
    } else if (s.money < 0) {
      s.money = 0; // 孩子的花費由家裡擔著，不算你的債
    }
  }
  function bodyYear(s) {
    const a = s.age;
    const aging = a < 28 ? 0 : a < 40 ? .8 : a < 52 ? 2.4 : a < 62 ? 4 : a < 72 ? 5.6 : 8;
    const regen = 3.6 + (s.con - 55) / 22 + (s.mood - 50) / 40 + (s.money > 40 ? 1 : s.money < 0 ? -1.5 : 0);
    s.hp = clamp(s.hp + regen - aging, 0, maxHp(s));
    s.mood = clamp(s.mood + (58 - s.mood) * .12, 0, 100);
    s.ills.forEach(i => {
      if (i.chronic) s.hp = clamp(s.hp - i.chronic * .7, 0, 100);
      else { i.years = (i.years || 0) + 1; s.hp = clamp(s.hp - i.sev * .22, 0, 100); }
    });
    // 急症多半自己會過去，只有拖著不治才持續傷身
    s.ills = s.ills.filter(i => i.chronic || !chance(s, clamp(.3 + s.con / 200, .3, .7)));
    if (s.hp <= 0) hurt(s, s.ills.length ? s.ills[0].n + '不治' : s.age >= 60 ? '壽終正寢' : '積勞而終');
    // 得病
    const p = (a < 5 ? .05 : a < 15 ? .04 : a < 40 ? .06 : a < 60 ? .1 : .17) + (s.money < 0 ? .05 : 0) + (100 - s.world.stable) / 900;
    if (chance(s, p) && s.ills.length < 2) {
      const pool = DISEASES.filter(d => (d.ageMin == null || a >= d.ageMin) && (d.ageMax == null || a <= d.ageMax) && (d.min == null || s.year >= d.min) && !s.ills.some(x => x.id === d.id));
      if (pool.length) {
        const d = weighted(s, pool, x => x.w);
        const childSoft = a < 8 ? .5 : 1;
        s.ills.push({ id: d.id, n: d.n, sev: d.sev * childSoft, chronic: d.chronic || 0 });
        say(s, `你染上了${d.n}。`, { hp: -Math.round(d.sev * .35 * childSoft) }, 'ill');
        if (a >= 7) pushEvent(s, 'illness', { illId: d.id });
        else if (chance(s, .7)) { s.ills.pop(); say(s, '爹娘守在床邊，你終於退了燒。', null, 'ill'); }
      }
    }
    // 幼兒夭折維持少見，避免玩家還沒開始就結束
    if (a < 7 && chance(s, .006)) { hurt(s, '幼年夭折'); s.hp = 0; }
  }
  // 配偶等 NPC 的年度死亡率
  function mortality(age) { return age < 5 ? .06 : age < 15 ? .012 : age < 40 ? .012 : age < 55 ? .025 : age < 65 ? .05 : age < 75 ? .11 : age < 85 ? .22 : .4; }
  function npcYear(s) {
    s.npcs.forEach(n => {
      if (!n.alive) return;
      n.age++;
      let dead = false;
      if (n.deathYear != null) dead = s.year >= n.deathYear;
      else {
        const m = mortality(n.age) * (1 + (100 - s.world.stable) / 180) * (n.rel === 'child' && n.age < 15 ? childRisk(s) : 1);
        dead = chance(s, m);
      }
      if (dead) npcDies(s, n);
      else if (n.rel === 'spouse' && chance(s, .15)) n.aff = clamp(n.aff + (s.mood > 60 ? 2 : -3), 0, 100);
    });
    if (s.mentorId && (!npc(s, s.mentorId) || !npc(s, s.mentorId).alive)) s.mentorId = null;
  }
  function childRisk(s) { return s.year >= 1912 ? .75 : (s.breakthroughs.includes('variol') || s.year >= 1600) ? .9 : 1.25; }
  function npcDies(s, n) {
    n.alive = false; n.deathY = s.year;
    const t = {
      parent: [`${n.label}辭世`, `${n.label}${n.name}走了，你守在床前直到最後一刻。`, `${n.label}${n.name}去世，享年 ${n.age}。`, { mood: -16 }],
      spouse: ['喪偶之痛', `${n.name}撒手人寰，留下你一個人。`, `${n.label}${n.name}去世，享年 ${n.age}。`, { mood: -24 }],
      child: ['白髮人送黑髮人', `你的孩子${n.name}${n.age < 15 ? '沒能熬過這一年' : '先你而去'}。`, `${n.label}${n.name}夭折，年僅 ${n.age}。`, { mood: -26 }],
      sibling: ['手足亡故', `${n.label}${n.name}過世了。`, `${n.label}${n.name}去世。`, { mood: -8 }],
      mentor: ['恩師辭世', `師父${n.name}走了，你替老人家送了終。`, `師父${n.name}去世。`, { mood: -8, virtue: 2 }],
      friend: ['故人已逝', `老友${n.name}走了，往後少了一個能說話的人。`, `友人${n.name}去世。`, { mood: -6 }],
      figure: ['名士凋零', `你曾拜會的${n.name}離世了，天下為之嘆息。`, `${n.name}去世。`, { mood: -3 }],
      rival: ['宿敵亡故', `${n.name}死了。鬥了半生，你反倒有些悵然。`, `宿敵${n.name}去世。`, { mood: -1 }]
    }[n.rel];
    if (!t) return;
    if (n.rel === 'spouse') { s.spouseId = null; n.rel = 'late'; n.label = n.sex === 'm' ? '亡夫' : '亡妻'; }
    if (s.age < 6 && n.rel === 'sibling') { s.log.push({ y: s.year, age: s.age, t: t[2], k: 'life' }); return; }
    if (['parent', 'late', 'child', 'mentor'].includes(n.rel) || (n.rel === 'friend' && n.aff > 55)) pushEvent(s, 'npcDeath', { title: t[0], text: t[1], log: t[2], eff: t[3] });
    else { say(s, t[2], t[3]); }
  }
  function familyYear(s) {
    const sp = spouse(s);
    if (sp) {
      const fem = s.sex === 'f' ? s.age : sp.age;
      if (fem >= 15 && fem <= 45) {
        const kids = children(s, true).length;
        const base = (s.flags.intimate ? .42 : .22) * (1 - kids * .1) * (fem > 38 ? .5 : 1);
        if (chance(s, clamp(base, .03, .5))) birth(s);
      }
      if (s.flags.intimate) s.flags.intimate--;
    }
    children(s, true).forEach(k => {
      if (k.age === 6 && !k.schoolDone) { k.schoolDone = true; pushEvent(s, 'childSchool', { id: k.id }); }
      if (k.age === 17 && !k.futureDone) { k.futureDone = true; pushEvent(s, 'childFuture', { id: k.id }); }
      if (k.age === 20 && !k.wed && chance(s, .85)) { k.wed = true; say(s, `${k.name}成家了，你喝了一杯喜酒。`, { mood: 8, money: -4 }, 'major'); }
      if (k.age > 22 && k.job && chance(s, .12)) s.money += 2 + (k.edu || 0) / 20;
    });
  }
  function birth(s) {
    const sex = chance(s, .5) ? 'm' : 'f';
    const pool = NAMES[eraAt(s.year).names][sex];
    const names = [pick(s, pool), pick(s, pool), pick(s, pool)].filter((x, i, a) => a.indexOf(x) === i);
    const risk = (s.year >= 1912 ? .012 : .035) * (1 - s.skills.yi / 200) * (s.money > 40 ? .7 : 1);
    if (s.sex === 'f') {
      s.hp = clamp(s.hp - ri(s, 5, 14), 0, 100);
      if (chance(s, risk)) { hurt(s, '難產'); s.hp = 0; say(s, '一場難產奪走了你的力氣。', null, 'major'); return; }
    } else if (spouse(s) && chance(s, risk)) {
      pushEvent(s, 'childBirth', { sex, names });
      const sp = spouse(s);
      npcDies(s, sp);
      return;
    }
    pushEvent(s, 'childBirth', { sex, names });
  }
  function careerYear(s) {
    if (!s.job) return;
    s.job.xp += 6;
    if (s.disguise && s.sex === 'f' && !femaleOpen(s) && chance(s, .06)) pushEvent(s, 'exposed', {});
    if (s.age >= 66 && s.job.rank <= 3 && chance(s, .4) && !s.flags.retired) {
      s.flags.retired = true;
      say(s, `你辭去了${curJob(s)}的職事，含飴弄孫。`, { mood: 10, fame: 2 }, 'major');
      s.jobHist.push({ id: s.job.id, rank: s.job.rank, name: curJob(s) });
      s.job = null;
    }
  }
  function projectYear(s) {
    s.projects.filter(p => !p.done).forEach(p => {
      p.left--;
      if (p.left <= 0) {
        p.done = true;
        const d = PROJECTS.find(x => x.id === p.id);
        for (const k in d.effect) s.world[k] = clamp(s.world[k] + d.effect[k], 0, 100);
        addDiv(s, { title: d.n, tier: 1, y: s.year, fact: `${s.city}舊無此舉。`, alt: `「${d.n}」落成：${d.line}` });
        say(s, `「${d.n}」落成了。${d.line}`, { fame: d.fame, virtue: 8, mood: 12 }, 'major');
      }
    });
  }
  function milestones(s) {
    if (s.age === 7) pushEvent(s, 'enlighten', {});
    if (s.age === 15) pushEvent(s, 'comingOfAge', {});
    if (s.age === 40 && !s.flags.m40) { s.flags.m40 = true; say(s, '不惑之年，你開始回望走過的路。', null); }
    if (s.age === 60 && !s.flags.m60) { s.flags.m60 = true; say(s, children(s, true).length ? '六十大壽，兒孫繞膝。' : '六十大壽，你請街坊喝了杯酒。', { mood: 8 }, 'major'); }
    if (s.age === 8 && !s.flags.helper && !s.job) { s.flags.helper = true; }
  }
  function worldNews(s) {
    const era = eraAt(s.year);
    const list = ['街坊無事，日子如常。', `${s.city}的市集今年熱鬧了些。`, '有外地人帶來了遠方的消息。', '今年的節慶辦得比往年氣派。'];
    if (s.world.stable < 30) list.push('路上流民變多，夜裡少有人敢出門。', '城外不時傳來兵馬的消息。');
    if (s.world.rich > 65) list.push('商旅不絕，米價平穩。');
    if (s.world.learn > 65) list.push('讀書人多了起來，連坊間都在談論新書。');
    if (era.turb > .5) list.push('到處都是逃難的人，官府也管不過來。');
    s.news = pick(s, list);
  }
  function rollEvents(s) {
    const idx = HISTORY.findIndex(h => h.y === s.year);
    const reach = idx >= 0 && s.age >= 6;
    if (idx >= 0 && !reach) {
      s.seen.push(idx);
      s.log.push({ y: s.year, age: s.age, t: `這一年發生了「${HISTORY[idx].title}」，你還太小，只記得大人們驚慌的神色。`, k: 'hist' });
    }
    if (reach) { s.seen.push(idx); pushEvent(s, 'history', { h: idx }); }
    if (s.age < 8) return;
    const already = s.pending.length;
    if (already < 2 && chance(s, .62)) {
      const pool = LIFE.filter(l => l.cond(s));
      if (pool.length) {
        const pickE = weighted(s, pool, l => l.w);
        if (pickE.push) pickE.push(s);
        else pushEvent(s, pickE.id, ctxFor(s, pickE.id));
      }
    }
    if (eraAt(s.year).turb > .5 && s.world.stable < 28 && chance(s, .12) && s.age >= 8) warRaid(s);
  }
  function warRaid(s) {
    if (s.job && s.job.id === 'soldier') { hurt(s, '戰死沙場'); say(s, '大軍遇襲，你拚死殺出了重圍。', { hp: -ri(s, 10, 35), fame: 4, wu: 2 }, 'major'); return; }
    hurt(s, '死於兵燹');
    say(s, '兵禍突至，城中火光四起，你拉著家人倉皇逃走。', { hp: -ri(s, 4, 18), money: -Math.round(Math.max(0, s.money) * .3), mood: -12 }, 'major');
  }
  function lastCheck(s) {
    // 高齡後的自然終點：越老越可能壽終
    if (s.age >= 50) {
      const p = (Math.pow((s.age - 42) / 50, 2.4) * (1.4 - s.con / 130) + (s.hp < 20 ? .12 : 0)) * (.85 + eraAt(s.year).turb * .5);
      if (chance(s, p)) die(s, s.ills.some(i => i.sev >= 20) && chance(s, .6) ? s.ills.find(i => i.sev >= 20).n + '不治' : '壽終正寢');
    }
    if (s.alive && s.age >= 112) die(s, '壽終正寢');
  }
  function die(s, cause) {
    if (!s.alive) return;
    s.alive = false;
    s.death = { cause, age: s.age, year: s.year };
    s.pending = [];
    s.log.push({ y: s.year, age: s.age, t: `${yearLabel(s.year)}，你走完了這一生。死因：${cause}。`, k: 'major' });
    s.biography = biography(s);
  }

  /* ---------- 傳記 ---------- */
  function jobTitle(s) {
    const all = s.jobHist.slice();
    if (s.job) all.push({ id: s.job.id, rank: s.job.rank, name: curJob(s) });
    return all.sort((a, b) => b.rank - a.rank)[0] || null;
  }
  function legacyRank(s) {
    const t3 = s.div.filter(d => d.tier === 3).length, t2 = s.div.filter(d => d.tier === 2).length, t1 = s.div.filter(d => d.tier === 1).length;
    if (t3 >= 2) return { n: '扭轉乾坤', d: '你的名字，足以令史家另開一卷。', v: 5 };
    if (t3 === 1) return { n: '青史留名', d: '正史因你多了一段不同的記載。', v: 4 };
    if (t2 >= 1 || s.fame > 120) return { n: '名動一方', d: '地方志與筆記裡，都有你的身影。', v: 3 };
    if (t1 >= 1 || s.fame > 45 || s.works.length) return { n: '鄉里傳誦', d: '老人們還會跟孫輩講起你的事。', v: 2 };
    if (s.virtue > 20 || children(s).length) return { n: '善終百姓', d: '史書沒有記下你，但有人記得。', v: 1 };
    return { n: '浮生一夢', d: '你來過，又走了，像河面上的一片葉子。', v: 0 };
  }
  function biography(s) {
    const era = eraAt(s.birthYear), deathEra = eraAt(s.year);
    const top = jobTitle(s);
    const ch = children(s);
    const sp = s.npcs.filter(n => ['spouse', 'late', 'ex'].includes(n.rel));
    const lg = legacyRank(s);
    const title = s.works.length ? '著述之士' : top ? top.name : (s.age < 15 ? '童稚' : '布衣');
    const p = [];
    p.push(`${s.name}，${s.sex === 'm' ? '男' : '女'}，${era.name}${s.birthCity}人，生於${yearLabel(s.birthYear)}（${ganzhi(s.birthYear)}年），出身${s.famName}。性情${s.traits.label}。`);
    if (s.age < 15) {
      p.push(`可惜天不假年，${s.age} 歲便離開了人世。短短的日子裡，${parents(s).length ? '父母視若珍寶' : '身邊的人都記得這個孩子'}。`);
    } else {
      const skillsTop = Object.keys(s.skills).sort((a, b) => s.skills[b] - s.skills[a])[0];
      p.push(`少年時${s.schooled ? '入學讀書' : '未入學堂，靠家中長輩帶著長大'}，尤長於${SKILLS[skillsTop]}。${s.npcs.some(n => n.rel === 'mentor') ? `曾拜${s.npcs.find(n => n.rel === 'mentor').name}為師。` : ''}`);
      if (top) {
        const hist = s.jobHist.map(j => j.name).filter((x, i, a) => a.indexOf(x) === i).slice(-3);
        p.push(`一生以${JOBS[top.id] ? jobName(s, top.id, top.rank) : top.name}為業${hist.length > 1 ? `，曾任${hist.join('、')}` : ''}${s.exam >= 3 ? '，並中進士' : s.exam ? `，曾有${['秀才', '舉人'][s.exam - 1]}功名` : ''}。${s.disguise ? '這一生多半以男裝示人，鮮有人知其真實身分。' : ''}`);
      } else p.push('終生未曾謀得正式職事，靠著零工與親友度日。');
      if (sp.length) {
        const names = sp.map(x => x.name).join('、');
        p.push(`婚配${names}。${ch.length ? `育有子女 ${ch.length} 人：${ch.map(k => k.name + (k.alive ? (k.jobName ? `（${k.jobName}）` : '') : `（${k.age < 18 ? '早夭' : '先你而去'}，${k.age} 歲）`)).join('、')}。` : '膝下無子女。'}`);
      } else p.push('終身未婚，朋友便是家人。');
      if (s.met.length) p.push(`平生曾與${s.met.slice(0, 4).join('、')}有過一面之緣。`);
      if (s.works.length) p.push(`著有${s.works.map(w => w.n).join('、')}，流傳於世。`);
      const done = s.projects.filter(x => x.done);
      if (done.length) p.push(`曾於${s.city}${done.map(x => x.n).join('、')}，至今仍有人受其恩惠。`);
    }
    if (s.hist.length) {
      const list = s.hist.map(h => `${h.title}（${h.age} 歲）`).slice(0, 6).join('、');
      p.push(`親歷${list}。`);
    }
    const major = s.div.filter(d => d.tier >= 2);
    if (major.length) p.push(`此生最不凡之處，是曾左右史事：${major.map(d => d.alt).join('')}`);
    p.push(`${yearLabel(s.year)}（${deathEra.name}），${s.death.cause === '壽終正寢' ? '壽終正寢' : '因' + s.death.cause + '辭世'}，享年 ${s.age} 歲。`);
    const epitaph = s.virtue > 30 ? '生而為善，死亦有光。' : s.fame > 100 ? '聲名身後，自有人說。' : s.age < 15 ? '來時匆匆，去也匆匆。' : s.mood > 60 ? '此生無憾，一笑而歸。' : '風雨一生，於此長眠。';
    const timeline = s.log.filter(l => l.k === 'major' || l.k === 'hist').map(l => ({ y: l.y, age: l.age, t: l.t, k: l.k }));
    return { title, legacy: lg, paragraphs: p, epitaph, timeline, div: s.div, stats: { fame: Math.round(s.fame), virtue: Math.round(s.virtue), money: Math.round(s.money), children: ch.length, friends: s.npcs.filter(n => n.rel === 'friend').length, skills: s.skills } };
  }
  function bioText(s) {
    const b = s.biography;
    const lines = [`《${s.name}傳》——浮生千年`, `評定：${b.legacy.n}　${b.title}`, '', ...b.paragraphs, '', `墓誌：${b.epitaph}`, ''];
    if (b.div.length) { lines.push('【歷史偏移】'); b.div.forEach(d => lines.push(`・${d.title}（${yearLabel(d.y)}）：${d.alt}`)); lines.push(''); }
    lines.push('【生平年表】');
    b.timeline.forEach(t => lines.push(`${yearLabel(t.y)}（${t.age} 歲）${t.t}`));
    lines.push('', '註：人物與個人遭遇為遊戲虛構；標示之歷史事件取材自史實，偏移內容屬假想。');
    return lines.join('\n');
  }

  const api = { drawFate, newLife, resolve, top, endYear, doAction, actionList, eraAt, ganzhi, zodiac, yearLabel, dateLabel, curJob, spouse, children, parents, friends, npc, histChance, examSystem, coin, maxHp, bioText, legacyRank, jobName, EVENTS, ACTIONS, STATUS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FS_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis);
