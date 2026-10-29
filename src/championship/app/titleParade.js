// Title parade (Owner 2026-10-26): the arcade rebuild's partners strolling along the
// foot of the title, drawn with each character's own in-game walk animation.
//
// Art comes only through the existing approved path: the public character catalog
// (hash-selected), the original-runtime location gate, the runtime's SHA-256 and
// the public render validation -- the same steps the Data Arena takes. Anywhere the
// gate refuses, or with data saving / the saver quality, there is simply no parade.
//
// It runs only while the title is shown: walkers load one at a time after the
// title can be entered (so the game's own preload goes first), each appears when
// ready, and leaving the title aborts loading and stops the frame loop. The loop is
// presentation-only and never touches simulation, input or the Pixi ticker.

import { publicCharacterConfigs, publicCharacterConfig } from "../presentation/publicCharacterCatalog.js";
import { validatePublicCharacterRender } from "../presentation/publicCharacterRoster.js";
import { isOriginalRuntimeLocation } from "../presentation/originalRuntimeLocation.js";
import { speciesNameForId } from "../text/zhHant.js";
import { loadReviewedDomFrames } from "../presentation/reviewedSelection.js";

/** The in-game walk request (Data Arena and Battle sequence id 2). */
export const TITLE_PARADE_WALK_SEQUENCE = 2;
export const TITLE_PARADE_SIZE = 4;
/** The rebuild's six strollers where the screen is wide enough. */
export const TITLE_PARADE_WIDE_SIZE = 6;
const TICK_HZ = 60;

/** Pick `count` distinct catalog species, the walk sequence permitting. */
export function pickParadeSpecies(configs, count = TITLE_PARADE_SIZE, random = Math.random) {
  const pool = configs.filter((entry) => entry?.speciesId && !/digitama|egg/i.test(entry.entityId ?? ""));
  const picked = [];
  while (pool.length && picked.length < count) picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0].speciesId);
  return picked;
}

async function sha256(text) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** One walker's frames: [{ image, rect, ticks }], or null when the art is not available. */
export async function loadParadeWalker(speciesId, { href, fetchImpl = globalThis.fetch, signal, loadImage } = {}) {
  const config = publicCharacterConfig(speciesId);
  if (!config || !href || !isOriginalRuntimeLocation(href)) return null;
  // Species drawn with reviewed artwork walk with it (their original pages are retired).
  const reviewed = await loadReviewedDomFrames(speciesId, { href, fetchImpl, signal, sequences: [TITLE_PARADE_WALK_SEQUENCE] });
  if (reviewed) return reviewedParadeWalker(speciesId, reviewed, { signal, loadImage });
  const runtimeUrl = new URL(config.runtimePath, href);
  const response = await fetchImpl(runtimeUrl.href, { signal });
  if (!response.ok) return null;
  const text = await response.text();
  if (await sha256(text) !== config.runtimeSha256) throw Error("TITLE_PARADE_ART_HASH");
  const runtime = JSON.parse(text);
  await validatePublicCharacterRender(runtime, config);
  const walk = runtime.sides?.main?.animations?.find((animation) => animation.id === TITLE_PARADE_WALK_SEQUENCE);
  if (!walk?.frames?.length) return null;
  const pages = new Map();
  const frames = [];
  for (const frame of walk.frames) {
    const pageIndex = runtime.streaming?.texturePages?.[frame.texture] ?? 0;
    if (!pages.has(pageIndex)) {
      const atlas = runtime.sides.main.atlases[pageIndex];
      const dataResponse = await fetchImpl(new URL(atlas.data, runtimeUrl).href, { signal });
      if (!dataResponse.ok) return null;
      const data = await dataResponse.json();
      const image = await loadImage(new URL(atlas.image, runtimeUrl).href, signal);
      pages.set(pageIndex, { data, image });
    }
    const page = pages.get(pageIndex);
    const rect = page.data.frames?.[frame.texture]?.frame;
    if (!rect) return null;
    frames.push({ image: page.image, rect, ticks: Math.max(1, frame.ticks ?? 8) });
  }
  return { speciesId, name: speciesNameForId(speciesId), frames, anchor: runtime.artProfile?.anchor ?? { x: 0.5, y: 0.9 } };
}

/** Reviewed frames are trimmed crops: place each on one shared canvas by its pivot. */
async function reviewedParadeWalker(speciesId, reviewed, { signal, loadImage }) {
  const steps = reviewed.sequences.get(TITLE_PARADE_WALK_SEQUENCE);
  const left = Math.min(...steps.map((s) => s.place[0])), top = Math.min(...steps.map((s) => s.place[1]));
  const width = Math.max(...steps.map((s) => s.place[0] + s.rect[2])) - left, height = Math.max(...steps.map((s) => s.place[1] + s.rect[3])) - top;
  const images = new Map();
  const frames = [];
  for (const step of steps) {
    if (!images.has(step.url)) images.set(step.url, await loadImage(step.url, signal));
    const [x, y, w, h] = step.rect;
    frames.push({ image: images.get(step.url), rect: { x, y, w, h }, ticks: step.ticks, place: { x: step.place[0] - left, y: step.place[1] - top } });
  }
  return { speciesId, name: speciesNameForId(speciesId), frames, canvas: { w: width, h: height }, facesRight: reviewed.facesRight,
    anchor: { x: -left / width, y: -top / height } };
}

function loadImageElement(doc) {
  return (src, signal) => new Promise((resolve, reject) => {
    const image = doc.createElement("img");
    image.decoding = "async";
    const abort = () => { image.src = ""; reject(new DOMException("aborted", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    image.onload = () => { signal?.removeEventListener("abort", abort); resolve(image); };
    image.onerror = () => { signal?.removeEventListener("abort", abort); reject(Error("TITLE_PARADE_IMAGE")); };
    image.src = src;
  });
}

/**
 * Install once. Watches the title; while it is shown and enterable, a parade walks
 * along its foot. Returns a disposer.
 */
export function installTitleParade({ doc = globalThis.document, view = globalThis, href = () => view.location?.href, fetchImpl = globalThis.fetch?.bind(globalThis), random = Math.random } = {}) {
  const title = doc?.getElementById?.("cm-title");
  const login = doc?.getElementById?.("cm-login");
  if (!title || typeof view.requestAnimationFrame !== "function") return () => {};
  let host = null, controller = null, frame = 0, last = 0;
  const walkers = [];

  const saving = () => doc.documentElement?.dataset.quality === "saver" || view.navigator?.connection?.saveData === true;
  const reduced = () => doc.documentElement?.dataset.motion === "reduced";
  const titleReady = () => !title.hidden && (login ? !login.disabled || login.hidden : true);

  function start() {
    if (controller || saving() || !titleReady()) return;
    controller = new AbortController();
    host = doc.createElement("div");
    host.className = "cm-title__parade";
    host.setAttribute("aria-hidden", "true");
    (title.querySelector(".cm-title__panel") ?? title).append(host);
    const signal = controller.signal;
    const size = (view.innerWidth ?? 0) > 900 ? TITLE_PARADE_WIDE_SIZE : TITLE_PARADE_SIZE;
    const species = pickParadeSpecies(publicCharacterConfigs(), size, random);
    (async () => {
      for (const speciesId of species) {
        if (signal.aborted) return;
        try {
          const art = await loadParadeWalker(speciesId, { href: href(), fetchImpl, signal, loadImage: loadImageElement(doc) });
          if (art && !signal.aborted) addWalker(art);
        } catch (error) {
          if (signal.aborted) return;
          // A walker that cannot load is left out; the title never waits on it.
        }
      }
    })();
  }

  function addWalker(art) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "cm-title__walker";
    button.tabIndex = -1;
    const canvas = doc.createElement("canvas");
    // Drawn 1:1 from the 4x atlas; CSS scales it down smoothly (nearest downscaling shimmers).
    const height = art.canvas?.h ?? art.frames[0].rect.h, scale = 1;
    canvas.width = Math.round((art.canvas?.w ?? art.frames[0].rect.w) * scale);
    canvas.height = height;
    button.append(canvas);
    host.append(button);
    const walker = { art, button, canvas, ctx: canvas.getContext("2d"), scale, x: 0.08 + random() * 0.84, dir: random() < 0.5 ? -1 : 1,
      speed: 0.025 + random() * 0.03, pause: random() * 1.5, frameIndex: 0, tick: 0, drawn: -1 };
    button.addEventListener("pointerdown", () => { walker.pause = 1.2; });
    walkers.push(walker);
    if (!frame) { last = 0; frame = view.requestAnimationFrame(step); }
  }

  function draw(walker) {
    const current = walker.art.frames[walker.frameIndex];
    if (walker.drawn === walker.frameIndex || !walker.ctx) return;
    walker.drawn = walker.frameIndex;
    const { ctx, canvas } = walker;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (current.place) ctx.drawImage(current.image, current.rect.x, current.rect.y, current.rect.w, current.rect.h, current.place.x, current.place.y, current.rect.w, current.rect.h);
    else ctx.drawImage(current.image, current.rect.x, current.rect.y, current.rect.w, current.rect.h, 0, 0, canvas.width, canvas.height);
  }

  function step(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    for (const walker of walkers) {
      if (walker.pause > 0) {
        walker.pause -= dt;
        walker.frameIndex = 0;
      } else {
        if (!reduced()) walker.x += walker.dir * walker.speed * dt;
        if (walker.x < 0.04 || walker.x > 0.96) { walker.dir *= -1; walker.x = Math.min(0.96, Math.max(0.04, walker.x)); walker.pause = 0.6 + random(); }
        else if (random() < dt * 0.12) walker.pause = 0.8 + random() * 1.6;
        // The art's own walk timing at its 60 Hz tick rate.
        walker.tick += dt * TICK_HZ;
        const frames = walker.art.frames;
        while (walker.tick >= frames[walker.frameIndex].ticks) { walker.tick -= frames[walker.frameIndex].ticks; walker.frameIndex = (walker.frameIndex + 1) % frames.length; }
      }
      draw(walker);
      // Art faces left (reviewed sets drawn facing right say so); mirror while walking the other way.
      walker.button.style.transform = `translateX(-50%) scaleX(${(walker.dir > 0) !== Boolean(walker.art.facesRight) ? -1 : 1})`;
      walker.button.style.left = `${(walker.x * 100).toFixed(3)}%`;
      walker.button.dataset.walking = walker.pause > 0 ? "false" : "true";
    }
    frame = walkers.length ? view.requestAnimationFrame(step) : 0;
  }

  function stop() {
    controller?.abort();
    controller = null;
    if (frame) view.cancelAnimationFrame?.(frame);
    frame = 0;
    walkers.length = 0;
    host?.remove();
    host = null;
  }

  function sync() { if (titleReady()) start(); else stop(); }
  const observer = typeof view.MutationObserver === "function" ? new view.MutationObserver(sync) : null;
  observer?.observe(title, { attributes: true, attributeFilter: ["hidden"] });
  if (login) observer?.observe(login, { attributes: true, attributeFilter: ["disabled", "hidden"] });
  sync();
  return () => { observer?.disconnect(); stop(); };
}
