// Three-axis partner taxonomy (OWNER_APPROVED_ADAPTATION 2026-10-29): faction, race and element.
// Faction renames the ROM attribute and race renames the ROM family, so the original evolution
// conditions (attribute and family points) keep their exact meaning. Element is product-authored.
// Nothing here changes a species record, a save or an original battle rule on its own.
import catalog from '../../data/championship/species-taxonomy.v1.json' with {type:'json'};
import {productSpeciesRecord} from './productSpeciesData.js';
import {deepFreeze} from './championshipContracts.js';

export const TAXONOMY_FACTIONS = Object.freeze(['LUMEN', 'IRON', 'RIFT']);
export const TAXONOMY_RACES = Object.freeze(['DRAGON', 'BEAST', 'AVIAN', 'SYLVAN', 'AQUATIC', 'MECHANOID', 'ASTRAL', 'NETHER']);
// Each ring beats the next element clockwise: Metal > Wood > Earth > Water > Fire > Metal, Sun > Ice > Wind > Thunder > Moon > Sun.
export const TAXONOMY_RINGS = deepFreeze({EARTHLY: ['METAL', 'WOOD', 'EARTH', 'WATER', 'FIRE'], CELESTIAL: ['SUN', 'ICE', 'WIND', 'THUNDER', 'MOON']});
export const TAXONOMY_ELEMENTS = Object.freeze([...TAXONOMY_RINGS.EARTHLY, ...TAXONOMY_RINGS.CELESTIAL]);
export const TAXONOMY_EFFECTIVE_PERCENT = 150, TAXONOMY_RESISTED_PERCENT = 75;
// The five existing resistance bars keep their original meaning and each gains one new element.
export const TAXONOMY_RESISTANCE_AXES = deepFreeze({HEAT: ['FIRE', 'WOOD'], COLD: ['ICE', 'WATER'], LIGHT: ['SUN', 'WIND'], DARK: ['MOON', 'EARTH'], THUNDER: ['THUNDER', 'METAL']});
// ROM attribute byte 1 vaccine, 2 virus, 3 data; 4 (free) partners take their faction from this catalog.
const FACTION_BY_ATTRIBUTE = {1: 'LUMEN', 2: 'RIFT', 3: 'IRON'};
const RACE_BY_FAMILY_BIT = {1: 'BEAST', 2: 'MECHANOID', 4: 'SYLVAN', 8: 'AVIAN', 16: 'DRAGON', 32: 'AQUATIC', 64: 'ASTRAL', 128: 'NETHER'};

export function assertSpeciesTaxonomyCatalog(entries, record = productSpeciesRecord) {
  const fail = (code, e) => { throw new Error(`SPECIES_TAXONOMY_${code}:${e?.speciesIndex}`); };
  const seen = new Set();
  for (const e of entries) {
    if (!Number.isSafeInteger(e.speciesIndex) || e.speciesIndex < 8 || seen.has(e.speciesIndex)) fail('IDENTITY', e);
    if (!TAXONOMY_ELEMENTS.includes(e.element)) fail('ELEMENT', e);
    const species = record(e.speciesIndex);
    if (!species) fail('UNKNOWN_SPECIES', e);
    const faction = FACTION_BY_ATTRIBUTE[species.attributeIndex];
    if (species.attributeIndex === 0 ? e.faction !== null : species.attributeIndex === 4 ? !TAXONOMY_FACTIONS.includes(e.faction) : e.faction !== faction) fail('FACTION', e);
    if (e.race !== (RACE_BY_FAMILY_BIT[species.familyBits] ?? null)) fail('RACE', e);
    seen.add(e.speciesIndex);
  }
  return entries;
}

const bySpecies = new Map(assertSpeciesTaxonomyCatalog(catalog.entries).map(e => [e.speciesIndex, deepFreeze({...e})]));
export const SPECIES_TAXONOMY = deepFreeze(catalog);
export function speciesTaxonomy(speciesIndex) { return bySpecies.get(speciesIndex) ?? null; }
export function speciesTaxonomyForId(speciesId) {
  const match = /^(?:championship:creature:)?species-(\d+)$/.exec(speciesId ?? '');
  return match ? speciesTaxonomy(Number(match[1])) : null;
}

export function elementRing(element) { return Object.keys(TAXONOMY_RINGS).find(ring => TAXONOMY_RINGS[ring].includes(element)) ?? null; }
/** The element this one beats, and the element that beats it (same ring only). */
export function elementMatchup(element) {
  const ring = TAXONOMY_RINGS[elementRing(element)];
  if (!ring) return null;
  const i = ring.indexOf(element);
  return {beats: ring[(i + 1) % 5], beatenBy: ring[(i + 4) % 5]};
}
/** Damage percent for an attack of `attack` element landing on a partner of `defend` element. */
export function elementMultiplierPercent(attack, defend) {
  const m = elementMatchup(attack);
  if (!m || !TAXONOMY_ELEMENTS.includes(defend)) return 100;
  return m.beats === defend ? TAXONOMY_EFFECTIVE_PERCENT : m.beatenBy === defend ? TAXONOMY_RESISTED_PERCENT : 100;
}
export function elementResistanceAxis(element) { return Object.keys(TAXONOMY_RESISTANCE_AXES).find(axis => TAXONOMY_RESISTANCE_AXES[axis].includes(element)) ?? null; }

// Faction resonance: two of one faction in the team light that faction; all three together light the tri-core.
export const TAXONOMY_RESONANCE = deepFreeze({
  LUMEN: {damageTakenPercent: 90, regenPercent: 1, regenSeconds: 5},
  IRON: {cooldownPercent: 90, startTpPercent: 120, defensePercent: 108},
  RIFT: {critChancePercent: 10, signaturePercent: 115},
  TRI: {attackPercent: 108, defensePercent: 108, rewardPercent: 115}
});
export function factionResonance(factions) {
  const counts = {LUMEN: 0, IRON: 0, RIFT: 0};
  for (const f of factions ?? []) if (Object.hasOwn(counts, f)) counts[f]++;
  const active = TAXONOMY_FACTIONS.filter(f => counts[f] >= 2);
  if (TAXONOMY_FACTIONS.every(f => counts[f] >= 1)) active.push('TRI');
  return Object.freeze(active);
}
export function teamResonance(speciesIndexes) { return factionResonance(speciesIndexes.map(i => speciesTaxonomy(i)?.faction)); }

// Race habitats (Owner 2026-10-29) by original cage definition index. The Owner's list names some
// cage kinds the game does not have (lava, breeze, greenhouse, pond, waterfall, stream, observatory,
// sanctuary, shadow, ruins, castle); the nearest existing cages stand in: desert for wilds, jungle for
// thicket, gas chamber for swamp. Shared care cages help everyone already and add nothing here.
export const TAXONOMY_HABITATS = deepFreeze({
  DRAGON: [6, 31, 2, 26, 19],      // volcano, small volcano, arena, ring, desert
  BEAST: [7, 25, 0, 1, 27],        // grassland, ranch, open lot, sports field, small sports field
  AVIAN: [9, 32, 10, 1, 12],       // highland, small highland, forest, sports field, shrine
  SYLVAN: [17, 29, 10, 11],        // garden, small garden, forest, jungle
  AQUATIC: [8, 33, 20],            // beach, small beach, ice field
  MECHANOID: [4, 30, 14, 5, 3],    // gym, small gym, factory, laboratory, dojo
  ASTRAL: [23, 12, 17, 29],        // temple, shrine, garden, small garden
  NETHER: [34, 13, 22]             // cave, graveyard, gas chamber
});
export const TAXONOMY_SHARED_CARE = Object.freeze([35, 15, 28, 16, 18]); // waiting room, small infirmary, infirmary, hospital, hot spring
export const TAXONOMY_HABITAT_BONUS = deepFreeze({growthPercent: 120, findPercent: 125});
/** The partner's race when its cage is one of that race's habitats, else null. */
export function habitatMatch(speciesIndex, cageDefinitionIndex) {
  const race = speciesTaxonomy(speciesIndex)?.race;
  return race && TAXONOMY_HABITATS[race]?.includes(cageDefinitionIndex) ? race : null;
}
/** Races whose habitat this cage is, and whether it is a shared care cage. */
export function cageHabitat(cageDefinitionIndex) {
  return {races: TAXONOMY_RACES.filter(race => TAXONOMY_HABITATS[race].includes(cageDefinitionIndex)), sharedCare: TAXONOMY_SHARED_CARE.includes(cageDefinitionIndex)};
}
