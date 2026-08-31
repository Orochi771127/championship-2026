// Original Gate identity -> Hunt field binding.
//
// VERIFIED_BINARY from the 33-entry Hunt table in YDIJ ARM9. Each regular
// biome has a day and night Hunt id; Tutorial is a separate non-Gate entry.
// Keeping both variants here preserves the original data without inventing a
// new time-of-day selector.

import { deepFreeze } from "../contracts/championshipContracts.js";

export const ORIGINAL_HUNT_FIELD_BINDING_EVIDENCE = "VERIFIED_BINARY";
export const ORIGINAL_HUNT_FIELD_BINDING_ROM_SHA256 =
  "8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1";

const BINDINGS = {
  Canyon: ["HUNT_CANYON", "field_hm08_01", "HUNT_CANYON_NIGHT", "field_hm08_02"],
  Crag: ["HUNT_CRAG", "field_hm14_01", "HUNT_CRAG_NIGHT", "field_hm14_02"],
  Damp: ["HUNT_DAMP", "field_hm05_01", "HUNT_DAMP_NIGHT", "field_hm05_02"],
  Desert: ["HUNT_DESERT", "field_hm16_01", "HUNT_DESERT_NIGHT", "field_hm16_02"],
  Factory: ["HUNT_FACTORY", "field_hm10_01", "HUNT_FACTORY_NIGHT", "field_hm10_01"],
  Forest: ["HUNT_FOREST", "field_hm03_01", "HUNT_FOREST_NIGHT", "field_hm03_02"],
  Grass: ["HUNT_GRASS", "field_hm01_01", "HUNT_GRASS_NIGHT", "field_hm01_02"],
  Ice: ["HUNT_ICE", "field_hm13_01", "HUNT_ICE_NIGHT", "field_hm13_02"],
  Jungle: ["HUNT_JUNGLE", "field_hm04_01", "HUNT_JUNGLE_NIGHT", "field_hm04_02"],
  Mine: ["HUNT_MINE", "field_hm09_01", "HUNT_MINE_NIGHT", "field_hm09_01"],
  Oasis: ["HUNT_OASIS", "field_hm17_01", "HUNT_OASIS_NIGHT", "field_hm17_02"],
  Ruins: ["HUNT_RUINS", "field_hm18_01", "HUNT_RUINS_NIGHT", "field_hm18_02"],
  Savanna: ["HUNT_SAVANNA", "field_hm02_01", "HUNT_SAVANNA_NIGHT", "field_hm02_02"],
  Seaside: ["HUNT_SEASIDE", "field_hm06_01", "HUNT_SEASIDE_NIGHT", "field_hm06_02"],
  Sewer: ["HUNT_SEWER", "field_hm11_01", "HUNT_SEWER_NIGHT", "field_hm11_01"],
  Volcano: ["HUNT_VOLCANO", "field_hm15_01", "HUNT_VOLCANO_NIGHT", "field_hm15_02"]
};

export const ORIGINAL_HUNT_FIELD_BINDINGS = deepFreeze(
  Object.fromEntries(Object.entries(BINDINGS).map(([biomeId, values]) => [biomeId, {
    biomeId,
    dayHuntId: values[0],
    dayFieldId: values[1],
    nightHuntId: values[2],
    nightFieldId: values[3],
    evidence: ORIGINAL_HUNT_FIELD_BINDING_EVIDENCE
  }]))
);

export const ORIGINAL_HUNT_TUTORIAL_BINDING = deepFreeze({
  huntId: "HUNT_TUTORIAL",
  fieldId: "field_hm00_01",
  evidence: ORIGINAL_HUNT_FIELD_BINDING_EVIDENCE
});

export function getOriginalHuntFieldBinding(biomeId) {
  return ORIGINAL_HUNT_FIELD_BINDINGS[biomeId] ?? null;
}
