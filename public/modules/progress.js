/**
 * progress.js — Score, streak, and localStorage persistence
 * +1 point per correct answer. All-time totals persisted.
 */
const Progress = (() => {
  const KEY = 'pokechampions_progress';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || defaultState();
    } catch { return defaultState(); }
  }

  function defaultState() {
    return {
      totalScore: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      bestStreak: 0,
      currentStreak: 0,
      lastPlayed: null,
    };
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  // Session state (resets each quiz)
  let session = {
    score: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    total: 0,
  };

  function startSession() {
    session = { score: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0, total: 0 };
  }

  function recordAnswer(isCorrect) {
    session.total++;
    if (isCorrect) {
      session.score += 1;   // +1 per correct answer
      session.correct++;
      session.streak++;
      if (session.streak > session.bestStreak) session.bestStreak = session.streak;
    } else {
      session.wrong++;
      session.streak = 0;
    }

    // Persist to all-time
    const state = load();
    state.totalAnswered++;
    state.lastPlayed = Date.now();
    if (isCorrect) {
      state.totalScore++;
      state.totalCorrect++;
      state.currentStreak++;
      if (state.currentStreak > state.bestStreak) state.bestStreak = state.currentStreak;
    } else {
      state.currentStreak = 0;
    }
    save(state);

    return session;
  }

  function getSession() { return { ...session }; }

  function getGlobal() { return load(); }

  function getGrade(correct, total) {
    if (total === 0) return 'NO DATA';
    const pct = (correct / total) * 100;
    if (pct === 100) return '★ PERFECT! ★';
    if (pct >= 90)  return '★ EXCELLENT!';
    if (pct >= 75)  return '► GREAT JOB!';
    if (pct >= 60)  return '► GOOD WORK!';
    if (pct >= 40)  return '► KEEP IT UP';
    return '► KEEP STUDYING';
  }

  return { startSession, recordAnswer, getSession, getGlobal, getGrade };
})();
