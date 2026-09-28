/**
 * natures-quiz.js — Natures flashcard module
 * Difficulty: easy (info card), medium (nature→boosted stat), hard (nature→both stats), expert (stats→nature name)
 */
const NaturesQuiz = (() => {
  const { shuffle, pick, checkText } = QuizEngine;

  const STAT_LABELS = {
    attack: 'ATTACK', defense: 'DEFENSE',
    sp_attack: 'SP. ATK', sp_defense: 'SP. DEF', speed: 'SPEED',
  };

  function getNonNeutral(natures) {
    return natures.filter(n => !n.neutral);
  }

  // ── Easy — Show nature as info card, no question ─────────────────────────
  function generateEasy(natures) {
    const nature = pick(getNonNeutral(natures));
    return {
      pokemon: null,
      questionText: `${nature.name.toUpperCase()} nature:`,
      meta: `NATURES  ·  STUDY CARD`,
      isInfoCard: true,
      infoLines: [
        `▲ BOOSTS:  ${STAT_LABELS[nature.boost]}`,
        `▼ REDUCES: ${STAT_LABELS[nature.reduce]}`,
      ],
      options: null,
      isText: false,
      correct: nature.name,
      check: () => true,
      explanation: `${nature.name}: +${STAT_LABELS[nature.boost]}, -${STAT_LABELS[nature.reduce]}.`,
    };
  }

  // ── Medium — Given nature name, pick the boosted stat ────────────────────
  function generateMedium(natures) {
    const nature = pick(getNonNeutral(natures));
    const correct = nature.boost;
    const allStats = Object.keys(STAT_LABELS);
    const wrongs = shuffle(allStats.filter(s => s !== correct)).slice(0, 3);
    const options = shuffle([correct, ...wrongs]).map(s => ({
      label: STAT_LABELS[s],
      value: s,
      isCorrect: s === correct,
    }));
    return {
      pokemon: null,
      questionText: `${nature.name.toUpperCase()} nature:\nWhich stat does it BOOST (▲)?`,
      meta: `NATURES  ·  IDENTIFY BOOST`,
      options,
      isText: false,
      correct: STAT_LABELS[correct],
      check: (ans) => ans === correct,
      explanation: `${nature.name} boosts ${STAT_LABELS[nature.boost]} and reduces ${STAT_LABELS[nature.reduce]}.`,
    };
  }

  // ── Hard — Given nature name, type both boosted + reduced stats ───────────
  function generateHard(natures) {
    const nature = pick(getNonNeutral(natures));
    return {
      pokemon: null,
      questionText: `${nature.name.toUpperCase()} nature:\nType "BOOST / REDUCE" (e.g. SPEED / ATTACK)`,
      meta: `NATURES  ·  BOOST & REDUCE`,
      options: null,
      isText: true,
      correct: `${STAT_LABELS[nature.boost]} / ${STAT_LABELS[nature.reduce]}`,
      check: (ans) => {
        const norm = ans.toUpperCase().replace(/[\-_]/g, ' ').replace(/\s+/g, ' ').trim();
        const boost = STAT_LABELS[nature.boost];
        const reduce = STAT_LABELS[nature.reduce];
        return (norm.includes(boost) && norm.includes(reduce));
      },
      explanation: `${nature.name}: +${STAT_LABELS[nature.boost]}, -${STAT_LABELS[nature.reduce]}.`,
    };
  }

  // ── Expert — Given boost/reduce pair, name the nature ────────────────────
  function generateExpert(natures) {
    const nature = pick(getNonNeutral(natures));
    const boost = STAT_LABELS[nature.boost];
    const reduce = STAT_LABELS[nature.reduce];
    return {
      pokemon: null,
      questionText: `▲ Boosts ${boost}\n▼ Reduces ${reduce}\nWhich nature is this?`,
      meta: `NATURES  ·  NAME THE NATURE`,
      options: null,
      isText: true,
      correct: nature.name.toUpperCase(),
      check: (ans) => checkText(ans, nature.name),
      explanation: `The nature with +${boost} / -${reduce} is ${nature.name}.`,
    };
  }

  function generateQuestion(natures, diff) {
    if (diff === 'easy')   return generateEasy(natures);
    if (diff === 'medium') return generateMedium(natures);
    if (diff === 'hard')   return generateHard(natures);
    return generateExpert(natures);
  }

  return { generateQuestion, STAT_LABELS };
})();
