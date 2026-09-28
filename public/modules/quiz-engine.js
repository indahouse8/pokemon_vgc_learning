/**
 * quiz-engine.js — Core question generation and answer-checking utilities
 */
const QuizEngine = (() => {

  // ── Stat formula (Pokémon Champions, all IVs fixed, Lv.50) ──────────────
  // HP:     base + 75 + sp
  // Others: floor((base + 20) × nat_mod) + sp
  //   nat_mod = 1.1 (boosted), 0.9 (reduced), 1.0 (neutral)
  function calcStat(base, stat, sp = 0, nature = null) {
    if (stat === 'hp') {
      return base + 75 + sp;
    }
    const natMod = nature
      ? (nature.boost === stat ? 1.1 : nature.reduce === stat ? 0.9 : 1.0)
      : 1.0;
    return Math.floor((base + 20) * natMod) + sp;
  }

  // ── Random helpers ────────────────────────────────────────────────────────
  function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr, n = 1) {
    const s = shuffle(arr);
    return n === 1 ? s[0] : s.slice(0, n);
  }

  function makeRangeLabel(val) {
    const lo = Math.floor(val / 20) * 20;
    return `${lo} – ${lo + 19}`;
  }

  // ── Stat name labels ──────────────────────────────────────────────────────
  const STAT_LABELS = {
    hp: 'HP',
    attack: 'ATTACK',
    defense: 'DEFENSE',
    sp_attack: 'SP. ATK',
    sp_defense: 'SP. DEF',
    speed: 'SPEED',
  };

  // ── Format ability name ───────────────────────────────────────────────────
  function fmtAbility(name) {
    return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Normalize text for answer comparison ─────────────────────────────────
  function normalize(str) {
    return str.toLowerCase().trim()
      .replace(/[^a-z0-9\s\-]/g, '')
      .replace(/\s+/g, ' ');
  }

  function checkText(input, correct) {
    const a = normalize(input);
    const b = normalize(String(correct));
    return a === b;
  }

  return {
    calcStat, rnd, shuffle, pick,
    makeRangeLabel,
    STAT_LABELS, fmtAbility,
    normalize, checkText,
    STATS: ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'],
  };
})();
