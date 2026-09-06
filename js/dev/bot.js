// The playtest bot - an in-page swing policy.
//
// Runs inside the game page (not in the Playwright process) so the identical
// code drives a batch run, the regression gate, and a browser you open by
// hand. It steers by dispatching real PointerEvents at the canvas, so
// input.js and getCanvasXY are exercised end-to-end rather than bypassed.
//
// Standing caveat: a bot's swing profile is not a human's. These numbers are
// valid for regression detection and for A/B-ing one constant against
// another. They are NOT a substitute for human telemetry when calibrating an
// absolute value - see the L0097 note in the 2026-09-06 decision entry.

const CANVAS_W = 1100;
const CANVAS_H = 620;
const MARGIN = 24;   // keep the pivot inside the play area

/**
 * Energy-pumping pendulum policy.
 *
 * Two superimposed behaviours:
 *  1. Anchor - park the support point up-and-behind the chosen target so the
 *     swing arc sweeps through it.
 *  2. Pump - offset the support in the direction the rat is already moving.
 *     Moving the support along the bob's velocity does positive work on the
 *     pendulum, which builds amplitude without needing to know its resonant
 *     frequency. Reversing sign brakes it, which is how we stop overshooting.
 */
export function pumpPolicy(opts = {}) {
  const pumpDist = opts.pumpDist ?? 55;
  const anchorBack = opts.anchorBack ?? 0.75;   // × string length, behind the target
  const anchorUp = opts.anchorUp ?? 0.55;       // × string length, above the target
  const settleSpeed = opts.settleSpeed ?? 0;    // brake above this (0 = never brake)

  return function step({ rat, target, stringLength, rng }) {
    if (!rat || !target) return null;

    // Approach from whichever side the rat currently is, so we never fight
    // the swing that is already going.
    const side = rat.x <= target.x ? -1 : 1;
    const anchor = {
      x: target.x + side * stringLength * anchorBack,
      y: target.y - stringLength * anchorUp,
    };

    const speed = Math.hypot(rat.vx, rat.vy);
    let dir = { x: 0, y: 0 };
    if (speed > 1) {
      const brake = settleSpeed > 0 && speed > settleSpeed ? -1 : 1;
      dir = { x: (rat.vx / speed) * brake, y: (rat.vy / speed) * brake };
    }

    // A little jitter keeps a seeded batch from producing N identical runs
    // while staying reproducible for a given seed.
    const jx = (rng() - 0.5) * 12;
    const jy = (rng() - 0.5) * 12;

    return {
      x: clamp(anchor.x + dir.x * pumpDist + jx, MARGIN, CANVAS_W - MARGIN),
      y: clamp(anchor.y + dir.y * pumpDist + jy, MARGIN, CANVAS_H - MARGIN),
    };
  };
}

/**
 * Deliberately poor policy: a fixed-frequency horizontal sweep that ignores
 * the rat entirely. Kept as the low-energy end of the range so telemetry can
 * be compared across swing qualities rather than only at the bot's best.
 */
export function sweepPolicy(opts = {}) {
  const hz = opts.hz ?? 1.1;
  const amplitude = opts.amplitude ?? 260;
  return function step({ t }) {
    return {
      x: clamp(CANVAS_W * 0.36 + Math.sin(t * hz * Math.PI * 2) * amplitude, MARGIN, CANVAS_W - MARGIN),
      y: 300 + Math.cos(t * hz * Math.PI * 2) * 40,
    };
  };
}

export const POLICIES = { pump: pumpPolicy, sweep: sweepPolicy };

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Dispatch a real PointerEvent so the game's own input path handles it. */
export function sendPointer(canvas, x, y) {
  const rect = canvas.getBoundingClientRect();
  const clientX = rect.left + x * (rect.width / canvas.width);
  const clientY = rect.top + y * (rect.height / canvas.height);
  canvas.dispatchEvent(new PointerEvent('pointermove', {
    clientX, clientY, bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
  }));
}
