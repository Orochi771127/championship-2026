// One shared Web Audio graph: sources -> sfx/music category -> master -> destination.
// Original music uses two streaming media sources, with per-cue headroom before its category.
export const AUDIO_CATEGORIES = Object.freeze(["sfx", "music"]);
const RAMP_SECONDS = 0.03;

export function effectiveGain({ muted = false, masterVolume = 100, sfxVolume = 100, musicVolume = 100 } = {}, category = "sfx") {
  if (muted) return 0;
  const categoryVolume = category === "sfx" ? sfxVolume : category === "music" ? musicVolume : 100;
  return Math.max(0, Math.min(1, (masterVolume / 100) * (categoryVolume / 100)));
}

export function createAudioBus({
  AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext,
  eventTarget = globalThis.document,
  levels: initial = {}
} = {}) {
  let levels = { muted: false, masterVolume: 100, sfxVolume: 100, musicVolume: 100, ...initial };
  let context = null;
  let master = null;
  const categories = new Map();
  let unlockInstalled = false;
  let previewVoice = null;
  let previews = 0;

  const masterLevel = () => (levels.muted ? 0 : Math.max(0, Math.min(1, levels.masterVolume / 100)));
  const categoryLevel = (name) => Math.max(0, Math.min(1, (name === "sfx" ? levels.sfxVolume : name === "music" ? levels.musicVolume : 100) / 100));

  function resume() {
    if (context?.state === "suspended") void context.resume().catch(() => {});
  }

  function installUnlock() {
    if (unlockInstalled || !eventTarget?.addEventListener) return;
    unlockInstalled = true;
    eventTarget.addEventListener("pointerdown", resume, { passive: true, capture: true });
    eventTarget.addEventListener("keydown", resume, { capture: true });
  }

  function ensure() {
    if (context) return context;
    if (typeof AudioContextClass !== "function") return null;
    try { context = new AudioContextClass(); } catch { context = null; return null; }
    master = context.createGain();
    // Set, not ramped: the very first sample already plays at the saved level.
    master.gain.value = masterLevel();
    master.connect(context.destination);
    installUnlock();
    resume();
    return context;
  }

  function category(name) {
    if (!AUDIO_CATEGORIES.includes(name)) throw new RangeError(`AUDIO_CATEGORY_${name}`);
    if (!ensure()) return null;
    if (!categories.has(name)) {
      const gain = context.createGain();
      gain.gain.value = categoryLevel(name);
      gain.connect(master);
      categories.set(name, gain);
    }
    return categories.get(name);
  }

  function ramp(param, value) {
    const now = context.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.setTargetAtTime(value, now, RAMP_SECONDS);
    } catch { param.value = value; }
  }

  return Object.freeze({
    /**
     * An output for one source: the shared context and the category's input.
     * Null when the browser has no Web Audio (the source then stays silent).
     */
    output(name = "sfx") {
      const destination = category(name);
      return destination ? Object.freeze({ context, destination, category: name }) : null;
    },
    setLevels(next = {}) {
      levels = { ...levels, ...next };
      if (!context) return;
      ramp(master.gain, masterLevel());
      for (const [name, gain] of categories) ramp(gain.gain, categoryLevel(name));
    },
    levels: () => Object.freeze({ ...levels }),
    /** Current gains as the graph holds them (for tests and QA). */
    gains() {
      return Object.freeze({
        master: master ? master.gain.value : masterLevel(),
        sfx: categories.get("sfx")?.gain.value ?? categoryLevel("sfx"),
        effective: effectiveGain(levels, "sfx"),
        music: categories.get("music")?.gain.value ?? categoryLevel("music"),
        musicEffective: effectiveGain(levels, "music")
      });
    },
    state: () => context?.state ?? "none",
    resume,
    /**
     * A short test chime through the sfx category. A second press stops the
     * first chime before starting, so presses never stack. Returns whether a
     * sound could be started (false while muted or before audio is allowed).
     */
    preview() {
      if (levels.muted || effectiveGain(levels, "sfx") === 0) return false;
      const destination = category("sfx");
      if (!destination) return false;
      resume();
      if (previewVoice) { try { previewVoice.stop(); } catch { /* ended */ } previewVoice = null; }
      const now = context.currentTime;
      const amp = context.createGain();
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(0.28, now + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      amp.connect(destination);
      const osc = context.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.setValueAtTime(1567.98, now + 0.12);
      osc.connect(amp);
      osc.onended = () => { try { osc.disconnect(); amp.disconnect(); } catch { /* gone */ } if (previewVoice === osc) previewVoice = null; };
      osc.start(now);
      osc.stop(now + 0.6);
      previewVoice = osc;
      previews += 1;
      // Pressed inside a user gesture, so a suspended context resumes now.
      return context.state !== "closed";
    },
    stats: () => Object.freeze({ state: context?.state ?? "none", previews, previewing: Boolean(previewVoice) }),
    dispose() {
      if (unlockInstalled) {
        eventTarget.removeEventListener("pointerdown", resume, { capture: true });
        eventTarget.removeEventListener("keydown", resume, { capture: true });
      }
      unlockInstalled = false;
      categories.clear();
      if (context) void context.close().catch(() => {});
      context = null;
      master = null;
    }
  });
}
