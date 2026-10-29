// CyberMorphEvolutionRunner -- the arcade evolution / back-to-egg moment
// (Owner direction 2026-10-28; rebuilt 2026-10-29, presentation only).
//
// One DOM node per run over a positioned host. The partner is its REAL in-game
// idle motion (the public character runtime, spriteMotionPlayer.js), never a
// still: Stage 1 (0-1000 ms) it breathes in full colour on a 3-D energy stage
// while multilingual "evolution" words and the Owner-selected evolution glyphs
// (CP-G01..G04, assets/production/evolution-glyphs-v1, chosen 2026-10-13 for the
// Raising evolution writing) stream past in depth layers. Stage 2 (1000-2600 ms)
// the body strobes pure white <-> deep black with a cyan rim, ever faster,
// swapping between the old and the new form's idle motion. Stage 3 (2600 ms)
// the rings burst, the strobe drops away and the new form stands in colour,
// cheers and strikes, and the nameplate and panel arrive.
//
// The stage is depth-sorted: the back half of each ring, the light column and
// the orbiting motes behind the partner; the front half of each ring (thicker,
// white-cored, with travelling tick blocks) in front of it; motes cross from
// back to front as they circle. A partner without public motion here (another
// host, a load failure, an egg) uses its Database portrait through the same
// strobe.
//
// It is shared by the real Raising evolution (mode "live": the native
// evolution clock still owns the form change; the caller may speed that clock
// through onSpeed and hands the real stat change over with setStats) and by
// the Dex showcase (mode "preview": nothing is written anywhere).
//
// Static CSS (ui/juicyShowcase.css) is every part's FINAL state; the timeline
// is Web Animations, so settling is finish() and disposal is cancel(). There is
// no requestAnimationFrame loop, no canvas and no WebGL; filters sit only on the
// partner's own small box, never on a full-screen layer.
import glyphManifest from "../../../../assets/production/public-runtime/evolution-glyphs.v1.json" with { type: "json" };
import { EVOLUTION_STREAM_WORDS } from "../../text/evolutionPresentationText.js";
import { ceremonyEnvironment, playCeremonySound } from "../ceremony/ceremonyRunner.js";
import { juicyText } from "../../text/juicyShowcaseText.js";
import { juicyNode } from "./juicyArt.js";
import { createSpriteMotion, loadShowcaseMotionShared, showcaseFitScale, showcaseMotionAvailable, showcaseSpeciesId } from "./spriteMotionPlayer.js";

export const CYBER_MORPH_TIMING = Object.freeze({ stage1: 1000, stage2: 2600, landed: 3020, plate: 2760, panel: 2960, length: 3600,
  holdMs: 2200, statsTimeoutMs: 6000 });
// Form swaps in Stage 2: old, new, old, new ... ever quicker, then the burst.
export const CYBER_MORPH_SWAPS = Object.freeze([1000, 1400, 1720, 1960, 2140, 2280, 2390, 2470, 2530, 2575, 2600]);
const ORBIT = Object.freeze({ full: 8, saver: 4, reduced: 0 });
const RISERS = Object.freeze({ full: 3, saver: 1, reduced: 0 });
const SHARDS = Object.freeze({ full: 18, saver: 8, reduced: 0 });
// The partner's feet: the plinth's centre, 18 % above the stage's bottom edge.
const FOOT = 0.18;

/**
 * The words that stream behind the stage: the Raising evolution writing's own
 * rows and further languages (text/evolutionPresentationText.js, Owner
 * 2026-10-29). Product copy only -- no other game's trademarked term.
 */
export const CYBER_MORPH_WORDS = EVOLUTION_STREAM_WORDS;
/** The Owner-selected evolution glyphs, in their approved order. */
export const CYBER_MORPH_GLYPHS = Object.freeze(glyphManifest.assets.map(asset => Object.freeze({ id: asset.id, src: asset.src })));

/**
 * The text lanes in depth order: far (small, slow, faint) to near (large,
 * fast, soft). `axis` x runs across, y falls; `tilt` turns the lane.
 */
export const CYBER_MORPH_LANES = Object.freeze([
  { depth: "far", axis: "x", size: 11, at: 7, tilt: 0, ms: 16000, dir: -1 },
  { depth: "far", axis: "x", size: 11, at: 31, tilt: 0, ms: 18000, dir: 1 },
  { depth: "far", axis: "x", size: 11, at: 73, tilt: 0, ms: 17000, dir: -1 },
  { depth: "far", axis: "x", size: 11, at: 95, tilt: 0, ms: 15000, dir: 1 },
  { depth: "mid", axis: "y", size: 15, at: 6, tilt: 0, ms: 9000, dir: 1 },
  { depth: "mid", axis: "y", size: 15, at: 94, tilt: 0, ms: 10500, dir: 1 },
  { depth: "mid", axis: "x", size: 17, at: 19, tilt: -16, ms: 9000, dir: 1 },
  { depth: "mid", axis: "x", size: 17, at: 84, tilt: -16, ms: 10000, dir: -1 },
  { depth: "near", axis: "x", size: 46, at: 12, tilt: -6, ms: 4200, dir: -1 },
  { depth: "near", axis: "x", size: 52, at: 90, tilt: -6, ms: 3800, dir: 1 }
].map(Object.freeze));
const LANE_COUNT = Object.freeze({ full: CYBER_MORPH_LANES.length, saver: 6, reduced: 4 });

const node = juicyNode;

/** Offsets of one form's visible spans (start, end in ms) in Stage 2. */
export function cyberMorphSilhouetteSpans(which) {
  const spans = [];
  for (let i = 0; i < CYBER_MORPH_SWAPS.length - 1; i++) {
    const showsNew = i % 2 === 1;
    if ((which === "to") === showsNew) spans.push([CYBER_MORPH_SWAPS[i], CYBER_MORPH_SWAPS[i + 1]]);
  }
  return spans;
}

// One filter shape for every look, so a step never interpolates between lists.
export const CYBER_MORPH_LOOKS = Object.freeze({
  colour: "brightness(1) invert(0) drop-shadow(0 0 0 rgba(95, 243, 255, 0)) drop-shadow(0 0 0 rgba(95, 243, 255, 0))",
  white: "brightness(0) invert(1) drop-shadow(0 0 3px rgba(191, 249, 255, 0.95)) drop-shadow(0 0 12px rgba(95, 243, 255, 0.9))",
  // Near #080A12: black lifted 4 %, rimmed in cyan.
  black: "brightness(0) invert(0.04) drop-shadow(0 0 1.5px rgb(95, 243, 255)) drop-shadow(0 0 7px rgba(95, 243, 255, 0.7))"
});

/**
 * The strobe of one form over the run: [{ at, opacity, look }], stepped. The
 * old form shows in colour through Stage 1; in Stage 2 each of a form's spans
 * flashes white then black (the next span black then white); the new form
 * lands in colour after the burst. An encrypted new form stays white.
 */
export function cyberMorphStrobe(which, { encrypted = false } = {}) {
  const T = CYBER_MORPH_TIMING;
  const steps = which === "from" ? [{ at: 0, opacity: 0, look: "colour" }, { at: 260, opacity: 1, look: "colour" }]
    : [{ at: 0, opacity: 0, look: "white" }];
  let flip = 0;
  for (let i = 0; i < CYBER_MORPH_SWAPS.length - 1; i++) {
    const start = CYBER_MORPH_SWAPS[i], end = CYBER_MORPH_SWAPS[i + 1];
    if ((which === "to") !== (i % 2 === 1)) { steps.push({ at: start, opacity: 0, look: steps.at(-1).look }); continue; }
    const [a, b] = flip++ % 2 === 0 ? ["white", "black"] : ["black", "white"];
    steps.push({ at: start, opacity: 1, look: a }, { at: Math.round((start + end) / 2), opacity: 1, look: b });
  }
  if (which === "from") steps.push({ at: T.stage2, opacity: 0, look: "white" });
  else steps.push({ at: T.stage2, opacity: 1, look: "white" }, { at: T.stage2 + 110, opacity: 1, look: encrypted ? "white" : "colour" });
  return steps;
}

function strobeKeyframes(steps, length) {
  const frames = steps.map(step => ({ offset: Math.min(1, step.at / length), opacity: step.opacity, filter: CYBER_MORPH_LOOKS[step.look], easing: "step-end" }));
  const last = steps.at(-1);
  frames.push({ offset: 1, opacity: last.opacity, filter: CYBER_MORPH_LOOKS[last.look] });
  for (let i = 1; i < frames.length; i++) frames[i].offset = Math.max(frames[i].offset, frames[i - 1].offset);
  return frames;
}

function artImage(doc, className, portrait) {
  if (!portrait?.src) return null;
  const image = node(doc, "img", `cm-morph__art ${className}`);
  image.alt = "";
  image.decoding = "async";
  image.draggable = false;
  image.src = portrait.src;
  image.addEventListener("error", () => image.remove(), { once: true });
  return image;
}

function shardRing(doc, parent, count, className) {
  const shards = [];
  for (let i = 0; i < count; i++) {
    const shard = node(doc, "i", className);
    shard.style.setProperty("--a", `${(360 / count) * i + (i % 2) * 9}deg`);
    shard.style.setProperty("--r", `${120 + (i % 3) * 34}px`);
    parent.append(shard);
    shards.push(shard);
  }
  return shards;
}

/** One glyph as a small masked mark in its lane's colour. */
function glyphMark(doc, glyph) {
  const mark = node(doc, "i", "cm-morph__glyph");
  mark.dataset.glyph = glyph.id;
  const url = `url("${String(glyph.src).replace(/"/g, "%22")}")`;
  mark.style.setProperty("-webkit-mask-image", url);
  mark.style.setProperty("mask-image", url);
  return mark;
}

/** The depth lanes of words and glyphs. Each track holds its run twice and slides one run's length. */
function textLanes(doc, parent, count, seed) {
  const lanes = [];
  for (const [index, lane] of CYBER_MORPH_LANES.slice(0, count).entries()) {
    const element = node(doc, "div", `cm-morph__lane cm-morph__lane--${lane.depth} cm-morph__lane--${lane.axis}`);
    element.style.setProperty("--size", `${lane.size}px`);
    element.style.setProperty("--at", `${lane.at}%`);
    element.style.setProperty("--tilt", `${lane.tilt}deg`);
    const track = node(doc, "div", "cm-morph__lane-track");
    for (let copy = 0; copy < 2; copy++) {
      const run = node(doc, "span", "cm-morph__lane-run");
      for (let k = 0; k < CYBER_MORPH_WORDS.length; k++) {
        run.append(node(doc, "span", "cm-morph__word", CYBER_MORPH_WORDS[(k + index * 3 + seed) % CYBER_MORPH_WORDS.length]),
          glyphMark(doc, CYBER_MORPH_GLYPHS[(k + index) % CYBER_MORPH_GLYPHS.length]));
      }
      if (copy) run.setAttribute("aria-hidden", "true");
      track.append(run);
    }
    element.append(track);
    parent.append(element);
    lanes.push({ element, track, lane });
  }
  return lanes;
}

/** A ring's half: the far half sits behind the partner, the near half in front. */
function ringHalf(doc, parent, side, variant) {
  const half = node(doc, "div", `cm-morph__ring3d cm-morph__ring3d--${side} cm-morph__ring3d--${variant}`);
  const band = node(doc, "i", "cm-morph__ring3d-band");
  half.append(band);
  parent.append(half);
  return { half, band };
}

/** The species' motion, when this host may show it. */
function defaultLoadMotion(ref) {
  const speciesId = showcaseSpeciesId(ref);
  return speciesId && showcaseMotionAvailable(speciesId) ? loadShowcaseMotionShared(speciesId) : null;
}

/** Rolling ticker rows: the real before/after of each stat (live mode). */
function statRows(doc, stats) {
  const list = node(doc, "dl", "cm-morph__stats");
  const nums = [];
  for (const stat of stats) {
    const row = node(doc, "div", "cm-morph__stat");
    const delta = stat.after - stat.before;
    row.dataset.trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const value = node(doc, "dd", "cm-morph__stat-value");
    const num = node(doc, "span", "cm-morph__num");
    num.style.setProperty("--cm-morph-n", String(stat.after));
    num.dataset.from = String(stat.before);
    num.dataset.to = String(stat.after);
    num.setAttribute("aria-label", String(stat.after));
    value.append(num, node(doc, "span", "cm-morph__delta", delta === 0 ? "±0" : `${delta > 0 ? "+" : ""}${delta}`));
    row.append(node(doc, "dt", "cm-morph__stat-label", stat.label), value);
    list.append(row);
    nums.push(num);
  }
  return { list, nums };
}

/**
 * Start one run.
 * @param {object} options
 * @param {HTMLElement} options.host   positioned element the overlay fills
 * @param {{name:string, portrait:object|null, speciesIndex?:number}} options.from
 * @param {{name:string, stageLabel?:string, portrait:object|null, speciesIndex?:number}} options.to
 * @param {Array<{label:string, before:number, after:number}>|null} [options.statsDiff]
 * @param {string[]|null} [options.traits]    preview: the route's growth tags
 * @param {{name:string}|null} [options.special]
 * @param {"live"|"preview"} [options.mode]
 * @param {boolean} [options.revert]          back to an egg instead of forward
 * @param {boolean} [options.encrypted]       the new form stays a white silhouette
 * @param {string|null} [options.lockedNote]  the closing tip for a locked preview
 * @param {(rate:number) => void} [options.onSpeed]  live: ask the caller to hurry the native clock
 * @param {() => void} [options.onDone]
 * @param {(speciesRef) => Promise|null} [options.loadMotion]  the idle motion source (tests inject one)
 */
export function playCyberMorphEvolution({ host, from, to, statsDiff = null, traits = null, special = null, mode = "preview",
  revert = false, encrypted = false, lockedNote = null, onSpeed = null, onDone = null, fullscreen = false, doc = host?.ownerDocument ?? globalThis.document,
  setTimer = globalThis.setTimeout?.bind(globalThis), clearTimer = globalThis.clearTimeout?.bind(globalThis), loadMotion = defaultLoadMotion }) {
  if (!host || !from || !to) throw new TypeError("CYBER_MORPH_INPUT");
  const env = ceremonyEnvironment(doc);
  const T = CYBER_MORPH_TIMING;
  const length = T.length;
  const full = env.motion !== "reduced";
  // Fullscreen (the real evolution) covers the HUD as the original sequence
  // took the whole screen; previews stay inside their own sandbox.
  const root = node(doc, "div", fullscreen ? "cm-morph cm-morph--fullscreen" : "cm-morph");
  root.dataset.mode = mode;
  root.dataset.motion = env.motion;
  root.dataset.state = "playing";
  root.dataset.kind = revert ? "revert" : "evolve";
  if (encrypted) root.dataset.encrypted = "true";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", revert ? juicyText("evolution.revert") : juicyText("evolution.done"));
  root.tabIndex = -1;

  // Backdrop: a static lattice, travelling pulse rings, the word lanes, speed lines.
  const tunnel = node(doc, "div", "cm-morph__tunnel");
  const pulses = full ? [0, 1, 2].map(i => {
    const ring = node(doc, "i", "cm-morph__pulse");
    ring.style.setProperty("--i", String(i));
    tunnel.append(ring);
    return ring;
  }) : [];
  const lanesHost = node(doc, "div", "cm-morph__lanes");
  lanesHost.setAttribute("aria-hidden", "true");
  const lanes = textLanes(doc, lanesHost, LANE_COUNT[env.motion], ((from.name?.length ?? 3) + (to.name?.length ?? 5)) % CYBER_MORPH_WORDS.length);
  const speed = node(doc, "div", "cm-morph__speed");

  // The 3-D stage, back to front: glow, plinth, light column, far ring halves
  // and risers, motes (they change sides as they circle), the partner, near
  // ring halves and risers, the flash and the shards.
  const core = node(doc, "div", "cm-morph__core");
  core.style.setProperty("--foot", `${FOOT * 100}%`);
  const aura = node(doc, "i", "cm-morph__aura");
  const plinth = node(doc, "div", "cm-morph__plinth");
  const pillar = node(doc, "i", "cm-morph__pillar");
  core.append(aura, plinth, pillar);
  const rings = { back: [ringHalf(doc, core, "back", "main"), ringHalf(doc, core, "back", "outer")], front: [] };
  const risers = [];
  for (let i = 0; i < RISERS[env.motion]; i++) risers.push({ back: ringHalf(doc, core, "back", "riser") });
  const orbit = node(doc, "div", "cm-morph__orbit");
  const motesAround = Array.from({ length: ORBIT[env.motion] }, (_, i) => {
    const mote = node(doc, "i", "cm-morph__orbit-mote");
    mote.style.setProperty("--lift", `${8 + (i % 4) * 16}%`);
    orbit.append(mote);
    return mote;
  });
  core.append(orbit);
  const converge = node(doc, "div", "cm-morph__converge");
  const inbound = shardRing(doc, converge, SHARDS[env.motion], "cm-morph__shard");
  const figure = node(doc, "div", "cm-morph__figure");
  const fromSlot = node(doc, "div", "cm-morph__form cm-morph__form--from");
  const toSlot = node(doc, "div", "cm-morph__form cm-morph__form--to");
  figure.append(fromSlot, toSlot);
  core.append(converge, figure);
  rings.front.push(ringHalf(doc, core, "front", "main"), ringHalf(doc, core, "front", "outer"));
  for (const riser of risers) riser.front = ringHalf(doc, core, "front", "riser");
  const flash = node(doc, "i", "cm-morph__flash");
  const burst = node(doc, "div", "cm-morph__burst");
  const outbound = shardRing(doc, burst, SHARDS[env.motion], "cm-morph__shard cm-morph__shard--out");
  const motes = revert ? shardRing(doc, burst, SHARDS[env.motion] + 6, "cm-morph__mote") : [];
  core.append(flash, burst);

  // The partner art: the portrait (or a cipher / egg) until the real motion arrives.
  const forms = { from: { slot: fromSlot, art: null, kind: "none", sprite: null, strobe: null },
    to: { slot: toSlot, art: null, kind: "none", sprite: null, strobe: null } };
  function setArt(which, element, kind) {
    const form = forms[which];
    if (!element) return;
    form.art?.remove();
    form.art = element;
    form.kind = kind;
    form.slot.append(element);
    root.dataset[`${which}Art`] = kind;
  }
  // A form without art is a generic data body, never a real outline.
  const cipher = which => node(doc, "div", `cm-morph__art cm-morph__art--${which} cm-morph__sil-body--cipher`);
  setArt("from", artImage(doc, "cm-morph__art--from", from.portrait) ?? cipher("from"), from.portrait?.src ? "portrait" : "cipher");
  if (revert) setArt("to", artImage(doc, "cm-morph__art--to cm-morph__egg-art", to.portrait) ?? node(doc, "div", "cm-morph__art cm-morph__art--to cm-morph__egg"),
    to.portrait?.src ? "egg-art" : "egg");
  else setArt("to", artImage(doc, "cm-morph__art--to", to.portrait) ?? cipher("to"), to.portrait?.src ? "portrait" : "cipher");

  // Nameplate and panel.
  const plate = node(doc, "div", "cm-morph__plate");
  plate.append(node(doc, "span", "cm-morph__plate-kicker", revert ? juicyText("evolution.revert") : juicyText("evolution.done")));
  const shownName = to.name || "？？？？";
  const plateTitle = node(doc, "strong", "cm-morph__plate-title");
  const paintPlate = stage => {
    plateTitle.textContent = `【${stage ? juicyText("evolution.plate", { name: shownName, stage }) : shownName}】`;
  };
  paintPlate(to.stageLabel);
  plate.append(plateTitle);
  if (encrypted) plate.append(node(doc, "span", "cm-morph__cipher-tag", juicyText("encrypted")));
  const panel = node(doc, "div", "cm-morph__panel");
  let rolling = [];
  // Live mode waits for the native form write; any arrival settles it, even
  // an empty one, so the overlay can always be dismissed.
  let statsArrived = mode !== "live" || (Array.isArray(statsDiff) && statsDiff.length > 0);
  let shownStats = statsDiff;
  function fillPanel(stats) {
    shownStats = stats;
    panel.replaceChildren();
    rolling = [];
    if (revert) {
      panel.append(node(doc, "p", "cm-morph__inherit", `▲ ${juicyText("evolution.inherit")}`));
    } else if (Array.isArray(stats) && stats.length) {
      const { list, nums } = statRows(doc, stats);
      panel.append(list);
      rolling = nums;
    } else if (Array.isArray(traits) && traits.length) {
      panel.append(node(doc, "p", "cm-morph__panel-title", juicyText("evolution.traits")));
      const chips = node(doc, "div", "cm-morph__traits");
      for (const trait of traits.slice(0, 6)) chips.append(node(doc, "span", "cm-morph__trait", trait));
      panel.append(chips);
    } else if (mode === "live" && !statsArrived) {
      panel.append(node(doc, "p", "cm-morph__saving", juicyText("evolution.saving")));
    }
    if (special?.name && !revert) {
      const badge = node(doc, "div", "cm-morph__badge");
      badge.append(node(doc, "span", "cm-morph__badge-kicker", juicyText("evolution.special")),
        node(doc, "strong", "cm-morph__badge-name", encrypted ? "？？？？" : special.name));
      panel.append(badge);
    }
    if (lockedNote) panel.append(node(doc, "p", "cm-morph__locked", `🔒 ${lockedNote}`));
  }
  fillPanel(statsDiff);
  const hint = node(doc, "span", "cm-morph__hint", juicyText(mode === "live" ? "hint.speed" : "hint.continue"));
  const said = node(doc, "p", "cm-visually-hidden");
  said.setAttribute("role", "status");
  said.textContent = revert ? juicyText("evolution.revert") : `${juicyText("evolution.done")} ${shownName}`;
  root.append(tunnel, lanesHost, speed, core, plate, panel, hint, said);
  host.append(root);

  // ------------------------------------------------------------- timeline
  let phase = "playing", endTimer = null, exitTimer = null, safety = null, revealed = false;
  const timeline = [];
  const loops = [];
  const laneRuns = [];
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  function elapsed() { return (typeof performance !== "undefined" ? performance.now() : Date.now()) - started; }
  const animate = (element, keyframes, options, loop = false) => {
    if (!element || typeof element.animate !== "function") return null;
    const animation = element.animate(keyframes, { fill: "both", ...options });
    (loop ? loops : timeline).push(animation);
    return animation;
  };
  const at = ms => ms / length;
  const strobe = which => cyberMorphStrobe(which, { encrypted: encrypted && !revert });
  // The strobe rides on the art itself (a small box), and restarts in step when the art changes.
  function strobeArt(which) {
    const form = forms[which];
    if (!form.art) return;
    if (form.strobe) { form.strobe.cancel(); timeline.splice(timeline.indexOf(form.strobe), 1); form.strobe = null; }
    if (!full) return;
    const animation = animate(form.art, strobeKeyframes(strobe(which), length), { duration: length });
    if (!animation) return;
    form.strobe = animation;
    if (phase !== "playing") { try { animation.finish(); } catch { /* gone */ } }
    else { try { animation.currentTime = Math.min(length, elapsed()); } catch { /* a fake clock */ } }
  }
  if (full) {
    animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    pulses.forEach((ring, i) => animate(ring, [
      { opacity: 0, transform: "scale(0.15)" },
      { opacity: 0.9, offset: 0.3 },
      { opacity: 0, transform: "scale(2.4)" }
    ], { duration: 1400, delay: i * 470, iterations: Infinity, easing: "cubic-bezier(.4,0,1,1)" }, true));
    // Word lanes: far ones drift, near ones rush; all of them hurry in Stage 2.
    for (const { element, track, lane } of lanes) {
      const [a, b] = lane.dir < 0 ? ["0%", "-50%"] : ["-50%", "0%"];
      const move = lane.axis === "x" ? [{ transform: `translateX(${a})` }, { transform: `translateX(${b})` }]
        : [{ transform: "translateY(-50%)" }, { transform: "translateY(0%)" }];
      laneRuns.push(animate(track, move, { duration: lane.ms, iterations: Infinity, easing: "linear" }, true));
      animate(element, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: lane.depth === "near" ? 160 : 60, easing: "ease-out" });
    }
    animate(speed, [
      { opacity: 0, transform: "rotate(0deg)" },
      { opacity: 0.8, offset: at(300), transform: "rotate(4deg)" },
      { opacity: 0.35, offset: at(T.stage1), transform: "rotate(7deg)" },
      { opacity: 1, offset: at(T.stage2), transform: "rotate(12deg)" },
      { opacity: 0.25, transform: "rotate(15deg)" }
    ], { duration: length, easing: "linear" });
    animate(plinth, [{ opacity: 0, transform: "translateX(-50%) scaleX(0)" }, { opacity: 1, transform: "translateX(-50%) scaleX(1)" }],
      { duration: 360, delay: 80, easing: "cubic-bezier(.2,.9,.3,1.2)" });
    // The column climbs out of the plinth, pulses through the strobe and flares at the burst.
    animate(pillar, [
      { opacity: 0, transform: "translateX(-50%) scaleY(0)" },
      { opacity: 0.75, offset: at(700), transform: "translateX(-50%) scaleY(1)" },
      { opacity: 0.55, offset: at(T.stage1), transform: "translateX(-50%) scaleY(1)" },
      { opacity: 0.95, offset: at(T.stage2), transform: "translateX(-50%) scaleY(1.08)" },
      { opacity: 0.3, offset: at(T.stage2 + 500), transform: "translateX(-50%) scaleY(1)" },
      { opacity: 0.3, transform: "translateX(-50%) scaleY(1)" }
    ], { duration: length, easing: "ease-out" });
    // The ring halves rise into place together, spin in step and burst outwards.
    for (const { half, band } of [...rings.back, ...rings.front]) {
      const outer = half.classList.contains("cm-morph__ring3d--outer");
      animate(half, [
        { opacity: 0, translate: "0 34px", scale: "0.7" },
        { opacity: 1, offset: at(620), translate: "0 0", scale: "1" },
        { opacity: 1, offset: at(T.stage2), translate: "0 0", scale: "1" },
        { opacity: 0.9, offset: at(T.stage2 + 160), translate: "0 0", scale: outer ? "1.5" : "1.32" },
        { opacity: 0.45, translate: "0 0", scale: "1.06" }
      ], { duration: length, delay: outer ? 90 : 0, easing: "cubic-bezier(.2,.8,.3,1)" });
      animate(band, [{ transform: "rotate(0deg)" }, { transform: `rotate(${outer ? -360 : 360}deg)` }],
        { duration: outer ? 3400 : 2400, iterations: Infinity, easing: "linear" }, true);
    }
    // Risers: thin rings that climb the column, both halves together.
    risers.forEach((riser, i) => {
      for (const { half } of [riser.back, riser.front]) {
        animate(half, [
          { opacity: 0, translate: "0 0", scale: "1.05" },
          { opacity: 0.85, offset: 0.2 },
          { opacity: 0, translate: "0 -62%", scale: "0.55" }
        ], { duration: 1500, delay: 300 + i * 500, iterations: Infinity, easing: "cubic-bezier(.3,0,.7,1)" }, true);
      }
    });
    // Motes circle the partner, behind it on the far side and in front on the near side.
    motesAround.forEach((mote, i) => {
      const frames = [];
      const turns = 12, phase0 = (i / Math.max(1, motesAround.length)) * Math.PI * 2;
      for (let k = 0; k <= turns; k++) {
        const angle = phase0 + (k / turns) * Math.PI * 2, near = Math.sin(angle) > 0;
        frames.push({ offset: k / turns, zIndex: near ? 4 : 1, opacity: near ? 1 : 0.55,
          transform: `translate(calc(var(--orbit-rx) * ${Math.cos(angle).toFixed(3)}), calc(var(--orbit-ry) * ${Math.sin(angle).toFixed(3)} - ${(k / turns * 26).toFixed(1)}px)) scale(${near ? 1.25 : 0.7})` });
      }
      animate(mote, frames, { duration: 1700 + (i % 3) * 300, iterations: Infinity, easing: "linear" }, true);
    });
    strobeArt("from");
    strobeArt("to");
    if (revert) {
      motes.forEach((mote, i) => animate(mote, [
        { opacity: 0, transform: "rotate(var(--a)) translateY(0) scale(0.4)" },
        { opacity: 1, offset: 0.35, transform: "rotate(var(--a)) translateY(calc(var(--r) * -0.9)) scale(1)" },
        { opacity: 1, offset: 0.7, transform: "rotate(var(--a)) translateY(calc(var(--r) * -0.5)) scale(0.8)" },
        { opacity: 0, transform: "rotate(var(--a)) translateY(0) scale(0.2)" }
      ], { duration: 1300, delay: 1100 + (i % 6) * 40, easing: "ease-in-out" }));
    }
    inbound.forEach((shard, i) => animate(shard, [
      { opacity: 0, transform: "rotate(var(--a)) translateX(var(--r)) scale(1)" },
      { opacity: 1, offset: 0.2 },
      { opacity: 0, transform: "rotate(var(--a)) translateX(0) scale(0.2)" }
    ], { duration: 520, delay: T.stage1 + 40 + (i % 6) * 90, iterations: 2, easing: "cubic-bezier(.6,0,.9,.5)" }));
    animate(flash, [
      { opacity: 0, transform: "translate(-50%, -50%) scale(0.2)" },
      { opacity: 0, offset: at(T.stage2 - 10), transform: "translate(-50%, -50%) scale(0.2)" },
      { opacity: 0.95, offset: at(T.stage2 + 60), transform: "translate(-50%, -50%) scale(1)" },
      { opacity: 0, offset: at(T.stage2 + 380), transform: "translate(-50%, -50%) scale(1.6)" },
      { opacity: 0, transform: "translate(-50%, -50%) scale(1.6)" }
    ], { duration: length });
    outbound.forEach((shard, i) => animate(shard, [
      { opacity: 0, transform: "rotate(var(--a)) translateX(0) scale(0.4)" },
      { opacity: 1, offset: 0.12 },
      { opacity: 0, transform: "rotate(var(--a)) translateX(calc(var(--r) * 1.7)) scale(1.1) rotate(160deg)" }
    ], { duration: 620, delay: T.stage2 + (i % 4) * 18, easing: "cubic-bezier(.1,.7,.3,1)" }));
    // The new form lands on an overshoot, from its feet.
    animate(toSlot, [
      { transform: "scale(1)" }, { offset: at(T.stage2), transform: "scale(1.3)" },
      { offset: at(T.stage2 + 240), transform: "scale(0.95)" }, { offset: at(T.landed), transform: "scale(1)" }, { transform: "scale(1)" }
    ], { duration: length, easing: "ease-out" });
    animate(plate, [
      { opacity: 0, transform: "translateX(-120%) skewX(-12deg)" },
      { opacity: 1, offset: 0.7, transform: "translateX(4%) skewX(-12deg)" },
      { opacity: 1, transform: "translateX(0) skewX(-12deg)" }
    ], { duration: 360, delay: T.plate, easing: "cubic-bezier(.2,.9,.3,1)" });
    animate(panel, [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 300, delay: T.panel, easing: "ease-out" });
  } else {
    animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  }
  const timelineEnd = full ? length : 160;

  function rollNumbers(delay) {
    if (env.motion === "reduced") return;
    for (const num of rolling) {
      const fromValue = Number(num.dataset.from), toValue = Number(num.dataset.to);
      animate(num, [{ "--cm-morph-n": fromValue }, { "--cm-morph-n": toValue }],
        { duration: 900, delay, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }
  rollNumbers(full ? T.panel + 120 : 0);

  let sound = playCeremonySound(revert ? "revert" : "morph", doc);
  const beats = [];
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });

  function ready() { return statsArrived || revert; }
  // Timers are animation clocks on the root when Web Animations exist, so the
  // run's pacing follows the document timeline (a hidden tab or a slowed
  // timeline keeps the beats in step); plain timers otherwise.
  function clockAfter(ms, fn) {
    if (typeof root.animate === "function") {
      const beat = root.animate([{ visibility: "visible" }, { visibility: "visible" }], { duration: Math.max(1, ms) });
      beat.finished.then(fn, () => {});
      return { cancel: () => beat.cancel() };
    }
    const id = setTimer?.(fn, ms);
    return { cancel: () => clearTimer?.(id) };
  }

  // The real motion: both forms' idle loops, mounted together at one pixel scale.
  function sceneRoom() {
    const box = core.getBoundingClientRect?.() ?? { width: 0, height: 0 };
    return box.width > 0 && box.height > 0 ? { width: box.width * 0.86, height: box.height * (1 - FOOT - 0.08) } : { width: 260, height: 220 };
  }
  function mountMotions(results) {
    if (phase === "gone") return;
    const room = sceneRoom();
    const loaded = results.filter(entry => entry.motion);
    if (!loaded.length) return;
    const scale = Math.min(...loaded.map(entry => showcaseFitScale(entry.motion, { ...room, maxNative: 8, minNative: 2 })));
    for (const { which, motion } of loaded) {
      const sprite = createSpriteMotion({ doc, motion, scale, reducedMotion: !full });
      sprite.play(0);
      sprite.element.classList.add("cm-morph__art", `cm-morph__art--${which}`);
      forms[which].sprite?.dispose();
      forms[which].sprite = sprite;
      setArt(which, sprite.element, "sprite");
      strobeArt(which);
    }
    if (revealed) reveal();
  }
  const motionRefs = {
    from: from.speciesIndex ?? from.portrait?.speciesIndex ?? null,
    // An unrevealed or egg target never loads: no outline may leak.
    to: revert || !to.portrait ? null : to.speciesIndex ?? to.portrait?.speciesIndex ?? null
  };
  const pending = Object.entries(motionRefs).map(([which, ref]) => {
    let request = null;
    try { request = ref === null ? null : loadMotion?.(ref); } catch { request = null; }
    return Promise.resolve(request).then(motion => ({ which, motion: motion ?? null }), () => ({ which, motion: null }));
  });
  void Promise.all(pending).then(mountMotions);

  // Stage 3's motion: the new form cheers, strikes once, then idles.
  function reveal() {
    revealed = true;
    const sprite = forms.to.sprite;
    if (!sprite || encrypted) return;
    sprite.play(33, { loop: false, onEnd: () => sprite.play(7, { loop: false, onEnd: () => sprite.play(0) }) });
  }
  if (full) beats.push(clockAfter(T.stage2 + 120, () => { if (phase !== "gone" && !revealed) reveal(); }));
  else reveal();
  // Stage 2 hurries the word lanes; the burst lets them drift again.
  if (full) {
    beats.push(clockAfter(T.stage1, () => { for (const run of laneRuns) run?.updatePlaybackRate?.(2.6); }));
    beats.push(clockAfter(T.stage2, () => { for (const run of laneRuns) run?.updatePlaybackRate?.(0.7); }));
  }

  function scheduleDismiss(delay) {
    endTimer?.cancel();
    endTimer = ready() ? clockAfter(delay, () => dismiss(false)) : null;
  }
  function settle() {
    if (phase !== "playing") return false;
    phase = "settled";
    root.dataset.state = "settled";
    for (const animation of [...timeline]) { try { animation.finish(); } catch { /* an infinite or cancelled animation */ } }
    for (const run of laneRuns) run?.updatePlaybackRate?.(0.7);
    if (!revealed) reveal();
    sound?.stop?.(); sound = null;
    hint.textContent = juicyText("hint.continue");
    scheduleDismiss(T.holdMs);
    return true;
  }
  function finish(skipped) {
    if (phase === "gone") return;
    phase = "gone";
    endTimer?.cancel(); safety?.cancel(); clearTimer?.(exitTimer);
    for (const beat of beats) beat.cancel();
    for (const animation of [...timeline, ...loops]) { try { animation.cancel(); } catch { /* already gone */ } }
    timeline.length = loops.length = laneRuns.length = 0;
    for (const form of Object.values(forms)) { form.sprite?.dispose(); form.sprite = null; }
    sound?.stop?.(); sound = null;
    // Drop decoded portrait pixels with the node.
    for (const image of root.querySelectorAll("img")) image.removeAttribute("src");
    root.remove();
    doc.removeEventListener?.("keydown", onKey, true);
    doc.removeEventListener?.("visibilitychange", onVisibility);
    resolveDone(Object.freeze({ mode, skipped, elapsedMs: Math.round(elapsed()) }));
    onDone?.();
  }
  function dismiss(skipped = true) {
    if (phase === "gone" || phase === "leaving") return;
    phase = "leaving";
    root.dataset.state = "leaving";
    endTimer?.cancel(); endTimer = null;
    const leave = root.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: env.motion === "reduced" ? 120 : 220, fill: "forwards" });
    if (leave) loops.push(leave);
    exitTimer = setTimer?.(() => finish(skipped), env.motion === "reduced" ? 120 : 220);
  }
  function onTap(event) {
    event.preventDefault();
    event.stopPropagation();
    if (phase === "playing") {
      if (mode === "live") onSpeed?.(6);
      settle();
    } else if (phase === "settled") {
      if (ready()) dismiss(true);
      else onSpeed?.(6);
    }
  }
  function onKey(event) {
    if (phase === "gone" || !["Escape", "Enter", " "].includes(event.key)) return;
    event.stopPropagation();
    event.preventDefault();
    onTap(event);
  }
  function onVisibility() { if (doc.hidden) settle(); }
  root.addEventListener("pointerdown", onTap);
  doc.addEventListener?.("keydown", onKey, true);
  doc.addEventListener?.("visibilitychange", onVisibility);
  endTimer = clockAfter(timelineEnd, () => {
    if (phase !== "playing") return;
    phase = "settled";
    root.dataset.state = "settled";
    hint.textContent = juicyText("hint.continue");
    scheduleDismiss(T.holdMs);
  });
  // Live safety: should the form write never report, the overlay still lets go.
  if (!statsArrived) safety = clockAfter(timelineEnd + T.statsTimeoutMs, () => {
    if (statsArrived || phase === "gone") return;
    statsArrived = true;
    fillPanel(null);
    if (phase !== "playing") scheduleDismiss(T.holdMs);
  });
  try { root.focus({ preventScroll: true }); } catch { /* focus is a courtesy */ }

  return Object.freeze({
    element: root,
    done,
    settle,
    dismiss: () => dismiss(true),
    dispose: () => finish(true),
    /** Live mode: the real stat change, once the native clock wrote the form. */
    setStats(stats) {
      if (phase === "gone" || (mode === "live" && statsArrived)) return false;
      statsArrived = true;
      safety?.cancel(); safety = null;
      fillPanel(Array.isArray(stats) && stats.length ? stats : null);
      const late = elapsed() >= T.panel || phase !== "playing";
      if (late && env.motion !== "reduced") {
        animate(panel, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: "ease-out" });
      }
      rollNumbers(late ? 60 : Math.max(0, T.panel + 120 - elapsed()));
      if (phase === "settled") scheduleDismiss(T.holdMs);
      return true;
    },
    /** Details resolved after start (stage label, the new special); the plate and badge update in place. */
    setDetails({ stageLabel = null, special: nextSpecial = null } = {}) {
      if (phase === "gone") return false;
      if (stageLabel) paintPlate(stageLabel);
      if (nextSpecial?.name && !revert) { special = nextSpecial; fillPanel(shownStats); }
      return true;
    },
    getState: () => Object.freeze({ phase, mode, statsArrived, motion: env.motion, animations: timeline.length + loops.length,
      art: Object.freeze({ from: forms.from.kind, to: forms.to.kind }), revealed })
  });
}
