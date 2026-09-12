// parHits is the variant's expected hit count (RAT_VARIANTS[...].parHits): meeting par
// scores 3000, beating it scores above. Defaults to 1 so the unparameterised call is
// identical to the original curve.
export function calcPushScore(hits, parHits = 1) {
  return Math.max(200, 3000 - (hits - parHits) * 500);
}

export function comboMultiplier(comboCount) {
  return Math.min(1 + comboCount * 0.5, 3.0);
}
