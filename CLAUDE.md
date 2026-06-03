# CLAUDE.md — swinging (Rat Smash)

See [../CLAUDE.md](../CLAUDE.md) for workspace-wide standards.

---

## Project Overview

**Rat Smash** — a browser physics game. The pivot follows the mouse; swing the rat repeatedly into targets to deplete its HP and shatter it in as few hits as possible. Nine levels across three acts, each introducing new mechanics (shields in Act 2, bumpers in Act 3). No build system. Vanilla JS with ES6 modules, Matter.js for physics, Canvas 2D for rendering.

---

## Architecture

| File | Responsibility |
|---|---|
| `js/main.js` | Game loop, state machine, event wiring |
| `js/physics.js` | Matter.js wrapper — bodies, constraints, collisions, fragments |
| `js/renderer.js` | Canvas 2D drawing |
| `js/input.js` | Mouse input — pivot-follow on `mousemove` and `mousedown` |
| `js/ui.js` | DOM panel management (picker, result, level select) |
| `js/levels.js` | Level data, localStorage progress save/load |
| `js/rat.js` | Rat variant definitions (Brown Rat, Sewer Rat) |
| `js/target.js` | Material definitions, impact evaluation, crack/fragment generation |
| `js/particles.js` | Particle system |
| `js/audio.js` | Web Audio API sound synthesis — hit, shatter, combo tone |

**State machine** (in `main.js`): `PICKER → SWINGING → IMPACT → RESULT`

**External deps (CDN, no install):**
- Matter.js 0.19.0 — physics engine
- poly-decomp 0.3.0 — concave polygon decomposition for fragments

---

## Running the Game

Serve locally — ES6 modules require HTTP (can't open `index.html` directly via `file://`):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Or use any static file server (`npx serve`, `caddy`, etc.).

---

## Key Concepts

- **Pivot**: the string attachment point; follows the mouse every frame (no button hold required). Defined per-level as `{x, y}` fractions of canvas size; overridden to the constraint anchor position during play.
- **String**: a Matter.js `Constraint` with `stiffness: 0.65`. Never released — the rat stays attached until it shatters.
- **HP system**: `ratHp` starts at 100. Damage per hit = `speed × angleFactor × material.yoyoDamage × impactMultiplier × comboMultiplier / 15`. HP floors at 0; the rat shatters (giblets) when HP reaches 0.
- **Hit cooldown**: 0.35s lock-out after each registered hit. Prevents the physics engine from double-counting a single contact.
- **Combo system**: Each hit within `COMBO_WINDOW` (1.0s) increments `comboCount`. Multiplier = `min(1 + comboCount × 0.5, 3.0)`. Resets if the window expires before the next hit.
- **calcPushScore**: `max(200, 3000 − (hits − 1) × 500)` — 1 hit = 3000, each extra hit costs 500, floor = 200.
- **Shields** (`isShield: true` on a target): blocked unless rat speed ≥ `breakSpeed`. On break, the shield body is removed; no HP damage is dealt. On a too-slow hit, a "TOO SLOW!" label is shown.
- **Bumpers**: static circular bodies with high restitution (0.9). Deflect the rat without dealing HP damage. Spawned from the level's `bumpers[]` array.
- **Materials**: defined in `target.js` — glass, wood, steel each have `shatterThreshold`, `crackThreshold`, `fragmentCount`, `fragmentSpread`, `yoyoDamage`.
- **Damage states**: four visual states driven by `ratHp / RAT_MAX_HP` — healthy (≥ 75%), dazed (50–75%, orbiting stars), injured (25–50%, wound marks + blood drips), critical (< 25%, red stars + more drips + × eyes).
- **Giblets**: on shatter, 8 elliptical fragment bodies spawn with radial velocity; removed from the world after 4000ms.
- **Act structure**: 9 levels in 3 acts. Act 1 (The Sewer) — varied shapes, no new mechanics. Act 2 (The Warehouse) — introduces shields. Act 3 (The Lab) — introduces bumpers. An ACT CLEAR screen appears when the last level of an act is shattered.
- **Progress**: stored in `localStorage` under key `yoyo_progress` — high scores per level + `unlockedLevel`.

---

## Adding Content

**New level**: add an entry to `LEVELS` in `levels.js`.

Required fields: `id`, `act`, `name`, `background`, `groundColor`, `pivot`, `targets[]`, `parScore`, `stringLength`.

Optional fields: `hint`, `pushStringLength` (overrides `stringLength`), `pushParScore` (default 1500), `bumpers[]`.

Target fields: `shape` (`'rectangle'` or `'circle'`), `x`, `y`, `material`, and for rectangles `w`/`h`, for circles `r`. Shield targets add `isShield: true` and `breakSpeed` (minimum rat speed to break).

Bumper fields: `x`, `y`, `radius`.

**New rat variant**: add to `RAT_VARIANTS` in `rat.js` and add a picker button in `index.html` with class `rat-btn`.

**New material**: add to `MATERIALS` in `target.js`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla JS — ES6 modules (`"type": "module"`) |
| Rendering | Canvas 2D |
| Physics | Matter.js 0.19.0 via CDN |
| Audio | Web Audio API (built-in, no library) |
| Test framework | Vitest ^2.0.0 + jsdom |
| Build system | None |

---

## Testing

- **Framework:** Vitest — config at `vitest.config.js`, test files in `tests/`
- **Run:** `npx vitest run` (single pass) or `npx vitest` (watch mode)
- **Spec:** `TEST_SPEC.md` at project root
- Integration tests for physics and renderer are deferred — currently manual browser testing. Use browser console for Matter.js errors and devtools Performance tab for frame timing.
