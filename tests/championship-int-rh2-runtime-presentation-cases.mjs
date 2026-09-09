import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import {
  createRaisingPresentationSource,
  RAISING_PRESENTATION_CONTRACT_VERSION
} from "../src/championship/app/raisingPresentationSource.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, "src/data/championship/catalogs/creature-species.r1.json"), "utf8"));
const presentation = JSON.parse(fs.readFileSync(
  path.join(repoRoot, "docs/contracts/championship/raising-home-presentation.v1.json"), "utf8"
));
const CAGES = presentation.cages;

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    keys() { return [...values.keys()].sort(); }
  };
}

async function freshSource(storage = memoryStorage()) {
  const app = createChampionshipStandaloneApp({
    storage,
    catalog,
    cages: CAGES,
    now: () => "2026-08-27T12:34:56.000Z"
  });
  await app.newGame();
  return { app, source: createRaisingPresentationSource(app), storage };
}

test("INT-RH2 source projects the actual Phase 1 snapshot into the bounded frame", async () => {
  const { app, source } = await freshSource();
  const snapshot = app.getSnapshot();
  assert.equal(snapshot.residents[0].speciesId, "species-000", "fixture drift: species IDs changed shape");

  const frame = source.getFrame();
  assert.equal(source.getFrame(), frame, "a pure getFrame read rebuilt or mutated the frame");
  assert.equal(frame.contractVersion, RAISING_PRESENTATION_CONTRACT_VERSION);
  assert.equal(frame.revision, 0);
  assert.equal(frame.clock.display, "07:00", "ROM default clock initialization starts at 07:00");
  assert.equal(frame.residents.length, snapshot.residents.length);
  assert.equal(frame.residents[0].speciesId, "championship:creature:species-000");
  // The three invented creatures carried placeholder sprite sheets. They were
  // deleted on 2026-09-03; the cartridge species have no art yet, so the source
  // must fall back rather than throw. That fallback is the assertion now.
  assert.equal(frame.residents[0].sprite.idle.sheet, null, "no art for a cartridge species yet");
  assert.equal(frame.residents[0].sprite.portrait, null);
  assert.equal(frame.residents[0].cageId, CAGES[0].cageId);
  assert.equal(frame.cages[0].occupantCount, frame.cages[0].occupantIds.length);
  assert.equal(Object.isFrozen(frame), true);
  assert.equal(Object.isFrozen(frame.residents[0].sprite.idle), true);

  const serialized = JSON.stringify(frame);
  for (const excluded of ["satiety", "energy", "ease", "readiness", "caretakerPosition", "eventLog", "feedback"]) {
    assert.equal(serialized.includes(`\"${excluded}\"`), false, `presentation leaked excluded field ${excluded}`);
  }
  await app.dispose();
});

test("INT-RH2 toolbar projection preserves all eight verified shells and all unknowns", async () => {
  const { app, source } = await freshSource();
  const { toolbar } = source.getFrame();
  assert.deepEqual(toolbar.slotCount, { value: 8, evidence: "ROM_VERIFIED" });
  assert.deepEqual(toolbar.mode, { value: 1, context: "TRAINING_RAISING", evidence: "ROM_VERIFIED" });
  assert.equal(toolbar.assetFamily.value, "ui/training_set");
  assert.equal(toolbar.slots.length, 8);
  assert.deepEqual(toolbar.slots.map((slot) => slot.buttonNode), [
    "button0", "button1", "button2", "button3", "button4", "button5", "button6", "button7"
  ]);
  assert.deepEqual(toolbar.slots.map((slot) => slot.frame.cell), [10, 11, 10, 11, 10, 11, 10, 12]);
  for (const [index, slot] of toolbar.slots.entries()) {
    assert.equal(slot.slot, index);
    assert.equal(slot.commandId.value, null);
    assert.equal(slot.commandId.evidence, "UNKNOWN_REQUIRES_TRACE");
    assert.equal(slot.iconCell.value, null);
    assert.equal(slot.label.value, null);
    assert.deepEqual(slot.submenuEntries.value, []);
    assert.equal(slot.state, "UNBOUND_PLACEHOLDER");
  }
  await app.dispose();
});

test("INT-RH2 named intents mutate only the existing standalone truth and publish revisions", async () => {
  const { app, source, storage } = await freshSource();
  const residentId = source.getFrame().residents[0].creatureId;
  const secondCage = CAGES[1].cageId;
  const initialR2Resident = app.getSnapshot().residents.find((resident) => resident.residentId === residentId);
  const observed = [];
  const unsubscribe = source.subscribe((frame) => observed.push(frame));

  const selected = source.intents.selectCreature(residentId);
  assert.equal(selected.selection.creatureId, residentId);
  assert.equal(selected.revision, 1);

  const relocated = source.intents.relocateCreature(residentId, secondCage);
  assert.equal(relocated.residents.find((resident) => resident.creatureId === residentId).cageId, secondCage);
  assert.equal(app.getRaisingState().assignments[residentId], secondCage);
  assert.equal(relocated.revision, 2);
  assert.equal(source.intents.relocateCreature(residentId, secondCage).revision, 2, "same-cage drop advanced presentation truth");

  const cared = source.intents.careForCreature(residentId);
  assert.equal(cared.residents.find((resident) => resident.creatureId === residentId).intent, "care-reaction");
  assert.equal(cared.revision, 3);
  assert.equal(app.getRaisingState().interactions[residentId].careCount, 1);
  const afterCare = app.getSnapshot().residents.find((resident) => resident.residentId === residentId);
  for (const stat of ["satiety", "energy", "ease", "readiness"]) {
    assert.equal(afterCare[stat], initialR2Resident[stat], `care intent moved forbidden stat ${stat}`);
  }

  const save = source.intents.requestSave();
  assert.equal(save.phase, "SAVED");
  assert.equal(source.getFrame().revision, 4);
  assert.deepEqual(storage.keys(), [CHAMPIONSHIP_MODERN_SAVE_KEY]);
  assert.equal(observed.length, 4);
  assert.deepEqual(observed.map((frame) => frame.revision), [1, 2, 3, 4]);

  unsubscribe();
  source.intents.selectCreature(null);
  assert.equal(observed.length, 4, "unsubscribed presentation observer still received frames");
  await app.dispose();
});

test("INT-RH2 observers are isolated and re-entrant publications remain ordered", async () => {
  const { app, source } = await freshSource();
  const residentId = source.getFrame().residents[0].creatureId;
  const first = [];
  const second = [];
  let reentered = false;
  const unsubscribeThrower = source.subscribe(() => { throw new Error("observer failure"); });
  const unsubscribeFirst = source.subscribe((frame) => {
    first.push(frame.revision);
    if (!reentered) {
      reentered = true;
      source.intents.relocateCreature(residentId, CAGES[1].cageId);
    }
  });
  const unsubscribeSecond = source.subscribe((frame) => second.push(frame.revision));

  source.intents.selectCreature(residentId);
  assert.deepEqual(first, [1, 2]);
  assert.deepEqual(second, [1, 2]);
  assert.equal(source.getFrame().revision, 2);

  unsubscribeThrower();
  unsubscribeFirst();
  unsubscribeSecond();
  await app.dispose();
});

test("INT-RH2 save/reload proof restores runtime truth without restoring transient presentation state", async () => {
  const storage = memoryStorage();
  const first = await freshSource(storage);
  const residentId = first.source.getFrame().residents[0].creatureId;
  first.source.intents.selectCreature(residentId);
  first.source.intents.relocateCreature(residentId, CAGES[1].cageId);
  first.source.intents.careForCreature(residentId);
  first.source.intents.requestSave();
  await first.app.dispose();

  const reloaded = createChampionshipStandaloneApp({ storage, catalog, cages: CAGES });
  await reloaded.continueGame();
  const restoredSource = createRaisingPresentationSource(reloaded);
  const restored = restoredSource.getFrame();
  const resident = restored.residents.find((entry) => entry.creatureId === residentId);
  assert.equal(resident.cageId, CAGES[1].cageId);
  assert.notEqual(resident.intent, "care-reaction", "ephemeral reaction was promoted into save truth");
  assert.equal(restored.selection.creatureId, null, "selection was promoted into save truth");
  assert.equal(restored.save.phase, "DIRTY", "original Home entry advances the saved slot RNG");
  assert.equal(reloaded.getRaisingState().interactions[residentId].careCount, 1);
  await reloaded.dispose();
});

test("INT-RH2 a delayed first subscriber immediately catches the 22:00 stop and dirty save state", async () => {
  const { app, source } = await freshSource();
  source.intents.requestSave();
  assert.equal(source.getFrame().clock.display, "07:00");
  assert.equal(source.getFrame().save.phase, "SAVED");

  // The browser constructs a source before awaiting scene assets. Its clock
  // owner can finish the day while no view is listening, so no later minute
  // event can be relied on to repair that source's initial cached frame.
  app.advanceClock({ units: (21 * 60 + 59 - app.getSnapshot().clockMinutes) * 400 });
  app.advanceNaturalClock({ frames: 120 });
  assert.equal(app.getSnapshot().clockMinutes, 22 * 60);
  assert.deepEqual(app.getClockRunState(), { running: false, reason: "DAY_END" });
  assert.equal(source.getFrame().clock.display, "07:00", "the delayed view has not subscribed yet");

  const observed = [];
  const unsubscribe = source.subscribe((frame) => observed.push(frame));
  assert.equal(observed.length, 1, "attaching must catch up without waiting for a future tick");
  assert.equal(observed[0].clock.display, "22:00");
  assert.equal(observed[0].save.phase, "DIRTY");
  assert.equal(source.getFrame(), observed[0]);
  assert.equal(app.advanceNaturalClock({ frames: 120 }).accepted, false);
  assert.equal(observed.length, 1, "a stopped clock does not publish a second repair frame");
  unsubscribe();
  await app.dispose();
});

test("INT-RH2 clock publications preserve care reaction and care at the saved day-end marks the game dirty", async () => {
  const { app, source } = await freshSource();
  const residentId = source.getFrame().residents[0].creatureId;
  const unsubscribe = source.subscribe(() => {});
  const actor = () => source.getFrame().residents.find((entry) => entry.creatureId === residentId);
  source.intents.careForCreature(residentId);
  assert.equal(actor().intent, "care-reaction");
  const beforeClock = source.getFrame().revision;
  app.advanceClock({ units: 400 });
  assert.equal(source.getFrame().clock.display, "07:01");
  assert.ok(source.getFrame().revision > beforeClock);
  assert.equal(actor().intent, "care-reaction", "a clock-only update cannot cancel the active response");

  app.advanceClock({ units: (21 * 60 + 59 - app.getSnapshot().clockMinutes) * 400 });
  app.advanceNaturalClock({ frames: 120 });
  assert.equal(source.getFrame().clock.display, "22:00");
  assert.equal(source.intents.requestSave().phase, "SAVED");
  assert.equal(app.getClockRunState().running, false);
  const clockAtSave = app.getSnapshot();

  source.intents.careForCreature(residentId);
  assert.equal(app.savePort.getStatus().phase, "DIRTY");
  assert.equal(source.getFrame().save.phase, "DIRTY", "care itself dirties the checkpoint when no clock update can do so");
  assert.equal(app.getRaisingState().interactions[residentId].careCount, 2);
  assert.equal(app.getSnapshot(), clockAtSave, "care does not advance the stopped clock or original-unknown stats");
  assert.equal(actor().intent, "care-reaction", "save-status publication must not swallow the new care reaction");
  unsubscribe();
  await app.dispose();
});

test("INT-RH2 Pixi field is a scene on the one shared stage and owns no bootstrap", () => {
  const file = path.join(repoRoot, "src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js");
  const source = fs.readFileSync(file, "utf8");
  const stage = fs.readFileSync(path.join(repoRoot, "src/championship/presentation/championshipPixiStage.js"), "utf8");

  // VS2 added a second playable field, so the single Application moved out to the
  // stage host. The invariant is unchanged - exactly one bootstrap in the product
  // - but it now lives one module out, and the field must neither create nor
  // destroy an Application it does not own.
  assert.equal((source.match(/new PIXI\.Application\(\)/g) ?? []).length, 0, "the field must not bootstrap its own Application");
  assert.equal((stage.match(/new PIXI\.Application\(\)/g) ?? []).length, 1, "the stage must hold exactly one bootstrap");
  assert.equal(/app\.destroy\(/.test(source), false, "the field must not destroy an Application it does not own");
  assert.match(source, /stage\.createSceneRoot\(/, "the field must take its scene root from the stage");

  // The canvas is shared now, so the Raising scene has to claim its own class
  // while mounted. Losing it is invisible in unit tests and breaks the VS1
  // browser gate's selector, so it is pinned here where it fails in a second.
  assert.match(source, /stage\.markScene\("cm-raising-pixi-canvas"\)/, "the Raising scene must mark the shared canvas");
  assert.match(source, /unmarkScene\(\)/, "the Raising scene must release its canvas class on dispose");
  assert.equal(/new PIXI\.Ticker|Ticker\.shared|requestAnimationFrame|setInterval/.test(source), false,
    "Pixi field created a second ticker or frame loop");
  assert.match(source, /app\.ticker\.add\(updateAnimations\)/, "animation does not use the Application-owned ticker");
  assert.match(source, /autoUpdate: false/, "AnimatedSprite would attach itself to the shared ticker");
  assert.equal(/Three|three\.js|WebGLRenderer/.test(source), false, "Three.js entered the Raising slice");
  assert.equal(/localStorage|saveManager|championshipStandaloneApp|championshipRaisingProduction|entities\.r1/.test(source), false,
    "Pixi presentation reached around the runtime presentation source");
  assert.match(source, /source\.intents\.selectCreature/);
  assert.match(source, /source\.intents\.relocateCreature/);
  assert.match(source, /render\(frame\)\s*\{\s*sync\(frame\)/, "field port cannot accept the P1R render callback");
  assert.equal(/toolbar|RAW_SLOT|commandId/.test(source), false, "field renderer took DOM toolbar authority");
});
