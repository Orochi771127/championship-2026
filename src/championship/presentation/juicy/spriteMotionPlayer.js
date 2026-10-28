// In-game motion for the Dex showcase (Owner direction 2026-10-28).
//
// Reads the same public character runtime the ranch and arenas load
// (public-character-catalog.v1.json -> runtime.render.json -> atlas pages)
// and plays one native sequence as stepped Web Animations on a DOM element's
// background. The native tick lengths are kept (60 Hz). No Pixi texture, no
// canvas and no WebGL context is created, so the Dex can show motion while the
// shared Pixi stage stays the only GPU owner.
//
// Characters are authored facing left; facing +1 mirrors them, as the ranch
// and battle scenes do with the original body flip. The art carries left and
// right only -- there are no extra turn-around angles to show.
import { publicCharacterConfig } from "../publicCharacterCatalog.js";
import { isOriginalRuntimeLocation } from "../originalRuntimeLocation.js";

/** Showcase actions -> native sequences (the Data Arena's audited ids). */
export const SHOWCASE_ACTIONS = Object.freeze([
  Object.freeze({ id: "stand", sequence: 0 }),
  Object.freeze({ id: "walk", sequence: 2 }),
  Object.freeze({ id: "attack", sequence: 7 }),
  Object.freeze({ id: "cheer", sequence: 33 })
]);
const TICK_MS = 1000 / 60;

/** Whether this location may show the species' in-game motion at all. */
export function showcaseMotionAvailable(speciesId, href = globalThis.location?.href) {
  return Boolean(publicCharacterConfig(speciesId)) && Boolean(href) && isOriginalRuntimeLocation(href);
}

async function sha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Load the frames of the showcase sequences for one species.
 * Resolves { frameWidth, frameHeight, anchor, sequences: Map(id -> frames) }
 * where each frame is { url, x, y, pageWidth, pageHeight, ticks }.
 */
export async function loadShowcaseMotion(speciesId, { signal = null, baseUrl = globalThis.location?.href,
  fetchImpl = (...args) => globalThis.fetch(...args), sequences = SHOWCASE_ACTIONS.map(action => action.sequence) } = {}) {
  const config = publicCharacterConfig(speciesId);
  if (!config || !baseUrl || !isOriginalRuntimeLocation(baseUrl)) throw new Error("SHOWCASE_MOTION_UNAVAILABLE");
  const runtimeUrl = new URL(config.runtimePath, baseUrl).href;
  const response = await fetchImpl(runtimeUrl, { signal });
  if (!response.ok) throw new Error(`SHOWCASE_MOTION_HTTP_${response.status}`);
  const text = await response.text();
  const hash = await sha256Hex(text);
  if (hash !== null && hash !== config.runtimeSha256) throw new Error("SHOWCASE_MOTION_HASH");
  const runtime = JSON.parse(text);
  const side = runtime.sides?.main;
  if (!side?.animations || !side.atlases) throw new Error("SHOWCASE_MOTION_SHAPE");
  const pageOf = runtime.streaming?.texturePages ?? {};
  const wanted = new Map();
  for (const id of sequences) {
    const animation = side.animations.find(a => a.id === id);
    if (animation?.frames?.length) wanted.set(id, animation.frames);
  }
  if (!wanted.size) throw new Error("SHOWCASE_MOTION_EMPTY");
  const pages = new Set();
  for (const frames of wanted.values()) for (const frame of frames) pages.add(pageOf[frame.texture] ?? 0);
  const atlasData = new Map();
  await Promise.all([...pages].map(async index => {
    const atlas = side.atlases[index];
    if (!atlas) throw new Error("SHOWCASE_MOTION_PAGE");
    const dataUrl = new URL(atlas.data, runtimeUrl).href;
    const pageResponse = await fetchImpl(dataUrl, { signal });
    if (!pageResponse.ok) throw new Error(`SHOWCASE_MOTION_HTTP_${pageResponse.status}`);
    const data = await pageResponse.json();
    atlasData.set(index, { data, url: new URL(atlas.image, runtimeUrl).href });
  }));
  let frameWidth = 0, frameHeight = 0;
  const resolved = new Map();
  for (const [id, frames] of wanted) {
    const list = [];
    for (const frame of frames) {
      const page = atlasData.get(pageOf[frame.texture] ?? 0);
      const rect = page?.data.frames?.[frame.texture];
      if (!rect || rect.rotated) continue;
      frameWidth = Math.max(frameWidth, rect.sourceSize?.w ?? rect.frame.w);
      frameHeight = Math.max(frameHeight, rect.sourceSize?.h ?? rect.frame.h);
      list.push(Object.freeze({ url: page.url, x: rect.frame.x - (rect.spriteSourceSize?.x ?? 0), y: rect.frame.y - (rect.spriteSourceSize?.y ?? 0),
        pageWidth: page.data.meta.size.w, pageHeight: page.data.meta.size.h, ticks: Math.max(1, frame.ticks | 0) }));
    }
    if (list.length) resolved.set(id, Object.freeze(list));
  }
  if (!resolved.size) throw new Error("SHOWCASE_MOTION_EMPTY");
  return Object.freeze({ speciesId, density: runtime.artProfile?.scale ?? config.density, anchor: runtime.artProfile?.anchor ?? { x: 0.5, y: 0.9 },
    frameWidth, frameHeight, sequences: resolved });
}

/**
 * One animated sprite element. `scale` maps packed atlas pixels to CSS px.
 * play(sequenceId) loops that sequence; setFacing(+1|-1) mirrors with a flip.
 */
export function createSpriteMotion({ doc = globalThis.document, motion, scale = 0.5, reducedMotion = false }) {
  const element = doc.createElement("div");
  element.className = "cm-sprite";
  const body = doc.createElement("div");
  body.className = "cm-sprite__body";
  element.append(body);
  const width = Math.round(motion.frameWidth * scale), height = Math.round(motion.frameHeight * scale);
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  body.style.width = `${width}px`;
  body.style.height = `${height}px`;
  let animation = null, flip = null, facing = -1, current = null;
  const style = frame => ({
    backgroundImage: `url("${frame.url}")`,
    backgroundSize: `${Math.round(frame.pageWidth * scale)}px ${Math.round(frame.pageHeight * scale)}px`,
    backgroundPosition: `${-Math.round(frame.x * scale)}px ${-Math.round(frame.y * scale)}px`
  });
  function play(sequenceId) {
    const frames = motion.sequences.get(sequenceId) ?? motion.sequences.get(0) ?? motion.sequences.values().next().value;
    if (!frames) return false;
    current = sequenceId;
    animation?.cancel();
    animation = null;
    Object.assign(body.style, style(frames[0]));
    if (frames.length < 2 || reducedMotion || typeof body.animate !== "function") return true;
    const total = frames.reduce((sum, frame) => sum + frame.ticks, 0);
    let elapsed = 0;
    const keyframes = frames.map(frame => {
      const keyframe = { ...style(frame), offset: elapsed / total, easing: "step-end" };
      elapsed += frame.ticks;
      return keyframe;
    });
    keyframes.push({ ...style(frames[frames.length - 1]), offset: 1 });
    animation = body.animate(keyframes, { duration: total * TICK_MS, iterations: Infinity });
    return true;
  }
  function setFacing(next) {
    const value = next >= 0 ? 1 : -1;
    if (value === facing) return facing;
    facing = value;
    flip?.cancel();
    const to = facing > 0 ? "scaleX(-1)" : "scaleX(1)";
    if (!reducedMotion && typeof element.animate === "function") {
      flip = element.animate([{ transform: facing > 0 ? "scaleX(1)" : "scaleX(-1)" }, { transform: "scaleX(0.05)", offset: 0.5 }, { transform: to }],
        { duration: 240, easing: "ease-in-out", fill: "forwards" });
    }
    element.style.transform = to;
    element.dataset.facing = facing > 0 ? "right" : "left";
    return facing;
  }
  element.dataset.facing = "left";
  return Object.freeze({
    element, width, height,
    play, setFacing,
    /** Hold the loop while the viewer is hidden; resume() picks it up again. */
    pause() { animation?.pause(); },
    resume() { if (animation?.playState === "paused") animation.play(); },
    getFacing: () => facing,
    getSequence: () => current,
    /** A still copy of the current frame (dash afterimages). */
    snapshot() {
      const copy = doc.createElement("div");
      copy.className = "cm-sprite cm-sprite--ghost";
      copy.style.width = element.style.width; copy.style.height = element.style.height;
      copy.style.transform = element.style.transform;
      const still = doc.createElement("div");
      still.className = "cm-sprite__body";
      const computed = globalThis.getComputedStyle?.(body);
      for (const key of ["width", "height", "backgroundImage", "backgroundSize", "backgroundPosition"]) still.style[key] = computed?.[key] || body.style[key];
      copy.append(still);
      return copy;
    },
    dispose() {
      animation?.cancel(); flip?.cancel();
      animation = flip = null;
      body.style.backgroundImage = "none";
      element.remove();
    }
  });
}
