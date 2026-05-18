import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as Input from '../js/input.js'
import { YOYO_VARIANTS } from '../js/yoyo.js'

const PIVOT = { x: 162, y: 270 }  // 0.18 * 900, 0.5 * 540
const STRING_LEN = 130

function makeCanvas() {
  const c = document.createElement('canvas')
  c.width = 900
  c.height = 540
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 540, right: 900, bottom: 540 })
  return c
}

function fireMouseEvent(canvas, type, clientX, clientY, button = 0) {
  const e = new MouseEvent(type, { bubbles: true, clientX, clientY, button })
  canvas.dispatchEvent(e)
}

beforeEach(() => {
  Input.init(makeCanvas(), PIVOT, STRING_LEN, 'standard')
})

afterEach(() => {
  vi.restoreAllMocks()
})

// -------------------------------------------------------------------
// State after init
// -------------------------------------------------------------------
describe('init', () => {
  it('getAngularSpeed returns 0 immediately after init', () => {  // spec row 1
    expect(Input.getAngularSpeed()).toBe(0)
  })

  it('isMouseDown returns false immediately after init', () => {  // spec row 2
    expect(Input.isMouseDown()).toBe(false)
  })

  it('getCurrentAngle returns π/2 (start below pivot)', () => {  // spec row 3
    expect(Input.getCurrentAngle()).toBeCloseTo(Math.PI / 2, 5)
  })
})

// -------------------------------------------------------------------
// Mouse down / up state
// -------------------------------------------------------------------
describe('mouse state', () => {
  it('isMouseDown returns true after mousedown on canvas', () => {  // spec row 4
    const canvas = makeCanvas()
    Input.init(canvas, PIVOT, STRING_LEN, 'standard')
    Input.attachToCanvas(canvas)
    fireMouseEvent(canvas, 'mousedown', 300, 400)
    expect(Input.isMouseDown()).toBe(true)
  })

  it('isMouseDown returns false after mousedown then mouseup', () => {  // spec row 5
    const canvas = makeCanvas()
    Input.init(canvas, PIVOT, STRING_LEN, 'standard')
    Input.attachToCanvas(canvas)
    fireMouseEvent(canvas, 'mousedown', 300, 400)
    fireMouseEvent(canvas, 'mouseup', 300, 400)
    expect(Input.isMouseDown()).toBe(false)
  })

  it('release callback is called with vx, vy, speed, angle fields', () => {  // spec row 6
    const canvas = makeCanvas()
    Input.init(canvas, PIVOT, STRING_LEN, 'standard')
    Input.attachToCanvas(canvas)

    const released = vi.fn()
    Input.onRelease(released)

    fireMouseEvent(canvas, 'mousedown', 300, 400)
    fireMouseEvent(canvas, 'mouseup', 300, 400)

    expect(released).toHaveBeenCalledOnce()
    const payload = released.mock.calls[0][0]
    expect(typeof payload.vx).toBe('number')
    expect(typeof payload.vy).toBe('number')
    expect(typeof payload.speed).toBe('number')
    expect(typeof payload.angle).toBe('number')
  })

  it('release speed is clamped to variant maxSpeed', () => {  // spec row 7
    const canvas = makeCanvas()
    Input.init(canvas, PIVOT, STRING_LEN, 'standard')
    Input.attachToCanvas(canvas)

    const released = vi.fn()
    Input.onRelease(released)

    // Spin many rapid moves to build extreme velocity
    fireMouseEvent(canvas, 'mousedown', PIVOT.x + STRING_LEN, PIVOT.y)
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2
      fireMouseEvent(canvas, 'mousemove',
        PIVOT.x + STRING_LEN * Math.cos(angle),
        PIVOT.y + STRING_LEN * Math.sin(angle))
    }
    fireMouseEvent(canvas, 'mouseup', PIVOT.x, PIVOT.y - STRING_LEN)

    const { speed } = released.mock.calls[0][0]
    expect(speed).toBeLessThanOrEqual(YOYO_VARIANTS.standard.maxSpeed)
  })

  it('getAngularSpeed returns value in [0, 1] range', () => {  // spec row 8
    const canvas = makeCanvas()
    Input.init(canvas, PIVOT, STRING_LEN, 'standard')
    Input.attachToCanvas(canvas)

    fireMouseEvent(canvas, 'mousedown', PIVOT.x + STRING_LEN, PIVOT.y)
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      fireMouseEvent(canvas, 'mousemove',
        PIVOT.x + STRING_LEN * Math.cos(angle),
        PIVOT.y + STRING_LEN * Math.sin(angle))
    }
    const spd = Input.getAngularSpeed()
    expect(spd).toBeGreaterThanOrEqual(0)
    expect(spd).toBeLessThanOrEqual(1)
  })

  it('detachFromCanvas removes listeners — no callback after detach', () => {  // spec row 9
    const canvas = makeCanvas()
    Input.init(canvas, PIVOT, STRING_LEN, 'standard')
    Input.attachToCanvas(canvas)
    Input.detachFromCanvas()

    const released = vi.fn()
    Input.onRelease(released)

    fireMouseEvent(canvas, 'mousedown', 300, 400)
    fireMouseEvent(canvas, 'mouseup', 300, 400)
    expect(released).not.toHaveBeenCalled()
    expect(Input.isMouseDown()).toBe(false)
  })
})
