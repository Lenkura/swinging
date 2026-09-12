// Calibration mode - measure the human swing ceiling.
//
//   /?dev=1&calibrate      auto-starts a 30s run
//   __ratsmash.calibrate({ seconds: 45, variant: 'heavy' })
//
// An empty arena (no targets, no bumpers) so nothing interrupts the swing and
// the rat cannot die mid-measurement. A live readout is deliberate here: this
// is a measurement, not a feel test, and seeing the number helps you push
// against it. Never enable this during perceptual review.
//
// Why this exists: pushMaxSpeed (750 standard / 625 heavy) and the speed
// meter have never been validated against a real swing, and DAMAGE_SCALE was
// once "recalibrated" from a guessed operating range and had to be reverted.
// This produces the measured range that work should have started from.

import * as Physics from '../physics.js';
import * as Telemetry from './telemetry.js';
import { RAT_VARIANTS } from '../rat.js';

let overlay = null;
let running = false;

function buildOverlay() {
  const el = document.createElement('div');
  el.id = 'calibration-overlay';
  el.style.cssText = [
    'position:fixed', 'top:12px', 'left:12px', 'z-index:9999',
    'font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace',
    'background:rgba(8,10,16,0.86)', 'color:#e8eef8',
    'border:1px solid rgba(255,255,255,0.18)', 'border-radius:8px',
    'padding:10px 14px', 'min-width:240px', 'pointer-events:none',
    'white-space:pre',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

const bar = (frac, width = 22) => {
  const n = Math.max(0, Math.min(width, Math.round(frac * width)));
  return '#'.repeat(n) + '.'.repeat(width - n);
};

/**
 * Run a timed free-swing measurement.
 * @returns {Promise<object>} the telemetry document, with a calibration block.
 */
export async function calibrate({ seconds = 30, variant = 'standard', level = 1, api } = {}) {
  if (running) { console.warn('[calibrate] already running'); return null; }
  running = true;

  const maxSpeed = RAT_VARIANTS[variant].pushMaxSpeed;
  overlay = overlay || buildOverlay();

  api.beginRun({ level, variant, source: 'calibration', seed: null });

  // Empty the arena. spawnTargets/spawnBumpers clear existing bodies before
  // spawning, so passing [] leaves a bare stage - no change to main.js.
  Physics.spawnTargets([]);
  Physics.spawnBumpers([]);

  const t0 = performance.now();
  const doc = await new Promise(resolve => {
    function tick() {
      const elapsed = (performance.now() - t0) / 1000;
      const snap = Telemetry.snapshot();

      if (!snap) { resolve(null); return; }   // run ended unexpectedly

      const remaining = Math.max(0, seconds - elapsed);
      overlay.textContent =
        `CALIBRATION  ${variant}\n`
        + `\n`
        + `time      ${elapsed.toFixed(1)}s / ${seconds}s\n`
        + `now       ${String(Math.round(snap.lastSpeed)).padStart(4)}  ${bar(snap.lastSpeed / maxSpeed)}\n`
        + `peak      ${String(Math.round(snap.peakSpeed)).padStart(4)}  ${bar(snap.peakSpeed / maxSpeed)}\n`
        + `\n`
        + `meter     ${(snap.peakSpeed / maxSpeed * 100).toFixed(1)}% of pushMaxSpeed ${maxSpeed}\n`
        + `frames    ${snap.frames}\n`
        + (remaining > 0 ? `\nswing as hard as you can` : `\nfinishing...`);

      if (elapsed >= seconds) {
        const finished = Telemetry.endRun({ outcome: 'CALIBRATION', score: 0, hitCount: 0 });
        resolve(finished);
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  running = false;
  if (!doc) { overlay.textContent = 'CALIBRATION aborted'; return null; }

  const s = doc.summary;
  // amendLastRun, not a plain assignment: endRun has already serialised the
  // document to localStorage, so a direct mutation would never persist.
  Telemetry.amendLastRun({
    calibration: {
      variant,
      pushMaxSpeed: maxSpeed,
      peakSpeed: s.speed.max,
      peakAsFractionOfMax: Math.round((s.speed.max / maxSpeed) * 1000) / 1000,
      p50AsFractionOfMax: Math.round((s.speed.p50 / maxSpeed) * 1000) / 1000,
      windowSeconds: seconds,
    },
  });

  overlay.textContent =
    `CALIBRATION COMPLETE  ${variant}\n`
    + `\n`
    + `peak      ${Math.round(s.speed.max)}\n`
    + `p90       ${Math.round(s.speed.p90)}\n`
    + `p50       ${Math.round(s.speed.p50)}\n`
    + `\n`
    + `pushMaxSpeed is ${maxSpeed}\n`
    + `your peak reached ${(doc.calibration.peakAsFractionOfMax * 100).toFixed(1)}% of it\n`
    + `\n`
    + `__ratsmashTelemetry.exportRuns() to save`;

  console.log(
    `%c[calibration] ${variant}`, 'font-weight:bold',
    `\n  peak            ${s.speed.max}`,
    `\n  p90 / p50       ${s.speed.p90} / ${s.speed.p50}`,
    `\n  pushMaxSpeed    ${maxSpeed}`,
    `\n  peak reached    ${(doc.calibration.peakAsFractionOfMax * 100).toFixed(1)}% of pushMaxSpeed`,
    `\n  p50 sat at      ${(doc.calibration.p50AsFractionOfMax * 100).toFixed(1)}% of pushMaxSpeed`,
    `\n  samples         ${s.speed.n} frames`,
    `\n\n  This is the measured operating range. Tune against it, not against`,
    `\n  an assumed fraction of the theoretical maximum.`
  );

  return doc;
}

export function isRunning() { return running; }
