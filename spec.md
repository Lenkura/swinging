# Project Spec — swinging
Created: 2026-05-20

---

## Overview

**Rat Smash** is a browser-based physics game. The pivot follows the mouse/touch; the
player swings a rat repeatedly into targets to deplete its HP and shatter it in as few
hits as possible. Nine levels across three acts (Sewer → Warehouse → Lab), each
introducing new mechanics (shields in Act 2, bumpers in Act 3).

---

## Motivation

Originally prototyped as "Yoyo Smash," the project was deliberately retheme'd to
"Rat Smash" — same core constraint-swing mechanic, now with a procedurally-drawn rat
(4 damage states, giblet shatter on death) for more personality. Vanilla JS + Matter.js
with zero build step keeps it instantly playable via any static file server.

---

## What This Project Is Not

- Not a build-tooled project — ES6 modules + CDN-loaded Matter.js/poly-decomp, no
  bundler or framework
- Not multiplayer or networked — single-player, localStorage-only progress
  (`yoyo_progress` key)
- Not a native app — runs in any modern browser via Pointer Events; no packaging
  or wrapper
- Not endless or procedural — a fixed 9-level, 3-act campaign

---

## Success Criteria

- [x] All 9 levels across 3 acts implemented, with shields (Act 2) and bumpers (Act 3)
- [x] Push-mode swing mechanic — combo multiplier, HP-based shatter, giblet
      fragments — fully retheme'd to Rat Smash
- [x] Mobile/touch support via Pointer Events + `fitToViewport` CSS scaling
- [x] Vitest suite re-verified passing (61/61 on 2026-07-03) in the migrated
      frameworklite scaffold
- [ ] Full 9-level playthrough smoke-tested end-to-end post-migration, including
      localStorage progress persistence

---

## Non-Functional Requirements

- **Performance:** N/A — no formal budget beyond smooth 60fps Matter.js simulation
- **Security:** N/A — static client-side game; CDN deps pinned via SRI hashes
- **Scale:** Single-player; only per-level high scores + `unlockedLevel` persist
  (localStorage)
- **Platform / environment:** Any modern browser (Canvas 2D, Pointer Events, Web
  Audio, ES6 modules); must be served over HTTP — `file://` breaks ES modules
- **Other constraints:** No build system; Matter.js 0.19.0 + poly-decomp 0.3.0 via
  CDN with SRI

---

## Key Users

- Player — single user playing through the 9-level campaign in a browser
- Developer — extends levels/rat variants/materials per the "Adding Content"
  guidance in CLAUDE.md
