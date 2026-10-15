// Synthesized cues for the ceremony layer (2026-10-15, PRODUCT_AUTHORED).
//
// Same rules as the important-highlight audio (highlight/highlightAudio.js):
// every sound is made here from oscillators and a short noise burst, nothing is
// decoded from a file, and it plays through the product audio bus's sfx
// category so mute, master and sfx volume apply. A cue that cannot play (no
// Web Audio, the context not yet allowed by a gesture, volume at zero) is
// silent rather than queued; nothing waits on a sound.
//
// One small graph per cue. Every voice is scheduled on the audio clock at
// start, so a cue needs no timer of its own, and stop() fades all of them in
// 15 ms (a skipped ceremony never leaves a chord ringing).

const N = Object.freeze({
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093
});

/**
 * Each cue is a list of voices: [startSeconds, type, freq, toFreq|null, duration, peak].
 * "noise" voices are a band-passed burst; the frequency is the band centre.
 * Kept short and in one key (C major) so cues that follow each other agree.
 */
export const CEREMONY_CUES = Object.freeze({
  // A gate opening: a rising air sweep under a soft open fifth.
  gate: Object.freeze([
    [0, "noise", 900, 3200, 0.55, 0.22],
    [0.08, "sine", N.C5, null, 0.7, 0.16],
    [0.08, "sine", N.G5, null, 0.7, 0.12],
    [0.42, "triangle", N.C6, null, 0.45, 0.14]
  ]),
  // The catch lands on the card: a quick bright arpeggio and a sparkle.
  capture: Object.freeze([
    [0, "triangle", N.C6, null, 0.16, 0.34],
    [0.07, "triangle", N.E6, null, 0.16, 0.32],
    [0.14, "triangle", N.G6, null, 0.34, 0.34],
    [0.14, "noise", 6000, 9000, 0.22, 0.08]
  ]),
  // The reveal of what came home: two chimes and a held third.
  reward: Object.freeze([
    [0, "sine", N.G5, null, 0.5, 0.26],
    [0.12, "sine", N.C6, null, 0.6, 0.26],
    [0.12, "triangle", N.E6, null, 0.9, 0.12],
    [0.3, "noise", 5200, 8000, 0.3, 0.05]
  ]),
  // A title won: a short fanfare, a triad on a held octave.
  medal: Object.freeze([
    [0, "sawtooth", N.C5, null, 0.18, 0.12],
    [0.16, "sawtooth", N.E5, null, 0.18, 0.12],
    [0.32, "sawtooth", N.G5, null, 0.62, 0.13],
    [0.32, "triangle", N.C6, null, 1.1, 0.22],
    [0.32, "triangle", N.E6, null, 1.1, 0.12],
    [0.34, "noise", 4800, 8800, 0.5, 0.06]
  ]),
  // A new form: a swell that resolves on a bell.
  evolve: Object.freeze([
    [0, "sine", N.C5, N.C6, 0.6, 0.16],
    [0.55, "triangle", N.E6, null, 0.9, 0.24],
    [0.55, "sine", N.C7, null, 1.2, 0.08],
    [0.55, "noise", 5600, 8000, 0.35, 0.06]
  ]),
  // Battle opening: a low hit and an upward slide.
  versus: Object.freeze([
    [0, "noise", 300, 120, 0.3, 0.3],
    [0, "square", 130.81, 98, 0.32, 0.12],
    [0.18, "sawtooth", N.G5, N.D6, 0.26, 0.1]
  ])
});

/**
 * Play one cue through the bus output, or return null when it cannot.
 * @param {{context: AudioContext, destination: AudioNode}|null} output
 */
export function playCeremonyCue(name, output, { gain = 0.5 } = {}) {
  const voices = CEREMONY_CUES[name];
  const context = output?.context;
  if (!voices || !context || !output.destination || !(gain > 0)) return null;
  if (context.state !== "running") {
    // A gesture unlocks the shared context; this cue is not worth queueing.
    void context.resume?.().catch?.(() => {});
    return null;
  }
  const master = context.createGain();
  master.gain.value = gain;
  master.connect(output.destination);
  const nodes = new Set();
  const t0 = context.currentTime + 0.01;
  let end = t0;
  let tail = null;
  for (const [at, type, freq, to, duration, peak] of voices) {
    const start = t0 + at;
    const stop = start + duration;
    const latest = stop >= end;
    end = Math.max(end, stop);
    const amp = context.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.min(0.02, duration / 4));
    amp.gain.exponentialRampToValueAtTime(0.0001, stop);
    amp.connect(master);
    let source;
    if (type === "noise") {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      source = context.createBufferSource();
      source.buffer = buffer;
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 1.4;
      band.frequency.setValueAtTime(freq, start);
      if (to) band.frequency.exponentialRampToValueAtTime(to, stop);
      source.connect(band);
      band.connect(amp);
      nodes.add(band);
    } else {
      source = context.createOscillator();
      source.type = type;
      source.frequency.setValueAtTime(freq, start);
      if (to) source.frequency.exponentialRampToValueAtTime(to, stop);
      source.connect(amp);
    }
    if (latest) tail = source;
    nodes.add(source);
    nodes.add(amp);
    source.start(start);
    source.stop(stop + 0.02);
  }
  let stopped = false;
  const release = () => {
    for (const node of nodes) { try { node.disconnect(); } catch { /* already gone */ } }
    nodes.clear();
    try { master.disconnect(); } catch { /* already gone */ }
  };
  // The graph frees itself once the last voice is past; no timer is kept.
  tail.onended = () => { stopped = true; release(); };
  return Object.freeze({
    durationMs: Math.round((end - t0) * 1000),
    stop() {
      if (stopped) return;
      stopped = true;
      const now = context.currentTime;
      try { master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(0, now + 0.015); } catch { /* closed */ }
      for (const node of nodes) { if (typeof node.stop === "function") { try { node.stop(now + 0.02); } catch { /* not started or done */ } } }
      // Disconnect after the fade, on the audio clock's terms.
      tail.onended = release;
    }
  });
}
