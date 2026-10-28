// Hunt rope roles, combos and overheat (Owner direction 2026-10-28). The
// native rope writer stays as traced; these check the adaptation around it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import tools from "../src/data/championship/catalogs/hunt-tools.r1.json" with { type: "json" };
import { HUNT_ROPE_TACTICS as T, createHuntRopeTactics, huntRopeBindRule, huntRopeCoefficient, huntRopeCrossesBlocked,
  huntRopeRole, huntRopeWear, huntTacticalRope } from "../src/championship/hunt/capture/huntRopeTactics.js";
import { nativeHuntToolSpecies, nativeRopeParameters, nativeRopeRow, stepNativeRopeController } from "../src/championship/hunt/capture/nativeHuntToolRules.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";

const species = generation => ({ generation, effectiveness: [1] });
const speciesOfGeneration = generation => tools.species.find(row => row.generation === generation && row.effectiveness[0] >= 1);

test("three tiers per role in shop order", () => {
  assert.deepEqual([0, 2, 3, 5, 6, 8, 9, 11].map(huntRopeRole), ["SWIFT", "SWIFT", "TOUGH", "TOUGH", "CLONE", "CLONE", "ULTIMATE", "ULTIMATE"]);
});

test("ROM rows stay; each role adds only its own reach", () => {
  for (let rope = 0; rope < 12; rope++) {
    for (let generation = 1; generation <= 5; generation++) {
      const native = nativeRopeRow(rope).coefficients[generation - 1][0];
      if (native > 0) assert.equal(huntRopeCoefficient(nativeRopeRow(rope), species(generation)), native, `rope ${rope} gen ${generation}`);
    }
  }
  assert.ok(huntRopeCoefficient(nativeRopeRow(0), species(3)) > 0, "捕捉繩 reaches 成長期");
  assert.equal(huntRopeCoefficient(nativeRopeRow(0), species(4)), 0);
  assert.ok(huntRopeCoefficient(nativeRopeRow(3), species(4)) > 0, "強力繩 reaches 成熟期");
  assert.equal(huntRopeCoefficient(nativeRopeRow(6), species(5)), 0, "only 究極繩 takes 完全體");
  assert.ok(huntRopeCoefficient(nativeRopeRow(9), species(6)) > 0, "究極繩 takes 究極體");
  assert.equal(huntRopeCoefficient(nativeRopeRow(8), species(6)), 0);
});

test("究極繩 throws off 幼年期 and 成長期", () => {
  for (const generation of [1, 2, 3]) assert.equal(huntRopeBindRule(10, generation), "REPEL");
  for (const generation of [4, 5, 6]) assert.equal(huntRopeBindRule(10, generation), "BIND");
  for (const rope of [0, 4, 7]) assert.equal(huntRopeBindRule(rope, 1), "BIND");
});

test("role adjustments: swift pulls harder, clone is fragile awake, ultimate rages", () => {
  const row = speciesOfGeneration(2);
  const native = nativeRopeParameters(1, row.speciesIndex, 120);
  const swift = huntTacticalRope(native, { nativeItemIndex: 1, generation: 2, maxHp: 120, coefficient: 1, pacified: false, rage: false });
  assert.equal(swift.damageQ12, Math.round(native.damageQ12 * T.swiftDamageScale));
  const cloneNative = nativeRopeParameters(7, row.speciesIndex, 120);
  const awake = huntTacticalRope(cloneNative, { nativeItemIndex: 7, generation: 2, maxHp: 120, coefficient: 1, pacified: false, rage: false });
  const calm = huntTacticalRope(cloneNative, { nativeItemIndex: 7, generation: 2, maxHp: 120, coefficient: 1, pacified: true, rage: false });
  assert.equal(awake.baseDurability, Math.trunc(cloneNative.baseDurability * T.cloneAwakeTolerance));
  assert.equal(calm.baseDurability, cloneNative.baseDurability);
  assert.equal(awake.fragile, true);
  // A role's extra row fills a zero native rate with the same formula.
  const rookie = speciesOfGeneration(3);
  const zero = nativeRopeParameters(0, rookie.speciesIndex, 200);
  assert.equal(zero.damageQ12, 0);
  const reach = huntTacticalRope(zero, { nativeItemIndex: 0, generation: 3, maxHp: 200,
    coefficient: huntRopeCoefficient(nativeRopeRow(0), rookie), pacified: true, rage: false });
  assert.ok(reach.damageQ12 > 0);
  const ultimate = huntTacticalRope(nativeRopeParameters(11, speciesOfGeneration(5).speciesIndex, 300),
    { nativeItemIndex: 11, generation: 5, maxHp: 300, coefficient: 50, pacified: false, rage: true });
  assert.equal(ultimate.rage, true);
});

function pull(rope, { dx = 90, blocked = false } = {}) {
  return stepNativeRopeController(rope, 100, { dxQ12: dx * 4096, dyQ12: 0, movementBlocked: blocked }).rope;
}

test("wear: tough halves terrain, rage doubles, a two-partner loop never snaps", () => {
  const row = speciesOfGeneration(2);
  const make = (index, extra = {}) => huntTacticalRope(nativeRopeParameters(index, row.speciesIndex, 100),
    { nativeItemIndex: index, generation: 2, maxHp: 100, coefficient: 50, pacified: true, rage: false, ...extra });
  const run = (rope, ticks, options) => {
    let current = rope;
    for (let i = 0; i < ticks && current.band !== "BROKEN"; i++) current = huntRopeWear(current, pull(current, options), options);
    return current;
  };
  const swift = run(make(2), 30, { terrainCrossed: true });
  const tough = run(make(5), 30, { terrainCrossed: true });
  const swiftLoss = make(2).durability - swift.durability, toughLoss = make(5).durability - tough.durability;
  assert.ok(toughLoss < swiftLoss, `tough ${toughLoss} < swift ${swiftLoss}`);
  // Same state, one pull: a raging partner tears twice the native wear (the
  // native over-cap decay depends on durability, so compare tick by tick).
  const settled = run(make(11), 3, {});
  const calmTick = settled.durability - huntRopeWear(settled, pull(settled), {}).durability;
  const ragingState = { ...settled, rage: true };
  assert.equal(ragingState.durability - huntRopeWear(ragingState, pull(ragingState), {}).durability, 2 * calmTick);
  let held = { ...make(3), durability: 2 };
  for (let i = 0; i < 20; i++) held = huntRopeWear(held, pull(held), { groupHold: true });
  assert.notEqual(held.band, "BROKEN");
  assert.equal(held.durability >= 1, true);
  const snapped = huntRopeWear(make(3), pull(make(3), { dx: 200 }), { overstretched: true, groupHold: true });
  assert.equal(snapped.band, "BROKEN", "pulling past the snap distance still breaks it");
});

test("the rope line reads blocked ground", () => {
  assert.equal(huntRopeCrossesBlocked([0, 0], [64 * 4096, 0], (x) => x > 30 && x < 40), true);
  assert.equal(huntRopeCrossesBlocked([0, 0], [64 * 4096, 0], () => false), false);
});

function actor(id, generation, extra = {}) {
  return { wildId: id, speciesIndex: generation, actorActive: true, aiState: 1, currentHp: 100, bound: 0, ...extra };
}

test("guard, chain and overheat memory", () => {
  const tactics = createHuntRopeTactics({ generationOf: index => index });
  const boss = actor("boss", 5), small = actor("small", 2);
  tactics.observe([boss, small]);
  assert.equal(tactics.guard(boss), T.guardMax);
  assert.equal(tactics.rage(small), false, "only 完全體 / 究極體 rage");
  let broke = [];
  for (let i = 0; i < 3; i++) {
    boss.aiState = 9; broke = broke.concat(tactics.observe([boss], { shotItemIndex: 2 }));
    boss.aiState = 1; tactics.observe([boss]);
  }
  assert.equal(tactics.guard(boss), 0, "three rapid shots break the guard");
  assert.deepEqual(broke.map(e => e.kind), ["GUARD_BROKEN"]);
  // Lure, trap, rope: a perfect chain, doubled by a clone imprint.
  const target = actor("target", 3);
  target.aiState = 5; tactics.observe([target]);
  target.aiState = 16; tactics.observe([target]);
  assert.equal(tactics.pacified(target), true);
  tactics.ropeDowned(target, "CLONE");
  const combo = tactics.settle(target);
  assert.equal(combo.rank, "PERFECT");
  assert.equal(combo.bits, T.comboBitsPerGeneration.PERFECT * 3 * T.imprintScale);
  assert.equal(tactics.settle(target), combo, "a chain pays once");
  const plain = actor("plain", 2);
  tactics.observe([plain]);
  tactics.ropeDowned(plain, "SWIFT");
  assert.equal(tactics.settle(plain).rank, null);
  tactics.overheat("rope-a");
  assert.equal(tactics.overheatTicks("rope-a"), T.overheatTicks);
  for (let i = 0; i < 100; i++) tactics.observe([]);
  assert.equal(tactics.overheatTicks("rope-a"), T.overheatTicks - 100);
  assert.equal(tactics.overheatTicks("rope-b"), 0);
});

// ------------------------------------------------- the real Hunt, end to end

const FRAME = 1000 * 560190 / 33513982;
const ROPE = n => `championship:2026:hunt-item:rope-${["i", "ii", "iii"][n] ?? String(n).padStart(2, "0")}`;

async function huntWith(ropes, equip) {
  const saved = new Map(), storage = { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) };
  const app = createChampionshipStandaloneApp({ storage, catalog: JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8")),
    cages: JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8")).cages, rngClock: () => ({ hour: 13, minute: 20, second: 50 }),
    huntStartingInventory: [...ropes.map(n => ({ itemId: ROPE(n), quantity: 1 })), { itemId: "championship:2026:hunt-memory:card-32", quantity: 1 }] });
  await app.newGame(); app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate();
  app.selectHuntEquipment("ROPE", ROPE(equip)); await app.beginHunt();
  const runtime = app.getHuntRuntime();
  assert.equal(runtime.selectTool("ROPE"), true);
  return { app, runtime };
}
function lasso(runtime, wildId, notices) {
  const at = () => runtime.getWildCreatures().find(w => w.wildId === wildId);
  for (let i = 0; i <= 16; i++) {
    const p = at(), angle = (i / 16) * Math.PI * 2, x = p.worldX + 70 * Math.cos(angle), y = p.worldY - 10 + 70 * Math.sin(angle);
    if (i === 0) runtime.toolPointerDown(x, y); else runtime.toolPointerMove(x, y);
    runtime.tick(FRAME); notices.add(runtime.getToolState().notice);
  }
  const p = at(); runtime.toolPointerUp(p.worldX + 70, p.worldY - 10);
  for (let i = 0; i < 40; i++) { runtime.tick(FRAME); notices.add(runtime.getToolState().notice); }
  return at();
}

test("a live hunt: the ultimate rope throws off a small partner, a spare rope binds it, a snapped rope overheats", async () => {
  const { runtime } = await huntWith([0, 11], 11);
  const small = runtime.getWildCreatures().find(w => nativeHuntToolSpecies(w.speciesIndex).generation <= 3);
  assert.ok(small, "the grass gate has a 幼年期 / 成長期 partner");
  let tool = runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(tool.role, "ULTIMATE"); assert.equal(tool.spares, 1);
  const notices = new Set();
  assert.equal(lasso(runtime, small.wildId, notices).bound, false, "too much force: no bind");
  assert.ok(notices.has("ROPE_TOO_HEAVY"));
  assert.equal(runtime.cycleRope(), true);
  tool = runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(tool.role, "SWIFT");
  for (let i = 0; i < 200; i++) runtime.tick(FRAME); // let the startled partner settle
  const caught = lasso(runtime, small.wildId, new Set());
  assert.equal(caught.bound, true, "the light rope binds it");
  // Pull far past the snap distance: the rope breaks and overheats.
  runtime.toolPointerDown(caught.worldX, caught.worldY - 10); runtime.tick(FRAME);
  runtime.toolPointerMove(caught.worldX + 500, caught.worldY); runtime.tick(FRAME); runtime.tick(FRAME);
  assert.equal(runtime.getToolState().notice, "ROPE_BROKEN");
  runtime.toolPointerUp(caught.worldX + 500, caught.worldY); runtime.tick(FRAME);
  tool = runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.ok(tool.overheatSeconds > 0, "the broken rope is cooling");
  const p = runtime.getWildCreatures().find(w => w.wildId === small.wildId);
  runtime.toolPointerDown(p.worldX, p.worldY); runtime.tick(FRAME);
  assert.equal(runtime.getToolState().notice, "ROPE_OVERHEATED");
  runtime.toolPointerUp(p.worldX, p.worldY);
  assert.equal(runtime.cycleRope(), true, "a spare can be swapped in at once");
  tool = runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(tool.role, "ULTIMATE"); assert.equal(tool.overheatSeconds, 0);
});
