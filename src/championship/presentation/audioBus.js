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
  let musicDuck = null, duckSerial = 0;
  const ducks = new Map();

  const masterLevel = () => (levels.muted ? 0 : Math.max(0, Math.min(1, levels.masterVolume / 100)));
  const categoryLevel = (name) => Math.max(0, Math.min(1, (name === "sfx" ? levels.sfxVolume : name === "music" ? levels.musicVolume : 100) / 100));

  function resume() {
    // Safari exposes an external interruption separately from app suspension.
    // Keep the same native-rate context and graph; never resample decoded audio
    // or rebuild media sources when returning from another app.
    if (context?.state === "suspended" || context?.state === "interrupted") void context.resume().catch(() => {});
  }

  function resumeOnForeground() {
    if (eventTarget?.hidden === true) return;
    resume();
  }

  function installUnlock() {
    if (unlockInstalled || !eventTarget?.addEventListener) return;
    unlockInstalled = true;
    eventTarget.addEventListener("pointerdown", resume, { passive: true, capture: true });
    eventTarget.addEventListener("touchstart", resume, { passive: true, capture: true });
    eventTarget.addEventListener("keydown", resume, { capture: true });
    eventTarget.addEventListener("visibilitychange", resumeOnForeground);
    globalThis.addEventListener?.("pageshow", resumeOnForeground);
    globalThis.addEventListener?.("focus", resumeOnForeground);
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
      if (name === 'music') {
        musicDuck = context.createGain(); musicDuck.gain.value = 1;
        gain.connect(musicDuck); musicDuck.connect(master);
      } else gain.connect(master);
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

  function scheduleDucking() {
    if (!musicDuck || context?.state === 'closed') return;
    const now = context.currentTime, param = musicDuck.gain;
    for (const [id, until] of ducks) if (until <= now) ducks.delete(id);
    const until = Math.max(now, ...ducks.values());
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
    if (until > now) {
      const level = 10 ** (-4 / 20);
      param.linearRampToValueAtTime(level, now + .025);
      param.setValueAtTime(level, Math.max(now + .025, until));
      param.linearRampToValueAtTime(1, Math.max(now + .025, until) + .3);
    } else param.linearRampToValueAtTime(1, now + .2);
  }
  function duckMusic({ seconds = 1 } = {}) {
    // A separate envelope never edits or restores the player's volume values.
    if (!musicDuck || levels.muted || categoryLevel('music') === 0 || masterLevel() === 0) return null;
    const id = ++duckSerial;
    ducks.set(id, context.currentTime + Math.max(.1, Math.min(3, Number(seconds) || 1)));
    scheduleDucking();
    let released = false;
    return () => { if (!released) { released = true; ducks.delete(id); scheduleDucking(); } };
  }

  return Object.freeze({
    /**
     * An output for one source: the shared context and the category's input.
     * Null when the browser has no Web Audio (the source then stays silent).
     */
    output(name = "sfx") {
      const destination = category(name);
      return destination ? Object.freeze({ context, destination, category: name, duckMusic }) : null;
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
    duckMusic,
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
    stats: () => Object.freeze({ state: context?.state ?? "none", sampleRate: context?.sampleRate ?? null, previews, previewing: Boolean(previewVoice) }),
    dispose() {
      if (unlockInstalled) {
        eventTarget.removeEventListener("pointerdown", resume, { capture: true });
        eventTarget.removeEventListener("touchstart", resume, { capture: true });
        eventTarget.removeEventListener("keydown", resume, { capture: true });
        eventTarget.removeEventListener("visibilitychange", resumeOnForeground);
        globalThis.removeEventListener?.("pageshow", resumeOnForeground);
        globalThis.removeEventListener?.("focus", resumeOnForeground);
      }
      unlockInstalled = false;
      categories.clear();
      ducks.clear(); musicDuck = null;
      if (context) void context.close().catch(() => {});
      context = null;
      master = null;
    }
  });
}
