# Session 009 — The campaign becomes a course, and five measurements aimed at the right thing

Date: 2026-09-18 to 2026-09-20 (continues session 008)
Branches merged: `swinging/fix/damage-intensity-range`, `swinging/fix/heavy-shield-tier`,
`swinging/fix/remove-poly-decomp-tag`, `swinging/docs/housekeeping-115-99`,
`swinging/feat/teaching-level-restructure`

---

## What happened

The nine-level campaign became a **thirteen-level course**: each act opens with teaching
levels that introduce one mechanic apiece and closes with a mixed level, under eleven written
level-design rules, five of which the test suite enforces.

Last session's lesson was that a measurement can be real, honest and aimed at the wrong
quantity. This session the instruments were mostly aimed correctly — and the interesting
failures were **designs that measured dead**: features that worked exactly as built and
rewarded nothing.

---

## The restructure (tasks 167–171)

Written first, enforced second, built third:

1. **Eleven rules** in CLAUDE.md, each tagged with what enforces it — a named test, a
   playtest number, or review.
2. **Five rule tests**, committed **deliberately red**: they rejected the old nine levels for
   exactly the reasons the player's feedback gave (L4 introduced the zone *and* shields; L2
   and L5 had two targets; L7 introduced blades and bumpers at once). A rule test that has
   never failed proves nothing, so the failing state was committed on purpose.
3. **Twelve levels**, then thirteen, each carrying a comment naming what it teaches and the
   number that would show it working — written *before* measuring.
4. **`LAYOUT_VERSION`**, because level ids are reused across re-lays. L4 was Low Ceiling and
   is now Drifter. Runs and saved scores both key on the id, and pooling them measures
   neither. It has already earned itself twice (12 levels, then 13).
5. **Gate cases chosen by purpose**, not by id — the previous set was pinned to ids that the
   re-lay silently invalidated.

---

## Designs that measured dead

Three features worked perfectly and rewarded nothing. None would have been caught by a test.

- **A weak point facing downwards.** The idea reads well — "more damage if you hit it from
  below" — and measured inert: every weak hit was slow (raw damage 0–40 against ordinary hits
  reaching 203), because reaching an underside means swinging **up against gravity**, the
  slowest part of any swing, so the raised cap never bound. Facing the same wedge away from
  the hand, struck on the fast return swing, weak hits of raw 110 and 141 took the full 65.
  **Which way a face points decides whether its reward can ever pay.**
- **`damageIntensity`, dormant for months.** Burst scaling and hit-stop read a curve whose
  median sat at 0.08 of its range, with shake firing on 3.9% of hits — while **54.5% of hits
  were already taking the capped maximum**. The cap had moved what "a big hit" means to the
  player and the feedback thresholds had not followed.
- **A shield gate that leaked.** Answering a player question ("sometimes I hit the target
  before breaking any shield") found the rat crossing 14px panels within a single step at
  48–61 px/step. The rat had no continuous collision *by design* — the arena walls are 800px
  thick for exactly that reason — and a shield is the thinnest solid body in the game.

---

## The reward had to survive the cap

The weak-point design turned on one number: **54.5% of hits already clamp at the per-hit
cap**. A damage *multiplier* would therefore have been invisible on more than half of all
hits — and invisible precisely on the hardest ones, which is backwards. So a weak hit raises
**that hit's ceiling** (0.40 → 0.65 of max HP) instead. Visible every time, and the cap stays
the safety rail it was added to be.

The same shape of argument settled the earlier feedback fix: thresholds are tuned against the
distribution players actually produce, not against the range the constant happens to span.

---

## Things that bit

- **A soft-lock built by 10px of clearance.** The first shield cages left a gap around the
  target; once panels broke, each survivor was a thin free-standing post beside a slot, and
  the tail looped round it — the rat sat at rest for 90 seconds through 60 yanks. Flush
  panels fixed it. Screenshots and a bot run found this; the tests were green throughout.
- **Bot runs are not independent.** A seed that wins alone times out after other runs on the
  same page, at fixed timestep. The gate is deterministic only because its case *order* is
  fixed (task 176). One gate case (L9) passed once, then failed twice, and was replaced.
- **Copied counts drift, again.** `dev/gate.mjs` and `dev/smoke.mjs` both pinned "9 levels".
  The gate's was caught by its own assertion; smoke's was caught only by running it.
- **A sequential rename collided with itself.** Renumbering gate case ids 10→11 then 11→12
  hit the same line twice and swapped two cases. The level-id renumber avoided it by going
  highest-first; the gate edit did not.

---

## Where the campaign landed

Thirteen levels, LAYOUT_VERSION 3. The 12-level playtest (68 human runs) met its criteria:
gate shields broke in **100%** of runs against an 80% bar, and every teaching level cleared
100% except the blade level at 71%.

One criterion was not met and is tracked rather than quietly dropped: **the acts no longer
separate on glancing** (28.1 / 27.2 / 28.3, against 18.7 / 12.5 / 11.7 before). Teaching
levels are simple by design, so "one mechanic per level" and "each act has its own signature"
pull against each other. Task 182 exists to settle which wins.

---

## Next actions

1. **Playtest all 13 levels.** Closes 186 (do players find the weak face — the bot manages
   34%), settles First Cut's `cutSpeed` 280 and the finale's floor blade at 200, and watches
   183 (a rat stuck in Narrow Column).
2. **182** — whether acts still need distinct signatures now teaching levels flatten them.
3. **173** — Phase 2's ~9 mixed levels, which can now use wedges.
4. **176** — find what carries over between bot runs on one page.
5. **135** — per-level par, on the new layout.

---

## The lesson

Session 008's was that a measurement can be aimed at the wrong quantity. This session's is
its sibling: **a feature can work exactly as designed and reward nothing.** A downward weak
face, a burst curve running at 8% of its range, a gate you can pass through — all three were
correct code, and all three were inert in play.

The habit that caught them: after building a reward, measure *whether it ever fires*, not
whether it computes.
