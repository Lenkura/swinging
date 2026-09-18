# Session 008 — The level reorganisation, and five measurements pointed at the wrong thing

Date: 2026-09-14 to 2026-09-18 (continues session 007)
Branches merged: `swinging/feat/movement-zones` (with `swinging/docs/act-intent-note`),
`swinging/fix/arena-containment` (with `swinging/feat/act2-relay` and
`swinging/fix/shield-speed-scale`), `swinging/feat/blades-fail-state`

---

## What happened

Session 007 ended by folding movement zones, a blade obstacle and a general reorganisation
into task 128. This session did all of it: every one of the nine levels re-laid, two new
mechanics, the game's first fail state, and task 128 closed.

The through-line is narrower than last session's. Every problem here was a **measurement
aimed at the wrong quantity** — not a missing test, and usually not wrong code.

---

## Task 128 — the reorganisation

The design gate found the cause of four symptoms that had been investigated separately for
weeks. Measured across `levels.js`: the pivot sat at x **0.20–0.24** in all nine levels,
everything else at x 0.48–0.86, rope length 120–150.

**The nine levels were one level with different furniture.** That explained the flat
difficulty curve, a shield-avoiding bot clearing 24/24 runs, shield *placement* dominating
shield *tier*, and nothing lasting beyond 3–4 hits.

Acts now pose questions rather than introducing mechanics:

| act | intent | vocabulary |
|---|---|---|
| 1 — open | can you build and aim speed? | pivot variety, no obstacles at all |
| 2 — constrained | can you do it in a confined space? | movement zones, shields |
| 3 — hazardous | can you do it without getting cut? | blades, the fail state |

A rule for placing obstacles came with it: restricts *where you may be* → Act 2; punishes
*what you do* → Act 3; neither → decoration. That gives a reason to say no to an obstacle,
which "each act introduces a mechanic" never did.

---

## The Act 2 pilot (task 156) — a real gate, and it passed

Act 2 was built first as a pilot, deliberately, because the whole design rested on an
untested claim that constraining space produces deliberate play rather than irritation.

19 human runs against 28 on the old layout:

| | old | re-laid | control (unchanged levels) |
|---|---|---|---|
| glancing | 27.9% | **17.3%** | 22.6% |
| time to clear | 3.1 s | **5.7 s** | — |
| swing speed p50 | 130.3 | **69.4** | — |

Speed halved, time doubled, hit counts held — players landing better hits rather than
faster ones. The control rules out drift.

---

## Five measurements pointed at the wrong thing

1. **Shield tiers, after the zones.** Zones halved arrival speed, and the tiers had been
   derived from the old layout's distribution. Heavy fell from breaking in 57% of runs to
   **2% of contacts**, max recorded contact 96.0 against a threshold of 95 — the
   unreachable-180 failure by another road. Fixed with a per-level `shieldSpeedScale`; only
   the *scale* was wrong, not the ordering (zoned needed 0.74–0.81×, unzoned 1.07–1.18×,
   each internally consistent).

2. **The containment test that passed with containment absent.** The rat could leave the
   arena — no ceiling existed at all, reproduced at y = −21. The obvious check (whip the
   hand at the boundaries, watch the rat) **passed with the ceiling deliberately removed**,
   because the escape took 90 iterations to reproduce and the check ran 80. Replaced with a
   structural assertion, verified to fail when the ceiling is gone.

3. **Blade lethality, which placement could not fix.** Blades killed on any tail contact,
   and across 24 bot runs roughly **half** of all runs ended in a cut on every configuration
   tried. The cause was structural: the tail hangs from a hand that teleports to the
   pointer, so "never touch this" is an instant-death region with no boundary drawn. Gating
   on speed took the same levels to 0/8, 1/8, 0/8.

4. **n=3 samples I tuned against for two rounds.** An *unchanged* level read 1/3 then 2/3
   between samples. That is what exposed the earlier numbers as noise.

5. **Task 128's own success criterion.** It asked for a rising hits-to-clear curve. The
   per-hit damage cap from session 007 makes 3 hits the physical minimum, and **44% of 96
   runs sit exactly on that floor**, so act means came out 3.79 / 3.96 / 3.79. The cap is
   not the mistake — it took one-hit clears from 34% to **zero of 91** — it flattened the
   instrument. Restated, then closed against metrics the cap does not floor.

---

## Where the campaign landed

96 human runs, each act carrying the signature its intent predicts:

| act | glancing | time | failure |
|---|---|---|---|
| 1 — open | 18.7% | 3.05 s | 0 |
| 2 — constrained | 12.5% | 4.97 s | 0 |
| 3 — hazardous | 11.7% | 3.01 s | **21% cut** |

All three pairs separate. Zero one-hit clears in 91 cleared runs.

---

## Other problems hit

- **Zones extended below the ground line** on all three Act 2 levels, letting the hand be
  driven into the floor: the L4 bot run timed out at 90 s with 31,051 rope contacts.
- **`dev/gate.mjs` held a copy of L1's geometry** to compute the tail-grab click, which the
  Act 1 re-lay silently invalidated. It now imports `LEVELS`. Caught only because that check
  is a positive assertion.
- **Two tests pinned level names as literals**, so a legitimate rename failed a test about
  `getLevel` returning the right id.
- **The `saveProgress` guard was satisfied in letter** while the result screen still offered
  Next Level as its *primary* button, and `onNext` loads the next level without consulting
  `unlockedLevel` — a one-click walk past the guard.
- **Backticks inside a double-quoted bash string** ran command substitution and swallowed a
  word from both a commit message and the state file. Prose goes through `Write` and
  `git commit -F`, never a shell string.

---

## Next actions

1. **165** — blades cut in 5 of 24 Act 3 runs but **all five on L7**. L8 and L9's blades
   never fired, so on those two they are decoration. Per-level `cutSpeed`, or move them into
   the line of play.
2. **163** — shield tiers sit easier than the 99/74/44 intent (actual 100/92/75).
3. **150** — separate medium from heavy shield tiers; heavy still has thin data.
4. **135** — per-level `parHits`, now that all three acts are measured.
5. **152** — `getFragmentVerts` is dead code, but may be useful geometry for 151.
6. **151** — destructible targets as an alternate-win level type. Designed and deferred; the
   only genuine multi-session feature outstanding.

---

## The lesson

Last session's was that green tests catch nothing about the thing itself. This session's is
narrower and sharper: **a measurement can be real, honest, and aimed at the wrong quantity.**
Peak speed instead of arrival speed. A behavioural check instead of the invariant. Three
samples instead of eight. Hits-to-clear after a cap made hits-to-clear a constant.

The habit that would have caught all five: before measuring, name the quantity the intent
predicts — and check that the instrument can still move.
