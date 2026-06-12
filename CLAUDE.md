# CLAUDE.md — swinging (Rat Smash)
Created: 2026-05-20

<!-- Behavioural rules for Claude in this project (frameworklite).
     Project definition (what/why/scope/success criteria) lives in spec.md, in this
     same directory. Read spec.md directly when you need motivation or scope — this
     template uses NO @ imports, so spec.md is not auto-included.
     To graduate this project to the full framework later, add a line that is exactly
     `@spec.md` below this comment; nothing else needs to change. -->

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

## Key Files

```
swinging/
├── CLAUDE.md              ← this file (behavioural rules)
├── spec.md                ← project definition (overview, motivation, scope, success criteria)
├── project-state.json     ← session state and action plan
├── history/               ← session transcripts and summaries
├── README.md              ← player-facing instructions (how to run, gameplay, controls)
├── TEST_SPEC.md           ← test specification (behaviours, priorities, edge cases)
├── index.html             ← entry point — canvas, UI panels, CDN script tags (SRI-pinned)
├── css/style.css          ← styling
├── js/
│   ├── main.js            ← game loop, state machine, event wiring
│   ├── physics.js         ← Matter.js wrapper — bodies, constraints, collisions, fragments
│   ├── renderer.js        ← Canvas 2D drawing
│   ├── input.js           ← Pointer Events input — pivot follows pointer
│   ├── ui.js               ← DOM panel management (picker, result, level select)
│   ├── levels.js           ← level data, localStorage progress save/load
│   ├── rat.js              ← rat variant definitions (Brown Rat, Sewer Rat)
│   ├── target.js           ← material definitions, impact evaluation, fragments
│   ├── particles.js        ← particle system
│   ├── audio.js            ← Web Audio sound synthesis
│   └── scoring.js          ← calcPushScore + combo multiplier formulas
├── tests/                  ← Vitest test files
├── vitest.config.js
└── package.json
```

---

## Architecture

| File | Responsibility |
|---|---|
| `js/main.js` | Game loop, state machine, event wiring |
| `js/physics.js` | Matter.js wrapper — bodies, constraints, collisions, fragments |
| `js/renderer.js` | Canvas 2D drawing |
| `js/input.js` | Pointer Events input — pivot-follow on `pointermove`/`pointerdown`, mouse and touch unified |
| `js/ui.js` | DOM panel management (picker, result, level select) |
| `js/levels.js` | Level data, localStorage progress save/load |
| `js/rat.js` | Rat variant definitions (Brown Rat, Sewer Rat) |
| `js/target.js` | Material definitions, impact evaluation, crack/fragment generation |
| `js/particles.js` | Particle system |
| `js/audio.js` | Web Audio API sound synthesis — hit, shatter, combo, shield tones |
| `js/scoring.js` | `calcPushScore` and combo-multiplier formulas |

**State machine** (in `main.js`): `PICKER → SWINGING → IMPACT → RESULT`

**External deps (CDN, no install, SRI-pinned):**
- Matter.js 0.19.0 — physics engine
- poly-decomp 0.3.0 — concave polygon decomposition for fragments

---

## Session Briefing

At the start of every session in this project directory, before doing any work:

1. **Skip flag:** If the user's first message contains `--skip`, bypass the briefing
   entirely and proceed directly to their request.

2. Read `project-state.json` for `current_activity` and `action_plan`.

3. Read the **Motivation** (first sentence of the Overview or Motivation section) from
   `spec.md` in this directory. **Missing-file guard:** if `spec.md` does not exist,
   do not fail silently — show the line
   "spec.md not found — Motivation will be skipped." in the briefing and continue.

4. Determine the active voice mode (default: **Deliberate**). See the Agent Voice rule below.

5. Present the briefing in this format:

   ```
   ## Session Briefing — swinging — <today's date>

   **Motivation:** [one sentence from spec.md, or the missing-file warning]
   **Voice mode:** [active mode name — default Deliberate]
   **Current activity:** [current_activity]

   ### Action Plan
   [numbered list from action_plan, priority order, with status indicators]

   ### Suggested First Step
   [first pending item from action_plan]
   ```

6. State: "Ready when you are. Where would you like to start?" Do not begin any work
   until the user responds.

There is no automatic session summariser and no Last-Session Recap — continuity comes
from `current_activity` and `action_plan`, which you update by hand as work progresses.

---

## Branch Naming

Format: `<project>/<type>/<short-description>`

- `<project>` matches this project's folder name.
- `<type>` mirrors Conventional Commits: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.
- `<short-description>` is lowercase, hyphenated, 3–5 words.

Example: `swinging/feat/vitest-suite-revalidation`

Always create a branch before modifying any files — this is the literal first action of
any session where files will change. Never commit directly to `main` or `master`.

---

## Design Gate

Before implementing any new feature, component, or non-trivial task, invoke `/brainstorm`
to design the approach first. For potentially skippable tasks (single-file edits,
unambiguous bug fixes, config-only changes), ask the user before skipping — do not make
that call unilaterally.

This is an advisory rule. Unlike the full framework, frameworklite ships no brainstorm-gate
hook, so the rule stands on its own — honour it without a prompt to remind you.

---

## Agent Voice

Determine the active voice mode at session start and apply its rules to your direct
responses for the whole session. The default mode is **Deliberate**. Available modes:
`simple`, `concise`, `mentor`, `deliberate`, `autonomous`, `devil-s-advocate`, `pirate`.
Use `/voice <mode>` to switch; `/voice` alone shows the current mode and options.

---

## Key Concepts

- **Pivot**: the string attachment point; follows the pointer every frame (no button hold required). Defined per-level as `{x, y}` fractions of canvas size; overridden to the constraint anchor position during play.
- **String**: a Matter.js `Constraint` with `stiffness: 0.65`. Never released — the rat stays attached until it shatters.
- **HP system**: `ratHp` starts at 100. Damage per hit = `speed² × angleFactor × material.yoyoDamage × impactMultiplier × comboMultiplier / DAMAGE_SCALE` (`DAMAGE_SCALE = 1200`). HP floors at 0; the rat shatters (giblets) when HP reaches 0.
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

## Testing

- **Test runner:** Vitest ^2.0.0 + jsdom — config at `vitest.config.js`, test files in `tests/`
- **Run:** `npx vitest run` (single pass) or `npx vitest` (watch mode)
- **Test files:** `tests/*.test.js` — covers `scoring.js`, `target.js`, `levels.js`, `input.js`
- **Coverage threshold:** none enforced — `@vitest/coverage-v8` is available for ad-hoc reports
- **Spec:** `TEST_SPEC.md` at project root
- Integration tests for physics and renderer are deferred — currently manual browser testing. Use the browser console for Matter.js errors and the devtools Performance tab for frame timing.

---

## Project-Specific Rules

- ES6 modules require HTTP — never suggest opening `index.html` via `file://`. Serve the project root with a static server (`python3 -m http.server 8080`, `npx serve .`, etc.) before testing in a browser.
- Preserve the SRI `integrity`/`crossorigin` attributes on the Matter.js and poly-decomp CDN `<script>` tags in `index.html`. If a CDN version changes, regenerate the hash from the live file rather than removing the attribute.
- New levels, rat variants, and materials must follow the field conventions in "Adding Content" above — missing required fields will throw at runtime since there's no schema validation.

---

## Project-Specific Commit Scopes

Valid scopes for this project:
- `main` — game loop, state machine, event wiring (`js/main.js`)
- `physics` — Matter.js wrapper, bodies, constraints, fragments (`js/physics.js`)
- `renderer` — Canvas 2D drawing (`js/renderer.js`)
- `input` — Pointer Events input handling (`js/input.js`)
- `ui` — DOM panel management (`js/ui.js`)
- `levels` — level data and localStorage progress (`js/levels.js`)
- `rat` — rat variant definitions (`js/rat.js`)
- `target` — materials, impact evaluation, fragments (`js/target.js`)
- `particles` — particle system (`js/particles.js`)
- `audio` — Web Audio sound synthesis (`js/audio.js`)
- `scoring` — score and combo formulas (`js/scoring.js`)
- `tests` — Vitest suite and config
- `docs` — CLAUDE.md, spec.md, README.md, TEST_SPEC.md
