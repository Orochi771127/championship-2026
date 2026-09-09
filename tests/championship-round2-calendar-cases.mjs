import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createBattleRuntime } from "../src/championship/app/battleRuntime.js";
import { createScheduleView } from "../src/championship/app/scheduleScreen.js";
import { createChampionshipStatusBar } from "../src/championship/app/championshipStatusBar.js";
import { createBattleSelectView } from "../src/championship/app/vs5Screens.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function createApp(storage = memoryStorage()) {
  return createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages,
    now: () => "2026-09-05T10:00:00.000Z" });
}

test("new game calendar and Battle list share actual Spring Day 1 instead of a forced MATCH 00 date", async (t) => {
  const app = createApp();
  t.after(() => app.dispose());
  await app.newGame();
  const calendar = app.getCalendar();
  assert.equal(calendar.season, 0);
  assert.equal(calendar.dayOfSeason, 0);
  assert.equal(calendar.time, "07:00");
  const schedule = app.getBattleSchedule();
  assert.equal(schedule.scheduleSlotA, calendar.season);
  assert.equal(schedule.scheduleSlotB, calendar.dayOfSeason);
  const runtime = createBattleRuntime({ schedule });
  t.after(() => runtime.dispose());
  const ids = runtime.listMatches().map((entry) => entry.recordIndex);
  assert.deepEqual(ids, app.getAvailableBattleRecordIndices());
  assert.equal(ids.includes(0), false, "MATCH 00 is an Autumn Day 4 record, not a universal start match");
  app.advanceClock({ units: 19 * 1440 * 400 });
  assert.equal(app.getCalendar().season, 2);
  assert.equal(app.getCalendar().dayOfSeason, 3);
  assert.equal(app.getAvailableBattleRecordIndices().includes(0), true);
});

test("calendar change after selection rejects stale entry before fee or attempt allocation", async (t) => {
  const app = createApp();
  t.after(() => app.dispose());
  await app.newGame();
  app.advanceClock({ units: 19 * 1440 * 400 });
  app.creditBits(1000);
  app.openBattle();
  const mountedList = createBattleRuntime({ schedule: app.getBattleSchedule() });
  t.after(() => mountedList.dispose());
  mountedList.chooseMatch(0);
  const selected = mountedList.getEconomyContext();
  const beforeEconomy = app.getBattleEconomyState();
  // Controlled domain advancement represents a stale menu event; natural
  // Battle mode time remains evidence-gated in this slice.
  app.advanceClock({ units: 1440 * 400 });
  const refused = app.enterMatch({ ...selected, attemptId: "battle:1" });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "MATCH_NOT_AVAILABLE");
  assert.equal(app.getShopFrame().bits, 1000);
  assert.equal(app.getBattleEconomyState(), beforeEconomy);
  assert.equal(app.getScreen(), "BATTLE_SELECT");
  assert.deepEqual(app.getAvailableBattleRecordIndices().includes(0), false);
});

test("legacy save with unknown calendar does not manufacture a today's Battle list", async (t) => {
  const storage = memoryStorage();
  const original = createApp(storage);
  t.after(() => original.dispose());
  await original.newGame();
  original.creditBits(1000);
  assert.equal(original.save().phase, "SAVED");
  const envelope = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  const legacy = JSON.parse(envelope.raisingHome);
  legacy.schemaVersion = 1;
  for (const field of ["year", "season", "dayOfSeason", "clockUnits", "clockSubunits", "clockRevision", "paused"]) {
    delete legacy.payload[field];
  }
  delete legacy.adaptationRef;
  delete legacy.payloadDigest;
  envelope.raisingHome = JSON.stringify(legacy);
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(envelope));
  const restored = createApp(storage);
  t.after(() => restored.dispose());
  await restored.continueGame();
  assert.equal(restored.getCalendar().season, null);
  assert.equal(restored.getCalendar().dayOfSeason, null);
  assert.equal(restored.getBattleSchedule(), null);
  assert.deepEqual(restored.getAvailableBattleRecordIndices(), []);
  const runtime = createBattleRuntime({ schedule: restored.getBattleSchedule() });
  t.after(() => runtime.dispose());
  assert.deepEqual(runtime.listMatches(), []);
  restored.openBattle();
  assert.equal(restored.enterMatch({ recordIndex: 0, mode: 0, battleType: 0 }).reason, "MATCH_NOT_AVAILABLE");
  assert.equal(restored.getShopFrame().bits, 1000);
});

test("care after a saved 22:00 clock stop must dirty the same save independently of future ticks", async (t) => {
  const app = createApp();
  t.after(() => app.dispose());
  await app.newGame();
  app.advanceClock({ units: (22 * 60 - 7 * 60) * 400 });
  assert.equal(app.getClockRunState().reason, "DAY_END");
  assert.equal(app.save().phase, "SAVED");
  const creatureId = app.getRaisingInstances()[0].instanceId;
  const previousCount = app.resolveRaisingInstance(creatureId).interaction?.careCount ?? 0;
  app.care(creatureId);
  assert.equal(app.resolveRaisingInstance(creatureId).interaction.careCount, previousCount + 1);
  assert.equal(app.savePort.getStatus().phase, "DIRTY", "the stopped clock cannot mask a missing care dirty notification");
});

// Deliberately small DOM boundary: it verifies changing text/ARIA/date state,
// not browser layout or rendering, which are covered by live browser QA.
class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.classList = { add: (name) => { this.className = `${this.className} ${name}`.trim(); } };
    this.textContent = "";
    this.style = { setProperty() {}, removeProperty() {} };
    this.listeners = {};
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(key, value) { this.listeners[key] = value; }
  getBoundingClientRect() { return { height: 31 }; }
  remove() {}
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]).filter((node) => {
      if (selector === "*") return true;
      if (selector.startsWith(".")) return node.className.split(" ").includes(selector.slice(1));
      if (selector === "[data-record-index]") return Object.hasOwn(node.dataset, "recordIndex");
      return false;
    });
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

function useDocument(t) {
  const previous = globalThis.document;
  const body = new Element("body");
  globalThis.document = { body, createElement: (tag) => new Element(tag) };
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  return new Element("main");
}

test("Schedule today marker and eligibility update together, then clear when date becomes unknown", (t) => {
  const root = useDocument(t);
  const view = createScheduleView({ root, calendar: { season: 0, dayOfSeason: 0 }, eligibleRecordIndices: [] });
  t.after(() => view.dispose());
  const today = () => root.querySelectorAll(".cm-schedule-day").filter((node) => node.attributes["aria-current"] === "date");
  assert.equal(today().length, 1);
  assert.deepEqual([today()[0].dataset.season, today()[0].dataset.dayOfSeason], ["0", "0"]);
  view.render({ calendar: { season: 2, dayOfSeason: 3 }, eligibleRecordIndices: [0] });
  assert.equal(today().length, 1);
  assert.deepEqual([today()[0].dataset.season, today()[0].dataset.dayOfSeason], ["2", "3"]);
  const eligible = root.querySelectorAll("[data-record-index]").filter((node) => node.dataset.eligibleToday === "true");
  assert.deepEqual(eligible.map((node) => Number(node.dataset.recordIndex)), [0]);
  view.render({ calendar: { season: null, dayOfSeason: null }, eligibleRecordIndices: [] });
  assert.equal(today().length, 0);
  assert.equal(root.querySelectorAll("[data-record-index]").some((node) => node.dataset.eligibleToday === "true"), false);
  assert.deepEqual(view.inspect().today, { season: null, dayOfSeason: null });
  assert.equal(view.inspect().fixtureCount, 61, "unknown current date does not erase the original calendar's fixtures");
});

test("shared Status Bar clears known season and day when restored calendar fields are unknown", (t) => {
  const root = useDocument(t);
  const status = createChampionshipStatusBar({ root });
  t.after(() => status.dispose());
  status.render({ seasonName: "Autumn", dayNumber: 4, time: "07:12", screen: "RAISING_HOME" });
  assert.equal(root.querySelector(".cm-status-bar__season").textContent, "秋季");
  assert.equal(root.querySelector(".cm-status-bar__day-number").textContent, "4");
  status.render({ seasonName: null, dayNumber: null, time: "07:12", screen: "BATTLE_SELECT" });
  assert.equal(root.querySelector(".cm-status-bar__season").textContent, "—");
  assert.equal(root.querySelector(".cm-status-bar__day-number").textContent, "—");
  assert.equal(Object.hasOwn(root.querySelector(".cm-status-bar__season").dataset, "season"), false);
  assert.equal(root.querySelector(".cm-status-bar__time").textContent, "07:12");
  assert.equal(root.querySelector(".cm-status-bar__mode").textContent, "對戰");
});

test("mounted Battle list follows actual calendar matches through available, empty and available dates", async (t) => {
  const root = useDocument(t);
  const app = createApp();
  t.after(() => app.dispose());
  await app.newGame();
  const matchesForToday = () => {
    const runtime = createBattleRuntime({ schedule: app.getBattleSchedule() });
    const matches = runtime.listMatches();
    runtime.dispose();
    return matches;
  };
  app.advanceClock({ units: 19 * 1440 * 400 });
  const available = matchesForToday();
  assert.equal(available.some((match) => match.recordIndex === 0), true);
  const entered = [];
  const view = createBattleSelectView({ root, matches: available, onEnter: (id) => entered.push(id),
    menuCopy: { menu: "Battle", kicker: "Battle", chooseMatch: "Choose", availableMatches: "Matches",
      noMatch: "No matches today", noPayout: "No prize", returnHome: "Home" } });
  t.after(() => view.dispose());
  const shownIds = () => root.querySelectorAll(".cm-vs5-match").map((node) => Number(node.dataset.recordIndex));
  assert.deepEqual(shownIds(), available.map((match) => match.recordIndex));
  let emptyDateFound = false;
  for (let day = 1; day <= 32; day += 1) {
    app.advanceClock({ units: 1440 * 400 });
    if (matchesForToday().length === 0) { emptyDateFound = true; break; }
  }
  assert.equal(emptyDateFound, true, "the real rank-zero annual calendar contains a date without available matches");
  view.render({ matches: matchesForToday() });
  assert.deepEqual(shownIds(), []);
  assert.equal(root.querySelectorAll(".cm-vs5-match__enter").length, 0);
  assert.equal(root.querySelector(".cm-vs5-matches__empty").textContent, "No matches today");
  for (let day = 1; day <= 32; day += 1) {
    app.advanceClock({ units: 1440 * 400 });
    if (matchesForToday().length > 0) break;
  }
  const next = matchesForToday();
  assert.ok(next.length > 0);
  view.render({ matches: next });
  assert.deepEqual(shownIds(), next.map((match) => match.recordIndex));
  assert.equal(root.querySelector(".cm-vs5-matches__empty"), null);
  root.querySelector(".cm-vs5-match__enter").listeners.click();
  assert.deepEqual(entered, [next[0].recordIndex], "a refreshed button emits its current record identity");
});
