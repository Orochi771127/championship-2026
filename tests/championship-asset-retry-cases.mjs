// EXTERNAL_ASSET_RETRY_20261118: a passing fault of the asset host (a 503, a dropped request) is tried again
// before a scene is told its art failed. Found by answering 503 once to every character asset in a browser:
// the ranch showed 「夥伴外觀載入失敗」 and needed its retry key pressed several times.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {ASSET_RETRY_WAITS_MS, loadWithRetry, retryingFetch} from '../src/championship/presentation/assetRetry.js';
import {createPixiAssetScope} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const noWait = {pause: async () => {}};
const failing = (times, value = 'ok', error = new Error('DROPPED')) => { let calls = 0; const run = async () => { calls++; if (calls <= times) throw error; return value; }; run.calls = () => calls; return run; };

test('a load is tried three times in all, with the two waits in order', async () => {
  assert.deepEqual([...ASSET_RETRY_WAITS_MS], [400, 1200]);
  const waited = [], pause = async ms => { waited.push(ms); };
  const twice = failing(2);
  assert.equal(await loadWithRetry(twice, {pause}), 'ok');
  assert.deepEqual([twice.calls(), waited], [3, [400, 1200]]);
  const thrice = failing(3);
  await assert.rejects(loadWithRetry(thrice, noWait), /DROPPED/);
  assert.equal(thrice.calls(), 3, 'the fourth is the scene\'s own retry key');
  const fine = failing(0);
  assert.equal(await loadWithRetry(fine, noWait), 'ok'); assert.equal(fine.calls(), 1);
});

test('an aborted load is never tried again', async () => {
  const abort = Object.assign(new Error('aborted'), {name: 'AbortError'});
  const aborted = failing(5, 'ok', abort);
  await assert.rejects(loadWithRetry(aborted, noWait), {name: 'AbortError'});
  assert.equal(aborted.calls(), 1);
  const controller = new AbortController(), dropped = failing(5);
  await assert.rejects(loadWithRetry(dropped, {signal: controller.signal, pause: async () => { controller.abort(new Error('LEFT')); }}), /LEFT/);
  assert.equal(dropped.calls(), 1, 'the scope was left during the wait');
  controller.abort();
  const later = failing(5);
  await assert.rejects(loadWithRetry(later, {signal: controller.signal, ...noWait}), /DROPPED/);
  assert.equal(later.calls(), 1);
});

test('fetch: a 5xx is tried again, a 4xx is final, and the last answer comes back as it is', async () => {
  const answers = list => { let i = 0; const f = async () => list[Math.min(i++, list.length - 1)]; f.calls = () => i; return f; };
  const ok = {status: 200, ok: true}, busy = {status: 503, ok: false}, gone = {status: 404, ok: false};
  let f = answers([busy, ok]);
  assert.equal(await retryingFetch('u', undefined, {fetchImpl: f, ...noWait}), ok); assert.equal(f.calls(), 2);
  f = answers([gone, ok]);
  assert.equal(await retryingFetch('u', undefined, {fetchImpl: f, ...noWait}), gone); assert.equal(f.calls(), 1, 'the host meant it');
  f = answers([busy]);
  assert.equal(await retryingFetch('u', undefined, {fetchImpl: f, ...noWait}), busy, 'the caller\'s own response.ok check still speaks');
  assert.equal(f.calls(), 3);
  let calls = 0;
  await assert.rejects(retryingFetch('u', undefined, {fetchImpl: async () => { calls++; throw new TypeError('Failed to fetch'); }, ...noWait}), /Failed to fetch/);
  assert.equal(calls, 3);
  const seen = [];
  await retryingFetch('u', {signal: null, cache: 'no-store'}, {fetchImpl: async (input, init) => { seen.push([input, init.cache]); return ok; }, ...noWait});
  assert.deepEqual(seen, [['u', 'no-store']], 'the request is passed through unchanged');
});

test('every load of a Pixi asset scope is tried again, and a load that keeps failing still clears its entry', async () => {
  let calls = 0;
  const PIXI = {Assets: {load: async src => { calls++; if (calls <= 2) throw new Error('HTTP_503'); return {src}; }, unload: async () => {}}};
  const scope = createPixiAssetScope(PIXI, 'http://127.0.0.1/', {retryWaits: [0, 0]});
  const loaded = await scope.Assets.load('a.webp');
  assert.deepEqual([loaded.src, calls], ['http://127.0.0.1/a.webp', 3]);
  calls = -99; // keeps failing
  const broken = {Assets: {load: async () => { throw new Error('HTTP_503'); }, unload: async () => {}}};
  const second = createPixiAssetScope(broken, 'http://127.0.0.1/', {retryWaits: [0, 0]});
  await assert.rejects(second.Assets.load('b.webp'), /HTTP_503/);
  await assert.rejects(second.Assets.load('b.webp'), /HTTP_503/, 'a later explicit retry asks again instead of reading a poisoned entry');
});

test('the character loaders that fetch by themselves go through the same rule', () => {
  assert.match(source('src/championship/presentation/publicCharacterRoster.js'), /fetchImpl=\(\.\.\.args\)=>retryingFetch\(\.\.\.args\)/);
  assert.match(source('src/championship/presentation/publicHudManifestCache.js'), /retryingFetch\(url,undefined,\{fetchImpl\}\)/);
  const bundle = source('src/championship/presentation/pixiCharacterRuntimeBundle.js');
  assert.match(bundle, /loadWithRetry\(\(\) => assets\.load\(entry\.source\), \{ signal, waits: retryWaits \}\)/);
  assert.match(bundle, /if\(answer\.status>=500\)throw Error\('CHARACTER_STREAMING_METADATA_HTTP_'\+answer\.status\);return answer;\},\{signal\}\);/);
});
