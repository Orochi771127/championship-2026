import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { restoreLegacyIndividual } from "./fixtures/championship-legacy-collection.mjs";
const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
function memoryStorage() {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
}
const createApp = (storage, extra = {}) => createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages, ...extra });
async function enterHunt(app) {
  app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate(); await app.beginHunt();
}
function circle(app, target) {
  assert.equal(app.beginEnclosureStroke(target.worldX, target.worldY), true);
  for (const [dx, dy] of [[36, 0], [36, 36], [-36, 36], [-36, -36], [36, -36], [2, 2]]) {
    app.extendEnclosureStroke(target.worldX + dx, target.worldY + dy);
  }
}
for (const ending of ["release", "cancel", "exit", "back"]) {
  test(`a diagnostic circle followed by ${ending} cannot allocate, register, remove or save an individual`, async () => {
    const storage = memoryStorage(), app = createApp(storage);
    await app.newGame();
    const legacy = await restoreLegacyIndividual(app, storage, "Existing");
    app.save();
    const saved = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
    const raising = app.getRaisingState(), identity = app.getInstanceIdentityState();
    await enterHunt(app);
    const runtime = app.getHuntRuntime(), wilds = runtime.getWildCreatures();
    circle(app, wilds[0]);
    if (ending === "release") {
      assert.equal(app.endEnclosureStroke().outcome, "TOOL_TRACE_REQUIRED");
      assert.equal(app.endEnclosureStroke(), null);
      assert.equal(app.getScreen(), "HUNT_FIELD");
    } else if (ending === "cancel") {
      assert.equal(app.abortEnclosureStroke(), true);
      assert.equal(app.abortEnclosureStroke(), false);
      assert.equal(app.endEnclosureStroke(), null);
    } else if (ending === "exit") app.exitHunt();
    else app.leaveScreen();
    assert.deepEqual(runtime.getWildCreatures(), wilds);
    assert.equal(runtime.getEnclosureStroke(), null);
    assert.equal(app.getRaisingState(), raising);
    assert.equal(app.getInstanceIdentityState(), identity);
    assert.equal(app.getHuntResult(), null);
    assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), saved);
    if (app.getScreen() === "HUNT_FIELD") app.exitHunt();
    app.save();
    await app.dispose();
    const reloaded = createApp(storage);
    await reloaded.continueGame();
    assert.equal(reloaded.getScreen(), "RAISING_HOME");
    assert.deepEqual(reloaded.getRaisingState(), raising);
    assert.equal(reloaded.resolveRaisingInstance(legacy.instanceId).source.successAuthority, "PRODUCT_AUTHORED_ENCLOSURE");
    await reloaded.dispose();
  });
}
test("native initial HP and no card cannot turn a circle into a capacity check or a collected creature", async () => {
  const app = createApp(memoryStorage(), { huntStartingInventory: [] });
  await app.newGame(); await enterHunt(app);
  const source = createGateHuntPresentationSource(app);
  const view = source.field.getView({ viewportWidth: 390, viewportHeight: 844 });
  const target = view.wildCreatures[0];
  assert.ok(Number.isInteger(target.currentHp) && target.currentHp > 0);
  assert.equal(target.hpEvidence,"NATIVE_NORMAL_HUNT_CONTROLLER");
  assert.equal(view.captureAvailability.canCollect, false);
  assert.equal(source.intents.selectWildAt(target.worldX, target.worldY), true);
  circle(app, target);
  assert.equal(source.intents.endEnclosureStroke().screen, "HUNT_FIELD");
  assert.equal(app.getRaisingState().collection.length, 0);
  assert.equal(source.intents.moveTo, undefined);
  assert.throws(() => app.setHuntResultName("Premature"), /HUNT_RESULT_NOT_ACTIVE/);
  await app.dispose();
});
