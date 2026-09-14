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

// -------------------------------------------------------------------
// isGrabHit — the tail pick-up test. Generous on purpose: the tip is a
// 5px physics body, and a missed grab leaves the player unable to start
// the level at all, so a false negative costs far more than a false positive.
// -------------------------------------------------------------------
describe('isGrabHit', () => {
  const tip = { x: 350, y: 566 }

  it('a press exactly on the tip is a hit', () => {
    expect(Input.isGrabHit({ x: 350, y: 566 }, tip, 44)).toBe(true)
  })

  it('a press inside the radius is a hit', () => {
    expect(Input.isGrabHit({ x: 380, y: 586 }, tip, 44)).toBe(true)   // 36.1 away
  })

  it('a press just outside the radius is a miss', () => {
    expect(Input.isGrabHit({ x: 350, y: 611 }, tip, 44)).toBe(false)  // 45 away
  })

  it('the boundary itself counts as a hit', () => {
    expect(Input.isGrabHit({ x: 394, y: 566 }, tip, 44)).toBe(true)   // exactly 44
  })

  it('is circular, not a bounding box', () => {
    // Inside a 44 square, outside a 44 circle: 56.6 away on the diagonal.
    expect(Input.isGrabHit({ x: 390, y: 606 }, tip, 44)).toBe(false)
  })

  it('a missing pointer or tip is a miss, never a throw', () => {
    expect(Input.isGrabHit(null, tip, 44)).toBe(false)
    expect(Input.isGrabHit({ x: 350, y: 566 }, null, 44)).toBe(false)
  })
})

// -------------------------------------------------------------------
// clampToZone — confines the hand to a level's movement zone.
// Zone is {x, y, w, h} as canvas fractions, x/y the top-left corner.
// -------------------------------------------------------------------
describe('clampToZone', () => {
  const W = 1100
  const H = 620
  // x 220..660, y 124..434
  const zone = { x: 0.2, y: 0.2, w: 0.4, h: 0.5 }
  const clamp = (x, y, z = zone) => Input.clampToZone(x, y, z, W, H)

  it('a point inside passes through untouched', () => {
    expect(clamp(400, 300)).toEqual({ x: 400, y: 300 })
  })

  it('clamps past each edge independently', () => {
    expect(clamp(100, 300).x).toBeCloseTo(220)   // left
    expect(clamp(900, 300).x).toBeCloseTo(660)   // right
    expect(clamp(400, 50).y).toBeCloseTo(124)    // top
    expect(clamp(400, 600).y).toBeCloseTo(434)   // bottom
  })

  it('leaves the other axis alone when one is clamped', () => {
    expect(clamp(100, 300).y).toBe(300)
    expect(clamp(400, 600).x).toBe(400)
  })

  it('clamps both axes at a corner', () => {
    const p = clamp(50, 900)
    expect(p.x).toBeCloseTo(220)
    expect(p.y).toBeCloseTo(434)
  })

  it('the boundary itself is inside', () => {
    expect(clamp(220, 124)).toEqual({ x: 220, y: 124 })
    expect(clamp(660, 434)).toEqual({ x: 660, y: 434 })
  })

  it('a level with no zone is unaffected — this is what keeps it inert', () => {
    expect(Input.clampToZone(9999, -9999, null, W, H)).toEqual({ x: 9999, y: -9999 })
    expect(Input.clampToZone(400, 300, undefined, W, H)).toEqual({ x: 400, y: 300 })
  })

  it('scales with the canvas rather than assuming a size', () => {
    const half = Input.clampToZone(9999, 9999, zone, W / 2, H / 2)
    expect(half.x).toBeCloseTo(660 / 2)
    expect(half.y).toBeCloseTo(434 / 2)
  })
})

