# CLAUDE.md — swinging (Yoyo Smash)

See [../CLAUDE.md](../CLAUDE.md) for workspace-wide standards.

---

## Project Overview

**Yoyo Smash** — a browser physics game with two modes. **Push mode** (default): the pivot follows the mouse; swing the yoyo repeatedly into targets to deplete its HP and shatter it in as few hits as possible. **Fling mode**: build angular speed then release the yoyo as a projectile to smash targets. No build system. Vanilla JS with ES6 modules, Matter.js for physics, Canvas 2D for rendering.

---

## Architecture

| File | Responsibility |
|---|---|
| `js/main.js` | Game loop, state machine, event wiring |
| `js/physics.js` | Matter.js wrapper — bodies, constraints, collisions, fragments |
| `js/renderer.js` | Canvas 2D drawing |
| `js/input.js` | Mouse input — push mode pivot-follow, swing tracking, release detection (fling mode) |
| `js/ui.js` | DOM panel management (picker, result, hints) |
| `js/levels.js` | Level data, localStorage progress save/load |
| `js/yoyo.js` | Yoyo variant definitions (standard, heavy) |
| `js/target.js` | Material definitions, impact evaluation, crack/fragment generation |
| `js/particles.js` | Particle system |
| `js/audio.js` | Web Audio API sound synthesis — hit, shatter, combo tone |

**State machine** (in `main.js`):
- Push mode: `PICKER → SWINGING → IMPACT → RESULT`
- Fling mode: `PICKER → SWINGING → RELEASED → IMPACT → RESULT`

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

- **Pivot**: fixed point the string attaches to; defined per-level as `{x, y}` fractions of canvas size.
- **String**: a Matter.js `Constraint`; in fling mode `stiffness: 1.0`, in push mode `stiffness: 0.65`. Removed on release via `scheduleRelease` (deferred to `beforeUpdate` to avoid mid-step mutation).
- **Push mode**: The pivot follows the mouse every frame (no button hold required). The yoyo stays attached and accumulates damage on each hit. `yoyoHp` starts at 100; damage per hit = `speed × angleFactor × material.yoyoDamage × impactMultiplier × comboMultiplier / 15`. HP floor is 0; the yoyo shatters when HP reaches 0.
- **Hit cooldown**: 0.35s lock-out after each registered push-mode hit. Prevents the physics engine from double-counting a single contact as multiple hits.
- **Combo system**: In push mode, each hit within `COMBO_WINDOW` (1.0s) increments `comboCount`. Multiplier = `min(1 + comboCount × 0.5, 3.0)` applied to the next hit's damage. Resets if no hit lands before the window expires.
- **calcPushScore**: `max(200, 3000 − (hits − 1) × 500)` — 1 hit = 3000, each additional hit costs 500, floor = 200.
- **Fling mode outcomes**: `evaluateImpact` returns `SHATTER` (yoyo destroyed, spawns fragments), `CRACK` (yoyo cracked, visual only), or `SURVIVE`. Triggered on first collision after release.
- **Materials**: defined in `target.js` — glass, wood, steel each have `shatterThreshold`, `crackThreshold`, `fragmentCount`, `fragmentSpread`, `yoyoDamage`.
- **Fragment cleanup**: setTimeout 4000ms removes fragment bodies from world after they settle.
- **Progress**: stored in `localStorage` under key `yoyo_progress` — high scores per level + `unlockedLevel`.

---

## Adding Content

**New level**: add an entry to `LEVELS` in `levels.js`. Required fields: `id`, `name`, `background`, `groundColor`, `pivot`, `targets[]`, `parScore`, `stringLength`. Optional: `hint`, `yoyoType`, `pushStringLength` (overrides `stringLength` in push mode), `pushParScore` (par score for push mode; default 1500).

**New yoyo variant**: add to `YOYO_VARIANTS` in `yoyo.js` and add a picker button in `index.html`.

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
