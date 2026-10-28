// Owner 2026-10-28 UI batch: the hunt tactical dock (belt scroll, drag-to-deploy,
// input isolation), the rift observation chart and the dedicated story stage's
// observation log, the stroll journal's species-code repair, and the System
// menu glyphs. Pure modules and DOM doubles only: no app, storage or network.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { localizeSpeciesCodes, speciesName } from "../src/championship/text/zhHant.js";
import { normalizeStrollLog, renameStrollLogPartners, emptyStrollLog } from "../src/championship/raising/ranchPartnerLife.js";
import { normalizeNativeRaisingHome } from "../src/championship/raising/nativeRaisingHomeState.js";
import { strollLogLine } from "../src/championship/app/ranchDiscoveryJournal.js";
import { mountHuntTacticalDock, huntDockDeployable, HUNT_DOCK_TOOL_TAGS, HUNT_DOCK_DEPLOY_DISTANCE } from "../src/championship/app/huntTacticalDock.js";
import { STORY_RIFT_MAP_NODES, STORY_RIFT_MAP_COPY, STORY_RIFT_MAP_LOCALES, storyRiftMapStates, storyRiftMapText } from "../src/championship/data/storyRiftMap.js";
import { STORY_RIFT_CHAPTERS } from "../src/championship/data/storyRiftChapters.js";
import { createStoryChapterMap } from "../src/championship/app/storyChapterMap.js";
import { createPortraitVnOverlay, STORY_VN_TEXT_KEYS } from "../src/championship/presentation/story/portraitVnOverlay.js";
import { menuEntryGlyph, MENU_BADGE_GLYPH_IDS, MENU_PREFIX_GLYPH_IDS } from "../src/championship/app/ui/menuEntryGlyphs.js";
import { TOOLBAR_MENU_GROUPS } from "../src/championship/app/championshipToolbar.js";
import { uiText } from "../src/championship/text/uiText.js";
import { setLocale } from "../src/championship/text/locale.js";

// ---- a small DOM double ------------------------------------------------------
function docDouble() {
  const make = tag => {
    const node = { tag, children: [], dataset: {}, attributes: new Map(), listeners: new Map(), hidden: false, textContent: "", className: "", parent: null,
      style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); } },
      classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
      append(...kids) { for (const kid of kids) { if (typeof kid !== "object") continue; if (kid.parent) kid.parent.children.splice(kid.parent.children.indexOf(kid), 1); kid.parent = node; node.children.push(kid); } },
      replaceChildren(...kids) { for (const kid of node.children) kid.parent = null; node.children.length = 0; node.append(...kids); },
      remove() { if (node.parent) { node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; } },
      setAttribute(k, v) { node.attributes.set(k, String(v)); }, getAttribute(k) { return node.attributes.get(k) ?? null; },
      addEventListener(type, fn) { if (!node.listeners.has(type)) node.listeners.set(type, []); node.listeners.get(type).push(fn); }, removeEventListener() {},
      fire(type, event = {}) { for (const fn of node.listeners.get(type) ?? []) fn({ target: node, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() {}, ...event }); },
      focus() {}, querySelector() { return null; }, contains(other) { for (let n = other; n; n = n.parent) if (n === node) return true; return false; },
      closest(selector) { for (let n = node; n; n = n.parent) if (selector.includes("button[data-tool]") && n.tag === "button" && n.dataset.tool) return n; return null; },
      getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, width: 390, height: 844 }; }, offsetWidth: 390,
      set innerHTML(html) { node.children.length = 0; node.html = html; }, get innerHTML() { return node.html ?? ""; }
    };
    return node;
  };
  const body = make("body");
  return { body, hidden: false, activeElement: null, defaultView: null, createElement: make, createTextNode: text => ({ text }), addEventListener() {}, removeEventListener() {} };
}
const textOf = node => node.textContent + node.children.map(textOf).join("");
const find = (node, test) => test(node) ? node : node.children.map(child => find(child, test)).find(Boolean) ?? null;
const findAll = (node, test) => [...(test(node) ? [node] : []), ...node.children.flatMap(child => findAll(child, test))];
const click = node => node.fire("click");

// ---- task 3: species codes in the stroll journal -----------------------------
test("internal species codes read as catalog names; unknown numbers keep their code", () => {
  assert.equal(localizeSpeciesCodes("SPECIES 084"), speciesName(84));
  assert.equal(localizeSpeciesCodes("species_099 和 SPECIES-036"), `${speciesName(99)} 和 ${speciesName(36)}`);
  assert.doesNotMatch(localizeSpeciesCodes("SPECIES 084"), /SPECIES/);
  assert.equal(localizeSpeciesCodes("石淮升"), "石淮升");
  assert.equal(localizeSpeciesCodes(""), "");
  assert.equal(localizeSpeciesCodes(null), null);
});

const oldLog = () => normalizeStrollLog({ version: 1, sequence: 2, day: { key: "0:5", finds: 1, greetings: 1 }, taps: {}, pairs: {}, entries: [
  { id: 1, at: 1, kind: "greeting", reward: "feed", quantity: 2, partnerId: "championship:2026:instance:0001", partnerName: "SPECIES 084",
    cage: 1, season: 0, day: 5, minute: 649, partnerB: "championship:2026:instance:0002", partnerBName: "SPECIES 099", relation: "friendly" },
  { id: 2, at: 2, kind: "find", reward: "protein", quantity: 1, partnerId: "championship:2026:instance:0003", partnerName: "SPECIES 036", cage: 1, season: 0, day: 5, minute: 652 }
] });

test("an old save's stroll log is repaired on load and the repair survives the save round trip", () => {
  const repaired = renameStrollLogPartners(oldLog(), localizeSpeciesCodes);
  assert.deepEqual(repaired.entries.map(e => [e.partnerName, e.partnerBName ?? null]), [[speciesName(84), speciesName(99)], [speciesName(36), null]]);
  assert.equal(repaired.sequence, 2); assert.equal(repaired.day.greetings, 1);
  // Clean logs come back as the same object, so nothing is rewritten for nothing.
  assert.equal(renameStrollLogPartners(repaired, localizeSpeciesCodes), repaired);
  assert.equal(renameStrollLogPartners(emptyStrollLog(), localizeSpeciesCodes).entries.length, 0);
  const home = normalizeNativeRaisingHome({ version: 1, poolSlots: {}, foods: [], strollLog: repaired });
  assert.deepEqual(normalizeNativeRaisingHome(JSON.parse(JSON.stringify(home))).strollLog, repaired);
});

test("a journal line never shows an internal code, even from a log that was never repaired", () => {
  const [greeting, find] = oldLog().entries;
  const line = strollLogLine(greeting);
  assert.doesNotMatch(line, /SPECIES/i);
  assert.ok(line.includes(speciesName(84)) && line.includes(speciesName(99)));
  assert.ok(strollLogLine(find).includes(speciesName(36)));
});

test("the stroll name generator prefers the nickname, then the catalog name, never the code", () => {
  const app = fs.readFileSync(new URL("../src/championship/app/championshipStandaloneApp.js", import.meta.url), "utf8");
  const partnerName = app.slice(app.indexOf("function partnerName(id)"), app.indexOf("function partnerReading("));
  assert.match(partnerName, /localizeSpeciesCodes\(entry\?\.displayName/);
  assert.match(partnerName, /speciesNameForId\(entry\.speciesId\)/);
  assert.doesNotMatch(partnerName, /speciesDisplayName/);
  assert.match(app, /raising = repairStrollLogNames\(candidate\.production\);/);
});

// ---- task 1: hunt tactical dock ----------------------------------------------
function dockFixture({ wide = false, live = true, deployAccepted = true } = {}) {
  const doc = docDouble();
  const layer = doc.createElement("section"), dock = doc.createElement("nav"), belt = doc.createElement("div");
  belt.scrollWidth = 400; belt.clientWidth = 190; belt.scrollLeft = 0;
  const tool = id => { const b = doc.createElement("button"); b.dataset.tool = id; b.captured = new Set();
    b.setPointerCapture = pid => b.captured.add(pid); b.hasPointerCapture = pid => b.captured.has(pid); b.releasePointerCapture = pid => b.captured.delete(pid); return b; };
  const rope = tool("ROPE"), shot = tool("SHOT"), lure = tool("ENTRAP");
  belt.setPointerCapture = () => {}; belt.hasPointerCapture = () => false;
  belt.append(shot, lure); dock.append(rope, belt); layer.append(dock);
  const calls = [];
  const handle = mountHuntTacticalDock({ dock, belt, layer, doc, isWide: () => wide, enabled: () => live,
    canDeployAt: (x, y) => y < 600, onDeployStart: e => calls.push(["start", e.tool]), onDeployMove: e => calls.push(["move", e.valid]),
    onDeploy: e => { calls.push(["deploy", e.tool, e.clientX, e.clientY]); return deployAccepted; }, onDeployEnd: e => calls.push(["end", e.placed, e.dropped]) });
  const pointer = (type, target, x, y, extra = {}) => dock.fire(type, { target, pointerId: 7, pointerType: "touch", button: 0, clientX: x, clientY: y, ...extra });
  return { doc, layer, dock, belt, rope, shot, lure, calls, handle, pointer };
}

test("tools are tagged, and only lures and traps can be dragged onto the field", () => {
  for (const id of ["ENTRAP", "DAMAGE_TRAP"]) assert.equal(huntDockDeployable(id), true);
  for (const id of ["HAND", "ROPE", "SHOT", "WIRE"]) assert.equal(huntDockDeployable(id), false);
  for (const label of Object.values(HUNT_DOCK_TOOL_TAGS)) for (const locale of ["en", "ja", "th", "vi"]) {
    setLocale(locale); assert.notEqual(uiText(label), label, `${locale}: ${label}`);
  }
  setLocale("zh-Hant");
});

test("a lure dragged up off the belt shows a landing ring and is placed where the finger lifts; the click is swallowed", () => {
  const f = dockFixture();
  f.pointer("pointerdown", f.lure, 300, 800);
  f.pointer("pointermove", f.lure, 302, 800 - HUNT_DOCK_DEPLOY_DISTANCE - 2);
  // Still over the dock: lifted, but not a landing spot yet.
  assert.deepEqual(f.calls.slice(0, 2), [["start", "ENTRAP"], ["move", false]]);
  assert.equal(f.dock.dataset.gesture, "deploy");
  const ring = find(f.layer, n => n.className === "cm-hunt-deploy-ring"), ghost = find(f.layer, n => n.className === "cm-hunt-deploy-ghost");
  assert.ok(ring && ghost, "ring and lifted item are drawn");
  f.pointer("pointermove", f.lure, 200, 420);
  assert.equal(ring.style.props.get("--x"), "200px"); assert.equal(ring.dataset.valid, "true");
  f.pointer("pointerup", f.lure, 200, 420);
  assert.deepEqual(f.calls.at(-2), ["deploy", "ENTRAP", 200, 420]);
  assert.deepEqual(f.calls.at(-1), ["end", true, true]);
  assert.equal(find(f.layer, n => n.className === "cm-hunt-deploy-ring"), null, "the ring is cleared");
  let clicked = false; f.dock.addEventListener("click", () => { clicked = true; });
  const event = { target: f.lure, defaultPrevented: false };
  for (const fn of f.dock.listeners.get("click")) { if (fn === f.dock.listeners.get("click")[0]) { fn({ ...event, preventDefault() { event.defaultPrevented = true; }, stopImmediatePropagation() { event.stopped = true; } }); } }
  assert.equal(event.defaultPrevented, true); assert.equal(event.stopped, true);
  f.handle.dispose();
});

test("a drop off the ground places nothing; a shot never lifts; the tutorial keeps lifts off", () => {
  const f = dockFixture();
  f.pointer("pointerdown", f.lure, 300, 800); f.pointer("pointermove", f.lure, 300, 760); f.pointer("pointermove", f.lure, 300, 700);
  f.pointer("pointerup", f.lure, 300, 700);
  assert.ok(!f.calls.some(c => c[0] === "deploy")); assert.deepEqual(f.calls.at(-1), ["end", false, true]);
  const g = dockFixture();
  g.pointer("pointerdown", g.shot, 120, 800); g.pointer("pointermove", g.shot, 120, 740); g.pointer("pointerup", g.shot, 120, 740);
  assert.deepEqual(g.calls, []);
  const h = dockFixture({ live: false });
  h.pointer("pointerdown", h.lure, 300, 800); h.pointer("pointermove", h.lure, 300, 740); h.pointer("pointerup", h.lure, 300, 740);
  assert.deepEqual(h.calls, []);
});

test("a sideways mouse drag scrolls the belt and does not select the key; touch pans natively", () => {
  const f = dockFixture();
  f.belt.scrollLeft = 0;
  f.pointer("pointerdown", f.shot, 200, 800, { pointerType: "mouse" });
  f.pointer("pointermove", f.shot, 170, 801, { pointerType: "mouse" });
  f.pointer("pointermove", f.shot, 120, 801, { pointerType: "mouse" });
  assert.equal(f.belt.scrollLeft, 80); assert.equal(f.dock.dataset.gesture, "scroll");
  f.pointer("pointerup", f.shot, 120, 801, { pointerType: "mouse" });
  const event = {}; f.dock.listeners.get("click")[0]({ target: f.shot, preventDefault() { event.prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(event.prevented, true, "the drag's click is swallowed");
  // A touch pan is the browser's: the dock leaves scrollLeft alone and a cancel ends the gesture.
  const g = dockFixture();
  g.pointer("pointerdown", g.shot, 200, 800); g.pointer("pointermove", g.shot, 150, 801);
  assert.equal(g.belt.scrollLeft, 0); g.pointer("pointercancel", g.shot, 150, 801);
  assert.equal(g.dock.dataset.gesture, undefined);
  // The fades follow the scroll position.
  g.belt.scrollLeft = 0; g.belt.fire("scroll"); assert.equal(g.dock.dataset.overflowStart, "false"); assert.equal(g.dock.dataset.overflowEnd, "true");
  g.belt.scrollLeft = 210; g.belt.fire("scroll"); assert.equal(g.dock.dataset.overflowStart, "true"); assert.equal(g.dock.dataset.overflowEnd, "false");
});

test("in the wide panel a lure lifts towards the field on the left", () => {
  const f = dockFixture({ wide: true });
  f.pointer("pointerdown", f.lure, 1200, 400); f.pointer("pointermove", f.lure, 1170, 404);
  assert.deepEqual(f.calls[0], ["start", "ENTRAP"]);
  f.pointer("pointerup", f.lure, 400, 420);
  assert.deepEqual(f.calls.find(c => c[0] === "deploy"), ["deploy", "ENTRAP", 400, 420]);
});

test("the hunt view keeps every hook the gates use and routes deploys through the field's tap path", () => {
  const view = fs.readFileSync(new URL("../src/championship/app/vs2Screens.js", import.meta.url), "utf8");
  assert.match(view, /element\("nav","cm-hunt-tools"\)/);
  assert.match(view, /button\.dataset\.tool = tool\.id;/);
  assert.match(view, /if \(fixed\) tools\.append\(button\);/);
  assert.match(view, /enabled: \(\) => fieldIsLive\(\) && !source\.getFrame\(\)\.tutorial/);
  const field = fs.readFileSync(new URL("../src/championship/presentation/vs2/createHuntFieldPixiPresentation.js", import.meta.url), "utf8");
  const deployAt = field.slice(field.indexOf("deployAt(clientX, clientY) {"), field.indexOf("getDiagnostics() {"));
  assert.match(deployAt, /source\.intents\.toolPointerDown\?\.\(point\.x, point\.y\)/);
  assert.match(deployAt, /source\.intents\.toolPointerUp\?\.\(point\.x, point\.y\)/);
  assert.match(field, /app\.renderer\.events\.mapPositionToPoint\(global, clientX, clientY\)/);
  const css = fs.readFileSync(new URL("../src/championship/app/ui/screenLayout.css", import.meta.url), "utf8");
  for (const rule of ["overflow-x: auto;", "overscroll-behavior-x: contain;", "touch-action: pan-x;", "scrollbar-width: none;", "backdrop-filter: blur(12px)"]) assert.ok(css.includes(rule), rule);
  const base = fs.readFileSync(new URL("../src/championship/app/vs2Styles.css", import.meta.url), "utf8");
  assert.match(base, /\.cm-hunt-dock__belt \{ display: contents; \}/, "other themes keep one row in the same order");
});

// ---- task 2: rift observation chart and the dedicated stage ------------------
test("the chart data is pure, every node's copy exists in five locales, and chapters resolve", () => {
  const text = fs.readFileSync(new URL("../src/championship/data/storyRiftMap.js", import.meta.url), "utf8");
  assert.doesNotMatch(text, /^\s*import\s/m); assert.doesNotMatch(text, /https?:|localStorage|fetch\(|Math\.random/);
  assert.deepEqual(STORY_RIFT_MAP_LOCALES, ["zh-Hant", "en", "ja", "th", "vi"]);
  const keys = Object.keys(STORY_RIFT_MAP_COPY["zh-Hant"]).sort();
  for (const locale of STORY_RIFT_MAP_LOCALES) assert.deepEqual(Object.keys(STORY_RIFT_MAP_COPY[locale]).sort(), keys, locale);
  for (const node of STORY_RIFT_MAP_NODES) {
    for (const key of [node.titleKey, node.summaryKey, node.sigilKey]) assert.ok(keys.includes(key), `${node.id}: ${key}`);
    if (node.chapterId) assert.ok(STORY_RIFT_CHAPTERS[node.chapterId], node.chapterId);
    assert.ok(node.x >= 5 && node.x <= 95 && node.y >= 5 && node.y <= 95, node.id);
  }
  assert.deepEqual(STORY_RIFT_MAP_NODES.filter(n => n.kind === "chapter").map(n => n.number), [1, 2, 3, 4]);
  assert.equal(storyRiftMapText("NUM_CHAPTER", "en", { n: 2 }), "Chapter 2");
});

test("node states: the opening's chapters are watched, chapter 1 is in progress until seen, unwritten ones stay locked", () => {
  const seen = new Set();
  const isSeen = node => node.seenWith === "opening" || seen.has(node.seenKey);
  assert.deepEqual(storyRiftMapStates(isSeen).map(s => s.state), ["seen", "seen", "current", "locked", "locked", "locked", "locked"]);
  seen.add("storyRiftChapter1Seen");
  assert.deepEqual(storyRiftMapStates(isSeen).map(s => s.state), ["seen", "seen", "seen", "locked", "locked", "locked", "locked"]);
});

test("the chart opens on the chapter, shows a locked coordinate, plays a chapter and comes back with its sigil lit", async () => {
  const doc = docDouble(); const played = [];
  let seen = false, closed = 0;
  const map = createStoryChapterMap({ doc, host: doc.body, isSeen: node => node.seenWith === "opening" || (node.seenKey === "storyRiftChapter1Seen" && seen),
    partner: { name: "亞古獸", portrait: { src: "p.webp" } },
    onPlay: async chapterId => { played.push(chapterId); seen = true; return { outcome: "completed", chapterId }; }, onClose: () => { closed++; } });
  assert.equal(map.open({ chapterId: "chapter1-first-rift" }), true);
  const root = map.element; assert.equal(root.hidden, false); assert.equal(root.getAttribute("role"), "dialog");
  const nodes = findAll(root, n => n.className === "cm-story-map__node");
  assert.equal(nodes.length, STORY_RIFT_MAP_NODES.length);
  const byId = id => nodes.find(n => n.dataset.nodeId === id);
  assert.equal(byId("chapter1").getAttribute("aria-pressed"), "true"); assert.equal(byId("chapter1").dataset.state, "current");
  const play = () => find(root, n => n.className === "cm-story-map__play");
  assert.equal(play().disabled, false);
  const castNames = findAll(root, n => n.className === "cm-story-map__cast-name").map(n => n.textContent);
  assert.deepEqual(castNames, ["雜訊殘響", "亞古獸", "大會導覽 NAVI"]);
  click(byId("chapter2"));
  assert.equal(play().disabled, true); assert.equal(textOf(find(root, n => n.className === "cm-story-map__detail-title")), "運動場的殘響");
  click(byId("chapter1"));
  click(play()); assert.equal(root.hidden, true, "the chart steps aside while the chapter plays");
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(played, ["chapter1-first-rift"]);
  assert.equal(root.hidden, false, "the chart returns");
  const after = findAll(root, n => n.className === "cm-story-map__node").find(n => n.dataset.nodeId === "chapter1");
  assert.equal(after.dataset.state, "seen"); assert.equal(after.dataset.justSeen, "true");
  assert.equal(find(root, n => n.className === "cm-story-map__sigil").dataset.lit, "true");
  click(find(root, n => n.className === "cm-story-map__close")); assert.equal(root.hidden, true); assert.equal(closed, 1);
  map.dispose();
});

test("the stage hides the ranch HUD while a chapter plays and the chart replaces direct play from the menu and badge", () => {
  const main = fs.readFileSync(new URL("../src/championship/app/main.js", import.meta.url), "utf8");
  assert.match(main, /if \(entry\.action === "OPEN_STORY"\) \{ openStoryMap\(\{ source: 'menu' \}\); return; \}/);
  assert.match(main, /document\.addEventListener\(STORY_CHAPTER_OPEN_EVENT, event => \{ openStoryMap\(/);
  assert.match(main, /document\.body\.dataset\.storyStage = 'playing';/);
  assert.match(main, /delete document\.body\.dataset\.storyStage;/);
  const css = fs.readFileSync(new URL("../src/championship/app/ui/storyTheater.css", import.meta.url), "utf8");
  assert.match(css, /body\[data-story-stage="playing"\] :is\(\.cm-status-bar, \.cm-toolbar\)/);
});

test("the observation log lists what was said, pauses advancing while open, and a tap closes it", async () => {
  const doc = docDouble(); const timers = []; let now = 0;
  const overlay = createPortraitVnOverlay({ doc, host: doc.body, reducedMotion: true, setTimer: (fn, ms) => { timers.push({ fn, at: now + ms }); return timers.length; }, clearTimer: () => {} });
  overlay.open({ title: "第一章：初遇裂縫", onSkip: () => {} });
  const root = overlay.element, panel = root.children[2], box = panel.children[1], log = panel.children[4];
  assert.equal(log.className, "cm-story-vn__log"); assert.equal(log.hidden, true);
  assert.ok(root.children.some(n => n.className === "cm-story-vn__aura"));
  assert.deepEqual(root.children.filter(n => n.className === "cm-story-vn__bar").map(n => n.dataset.edge), ["top", "bottom"]);
  let first = false;
  const line = overlay.say({ speaker: "narrator", name: "旁白", text: "飼育籠的午後很安靜。" }).then(() => { first = true; });
  const logButton = findAll(panel.children[0], n => n.dataset.storyAction === "log")[0];
  click(logButton); assert.equal(log.hidden, false);
  assert.deepEqual(findAll(log, n => n.className === "cm-story-vn__log-text").map(n => n.textContent), ["飼育籠的午後很安靜。"]);
  click(box); assert.equal(log.hidden, true, "a tap closes the log"); assert.equal(first, false, "and never skips the line");
  click(box); await line; assert.equal(first, true);
  overlay.close(); overlay.dispose();
  assert.ok(STORY_VN_TEXT_KEYS.includes("STORY_LOG"));
  for (const locale of ["en", "ja", "th", "vi"]) { setLocale(locale); assert.notEqual(uiText("STORY_LOG"), "STORY_LOG"); }
  setLocale("zh-Hant");
});

// ---- task 4: menu glyphs ------------------------------------------------------
test("every System menu card and session key has a drawn glyph; the markup is original vector art with no URL", () => {
  assert.deepEqual([...MENU_BADGE_GLYPH_IDS].sort(), ["backpack", "journal", "story"]);
  const session = TOOLBAR_MENU_GROUPS.SYSTEM.find(group => group.id === "session").entries;
  assert.deepEqual([...MENU_PREFIX_GLYPH_IDS].sort(), [...session].sort());
  const doc = docDouble();
  for (const id of [...MENU_BADGE_GLYPH_IDS, ...MENU_PREFIX_GLYPH_IDS]) {
    const glyph = menuEntryGlyph(doc, id);
    assert.equal(glyph.getAttribute("data-placement"), MENU_BADGE_GLYPH_IDS.includes(id) ? "badge" : "prefix");
    assert.match(glyph.innerHTML, /^<svg viewBox=/); assert.doesNotMatch(glyph.innerHTML, /https?:|xmlns|<image|href=/);
  }
  assert.equal(menuEntryGlyph(doc, "medals"), null, "the medal board keeps its own art");
  const css = fs.readFileSync(new URL("../src/championship/app/ui/arcade.css", import.meta.url), "utf8");
  assert.match(css, /\.cm-medals__tile\[data-acquired="true"\] \.cm-medals__name \{ color: #fff8e7;/);
  assert.match(css, /\.cm-medals__tile\[data-acquired="true"\] \.cm-medals__status \{ color: #ffd166;/);
});
