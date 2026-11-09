import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createLoadAttempt, LOAD_MAX_MS} from '../src/championship/app/loadWatchdog.js';

// Exercise the shipped lifecycle with controlled async loaders and disposable
// handles. These tests make no browser, network, GPU, or physical-device claim.
const source = readFileSync(new URL('../src/championship/app/dataArenaScreen.js', import.meta.url), 'utf8');
function extract(start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'The tested lifecycle source must be present');
  return source.slice(first, last);
}
const functions = extract('  async function loadCast(', '\n  function mountScene()')
  + extract('  let startingMatch = false;', '  // ------------------------------------------------------------------ overlays')
  + extract('  let closed = false;', '\n  if (qa) {');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

function fixture({loads = {}, hangingDisposals = []} = {}) {
  const calls = {requests: [], resources: [], mounts: 0, added: 0, removed: 0, exits: 0, panels: [], errors: [], warnings: []};
  const lifetime = new AbortController(), timers = new Set(), listeners = new Set();
  const node = (tag = 'div', className = '', text = '') => ({
    tag, className, text, dataset: {}, children: [], attributes: {}, removed: false,
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); return child; },
    remove() { this.removed = true; }
  });
  const makeResource = kind => {
    const value = {kind, id: kind + ':' + calls.resources.length, disposals: 0,
      dispose() { this.disposals++; return hangingDisposals.includes(kind) ? new Promise(() => {}) : Promise.resolve(); }};
    calls.resources.push(value);
    return value;
  };
  const stage = {PIXI: {}, app: {renderer: {}, ticker: {
    add(callback) { assert.equal(listeners.has(callback), false, 'never add the same arena ticker twice'); listeners.add(callback); calls.added++; },
    remove(callback) { listeners.delete(callback); calls.removed++; }
  }}, disposals: 0, dispose() { this.disposals++; }, setResolutionCap() {}};
  const load = (kind, options) => {
    const resource = kind === 'stage' ? stage : makeResource(kind);
    calls.requests.push({kind, resource, options});
    return loads[kind] ? loads[kind](resource, options) : Promise.resolve(resource);
  };
  const castMember = (speciesId, partnerId = 'relay-' + speciesId) => ({speciesId, partnerId, art: {speciesId}});
  const cast = {
    partners: ['species-047', 'species-034', 'species-064', 'species-113'].map(id => castMember(id)),
    rivals: ['species-047', 'species-113', 'species-102'].map(id => castMember(id, null))
  };
  const root = node();
  const env = {
    lifetime, signal: lifetime.signal, root, field: {}, cast, stage: null, scene: null, environment: null, interactionArt: null,
    qaRecentEvents: [], qa: false, bundles: new Map(), bundleScope: null, tickerCallback: null,
    audio: null, sim: null, result: null, paused: false, qualityReloading: false, accumulator: 0, cutIn: null,
    partnerId: 'relay-species-047', partnerPower: {}, relayReserveId: null, relayThirdId: null, relayArenaId: 1, relayLoadouts: {},
    relayTeamIds: id => [id], relayBurstMembers: () => [], burstFormsFor: () => [], relayBurstPlanOf: () => undefined,
    gameMode: 'RELAY', quality: 'low', resolutionCap: 2, href: 'http://localhost/championship.html', sponsor: null, staked: null,
    matchId: 0, seed: 1, audioBus: null, bannerTimer: null, vignetteTimer: null, LOAD_MAX_MS, clearTimeout,
    createLoadAttempt(options) {
      return createLoadAttempt({...options,
        setTimer(fn, ms) { const timer = {fn, ms}; timers.add(timer); return timer; },
        clearTimer(timer) { timers.delete(timer); }
      });
    },
    el: node, t: key => key,
    button(className, text, onClick) { return {...node('button', className, text), onClick}; },
    showOverlay(panel) { calls.panels.push(panel); },
    showSelect() { root.dataset.state = 'SELECT'; },
    hideOverlay() {}, releaseInputs() {}, buildHud() {}, frame() {}, handleEvents() {}, tactical() {}, banner() {},
    ensureStage: (_host, signal) => load('stage', {signal}),
    createPixiAssetScope: PIXI => PIXI,
    loadDataArenaCharacter: options => load('character', options),
    loadDataArenaEnvironment: options => load('environment', options),
    loadDataArenaInteractionArt: options => load('interaction', options),
    loadOriginalVfxCellArt: options => load('effects', options),
    createDataArenaSimulation: () => ({grid: {map: {}}, drainEvents: () => []}),
    createDataArenaAudio: () => makeResource('audio'),
    mountScene() { calls.mounts++; env.scene = makeResource('scene'); },
    selectDataArenaMusic: () => 'arena', music: {setScene() {}},
    document: {documentElement: {classList: {remove() {}}}},
    onExit() { calls.exits++; },
    console: {error(...args) { calls.errors.push(args); }, warn(...args) { calls.warnings.push(args); }}
  };
  runInNewContext(functions, env);
  return {env, calls, stage, timers, listeners,
    action(label) {
      const panel = calls.panels.at(-1);
      const actions = panel.children.find(child => child.className === 'da-actions');
      return actions?.children.find(child => child.text === label);
    },
    expire() {
      assert.equal(timers.size, 1, 'one attempt deadline');
      const [timer] = timers; timers.delete(timer);
      assert.equal(timer.ms, LOAD_MAX_MS, 'reuse the product hard loading ceiling');
      timer.fn();
    },
    resources(kind) { return calls.resources.filter(value => value.kind === kind); }
  };
}

for (const kind of ['stage', 'character', 'environment', 'interaction', 'effects']) {
  test('arena deadline recovers a pending ' + kind + ' loader and disposes late owned success', async () => {
    const gate = deferred();
    let pendingResource;
    const f = fixture({loads: {[kind](resource) { pendingResource ??= resource; return resource === pendingResource ? gate.promise : Promise.resolve(resource); }}});
    const run = f.env.startMatch();
    await flush();
    assert.equal(f.env.root.dataset.state, 'LOADING');
    assert.ok(f.action('loading.cancel'));
    assert.ok(f.action('select.back'));
    f.expire();
    await run;
    assert.equal(f.env.root.dataset.state, 'ERROR');
    assert.equal(f.calls.panels.at(-1).children[1].text, 'loading.timeout');
    assert.ok(f.action('result.retry'));
    assert.ok(f.action('select.back'));
    assert.equal(f.calls.mounts, 0);
    assert.equal(f.listeners.size, 0);
    gate.resolve(pendingResource);
    await flush();
    assert.equal(pendingResource.disposals, kind === 'stage' ? 0 : 1, 'the shared stage is never owned by an arena attempt');
    assert.equal(f.calls.mounts, 0);
    assert.equal(f.env.root.dataset.state, 'ERROR');
    assert.equal(f.timers.size, 0);
    await f.env.close();
    assert.equal(pendingResource.disposals, kind === 'stage' ? 0 : 1, 'closing after timeout cannot dispose a late result twice');
  });
}

test('cancel then immediately retry survives old late completion without clearing the new scene', async () => {
  const gate = deferred();
  let oldResource, blocked = false;
  const f = fixture({loads: {character(resource, {art}) {
    if (!blocked && art.speciesId === 'species-047') { blocked = true; oldResource = resource; return gate.promise; }
    return Promise.resolve(resource);
  }}});
  const first = f.env.startMatch();
  await flush();
  f.action('loading.cancel').onClick();
  assert.equal(f.env.root.dataset.state, 'SELECT');
  const retry = f.env.startMatch();
  await retry;
  assert.equal(f.env.root.dataset.state, 'PLAY');
  const newScene = f.env.scene, newBundle = f.env.bundles.get('species-047');
  gate.resolve(oldResource);
  await first; await flush();
  assert.equal(f.env.root.dataset.state, 'PLAY');
  assert.equal(f.env.scene, newScene);
  assert.equal(f.env.bundles.get('species-047'), newBundle);
  assert.equal(newScene.disposals, 0);
  assert.equal(newBundle.disposals, 0);
  assert.equal(oldResource.disposals, 1);
  assert.equal(f.calls.mounts, 1);
  assert.equal(f.listeners.size, 1);
  assert.equal(f.stage.disposals, 0);
  await f.env.close();
  assert.ok(f.calls.resources.every(value => value.disposals === 1), 'every created owned resource is eventually disposed once');
  assert.equal(f.listeners.size, 0);
});

test('an already cancelled cast continuation cannot retire a newer attempt bundle or start another load', async () => {
  const f = fixture();
  const newerBundle = {disposals: 0, dispose() { this.disposals++; }};
  f.env.bundles.set('species-034', newerBundle);
  const owner = createLoadAttempt({setTimer: () => 0, clearTimer() {}});
  owner.cancel();
  await assert.rejects(f.env.loadCast('relay-species-047', owner), {name: 'AbortError'});
  assert.equal(f.env.bundles.get('species-034'), newerBundle);
  assert.equal(newerBundle.disposals, 0);
  assert.equal(f.calls.requests.length, 0);
  await f.env.close();
  assert.equal(newerBundle.disposals, 1);
});

test('leaving during pending VFX does not await the load, and its late rejection is consumed', async () => {
  const gate = deferred();
  const f = fixture({loads: {effects: () => gate.promise}});
  const run = f.env.startMatch();
  await flush();
  await f.action('select.back').onClick();
  await flush();
  assert.equal(f.env.root.removed, true);
  assert.equal(f.calls.exits, 1);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.timers.size, 0);
  const panelCount = f.calls.panels.length;
  gate.reject(new Error('late VFX rejection after exit'));
  await run; await flush();
  assert.equal(f.calls.panels.length, panelCount);
  assert.equal(f.calls.mounts, 0);
  assert.equal(f.calls.exits, 1);
});

test('leaving during pending VFX disposes a late success exactly once without remounting', async () => {
  const gate = deferred();
  let pending;
  const f = fixture({loads: {effects(resource) { pending = resource; return gate.promise; }}});
  const run = f.env.startMatch();
  await flush();
  await f.env.close();
  assert.equal(f.calls.exits, 1);
  assert.equal(f.env.root.removed, true);
  gate.resolve(pending);
  await run; await flush();
  await f.env.close();
  assert.equal(pending.disposals, 1);
  assert.equal(f.calls.mounts, 0);
  assert.equal(f.calls.exits, 1);
});

test('cancelling remains responsive even when a completed bundle unload never finishes', async () => {
  const gate = deferred();
  const f = fixture({loads: {environment: () => gate.promise}, hangingDisposals: ['character']});
  const run = f.env.startMatch();
  await flush();
  f.action('loading.cancel').onClick();
  await run;
  assert.equal(f.env.root.dataset.state, 'SELECT');
  assert.equal(f.env.bundles.size, 0);
  assert.ok(f.resources('character').every(value => value.disposals === 1));
  await f.env.close();
  assert.equal(f.env.root.removed, true);
  assert.equal(f.calls.exits, 1);
});

test('same species across partner, burst forms and rival loads once; successful retries reuse the bundle', async () => {
  const f = fixture();
  f.env.relayBurstMembers = () => [f.env.cast.partners.find(member => member.speciesId === 'species-113')];
  f.env.burstFormsFor = () => [{tier: 1, form: 113}];
  await f.env.startMatch();
  assert.equal(f.env.root.dataset.state, 'PLAY');
  assert.deepEqual(f.calls.requests.filter(call => call.kind === 'character').map(call => call.options.art.speciesId).sort(),
    ['species-047', 'species-102', 'species-113']);
  const firstBundles = [...f.env.bundles.values()];
  for (let index = 0; index < 3; index++) await f.env.startMatch();
  assert.equal(f.resources('character').length, 3);
  assert.ok(firstBundles.every(bundle => bundle.disposals === 0));
  assert.equal(f.resources('effects').length, 1, 'keep completed VFX across ordinary matches');
  assert.equal(f.listeners.size, 1);
  assert.equal(f.calls.added, 4);
  assert.equal(f.calls.removed, 3);
  await f.env.close(); await f.env.close();
  assert.ok(f.calls.resources.every(value => value.disposals === 1));
  assert.equal(f.calls.exits, 1);
  assert.equal(f.stage.disposals, 0);
});

test('changing the relay partner releases only the removed species and keeps shared rivals', async () => {
  const f = fixture();
  f.env.partnerId = 'relay-species-034';
  await f.env.startMatch();
  const oldPartner = f.env.bundles.get('species-034'), sharedRival = f.env.bundles.get('species-047');
  f.env.partnerId = 'relay-species-064';
  await f.env.startMatch();
  assert.equal(oldPartner.disposals, 1);
  assert.equal(sharedRival.disposals, 0);
  assert.equal(f.env.bundles.has('species-034'), false);
  assert.ok(f.env.bundles.has('species-064'));
  assert.equal(f.env.bundles.get('species-047'), sharedRival);
  await f.env.close();
  assert.ok(f.calls.resources.every(value => value.disposals === 1));
});
