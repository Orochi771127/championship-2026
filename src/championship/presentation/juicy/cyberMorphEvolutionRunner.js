// CyberMorphEvolutionRunner -- the arcade evolution / back-to-egg moment
// (Owner direction 2026-10-28, presentation only).
//
// One DOM node per run over a positioned host. Stage 1 (0-600 ms) opens a hex
// tunnel with falling data and DNA rings and turns the old form into a cyan
// silhouette. Stage 2 (600-1600 ms) swaps the old and new silhouettes five
// times, quicker each time, while hex shards close in. Stage 3 (1600-2600 ms)
// breaks the shell: shards fly out, the new form lands on an overshoot, the
// nameplate slides in and the panel rolls its numbers.
//
// It is shared by the real Raising evolution (mode "live": the native
// evolution clock still owns the form change; the caller may speed that clock
// through onSpeed and hands the real stat change over with setStats) and by
// the Dex showcase (mode "preview": nothing is written anywhere).
//
// Static CSS (ui/juicyShowcase.css) is every part's FINAL state; the timeline
// is Web Animations on opacity/transform, so settling is finish() and disposal
// is cancel(). There is no requestAnimationFrame loop, no canvas and no WebGL.
import { ceremonyEnvironment, playCeremonySound } from "../ceremony/ceremonyRunner.js";
import { juicyText } from "../../text/juicyShowcaseText.js";
import { juicyNode } from "./juicyArt.js";

export const CYBER_MORPH_TIMING = Object.freeze({ stage1: 600, stage2: 1600, landed: 2020, plate: 1760, panel: 1960, length: 2600, holdMs: 2200, statsTimeoutMs: 6000 });
// Silhouette swaps in Stage 2: old, new, old, new, old, new, then the burst.
export const CYBER_MORPH_SWAPS = Object.freeze([600, 900, 1130, 1310, 1460, 1540, 1600]);
const SHARDS = Object.freeze({ full: 18, saver: 8, reduced: 0 });
const RAIN = Object.freeze({ full: 14, saver: 6, reduced: 0 });
const GLYPHS = "01ABCDEF";

const node = juicyNode;

/** Offsets of one silhouette's visible spans (start, end in ms) on the timeline. */
export function cyberMorphSilhouetteSpans(which) {
  const spans = [];
  for (let i = 0; i < CYBER_MORPH_SWAPS.length - 1; i++) {
    const showsNew = i % 2 === 1;
    if ((which === "to") === showsNew) spans.push([CYBER_MORPH_SWAPS[i], CYBER_MORPH_SWAPS[i + 1]]);
  }
  return spans;
}

/** Keyframes for one silhouette: snap on, pulse 0.9 -> 1.12 -> 1, snap off. */
function silhouetteKeyframes(which, length, fromFadeIn) {
  const at = ms => Math.min(1, Math.max(0, ms / length));
  const frames = [{ offset: 0, opacity: 0, transform: "scale(1)" }];
  if (which === "from" && fromFadeIn) {
    frames.push({ offset: at(200), opacity: 0, transform: "scale(1)" }, { offset: at(450), opacity: 1, transform: "scale(1)" });
  }
  for (const [start, end] of cyberMorphSilhouetteSpans(which)) {
    const span = end - start;
    frames.push(
      { offset: at(start), opacity: which === "from" && start === CYBER_MORPH_SWAPS[0] ? 1 : 0, transform: "scale(0.9)" },
      { offset: at(start + 8), opacity: 1, transform: "scale(0.9)" },
      { offset: at(start + span * 0.45), opacity: 1, transform: "scale(1.12)" },
      { offset: at(end - 8), opacity: 1, transform: "scale(1)" },
      { offset: at(end), opacity: 0, transform: "scale(1)" }
    );
  }
  frames.push({ offset: 1, opacity: 0, transform: "scale(1)" });
  // Web Animations needs offsets in order; equal neighbours are allowed.
  for (let i = 1; i < frames.length; i++) frames[i].offset = Math.max(frames[i].offset, frames[i - 1].offset);
  return frames;
}

function silhouette(doc, className, portrait) {
  const glow = node(doc, "div", `cm-morph__sil ${className}`);
  const body = node(doc, "div", "cm-morph__sil-body");
  if (portrait?.src) {
    const url = `url("${String(portrait.src).replace(/"/g, "%22")}")`;
    body.style.setProperty("-webkit-mask-image", url);
    body.style.setProperty("mask-image", url);
  } else {
    // An encrypted or missing form: a generic data body, never the real art.
    body.classList.add("cm-morph__sil-body--cipher");
  }
  glow.append(body);
  return glow;
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

function rainColumns(doc, parent, count, seed) {
  const columns = [];
  let state = seed >>> 0 || 1;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < count; i++) {
    const glyphs = Array.from({ length: 16 }, () => GLYPHS[Math.floor(next() * GLYPHS.length)]).join("\n");
    const column = node(doc, "span", "cm-morph__rain-col", glyphs);
    column.style.left = `${((i + next() * 0.6) / count) * 100}%`;
    column.style.setProperty("--d", `${900 + Math.round(next() * 700)}ms`);
    parent.append(column);
    columns.push(column);
  }
  return columns;
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
 * @param {{name:string, portrait:object|null}} options.from
 * @param {{name:string, stageLabel?:string, portrait:object|null}} options.to
 * @param {Array<{label:string, before:number, after:number}>|null} [options.statsDiff]
 * @param {string[]|null} [options.traits]    preview: the route's growth tags
 * @param {{name:string}|null} [options.special]
 * @param {"live"|"preview"} [options.mode]
 * @param {boolean} [options.revert]          back to an egg instead of forward
 * @param {boolean} [options.encrypted]       the new form stays a cipher silhouette
 * @param {string|null} [options.lockedNote]  the closing tip for a locked preview
 * @param {(rate:number) => void} [options.onSpeed]  live: ask the caller to hurry the native clock
 * @param {() => void} [options.onDone]
 */
export function playCyberMorphEvolution({ host, from, to, statsDiff = null, traits = null, special = null, mode = "preview",
  revert = false, encrypted = false, lockedNote = null, onSpeed = null, onDone = null, fullscreen = false, doc = host?.ownerDocument ?? globalThis.document,
  setTimer = globalThis.setTimeout?.bind(globalThis), clearTimer = globalThis.clearTimeout?.bind(globalThis) }) {
  if (!host || !from || !to) throw new TypeError("CYBER_MORPH_INPUT");
  const env = ceremonyEnvironment(doc);
  const length = CYBER_MORPH_TIMING.length;
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

  // Backdrop: hex tunnel, data rain, radial speed lines.
  const tunnel = node(doc, "div", "cm-morph__tunnel");
  const hexRings = env.motion === "reduced" ? [] : [0, 1, 2, 3].map(i => {
    const ring = node(doc, "i", "cm-morph__hexring");
    ring.style.setProperty("--i", String(i));
    tunnel.append(ring);
    return ring;
  });
  const rain = node(doc, "div", "cm-morph__rain");
  const columns = rainColumns(doc, rain, RAIN[env.motion], (from.name?.length ?? 3) * 977 + (to.name?.length ?? 5) * 131);
  const speed = node(doc, "div", "cm-morph__speed");

  // The holo stage.
  const core = node(doc, "div", "cm-morph__core");
  const plinth = node(doc, "div", "cm-morph__plinth");
  const rings = node(doc, "div", "cm-morph__rings");
  const ringA = node(doc, "i", "cm-morph__ring cm-morph__ring--a");
  const ringB = node(doc, "i", "cm-morph__ring cm-morph__ring--b");
  rings.append(ringA, ringB);
  const converge = node(doc, "div", "cm-morph__converge");
  const inbound = shardRing(doc, converge, SHARDS[env.motion], "cm-morph__shard");
  const figure = node(doc, "div", "cm-morph__figure");
  const fromArt = encrypted && !from.portrait ? null : artImage(doc, "cm-morph__art--from", from.portrait);
  const fromSil = silhouette(doc, "cm-morph__sil--from", from.portrait);
  // Encrypted keeps the new form a silhouette: its real outline when the route
  // is already revealed (the caller passes art), a generic cipher body otherwise.
  const toSil = silhouette(doc, "cm-morph__sil--to", to.portrait);
  const toArt = revert ? null : encrypted ? null : artImage(doc, "cm-morph__art--to", to.portrait);
  const egg = revert ? (artImage(doc, "cm-morph__art--to cm-morph__egg-art", to.portrait) ?? node(doc, "div", "cm-morph__egg")) : null;
  const flash = node(doc, "i", "cm-morph__flash");
  const burst = node(doc, "div", "cm-morph__burst");
  const outbound = shardRing(doc, burst, SHARDS[env.motion], "cm-morph__shard cm-morph__shard--out");
  const motes = revert ? shardRing(doc, burst, SHARDS[env.motion] + 6, "cm-morph__mote") : [];
  figure.append(...[fromArt, fromSil, revert ? null : toSil, toArt, egg].filter(Boolean));
  core.append(plinth, rings, converge, figure, flash, burst);

  // Nameplate and panel.
  const plate = node(doc, "div", "cm-morph__plate");
  plate.append(node(doc, "span", "cm-morph__plate-kicker", revert ? juicyText("evolution.revert") : `✨ ${juicyText("evolution.done")}`));
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
  root.append(tunnel, rain, speed, core, plate, panel, hint, said);
  host.append(root);

  // ------------------------------------------------------------- timeline
  const timeline = [];
  const loops = [];
  const animate = (element, keyframes, options, loop = false) => {
    if (!element || typeof element.animate !== "function") return null;
    const animation = element.animate(keyframes, { fill: "both", ...options });
    (loop ? loops : timeline).push(animation);
    return animation;
  };
  const at = ms => ms / length;
  const full = env.motion !== "reduced";
  if (full) {
    animate(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    hexRings.forEach((ring, i) => animate(ring, [
      { opacity: 0, transform: "translate(-50%, -50%) scale(0.15)" },
      { opacity: 0.85, offset: 0.35 },
      { opacity: 0, transform: "translate(-50%, -50%) scale(2.6)" }
    ], { duration: 1600, delay: i * 400, iterations: Infinity, easing: "cubic-bezier(.4,0,1,1)" }, true));
    for (const column of columns) {
      const duration = Number.parseInt(column.style.getPropertyValue("--d"), 10) || 1200;
      animate(column, [{ transform: "translateY(-55%)" }, { transform: "translateY(55%)" }], { duration, iterations: Infinity, easing: "linear" }, true);
    }
    animate(speed, [
      { opacity: 0, transform: "scale(1.4) rotate(0deg)" },
      { opacity: 1, offset: at(260), transform: "scale(1.1) rotate(4deg)" },
      { opacity: 0.45, offset: at(1500), transform: "scale(1.02) rotate(9deg)" },
      { opacity: 1, offset: at(1640), transform: "scale(1.2) rotate(11deg)" },
      { opacity: 0.25, transform: "scale(1) rotate(14deg)" }
    ], { duration: length, easing: "linear" });
    animate(plinth, [{ opacity: 0, transform: "translateX(-50%) scaleX(0)" }, { opacity: 1, transform: "translateX(-50%) scaleX(1)" }],
      { duration: 360, delay: 80, easing: "cubic-bezier(.2,.9,.3,1.2)" });
    animate(rings, [{ opacity: 0, transform: "translate(-50%, 30%)" }, { opacity: 1, transform: "translate(-50%, -10%)" }],
      { duration: 520, delay: 120, easing: "cubic-bezier(.2,.8,.3,1)" });
    animate(ringA, [{ transform: "rotateX(72deg) rotateZ(0deg)" }, { transform: "rotateX(72deg) rotateZ(360deg)" }],
      { duration: 1300, iterations: Infinity, easing: "linear" }, true);
    animate(ringB, [{ transform: "rotateX(72deg) rotateZ(360deg) scale(1.18)" }, { transform: "rotateX(72deg) rotateZ(0deg) scale(1.18)" }],
      { duration: 1700, iterations: Infinity, easing: "linear" }, true);
    if (fromArt) animate(fromArt, [{ opacity: 1 }, { opacity: 1, offset: at(220) }, { opacity: 0, offset: at(460) }, { opacity: 0 }],
      { duration: length });
    if (revert) {
      // The old form rises away as gold/cyan motes, which gather into the egg.
      animate(fromSil, [
        { opacity: 0, transform: "scale(1)" }, { opacity: 1, offset: at(450) },
        { opacity: 1, offset: at(760), transform: "scale(1)" },
        { opacity: 0, offset: at(1250), transform: "translateY(-18%) scale(1.04)" }, { opacity: 0 }
      ], { duration: length });
      motes.forEach((mote, i) => animate(mote, [
        { opacity: 0, transform: "rotate(var(--a)) translateY(0) scale(0.4)" },
        { opacity: 1, offset: 0.35, transform: "rotate(var(--a)) translateY(calc(var(--r) * -0.9)) scale(1)" },
        { opacity: 1, offset: 0.7, transform: "rotate(var(--a)) translateY(calc(var(--r) * -0.5)) scale(0.8)" },
        { opacity: 0, transform: "rotate(var(--a)) translateY(0) scale(0.2)" }
      ], { duration: 1300, delay: 700 + (i % 6) * 40, easing: "ease-in-out" }));
    } else {
      animate(fromSil, silhouetteKeyframes("from", length, Boolean(fromArt)), { duration: length });
      if (!encrypted) animate(toSil, silhouetteKeyframes("to", length, false), { duration: length });
    }
    inbound.forEach((shard, i) => animate(shard, [
      { opacity: 0, transform: "rotate(var(--a)) translateX(var(--r)) scale(1)" },
      { opacity: 1, offset: 0.2 },
      { opacity: 0, transform: "rotate(var(--a)) translateX(0) scale(0.2)" }
    ], { duration: 480, delay: 620 + (i % 6) * 70, iterations: 2, easing: "cubic-bezier(.6,0,.9,.5)" }));
    animate(flash, [
      { opacity: 0, transform: "translate(-50%, -50%) scale(0.2)" },
      { opacity: 0, offset: at(1590), transform: "translate(-50%, -50%) scale(0.2)" },
      { opacity: 0.9, offset: at(1660), transform: "translate(-50%, -50%) scale(1)" },
      { opacity: 0, offset: at(1980), transform: "translate(-50%, -50%) scale(1.5)" },
      { opacity: 0, transform: "translate(-50%, -50%) scale(1.5)" }
    ], { duration: length });
    outbound.forEach((shard, i) => animate(shard, [
      { opacity: 0, transform: "rotate(var(--a)) translateX(0) scale(0.4)" },
      { opacity: 1, offset: 0.12 },
      { opacity: 0, transform: "rotate(var(--a)) translateX(calc(var(--r) * 1.7)) scale(1.1) rotate(160deg)" }
    ], { duration: 620, delay: 1600 + (i % 4) * 18, easing: "cubic-bezier(.1,.7,.3,1)" }));
    const landing = [
      { opacity: 0, transform: "scale(1.35)" },
      { opacity: 0, offset: at(1600), transform: "scale(1.35)" },
      { opacity: 1, offset: at(1620), transform: "scale(1.35)" },
      { opacity: 1, offset: at(1840), transform: "scale(0.95)" },
      { opacity: 1, offset: at(CYBER_MORPH_TIMING.landed), transform: "scale(1)" },
      { opacity: 1, transform: "scale(1)" }
    ];
    if (toArt) animate(toArt, landing, { duration: length });
    if (egg) animate(egg, landing, { duration: length });
    if (encrypted) animate(toSil, [
      ...silhouetteKeyframes("to", length, false).filter(frame => frame.offset < at(1600)),
      { offset: at(1600), opacity: 1, transform: "scale(1.35)" },
      { offset: at(1840), opacity: 1, transform: "scale(0.95)" },
      { offset: at(CYBER_MORPH_TIMING.landed), opacity: 1, transform: "scale(1)" },
      { offset: 1, opacity: 1, transform: "scale(1)" }
    ], { duration: length });
    animate(plate, [
      { opacity: 0, transform: "translateX(-120%) skewX(-12deg)" },
      { opacity: 1, offset: 0.7, transform: "translateX(4%) skewX(-12deg)" },
      { opacity: 1, transform: "translateX(0) skewX(-12deg)" }
    ], { duration: 360, delay: CYBER_MORPH_TIMING.plate, easing: "cubic-bezier(.2,.9,.3,1)" });
    animate(panel, [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 300, delay: CYBER_MORPH_TIMING.panel, easing: "ease-out" });
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
  rollNumbers(full ? CYBER_MORPH_TIMING.panel + 120 : 0);

  let sound = playCeremonySound(revert ? "revert" : "morph", doc);
  let phase = "playing", endTimer = null, exitTimer = null, safety = null;
  let resolveDone;
  const done = new Promise(resolve => { resolveDone = resolve; });
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();

  function elapsed() { return (typeof performance !== "undefined" ? performance.now() : Date.now()) - started; }
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
  function scheduleDismiss(delay) {
    endTimer?.cancel();
    endTimer = ready() ? clockAfter(delay, () => dismiss(false)) : null;
  }
  function settle() {
    if (phase !== "playing") return false;
    phase = "settled";
    root.dataset.state = "settled";
    for (const animation of timeline) { try { animation.finish(); } catch { /* an infinite or cancelled animation */ } }
    sound?.stop?.(); sound = null;
    hint.textContent = juicyText("hint.continue");
    scheduleDismiss(CYBER_MORPH_TIMING.holdMs);
    return true;
  }
  function finish(skipped) {
    if (phase === "gone") return;
    phase = "gone";
    endTimer?.cancel(); safety?.cancel(); clearTimer?.(exitTimer);
    for (const animation of [...timeline, ...loops]) { try { animation.cancel(); } catch { /* already gone */ } }
    timeline.length = loops.length = 0;
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
    scheduleDismiss(CYBER_MORPH_TIMING.holdMs);
  });
  // Live safety: should the form write never report, the overlay still lets go.
  if (!statsArrived) safety = clockAfter(timelineEnd + CYBER_MORPH_TIMING.statsTimeoutMs, () => {
    if (statsArrived || phase === "gone") return;
    statsArrived = true;
    fillPanel(null);
    if (phase !== "playing") scheduleDismiss(CYBER_MORPH_TIMING.holdMs);
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
      const late = elapsed() >= CYBER_MORPH_TIMING.panel || phase !== "playing";
      if (late && env.motion !== "reduced") {
        animate(panel, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 240, easing: "ease-out" });
      }
      rollNumbers(late ? 60 : Math.max(0, CYBER_MORPH_TIMING.panel + 120 - elapsed()));
      if (phase === "settled") scheduleDismiss(CYBER_MORPH_TIMING.holdMs);
      return true;
    },
    /** Details resolved after start (stage label, the new special); the plate and badge update in place. */
    setDetails({ stageLabel = null, special: nextSpecial = null } = {}) {
      if (phase === "gone") return false;
      if (stageLabel) paintPlate(stageLabel);
      if (nextSpecial?.name && !revert) { special = nextSpecial; fillPanel(shownStats); }
      return true;
    },
    getState: () => Object.freeze({ phase, mode, statsArrived, motion: env.motion, animations: timeline.length + loops.length })
  });
}
