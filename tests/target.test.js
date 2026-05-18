import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { evaluateImpact, getFragmentVerts, generateCrackPattern, MATERIALS } from '../js/target.js'

const glass = MATERIALS.glass   // strength: 220, crackThreshold: 85
const wood  = MATERIALS.wood    // strength: 620, crackThreshold: 260
const steel = MATERIALS.steel   // strength: 1400, crackThreshold: 800

// -------------------------------------------------------------------
// evaluateImpact
// -------------------------------------------------------------------
describe('evaluateImpact', () => {
  // Happy paths
  it('returns SHATTER when impulse exceeds material strength', () => {  // spec row 1
    expect(evaluateImpact(300, 1.0, glass, 1.0)).toBe('SHATTER')
  })

  it('returns CRACK when impulse is between crackThreshold and strength', () => {  // spec row 2
    expect(evaluateImpact(150, 1.0, glass, 1.0)).toBe('CRACK')
  })

  it('returns SURVIVE when impulse is below crackThreshold', () => {  // spec row 3
    expect(evaluateImpact(50, 1.0, glass, 1.0)).toBe('SURVIVE')
  })

  // Boundary: exact thresholds
  it('returns SHATTER at exact strength boundary', () => {  // spec row 4
    expect(evaluateImpact(glass.strength, 1.0, glass, 1.0)).toBe('SHATTER')
  })

  it('returns CRACK at exact crackThreshold boundary', () => {  // spec row 5
    expect(evaluateImpact(glass.crackThreshold, 1.0, glass, 1.0)).toBe('CRACK')
  })

  it('returns SURVIVE one unit below crackThreshold', () => {  // spec row 6
    expect(evaluateImpact(glass.crackThreshold - 1, 1.0, glass, 1.0)).toBe('SURVIVE')
  })

  // Unhappy paths: zero inputs
  it('returns SURVIVE when speed is 0', () => {  // spec row 7
    expect(evaluateImpact(0, 1.0, glass, 1.0)).toBe('SURVIVE')
  })

  it('returns SURVIVE when mass is 0', () => {  // spec row 8
    expect(evaluateImpact(500, 0, glass, 1.0)).toBe('SURVIVE')
  })

  it('returns SURVIVE when impactMultiplier is 0', () => {  // spec row 9
    expect(evaluateImpact(500, 1.0, glass, 0)).toBe('SURVIVE')
  })

  // Cross-variant: multiplier effect
  it('heavy yoyo (2.2×) shatters glass that standard (1.0×) only cracks', () => {  // spec row 10
    const speed = 120  // impulse with 1.0 mult = 120 → CRACK (85–220); with 2.2 mult = 264 → SHATTER
    expect(evaluateImpact(speed, 1.0, glass, 1.0)).toBe('CRACK')
    expect(evaluateImpact(speed, 1.0, glass, 2.2)).toBe('SHATTER')
  })

  it('returns SHATTER on very large speed for any material', () => {
    expect(evaluateImpact(100000, 1.0, steel, 1.0)).toBe('SHATTER')
  })
})

// -------------------------------------------------------------------
// getFragmentVerts
// -------------------------------------------------------------------
describe('getFragmentVerts', () => {
  it('returns 10-polygon set when count >= 10', () => {  // spec row 1
    expect(getFragmentVerts(10)).toHaveLength(10)
  })

  it('returns 6-polygon set when count < 10', () => {  // spec row 2
    expect(getFragmentVerts(5)).toHaveLength(6)
  })

  it('returns 6-polygon set at count = 6 (exact match)', () => {  // spec row 3
    expect(getFragmentVerts(6)).toHaveLength(6)
  })

  it('returns 6-polygon set at count = 9 (just below threshold)', () => {  // spec row 4
    expect(getFragmentVerts(9)).toHaveLength(6)
  })

  it('returns 6-polygon set at count = 0 (steel has 0 fragments)', () => {  // spec row 5
    expect(getFragmentVerts(0)).toHaveLength(6)
  })

  it('returns 10-polygon set at count = 11', () => {
    expect(getFragmentVerts(11)).toHaveLength(10)
  })

  it('each polygon is an array of [x, y] vertex pairs', () => {  // spec row 6
    const verts = getFragmentVerts(10)
    for (const poly of verts) {
      expect(Array.isArray(poly)).toBe(true)
      for (const vertex of poly) {
        expect(Array.isArray(vertex)).toBe(true)
        expect(vertex).toHaveLength(2)
        expect(typeof vertex[0]).toBe('number')
        expect(typeof vertex[1]).toBe('number')
      }
    }
  })
})

// -------------------------------------------------------------------
// generateCrackPattern
// -------------------------------------------------------------------
describe('generateCrackPattern', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns exactly count lines', () => {  // spec row 1
    expect(generateCrackPattern(6)).toHaveLength(6)
    expect(generateCrackPattern(3)).toHaveLength(3)
  })

  it('each line has angle and len properties', () => {  // spec row 2
    const lines = generateCrackPattern(5)
    for (const line of lines) {
      expect(typeof line.angle).toBe('number')
      expect(typeof line.len).toBe('number')
    }
  })

  it('len is within [0.2, 0.55] — checked at both extremes via mock', () => {  // spec row 3
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const linesMin = generateCrackPattern(4)
    linesMin.forEach(l => expect(l.len).toBeCloseTo(0.2, 5))

    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    const linesMax = generateCrackPattern(4)
    linesMax.forEach(l => expect(l.len).toBeLessThanOrEqual(0.55))
    linesMax.forEach(l => expect(l.len).toBeGreaterThanOrEqual(0.2))
  })

  it('angle is within [0, 2π] when random returns extremes', () => {  // spec row 4
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const linesZero = generateCrackPattern(4)
    linesZero.forEach(l => expect(l.angle).toBeCloseTo(0, 5))

    vi.spyOn(Math, 'random').mockReturnValue(0.999999)
    const linesMax = generateCrackPattern(4)
    linesMax.forEach(l => {
      expect(l.angle).toBeGreaterThanOrEqual(0)
      expect(l.angle).toBeLessThanOrEqual(Math.PI * 2)
    })
  })

  it('count = 0 returns empty array', () => {  // spec row 5
    expect(generateCrackPattern(0)).toEqual([])
  })

  it('generateCrackPattern(6) returns 6 lines (as called in physics.js)', () => {  // spec row 6
    expect(generateCrackPattern(6)).toHaveLength(6)
  })
})
