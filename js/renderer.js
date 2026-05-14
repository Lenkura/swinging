import { YOYO_VARIANTS } from './yoyo.js';
import { MATERIALS } from './target.js';
import * as Particles from './particles.js';

let canvas, ctx;
let canvasW, canvasH;

// Trail ring buffer
const TRAIL_MAX = 30;
const trail = [];
let spinAngle = 0;

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
  level,
  pivot,
  yoyoBody,
  targetBodies,
  fragmentBodies,
  stringConstraint,
  angularSpeed,
  releaseTrail,
  aimPoints,
}) {
  ctx.clearRect(0, 0, canvasW, canvasH);

  drawBackground(level);
  drawGround(level);

  if (state === 'SWINGING' || state === 'IDLE_ARMED') {
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
  drawPivotHand(pivot, state);
}

function drawBackground(level) {
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  grad.addColorStop(0, level.background[0]);
  grad.addColorStop(1, level.background[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);
}

function drawGround(level) {
  const groundY = canvasH - 40;
  ctx.fillStyle = level.groundColor;
  ctx.fillRect(0, groundY, canvasW, 40);

  // cartoon outline
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(canvasW, groundY);
  ctx.stroke();

  // grass tufts
  ctx.fillStyle = '#3a8f3a';
  for (let x = 10; x < canvasW; x += 22) {
    const h = 6 + Math.sin(x * 0.3) * 3;
    ctx.fillRect(x, groundY - h, 4, h);
  }
}

function drawString(pivot, yoyo, normalizedSpeed, constraint) {
  if (!yoyo) return;
  const ex = yoyo.position.x;
  const ey = yoyo.position.y;

  const dx = ex - pivot.x;
  const dy = ey - pivot.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  // perp unit
  const perpX = -dy / len;
  const perpY = dx / len;
  const bow = normalizedSpeed * 22;
  const midX = (pivot.x + ex) / 2 + perpX * bow;
  const midY = (pivot.y + ey) / 2 + perpY * bow;

  // shadow
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.quadraticCurveTo(midX, midY, ex, ey);
  ctx.strokeStyle = '#3d2b1f';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
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

  ctx.restore();
}

function drawTargets(targets) {
  for (const body of targets) {
    const mat = MATERIALS[body.plugin.materialKey];
    drawPhysicsBody(body, body.plugin.cracked ? mat.crackedColor : mat.color, mat.outlineColor);

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

    // crack overlay
    if (body.plugin.cracked && body.plugin.crackPattern) {
      drawCracks(body, body.plugin.crackPattern);
    }
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
  for (const body of frags) {
    const mat = MATERIALS[body.plugin.materialKey];
    const age = (Date.now() - body.plugin.born) / 4000;
    ctx.globalAlpha = Math.max(0, 1 - age);
    drawPhysicsBody(body, mat.crackedColor, mat.outlineColor);
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
