# Session 006 — Calibration on the rope build, and a balance problem it exposed

Date: 2026-09-12 (continues session 005 after the rope merge)
Branch: `swinging/fix/speed-meter-calibration`

---

## What happened

Post-merge calibration of the rope build against real human play. One constant
changed; the interesting output was a diagnosis, not a fix.

### Calibration (task 125)

45s free swing, both variants:

| | standard | heavy |
|---|---|---|
| p50 | 133.6 | 113.1 |
| p90 | 280.4 | 227.1 |
| peak | 719.6 | 784.3 |

Against the pre-rope numbers, standard peak fell **1146 → 719.6 (−37%)**, p90 and
p50 both −25%. The rope costs real momentum, measured on a human rather than the
bot — which is what it was built to do.

It also fixed the speed meter by accident: standard now peaks at **96%** of its
`pushMaxSpeed` where it previously hit **153% and saturated**. Heavy still
overshot at 125%, so it was raised 625 → 785.

**The only gameplay-adjacent value changed all session**, and it is presentation
only — `pushMaxSpeed` has one use, normalising the meter and whoosh at
`main.js:420`, and never enters the damage formula.

### Level 1 (task 127)

Four human runs per variant, on the level the 3–4 hit target was written for:

| | hits | median | score | glancing |
|---|---|---|---|---|
| standard | 11, 17, 10, 6 | **10.5** | 200 (floor, every run) | 31% |
| heavy | 4, 5, 5, 5 | **5** | 1000 | 15% |

Both miss the target; standard by about 3×.

---

## The finding

**Damage cannot be a trade-off in this game.** You destroy your *own* rat and
score rewards fewer hits, so more damage per hit is purely good. Any variant with
a higher multiplier is permanently strictly better.

**Mass cannot be the counterweight.** Heavy is 11.5 against standard's 4.5 and
should swing slower — but the player drives the pivot directly, so the hand
overrides inertia. In play both variants clock **identical speed (114.1 vs
114.4)**. Mass-based trade-offs do not survive this control scheme.

So heavy wins on every measured axis: same speed, 2.4× damage per hit, half the
glancing, bigger body. `DAMAGE_SCALE` was left alone deliberately — the ~3.3×
standard needs to reach target would drop heavy to ~1.4 hits and bake the
imbalance in permanently.

## Corrections made this session

- I said heavy swings ~15% slower, generalising from free-swing calibration.
  In play the two are identical. The trade-off does not exist where it matters.
- I said the bot appeared to track human numbers. On L1 it does not — bot
  standard 6 vs human 10.5, bot heavy 2 vs human 5. The bot is roughly twice as
  effective as the player; the earlier agreement on L4 was coincidence.

## Next actions

1. **Task 126** — `/brainstorm` the variants. The structural problem above is
   written into the task. This blocks everything else in the balance cluster.
2. **Task 129** — L1 at ~10 hits on standard. Blocked on 126.
3. **Task 128** — level and obstacle cohesion (user request). Should follow or
   absorb 113 (breakable targets) and 115 (obstacle difficulty), since both
   change what level geometry can express.
4. **Task 113** — breakable targets. No ordinary target can currently be
   destroyed: the outcome is computed at `physics.js:84` and discarded at
   `main.js:166`.
5. **Tasks 79/80** — per-act backgrounds, still untouched since the user asked.

## Data

`history/calibration/human-runs-log.csv` is the durable record — 28 runs across
three builds. The browser store keeps only the last 10 and has already discarded
the calibration runs, so the CSV is the only surviving copy.
