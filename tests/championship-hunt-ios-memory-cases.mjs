// Owner 2026-11-12 (iPhone, home-screen app): entering 戴納草原 flashed white and the app
// reloaded -- iOS ended the page for memory. The day field of hm01 is three 2880 x 2880 images
// (two colour frames and their coverage mask). Each stayed decoded (31.6 MB apiece) beside its
// uploaded copy for the whole hunt: 95 MB that nothing reads once the textures are on the GPU.
// The other fourteen maps keep about 8 MB. These cases hold the release to "after a proven upload".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadExternalMapAssets} from '../src/championship/presentation/vs2/huntThree/externalMapAssets.mjs';

const directory = new URL('../assets/production/hunt/hm01-three-r1-20261022/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', directory), 'utf8'));
const source = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

/** The loader's own collaborators, reduced to what it calls. Asset bytes are the real published files. */
async function loadDayField() {
  const closed = [], bitmaps = [];
  const THREE = {REVISION: '185', SRGBColorSpace: 'srgb', NoColorSpace: '', LinearFilter: 1006, DoubleSide: 2,
    LoadingManager: class { setURLModifier() {} },
    Texture: class { constructor(image) { this.image = image; this.version = 0; } set needsUpdate(value) { if (value) this.version++; } },
    MeshBasicMaterial: class { constructor(options) { Object.assign(this, options); } }};
  class DRACOLoader {
    constructor() { this.workerPool = []; this.workerSourceURL = ''; }
    setDecoderPath() { return this; } setWorkerLimit() { return this; } setDecoderConfig() {}
    _initDecoder() { return Promise.resolve(); } _getWorker() { return Promise.resolve(null); } dispose() {}
  }
  const meshes = manifest.glb.meshes.map(m => ({isMesh: true, name: m.node, userData: {webCategory: m.category}, material: null}));
  class GLTFLoader {
    setDRACOLoader() { return this; }
    parseAsync() { return Promise.resolve({scene: {traverse(visit) { for (const mesh of meshes) visit(mesh); }}}); }
  }
  const previous = {fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap};
  globalThis.fetch = async url => {
    const bytes = fs.readFileSync(new URL(String(url).split('/').pop(), directory));
    return {ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)};
  };
  globalThis.createImageBitmap = async () => {
    const bitmap = {width: 2880, height: 2880, close() { closed.push(bitmap); this.width = this.height = 0; }};
    bitmaps.push(bitmap); return bitmap;
  };
  try {
    const assets = await loadExternalMapAssets({THREE, GLTFLoader, DRACOLoader, manifest, fieldId: 'field_hm01_01',
      dracoDecoderPath: 'https://example.test/node_modules/three/examples/jsm/libs/draco/',
      baseUrl: 'https://example.test/assets/production/hunt/hm01-three-r1-20261022/',
      signal: new AbortController().signal, disposer: {gltf() {}, texture() {}, once() {}}});
    return {assets, closed, bitmaps, meshes};
  } finally { Object.assign(globalThis, previous); }
}

test('the day field of hm01 decodes three 2880 x 2880 images and frees each one only after its upload is proven', async () => {
  const {assets, closed, bitmaps, meshes} = await loadDayField();
  const frame = 2880 * 2880 * 4;
  assert.equal(assets.textures.length, 3, 'two colour frames and one shared coverage mask');
  assert.equal(assets.stats.decodedTextureBytes, 3 * frame);
  assert.equal(assets.stats.releasedDecodedBytes, 0);
  assert.ok(meshes.every(mesh => mesh.material), 'every mesh received a field material');

  // Nothing uploaded yet: every bitmap stays, so the first upload still has its pixels.
  assert.equal(assets.releaseDecodedFrames(() => false), 3);
  assert.equal(closed.length, 0);

  // One texture uploaded: only its own bitmap goes.
  const [first] = assets.textures;
  assert.equal(assets.releaseDecodedFrames(texture => texture === first), 2);
  assert.deepEqual(closed, [first.image]);
  assert.equal(assets.stats.releasedDecodedBytes, frame);

  // A truthy value that is not `true` is not proof.
  assert.equal(assets.releaseDecodedFrames(() => 1), 2);
  assert.equal(closed.length, 1);

  assert.equal(assets.releaseDecodedFrames(() => true), 0);
  assert.equal(closed.length, 3);
  assert.deepEqual(new Set(closed), new Set(bitmaps));
  assert.equal(assets.stats.releasedDecodedBytes, 3 * frame, '95 MB of decoded frames returned');

  // Asking again closes nothing twice, and the phase switch still works on the uploaded textures.
  assert.equal(assets.releaseDecodedFrames(() => true), 0);
  assert.equal(closed.length, 3);
  assets.selectPhase(1);
  assert.equal(meshes.find(mesh => mesh.userData.webCategory === 'standable_ground').material.map, assets.textures[2]);
  assert.throws(() => assets.selectPhase(2), /HUNT_THREE_NATIVE_PHASE_OUT_OF_RANGE/);
});

test('the map releases decoded frames right after its one upload pass, proven per texture against the renderer', () => {
  const map = source('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs');
  const upload = map.indexOf('for(const texture of external.textures)renderer.initTexture(texture);');
  const release = map.indexOf('external.releaseDecodedFrames?.(');
  assert.ok(upload > 0 && release > upload, 'release follows the upload pass');
  assert.ok(release - upload < 400, 'and nothing else runs between them');
  assert.match(map, /const held=renderer\.properties\.get\(texture\);return Boolean\(held\.__webglTexture\)&&held\.__version===texture\.version;/);
  // A lost context retires the map to 2D; it never re-uploads from a bitmap that is gone.
  assert.match(map, /offLost=stage\.onContextLost\(\(\)=>fail\(new Error\('HM02_CONTEXT_LOST_USE_2D'\)\)\);/);
  // Whatever is still decoded at exit is closed by the texture disposer, as before.
  const lifecycle = source('src/championship/presentation/vs2/huntThree/lifecycle.mjs');
  assert.match(lifecycle, /if\(image&&typeof image\.close==='function'&&!disposed\.has\(image\)\)\{disposed\.add\(image\);attempt\(\(\)=>image\.close\(\)\);\}/);
});

test('a Hunt entry writes its own steps to the diagnostics, in order', () => {
  const main = source('src/championship/app/main.js');
  const mount = main.slice(main.indexOf('async function mountHuntField() {'), main.indexOf('// --- VS5 Auto Battle'));
  const steps = ["huntLoad('engine', 'start');", "huntLoad('partners', ", "huntLoad('arena', 'start');",
    "huntLoad('arena', threePilot ? 'done' : 'error', { map: threePilot ? 'THREE' : 'FLAT' });", "huntLoad('scene', 'start');", "huntLoad('ready');"];
  let at = 0;
  for (const step of steps) { const next = mount.indexOf(step, at); assert.ok(next > at, step); at = next; }
  assert.match(mount, /recoveryDiagnostics\.record\('LOAD', \{ area: 'hunt', stage,/);
  assert.match(main, /recoveryDiagnostics\.record\("AUTO_RESUME", \{ target: activeCheckpoint\.screen \}\);/);
});
