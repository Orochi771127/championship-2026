// Synthesized cues for the important-highlight template.
//
// Every sound is made here from oscillators and a short noise buffer: no
// sample files, nothing decoded from the original. One small graph per run.
// If the browser has not allowed audio yet (no user gesture on this page),
// the cues are silent rather than queued.
//
// With `output` (the product audio bus, 2026-09-29) the run plays through the
// bus's sfx category -- so master volume, sfx volume and mute apply -- and
// only disconnects on dispose; the bus owns the context. Without it the run
// keeps its own small context, closed on dispose.
// silence() stops every voice at once, with a 15 ms fade: a skipped or
// abandoned highlight never leaves its charge sweep or chord ringing.

const NOTES = Object.freeze({ C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, G6: 1567.98 });
const STEP_NOTES = Object.freeze([NOTES.C5, NOTES.E5, NOTES.G5]);

export function createHighlightAudio({ AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext, gain = 0.16, output = null } = {}) {
  if (!(gain > 0)) return null;
  const ownsContext = !output?.context;
  if (ownsContext && typeof AudioContextClass !== "function") return null;
  let context;
  if (ownsContext) { try { context = new AudioContextClass(); } catch { return null; } }
  else context = output.context;
  const master = context.createGain();
  master.gain.value = gain;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 6;
  master.connect(limiter);
  limiter.connect(ownsContext ? context.destination : output.destination);
  if (context.state === "suspended") void context.resume().catch(() => {});

  const voices = new Set();
  let played = 0, skipped = 0, disposed = false;
  const live = () => !disposed && context.state === "running";

  function track(node, stopAt) {
    voices.add(node);
    node.onended = () => { voices.delete(node); try { node.disconnect(); } catch { /* already gone */ } };
    node.start(context.currentTime);
    node.stop(stopAt);
  }

  function envelope(peak, attack, release, start = context.currentTime) {
    const amp = context.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
    amp.connect(master);
    return amp;
  }

  function tone({ type = "triangle", freq, to = null, duration = 0.2, peak = 0.5, attack = 0.012, filter = null }) {
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    const amp = envelope(peak, attack, Math.max(0.02, duration - attack), now);
    if (filter) { filter.connect(amp); osc.connect(filter); } else osc.connect(amp);
    track(osc, now + duration + 0.05);
  }

  let noiseBuffer = null;
  function noise({ duration = 0.3, peak = 0.4, cutoff = 1800 }) {
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, Math.round(context.sampleRate * 0.6), context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      // A fixed pseudo-random sequence: the cue sounds the same every run.
      let seed = 0x2f6b;
      for (let i = 0; i < data.length; i += 1) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[i] = (seed / 0x3fffffff) - 1; }
    }
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(cutoff, now);
    lowpass.frequency.exponentialRampToValueAtTime(220, now + duration);
    source.connect(lowpass);
    lowpass.connect(envelope(peak, 0.006, duration, now));
    track(source, now + duration + 0.05);
  }

  const cues = {
    // PREPARE: a low swell that settles the room.
    prepare(ms = 420) { tone({ type: "sine", freq: 110, to: 98, duration: Math.max(0.25, ms / 1000 + 0.3), peak: 0.32, attack: ms / 1000 * 0.8 }); },
    // BUILD: one rising note per stair mark.
    step(index = 0) { tone({ type: "triangle", freq: STEP_NOTES[Math.min(STEP_NOTES.length - 1, Math.max(0, index))], duration: 0.22, peak: 0.42 }); },
    // CHARGE: a filtered saw sweeping up for exactly the charge time.
    charge(ms = 800) {
      const seconds = ms / 1000;
      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.Q.value = 6;
      lowpass.frequency.setValueAtTime(260, context.currentTime);
      lowpass.frequency.exponentialRampToValueAtTime(2400, context.currentTime + seconds);
      tone({ type: "sawtooth", freq: 180, to: 720, duration: seconds, peak: 0.22, attack: seconds * 0.85, filter: lowpass });
      tone({ type: "sine", freq: 220, to: 880, duration: seconds, peak: 0.18, attack: seconds * 0.9 });
    },
    // BURST: a bright chord over a noise hit.
    burst() {
      noise({ duration: 0.45, peak: 0.5, cutoff: 5200 });
      for (const [freq, peak] of [[NOTES.C5, 0.34], [NOTES.E5, 0.28], [NOTES.G5, 0.26], [NOTES.C6, 0.2]]) {
        tone({ type: "triangle", freq, duration: 0.95, peak, attack: 0.008 });
      }
    },
    // REVEAL: a short tick per counted step, and the landing chime at the end.
    tick() { tone({ type: "square", freq: 1320, duration: 0.035, peak: 0.08, attack: 0.002 }); },
    settle() {
      tone({ type: "sine", freq: NOTES.C6, duration: 0.5, peak: 0.3 });
      tone({ type: "sine", freq: NOTES.G6, duration: 0.7, peak: 0.22 });
    }
  };

  let silenced = 0;
  function silence() {
    if (!voices.size) return 0;
    const now = context.currentTime;
    const count = voices.size;
    try {
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.015);
    } catch { /* a closed context has nothing left to fade */ }
    for (const voice of voices) { try { voice.stop(now + 0.02); } catch { /* already stopped */ } }
    silenced += count;
    return count;
  }

  return Object.freeze({
    cue(name, argument) {
      if (!live() || typeof cues[name] !== "function") { skipped += 1; return false; }
      try { cues[name](argument); played += 1; return true; } catch { skipped += 1; return false; }
    },
    /** Stop everything now (skip, leave, a settings change). Later cues still play. */
    silence() {
      const stopped = silence();
      // Cues after a skip (the landing chime) start from full level again.
      try { master.gain.setValueAtTime(gain, context.currentTime + 0.03); } catch { /* closed */ }
      return stopped;
    },
    stats() { return Object.freeze({ state: context.state, played, skipped, voices: voices.size, silenced, shared: !ownsContext }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      silence();
      for (const voice of voices) { try { voice.stop(); } catch { /* already stopped */ } }
      voices.clear();
      try { master.disconnect(); limiter.disconnect(); } catch { /* already gone */ }
      if (ownsContext) void context.close().catch(() => {});
    }
  });
}
