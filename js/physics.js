import { MATERIALS, evaluateImpact, generateCrackPattern } from './target.js';
import { RAT_VARIANTS } from './rat.js';

const { Engine, Bodies, Body, Composite, Constraint, Events, World } = Matter;

// --- Collision categories ------------------------------------------------
// Matter allows a pair only when BOTH filters agree:
//   (a.mask & b.category) && (b.mask & a.category)
// so every intended pair has to be declared from both sides. Ground and walls
// previously set no collisionFilter at all and inherited Matter's default
// category 0x0001 - the same bit the rat uses - which is why the rat fell
// through floors and why rope could not be made to hit world geometry without
// also hitting the rat it hangs from. 0x0008 appeared in the fragment mask but
// was never assigned to any body; it is gone.
export const CAT = {
  RAT: 0x0001,
  TARGET: 0x0002,   // targets and bumpers
  FRAGMENT: 0x0004,
  ROPE: 0x0010,
  WORLD: 0x0020,    // ground and walls
};

// Intended pairs:
//   rat      x target, world
//   fragment x world, fragment
//   rope     x world, target        (never rope-rope, never rope-rat)
const MASK = {
  RAT: CAT.TARGET | CAT.WORLD,
  TARGET: CAT.RAT | CAT.ROPE,
  FRAGMENT: CAT.WORLD | CAT.FRAGMENT,
  ROPE: CAT.WORLD | CAT.TARGET,
  WORLD: CAT.RAT | CAT.FRAGMENT | CAT.ROPE,
};

let engine, world;
let ratBody = null;
let stringConstraint = null;
let targetBodies = [];
let fragmentBodies = [];
let bumperBodies = [];
let ropeBodies = [];
let ropeConstraints = [];
let ropeContactCount = 0;
let groundBody, leftWall, rightWall;
let canvasW, canvasH;

const eventListeners = {};

export function on(event, fn) {
  if (!eventListeners[event]) eventListeners[event] = [];
  eventListeners[event].push(fn);
}

function emit(event, data) {
  (eventListeners[event] || []).forEach(fn => fn(data));
}

export function init(width, height) {
  canvasW = width;
  canvasH = height;

  engine = Engine.create({
    gravity: { x: 0, y: 1.5 },
    positionIterations: 12,
    velocityIterations: 8,
  });
  world = engine.world;

  groundBody = Bodies.rectangle(width / 2, height + 25, width * 3, 50, {
    isStatic: true, label: 'ground', friction: 0.6, restitution: 0.2,
    collisionFilter: { category: CAT.WORLD, mask: MASK.WORLD },
  });
  const wallOpts = { isStatic: true, label: 'wall', collisionFilter: { category: CAT.WORLD, mask: MASK.WORLD } };
  leftWall = Bodies.rectangle(-25, height / 2, 50, height * 2, wallOpts);
  rightWall = Bodies.rectangle(width + 25, height / 2, 50, height * 2, wallOpts);
  Composite.add(world, [groundBody, leftWall, rightWall]);

  Events.on(engine, 'collisionStart', onCollision);
}

function onCollision(event) {
  for (const pair of event.pairs) {
    const { bodyA, bodyB } = pair;
    const isYoyoA = bodyA.label === 'rat';
    const isYoyoB = bodyB.label === 'rat';
    const isTargetA = bodyA.label === 'target';
    const isTargetB = bodyB.label === 'target';

    // Rope touching an obstacle. Counted rather than acted on: the wrap
    // itself is pure physics, this only tells us how often it happens.
    if (bodyA.label === 'rope' || bodyB.label === 'rope') {
      const other = bodyA.label === 'rope' ? bodyB : bodyA;
      if (other.label === 'target' || other.label === 'bumper') ropeContactCount++;
      continue;
    }

    // Giblet touches down: fire once per fragment (walls don't count — a
    // wall-bounced piece is still airborne).
    const isFragA = bodyA.label === 'fragment';
    const isFragB = bodyB.label === 'fragment';
    const isGroundA = bodyA.label === 'ground';
    const isGroundB = bodyB.label === 'ground';
    if ((isFragA && isGroundB) || (isFragB && isGroundA)) {
      const frag = isFragA ? bodyA : bodyB;
      if (!frag.plugin.landed) {
        frag.plugin.landed = true;
        emit('fragment-landed', { x: frag.position.x, size: frag.circleRadius || 6 });
      }
      continue;
    }

    if ((isYoyoA && isTargetB) || (isYoyoB && isTargetA)) {
      const target = isTargetA ? bodyA : bodyB;
      const yoyo = isYoyoA ? bodyA : bodyB;
      const speed = Math.sqrt(yoyo.velocity.x ** 2 + yoyo.velocity.y ** 2);
      const material = MATERIALS[target.plugin.materialKey];
      const impactMultiplier = yoyo.plugin.impactMultiplier;

      const normal = pair.collision?.normal;
      let angleFactor = 1.0;
      if (speed > 0 && normal) {
        const dot = Math.abs((yoyo.velocity.x * normal.x + yoyo.velocity.y * normal.y) / speed);
        angleFactor = 0.3 + 0.7 * dot;
      }

      const outcome = evaluateImpact(speed * angleFactor, yoyo.mass, material, impactMultiplier);
      emit('yoyo-hit-target', {
        target,
        yoyo,
        outcome,
        speed,
        angleFactor,
        hitPoint: { x: (bodyA.position.x + bodyB.position.x) / 2, y: (bodyA.position.y + bodyB.position.y) / 2 },
        material,
      });
    }
  }
}

export function step(delta) {
  Engine.update(engine, delta);
}

export function spawnRat(x, y, variantKey, asStatic = false) {
  if (ratBody) Composite.remove(world, ratBody);
  const v = RAT_VARIANTS[variantKey];
  ratBody = Bodies.circle(x, y, v.radius, {
    label: 'rat',
    restitution: v.restitution,
    friction: v.friction,
    frictionAir: v.frictionAir,
    collisionFilter: { category: CAT.RAT, mask: MASK.RAT },
    plugin: { impactMultiplier: v.impactMultiplier, variantKey, radius: v.radius, isCircle: true, fragmentsSpawned: false },
  });
  Body.setMass(ratBody, v.mass);
  if (asStatic) Body.setStatic(ratBody, true);
  Composite.add(world, ratBody);
  return ratBody;
}

export function attachString(pivotX, pivotY, length, stiffness = 1.0) {
  detachRope();
  engine.constraintIterations = 2;   // Matter's default, for the single-constraint path
  if (stringConstraint) Composite.remove(world, stringConstraint);
  // Grip the tail base, not the body center — matches the tail-start point
  // drawn in renderer's drawRat, so the rat hangs from its tail.
  const r = ratBody.plugin.radius;
  stringConstraint = Constraint.create({
    pointA: { x: pivotX, y: pivotY },
    bodyB: ratBody,
    pointB: { x: -r * 0.85, y: r * 0.22 },
    length,
    stiffness,
    damping: 0.0,
  });
  Composite.add(world, stringConstraint);
}

/**
 * Segmented rope tail (task 117) - the alternative to attachString.
 *
 * A chain of small collidable bodies from the pivot to the rat's tail base,
 * so the tail can drape over geometry and coil around obstacles. Wrapping is
 * not simulated: it falls out of segments colliding with the world, which is
 * why a Matter body chain was the only approach that could deliver it.
 *
 * The chain runs pivot -> seg0 -> ... -> segN-1 -> rat tail base, and total
 * reach stays `length` so the swing radius matches the old constraint.
 * stringConstraint is deliberately reused for the pivot link: everything
 * downstream (updatePivot, the renderer's displayPivot) means "the constraint
 * anchored at the pivot", and that is still exactly what it is.
 */
// Rope tunables, exposed so they can be swept and measured rather than
// guessed. Defaults are the tuned values; see the task-117 sweep.
let ropeConfig = {
  // Both values come from the task-117 sweep, not from taste. Segment mass is
  // the dominant term: at 1-2% of rat mass the rope swallows the swing (peak
  // 40-161, never clears) because a near-massless chain cannot pull a body 100x
  // heavier through Matter's solver. At 25% it matches the no-rope baseline but
  // reads as a chain rather than a tail. 5% with ~48 iterations clears 100% of
  // runs at peak 208-240 against a 315 baseline - a 25-30% momentum cost, which
  // is the hindrance the rope is for.
  massFrac: 0.05,       // per segment, as a fraction of rat mass
  iterations: 48,       // engine.constraintIterations while a rope is attached
  stiffness: 1.0,
  radius: 3.5,
  friction: 0.4,
  frictionAir: 0.0005,
};

export function setRopeConfig(cfg) { Object.assign(ropeConfig, cfg); }
export function getRopeConfig() { return { ...ropeConfig }; }

export function attachRope(pivotX, pivotY, length, segments = 10, stiffness = ropeConfig.stiffness) {
  detachRope();
  // Matter solves constraints twice per step by default, which is nowhere near
  // enough for a 10-link chain: the links stretch ~30% under the rat's weight,
  // lengthening the pendulum and absorbing the energy a swing puts in. Restored
  // in attachString so the un-roped path keeps its original behaviour.
  engine.constraintIterations = ropeConfig.iterations;
  if (stringConstraint) { Composite.remove(world, stringConstraint); stringConstraint = null; }

  const segLen = length / segments;
  const r = ratBody.plugin.radius;
  // Each segment carries a small share of the rat's mass: enough to drape and
  // to bleed momentum when it catches, not enough to dominate the pendulum.
  const segMass = Math.max(0.0008, ratBody.mass * ropeConfig.massFrac);

  for (let i = 0; i < segments; i++) {
    // Circles, not thin rectangles: a 3px-thick box chain jitters and can
    // tunnel, and for draping over obstacles the silhouette comes from the
    // renderer anyway.
    const seg = Bodies.circle(pivotX, pivotY + (i + 0.5) * segLen, ropeConfig.radius, {
      label: 'rope',
      friction: ropeConfig.friction,   // grips when wrapped rather than sliding off
      frictionAir: ropeConfig.frictionAir,  // 10 segments of drag adds up
      restitution: 0.0,
      collisionFilter: { category: CAT.ROPE, mask: MASK.ROPE },
      plugin: { segIndex: i },
    });
    Body.setMass(seg, segMass);
    ropeBodies.push(seg);
    Composite.add(world, seg);
  }

  // Pivot -> first segment. Length 0: the rope's own segments provide reach.
  stringConstraint = Constraint.create({
    pointA: { x: pivotX, y: pivotY },
    bodyB: ropeBodies[0],
    length: 0,
    stiffness,
    damping: 0,
  });
  ropeConstraints.push(stringConstraint);

  for (let i = 0; i < segments - 1; i++) {
    ropeConstraints.push(Constraint.create({
      bodyA: ropeBodies[i],
      bodyB: ropeBodies[i + 1],
      length: segLen,
      stiffness,
      damping: 0,
    }));
  }

  // Last segment -> the rat's tail base, the same offset attachString uses,
  // so the rat still hangs by its tail rather than its centre.
  ropeConstraints.push(Constraint.create({
    bodyA: ropeBodies[ropeBodies.length - 1],
    bodyB: ratBody,
    pointB: { x: -r * 0.85, y: r * 0.22 },
    length: 0,
    stiffness,
    damping: 0,
  }));

  Composite.add(world, ropeConstraints);
  return ropeBodies;
}

export function detachRope() {
  ropeContactCount = 0;
  ropeConstraints.forEach(c => { try { Composite.remove(world, c); } catch { /* already gone */ } });
  ropeBodies.forEach(b => { try { Composite.remove(world, b); } catch { /* already gone */ } });
  if (ropeConstraints.includes(stringConstraint)) stringConstraint = null;
  ropeConstraints = [];
  ropeBodies = [];
}

export function getRopeBodies() { return ropeBodies; }
export function getRopeContactCount() { return ropeContactCount; }

/**
 * Total turning along the rope, in radians. A taut straight rope is ~0; a rope
 * bent around an obstacle accumulates real angle. This is the quantity that
 * says whether "wrap" is actually happening, as opposed to the rope merely
 * touching something.
 */
export function getRopeBend() {
  if (ropeBodies.length < 3) return 0;
  let total = 0;
  for (let i = 1; i < ropeBodies.length - 1; i++) {
    const a = ropeBodies[i - 1].position, b = ropeBodies[i].position, c = ropeBodies[i + 1].position;
    let d = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    total += Math.abs(d);
  }
  return total;
}

/**
 * Player yank: pull the rat toward the pivot to slacken and unwind a caught
 * rope.
 *
 * Strictly non-accelerating by construction. Tangential motion is damped, a
 * radial component toward the pivot is added, and the result is then clamped
 * to the speed the rat already had. A yank that could raise speed would become
 * the fastest way to swing and the whole game would collapse into click-spam,
 * so the clamp is the mechanic's safety property, not a tuning choice.
 */
export function yankRope(strength = 90) {
  if (!ratBody || !stringConstraint) return false;
  const pivotPoint = stringConstraint.pointA;
  const dx = pivotPoint.x - ratBody.position.x;
  const dy = pivotPoint.y - ratBody.position.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const v = ratBody.velocity;
  const speedBefore = Math.hypot(v.x, v.y);

  let nx = v.x * 0.8 + (dx / dist) * strength;
  let ny = v.y * 0.8 + (dy / dist) * strength;
  const after = Math.hypot(nx, ny);
  if (after > speedBefore && after > 0) {
    const k = speedBefore / after;
    nx *= k; ny *= k;
  }
  Body.setVelocity(ratBody, { x: nx, y: ny });
  return true;
}

export function spawnTargets(levelTargets) {
  targetBodies.forEach(b => Composite.remove(world, b));
  targetBodies = [];

  for (const td of levelTargets) {
    const x = td.x * canvasW;
    const y = td.y * canvasH;
    const material = MATERIALS[td.material];

    let body;
    if (td.shape === 'circle') {
      body = Bodies.circle(x, y, td.r, {
        isStatic: true,
        label: 'target',
        restitution: material.restitution,
        friction: 0.5,
        collisionFilter: { category: CAT.TARGET, mask: MASK.TARGET },
        plugin: {
          materialKey: td.material,
          cracked: false,
          crackPattern: null,
          isCircle: true,
          radius: td.r,
          fragmentsSpawned: false,
          isShield: td.isShield || false,
          breakSpeed: td.breakSpeed || 0,
          movement: makeMovementPlugin(td.movement, x, y),
        },
      });
    } else {
      body = Bodies.rectangle(x, y, td.w, td.h, {
        isStatic: true,
        label: 'target',
        restitution: material.restitution,
        friction: 0.5,
        collisionFilter: { category: CAT.TARGET, mask: MASK.TARGET },
        plugin: {
          materialKey: td.material,
          cracked: false,
          crackPattern: null,
          width: td.w,
          height: td.h,
          fragmentsSpawned: false,
          isShield: td.isShield || false,
          breakSpeed: td.breakSpeed || 0,
          movement: makeMovementPlugin(td.movement, x, y),
        },
      });
    }
    Composite.add(world, body);
    targetBodies.push(body);
  }
  return targetBodies;
}

function makeMovementPlugin(movement, x, y) {
  if (!movement) return null;
  return {
    axis: movement.axis,
    rangePx: movement.range * (movement.axis === 'x' ? canvasW : canvasH),
    period: movement.period,
    basePos: { x, y },
  };
}

export function updateMovingTargets(elapsed) {
  for (const body of targetBodies) {
    const m = body.plugin.movement;
    if (!m) continue;
    const offset = Math.sin((elapsed / m.period) * Math.PI * 2) * m.rangePx;
    const pos = { x: m.basePos.x, y: m.basePos.y };
    if (m.axis === 'x') pos.x += offset; else pos.y += offset;
    Body.setPosition(body, pos);
  }
}

export function spawnBumpers(levelBumpers = []) {
  bumperBodies.forEach(b => Composite.remove(world, b));
  bumperBodies = [];

  for (const bd of levelBumpers) {
    const x = bd.x * canvasW;
    const y = bd.y * canvasH;
    const body = Bodies.circle(x, y, bd.radius, {
      isStatic: true,
      label: 'bumper',
      restitution: 0.9,
      friction: 0.0,
      collisionFilter: { category: CAT.TARGET, mask: MASK.TARGET },
      plugin: { radius: bd.radius },
    });
    Composite.add(world, body);
    bumperBodies.push(body);
  }
  return bumperBodies;
}

export function removeTarget(body) {
  Composite.remove(world, body);
  targetBodies = targetBodies.filter(b => b !== body);
}

export function applyBreak(yoyo, outcome, hitPoint, blastBonus) {
  if (outcome === 'SHATTER' && !yoyo.plugin.fragmentsSpawned) {
    yoyo.plugin.fragmentsSpawned = true;
    spawnRatFragments(yoyo, hitPoint, blastBonus);
    Composite.remove(world, yoyo);
    ratBody = null;
    detachString();
  } else if (outcome === 'CRACK') {
    yoyo.plugin.cracked = true;
    yoyo.plugin.crackPattern = generateCrackPattern(6);
  }
}

function generateBlobVerts(count = 9, base = 0.7, jitter = 0.5) {
  const verts = [];
  for (let i = 0; i < count; i++) {
    verts.push({
      angle: (i / count) * Math.PI * 2,
      radiusMul: base + Math.random() * jitter,
    });
  }
  return verts;
}

// Gore-piece roster: every shatter guarantees one bone/organ/gut; the rest
// roll weighted flesh-heavy so flesh chunks stay the dominant read.
const PIECE_WEIGHTS = [
  { type: 'flesh', w: 0.6 },
  { type: 'bone', w: 0.2 },
  { type: 'organ', w: 0.2 },
];

function weightedPieceType() {
  let roll = Math.random();
  for (const { type, w } of PIECE_WEIGHTS) {
    if (roll < w) return type;
    roll -= w;
  }
  return 'flesh';
}

// One geometry object per piece, generated once at spawn (the blobVerts
// pattern): the renderer reads this verbatim so no per-frame randomness.
function generatePiece(type) {
  if (type === 'bone') {
    return {
      type,
      lenMul: 1.7 + Math.random() * 0.5,   // shaft half-length × draw radius
      widMul: 0.34 + Math.random() * 0.14, // shaft half-width × draw radius
      knobMul: 0.55 + Math.random() * 0.15,
    };
  }
  if (type === 'organ') {
    return {
      type,
      blobVerts: generateBlobVerts(8, 0.85, 0.25), // rounder than flesh
      hiAngle: Math.random() * Math.PI * 2,        // baked gloss highlight
      hiDist: 0.35 + Math.random() * 0.2,
    };
  }
  if (type === 'gut') {
    const segs = [];
    const n = 5;
    for (let i = 0; i < n; i++) {
      segs.push({ t: i / (n - 1), wobble: (Math.random() - 0.5) * 0.9 });
    }
    return { type, segs, lenMul: 2.4 + Math.random() * 0.8, tubeMul: 0.5 + Math.random() * 0.15 };
  }
  // flesh: ragged fur edge over part of the outline, tuft lengths pre-rolled
  return {
    type,
    blobVerts: generateBlobVerts(),
    colorRoll: Math.random(), // stable fill pick (old position-derived index flickered)
    furStart: Math.random() * Math.PI * 2,
    furSpan: Math.PI * (0.6 + Math.random() * 0.5),
    tufts: Array.from({ length: 5 }, () => 0.25 + Math.random() * 0.35),
  };
}

function spawnRatFragments(yoyo, hitPoint, blastBonus = 1) {
  const r = yoyo.plugin.radius || 18;
  const cx = yoyo.position.x;
  const cy = yoyo.position.y;
  const fragCount = 8;
  const spread = 1.4 * blastBonus;
  const newFrags = [];

  // Guaranteed variety, then weighted fill; shuffled so the guaranteed
  // pieces don't always occupy the same ring positions.
  const pieceTypes = ['bone', 'organ', 'gut'];
  while (pieceTypes.length < fragCount) pieceTypes.push(weightedPieceType());
  for (let i = pieceTypes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieceTypes[i], pieceTypes[j]] = [pieceTypes[j], pieceTypes[i]];
  }

  // Deliberate size hierarchy: flesh chunks read big and meaty; bones and
  // organs stay small so they read as parts, not slabs. (Bone's drawn length
  // still stretches to ~2x its radius via lenMul.)
  const SIZE_MULS = { flesh: 1.3, gut: 1.0, bone: 0.65, organ: 0.65 };

  for (let i = 0; i < fragCount; i++) {
    const angle = (i / fragCount) * Math.PI * 2;
    const fragR = Math.max(2.5, r * (0.2 + Math.random() * 0.25) * SIZE_MULS[pieceTypes[i]]);
    const frag = Bodies.circle(
      cx + Math.cos(angle) * r * 0.5,
      cy + Math.sin(angle) * r * 0.5,
      fragR,
      {
        label: 'fragment',
        restitution: 0.3,
        friction: 0.4,
        frictionAir: 0.01,
        // CAT.WORLD is what lets giblets land; without it they collide only
        // with each other and fall through the floor. (Until the category
        // cleanup this bit was 0x0001, which reached the ground only because
        // ground shared that default category with the rat - so giblets were
        // also colliding with the rat for the 0.85s before it is removed.)
        collisionFilter: { category: CAT.FRAGMENT, mask: MASK.FRAGMENT },
        plugin: {
          variantKey: yoyo.plugin.variantKey,
          born: Date.now(),
          landed: false,
          dripInterval: 0.12 + Math.random() * 0.18,
          dripTimer: Math.random() * 0.1,
          piece: generatePiece(pieceTypes[i]),
        },
      }
    );
    const dx = frag.position.x - hitPoint.x;
    const dy = frag.position.y - hitPoint.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    // Lobbed scatter, not a burst: the old ×80 launch (~56-168 px/step) was
    // tuned for non-colliding giblets and tunnels through the 50px walls and
    // floor now that fragments collide. ×10 keeps the worst case (heavy
    // blastBonus 1.4, max roll, up-bias) arcing inside the canvas so pieces
    // land within the 0.85s IMPACT window instead of freezing off-screen.
    Body.setVelocity(frag, {
      x: (dx / dist) * spread * 10 * (0.4 + Math.random() * 0.6),
      y: (dy / dist) * spread * 10 * (0.4 + Math.random() * 0.6) - 5,
    });
    Body.setAngularVelocity(frag, (Math.random() - 0.5) * 0.5);
    Composite.add(world, frag);
    newFrags.push(frag);
    fragmentBodies.push(frag);
  }

  setTimeout(() => {
    newFrags.forEach(f => { try { Composite.remove(world, f); } catch {} });
    fragmentBodies = fragmentBodies.filter(f => !newFrags.includes(f));
  }, 4000);
}

export function updatePivot(x, y) {
  if (stringConstraint) stringConstraint.pointA = { x, y };
}

export function detachString() {
  if (stringConstraint) {
    Composite.remove(world, stringConstraint);
    stringConstraint = null;
  }
}

export function getRatBody() { return ratBody; }
export function getTargetBodies() { return targetBodies; }
export function getFragmentBodies() { return fragmentBodies; }
export function getBumperBodies() { return bumperBodies; }
export function getStringConstraint() { return stringConstraint; }

export function reset() {
  World.clear(world, false);
  Composite.add(world, [groundBody, leftWall, rightWall]);
  ratBody = null;
  stringConstraint = null;
  // World.clear already dropped the bodies; clear our bookkeeping too or the
  // next attachRope would try to remove stale references.
  ropeBodies = [];
  ropeConstraints = [];
  ropeContactCount = 0;
  targetBodies = [];
  fragmentBodies = [];
  bumperBodies = [];
}

export function removeRat() {
  if (ratBody) {
    Composite.remove(world, ratBody);
    ratBody = null;
  }
  if (stringConstraint) {
    Composite.remove(world, stringConstraint);
    stringConstraint = null;
  }
}
