// OWNER_APPROVED_ADAPTATION, 2026-10-26: ecology types for the hex cage world.
// "Same type" is decided by ecology, not by artwork: two different-looking
// forest cages are both forest. The groups extend the authored large/small
// theme pairs (shared-edges-polish-20261019) with two natural pairs; every
// other cage is its own type, so copies of one cage still join. The waiting
// room is a fixed facility and never joins anything.
//
// Appearance (seams dissolve) and passage (partners may cross) are separate
// policies so cross-ecology movement can be tuned later without touching art.
import { getCageDefinitionByModuleId } from './cageCatalog.js';

export const RANCH_ECOLOGY_GROUPS = Object.freeze({
  forest: Object.freeze([10, 11]),       // 森林 · 叢林
  grassland: Object.freeze([7, 25]),     // 草原 · 牧場
  garden: Object.freeze([17, 29]),       // 花園 · 小花園
  volcano: Object.freeze([6, 31]),       // 火山 · 小火山
  mountain: Object.freeze([9, 32]),      // 高山 · 小高山
  beach: Object.freeze([8, 33]),         // 海灘 · 小海灘
  desert: Object.freeze([19]),           // 沙漠
  snowfield: Object.freeze([20]),        // 冰原
  sports: Object.freeze([1, 27]),        // 運動場 · 小運動場
  gym: Object.freeze([4, 30]),           // 健身房 · 小健身房
  infirmary: Object.freeze([15, 28])     // 小保健室 · 保健室
});
const WAITING_ROOM_DEFINITION = 35;
const byDefinition = new Map(Object.entries(RANCH_ECOLOGY_GROUPS).flatMap(([type, ids]) => ids.map(id => [id, type])));

function definitionIndexOf(reference) {
  if (Number.isInteger(reference)) return reference;
  return getCageDefinitionByModuleId(reference)?.cageDefinitionIndex ?? null;
}

/** Ecology type of a cage (module id or definition index); null for the waiting room / unknown. */
export function ranchEcologyType(reference) {
  const index = definitionIndexOf(reference);
  if (index === null || index === WAITING_ROOM_DEFINITION) return null;
  return byDefinition.get(index) ?? `cage-${index}`;
}

/** v1: same ecology → the shared edge's rim, fences and seam art dissolve. */
export function ranchMergesAppearance(a, b) {
  const ta = ranchEcologyType(a);
  return ta !== null && ta === ranchEcologyType(b);
}

/** v1: same ecology → partners may walk across. Different ecologies keep their border. */
export function ranchAllowsPassage(a, b) {
  const ta = ranchEcologyType(a);
  return ta !== null && ta === ranchEcologyType(b);
}
