/**
 * No single hit may remove more than this fraction of the rat's HP.
 *
 * Damage goes as speed squared and swing speed varies about 4x within a run, so
 * the damage distribution has a very long tail: measured 2026-09-13 over 61
 * human hits, p50 was 41 but p75 was 113 and the max 426 against a 100 HP rat -
 * 34% of all hits ended the level outright, including 60% of steel hits. The
 * medians were already right; only the tail was broken, so the fix is a bound
 * rather than a rescale. This is the explicit bound a one-sided knob needs
 * (L0250): more damage per hit is purely good in this game, so nothing else
 * stops it climbing.
 *
 * The clamp applies to the HP subtraction ONLY. Screen shake, hit-stop and the
 * particle burst all read the raw uncapped value, so a monster hit still feels
 * enormous while removing 40 HP - and the feedback constants in main.js stay
 * tuned against raw damage, exactly as they were.
 */
export const MAX_HIT_DAMAGE_FRACTION = 0.40;

/**
 * Shield strength tiers. A level names a tier; the tier supplies both the speed
 * needed to break it AND the material it is drawn in, so a player can read the
 * cost before swinging. That coupling is free: main.js returns from the shield
 * branch before the damage path, so a shield's material is purely visual.
 *
 * Speeds are derived from measured contact speed, not chosen by feel. Over 106
 * human shield contacts (2026-09-13) the speed a player actually ARRIVES with
 * was p25 38, p50 50, p75 61, max 151 - far below free-swing speed, because
 * shield placement constrains the approach. The old thresholds of 100 and 180
 * sat at 2x and 3.6x the median arrival: 100 was broken in 33% of runs and 180
 * in 0 of 13, so an entire tier promised "TOO SLOW!" and never delivered.
 *
 * Projected per-run success at ~5 attempts per encounter, which is what fits
 * the observed 8% per-contact against 33% per-run: light ~99%, medium ~74%,
 * heavy ~44%. Every tier stays reachable on purpose - see the suite, which
 * asserts it rather than trusting it.
 */
export const SHIELD_TIERS = {
  light:  { breakSpeed: 45, material: 'glass' },
  medium: { breakSpeed: 70, material: 'wood'  },
  heavy:  { breakSpeed: 95, material: 'steel' },
};

/** The fastest shield contact ever recorded (2026-09-13, 106 contacts). A tier
 *  above this is unreachable rather than hard, which is the bug that produced
 *  the 180 tier; the suite guards every tier against it. */
export const MAX_OBSERVED_CONTACT_SPEED = 150.8;

/**
 * Fill in a shield's material and breakSpeed from its tier. Returns a shallow
 * copy - level data stays immutable. Non-shield entries pass through untouched.
 * Throws on an unknown tier rather than defaulting, because a silent default
 * would mean breakSpeed 0 and a shield that shatters on contact.
 */
export function resolveShieldTier(td) {
  if (!td || !td.isShield || !td.shieldTier) return td;
  const tier = SHIELD_TIERS[td.shieldTier];
  if (!tier) {
    throw new Error(`Unknown shieldTier "${td.shieldTier}" - expected one of ${Object.keys(SHIELD_TIERS).join(', ')}`);
  }
  return { ...td, material: tier.material, breakSpeed: tier.breakSpeed };
}

/** Clamp a raw damage value to the per-hit ceiling. Pure; maxHp is passed in. */
export function applyDamageCap(rawDamage, maxHp) {
  return Math.min(rawDamage, maxHp * MAX_HIT_DAMAGE_FRACTION);
}

/**
 * Campaign materials are COSMETIC plus exactly one dial.
 *
 * `yoyoDamage` scales how much hitting this material hurts your own rat, which
 * is how you win; `restitution` is read by physics; the four colours and
 * `label` are drawn. That is the whole list - nothing else here affects play,
 * because targets in the nine campaign levels are indestructible.
 *
 * Six fields were removed on 2026-09-14 after an audit found no reader for any
 * of them: `strength` and `crackThreshold` fed evaluateImpact, whose result was
 * destructured and discarded; `fragmentCount`, `fragmentSpread` and `density`
 * were read by nothing at all; and `hardnessFactor` was worse than dead - it
 * still held 0.6/1.0/1.6, the pre-rebalance yoyoDamage values, so a stale
 * duplicate of a live dial sat next to it inviting a misread. The values live
 * on in git history and in the destructible-targets design, which needs its own
 * material table anyway.
 *
 * The spread is deliberately narrow (0.85 / 1.0 / 1.15, was 0.6 / 1.0 / 1.6).
 * Because damage is purely good here, a wide spread made steel strictly better
 * than glass and inverted the difficulty curve - the tougher material damaged
 * your own rat more, so the hard levels were the easy ones to score on. Keep
 * overall pace on DAMAGE_SCALE, the single pace dial; scaling every yoyoDamage
 * by the same factor is that same dial under another name (L0409).
 */
export const MATERIALS = {
  glass: {
    restitution: 0.1,
    yoyoDamage: 0.85,   // was 0.6; see the narrowed spread note above MATERIALS
    color: '#a8d8ea',
    crackedColor: '#6ba3be',
    outlineColor: '#3a7ca5',
    glowColor: 'rgba(168,216,234,0.35)',
    label: 'Brittle',
  },
  wood: {
    restitution: 0.2,
    yoyoDamage: 1.0,
    color: '#c4a265',
    crackedColor: '#8b6914',
    outlineColor: '#5a3e1b',
    glowColor: 'rgba(196,162,101,0.25)',
    label: 'Sturdy',
  },
  steel: {
    restitution: 0.55,
    yoyoDamage: 1.15,   // was 1.6; steel one-shot the rat on 60% of hits
    color: '#8a9ba8',
    crackedColor: '#5a6b78',
    outlineColor: '#2c3e50',
    glowColor: 'rgba(138,155,168,0.2)',
    label: 'Armored',
  },
};

// Pre-computed fragment vertex sets (relative coords, normalized to [-0.5, 0.5])
// Each entry is an array of polygons (vertex arrays) that tile a unit rectangle.
const RECT_FRAGMENTS_10 = [
  [[-0.5,-0.5],[-0.1,-0.5],[-0.15,0.0],[-0.5,0.05]],
  [[-0.1,-0.5],[0.25,-0.5],[0.2,-0.1],[-0.05,-0.15]],
  [[0.25,-0.5],[0.5,-0.5],[0.5,-0.15],[0.28,-0.05]],
  [[-0.5,0.05],[-0.15,0.0],[-0.1,0.3],[-0.45,0.35]],
  [[-0.15,0.0],[0.2,-0.1],[0.15,0.25],[-0.1,0.3]],
  [[0.2,-0.1],[0.28,-0.05],[0.5,0.1],[0.5,0.4],[0.15,0.25]],
  [[-0.5,0.35],[-0.1,0.3],[-0.12,0.5],[-0.5,0.5]],
  [[-0.1,0.3],[0.15,0.25],[0.1,0.5],[-0.12,0.5]],
  [[0.15,0.25],[0.5,0.4],[0.5,0.5],[0.1,0.5]],
  [[0.28,-0.05],[0.5,-0.15],[0.5,0.1]],
];

const RECT_FRAGMENTS_6 = [
  [[-0.5,-0.5],[0.05,-0.5],[0.0,-0.17],[-0.5,-0.2]],
  [[0.05,-0.5],[0.5,-0.5],[0.5,-0.15],[0.0,-0.17]],
  [[-0.5,-0.2],[0.0,-0.17],[0.05,0.18],[-0.5,0.15]],
  [[0.0,-0.17],[0.5,-0.15],[0.5,0.2],[0.05,0.18]],
  [[-0.5,0.15],[0.05,0.18],[0.0,0.5],[-0.5,0.5]],
  [[0.05,0.18],[0.5,0.2],[0.5,0.5],[0.0,0.5]],
];

export function getFragmentVerts(count) {
  return count >= 10 ? RECT_FRAGMENTS_10 : RECT_FRAGMENTS_6;
}

// evaluateImpact was removed on 2026-09-14. It computed SHATTER/CRACK/SURVIVE
// from `impulse = speed * mass * impactMultiplier` and physics.js passed the
// result in the hit event, where main.js destructured and discarded it - so it
// had never done anything. It is NOT being kept for the destructible-targets
// work either: measurement showed that formula gives heavy 3.58x standard's
// impulse at identical speed (mass 11.5 vs 4.5, which is otherwise inert since
// the hand drives the pivot), leaving standard unable to shatter steel in 25
// recorded hits while heavy managed it 23% of the time. That design rejects
// this formula, so leaving the function here would only invite wiring up the
// wrong model.

export function generateCrackPattern(count = 5) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const len = 0.2 + Math.random() * 0.35;
    lines.push({ angle, len });
  }
  return lines;
}
