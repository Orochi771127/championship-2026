// Story theater (Owner 2026-10-28): the rift chapters, the hybrid director and
// its two layers run against fakes. No DOM, storage or network is touched by
// the data or the director; the overlay and the puppeteer are exercised on a
// minimal document double.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import {
  STORY_RIFT_CHAPTERS, STORY_RIFT_CHAPTER_IDS, STORY_RIFT_COPY, STORY_RIFT_LOCALES, STORY_RIFT_SPEAKERS,
  storyRiftChapter, storyRiftChapterTitle, storyRiftSpeakerName, storyRiftText, validateStoryRiftChapter
} from "../src/championship/data/storyRiftChapters.js";
import { createHybridStoryDirector, storySleep, STORY_EMOTE_HOLD_MS } from "../src/championship/presentation/story/HybridStoryDirector.js";
import { createPortraitVnOverlay, VN_TYPEWRITER_MS } from "../src/championship/presentation/story/portraitVnOverlay.js";
import { createStoryStagePuppeteer, STORY_EMOTE_GLYPHS } from "../src/championship/presentation/story/storyStagePuppeteer.js";
import { mountRanchStoryBadge, STORY_CHAPTER_OPEN_EVENT, STORY_FIRST_CHAPTER_ID } from "../src/championship/app/ranchStoryBadge.js";
import { PREFERENCE_DEFINITIONS } from "../src/championship/app/settings/preferenceSchema.js";
import { TOOLBAR_MENU_GROUPS, TOOLBAR_PRODUCT_ENTRIES } from "../src/championship/app/championshipToolbar.js";

// ---- data ------------------------------------------------------------------
test("every chapter validates, ends, and every key exists in all five locales", () => {
  assert.deepEqual(STORY_RIFT_CHAPTER_IDS, ["prologue", "first-resonance", "chapter1-first-rift"]);
  for (const id of STORY_RIFT_CHAPTER_IDS) {
    const chapter = storyRiftChapter(id);
    assert.deepEqual(validateStoryRiftChapter(chapter), [], id);
    assert.equal(chapter.beats.at(-1).type, "end");
    for (const locale of STORY_RIFT_LOCALES) assert.ok(storyRiftChapterTitle(id, locale), `${id} title ${locale}`);
  }
  const keys = Object.keys(STORY_RIFT_COPY["zh-Hant"]);
  for (const locale of STORY_RIFT_LOCALES) assert.deepEqual(Object.keys(STORY_RIFT_COPY[locale]).sort(), [...keys].sort(), locale);
  assert.ok(Object.isFrozen(STORY_RIFT_CHAPTERS) && Object.isFrozen(STORY_RIFT_COPY["ja"]));
  assert.deepEqual(validateStoryRiftChapter({ beats: [{ type: "line", speaker: "nobody", motion: "nod", key: "X" }] }).slice(0, 2), ["BEAT_0_LINE", "KEY_X_zh-Hant"]);
  assert.deepEqual(validateStoryRiftChapter(null), ["NO_BEATS"]);
});

test("the script carries the required opening phrases, the comment echoes and the tutorial feed cue", () => {
  const zh = STORY_RIFT_COPY["zh-Hant"];
  assert.match(zh.PRO_T3_NOISE, /每四年舉辦一次的拍檔錦標賽/);
  assert.match(zh.PRO_T4_INVITE, /取得參賽資格/);
  assert.equal(zh.C1_ECHO_1, "只要贏過別人就好了吧…");
  assert.equal(zh.C1_ECHO_2, "為什麼沒有人看見我…");
  assert.match(zh.FR_NAVI_FEED, /【餵食】/);
  assert.match(zh.FR_NAVI_WELCOME, /飼育籠/);
  for (const text of Object.values(zh)) assert.ok(text.length <= 60, text);
  // The partner's and the tamer's names are filled, never translated.
  assert.equal(storyRiftText("FR_PARTNER_HELLO", "en", { tamer: "Kai" }), "Kai! Kai! You came!");
  assert.equal(storyRiftSpeakerName("partner", "vi", { partner: "Mochi" }), "Mochi");
  assert.equal(storyRiftText("NOPE"), null);
  assert.equal(STORY_RIFT_SPEAKERS.navi.nameKey, "SPEAKER_NAVI");
  // Chapter 1 has one branch whose two paths rejoin.
  const c1 = storyRiftChapter("chapter1-first-rift");
  const choice = c1.beats.find(beat => beat.type === "choice");
  assert.equal(choice.options.length, 2);
  assert.ok(c1.beats.some(beat => beat.type === "jump" && beat.next === "rejoin"));
  assert.ok(c1.beats.some(beat => beat.type === "rift" && beat.state === "open") && c1.beats.some(beat => beat.type === "emote" && beat.glyph === "!"));
});

test("the data module is pure: no imports, no URLs, nothing but frozen data and lookups", () => {
  const text = fs.readFileSync("src/championship/data/storyRiftChapters.js", "utf8");
  assert.doesNotMatch(text, /^\s*import\s/m);
  assert.doesNotMatch(text, /https?:|localStorage|fetch\(|Math\.random/);
});

// ---- director --------------------------------------------------------------
function fakeTimers() {
  let now = 0; const queue = [];
  return {
    setTimer(fn, ms) { const entry = { at: now + ms, fn, id: queue.length + 1 }; queue.push(entry); return entry.id; },
    clearTimer(id) { const index = queue.findIndex(entry => entry.id === id); if (index >= 0) queue.splice(index, 1); },
    async tick(ms) { const until = now + ms; while (true) { queue.sort((a, b) => a.at - b.at); const next = queue[0]; if (!next || next.at > until) break; now = next.at; queue.shift(); next.fn(); await Promise.resolve(); await Promise.resolve(); } now = until; await Promise.resolve(); },
    get pending() { return queue.length; }
  };
}
function fakeOverlay({ pick = 0 } = {}) {
  const calls = []; let resolveSay = null, opened = null;
  return {
    calls,
    get opened() { return opened; },
    open(options) { opened = options; calls.push(["open", options.title]); },
    close() { calls.push(["close"]); },
    setAuto() {},
    say({ speaker, text, motion, portrait, signal }) {
      calls.push(["say", speaker, text, motion, portrait?.kind ?? null]);
      return new Promise(resolve => { resolveSay = resolve; signal?.addEventListener?.("abort", () => resolve(), { once: true }); });
    },
    choose({ prompt, options }) { calls.push(["choose", prompt, options.length]); return Promise.resolve(pick); },
    advance() { resolveSay?.(); resolveSay = null; }
  };
}
function fakeStage() {
  const calls = [];
  return { calls, begin() { calls.push(["begin"]); }, end() { calls.push(["end"]); }, camera(t, o) { calls.push(["camera", t, o.zoom]); }, spotlight(on, t) { calls.push(["spotlight", on, t]); },
    rift(s, a) { calls.push(["rift", s, a]); }, echoes(texts) { calls.push(["echoes", texts.length]); }, actor(a, o) { calls.push(["actor", a, o.toward]); }, emote(g) { calls.push(["emote", g]); }, speaking(s) { calls.push(["speaking", s]); } };
}
const fakeDoc = { hidden: false, addEventListener() {}, removeEventListener() {} };

test("chapter 1 plays every beat in order, takes the reach branch and rejoins", async () => {
  const timers = fakeTimers(), overlay = fakeOverlay({ pick: 0 }), stage = fakeStage();
  const director = createHybridStoryDirector({ stage, overlay, doc: fakeDoc, locale: "zh-Hant", reducedMotion: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const run = director.play("chapter1-first-rift", { tamer: "小光", partner: "星絮", partnerPortrait: { src: "x.webp" } });
  assert.equal(director.isPlaying, true);
  for (let i = 0; i < 40 && director.isPlaying; i++) { await timers.tick(1000); overlay.advance(); await timers.tick(0); }
  const result = await run;
  assert.equal(result.outcome, "completed");
  assert.deepEqual(result.choices, [{ key: "C1_CHOICE_PROMPT", picked: "C1_OPT_REACH" }]);
  const said = overlay.calls.filter(c => c[0] === "say").map(c => c[2]);
  assert.ok(said.includes(storyRiftText("C1_REACH_NAVI", "zh-Hant", { tamer: "小光" })) && !said.some(t => t === storyRiftText("C1_GUARD_NAVI", "zh-Hant")));
  assert.equal(result.lines, 11);
  assert.deepEqual(stage.calls[0], ["begin"]); assert.deepEqual(stage.calls.at(-1), ["end"]);
  assert.ok(stage.calls.some(c => c[0] === "rift" && c[1] === "open") && stage.calls.some(c => c[0] === "emote" && c[1] === "!") && stage.calls.some(c => c[0] === "actor" && c[1] === "attack"));
  assert.equal(overlay.calls.find(c => c[0] === "say" && c[1] === "partner")[4], "image");
  assert.equal(overlay.calls.find(c => c[0] === "say" && c[1] === "echo")[4], "silhouette");
  assert.equal(overlay.opened.title, "第一章：初遇裂縫");
  assert.deepEqual(overlay.calls.at(-1), ["close"]);
  assert.equal(timers.pending, 0);
  assert.equal(director.isPlaying, false);
});

test("the guard branch is taken from the second option; skip ends the run cleanly; a second play is refused while one runs", async () => {
  const timers = fakeTimers(), overlay = fakeOverlay({ pick: 1 }), stage = fakeStage();
  const director = createHybridStoryDirector({ stage, overlay, doc: fakeDoc, reducedMotion: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const run = director.play("chapter1-first-rift", {});
  assert.deepEqual(await director.play("prologue"), { outcome: "refused", reason: "ALREADY_PLAYING", chapterId: "prologue" });
  for (let i = 0; i < 6; i++) { await timers.tick(1000); overlay.advance(); await timers.tick(0); }
  assert.equal(director.isPlaying, true);
  overlay.opened.onSkip();
  const result = await run;
  assert.equal(result.outcome, "skipped");
  assert.ok(overlay.calls.some(c => c[0] === "choose"));
  assert.ok(overlay.calls.some(c => c[0] === "say" && c[2] === storyRiftText("C1_GUARD_PARTNER", "zh-Hant", { partner: "" })));
  assert.deepEqual(stage.calls.at(-1), ["end"]);
  assert.equal(timers.pending, 0);
  // Refusals: unknown chapter, disposed director.
  assert.equal((await director.play("nope")).outcome, "refused");
  director.dispose();
  assert.equal((await director.play("prologue")).reason, "DISPOSED");
});

test("the emote beat holds 300 ms before the line, and sleep pauses while the page is hidden", async () => {
  const timers = fakeTimers(), overlay = fakeOverlay(), stage = fakeStage();
  const director = createHybridStoryDirector({ stage, overlay, doc: fakeDoc, reducedMotion: true, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const run = director.play("first-resonance", { tamer: "T", partner: "P" });
  await timers.tick(0);
  assert.ok(stage.calls.some(c => c[0] === "emote" && c[1] === "🎵"));
  assert.equal(overlay.calls.filter(c => c[0] === "say").length, 0, "no line before the emote hold");
  await timers.tick(STORY_EMOTE_HOLD_MS - 1);
  assert.equal(overlay.calls.filter(c => c[0] === "say").length, 0);
  await timers.tick(1); await timers.tick(200);
  assert.ok(stage.calls.some(c => c[0] === "actor" && c[1] === "hop"));
  for (let i = 0; i < 8; i++) { overlay.advance(); await timers.tick(50); }
  assert.equal((await run).outcome, "completed");
  assert.equal(STORY_EMOTE_HOLD_MS, 300);

  // Hidden page: the timer is not armed until visible.
  const listeners = new Set();
  const doc = { hidden: true, addEventListener(_, fn) { listeners.add(fn); }, removeEventListener(_, fn) { listeners.delete(fn); } };
  let done = false;
  const sleep = storySleep(100, { doc, setTimer: timers.setTimer, clearTimer: timers.clearTimer }).then(() => { done = true; });
  await timers.tick(500); assert.equal(done, false);
  doc.hidden = false; for (const fn of listeners) fn();
  await timers.tick(100); await sleep; assert.equal(done, true);
});

// ---- overlay and puppeteer on a document double ----------------------------
function docDouble() {
  const make = tag => {
    const node = { tag, children: [], dataset: {}, style: { props: new Map(), setProperty(k, v) { this.props.set(k, v); } }, attributes: new Map(), listeners: new Map(), hidden: false, textContent: "", className: "",
      classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
      append(...kids) { for (const kid of kids) { if (kid.parent) kid.parent.children.splice(kid.parent.children.indexOf(kid), 1); kid.parent = node; node.children.push(kid); } },
      replaceChildren(...kids) { node.children.length = 0; node.append(...kids); }, remove() { if (node.parent) { node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; } },
      setAttribute(k, v) { node.attributes.set(k, String(v)); }, getAttribute(k) { return node.attributes.get(k) ?? null; }, focus() {}, addEventListener(type, fn) { node.listeners.set(type, fn); }, removeEventListener() {},
      querySelector() { return null; }, getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0 }; }, get offsetWidth() { return 10; }, get firstElementChild() { return node.children[0] ?? null; },
      set innerHTML(html) { node.children.length = 0; const kid = make("svg"); kid.html = html; node.append(kid); }, get innerHTML() { return ""; }, clientWidth: 390, clientHeight: 520,
      dispatchEvent(event) { node.dispatched = event; return true; }
    };
    return node;
  };
  const body = make("body");
  const doc = { body, hidden: false, createElement: make, addEventListener() {}, removeEventListener() {}, activeElement: null, defaultView: null, dispatchEvent(event) { doc.dispatched = event; return true; } };
  return doc;
}
globalThis.CustomEvent ??= class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

test("the overlay types a line, settles on tap, advances on the next tap, and lays portraits by speaker", async () => {
  const timers = fakeTimers(), doc = docDouble();
  const overlay = createPortraitVnOverlay({ doc, host: doc.body, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  overlay.open({ title: "T", onSkip: () => {} });
  const root = overlay.element; assert.equal(root.hidden, false); assert.equal(root.getAttribute("role"), "dialog");
  const box = root.children[2].children[1], line = box.children[1], name = box.children[0];
  let resolved = false;
  const promise = overlay.say({ speaker: "navi", name: "NAVI", text: "你好，世界。", motion: "talk-bounce", portrait: { kind: "navi" } }).then(() => { resolved = true; });
  assert.equal(name.textContent, "NAVI"); assert.equal(box.dataset.phase, "typing");
  await timers.tick(VN_TYPEWRITER_MS * 2 + 1);
  assert.equal(line.textContent, "你好");
  box.listeners.get("click")(); // tap: fill the line
  assert.equal(line.textContent, "你好，世界。"); assert.equal(box.dataset.phase, "done"); assert.equal(resolved, false);
  box.listeners.get("click")(); await promise; assert.equal(resolved, true);
  const portraits = root.children[1].children;
  assert.equal(portraits[0].dataset.side, "left"); assert.equal(portraits[0].dataset.active, "true"); assert.equal(portraits[0].dataset.kind, "navi");
  await overlay.say({ speaker: "partner", name: "P", text: "嗨", portrait: { kind: "image", src: "p.webp" }, motion: "talk-bounce", signal: AbortSignal.abort() });
  assert.equal(portraits[1].dataset.side, "right");
  // Choice renders the options and resolves the index.
  const choice = overlay.choose({ prompt: "?", options: ["A", "B"] });
  const choices = root.children[2].children[2];
  assert.equal(choices.hidden, false); assert.equal(choices.children.length, 3);
  choices.children[2].listeners.get("click")();
  assert.equal(await choice, 1);
  overlay.close(); assert.equal(root.hidden, true); assert.equal(timers.pending, 0);
  overlay.dispose();
});

test("the puppeteer drives the field puppet, the rift and the emote, and clears everything at end", async () => {
  const timers = fakeTimers(), doc = docDouble(), host = doc.createElement("div");
  const calls = [];
  const field = { actorScreenRect: () => ({ x: 100, y: 200, width: 40, height: 50 }), focusResident(id) { calls.push(["focus", id]); return true; },
    setStoryPuppet(id, o) { calls.push(["puppet", id, o.action, o.facing ?? null]); return true; }, clearStoryPuppet(id) { calls.push(["clear", id]); } };
  let intervals = 0;
  const stage = createStoryStagePuppeteer({ host, field, partnerCreatureId: "c1", doc, random: () => 0.5, setTimer: timers.setTimer, clearTimer: timers.clearTimer, setIntervalFn: () => ++intervals, clearIntervalFn: () => { intervals = 0; } });
  await stage.begin();
  assert.equal(stage.element.hidden, false); assert.equal(intervals, 1);
  stage.rift("open", "edge-left"); const rift = stage.element.children[1];
  assert.equal(rift.dataset.state, "open");
  stage.emote("!"); const emote = stage.element.children[3];
  assert.equal(emote.hidden, false); assert.equal(emote.dataset.glyph, "exclaim"); assert.ok(emote.children[0].html.includes(STORY_EMOTE_GLYPHS["!"].path));
  const acting = stage.actor("attack", { toward: "rift" }); await timers.tick(1000); await acting;
  assert.deepEqual(calls.filter(c => c[0] === "puppet").map(c => c.slice(2)), [["attack", "left"], ["idle", null]]);
  stage.echoes(["a", "b"]); assert.equal(stage.element.children[2].children.length, 2);
  stage.rift("close"); await timers.tick(800); assert.equal(rift.dataset.state, "closed");
  await stage.end();
  assert.equal(stage.element.hidden, true); assert.equal(intervals, 0);
  assert.ok(calls.some(c => c[0] === "clear" && c[1] === "c1"));
  await timers.tick(10000); assert.equal(timers.pending, 0);
  stage.dispose();
});

test("the ranch badge hides during the tutorial, pulses until seen, and the System menu lists the story entry", () => {
  const doc = docDouble(), root = doc.createElement("div"); root.ownerDocument = doc;
  let seen = false;
  const badge = mountRanchStoryBadge(root, { isSeen: () => seen });
  badge.update({ tutorial: { finished: false } }); assert.equal(badge.element.hidden, true);
  badge.update({ tutorial: null }); assert.equal(badge.element.hidden, false); assert.equal(badge.element.dataset.new, "true");
  seen = true; badge.update({}); assert.equal(badge.element.dataset.new, "false");
  badge.element.listeners.get("click")();
  assert.equal(doc.dispatched.type, STORY_CHAPTER_OPEN_EVENT); assert.equal(doc.dispatched.detail.chapterId, STORY_FIRST_CHAPTER_ID);
  badge.dispose();
  assert.equal(PREFERENCE_DEFINITIONS.storyRiftChapter1Seen.scope, "device");
  assert.equal(PREFERENCE_DEFINITIONS.storyRiftChapter1Seen.default, false);
  const entry = TOOLBAR_PRODUCT_ENTRIES.SYSTEM.find(e => e.id === "story");
  assert.equal(entry.action, "OPEN_STORY");
  assert.ok(TOOLBAR_MENU_GROUPS.SYSTEM.some(group => group.entries.includes("story")));
});
