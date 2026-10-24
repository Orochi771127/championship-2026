// Data Arena -- original procedural sound, through the existing audio bus.
//
// Every sound is synthesised (oscillators and generated noise), so the mode
// ships no audio files. It plays through settings.audio's "sfx" category, so
// the player's master/sfx volume and mute apply. One-shots are throttled per
// kind and capped in concurrent voices; the laser is one held voice whose
// pitch follows heat. dispose() stops every node it created.

const MIN_GAP = Object.freeze({ hit: 0.07, kill: 0.05, dash: 0.08, perfect: 0.2, splash: 0.15, crack: 0.12, ignite: 0.25, surge: 0.2,
  warn: 0.5, cheer: 1.5, roar: 1.0, level: 0.3, overheat: 0.5, pickup: 0.05, block: 0.1, hurt: 0.12, burst: 0.2, slam: 0.3, ui: 0.05, capture: 0.4 });
const MAX_VOICES = 14;

export function createDataArenaAudio({ bus }) {
  const output = bus?.output?.("sfx") ?? null;
  if (!output) return Object.freeze({ play() {}, setLaser() {}, suspend() {}, dispose() {}, available: false });
  const { context, destination } = output;
  const mix = context.createGain();
  mix.gain.value = 0.8;
  mix.connect(destination);
  const last = new Map();
  let voices = 0;
  let offset = 0;
  let disposed = false;
  const noise = (() => {
    const buffer = context.createBuffer(1, context.sampleRate * 1.5, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[i] = (seed / 0x3fffffff) - 1; }
    return buffer;
  })();

  function envelope(gain, at, attack, hold, release, peak) {
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, at + attack + hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release);
    return at + attack + hold + release;
  }
  function voice(build) {
    if (disposed || voices >= MAX_VOICES) return;
    voices++;
    const end = build(context.currentTime);
    setTimeout(() => { voices = Math.max(0, voices - 1); }, Math.max(50, (end - context.currentTime) * 1000 + 30));
  }
  function tone(type, frequency, toFrequency, at, attack, hold, release, peak, filter = null) {
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, at);
    if (toFrequency) osc.frequency.exponentialRampToValueAtTime(toFrequency, at + attack + hold + release);
    let node = osc;
    if (filter) { const f = context.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.frequency; f.Q.value = filter.q ?? 1; osc.connect(f); node = f; }
    node.connect(gain); gain.connect(mix);
    const end = envelope(gain, at, attack, hold, release, peak);
    osc.start(at); osc.stop(end + 0.02);
    return end;
  }
  function hiss(at, attack, hold, release, peak, { type = "bandpass", from = 1200, to = null, q = 1, rate = 1 } = {}) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noise; source.playbackRate.value = rate;
    filter.type = type; filter.frequency.setValueAtTime(from, at); filter.Q.value = q;
    if (to) filter.frequency.exponentialRampToValueAtTime(to, at + attack + hold + release);
    source.connect(filter); filter.connect(gain); gain.connect(mix);
    const end = envelope(gain, at, attack, hold, release, peak);
    source.start(at, (offset = (offset + 0.37) % 1) * 0.5); source.stop(end + 0.02);
    return end;
  }

  const SOUNDS = {
    claw: t=>Math.max(hiss(t,.002,.015,.09,.12,{from:2300,to:700}),tone('triangle',150,65,t,.002,.01,.08,.10)),
    flame: t=>Math.max(hiss(t,.005,.07,.19,.13,{type:'lowpass',from:700,to:2600}),tone('sine',130,55,t,.005,.03,.15,.08)),
    ray: t=>Math.max(tone('triangle',1550,620,t,.003,.025,.12,.07),tone('sine',2200,1000,t,.004,.02,.10,.04)),
    frost: t=>Math.max(hiss(t,.008,.06,.2,.07,{type:'highpass',from:4500,to:1600}),tone('sine',1800,2500,t,.002,.01,.13,.045)),
    hit: (t) => tone("square", 900, 500, t, 0.002, 0.01, 0.05, 0.05),
    kill: (t) => Math.max(tone("square", 520, 120, t, 0.003, 0.02, 0.12, 0.08), hiss(t, 0.002, 0.02, 0.1, 0.12, { from: 2400, q: 0.8 })),
    hurt: (t) => Math.max(tone("sawtooth", 220, 90, t, 0.004, 0.04, 0.16, 0.14, { type: "lowpass", frequency: 1400 }), hiss(t, 0.002, 0.03, 0.1, 0.1, { from: 900 })),
    dash: (t) => hiss(t, 0.01, 0.03, 0.14, 0.16, { type: "bandpass", from: 600, to: 3200, q: 1.2 }),
    perfect: (t) => Math.max(tone("sine", 1318, null, t, 0.005, 0.05, 0.25, 0.12), tone("sine", 1975, null, t + 0.06, 0.005, 0.05, 0.3, 0.1)),
    splash: (t) => hiss(t, 0.01, 0.06, 0.4, 0.2, { type: "lowpass", from: 1800, to: 300, q: 0.7 }),
    crack: (t) => { let end = t; for (let i = 0; i < 3; i++) end = Math.max(end, hiss(t + i * 0.045, 0.001, 0.005, 0.04, 0.18, { type: "highpass", from: 3000 })); return end; },
    ignite: (t) => Math.max(hiss(t, 0.02, 0.1, 0.4, 0.14, { type: "lowpass", from: 700, to: 2400 }), tone("sawtooth", 70, 50, t, 0.02, 0.1, 0.3, 0.06, { type: "lowpass", frequency: 300 })),
    surge: (t) => hiss(t, 0.05, 0.15, 0.5, 0.22, { type: "bandpass", from: 300, to: 1600, q: 0.9 }),
    warn: (t) => Math.max(tone("triangle", 660, null, t, 0.005, 0.1, 0.08, 0.12), tone("triangle", 880, null, t + 0.2, 0.005, 0.1, 0.12, 0.12)),
    cheer: (t) => { const end = hiss(t, 0.25, 0.9, 1.2, 0.18, { type: "bandpass", from: 900, q: 0.6, rate: 0.9 }); tone("triangle", 523, 784, t + 0.1, 0.05, 0.3, 0.4, 0.05); return end; },
    roar: (t) => Math.max(tone("sawtooth", 110, 55, t, 0.05, 0.4, 0.6, 0.18, { type: "lowpass", frequency: 600 }), hiss(t, 0.05, 0.4, 0.5, 0.12, { type: "lowpass", from: 500 })),
    level: (t) => [523, 659, 784, 1046].reduce((end, f, i) => Math.max(end, tone("triangle", f, null, t + i * 0.07, 0.005, 0.05, 0.18, 0.1)), t),
    overheat: (t) => hiss(t, 0.01, 0.2, 0.5, 0.16, { type: "highpass", from: 2500 }),
    pickup: (t) => tone("sine", 1400, 2100, t, 0.002, 0.02, 0.06, 0.05),
    block: (t) => tone("square", 300, 260, t, 0.002, 0.02, 0.06, 0.05, { type: "bandpass", frequency: 900, q: 3 }),
    burst: (t) => Math.max(hiss(t, 0.005, 0.05, 0.4, 0.2, { type: "highpass", from: 1800 }), tone("sine", 1800, 900, t, 0.005, 0.05, 0.3, 0.06)),
    slam: (t) => Math.max(tone("sine", 90, 40, t, 0.005, 0.1, 0.4, 0.3), hiss(t, 0.005, 0.05, 0.35, 0.2, { type: "lowpass", from: 600 })),
    ui: (t) => tone("triangle", 880, null, t, 0.002, 0.02, 0.05, 0.06),
    capture: (t) => [659, 880, 1318].reduce((end, f, i) => Math.max(end, tone("sine", f, null, t + i * 0.09, 0.005, 0.08, 0.25, 0.1)), t)
  };

  // The held laser: two detuned oscillators through a low-pass, pitch by heat.
  let laser = null;
  function ensureLaser() {
    if (laser || disposed) return laser;
    const a = context.createOscillator(), b = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
    a.type = "sawtooth"; b.type = "square"; a.frequency.value = 180; b.frequency.value = 181.5;
    filter.type = "lowpass"; filter.frequency.value = 1200; filter.Q.value = 4;
    gain.gain.value = 0.0001;
    a.connect(filter); b.connect(filter); filter.connect(gain); gain.connect(mix);
    a.start(); b.start();
    laser = { a, b, filter, gain };
    return laser;
  }

  return Object.freeze({
    available: true,
    play(kind) {
      const build = SOUNDS[kind];
      if (!build || disposed || context.state === "closed") return;
      const now = context.currentTime;
      if (now - (last.get(kind) ?? -10) < (MIN_GAP[kind] ?? 0.05)) return;
      last.set(kind, now);
      voice(build);
    },
    setLaser(firing, heatShare = 0) {
      if (disposed) return;
      if (!firing && !laser) return;
      const node = ensureLaser();
      const now = context.currentTime;
      node.gain.gain.setTargetAtTime(firing ? 0.07 : 0.0001, now, firing ? 0.02 : 0.05);
      node.a.frequency.setTargetAtTime(160 + heatShare * 220, now, 0.05);
      node.b.frequency.setTargetAtTime(161.5 + heatShare * 226, now, 0.05);
      node.filter.frequency.setTargetAtTime(900 + heatShare * 2600, now, 0.05);
    },
    suspend() { if (laser) laser.gain.gain.setTargetAtTime(0.0001, context.currentTime, 0.02); },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { laser?.a.stop(); laser?.b.stop(); } catch { /* already stopped */ }
      try { mix.disconnect(); } catch { /* already disconnected */ }
      laser = null;
    }
  });
}
