// RELAY element vocabulary shared by the kit generator and the match rules
// (OWNER_APPROVED_ADAPTATION 2026-10-28, ARENA_RELAY_KITS_20261028).
export const RELAY_ELEMENTS = Object.freeze(['fire', 'frost', 'light', 'water', 'earth', 'storm', 'nature', 'shadow', 'physical']);

// Arena element for an approved VFX palette. Metal, neutral and psychic name no
// element of their own, so they only decide a partner with no coloured move.
export const RELAY_PALETTE_ELEMENT = Object.freeze({ fire: 'fire', water: 'water', ice: 'frost', thunder: 'storm', wind: 'storm', light: 'light',
  dark: 'shadow', nature: 'nature', toxic: 'nature', earth: 'earth', metal: 'physical', neutral: 'physical', psychic: 'physical' });
export const RELAY_NEUTRAL_PALETTES = Object.freeze(['metal', 'neutral', 'psychic']);
