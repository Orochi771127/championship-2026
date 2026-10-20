// Generated cage ambient (local review 2026-10-19): wind meshes, additive
// glows, water shimmer and particles, gated to the local WebGL runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {withCageAmbient} from '../src/championship/presentation/cageAmbient.js';
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const index = read('assets/production/cage/ambient-review-20261019/index.json');
const manifest = read('assets/production/cage/final-intake-20261008/manifest.json');

function fakePixi() {
  const made = {meshes: 0, sprites: 0, graphics: 0, loads: [], unloads: []};
  class Node { constructor(o = {}) { Object.assign(this, o); this.children = []; this.position = {set: (x, y) => { this.x = x; this.y = y; }};
    this.scale = {set: v => { this.s = v; }}; } addChild(...c) { this.children.push(...c); } destroy() { this.destroyed = true; } }
  class Mesh extends Node { constructor(o) { super(o); made.meshes++; } }
  class Sprite extends Node { constructor(t) { super(); this.texture = t; made.sprites++; } }
  class Graphics extends Node { constructor(o) { super(o); made.graphics++; } clear() { return this; } circle() { return this; } rect() { return this; }
    fill() { return this; } stroke() { return this; } moveTo() { return this; } lineTo() { return this; } }
  class UniformGroup { constructor(u) { this.uniforms = Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.value])); } update() {} }
  const PIXI = {RendererType: {WEBGL: 1, WEBGPU: 2}, Container: Node, Sprite, Graphics, Mesh, UniformGroup,
    Geometry: class { destroy() {} }, Shader: class { constructor(o) { Object.assign(this, o); } destroy() {} }, GlProgram: class {},
    Texture: class { constructor(o) { Object.assign(this, o); } }, Rectangle: class { constructor(x, y, w, h) { Object.assign(this, {x, y, width: w, height: h}); } },
    Assets: {load: async src => { made.loads.push(src); const d = src.endsWith('.webp') && !src.includes('battle') ? atlasSize(src) : {width: 256, height: 256};
      return {...d, frame: {x: 0, y: 0, width: d.width, height: d.height}, source: {width: d.width, height: d.height}}; }, unload: async src => { made.unloads.push(src); }}};
  return {PIXI, made};
}
const atlasSize = src => { const f = index.fields.find(x => src.includes(x.fieldId)); const d = read(f.manifest).atlas; return {width: d.width, height: d.height}; };
const fetchImpl = async url => { const p = new URL(url).pathname.slice(1); return {ok: fs.existsSync(new URL('../' + p, import.meta.url)), json: async () => read(p)}; };
function art(fieldId) {
  const field = manifest.fields.find(f => f.fieldId === fieldId);
  const base = {label: 'runtime map art ' + fieldId, x: 0, y: 0, width: field.worldWidthPx, height: field.worldHeightPx,
    texture: {frame: {x: 0, y: 0, width: field.worldWidthPx, height: field.worldHeightPx}, source: {width: field.worldWidthPx, height: field.worldHeightPx}}};
  return {displayObject: {children: [base]}, field: {nativePixelWorldScale: 4, wrapWidthPx: null}, update() {}, getDiagnostics: () => ({}), dispose: async () => {}};
}
const opts = (PIXI, fieldId, extra = {}) => ({PIXI, art: art(fieldId), manifest, placements: [{fieldId, x: 0, y: 0}], renderer: {type: 1},
  location: {hostname: '127.0.0.1'}, baseHref: 'http://127.0.0.1/championship.html', fetchImpl, ...extra});

test('every ambient manifest binds its runtime frame and atlas bytes', () => {
  assert.equal(index.publicReleasePermitted, false);
  for (const f of index.fields) {
    const data = read(f.manifest), frame = manifest.fields.find(x => x.fieldId === f.fieldId).frames[0];
    assert.equal(data.sourceComposite.sha256, frame.sha256, f.fieldId);
    const bytes = fs.readFileSync(new URL('../' + data.atlas.src, import.meta.url));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), data.atlas.sha256, f.fieldId);
    for (const e of data.elements) assert.ok(e.atlasX + e.width <= data.atlas.width && e.atlasY + e.height <= data.atlas.height, e.kind);
  }
});

test('local WebGL runtime builds wind meshes, glows, water and particles; others keep the static art', async () => {
  const fid = 'field_cm06_01', data = read(index.fields.find(f => f.fieldId === fid).manifest);
  const {PIXI, made} = fakePixi();
  const result = await withCageAmbient(opts(PIXI, fid));
  const d = result.getDiagnostics().ambient;
  assert.equal(d.glows, data.elements.filter(e => e.kind === 'glow').length);
  assert.equal(d.waters, data.elements.filter(e => e.kind === 'water').length);
  assert.ok(d.particleSystems >= 1);
  const layer = {children: [], addChild(c) { this.children.push(c); }};
  result.foreground.attach(layer); result.foreground.syncViewport({x: 5, y: 7, scale: 0.5});
  assert.equal(layer.children.length, d.roots);
  result.update(16); result.update(16);
  await result.dispose();
  assert.deepEqual([...new Set(made.unloads)].sort(), [...new Set(made.loads)].sort());
  for (const extra of [{location: {hostname: 'example.com'}}, {renderer: {type: 2}}, {renderer: null}]) {
    const a = art(fid); assert.equal(await withCageAmbient({...opts(PIXI, fid), ...extra, art: a}), a);
  }
  const changed = structuredClone(manifest); changed.fields.find(f => f.fieldId === fid).frames[0].sha256 = '0'.repeat(64);
  const a = art(fid); assert.equal(await withCageAmbient({...opts(PIXI, fid), manifest: changed, art: a}), a);
});

test('reduced motion drops wind and particles; low quality caps swaying elements', async () => {
  const fid = 'field_cm08_01', data = read(index.fields.find(f => f.fieldId === fid).manifest);
  const winds = data.elements.filter(e => e.kind === 'wind').length;
  assert.ok(winds > 20);
  const full = await withCageAmbient(opts(fakePixi().PIXI, fid));
  assert.equal(full.getDiagnostics().ambient.winds, winds);
  const low = await withCageAmbient(opts(fakePixi().PIXI, fid, {quality: 'low'}));
  assert.equal(low.getDiagnostics().ambient.winds, 20);
  const calm = await withCageAmbient(opts(fakePixi().PIXI, fid, {reducedMotion: true}));
  assert.equal(calm.getDiagnostics().ambient.winds, 0);
  assert.equal(calm.getDiagnostics().ambient.particleSystems, 0);
});
