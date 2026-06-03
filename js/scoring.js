export function calcPushScore(hits) {
  return Math.max(200, 3000 - (hits - 1) * 500);
}

export function comboMultiplier(comboCount) {
  return Math.min(1 + comboCount * 0.5, 3.0);
}
