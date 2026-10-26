// Loading walker (Owner 2026-10-27): a loading screen is a bar with a partner
// walking along it, drawn with the partner's own in-game walk animation.
//
// The art comes through the title parade's approved path (loadParadeWalker:
// public catalog, original-runtime location gate, runtime SHA-256, render
// validation). A partner whose files this page already fetched is preferred,
// so the walker rarely competes with the download it decorates. Anywhere the
// art is refused, with data saving, or the saver quality, the bar stands alone.
// Presentation only: it never touches loading, simulation, input or the Pixi ticker.

import { publicCharacterConfigs } from "../../presentation/publicCharacterCatalog.js";
import { loadParadeWalker, pickParadeSpecies } from "../titleParade.js";

const TICK_HZ = 60;

/** Prefer a partner whose runtime file this page already fetched (it is cached). */
export function pickLoadingWalkerSpecies(configs, fetched = [], random = Math.random) {
  const seen = new Set(fetched.map((url) => { try { return new URL(url).pathname; } catch { return url; } }));
  const cached = configs.filter((entry) => entry?.runtimePath && [...seen].some((path) => path.endsWith(entry.runtimePath.replace(/^\.?\//, ""))));
  return pickParadeSpecies(cached.length ? cached : configs, 1, random)[0] ?? null;
}

function loadImageElement(doc) {
  return (src, signal) => new Promise((resolve, reject) => {
    const image = doc.createElement("img");
    image.decoding = "async";
    const abort = () => { image.src = ""; reject(new DOMException("aborted", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    image.onload = () => { signal?.removeEventListener("abort", abort); resolve(image); };
    image.onerror = () => { signal?.removeEventListener("abort", abort); reject(Error("LOADING_WALKER_IMAGE")); };
    image.src = src;
  });
}

/**
 * A partner walking along `track` (the bar). setProgress(0..1) moves it to the
 * fill's edge; setProgress(null) lets it pace while the size is unknown.
 */
export function mountLoadingWalker(track, { doc = globalThis.document, view = globalThis, href = () => view.location?.href,
  fetchImpl = globalThis.fetch?.bind(globalThis), random = Math.random } = {}) {
  const none = Object.freeze({ setProgress() {}, dispose() {}, get ready() { return false; } });
  if (!track || typeof view?.requestAnimationFrame !== "function") return none;
  const root = doc.documentElement;
  if (root?.dataset.quality === "saver" || view.navigator?.connection?.saveData === true) return none;
  const controller = new AbortController();
  const holder = doc.createElement("span");
  holder.className = "cm-load-walker";
  holder.setAttribute("aria-hidden", "true");
  track.append(holder);
  let art = null, ctx = null, canvas = null, frame = 0, last = 0, tick = 0, index = 0, drawn = -1;
  let target = null, x = 0, dir = 1;
  const reduced = () => root?.dataset.motion === "reduced" || Boolean(view.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  function draw() {
    if (!art || drawn === index) return;
    drawn = index;
    const current = art.frames[index];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(current.image, current.rect.x, current.rect.y, current.rect.w, current.rect.h, 0, 0, canvas.width, canvas.height);
  }
  function step(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const still = reduced();
    if (target === null) {
      // Size unknown: pace the bar, turning at its ends.
      if (!still) x += dir * 0.18 * dt;
      if (x > 0.96 || x < 0.04) { dir *= -1; x = Math.min(0.96, Math.max(0.04, x)); }
    } else {
      const goal = Math.min(0.97, Math.max(0.03, target));
      dir = goal >= x ? 1 : -1;
      x = still ? goal : x + (goal - x) * Math.min(1, dt * 4);
    }
    const walking = !still && (target === null || Math.abs((target ?? x) - x) > 0.002 || target < 1);
    if (walking) {
      tick += dt * TICK_HZ;
      while (tick >= art.frames[index].ticks) { tick -= art.frames[index].ticks; index = (index + 1) % art.frames.length; }
    } else index = 0;
    draw();
    holder.style.left = `${(x * 100).toFixed(2)}%`;
    // Art faces left; mirror while walking right.
    holder.style.transform = `translateX(-50%) scaleX(${dir > 0 ? -1 : 1})`;
    frame = view.requestAnimationFrame(step);
  }

  (async () => {
    try {
      const fetched = view.performance?.getEntriesByType?.("resource")?.map((entry) => entry.name) ?? [];
      const speciesId = pickLoadingWalkerSpecies(publicCharacterConfigs(), fetched, random);
      if (!speciesId) return;
      const loaded = await loadParadeWalker(speciesId, { href: href(), fetchImpl, signal: controller.signal, loadImage: loadImageElement(doc) });
      if (!loaded || controller.signal.aborted) return;
      art = loaded;
      canvas = doc.createElement("canvas");
      canvas.width = art.frames[0].rect.w;
      canvas.height = art.frames[0].rect.h;
      ctx = canvas.getContext("2d");
      holder.append(canvas);
      holder.dataset.ready = "true";
      frame = view.requestAnimationFrame(step);
    } catch { /* the bar stands alone */ }
  })();

  return Object.freeze({
    setProgress(value) { target = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null; },
    get ready() { return Boolean(art); },
    dispose() {
      controller.abort();
      if (frame) view.cancelAnimationFrame?.(frame);
      frame = 0;
      holder.remove();
    }
  });
}
