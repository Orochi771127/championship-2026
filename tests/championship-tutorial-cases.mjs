import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TUTORIAL_CONTRACT, TUTORIAL_STEP_COUNT, TUTORIAL_PHASES, TUTORIAL_FINISHED,
  createTutorialCursor, tutorialFinished, tutorialStepAt, tutorialStepsForPhase,
  tutorialExpectedAction, advanceTutorial, skipTutorial }
  from "../src/championship/app/nativeTutorialProgression.js";
import { tutorialLine, tutorialPrompt, TUTORIAL_TEXT_IDS, TUTORIAL_PROMPT_ACTIONS }
  from "../src/championship/text/tutorialMessages.zhHant.js";
import { normalizeNativeOpening } from "../src/championship/app/nativeOpeningState.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";

const speciesCatalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
function makeApp(providedStorage=null) {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k), keys: () => [...data.keys()] };
  return createChampionshipStandaloneApp({ storage:providedStorage??storage, catalog: speciesCatalog, cages: presentation.cages,
    now: () => "2026-09-05T10:00:00.000Z" });
}

const catalogue = JSON.parse(fs.readFileSync("src/data/championship/catalogs/tutorial-steps.r1.json", "utf8"));
const observation = JSON.parse(fs.readFileSync("docs/research/TUTORIAL_CONTINUATION_OBSERVED_2026-09-09.json", "utf8"));

test('tutorial progress marks the canonical save dirty, survives Continue and preserves unsupported legacy cursors',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const app=makeApp(storage);await app.newGame({trainerName:'測試',eggName:'小蛋'});app.save();
  app.beginTutorial();assert.equal(app.savePort.getStatus().phase,'DIRTY');app.save();
  app.advanceTutorial(app.getTutorial().expected);assert.equal(app.savePort.getStatus().phase,'DIRTY');app.save();await app.dispose();
  const restored=makeApp(storage);await restored.continueGame();assert.equal(restored.getTutorial().step,1);
  restored.skipTutorial();assert.equal(restored.savePort.getStatus().phase,'DIRTY');restored.save();await restored.dispose();
  const [key,raw]=[...data][0],save=JSON.parse(raw);save.progression.nativeOpening.tutorialStep=71;data.set(key,JSON.stringify(save));
  const legacy=makeApp(storage);assert.ok(await legacy.continueGame());assert.equal(legacy.getTutorial().reason,'TUTORIAL_CURSOR_REQUIRES_TRACE');
  assert.equal(legacy.advanceTutorial('ACKNOWLEDGE').ok,false);assert.equal(legacy.skipTutorial().ok,false);
  assert.equal(legacy.getOpeningState().tutorialStep,71);await legacy.dispose();
});

test("the catalogue is the observed run, in the order it was observed", () => {
  assert.equal(TUTORIAL_CONTRACT, "TUTORIAL_STEPS.v1");
  assert.equal(TUTORIAL_STEP_COUNT, 35);
  assert.equal(catalogue.steps.length, TUTORIAL_STEP_COUNT);
  assert.deepEqual(catalogue.steps.map((step) => step.step), [...Array(TUTORIAL_STEP_COUNT).keys()]);
  // Text ids run unbroken: that contiguity is what lets the range stand for the run.
  const ids = catalogue.steps.map((step) => step.textId);
  assert.deepEqual(ids, ids.map((_, index) => ids[0] + index));
  const observed = new Set([
    ...observation.traces.flatMap((trace) => (trace.observedTextEvents ?? []).map((event) => event.textId)),
    ...observation.additionalVisualObservations.map((entry) => entry.textId),
  ]);
  for (const id of observed) assert.ok(ids.includes(id), `observed ${id} is missing from the catalogue`);
  assert.equal(catalogue.observedStepCount, observed.size);
  // One line was never seen firing; it is carried, and marked, rather than dropped.
  assert.deepEqual(catalogue.steps.filter((step) => !step.observedIn).map((step) => step.textId), [1542]);
});

test("every step belongs to one taught phase and the phases stay in order", () => {
  const phases = catalogue.steps.map((step) => step.phase);
  for (const phase of phases) assert.ok(TUTORIAL_PHASES.includes(phase));
  const firstSeen = TUTORIAL_PHASES.map((phase) => phases.indexOf(phase));
  assert.deepEqual(firstSeen, [...firstSeen].sort((a, b) => a - b));
  assert.deepEqual(TUTORIAL_PHASES.map((phase) => tutorialStepsForPhase(phase).length), [12, 1, 22]);
  assert.equal(TUTORIAL_PHASES.reduce((sum, phase) => sum + tutorialStepsForPhase(phase).length, 0),
    TUTORIAL_STEP_COUNT);
  assert.throws(() => tutorialStepsForPhase("BATTLE"), /UNKNOWN_PHASE/);
});

test("walking every step with the action it asks for finishes the tutorial exactly once", () => {
  let cursor = createTutorialCursor();
  assert.equal(cursor, 0);
  const walked = [];
  for (let guard = 0; guard <= TUTORIAL_STEP_COUNT; guard += 1) {
    if (tutorialFinished(cursor)) break;
    const result = advanceTutorial(cursor, tutorialExpectedAction(cursor));
    assert.equal(result.ok, true);
    walked.push(result.completed);
    cursor = result.step;
  }
  assert.deepEqual(walked, [...Array(TUTORIAL_STEP_COUNT).keys()]);
  assert.equal(cursor, TUTORIAL_FINISHED);
  assert.equal(tutorialStepAt(cursor), null);
  assert.deepEqual(advanceTutorial(cursor, "ACKNOWLEDGE"),
    { ok: false, reason: "TUTORIAL_ALREADY_FINISHED", step: TUTORIAL_FINISHED });
});

test("a step refuses anything but the action it teaches, and stays where it is", () => {
  const ropeStep = catalogue.steps.find((step) => step.advance === "ROPE_ENCLOSE").step;
  const wrong = advanceTutorial(ropeStep, "HAND_CAPTURE");
  assert.equal(wrong.ok, false);
  assert.equal(wrong.reason, "TUTORIAL_ACTION_MISMATCH");
  assert.equal(wrong.step, ropeStep);
  assert.equal(wrong.expected, "ROPE_ENCLOSE");
  // A remark cannot be skipped by performing some unrelated action either.
  const remark = catalogue.steps.find((step) => step.advance === "ACKNOWLEDGE").step;
  assert.equal(advanceTutorial(remark, "OPEN_HUNT").ok, false);
  assert.equal(advanceTutorial(remark, "ACKNOWLEDGE").ok, true);
  assert.throws(() => advanceTutorial(0, ""), /ACTION_REQUIRED/);
  assert.throws(() => tutorialStepAt(TUTORIAL_STEP_COUNT), /STEP_OUT_OF_RANGE/);
  assert.throws(() => tutorialStepAt(1.5), /STEP_MUST_BE_AN_INTEGER/);
});

test("the cursor the tutorial produces is one the opening save already accepts", () => {
  const trainerName = "測試";
  for (const step of [createTutorialCursor(), 17, TUTORIAL_STEP_COUNT - 1, TUTORIAL_FINISHED]) {
    assert.deepEqual(normalizeNativeOpening({ version: 1, trainerName, tutorialStep: step }),
      { version: 1, trainerName, tutorialStep: step });
  }
  assert.equal(skipTutorial(0), TUTORIAL_FINISHED);
  assert.equal(skipTutorial(TUTORIAL_FINISHED), TUTORIAL_FINISHED);
});

test("every step has Chinese copy and every action has a prompt, with nothing spare", () => {
  assert.deepEqual([...TUTORIAL_TEXT_IDS].sort((a, b) => a - b),
    catalogue.steps.map((step) => step.textId));
  for (const step of catalogue.steps) {
    const line = tutorialLine(step.textId);
    assert.ok(line.length > 0, `step ${step.step} has empty copy`);
    // The copy is ours: it must not carry kana from the original bank.
    assert.doesNotMatch(line, /[぀-ゟ゠-ヿ]/, `step ${step.step} contains kana`);
    assert.ok(tutorialPrompt(step.advance).length > 0);
  }
  const used = new Set(catalogue.steps.map((step) => step.advance));
  assert.deepEqual([...TUTORIAL_PROMPT_ACTIONS].sort(), [...used].sort());
  assert.throws(() => tutorialLine(999), /TUTORIAL_TEXT_MISSING/);
  assert.throws(() => tutorialPrompt("NOPE"), /TUTORIAL_PROMPT_MISSING/);
});

test("the application opens, walks and closes the tutorial without touching a new game's save", async () => {
  const app = makeApp();
  // The tutorial rides on the opening save, so the run has to be named.
  await app.newGame({ trainerName: "測試", eggName: "小蛋" });
  // A new game still carries no cursor, so nothing changes for the existing flows.
  assert.equal(app.getTutorial(), null);
  assert.deepEqual(app.advanceTutorial("ACKNOWLEDGE"), { ok: false, reason: "TUTORIAL_NOT_STARTED" });

  const opened = app.beginTutorial();
  assert.equal(opened.ok, true);
  assert.equal(opened.tutorial.step, 0);
  assert.equal(opened.tutorial.phase, "RAISING");
  assert.equal(opened.tutorial.finished, false);
  assert.ok(opened.tutorial.line.length > 0);
  assert.ok(opened.tutorial.prompt.length > 0);

  // A wrong action neither advances the cursor nor rewrites the opening save.
  const before = app.getOpeningState().tutorialStep;
  assert.equal(app.advanceTutorial("HAND_CAPTURE").ok, false);
  assert.equal(app.getOpeningState().tutorialStep, before);

  let guard = 0;
  while (!app.getTutorial().finished && guard++ <= TUTORIAL_STEP_COUNT) {
    assert.equal(app.advanceTutorial(app.getTutorial().expected).ok, true);
  }
  assert.equal(app.getTutorial().finished, true);
  assert.equal(app.getOpeningState().tutorialStep, TUTORIAL_FINISHED);

  const skipper = makeApp();
  await skipper.newGame({ trainerName: "測試", eggName: "小蛋" });
  skipper.beginTutorial();
  assert.equal(skipper.skipTutorial().tutorial.finished, true);
  assert.equal(skipper.getOpeningState().tutorialStep, TUTORIAL_FINISHED);
});
