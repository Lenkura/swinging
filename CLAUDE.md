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

poly-decomp was listed here until 2026-09-19. It was never used — Matter only calls it from
`Bodies.fromVertices`, which nothing in the game calls — and its cdnjs URL had 404'd on every
page load since at least July. If concave bodies are ever needed (task 151 might), add it back
from a CDN that actually serves it, with a freshly generated SRI hash. The gate now fails on
any resource that does not load, so a dead tag cannot sit unnoticed again.

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
- **Arena containment**: the rat's only continuous collision is against targets and bumpers (`sweepRat`, added 2026-09-20); nothing sweeps it against the arena boundary, so nothing keeps it inside except world geometry thicker than it can cross in one step. Every boundary is therefore 800px thick (`WALL_HALF` 400), far beyond the measured rat peak of 250–460 px/step. **A ceiling exists** as of 2026-09-16; before that there was none at all and the rat could swing clean off the top, reproduced at y = −21. `reset()` must re-add every boundary, since `World.clear` drops them and `reset()` runs on each `startLevel`. The gate asserts this **structurally** — the bodies exist and exceed a thickness floor — because the behavioural version is unreliable: whipping the hand at the boundaries reproduced the escape in a run of 90 iterations and missed it in one of 80, so a containment test that watches the rat can pass while containment is entirely absent.
- **Ground line**: `GROUND_TOP_INSET` (40) in `physics.js` is the single definition of where the floor is, exported and imported by `renderer.js` so the physical and drawn surfaces cannot drift apart ([L0182]). They used to: `groundBody`'s top sat at the canvas bottom edge (y 620) while `drawGround` painted its surface at y 580, so every body rested 40px inside the dirt and `paintSplat` hid it by drawing decals at the visual line regardless of where the body actually was. Use `Physics.getGroundTop()` to place anything on the floor.
- **Collision categories** (`physics.js` `CAT`/`MASK`): rat `0x0001`, targets and bumpers `0x0002`, fragments `0x0004`, rope `0x0010`, world (ground/walls) `0x0020`. Matter allows a pair only when *both* filters agree, so every intended pair is declared from both sides. Ground and walls previously set no filter at all and inherited Matter's default `0x0001` — the same bit the rat uses — which is why the rat fell through floors and why rope could not hit world geometry without also hitting the rat.
- **Rope collision (manual CCD)**: Matter 0.19 has no continuous collision detection, and rope segments whip to ~432 px/step against 44px bumpers, so discrete collision misses most contacts. Two passes run after each `Engine.update`: `sweepRopeSegments` sweeps each segment from its previous to its current position (`Matter.Query.ray`, then a binary search for the last free point) and `resolveRopeLinks` does the same for the *line between* adjacent segments, since the rope is a chain of circles with gaps a link can cut through. Measured effect: segment penetration 2.2% -> 0%, link crossings 5-7.5% -> under 1%, cost ~0.21ms/frame. Segments moving less than their own radius are skipped, which is what keeps it cheap. Neither pass touches the rat; `sweepRat` is its own, added 2026-09-20 and needed for one reason: **a shield panel is 12–14px thick**, while the rat travels 20–100+ px per step, so the rat crossed panels within a single step and hit the target a cage was guarding without ever touching it (measured on human runs at 48, 52, 60 and 61 px/step; reproduced by the bot in 3 of 16 runs). Thickening panels cannot fix it — the rat peaks at 250–460 px/step — which is why the arena walls are 800px thick instead. `sweepRat` **rewinds only**: on detecting a crossing it moves the rat back to the last free point and leaves its velocity alone, so the next step collides normally and the existing shield break/block path, the bounce and the hit event all run unchanged. It skips a rat that moved less than its own radius, and a rat already overlapping something (Matter is resolving that itself). A/B over three repetitions of a 16-run sequence: 3 tunnelled hits every time without it, 0 with it. The gate asserts it as *nothing reached the caged target through its cage*.
- **Yank**: `pointerdown` (the pivot still snaps to the pointer) pulls the rat toward the pivot to slacken and unwind a caught rope — 0.6s cooldown. Non-accelerating *by construction*: tangential motion is damped, a radial component is added, and the result is clamped to the speed the rat already had, so it can never exceed it. It was load-bearing in the nine-level layout, where L8 (Crossfire) was unwinnable without it (6/6 bot failures, zero hits). **No level in layout 2 needs it** — Deflector cleared 4/4 bot seeds and the finale 3/3 with no yank — so the gate asserts the yank path directly (`yank input registered`) rather than through a level that is impossible otherwise. It still matters: a tail looped round a thin floating post is exactly what yanking cannot fix, which is why the shield cages are built flush (see L7 in `levels.js`). A snag prompt appears after 2.5s below 25 px/step and is suppressed once the player has yanked once.
- **HP system**: `ratHp` starts at 100. Damage per hit = `speed² × angleFactor × material.yoyoDamage × impactMultiplier × comboMultiplier / DAMAGE_SCALE` (`DAMAGE_SCALE = 80`). HP floors at 0; the rat shatters (giblets) when HP reaches 0. `DAMAGE_SCALE` was raised to 2000 in an earlier pass on the (incorrect) assumption that real swings reach ~60% of `pushMaxSpeed`; playtesting showed actual swing speeds land far below that, producing 30-40 hits to clear Level 1, so it was corrected back down to 200, and then to 80 in the 2026-09-13 variant rebalance (see **Variant difficulty** below). **`DAMAGE_SCALE` is a tuning group, not a lone constant:** three feedback constants in `main.js` are expressed in raw damage units and must scale in the same direction by the same factor in the same commit — `damageIntensity`'s `600`, `SHAKE_GATE` (`180`) and the shake's `/120` divisor (the original trio was `240`, `120` and `80` when `DAMAGE_SCALE` was 200). `pushMaxSpeed` is a **presentation knob only** — its single use is normalising the speed meter and the whoosh in `main.js`; it never enters the damage formula. Validated against human free-swing calibration on the rope build (2026-09-12): standard peaks at 720 against its 750, i.e. 96%, so the meter is correctly scaled; heavy peaked at 784 against 625, so heavy was raised to 785. `DAMAGE_SCALE` was left at 200 through the rope work (2026-09-12) because the data did not support a change; it moved to 80 the next day as part of the variant rebalance, and the L1 result was verified by human play — median 4 hits on standard against the documented 3–4 target, down from 10.5.
- **Hit cooldown**: 0.35s lock-out after each registered hit. Prevents the physics engine from double-counting a single contact.
- **Combo system**: Each hit within `COMBO_WINDOW` (1.0s) increments `comboCount`. Multiplier = `min(1 + comboCount × 0.5, 3.0)`. Resets if the window expires before the next hit.
- **calcPushScore**: `max(200, 3000 − (hits − parHits) × 500)` — meeting your variant's `parHits` scores 3000, each extra hit costs 500, each hit under par pays 500, floor = 200. `parHits` defaults to 1, which reproduces the original curve exactly, so an unparameterised call is unchanged. Note the live gradient only spans 6 hits either side of par; past that everything is the 200 floor and the player gets no feedback for improving, which is what made pre-rebalance standard unscorable on Level 1.
- **Variants are a feel choice, not a difficulty choice** (settled 2026-09-13 on 88 human runs). The picker describes appearance only — "Lean & scrappy" / "Bulky & messy" — and must not claim a difficulty difference. What genuinely differs is `radius` (18 vs 22), `blastBonus` (1.0 vs 1.4, the giblet spread on shatter), `trailLength` and colour. What does **not** differ: measured glancing rates are 19.4% standard against 20.3% heavy, effectively identical. An earlier design claimed a precision axis of 31% vs 15% and built a Hard/Easy selector on it; that split was an artifact of the pre-rebalance build, where 10-hit runs gave glancing room to register, and it did not survive measurement. `mass` is inert too — the player drives the pivot directly, so the hand overrides inertia.
  > Damage is deliberately **not** a variant axis, because the game has no cost to trade against: you win by spending your own rat's HP, so more damage per hit is purely good and any variant with a higher `impactMultiplier` would be permanently strictly better. Heavy keeps a mild 1.4x, and the per-hit cap plus per-variant par absorb it — measured means are 3.55 hits heavy against 3.91 standard, with both centring on 3000.
- **`parHits`**: each variant is scored against its own par so both can reach 3000. **Measured, never guessed** — standard 4 and heavy 3 are observed medians. The first pair were extrapolated instead, and standard's was wrong by 1.6 hits, handing it a free +800 every run.
- **Shields** (`isShield: true` on a target): blocked unless rat speed ≥ `breakSpeed`. On break, the shield body is removed; no HP damage is dealt. On a too-slow hit, a "TOO SLOW!" label is shown. Shields are **not** progress gates — you win by destroying your own rat, so a shield denies a *hitting surface*, not the level.
- **Shield tiers**: levels write `shieldTier: 'light' | 'medium' | 'heavy'`, never a raw `breakSpeed` — one dial, and the suite fails a hand-written `breakSpeed` or `material` on a shield. `SHIELD_TIERS` in `target.js` maps each tier to a speed (**45 / 70 / 105**) *and* to the material it renders in (glass / wood / steel), so the cost is legible before you swing; `resolveShieldTier` fills both in `spawnTargets`. **Speeds are derived from measured contact speed, never from peak speed** — over 106 human contacts the speed a player actually *arrives* with was p25 38, p50 50, p75 61, max 151, far below free-swing peaks of ~720, because shield placement constrains the approach. The old 100 and 180 thresholds were set from the wrong distribution: 100 broke in 33% of runs and 180 in **0 of 13**, so a whole tier showed "TOO SLOW!" and could never open. Rendering tints a shield by its tier — if they all drew the same colour the tier could not guide anyone, which is what the first implementation did.
- **`shieldSpeedScale`**: **an absolute speed threshold does not survive a change of level layout.** Adding movement zones to Act 2 halved swing speed, which halved arrival speed at the shields, and the heavy tier fell from breaking in 57% of runs to **2% of contacts** — the unreachable-180 failure returning by another route. Measured across both layouts the tier *ordering* stayed right and only the scale was wrong: zoned levels needed **0.74–0.81×** this table across all three tiers, unzoned **1.07–1.18×**, each internally consistent. So a level declares one number, `shieldSpeedScale` (default 1.0; Act 2's zoned levels use 0.75), and the table keeps the relative ordering ([L0409]). What does **not** work, and was tested: expressing tiers as a fraction of the level's swing speed. Those fractions differ by group — zoned 0.56/0.86/1.08 against unzoned 0.41/0.58/0.79 — because in a confined space contacts land nearer peak speed, so the *shape* of the arrival distribution changes and not merely its scale. Three suite guards: tiers rise monotonically under any scale, a scale stays within 0.4–1.5, and **a zoned level carrying shields must declare a scale** — that last one is the regression this entry exists for.
- **Reachability is checked per layout, not globally.** `MAX_OBSERVED_CONTACT_SPEED` (150.8) is an *unzoned* figure, so testing a zoned level against it is close to vacuous: at scale 0.75 it would wave through a heavy tier of **200**, which is worse than the unreachable-180 bug the assertion exists to prevent. Zoned levels are guarded against `MAX_OBSERVED_ZONED_CONTACT_SPEED` (104.6) instead, and the check uses the hardest tier *that level actually places* rather than the hardest in the table. Verified by making it fail — heavy at 145 passes the global check and trips the zoned one.
- **Re-measuring a tier is not the same as re-measuring the table.** On the re-laid levels (2026-09-17, 132 contacts / 32 runs) light and medium had already arrived at their intent — 94% of runs against 99% intended, and 77% against 74% — because the zones and `shieldSpeedScale` had done that work. Only heavy was adrift at **75% against 44%**, barely separated from medium, which is what task 150 had been seeing from the other end. So the fix was one number, not a spread retune: heavy 95 → **105**, putting its scaled threshold on heavy's own measured p90. Prefer a **deliberate undershoot** when tuning these: the per-contact-to-per-run projection is only good to a factor (it predicts 99.8% for light where 94% was observed), and the two error directions are not symmetric — too easy reads as a soft tier, too hard is the unreachable-tier bug that has now cost two passes.
- **Blades and the fail state**: a blade (`blades: [{ x, y, w, h, angle }]`) **cuts the tail and loses the level** — the game's only losing outcome, added 2026-09-16. It is masked to `CAT.ROPE` **only**, so the rat passes straight through one: the hazard is about tail control, not a second wall. **It cuts only when the tail crosses it above `cutSpeed` (default 120 px/step)** — a test of control, not a no-go region. It killed on *any* contact at first and that was measured as wrong: across 24 bot runs roughly **half** ended in a cut no matter where the blades sat, because the tail hangs from a hand that teleports to the pointer, so "never touch this" makes a blade an instant-death zone with no boundary drawn and repositioning cannot fix it. With the speed gate the same levels measure 0/8, 1/8 and 0/8. **`cutSpeed` is per level, and bot runs cannot calibrate it.** At a shared default of 120, human play gave **45% of runs cut on L7** — the level that *teaches* the hazard — against **0% on L8 and L9**, while the bot at the identical threshold gave 0/8, 1/8 and 0/8. The bot does not approach a blade the way a person does, so its cut rate says nothing about a human's. The thresholds are now 175 / 105 / 90, inverting a curve that had the introduction lethal and the finale harmless. Every cut is recorded in telemetry with the tail speed and the threshold it beat, so the next pass can calibrate from the speeds that actually cut rather than from cut/no-cut counts — the absence of that data is why the first numbers were guesses. Detection is in two passes for the same reason the rope has them: the discrete collision catches slow contacts, and `detectBladeCuts` sweeps segment paths *and* the lines between adjacent segments, because the existing rope sweep queries only targets and bumpers — without it a fast segment would pass straight through and the cut would silently fail, and a hazard that kills only sometimes reads as arbitrary. **A lost run must neither score nor unlock:** `saveProgress(levelId, score, { completed })` refuses both, *and* the Next Level button is hidden, because `onNext` loads `currentLevelId + 1` directly without consulting `unlockedLevel` — the storage guard alone left a one-click bypass sitting there as the primary button.
- **Bumpers**: static circular bodies with high restitution (0.9). Deflect the rat without dealing HP damage. Spawned from the level's `bumpers[]` array.
- **Materials**: defined in `target.js` — glass, wood, steel. **A campaign material is cosmetic plus exactly one dial.** `yoyoDamage` scales how much hitting that material hurts your own rat, which is how you win; `restitution` is read by physics; `color`/`crackedColor`/`outlineColor`/`glowColor` and `label` are drawn. That is the complete list, because targets in the nine campaign levels are indestructible (`removeTarget` is called only for shields). Six dead fields and `evaluateImpact` were removed 2026-09-14 after an audit found no reader — see **Adding Content** before reaching for a new one. The spread is deliberately narrow (**0.85 / 1.0 / 1.15**, was 0.6 / 1.0 / 1.6): because damage is purely good, a wide spread made steel strictly better than glass and *inverted* the difficulty curve — the tougher material damaged your own rat more, so the hard levels were the easy ones to score on. Measured 2026-09-13: steel one-shot the rat on 60% of hits against glass's 23%.
- **Per-hit damage cap**: `applyDamageCap` in `target.js` clamps HP loss to `MAX_HIT_DAMAGE_FRACTION` (0.40) of `RAT_MAX_HP`. Damage goes as speed² and swing speed varies ~4× within a run, so the distribution has a very long tail — measured over 61 human hits, p50 41 but p75 113 and max 426, meaning **34% of hits ended a level outright**. The medians were already right; only the tail was broken, so the fix is a bound rather than a rescale, and it is the explicit bound a one-sided knob needs. **The cap applies to the HP subtraction only** — screen shake, hit-stop, the particle burst and the hit sound all read the raw uncapped value, so a monster hit still feels enormous while removing 40 HP. That is also what keeps the three feedback constants correctly aimed at raw damage rather than needing a re-derivation.
- **Weak points (wedge targets)**: a `wedge` target is armoured everywhere but one face, named by `weakDir` (one of eight compass points). A hit arriving within `WEAK_POINT_WINDOW` (±45°) of that direction raises **that hit's** damage cap from `MAX_HIT_DAMAGE_FRACTION` (0.40) to `WEAK_POINT_CAP_FRACTION` (0.65) — it does **not** multiply damage. That choice is the whole design: 54.5% of measured hits already clamp at the ordinary cap, so a multiplier would have been invisible on more than half of all hits and invisible precisely on the hardest ones. `wedgeVerts` and `isWeakHit` in `target.js` are pure and unit-tested; the shape is convex, so Matter needs no poly-decomp (deleted in task 100), and `drawPhysicsBody` is vertex-driven, so rendering needed no change. **Which way a face points decides whether the reward can ever pay.** The first teaching level faced its wedge *downwards* — a nice idea that measured dead: every weak hit was slow (raw damage 0–40 against ordinary hits reaching 203) because reaching an underside means swinging **up**, against gravity, so the raised cap never bound. Facing it away from the hand, where it is struck on the fast return swing, the same level produced weak hits of raw 110 and 141 taking the full 65. An underside face is a *hard shot* for a later level, not a teaching one.
- **Damage states**: four overlay states driven by `ratHp / RAT_MAX_HP` — healthy (≥ 75%), dazed (50–75%, orbiting stars), injured (25–50%, wound marks + blood drips), critical (< 25%, red stars + more drips + × eyes). Independently, the rat's body/head fill blends from `variant.color` toward `variant.wornColor` as HP drops, and the per-hit `crackPattern` (generated once HP < 75%) renders as scuff marks on the rat's body via `drawCracks()`.
- **Impact feedback**: every HP-damaging hit fires three `particles.js` bursts via `emitImpactBurst` — a red blood splash (circle), target-material chunk debris (`material.crackedColor`), and rat-fur chunk debris (`variant.chunkColor`), the latter two using the `shape: 'chunk'` (rotating rectangle) particle type. Burst size/count scale with `damageIntensity(rawDamage)` = `sqrt(raw/600)`, clamped to 0–1 (it reads the **raw** uncapped value, not the HP-capped one — see the per-hit damage cap above). **It is a square root because the linear version was dead**: raw damage over 880 human hits runs p50 46, p90 182, max 1015, so `raw/600` left the median hit at 0.08 and 59% of hits below 0.10 — the documented burst scaling barely moved. The root gives p50 0.28 / p90 0.55 with monster hits still on top. Screen shake and hit-stop fire above `SHAKE_GATE` (180, the measured p90 — about one hit in ten). The old gate of 300 fired on 3.9% of hits while **54.5% of hits were taking the full capped 40 HP**, so the hits visibly doing the most to the HP bar mostly got no shake: the cap had moved what a "big hit" means to the player, and the feedback thresholds had not followed (task 136): chunk radii range from their base size up to 3× at full intensity, and ~8% of chunks spawn 2.5–4× oversized for variety. SHATTER reuses the same burst at `scale: 2`.
- **Game feel** — what makes a hit read as a hit, beyond the particle burst. All of it is presentation: none of it touches damage, scoring or physics outcomes.
  - **Hit-stop**: on a hit above `SHAKE_GATE` the *simulation* freezes for `0.04 + 0.04 × intensity` seconds (40–80ms). Only the sim block holds — physics, the elapsed clock, hit/yank/combo timers — while particles, shake and labels keep running, so the world visibly stops *for the hit* rather than reading as a dropped frame. It shares the shake gate on purpose, so the two always fire together.
  - **Screen shake**: same gate, magnitude `min(rawDamage / 120, 10)` px, decaying linearly over `SHAKE_DURATION` (0.3s).
  - **Impact flash**: a white silhouette blink over the rat's body and head for `FLASH_DURATION` (0.05s) on *every* damaging hit, not only big ones.
  - **Squash-and-stretch** (`drawRat`): the rat stretches along its velocity vector with speed (up to 14% at 120 px/step), and each damaging hit adds a compression pulse over `SQUASH_DURATION` (0.12s) that briefly outweighs the stretch. Volume is roughly preserved — the cross-axis scales by 0.7× the opposite amount.
  - **Blood decals**: `Renderer.paintSplat` draws onto a persistent offscreen canvas composited under the scene, so splats accumulate for the whole level at zero per-frame cost; `clearDecals` wipes it on each `startLevel`. Splats go on the **ground line only**, at the hit's x — a hit, a shatter (larger), and each giblet's first landing (smaller). They never paint on walls or targets.
  - **Audio bus**: every sound routes through one master `GainNode` (the mute) into a `DynamicsCompressor`, so stacked layers — a shatter over a high combo — squash rather than hard-clip. Mute persists in `localStorage` under `yoyo_muted`, separate from `yoyo_progress`.
  - **Swing whoosh**: one looping noise source through a lowpass, started at the tail pick-up (`beginSwinging`), so `READY` is silent. Loudness (`s^1.6 × 0.5`) and brightness (200 → 2600 Hz) follow the **speed meter's** 0–1 value rather than raw px/step, so it inherits the meter's calibration through `pushMaxSpeed` instead of carrying its own speed assumptions. A dead zone below 12% keeps a hanging rat silent.
- **Giblets**: on shatter, 8 fragment bodies (circular Matter.js bodies) spawn with a lobbed radial velocity (`spread × 10 × rand` px/step + small up-bias — kept well under ~50 px/step, the single-step tunneling threshold for the 50px walls/floor). Each carries a `plugin.piece` generated once at spawn: guaranteed 1 bone shard / 1 organ / 1 gut coil, the rest weighted flesh chunks (60/20/20). `drawFragments` branches per type — flesh (red blob, ragged fur-tuft edge in `variant.color`), bone (off-white shaft with knobbed ends), organ (dark maroon, baked gloss highlight), gut (two-pass pink tube) — all geometry precomputed, no per-frame randomness. Fragments collide with ground/walls (`0x0001` in the mask); first ground contact fires `fragment-landed` → `Renderer.paintSplat` (small decal splat), and airborne pieces shed blood-drip particles on a per-fragment cadence (`plugin.dripInterval`, advanced in the game loop). Removed from the world after 4000ms with an alpha fade.
- **Moving targets**: a target with a `movement: { axis, range, period }` field oscillates sinusoidally around its spawn position along `axis` (`'x'` or `'y'`), `range` (fraction of canvas width/height) wide, over `period` seconds — driven by `Physics.updateMovingTargets(elapsed)`, called each frame during SWINGING. The body stays `isStatic`; only its position is repositioned via `Body.setPosition`, so collision/damage formulas are unaffected.
- **Act structure**: 9 levels in 3 acts — Act 1 (The Sewer), Act 2 (The Warehouse), Act 3 (The Lab). An ACT CLEAR screen appears when the last level of an act is shattered. **Each act poses a different spatial question; see [Level Design](#level-design) below, which is the authority on what belongs where.**
- **Progress**: stored in `localStorage` under key `yoyo_progress` — high scores per level + `unlockedLevel` + `layoutVersion`. A save from another layout (or one predating the field) loses its high scores, which belong to different levels, and keeps its unlock progress capped at the current level count. **Bump `LAYOUT_VERSION` whenever a level id stops meaning the same level** — telemetry and saved scores both key on the id.

---

## Level Design

### Why this section exists

Measured 2026-09-14 across all nine levels: the pivot sits at x **0.20–0.24** in every one
of them (a 4% band) and y 0.44–0.50, everything else sits at x **0.48–0.86**, and rope
length spans only 120–150. Hand on the left at mid-height, targets on the right, nine times.

**The nine levels are one level with different furniture.** That single fact explains four
symptoms that had been investigated separately over weeks:

| symptom | why |
|---|---|
| flat difficulty curve (act means 3.60 / 3.68 / 3.81 hits) | the spatial problem never changes, so only furniture varies — and furniture is a weak lever |
| a shield-avoiding bot cleared 24/24 runs across L4–L9 | there is always open space to swing into |
| shield *placement* dominated shield *tier* | placement is the only real variable and is barely used |
| nothing lasts beyond 3–4 hits | no arrangement forces a longer engagement |

Tuning content cannot fix sameness of structure. Three balance passes each found this
independently before the cause was located.

### Campaign structure: teaching levels, then mixed levels

Agreed 2026-09-19 after a playtest in which the early levels felt cluttered and the zone and
shields arrived tangled together. **Each act opens with teaching levels that introduce one
mechanic apiece, and closes with a mixed level that combines them.** After Act 3 comes a
fourth section of miscellaneous mixed levels that recombine everything already taught.

| act | intent | the question | teaches, in order |
|---|---|---|---|
| **1 — The Sewer** | open | *can you build and aim speed?* | the grab and the swing; swinging from above; swinging upward; a moving target; the weak point — then a mixed level with two targets |
| **2 — The Warehouse** | constrained | *can you do it in a confined space?* | the movement zone; the shield gate (light); a stronger shield (medium) — then a mixed level combining zone and shield |
| **3 — The Lab** | hazardous | *can you do it without getting cut?* | bumpers, and yanking a snagged rope free; blades and the fail state — then a mixed finale |
| **4 — mixed** | recombination | *can you read an unfamiliar arrangement?* | nothing new — ~9 levels built from the mechanics above in different ways (Phase 2, task 173) |

The ordering is freedom → constraint → danger. An obstacle belongs to the act whose question
it sharpens: if it restricts where you may be, it is Act 2; if it punishes what you do, it is
Act 3. An obstacle that does neither is decoration. Moving targets sit in Act 1 because they
change *when* you swing, not where you may be or what punishes you.

**Materials are not a mechanic.** Their damage spread is deliberately narrow (0.85 / 1.0 /
1.15 — see Materials in Key Concepts), so a glass level and a wood level play the same. The
Act 1 material levels teach the *swing*, through pivot position and target placement, and
the material is flavour. Making materials behave differently would reopen the 2026-09-13
balance decision and is a separate design pass, not something a level can do on its own.

### Level design rules

Each rule is tagged with what enforces it. **[test]** rules are checked by the named test in
`tests/levels.test.js`, derived from the level data rather than from a hand-kept list, so a
new level is checked without anyone remembering to add it. **[playtest]** rules can only be
judged from human runs, and each names the number that judges it.

The mechanics a level uses are read from its data by `levelMechanics` in `levels.js`:
`movement` on any target → *moving*; a `wedge` target → *weak-point*; `handZone` → *zone*;
any shield → *shield*, plus *shield-strong* if one is medium or heavy; `bumpers` → *bumper*;
`blades` → *blade*.
**Not mechanics:** materials, pivot position, and the number of targets — multiple targets
are what mixed levels build up to, governed by rule 2. Shield tiers are deliberately two
mechanics rather than three: a stronger shield is taught once, with a medium, and heavy
only ever appears in mixed levels, so a separate *heavy* mechanic would have no teaching
level and every mixed level using it would fail rule 3.

**Structure**

1. **A teaching level introduces exactly one new mechanic.** Everything else in it has
   already been taught by an earlier level. A level with `teaches: 'swing'` introduces none —
   it varies pivot and placement only. *[test: "a teaching level introduces exactly its
   teaches mechanic"]*
2. **One target, unless several targets are the point.** A teaching level has exactly one
   target to hit the rat against; multiple targets are built up to in mixed levels. Shields,
   bumpers and blades are obstacles, not targets. *[test: "a teaching level has exactly one
   target"]*
3. **A mechanic is taught before it is mixed.** A mixed level uses only mechanics some
   earlier level has taught. *[test: "a mixed level uses only mechanics already taught"]*
4. **Acts keep their order and their shape** — freedom → constraint → danger, each act that
   teaches opening with a teaching level and closing with a mixed one. An all-mixed act (the
   planned fourth section) teaches nothing and is exempt. *[test: "each act opens with a
   teaching level and closes with a mixed one"]*

**Fairness**

5. **A teaching level is won the obvious way.** The new mechanic is the only thing in the
   player's way. *[playtest: at least 90% of runs clear each teaching level; the blade level
   fails at most ~20% of runs]*
6. **A shield guarding the only target must be reliably breakable.** With one target, every
   shield in the level is a gate — the level cannot be won without breaking it — so a
   shield there turns from "denies a surface" into a hard progression gate, and an
   unbreakable one soft-locks the level. Light is always allowed; medium only where it has
   been measured breakable; **heavy never guards the only target.** This is not hypothetical:
   the unzoned medium shield on the old L9 broke in 0 of 4 runs on 2026-09-19, its fastest
   arrival 69 against a threshold of 70. *[test: "no heavy shield in a single-target level";
   playtest: each gate shield breaks in at least 80% of runs]*
7. **Hazards arrive gently.** A teaching blade uses a forgiving `cutSpeed`, and lethality
   ramps up across the mixed levels rather than peaking at the introduction. The old L7 did
   the opposite — 45% of runs cut on the level that taught the hazard. *[playtest: blade
   teaching level fails at most ~20% of runs]*
8. **New shield and blade values start deliberately easy and are tuned from human play,
   never from bot runs.** The two error directions are not symmetric: too easy is a soft
   level, too hard is an unreachable one, which has now happened three times (the 180 tier,
   heavy after the zones, the L9 medium). The bot also does not approach a blade the way a
   person does — see Blades and the fail state. *[playtest]*

**Craft** — carried over from the 2026-09-14 findings above

9. **Every obstacle is legible before it is encountered.** A constraint the player cannot see
   cannot guide anyone: shield tiers were pointless until they were tinted per tier, and this
   applies to movement zones with particular force. A teaching level's `hint` names its
   mechanic — there is no tutorial layer, so the hint is how a level teaches. *[playtest:
   screenshot every level; a hint that the player has to be told about has failed]*
10. **Difficulty comes from arrangement first, furniture second.** If a level is hard only
    because of what is in it, it will measure like every other level — that is what happened
    to all nine originals. Rope length and target placement are the cheapest levers available
    and use code that already exists, so every level states *why* its `pushStringLength` and
    target positions are what they are, rather than copying the previous level's.
    **`pivot` is only a lever inside a zone.** Once the tail is grabbed, the pointer *is* the
    hand, and without a `handZone` nothing constrains it (`clampToZone` is a no-op) — so in
    an open level `pivot` sets where the rat starts and nothing more. The 2026-09-14 analysis
    that called the near-constant pivot "the mechanism behind the sameness" was half right:
    the sameness was real, but in the open levels it lived in target placement, not in the
    pivot. *[playtest]*
11. **Every level states what it teaches or tests, and the number that would show it
    working** — in a comment above the level, written *before* it is measured. A level
    measured first and justified afterwards will always look justified. *[review]*

### How to measure whether the acts actually differ

**Do not use hits-to-clear.** The per-hit damage cap makes 3 hits the physical
minimum (100 HP ÷ 40), and 44% of measured runs sit exactly on that floor — so
the metric cannot express "this act is harder" below about 4 hits. Task 128 was
originally written against a *rising hits-to-clear curve*, and the cap, which
fixed a real and severe bug, made that criterion unmeasurable rather than merely
unmet. It was restated on 2026-09-17.

What each act is measured on instead is the thing its intent actually predicts,
and each act has a distinct signature (96 human runs, 2026-09-17):

| act | intent | signature | measured |
|---|---|---|---|
| 1 — open | build and aim speed | **highest glancing**, fastest clears | 18.7% glancing, 3.05 s |
| 2 — constrained | deliberate placement | **slowest clears**, glancing falls | 12.5% glancing, 4.97 s |
| 3 — hazardous | risk under pressure | **the only act that can kill you** | 11.7% glancing, 21% of runs cut |

All three pairs of acts are distinguishable on at least one metric, and each
act's signature is the one its stated intent predicts — which is what "the acts
differ" was always meant to mean. A future act, or a re-lay of one of these,
should be held to the same bar: state the intent, then name the metric that
would show it is working, *before* measuring.

**These figures describe the nine-level layout.** The 2026-09-19 restructure
replaces it, so they are the bar the new acts must still clear, not a
measurement of them. Runs recorded before and after carry different
`layoutVersion`s and must never be pooled — level 4 before and level 4 after
are different levels with the same id.

---

## Adding Content

**New level**: add an entry to `LEVELS` in `levels.js`.

Required fields: `id`, `act`, `name`, `kind`, `background`, `groundColor`, `pivot`, `targets[]`, `parScore`, `stringLength`.

**`kind`** — `'teaching'` or `'mixed'`, and a teaching level also sets **`teaches`**: one of `'swing'` (no new mechanic — the level varies pivot and placement only) or a mechanic from `MECHANICS` in `levels.js`. The suite checks the level against the **Level design rules** using its *derived* mechanics, so a teaching level that contains anything beyond what it declares fails — declare what the level is for, and the data has to agree. Read the rules before placing a level.

Optional fields: `hint`, `pushStringLength` (overrides `stringLength`), `pushParScore` (default 1500), `bumpers[]`, `handZone`.

**`blades`** — `[{ x, y, w, h, angle, cutSpeed }]`, position as canvas fractions and size in px, `angle` in degrees (default 0), `cutSpeed` in px/step (default 120). Cuts the tail when it crosses **above that speed** and **fails the level**. Act 3 vocabulary; see **Blades and the fail state** in Key Concepts before placing one. **Placement is a weak lever here** — measured across 24 runs, moving blades around barely changed how often they killed; `cutSpeed` is the dial that matters.

**`shieldSpeedScale`** — one number (default 1.0) multiplying every shield tier's break speed for this level, expressing what speed the level physically permits. **A level with both a `handZone` and shields must declare one**, and the suite enforces it: zones roughly halve arrival speed, and leaving shields at the unscaled table is what made the heavy tier unbreakable. Measure it; do not guess.

**`handZone`** — `{ x, y, w, h }` as canvas fractions, `x`/`y` being the top-left corner. Confines the hand to that rectangle: the pivot keeps following the pointer inside it and stops at the boundary. A level without one is unaffected. Two things to get right when you add one:

- **The tail-grab point must lie inside the zone**, or the level cannot be started at all — a level opens with the grab target at `pivot.x + pushStringLength` on the ground, and if that falls outside the zone the player cannot reach it.
- It bounds **where** the hand may be, not how fast it may move. A per-frame speed cap was tried in 2026-09-11 and rejected for capping the skill ceiling; limiting position is meant to do the opposite, by making placement matter.

Target fields: `shape` (`'rectangle'`, `'circle'` or `'wedge'`), `x`, `y`, `material`, and for rectangles `w`/`h`, for circles `r`, for wedges `size` plus **`weakDir`** (one of `n, ne, e, se, s, sw, w, nw`) — see **Weak points** in Key Concepts, and note that a downward-facing weak face is reached only by a slow upward swing, so it rewards nothing. Shield targets add `isShield: true` and `shieldTier` (`'light'`, `'medium'` or `'heavy'`) **instead of** `material` — the tier supplies both the break speed and the colour, and writing a raw `breakSpeed` or `material` on a shield fails the suite. Optional `movement: { axis: 'x'|'y', range, period }` makes the target oscillate — `range` is a fraction of canvas width (`axis: 'x'`) or height (`axis: 'y'`), `period` is the full oscillation in seconds.

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
> This is why variants are a **feel choice**, settled on 88 human runs (2026-09-13,
> task 126). Differentiate a new variant on what a player can see and hear —
> `radius`, `blastBonus`, `trailLength`, colour, sound — and give it a `parHits`
> matching the hit count it actually measures at, so it scores 3000 like the others.
> Do not reach for `impactMultiplier` to make a variant "better": there is no cost
> anywhere in the game for it to trade against, so it only re-creates the imbalance
> task 126 removed. And do not assume `radius` buys difficulty either — that was
> tried, on a claimed 31% vs 15% glancing split, and measurement came back 19.4%
> vs 20.3%. Whatever axis you think you have added, measure it before labelling it.

**New material**: add to `MATERIALS` in `target.js` with exactly the seven live fields — `yoyoDamage`, `restitution`, the four colours, and `label`. **Do not add a field the code does not read.** Six such fields (`strength`, `crackThreshold`, `hardnessFactor`, `density`, `fragmentCount`, `fragmentSpread`) accumulated here and survived months of work without affecting anything; `hardnessFactor` was the worst of them, still holding the pre-rebalance `yoyoDamage` values so a stale copy of a live dial sat inches from the real one. Keep `yoyoDamage` inside the existing narrow band — the suite asserts no material deals more than 1.5× another, because a wide spread makes the highest-damage material strictly better and inverts the difficulty curve. The other fields are currently decorative (see **Materials** in Key Concepts), so a new material differs in look and sound, not in play, until `evaluateImpact`'s outcome is actually wired to something.

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

**Filter by `layoutVersion` before grouping by level.** Every run document
carries it (`LAYOUT_VERSION` in `levels.js`); a run without the field is layout
1, the nine-level campaign. Level ids are reused across re-lays, so "L4" in
layout 1 (Low Ceiling) and "L4" in layout 2 (Drifter) are different levels, and
an export that spans the change holds both. Grouping by `level` alone pools them
silently and measures neither.

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
