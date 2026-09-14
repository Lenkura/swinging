let pivot = { x: 0, y: 0 };
let canvas = null;

const callbacks = { pivotMove: null, yank: null };

export function init(canvasEl, pivotPos) {
  canvas = canvasEl;
  pivot = { ...pivotPos };
}

export function setPivot(p) { pivot = { ...p }; }

export function onPivotMove(fn) { callbacks.pivotMove = fn; }

// Pointer-down doubles as the yank: the pivot still snaps to the pointer, and
// the press additionally asks for a rope unwind. It carries its canvas position
// because in the READY state the same press is the tail grab, which has to know
// where it landed.
export function onYank(fn) { callbacks.yank = fn; }

/**
 * Confine the hand to a level's movement zone.
 *
 * `zone` is { x, y, w, h } as fractions of the canvas, x/y being the top-left
 * corner. Returns the pointer position clamped inside it, in canvas pixels.
 * A level without a zone passes through untouched, so this is safe to call
 * unconditionally.
 *
 * The pivot keeps following the pointer inside the zone and simply stops at the
 * boundary - it does not teleport or lag. Note this bounds WHERE the hand may
 * be, not how fast it may move: a per-frame speed cap was tried in 2026-09-11
 * and rejected for capping the skill ceiling. Limiting position is intended to
 * have the opposite effect, by making placement matter.
 */
export function clampToZone(x, y, zone, canvasW, canvasH) {
  if (!zone) return { x, y };
  const left = zone.x * canvasW;
  const top = zone.y * canvasH;
  const right = left + zone.w * canvasW;
  const bottom = top + zone.h * canvasH;
  return {
    x: Math.min(Math.max(x, left), right),
    y: Math.min(Math.max(y, top), bottom),
  };
}

/**
 * Is a pointer press close enough to the tail tip to count as grabbing it?
 * Generous by design: the tip is a 5px physics body, which is nowhere near a
 * touch target, and missing the grab leaves the player unable to start at all.
 */
export function isGrabHit(pointer, tip, radius) {
  if (!pointer || !tip) return false;
  const dx = pointer.x - tip.x;
  const dy = pointer.y - tip.y;
  return dx * dx + dy * dy <= radius * radius;
}

export function attachToCanvas(canvasEl) {
  canvas = canvasEl;
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.style.touchAction = 'none';
}

export function detachFromCanvas() {
  if (!canvas) return;
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerdown', onPointerDown);
  canvas.style.touchAction = '';
}

function getCanvasXY(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function onPointerDown(e) {
  const pos = getCanvasXY(e);
  if (callbacks.pivotMove) callbacks.pivotMove({ x: pos.x, y: pos.y });
  if (callbacks.yank) callbacks.yank({ x: pos.x, y: pos.y });
}

function onPointerMove(e) {
  const pos = getCanvasXY(e);
  if (callbacks.pivotMove) callbacks.pivotMove({ x: pos.x, y: pos.y });
}
