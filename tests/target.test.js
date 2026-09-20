import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getFragmentVerts, generateCrackPattern, MATERIALS,
  applyDamageCap, MAX_HIT_DAMAGE_FRACTION,
  SHIELD_TIERS, resolveShieldTier, MAX_OBSERVED_CONTACT_SPEED,
  SPIKE_CAP_FRACTION, SPIKE_WINDOW, SPIKE_DIRECTIONS, wedgeVerts, isSpikeHit,
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

// -------------------------------------------------------------------
// shieldSpeedScale — a level's factor for what it physically permits.
// An absolute threshold does not survive a layout change: zones halved
// arrival speed and the heavy tier went from breaking in 57% of runs to
// 2% of contacts. The table keeps the ordering; the level supplies the scale.
// -------------------------------------------------------------------
describe('resolveShieldTier — shieldSpeedScale', () => {
  const shield = tier => ({ isShield: true, shieldTier: tier })

  it('an absent scale leaves every tier exactly as the table declares it', () => {
    for (const [name, t] of Object.entries(SHIELD_TIERS)) {
      expect(resolveShieldTier(shield(name)).breakSpeed, name).toBe(t.breakSpeed)
    }
  })

  it('a scale of 1 is identical to omitting it', () => {
    for (const name of Object.keys(SHIELD_TIERS)) {
      expect(resolveShieldTier(shield(name), 1).breakSpeed)
        .toBe(resolveShieldTier(shield(name)).breakSpeed)
    }
  })

  it('scales every tier by the same factor', () => {
    for (const [name, t] of Object.entries(SHIELD_TIERS)) {
      expect(resolveShieldTier(shield(name), 0.75).breakSpeed, name).toBeCloseTo(t.breakSpeed * 0.75)
    }
  })

  it('preserves the ordering under any sane scale — the table owns the ranking', () => {
    for (const scale of [0.4, 0.75, 1, 1.5]) {
      const at = n => resolveShieldTier(shield(n), scale).breakSpeed
      expect(at('light'), `scale ${scale}`).toBeLessThan(at('medium'))
      expect(at('medium'), `scale ${scale}`).toBeLessThan(at('heavy'))
    }
  })

  it('does not scale a non-shield target', () => {
    const td = { shape: 'circle', material: 'glass' }
    expect(resolveShieldTier(td, 0.5)).toBe(td)
  })
})

// -------------------------------------------------------------------
// Spikes. The reward is a RAISED CAP rather than a damage multiplier,
// because 54.5% of measured hits already clamp at the ordinary cap - a
// multiplier would be invisible on the hardest hits.
// -------------------------------------------------------------------
describe('spike cap', () => {
  const HP = 100

  it('is higher than the ordinary cap, or it rewards nothing', () => {
    expect(SPIKE_CAP_FRACTION).toBeGreaterThan(MAX_HIT_DAMAGE_FRACTION)
  })

  it('still bounds a monster hit — it raises the ceiling, it does not remove it', () => {
    expect(applyDamageCap(99999, HP, SPIKE_CAP_FRACTION)).toBe(HP * SPIKE_CAP_FRACTION)
    expect(applyDamageCap(99999, HP, SPIKE_CAP_FRACTION)).toBeLessThan(HP)
  })

  it('leaves a hit under the ordinary cap completely alone', () => {
    expect(applyDamageCap(22, HP, SPIKE_CAP_FRACTION)).toBe(22)
  })

  it('defaults to the ordinary cap, so every existing call is unchanged', () => {
    expect(applyDamageCap(999, HP)).toBe(HP * MAX_HIT_DAMAGE_FRACTION)
  })
})

describe('wedgeVerts', () => {
  const dirs = Object.keys(SPIKE_DIRECTIONS)

  it('offers all eight compass directions', () => {
    expect(dirs.sort()).toEqual(['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w'])
  })

  it('throws on an unknown direction rather than defaulting', () => {
    // A silent default would put the open face somewhere the level never asked
    // for, and the silhouette is the whole affordance.
    expect(() => wedgeVerts(60, 'up')).toThrow(/Unknown spikeDir/)
  })

  it('is convex — Matter would need poly-decomp otherwise, and it was deleted', () => {
    for (const d of dirs) {
      const v = wedgeVerts(60, d)
      let sign = 0
      for (let i = 0; i < v.length; i++) {
        const a = v[i], b = v[(i + 1) % v.length], c = v[(i + 2) % v.length]
        const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
        if (Math.abs(cross) < 1e-9) continue
        const s = Math.sign(cross)
        if (sign === 0) sign = s
        expect(s, `${d} turns back on itself`).toBe(sign)
      }
    }
  })

  it('leads with the SPIKE along its named direction', () => {
    // Stated as a projection along the spike direction, because earlier
    // versions of this test guessed at the geometry and were wrong twice: the
    // blunt face is not the furthest-apart pair of vertices (that is a
    // diagonal), and the spike is not the vertex furthest from centre (the
    // back face's own corners are further out). What is true: along the spike
    // direction, one vertex alone sits at the maximum.
    for (const [dir, angle] of Object.entries(SPIKE_DIRECTIONS)) {
      const v = wedgeVerts(60, dir)
      const proj = v.map(p => p.x * Math.cos(angle) + p.y * Math.sin(angle)).sort((a, b) => b - a)
      expect(proj[0], `${dir} spike`).toBeGreaterThan(proj[1])
      expect(proj[0], `${dir} spike leads past centre`).toBeGreaterThan(0)
    }
  })

  it('presents a FLAT back face away from the spike', () => {
    // Two vertices tie for furthest AGAINST the spike direction. The back is
    // blunt on purpose: it is the side that earns nothing, so it should not
    // look like it might.
    for (const [dir, angle] of Object.entries(SPIKE_DIRECTIONS)) {
      const v = wedgeVerts(60, dir)
      const proj = v.map(p => p.x * Math.cos(angle) + p.y * Math.sin(angle)).sort((a, b) => a - b)
      expect(proj[0], `${dir} back face is flat`).toBeCloseTo(proj[1], 6)
      expect(proj[1], `${dir} back face stands proud of the rest`).toBeLessThan(proj[2])
    }
  })

  it('scales with size', () => {
    const small = wedgeVerts(40, 'n')
    const big = wedgeVerts(80, 'n')
    const span = v => Math.max(...v.map(p => Math.hypot(p.x, p.y)))
    expect(span(big)).toBeCloseTo(span(small) * 2, 5)
  })
})

describe('isSpikeHit', () => {
  // `approach` is the direction the RAT is travelling, so a rat moving east
  // (0) arrives at a west-facing open face.
  it('counts a hit that runs onto the spike', () => {
    expect(isSpikeHit(0, 'w')).toBe(true)
    expect(isSpikeHit(Math.PI, 'e')).toBe(true)
    expect(isSpikeHit(Math.PI / 2, 'n')).toBe(true)   // travelling down onto an up-facing spike
    expect(isSpikeHit(-Math.PI / 2, 's')).toBe(true)  // travelling up onto a down-facing spike
  })

  it('rejects a hit on the blunt back face', () => {
    expect(isSpikeHit(0, 'e')).toBe(false)
    expect(isSpikeHit(Math.PI, 'w')).toBe(false)
    expect(isSpikeHit(Math.PI / 2, 's')).toBe(false)
  })

  it('accepts every one of the eight directions when struck square', () => {
    for (const [dir, angle] of Object.entries(SPIKE_DIRECTIONS)) {
      expect(isSpikeHit(angle + Math.PI, dir), dir).toBe(true)
    }
  })

  it('is inclusive at the window edge and rejects just outside it', () => {
    const almost = SPIKE_WINDOW - 1e-6
    expect(isSpikeHit(almost, 'w')).toBe(true)
    expect(isSpikeHit(SPIKE_WINDOW + 0.01, 'w')).toBe(false)
  })

  it('wraps around the angle discontinuity rather than failing there', () => {
    // A west-facing face is hit by a rat travelling east; approach angles of
    // +PI and -PI are the same heading and must behave the same.
    expect(isSpikeHit(Math.PI - 0.01, 'e')).toBe(true)
    expect(isSpikeHit(-Math.PI + 0.01, 'e')).toBe(true)
  })

  it('returns false for an unknown direction instead of throwing mid-hit', () => {
    // Authoring errors throw at spawn (wedgeVerts); this runs inside the
    // collision handler, where throwing would take the frame down.
    expect(isSpikeHit(0, 'up')).toBe(false)
  })
})
