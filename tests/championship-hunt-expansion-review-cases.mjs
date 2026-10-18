// Hunt expansion review (Owner 2026-10-19, local): HM01 Grass grows by a
// 48-tile east zone; the original grid stays at the origin, untouched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { resolveNativeHuntEnvironment, NATIVE_HUNT_EXPANSION_ADAPTATION } from "../src/championship/hunt/capture/nativeHuntSceneSources.js";
import { createFieldDefinition } from "../src/championship/field/fieldDefinition.js";
import { getFieldFamilyProfile } from "../src/data/championship/r2/fields/fieldInventoryR2.js";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const expansion = read("src/data/championship/catalogs/hunt-expansion.review-20261019.json");
const catalog = read("src/data/championship/catalogs/creature-species.r1.json");
const { cages } = read("docs/contracts/championship/raising-home-presentation.v1.json");
const store = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }; };

test("the expanded HM01 environments keep every original cell and move escape exits to the new edge", () => {
  assert.equal(expansion.adaptation, NATIVE_HUNT_EXPANSION_ADAPTATION);
  for (const fieldId of ["field_hm01_01", "field_hm01_02"]) {
    const base = resolveNativeHuntEnvironment(fieldId), env = resolveNativeHuntEnvironment(fieldId, { expansion });
    assert.equal(base.width, 128); assert.equal(env.width, 176); assert.equal(env.height, 128);
    assert.equal(env.adaptation, NATIVE_HUNT_EXPANSION_ADAPTATION);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) assert.equal(env.readTerrain(x, y), base.readTerrain(x, y));
    assert.equal(env.readTerrain(176, 10), 1); assert.equal(env.readTerrain(-1, 10), 1);
    let exits = 0, open = 0, clearedWhereOpen = true;
    for (let y = 0; y < 128; y++) {
      if (env.readDirectionCell(175, y).escapeBoundary) { exits++; assert.notEqual(env.readTerrain(175, y), 1); }
      if (env.readTerrain(127, y) !== 1 && env.readTerrain(128, y) !== 1 && env.readDirectionCell(127, y).escapeBoundary) clearedWhereOpen = false;
      for (let x = 128; x < 176; x++) if (!env.isBlocked(x, y)) open++;
    }
    assert.ok(exits >= 20, `${fieldId} east exits`); assert.ok(clearedWhereOpen); assert.ok(open > 4000);
  }
  // a foreign or malformed document is ignored
  assert.equal(resolveNativeHuntEnvironment("field_hm01_01", { expansion: { ...expansion, adaptation: "X" } }).width, 128);
});

test("the field kernel refuses oversized hunt fields unless the expansion review is named", () => {
  const profile = getFieldFamilyProfile("HM");
  const draft = { schemaVersion: 2, fieldId: "championship:2026:r2:field:hm-expansion-test", family: "HM", collisionProfileId: profile.profileId,
    dimensions: { widthTiles: 176, heightTiles: 128 }, tileSizePx: 16, chunkSizeTiles: 16,
    collisionData: { kind: "HM_SANITIZED_ATTRIBUTE_GRID", values: new Array(176 * 128).fill(0) } };
  assert.throws(() => createFieldDefinition(draft, profile), /exactly 128 by 128/);
  assert.equal(createFieldDefinition(draft, profile, { hmExpansion: NATIVE_HUNT_EXPANSION_ADAPTATION }).dimensions.widthTiles, 176);
  assert.throws(() => createFieldDefinition(draft, profile, { hmExpansion: "OTHER" }), /exactly 128 by 128/);
});

test("a normal Grass hunt with the review loader enters the wider world; without it the original stays", async () => {
  const appFor = huntExpansionLoader => createChampionshipStandaloneApp({ storage: store(), locks: null, catalog, cages,
    rngClock: () => ({ hour: 13, minute: 20, second: 50 }), huntExpansionLoader });
  async function enter(app) {
    app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate();
    return await app.beginHunt();
  }
  const wide = appFor(async () => expansion);
  await wide.newGame(); await enter(wide);
  assert.equal(wide.getHuntEntryError(), null);
  const world = wide.getHuntRuntime().world;
  assert.ok(world.nativeEntry);
  assert.equal(world.widthTiles, 176); assert.equal(world.worldWidthPx, 176 * 16); assert.equal(world.definition.dimensions.widthTiles, 176);
  for (const w of world.wildCreatures) {
    assert.ok(w.worldX >= 0 && w.worldX < 176 * 16 && w.worldY >= 0 && w.worldY < 128 * 16);
    assert.equal(world.isBlockedTile(Math.floor(w.worldX / 16), Math.floor(w.worldY / 16)), false);
  }
  wide.getHuntRuntime().tick(1000);
  const plain = appFor(null);
  await plain.newGame(); await enter(plain);
  assert.equal(plain.getHuntRuntime().world.widthTiles, 128);
});
