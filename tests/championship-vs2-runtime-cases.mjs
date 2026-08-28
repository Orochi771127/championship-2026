// VS2 -- Gate Select to Hunt exploration and return.
//
// These cases pin the two things VS2 must get right: the preserved structure
// (a 128x128 modular world traversed by a camera, the ROM-verified collision
// bound, the ROM-verified Hunt toolbar mode) and the refusals (no capture
// surface, no invented terrain taxonomy, no wild creature that reacts to the
// player, no new save field).

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import {
  CHAMPIONSHIP_SCREENS,
  CHAMPIONSHIP_SCREEN_STACK_MAX_DEPTH,
  createChampionshipScreenStack
} from "../src/championship/app/championshipScreenStack.js";
import { GATE_COUNT, listChampionshipGates } from "../src/championship/gate/gateCatalog.js";
import { HUNT_WILD_COUNT, createHuntWorld } from "../src/championship/hunt/huntWorld.js";
import {
  HUNT_WILD_WANDER_RADIUS_PX,
  createHuntRuntime
} from "../src/championship/hunt/huntRuntime.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/entities.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()].sort(); }
  };
}

function createApp(storage) {
  return createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: presentation.cages,
    now: () => "2026-08-28T12:00:00.000Z"
  });
}

// The tamer walks the Hunt field. The HUD creature panel describes the WILD
// target, so the field actor is never a creature the player brought.
const fieldActor = { actorId: "championship:2026:actor:tamer", displayName: "Tamer" };

// ---------------------------------------------------------------------------
// Screen stack
// ---------------------------------------------------------------------------

test("the screen stack allows only declared transitions", () => {
  const stack = createChampionshipScreenStack();
  assert.equal(stack.current(), CHAMPIONSHIP_SCREENS.RAISING_HOME);

  // Skipping a screen is refused, not silently allowed.
  assert.throws(() => stack.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD), /ILLEGAL_SCREEN_TRANSITION/);
  assert.throws(() => stack.enter(CHAMPIONSHIP_SCREENS.HUNT_LOADOUT), /ILLEGAL_SCREEN_TRANSITION/);
  assert.throws(() => stack.enter("SHOP"), /UNKNOWN_SCREEN/);

  stack.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
  stack.enter(CHAMPIONSHIP_SCREENS.HUNT_LOADOUT);
  stack.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD);
  assert.equal(stack.depth(), CHAMPIONSHIP_SCREEN_STACK_MAX_DEPTH);
  assert.deepEqual([...stack.trail()], ["RAISING_HOME", "GATE_SELECT", "HUNT_LOADOUT", "HUNT_FIELD"]);
});

test("the screen stack pops one level and unwinds only where an exit is declared", () => {
  const stack = createChampionshipScreenStack();
  stack.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
  assert.equal(stack.canExit(), false, "only the Hunt field declares an exit");
  assert.throws(() => stack.exit(), /SCREEN_HAS_NO_EXIT/);
  assert.equal(stack.back(), CHAMPIONSHIP_SCREENS.RAISING_HOME);

  // A stray back at the root is a no-op, never an empty stack.
  assert.equal(stack.back(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(stack.depth(), 1);

  stack.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
  stack.enter(CHAMPIONSHIP_SCREENS.HUNT_LOADOUT);
  stack.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD);
  assert.equal(stack.exit(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(stack.depth(), 1, "leaving the field unwinds rather than popping to the loadout");
});

// ---------------------------------------------------------------------------
// Gate catalog
// ---------------------------------------------------------------------------

test("the gate list preserves the reference-backed count and invents no unlock rule", () => {
  const gates = listChampionshipGates();
  assert.equal(gates.length, GATE_COUNT);
  assert.equal(GATE_COUNT, 16, "16 biome node pairs is the ROM-verified structural fact");
  assert.equal(new Set(gates.map((gate) => gate.gateId)).size, 16, "gate ids must be unique");
  for (const gate of gates) {
    assert.equal(gate.state, "AVAILABLE", "no gate may be locked while no unlock rule is traced");
    assert.equal(gate.stateEvidence, "UNKNOWN_REQUIRES_TRACE");
    // The identity is recovered from the ROM model; the display string is not.
    assert.equal(gate.identityEvidence, "ROM_VERIFIED");
    assert.equal(gate.displayNameEvidence, "PRESENTATION_DEFAULT_NOT_RECOVERED");
    assert.equal(gate.originalFieldMapping, "UNKNOWN_REQUIRES_TRACE");
    assert.ok(Number.isSafeInteger(gate.worldSeed));
  }
});

// ---------------------------------------------------------------------------
// Hunt world: preserved structure
// ---------------------------------------------------------------------------

test("every gate builds a 128x128 world that is deterministic, connected and distinct", () => {
  const seen = new Set();
  for (const gate of listChampionshipGates()) {
    const world = createHuntWorld(gate);
    assert.equal(world.widthTiles, 128);
    assert.equal(world.heightTiles, 128);
    assert.equal(world.worldWidthPx, 2048);
    assert.equal(world.worldHeightPx, 2048);

    assert.equal(world.isBlockedTile(world.spawn.tileX, world.spawn.tileY), false, "spawn must be walkable");
    // A field the player cannot cross is not an explorable field.
    assert.ok(world.reachableTileCount > 8000, `${gate.gateId} reachable region collapsed`);

    for (const wild of world.wildCreatures) {
      assert.equal(world.isReachableTile(wild.tileX, wild.tileY), true, "a wild creature must be reachable");
    }
    for (const object of world.objects) {
      assert.equal(world.isReachableTile(object.tileX, object.tileY), true, "an object must be reachable");
    }
    seen.add(world.reachableTileCount);
  }
  assert.ok(seen.size > 8, "gates must not all generate the same field");

  const first = createHuntWorld(listChampionshipGates()[0]);
  const repeat = createHuntWorld(listChampionshipGates()[0]);
  assert.deepEqual(first.wildCreatures, repeat.wildCreatures, "world generation must be seeded, never random");
  assert.equal(first.reachableTileCount, repeat.reachableTileCount);
});

test("the world is far larger than any supported viewport", () => {
  const world = createHuntWorld(listChampionshipGates()[0]);
  // The widest contract viewport, and the tallest.
  for (const [width, height] of [[430, 932], [360, 800], [390, 844]]) {
    assert.ok(world.worldWidthPx > width * 4, "the world must not collapse to a screen-sized scene");
    assert.ok(world.worldHeightPx > height * 2);
  }
});

// ---------------------------------------------------------------------------
// Hunt runtime: movement, collision, camera, wild behaviour
// ---------------------------------------------------------------------------

test("the player cannot walk into blocked terrain or out of the world", () => {
  const world = createHuntWorld(listChampionshipGates()[0]);
  const runtime = createHuntRuntime({ world, fieldActor });

  for (const [x, y] of [[-4000, -4000], [9000, 9000], [-4000, 9000]]) {
    const attempt = createHuntRuntime({ world, fieldActor });
    attempt.moveTo(x, y);
    for (let i = 0; i < 3000; i += 1) attempt.tick(16);
    const player = attempt.getPlayer();
    assert.equal(world.isBlockedTile(player.tileX, player.tileY), false, "the player ended inside a wall");
    assert.ok(player.worldX > 0 && player.worldX < world.worldWidthPx);
    assert.ok(player.worldY > 0 && player.worldY < world.worldHeightPx);
  }

  // A long frame is split into bounded steps rather than teleporting through geometry.
  const teleport = runtime.getPlayer();
  runtime.moveTo(teleport.worldX + 900, teleport.worldY);
  runtime.tick(5000);
  const after = runtime.getPlayer();
  assert.equal(world.isBlockedTile(after.tileX, after.tileY), false, "a long frame walked through a wall");
});

test("the camera is a window over the world and is always clamped inside it", () => {
  const world = createHuntWorld(listChampionshipGates()[2]);
  const runtime = createHuntRuntime({ world, fieldActor });

  for (const [width, height] of [[360, 800], [390, 844], [393, 852], [412, 915], [430, 932]]) {
    // Walk hard into a corner so the camera has to clamp.
    const cornered = createHuntRuntime({ world, fieldActor });
    cornered.moveTo(0, 0);
    for (let i = 0; i < 4000; i += 1) cornered.tick(16);
    const camera = cornered.getCamera(width, height);
    assert.ok(camera.left >= 0 && camera.top >= 0, `${width}x${height} camera left the world`);
    assert.ok(camera.right <= world.worldWidthPx && camera.bottom <= world.worldHeightPx);
    assert.ok(camera.width <= world.worldWidthPx && camera.height <= world.worldHeightPx);
  }

  const chunks = runtime.getVisibleChunks(390, 844);
  assert.ok(chunks.length > 0 && chunks.length < 40, "chunk streaming should cover the view, not the world");
});

test("wild creatures wander inside a bounded radius and never react to the player", () => {
  const world = createHuntWorld(listChampionshipGates()[1]);
  const runtime = createHuntRuntime({ world, fieldActor });
  const spawns = world.wildCreatures;
  assert.equal(runtime.getWildCreatures().length, HUNT_WILD_COUNT);

  // Run a long simulation while the player stands still.
  for (let i = 0; i < 4000; i += 1) runtime.tick(16);
  const still = runtime.getWildCreatures();

  // Run the same simulation while the player walks straight at them.
  const chased = createHuntRuntime({ world, fieldActor });
  chased.moveTo(spawns[0].worldX, spawns[0].worldY);
  for (let i = 0; i < 4000; i += 1) chased.tick(16);
  const observed = chased.getWildCreatures();

  // Identical: the player's presence is not an input to wild movement. If a wild
  // creature ever chased, fled or froze, this is the case that would fail.
  assert.deepEqual(observed, still, "wild movement must not depend on the player");

  // Bounded against a literal, not against the exported constant. Asserting
  // drift <= HUNT_WILD_WANDER_RADIUS_PX would move with any change to that
  // constant, so widening the radius to the whole map would pass its own test.
  const MAX_WANDER_PX = 128;
  assert.ok(HUNT_WILD_WANDER_RADIUS_PX <= MAX_WANDER_PX,
    "the wander radius must stay a local bound; a field-wide radius is roaming, not wandering");

  for (const [index, wild] of still.entries()) {
    const drift = Math.hypot(wild.worldX - spawns[index].worldX, wild.worldY - spawns[index].worldY);
    assert.ok(drift <= MAX_WANDER_PX, `wild ${wild.wildId} left its wander radius`);
    assert.equal(wild.behaviourEvidence, "PRODUCT_AUTHORED_NOT_ORIGINAL");
    assert.ok(["IDLE", "WANDERING"].includes(wild.state));
    assert.equal(world.isBlockedTile(Math.floor(wild.worldX / 16), Math.floor(wild.worldY / 16)), false);
  }
  assert.ok(still.some((wild, index) =>
    Math.hypot(wild.worldX - spawns[index].worldX, wild.worldY - spawns[index].worldY) > 4),
  "wild creatures must actually move");
});

// ---------------------------------------------------------------------------
// The published seam
// ---------------------------------------------------------------------------

test("VS2 walks Raising Home to the Hunt field and back through the published seam", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  const started = await app.newGame();
  const residentId = started.snapshot.residents[0].residentId;
  const source = createGateHuntPresentationSource(app);
  const screens = [];
  const stop = source.subscribe((frame) => screens.push(frame.screen));

  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.RAISING_HOME);

  source.intents.openGate();
  const gateSelect = source.getFrame().gateSelect;
  assert.equal(gateSelect.gates.length, 16);
  assert.equal(gateSelect.canConfirm, false, "confirm must be gated on a selection");

  // Confirming with no selection is a no-op, not a crash and not a guess.
  source.intents.confirmGate();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.GATE_SELECT);

  source.intents.selectGate(gateSelect.gates[3].gateId);
  assert.equal(source.getFrame().gateSelect.canConfirm, true);
  source.intents.confirmGate();

  const loadout = source.getFrame().huntLoadout;
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.HUNT_LOADOUT);
  assert.equal(loadout.gate.gateId, gateSelect.gates[3].gateId);
  // Five recovered equipment classes and four plugin positions.
  assert.deepEqual(loadout.availableEquipment.map((entry) => entry.equipmentClass),
    ["ROPE", "SHOT", "WIRE", "ENTRAP", "DAMAGE_TRAP"]);
  assert.equal(loadout.selectedPlugins.length, 4);
  assert.equal(loadout.structure.equipmentClasses.evidence, "ROM_VERIFIED");

  // An empty loadout is permitted: no original rule requires anything equipped.
  assert.equal(loadout.canBegin, true);
  assert.equal(loadout.confirmationState.originalConfirmationFlow, "UNKNOWN_REQUIRES_TRACE");

  source.intents.selectEquipment("ROPE", "championship:2026:hunt-item:rope-i");
  const equipped = source.getFrame().huntLoadout.selectedEquipment
    .find((slot) => slot.equipmentClass === "ROPE");
  assert.equal(equipped.quantity, 1);
  assert.equal(equipped.durability, 10);
  assert.equal(equipped.durabilityConsumption, "UNKNOWN_REQUIRES_TRACE");

  source.intents.beginHunt();
  const field = source.getFrame().huntField;
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.HUNT_FIELD);
  assert.equal(field.world.widthTiles.value, 128);
  assert.equal(field.world.widthTiles.evidence, "VERIFIED_BINARY");

  // Explore.
  assert.equal(field.hud.actorName, "Tamer");
  const before = source.field.getView({ viewportWidth: 390, viewportHeight: 844 });
  assert.equal(before.wildCreatures.length, HUNT_WILD_COUNT);
  source.intents.moveTo(before.player.worldX + 220, before.player.worldY + 60);
  for (let i = 0; i < 400; i += 1) source.field.tick(16);
  const after = source.field.getView({ viewportWidth: 390, viewportHeight: 844 });
  assert.ok(after.player.worldX > before.player.worldX + 100, "the player did not explore");
  assert.notEqual(after.camera.centerX, before.camera.centerX, "the camera did not follow");

  source.intents.exitHunt();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(source.getFrame().huntField, null);
  assert.equal(app.getHuntRuntime(), null);

  // The Raising slice is exactly as it was left.
  assert.equal(app.getRaisingState().assignments[residentId], started.raising.assignments[residentId]);
  assert.deepEqual(screens, [
    "GATE_SELECT", "GATE_SELECT", "HUNT_LOADOUT", "HUNT_LOADOUT", "HUNT_FIELD", "RAISING_HOME"
  ]);
  stop();
  await app.dispose();
});

test("the Hunt toolbar is the ROM-verified mode with every slot still unbound", async () => {
  const app = createApp(memoryStorage());
  const started = await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openGate();
  source.intents.selectGate(app.getGates()[0].gateId);
  source.intents.confirmGate();
  source.intents.beginHunt();

  const toolbar = source.getFrame().huntField.toolbar;
  assert.equal(toolbar.mode.value, 2, "OVL0 0x0211A138 sets Hunt mode 2");
  assert.equal(toolbar.mode.evidence, "ROM_VERIFIED");
  assert.equal(toolbar.assetFamily.value, "ui/hunt_set");
  assert.equal(toolbar.slots.length, 8);
  toolbar.slots.forEach((slot, index) => {
    assert.equal(slot.slot, index);
    assert.equal(slot.buttonNode, `button${index}`, "slot N is buttonN, left to right");
    assert.equal(slot.commandId.value, null, "a toolbar command was invented");
    assert.equal(slot.iconCell.value, null, "a toolbar icon was invented");
    assert.equal(slot.label.value, null, "a toolbar label was invented");
    assert.deepEqual(slot.submenuEntries.value, [], "submenu population is not traced");
    assert.equal(slot.submenuCapacity.value, 8);
    assert.equal(slot.state, "UNBOUND_PLACEHOLDER");
  });
  await app.dispose();
});

test("VS2 exposes no capture surface and no unresolved terrain taxonomy", async () => {
  const app = createApp(memoryStorage());
  const started = await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openGate();
  source.intents.selectGate(app.getGates()[0].gateId);
  source.intents.confirmGate();
  source.intents.beginHunt();

  // Capture is VS3. Nothing in the VS2 seam may offer it.
  const intents = Object.keys(source.intents);
  for (const forbidden of ["capture", "throw", "tether", "encounter", "battle", "attack"]) {
    assert.equal(intents.some((name) => name.toLowerCase().includes(forbidden)), false, `VS2 exposed ${forbidden}`);
  }
  // Checked structurally rather than by text sweep: the frame's own notes
  // legitimately NAME what VS2 refuses to render, so a substring search would
  // flag the documentation of the refusal as the thing it forbids. What matters
  // is that no renderable FIELD carries those semantics.
  // VS2-R2 narrowed this sweep. Item counters and radar markers are no longer
  // unexplained: they are ROM-verified plugin capabilities, so banning their
  // names would now ban the recovered original. What must stay out is a later
  // slice's MECHANICS - rewards, encounters, progression - and any capture
  // affordance. Capture capacity is allowed through as a labelled readout,
  // asserted separately below.
  const ALLOWED_CAPTURE_KEYS = new Set(["captureCapacityG", "captureCapacityScope"]);
  const frame = source.getFrame();
  const offendingKeys = [];
  (function walkKeys(value, path) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const forbidden = /reward|encounter|progress|rank/i.test(key)
        || (/capture/i.test(key) && !ALLOWED_CAPTURE_KEYS.has(key));
      if (forbidden) offendingKeys.push(`${path}.${key}`);
      walkKeys(child, `${path}.${key}`);
    }
  })(frame, "frame");
  assert.deepEqual(offendingKeys, [], "VS2 exposed a field belonging to a later slice");

  // Capture capacity is a number the Memory Checker displays, never an action.
  const capabilities = frame.huntField.hud.capabilities;
  assert.equal(capabilities.captureCapacityScope, "VS3_CAPTURE_NOT_IMPLEMENTED");
  assert.equal(capabilities.evidence, "ROM_VERIFIED");

  // With no plugins fitted the HUD is dark. Capability is derived from the
  // loadout, not granted by default - that gating is the recovered rule.
  assert.deepEqual(capabilities.analyzerFields, []);
  assert.deepEqual(capabilities.itemCounters, []);
  assert.equal(capabilities.radar, false);
  assert.equal(capabilities.radarMarkerCapacity, 0);
  assert.equal(capabilities.memoryReadout, false);

  assert.deepEqual(
    Object.keys(frame.huntField.hud).sort(),
    ["actorName", "capabilities", "exitAvailable", "gateName", "note"],
    "the Hunt HUD grew a field whose original semantics are unknown"
  );

  const view = source.field.getView({ viewportWidth: 390, viewportHeight: 844 });
  // Only two collision outcomes are evidenced, so only two terrain kinds exist.
  assert.equal(typeof view.isBlockedTile(4, 4), "boolean");
  for (const object of view.objects) {
    assert.ok(["SCENERY", "BLOCKER"].includes(object.kind), `invented object kind ${object.kind}`);
  }
  await app.dispose();
});

// ---------------------------------------------------------------------------
// Save authority
// ---------------------------------------------------------------------------

test("VS2 adds no save field, and a reload lands back at Raising Home", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  const started = await app.newGame();
  const residentId = started.snapshot.residents[0].residentId;
  const source = createGateHuntPresentationSource(app);

  app.care(residentId);
  source.intents.openGate();
  source.intents.selectGate(app.getGates()[7].gateId);
  source.intents.confirmGate();
  source.intents.beginHunt();

  // Saving mid-Hunt is allowed and writes only the existing envelope.
  source.intents.requestSave();
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  const saved = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.deepEqual(Object.keys(saved).sort(), [
    "creature", "flags", "progression", "raising", "raisingHome", "saveKind", "schemaVersion", "sessionId", "updatedAt"
  ].sort());
  const asText = JSON.stringify(saved);
  for (const leak of ["gate", "hunt", "wild", "equipment", "plugin", "camera"]) {
    assert.equal(asText.toLowerCase().includes(leak), false, `VS2 leaked ${leak} into the save envelope`);
  }
  await app.dispose();

  // A fresh application is the reload. No Hunt state is traced, so none returns.
  const reloaded = createApp(storage);
  const restored = await reloaded.continueGame();
  assert.ok(restored);
  assert.equal(reloaded.getScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(reloaded.getHuntRuntime(), null);
  assert.equal(reloaded.getConfirmedGate(), null);
  assert.equal(reloaded.getRaisingState().interactions[residentId].careCount, 1, "the Raising slice must survive");
  await reloaded.dispose();
});

test("starting a new game clears any expedition in progress", async () => {
  const app = createApp(memoryStorage());
  const started = await app.newGame();
  const source = createGateHuntPresentationSource(app);
  source.intents.openGate();
  source.intents.selectGate(app.getGates()[0].gateId);
  source.intents.confirmGate();
  source.intents.beginHunt();
  assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.HUNT_FIELD);

  await app.newGame();
  assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(app.getHuntRuntime(), null);
  assert.equal(app.getSelectedGateId(), null);
  assert.equal(app.getHuntLoadout(), null);
  await app.dispose();
});
