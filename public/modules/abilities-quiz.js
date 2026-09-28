/**
 * abilities-quiz.js — Ability flashcard module
 *
 * Sub-modes (what type of question):
 *   identify — Show pokemon sprite, pick/type one of its abilities
 *   effect   — Show ability effect description, pick/type the ability name
 *   reverse  — Show ability name (+ effect if cached), pick which pokemon has it
 *
 * Difficulty (answer format only — same across all sub-modes):
 *   easy/medium — 4 multiple-choice options
 *   hard/expert — free text input
 */
const AbilitiesQuiz = (() => {
  const { shuffle, pick, fmtAbility, checkText } = QuizEngine;

  // ── Ability description cache (localStorage) ──────────────────────────────
  const ABILITY_CACHE_KEY = 'pokechampions_ability_cache';
  let abilityDescCache = null;

  function loadCache() {
    if (abilityDescCache) return abilityDescCache;
    try { abilityDescCache = JSON.parse(localStorage.getItem(ABILITY_CACHE_KEY)) || {}; }
    catch { abilityDescCache = {}; }
    return abilityDescCache;
  }

  function saveCache() {
    localStorage.setItem(ABILITY_CACHE_KEY, JSON.stringify(abilityDescCache));
  }

  async function fetchAbilityDesc(abilityName) {
    const cache = loadCache();
    if (cache[abilityName]) return cache[abilityName];
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/ability/${abilityName}/`);
      if (!res.ok) return null;
      const data = await res.json();
      const entry = data.effect_entries?.find(e => e.language.name === 'en');
      const desc = entry?.short_effect || entry?.effect || null;
      if (desc) { cache[abilityName] = desc; abilityDescCache = cache; saveCache(); }
      return desc;
    } catch { return null; }
  }

  // Try to find a cached ability description — check cache first, then fetch one
  async function getAnyDesc(allAbilities) {
    const cache = loadCache();
    // Prefer already-cached ones (instant, no network)
    const cached = allAbilities.filter(a => cache[a]);
    if (cached.length > 0) {
      const a = pick(cached);
      return { ability: a, desc: cache[a] };
    }
    // Nothing cached yet — fetch a random one from the API
    const shuffled = shuffle([...allAbilities]);
    for (const ab of shuffled.slice(0, 8)) { // try up to 8 to avoid long waits
      const d = await fetchAbilityDesc(ab);
      if (d) return { ability: ab, desc: d };
    }
    return null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getAllAbilities(abilitiesData) {
    const set = new Set();
    for (const abs of Object.values(abilitiesData)) for (const a of abs) set.add(a.name);
    return [...set];
  }

  function getPokemonAbilities(pokemonName, abilitiesData, includeHidden = false) {
    const abs = abilitiesData[pokemonName] || [];
    return includeHidden ? abs : abs.filter(a => !a.is_hidden);
  }

  function isMultiChoice(diff) { return diff === 'easy' || diff === 'medium'; }

  // ── Mode: IDENTIFY ────────────────────────────────────────────────────────
  // Show pokemon sprite → pick or type one of its abilities (no slot distinction)
  async function generateIdentify(pokemon, abilitiesData, diff) {
    const includeHidden = !isMultiChoice(diff); // hidden abilities only on hard/expert
    const eligible = pokemon.filter(p => abilitiesData[p.name]?.length > 0);
    const p = pick(eligible);
    const pokAbilities = getPokemonAbilities(p.name, abilitiesData, includeHidden);
    if (pokAbilities.length === 0) return null;

    const target = pick(pokAbilities);
    const pokAbilityNames = new Set(pokAbilities.map(a => a.name));
    const allAbilities = getAllAbilities(abilitiesData);
    const wrongPool = shuffle(allAbilities.filter(a => !pokAbilityNames.has(a)));
    const allNames = pokAbilities.map(a => fmtAbility(a.name)).join(', ');

    const base = {
      pokemon: p,
      questionText: `Which ability does\n${p.name.toUpperCase()} have?`,
      meta: `ABILITIES  ·  IDENTIFY`,
      explanation: `${p.name} can have: ${allNames}.`,
    };

    if (!isMultiChoice(diff)) {
      return {
        ...base,
        options: null,
        isText: true,
        correct: fmtAbility(target.name),
        check: (ans) => {
          const norm = ans.toLowerCase().trim().replace(/\s+/g, '-');
          return pokAbilities.some(a => checkText(ans, fmtAbility(a.name)) || norm === a.name);
        },
      };
    }

    const options = shuffle([target.name, ...wrongPool.slice(0, 3)]).map(a => ({
      label: fmtAbility(a),
      value: a,
      isCorrect: pokAbilityNames.has(a),
    }));

    return {
      ...base,
      options,
      isText: false,
      correct: fmtAbility(target.name),
      check: (ans) => pokAbilityNames.has(ans),
    };
  }

  // ── Mode: EFFECT → NAME ───────────────────────────────────────────────────
  // Show ability effect description → pick or type the ability name
  async function generateEffect(pokemon, abilitiesData, diff) {
    const allAbilities = getAllAbilities(abilitiesData);

    // Get a description — from cache first, then API
    const found = await getAnyDesc(allAbilities);
    if (!found) {
      // Absolute fallback: use identify mode if no descriptions available at all
      console.warn('No ability descriptions available, falling back to identify mode');
      return generateIdentify(pokemon, abilitiesData, diff);
    }

    const { ability: targetAbility, desc } = found;
    const wrongPool = shuffle(allAbilities.filter(a => a !== targetAbility)).slice(0, 3);
    const correctLabel = fmtAbility(targetAbility);

    const base = {
      pokemon: null,
      questionText: `Which ability has this effect?`,
      effectDesc: desc,
      meta: `ABILITIES  ·  EFFECT → NAME`,
      explanation: `The ability is ${correctLabel}.`,
      correct: correctLabel,
    };

    if (!isMultiChoice(diff)) {
      return {
        ...base,
        options: null,
        isText: true,
        check: (ans) => checkText(ans, correctLabel) || checkText(ans, targetAbility),
      };
    }

    const options = shuffle([targetAbility, ...wrongPool]).map(a => ({
      label: fmtAbility(a),
      value: a,
      isCorrect: a === targetAbility,
    }));

    return {
      ...base,
      options,
      isText: false,
      check: (ans) => ans === targetAbility,
    };
  }

  // ── Mode: WHICH POKEMON? ──────────────────────────────────────────────────
  // Show ability name (+ effect on hard/expert if cached) → pick the pokemon that has it
  async function generateReverse(pokemon, abilitiesData, diff) {
    const allAbilities = shuffle(getAllAbilities(abilitiesData));

    let targetAbility = null;
    let possessors = [];
    for (const ab of allAbilities) {
      const poks = pokemon.filter(p => abilitiesData[p.name]?.some(a => a.name === ab));
      if (poks.length >= 1) { targetAbility = ab; possessors = poks; break; }
    }
    if (!targetAbility) return null;

    const correctPokemon = pick(possessors);
    const nonPossessors = pokemon.filter(p => !possessors.some(pp => pp.name === p.name));
    const wrongPokemon = pick(nonPossessors, 3);
    const correctLabel = fmtAbility(targetAbility);

    // Try to get description for hard/expert (no wait if not cached)
    let effectDesc = null;
    const cache = loadCache();
    if (!isMultiChoice(diff) && cache[targetAbility]) {
      effectDesc = cache[targetAbility];
    }

    const questionText = effectDesc
      ? `Which Pokémon has this ability?`
      : `Which Pokémon has the ability\n${correctLabel}?`;

    const options = shuffle([correctPokemon, ...wrongPokemon.slice(0, 3)]).map(p => ({
      label: p.name.toUpperCase(),
      value: p.name,
      isCorrect: p.name === correctPokemon.name,
    }));

    return {
      pokemon: null,
      questionText,
      effectDesc,
      abilityName: correctLabel,
      meta: `ABILITIES  ·  WHO HAS IT?`,
      options,
      isText: false,
      correct: correctPokemon.name.toUpperCase(),
      check: (ans) => {
        const norm = ans.toLowerCase().trim();
        return norm === correctPokemon.name.toLowerCase() || norm === correctPokemon.db_name?.toLowerCase();
      },
      explanation: `${correctPokemon.name.toUpperCase()} has ${correctLabel}${possessors.length > 1 ? ' (among others)' : ''}.`,
    };
  }

  async function generateQuestion(pokemon, abilitiesData, diff, subMode = 'identify') {
    if (subMode === 'effect')   return generateEffect(pokemon, abilitiesData, diff);
    if (subMode === 'reverse')  return generateReverse(pokemon, abilitiesData, diff);
    return generateIdentify(pokemon, abilitiesData, diff);
  }

  return { generateQuestion };
})();
