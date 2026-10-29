// Story field (OWNER_APPROVED_ADAPTATION 2026-10-29): one 3-D location of the
// Data Area story mode, modelled in Blender (scripts/build-story-field.py) and
// shown here with the product's own partners walking on it.
//
// A location is a GLB plus field.json: a walk grid (walkability and ground
// height per 0.5 m cell), anchors (spawn, NPC posts, trigger zones, exits) and
// the camera framing. Walkability lives in that data, never in the picture.
//
// Rendering: one bounded Three.js scene on its own canvas inside the story
// screen, orthographic at the hunt maps' locked 52 deg / 45 deg view, drawn only
// from the existing Pixi ticker the caller hands in (no requestAnimationFrame,
// no second ticker). Actors are DOM sprite cells (spriteMotionPlayer.js)
// projected onto the ground each frame. The canvas is released on dispose.
//
// It exposes the same stage verbs as the grid theater (enter / move / act /
// face / bubble / setTag / target ...) plus free exploration: tap the ground
// to walk (A* over the walk grid), tap an NPC to walk up and talk, step into a
// trigger or an exit. It owns no game state.

import * as THREE from "../../../../node_modules/three/build/three.module.js";
import { GLTFLoader } from "../../../../node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { createSpriteMotion, showcaseFitScale } from "../juicy/spriteMotionPlayer.js";
import { juicyPortrait } from "../juicy/juicyArt.js";
import { DATA_AREA_SEQUENCES } from "../../data/dataAreaStoryCampaign.js";
import { crestMarkup, loadDataAreaMotion } from "./DataAreaCyberStage.js";

export const STORY_FIELD_WALK_SPEED = Object.freeze({ light: 2.4, heavy: 1.6, boss: 1.3 }); // m / s
export const STORY_FIELD_ACTOR_HEIGHT = 2.3; // m, the drawn height of an ordinary partner

const BUBBLES = Object.freeze({
  "!": '<path d="M10 3h4l-1 11h-2L10 3zm1 13h2v3h-2z" fill="currentColor"/>',
  "?": '<path d="M8 7a4 4 0 1 1 6 3.4c-1 .6-1 1.1-1 2.6h-2c0-2.1.1-2.9 1.4-3.8A2 2 0 1 0 10 7H8zm3 8h2v3h-2z" fill="currentColor"/>',
  "...": '<path d="M5 11h3v3H5zm5.5 0h3v3h-3zm5.5 0h3v3h-3z" fill="currentColor"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.6C5 7.6 7 6 9 6c1.4 0 2.4.7 3 1.7C12.6 6.7 13.6 6 15 6c2 0 4 1.6 4 4.4C19 15.6 12 20 12 20z" fill="currentColor"/>',
  note: '<path d="M10 4v10.2A3 3 0 1 0 12 17V8l6-1.6v5.8A3 3 0 1 0 20 15V3l-10 1z" fill="currentColor"/>',
  sad: '<path d="M12 4c2.6 3.6 4.5 6.4 4.5 9a4.5 4.5 0 0 1-9 0c0-2.6 1.9-5.4 4.5-9z" fill="currentColor"/>',
  spark: '<path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" fill="currentColor"/>'
});

// ---- walk grid ----------------------------------------------------------------
/** Pure helpers over field.json's walk grid (x east, y north, metres). */
export function createWalkGrid(walk) {
  const { cell, cols, rows, origin: [ox, oy] } = walk;
  const ok = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows && walk.walk[r * cols + c] === "1";
  const cellOf = (x, y) => [Math.floor((x - ox) / cell), Math.floor((y - oy) / cell)];
  const centre = (c, r) => [ox + (c + 0.5) * cell, oy + (r + 0.5) * cell];
  function heightAt(x, y) {
    const fx = (x - ox) / cell - 0.5, fy = (y - oy) / cell - 0.5;
    const c0 = Math.max(0, Math.min(cols - 1, Math.floor(fx))), r0 = Math.max(0, Math.min(rows - 1, Math.floor(fy)));
    const c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1), tx = Math.max(0, Math.min(1, fx - c0)), ty = Math.max(0, Math.min(1, fy - r0));
    const h = (c, r) => walk.height[r * cols + c];
    return (h(c0, r0) * (1 - tx) + h(c1, r0) * tx) * (1 - ty) + (h(c0, r1) * (1 - tx) + h(c1, r1) * tx) * ty;
  }
  const walkable = (x, y) => ok(...cellOf(x, y));
  /** The nearest walkable cell centre to a point (within `radius` cells). */
  function nearest(x, y, radius = 6) {
    const [c, r] = cellOf(x, y);
    if (ok(c, r)) return centre(c, r);
    let best = null, bestD = Infinity;
    for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
      if (!ok(c + dc, r + dr)) continue;
      const [px, py] = centre(c + dc, r + dr), d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bestD) { bestD = d; best = [px, py]; }
    }
    return best;
  }
  /** Straight walk without leaving the grid (sampled every quarter cell). */
  function clear(a, b) {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (cell / 4));
    for (let i = 1; i <= steps; i++) { const t = i / steps; if (!walkable(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; }
    return true;
  }
  /** A* over the grid (8 directions, no corner cutting), then string-pulled. */
  function path(from, to) {
    const goal = nearest(to[0], to[1]); if (!goal) return null;
    const start = nearest(from[0], from[1]); if (!start) return null;
    if (clear(from, goal)) return [goal];
    const [sc, sr] = cellOf(...start), [gc, gr] = cellOf(...goal);
    const key = (c, r) => r * cols + c, open = new Map([[key(sc, sr), { c: sc, r: sr, g: 0, f: 0, parent: null }]]), closed = new Map();
    const hdist = (c, r) => Math.hypot(c - gc, r - gr);
    let found = null, guard = 0;
    while (open.size && guard++ < cols * rows * 4) {
      let current = null;
      for (const node of open.values()) if (!current || node.f < current.f) current = node;
      open.delete(key(current.c, current.r)); closed.set(key(current.c, current.r), current);
      if (current.c === gc && current.r === gr) { found = current; break; }
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dc && !dr) continue;
        const c = current.c + dc, r = current.r + dr, k = key(c, r);
        if (!ok(c, r) || closed.has(k) || (dc && dr && (!ok(current.c + dc, current.r) || !ok(current.c, current.r + dr)))) continue;
        const g = current.g + (dc && dr ? Math.SQRT2 : 1), prior = open.get(k);
        if (!prior || g < prior.g) open.set(k, { c, r, g, f: g + hdist(c, r), parent: current });
      }
    }
    if (!found) return null;
    const cells = []; for (let node = found; node; node = node.parent) cells.unshift(centre(node.c, node.r));
    const pulled = []; let anchor = from;
    for (let i = 0; i < cells.length; i++) {
      if (i === cells.length - 1 || !clear(anchor, cells[i + 1])) { pulled.push(cells[i]); anchor = cells[i]; }
    }
    return pulled;
  }
  return Object.freeze({ cell, cols, rows, walkable, heightAt, nearest, clear, path });
}

/** Whether a field point (x, y) lies in an anchor's zone (size in metres, centred). */
export function inZone(anchor, x, y) {
  const [w, h] = anchor.size ?? [1, 1];
  return Math.abs(x - anchor.x) <= w / 2 && Math.abs(y - anchor.y) <= h / 2;
}

// ---- the field ------------------------------------------------------------------
export async function createStoryField3D({
  host, doc = host?.ownerDocument ?? globalThis.document, fieldUrl, ticker, reducedMotion = false, quality = "balanced",
  loadMotion = loadDataAreaMotion, portraitOf = juicyPortrait, fetchImpl = (...args) => globalThis.fetch(...args),
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, signal = null
} = {}) {
  if (!host || !fieldUrl) throw new TypeError("STORY_FIELD_HOST_AND_URL");
  if (!ticker || typeof ticker.add !== "function") throw new TypeError("STORY_FIELD_TICKER_REQUIRED");
  const base = new URL(fieldUrl.endsWith("/") ? fieldUrl : `${fieldUrl}/`, globalThis.location?.href);
  const response = await fetchImpl(new URL("field.json", base).href, { signal });
  if (!response.ok) throw new Error(`STORY_FIELD_HTTP_${response.status}`);
  const data = await response.json();
  if (data.schema !== "STORY_FIELD.v1") throw new Error("STORY_FIELD_SCHEMA");
  const grid = createWalkGrid(data.walk);
  const gltf = await new GLTFLoader().loadAsync(new URL(data.glb.file, base).href);
  signal?.throwIfAborted?.();

  // DOM: canvas, sprite layer, fade veil.
  const root = doc.createElement("div"); root.className = "cm-sf"; root.dataset.field = data.field;
  const canvas = doc.createElement("canvas"); canvas.className = "cm-sf__canvas";
  const layer = doc.createElement("div"); layer.className = "cm-sf__actors";
  const markers = doc.createElement("div"); markers.className = "cm-sf__markers";
  const veil = doc.createElement("div"); veil.className = "cm-sf__veil"; veil.dataset.state = "dark";
  const marks = new Map();
  root.append(canvas, markers, layer, veil);
  host.append(root);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== "saver", alpha: false, powerPreference: "high-performance" });
  // Software GL (SwiftShader, llvmpipe) shades on the CPU: 1x pixels and no shadows there.
  let softwareGl = false;
  try {
    const gl = renderer.getContext(), info = gl.getExtension("WEBGL_debug_renderer_info");
    softwareGl = /swiftshader|llvmpipe|software/i.test(String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)));
  } catch { softwareGl = false; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = quality !== "saver" && !softwareGl;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(new THREE.Color(data.sea?.color ?? "#0c1b54"));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(data.sea?.color ?? "#0c1b54");
  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x3a4a2a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
  sun.position.set(-8, 18, 10); sun.castShadow = renderer.shadowMap.enabled;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  gltf.scene.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = !/^terrain|pond_water|gate_ring|gift_glint/.test(node.name); node.receiveShadow = true;
    for (const material of [node.material].flat()) if (material && /gate_ring|gift_glint|gateRing|giftGlow/.test(`${node.name} ${material.name}`)) material.toneMapped = false;
  });
  scene.add(gltf.scene);
  // The data sea under the island: a deep plane and a glowing grid (the Data Area below).
  const seaY = data.sea?.height ?? -3.2;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: data.sea?.color ?? "#0c1b54" }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = seaY - 0.02; scene.add(sea);
  const seaGrid = new THREE.GridHelper(200, 100, new THREE.Color(data.sea?.grid ?? "#7ff3ff"), new THREE.Color(data.sea?.grid ?? "#7ff3ff"));
  seaGrid.position.y = seaY; for (const m of [seaGrid.material].flat()) { m.transparent = true; m.opacity = 0.35; m.toneMapped = false; }
  scene.add(seaGrid);

  // Camera: orthographic, 52 deg elevation, 45 deg azimuth (the hunt maps' framing).
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  const elev = THREE.MathUtils.degToRad(data.camera?.elevationDegrees ?? 52), azim = THREE.MathUtils.degToRad(data.camera?.azimuthDegrees ?? 45);
  const offset = new THREE.Vector3(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev)).multiplyScalar(60);
  let viewWidth = data.camera?.viewWidth ?? 13;
  const focus = new THREE.Vector3(), focusGoal = new THREE.Vector3();
  let camTween = null, camHold = false; // a cutscene pan holds the camera until it returns to the partner
  const world = (x, y, z = grid.heightAt(x, y)) => new THREE.Vector3(x, z, -y);
  let width = 1, height = 1;
  function resize() {
    width = Math.max(1, host.clientWidth || 390); height = Math.max(1, host.clientHeight || 844);
    renderer.setPixelRatio(softwareGl ? 1 : Math.min(globalThis.devicePixelRatio || 1, quality === "saver" ? 1.25 : 2));
    renderer.setSize(width, height, false);
    viewWidth = Math.max(8, Math.min(14, (data.camera?.viewWidth ?? 13) * Math.min(1, width / 390) * (width < 600 ? 0.78 : 1)));
    const viewHeight = viewWidth * height / width;
    Object.assign(camera, { left: -viewWidth / 2, right: viewWidth / 2, top: viewHeight / 2, bottom: -viewHeight / 2 });
    camera.updateProjectionMatrix();
    dirty = true;
  }
  // Draw only when something moved: the camera, an actor or the size. Sprites
  // animate as DOM, so a still dialogue costs no GPU time.
  let dirty = true;
  resize();
  const pxPerMetre = () => width / viewWidth;
  function project(vec) {
    const p = vec.clone().project(camera);
    return { x: (p.x + 1) / 2 * width, y: (1 - p.y) / 2 * height, depth: p.z };
  }

  // ---- actors ----
  const actors = new Map();
  let partnerKey = "partner", walkHandler = null, disposed = false, frame = 0, needsSort = true;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimer(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const wait = (ms, instant) => new Promise(resolve => { if (instant || ms <= 0 || disposed) resolve(); else later(resolve, ms); });

  function speedOf(actor) { return actor.spec.boss ? STORY_FIELD_WALK_SPEED.boss : actor.spec.heavy ? STORY_FIELD_WALK_SPEED.heavy : STORY_FIELD_WALK_SPEED.light; }
  function setFacing(actor, face) {
    if (!face) return; actor.facing = face === "right" ? 1 : -1; actor.sprite?.setFacing(actor.facing); actor.wrap.dataset.facing = face;
  }
  function play(actor, action, { loop = action === "idle" || action === "walk", onEnd = null } = {}) {
    actor.wrap.dataset.action = action;
    if (!actor.sprite) { onEnd?.(); return; }
    actor.sprite.play(DATA_AREA_SEQUENCES[action] ?? 0, { loop, onEnd });
  }
  async function buildBody(actor) {
    actor.body.replaceChildren(); actor.sprite?.dispose(); actor.sprite = null;
    let motion = null;
    try { motion = await loadMotion(actor.spec.species); } catch { motion = null; }
    if (disposed) return;
    const metres = STORY_FIELD_ACTOR_HEIGHT * (actor.spec.boss ? 1.9 : actor.spec.heavy ? 1.2 : 1);
    const boxH = metres * pxPerMetre();
    if (motion) {
      const sprite = createSpriteMotion({ doc, motion, scale: showcaseFitScale(motion, { width: boxH * 1.4, height: boxH, maxNative: 6 }), reducedMotion });
      sprite.element.classList.add("cm-da-actor__sprite");
      actor.body.append(sprite.element); actor.sprite = sprite; actor.bodyHeight = sprite.bodyHeight();
      sprite.setFacing(actor.facing); sprite.play(DATA_AREA_SEQUENCES.idle); actor.wrap.dataset.art = "motion";
    } else {
      const portrait = portraitOf(actor.spec.species);
      if (portrait?.src) { const img = doc.createElement("img"); img.className = "cm-da-actor__portrait"; img.alt = ""; img.src = portrait.src; img.style.height = `${Math.round(boxH)}px`; actor.body.append(img); }
      actor.bodyHeight = boxH; actor.wrap.dataset.art = portrait?.src ? "portrait" : "none";
    }
    actor.tag.style.setProperty("--head", `${Math.round(actor.bodyHeight + 8)}px`);
    actor.bubble.style.setProperty("--head", `${Math.round(actor.bodyHeight + (actor.tag.hidden ? 8 : 32))}px`);
  }
  function placeActor(actor) {
    const p = project(world(actor.x, actor.y));
    actor.wrap.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
    actor.screen = p;
  }
  async function enter(key, spec, { instant = false } = {}) {
    if (disposed) return;
    actors.get(key)?.wrap.remove();
    const at = grid.nearest(spec.at[0], spec.at[1]) ?? spec.at;
    const wrap = doc.createElement("div"); wrap.className = "cm-da-actor cm-sf__actor"; wrap.dataset.actor = key;
    if (spec.overwritten) wrap.dataset.overwritten = "true";
    if (spec.boss) wrap.dataset.boss = "true";
    if (spec.faction) wrap.dataset.faction = spec.faction;
    const shadow = doc.createElement("i"); shadow.className = "cm-da-actor__shadow";
    const body = doc.createElement("div"); body.className = "cm-da-actor__body";
    const tag = doc.createElement("span"); tag.className = "cm-da-actor__tag"; tag.hidden = !spec.tag; tag.textContent = spec.tag ?? "";
    const bubble = doc.createElement("span"); bubble.className = "cm-da-actor__bubble"; bubble.hidden = true;
    wrap.append(shadow, body, tag, bubble); layer.append(wrap);
    const actor = { key, spec, wrap, body, tag, bubble, sprite: null, x: at[0], y: at[1], facing: spec.face === "right" ? 1 : -1, bodyHeight: 80, route: null, resolveRoute: null };
    actors.set(key, actor); wrap.dataset.facing = spec.face ?? "left";
    placeActor(actor); needsSort = true; dirty = true;
    await buildBody(actor);
    if (!instant && !reducedMotion && (spec.from === "warp" || spec.from === "rift")) { wrap.dataset.arrive = spec.from; await wait(520); delete wrap.dataset.arrive; }
  }
  /** Walk an actor along an A* route; resolves on arrival (or at once with instant). */
  function walkTo(key, to, { instant = false, face = null } = {}) {
    const actor = actors.get(key); if (!actor || disposed) return Promise.resolve(false);
    const route = grid.path([actor.x, actor.y], to);
    actor.resolveRoute?.(false);
    if (!route) { actor.route = null; return Promise.resolve(false); }
    if (instant || reducedMotion) {
      const end = route.at(-1); actor.x = end[0]; actor.y = end[1]; actor.route = null; placeActor(actor); setFacing(actor, face); needsSort = true; dirty = true;
      return Promise.resolve(true);
    }
    actor.route = route.slice(); play(actor, "walk");
    return new Promise(resolve => { actor.resolveRoute = arrived => { actor.resolveRoute = null; resolve(arrived); }; actor.endFace = face; });
  }
  function stepActors(dt) {
    for (const actor of actors.values()) {
      if (!actor.route?.length) continue;
      const [tx, ty] = actor.route[0], dx = tx - actor.x, dy = ty - actor.y, dist = Math.hypot(dx, dy), step = speedOf(actor) * dt;
      // Screen-right in this view (camera south-east of the scene) is +x +y; face by the screen motion.
      const screenDx = (dx + dy) * Math.SQRT1_2;
      if (Math.abs(screenDx) > 0.05) setFacing(actor, screenDx > 0 ? "right" : "left");
      if (dist <= step) {
        actor.x = tx; actor.y = ty; actor.route.shift();
        if (!actor.route.length) { actor.route = null; play(actor, "idle"); setFacing(actor, actor.endFace); actor.resolveRoute?.(true); }
      } else { actor.x += dx / dist * step; actor.y += dy / dist * step; }
      needsSort = true; dirty = true;
    }
  }

  // ---- interaction: tap to walk, tap NPCs, triggers and exits ----
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const terrain = gltf.scene.getObjectByName("terrain");
  let explore = null; // { onTalk(key), onTrigger(id), onExit(id), npcs:Set, insideZones:Set }
  function groundPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(terrain ?? gltf.scene, true)[0];
    return hit ? [hit.point.x, -hit.point.z] : null;
  }
  const tapRing = doc.createElement("i"); tapRing.className = "cm-sf__tap"; tapRing.hidden = true; markers.append(tapRing);
  // A short tap walks there (A*); a drag is a virtual joystick (direct steering).
  const stick = doc.createElement("div"); stick.className = "cm-sf__stick"; stick.hidden = true;
  const knob = doc.createElement("i"); knob.className = "cm-sf__knob"; stick.append(knob); root.append(stick);
  let press = null, steer = null;
  function onPressStart(event) {
    if (!explore || explore.locked || press) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    try { canvas.setPointerCapture(event.pointerId); } catch { /* capture is a courtesy */ }
  }
  function onPressMove(event) {
    if (!press || event.pointerId !== press.id || !explore || explore.locked) return;
    const sx = event.clientX - press.x, sy = event.clientY - press.y, len = Math.hypot(sx, sy);
    if (!press.dragging && len < 14) return;
    if (!press.dragging) {
      press.dragging = true; const rect = root.getBoundingClientRect();
      stick.style.transform = `translate(${Math.round(press.x - rect.left)}px, ${Math.round(press.y - rect.top)}px)`; stick.hidden = false;
      const me = actors.get(partnerKey); if (me) { me.resolveRoute?.(false); me.route = null; }
    }
    const k = Math.min(1, len / 56);
    knob.style.transform = `translate(${Math.round(sx / (len || 1) * 40 * k)}px, ${Math.round(sy / (len || 1) * 40 * k)}px)`;
    // Screen right is field +x +y; screen up is field -x +y (camera south-east of the scene).
    const dx = (sx + sy) * Math.SQRT1_2, dy = (sx - sy) * Math.SQRT1_2, n = Math.hypot(dx, dy) || 1;
    steer = len < 10 ? null : { dx: dx / n, dy: dy / n, k: Math.max(0.35, k) };
  }
  function onPressEnd(event) {
    if (!press || event.pointerId !== press.id) return;
    const wasDrag = press.dragging; press = null; steer = null; stick.hidden = true;
    const me = actors.get(partnerKey);
    if (wasDrag) { if (me && !me.route) play(me, "idle"); return; }
    onCanvasTap(event);
  }
  function steerPartner(dt) {
    const me = actors.get(partnerKey); if (!me || !steer || explore?.locked) return;
    const step = speedOf(me) * steer.k * dt;
    let nx = me.x + steer.dx * step, ny = me.y + steer.dy * step;
    if (!grid.walkable(nx, ny)) { if (grid.walkable(nx, me.y)) ny = me.y; else if (grid.walkable(me.x, ny)) nx = me.x; else { nx = me.x; ny = me.y; } }
    if (nx !== me.x || ny !== me.y) {
      me.x = nx; me.y = ny; needsSort = true; dirty = true;
      if (me.wrap.dataset.action !== "walk") play(me, "walk");
      const screenDx = (steer.dx + steer.dy) * Math.SQRT1_2; if (Math.abs(screenDx) > 0.05) setFacing(me, screenDx > 0 ? "right" : "left");
    }
  }
  // The action button: talk to a neighbour or inspect a spot when standing beside it.
  const action = doc.createElement("button"); action.type = "button"; action.className = "cm-sf__act"; action.hidden = true; action.dataset.sfAction = "interact";
  const actionIcon = doc.createElement("span"); actionIcon.className = "cm-sf__act-icon"; const actionLabel = doc.createElement("span"); actionLabel.className = "cm-sf__act-label";
  action.append(actionIcon, actionLabel); root.append(action);
  let nearby = null;
  const TALK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v10H9l-4 4v-4H4z" fill="currentColor"/><circle cx="9" cy="10" r="1.3" fill="#12183a"/><circle cx="12.5" cy="10" r="1.3" fill="#12183a"/><circle cx="16" cy="10" r="1.3" fill="#12183a"/></svg>';
  const LOOK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M14.2 14.2 20 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  function updateNearby() {
    let next = null;
    const me = actors.get(partnerKey);
    if (me && explore && !explore.locked && !me.route) {
      // Standing inside an inspect spot is the more specific intent; otherwise the nearest neighbour.
      for (const [id, anchor] of Object.entries(data.anchors)) if (anchor.kind === "inspect" && inZone(anchor, me.x, me.y)) { next = { kind: "inspect", key: id }; break; }
      let best = 1.8;
      if (!next) for (const key of explore.npcs) { const a = actors.get(key); if (!a) continue; const d = Math.hypot(a.x - me.x, a.y - me.y); if (d < best) { best = d; next = { kind: "talk", key }; } }
    }
    const key = next ? `${next.kind}:${next.key}` : "";
    if (key === (nearby ? `${nearby.kind}:${nearby.key}` : "")) return;
    nearby = next; action.hidden = !next;
    if (next) {
      actionIcon.innerHTML = next.kind === "talk" ? TALK_ICON : LOOK_ICON;
      actionLabel.textContent = (next.kind === "talk" ? explore?.labels?.talk : explore?.labels?.inspect) ?? "";
      action.dataset.kind = next.kind;
    }
  }
  action.addEventListener("click", event => {
    event.stopPropagation(); if (!nearby || !explore || explore.locked) return;
    const { kind, key } = nearby, me = actors.get(partnerKey);
    if (kind === "talk") { const npc = actors.get(key); if (npc && me) { setFacing(me, npc.x + npc.y > me.x + me.y ? "right" : "left"); setFacing(npc, me.x + me.y > npc.x + npc.y ? "right" : "left"); } explore.onTalk?.(key); }
    else explore.onTrigger?.(key);
  });
  function onCanvasTap(event) {
    if (!explore || explore.locked) return;
    const point = groundPoint(event.clientX, event.clientY);
    if (!point) return;
    const target = grid.nearest(point[0], point[1], 3);
    if (!target) return;
    const p = project(world(target[0], target[1]));
    tapRing.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`; tapRing.hidden = false;
    tapRing.classList.remove("is-live"); void tapRing.offsetWidth; tapRing.classList.add("is-live");
    void walkTo(partnerKey, target);
  }
  canvas.addEventListener("pointerdown", onPressStart);
  canvas.addEventListener("pointermove", onPressMove);
  canvas.addEventListener("pointerup", onPressEnd);
  canvas.addEventListener("pointercancel", onPressEnd);
  function onActorTap(event) {
    const wrap = event.target.closest?.(".cm-sf__actor"); if (!wrap || !explore || explore.locked) return;
    const key = wrap.dataset.actor; if (key === partnerKey || !explore.npcs.has(key)) return;
    event.preventDefault(); event.stopPropagation();
    const npc = actors.get(key), me = actors.get(partnerKey); if (!npc || !me) return;
    const side = (me.x + me.y) < (npc.x + npc.y) ? -1 : 1, spot = grid.nearest(npc.x + side * 0.85, npc.y + side * 0.85, 4) ?? [npc.x, npc.y];
    void walkTo(partnerKey, spot).then(arrived => {
      if (!arrived && Math.hypot(me.x - npc.x, me.y - npc.y) > 2.2) return;
      setFacing(me, npc.x + npc.y > me.x + me.y ? "right" : "left"); setFacing(npc, me.x + me.y > npc.x + npc.y ? "right" : "left");
      explore?.onTalk?.(key);
    });
  }
  layer.addEventListener("pointerdown", onActorTap);
  function checkZones() {
    if (!explore || explore.locked) return;
    const me = actors.get(partnerKey); if (!me) return;
    for (const [id, anchor] of Object.entries(data.anchors)) {
      if (anchor.kind !== "trigger" && anchor.kind !== "exit") continue; // "inspect" spots use the action button
      const inside = inZone(anchor, me.x, me.y), was = explore.inside.has(id);
      if (inside && !was) {
        explore.inside.add(id); (anchor.kind === "exit" ? explore.onExit : explore.onTrigger)?.(id);
        if (!explore || explore.locked) return; // the callback ended or locked the exploration
      } else if (!inside && was) explore.inside.delete(id);
    }
  }

  // ---- frame (driven by the shared Pixi ticker) ----
  let lastSun = null;
  function tick(t) {
    if (disposed) return;
    const dt = Math.min(0.05, Math.max(0, (t?.deltaMS ?? 16.7) / 1000));
    stepActors(dt); steerPartner(dt); updateNearby();
    const me = actors.get(partnerKey);
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt * 1000 / camTween.ms);
      const k = camTween.t < 0.5 ? 4 * camTween.t ** 3 : 1 - (-2 * camTween.t + 2) ** 3 / 2;
      focus.lerpVectors(camTween.from, camTween.to, k);
      if (camTween.t >= 1) { const done = camTween.done; camTween = null; done?.(); }
      dirty = true;
    } else if (me && !camHold && !explore?.holdCamera) {
      focusGoal.copy(world(me.x, me.y, grid.heightAt(me.x, me.y) + 0.6));
      if (focus.distanceToSquared(focusGoal) > 1e-6) { focus.lerp(focusGoal, 1 - Math.exp(-dt * 6)); if (focus.distanceToSquared(focusGoal) < 1e-5) focus.copy(focusGoal); dirty = true; }
    }
    if (!dirty) { checkZones(); frame++; return; }
    dirty = false;
    camera.position.copy(focus).add(offset); camera.lookAt(focus);
    const sunKey = `${focus.x.toFixed(1)},${focus.z.toFixed(1)}`;
    if (sunKey !== lastSun) { sun.position.set(focus.x - 8, 18, focus.z + 10); sun.target.position.copy(focus); sun.target.updateMatrixWorld(); lastSun = sunKey; renderer.shadowMap.needsUpdate = true; }
    renderer.render(scene, camera);
    for (const actor of actors.values()) placeActor(actor);
    for (const [id, node] of marks) {
      // An off-screen objective clamps to the screen edge and points toward it.
      const a = data.anchors[id], p = project(world(a.x, a.y));
      const minX = 34, maxX = width - 34, minY = 120, maxY = height - 190;
      const edge = p.x < minX || p.x > maxX || p.y < minY || p.y > maxY;
      const x = Math.max(minX, Math.min(maxX, p.x)), y = Math.max(minY, Math.min(maxY, p.y));
      node.dataset.edge = edge ? "on" : "off";
      node.style.setProperty("--angle", `${Math.atan2(p.y - y, p.x - x)}rad`);
      node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      node.dataset.goalX = String(a.x); node.dataset.goalY = String(a.y);
    }
    if (needsSort) { for (const actor of actors.values()) actor.wrap.style.zIndex = String(Math.round(1000 - actor.y * 20 + actor.x * 2)); needsSort = false; }
    checkZones();
    frame++;
  }
  ticker.add(tick);
  const resizer = typeof globalThis.ResizeObserver === "function" ? new globalThis.ResizeObserver(() => { resize(); for (const a of actors.values()) void buildBody(a); }) : null;
  resizer?.observe(host);
  const spawn = data.anchors.spawn;
  focus.copy(world(spawn.x, spawn.y)); focusGoal.copy(focus);

  return Object.freeze({
    element: root, data, grid,
    get frames() { return frame; },
    anchor: id => data.anchors[id] ?? null,
    /** Where an anchor (or a field point) is on screen, in host pixels. */
    screenOf(target) {
      const point = Array.isArray(target) ? target : data.anchors[target] ? [data.anchors[target].x, data.anchors[target].y] : null;
      if (!point) return null;
      const p = project(world(point[0], point[1])); return { x: p.x, y: p.y };
    },
    // Stage verbs (the director's interface).
    async setScene() { /* a field is its own scene; switching fields is the screen's job */ },
    enter, exit: async (key) => { const a = actors.get(key); if (!a) return; a.sprite?.dispose(); a.wrap.remove(); actors.delete(key); },
    move: (key, to, options = {}) => walkTo(key, to, options),
    async act(key, action, { face = null, instant = false } = {}) {
      const actor = actors.get(key); if (!actor || disposed) return;
      setFacing(actor, face);
      if (action === "idle" || action === "walk") { play(actor, action); return; }
      if (instant || !actor.sprite || reducedMotion) { play(actor, action, { loop: false }); await wait(instant ? 0 : 160, instant); if (actors.get(key) === actor) play(actor, "idle"); return; }
      await new Promise(resolve => { let done = false; const end = () => { if (!done) { done = true; resolve(); } }; play(actor, action, { loop: false, onEnd: end }); later(end, 1600); });
      if (actors.get(key) === actor && !disposed) play(actor, "idle");
    },
    face(key, face) { const actor = actors.get(key); if (actor) setFacing(actor, face); },
    has: key => actors.has(key),
    position: key => { const a = actors.get(key); return a ? [a.x, a.y] : null; },
    bubble(key, glyph) {
      const actor = actors.get(key); if (!actor) return;
      actor.bubble.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${BUBBLES[glyph] ?? BUBBLES["!"]}</svg>`;
      actor.bubble.dataset.glyph = glyph; actor.bubble.hidden = false;
      actor.bubble.classList.remove("is-live"); void actor.bubble.offsetWidth; actor.bubble.classList.add("is-live");
      clearTimer(actor.bubbleTimer); actor.bubbleTimer = later(() => { actor.bubble.hidden = true; }, 1700);
    },
    async setTag(key, text, { glitch = true, instant = false, state = "" } = {}) {
      const actor = actors.get(key); if (!actor) return;
      actor.tag.hidden = !text;
      if (glitch && !instant && !reducedMotion) { actor.tag.dataset.glitch = "on"; await wait(420); }
      actor.tag.textContent = text; actor.tag.dataset.state = state; delete actor.tag.dataset.glitch;
    },
    speaking(key) { for (const a of actors.values()) a.wrap.toggleAttribute("data-speaking", a.key === key); },
    noise(on) { root.dataset.noise = on ? "on" : "off"; },
    alarm(on) { root.dataset.alarm = on ? "on" : "off"; },
    flash() { root.dataset.flash = "on"; later(() => { delete root.dataset.flash; }, 420); },
    /** "taken" / "hidden" hides the prop's mesh in the location (e.g. the gift's glint). */
    propState(id, state) {
      const object = gltf.scene.getObjectByName(`${id}_glint`) ?? gltf.scene.getObjectByName(id);
      if (object && (state === "taken" || state === "hidden")) { object.visible = false; dirty = true; }
    },
    target(kind, id, onTap) {
      const node = kind === "actor" ? actors.get(id)?.wrap : null;
      if (!node) return () => {};
      node.dataset.target = "on";
      const handler = event => { event.preventDefault(); event.stopPropagation(); onTap(); };
      node.addEventListener("pointerdown", handler);
      return () => { node.removeEventListener("pointerdown", handler); delete node.dataset.target; };
    },
    async transform(key, intoKey, spec) {
      const actor = actors.get(key); if (!actor) return;
      actors.delete(key); actor.key = intoKey; actor.spec = { ...actor.spec, ...spec }; actor.wrap.dataset.actor = intoKey; actors.set(intoKey, actor);
      if (partnerKey === key) partnerKey = intoKey;
      await buildBody(actor);
    },
    gift(key) {
      const actor = actors.get(key); if (!actor) return null;
      const node = doc.createElement("span"); node.className = "cm-da-gift";
      node.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l6 6-6 12-6-12z" fill="#bff6ff"/><path d="M12 3l6 6H6z" fill="#ffffff"/></svg>';
      actor.wrap.append(node); return node;
    },
    // Camera and fades (Moonlight-style: every cut hides behind a fade).
    camera(target, { ms = 600, instant = false } = {}) {
      const point = Array.isArray(target) ? world(target[0], target[1]) : actors.get(target) ? world(actors.get(target).x, actors.get(target).y) : null;
      if (!point) return Promise.resolve();
      camHold = target !== partnerKey;
      point.y += 0.6;
      if (instant || reducedMotion || ms <= 0) { focus.copy(point); dirty = true; return Promise.resolve(); }
      return new Promise(resolve => { camTween = { from: focus.clone(), to: point, t: 0, ms, done: resolve }; });
    },
    holdCamera(on) { if (explore) explore.holdCamera = Boolean(on); },
    async fade(direction, { ms = 320, instant = false } = {}) {
      veil.dataset.state = direction === "out" ? "dark" : "clear";
      if (!instant && !reducedMotion) await wait(ms);
    },
    /**
     * Free exploration until the caller ends it: tap to walk, tap NPCs to talk,
     * zones fire once per entry. `lock(true)` while an event plays.
     */
    explore({ partner = "partner", npcs = [], onTalk = null, onTrigger = null, onExit = null, labels = {} } = {}) {
      partnerKey = partner;
      explore = { npcs: new Set(npcs), onTalk, onTrigger, onExit, labels, inside: new Set(), locked: false, holdCamera: false };
      camHold = false;
      const me = actors.get(partnerKey);
      if (me) for (const [id, anchor] of Object.entries(data.anchors)) if ((anchor.kind === "trigger" || anchor.kind === "exit") && inZone(anchor, me.x, me.y)) explore.inside.add(id);
      root.dataset.explore = "on";
      for (const key of npcs) actors.get(key)?.wrap.setAttribute("data-npc", "true");
      return Object.freeze({
        lock(on) {
          if (!explore) return;
          explore.locked = Boolean(on); root.dataset.explore = on ? "locked" : "on";
          if (on) { press = null; steer = null; stick.hidden = true; nearby = null; action.hidden = true; const me = actors.get(partnerKey); if (me && !me.route) play(me, "idle"); }
        },
        end() { explore = null; delete root.dataset.explore; tapRing.hidden = true; stick.hidden = true; action.hidden = true; nearby = null; press = null; steer = null; }
      });
    },
    /** A pulsing ground marker on an anchor (objective hint). */
    mark(id, on = true) {
      if (!on) { marks.get(id)?.remove(); marks.delete(id); return; }
      if (!data.anchors[id] || marks.has(id)) return;
      const node = doc.createElement("i"); node.className = "cm-sf__mark"; node.dataset.mark = id; markers.append(node); marks.set(id, node);
      // Tapping an edge pointer walks toward the objective.
      node.addEventListener("pointerdown", event => {
        if (!explore || explore.locked || node.dataset.edge !== "on") return;
        event.preventDefault(); event.stopPropagation();
        const goal = grid.nearest(data.anchors[id].x, data.anchors[id].y, 6); if (goal) void walkTo(partnerKey, goal);
      });
      dirty = true;
    },
    relayout() { resize(); },
    dispose() {
      if (disposed) return; disposed = true;
      ticker.remove(tick); resizer?.disconnect();
      for (const t of timers) clearTimer(t); timers.clear();
      canvas.removeEventListener("pointerdown", onPressStart); canvas.removeEventListener("pointermove", onPressMove);
      canvas.removeEventListener("pointerup", onPressEnd); canvas.removeEventListener("pointercancel", onPressEnd); layer.removeEventListener("pointerdown", onActorTap);
      for (const actor of actors.values()) actor.sprite?.dispose(); actors.clear();
      gltf.scene.traverse(node => { if (node.isMesh) { node.geometry?.dispose(); for (const m of [node.material].flat()) { m?.map?.dispose(); m?.dispose(); } } });
      sea.geometry.dispose(); sea.material.dispose(); seaGrid.geometry.dispose(); for (const m of [seaGrid.material].flat()) m.dispose();
      renderer.dispose(); renderer.forceContextLoss(); root.remove();
    }
  });
}

export { crestMarkup };
