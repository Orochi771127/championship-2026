// RELAY element vocabulary shared by the kit generator and the match rules
// (OWNER_APPROVED_ADAPTATION 2026-10-28, ARENA_RELAY_KITS_20261028).
export const RELAY_ELEMENTS = Object.freeze(['fire', 'frost', 'light', 'water', 'earth', 'storm', 'nature', 'shadow', 'physical']);

// Arena element for an approved VFX palette. Metal, neutral and psychic name no
// element of their own, so they only decide a partner with no coloured move.
export const RELAY_PALETTE_ELEMENT = Object.freeze({ fire: 'fire', water: 'water', ice: 'frost', thunder: 'storm', wind: 'storm', light: 'light',
  dark: 'shadow', nature: 'nature', toxic: 'nature', earth: 'earth', metal: 'physical', neutral: 'physical', psychic: 'physical' });
export const RELAY_NEUTRAL_PALETTES = Object.freeze(['metal', 'neutral', 'psychic']);

// Stage four element wheel (2026-10-28): the attacker deals 1.25x to the
// elements it beats and 0.8x to the elements that beat it. Physical sits
// outside the wheel. Light and shadow beat each other. Product-authored; the
// original game's element rules stay untraced and are not claimed here.
export const RELAY_ELEMENT_STRONG = Object.freeze({
  fire: Object.freeze(['nature', 'frost']),
  water: Object.freeze(['fire', 'earth']),
  nature: Object.freeze(['water', 'earth']),
  frost: Object.freeze(['nature', 'storm']),
  earth: Object.freeze(['fire', 'storm']),
  storm: Object.freeze(['water', 'light']),
  light: Object.freeze(['shadow']),
  shadow: Object.freeze(['light']),
  physical: Object.freeze([])
});
export const RELAY_EFFECTIVE = 1.25, RELAY_RESISTED = 0.8;
/** Damage multiplier for an `attack` element hitting a `defend` element. */
export function relayEffectiveness(attack, defend) {
  if (!attack || !defend) return 1;
  if (RELAY_ELEMENT_STRONG[attack]?.includes(defend)) return RELAY_EFFECTIVE;
  if (RELAY_ELEMENT_STRONG[defend]?.includes(attack)) return RELAY_RESISTED;
  return 1;
}
/** Elements this one is weak to (they deal 1.25x to it). */
export function relayElementWeakTo(element) { return Object.keys(RELAY_ELEMENT_STRONG).filter(other => RELAY_ELEMENT_STRONG[other].includes(element)); }
