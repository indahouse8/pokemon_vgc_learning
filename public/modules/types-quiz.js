/**
 * types-quiz.js — Type matchup flashcard module
 * Sub-modes: defender (what does X deal vs this pokemon?), attacker (what is X SE against?)
 */
const TypesQuiz = (() => {
  const { shuffle, pick } = QuizEngine;

  const MULT_LABELS = { 0: '×0', 0.25: '×0.25', 0.5: '×0.5', 1: '×1', 2: '×2', 4: '×4' };
  const ALL_MULTS = [0, 0.5, 1, 2];

  function calcEffectiveness(attackerType, defenderTypes, chart) {
    let mult = 1;
    for (const dt of defenderTypes) {
      mult *= chart[attackerType]?.[dt] ?? 1;
    }
    return mult;
  }

  function multLabel(m) {
    return MULT_LABELS[m] ?? `×${m}`;
  }

  // ── Mode: DEFENDER — given a pokemon + attacker type, what's the multiplier? ──
  function generateDefender(pokemon, typeChart, diff) {
    const p = pick(pokemon.filter(pk => pk.types.length > 0));
    const types = typeChart.types;
    const attackerType = pick(types);
    const correct = calcEffectiveness(attackerType, p.types, typeChart.chart);

    // Build wrong options from other real multipliers
    const possible = [0, 0.25, 0.5, 1, 2, 4].filter(v => v !== correct);
    const wrongs = shuffle(possible).slice(0, 3);

    const options = shuffle([correct, ...wrongs]).map(v => ({
      label: multLabel(v),
      value: v,
      isCorrect: v === correct,
    }));

    const typeHtml = p.types.map(t => `[${t.toUpperCase()}]`).join(' / ');
    const questionText = `${attackerType.toUpperCase()} attacks ${p.name.toUpperCase()} ${typeHtml}.\nWhat is the effectiveness?`;

    return {
      pokemon: p,
      questionText,
      meta: `TYPE CHART  ·  DEFENDER`,
      options,
      isText: diff === 'expert',
      correct: multLabel(correct),
      check: (ans) => {
        if (diff === 'expert') {
          const clean = ans.replace(/[×x*]/gi, '').trim();
          return parseFloat(clean) === correct || ans.trim() === multLabel(correct);
        }
        return ans === correct || parseFloat(ans) === correct;
      },
      explanation: `${attackerType.toUpperCase()} vs ${typeHtml} = ${multLabel(correct)}.`,
    };
  }

  // ── Mode: ATTACKER — given a type, which type is it SE against? ──────────
  function generateAttacker(pokemon, typeChart, diff) {
    const types = typeChart.types;
    const attackerType = pick(types);
    const chart = typeChart.chart;

    // Find all types that take 2x or 4x
    const seTypes = types.filter(t => (chart[attackerType]?.[t] ?? 1) >= 2);
    if (seTypes.length === 0) return generateAttacker(pokemon, typeChart, diff); // retry

    const correctType = pick(seTypes);
    const mult = chart[attackerType][correctType];
    const wrongTypes = shuffle(types.filter(t => t !== correctType &&
      (chart[attackerType]?.[t] ?? 1) < 2)).slice(0, 3);

    const options = shuffle([correctType, ...wrongTypes]).map(t => ({
      label: t.toUpperCase(),
      value: t,
      isCorrect: t === correctType,
    }));

    const questionText = `${attackerType.toUpperCase()} is super effective (${multLabel(mult)}) against which type?`;

    return {
      pokemon: null,
      questionText,
      attackerType,
      meta: `TYPE CHART  ·  ATTACKER`,
      options,
      isText: diff === 'expert',
      correct: correctType.toUpperCase(),
      check: (ans) => ans.toLowerCase().trim() === correctType,
      explanation: `${attackerType.toUpperCase()} deals ${multLabel(mult)} against ${correctType.toUpperCase()}.`,
    };
  }

  function generateQuestion(pokemon, typeChart, diff, subMode = 'defender') {
    if (subMode === 'attacker') return generateAttacker(pokemon, typeChart, diff);
    return generateDefender(pokemon, typeChart, diff);
  }

  return { generateQuestion };
})();
