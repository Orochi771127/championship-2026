// Settings round (2026-09-29): the preference layer, its storage boundary,
// the page mapping (and the boot script that mirrors it), quality, audio,
// the highlight's preference-driven timing and the palettes' contrast.
// Browser behaviour (the panel, focus, layout) is covered by
// tests/championship-settings-browser.cjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {
  DEFAULT_PREFERENCES, PREFERENCE_CATEGORIES, PREFERENCE_DEFINITIONS, PREFERENCE_IDS, PREFERENCES_VERSION,
  coercePreference, createPreferencesDocument, normalizePreferences, parsePreferences, preferenceIdsIn, resolveReducedMotion, resolveTheme
} from "../src/championship/app/settings/preferenceSchema.js";
import { createPreferenceStore, PREFERENCE_WRITE_DELAY_MS } from "../src/championship/app/settings/preferenceStore.js";
import { createPreferenceEnvironment, THEME_COLORS } from "../src/championship/app/settings/preferenceEnvironment.js";
import { AUTO_QUALITY_WINDOW_MS, createQualityController } from "../src/championship/app/settings/qualityController.js";
import {
  CHAMPIONSHIP_PREFERENCES_KEY, createChampionshipPersistentSavePort, createChampionshipPreferencePort
} from "../src/championship/app/ChampionshipPersistentSavePort.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { QUALITY_TIERS, cappedPixelRatio, flashScale, initialAutoTier, prefersReducedMotion } from "../src/championship/presentation/presentationPreferences.js";
import { resolutionFor } from "../src/championship/presentation/championshipPixiStage.js";
import { createAudioBus, effectiveGain } from "../src/championship/presentation/audioBus.js";
import { createHighlightAudio } from "../src/championship/presentation/highlight/highlightAudio.js";
import { HIGHLIGHT_COMPACT, highlightOverrides, resolveHighlightTiming } from "../src/championship/presentation/highlight/highlightTimeline.js";
import { createHighlightSequence } from "../src/championship/presentation/highlight/createHighlightSequence.js";
import { resultHeroAnchor, resultFrameLayout, RESULT_FRAME_DROP } from "../src/championship/presentation/battleResultCharacters.js";

// ---- Fixtures -----------------------------------------------------------------
function memoryStorage({ failWrites = false } = {}) {
  const data = new Map();
  const writes = [];
  return {
    data, writes,
    failWrites,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem(key, value) {
      if (this.failWrites) throw new Error("QuotaExceededError");
      writes.push(String(key));
      data.set(String(key), String(value));
    },
    removeItem: (key) => { data.delete(key); }
  };
}

function manualTimers() {
  let next = 1;
  const timers = new Map();
  return {
    setTimer(fn, ms) { const id = next++; timers.set(id, { fn, ms }); return id; },
    clearTimer(id) { timers.delete(id); },
    runAll() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); } },
    pending: () => timers.size
  };
}

function storeOn(storage, timers = manualTimers()) {
  const store = createPreferenceStore({
    port: createChampionshipPreferencePort({ storage }),
    now: () => "2026-09-29T12:00:00.000Z",
    setTimer: timers.setTimer, clearTimer: timers.clearTimer
  });
  return { store, timers };
}

class FakeElement {
  constructor() { this.dataset = {}; this.attributes = {}; this.lang = ""; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
}
function fakeDocument() {
  const root = new FakeElement();
  const metas = { color: new FakeElement(), scheme: new FakeElement() };
  return {
    documentElement: root, metas,
    querySelector(selector) {
      if (selector.includes("theme-color")) return metas.color;
      if (selector.includes("color-scheme")) return metas.scheme;
      return null;
    }
  };
}
function fakeMatchMedia({ dark = true, reduce = false } = {}) {
  const queries = {};
  const matchMedia = (query) => {
    const listeners = new Set();
    const entry = queries[query] ??= {
      get matches() { return query.includes("color-scheme: dark") ? state.dark : query.includes("reduced-motion") ? state.reduce : false; },
      addEventListener: (type, fn) => listeners.add(fn),
      removeEventListener: (type, fn) => listeners.delete(fn),
      fire: () => { for (const fn of listeners) fn(); }
    };
    return entry;
  };
  const state = { dark, reduce };
  return { matchMedia, state, queries };
}

// ---- Schema ----------------------------------------------------------------------
test("every preference has a category, a scope and a valid default", () => {
  assert.equal(PREFERENCES_VERSION, 1);
  assert.deepEqual(PREFERENCE_CATEGORIES, ["appearance", "quality", "sound", "language", "access", "data"]);
  for (const id of PREFERENCE_IDS) {
    const definition = PREFERENCE_DEFINITIONS[id];
    assert.ok(PREFERENCE_CATEGORIES.includes(definition.category), id);
    assert.ok(["device", "account"].includes(definition.scope), id);
    assert.equal(coercePreference(id, definition.default), definition.default, `${id} default is valid`);
  }
  // Device: this phone. Account: a taste that would follow the player.
  assert.equal(PREFERENCE_DEFINITIONS.quality.scope, "device");
  assert.equal(PREFERENCE_DEFINITIONS.masterVolume.scope, "device");
  assert.equal(PREFERENCE_DEFINITIONS.theme.scope, "account");
  assert.equal(PREFERENCE_DEFINITIONS.locale.scope, "account");
  // The defaults keep today's game exactly: night theme, zh-Hant, full sound.
  assert.equal(DEFAULT_PREFERENCES.theme, "night");
  assert.equal(DEFAULT_PREFERENCES.locale, "zh-Hant");
  assert.equal(DEFAULT_PREFERENCES.masterVolume, 100);
  assert.equal(DEFAULT_PREFERENCES.quality, "auto");
  // No preference exists without a real effect: there is no music, interface
  // sound, voice, screen-shake or frame-rate setting.
  for (const absent of ["musicVolume", "uiVolume", "voiceVolume", "screenShake", "frameRate"]) assert.equal(PREFERENCE_DEFINITIONS[absent], undefined, absent);
  assert.deepEqual(preferenceIdsIn("data"), [], "data & account holds facts and actions, no preference");
});

test("invalid values fall back to the default and numbers snap to the slider step", () => {
  const normalized = normalizePreferences({ theme: "neon", textScale: 120, masterVolume: 83, sfxVolume: -10, muted: "yes", unknown: 1 });
  assert.equal(normalized.theme, "night");
  assert.equal(normalized.textScale, 100);
  assert.equal(normalized.masterVolume, 85);
  assert.equal(normalized.sfxVolume, 0);
  assert.equal(normalized.muted, false);
  assert.equal("unknown" in normalized, false);
  assert.ok(Object.isFrozen(normalized));
});

test("the stored document keeps only non-defaults, split by scope", () => {
  const document = createPreferencesDocument({ ...DEFAULT_PREFERENCES, theme: "warm", masterVolume: 60, locale: "en" }, { updatedAt: "t" });
  assert.deepEqual(document, { schemaVersion: 1, kind: "CHAMPIONSHIP_PREFERENCES", updatedAt: "t",
    device: { masterVolume: 60 }, account: { theme: "warm", locale: "en" } });
});

test("reading: absent, current, older flat map, unreadable and newer versions", () => {
  assert.equal(parsePreferences(null).status, "ABSENT");
  const current = parsePreferences(JSON.stringify({ schemaVersion: 1, device: { textScale: 130 }, account: { theme: "clear" } }));
  assert.equal(current.status, "OK");
  assert.equal(current.preferences.textScale, 130);
  assert.equal(current.preferences.theme, "clear");
  const flat = parsePreferences(JSON.stringify({ theme: "warm", locale: "en" }));
  assert.equal(flat.status, "MIGRATED");
  assert.equal(flat.migratedFrom, 0);
  assert.equal(flat.preferences.theme, "warm");
  assert.equal(parsePreferences("{not json").status, "UNREADABLE");
  assert.equal(parsePreferences("[]").status, "UNREADABLE");
  const newer = parsePreferences(JSON.stringify({ schemaVersion: 9, account: { theme: "warm" } }));
  assert.equal(newer.status, "NEWER");
  assert.equal(newer.preferences.theme, "night", "a newer document is not guessed at");
});

test("theme and motion resolution: the explicit choice wins, system follows the OS", () => {
  assert.equal(resolveTheme("system", { prefersDark: true }), "night");
  assert.equal(resolveTheme("system", { prefersDark: false }), "clear");
  assert.equal(resolveTheme("warm", { prefersDark: true }), "warm", "warm is only ever chosen by hand");
  assert.equal(resolveReducedMotion("system", { systemReduced: true }), true);
  assert.equal(resolveReducedMotion("off", { systemReduced: true }), false);
  assert.equal(resolveReducedMotion("on", { systemReduced: false }), true);
});

// ---- Storage boundary and store ---------------------------------------------------------
test("preferences have their own key inside the product namespace, beside the one save key", () => {
  assert.equal(CHAMPIONSHIP_PREFERENCES_KEY, "championshipModernSave:preferences:v1");
  assert.notEqual(CHAMPIONSHIP_PREFERENCES_KEY, CHAMPIONSHIP_MODERN_SAVE_KEY);
  const storage = memoryStorage();
  const port = createChampionshipPreferencePort({ storage });
  assert.equal(port.write("{}").ok, true);
  assert.deepEqual(storage.writes, [CHAMPIONSHIP_PREFERENCES_KEY]);
  const blocked = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); }, removeItem() {} };
  const failing = createChampionshipPreferencePort({ storage: blocked });
  assert.match(failing.read().error, /STORAGE_UNAVAILABLE/);
  assert.equal(failing.write("{}").ok, false);
});

test("a change applies at once and is written once, after the burst", () => {
  const storage = memoryStorage();
  const { store, timers } = storeOn(storage);
  const seen = [];
  store.subscribe((values, changed) => seen.push([values.masterVolume, changed]));
  for (const volume of [90, 80, 70, 60]) store.set("masterVolume", volume);
  assert.deepEqual(seen.map(([volume]) => volume), [90, 80, 70, 60], "every step applies immediately");
  assert.equal(storage.writes.length, 0, "nothing is written during the drag");
  assert.equal(store.status().phase, "PENDING");
  timers.runAll();
  assert.equal(storage.writes.length, 1);
  assert.equal(store.status().phase, "SAVED");
  assert.equal(JSON.parse(storage.getItem(CHAMPIONSHIP_PREFERENCES_KEY)).device.masterVolume, 60);
  assert.equal(PREFERENCE_WRITE_DELAY_MS, 300);
  assert.equal(store.set("masterVolume", "loud"), false, "an invalid value is refused");
  assert.equal(store.set("noSuchSetting", 1), false);
});

test("a failed write is reported honestly and can be retried; the settings stay in effect", () => {
  const storage = memoryStorage({ failWrites: true });
  const { store, timers } = storeOn(storage);
  store.set("theme", "clear");
  timers.runAll();
  assert.equal(store.status().phase, "SAVE_FAILED");
  assert.match(store.status().error, /Quota/);
  assert.equal(store.get().theme, "clear", "the choice still applies this session");
  storage.failWrites = false;
  store.retry();
  assert.equal(store.status().phase, "SAVED");
  assert.equal(JSON.parse(storage.getItem(CHAMPIONSHIP_PREFERENCES_KEY)).account.theme, "clear");
});

test("a document from a newer version is never overwritten", () => {
  const storage = memoryStorage();
  const newer = JSON.stringify({ schemaVersion: 7, account: { theme: "warm" }, future: true });
  storage.data.set(CHAMPIONSHIP_PREFERENCES_KEY, newer);
  const { store, timers } = storeOn(storage);
  assert.equal(store.status().phase, "READ_ONLY");
  store.set("theme", "clear");
  timers.runAll();
  store.flush();
  assert.equal(store.get().theme, "clear", "the session may still change it");
  assert.equal(storage.getItem(CHAMPIONSHIP_PREFERENCES_KEY), newer, "but the newer document is untouched");
  assert.equal(storage.writes.length, 0);
});

test("resetting a category or everything touches preferences only", () => {
  const storage = memoryStorage();
  storage.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, "THE-SAVE");
  const { store, timers } = storeOn(storage);
  store.set("theme", "warm");
  store.set("textScale", 130);
  store.set("masterVolume", 40);
  store.resetCategory("sound");
  assert.equal(store.get().masterVolume, 100);
  assert.equal(store.get().theme, "warm", "another category is left alone");
  store.resetAll();
  assert.deepEqual(store.get(), DEFAULT_PREFERENCES);
  timers.runAll();
  assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), "THE-SAVE", "the game save is never part of a reset");
  assert.ok(storage.writes.every((key) => key === CHAMPIONSHIP_PREFERENCES_KEY));
});

test("settings writes and game saves never overwrite each other", async () => {
  const storage = memoryStorage();
  const entities = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
  const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
  const app = createChampionshipStandaloneApp({ storage, catalog: entities, cages: presentation.cages, now: () => "2026-09-29T10:00:00.000Z", locks: null });
  await app.newGame();
  const { store, timers } = storeOn(storage);
  assert.equal(app.save().phase, "SAVED");
  const saved = storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  store.set("theme", "clear");
  timers.runAll();
  assert.equal(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY), saved, "a settings write leaves the save byte for byte");
  // The save port checks its own key for a stale baseline; a settings write
  // in between must not read as another tab's save.
  app.creditBits(5);
  assert.equal(app.save().phase, "SAVED", "the next autosave still succeeds");
  assert.equal(JSON.parse(storage.getItem(CHAMPIONSHIP_PREFERENCES_KEY)).account.theme, "clear", "and does not touch the settings");
  await app.dispose();
});

// ---- Page mapping and the boot script -------------------------------------------------
test("the environment writes one resolved attribute per preference", () => {
  const storage = memoryStorage();
  const { store } = storeOn(storage);
  const doc = fakeDocument();
  const media = fakeMatchMedia({ dark: false, reduce: true });
  const quality = createQualityController({ doc, preference: "auto", signals: {} });
  const environment = createPreferenceEnvironment({ store, doc, matchMedia: media.matchMedia, quality });
  const root = doc.documentElement;
  assert.deepEqual({ ...root.dataset }, { quality: "balanced", theme: "night", themeChoice: "night", textScale: "100", hud: "standard", motion: "reduced", flash: "standard", highlight: "full" });
  assert.equal(root.lang, "zh-Hant");
  store.set("theme", "system");
  assert.equal(root.dataset.theme, "clear", "a light system reads as the clear palette");
  assert.equal(doc.metas.color.getAttribute("content"), THEME_COLORS.clear);
  assert.equal(doc.metas.scheme.getAttribute("content"), "light");
  media.state.dark = true; media.queries["(prefers-color-scheme: dark)"].fire();
  assert.equal(root.dataset.theme, "night", "and follows the system when it changes");
  store.set("reducedMotion", "off");
  assert.equal(root.dataset.motion, "full", "an explicit off beats the system setting");
  store.set("textScale", 130); store.set("hudDensity", "compact"); store.set("flashIntensity", "soft"); store.set("highlightMode", "compact"); store.set("quality", "saver");
  assert.deepEqual([root.dataset.textScale, root.dataset.hud, root.dataset.flash, root.dataset.highlight, root.dataset.quality], ["130", "compact", "soft", "compact", "saver"]);
  store.set("locale", "en");
  assert.equal(root.lang, "en");
  store.set("locale", "zh-Hant");
  environment.dispose();
});

function bootScript() {
  const html = fs.readFileSync("championship.html", "utf8");
  const match = html.match(/<script>\s*(\/\/ Player preferences before the first paint[\s\S]*?)<\/script>/);
  assert.ok(match, "the boot script is inline in the head");
  return match[1];
}

test("the boot script is read-only and names the same key", () => {
  const script = bootScript();
  assert.doesNotMatch(script, /setItem|removeItem|\.clear\(/, "it never writes storage");
  assert.match(script, new RegExp(CHAMPIONSHIP_PREFERENCES_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const html = fs.readFileSync("championship.html", "utf8");
  assert.ok(html.indexOf("Player preferences before the first paint") < html.indexOf('rel="stylesheet"'), "it runs before the first stylesheet");
});

test("the boot script and the modules map every case the same way", () => {
  const script = bootScript();
  const cases = [
    { text: null, dark: true, reduce: false, nav: {} },
    { text: JSON.stringify({ schemaVersion: 1, account: { theme: "system", locale: "en", highlightMode: "compact" }, device: { textScale: 115, reducedMotion: "system" } }), dark: false, reduce: true, nav: { hardwareConcurrency: 8 } },
    { text: JSON.stringify({ schemaVersion: 1, account: { theme: "warm", flashIntensity: "soft" }, device: { quality: "high", hudDensity: "compact", reducedMotion: "off" } }), dark: true, reduce: true, nav: {} },
    { text: JSON.stringify({ theme: "clear", quality: "auto" }), dark: true, reduce: false, nav: { deviceMemory: 2 } },
    { text: "{broken", dark: false, reduce: false, nav: { connection: { saveData: true } } },
    { text: JSON.stringify({ schemaVersion: 4, account: { theme: "warm" } }), dark: true, reduce: false, nav: { hardwareConcurrency: 2 } }
  ];
  for (const scenario of cases) {
    // What the boot script writes.
    const bootDoc = fakeDocument();
    const media = fakeMatchMedia({ dark: scenario.dark, reduce: scenario.reduce });
    const context = {
      document: bootDoc,
      window: { localStorage: { getItem: () => scenario.text }, matchMedia: media.matchMedia, navigator: scenario.nav },
      JSON, Array
    };
    vm.runInNewContext(script, context);
    // What the modules write for the same stored text and device.
    const storage = memoryStorage();
    if (scenario.text !== null) storage.data.set(CHAMPIONSHIP_PREFERENCES_KEY, scenario.text);
    const { store } = storeOn(storage);
    const moduleDoc = fakeDocument();
    const quality = createQualityController({ doc: moduleDoc, preference: store.get().quality, signals: {
      saveData: scenario.nav.connection?.saveData === true,
      deviceMemory: scenario.nav.deviceMemory ?? null,
      hardwareConcurrency: scenario.nav.hardwareConcurrency ?? null } });
    createPreferenceEnvironment({ store, doc: moduleDoc, matchMedia: fakeMatchMedia({ dark: scenario.dark, reduce: scenario.reduce }).matchMedia, quality });
    assert.deepEqual({ ...bootDoc.documentElement.dataset }, { ...moduleDoc.documentElement.dataset }, JSON.stringify(scenario));
    assert.equal(bootDoc.documentElement.lang, moduleDoc.documentElement.lang);
    assert.equal(bootDoc.metas.color.getAttribute("content"), moduleDoc.metas.color.getAttribute("content"));
  }
});

// ---- Quality ----------------------------------------------------------------------------------
test("every tier is a set of real parameters and auto starts conservatively", () => {
  assert.deepEqual(Object.keys(QUALITY_TIERS), ["saver", "balanced", "high"]);
  assert.ok(QUALITY_TIERS.saver.pixiResolutionCap < QUALITY_TIERS.balanced.pixiResolutionCap);
  assert.ok(QUALITY_TIERS.balanced.pixiResolutionCap < QUALITY_TIERS.high.pixiResolutionCap);
  assert.ok(QUALITY_TIERS.saver.highlightParticles < QUALITY_TIERS.balanced.highlightParticles);
  assert.ok(QUALITY_TIERS.high.highlightParticles <= 160, "never past the shard cap");
  assert.equal(QUALITY_TIERS.balanced.pixiResolutionCap, 2, "balanced is today's renderer");
  assert.ok(QUALITY_TIERS.saver.highlightStairs >= 2, "the key feedback stays in saver");
  assert.equal(initialAutoTier({}).tier, "balanced");
  assert.equal(initialAutoTier({ saveData: true }).tier, "saver");
  assert.equal(initialAutoTier({ deviceMemory: 2 }).tier, "saver");
  assert.equal(initialAutoTier({ hardwareConcurrency: 2 }).tier, "saver");
  assert.equal(initialAutoTier({ deviceMemory: 8, hardwareConcurrency: 16 }).tier, "balanced", "auto never picks high by itself");
  assert.equal(resolutionFor(1, 3), 1);
  assert.equal(resolutionFor(2, 3), 2);
  assert.equal(resolutionFor(3, 1.5), 1.5);
  assert.equal(resolutionFor(2, 0.5), 1, "never below one");
  assert.equal(cappedPixelRatio(2, 2.75), 2);
});

test("auto steps down once after two slow settled windows, never up, and ignores stalls", () => {
  const doc = fakeDocument();
  const quality = createQualityController({ doc, preference: "auto", signals: {} });
  const feed = (ms, frames, stable = true) => { for (let i = 0; i < frames; i += 1) quality.sample(ms, stable); };
  feed(40, Math.ceil(AUTO_QUALITY_WINDOW_MS / 40), false);
  assert.equal(quality.describe().tier, "balanced", "an unsettled screen (loading, switching) never counts");
  feed(300, 100);
  assert.equal(quality.describe().tier, "balanced", "a stall is a tab switch, not a slow device");
  feed(40, Math.ceil(AUTO_QUALITY_WINDOW_MS / 40));
  assert.equal(quality.describe().tier, "balanced", "one slow window is not enough");
  feed(16.7, Math.ceil(AUTO_QUALITY_WINDOW_MS / 16.7));
  feed(40, Math.ceil(AUTO_QUALITY_WINDOW_MS / 40));
  assert.equal(quality.describe().tier, "balanced", "a good window in between resets the count");
  feed(40, Math.ceil(AUTO_QUALITY_WINDOW_MS / 40));
  assert.equal(quality.describe().tier, "saver");
  assert.equal(doc.documentElement.dataset.quality, "saver");
  assert.equal(quality.describe().reasonCode, "SLOW_FRAMES");
  feed(8, 10000);
  assert.equal(quality.describe().tier, "saver", "it never steps back up");
  quality.setPreference("high");
  assert.equal(quality.describe().tier, "high", "a manual choice is respected as is");
  feed(80, 10000);
  assert.equal(quality.describe().tier, "high");
});

// ---- Audio ------------------------------------------------------------------------------
class FakeParam {
  constructor(value) { this.value = value; this.calls = []; }
  cancelScheduledValues() { this.calls.push("cancel"); }
  setValueAtTime(v) { this.calls.push(["set", v]); }
  setTargetAtTime(v, t, c) { this.calls.push(["target", v, c]); this.value = v; }
  linearRampToValueAtTime(v) { this.calls.push(["linear", v]); this.value = v; }
  exponentialRampToValueAtTime(v) { this.calls.push(["exp", v]); }
}
class FakeNode {
  constructor(ctx) { this.ctx = ctx; this.connections = []; this.gain = new FakeParam(1); this.frequency = new FakeParam(0); this.Q = new FakeParam(0); this.threshold = new FakeParam(0); this.ratio = new FakeParam(0); }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start() { this.started = true; this.ctx.started += 1; }
  // A stop in the future is only scheduled; a stop now (or in the past) ends the node.
  stop(when) {
    if (when !== undefined && when > this.ctx.currentTime) { this.stopAt = when; return; }
    if (this.ended) return;
    this.ended = true; this.ctx.stopped += 1; this.onended?.();
  }
}
class FakeAudioContext {
  constructor() { this.state = "running"; this.currentTime = 0; this.destination = new FakeNode(this); this.started = 0; this.stopped = 0; this.closed = false; this.sampleRate = 48000; FakeAudioContext.created += 1; }
  createGain() { return new FakeNode(this); }
  createOscillator() { return new FakeNode(this); }
  createBiquadFilter() { return new FakeNode(this); }
  createDynamicsCompressor() { return new FakeNode(this); }
  createBufferSource() { return new FakeNode(this); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.state = "running"; return Promise.resolve(); }
  close() { this.closed = true; this.state = "closed"; return Promise.resolve(); }
}
FakeAudioContext.created = 0;
const noEvents = { addEventListener() {}, removeEventListener() {} };

test("effective volume is master times the category, and zero while muted", () => {
  assert.equal(effectiveGain({ masterVolume: 100, sfxVolume: 100 }), 1);
  assert.equal(effectiveGain({ masterVolume: 50, sfxVolume: 50 }), 0.25);
  assert.equal(effectiveGain({ masterVolume: 100, sfxVolume: 100, muted: true }), 0);
});

test("a muted game is silent from its first sound, and changes ramp without a click", () => {
  const bus = createAudioBus({ AudioContextClass: FakeAudioContext, eventTarget: noEvents, levels: { muted: true, masterVolume: 80, sfxVolume: 60 } });
  const output = bus.output("sfx");
  assert.ok(output.context instanceof FakeAudioContext);
  assert.equal(bus.gains().master, 0, "the master starts at zero, not at full and then corrected");
  assert.equal(bus.gains().sfx, 0.6);
  bus.setLevels({ muted: false });
  assert.equal(bus.gains().master, 0.8);
  const masterParam = output.destination.connections[0].gain;
  assert.ok(masterParam.calls.some((call) => Array.isArray(call) && call[0] === "target" && call[2] > 0), "changes use a time-constant ramp");
  assert.throws(() => bus.output("music"), /AUDIO_CATEGORY_music/, "there is no music category to route into");
  bus.dispose();
});

test("the test sound never stacks and plays nothing while muted", () => {
  const bus = createAudioBus({ AudioContextClass: FakeAudioContext, eventTarget: noEvents, levels: { muted: false } });
  assert.equal(bus.preview(), true);
  const context = bus.output("sfx").context;
  assert.equal(bus.stats().previewing, true);
  bus.preview();
  assert.equal(context.stopped, 1, "the first chime is stopped before the second starts");
  bus.setLevels({ muted: true });
  assert.equal(bus.preview(), false);
  bus.dispose();
});

test("the highlight plays through the shared bus, stops on skip, and leaves the shared context open", () => {
  const bus = createAudioBus({ AudioContextClass: FakeAudioContext, eventTarget: noEvents, levels: {} });
  const output = bus.output("sfx");
  const audio = createHighlightAudio({ output, gain: 0.16 });
  audio.cue("charge", 800);
  assert.ok(audio.stats().voices > 0);
  assert.equal(audio.stats().shared, true);
  const stopped = audio.silence();
  assert.ok(stopped > 0, "a skip stops the charge sweep at once");
  audio.dispose();
  assert.equal(output.context.closed, false, "the bus owns the context");
  bus.dispose();
  assert.equal(output.context.closed, true);
});

// ---- Highlight ---------------------------------------------------------------------------------
test("compact highlight is shorter and lands on the same settled figure", () => {
  const full = resolveHighlightTiming(highlightOverrides({ mode: "full" }));
  const compact = resolveHighlightTiming(highlightOverrides({ mode: "compact" }));
  assert.ok(Math.abs(full.totalMs - 3720) < 1);
  assert.ok(Math.abs(compact.totalMs - 2380) < 1, `compact is ${compact.totalMs} ms`);
  assert.equal(compact.chargeMs, HIGHLIGHT_COMPACT.chargeMs);
  assert.ok(compact.chargeMs >= 600, "the charge keeps its 0.6 s floor");
  const saver = resolveHighlightTiming(highlightOverrides({ mode: "full", quality: QUALITY_TIERS.saver }));
  assert.equal(saver.particleCount, QUALITY_TIERS.saver.highlightParticles);
  assert.equal(saver.stairSteps, QUALITY_TIERS.saver.highlightStairs);
});

function highlightHarness() {
  class Node {
    constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.parent = null; this.dataset = {}; this.attributes = {}; this.listeners = {};
      this.styleValues = {}; this.style = { setProperty: (n, v) => { this.styleValues[n] = v; } }; this.className = ""; this.textContent = ""; }
    append(...nodes) { for (const n of nodes) { n.parent = this; this.children.push(n); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((n) => n !== this); }
    setAttribute(n, v) { this.attributes[n] = v; }
    addEventListener(n, fn) { this.listeners[n] = fn; }
    removeEventListener(n) { delete this.listeners[n]; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 700 }; }
  }
  const doc = { createElement: (tag) => new Node(tag, doc) };
  const host = doc.createElement("div");
  const ticker = { callbacks: new Set(), add(fn) { this.callbacks.add(fn); }, remove(fn) { this.callbacks.delete(fn); },
    run(ms) { for (let t = 0; t < ms; t += 16.667) for (const fn of [...this.callbacks]) fn({ deltaMS: 16.667 }); } };
  return { host, ticker };
}

test("the highlight's effects sit behind the plate and its light falls on the characters", () => {
  const { host, ticker } = highlightHarness();
  const silenced = [];
  const cues = [];
  const audio = { cue: (name) => { cues.push(name); return true; }, silence: () => { silenced.push(true); return 1; }, stats: () => ({}), dispose() {} };
  const run = createHighlightSequence({ host, ticker, target: 700, audio, anchor: () => ({ x: 0.2, y: 0.7 }), decor: "minimal" });
  const [back, front] = host.children;
  assert.equal(back.className, "cm-highlight", "the back layer: scrim, light, marks, ring, shards");
  assert.equal(front.className, "cm-highlight-front", "the front layer: the flash and the skip hint only");
  assert.equal(back.children.some((n) => n.className === "cm-highlight__flash"), false);
  assert.equal(front.children.some((n) => n.className === "cm-highlight__flash"), true);
  assert.equal(back.styleValues["--hl-ax"], "20.00%");
  assert.equal(back.styleValues["--hl-ay"], "70.00%");
  assert.equal(back.dataset.decor, "minimal");
  run.start();
  ticker.run(1500);
  assert.equal(run.skip(), true);
  assert.equal(silenced.length, 1, "a skip silences what is already playing");
  assert.equal(cues.includes("settle"), false, "and does not add a landing chime");
  assert.equal(run.inspect().shownValue, 700, "the real figure is shown");
  run.dispose();
  assert.equal(host.children.length, 0, "both layers are removed");
});

test("the result characters stand low on the stage and the hero anchor follows them", () => {
  const layout = resultFrameLayout(390, 700);
  assert.equal(RESULT_FRAME_DROP, 0.7);
  assert.ok(Math.abs(layout.top - (700 - 192 * (390 / 256)) * 0.7) < 0.01);
  const hero = resultHeroAnchor({ width: 390, height: 700, slots: [0] });
  assert.ok(hero.x > 0.1 && hero.x < 0.3, "slot 0 stands on the left");
  assert.ok(hero.y > 0.55 && hero.y < 0.85, "and low on the stage");
  const team = resultHeroAnchor({ width: 390, height: 700, slots: [0, 1, 2] });
  assert.ok(Math.abs(team.x - 0.5) < 0.05, "three characters centre the light");
  assert.equal(resultHeroAnchor({ width: 390, height: 700, slots: [] }), null);
});

// ---- Presentation readers -------------------------------------------------------------------
test("presentations read the resolved attributes, with the system as the fallback", () => {
  const doc = fakeDocument();
  doc.documentElement.dataset.motion = "reduced";
  assert.equal(prefersReducedMotion(doc), true);
  doc.documentElement.dataset.motion = "full";
  assert.equal(prefersReducedMotion(doc), false);
  doc.documentElement.dataset.flash = "soft";
  assert.equal(flashScale(doc), 0.35);
  doc.documentElement.dataset.flash = "standard";
  assert.equal(flashScale(doc), 1);
});

// ---- Palettes -------------------------------------------------------------------------------------
function palette(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, selector);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start));
  const values = {};
  for (const [, name, value] of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) values[name] = value.toLowerCase();
  return values;
}
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

test("every palette keeps text, status and readouts legible on its surfaces", () => {
  const css = fs.readFileSync("src/championship/app/ui/tokens.css", "utf8");
  const palettes = {
    night: palette(css, ':root, [data-palette="night"]'),
    clear: palette(css, ':root[data-theme="clear"], [data-palette="clear"]'),
    warm: palette(css, ':root[data-theme="warm"], [data-palette="warm"]')
  };
  for (const [name, p] of Object.entries(palettes)) {
    for (const surface of ["c-ground", "c-surface-1", "c-surface-2"]) {
      for (const text of ["c-text-1", "c-text-2", "c-text-3"]) {
        assert.ok(contrast(p[text], p[surface]) >= 4.5, `${name}: ${text} on ${surface} is ${contrast(p[text], p[surface]).toFixed(2)}`);
      }
      assert.ok(contrast(p["c-text-disabled"], p[surface]) >= 2.5, `${name}: disabled text stays visible on ${surface}`);
    }
    assert.ok(contrast(p["c-text-on-accent"], p["c-accent"]) >= 4.5, `${name}: a primary button's words`);
    assert.ok(contrast(p["c-accent"], p["c-surface-1"]) >= 3, `${name}: the accent outline of a selection`);
    if (name !== "night") {
      // In light palettes these are used as text on light surfaces.
      for (const status of ["c-success", "c-warning", "c-danger", "c-info", "c-rare", "c-gold-strong", "c-accent-strong", "c-stat-hp", "c-stat-tp"]) {
        assert.ok(contrast(p[status], p["c-surface-1"]) >= 4.5, `${name}: ${status} on surface-1 is ${contrast(p[status], p["c-surface-1"]).toFixed(2)}`);
      }
    }
    assert.notEqual(p["c-team-player"], p["c-team-opponent"], `${name}: the two teams never share a colour`);
  }
});

test("the title keeps its key-art palette, and retired skins stay unlinked", () => {
  const html = fs.readFileSync("championship.html", "utf8");
  assert.match(html, /<div id="cm-title" class="cm-title" data-palette="night">/);
  for (const retired of ["nativeUiSkin.css", "daylightSkin.css", "raisingHomeHud.css", "huntMobile.css", "facilityBattleMobile.css", "trainingLabels.css", "shopOriginalVideo.css"]) {
    assert.equal(html.includes(retired), false, retired);
  }
  assert.match(html, /ui\/settings\.css/);
});
