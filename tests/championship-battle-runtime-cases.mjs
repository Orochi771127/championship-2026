// VS5 battle runtime and screens.
//
// The runtime is what the three screens share. The screens themselves are
// asserted the way this repository asserts every DOM view: over their source
// text, because they import nothing and a real DOM is the browser gate's job.
//
// The fact worth guarding hardest: nothing here quietly turns a product-authored
// number into a traced one. Combat tests explicitly supply their date fixture;
// an absent schedule cannot silently become an invented playable date.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_RUNTIME_DEFAULT_SCHEDULE_EVIDENCE,
  BATTLE_RUNTIME_DEFAULT_ECONOMY_CONTEXT_EVIDENCE,
  BATTLE_RUNTIME_MATCH_CAP,
  createBattleRuntime
} from "../src/championship/app/battleRuntime.js";

import { BATTLE_MATCH_LIST_CAP } from "../src/championship/battle/battleMatchSelection.js";
import { BATTLE_LAUNCH_POOL_SIZE } from "../src/championship/battle/battleLaunchPool.js";
import { BATTLE_OUTCOME_TIME_LIMIT_FRAMES, verdictIsWin } from "../src/championship/battle/battleOutcome.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const screens = fs.readFileSync(path.join(root, "src/championship/app/vs5Screens.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/championship/app/vs5Styles.css"), "utf8");
const AUTUMN_DAY4_SCHEDULE = Object.freeze({ entryMode: 0, scheduleSlotA: 2, scheduleSlotB: 3, progressCounter: 0 });

test("the menu is capped at the original's five and no schedule means no available matches", () => {
  assert.equal(BATTLE_RUNTIME_MATCH_CAP, BATTLE_MATCH_LIST_CAP);
  assert.equal(BATTLE_RUNTIME_MATCH_CAP, 5);
  assert.equal(BATTLE_RUNTIME_DEFAULT_SCHEDULE_EVIDENCE, "UNKNOWN_REQUIRES_TRACE");

  const runtime = createBattleRuntime();
  assert.equal(runtime.scheduleEvidence(), "UNKNOWN_REQUIRES_TRACE");
  assert.deepEqual(runtime.listMatches(), [], "missing calendar input cannot acquire the old (2, 3) fixture");
  assert.throws(() => runtime.chooseMatch(0), /MATCH_IS_NOT_OPEN/);
  const fixture = createBattleRuntime({ schedule: AUTUMN_DAY4_SCHEDULE });
  assert.ok(fixture.listMatches().length > 0 && fixture.listMatches().length <= BATTLE_RUNTIME_MATCH_CAP);
  for (const match of fixture.listMatches()) {
    assert.ok(Number.isSafeInteger(match.recordIndex));
    assert.ok(Number.isSafeInteger(match.payout));
    assert.ok(Number.isSafeInteger(match.entryFee));
  }

  // A caller that supplies one is not labelled as having defaulted.
  const supplied = createBattleRuntime({
    schedule: { entryMode: 0, scheduleSlotA: 0, scheduleSlotB: 6, progressCounter: 0 }
  });
  assert.equal(supplied.scheduleEvidence(), "CALLER_SUPPLIED");
  assert.deepEqual(supplied.listMatches().map((entry) => entry.recordIndex), [55]);
  runtime.dispose();
  fixture.dispose();
  supplied.dispose();
});

test("a match cannot start before it is chosen, and only an open one may be", () => {
  const runtime = createBattleRuntime();
  assert.throws(() => runtime.startMatch(), /NO_MATCH_CHOSEN/);
  assert.throws(() => runtime.outcome(), /NO_MATCH_STARTED/);
  assert.throws(() => runtime.getEconomyContext(), /NO_MATCH_CHOSEN/);
  assert.throws(() => runtime.getSettlementResult(), /NO_MATCH_STARTED/);
  assert.throws(() => runtime.chooseMatch(9999), /MATCH_IS_NOT_OPEN/);
  assert.equal(runtime.getChosenMatch(), null);
  assert.equal(runtime.rosterEvidence(), null);
  runtime.dispose();
});

test("a chosen match builds six slots out of real tables", () => {
  const runtime = createBattleRuntime({ schedule: AUTUMN_DAY4_SCHEDULE });
  const match = runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
  assert.equal(runtime.getChosenMatch().recordIndex, match.recordIndex);

  const source = runtime.startMatch();
  assert.equal(runtime.startMatch(), source, "starting twice reuses the one session");
  assert.throws(() => runtime.chooseMatch(match.recordIndex), /MATCH_ALREADY_STARTED/,
    "an active session cannot be relabelled as another economic attempt");
  const view = source.getView();
  assert.equal(view.combatants.length, 6);

  // Both sides are ROM teams now, and either may hold fewer than three.
  assert.ok(view.combatants.slice(0, 3).some((entry) => entry.present), "the player side is filled");
  assert.ok(view.combatants.slice(3).some((entry) => entry.present), "the match has an opponent");

  // Every HP is a row of the ROM's curve.
  for (const combatant of view.combatants) {
    if (!combatant.present) continue;
    assert.ok(combatant.hp.maximum >= 200 && combatant.hp.maximum <= 7000);
  }
  // The product creatures are out of the battle path, so every combatant in a
  // match now comes out of the cartridge and the roster says so.
  assert.equal(runtime.rosterEvidence(), "VERIFIED_BINARY");
  runtime.dispose();
});

test("the pool is the original's twelve, and exhausting it is not an error", () => {
  const runtime = createBattleRuntime({ schedule: AUTUMN_DAY4_SCHEDULE });
  runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
  const source = runtime.startMatch();
  // A real match now resolves, so this stops at the verdict rather than assuming
  // the battle is still running after a fixed number of frames.
  for (let frame = 0; frame < 400 && !source.getView().outcome.ended; frame += 1) source.tick();

  const view = source.getView();
  assert.ok(view.clock.frames > 0);
  assert.ok(view.clock.frames < BATTLE_OUTCOME_TIME_LIMIT_FRAMES);
  assert.equal(BATTLE_LAUNCH_POOL_SIZE, 12);

  const module = fs.readFileSync(path.join(root, "src/championship/app/battleRuntime.js"), "utf8");
  // The phrase wraps across comment lines, so the gap has to be allowed for.
  assert.match(module, /cannot launch, which is the ROM's\s*\n\s*\/\/ behaviour and not an error/);
  runtime.dispose();
});

test("observers are given the current view and stop on dispose", () => {
  const runtime = createBattleRuntime({ schedule: AUTUMN_DAY4_SCHEDULE });
  runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
  runtime.startMatch();
  const seen = [];
  const off = runtime.observe((view) => seen.push(view));
  assert.equal(seen.length, 1, "an observer is handed the current view at once");
  off();
  assert.throws(() => runtime.observe(null), /OBSERVER_MUST_BE_A_FUNCTION/);
  runtime.dispose();
  assert.throws(() => runtime.outcome(), /NO_MATCH_STARTED/);
});

test("the screens import display copy only and cannot reach into the runtime", () => {
  const imports = [...screens.matchAll(/^import .* from "([^"]+)";/gm)].map(match => match[1]);
  assert.deepEqual(imports.sort(), ["../text/uiText.js", "../text/zhHant.js"]);
  assert.doesNotMatch(screens, /import\s*\(/);
  assert.match(screens, /export function createBattleSelectView/);
  assert.match(screens, /export function createBattleFieldView/);
  assert.match(screens, /export function createBattleResultView/);
});

test("no screen offers a control that implies choosing an action mid-match", () => {
  // VS5 is Auto Battle and no traced site reads input during a match, so the
  // only button on the match screen is the one that leaves.
  const matchView = screens.slice(screens.indexOf("createBattleFieldView"), screens.indexOf("createBattleResultView"));
  const buttons = matchView.match(/actionButton\(/g) ?? [];
  assert.equal(buttons.length, 1, "exactly one control on the match screen");
  assert.match(matchView, /actionButton\("離開對戰"\)/);
  const code = screens.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of ["attack", "defend", "command", "skill", "accuracy", "damageNumber"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(code), false, forbidden);
  }
});

test("the stylesheet retains the field aspect and fits the available app height", () => {
  // styles.css is claimed by both manifests, so this lane adds a file rather
  // than editing a contested one.
  assert.match(styles, /aspect-ratio: 3 \/ 2/);
  assert.match(styles, /max-width: min\(100%, calc\(var\(--cm-screen-height, 100dvh\) \* 9 \/ 16\)\)/);
  assert.match(styles, /max-height: 100%/);
  const html = fs.readFileSync(path.join(root, "championship.html"), "utf8");
  assert.match(html, /vs5Styles\.css/);
  const appStyles = fs.readFileSync(path.join(root, "src/championship/app/styles.css"), "utf8");
  assert.equal(/cm-vs5-/.test(appStyles), false, "and it adds nothing to the contested one");
});

test("the three battle intents are named, so no generic push can reach a match", () => {
  const app = fs.readFileSync(path.join(root, "src/championship/app/championshipStandaloneApp.js"), "utf8");
  for (const intent of ["openBattle", "enterMatch", "finishMatch", "exitBattle"]) {
    assert.match(app, new RegExp(`\\b${intent}\\s*\\(`), intent);
  }
  assert.match(app, /CHAMPIONSHIP_BATTLE_SELECT_NOT_ACTIVE/);
  // The result screen is reachable only from a running match.
  assert.match(app, /The battle judges itself; nothing else may push the result screen/);
});

test("settlement reads one completed numeric round before publishing the final view", () => {
  for (const battleType of [0, 2]) {
    const runtime = createBattleRuntime({ schedule: AUTUMN_DAY4_SCHEDULE, mode: 0, battleType, seed: 0x14 });
    runtime.chooseMatch(0);
    assert.deepEqual(runtime.getEconomyContext(), {
      recordIndex: 0, mode: 0, battleType, payout: 7000, entryFee: 150, expectedRounds: 1
    });
    assert.equal(runtime.economyContextEvidence(), "CALLER_SUPPLIED");
    const source = runtime.startMatch();
    assert.deepEqual(runtime.getSettlementResult(), {
      ended: false, verdict: 0, reason: 0, battleType, mode: 0, matchIndex: 0,
      roundCursor: 0, outcomeEntries: []
    });
    let publishedResult = null;
    runtime.observe((view) => {
      if (view.outcome.ended) publishedResult = runtime.getSettlementResult();
    });
    for (let frame = 0; frame < 8000 && !source.getView().outcome.ended; frame += 1) source.tick();
    assert.ok(publishedResult?.ended, "the result is ready inside the final observer");
    assert.ok(Number.isSafeInteger(publishedResult.verdict));
    assert.equal(publishedResult.roundCursor, 1);
    assert.deepEqual(publishedResult.outcomeEntries,
      [verdictIsWin(publishedResult.verdict, battleType) ? 1 : 0]);
    assert.equal(Object.isFrozen(publishedResult), true);
    assert.equal(Object.isFrozen(publishedResult.outcomeEntries), true);
    source.tick();
    source.tick();
    assert.deepEqual(runtime.getSettlementResult(), publishedResult,
      "additional reads and ticks do not append unused or duplicate rounds");
    runtime.dispose();
    assert.throws(() => runtime.getSettlementResult(), /NO_MATCH_STARTED/);
  }
});

test("economic fixture defaults do not imply a traced mapping from menu entry mode", () => {
  const runtime = createBattleRuntime({ schedule: { entryMode: 4 } });
  runtime.chooseMatch(61);
  assert.equal(BATTLE_RUNTIME_DEFAULT_ECONOMY_CONTEXT_EVIDENCE, "PRODUCT_AUTHORED");
  assert.equal(runtime.economyContextEvidence(), "PRODUCT_AUTHORED");
  assert.deepEqual(runtime.getEconomyContext(), {
    recordIndex: 61, mode: 0, battleType: 0, payout: 2500, entryFee: 0, expectedRounds: 1
  });
  assert.throws(() => createBattleRuntime({ mode: 6 }), /MODE_MUST_BE_0_TO_5/);
  assert.throws(() => createBattleRuntime({ battleType: -1 }), /INVALID_BATTLE_TYPE/);
  runtime.dispose();
});

test("the runtime imports nothing outside src and the contracts", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/app/battleRuntime.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});

test("all five contract bands exist in the DOM, and the CSS locks their heights", () => {
  const contract = JSON.parse(fs.readFileSync(path.join(root, "docs/contracts/championship/battle-field-presentation.v1.json"), "utf8"));

  // The class each band is built with, in the contract's own order.
  const bandClass = {
    CLOCK: "cm-vs5-clock",
    OPPONENT_HUD: "cm-vs5-roster--opponent",
    FIELD: "cm-vs5-field",
    PLAYER_HUD: "cm-vs5-roster--player",
    EVENT_LOG: "cm-vs5-log"
  };
  assert.deepEqual(contract.bands.map((band) => band.id), Object.keys(bandClass));

  // Every one is actually built. An earlier revision shipped three of five and
  // called the screen done, so this asserts the DOM side, not just the CSS.
  for (const [id, className] of Object.entries(bandClass)) {
    assert.ok(screens.includes(`"${className}"`) || screens.includes(`${className}`), `${id} is built`);
  }
  assert.match(screens, /section\.append\(clock\.band, opponents, host, players, log\.band\)/,
    "and appended in the contract's order");

  // And the CSS height of each band is the contract's, to the digit. Compared
  // on whitespace-collapsed text rather than by regex, so a reformat of the
  // stylesheet cannot quietly turn this assertion off.
  const flat = styles.replace(/\s+/g, " ");
  for (const band of contract.bands) {
    const percent = Number((band.height * 100).toFixed(4));
    assert.ok(flat.includes(`.${bandClass[band.id]} { flex: 0 0 ${percent}%`),
      `${band.id} is locked at ${percent}%`);
  }
  // The shell is the frame, so those percentages are percentages of 9:16.
  assert.ok(flat.includes("aspect-ratio: 9 / 16"));
  // And they add up to the whole frame, which is what makes them a layout.
  assert.equal(Number(contract.bands.reduce((total, band) => total + band.height, 0).toFixed(6)), 1);
});

test("the band layout is labelled product-authored, not an original layout", () => {
  const contract = JSON.parse(fs.readFileSync(path.join(root, "docs/contracts/championship/battle-field-presentation.v1.json"), "utf8"));
  // The ROM's _main / _sub witnesses prove a portrait orientation. They do not
  // prove this arrangement, and the contract must not read as though they do.
  assert.match(contract.frame.note, /PORTRAIT ORIENTATION and nothing more/);
  assert.match(contract.frame.note, /PRODUCT-AUTHORED re-arrangement/);
  // The note may still MENTION the claim; what it must not do is make it. The
  // earlier wording asserted it outright, and that exact form must not return.
  assert.equal(/the bands below are what the second screen carried/.test(contract.frame.note), false);
  assert.match(contract.frame.note, /would overstate what the witnesses prove/);
  assert.equal(contract.originalParityClaim, false);
  assert.match(styles, /They are PRODUCT-AUTHORED: the ROM/);
});

test("a full match now deals damage and reaches a verdict", () => {
  const runtime = createBattleRuntime({ schedule: AUTUMN_DAY4_SCHEDULE });
  runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
  const source = runtime.startMatch();

  const before = source.getView().combatants.map((entry) => (entry.present ? entry.hp.current : null));
  for (let frame = 0; frame < 8000 && !source.getView().outcome.ended; frame += 1) source.tick();
  const view = source.getView();

  // The chain end to end: AI selection, the move buckets, the move script on the
  // VM, the attack native at 0x0211D71C, the resolver, and the HP write.
  const after = view.combatants.map((entry) => (entry.present ? entry.hp.current : null));
  assert.notDeepEqual(after, before, "somebody took damage");
  assert.ok(after.some((hp, slot) => hp !== null && hp < before[slot]), "and it went down, not up");

  // applyBattleHp has no floor, but 0x0210D798 clamps a dead combatant back to
  // zero on the frame the death is detected, so nobody is left negative.
  assert.ok(after.every((hp) => hp === null || hp >= 0), "and the clamp pulls a corpse back to zero");
  assert.ok(view.combatants.some((entry) => entry.present && entry.down), "somebody is marked down");

  assert.equal(view.outcome.ended, true);
  assert.ok(["TIME_UP", "TEAM_DOWN"].includes(view.outcome.reason));
  assert.ok(["TEAM_ZERO_AHEAD", "TEAM_ONE_AHEAD", "LEVEL"].includes(view.outcome.verdict));
  runtime.dispose();
});

test("the side field is set per team, and without it nobody can be targeted", async () => {
  const { combatantFieldsFor } = await import("../src/championship/app/battleRosterSource.js");
  const { rejectActionTarget } = await import("../src/championship/battle/battleActionApplication.js");

  const creature = { currentHp: 100, maxHp: 100, metricBase: 10, metricLimit: 10, source12C: 0, source130: 0, speciesId: 50 };
  const mine = combatantFieldsFor(creature, 0);
  const theirs = combatantFieldsFor(creature, 3);
  assert.notEqual(mine.field54, theirs.field54, "the two teams differ");

  // Only inequality matters to the walk, which is why the specific values do
  // not need tracing. Equal sides are refused.
  assert.equal(rejectActionTarget({ field54: mine.field54 }, { field54: theirs.field54 }), null);
  assert.equal(rejectActionTarget({ field54: mine.field54 }, { field54: mine.field54 }), "SAME_SIDE");

  const roster = fs.readFileSync(path.join(root, "src/championship/app/battleRosterSource.js"), "utf8");
  assert.match(roster, /Which VALUES the original stores is not/);
  // And the species id has to travel too, or every combatant buckets as species 0.
  assert.equal(mine.speciesId, 50);
  assert.match(roster, /the session builds its move buckets for species 0/);
});
