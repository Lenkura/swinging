import { describe, it, expect, beforeEach } from 'vitest'
import { getLevel, saveProgress, loadProgress, LEVELS } from '../js/levels.js'
import { SHIELD_TIERS } from '../js/target.js'
import { RAT_VARIANTS } from '../js/rat.js'

const SAVE_KEY = 'yoyo_progress'

beforeEach(() => {
  localStorage.clear()
})

// -------------------------------------------------------------------
// getLevel
// -------------------------------------------------------------------
describe('getLevel', () => {
  it('returns level 1 for id = 1', () => {  // spec row 1
    const level = getLevel(1)
    expect(level.id).toBe(1)
    expect(level.name).toBe('Pipe Dreams')
  })

  it('returns level 2 for id = 2', () => {  // spec row 2
    const level = getLevel(2)
    expect(level.id).toBe(2)
    expect(level.name).toBe('Drip Room')
  })

  it('returns LEVELS[0] as fallback for unknown id = 99', () => {  // spec row 3
    const level = getLevel(99)
    expect(level).toEqual(LEVELS[0])
  })

  it('returns LEVELS[0] as fallback for id = 0', () => {  // spec row 4
    const level = getLevel(0)
    expect(level).toEqual(LEVELS[0])
  })

  it('returned level has required fields', () => {  // spec row 5
    const level = getLevel(1)
    expect(typeof level.id).toBe('number')
    expect(typeof level.name).toBe('string')
    expect(level.pivot).toBeDefined()
    expect(Array.isArray(level.targets)).toBe(true)
    expect(typeof level.parScore).toBe('number')
    expect(typeof level.stringLength).toBe('number')
  })

  it('pivot has numeric x and y fields in [0, 1] range', () => {  // spec row 6
    const level = getLevel(1)
    expect(typeof level.pivot.x).toBe('number')
    expect(typeof level.pivot.y).toBe('number')
    expect(level.pivot.x).toBeGreaterThanOrEqual(0)
    expect(level.pivot.x).toBeLessThanOrEqual(1)
    expect(level.pivot.y).toBeGreaterThanOrEqual(0)
    expect(level.pivot.y).toBeLessThanOrEqual(1)
  })

  it('each target has shape, x, y, and exactly one appearance source', () => {  // spec row 7
    // Appearance comes from `material` for a normal target and from `shieldTier`
    // for a shield, which resolves to a material. Requiring exactly one of the
    // two is stricter than the original "must have material" and keeps its
    // intent: every target is fully specified by its level data.
    for (const level of LEVELS) {
      for (const target of level.targets) {
        expect(typeof target.shape).toBe('string')
        expect(typeof target.x).toBe('number')
        expect(typeof target.y).toBe('number')
        const sources = [target.material, target.shieldTier].filter(v => typeof v === 'string')
        expect(sources, `L${level.id} target appearance`).toHaveLength(1)
      }
    }
  })

  it('returns LEVELS[0] as fallback for negative id', () => {
    expect(getLevel(-1)).toEqual(LEVELS[0])
  })
})

// -------------------------------------------------------------------
// saveProgress / loadProgress
// -------------------------------------------------------------------
describe('loadProgress', () => {
  it('returns {} when localStorage is empty', () => {  // spec row 1
    expect(loadProgress()).toEqual({})
  })

  it('returns {} on corrupt (non-JSON) localStorage value', () => {  // spec row 8
    localStorage.setItem(SAVE_KEY, 'NOT_JSON{{{{')
    expect(loadProgress()).toEqual({})
  })
})

describe('saveProgress', () => {
  it('stores a high score for a level', () => {  // spec row 2
    saveProgress(1, 1500)
    const data = loadProgress()
    expect(data.highScores[1]).toBe(1500)
  })

  it('loadProgress retrieves a previously saved score', () => {  // spec row 3
    saveProgress(1, 2000)
    expect(loadProgress().highScores[1]).toBe(2000)
  })

  it('overwrites when new score > existing', () => {  // spec row 4
    saveProgress(1, 1000)
    saveProgress(1, 1500)
    expect(loadProgress().highScores[1]).toBe(1500)
  })

  it('does NOT overwrite when new score < existing', () => {  // spec row 5
    saveProgress(1, 1500)
    saveProgress(1, 800)
    expect(loadProgress().highScores[1]).toBe(1500)
  })

  it('does NOT overwrite when new score equals existing', () => {
    saveProgress(1, 1500)
    saveProgress(1, 1500)
    expect(loadProgress().highScores[1]).toBe(1500)
  })

  it('advances unlockedLevel to levelId + 1', () => {  // spec row 6
    saveProgress(1, 100)
    expect(loadProgress().unlockedLevel).toBe(2)
  })

  it('does not reduce unlockedLevel below current', () => {  // spec row 7
    saveProgress(2, 100)  // sets unlockedLevel = 3
    saveProgress(1, 100)  // should not reduce to 2
    expect(loadProgress().unlockedLevel).toBe(3)
  })

  it('handles multiple levels independently', () => {
    saveProgress(1, 1000)
    saveProgress(2, 2500)
    const data = loadProgress()
    expect(data.highScores[1]).toBe(1000)
    expect(data.highScores[2]).toBe(2500)
  })
})

// -------------------------------------------------------------------
// Shields are authored by tier, never by a raw speed. The point is that
// a level cannot reintroduce an unreachable threshold by hand.
// -------------------------------------------------------------------
describe('level shield authoring', () => {
  const shields = LEVELS.flatMap(l =>
    (l.targets || []).filter(t => t.isShield).map(t => ({ level: l.id, t })))

  it('there are shields to check', () => {
    expect(shields.length).toBeGreaterThan(0)
  })

  it('every shield names a known tier', () => {
    for (const { level, t } of shields) {
      expect(Object.keys(SHIELD_TIERS), `L${level} shieldTier`).toContain(t.shieldTier)
    }
  })

  it('no shield carries a hand-written breakSpeed', () => {
    // The tier table is the single dial; a raw override is how the unreachable
    // 180 threshold got in, and how two dials for one thing would come back.
    for (const { level, t } of shields) {
      expect(t.breakSpeed, `L${level} should use shieldTier, not breakSpeed`).toBeUndefined()
    }
  })

  it('no shield hardcodes a material — the tier supplies it', () => {
    for (const { level, t } of shields) {
      expect(t.material, `L${level} shield material comes from its tier`).toBeUndefined()
    }
  })
})

// -------------------------------------------------------------------
// Movement zones. The load-bearing check is the grab point: a level opens
// with the rat on the ground and its tail tip at pivot.x + pushStringLength,
// so a zone that excludes that point makes the level IMPOSSIBLE TO START —
// the player cannot reach the tail, and nothing else would report it.
//
// Canvas and ground values are duplicated here rather than imported: physics.js
// destructures the Matter global at module scope, so importing it under jsdom
// throws. If CANVAS_W/H in main.js or GROUND_TOP_INSET in physics.js change,
// these must follow.
// -------------------------------------------------------------------
describe('level movement zones', () => {
  const W = 1100
  const H = 620
  const GROUND_TOP = H - 40

  const zoned = LEVELS.filter(l => l.handZone)

  const bounds = z => ({
    left: z.x * W, right: (z.x + z.w) * W,
    top: z.y * H, bottom: (z.y + z.h) * H,
  })

  // Mirrors startLevel: rat at pivot.x resting on the ground, tail base 0.85r
  // to its left, tip one rope-length beyond that.
  const grabPoint = (level, radius) => ({
    x: level.pivot.x * W - radius * 0.85 + (level.pushStringLength || level.stringLength),
    y: GROUND_TOP - radius + radius * 0.22,
  })

  it('there are zoned levels to check', () => {
    expect(zoned.length).toBeGreaterThan(0)
  })

  it('every zone is a sane rectangle inside the canvas', () => {
    for (const l of zoned) {
      const { x, y, w, h } = l.handZone
      expect(w, `L${l.id} width`).toBeGreaterThan(0)
      expect(h, `L${l.id} height`).toBeGreaterThan(0)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + w, `L${l.id} right edge`).toBeLessThanOrEqual(1)
      expect(y + h, `L${l.id} bottom edge`).toBeLessThanOrEqual(1)
    }
  })

  it('the tail-grab point is inside the zone for EVERY variant', () => {
    for (const l of zoned) {
      const b = bounds(l.handZone)
      for (const [name, v] of Object.entries(RAT_VARIANTS)) {
        const g = grabPoint(l, v.radius)
        expect(g.x, `L${l.id} ${name} grab x`).toBeGreaterThanOrEqual(b.left)
        expect(g.x, `L${l.id} ${name} grab x`).toBeLessThanOrEqual(b.right)
        expect(g.y, `L${l.id} ${name} grab y`).toBeGreaterThanOrEqual(b.top)
        expect(g.y, `L${l.id} ${name} grab y`).toBeLessThanOrEqual(b.bottom)
      }
    }
  })

  it('every target is reachable from somewhere inside the zone', () => {
    // Furthest the rat can get is the zone's right edge plus a full rope length.
    for (const l of zoned) {
      const reach = bounds(l.handZone).right + (l.pushStringLength || l.stringLength)
      for (const t of l.targets) {
        expect(t.x * W, `L${l.id} target at x=${t.x} beyond reach`).toBeLessThanOrEqual(reach)
      }
    }
  })

  it('no zone extends below the ground line', () => {
    // A zone reaching past the floor lets the hand be driven into the ground,
    // which drags the rat along it: the first draft of Act 2 did this on all
    // three levels and the L4 bot run timed out at 90s with 31,051 rope contacts
    // and a peak speed of 150 against a typical 300+. The zone must still reach
    // low enough to contain the grab point, so the usable band is narrow.
    for (const l of zoned) {
      const bottom = (l.handZone.y + l.handZone.h) * H
      expect(bottom, `L${l.id} zone bottom is below the floor`).toBeLessThanOrEqual(GROUND_TOP)
    }
  })

  it('a zone actually constrains — it is not the whole canvas', () => {
    for (const l of zoned) {
      expect(l.handZone.w < 0.95 || l.handZone.h < 0.95, `L${l.id} zone constrains nothing`).toBe(true)
    }
  })
})
