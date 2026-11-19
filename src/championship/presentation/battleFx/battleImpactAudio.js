// Original procedural battle impact foley synthesizer (Web Audio API).
//
// Zero ROM samples, zero external audio assets, zero extra AudioContexts: it
// plugs directly into the shared product SFX bus (`settings.audio.output('sfx')`),
// so master volume, SFX volume and mute work automatically. Throttled per cue
// category so multi-hit bursts sound crisp without clipping.

const MIN_GAP_MS = Object.freeze({
  light: 55,
  medium: 60,
  heavy: 75,
  crit: 90,
  ko: 180,
  ultimate: 240,
  support: 120,
  skillCard: 100,
  dropPick: 42
});

// Pentatonic ratios for satisfying ascending arcade coin/gem pickups.
const DROP_RATIOS = Object.freeze([1, 1.122, 1.26, 1.498, 1.682, 2.0]);

function makeNoiseBuffer(context, seconds = 0.25) {
  const rate = context.sampleRate || 44100;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = context.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  // Deterministic white-ish noise for punch transients (no gameplay RNG).
  let s = 0x13579bdf;
  for (let i = 0; i < length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    data[i] = ((s >>> 8) / 0x00800000) - 1;
  }
  return buffer;
}

export function createBattleImpactAudio({ getOutput, now = () => Date.now() } = {}) {
  let noiseBuffer = null;
  let noiseContext = null;
  let disposed = false;
  let dropStreak = 0;
  let lastDropAt = 0;
  const lastAt = new Map();
  const stats = { played: 0, throttled: 0, cues: {} };

  function resolveOutput() {
    if (disposed || typeof getOutput !== "function") return null;
    try {
      const out = getOutput();
      if (!out?.context || !out?.destination) return null;
      if (out.context.state === "suspended") out.context.resume?.().catch?.(() => {});
      if (out.context.state === "closed") return null;
      return out;
    } catch {
      return null;
    }
  }

  function admit(kind) {
    const t = now();
    const gap = MIN_GAP_MS[kind] ?? 60;
    if (t - (lastAt.get(kind) ?? -1e9) < gap) {
      stats.throttled += 1;
      return false;
    }
    lastAt.set(kind, t);
    return true;
  }

  function record(kind) {
    stats.played += 1;
    stats.cues[kind] = (stats.cues[kind] ?? 0) + 1;
  }

  function getNoise(ctx) {
    if (noiseContext !== ctx || !noiseBuffer) {
      noiseContext = ctx;
      noiseBuffer = makeNoiseBuffer(ctx, 0.28);
    }
    return noiseBuffer;
  }

  function tone(ctx, dest, { type = "sine", startHz, endHz = startHz, start = 0, duration = 0.08, gain = 0.2 }) {
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startHz), t0);
    if (endHz !== startHz) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), t0 + duration);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.008, duration * 0.2));
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(amp);
    amp.connect(dest);
    osc.start(t0);
    osc.stop(t0 + duration + 0.015);
  }

  function noiseBurst(ctx, dest, { start = 0, duration = 0.07, gain = 0.16, filterHz = 1800, q = 1.2, filterType = "bandpass" }) {
    const t0 = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterHz, t0);
    filter.Q.setValueAtTime(q, t0);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(dest);
    src.start(t0);
    src.stop(t0 + duration + 0.01);
  }

  function playHit({ tier = "light", critical = false, combo = 1 } = {}) {
    const kind = critical ? "crit" : (tier === "heavy" ? "heavy" : tier === "medium" ? "medium" : "light");
    if (!admit(kind)) return false;
    const out = resolveOutput();
    if (!out) return false;
    const { context: ctx, destination: dest } = out;
    const lift = 1 + Math.min(8, Math.max(0, combo - 1)) * 0.03;

    if (kind === "crit") {
      // Heavy sub slam + crunchy snap + crystalline critical chime
      tone(ctx, dest, { type: "triangle", startHz: 185, endHz: 36, duration: 0.16, gain: 0.34 });
      noiseBurst(ctx, dest, { duration: 0.11, gain: 0.24, filterHz: 2600, q: 0.9 });
      tone(ctx, dest, { type: "sine", startHz: 880 * lift, endHz: 1175 * lift, start: 0.01, duration: 0.14, gain: 0.16 });
      tone(ctx, dest, { type: "triangle", startHz: 1320 * lift, endHz: 1760 * lift, start: 0.025, duration: 0.16, gain: 0.12 });
    } else if (kind === "heavy") {
      tone(ctx, dest, { type: "triangle", startHz: 165, endHz: 38, duration: 0.15, gain: 0.32 });
      tone(ctx, dest, { type: "sawtooth", startHz: 95, endHz: 42, duration: 0.11, gain: 0.12 });
      noiseBurst(ctx, dest, { duration: 0.11, gain: 0.22, filterHz: 1500, q: 1.0 });
    } else if (kind === "medium") {
      tone(ctx, dest, { type: "triangle", startHz: 145 * lift, endHz: 48, duration: 0.1, gain: 0.24 });
      noiseBurst(ctx, dest, { duration: 0.075, gain: 0.16, filterHz: 2100, q: 1.2 });
    } else {
      tone(ctx, dest, { type: "triangle", startHz: 190 * lift, endHz: 78, duration: 0.065, gain: 0.15 });
      noiseBurst(ctx, dest, { duration: 0.045, gain: 0.1, filterHz: 2800, q: 1.4 });
    }
    record(kind);
    return true;
  }

  function playKo() {
    if (!admit("ko")) return false;
    const out = resolveOutput();
    if (!out) return false;
    const { context: ctx, destination: dest } = out;
    tone(ctx, dest, { type: "triangle", startHz: 140, endHz: 28, duration: 0.28, gain: 0.36 });
    tone(ctx, dest, { type: "sawtooth", startHz: 220, endHz: 52, start: 0.02, duration: 0.24, gain: 0.12 });
    noiseBurst(ctx, dest, { start: 0.01, duration: 0.22, gain: 0.22, filterHz: 900, q: 0.7, filterType: "lowpass" });
    record("ko");
    return true;
  }

  function playUltimate() {
    if (!admit("ultimate")) return false;
    const out = resolveOutput();
    if (!out) return false;
    const { context: ctx, destination: dest } = out;
    tone(ctx, dest, { type: "sawtooth", startHz: 180, endHz: 540, duration: 0.19, gain: 0.12 });
    tone(ctx, dest, { type: "sine", startHz: 360, endHz: 880, start: 0.04, duration: 0.18, gain: 0.14 });
    noiseBurst(ctx, dest, { duration: 0.16, gain: 0.1, filterHz: 2200, q: 1.6 });
    record("ultimate");
    return true;
  }

  function playSupport(kind = "support") {
    const key = kind === "skillCard" ? "skillCard" : "support";
    if (!admit(key)) return false;
    const out = resolveOutput();
    if (!out) return false;
    const { context: ctx, destination: dest } = out;
    const base = key === "skillCard" ? 587 : 523;
    tone(ctx, dest, { type: "sine", startHz: base, endHz: base * 1.25, duration: 0.12, gain: 0.13 });
    tone(ctx, dest, { type: "triangle", startHz: base * 1.5, endHz: base * 2, start: 0.045, duration: 0.14, gain: 0.1 });
    record(key);
    return true;
  }

  function playDropPick() {
    if (!admit("dropPick")) return false;
    const out = resolveOutput();
    if (!out) return false;
    const { context: ctx, destination: dest } = out;
    const t = now();
    dropStreak = t - lastDropAt < 950 ? Math.min(DROP_RATIOS.length - 1, dropStreak + 1) : 0;
    lastDropAt = t;
    const hz = 660 * DROP_RATIOS[dropStreak];
    tone(ctx, dest, { type: "sine", startHz: hz, endHz: hz * 1.33, duration: 0.085, gain: 0.14 });
    record("dropPick");
    return true;
  }

  return Object.freeze({
    playHit,
    playKo,
    playUltimate,
    playSupport,
    playDropPick,
    getDiagnostics: () => Object.freeze({ ...stats, cues: Object.freeze({ ...stats.cues }) }),
    dispose() {
      disposed = true;
      noiseBuffer = null;
      noiseContext = null;
      lastAt.clear();
    }
  });
}
