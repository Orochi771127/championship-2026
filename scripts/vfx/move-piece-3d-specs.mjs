// Three.js move pieces to bake (UNIFIED_MOVES_20261118, U3): see bake-3d-move-vfx.mjs.
import ultimates from './move-piece-3d-ultimates.json' with {type: 'json'};
import {MOVE_VFX_CHOREOGRAPHY} from '../../src/championship/presentation/vfx/moveVfxChoreography.js';
// Names start with `3d-`; `group` picks the module the game loads on demand; `base`
// is the shared piece it replaces (played until the group is in).
//
// Common shapes: a one-shot burst starts at once; a continuous field is cut to its
// live phase and told to wind down (`stop`); a shot is hit as it flies (`hit`) and
// kept from the hit; a beam is drawn from the left into the target (`beam`).
const C = {el: 0.3, d: 7};
const burst = (fx, extra = {}) => ({fx, cam: C, until: 1.3, fit: 1.6, anchor: 'ground', ...extra});
const field = (fx, extra = {}) => ({fx, cam: {el: 0.42, d: 7.5}, until: 1.6, stop: 0.9, fit: 1.8, anchor: 'ground', ...extra});
const shot = (fx, extra = {}) => ({fx, cam: C, hit: 0.45, from: 0.45, until: 1.4, fit: 1.4, anchor: 'contact', ...extra});
const beam = (fx, extra = {}) => ({fx, cam: {el: 0.25, d: 6}, beam: [-3.2, 0], hit: 0.6, from: 0.2, until: 1.2, stop: 0.8, fit: 1.8, anchor: 'contact', ...extra});

const HAND = Object.freeze({
  // ---- storm (thunder)
  '3d-thunder-strike': burst('thunder-strike', {cam: {el: 0.3, d: 8.5, ly: 1.2}, until: 1.4, group: 'storm', base: 'bolt'}),
  '3d-thunder-storm': burst('thunder-strike', {o: {size: 1.4, density: 0.9, detail: 1.4}, cam: {el: 0.36, d: 10, ly: 1.3}, until: 1.5, fit: 2.2, group: 'storm', base: 'bolt'}),
  '3d-energy-burst': burst('energy-burst', {until: 0.9, fit: 1.4, anchor: 'contact', group: 'storm', base: 'roar'}),
  '3d-energy-burst-b': burst('energy-burst', {o: {quantity: 20, size: 0.8}, cam: {el: 0.55, d: 6, az: 0.6}, until: 0.8, fit: 1.2, anchor: 'contact', group: 'storm', base: 'roar'}),
  '3d-energy-burst-c': burst('energy-burst', {o: {quantity: 6, size: 1.3, speed: 1.4}, cam: {el: 0.15, d: 6.5, az: -0.5}, until: 0.8, fit: 1.6, anchor: 'contact', group: 'storm', base: 'rush'}),
  '3d-arc-ray': beam('arc-ray', {group: 'storm', base: 'bolt'}),
  '3d-arc-ray-b': beam('arc-ray', {o: {quantity: 3, size: 1.4}, cam: {el: 0.4, d: 6, az: 0.4}, group: 'storm', base: 'bolt'}),
  '3d-sustained-arc': beam('sustained-arc', {opaque: true, group: 'storm', base: 'bolt'}),
  '3d-sustained-arc-b': beam('sustained-arc', {opaque: true, o: {size: 1.5}, cam: {el: 0.5, d: 6.5, az: -0.4}, group: 'storm', base: 'bolt'}),
  '3d-pulse-beam': beam('pulse-beam', {group: 'storm', base: 'lance'}),
  '3d-charged-beam': beam('charged-beam', {hit: 1.5, from: 1.9, until: 2.8, stop: 2.4, group: 'storm', base: 'lance'}),
  '3d-arcane-matrix': field('arcane-matrix', {group: 'storm', base: 'eye'}),
  // ---- fire
  '3d-fire-blast': burst('fire-explosion', {cam: {el: 0.3, d: 6.5}, until: 0.75, noSmoke: true, group: 'fire', base: 'core'}),
  '3d-fireburst': burst('rolling-fireburst', {anchor: 'contact', group: 'fire', base: 'core'}),
  '3d-fireball-hit': shot('fireball', {opaque: true, group: 'fire', base: 'core'}),
  '3d-flame-surge': burst('flame-surge', {until: 1.1, fit: 1.6, group: 'fire', base: 'rush'}),
  '3d-burning-ground': field('burning-ground', {group: 'fire', base: 'quake'}),
  // ---- frost
  '3d-ice-shatter': burst('ice-shatter', {cam: {el: 0.3, d: 6}, group: 'frost', base: 'flurry-shard'}),
  '3d-shard-storm': burst('ice-shatter', {o: {size: 1.4, quantity: 16, density: 0.9}, cam: {el: 0.4, d: 8}, until: 1.4, fit: 2.2, group: 'frost', base: 'flurry-shard'}),
  '3d-ice-lance': burst('ice-lance-study', {opaque: true, from: 0.25, until: 1.3, fit: 1.6, anchor: 'contact', group: 'frost', base: 'horn'}),
  '3d-ice-shard-hit': shot('ice-shard', {group: 'frost', base: 'flurry-shard'}),
  '3d-frost-lance-rain': burst('frost-lance-rain', {cam: {el: 0.35, d: 8}, until: 1.5, fit: 1.8, group: 'frost', base: 'rain'}),
  '3d-whiteout': burst('ground-freeze-study', {opaque: true, o: {size: 1.3}, cam: {el: 0.35, d: 8.5}, until: 1.6, fit: 2.2, group: 'frost', base: 'mist'}),
  '3d-ice-shield': burst('ice-shield-study', {opaque: true, until: 1.4, fit: 1.4, anchor: 'contact', group: 'frost', base: 'buff-def'}),
  '3d-frost-wheel': shot('frost-wheel', {group: 'frost', base: 'spin'}),
  // ---- water
  '3d-tidal-surge': burst('tidal-surge', {cam: {el: 0.35, d: 8, ly: 0.9}, until: 1.6, bloom: 0.92, fit: 2.0, group: 'water', base: 'wave'}),
  '3d-tidal-surge-b': burst('tidal-surge', {o: {size: 1.4}, cam: {el: 0.5, d: 9, ly: 0.9, az: 0.5}, until: 1.7, bloom: 0.92, fit: 2.4, group: 'water', base: 'wave'}),
  '3d-steam-jet': field('steam-jet', {cam: {el: 0.25, d: 7}, fit: 1.4, group: 'water', base: 'mist'}),
  '3d-wind-vortex': field('wind-vortex', {cam: {el: 0.42, d: 10.5}, until: 1.8, stop: 1.1, fit: 1.8, group: 'water', base: 'vortex'}),
  '3d-pool': field('venom-pool', {group: 'water', base: 'splat'}),
  // ---- light
  '3d-astral-convergence': burst('astral-convergence', {until: 1.4, fit: 1.8, anchor: 'contact', group: 'light', base: 'rain'}),
  '3d-relic-descent': burst('sacred-relic-descent', {cam: {el: 0.32, d: 8, ly: 1}, until: 2.0, fit: 2.0, group: 'light', base: 'lance'}),
  '3d-golden-chains': burst('golden-chain-rain', {cam: {el: 0.3, d: 9}, until: 2.0, fit: 2.0, group: 'light', base: 'rain'}),
  '3d-starblade': burst('starblade-cataclysm', {cam: {el: 0.3, d: 7, ly: 0.9}, until: 1.8, fit: 1.6, group: 'light', base: 'horn'}),
  '3d-prism-parry': burst('prism-parry', {until: 0.7, fit: 1.2, anchor: 'contact', group: 'light', base: 'fist'}),
  '3d-prism-guard': field('prism-guard', {cam: C, fit: 1.4, anchor: 'contact', group: 'light', base: 'buff-def'}),
  '3d-prism-guard-c': field('prism-guard', {o: {quantity: 9, size: 0.9, speed: 1.4}, cam: {el: 0.2, d: 6.5, az: 0.8}, fit: 1.4, anchor: 'contact', group: 'water', base: 'buff-def'}),
  '3d-prism-parry-b': burst('prism-parry', {o: {quantity: 7, size: 1.3}, cam: {el: 0.5, d: 6.5, az: -0.6}, until: 0.7, fit: 1.3, anchor: 'contact', group: 'light', base: 'fist'}),
  '3d-prism-guard-b': field('prism-guard', {o: {quantity: 4, size: 1.2}, cam: {el: 0.45, d: 7, az: -0.6}, fit: 1.4, anchor: 'contact', group: 'light', base: 'buff-def'}),
  '3d-astral-gate': field('astral-gate', {cam: C, fit: 1.6, group: 'light', base: 'lance'}),
  '3d-radiant-beam': beam('radiant-beam', {group: 'light', base: 'lance'}),
  '3d-charged-beam-b': beam('charged-beam', {o: {size: 1.4}, cam: {el: 0.45, d: 6.5, az: 0.5}, hit: 1.5, from: 1.9, until: 2.8, stop: 2.4, group: 'light', base: 'lance'}),
  '3d-aegis': field('aegis-weave', {opaque: true, cam: C, fit: 1.5, anchor: 'contact', group: 'light', base: 'buff-def'}),
  '3d-aegis-b': field('aegis-weave', {opaque: true, o: {size: 1.3}, cam: {el: 0.5, d: 7, az: 0.5}, fit: 1.5, anchor: 'contact', group: 'light', base: 'buff-def'}),
  '3d-airburst': burst('billowing-airburst', {until: 0.8, noSmoke: true, fit: 1.4, anchor: 'contact', group: 'light', base: 'fist'}),
  '3d-energy-vortex': field('energy-vortex', {cam: {el: 0.42, d: 10.5}, until: 1.8, stop: 1.1, fit: 1.8, group: 'light', base: 'vortex'}),
  // ---- nature
  '3d-thorn-crown': field('thorn-crown', {group: 'nature', base: 'vines'}),
  '3d-thorn-crown-b': field('thorn-crown', {o: {quantity: 2, size: 0.8}, cam: {el: 0.3, d: 6.5, az: 0.6}, fit: 1.4, group: 'nature', base: 'vines'}),
  '3d-verdant': field('verdant-restoration', {opaque: true, cam: C, fit: 1.4, group: 'nature', base: 'flurry-leaf'}),
  '3d-verdant-b': field('verdant-restoration', {opaque: true, o: {size: 1.3}, cam: {el: 0.5, d: 7, az: -0.5}, fit: 1.6, group: 'nature', base: 'mark-roots'}),
  '3d-plasma-bolt': shot('plasma-bolt', {group: 'nature', base: 'orb'}),
  // ---- shadow
  '3d-darkchain': burst('darkchain-detonation', {cam: {el: 0.35, d: 8}, until: 1.8, fit: 2.2, group: 'shadow', base: 'vortex'}),
  '3d-binding-curse': field('binding-curse', {group: 'shadow', base: 'eye'}),
  '3d-fire-vortex': field('fire-vortex', {cam: {el: 0.42, d: 10.5}, until: 1.8, stop: 1.1, fit: 1.8, group: 'shadow', base: 'vortex'}),
  '3d-smoke-column': field('smoke-column', {fit: 1.4, group: 'shadow', base: 'mist'}),
  // ---- earth and body blows
  '3d-shockwave': burst('shockwave', {until: 1.0, group: 'earth', base: 'quake'}),
  '3d-shockwave-b': burst('shockwave', {o: {size: 0.8, speed: 1.3}, cam: {el: 0.5, d: 6, az: 0.5}, until: 0.9, fit: 1.3, group: 'earth', base: 'rush'}),
  '3d-fissure': burst('magma-fissure', {cam: {el: 0.4, d: 8}, until: 1.4, fit: 2.2, group: 'earth', base: 'quake'}),
  '3d-quicksand': field('quicksand-seal', {group: 'earth', base: 'quake'}),
  '3d-dust-devil': field('dust-devil', {cam: {el: 0.42, d: 10.5}, until: 1.6, stop: 0.9, fit: 1.6, group: 'earth', base: 'spin'}),
  '3d-smoke-puff': burst('smoke-puff', {until: 1.0, fit: 1.3, anchor: 'contact', group: 'earth', base: 'fist'}),
  // ---- second-round variants (replacing pieces that baked faint or boxed)
  '3d-burning-ground-b': field('burning-ground', {o: {size: 0.8, density: 0.8}, cam: {el: 0.3, d: 7, az: 0.6}, fit: 1.5, group: 'fire', base: 'buff-def'}),
  '3d-fireburst-b': burst('rolling-fireburst', {o: {size: 1.3}, cam: {el: 0.5, d: 8, az: 0.6}, fit: 1.9, anchor: 'contact', group: 'light', base: 'core'}),
  '3d-radiant-beam-b': beam('radiant-beam', {o: {size: 1.6}, cam: {el: 0.45, d: 6.5, az: 0.5}, fit: 2.2, group: 'light', base: 'lance'}),
  '3d-radiant-beam-c': beam('radiant-beam', {o: {size: 1.2}, cam: {el: 0.15, d: 6, az: -0.4}, group: 'light', base: 'lance'}),
  '3d-arcane-matrix-b': field('arcane-matrix', {o: {quantity: 5, size: 0.8}, cam: {el: 0.6, d: 7, az: 0.7}, fit: 1.5, group: 'storm', base: 'eye'}),
  '3d-starblade-b': burst('starblade-cataclysm', {o: {size: 1.3}, cam: {el: 0.4, d: 7.5, ly: 0.9, az: -0.6}, until: 1.8, fit: 1.9, group: 'light', base: 'slash'}),
  '3d-ice-shatter-b': burst('ice-shatter', {o: {quantity: 5, size: 1.1}, cam: {el: 0.45, d: 6.5, az: 0.6}, fit: 1.5, group: 'frost', base: 'mark-frost'}),
  '3d-relic-descent-b': burst('sacred-relic-descent', {o: {size: 0.8}, cam: {el: 0.45, d: 7.5, ly: 0.8, az: 0.5}, until: 2.0, fit: 1.7, group: 'light', base: 'heal'}),
  '3d-prism-parry-c': burst('prism-parry', {o: {quantity: 2, size: 1.6}, cam: {el: 0.25, d: 6.5, az: 0.7}, until: 0.7, fit: 1.4, anchor: 'contact', group: 'light', base: 'rush'}),
  '3d-wind-vortex-b': field('wind-vortex', {o: {size: 0.7}, cam: {el: 0.3, d: 9, az: 0.5}, until: 1.5, stop: 0.8, fit: 1.4, group: 'earth', base: 'slash'}),
});

// ---- Every species ultimate's own piece (U3, second batch). move-piece-3d-ultimates.json picks
// for each ultimate an effect that fits its palette and archetype and a variant no other
// ultimate plays (scripts: the assignment is made once and kept, so a piece never moves).
// One shape per effect (how it is filmed and cut), six variants (size, pace and angle).
const SHAPES = Object.freeze({
  'thunder-strike': burst('thunder-strike', {cam: {el: 0.3, d: 8.5, ly: 1.2}, until: 1.4}),
  'energy-burst': burst('energy-burst', {until: 0.9, fit: 1.4, anchor: 'contact'}),
  'arc-ray': beam('arc-ray'), 'sustained-arc': beam('sustained-arc', {opaque: true}),
  'charged-beam': beam('charged-beam', {hit: 1.5, from: 1.9, until: 2.8, stop: 2.4}), 'radiant-beam': beam('radiant-beam'),
  'arcane-matrix': field('arcane-matrix'),
  'fire-explosion': burst('fire-explosion', {cam: {el: 0.3, d: 6.5}, until: 0.75, noSmoke: true}),
  'rolling-fireburst': burst('rolling-fireburst', {anchor: 'contact'}), fireball: shot('fireball', {opaque: true}),
  'flame-surge': burst('flame-surge', {until: 1.1}), 'burning-ground': field('burning-ground'),
  'magma-fissure': burst('magma-fissure', {cam: {el: 0.4, d: 8}, until: 1.4, fit: 2.2}),
  'fire-vortex': field('fire-vortex', {cam: {el: 0.42, d: 10.5}, until: 1.8, stop: 1.1}),
  'billowing-airburst': burst('billowing-airburst', {until: 0.8, noSmoke: true, fit: 1.4, anchor: 'contact'}),
  'ice-shatter': burst('ice-shatter', {cam: {el: 0.3, d: 6}}),
  'frost-lance-rain': burst('frost-lance-rain', {cam: {el: 0.35, d: 8}, until: 1.5, fit: 1.8}),
  'ground-freeze-study': burst('ground-freeze-study', {opaque: true, cam: {el: 0.35, d: 8.5}, until: 1.6, fit: 2.0}),
  'ice-lance-study': burst('ice-lance-study', {opaque: true, from: 0.25, until: 1.3, anchor: 'contact'}),
  'ice-shield-study': burst('ice-shield-study', {opaque: true, until: 1.4, fit: 1.4, anchor: 'contact'}),
  'frost-wheel': shot('frost-wheel'),
  'tidal-surge': burst('tidal-surge', {cam: {el: 0.35, d: 8, ly: 0.9}, until: 1.6, bloom: 0.92, fit: 2.0}),
  'steam-jet': field('steam-jet', {cam: {el: 0.25, d: 7}, fit: 1.4}),
  'wind-vortex': field('wind-vortex', {cam: {el: 0.42, d: 10.5}, until: 1.8, stop: 1.1}),
  'venom-pool': field('venom-pool'),
  'astral-convergence': burst('astral-convergence', {until: 1.4, fit: 1.8, anchor: 'contact'}),
  'sacred-relic-descent': burst('sacred-relic-descent', {cam: {el: 0.32, d: 8, ly: 1}, until: 2.0, fit: 2.0}),
  'golden-chain-rain': burst('golden-chain-rain', {cam: {el: 0.3, d: 9}, until: 2.0, fit: 2.0}),
  'starblade-cataclysm': burst('starblade-cataclysm', {cam: {el: 0.3, d: 7, ly: 0.9}, until: 1.8}),
  'prism-parry': burst('prism-parry', {until: 0.7, fit: 1.3, anchor: 'contact'}),
  'prism-guard': field('prism-guard', {cam: C, fit: 1.4, anchor: 'contact'}),
  'energy-vortex': field('energy-vortex', {cam: {el: 0.42, d: 10.5}, until: 1.8, stop: 1.1}),
  'thorn-crown': field('thorn-crown'), 'verdant-restoration': field('verdant-restoration', {opaque: true, cam: C, fit: 1.5}),
  'binding-curse': field('binding-curse'), 'plasma-bolt': shot('plasma-bolt'),
  'darkchain-detonation': burst('darkchain-detonation', {cam: {el: 0.35, d: 8}, until: 1.8, fit: 2.2}),
  'smoke-column': field('smoke-column', {fit: 1.4}),
  shockwave: burst('shockwave', {until: 1.0}), 'quicksand-seal': field('quicksand-seal'),
  'dust-devil': field('dust-devil', {cam: {el: 0.42, d: 10.5}, until: 1.6, stop: 0.9}),
  'smoke-puff': burst('smoke-puff', {until: 1.0, fit: 1.3, anchor: 'contact'})
});
const VARIANTS = Object.freeze([
  {o: {}, cam: {}}, {o: {size: 1.3}, cam: {el: 0.45, az: 0.5}}, {o: {size: 0.85, speed: 1.25}, cam: {el: 0.2, az: -0.5}},
  {o: {density: 0.9, detail: 1.4}, cam: {el: 0.55, az: 0.9}}, {o: {size: 1.15, speed: 0.8}, cam: {el: 0.35, az: -0.9}},
  {o: {size: 1.5, density: 0.3}, cam: {el: 0.25, az: 0.25}}
]);
/** The three.js piece name of a species ultimate. */
export const ultimatePieceName = record => `3d-u-${record}`;
const ULTIMATE = Object.fromEntries(Object.entries(ultimates).map(([record, [fx, v]]) => {
  const shape = SHAPES[fx], variant = VARIANTS[v];
  if (!shape || !variant) throw new Error(`ultimate ${record}: no shape for ${fx} #${v}`);
  const base = MOVE_VFX_CHOREOGRAPHY[record]?.contact?.piece ?? 'rush';
  return [ultimatePieceName(record), {...shape, o: {...(shape.o ?? {}), ...variant.o}, cam: {...(shape.cam ?? C), ...variant.cam},
    fit: (shape.fit ?? 1.6) * ((variant.o.size ?? 1) > 1.2 ? 1.12 : 1), group: `u${record}`, base, variant: v}];
}));

export const MOVE_PIECE_3D = Object.freeze({...HAND, ...ULTIMATE});
