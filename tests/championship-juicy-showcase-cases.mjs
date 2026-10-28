// Arcade evolution runner, skill cut-in, impact quartet and Dex showcase
// (Owner direction 2026-10-28). Node-only checks on small fakes; the browser
// gate (championship-codex-showcase-browser.cjs) covers the real page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { JUICY_SHOWCASE_TEXT, juicyText } from "../src/championship/text/juicyShowcaseText.js";
import { CYBER_MORPH_SWAPS, CYBER_MORPH_TIMING, cyberMorphSilhouetteSpans, playCyberMorphEvolution } from "../src/championship/presentation/juicy/cyberMorphEvolutionRunner.js";
import { SKILL_CUT_IN_TIMING, createSkillCutInLayer } from "../src/championship/presentation/juicy/skillCutIn.js";
import { createCodexShowcase, showcaseMoveLook } from "../src/championship/presentation/juicy/codexShowcaseTheater.js";
import { juicyMoveTitle, juicyPaletteCss, juicyPortrait, juicyPresentationEnabled, juicySignatureMove } from "../src/championship/presentation/juicy/juicyArt.js";
import { SHOWCASE_ACTIONS, showcaseMotionAvailable } from "../src/championship/presentation/juicy/spriteMotionPlayer.js";
import { BATTLE_FX_JUICY, createBattleFxLayer } from "../src/championship/presentation/battleFx/battleFxLayer.js";
import { BATTLE_FX_PALETTES as RECIPE_PALETTES, battleFxMoveTier as recipeTier } from "../src/championship/presentation/battleFx/battleFxRecipes.js";
import { BATTLE_FX_PALETTES, battleFxMoveTier } from "../src/championship/presentation/battleFx/battleFxPalettes.js";
import { createChampionshipClockDriver } from "../src/championship/app/championshipClockDriver.js";
import { evolutionStatChange } from "../src/championship/app/championshipStandaloneApp.js";
import { databaseVerifiedData } from "../src/championship/database/databaseStories.js";
import { createRaisingEvolutionCinematic } from "../src/championship/presentation/juicy/raisingEvolutionCinematic.js";

// ------------------------------------------------------------------ fake DOM
class FakeStyle {
  constructor() { this.props = new Map(); }
  setProperty(key, value) { this.props.set(key, String(value)); }
  getPropertyValue(key) { return this.props.get(key) ?? ""; }
}
class FakeNode {
  constructor(tag, doc) {
    Object.assign(this, { tagName: tag.toUpperCase(), ownerDocument: doc, children: [], parentNode: null, dataset: {}, style: new FakeStyle(),
      attributes: new Map(), listeners: new Map(), className: "", textContent: "", hidden: false });
  }
  append(...nodes) { for (const node of nodes) { if (node === null || node === undefined) continue; node.remove?.(); node.parentNode = this; this.children.push(node); } }
  after(node) { const parent = this.parentNode; if (!parent) return; node.remove(); node.parentNode = parent; parent.children.splice(parent.children.indexOf(this) + 1, 0, node); }
  remove() { if (!this.parentNode) return; const list = this.parentNode.children; list.splice(list.indexOf(this), 1); this.parentNode = null; }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  get lastChild() { return this.children.at(-1) ?? null; }
  get isConnected() { let node = this; while (node.parentNode) node = node.parentNode; return node === this.ownerDocument.body; }
  get classList() { return { add: name => { this.className = `${this.className} ${name}`.trim(); }, contains: name => this.className.split(/\s+/).includes(name) }; }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? (key === "src" ? this.src ?? null : null); }
  removeAttribute(key) { this.attributes.delete(key); if (key === "src") this.src = undefined; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type, extra = {}) { const event = { type, preventDefault() {}, stopPropagation() {}, ...extra }; for (const fn of [...(this.listeners.get(type) ?? [])]) fn(event); }
  click() { this.dispatch("click"); }
  focus() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  matches(selector) {
    return selector.split(",").map(s => s.trim()).some(one => one.startsWith(".")
      ? one.slice(1).split(".").every(name => this.className.split(/\s+/).includes(name))
      : this.tagName === one.toUpperCase());
  }
  querySelectorAll(selector) {
    const found = [];
    const walk = node => { for (const child of node.children) { if (child.matches(selector)) found.push(child); walk(child); } };
    walk(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  get text() { return this.textContent + this.children.map(child => child.text).join(""); }
}
function fakeDocument({ motion = "full", theme = "arcade" } = {}) {
  const listeners = new Map();
  const doc = {
    hidden: false,
    documentElement: { dataset: { motion, theme, quality: "balanced" } },
    createElement: tag => new FakeNode(tag, doc),
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    listeners
  };
  doc.body = new FakeNode("body", doc);
  return doc;
}
function fakeTimers() {
  const pending = new Map(); let id = 0;
  return {
    setTimer: (fn, ms) => { pending.set(++id, { fn, ms }); return id; },
    clearTimer: handle => pending.delete(handle),
    runAll() { for (const [handle, entry] of [...pending]) { pending.delete(handle); entry.fn(); } },
    get size() { return pending.size; }
  };
}

// ---------------------------------------------------------------- the copy
test("showcase copy is complete in all five locales and fills placeholders", () => {
  const keys = Object.keys(JUICY_SHOWCASE_TEXT["zh-Hant"]);
  for (const locale of ["en", "ja", "th", "vi"]) {
    assert.deepEqual(Object.keys(JUICY_SHOWCASE_TEXT[locale]).sort(), [...keys].sort(), `${locale} has every key`);
    for (const key of keys) assert.ok(JUICY_SHOWCASE_TEXT[locale][key].trim().length > 0, `${locale}:${key}`);
  }
  assert.equal(juicyText("evolution.plate", { name: "岩甲穿獸", stage: "成長期" }, "zh-Hant"), "岩甲穿獸 · 成長期");
  assert.equal(juicyText("preview.power", { value: 400 }, "en"), "Power 400");
});

// ---------------------------------------------------------- the timeline rules
test("the evolution runs 2.2-2.8 s and swaps silhouettes five times, quicker each time", () => {
  assert.ok(CYBER_MORPH_TIMING.length >= 2200 && CYBER_MORPH_TIMING.length <= 2800);
  assert.equal(CYBER_MORPH_TIMING.stage1, 600);
  assert.equal(CYBER_MORPH_TIMING.stage2, 1600);
  assert.equal(CYBER_MORPH_SWAPS[0], 600);
  assert.equal(CYBER_MORPH_SWAPS.at(-1), 1600);
  const gaps = CYBER_MORPH_SWAPS.slice(1).map((at, i) => at - CYBER_MORPH_SWAPS[i]);
  assert.ok(gaps.every((gap, i) => i === 0 || gap < gaps[i - 1]), "each swap comes sooner");
  const from = cyberMorphSilhouetteSpans("from"), to = cyberMorphSilhouetteSpans("to");
  assert.equal(from.length + to.length - 1, 5, "five swaps between six spans");
  const all = [...from.map(s => [...s, "from"]), ...to.map(s => [...s, "to"])].sort((a, b) => a[0] - b[0]);
  assert.ok(all.every((span, i) => i === 0 || (span[2] !== all[i - 1][2] && span[0] === all[i - 1][1])), "old and new alternate with no gap");
});

// ------------------------------------------------------------- the runner
test("preview: tap settles, a second tap leaves, the node and its art are released", async () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  let done = 0;
  const run = playCyberMorphEvolution({ host, doc, ...timers, mode: "preview",
    from: { name: "鎧焰蜥", portrait: { src: "a.webp" } }, to: { name: "地炎暴牙", stageLabel: "成熟期", portrait: { src: "b.webp" } },
    traits: ["龍屬性值 至少 20"], special: { name: "焚天炎砲" }, onDone: () => done++ });
  const root = host.querySelector(".cm-morph");
  assert.ok(root, "one overlay on the host");
  assert.equal(root.dataset.mode, "preview");
  assert.match(root.querySelector(".cm-morph__plate").text, /進化完成！/);
  assert.match(root.querySelector(".cm-morph__plate").text, /【地炎暴牙 · 成熟期】/);
  assert.match(root.querySelector(".cm-morph__panel").text, /龍屬性值 至少 20/);
  assert.match(root.querySelector(".cm-morph__panel").text, /焚天炎砲/);
  root.dispatch("pointerdown");
  assert.equal(root.dataset.state, "settled");
  root.dispatch("pointerdown");
  assert.equal(root.dataset.state, "leaving");
  timers.runAll();
  assert.equal(host.children.length, 0, "the overlay is gone");
  assert.equal(done, 1);
  assert.ok(root.querySelectorAll("img").every(image => !image.getAttribute("src")), "decoded art is dropped");
  assert.equal((await run.done).skipped, true);
  assert.equal(doc.listeners.get("keydown")?.size ?? 0, 0, "no document listener survives");
});

test("live: a tap asks the native clock to hurry; the real stat change rolls in and only then may it leave", () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const speeds = [];
  const run = playCyberMorphEvolution({ host, doc, ...timers, mode: "live", onSpeed: rate => speeds.push(rate),
    from: { name: "鎧焰蜥", portrait: { src: "a.webp" } }, to: { name: "岩甲穿獸", stageLabel: "成長期", portrait: { src: "b.webp" } } });
  const root = host.querySelector(".cm-morph");
  assert.match(root.querySelector(".cm-morph__panel").text, new RegExp(juicyText("evolution.saving")));
  root.dispatch("pointerdown");
  assert.deepEqual(speeds, [6]);
  root.dispatch("pointerdown");
  assert.equal(root.dataset.state, "settled", "no stats yet: it waits");
  assert.deepEqual(speeds, [6, 6]);
  const stats = ["HP", "TP", "攻擊", "防禦", "智力", "速度"].map((label, i) => ({ label, before: 30 + i, after: 30 + i * 2 }));
  assert.equal(run.setStats(stats), true);
  assert.equal(run.setStats(stats), false, "a run takes its stats once");
  const nums = root.querySelectorAll(".cm-morph__num");
  assert.equal(nums.length, 6);
  assert.deepEqual(nums.map(n => [n.dataset.from, n.dataset.to]), stats.map(s => [String(s.before), String(s.after)]));
  assert.equal(root.querySelectorAll(".cm-morph__stat")[2].dataset.trend, "up");
  root.dispatch("pointerdown");
  assert.equal(root.dataset.state, "leaving");
  run.dispose();
  assert.equal(host.children.length, 0);
});

test("live: an empty or missing stat report still lets the overlay go; late details fill the plate and badge", () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const run = playCyberMorphEvolution({ host, doc, ...timers, mode: "live",
    from: { name: "鎧焰蜥", portrait: null }, to: { name: "岩甲穿獸", portrait: null } });
  const root = host.querySelector(".cm-morph");
  assert.equal(run.setDetails({ stageLabel: "成長期", special: { name: "滾岩重擊" } }), true);
  assert.match(root.querySelector(".cm-morph__plate-title").textContent, /岩甲穿獸 · 成長期/);
  assert.match(root.querySelector(".cm-morph__panel").text, /滾岩重擊/);
  root.dispatch("pointerdown");
  assert.equal(run.setStats(null), true, "an empty report settles the wait");
  assert.doesNotMatch(root.querySelector(".cm-morph__panel").text, new RegExp(juicyText("evolution.saving")));
  assert.match(root.querySelector(".cm-morph__panel").text, /滾岩重擊/, "the badge survives the refill");
  root.dispatch("pointerdown");
  assert.equal(root.dataset.state, "leaving");
  run.dispose();
  // Without any report the safety clock releases it after the timeline.
  const quiet = playCyberMorphEvolution({ host, doc, ...timers, mode: "live", from: { name: "a", portrait: null }, to: { name: "b", portrait: null } });
  timers.runAll();
  assert.equal(quiet.getState().statsArrived, true);
  quiet.dispose();
  assert.equal(CYBER_MORPH_TIMING.statsTimeoutMs, 6000);
});

test("the Raising cinematic never plays a disappearance and loads its catalog details lazily", async () => {
  const doc = fakeDocument();
  let loads = 0;
  const cinematic = createRaisingEvolutionCinematic({ doc, loadDetails: async () => { loads++; return [
    { getDatabaseDisplayEntry: () => ({ numberingStageIndex: 3 }) },
    { databaseVerifiedData: () => ({ moves: databaseVerifiedData(35).moves }) }]; } });
  assert.equal(cinematic.enabled(), true);
  assert.equal(cinematic.start({ host: doc.body, instanceId: "a", fromSpecies: 34, toSpecies: -1 }), null, "a partner that disappears keeps the original");
  assert.equal(loads, 0);
  const handle = cinematic.start({ host: doc.body, instanceId: "a", fromSpecies: 34, toSpecies: 35, fromName: "Partner A" });
  assert.ok(doc.body.querySelector(".cm-morph--fullscreen"), "the real evolution covers the whole screen");
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loads, 1, "catalog details load only when an evolution starts");
  assert.match(doc.body.querySelector(".cm-morph__plate-title").textContent, /·/);
  assert.match(doc.body.querySelector(".cm-morph__panel").text, new RegExp(juicyText("evolution.special")));
  handle.setStats([{ key: "hp", before: 630, after: 680 }]);
  assert.equal(doc.body.querySelector(".cm-morph__stat-label").textContent, juicyText("stat.hp"));
  handle.dispose();
  assert.equal(doc.body.querySelectorAll(".cm-morph").length, 0);
});

test("encrypted keeps the new form a silhouette; back-to-egg shows the inheritance note", () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const locked = playCyberMorphEvolution({ host, doc, ...timers, encrypted: true, lockedNote: juicyText("locked.route"),
    from: { name: "鎧焰蜥", portrait: { src: "a.webp" } }, to: { name: "", portrait: null }, special: { name: "焚天炎砲" } });
  let root = host.querySelector(".cm-morph");
  assert.equal(root.dataset.encrypted, "true");
  assert.match(root.querySelector(".cm-morph__plate").text, /？？？？/);
  assert.ok(root.querySelector(".cm-morph__sil-body--cipher"), "no real outline without art");
  assert.equal(root.querySelectorAll("img").filter(image => image.getAttribute("src") === "b.webp").length, 0);
  assert.doesNotMatch(root.text, /焚天炎砲/, "the locked special stays hidden");
  assert.match(root.text, /🔒/);
  locked.dispose();
  const egg = playCyberMorphEvolution({ host, doc, ...timers, revert: true, mode: "live",
    from: { name: "岩甲穿獸", portrait: { src: "b.webp" } }, to: { name: "星絮蛋", portrait: null } });
  root = host.querySelector(".cm-morph");
  assert.equal(root.dataset.kind, "revert");
  assert.match(root.querySelector(".cm-morph__panel").text, new RegExp(juicyText("evolution.inherit")));
  assert.ok(root.querySelector(".cm-morph__egg"), "a drawn egg when no egg art exists");
  egg.dispose();
});

// ------------------------------------------------------------- the cut-in
test("cut-in: a 650 ms strip that never takes input; ally from the left, enemy from the right", () => {
  assert.equal(SKILL_CUT_IN_TIMING.length, 650);
  assert.equal(SKILL_CUT_IN_TIMING.dimStrength, 0.35);
  const css = fs.readFileSync("src/championship/app/ui/juicyShowcase.css", "utf8");
  assert.match(css, /\.cm-cutin-layer \{[^}]*pointer-events: none/);
  assert.match(css, /rotate\(-8deg\)/);
  const doc = fakeDocument(), host = doc.createElement("div");
  const layer = createSkillCutInLayer({ host, doc, spotlight: true });
  assert.equal(host.querySelector(".cm-cutin-layer").getAttribute("aria-hidden"), "true");
  layer.play({ team: "enemy", portrait: { src: "c.webp" }, moveName: "腐沼毒核", casterName: "腐沼核獸", palette: "toxic", focus: { x: 40, y: 60 } });
  const strip = host.querySelector(".cm-cutin");
  assert.equal(strip.dataset.team, "enemy");
  assert.equal(strip.dataset.palette, "toxic");
  assert.equal(strip.querySelector(".cm-cutin__name").textContent, "【 腐 沼 毒 核 】");
  assert.ok(Number(strip.querySelector(".cm-cutin__name").style.getPropertyValue("--glyphs")) >= 4);
  assert.equal(strip.querySelector(".cm-cutin__dim").style.getPropertyValue("--fx"), "40px");
  layer.play({ team: "ally", moveName: "烈鎧焰砲", portrait: { src: "d.webp" }, silhouette: true });
  assert.equal(host.querySelectorAll(".cm-cutin").length, 1, "a newer special replaces the strip");
  assert.ok(host.querySelector(".cm-cutin__face-sil"), "encrypted casters show an outline only");
  assert.equal(layer.capsule({ x: 10, y: 20, text: "芽核彈" }), true);
  assert.equal(layer.getDiagnostics().played, 2);
  layer.dispose();
  assert.equal(host.children.length, 0);
});

test("look-ups: titles, palettes, signature move and portraits come from the catalogs", () => {
  assert.equal(juicyMoveTitle("Toy Bomb"), "【 Toy Bomb 】");
  assert.deepEqual(juicyPaletteCss("fire"), { name: "fire", core: "#fff4c2", main: "#ff8a1c", edge: "#d8360f" });
  assert.equal(juicyPaletteCss("nope").name, "neutral");
  assert.equal(juicyPortrait("species-008").speciesIndex, 8);
  assert.equal(juicyPortrait(3), null, "eggs have no hero portrait");
  const moves = databaseVerifiedData(34).moves;
  assert.equal(juicySignatureMove(moves).recordIndex, moves.find(m => battleFxMoveTier(m, moves) === "ultimate").recordIndex);
  assert.ok(["projectile", "beam", "stream", "melee", "area"].includes(showcaseMoveLook(juicySignatureMove(moves).recordIndex).form));
  assert.equal(RECIPE_PALETTES, BATTLE_FX_PALETTES, "the recipes re-export the light palette module");
  assert.equal(recipeTier, battleFxMoveTier);
  assert.equal(juicyPresentationEnabled(fakeDocument({ theme: "classic" })), false, "classic keeps the original presentation");
  assert.equal(juicyPresentationEnabled(fakeDocument({ theme: "arcade" })), true);
  assert.deepEqual(SHOWCASE_ACTIONS.map(a => a.sequence), [0, 2, 7, 33], "idle, walk, attack, cheer: the Data Arena's audited ids");
  assert.equal(showcaseMotionAvailable("species-034", "https://example.invalid/"), false, "motion only where the runtime may load");
});

// ------------------------------------------------------------ the sandbox
test("the Dex sandbox is one reused node; closing and leaving release everything", () => {
  const doc = fakeDocument({ motion: "reduced" }), host = doc.body;
  const showcase = createCodexShowcase({ doc, overlayHost: host });
  const moves = databaseVerifiedData(34).moves;
  const special = showcase.specialButton({ speciesIndex: 34, speciesId: "species-034", name: "鎧焰蜥", move: juicySignatureMove(moves) });
  const evolution = showcase.evolutionButton({ from: { name: "鎧焰蜥", portrait: null }, to: { name: "", portrait: null }, encrypted: true });
  assert.equal(special.dataset.showcase, "special");
  assert.equal(evolution.dataset.encrypted, "true");
  special.click();
  assert.equal(host.querySelectorAll(".cm-showcase").length, 1);
  assert.equal(showcase.getDiagnostics().open, true);
  assert.ok(showcase.getDiagnostics().timers > 0, "the special's beats are scheduled");
  host.querySelector(".cm-showcase__close").click();
  assert.equal(showcase.getDiagnostics().open, false);
  assert.equal(showcase.getDiagnostics().timers, 0, "closing cancels every beat");
  evolution.click();
  assert.equal(host.querySelectorAll(".cm-showcase").length, 1, "the same sandbox is reused");
  assert.match(host.querySelector(".cm-showcase__title").textContent, /？？？？/);
  assert.ok(host.querySelector(".cm-morph"), "the shared evolution runner plays inside it");
  special.click();
  assert.equal(host.querySelectorAll(".cm-morph").length, 0, "starting another preview clears the stage");
  assert.equal(showcase.attachHero(doc.createElement("div"), { speciesId: "species-034" }), false, "no motion off the runtime location");
  showcase.dispose();
  assert.equal(host.querySelectorAll(".cm-showcase").length, 0);
  assert.equal(showcase.getDiagnostics().timers, 0);
});

test("the new pieces never create a renderer, a canvas, a frame loop or a game write", () => {
  for (const file of ["cyberMorphEvolutionRunner.js", "skillCutIn.js", "codexShowcaseTheater.js", "spriteMotionPlayer.js", "juicyArt.js", "raisingEvolutionCinematic.js"]) {
    const source = fs.readFileSync(`src/championship/presentation/juicy/${file}`, "utf8").replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of [/getContext\(/, /WebGLRenderer/, /new PIXI\./, /requestAnimationFrame/, /Application\(/, /localStorage/, /\.intents\./]) {
      assert.doesNotMatch(source, forbidden, `${file}: ${forbidden}`);
    }
  }
  const screens = fs.readFileSync("src/championship/app/vs4Screens.js", "utf8");
  assert.match(screens, /typeof createCodexShowcase === 'function'/, "controlled DOM harnesses load the Dex without the showcase");
  assert.match(screens, /selected\.state === 'REGISTERED' && route\.revealed && route\.historyState === 'RECORDED'/, "only a registered partner's recorded route plays in full");
});

// ------------------------------------------------------ the impact quartet
function fakePixi() {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; }, copyFrom(p) { this.x = p.x; this.y = p.y; } });
  class Container {
    constructor(options = {}) { Object.assign(this, { label: options.label, children: [], parent: null, visible: true, alpha: 1, rotation: 0, position: point(), scale: point(), destroyed: false }); this.scale.set(1); }
    addChild(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } return nodes[0]; }
    removeChild(node) { this.children = this.children.filter(child => child !== node); node.parent = null; }
    destroy() { this.destroyed = true; }
    get width() { return 40; }
    get height() { return 16; }
  }
  class Sprite extends Container { constructor(texture) { super(); Object.assign(this, { texture, anchor: point(), tint: 0xffffff, blendMode: "normal" }); } }
  class Graphics extends Container {}
  for (const name of ["clear", "rect", "roundRect", "ellipse", "moveTo", "lineTo", "stroke", "fill", "poly"]) Graphics.prototype[name] = function () { return this; };
  class Text extends Container { constructor({ text, style }) { super(); Object.assign(this, { text, style: { ...style }, anchor: point() }); } }
  return { Container, Sprite, Graphics, Text, Texture: { from: () => ({ source: {}, destroy() {} }) } };
}
function withCanvas(fn) {
  const previous = globalThis.document;
  const context = { createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, translate() {}, scale() {}, beginPath() {}, arc() {}, fill() {}, fillStyle: "" };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  try { return fn(); } finally { globalThis.document = previous; }
}
function quartetLayer(juicy) {
  const PIXI = fakePixi();
  return withCanvas(() => createBattleFxLayer({ PIXI, worldBack: new PIXI.Container(), worldFront: new PIXI.Container(), screen: new PIXI.Container(), juicy,
    describeMove: (slot, moveId) => ({ tier: moveId === 9 ? "ultimate" : "skill", palette: "fire", form: moveId === 9 ? "beam" : "melee", bankIds: [] }),
    moveNameOf: moveId => (moveId === 9 ? "烈鎧焰砲" : "爪擊"), nameOfSlot: () => "鎧焰蜥" }));
}
const slots = new Map([[0, { slot: 0, x: 50, y: 100, groundY: 100, top: 60, height: 40, width: 30, facing: 1, team: 0 }],
  [1, { slot: 1, x: 150, y: 100, groundY: 100, top: 60, height: 40, width: 30, facing: -1, team: 1 }]]);
const ctx = { artRect: { x: 0, y: 0, width: 300, height: 200 }, nativeScale: 1, localTeam: 0, viewport: { width: 300, height: 200 },
  slotInfo: slot => slots.get(slot) ?? null, opponentsOf: slot => [1 - slot], camera: { zoom: 1, x: 0, y: 0, director: null } };
const view = { combatants: [{ slot: 0, present: true, team: 0, hp: { ratio: 1 } }, { slot: 1, present: true, team: 1, hp: { ratio: 0.5 } }], nativeLifecycle: { effectActors: [], active: [] }, impactEffects: [] };

test("quartet: wind-up squash, 35 % dim and a closing ring for a special; a capsule for a skill", () => {
  const layer = quartetLayer(true);
  layer.update(view, ctx, 16, [{ type: "LAUNCH", slot: 0, moveId: 9 }]);
  let d = layer.getDiagnostics();
  assert.equal(d.callout, null, "the DOM strip carries a special's title");
  assert.equal(d.dimStrength, BATTLE_FX_JUICY.dimStrength);
  assert.equal(d.quartet.implodes, 1);
  layer.update(view, ctx, 60, []);
  const squash = layer.actorFx(0);
  assert.ok(squash.squashX > 1.05 && squash.squashY < 0.95, "1.12 x 0.88 around the middle of the wind-up");
  layer.update(view, ctx, 600, [{ type: "LAUNCH", slot: 0, moveId: 3 }]);
  d = layer.getDiagnostics();
  assert.equal(d.quartet.capsules, 1);
  assert.equal(layer.ghostTint(0), BATTLE_FX_PALETTES.fire.main, "a melee dash leaves afterimages in the move's colour");
  layer.dispose();
});

test("quartet: a heavy hit holds both fighters 60 ms, pushes 12 px, tints the flash and arcs a pooled number", () => {
  const layer = quartetLayer(true);
  layer.update(view, ctx, 16, [{ type: "HIT", slot: 1, attackerSlot: 0, moveId: 9, damage: 161, ratio: 0.3, critical: true }]);
  assert.equal(layer.holdFor(1), true);
  assert.equal(layer.holdFor(0), true);
  assert.equal(layer.hitStopActive(), true);
  const fx = layer.actorFx(1);
  assert.equal(fx.flashTint, BATTLE_FX_PALETTES.fire.main);
  assert.ok(Math.abs(fx.offsetX) >= 8, "the knock is at least 8 px");
  layer.updateScreen({ viewport: { width: 300, height: 200 }, view, ctx, dtMs: 16 });
  let d = layer.getDiagnostics();
  assert.equal(d.quartet.numbers, 1);
  assert.equal(d.quartet.criticals, 1);
  assert.equal(d.quartet.hitStops, 1);
  layer.update(view, ctx, 70, []);
  assert.equal(layer.hitStopActive(), false, "the hold ends after 60 ms");
  for (let i = 0; i < 6; i++) layer.update(view, ctx, 16, [{ type: "HIT", slot: 1, attackerSlot: 0, moveId: 3, damage: 5 + i, ratio: 0.01 }]);
  layer.updateScreen({ viewport: { width: 300, height: 200 }, view, ctx, dtMs: 16 });
  d = layer.getDiagnostics();
  assert.ok(d.quartet.numbersLive <= BATTLE_FX_JUICY.numberPool, "numbers come from a bounded pool");
  layer.dispose();
});

test("without juicy the layer keeps its earlier callout, dim and knock exactly", () => {
  const layer = quartetLayer(false);
  layer.update(view, ctx, 16, [{ type: "LAUNCH", slot: 0, moveId: 9 }]);
  const d = layer.getDiagnostics();
  assert.equal(d.callout?.tier, "ultimate");
  assert.equal(d.dimStrength, 0.45);
  assert.equal(d.quartet.windups, 0);
  layer.update(view, ctx, 16, [{ type: "HIT", slot: 1, attackerSlot: 0, moveId: 9, damage: 161, ratio: 0.3 }]);
  assert.equal(layer.hitStopActive(), false);
  assert.equal(layer.actorFx(1).flashTint, undefined);
  assert.ok(Math.abs(layer.actorFx(1).offsetX) <= 4.2);
  layer.dispose();
});

// ------------------------------------------------------------ the clock
test("an arcade evolution plays its native frames faster; the natural clock never takes the rate", () => {
  let now = 0;
  const handed = { presentation: [], natural: [] };
  const ticker = { fn: null, add(fn) { this.fn = fn; }, remove() { this.fn = null; } };
  let presenting = true;
  const app = { getSession: () => "s", getScreen: () => "RAISING_HOME", subscribeScreen: () => () => {}, getClockRunState: () => ({ running: true }),
    hasRaisingPresentation: () => presenting, raisingPresentationRate: () => 2,
    advanceRaisingPresentation: ({ frames }) => handed.presentation.push(frames), advanceNaturalClock: ({ frames }) => handed.natural.push(frames) };
  const driver = createChampionshipClockDriver({ app, ticker, now: () => now });
  driver.setActive(true);
  ticker.fn(); now += 16.716; ticker.fn(); now += 16.716; ticker.fn();
  presenting = false;
  now += 16.716; ticker.fn();
  assert.deepEqual(handed.presentation, [2, 2], "one native frame per tick, played twice as fast");
  assert.deepEqual(handed.natural, [1]);
  driver.dispose();
  assert.equal(evolutionStatChange(null, null), null, "an unreadable profile shows no panel rather than wrong numbers");
});
