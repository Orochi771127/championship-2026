// Data Arena -- read-only adapter from the arena's cast to existing creature art.
//
// The arena reuses creatures the game already ships; it never edits their
// records, IDs, save data or art. Each cast member resolves through the same
// Owner hash-selected public playtest selection the main game uses
// (accepted-original-character-selection.r1.json) and the same location gate
// (isOriginalRuntimeLocation: loopback, or the approved public playtest URL).
// Anywhere else the arena draws its own original procedural silhouettes, so a
// mirror or fork never ships selected art outside its approval.
//
// Sequence ids are the raw Main-side requests the Battle presenter already
// resolves from CPU-checked notifications (battleCharacterAction.js):
// 0 stand, 2 walk, 7 attack, 6 hit, 15 down, 33 win.

import acceptedSelection from "../../../data/championship/accepted-original-character-selection.r1.json" with { type: "json" };
import { DATA_ARENA_BOSS, DATA_ARENA_MATE, DATA_ARENA_PARTNERS, DATA_ARENA_RIVALS } from "../../modes/dataArena/dataArenaConfig.js";
import { speciesNameForId } from "../../text/zhHant.js";
import { isOriginalRuntimeLocation } from "../originalRuntimeLocation.js";

export const DATA_ARENA_SEQUENCES = Object.freeze({ STAND: 0, WALK: 2, ATTACK: 7, HIT: 6, DOWN: 15, WIN: 33 });

const bySpecies = new Map(acceptedSelection.characters.map((entry) => [entry.speciesId, entry]));

/** One cast member's art record, or null when none is selected for this species. */
export function dataArenaArtRecord(speciesId, href = globalThis.location?.href) {
  const entry = bySpecies.get(speciesId);
  if (!entry || !href || !isOriginalRuntimeLocation(href)) return null;
  return Object.freeze({
    speciesId, entityId: entry.entityId, sourceBankSha256: entry.sourceBankSha256,
    runtimeUrl: new URL(`${acceptedSelection.root}${entry.folder}/runtime.review.json`, href).href,
    portraitUrl: new URL(`${acceptedSelection.root}${entry.folder}/hud-r01/main-cell_000.webp`, href).href
  });
}

export function dataArenaCast(href = globalThis.location?.href) {
  const member = (role, speciesId, extra = {}) => Object.freeze({ role, speciesId, name: speciesNameForId(speciesId), art: dataArenaArtRecord(speciesId, href), ...extra });
  return Object.freeze({
    partners: Object.freeze(DATA_ARENA_PARTNERS.map((partner) => member("PLAYER", partner.speciesId, { partnerId: partner.id }))),
    mate: member("MATE", DATA_ARENA_MATE.speciesId),
    rivals: Object.freeze(DATA_ARENA_RIVALS.map((rival) => member(rival.champion ? "CHAMPION" : "RIVAL", rival.speciesId, { rivalId: rival.id, kit: rival.kit }))),
    boss: member("BOSS", DATA_ARENA_BOSS.speciesId)
  });
}
