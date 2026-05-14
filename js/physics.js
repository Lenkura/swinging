import { MATERIALS, getFragmentVerts, evaluateImpact, generateCrackPattern } from './target.js';
import { YOYO_VARIANTS } from './yoyo.js';

const { Engine, Bodies, Body, Composite, Constraint, Events, World } = Matter;

let engine, world;
let yoyoBody = null;
let stringConstraint = null;
let targetBodies = [];
let fragmentBodies = [];
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
    const isYoyoA = bodyA.label === 'yoyo';
    const isYoyoB = bodyB.label === 'yoyo';
    const isTargetA = bodyA.label === 'target';
    const isTargetB = bodyB.label === 'target';

    if ((isYoyoA && isTargetB) || (isYoyoB && isTargetA)) {
      const target = isTargetA ? bodyA : bodyB;
      const yoyo = isYoyoA ? bodyA : bodyB;
      const speed = Math.sqrt(yoyo.velocity.x ** 2 + yoyo.velocity.y ** 2);
      const material = MATERIALS[target.plugin.materialKey];
      const impactMultiplier = yoyo.plugin.impactMultiplier;
      const outcome = evaluateImpact(speed, yoyo.mass, material, impactMultiplier);
      emit('yoyo-hit-target', {
        target,
        yoyo,
        outcome,
        speed,
        hitPoint: { x: (bodyA.position.x + bodyB.position.x) / 2, y: (bodyA.position.y + bodyB.position.y) / 2 },
        material,
      });
    }
  }
}

export function step(delta) {
  Engine.update(engine, delta);
}

export function spawnYoyo(x, y, variantKey) {
  if (yoyoBody) Composite.remove(world, yoyoBody);
  const v = YOYO_VARIANTS[variantKey];
  yoyoBody = Bodies.circle(x, y, v.radius, {
    label: 'yoyo',
    restitution: v.restitution,
    friction: v.friction,
    frictionAir: v.frictionAir,
    collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    plugin: { impactMultiplier: v.impactMultiplier, variantKey },
  });
  Body.setMass(yoyoBody, v.mass);
  Composite.add(world, yoyoBody);
  return yoyoBody;
}

export function attachString(pivotX, pivotY, length) {
  if (stringConstraint) Composite.remove(world, stringConstraint);
  stringConstraint = Constraint.create({
    pointA: { x: pivotX, y: pivotY },
    bodyB: yoyoBody,
    pointB: { x: 0, y: 0 },
    length,
    stiffness: 1.0,
    damping: 0.0,
  });
  Composite.add(world, stringConstraint);
}

let pendingRelease = false;
let releaseVx = 0, releaseVy = 0;

export function scheduleRelease(vx, vy) {
  pendingRelease = true;
  releaseVx = vx;
  releaseVy = vy;
}

export function installReleaseHook() {
  Events.on(engine, 'beforeUpdate', () => {
    if (!pendingRelease) return;
    pendingRelease = false;
    if (stringConstraint) {
      Composite.remove(world, stringConstraint);
      stringConstraint = null;
    }
    if (yoyoBody) {
      Body.setVelocity(yoyoBody, { x: releaseVx, y: releaseVy });
      Body.setStatic(yoyoBody, false);
    }
  });
}

export function spawnTargets(levelTargets, pivotRelX, pivotRelY) {
  targetBodies.forEach(b => Composite.remove(world, b));
  targetBodies = [];

  for (const td of levelTargets) {
    const x = td.x * canvasW;
    const y = td.y * canvasH;
    const material = MATERIALS[td.material];
    const body = Bodies.rectangle(x, y, td.w, td.h, {
      isStatic: true,
      label: 'target',
      restitution: material.restitution,
      friction: 0.5,
      collisionFilter: { category: 0x0002, mask: 0x0001 },
      plugin: {
        materialKey: td.material,
        cracked: false,
        crackPattern: null,
        hitsRemaining: 1,
        width: td.w,
        height: td.h,
        fragmentsSpawned: false,
      },
    });
    Composite.add(world, body);
    targetBodies.push(body);
  }
  return targetBodies;
}

export function applyBreak(target, outcome, hitPoint, blastBonus) {
  const material = MATERIALS[target.plugin.materialKey];
  if (outcome === 'SHATTER' && !target.plugin.fragmentsSpawned) {
    target.plugin.fragmentsSpawned = true;
    spawnFragments(target, hitPoint, material, blastBonus);
    Composite.remove(world, target);
    targetBodies = targetBodies.filter(b => b !== target);
  } else if (outcome === 'CRACK') {
    target.plugin.cracked = true;
    target.plugin.crackPattern = generateCrackPattern(6);
    // halve thresholds so next hit shatters
    const mat = MATERIALS[target.plugin.materialKey];
    target.plugin.strength = mat.crackThreshold * 0.5;
    target.plugin.crackThreshold = mat.crackThreshold * 0.3;
  }
}

function spawnFragments(target, hitPoint, material, blastBonus = 1) {
  const fragVerts = getFragmentVerts(material.fragmentCount);
  const w = target.plugin.width;
  const h = target.plugin.height;
  const cx = target.position.x;
  const cy = target.position.y;
  const spread = material.fragmentSpread * blastBonus * 4;
  const newFrags = [];

  for (const polyNorm of fragVerts) {
    const verts = polyNorm.map(([nx, ny]) => ({ x: cx + nx * w, y: cy + ny * h }));
    try {
      const frag = Bodies.fromVertices(
        cx + (Math.random() - 0.5) * 2,
        cy + (Math.random() - 0.5) * 2,
        verts,
        {
          label: 'fragment',
          restitution: 0.25,
          friction: 0.4,
          frictionAir: 0.01,
          collisionFilter: { category: 0x0004, mask: 0x0002 | 0x0004 | 0x0008 },
          plugin: { materialKey: target.plugin.materialKey, born: Date.now() },
        }
      );
      const dx = frag.position.x - hitPoint.x;
      const dy = frag.position.y - hitPoint.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const blastSpeed = spread * 80;
      Body.setVelocity(frag, {
        x: (dx / dist) * blastSpeed * (0.5 + Math.random()),
        y: (dy / dist) * blastSpeed * (0.5 + Math.random()) - 60,
      });
      Body.setAngularVelocity(frag, (Math.random() - 0.5) * 0.4);
      Composite.add(world, frag);
      newFrags.push(frag);
      fragmentBodies.push(frag);
    } catch {}
  }

  setTimeout(() => {
    newFrags.forEach(f => { try { Composite.remove(world, f); } catch {} });
    fragmentBodies = fragmentBodies.filter(f => !newFrags.includes(f));
  }, 4000);
}

export function getYoyoBody() { return yoyoBody; }
export function getTargetBodies() { return targetBodies; }
export function getFragmentBodies() { return fragmentBodies; }
export function getStringConstraint() { return stringConstraint; }

export function reset() {
  World.clear(world, false);
  Composite.add(world, [groundBody, leftWall, rightWall]);
  yoyoBody = null;
  stringConstraint = null;
  targetBodies = [];
  fragmentBodies = [];
  pendingRelease = false;
}

export function removeYoyo() {
  if (yoyoBody) {
    Composite.remove(world, yoyoBody);
    yoyoBody = null;
  }
  if (stringConstraint) {
    Composite.remove(world, stringConstraint);
    stringConstraint = null;
  }
}
