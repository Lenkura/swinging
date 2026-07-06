# Session 003 Summary — Rat Smash
**Session ID:** a0f8301f-240d-45be-9bc4-39aee508d7e3
**Date:** 2026-06-15 (work committed 2026-06-12 / 2026-07-03)

Backfilled 2026-07-06 from the `decisions` log and git history — this session predated the
`history/` summary habit, so no summary was written at the time. Full rationale for every
decision below lives in `project-state.json → decisions` (dated 2026-06-12 and 2026-06-14).

---

## Overview

The post-migration physics-and-feel overhaul. Bridges the frameworklite scaffold migration
(landed just before this session, commit `92c1b2d`, 2026-06-12) into the first large gameplay
round on the new scaffold: the tail-attachment redesign, heavier impact feedback, a four-part
tuning/feature round, and a damage-scale correction. Bundled into commit `b13e042`
("feat(physics): tail attachment, impact bursts, moving targets, damage rescale").

---

## Decisions

- **Tail-attachment redesign** (combined action items #46+#47) — moved the swing constraint
  from the rat's center to a tail-base anchor so gravity torques the rat to hang below the
  grip point ("held by the tail"); replaced the rope visual (`drawString`) with the rat's own
  tail stretching to the pivot; switched rotation from accumulated `spinAngle` to physics
  `body.angle`. A two-body ragdoll was considered and rejected as oversized for scope.
- **Tail-attachment rebalance** — settled after 4 rounds of manual playtesting. Final values:
  standard rat mass 1.0→4.5 / frictionAir 0.005→0.025 / restitution 0.35→0.05; heavy rat
  mass 3.5→11.5 / frictionAir 0.003→0.015 / restitution 0.1→0.02; constraint stiffness
  0.65→0.35. The decisive change was reversing `frictionAir` direction (sharp ~5x increase)
  plus near-zero rat restitution.
- **Heavier impact feedback** (supersedes #48) — added a rotating `chunk` particle shape;
  every HP-damage hit now fires three damage-scaled bursts (blood splash, target-material
  chunk debris, rat-fur chunk debris); reused the dormant per-hit `crackPattern` to draw body
  scuff marks and an HP-based body-color blend toward a new worn tone. Chose particle debris
  over spawning Matter.js fragments per hit (perf).
- **Impact-feedback rebalance** — chunk radius scales 1x→3x with `damageIntensity`; 8% of
  chunks spawn 2.5-4x oversized; shatter giblets initially got 4 random geometric shapes.
- **Four-part tuning/feature round** (tasks 63-74) — (1) speed-meter + damage recalibration
  (pushMaxSpeed ×1.25, DAMAGE_SCALE 1200→2000); (2) shape variety (3 rectangles → circles);
  (3) new moving-target mechanic (`movement: {axis, range, period}`, static bodies
  repositioned via `Body.setPosition` on a sine wave); (4) organic blob giblets replacing the
  geometric shapes; (5) shorter/softer per-variant swing trail.
- **Damage-scale correction** (task 75) — DAMAGE_SCALE 2000→**200** (10x cut), with
  `damageIntensity` saturation (24→240) and the shake threshold (12→120, divisor 8→80) scaled
  by the same factor. The task-63 assumption that real swings reach ~60% of pushMaxSpeed was
  disproven by playtesting (Level 1 took 30-40 hits); the 10x cut maps that to the target ~3-4.

---

## Files Changed

Commit `b13e042` (2026-07-03):
- `js/physics.js` — tail-base constraint anchor; `movement` plugin storage +
  `updateMovingTargets`; `blobVerts` on rat fragments; `isCircle` on rat body
- `js/renderer.js` — tail-stretch draw replacing `drawString`; body scuff marks + worn-color
  blend; blob-fragment rendering; trail alpha tone-down
- `js/main.js` — physics-driven rotation; three-burst impact emit + `damageIntensity` helper;
  `elapsed` accumulator driving `updateMovingTargets`; DAMAGE_SCALE/feedback constants
- `js/rat.js` — mass/frictionAir/restitution tuning; `wornColor`/`chunkColor` fields;
  per-variant `trailLength`; pushMaxSpeed recalibration
- `js/particles.js` — `chunk` shape (rotation + angularVelocity); radius scaling
- `js/levels.js` — 3 rectangle→circle conversions; `movement` on levels 6 and 9
- `CLAUDE.md` — Key Concepts updated for tail attachment, particle shapes, moving targets,
  giblet blobs, DAMAGE_SCALE

Prior migration commit `92c1b2d` (2026-06-12): `.gitignore`, `CLAUDE.md`, `TEST_SPEC.md`,
`project-state.json`, `spec.md` — frameworklite scaffold, no game code touched.

---

## Problems & Resolutions

- **Rat felt weightless** — first two tuning passes (mass up, stiffness down) produced "no
  major difference" per the user; resolved by reversing `frictionAir` direction and dropping
  restitution near zero.
- **Fixed debris size didn't read as more impactful** — resolved by scaling chunk radius with
  `damageIntensity`.
- **Damage badly miscalibrated** — the recalibration round overshot (30-40 hits to clear
  Level 1); root cause was an unmeasured swing-speed assumption. Corrected with the 10x
  DAMAGE_SCALE cut, but the underlying `pushMaxSpeed`/meter calibration remains unvalidated
  against real swing data.

---

## Open Questions

- `pushMaxSpeed` (750/625) and the speed-meter calibration are still unvalidated against real
  swing-speed data — flagged in CLAUDE.md. (→ later action item 77: a `?debug=1` peak-speed
  overlay to ground the next pass in measured data.)
- Steel restitution 0.55: Matter.js resolves collision restitution as `max(rat, target)`, so
  steel still bounces the rat despite its near-zero restitution — promote to a fix only if
  bounce feel surfaces during the full playthrough. (→ action item 78.)

---

## Next Actions

1. Playtest Level 1 with DAMAGE_SCALE=200 to confirm ~3-4 hits and proportionate feedback
   (→ action item 76).
2. Resume the full 9-level smoke-test playthrough paused mid-migration (→ action item 45).
3. Add a `?debug=1` peak-swing-speed overlay to capture real speed data (→ action item 77).
