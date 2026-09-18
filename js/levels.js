export const ACT_NAMES = { 1: 'The Sewer', 2: 'The Warehouse', 3: 'The Lab' };

export const LEVELS = [
  // ─────────────────────────────────────────────
  // ACT 1 — THE SEWER
  // Open: can you build and aim speed? No obstacles at all - anything that
  // interrupts the swing belongs to a later act. The variation here is carried
  // entirely by pivot, rope length and where the targets sit, which is exactly
  // the lever the campaign had never used: every level once put the hand on the
  // left at mid-height with the targets to the right.
  // ─────────────────────────────────────────────
  {
    // Short rope, low hand, one close target. The smallest possible version of
    // the whole game, so the first thing a player does is succeed at it.
    id: 1,
    act: 1,
    name: 'Pipe Dreams',
    background: ['#3d2b1f', '#1e1208'],
    groundColor: '#1a1008',
    pivot: { x: 0.18, y: 0.52 },
    stringLength: 140,
    pushStringLength: 120,
    targets: [
      { shape: 'circle', r: 36, x: 0.46, y: 0.60, material: 'glass' },
    ],
    parScore: 1200,
    pushParScore: 3000,
    hint: 'Move the mouse to swing the rat. Cleaner hits deal more damage!',
  },
  {
    // The opposite extreme: a high hand and the longest rope in the game, so the
    // swing is slow and wide and has to be committed to early. Targets sit low
    // and apart, which the short-rope reflexes from L1 cannot reach.
    id: 2,
    act: 1,
    name: 'Long Drop',
    background: ['#1e2e1e', '#0e1a0e'],
    groundColor: '#121a0a',
    pivot: { x: 0.22, y: 0.22 },
    stringLength: 140,
    pushStringLength: 200,
    targets: [
      { shape: 'circle', r: 30, x: 0.48, y: 0.72, material: 'glass' },
      { shape: 'rectangle', w: 55, h: 72, x: 0.70, y: 0.68, material: 'wood' },
    ],
    parScore: 1400,
    pushParScore: 3000,
    hint: 'A long tail swings slow and wide. Commit to the arc before you need it.',
  },
  {
    // The act's real idea, and the first level in the campaign where the hand is
    // not on the left: a central pivot with targets on BOTH sides, so the swing
    // has to be reversed rather than merely repeated. Nothing new is introduced
    // to do it - only the pivot moved.
    id: 3,
    act: 1,
    name: 'Both Ways',
    background: ['#2e2214', '#1a1408'],
    groundColor: '#100c04',
    pivot: { x: 0.50, y: 0.36 },
    stringLength: 130,
    pushStringLength: 150,
    targets: [
      { shape: 'rectangle', w: 60, h: 80, x: 0.20, y: 0.62, material: 'wood' },
      { shape: 'circle', r: 30, x: 0.80, y: 0.58, material: 'glass' },
      { shape: 'rectangle', w: 68, h: 42, x: 0.50, y: 0.70, material: 'steel' },
    ],
    parScore: 2000,
    pushParScore: 3000,
    hint: 'Targets on both sides. Reverse the swing - do not just keep going one way.',
  },

  // ─────────────────────────────────────────────
  // ACT 2 — THE WAREHOUSE
  // Constrained: can you do it in a confined space? - see CLAUDE.md > Level Design
  // ─────────────────────────────────────────────
  {
    // ACT 2 INTENT: can you do it in a confined space? The zone is the act's
    // subject; shields are its secondary vocabulary. See CLAUDE.md > Level Design.
    // L4 teaches the constraint gently: a wide floor but a low ceiling, so the
    // hand cannot be lifted and speed has to come from sweeping sideways.
    id: 4,
    act: 2,
    name: 'Low Ceiling',
    background: ['#4a3020', '#2a1a10'],
    groundColor: '#201410',
    pivot: { x: 0.10, y: 0.60 },
    handZone: { x: 0.04, y: 0.30, w: 0.42, h: 0.63 },
    shieldSpeedScale: 0.75,   // zones halve arrival speed; see resolveShieldTier
    stringLength: 140,
    pushStringLength: 150,
    targets: [
      { shape: 'rectangle', w: 70, h: 92, x: 0.50, y: 0.58, material: 'wood' },
      { shape: 'rectangle', w: 14, h: 104, x: 0.42, y: 0.56, isShield: true, shieldTier: 'light' },
    ],
    parScore: 2000,
    pushParScore: 3000,
    hint: 'Your hand is boxed in. Sweep sideways to build speed - you cannot lift out of it.',
  },
  {
    // L5 inverts L4's shape: the floor is taken away instead of the ceiling.
    // A narrow column means sideways sweeping is gone, so the only way to build
    // speed is to pump up and down - the opposite motor skill to the one above.
    id: 5,
    act: 2,
    name: 'Narrow Column',
    background: ['#3a2a1a', '#201610'],
    groundColor: '#181010',
    pivot: { x: 0.28, y: 0.38 },
    handZone: { x: 0.38, y: 0.26, w: 0.12, h: 0.67 },
    shieldSpeedScale: 0.75,   // zones halve arrival speed; see resolveShieldTier
    stringLength: 140,
    pushStringLength: 170,
    targets: [
      { shape: 'rectangle', w: 56, h: 76, x: 0.60, y: 0.44, material: 'wood' },
      { shape: 'rectangle', w: 12, h: 88, x: 0.54, y: 0.44, isShield: true, shieldTier: 'light' },
      { shape: 'rectangle', w: 56, h: 76, x: 0.60, y: 0.72, material: 'steel' },
      { shape: 'rectangle', w: 14, h: 88, x: 0.54, y: 0.72, isShield: true, shieldTier: 'medium' },
    ],
    parScore: 2400,
    pushParScore: 3000,
    hint: 'No room to sweep. Pump up and down, and pick which target the swing is aimed at.',
  },
  {
    // L6 is the act's exam: the smallest zone and the longest rope, with the
    // targets parked at the edge of what that reach allows. Neither of L4's or
    // L5's motions is enough on its own - the constraint is now distance, so the
    // rope has to do the work the hand no longer can.
    id: 6,
    act: 2,
    name: 'Long Reach',
    background: ['#2a2018', '#181408'],
    groundColor: '#100e06',
    pivot: { x: 0.16, y: 0.30 },
    handZone: { x: 0.26, y: 0.20, w: 0.11, h: 0.73 },
    shieldSpeedScale: 0.75,   // zones halve arrival speed; see resolveShieldTier
    stringLength: 140,
    pushStringLength: 190,
    targets: [
      { shape: 'rectangle', w: 82, h: 102, x: 0.50, y: 0.50, material: 'steel', movement: { axis: 'y', range: 0.04, period: 2.5 } },
      { shape: 'rectangle', w: 12, h: 114, x: 0.42, y: 0.50, isShield: true, shieldTier: 'medium' },
      { shape: 'rectangle', w: 14, h: 114, x: 0.46, y: 0.50, isShield: true, shieldTier: 'heavy' },
    ],
    parScore: 2800,
    pushParScore: 3000,
    hint: 'A small box and a long tail. The vault sits at the very end of your reach.',
  },

  // ─────────────────────────────────────────────
  // ACT 3 — THE LAB
  // Hazardous: blades, bumpers, moving targets - see CLAUDE.md > Level Design
  // ─────────────────────────────────────────────
  {
    // ACT 3 INTENT: can you do it without getting cut? Blades, bumpers and
    // moving targets all punish loss of CONTROL rather than restricting
    // position - so this act deliberately carries no handZone, which is Act 2's
    // vocabulary. It is also the only act you can lose.
    //
    // Blades are placed HIGH on purpose. The tail hangs below the hand and
    // sweeps within one rope-length of it, so a blade overhead never blocks the
    // ordinary line - it taxes the biggest swing, which is the one that would
    // otherwise be free. L7 introduces that with a single blade and plenty of
    // room beneath it.
    id: 7,
    act: 3,
    name: 'First Cut',
    background: ['#c8d4dc', '#90a4b0'],
    groundColor: '#708090',
    pivot: { x: 0.18, y: 0.46 },
    stringLength: 150,
    pushStringLength: 160,
    targets: [
      { shape: 'circle', r: 40, x: 0.70, y: 0.58, material: 'wood' },
    ],
    bumpers: [
      { x: 0.48, y: 0.62, radius: 22 },
    ],
    blades: [
      // 45% of human runs were cut here at the shared default of 120 - the
      // level that TEACHES the hazard was the deadliest in the act. Raised.
      { x: 0.46, y: 0.14, w: 240, h: 10, cutSpeed: 175 },
    ],
    parScore: 1800,
    pushParScore: 3000,
    hint: 'A blade overhead. It cannot touch you - but it will cut your tail if you swing too high.',
  },
  {
    // L8 turns the hazard from a ceiling into a corridor: two blades leave a gap
    // the swing has to pass through, and the bumpers sit where a deflection
    // pushes you toward one of them. This is the act's thesis - the danger is
    // not the obstacle, it is losing control near it.
    id: 8,
    act: 3,
    name: 'Crossfire',
    background: ['#b8ccd8', '#849ab4'],
    groundColor: '#607080',
    pivot: { x: 0.24, y: 0.54 },
    stringLength: 150,
    pushStringLength: 150,
    targets: [
      { shape: 'rectangle', w: 55, h: 70, x: 0.70, y: 0.52, material: 'glass' },
      { shape: 'circle', r: 28, x: 0.84, y: 0.64, material: 'steel' },
    ],
    bumpers: [
      { x: 0.52, y: 0.50, radius: 20 },
      { x: 0.64, y: 0.68, radius: 18 },
    ],
    blades: [
      { x: 0.50, y: 0.17, w: 300, h: 10, cutSpeed: 105 },   // 0% at 120; decoration
    ],
    parScore: 2200,
    pushParScore: 3000,
    hint: 'Two blades and two bumpers. A deflection you did not plan is what gets your tail cut.',
  },
  {
    // L9 is the campaign finale and the only level that draws on all three acts:
    // a shield from Act 2's vocabulary, bumpers and a moving target from Act 3's,
    // and blades on both flanks so neither the high route nor the far side is
    // free. Deliberately no handZone - the finale tests control, not confinement.
    id: 9,
    act: 3,
    name: 'Full Experiment',
    background: ['#d0dce8', '#a0b4c8'],
    groundColor: '#788898',
    pivot: { x: 0.20, y: 0.42 },
    stringLength: 150,
    pushStringLength: 170,
    blades: [
      { x: 0.50, y: 0.20, w: 340, h: 10, cutSpeed: 90 },    // 0% at 120; the finale should bite
    ],
    targets: [
      { shape: 'rectangle', w: 55, h: 76, x: 0.74, y: 0.52, material: 'wood' },
      { shape: 'circle', r: 28, x: 0.66, y: 0.66, material: 'glass' },
      { shape: 'rectangle', w: 60, h: 86, x: 0.86, y: 0.56, material: 'steel', movement: { axis: 'x', range: 0.03, period: 2.0 } },
      { shape: 'rectangle', w: 12, h: 86, x: 0.62, y: 0.52, isShield: true, shieldTier: 'medium' },
    ],
    bumpers: [
      { x: 0.48, y: 0.54, radius: 22 },
      { x: 0.70, y: 0.38, radius: 18 },
    ],
    parScore: 2800,
    pushParScore: 3000,
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

/**
 * Records a run. `completed` is false when the player LOST - the only losing
 * outcome is a tail cut by a blade - and a lost run must neither score nor
 * unlock anything. This guard lives here rather than at the call site because
 * unlockedLevel advanced unconditionally before: failing a level would still
 * have opened the next one, which nothing would have reported.
 */
export function saveProgress(levelId, score, { completed = true } = {}) {
  if (!completed) return;
  const data = loadProgress();
  if (!data.highScores) data.highScores = {};
  if (score > (data.highScores[levelId] || 0)) data.highScores[levelId] = score;
  data.unlockedLevel = Math.max(data.unlockedLevel || 1, levelId + 1);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}
