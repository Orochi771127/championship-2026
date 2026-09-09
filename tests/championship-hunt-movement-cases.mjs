import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stepNativeHuntMovement, readNativeDirectionAttribute, readNativeTerrainType,
  nativeMovementTile, steerNativeHuntDirection } from "../src/championship/hunt/capture/nativeHuntMovement.js";

const receipt = JSON.parse(fs.readFileSync("docs/research/HUNT_MOVEMENT_REPLAY_2026-09-06.json", "utf8"));
const point = (call, pc) => call.steps.find((s) => s.pc === pc);
function environment(call) {
  const attribute = call.steps.find((s) => s.attribute)?.attribute;
  const grid = call.steps.find((s) => s.terrainGrid).terrainGrid;
  const end = point(call, "0x210e2ac");
  return {
    width: grid.width, height: grid.height, camera: call.before.camera,
    readAttribute(x, y) { assert.deepEqual([x, y], attribute.tile); return attribute.value; },
    readTerrain(x, y) {
      assert.deepEqual([x, y], grid.tile);
      return point(call, "0x210e0c4").r0;
    },
    queryControllers(candidate) {
      assert.deepEqual(candidate, point(call, "0x210e24c").candidateQ12);
      assert.deepEqual(candidate, point(call, "0x210e25c").candidateQ12);
      assert.deepEqual(candidate, point(call, "0x210e268").candidateQ12);
      return { obstacle: end.obstacle, secondaryBlocked: !!end.secondaryBlocked, sideEffectsClosed: true };
    },
  };
}

test("every actual native movement call matches direction, delta, position and actor writes", () => {
  const counts = {};
  for (const call of receipt.calls) {
    const result = stepNativeHuntMovement(call.before, call.mode, environment(call));
    assert.deepEqual(result.state.directionQ12, point(call, "0x210df14").directionQ12, `direction ${call.tick}`);
    assert.deepEqual(result.deltaQ12, point(call, "0x210e070").deltaQ12, `delta ${call.tick}`);
    assert.deepEqual(result.candidateQ12, point(call, "0x210e080").candidateQ12, `candidate ${call.tick}`);
    assert.deepEqual(result.state, call.after, `complete movement writes ${call.tick}`);
    const key = `${call.before.aiState}:${call.mode}`; counts[key] = (counts[key] ?? 0) + 1;
  }
  assert.deepEqual(counts, { "8:3": 206, "8:2": 1, "11:2": 1 });
});

test("native direction and terrain grids reproduce each original observed read", () => {
  let attributes = 0, terrains = 0;
  for (const call of receipt.calls) {
    for (const step of call.steps) {
      if (step.attribute) {
        const a = step.attribute, bytes = new Uint8Array(a.width * a.height);
        if (a.inBounds) bytes[a.tile[1] * a.width + a.tile[0]] = a.value;
        assert.equal(readNativeDirectionAttribute({ ...a, bytes }, ...a.tile), point(call, "0x210d998").r0);
        attributes++;
      }
      if (step.terrainGrid) {
        const g = step.terrainGrid, bytes = new Uint8Array(g.width * g.height);
        if (g.inBounds) bytes[g.tile[1] * g.width + g.tile[0]] = g.rawByte;
        assert.equal(readNativeTerrainType({ ...g, bytes }, ...g.tile), point(call, "0x210e0c4").r0);
        terrains++;
      }
    }
  }
  assert.equal(attributes, 206); assert.equal(terrains, 208);
});

test("unclosed follower, controller and direction cases fail without changing caller state", () => {
  const call = receipt.calls[0], state = structuredClone(call.before), before = structuredClone(state);
  assert.throws(() => stepNativeHuntMovement(state, 3, {}), /PORT_REQUIRED/);
  assert.throws(() => stepNativeHuntMovement({ ...state, followTarget: 1 }, 3, environment(call)), /FOLLOW_MOVEMENT_REQUIRES_TRACE/);
  assert.throws(() => stepNativeHuntMovement(state, 3, { ...environment(call), readAttribute: () => 15 }), /UNASSIGNED_BRANCH_REQUIRES_TRACE/);
  assert.throws(() => stepNativeHuntMovement(state, 3, { ...environment(call), queryControllers: () => ({ obstacle: 2 }) }), /CONTROLLER_BRANCH_REQUIRES_TRACE/);
  assert.deepEqual(state, before);
  assert.deepEqual(nativeMovementTile([-4097, -8 * 4096, 0]), [0, -1]);
});

test("controlled ARM probes verify all direction literals, flag precedence and signed rounding", () => {
  const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_MOVEMENT_CPU_CHECK_2026-09-06.json", "utf8"));
  assert.equal(cpu.directionCases.length, 96);
  for (const c of cpu.directionCases) assert.deepEqual(steerNativeHuntDirection(c.before, c.attribute), c.after, `attribute ${c.attribute}`);
});

test("controlled ARM grid probes verify wrap, outside bounds and ordered terrain bit tests", () => {
  const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_MOVEMENT_CPU_CHECK_2026-09-06.json", "utf8"));
  assert.equal(cpu.gridCases.length, 32);
  for (const c of cpu.gridCases) {
    const grid = { width: 2, height: 2, wrap: c.wrap, bytes: Uint8Array.from(c.bytes) };
    assert.equal(readNativeDirectionAttribute(grid, ...c.tile), c.attribute);
    assert.equal(readNativeTerrainType(grid, ...c.tile), c.terrain);
  }
});


test("entering native escape preserves the literal direction before its first steering blend", async () => {
  const { enterNativeWildState } = await import("../src/championship/hunt/capture/nativeWildActor.js");
  const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_STEERING_STACK_CPU_2026-09-09.json", "utf8"));
  const actor = { aiState:1, bounds:{entityId:"m003_nyokimon"}, bound:0, poisoned:0, blinded:0, sequenceId:null };
  enterNativeWildState(actor,8,{});
  assert.deepEqual(actor.directionQ12,cpu.enter8Direction);
  const observed=receipt.calls.find(call=>call.mode===3);
  assert.deepEqual(actor.directionQ12,observed.before.directionQ12);
  const attr=observed.steps.find(s=>s.attribute).attribute.value;
  assert.deepEqual(steerNativeHuntDirection(actor.directionQ12,attr),point(observed,"0x210deec").directionQ12);
});
