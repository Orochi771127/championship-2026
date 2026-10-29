// Shared look-ups for the arcade presentation pieces (Owner direction
// 2026-10-28): the evolution runner, the skill cut-in and the Dex showcase.
//
// Everything here is display data read from existing catalogs: the Database
// hero portraits, the battle FX palettes and the species' own move list. It
// writes nothing, owns no clock and creates no renderer. The pieces that use
// it are DOM + CSS / Web Animations only, so none of them can add a WebGL
// context (the iOS standalone budget is the existing Pixi stage alone).
import { databaseHeroFace, databaseHeroPortrait } from "../databaseHeroPortraits.js";
import { BATTLE_FX_PALETTES, battleFxMoveTier } from "../battleFx/battleFxPalettes.js";
import { monsterVisualAnchor } from "../../data/monsterVisualAnchors218.js";

/** `species-012`, `championship:creature:species-012` or 12 -> 12. */
export function juicySpeciesIndex(ref) {
  if (Number.isSafeInteger(ref)) return ref;
  const match = /species-(\d+)$/.exec(String(ref ?? ""));
  return match ? Number(match[1]) : null;
}

/**
 * The Database hero portrait for a species, or null (eggs and gaps). `face` is
 * its head square [cx, cy, size] in image pixels: the 218-partner calibration
 * table's cutinHeadFrame (src/championship/data/monsterVisualAnchors218.js),
 * else the measured face of a portrait outside the Dex.
 */
export function juicyPortrait(ref) {
  const index = juicySpeciesIndex(ref);
  const hero = index === null ? null : databaseHeroPortrait(index);
  if (!hero) return null;
  const head = monsterVisualAnchor(index)?.cutinHeadFrame;
  const face = head ? Object.freeze([Math.round(head.headFocusX * hero.width), Math.round(head.headFocusY * hero.height),
    Math.round(head.headSafeScale * Math.max(hero.width, hero.height))]) : databaseHeroFace(hero);
  return Object.freeze({ src: hero.src, width: hero.width, height: hero.height, speciesIndex: index, face });
}

const hex = value => `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;

/** A battle FX palette as CSS colours; unknown names fall back to neutral. */
export function juicyPaletteCss(name) {
  const palette = BATTLE_FX_PALETTES[name] ?? BATTLE_FX_PALETTES.neutral;
  return Object.freeze({ name: BATTLE_FX_PALETTES[name] ? name : "neutral", core: hex(palette.core), main: hex(palette.main), edge: hex(palette.edge) });
}

/** Write a palette onto an element as --jc-core / --jc-main / --jc-edge. */
export function applyJuicyPalette(element, name) {
  const css = juicyPaletteCss(name);
  element.style.setProperty("--jc-core", css.core);
  element.style.setProperty("--jc-main", css.main);
  element.style.setProperty("--jc-edge", css.edge);
  element.dataset.palette = css.name;
  return css;
}

/**
 * The species' signature move from the Database's verified move list: the
 * same rule the battle uses (strongest kind-1 learnable, see battleFxMoveTier).
 */
export function juicySignatureMove(moves) {
  if (!Array.isArray(moves)) return null;
  return moves.find(move => battleFxMoveTier(move, moves) === "ultimate") ?? null;
}

/** 【 腐 沼 毒 核 】 for CJK names; Latin names keep their words. */
export function juicyMoveTitle(name) {
  const text = String(name ?? "").trim();
  if (!text) return "";
  const spaced = /[぀-ヿ㐀-鿿]/.test(text) && !/\s/.test(text) ? [...text].join(" ") : text;
  return `【 ${spaced} 】`;
}

/** Arcade pieces are on for every theme except the faithful classic one. */
export function juicyPresentationEnabled(doc = globalThis.document) {
  const theme = doc?.documentElement?.dataset?.theme;
  if (theme === "classic") return false;
  return !String(globalThis.location?.search ?? "").includes("juicy=off");
}

/** Small DOM helper: an element with a class and optional text. */
export function juicyNode(doc, tag, className = "", text = null) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== null && text !== undefined) node.textContent = text;
  return node;
}
