import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import { createHelpView } from "../src/championship/app/helpScreen.js";
import { createScheduleView } from "../src/championship/app/scheduleScreen.js";
import { createDigimonListView } from "../src/championship/app/digimonListScreen.js";
import { createTamerInfoView } from "../src/championship/app/tamerInfoScreen.js";
import { createShopView, createDatabaseView, shopItemDescription } from "../src/championship/app/vs4Screens.js";
import { createHuntResultView } from "../src/championship/app/vs3Screens.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { listShopRecords } from "../src/championship/shop/shopCatalog.js";
import { HELP_ZH, TITLE_EVENTS_ZH } from "../src/championship/text/catalogs.zhHant.js";
import {NATIVE_REGULAR_BOOK_SPECIES} from '../src/data/championship/nativeBookSpecies.js';
import {DATABASE_DISPLAY_CATALOG} from '../src/championship/database/databaseDisplayCatalog.js';

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
  removeEventListener(key, listener) { if (this.listeners[key] === listener) delete this.listeners[key]; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
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
  const document = { activeElement: null };
  document.createElement = tag => Object.assign(new Element(tag), {ownerDocument: document});
  document.documentElement = document.createElement('html');
  document.documentElement.lang = 'zh-Hant';
  globalThis.document = document;
  t.after(() => { if (old === undefined) delete globalThis.document; else globalThis.document = old; });
  return document.createElement("main");
}
const allNodes = root => [root, ...root.querySelectorAll("*")];
const visibleCopy = root => allNodes(root).flatMap(node => [node.textContent, node.attributes["aria-label"], node.title]).filter(Boolean).join("\n");
// G is the original capacity unit, and α/β/γ are item variant marks.
const noForeignCopy = root => assert.doesNotMatch(visibleCopy(root).replace(/\d+\s*G\b/g, ""), /[a-zA-Z\p{Script=Katakana}\p{Script=Hiragana}]/u);
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
  assert.match(shopItemDescription(frame.shop.listings[2]), /受傷.*傷藥/);
  assert.match(shopItemDescription(frame.shop.listings[3]), /生病.*藥品/);
  const fullAnalyzer = frame.shop.listings.find(row => row.category === "PLUGINS" && row.subcategory === "ANALYZER" && row.itemIndex === 8);
  assert.match(shopItemDescription(fullAnalyzer), /世代、種族、陣營、生命值、性格、所需容量/);
  const bought = [];
  const view = createShopView({ root, source: { getFrame: () => frame, intents: { buyShopItem: (...args) => bought.push(args) } } });
  assert.deepEqual(view.inspect(), { layout: "ARCADE_GRID_R1", sheetOpen: false, activeCategory: "TRAINING_GOODS", selectedShopRecordIndex: 0, listingCount: 118 });
  assert.ok(root.querySelector(".cm-vs2-shop__detail"));
  assert.ok(root.querySelector(".cm-vs2-shop__shelf"));
  assert.equal(root.querySelectorAll(".cm-vs2-shop__buy").length, 1, "the original flow has one Buy action for the selected item");
  let count = 0;
  for (const tab of root.querySelectorAll(".cm-vs2-shop__tab")) {
    tab.click();
    const rows = root.querySelectorAll(".cm-vs2-shop__row");
    count += rows.length;
    noForeignCopy(root);
    for (const row of rows) {
      row.click();
      root.querySelector(".cm-vs2-shop__buy").click();
    }
  }
  assert.equal(count, 118);
  assert.deepEqual(bought.map(([id]) => id).sort((a, b) => a - b), listShopRecords().map(row => row.shopRecordIndex));
  assert.ok(bought.every(([, quantity]) => quantity === 1));
  assert.equal(JSON.stringify(raw), before, "display translation cannot mutate price, unlock or inventory records");
});

test("Database translates every registered species without revealing unregistered entries", t => {
  const root = useDocument(t);
  // Preserve the original registration oracle independently of the live display.
  assert.equal(NATIVE_REGULAR_BOOK_SPECIES.length,216);
  assert.equal(createHash('sha256').update(JSON.stringify(NATIVE_REGULAR_BOOK_SPECIES)).digest('hex'),
    '577aac3c81ffaa86239e064c39e8c708c659ea90533d693504a6ffe33af23ab8');
  // Owner 2026-11-03: the playable originals are regular book entries too.
  const PLAYABLE=[231,232,234,235,236,237,239,240];
  const registeredSpecies=[...NATIVE_REGULAR_BOOK_SPECIES,229,230,...PLAYABLE];
  const entries = registeredSpecies.map((id, index) => ({
    speciesIndex: id, bookOrdinal: index, state: "REGISTERED", displayName: `M_${id}`
  }));
  const frame = { screen: "DATABASE", database: { entries, selected: null, registeredCount: 226, slotCount: 226 } };
  const selected = [];
  const view = createDatabaseView({ root, source: { getFrame: () => frame, intents: { selectDatabaseSpecies: id => selected.push(id) } } });
  const allRows=root.querySelectorAll(".cm-vs2-database__row");
  assert.equal(allRows.length,240);
  const rows=allRows.filter(row=>Number(row.dataset.speciesIndex)<231||PLAYABLE.includes(Number(row.dataset.speciesIndex)));
  const playableDisplay=DATABASE_DISPLAY_CATALOG.entries.filter(row=>row.kind!=='ILLUSTRATION');
  assert.equal(rows.length,234);assert.equal(playableDisplay.length,234);
  assert.deepEqual(rows.map(row=>[Number(row.dataset.speciesIndex),row.dataset.displayCode]),
    playableDisplay.map(row=>[row.speciesIndex,row.displayCode]));
  // These explicit owner-approved identities and raw-order checks are independent
  // of the display catalog/renderer, so a shared projection error cannot self-pass.
  for(const [id,code] of [[222,'UL02'],[230,'UL03'],[211,'UL33'],[229,'UL34']]){
    const matches=rows.filter(row=>Number(row.dataset.speciesIndex)===id);
    assert.equal(matches.length,1);assert.equal(matches[0].dataset.displayCode,code);
    assert.equal(matches[0].dataset.state,'REGISTERED');
  }
  const ids=rows.map(row=>Number(row.dataset.speciesIndex));
  assert.equal(new Set(ids).size,234);assert.ok(!ids.includes(228));
  assert.deepEqual(ids.filter(id=>id>=8).sort((a,b)=>a-b),[...registeredSpecies].sort((a,b)=>a-b));
  assert.deepEqual(ids.filter(id=>id>=8&&![211,222,229,230,...PLAYABLE].includes(id)),
    NATIVE_REGULAR_BOOK_SPECIES.filter(id=>![211,222].includes(id)).map(id=>id===121?125:id===125?121:id));
  assert.deepEqual(['EG','B1','B2','GR','MA','AW','UL'].map(prefix=>rows.filter(row=>row.dataset.displayCode.startsWith(prefix)).length),[8,12,14,41,69,51,39]);
  assert.equal(rows.at(-1).dataset.displayCode,'UL39');
  for (const row of rows) row.click();
  assert.deepEqual(selected,playableDisplay.map(row=>row.numberingStageIndex===0?null:row.speciesIndex));
  assert.doesNotMatch(visibleCopy(root).replace(/\b(?:EG|B1|B2|GR|MA|AW|UL|ART)\d{2,}\b/g,'').replaceAll('K歌蚪','').replaceAll('Q彈丸',''), /[a-zA-Z\p{Script=Katakana}\p{Script=Hiragana}]/u);
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

test('roster presents current/max vitals and individual details without inventing legacy values',t=>{
  const root=useDocument(t);
  createDigimonListView({root,entries:[{displayName:'夥伴',stats:{currentHp:37,maxHp:240,currentTp:12,maxTp:80,
    capacityG:7,attack:52,defense:31,wisdom:44,speed:29,battleCount:18,rebirthCount:2,winPercent:33.3251953125}}]});
  const values=root.querySelectorAll('.cm-digimon-detail__value').map(n=>n.textContent);
  for(const expected of ['37/240','12/80','7 G','52','31','44','29','18','2','33.3 %'])assert.ok(values.includes(expected),expected);
  assert.equal(values.includes('240'),false,'HP is not silently replaced by its maximum');
  createDigimonListView({root,entries:[{displayName:'舊存檔'}]});
  assert.deepEqual(root.querySelectorAll('.cm-digimon-detail__value').map(n=>n.textContent),['舊存檔']);
});

test("Tamer Info translates unknown field labels without filling unknown values", t => {
  const root = useDocument(t);
  const view = createTamerInfoView({ root, walletBits: 1024, rosterCount: 3, tamerRank: 2 });
  assert.equal(view.inspect().sourcedCount, 5);
  const values = root.querySelectorAll(".cm-tamer-field__value");
  assert.equal(values.find(row => row.dataset.fieldId === "money").textContent, "0001024");
  assert.equal(values.find(row => row.dataset.fieldId === "guid").textContent, "---");
  // ROM 020E1E14 + 2*36 is capacity, not three residents; GACHA_FULL_EFFECTS_20261109 scales it ×1.375 (96 → 132).
  assert.equal(values.find(row => row.dataset.fieldId === "have").textContent, "132 G",'the rank capacity, not three residents');
  assert.equal(values.find(row => row.dataset.fieldId === "cage").textContent, "16");
  noForeignCopy(root);
});

test('Tamer Info uses separate completion and win-percentage rounding and preserves player names',t=>{
  const root=useDocument(t);
  createTamerInfoView({root,trainerName:'HUNT',tamerRank:0,titleCount:4,registeredCount:7,battleRecord:{battles:3,wins:2}});
  const values=root.querySelectorAll('.cm-tamer-field__value');
  const value=id=>values.find(row=>row.dataset.fieldId===id).textContent;
  assert.equal(value('name'),'HUNT');assert.equal(value('title'),'006 %');assert.equal(value('guid'),'003 %');
  assert.equal(value('battle'),'0003');assert.equal(value('win'),'067 %');assert.equal(value('have'),'088 G');
});

test("Hunt Result translates failure/release UI without committing a displayed default name", t => {
  const root = useDocument(t);
  const block = {
    title: "HUNT RESULT", outcomeLabel: "ON MEMORY CARD", speciesId: "species-034",
    speciesLabel: "SPECIES 034", displayName: "火甲龍", commitError: "SAVE_FAILED",
    rows: [{ kind: "CARD", key: "card:wild-3", displayName: "HUNT", canRelease: true }]
  };
  const names = [], releases = []; let home = 0;
  const source = { getFrame: () => ({ screen: "HUNT_RESULT", huntResult: block }), intents: {
    setHuntResultName: name => names.push(name), confirmHuntResult: () => home++, requestHuntResultRelease: key => releases.push(key)
  } };
  const view = createHuntResultView({ root, source });
  assert.equal(root.querySelector(".cm-vs2-result__species").textContent, "火甲龍");
  assert.match(visibleCopy(root), /儲存失敗/);
  buttonWithText(root, "返回牧場").click();
  assert.equal(home, 1); assert.deepEqual(names, []);
  buttonWithText(root, "放生").click();
  assert.deepEqual(releases, ["card:wild-3"]);
  view.render({ huntResult: { ...block, commitError: "HOME_ROSTER_FULL", pendingRelease: block.rows[0] } });
  assert.match(visibleCopy(root), /要放生「HUNT」嗎？/);
  assert.match(visibleCopy(root), /育成夥伴名單已滿/);
  const input = root.querySelector("input"); input.value = "MiXeD小火"; input.listeners.input();
  assert.deepEqual(names, ["MiXeD小火"]);
});

test("Hunt Result lets every catch on the memory card take the name plate", t => {
  // Owner report 2026-10-05: with two or more catches only the first could be named.
  const root = useDocument(t);
  const rows = [
    { kind: "CARD", id: "wild-1", key: "card:wild-1", speciesId: "species-034", displayName: "亞古獸", canRelease: true, selected: true, grade: "S" },
    { kind: "CARD", id: "wild-2", key: "card:wild-2", speciesId: "species-035", displayName: "加布獸", canRelease: true, selected: false, grade: "C" },
    { kind: "HOME", id: "home-1", key: "home:home-1", speciesId: "species-001", displayName: "滾球獸", canRelease: true }
  ];
  const block = { title: "HUNT RESULT", outcomeLabel: "ON MEMORY CARD", wildId: "wild-1", speciesId: "species-034",
    speciesLabel: "SPECIES 034", displayName: "亞古獸", pendingHomeCommit: true, rows };
  const calls = [];
  const source = { getFrame: () => ({ screen: "HUNT_RESULT", huntResult: block }), intents: {
    setHuntResultName: name => calls.push(["name", name]), selectHuntResultEntry: id => calls.push(["select", id]),
    confirmHuntResult() {}, requestHuntResultRelease() {} } };
  createHuntResultView({ root, source });
  const picks = root.querySelectorAll("button").filter(button => button.dataset.nameKey);
  assert.deepEqual(picks.map(button => button.dataset.nameKey), ["card:wild-1", "card:wild-2"], "each catch on the card can be named; a Home resident cannot");
  assert.deepEqual(picks.map(button => button.textContent), ["命名中", "命名"]);
  assert.equal(picks[0].getAttribute("aria-pressed"), "true");
  // LINE_FUSION_20261117: each row shows its grade; a partner with no grade record shows "—".
  const grades = root.querySelectorAll("span").filter(span => span.className === "cm-vs2-result__grade");
  assert.deepEqual(grades.map(span => span.textContent), ["S", "C", "—"]);
  assert.deepEqual(grades.map(span => span.title), ["資質", "資質", "資質"]);
  const input = root.querySelector("input");
  input.value = "小亞";
  picks[1].click();
  assert.deepEqual(calls, [["name", "小亞"], ["select", "wild-2"]], "what was typed is kept for the first catch before the plate moves");
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
  assert.equal(frame.displayName, "火甲龍");
  assert.deepEqual(frame.rows.map(row => row.displayName), ["火甲龍", "HUNT"]);
  assert.equal(JSON.stringify({ raw, cards }), before);
});

test("Hunt Result offers same-line fusion: a fuse key, the bases with what each gains, and what the fodder loses", t => {
  // LINE_FUSION_20261117 P2.
  const root = useDocument(t);
  const rows = [
    { kind: "CARD", id: "wild-1", key: "card:wild-1", speciesId: "species-034", displayName: "亞古獸", canRelease: true, canFuse: true, selected: true, grade: "A" },
    { kind: "HOME", id: "home-1", key: "home:home-1", speciesId: "species-087", displayName: "角暴龍", canRelease: false, canFuse: false, grade: null,
      fusionGain: { amount: 1140, before: { level: 12 }, after: { level: 13 } } },
    { kind: "HOME", id: "home-2", key: "home:home-2", speciesId: "species-079", displayName: "風刃狼", canRelease: true, canFuse: false, grade: null }
  ];
  const block = { title: "HUNT RESULT", outcomeLabel: "ON MEMORY CARD", wildId: "wild-1", speciesId: "species-034",
    speciesLabel: "SPECIES 034", displayName: "亞古獸", pendingHomeCommit: true, rows, pendingFusion: null };
  const calls = [];
  const intents = { setHuntResultName() {}, selectHuntResultEntry() {}, confirmHuntResult() {}, requestHuntResultRelease() {},
    requestHuntResultFusion: key => calls.push(["request", key]), cancelHuntResultFusion: () => calls.push(["cancel"]),
    confirmHuntResultFusion: id => calls.push(["confirm", id]) };
  const view = createHuntResultView({ root, source: { getFrame: () => ({ screen: "HUNT_RESULT", huntResult: block }), intents } });
  const fuseKeys = () => root.querySelectorAll("button").filter(button => button.dataset.fuseKey);
  assert.deepEqual(fuseKeys().map(button => [button.dataset.fuseKey, button.textContent]), [["card:wild-1", "融合"]], "only a row that can be fused has the key");
  assert.deepEqual(root.querySelectorAll("span").filter(span => span.className === "cm-vs2-result__fusion-gain").map(span => span.textContent), ["+1,140 EXP"]);
  fuseKeys()[0].click();
  assert.deepEqual(calls, [["request", "card:wild-1"]]);
  view.render({ screen: "HUNT_RESULT", huntResult: { ...block, pendingFusion: { row: rows[0], warnings: [{ kind: "LEVEL", level: 12 }, { kind: "BLOODLINE" }],
    bases: [{ instanceId: "home-1", displayName: "角暴龍", line: 0.6,
      preview: { amount: 684, before: { level: 12 }, after: { level: 12 } } }] } } });
  const bases = root.querySelectorAll("button").filter(button => button.dataset.fusionBase);
  assert.deepEqual(bases.map(button => button.dataset.fusionBase), ["home-1"]);
  const spans = name => root.querySelectorAll("span").filter(span => span.className === name).map(span => span.textContent);
  assert.deepEqual(spans("cm-vs2-result__fusion-name"), ["角暴龍"]);
  assert.deepEqual(spans("cm-vs2-result__fusion-preview"), ["Lv.12 → Lv.12 · +684 EXP · ×0.6"]);
  assert.deepEqual(root.querySelectorAll("p").filter(p => p.className === "cm-vs2-result__fusion-warning").map(p => p.textContent), ["失去 Lv.12 拍檔", "失去血統"]);
  assert.ok(fuseKeys().every(button => button.disabled), "one choice at a time");
  bases[0].click();
  assert.deepEqual(calls.at(-1), ["confirm", "home-1"]);
});

test("the talent tree is drawn: icons with pips, tap lights, press-and-hold reads, and it sends learn / respec", async t => {
  // TAMER_TALENTS_20261117, redrawn as a tree by TALENT_TREE_20261118 (Owner 2026-11-18: icons, tap to light, hold to read).
  const root = useDocument(t);
  const { createTamerTalentPanel, TALENT_HOLD_MS, talentNodeState } = await import("../src/championship/app/tamerTalentPanel.js");
  const node = (id, tier, key, per, extra = {}) => ({ id, tier, key, per, max: 3, cost: 1, rank: 0, gate: tier === 1 ? 0 : tier === 2 ? 6 : 14, open: true, refusal: null, ...extra });
  let frame = { level: 12, exp: 300, next: 1011, points: 15, spent: 2, free: 13, respecCost: 500, crystals: 620, lastGain: null,
    lines: [{ line: "hunter", spent: 2, keystoneGate: 22,
      nodes: [node("hunter.memory", 1, "memoryG", 8, { rank: 2 }), node("hunter.herdSense", 2, "herdExtra", 1, { refusal: "TALENT_TIER_LOCKED" }),
        node("hunter.swift", 3, "tamerSpeedPercent", 5, { open: false, refusal: "TALENT_NOT_OPEN" })],
      keystones: [{ id: "hunter.keenEye", cost: 4, taken: false, open: false, refusal: "TALENT_NOT_OPEN" }] },
      { line: "trader", spent: 0, keystoneGate: 22, nodes: [node("trader.haggle", 1, "shopBitsPercent", -3)], keystones: [] }] };
  const calls = [];
  const panel = createTamerTalentPanel({ frame: () => frame, learn: id => { calls.push(["learn", id]); return { ok: true }; },
    respec: () => { calls.push(["respec"]); return { ok: false, reason: "TALENT_NO_CRYSTALS" }; } });
  root.append(panel.element);
  const byClass = name => root.querySelectorAll("*").filter(n => n.className === name);
  // this document's elements keep only their own text: read a part with everything under it
  const textOf = part => [part.textContent, ...part.querySelectorAll("*").map(n => n.textContent)].join("");
  // glance: no sentence. The level, the gauge and the points are art with accessible names.
  assert.equal(panel.element.dataset.layout, "tree");
  assert.equal(byClass("cm-tamer-badge")[0].attributes["aria-label"], "馴獸師 Lv.12");
  assert.equal(byClass("cm-talents__bar")[0].attributes["aria-label"], "300 / 1,011 EXP");
  assert.deepEqual([byClass("cm-talents__points")[0].attributes["aria-label"], textOf(byClass("cm-talents__points")[0])], ["點數 13 / 15", "13"]);
  const tabs = byClass("cm-talents__tab");
  assert.deepEqual(tabs.map(tab => [tab.dataset.line, tab.attributes["aria-pressed"]]), [["hunter", "true"], ["trader", "false"]]);
  // the tree: keystone on top, then tier 3, 2, 1; each node is an icon with pips and a state, never a row of text
  const keys = () => byClass("cm-talents__node");
  assert.deepEqual(keys().map(key => [key.dataset.learn, key.dataset.state, key.attributes["aria-disabled"]]),
    [["hunter.keenEye", "soon", "true"], ["hunter.swift", "soon", "true"], ["hunter.herdSense", "locked", "true"], ["hunter.memory", "lit-ready", "false"]]);
  assert.equal(keys()[0].dataset.keystone, "true");
  const pips = key => key.querySelectorAll("i").map(pip => pip.dataset.on);
  assert.deepEqual([pips(keys()[3]), pips(keys()[0])], [["true", "true", "false"], ["false"]]);
  assert.deepEqual(byClass("cm-talents__gate").map(gate => [gate.dataset.open, gate.attributes["aria-label"]]),
    [["false", "本線已投入 2 / 22"], ["false", "本線已投入 2 / 14"], ["false", "本線已投入 2 / 6"]]);
  assert.deepEqual([talentNodeState({ open: true, rank: 0, max: 3, refusal: null }), talentNodeState({ open: true, rank: 3, max: 3, refusal: "TALENT_MAX" }),
    talentNodeState({ open: true, rank: 1, max: 3, refusal: "TALENT_NO_POINTS" })], ["ready", "max", "lit"]);
  // nothing is written until a node is held
  const reading = () => byClass("cm-talents__reading")[0];
  assert.deepEqual([reading().dataset.empty, textOf(reading())], ["true", "點一下點亮・按住看作用"]);
  // press and hold: the reading bar names the node and what it does; letting go learns nothing
  const memory = keys()[3];
  memory.listeners.pointerdown();
  await new Promise(done => setTimeout(done, TALENT_HOLD_MS + 60));
  assert.deepEqual([reading().dataset.empty, textOf(reading())], ["false", "記憶擴充+16 G 記憶卡"]);
  memory.listeners.pointerup(); memory.click();
  assert.deepEqual(calls, [], "the release of a hold is not a tap");
  assert.equal(reading().dataset.empty, "true");
  // tap: one rank
  keys()[3].click();
  assert.deepEqual(calls, [["learn", "hunter.memory"]]);
  // a node that cannot be learned is not learned; it says why
  keys()[2].click();
  assert.equal(calls.length, 1);
  assert.equal(textOf(reading()), "群聚嗅覺+1 隻群體層級未開");
  keys()[0].click();
  assert.equal(textOf(reading()), "慧眼未開放");
  // another line
  byClass("cm-talents__tab")[1].click();
  assert.deepEqual(keys().map(key => key.dataset.learn), ["trader.haggle"]);
  // reset: asks once more, and its price is a crystal and a number
  const reset = () => root.querySelectorAll("button").find(button => button.className === "cm-talents__respec");
  assert.equal(reset().textContent, "重置天賦");
  assert.deepEqual([byClass("cm-talents__respec-cost")[0].attributes["aria-label"], textOf(byClass("cm-talents__respec-cost")[0])], ["500 結晶（持有 620）", "500"]);
  reset().click();
  assert.equal(reset().textContent, "確認重置", "a respec asks once more");
  assert.equal(calls.length, 1);
  reset().click();
  assert.deepEqual(calls.at(-1), ["respec"]);
  assert.deepEqual(byClass("cm-talents__message").map(n => n.textContent), ["結晶不足"]);
  frame = null; panel.render();
  assert.equal(panel.element.hidden, true);
});
