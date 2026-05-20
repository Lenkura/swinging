import { YOYO_VARIANTS } from './yoyo.js';
import { MATERIALS } from './target.js';
import * as Particles from './particles.js';

let canvas, ctx;
let canvasW, canvasH;

// Trail ring buffer
const TRAIL_MAX = 30;
const trail = [];
let spinAngle = 0;

// Per-level render caches (invalidated when level identity changes)
let cachedGradient = null;
let cachedGradientKey = '';
let cachedGroundCanvas = null;
let cachedGroundKey = '';

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

export function updateTrail(x, y) {
  trail.push({ x, y });
  if (trail.length > TRAIL_MAX) trail.shift();
}

export function clearTrail() { trail.length = 0; }

export function updateSpin(angularVelocity, dt) {
  spinAngle += angularVelocity * dt;
}

export function draw({
  state,
  mode = 'swing',
  level,
  pivot,
  yoyoBody,
  targetBodies,
  fragmentBodies,
  stringConstraint,
  angularSpeed,
  aimPoints,
  hpFraction = 1.0,
  hitCount = 0,
  comboCount = 0,
}) {
  ctx.clearRect(0, 0, canvasW, canvasH);

  drawBackground(level);
  drawGround(level);

  if (stringConstraint && (state === 'SWINGING' || state === 'IDLE_ARMED')) {
    drawString(pivot, yoyoBody, angularSpeed, stringConstraint);
  }

  drawTrail(yoyoBody, level);
  drawFragments(fragmentBodies);
  drawTargets(targetBodies);

  if (yoyoBody) {
    const v = YOYO_VARIANTS[yoyoBody.plugin?.variantKey || 'standard'];
    drawYoyo(yoyoBody, v);
  }

  if (aimPoints && aimPoints.length > 1) drawAimGuide(aimPoints);

  Particles.draw(ctx);

  drawSpeedMeter(angularSpeed);
  if (mode === 'swing' || stringConstraint) drawPivotHand(pivot, state);
  if (mode === 'push') {
    drawHpBar(hpFraction);
    drawHitCounter(hitCount);
    drawCombo(comboCount);
  }
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

function drawString(pivot, yoyo, normalizedSpeed, constraint) {
  if (!yoyo) return;
  const px = pivot.x, py = pivot.y;
  const ex = yoyo.position.x, ey = yoyo.position.y;

  const dx = ex - px;
  const dy = ey - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return;

  const perpX = -dy / dist;
  const perpY = dx / dist;

  // Gravity sag: stronger when rope is horizontal, zero when vertical
  const horizontalFraction = Math.abs(dx) / dist;
  const gravSag = horizontalFraction * dist * 0.18;

  // Extra sag when rope is slack (yoyo closer than constraint length)
  const slack = Math.max(0, (constraint?.length ?? dist) - dist);
  const slackSag = slack * 0.4;

  const totalSag = gravSag + slackSag;

  // Lateral bow from swing speed
  const speedBow = normalizedSpeed * 16;

  // Build 8 rope points with parabolic gravity + speed bow
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

  // Draw smooth curve through points (Catmull-Rom style via quadratic beziers)
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 3;
  ctx.strokeStyle = '#3d2b1f';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawTrail(yoyo, level) {
  if (!yoyo || trail.length < 2) return;
  const v = YOYO_VARIANTS[yoyo.plugin?.variantKey || 'standard'];
  for (let i = 1; i < trail.length; i++) {
    const alpha = (i / trail.length) * 0.45;
    const r = v.radius * (i / trail.length) * 0.7;
    ctx.beginPath();
    ctx.arc(trail[i].x, trail[i].y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fillStyle = v.trailColor + alpha + ')';
    ctx.fill();
  }
}

function drawYoyo(body, variant) {
  const { x, y } = body.position;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spinAngle);

  // drop shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  // outer circle fill
  ctx.beginPath();
  ctx.arc(0, 0, variant.radius, 0, Math.PI * 2);
  ctx.fillStyle = variant.color;
  ctx.fill();

  // outer ring outline (cartoon)
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = variant.outlineColor;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // inner groove ring
  ctx.beginPath();
  ctx.arc(0, 0, variant.radius * 0.65, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // axle dot
  ctx.beginPath();
  ctx.arc(0, 0, variant.radius * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = variant.trimColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // spin marker
  ctx.beginPath();
  ctx.moveTo(variant.radius * 0.28, 0);
  ctx.lineTo(variant.radius * 0.88, 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // crack overlay when damaged
  if (body.plugin?.cracked && body.plugin?.crackPattern) {
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 1.5;
    for (const { angle, len } of body.plugin.crackPattern) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * len * variant.radius * 1.8, Math.sin(angle) * len * variant.radius * 1.8);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawTargets(targets) {
  for (const body of targets) {
    const mat = MATERIALS[body.plugin.materialKey];
    drawPhysicsBody(body, body.plugin.cracked ? mat.crackedColor : mat.color, mat.outlineColor);
    if (body.plugin.cracked && body.plugin.crackPattern) drawCracks(body, body.plugin.crackPattern);

    // material label
    const { x, y } = body.position;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(mat.label, x, y + 4);

    // glow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    const verts = body.vertices;
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.fillStyle = mat.glowColor;
    ctx.fill();
    ctx.restore();

  }
}

function drawCracks(body, pattern) {
  const { x, y } = body.position;
  const w = body.plugin.width;
  const h = body.plugin.height;
  const maxR = Math.min(w, h) * 0.45;
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

function drawFragments(frags) {
  const now = Date.now();
  for (const body of frags) {
    const v = YOYO_VARIANTS[body.plugin.variantKey || 'standard'];
    const age = (now - body.plugin.born) / 4000;
    const alpha = Math.max(0, 1 - age);
    const r = body.circleRadius || 6;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, r, 0, Math.PI * 2);
    ctx.fillStyle = v.color;
    ctx.fill();
    ctx.strokeStyle = v.outlineColor;
    ctx.lineWidth = 2;
    ctx.stroke();
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

function drawAimGuide(points) {
  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = 'rgba(255,255,200,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
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
