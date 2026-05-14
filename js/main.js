import * as Physics from './physics.js';
import * as Input from './input.js';
import * as Renderer from './renderer.js';
import * as Particles from './particles.js';
import * as UI from './ui.js';
import { YOYO_VARIANTS } from './yoyo.js';
import { LEVELS, getLevel, saveProgress } from './levels.js';

const canvas = document.getElementById('game-canvas');
const CANVAS_W = 900;
const CANVAS_H = 540;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

// --- State machine ---
// States: PICKER | IDLE_ARMED | SWINGING | RELEASED | IMPACT | RESULT
let gameState = 'PICKER';
let currentLevelId = 1;
let selectedVariant = 'standard';
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

function getLevel_() {
  return getLevel(currentLevelId);
}

function computePivot(level) {
  return {
    x: level.pivot.x * CANVAS_W,
    y: level.pivot.y * CANVAS_H,
  };
}

function calcScore(outcome, speed, material) {
  const base = outcome === 'SHATTER' ? 1000 : outcome === 'CRACK' ? 300 : 0;
  const speedBonus = Math.floor(speed / 8);
  return base + speedBonus;
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

UI.onVariantChange(v => { selectedVariant = v; });

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
Physics.on('yoyo-hit-target', ({ target, yoyo, outcome, speed, hitPoint, material }) => {
  if (gameState !== 'RELEASED') return;
  gameState = 'IMPACT';
  lastOutcome = outcome;

  const variant = YOYO_VARIANTS[yoyo.plugin?.variantKey || 'standard'];
  lastScore = calcScore(outcome, speed, material);

  // Apply break
  Physics.applyBreak(target, outcome, hitPoint, variant.blastBonus);

  // Particles
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
  const yoyoBody = Physics.getYoyoBody();
  if (yoyoBody) {
    Matter.Body.setPosition(yoyoBody, { x, y });
    Matter.Body.setVelocity(yoyoBody, { x: 0, y: 0 });
    Renderer.updateTrail(x, y);
    Renderer.updateSpin(angularVelocity, 1 / 60);
  }
});

Input.onRelease(({ vx, vy, speed, angle }) => {
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
  const level = getLevel_();
  pivot = computePivot(level);
  stringLength = level.stringLength;
  spinAccum = 0;

  Physics.reset();
  Particles.clear();
  Renderer.clearTrail();

  // Spawn targets
  Physics.spawnTargets(level.targets, level.pivot.x, level.pivot.y);

  // Spawn yoyo at rest below pivot
  const startX = pivot.x;
  const startY = pivot.y + stringLength;
  const yoyoBody = Physics.spawnYoyo(startX, startY, selectedVariant);
  Physics.attachString(pivot.x, pivot.y, stringLength);

  // Setup input
  Input.init(canvas, pivot, stringLength, selectedVariant);
  Input.attachToCanvas(canvas);

  UI.hidePicker();
  UI.setHint(level.hint || 'Hold mouse button and move in circles to build speed!');

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
  }

  // State-specific logic
  if (gameState === 'RELEASED') {
    aimGuideTimer -= dt;
    if (aimGuideTimer <= 0) aimPoints = null;

    // Keep yoyo within bounds (cap speed to avoid tunneling)
    const yoyo = Physics.getYoyoBody();
    if (yoyo) {
      const spd = Math.sqrt(yoyo.velocity.x ** 2 + yoyo.velocity.y ** 2);
      const maxSpd = YOYO_VARIANTS[selectedVariant].maxSpeed;
      if (spd > maxSpd) {
        Matter.Body.setVelocity(yoyo, {
          x: (yoyo.velocity.x / spd) * maxSpd,
          y: (yoyo.velocity.y / spd) * maxSpd,
        });
      }
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

  // Render
  const level = getLevel_();
  const angularSpeed = gameState === 'SWINGING' ? Input.getAngularSpeed() : 0;

  Renderer.draw({
    state: gameState,
    level,
    pivot,
    yoyoBody: Physics.getYoyoBody(),
    targetBodies: Physics.getTargetBodies(),
    fragmentBodies: Physics.getFragmentBodies(),
    stringConstraint: Physics.getStringConstraint(),
    angularSpeed,
    aimPoints: aimGuideTimer > 0 ? aimPoints : null,
  });
}

function showResult() {
  Renderer.clearTrail();
  Input.detachFromCanvas();
  Physics.removeYoyo();

  const level = getLevel_();
  saveProgress(currentLevelId, lastScore);

  UI.showResult(lastOutcome, lastScore, level.parScore);
  UI.setNextVisible(currentLevelId < LEVELS.length);
  UI.setHint('');
}

// Initial state
UI.showPicker();
UI.setHint('Choose your yoyo and click Launch!');
requestAnimationFrame(gameLoop);
