import { describe, it, expect } from 'vitest'
import { calcPushScore, comboMultiplier } from '../js/scoring.js'

// -------------------------------------------------------------------
// calcPushScore — spec rows 1-5
// Formula: Math.max(200, 3000 - (hits - 1) * 500)
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
