/**
 * stats-quiz.js — Base stat / In-game stat flashcard module
 *
 * Supports two modes via opts.useInGame:
 *   1. Base Stat mode (default): asks for raw base stat (e.g. 81)
 *   2. In-Game Stat mode: asks for final battle value (e.g. (base + 20) * nat + sp)
 *
 * Difficulty:
 *   easy   — 4 options, ranges of 20
 *   medium — 4 options, values spread ±30
 *   hard   — 4 options, values spread ±10
 *   expert — free text input
 */
const StatsQuiz = (() => {
  const { calcStat, makeRangeLabel, STAT_LABELS, STATS, shuffle, pick, rnd, checkText } = QuizEngine;

  function buildWrongOptions(correct, diff, allPokemon, stat, useInGame, sp, nature) {
    const getVal = (p) => useInGame ? calcStat(p.stats[stat], stat, sp, nature) : p.stats[stat];
    const allVals = allPokemon.map(getVal).filter(v => v !== correct);

    let candidates;
    if (diff === 'easy') {
      const bucket = Math.floor(correct / 20);
      candidates = allVals.filter(v => Math.floor(v / 20) !== bucket);
    } else if (diff === 'medium') {
      candidates = allVals.filter(v => Math.abs(v - correct) >= 15 && Math.abs(v - correct) <= 40);
    } else { // hard
      candidates = allVals.filter(v => Math.abs(v - correct) >= 5 && Math.abs(v - correct) <= 18);
    }

    if (candidates.length < 3) candidates = allVals;

    const wrongs = [];
    for (const v of shuffle([...new Set(candidates)])) {
      if (!wrongs.includes(v) && v !== correct) {
        wrongs.push(v);
        if (wrongs.length === 3) break;
      }
    }

    while (wrongs.length < 3) {
      const delta = rnd(5, 25) * (Math.random() < 0.5 ? -1 : 1);
      const v = Math.max(1, correct + delta);
      if (!wrongs.includes(v) && v !== correct) wrongs.push(v);
    }
    return wrongs.slice(0, 3);
  }

  function generateQuestion(pokemon, allPokemon, diff, opts = {}) {
    const p = pick(pokemon);
    const stat = pick(STATS);
    const base = p.stats[stat];
    const useInGame = !!opts.useInGame;

    let sp = 0;
    let nature = null;
    let natLabel = '';

    if (useInGame) {
      if (opts.useNature && window.AppData?.natures) {
        const nonNeutral = window.AppData.natures.filter(n => !n.neutral);
        nature = pick(nonNeutral);
        natLabel = nature.name.toUpperCase();
      }
      if (opts.useSP) {
        sp = pick([0, 4, 8, 16, 24, 32]);
      }
    }

    const correct = useInGame ? calcStat(base, stat, sp, nature) : base;

    // Build question text & meta
    let questionText = '';
    let meta = '';
    let explanation = '';

    if (useInGame) {
      const modLines = [];
      if (opts.useNature && nature) {
        const arrow = nature.boost === stat ? ' ▲' : nature.reduce === stat ? ' ▼' : '';
        modLines.push(`Nature: ${natLabel}${arrow}`);
      }
      if (opts.useSP) {
        modLines.push(`SP in ${STAT_LABELS[stat]}: ${sp}`);
      }
      questionText = `What is ${p.name.toUpperCase()}'s ${STAT_LABELS[stat]} in battle?`
        + (modLines.length ? '\n' + modLines.join('  ·  ') : '');

      meta = opts.useSP || opts.useNature
        ? `IN-GAME STAT  ·  SP: ${sp}  ${natLabel}`
        : `IN-GAME STAT  ·  0 SPs · NEUTRAL NATURE`;

      const natStr = nature
        ? ` · ${natLabel} (×${nature.boost === stat ? '1.1' : nature.reduce === stat ? '0.9' : '1.0'})`
        : '';
      const spStr = sp > 0 ? ` + ${sp} SP` : '';
      const formula = stat === 'hp'
        ? `${base} + 75${spStr} = ${correct}`
        : `(${base} + 20)${natStr}${spStr} = ${correct}`;

      explanation = `${p.name.toUpperCase()}'s ${STAT_LABELS[stat]}: ${formula}.`;
    } else {
      questionText = `What is ${p.name.toUpperCase()}'s base ${STAT_LABELS[stat]}?`;
      meta = `BASE STAT`;
      explanation = `${p.name.toUpperCase()}'s base ${STAT_LABELS[stat]} is ${base}.`;
    }

    // Build answer options
    let options = null;
    let isRange = false;

    if (diff === 'easy') {
      isRange = true;
      const wrongs = buildWrongOptions(correct, 'easy', allPokemon, stat, useInGame, sp, nature);
      const allVals = [correct, ...wrongs];

      const seen = new Set();
      options = shuffle(allVals).map(v => {
        let lbl = makeRangeLabel(v);
        if (seen.has(lbl)) lbl = makeRangeLabel(v + 20);
        seen.add(lbl);
        return { label: lbl, value: lbl, isCorrect: lbl === makeRangeLabel(correct) };
      });
    } else if (diff === 'medium' || diff === 'hard') {
      const wrongs = buildWrongOptions(correct, diff, allPokemon, stat, useInGame, sp, nature);
      options = shuffle([correct, ...wrongs]).map(v => ({
        label: String(v),
        value: v,
        isCorrect: v === correct,
      }));
    }

    return {
      pokemon: p,
      stat,
      correct,
      questionText,
      meta,
      options: diff === 'expert' ? null : options,
      isText: diff === 'expert',
      check: (answer) => {
        if (diff === 'expert') return checkText(answer, correct);
        return answer === (isRange ? makeRangeLabel(correct) : correct);
      },
      explanation,
    };
  }

  return { generateQuestion };
})();
