export const ACT_NAMES = { 1: 'The Sewer', 2: 'The Warehouse', 3: 'The Lab' };

export const LEVELS = [
  // ─────────────────────────────────────────────
  // ACT 1 — THE SEWER
  // Introduction: varied shapes, no new mechanics
  // ─────────────────────────────────────────────
  {
    id: 1,
    act: 1,
    name: 'Pipe Dreams',
    background: ['#3d2b1f', '#1e1208'],
    groundColor: '#1a1008',
    pivot: { x: 0.22, y: 0.50 },
    stringLength: 140,
    pushStringLength: 130,
    targets: [
      { shape: 'rectangle', w: 60, h: 90, x: 0.66, y: 0.57, material: 'glass' },
    ],
    parScore: 1200,
    pushParScore: 2500,
    hint: 'Swing the rat into the target. Cleaner hits deal more damage!',
  },
  {
    id: 2,
    act: 1,
    name: 'Drip Room',
    background: ['#1e2e1e', '#0e1a0e'],
    groundColor: '#121a0a',
    pivot: { x: 0.20, y: 0.46 },
    stringLength: 140,
    pushStringLength: 140,
    targets: [
      { shape: 'circle', r: 30, x: 0.64, y: 0.50, material: 'glass' },
      { shape: 'rectangle', w: 55, h: 72, x: 0.76, y: 0.60, material: 'wood' },
    ],
    parScore: 1400,
    pushParScore: 2000,
    hint: 'Glass shatters fast. Wood takes more hits — keep the combo going!',
  },
  {
    id: 3,
    act: 1,
    name: 'The Stack',
    background: ['#2e2214', '#1a1408'],
    groundColor: '#100c04',
    pivot: { x: 0.24, y: 0.44 },
    stringLength: 130,
    pushStringLength: 140,
    targets: [
      { shape: 'rectangle', w: 52, h: 38, x: 0.64, y: 0.42, material: 'glass' },
      { shape: 'rectangle', w: 60, h: 42, x: 0.64, y: 0.54, material: 'wood' },
      { shape: 'rectangle', w: 68, h: 42, x: 0.64, y: 0.66, material: 'steel' },
    ],
    parScore: 2000,
    pushParScore: 1800,
    hint: 'Steel hits hard back. Build speed before going for the bottom block.',
  },

  // ─────────────────────────────────────────────
  // ACT 2 — THE WAREHOUSE
  // New mechanic: destructible shields
  // ─────────────────────────────────────────────
  {
    id: 4,
    act: 2,
    name: 'Screen',
    background: ['#4a3020', '#2a1a10'],
    groundColor: '#201410',
    pivot: { x: 0.22, y: 0.50 },
    stringLength: 140,
    pushStringLength: 140,
    targets: [
      { shape: 'rectangle', w: 70, h: 92, x: 0.72, y: 0.56, material: 'wood' },
      { shape: 'rectangle', w: 14, h: 104, x: 0.58, y: 0.56, material: 'glass', isShield: true, breakSpeed: 140 },
    ],
    parScore: 2000,
    pushParScore: 2000,
    hint: 'A glass shield blocks the target. Hit it fast to smash through!',
  },
  {
    id: 5,
    act: 2,
    name: 'Double Cover',
    background: ['#3a2a1a', '#201610'],
    groundColor: '#181010',
    pivot: { x: 0.22, y: 0.48 },
    stringLength: 140,
    pushStringLength: 130,
    targets: [
      { shape: 'rectangle', w: 56, h: 76, x: 0.68, y: 0.54, material: 'wood' },
      { shape: 'rectangle', w: 12, h: 88, x: 0.57, y: 0.54, material: 'glass', isShield: true, breakSpeed: 140 },
      { shape: 'rectangle', w: 56, h: 76, x: 0.82, y: 0.54, material: 'steel' },
      { shape: 'rectangle', w: 14, h: 88, x: 0.74, y: 0.54, material: 'wood', isShield: true, breakSpeed: 300 },
    ],
    parScore: 2400,
    pushParScore: 2200,
    hint: 'Two shields, two targets. Break the wood shield with a big swing!',
  },
  {
    id: 6,
    act: 2,
    name: 'The Vault',
    background: ['#2a2018', '#181408'],
    groundColor: '#100e06',
    pivot: { x: 0.20, y: 0.48 },
    stringLength: 140,
    pushStringLength: 120,
    targets: [
      { shape: 'rectangle', w: 82, h: 102, x: 0.78, y: 0.53, material: 'steel' },
      { shape: 'rectangle', w: 12, h: 114, x: 0.60, y: 0.53, material: 'glass', isShield: true, breakSpeed: 140 },
      { shape: 'rectangle', w: 14, h: 114, x: 0.68, y: 0.53, material: 'wood', isShield: true, breakSpeed: 300 },
    ],
    parScore: 2800,
    pushParScore: 2500,
    hint: 'Two shields guard the steel vault. Combo up and punch through!',
  },

  // ─────────────────────────────────────────────
  // ACT 3 — THE LAB
  // New mechanic: bumpers
  // ─────────────────────────────────────────────
  {
    id: 7,
    act: 3,
    name: 'Deflection',
    background: ['#c8d4dc', '#90a4b0'],
    groundColor: '#708090',
    pivot: { x: 0.22, y: 0.44 },
    stringLength: 150,
    pushStringLength: 150,
    targets: [
      { shape: 'rectangle', w: 65, h: 86, x: 0.72, y: 0.56, material: 'wood' },
    ],
    bumpers: [
      { x: 0.50, y: 0.60, radius: 22 },
    ],
    parScore: 1800,
    pushParScore: 2000,
    hint: 'A bumper deflects the rat. Find the angle that lets you slip past!',
  },
  {
    id: 8,
    act: 3,
    name: 'Ricochet',
    background: ['#b8ccd8', '#849ab4'],
    groundColor: '#607080',
    pivot: { x: 0.20, y: 0.50 },
    stringLength: 150,
    pushStringLength: 150,
    targets: [
      { shape: 'rectangle', w: 55, h: 70, x: 0.68, y: 0.50, material: 'glass' },
      { shape: 'circle', r: 28, x: 0.82, y: 0.62, material: 'steel' },
    ],
    bumpers: [
      { x: 0.50, y: 0.48, radius: 20 },
      { x: 0.62, y: 0.66, radius: 18 },
    ],
    parScore: 2200,
    pushParScore: 2000,
    hint: 'Use the bumpers! A well-timed ricochet can chain hits on both targets.',
  },
  {
    id: 9,
    act: 3,
    name: 'Full Experiment',
    background: ['#d0dce8', '#a0b4c8'],
    groundColor: '#788898',
    pivot: { x: 0.22, y: 0.46 },
    stringLength: 150,
    pushStringLength: 140,
    targets: [
      { shape: 'rectangle', w: 55, h: 76, x: 0.74, y: 0.52, material: 'wood' },
      { shape: 'circle', r: 28, x: 0.66, y: 0.66, material: 'glass' },
      { shape: 'rectangle', w: 60, h: 86, x: 0.86, y: 0.56, material: 'steel' },
      { shape: 'rectangle', w: 12, h: 86, x: 0.62, y: 0.52, material: 'glass', isShield: true, breakSpeed: 140 },
    ],
    bumpers: [
      { x: 0.48, y: 0.54, radius: 22 },
      { x: 0.70, y: 0.38, radius: 18 },
    ],
    parScore: 2800,
    pushParScore: 2500,
    hint: 'Everything at once. Break the shield, route past the bumpers, chain the targets.',
  },
];

const SAVE_KEY = 'yoyo_progress';

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const result = {};
    if (raw.highScores && typeof raw.highScores === 'object' && !Array.isArray(raw.highScores)) {
      result.highScores = {};
      for (const [k, v] of Object.entries(raw.highScores)) {
        const id = Number(k);
        const score = Number(v);
        if (Number.isFinite(id) && Number.isFinite(score) && score >= 0) {
          result.highScores[id] = score;
        }
      }
    }
    if (typeof raw.unlockedLevel === 'number' && Number.isFinite(raw.unlockedLevel)) {
      result.unlockedLevel = Math.max(1, Math.floor(raw.unlockedLevel));
    }
    return result;
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
