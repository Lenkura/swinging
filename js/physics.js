import { MATERIALS, evaluateImpact, generateCrackPattern } from './target.js';
import { RAT_VARIANTS } from './rat.js';

const { Engine, Bodies, Body, Composite, Constraint, Events, World } = Matter;

let engine, world;
let ratBody = null;
let stringConstraint = null;
let targetBodies = [];
let fragmentBodies = [];
let bumperBodies = [];
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
  });
  leftWall = Bodies.rectangle(-25, height / 2, 50, height * 2, { isStatic: true, label: 'wall' });
  rightWall = Bodies.rectangle(width + 25, height / 2, 50, height * 2, { isStatic: true, label: 'wall' });
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
    collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    plugin: { impactMultiplier: v.impactMultiplier, variantKey, radius: v.radius, fragmentsSpawned: false },
  });
  Body.setMass(ratBody, v.mass);
  if (asStatic) Body.setStatic(ratBody, true);
  Composite.add(world, ratBody);
  return ratBody;
}

export function attachString(pivotX, pivotY, length, stiffness = 1.0) {
  if (stringConstraint) Composite.remove(world, stringConstraint);
  stringConstraint = Constraint.create({
    pointA: { x: pivotX, y: pivotY },
    bodyB: ratBody,
    pointB: { x: 0, y: 0 },
    length,
    stiffness,
    damping: 0.0,
  });
  Composite.add(world, stringConstraint);
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
        collisionFilter: { category: 0x0002, mask: 0x0001 },
        plugin: {
          materialKey: td.material,
          cracked: false,
          crackPattern: null,
          isCircle: true,
          radius: td.r,
          fragmentsSpawned: false,
          isShield: td.isShield || false,
          breakSpeed: td.breakSpeed || 0,
        },
      });
    } else {
      body = Bodies.rectangle(x, y, td.w, td.h, {
        isStatic: true,
        label: 'target',
        restitution: material.restitution,
        friction: 0.5,
        collisionFilter: { category: 0x0002, mask: 0x0001 },
        plugin: {
          materialKey: td.material,
          cracked: false,
          crackPattern: null,
          width: td.w,
          height: td.h,
          fragmentsSpawned: false,
          isShield: td.isShield || false,
          breakSpeed: td.breakSpeed || 0,
        },
      });
    }
    Composite.add(world, body);
    targetBodies.push(body);
  }
  return targetBodies;
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
      collisionFilter: { category: 0x0002, mask: 0x0001 },
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

function spawnRatFragments(yoyo, hitPoint, blastBonus = 1) {
  const r = yoyo.plugin.radius || 18;
  const cx = yoyo.position.x;
  const cy = yoyo.position.y;
  const fragCount = 8;
  const spread = 1.4 * blastBonus;
  const newFrags = [];

  for (let i = 0; i < fragCount; i++) {
    const angle = (i / fragCount) * Math.PI * 2;
    const fragR = r * (0.2 + Math.random() * 0.25);
    const frag = Bodies.circle(
      cx + Math.cos(angle) * r * 0.5,
      cy + Math.sin(angle) * r * 0.5,
      fragR,
      {
        label: 'fragment',
        restitution: 0.3,
        friction: 0.4,
        frictionAir: 0.01,
        collisionFilter: { category: 0x0004, mask: 0x0002 | 0x0004 | 0x0008 },
        plugin: { variantKey: yoyo.plugin.variantKey, born: Date.now() },
      }
    );
    const dx = frag.position.x - hitPoint.x;
    const dy = frag.position.y - hitPoint.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    Body.setVelocity(frag, {
      x: (dx / dist) * spread * 80 * (0.5 + Math.random()),
      y: (dy / dist) * spread * 80 * (0.5 + Math.random()) - 80,
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
