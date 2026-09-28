/**
 * app.js — PkVGC Learning SPA
 * Handles data loading, screen routing, quiz flow, and UI rendering.
 */
(async function () {
  'use strict';

  // ── Data ─────────────────────────────────────────────────────────────────
  window.AppData = { pokemon: null, abilities: null, natures: null, typeChart: null };
  let currentMode = null;
  let currentDiff = 'medium';
  let currentSubMode = null;
  let currentQuestion = null;
  let sessionTotal = 0;
  const SESSION_LENGTH = 20;

  // Retry state — tracks questions answered wrong to re-ask after main session
  let wrongQuestions = [];  // collected during main session
  let isRetryMode = false;  // true once main session ends and retries start
  let retryQueue = [];      // questions remaining to clear in retry round

  // ── DOM helpers ───────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  function show(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(screenId).classList.add('active');
  }
  function showEl(el) { el.classList.remove('hidden'); }
  function hideEl(el) { el.classList.add('hidden'); }

  // ── Loading ───────────────────────────────────────────────────────────────
  async function loadData() {
    const bar = $('loading-bar');
    const txt = $('loading-text');
    const files = [
      ['pokemon',   'data/pokemon.json'],
      ['abilities', 'data/abilities.json'],
      ['natures',   'data/natures.json'],
      ['typeChart', 'data/type_chart.json'],
    ];
    for (let i = 0; i < files.length; i++) {
      const [key, path] = files[i];
      txt.textContent = `LOADING ${key.toUpperCase()}...`;
      bar.style.width = `${((i) / files.length) * 100}%`;
      const res = await fetch(path);
      window.AppData[key] = await res.json();
      bar.style.width = `${((i + 1) / files.length) * 100}%`;
    }
    txt.textContent = 'READY!';
    await new Promise(r => setTimeout(r, 400));
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  function updateMenuScores() {
    const g = Progress.getGlobal();
    $('menu-score').textContent = g.totalScore;
    $('menu-streak').textContent = g.bestStreak;
  }

  document.querySelectorAll('.menu-card').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      openModeScreen();
    });
  });

  // Per-mode difficulty descriptions
  const DIFF_DESCS = {
    stats: {
      easy:   '4 options · stat ranges',
      medium: '4 options · exact ±30',
      hard:   '4 options · exact ±10',
      expert: 'type the exact number',
    },
    abilities: {
      easy:   '4 options · easier picks',
      medium: '4 options · harder picks',
      hard:   'type the answer',
      expert: 'type the answer (no hints)',
    },
    types: {
      easy:   '4 options · ×0 ×0.5 ×1 ×2',
      medium: '4 options · all multipliers',
      hard:   '4 options · harder picks',
      expert: 'type the multiplier',
    },
    natures: {
      easy:   'study card · no question',
      medium: 'pick the boosted stat',
      hard:   'type boost & reduce',
      expert: 'name the nature',
    },
  };

  // ── Mode / Difficulty Select ──────────────────────────────────────────────
  function openModeScreen() {
    const labels = { stats: 'BASE STATS', abilities: 'ABILITIES', types: 'TYPE CHART', natures: 'NATURES' };
    $('mode-title').textContent = `${labels[currentMode]} — SELECT DIFFICULTY`;

    // Set dynamic difficulty descriptions for this mode
    const descs = DIFF_DESCS[currentMode] || DIFF_DESCS.stats;
    $('desc-easy').textContent   = descs.easy;
    $('desc-medium').textContent = descs.medium;
    $('desc-hard').textContent   = descs.hard;
    $('desc-expert').textContent = descs.expert;

    // Reset selections
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.submode-btn').forEach(b => b.classList.remove('selected'));
    currentDiff = null;
    currentSubMode = null;

    // Show/hide sub-mode panels
    const abilityPanel = $('ability-modes');
    const typePanel = $('type-modes');
    const modPanel = $('modifiers-panel');

    abilityPanel.classList.add('hidden');
    typePanel.classList.add('hidden');
    modPanel.classList.add('hidden');

    if (currentMode === 'abilities') {
      abilityPanel.classList.remove('hidden');
      abilityPanel.querySelector('[data-sub="identify"]').click();
    }
    if (currentMode === 'types') {
      typePanel.classList.remove('hidden');
      typePanel.querySelector('[data-sub="defender"]').click();
    }
    if (currentMode === 'stats') {
      modPanel.classList.remove('hidden');
    }

    show('screen-mode');
  }

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentDiff = btn.dataset.diff;
    });
  });

  document.querySelectorAll('.submode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Only deselect within same group
      btn.closest('.submode-grid').querySelectorAll('.submode-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      currentSubMode = btn.dataset.sub;
    });
  });

  $('back-to-menu').addEventListener('click', () => { show('screen-menu'); updateMenuScores(); });

  $('start-quiz').addEventListener('click', () => {
    if (!currentDiff) { alert('SELECT A DIFFICULTY!'); return; }
    if ((currentMode === 'abilities' || currentMode === 'types') && !currentSubMode) {
      alert('SELECT A SUB-MODE!'); return;
    }
    startQuiz();
  });

  // ── Quiz Flow ──────────────────────────────────────────────────────────────
  function startQuiz() {
    Progress.startSession();
    sessionTotal = 0;
    wrongQuestions = [];
    isRetryMode = false;
    retryQueue = [];
    updateQuizScore();
    $('quiz-progress-bar').style.width = '0%';
    hideEl($('retry-banner'));
    show('screen-quiz');
    nextQuestion();
  }

  async function nextQuestion() {
    // Clear previous UI state
    $('answers-grid').innerHTML = '';
    hideEl($('text-input-wrap'));
    hideEl($('result-box'));
    $('type-badges').innerHTML = '';
    $('question-meta').textContent = '';
    $('pokemon-frame').style.display = 'none';
    $('pokemon-sprite').src = '';

    // ── RETRY MODE ────────────────────────────────────────────────────────────
    if (isRetryMode) {
      if (retryQueue.length === 0) {
        showResults();
        return;
      }
      // Take next question from the front of the retry queue
      currentQuestion = retryQueue.shift();
      $('retry-count').textContent = `${retryQueue.length + 1} LEFT`;
      // Progress bar shows retry completion (depletes as you clear answers)
      const retryTotal = retryQueue.length + 1 + (retryQueue.length === 0 ? 0 : 0);
      renderQuestion(currentQuestion);
      return;
    }

    // ── MAIN SESSION COMPLETE — check for wrong answers ───────────────────────
    if (sessionTotal >= SESSION_LENGTH) {
      if (wrongQuestions.length > 0) {
        // Enter retry mode
        isRetryMode = true;
        retryQueue = [...wrongQuestions];
        wrongQuestions = [];
        // Show retry banner with count
        $('retry-count').textContent = `${retryQueue.length} LEFT`;
        showEl($('retry-banner'));
        $('quiz-progress-bar').style.width = '100%';
        nextQuestion(); // start first retry question immediately
        return;
      }
      showResults();
      return;
    }

    // ── NORMAL QUESTION GENERATION ────────────────────────────────────────────
    const opts = {
      useInGame: $('toggle-ingame')?.checked || false,
      useSP: $('toggle-sp')?.checked || false,
      useNature: $('toggle-nature')?.checked || false,
    };

    try {
      currentQuestion = await generateQuestion(opts);
    } catch (e) {
      console.error('Question generation error:', e);
      currentQuestion = await generateQuestion(opts); // retry once
    }

    if (!currentQuestion) { showResults(); return; }

    renderQuestion(currentQuestion);
  }

  async function generateQuestion(opts) {
    const { pokemon, abilities, natures, typeChart } = window.AppData;
    if (currentMode === 'stats') {
      return StatsQuiz.generateQuestion(pokemon, pokemon, currentDiff, opts);
    }
    if (currentMode === 'abilities') {
      return AbilitiesQuiz.generateQuestion(pokemon, abilities, currentDiff, currentSubMode || 'identify');
    }
    if (currentMode === 'types') {
      return TypesQuiz.generateQuestion(pokemon, typeChart, currentDiff, currentSubMode || 'defender');
    }
    if (currentMode === 'natures') {
      return NaturesQuiz.generateQuestion(natures, currentDiff);
    }
    return null;
  }

  function renderQuestion(q) {
    // Meta bar
    $('question-meta').textContent = q.meta || '';

    // Pokemon sprite
    if (q.pokemon) {
      $('pokemon-frame').style.display = 'flex';
      const img = $('pokemon-sprite');
      img.alt = q.pokemon.name;
      img.src = '';
      img.onerror = () => { img.src = q.pokemon.sprite_fallback || ''; };
      img.src = q.pokemon.sprite;

      // Type badges
      const badges = $('type-badges');
      (q.pokemon.types || []).forEach(t => {
        const span = document.createElement('span');
        span.className = `type-badge type-${t}`;
        span.textContent = t.toUpperCase();
        badges.appendChild(span);
      });
    }

    // Effect description box (for ability quiz)
    let existingEffect = $('quiz-card').querySelector('.ability-effect-box');
    if (existingEffect) existingEffect.remove();

    if (q.effectDesc) {
      const box = document.createElement('div');
      box.className = 'ability-effect-box';
      box.textContent = q.effectDesc;
      $('quiz-card').insertBefore(box, $('answers-grid'));
    }

    // Info card (natures easy mode)
    let existingInfo = $('quiz-card').querySelector('.info-card');
    if (existingInfo) existingInfo.remove();
    if (q.isInfoCard) {
      const div = document.createElement('div');
      div.className = 'ability-effect-box info-card';
      div.innerHTML = q.infoLines.map(l => `<div>${l}</div>`).join('');
      $('quiz-card').insertBefore(div, $('answers-grid'));
    }

    // Question text
    $('question-text').textContent = q.questionText;

    // Answers
    if (q.isInfoCard) {
      // No question, just show "NEXT" immediately via fake "correct" press
      showEl($('result-box'));
      $('result-icon').textContent = '📖';
      $('result-text').textContent = '';
      $('result-text').className = 'result-text';
      $('result-detail').textContent = q.infoLines.join('  ');
      hideEl($('answers-grid'));
      hideEl($('text-input-wrap'));
    } else if (q.options && !q.isText) {
      showEl($('answers-grid'));
      hideEl($('text-input-wrap'));
      q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = opt.label;
        btn.dataset.value = opt.value;
        btn.dataset.correct = opt.isCorrect;
        btn.addEventListener('click', () => handleAnswer(opt.isCorrect, opt.value, opt.label, btn));
        $('answers-grid').appendChild(btn);
      });
    } else {
      hideEl($('answers-grid'));
      showEl($('text-input-wrap'));
      const input = $('text-answer');
      input.value = '';
      setTimeout(() => input.focus(), 100);
    }

    // Update progress bar
    $('quiz-progress-bar').style.width = `${(sessionTotal / SESSION_LENGTH) * 100}%`;
  }

  function handleAnswer(isCorrect, value, label, clickedBtn) {
    // Disable all answer buttons
    $('answers-grid').querySelectorAll('.answer-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.correct === 'true') btn.classList.add('correct');
      else if (btn === clickedBtn && !isCorrect) btn.classList.add('wrong');
    });

    recordAndReveal(isCorrect, label);
  }

  $('submit-text').addEventListener('click', submitText);
  $('text-answer').addEventListener('keydown', e => { if (e.key === 'Enter') submitText(); });

  function submitText() {
    const val = $('text-answer').value.trim();
    if (!val) return;
    const isCorrect = currentQuestion.check(val);
    $('text-answer').disabled = true;
    $('submit-text').disabled = true;
    recordAndReveal(isCorrect, val);
  }

  function recordAndReveal(isCorrect, answer) {
    if (isRetryMode) {
      // ── RETRY MODE ──────────────────────────────────────────────────────────
      if (isCorrect) {
        // Cleared! Give the point.
        Progress.recordAnswer(true);
        $('retry-count').textContent =
          retryQueue.length === 0 ? 'ALL CLEAR!' : `${retryQueue.length} LEFT`;
      } else {
        // Still wrong — send to back of retry queue
        Progress.recordAnswer(false);
        retryQueue.push(currentQuestion);
        $('retry-count').textContent = `${retryQueue.length} LEFT`;
      }
    } else {
      // ── NORMAL MODE ─────────────────────────────────────────────────────────
      const session = Progress.recordAnswer(isCorrect);
      sessionTotal++;
      updateQuizScore(session.score, session.streak);

      // Track wrong answers for retry
      if (!isCorrect) {
        wrongQuestions.push(currentQuestion);
      }

      // Update progress bar (main session only)
      $('quiz-progress-bar').style.width = `${(sessionTotal / SESSION_LENGTH) * 100}%`;
    }

    updateQuizScore();

    // Result box
    showEl($('result-box'));
    const retryNote = isRetryMode && !isCorrect ? '\n↩ BACK TO QUEUE' : '';
    $('result-icon').textContent = isCorrect ? '✅' : '❌';
    $('result-text').textContent = isCorrect ? 'CORRECT! +1' : `WRONG!${retryNote}`;
    $('result-text').className = `result-text ${isCorrect ? 'ok' : 'fail'}`;
    $('result-detail').textContent = currentQuestion.explanation || '';

    // Flash effect on quiz card
    const card = $('quiz-card');
    card.style.borderColor = isCorrect ? 'var(--green)' : 'var(--red)';
    setTimeout(() => { card.style.borderColor = ''; }, 800);

    // Re-enable input for next
    $('text-answer').disabled = false;
    $('submit-text').disabled = false;
  }

  $('next-question').addEventListener('click', nextQuestion);

  function updateQuizScore(score, streak) {
    const s = Progress.getSession();
    $('quiz-score-display').textContent = s.score;
  }

  // ── Results ────────────────────────────────────────────────────────────────
  function showResults() {
    const s = Progress.getSession();
    $('final-score').textContent = s.score;
    $('final-total').textContent = sessionTotal;
    $('res-correct').textContent = s.correct;
    $('res-wrong').textContent = s.wrong;
    $('res-accuracy').textContent = sessionTotal > 0 ? Math.round((s.correct / sessionTotal) * 100) + '%' : '0%';
    $('res-streak').textContent = s.bestStreak;
    $('results-grade').textContent = Progress.getGrade(s.correct, sessionTotal);
    show('screen-results');
    updateMenuScores();
  }

  $('quit-quiz').addEventListener('click', () => {
    show('screen-menu');
    updateMenuScores();
  });

  $('play-again').addEventListener('click', () => {
    startQuiz();
  });

  $('results-to-menu').addEventListener('click', () => {
    show('screen-menu');
    updateMenuScores();
  });

  const toggleInGame = $('toggle-ingame');
  if (toggleInGame) {
    toggleInGame.addEventListener('change', () => {
      const subopts = $('ingame-subopts');
      if (toggleInGame.checked) {
        subopts.classList.remove('hidden');
      } else {
        subopts.classList.add('hidden');
        if ($('toggle-sp')) $('toggle-sp').checked = false;
        if ($('toggle-nature')) $('toggle-nature').checked = false;
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  show('screen-loading');
  try {
    await loadData();
    updateMenuScores();
    show('screen-menu');
  } catch (e) {
    console.error('Failed to load data:', e);
    $('loading-text').textContent = 'ERROR LOADING DATA. Check console.';
  }
})();
