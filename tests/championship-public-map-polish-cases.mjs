// Public map polish (Owner 2026-10-21): the polished cage, battle and HM01 maps replace the earlier
// public ones. The approved list, the projected manifests and the loaders must agree byte for byte.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {withCageForeground} from '../src/championship/presentation/cageForeground.js';
import {fetchRuntimeMapResponse,publicMapManifestPath} from '../src/championship/presentation/publicMapRequests.js';
import {huntGateThumbnail} from '../src/championship/presentation/huntMobileReadouts.js';
import {listChampionshipGates} from '../src/championship/gate/gateCatalog.js';
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(new URL('../' + p, import.meta.url))).digest('hex');
const allow = read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
const inputs = read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
const listed = new Map(allow.files.map(f => [f.path, f]));
const PUBLIC = new URL('https://orochi771127.github.io/championship-2026/championship.html');

test('the public cage, hunt and battle roles carry the polished sets', () => {
  assert.equal(read('assets/production/public-runtime/cage-final.map.v1.json').assetId, 'art:cage:polish-review:20261019');
  assert.equal(read('assets/production/public-runtime/hunt-hm01x2.map.v1.json').assetId, 'art:hunt:hm01x2-public:20261021');
  const accepted = read('assets/production/public-runtime/hunt-accepted.map.v1.json');
  assert.ok(!accepted.fields.some(f => /^field_hm01_/.test(f.fieldId)), 'the rebuilt HM01 replaces the earlier two fields');
  const rebuilt = read('assets/production/public-runtime/hunt-hm01x2.map.v1.json');
  assert.deepEqual(rebuilt.fields.map(f => f.fieldId), ['field_hm01_01', 'field_hm01_02']);
  for (const f of rebuilt.fields) assert.equal(f.thumbnail.width, 1440);
  const battle = read('assets/production/public-runtime/metadata/battle-original.v1.json');
  assert.ok(battle.fields.every(f => f.ambient), 'every polished arena keeps its ambient layer');
});

test('every file the polished maps and their review loaders request is approved with its exact bytes', () => {
  const files = new Set();
  const visit = n => { if (Array.isArray(n)) n.forEach(visit); else if (n && typeof n === 'object') {
    if (typeof n.src === 'string' && n.src.startsWith('assets/production/')) files.add(n.src); Object.values(n).forEach(visit); } };
  for (const p of ['assets/production/public-runtime/cage-final.map.v1.json', 'assets/production/public-runtime/hunt-hm01x2.map.v1.json',
    'assets/production/public-runtime/metadata/battle-original.v1.json']) visit(read(p));
  for (const dir of ['foreground-review-polish-20261019', 'ambient-review-polish-20261019', 'shared-edges-polish-20261019']) {
    const index = read(`assets/production/cage/${dir}/index.json`); files.add(`assets/production/cage/${dir}/index.json`);
    for (const f of index.fields) {
      const entry = f.manifest ?? null;
      if (entry) { files.add(entry); visit(read(entry)); }
      if (f.atlas?.src) files.add(f.atlas.src);
    }
  }
  files.add('assets/production/cage/cm02-goal-foreground-polish-20261019/manifest.json');
  files.add('assets/production/battle/bm04-island-polish-r2/caustic-tile.webp');
  assert.ok(files.size > 250);
  for (const file of files) {
    if (file.startsWith('assets/production/public-runtime/metadata/')) continue;
    const row = listed.get(file);
    assert.ok(row, 'not approved: ' + file);
    assert.equal(row.sha256, sha(file), file);
    assert.ok(inputs.publicPlaytest.files.some(f => f.path === file && f.sha256 === row.sha256), file);
    if (file.endsWith('.json')) assert.ok(Array.isArray(row.jsonFields), file);
  }
});

test('the earlier maps these replace are no longer approved for the public build', () => {
  for (const file of listed.keys()) {
    assert.ok(!/^assets\/production\/hunt\/accepted-20261010\/images\//.test(file) || !read('assets/production/hunt/accepted-20261010/manifest.json').fields
      .filter(f => /^field_hm01_/.test(f.fieldId)).some(f => JSON.stringify(f).includes(file)), file);
  }
  assert.ok(![...listed.keys()].some(f => f.startsWith('assets/production/battle/original-opus-v1/')));
});

test('approved public origin loads only the polished foreground set, never the earlier review sets', async () => {
  const manifest = read('assets/production/public-runtime/cage-final.map.v1.json');
  const requested = [];
  const fetchImpl = async url => { requested.push(String(url)); const file = new URL(url).pathname.replace(/^\/championship-2026\//, '');
    return fs.existsSync(new URL('../' + file, import.meta.url)) ? {ok: true, json: async () => read(file)} : {ok: false, json: async () => ({})}; };
  class Container { constructor(o) { Object.assign(this, o); this.children = []; this.position = {set() {}}; this.scale = {set() {}}; } addChild(...c) { this.children.push(...c); } destroy() {} }
  class Sprite { constructor(t) { this.texture = t; } destroy() {} }
  class Graphics { rect() { return this; } fill() { return this; } destroy() {} }
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, {x, y, width: w, height: h}); } }
  class Texture { constructor({source, frame}) { this.source = source; this.frame = frame; } }
  const index = read('assets/production/cage/foreground-review-polish-20261019/index.json');
  const atlasOf = src => { const f = index.fields.find(x => src.includes(x.fieldId)); const d = read(f.manifest).atlas; return {width: d.width, height: d.height, source: {}}; };
  const PIXI = {Container, Sprite, Graphics, Rectangle, Texture, Assets: {load: async src => atlasOf(src), unload: async () => {}}};
  const fields = ['field_cm26_01', 'field_cm02_01'];
  const bases = fields.map(id => { const f = manifest.fields.find(x => x.fieldId === id);
    return {label: 'runtime map art ' + id, x: 0, y: 0, width: f.worldWidthPx, height: f.worldHeightPx, texture: {source: {}}}; });
  const art = {displayObject: {children: bases}, field: {nativePixelWorldScale: 4, wrapWidthPx: null}, getDiagnostics: () => ({}), dispose: async () => {}};
  const result = await withCageForeground({PIXI, art, manifest, placements: fields.map(fieldId => ({fieldId, x: 0, y: 0})),
    location: PUBLIC, baseHref: PUBLIC.href, fetchImpl});
  assert.deepEqual(result.getDiagnostics().foreground.fieldIds.sort(), [...fields].sort());
  assert.ok(requested.some(u => u.includes('foreground-review-polish-20261019/field_cm26_01.json')), 'the polished occluders of a placed cage are requested');
  assert.ok(requested.some(u => u.includes('cm02-goal-foreground-polish-20261019/manifest.json')));
  assert.ok(requested.every(u => /polish-20261019|public-runtime/.test(u)), requested.join(' '));
  await result.dispose();
});

test('the public HM01 gate preview is the packaged thumbnail and main selects the polished maps by location', () => {
  const gate = listChampionshipGates().find(g => g.originalFields.dayFieldId === 'field_hm01_01');
  const t = huntGateThumbnail(gate, PUBLIC.href);
  assert.match(t.src, /^assets\/production\/hunt\/hm01x2-public-20261021\/images\/[a-f0-9]{64}\.webp$/);
  assert.ok(listed.has(t.src));
  const main = fs.readFileSync(new URL('../src/championship/app/main.js', import.meta.url), 'utf8');
  assert.match(main, /const MAP_POLISH_PUBLIC = isApprovedOriginalPublicLocation\(\)/);
  assert.match(main, /MAP_POLISH_PUBLIC \? publicMapManifestPath\('hunt-hm01x2'\)/);
  assert.match(main, /if \(CAGE_REVIEW_MANIFEST_URL \|\| MAP_POLISH_PUBLIC\)/);
  assert.doesNotMatch(main, /importLocalReviewModule\("\.\.\/\.\.\/data/);
  assert.doesNotMatch(main, /importLocalReviewModule\('\.\.\/presentation\/(?:cageAmbient|cageSharedEdges|battleFieldAmbient)/);
});

test('the public origin may request the rebuilt HM01 manifest through the map request gate', async () => {
  const url = publicMapManifestPath('hunt-hm01x2');
  const text = fs.readFileSync(new URL('../' + url, import.meta.url), 'utf8');
  const response = await fetchRuntimeMapResponse(url, PUBLIC.href, {fetchImpl: async () => ({ok: true, status: 200, text: async () => text})});
  assert.equal((await response.json()).assetId, 'art:hunt:hm01x2-public:20261021');
  await assert.rejects(fetchRuntimeMapResponse('assets/production/hunt/hm01x2-review-20261019/manifest.json', PUBLIC.href, {fetchImpl: async () => ({ok: true, text: async () => '{}'})}), /PRIVATE_MAP_METADATA/);
});
