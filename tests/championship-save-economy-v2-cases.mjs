import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAMPIONSHIP_MODERN_SAVE_KEY, CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION,
  createChampionshipModernSave, serializeChampionshipModernSave, deserializeChampionshipModernSave
} from "../src/championship/app/championshipStandaloneSave.js";
import { createRaisingHomeInitialState } from "../src/championship/raising/raisingHomeDefinition.js";
import { serializeRaisingHomeSaveR2, deserializeRaisingHomeSaveR2 } from "../src/championship/raising/raisingHomePersistenceR2.js";
import { createBattleEconomyState, beginBattleAttempt, settleBattleAttempt } from "../src/championship/battle/battleEconomyTransaction.js";
import { SHOP_RECORD_COUNT } from "../src/championship/shop/shopCatalog.js";

const raisingHomeSerialized = serializeRaisingHomeSaveR2(createRaisingHomeInitialState({ sessionId: "save-migration-fixture" })).serialized;
const args = {
  sessionId: "save-migration-fixture",
  creature: { creatureId: "resident-000", speciesId: "species-000", displayName: "Fixture" },
  raisingHomeSerialized,
  raising: { assignments: { "resident-000": "cage-001" }, collection: [{ instanceId: "capture-001", speciesId: "species-008", name: "Owned" }] },
  shop: { bits: 7850, visibility: Array(SHOP_RECORD_COUNT).fill(1), quantities: Array(SHOP_RECORD_COUNT).fill(2), cageOwned: [60] },
  cageEdit: { placements: [{ moduleId: "cage-001", slotIndex: 2 }] },
  progression: { interactionCount: 10, revision: 12, tamerRank: 2 },
  flags: { newGameCompleted: true }, updatedAt: "2026-09-05T01:00:00.000Z"
};

function settled() {
  const entry = beginBattleAttempt(createBattleEconomyState(), { attemptId: "battle:1", matchIndex: 0, mode: 0, battleType: 0, entryFee: 150, payout: 7000 }, 1000);
  return settleBattleAttempt(entry.state, { attemptId: "battle:1", outcomeEntries: [1] }, entry.wallet);
}

test("v1 migrates at the existing key without changing any existing slice or R2 digest", () => {
  const current = createChampionshipModernSave(args);
  const { battleEconomy, instanceIdentity, gameplayRng, huntHistory, ...legacy } = current;
  legacy.schemaVersion = 1;
  const restored = deserializeChampionshipModernSave(JSON.stringify(legacy));
  assert.equal(CHAMPIONSHIP_MODERN_SAVE_KEY, "championshipModernSave:v1");
  assert.equal(CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION, 5);
  assert.equal(restored.schemaVersion, 5);
  assert.deepEqual(restored.instanceIdentity, { nextSequence: 1 });
  assert.deepEqual(restored.battleEconomy, createBattleEconomyState());
  for (const key of Object.keys(legacy).filter((key) => key !== "schemaVersion")) assert.deepEqual(restored[key], legacy[key], key);
  assert.equal(restored.raisingHome, raisingHomeSerialized);
  assert.equal(deserializeRaisingHomeSaveR2(restored.raisingHome).payloadDigest, deserializeRaisingHomeSaveR2(raisingHomeSerialized).payloadDigest);
  assert.deepEqual(deserializeChampionshipModernSave(serializeChampionshipModernSave(restored)), restored);
});

test("v2 wallet and receipt migrate to v5 together; old completion cannot be paid again", () => {
  const result = settled();
  const save = createChampionshipModernSave({ ...args, battleEconomy: result.state });
  const { instanceIdentity, gameplayRng, huntHistory, ...legacy } = save;
  legacy.schemaVersion = 2;
  const migrated = deserializeChampionshipModernSave(JSON.stringify(legacy));
  assert.equal(migrated.schemaVersion, 5);
  assert.deepEqual(migrated.instanceIdentity, { nextSequence: 1 });
  assert.deepEqual(migrated.battleEconomy, save.battleEconomy);
  assert.equal(migrated.raisingHome, raisingHomeSerialized);
  const restored = deserializeChampionshipModernSave(serializeChampionshipModernSave(migrated));
  assert.equal(restored.shop.bits, 7850);
  assert.equal(restored.battleEconomy.lastReceipt.walletAfter, 7850);
  const replay = settleBattleAttempt(restored.battleEconomy, { attemptId: "battle:1", outcomeEntries: [1] }, restored.shop.bits);
  assert.equal(replay.wallet, 7850);
  assert.equal(replay.duplicate, true);
  assert.throws(() => createChampionshipModernSave({ ...args, shop: null, battleEconomy: result.state }), /MISSING_BATTLE_WALLET_SLICE/);
});

test("save constructors, serializers and loaders refuse unfinished battle attempts", () => {
  const entry = beginBattleAttempt(createBattleEconomyState(), { attemptId: "battle:1", matchIndex: 0, mode: 0, battleType: 0, entryFee: 150, payout: 7000 }, 1000);
  assert.throws(() => createChampionshipModernSave({ ...args, battleEconomy: entry.state }), /SAVE_WHILE_BATTLE_ACTIVE/);
  const bypass = { ...createChampionshipModernSave(args), battleEconomy: entry.state };
  assert.throws(() => serializeChampionshipModernSave(bypass), /SAVE_WHILE_BATTLE_ACTIVE/);
  assert.throws(() => deserializeChampionshipModernSave(JSON.stringify(bypass)), /SAVE_WHILE_BATTLE_ACTIVE/);
});

test("unknown fields, malformed histories and missing v2 slices fail closed", () => {
  const save = createChampionshipModernSave({ ...args, battleEconomy: settled().state });
  const mutations = [
    { ...save, battleEconomy: { ...save.battleEconomy, history: [] } },
    { ...save, battleEconomy: { ...save.battleEconomy, nextSequence: 100 } },
    { ...save, battleEconomy: { ...save.battleEconomy, lastReceipt: { ...save.battleEconomy.lastReceipt, evidence: {} } } },
    { ...save, battleEconomy: { ...save.battleEconomy, lastReceipt: { ...save.battleEconomy.lastReceipt, rewardBits: 9999 } } },
    { ...save, surprise: 1 },
    { ...save, schemaVersion: CHAMPIONSHIP_MODERN_SAVE_SCHEMA_VERSION + 1 },
    { ...save, schemaVersion: 1 }
  ];
  for (const mutated of mutations) assert.throws(() => deserializeChampionshipModernSave(JSON.stringify(mutated)));
  const missing = { ...save };
  delete missing.battleEconomy;
  assert.throws(() => deserializeChampionshipModernSave(JSON.stringify(missing)), /MISSING_BATTLE_ECONOMY_SLICE/);
  const missingSequence = JSON.parse(JSON.stringify(save));
  delete missingSequence.battleEconomy.lastReceipt.sequence;
  assert.throws(() => deserializeChampionshipModernSave(JSON.stringify(missingSequence)), /INVALID_BATTLE_RECEIPT_SEQUENCE/);
});

test("the existing 64 KiB and nested forensic boundary still applies after migration", () => {
  assert.throws(() => createChampionshipModernSave({ ...args, raising: { provenance: "forbidden" } }), /FORENSIC_CATALOG_IN_PLAYER_SAVE/);
  const oversized = createChampionshipModernSave({ ...args, raising: { note: "x".repeat(65536) } });
  assert.throws(() => serializeChampionshipModernSave(oversized), /SAVE_EXCEEDS_BYTE_BUDGET/);
  assert.throws(() => deserializeChampionshipModernSave(JSON.stringify(oversized)), /SAVE_EXCEEDS_BYTE_BUDGET/);
});
