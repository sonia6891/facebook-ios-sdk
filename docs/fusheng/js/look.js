/* 浮生千年：美術對應。圖都來自《浮生千年》Unity 專案已完成的資產（assets/），這裡只決定「誰、在哪、用哪張圖」。 */
(function (root) {
  'use strict';
  const B = 'assets/';
  // Unity 專案目前畫好兩套時代：前秦（漢晉服制）與唐。隋以前用前秦組，隋以後用唐組，其餘時代暫借最接近的一組。
  const setOf = year => (year < 581 ? 'fq' : 'tang');
  const CANVAS = {
    fq: ['former_qin_changan', 'former_zhao_pingyang', 'later_zhao_xiangguo', 'cheng_han_chengdu', 'former_yan_longcheng', 'later_qin_changan', 'later_yan_zhongshan', 'western_qin_yuanchuan', 'northern_liang_zhangye', 'western_liang_dunhuang', 'southern_liang_ledu', 'former_liang_guzang', 'later_liang_guzang'],
    tang: ['tang_changan_wardwell', 'tang_luoyang_canalward', 'tang_yangzhou_canalquay', 'tang_changan_wardwell', 'tang_luoyang_canalward']
  };
  const hash = str => [...String(str)].reduce((t, c) => (t * 31 + c.charCodeAt(0)) >>> 0, 7);

  function stage(age) { return age < 3 ? 'infant' : age < 10 ? 'child' : age < 16 ? 'teen' : age < 36 ? 'youth' : age < 56 ? 'mid' : 'old'; }
  const STAGES = [['infant', '嬰幼', 0], ['child', '童年', 3], ['teen', '少年', 10], ['youth', '青年', 16], ['mid', '中年', 36], ['old', '老年', 56]];
  const CLS = ['poor', 'poor', 'middle', 'gentry', 'gentry'];
  function clsOf(s) {
    const fam = root.FS_DATA.FAMILIES.find(f => f.id === s.familyId);
    let r = fam ? fam.rank : 1;
    if (s.age >= 16) {
      if ((s.job && s.job.rank >= 2) || s.money > 260) r = Math.max(r, 3);
      else if ((s.job && s.job.rank >= 1) || s.money > 70) r = Math.max(r, 2);
      if (s.money <= 0 && !(s.job && s.job.rank >= 2)) r = Math.min(r, 1);
    }
    return CLS[Math.max(0, Math.min(4, r))];
  }
  const sprite = (set, cls, sex, age, head) => `${B}char/${set}/${cls}_${sex}_${stage(age)}${head ? '_h' : ''}.webp`;
  function player(s, head) { return sprite(setOf(s.year), clsOf(s), s.sex, s.age, head); }
  function npc(s, n, head) {
    const st = typeof n.status === 'number' ? n.status : 1;
    return sprite(setOf(s.year), CLS[Math.max(0, Math.min(4, st))], n.sex === 'f' ? 'f' : 'm', n.age, head);
  }
  const EV = ['bandit', 'child', 'creditor', 'elder', 'healer', 'merchant', 'monk', 'official', 'oldwoman', 'soldier'];
  const evActor = (s, who) => (EV.includes(who) ? `${B}char/${setOf(s.year)}/ev_${who}.webp` : '');

  // 地點：街景（城郊）用整幅城鎮畫布，其他地點用 Unity 的地點底圖
  const PLACES = [
    { id: 'town', n: '街坊', tag: null },
    { id: 'home', n: '家宅', tag: [26, 72], g: ['family', 'health'] },
    { id: 'school', n: '學堂', tag: [36, 45], g: ['study'] },
    { id: 'market', n: '市集', tag: [58, 60], g: ['work', 'social'] },
    { id: 'workshop', n: '工坊', tag: [72, 45], g: ['study', 'work'] },
    { id: 'street', n: '官署', tag: [48, 31], g: ['world', 'work'] },
    { id: 'lane', n: '里巷', tag: [27, 57], g: ['social', 'family'] },
    { id: 'study', n: '書齋', tag: [62, 24], g: ['world', 'study'] },
    { id: 'clinic', n: '藥鋪', tag: [74, 68], g: ['health'] }
  ];
  function scene(s, loc) {
    const set = setOf(s.year), cls = clsOf(s);
    const war = s.world && s.world.stable < 34;
    switch (loc) {
      case 'home': return `${B}scene/${set}_home_${cls}.webp`;
      case 'school': return `${B}scene/${set}_${(s.job && ['clerk', 'teacher'].includes(s.job.id) && s.job.rank >= 1) || s.skills.wen >= 60 ? (set === 'fq' ? 'school_taixue' : 'guozijian') : 'school_village'}.webp`;
      case 'market': return `${B}scene/${set}_market.webp`;
      case 'workshop': return `${B}scene/${set}_${s.job && s.job.id === 'weave' ? 'loom' : 'workshop'}.webp`;
      case 'street': return `${B}scene/${set}_street_gentry.webp`;
      case 'lane': return `${B}scene/${set}_lane_poor.webp`;
      case 'study': case 'clinic': return `${B}scene/${set}_study_gentry.webp`;
      default: {
        if (set === 'tang' && ((s.job && s.job.id === 'soldier') || war)) return `${B}canvas/tang_frontier_forttown.webp`;
        const list = CANVAS[set];
        return `${B}canvas/${list[hash(s.city) % list.length]}.webp`;
      }
    }
  }
  function ending(life) {
    const c = life.death ? life.death.cause : '';
    const b = life.biography || {};
    const kids = (life.npcs || []).filter(n => n.rel === 'child').length;
    let k = 'peace';
    if (life.age < 6) k = 'infant';
    else if (/難產/.test(c)) k = 'childbed';
    else if (/時局|亂世|被殺|受刑|戰|兵/.test(c)) k = 'violent';
    else if (/意外|溺|墜|火/.test(c)) k = 'accident';
    else if (life.age < 40) k = 'sudden';
    else if (b.legacy && /青史|乾坤/.test(b.legacy.n)) k = 'glory';
    else if (kids >= 3) k = 'family';
    else if (!kids && !(life.npcs || []).some(n => n.rel === 'spouse' || n.rel === 'late')) k = 'lonely';
    return `${B}end/end_${k}.webp`;
  }
  root.FS_LOOK = { setOf, stage, STAGES, clsOf, player, npc, sprite, evActor, PLACES, scene, ending };
})(typeof window !== 'undefined' ? window : globalThis);
