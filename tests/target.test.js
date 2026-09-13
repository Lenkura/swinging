import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  evaluateImpact, getFragmentVerts, generateCrackPattern, MATERIALS,
  applyDamageCap, MAX_HIT_DAMAGE_FRACTION,
} from '../js/target.js'

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

// -------------------------------------------------------------------
// applyDamageCap — the per-hit bound on HP loss.
// Measured 2026-09-13: 34% of human hits would otherwise end a level
// outright. Asserted against MAX_HIT_DAMAGE_FRACTION rather than the
// literal 40, so retuning the fraction stays legal (L0352).
// -------------------------------------------------------------------
describe('applyDamageCap', () => {
  const HP = 100
  const ceiling = HP * MAX_HIT_DAMAGE_FRACTION

  it('passes a small hit through untouched', () => {
    expect(applyDamageCap(12.5, HP)).toBe(12.5)
  })

  it('clamps a hit that would end the level outright', () => {
    expect(applyDamageCap(426, HP)).toBe(ceiling)
  })

  it('the ceiling itself passes through unchanged', () => {
    expect(applyDamageCap(ceiling, HP)).toBe(ceiling)
  })

  it('a hit just under the ceiling is not clamped', () => {
    expect(applyDamageCap(ceiling - 0.01, HP)).toBeCloseTo(ceiling - 0.01)
  })

  it('scales with maxHp rather than assuming 100', () => {
    expect(applyDamageCap(999, 250)).toBe(250 * MAX_HIT_DAMAGE_FRACTION)
    expect(applyDamageCap(999, 50)).toBe(50 * MAX_HIT_DAMAGE_FRACTION)
  })

  it('guarantees no hit can end a full-HP rat on its own', () => {
    expect(applyDamageCap(Number.MAX_SAFE_INTEGER, HP)).toBeLessThan(HP)
  })

  it('leaves zero and negative values alone rather than inventing damage', () => {
    expect(applyDamageCap(0, HP)).toBe(0)
    expect(applyDamageCap(-5, HP)).toBe(-5)
  })
})

// -------------------------------------------------------------------
// Material spread — a shape assertion, not pinned values (L0381).
// The point of the 2026-09-13 rebalance is that no material dominates,
// which is a property of the spread rather than of any one number.
// -------------------------------------------------------------------
describe('material yoyoDamage spread', () => {
  const values = Object.values(MATERIALS).map(m => m.yoyoDamage)

  it('every material declares a positive yoyoDamage', () => {
    for (const [name, m] of Object.entries(MATERIALS)) {
      expect(typeof m.yoyoDamage, `${name}.yoyoDamage`).toBe('number')
      expect(m.yoyoDamage).toBeGreaterThan(0)
    }
  })

  it('no material deals more than 1.5x another', () => {
    // Steel was 2.67x glass, which made it strictly better and inverted the
    // difficulty curve: tougher material damaged your own rat more.
    expect(Math.max(...values) / Math.min(...values)).toBeLessThanOrEqual(1.5)
  })

  it('keeps steel above glass, so materials still differ in character', () => {
    expect(MATERIALS.steel.yoyoDamage).toBeGreaterThan(MATERIALS.glass.yoyoDamage)
  })
})
