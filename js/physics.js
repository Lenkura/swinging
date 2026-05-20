import { MATERIALS, evaluateImpact, generateCrackPattern } from './target.js';
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

export function spawnYoyo(x, y, variantKey, asStatic = false) {
  if (yoyoBody) Composite.remove(world, yoyoBody);
  const v = YOYO_VARIANTS[variantKey];
  yoyoBody = Bodies.circle(x, y, v.radius, {
    label: 'yoyo',
    restitution: v.restitution,
    friction: v.friction,
    frictionAir: v.frictionAir,
    collisionFilter: { category: 0x0001, mask: 0x0002 | 0x0004 },
    plugin: { impactMultiplier: v.impactMultiplier, variantKey, radius: v.radius, fragmentsSpawned: false },
  });
  Body.setMass(yoyoBody, v.mass);
  if (asStatic) Body.setStatic(yoyoBody, true);
  Composite.add(world, yoyoBody);
  return yoyoBody;
}

export function attachString(pivotX, pivotY, length, stiffness = 1.0) {
  if (stringConstraint) Composite.remove(world, stringConstraint);
  stringConstraint = Constraint.create({
    pointA: { x: pivotX, y: pivotY },
    bodyB: yoyoBody,
    pointB: { x: 0, y: 0 },
    length,
    stiffness,
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

export function applyBreak(yoyo, outcome, hitPoint, blastBonus) {
  if (outcome === 'SHATTER' && !yoyo.plugin.fragmentsSpawned) {
    yoyo.plugin.fragmentsSpawned = true;
    spawnYoyoFragments(yoyo, hitPoint, blastBonus);
    Composite.remove(world, yoyo);
    yoyoBody = null;
    detachString();
  } else if (outcome === 'CRACK') {
    yoyo.plugin.cracked = true;
    yoyo.plugin.crackPattern = generateCrackPattern(6);
  }
}

function spawnYoyoFragments(yoyo, hitPoint, blastBonus = 1) {
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

export function attachStringToMouse(mouseX, mouseY) {
  if (!yoyoBody) return;
  Body.setStatic(yoyoBody, false);
  Body.setVelocity(yoyoBody, { x: 0, y: 0 });
  const dx = mouseX - yoyoBody.position.x;
  const dy = mouseY - yoyoBody.position.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 20);
  attachString(mouseX, mouseY, length, 0.85);
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

export function setYoyoPosition(x, y) {
  if (yoyoBody) Body.setPosition(yoyoBody, { x, y });
}

export function setYoyoVelocity(vx, vy) {
  if (yoyoBody) Body.setVelocity(yoyoBody, { x: vx, y: vy });
}

export function clampYoyoSpeed(maxSpeed) {
  if (!yoyoBody) return;
  const spd = Math.sqrt(yoyoBody.velocity.x ** 2 + yoyoBody.velocity.y ** 2);
  if (spd > maxSpeed) {
    Body.setVelocity(yoyoBody, {
      x: (yoyoBody.velocity.x / spd) * maxSpeed,
      y: (yoyoBody.velocity.y / spd) * maxSpeed,
    });
  }
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
