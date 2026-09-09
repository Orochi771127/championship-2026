import test from "node:test";
import assert from "node:assert/strict";
import { createHelpView } from "../src/championship/app/helpScreen.js";
import { createScheduleView } from "../src/championship/app/scheduleScreen.js";
import { createDigimonListView } from "../src/championship/app/digimonListScreen.js";
import { createTamerInfoView } from "../src/championship/app/tamerInfoScreen.js";
import { createShopView, createDatabaseView } from "../src/championship/app/vs4Screens.js";
import { createHuntResultView } from "../src/championship/app/vs3Screens.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { listShopRecords } from "../src/championship/shop/shopCatalog.js";
import { HELP_ZH, TITLE_EVENTS_ZH, SPECIES_NAMES_ZH } from "../src/championship/text/catalogs.zhHant.js";

// Tests mounted text, attributes, and original intent arguments. Actual layout
// is checked separately in the browser at the required mobile viewports.
class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {};
    this.className = ""; this.textContent = ""; this.listeners = {}; this.hidden = false;
    this.style = { setProperty() {}, removeProperty() {} };
    this.classList = { add: name => { this.className += ` ${name}`; } };
  }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(key, listener) { this.listeners[key] = listener; }
  click() { if (!this.disabled) this.listeners.click?.(); }
  scrollIntoView() {}
  querySelectorAll(selector) {
    return this.children.flatMap(child => [child, ...child.querySelectorAll("*")]).filter(node => {
      if (selector === "*") return true;
      if (selector.startsWith(".")) return node.className.split(" ").includes(selector.slice(1));
      const data = /^\[data-([\w-]+)\]$/.exec(selector);
      if (data) return Object.hasOwn(node.dataset, data[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
      return node.tagName === selector;
    });
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

function useDocument(t) {
  const old = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag), activeElement: null };
  t.after(() => { if (old === undefined) delete globalThis.document; else globalThis.document = old; });
  return new Element("main");
}
const allNodes = root => [root, ...root.querySelectorAll("*")];
const visibleCopy = root => allNodes(root).flatMap(node => [node.textContent, node.attributes["aria-label"], node.title]).filter(Boolean).join("\n");
// G is the original capacity unit, and α/β/γ are item variant marks.
const noForeignCopy = root => assert.doesNotMatch(visibleCopy(root).replace(/\d+G\b/g, ""), /[a-zA-Z\p{Script=Katakana}\p{Script=Hiragana}]/u);
const buttonWithText = (root, text) => root.querySelectorAll("button").find(node => node.textContent === text);
function sourceFor(screen, overrides) {
  const app = new Proxy({
    getScreen: () => screen, getScreenTrail: () => [screen],
    savePort: { getStatus: () => ({ phase: "CLEAN" }), subscribe: () => () => {} },
    ...overrides
  }, { get: (target, key) => key in target ? target[key] : () => null });
  return createGateHuntPresentationSource(app);
}

test("mounted Help translates all 84 entries and all 68 selectable bodies", t => {
  const root = useDocument(t);
  const view = createHelpView({ root });
  const topics = root.querySelectorAll(".cm-help-topic");
  assert.equal(topics.length, 68);
  assert.equal(root.querySelectorAll(".cm-help-heading").length, 16);
  for (const topic of topics) {
    topic.click();
    const id = Number(topic.dataset.entryIndex);
    assert.equal(root.querySelector(".cm-help-detail__body").textContent, HELP_ZH[id].body);
    assert.equal(view.inspect().selectedEntryIndex, id);
    noForeignCopy(root);
  }
});

test("mounted Schedule translates each fixture while preserving season/day/rank and fee", t => {
  const root = useDocument(t);
  const view = createScheduleView({ root, calendar: { season: 0, dayOfSeason: 0 } });
  const fixtures = root.querySelectorAll(".cm-schedule-fixture");
  assert.equal(fixtures.length, 61);
  for (const fixture of fixtures) {
    fixture.click();
    const id = Number(fixture.dataset.recordIndex);
    assert.equal(root.querySelector(".cm-schedule-detail__name").textContent, TITLE_EVENTS_ZH[id].name);
    assert.equal(view.inspect().selectedRecordIndex, id);
    noForeignCopy(root);
  }
});

test("Shop uses the existing equipment identities for all 118 rows, including locked items", t => {
  const root = useDocument(t);
  const raw = { bits: 9999999, listings: listShopRecords().map(record => ({ ...record, owned: 0, visibility: "NEW" })) };
  const before = JSON.stringify(raw);
  const source = sourceFor("SHOP", { getShopFrame: () => raw });
  const frame = source.getFrame();
  assert.equal(frame.shop.listings.length, 118);
  const bought = [];
  createShopView({ root, source: { getFrame: () => frame, intents: { buyShopItem: (...args) => bought.push(args) } } });
  let count = 0;
  for (const tab of root.querySelectorAll(".cm-vs2-shop__tab")) {
    tab.click();
    const rows = root.querySelectorAll(".cm-vs2-shop__row");
    count += rows.length;
    noForeignCopy(root);
    for (const row of rows) row.querySelector(".cm-vs2-shop__buy").click();
  }
  assert.equal(count, 118);
  assert.deepEqual(bought.map(([id]) => id).sort((a, b) => a - b), listShopRecords().map(row => row.shopRecordIndex));
  assert.ok(bought.every(([, quantity]) => quantity === 1));
  assert.equal(JSON.stringify(raw), before, "display translation cannot mutate price, unlock or inventory records");
});

test("Database translates every registered species without revealing unregistered entries", t => {
  const root = useDocument(t);
  const entries = Object.entries(SPECIES_NAMES_ZH).map(([id], index) => ({
    speciesIndex: Number(id), bookOrdinal: index, state: "REGISTERED", displayName: `M_${id}`
  }));
  const frame = { screen: "DATABASE", database: { entries, selected: null, registeredCount: 216, slotCount: 216 } };
  const selected = [];
  const view = createDatabaseView({ root, source: { getFrame: () => frame, intents: { selectDatabaseSpecies: id => selected.push(id) } } });
  for (const row of root.querySelectorAll(".cm-vs2-database__row")) row.click();
  assert.deepEqual(selected, entries.map(entry => entry.speciesIndex));
  noForeignCopy(root);
  view.render({ ...frame, database: { ...frame.database, entries: [{ ...entries[0], state: "UNDISCOVERED" }] } });
  assert.doesNotMatch(visibleCopy(root), /黏液獸|M_8/);
});

test("roster labels are Chinese and player names bypass UI translation and casing", t => {
  const root = useDocument(t);
  for (const name of ["HUNT", "Spring", "HP", "MiXeD小火", "<script>測試</script>"]) {
    createDigimonListView({ root, entries: [{ displayName: name, identity: { speciesName: "亞古獸", familyBits: 0 } }] });
    assert.equal(root.querySelector(".cm-digimon-item__name").textContent, name);
    assert.equal(root.querySelector(".cm-digimon-detail__value").textContent, name);
    assert.equal(root.querySelector(".cm-digimon-title").textContent, "夥伴名單");
  }
});

test("Tamer Info translates unknown field labels without filling unknown values", t => {
  const root = useDocument(t);
  const view = createTamerInfoView({ root, walletBits: 1024, rosterCount: 3, tamerRank: 2 });
  assert.equal(view.inspect().sourcedCount, 3);
  const values = root.querySelectorAll(".cm-tamer-field__value");
  assert.equal(values.find(row => row.dataset.fieldId === "money").textContent, "0001024");
  assert.equal(values.find(row => row.dataset.fieldId === "guid").textContent, "---");
  noForeignCopy(root);
});

test("Hunt Result translates failure/release UI without committing a displayed default name", t => {
  const root = useDocument(t);
  const block = {
    title: "HUNT RESULT", outcomeLabel: "ON MEMORY CARD", speciesId: "species-034",
    speciesLabel: "SPECIES 034", displayName: "亞古獸", commitError: "SAVE_FAILED",
    rows: [{ kind: "CARD", key: "card:wild-3", displayName: "HUNT", canRelease: true }]
  };
  const names = [], releases = []; let home = 0;
  const source = { getFrame: () => ({ screen: "HUNT_RESULT", huntResult: block }), intents: {
    setHuntResultName: name => names.push(name), confirmHuntResult: () => home++, requestHuntResultRelease: key => releases.push(key)
  } };
  const view = createHuntResultView({ root, source });
  assert.equal(root.querySelector(".cm-vs2-result__species").textContent, "亞古獸");
  assert.match(visibleCopy(root), /儲存失敗/);
  buttonWithText(root, "返回育成").click();
  assert.equal(home, 1); assert.deepEqual(names, []);
  buttonWithText(root, "放生").click();
  assert.deepEqual(releases, ["card:wild-3"]);
  view.render({ huntResult: { ...block, commitError: "HOME_ROSTER_FULL", pendingRelease: block.rows[0] } });
  assert.match(visibleCopy(root), /要放生「HUNT」嗎？/);
  assert.match(visibleCopy(root), /育成夥伴名單已滿/);
  const input = root.querySelector("input"); input.value = "MiXeD小火"; input.listeners.input();
  assert.deepEqual(names, ["MiXeD小火"]);
});

test("Hunt result projection distinguishes an unnamed card entry from a user name matching a label", () => {
  const raw = { title: "HUNT RESULT", wildId: "wild-1", speciesId: "species-034", displayName: "SPECIES 034",
    rows: [{ kind: "CARD", id: "wild-1", key: "card:wild-1", displayName: "SPECIES 034" },
      { kind: "CARD", id: "wild-2", key: "card:wild-2", displayName: "HUNT" }] };
  const cards = [{ wildId: "wild-1", speciesId: "species-034", displayName: null },
    { wildId: "wild-2", speciesId: "species-034", displayName: "HUNT" }];
  const before = JSON.stringify({ raw, cards });
  const source = sourceFor("HUNT_RESULT", {
    getHuntResult: () => raw, getHuntRuntime: () => ({ getOnCardEntries: () => cards }), getRaisingInstances: () => []
  });
  const frame = source.getFrame().huntResult;
  assert.equal(frame.displayName, "亞古獸");
  assert.deepEqual(frame.rows.map(row => row.displayName), ["亞古獸", "HUNT"]);
  assert.equal(JSON.stringify({ raw, cards }), before);
});
