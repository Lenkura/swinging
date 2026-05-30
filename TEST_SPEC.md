# TEST_SPEC.md — Yoyo Smash

**Framework:** Vitest (vanilla JS, ESM)
**Run command:** `npm test` (runs `vitest run`)
**Environment:** jsdom (for localStorage and DOM event simulation)

---

## Impact Evaluation

**Source:** `js/target.js` → `evaluateImpact(speed, mass, material, impactMultiplier)`
**Priority:** High

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | Returns SHATTER when impulse (speed × mass × multiplier) ≥ material.strength | Happy path | High |
| 2 | Returns CRACK when impulse ≥ crackThreshold but < strength | Happy path | High |
| 3 | Returns SURVIVE when impulse < crackThreshold | Happy path | High |
| 4 | Returns SHATTER at exact strength boundary | Boundary | High |
| 5 | Returns CRACK at exact crackThreshold boundary | Boundary | High |
| 6 | Returns SURVIVE at one below crackThreshold | Boundary | High |
| 7 | Returns SURVIVE when speed = 0 | Unhappy path | High |
| 8 | Returns SURVIVE when mass = 0 | Unhappy path | High |
| 9 | Returns SURVIVE when impactMultiplier = 0 | Unhappy path | High |
| 10 | impactMultiplier scales outcome (heavy yoyo shatters what standard cracks) | Cross-variant | High |

### Edge cases and unhappy paths

- Zero speed, zero mass, zero multiplier — all should SURVIVE (impulse = 0)
- Very large speed — should SHATTER any material
- `impactMultiplier` of 2.2 (heavy yoyo) should push borderline hits into SHATTER

---

## Fragment Vertices

**Source:** `js/target.js` → `getFragmentVerts(count)`
**Priority:** Medium

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | Returns 10-polygon set when count ≥ 10 | Happy path | Medium |
| 2 | Returns 6-polygon set when count < 10 | Happy path | Medium |
| 3 | Returns 6-polygon set at count = 6 (exact match) | Boundary | Medium |
| 4 | Returns 6-polygon set at count = 9 (just below 10) | Boundary | Medium |
| 5 | Returns 6-polygon set at count = 0 (steel has 0 fragments) | Unhappy path | Medium |
| 6 | Each polygon is an array of [x, y] vertex pairs | Structure | Medium |

### Edge cases and unhappy paths

- count = 0 (steel material) — must not crash; returns 6-frag set
- count = 11 — returns 10-frag set (threshold is ≥ 10, not exact)

---

## Crack Pattern Generation

**Source:** `js/target.js` → `generateCrackPattern(count)`
**Priority:** Medium

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | Returns array of exactly `count` lines | Happy path | High |
| 2 | Each line has `angle` (number) and `len` (number) | Structure | High |
| 3 | `len` is within [0.2, 0.55] for all lines | Boundary | High |
| 4 | `angle` is within [0, 2π] for all lines | Boundary | Medium |
| 5 | count = 0 returns empty array | Unhappy path | High |
| 6 | Default call `generateCrackPattern(6)` returns 6 lines | Happy path | Medium |

### Setup requirements

- Use `vi.spyOn(Math, 'random')` to control randomness for deterministic boundary checks

---

## Level Lookup

**Source:** `js/levels.js` → `getLevel(id)`
**Priority:** High

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | Returns level object for valid id = 1 | Happy path | High |
| 2 | Returns level object for valid id = 2 | Happy path | High |
| 3 | Returns LEVELS[0] (fallback) for unknown id = 99 | Unhappy path | High |
| 4 | Returns LEVELS[0] (fallback) for id = 0 | Boundary | High |
| 5 | Returned level has required fields: id, name, pivot, targets, parScore, stringLength | Structure | High |
| 6 | pivot has x and y fields (both numbers in 0–1 range) | Structure | Medium |
| 7 | Each target has shape, x, y, material fields | Structure | Medium |

### Edge cases and unhappy paths

- id = 0 — not a real level, falls through to fallback
- id = 999 — unknown id, falls through to fallback
- Negative id — falls through to fallback

---

## Progress Save / Load

**Source:** `js/levels.js` → `saveProgress(levelId, score)`, `loadProgress()`
**Priority:** High

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | `loadProgress` returns `{}` when localStorage is empty | Happy path | High |
| 2 | `saveProgress` stores a high score for a level | Happy path | High |
| 3 | `loadProgress` retrieves a previously saved score | Happy path | High |
| 4 | `saveProgress` overwrites when new score > existing | Happy path | High |
| 5 | `saveProgress` does NOT overwrite when new score ≤ existing | Unhappy path | High |
| 6 | `saveProgress` advances `unlockedLevel` to levelId + 1 | Happy path | High |
| 7 | `saveProgress` does not reduce `unlockedLevel` below current | Unhappy path | High |
| 8 | `loadProgress` returns `{}` on corrupt (non-JSON) localStorage | Unhappy path | High |

### Setup requirements

- Clear `localStorage` in `beforeEach` to isolate tests
- To simulate corrupt data: `localStorage.setItem('yoyo_progress', 'NOT_JSON')`

---

## Input — Angular Speed & State

**Source:** `js/input.js` → `init()`, `getAngularSpeed()`, `isMouseDown()`, `getCurrentAngle()`
**Priority:** High

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | `getAngularSpeed()` returns 0 immediately after `init()` | Happy path | High |
| 2 | `isMouseDown()` returns false immediately after `init()` | Happy path | High |
| 3 | `getCurrentAngle()` returns π/2 immediately after `init()` (start below pivot) | Happy path | High |
| 4 | After mousedown on canvas, `isMouseDown()` returns true | Happy path | High |
| 5 | After mousedown then mouseup, `isMouseDown()` returns false | Happy path | High |
| 6 | Release callback is called with `vx`, `vy`, `speed`, `angle` fields | Happy path | High |
| 7 | Release speed is clamped to variant `maxSpeed` | Boundary | High |
| 8 | `getAngularSpeed()` returns value in [0, 1] range | Boundary | High |
| 9 | `detachFromCanvas` removes all event listeners (no callback after detach) | Unhappy path | Medium |

### Setup requirements

- Create a mock canvas: `document.createElement('canvas')` with mocked `getBoundingClientRect`
- Mock `performance.now()` via `vi.spyOn` to control timing for angular velocity tests
- Clear module state between tests with re-import or `init()` reset calls

---

## Combo System (Push Mode)

**Source:** `js/main.js` — `comboCount`, `comboTimer`, `COMBO_WINDOW`
**Priority:** High

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | First hit has multiplier 1.0× (comboCount = 0 pre-hit) | Happy path | High |
| 2 | Second hit within window has multiplier 1.5× | Happy path | High |
| 3 | Third hit within window has multiplier 2.0× | Happy path | High |
| 4 | Multiplier caps at 3.0× (hit 5+) | Boundary | High |
| 5 | comboCount resets to 0 after COMBO_WINDOW elapses with no hit | Unhappy path | High |
| 6 | comboTimer resets to COMBO_WINDOW on each registered hit | Happy path | High |
| 7 | Combo does not advance when hitCooldown is active (hit ignored) | Unhappy path | High |
| 8 | comboCount resets on `startLevel()` | Boundary | Medium |

### Edge cases and unhappy paths

- Two hits at exact COMBO_WINDOW boundary — combo should reset (timer ≤ 0 before second hit)
- Combo multiplier formula: `Math.min(1 + comboCount * 0.5, 3.0)` where `comboCount` is pre-increment

---

## Input — Push Mode Behaviour

**Source:** `js/input.js` — `init()`, `onMouseMove`, `onMouseUp`, `getAngularSpeed()` in push mode
**Priority:** High

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | `pivotMove` callback fires on mousemove with no button held | Happy path | High |
| 2 | `pivotMove` callback fires on mousedown (push mode treats mousedown as a pivot move) | Happy path | High |
| 3 | `onMouseUp` does not invoke the `release` callback in push mode | Unhappy path | High |
| 4 | `getAngularSpeed()` returns 0 in push mode regardless of mouse motion | Boundary | High |
| 5 | After `init(canvas, pivot, len, 'standard', 'push')`, `isMouseDown()` is false | Happy path | Medium |

### Setup requirements

- Call `init()` with `mode = 'push'`
- Fire synthetic `mousemove` and `mousedown`/`mouseup` events on the mock canvas
- Assert `release` callback is NOT called after mouseup in push mode

---

## Push Mode Scoring

**Source:** `js/main.js` — `calcPushScore(hits)`, `yoyoHp` drain logic, `hitCooldown`
**Priority:** High

### Expected behaviours

| # | Behaviour | Test type | Priority |
|---|---|---|---|
| 1 | `calcPushScore(1)` returns 3000 | Happy path | High |
| 2 | `calcPushScore(2)` returns 2500 | Happy path | High |
| 3 | `calcPushScore(6)` returns 500 | Boundary | High |
| 4 | `calcPushScore(7)` returns 200 (floor) | Boundary | High |
| 5 | `calcPushScore(100)` returns 200 (floor holds) | Unhappy path | High |

### Notes

- `calcPushScore` is a pure function: `Math.max(200, 3000 - (hits - 1) * 500)`
- Damage formula (integration, deferred): `speed × angleFactor × material.yoyoDamage × impactMultiplier × comboMultiplier / 15`; HP floor is 0
- Hit cooldown (integration, deferred): 0.35s; a second collision within the window must not decrement `yoyoHp` or increment `hitCount`

---

## Physics & Renderer (Integration — Deferred)

**Source:** `js/physics.js`, `js/renderer.js`
**Priority:** Low (deferred)

These modules depend on the `Matter` global (loaded from CDN) and the Canvas 2D API. Unit-testing them would primarily test Matter.js, not our code. Covered via manual browser testing for now; integration tests require a headless browser environment (e.g., Playwright).
