// VS3 -- Hunt enclosure through the standalone application.
//
// The field gesture is a circle, not a Capture button. A closed original-
// geometry loop that still contains the wild writes one collection instance,
// opens Hunt Result, and returns to Raising Home. Original success odds stay
// untraced; the label is PRODUCT_AUTHORED_ENCLOSURE.

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

function createApp(storage = memoryStorage()) {
  return createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: presentation.cages,
    now: () => "2026-08-30T06:20:00.000Z"
  });
}

async function enterFirstHunt(app) {
  await app.newGame();
  app.openGate();
  app.selectGate(app.getGates()[0].gateId);
  app.confirmGate();
  app.beginHunt();
}

function drawClosedLoop(host, cx, cy, radius = 36) {
  host.extendEnclosureStroke(cx + radius, cy);
  host.extendEnclosureStroke(cx + radius, cy + radius);
  host.extendEnclosureStroke(cx - radius, cy + radius);
  host.extendEnclosureStroke(cx - radius, cy - radius);
  host.extendEnclosureStroke(cx + radius, cy - radius);
  host.extendEnclosureStroke(cx + 2, cy + 2);
}

test("the screen stack can enter Hunt Result from the field and unwind to Home", () => {
  const stack = createChampionshipScreenStack();
  stack.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
  stack.enter(CHAMPIONSHIP_SCREENS.HUNT_LOADOUT);
  stack.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD);
  assert.equal(stack.depth(), 4);
  assert.equal(CHAMPIONSHIP_SCREEN_STACK_MAX_DEPTH, 5);

  stack.enter(CHAMPIONSHIP_SCREENS.HUNT_RESULT);
  assert.equal(stack.current(), CHAMPIONSHIP_SCREENS.HUNT_RESULT);
  assert.equal(stack.depth(), 5);
  assert.equal(stack.exit(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(stack.depth(), 1);
});

test("a closed loop on the field opens Hunt Result and keeps the instance after continue", async () => {
  const storage = memoryStorage();
  const app = createApp(storage);
  await enterFirstHunt(app);
  const target = app.getHuntRuntime().getWildCreatures()[0];
  const before = app.getHuntRuntime().getWildCreatures().length;
  const residentsBefore = app.getSnapshot().residents.length;

  assert.equal(app.beginEnclosureStroke(target.worldX, target.worldY), true);
  drawClosedLoop(app, target.worldX, target.worldY);
  const verdict = app.endEnclosureStroke();

  assert.equal(verdict.outcome, "ENCLOSED");
  assert.equal(verdict.successAuthority, "PRODUCT_AUTHORED_ENCLOSURE");
  assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.HUNT_RESULT);
  assert.equal(app.getHuntRuntime().getWildCreatures().length, before - 1);
  assert.equal(app.getRaisingState().collection.length, 1);
  assert.equal(app.getRaisingState().collection[0].speciesId, target.speciesId);
  assert.equal(app.getSnapshot().residents.length, residentsBefore, "enclosed instances must not become R2 residents");

  app.confirmHuntResult();
  assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(app.getHuntRuntime(), null);
  app.save();
  await app.dispose();

  const reloaded = createApp(storage);
  const restored = await reloaded.continueGame();
  assert.ok(restored);
  assert.equal(reloaded.getScreen(), CHAMPIONSHIP_SCREENS.RAISING_HOME);
  assert.equal(reloaded.getRaisingState().collection.length, 1);
  assert.equal(reloaded.getRaisingState().collection[0].speciesId, target.speciesId);
  assert.equal(reloaded.getSnapshot().residents.length, residentsBefore);
  await reloaded.dispose();
});

test("an unclosed scribble stays on the field and writes no collection", async () => {
  const app = createApp();
  await enterFirstHunt(app);
  const target = app.getHuntRuntime().getWildCreatures()[0];
  app.beginEnclosureStroke(target.worldX, target.worldY);
  app.extendEnclosureStroke(target.worldX + 30, target.worldY);
  const verdict = app.endEnclosureStroke();
  assert.equal(verdict.outcome, "OPEN");
  assert.equal(app.getScreen(), CHAMPIONSHIP_SCREENS.HUNT_FIELD);
  assert.equal(app.getRaisingState().collection.length, 0);
  await app.dispose();
});

test("Hunt Result copy never uses a Capture button", () => {
  const screens = fs.readFileSync("src/championship/app/vs3Screens.js", "utf8");
  assert.doesNotMatch(screens, /CAPTURE/);
  assert.match(screens, /HUNT RESULT/);
  assert.match(screens, /BROUGHT HOME/);
  assert.match(screens, /confirmHuntResult/);
});

test("the presentation seam uses enclosure intents, never a Capture action", async () => {
  const app = createApp();
  await enterFirstHunt(app);
  const source = createGateHuntPresentationSource(app);
  const names = Object.keys(source.intents);
  for (const forbidden of ["capture", "throw", "encounter", "battle", "attack"]) {
    assert.equal(names.some((name) => name.toLowerCase().includes(forbidden)), false, `seam exposed ${forbidden}`);
  }
  assert.equal(typeof source.intents.beginEnclosureStroke, "function");
  assert.equal(typeof source.intents.confirmHuntResult, "function");

  const target = source.field.getView({ viewportWidth: 390, viewportHeight: 844 }).wildCreatures[0];
  assert.equal(source.intents.beginEnclosureStroke(target.worldX, target.worldY), true);
  drawClosedLoop(source.intents, target.worldX, target.worldY);
  const frame = source.intents.endEnclosureStroke();
  assert.equal(frame.screen, CHAMPIONSHIP_SCREENS.HUNT_RESULT);
  assert.equal(frame.huntResult.speciesId, target.speciesId);
  assert.equal(frame.huntField, null);
  assert.match(JSON.stringify(frame.huntResult), /BROUGHT HOME|HUNT RESULT|PRODUCT_AUTHORED_ENCLOSURE/);
  assert.doesNotMatch(JSON.stringify(frame.huntResult), /CAPTURE/);

  source.intents.confirmHuntResult();
  assert.equal(source.getFrame().screen, CHAMPIONSHIP_SCREENS.RAISING_HOME);
  await app.dispose();
});
