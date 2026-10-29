// Skill cut-in (Owner direction 2026-10-28, presentation only).
//
// A special move gets a diagonal anime strip for 650 ms: the band slides in at
// -8 degrees from the caster's side (ally from the left in cyan/gold, enemy
// from the right in red/violet), carries the caster's own Database portrait
// cropped to a close-up and the move name in large metal letters, then leaves
// the way it was going. An optional spotlight dims everything but the caster
// by 35 % for about half a second. An ordinary skill only gets a small slanted
// name capsule (550 ms).
//
// It never takes input (pointer-events: none), never pauses a clock and never
// delays a battle step: it is decoration over a field that keeps running. DOM
// and Web Animations only -- no canvas, no WebGL, no requestAnimationFrame.
import { ceremonyEnvironment, playCeremonySound } from "../ceremony/ceremonyRunner.js";
import { juicyText } from "../../text/juicyShowcaseText.js";
import { applyJuicyPalette, juicyMoveTitle, juicyNode } from "./juicyArt.js";

export const SKILL_CUT_IN_TIMING = Object.freeze({ length: 650, enter: 170, leave: 520, dimHold: 450, dimEnd: 560, capsule: 550, dimStrength: 0.35 });

// The head square fills this share of the face box: its clear middle (the
// box's sides fade out over 22 % each) and nearly all of its height, with a
// margin round the square so ears, horns and the chin stay inside.
export const SKILL_CUT_IN_FACE_FIT = Object.freeze({ width: 0.62, height: 0.9, margin: 1.12 });

/**
 * How the portrait sits in the strip's face box: the measured head square
 * (juicyPortrait().face, see scripts/measure-dex-hero-faces.py) centred and
 * scaled to fit -- never the canvas centre, which is the belly or the claws.
 * Without a measurement the upper part of the canvas is used. The numbers go
 * to CSS as custom properties; the face box is a size container, so the fit
 * follows the strip at any screen size (juicyShowcase.css .cm-cutin__face).
 */
export function skillCutInFaceFrame(portrait) {
  const width = Number(portrait?.width), height = Number(portrait?.height);
  if (!(width > 0) || !(height > 0)) return null;
  const measured = Array.isArray(portrait.face) && portrait.face.length === 3 && portrait.face[2] > 0;
  const [cx, cy, size] = measured ? portrait.face : [width / 2, height * 0.3, Math.max(width, height) * 0.5];
  const head = size * SKILL_CUT_IN_FACE_FIT.margin;
  return Object.freeze({ source: measured ? "face" : "upper", cx, cy, size,
    vars: Object.freeze({ "--cutin-iw": String(width), "--cutin-ih": String(height), "--cutin-cx": String(Math.round(cx)),
      "--cutin-cy": String(Math.round(cy)), "--cutin-head": String(Math.round(head)) }) });
}

/**
 * @param {object} options
 * @param {HTMLElement} options.host  positioned element over the field
 * @param {boolean} [options.spotlight]  dim the field around the caster (Data Arena, Dex)
 */
export function createSkillCutInLayer({ host, doc = host?.ownerDocument ?? globalThis.document, spotlight = false } = {}) {
  if (!host) throw new TypeError("SKILL_CUT_IN_HOST");
  const layer = juicyNode(doc, "div", "cm-cutin-layer");
  layer.setAttribute("aria-hidden", "true");
  host.append(layer);
  let strip = null;
  const capsules = new Set();
  let played = 0, capsulesShown = 0, disposed = false;

  function clear(entry) {
    for (const animation of entry.animations) { try { animation.cancel(); } catch { /* gone */ } }
    entry.animations.length = 0;
    entry.image?.removeAttribute("src");
    entry.node.remove();
  }

  /** The 650 ms special strip. A newer special replaces one still showing. */
  function play({ team = "ally", portrait = null, silhouette = false, moveName = "", casterName = "", palette = "neutral", focus = null } = {}) {
    if (disposed) return false;
    if (strip) { clear(strip); strip = null; }
    const env = ceremonyEnvironment(doc);
    const node = juicyNode(doc, "div", "cm-cutin");
    node.dataset.team = team === "enemy" ? "enemy" : "ally";
    node.dataset.motion = env.motion;
    applyJuicyPalette(node, palette);
    const animations = [];
    const animate = (element, keyframes, options) => {
      if (typeof element?.animate !== "function") return;
      animations.push(element.animate(keyframes, { fill: "both", ...options }));
    };
    const T = SKILL_CUT_IN_TIMING;
    if (spotlight) {
      const dim = juicyNode(doc, "i", "cm-cutin__dim");
      if (focus && Number.isFinite(focus.x) && Number.isFinite(focus.y)) {
        dim.style.setProperty("--fx", `${Math.round(focus.x)}px`);
        dim.style.setProperty("--fy", `${Math.round(focus.y)}px`);
      }
      node.append(dim);
      animate(dim, [{ opacity: 0 }, { opacity: 1, offset: 80 / T.dimEnd }, { opacity: 1, offset: T.dimHold / T.dimEnd }, { opacity: 0 }],
        { duration: T.dimEnd, easing: "ease-out" });
    }
    const band = juicyNode(doc, "div", "cm-cutin__band");
    const lines = juicyNode(doc, "i", "cm-cutin__lines");
    const face = juicyNode(doc, "div", "cm-cutin__face");
    const frame = skillCutInFaceFrame(portrait);
    if (frame) {
      for (const [key, value] of Object.entries(frame.vars)) face.style.setProperty(key, value);
      face.dataset.framing = frame.source;
    }
    let image = null;
    if (portrait?.src && silhouette) {
      // Encrypted signal: the caster's outline only, never its colours.
      const body = juicyNode(doc, "i", "cm-cutin__face-sil");
      const url = `url("${String(portrait.src).replace(/"/g, "%22")}")`;
      body.style.setProperty("-webkit-mask-image", url);
      body.style.setProperty("mask-image", url);
      face.append(body);
    } else if (portrait?.src) {
      image = juicyNode(doc, "img", "cm-cutin__face-art");
      image.alt = ""; image.decoding = "async"; image.draggable = false;
      image.src = portrait.src;
      image.addEventListener("error", () => image.remove(), { once: true });
      face.append(image);
    }
    const words = juicyNode(doc, "div", "cm-cutin__words");
    const title = juicyMoveTitle(moveName) || `【 ${juicyText("cutin.special")} 】`;
    const name = juicyNode(doc, "strong", "cm-cutin__name", title);
    // The title fits the strip: wide glyphs count 1, spaces and Latin less.
    name.style.setProperty("--glyphs", String(Math.max(4, [...title].reduce((sum, ch) => sum + (/\s/.test(ch) ? 0.3 : /[\x20-\x7e]/.test(ch) ? 0.6 : 1), 0))));
    words.append(juicyNode(doc, "span", "cm-cutin__kicker", casterName ? `${casterName} · ${juicyText("cutin.special")}` : juicyText("cutin.special")), name);
    band.append(lines, face, words);
    node.append(band);
    layer.append(node);
    const side = node.dataset.team === "enemy" ? 1 : -1;
    if (env.motion === "reduced") {
      animate(band, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: T.length });
    } else {
      animate(band, [
        { opacity: 1, transform: `translateX(${110 * side}%) rotate(-8deg)` },
        { opacity: 1, offset: T.enter / T.length, transform: `translateX(${-4 * side}%) rotate(-8deg)` },
        { opacity: 1, offset: 230 / T.length, transform: "translateX(0) rotate(-8deg)" },
        { opacity: 1, offset: T.leave / T.length, transform: `translateX(${-3 * side}%) rotate(-8deg)` },
        { opacity: 0.9, transform: `translateX(${-112 * side}%) rotate(-8deg)` }
      ], { duration: T.length, easing: "linear" });
      animate(lines, [{ transform: "translateX(0)" }, { transform: `translateX(${25 * side}%)` }], { duration: T.length, easing: "linear" });
      // A gentle push-in round the head (the frame already holds the whole face).
      const mirror = node.dataset.team === "enemy" ? " scaleX(-1)" : "";
      const art = image ?? face.querySelector(".cm-cutin__face-sil");
      if (art) animate(art, [{ transform: `scale(1.1)${mirror}` }, { transform: `scale(1)${mirror}` }], { duration: T.length, easing: "ease-out" });
      animate(words.lastChild, [
        { opacity: 0, transform: "scale(1.7)" }, { opacity: 0, offset: 110 / T.length, transform: "scale(1.7)" },
        { opacity: 1, offset: 240 / T.length, transform: "scale(0.96)" }, { opacity: 1, offset: 300 / T.length, transform: "scale(1)" },
        { opacity: 1, transform: "scale(1)" }
      ], { duration: T.length, easing: "ease-out" });
    }
    if (env.motion !== "reduced") playCeremonySound("cutin", doc);
    const entry = { node, animations, image };
    strip = entry;
    played++;
    const finished = animations[animations.length - 1]?.finished;
    const end = () => { if (strip === entry) { clear(entry); strip = null; } };
    if (finished) finished.then(end, () => {});
    else globalThis.setTimeout?.(end, T.length);
    return true;
  }

  /** The 550 ms slanted name capsule for an ordinary skill, at a screen point. */
  function capsule({ x, y, text, palette = "neutral", team = "ally" } = {}) {
    if (disposed || !text || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (capsules.size >= 3) { const old = capsules.values().next().value; clear(old); capsules.delete(old); }
    const env = ceremonyEnvironment(doc);
    const node = juicyNode(doc, "span", "cm-cutin-capsule", text);
    node.dataset.team = team === "enemy" ? "enemy" : "ally";
    applyJuicyPalette(node, palette);
    node.style.left = `${Math.round(x)}px`;
    node.style.top = `${Math.round(y)}px`;
    layer.append(node);
    const animations = [];
    if (typeof node.animate === "function") {
      animations.push(node.animate(env.motion === "reduced"
        ? [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
        : [
          { opacity: 0, transform: "translate(-50%, -100%) skewX(-12deg) scale(0.6)" },
          { opacity: 1, offset: 0.16, transform: "translate(-50%, -100%) skewX(-12deg) scale(1.08)" },
          { opacity: 1, offset: 0.26, transform: "translate(-50%, -100%) skewX(-12deg) scale(1)" },
          { opacity: 1, offset: 0.8, transform: "translate(-50%, -110%) skewX(-12deg) scale(1)" },
          { opacity: 0, transform: "translate(-50%, -125%) skewX(-12deg) scale(1)" }
        ], { duration: SKILL_CUT_IN_TIMING.capsule, fill: "both", easing: "ease-out" }));
    }
    const entry = { node, animations, image: null };
    capsules.add(entry);
    capsulesShown++;
    const end = () => { if (capsules.delete(entry)) clear(entry); };
    if (animations[0]?.finished) animations[0].finished.then(end, () => {});
    else globalThis.setTimeout?.(end, SKILL_CUT_IN_TIMING.capsule);
    return true;
  }

  return Object.freeze({
    element: layer,
    play,
    capsule,
    getDiagnostics: () => Object.freeze({ played, capsules: capsulesShown, showing: Boolean(strip), live: capsules.size }),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (strip) clear(strip);
      strip = null;
      for (const entry of capsules) clear(entry);
      capsules.clear();
      layer.remove();
    }
  });
}
