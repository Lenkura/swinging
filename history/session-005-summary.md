# Session 005 — Playtest tooling, segmented rope, and the first measured numbers

Dates: 2026-09-06 → 2026-09-12
Merge: `1889ba8` (20 commits, three stacked branches) → main `c93c42a`

---

## What happened

Started by committing outstanding giblet work, then built a measurement
toolchain, then used it to design and ship a segmented rope tail. The through-line
is that almost every conclusion this session came from a measurement that
contradicted a reasonable-sounding assumption.

### 1. Giblet redesign closed (tasks 101–104)

Typed giblet pieces, the fragment collision-mask fix that lets them land, landing
splats and airborne drips — committed, then signed off by the user on regenerated
screenshots.

The original screenshots had been written to a session temp directory and lost
(the blocked-`C:\Users` trap, `L0055`). Regenerated into the committed
`history/screenshots/`, which is now the standing rule for anything needing
perceptual sign-off.

### 2. Playtest tooling (tasks 105–111)

- `js/dev/telemetry.js` — one run schema for human, bot and gate runs
- `js/dev/bot.js` / `harness.js` — in-page swing policies driving real PointerEvents
- `dev/run-batch.mjs` — 20 seeded runs in ~30s across parallel headless contexts
- `dev/gate.mjs` — `npm run gate`, positive invariants, **verified to fail** on a
  deliberate break
- `dev/shots.mjs`, `js/dev/calibrate.js`, `dev/ab.mjs`

All `?dev=1`-gated behind a dynamic import: a normal player fetches none of it.

### 3. The first human measurement (task 112)

Read out of the browser's `localStorage` directly. Free-swing peak **1146**,
in-play sustained **109**, hits to clear **6**.

The assumption that had driven every balance decision was "~60% of
`pushMaxSpeed`". Sustained play is **14.5%** of it; a free swing reaches **153%**
of it. Wrong in both directions at once.

### 4. Segmented rope (tasks 116–124)

Rope of 10 collidable segments, manual CCD, player yank, collision-category
cleanup. Shipped as the default tail.

---

## Decisions worth remembering

- **The rope made the game easier, not harder.** A/B across 9 levels: hits to
  clear 5 → 3, peak speed down 30% but sustained speed up 23% and glancing hits
  down 36%. Rope mass acts as a flywheel; a steady clean swing out-damages a
  peaky one because damage goes as speed² and with angleFactor.
- **No gameplay constant was changed all session.** The data never demanded it,
  and tuning against bot numbers would repeat the mistake the tooling exists to
  prevent.
- **Rope parameters came from a sweep, not taste.** At 1–2% segment mass the rope
  swallowed the swing entirely (peak 320 → 40); at 25% it read as a chain. 5%
  with 48 constraint iterations was the measured answer.
- **Tunneling was root-caused three times before it was fixed.** Not gravity, not
  rope parameters, not the hand cap. Matter 0.19 has no CCD; the fix was sweeping
  rope segments *and* the links between them.

## Problems hit

- **Harness bug: `getLastRun()` returns the previous run's document while a run
  is recording**, so every timed-out run reported an earlier success as its own.
  Invalidated a whole parameter sweep before it was caught.
- **A tautological probe.** Compared `body.velocity` against position delta to
  prove real motion vs solver correction — but Matter *defines* velocity as the
  position delta. The check proved nothing and was reported as if it had.
- **A flaky gate check.** The non-dev HP-drop assertion needed an open-loop sweep
  to land two hits; on identical code it produced 1.9%, 49%, 7.5%, 3.1%. Replaced
  with a canvas-animation invariant, self-tested against a frozen build.
- **`npm run serve` never started.** A Windows file-URL guard compared
  `import.meta.url` against a hand-built two-slash string. Documented without
  ever being run.
- **A wrong recommendation.** Told the user to test `hand=40`, which still
  tunneled 26% of the time, because rope displacement was estimated from the
  *rat's* speed when segments whip nearly twice as fast.

## Next actions

1. **Task 125** — fresh human calibration on the rope build; the 2026-09-06
   numbers do not survive it.
2. **Task 113** — breakable targets. Needs the design gate: no ordinary target
   can currently be destroyed (the outcome is computed at `physics.js:84` and
   discarded at `main.js:166`), and making them breakable changes what ends a
   level.
3. **Task 115** — Act 2/3 obstacle difficulty, deferred behind 113.
4. **Tasks 79/80** — per-act backgrounds, which the user asked for on 2026-09-06
   and which are still untouched.
5. **Task 100** — remove the dead poly-decomp tag (two console errors per load).
