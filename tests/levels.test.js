import { describe, it, expect, beforeEach } from 'vitest'
import { getLevel, saveProgress, loadProgress, LEVELS, MECHANICS, levelMechanics, LAYOUT_VERSION } from '../js/levels.js'
import { SHIELD_TIERS, MAX_OBSERVED_CONTACT_SPEED, MAX_OBSERVED_ZONED_CONTACT_SPEED } from '../js/target.js'
import { RAT_VARIANTS } from '../js/rat.js'

const SAVE_KEY = 'yoyo_progress'

beforeEach(() => {
  localStorage.clear()
})

// -------------------------------------------------------------------
// getLevel
// -------------------------------------------------------------------
describe('getLevel', () => {
  // Asserted against the level data rather than against name literals. These
  // pinned 'Pipe Dreams' and 'Drip Room', so re-laying Act 1 failed a test that
  // had nothing to do with the change - a level's name is content, and
  // getLevel's contract is only that it returns the level with that id (L0352).
  it('returns level 1 for id = 1', () => {  // spec row 1
    const level = getLevel(1)
    expect(level.id).toBe(1)
    expect(level).toEqual(LEVELS.find(l => l.id === 1))
  })

  it('returns level 2 for id = 2', () => {  // spec row 2
    const level = getLevel(2)
    expect(level.id).toBe(2)
    expect(level).toEqual(LEVELS.find(l => l.id === 2))
  })

  it('every level has a non-empty name', () => {
    // What the name literals were really guarding: that levels are named at all.
    for (const l of LEVELS) {
      expect(typeof l.name, `L${l.id} name`).toBe('string')
      expect(l.name.length).toBeGreaterThan(0)
    }
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

  // A blade cut is the game's only losing outcome. Before this guard,
  // unlockedLevel advanced unconditionally, so failing a level would still have
  // opened the next one - a silent progression bug nothing was watching for.
  it('a failed run records no score', () => {
    saveProgress(1, 2500, { completed: false })
    expect(loadProgress().highScores).toBeUndefined()
  })

  it('a failed run does NOT unlock the next level', () => {
    saveProgress(1, 2500, { completed: false })
    expect(loadProgress().unlockedLevel).toBeUndefined()
  })

  it('a failed run cannot erase or lower an existing score', () => {
    saveProgress(1, 2000)
    saveProgress(1, 9999, { completed: false })
    const data = loadProgress()
    expect(data.highScores[1]).toBe(2000)
    expect(data.unlockedLevel).toBe(2)
  })

  it('omitting the options object still counts as completed', () => {
    // Every existing call site passes two arguments; the guard must not
    // silently turn those into failures.
    saveProgress(3, 1200)
    expect(loadProgress().highScores[3]).toBe(1200)
    expect(loadProgress().unlockedLevel).toBe(4)
  })

  // Level ids are reused across re-lays, so a save from another layout holds
  // scores for different levels. See LAYOUT_VERSION.
  it('stamps the current layout version on every save', () => {
    saveProgress(1, 1000)
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)).layoutVersion).toBe(LAYOUT_VERSION)
  })

  it('drops high scores from a save that predates layout versions', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ highScores: { 4: 2500 }, unlockedLevel: 7 }))
    const data = loadProgress()
    expect(data.highScores).toBeUndefined()
    expect(data.unlockedLevel).toBe(7)   // unlock progress survives
  })

  it('drops high scores from a save of a different layout version', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ highScores: { 1: 3000 }, unlockedLevel: 3, layoutVersion: LAYOUT_VERSION - 1 }))
    expect(loadProgress().highScores).toBeUndefined()
  })

  it('caps migrated unlock progress at the new level count', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ unlockedLevel: 99 }))
    expect(loadProgress().unlockedLevel).toBe(LEVELS.length)
  })

  it('keeps high scores from a save of the current layout', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ highScores: { 4: 2500 }, unlockedLevel: 7, layoutVersion: LAYOUT_VERSION }))
    expect(loadProgress().highScores[4]).toBe(2500)
  })

  it('a save after migration keeps the unlock and records only new scores', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ highScores: { 4: 2500, 5: 3000 }, unlockedLevel: 7 }))
    saveProgress(2, 1800)
    const data = loadProgress()
    expect(data.highScores).toEqual({ 2: 1800 })
    expect(data.unlockedLevel).toBe(7)
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

  // The old guard asserted every tier sat below the fastest contact ever
  // recorded (150.8). That stopped meaning anything once a level's own ceiling
  // became 96: an absolute bound cannot police a per-level scale. What replaces
  // it is a band on the scale itself plus the absolute physical ceiling, so a
  // level cannot scale itself out of reach in either direction.
  it('every shieldSpeedScale sits in a sane band', () => {
    for (const l of LEVELS) {
      if (l.shieldSpeedScale === undefined) continue
      expect(l.shieldSpeedScale, `L${l.id} scale`).toBeGreaterThanOrEqual(0.4)
      expect(l.shieldSpeedScale, `L${l.id} scale`).toBeLessThanOrEqual(1.5)
    }
  })

  it('no level scales its hardest shield beyond anything ever recorded', () => {
    // A zoned level is measured against the ZONED ceiling. Against the global
    // 150.8 this check is close to vacuous where it matters most: a zoned level
    // at scale 0.75 would pass with a heavy tier of 200, which is worse than
    // the unreachable-180 bug the assertion exists to prevent.
    for (const l of LEVELS) {
      const shields = (l.targets || []).filter(t => t.isShield)
      if (!shields.length) continue
      const ceiling = l.handZone ? MAX_OBSERVED_ZONED_CONTACT_SPEED : MAX_OBSERVED_CONTACT_SPEED
      const hardest = Math.max(...shields.map(t => SHIELD_TIERS[t.shieldTier].breakSpeed))
      const scaled = hardest * (l.shieldSpeedScale ?? 1)
      expect(scaled, `L${l.id} hardest shield vs ${l.handZone ? 'zoned' : 'unzoned'} ceiling`)
        .toBeLessThan(ceiling)
    }
  })

  it('a level with a movement zone declares a scale — zones change arrival speed', () => {
    // Zones halved swing speed, which halved arrival speed at shields. A zoned
    // level carrying shields at the unscaled table is the exact regression that
    // took the heavy tier from 57% of runs to 2% of contacts.
    for (const l of LEVELS) {
      if (!l.handZone) continue
      if (!(l.targets || []).some(t => t.isShield)) continue
      expect(l.shieldSpeedScale, `L${l.id} is zoned and has shields`).toBeDefined()
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

// -------------------------------------------------------------------
// Level design rules (CLAUDE.md, "Level design rules"). The titles below
// are quoted verbatim by those rules - rename one and the doc goes stale.
// Everything is derived from the level data via levelMechanics, never from
// a hand-kept list, so a new level is checked without anyone adding it here.
// -------------------------------------------------------------------
describe('level design rules', () => {
  const ordered = [...LEVELS].sort((a, b) => a.id - b.id)
  const hittable = l => (l.targets || []).filter(t => !t.isShield)
  const teaching = ordered.filter(l => l.kind === 'teaching')
  const mixed = ordered.filter(l => l.kind === 'mixed')

  // Vacuity guards first (L0469): an empty filter passes every loop below.
  it('there are teaching and mixed levels to check', () => {
    expect(teaching.length).toBeGreaterThan(0)
    expect(mixed.length).toBeGreaterThan(0)
  })

  it('every level declares a kind, and every teaching level a known teaches', () => {
    for (const l of ordered) {
      expect(['teaching', 'mixed'], `L${l.id} kind`).toContain(l.kind)
      if (l.kind === 'teaching') expect(['swing', ...MECHANICS], `L${l.id} teaches`).toContain(l.teaches)
      else expect(l.teaches, `L${l.id} is mixed and should not claim to teach`).toBeUndefined()
    }
  })

  it('a teaching level introduces exactly its teaches mechanic', () => {  // rule 1
    const taught = new Set()
    for (const l of ordered) {
      if (l.kind !== 'teaching') continue
      const fresh = [...levelMechanics(l)].filter(m => !taught.has(m)).sort()
      const expected = l.teaches === 'swing' ? [] : [l.teaches]
      expect(fresh, `L${l.id} "${l.name}" teaches ${l.teaches}`).toEqual(expected)
      if (l.teaches !== 'swing') taught.add(l.teaches)
    }
  })

  it('a teaching level has exactly one target', () => {  // rule 2
    for (const l of teaching) {
      expect(hittable(l).length, `L${l.id} "${l.name}" targets`).toBe(1)
    }
  })

  it('a mixed level uses only mechanics already taught', () => {  // rule 3
    const taught = new Set()
    for (const l of ordered) {
      if (l.kind === 'teaching') { if (l.teaches !== 'swing') taught.add(l.teaches); continue }
      const untaught = [...levelMechanics(l)].filter(m => !taught.has(m)).sort()
      expect(untaught, `L${l.id} "${l.name}" uses untaught mechanics`).toEqual([])
    }
  })

  it('each act opens with a teaching level and closes with a mixed one', () => {  // rule 4
    const acts = [...new Set(ordered.map(l => l.act))]
    for (const act of acts) {
      const inAct = ordered.filter(l => l.act === act)
      // An all-mixed act (the planned fourth section) teaches nothing, so it
      // has nothing to open with; the rule governs acts that teach.
      if (!inAct.some(l => l.kind === 'teaching')) continue
      expect(inAct[0].kind, `act ${act} opens with L${inAct[0].id}`).toBe('teaching')
      expect(inAct[inAct.length - 1].kind, `act ${act} closes with L${inAct[inAct.length - 1].id}`).toBe('mixed')
    }
  })

  it('no heavy shield in a single-target level', () => {  // rule 6
    // With one target every shield is a gate: the level cannot be won without
    // breaking it, so an unbreakable one soft-locks the level.
    for (const l of ordered) {
      if (hittable(l).length !== 1) continue
      const heavy = (l.targets || []).filter(t => t.isShield && t.shieldTier === 'heavy')
      expect(heavy.length, `L${l.id} "${l.name}" gates its only target behind heavy`).toBe(0)
    }
  })
})

describe('levelMechanics', () => {
  it('reads each mechanic from the data it names', () => {
    expect([...levelMechanics({ targets: [{ material: 'glass' }] })]).toEqual([])
    expect(levelMechanics({ targets: [{ movement: { axis: 'x' } }] }).has('moving')).toBe(true)
    expect(levelMechanics({ targets: [], handZone: { x: 0, y: 0, w: 1, h: 1 } }).has('zone')).toBe(true)
    expect(levelMechanics({ targets: [], bumpers: [{}] }).has('bumper')).toBe(true)
    expect(levelMechanics({ targets: [], blades: [{}] }).has('blade')).toBe(true)
  })

  it('splits shields into shield and shield-strong by tier', () => {
    const light = levelMechanics({ targets: [{ isShield: true, shieldTier: 'light' }] })
    expect([...light]).toEqual(['shield'])
    for (const tier of ['medium', 'heavy']) {
      const m = levelMechanics({ targets: [{ isShield: true, shieldTier: tier }] })
      expect([...m].sort(), tier).toEqual(['shield', 'shield-strong'])
    }
  })

  it('does not count empty arrays or materials as mechanics', () => {
    expect([...levelMechanics({ targets: [{ material: 'steel' }, { material: 'glass' }], bumpers: [], blades: [] })]).toEqual([])
  })
})
