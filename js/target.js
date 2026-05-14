export const MATERIALS = {
  glass: {
    strength: 220,
    crackThreshold: 85,
    fragmentCount: 10,
    fragmentSpread: 1.6,
    restitution: 0.1,
    density: 0.002,
    color: '#a8d8ea',
    crackedColor: '#6ba3be',
    outlineColor: '#3a7ca5',
    glowColor: 'rgba(168,216,234,0.35)',
    label: 'Glass',
  },
  wood: {
    strength: 620,
    crackThreshold: 260,
    fragmentCount: 6,
    fragmentSpread: 0.85,
    restitution: 0.2,
    density: 0.004,
    color: '#c4a265',
    crackedColor: '#8b6914',
    outlineColor: '#5a3e1b',
    glowColor: 'rgba(196,162,101,0.25)',
    label: 'Wood',
  },
  steel: {
    strength: 1400,
    crackThreshold: 800,
    fragmentCount: 0,
    fragmentSpread: 0.3,
    restitution: 0.55,
    density: 0.012,
    color: '#8a9ba8',
    crackedColor: '#5a6b78',
    outlineColor: '#2c3e50',
    glowColor: 'rgba(138,155,168,0.2)',
    label: 'Steel',
  },
};

// Pre-computed fragment vertex sets (relative coords, normalized to [-0.5, 0.5])
// Each entry is an array of polygons (vertex arrays) that tile a unit rectangle.
const RECT_FRAGMENTS_10 = [
  [[-0.5,-0.5],[-0.1,-0.5],[-0.15,0.0],[-0.5,0.05]],
  [[-0.1,-0.5],[0.25,-0.5],[0.2,-0.1],[-0.05,-0.15]],
  [[0.25,-0.5],[0.5,-0.5],[0.5,-0.15],[0.28,-0.05]],
  [[-0.5,0.05],[-0.15,0.0],[-0.1,0.3],[-0.45,0.35]],
  [[-0.15,0.0],[0.2,-0.1],[0.15,0.25],[-0.1,0.3]],
  [[0.2,-0.1],[0.28,-0.05],[0.5,0.1],[0.5,0.4],[0.15,0.25]],
  [[-0.5,0.35],[-0.1,0.3],[-0.12,0.5],[-0.5,0.5]],
  [[-0.1,0.3],[0.15,0.25],[0.1,0.5],[-0.12,0.5]],
  [[0.15,0.25],[0.5,0.4],[0.5,0.5],[0.1,0.5]],
  [[0.28,-0.05],[0.5,-0.15],[0.5,0.1]],
];

const RECT_FRAGMENTS_6 = [
  [[-0.5,-0.5],[0.05,-0.5],[0.0,-0.17],[-0.5,-0.2]],
  [[0.05,-0.5],[0.5,-0.5],[0.5,-0.15],[0.0,-0.17]],
  [[-0.5,-0.2],[0.0,-0.17],[0.05,0.18],[-0.5,0.15]],
  [[0.0,-0.17],[0.5,-0.15],[0.5,0.2],[0.05,0.18]],
  [[-0.5,0.15],[0.05,0.18],[0.0,0.5],[-0.5,0.5]],
  [[0.05,0.18],[0.5,0.2],[0.5,0.5],[0.0,0.5]],
];

export function getFragmentVerts(count) {
  return count >= 10 ? RECT_FRAGMENTS_10 : RECT_FRAGMENTS_6;
}

export function evaluateImpact(speed, mass, material, impactMultiplier) {
  const impulse = speed * mass * impactMultiplier;
  if (impulse >= material.strength) return 'SHATTER';
  if (impulse >= material.crackThreshold) return 'CRACK';
  return 'SURVIVE';
}

export function generateCrackPattern(count = 5) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() * Math.PI * 2);
    const len = 0.2 + Math.random() * 0.35;
    lines.push({ angle, len });
  }
  return lines;
}
