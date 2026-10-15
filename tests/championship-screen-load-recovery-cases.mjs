import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
const main = readFileSync(new URL('../src/championship/app/main.js', import.meta.url), 'utf8');
const helpers = main.slice(main.indexOf('function isDynamicModuleLoadError('), main.indexOf('async function mountRaisingHome('));
const mount = main.slice(main.indexOf('async function mountCurrentScreen('), main.indexOf('// An explicit acceptance-testing grant'));
class Element {
  constructor(tag) { this.tagName = tag; this.dataset = {}; this.children = []; this.events = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(key, value) { this.events[key] = value; }
  remove() { this.removed = true; }
}
function fixture({ error = new TypeError('Importing a module script failed.'), save = () => ({ phase: 'SAVED' }) } = {}) {
  const root = new Element('main'), records = [], calls = [];
  const context = vm.createContext({
    document: { createElement: tag => new Element(tag) }, root,
    setText: (node, key) => { node.textContent = key; }, retranslate() {},
    app: { getScreen: () => 'RAISING_HOME', save: () => { calls.push('save'); return save(); } },
    location: { reload: () => calls.push('reload') },
    returnToTitle: async () => calls.push('title'),
    recoveryDiagnostics: { record: (...args) => records.push(args) },
    console: { warn: (...args) => calls.push(['warning', ...args]) },
    systemBackgrounds: { leave() {} }, expeditionSource: {},
    CHAMPIONSHIP_SCREENS: { RAISING_HOME: 'RAISING_HOME', SHOP: 'SHOP', DATABASE: 'DATABASE' },
    mountRaisingHome: async () => { throw error; }
  });
  context.safeSaveRoute = () => () => context.app.save();
  vm.runInContext('let mountedScreen=null, mounting=null, view=null, raisingSource=null;\n' + helpers + mount, context);
  return { context, root, records, calls, run: code => vm.runInContext(code, context) };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('recognizes Chromium, Firefox and Safari module fetch errors, not assets or arbitrary failures', () => {
  const f = fixture();
  for (const message of ['Failed to fetch dynamically imported module: https://site/chunk-A.js', 'error loading dynamically imported module: https://site/chunk-A.js', 'Importing a module script failed.', 'Importing a module script failed']) {
    f.context.error = { message }; assert.equal(f.run('isDynamicModuleLoadError(error)'), true);
  }
  for (const message of ['Failed to fetch', 'Load failed', 'RAISING_CARE_HTTP_404', 'RAISING_CORE_ART_UNAVAILABLE', 'Cannot read properties of undefined', 'LOAD_TIMEOUT', 'ASSET_FAILED: texture.png']) {
    f.context.error = { message }; assert.equal(f.run('isDynamicModuleLoadError(error)'), false);
  }
});
test('top-level import failure renders recovery, records original error and keeps clock non-playable', async () => {
  const f = fixture(); await f.run('mountCurrentScreen()');
  const card = f.root.children[0]; assert.equal(card.dataset.moduleLoadFailed, 'true');
  assert.equal(card.children[0].textContent, 'MODULE_LOAD_ERROR');
  assert.equal(f.run('view.isPlayable'), false); assert.equal(f.run('mountedScreen'), 'RAISING_HOME');
  assert.equal(f.records[0][0], 'LOAD_FAILED'); assert.equal(f.records[0][1].error.message, 'Importing a module script failed.');
  assert.equal(f.calls.includes('save'), false); assert.equal(f.calls.includes('reload'), false);
  await f.run('mountCurrentScreen()'); assert.equal(f.root.children[0], card, 'queued publications do not create an endless failed mount loop');
  card.children[1].events.click(); await flush();
  assert.deepEqual(f.calls.filter(x => typeof x === 'string'), ['save', 'reload']);
});
test('generic scene errors remain generic and return only after successful explicit save', async () => {
  const f = fixture({ error: new Error('RAISING_CARE_HTTP_404') }); await f.run('mountCurrentScreen()');
  const card = f.root.children[0]; assert.equal(card.dataset.moduleLoadFailed, 'false');
  assert.equal(card.children[0].textContent, 'SCREEN_LOAD_ERROR');
  card.children[2].events.click(); await flush();
  assert.deepEqual(f.calls.filter(x => typeof x === 'string'), ['save', 'title']);
});
for (const [name, save] of [['unsaved', () => ({ phase: 'SAVE_FAILED' })], ['conflict', () => { throw new Error('CHAMPIONSHIP_MODERN_SAVE_CONFLICT'); }]]) {
  test(`${name} save blocks reload and title navigation`, async () => {
    const f = fixture({ save }); await f.run('mountCurrentScreen()'); const card = f.root.children[0];
    card.children[1].events.click(); await flush(); card.children[2].events.click(); await flush();
    assert.equal(f.calls.includes('reload'), false); assert.equal(f.calls.includes('title'), false);
    assert.equal(card.children[0].textContent, 'FIELD_LOAD_SAVE_FAILED');
    assert.equal(card.children[1].disabled, false);
  });
}
test('disposed recovery cannot save or navigate; click duplication is guarded', async () => {
  const f = fixture(); await f.run('mountCurrentScreen()'); const card = f.root.children[0];
  f.run('view.dispose()'); card.children[1].events.click(); await flush(); assert.equal(f.calls.includes('save'), false);
  const g = fixture(); await g.run('mountCurrentScreen()'); const reload = g.root.children[0].children[1];
  reload.events.click(); reload.events.click(); await flush(); assert.equal(g.calls.filter(x => x === 'reload').length, 1);
});
test('Raising scene error prioritizes explicit document reload only for module failures', () => {
  assert.match(main, /show\('error', moduleFailed \? 'MODULE_LOAD_ERROR'/);
  assert.match(main, /if \(moduleFailed\) \{[\s\S]*?retry.hidden = true; reloadGame.hidden = false;[\s\S]*?status.insertBefore\(reloadGame, retry\)/);
  assert.match(main, /delete status.dataset.moduleLoadFailed/);
});
test('all five locale dictionaries contain both recovery messages', () => {
  for (const locale of ['', '.en', '.ja', '.th', '.vi']) {
    const text = readFileSync(new URL(`../src/championship/text/uiText${locale}.js`, import.meta.url), 'utf8');
    for (const key of ['MODULE_LOAD_ERROR', 'SCREEN_LOAD_ERROR']) assert.match(text, new RegExp(`"${key}": "[^"\\n]+"`));
  }
});
test('an obsolete failing route does not replace the newly selected screen with its error', async () => {
  const f = fixture();
  let current = 'RAISING_HOME';
  f.context.app.getScreen = () => current;
  f.context.mountRaisingHome = async () => { current = 'SHOP'; throw new TypeError('Importing a module script failed.'); };
  f.context.createShopView = async () => ({ isPlayable: true, render() {}, dispose() {} });
  f.context.syncMusic = () => {};
  f.context.performance = { now: () => 1 };
  f.context.screenChangedAt = 0;
  f.context.systemBackgrounds.enter = () => {};
  await f.run('mountCurrentScreen()');
  assert.equal(f.run('mountedScreen'), 'SHOP'); assert.equal(f.run('view.isPlayable'), true);
  assert.equal(f.root.children.length, 0); assert.equal(f.calls.includes('save'), false);
});
test('returning to a disposed route during a rejected load remounts it rather than leaving a blank ready screen', async () => {
  const f = fixture(); let current = 'RAISING_HOME', disposed = 0, remounted = 0;
  f.context.app.getScreen = () => current;
  f.context.oldView = { dispose: () => { disposed++; } };
  f.run("mountedScreen = 'SHOP'; view = oldView;");
  f.context.mountRaisingHome = async () => {
    assert.equal(f.run('mountedScreen'), null);
    current = 'SHOP'; throw new TypeError('Failed to fetch dynamically imported module: old.js');
  };
  f.context.createShopView = async () => { remounted++; return { isPlayable: true, render() {}, dispose() {} }; };
  f.context.syncMusic = () => {}; f.context.performance = { now: () => 1 }; f.context.screenChangedAt = 0;
  f.context.systemBackgrounds.enter = () => {};
  await f.run('mountCurrentScreen()');
  assert.equal(disposed, 1); assert.equal(remounted, 1);
  assert.equal(f.run('mountedScreen'), 'SHOP'); assert.equal(f.run('view.isPlayable'), true);
  assert.equal(f.root.children.length, 0);
});

test('unsupported or lifecycle-blocked save routes cannot write or navigate from recovery', async () => {
  const f = fixture(); f.context.safeSaveRoute = () => null;
  await f.run('mountCurrentScreen()'); const card = f.root.children[0];
  card.children[1].events.click(); await flush(); card.children[2].events.click(); await flush();
  assert.equal(f.calls.includes('save'), false); assert.equal(f.calls.includes('reload'), false); assert.equal(f.calls.includes('title'), false);
  assert.equal(card.children[0].textContent, 'FIELD_LOAD_SAVE_FAILED');
});
