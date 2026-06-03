import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as Input from '../js/input.js'

const PIVOT = { x: 162, y: 270 }  // 0.18 * 900, 0.5 * 540

function makeCanvas() {
  const c = document.createElement('canvas')
  c.width = 900
  c.height = 540
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 540, right: 900, bottom: 540 })
  return c
}

function firePointerEvent(canvas, type, clientX, clientY) {
  const e = new PointerEvent(type, { bubbles: true, clientX, clientY })
  canvas.dispatchEvent(e)
}

let canvas

beforeEach(() => {
  canvas = makeCanvas()
  Input.init(canvas, PIVOT)
})

afterEach(() => {
  Input.detachFromCanvas()
  vi.restoreAllMocks()
})

// -------------------------------------------------------------------
// pivotMove callback — mousemove
// -------------------------------------------------------------------
describe('pivotMove on mousemove', () => {
  it('fires onPivotMove with correct x, y on mousemove', () => {  // spec row 1
    Input.attachToCanvas(canvas)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    firePointerEvent(canvas, 'pointermove', 300, 400)
    expect(cb).toHaveBeenCalledOnce()
    const pos = cb.mock.calls[0][0]
    expect(pos.x).toBeCloseTo(300)
    expect(pos.y).toBeCloseTo(400)
  })

  it('fires onPivotMove on every mousemove', () => {  // spec row 2
    Input.attachToCanvas(canvas)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    firePointerEvent(canvas, 'pointermove', 100, 200)
    firePointerEvent(canvas, 'pointermove', 150, 250)
    firePointerEvent(canvas, 'pointermove', 200, 300)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('does not require mousedown — fires on mousemove alone', () => {  // spec row 3
    Input.attachToCanvas(canvas)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    // no mousedown fired — pivot should still update
    firePointerEvent(canvas, 'pointermove', 400, 300)
    expect(cb).toHaveBeenCalledOnce()
  })
})

// -------------------------------------------------------------------
// pivotMove callback — mousedown
// -------------------------------------------------------------------
describe('pivotMove on mousedown', () => {
  it('fires onPivotMove on mousedown', () => {  // spec row 4
    Input.attachToCanvas(canvas)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    firePointerEvent(canvas, 'pointerdown', 300, 400)
    expect(cb).toHaveBeenCalledOnce()
    const pos = cb.mock.calls[0][0]
    expect(pos.x).toBeCloseTo(300)
    expect(pos.y).toBeCloseTo(400)
  })
})

// -------------------------------------------------------------------
// detachFromCanvas
// -------------------------------------------------------------------
describe('detachFromCanvas', () => {
  it('stops mousemove callbacks after detach', () => {  // spec row 5
    Input.attachToCanvas(canvas)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    Input.detachFromCanvas()
    firePointerEvent(canvas, 'pointermove', 300, 400)
    expect(cb).not.toHaveBeenCalled()
  })

  it('stops mousedown callbacks after detach', () => {  // spec row 6
    Input.attachToCanvas(canvas)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    Input.detachFromCanvas()
    firePointerEvent(canvas, 'pointerdown', 300, 400)
    expect(cb).not.toHaveBeenCalled()
  })

  it('can re-attach after detach', () => {  // spec row 7
    Input.attachToCanvas(canvas)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    Input.detachFromCanvas()
    Input.attachToCanvas(canvas)
    firePointerEvent(canvas, 'pointermove', 200, 300)
    expect(cb).toHaveBeenCalledOnce()
  })
})

// -------------------------------------------------------------------
// coordinate scaling
// -------------------------------------------------------------------
describe('coordinate scaling', () => {
  it('scales clientX/Y to canvas coordinates when canvas is scaled', () => {  // spec row 8
    const scaled = makeCanvas()
    // Canvas is 900x540 logical but displayed at 450x270 (half size)
    scaled.getBoundingClientRect = () => ({ left: 0, top: 0, width: 450, height: 270, right: 450, bottom: 270 })
    Input.init(scaled, PIVOT)
    Input.attachToCanvas(scaled)
    const cb = vi.fn()
    Input.onPivotMove(cb)
    firePointerEvent(scaled, 'pointermove', 225, 135)  // midpoint in display coords
    const pos = cb.mock.calls[0][0]
    // Should map to 450, 270 in canvas coords (2× scale factor)
    expect(pos.x).toBeCloseTo(450)
    expect(pos.y).toBeCloseTo(270)
  })
})
