import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { loadHuntDepthOccluders, validateHuntDepthPieces, withHuntDepthOccluders } from '../src/championship/presentation/vs2/huntDepthOccluders.js';
import { validateRuntimeMapArtBundle } from '../src/championship/presentation/runtimeMapArtBundle.js';

function fakePixi() {
  const log = [];
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
  class Texture { constructor({ source, frame }) { this.source = source; this.frame = frame; } destroy() { log.push('texture-destroy'); } }
  class Sprite {
    constructor(texture) { this.texture = texture; this.position = { set: (x, y) => { this.x = x; this.y = y; } }; this.parent = null; }
    destroy() { log.push('sprite-destroy'); }
  }
  const PIXI = {
    Rectangle, Texture, Sprite,
    Assets: { load: async (src) => { log.push(`load:${src}`); return { source: { scaleMode: 'linear' } }; },
      unload: async (src) => { log.push(`unload:${src}`); } }
  };
  return { PIXI, log };
}

function layer() {
  const children = [];
  return { children, addChild(c) { children.push(c); c.parent = this; },
    addChildAt(c,i) { children.splice(i,0,c); c.parent=this; }, getChildIndex(c) { return children.indexOf(c); }, removeChild(c) { children.splice(children.indexOf(c), 1); c.parent = null; } };
}

const field = {
  worldWidthPx: 2048, worldHeightPx: 2048,
  depthOccluders: { atlases: [{ src: 'assets/production/hunt/x/occluders.webp' }, { src: 'assets/production/hunt/x/occluders-1.webp' }],
    pieces: { src: 'assets/production/hunt/x/occluders.json' } }
};
const fetchPieces = (pieces) => async () => ({ ok: true, json: async () => ({ pieces }) });

test('a field without depth occluders stays flat', async () => {
  assert.equal(await loadHuntDepthOccluders({ PIXI: fakePixi().PIXI, field: { worldWidthPx: 2048, worldHeightPx: 2048 } }), null);
});

test('occluder sources must live under assets/production', async () => {
  const bad = { ...field, depthOccluders: { atlases: [{ src: 'research/x.webp' }], pieces: field.depthOccluders.pieces } };
  await assert.rejects(loadHuntDepthOccluders({ PIXI: fakePixi().PIXI, field: bad, baseHref: 'http://x/', fetchImpl: fetchPieces([]) }),
    /ATLAS_SRC_OUTSIDE_PRODUCTION_ASSETS/);
});

test('pieces are integer rectangles inside the world', () => {
  assert.throws(() => validateHuntDepthPieces({ pieces: [[0, 0, 10, 10, 0, 0, 5, 0]] }, 2048, 2048), /PIECE_SHAPE/);
  assert.throws(() => validateHuntDepthPieces({ pieces: [[2040, 0, 10, 10, 0, 0, 5, 0, 0]] }, 2048, 2048), /PIECE_BOUNDS/);
  assert.throws(() => validateHuntDepthPieces({ pieces: [[0, 0, 1.5, 10, 0, 0, 5, 0, 0]] }, 2048, 2048), /PIECE_SHAPE/);
  assert.throws(() => validateHuntDepthPieces({ pieces: [[0, 0, 10, 10, 0, 0, 5, 1, 0]] }, 2048, 2048, 1), /PIECE_BOUNDS/);
  assert.throws(() => validateHuntDepthPieces({ pieces: [[0, 0, 10, 10, 0, 0, 5, 0, 2]] }, 2048, 2048, 1), /PIECE_BOUNDS/);
  assert.equal(validateHuntDepthPieces({ pieces: [[0, 0, 10, 10, 0, 0, 5, 1, 1]] }, 2048, 2048, 2).length, 1);
});

test('pieces sort with actors by world y and leave the layer cleanly', async () => {
  const { PIXI, log } = fakePixi();
  const occluders = await loadHuntDepthOccluders({ PIXI, field, baseHref: 'http://x/',
    fetchImpl: fetchPieces([[100, 200, 30, 40, 0, 0, 260, 0, 0], [400, 500, 20, 10, 31, 0, 532, 1, 1]]) });
  assert.equal(occluders.pieceCount, 2);
  const actors = layer();
  occluders.attach(actors);
  assert.deepEqual(actors.children.map((s) => [s.x, s.y, s.zIndex, s.eventMode]), [[100, 200, 260, 'none'], [400, 500, 532, 'none']]);
  assert.deepEqual(actors.children.map((s) => [s.texture.frame.x, s.texture.frame.width]), [[0, 30], [31, 20]]);
  // Foliage in front of an actor fades; pieces behind it or solid (cave) pieces never do.
  assert.equal(occluders.revealActors([{ x: 110, y: 250, halfWidth: 20, height: 60 }]), 1);
  assert.equal(actors.children[0].alpha, 0.42);
  assert.equal(occluders.revealActors([{ x: 110, y: 300, halfWidth: 20, height: 60 }]), 0);
  assert.equal(actors.children[0].alpha, 1);
  assert.equal(occluders.revealActors([{ x: 405, y: 505, halfWidth: 20, height: 60 }]), 0);
  // Only pieces near the camera stay in the layer (one 128 px cell of margin).
  assert.equal(occluders.syncView({ left: 0, top: 0, right: 200, bottom: 250 }), 1);
  assert.deepEqual(actors.children.map((s) => s.x), [100]);
  assert.equal(occluders.syncView({ left: 300, top: 400, right: 600, bottom: 700 }), 1);
  assert.deepEqual(actors.children.map((s) => s.x), [400]);
  assert.equal(occluders.syncView({ left: 0, top: 0, right: 600, bottom: 700 }), 2);
  occluders.detach();
  assert.equal(actors.children.length, 0);
  occluders.attach(actors);
  const art = { displayObject: {}, update() {}, getDiagnostics() {}, async dispose() { log.push('art-dispose'); } };
  const combined = withHuntDepthOccluders(art, occluders);
  assert.equal(combined.occluders, occluders);
  await combined.dispose();
  assert.equal(actors.children.length, 0);
  assert.deepEqual(log.filter((l) => !l.startsWith('load')),
    ['sprite-destroy', 'sprite-destroy', 'texture-destroy', 'texture-destroy', 'unload:assets/production/hunt/x/occluders.webp',
      'unload:assets/production/hunt/x/occluders-1.webp', 'art-dispose']);
  assert.equal(withHuntDepthOccluders(art, null), art);
});

test('the original hunt bundle keeps licensed frame timing and ships consistent occluders', () => {
  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
  const original = validateRuntimeMapArtBundle(JSON.parse(fs.readFileSync('assets/production/hunt/original-opus-v1/manifest.json', 'utf8')));
  const licensed = JSON.parse(fs.readFileSync('assets/production/hunt/licensed-runtime-v1/manifest.json', 'utf8'));
  assert.equal(original.rights.status, 'PROJECT_ORIGINAL');
  assert.equal(original.rights.romDerivedPixels, false);
  assert.ok(original.fields.length > 0);
  for (const f of original.fields) {
    const old = licensed.fields.find((x) => x.fieldId === f.fieldId);
    assert.ok(old, f.fieldId);
    assert.equal(f.frames.length, old.frames.length, f.fieldId);
    f.frames.forEach((frame, i) => {
      assert.equal(frame.durationMs ?? null, old.frames[i].durationMs ?? null);
      assert.equal(sha(frame.src), frame.sha256, frame.src);
    });
    for (const key of ['gameplayBinding', 'gateMapping', 'collisionBinding', 'worldWidthPx', 'worldHeightPx']) assert.equal(f[key], old[key]);
    assert.equal(sha(f.thumbnail.src), f.thumbnail.sha256);
    const spec = f.depthOccluders;
    for (const atlas of spec.atlases) assert.equal(sha(atlas.src), atlas.sha256);
    assert.equal(sha(spec.pieces.src), spec.pieces.sha256);
    const pieces = validateHuntDepthPieces(JSON.parse(fs.readFileSync(spec.pieces.src, 'utf8')), f.worldWidthPx, f.worldHeightPx,
      spec.atlases.length);
    assert.equal(pieces.length, spec.pieceCount);
  }
});


// The local candidate samples the real trimmed frame after native-density geometry is applied.
import { isHuntFoliageDitherRequested, describeHuntActorSilhouette, createHuntFoliageDither }
  from '../src/championship/presentation/vs2/huntFoliageDither.js';

test('foliage dither requires an exact loopback query and a supported renderer', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]'])
    assert.equal(isHuntFoliageDitherRequested({ hostname, search: '?huntFoliage=dither-r1' }), true);
  for (const location of [undefined, { hostname: 'example.com', search: '?huntFoliage=dither-r1' },
    { hostname: 'localhost', search: '' }, { hostname: 'localhost', search: '?huntFoliage=dither' }])
    assert.equal(isHuntFoliageDitherRequested(location), false);
  assert.equal(createHuntFoliageDither({ PIXI: {}, renderer: {}, location: { hostname: 'localhost', search: '?huntFoliage=dither-r1' } }), null);
});

test('actual trimmed silhouette preserves 4x art density, frame origin, jump offset and both flips', () => {
  const source = {}, sprite = { texture: { source, orig: { x: 0, y: 0, width: 384, height: 352 },
    trim: { x: 40, y: 20, width: 200, height: 160 }, uvs: { x0: .25, y0: .5, x1: .75, y1: .5, x3: .25, y3: 1 } },
    x: 0, y: 0, anchor: { x: 100 / 384, y: 180 / 352 }, scale: { x: .5, y: .5 } };
  const node = { x: 300, y: 375, zIndex: 400, scale: { x: 1, y: 1 } }; // world foot 400, jump 25
  const a = describeHuntActorSilhouette(sprite, node);
  assert.deepEqual(a.rect, [270, 295, 100, 80]); // native cell 96x88 -> world 192x176, not another x4
  assert.equal(a.depth, 400);
  assert.equal(a.textureSource, source);
  assert.deepEqual(a.uvOriginX, [.25, .5, .5, 0]);
  node.scale = { x: -1, y: -1 };
  const b = describeHuntActorSilhouette(sprite, node);
  assert.deepEqual(b.rect, [330, 455, -100, -80]);
  assert.deepEqual([b.left, b.right, b.top, b.bottom], [230, 330, 375, 455]);
  sprite.visible = false;
  assert.equal(describeHuntActorSilhouette(sprite, node), null);
  sprite.visible = true; node.alpha = 0;
  assert.equal(describeHuntActorSilhouette(sprite, node), null);
  node.alpha = 1;
  node.rotation = .1;
  assert.equal(describeHuntActorSilhouette(sprite, node), null);
  assert.equal(describeHuntActorSilhouette(null, node), null);
});

function meshPixi() {
  const fake = fakePixi(), { PIXI, log } = fake;
  PIXI.Assets.load = async () => ({ source: { width: 1024, height: 1024 } });
  PIXI.MeshGeometry = class { constructor(args) { Object.assign(this, args); } destroy() { log.push('geometry-release'); } };
  PIXI.GlProgram = { from: (args) => args };
  PIXI.Shader = class {
    constructor({ resources }) {
      this.resources = { ...resources, actorUniforms: { uniforms: Object.fromEntries(Object.entries(resources.actorUniforms).map(([key, value]) => [key, value.value])), update() {} } };
    }
    destroy() { log.push('shader-release'); }
  };
  PIXI.Mesh = class {
    constructor(args) { Object.assign(this, args); }
    removeFromParent() { this.parent?.removeChild(this); }
    destroy() { log.push('mesh-release'); }
  };
  return fake;
}

test('dither keeps piece depth, excludes solid/back/equal rows, unions overlapping actors and releases per-view resources', async () => {
  const previous = globalThis.location;
  globalThis.location = { hostname: 'localhost', search: '?huntFoliage=dither-r1' };
  try {
    const { PIXI, log } = meshPixi();
    const pieces = [[100, 200, 30, 40, 0, 0, 260, 0, 0], [100, 200, 30, 40, 31, 0, 260, 0, 1], [100, 200, 30, 40, 62, 0, 250, 0, 0]];
    const o = await loadHuntDepthOccluders({ PIXI, field, baseHref: 'http://localhost/', fetchImpl: fetchPieces(pieces) });
    o.configureFoliageDither({ gl: { MAX_TEXTURE_IMAGE_UNITS: 1, MAX_FRAGMENT_UNIFORM_VECTORS: 2, getParameter: (p) => p === 1 ? 8 : 64 } });
    assert.equal(o.usesActorAlpha, true);
    const actors = layer(); o.attach(actors); const [foliage, solid, equalRow] = actors.children;
    const silhouette = { textureSource: {}, rect: [105, 210, 20, 20], uvOriginX: [0, 0, 1, 0], uvY: [0, 1],
      depth: 250, left: 105, right: 125, top: 210, bottom: 230 };
    assert.equal(o.revealActors([{ silhouette }, { silhouette: { ...silhouette, textureSource: {} } }]), 1);
    const mesh = actors.children.find(c => c.label === 'hunt foliage local dither');
    assert.equal(mesh.zIndex, foliage.zIndex);
    assert.equal(actors.children.indexOf(mesh)+1,actors.children.indexOf(foliage));
    assert.ok(actors.children.indexOf(mesh)<actors.children.indexOf(solid));
    assert.equal(foliage.visible, false);
    assert.notEqual(solid.visible, false);
    assert.notEqual(equalRow.visible, false);
    assert.equal(mesh.shader.resources.uActor0, silhouette.textureSource);
    assert.ok(mesh.shader.resources.uActor1);
    assert.equal(o.getRevealDiagnostics().overflowPieces, 0);
    assert.equal(o.revealActors([{ silhouette: { ...silhouette, depth: 300 } }]), 0);
    assert.equal(foliage.visible, true);
    assert.equal(mesh.visible, false);
    // Hardware overlap guard retains the existing .42 fallback, instead of dropping other silhouettes.
    assert.equal(o.revealActors(Array.from({ length: 8 }, () => ({ silhouette }))), 0);
    assert.equal(foliage.alpha, .42);
    assert.equal(o.getRevealDiagnostics().overflowPieces, 1);
    assert.equal(o.revealActors([{ silhouette }]), 1);
    assert.equal(foliage.alpha, 1);
    o.syncView({ left: 1000, top: 1000, right: 1200, bottom: 1200 });
    assert.equal(o.getRevealDiagnostics().cachedPieces, 0);
    assert.equal(actors.children.length, 0);
    await o.dispose();
    const count = o.getRevealDiagnostics();
    assert.equal(count.created, count.released);
    assert.equal(log.filter(x => x === 'mesh-release').length, count.created);
    assert.equal(log.filter(x => x === 'geometry-release').length, count.created);
    assert.equal(log.filter(x => x === 'shader-release').length, count.created);
  } finally { globalThis.location = previous; }
});


test('r11 local map uses its exact two atlases/all pieces and leaves every other h1 field unchanged', async () => {
  const root='assets/production/hunt/cave-clearance-natural-r11/';
  const candidate=validateRuntimeMapArtBundle(JSON.parse(fs.readFileSync(root+'manifest.json','utf8')));
  const baseline=JSON.parse(fs.readFileSync('assets/production/hunt/original-opus-v1/manifest.json','utf8'));
  assert.equal(candidate.publicReleasePermitted,false);
  assert.equal(candidate.candidateReview.staticFrameOnly,true);
  assert.equal(candidate.fields.length,baseline.fields.length);
  const field=candidate.fields.find(f=>f.fieldId==='field_hm01_01');
  for(const other of candidate.fields.filter(f=>f.fieldId!==field.fieldId))assert.deepEqual(other,baseline.fields.find(f=>f.fieldId===other.fieldId));
  const old=baseline.fields.find(f=>f.fieldId===field.fieldId);
  for(const key of ['worldWidthPx','worldHeightPx','gameplayBinding','gateMapping','collisionBinding'])assert.equal(field[key],old[key]);
  assert.equal(field.frames.length,1);
  assert.equal(field.frames[0].sha256,'65c0458cbdb3c4fb5a6b9456c3a7708b9d98d42fce9fb595d45d19c18521349a');
  assert.ok(field.source.includes('hunt-grassland-r11-final'));
  const files=[field.frames[0],field.thumbnail,...field.depthOccluders.atlases,field.depthOccluders.pieces];
  for(const entry of files){assert.ok(entry.src.startsWith(root));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);}
  const pieces=validateHuntDepthPieces(JSON.parse(fs.readFileSync(field.depthOccluders.pieces.src,'utf8')),2048,2048,2);
  assert.equal(pieces.length,2530);assert.equal(pieces.filter(p=>p[8]).length,116);
  assert.equal(pieces.filter(p=>p[7]===1&&p[8]===1).length,2);
  const {isPrivateRepositoryPath}=await import('../scripts/lib/public-art-boundary.mjs');
  assert.equal(isPrivateRepositoryPath(root+'manifest.json'),true);
  assert.equal(isPrivateRepositoryPath('assets/production/hunt/cave-clearance-natural-r10/manifest.json'),true);
});
