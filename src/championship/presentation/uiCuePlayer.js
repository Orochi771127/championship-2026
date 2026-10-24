import { effectiveGain } from './audioBus.js';

// Product-authored UI feedback, independent of Battle/Arena/ceremony banks.
// One oscillator per cue, with a short attack/release and no audio files.
export const UI_CUES = Object.freeze({
  select: Object.freeze({ type: 'sine', from: 739.99, to: 987.77, seconds: .045, peak: .10 }),
  open: Object.freeze({ type: 'triangle', from: 523.25, to: 783.99, seconds: .085, peak: .09 }),
  back: Object.freeze({ type: 'sine', from: 783.99, to: 523.25, seconds: .075, peak: .10 })
});
export const UI_CUE_THROTTLE_MS = 80;

/** Uses the application's existing audio bus; never constructs a context.
 * Only trusted click events (including native keyboard button activation)
 * qualify. Cleanup, tutorial calls, hover, focus and synthetic .click() do not.
 * The unbound reject candidate stays on the offline candidate branch only;
 * it is outside this release. Ordinary disabled controls remain silent.
 */
export function createUiCuePlayer({ audio, now = () => globalThis.performance.now() } = {}) {
  const handled = new WeakSet();
  let lastAt = -Infinity, active = null, disposed = false;

  function stop() {
    const voice = active;
    active = null;
    if (!voice) return;
    try { voice.osc.stop(); } catch { /* already ended */ }
    voice.cleanup();
  }

  return Object.freeze({
    play(name, event) {
      const cue = Object.hasOwn(UI_CUES, name) ? UI_CUES[name] : null;
      if (disposed || !cue || event?.type !== 'click' || event.isTrusted !== true || handled.has(event)) return false;
      handled.add(event);
      const at = now();
      if (at - lastAt < UI_CUE_THROTTLE_MS || effectiveGain(audio?.levels?.(), 'sfx') <= 0) return false;
      let output;
      try { output = audio?.output('sfx'); } catch { return false; }
      const context = output?.context;
      // No delayed playback or resume promise: a later gesture can play again.
      if (!context || context.state !== 'running' || !output.destination) return false;
      stop();
      let osc, amp;
      const cleanup = () => {
        try { osc?.disconnect(); } catch { /* unavailable graph */ }
        try { amp?.disconnect(); } catch { /* unavailable graph */ }
        if (active?.osc === osc) active = null;
      };
      try {
        const start = context.currentTime;
        osc = context.createOscillator();
        amp = context.createGain();
        osc.type = cue.type;
        osc.frequency.setValueAtTime(cue.from, start);
        osc.frequency.exponentialRampToValueAtTime(cue.to, start + cue.seconds * .7);
        amp.gain.setValueAtTime(.0001, start);
        amp.gain.exponentialRampToValueAtTime(cue.peak, start + .004);
        amp.gain.exponentialRampToValueAtTime(.0001, start + cue.seconds);
        amp.connect(output.destination);
        osc.connect(amp);
        osc.onended = cleanup;
        active = { osc, cleanup };
        osc.start(start);
        osc.stop(start + cue.seconds + .005);
        lastAt = at;
        return true;
      } catch {
        try { osc?.stop(); } catch { /* not started */ }
        cleanup();
        return false;
      }
    },
    stop,
    dispose() { if (disposed) return; disposed = true; stop(); }
  });
}
