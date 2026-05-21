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
| `js/input.js` | Mouse input — swing tracking, release detection |
| `js/ui.js` | DOM panel management (picker, result, hints) |
| `js/levels.js` | Level data, localStorage progress save/load |
| `js/yoyo.js` | Yoyo variant definitions (standard, heavy) |
| `js/target.js` | Material definitions, impact evaluation, crack/fragment generation |
| `js/particles.js` | Particle system |
| `js/audio.js` | Web Audio API sound synthesis — hit, shatter, combo tone |

**State machine** (in `main.js`): `PICKER → SWINGING → RELEASED → IMPACT → RESULT`

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
- **String**: a Matter.js `Constraint` with `stiffness: 1.0`; removed on release via `scheduleRelease` (deferred to `beforeUpdate` to avoid mid-step mutation).
- **Impact outcomes**: `SHATTER` (destroys target, spawns fragments), `CRACK` (weakens target, halves thresholds), `SURVIVE`.
- **Materials**: defined in `target.js` — glass, wood, steel each have `shatterThreshold`, `crackThreshold`, `fragmentCount`, `fragmentSpread`.
- **Fragment cleanup**: setTimeout 4000ms removes fragment bodies from world after they settle.
- **Progress**: stored in `localStorage` under key `yoyo_progress` — high scores per level + `unlockedLevel`.

---

## Adding Content

**New level**: add an entry to `LEVELS` in `levels.js`. Required fields: `id`, `name`, `background`, `groundColor`, `pivot`, `targets[]`, `parScore`, `stringLength`. Optional: `hint`, `yoyoType`.

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
