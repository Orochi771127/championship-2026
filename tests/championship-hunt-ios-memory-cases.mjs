// Owner 2026-11-12 (iPhone, home-screen app): entering 戴納草原 flashed white and the app
// reloaded -- iOS ended the page for memory. The day field of hm01 is three 2880 x 2880 images
// (two colour frames and their coverage mask). Each stayed decoded (31.6 MB apiece) beside its
// uploaded copy for the whole hunt: 95 MB that nothing reads once the textures are on the GPU.
// The other fourteen maps keep about 8 MB. These cases hold the release to "after a proven upload".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../node_modules/three/build/three.module.js';
import {loadExternalMapAssets} from '../src/championship/presentation/vs2/huntThree/externalMapAssets.mjs';
import {isMobileOrInstalledWebApp} from '../src/championship/app/webAppInstall.js';
import {CHAMPIONSHIP_SESSION_CHECKPOINT_TTL_MS} from '../src/championship/app/ChampionshipPersistentSavePort.js';
import {createLicensedVfxRuntime, validateLicensedVfxRuntimeManifest} from '../src/championship/presentation/vfx/licensedVfxRuntimeBundle.js';

const directory = new URL('../assets/production/hunt/hm01-three-r1-20261022/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', directory), 'utf8'));
const source = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

/** The loader's own collaborators, reduced to what it calls. Asset bytes are the real published files. */
async function loadDayField(extra = {}) {
  const closed = [], bitmaps = [];
  const THREE = {REVISION: '185', SRGBColorSpace: 'srgb', NoColorSpace: '', LinearFilter: 1006, DoubleSide: 2,
    LoadingManager: class { setURLModifier() {} },
    Texture: class { constructor(image) { this.image = image; this.version = 0; } set needsUpdate(value) { if (value) this.version++; } },
    MeshBasicMaterial: class { constructor(options) { Object.assign(this, options); } }, ...extra};
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

// 2026-11-26 refinement batch 2: the coverage mask has one channel, so it is uploaded as R8.
test('the coverage mask goes to the GPU as one channel: 8.3 MB instead of 33.2 MB per mask', async () => {
  const frame = 2880 * 2880;
  const {assets, meshes} = await loadDayField({RedFormat: THREE.RedFormat, RGBAFormat: THREE.RGBAFormat, ShaderLib: THREE.ShaderLib});
  const [colourA, mask, colourB] = assets.textures;
  assert.equal(assets.stats.maskFormat, 'R8');
  assert.equal(mask.format, THREE.RedFormat);
  assert.equal(colourA.format, undefined, 'colour frames keep the default RGBA');
  assert.equal(colourB.format, undefined);
  assert.deepEqual(assets.maskTextures, [mask], 'day and second phase share one mask');
  assert.equal(assets.stats.gpuTextureBytes, 2 * frame * 4 + frame, '74.6 MB, was 99.5 MB');
  assert.equal(assets.stats.decodedTextureBytes, 3 * frame * 4, 'the decoded bitmaps are as before, and freed after upload');

  // Three's alpha map reads green; R8 has none, so the foreground material reads red.
  const foreground = meshes.find(mesh => mesh.userData.webCategory.startsWith('foreground')).material;
  assert.equal(foreground.alphaMap, mask);
  assert.equal(foreground.customProgramCacheKey(), 'hunt-coverage-mask-red');
  const shader = {fragmentShader: THREE.ShaderLib.basic.fragmentShader};
  foreground.onBeforeCompile(shader);
  assert.ok(!shader.fragmentShader.includes('#include <alphamap_fragment>'));
  assert.match(shader.fragmentShader, /diffuseColor\.a \*= texture2D\( alphaMap, vAlphaMapUv \)\.r;/);
  assert.match(THREE.ShaderChunk.alphamap_fragment, /texture2D\( alphaMap, vAlphaMapUv \)\.g;/, 'the stock chunk this replaces');
  const ground = meshes.find(mesh => mesh.userData.webCategory === 'standable_ground').material;
  assert.equal(ground.onBeforeCompile, undefined, 'the ground material is untouched');

  // A driver that refuses the compact upload gets the RGBA mask back; red still reads the grey picture.
  let disposed = 0; mask.dispose = () => { disposed++; };
  const before = mask.version;
  assert.deepEqual(assets.useRgbaMasks(), [mask]);
  assert.equal(mask.format, THREE.RGBAFormat);
  assert.equal(disposed, 1);
  assert.equal(mask.version, before + 1, 'marked for a fresh upload');
  assert.equal(assets.stats.maskFormat, 'RGBA8');
  assert.equal(assets.stats.gpuTextureBytes, 3 * frame * 4);
  assert.deepEqual(assets.useRgbaMasks(), [], 'asking twice changes nothing');
});

test('a Three build without the expected shader text keeps the RGBA mask and the stock alpha map', async () => {
  const {assets, meshes} = await loadDayField({RedFormat: THREE.RedFormat, RGBAFormat: THREE.RGBAFormat, ShaderLib: {basic: {fragmentShader: 'void main(){}'}}});
  assert.equal(assets.stats.maskFormat, 'RGBA8');
  assert.equal(assets.textures[1].format, undefined);
  assert.equal(meshes.find(mesh => mesh.userData.webCategory.startsWith('foreground')).material.onBeforeCompile, undefined);
  assert.equal(assets.stats.gpuTextureBytes, 3 * 2880 * 2880 * 4);
  assert.deepEqual(assets.useRgbaMasks(), []);
});

test('the map releases decoded frames right after its one upload pass, proven per texture against the renderer', () => {
  const map = source('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs');
  const upload = map.indexOf('for(const texture of external.textures)renderer.initTexture(texture);');
  const release = map.indexOf('external.releaseDecodedFrames?.(');
  assert.ok(upload > 0 && release > upload, 'release follows the upload pass');
  assert.ok(release - upload < 700, 'and only the mask fallback runs between them');
  const between = map.slice(upload, release);
  assert.match(between, /if\(external\.stats\?\.maskFormat==='R8'&&gl\.getError\(\)!==gl\.NO_ERROR\)for\(const texture of external\.useRgbaMasks\(\)\)renderer\.initTexture\(texture\);/);
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

test('iPhone Web App and Mobile Safari battle memory & auto-resume guards stay wired', async () => {
  assert.equal(CHAMPIONSHIP_SESSION_CHECKPOINT_TTL_MS, 1_800_000, 'checkpoint TTL covers 30-minute battle and Data Arena sessions');
  assert.equal(isMobileOrInstalledWebApp({ navigator: { standalone: true, userAgent: 'Mozilla/5.0' } }), true);
  assert.equal(isMobileOrInstalledWebApp({ navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15' } }), true);
  assert.equal(isMobileOrInstalledWebApp({ navigator: { platform: 'MacIntel', maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } }), true);
  assert.equal(isMobileOrInstalledWebApp({ navigator: { platform: 'Win32', maxTouchPoints: 0, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, matchMedia: () => ({ matches: false }) }), false);

  const main = source('src/championship/app/main.js');
  assert.match(main, /isMobileOrInstalledWebApp\(window\) \? sessionCheckpoint\?\.read\(\) : null/);
  assert.match(main, /const PIXI = createPixiAssetScope\(stage\.PIXI, globalThis\.location\.href/);

  const battleEffectArt = source('src/championship/presentation/battleEffectArt.js');
  assert.match(battleEffectArt, /bitmap\.close\(\)/);

  const dataArena = source('src/championship/app/dataArenaScreen.js');
  assert.match(dataArena, /const scopedMatchPIXI = typeof createPixiAssetScope === "function" \? createPixiAssetScope\(stage\.PIXI, href, \{ signal: owner\.signal \}\) : stage\.PIXI/);
  assert.match(dataArena, /loadDataArenaEnvironment\(\{ PIXI: scopedMatchPIXI/);
  assert.match(dataArena, /loadDataArenaInteractionArt\(\{PIXI:scopedMatchPIXI/);

  const elementVfx = source('src/championship/presentation/vfx/elementVfxLayer.js');
  assert.match(elementVfx, /bakedMarks\.clear\(\)/);
  const battleFx = source('src/championship/presentation/battleFx/battleFxLayer.js');
  assert.match(battleFx, /hyperSheet = null/);

  const vfxManifest = validateLicensedVfxRuntimeManifest(JSON.parse(source('assets/production/vfx/licensed-runtime-v1/manifest.json')));
  const closedBitmaps = [];
  const runtime = createLicensedVfxRuntime({
    manifest: vfxManifest,
    loader: {
      async loadAsync() {
        const scene = new THREE.Group();
        const bitmap = { close() { closedBitmaps.push(bitmap); } };
        const tex = new THREE.Texture(bitmap);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: tex }));
        scene.add(mesh);
        return { scene, animations: [], parser: { json: { animations: [] }, associations: new Map() } };
      }
    }
  });
  const slot0 = await runtime.load('battle-hitspark_small', { channel: 'impact-0-0' });
  const slot1 = await runtime.load('battle-hitspark_small', { channel: 'impact-0-1' });
  assert.equal(closedBitmaps.length, 1, 'duplicate impact slot closes its redundant decoded bitmap immediately and shares canonical THREE.Source');
  assert.equal(slot0.object3d.children[0].material.map.source, slot1.object3d.children[0].material.map.source);
  await slot0.dispose();
  assert.equal(closedBitmaps.length, 1, 'shared source bitmap stays open while slot1 is still active');
  await slot1.dispose();
  assert.equal(closedBitmaps.length, 2, 'shared source bitmap closes once the last pooled slot disposes');
});
