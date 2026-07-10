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
  Physics.attachString(pivot.x, pivot.y, psl, 0.35);
  Input.init(canvas, pivot);
  Input.attachToCanvas(canvas);

  UI.hidePicker();
  UI.setHint(level.hint || 'Move the mouse to swing the rat! Chain hits for a combo bonus.');

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
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
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
      if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) comboCount = 0;
      }
    }
    Particles.update(dt);
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
  if (gameState === 'SWINGING') {
    const yb = Physics.getRatBody();
    if (yb) {
      const spd = Math.sqrt(yb.velocity.x ** 2 + yb.velocity.y ** 2);
      angularSpeed = Math.min(spd / RAT_VARIANTS[selectedVariant].pushMaxSpeed, 1);
    }
  }
  updateWhoosh(angularSpeed);

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
