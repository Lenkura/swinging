let actx = null;
let masterGain = null;
let muted = false;
try { muted = localStorage.getItem('yoyo_muted') === '1'; } catch { /* storage unavailable */ }

function ctx() {
  if (!actx) actx = new AudioContext();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

// Shared output bus: every sound routes through one gain (mute) into a
// compressor, so stacked layers (shatter, high combos) squash instead of
// hard-clipping at the destination.
function master() {
  const ac = ctx();
  if (!masterGain) {
    masterGain = ac.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    const comp = ac.createDynamicsCompressor();
    masterGain.connect(comp);
    comp.connect(ac.destination);
  }
  return masterGain;
}

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('yoyo_muted', m ? '1' : '0'); } catch { /* storage unavailable */ }
  if (masterGain) masterGain.gain.value = m ? 0 : 1;
}

export function isMuted() { return muted; }

function noise(duration) {
  const ac = ctx();
  const size = Math.ceil(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, size, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

// rat squeak + wet thud on impact — all layers scale with combo count
export function playHit(materialKey, intensity = 0.5, combo = 1) {
  const ac = ctx();
  const t = ac.currentTime;
  const comboScale = Math.min(1 + (combo - 1) * 0.25, 2.8);

  // ── Squeak ────────────────────────────────────────────────────────────────
  // Sawtooth: richer harmonic content than triangle = more rodent character.
  // Pitch climbs with combo then drops sharply — sounds like a harder hit.
  const squeakPitch = 1300 + intensity * 600 + (combo - 1) * 220;
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(squeakPitch * comboScale, t);
  osc.frequency.exponentialRampToValueAtTime(squeakPitch * 0.32, t + 0.11);

  // Lowpass shapes the sawtooth — keeps body, removes the very brightest aliasing
  const sqLpf = ac.createBiquadFilter();
  sqLpf.type = 'lowpass';
  sqLpf.frequency.setValueAtTime(squeakPitch * 2.2, t);
  sqLpf.frequency.exponentialRampToValueAtTime(squeakPitch * 0.6, t + 0.1);

  const sqGain = ac.createGain();
  sqGain.gain.setValueAtTime(0.24 * comboScale, t);
  sqGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

  osc.connect(sqLpf); sqLpf.connect(sqGain); sqGain.connect(master());
  osc.start(t); osc.stop(t + 0.15);

  // ── Deep body thud ────────────────────────────────────────────────────────
  // Lowpass noise — frequency and volume both grow with combo.
  // Material determines the resonant character of the body hit.
  const thudCutoff = { glass: 160, wood: 95, steel: 55 }[materialKey] ?? 115;
  const thud = noise(0.18);
  const thudLpf = ac.createBiquadFilter();
  thudLpf.type = 'lowpass';
  thudLpf.frequency.setValueAtTime(thudCutoff * (1.4 + combo * 0.3), t);
  thudLpf.frequency.exponentialRampToValueAtTime(thudCutoff * 0.22, t + 0.15);
  const thudGain = ac.createGain();
  thudGain.gain.setValueAtTime(0.65 * intensity * comboScale, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  thud.connect(thudLpf); thudLpf.connect(thudGain); thudGain.connect(master());
  thud.start(t); thud.stop(t + 0.19);

  // ── Flesh/wet mid layer ───────────────────────────────────────────────────
  // Bandpass noise in the 200–600 Hz range — this is what makes it sound wet
  // rather than a dry crack. Rises in prominence with combo.
  const flesh = noise(0.12);
  const fleshBpf = ac.createBiquadFilter();
  fleshBpf.type = 'bandpass';
  fleshBpf.frequency.setValueAtTime(280 + combo * 75, t);
  fleshBpf.frequency.exponentialRampToValueAtTime(160, t + 0.1);
  fleshBpf.Q.value = 1.4;
  const fleshGain = ac.createGain();
  fleshGain.gain.setValueAtTime(0.35 * intensity * comboScale, t);
  fleshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  flesh.connect(fleshBpf); fleshBpf.connect(fleshGain); fleshGain.connect(master());
  flesh.start(t); flesh.stop(t + 0.13);

  // ── Crunch layer (combo 3+) ───────────────────────────────────────────────
  // Short mid-high burst with peaking EQ — adds the gristle and bite of a
  // harder, angrier impact. Intensity grows linearly past combo 3.
  if (combo >= 3) {
    const crunchFactor = Math.min((combo - 2) * 0.4, 1.2);
    const crunch = noise(0.08);
    const crunchPk = ac.createBiquadFilter();
    crunchPk.type = 'peaking';
    crunchPk.frequency.value = 700 + combo * 90;
    crunchPk.Q.value = 2.5;
    crunchPk.gain.value = 14;
    const crunchGain = ac.createGain();
    crunchGain.gain.setValueAtTime(0.32 * crunchFactor, t);
    crunchGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    crunch.connect(crunchPk); crunchPk.connect(crunchGain); crunchGain.connect(master());
    crunch.start(t); crunch.stop(t + 0.09);
  }
}

// wet splat — layered for a meaty, splattering impact
export function playShatter() {
  const ac = ctx();
  const t = ac.currentTime;

  // Layer 1: deep impact thud
  const thud = noise(0.3);
  const thudLpf = ac.createBiquadFilter();
  thudLpf.type = 'lowpass';
  thudLpf.frequency.setValueAtTime(220, t);
  thudLpf.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  const thudGain = ac.createGain();
  thudGain.gain.setValueAtTime(1.3, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  thud.connect(thudLpf); thudLpf.connect(thudGain); thudGain.connect(master());
  thud.start(); thud.stop(t + 0.35);

  // Layer 2: wet flesh squelch — mid noise sweep
  const squelch = noise(0.45);
  const sqf = ac.createBiquadFilter();
  sqf.type = 'bandpass';
  sqf.frequency.setValueAtTime(700, t);
  sqf.frequency.exponentialRampToValueAtTime(140, t + 0.4);
  sqf.Q.value = 1.2;
  const sqGain = ac.createGain();
  sqGain.gain.setValueAtTime(0.9, t);
  sqGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  squelch.connect(sqf); sqf.connect(sqGain); sqGain.connect(master());
  squelch.start(); squelch.stop(t + 0.5);

  // Layer 3: high-frequency spray burst — the "wet" splatter
  const spray = noise(0.18);
  const sprayHpf = ac.createBiquadFilter();
  sprayHpf.type = 'highpass';
  sprayHpf.frequency.value = 3500;
  const sprayGain = ac.createGain();
  sprayGain.gain.setValueAtTime(0.65, t);
  sprayGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  spray.connect(sprayHpf); sprayHpf.connect(sprayGain); sprayGain.connect(master());
  spray.start(); spray.stop(t + 0.2);

  // Layer 4: resonant flesh thwap — sine descending from 160 → 28 Hz
  const thwap = ac.createOscillator();
  thwap.type = 'sine';
  thwap.frequency.setValueAtTime(160, t);
  thwap.frequency.exponentialRampToValueAtTime(28, t + 0.18);
  const thwapGain = ac.createGain();
  thwapGain.gain.setValueAtTime(0.55, t);
  thwapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  thwap.connect(thwapGain); thwapGain.connect(master());
  thwap.start(); thwap.stop(t + 0.2);

  // Layer 5: brief dying squeal (subdued — splat is the star)
  const squeal = ac.createOscillator();
  squeal.type = 'sawtooth';
  squeal.frequency.setValueAtTime(900, t);
  squeal.frequency.exponentialRampToValueAtTime(180, t + 0.22);
  const squealGain = ac.createGain();
  squealGain.gain.setValueAtTime(0.14, t);
  squealGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  squeal.connect(squealGain); squealGain.connect(master());
  squeal.start(); squeal.stop(t + 0.24);
}

// dull metallic clang — used for shield hits that don't break (TOO SLOW!)
export function playShieldBlock() {
  const ac = ctx();
  const t = ac.currentTime;

  // Short bandpass noise: the hollow thud of glass that didn't break
  const thud = noise(0.14);
  const bpf = ac.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.setValueAtTime(420, t);
  bpf.frequency.exponentialRampToValueAtTime(180, t + 0.12);
  bpf.Q.value = 1.8;
  const thudGain = ac.createGain();
  thudGain.gain.setValueAtTime(0.45, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  thud.connect(bpf); bpf.connect(thudGain); thudGain.connect(master());
  thud.start(t); thud.stop(t + 0.15);

  // Descending tone: the "not enough" deflection feel
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(95, t + 0.13);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.18, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(oscGain); oscGain.connect(master());
  osc.start(t); osc.stop(t + 0.14);
}

// bright glass shatter — used when a shield breaks
export function playShieldBreak() {
  const ac = ctx();
  const t = ac.currentTime;

  // High-frequency crack burst — the glass fracturing
  const crack = noise(0.12);
  const hpf = ac.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 2800;
  const crackGain = ac.createGain();
  crackGain.gain.setValueAtTime(0.85, t);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  crack.connect(hpf); hpf.connect(crackGain); crackGain.connect(master());
  crack.start(t); crack.stop(t + 0.13);

  // Ringing glass tone — sustained ring after the crack
  const ring = ac.createOscillator();
  ring.type = 'sine';
  ring.frequency.setValueAtTime(1200, t);
  ring.frequency.exponentialRampToValueAtTime(680, t + 0.28);
  const ringGain = ac.createGain();
  ringGain.gain.setValueAtTime(0.22, t);
  ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  ring.connect(ringGain); ringGain.connect(master());
  ring.start(t); ring.stop(t + 0.30);

  // Low impact thud underneath
  const thud = noise(0.08);
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(180, t);
  lpf.frequency.exponentialRampToValueAtTime(60, t + 0.08);
  const thudGain = ac.createGain();
  thudGain.gain.setValueAtTime(0.55, t);
  thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  thud.connect(lpf); lpf.connect(thudGain); thudGain.connect(master());
  thud.start(t); thud.stop(t + 0.09);
}

// escalating squeaks per combo tier — square wave for a ratty bite
export function playComboTone(comboCount) {
  if (comboCount < 2) return;
  const ac = ctx();
  const freq = Math.min(380 * Math.pow(1.38, comboCount - 2), 2200);

  const osc = ac.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, ac.currentTime + 0.09);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.1, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.11);

  osc.connect(gain);
  gain.connect(master());
  osc.start();
  osc.stop(ac.currentTime + 0.12);
}

// Continuous swing whoosh — one looping noise source whose loudness and
// brightness follow the normalized (0-1) swing speed each frame. Tracks the
// meter value rather than absolute px/step, so it inherits the meter's
// calibration instead of baking in its own speed assumptions.
let whoosh = null;

export function startWhoosh() {
  if (whoosh) stopWhoosh();
  const src = noise(1);
  src.loop = true;
  const ac = ctx();
  const lpf = ac.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 200;
  const gain = ac.createGain();
  gain.gain.value = 0;
  src.connect(lpf); lpf.connect(gain); gain.connect(master());
  src.start();
  whoosh = { src, lpf, gain };
}

export function updateWhoosh(normalizedSpeed) {
  if (!whoosh) return;
  const t = ctx().currentTime;
  // Dead zone below ~12% keeps an idle hanging rat silent
  const s = Math.max(0, normalizedSpeed - 0.12) / 0.88;
  whoosh.gain.gain.setTargetAtTime(Math.pow(s, 1.6) * 0.5, t, 0.06);
  whoosh.lpf.frequency.setTargetAtTime(200 + s * 2400, t, 0.06);
}

export function stopWhoosh() {
  if (!whoosh) return;
  const t = ctx().currentTime;
  whoosh.gain.gain.setTargetAtTime(0, t, 0.05);
  whoosh.src.stop(t + 0.3);
  whoosh = null;
}
