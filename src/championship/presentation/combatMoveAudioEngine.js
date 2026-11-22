// COMBAT_MOVE_AUDIO_ENGINE_20261122:
// Studio-grade, 100% original procedural Web Audio combat & 666-move SFX synthesizer
// shared by BOTH Turn-Based Battle (`battleImpactAudio.js`) and Data Arena (`dataArenaAudio.js`).
//
// Broadcast Mastering Architecture:
//   Voices -> StereoPanner -> Channel Mix -> High-Shelf Ear-Fatigue EQ (3800Hz -2.8dB)
//   -> Warm Soft-Clip Saturator (WaveShaper) -> Glue Compressor (-18dB, 4:1)
//   -> Brickwall Limiter (-2.5dB, 20:1) -> Shared Product SFX Bus Destination.
//
// Zero ROM samples, zero external audio assets, zero extra AudioContexts, deterministic
// pre-baked White/Pink/Brown/Crackle noise banks, true 2-operator FM synthesis,
// Sqrt concurrent-voice auto-ducking, and canonical 10-element timbres (金木水火土日月雷冰風).

import { normalizeCanonicalElement } from "../modes/dataArena/dataArenaCombos.js";

const MAX_VOICES = 18;

const MIN_GAP = Object.freeze({
  hit: 0.05, light: 0.05, medium: 0.055, heavy: 0.065, crit: 0.085,
  kill: 0.08, ko: 0.16, hurt: 0.08, dash: 0.075, perfect: 0.16,
  splash: 0.12, crack: 0.1, ignite: 0.18, surge: 0.16, warn: 0.4,
  cheer: 1.2, roar: 0.7, level: 0.25, overheat: 0.4, pickup: 0.04,
  dropPick: 0.04, block: 0.08, burst: 0.16, slam: 0.2, ui: 0.045,
  capture: 0.3, shatter: 0.12, combo: 0.12, igniteBoom: 0.14,
  freezeSnap: 0.12, shockArc: 0.12, sleep: 0.2, poison: 0.18,
  paralyze: 0.14, refused: 0.14, ultimate: 0.2, support: 0.12,
  skillCard: 0.1, heal: 0.14, windup: 0.12
});

const DROP_RATIOS = Object.freeze([1, 1.122, 1.26, 1.498, 1.682, 2.0]);

function hashMoveId(moveId) {
  const s = String(moveId ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Deterministic per-move micro-pitch variance (0.955 .. 1.045) so no two moves sound robotic. */
export function movePitchRate(moveId) {
  if (moveId == null || moveId === "") return 1;
  return 0.955 + (hashMoveId(moveId) % 9) * 0.01125;
}

/** Map arena/taxonomy/move element into canonical 10-element key (or NEUTRAL). */
export function canonicalAudioElement(rawElement, moveId = null) {
  return normalizeCanonicalElement(rawElement, moveId) ?? "NEUTRAL";
}

function makeSoftClipCurve(drive = 1.55, samples = 512) {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

function bakeNoiseBanks(context) {
  const sr = context.sampleRate || 44100;
  const len = Math.max(1024, Math.floor(sr * 1.4));
  const whiteBuf = context.createBuffer(1, len, sr);
  const pinkBuf = context.createBuffer(1, len, sr);
  const brownBuf = context.createBuffer(1, len, sr);
  const crackleBuf = context.createBuffer(1, len, sr);

  const w = whiteBuf.getChannelData(0);
  const p = pinkBuf.getChannelData(0);
  const b = brownBuf.getChannelData(0);
  const c = crackleBuf.getChannelData(0);

  let seed = 0x13579bdf;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  let lastBrown = 0;
  for (let i = 0; i < len; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const rnd = ((seed >>> 8) / 0x00800000) - 1;
    w[i] = rnd;

    // Paul Kellet 7-pole pink noise filter (-3dB/oct for lush surf, flame & wind)
    b0 = 0.99886 * b0 + rnd * 0.0555179;
    b1 = 0.99332 * b1 + rnd * 0.0750759;
    b2 = 0.96900 * b2 + rnd * 0.1538520;
    b3 = 0.86650 * b3 + rnd * 0.3104856;
    b4 = 0.55000 * b4 + rnd * 0.5329522;
    b5 = -0.7616 * b5 - rnd * 0.0168980;
    const pk = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + rnd * 0.5362) * 0.11;
    b6 = rnd * 0.115926;
    p[i] = Math.max(-1, Math.min(1, pk));

    // Leaky-integrated brown noise (-6dB/oct for deep thunder, earth & explosions)
    lastBrown = (lastBrown + 0.032 * rnd) / 1.032;
    b[i] = Math.max(-1, Math.min(1, lastBrown * 3.4));

    // Sparse impulse crackle for fire embers, lightning arcs & crystal shatter
    c[i] = Math.abs(rnd) > 0.945 ? rnd * 0.95 : rnd * 0.06;
  }
  return { white: whiteBuf, pink: pinkBuf, brown: brownBuf, crackle: crackleBuf };
}

export function createCombatMoveAudioEngine({ bus = null, getOutput = null, now = () => Date.now() } = {}) {
  const resolveOutput = () => {
    if (typeof getOutput === "function") return getOutput() ?? null;
    return bus?.output?.("sfx") ?? null;
  };

  let ctx = null;
  let mix = null;
  let masteringNodes = [];
  let banks = null;
  let disposed = false;
  let offset = 0;
  let dropStreak = 0;
  let lastDropAt = 0;

  const voiceEnds = [];
  const lastByKey = new Map();
  const clockOrigin = now();
  const stats = { played: 0, movesPlayed: 0, impactsPlayed: 0, windupsPlayed: 0, throttled: 0, cues: {} };

  function ensureGraph() {
    if (disposed) return null;
    const out = resolveOutput();
    if (!out?.context || !out?.destination) return null;
    if (out.context.state === "closed") return null;
    if (out.context.state === "suspended") out.context.resume?.().catch?.(() => {});
    if (ctx === out.context && mix) return { context: ctx, mix };

    teardownGraph();
    ctx = out.context;
    mix = ctx.createGain();
    mix.gain.value = 0.92;
    masteringNodes = [mix];

    // Broadcast-grade mastering chain (graceful fallback on minimal mock AudioContexts in tests):
    // mix -> High-Shelf (-2.8 dB @ 3800 Hz) -> Warm WaveShaper -> Glue Compressor (-18 dB, 4:1) -> Brickwall Limiter (-2.5 dB, 20:1)
    let tail = mix;
    if (typeof ctx.createBiquadFilter === "function") {
      try {
        const shelf = ctx.createBiquadFilter();
        shelf.type = "highshelf";
        shelf.frequency.value = 3800;
        if (shelf.gain) shelf.gain.value = -2.8;
        tail.connect(shelf);
        tail = shelf;
        masteringNodes.push(shelf);
      } catch { /* mock filter */ }
    }
    if (typeof ctx.createWaveShaper === "function") {
      try {
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeSoftClipCurve(1.55);
        shaper.oversample = "2x";
        tail.connect(shaper);
        tail = shaper;
        masteringNodes.push(shaper);
      } catch { /* mock shaper */ }
    }
    if (typeof ctx.createDynamicsCompressor === "function") {
      try {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.006;
        comp.release.value = 0.16;
        tail.connect(comp);
        tail = comp;
        masteringNodes.push(comp);

        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -2.5;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.1;
        tail.connect(limiter);
        tail = limiter;
        masteringNodes.push(limiter);
      } catch { /* mock compressor */ }
    }
    tail.connect(out.destination);
    banks = bakeNoiseBanks(ctx);
    return { context: ctx, mix };
  }

  function teardownGraph() {
    for (const node of masteringNodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }
    masteringNodes = [];
    mix = null;
    banks = null;
    ctx = null;
  }

  function pruneVoices(tNow) {
    for (let i = voiceEnds.length - 1; i >= 0; i--) {
      if (voiceEnds[i] <= tNow) voiceEnds.splice(i, 1);
    }
    return voiceEnds.length;
  }

  function connectPan(graph, node, pan = 0) {
    const clamped = Math.max(-0.55, Math.min(0.55, Number(pan) || 0));
    if (Math.abs(clamped) > 0.02 && typeof graph.context.createStereoPanner === "function") {
      try {
        const p = graph.context.createStereoPanner();
        p.pan.value = clamped;
        node.connect(p);
        p.connect(graph.mix);
        return;
      } catch { /* fallback to mono mix */ }
    }
    node.connect(graph.mix);
  }

  function env(param, at, attack, hold, release, peak) {
    const p = Math.max(0.0002, peak);
    param.setValueAtTime(0.0001, at);
    param.exponentialRampToValueAtTime(p, at + Math.max(0.0015, attack));
    if (hold > 0) param.setValueAtTime(p, at + Math.max(0.0015, attack) + hold);
    const end = at + Math.max(0.0015, attack) + Math.max(0, hold) + Math.max(0.008, release);
    param.exponentialRampToValueAtTime(0.0001, end);
    return end;
  }

  function tone(graph, { type = "sine", f0 = 440, f1 = null, at, a = 0.004, h = 0.02, r = 0.12, peak = 0.14, filter = null, pan = 0 }) {
    const c = graph.context;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    const startHz = Math.max(20, f0);
    osc.frequency.setValueAtTime(startHz, at);
    const end = env(g.gain, at, a, h, r, peak);
    if (f1 != null && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), end);
    let head = osc;
    if (filter && typeof c.createBiquadFilter === "function") {
      const f = c.createBiquadFilter();
      f.type = filter.type ?? "lowpass";
      f.frequency.setValueAtTime(Math.max(40, filter.f0 ?? filter.frequency ?? 1200), at);
      if (filter.f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, filter.f1), end);
      f.Q.value = filter.q ?? 1;
      head.connect(f);
      head = f;
    }
    head.connect(g);
    connectPan(graph, g, pan);
    osc.start(at);
    osc.stop(end + 0.02);
    return end;
  }

  /** True 2-operator FM synthesis: carrier + decaying modulator index for authentic steel, bells, ice & plasma! */
  function fmTone(graph, {
    carrierType = "sine", modType = "sine",
    f0 = 440, f1 = null, modRatio = 2.71, modIndex = 240, endModIndex = 12,
    at, a = 0.002, h = 0.015, r = 0.2, peak = 0.14, pan = 0, filter = null
  }) {
    const c = graph.context;
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const modGain = c.createGain();
    const outGain = c.createGain();

    car.type = carrierType;
    mod.type = modType;
    const startHz = Math.max(24, f0);
    car.frequency.setValueAtTime(startHz, at);
    mod.frequency.setValueAtTime(Math.max(20, startHz * modRatio), at);
    const end = env(outGain.gain, at, a, h, r, peak);
    if (f1 != null && f1 !== f0) {
      const targetHz = Math.max(24, f1);
      car.frequency.exponentialRampToValueAtTime(targetHz, end);
      mod.frequency.exponentialRampToValueAtTime(Math.max(20, targetHz * modRatio), end);
    }
    modGain.gain.setValueAtTime(Math.max(0.5, modIndex), at);
    modGain.gain.exponentialRampToValueAtTime(Math.max(0.5, endModIndex), end);

    mod.connect(modGain);
    modGain.connect(car.frequency);

    let head = car;
    if (filter && typeof c.createBiquadFilter === "function") {
      const f = c.createBiquadFilter();
      f.type = filter.type ?? "bandpass";
      f.frequency.setValueAtTime(Math.max(40, filter.f0 ?? filter.frequency ?? 1600), at);
      if (filter.f1) f.frequency.exponentialRampToValueAtTime(Math.max(40, filter.f1), end);
      f.Q.value = filter.q ?? 1.4;
      head.connect(f);
      head = f;
    }
    head.connect(outGain);
    connectPan(graph, outGain, pan);
    mod.start(at);
    car.start(at);
    mod.stop(end + 0.02);
    car.stop(end + 0.02);
    return end;
  }

  /** Colored noise burst (`white` | `pink` | `brown` | `crackle`) through sweeping resonant filter. */
  function noise(graph, { bank = "white", at, a = 0.004, h = 0.03, r = 0.14, peak = 0.16, type = "bandpass", f0 = 1400, f1 = null, q = 1.2, rate = 1, pan = 0 }) {
    const c = graph.context;
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = banks?.[bank] ?? banks?.white;
    if (src.playbackRate) src.playbackRate.value = rate;
    filter.type = type;
    filter.frequency.setValueAtTime(Math.max(30, f0), at);
    if (filter.Q) filter.Q.value = q;
    const end = env(g.gain, at, a, h, r, peak);
    if (f1 != null && f1 !== f0) filter.frequency.exponentialRampToValueAtTime(Math.max(30, f1), end);
    src.connect(filter);
    filter.connect(g);
    connectPan(graph, g, pan);
    offset = (offset + 0.31) % 0.65;
    src.start(at, offset);
    src.stop(end + 0.02);
    return end;
  }

  /** Arcade fighting-game chest punch: rapid pitch-drop sub + crisp transient click. */
  function subPunch(graph, { at, f0 = 165, f1 = 36, duration = 0.14, peak = 0.28, click = 0.18, pan = 0 }) {
    let end = tone(graph, { type: "sine", f0, f1, at, a: 0.002, h: 0.015, r: duration, peak, pan });
    end = Math.max(end, tone(graph, { type: "triangle", f0: f0 * 1.45, f1: f1 * 1.15, at, a: 0.0015, h: 0.008, r: duration * 0.55, peak: peak * 0.45, pan }));
    if (click > 0) {
      end = Math.max(end, noise(graph, { bank: "white", at, a: 0.001, h: 0.004, r: 0.028, peak: click, type: "highpass", f0: 2100, q: 0.9, pan }));
    }
    return end;
  }

  function chord(graph, { freqs, type = "triangle", at, step = 0.04, r = 0.22, peak = 0.095, pan = 0 }) {
    let end = at;
    for (let i = 0; i < freqs.length; i++) {
      end = Math.max(end, tone(graph, { type, f0: freqs[i], f1: freqs[i] * 1.015, at: at + i * step, a: 0.005, h: 0.03, r, peak, pan }));
    }
    return end;
  }

  /** Canonical 10-Element Acoustic Signature Layer (金木水火土日月雷冰風). */
  function elementAccent(graph, t, canonEl, scale = 1, rate = 1, pan = 0) {
    const s = Math.max(0.25, Math.min(1.5, scale));
    switch (canonEl) {
      case "FIRE":
        return Math.max(
          noise(graph, { bank: "pink", at: t, a: 0.008, h: 0.05, r: 0.22, peak: 0.16 * s, type: "bandpass", f0: 420 * rate, f1: 1850 * rate, q: 1.1, pan }),
          noise(graph, { bank: "crackle", at: t + 0.015, a: 0.003, h: 0.04, r: 0.18, peak: 0.13 * s, type: "highpass", f0: 2600, q: 0.8, pan }),
          tone(graph, { type: "sawtooth", f0: 118 * rate, f1: 52, at: t, a: 0.006, h: 0.04, r: 0.18, peak: 0.09 * s, filter: { type: "lowpass", f0: 420 }, pan })
        );
      case "WATER":
        return Math.max(
          noise(graph, { bank: "pink", at: t, a: 0.01, h: 0.06, r: 0.24, peak: 0.16 * s, type: "bandpass", f0: 360 * rate, f1: 1500 * rate, q: 1.5, pan }),
          tone(graph, { type: "sine", f0: 310 * rate, f1: 790 * rate, at: t + 0.01, a: 0.004, h: 0.015, r: 0.09, peak: 0.09 * s, pan }),
          tone(graph, { type: "sine", f0: 490 * rate, f1: 1120 * rate, at: t + 0.055, a: 0.004, h: 0.012, r: 0.08, peak: 0.075 * s, pan })
        );
      case "ICE":
        return Math.max(
          fmTone(graph, { f0: 1580 * rate, f1: 2350 * rate, modRatio: 3.14, modIndex: 320, endModIndex: 18, at: t, a: 0.002, h: 0.02, r: 0.22, peak: 0.11 * s, pan }),
          fmTone(graph, { f0: 2240 * rate, f1: 2980 * rate, modRatio: 2.41, modIndex: 220, endModIndex: 12, at: t + 0.032, a: 0.002, h: 0.02, r: 0.2, peak: 0.085 * s, pan }),
          noise(graph, { bank: "crackle", at: t, a: 0.002, h: 0.02, r: 0.16, peak: 0.12 * s, type: "highpass", f0: 3800, pan })
        );
      case "THUNDER":
        return Math.max(
          noise(graph, { bank: "crackle", at: t, a: 0.0015, h: 0.025, r: 0.16, peak: 0.2 * s, type: "bandpass", f0: 3200 * rate, f1: 950, q: 1.8, pan }),
          fmTone(graph, { carrierType: "sawtooth", modType: "square", f0: 760 * rate, f1: 1650 * rate, modRatio: 1.73, modIndex: 480, endModIndex: 60, at: t, a: 0.002, h: 0.02, r: 0.13, peak: 0.11 * s, filter: { type: "bandpass", f0: 1950, q: 2.2 }, pan }),
          noise(graph, { bank: "brown", at: t + 0.04, a: 0.008, h: 0.06, r: 0.28, peak: 0.16 * s, type: "lowpass", f0: 520, f1: 140, pan })
        );
      case "WIND":
        return Math.max(
          noise(graph, { bank: "pink", at: t, a: 0.015, h: 0.08, r: 0.28, peak: 0.16 * s, type: "bandpass", f0: 520 * rate, f1: 2350 * rate, q: 3.4, pan }),
          noise(graph, { bank: "pink", at: t + 0.05, a: 0.015, h: 0.06, r: 0.22, peak: 0.1 * s, type: "bandpass", f0: 1850 * rate, f1: 740 * rate, q: 3.2, pan })
        );
      case "EARTH":
        return Math.max(
          noise(graph, { bank: "brown", at: t, a: 0.005, h: 0.06, r: 0.28, peak: 0.22 * s, type: "lowpass", f0: 640, f1: 140, pan }),
          subPunch(graph, { at: t, f0: 122 * rate, f1: 30, duration: 0.22, peak: 0.2 * s, click: 0.08 * s, pan })
        );
      case "WOOD":
        return Math.max(
          fmTone(graph, { f0: 290 * rate, f1: 165 * rate, modRatio: 1.48, modIndex: 180, endModIndex: 10, at: t, a: 0.002, h: 0.015, r: 0.14, peak: 0.13 * s, pan }),
          noise(graph, { bank: "pink", at: t + 0.01, a: 0.008, h: 0.04, r: 0.18, peak: 0.12 * s, type: "bandpass", f0: 2200 * rate, f1: 1050 * rate, q: 1.8, pan })
        );
      case "METAL":
        return Math.max(
          fmTone(graph, { f0: 660 * rate, f1: 480 * rate, modRatio: 2.76, modIndex: 520, endModIndex: 35, at: t, a: 0.0015, h: 0.02, r: 0.24, peak: 0.13 * s, pan }),
          fmTone(graph, { f0: 1480 * rate, f1: 1120 * rate, modRatio: 1.92, modIndex: 360, endModIndex: 20, at: t + 0.008, a: 0.0015, h: 0.015, r: 0.18, peak: 0.09 * s, pan })
        );
      case "SUN":
        return Math.max(
          chord(graph, { freqs: [880 * rate, 1108.7 * rate, 1318.5 * rate, 1760 * rate], type: "sine", at: t, step: 0.024, r: 0.24, peak: 0.085 * s, pan }),
          fmTone(graph, { f0: 1318 * rate, f1: 1976 * rate, modRatio: 2.0, modIndex: 180, endModIndex: 8, at: t, a: 0.003, h: 0.02, r: 0.22, peak: 0.09 * s, pan })
        );
      case "MOON":
        return Math.max(
          fmTone(graph, { f0: 311 * rate, f1: 164 * rate, modRatio: 1.414, modIndex: 260, endModIndex: 25, at: t, a: 0.008, h: 0.05, r: 0.28, peak: 0.12 * s, pan }),
          tone(graph, { type: "sine", f0: 120 * rate, f1: 48, at: t + 0.02, a: 0.01, h: 0.05, r: 0.24, peak: 0.13 * s, pan })
        );
      default:
        return Math.max(
          noise(graph, { bank: "white", at: t, a: 0.002, h: 0.015, r: 0.09, peak: 0.12 * s, type: "bandpass", f0: 1900 * rate, f1: 720, q: 1.2, pan }),
          tone(graph, { type: "triangle", f0: 210 * rate, f1: 82, at: t, a: 0.002, h: 0.015, r: 0.09, peak: 0.11 * s, pan })
        );
    }
  }

  function admitVoice(key, minGap, buildFn) {
    const graph = ensureGraph();
    if (!graph) return false;
    const t = graph.context.currentTime;
    const gateClock = Math.max(t, Math.max(0, now() - clockOrigin) / 1000);
    if (gateClock - (lastByKey.get(key) ?? -10) < minGap) {
      stats.throttled++;
      return false;
    }
    const active = pruneVoices(gateClock);
    if (active >= MAX_VOICES) {
      stats.throttled++;
      return false;
    }
    lastByKey.set(key, gateClock);
    // Sqrt concurrent-voice auto-ducking (prevents rapid combo loudness spikes!)
    const duck = 1 / Math.sqrt(1 + 0.35 * active);
    const end = buildFn(graph, t, duck);
    const dur = Math.max(0.04, end - t);
    voiceEnds.push(gateClock + dur);
    stats.played++;
    return true;
  }

  /** Phase 1: Move anticipation windup sound (crisp charge hum before release). */
  function playWindup({ archetype = "HOMING_ORB", element = null, moveId = null, duration = 0.2, pan = 0 } = {}) {
    const canon = canonicalAudioElement(element, moveId);
    const rate = movePitchRate(moveId);
    const dur = Math.max(0.08, Math.min(0.45, duration));
    const ok = admitVoice(`wu:${archetype}:${canon}`, MIN_GAP.windup, (graph, t, duck) => {
      const isMelee = ["FLURRY_COMBO", "MULTI_DASH", "GUARD_BREAK_SLAM", "LEAP_SLAM", "GRAB_SLAM", "UTURN_STRIKE"].includes(archetype);
      if (isMelee) {
        return Math.max(
          noise(graph, { bank: "pink", at: t, a: 0.015, h: dur * 0.25, r: dur * 0.65, peak: 0.1 * duck, type: "bandpass", f0: 360 * rate, f1: 1150 * rate, q: 1.8, pan }),
          tone(graph, { type: "triangle", f0: 150 * rate, f1: 280 * rate, at: t, a: 0.01, h: dur * 0.2, r: dur * 0.6, peak: 0.08 * duck, pan })
        );
      }
      return Math.max(
        fmTone(graph, { f0: 260 * rate, f1: 680 * rate, modRatio: canon === "ICE" ? 3.1 : 2.0, modIndex: 140, endModIndex: 280, at: t, a: 0.02, h: dur * 0.2, r: dur * 0.65, peak: 0.085 * duck, pan }),
        noise(graph, { bank: "pink", at: t, a: 0.02, h: dur * 0.2, r: dur * 0.6, peak: 0.075 * duck, type: "bandpass", f0: 520, f1: 1800, q: 2.5, pan })
      );
    });
    if (ok) { stats.windupsPlayed++; stats.cues.windup = (stats.cues.windup ?? 0) + 1; }
    return ok;
  }

  /** Phase 2: Move release / cast sound across all 20 V2 archetypes, 6 wall materials & 10 elements. */
  function playMove({ archetype = "HOMING_ORB", element = null, moveId = null, phase = "release", material = null, ultimate = false, step = 0, pan = 0 } = {}) {
    const canon = canonicalAudioElement(element, moveId);
    const rate = movePitchRate(moveId) * (1 + Math.min(5, step) * 0.06);
    const gap = archetype === "GROUND_SPIKES" || archetype === "FLURRY_COMBO" ? 0.045 : 0.075;
    const key = `mv:${archetype}:${phase}:${material ?? canon}`;
    const ok = admitVoice(key, gap, (graph, t, duck) => {
      const s = (ultimate ? 1.24 : 1.0) * duck;
      let end = t;

      // Shield Wall placement (6 distinct organic materials)
      if (phase === "wall" || material) {
        const mat = String(material ?? "STONE").toUpperCase();
        if (mat === "ICE") {
          end = Math.max(
            fmTone(graph, { f0: 1320 * rate, f1: 1980 * rate, modRatio: 3.14, modIndex: 360, endModIndex: 20, at: t, a: 0.002, h: 0.03, r: 0.26, peak: 0.14 * s, pan }),
            noise(graph, { bank: "crackle", at: t, a: 0.002, h: 0.03, r: 0.22, peak: 0.16 * s, type: "highpass", f0: 3200, pan })
          );
        } else if (mat === "WOOD") {
          end = Math.max(
            fmTone(graph, { f0: 210 * rate, f1: 108 * rate, modRatio: 1.48, modIndex: 200, endModIndex: 14, at: t, a: 0.002, h: 0.03, r: 0.16, peak: 0.18 * s, pan }),
            fmTone(graph, { f0: 310 * rate, f1: 160 * rate, modRatio: 1.5, modIndex: 140, endModIndex: 10, at: t + 0.045, a: 0.002, h: 0.02, r: 0.12, peak: 0.13 * s, pan }),
            noise(graph, { bank: "pink", at: t + 0.01, a: 0.008, h: 0.04, r: 0.18, peak: 0.12 * s, type: "bandpass", f0: 1800, f1: 850, q: 1.5, pan })
          );
        } else if (mat === "METAL") {
          end = Math.max(
            fmTone(graph, { f0: 540 * rate, f1: 390 * rate, modRatio: 2.76, modIndex: 580, endModIndex: 45, at: t, a: 0.0015, h: 0.025, r: 0.26, peak: 0.16 * s, pan }),
            subPunch(graph, { at: t, f0: 130, f1: 42, duration: 0.14, peak: 0.18 * s, click: 0.1 * s, pan })
          );
        } else if (mat === "CRYSTAL") {
          end = Math.max(
            chord(graph, { freqs: [1174.7, 1568, 2349.3], type: "sine", at: t, step: 0.028, r: 0.26, peak: 0.095 * s, pan }),
            fmTone(graph, { f0: 1760, f1: 2637, modRatio: 2.5, modIndex: 260, endModIndex: 15, at: t, a: 0.002, h: 0.02, r: 0.25, peak: 0.1 * s, pan })
          );
        } else if (mat === "BASALT") {
          end = Math.max(
            subPunch(graph, { at: t, f0: 112, f1: 30, duration: 0.24, peak: 0.24 * s, click: 0.08 * s, pan }),
            noise(graph, { bank: "brown", at: t, a: 0.006, h: 0.06, r: 0.26, peak: 0.2 * s, type: "lowpass", f0: 760, f1: 180, pan }),
            noise(graph, { bank: "crackle", at: t + 0.03, a: 0.005, h: 0.05, r: 0.2, peak: 0.12 * s, type: "bandpass", f0: 1900, q: 1.2, pan })
          );
        } else {
          end = Math.max(
            subPunch(graph, { at: t, f0: 120, f1: 34, duration: 0.22, peak: 0.24 * s, click: 0.1 * s, pan }),
            noise(graph, { bank: "brown", at: t, a: 0.004, h: 0.05, r: 0.24, peak: 0.2 * s, type: "lowpass", f0: 880, f1: 210, pan })
          );
        }
        return end;
      }

      switch (archetype) {
        case "DRAG_WAVE":
          end = Math.max(
            noise(graph, { bank: "pink", at: t, a: 0.02, h: 0.12, r: 0.34, peak: 0.2 * s, type: "bandpass", f0: 240, f1: 1280, q: 1.2, pan }),
            noise(graph, { bank: "white", at: t + 0.05, a: 0.015, h: 0.07, r: 0.26, peak: 0.11 * s, type: "highpass", f0: 2600, f1: 980, pan }),
            elementAccent(graph, t + 0.02, canon, 0.85 * s, rate, pan)
          );
          break;
        case "VORTEX_PULL":
          end = Math.max(
            noise(graph, { bank: "pink", at: t, a: 0.03, h: 0.16, r: 0.4, peak: 0.18 * s, type: "bandpass", f0: 300, f1: 1520, q: 4.0, pan }),
            noise(graph, { bank: "pink", at: t + 0.08, a: 0.03, h: 0.14, r: 0.32, peak: 0.13 * s, type: "bandpass", f0: 1260, f1: 420, q: 3.6, pan }),
            elementAccent(graph, t + 0.02, canon, 0.9 * s, rate, pan)
          );
          break;
        case "BURROW_AMBUSH":
          if (phase === "start") {
            for (let i = 0; i < 3; i++) {
              end = Math.max(end, noise(graph, { bank: "brown", at: t + i * 0.055, a: 0.003, h: 0.02, r: 0.07, peak: 0.19 * s, type: "bandpass", f0: 660 - i * 110, f1: 210, q: 1.3, pan }));
            }
            end = Math.max(end, subPunch(graph, { at: t, f0: 165, f1: 48, duration: 0.18, peak: 0.18 * s, click: 0.06 * s, pan }));
          } else {
            end = Math.max(
              subPunch(graph, { at: t, f0: 145, f1: 28, duration: 0.3, peak: 0.28 * s, click: 0.16 * s, pan }),
              noise(graph, { bank: "brown", at: t, a: 0.004, h: 0.06, r: 0.28, peak: 0.22 * s, type: "lowpass", f0: 1150, f1: 240, pan }),
              elementAccent(graph, t + 0.02, canon, 0.95 * s, rate, pan)
            );
          }
          break;
        case "GROUND_SPIKES":
          end = Math.max(
            subPunch(graph, { at: t, f0: 160 * rate, f1: 48 * rate, duration: 0.11, peak: 0.19 * s, click: 0.13 * s, pan }),
            noise(graph, { bank: "crackle", at: t, a: 0.002, h: 0.02, r: 0.12, peak: 0.16 * s, type: "bandpass", f0: 1450 * rate, f1: 520, q: 1.8, pan }),
            elementAccent(graph, t, canon, 0.7 * s, rate, pan)
          );
          break;
        case "SHOCKWAVE_RING":
        case "LEAP_SLAM":
        case "GRAB_SLAM":
        case "GUARD_BREAK_SLAM":
          end = Math.max(
            subPunch(graph, { at: t, f0: 155, f1: 26, duration: 0.32, peak: 0.3 * s, click: 0.2 * s, pan }),
            noise(graph, { bank: "brown", at: t, a: 0.004, h: 0.07, r: 0.3, peak: 0.22 * s, type: "lowpass", f0: 980, f1: 190, pan }),
            elementAccent(graph, t + 0.018, canon, 0.9 * s, rate, pan)
          );
          break;
        case "STREAM_BEAM":
          end = Math.max(
            fmTone(graph, { carrierType: "sawtooth", f0: 360 * rate, f1: 195 * rate, modRatio: 2.0, modIndex: 380, endModIndex: 80, at: t, a: 0.005, h: 0.12, r: 0.26, peak: 0.14 * s, filter: { type: "bandpass", f0: 1600, f1: 580, q: 1.6 }, pan }),
            tone(graph, { type: "triangle", f0: 1020 * rate, f1: 460 * rate, at: t, a: 0.004, h: 0.08, r: 0.22, peak: 0.1 * s, pan }),
            elementAccent(graph, t, canon, 1.0 * s, rate, pan)
          );
          break;
        case "METEOR_RAIN":
          if (phase === "drop") {
            end = Math.max(
              tone(graph, { type: "sine", f0: 840 * rate, f1: 160, at: t, a: 0.015, h: 0.08, r: 0.32, peak: 0.1 * s, pan }),
              noise(graph, { bank: "pink", at: t, a: 0.02, h: 0.12, r: 0.28, peak: 0.13 * s, type: "bandpass", f0: 1950, f1: 320, q: 1.4, pan }),
              elementAccent(graph, t + 0.05, canon, 0.75 * s, rate, pan)
            );
          } else {
            end = Math.max(
              subPunch(graph, { at: t, f0: 138, f1: 24, duration: 0.36, peak: 0.32 * s, click: 0.18 * s, pan }),
              noise(graph, { bank: "brown", at: t, a: 0.004, h: 0.1, r: 0.36, peak: 0.25 * s, type: "lowpass", f0: 1100, f1: 160, pan }),
              elementAccent(graph, t + 0.015, canon, 1.15 * s, rate, pan)
            );
          }
          break;
        case "TELEKINESIS_SLAM":
          if (phase === "lift" || phase === "cage") {
            end = Math.max(
              fmTone(graph, { f0: 320 * rate, f1: 780 * rate, modRatio: 1.5, modIndex: 180, endModIndex: 280, at: t, a: 0.02, h: 0.12, r: 0.26, peak: 0.11 * s, pan }),
              chord(graph, { freqs: [440 * rate, 659 * rate, 987 * rate], type: "sine", at: t + 0.02, step: 0.04, r: 0.22, peak: 0.07 * s, pan })
            );
          } else {
            end = Math.max(
              subPunch(graph, { at: t, f0: 150, f1: 28, duration: 0.28, peak: 0.28 * s, click: 0.16 * s, pan }),
              elementAccent(graph, t, canon, 0.9 * s, rate, pan)
            );
          }
          break;
        case "FLURRY_COMBO":
        case "SHADOW_BACKSTAB":
        case "MULTI_DASH":
        case "UTURN_STRIKE":
          if (phase === "vanish") {
            end = Math.max(
              noise(graph, { bank: "pink", at: t, a: 0.008, h: 0.03, r: 0.16, peak: 0.14 * s, type: "bandpass", f0: 2600, f1: 540, q: 2.2, pan }),
              fmTone(graph, { f0: 680 * rate, f1: 220 * rate, modRatio: 1.41, modIndex: 200, endModIndex: 20, at: t, a: 0.005, h: 0.02, r: 0.16, peak: 0.09 * s, pan })
            );
          } else {
            end = Math.max(
              fmTone(graph, { f0: 780 * rate, f1: 310 * rate, modRatio: 2.71, modIndex: 440, endModIndex: 28, at: t, a: 0.0015, h: 0.012, r: 0.12, peak: 0.13 * s, pan }),
              noise(graph, { bank: "white", at: t, a: 0.002, h: 0.012, r: 0.09, peak: 0.15 * s, type: "bandpass", f0: 2900 * rate, f1: 820, q: 1.5, pan }),
              elementAccent(graph, t + 0.005, canon, 0.72 * s, rate, pan)
            );
          }
          break;
        case "VOLLEY_BARRAGE":
          for (let i = 0; i < 3; i++) {
            end = Math.max(end,
              fmTone(graph, { f0: (680 + i * 115) * rate, f1: (380 + i * 65) * rate, modRatio: 2.1, modIndex: 180, endModIndex: 20, at: t + i * 0.036, a: 0.002, h: 0.01, r: 0.08, peak: 0.095 * s, pan }),
              noise(graph, { bank: "white", at: t + i * 0.036, a: 0.002, h: 0.008, r: 0.06, peak: 0.09 * s, type: "bandpass", f0: 2300 + i * 260, q: 1.6, pan })
            );
          }
          end = Math.max(end, elementAccent(graph, t + 0.02, canon, 0.75 * s, rate, pan));
          break;
        case "SELF_BUFF":
          end = Math.max(
            chord(graph, { freqs: [440, 554.4, 659.3, 880, 1108.7], type: "triangle", at: t, step: 0.045, r: 0.28, peak: 0.1 * s, pan }),
            noise(graph, { bank: "pink", at: t, a: 0.025, h: 0.12, r: 0.28, peak: 0.1 * s, type: "bandpass", f0: 600, f1: 2400, q: 1.8, pan })
          );
          break;
        case "RECOVERY_SUPPORT":
          end = Math.max(
            chord(graph, { freqs: [523.3, 659.3, 784, 1046.5, 1318.5], type: "sine", at: t, step: 0.055, r: 0.34, peak: 0.1 * s, pan }),
            fmTone(graph, { f0: 1046.5, f1: 1568, modRatio: 2.0, modIndex: 120, endModIndex: 8, at: t + 0.08, a: 0.01, h: 0.04, r: 0.28, peak: 0.075 * s, pan })
          );
          break;
        case "PROTECT_COUNTER":
          end = Math.max(
            fmTone(graph, { f0: 620 * rate, f1: 920 * rate, modRatio: 2.5, modIndex: 360, endModIndex: 25, at: t, a: 0.002, h: 0.03, r: 0.22, peak: 0.14 * s, pan }),
            chord(graph, { freqs: [523.3, 784], type: "triangle", at: t + 0.015, step: 0.02, r: 0.18, peak: 0.09 * s, pan })
          );
          break;
        default: // HOMING_ORB & general projectiles
          end = Math.max(
            fmTone(graph, { f0: 540 * rate, f1: 270 * rate, modRatio: 1.8, modIndex: 210, endModIndex: 20, at: t, a: 0.004, h: 0.02, r: 0.14, peak: 0.12 * s, pan }),
            elementAccent(graph, t, canon, 0.9 * s, rate, pan)
          );
          break;
      }
      if (ultimate) {
        end = Math.max(end,
          subPunch(graph, { at: t, f0: 125, f1: 28, duration: 0.28, peak: 0.24 * duck, click: 0.12 * duck, pan }),
          fmTone(graph, { f0: 880, f1: 1760, modRatio: 2.0, modIndex: 260, endModIndex: 18, at: t + 0.02, a: 0.005, h: 0.04, r: 0.28, peak: 0.1 * duck, pan })
        );
      }
      return end;
    });
    if (ok) { stats.movesPlayed++; stats.cues[archetype] = (stats.cues[archetype] ?? 0) + 1; }
    return ok;
  }

  /** Phase 3: Arcade fighting-game 3-layer impact punch (light / medium / heavy / crit / super / resist / guard / parry / break / clash). */
  function playImpact({
    amount = 16, tier = null, effectiveness = "neutral", guarded = false, parry = false,
    guardBreak = false, clash = false, critical = false, combo = 1, element = null, moveId = null, pan = 0
  } = {}) {
    const canon = canonicalAudioElement(element, moveId);
    const rate = movePitchRate(moveId);
    const kind = parry ? "parry" : guardBreak ? "guardBreak" : clash ? "clash" : guarded ? "guard"
      : critical ? "crit" : tier ? tier : amount >= 28 ? "heavy" : amount >= 14 ? "medium" : "light";
    const gap = parry || guardBreak || clash ? 0.075 : (MIN_GAP[kind] ?? 0.05);
    const ok = admitVoice(`imp:${kind}`, gap, (graph, t, duck) => {
      const lift = (1 + Math.min(8, Math.max(0, combo - 1)) * 0.032) * rate;
      if (parry) {
        // Unmistakable anime steel parry "TING!" + harmonic ring!
        return Math.max(
          fmTone(graph, { f0: 1568 * rate, f1: 2093 * rate, modRatio: 2.76, modIndex: 680, endModIndex: 30, at: t, a: 0.001, h: 0.025, r: 0.34, peak: 0.19 * duck, pan }),
          fmTone(graph, { f0: 2349 * rate, f1: 3136 * rate, modRatio: 2.0, modIndex: 320, endModIndex: 15, at: t + 0.01, a: 0.001, h: 0.02, r: 0.28, peak: 0.13 * duck, pan }),
          noise(graph, { bank: "white", at: t, a: 0.001, h: 0.006, r: 0.04, peak: 0.16 * duck, type: "highpass", f0: 3600, pan })
        );
      }
      if (guardBreak) {
        return Math.max(
          subPunch(graph, { at: t, f0: 175, f1: 28, duration: 0.3, peak: 0.32 * duck, click: 0.22 * duck, pan }),
          noise(graph, { bank: "crackle", at: t, a: 0.0015, h: 0.04, r: 0.3, peak: 0.24 * duck, type: "bandpass", f0: 3200, f1: 820, q: 1.2, pan }),
          fmTone(graph, { f0: 1850, f1: 720, modRatio: 3.14, modIndex: 540, endModIndex: 40, at: t + 0.012, a: 0.002, h: 0.02, r: 0.24, peak: 0.15 * duck, pan })
        );
      }
      if (clash) {
        return Math.max(
          fmTone(graph, { f0: 1180 * rate, f1: 760 * rate, modRatio: 2.76, modIndex: 620, endModIndex: 40, at: t, a: 0.001, h: 0.02, r: 0.26, peak: 0.18 * duck, pan }),
          subPunch(graph, { at: t, f0: 145, f1: 42, duration: 0.18, peak: 0.22 * duck, click: 0.18 * duck, pan }),
          noise(graph, { bank: "crackle", at: t, a: 0.001, h: 0.02, r: 0.18, peak: 0.18 * duck, type: "highpass", f0: 2600, pan })
        );
      }
      if (guarded) {
        return Math.max(
          fmTone(graph, { f0: 340, f1: 230, modRatio: 2.4, modIndex: 280, endModIndex: 25, at: t, a: 0.0015, h: 0.015, r: 0.12, peak: 0.16 * duck, pan }),
          subPunch(graph, { at: t, f0: 130, f1: 58, duration: 0.09, peak: 0.16 * duck, click: 0.11 * duck, pan })
        );
      }
      if (effectiveness === "resist") {
        // Dull muted thud for resisted hits
        return Math.max(
          tone(graph, { type: "triangle", f0: 120 * rate, f1: 52, at: t, a: 0.003, h: 0.015, r: 0.09, peak: 0.16 * duck, filter: { type: "lowpass", f0: 520 }, pan }),
          noise(graph, { bank: "brown", at: t, a: 0.002, h: 0.015, r: 0.06, peak: 0.11 * duck, type: "lowpass", f0: 680, pan })
        );
      }
      const isHeavy = kind === "heavy" || kind === "crit" || effectiveness === "super";
      let end = subPunch(graph, {
        at: t,
        f0: (isHeavy ? 182 : kind === "medium" ? 158 : 195) * (isHeavy ? 1 : lift),
        f1: isHeavy ? 30 : kind === "medium" ? 44 : 74,
        duration: isHeavy ? 0.2 : kind === "medium" ? 0.12 : 0.075,
        peak: (isHeavy ? 0.32 : kind === "medium" ? 0.24 : 0.16) * duck,
        click: (isHeavy ? 0.24 : kind === "medium" ? 0.17 : 0.11) * duck,
        pan
      });
      // Crunch mid-body noise layer
      end = Math.max(end, noise(graph, {
        bank: isHeavy ? "crackle" : "white",
        at: t + 0.004, a: 0.0015, h: isHeavy ? 0.025 : 0.012, r: isHeavy ? 0.14 : 0.07,
        peak: (isHeavy ? 0.2 : kind === "medium" ? 0.14 : 0.09) * duck,
        type: "bandpass", f0: (isHeavy ? 2100 : 2500) * lift, f1: 720, q: 1.1, pan
      }));
      // Element timbre color on impact
      if (canon !== "NEUTRAL") {
        end = Math.max(end, elementAccent(graph, t + 0.008, canon, (isHeavy ? 0.72 : 0.48) * duck, rate, pan));
      }
      // Super-effective or Critical 2-stage delayed chime burst!
      if (critical || effectiveness === "super") {
        end = Math.max(end,
          fmTone(graph, { f0: 988 * lift, f1: 1480 * lift, modRatio: 2.0, modIndex: 300, endModIndex: 18, at: t + 0.012, a: 0.002, h: 0.025, r: 0.2, peak: 0.15 * duck, pan }),
          tone(graph, { type: "triangle", f0: 1480 * lift, f1: 1976 * lift, at: t + 0.032, a: 0.002, h: 0.02, r: 0.18, peak: 0.11 * duck, pan })
        );
      }
      return end;
    });
    if (ok) { stats.impactsPlayed++; stats.cues[kind] = (stats.cues[kind] ?? 0) + 1; }
    return ok;
  }

  /** Named battle / reaction / ailment / UI cues (100% unified across Data Arena & Turn-Based Battle). */
  const CUES = {
    claw: (g, t, d, p) => Math.max(fmTone(g, { f0: 820, f1: 310, modRatio: 2.71, modIndex: 420, endModIndex: 25, at: t, a: 0.0015, h: 0.01, r: 0.11, peak: 0.13 * d, pan: p }), noise(g, { bank: "white", at: t, a: 0.002, h: 0.015, r: 0.09, peak: 0.15 * d, type: "bandpass", f0: 2600, f1: 760, pan: p })),
    flame: (g, t, d, p) => elementAccent(g, t, "FIRE", 1.0 * d, 1, p),
    ray: (g, t, d, p) => Math.max(fmTone(g, { f0: 1520, f1: 620, modRatio: 2.0, modIndex: 280, endModIndex: 20, at: t, a: 0.002, h: 0.02, r: 0.14, peak: 0.11 * d, pan: p }), tone(g, { type: "sine", f0: 2200, f1: 980, at: t, a: 0.003, h: 0.02, r: 0.12, peak: 0.06 * d, pan: p })),
    frost: (g, t, d, p) => elementAccent(g, t, "ICE", 1.0 * d, 1, p),
    hit: (g, t, d, p) => subPunch(g, { at: t, f0: 185, f1: 68, duration: 0.07, peak: 0.16 * d, click: 0.12 * d, pan: p }),
    kill: (g, t, d, p) => Math.max(subPunch(g, { at: t, f0: 165, f1: 30, duration: 0.24, peak: 0.28 * d, click: 0.18 * d, pan: p }), noise(g, { bank: "brown", at: t + 0.01, a: 0.004, h: 0.05, r: 0.24, peak: 0.2 * d, type: "lowpass", f0: 1200, f1: 200, pan: p })),
    ko: (g, t, d, p) => Math.max(subPunch(g, { at: t, f0: 150, f1: 24, duration: 0.36, peak: 0.34 * d, click: 0.22 * d, pan: p }), fmTone(g, { carrierType: "sawtooth", f0: 240, f1: 48, modRatio: 1.5, modIndex: 240, endModIndex: 20, at: t + 0.02, a: 0.004, h: 0.06, r: 0.28, peak: 0.14 * d, filter: { type: "lowpass", f0: 680 }, pan: p }), noise(g, { bank: "brown", at: t + 0.01, a: 0.006, h: 0.08, r: 0.34, peak: 0.24 * d, type: "lowpass", f0: 920, f1: 140, pan: p })),
    hurt: (g, t, d, p) => Math.max(subPunch(g, { at: t, f0: 195, f1: 54, duration: 0.14, peak: 0.22 * d, click: 0.14 * d, pan: p }), tone(g, { type: "sawtooth", f0: 210, f1: 86, at: t, a: 0.003, h: 0.03, r: 0.14, peak: 0.11 * d, filter: { type: "lowpass", f0: 1100 }, pan: p })),
    dash: (g, t, d, p) => noise(g, { bank: "pink", at: t, a: 0.008, h: 0.03, r: 0.14, peak: 0.18 * d, type: "bandpass", f0: 560, f1: 3100, q: 1.4, pan: p }),
    perfect: (g, t, d, p) => Math.max(fmTone(g, { f0: 1318.5, f1: 1975.5, modRatio: 2.0, modIndex: 240, endModIndex: 12, at: t, a: 0.003, h: 0.03, r: 0.26, peak: 0.15 * d, pan: p }), chord(g, { freqs: [1318.5, 1975.5, 2637], type: "sine", at: t + 0.03, step: 0.04, r: 0.28, peak: 0.1 * d, pan: p })),
    splash: (g, t, d, p) => elementAccent(g, t, "WATER", 1.15 * d, 0.9, p),
    crack: (g, t, d, p) => { let end = t; for (let i = 0; i < 3; i++) end = Math.max(end, noise(g, { bank: "crackle", at: t + i * 0.045, a: 0.001, h: 0.006, r: 0.045, peak: 0.2 * d, type: "highpass", f0: 3000, pan: p })); return end; },
    ignite: (g, t, d, p) => elementAccent(g, t, "FIRE", 1.15 * d, 0.95, p),
    surge: (g, t, d, p) => noise(g, { bank: "pink", at: t, a: 0.04, h: 0.14, r: 0.42, peak: 0.22 * d, type: "bandpass", f0: 280, f1: 1750, q: 1.0, pan: p }),
    warn: (g, t, d, p) => Math.max(tone(g, { type: "triangle", f0: 660, at: t, a: 0.005, h: 0.09, r: 0.08, peak: 0.13 * d, pan: p }), tone(g, { type: "triangle", f0: 880, at: t + 0.18, a: 0.005, h: 0.1, r: 0.12, peak: 0.13 * d, pan: p })),
    cheer: (g, t, d, p) => Math.max(noise(g, { bank: "pink", at: t, a: 0.2, h: 0.75, r: 0.95, peak: 0.16 * d, type: "bandpass", f0: 920, q: 0.7, pan: p }), chord(g, { freqs: [523.3, 659.3, 784], type: "triangle", at: t + 0.08, step: 0.05, r: 0.36, peak: 0.065 * d, pan: p })),
    roar: (g, t, d, p) => Math.max(fmTone(g, { carrierType: "sawtooth", f0: 120, f1: 52, modRatio: 1.35, modIndex: 180, endModIndex: 40, at: t, a: 0.04, h: 0.32, r: 0.5, peak: 0.18 * d, filter: { type: "lowpass", f0: 640 }, pan: p }), noise(g, { bank: "brown", at: t, a: 0.04, h: 0.32, r: 0.46, peak: 0.16 * d, type: "lowpass", f0: 520, pan: p })),
    level: (g, t, d, p) => chord(g, { freqs: [523.3, 659.3, 784, 1046.5], type: "triangle", at: t, step: 0.065, r: 0.22, peak: 0.11 * d, pan: p }),
    overheat: (g, t, d, p) => noise(g, { bank: "pink", at: t, a: 0.01, h: 0.18, r: 0.42, peak: 0.16 * d, type: "highpass", f0: 2400, pan: p }),
    pickup: (g, t, d, p) => tone(g, { type: "sine", f0: 1320, f1: 2093, at: t, a: 0.002, h: 0.018, r: 0.07, peak: 0.08 * d, pan: p }),
    block: (g, t, d, p) => fmTone(g, { f0: 360, f1: 250, modRatio: 2.5, modIndex: 280, endModIndex: 20, at: t, a: 0.002, h: 0.015, r: 0.09, peak: 0.14 * d, pan: p }),
    burst: (g, t, d, p) => Math.max(subPunch(g, { at: t, f0: 145, f1: 32, duration: 0.24, peak: 0.24 * d, click: 0.16 * d, pan: p }), chord(g, { freqs: [587.3, 880, 1174.7, 1760], type: "triangle", at: t + 0.02, step: 0.04, r: 0.32, peak: 0.1 * d, pan: p })),
    slam: (g, t, d, p) => Math.max(subPunch(g, { at: t, f0: 120, f1: 26, duration: 0.34, peak: 0.32 * d, click: 0.18 * d, pan: p }), noise(g, { bank: "brown", at: t, a: 0.005, h: 0.06, r: 0.32, peak: 0.22 * d, type: "lowpass", f0: 700, f1: 160, pan: p })),
    ui: (g, t, d, p) => tone(g, { type: "triangle", f0: 920, f1: 1120, at: t, a: 0.002, h: 0.015, r: 0.05, peak: 0.07 * d, pan: p }),
    capture: (g, t, d, p) => chord(g, { freqs: [659.3, 880, 1318.5], type: "sine", at: t, step: 0.075, r: 0.26, peak: 0.11 * d, pan: p }),
    ultimate: (g, t, d, p) => Math.max(
      subPunch(g, { at: t, f0: 135, f1: 34, duration: 0.26, peak: 0.24 * d, click: 0.14 * d, pan: p }),
      fmTone(g, { carrierType: "sawtooth", f0: 220, f1: 880, modRatio: 2.0, modIndex: 280, endModIndex: 420, at: t, a: 0.01, h: 0.08, r: 0.24, peak: 0.14 * d, filter: { type: "bandpass", f0: 1400, f1: 3200, q: 1.5 }, pan: p }),
      chord(g, { freqs: [523.3, 784, 1046.5, 1568], type: "sine", at: t + 0.05, step: 0.035, r: 0.28, peak: 0.095 * d, pan: p })
    ),
    support: (g, t, d, p) => chord(g, { freqs: [523.3, 659.3, 784, 1046.5], type: "triangle", at: t, step: 0.04, r: 0.22, peak: 0.095 * d, pan: p }),
    skillCard: (g, t, d, p) => Math.max(fmTone(g, { f0: 784, f1: 1175, modRatio: 2.0, modIndex: 180, endModIndex: 12, at: t, a: 0.002, h: 0.02, r: 0.18, peak: 0.11 * d, pan: p }), chord(g, { freqs: [587.3, 880, 1174.7], type: "sine", at: t + 0.02, step: 0.035, r: 0.2, peak: 0.09 * d, pan: p })),
    heal: (g, t, d, p) => chord(g, { freqs: [523.3, 659.3, 784, 1046.5, 1318.5], type: "sine", at: t, step: 0.05, r: 0.3, peak: 0.095 * d, pan: p }),
    // Cross-ring combo & directional shield-wall shatter cues
    shatter: (g, t, d, p) => Math.max(
      subPunch(g, { at: t, f0: 155, f1: 32, duration: 0.26, peak: 0.28 * d, click: 0.22 * d, pan: p }),
      noise(g, { bank: "crackle", at: t, a: 0.002, h: 0.05, r: 0.32, peak: 0.24 * d, type: "bandpass", f0: 2900, f1: 740, q: 1.3, pan: p }),
      fmTone(g, { f0: 1960, f1: 1120, modRatio: 3.14, modIndex: 420, endModIndex: 25, at: t + 0.025, a: 0.002, h: 0.025, r: 0.22, peak: 0.11 * d, pan: p }),
      fmTone(g, { f0: 2540, f1: 1480, modRatio: 2.76, modIndex: 340, endModIndex: 20, at: t + 0.065, a: 0.002, h: 0.02, r: 0.2, peak: 0.09 * d, pan: p })
    ),
    combo: (g, t, d, p) => Math.max(
      chord(g, { freqs: [523.3, 784, 1046.5, 1568], type: "triangle", at: t, step: 0.04, r: 0.24, peak: 0.11 * d, pan: p }),
      fmTone(g, { f0: 1046.5, f1: 1568, modRatio: 2.0, modIndex: 220, endModIndex: 14, at: t + 0.03, a: 0.003, h: 0.03, r: 0.24, peak: 0.1 * d, pan: p })
    ),
    igniteBoom: (g, t, d, p) => Math.max(
      subPunch(g, { at: t, f0: 132, f1: 22, duration: 0.44, peak: 0.34 * d, click: 0.2 * d, pan: p }),
      noise(g, { bank: "brown", at: t, a: 0.005, h: 0.12, r: 0.46, peak: 0.28 * d, type: "lowpass", f0: 960, f1: 140, pan: p }),
      noise(g, { bank: "crackle", at: t + 0.02, a: 0.005, h: 0.1, r: 0.36, peak: 0.2 * d, type: "bandpass", f0: 2400, f1: 680, q: 1.0, pan: p })
    ),
    freezeSnap: (g, t, d, p) => elementAccent(g, t, "ICE", 1.2 * d, 1.05, p),
    shockArc: (g, t, d, p) => elementAccent(g, t, "THUNDER", 1.2 * d, 1.05, p),
    sleep: (g, t, d, p) => chord(g, { freqs: [659.3, 587.3, 493.9, 440], type: "sine", at: t, step: 0.085, r: 0.28, peak: 0.095 * d, pan: p }),
    poison: (g, t, d, p) => Math.max(
      tone(g, { type: "sine", f0: 230, f1: 440, at: t, a: 0.008, h: 0.03, r: 0.13, peak: 0.1 * d, pan: p }),
      tone(g, { type: "sine", f0: 320, f1: 590, at: t + 0.068, a: 0.008, h: 0.03, r: 0.13, peak: 0.09 * d, pan: p }),
      noise(g, { bank: "pink", at: t, a: 0.01, h: 0.05, r: 0.22, peak: 0.12 * d, type: "bandpass", f0: 1350, f1: 680, q: 2.4, pan: p })
    ),
    paralyze: (g, t, d, p) => Math.max(
      noise(g, { bank: "crackle", at: t, a: 0.001, h: 0.02, r: 0.09, peak: 0.17 * d, type: "highpass", f0: 2800, pan: p }),
      fmTone(g, { carrierType: "square", f0: 880, f1: 320, modRatio: 1.73, modIndex: 360, endModIndex: 40, at: t, a: 0.0015, h: 0.02, r: 0.09, peak: 0.11 * d, filter: { type: "bandpass", f0: 2100, q: 2.5 }, pan: p }),
      fmTone(g, { carrierType: "square", f0: 960, f1: 360, modRatio: 1.73, modIndex: 320, endModIndex: 40, at: t + 0.055, a: 0.0015, h: 0.02, r: 0.09, peak: 0.095 * d, filter: { type: "bandpass", f0: 2300, q: 2.5 }, pan: p })
    ),
    burn: (g, t, d, p) => elementAccent(g, t, "FIRE", 0.9 * d, 1.1, p),
    slow: (g, t, d, p) => tone(g, { type: "triangle", f0: 360, f1: 150, at: t, a: 0.01, h: 0.04, r: 0.18, peak: 0.1 * d, pan: p }),
    refused: (g, t, d, p) => Math.max(tone(g, { type: "triangle", f0: 230, f1: 170, at: t, a: 0.003, h: 0.025, r: 0.08, peak: 0.1 * d, pan: p }), tone(g, { type: "triangle", f0: 170, f1: 128, at: t + 0.055, a: 0.003, h: 0.025, r: 0.09, peak: 0.09 * d, pan: p }))
  };

  function playCue(kind, { pan = 0 } = {}) {
    const fn = CUES[kind];
    if (!fn) return false;
    const ok = admitVoice(`cue:${kind}`, MIN_GAP[kind] ?? 0.05, (graph, t, duck) => fn(graph, t, duck, pan));
    if (ok) stats.cues[kind] = (stats.cues[kind] ?? 0) + 1;
    return ok;
  }

  function playDropPick() {
    const tMs = now();
    dropStreak = tMs - lastDropAt < 950 ? Math.min(DROP_RATIOS.length - 1, dropStreak + 1) : 0;
    lastDropAt = tMs;
    const hz = 660 * DROP_RATIOS[dropStreak];
    const ok = admitVoice("cue:dropPick", MIN_GAP.dropPick, (graph, t, duck) => Math.max(
      tone(graph, { type: "sine", f0: hz, f1: hz * 1.33, at: t, a: 0.002, h: 0.015, r: 0.085, peak: 0.14 * duck }),
      tone(graph, { type: "triangle", f0: hz * 2, f1: hz * 2.5, at: t + 0.015, a: 0.002, h: 0.01, r: 0.06, peak: 0.06 * duck })
    ));
    if (ok) stats.cues.dropPick = (stats.cues.dropPick ?? 0) + 1;
    return ok;
  }

  // Held Data Arena laser voice routed through the mastered mix!
  let laser = null;
  function setLaser(firing, heatShare = 0) {
    const graph = ensureGraph();
    if (!graph) return;
    if (!firing && !laser) return;
    if (!laser) {
      const c = graph.context;
      const a = c.createOscillator(), b = c.createOscillator(), filter = c.createBiquadFilter(), gain = c.createGain();
      a.type = "sawtooth"; b.type = "square"; a.frequency.value = 180; b.frequency.value = 181.8;
      filter.type = "lowpass"; filter.frequency.value = 1200; filter.Q.value = 4;
      gain.gain.value = 0.0001;
      a.connect(filter); b.connect(filter); filter.connect(gain); gain.connect(graph.mix);
      a.start(); b.start();
      laser = { a, b, filter, gain };
    }
    const t = graph.context.currentTime;
    laser.gain.gain.setTargetAtTime(firing ? 0.068 : 0.0001, t, firing ? 0.02 : 0.05);
    laser.a.frequency.setTargetAtTime(160 + heatShare * 220, t, 0.05);
    laser.b.frequency.setTargetAtTime(161.8 + heatShare * 226, t, 0.05);
    laser.filter.frequency.setTargetAtTime(900 + heatShare * 2600, t, 0.05);
  }

  function suspend() {
    if (laser && ctx) laser.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.02);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    voiceEnds.length = 0;
    lastByKey.clear();
    try { laser?.a.stop(); laser?.b.stop(); } catch { /* already stopped */ }
    laser = null;
    teardownGraph();
  }

  // Eagerly check availability when bus is passed (matches existing Data Arena contract)
  const initialAvailable = Boolean(bus ? ensureGraph() : true);

  return Object.freeze({
    available: initialAvailable,
    play: playCue,
    playCue,
    playWindup,
    playMove,
    playImpact,
    playDropPick,
    setLaser,
    suspend,
    getDiagnostics() {
      const active = ctx ? pruneVoices(ctx.currentTime) : 0;
      return Object.freeze({
        available: !disposed && Boolean(ctx || !bus),
        voices: active,
        played: stats.played,
        movesPlayed: stats.movesPlayed,
        impactsPlayed: stats.impactsPlayed,
        windupsPlayed: stats.windupsPlayed,
        throttled: stats.throttled,
        cues: Object.freeze({ ...stats.cues })
      });
    },
    dispose
  });
}
