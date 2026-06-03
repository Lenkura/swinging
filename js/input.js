let pivot = { x: 0, y: 0 };
let canvas = null;

const callbacks = { pivotMove: null };

export function init(canvasEl, pivotPos) {
  canvas = canvasEl;
  pivot = { ...pivotPos };
}

export function setPivot(p) { pivot = { ...p }; }

export function onPivotMove(fn) { callbacks.pivotMove = fn; }

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
}

function onPointerMove(e) {
  const pos = getCanvasXY(e);
  if (callbacks.pivotMove) callbacks.pivotMove({ x: pos.x, y: pos.y });
}
