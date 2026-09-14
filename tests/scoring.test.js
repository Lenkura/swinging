import { describe, it, expect } from 'vitest'
import { calcPushScore, comboMultiplier } from '../js/scoring.js'
import { RAT_VARIANTS } from '../js/rat.js'

// -------------------------------------------------------------------
// calcPushScore — spec rows 1-5
// Formula: Math.max(200, 3000 - (hits - parHits) * 500), parHits defaulting to 1.
// The rows below pass no parHits, so they also pin the default to the original curve.
// -------------------------------------------------------------------
describe('calcPushScore', () => {
  it('1 hit returns 3000', () => {  // spec row 1
    expect(calcPushScore(1)).toBe(3000)
  })

  it('2 hits returns 2500', () => {  // spec row 2
    expect(calcPushScore(2)).toBe(2500)
  })

  it('6 hits returns 500', () => {  // spec row 3
    expect(calcPushScore(6)).toBe(500)
  })

  it('7 hits returns 200 (floor)', () => {  // spec row 4
    expect(calcPushScore(7)).toBe(200)
  })

  it('100 hits returns 200 (floor holds)', () => {  // spec row 5
    expect(calcPushScore(100)).toBe(200)
  })

  it('each hit between 1 and 6 costs exactly 500', () => {
    for (let h = 2; h <= 6; h++) {
      expect(calcPushScore(h - 1) - calcPushScore(h)).toBe(500)
    }
  })
})

// -------------------------------------------------------------------
// calcPushScore — par-relative scoring (variant difficulty selector)
// Each variant is scored against its own parHits, so both can reach 3000.
// Asserted against RAT_VARIANTS rather than the literals 5 and 3: those are
// tunables a later task retunes, and pinning them here would read as a regression.
// -------------------------------------------------------------------
describe('calcPushScore — par-relative', () => {
  const variants = Object.entries(RAT_VARIANTS)

  it('omitting parHits is identical to passing 1', () => {
    for (let h = 1; h <= 12; h++) {
      expect(calcPushScore(h)).toBe(calcPushScore(h, 1))
    }
  })

  it('every variant declares a positive integer parHits', () => {
    expect(variants.length).toBeGreaterThan(0)
    for (const [name, v] of variants) {
      expect(Number.isInteger(v.parHits), `${name}.parHits`).toBe(true)
      expect(v.parHits).toBeGreaterThan(0)
    }
  })

  it('meeting par scores 3000 for every variant', () => {
    for (const [name, v] of variants) {
      expect(calcPushScore(v.parHits, v.parHits), name).toBe(3000)
    }
  })

  it('beating par scores above 3000, one hit is worth 500', () => {
    for (const [name, v] of variants) {
      expect(calcPushScore(v.parHits - 1, v.parHits), name).toBe(3500)
    }
  })

  it('each hit past par costs 500 until the floor', () => {
    for (const [, v] of variants) {
      for (let over = 1; over <= 4; over++) {
        const worse = calcPushScore(v.parHits + over, v.parHits)
        const better = calcPushScore(v.parHits + over - 1, v.parHits)
        if (worse === 200) break
        expect(better - worse).toBe(500)
      }
    }
  })

  it('the 200 floor still holds far past par', () => {
    for (const [name, v] of variants) {
      expect(calcPushScore(v.parHits + 100, v.parHits), name).toBe(200)
    }
  })

  it('the hard variant out-scores the easy one at their respective pars beaten equally', () => {
    // Standard's par is higher, so clearing in the same absolute hit count pays it more.
    const { standard, heavy } = RAT_VARIANTS
    expect(standard.parHits).toBeGreaterThan(heavy.parHits)
    expect(calcPushScore(heavy.parHits, standard.parHits))
      .toBeGreaterThan(calcPushScore(heavy.parHits, heavy.parHits))
  })
})

// -------------------------------------------------------------------
// comboMultiplier — spec rows 1-4
// Formula: Math.min(1 + comboCount * 0.5, 3.0)
// comboCount is the pre-increment value (0 on first hit)
// -------------------------------------------------------------------
describe('comboMultiplier', () => {
  it('comboCount 0 (first hit) returns 1.0', () => {  // spec row 1
    expect(comboMultiplier(0)).toBe(1.0)
  })

  it('comboCount 1 (second hit) returns 1.5', () => {  // spec row 2
    expect(comboMultiplier(1)).toBe(1.5)
  })

  it('comboCount 2 (third hit) returns 2.0', () => {  // spec row 3
    expect(comboMultiplier(2)).toBe(2.0)
  })

  it('comboCount 4+ caps at 3.0', () => {  // spec row 4
    expect(comboMultiplier(4)).toBe(3.0)
    expect(comboMultiplier(10)).toBe(3.0)
    expect(comboMultiplier(100)).toBe(3.0)
  })

  it('multiplier increases by 0.5 per hit below cap', () => {
    for (let c = 0; c < 4; c++) {
      expect(comboMultiplier(c + 1) - comboMultiplier(c)).toBeCloseTo(0.5)
    }
  })
})
