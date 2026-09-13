// Dev telemetry - structured per-run instrumentation.
//
// Loaded only under ?dev=1 (main.js dynamic-imports it), so a normal player
// never fetches this file. One schema serves all three sources - human runs,
// bot runs and gate runs - tagged by `source`, so a bot number and a human
// number are always directly comparable.
//
// Reads state, never writes it: nothing here may influence gameplay.

export const SCHEMA_VERSION = 1;

const RUN_STORE_KEY = 'yoyo_dev_runs';   // separate from yoyo_progress
// Measured 2026-09-13, not estimated: a stored run is 1.4-2.3 KB (the raw
// per-frame arrays are deleted below and the series is downsampled), so a long
// human run is nearer 4 KB. localStorage allows ~5 MB per origin - note that
// navigator.storage.estimate() reports the whole-origin budget, which is much
// larger and NOT the localStorage cap. 100 runs is 200-400 KB, under 10% of it.
// store() already warns and continues if a write ever fails, so overshooting
// costs a run, not a playtest.
const MAX_STORED_RUNS = 100;
const SERIES_HZ = 20;                    // downsample the frame series for storage

let run = null;          // the run in progress, or null
let meta = {};           // extra fields injected by a runner (git commit, bot policy...)
let errorsHooked = false;
const capturedErrors = [];

// --- error capture -------------------------------------------------------

// Hooked once per page, not per run: an error thrown during PICKER still
// matters, and attributing it to the next run is better than dropping it.
function hookErrors() {
  if (errorsHooked) return;
  errorsHooked = true;
  window.addEventListener('error', e => {
    capturedErrors.push({ kind: 'error', message: e.message, source: `${e.filename}:${e.lineno}` });
  });
  window.addEventListener('unhandledrejection', e => {
    capturedErrors.push({ kind: 'unhandledrejection', message: String(e.reason) });
  });
  const origError = console.error.bind(console);
  console.error = (...args) => {
    capturedErrors.push({ kind: 'console.error', message: args.map(String).join(' ') });
    origError(...args);
  };
}

// --- stats helpers -------------------------------------------------------

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function summarise(values) {
  if (!values.length) return { n: 0, min: 0, p50: 0, p90: 0, p95: 0, max: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    n: values.length,
    min: round(sorted[0]),
    p50: round(percentile(sorted, 50)),
    p90: round(percentile(sorted, 90)),
    p95: round(percentile(sorted, 95)),
    max: round(sorted[sorted.length - 1]),
    mean: round(sum / values.length),
  };
}

const round = n => Math.round(n * 100) / 100;

// --- public API ----------------------------------------------------------

/** Fields merged into every subsequent run document (git commit, bot policy, seed...). */
export function setMeta(extra) {
  meta = { ...meta, ...extra };
}

export function startRun({ level, levelName, variant, source = 'human', seed = null }) {
  hookErrors();
  capturedErrors.length = 0;
  run = {
    schemaVersion: SCHEMA_VERSION,
    startedAt: new Date().toISOString(),
    source,
    seed,
    level,
    levelName,
    variant,
    meta: { ...meta, userAgent: navigator.userAgent },
    hits: [],
    // Full-resolution values feed the stats; the stored series is downsampled.
    _speeds: [],
    _frameMs: [],
    _bend: [],
    ropeContacts: 0,
    yanks: 0,
    series: { t: [], speed: [], hp: [] },
    _lastSampleT: -Infinity,
    _t: 0,
    outcome: null,
    score: 0,
  };
  return run;
}

/**
 * One call per frame from gameLoop.
 * @param rawFrameMs true wall-clock delta (NOT the clamped dt) - clamping would
 *   hide exactly the long frames we want to find.
 */
export function sampleFrame({ dt, rawFrameMs, state, speed, normalizedSpeed, hp, ropeBend = 0, ropeContacts = 0, yanks = 0 }) {
  if (!run) return;
  // Rope metrics: bend is total turning along the rope in radians, which is
  // what separates a real wrap from the rope merely touching something.
  if (state === 'SWINGING') {
    run._bend.push(ropeBend);
    run.ropeContacts = ropeContacts;
    run.yanks = yanks;
  }
  run._t += dt;
  run._frameMs.push(rawFrameMs);
  // Speed is only meaningful while swinging; sampling RESULT frames would
  // drag every percentile toward zero.
  if (state === 'SWINGING') run._speeds.push(speed);

  if (run._t - run._lastSampleT >= 1 / SERIES_HZ) {
    run._lastSampleT = run._t;
    run.series.t.push(round(run._t));
    run.series.speed.push(round(speed));
    run.series.hp.push(round(hp));
  }
  void normalizedSpeed; // derived at read time from speed + variant maximum
}

export function recordHit(hit) {
  if (!run) return;
  run.hits.push({ t: round(run._t), ...mapValues(hit, round) });
}

function mapValues(obj, fn) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = typeof v === 'number' ? fn(v) : v;
  return out;
}

export function endRun({ outcome, score, hitCount }) {
  if (!run) return null;
  run.outcome = outcome;
  run.score = score;
  run.durationS = round(run._t);

  const damaging = run.hits.filter(h => h.kind === 'damage');
  const longFrames = run._frameMs.filter(ms => ms > 33.4).length;

  run.summary = {
    outcome,
    score,
    hitCount,
    hitsToClear: outcome === 'SHATTER' ? hitCount : null,
    timeToClearS: outcome === 'SHATTER' ? round(run._t) : null,
    damagingHits: damaging.length,
    shieldBreaks: run.hits.filter(h => h.kind === 'shield-break').length,
    shieldBlocks: run.hits.filter(h => h.kind === 'shield-block').length,
    glancingHits: damaging.filter(h => h.angleFactor < 0.55).length,
    cleanHits: damaging.filter(h => h.angleFactor > 0.88).length,
    maxCombo: run.hits.reduce((m, h) => Math.max(m, h.combo || 0), 0),
    speed: summarise(run._speeds),
    damage: summarise(damaging.map(h => h.damage)),
    angleFactor: summarise(damaging.map(h => h.angleFactor)),
    frameMs: summarise(run._frameMs),
    ropeBend: summarise(run._bend),
    ropeContacts: run.ropeContacts,
    yanks: run.yanks,
    longFrames,
    longFramePct: run._frameMs.length ? round((longFrames / run._frameMs.length) * 100) : 0,
    errors: capturedErrors.length,
  };
  run.errors = [...capturedErrors];

  delete run._speeds; delete run._frameMs; delete run._bend; delete run._lastSampleT; delete run._t;

  const finished = run;
  run = null;
  store(finished);
  logSummary(finished);
  return finished;
}

/** True while a run is being recorded - lets the harness wait for completion. */
export function isRecording() { return run !== null; }

/**
 * Live view of the run in progress. The bot polls this to steer, and it is
 * what distinguishes "instrumentation is dead" from "the run just hasn't
 * finished yet" - a distinction endRun-only reporting cannot make.
 */
export function snapshot() {
  if (!run) return null;
  return {
    t: round(run._t),
    frames: run._frameMs.length,
    swingFrames: run._speeds.length,
    hits: run.hits.length,
    damagingHits: run.hits.filter(h => h.kind === 'damage').length,
    peakSpeed: run._speeds.length ? round(Math.max(...run._speeds)) : 0,
    peakBend: run._bend.length ? round(Math.max(...run._bend)) : 0,
    ropeContacts: run.ropeContacts,
    yanks: run.yanks,
    lastSpeed: run._speeds.length ? round(run._speeds[run._speeds.length - 1]) : 0,
    totalDamage: round(run.hits.reduce((a, h) => a + (h.damage || 0), 0)),
    errors: capturedErrors.length,
  };
}

// --- persistence ---------------------------------------------------------

let lastRun = null;

function store(doc) {
  lastRun = doc;
  try {
    const all = getRuns();
    all.push(doc);
    // Quota is finite; keep the newest N. See MAX_STORED_RUNS for the sizing.
    while (all.length > MAX_STORED_RUNS) all.shift();
    localStorage.setItem(RUN_STORE_KEY, JSON.stringify(all));
  } catch (err) {
    // A full or unavailable localStorage must never break a playtest.
    console.warn('[telemetry] could not persist run:', err.message);
  }
}

/**
 * Merge fields into the most recently finished run and re-persist it.
 * endRun serialises to localStorage immediately, so anything computed after
 * it returns (a calibration block, a note) is lost unless written back.
 */
export function amendLastRun(patch) {
  if (!lastRun) return null;
  Object.assign(lastRun, patch);
  try {
    const all = getRuns();
    if (all.length) {
      all[all.length - 1] = lastRun;
      localStorage.setItem(RUN_STORE_KEY, JSON.stringify(all));
    }
  } catch (err) {
    console.warn('[telemetry] could not persist amendment:', err.message);
  }
  return lastRun;
}

export function getRuns() {
  try {
    return JSON.parse(localStorage.getItem(RUN_STORE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getLastRun() { return lastRun; }

export function clearRuns() {
  lastRun = null;
  try { localStorage.removeItem(RUN_STORE_KEY); } catch { /* nothing to do */ }
}

/** Download every stored run as one JSON file (the human-run export path). */
export function exportRuns() {
  const blob = new Blob([JSON.stringify(getRuns(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ratsmash-runs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- console reporting ---------------------------------------------------

function logSummary(doc) {
  const s = doc.summary;
  console.log(
    `%c[run] L${doc.level} ${doc.levelName} - ${doc.variant} - ${doc.source}`,
    'font-weight:bold',
    `\n  outcome        ${s.outcome}  score ${s.score}`,
    `\n  hits           ${s.hitCount} total, ${s.damagingHits} damaging`
      + `, ${s.glancingHits} glancing, ${s.cleanHits} clean`,
    `\n  hits to clear  ${s.hitsToClear ?? '-'}   time ${s.timeToClearS ?? '-'}s   max combo ${s.maxCombo}`,
    `\n  speed          p50 ${s.speed.p50}  p90 ${s.speed.p90}  peak ${s.speed.max}`,
    `\n  damage/hit     p50 ${s.damage.p50}  max ${s.damage.max}`,
    `\n  frame ms       p50 ${s.frameMs.p50}  p95 ${s.frameMs.p95}  long ${s.longFrames} (${s.longFramePct}%)`,
    `\n  errors         ${s.errors}`,
    `\n  __ratsmashTelemetry.exportRuns() to download ${getRuns().length} stored run(s)`
  );
}
