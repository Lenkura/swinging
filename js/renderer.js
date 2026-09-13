import { RAT_VARIANTS } from './rat.js';
import { MATERIALS } from './target.js';
import * as Particles from './particles.js';
import { GROUND_TOP_INSET } from './physics.js';

let canvas, ctx;
let canvasW, canvasH;

// Trail ring buffer
const TRAIL_MAX = 30;
const trail = [];

// Per-level render caches (invalidated when level identity changes)
let cachedGradient = null;
let cachedGradientKey = '';
let cachedGroundCanvas = null;
let cachedGroundKey = '';

// Persistent ground decal layer — blood splats accumulate across the whole
// attempt and are cleared on level restart.
let decalCanvas = null;
let decalCtx = null;

export function paintSplat(x, intensity, scale = 1) {
  if (!decalCanvas) {
    decalCanvas = document.createElement('canvas');
    decalCanvas.width = canvasW;
    decalCanvas.height = canvasH;
    decalCtx = decalCanvas.getContext('2d');
  }
  const groundTop = canvasH - GROUND_TOP_INSET; // surface line drawn by drawGround
  const count = Math.round((3 + intensity * 5) * scale);
  for (let i = 0; i < count; i++) {
    const sx = x + (Math.random() - 0.5) * (70 + intensity * 90) * scale;
    const sy = groundTop + 4 + Math.random() * 26;
    const r = (2 + Math.random() * 3.5 * (0.5 + intensity)) * scale;
    decalCtx.beginPath();
    decalCtx.ellipse(sx, sy, r * (1.3 + Math.random() * 0.8), r * 0.55, 0, 0, Math.PI * 2);
    decalCtx.fillStyle = `rgba(${110 + Math.floor(Math.random() * 40)},8,14,${0.45 + Math.random() * 0.3})`;
    decalCtx.fill();
  }
}

export function clearDecals() {
  if (decalCtx) decalCtx.clearRect(0, 0, decalCanvas.width, decalCanvas.height);
}

export function init(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  canvasW = canvas.width;
  canvasH = canvas.height;
}

export function resize(w, h) {
  canvasW = w;
  canvasH = h;
}

export function updateTrail(x, y, maxLen = TRAIL_MAX) {
  trail.push({ x, y });
  if (trail.length > maxLen) trail.shift();
}

export function clearTrail() { trail.length = 0; }

export function draw({
  state,
  level,
  pivot,
  yoyoBody,
  targetBodies,
  bumperBodies = [],
  fragmentBodies,
  stringConstraint,
  ropeBodies = null,
  grabTip = null,
  angularSpeed,
  hpFraction = 1.0,
  hitCount = 0,
  comboCount = 0,
  hitLabel = null,
  shake = 0,
  flash = false,
  squash = 0,
}) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.save();
  if (shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * 2 * shake,
      (Math.random() - 0.5) * 2 * shake
    );
  }

  drawBackground(level);
  drawGround(level);
  if (decalCanvas) ctx.drawImage(decalCanvas, 0, 0);

  const ratVariant = yoyoBody ? RAT_VARIANTS[yoyoBody.plugin?.variantKey || 'standard'] : null;

  // In READY the rope exists but nothing holds it - the tail lies on the ground
  // waiting to be grabbed - so it has to draw despite there being no anchor.
  const showTail = yoyoBody && (
    (stringConstraint && (state === 'SWINGING' || state === 'IDLE_ARMED')) ||
    (state === 'READY' && !!ropeBodies?.length)
  );
  // A drawn tail sits behind the scenery; a physical rope must sit in front of
  // it, or a rope caught on a bumper renders as a straight line disappearing
  // behind the very obstacle it is snagged on.
  if (showTail && !ropeBodies?.length) {
    drawTail(pivot, yoyoBody, angularSpeed, stringConstraint, ratVariant, null);
  }

  drawTrail(yoyoBody, level);
  drawFragments(fragmentBodies);
  drawBumpers(bumperBodies);
  drawTargets(targetBodies);

  if (showTail && ropeBodies?.length) {
    drawTail(pivot, yoyoBody, angularSpeed, stringConstraint, ratVariant, ropeBodies);
  }

  if (yoyoBody) {
    drawRat(yoyoBody, ratVariant, hpFraction, flash, squash);
    if (yoyoBody.plugin.cracked && yoyoBody.plugin.crackPattern) {
      drawCracks(yoyoBody, yoyoBody.plugin.crackPattern);
    }
  }

  Particles.draw(ctx);

  drawSpeedMeter(angularSpeed);
  if (stringConstraint) drawPivotHand(pivot, state);
  if (state === 'READY' && grabTip) drawGrabHint(grabTip);
  drawHpBar(hpFraction);
  drawHitCounter(hitCount);
  drawCombo(comboCount);
  if (hitLabel && hitLabel.alpha > 0) drawHitLabel(hitLabel);
  ctx.restore();
}

function drawBackground(level) {
  const key = level.background[0] + '|' + level.background[1];
  if (!cachedGradient || cachedGradientKey !== key) {
    cachedGradient = ctx.createLinearGradient(0, 0, 0, canvasH);
    cachedGradient.addColorStop(0, level.background[0]);
    cachedGradient.addColorStop(1, level.background[1]);
    cachedGradientKey = key;
  }
  ctx.fillStyle = cachedGradient;
  ctx.fillRect(0, 0, canvasW, canvasH);
}

function drawGround(level) {
  const key = level.groundColor + '|' + canvasW;
  if (!cachedGroundCanvas || cachedGroundKey !== key) {
    const GRASS_MAX = 9, GROUND_H = 40;
    const oc = document.createElement('canvas');
    oc.width = canvasW;
    oc.height = GRASS_MAX + GROUND_H;
    const gctx = oc.getContext('2d');

    gctx.fillStyle = level.groundColor;
    gctx.fillRect(0, GRASS_MAX, canvasW, GROUND_H);

    gctx.strokeStyle = 'rgba(0,0,0,0.5)';
    gctx.lineWidth = 3;
    gctx.beginPath();
    gctx.moveTo(0, GRASS_MAX);
    gctx.lineTo(canvasW, GRASS_MAX);
    gctx.stroke();

    gctx.fillStyle = '#3a8f3a';
    for (let x = 10; x < canvasW; x += 22) {
      const h = 6 + Math.sin(x * 0.3) * 3;
      gctx.fillRect(x, GRASS_MAX - h, 4, h);
    }

    cachedGroundCanvas = oc;
    cachedGroundKey = key;
  }
  ctx.drawImage(cachedGroundCanvas, 0, canvasH - 49);
}

/**
 * Catmull-Rom through the given control points, so a 10-segment rope reads as
 * a curve rather than a polygon. Returns a densified polyline the tapered
 * stroker can walk.
 */
function smoothPolyline(pts, samplesPerSpan = 4) {
  if (pts.length < 3) return pts;
  const at = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let s = 0; s < samplesPerSpan; s++) {
      const t = s / samplesPerSpan, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Tapered stroke: thin at the hand, thickening toward the body. */
function strokeTaperedTail(pts, r, variant) {
  // Two passes (dark underlay, then colour) instead of shadowBlur: a shadowed
  // stroke per span would mean 40+ blurred draws a frame, and task 86 is
  // already about getting shadowBlur out of the per-frame path.
  // Underlay kept narrow: at +1.9 the rope read as a thick stick next to the
  // old thin drawn tail, which is a visual regression even though the
  // geometry is now honest.
  for (const [color, widen] of [['rgba(0,0,0,0.28)', 0.9], [variant.tailColor, 0]]) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      ctx.lineWidth = r * (0.08 + 0.22 * t) + widen;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
  }
}

function drawTail(pivot, body, normalizedSpeed, constraint, variant, ropeBodies) {
  const r = body.plugin.radius;
  const angle = body.angle;
  const cos = Math.cos(angle), sin = Math.sin(angle);

  // Tail base in body-local space — matches attachString's pointB and drawRat's tail start
  const baseLocalX = -r * 0.85, baseLocalY = r * 0.22;
  const ex = body.position.x + baseLocalX * cos - baseLocalY * sin;
  const ey = body.position.y + baseLocalX * sin + baseLocalY * cos;

  const px = pivot.x, py = pivot.y;

  // Segmented rope: the tail IS the physics. Draw where the bodies actually
  // are, so a rope draped over a bumper looks draped instead of tracing a
  // clean parabola through it.
  if (ropeBodies && ropeBodies.length) {
    // With no constraint there is no hand yet, so the tail starts at its own
    // free tip; prepending the stale level pivot would draw a line to nowhere.
    const control = constraint ? [{ x: px, y: py }] : [];
    for (const seg of ropeBodies) control.push({ x: seg.position.x, y: seg.position.y });
    control.push({ x: ex, y: ey });
    strokeTaperedTail(smoothPolyline(control), r, variant);
    return;
  }

  const dx = ex - px;
  const dy = ey - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const perpX = -dy / dist;
  const perpY = dx / dist;

  // Gravity sag: stronger when the tail is horizontal, zero when vertical
  const horizontalFraction = Math.abs(dx) / dist;
  const gravSag = horizontalFraction * dist * 0.18;

  // Extra sag when the tail is slack (rat closer than constraint length)
  const slack = Math.max(0, (constraint?.length ?? dist) - dist);
  const slackSag = slack * 0.4;

  const totalSag = gravSag + slackSag;

  // Lateral bow from swing speed
  const speedBow = normalizedSpeed * 16;

  // Build 8 tail points with parabolic gravity + speed bow
  const N = 8;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const s = Math.sin(t * Math.PI); // 0 at ends, peak at midpoint
    pts.push({
      x: px + dx * t + perpX * speedBow * s,
      y: py + dy * t + perpY * speedBow * s + totalSag * s,
    });
  }

  // Thin at the hand (t=0), thick where it meets the body (t=1)
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 3;
  ctx.strokeStyle = variant.tailColor;
  ctx.lineCap = 'round';
  for (let i = 0; i < pts.length - 1; i++) {
    const t = i / (pts.length - 1);
    ctx.lineWidth = r * (0.08 + 0.22 * t);
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawTrail(yoyo, level) {
  if (!yoyo || trail.length < 2) return;
  const v = RAT_VARIANTS[yoyo.plugin?.variantKey || 'standard'];
  for (let i = 1; i < trail.length; i++) {
    const alpha = (i / trail.length) * 0.25;
    const r = v.radius * (i / trail.length) * 0.7;
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fillStyle = v.trailColor + alpha + ')';
    ctx.fill();
  }
}

/** "#a8d8ea" -> "rgba(168,216,234,0.35)". Used to tint a shield by its tier. */
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function blendHexColors(hexA, hexB, t) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

function drawRat(body, variant, hpFraction, flash = false, squash = 0) {
  const { x, y } = body.position;
  const r = variant.radius;
  const bodyColor = blendHexColors(variant.color, variant.wornColor, 1 - hpFraction);
  ctx.save();
  ctx.translate(x, y);

  // Squash-and-stretch along the travel direction: subtle stretch with
  // speed, compression pulse on impact while squash outweighs it.
  const vx = body.velocity.x, vy = body.velocity.y;
  const speed = Math.hypot(vx, vy);
  const stretch = Math.min(speed / 120, 1) * 0.14;
  const net = stretch - squash * 0.3;
  if (speed > 0.5 && Math.abs(net) > 0.005) {
    const va = Math.atan2(vy, vx);
    ctx.rotate(va);
    ctx.scale(1 + net, 1 - net * 0.7);
    ctx.rotate(-va);
  }

  ctx.rotate(body.angle);

  // Body
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.92, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = variant.outlineColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Belly highlight
  ctx.beginPath();
  ctx.ellipse(r * 0.05, r * 0.14, r * 0.44, r * 0.27, 0, 0, Math.PI * 2);
  ctx.fillStyle = variant.trimColor;
  ctx.fill();

  // Head (right side)
  const hx = r * 0.68, hy = -r * 0.08, hr = r * 0.46;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = variant.outlineColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ears
  for (const [ex, ey, er] of [
    [hx - r * 0.12, hy - hr * 0.85, r * 0.22],
    [hx + r * 0.22, hy - hr * 0.72, r * 0.18],
  ]) {
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = variant.color;
    ctx.fill();
    ctx.strokeStyle = variant.outlineColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = variant.earColor;
    ctx.fill();
  }

  // Eye
  const eyeX = hx + r * 0.2, eyeY = hy - r * 0.13;
  if (hpFraction <= 0.25) {
    const xs = r * 0.11;
    ctx.strokeStyle = '#dd0000';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(eyeX - xs, eyeY - xs); ctx.lineTo(eyeX + xs, eyeY + xs);
    ctx.moveTo(eyeX + xs, eyeY - xs); ctx.lineTo(eyeX - xs, eyeY + xs);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, r * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(eyeX + r * 0.04, eyeY - r * 0.04, r * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }

  // Snout
  const sx = hx + hr * 0.82, sy = hy + r * 0.05;
  ctx.beginPath();
  ctx.ellipse(sx, sy, r * 0.14, r * 0.1, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = variant.snoutColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + r * 0.08, sy, r * 0.065, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();

  // Whiskers
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const wy = sy + i * r * 0.1;
    ctx.strokeStyle = `rgba(220,215,200,${0.85 - Math.abs(i) * 0.2})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, wy);
    ctx.lineTo(sx + r * 0.52, wy + i * r * 0.12 - r * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx, wy);
    ctx.lineTo(sx - r * 0.18, wy - i * r * 0.07);
    ctx.stroke();
  }

  // Damage state overlays
  if (hpFraction < 0.75) drawRatDamage(hpFraction, hx, hy - hr * 0.6, r);

  // Impact flash — white blink over the rat silhouette for a couple frames
  if (flash) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.92, r * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    for (const [ex, ey, er] of [
      [hx - r * 0.12, hy - hr * 0.85, r * 0.22],
      [hx + r * 0.22, hy - hr * 0.72, r * 0.18],
    ]) {
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawRatDamage(hpFraction, headX, headTopY, r) {
  const t = Date.now() / 500;
  if (hpFraction >= 0.5) {
    // Dazed: golden orbiting stars
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2 / 3);
      ctx.fillStyle = '#FFD700';
      ctx.font = `${Math.ceil(r * 0.5)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', headX + Math.cos(a) * r * 0.55, headTopY + Math.sin(a) * r * 0.25);
    }
    ctx.textBaseline = 'alphabetic';
  } else {
    // Injured / Critical: wound marks + blood drips
    const woundCount = hpFraction < 0.25 ? 4 : 2;
    const woundPositions = [
      [-r * 0.35, -r * 0.18],
      [r * 0.06, r * 0.28],
      [-r * 0.52, r * 0.12],
      [r * 0.22, -r * 0.32],
    ];
    ctx.strokeStyle = '#cc2222';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < woundCount; i++) {
      const [wx, wy] = woundPositions[i];
      const s = r * 0.14;
      ctx.beginPath();
      ctx.moveTo(wx - s, wy - s * 0.4); ctx.lineTo(wx + s, wy + s * 0.4);
      ctx.moveTo(wx - s * 0.4, wy - s); ctx.lineTo(wx + s * 0.4, wy + s);
      ctx.stroke();
    }

    // Blood drips — in local space so they fling outward as the rat spins
    const dripPositions = hpFraction < 0.25
      ? [[-r*0.28, r*0.58, r*0.42], [r*0.12, r*0.62, r*0.32], [-r*0.58, r*0.42, r*0.28], [r*0.32, r*0.54, r*0.38]]
      : [[-r*0.28, r*0.58, r*0.22], [r*0.12, r*0.62, r*0.18]];
    ctx.fillStyle = '#aa0000';
    for (const [dx, dy, len] of dripPositions) {
      const dr = r * 0.075;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(dx - dr * 0.9, dy);
      ctx.lineTo(dx + dr * 0.9, dy);
      ctx.lineTo(dx, dy + len);
      ctx.closePath();
      ctx.fill();
    }

    // Critical: red spinning stars too
    if (hpFraction < 0.25) {
      const tf = Date.now() / 380;
      for (let i = 0; i < 3; i++) {
        const a = tf + (i * Math.PI * 2 / 3);
        ctx.fillStyle = '#FF3333';
        ctx.font = `${Math.ceil(r * 0.5)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', headX + Math.cos(a) * r * 0.55, headTopY + Math.sin(a) * r * 0.25);
      }
      ctx.textBaseline = 'alphabetic';
    }
  }
}

function drawTargets(targets) {
  for (const body of targets) {
    const mat = MATERIALS[body.plugin.materialKey];
    const isShield = body.plugin.isShield;
    // A shield keeps its translucent, glowing look but takes its TIER's colour:
    // the tier resolves to a material, and if every shield rendered the same
    // pale blue the player could not tell a light one from a heavy one, which
    // is the entire point of tiering them (glass = light, wood = medium,
    // steel = heavy). Previously this was hardcoded to rgba(180,230,255,0.35).
    const fillColor = isShield
      ? hexToRgba(mat.color, 0.35)
      : (body.plugin.cracked ? mat.crackedColor : mat.color);
    const strokeColor = isShield ? mat.color : mat.outlineColor;

    if (body.plugin.isCircle) {
      drawCircleBody(body, fillColor, strokeColor);
    } else {
      drawPhysicsBody(body, fillColor, strokeColor);
    }

    if (!isShield) {
      if (body.plugin.cracked && body.plugin.crackPattern) drawCracks(body, body.plugin.crackPattern);

      const { x, y } = body.position;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(mat.label, x, y + 4);

      ctx.save();
      ctx.globalAlpha = 0.18;
      if (body.plugin.isCircle) {
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, body.plugin.radius, 0, Math.PI * 2);
      } else {
        ctx.beginPath();
        const verts = body.vertices;
        ctx.moveTo(verts[0].x, verts[0].y);
        for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
        ctx.closePath();
      }
      ctx.fillStyle = mat.glowColor;
      ctx.fill();
      ctx.restore();
    } else {
      // Shield sheen — vertical highlight strip
      ctx.save();
      ctx.globalAlpha = 0.25;
      const { x, y } = body.position;
      const w = body.plugin.width || 14;
      const h = body.plugin.height || 80;
      ctx.translate(x, y);
      ctx.rotate(body.angle);
      const sheen = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      sheen.addColorStop(0, 'transparent');
      sheen.addColorStop(0.4, 'rgba(255,255,255,0.9)');
      sheen.addColorStop(1, 'transparent');
      ctx.fillStyle = sheen;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }
}

function drawCircleBody(body, fill, stroke) {
  const { x, y } = body.position;
  const r = body.plugin.radius;
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawBumpers(bumpers) {
  for (const body of bumpers) {
    const { x, y } = body.position;
    const r = body.plugin.radius;

    // Metallic base
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#d0d8e0');
    grad.addColorStop(0.5, '#8090a0');
    grad.addColorStop(1, '#4a5560');
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#2a3540';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Shine highlight
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.restore();

    // Center ring
    ctx.beginPath();
    ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function drawCracks(body, pattern) {
  const { x, y } = body.position;
  const maxR = body.plugin.isCircle
    ? body.plugin.radius * 0.85
    : Math.min(body.plugin.width, body.plugin.height) * 0.45;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  for (const { angle, len } of pattern) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * len * maxR * 2, Math.sin(angle) * len * maxR * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const GIBLET_COLORS = ['#cc0000', '#ff1111', '#ff3333', '#dd0000', '#ff4444'];

// Trace the smoothed blob outline (quadratic curve toward each edge midpoint)
// and return the projected vertices so callers can decorate the outline.
function traceBlobPath(blobVerts, r) {
  const verts = blobVerts.map(v => ({
    angle: v.angle,
    x: Math.cos(v.angle) * r * v.radiusMul,
    y: Math.sin(v.angle) * r * v.radiusMul,
  }));
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  ctx.beginPath();
  const startMid = mid(verts[verts.length - 1], verts[0]);
  ctx.moveTo(startMid.x, startMid.y);
  for (let i = 0; i < verts.length; i++) {
    const next = verts[(i + 1) % verts.length];
    const m = mid(verts[i], next);
    ctx.quadraticCurveTo(verts[i].x, verts[i].y, m.x, m.y);
  }
  ctx.closePath();
  return verts;
}

// Piece painters draw in local body space (translated + rotated by the
// caller); all jitter comes from the spawn-time piece geometry.
function drawFleshPiece(piece, r, furColor) {
  const verts = traceBlobPath(piece.blobVerts, r);
  ctx.fillStyle = GIBLET_COLORS[Math.floor(piece.colorRoll * GIBLET_COLORS.length)];
  ctx.fill();
  ctx.strokeStyle = '#660000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ragged fur edge: short tufts pointing outward along part of the outline
  ctx.strokeStyle = furColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  let t = 0;
  for (const v of verts) {
    const rel = (v.angle - piece.furStart + Math.PI * 4) % (Math.PI * 2);
    if (rel > piece.furSpan) continue;
    const len = piece.tufts[t % piece.tufts.length] * r;
    t++;
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.lineTo(v.x + Math.cos(v.angle) * len, v.y + Math.sin(v.angle) * len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawBonePiece(piece, r) {
  const len = r * piece.lenMul;
  const wid = r * piece.widMul;
  const knob = r * piece.knobMul;
  ctx.fillStyle = '#e8e0cc';
  ctx.beginPath();
  ctx.rect(-len + knob * 0.5, -wid, (len - knob * 0.5) * 2, wid * 2);
  ctx.fill();
  // Knobbed ends: paired lobes at each tip
  for (const side of [-1, 1]) {
    for (const off of [-0.55, 0.55]) {
      ctx.beginPath();
      ctx.arc(side * len, off * knob, knob * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Single shading line sells the cylinder without per-frame gradients
  ctx.strokeStyle = '#b5aa8e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-len * 0.6, wid * 0.35);
  ctx.lineTo(len * 0.6, wid * 0.35);
  ctx.stroke();
}

function drawOrganPiece(piece, r) {
  traceBlobPath(piece.blobVerts, r);
  ctx.fillStyle = '#5e1220';
  ctx.fill();
  ctx.strokeStyle = '#38080f';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Baked gloss highlight — position fixed at spawn, reads as wet sheen
  ctx.beginPath();
  ctx.ellipse(
    Math.cos(piece.hiAngle) * r * piece.hiDist,
    Math.sin(piece.hiAngle) * r * piece.hiDist,
    r * 0.3, r * 0.16, piece.hiAngle, 0, Math.PI * 2
  );
  ctx.fillStyle = 'rgba(255,235,235,0.4)';
  ctx.fill();
}

function drawGutPiece(piece, r) {
  const len = r * piece.lenMul;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Two-pass stroke: dark casing under a lighter core = tube read
  for (const [color, mul] of [['#a34a55', 1.0], ['#d98a94', 0.55]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, r * piece.tubeMul * 2 * mul);
    ctx.beginPath();
    for (let i = 0; i < piece.segs.length; i++) {
      const s = piece.segs[i];
      const x = (s.t - 0.5) * len;
      const y = s.wobble * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
}

function drawFragments(frags) {
  const now = Date.now();
  for (const body of frags) {
    const age = (now - body.plugin.born) / 4000;
    const alpha = Math.max(0, 1 - age);
    const r = (body.circleRadius || 6) * 2.2;
    const piece = body.plugin.piece;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    if (piece.type === 'bone') {
      drawBonePiece(piece, r);
    } else if (piece.type === 'organ') {
      drawOrganPiece(piece, r);
    } else if (piece.type === 'gut') {
      drawGutPiece(piece, r);
    } else {
      const variant = RAT_VARIANTS[body.plugin.variantKey || 'standard'];
      drawFleshPiece(piece, r, variant.color);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawPhysicsBody(body, fill, stroke) {
  const verts = body.vertices;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
  ctx.closePath();

  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawSpeedMeter(normalizedSpeed) {
  const cx = 60, cy = canvasH - 55, r = 38;
  const startAngle = Math.PI;
  const endAngle = Math.PI * 2;

  // bg arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke();

  // fill arc
  const fillEnd = startAngle + normalizedSpeed * Math.PI;
  const hue = 120 - normalizedSpeed * 120; // green→red
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillEnd);
  ctx.strokeStyle = `hsl(${hue},90%,50%)`;
  ctx.lineWidth = 10;
  ctx.stroke();

  // needle
  const needleAngle = startAngle + normalizedSpeed * Math.PI;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAngle) * (r - 4), cy + Math.sin(needleAngle) * (r - 4));
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // label
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('SPIN', cx, cy + 14);
}

/**
 * Marks the tail tip in READY. Not decoration: the grab is mandatory and the
 * game cannot start without it, so an unfound tip is a dead game (L0364). The
 * solid core stays fully opaque through the pulse so the target never fades
 * out, and the ring only breathes around it.
 */
function drawGrabHint(tip) {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 4);
  ctx.save();

  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 16 + pulse * 11, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(249,199,79,${0.7 - pulse * 0.4})`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#f9c74f';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = 'bold 15px system-ui';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText('Grab the tail!', tip.x, tip.y - 34);
  ctx.restore();
}

function drawPivotHand(pivot, state) {
  // Draw a simple hand/anchor indicator
  ctx.save();
  ctx.translate(pivot.x, pivot.y);

  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = state === 'SWINGING' ? '#f9c74f' : 'rgba(255,255,255,0.5)';
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // little grip lines
  for (let i = 0; i < 3; i++) {
    const y = -3 + i * 3;
    ctx.beginPath();
    ctx.moveTo(-5, y);
    ctx.lineTo(5, y);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

function drawHpBar(fraction) {
  const barW = 160;
  const barH = 12;
  const x = canvasW - barW - 20;
  const y = canvasH - 68;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x, y, barW, barH);

  const hue = fraction * 120; // green → red as HP drops
  ctx.fillStyle = `hsl(${hue},85%,50%)`;
  ctx.fillRect(x, y, barW * Math.max(0, fraction), barH);

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText('HP', x - 6, y + barH - 1);
  ctx.textAlign = 'left';
}

function drawHitCounter(hitCount) {
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(`Hits: ${hitCount}`, canvasW - 20, canvasH - 82);
  ctx.textAlign = 'left';
}

function drawHitLabel({ text, x, y, alpha, color }) {
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = color;
  ctx.font = 'bold 18px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y - 30);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

function drawCombo(combo) {
  if (combo < 2) return;
  const mult = Math.min(1 + (combo - 1) * 0.5, 3.0).toFixed(1);
  const hue = Math.max(0, 60 - (combo - 2) * 15); // yellow → orange → red
  ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
  ctx.font = `bold ${14 + Math.min(combo, 5) * 2}px system-ui`;
  ctx.textAlign = 'right';
  ctx.fillText(`${combo}× COMBO  ${mult}x`, canvasW - 20, canvasH - 96);
  ctx.textAlign = 'left';
}
