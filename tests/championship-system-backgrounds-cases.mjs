import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { SYSTEM_BACKGROUNDS, SYSTEM_BACKGROUND_IDS, SYSTEM_BACKGROUND_HOSTS,
  chooseSystemBackground, createSystemBackgroundController, systemBackgroundById } from '../src/championship/presentation/systemBackgrounds.js';
import { DEFAULT_PREFERENCES, parsePreferences, serializePreferences } from '../src/championship/app/settings/preferenceSchema.js';
import { createPreferenceStore } from '../src/championship/app/settings/preferenceStore.js';

class Node {
  constructor(tag = 'section') { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.classes = new Set();
    this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) }; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; if (key === 'src') this.src = ''; }
  append(child) { this.children.push(child); child.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
}
function fixture(values = {}, sample = () => 0) {
  let preferences = { ...DEFAULT_PREFERENCES, ...values };
  const images = [], listeners = new Set(), host = new Node();
  const store = { get: () => preferences, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(id, value) { preferences = { ...preferences, [id]: value }; for (const fn of listeners) fn(preferences, [id]); } };
  const root = { querySelector: () => host };
  const doc = { createElement(tag) { const node = new Node(tag); if (tag === 'img') images.push(node); return node; } };
  const controller = createSystemBackgroundController({ root, store, doc, sample });
  return { root, host, store, images, controller, listeners };
}

test('defaults preserve the existing interface and corrupt/unknown stored values fail closed', () => {
  assert.equal(DEFAULT_PREFERENCES.systemBackgroundMode, 'default');
  assert.equal(DEFAULT_PREFERENCES.systemBackgroundId, '');
  assert.equal(parsePreferences('{bad').preferences.systemBackgroundMode, 'default');
  const corrupt = parsePreferences(JSON.stringify({ schemaVersion: 1, account: { systemBackgroundMode: 'custom', systemBackgroundId: '../../unsafe.png' } }));
  assert.equal(corrupt.preferences.systemBackgroundId, '');
  assert.equal(systemBackgroundById('../../unsafe.png'), null);
  const f = fixture(corrupt.preferences); f.controller.enter('SHOP'); assert.equal(f.images.length, 0);
  f.controller.dispose();
});

test('background preferences round-trip through the existing preference port, with no gameplay save', () => {
  let text = null, writes = 0;
  const port = { storageKey: 'preferences-only', read: () => ({ text, error: null }), write(value) { text = value; writes++; return { ok: true, error: null }; } };
  const store = createPreferenceStore({ port, setTimer: () => 1, clearTimer() {} });
  assert.equal(store.set('systemBackgroundId', SYSTEM_BACKGROUND_IDS[1]), true);
  assert.equal(store.set('systemBackgroundMode', 'custom'), true);
  store.flush(); assert.equal(writes, 1);
  const reloaded = createPreferenceStore({ port });
  assert.equal(reloaded.get().systemBackgroundMode, 'custom');
  assert.equal(reloaded.get().systemBackgroundId, SYSTEM_BACKGROUND_IDS[1]);
  assert.equal(store.set('systemBackgroundId', 'https://untrusted.example/x'), false);
  store.resetCategory('appearance'); store.flush();
  assert.equal(parsePreferences(text).preferences.systemBackgroundMode, 'default');
  assert.equal(parsePreferences(serializePreferences(reloaded.get())).preferences.systemBackgroundId, SYSTEM_BACKGROUND_IDS[1]);
  store.dispose(); reloaded.dispose();
});

test('default, unknown screens and every interactive field request no full images', () => {
  const f = fixture();
  for (const screen of Object.keys(SYSTEM_BACKGROUND_HOSTS)) { f.controller.enter(screen); assert.equal(f.images.length, 0); }
  f.store.set('systemBackgroundMode', 'custom'); f.store.set('systemBackgroundId', SYSTEM_BACKGROUND_IDS[0]);
  f.controller.leave(); f.images.length = 0;
  for (const screen of ['TITLE','RAISING_HOME','CAGE_EDIT','GATE_SELECT','HUNT_LOADOUT','HUNT_FIELD','BATTLE_FIELD','UNKNOWN']) {
    f.controller.enter(screen); assert.equal(f.images.length, 0, screen); assert.equal(f.controller.inspect().screen, null);
  }
  f.controller.dispose();
});

test('custom loads one whitelisted image, attaches only on success, and restores the original backdrop', () => {
  const f = fixture({ systemBackgroundMode: 'custom', systemBackgroundId: SYSTEM_BACKGROUND_IDS[0] });
  f.controller.enter('DATABASE');
  assert.equal(f.images.length, 1); assert.equal(f.host.children.length, 0);
  assert.equal(f.images[0].src, SYSTEM_BACKGROUNDS[0].src);
  f.images[0].onload();
  assert.equal(f.host.children.length, 1); assert.equal(f.host.children[0].attributes['aria-hidden'], 'true');
  assert.equal(f.images[0].alt, ''); assert.equal(f.images[0].draggable, false);
  assert.equal(f.controller.inspect().displayedId, SYSTEM_BACKGROUND_IDS[0]);
  f.store.set('theme', 'warm'); f.store.set('locale', 'vi'); f.store.set('quality', 'saver');
  f.controller.enter('DATABASE'); assert.equal(f.images.length, 1);
  f.store.set('systemBackgroundMode', 'default');
  assert.equal(f.host.children.length, 0); assert.equal(f.host.classes.has('cm-system-background-host'), false);
  assert.equal(f.host.dataset.systemBackground, undefined); f.controller.dispose();
});

test('failure and stale in-flight image callbacks cannot attach to another page or override default', () => {
  const f = fixture({ systemBackgroundMode: 'custom', systemBackgroundId: SYSTEM_BACKGROUND_IDS[0] });
  f.controller.enter('HELP'); const stale = f.images[0].onload;
  f.controller.leave(); f.controller.enter('SHOP');
  stale(); assert.equal(f.host.children.length, 0);
  f.images[1].onerror(); assert.equal(f.host.children.length, 0);
  assert.equal(f.controller.inspect().displayedId, null);
  f.controller.leave(); f.controller.enter('SHOP'); const afterDefault = f.images[2].onload;
  f.store.set('systemBackgroundMode', 'default'); afterDefault();
  assert.equal(f.host.children.length, 0); f.controller.dispose();
});

test('random draws once per eligible entry, not for redraws, small windows or preference changes', () => {
  let draws = 0;
  const f = fixture({ systemBackgroundMode: 'random' }, () => { draws++; return 0; });
  f.controller.enter('SHOP'); const first = f.controller.inspect().randomId;
  f.images[0].onload();
  for (let i = 0; i < 20; i++) f.controller.enter('SHOP');
  f.store.set('locale', 'ja'); f.store.set('textScale', 130); f.store.set('systemBackgroundId', SYSTEM_BACKGROUND_IDS[2]);
  assert.equal(draws, 1); assert.equal(f.images.length, 1);
  f.controller.leave(); f.controller.enter('DATABASE');
  assert.equal(draws, 2); assert.notEqual(f.controller.inspect().randomId, first);
  f.controller.leave(); f.controller.enter('HUNT_FIELD'); assert.equal(draws, 2);
  f.controller.dispose(); assert.equal(f.listeners.size, 0);
});

test('enabling random in Settings waits for actual next page entry', () => {
  let draws = 0; const f = fixture({}, () => { draws++; return 0.5; });
  f.controller.enter('HELP'); f.store.set('systemBackgroundMode', 'random'); f.controller.enter('HELP');
  assert.equal(draws, 0); assert.equal(f.images.length, 0);
  f.controller.leave(); f.controller.enter('HELP'); assert.equal(draws, 1); assert.equal(f.images.length, 1);
  f.controller.dispose();
});

test('random pool is bounded, avoids adjacent repeats, does not fake variety, and rejects broken entropy', () => {
  for (const previous of SYSTEM_BACKGROUND_IDS) for (const n of [0, 0.4999, 0.99999]) assert.notEqual(chooseSystemBackground(previous, () => n), previous);
  let calls = 0;
  assert.equal(chooseSystemBackground(SYSTEM_BACKGROUND_IDS[0], () => { calls++; return 0; }, [SYSTEM_BACKGROUND_IDS[0]]), SYSTEM_BACKGROUND_IDS[0]);
  assert.equal(calls, 0);
  for (const sample of [() => NaN, () => -1, () => 1, () => { throw Error('unavailable'); }]) assert.equal(chooseSystemBackground(null, sample), null);
  assert.equal(chooseSystemBackground(null, () => 0, ['bad-id']), null);
});

test('manifest bytes match the six encoded outputs and runtime has no full-image preload, timer or gameplay RNG', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../assets/production/system-backgrounds-r1/manifest.json', import.meta.url)));
  for (const asset of manifest.assets) for (const key of ['runtime', 'thumbnail']) {
    const row = asset[key], bytes = fs.readFileSync(new URL('../' + row.path, import.meta.url));
    assert.equal(bytes.length, row.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256);
  }
  assert.equal(manifest.assets.length, 3);
  const code = fs.readFileSync(new URL('../src/championship/presentation/systemBackgrounds.js', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /Math\.random|setInterval|setTimeout|requestAnimationFrame|localStorage|fetch\(/);
  const css = fs.readFileSync(new URL('../src/championship/app/ui/systemBackgrounds.css', import.meta.url), 'utf8');
  assert.match(css, /pointer-events: none/); assert.doesNotMatch(css, /animation:|transition:|@keyframes/);
  const panel = fs.readFileSync(new URL('../src/championship/app/settings/settingsPanel.js', import.meta.url), 'utf8');
  assert.match(panel, /image\.loading = "lazy"/); assert.match(panel, /image\.src = choice\.thumbnail/);
});

test('all twelve background labels are present in all five locale dictionaries', () => {
  const keys = ['LABEL','HINT','DEFAULT','DEFAULT_HINT','CUSTOM','CUSTOM_HINT','RANDOM','RANDOM_HINT','PICK','RESONANCE','GROWTH','GLORY'];
  for (const suffix of ['', '.en', '.ja', '.th', '.vi']) {
    const copy = fs.readFileSync(new URL('../src/championship/text/uiText' + suffix + '.js', import.meta.url), 'utf8');
    for (const key of keys) assert.match(copy, new RegExp('"SYSTEM_BACKGROUND_' + key + '":\\s*"[^"\\n]+"'), suffix + key);
  }
});
