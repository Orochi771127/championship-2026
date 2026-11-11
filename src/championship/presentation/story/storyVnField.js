// Story mode exploration (OWNER_APPROVED_ADAPTATION 2026-11-11): a walkable
// field on a painted scene plate. The design follows the place model studied
// in the Moonlight research brief (one composed picture per place, walkability
// kept as data beside it, interactables as a list), built from our own art:
// the plate is a story scene (data/storyVnCampaign.js backgrounds), the walk
// area is a ground band in plate fractions, and every person, clue and exit
// is a spot {id, kind, at:[x%, y%]}.
//
// The player's partner walks where the player taps (straight line, clamped to
// the band). Tapping a spot walks the partner next to it and hands the spot to
// the director (storyVnDirector.js), which plays that spot's beats. The camera
// pans when the plate is wider than the window.
//
// DOM + CSS + Web Animations only, like the stage: a walk is one linear
// animation of the partner and one of the camera, with the same duration, so
// there is no frame loop. It owns no game state and writes nothing.

import { createSpriteMotion, showcaseFitScale } from "../juicy/spriteMotionPlayer.js";
import { juicyPortrait } from "../juicy/juicyArt.js";
import { STORY_VN_SEQUENCES } from "../../data/storyVnCampaign.js";
import { loadStoryVnMotion } from "./storyVnStage.js";

const SPEED = 0.26; // plate widths per second
const DEFAULT_WALK = Object.freeze([0.76, 0.95]);

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/**
 * Where the plate sits in the window: as tall as the window (so the camera pans
 * across a wide plate), or as wide as the window when the plate is narrower, with
 * the walk band kept in view.
 */
export function storyVnFieldLayout({ naturalWidth, naturalHeight, walk = DEFAULT_WALK }, { width, height }) {
  if (!naturalWidth || !naturalHeight || !width || !height) return null;
  const scale = Math.max(height / naturalHeight, width / naturalWidth);
  const w = naturalWidth * scale, h = naturalHeight * scale;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  // The middle of the walk band sits 70 % down the window.
  const top = clamp(height * 0.7 - ((walk[0] + walk[1]) / 2) * h, height - h, 0);
  return Object.freeze({ scale, width: w, height: h, top, panMin: Math.min(0, width - w) });
}

/** The point inside the walk band nearest to a plate fraction. */
export function storyVnFieldClamp([x, y], walk = DEFAULT_WALK) {
  return [Math.min(0.96, Math.max(0.04, x)), Math.min(walk[1], Math.max(walk[0], y))];
}

/** Depth scale: figures nearer the bottom of the band stand larger. */
export function storyVnFieldDepth(y, walk = DEFAULT_WALK) {
  const t = (y - walk[0]) / Math.max(0.01, walk[1] - walk[0]);
  return 0.82 + Math.min(1, Math.max(0, t)) * 0.3;
}

export function createStoryVnField({
  host, doc = host?.ownerDocument ?? globalThis.document, reducedMotion = false,
  loadMotion = loadStoryVnMotion, portraitOf = juicyPortrait, now = () => globalThis.performance?.now?.() ?? Date.now()
} = {}) {
  if (!host) throw new TypeError("STORY_VN_FIELD_HOST");
  const root = el(doc, "div", "cm-vn-field");
  root.dataset.state = "idle";
  const world = el(doc, "div", "cm-vn-field__world");
  const plate = el(doc, "img", "cm-vn-field__plate"); plate.alt = ""; plate.decoding = "async"; plate.draggable = false;
  const layer = el(doc, "div", "cm-vn-field__layer");
  const marker = el(doc, "i", "cm-vn-field__target");
  world.append(plate, marker, layer);
  root.append(world);
  host.append(root);

  let disposed = false, spec = null, layout = null, cam = 0, onSpot = null, onGround = null, paused = true;
  const spots = new Map(); // id -> { spot, node, sprite }
  const walker = { node: null, body: null, sprite: null, pos: [0.3, 0.86], facing: 1, runs: [], walk: null };
  const resizer = typeof globalThis.ResizeObserver === "function" ? new globalThis.ResizeObserver(() => { if (!disposed) relayout(); }) : null;
  resizer?.observe(root);

  const box = () => ({ w: Math.max(240, root.clientWidth || host.clientWidth || 390), h: Math.max(200, root.clientHeight || host.clientHeight || 440) });
  const walkBand = () => spec?.walk ?? DEFAULT_WALK;
  const px = ([x, y]) => [x * (layout?.width ?? box().w), y * (layout?.height ?? box().h)];
  const camFor = x => { const { w } = box(); return Math.min(0, Math.max(layout?.panMin ?? 0, w / 2 - x * (layout?.width ?? w))); };
  const placeAt = (node, pos) => {
    const [x, y] = px(pos);
    node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${storyVnFieldDepth(pos[1], walkBand()).toFixed(3)})`;
    node.style.zIndex = String(Math.round(pos[1] * 1000));
  };
  const placeWorld = () => { world.style.transform = `translate(${Math.round(cam)}px, ${Math.round(layout?.top ?? 0)}px)`; };

  function relayout() {
    const { w, h } = box();
    layout = spec && storyVnFieldLayout({ naturalWidth: plate.naturalWidth, naturalHeight: plate.naturalHeight, walk: walkBand() }, { width: w, height: h });
    if (layout) Object.assign(world.style, { width: `${Math.round(layout.width)}px`, height: `${Math.round(layout.height)}px` });
    stopWalk();
    cam = camFor(walker.pos[0]);
    placeWorld();
    if (walker.node) placeAt(walker.node, walker.pos);
    for (const entry of spots.values()) placeAt(entry.node, entry.spot.at.map(v => v / 100));
  }

  async function body(target, species, { image = null, height = 0.24 } = {}) {
    const fit = { width: box().w * 0.3, height: (layout?.height ?? box().h) * height };
    if (image) {
      const img = el(doc, "img", "cm-vn-field__image"); img.alt = ""; img.src = image; img.decoding = "async"; img.draggable = false;
      img.style.height = `${Math.round(fit.height)}px`; target.append(img); return null;
    }
    let motion = null;
    try { motion = species === null || species === undefined ? null : await loadMotion(species); } catch { motion = null; }
    if (disposed) return null;
    if (motion) {
      const sprite = createSpriteMotion({ doc, motion, scale: showcaseFitScale(motion, { ...fit, maxNative: 6, minNative: 1.5 }), reducedMotion });
      sprite.element.classList.add("cm-vn-field__sprite");
      target.append(sprite.element); sprite.play(STORY_VN_SEQUENCES.idle);
      return sprite;
    }
    const portrait = species === null || species === undefined ? null : portraitOf(species);
    if (portrait?.src) {
      const img = el(doc, "img", "cm-vn-field__image"); img.alt = ""; img.src = portrait.src; img.decoding = "async"; img.draggable = false;
      img.style.height = `${Math.round(fit.height * 0.85)}px`; target.append(img);
    }
    return null;
  }

  // ---- walking ----
  function currentPos() {
    const w = walker.walk;
    if (!w) return walker.pos;
    const t = Math.min(1, Math.max(0, (now() - w.start) / Math.max(1, w.ms)));
    return [w.from[0] + (w.to[0] - w.from[0]) * t, w.from[1] + (w.to[1] - w.from[1]) * t];
  }
  function stopWalk() {
    if (walker.walk) { walker.pos = currentPos(); cam = camFor(walker.pos[0]); }
    for (const run of walker.runs) { try { run.cancel(); } catch { /* gone */ } }
    walker.runs = []; walker.walk = null;
    if (walker.node) placeAt(walker.node, walker.pos);
    placeWorld();
  }
  function face(dir) { walker.facing = dir; walker.sprite?.setFacing(dir); if (walker.node) walker.node.dataset.facing = dir > 0 ? "right" : "left"; }
  /** Walk the partner to a plate fraction (clamped into the band); resolves on arrival (false if interrupted). */
  function walkTo(target) {
    if (!walker.node || disposed) return Promise.resolve(false);
    stopWalk();
    const to = storyVnFieldClamp(target, walkBand());
    const from = walker.pos;
    const dist = Math.hypot(to[0] - from[0], (to[1] - from[1]) * ((layout?.height ?? 1) / (layout?.width ?? 1)));
    if (Math.abs(to[0] - from[0]) > 0.005) face(to[0] > from[0] ? 1 : -1);
    const ms = Math.round(dist / SPEED * 1000);
    marker.dataset.on = "true"; placeAt(marker, to);
    if (ms < 40 || reducedMotion || typeof walker.node.animate !== "function") {
      walker.pos = to; cam = camFor(to[0]); placeAt(walker.node, to); placeWorld(); marker.dataset.on = "false";
      return Promise.resolve(true);
    }
    const startNode = walker.node.style.transform, startWorld = world.style.transform;
    walker.pos = to; placeAt(walker.node, to); cam = camFor(to[0]); placeWorld();
    walker.walk = { from, to, start: now(), ms };
    walker.sprite?.play(STORY_VN_SEQUENCES.walk, { loop: true });
    root.dataset.state = "walking";
    const a = walker.node.animate([{ transform: startNode }, { transform: walker.node.style.transform }], { duration: ms, easing: "linear" });
    const b = world.animate([{ transform: startWorld }, { transform: world.style.transform }], { duration: ms, easing: "linear" });
    walker.runs = [a, b];
    return a.finished.then(() => {
      if (walker.runs[0] !== a) return false;
      walker.walk = null; walker.runs = []; marker.dataset.on = "false";
      walker.sprite?.play(STORY_VN_SEQUENCES.idle, { loop: true });
      root.dataset.state = paused ? "paused" : "idle";
      return true;
    }, () => false);
  }

  // ---- spots ----
  function spotNode(spot) {
    const node = el(doc, "button", "cm-vn-field__spot"); node.type = "button";
    node.dataset.kind = spot.kind; node.dataset.spot = spot.id; node.dataset.state = spot.state ?? "open";
    const figure = el(doc, "span", "cm-vn-field__figure");
    const mark = el(doc, "span", "cm-vn-field__mark"); mark.setAttribute("aria-hidden", "true");
    const label = el(doc, "span", "cm-vn-field__label", spot.label ?? "");
    node.setAttribute("aria-label", spot.label ?? spot.id);
    node.append(figure, mark, label);
    node.addEventListener("click", event => { event.stopPropagation(); event.preventDefault(); void activate(spot.id); });
    return { node, figure };
  }
  async function activate(id) {
    const entry = spots.get(id);
    if (!entry || paused || disposed || entry.node.dataset.state === "hidden") return;
    const [x, y] = entry.spot.at.map(v => v / 100);
    // Stand beside a person or a thing; walk onto an exit.
    const side = walker.pos[0] < x ? -1 : 1;
    const stand = entry.spot.kind === "exit" ? [x, y] : [x + side * (entry.spot.reach ?? 0.07), Math.max(walkBand()[0], Math.min(walkBand()[1], y + 0.02))];
    const arrived = await walkTo(stand);
    if (!arrived || paused || disposed) return;
    if (entry.spot.kind !== "exit") face(x > walker.pos[0] ? 1 : -1);
    onSpot?.(id);
  }

  root.addEventListener("pointerdown", event => {
    if (paused || disposed || event.target.closest?.(".cm-vn-field__spot")) return;
    // Screen pixels to the hall's own pixels (they differ by the desktop interface zoom).
    const rect = root.getBoundingClientRect(), k = rect.width / (root.offsetWidth || rect.width || 1) || 1;
    const x = ((event.clientX - rect.left) / k - cam) / (layout?.width ?? rect.width / k);
    const y = ((event.clientY - rect.top) / k - (layout?.top ?? 0)) / (layout?.height ?? rect.height / k);
    onGround?.([x, y]);
    void walkTo([x, y]);
  });

  return Object.freeze({
    element: root,
    /** Show a field: the plate, the partner at `start`, and the spots. Resolves once laid out. */
    async open(field, { partnerSpecies = null, start = [0.3, 0.86], spotList = [] } = {}) {
      spec = field;
      root.dataset.field = field.id ?? "";
      await new Promise(resolve => {
        let done = false; const finish = () => { if (!done) { done = true; resolve(); } };
        plate.onload = finish; plate.onerror = finish; plate.src = field.src;
        if (plate.complete && plate.naturalWidth) finish();
        setTimeout(finish, 2500);
      });
      if (disposed) return;
      layer.replaceChildren(); spots.clear();
      walker.node = el(doc, "div", "cm-vn-field__walker");
      walker.body = el(doc, "span", "cm-vn-field__figure");
      walker.node.append(el(doc, "i", "cm-vn-field__shadow"), walker.body);
      layer.append(walker.node);
      walker.pos = storyVnFieldClamp(start, walkBand());
      relayout();
      walker.sprite = await body(walker.body, partnerSpecies);
      face(walker.facing);
      for (const spot of spotList) this.addSpot(spot);
      relayout();
      root.dataset.open = "true";
    },
    addSpot(spot) {
      const { node, figure } = spotNode(spot);
      const entry = { spot, node, sprite: null };
      spots.set(spot.id, entry); layer.append(node);
      placeAt(node, spot.at.map(v => v / 100));
      if (spot.kind === "npc") void body(figure, spot.species, { image: spot.image ?? null, height: spot.height ?? 0.24 }).then(sprite => {
        entry.sprite = sprite;
        if (sprite) sprite.setFacing((spot.face ?? (spot.at[0] > walker.pos[0] * 100 ? "left" : "right")) === "right" ? 1 : -1);
      });
    },
    /** open | goal | done | hidden */
    setSpotState(id, state) { const entry = spots.get(id); if (entry) entry.node.dataset.state = state; },
    spotState: id => spots.get(id)?.node.dataset.state ?? null,
    /** Start taking taps; `onSpot(id)` fires when the partner reaches a spot. */
    listen(handlers = {}) { onSpot = handlers.onSpot ?? null; onGround = handlers.onGround ?? null; paused = false; root.dataset.state = "idle"; },
    pause(on = true) { paused = Boolean(on); if (paused) stopWalk(); root.dataset.state = paused ? "paused" : "idle"; },
    walkTo, activate,
    position: () => currentPos().map(v => Math.round(v * 1000) / 1000),
    hidden(on) { root.hidden = Boolean(on); },
    relayout,
    dispose() {
      if (disposed) return; disposed = true;
      resizer?.disconnect(); stopWalk();
      walker.sprite?.dispose?.();
      for (const entry of spots.values()) entry.sprite?.dispose?.();
      root.remove();
    }
  });
}
