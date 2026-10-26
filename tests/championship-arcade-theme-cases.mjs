// Arcade theme (Owner 2026-10-26): the arcade rebuild's UI on this game.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createChampionshipToolbar, TOOLBAR_MODES, TOOLBAR_QUICK_ENTRIES, TOOLBAR_MENUS } from "../src/championship/app/championshipToolbar.js";
import { ArcadeSound, ARCADE_CUES, pressCue, installArcadeFx, createArcadeJuice } from "../src/championship/app/ui/arcadeFx.js";
import { DEFAULT_PREFERENCES, resolveTheme } from "../src/championship/app/settings/preferenceSchema.js";

function fakeDocument() {
  const doc = {
    defaultView: { addEventListener() {}, removeEventListener() {} },
    addEventListener() {}, removeEventListener() {},
    createElement(tag) {
      return {
        tag, ownerDocument: doc, children: [], dataset: {}, attributes: {}, events: {}, hidden: false, disabled: false,
        style: { setProperty() {}, removeProperty() {} },
        append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } },
        replaceChildren(...nodes) { this.children = []; this.append(...nodes); },
        setAttribute(key, value) { this.attributes[key] = String(value); },
        getAttribute(key) { return this.attributes[key]; },
        addEventListener(type, listener) { this.events[type] = listener; },
        click() { this.events.click?.(); },
        getBoundingClientRect() { return { height: 0 }; },
        querySelector(selector) {
          const name = selector.slice(1);
          for (const child of this.children) { if (child.className === name) return child; const found = child.querySelector(selector); if (found) return found; }
          return null;
        },
        querySelectorAll(selector) {
          const key = selector === "[data-menu-id]" ? "menuId" : selector === "[data-cell-index]" ? "cellIndex" : "toolId";
          return this.children.flatMap((child) => [...(child.dataset[key] ? [child] : []), ...child.querySelectorAll(selector)]);
        },
        contains() { return false; },
        remove() {}
      };
    }
  };
  doc.body = doc.createElement("body");
  return doc;
}

function mount(t) {
  const doc = fakeDocument();
  const previous = globalThis.document;
  globalThis.document = doc;
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const entries = [];
  const toolbar = createChampionshipToolbar({ root: doc.body, onMenuEntry: (entry) => entries.push(entry.id) });
  const quick = toolbar.element.children.find((child) => child.className === "cm-toolbar__quick");
  return { toolbar, quick, entries };
}

test("the quick dock is the observed System entries themselves, appended after the rail", (t) => {
  const system = TOOLBAR_MENUS.find((menu) => menu.id === "SYSTEM");
  for (const id of TOOLBAR_QUICK_ENTRIES) assert.ok(system.entries.some((entry) => entry.id === id), id);
  assert.deepEqual([...TOOLBAR_QUICK_ENTRIES], ["hunt", "battle", "shop", "database"]);
  const { toolbar, quick, entries } = mount(t);
  assert.deepEqual(toolbar.element.children.map((child) => child.className),
    ["cm-toolbar__menu", "cm-toolbar__rail", "cm-toolbar__tool-hint", "cm-toolbar__quick"], "menu, rail and hint keep their positions");
  assert.equal(quick.hidden, true, "hidden until a mode is set");
  toolbar.setMode(TOOLBAR_MODES.TRAINING);
  assert.equal(quick.hidden, false);
  assert.deepEqual(quick.children.map((button) => button.dataset.quickId), ["hunt", "battle", "shop", "database"]);
  for (const button of quick.children) {
    assert.equal(button.className, "cm-toolbar__quick-entry");
    assert.equal(button.attributes.role, undefined, "a dock key is a plain button, not a menu item");
    button.click();
  }
  assert.deepEqual(entries, ["hunt", "battle", "shop", "database"], "each key dispatches its entry exactly like the menu");
});

test("the quick dock leaves Hunt and every tutorial step to the original rail", (t) => {
  const { toolbar, quick } = mount(t);
  toolbar.setMode(TOOLBAR_MODES.HUNT);
  assert.equal(quick.hidden, true);
  toolbar.setMode(TOOLBAR_MODES.TRAINING);
  toolbar.setTutorialTool("SYSTEM", { select: false, menuEntry: "hunt" });
  assert.equal(quick.hidden, true, "a tutorial keeps guiding through the System menu itself");
  toolbar.setTutorialTool(null);
  assert.equal(quick.hidden, false);
  toolbar.setMode(null);
  assert.equal(quick.hidden, true);
});

function fakeAudio(state = "running") {
  const made = { osc: 0, noise: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect: (next) => next ?? {}, start() {}, stop() {} });
  const context = {
    state, currentTime: 1, sampleRate: 8000,
    createOscillator() { made.osc++; return { ...node(), frequency: param() }; },
    createGain() { return { ...node(), gain: param() }; },
    createBiquadFilter() { return { ...node(), Q: param(), frequency: param() }; },
    createBufferSource() { made.noise++; return { ...node(), buffer: null }; },
    createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  };
  return { output: { context, destination: {} }, made };
}

test("the rebuild's voices play on the sfx bus and stay silent when they cannot", () => {
  for (const cue of ["hover", "click", "snap", "unsnap", "card", "toggle", "coin", "back", "denied", "hit", "crit", "sparkle", "levelup", "whoosh", "burst"]) assert.equal(typeof ARCADE_CUES[cue], "function", cue);
  const live = fakeAudio();
  const sound = new ArcadeSound(() => live.output);
  assert.equal(sound.play("click"), true);
  assert.deepEqual(live.made, { osc: 2, noise: 1 }, "square + triangle drop and a click of noise");
  assert.equal(sound.play("hover"), true);
  assert.equal(sound.play("hover"), false, "hover is throttled");
  assert.equal(new ArcadeSound(() => null).play("click"), false, "no Web Audio");
  assert.equal(new ArcadeSound(() => fakeAudio("suspended").output).play("click"), false, "no gesture yet");
  assert.equal(sound.play("nope"), false);
});

test("each press makes the rebuild's sound for what it is", () => {
  class Key {
    constructor({ cls = "", text = "", disabled = false, attrs = {} } = {}) { Object.assign(this, { cls, textContent: text, disabled, attrs, dataset: {} }); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    matches(selector) { return selector.split(",").some((part) => this.cls.split(" ").some((c) => part.trim() === `.${c}`)); }
  }
  assert.equal(pressCue(new Key({ cls: "cm-vs2-action", disabled: true })), "denied");
  assert.equal(pressCue(new Key({ cls: "cm-vs2-action", text: "返回牧場" })), "back");
  assert.equal(pressCue(new Key({ cls: "cm-vs2-shop__close" })), "back");
  assert.equal(pressCue(new Key({ cls: "cm-vs2-shop__tab" })), "toggle");
  assert.equal(pressCue(new Key({ cls: "cm-vs2-shop__row" })), "card");
  assert.equal(pressCue(new Key({ cls: "cm-vs2-action cm-vs2-action--primary", text: "購買" })), "click");
  assert.equal(pressCue(null), null);
});

test("result effects: a purchase chimes, bursts coins and floats its cost; a refusal buzzes", () => {
  const listeners = {};
  const doc = { documentElement: { dataset: {} }, addEventListener(type, fn) { listeners[type] = fn; }, removeEventListener(type) { delete listeners[type]; } };
  const played = [], effects = [];
  const sound = { play: (cue) => { played.push(cue); return true; } };
  const juice = { jelly: () => effects.push("jelly"), burst: () => effects.push("burst"), floatText: (x, y, text) => effects.push(`float ${text}`),
    shake: () => effects.push("shake"), toast: () => {}, dustRing: () => effects.push("dust"), dispose: () => effects.push("disposed") };
  const dispose = installArcadeFx({ doc, sound, juice });
  const target = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 10, height: 10 }) };
  listeners["cm-fx"]({ target, detail: { kind: "purchase", text: "-300" } });
  listeners["cm-fx"]({ target, detail: { kind: "denied" } });
  listeners["cm-fx"]({ target, detail: { kind: "snap" } });
  assert.deepEqual(played, ["coin", "denied", "snap"]);
  assert.deepEqual(effects, ["jelly", "burst", "float -300", "shake", "jelly", "dust"]);
  dispose();
  assert.deepEqual(Object.keys(listeners), []);
  assert.equal(effects.at(-1), "disposed");
});

test("particles live only while they move", () => {
  const frames = [];
  const view = { innerWidth: 100, innerHeight: 100, devicePixelRatio: 1, requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {} };
  const ctx = { setTransform() {}, clearRect() {}, fillRect() {}, set fillStyle(v) {}, set globalAlpha(v) {}, set imageSmoothingEnabled(v) {} };
  const element = () => ({ className: "", style: {}, setAttribute() {}, append() {}, remove() {}, getContext: () => ctx });
  const doc = { documentElement: { dataset: {} }, body: { append() {} }, createElement: element };
  const juice = createArcadeJuice({ doc, view });
  assert.equal(frames.length, 0, "no loop before anything moves");
  juice.burst(50, 50, { count: 4, life: [0.01, 0.01] });
  assert.equal(juice.particleCount(), 4);
  assert.equal(frames.length, 1);
  frames[0](16); frames[1]?.(40);
  assert.equal(juice.particleCount(), 0, "they expire");
  const scheduled = frames.length;
  frames.at(-1)(80);
  assert.equal(frames.length, scheduled, "the loop stops once none are alive");
  juice.dispose();
});

test("arcade is the default theme, applied before the first paint", () => {
  assert.equal(DEFAULT_PREFERENCES.theme, "arcade");
  assert.equal(resolveTheme("arcade"), "arcade");
  const html = fs.readFileSync("championship.html", "utf8");
  assert.match(html, /pick\(p\.theme, \["arcade", "arena", "night", "clear", "warm", "classic", "system"\], "arcade"\)/);
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map((m) => m[1]);
  assert.equal(sheets.at(-1), "./src/championship/app/ui/arcade.css", "the arcade sheet loads last");
});

test("the arcade sheet keeps the iron rules and never un-hides a hidden element", () => {
  const css = fs.readFileSync("src/championship/app/ui/arcade.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /transition:\s*all/);
  assert.doesNotMatch(css, /ease-in-out/);
  assert.doesNotMatch(css, /blur\(/, "no blur: dots and hard slabs only");
  for (const match of css.matchAll(/backdrop-filter:\s*([^;!]+)/g)) assert.equal(match[1].trim(), "none");
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\[data-motion="reduced"\]/);
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [selector, body] = [rule[1].trim(), rule[2]];
    if (!/\bdisplay:\s*(?!none)/.test(body)) continue;
    if (/\.cm-toolbar(?![-\w])|cm-toolbar__quick(?![-\w])|cm-vs2-kicker|cm-hexworld__counter/.test(selector)) {
      assert.match(selector, /:not\(\[hidden\]\)/, `${selector} must not override [hidden]`);
    }
  }
  for (const phone of ["@media (max-width: 600px)", "@media (max-height: 500px) and (orientation: landscape)"]) assert.ok(css.includes(phone), phone);
});

test("the title parade walks real partners with their in-game walk, only where their art is approved", async () => {
  const { pickParadeSpecies, loadParadeWalker, TITLE_PARADE_WALK_SEQUENCE } = await import("../src/championship/app/titleParade.js");
  assert.equal(TITLE_PARADE_WALK_SEQUENCE, 2, "the Battle / Data Arena walk request");
  const configs = [{ speciesId: "s1", entityId: "e000_digitama" }, { speciesId: "s2", entityId: "m001_a" }, { speciesId: "s3", entityId: "m002_b" }, { speciesId: "s4", entityId: "m003_c" }];
  const picked = pickParadeSpecies(configs, 3, () => 0);
  assert.deepEqual(picked, ["s2", "s3", "s4"], "eggs have no walk and never parade");
  assert.equal(new Set(pickParadeSpecies(configs, 10, Math.random)).size, 3, "no partner twice");
  let fetched = 0;
  const art = await loadParadeWalker("species-072", { href: "https://example.invalid/championship.html", fetchImpl: () => { fetched++; } });
  assert.equal(art, null, "outside the original-runtime location the parade has no art");
  assert.equal(fetched, 0, "and fetches nothing");
});

test("the title parade starts with an enterable title and stops when it closes", async () => {
  const { installTitleParade } = await import("../src/championship/app/titleParade.js");
  const made = [];
  const node = (tag) => ({ tag, children: [], hidden: false, disabled: false, dataset: {}, style: {}, className: "", append(...n) { this.children.push(...n); }, remove() { this.removed = true; }, setAttribute() {}, addEventListener() {}, querySelector: () => null, getContext: () => null });
  const title = node("div"), login = node("button");
  login.disabled = true;
  let observed = null;
  const doc = { documentElement: { dataset: {} }, getElementById: (id) => (id === "cm-title" ? title : id === "cm-login" ? login : null), createElement: (tag) => { const n = node(tag); made.push(n); return n; } };
  const view = { requestAnimationFrame: () => 1, cancelAnimationFrame() {}, location: { href: "https://example.invalid/" }, innerWidth: 400,
    MutationObserver: class { constructor(fn) { observed = fn; } observe() {} disconnect() {} } };
  const dispose = installTitleParade({ doc, view, fetchImpl: async () => ({ ok: false }) });
  assert.equal(made.length, 0, "nothing until the title can be entered");
  login.disabled = false; observed();
  const host = made.find((n) => n.className === "cm-title__parade");
  assert.ok(host, "the parade lane appears with an enterable title");
  title.hidden = true; observed();
  assert.equal(host.removed, true, "leaving the title removes the parade");
  view.navigator = { connection: { saveData: true } };
  title.hidden = false; observed();
  assert.equal(made.filter((n) => n.className === "cm-title__parade").length, 1, "data saving keeps the title still");
  dispose();
});
