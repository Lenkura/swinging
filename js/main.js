import * as Physics from './physics.js';
import * as Input from './input.js';
import * as Renderer from './renderer.js';
import * as Particles from './particles.js';
import * as UI from './ui.js';
import { YOYO_VARIANTS } from './yoyo.js';
import { LEVELS, getLevel, saveProgress } from './levels.js';
import { generateCrackPattern } from './target.js';

const canvas = document.getElementById('game-canvas');
const CANVAS_W = 1100;
const CANVAS_H = 620;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// --- State machine ---
// States: PICKER | IDLE_ARMED | SWINGING | RELEASED | IMPACT | RESULT
const YOYO_MAX_HP = 100;

let gameState = 'PICKER';
let currentLevelId = 1;
let selectedVariant = 'standard';
let selectedMode = 'push'; // 'swing' | 'push' — synced from UI.getSelectedMode() on init
let yoyoHp = YOYO_MAX_HP;
let hitCount = 0;
let hitCooldown = 0;
let comboCount = 0;
let comboTimer = 0;
const COMBO_WINDOW = 1.0;
let lastTime = null;
let pivot = { x: 0, y: 0 };
let stringLength = 130;
let lastOutcome = null;
let lastScore = 0;
let impactTimer = 0;
const AIM_GUIDE_DURATION = 0.35;
let aimGuideTimer = 0;
let aimPoints = null;
let spinAccum = 0; // accumulated spin angle for renderer

function currentLevel() {
  return getLevel(currentLevelId);
}

function computePivot(level) {
  return {
    x: level.pivot.x * CANVAS_W,
    y: level.pivot.y * CANVAS_H,
  };
}

function calcScore(outcome, speed, material, angleFactor = 1.0) {
  const base = outcome === 'SHATTER' ? 1000 : outcome === 'CRACK' ? 300 : 0;
  const speedBonus = Math.floor(speed / 8);
  return Math.floor((base + speedBonus) * angleFactor);
}

function calcPushScore(hits) {
  return Math.max(200, 3000 - (hits - 1) * 500);
}

function computeAimPoints(vx, vy, x0, y0) {
  // Matter.js: gravity.y=1.5, gravity.scale=0.001, engine steps in ms
  // effective px/s^2 ≈ 1500
  const g = 1500;
  const pts = [];
  for (let i = 0; i < 22; i++) {
    const t = i * 0.025;
    pts.push({ x: x0 + vx * t, y: y0 + vy * t + 0.5 * g * t * t });
  }
  return pts;
}

// --- Setup ---
Physics.init(CANVAS_W, CANVAS_H);
Physics.installReleaseHook();
Renderer.init(canvas);
UI.init();
selectedMode = UI.getSelectedMode();

UI.onVariantChange(v => { selectedVariant = v; });
UI.onModeChange(m => { selectedMode = m; });

UI.onStart(variant => {
  selectedVariant = variant;
  startLevel();
});

UI.onRetry(() => {
  UI.hideResult();
  startLevel();
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
  const variant = YOYO_VARIANTS[yoyo.plugin?.variantKey || 'standard'];

  if (selectedMode === 'push') {
    if (gameState !== 'SWINGING' || hitCooldown > 0) return;

    const comboMultiplier = Math.min(1 + comboCount * 0.5, 3.0);
    comboCount++;
    comboTimer = COMBO_WINDOW;

    const damage = speed * af * (material.yoyoDamage || 1.0) * (yoyo.plugin.impactMultiplier || 1.0) * comboMultiplier / 50;
    yoyoHp = Math.max(0, yoyoHp - damage);
    hitCount++;
    hitCooldown = 0.35;

    // Progressive crack visuals
    const hpFrac = yoyoHp / YOYO_MAX_HP;
    yoyo.plugin.cracked = hpFrac < 1.0;
    const crackCount = hpFrac < 0.25 ? 12 : hpFrac < 0.5 ? 8 : hpFrac < 0.75 ? 4 : 0;
    if (crackCount > 0) yoyo.plugin.crackPattern = generateCrackPattern(crackCount);

    Particles.emit(hitPoint.x, hitPoint.y, {
      count: 6,
      color: variant.color,
      speed: 180,
      radius: 3,
    });

    if (yoyoHp <= 0) {
      gameState = 'IMPACT';
      lastOutcome = 'SHATTER';
      lastScore = calcPushScore(hitCount);
      Physics.applyBreak(yoyo, 'SHATTER', hitPoint, variant.blastBonus);
      Particles.emit(hitPoint.x, hitPoint.y, { count: 20, color: variant.color, speed: 350, radius: 5 });
      impactTimer = 0.85;
    }
    return;
  }

  // Fling mode
  if (gameState !== 'RELEASED') return;
  gameState = 'IMPACT';
  lastOutcome = outcome;
  lastScore = calcScore(outcome, speed, material, af);
  Physics.applyBreak(yoyo, outcome, hitPoint, variant.blastBonus);

  const colors = { SHATTER: ['#a8d8ea','#fff','#90e0ef'], CRACK: ['#c4a265','#8b6914','#fff'], SURVIVE: ['#8a9ba8','#adb5bd'] };
  const count = outcome === 'SHATTER' ? 20 : outcome === 'CRACK' ? 10 : 5;
  Particles.emit(hitPoint.x, hitPoint.y, {
    count,
    color: (colors[outcome] || ['#fff'])[Math.floor(Math.random() * 3)],
    speed: outcome === 'SHATTER' ? 350 : 200,
    radius: outcome === 'SHATTER' ? 5 : 3,
  });

  impactTimer = 0.85;
});

// Input callbacks
Input.onSwing(({ x, y, angle, angularVelocity }) => {
  if (gameState !== 'SWINGING') return;
  Physics.setYoyoPosition(x, y);
  Physics.setYoyoVelocity(0, 0);
  Renderer.updateTrail(x, y);
  Renderer.updateSpin(angularVelocity, 1 / 60);
});

Input.onPivotMove(({ x, y }) => {
  if (gameState !== 'SWINGING') return;
  Physics.updatePivot(x, y);
});

Input.onRelease(({ vx, vy }) => {
  if (gameState !== 'SWINGING') return;
  gameState = 'RELEASED';
  Renderer.clearTrail();
  Input.detachFromCanvas();

  const yoyoBody = Physics.getYoyoBody();
  if (yoyoBody) {
    aimPoints = computeAimPoints(vx, vy, yoyoBody.position.x, yoyoBody.position.y);
  }
  aimGuideTimer = AIM_GUIDE_DURATION;
  Physics.scheduleRelease(vx, vy);
});

function startLevel() {
  const level = currentLevel();
  pivot = computePivot(level);
  stringLength = level.stringLength;
  spinAccum = 0;

  yoyoHp = YOYO_MAX_HP;
  hitCount = 0;
  hitCooldown = 0;
  comboCount = 0;
  comboTimer = 0;

  Physics.reset();
  Particles.clear();
  Renderer.clearTrail();

  // Spawn targets
  Physics.spawnTargets(level.targets, level.pivot.x, level.pivot.y);

  // Spawn yoyo and setup input based on mode
  if (selectedMode === 'push') {
    const psl = level.pushStringLength || stringLength;
    Physics.spawnYoyo(pivot.x, pivot.y + psl, selectedVariant);
    Physics.attachString(pivot.x, pivot.y, psl, 0.65);
    Input.init(canvas, pivot, psl, selectedVariant, 'push');
  } else {
    const startX = pivot.x;
    const startY = pivot.y + stringLength;
    Physics.spawnYoyo(startX, startY, selectedVariant);
    Physics.attachString(pivot.x, pivot.y, stringLength);
    Input.init(canvas, pivot, stringLength, selectedVariant, 'swing');
  }
  Input.attachToCanvas(canvas);

  UI.hidePicker();
  if (selectedMode === 'push') {
    UI.setHint('Hold the mouse to grab the string anchor. Swing the yoyo, then release!');
  } else {
    UI.setHint(level.hint || 'Hold mouse button and move in circles to build speed!');
  }

  gameState = 'SWINGING';
  lastOutcome = null;
  lastScore = 0;
  aimPoints = null;
  aimGuideTimer = 0;
  impactTimer = 0;
}

// --- Game Loop ---
function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (lastTime === null) { lastTime = timestamp; return; }
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  // Physics step (all states except PICKER/RESULT where physics needn't run)
  if (gameState !== 'PICKER' && gameState !== 'RESULT') {
    Physics.step(dt * 1000);
    Particles.update(dt);
    if (hitCooldown > 0) hitCooldown -= dt;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) comboCount = 0;
    }
  }

  // State-specific logic
  if (gameState === 'RELEASED') {
    aimGuideTimer -= dt;
    if (aimGuideTimer <= 0) aimPoints = null;

    // Keep yoyo within bounds (cap speed to avoid tunneling)
    const yoyo = Physics.getYoyoBody();
    if (yoyo) {
      Physics.clampYoyoSpeed(YOYO_VARIANTS[selectedVariant].maxSpeed);
      Renderer.updateTrail(yoyo.position.x, yoyo.position.y);

      // Off-screen without hitting anything → RESULT with survive
      if (yoyo.position.x < -100 || yoyo.position.x > CANVAS_W + 100 ||
          yoyo.position.y > CANVAS_H + 100) {
        gameState = 'RESULT';
        lastOutcome = 'SURVIVE';
        lastScore = 0;
        showResult();
      }
    }
  }

  if (gameState === 'IMPACT') {
    impactTimer -= dt;
    if (impactTimer <= 0) {
      gameState = 'RESULT';
      showResult();
    }
  }

  // Push mode: update trail and spin from physics body during swing
  if (selectedMode === 'push' && gameState === 'SWINGING') {
    const yb = Physics.getYoyoBody();
    if (yb) {
      Renderer.updateTrail(yb.position.x, yb.position.y);
      Renderer.updateSpin(yb.angularVelocity * 60, 1 / 60);
    }
  }

  // Render
  const level = currentLevel();
  let angularSpeed = 0;
  if (gameState === 'SWINGING') {
    if (selectedMode === 'push') {
      const yb = Physics.getYoyoBody();
      if (yb) {
        const spd = Math.sqrt(yb.velocity.x ** 2 + yb.velocity.y ** 2);
        angularSpeed = Math.min(spd / YOYO_VARIANTS[selectedVariant].maxSpeed, 1);
      }
    } else {
      angularSpeed = Input.getAngularSpeed();
    }
  }

  // In push mode, pass the constraint anchor as pivot so string + hand draw at mouse position
  const constraint = Physics.getStringConstraint();
  const displayPivot = (selectedMode === 'push' && constraint) ? constraint.pointA : pivot;

  Renderer.draw({
    state: gameState,
    mode: selectedMode,
    level,
    pivot: displayPivot,
    yoyoBody: Physics.getYoyoBody(),
    targetBodies: Physics.getTargetBodies(),
    fragmentBodies: Physics.getFragmentBodies(),
    stringConstraint: constraint,
    angularSpeed,
    aimPoints: aimGuideTimer > 0 ? aimPoints : null,
    hpFraction: yoyoHp / YOYO_MAX_HP,
    hitCount,
    comboCount,
  });
}

function showResult() {
  Renderer.clearTrail();
  Input.detachFromCanvas();
  Physics.removeYoyo();

  const level = currentLevel();
  saveProgress(currentLevelId, lastScore);

  const parScore = selectedMode === 'push' ? (level.pushParScore || 1500) : level.parScore;
  UI.showResult(lastOutcome, lastScore, parScore);
  UI.setNextVisible(currentLevelId < LEVELS.length);
  UI.setHint('');
}

// Initial state
UI.showPicker();
UI.setHint('Choose your yoyo and click Launch!');
requestAnimationFrame(gameLoop);
