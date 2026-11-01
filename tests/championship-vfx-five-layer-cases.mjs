// VFX_FIVE_LAYER_20261101: one effect-element authority, original remake r2,
// fallback cells, the Dex wait, the battle lens and the shared element layer.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import moves from "../src/data/championship/catalogs/battle-moves.r1.json" with { type: "json" };
import licensed from "../assets/production/vfx/licensed-runtime-v1/manifest.json" with { type: "json" };
import {
  ELEMENT_VFX, STYLE_FALLBACK_CELLS, VFX_ELEMENTS, CRITICAL_VFX_SYSTEM, elementVfx, resolveMoveVfx, supportVfxSystem
} from "../src/championship/presentation/vfx/unifiedMoveVfxResolver.js";
import { moveNameElement } from "../src/championship/text/moveNameElements.js";
import { SHARED_VFX_REMAKE_R2_MANIFEST, sharedVfxRemakeAllowed, validateSharedVfxRemake } from "../src/championship/presentation/vfx/sharedVfxRemakeR2.js";
import { originalVfxCellArtAllowed } from "../src/championship/presentation/vfx/originalVfxCellArt.js";
import { ELEMENT_DECAL_MS, ELEMENT_STORM_MS, createElementVfxLayer } from "../src/championship/presentation/vfx/elementVfxLayer.js";
import { createBattleFxCamera } from "../src/championship/presentation/battleFx/battleFxCamera.js";
import { createCodexShowcase, showcaseMoveLook, SHOWCASE_CELL_WAIT_MS } from "../src/championship/presentation/juicy/codexShowcaseTheater.js";
import { SHOWCASE_CARRIER_STYLES, SHOWCASE_STREAM_STYLES, SHOWCASE_STYLE_NAMES } from "../src/championship/presentation/juicy/showcaseMoveVfx.js";
import { dataArenaMoveElement } from "../src/championship/presentation/dataArena/dataArenaElementFx.js";

const records = moves.records;
const byId = new Map(records.map(record => [record.recordIndex, record]));
const speciesMoves = id => records.filter(record => record.speciesId === byId.get(id).speciesId);
const look = id => resolveMoveVfx(byId.get(id), { speciesMoves: speciesMoves(id) });
const named = records.filter(record => record.recordIndex >= 31);

test("the resolver reads the name, the record, the bank and then the caster's ten-element taxonomy", () => {
  assert.equal(moveNameElement(34), "FIRE", "焰角泡泡 reads 焰 before 泡");
  const bubble = look(34);
  assert.equal(bubble.element, "FIRE");
  assert.equal(bubble.elementSource, "NAME");
  assert.equal(bubble.paletteKey, "fire");
  assert.ok(bubble.cellHue < -150 && bubble.cellHue > -190, `the blue bubble cells turn to fire (${bubble.cellHue})`);
  assert.equal(look(61).element, "FIRE");
  const moon = look(530);
  assert.equal(moon.element, "MOON");
  assert.notEqual(moon.cellTint, 0xffffff, "a gold bank on a moon move is pulled to violet");
  // Every one of the ten elements is reachable, and none of the 565 stays neutral.
  const seen = new Map();
  for (const record of named) { const v = look(record.recordIndex); seen.set(v.element, (seen.get(v.element) ?? 0) + 1); }
  for (const element of VFX_ELEMENTS) assert.ok(seen.get(element) > 0, `${element} is used`);
  assert.equal(seen.get("NEUTRAL") ?? 0, 0);
  // A move whose name, selector and bank say nothing takes the partner's element.
  const partnerOnly = named.map(r => look(r.recordIndex)).filter(v => v.elementSource === "PARTNER");
  assert.ok(partnerOnly.length > 100, "the taxonomy fills the neutral moves");
});

test("no signature move and no named move plays without effect cells", () => {
  let signatures = 0, fallback = 0;
  for (const record of named) {
    const v = look(record.recordIndex);
    assert.ok(v.cells.length > 0, `move ${record.recordIndex} has cells`);
    if (v.tier === "ultimate") signatures++;
    if (v.fallback) {
      fallback++;
      for (const cell of v.cells) assert.equal(cell.source, "FALLBACK");
    }
  }
  assert.equal(signatures, 204);
  assert.equal(fallback, 151, "the 151 bank-less records get presentation fallback cells");
  for (const style of SHOWCASE_STYLE_NAMES) assert.ok(STYLE_FALLBACK_CELLS[style], `${style} has fallback cells`);
});

test("original cells cover at least 85% of the 565 named moves", () => {
  const owner = JSON.parse(fs.readFileSync("assets/production/vfx/original-shared-review-210-seamfix-r1/manifest.json", "utf8"));
  const remake = JSON.parse(fs.readFileSync(SHARED_VFX_REMAKE_R2_MANIFEST, "utf8"));
  const original = new Set([...owner.banks, ...remake.banks].flatMap(bank => bank.sequences.map(id => `${bank.bankId}:${id}`)));
  let any = 0;
  for (const record of named) if (look(record.recordIndex).cells.some(cell => original.has(`${cell.bankId}:${cell.sequence}`))) any++;
  assert.ok(any / named.length >= 0.85, `original coverage ${(any / named.length * 100).toFixed(1)}%`);
});

test("remake r2 is original, whole-sequence and hash-bound", () => {
  const manifest = JSON.parse(fs.readFileSync(SHARED_VFX_REMAKE_R2_MANIFEST, "utf8"));
  const checked = validateSharedVfxRemake(manifest);
  assert.deepEqual(checked.banks.map(bank => bank.bankId).sort((a, b) => a - b), [6, 8, 13, 24, 25, 26, 32, 33, 53, 78, 121]);
  assert.equal(checked.rightsStatus, "ORIGINAL_CREATED");
  assert.equal(checked.provenance.originalPixelsUsed, false);
  assert.match(checked.provenance.imageGeneration, /^NONE/);
  const png = fs.readFileSync(checked.image.src);
  assert.equal(crypto.createHash("sha256").update(png).digest("hex"), checked.image.sha256);
  const index = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json", "utf8"));
  const entry = index.entries.find(row => row.assetId === "art:vfx:original-shared:remake-r2:v1");
  assert.equal(entry?.rightsStatus, "ORIGINAL_CREATED");
  assert.equal(entry.publicReleasePermitted, false, "publication waits for the Owner");
  assert.equal(sharedVfxRemakeAllowed("http://127.0.0.1:8761/championship.html"), true);
  assert.equal(sharedVfxRemakeAllowed("https://orochi771127.github.io/championship-2026/championship.html"), false, "loopback review only");
  assert.equal(sharedVfxRemakeAllowed("http://127.0.0.1:8761/championship.html?vfxRemake=off"), false);
  assert.equal(originalVfxCellArtAllowed("https://example.invalid/championship.html"), false);
});

test("support, critical and signature weather name real bounded 3D systems", () => {
  const ids = new Set(licensed.systems.map(system => system.systemId));
  for (const code of [0, 14, 19, 20, 21, 22, 23, 24, 25, 29]) assert.ok(ids.has(supportVfxSystem(code)), `support code ${code}`);
  assert.equal(supportVfxSystem(21), "battle-atkup");
  assert.equal(supportVfxSystem(22), "battle-defup");
  assert.equal(supportVfxSystem(23), "battle-speedup");
  assert.ok(ids.has(CRITICAL_VFX_SYSTEM));
  for (const element of VFX_ELEMENTS) { const weather = ELEMENT_VFX[element].weather; if (weather) assert.ok(ids.has(weather), `${element} ${weather}`); }
  assert.equal(look(34).weather, null, "fire keeps the hyper effect alone");
  assert.equal(elementVfx("WIND").weather, "common-wind");
});

test("the Dex preview takes the resolver's look, streams cells on every travel style and waits for the atlas", () => {
  const bubble = showcaseMoveLook(34);
  assert.equal(bubble.palette, "fire");
  assert.equal(bubble.element, "FIRE");
  assert.ok(bubble.cellHue !== 0);
  for (const style of SHOWCASE_STYLE_NAMES) {
    if (["strike", "claw", "slash", "pierce"].includes(style)) continue;
    assert.ok(SHOWCASE_CARRIER_STYLES.includes(style) || SHOWCASE_STREAM_STYLES[style], `${style} carries the move's cells`);
  }
  const css = fs.readFileSync("src/championship/app/ui/juicyShowcase.css", "utf8");
  assert.doesNotMatch(css, /\.cm-vfx--flame\s*\{/, "the flat CSS flame cone is gone");
  assert.ok(SHOWCASE_CELL_WAIT_MS >= 1500);
});

test("the battle lens pushes in toward a signature hit and comes back; reduced motion keeps the shot", () => {
  const art = { x: 0, y: 0, width: 400, height: 260 }, viewport = { width: 390, height: 300 };
  const subjects = [{ slot: 0, x: 120, left: 100, right: 140, top: 120, bottom: 200, groundY: 200 }, { slot: 1, x: 280, left: 260, right: 300, top: 120, bottom: 200, groundY: 200 }];
  const director = createBattleFxCamera({ boundedMap: false });
  for (let i = 0; i < 40; i++) director.update({ dtMs: 16, viewport, art, subjects });
  const base = director.update({ dtMs: 16, viewport, art, subjects }).zoom;
  assert.equal(director.lens({ x: 280, y: 160, amount: 0.22, ms: 260 }), true);
  let peak = 0;
  for (let i = 0; i < 6; i++) peak = Math.max(peak, director.update({ dtMs: 16, viewport, art, subjects }).zoom);
  assert.ok(peak / base >= 1.18, `lens peak ${(peak / base).toFixed(3)}x`);
  for (let i = 0; i < 30; i++) director.update({ dtMs: 16, viewport, art, subjects });
  assert.equal(director.getState().lens, null);
  assert.equal(createBattleFxCamera({ reducedMotion: true }).lens({ x: 1, y: 1 }), false);
});

function fakePixi() {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Container {
    constructor() { Object.assign(this, { children: [], parent: null, visible: true, alpha: 1, rotation: 0, position: point(), scale: point(), anchor: point(), destroyed: false }); }
    addChild(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } return nodes[0]; }
    addChildAt(node) { return this.addChild(node); }
    removeChild(node) { this.children = this.children.filter(child => child !== node); }
    destroy() { this.destroyed = true; this.parent?.removeChild(this); }
  }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; } }
  return { Container, Sprite, Texture: { from: () => ({ destroy() {} }) } };
}
function withCanvas(fn) {
  const previous = globalThis.document;
  const ctx = new Proxy({}, { get: (target, key) => key in target ? target[key] : () => ({ addColorStop() {} }), set: (target, key, value) => { target[key] = value; return true; } });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  try { return fn(); } finally { globalThis.document = previous; }
}

test("the element layer keeps ground marks four seconds, storms about half a second, and holds on a hit-stop", () => withCanvas(() => {
  const PIXI = fakePixi(), ground = new PIXI.Container(), front = new PIXI.Container();
  const layer = createElementVfxLayer({ PIXI, ground, front, quality: "balanced" });
  const palette = elementVfx("WOOD").palette;
  layer.decal({ x: 10, y: 10, kind: "roots", palette, paletteKey: "nature" });
  layer.storm({ kind: "gale", palette, rect: { x: 0, y: 0, width: 300, height: 200 } });
  layer.charge({ x: 0, y: 0, palette, ms: 140 });
  layer.muzzle({ x: 0, y: 0, palette });
  assert.equal(layer.getDiagnostics().storms, 1);
  layer.hold(55);
  layer.update(50);
  assert.equal(layer.getDiagnostics().storms, 1, "the storm holds during a hit-stop");
  for (let t = 0; t < ELEMENT_STORM_MS + 100; t += 16) layer.update(16);
  assert.equal(layer.getDiagnostics().storms, 0);
  assert.equal(layer.getDiagnostics().decals, 1, "the mark outlives the storm");
  for (let t = 0; t < ELEMENT_DECAL_MS; t += 16) layer.update(16);
  assert.equal(layer.getDiagnostics().decals, 0);
  assert.equal(layer.cell({ bankId: 6, sequence: 1 }), null, "no art, no cells");
  layer.dispose();
}));

test("Data Arena moves take the same element rule", () => {
  const kits = JSON.parse(fs.readFileSync("src/data/championship/data-arena-relay-kits.v1.json", "utf8"));
  const own = kits.species.flatMap(([, , list]) => list.map(([record]) => record)).find(record => moveNameElement(record) === "FIRE");
  assert.ok(own, "some partner owns a fire-named move");
  assert.equal(dataArenaMoveElement(`own-${own}`), "FIRE", "a partner's own move reads its name");
  assert.equal(dataArenaMoveElement("tideBolt"), "WATER");
  assert.equal(dataArenaMoveElement("clawSweep", "species-054"), "WOOD", "a neutral body move takes the caster's element");
});

test("the Dex sandbox still schedules its beats at once while the atlas loads", () => {
  // The same fake DOM the juicy showcase cases use, reduced.
  class Node {
    constructor(tag) { Object.assign(this, { tagName: tag.toUpperCase(), children: [], parentNode: null, dataset: {}, style: { setProperty() {} }, attributes: new Map(), listeners: new Map(), className: "", textContent: "", hidden: false }); }
    append(...nodes) { for (const node of nodes) { if (!node) continue; node.parentNode = this; this.children.push(node); } }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    get classList() { return { add: n => { this.className += ` ${n}`; }, contains: () => false, remove() {} }; }
    setAttribute(k, v) { this.attributes.set(k, v); } removeAttribute(k) { this.attributes.delete(k); }
    addEventListener(t, f) { (this.listeners.get(t) ?? this.listeners.set(t, new Set()).get(t)).add(f); }
    click() { for (const f of this.listeners.get("click") ?? []) f({}); }
    focus() {} after() {} getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 300 }; }
    querySelectorAll(selector) { const name = selector.replace(/^\./, ""), out = []; const walk = n => { for (const c of n.children) { if (c.className.split(/\s+/).includes(name)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }
  const doc = { documentElement: { dataset: { motion: "reduced", theme: "arcade" } }, createElement: tag => new Node(tag), addEventListener() {}, removeEventListener() {} };
  doc.body = new Node("body");
  const showcase = createCodexShowcase({ doc, overlayHost: doc.body });
  const button = showcase.specialButton({ speciesIndex: 34, speciesId: "species-034", name: "火甲龍", move: { recordIndex: 61, name: "烈鎧焰砲", power: 400 } });
  button.click();
  assert.ok(showcase.getDiagnostics().timers > 0);
  showcase.dispose();
  assert.equal(showcase.getDiagnostics().timers, 0);
});
