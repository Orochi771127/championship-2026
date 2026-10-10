// Bounded music transport, projected from the existing screen/session only.
// Two lazily loaded media elements feed the ONE audioBus. Streaming avoids
// decoding the entire original music library into mobile AudioBuffers.
export function createMusicPresentation({ bus, cues, baseUrl = globalThis.location?.href,
  doc = globalThis.document, win = globalThis.window, AudioClass = globalThis.Audio,
  timers = globalThis, onState = () => {} } = {}) {
  let desired = null, current = null, pending = null, serial = 0;
  let unlocked = false, hidden = doc?.visibilityState === 'hidden', disposed = false;
  let fadeTimer = null, error = null, starts = 0;
  const slots = [], playedResults = new Set();
  const audible = () => { const p = bus.levels(); return !p.muted && p.masterVolume > 0 && p.musicVolume > 0; };
  const state = () => Object.freeze({ cue: desired?.id ?? null, key: desired?.key ?? null,
    playing: current && !current.media.paused ? current.id : null, pending: pending?.id ?? null,
    voices: slots.filter(s => !s.media.paused).length, slots: slots.length, starts, unlocked, hidden,
    paused: Boolean(current?.media.paused), position: current?.media.currentTime ?? 0, error });
  const emit = () => onState(state());
  function gain(slot, value, seconds = 0) {
    const now = slot.context.currentTime, param = slot.gain.gain;
    param.cancelScheduledValues(now); param.setValueAtTime(param.value, now);
    if (seconds) param.linearRampToValueAtTime(value, now + seconds);
    else param.setValueAtTime(value, now);
  }
  function release(slot) {
    if (!slot) return;
    slot.generation++; slot.media.pause(); gain(slot, 0);
    slot.media.onloadedmetadata = slot.media.ontimeupdate = slot.media.onended = slot.media.onerror = null;
    slot.media.removeAttribute('src'); slot.media.load(); slot.id = slot.key = null;
    if (pending === slot) pending = null;
    if (current === slot) current = null;
  }
  function clearFade() { if (fadeTimer !== null) timers.clearTimeout(fadeTimer); fadeTimer = null; }
  function retireOther() { clearFade(); for (const s of slots) if (s !== current) release(s); }
  function availableSlot() {
    let slot = slots.find(s => s !== current);
    if (slot) return slot;
    const output = bus.output('music');
    if (!output || typeof AudioClass !== 'function') return null;
    const media = new AudioClass(); media.preload = 'none'; media.volume = 1;
    const source = output.context.createMediaElementSource(media), amp = output.context.createGain();
    amp.gain.value = 0; source.connect(amp); amp.connect(output.destination);
    slot = { media, source, gain: amp, context: output.context, generation: 0, id: null, key: null };
    slots.push(slot); return slot;
  }
  function begin() {
    if (disposed || !desired || !unlocked || hidden || !audible()) return;
    const cue = cues[desired.id];
    if (!cue.loop && playedResults.has(desired.attemptId)) return;
    retireOther();
    const slot = availableSlot();
    if (!slot) { error = 'MUSIC_OUTPUT_UNAVAILABLE'; emit(); return; }
    const request = serial, token = ++slot.generation, key = desired.key;
    slot.id = desired.id; slot.key = key; pending = slot; error = null;
    const valid = () => !disposed && slot.generation === token && !hidden && audible()
      && ((pending === slot && serial === request) || (current === slot && desired?.key === key));
    const fail = reason => {
      if (!valid()) return;
      error = String(reason?.message ?? reason ?? 'MUSIC_LOAD_FAILED');
      release(slot); release(current); emit();
    };
    slot.media.loop = Boolean(cue.loop && !cue.crossfade);
    slot.media.onloadedmetadata = () => { if (valid()) slot.media.currentTime = cue.trimStart ?? 0; };
    slot.media.onerror = () => fail(`MUSIC_MEDIA_ERROR_${slot.media.error?.code ?? 'UNKNOWN'}`);
    slot.media.onended = () => {
      if (current !== slot || slot.generation !== token) return;
      if (pending) return;
      if (cue.loop) begin();
      else { release(slot); emit(); }
    };
    slot.media.ontimeupdate = () => {
      if (current !== slot || pending || !cue.loop || !cue.crossfade || !valid()) return;
      const end = slot.media.duration - (cue.trimEnd ?? 0);
      if (Number.isFinite(end) && slot.media.currentTime >= end - cue.crossfade) begin();
    };
    // The same approved combat cue has an AAC encoding for browsers without
    // Vorbis support. Capability selection happens before a network request.
    const path = cue.fallbackPath && slot.media.canPlayType?.('audio/ogg; codecs="vorbis"') === ''
      ? cue.fallbackPath : cue.path;
    slot.media.preload = 'auto'; slot.media.src = new URL(path, baseUrl).href; slot.media.load();
    bus.resume();
    Promise.resolve(slot.media.play()).then(() => {
      if (!valid()) { if (slot.generation === token) release(slot); return; }
      const old = current; current = slot; pending = null; starts++;
      if (!cue.loop) playedResults.add(desired.attemptId);
      const seconds = old ? Math.min(cue.crossfade || .35, .8) : .2;
      gain(slot, 10 ** (cue.gainDb / 20), seconds);
      if (old) {
        gain(old, 0, seconds);
        fadeTimer = timers.setTimeout(() => { fadeTimer = null; if (old !== current) release(old); emit(); }, seconds * 1000 + 20);
      }
      emit();
    }).catch(fail);
    emit();
  }
  function pause() {
    serial++; retireOther();
    if (current) { current.media.pause(); gain(current, 10 ** (cues[current.id].gainDb / 20)); }
    emit();
  }
  function reconcile() {
    if (disposed) return;
    if (!unlocked || hidden || !audible()) { pause(); return; }
    if (!desired) { retireOther(); release(current); emit(); return; }
    if (current?.key === desired.key) {
      if (current.media.paused) {
        const slot = current, token = serial; bus.resume();
        Promise.resolve(slot.media.play()).then(() => { if (current === slot && serial === token) emit(); })
          .catch(e => { if (current === slot && serial === token) { error = e.message; emit(); } });
      }
      return;
    }
    if (pending?.key === desired.key) return;
    begin();
  }
  function gesture(event) {
    // Synthetic events cannot unlock a browser's audio policy.
    if (event?.isTrusted === false) return;
    unlocked = true; bus.resume(); reconcile();
  }
  function visibility() { hidden = doc.visibilityState === 'hidden'; reconcile(); }
  function pageHide() { hidden = true; pause(); }
  function pageShow() { hidden = doc?.visibilityState === 'hidden'; reconcile(); }
  doc?.addEventListener('pointerdown', gesture, { capture: true, passive: true });
  doc?.addEventListener('keydown', gesture, { capture: true });
  doc?.addEventListener('visibilitychange', visibility);
  win?.addEventListener('pagehide', pageHide); win?.addEventListener('pageshow', pageShow);
  return Object.freeze({
    setScene(id, attemptId = null) {
      if (id != null && !cues[id]) throw new RangeError(`UNKNOWN_MUSIC_CUE_${id}`);
      const next = id == null ? null : { id, attemptId, key: cues[id].loop ? id : `${id}:${attemptId}` };
      // A result without this attempt's identity must not replay an old verdict.
      if (next && !cues[id].loop && attemptId == null) return;
      if (next?.key === desired?.key) return;
      serial++; retireOther(); desired = next; error = null;
      if (next && !cues[id].loop && playedResults.has(attemptId)) { release(current); emit(); return; }
      reconcile(); emit();
    },
    preferencesChanged: reconcile, inspect: state,
    dispose() {
      disposed = true; serial++; clearFade();
      for (const s of slots) { release(s); s.source.disconnect(); s.gain.disconnect(); }
      doc?.removeEventListener('pointerdown', gesture, { capture: true });
      doc?.removeEventListener('keydown', gesture, { capture: true });
      doc?.removeEventListener('visibilitychange', visibility);
      win?.removeEventListener('pagehide', pageHide); win?.removeEventListener('pageshow', pageShow);
    }
  });
}
