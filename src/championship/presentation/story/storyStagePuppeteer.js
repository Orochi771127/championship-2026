// In-engine stage puppeteer for the story theater (OWNER_APPROVED_ADAPTATION
// 2026-10-28): the Octopath-style layer. It drives the ranch presentation's
// story puppet (the partner's own native sprite), its camera, and a DOM fx
// layer inside the field host: a spotlight vignette, pixel emote bubbles over
// the actor's head, and the "dimension rift" with drifting comment echoes.
//
// Everything visible is CSS (ui/storyTheater.css); motion is transform and
// opacity only. The one timer here re-places the DOM pieces over the moving
// sprite while a cutscene is live and stops with it. No animation frame loop,
// no textures, no game state.

const EMOTE_GLYPHS = Object.freeze({
  "!": { label: "exclaim", path: "M9 2h4l-1 10h-2L9 2zm1 12h2v3h-2z" },
  "?": { label: "question", path: "M7 6a4 4 0 1 1 6 3.5c-1 .6-1 1-1 2.5h-2c0-2 0-2.8 1.4-3.7A2 2 0 1 0 9 6H7zm3 8h2v3h-2z" },
  "...": { label: "silence", path: "M4 11h3v3H4zm6 0h3v3h-3zm6 0h3v3h-3z" },
  "💢": { label: "anger", path: "M5 5l5 5m0-5l-5 5M13 5l5 5m0-5l-5 5M5 13l5 5m0-5l-5 5M13 13l5 5m0-5l-5 5" },
  "🎵": { label: "note", path: "M9 4v10a3 3 0 1 1-2-2.8V4h2zm0 0l7-2v9a3 3 0 1 1-2-2.8V4.6L9 6z" },
  "⚡": { label: "noise", path: "M12 2L6 12h5l-1 8 7-11h-5l1-7z" }
});
export const STORY_EMOTE_GLYPHS = EMOTE_GLYPHS;
const RIFT_GLYPHS = ["0", "1", "/", "\\", "#", "%", "@", "!", "?", "~", "+", "-", "|", "*", "<", ">"];

function svgGlyph(doc, glyph) {
  const spec = EMOTE_GLYPHS[glyph] ?? EMOTE_GLYPHS["!"];
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
  svg.classList.add("cm-story-emote__glyph"); svg.dataset.glyph = spec.label;
  const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", spec.path);
  if (glyph === "💢") { path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "2.4"); path.setAttribute("stroke-linecap", "square"); }
  else path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

export function createStoryStagePuppeteer({
  host, field, partnerCreatureId, doc = globalThis.document, reducedMotion = false, quality = "balanced",
  random = Math.random, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, setIntervalFn = globalThis.setInterval, clearIntervalFn = globalThis.clearInterval
} = {}) {
  if (!host || !field) throw new TypeError("STORY_STAGE_REQUIRES_HOST_AND_FIELD");
  const layer = doc.createElement("div");
  layer.className = "cm-story-fx"; layer.setAttribute("aria-hidden", "true"); layer.hidden = true;
  if (reducedMotion) layer.dataset.motion = "reduced"; else if (quality === "saver") layer.dataset.motion = "saver";
  const vignette = doc.createElement("div"); vignette.className = "cm-story-fx__vignette";
  const rift = doc.createElement("div"); rift.className = "cm-story-rift"; rift.dataset.state = "closed";
  const riftCore = doc.createElement("div"); riftCore.className = "cm-story-rift__core";
  const riftRing = doc.createElement("div"); riftRing.className = "cm-story-rift__ring";
  const riftGlyphs = doc.createElement("div"); riftGlyphs.className = "cm-story-rift__glyphs";
  rift.append(riftRing, riftCore, riftGlyphs);
  const echoes = doc.createElement("div"); echoes.className = "cm-story-echoes";
  const emote = doc.createElement("div"); emote.className = "cm-story-emote"; emote.hidden = true;
  layer.append(vignette, rift, echoes, emote);
  host.append(layer);

  let riftSide = "left", placer = null, emoteTimer = null, lastRect = null, live = false, actionTimer = null;
  const particleCount = reducedMotion ? 0 : quality === "saver" ? 8 : 20;
  for (let i = 0; i < particleCount; i++) {
    const g = doc.createElement("span"); g.className = "cm-story-rift__glyph";
    g.textContent = RIFT_GLYPHS[Math.floor(random() * RIFT_GLYPHS.length)];
    g.style.setProperty("--i", String(i)); g.style.setProperty("--r", random().toFixed(3)); g.style.setProperty("--d", (0.6 + random() * 0.9).toFixed(2));
    riftGlyphs.append(g);
  }

  function actorRect() {
    const rect = field.actorScreenRect?.(partnerCreatureId) ?? null;
    if (rect) lastRect = rect;
    return lastRect;
  }
  function hostSize() { return { width: host.clientWidth || 390, height: host.clientHeight || 520 }; }
  function riftPoint() {
    const rect = actorRect(), size = hostSize();
    if (!rect) return { x: riftSide === "left" ? 90 : size.width - 90, y: size.height * 0.42 };
    const dx = riftSide === "left" ? -150 : 150;
    return { x: Math.min(size.width - 70, Math.max(70, rect.x + rect.width / 2 + dx)), y: Math.min(size.height - 60, Math.max(60, rect.y + rect.height * 0.35)) };
  }
  function place() {
    const rect = actorRect();
    if (rect) {
      emote.style.setProperty("--x", `${Math.round(rect.x + rect.width / 2)}px`);
      emote.style.setProperty("--y", `${Math.round(rect.y - 6)}px`);
    }
    const point = riftPoint();
    rift.style.setProperty("--x", `${Math.round(point.x)}px`); rift.style.setProperty("--y", `${Math.round(point.y)}px`);
    echoes.style.setProperty("--x", `${Math.round(point.x)}px`); echoes.style.setProperty("--y", `${Math.round(point.y)}px`);
    const spot = layer.dataset.spotTarget === "rift" ? point : rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    if (spot) { vignette.style.setProperty("--spot-x", `${Math.round(spot.x)}px`); vignette.style.setProperty("--spot-y", `${Math.round(spot.y)}px`); }
  }
  function startPlacing() { if (placer === null) placer = setIntervalFn(place, 80); place(); }
  function stopPlacing() { if (placer !== null) { clearIntervalFn(placer); placer = null; } }
  const sleep = (ms, signal) => new Promise(resolve => { if (!ms || signal?.aborted) { resolve(); return; } const t = setTimer(resolve, ms); signal?.addEventListener?.("abort", () => { clearTimer(t); resolve(); }, { once: true }); });
  let signal = null;

  return Object.freeze({
    element: layer,
    async begin(abortSignal = null) {
      signal = abortSignal; live = true; layer.hidden = false; layer.dataset.live = "true";
      field.focusResident?.(partnerCreatureId, { reducedMotion });
      startPlacing();
    },
    async end() {
      live = false; stopPlacing();
      clearTimer(emoteTimer); clearTimer(actionTimer);
      field.clearStoryPuppet?.(partnerCreatureId);
      rift.dataset.state = "closed"; layer.dataset.spot = "off"; emote.hidden = true; echoes.replaceChildren();
      layer.hidden = true; delete layer.dataset.live;
    },
    /** Ease the camera to the partner (the only in-engine anchor) or leave it. */
    async camera(target, { zoom = 1, ms = 600 } = {}) {
      layer.dataset.camera = target; layer.style.setProperty("--zoom", String(Math.min(1.35, Math.max(1, zoom))));
      if (target === "partner" || target === "rift") field.focusResident?.(partnerCreatureId, { reducedMotion: reducedMotion || ms === 0 });
      place();
    },
    spotlight(on, target = "partner") { layer.dataset.spot = on ? "on" : "off"; layer.dataset.spotTarget = target; place(); },
    rift(state, anchor = "edge-left") {
      riftSide = anchor === "edge-right" ? "right" : "left"; rift.dataset.anchor = anchor; place();
      rift.dataset.state = state === "open" ? "open" : state === "pulse" ? "pulse" : "closing";
      if (state === "close") { clearTimer(actionTimer); actionTimer = setTimer(() => { if (rift.dataset.state === "closing") rift.dataset.state = "closed"; }, reducedMotion ? 160 : 700); }
    },
    echoes(texts) {
      place();
      texts.slice(0, 4).forEach((text, index) => {
        const chip = doc.createElement("span"); chip.className = "cm-story-echo"; chip.textContent = text;
        chip.style.setProperty("--i", String(index)); chip.style.setProperty("--r", (random() * 2 - 1).toFixed(3));
        echoes.append(chip);
        setTimer(() => chip.remove(), reducedMotion ? 2600 : 4200);
      });
    },
    emote(glyph) {
      clearTimer(emoteTimer); place();
      emote.replaceChildren(svgGlyph(doc, glyph)); emote.dataset.glyph = EMOTE_GLYPHS[glyph]?.label ?? "exclaim";
      emote.hidden = false; emote.classList.remove("is-live"); void emote.offsetWidth; emote.classList.add("is-live");
      emoteTimer = setTimer(() => { emote.hidden = true; }, reducedMotion ? 900 : 1400);
    },
    speaking(speakerId) { layer.dataset.speaking = speakerId; },
    /** The partner acts with its own sprite; resolves when the beat has played. */
    async actor(action, { toward = null } = {}) {
      if (!live) return;
      const facing = toward === "rift" ? riftSide : toward === "player" ? "right" : null;
      const towardSign = (facing ?? riftSide) === "left" ? -1 : 1;
      let ms = reducedMotion ? 120 : 700;
      switch (action) {
        case "walk": field.setStoryPuppet?.(partnerCreatureId, { action: "walk", facing, moveX: towardSign * 26, moveMs: reducedMotion ? 1 : 900 }); ms = reducedMotion ? 60 : 950; break;
        case "attack": field.setStoryPuppet?.(partnerCreatureId, { action: "attack", facing, moveX: towardSign * 6, moveMs: 180 }); ms = reducedMotion ? 120 : 780; break;
        case "hit": field.setStoryPuppet?.(partnerCreatureId, { action: "hit", facing, moveX: -towardSign * 12, moveMs: 220 }); ms = reducedMotion ? 120 : 640; break;
        case "hop": field.setStoryPuppet?.(partnerCreatureId, { action: "hop", facing, hop: { count: 2, height: 9, ms: reducedMotion ? 1 : 720 } }); ms = reducedMotion ? 80 : 760; break;
        case "face": field.setStoryPuppet?.(partnerCreatureId, { action: "face", facing }); ms = reducedMotion ? 60 : 220; break;
        default: field.setStoryPuppet?.(partnerCreatureId, { action: "idle", facing }); ms = reducedMotion ? 60 : 200;
      }
      await sleep(ms, signal);
      if (live && action !== "face") field.setStoryPuppet?.(partnerCreatureId, { action: "idle" });
    },
    dispose() { live = false; stopPlacing(); clearTimer(emoteTimer); clearTimer(actionTimer); field.clearStoryPuppet?.(partnerCreatureId); layer.remove(); }
  });
}
