// Arcade evolution runner, skill cut-in, impact quartet and Dex showcase
// (Owner direction 2026-10-28). Node-only checks on small fakes; the browser
// gate (championship-codex-showcase-browser.cjs) covers the real page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { JUICY_SHOWCASE_TEXT, juicyText } from "../src/championship/text/juicyShowcaseText.js";
import { CYBER_MORPH_GLYPHS, CYBER_MORPH_LANES, CYBER_MORPH_LOOKS, CYBER_MORPH_SWAPS, CYBER_MORPH_TIMING, CYBER_MORPH_WORDS, cyberMorphSilhouetteSpans,
  cyberMorphStrobe, playCyberMorphEvolution } from "../src/championship/presentation/juicy/cyberMorphEvolutionRunner.js";
import { SKILL_CUT_IN_TIMING, createSkillCutInLayer, skillCutInFaceFrame } from "../src/championship/presentation/juicy/skillCutIn.js";
import { createCodexShowcase, showcaseMoveLook } from "../src/championship/presentation/juicy/codexShowcaseTheater.js";
import { juicyMoveTitle, juicyPaletteCss, juicyPortrait, juicyPresentationEnabled, juicySignatureMove } from "../src/championship/presentation/juicy/juicyArt.js";
import { SHOWCASE_ACTIONS, createSpriteMotion, loadShowcaseMotion, showcaseFitScale, showcaseMotionAvailable, showcaseReleaseFrame } from "../src/championship/presentation/juicy/spriteMotionPlayer.js";
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
test("the evolution runs 3.2-3.8 s: a colour idle, an ever-faster white/black strobe between the forms, a colour landing", () => {
  assert.ok(CYBER_MORPH_TIMING.length >= 3200 && CYBER_MORPH_TIMING.length <= 3800);
  assert.equal(CYBER_MORPH_TIMING.stage1, 1000);
  assert.equal(CYBER_MORPH_TIMING.stage2, 2600);
  assert.equal(CYBER_MORPH_SWAPS[0], CYBER_MORPH_TIMING.stage1);
  assert.equal(CYBER_MORPH_SWAPS.at(-1), CYBER_MORPH_TIMING.stage2);
  const gaps = CYBER_MORPH_SWAPS.slice(1).map((at, i) => at - CYBER_MORPH_SWAPS[i]);
  assert.ok(gaps.every((gap, i) => i === 0 || gap < gaps[i - 1]), "each swap comes sooner");
  const from = cyberMorphSilhouetteSpans("from"), to = cyberMorphSilhouetteSpans("to");
  assert.ok(from.length + to.length - 1 >= 8, "at least eight swaps");
  const all = [...from.map(s => [...s, "from"]), ...to.map(s => [...s, "to"])].sort((a, b) => a[0] - b[0]);
  assert.ok(all.every((span, i) => i === 0 || (span[2] !== all[i - 1][2] && span[0] === all[i - 1][1])), "old and new alternate with no gap");
  // The strobe: colour through Stage 1, only white or black in Stage 2, the new form in colour after the burst.
  const look = (steps, ms) => steps.filter(step => step.at <= ms).at(-1);
  const fromSteps = cyberMorphStrobe("from"), toSteps = cyberMorphStrobe("to");
  assert.deepEqual([look(fromSteps, 500).look, look(fromSteps, 500).opacity], ["colour", 1]);
  assert.equal(look(toSteps, 500).opacity, 0);
  for (let ms = CYBER_MORPH_TIMING.stage1; ms < CYBER_MORPH_TIMING.stage2; ms += 10) {
    const shown = [look(fromSteps, ms), look(toSteps, ms)].filter(step => step.opacity === 1);
    assert.equal(shown.length, 1, `one form at ${ms} ms`);
    assert.ok(["white", "black"].includes(shown[0].look), `white or black at ${ms} ms`);
  }
  const looks = new Set([...fromSteps, ...toSteps].filter(s => s.at >= CYBER_MORPH_TIMING.stage1 && s.at < CYBER_MORPH_TIMING.stage2 && s.opacity).map(s => s.look));
  assert.deepEqual([...looks].sort(), ["black", "white"]);
  assert.deepEqual([look(toSteps, CYBER_MORPH_TIMING.landed).look, look(fromSteps, CYBER_MORPH_TIMING.landed).opacity], ["colour", 0]);
  assert.equal(look(cyberMorphStrobe("to", { encrypted: true }), CYBER_MORPH_TIMING.length).look, "white", "an encrypted form never shows its colours");
  assert.match(CYBER_MORPH_LOOKS.white, /^brightness\(0\) invert\(1\)/);
  assert.match(CYBER_MORPH_LOOKS.black, /^brightness\(0\) invert\(0\.04\).*rgb\(95, 243, 255\)/, "deep black with a cyan rim");
});

test("the backdrop streams multilingual evolution words and the Owner's evolution glyphs, never hex", () => {
  for (const word of ["進化", "EVOLUTION", "진화", "ÉVOLUTION", "EVOLUCIÓN", "EVOLUZIONE", "進化する", "TIẾN HÓA", "วิวัฒนาการ"]) {
    assert.ok(CYBER_MORPH_WORDS.includes(word), word);
  }
  assert.ok(!CYBER_MORPH_WORDS.some(word => /DIGI/i.test(word)), "no other game's trademark");
  const manifest = JSON.parse(fs.readFileSync("assets/production/public-runtime/evolution-glyphs.v1.json", "utf8"));
  assert.deepEqual(CYBER_MORPH_GLYPHS.map(glyph => glyph.id), ["CP-G01", "CP-G02", "CP-G03", "CP-G04"]);
  assert.deepEqual(CYBER_MORPH_GLYPHS.map(glyph => glyph.src), manifest.assets.map(asset => asset.src));
  assert.deepEqual(new Set(CYBER_MORPH_LANES.map(lane => lane.depth)), new Set(["far", "mid", "near"]));
  assert.ok(CYBER_MORPH_LANES.some(lane => lane.axis === "y") && CYBER_MORPH_LANES.some(lane => lane.tilt !== 0), "across, falling and slanted lanes");
  const near = CYBER_MORPH_LANES.filter(lane => lane.depth === "near"), far = CYBER_MORPH_LANES.filter(lane => lane.depth === "far");
  assert.ok(Math.min(...near.map(l => l.size)) > Math.max(...far.map(l => l.size)) && Math.max(...near.map(l => l.ms)) < Math.min(...far.map(l => l.ms)),
    "near words are bigger and faster than far ones");

  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const run = playCyberMorphEvolution({ host, doc, from: { name: "甲", portrait: { src: "a.png" } }, to: { name: "乙", portrait: { src: "b.png" } },
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, loadMotion: () => null });
  const root = host.querySelector(".cm-morph");
  const lanes = root.querySelectorAll(".cm-morph__lane");
  assert.equal(lanes.length, CYBER_MORPH_LANES.length);
  const words = root.querySelectorAll(".cm-morph__word").map(word => word.textContent);
  assert.ok(words.includes("進化") && words.includes("EVOLUTION") && words.includes("진화"));
  assert.ok(!words.some(word => /^[0-9A-F]{2,}$/.test(word)), "no hex filler");
  const glyphs = root.querySelectorAll(".cm-morph__glyph");
  assert.deepEqual([...new Set(glyphs.map(glyph => glyph.dataset.glyph))].sort(), ["CP-G01", "CP-G02", "CP-G03", "CP-G04"]);
  assert.match(glyphs[0].style.getPropertyValue("mask-image"), /evolution-glyphs-v1\/CP-G0\d-/);
  assert.equal(root.querySelectorAll(".cm-morph__rain-col").length, 0);
  const source = fs.readFileSync("src/championship/presentation/juicy/cyberMorphEvolutionRunner.js", "utf8");
  assert.doesNotMatch(source, /ABCDEF|CEEDD/, "the hex glyph rain is gone");
  run.dispose();
});

test("the stage is depth-sorted: far ring halves behind the partner, near halves (with tick blocks) in front", () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const run = playCyberMorphEvolution({ host, doc, from: { name: "甲", portrait: { src: "a.png" } }, to: { name: "乙", portrait: { src: "b.png" } },
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, loadMotion: () => null });
  const core = host.querySelector(".cm-morph__core");
  const order = core.children.map(child => child.className);
  const figure = order.indexOf("cm-morph__figure");
  const backs = order.map((name, i) => [name, i]).filter(([name]) => name.includes("cm-morph__ring3d--back"));
  const fronts = order.map((name, i) => [name, i]).filter(([name]) => name.includes("cm-morph__ring3d--front"));
  assert.ok(backs.length >= 2 && fronts.length >= 2 && backs.length === fronts.length, "every ring has a far and a near half");
  assert.ok(backs.every(([, i]) => i < figure) && fronts.every(([, i]) => i > figure));
  assert.ok(order.indexOf("cm-morph__pillar") < figure && order.indexOf("cm-morph__orbit") < figure, "the light column and the motes start behind");
  const css = fs.readFileSync("src/championship/app/ui/juicyShowcase.css", "utf8");
  assert.match(css, /\.cm-morph__ring3d--back \{ z-index: 1; clip-path: inset\(0 0 50% 0\); \}/);
  assert.match(css, /\.cm-morph__ring3d--front \{ z-index: 3; clip-path: inset\(50% 0 0 0\); \}/);
  assert.match(css, /\.cm-morph__figure \{[^}]*z-index: 2/);
  assert.match(css, /\.cm-morph__ring3d--front \.cm-morph__ring3d-band \{ border: 5px solid #f2feff/, "the near half is thicker with a white core");
  assert.match(css, /\.cm-morph__ring3d--front \.cm-morph__ring3d-band::before \{[^}]*repeating-conic-gradient/, "tick blocks travel on the near half");
  run.dispose();
});

test("the partners are their real idle motion, one cell each, standing on the plinth; the new form cheers when it lands", async () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const requested = [];
  const loadMotion = ref => { requested.push(ref); return Promise.resolve(fakeMotion()); };
  const run = playCyberMorphEvolution({ host, doc, from: { name: "甲", portrait: { src: "a.png", speciesIndex: 22 }, speciesIndex: 22 },
    to: { name: "乙", portrait: { src: "b.png", speciesIndex: 54 }, speciesIndex: 54 }, setTimer: timers.setTimer, clearTimer: timers.clearTimer, loadMotion });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(requested, [22, 54]);
  assert.deepEqual(run.getState().art, { from: "sprite", to: "sprite" });
  const root = host.querySelector(".cm-morph");
  assert.equal(root.querySelectorAll(".cm-sprite").length, 2, "one sprite per form, never a strip");
  for (const sprite of root.querySelectorAll(".cm-sprite")) {
    assert.ok(sprite.className.includes("cm-sprite--footed"), "the feet stand on the plinth (--foot)");
    const body = sprite.querySelector(".cm-sprite__body");
    const scale = showcaseFitScale(fakeMotion(), { width: 86, height: 74, maxNative: 8, minNative: 2 });
    assert.equal(body.style.width, `${Math.round(20 * scale * 100) / 100}px`, "the body is one packed cell wide");
  }
  run.settle();
  assert.equal(run.getState().revealed, true);
  run.dispose();
  // Unrevealed targets and eggs never load a body.
  requested.length = 0;
  playCyberMorphEvolution({ host, doc, from: { name: "甲", portrait: null, speciesIndex: 22 }, to: { name: "", portrait: null, speciesIndex: 54 },
    encrypted: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer, loadMotion }).dispose();
  assert.deepEqual(requested, [22]);
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

// ------------------------------------------- 2026-10-29: one cell, feet, muzzle, faces
function fakeMotion() {
  const frame = Object.freeze({ url: "p.webp", x: 0, y: 0, w: 20, h: 40, ox: -10, oy: -40, pageWidth: 100, pageHeight: 50, ticks: 10 });
  return { speciesId: "species-022", density: 4, anchor: { x: 0.5, y: 0.6 }, bounds: { left: -10, top: -40, right: 10, bottom: 0 }, frameWidth: 20, frameHeight: 40,
    sequences: new Map([[0, [frame]], [7, [frame]], [33, [frame]]]), release: new Map([[7, { index: 0, atMs: 0 }]]), muzzle: { x: -5, y: -26 } };
}

// Serves the repository's own files for a loopback page.
const localFetch = async url => {
  const file = decodeURIComponent(new URL(url).pathname.slice(1));
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
};

test("the motion player shows one packed cell at a time and stands it on its foot origin", async () => {
  const motion = await loadShowcaseMotion("species-021", { baseUrl: "http://127.0.0.1:8811/championship.html", fetchImpl: localFetch });
  for (const frames of motion.sequences.values()) {
    for (const frame of frames) {
      assert.ok(frame.w < 256 && frame.h < 256, "a trimmed cell, not the 256 px source canvas");
      assert.ok(frame.x + frame.w <= frame.pageWidth && frame.y + frame.h <= frame.pageHeight);
    }
  }
  assert.ok(motion.frameWidth < 256 && motion.frameHeight < 256, "the element is the drawn bounds, not a window over the page");
  assert.ok(motion.bounds.top < 0 && motion.bounds.bottom >= 0 && motion.bounds.left < 0 && motion.bounds.right > 0, "bounds surround the feet");
  const doc = fakeDocument();
  const sprite = createSpriteMotion({ doc, motion, scale: 0.5 });
  sprite.play(0);
  const body = sprite.element.children[0];
  const first = motion.sequences.get(0)[0];
  assert.equal(body.style.width, `${first.w * 0.5}px`, "the body is exactly one cell wide");
  assert.equal(body.style.backgroundPosition, `${-first.x * 0.5}px ${-first.y * 0.5}px`);
  assert.ok(sprite.element.className.includes("cm-sprite--footed"));
  assert.equal(sprite.element.style.getPropertyValue("--cm-sprite-ax"), `${-motion.bounds.left * 0.5}px`);
  // Koromon's attack: wind-up 15 ticks, then the forward cell (the tackle) -- the move leaves at 250 ms.
  assert.deepEqual({ ...motion.release.get(7) }, { index: 1, atMs: 250 });
  const height = -motion.sequences.get(7)[1].oy;
  assert.ok(motion.muzzle.y < -height * 0.5, "the muzzle sits in the upper body, never the belly or the feet");
  sprite.setFacing(1);
  assert.ok(sprite.muzzle().dx > 0, "facing right, the muzzle is ahead on the right");
  assert.equal(showcaseReleaseFrame([{ ox: -5, ticks: 6 }, { ox: -20, ticks: 9 }, { ox: -8, ticks: 4 }]).atMs, 100);
  const css = fs.readFileSync("src/championship/app/ui/juicyShowcase.css", "utf8");
  assert.match(css, /\.cm-sprite--footed \{ position: absolute; left: calc\(var\(--foot-x, 50%\) - var\(--cm-sprite-ax, 0px\)\); bottom: calc\(var\(--foot-y, 0px\) - var\(--cm-sprite-below, 0px\)\); \}/);
  assert.match(css, /\.cm-showcase-motion__sprite \{[^}]*--foot-y: calc\(40px \+ 6%\)/, "the Dex viewer's feet sit on its pad's centre");
  assert.match(css, /\.cm-showcase__body \{[^}]*--foot-y: 1%/, "the preview caster's feet sit on its pad's centre");
});

test("the motion toggle carries drawn icons, never emoji", () => {
  const source = fs.readFileSync("src/championship/presentation/juicy/codexShowcaseTheater.js", "utf8");
  assert.doesNotMatch(source, /🏃|🖼️|💥/u);
  for (const locale of Object.keys(JUICY_SHOWCASE_TEXT)) {
    assert.doesNotMatch(JUICY_SHOWCASE_TEXT[locale]["view.motion"], /\p{Extended_Pictographic}|[.,]/u);
  }
});

test("the cut-in frames the caster's measured head, the same in the Dex and in battle", () => {
  const dragon = juicyPortrait(34), round = juicyPortrait(21);
  const a = skillCutInFaceFrame(dragon), b = skillCutInFaceFrame(round);
  assert.equal(a.source, "face");
  assert.ok(a.cx > dragon.width * 0.55 && a.cy < dragon.height * 0.45, "火甲龍: the head is up and to the right, not the claws");
  assert.ok(b.cx < round.width * 0.5 && b.cy < round.height * 0.6, "紅頭丸: the face is on the left");
  assert.ok(a.size > dragon.width * 0.2, "the whole head, not one eye");
  assert.equal(skillCutInFaceFrame({ src: "x.png", width: 100, height: 200 }).source, "upper");
  const doc = fakeDocument(), host = doc.createElement("div");
  const layer = createSkillCutInLayer({ host, doc });
  layer.play({ team: "enemy", portrait: dragon, moveName: "烈鎧焰砲" });
  const face = host.querySelector(".cm-cutin__face");
  assert.equal(face.dataset.framing, "face");
  assert.equal(face.style.getPropertyValue("--cutin-cx"), String(dragon.face[0]));
  layer.dispose();
  const css = fs.readFileSync("src/championship/app/ui/juicyShowcase.css", "utf8");
  assert.match(css, /\.cm-cutin__face \{[^}]*container-type: size/);
  assert.match(css, /--cutin-k: min\(calc\(62cqw \/ var\(--cutin-head\)\), calc\(90cqh \/ var\(--cutin-head\)\)\)/, "the head square fits the clear middle");
  assert.doesNotMatch(css, /scale\(1\.7\)/, "no blind 1.7x zoom");
  for (const file of ["src/championship/app/dataArenaScreen.js", "src/championship/app/main.js"]) {
    assert.match(fs.readFileSync(file, "utf8"), /portrait: ?juicyPortrait\(/, `${file} hands the measured portrait to the same strip`);
  }
});

test("every published Dex illustration has a measured head inside the picture", () => {
  const heroes = JSON.parse(fs.readFileSync("src/data/championship/database-hero-portraits.public.v1.json", "utf8")).entries;
  const faces = JSON.parse(fs.readFileSync("src/data/championship/database-hero-faces.v1.json", "utf8"));
  const bySha = new Map(faces.entries.map(row => [row.sha256, row]));
  assert.equal(faces.entries.length, heroes.length);
  for (const hero of heroes) {
    const row = bySha.get(hero.sha256);
    assert.ok(row, `species ${hero.speciesIndex}`);
    const [cx, cy, size] = row.face;
    assert.ok(cx >= 0 && cx <= hero.width && cy >= 0 && cy <= hero.height && size > 0 && size <= Math.max(hero.width, hero.height), `species ${hero.speciesIndex}`);
    assert.deepEqual([...juicyPortrait(hero.speciesIndex).face], row.face);
  }
  assert.ok(faces.entries.some(row => row.method === "reviewed"), "reviewed corrections are recorded");
});

test("a ranged special is cast standing: an airborne cell comes down to the feet, and the muzzle with it", () => {
  const air = Object.freeze({ url: "p.webp", x: 0, y: 0, w: 20, h: 20, ox: -10, oy: -50, pageWidth: 100, pageHeight: 50, ticks: 10 });
  const motion = { ...fakeMotion(), bounds: { left: -10, top: -50, right: 10, bottom: 0 }, sequences: new Map([[0, [air]], [7, [air]]]),
    release: new Map([[7, { index: 0, atMs: 0 }]]), muzzle: { x: -8, y: -40 } };
  const doc = fakeDocument();
  const leaping = createSpriteMotion({ doc, motion, scale: 1 }), standing = createSpriteMotion({ doc, motion, scale: 1, grounded: true });
  leaping.play(7); standing.play(7);
  assert.equal(leaping.element.children[0].style.transform, "translate(0px, 0px)", "a melee leap keeps its height");
  assert.equal(standing.element.children[0].style.transform, "translate(0px, 30px)", "the cell's bottom meets the feet");
  assert.equal(standing.muzzle().dy, -10, "the muzzle moves down with the cell");
  assert.match(fs.readFileSync("src/championship/presentation/juicy/codexShowcaseTheater.js", "utf8"), /grounded: !showcaseStyleIsMelee\(payload\.look\.style\)/);
});
