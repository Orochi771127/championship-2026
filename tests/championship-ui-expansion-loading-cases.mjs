// 2026-10-12 UI batch: the ranch expansion preview for players without the
// expansion, honest loading progress, and the dialog it all opens through.
// Layout, focus and pixels are checked in the browser; these pin the rules.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { composeRanchArtPlan, ranchExpansionPreviewPlan, RANCH_ANNEX_BAND_OFFSET_NATIVE, RANCH_UPPER_ROW_CAP_NATIVE }
  from "../src/championship/presentation/raisingRanchArtPlan.js";
import { expansionBayCentre } from "../src/championship/presentation/raisingExpansionPreview.js";
import { prototypeRanchExpansion } from "../src/championship/cage/ranchExpansion.js";
import { raisingFieldViewport, raisingScreenToNative, raisingNativeToScreen } from "../src/championship/presentation/intRh2/raisingFieldViewport.js";
import { createLoadProgressView, formatLoadBytes, observeDownloadedBytes } from "../src/championship/app/loadProgress.js";
import { showChoiceDialog } from "../src/championship/app/uiDialog.js";
import { openRanchExpansionPreview, ranchExpansionMapMarkup, ranchExpansionPreviewContent } from "../src/championship/app/ranchExpansionPreview.js";
import { UI_COPY } from "../src/championship/text/uiText.js";
import { UI_COPY_EN } from "../src/championship/text/uiText.en.js";

const manifest = JSON.parse(fs.readFileSync(new URL("../assets/production/cage/final-intake-20261008/manifest.json", import.meta.url), "utf8"));
const placements = [{ moduleId: "championship:2026:cage:waiting-room", slotIndex: 0 }, { moduleId: "championship:2026:cage:0", slotIndex: 8 }];

// ---- a minimal DOM, enough for the sheet and the progress view ----------
class FakeNode {
  constructor(tagName, doc) {
    this.tagName = String(tagName).toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentNode = null;
    this.attributes = {}; this.dataset = {}; this.style = { setProperty() {}, removeProperty() {} }; this.listeners = {};
    this.className = ""; this.hidden = false; this.disabled = false; this._text = ""; this.open = false; this.isConnected = false;
  }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get childElementCount() { return this.children.length; }
  get childNodes() { return this.children; }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; node.isConnected = this.isConnected; this.children.push(node); } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; this.isConnected = false; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "class") this.className = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }
  dispatch(name, event = {}) { for (const listener of this.listeners[name] ?? []) listener({ target: this, preventDefault() {}, ...event }); }
  focus() { this.ownerDocument.activeElement = this; }
  // <template>: parsed markup becomes one stub element that remembers it.
  set innerHTML(markup) { const node = new FakeNode("svg", this.ownerDocument); node.markup = String(markup); this.content = { firstElementChild: node }; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  querySelectorAll(selector) {
    const cls = selector.startsWith(".") ? selector.slice(1) : null;
    const all = (node) => [node, ...node.children.flatMap(all)];
    return all(this).slice(1).filter((node) => cls ? node.className.split(" ").includes(cls) : node.tagName === selector.toUpperCase());
  }
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => new FakeNode(tag, doc);
  doc.createElementNS = (_ns, tag) => new FakeNode(tag, doc);
  doc.body = doc.createElement("body"); doc.body.isConnected = true;
  return doc;
}

test("the locked rows are a granted, empty annex's rows 3-4, bay for bay", () => {
  const preview = ranchExpansionPreviewPlan({ manifest, layoutVersion: "NATIVE_ANCHORS_V1" });
  assert.equal(preview.bandOffsetPx, RANCH_ANNEX_BAND_OFFSET_NATIVE * 4);
  assert.equal(preview.capPx, RANCH_UPPER_ROW_CAP_NATIVE * 4);
  assert.equal(preview.widthPx, 10 * 48 * 4);
  for (const unlockedCount of [14, 16, 18, 20]) {
    const granted = composeRanchArtPlan({ manifest, placements, layoutVersion: "NATIVE_DECKS_V1", unlockedCount, expansion: prototypeRanchExpansion() });
    const split = granted.fold.splitPx;
    const annex = granted.placements.filter((tile) => tile.structuralRole === "LID" && tile.fragmentOfSlot === undefined
      && (tile.slotIndex ?? tile.capOfSlot) >= unlockedCount)
      .map((tile) => JSON.stringify([(tile.slotIndex ?? tile.capOfSlot) - unlockedCount, Boolean(tile.foldCap), tile.x - split, tile.y, tile.sourceRect])).sort();
    const mine = preview.placements.filter((tile) => tile.fragmentOfSlot === undefined)
      .map((tile) => JSON.stringify([tile.slotIndex ?? tile.capOfSlot, tile.capOfSlot !== undefined, tile.x, tile.y, tile.sourceRect])).sort();
    assert.deepEqual(mine, annex, `rank board ${unlockedCount}`);
  }
  // Ten bays, five caps over the back row, and the front row's last half-bay
  // wrapping into the band's own first column, never the player's board.
  assert.equal(preview.placements.filter((tile) => tile.slotIndex !== undefined).length, 10);
  assert.equal(preview.placements.filter((tile) => tile.capOfSlot !== undefined).length, 5);
  const wrap = preview.placements.filter((tile) => tile.fragmentOfSlot !== undefined);
  assert.deepEqual(wrap.map((tile) => [tile.fragmentOfSlot, tile.x, tile.fieldId]), [[9, 0, "field_cm29_01"]]);
  assert.ok(preview.placements.every((tile) => tile.fieldId === "field_cm29_01" && tile.moduleId === null));
  assert.deepEqual([...preview.lockedBays].sort(), [2, 5, 6]);
});

test("only a native ranch without the expansion gets the locked rows", () => {
  assert.equal(ranchExpansionPreviewPlan({ manifest, layoutVersion: "NATIVE_DECKS_V1" }), null, "the granted annex draws its own cells");
  assert.equal(ranchExpansionPreviewPlan({ manifest, layoutVersion: undefined }), null, "a legacy layout has no annex to show");
  assert.equal(ranchExpansionPreviewPlan({ manifest, layoutVersion: "NATIVE_ANCHORS_V1", previewFieldId: "field_cm09_01" }), null);
  assert.equal(ranchExpansionPreviewPlan({ manifest: { ...manifest, fields: manifest.fields.filter((f) => f.fieldId !== "field_cm29_01") },
    layoutVersion: "NATIVE_ANCHORS_V1" }), null, "no Lid art, no preview");
});

test("padlocks sit on the bays' hex centres", () => {
  assert.deepEqual(expansionBayCentre(0), { x: 48, y: 32 });
  assert.deepEqual(expansionBayCentre(5), { x: 2 * 96 + 48 + 48, y: 120 });
  assert.deepEqual(expansionBayCentre(6), { x: 3 * 96 + 48, y: 32 });
});

test("the locked rows lay the frame out as the granted annex does, without touching input", () => {
  const unit = 4;
  const base = { presentationMode: "NATIVE_RANCH", nativePixelWorldScale: unit, worldWidthPx: 14 * 48 * unit, wrapWidthPx: 14 * 48 * unit, worldHeightPx: 192 * unit };
  const preview = { ...base, expansionPreview: { bandOffsetPx: 176 * unit, capPx: 24 * unit, widthPx: 480 * unit, contentHeightPx: 176 * unit } };
  const folded = { ...base, wrapWidthPx: null, fold: { splitPx: 14 * 48 * unit, ringPx: 24 * 48 * unit, annexWidthPx: 480 * unit, bandOffsetPx: 176 * unit, capPx: 24 * unit } };
  for (const view of [{ width: 390, height: 723 }, { width: 430, height: 800 }, { width: 1024, height: 700 }]) {
    const a = raisingFieldViewport(preview, { ...view, scrollY: 0 }), b = raisingFieldViewport(folded, { ...view, scrollY: 0 });
    assert.equal(a.scale, b.scale, "same whole-pixel scale");
    assert.equal(a.scrollMaxY, b.scrollMaxY, "same scroll over the same height");
    assert.equal(a.y, b.y, "the board sits in the same place");
    assert.equal(a.scale, raisingFieldViewport(base, { ...view, scrollY: 0 }).scale, "the rows never shrink the board");
  }
  // A point on the locked rows is below the player's board: there is no
  // second band to map into, so nothing can be carried or built there.
  const view = { width: 390, height: 723, scrollY: 0 };
  const fit = raisingFieldViewport(preview, view);
  const point = raisingScreenToNative({ x: fit.x + 100 * unit * fit.scale, y: fit.y + 260 * unit * fit.scale }, preview, view, 0);
  assert.equal(point.band, undefined);
  assert.ok(point.y > 192, `${point.y} lies past the board`);
  const back = raisingNativeToScreen([40 * 4096, 100 * 4096, 0], preview, view, 0);
  assert.equal(back.band, undefined);
});

test("bytes read as people read them, never as zero once something arrived", () => {
  assert.equal(formatLoadBytes(0), "0 KB");
  assert.equal(formatLoadBytes(100), "1 KB");
  assert.equal(formatLoadBytes(640 * 1024), "640 KB");
  assert.equal(formatLoadBytes(3.25 * 1048576), "3.3 MB");
});

test("progress counts finished steps only, and reaches 100 % only when all are done", () => {
  const doc = fakeDocument();
  const progress = createLoadProgressView({ doc, steps: [{ id: "a", key: "LOAD_STEP_ENGINE" }, { id: "b", key: "LOAD_STEP_FACILITIES" },
    { id: "c", key: "LOAD_STEP_PARTNERS" }] });
  const bar = progress.element.children[0];
  const states = () => progress.element.children[1].children.map((item) => item.dataset.state).join(" ");
  assert.equal(bar.getAttribute("role"), "progressbar");
  assert.equal(bar.getAttribute("aria-valuenow"), "0");
  progress.start("a");
  assert.equal(states(), "active pending pending");
  assert.equal(bar.dataset.running, "true");
  assert.equal(bar.getAttribute("aria-valuenow"), "0", "a running step is not progress");
  progress.done("a"); progress.start("b"); progress.start("c");
  assert.equal(bar.getAttribute("aria-valuenow"), "33");
  progress.done("b");
  assert.equal(bar.getAttribute("aria-valuenow"), "67");
  assert.equal(progress.state(), "loading");
  progress.setBytes(2 * 1048576);
  assert.match(progress.element.children[2].textContent, /2\.0 MB/);
  progress.fail();
  assert.equal(states(), "done done error");
  assert.equal(progress.state(), "error");
  assert.equal(bar.dataset.failed, "true");
  progress.reset();
  assert.equal(states(), "pending pending pending");
  assert.equal(bar.getAttribute("aria-valuenow"), "0");
  for (const id of ["a", "b", "c"]) { progress.start(id); progress.done(id); }
  assert.equal(bar.getAttribute("aria-valuenow"), "100");
  assert.equal(progress.state(), "done");
  assert.throws(() => createLoadProgressView({ doc, steps: [] }));
});

test("downloaded bytes are network bytes: a cached file adds nothing but still counts as activity", () => {
  let callback = null, observed = null, disconnected = false;
  class FakeObserver {
    constructor(fn) { callback = fn; }
    observe(options) { observed = options; }
    disconnect() { disconnected = true; }
  }
  const seen = [];
  const watch = observeDownloadedBytes((total) => seen.push(total), { PerformanceObserverImpl: FakeObserver });
  assert.equal(watch.supported, true);
  assert.deepEqual(observed, { type: "resource", buffered: false });
  callback({ getEntries: () => [{ transferSize: 5300, encodedBodySize: 5000 }, { transferSize: 0, encodedBodySize: 90000 }, { transferSize: 700, encodedBodySize: 0 }] });
  assert.deepEqual(seen, [5000, 5000, 5700]);
  assert.equal(watch.total, 5700);
  watch.stop();
  assert.equal(disconnected, true);
  const unsupported = observeDownloadedBytes(() => {}, { PerformanceObserverImpl: function Broken() { throw new Error("no"); } });
  assert.equal(unsupported.supported, false);
});

test("a dialog can carry content, shows an unavailable action that cannot be chosen, and returns focus", async () => {
  const doc = fakeDocument();
  const opener = doc.createElement("button");
  doc.body.append(opener);
  opener.focus();
  const content = doc.createElement("div");
  const pending = showChoiceDialog({ doc, title: "T", content, variant: "expansion", cancelId: "close",
    actions: [{ id: "close", label: "Close" }, { id: "buy", label: "Not yet", tone: "primary", disabled: true }] });
  const dialog = doc.body.children.find((node) => node.tagName === "DIALOG");
  assert.equal(dialog.dataset.variant, "expansion");
  const panel = dialog.children[0];
  assert.ok(panel.children.includes(content), "content sits in the panel");
  const buy = dialog.querySelectorAll("BUTTON").find((button) => button.dataset.action === "buy");
  assert.equal(buy.disabled, true);
  assert.equal(buy.getAttribute("aria-disabled"), "true");
  assert.equal(doc.activeElement.dataset.action, "close", "focus starts on the safe, enabled action");
  dialog.dispatch("cancel");
  assert.equal(await pending, "close");
  assert.equal(doc.activeElement, opener, "focus is back on what opened it");
});

test("the expansion sheet says what it adds, keeps 16, and cannot be bought", async () => {
  const doc = fakeDocument();
  let request = null;
  const result = await openRanchExpansionPreview({ doc, ask: async (options) => { request = options; return "close"; } });
  assert.equal(result, "close");
  assert.equal(request.title, UI_COPY.EXPANSION_TITLE);
  assert.equal(request.cancelId, "close");
  assert.equal(request.focusId, "close");
  assert.deepEqual(request.actions.map((action) => [action.id, Boolean(action.disabled)]), [["close", false], ["unavailable", true]]);
  const markup = ranchExpansionMapMarkup();
  assert.equal(markup.match(/<polygon /g).length, 20, "two rows of the ranch and two of the expansion, five across");
  assert.equal(markup.match(/cm-expansion-sheet__hex--locked/g).length, 10);
  assert.equal(markup.match(/cm-expansion-sheet__lock"/g).length, 2);
  assert.match(markup, /^<svg [^>]*aria-hidden="true"/);
  assert.doesNotMatch(markup, /https?:/, "no namespace URL: the HTML parser places it");
  const body = ranchExpansionPreviewContent(doc);
  assert.equal(body.querySelectorAll("SVG").length, 1);
  assert.equal(body.querySelectorAll("LI").length, 3);
  assert.match(UI_COPY.EXPANSION_POINT_CAPACITY, /16/);
  assert.match(UI_COPY_EN.EXPANSION_POINT_CAPACITY, /16/);
  assert.match(UI_COPY.EXPANSION_STATUS_TITLE, /尚未開放/);
});
