import * as Physics from './physics.js';
import * as Input from './input.js';
import * as Renderer from './renderer.js';
import * as Particles from './particles.js';
import * as UI from './ui.js';
import { RAT_VARIANTS } from './rat.js';
import { LEVELS, getLevel, saveProgress, loadProgress } from './levels.js';
import { generateCrackPattern, applyDamageCap } from './target.js';
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
// Segmented rope. Now the default tail for every player. The dev override
// (?dev=1&rope=0 for the old single constraint, or another segment count)
// is kept because dev/ab.mjs and future tuning need to compare against it.
const ROPE_SEGMENTS = 10;
let ropeSegments = ROPE_SEGMENTS;
// Dev knobs, all defaulting to current behaviour: ?dev=1&rope=10&hand=40&subs=4
if (DEV) {
  const q = new URLSearchParams(location.search);
  if (q.has('rope')) ropeSegments = Number(q.get('rope')) || 0;
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
// States: PICKER | READY | SWINGING | IMPACT | RESULT
// READY is the pick-up beat: the rat lies on the ground with its tail sprawled
// beside it and the rope built but NOT anchored, waiting to be grabbed. It also
// removes the jolt that used to open every level - the pivot teleported from
// the level position to wherever the cursor happened to be on the first
// pointermove, whipping the rat. After a grab the pointer IS the pivot, so
// there is no jump left to make.
const GRAB_RADIUS = 44;   // the tail tip is a 5px body; this is a touch target
const RAT_MAX_HP = 100;
// px²·step⁻² per HP — raise to nerf damage, lower to buff.
// TUNING GROUP: three feedback constants below are expressed in raw damage units and so
// are derived from this value — damageIntensity's 600, SHAKE_GATE (180) and the /120 shake
// divisor. Lowering DAMAGE_SCALE raises damage, so those three scale in the SAME direction
// by the SAME factor, in the same commit. At DAMAGE_SCALE 200 they were 240, 120 and 80.
// Those three read rawDamage, NOT the capped value (see applyDamageCap in target.js), so
// the per-hit cap does not silently mute them - it bounds play, not feel.
const DAMAGE_SCALE = 80;
// Screen shake and hit-stop fire above this raw damage. Set at the measured p90 of human
// hits (182 over 880 hits, 2026-09-19), so roughly one hit in ten shakes: an event, not a
// constant. It was 300, which fired on 3.9% of hits - while 54.5% of hits were taking the
// full capped 40 HP, so the hits doing the most visible damage to the HP bar mostly got no
// shake at all. See task 136.
const SHAKE_GATE = 180;

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
// A severed tail keeps bleeding through the tumble. Held as a countdown rather
// than a one-shot burst because the loss is given 2.6s to land (see the
// rope-cut handler) and a single puff at t=0 is over before the rat has fallen.
let bleedTimer = 0;
let bleedTick = 0;
let flashTimer = 0;
let squashTimer = 0;
const FLASH_DURATION = 0.05;
const SQUASH_DURATION = 0.12;
let lastTime = null;
let pivot = { x: 0, y: 0 };
// Where the loose tail tip was spawned, so READY can highlight it. Null on the
// rope=0 dev path, which has no rope and starts swinging immediately.
let tailTip = null;
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

// Square root, not linear. Raw damage is heavily right-skewed (880 human hits: p25 21,
// p50 46, p90 182, max 1015), and a linear raw/600 left the median hit at 0.08 intensity
// with 59% of hits below 0.10 - the burst scaling was effectively dead. The root spreads
// the common range (p50 0.28, p90 0.55) while monster hits still saturate on top.
function damageIntensity(damage) {
  return Math.min(Math.sqrt(Math.max(damage, 0) / 600), 1); // 600 is in the tuning group
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
Physics.on('yoyo-hit-target', ({ target, yoyo, speed, hitPoint, material, angleFactor }) => {
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

    // rawDamage drives how the hit FEELS - shake, hit-stop, particle burst - and
    // is deliberately unbounded, so a monster swing still reads as one. Only the
    // HP subtraction is capped, which is what stops a single hit ending a level.
    const rawDamage = speed * speed * af * (material.yoyoDamage || 1.0) * (yoyo.plugin.impactMultiplier || 1.0) * cm / DAMAGE_SCALE;
    const damage = applyDamageCap(rawDamage, RAT_MAX_HP);
    ratHp = Math.max(0, ratHp - damage);
    hitCount++;
    hitCooldown = 0.35;
    playHit(target.plugin.materialKey, Math.min(rawDamage / RAT_MAX_HP, 1), comboCount);
    playComboTone(comboCount);

    Telemetry.recordHit({
      kind: 'damage', speed, angleFactor: af, material: target.plugin.materialKey,
      // Both, on purpose: once damage is capped it reads as a flat ceiling, and
      // the tail that justified the cap would be invisible to the next analysis.
      damage, rawDamage, combo: comboCount, multiplier: cm, hpAfter: ratHp, hitIndex: hitCount,
    });

    if (af < 0.55) {
      hitLabel = { text: 'GLANCING!', x: hitPoint.x, y: hitPoint.y, timer: HIT_LABEL_DURATION, color: '#f4a261' };
    } else if (af > 0.88) {
      hitLabel = { text: 'CLEAN HIT!', x: hitPoint.x, y: hitPoint.y, timer: HIT_LABEL_DURATION, color: '#80ffdb' };
    }

    // Feedback reads rawDamage, not the capped value: these three constants were
    // tuned against raw damage and still are, so the cap changes how the game
    // PLAYS without changing how a big hit LOOKS.
    const intensity = damageIntensity(rawDamage);
    flashTimer = FLASH_DURATION;
    squashTimer = SQUASH_DURATION;

    if (rawDamage > SHAKE_GATE) {
      // /120 keeps the shake at the gate at 1.5px, as /200 did at the old gate of
      // 300. Left at /200 the new gate would open on a 0.9px shake nobody can see.
      shakeIntensity = Math.min(rawDamage / 120, 10);
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
      lastScore = calcPushScore(hitCount, RAT_VARIANTS[selectedVariant].parHits);
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
// The yank is not a convenience: with the rope, Level 8 is unwinnable without
// it (measured 6/6 failures, zero hits). Nothing else in the game teaches it,
// so a prompt appears exactly when the player needs it.
const SNAG_SPEED = 25;      // px/step below which the swing is going nowhere
const SNAG_SECONDS = 2.5;
let stuckTimer = 0;
let snagHintShown = false;
Input.onYank(pos => {
  // In READY the same press is the pick-up, not a yank. Edge-triggered on the
  // press rather than on the pointer merely being over the tail (L0081).
  if (gameState === 'READY') { grabTail(pos.x, pos.y); return; }
  if (gameState !== 'SWINGING' || yankCooldown > 0) return;
  if (Physics.yankRope()) {
    yankCooldown = YANK_COOLDOWN;
    yankCount++;
  }
});

// A blade has severed the tail. This is the game's only losing outcome: the rat
// survives, which is precisely the problem, since killing it is how you win.
Physics.on('rope-cut', ({ x, y, speed, cutSpeed }) => {
  if (gameState !== 'SWINGING') return;
  gameState = 'IMPACT';
  lastOutcome = 'FAILED';
  lastScore = 0;
  stopWhoosh();
  // Recorded so cutSpeed can be calibrated from the speeds that actually cut,
  // rather than from cut/no-cut counts alone.
  Telemetry.recordHit({
    kind: 'rope-cut', speed, cutSpeed, hitIndex: hitCount, hpAfter: ratHp,
  });
  hitLabel = { text: 'TAIL CUT!', x, y, timer: HIT_LABEL_DURATION, color: '#ff5d5d' };

  // Arterial spray, aimed back along the tail - away from the rat, out of the
  // cut - rather than scattered, so it reads as a wound rather than a puff.
  // Three layers at one angle: heavy gouts, a fast fine mist, and a dark
  // spatter that lingers.
  const rat = Physics.getRatBody();
  const away = rat ? Math.atan2(y - rat.position.y, x - rat.position.x) : -Math.PI / 2;
  Particles.emit(x, y, { count: 18, color: '#b0202a', speed: 300, radius: 4, lifetime: 0.9, direction: away, spread: 1.1 });
  Particles.emit(x, y, { count: 22, color: '#ff5d5d', speed: 420, radius: 2, lifetime: 0.6, direction: away, spread: 0.7 });
  Particles.emit(x, y, { count: 10, color: '#7a1119', speed: 180, radius: 5, lifetime: 1.3, direction: away, spread: 2.0 });
  bleedTimer = 1.6;
  bleedTick = 0;

  shakeIntensity = 6;
  shakeTimer = SHAKE_DURATION;
  // A loss gets a longer beat than a win: the rat is sent tumbling and physics
  // keeps running through IMPACT, so it falls and bounces before the panel
  // appears. 0.85s - the shatter timing - cut straight to the result and gave
  // the only losing outcome in the game no weight at all.
  Physics.tumbleRat();
  impactTimer = 2.6;
});

// Input callbacks
Input.onPivotMove(({ x, y }) => {
  if (gameState !== 'SWINGING') return;
  // Confined to the level's movement zone, if it declares one. Levels without a
  // handZone are unaffected, so this is inert until a level opts in.
  const p = Input.clampToZone(x, y, currentLevel().handZone, CANVAS_W, CANVAS_H);
  Physics.updatePivot(p.x, p.y);
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
  stuckTimer = 0;
  snagHintShown = false;
  hitCooldown = 0;
  comboCount = 0;
  comboTimer = 0;
  hitLabel = { text: '', x: 0, y: 0, timer: 0, color: '#fff' };
  shakeTimer = 0;
  shakeIntensity = 0;
  hitStopTimer = 0;
  flashTimer = 0;
  squashTimer = 0;
  bleedTimer = 0;
  bleedTick = 0;

  Physics.reset();
  Particles.clear();
  Renderer.clearTrail();
  Renderer.clearDecals();

  // Spawn targets and bumpers
  Physics.spawnTargets(level.targets, level.shieldSpeedScale ?? 1);
  Physics.spawnBumpers(level.bumpers || []);
  Physics.spawnBlades(level.blades || []);

  // Spawn rat and setup push-mode input
  const psl = level.pushStringLength || stringLength;
  const variant = RAT_VARIANTS[selectedVariant];
  const grabStart = ropeSegments > 0;

  if (grabStart) {
    // Slumped on the ground, tail sprawled toward the targets - that is where
    // the room is, since pivots sit at x 220-264 and the nearest target at 638.
    const ratX = pivot.x;
    const ratY = Physics.getGroundTop() - variant.radius;
    Physics.spawnRat(ratX, ratY, selectedVariant);
    // Tail base in body-local space, matching buildRope's pointB and drawRat.
    const tailBaseX = ratX - variant.radius * 0.85;
    const tailBaseY = ratY + variant.radius * 0.22;
    // buildRope lays segment 0 (the hand end) at the origin and runs the chain
    // toward the rat, so the origin is the far tip and the direction points back.
    tailTip = { x: tailBaseX + psl, y: tailBaseY };
    Physics.buildRope(tailTip.x, tailTip.y, psl, ropeSegments, undefined, -1, 0);
    Physics.freezeForGrab();
  } else {
    // ?dev=1&rope=0 keeps the pre-rope single constraint AND the old immediate
    // start, so dev/ab.mjs still compares like with like.
    tailTip = null;
    Physics.spawnRat(pivot.x, pivot.y + psl, selectedVariant);
    Physics.attachString(pivot.x, pivot.y, psl, 0.35);
  }
  Input.init(canvas, pivot);
  Input.attachToCanvas(canvas);

  UI.hidePicker();
  lastOutcome = null;
  lastScore = 0;
  impactTimer = 0;

  if (grabStart) {
    gameState = 'READY';
    UI.setHint('Grab the rat by the tail to pick it up!');
  } else {
    beginSwinging();
  }
}

/** Hand control to the player: telemetry starts here, not at spawn. */
function beginSwinging() {
  const level = currentLevel();
  UI.setHint(level.hint || 'Move the mouse to swing the rat! Chain hits for a combo bonus.');
  Telemetry.startRun({
    level: level.id, levelName: level.name, variant: selectedVariant,
    source: devSource, seed: devSeed,
  });
  startWhoosh();
  gameState = 'SWINGING';
}

/**
 * The pick-up. Anchors the rope at the pointer, so the hand starts exactly
 * where the player pressed and the rat is hauled up by the rope going taut
 * rather than by any animation.
 */
function grabTail(x, y) {
  if (gameState !== 'READY') return false;
  const rope = Physics.getRopeBodies();
  if (!rope.length) return false;
  if (!Input.isGrabHit({ x, y }, rope[0].position, GRAB_RADIUS)) return false;
  Physics.anchorRope(x, y);
  Input.setPivot({ x, y });
  pivot = { x, y };
  beginSwinging();
  return true;
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

  // The stump. Emitted from the rat's tail base as it tumbles, in pulses rather
  // than a stream - a steady trickle reads as a leak, a pulse reads as a heart.
  // Weakens as it runs out, and paints the ground where it lands.
  if (bleedTimer > 0) {
    bleedTimer -= dt;
    bleedTick -= dt;
    const rat = Physics.getRatBody();
    if (rat && bleedTick <= 0) {
      bleedTick = 0.1;
      const strength = Math.max(0, bleedTimer / 1.6);
      const r = RAT_VARIANTS[selectedVariant].radius;
      // Tail base offset, rotated with the body - the same anchor the rope hung
      // from (physics.js attachRope: -r*0.85, r*0.22).
      const ca = Math.cos(rat.angle), sa = Math.sin(rat.angle);
      const bx = rat.position.x + (-r * 0.85) * ca - (r * 0.22) * sa;
      const by = rat.position.y + (-r * 0.85) * sa + (r * 0.22) * ca;
      Particles.emit(bx, by, {
        // Slow and short-lived on purpose: at spray speed the droplets outran
        // the rat and freckled the whole arena, which read as dust rather than
        // blood. These trail the body instead.
        count: Math.round(3 + 5 * strength), color: '#b0202a',
        speed: 50 + 90 * strength, radius: 3, lifetime: 0.5,
        direction: rat.angle + Math.PI, spread: 1.4,
      });
      // Only pool where blood could actually have landed. paintSplat always
      // paints at the ground line, so calling it while the rat is still high
      // put splats under a body that had not bled on that spot yet.
      if (rat.position.y > Physics.getGroundTop() - 90) {
        Renderer.paintSplat(bx, 0.25 * strength, 0.5);
      }
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

  // Snag prompt: slow and not landing hits for a while means the rope is
  // caught. Cleared as soon as the swing recovers, and never shown again once
  // the player has yanked - they know the move by then.
  if (gameState === 'SWINGING') {
    if (ratSpeed < SNAG_SPEED) stuckTimer += dt; else stuckTimer = 0;
    if (stuckTimer > SNAG_SECONDS && !snagHintShown && yankCount === 0) {
      UI.setHint('Rope snagged? Click to yank it free.');
      snagHintShown = true;
    } else if (stuckTimer === 0 && snagHintShown) {
      UI.setHint(currentLevel().hint || 'Move the mouse to swing the rat! Chain hits for a combo bonus.');
      snagHintShown = false;
    }
  }

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
    bladeBodies: Physics.getBladeBodies(),
    fragmentBodies: Physics.getFragmentBodies(),
    stringConstraint: constraint,
    ropeBodies: Physics.getRopeBodies(),
    grabTip: gameState === 'READY' ? (Physics.getRopeBodies()[0]?.position ?? tailTip) : null,
    handZone: level.handZone ?? null,
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
  saveProgress(currentLevelId, lastScore, { completed: lastOutcome === 'SHATTER' });

  const nextLevel = LEVELS.find(l => l.id === currentLevelId + 1);
  const isLastLevel = currentLevelId === LEVELS.length;
  const gameClear = lastOutcome === 'SHATTER' && isLastLevel;
  const actClear = lastOutcome === 'SHATTER' && !isLastLevel && (!nextLevel || nextLevel.act !== level.act);

  const parScore = level.pushParScore || 1500;
  UI.showResult(lastOutcome, lastScore, parScore, actClear, gameClear);
  // Not offered after a loss. saveProgress already refuses to unlock a failed
  // level, but onNext loads currentLevelId + 1 directly without consulting
  // unlockedLevel - so leaving the button visible would let the player walk
  // straight past the guard, and it rendered as the primary action.
  UI.setNextVisible(lastOutcome === 'SHATTER' && currentLevelId < LEVELS.length);
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
      // Bots drive the pointer, not the picker, so they auto-grab and every rig
      // (gate, batch, ab) keeps working without knowing READY exists.
      const rope = Physics.getRopeBodies();
      if (gameState === 'READY' && rope.length) {
        grabTail(rope[0].position.x, rope[0].position.y);
      }
    },
  });
}
