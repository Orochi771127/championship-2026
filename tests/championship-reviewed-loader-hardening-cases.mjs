import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { attachReviewedCharacterAnimation, reviewedDecodeConcurrency } from '../src/championship/presentation/reviewedCharacterLoader.js';

const root = path.resolve(import.meta.dirname, '..');
const selection = JSON.parse(fs.readFileSync(path.join(root, 'src/data/championship/reviewed-animation-selection.v1.json'), 'utf8'));

test('reviewedDecodeConcurrency caps parallel atlas decodes to 2 on constrained mobile devices and 4 on desktop', () => {
  assert.equal(reviewedDecodeConcurrency(8, { constrained: true }), 2);
  assert.equal(reviewedDecodeConcurrency(8, { constrained: false }), 4);
  assert.equal(reviewedDecodeConcurrency(1, { constrained: false }), 1);
});

test('attachReviewedCharacterAnimation uses blob single-fetch decode in browser environment and revokes blob URLs on dispose', async () => {
  const entry = selection.characters.find((c) => c.displayCode === 'GR02') ?? selection.characters[0];
  let fetchCount = 0;
  const loadedInputs = [];
  const unloadedInputs = [];
  const createdBlobs = [];
  const revokedBlobs = [];

  const fileFetch = async (url) => {
    fetchCount++;
    const bytes = fs.readFileSync(path.join(root, new URL(url).pathname));
    return {
      ok: true,
      status: 200,
      text: async () => bytes.toString(),
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    };
  };

  const prevDoc = globalThis.document;
  const prevCreate = URL.createObjectURL;
  const prevRevoke = URL.revokeObjectURL;
  globalThis.document = { documentElement: { dataset: { quality: 'saver' } } };
  URL.createObjectURL = (blob) => {
    const id = `blob:test/${createdBlobs.length + 1}`;
    createdBlobs.push({ id, type: blob.type, size: blob.size });
    return id;
  };
  URL.revokeObjectURL = (id) => { revokedBlobs.push(id); };

  try {
    const sources = [];
    const PIXI = {
      Rectangle: class { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } },
      Texture: class { constructor(o) { Object.assign(this, o); } destroy() {} },
      Assets: {
        async load(input) {
          loadedInputs.push(input);
          const source = { pixelWidth: 4096, pixelHeight: 4096, resolution: 1, scaleMode: 'nearest', autoGenerateMipmaps: false };
          sources.push(source);
          return { source };
        },
        async unload(input) { unloadedInputs.push(input); }
      }
    };
    const baseline = {
      runtime: { sides: { main: { animations: [{ id: 0, playbackMode: 2, frames: [{ ticks: 60 }] }] }, sub: { animations: [] } } },
      getDiagnostics: () => ({}),
      async dispose() {},
      createActor() { return { sprite: { texture: {}, anchor: { set() {} } }, controller: { setAnimation() {}, getSnapshot: () => null } }; }
    };

    const bundle = await attachReviewedCharacterAnimation({
      bundle: baseline,
      PIXI,
      speciesId: entry.speciesId,
      usage: 'general',
      baseUrl: 'http://127.0.0.1:8773/championship.html',
      fetchImpl: fileFetch
    });

    assert.ok(fetchCount >= 2, 'manifest + at least 1 image fetched once');
    assert.ok(createdBlobs.length >= 1, 'verified bytes passed to Pixi via Blob URL instead of re-fetching');
    for (const input of loadedInputs) {
      assert.equal(typeof input, 'object');
      assert.ok(input.src.startsWith('blob:test/'), `expected blob URL load, got ${input.src}`);
      assert.equal(input.parser, 'texture');
    }
    // Under saver quality, autoGenerateMipmaps stays false to avoid +33% GPU VRAM overhead.
    for (const source of sources) assert.equal(source.autoGenerateMipmaps, false);

    await bundle.dispose();
    assert.equal(revokedBlobs.length, createdBlobs.length, 'every created blob URL is revoked on dispose');
    assert.equal(unloadedInputs.length, createdBlobs.length, 'every blob texture is unloaded from Pixi on dispose');
  } finally {
    if (prevDoc === undefined) delete globalThis.document; else globalThis.document = prevDoc;
    URL.createObjectURL = prevCreate;
    URL.revokeObjectURL = prevRevoke;
  }
});

test('reviewedCharacterLoader uses retryingFetch by default for transient mobile network recovery', () => {
  const src = fs.readFileSync(path.join(root, 'src/championship/presentation/reviewedCharacterLoader.js'), 'utf8');
  assert.match(src, /import\s*\{\s*retryingFetch\s*\}\s*from\s*['"]\.\/assetRetry\.js['"]/);
  assert.match(src, /defaultFetch\s*=\s*\(\.\.\.args\)\s*=>\s*retryingFetch\(\.\.\.args\)/);
  assert.match(src, /fetchImpl\s*=\s*defaultFetch/);
});
