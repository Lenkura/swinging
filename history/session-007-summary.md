# Session 007 — Six merges, and four assumptions that measurement refuted

Date: 2026-09-13 to 2026-09-14 (continues session 006)
Branches merged: `swinging/fix/variant-difficulty-rebalance`, `swinging/feat/tail-grab-pickup`,
`swinging/fix/damage-cap-material-spread`, `swinging/feat/shield-tiers`,
`swinging/refactor/material-field-cleanup`, `swinging/docs/expand-level-design-scope`

---

## What happened

Session 006 ended with a diagnosis: heavy was strictly better than standard and
`DAMAGE_SCALE` could not move until that resolved. This session fixed it, fixed three
further things the fix exposed, and finished by finding the structural cause underneath
all of them.

The through-line: **every problem here was a measurement problem wearing implementation
clothes.** Four separate beliefs were refuted by data, and the suite was green for all
four. Two more were caught only by looking at screenshots.

---

## Task 126 — the variant imbalance

Reading the code reframed it. `main.js` ends the level when *your own rat's* HP reaches 0
and `calcPushScore(hitCount)` is the only scored term, so targets are anvils and hits are
the sole metric. The game therefore has **no cost axis at all** — spending HP is winning,
so `impactMultiplier` is one-sided and any variant carrying more of it is permanently
better (L0250).

Two findings redirected the fix:

1. The hard/easy axis was already physically real — radius 22 vs 18 gave heavy 15%
   glancing hits against standard's 31%.
2. **Standard was unscorable.** `calcPushScore` has a live gradient only from 1–6 hits and
   standard's median was 10.5 — four hits past the end. A player improving from 17 hits to
   11 saw no score change. That, not the variant gap, was task 129's real content.

Shipped: par-relative scoring (`calcPushScore(hits, parHits = 1)`, the default reproducing
the original curve exactly so all six existing assertions passed unmodified), heavy
`impactMultiplier` 2.2 → 1.4, `DAMAGE_SCALE` 200 → 80.

**Refuted later the same day.** The precision axis did not survive measurement: 88 runs
gave 19.4% glancing for standard against 20.3% for heavy — identical, and inverted against
the 31/15 the whole design rested on. The original figure was an artifact of 10-hit runs,
where glancing had room to register. The rats became a *feel* choice and the Hard/Easy
labels came off.

---

## Tail-grab pick-up

The reported "glitchy" entry was diagnosed rather than guessed: the rat spawned motionless
and nothing moved until the first `pointermove`, at which point the pivot **teleported**
from the level position to wherever the cursor was — usually still over the Launch button —
and whipped the rat.

Grabbing the tail removes the jolt by construction, because the pointer *is* the grab
point. The lift is ordinary physics: the rope is built unanchored, and the grab creates the
one constraint `attachRope` had always made eagerly.

Also fixed a pre-existing bug it depended on: the physics floor sat at y=620 while the
drawn floor was at y=580, so every body rested 40px inside the dirt and `paintSplat` hid it
by drawing decals at the visual line regardless.

---

## Task 144 — the damage regression I introduced

`DAMAGE_SCALE` 200 → 80 was validated **on Level 1 alone**, the shortest level in the game,
and was badly wrong everywhere else: Acts 2–3 cleared in a median of 2 hits, 34% of runs
were one-hit clears including the L9 finale, and one recorded hit dealt 279.78 damage to a
100 HP rat.

The fix came from the data rather than from taste (L0390). The medians were already
correct — p50 41 against 100 HP — and only the **tail** was broken: p75 113, p90 197, max
426. So the answer was a bound, not a rescale. `applyDamageCap` clamps HP loss to 40% of
max, and **feedback reads the raw uncapped value**, so a monster hit still looks and sounds
enormous while removing 40 HP. Material spread narrowed 0.6/1.0/1.6 → 0.85/1.0/1.15,
because a wide spread made steel strictly better and inverted the difficulty curve.

Validated on 88 human runs: **zero one-hit clears**, every level inside a 3–5 hit band, and
the curve rising rather than inverted.

---

## Shield tiers

Only 8 of 106 shield contacts broke, and the `breakSpeed: 180` tier was never broken once
in 36 contacts — unreachable, not hard. Cause: thresholds set from *peak* swing speed
(~720) when what matters is the speed you **arrive** at a shield with (p50 ≈ 50), and the
rope then took another 25–37% out of it.

Levels now name `shieldTier` light/medium/heavy, and the tier supplies both the speed
(45/70/95) and the colour. Validated: no tier at 0%.

**The finding worth keeping:** medium and heavy came out nearly equal (61% vs 57%) because
players *arrive* at heavy shields 36% faster, almost exactly cancelling the 36% threshold
gap. A tier's difficulty depends on placement as much as on its number.

---

## Task 147 — materials

An audit found no reader for `strength`, `crackThreshold`, `hardnessFactor`, `density`,
`fragmentCount` or `fragmentSpread`. `hardnessFactor` was worse than unused: it still held
the **pre-rebalance `yoyoDamage` values**, a stale copy of a live dial sitting next to the
real one.

`evaluateImpact` went too — not merely because its result was destructured and discarded,
but because its formula folds in `mass`, which is inert everywhere else, giving heavy 3.58×
standard's impulse. Keeping it "for later" would have left a loaded gun pointing at the
imbalance we had just removed.

Destructible targets were redesigned rather than abandoned: the user reframed them as an
**alternate-win level type** (clear the board, rat HP as budget), which leaves the nine
tuned levels alone and produces the first genuinely two-sided material trade this game has
had. Recorded as task 151, deferred.

---

## Task 128 — the structural cause

The last finding explains all the others. Measured across `levels.js`:

| | span |
|---|---|
| pivot x | **0.20–0.24** in all nine |
| everything else | x 0.48–0.86 |
| rope length | 120–150 |

**The nine levels are one level with different furniture.** That explains the flat curve,
the shield-avoiding bot clearing 24/24, placement dominating shield tier, and nothing
lasting beyond 3–4 hits — four symptoms, one cause.

Acts will now pose spatial questions rather than introduce mechanics: open, constrained
(movement zones), hazardous (blades, and the game's first fail state). Act 2 is the pilot.

---

## Problems hit

- **I scaled the feedback thresholds the wrong way.** Lowering `DAMAGE_SCALE` raises damage,
  so derived thresholds must scale in the *same* direction; I inverted it. The gate passed
  91/91 anyway because its bounds are deliberately wide. Caught by reading the gate's
  reported peak damage against the range I had assumed.
- **A screenshot caught the tail coiling into a pile** — pairwise constraints hold
  neighbours 13px apart but nothing keeps a chain straight. Fixed with `freezeForGrab`.
  Tests were green throughout.
- **A screenshot caught every shield rendering the same pale blue**, making the tiers
  invisible and the feature pointless. Tests were green throughout.
- **The gate went vacuous** after the READY state landed — HP drop read 1.000 → 1.000
  because the sweep never grabbed the rat, so it tested nothing while still passing.
- **An export mixed builds.** Raising the run cap to 100 preserved 12 pre-cap runs, and all
  three apparent one-hit clears were those. Post-cap runs are identifiable by the
  `rawDamage` field.

---

## Next actions

1. **153** — write the act-intent note into CLAUDE.md, *before* the mechanics
2. **154** — movement zone mechanic, inert until a level uses it
3. **155** — re-lay Act 2 as the pilot
4. **156** — measure the pilot. **A real gate**: if constrained space does not produce
   deliberate play, 157–160 should not proceed as designed
5. Then 157 (blades, fail state), 158–160 (Act 3, Act 1, full re-measure)

Also live: 150 (separate the shield tiers — heavy has only 7 runs), 135 (per-level
`parHits`), 152 (`getFragmentVerts` may be useful geometry for 151), 151 (alternate-win
mode, designed and deferred).

---

## The lesson, if there is one

Green tests caught none of the four refuted assumptions, and two more needed a person to
look at a picture. What caught them was measuring the thing itself on human play — and in
three cases, noticing that a number had been validated against a sample that did not
represent the case it was being applied to. `DAMAGE_SCALE` on one level, shield thresholds
on peak instead of arrival speed, glancing rates on runs three times longer than the ones
they were used to justify.
