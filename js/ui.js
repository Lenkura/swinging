import { ACT_NAMES } from './levels.js';

const resultPanel = document.getElementById('result-panel');
const resultOutcome = document.getElementById('result-outcome');
const resultStars = document.getElementById('result-stars');
const resultScore = document.getElementById('result-score');
const retryBtn = document.getElementById('retry-btn');
const nextBtn = document.getElementById('next-btn');
const lsBtn = document.getElementById('ls-btn');
const hintText = document.getElementById('hint-text');
const yoyoPicker = document.getElementById('yoyo-picker');
const startBtn = document.getElementById('start-btn');
const yoyoBtns = document.querySelectorAll('.yoyo-btn');
const lsPanel = document.getElementById('level-select');
const lsGrid = document.getElementById('ls-grid');

let selectedVariant = 'standard';
let selectedMode = 'push';
let scoreInterval = null;
const callbacks = { start: null, retry: null, next: null, variantChange: null, modeChange: null, levelSelect: null, levelSelectBack: null };

export function init() {
  yoyoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      yoyoBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedVariant = btn.dataset.type;
      if (callbacks.variantChange) callbacks.variantChange(selectedVariant);
    });
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMode = btn.dataset.mode;
      if (callbacks.modeChange) callbacks.modeChange(selectedMode);
    });
  });

  startBtn.addEventListener('click', () => {
    if (callbacks.start) callbacks.start(selectedVariant);
  });

  retryBtn.addEventListener('click', () => {
    if (callbacks.retry) callbacks.retry();
  });

  nextBtn.addEventListener('click', () => {
    if (callbacks.next) callbacks.next();
  });

  lsBtn.addEventListener('click', () => {
    if (callbacks.levelSelectBack) callbacks.levelSelectBack();
  });
}

export function onStart(fn) { callbacks.start = fn; }
export function onRetry(fn) { callbacks.retry = fn; }
export function onNext(fn) { callbacks.next = fn; }
export function onVariantChange(fn) { callbacks.variantChange = fn; }
export function onModeChange(fn) { callbacks.modeChange = fn; }
export function getSelectedMode() { return selectedMode; }
export function onLevelSelect(fn) { callbacks.levelSelect = fn; }
export function onLevelSelectBack(fn) { callbacks.levelSelectBack = fn; }

export function buildLevelSelect(levels, progress) {
  const unlockedLevel = progress.unlockedLevel || 1;
  const highScores = progress.highScores || {};
  lsGrid.innerHTML = '';

  let currentAct = null;
  for (const level of levels) {
    if (level.act !== currentAct) {
      currentAct = level.act;
      const header = document.createElement('div');
      header.className = 'ls-act-header';
      header.textContent = `ACT ${currentAct} — ${ACT_NAMES[currentAct] || ''}`;
      lsGrid.appendChild(header);
    }

    const unlocked = level.id <= unlockedLevel;
    const score = highScores[level.id] || 0;
    const par = level.pushParScore || level.parScore;
    const stars = score >= par ? '★★★' : score >= par * 0.6 ? '★★☆' : score > 0 ? '★☆☆' : '';
    const card = document.createElement('button');
    card.className = 'ls-card' + (score > 0 ? ' ls-played' : '');
    card.disabled = !unlocked;
    card.dataset.id = level.id;
    card.innerHTML = unlocked
      ? `<span class="ls-num">LEVEL ${level.id}</span>
         <span class="ls-name">${level.name}</span>
         <span class="ls-stars">${stars || '—'}</span>
         <span class="ls-score">${score > 0 ? score.toLocaleString() : 'Not played'}</span>`
      : `<span class="ls-num">LEVEL ${level.id}</span>
         <span class="ls-name">${level.name}</span>
         <span class="ls-lock">🔒</span>`;
    card.addEventListener('click', () => {
      if (callbacks.levelSelect) callbacks.levelSelect(level.id);
    });
    lsGrid.appendChild(card);
  }
}

export function showLevelSelect() { lsPanel.classList.remove('hidden'); }
export function hideLevelSelect() { lsPanel.classList.add('hidden'); }

export function showPicker() {
  yoyoPicker.style.display = 'flex';
}

export function hidePicker() {
  yoyoPicker.style.display = 'none';
}

export function setHint(text) {
  hintText.textContent = text || '';
}

export function showResult(outcome, score, parScore, actClear = false) {
  resultPanel.classList.remove('hidden');

  let outcomeText, outcomeClass;
  if (actClear) {
    outcomeText = 'ACT CLEAR!';
    outcomeClass = 'outcome-actclear';
  } else {
    const texts = { SHATTER: 'SMASHED!', CRACK: 'CRACKED!', SURVIVE: 'BOUNCED OFF.' };
    const classes = { SHATTER: 'outcome-shatter', CRACK: 'outcome-crack', SURVIVE: 'outcome-survive' };
    outcomeText = texts[outcome] || 'Unknown';
    outcomeClass = classes[outcome] || '';
  }
  resultOutcome.textContent = outcomeText;
  resultOutcome.className = outcomeClass;

  const stars = score >= parScore ? '★★★' : score >= parScore * 0.6 ? '★★☆' : '★☆☆';
  resultStars.textContent = stars;

  // Animate score count-up
  if (scoreInterval) clearInterval(scoreInterval);
  let displayed = 0;
  const step = Math.ceil(score / 30);
  resultScore.textContent = '0';
  scoreInterval = setInterval(() => {
    displayed = Math.min(displayed + step, score);
    resultScore.textContent = displayed.toLocaleString();
    if (displayed >= score) clearInterval(scoreInterval);
  }, 20);
}

export function setNextVisible(visible) {
  if (visible) nextBtn.classList.remove('hidden');
  else nextBtn.classList.add('hidden');
}

export function hideResult() {
  resultPanel.classList.add('hidden');
}

export function getSelectedVariant() { return selectedVariant; }
