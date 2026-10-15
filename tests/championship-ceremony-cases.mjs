// Ceremony layer (2026-10-15): the runner, its settings and its contracts.
// The runner only decorates decided moments: these cases check that skipping,
// reduced motion, saver quality, hidden tabs and disposal always land on the
// final composition and leave nothing behind, and that the stylesheet and the
// integrations keep to the rules the spec states.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { playCeremony, playReveal, ceremonyEnvironment, CEREMONY_TIMING, configureCeremonyAudio } from "../src/championship/presentation/ceremony/ceremonyRunner.js";
import { CEREMONY_CUES, playCeremonyCue } from "../src/championship/presentation/ceremony/ceremonyAudio.js";
import { buildGateEntry, buildCapture, buildMedal, buildEvolve, buildVersus } from "../src/championship/presentation/ceremony/ceremonyScenes.js";

// ---- A small DOM: enough for the runner and the builders -----------------
class Node {
  constructor(doc, tag) {
    this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
    this.dataset = {}; this.attributes = {}; this.className = ""; this.textContent = ""; this.listeners = {};
    const props = {}; this.style = { setProperty: (k, v) => { props[k] = v; }, getPropertyValue: (k) => props[k] ?? "", props };
  }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
  replaceWith(node) { const list = this.parentElement.children; list[list.indexOf(this)] = node; node.parentElement = this.parentElement; }
  remove() { if (!this.parentElement) return; const list = this.parentElement.children; list.splice(list.indexOf(this), 1); this.parentElement = null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn); }
  dispatch(type, event = {}) { const e = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...event }; for (const fn of [...(this.listeners[type] ?? [])]) fn(e); return e; }
  querySelector(selector) { const cls = selector.replace(/^\./, ""); const walk = (n) => { for (const c of n.children) { if (c.className.split(" ").includes(cls)) return c; const f = walk(c); if (f) return f; } return null; }; return walk(this); }
  all() { return [this, ...this.children.flatMap((c) => c.all())]; }
}
function fakeDocument({ motion = "full", quality = "balanced" } = {}) {
  const doc = { hidden: false, listeners: {} };
  doc.documentElement = { dataset: { motion, quality } };
  doc.createElement = (tag) => new Node(doc, tag);
  doc.addEventListener = (type, fn) => { (doc.listeners[type] ??= []).push(fn); };
  doc.removeEventListener = (type, fn) => { doc.listeners[type] = (doc.listeners[type] ?? []).filter((f) => f !== fn); };
  doc.dispatch = (type, event = {}) => { for (const fn of [...(doc.listeners[type] ?? [])]) fn({ stopPropagation() {}, ...event }); };
  return doc;
}
function fakeTimers() {
  let now = 0, next = 1; const timers = new Map();
  return {
    setTimer: (fn, ms) => { const id = next++; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimer: (id) => timers.delete(id),
    run(ms) { const end = now + ms; for (;;) { const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; now = due[1].at; timers.delete(due[0]); due[1].fn(); } now = end; },
    get pending() { return timers.size; }
  };
}
const kinds = Object.keys(CEREMONY_TIMING);

test("every ceremony runs to its end, removes its node and releases its listeners", async () => {
  for (const kind of kinds) {
    const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
    let done = 0;
    const run = playCeremony({ host, kind, doc, ...timers, build: (stage) => stage.append(doc.createElement("i")), onDone: () => { done += 1; } });
    assert.equal(host.children.length, 1, `${kind}: mounted`);
    assert.equal(run.element.dataset.state, "playing");
    if (CEREMONY_TIMING[kind].tier === "toast") assert.equal(run.element.getAttribute("aria-hidden"), "true", `${kind}: a toast is decoration`);
    timers.run(10000);
    assert.equal(host.children.length, 0, `${kind}: gone after its length`);
    assert.equal(done, 1, `${kind}: onDone once`);
    assert.equal(timers.pending, 0, `${kind}: no timer left`);
    assert.equal((doc.listeners.visibilitychange ?? []).length, 0, `${kind}: no listener left`);
    assert.equal((doc.listeners.keydown ?? []).length, 0, `${kind}: no key listener left`);
    const summary = await run.done;
    assert.equal(summary.kind, kind);
  }
});

test("a tap settles a moment first and dismisses it second; a toast takes no input", () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const medal = playCeremony({ host, kind: "medal", doc, ...timers, build() {} });
  const tap = medal.element.dispatch("pointerdown");
  assert.equal(tap.defaultPrevented, true, "the settling tap does not reach the screen below");
  assert.equal(medal.element.dataset.state, "settled");
  medal.element.dispatch("pointerdown");
  assert.equal(medal.element.dataset.state, "leaving");
  timers.run(1000);
  assert.equal(host.children.length, 0);
  const toast = playCeremony({ host, kind: "capture", doc, ...timers, build() {} });
  assert.equal((toast.element.listeners.pointerdown ?? []).length, 0, "a toast never captures the live field's input");
  toast.dispose();
});

test("Escape settles then dismisses a moment without stealing other keys", () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const run = playCeremony({ host, kind: "evolve", doc, ...timers, build() {} });
  doc.dispatch("keydown", { key: "Enter" });
  assert.equal(run.element.dataset.state, "playing");
  doc.dispatch("keydown", { key: "Escape" });
  assert.equal(run.element.dataset.state, "settled");
  doc.dispatch("keydown", { key: "Escape" });
  assert.equal(run.element.dataset.state, "leaving");
  timers.run(1000);
  assert.equal((doc.listeners.keydown ?? []).length, 0);
});

test("a held ceremony waits for the caller, and a hidden tab settles it", () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const run = playCeremony({ host, kind: "gate-entry", autoDismiss: false, doc, ...timers, build() {} });
  timers.run(60000);
  assert.equal(run.element.dataset.state, "settled", "held: settled, still shown");
  assert.equal(host.children.length, 1);
  run.dismiss();
  timers.run(1000);
  assert.equal(host.children.length, 0);
  const second = playCeremony({ host, kind: "medal", doc, ...timers, build() {} });
  doc.hidden = true; doc.dispatch("visibilitychange");
  assert.notEqual(second.element.dataset.state, "playing", "a background tab never keeps a run going");
  timers.run(1000);
  assert.equal(host.children.length, 0);
});

test("reduced motion and saver quality are read once at start and set the run's motion", () => {
  assert.equal(ceremonyEnvironment(fakeDocument({ motion: "reduced" })).motion, "reduced");
  assert.equal(ceremonyEnvironment(fakeDocument({ quality: "saver" })).motion, "saver");
  assert.equal(ceremonyEnvironment(fakeDocument()).motion, "full");
  const doc = fakeDocument({ motion: "reduced" }), timers = fakeTimers(), host = doc.createElement("div");
  const run = playCeremony({ host, kind: "medal", doc, ...timers, build() {} });
  assert.equal(run.element.dataset.motion, "reduced");
  assert.ok(Number.parseInt(run.element.style.props["--cer-length"], 10) <= 1000, "reduced runs are short fades");
  run.dispose();
  for (const kind of kinds) assert.ok(CEREMONY_TIMING[kind].saver < CEREMONY_TIMING[kind].full, `${kind}: saver is shorter`);
});

test("a builder that throws shows nothing and still completes", async () => {
  const doc = fakeDocument(), timers = fakeTimers(), host = doc.createElement("div");
  const warn = console.warn; console.warn = () => {};
  try {
    let done = 0;
    const run = playCeremony({ host, kind: "capture", doc, ...timers, build() { throw new Error("art missing"); }, onDone: () => { done += 1; } });
    assert.equal(host.children.length, 0);
    assert.equal(done, 1);
    assert.equal((await run.done).skipped, true);
  } finally { console.warn = warn; }
});

test("a reveal settles on its timer or at the first tap, and swallows that tap's click", () => {
  const doc = fakeDocument(), timers = fakeTimers(), root = doc.createElement("section");
  const reveal = playReveal({ root, kind: "hunt-reward", doc, ...timers });
  assert.equal(root.dataset.reveal, "playing");
  root.dispatch("pointerdown");
  assert.equal(root.dataset.reveal, "settled");
  const click = root.dispatch("click");
  assert.equal(click.defaultPrevented, true, "the button under the settling tap is not pressed");
  reveal.dispose();
  const again = doc.createElement("section");
  playReveal({ root: again, kind: "hunt-reward", doc, ...timers });
  timers.run(5000);
  assert.equal(again.dataset.reveal, "settled");
  const reducedRoot = doc.createElement("section");
  playReveal({ root: reducedRoot, kind: "hunt-reward", doc: fakeDocument({ motion: "reduced" }), ...timers });
  assert.equal(reducedRoot.dataset.reveal, "settled", "reduced motion shows the final screen at once");
  assert.equal(timers.pending, 0);
});

test("builders lay out words and existing art only", () => {
  const doc = fakeDocument({ quality: "saver" });
  const env = ceremonyEnvironment(doc);
  const stage = doc.createElement("div");
  buildGateEntry(stage, env, { kicker: "K", gateName: "G", meta: "M", hint: "H" });
  buildCapture(stage, env, { kicker: "K", name: "N", chip: "C" });
  buildMedal(stage, env, { kicker: "K", title: "T", meta: "M", medal: null });
  buildEvolve(stage, env, { kicker: "K", title: "T", meta: "M", portrait: { src: "assets/production/x.png", width: 32, height: 32, nativeScale: 1 } });
  buildVersus(stage, env, { playerLabel: "A", playerNames: ["a1", "a2", "a3", "a4"], opponentLabel: "B", opponentNames: ["b1"] });
  const nodes = stage.all();
  assert.equal(nodes.filter((n) => n.className === "cm-ceremony__spark").length, 0, "saver draws no particles");
  assert.ok(nodes.some((n) => n.className === "cm-cer-medal__fallback"), "a missing medal shows the neutral disc, not a broken image");
  const evolveArt = nodes.find((n) => n.className === "cm-cer-evolve__art");
  assert.equal(evolveArt.style.width, "64px", "whole-number scale keeps the pixel grid");
  assert.equal(nodes.filter((n) => n.className === "cm-cer-versus__name").length, 4, "at most three names a side");
});

test("cues are synthesized: no file, no fetch, silent without a running context", () => {
  const source = fs.readFileSync("src/championship/presentation/ceremony/ceremonyAudio.js", "utf8");
  assert.doesNotMatch(source, /fetch\(|decodeAudioData|new Audio\(|\.mp3|\.ogg|\.wav/);
  for (const [name, voices] of Object.entries(CEREMONY_CUES)) {
    assert.ok(voices.length > 0 && voices.length <= 8, `${name}: a small graph`);
    for (const [, , , , duration, peak] of voices) assert.ok(duration <= 1.5 && peak <= 0.4, `${name}: short and gentle`);
  }
  assert.equal(playCeremonyCue("medal", null), null);
  assert.equal(playCeremonyCue("medal", { context: { state: "suspended", resume: () => Promise.resolve() }, destination: {} }), null);
  configureCeremonyAudio(null);
});

test("the stylesheet keeps the ceremony rules: final-state statics, compositor-only motion, nothing forever", () => {
  const css = fs.readFileSync("src/championship/app/ui/ceremony.css", "utf8");
  assert.doesNotMatch(css, /infinite/, "no endless animation");
  assert.doesNotMatch(css, /!important/);
  for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\}\s*(?=@keyframes|\n\n|\/\*)/g)) {
    const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    for (const property of properties) assert.ok(["opacity", "transform"].includes(property), `keyframes animate only opacity/transform, found ${property}`);
  }
  assert.match(css, /\.cm-ceremony:is\(\[data-state="settled"\], \[data-state="leaving"\]\) \.cm-ceremony__stage \* \{ animation: none; \}/, "settling lands the final composition");
  assert.match(css, /\.cm-ceremony\[data-motion="reduced"\] \.cm-ceremony__stage \* \{ animation: none; \}/);
  // The stop rules are (0,3,0); no per-part animation rule may be as specific
  // unless it is an intended exit (data-state="leaving").
  const specificity = (selector) => (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!is\b|where\b)[\w-]+/g) ?? []).length;
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/animation:\s*cm-cer-(?!fade|leave)/.test(body)) continue;
    for (const selector of selectors.split(",")) {
      if (selector.includes("data-reveal") || selector.includes('data-state="leaving"') || selector.includes("@")) continue;
      assert.ok(specificity(selector.replace(/\s+/g, " ")) < 3, `a part rule outranks the stop rules: ${selector.trim()}`);
    }
  }
  assert.match(css, /\.cm-ceremony\[data-motion="saver"\][^{]*\.cm-ceremony__spark/);
  assert.match(css, /\.cm-ceremony \{\n  position: absolute;[\s\S]*?pointer-events: none;/, "a toast never blocks the scene");
  const html = fs.readFileSync("championship.html", "utf8");
  assert.match(html, /ui\/ceremony\.css/);
});

test("integrations decorate settled state and clean up with their screens", () => {
  const vs2 = fs.readFileSync("src/championship/app/vs2Screens.js", "utf8");
  assert.match(vs2, /kind: 'gate-entry'/);
  assert.match(vs2, /closeEntry\(\);\s*\n\s*captureToast\?\.dispose\(\);/, "the field disposes both ceremonies");
  assert.match(vs2, /frame\.tutorial \? null : playCeremony/, "the scripted tutorial keeps its own entry");
  const source = fs.readFileSync("src/championship/app/gateHuntPresentationSource.js", "utf8");
  assert.match(source, /onCard: \(runtime\.getOnCardEntries\?\.\(\) \?\? \[\]\)\.map/, "the card is a read-only projection");
  const vs5 = fs.readFileSync("src/championship/app/vs5Screens.js", "utf8");
  assert.doesNotMatch(vs5, /^import .*ceremony/m, "the Battle screens keep importing display copy only; main.js hands the ceremonies in");
  const main = fs.readFileSync("src/championship/app/main.js", "utf8");
  assert.match(main, /ceremonies: battleCeremonies,/);
  assert.match(vs5, /if \(panels\[index\]\.id === 'TITLE'\) presentMedal\(\);/, "the medal belongs to the original title page");
  assert.match(vs5, /medalCeremony\?\.dispose\(\)/);
  assert.match(vs5, /versus\?\.dispose\(\);/);
  const raising = fs.readFileSync("src/championship/app/raisingHomeP1RView.js", "utf8");
  assert.match(raising, /pendingEvolution&&!lifecycle\?\.evolution&&!day/, "the reveal waits for the native evolution sequence");
  assert.match(raising, /evolutionCeremony\?\.dispose\(\);\n\s*evolutionCeremony = null;/);
  for (const file of ["src/championship/presentation/ceremony/ceremonyRunner.js", "src/championship/presentation/ceremony/ceremonyScenes.js"]) {
    const code = fs.readFileSync(file, "utf8").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /requestAnimationFrame|Ticker|localStorage|\.save\(/, `${file}: no loop, no state`);
  }
});

// ---- The evolution reveal waits for the native sequence -------------------
// Same isolated harness shape as championship-raising-floating-card-cases:
// the real Raising Home view with its imports supplied, a fake source, and the
// ceremony entry points recorded instead of drawn.
import vm from "node:vm";
import { getLocale } from "../src/championship/text/locale.js";
import { getProductExtension } from "../src/championship/contracts/productSpeciesExtensions.js";
import { speciesName } from "../src/championship/text/zhHant.js";
import { productFormText } from "../src/championship/text/productFormText.js";

class Element extends EventTarget {
  constructor(tag, doc) { super(); this.tagName = tag; this.ownerDocument = doc; this.children = []; this.dataset = {}; this.attributes = {}; this.hidden = false; this.className = ""; this.style = { setProperty() {}, removeProperty() {} }; this.clientWidth = 390; this.clientHeight = 700; this.offsetHeight = 112; this.classList = { toggle() {}, add() {}, remove() {} }; }
  append(...nodes) { for (const n of nodes) { n.parentNode = this; this.children.push(n); } }
  appendChild(n) { this.append(n); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  focus() { this.ownerDocument.activeElement = this; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((n) => n !== this); }
  getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; }
}

test("the evolution reveal plays once, after the native sequence ends and nothing else owns the screen", async () => {
  const document = { createElement: (tag) => new Element(tag, document) };
  const ceremonies = [];
  const context = vm.createContext({ document, Date, console, setTimeout, clearTimeout, productFormText, getLocale, getProductExtension,
    setText: (node, text) => { node.textContent = text; }, setLabel: (node, key, text) => node.setAttribute(key, text), uiText: (s, p = {}) => Object.entries(p).reduce((t, [k, v]) => t.replace(`{${k}}`, v), String(s)), retranslate: () => {},
    isNativeRanchLayout: () => true, assembledHudArt: () => null, prefersReducedMotion: () => false, speciesName, raisingMessageText: () => "", raisingMessageSender: () => "", downloadSaveBackup: () => ({ key: "ok" }),
    playCeremony: (options) => { const run = { options, disposed: false, dispose() { this.disposed = true; } }; ceremonies.push(run); return run; },
    buildEvolve: () => {} });
  vm.runInContext(fs.readFileSync("src/championship/app/raisingHomeP1RView.js", "utf8").replace(/^import .*;$/gm, "").replace(/export async function /, "async function ") + "\nthis.mount=createRaisingHomeP1RView;", context);
  const root = new Element("div", document);
  let frame = { revision: 1, residents: [{ creatureId: "a", displayName: "Partner A", speciesId: "species-020", stats: { currentHp: 8, maxHp: 10, maxTp: 4 }, displayCapacityG: 3 }], selection: { creatureId: null }, ranch: { layoutVersion: 1 }, save: { phase: "CLEAN" } };
  let listener;
  const source = { getFrame: () => frame, subscribe: (fn) => { listener = fn; return () => { listener = null; }; }, intents: { selectCreature() {}, relocateCreature() {}, careForCreature() {}, requestSave() {} } };
  const view = await context.mount({ root, source, hudArt: { getPortrait: (id) => ({ src: `assets/production/${id}.png`, width: 32, height: 32, nativeScale: 1 }) },
    mountField: async () => ({ render() {}, dispose() {}, focusResident() {} }) });
  const render = (changes) => { frame = { ...frame, ...changes, revision: frame.revision + 1 }; listener(frame); };
  const message = { kind: "EVOLVED", instanceId: "a", target: 20 };
  render({ lifecycle: { evolution: { instanceId: "a", phase: "flash" }, message } });
  assert.equal(ceremonies.length, 0, "never over the native evolution sequence");
  render({ lifecycle: { evolution: { instanceId: "a", phase: "writing" }, message } });
  assert.equal(ceremonies.length, 0);
  render({ lifecycle: { evolution: null, message, day: { phase: "fade-out", frames: 1 } } });
  assert.equal(ceremonies.length, 0, "a day change keeps the screen first");
  render({ lifecycle: { evolution: null, message } });
  assert.equal(ceremonies.length, 1, "revealed once the screen is free");
  assert.equal(ceremonies[0].options.kind, "evolve");
  assert.match(ceremonies[0].options.label, /Partner A/);
  render({ lifecycle: { evolution: null, message } });
  assert.equal(ceremonies.length, 1, "the same message never replays");
  view.dispose();
  assert.equal(ceremonies[0].disposed, true, "leaving Home releases the reveal");
});
