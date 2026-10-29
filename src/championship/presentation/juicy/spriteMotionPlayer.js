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
import { monsterVisualAnchor } from "../../data/monsterVisualAnchors218.js";
import { loadReviewedDomFrames } from "../reviewedSelection.js";

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

/** `species-021` for 21; ids pass through. */
export function showcaseSpeciesId(ref) {
  if (Number.isSafeInteger(ref)) return `species-${String(ref).padStart(3, "0")}`;
  return typeof ref === "string" && ref ? ref : null;
}

// One load per species and page: the Dex hero, the special and the evolution
// previews share it (a handful of small JSON files and one atlas page each).
const motionCache = new Map();
const MOTION_CACHE_LIMIT = 8;

/**
 * The species' showcase motion, loaded once and shared. A failed or aborted
 * load is forgotten so a later request tries again.
 */
export function loadShowcaseMotionShared(speciesId, { fetchImpl, baseUrl = globalThis.location?.href } = {}) {
  const key = `${speciesId}|${baseUrl ?? ""}`;
  let entry = motionCache.get(key);
  if (!entry) {
    entry = loadShowcaseMotion(speciesId, { baseUrl, ...(fetchImpl ? { fetchImpl } : {}) });
    entry.catch(() => { if (motionCache.get(key) === entry) motionCache.delete(key); });
    motionCache.set(key, entry);
    while (motionCache.size > MOTION_CACHE_LIMIT) motionCache.delete(motionCache.keys().next().value);
  }
  return entry;
}

/**
 * Load the frames of the showcase sequences for one species.
 * Resolves { bounds, frameWidth, frameHeight, anchor, sequences: Map(id -> frames), release, muzzle }.
 *
 * Every atlas frame is TRIMMED: `frame` is the packed rectangle and
 * `spriteSourceSize` places it inside a much larger source canvas (256 px for a
 * 64-cell character). Only the packed rectangle may be shown -- a source-sized
 * window over the page shows the neighbouring frames too (the "four in a row"
 * strip). Each frame is kept as { url, x, y, w, h (the packed rect), ox, oy
 * (its top-left from the foot origin, source px), pageWidth, pageHeight, ticks }.
 * `bounds` is the union of the loaded frames round the foot origin, so a host
 * can stand the body on a pad and fit what is actually drawn.
 */
export async function loadShowcaseMotion(speciesId, { signal = null, baseUrl = globalThis.location?.href,
  fetchImpl = (...args) => globalThis.fetch(...args), sequences = SHOWCASE_ACTIONS.map(action => action.sequence) } = {}) {
  const config = publicCharacterConfig(speciesId);
  if (!config || !baseUrl || !isOriginalRuntimeLocation(baseUrl)) throw new Error("SHOWCASE_MOTION_UNAVAILABLE");
  // Species drawn with reviewed artwork show it (their original pages are retired).
  const reviewed = await loadReviewedDomFrames(speciesId, { href: baseUrl, fetchImpl, signal, sequences });
  if (reviewed) return reviewedShowcaseMotion(speciesId, reviewed);
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
  const anchor = runtime.artProfile?.anchor ?? { x: 0.5, y: 0.9 };
  const origins = runtime.geometry?.frames ?? {};
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const resolved = new Map();
  for (const [id, frames] of wanted) {
    const list = [];
    for (const frame of frames) {
      const page = atlasData.get(pageOf[frame.texture] ?? 0);
      const rect = page?.data.frames?.[frame.texture];
      if (!rect || rect.rotated || !(rect.frame?.w > 0) || !(rect.frame?.h > 0)) continue;
      const sourceW = rect.sourceSize?.w ?? rect.frame.w, sourceH = rect.sourceSize?.h ?? rect.frame.h;
      // The foot origin: the geometry's own per-cell origin, else the profile anchor.
      const origin = Array.isArray(origins[frame.texture]?.origin) ? origins[frame.texture].origin : [anchor.x * sourceW, anchor.y * sourceH];
      const ox = (rect.spriteSourceSize?.x ?? 0) - origin[0], oy = (rect.spriteSourceSize?.y ?? 0) - origin[1];
      bounds.left = Math.min(bounds.left, ox); bounds.top = Math.min(bounds.top, oy);
      bounds.right = Math.max(bounds.right, ox + rect.frame.w); bounds.bottom = Math.max(bounds.bottom, oy + rect.frame.h);
      list.push(Object.freeze({ url: page.url, x: rect.frame.x, y: rect.frame.y, w: rect.frame.w, h: rect.frame.h, ox, oy,
        pageWidth: page.data.meta.size.w, pageHeight: page.data.meta.size.h, ticks: Math.max(1, frame.ticks | 0) }));
    }
    if (list.length) resolved.set(id, Object.freeze(list));
  }
  if (!resolved.size) throw new Error("SHOWCASE_MOTION_EMPTY");
  // The feet stand on the origin even when a cell is drawn wholly above it.
  bounds.bottom = Math.max(bounds.bottom, 0);
  const release = new Map([...resolved].map(([id, frames]) => [id, showcaseReleaseFrame(frames)]));
  return Object.freeze({ speciesId, density: runtime.artProfile?.scale ?? config.density, anchor, bounds: Object.freeze(bounds),
    frameWidth: bounds.right - bounds.left, frameHeight: bounds.bottom - bounds.top, sequences: resolved, release,
    muzzle: calibratedMuzzle(speciesId) ?? showcaseMuzzle(resolved.get(SHOWCASE_ATTACK_SEQUENCE) ?? resolved.get(0), release.get(SHOWCASE_ATTACK_SEQUENCE)) });
}

/**
 * Reviewed artwork (reviewedSelection.js): each frame is a trimmed crop on a
 * shared page, placed from the pivot -- the same cell model as the atlas, with
 * the page size unknown (the body then draws the crop 1:1 and scales it). A set
 * drawn facing right (facesRight) has its forward edge on the right.
 */
function reviewedShowcaseMotion(speciesId, reviewed) {
  const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  const resolved = new Map();
  for (const [id, steps] of reviewed.sequences) {
    const list = steps.map(step => {
      const [x, y, w, h] = step.rect, [ox, oy] = step.place;
      bounds.left = Math.min(bounds.left, ox); bounds.top = Math.min(bounds.top, oy);
      bounds.right = Math.max(bounds.right, ox + w); bounds.bottom = Math.max(bounds.bottom, oy + h);
      return Object.freeze({ url: step.url, x, y, w, h, ox, oy, pageWidth: null, pageHeight: null, ticks: Math.max(1, step.ticks | 0), mirror: step.mirror === true });
    });
    if (list.length) resolved.set(id, Object.freeze(list));
  }
  if (!resolved.size) throw new Error("SHOWCASE_MOTION_EMPTY");
  bounds.bottom = Math.max(bounds.bottom, 0);
  const facesRight = reviewed.facesRight === true;
  const release = new Map([...resolved].map(([id, frames]) => [id, showcaseReleaseFrame(frames, facesRight)]));
  return Object.freeze({ speciesId, density: reviewed.density, anchor: { x: 0.5, y: 1 }, bounds: Object.freeze(bounds), reviewed: true, facesRight,
    frameWidth: bounds.right - bounds.left, frameHeight: bounds.bottom - bounds.top, sequences: resolved, release,
    muzzle: calibratedMuzzle(speciesId) ?? showcaseMuzzle(resolved.get(SHOWCASE_ATTACK_SEQUENCE) ?? resolved.get(0), release.get(SHOWCASE_ATTACK_SEQUENCE), facesRight) });
}

/** The offline-calibrated muzzle (scripts/calibrate-218-visual-anchors.mjs: the release cell's pixels), when known. */
function calibratedMuzzle(speciesId) {
  const socket = monsterVisualAnchor(speciesId)?.motion?.muzzleSocket;
  return socket ? Object.freeze({ x: socket.x, y: socket.y }) : null;
}

export const SHOWCASE_ATTACK_SEQUENCE = 7;

/**
 * The beat a move leaves the body: the cell that reaches furthest forward
 * (characters are authored facing left, so the smallest left edge; a set drawn
 * facing right, the largest right edge), the later one on a tie.
 * { index, atMs } -- atMs is when that cell starts.
 */
export function showcaseReleaseFrame(frames, facesRight = false) {
  if (!frames?.length) return Object.freeze({ index: 0, atMs: 0 });
  const behind = frame => (facesRight ? -(frame.ox + frame.w) : frame.ox);
  let index = 0;
  frames.forEach((frame, i) => { if (behind(frame) <= behind(frames[index])) index = i; });
  const atMs = frames.slice(0, index).reduce((sum, frame) => sum + frame.ticks, 0) * TICK_MS;
  return Object.freeze({ index, atMs: Math.round(atMs) });
}

/**
 * Where a breath, beam or bubble leaves the body, from the foot origin in
 * source px in the art's own direction: the head of the release cell -- a
 * quarter of its width ahead of its centre and two thirds of its height up.
 */
export function showcaseMuzzle(frames, release, facesRight = false) {
  const frame = frames?.[release?.index ?? 0] ?? frames?.[0];
  if (!frame) return null;
  const height = Math.max(1, -frame.oy);
  return Object.freeze({ x: frame.ox + frame.w * (facesRight ? 0.76 : 0.24), y: -height * 0.66 });
}

/**
 * The scale (CSS px per packed atlas px) that fits a motion's drawn body into
 * a box standing on its feet, snapped to whole screen pixels per native pixel
 * so pixel art stays crisp. `maxNative` caps the CSS px per native pixel.
 */
export function showcaseFitScale(motion, { width, height, maxNative = 6, minNative = 1 }) {
  const b = motion.bounds;
  // Turning mirrors round the foot, so the wider side counts twice.
  const across = 2 * Math.max(-b.left, b.right, 1), up = Math.max(-b.top, 1);
  const density = Math.max(1, motion.density || 1);
  const fit = Math.min(width / across, height / up);
  const native = Math.max(minNative, Math.min(maxNative, Math.floor(fit * density * 2) / 2));
  return native / density;
}

/**
 * One animated sprite element. `scale` maps packed atlas pixels to CSS px.
 * play(sequenceId) loops that sequence; setFacing(+1|-1) mirrors with a flip.
 *
 * The element is the drawn bounds of the loaded frames; the body inside shows
 * exactly one packed cell at a time (its own size and offset per frame), so a
 * page never shows more than the current cell. The foot origin sits at
 * (footX, footY) in the element, published as --cm-sprite-ax / --cm-sprite-below
 * so a host can stand it on a pad with the .cm-sprite--footed rule.
 *
 * `grounded` brings an airborne cell (one drawn wholly above the feet, such as
 * a tackle's hop) down onto the ground, so a ranged move is cast standing on
 * the pad; the muzzle follows the cell.
 */
export function createSpriteMotion({ doc = globalThis.document, motion, scale = 0.5, reducedMotion = false, grounded = false }) {
  const element = doc.createElement("div");
  element.className = "cm-sprite cm-sprite--footed";
  const body = doc.createElement("div");
  body.className = "cm-sprite__body";
  element.append(body);
  const b = motion.bounds;
  const px = value => `${Math.round(value * scale * 100) / 100}px`;
  const width = Math.round((b.right - b.left) * scale), height = Math.round((b.bottom - b.top) * scale);
  const footX = -b.left * scale, footY = -b.top * scale;
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.style.setProperty("--cm-sprite-ax", px(-b.left));
  element.style.setProperty("--cm-sprite-below", px(b.bottom));
  element.style.transformOrigin = `${px(-b.left)} ${px(-b.top)}`;
  let animation = null, flip = null, facing = -1, current = null, once = null;
  // A cell's drawn bottom is its packed rectangle's bottom (cells are trimmed to their pixels).
  const lift = frame => (grounded ? Math.max(0, -(frame.oy + frame.h)) : 0);
  // Atlas cells (known page size) are drawn at scale; reviewed crops (page size
  // unknown) are drawn 1:1 and scaled by the transform, from the body's corner.
  body.style.transformOrigin = "0 0";
  const style = frame => frame.pageWidth ? ({
    width: px(frame.w),
    height: px(frame.h),
    transform: `translate(${px(frame.ox - b.left)}, ${px(frame.oy + lift(frame) - b.top)})`,
    backgroundImage: `url("${frame.url}")`,
    backgroundSize: `${px(frame.pageWidth)} ${px(frame.pageHeight)}`,
    backgroundPosition: `${px(-frame.x)} ${px(-frame.y)}`
  }) : ({
    width: `${frame.w}px`,
    height: `${frame.h}px`,
    // A reviewed crop drawn facing opposite to its set (mirror) is flipped into its
    // place, which reviewedSelection already mirrored about the pivot.
    transform: frame.mirror
      ? `translate(${px(frame.ox + frame.w - b.left)}, ${px(frame.oy + lift(frame) - b.top)}) scale(${-scale}, ${scale})`
      : `translate(${px(frame.ox - b.left)}, ${px(frame.oy + lift(frame) - b.top)}) scale(${scale})`,
    backgroundImage: `url("${frame.url}")`,
    backgroundSize: "auto",
    backgroundPosition: `${-frame.x}px ${-frame.y}px`
  });
  const framesOf = sequenceId => motion.sequences.get(sequenceId) ?? motion.sequences.get(0) ?? motion.sequences.values().next().value;
  /** Loop a sequence, or with { loop: false } play it once and hold its last cell (onEnd then). */
  function play(sequenceId, { loop = true, onEnd = null } = {}) {
    const frames = framesOf(sequenceId);
    if (!frames) return false;
    current = sequenceId;
    animation?.cancel();
    animation = null;
    once = null;
    Object.assign(body.style, style(loop || reducedMotion ? frames[0] : frames[frames.length - 1]));
    body.dataset.cells = String(frames.length);
    if (frames.length < 2 || reducedMotion || typeof body.animate !== "function") { onEnd?.(); return true; }
    const total = frames.reduce((sum, frame) => sum + frame.ticks, 0);
    let elapsed = 0;
    const keyframes = frames.map(frame => {
      const keyframe = { ...style(frame), offset: elapsed / total, easing: "step-end" };
      elapsed += frame.ticks;
      return keyframe;
    });
    keyframes.push({ ...style(frames[frames.length - 1]), offset: 1 });
    animation = body.animate(keyframes, { duration: total * TICK_MS, iterations: loop ? Infinity : 1, fill: loop ? "none" : "forwards" });
    if (!loop) {
      const run = once = animation;
      animation.finished.then(() => { if (once === run) onEnd?.(); }, () => {});
    }
    return true;
  }
  // Art faces left; a reviewed set drawn facing right (motion.facesRight) flips the baseline.
  const mirrorFor = value => (value > 0) !== Boolean(motion.facesRight);
  if (motion.facesRight) element.style.transform = "scaleX(-1)";
  function setFacing(next) {
    const value = next >= 0 ? 1 : -1;
    if (value === facing) return facing;
    facing = value;
    flip?.cancel();
    const to = mirrorFor(facing) ? "scaleX(-1)" : "scaleX(1)";
    if (!reducedMotion && typeof element.animate === "function") {
      flip = element.animate([{ transform: mirrorFor(facing) ? "scaleX(1)" : "scaleX(-1)" }, { transform: "scaleX(0.05)", offset: 0.5 }, { transform: to }],
        { duration: 240, easing: "ease-in-out", fill: "forwards" });
    }
    element.style.transform = to;
    element.dataset.facing = facing > 0 ? "right" : "left";
    return facing;
  }
  element.dataset.facing = "left";
  return Object.freeze({
    element, width, height, footX, footY, scale,
    play, setFacing,
    /** The release beat of a sequence in ms (when its forward-most cell starts). */
    releaseMs: sequenceId => motion.release?.get(sequenceId)?.atMs ?? 0,
    /** The muzzle from the feet in CSS px, for the current facing (+x right, -y up). */
    muzzle() {
      const m = motion.muzzle;
      if (!m) return null;
      const attack = motion.sequences.get(SHOWCASE_ATTACK_SEQUENCE);
      const cell = attack?.[motion.release?.get(SHOWCASE_ATTACK_SEQUENCE)?.index ?? 0];
      return { dx: m.x * scale * (mirrorFor(facing) ? -1 : 1), dy: (m.y + (cell ? lift(cell) : 0)) * scale };
    },
    /** The drawn body's height above the feet in CSS px. */
    bodyHeight: () => -b.top * scale,
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
      copy.style.transformOrigin = element.style.transformOrigin;
      const still = doc.createElement("div");
      still.className = "cm-sprite__body";
      const computed = globalThis.getComputedStyle?.(body);
      for (const key of ["width", "height", "transform", "transformOrigin", "backgroundImage", "backgroundSize", "backgroundPosition"]) still.style[key] = computed?.[key] || body.style[key];
      copy.append(still);
      return copy;
    },
    dispose() {
      animation?.cancel(); flip?.cancel();
      animation = flip = once = null;
      body.style.backgroundImage = "none";
      element.remove();
    }
  });
}
