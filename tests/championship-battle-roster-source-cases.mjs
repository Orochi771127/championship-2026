// Battle roster — who runs in a match, and which side's numbers are traced.
//
// The line this file defends: the product's own creatures are labelled
// PRODUCT_AUTHORED and the ROM's opponents VERIFIED_BINARY, and the two never
// get blurred. Both go through the same build, so the mechanics are the
// original's on both sides even though only one side's inputs are.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_ROSTER_CONTRACT_VERSION,
  BATTLE_ROSTER_DECLARED,
  BATTLE_ROSTER_PROFILES,
  BATTLE_ROSTER_SLOT_COUNT,
  BATTLE_ROSTER_TEAM_SIZE,
  BATTLE_ROSTER_TRACED,
  buildBattleRoster,
  buildOpponentTeamFromPresets,
  buildPlayerTeam,
  combatantFieldsFor,
  playerProfileFor,
  rosterEvidence
} from "../src/championship/app/battleRosterSource.js";

import {
  BATTLE_CREATURE_CURVE,
  BATTLE_CREATURE_CURVE_ROWS,
  BATTLE_CREATURE_HP_COLUMN,
  BATTLE_CREATURE_STAT_MAP,
  presetHoldsCreature
} from "../src/championship/battle/battleCreatureBuild.js";

import { battleTeamOfSlot } from "../src/championship/battle/battleOutcome.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "docs/contracts/championship/battle-player-roster.v1.json"), "utf8"));
const presets = JSON.parse(fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-presets.r1.json"), "utf8")).records;
const living = presets.filter((record) => presetHoldsCreature(record));

test("the product's own creatures are declared, and the contract says so in every place", () => {
  assert.equal(BATTLE_ROSTER_CONTRACT_VERSION, "championship-modern-battle-player-roster/v1");
  assert.equal(contract.evidence, "PRODUCT_AUTHORED");
  assert.equal(contract.originalParityClaim, false);
  // The SHAPE is the original's even though the values are not.
  assert.equal(contract.shapeEvidence, "VERIFIED_BINARY");
  for (const value of Object.values(contract.sourceEvidence)) {
    assert.equal(value, "PRODUCT_AUTHORED");
  }
  assert.equal(BATTLE_ROSTER_PROFILES.length, 3);
  assert.equal(contract.teamSize, BATTLE_ROSTER_TEAM_SIZE);
  assert.equal(BATTLE_ROSTER_SLOT_COUNT, 6);
});

test("every declared level is inside the ROM's curve, so nothing has to be clamped", () => {
  const levelKeys = BATTLE_CREATURE_STAT_MAP.map((entry) => entry.preset);
  for (const profile of BATTLE_ROSTER_PROFILES) {
    assert.ok(profile.statCurveIndex >= 0 && profile.statCurveIndex < BATTLE_CREATURE_CURVE_ROWS,
      `${profile.residentId} stat curve index`);
    assert.deepEqual(Object.keys(profile.levels).sort(), [...levelKeys].sort(),
      `${profile.residentId} declares exactly the ten fields the builder reads`);
    for (const [key, level] of Object.entries(profile.levels)) {
      assert.ok(Number.isSafeInteger(level) && level >= 0 && level < BATTLE_CREATURE_CURVE_ROWS,
        `${profile.residentId}.${key} = ${level}`);
    }
  }
});

test("a declared creature is built by the very same arithmetic as a ROM one", () => {
  const team = buildPlayerTeam(BATTLE_ROSTER_PROFILES.map((profile) => profile.residentId));
  assert.equal(team.length, 3);
  for (const [index, creature] of team.entries()) {
    const profile = BATTLE_ROSTER_PROFILES[index];
    assert.equal(creature.evidence, BATTLE_ROSTER_DECLARED);
    // HP is curve column 0 at the declared index -- a row read back, not a formula.
    assert.equal(creature.currentHp, BATTLE_CREATURE_CURVE[profile.statCurveIndex][BATTLE_CREATURE_HP_COLUMN]);
    assert.equal(creature.currentHp, creature.maxHp, "full health by construction");
    assert.equal(creature.metricBase, creature.metricLimit);
    // And every other stat is its own curve row.
    for (const entry of BATTLE_CREATURE_STAT_MAP) {
      const key = `field${entry.value.toString(16).toUpperCase().padStart(2, "0")}`;
      assert.equal(creature.stats[key], BATTLE_CREATURE_CURVE[profile.levels[entry.preset]][entry.column]);
    }
  }
});

test("the ROM's side stays labelled traced, and a mixed roster reports the weaker label", () => {
  const opponents = buildOpponentTeamFromPresets([living[0].recordIndex, living[1].recordIndex, -1]);
  assert.equal(opponents[0].evidence, BATTLE_ROSTER_TRACED);
  assert.equal(opponents[2], null);
  assert.equal(rosterEvidence(opponents), BATTLE_ROSTER_TRACED);

  const player = buildPlayerTeam([BATTLE_ROSTER_PROFILES[0].residentId]);
  assert.equal(rosterEvidence(player), BATTLE_ROSTER_DECLARED);

  // A match mixes the two, and the roster as a whole is therefore not traced.
  const roster = buildBattleRoster({
    residentIds: BATTLE_ROSTER_PROFILES.map((profile) => profile.residentId),
    presetIndices: [living[0].recordIndex, living[1].recordIndex, living[2].recordIndex]
  });
  assert.equal(rosterEvidence(roster), BATTLE_ROSTER_DECLARED,
    "one declared creature is enough to stop the whole roster being called traced");
  assert.equal(rosterEvidence([]), null);
});

test("the six slots are the player's three then the opponent's three", () => {
  const roster = buildBattleRoster({
    residentIds: BATTLE_ROSTER_PROFILES.map((profile) => profile.residentId),
    presetIndices: [living[0].recordIndex, living[1].recordIndex, living[2].recordIndex]
  });
  assert.equal(roster.length, 6);
  for (let slot = 0; slot < 3; slot += 1) {
    assert.equal(battleTeamOfSlot(slot), 0);
    assert.equal(roster[slot].evidence, BATTLE_ROSTER_DECLARED, `slot ${slot} is the player's`);
  }
  for (let slot = 3; slot < 6; slot += 1) {
    assert.equal(battleTeamOfSlot(slot), 1);
    assert.equal(roster[slot].evidence, BATTLE_ROSTER_TRACED, `slot ${slot} is the ROM's`);
  }
});

test("a short side leaves empty slots rather than repeating anyone", () => {
  const roster = buildBattleRoster({
    residentIds: [BATTLE_ROSTER_PROFILES[0].residentId],
    presetIndices: [living[0].recordIndex]
  });
  assert.ok(roster[0]);
  assert.equal(roster[1], null);
  assert.equal(roster[2], null);
  assert.ok(roster[3]);
  assert.equal(roster[4], null);
  assert.equal(roster[5], null);

  assert.throws(() => buildPlayerTeam(["resident:nobody"]), /UNKNOWN_RESIDENT_ID/);
  assert.throws(() => buildPlayerTeam([1, 2, 3, 4]), /TEAM_MUST_BE_AT_MOST_3/);
});

test("no growth rule is invented for a resident that has been raised", () => {
  // The original grows a creature through a save structure this product does not
  // have. Rather than deriving levels from raising, the contract records the
  // absence and the module carries no such code.
  assert.match(contract.notDecidedHere.growth, /UNKNOWN_REQUIRES_TRACE/);
  const module = fs.readFileSync(path.join(root, "src/championship/app/battleRosterSource.js"), "utf8");
  const code = module.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["growth", "experience", "levelUp", "age", "training"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(code), false, forbidden);
  }
  // And the encyclopedia ordinal is explicitly not the battle species id.
  assert.match(contract.notDecidedHere.speciesIndex, /are NOT the battle species ids/);
});

test("a built roster drops straight into a battle session and runs", async () => {
  const { createBattleSession, createSessionCombatant, runBattleSession } =
    await import("../src/championship/battle/battleSession.js");
  const { BATTLE_RNG_TRACED_MASTER_SEED, createChannelRng } =
    await import("../src/championship/battle/battleRngChannel.js");

  const roster = buildBattleRoster({
    residentIds: BATTLE_ROSTER_PROFILES.map((profile) => profile.residentId),
    presetIndices: [living[0].recordIndex, living[1].recordIndex, living[2].recordIndex]
  });
  const session = createBattleSession({
    roster: roster.map((creature) => {
      const fields = combatantFieldsFor(creature);
      return fields ? createSessionCombatant({ state: 1, statePeriod: 0, ...fields }) : null;
    }),
    rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED)
  });

  const run = runBattleSession(session, 200);
  assert.equal(run.frames, 200, "nobody is down and the clock has not run out");
  assert.equal(session.clock, 200);
  // Real curve values on both sides.
  for (const slot of session.slots) {
    assert.ok(slot.maxHp >= 200 && slot.maxHp <= 7000, `hp ${slot.maxHp}`);
    assert.ok(slot.metricLimit >= 10 && slot.metricLimit <= 350, `resource ${slot.metricLimit}`);
  }
  assert.equal(combatantFieldsFor(null), null);
});

test("the module imports nothing outside src and the contracts", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/app/battleRosterSource.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
