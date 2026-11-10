// Hunt rope roles, combos and overheat (Owner direction 2026-10-28). The native rope writer stays as
// traced. HUNT_ROPE_ORIGINAL_20261111: the Owner took the role bonuses back out -- every rope binds,
// pulls and wears exactly as the native rope; reach rows, counted ropes and the lure chain remain.
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

test("every rope binds: no role throws a partner off (HUNT_ROPE_ORIGINAL_20261111)", () => {
  for (let rope = 0; rope < 12; rope++) for (let generation = 1; generation <= 6; generation++) assert.equal(huntRopeBindRule(rope, generation), "BIND");
});

test("no role bonus: damage and durability are the native rope's own", () => {
  const row = speciesOfGeneration(2);
  const native = nativeRopeParameters(1, row.speciesIndex, 120);
  const swift = huntTacticalRope(native, { nativeItemIndex: 1, generation: 2, maxHp: 120, coefficient: 1, pacified: false, rage: false });
  assert.equal(swift.damageQ12, native.damageQ12, "捕捉繩 pulls no harder than the native rope");
  const cloneNative = nativeRopeParameters(7, row.speciesIndex, 120);
  const awake = huntTacticalRope(cloneNative, { nativeItemIndex: 7, generation: 2, maxHp: 120, coefficient: 1, pacified: false, rage: false });
  assert.equal(awake.baseDurability, cloneNative.baseDurability, "克隆繩 keeps its full durability awake");
  assert.equal(awake.durability, cloneNative.durability);
  assert.equal(awake.fragile, false);
  // A role's extra reach row still fills a zero native rate with the native formula.
  const rookie = speciesOfGeneration(3);
  const zero = nativeRopeParameters(0, rookie.speciesIndex, 200);
  assert.equal(zero.damageQ12, 0);
  const reach = huntTacticalRope(zero, { nativeItemIndex: 0, generation: 3, maxHp: 200,
    coefficient: huntRopeCoefficient(nativeRopeRow(0), rookie), pacified: true, rage: false });
  assert.ok(reach.damageQ12 > 0);
  const ultimate = huntTacticalRope(nativeRopeParameters(11, speciesOfGeneration(5).speciesIndex, 300),
    { nativeItemIndex: 11, generation: 5, maxHp: 300, coefficient: 50, pacified: false, rage: true });
  assert.equal(ultimate.rage, false, "no rage guard");
});

function pull(rope, { dx = 90, blocked = false } = {}) {
  return stepNativeRopeController(rope, 100, { dxQ12: dx * 4096, dyQ12: 0, movementBlocked: blocked }).rope;
}

test("wear is the native controller's alone: no terrain, rage or two-partner rules", () => {
  const row = speciesOfGeneration(2);
  for (const index of [2, 5, 8, 11]) {
    const rope = huntTacticalRope(nativeRopeParameters(index, row.speciesIndex, 100),
      { nativeItemIndex: index, generation: 2, maxHp: 100, coefficient: 50, pacified: true, rage: false });
    for (const options of [{}, { terrainCrossed: true }, { movementBlocked: true }, { groupHold: true }, { overstretched: true }]) {
      const next = pull(rope, { blocked: !!options.movementBlocked });
      assert.equal(huntRopeWear({ ...rope, rage: true }, next, options), next, `rope ${index} ${JSON.stringify(options)}`);
    }
  }
  const snapped = pull(nativeRopeParameters(3, row.speciesIndex, 100), { dx: 200 });
  assert.equal(huntRopeWear(snapped, snapped, { groupHold: true }).band, "BROKEN", "past the snap distance a rope breaks");
});

test("the rope line reads blocked ground", () => {
  assert.equal(huntRopeCrossesBlocked([0, 0], [64 * 4096, 0], (x) => x > 30 && x < 40), true);
  assert.equal(huntRopeCrossesBlocked([0, 0], [64 * 4096, 0], () => false), false);
});

function actor(id, generation, extra = {}) {
  return { wildId: id, speciesIndex: generation, actorActive: true, aiState: 1, currentHp: 100, bound: 0, ...extra };
}

test("chain and overheat memory; no rage guard to break", () => {
  const tactics = createHuntRopeTactics({ generationOf: index => index });
  const boss = actor("boss", 5), small = actor("small", 2);
  tactics.observe([boss, small]);
  assert.equal(tactics.guard(boss), 0, "完全體 / 究極體 start without a guard");
  assert.equal(tactics.rage(boss), false);
  let broke = [];
  for (let i = 0; i < 3; i++) {
    boss.aiState = 9; broke = broke.concat(tactics.observe([boss], { shotItemIndex: 2 }));
    boss.aiState = 1; tactics.observe([boss]);
  }
  assert.deepEqual(broke, [], "nothing to break");
  // Lure, trap, rope: a perfect chain; no clone imprint doubles it any more.
  const target = actor("target", 3);
  target.aiState = 5; tactics.observe([target]);
  target.aiState = 16; tactics.observe([target]);
  assert.equal(tactics.pacified(target), true);
  tactics.ropeDowned(target, "CLONE");
  const combo = tactics.settle(target);
  assert.equal(combo.rank, "PERFECT");
  assert.equal(combo.imprint, false);
  assert.equal(combo.bits, T.comboBitsPerGeneration.PERFECT * 3);
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

test("a live hunt: the ultimate rope binds a small partner too, and a snapped rope is replaced", async () => {
  const { runtime } = await huntWith([0, 11], 11);
  const small = runtime.getWildCreatures().find(w => nativeHuntToolSpecies(w.speciesIndex).generation <= 3);
  assert.ok(small, "the grass gate has a 幼年期 / 成長期 partner");
  let tool = runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(tool.role, "ULTIMATE"); assert.equal(tool.spares, 1);
  const notices = new Set();
  const caught = lasso(runtime, small.wildId, notices);
  assert.equal(caught.bound, true, "HUNT_ROPE_ORIGINAL_20261111: no rope throws a partner off");
  assert.equal(notices.has("ROPE_TOO_HEAVY"), false);
  // Pull far past the snap distance: the rope snaps. Since HUNT_TOOL_TIERS_20261103 ropes
  // are counted, so the snapped one is spent and the next is tied on in 0.25 s.
  runtime.toolPointerDown(caught.worldX, caught.worldY - 10); runtime.tick(FRAME);
  runtime.toolPointerMove(caught.worldX + 500, caught.worldY); runtime.tick(FRAME); runtime.tick(FRAME);
  assert.equal(runtime.getToolState().notice, "ROPE_REPLACED");
  runtime.toolPointerUp(caught.worldX + 500, caught.worldY); runtime.tick(FRAME);
  tool = runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(tool.stock, 14, "one rope spent");
  assert.equal(tool.overheatSeconds, 0, "tying on the next rope is no cooldown");
  assert.equal(tool.swapping, true);
  for (let i = 0; i < 16; i++) runtime.tick(FRAME);
  assert.equal(runtime.getToolState().tools.find(t => t.id === "ROPE").swapping, false);
  assert.equal(runtime.cycleRope(), true, "a spare can be swapped in at once");
  tool = runtime.getToolState().tools.find(t => t.id === "ROPE");
  assert.equal(tool.role, "SWIFT"); assert.equal(tool.overheatSeconds, 0);
});

test("HUNT_ROPE_ORIGINAL_20261111: a loop drawn between two ticks is still read -- every pointer move is a sample", async () => {
  const { runtime } = await huntWith([0], 0);
  const target = runtime.getWildCreatures().find(w => nativeHuntToolSpecies(w.speciesIndex).generation <= 3) ?? runtime.getWildCreatures()[0];
  const cx = target.worldX, cy = target.worldY - 10;
  // A slow browser frame: the whole loop arrives as pointer moves with no tick in between.
  runtime.toolPointerDown(cx + 70, cy);
  for (let i = 1; i <= 18; i++) { const a = (i / 16) * Math.PI * 2; runtime.toolPointerMove(cx + 70 * Math.cos(a), cy + 70 * Math.sin(a)); }
  runtime.toolPointerUp(cx + 70, cy);
  for (let i = 0; i < 40; i++) runtime.tick(FRAME);
  assert.equal(runtime.getWildCreatures().find(w => w.wildId === target.wildId).bound, true);
});
