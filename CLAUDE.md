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
│   ├── scoring.js          ← calcPushScore + combo multiplier formulas
│   └── dev/                ← ?dev=1 only; never fetched by a normal player
│       ├── telemetry.js    ← run recording and the summary schema
│       ├── bot.js          ← swing policies + pointer dispatch
│       ├── harness.js      ← window.__ratsmash (state, runBot, seeds, knobs)
│       └── calibrate.js    ← timed free-swing measurement in an empty arena
├── dev/                    ← Node-side rigs (not served to the game)
│   ├── serve.mjs           ← dependency-free static server
│   ├── gate.mjs            ← regression gate (npm run gate)
│   ├── run-batch.mjs       ← batch playtest runner
│   ├── ab.mjs              ← A/B two configs at identical seeds
│   ├── shots.mjs           ← perceptual screenshot capture
│   └── smoke.mjs           ← Playwright platform check
├── history/
│   ├── session-*.md        ← session summaries
│   ├── screenshots/        ← committed perceptual-review images
│   ├── calibration/        ← human-runs-log.csv, the durable telemetry record
│   └── action-plan-archive.json
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

**State machine** (in `main.js`): `PICKER → READY → SWINGING → IMPACT → RESULT`

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

- **Pivot**: the hand/grip point; follows the pointer every frame (no button hold required). Defined per-level as `{x, y}` fractions of canvas size; overridden to the constraint anchor position during play. It does **not** exist until the pick-up — `pivotTarget`/`pivotActual` only go live in `anchorRope`.
- **READY / the pick-up**: a level opens with the rat slumped on the ground at the level pivot's x, its tail sprawled toward the targets, and the rope built but *unanchored*. A `pointerdown` within `GRAB_RADIUS` (44px, sized for touch — the tip is a 5px body) of the tail tip anchors the rope at that exact point and hands over control; raising the hand then hauls the rat up through ordinary physics, with no animation and no teleport. This exists because the old immediate start jolted: the pivot teleported from the level position to wherever the cursor happened to be on the first `pointermove`, whipping the rat. After a grab the pointer *is* the pivot, so there is no jump left to make. **The grab is mandatory — an unfound tail tip is a game that cannot start** — which is why `drawGrabHint` pulses the tip and the hint bar names the action ([L0364]). The pose is held static by `Physics.freezeForGrab` until the grab: without it the chain coils into a pile within a second, and the tip stops being at a position `dev/gate.mjs` can compute. `beginRun` auto-grabs, so the bot rigs never see `READY`; `?dev=1&rope=0` keeps the old hang-and-play start so `dev/ab.mjs` still compares like with like.
- **Tail attachment (segmented rope)**: the tail is a chain of 10 collidable circular bodies (radius 5, each 5% of the rat's mass) running pivot -> segment 0 -> ... -> segment 9 -> the rat's tail-base offset (`-r*0.85, r*0.22`), so the rat still hangs by its tail rather than its centre. Built by `Physics.buildRope` (the chain and every constraint *except* the pivot anchor) and hung by `Physics.anchorRope` (that one anchor, created at the grab point); `attachRope` still calls both back to back for callers that want the old one-shot behaviour. Total reach matches `pushStringLength`. Segments collide with world geometry and obstacles but never with each other or the rat (see Collision categories). Wrapping is not simulated — it emerges from segments colliding. `engine.constraintIterations` is raised to 48 while a rope is attached (Matter's default 2 lets the chain stretch ~30% under load, lengthening the pendulum from 130 to 171px) and restored by `attachString`. The pre-rope single `Constraint` still exists behind `?dev=1&rope=0` purely so `dev/ab.mjs` can compare against it.
- **Ground line**: `GROUND_TOP_INSET` (40) in `physics.js` is the single definition of where the floor is, exported and imported by `renderer.js` so the physical and drawn surfaces cannot drift apart ([L0182]). They used to: `groundBody`'s top sat at the canvas bottom edge (y 620) while `drawGround` painted its surface at y 580, so every body rested 40px inside the dirt and `paintSplat` hid it by drawing decals at the visual line regardless of where the body actually was. Use `Physics.getGroundTop()` to place anything on the floor.
- **Collision categories** (`physics.js` `CAT`/`MASK`): rat `0x0001`, targets and bumpers `0x0002`, fragments `0x0004`, rope `0x0010`, world (ground/walls) `0x0020`. Matter allows a pair only when *both* filters agree, so every intended pair is declared from both sides. Ground and walls previously set no filter at all and inherited Matter's default `0x0001` — the same bit the rat uses — which is why the rat fell through floors and why rope could not hit world geometry without also hitting the rat.
- **Rope collision (manual CCD)**: Matter 0.19 has no continuous collision detection, and rope segments whip to ~432 px/step against 44px bumpers, so discrete collision misses most contacts. Two passes run after each `Engine.update`: `sweepRopeSegments` sweeps each segment from its previous to its current position (`Matter.Query.ray`, then a binary search for the last free point) and `resolveRopeLinks` does the same for the *line between* adjacent segments, since the rope is a chain of circles with gaps a link can cut through. Measured effect: segment penetration 2.2% -> 0%, link crossings 5-7.5% -> under 1%, cost ~0.21ms/frame. Segments moving less than their own radius are skipped, which is what keeps it cheap. Neither pass touches the rat: it is large enough for discrete collision and it carries the damage.
- **Yank**: `pointerdown` (the pivot still snaps to the pointer) pulls the rat toward the pivot to slacken and unwind a caught rope — 0.6s cooldown. Non-accelerating *by construction*: tangential motion is damped, a radial component is added, and the result is clamped to the speed the rat already had, so it can never exceed it. This is load-bearing, not a convenience: with the rope, Level 8 is unwinnable without it (6/6 bot failures, zero hits). A snag prompt appears after 2.5s below 25 px/step and is suppressed once the player has yanked once.
- **HP system**: `ratHp` starts at 100. Damage per hit = `speed² × angleFactor × material.yoyoDamage × impactMultiplier × comboMultiplier / DAMAGE_SCALE` (`DAMAGE_SCALE = 80`). HP floors at 0; the rat shatters (giblets) when HP reaches 0. `DAMAGE_SCALE` was raised to 2000 in an earlier pass on the (incorrect) assumption that real swings reach ~60% of `pushMaxSpeed`; playtesting showed actual swing speeds land far below that, producing 30-40 hits to clear Level 1, so it was corrected back down to 200, and then to 80 in the 2026-09-13 variant rebalance (see **Variant difficulty** below). **`DAMAGE_SCALE` is a tuning group, not a lone constant:** three feedback thresholds in `main.js` are expressed in raw damage units and must scale in the same direction by the same factor in the same commit — `damageIntensity`'s `/600`, and the shake/hit-stop gate at `300` with its `/200` divisor (they were `240`, `120` and `80` when `DAMAGE_SCALE` was 200). `pushMaxSpeed` is a **presentation knob only** — its single use is normalising the speed meter and the whoosh in `main.js`; it never enters the damage formula. Validated against human free-swing calibration on the rope build (2026-09-12): standard peaks at 720 against its 750, i.e. 96%, so the meter is correctly scaled; heavy peaked at 784 against 625, so heavy was raised to 785. `DAMAGE_SCALE` was left at 200 through the rope work (2026-09-12) because the data did not support a change; it moved to 80 the next day as part of the variant rebalance, and the L1 result was verified by human play — median 4 hits on standard against the documented 3–4 target, down from 10.5.
- **Hit cooldown**: 0.35s lock-out after each registered hit. Prevents the physics engine from double-counting a single contact.
- **Combo system**: Each hit within `COMBO_WINDOW` (1.0s) increments `comboCount`. Multiplier = `min(1 + comboCount × 0.5, 3.0)`. Resets if the window expires before the next hit.
- **calcPushScore**: `max(200, 3000 − (hits − parHits) × 500)` — meeting your variant's `parHits` scores 3000, each extra hit costs 500, each hit under par pays 500, floor = 200. `parHits` defaults to 1, which reproduces the original curve exactly, so an unparameterised call is unchanged. Note the live gradient only spans 6 hits either side of par; past that everything is the 200 floor and the player gets no feedback for improving, which is what made pre-rebalance standard unscorable on Level 1.
- **Variant difficulty**: the two rats are an explicit **difficulty selector**, not a symmetric choice — the picker labels them Hard and Easy. The difficulty axis is *precision*, not power: radius 22 vs 18 means heavy glances ~15% of hits against standard's ~31%, via `angleFactor`. Damage is deliberately **not** an axis, because the game has no cost to trade against — you win by spending your own rat's HP, so more damage per hit is purely good and any variant with a higher `impactMultiplier` is permanently strictly better. Each variant is scored against its own `parHits` so both can reach 3000; standard's higher par pays more for the same absolute hit count, which is where the difficulty is rewarded. **`parHits` is measured, never guessed** — standard 4 and heavy 3 are observed L1 medians (2026-09-13, 5 human runs each). The first pair were extrapolated instead, and standard's was wrong by 1.6 hits, handing it a free +800 every run.
  > **The difficulty claim is currently unproven.** On L1 the two rats measured 3.4 and 3.0 mean hits — indistinguishable at n=5 — so the precision gap does not produce a hit-count gap there. That is an L1-only result: a 2–4 hit band has nowhere to put a difference. Whether the gap appears on longer Act 3 levels is open (task 143). If it does not, the Hard/Easy labels should go and the rats become a feel choice.
- **Shields** (`isShield: true` on a target): blocked unless rat speed ≥ `breakSpeed`. On break, the shield body is removed; no HP damage is dealt. On a too-slow hit, a "TOO SLOW!" label is shown.
- **Bumpers**: static circular bodies with high restitution (0.9). Deflect the rat without dealing HP damage. Spawned from the level's `bumpers[]` array.
- **Materials**: defined in `target.js` — glass, wood, steel. **`yoyoDamage` is the only field with a mechanical effect**: it scales how much hitting that material hurts your own rat, which is how you win. `strength`, `crackThreshold` and `hardnessFactor` feed `evaluateImpact`, whose `outcome` `main.js:195` destructures and never uses, and regular targets are never removed (`removeTarget` is called only for shields) — so those fields, and the SHATTER/CRACK distinction, are currently decorative. The spread is deliberately narrow (**0.85 / 1.0 / 1.15**, was 0.6 / 1.0 / 1.6): because damage is purely good, a wide spread made steel strictly better than glass and *inverted* the difficulty curve — the tougher material damaged your own rat more, so the hard levels were the easy ones to score on. Measured 2026-09-13: steel one-shot the rat on 60% of hits against glass's 23%.
- **Per-hit damage cap**: `applyDamageCap` in `target.js` clamps HP loss to `MAX_HIT_DAMAGE_FRACTION` (0.40) of `RAT_MAX_HP`. Damage goes as speed² and swing speed varies ~4× within a run, so the distribution has a very long tail — measured over 61 human hits, p50 41 but p75 113 and max 426, meaning **34% of hits ended a level outright**. The medians were already right; only the tail was broken, so the fix is a bound rather than a rescale, and it is the explicit bound a one-sided knob needs. **The cap applies to the HP subtraction only** — screen shake, hit-stop, the particle burst and the hit sound all read the raw uncapped value, so a monster hit still feels enormous while removing 40 HP. That is also what keeps the three feedback constants correctly aimed at raw damage rather than needing a re-derivation.
- **Damage states**: four overlay states driven by `ratHp / RAT_MAX_HP` — healthy (≥ 75%), dazed (50–75%, orbiting stars), injured (25–50%, wound marks + blood drips), critical (< 25%, red stars + more drips + × eyes). Independently, the rat's body/head fill blends from `variant.color` toward `variant.wornColor` as HP drops, and the per-hit `crackPattern` (generated once HP < 75%) renders as scuff marks on the rat's body via `drawCracks()`.
- **Impact feedback**: every HP-damaging hit fires three `particles.js` bursts via `emitImpactBurst` — a red blood splash (circle), target-material chunk debris (`material.crackedColor`), and rat-fur chunk debris (`variant.chunkColor`), the latter two using the `shape: 'chunk'` (rotating rectangle) particle type. Burst size/count scale with `damageIntensity(damage)` (0–1, saturating at `damage = 240`): chunk radii range from their base size up to 3× at full intensity, and ~8% of chunks spawn 2.5–4× oversized for variety. SHATTER reuses the same burst at `scale: 2`.
- **Giblets**: on shatter, 8 fragment bodies (circular Matter.js bodies) spawn with a lobbed radial velocity (`spread × 10 × rand` px/step + small up-bias — kept well under ~50 px/step, the single-step tunneling threshold for the 50px walls/floor). Each carries a `plugin.piece` generated once at spawn: guaranteed 1 bone shard / 1 organ / 1 gut coil, the rest weighted flesh chunks (60/20/20). `drawFragments` branches per type — flesh (red blob, ragged fur-tuft edge in `variant.color`), bone (off-white shaft with knobbed ends), organ (dark maroon, baked gloss highlight), gut (two-pass pink tube) — all geometry precomputed, no per-frame randomness. Fragments collide with ground/walls (`0x0001` in the mask); first ground contact fires `fragment-landed` → `Renderer.paintSplat` (small decal splat), and airborne pieces shed blood-drip particles on a per-fragment cadence (`plugin.dripInterval`, advanced in the game loop). Removed from the world after 4000ms with an alpha fade.
- **Moving targets**: a target with a `movement: { axis, range, period }` field oscillates sinusoidally around its spawn position along `axis` (`'x'` or `'y'`), `range` (fraction of canvas width/height) wide, over `period` seconds — driven by `Physics.updateMovingTargets(elapsed)`, called each frame during SWINGING. The body stays `isStatic`; only its position is repositioned via `Body.setPosition`, so collision/damage formulas are unaffected.
- **Act structure**: 9 levels in 3 acts. Act 1 (The Sewer) — varied shapes, no new mechanics. Act 2 (The Warehouse) — introduces shields. Act 3 (The Lab) — introduces bumpers. An ACT CLEAR screen appears when the last level of an act is shattered.
- **Progress**: stored in `localStorage` under key `yoyo_progress` — high scores per level + `unlockedLevel`.

---

## Adding Content

**New level**: add an entry to `LEVELS` in `levels.js`.

Required fields: `id`, `act`, `name`, `background`, `groundColor`, `pivot`, `targets[]`, `parScore`, `stringLength`.

Optional fields: `hint`, `pushStringLength` (overrides `stringLength`), `pushParScore` (default 1500), `bumpers[]`.

Target fields: `shape` (`'rectangle'` or `'circle'`), `x`, `y`, `material`, and for rectangles `w`/`h`, for circles `r`. Shield targets add `isShield: true` and `breakSpeed` (minimum rat speed to break). Optional `movement: { axis: 'x'|'y', range, period }` makes the target oscillate — `range` is a fraction of canvas width (`axis: 'x'`) or height (`axis: 'y'`), `period` is the full oscillation in seconds.

Bumper fields: `x`, `y`, `radius`.

**New rat variant**: add to `RAT_VARIANTS` in `rat.js` and add a picker button in `index.html` with class `rat-btn`. Color fields `wornColor` (body-wear blend target) and `chunkColor` (fur-debris particle color) are required — `renderer.js`'s `blendHexColors` and `main.js`'s `emitImpactBurst` read them unconditionally. `parHits` is also required: `main.js` reads it unconditionally when scoring a shatter, and a variant without one scores as though its par were `undefined`.

> **Before tuning a variant, read this.** `impactMultiplier` is the only field that
> changes how fast a rat dies, and raising it is *purely* an advantage: the goal is to
> destroy your own rat in few hits, so more damage is always better and there is nothing
> to trade against. `mass` does **not** act as a counterweight — the player drives the
> pivot directly, so the hand overrides inertia, and the two shipped variants clock
> identical in-play speed (114.1 vs 114.4) despite masses of 11.5 and 4.5.
> `pushMaxSpeed` is presentation only (speed meter and whoosh).
>
> This is why the variants are a **difficulty selector** rather than a symmetric choice
> (2026-09-13, task 126). Differentiate a new variant on *precision* — `radius`, which
> drives the glancing-hit rate through `angleFactor` — and give it a `parHits` that
> matches how many hits it actually needs, so it can score 3000 like the others.
> Do not reach for `impactMultiplier` to make a variant "better"; there is no cost
> anywhere in the game for it to trade against, so it only re-creates the imbalance
> this task removed.

**New material**: add to `MATERIALS` in `target.js`. Keep `yoyoDamage` inside the existing narrow band — the suite asserts no material deals more than 1.5× another, because a wide spread makes the highest-damage material strictly better and inverts the difficulty curve. The other fields are currently decorative (see **Materials** in Key Concepts), so a new material differs in look and sound, not in play, until `evaluateImpact`'s outcome is actually wired to something.

---

## Testing

- **Test runner:** Vitest ^2.0.0 + jsdom — config at `vitest.config.js`, test files in `tests/`
- **Run:** `npx vitest run` (single pass) or `npx vitest` (watch mode)
- **Test files:** `tests/*.test.js` — covers `scoring.js`, `target.js`, `levels.js`, `input.js`
- **Coverage threshold:** none enforced — `@vitest/coverage-v8` is available for ad-hoc reports
- **Spec:** `TEST_SPEC.md` at project root

```
npx vitest run
```

- Unit tests cover pure logic only. Physics, rendering and the wiring between them are covered by the browser gate below, not by Vitest.

---

## Dev Tooling — Playtest Bot & Telemetry

A `?dev=1`-gated instrumentation layer inside the game, plus Playwright rigs
outside it. All of it is dev-only: without the flag no `js/dev/*` file is ever
fetched, and no dev global is defined.

### Entry points

| Command | What it does |
|---|---|
| `npm run gate` | Regression gate — seeded fixed-timestep runs across Acts 1–3, asserting positive invariants. Exits 0/1. ~40s. |
| `npm run batch -- --runs 20` | Batch playtest — N seeded bot games in parallel headless contexts, aggregated. Results to `dev/runs/<timestamp>/` (gitignored). ~1.5s/run. |
| `npm run shots` | Perceptual capture — drives to each damage state and the shatter, writing PNGs to `history/screenshots/` (committed). |
| `npm run serve` | Static server on :8080. Play at `/?dev=1` to record your own runs. |
| `node dev/ab.mjs` | A/B two physics configurations at identical seeds on one page — how the rope was measured against the old constraint. |
| `node dev/smoke.mjs` | Platform check — confirms Playwright still drives the game on this machine. |
| `/?dev=1&calibrate` | Timed free-swing measurement, both variants — the only source of real human speed data. |

`--headed` on the gate or batch shows the browser; `--help` on the batch lists
its options. `node dev/ab.mjs` A/Bs two physics configurations at identical
seeds on one page — it is how the rope was measured against the old constraint.

### Dev-only URL knobs

All default to shipped behaviour; they exist for tuning and A/B, not for play.

| Param | Default | Effect |
|---|---|---|
| `rope=N` | 10 | Rope segment count; `0` restores the pre-rope single constraint |
| `hand=N` | 0 | Max px the hand may travel per frame; `0` = uncapped |
| `subs=N` | 1 | Physics sub-steps per frame |
| `segcap=N` | 0 | Max px a rope segment may move per sub-step; `0` = unclamped |
| `ccd=0` | on | Disables the rope's swept collision |
| `calibrate` | off | Timed free-swing measurement in an empty arena |

`hand`, `subs` and `segcap` were explored as fixes for rope tunneling and are
**not** the fix — see the 2026-09-11 decision entry. They remain because they
are useful tuning levers.

### Recording your own runs

Serve the project and open `/?dev=1`. Every completed level prints a summary to
the console and stores the full document in `localStorage` (`yoyo_dev_runs`,
last 100 runs, separate from `yoyo_progress`). `__ratsmashTelemetry.exportRuns()`
downloads them all as JSON. A run is only recorded end-to-end if you reach the
result screen — abandoning to the level select discards it.

### Layout

| File | Responsibility |
|---|---|
| `js/dev/telemetry.js` | Run recording and the summary schema. Reads state, never writes it. |
| `js/dev/bot.js` | Swing policies (`pump`, `sweep`) and pointer dispatch. |
| `js/dev/harness.js` | `window.__ratsmash` — state, `beginRun`, `runBot`, `setSeed`, `setFixedDt`, rope knobs. |
| `js/dev/calibrate.js` | Free-swing calibration mode and its on-screen readout. |
| `dev/serve.mjs` | Dependency-free static server (correct ES-module MIME types). |
| `dev/gate.mjs`, `dev/run-batch.mjs`, `dev/shots.mjs`, `dev/smoke.mjs` | The Node-side rigs. |

`main.js` holds the seam: the dev flag, a dynamic import, no-op telemetry call
sites, and an `initDev({...})` at the bottom that **injects** its module-scope
internals into the harness rather than leaking them onto `window`.

### Things to know before trusting a number

- **A bot's swing profile is not a human's.** Bot data is valid for regression
  detection and for A/B-ing one constant against another. Absolute calibration
  — `DAMAGE_SCALE`, `pushMaxSpeed`, the speed meter — must rest on human-run
  telemetry. Calibrating on bot swings would repeat the mistake that produced
  the 30–40-hit Level 1.
- **Real frame timing makes runs diverge**, even on the same seed, because
  physics steps on the real `dt`. Pass `--fixed-dt` (or `fixedDt: 1/60`) for
  exact reproducibility, at the cost of no longer measuring real-time
  behaviour. The gate uses fixed dt; the batch defaults to real.
- **The gate asserts positive invariants, not the absence of crashes.** Stubbing
  out target spawning throws no error at all and still fails 9 checks — a
  crash-only smoke run would pass it.
- **Bounds in the gate are deliberately wide.** It catches regressions; it does
  not enforce balance. Tightening them into balance assertions would make every
  intentional tuning change look like a failure.
- **Screenshots go to `history/screenshots/`, committed.** An earlier set was
  written to a session temp directory and lost.

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
