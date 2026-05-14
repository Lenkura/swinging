export const LEVELS = [
  {
    id: 1,
    name: 'Greenhouse',
    background: ['#4a7c59', '#2d5a3d'],
    groundColor: '#5c4a2a',
    yoyoType: 'standard',
    stringLength: 130,
    pivot: { x: 0.18, y: 0.48 },
    targets: [
      { shape: 'rectangle', w: 58, h: 82, x: 0.72, y: 0.58, material: 'glass' },
      { shape: 'rectangle', w: 52, h: 62, x: 0.60, y: 0.62, material: 'wood' },
    ],
    parScore: 1200,
    hint: 'Move your mouse in circles to build speed, then release!',
  },
  {
    id: 2,
    name: 'Scrapyard',
    background: ['#6b4c3b', '#3d2b1f'],
    groundColor: '#2c2c2c',
    yoyoType: 'heavy',
    stringLength: 140,
    pivot: { x: 0.15, y: 0.50 },
    targets: [
      { shape: 'rectangle', w: 70, h: 50, x: 0.68, y: 0.62, material: 'steel' },
      { shape: 'rectangle', w: 48, h: 70, x: 0.80, y: 0.58, material: 'wood' },
      { shape: 'rectangle', w: 44, h: 44, x: 0.56, y: 0.65, material: 'glass' },
    ],
    parScore: 2800,
    hint: 'The iron yoyo is slow but hits like a truck. Full speed for steel!',
  },
];

const SAVE_KEY = 'yoyo_progress';

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveProgress(levelId, score) {
  const data = loadProgress();
  if (!data.highScores) data.highScores = {};
  if (score > (data.highScores[levelId] || 0)) data.highScores[levelId] = score;
  data.unlockedLevel = Math.max(data.unlockedLevel || 1, levelId + 1);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}
