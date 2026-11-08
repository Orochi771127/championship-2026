// Every move its own effect (OWNER_APPROVED_ADAPTATION 2026-11-08,
// UNIQUE_PIXEL_MOVE_VFX_20261108: 「總之我要每一招都獨特」).
//
// The kit (moveVfxKit.js) draws a move from its archetype -- what it throws and
// how it lands -- in its element's palette. On top of that a signature picks,
// per move, the size, the volley of heads and the path they weave (or, for a
// blow, the combo and the swing), the trail, the closing burst and a sigil: a
// glyph drawn from the move's own seed. scripts/build-move-vfx-signatures.mjs
// assigns them so that no two moves share a look: two moves of one archetype
// and palette differ in at least two visible choices, and no two sigils match.
//
// Keys: a move record index (species moves, original characters' moves and
// learnable support moves) or a Data Arena pool move id. Presentation only: a
// signature never changes a move's power, element rule, range, timing or RNG.
import table from '../../../data/championship/move-vfx-signatures.r1.json' with {type: 'json'};

export const MOVE_VFX_SIGNATURE_DIMS = Object.freeze({
  volley: Object.freeze([1, 2, 3, 5]),
  path: Object.freeze(['straight', 'arc', 'wave', 'spiral']),
  combo: Object.freeze([1, 2, 3]),
  swing: Object.freeze(['down', 'up', 'cross']),
  scale: Object.freeze([0.85, 1, 1.2]),
  trail: Object.freeze(['none', 'sparkle', 'ring', 'afterimage', 'ember', 'rune']),
  burst: Object.freeze(['ring', 'cross', 'star', 'pillar', 'shatter', 'bloom'])
});
export const MOVE_VFX_TIERS = Object.freeze(['basic', 'skill', 'ultimate', 'support']);

// Row = [key, tier index, archetype, palette, volley|combo, path|swing index, scale index, trail index, burst index, sigil seed].
const D = MOVE_VFX_SIGNATURE_DIMS;
const signatures = new Map(table.moves.map(row => {
  const [key, tier, archetype, paletteKey, count, way, scale, trail, burst, sigil] = row;
  const melee = table.melee.includes(archetype);
  return [key, Object.freeze({key, tier: MOVE_VFX_TIERS[tier], archetype, paletteKey, melee,
    volley: melee ? 1 : count, path: melee ? 'straight' : D.path[way], combo: melee ? count : 1, swing: melee ? D.swing[way] : null,
    scale: D.scale[scale], trail: D.trail[trail], burst: D.burst[burst], sigil})];
}));

/**
 * The signature of a move: a record index (number), an `own-<record>` Data
 * Arena id, or a Data Arena pool id. Null for a move the table does not know.
 */
export function moveVfxSignature(key) {
  if (typeof key === 'string' && key.startsWith('own-')) key = Number(key.slice(4));
  return signatures.get(key) ?? null;
}

export const MOVE_VFX_SIGNATURE_COUNT = signatures.size;
