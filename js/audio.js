let actx = null;

function ctx() {
  if (!actx) actx = new AudioContext();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

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

// material-specific percussive hit
export function playHit(materialKey, intensity = 0.5) {
  const ac = ctx();
  const dur = 0.12;

  const src = noise(dur);
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = { glass: 3200, wood: 700, steel: 350 }[materialKey] ?? 1000;
  filter.Q.value = 3;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.25 + intensity * 0.45, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);

  src.connect(filter);
  filter.connect(gain);

  // steel: add a metallic ring tone
  if (materialKey === 'steel') {
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(220, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.25);
    const oscGain = ac.createGain();
    oscGain.gain.setValueAtTime(0.12 * intensity, ac.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
    osc.connect(oscGain);
    oscGain.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + 0.25);
  }

  gain.connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + dur);
}

// yoyo shatters
export function playShatter() {
  const ac = ctx();
  const dur = 0.6;

  const src = noise(dur);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(200, ac.currentTime + dur);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.9, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + dur);
}

// ascending tone per combo tier
export function playComboTone(comboCount) {
  if (comboCount < 2) return;
  const ac = ctx();
  const freq = 260 * Math.pow(1.3, comboCount - 2);
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = Math.min(freq, 1400);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.1);
}
