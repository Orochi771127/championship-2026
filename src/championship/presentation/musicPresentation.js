// Bounded music transport, projected from the existing screen/session only.
// Two lazily loaded media elements feed the ONE audioBus. Streaming avoids
// decoding the entire original music library into mobile AudioBuffers.
export function createMusicPresentation({ bus, cues, baseUrl = globalThis.location?.href,
  doc = globalThis.document, win = globalThis.window, AudioClass = globalThis.Audio,
  timers = globalThis, onState = () => {}, resolveCue = id => id } = {}) {
  let requested = null, desired = null, current = null, pending = null, serial = 0;
  let unlocked = false, hidden = doc?.visibilityState === 'hidden', disposed = false;
  let fadeTimer = null, loopTimer = null, loopDeadline = null, prepared = null, error = null, starts = 0;
  let transportContext = null, graphInterrupted = false;
  const slots = [], playedResults = new Set();
  const audible = () => { const p = bus.levels(); return !p.muted && p.masterVolume > 0 && p.musicVolume > 0; };
  const state = () => Object.freeze({ cue: desired?.id ?? null, key: desired?.key ?? null,
    requestedCue: requested?.id ?? null, scene: requested?.scene ?? null,
    playing: current && !current.media.paused ? current.id : null, pending: pending?.id ?? null,
    voices: slots.filter(s => !s.media.paused).length, slots: slots.length, starts, unlocked, hidden,
    paused: Boolean(current?.media.paused), position: current?.media.currentTime ?? 0,
    playbackRate: current?.media.playbackRate ?? 1, defaultPlaybackRate: current?.media.defaultPlaybackRate ?? 1,
    preservesPitch: current?.media.preservesPitch ?? current?.media.webkitPreservesPitch ?? true,
    contextState: bus.state?.() ?? null, sampleRate: current?.context.sampleRate ?? null,
    retryable: Boolean(error && desired && !pending), loopDeadline, prepared: prepared?.id ?? null,
    initialBuffering: Boolean(unlocked&&!hidden&&audible()&&(pending??current)&&!(pending??current).startupReady&&!(pending??current).media.paused), error });
  const emit = () => onState(state());
  const wake = (fn, ms) => { const timer = timers.setTimeout(fn, ms); timer?.unref?.(); return timer; };
  function gain(slot, value, seconds = 0) {
    const now = slot.context.currentTime, param = slot.gain.gain;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
    if (seconds) param.linearRampToValueAtTime(value, now + seconds);
    else param.setValueAtTime(value, now);
  }
  function release(slot) {
    if (!slot) return;
    slot.generation++; slot.resuming = null; slot.media.pause(); gain(slot, 0);
    slot.media.onloadedmetadata = slot.media.ontimeupdate = slot.media.onseeked = slot.media.onended = slot.media.onerror = null;
    slot.media.oncanplaythrough = slot.media.onprogress = null;
    slot.media.removeAttribute('src'); slot.media.load(); slot.id = slot.key = null;
    if (pending === slot) pending = null;
    if (current === slot) { current = null; clearLoop(); }
    if (prepared === slot) prepared = null;
  }
  function clearFade() { if (fadeTimer !== null) timers.clearTimeout(fadeTimer); fadeTimer = null; }
  function clearLoop() { if (loopTimer !== null) timers.clearTimeout(loopTimer); loopTimer = null; loopDeadline = null; }
  function contextChanged() {
    if (disposed) return;
    if (transportContext?.state === 'running') reconcile();
    else if (['suspended', 'interrupted'].includes(transportContext?.state)) {
      graphInterrupted = true; pause();
    } else if (transportContext?.state === 'closed') { clearLoop(); clearFade(); }
  }
  function stableRate(media) {
    media.defaultPlaybackRate = 1; media.playbackRate = 1;
    if ('preservesPitch' in media) media.preservesPitch = true;
    if ('webkitPreservesPitch' in media) media.webkitPreservesPitch = true;
  }
  function retireOther(keep = null) { clearFade(); clearLoop(); for (const s of slots) if (s !== current && s !== keep) release(s); }
  const pathFor = (slot, cue) => cue.fallbackPath && slot.media.canPlayType?.('audio/ogg; codecs="vorbis"') === ''
    ? cue.fallbackPath : cue.path;
  function prepareLoop(slot) {
    if (prepared || pending || slots.some(s => s !== current && !s.media.paused)) return;
    const next = availableSlot(), cue = cues[slot.id];
    if (!next) return;
    prepared = next; next.id = slot.id; next.key = slot.key;
    stableRate(next.media); next.media.preload = 'auto'; next.media.loop = false;
    next.media.onloadedmetadata = () => { if (prepared === next) next.media.currentTime = cue.trimStart ?? 0; };
    next.media.onerror = () => { if (prepared === next) release(next); };
    next.media.src = new URL(pathFor(next, cue), baseUrl).href; next.media.load();
  }
  function watchLoop() {
    clearLoop();
    const slot = current, cue = cues[slot?.id];
    if (disposed || hidden || !audible() || !slot || slot.media.paused || pending
      || desired?.key !== slot.key || slot.media.seeking || !cue?.loop || !cue.crossfade
      || (slot.context.state && slot.context.state !== 'running')) return;
    const token = slot.generation;
    const remaining = () => slot.media.duration - (cue.trimEnd ?? 0) - cue.crossfade - slot.media.currentTime;
    const delay = seconds => seconds > 3 ? (seconds - 3) * 1000 : Math.max(25, Math.min(100, seconds * 1000));
    let left = remaining();
    if (!Number.isFinite(left)) return;
    if (left <= 0) { begin(); return; }
    if (left <= 3) prepareLoop(slot);
    loopDeadline = slot.context.currentTime + left;
    const check = () => {
      loopTimer = null;
      if (disposed || hidden || !audible() || current !== slot || slot.generation !== token
        || desired?.key !== slot.key || pending || slot.media.paused) { loopDeadline = null; return; }
      // JS only wakes the check. A suspended audio clock cannot start a loop.
      if (slot.context.state && slot.context.state !== 'running') { loopDeadline = null; return; }
      left = remaining();
      if (!Number.isFinite(left)) { loopDeadline = null; return; }
      if (left <= .025 && slot.context.currentTime >= loopDeadline - .025) { begin(); return; }
      if (left <= 3) prepareLoop(slot);
      // Re-anchor to real media progress after buffering or a seek; wall time
      // alone is never evidence that the final samples have played.
      loopDeadline = slot.context.currentTime + Math.max(0, left);
      loopTimer = wake(check, delay(Math.max(0, left)));
    };
    loopTimer = wake(check, delay(left));
  }
  function retireAfterFade(slot, seconds) {
    const token = slot.generation, until = slot.context.currentTime + seconds;
    const check = () => {
      fadeTimer = null;
      if (disposed || current === slot || slot.generation !== token) return;
      if ((slot.context.state && slot.context.state !== 'running') || slot.context.currentTime + .001 < until) {
        fadeTimer = wake(check, 50); return;
      }
      release(slot); emit(); watchLoop();
    };
    fadeTimer = wake(check, seconds * 1000 + 20);
  }
  function availableSlot() {
    let slot = slots.find(s => s !== current);
    if (slot) return slot;
    const output = bus.output('music');
    if (!output || typeof AudioClass !== 'function') return null;
    if (transportContext !== output.context) {
      transportContext?.removeEventListener?.('statechange', contextChanged);
      transportContext = output.context;
      transportContext.addEventListener?.('statechange', contextChanged);
    }
    const media = new AudioClass(); media.preload = 'none'; media.volume = 1; stableRate(media);
    const source = output.context.createMediaElementSource(media), amp = output.context.createGain();
    amp.gain.value = 0; source.connect(amp); amp.connect(output.destination);
    slot = { media, source, gain: amp, context: output.context, generation: 0, id: null, key: null };
    slots.push(slot); return slot;
  }
  function begin() {
    if (disposed || !desired || !unlocked || hidden || !audible()) return;
    const cue = cues[desired.id];
    if (!cue.loop && playedResults.has(desired.attemptId)) return;
    const ready = current?.key === desired.key && prepared?.key === desired.key ? prepared : null;
    retireOther(ready);
    const slot = availableSlot();
    if (!slot) { error = 'MUSIC_OUTPUT_UNAVAILABLE'; emit(); return; }
    stableRate(slot.media);
    const request = serial, token = ++slot.generation, key = desired.key;
    slot.id = desired.id; slot.key = key; slot.startupReady=false; pending = slot; error = null;
    const valid = () => !disposed && slot.generation === token && !hidden && audible()
      && ((pending === slot && serial === request) || (current === slot && desired?.key === key));
    const fail = reason => {
      if (!valid()) return;
      error = String(reason?.message ?? reason ?? 'MUSIC_LOAD_FAILED');
      // A replacement's failure must not cut off the still-valid old stream.
      release(slot); emit();
    };
    slot.media.loop = Boolean(cue.loop && !cue.crossfade);
    slot.media.onloadedmetadata = () => { if (valid()) slot.media.currentTime = cue.trimStart ?? 0; };
    const buffered = () => {
      if(!valid()||slot.startupReady)return;
      const ranges=slot.media.buffered;
      const ahead=ranges?.length?ranges.end(ranges.length-1)-slot.media.currentTime:0;
      if(slot.media.readyState>=4||ahead>=8){slot.startupReady=true;emit();}
    };
    slot.media.oncanplaythrough=slot.media.onprogress=buffered;
    slot.media.onerror = () => fail(`MUSIC_MEDIA_ERROR_${slot.media.error?.code ?? 'UNKNOWN'}`);
    slot.media.onended = () => {
      if (current !== slot || slot.generation !== token) return;
      if (pending) return;
      if (desired?.key !== key) { release(slot); emit(); }
      else if (cue.loop) begin();
      else { release(slot); emit(); }
    };
    slot.media.ontimeupdate = () => {
      if (current !== slot || pending || !cue.loop || !cue.crossfade || !valid()) return;
      watchLoop();
    };
    slot.media.onseeked = () => { if (current === slot && slot.generation === token) watchLoop(); };
    // The same approved combat cue has an AAC encoding for browsers without
    // Vorbis support. Capability selection happens before a network request.
    if (slot === ready) {
      prepared = null;
      if (slot.media.readyState >= 1) slot.media.currentTime = cue.trimStart ?? 0;
    } else {
      slot.media.preload = 'auto'; slot.media.src = new URL(pathFor(slot, cue), baseUrl).href; slot.media.load();
    }
    bus.resume();
    Promise.resolve(slot.media.play()).then(() => {
      if (!valid()) { if (slot.generation === token) release(slot); return; }
      const old = current; current = slot; pending = null; starts++;
      buffered();
      if (!cue.loop) playedResults.add(desired.attemptId);
      const seconds = old ? Math.min(cue.crossfade || .35, .8) : .2;
      gain(slot, 10 ** (cue.gainDb / 20), seconds);
      if (old) {
        gain(old, 0, seconds);
        retireAfterFade(old, seconds);
      }
      emit(); watchLoop();
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
      // A returning page may have a running media element but an interrupted
      // graph. Resume both independently, preserving position and one source.
      stableRate(current.media);
      const recoveringGraph = graphInterrupted || ['suspended', 'interrupted'].includes(bus.state?.());
      graphInterrupted = false;
      if (recoveringGraph && !current.media.paused) {
        // Resume at zero rather than reconnecting an arbitrary nonzero sample
        // at full cue gain. This short ramp preserves position and timbre.
        gain(current, 0); bus.resume();
        gain(current, 10 ** (cues[current.id].gainDb / 20), .02);
      } else bus.resume();
      if (current.media.paused) {
        const slot = current, token = serial, generation = slot.generation;
        if (slot.resuming === token) return;
        slot.resuming = token; gain(slot, 0); bus.resume();
        Promise.resolve(slot.media.play()).then(() => {
          if (slot.resuming === token) slot.resuming = null;
          // A late resume cannot make a hidden/muted or superseded scene audible.
          if (slot.generation === generation && (disposed || hidden || !audible() || current !== slot || desired?.key !== slot.key)) slot.media.pause();
          if (current === slot && serial === token && !hidden && audible()) {
            error = null; gain(slot, 10 ** (cues[slot.id].gainDb / 20), .02); emit(); watchLoop();
          }
        }).catch(e => {
          if (slot.resuming === token) slot.resuming = null;
          if (current === slot && serial === token) { error = e.message; emit(); }
        });
      }
      watchLoop(); return;
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
  function projectRequested() {
    const sourceId = requested?.id ?? null;
    const chosen = sourceId == null ? null : resolveCue(sourceId, requested.scene);
    // A stale preference never invents a URL or replaces intentional silence.
    const id = chosen != null && cues[chosen] ? chosen : sourceId;
    const attemptId = requested?.attemptId ?? null;
    const next = id == null ? null : { id, attemptId, key: cues[id].loop ? id : `${id}:${attemptId}` };
    if (next && !cues[id].loop && attemptId == null) return false;
    if (next?.key === desired?.key) return false;
    serial++; retireOther(); desired = next; error = null;
    if (next && !cues[id].loop && playedResults.has(attemptId)) { release(current); emit(); return true; }
    reconcile(); emit(); return true;
  }
  return Object.freeze({
    setScene(id, attemptId = null, scene = null) {
      if (id != null && !cues[id]) throw new RangeError(`UNKNOWN_MUSIC_CUE_${id}`);
      // Preserve the source cue even when two screens currently resolve to the same track.
      if (id != null && !cues[id].loop && attemptId == null) return;
      const metadataChanged = requested?.id !== id || requested?.attemptId !== attemptId || requested?.scene !== scene;
      requested = { id, attemptId, scene };
      if (!projectRequested() && metadataChanged) emit();
    },
    preferencesChanged() { if (!projectRequested()) reconcile(); }, inspect: state,
    retry() {
      if (!error || disposed || !desired || pending || !unlocked || hidden || !audible()) return false;
      begin(); return true;
    },
    dispose() {
      disposed = true; serial++; clearFade(); clearLoop();
      transportContext?.removeEventListener?.('statechange', contextChanged);
      for (const s of slots) { release(s); s.source.disconnect(); s.gain.disconnect(); }
      doc?.removeEventListener('pointerdown', gesture, { capture: true });
      doc?.removeEventListener('keydown', gesture, { capture: true });
      doc?.removeEventListener('visibilitychange', visibility);
      win?.removeEventListener('pagehide', pageHide); win?.removeEventListener('pageshow', pageShow);
    }
  });
}
