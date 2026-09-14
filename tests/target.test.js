import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getFragmentVerts, generateCrackPattern, MATERIALS,
  applyDamageCap, MAX_HIT_DAMAGE_FRACTION,
  SHIELD_TIERS, resolveShieldTier, MAX_OBSERVED_CONTACT_SPEED,
} from '../js/target.js'

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

// -------------------------------------------------------------------
// Shield tiers. Guards are on SHAPE, not on pinned speeds (L0381), so
// the next balance pass can retune freely and still be caught if it
// breaks monotonicity or puts a tier out of reach.
// -------------------------------------------------------------------
describe('SHIELD_TIERS', () => {
  const names = Object.keys(SHIELD_TIERS)

  it('every tier names a real material and a positive speed', () => {
    for (const [name, t] of Object.entries(SHIELD_TIERS)) {
      expect(MATERIALS[t.material], `${name}.material`).toBeDefined()
      expect(t.breakSpeed).toBeGreaterThan(0)
    }
  })

  it('tiers rise: light < medium < heavy', () => {
    expect(SHIELD_TIERS.light.breakSpeed).toBeLessThan(SHIELD_TIERS.medium.breakSpeed)
    expect(SHIELD_TIERS.medium.breakSpeed).toBeLessThan(SHIELD_TIERS.heavy.breakSpeed)
  })

  it('every tier is REACHABLE — the guard the 180 tier needed', () => {
    // breakSpeed 180 was never broken in 36 human contacts; the fastest contact
    // ever recorded was 150.8. A tier above that is unreachable, not hard.
    for (const [name, t] of Object.entries(SHIELD_TIERS)) {
      expect(t.breakSpeed, `${name} must be reachable`).toBeLessThan(MAX_OBSERVED_CONTACT_SPEED)
    }
  })

  it('tiers are visually distinct, or the tier cannot guide anyone', () => {
    const materials = names.map(n => SHIELD_TIERS[n].material)
    expect(new Set(materials).size).toBe(names.length)
  })
})

describe('resolveShieldTier', () => {
  it('fills material and breakSpeed from the tier', () => {
    const out = resolveShieldTier({ isShield: true, shieldTier: 'medium', w: 12, h: 88 })
    expect(out.breakSpeed).toBe(SHIELD_TIERS.medium.breakSpeed)
    expect(out.material).toBe(SHIELD_TIERS.medium.material)
  })

  it('resolves each tier to its own values', () => {
    for (const [name, t] of Object.entries(SHIELD_TIERS)) {
      const out = resolveShieldTier({ isShield: true, shieldTier: name })
      expect(out.breakSpeed).toBe(t.breakSpeed)
      expect(out.material).toBe(t.material)
    }
  })

  it('leaves a non-shield target completely alone', () => {
    const td = { shape: 'circle', r: 36, material: 'glass' }
    expect(resolveShieldTier(td)).toBe(td)
  })

  it('does not mutate the level data it is given', () => {
    const td = { isShield: true, shieldTier: 'heavy' }
    const out = resolveShieldTier(td)
    expect(td.material).toBeUndefined()
    expect(td.breakSpeed).toBeUndefined()
    expect(out).not.toBe(td)
  })

  it('throws on an unknown tier rather than silently yielding breakSpeed 0', () => {
    // A silent default would make the shield shatter on contact, which is worse
    // than the bug it replaces because it would look like it worked.
    expect(() => resolveShieldTier({ isShield: true, shieldTier: 'titanium' })).toThrow(/titanium/)
  })

  it('the tier wins over any material the level also sets', () => {
    const out = resolveShieldTier({ isShield: true, shieldTier: 'light', material: 'steel' })
    expect(out.material).toBe(SHIELD_TIERS.light.material)
  })
})
