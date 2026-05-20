const resultPanel = document.getElementById('result-panel');
const resultOutcome = document.getElementById('result-outcome');
const resultStars = document.getElementById('result-stars');
const resultScore = document.getElementById('result-score');
const retryBtn = document.getElementById('retry-btn');
const nextBtn = document.getElementById('next-btn');
const hintText = document.getElementById('hint-text');
const yoyoPicker = document.getElementById('yoyo-picker');
const startBtn = document.getElementById('start-btn');
const yoyoBtns = document.querySelectorAll('.yoyo-btn');

let selectedVariant = 'standard';
let selectedMode = 'push';
let scoreInterval = null;
const callbacks = { start: null, retry: null, next: null, variantChange: null, modeChange: null };

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
}

export function onStart(fn) { callbacks.start = fn; }
export function onRetry(fn) { callbacks.retry = fn; }
export function onNext(fn) { callbacks.next = fn; }
export function onVariantChange(fn) { callbacks.variantChange = fn; }
export function onModeChange(fn) { callbacks.modeChange = fn; }
export function getSelectedMode() { return selectedMode; }

export function showPicker() {
  yoyoPicker.style.display = 'flex';
}

export function hidePicker() {
  yoyoPicker.style.display = 'none';
}

export function setHint(text) {
  hintText.textContent = text || '';
}

export function showResult(outcome, score, parScore) {
  resultPanel.classList.remove('hidden');

  const outcomeText = { SHATTER: 'SMASHED!', CRACK: 'CRACKED!', SURVIVE: 'BOUNCED OFF.' };
  const outcomeClass = { SHATTER: 'outcome-shatter', CRACK: 'outcome-crack', SURVIVE: 'outcome-survive' };
  resultOutcome.textContent = outcomeText[outcome] || 'Unknown';
  resultOutcome.className = outcomeClass[outcome] || '';

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
