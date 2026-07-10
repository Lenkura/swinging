# Session 004 Summary — Rat Smash
**Session ID:** b066af57-9fb3-46fa-b59d-310719dec037
**Date:** 2026-07-04 (design logged 2026-07-03)

Backfilled 2026-07-06 from the `decisions` log and git history. Full rationale for the
design decision below lives in `project-state.json → decisions` (dated 2026-07-03).

---

## Overview

Plan housekeeping followed by the game-feel bundle. First archived the completed action
backlog and queued a graphics/sound polish backlog from a project review (commit `5d92a8f`),
then designed and implemented five "juice" effects as a single inline bundle
(commits `d771795`, `f33a00a`).

---

## Decisions

- **Action-plan archive + polish backlog** — moved all 74 completed/superseded items out of
  `project-state.json` into `history/action-plan-archive.md` (the plan had grown to ~600
  lines, mostly history duplicated by the decisions log); queued a 16-item graphics/sound
  polish backlog (tasks 77-92), with the two big bundles gated on `/brainstorm`.
- **Game-feel bundle design** (supersedes tasks 81/82/83/87/89 with tasks 93-98) —
  **approach A, inline integration**, chosen over a dedicated `juice.js` module (abstraction
  ahead of need) and an event bus (oversized). Five effects:
  1. **Hit-stop** — a `main.js` timer freezing the sim block (physics + gameplay timers pause;
     particles/shake/render keep running) on the shared `damage > 120` threshold, 40-80ms
     scaled by `damageIntensity`. Physics-only freeze chosen because a full render freeze
     reads as a dropped frame.
  2. **Impact flash + squash-stretch** — ~2-frame white flash on every damaging hit plus
     velocity-aligned squash-stretch in `drawRat`.
  3. **Ground blood decals** — offscreen decal canvas (the `cachedGroundCanvas` pattern) with
     `paintSplat`/`clearDecals`, blitted between ground and targets, cleared on restart.
     Ground-only; target stains rejected (conflict with crack overlays, removed shields,
     moving targets).
  4. **Audio master bus** — lazy `GainNode → DynamicsCompressor` chain rerouting all
     `connect(ac.destination)` sites, with a persisted mute toggle (`yoyo_muted`). Mute-only,
     no slider (the bus makes a slider trivial later).
  5. **Swing whoosh** — a looping noise→lowpass→gain source ramped each frame from the 0-1
     `normalizedSpeed`, so it inherits rather than duplicates the unvalidated meter calibration.

---

## Files Changed

Commit `d771795` (2026-07-04, "feat(main): game-feel bundle"):
- `js/audio.js` — master `GainNode → DynamicsCompressor` bus; `setMuted`/`isMuted`; whoosh
  source (start/stop + per-frame ramp)
- `js/main.js` — hit-stop timer gating the sim block; flash timer; decal paint calls; whoosh
  start/stop wiring
- `js/renderer.js` — impact flash + squash-stretch in `drawRat`; `paintSplat`/`clearDecals`
  offscreen decal canvas
- `js/ui.js` — mute toggle button wired through audio state
- `index.html`, `css/style.css` — mute button markup + styling

Commit `f33a00a` (2026-07-04, "chore(docs)"): `project-state.json` only — logged the design
decision and marked tasks 93-97 implemented pending playtest. **Did not touch CLAUDE.md.**

Commit `5d92a8f` (2026-07-03): `history/action-plan-archive.md` (created), `project-state.json`
(trimmed to open items), `spec.md`.

---

## Problems & Resolutions

- **No blockers.** Bundle syntax-checked and the Vitest suite stayed 61/61. Perceptual
  acceptance (the real gate) was deferred to a browser playtest (task 98), since green tests
  cannot judge feel.

---

## Open Questions

- The bundle's tuning constants (flash/squash durations, whoosh curve, splat sizes) are
  unvalidated until the task-98 playtest and may still move.
- Implementation shipped ahead of the tasks-76/45 playtests that the design had gated it on.

---

## Next Actions

1. Task 98 — browser playtest both rat variants across normal/shield/bumper levels to verify
   all five effects read correctly together with no core-loop regressions.
2. **Task 99 — document the bundle in CLAUDE.md Key Concepts** (added 2026-07-06). No CLAUDE.md
   doc subtask was ever queued for tasks 93-97, so the five shipped effects are currently
   undocumented — unlike every prior feature round (#54, #62, #74). Sequenced after task 98 so
   final tuned constants are captured.
3. Still-pending tasks 76 and 45 playtests.
