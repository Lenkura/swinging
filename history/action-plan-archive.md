# Action Plan Archive — swinging

Completed and superseded action items moved out of `project-state.json` on 2026-07-03
to keep the per-session briefing lean (frameworklite token economy). Open items live in
`project-state.json`; full rationale for each round is in its `decisions` array.

| # | Status | Priority | Task |
|---|---|---|---|
| 1 | completed | high | Decide what to do with fling mode: keep as second mode, repurpose as level variant, or cut. Document the decision. |
| 2 | completed | medium | Balance pass on damage values (the '/ 50' divisor in main.js) once more levels exist |
| 3 | completed | medium | Add more push mode levels with varied pushStringLength and target layouts |
| 4 | completed | low | Visual feedback on near-miss angles (e.g. 'Glancing blow!' flash) |
| 5 | completed | low | Screen shake on high-damage hits |
| 6 | completed | low | Sound effects |
| 7 | completed | low | Level select screen (unlockedLevel already tracked in localStorage but no UI) |
| 8 | completed | medium | Update CLAUDE.md — test framework (Vitest) is already set up; CLAUDE.md incorrectly says it isn't |
| 9 | completed | high | Verify fragmentsSpawned fix in physics.js — browser test shatter, confirm fragment count is correct |
| 10 | completed | high | Confirm SRI hashes in index.html are valid (not placeholders) for Matter.js 0.19.0 and poly-decomp 0.3.0 |
| 11 | completed | high | Run npx vitest run and record pass/fail result — 51/51 passing |
| 12 | completed | medium | Update TEST_SPEC.md for push mode — push-mode input, HP drain, hit cooldown, combo system |
| 13 | completed | medium | Update CLAUDE.md — push mode as primary mechanic, state machine paths, combo system, Tech Stack section |
| 14 | completed | medium | Remove fling mode entirely — delete RELEASED state, fling input, mode UI |
| 15 | completed | low | Fix .gitignore — add .env, *.env.*, secrets/, *.key, *.pem, credentials* |
| 16 | completed | low | Commit post-review hygiene branch |
| 17 | completed | high | renderer.js — replace yoyo drawing with procedural rat; 4 damage states; giblet fragment colours |
| 18 | completed | high | yoyo.js — update variant display names (Brown Rat / Sewer Rat), descriptions, colours |
| 19 | completed | high | index.html — title → Rat Smash, picker label, variant button text |
| 20 | completed | medium | levels.js + ui.js — replace yoyo copy in hint text and UI strings |
| 21 | completed | high | Browser-test commit 1: verify rat renders at all damage states, giblets on shatter, both variants distinct |
| 22 | completed | medium | Rename yoyo.js → rat.js, export RAT_VARIANTS; update all imports |
| 23 | completed | medium | physics.js — internal symbol renames (yoyoBody → ratBody, spawnYoyo → spawnRat, etc.) |
| 24 | completed | medium | main.js — internal symbol renames (yoyoHp → ratHp, YOYO_MAX_HP → RAT_MAX_HP, etc.) |
| 25 | completed | medium | index.html + css/style.css — CSS class renames (yoyo-btn → rat-btn, etc.) |
| 26 | completed | medium | CLAUDE.md — update project overview, architecture table, key concepts for rat retheme |
| 27 | completed | high | Run npx vitest run — confirm all tests pass |
| 28 | completed | high | Design 9 level configs in levels.js — 3 acts, shapes, shield/bumper placement, themes |
| 29 | completed | high | physics.js — circle/angle support in spawnTargets; isShield tag; spawnBumpers; getBumperBodies export |
| 30 | completed | high | main.js — shield collision branch; spawnBumpers in startLevel; pass bumpers to renderer |
| 31 | completed | high | renderer.js — circle target rendering; shield visuals; drawBumpers |
| 32 | completed | medium | ui.js — act-grouped level select with section headers; ACT CLEAR result state |
| 33 | completed | medium | Balance pass — speed² damage formula (DAMAGE_SCALE=1200), shield breakSpeeds lowered, par scores recalibrated |
| 34 | completed | medium | Fix picker/level-select overlap: hide #rat-picker when level select is visible so lower level cards (7-9) are clickable |
| 35 | completed | high | Mobile/touch support — PointerEvents API replaces mouse listeners in input.js; touch-action:none on canvas attach |
| 36 | completed | high | Canvas scaling — fitToViewport() in main.js applies translate(-50%,-50%) scale(s) to #game-container on load and resize |
| 37 | completed | low | Remove calcScore dead code from main.js (fling-mode scoring function, now unreachable) |
| 38 | completed | medium | Shield audio — playShieldBlock() for TOO SLOW!, playShieldBreak() for SHIELD BREAK! |
| 39 | completed | medium | End-game state — ALL SMASHED! screen with gold glow on level 9 clear |
| 40 | completed | low | Fix picker icon colors — .standard-icon and .heavy-icon now match actual rat colors |
| 41 | completed | low | Delete stale PLAN.md (superseded by project-state.json) |
| 42 | completed | medium | Unit tests — scoring.js extracted; calcPushScore + comboMultiplier tested (11 tests) |
| 43 | completed | low | Fix drawCracks for circle targets — maxR now uses plugin.radius for circles |
| 44 | completed | high | Re-verify the Vitest suite passes in the migrated frameworklite scaffold |
| 46 | superseded | high | Rework rat attachment: hold the rat by the tail instead of a string constraint (replaces the 'String' key concept — affects physics.js constraint setup and renderer.js tail drawing) |
| 47 | superseded | high | Tune rat physics so the rat feels less weightless — more effort/momentum-building required to get it up to speed (mass, drag, or constraint stiffness adjustments) |
| 48 | superseded | medium | Heavier impact feedback: more red splash particles and chunk/fragment debris on each hit, not just on shatter |
| 49 | completed | high | physics.js — move attachString's pointB from rat center {x:0,y:0} to a tail-base offset derived from ratBody.plugin.radius (matching the tail-start position in drawRat, ~{x: -r*0.85, y: r*0.22}) |
| 50 | completed | high | rat.js — tune mass/frictionAir for standard and heavy variants for added swing weight; main.js — adjust constraint stiffness passed to attachString if needed |
| 51 | completed | high | renderer.js — remove drawString(); add a tail-stretch draw routine anchored at the tail base, reusing the existing sag/bow curve math, rendered as a tapered tail |
| 52 | completed | medium | renderer.js + main.js — switch rat rotation from accumulated spinAngle/updateSpin to physics-driven body.angle; remove the now-unused spin-tracking code |
| 53 | completed | high | Browser-test commit — verify swing feel (weight, tail-hold visual, natural hang orientation) across both rat variants and a sample of levels (level 1, a shield level, a bumper level); rebalance par scores/shield breakSpeeds if regressions surface |
| 54 | completed | medium | CLAUDE.md — rewrite the 'String' key concept to describe the new tail-attachment physics (off-center constraint, gravity-driven hang/rotation) |
| 55 | completed | high | particles.js — add shape: 'chunk' to emit() (random rotation + angularVelocity per particle); update() advances rotation; draw() renders chunks as small rotated rectangles instead of circles. Circular particles unchanged. |
| 56 | completed | medium | rat.js — add two new per-variant color fields: a worn/scuffed body tone (for HP-based color blend) and a fur-chunk debris tone (for the new rat-chunk particle burst) |
| 57 | completed | medium | physics.js — add isCircle: true to the rat body's plugin object in spawnRat(), so drawCracks() works on it |
| 58 | completed | high | main.js — add a damage → intensity helper; in the HP-damage hit branch, replace the single existing Particles.emit() with three calls (red blood splash, target chunk debris via material.crackedColor, rat chunk debris via the new fur tone), all scaled by intensity |
| 59 | completed | medium | main.js — apply the same three-burst treatment at a larger scale to the existing SHATTER particle emit |
| 60 | completed | high | renderer.js — in drawRat(), render body.plugin.crackPattern as scuff marks via drawCracks() when body.plugin.cracked is true, and blend the body fill color toward the new worn tone based on hpFraction |
| 61 | completed | high | Browser-test — verify splash/chunk/body-wear visuals across materials, both rat variants, and HP tiers; check for particle-count/perf issues during rapid combo chains (no cap currently exists in particles.js) |
| 62 | completed | medium | CLAUDE.md — update Key Concepts to document the new particle shapes, rat body-wear rendering, and the new rat.js color fields |
| 63 | completed | high | rat.js — recalibrate pushMaxSpeed: standard 600→750, heavy 500→625 (both ×1.25), so the realistic top swing speed (~450/375) reads as 60% on the speed meter instead of ~75% |
| 64 | completed | high | main.js — recalibrate DAMAGE_SCALE 1200→2000, so a clean realistic-top-speed hit no longer guarantees a 1-hit shatter on most materials, raising the skill ceiling for the ideal (1-hit) score |
| 65 | completed | medium | main.js — rescale the two damage-derived visual-feedback constants by the same 0.6× factor as DAMAGE_SCALE: shake threshold `damage > 20` → `> 12`, and damageIntensity saturation `damage / 40` → `damage / 24` |
| 66 | completed | low | levels.js — shape variety: convert the single rectangle target in level 1 ('Pipe Dreams') and level 7 ('Deflection') to circles, and the top glass block in level 3 ('The Stack') to a circle |
| 67 | completed | medium | levels.js — add a `movement` field to the steel vault in level 6 ({ axis: 'y', range: 0.04, period: 2.5 }) and the steel target in level 9 ({ axis: 'x', range: 0.03, period: 2.0 }) |
| 68 | completed | high | physics.js — in spawnTargets, store plugin.movement (rangePx + basePos) for targets with a `movement` field; add exported updateMovingTargets(elapsed) that repositions those bodies via Body.setPosition along a sine wave |
| 69 | completed | high | main.js — track an `elapsed` time accumulator (reset in startLevel, advanced by dt during SWINGING) and call Physics.updateMovingTargets(elapsed) each frame |
| 70 | completed | medium | physics.js — in spawnRatFragments, replace the shapeType field with a blobVerts array (8-9 vertices, jittered radius 0.7-1.2×) generated once per fragment for organic 'flesh chunk' shapes |
| 71 | completed | medium | renderer.js — rewrite drawFragments to render blobVerts as a closed, quadratic-curve-smoothed lumpy outline instead of the shapeType switch |
| 72 | completed | low | renderer.js — updateTrail(x, y, maxLen) caps the trail buffer at maxLen (default TRAIL_MAX=30); lower drawTrail's per-segment alpha multiplier from 0.45 to 0.25 |
| 73 | completed | low | main.js — pass RAT_VARIANTS[selectedVariant].trailLength (20 standard / 12 heavy) as maxLen to Renderer.updateTrail, activating the previously-dormant per-variant trail length |
| 74 | completed | medium | CLAUDE.md — update DAMAGE_SCALE/damageIntensity values in Key Concepts, add a 'Moving targets' Key Concept, update 'Giblets' to describe blob shapes, and document the new `movement` field in 'Adding Content' |
| 75 | completed | high | main.js — correct DAMAGE_SCALE 2000->200, damageIntensity saturation 24->240, shake threshold 12->120 (shakeIntensity divisor 8->80); update CLAUDE.md HP system and Impact feedback bullets accordingly |

## Item details (done_when / context)

**44.** Re-verify the Vitest suite passes in the migrated frameworklite scaffold
- Done when: `npm install` then `npx vitest run` reports 51/51 tests passing with no path or import errors from the new D:\Frameworkspace\swinging location

**46.** Rework rat attachment: hold the rat by the tail instead of a string constraint (replaces the 'String' key concept — affects physics.js constraint setup and renderer.js tail drawing)
- Done when: /brainstorm has been run to settle the constraint/visual approach before implementation

**47.** Tune rat physics so the rat feels less weightless — more effort/momentum-building required to get it up to speed (mass, drag, or constraint stiffness adjustments)
- Done when: /brainstorm has been run to settle the tuning approach before implementation

**48.** Heavier impact feedback: more red splash particles and chunk/fragment debris on each hit, not just on shatter
- Done when: /brainstorm has been run to settle the particles.js/renderer.js approach before implementation

**49.** physics.js — move attachString's pointB from rat center {x:0,y:0} to a tail-base offset derived from ratBody.plugin.radius (matching the tail-start position in drawRat, ~{x: -r*0.85, y: r*0.22})
- Context: First step of the approved tail-attachment redesign (combined #46/#47 brainstorm) — the off-center anchor lets gravity torque the rat to hang below the grip point, giving both the 'held by the tail' feel and a heavier swing.

**52.** renderer.js + main.js — switch rat rotation from accumulated spinAngle/updateSpin to physics-driven body.angle; remove the now-unused spin-tracking code
- Context: Depends on task 49 — once the off-center constraint drives real torque on the rat body, body.angle reflects the natural hang/rotation and the old manually-accumulated spin angle becomes redundant.

**53.** Browser-test commit — verify swing feel (weight, tail-hold visual, natural hang orientation) across both rat variants and a sample of levels (level 1, a shield level, a bumper level); rebalance par scores/shield breakSpeeds if regressions surface
- Context: User playtested manually and iterated on rat.js/main.js tuning directly (4 rounds) rather than touching levels.js — final values logged in the 2026-06-14 tuning decision. Par score / shield breakSpeed rebalance was not flagged as needed, but watch for it if task 45's full playthrough surfaces issues.

**56.** rat.js — add two new per-variant color fields: a worn/scuffed body tone (for HP-based color blend) and a fur-chunk debris tone (for the new rat-chunk particle burst)
- Context: Prep step for tasks 58 and 60, which reference these new fields when emitting rat-chunk particles and blending the body's worn color.

**57.** physics.js — add isCircle: true to the rat body's plugin object in spawnRat(), so drawCracks() works on it
- Context: main.js already generates crackPattern/cracked data for the rat body based on HP (lines ~152-154) but drawCracks() requires plugin.isCircle to compute maxR — this is the missing piece that lets task 60 render that dormant data as body scuff marks.

**59.** main.js — apply the same three-burst treatment at a larger scale to the existing SHATTER particle emit
- Context: Depends on task 58's intensity helper and three-burst structure — reapplies it at shatter time with larger scale multipliers.

**60.** renderer.js — in drawRat(), render body.plugin.crackPattern as scuff marks via drawCracks() when body.plugin.cracked is true, and blend the body fill color toward the new worn tone based on hpFraction
- Context: Depends on tasks 56 (worn-tone color field) and 57 (isCircle fix) — activates the per-hit crackPattern data main.js already generates but currently discards.

**65.** main.js — rescale the two damage-derived visual-feedback constants by the same 0.6× factor as DAMAGE_SCALE: shake threshold `damage > 20` → `> 12`, and damageIntensity saturation `damage / 40` → `damage / 24`
- Context: Depends on task 64 — without this, screen-shake and impact-burst intensity would trigger at higher real speeds than before, even though the underlying hit feels the same.

**67.** levels.js — add a `movement` field to the steel vault in level 6 ({ axis: 'y', range: 0.04, period: 2.5 }) and the steel target in level 9 ({ axis: 'x', range: 0.03, period: 2.0 })
- Context: Depends on tasks 68-69 to actually move the targets — the field is inert schema until physics.js/main.js read it.

**69.** main.js — track an `elapsed` time accumulator (reset in startLevel, advanced by dt during SWINGING) and call Physics.updateMovingTargets(elapsed) each frame
- Context: Depends on task 68's updateMovingTargets export.

**71.** renderer.js — rewrite drawFragments to render blobVerts as a closed, quadratic-curve-smoothed lumpy outline instead of the shapeType switch
- Context: Depends on task 70's blobVerts data.

**73.** main.js — pass RAT_VARIANTS[selectedVariant].trailLength (20 standard / 12 heavy) as maxLen to Renderer.updateTrail, activating the previously-dormant per-variant trail length
- Context: Depends on task 72's updateTrail signature change.

**75.** main.js — correct DAMAGE_SCALE 2000->200, damageIntensity saturation 24->240, shake threshold 12->120 (shakeIntensity divisor 8->80); update CLAUDE.md HP system and Impact feedback bullets accordingly
- Context: Playtest of tasks 63-74 found Level 1 took 30-40 hits instead of the targeted ~2-3; the task-63 calibration assumption (real swings reach ~60% of pushMaxSpeed) was wrong. This is a direct 10x correction to bring Level 1 to ~3-4 hits.

