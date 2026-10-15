import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as PIXI from 'pixi.js';
import manifest from '../assets/production/evolution-glyphs-v1/manifest.json' with { type: 'json' };
import { loadEvolutionGlyphArt, createEvolutionGlyphBand } from '../src/championship/presentation/evolutionGlyphArt.js';
import { createPixiAssetScope } from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';

// CPU-only: real Pixi objects, but no DOM, renderer or graphics context.
// ColorMatrixFilter's precision probe explicitly supports a null context.
const previousAdapter = PIXI.DOMAdapter.get();
if (typeof document === 'undefined') {
  PIXI.DOMAdapter.set({...previousAdapter, createCanvas: () => ({getContext: () => null})});
  test.after(() => PIXI.DOMAdapter.set(previousAdapter));
}

function assets({ fail = null, invalid = null, gate = null } = {}) {
  const loaded = [], unloaded = [], textures = new Map();
  return { loaded, unloaded, textures, PIXI: { ...PIXI, Assets: {
    async load(src) {
      loaded.push(src);
      if (gate) await gate;
      if (src.includes(fail ?? '\0')) throw failure;
      const texture = new PIXI.Texture({ source: new PIXI.TextureSource({ width:src.includes(invalid ?? '\0')?127:128, height:128 }) });
      textures.set(src, texture);
      return texture;
    },
    async unload(src) { unloaded.push(src); textures.get(src)?.destroy(true); }
  }} };
}
const failure = new Error('QA glyph unavailable');

test('four approved glyphs use only unchanged 128px RGBA PNGs and one center anchor', () => {
  assert.deepEqual(manifest.assets.map(a=>a.id), ['CP-G01','CP-G02','CP-G03','CP-G04']);
  for (const asset of manifest.assets) {
    const bytes = fs.readFileSync(asset.src);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
    assert.equal(bytes.readUInt32BE(16), 128); assert.equal(bytes.readUInt32BE(20), 128);
    assert.equal(bytes[25], 6, 'RGBA transparent PNG');
    assert.deepEqual(asset.anchor, [0.5,0.5]);
    assert.ok(asset.src.endsWith('-128.png'));
  }
});

test('shared frame clock moves the replacement symbol row left; reduced motion fits narrow screens and stays still', async () => {
  const mock = assets(), art = await loadEvolutionGlyphArt(mock.PIXI);
  const band = createEvolutionGlyphBand(mock.PIXI, art);
  const ink = band.container.filters[0], program = ink.glProgram;
  assert.ok(ink instanceof PIXI.ColorMatrixFilter);
  assert.equal(ink.alpha, 1);
  assert.deepEqual(ink.matrix, [0,0,0,0,0, 0,0,0,0,139/255, 0,0,0,0,1, 0,0,0,1,0]);
  let destroyed = 0;
  ink.on('destroy', () => destroyed++);
  for (const width of [280,320,390]) {
    band.update({width,height:473,totalFrames:35,reducedMotion:true});
    const first = {x:band.container.x,y:band.container.y};
    const bounds = band.container.getBounds();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
    assert.ok(bounds.y>=473*4/6&&bounds.y+bounds.height<473*5/6, 'inside the former symbol row');
    band.update({width,height:473,totalFrames:205,reducedMotion:true});
    assert.deepEqual({x:band.container.x,y:band.container.y},first);
    band.update({width,height:473,totalFrames:35,reducedMotion:false});
    const before=band.container.x;
    band.update({width,height:473,totalFrames:65,reducedMotion:false});
    assert.ok(band.container.x<before);
    assert.equal(band.container.eventMode,'none');
    assert.deepEqual(band.container.children.map(s=>s.label),manifest.assets.map(a=>a.id));
  }
  band.container.destroy({children:true});
  band.container.destroy({children:true});
  assert.equal(destroyed,1,'filter disposed once by container destroyed event');
  assert.equal(ink.resources,null);
  assert.equal(ink.glProgram,null);
  assert.ok(program.fragment,'shared cached program must remain alive');
  await art.dispose(); await art.dispose();
  assert.equal(mock.loaded.length,4); assert.equal(mock.unloaded.length,4);
  assert.ok([...mock.textures.values()].every(t=>t.destroyed));
});

test('failed or invalid glyph loads release every successful texture and retain the actual error', async () => {
  const failed=assets({fail:'CP-G02'});
  await assert.rejects(loadEvolutionGlyphArt(failed.PIXI),error=>error===failure);
  assert.equal(failed.loaded.length,4); assert.equal(failed.unloaded.length,3);
  const invalid=assets({invalid:'CP-G03'});
  await assert.rejects(loadEvolutionGlyphArt(invalid.PIXI),/EVOLUTION_GLYPH_DIMENSIONS/);
  assert.equal(invalid.unloaded.length,4);
});

test('late loads after scene cancellation share ownership with the next scene and unload exactly once', async () => {
  let finish;
  const gate = new Promise(resolve=>{finish=resolve}), mock=assets({gate});
  const abort = new AbortController();
  const firstScope=createPixiAssetScope(mock.PIXI,'https://qa.invalid/',{signal:abort.signal});
  const secondScope=createPixiAssetScope(mock.PIXI,'https://qa.invalid/');
  const first=loadEvolutionGlyphArt(firstScope),second=loadEvolutionGlyphArt(secondScope);
  await Promise.resolve(); abort.abort(); finish();
  const [a,b]=await Promise.all([first,second]);
  await a.dispose();
  assert.equal(mock.loaded.length,4); assert.equal(mock.unloaded.length,0);
  await b.dispose(); await b.dispose();
  assert.equal(mock.unloaded.length,4);
});

