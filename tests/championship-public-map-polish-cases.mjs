// Public map polish (Owner 2026-10-21): the polished battle and HM01 maps replace the earlier
// public ones. The approved list, the projected manifests and the loaders must agree byte for byte.
// The polished 2D cages and their overlays were deleted on 2026-11-02 (Owner): the cages are the 3D renders.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fetchRuntimeMapResponse,publicMapManifestPath} from '../src/championship/presentation/publicMapRequests.js';
import {huntGateThumbnail} from '../src/championship/presentation/huntMobileReadouts.js';
import {listChampionshipGates} from '../src/championship/gate/gateCatalog.js';
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(new URL('../' + p, import.meta.url))).digest('hex');
const allow = read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
const inputs = read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
const listed = new Map(allow.files.map(f => [f.path, f]));
const PUBLIC = new URL('https://orochi771127.github.io/championship-2026/championship.html');

test('the public hunt and battle roles carry the polished sets', () => {
  assert.equal(read('assets/production/public-runtime/cage-ui.map.v1.json').assetId, 'art:cage:ui-three:20261102');
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
  for (const p of ['assets/production/public-runtime/hunt-hm01x2.map.v1.json',
    'assets/production/public-runtime/metadata/battle-original.v1.json']) visit(read(p));
  files.add('assets/production/battle/bm04-island-polish-r2/caustic-tile.webp');
  assert.ok(files.size > 30);
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
  assert.ok(![...listed.keys()].some(f => /^assets\/production\/cage\/(?!three-20261021\/|ui-three-20261102\/|licensed-runtime-v1\/)/.test(f)),
    'only the 3D cages, their renders and the licensed baseline remain public');
});

test('the public HM01 gate preview is the packaged thumbnail and main selects the polished maps by location', () => {
  const gate = listChampionshipGates().find(g => g.originalFields.dayFieldId === 'field_hm01_01');
  const t = huntGateThumbnail(gate, PUBLIC.href);
  assert.match(t.src, /^assets\/production\/hunt\/hm01x2-public-20261021\/images\/[a-f0-9]{64}\.webp$/);
  assert.ok(listed.has(t.src));
  const main = fs.readFileSync(new URL('../src/championship/app/main.js', import.meta.url), 'utf8');
  assert.match(main, /const MAP_POLISH_PUBLIC = isApprovedOriginalPublicLocation\(\)/);
  assert.match(main, /MAP_POLISH_PUBLIC \? publicMapManifestPath\('hunt-hm01x2'\)/);
  assert.match(main, /if \(MAP_POLISH_PUBLIC\) \{/);
  assert.doesNotMatch(main, /importLocalReviewModule\("\.\.\/\.\.\/data/);
  assert.doesNotMatch(main, /importLocalReviewModule\('\.\.\/presentation\/battleFieldAmbient/);
  assert.doesNotMatch(main, /cageForeground|cageAmbient|cageSharedEdges|polish-review-20261019|cage-final/);
});

test('the public origin may request the rebuilt HM01 manifest through the map request gate', async () => {
  const url = publicMapManifestPath('hunt-hm01x2');
  const text = fs.readFileSync(new URL('../' + url, import.meta.url), 'utf8');
  const response = await fetchRuntimeMapResponse(url, PUBLIC.href, {fetchImpl: async () => ({ok: true, status: 200, text: async () => text})});
  assert.equal((await response.json()).assetId, 'art:hunt:hm01x2-public:20261021');
  await assert.rejects(fetchRuntimeMapResponse('assets/production/hunt/hm01x2-review-20261019/manifest.json', PUBLIC.href, {fetchImpl: async () => ({ok: true, text: async () => '{}'})}), /PRIVATE_MAP_METADATA/);
});
