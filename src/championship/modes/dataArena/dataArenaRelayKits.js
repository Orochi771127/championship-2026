// RELAY kits that fit each partner (OWNER_APPROVED_ADAPTATION 2026-10-28,
// docs/coordination/OWNER_DIRECTION.md ARENA_RELAY_KITS_20261028).
//
// Owner: 「幫他們配招要配適合的屬性還有招式，就像不可能草系會發飛彈」. A kit is
//   1. the partner's own special moves (move records it already owns), turned
//      into an arena mechanic by their approved VFX style, then
//   2. moves from its element's pool, which holds only that element's moves
//      (or element-neutral body moves), never another element's.
// The element itself is derived from the partner's own move colours by
// scripts/build-data-arena-relay-kits.mjs. Stage never changes a number: a
// style rule is the same for every generation, matching the RELAY roster rule.
import kitData from '../../../data/championship/data-arena-relay-kits.v1.json' with { type: 'json' };
import { pb324PartnerKit } from './dataArenaPb324Catalog.js';
export { RELAY_ELEMENTS } from './dataArenaRelayElements.js';

// Pool moves: five per element, ultimate last. `neutral` marks body moves any
// element may carry (tinted by the partner); every other entry is that element.
export const RELAY_ELEMENT_KITS = Object.freeze({
  fire: Object.freeze({ moves: Object.freeze(['emberBolt', 'fangRush', 'flameRing', 'cinderGuard', 'clawSweep']), ultimate: 'coreNova' }),
  frost: Object.freeze({ moves: Object.freeze(['iceShard', 'frostStep', 'iceCage', 'frostFan', 'glacierGuard']), ultimate: 'whiteout' }),
  light: Object.freeze({ moves: Object.freeze(['sunSpear', 'sunShield', 'scatterLight', 'radiantDash', 'haloPulse']), ultimate: 'dawnLance' }),
  water: Object.freeze({ moves: Object.freeze(['tideBolt', 'tideWave', 'foamZone', 'surfRush', 'tideGuard']), ultimate: 'vortex' }),
  earth: Object.freeze({ moves: Object.freeze(['shardVolley', 'quakeSlam', 'brutalCharge', 'rockGuard', 'clawSweep']), ultimate: 'shardStorm' }),
  storm: Object.freeze({ moves: Object.freeze(['arcBolt', 'arcFan', 'arcField', 'boltDash', 'stormGuard']), ultimate: 'arcStorm' }),
  nature: Object.freeze({ moves: Object.freeze(['seedBolt', 'vineSnare', 'leafFan', 'thornRush', 'barkGuard']), ultimate: 'grovePulse' }),
  shadow: Object.freeze({ moves: Object.freeze(['shadeBolt', 'shadeStep', 'shadeField', 'clawSweep', 'duskGuard']), ultimate: 'nightPulse' }),
  physical: Object.freeze({ moves: Object.freeze(['impactShot', 'clawSweep', 'brutalCharge', 'quakeSlam', 'ironGuard']), ultimate: 'impactNova' })
});
export const RELAY_POOL_MOVE_ELEMENT = Object.freeze({
  emberBolt: 'fire', fangRush: 'fire', flameRing: 'fire', cinderGuard: 'fire', coreNova: 'fire',
  iceShard: 'frost', frostStep: 'frost', iceCage: 'frost', frostFan: 'frost', glacierGuard: 'frost', whiteout: 'frost',
  sunSpear: 'light', sunShield: 'light', scatterLight: 'light', radiantDash: 'light', haloPulse: 'light', dawnLance: 'light',
  tideBolt: 'water', tideWave: 'water', foamZone: 'water', surfRush: 'water', tideGuard: 'water', vortex: 'water',
  shardVolley: 'earth', rockGuard: 'earth', shardStorm: 'earth',
  arcBolt: 'storm', arcFan: 'storm', arcField: 'storm', boltDash: 'storm', stormGuard: 'storm', arcStorm: 'storm',
  seedBolt: 'nature', vineSnare: 'nature', leafFan: 'nature', thornRush: 'nature', barkGuard: 'nature', grovePulse: 'nature',
  shadeBolt: 'shadow', shadeStep: 'shadow', shadeField: 'shadow', duskGuard: 'shadow', nightPulse: 'shadow',
  impactShot: 'physical', ironGuard: 'physical', impactNova: 'physical',
  clawSweep: 'neutral', brutalCharge: 'neutral', quakeSlam: 'neutral'
});

// One arena mechanic per approved VFX style. Numbers are the tested pool moves'
// (named in the comment) or between them; no element side effect lives here.
export const RELAY_STYLE_RULES = Object.freeze({
  strike: { type: 'LUNGE', energy: 20, cooldown: 4, windup: 0.22, distance: 220, speed: 900, width: 64, damage: 26 }, // brutalCharge, shorter
  claw: { type: 'NOVA', energy: 18, cooldown: 3, windup: 0.2, radius: 105, damage: 24, effect: 'NONE' }, // clawSweep
  slash: { type: 'LUNGE', energy: 20, cooldown: 3.5, windup: 0.2, distance: 140, speed: 800, width: 96, damage: 26 },
  pierce: { type: 'LUNGE', energy: 22, cooldown: 4.5, windup: 0.2, distance: 230, speed: 1050, width: 56, damage: 27, invulnerable: true }, // radiantDash
  vine: { type: 'ZONE', energy: 28, cooldown: 6, windup: 0.22, range: 500, radius: 105, delay: 0.8, damage: 22, effect: 'ROOT', rootSeconds: 1.2 }, // vineSnare
  thorn: { type: 'SPREAD', energy: 22, cooldown: 2.8, windup: 0.22, range: 500, speed: 820, radius: 9, damage: 15, count: 3, spread: 0.4 },
  leaf: { type: 'SPREAD', energy: 24, cooldown: 3, windup: 0.24, range: 480, speed: 700, radius: 9, damage: 12, count: 4, spread: 0.65 }, // leafFan
  seed: { type: 'BOLT', energy: 16, cooldown: 1, windup: 0.2, range: 570, speed: 630, radius: 11, damage: 21 }, // seedBolt
  spore: { type: 'ZONE', energy: 24, cooldown: 6, windup: 0.3, range: 520, radius: 120, delay: 1, damage: 14, effect: 'SLOW', slow: 0.5, slowSeconds: 2 }, // foamZone
  missile: { type: 'BOLT', energy: 18, cooldown: 1.3, windup: 0.24, range: 520, speed: 640, radius: 13, damage: 25, knockback: 170 }, // impactShot
  gatling: { type: 'SPREAD', energy: 22, cooldown: 2.8, windup: 0.22, range: 560, speed: 900, radius: 8, damage: 9, count: 5, spread: 0.35 },
  shell: { type: 'BARRIER', energy: 20, cooldown: 7, windup: 0.16, duration: 1.4, radius: 64, arc: 2.2 }, // glacierGuard
  fireball: { type: 'BOLT', energy: 18, cooldown: 0.9, windup: 0.14, range: 620, speed: 620, radius: 11, damage: 20 }, // emberBolt
  flame: { type: 'ZONE', energy: 30, cooldown: 6, windup: 0.18, range: 520, radius: 110, delay: 0.85, damage: 34, effect: 'NONE' }, // flameRing
  water: { type: 'WAVE', energy: 26, cooldown: 5, windup: 0.6, range: 560, speed: 420, radius: 34, damage: 20, knockback: 320 }, // tideWave
  ice: { type: 'BOLT', energy: 16, cooldown: 0.8, windup: 0.14, range: 600, speed: 760, radius: 10, damage: 18 }, // iceShard
  thunder: { type: 'BOLT', energy: 18, cooldown: 1.2, windup: 0.22, range: 650, speed: 900, radius: 10, damage: 23 }, // arcBolt
  quake: { type: 'ZONE', energy: 26, cooldown: 4.8, windup: 0.3, range: 540, radius: 130, delay: 0.95, damage: 30, effect: 'NONE' }, // quakeSlam
  wind: { type: 'SPREAD', energy: 20, cooldown: 2.6, windup: 0.22, range: 460, speed: 680, radius: 10, damage: 11, count: 3, spread: 0.5, knockback: 160 },
  holy: { type: 'BOLT', energy: 22, cooldown: 1.6, windup: 0.28, range: 760, speed: 1100, radius: 12, damage: 30, pierce: 2 }, // sunSpear
  dark: { type: 'BOLT', energy: 18, cooldown: 1.2, windup: 0.22, range: 640, speed: 690, radius: 12, damage: 23 }, // shadeBolt
  sound: { type: 'NOVA', energy: 22, cooldown: 4.5, windup: 0.26, radius: 150, damage: 24, effect: 'SLOW', slow: 0.4, slowSeconds: 1.2 },
  beam: { type: 'BOLT', energy: 24, cooldown: 2, windup: 0.3, range: 800, speed: 1200, radius: 12, damage: 30, pierce: 2 },
  // ORIGINAL_MOVES_ARENA_20261126: a thrown weapon (fist, spear, knife, drill) flies at the foe;
  // a bomb is lobbed onto the aim point and goes off there (missile / flame numbers).
  throw: { type: 'BOLT', energy: 20, cooldown: 1.6, windup: 0.24, range: 560, speed: 760, radius: 13, damage: 26, knockback: 170 },
  lob: { type: 'ZONE', energy: 26, cooldown: 5, windup: 0.24, range: 520, radius: 110, delay: 0.75, damage: 32, effect: 'NONE' }
});

// Owner 2026-11-26 (「原作對應每一隻的招式加回去」): where a move's original effect
// throws something the style rule above did not -- a flame fist, a spear, a
// bomb read as a shield -- the arena throws it as the original did. Records are
// the partner's own move records; the reason is the record's body effect bank.
export const ORIGINAL_FORM_STYLE = Object.freeze({
  79: 'throw', 114: 'throw', 161: 'throw', 172: 'throw', 355: 'throw', 376: 'throw', 518: 'throw', // pointer, syringe, drill, flame fist, trident, spear, sword
  99: 'lob', 382: 'lob', 385: 'lob', 404: 'lob', // toy bomb, smiley bombs
  473: 'beam', 549: 'beam' // beam bodies filed under the shell style
});

// Element side effects come from the move's own colour, not its style: a fire
// fireball lights the ground, a light-coloured one does not.
function withPalette(rule, palette) {
  const shot = ['BOLT', 'SPREAD', 'LANCE'].includes(rule.type), area = ['ZONE', 'NOVA'].includes(rule.type);
  if (palette === 'fire') {
    if (shot) return { ...rule, onTerrain: 'IGNITE', ...(rule.type === 'BOLT' ? { onHit: { burn: 2.5 } } : {}) };
    if (area && rule.effect === 'NONE') return { ...rule, effect: 'IGNITE' };
  }
  if (palette === 'ice') {
    if (shot) return { ...rule, onTerrain: 'FREEZE', onHit: { slow: 0.3, slowSeconds: 1.2 } };
    if (area) return { ...rule, freezeWater: true, ...(rule.effect === 'NONE' ? { effect: 'SLOW', slow: 0.4, slowSeconds: 1.2 } : {}) };
  }
  return rule;
}

const ownBySpecies = new Map(kitData.species.map(([speciesIndex, basicRecord, own]) => [speciesIndex,
  Object.freeze({ basicRecord, own: Object.freeze(own.map(([record, style, palette, tier, ultimate]) => Object.freeze({ id: `own-${record}`, record,
    style: ORIGINAL_FORM_STYLE[record] ?? style, palette, tier, ultimate: ultimate === 1 }))) })]));
const ownById = new Map([...ownBySpecies.values()].flatMap(entry => entry.own.map(move => [move.id, move])));

export function relayOwnMoveInfo(id) { return ownById.get(id) ?? null; }
export function relayBasicRecord(speciesIndex) { return ownBySpecies.get(speciesIndex)?.basicRecord ?? null; }

// A partner's own ultimate in the arena's ultimate slot (UNIFIED_MOVES_20261118,
// Owner 2026-11-18: one move list for the auto battle and the Data Arena). The
// move is the partner's own -- its name, look and icon -- and it fights with the
// numbers of the ultimate its element pool used to lend, so balance stays as it
// was. Set while the roster kits are built (relaySpeciesKit).
const ownUltimateStandIn = new Map();
/** The pool ultimate whose numbers a partner's own ultimate fights with, or null. */
export function relayOwnUltimateStandIn(id) { return ownUltimateStandIn.get(id) ?? null; }

/** Rule for a partner's own move, or null when `id` is not one. */
export function relayOwnMove(id) {
  const info = ownById.get(id);
  if (!info) return null;
  return { ...withPalette(RELAY_STYLE_RULES[info.style], info.palette), mechanic: `own ${info.style} move`, ownRecord: info.record };
}

/** A partner's own move records as kit ids: {skills, ultimate}. */
export function relayOwnMoves(speciesIndex) {
  const own = ownBySpecies.get(speciesIndex)?.own ?? [];
  const ultimate = own.find(move => move.ultimate) ?? null;
  return Object.freeze({ skills: Object.freeze(own.filter(move => move !== ultimate).map(move => move.id)), ultimate: ultimate?.id ?? null });
}

/**
 * A roster partner's kit (ORIGINAL_MOVES_ARENA_20261126, Owner 2026-11-26:
 * 「原作對應每一隻的招式加回去」): its own original moves first -- the moves the
 * partner owns in the auto battle, same name, icon and look -- then moves of
 * its element from the 324-move pool (Wave 8-B, 2026-11-25) fill the slots
 * left. The ultimate is the partner's own, fighting with its pool ultimate's
 * numbers so balance stays where the pool set it.
 */
export function relaySpeciesKit(speciesIndex, element) {
  const kit = pb324PartnerKit(speciesIndex, element);
  const own = relayOwnMoves(speciesIndex);
  if (own.ultimate && !ownUltimateStandIn.has(own.ultimate)) ownUltimateStandIn.set(own.ultimate, kit.ultimate);
  const moves = [...own.skills.slice(0, 3)];
  for (const id of kit.moves) if (moves.length < 3 && !moves.includes(id)) moves.push(id);
  return Object.freeze({
    element: kit.element,
    moves: Object.freeze(moves),
    ultimate: own.ultimate ?? kit.ultimate,
    pool: Object.freeze([...own.skills, ...kit.pool.filter(id => !own.skills.includes(id))]),
    own: own.skills.length + (own.ultimate ? 1 : 0)
  });
}

export function relayElementMovePool(speciesIndex, element) {
  return pb324PartnerKit(speciesIndex, element).pool;
}
