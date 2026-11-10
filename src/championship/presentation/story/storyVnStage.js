// Story mode stage (OWNER_APPROVED_ADAPTATION 2026-11-11): the picture half of
// the half-body visual novel. A painted side-view scene plate, the story's
// partners standing on its ground line and playing their own animation cells
// (spriteMotionPlayer.js: idle, walk, attack, hit, cheer), floating name tags
// the overwrite glitch rewrites, emote bubbles, and the two large busts drawn
// from the Database hero art (head-framed by the 218-partner cut-in
// calibration, monsterVisualAnchors218.js).
//
// DOM + CSS only: motion is transform / opacity through CSS and Web
// Animations. No requestAnimationFrame loop, no canvas, no WebGL context and
// no second ticker, so the shared Pixi stage stays the only GPU owner. It owns
// no game state and writes nothing.

import { createSpriteMotion, loadShowcaseMotion, showcaseFitScale, showcaseMotionAvailable, showcaseSpeciesId } from "../juicy/spriteMotionPlayer.js";
import { juicyPortrait } from "../juicy/juicyArt.js";
import { monsterVisualAnchor } from "../../data/monsterVisualAnchors218.js";
import { STORY_VN_SEQUENCES, storyVnBackground } from "../../data/storyVnCampaign.js";

const WALK_SPEED = Object.freeze({ light: 0.32, heavy: 0.2, boss: 0.16 }); // stage widths per second
/** Where the ground line sits in the scene box (fraction of its height). */
export const STORY_VN_GROUND_IN_BOX = 0.9;

export const STORY_VN_BUBBLE_GLYPHS = Object.freeze({
  "!": '<path d="M10 3h4l-1 11h-2L10 3zm1 13h2v3h-2z" fill="currentColor"/>',
  "?": '<path d="M8 7a4 4 0 1 1 6 3.4c-1 .6-1 1.1-1 2.6h-2c0-2.1.1-2.9 1.4-3.8A2 2 0 1 0 10 7H8zm3 8h2v3h-2z" fill="currentColor"/>',
  "...": '<path d="M5 11h3v3H5zm5.5 0h3v3h-3zm5.5 0h3v3h-3z" fill="currentColor"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.6C5 7.6 7 6 9 6c1.4 0 2.4.7 3 1.7C12.6 6.7 13.6 6 15 6c2 0 4 1.6 4 4.4C19 15.6 12 20 12 20z" fill="currentColor"/>',
  note: '<path d="M10 4v10.2A3 3 0 1 0 12 17V8l6-1.6v5.8A3 3 0 1 0 20 15V3l-10 1z" fill="currentColor"/>',
  sad: '<path d="M12 4c2.6 3.6 4.5 6.4 4.5 9a4.5 4.5 0 0 1-9 0c0-2.6 1.9-5.4 4.5-9z" fill="currentColor"/>',
  spark: '<path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" fill="currentColor"/>',
  anger: '<path d="M4 9l4-1-1-4 3 3 2-3 1 4 4-1-3 3 4 2-4 1 1 4-3-3-2 3-1-4-4 1 3-3z" fill="currentColor"/>'
});

const NAVI_SVG = `<svg viewBox="0 0 96 96" aria-hidden="true" focusable="false" class="cm-vn-bust__navi"><g fill="none" stroke="#7ff3dc" stroke-width="3" stroke-linecap="round"><path d="M48 8 L82 28 L82 66 L48 88 L14 66 L14 28 Z"/><path d="M48 24 L66 34 L66 56 L48 68 L30 56 L30 34 Z" opacity=".7"/></g><circle cx="48" cy="46" r="8" fill="#7ff3dc"/><path d="M36 60 Q48 70 60 60" stroke="#eaf5f2" stroke-width="3" fill="none" stroke-linecap="round"/><g fill="#56e3c2" opacity=".85"><rect x="22" y="14" width="4" height="4"/><rect x="70" y="78" width="4" height="4"/><rect x="10" y="46" width="3" height="3"/><rect x="84" y="40" width="3" height="3"/></g></svg>`;

function el(doc, tag, className, html) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (html) node.innerHTML = html;
  return node;
}

// ---- motion loading -----------------------------------------------------------
const motionCache = new Map();
/** The five story sequences of one species, loaded once per page. */
export function loadStoryVnMotion(speciesIndex, { href = globalThis.location?.href, fetchImpl } = {}) {
  const speciesId = showcaseSpeciesId(speciesIndex);
  if (!speciesId || !showcaseMotionAvailable(speciesId, href)) return Promise.reject(new Error("STORY_VN_MOTION_UNAVAILABLE"));
  let entry = motionCache.get(speciesId);
  if (!entry) {
    entry = loadShowcaseMotion(speciesId, { baseUrl: href, sequences: Object.values(STORY_VN_SEQUENCES), ...(fetchImpl ? { fetchImpl } : {}) });
    entry.catch(() => { if (motionCache.get(speciesId) === entry) motionCache.delete(speciesId); });
    motionCache.set(speciesId, entry);
    while (motionCache.size > 18) motionCache.delete(motionCache.keys().next().value);
  }
  return entry;
}

/**
 * Where a bust's art sits in its frame: the head square of the hero art is
 * placed at (0.5, headY) of the frame, `headSpan` frame widths across, and the
 * art is mirrored so the head turns toward the middle of the screen.
 */
export function storyVnBustLayout(portrait, { frameWidth, frameHeight, side = "left", headY = 0.3, headSpan = 0.44, faceRight = null } = {}) {
  if (!portrait?.width || !portrait?.height || !frameWidth || !frameHeight) return null;
  const face = Array.isArray(portrait.face) && portrait.face[2] > 0 ? portrait.face
    : [portrait.width * 0.5, portrait.height * 0.32, Math.min(portrait.width, portrait.height) * 0.42];
  const scale = (frameWidth * headSpan) / face[2];
  const right = faceRight ?? face[0] / portrait.width >= 0.5;
  // A left bust looks right (into the screen), a right bust looks left.
  const mirror = side === "left" ? !right : right;
  const cx = mirror ? portrait.width - face[0] : face[0];
  return Object.freeze({
    scale, mirror,
    width: portrait.width * scale, height: portrait.height * scale,
    left: frameWidth * 0.5 - cx * scale, top: frameHeight * headY - face[1] * scale
  });
}

/** Whether the hero art's head sits right of centre (the art then faces right). */
function heroFacesRight(speciesIndex, portrait) {
  const head = monsterVisualAnchor(speciesIndex)?.cutinHeadFrame;
  if (head) return head.headFocusX >= 0.5;
  return portrait?.face ? portrait.face[0] / portrait.width >= 0.5 : true;
}

/** Plate placement in a box: cover, the ground line at `groundInBox`, the focus kept centred. */
export function storyVnPlateLayout({ naturalWidth, naturalHeight, ground = 0.78, focus = 0.5 }, { width, height, groundInBox = STORY_VN_GROUND_IN_BOX }) {
  if (!naturalWidth || !naturalHeight || !width || !height) return null;
  const scale = Math.max(width / naturalWidth, height / naturalHeight);
  const w = naturalWidth * scale, h = naturalHeight * scale;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const left = clamp(width * 0.5 - focus * w, width - w, 0);
  const top = clamp(height * groundInBox - ground * h, height - h, 0);
  return Object.freeze({ scale, width: w, height: h, left, top, groundY: top + ground * h });
}

export function createStoryVnStage({
  host, doc = host?.ownerDocument ?? globalThis.document, reducedMotion = false,
  loadMotion = loadStoryVnMotion, portraitOf = juicyPortrait, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout
} = {}) {
  if (!host) throw new TypeError("STORY_VN_STAGE_HOST");
  const motionOk = !reducedMotion;
  const scene = el(doc, "div", "cm-vn-scene");
  scene.setAttribute("aria-hidden", "true");
  const plates = [el(doc, "img", "cm-vn-scene__plate"), el(doc, "img", "cm-vn-scene__plate")];
  for (const plate of plates) { plate.alt = ""; plate.decoding = "async"; plate.draggable = false; plate.dataset.on = "false"; }
  const shade = el(doc, "div", "cm-vn-scene__shade");
  const ground = el(doc, "div", "cm-vn-scene__ground");
  const fx = el(doc, "div", "cm-vn-fx", '<i class="cm-vn-fx__noise"></i><i class="cm-vn-fx__scan"></i><i class="cm-vn-fx__flash"></i><i class="cm-vn-fx__glow"></i>');
  const taps = el(doc, "div", "cm-vn-taps");
  scene.append(...plates, shade, ground, fx, taps);
  const busts = { left: el(doc, "figure", "cm-vn-bust"), right: el(doc, "figure", "cm-vn-bust") };
  for (const [side, figure] of Object.entries(busts)) { figure.dataset.side = side; figure.hidden = true; figure.setAttribute("aria-hidden", "true"); }
  host.append(scene, busts.left, busts.right);

  const actors = new Map();
  const timers = new Set();
  let disposed = false, plateIndex = 0, plateSpec = null, plateLayout = null, groundY = null, speakingKey = null;
  const later = (fn, ms) => { const t = setTimer(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const wait = (ms, instant) => new Promise(resolve => { if (instant || ms <= 0 || disposed) resolve(); else later(resolve, ms); });
  const resizer = typeof globalThis.ResizeObserver === "function" ? new globalThis.ResizeObserver(() => { if (!disposed) relayout(); }) : null;
  resizer?.observe(scene);

  function box() { return { w: Math.max(240, scene.clientWidth || host.clientWidth || 390), h: Math.max(200, scene.clientHeight || host.clientHeight || 560) }; }
  function placePlate(plate) {
    const { w, h } = box();
    const layout = plateSpec && storyVnPlateLayout({ naturalWidth: plate.naturalWidth, naturalHeight: plate.naturalHeight, ground: plateSpec.ground, focus: plateSpec.focus }, { width: w, height: h });
    plateLayout = layout;
    if (!layout) { plate.removeAttribute("style"); groundY = h * STORY_VN_GROUND_IN_BOX; }
    else {
      Object.assign(plate.style, { width: `${Math.round(layout.width)}px`, height: `${Math.round(layout.height)}px`, transform: `translate(${Math.round(layout.left)}px, ${Math.round(layout.top)}px)` });
      groundY = layout.groundY;
    }
    ground.style.transform = `translateY(${Math.round(groundY)}px)`;
  }
  function relayout() {
    const live = plates[plateIndex];
    if (live?.dataset.on === "true") placePlate(live); else groundY = box().h * STORY_VN_GROUND_IN_BOX;
    for (const actor of actors.values()) if (!actor.runs.size) placeActor(actor);
    for (const side of ["left", "right"]) layoutBust(side);
  }

  // ---- plates ----
  async function setPlate(id, { cut = "fade", instant = false } = {}) {
    const spec = storyVnBackground(id);
    if (!spec || disposed) return;
    const next = plates[1 - plateIndex], prev = plates[plateIndex];
    plateSpec = spec;
    scene.dataset.plate = id;
    await new Promise(resolve => {
      let done = false; const finish = () => { if (!done) { done = true; resolve(); } };
      next.onload = finish; next.onerror = finish;
      next.src = spec.src;
      if (next.complete && next.naturalWidth) finish();
      later(finish, 2500);
    });
    if (disposed) return;
    placePlate(next);
    if (!instant && motionOk && cut === "glitch") { scene.dataset.cut = "glitch"; await wait(240); }
    next.dataset.on = "true"; prev.dataset.on = "false";
    plateIndex = 1 - plateIndex;
    if (scene.dataset.cut) later(() => { delete scene.dataset.cut; }, 360);
  }

  // ---- actors ----
  function xPx(x) { return box().w * x; }
  // Actors live in the ground layer (already moved down to the ground line): only x moves.
  function placeActor(actor, x = actor.x) {
    actor.wrap.style.transform = `translate(${Math.round(xPx(x))}px, 0px)`;
  }
  function fitBox(spec) {
    const { w, h } = box();
    const grow = spec.scale ?? 1;
    return { width: Math.min(w * 0.34, 320) * grow, height: Math.min(h * 0.4, 280) * grow };
  }
  async function buildBody(actor) {
    actor.body.replaceChildren();
    actor.sprite?.dispose(); actor.sprite = null;
    let motion = null;
    try { motion = await loadMotion(actor.species); } catch { motion = null; }
    if (disposed) return;
    const fit = fitBox(actor.spec);
    if (motion) {
      const sprite = createSpriteMotion({ doc, motion, scale: showcaseFitScale(motion, { ...fit, maxNative: 8, minNative: 2 }), reducedMotion });
      sprite.element.classList.add("cm-vn-actor__sprite");
      actor.body.append(sprite.element);
      actor.sprite = sprite;
      actor.bodyHeight = sprite.height;
      sprite.setFacing(actor.facing);
      sprite.play(STORY_VN_SEQUENCES.idle);
      actor.wrap.dataset.art = "motion";
    } else {
      const portrait = portraitOf(actor.species);
      if (portrait?.src) {
        const img = el(doc, "img", "cm-vn-actor__portrait"); img.alt = ""; img.src = portrait.src; img.decoding = "async"; img.draggable = false;
        img.style.height = `${Math.round(fit.height * 0.85)}px`;
        if ((actor.facing > 0) !== heroFacesRight(actor.species, portrait)) img.style.transform = "scaleX(-1)";
        actor.body.append(img);
      }
      actor.bodyHeight = fit.height * 0.85;
      actor.wrap.dataset.art = portrait?.src ? "portrait" : "none";
    }
    actor.wrap.style.setProperty("--head", `${Math.round(actor.bodyHeight + 8)}px`);
  }
  function setFacing(actor, face) {
    if (!face) return;
    actor.facing = face === "right" ? 1 : -1;
    actor.sprite?.setFacing(actor.facing);
    actor.wrap.dataset.facing = face;
  }
  function play(actor, action, { loop = action === "idle" || action === "walk", onEnd = null } = {}) {
    actor.wrap.dataset.action = action;
    if (!actor.sprite) { onEnd?.(); return; }
    actor.sprite.play(STORY_VN_SEQUENCES[action] ?? 0, { loop, onEnd });
  }
  function walkMs(a, b, actor) {
    const speed = (actor.spec.scale ?? 1) >= 1.5 ? WALK_SPEED.boss : (actor.spec.scale ?? 1) > 1 ? WALK_SPEED.heavy : WALK_SPEED.light;
    return Math.round(Math.abs(b - a) / speed * 1000);
  }
  function animateTo(actor, x, ms, instant) {
    const from = actor.wrap.style.transform;
    actor.x = x; placeActor(actor, x);
    if (instant || !motionOk || ms <= 0 || typeof actor.wrap.animate !== "function") return Promise.resolve();
    const run = actor.wrap.animate([{ transform: from }, { transform: actor.wrap.style.transform }], { duration: ms, easing: "linear" });
    actor.runs.add(run);
    return run.finished.then(() => actor.runs.delete(run), () => actor.runs.delete(run));
  }

  async function enter(key, { species, spec = {}, x = 0.6, from = null, face = "left", tag = null, instant = false } = {}) {
    if (disposed) return;
    const existing = actors.get(key);
    if (existing) { existing.sprite?.dispose(); existing.wrap.remove(); actors.delete(key); }
    const wrap = el(doc, "div", "cm-vn-actor");
    wrap.dataset.actor = key;
    if (spec.overwritten) wrap.dataset.overwritten = "true";
    if ((spec.scale ?? 1) >= 1.5) wrap.dataset.boss = "true";
    if (spec.faction) wrap.dataset.faction = spec.faction;
    const shadow = el(doc, "i", "cm-vn-actor__shadow");
    const body = el(doc, "div", "cm-vn-actor__body");
    const tagNode = el(doc, "span", "cm-vn-actor__tag"); tagNode.hidden = !tag; tagNode.textContent = tag ?? "";
    const bubble = el(doc, "span", "cm-vn-actor__bubble"); bubble.hidden = true;
    wrap.append(shadow, body, tagNode, bubble);
    const actor = { key, species, spec, wrap, body, tag: tagNode, bubble, sprite: null, x, facing: face === "right" ? 1 : -1, bodyHeight: 80, runs: new Set(), bubbleTimer: null };
    actors.set(key, actor);
    wrap.dataset.facing = face;
    ground.append(wrap);
    await buildBody(actor);
    if (disposed || actors.get(key) !== actor) return;
    if (from === "warp" || from === "rift") {
      placeActor(actor, x);
      wrap.dataset.arrive = from;
      if (!instant && motionOk) await wait(520);
      delete wrap.dataset.arrive;
      return;
    }
    if (from === "left" || from === "right") {
      const start = from === "left" ? -0.12 : 1.12;
      placeActor(actor, start); actor.x = start;
      setFacing(actor, start < x ? "right" : "left");
      play(actor, "walk");
      await animateTo(actor, x, walkMs(start, x, actor), instant);
      setFacing(actor, face);
      play(actor, "idle");
      return;
    }
    placeActor(actor, x);
  }
  async function move(key, x, { instant = false, face = null } = {}) {
    const actor = actors.get(key); if (!actor || disposed) return;
    const from = actor.x;
    if (Math.abs(x - from) > 0.01) setFacing(actor, x > from ? "right" : "left");
    play(actor, "walk");
    await animateTo(actor, x, walkMs(from, x, actor), instant);
    if (face) setFacing(actor, face);
    if (actors.get(key) === actor) play(actor, "idle");
  }
  async function act(key, action, { face = null, instant = false } = {}) {
    const actor = actors.get(key); if (!actor || disposed) return;
    setFacing(actor, face);
    if (action === "idle" || action === "walk") { play(actor, action); return; }
    if (instant || !actor.sprite || reducedMotion) { play(actor, action, { loop: false }); await wait(instant ? 0 : 160, instant); if (actors.get(key) === actor) play(actor, "idle"); return; }
    await new Promise(resolve => {
      let settled = false; const done = () => { if (!settled) { settled = true; resolve(); } };
      play(actor, action, { loop: false, onEnd: done });
      later(done, 1600);
    });
    if (actors.get(key) === actor && !disposed) play(actor, "idle");
  }
  async function exit(key, to = "warp", { instant = false } = {}) {
    const actor = actors.get(key); if (!actor) return;
    if (to === "left" || to === "right") await move(key, to === "left" ? -0.14 : 1.14, { instant });
    else if (!instant && motionOk) { actor.wrap.dataset.leave = to; await wait(460); }
    actor.sprite?.dispose(); actor.wrap.remove();
    if (actors.get(key) === actor) actors.delete(key);
  }
  function clearActors() { for (const actor of actors.values()) { for (const run of actor.runs) run.cancel(); actor.sprite?.dispose(); actor.wrap.remove(); } actors.clear(); speakingKey = null; }

  // ---- busts ----
  const bustState = { left: null, right: null };
  function layoutBust(side) {
    const state = bustState[side], figure = busts[side];
    if (!state?.portrait || !state.img) return;
    const layout = storyVnBustLayout(state.portrait, { frameWidth: figure.clientWidth || 320, frameHeight: figure.clientHeight || 480, side, faceRight: state.faceRight });
    if (!layout) return;
    // Mirrored about the art's own centre, so `left` is where the mirrored image starts.
    Object.assign(state.img.style, { width: `${Math.round(layout.width)}px`, height: `${Math.round(layout.height)}px`,
      transformOrigin: `${Math.round(layout.width / 2)}px 0`,
      transform: `translate(${Math.round(layout.left)}px, ${Math.round(layout.top)}px)${layout.mirror ? " scaleX(-1)" : ""}` });
  }
  /** Show a bust: { species } or { navi: true }; null hides the side. */
  function setBust(side, who, { key = null } = {}) {
    const figure = busts[side];
    if (!who) { figure.hidden = true; bustState[side] = null; delete figure.dataset.key; return; }
    const id = who.navi ? "navi" : `species-${who.species}`;
    if (figure.dataset.key !== `${id}:${key ?? ""}` || figure.hidden) {
      figure.dataset.key = `${id}:${key ?? ""}`;
      figure.replaceChildren();
      const frame = el(doc, "div", "cm-vn-bust__frame");
      if (who.navi) { frame.innerHTML = NAVI_SVG; figure.dataset.kind = "navi"; bustState[side] = { portrait: null }; }
      else {
        const portrait = portraitOf(who.species);
        if (!portrait?.src) { figure.hidden = true; bustState[side] = null; return; }
        const img = el(doc, "img", "cm-vn-bust__art"); img.alt = ""; img.decoding = "async"; img.draggable = false; img.src = portrait.src;
        frame.append(img); figure.dataset.kind = "hero";
        bustState[side] = { portrait, img, faceRight: heroFacesRight(who.species, portrait) };
      }
      figure.append(frame);
      figure.hidden = false;
      figure.classList.remove("is-in"); void figure.offsetWidth; figure.classList.add("is-in");
      layoutBust(side);
    }
  }
  function bustMood(side, { active = false, mood = "calm" } = {}) {
    const figure = busts[side]; if (figure.hidden) return;
    figure.dataset.active = String(active);
    figure.dataset.mood = active ? mood : "calm";
    if (active) { figure.classList.remove("is-speaking"); void figure.offsetWidth; figure.classList.add("is-speaking"); }
  }

  return Object.freeze({
    element: scene,
    setPlate, enter, exit, move, act, clearActors,
    face(key, face) { const actor = actors.get(key); if (actor) setFacing(actor, face); },
    has: key => actors.has(key),
    keys: () => [...actors.keys()],
    xOf: key => actors.get(key)?.x ?? null,
    bubble(key, glyph) {
      const actor = actors.get(key); if (!actor) return;
      actor.bubble.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${STORY_VN_BUBBLE_GLYPHS[glyph] ?? STORY_VN_BUBBLE_GLYPHS["!"]}</svg>`;
      actor.bubble.dataset.glyph = glyph; actor.bubble.hidden = false;
      actor.bubble.classList.remove("is-live"); void actor.bubble.offsetWidth; actor.bubble.classList.add("is-live");
      clearTimer(actor.bubbleTimer); timers.delete(actor.bubbleTimer);
      actor.bubbleTimer = later(() => { actor.bubble.hidden = true; }, 1700);
    },
    async setTag(key, text, { glitch = true, instant = false, state = "" } = {}) {
      const actor = actors.get(key); if (!actor) return;
      actor.tag.hidden = !text;
      if (glitch && !instant && motionOk) { actor.tag.dataset.glitch = "on"; await wait(420); }
      actor.tag.textContent = text ?? "";
      actor.tag.dataset.state = state;
      delete actor.tag.dataset.glitch;
    },
    tagText: key => actors.get(key)?.tag.textContent ?? null,
    speaking(key) {
      if (speakingKey) actors.get(speakingKey)?.wrap.removeAttribute("data-speaking");
      speakingKey = key; if (key) actors.get(key)?.wrap.setAttribute("data-speaking", "true");
    },
    setBust, bustMood,
    /** Hide whichever bust shows this cast member (it left the scene). */
    dropBustOf(key) { for (const side of ["left", "right"]) if (busts[side].dataset.key?.endsWith(`:${key}`)) setBust(side, null); },
    bustKey: side => (busts[side].hidden ? null : busts[side].dataset.key ?? null),
    fx(kind, { on = true } = {}) {
      if (kind === "noise") { scene.dataset.noise = on ? "on" : "off"; return; }
      if (kind === "shake") { scene.dataset.shake = "on"; later(() => { delete scene.dataset.shake; }, 480); return; }
      if (kind === "flash") { scene.dataset.flash = "on"; later(() => { delete scene.dataset.flash; }, 420); return; }
      if (kind === "resonance") { scene.dataset.resonance = "on"; later(() => { delete scene.dataset.resonance; }, 1600); }
    },
    /** A pulsing tap point at stage percent [x, y] or over an actor; resolves when tapped. Returns { node, done, cancel }. */
    tapTarget(target, { label = "", signal = null } = {}) {
      const node = el(doc, "button", "cm-vn-tap"); node.type = "button";
      node.innerHTML = `<i class="cm-vn-tap__ring"></i><i class="cm-vn-tap__ring cm-vn-tap__ring--late"></i><span class="cm-vn-tap__label"></span>`;
      node.querySelector(".cm-vn-tap__label").textContent = label;
      node.setAttribute("aria-label", label || "tap");
      if (Array.isArray(target.at)) {
        // Plate percent -> scene px through the plate's cover placement (stage percent without a plate).
        const { w, h } = box(), L = plateLayout;
        const x = L ? L.left + (target.at[0] / 100) * L.width : (target.at[0] / 100) * w;
        const y = L ? L.top + (target.at[1] / 100) * L.height : (target.at[1] / 100) * h;
        node.style.left = `${Math.round(Math.min(w - 24, Math.max(24, x)))}px`; node.style.top = `${Math.round(Math.min(h - 24, Math.max(24, y)))}px`;
      }
      else {
        const actor = actors.get(target.who);
        const y = (groundY ?? box().h * STORY_VN_GROUND_IN_BOX) - (actor?.bodyHeight ?? 80) * 0.5;
        node.style.left = `${Math.round(xPx(actor?.x ?? 0.5))}px`; node.style.top = `${Math.round(y)}px`;
      }
      taps.append(node);
      let finish;
      const done = new Promise(resolve => { finish = resolve; });
      const handler = event => { event.preventDefault(); event.stopPropagation(); node.dataset.hit = "true"; later(() => node.remove(), 320); finish(true); };
      node.addEventListener("click", handler, { once: true });
      signal?.addEventListener?.("abort", () => { node.remove(); finish(false); }, { once: true });
      try { node.focus({ preventScroll: true }); } catch { /* not focusable yet */ }
      return { node, done, cancel: () => { node.remove(); finish(false); } };
    },
    relayout,
    dispose() {
      if (disposed) return; disposed = true;
      resizer?.disconnect();
      for (const t of timers) clearTimer(t); timers.clear();
      clearActors();
      scene.remove(); busts.left.remove(); busts.right.remove();
    }
  });
}
