export const ACT_NAMES = { 1: 'The Sewer', 2: 'The Warehouse', 3: 'The Lab' };

/**
 * Which campaign layout the level ids refer to. BUMP IT whenever a level id
 * stops meaning the same level - a re-lay, an insertion, a reorder - because
 * two things key on the id and would silently cross the boundary:
 *
 *  - telemetry: runs are analysed by level id, and "L4" in the nine-level
 *    layout (Low Ceiling, zone + shield) and "L4" in this one (Drifter, a
 *    moving target) are different levels. Pooling them measures neither.
 *  - saved progress: a high score for the old L4 is not a score for the new one.
 *
 * 1 = the nine-level layout (2026-09-14 to 2026-09-19). Anything recorded
 *     before this field existed is layout 1.
 * 2 = the 12-level teaching/mixed layout (2026-09-19).
 */
export const LAYOUT_VERSION = 2;

export const LEVELS = [
  // ─────────────────────────────────────────────
  // ACT 1 — THE SEWER
  // Open: can you build and aim speed? Four teaching levels, one target each,
  // then a mixed closer. There is no zone in this act, so once the tail is
  // grabbed the hand goes anywhere - `pivot` only sets where the rat starts.
  // The real levers here are rope length and where the target sits.
  // Materials are flavour (CLAUDE.md > Level Design): each level teaches a
  // swing, not a material.
  // ─────────────────────────────────────────────
  {
    // TEACHES the grab and the swing. Short rope, one close glass target: the
    // smallest possible version of the whole game, so the first thing a player
    // does is succeed at it. Working if: >= 90% of runs clear, median clear
    // under ~4 s (the old Pipe Dreams measured 3.0 s).
    id: 1,
    kind: 'teaching', teaches: 'swing',
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
    hint: 'Grab the tail, then move the mouse to swing the rat into the glass. Cleaner hits hurt more!',
  },
  {
    // TEACHES swinging a long rope. The longest rope in the act and a single
    // wood target held just OFF the floor - on the floor, the 200px tail dragged
    // along the ground (31-33k rope contacts per bot run, 1-3 hits in 60 s),
    // so the target stays where the old L2 kept its targets. The arc is slow and
    // wide and has to be committed to early - L1's short-rope reflexes overshoot
    // it. Working if: >= 90% clear, and glancing rate above L1's (the long arc is
    // harder to aim).
    id: 2,
    kind: 'teaching', teaches: 'swing',
    act: 1,
    name: 'Long Drop',
    background: ['#1e2e1e', '#0e1a0e'],
    groundColor: '#121a0a',
    pivot: { x: 0.22, y: 0.22 },
    stringLength: 140,
    pushStringLength: 200,
    targets: [
      { shape: 'rectangle', w: 60, h: 76, x: 0.68, y: 0.68, material: 'wood' },
    ],
    parScore: 1400,
    pushParScore: 3000,
    hint: 'A long tail swings slow and wide. Commit to the arc before you need it.',
  },
  {
    // TEACHES swinging upward. A short rope and a steel target mounted high on
    // the right: hanging the rat under the hand is not enough to reach it with
    // speed, so the swing has to rise into the target rather than fall onto it.
    // Working if: >= 90% clear; clear time above L1's, since the target cannot
    // be hit on the way down.
    id: 3,
    kind: 'teaching', teaches: 'swing',
    act: 1,
    name: 'High Shelf',
    background: ['#2e2214', '#1a1408'],
    groundColor: '#100c04',
    pivot: { x: 0.24, y: 0.62 },
    stringLength: 120,
    pushStringLength: 120,
    targets: [
      { shape: 'rectangle', w: 70, h: 48, x: 0.72, y: 0.26, material: 'steel' },
    ],
    parScore: 1600,
    pushParScore: 3000,
    hint: 'The target is up high. Swing UP into it - you will not reach it on the way down.',
  },
  {
    // TEACHES timing: one target that moves. The first mechanic in the game,
    // and the gentlest - a slow vertical drift, so the lesson is "watch where it
    // will be", not "chase it". Working if: >= 90% clear; glancing above L1's.
    id: 4,
    kind: 'teaching', teaches: 'moving',
    act: 1,
    name: 'Drifter',
    background: ['#26301e', '#141a0e'],
    groundColor: '#0e1408',
    pivot: { x: 0.20, y: 0.40 },
    stringLength: 140,
    pushStringLength: 150,
    targets: [
      { shape: 'circle', r: 38, x: 0.60, y: 0.52, material: 'glass', movement: { axis: 'y', range: 0.08, period: 2.4 } },
    ],
    parScore: 1600,
    pushParScore: 3000,
    hint: 'This one moves. Swing for where it is going to be, not where it is.',
  },
  {
    // MIXED closer for Act 1: the first level with two targets, one on each side
    // of a central start, and the right one drifting. The swing has to be
    // reversed rather than repeated - built only from what L1-L4 taught.
    // Working if: clears stay >= 90% but take longer than any teaching level.
    id: 5,
    kind: 'mixed',
    act: 1,
    name: 'Both Ways',
    background: ['#2e2a14', '#1a1608'],
    groundColor: '#100e04',
    pivot: { x: 0.50, y: 0.36 },
    stringLength: 130,
    pushStringLength: 150,
    targets: [
      { shape: 'rectangle', w: 60, h: 80, x: 0.20, y: 0.62, material: 'wood' },
      { shape: 'circle', r: 30, x: 0.80, y: 0.58, material: 'glass', movement: { axis: 'y', range: 0.05, period: 2.8 } },
    ],
    parScore: 2000,
    pushParScore: 3000,
    hint: 'Targets on both sides. Reverse the swing - do not just keep going one way.',
  },

  // ─────────────────────────────────────────────
  // ACT 2 — THE WAREHOUSE
  // Constrained: can you do it in a confined space? The zone and the shield
  // are taught SEPARATELY (the old act introduced both in its first level),
  // then combined in the closer. Inside a zone `pivot` finally matters - it is
  // where the zone lets the hand be.
  // ─────────────────────────────────────────────
  {
    // TEACHES the movement zone, and nothing else. A wide floor under a low
    // ceiling, so the hand cannot be lifted and speed has to come from sweeping
    // sideways. Working if: >= 90% clear; glancing below Act 1's (the old
    // zoned levels measured 12.5% against 18.7% open).
    id: 6,
    kind: 'teaching', teaches: 'zone',
    act: 2,
    name: 'Low Ceiling',
    background: ['#4a3020', '#2a1a10'],
    groundColor: '#201410',
    pivot: { x: 0.10, y: 0.60 },
    handZone: { x: 0.04, y: 0.30, w: 0.42, h: 0.63 },
    stringLength: 140,
    pushStringLength: 150,
    targets: [
      { shape: 'rectangle', w: 70, h: 92, x: 0.56, y: 0.58, material: 'wood' },
    ],
    parScore: 2000,
    pushParScore: 3000,
    hint: 'Your hand is boxed in - the outline shows where it can go. Sweep sideways to build speed.',
  },
  {
    // TEACHES the shield, as a gate. The only target floats inside a cage
    // of four light (glass) panels, so the level cannot be won without
    // breaking one - the user's "surround the target" design. Any panel will do.
    // No zone, so nothing else is in the way. Light is the tier rule 6 always
    // allows. Working if: >= 90% clear, and the cage breaks in >= 80% of runs.
    //
    // Cage geometry (px, canvas 1100x620): a 60x70 target floating at (792, 310)
    // with four panels FLUSH against it - sides the target's height, lid and
    // floor spanning the full 88px so they cover the corners. Together they are
    // one solid 88x98 block. It floats because a floor-level cage cannot fit
    // between the hint text (ending ~x 805 at y ~510) and the HP bar (from x ~900).
    //
    // FLUSH, not spaced. A first version left 10px of clearance, and once some
    // panels broke, each survivor was a thin free-standing post beside a 10px
    // slot: the tail looped right round the post and wedged the rat in the slot,
    // at rest for 90 s through 60 yanks - a soft-lock in a teaching level. Flush,
    // whatever survives is part of one solid block, like any floating target.
    id: 7,
    kind: 'teaching', teaches: 'shield',
    act: 2,
    name: 'Glass Cage',
    background: ['#3c2c1c', '#22180e'],
    groundColor: '#1a120a',
    pivot: { x: 0.18, y: 0.46 },
    stringLength: 150,
    pushStringLength: 160,
    targets: [
      { shape: 'rectangle', w: 60, h: 70, x: 0.72, y: 0.50, material: 'wood' },
      { shape: 'rectangle', w: 14, h: 70, x: 0.6864, y: 0.50, isShield: true, shieldTier: 'light' },
      { shape: 'rectangle', w: 14, h: 70, x: 0.7536, y: 0.50, isShield: true, shieldTier: 'light' },
      { shape: 'rectangle', w: 88, h: 14, x: 0.72, y: 0.4323, isShield: true, shieldTier: 'light' },
      { shape: 'rectangle', w: 88, h: 14, x: 0.72, y: 0.5677, isShield: true, shieldTier: 'light' },
    ],
    parScore: 2000,
    pushParScore: 3000,
    hint: 'The target is caged. Hit the glass hard enough to smash through - slow hits just bounce off.',
  },
  {
    // TEACHES the stronger shield: the same cage in medium (wood). Same shape as
    // L7 on purpose, so the only thing that changed is how hard you must hit.
    //
    // shieldSpeedScale 0.75 on an UNZONED level, deliberately. Rule 6 allows
    // medium as a gate only where it has been measured breakable, and the only
    // medium measured breakable is 52.5 (70 x 0.75, the Act 2 zoned value: 67%
    // of contacts on the old Long Reach). The unscaled 70 is the value that
    // broke in 0 of 4 runs on the old L9, fastest arrival 69. Rule 8: start easy
    // and tune from human play. Working if: the cage breaks in >= 80% of runs
    // and takes more contacts than L7's.
    id: 8,
    kind: 'teaching', teaches: 'shield-strong',
    act: 2,
    name: 'Crate',
    background: ['#3a2a1a', '#201610'],
    groundColor: '#181010',
    pivot: { x: 0.18, y: 0.46 },
    shieldSpeedScale: 0.75,
    stringLength: 150,
    pushStringLength: 160,
    targets: [
      { shape: 'rectangle', w: 60, h: 70, x: 0.72, y: 0.50, material: 'glass' },
      { shape: 'rectangle', w: 14, h: 70, x: 0.6864, y: 0.50, isShield: true, shieldTier: 'medium' },
      { shape: 'rectangle', w: 14, h: 70, x: 0.7536, y: 0.50, isShield: true, shieldTier: 'medium' },
      { shape: 'rectangle', w: 88, h: 14, x: 0.72, y: 0.4323, isShield: true, shieldTier: 'medium' },
      { shape: 'rectangle', w: 88, h: 14, x: 0.72, y: 0.5677, isShield: true, shieldTier: 'medium' },
    ],
    parScore: 2200,
    pushParScore: 3000,
    hint: 'A wooden crate is tougher than glass. You need a faster swing to break in.',
  },
  {
    // MIXED closer for Act 2: zone AND shields together, and two targets. A
    // narrow column takes away L6's sideways sweep, so speed has to come from
    // pumping up and down, and the two targets sit behind different tiers -
    // the player picks which to earn. Working if: slowest clears in Act 2
    // (the old Narrow Column measured 4.1 s median).
    id: 9,
    kind: 'mixed',
    act: 2,
    name: 'Narrow Column',
    background: ['#2a2018', '#181408'],
    groundColor: '#100e06',
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
    hint: 'No room to sweep. Pump up and down, and pick which shield is worth breaking.',
  },

  // ─────────────────────────────────────────────
  // ACT 3 — THE LAB
  // Hazardous: can you do it without getting cut? Bumpers and blades punish
  // loss of CONTROL rather than restricting position, so the act carries no
  // zone. The only act you can lose - and the blade is introduced forgivingly
  // (rule 7), with lethality rising into the finale.
  // ─────────────────────────────────────────────
  {
    // TEACHES bumpers, and the yank that frees a snagged tail. One bumper sits
    // on the line between the start and the only target, so the rope wraps it
    // and the swing gets deflected - which is exactly when a yank (click) is
    // needed. With the rope, a bumper level was unwinnable without yanking
    // (the old Crossfire, 6/6 bot failures). Working if: >= 90% clear, and a
    // yank is used in most runs that snag.
    id: 10,
    kind: 'teaching', teaches: 'bumper',
    act: 3,
    name: 'Deflector',
    background: ['#c8d4dc', '#90a4b0'],
    groundColor: '#708090',
    pivot: { x: 0.18, y: 0.46 },
    stringLength: 150,
    pushStringLength: 160,
    targets: [
      { shape: 'circle', r: 40, x: 0.72, y: 0.58, material: 'wood' },
    ],
    bumpers: [
      { x: 0.48, y: 0.60, radius: 24 },
    ],
    parScore: 1800,
    pushParScore: 3000,
    hint: 'Bumpers knock you off course. If your tail snags on one, CLICK to yank it free.',
  },
  {
    // TEACHES blades and the fail state. No bumper - the old First Cut paired
    // the two, which is why it both taught blades and cut 45% of runs.
    //
    // The blade is a DIAGONAL across the approach, not a ceiling: from (576,325)
    // to (754,168) in canvas px, so centre (0.605, 0.398), length 237, -41 deg.
    // Placed from a player sketch on 2026-09-20 (temp/level 11 feedback.png).
    // Overhead, it only taxed the biggest swing and was easy to forget; across
    // the approach it is a thing you steer around, which is the lesson.
    //
    // cutSpeed 280, raised from 230 and deliberately forgiving (rule 7). At 230
    // the 2026-09-20 playtest cut 2 of 7 runs (29%, tail speeds 233 and 272)
    // against the <= 20% criterion. The number is NOT carried over from the
    // overhead placement though: a blade in the swing path is crossed far more
    // often, so both the crossing rate and the speeds change. Bot runs cannot
    // settle it either - at a shared 120 the bot gave 0/8 where humans gave 45%.
    // Start easy, measure on human play. Working if: at most ~20% of runs cut.
    id: 11,
    kind: 'teaching', teaches: 'blade',
    act: 3,
    name: 'First Cut',
    background: ['#b8ccd8', '#849ab4'],
    groundColor: '#607080',
    pivot: { x: 0.18, y: 0.46 },
    stringLength: 150,
    pushStringLength: 160,
    targets: [
      { shape: 'circle', r: 40, x: 0.70, y: 0.58, material: 'glass' },
    ],
    blades: [
      { x: 0.605, y: 0.398, w: 237, h: 10, angle: -41, cutSpeed: 280 },
    ],
    parScore: 1800,
    pushParScore: 3000,
    hint: 'A blade across your path. It will not touch the rat - but whip your tail through it and you lose.',
  },
  {
    // MIXED finale: everything taught outside the zone - a shield, bumpers, a
    // moving target, a blade - and three targets. The blade is the act's
    // harshest (cutSpeed 90, which cut 1 of 6 runs at 94 on 2026-09-19) because
    // lethality ramps INTO the finale, not out of the introduction.
    //
    // The shield is LIGHT. On the old finale it was an unzoned medium at 70 and
    // broke in 0 of 4 runs, fastest arrival 69 - a shield nobody could open.
    // Working if: the act's highest cut rate, with clears still >= 70%.
    id: 12,
    kind: 'mixed',
    act: 3,
    name: 'Full Experiment',
    background: ['#d0dce8', '#a0b4c8'],
    groundColor: '#788898',
    pivot: { x: 0.20, y: 0.42 },
    stringLength: 150,
    pushStringLength: 170,
    blades: [
      { x: 0.50, y: 0.20, w: 340, h: 10, cutSpeed: 90 },
    ],
    targets: [
      { shape: 'rectangle', w: 55, h: 76, x: 0.74, y: 0.52, material: 'wood' },
      { shape: 'circle', r: 28, x: 0.66, y: 0.66, material: 'glass' },
      { shape: 'rectangle', w: 60, h: 86, x: 0.86, y: 0.56, material: 'steel', movement: { axis: 'x', range: 0.03, period: 2.0 } },
      { shape: 'rectangle', w: 12, h: 86, x: 0.62, y: 0.52, isShield: true, shieldTier: 'light' },
    ],
    bumpers: [
      { x: 0.48, y: 0.54, radius: 22 },
      { x: 0.70, y: 0.38, radius: 18 },
    ],
    parScore: 2800,
    pushParScore: 3000,
    hint: 'Everything at once. Break the shield, route past the bumpers, and keep your tail off the blade.',
  },
];

const SAVE_KEY = 'yoyo_progress';

/**
 * The mechanics a level uses, read from its data - the single definition the
 * level design rules in CLAUDE.md are checked against. Deriving them rather
 * than declaring them is the point: a level cannot claim to teach one thing
 * while quietly containing another, which is exactly what the old Act 2 opener
 * did (it introduced the movement zone and shields in the same level).
 *
 * Not mechanics: materials (their damage spread is deliberately narrow, so a
 * glass level and a wood level play the same), pivot position, and the number
 * of targets - multiple targets are what mixed levels build up to, and rule 2
 * governs them separately.
 *
 * Shields are two mechanics, not three: 'shield' (any shield) and
 * 'shield-strong' (medium or heavy). A stronger shield is taught once, with a
 * medium; heavy only ever appears in mixed levels with another way to the rat's
 * death, so it needs no teaching level of its own.
 */
export const MECHANICS = ['moving', 'zone', 'shield', 'shield-strong', 'bumper', 'blade'];

export function levelMechanics(level) {
  const m = new Set();
  const targets = level.targets || [];
  if (targets.some(t => t.movement)) m.add('moving');
  if (level.handZone) m.add('zone');
  const shields = targets.filter(t => t.isShield);
  if (shields.length) m.add('shield');
  if (shields.some(t => t.shieldTier === 'medium' || t.shieldTier === 'heavy')) m.add('shield-strong');
  if ((level.bumpers || []).length) m.add('bumper');
  if ((level.blades || []).length) m.add('blade');
  return m;
}

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
    // A save from another layout: its high scores belong to different levels,
    // so they go. Unlock progress is kept - a returning player should not be
    // sent back to level 1 - but capped, since the old layout's count need not
    // fit this one. A save with no version predates the field: layout 1.
    if ((raw.layoutVersion ?? 1) !== LAYOUT_VERSION) {
      delete result.highScores;
      if (result.unlockedLevel !== undefined) {
        result.unlockedLevel = Math.min(result.unlockedLevel, LEVELS.length);
      }
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
  data.layoutVersion = LAYOUT_VERSION;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

export function getLevel(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}
