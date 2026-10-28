// Dynamic battle presentation -- palettes and the move tier (split from
// battleFxRecipes.js on 2026-10-28 so the arcade cut-in and Dex showcase can
// colour a move without loading the effect-bank profiles). Presentation
// look-ups only; see battleFxRecipes.js for the OWNER_APPROVED_ADAPTATION note.

/** Colours per palette: core (hot centre), main, edge (outer glow), smoke. */
export const BATTLE_FX_PALETTES = Object.freeze({
  neutral: Object.freeze({core:0xffffff, main:0xbfe8ff, edge:0x5aa0e0, smoke:0x8a96a6}),
  fire:    Object.freeze({core:0xfff4c2, main:0xff8a1c, edge:0xd8360f, smoke:0x4a3128}),
  water:   Object.freeze({core:0xe8fbff, main:0x3fb8ff, edge:0x1f5fd6, smoke:0xbfe3f0}),
  ice:     Object.freeze({core:0xffffff, main:0x9eeaff, edge:0x4fa8e0, smoke:0xd8f4ff}),
  light:   Object.freeze({core:0xffffff, main:0xffe9a0, edge:0xf2b53a, smoke:0xfff2d0}),
  dark:    Object.freeze({core:0xf0d8ff, main:0x9a4dff, edge:0x3c1470, smoke:0x241830}),
  thunder: Object.freeze({core:0xffffe8, main:0xffe23a, edge:0xf09a12, smoke:0x5a5030}),
  nature:  Object.freeze({core:0xf0ffd0, main:0x7ee04a, edge:0x2f8f3a, smoke:0x506a34}),
  metal:   Object.freeze({core:0xffffff, main:0xd6dde6, edge:0xff9a3c, smoke:0x5c5f66}),
  earth:   Object.freeze({core:0xfff0d0, main:0xd8a560, edge:0x7a5230, smoke:0x8a6a48}),
  toxic:   Object.freeze({core:0xf4ffd0, main:0xa8d63a, edge:0x6a3a8a, smoke:0x4a4a2a}),
  psychic: Object.freeze({core:0xffe8ff, main:0xff7ad8, edge:0xa83cc8, smoke:0x5a2a5a}),
  wind:    Object.freeze({core:0xffffff, main:0xc8f5e8, edge:0x5fc8a8, smoke:0xe0f5ee})
});

/** Element selector -> palette, inferred from family use (see file note). */
export const BATTLE_FX_ELEMENT_PALETTE = Object.freeze(['neutral', 'fire', 'water', 'light', 'dark', 'thunder']);

/**
 * Tier: 'basic' for the free kind-0 attack, 'support' for the contact-walk
 * kinds 2/3, 'skill' for kind 1, and 'ultimate' for the strongest kind-1 move
 * of its species (highest power, then highest cost, then lowest record), so
 * every fighter has exactly one signature move. `speciesMoves` is that
 * species' own move list; without it a kind-1 move is a plain skill.
 */
export function battleFxMoveTier(move, speciesMoves = null) {
  if (!move) return 'basic';
  if (move.kind === 0) return 'basic';
  if (move.kind !== 1) return 'support';
  if (!Array.isArray(speciesMoves)) return 'skill';
  const signature = speciesMoves.filter(m => m?.kind === 1 && m.recordIndex > 30)
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0) || (b.actionCost ?? 0) - (a.actionCost ?? 0) || a.recordIndex - b.recordIndex)[0];
  return signature?.recordIndex === move.recordIndex ? 'ultimate' : 'skill';
}
