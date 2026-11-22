// Data Arena -- original procedural sound, through the existing audio bus.
//
// Every sound is synthesised (oscillators and generated noise), so the mode
// ships no audio files. It plays through settings.audio's "sfx" category, so
// the player's master/sfx volume and mute apply. One-shots are throttled per
// kind and capped in concurrent voices; the laser is one held voice whose
// pitch follows heat. dispose() stops every node it created.
//
// V2 666-Move Parameterized SFX (2026-11-22):
//   playMove({ archetype, element, phase, ultimate, step, material })
//     combines an Archetype Action Layer (all 20 V2 archetypes / 11 3D engines)
//     with a 13-Element Timbre Layer so every move carries a distinct sonic identity.
//   playImpact({ amount, guarded, parry, guardBreak, clash, effectiveness, combo })
//     delivers tiered fighting-game hit-feel synchronized with hit-stop & flash.

const MIN_GAP = Object.freeze({
  hit: 0.055, kill: 0.05, dash: 0.08, perfect: 0.16, splash: 0.14, crack: 0.11, ignite: 0.22, surge: 0.18,
  warn: 0.45, cheer: 1.5, roar: 0.9, level: 0.3, overheat: 0.45, pickup: 0.05, block: 0.09, hurt: 0.1,
  burst: 0.16, slam: 0.2, ui: 0.05, capture: 0.35
});
const MAX_VOICES = 18;

const ELEMENT_ALIAS = Object.freeze({
  fire: "fire", frost: "ice", ice: "ice", water: "water",
  light: "light", earth: "earth", storm: "thunder", thunder: "thunder",
  wind: "wind", nature: "nature", shadow: "dark", dark: "dark",
  metal: "metal", toxic: "toxic", psychic: "psychic", physical: "neutral", neutral: "neutral"
});

const normEl = (el) => ELEMENT_ALIAS[String(el ?? "").toLowerCase()] ?? "neutral";

export function createDataArenaAudio({ bus }) {
  const output = bus?.output?.("sfx") ?? null;
  if (!output) {
    return Object.freeze({
      play() {},
      playMove() {},
      playImpact() {},
      setLaser() {},
      suspend() {},
      dispose() {},
      getDiagnostics() { return { available: false, voices: 0, played: 0, movesPlayed: 0, impactsPlayed: 0 }; },
      available: false
    });
  }
  const { context, destination } = output;
  const mix = context.createGain();
  mix.gain.value = 0.82;
  mix.connect(destination);
  const last = new Map();
  const voiceEnds = [];
  let offset = 0;
  let disposed = false;
  let played = 0, movesPlayed = 0, impactsPlayed = 0;

  function activeVoices(now) {
    for (let i = voiceEnds.length - 1; i >= 0; i--) if (voiceEnds[i] <= now) voiceEnds.splice(i, 1);
    return voiceEnds.length;
  }

  const noise = (() => {
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * 1.5)), context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff) - 1;
    }
    return buffer;
  })();

  function envelope(gain, at, attack, hold, release, peak) {
    const p = Math.max(0.0002, peak);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(p, at + Math.max(0.001, attack));
    gain.gain.setValueAtTime(p, at + Math.max(0.001, attack) + Math.max(0, hold));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.001, attack) + Math.max(0, hold) + Math.max(0.005, release));
    return at + Math.max(0.001, attack) + Math.max(0, hold) + Math.max(0.005, release);
  }
  function voice(build) {
    if (disposed) return false;
    const now = context.currentTime;
    if (activeVoices(now) >= MAX_VOICES) return false;
    const end = build(now);
    voiceEnds.push(Math.max(now + 0.04, end));
    return true;
  }
  function tone(type, frequency, toFrequency, at, attack, hold, release, peak, filter = null) {
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), at);
    const dur = Math.max(0.001, attack) + Math.max(0, hold) + Math.max(0.005, release);
    if (toFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, toFrequency), at + dur);
    let node = osc;
    if (filter) {
      const f = context.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(Math.max(40, filter.frequency), at);
      if (filter.toFrequency) f.frequency.exponentialRampToValueAtTime(Math.max(40, filter.toFrequency), at + dur);
      f.Q.value = filter.q ?? 1;
      osc.connect(f);
      node = f;
    }
    node.connect(gain);
    gain.connect(mix);
    const end = envelope(gain, at, attack, hold, release, peak);
    osc.start(at);
    osc.stop(end + 0.02);
    return end;
  }
  function hiss(at, attack, hold, release, peak, { type = "bandpass", from = 1200, to = null, q = 1, rate = 1 } = {}) {
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = noise;
    source.playbackRate.value = rate;
    filter.type = type;
    filter.frequency.setValueAtTime(Math.max(40, from), at);
    filter.Q.value = q;
    const dur = Math.max(0.001, attack) + Math.max(0, hold) + Math.max(0.005, release);
    if (to) filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(mix);
    const end = envelope(gain, at, attack, hold, release, peak);
    source.start(at, (offset = (offset + 0.37) % 1) * 0.5);
    source.stop(end + 0.02);
    return end;
  }

  // Layer B: subtle 13-element harmonic/noise accent layered onto any archetype!
  function playElementTimbre(t, el, gainScale = 1) {
    const g = 0.075 * gainScale;
    switch (el) {
      case "fire":
        return Math.max(
          hiss(t, 0.006, 0.05, 0.18, g * 1.4, { type: "lowpass", from: 820, to: 2500, q: 1.1 }),
          tone("sawtooth", 118, 52, t, 0.004, 0.025, 0.14, g * 0.8, { type: "lowpass", frequency: 420 })
        );
      case "water":
        return Math.max(
          hiss(t, 0.008, 0.04, 0.22, g * 1.35, { type: "bandpass", from: 1600, to: 520, q: 1.4 }),
          tone("sine", 340, 720, t, 0.004, 0.015, 0.09, g * 0.85)
        );
      case "ice":
        return Math.max(
          tone("sine", 1960, 2637, t, 0.002, 0.015, 0.16, g * 0.85),
          tone("triangle", 2960, 2217, t + 0.025, 0.002, 0.01, 0.14, g * 0.65),
          hiss(t, 0.004, 0.03, 0.14, g * 0.8, { type: "highpass", from: 4200, to: 2100 })
        );
      case "thunder":
        return Math.max(
          tone("sawtooth", 1480, 320, t, 0.001, 0.012, 0.09, g * 0.85, { type: "bandpass", frequency: 1900, q: 2.2 }),
          hiss(t, 0.001, 0.015, 0.12, g * 1.3, { type: "highpass", from: 3200, to: 1400 }),
          hiss(t + 0.035, 0.001, 0.01, 0.08, g * 1.1, { type: "bandpass", from: 2600, q: 2.6 })
        );
      case "wind":
        return hiss(t, 0.015, 0.06, 0.22, g * 1.35, { type: "bandpass", from: 620, to: 2100, q: 3.4 });
      case "earth":
        return Math.max(
          tone("triangle", 115, 42, t, 0.004, 0.04, 0.18, g * 1.45),
          hiss(t, 0.004, 0.04, 0.18, g * 1.2, { type: "lowpass", from: 760, to: 240 })
        );
      case "nature":
        return Math.max(
          hiss(t, 0.003, 0.03, 0.15, g * 1.25, { type: "bandpass", from: 2100, to: 1100, q: 1.6 }),
          tone("triangle", 540, 820, t, 0.003, 0.02, 0.1, g * 0.65)
        );
      case "light":
        return Math.max(
          tone("sine", 1046, 1568, t, 0.004, 0.03, 0.18, g * 0.9),
          tone("triangle", 1568, 2093, t + 0.03, 0.004, 0.02, 0.18, g * 0.65)
        );
      case "dark":
        return Math.max(
          tone("sawtooth", 210, 102, t, 0.008, 0.05, 0.22, g * 0.85, { type: "lowpass", frequency: 720 }),
          tone("triangle", 297, 144, t, 0.008, 0.04, 0.2, g * 0.65)
        );
      case "metal":
        return Math.max(
          tone("square", 980, 740, t, 0.001, 0.015, 0.16, g * 0.75, { type: "bandpass", frequency: 1850, q: 4.5 }),
          tone("sine", 2420, 1980, t, 0.001, 0.01, 0.18, g * 0.65)
        );
      case "toxic":
        return Math.max(
          tone("sawtooth", 280, 620, t, 0.006, 0.025, 0.14, g * 0.75, { type: "bandpass", frequency: 760, toFrequency: 1850, q: 4.2 }),
          hiss(t, 0.005, 0.03, 0.15, g * 0.9, { type: "bandpass", from: 1400, to: 680, q: 2.2 })
        );
      case "psychic":
        return Math.max(
          tone("sine", 540, 1080, t, 0.008, 0.04, 0.18, g * 0.8),
          tone("sine", 810, 420, t + 0.025, 0.008, 0.04, 0.18, g * 0.65)
        );
      default:
        return tone("triangle", 220, 95, t, 0.002, 0.015, 0.09, g * 0.9);
    }
  }

  // Layer A: Archetype Action Synthesis covering all 20 V2 archetypes & 11 3D engines!
  function buildMoveSound(t, { archetype = "VOLLEY_BARRAGE", element = "neutral", phase = "release", ultimate = false, step = 0, material = null }) {
    const el = normEl(element);
    const scale = ultimate ? 1.22 : 1.0;
    const pitchBoost = 1 + Math.min(5, Math.max(0, step)) * 0.11;
    let end = t + 0.12;

    if (ultimate) {
      end = Math.max(end, tone("sine", 82, 34, t, 0.006, 0.09, 0.34, 0.16));
    }

    // Material-specific Organic Shield Wall emergence (Move #3: 6 distinct materials)
    if (phase === "wall" || (archetype === "PROTECT_COUNTER" && material)) {
      const mat = String(material ?? "").toUpperCase();
      if (mat === "ICE") {
        end = Math.max(end, tone("sine", 1568, 2349, t, 0.003, 0.03, 0.24, 0.1),
          tone("triangle", 2093, 3136, t + 0.04, 0.003, 0.025, 0.22, 0.08),
          hiss(t, 0.004, 0.03, 0.18, 0.11, { type: "highpass", from: 3800, to: 1800 }));
      } else if (mat === "WOOD") {
        end = Math.max(end, tone("triangle", 190, 98, t, 0.003, 0.03, 0.14, 0.16),
          tone("triangle", 280, 145, t + 0.045, 0.002, 0.02, 0.1, 0.12),
          hiss(t + 0.02, 0.01, 0.05, 0.22, 0.11, { type: "bandpass", from: 1900, to: 900, q: 1.4 }));
      } else if (mat === "BASALT") {
        end = Math.max(end, tone("sawtooth", 96, 38, t, 0.006, 0.08, 0.26, 0.14, { type: "lowpass", frequency: 340 }),
          hiss(t, 0.008, 0.08, 0.28, 0.14, { type: "bandpass", from: 600, to: 2100, q: 1.1 }));
      } else if (mat === "CRYSTAL") {
        end = Math.max(end, tone("sine", 1175, 1760, t, 0.003, 0.04, 0.28, 0.095),
          tone("sine", 1760, 2637, t + 0.035, 0.003, 0.04, 0.26, 0.075));
      } else if (mat === "METAL") {
        end = Math.max(end, tone("square", 620, 410, t, 0.002, 0.02, 0.22, 0.11, { type: "bandpass", frequency: 1450, q: 4.5 }),
          tone("sine", 1840, 1420, t, 0.002, 0.02, 0.24, 0.085),
          tone("sine", 110, 48, t, 0.003, 0.04, 0.16, 0.14));
      } else {
        // STONE craggy boulders erupting
        end = Math.max(end, tone("triangle", 112, 38, t, 0.005, 0.07, 0.24, 0.18),
          hiss(t, 0.006, 0.06, 0.26, 0.16, { type: "lowpass", from: 880, to: 220 }));
      }
      return end;
    }

    switch (archetype) {
      case "DRAG_WAVE": {
        // Move #1: 3D Curling Ocean Wave / Surf Rush
        end = Math.max(end,
          hiss(t, 0.02, 0.12, 0.36, 0.18 * scale, { type: "bandpass", from: 240, to: 1180, q: 1.1 }),
          hiss(t + 0.06, 0.015, 0.07, 0.3, 0.13 * scale, { type: "highpass", from: 2600, to: 900 }),
          tone("sine", 150, 72, t, 0.01, 0.08, 0.24, 0.11 * scale)
        );
        break;
      }
      case "VORTEX_PULL": {
        // Move #2: 3D Volumetric Tornado / Storm Vortex
        end = Math.max(end,
          hiss(t, 0.03, 0.18, 0.42, 0.17 * scale, { type: "bandpass", from: 320, to: 1320, q: 4.2 }),
          hiss(t + 0.08, 0.04, 0.16, 0.34, 0.12 * scale, { type: "bandpass", from: 1120, to: 420, q: 3.6 }),
          playElementTimbre(t + 0.02, el, 0.85 * scale)
        );
        break;
      }
      case "BURROW_AMBUSH": {
        // Move #4A: Subterranean Tunnel Dig -> Eruption Launch!
        if (phase === "start") {
          for (let i = 0; i < 3; i++) {
            end = Math.max(end, hiss(t + i * 0.055, 0.003, 0.02, 0.07, 0.16, { type: "bandpass", from: 680 - i * 110, to: 220, q: 1.3 }));
          }
          end = Math.max(end, tone("triangle", 175, 52, t, 0.006, 0.08, 0.18, 0.15));
        } else {
          end = Math.max(end,
            tone("sine", 132, 28, t, 0.004, 0.09, 0.32, 0.24 * scale),
            hiss(t, 0.004, 0.06, 0.28, 0.2 * scale, { type: "lowpass", from: 1200, to: 260 }),
            playElementTimbre(t + 0.015, el, 0.9 * scale)
          );
        }
        break;
      }
      case "GROUND_SPIKES": {
        // Move #4B: Sequential Traveling Ground Spires (escalating pitch per spire!)
        end = Math.max(end,
          tone("triangle", 155 * pitchBoost, 52 * pitchBoost, t, 0.002, 0.02, 0.11, 0.16 * scale),
          hiss(t, 0.002, 0.02, 0.12, 0.14 * scale, { type: "bandpass", from: 1400 * pitchBoost, to: 520, q: 1.8 }),
          playElementTimbre(t, el, 0.65 * scale)
        );
        break;
      }
      case "SHOCKWAVE_RING":
      case "LEAP_SLAM":
      case "GRAB_SLAM":
      case "GUARD_BREAK_SLAM": {
        // Move #5: Seismic Crater Shockwave / Heavy Slam
        end = Math.max(end,
          tone("sine", 138, 28, t, 0.004, 0.09, 0.34, 0.24 * scale),
          tone("triangle", 220, 56, t, 0.003, 0.04, 0.2, 0.13 * scale),
          hiss(t, 0.004, 0.06, 0.3, 0.18 * scale, { type: "lowpass", from: 980, to: 210 }),
          playElementTimbre(t + 0.02, el, 0.85 * scale)
        );
        break;
      }
      case "STREAM_BEAM": {
        // Move #6: Cylindrical Spiral Energy Cannon
        if (phase === "cast") {
          end = Math.max(end, tone("sine", 240, 1080, t, 0.02, 0.08, 0.14, 0.095));
        } else {
          end = Math.max(end,
            tone("sawtooth", 310, 165, t, 0.006, 0.12, 0.26, 0.11 * scale, { type: "bandpass", frequency: 1450, toFrequency: 560, q: 1.8 }),
            tone("triangle", 980, 440, t, 0.004, 0.08, 0.22, 0.09 * scale),
            playElementTimbre(t, el, 1.0 * scale)
          );
        }
        break;
      }
      case "METEOR_RAIN": {
        // Move #7: Falling Flaming Meteor OR Storm-Cloud Thunder Pillar
        const isThunder = el === "thunder" || el === "light";
        if (phase === "drop") {
          if (isThunder) {
            end = Math.max(end,
              hiss(t, 0.01, 0.08, 0.18, 0.11, { type: "bandpass", from: 2800, to: 4200, q: 3.5 }),
              tone("sawtooth", 420, 1280, t, 0.02, 0.06, 0.14, 0.065, { type: "highpass", frequency: 900 })
            );
          } else {
            end = Math.max(end,
              tone("sine", 1680, 290, t, 0.015, 0.08, 0.26, 0.095),
              hiss(t, 0.02, 0.08, 0.24, 0.12, { type: "bandpass", from: 1900, to: 480, q: 2.0 })
            );
          }
        } else if (isThunder) {
          end = Math.max(end,
            hiss(t, 0.002, 0.025, 0.14, 0.22 * scale, { type: "highpass", from: 2600, to: 800 }),
            tone("sawtooth", 190, 44, t + 0.02, 0.005, 0.12, 0.38, 0.16 * scale, { type: "lowpass", frequency: 420 }),
            hiss(t + 0.03, 0.01, 0.14, 0.42, 0.17 * scale, { type: "lowpass", from: 760, to: 180 })
          );
        } else {
          end = Math.max(end,
            tone("sine", 118, 26, t, 0.004, 0.11, 0.38, 0.25 * scale),
            hiss(t, 0.005, 0.09, 0.36, 0.2 * scale, { type: "lowpass", from: 1350, to: 240 }),
            playElementTimbre(t + 0.015, el, 1.0 * scale)
          );
        }
        break;
      }
      case "TELEKINESIS_SLAM": {
        // Move #8: Gyroscopic Telekinesis Field / Hexagonal Energy Cage
        if (phase === "lift" || phase === "cage") {
          end = Math.max(end,
            tone("sine", 480, 960, t, 0.015, 0.09, 0.24, 0.095 * scale),
            tone("triangle", 720, 540, t + 0.04, 0.015, 0.08, 0.22, 0.075 * scale),
            playElementTimbre(t, el, 0.8 * scale)
          );
        } else {
          end = Math.max(end,
            tone("sine", 150, 32, t, 0.004, 0.08, 0.3, 0.22 * scale),
            tone("sine", 860, 220, t, 0.003, 0.04, 0.18, 0.09 * scale)
          );
        }
        break;
      }
      case "FLURRY_COMBO":
      case "MULTI_DASH":
      case "UTURN_STRIKE": {
        // Move #9: Crescent Blade / Triple Claws / Supersonic Dash Cone
        end = Math.max(end,
          hiss(t, 0.002, 0.018, 0.12, 0.16 * scale, { type: "bandpass", from: 3200 * pitchBoost, to: 680, q: 2.1 }),
          tone("triangle", 260 * pitchBoost, 86, t, 0.002, 0.014, 0.09, 0.11 * scale),
          playElementTimbre(t, el, 0.72 * scale)
        );
        break;
      }
      case "SHADOW_BACKSTAB": {
        if (phase === "vanish") {
          end = Math.max(end,
            hiss(t, 0.006, 0.03, 0.16, 0.14, { type: "bandpass", from: 360, to: 2400, q: 2.8 }),
            tone("sine", 280, 980, t, 0.005, 0.03, 0.14, 0.08)
          );
        } else {
          end = Math.max(end,
            hiss(t, 0.002, 0.02, 0.16, 0.19 * scale, { type: "bandpass", from: 3800, to: 720, q: 2.0 }),
            tone("sawtooth", 440, 110, t, 0.002, 0.02, 0.15, 0.13 * scale, { type: "lowpass", frequency: 1600 }),
            playElementTimbre(t, el, 0.85 * scale)
          );
        }
        break;
      }
      case "SELF_BUFF": {
        // Move #11A: Rising Spiral Buff Pillar
        const notes = [440, 554, 659, 880];
        for (let i = 0; i < notes.length; i++) {
          end = Math.max(end, tone("triangle", notes[i], notes[i] * 1.03, t + i * 0.048, 0.005, 0.03, 0.16, 0.085));
        }
        break;
      }
      case "RECOVERY_SUPPORT": {
        // Move #11B: Heal Sanctuary Pillar
        const notes = [523, 659, 784, 1046, 1318];
        for (let i = 0; i < notes.length; i++) {
          end = Math.max(end, tone("sine", notes[i], null, t + i * 0.055, 0.006, 0.04, 0.22, 0.085));
        }
        break;
      }
      case "PROTECT_COUNTER": {
        // Counter Riposte / Protective Aura
        end = Math.max(end,
          tone("sine", 784, 1175, t, 0.004, 0.04, 0.18, 0.1),
          tone("triangle", 1175, 1568, t + 0.03, 0.004, 0.03, 0.16, 0.075)
        );
        break;
      }
      case "HOMING_ORB":
      case "VOLLEY_BARRAGE":
      default: {
        // Move #10: Hovering Orbs / Crystal Darts / Elemental Bolts
        end = Math.max(end,
          tone("triangle", 680, 290, t, 0.003, 0.02, 0.11, 0.085 * scale),
          playElementTimbre(t, el, 1.0 * scale)
        );
        break;
      }
    }
    return end;
  }

  // PB-Ranked Fighting-Game Impact Audio (synchronized with tiered hit-stop & flash)
  function buildImpactSound(t, { amount = 10, guarded = false, parry = false, guardBreak = false, clash = false, effectiveness = null, combo = 1 }) {
    if (parry) {
      return Math.max(
        tone("sine", 1175, 1190, t, 0.002, 0.04, 0.34, 0.13),
        tone("triangle", 1760, 1790, t, 0.002, 0.03, 0.3, 0.1),
        tone("sine", 2960, 2600, t + 0.012, 0.002, 0.02, 0.24, 0.075),
        hiss(t, 0.001, 0.015, 0.1, 0.11, { type: "highpass", from: 3600 })
      );
    }
    if (guardBreak) {
      return Math.max(
        tone("sine", 130, 34, t, 0.003, 0.08, 0.28, 0.22),
        hiss(t, 0.001, 0.02, 0.16, 0.18, { type: "highpass", from: 3200, to: 1100 }),
        tone("square", 2400, 920, t + 0.015, 0.001, 0.015, 0.12, 0.08, { type: "bandpass", frequency: 2200, q: 3 }),
        tone("sine", 1850, 740, t + 0.04, 0.001, 0.015, 0.14, 0.075)
      );
    }
    if (clash) {
      return Math.max(
        tone("square", 1520, 1180, t, 0.001, 0.025, 0.22, 0.095, { type: "bandpass", frequency: 2100, q: 4 }),
        tone("sine", 2280, 1960, t, 0.001, 0.03, 0.26, 0.09),
        hiss(t, 0.002, 0.025, 0.14, 0.15, { type: "bandpass", from: 3400, to: 1500, q: 1.8 })
      );
    }
    if (guarded) {
      return Math.max(
        tone("triangle", 320, 145, t, 0.002, 0.02, 0.09, 0.13),
        tone("square", 540, 380, t, 0.001, 0.012, 0.06, 0.055, { type: "bandpass", frequency: 920, q: 3.2 })
      );
    }
    const comboLift = 1 + Math.min(6, Math.max(0, combo - 1)) * 0.045;
    let end;
    if (amount >= 28) {
      // Heavy fighting-game hitstop crunch!
      end = Math.max(
        tone("sine", 138, 30, t, 0.003, 0.065, 0.24, 0.24),
        tone("triangle", 320 * comboLift, 78, t, 0.002, 0.025, 0.14, 0.15),
        hiss(t, 0.001, 0.018, 0.13, 0.19, { type: "bandpass", from: 2800, to: 650, q: 1.4 })
      );
    } else if (amount >= 14) {
      // Medium crisp punch
      end = Math.max(
        tone("sine", 185, 56, t, 0.002, 0.03, 0.13, 0.16),
        tone("triangle", 460 * comboLift, 140, t, 0.002, 0.015, 0.08, 0.1),
        hiss(t, 0.001, 0.012, 0.08, 0.12, { type: "bandpass", from: 2200, to: 800, q: 1.4 })
      );
    } else {
      // Light arcade smack
      end = Math.max(
        tone("triangle", 420 * comboLift, 150, t, 0.002, 0.012, 0.065, 0.09),
        hiss(t, 0.001, 0.008, 0.05, 0.08, { type: "highpass", from: 2400 })
      );
    }
    if (effectiveness === "super") {
      end = Math.max(end, tone("sine", 1318, 1760, t + 0.012, 0.002, 0.02, 0.13, 0.085));
    } else if (effectiveness === "resist") {
      end = Math.max(end, tone("triangle", 210, 128, t + 0.01, 0.002, 0.02, 0.09, 0.075));
    }
    return end;
  }

  const SOUNDS = {
    claw: t => Math.max(hiss(t, .002, .015, .09, .12, { from: 2300, to: 700 }), tone('triangle', 150, 65, t, .002, .01, .08, .10)),
    flame: t => Math.max(hiss(t, .005, .07, .19, .13, { type: 'lowpass', from: 700, to: 2600 }), tone('sine', 130, 55, t, .005, .03, .15, .08)),
    ray: t => Math.max(tone('triangle', 1550, 620, t, .003, .025, .12, .07), tone('sine', 2200, 1000, t, .004, .02, .10, .04)),
    frost: t => Math.max(hiss(t, .008, .06, .2, .07, { type: 'highpass', from: 4500, to: 1600 }), tone('sine', 1800, 2500, t, .002, .01, .13, .045)),
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
    capture: (t) => [659, 880, 1318].reduce((end, f, i) => Math.max(end, tone("sine", f, null, t + i * 0.09, 0.005, 0.08, 0.25, 0.1)), t),
    shatter: (t) => Math.max(
      tone("sine", 145, 34, t, 0.003, 0.06, 0.28, 0.24),
      hiss(t, 0.003, 0.05, 0.34, 0.22, { type: "bandpass", from: 2800, to: 720, q: 1.4 }),
      tone("sine", 1920, 1180, t + 0.03, 0.002, 0.03, 0.22, 0.1),
      tone("sine", 2480, 1520, t + 0.07, 0.002, 0.03, 0.2, 0.08)
    ),
    combo: (t) => [523, 784, 1046, 1568].reduce((end, f, i) => Math.max(end, tone("triangle", f, f * 1.04, t + i * 0.045, 0.004, 0.05, 0.2, 0.11)), t),
    igniteBoom: (t) => Math.max(
      tone("sine", 118, 26, t, 0.004, 0.12, 0.42, 0.28),
      tone("sawtooth", 180, 52, t, 0.006, 0.1, 0.34, 0.15, { type: "lowpass", frequency: 480 }),
      hiss(t, 0.005, 0.12, 0.44, 0.24, { type: "bandpass", from: 920, to: 280, q: 0.9 })
    ),
    freezeSnap: (t) => Math.max(
      tone("sine", 1568, 2637, t, 0.002, 0.04, 0.24, 0.11),
      tone("triangle", 2093, 3136, t + 0.035, 0.002, 0.04, 0.22, 0.085),
      hiss(t, 0.002, 0.03, 0.2, 0.14, { type: "highpass", from: 3600 })
    ),
    shockArc: (t) => Math.max(
      tone("sawtooth", 680, 1480, t, 0.002, 0.04, 0.18, 0.12, { type: "bandpass", frequency: 1900, q: 3.2 }),
      tone("square", 1180, 420, t + 0.04, 0.002, 0.03, 0.14, 0.09, { type: "bandpass", frequency: 2400, q: 2.5 }),
      hiss(t, 0.002, 0.04, 0.2, 0.16, { type: "highpass", from: 3200 })
    ),
    sleep: (t) => [659, 587, 494, 440].reduce((end, f, i) => Math.max(end, tone("sine", f, f * 0.98, t + i * 0.085, 0.015, 0.06, 0.24, 0.085)), t),
    poison: (t) => Math.max(
      tone("sine", 240, 420, t, 0.008, 0.04, 0.14, 0.09),
      tone("sine", 320, 560, t + 0.07, 0.008, 0.04, 0.14, 0.08),
      hiss(t, 0.01, 0.06, 0.22, 0.11, { type: "bandpass", from: 1300, to: 700, q: 2.2 })
    ),
    paralyze: (t) => Math.max(
      tone("square", 860, 320, t, 0.002, 0.025, 0.1, 0.1, { type: "bandpass", frequency: 2100, q: 3.0 }),
      tone("square", 940, 360, t + 0.055, 0.002, 0.025, 0.1, 0.09, { type: "bandpass", frequency: 2300, q: 3.0 })
    ),
    refused: (t) => Math.max(tone("triangle", 220, 165, t, 0.003, 0.03, 0.09, 0.09), tone("triangle", 165, 130, t + 0.06, 0.003, 0.03, 0.1, 0.08))
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
      if (voice(build)) played++;
    },
    playMove(spec = {}) {
      if (disposed || context.state === "closed") return;
      const key = `mv:${spec.archetype ?? "default"}:${spec.phase ?? "release"}:${spec.material ?? ""}`;
      const gap = spec.archetype === "GROUND_SPIKES" || spec.archetype === "FLURRY_COMBO" ? 0.045 : 0.085;
      const now = context.currentTime;
      if (now - (last.get(key) ?? -10) < gap) return;
      last.set(key, now);
      if (voice((t) => buildMoveSound(t, spec))) { played++; movesPlayed++; }
    },
    playImpact(spec = {}) {
      if (disposed || context.state === "closed") return;
      const key = spec.parry ? "imp:parry" : spec.guardBreak ? "imp:gb" : spec.clash ? "imp:clash" : spec.guarded ? "imp:guard" : "imp:hit";
      const gap = spec.parry || spec.guardBreak || spec.clash ? 0.08 : 0.05;
      const now = context.currentTime;
      if (now - (last.get(key) ?? -10) < gap) return;
      last.set(key, now);
      if (voice((t) => buildImpactSound(t, spec))) { played++; impactsPlayed++; }
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
    getDiagnostics() { return { available: true, voices: activeVoices(context.currentTime), played, movesPlayed, impactsPlayed }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      voiceEnds.length = 0;
      try { laser?.a.stop(); laser?.b.stop(); } catch { /* already stopped */ }
      try { mix.disconnect(); } catch { /* already disconnected */ }
      laser = null;
    }
  });
}
