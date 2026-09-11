import * as Physics from './physics.js';
import * as Input from './input.js';
import * as Renderer from './renderer.js';
import * as Particles from './particles.js';
import * as UI from './ui.js';
import { RAT_VARIANTS } from './rat.js';
import { LEVELS, getLevel, saveProgress, loadProgress } from './levels.js';
import { generateCrackPattern } from './target.js';
import { playHit, playShatter, playComboTone, playShieldBlock, playShieldBreak, startWhoosh, updateWhoosh, stopWhoosh } from './audio.js';
import { calcPushScore, comboMultiplier } from './scoring.js';

// --- Dev instrumentation (?dev=1) ---------------------------------------
// Dynamically imported so a normal player never fetches js/dev/*. Every call
// site below is a no-op without the flag; nothing here may affect gameplay.
const DEV = new URLSearchParams(location.search).has('dev');
const NOOP_TELEMETRY = {
  startRun() {}, endRun() { return null; }, recordHit() {}, sampleFrame() {},
  setMeta() {}, isRecording() { return false; },
};
const Telemetry = DEV ? await import('./dev/telemetry.js') : NOOP_TELEMETRY;
if (DEV) window.__ratsmashTelemetry = Telemetry;

// Tagged onto each run so a bot number is never mistaken for a human one.
// The harness (js/dev/harness.js) overwrites these before driving a run.
let devSource = 'human';
let devSeed = null;
// Opt-in fixed timestep. Real frame times vary, so physics stepping on the
// real dt makes two runs of the same seed diverge. Setting this trades
// real-time fidelity for reproducibility; it stays null (real dt) unless a
// runner asks for it, and is unreachable without ?dev=1.
let devFixedDt = null;
// Segmented rope (task 117), dev-only and off by default: ?dev=1&rope=10.
// Old and new coexist so the batch can A/B them at identical seeds. The flag
// goes away in task 121 when the rope becomes the only path.
let ropeSegments = DEV ? Number(new URLSearchParams(location.search).get('rope')) || 0 : 0;
// Dev knobs, all defaulting to current behaviour: ?dev=1&rope=10&hand=40&subs=4
if (DEV) {
  const q = new URLSearchParams(location.search);
  if (q.has('hand')) Physics.setHandMaxStep(Number(q.get('hand')) || 0);
  if (q.has('subs')) Physics.setSubSteps(Number(q.get('subs')) || 1);
  if (q.has('segcap')) Physics.setRopeConfig({ maxSegStep: Number(q.get('segcap')) || 0 });
  if (q.has('ccd')) Physics.setRopeConfig({ ccd: q.get('ccd') !== '0' });
}


const canvas = document.getElementById('game-canvas');
const CANVAS_W = 1100;
const CANVAS_H = 620;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const gameContainer = document.getElementById('game-container');
function fitToViewport() {
  const scale = Math.min(window.innerWidth / CANVAS_W, window.innerHeight / CANVAS_H, 1);
  gameContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener('resize', fitToViewport);
fitToViewport();

// --- State machine ---
// States: PICKER | SWINGING | IMPACT | RESULT
const RAT_MAX_HP = 100;
const DAMAGE_SCALE = 200; // px²·step⁻² per HP — raise to nerf damage, lower to buff

let gameState = 'PICKER';
let currentLevelId = 1;
let selectedVariant = 'standard';
let ratHp = RAT_MAX_HP;
let hitCount = 0;
let hitCooldown = 0;
let comboCount = 0;
let comboTimer = 0;
const COMBO_WINDOW = 1.0;
let hitLabel = { text: '', x: 0, y: 0, timer: 0, color: '#fff' };
const HIT_LABEL_DURATION = 0.7;
let shakeTimer = 0;
let shakeIntensity = 0;
const SHAKE_DURATION = 0.3;
let hitStopTimer = 0; // sim freeze on heavy hits; render/particles keep running
let flashTimer = 0;
let squashTimer = 0;
const FLASH_DURATION = 0.05;
const SQUASH_DURATION = 0.12;
let lastTime = null;
let pivot = { x: 0, y: 0 };
let stringLength = 130;
let lastOutcome = null;
let lastScore = 0;
let impactTimer = 0;
let spinAccum = 0; // accumulated spin angle for renderer
let elapsed = 0; // seconds since level start, drives moving-target oscillation

function currentLevel() {
  return getLevel(currentLevelId);
}

function computePivot(level) {
  return {
    x: level.pivot.x * CANVAS_W,
    y: level.pivot.y * CANVAS_H,
  };
}

function damageIntensity(damage) {
  return Math.min(damage / 240, 1);
}

// Three-part impact burst: red blood splash (rat), material-colored chunk
// debris (target), and fur-colored chunk debris (rat). scale=2 is used for
// the bigger SHATTER-time burst.
function emitImpactBurst(x, y, intensity, material, variant, scale = 1) {
  Particles.emit(x, y, {
    count: Math.round((4 + intensity * 8) * scale),
    color: '#b0202a',
    speed: 140 + intensity * 120,
    radius: (2.5 + intensity * 1.5) * scale,
  });

  Particles.emit(x, y, {
    count: Math.round((2 + intensity * 6) * scale),
    color: material.crackedColor,
    speed: 120 + intensity * 140,
    radius: 3 * (1 + intensity * 2) * scale,
    shape: 'chunk',
  });

  Particles.emit(x, y, {
    count: Math.round((2 + intensity * 5) * scale),
    color: variant.chunkColor,
    speed: 120 + intensity * 120,
    radius: 2.5 * (1 + intensity * 2) * scale,
    shape: 'chunk',
  });
}

// --- Setup ---
Physics.init(CANVAS_W, CANVAS_H);
Renderer.init(canvas);
UI.init();

UI.onVariantChange(v => { selectedVariant = v; });

UI.onStart(variant => {
  selectedVariant = variant;
  startLevel();
});

UI.onRetry(() => {
  UI.hideResult();
  startLevel();
});

UI.onLevelSelect(id => {
  currentLevelId = id;
  UI.hideLevelSelect();
  UI.showPicker();
});

UI.onLevelSelectBack(() => {
  UI.hideResult();
  UI.buildLevelSelect(LEVELS, loadProgress());
  UI.showLevelSelect();
});

UI.onNext(() => {
  UI.hideResult();
  const nextId = currentLevelId + 1;
  if (nextId <= LEVELS.length) {
    currentLevelId = nextId;
    startLevel();
  } else {
    currentLevelId = 1;
    startLevel();
  }
});

// Physics collision event
Physics.on('yoyo-hit-target', ({ target, yoyo, outcome, speed, hitPoint, material, angleFactor }) => {
  const af = angleFactor ?? 1.0;
  const variant = RAT_VARIANTS[yoyo.plugin?.variantKey || 'standard'];

  if (gameState !== 'SWINGING' || hitCooldown > 0) return;

  // Shield hit — check break threshold
    if (target.plugin.isShield) {
      hitCooldown = 0.35;
      Telemetry.recordHit({
        kind: speed >= target.plugin.breakSpeed ? 'shield-break' : 'shield-block',
        speed, angleFactor: af, material: target.plugin.materialKey,
        breakSpeed: target.plugin.breakSpeed, hpAfter: ratHp,
      });
      if (speed >= target.plugin.breakSpeed) {
        Physics.removeTarget(target);
        playShieldBreak();
        hitLabel = { text: 'SHIELD BREAK!', x: hitPoint.x, y: hitPoint.y, timer: HIT_LABEL_DURATION, color: '#ffd166' };
        Particles.emit(hitPoint.x, hitPoint.y, { count: 8, color: '#ffd166', speed: 220, radius: 3 });
      } else {
        playShieldBlock();
        hitLabel = { text: 'TOO SLOW!', x: hitPoint.x, y: hitPoint.y, timer: HIT_LABEL_DURATION, color: '#e07070' };
      }
      return;
    }

    const cm = comboMultiplier(comboCount);
    comboCount++;
    comboTimer = COMBO_WINDOW;

    const damage = speed * speed * af * (material.yoyoDamage || 1.0) * (yoyo.plugin.impactMultiplier || 1.0) * cm / DAMAGE_SCALE;
    ratHp = Math.max(0, ratHp - damage);
    hitCount++;
    hitCooldown = 0.35;
    playHit(target.plugin.materialKey, Math.min(damage / RAT_MAX_HP, 1), comboCount);
    playComboTone(comboCount);

    Telemetry.recordHit({
      kind: 'damage', speed, angleFactor: af, material: target.plugin.materialKey,
      damage, combo: comboCount, multiplier: cm, hpAfter: ratHp, hitIndex: hitCount,
    });

    if (af < 0.55) {
      hitLabel = { text: 'GLANCING!', x: hitPoint.x, y: hitPoint.y, timer: HIT_LABEL_DURATION, color: '#f4a261' };
    } else if (af > 0.88) {
      hitLabel = { text: 'CLEAN HIT!', x: hitPoint.x, y: hitPoint.y, timer: HIT_LABEL_DURATION, color: '#80ffdb' };
    }

    const intensity = damageIntensity(damage);
    flashTimer = FLASH_DURATION;
    squashTimer = SQUASH_DURATION;

    if (damage > 120) {
      shakeIntensity = Math.min(damage / 80, 10);
      shakeTimer = SHAKE_DURATION;
      hitStopTimer = 0.04 + 0.04 * intensity; // 40-80ms, same threshold as shake
    }

    // Progressive crack visuals
    const hpFrac = ratHp / RAT_MAX_HP;
    yoyo.plugin.cracked = hpFrac < 1.0;
    const crackCount = hpFrac < 0.25 ? 12 : hpFrac < 0.5 ? 8 : hpFrac < 0.75 ? 4 : 0;
    if (crackCount > 0) yoyo.plugin.crackPattern = generateCrackPattern(crackCount);

    emitImpactBurst(hitPoint.x, hitPoint.y, intensity, material, variant);
    Renderer.paintSplat(hitPoint.x, intensity);

    if (ratHp <= 0) {
      gameState = 'IMPACT';
      lastOutcome = 'SHATTER';
      lastScore = calcPushScore(hitCount);
      playShatter();
      Physics.applyBreak(yoyo, 'SHATTER', hitPoint, variant.blastBonus);
      emitImpactBurst(hitPoint.x, hitPoint.y, 1, material, variant, 2);
      Renderer.paintSplat(hitPoint.x, 1, 2);
      impactTimer = 0.85;
    }
});

// Giblet touchdown — small blood splat into the decal layer, scaled by piece size
Physics.on('fragment-landed', ({ x, size }) => {
  Renderer.paintSplat(x, Math.min(size / 10, 1) * 0.4, 0.6);
});

// Yank: pull the rat toward the pivot to unwind a caught rope. Cooldown-gated
// so it cannot be spammed; Physics.yankRope clamps it to never raise speed.
const YANK_COOLDOWN = 0.6;
let yankCooldown = 0;
let yankCount = 0;
Input.onYank(() => {
  if (gameState !== 'SWINGING' || yankCooldown > 0) return;
  if (Physics.yankRope()) {
    yankCooldown = YANK_COOLDOWN;
    yankCount++;
  }
});

// Input callbacks
Input.onPivotMove(({ x, y }) => {
  if (gameState !== 'SWINGING') return;
  Physics.updatePivot(x, y);
});

function startLevel() {
  const level = currentLevel();
  pivot = computePivot(level);
  stringLength = level.stringLength;
  spinAccum = 0;
  elapsed = 0;

  ratHp = RAT_MAX_HP;
  hitCount = 0;
  yankCooldown = 0;
  yankCount = 0;
  hitCooldown = 0;
  comboCount = 0;
  comboTimer = 0;
  hitLabel = { text: '', x: 0, y: 0, timer: 0, color: '#fff' };
  shakeTimer = 0;
  shakeIntensity = 0;
  hitStopTimer = 0;
  flashTimer = 0;
  squashTimer = 0;

  Physics.reset();
  Particles.clear();
  Renderer.clearTrail();
  Renderer.clearDecals();

  // Spawn targets and bumpers
  Physics.spawnTargets(level.targets);
  Physics.spawnBumpers(level.bumpers || []);

  // Spawn rat and setup push-mode input
  const psl = level.pushStringLength || stringLength;
  Physics.spawnRat(pivot.x, pivot.y + psl, selectedVariant);
  if (ropeSegments > 0) {
    Physics.attachRope(pivot.x, pivot.y, psl, ropeSegments);
  } else {
    Physics.attachString(pivot.x, pivot.y, psl, 0.35);
  }
  Input.init(canvas, pivot);
  Input.attachToCanvas(canvas);

  UI.hidePicker();
  UI.setHint(level.hint || 'Move the mouse to swing the rat! Chain hits for a combo bonus.');

  Telemetry.startRun({
    level: level.id, levelName: level.name, variant: selectedVariant,
    source: devSource, seed: devSeed,
  });

  startWhoosh();
  gameState = 'SWINGING';
  lastOutcome = null;
  lastScore = 0;
  impactTimer = 0;
}

// --- Game Loop ---
function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (lastTime === null) { lastTime = timestamp; return; }
  const rawFrameMs = timestamp - lastTime;  // unclamped - clamping would hide long frames
  const dt = devFixedDt !== null ? devFixedDt : Math.min(rawFrameMs / 1000, 0.05);
  lastTime = timestamp;

  // Physics step (all states except PICKER/RESULT where physics needn't run).
  // During hit-stop the sim block (physics + gameplay timers) holds, while
  // particles, shake, and labels keep running so the world visibly "stops
  // for the hit" without the frame reading as dropped.
  if (gameState !== 'PICKER' && gameState !== 'RESULT') {
    if (hitStopTimer > 0) {
      hitStopTimer -= dt;
    } else {
      if (gameState === 'SWINGING') {
        elapsed += dt;
        Physics.updateMovingTargets(elapsed);
      }
      Physics.step(dt * 1000);
      if (hitCooldown > 0) hitCooldown -= dt;
      if (yankCooldown > 0) yankCooldown -= dt;
      if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) comboCount = 0;
      }
    }
    Particles.update(dt);
    // Airborne giblets shed blood drips on their spawn-time cadence
    for (const frag of Physics.getFragmentBodies()) {
      if (frag.plugin.landed) continue;
      frag.plugin.dripTimer += dt;
      if (frag.plugin.dripTimer >= frag.plugin.dripInterval) {
        frag.plugin.dripTimer = 0;
        Particles.emit(frag.position.x, frag.position.y, {
          count: 1, color: '#8f1420', speed: 20, gravity: 500, radius: 1.8, lifetime: 0.55,
        });
      }
    }
    if (hitLabel.timer > 0) hitLabel.timer -= dt;
    if (shakeTimer > 0) shakeTimer -= dt;
    if (flashTimer > 0) flashTimer -= dt;
    if (squashTimer > 0) squashTimer -= dt;
  }

  // State-specific logic
  if (gameState === 'IMPACT') {
    impactTimer -= dt;
    if (impactTimer <= 0) {
      gameState = 'RESULT';
      showResult();
    }
  }

  // Update trail from physics body during swing
  if (gameState === 'SWINGING') {
    const yb = Physics.getRatBody();
    if (yb) {
      Renderer.updateTrail(yb.position.x, yb.position.y, RAT_VARIANTS[selectedVariant].trailLength);
    }
  }

  // Render
  const level = currentLevel();
  let angularSpeed = 0;
  let ratSpeed = 0;
  if (gameState === 'SWINGING') {
    const yb = Physics.getRatBody();
    if (yb) {
      ratSpeed = Math.sqrt(yb.velocity.x ** 2 + yb.velocity.y ** 2);
      angularSpeed = Math.min(ratSpeed / RAT_VARIANTS[selectedVariant].pushMaxSpeed, 1);
    }
  }
  updateWhoosh(angularSpeed);

  Telemetry.sampleFrame({
    dt, rawFrameMs, state: gameState, speed: ratSpeed,
    normalizedSpeed: angularSpeed, hp: ratHp,
    ropeBend: ropeSegments > 0 ? Physics.getRopeBend() : 0,
    ropeContacts: ropeSegments > 0 ? Physics.getRopeContactCount() : 0,
    yanks: yankCount,
  });

  // Pass constraint anchor as pivot so string + hand draw at mouse position
  const constraint = Physics.getStringConstraint();
  const displayPivot = constraint ? constraint.pointA : pivot;

  Renderer.draw({
    state: gameState,
    level,
    pivot: displayPivot,
    yoyoBody: Physics.getRatBody(),
    targetBodies: Physics.getTargetBodies(),
    bumperBodies: Physics.getBumperBodies(),
    fragmentBodies: Physics.getFragmentBodies(),
    stringConstraint: constraint,
    ropeBodies: Physics.getRopeBodies(),
    angularSpeed,
    hpFraction: ratHp / RAT_MAX_HP,
    hitCount,
    comboCount,
    hitLabel: { ...hitLabel, alpha: hitLabel.timer / HIT_LABEL_DURATION },
    shake: shakeTimer > 0 ? shakeIntensity * (shakeTimer / SHAKE_DURATION) : 0,
    flash: flashTimer > 0,
    squash: squashTimer > 0 ? squashTimer / SQUASH_DURATION : 0,
  });
}

function showResult() {
  stopWhoosh();
  Renderer.clearTrail();
  Input.detachFromCanvas();
  Physics.removeRat();

  Telemetry.endRun({ outcome: lastOutcome, score: lastScore, hitCount });

  const level = currentLevel();
  saveProgress(currentLevelId, lastScore);

  const nextLevel = LEVELS.find(l => l.id === currentLevelId + 1);
  const isLastLevel = currentLevelId === LEVELS.length;
  const gameClear = lastOutcome === 'SHATTER' && isLastLevel;
  const actClear = lastOutcome === 'SHATTER' && !isLastLevel && (!nextLevel || nextLevel.act !== level.act);

  const parScore = level.pushParScore || 1500;
  UI.showResult(lastOutcome, lastScore, parScore, actClear, gameClear);
  UI.setNextVisible(currentLevelId < LEVELS.length);
  UI.setHint('');
}

// Initial state
UI.buildLevelSelect(LEVELS, loadProgress());
UI.showLevelSelect();
UI.setHint('');
requestAnimationFrame(gameLoop);

// Hand the dev harness the module-scope internals it needs, rather than
// leaking them onto window for it to find (L0105, L0133).
if (DEV) {
  const { initDev } = await import('./dev/harness.js');
  initDev({
    canvas,
    getState: () => ({
      gameState, level: currentLevelId, variant: selectedVariant,
      hp: ratHp, maxHp: RAT_MAX_HP, hitCount, comboCount,
      stringLength, pivot: { ...pivot },
    }),
    setFixedDt: s => { devFixedDt = s; },
    setRopeSegments: n => { ropeSegments = n; },
    setRopeConfig: cfg => Physics.setRopeConfig(cfg),
    setSubSteps: n => Physics.setSubSteps(n),
    setHandMaxStep: n => Physics.setHandMaxStep(n),
    getHandMaxStep: () => Physics.getHandMaxStep(),
    getRopeSegments: () => ropeSegments,
    beginRun({ level, variant, source, seed }) {
      currentLevelId = level;
      selectedVariant = variant;
      devSource = source;
      devSeed = seed;
      UI.hideResult();
      UI.hideLevelSelect();
      startLevel();
    },
  });
}
