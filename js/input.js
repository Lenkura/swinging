import { YOYO_VARIANTS } from './yoyo.js';

let pivot = { x: 0, y: 0 };
let stringLength = 130;
let variantKey = 'standard';

let mouseX = 0, mouseY = 0;
let prevAngle = null;
let prevTime = null;
let smoothedAV = 0;   // radians/second, signed
let currAngle = 0;

let mouseDown = false;
let canvas = null;

let inputMode = 'swing'; // 'swing' | 'push'

const callbacks = { swing: null, release: null, pivotMove: null };

export function init(canvasEl, pivotPos, strLen, variant, mode = 'swing') {
  canvas = canvasEl;
  pivot = { ...pivotPos };
  stringLength = strLen;
  variantKey = variant;
  inputMode = mode;
  smoothedAV = 0;
  mouseDown = false;
  prevAngle = null;
  prevTime = null;
  currAngle = Math.PI / 2; // start below pivot
}

export function setPivot(p) { pivot = { ...p }; }
export function setStringLength(l) { stringLength = l; }

export function onSwing(fn) { callbacks.swing = fn; }
export function onRelease(fn) { callbacks.release = fn; }
export function onPivotMove(fn) { callbacks.pivotMove = fn; }

export function attachToCanvas(canvasEl) {
  canvas = canvasEl;
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp);
}

export function detachFromCanvas() {
  if (!canvas) return;
  canvas.removeEventListener('mousemove', onMouseMove);
  canvas.removeEventListener('mousedown', onMouseDown);
  canvas.removeEventListener('mouseup', onMouseUp);
  canvas.removeEventListener('mouseleave', onMouseUp);
}

function getCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function onMouseDown(e) {
  mouseDown = true;
  const pos = getCanvasXY(e);
  mouseX = pos.x;
  mouseY = pos.y;
  prevTime = performance.now();

  if (inputMode === 'push') {
    if (callbacks.pivotMove) callbacks.pivotMove({ x: pos.x, y: pos.y });
    return;
  }

  currAngle = Math.atan2(mouseY - pivot.y, mouseX - pivot.x);
  prevAngle = currAngle;
  smoothedAV = 0;
}

function onMouseMove(e) {
  const pos = getCanvasXY(e);

  // Push mode: pivot always follows mouse, no hold required
  if (inputMode === 'push') {
    mouseX = pos.x;
    mouseY = pos.y;
    if (callbacks.pivotMove) callbacks.pivotMove({ x: pos.x, y: pos.y });
    return;
  }

  if (!mouseDown) {
    mouseX = pos.x;
    mouseY = pos.y;
    return;
  }

  const now = performance.now();
  const dt = Math.min((now - (prevTime || now)) / 1000, 0.05);
  prevTime = now;

  // Swing mode
  mouseX = pos.x;
  mouseY = pos.y;

  const newAngle = Math.atan2(mouseY - pivot.y, mouseX - pivot.x);
  let delta = newAngle - (prevAngle ?? newAngle);
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  const rawAV = dt > 0 ? delta / dt : 0;

  if (smoothedAV !== 0 && Math.sign(rawAV) !== Math.sign(smoothedAV)) {
    smoothedAV *= 0.92;
  }

  smoothedAV = 0.85 * smoothedAV + 0.15 * rawAV;

  const variant = YOYO_VARIANTS[variantKey];
  const maxAV = variant.maxSpeed / stringLength;
  smoothedAV = Math.max(-maxAV, Math.min(maxAV, smoothedAV));

  currAngle = newAngle;
  prevAngle = newAngle;

  const yoyoX = pivot.x + stringLength * Math.cos(currAngle);
  const yoyoY = pivot.y + stringLength * Math.sin(currAngle);

  if (callbacks.swing) {
    callbacks.swing({ x: yoyoX, y: yoyoY, angle: currAngle, angularVelocity: smoothedAV });
  }
}

function onMouseUp() {
  if (!mouseDown) return;
  mouseDown = false;

  if (inputMode === 'push') return; // no release mechanic in push mode

  const variant = YOYO_VARIANTS[variantKey];
  const speed = Math.abs(smoothedAV) * stringLength;
  const clampedSpeed = Math.min(speed, variant.maxSpeed);
  const dir = Math.sign(smoothedAV);

  const tangentAngle = currAngle + dir * Math.PI / 2;
  const vx = Math.cos(tangentAngle) * clampedSpeed;
  const vy = Math.sin(tangentAngle) * clampedSpeed;

  if (callbacks.release) {
    callbacks.release({ vx, vy, speed: clampedSpeed, angle: currAngle });
  }

  smoothedAV = 0;
}

export function getAngularSpeed() {
  if (inputMode === 'push') return 0; // main.js reads speed from physics body
  const variant = YOYO_VARIANTS[variantKey];
  const maxAV = variant.maxSpeed / stringLength;
  return Math.min(Math.abs(smoothedAV) / maxAV, 1);
}

export function getCurrentAngle() { return currAngle; }
export function isMouseDown() { return mouseDown; }
