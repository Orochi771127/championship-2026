import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixiAssetScope } from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';

const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const base = 'https://game.invalid/championship.html';

test('an abandoned download cannot unload the replacement scene texture', async () => {
  const download = deferred(), calls = [];
  const PIXI = { Assets: { load: src => { calls.push(['load', src]); return download.promise; },
    unload: src => calls.push(['unload', src]) } };
  const old = createPixiAssetScope(PIXI, base), next = createPixiAssetScope(PIXI, base);
  const pending = old.Assets.load('hero.png');
  const replacement = next.Assets.load('https://game.invalid/hero.png');
  await old.Assets.unload('hero.png');
  download.resolve({ alive: true });
  assert.equal(await pending, await replacement);
  assert.deepEqual(calls, [['load', 'https://game.invalid/hero.png']]);
  await next.Assets.unload('hero.png');
  await next.Assets.unload('hero.png');
  assert.equal(calls.filter(([op]) => op === 'unload').length, 1);
});

test('reentry during final disposal waits for fresh pixels instead of returning a destroyed cache value', async () => {
  const disposal = deferred(); let loads = 0;
  const PIXI = { Assets: { load: () => ({ generation: ++loads }), unload: () => disposal.promise } };
  const old = createPixiAssetScope(PIXI, base), next = createPixiAssetScope(PIXI, base);
  assert.equal((await old.Assets.load('map.png')).generation, 1);
  const releasing = old.Assets.unload('map.png');
  const pending = next.Assets.load('map.png');
  await Promise.resolve(); assert.equal(loads, 1);
  disposal.resolve(); await releasing;
  assert.equal((await pending).generation, 2);
  await next.Assets.unload('map.png');
});

test('a failed download releases ownership and a later entry can retry', async () => {
  let attempts = 0, unloads = 0;
  const PIXI = { Assets: { load: async () => { if (++attempts === 1) throw new Error('offline'); return 'ready'; },
    unload: () => unloads++ } };
  const old = createPixiAssetScope(PIXI, base);
  await assert.rejects(old.Assets.load('map.png'), /offline/);
  const next = createPixiAssetScope(PIXI, base);
  assert.equal(await next.Assets.load('map.png'), 'ready');
  await old.Assets.unload('map.png');
  await next.Assets.unload('map.png');
  assert.equal(unloads, 1);
});

test('one bundle owns a repeated URL once and preserves an explicit parser', async () => {
  const calls = [];
  const PIXI = { Assets: { load: descriptor => { calls.push(descriptor); return {}; }, unload: src => calls.push(src) } };
  const scope = createPixiAssetScope(PIXI, base);
  assert.equal(await scope.Assets.load({ src: 'atlas.json', parser: 'json' }), await scope.Assets.load('atlas.json'));
  await scope.Assets.unload('atlas.json');
  assert.deepEqual(calls, [{ src: 'https://game.invalid/atlas.json', parser: 'json' }, 'https://game.invalid/atlas.json']);
});
