// The product's cage definitions: the 36 originals (cageCatalog.js, hash-locked by the cage
// authoring contract) plus the gachapon's royal cages.
//
// OWNER_APPROVED_ADAPTATION 2026-11-03: 全自動皇家牧場 and 全自動星際動物園 are their own
// maps (own footprint, ground, walk data and 3D model) instead of editions drawn as the
// ranch and the zoo. They follow the 36 originals as definitions 36 and 37, are never sold
// in the shop and stay out of listCageDefinitions(); ownership comes from the gachapon
// (ranchAutomation.js). The raising simulation keeps running them by their base cage's
// original rules (ruleDefinitionIndex), so capacity, food, waste and training read the
// ranch's and the zoo's records; the map and the royal bonuses are what differ.
import { deepFreeze } from "../contracts/championshipContracts.js";
import { getCageTraining } from "./cageEffects.js";
import { listCageDefinitions, getCageDefinitionByModuleId as originalDefinitionByModuleId } from "./cageCatalog.js";

export const ROYAL_RANCH_DEFINITION_INDEX = 36;
export const STELLAR_ZOO_DEFINITION_INDEX = 37;

let cached = null;
export function listGachaCageDefinitions() {
  if (cached) return cached;
  cached = deepFreeze([
    { cageDefinitionIndex: ROYAL_RANCH_DEFINITION_INDEX, moduleId: "championship:2026:cage:royal-ranch", displayName: "Royal Ranch",
      shopRecordIndex: null, alwaysOwned: false, identityEvidence: "OWNER_APPROVED_ADAPTATION_20261103", gachaEdition: "ROYAL_RANCH",
      ruleDefinitionIndex: 25, training: getCageTraining(25) },
    { cageDefinitionIndex: STELLAR_ZOO_DEFINITION_INDEX, moduleId: "championship:2026:cage:stellar-zoo", displayName: "Stellar Zoo",
      shopRecordIndex: null, alwaysOwned: false, identityEvidence: "OWNER_APPROVED_ADAPTATION_20261103", gachaEdition: "STELLAR_ZOO",
      ruleDefinitionIndex: 24, training: getCageTraining(24) }
  ]);
  return cached;
}

/** A definition by module id: an original, else a gachapon cage. */
export function getCageDefinitionByModuleId(moduleId) {
  return originalDefinitionByModuleId(moduleId) ?? listGachaCageDefinitions().find((record) => record.moduleId === moduleId) ?? null;
}

/** A definition by index: 0..35 the originals, 36 and 37 the gachapon cages. */
export function getCageDefinition(cageDefinitionIndex) {
  const record = listCageDefinitions()[cageDefinitionIndex] ?? listGachaCageDefinitions().find((entry) => entry.cageDefinitionIndex === cageDefinitionIndex);
  if (!record) throw new Error(`UNKNOWN_CAGE_DEFINITION: ${cageDefinitionIndex}`);
  return record;
}

/** The original definition whose simulation rules a cage runs by (itself for the 36 originals). */
export function cageRuleDefinitionIndex(cageDefinitionIndex) {
  return listGachaCageDefinitions().find((record) => record.cageDefinitionIndex === cageDefinitionIndex)?.ruleDefinitionIndex ?? cageDefinitionIndex;
}

export function getGachaCageDefinitionByEdition(edition) {
  return listGachaCageDefinitions().find((record) => record.gachaEdition === edition) ?? null;
}
