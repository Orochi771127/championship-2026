// Creature build — where a combatant's stats actually come from.
//
// This is the case file that lets every other number in the lane be observed on
// real inputs. The facts worth guarding: HP is indexed by the SPECIES and the
// other nine stats by the PRESET, nothing is computed, and the one preset that
// carries -1 is unreachable rather than in need of a clamp.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_COMBATANT_SIZE,
  BATTLE_CREATURE_ABSENT_SPECIES,
  BATTLE_CREATURE_BUILD_SITE,
  BATTLE_CREATURE_CURVE,
  BATTLE_CREATURE_CURVE_COLUMNS,
  BATTLE_CREATURE_CURVE_ROWS,
  BATTLE_CREATURE_EVIDENCE,
  BATTLE_CREATURE_HP_COLUMN,
  BATTLE_CREATURE_OPPONENTS_PER_MATCH,
  BATTLE_CREATURE_RESOURCE_COLUMN,
  BATTLE_CREATURE_SIZE,
  BATTLE_CREATURE_SPECIES_COUNT,
  BATTLE_CREATURE_STAT_MAP,
  BATTLE_CREATURE_UNREAD_COLUMN,
  buildCreatureFromPreset,
  buildOpponentTeam,
  creatureStatValue,
  presetHoldsCreature,
  speciesStatCurveIndex
} from "../src/championship/battle/battleCreatureBuild.js";

import { BATTLE_OUTCOME_TEAM_SLOT_COUNT } from "../src/championship/battle/battleOutcome.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const presets = JSON.parse(fs.readFileSync(path.join(root, "src/data/championship/catalogs/battle-presets.r1.json"), "utf8")).records;
const species = JSON.parse(fs.readFileSync(path.join(root, "src/data/championship/catalogs/creature-species.r1.json"), "utf8"));

const lookup = (index) => presets[index] ?? null;
const living = presets.filter((record) => presetHoldsCreature(record));

test("the curve is 27 rows of eight, and its columns are what the builder reads", () => {
  assert.equal(BATTLE_CREATURE_EVIDENCE, "VERIFIED_BINARY");
  assert.equal(BATTLE_CREATURE_BUILD_SITE, "ARM9:0x02062900");
  assert.equal(BATTLE_CREATURE_CURVE_ROWS, 27);
  assert.equal(BATTLE_CREATURE_CURVE_COLUMNS, 8);
  assert.equal(BATTLE_CREATURE_CURVE.length, 27);
  for (const row of BATTLE_CREATURE_CURVE) assert.equal(row.length, 8);

  // Column 0 is the HP column and it ascends the whole way.
  assert.equal(BATTLE_CREATURE_CURVE[0][BATTLE_CREATURE_HP_COLUMN], 200);
  assert.equal(BATTLE_CREATURE_CURVE[26][BATTLE_CREATURE_HP_COLUMN], 7000);
  for (let row = 1; row < 27; row += 1) {
    assert.ok(BATTLE_CREATURE_CURVE[row][0] > BATTLE_CREATURE_CURVE[row - 1][0], `row ${row}`);
  }

  // Columns 1..6 are byte-identical, which is why sharing one changes nothing.
  const reference = BATTLE_CREATURE_CURVE.map((row) => row[BATTLE_CREATURE_RESOURCE_COLUMN]);
  for (let column = 2; column <= 6; column += 1) {
    assert.deepEqual(BATTLE_CREATURE_CURVE.map((row) => row[column]), reference, `column ${column}`);
  }
  // Column 7 exists and the builder never reads it.
  assert.equal(BATTLE_CREATURE_CURVE[0][BATTLE_CREATURE_UNREAD_COLUMN], 4);
  assert.equal(BATTLE_CREATURE_CURVE[26][BATTLE_CREATURE_UNREAD_COLUMN], 20);
  assert.equal(BATTLE_CREATURE_STAT_MAP.some((entry) => entry.column === BATTLE_CREATURE_UNREAD_COLUMN), false);
});

test("the species table is 228 records and the absent id is one past the last", () => {
  assert.equal(BATTLE_CREATURE_SPECIES_COUNT, 0xe4);
  assert.equal(BATTLE_CREATURE_ABSENT_SPECIES, 0xe4);
  assert.equal(BATTLE_CREATURE_ABSENT_SPECIES, BATTLE_CREATURE_SPECIES_COUNT,
    "the marker is the id after the table, not a magic number");
  assert.equal(species.records.length, 228);
  assert.throws(() => speciesStatCurveIndex(228), /UNKNOWN_SPECIES_ID/);

  // Every species indexes inside the curve, which is what makes the HP lookup safe.
  for (const record of species.records) {
    assert.ok(record.statCurveIndex >= 0 && record.statCurveIndex < BATTLE_CREATURE_CURVE_ROWS,
      `species ${record.recordIndex}`);
  }
});

test("every preset in the ROM builds, and HP comes from the species not the preset", () => {
  assert.equal(presets.length, 456);
  assert.equal(living.length, 456 - 27, "27 records name the absent species");

  for (const preset of living) {
    const creature = buildCreatureFromPreset(preset);
    // The HP index is the species record's, so two presets of the same species
    // have the same HP however their other levels differ.
    assert.equal(creature.currentHp, creature.maxHp, "built at full health by construction");
    assert.equal(creature.currentHp,
      creatureStatValue(speciesStatCurveIndex(creature.speciesId), BATTLE_CREATURE_HP_COLUMN));
    assert.equal(creature.metricBase, creature.metricLimit);
  }

  // Same species, different presets: HP identical, resource free to differ.
  const bySpecies = new Map();
  for (const preset of living) {
    const id = preset.field00 & 0xff;
    if (!bySpecies.has(id)) bySpecies.set(id, []);
    bySpecies.get(id).push(preset);
  }
  const shared = [...bySpecies.values()].find((group) => group.length > 1
    && group[0].field14 !== group[1].field14);
  assert.ok(shared, "the ROM has two presets of one species with different levels");
  const [first, second] = shared.map((preset) => buildCreatureFromPreset(preset));
  assert.equal(first.currentHp, second.currentHp, "HP tracks the species");
  assert.notEqual(first.metricBase, second.metricBase, "the resource tracks the preset");
});

test("nothing is computed: every stat is a curve row read back", () => {
  const preset = living[0];
  const creature = buildCreatureFromPreset(preset);
  for (const entry of BATTLE_CREATURE_STAT_MAP) {
    const level = preset[entry.preset];
    const key = `field${entry.value.toString(16).toUpperCase().padStart(2, "0")}`;
    assert.equal(creature.stats[key], BATTLE_CREATURE_CURVE[level][entry.column], entry.preset);
    assert.equal(creature.levels[entry.preset], level, "and the level is kept beside it");
  }
  // field14 is the one level the builder keeps no copy of.
  assert.equal(BATTLE_CREATURE_STAT_MAP.filter((entry) => entry.level === null).length, 1);
  assert.equal(BATTLE_CREATURE_STAT_MAP[0].preset, "field14");
  assert.equal(BATTLE_CREATURE_STAT_MAP.length, 10);
  // The two AI sources are preset bytes, not lookups.
  assert.equal(creature.source12C, preset.field3D);
  assert.equal(creature.source130, preset.field3E);
});

test("the one preset carrying -1 is unreachable rather than in need of a clamp", () => {
  const negative = presets.filter((record) => [
    "field14", "field18", "field1C", "field20", "field24",
    "field28", "field2C", "field30", "field34", "field38"
  ].some((key) => record[key] === -1));
  assert.equal(negative.length, 1, "exactly one record carries a negative level");
  assert.equal(presetHoldsCreature(negative[0]), false, "and it names the absent species");
  assert.throws(() => buildCreatureFromPreset(negative[0]), /PRESET_HOLDS_NO_CREATURE/);
  // The lookup refuses rather than clamping, because the ROM would read outside
  // the table and it is only ever safe because it never gets there.
  assert.throws(() => creatureStatValue(-1, 1), /LEVEL_OUTSIDE_THE_CURVE/);
  assert.throws(() => creatureStatValue(27, 1), /LEVEL_OUTSIDE_THE_CURVE/);
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleCreatureBuild.js"), "utf8");
  assert.match(module, /Do not clamp it, and do not "fix" the -1/);
});

test("a match expands three opponents, and an empty slot stays empty", () => {
  assert.equal(BATTLE_CREATURE_OPPONENTS_PER_MATCH, 3);
  // Three per team, and two teams is the six the frame walks.
  assert.equal(BATTLE_CREATURE_OPPONENTS_PER_MATCH, BATTLE_OUTCOME_TEAM_SLOT_COUNT);

  const indices = [living[0].recordIndex, -1, living[1].recordIndex];
  const team = buildOpponentTeam(indices, lookup);
  assert.equal(team.length, 3);
  assert.ok(team[0] && team[2]);
  assert.equal(team[1], null, "and the third does not shuffle up into the gap");

  // A preset that holds no creature is a gap too.
  const absent = presets.find((record) => !presetHoldsCreature(record));
  assert.equal(buildOpponentTeam([absent.recordIndex, -1, -1], lookup)[0], null);

  assert.throws(() => buildOpponentTeam([1, 2], lookup), /TEAM_MUST_BE_3_LONG/);
  assert.throws(() => buildOpponentTeam([1, 2, 3], null), /LOOKUP_MUST_BE_A_FUNCTION/);
});

test("a built creature drops straight into the battle session's fields", async () => {
  const { createBattleSession, createSessionCombatant, stepBattleSession } =
    await import("../src/championship/battle/battleSession.js");
  const { BATTLE_RNG_TRACED_MASTER_SEED, createChannelRng } =
    await import("../src/championship/battle/battleRngChannel.js");

  const team = buildOpponentTeam([living[0].recordIndex, living[1].recordIndex, living[2].recordIndex], lookup);
  const roster = [...team, ...team].map((creature) => createSessionCombatant({
    state: 1,
    statePeriod: 0,
    currentHp: creature.currentHp,
    maxHp: creature.maxHp,
    metricBase: creature.metricBase,
    metricLimit: creature.metricLimit,
    source12C: creature.source12C,
    source130: creature.source130
  }));

  const session = createBattleSession({ roster, rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED) });
  const stepped = stepBattleSession(session);
  assert.equal(stepped.frame, 1);
  // Real ROM stats, and the traced clock runs over them.
  assert.equal(session.clock, 1);
  assert.ok(session.slots.every((slot) => slot.maxHp >= 200 && slot.maxHp <= 7000));
});

test("the object sizes are the ones the allocators ask for", () => {
  assert.equal(BATTLE_COMBATANT_SIZE, 0x18c);
  assert.equal(BATTLE_CREATURE_SIZE, 0x1c8);
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleCreatureBuild.js"), "utf8");
  assert.match(module, /mov r0, #0x18c/);
});

test("the module imports nothing outside src", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/battle/battleCreatureBuild.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
