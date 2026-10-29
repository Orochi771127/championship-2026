// Data Area grid theater (OWNER_APPROVED_ADAPTATION 2026-10-29): the stage of
// the "Unheard Echoes" story mode. A dual-plane cyber horizon -- a ceiling and a
// floor of glowing grid lines converging on a white-cyan light seam -- with a
// radar window, faction data nodes and a memory matrix panel beside it, and a
// floating isometric platform where the story's partners act.
//
// The layout studies a reference screen's composition only (two perspective
// grids meeting at a bright horizon, side panels, a stage in the middle); every
// pixel here is drawn by this module: the grid tile is painted once with Canvas
// 2D, the planes are put in perspective with CSS 3-D transforms, the platform,
// props and crests are vector markup. Every actor is one of the product's own
// partners playing its reviewed / public-runtime animation cells
// (spriteMotionPlayer.js: idle, walk, attack, hit, cheer); a partner without
// motion here stands as its own Database portrait.
//
// Motion is transform / opacity only: CSS loops for the grid drift, seam and
// panels, Web Animations for actors. No requestAnimationFrame loop, no WebGL
// context and no second ticker. It owns no game state.

import { createSpriteMotion, loadShowcaseMotion, showcaseFitScale, showcaseMotionAvailable, showcaseSpeciesId } from "../juicy/spriteMotionPlayer.js";
import { juicyPortrait } from "../juicy/juicyArt.js";
import { DATA_AREA_SEQUENCES } from "../../data/dataAreaStoryCampaign.js";

export const DATA_AREA_GRID_CELL = 64;
const WALK_SPEED = Object.freeze({ light: 0.85, heavy: 0.5, boss: 0.42 }); // platform units per second
const TOP = 36 / 70, HALF_W = 0.4, HALF_H = 17 / 70; // the platform's top face (viewBox 100 x 70) in world-box fractions

// ---- vector art -------------------------------------------------------------
const CRESTS = Object.freeze({
  leaf: '<path d="M12 3c5 2 8 6 7 11-1 4-5 7-9 6 0-6 1-10 2-17zM12 3C7 5 4 9 5 14c.6 3 2.5 5 5 6" fill="currentColor" opacity=".9"/><path d="M12 6v14" stroke="#0b2a1c" stroke-width="1.4"/>',
  gear: '<path d="M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm-1.3-5h2.6l.5 2.6 2 .9 2.2-1.5 1.8 1.8-1.5 2.2.9 2 2.6.5v2.6l-2.6.5-.9 2 1.5 2.2-1.8 1.8-2.2-1.5-2 .9-.5 2.6h-2.6l-.5-2.6-2-.9-2.2 1.5-1.8-1.8 1.5-2.2-.9-2-2.6-.5v-2.6l2.6-.5.9-2-1.5-2.2 1.8-1.8 2.2 1.5 2-.9z" fill="currentColor" fill-rule="evenodd"/>',
  lotus: '<path d="M12 4c2 3 2.6 6 0 10-2.6-4-2-7 0-10zM5 8c3 .6 5 3 6.5 7C8 14.6 5.6 12 5 8zm14 0c-.6 4-3 6.6-6.5 7C14 11 16 8.6 19 8zM3.5 14c3-.4 6 .8 8.5 2.6-3 1.6-6.4 1.2-8.5-2.6zm17 0c-2.1 3.8-5.5 4.2-8.5 2.6 2.5-1.8 5.5-3 8.5-2.6z" fill="currentColor"/>'
});
export function crestMarkup(crest, className = "cm-da-crest") {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${CRESTS[crest] ?? CRESTS.gear}</svg>`;
}

const BUBBLE_GLYPHS = Object.freeze({
  "!": '<path d="M10 3h4l-1 11h-2L10 3zm1 13h2v3h-2z" fill="currentColor"/>',
  "?": '<path d="M8 7a4 4 0 1 1 6 3.4c-1 .6-1 1.1-1 2.6h-2c0-2.1.1-2.9 1.4-3.8A2 2 0 1 0 10 7H8zm3 8h2v3h-2z" fill="currentColor"/>',
  "...": '<path d="M5 11h3v3H5zm5.5 0h3v3h-3zm5.5 0h3v3h-3z" fill="currentColor"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.6C5 7.6 7 6 9 6c1.4 0 2.4.7 3 1.7C12.6 6.7 13.6 6 15 6c2 0 4 1.6 4 4.4C19 15.6 12 20 12 20z" fill="currentColor"/>',
  note: '<path d="M10 4v10.2A3 3 0 1 0 12 17V8l6-1.6v5.8A3 3 0 1 0 20 15V3l-10 1z" fill="currentColor"/>',
  sad: '<path d="M12 4c2.6 3.6 4.5 6.4 4.5 9a4.5 4.5 0 0 1-9 0c0-2.6 1.9-5.4 4.5-9z" fill="currentColor"/>',
  spark: '<path d="M12 2l2 7 7 3-7 3-2 7-2-7-7-3 7-3z" fill="currentColor"/>'
});

// Props are drawn in a 100 x 100 box standing on its bottom centre.
const PROP_ART = Object.freeze({
  warp: { w: 0.2, h: 0.22, svg: `<ellipse cx="50" cy="86" rx="46" ry="12" fill="rgba(120,230,255,.25)" stroke="#bff6ff" stroke-width="3"/>
    <ellipse cx="50" cy="86" rx="30" ry="7.5" fill="none" stroke="#e0faff" stroke-width="2.4" class="cm-da-prop__spin"/>
    <rect x="22" y="8" width="56" height="78" fill="url(#cm-da-beam)" class="cm-da-prop__beam"/>` },
  terminal: { w: 0.2, h: 0.3, svg: `<path d="M14 92 50 78 86 92 50 100z" fill="#0b1a46"/><path d="M20 30 50 18 80 30v52L50 94 20 82z" fill="#1d3f8f" stroke="#9fe8ff" stroke-width="2"/>
    <path d="M26 34 50 25 74 34v32L50 75 26 66z" fill="#0a2a5c" class="cm-da-prop__screen"/><path d="M31 42h30M31 49h22M31 56h26" stroke="#7ff3ff" stroke-width="3" stroke-linecap="round" class="cm-da-prop__text"/>
    <path d="M50 18V6" stroke="#bff6ff" stroke-width="2"/><circle cx="50" cy="5" r="3" fill="#ff5a8a" class="cm-da-prop__led"/>` },
  flower: { w: 0.095, h: 0.14, svg: `<path d="M50 98C49 80 52 66 50 54" stroke="#3fcf7a" stroke-width="6" fill="none"/><path d="M50 80c-14-2-20-10-22-18 10 0 18 6 22 18z" fill="#4fe08b"/>
    <g transform="translate(50 40)"><circle r="12" cy="-18" fill="#ff8fc8"/><circle r="12" cx="17" cy="-6" fill="#ff8fc8"/><circle r="12" cx="11" cy="14" fill="#ffa6d6"/><circle r="12" cx="-11" cy="14" fill="#ffa6d6"/><circle r="12" cx="-17" cy="-6" fill="#ff8fc8"/><circle r="9" fill="#ffe36a"/></g>` },
  broadcast: { w: 0.17, h: 0.36, svg: `<path d="M38 98h24L56 40H44z" fill="#2a3557" stroke="#9fb8ff" stroke-width="2"/><rect x="34" y="18" width="32" height="24" rx="4" fill="#3c4a78" stroke="#c9d6ff" stroke-width="2"/>
    <circle cx="50" cy="30" r="7" fill="#ff5a8a" class="cm-da-prop__led"/><g class="cm-da-prop__waves" fill="none" stroke="#ff9ec0" stroke-width="3"><path d="M72 18q10 12 0 24"/><path d="M80 12q16 18 0 36"/><path d="M28 18q-10 12 0 24"/><path d="M20 12q-16 18 0 36"/></g>
    <path d="M44 58l8 6-6 8 10 8" stroke="#ffd36a" stroke-width="3" fill="none" class="cm-da-prop__crack"/>` },
  rift: { w: 0.2, h: 0.46, svg: `<path d="M50 2C64 22 70 40 64 58c6 14 2 28-14 40-16-12-20-26-14-40-6-18 0-36 14-56z" fill="url(#cm-da-rift)" class="cm-da-prop__rift"/>
    <path d="M50 10c8 16 10 30 6 46 4 12 0 22-6 32-6-10-10-20-6-32-4-16-2-30 6-46z" fill="#f4e9ff" opacity=".55" class="cm-da-prop__rift-core"/>
    <g fill="#c9a6ff" font-family="monospace" font-size="9" class="cm-da-prop__glyphs"><text x="18" y="30">0</text><text x="76" y="44">1</text><text x="20" y="70">/</text><text x="78" y="78">#</text><text x="30" y="92">%</text></g>` },
  desk: { w: 0.24, h: 0.2, svg: `<path d="M6 54 50 36 94 54v26L50 98 6 80z" fill="#22408f" stroke="#a7ecff" stroke-width="2"/><path d="M6 54 50 72 94 54" fill="none" stroke="#e0faff" stroke-width="2"/>
    <path d="M38 52 56 45 68 50 50 57z" fill="#f2f7ff"/><path d="M44 51l10-4" stroke="#7aa0d8" stroke-width="1.5"/>` },
  "banner-lumen": { w: 0.11, h: 0.36, crest: "leaf", colors: ["#2fd18b", "#ffd36a"] },
  "banner-iron": { w: 0.11, h: 0.36, crest: "gear", colors: ["#2a2f3a", "#3ab8ff"] },
  "banner-lotus": { w: 0.11, h: 0.36, crest: "lotus", colors: ["#4a2366", "#e6e9f5"] },
  "lotus-lamp": { w: 0.09, h: 0.2, svg: `<path d="M50 98V58" stroke="#c9b6ff" stroke-width="4"/><circle cx="50" cy="40" r="22" fill="rgba(200,160,255,.35)" class="cm-da-prop__glow"/>
    <g transform="translate(50 46)" fill="#efe6ff"><path d="M0-22c6 8 6 16 0 22-6-6-6-14 0-22z"/><path d="M-16-10c8 2 13 6 15 10-8 1-13-3-15-10z"/><path d="M16-10C8-8 3-4 1 0c8 1 13-3 15-10z"/></g>` },
  bed: { w: 0.2, h: 0.14, svg: `<path d="M6 60 50 42 94 60v18L50 96 6 78z" fill="#3a2a66" stroke="#d7c6ff" stroke-width="2"/><path d="M14 58 50 44 86 58 50 72z" fill="#f2ecff" opacity=".9"/><ellipse cx="34" cy="56" rx="10" ry="4" fill="#cdb8ff"/>` },
  gate: { w: 0.16, h: 0.4, svg: `<path d="M16 98V24q34-26 68 0v74" fill="none" stroke="#7ff3ff" stroke-width="7"/><path d="M16 98V24q34-26 68 0v74" fill="none" stroke="#e0faff" stroke-width="2"/>
    <path d="M36 62h22l-6-8m6 8-6 8" stroke="#5dff9a" stroke-width="5" fill="none" stroke-linecap="round" class="cm-da-prop__arrow"/>` },
  spiral: { w: 0.62, h: 0.62, svg: `<g class="cm-da-prop__spiral" fill="none" stroke-linecap="round"><path d="M50 50m0-4a4 4 0 1 1-4 4 8 8 0 0 1 8-8 12 12 0 0 1 12 12 16 16 0 0 1-16 16 20 20 0 0 1-20-20 24 24 0 0 1 24-24 28 28 0 0 1 28 28 32 32 0 0 1-32 32" stroke="#a46bff" stroke-width="3.4"/>
    <path d="M50 50m0-4a4 4 0 1 1-4 4 8 8 0 0 1 8-8 12 12 0 0 1 12 12 16 16 0 0 1-16 16 20 20 0 0 1-20-20 24 24 0 0 1 24-24 28 28 0 0 1 28 28 32 32 0 0 1-32 32" stroke="#f2e6ff" stroke-width="1" opacity=".7"/></g>` }
});

function bannerSvg(spec) {
  const [base, accent] = spec.colors;
  return `<path d="M30 98V6" stroke="#cfe6ff" stroke-width="3"/><path d="M32 8h46l-8 14 8 14H32z" fill="${base}" stroke="${accent}" stroke-width="2.4" class="cm-da-prop__flag"/>
    <g transform="translate(43 10) scale(.75)" color="${accent}">${CRESTS[spec.crest]}</g>`;
}
const SVG_DEFS = `<defs><linearGradient id="cm-da-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#bff6ff" stop-opacity=".7"/><stop offset="1" stop-color="#bff6ff" stop-opacity="0"/></linearGradient>
  <radialGradient id="cm-da-rift" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#b98cff"/><stop offset=".75" stop-color="#5a2aa8"/><stop offset="1" stop-color="#1fd6ff" stop-opacity=".8"/></radialGradient></defs>`;

export function propMarkup(kind) {
  const spec = PROP_ART[kind];
  if (!spec) return "";
  const body = spec.crest ? bannerSvg(spec) : spec.svg;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">${SVG_DEFS}${body}</svg>`;
}
export const DATA_AREA_PROP_ART = PROP_ART;

// The isometric hex platform: top face, two visible sides, a glowing rim and a tile lattice.
function platformMarkup() {
  const top = "3,36 25,15.5 75,15.5 97,36 75,56.5 25,56.5";
  const lattice = [];
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    lattice.push(`<path d="M${(3 + 22 * t).toFixed(2)} ${(36 - 20.5 * t).toFixed(2)}L${(25 + 72 * t).toFixed(2)} ${(56.5 - 20.5 * t).toFixed(2)}"/>`);
    lattice.push(`<path d="M${(25 + 72 * t).toFixed(2)} ${(15.5 + 20.5 * t).toFixed(2)}L${(3 + 22 * t).toFixed(2)} ${(36 + 20.5 * t).toFixed(2)}"/>`);
  }
  return `<svg class="cm-da-platform__svg" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id="cm-da-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f7fe6" stop-opacity=".55"/><stop offset="1" stop-color="#173a92" stop-opacity=".82"/></linearGradient>
      <linearGradient id="cm-da-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3f9a"/><stop offset="1" stop-color="#0a1640"/></linearGradient></defs>
    <ellipse cx="50" cy="62" rx="46" ry="7" fill="rgba(160,240,255,.35)" class="cm-da-platform__under"/>
    <path d="M3 36 25 56.5 75 56.5 97 36 97 42 75 63 25 63 3 42z" fill="url(#cm-da-side)" stroke="#9fe8ff" stroke-width=".5"/>
    <polygon points="${top}" fill="url(#cm-da-top)"/>
    <g class="cm-da-platform__lattice" stroke="#bff4ff" stroke-width=".25" opacity=".55">${lattice.join("")}</g>
    <polygon points="${top}" fill="none" stroke="#e0faff" stroke-width=".9" class="cm-da-platform__rim"/>
    <path d="M25 56.5 75 56.5" stroke="#ffffff" stroke-width=".6" opacity=".8"/>
  </svg>`;
}

// ---- motion loading -----------------------------------------------------------
const motionCache = new Map();
/** The five story sequences of one species, loaded once per page. */
export function loadDataAreaMotion(speciesIndex, { href = globalThis.location?.href, fetchImpl } = {}) {
  const speciesId = showcaseSpeciesId(speciesIndex);
  if (!speciesId || !showcaseMotionAvailable(speciesId, href)) return Promise.reject(new Error("DATA_AREA_MOTION_UNAVAILABLE"));
  let entry = motionCache.get(speciesId);
  if (!entry) {
    entry = loadShowcaseMotion(speciesId, { baseUrl: href, sequences: Object.values(DATA_AREA_SEQUENCES), ...(fetchImpl ? { fetchImpl } : {}) });
    entry.catch(() => { if (motionCache.get(speciesId) === entry) motionCache.delete(speciesId); });
    motionCache.set(speciesId, entry);
    while (motionCache.size > 18) motionCache.delete(motionCache.keys().next().value);
  }
  return entry;
}

/** A grid tile painted once with Canvas 2D: a glowing cross at the cell centre and faint sub-lines. */
export function paintGridTile(doc, { cell = DATA_AREA_GRID_CELL, dpr = 2, color = "#e0faff", glow = "#7fe3ff" } = {}) {
  const canvas = doc?.createElement?.("canvas");
  const g = canvas?.getContext?.("2d");
  if (!g || typeof canvas.toDataURL !== "function") return null;
  canvas.width = canvas.height = cell * dpr;
  g.scale(dpr, dpr);
  const mid = cell / 2;
  g.strokeStyle = "rgba(170,225,255,.16)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 0.5); g.lineTo(cell, 0.5); g.moveTo(0.5, 0); g.lineTo(0.5, cell); g.stroke();
  g.shadowColor = glow; g.shadowBlur = 7; g.strokeStyle = color; g.lineWidth = 2.2;
  g.beginPath(); g.moveTo(mid, 0); g.lineTo(mid, cell); g.moveTo(0, mid); g.lineTo(cell, mid); g.stroke();
  g.shadowBlur = 10; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(mid, mid, 1.8, 0, Math.PI * 2); g.fill();
  try { return canvas.toDataURL("image/png"); } catch { return null; }
}

const el = (doc, tag, className, html = null) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (html !== null) node.innerHTML = html;
  return node;
};

/**
 * Mount the stage in `host`. Every actor method resolves when its motion has
 * played (immediately with { instant }); unknown actors are ignored.
 */
export function createDataAreaCyberStage({
  host, doc = host?.ownerDocument ?? globalThis.document, reducedMotion = false, quality = "balanced",
  loadMotion = loadDataAreaMotion, portraitOf = juicyPortrait, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout
} = {}) {
  if (!host) throw new TypeError("DATA_AREA_STAGE_HOST");
  const motionOk = !reducedMotion;
  const root = el(doc, "div", "cm-da-stage");
  root.dataset.set = "hub";
  root.dataset.motion = reducedMotion ? "reduced" : quality === "saver" ? "saver" : "full";
  root.setAttribute("aria-hidden", "true");

  const sky = el(doc, "div", "cm-da-stage__sky");
  const ceil = el(doc, "div", "cm-da-plane cm-da-plane--ceil"), ceilGrid = el(doc, "div", "cm-da-plane__grid");
  const floor = el(doc, "div", "cm-da-plane cm-da-plane--floor"), floorGrid = el(doc, "div", "cm-da-plane__grid");
  ceil.append(ceilGrid); floor.append(floorGrid);
  const tile = paintGridTile(doc);
  if (tile) for (const grid of [ceilGrid, floorGrid]) { grid.style.backgroundImage = `url("${tile}")`; grid.dataset.painted = "canvas"; }
  const horizon = el(doc, "div", "cm-da-horizon", '<i class="cm-da-horizon__bloom"></i><i class="cm-da-horizon__core"></i><i class="cm-da-horizon__scan"></i>');
  const railTop = el(doc, "div", "cm-da-rail cm-da-rail--top"), railBottom = el(doc, "div", "cm-da-rail cm-da-rail--bottom");

  // Side furniture: faction data nodes and a radar window (left), the memory matrix (right).
  const nodes = el(doc, "div", "cm-da-nodes", ["leaf", "gear", "lotus"].map(crest => `<span class="cm-da-node" data-crest="${crest}">${crestMarkup(crest)}</span>`).join(""));
  const radar = el(doc, "div", "cm-da-radar", '<i class="cm-da-radar__ring"></i><i class="cm-da-radar__ring cm-da-radar__ring--in"></i><i class="cm-da-radar__sweep"></i><i class="cm-da-radar__blip" style="--x:62%;--y:34%"></i><i class="cm-da-radar__blip" style="--x:30%;--y:66%"></i><span class="cm-da-radar__label">RADAR</span>');
  const matrix = el(doc, "div", "cm-da-matrix");
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const lit = [3, 9, 11, 16, 17, 23, 26, 30].includes(i), hot = i === 17;
    cells.push(`<i class="cm-da-matrix__cell" data-lit="${lit}" data-hot="${hot}" style="--d:${((i * 37) % 23) / 10}s"></i>`);
  }
  matrix.innerHTML = `<span class="cm-da-matrix__head"><b>MEMORY</b><i></i><i></i></span><span class="cm-da-matrix__grid">${cells.join("")}</span><span class="cm-da-matrix__bar"></span>`;

  const spiralLayer = el(doc, "div", "cm-da-stage__far");
  const world = el(doc, "div", "cm-da-world");
  const platform = el(doc, "div", "cm-da-platform", platformMarkup());
  const scene = el(doc, "div", "cm-da-scene");
  world.append(platform, scene);
  const fx = el(doc, "div", "cm-da-fx", '<i class="cm-da-fx__noise"></i><i class="cm-da-fx__scan"></i><i class="cm-da-fx__flash"></i><i class="cm-da-fx__alarm"></i>');
  root.append(sky, ceil, floor, horizon, railTop, railBottom, nodes, radar, matrix, spiralLayer, world, fx);
  host.append(root);

  const actors = new Map(), props = new Map();
  let disposed = false, speakingKey = null;
  // The world box follows the screen (rotation, the hall <-> play layout); re-place on resize.
  const resizer = typeof globalThis.ResizeObserver === "function" ? new globalThis.ResizeObserver(() => { if (!disposed) relayout(); }) : null;
  resizer?.observe(world);
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimer(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const wait = (ms, instant) => new Promise(resolve => { if (instant || ms <= 0 || disposed) resolve(); else later(resolve, ms); });

  // World box geometry: the platform sits low, centred, as wide as the phone allows.
  function box() {
    const w = Math.max(240, world.clientWidth || host.clientWidth || 390), h = Math.max(160, world.clientHeight || w * 0.7);
    return { w, h };
  }
  function toPx([x, y]) {
    const { w, h } = box();
    return { x: w * (0.5 + x * HALF_W), y: h * (TOP + y * HALF_H) };
  }
  function depth(y) { return 1 + y * 0.08; }

  function relayout() { for (const prop of props.values()) placeProp(prop); for (const actor of actors.values()) if (!actor.runs.size) placeActor(actor); }

  // ---- props ----
  function placeProp(prop) {
    const spec = PROP_ART[prop.kind]; if (!spec) return;
    const { w, h } = box();
    const p = toPx(prop.at);
    const width = w * spec.w, height = h * spec.h * (prop.kind === "spiral" ? 1 : depth(prop.at[1]));
    prop.node.style.width = `${Math.round(width)}px`; prop.node.style.height = `${Math.round(height)}px`;
    prop.node.style.transform = prop.kind === "spiral" ? `translate(${Math.round(p.x - width / 2)}px, ${Math.round(p.y - height * 0.9)}px)` : `translate(${Math.round(p.x - width / 2)}px, ${Math.round(p.y - height)}px)`;
    prop.node.style.zIndex = String(prop.kind === "spiral" ? 1 : Math.round((prop.at[1] + 1) * 100));
  }
  function setProps(list = []) {
    for (const prop of props.values()) prop.node.remove();
    props.clear();
    for (const entry of list) {
      const node = el(doc, "div", `cm-da-prop cm-da-prop--${entry.kind}`, propMarkup(entry.kind));
      node.dataset.prop = entry.id; node.dataset.kind = entry.kind;
      const prop = { ...entry, node };
      props.set(entry.id, prop);
      (entry.kind === "spiral" ? spiralLayer : scene).append(node);
      placeProp(prop);
    }
  }

  // ---- actors ----
  function placeActor(actor, at = actor.at) {
    const p = toPx(at);
    actor.wrap.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) scale(${depth(at[1]).toFixed(3)})`;
    actor.wrap.style.zIndex = String(Math.round((at[1] + 1) * 100) + 1);
  }
  function fitBox(spec) {
    const { w, h } = box();
    const scale = spec.boss ? 1.7 : spec.heavy ? 1.15 : 1;
    return { width: w * 0.46 * scale, height: h * 0.5 * scale };
  }
  async function buildBody(actor, spec) {
    actor.body.replaceChildren();
    actor.sprite?.dispose(); actor.sprite = null;
    let motion = null;
    try { motion = await loadMotion(spec.species); } catch { motion = null; }
    if (disposed) return;
    if (motion) {
      const fit = fitBox(spec);
      const sprite = createSpriteMotion({ doc, motion, scale: showcaseFitScale(motion, { ...fit, maxNative: 8 }), reducedMotion });
      sprite.element.classList.add("cm-da-actor__sprite");
      actor.body.append(sprite.element);
      actor.sprite = sprite;
      actor.bodyHeight = sprite.bodyHeight();
      sprite.setFacing(actor.facing);
      sprite.play(DATA_AREA_SEQUENCES.idle);
      actor.wrap.dataset.art = "motion";
    } else {
      const portrait = portraitOf(spec.species);
      const fit = fitBox(spec);
      if (portrait?.src) {
        const img = doc.createElement("img");
        img.className = "cm-da-actor__portrait"; img.alt = ""; img.src = portrait.src; img.decoding = "async";
        img.style.height = `${Math.round(fit.height * 0.9)}px`;
        actor.body.append(img);
      }
      actor.bodyHeight = fit.height * 0.9;
      actor.wrap.dataset.art = portrait?.src ? "portrait" : "none";
    }
    actor.tag.style.setProperty("--head", `${Math.round(actor.bodyHeight + 10)}px`);
    actor.bubble.style.setProperty("--head", `${Math.round(actor.bodyHeight + (actor.tag.hidden ? 8 : 34))}px`);
  }
  function setFacing(actor, face) {
    if (!face) return;
    actor.facing = face === "right" ? 1 : -1;
    actor.sprite?.setFacing(actor.facing);
    actor.wrap.dataset.facing = face;
  }
  function play(actor, action, { loop = action === "idle" || action === "walk", onEnd = null } = {}) {
    actor.wrap.dataset.action = action;
    if (!actor.sprite) { onEnd?.(); return 0; }
    actor.sprite.play(DATA_AREA_SEQUENCES[action] ?? 0, { loop, onEnd });
    return actor.sprite.releaseMs?.(DATA_AREA_SEQUENCES[action]) ?? 0;
  }
  function entryPoint(from, at) {
    if (from === "left") return [-1.25, at[1]];
    if (from === "right") return [1.25, at[1]];
    return null;
  }
  function animateTo(actor, to, ms, instant) {
    const fromTransform = actor.wrap.style.transform;
    actor.at = to; placeActor(actor, to);
    if (instant || !motionOk || ms <= 0 || typeof actor.wrap.animate !== "function") return Promise.resolve();
    const run = actor.wrap.animate([{ transform: fromTransform }, { transform: actor.wrap.style.transform }], { duration: ms, easing: "linear" });
    actor.runs.add(run);
    return run.finished.then(() => actor.runs.delete(run), () => actor.runs.delete(run));
  }

  async function enter(key, spec, { instant = false } = {}) {
    if (disposed) return;
    actors.get(key)?.wrap.remove();
    const wrap = el(doc, "div", "cm-da-actor");
    wrap.dataset.actor = key;
    if (spec.overwritten) wrap.dataset.overwritten = "true";
    if (spec.boss) wrap.dataset.boss = "true";
    if (spec.faction) wrap.dataset.faction = spec.faction;
    const shadow = el(doc, "i", "cm-da-actor__shadow");
    const body = el(doc, "div", "cm-da-actor__body");
    const tag = el(doc, "span", "cm-da-actor__tag"); tag.hidden = !spec.tag; tag.textContent = spec.tag ?? "";
    const bubble = el(doc, "span", "cm-da-actor__bubble"); bubble.hidden = true;
    wrap.append(shadow, body, tag, bubble);
    const actor = { key, spec, wrap, body, tag, bubble, sprite: null, at: spec.at, facing: spec.face === "right" ? 1 : -1, bodyHeight: 80, runs: new Set() };
    actors.set(key, actor);
    wrap.dataset.facing = spec.face ?? "left";
    scene.append(wrap);
    await buildBody(actor, spec);
    if (disposed) return;
    const start = entryPoint(spec.from, spec.at);
    if (spec.from === "warp" || spec.from === "rift") {
      placeActor(actor, spec.at);
      wrap.dataset.arrive = spec.from;
      if (!instant && motionOk) await wait(520);
      delete wrap.dataset.arrive;
      return;
    }
    if (start) {
      placeActor(actor, start);
      setFacing(actor, start[0] < spec.at[0] ? "right" : "left");
      play(actor, "walk");
      await animateTo(actor, spec.at, walkMs(start, spec.at, actor), instant);
      setFacing(actor, spec.face);
      play(actor, "idle");
      return;
    }
    placeActor(actor, spec.at);
  }
  function walkMs(a, b, actor) {
    const speed = actor?.spec?.boss ? WALK_SPEED.boss : actor?.spec?.heavy ? WALK_SPEED.heavy : WALK_SPEED.light;
    return Math.round(Math.hypot(b[0] - a[0], (b[1] - a[1]) * 1.6) / speed * 1000);
  }

  async function move(key, to, { instant = false, face = null } = {}) {
    const actor = actors.get(key); if (!actor || disposed) return;
    const from = actor.at;
    if (Math.abs(to[0] - from[0]) > 0.02) setFacing(actor, to[0] > from[0] ? "right" : "left");
    play(actor, "walk");
    await animateTo(actor, to, walkMs(from, to, actor), instant);
    if (face) setFacing(actor, face);
    if (actors.get(key) === actor) play(actor, "idle");
  }
  async function act(key, action, { face = null, instant = false } = {}) {
    const actor = actors.get(key); if (!actor || disposed) return;
    setFacing(actor, face);
    if (action === "idle" || action === "walk") { play(actor, action); return; }
    if (instant || !actor.sprite || reducedMotion) { play(actor, action, { loop: false }); await wait(instant ? 0 : 160, instant); if (actors.get(key) === actor) play(actor, "idle"); return; }
    await new Promise(resolve => {
      let settled = false;
      const done = () => { if (settled) return; settled = true; resolve(); };
      play(actor, action, { loop: false, onEnd: done });
      later(done, 1600);
    });
    if (actors.get(key) === actor && !disposed) play(actor, action === "cheer" ? "idle" : "idle");
  }
  async function exit(key, to = "warp", { instant = false } = {}) {
    const actor = actors.get(key); if (!actor) return;
    if (to === "left" || to === "right") await move(key, [to === "left" ? -1.3 : 1.3, actor.at[1]], { instant });
    else if (!instant && motionOk) { actor.wrap.dataset.leave = to; await wait(460); }
    actor.sprite?.dispose(); actor.wrap.remove(); actors.delete(key);
  }

  return Object.freeze({
    element: root,
    /** Change the set: clears the actors, places the props, flashes the warp. */
    async setScene(set, list = [], { instant = false } = {}) {
      if (disposed) return;
      if (!instant && motionOk && root.dataset.set !== set) { root.dataset.warp = "on"; await wait(260); }
      for (const actor of actors.values()) { actor.sprite?.dispose(); actor.wrap.remove(); }
      actors.clear();
      root.dataset.set = set;
      setProps(list);
      if (root.dataset.warp) later(() => { delete root.dataset.warp; }, 380);
    },
    enter, exit, move, act,
    face(key, face) { const actor = actors.get(key); if (actor) setFacing(actor, face); },
    has: key => actors.has(key),
    position: key => actors.get(key)?.at ?? null,
    bubble(key, glyph) {
      const actor = actors.get(key); if (!actor) return;
      actor.bubble.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${BUBBLE_GLYPHS[glyph] ?? BUBBLE_GLYPHS["!"]}</svg>`;
      actor.bubble.dataset.glyph = glyph;
      actor.bubble.hidden = false;
      actor.bubble.classList.remove("is-live"); void actor.bubble.offsetWidth; actor.bubble.classList.add("is-live");
      clearTimer(actor.bubbleTimer);
      actor.bubbleTimer = later(() => { actor.bubble.hidden = true; }, 1700);
    },
    /** Rewrite a floating name tag; `glitch` plays the overwrite noise first. */
    async setTag(key, text, { glitch = true, instant = false, state = "" } = {}) {
      const actor = actors.get(key); if (!actor) return;
      actor.tag.hidden = !text;
      if (glitch && !instant && motionOk) { actor.tag.dataset.glitch = "on"; await wait(420); }
      actor.tag.textContent = text;
      actor.tag.dataset.state = state;
      delete actor.tag.dataset.glitch;
    },
    tagText: key => actors.get(key)?.tag.textContent ?? null,
    speaking(key) {
      if (speakingKey) actors.get(speakingKey)?.wrap.removeAttribute("data-speaking");
      speakingKey = key; if (key) actors.get(key)?.wrap.setAttribute("data-speaking", "true");
    },
    noise(on) { root.dataset.noise = on ? "on" : "off"; },
    alarm(on) { root.dataset.alarm = on ? "on" : "off"; },
    flash() { root.dataset.flash = "on"; later(() => { delete root.dataset.flash; }, 420); },
    propState(id, state) { const prop = props.get(id); if (prop) prop.node.dataset.state = state; },
    /** A prop or an actor as a tap target; returns a cleanup. */
    target(kind, id, onTap) {
      const node = kind === "prop" ? props.get(id)?.node : actors.get(id)?.wrap;
      if (!node) return () => {};
      node.dataset.target = "on"; node.setAttribute("role", "button"); node.tabIndex = 0;
      const handler = event => { if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return; event.preventDefault(); event.stopPropagation(); onTap(); };
      node.addEventListener("pointerdown", handler); node.addEventListener("keydown", handler);
      return () => { node.removeEventListener("pointerdown", handler); node.removeEventListener("keydown", handler); delete node.dataset.target; node.removeAttribute("role"); node.removeAttribute("tabindex"); };
    },
    /** The screen point (host px) over an actor's head or a prop's centre. */
    pointOf(kind, id) {
      const node = kind === "prop" ? props.get(id)?.node : actors.get(id)?.body;
      const rect = node?.getBoundingClientRect?.(), hostRect = host.getBoundingClientRect?.();
      if (!rect || !hostRect) return null;
      return { x: rect.left - hostRect.left + rect.width / 2, y: rect.top - hostRect.top + (kind === "prop" ? rect.height / 2 : 0) };
    },
    /** Replace an actor's body with another species in place (the awakened form). */
    async transform(key, intoKey, spec) {
      const actor = actors.get(key); if (!actor) return;
      actors.delete(key); actor.key = intoKey; actor.spec = { ...actor.spec, ...spec }; actor.wrap.dataset.actor = intoKey;
      actors.set(intoKey, actor);
      await buildBody(actor, actor.spec);
      setFacing(actor, actor.facing > 0 ? "right" : "left");
    },
    /** A small gift (the glowing stone) in front of an actor; returns its node. */
    gift(key) {
      const actor = actors.get(key); if (!actor) return null;
      const node = el(doc, "span", "cm-da-gift", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l6 6-6 12-6-12z" fill="#bff6ff"/><path d="M12 3l6 6H6z" fill="#ffffff"/><path d="M12 21 6 9h12z" fill="#6fe0ff" opacity=".7"/></svg>`);
      actor.wrap.append(node);
      return node;
    },
    relayout,
    dispose() {
      if (disposed) return; disposed = true;
      resizer?.disconnect();
      for (const t of timers) clearTimer(t); timers.clear();
      for (const actor of actors.values()) { for (const run of actor.runs) run.cancel(); actor.sprite?.dispose(); }
      actors.clear(); props.clear();
      root.remove();
    }
  });
}
