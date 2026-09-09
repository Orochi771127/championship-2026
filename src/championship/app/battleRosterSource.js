// Battle roster — the six combatants a match starts with.
//
// The battle lane traces how a match runs. This is the seam that decides who
// runs in it: three product creatures on one side, three ROM presets on the
// other, both built through the same arithmetic.
//
// WHY THE TWO SIDES ARE LABELLED DIFFERENTLY
// ------------------------------------------
// The opponents come out of the cartridge: a match record names preset indices,
// ARM9 0x02062900 turns each into a creature, and every number is traced.
//
// The player's three do not exist in the cartridge. Greyshade Cat, Blazetail Kit
// and Crystalfin Seahorse are creatures this product invented, so there is no
// ROM value to trace for them and no honest way to derive one. Their levels are
// declared in battle-player-roster.v1.json and carried through
// buildCreatureFromProfile -- the SAME function the preset path ends in -- so
// the mechanics stay the original's even though the inputs are the product's.
//
// Each combatant reports which it is. A screen, a test or a later reader can ask
// a roster whether it is watching traced numbers or declared ones, and this
// module never blurs the two.
//
// SLOT ORDER IS NOT A CHOICE
// --------------------------
// OVL19 0x0210CAB8 indexes slot = withinTeam + base and advances base by three
// per team, so slots 0..2 are team 0 and slots 3..5 are team 1. The player is
// team 0 because that is the side the outcome recorder's verdict 4 names, and
// battleOutcome already carries that reading.

import contract from "../../../docs/contracts/championship/battle-player-roster.v1.json" with { type: "json" };
import presetCatalog from "../../data/championship/catalogs/battle-presets.r1.json" with { type: "json" };
import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  BATTLE_CREATURE_OPPONENTS_PER_MATCH,
  buildCreatureFromProfile,
  buildOpponentTeam
} from "../battle/battleCreatureBuild.js";
import {
  BATTLE_OUTCOME_TEAM_COUNT,
  BATTLE_OUTCOME_TEAM_SLOT_COUNT,
  battleTeamOfSlot
} from "../battle/battleOutcome.js";

export const BATTLE_ROSTER_CONTRACT_VERSION = "championship-modern-battle-player-roster/v1";

export const BATTLE_ROSTER_TEAM_SIZE = BATTLE_CREATURE_OPPONENTS_PER_MATCH;
export const BATTLE_ROSTER_SLOT_COUNT = BATTLE_OUTCOME_TEAM_COUNT * BATTLE_OUTCOME_TEAM_SLOT_COUNT;

export const BATTLE_ROSTER_TRACED = "VERIFIED_BINARY";
export const BATTLE_ROSTER_DECLARED = "PRODUCT_AUTHORED";

export const BATTLE_ROSTER_PROFILES = deepFreeze(contract.profiles.map((profile) => deepFreeze({
  ...profile,
  levels: deepFreeze({ ...profile.levels })
})));

function rosterError(message) {
  return new Error(`BATTLE_ROSTER_${message}`);
}

/** The declared profile for one of the product's creatures. */
export function playerProfileFor(residentId) {
  const profile = BATTLE_ROSTER_PROFILES.find((entry) => entry.residentId === residentId);
  if (!profile) {
    throw rosterError("UNKNOWN_RESIDENT_ID");
  }
  return profile;
}

/**
 * Build the player's side. `residentIds` is up to three ids; a shorter list
 * leaves the remaining slots empty rather than repeating anyone, which is what
 * the party block's occupancy bitmask at +0x3C allows.
 */
export function buildPlayerTeam(residentIds) {
  if (!Array.isArray(residentIds) || residentIds.length > BATTLE_ROSTER_TEAM_SIZE) {
    throw rosterError(`TEAM_MUST_BE_AT_MOST_${BATTLE_ROSTER_TEAM_SIZE}`);
  }
  const slots = new Array(BATTLE_ROSTER_TEAM_SIZE).fill(null);
  residentIds.forEach((residentId, index) => {
    if (residentId === null || residentId === undefined) return;
    const profile = playerProfileFor(residentId);
    slots[index] = buildCreatureFromProfile({
      speciesId: profile.speciesId,
      evidence: BATTLE_ROSTER_DECLARED,
      statCurveIndex: profile.statCurveIndex,
      levels: profile.levels,
      source12C: profile.source12C,
      source130: profile.source130
    });
  });
  return deepFreeze(slots);
}

/** Three slots, with -1 for the ones a team does not fill. */
function padTeam(indices) {
  const padded = [...indices];
  while (padded.length < BATTLE_ROSTER_TEAM_SIZE) padded.push(-1);
  if (padded.length !== BATTLE_ROSTER_TEAM_SIZE) {
    throw rosterError(`TEAM_MUST_BE_AT_MOST_${BATTLE_ROSTER_TEAM_SIZE}`);
  }
  return padded;
}

/** Build the opponent side out of the ROM's preset table. */
export function buildOpponentTeamFromPresets(presetIndices) {
  return buildOpponentTeam(presetIndices, (index) => presetCatalog.records[index] ?? null);
}

/**
 * The six slots a match starts with, in the order the frame walks them: the
 * player's three, then the opponent's three.
 */
export function buildBattleRoster({ residentIds = [], presetIndices = [], playerPresetIndices = [] } = {}) {
  // The player's side is either the product's declared creatures or, while those
  // are out of the battle path, a ROM team like the opponent's. Both at once is
  // refused rather than silently preferring one.
  if (residentIds.length > 0 && playerPresetIndices.length > 0) {
    throw rosterError("PLAYER_SIDE_IS_EITHER_RESIDENTS_OR_PRESETS");
  }
  const player = playerPresetIndices.length > 0
    ? buildOpponentTeamFromPresets(padTeam(playerPresetIndices))
    : buildPlayerTeam(residentIds);
  const opponent = buildOpponentTeamFromPresets(padTeam(presetIndices));
  return deepFreeze([...player, ...opponent].map((creature) => (creature ? deepFreeze({ ...creature }) : null)));
}

/**
 * The combatant fields battleSession's factory takes, for one built creature.
 * Kept here rather than in the battle lane so the battle modules never learn
 * about residents or contracts.
 */
export function combatantFieldsFor(creature, slot) {
  if (!creature) return null;
  return deepFreeze({
    currentHp: creature.currentHp,
    maxHp: creature.maxHp,
    metricBase: creature.metricBase,
    metricLimit: creature.metricLimit,
    source12C: creature.source12C,
    source130: creature.source130,
    // Without this the session builds its move buckets for species 0 and every
    // combatant commits the same wrong action. battleMoveBuckets keys on it.
    speciesId: Number.isSafeInteger(creature.speciesId) ? creature.speciesId : 0,
    // +0x54 is the side battleActionApplication's walk compares: a target on the
    // attacker's own side is rejected. Which VALUES the original stores is not
    // traced, and it does not need to be -- the walk only ever tests them for
    // equality, so any two distinct values reproduce it exactly. The team split
    // is the traced part, and it comes from the roster layout at 0x0210CAB8.
    field54: Number.isSafeInteger(slot) ? battleTeamOfSlot(slot) : 0
  });
}

/** Whether every combatant in a roster came out of the cartridge. */
export function rosterEvidence(roster) {
  if (!Array.isArray(roster)) {
    throw rosterError("ROSTER_MUST_BE_AN_ARRAY");
  }
  const present = roster.filter((creature) => creature);
  if (present.length === 0) return null;
  return present.every((creature) => creature.evidence === BATTLE_ROSTER_TRACED)
    ? BATTLE_ROSTER_TRACED
    : BATTLE_ROSTER_DECLARED;
}
