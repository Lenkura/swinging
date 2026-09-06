// Dev harness - the window.__ratsmash surface the Playwright runners drive.
//
// main.js injects its own internals here rather than this module reaching for
// globals (L0105, L0133): main.js holds gameState and startLevel in module
// scope, and passing them in keeps that boundary explicit.

import * as Physics from '../physics.js';
import * as Telemetry from './telemetry.js';
import { POLICIES, sendPointer } from './bot.js';
import { calibrate } from './calibrate.js';

let deps = null;

/** Mulberry32 - small, fast, and reproducible from a 32-bit seed. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seededRandom = null;
const nativeRandom = Math.random;

/**
 * Replace Math.random with a seeded generator so fragment scatter, crack
 * patterns and particles repeat exactly. Global on purpose - physics.js and
 * renderer.js call Math.random directly and are not to be modified for this.
 *
 * Matter.js keeps its OWN generator (Common._seed / Common.random) which this
 * does not touch; it is seeded separately below where the build exposes it.
 */
export function setSeed(seed) {
  if (seed === null || seed === undefined) {
    Math.random = nativeRandom;
    seededRandom = null;
    return { mathRandom: false, matterSeeded: false };
  }
  seededRandom = mulberry32(seed);
  Math.random = () => seededRandom();

  let matterSeeded = false;
  const Common = globalThis.Matter && globalThis.Matter.Common;
  if (Common && typeof Common._seed === 'number') {
    Common._seed = seed % 1000000;
    matterSeeded = true;
  }
  return { mathRandom: true, matterSeeded };
}

function ratState() {
  const b = Physics.getRatBody();
  if (!b) return null;
  return { x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, angle: b.angle };
}

/** Nearest surviving target, preferring damageable ones over shields. */
function pickTarget() {
  const bodies = Physics.getTargetBodies();
  if (!bodies || !bodies.length) return null;
  const rat = ratState();
  const damageable = bodies.filter(b => !b.plugin.isShield);
  const pool = damageable.length ? damageable : bodies;
  if (!rat) return { x: pool[0].position.x, y: pool[0].position.y };
  let best = pool[0];
  let bestD = Infinity;
  for (const b of pool) {
    const d = Math.hypot(b.position.x - rat.x, b.position.y - rat.y);
    if (d < bestD) { bestD = d; best = b; }
  }
  return { x: best.position.x, y: best.position.y, isShield: Boolean(best.plugin.isShield) };
}

export function initDev(injected) {
  deps = injected;

  const api = {
    version: 1,
    telemetry: Telemetry,
    physics: Physics,
    setSeed,

    /** Full state snapshot - what the gate asserts against. */
    state() {
      return {
        ...deps.getState(),
        rat: ratState(),
        targets: (Physics.getTargetBodies() || []).map(b => ({
          x: b.position.x, y: b.position.y, isShield: Boolean(b.plugin.isShield),
        })),
        fragments: (Physics.getFragmentBodies() || []).length,
        // Piece types let the gate regression-check the giblet roster
        // (tasks 101-102) rather than only counting bodies.
        fragmentPieces: (Physics.getFragmentBodies() || [])
          .map(b => b.plugin?.piece?.type ?? 'none'),
        fragmentsLanded: (Physics.getFragmentBodies() || [])
          .filter(b => b.plugin?.landed).length,
        recording: Telemetry.isRecording(),
        run: Telemetry.snapshot(),
      };
    },

    /**
     * Fixed timestep in seconds, or null for real frame timing.
     * Reproducibility vs. real-time fidelity - see main.js devFixedDt.
     */
    setFixedDt(seconds) { deps.setFixedDt(seconds); },

    /** Start a level directly, bypassing the menus. */
    beginRun({ level = 1, variant = 'standard', seed = null, source = 'bot' } = {}) {
      const seeding = setSeed(seed);
      deps.beginRun({ level, variant, source, seed });
      return { level, variant, seed, source, seeding };
    },

    /**
     * Drive one full run and resolve with its telemetry document.
     * Bounded by wall-clock time, never by iteration count (L0062).
     */
    async runBot({
      level = 1, variant = 'standard', seed = 1, policy = 'pump',
      timeoutMs = 60000, policyOpts = {}, source = 'bot', fixedDt = null,
    } = {}) {
      deps.setFixedDt(fixedDt);
      const started = api.beginRun({ level, variant, seed, source });
      const rng = seededRandom || nativeRandom;
      const step = POLICIES[policy](policyOpts);
      if (!step) throw new Error(`unknown policy: ${policy}`);

      const canvas = deps.canvas;
      const t0 = performance.now();

      await new Promise(resolve => {
        function frame() {
          const elapsedS = (performance.now() - t0) / 1000;
          const st = deps.getState();

          // The run is over when telemetry stops recording (showResult fired)
          // or we blow the deadline.
          if (!Telemetry.isRecording() || performance.now() - t0 > timeoutMs) {
            resolve();
            return;
          }
          if (st.gameState === 'SWINGING') {
            const target = pickTarget();
            const move = step({
              rat: ratState(), target, t: elapsedS,
              stringLength: st.stringLength, rng, state: st,
            });
            if (move) sendPointer(canvas, move.x, move.y);
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });

      const timedOut = performance.now() - t0 > timeoutMs;
      const doc = Telemetry.getLastRun();
      return {
        ...started,
        policy,
        fixedDt,
        timedOut,
        // A timeout leaves the run un-ended, so there is no document; report
        // the live snapshot instead of silently returning null.
        document: doc,
        liveSnapshot: doc ? null : Telemetry.snapshot(),
      };
    },
  };

  /** Timed free-swing measurement in an empty arena. */
  api.calibrate = opts => calibrate({ ...opts, api });

  window.__ratsmash = api;

  // ?dev=1&calibrate auto-starts, so a calibration session needs no console.
  // Deferred a beat so the level-select DOM is settled first.
  if (new URLSearchParams(location.search).has('calibrate')) {
    const params = new URLSearchParams(location.search);
    setTimeout(() => api.calibrate({
      seconds: Number(params.get('seconds')) || 30,
      variant: params.get('variant') || 'standard',
    }), 250);
  }

  return api;
}
