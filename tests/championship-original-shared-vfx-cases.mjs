import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateOriginalSharedVfx, loadOriginalSharedVfxReview, originalSharedVfxReviewRequested, originalTextSetFor,
  ORIGINAL_SHARED_VFX_MANIFEST, ORIGINAL_SHARED_TEXT_SETS} from '../src/championship/presentation/originalSharedVfxReview.js';
import {projectBattleEffectSprite} from '../src/championship/presentation/battleEffectSprites.js';
import {isPrivateRepositoryPath, isShippingArtEntry, publicArtIndex} from '../scripts/lib/public-art-boundary.mjs';
import manifest from '../assets/production/vfx/original-shared-review-v1/manifest.json' with {type:'json'};
import reference from '../assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json' with {type:'json'};
import index from '../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import profiles from '../src/data/championship/battleEffectProfiles.json' with {type:'json'};

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// These retained baseline tests explicitly exercise the preserved saved157 package.
const href = 'http://127.0.0.1:8746/championship.html?vfxOriginal=shared-v1&vfxRevision=157-baseline';
const entry = index.entries.find(e => e.assetId === manifest.assetId);

const images = new Map([[manifest.image.src, manifest.image],
  ...Object.values(manifest.localizedText?.sets ?? {}).map(set => [set.image.src, set.image])]);
function fakePixi() {
  const loads = [], unloads = [], textures = [];
  return {loads, unloads, textures,
    Assets:{async load(path){loads.push(path);const image = images.get(path);return {source:{path}, width:image.width, height:image.height};},
      async unload(path){unloads.push(path);}},
    Rectangle:class {constructor(x, y, width, height){Object.assign(this, {x, y, width, height});}},
    Texture:class {constructor(options){Object.assign(this, options);textures.push(this);}destroy(){this.destroyed = true;}}};
}
function fakeBase() {
  const cells = new Map(reference.cells.map(c => [`${c.bankId}:${c.cell}`, {...c, texture:{id:`ref:${c.bankId}:${c.cell}`}}]));
  return {assetId:reference.assetId, disposed:0, getCell:(b, c) => cells.get(`${b}:${c}`) ?? null, dispose(){this.disposed++;return Promise.resolve();}};
}
const fetchImpl = async url => {
  const path = new URL(url).pathname.slice(1);
  if (path === 'assets/production/ART_PRODUCTION_INDEX.json') return {ok:true, json:async () => structuredClone(index)};
  if (path === ORIGINAL_SHARED_VFX_MANIFEST) return {ok:true, json:async () => structuredClone(manifest)};
  return {ok:false, status:404};
};

test('bundle bytes, density-4 cells and whole-sequence coverage are registered', () => {
  const checked = validateOriginalSharedVfx(manifest, index);
  const image = fs.readFileSync(new URL('../' + manifest.image.src, import.meta.url));
  assert.equal(sha(image), manifest.image.sha256);
  assert.equal(image.readUInt32BE(16), manifest.image.width);
  assert.equal(image.readUInt32BE(20), manifest.image.height);
  assert.ok(checked.banks.length >= 1);
  for (const cell of manifest.cells) {
    assert.equal(cell.pixelsPerNativePixel, 4);
    assert.equal(cell.ticks, undefined, 'timing stays in battleEffectProfiles');
    const box = profiles.banks[cell.bankId - 1].boxes[cell.cell];
    assert.deepEqual(cell.nativeOrigin, [(-box[2]) | 0, (-box[3]) | 0], 'records the native anchor it replaces');
    const ref = reference.cells.find(c => c.bankId === cell.bankId && c.cell === cell.cell);
    assert.equal(cell.blank, ref.blank, 'native blank cells stay blank');
  }
});

test('native timing source is the unchanged runtime profile file', () => {
  const bytes = fs.readFileSync(new URL('../src/data/championship/battleEffectProfiles.json', import.meta.url));
  assert.equal(manifest.nativeTimingSource.file, 'src/data/championship/battleEffectProfiles.json');
  assert.equal(sha(bytes), manifest.nativeTimingSource.sha256);
});

test('review state, rights and coverage drift are rejected', () => {
  const edits = [m => m.reviewOnly = false, m => m.runtimeEligible = true, m => m.publicReleasePermitted = true,
    m => m.shippingReady = true, m => m.humanApproved = true, m => m.localOnly = false, m => m.rightsStatus = 'ROM_COPYRIGHTED_REFERENCE',
    m => m.pixelsPerNativePixel = 1, m => m.cells[0].pixelsPerNativePixel = 8, m => m.image.src = 'assets/production/../x.png',
    m => m.image.scaleMode = 'linear', m => m.blend = 'ADD', m => m.timing = 'RETIMED', m => m.cells.pop(),
    m => m.cells.push({...m.cells[0]}), m => m.banks[0].cells.pop(), m => m.banks[0].sequences = [99],
    m => m.cells[0].frame = [m.image.width, 0, 4, 4]];
  for (const edit of edits) {
    const m = structuredClone(manifest); edit(m);
    assert.throws(() => validateOriginalSharedVfx(m, index), undefined, edit.toString());
  }
  assert.throws(() => validateOriginalSharedVfx(manifest, {entries:[]}));
});

test('only an explicit loopback query opts in; otherwise the loaded art is returned untouched', async () => {
  assert.equal(originalSharedVfxReviewRequested(href), true);
  for (const url of ['http://127.0.0.1:8746/championship.html', 'https://example.org/?vfxOriginal=shared-v1',
    'http://localhost/?vfxOriginal=shared-v2', 'file:///x?vfxOriginal=shared-v1']) assert.equal(originalSharedVfxReviewRequested(url), false, url);
  const base = fakeBase();
  let fetched = 0;
  const same = await loadOriginalSharedVfxReview({PIXI:fakePixi(), baseArt:base, href:'http://127.0.0.1:8746/', fetchImpl:async () => { fetched++; }});
  assert.equal(same, base); assert.equal(fetched, 0);
});

test('covered cells come from the remake, every other cell from the loaded art, and disposal releases both', async () => {
  const PIXI = fakePixi(), base = fakeBase(), first = [];
  const art = await loadOriginalSharedVfxReview({PIXI, baseArt:base, href, baseUrl:'http://127.0.0.1:8746/', fetchImpl,
    onFirstUse:key => first.push(key), getLocale:() => 'zh-Hant', onLocaleChange:() => () => {}});
  assert.deepEqual(PIXI.loads, [manifest.image.src, manifest.localizedText.sets['zh-Hant'].image.src], 'main atlas + only the active text set');
  const covered = manifest.cells[0];
  const own = art.getCell(covered.bankId, covered.cell);
  assert.equal(own.artSource, 'ORIGINAL_SHARED_REVIEW');
  assert.equal(own.pixelsPerNativePixel, 4);
  art.getCell(covered.bankId, covered.cell);
  assert.deepEqual(first, [`${covered.bankId}:${covered.cell}`], 'first use reported once');
  const replaced = new Set([...manifest.cells.map(c => `${c.bankId}:${c.cell}`), ...manifest.localizedText.cells.map(c => `1:${c}`)]);
  const other = reference.cells.find(c => !replaced.has(`${c.bankId}:${c.cell}`));
  assert.equal(art.getCell(other.bankId, other.cell).texture.id, `ref:${other.bankId}:${other.cell}`);
  await art.dispose(); await art.dispose();
  assert.ok(PIXI.textures.every(t => t.destroyed));
  assert.deepEqual(PIXI.unloads.sort(), [manifest.image.src, manifest.localizedText.sets['zh-Hant'].image.src].sort());
  assert.equal(base.disposed, 1);
});

test('text popups follow the game-setting locale: Chinese, Japanese, everything else English', () => {
  assert.deepEqual(ORIGINAL_SHARED_TEXT_SETS, ['zh-Hant', 'ja', 'en']);
  for (const [locale, set] of [['zh-Hant', 'zh-Hant'], ['zh', 'zh-Hant'], ['zh-CN', 'zh-Hant'], ['ja', 'ja'], ['ja-JP', 'ja'],
    ['en', 'en'], ['th', 'en'], ['vi', 'en'], ['ko', 'en'], ['', 'en'], [undefined, 'en'], ['jav', 'en']]) assert.equal(originalTextSetFor(locale), set, String(locale));
});

test('each text set keeps the 12 native text cells, their native rectangles and whole sequences', () => {
  const text = manifest.localizedText, bank = profiles.banks[0];
  assert.deepEqual(text.sequences, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 46]);
  assert.deepEqual(text.cells, text.sequences.map(id => bank.sequences[id].frames.map(f => f.cell)).flat());
  for (const id of text.sequences) assert.deepEqual(bank.sequences[id].frames.map(f => f.ticks), [31], `seq ${id} timing stays native`);
  for (const [name, set] of Object.entries(text.sets)) {
    const image = fs.readFileSync(new URL('../' + set.image.src, import.meta.url));
    assert.equal(sha(image), set.image.sha256, `${name} atlas bytes`);
    assert.deepEqual(set.cells.map(c => c.cell), text.cells);
    for (const c of set.cells) {
      const [highX, highY, lowX, lowY] = bank.boxes[c.cell];
      assert.deepEqual([c.nativeSize, c.nativeOrigin], [[highX - lowX, highY - lowY], [-lowX, -lowY]]);
      const [, , w, h] = c.frame, [ox, oy] = c.origin;
      assert.ok(ox <= -lowX * 4 && oy <= -lowY * 4 && w - ox <= highX * 4 && h - oy <= highY * 4, `${name}:${c.cell} inside its native cell`);
    }
  }
  const bad = structuredClone(manifest);
  bad.localizedText.sets.en.cells[0].origin[0] += 400;
  assert.throws(() => validateOriginalSharedVfx(bad, index), /ORIGINAL_SHARED_TEXT_CELL_INVALID:en:44/);
  const missing = structuredClone(manifest); delete missing.localizedText.sets.ja;
  assert.throws(() => validateOriginalSharedVfx(missing, index), /ORIGINAL_SHARED_TEXT_SETS/);
  const overlap = structuredClone(manifest); overlap.localizedText.sequences.push(30); overlap.localizedText.cells.push(86, 87, 88, 89, 90, 91);
  assert.throws(() => validateOriginalSharedVfx(overlap, index), /ORIGINAL_SHARED_TEXT_COVERAGE/);
});

test('a settings change swaps the text set in place and releases the old atlas only after the scene has drawn', async () => {
  const PIXI = fakePixi(), base = fakeBase(), listeners = new Set(), releases = [];
  let locale = 'en';
  const art = await loadOriginalSharedVfxReview({PIXI, baseArt:base, href, baseUrl:'http://127.0.0.1:8746/', fetchImpl,
    getLocale:() => locale, onLocaleChange:fn => { listeners.add(fn); return () => listeners.delete(fn); },
    deferRelease:run => { const job = {run, cancelled:false}; releases.push(job); return () => { job.cancelled = true; }; }});
  const set = name => manifest.localizedText.sets[name];
  assert.equal(art.getCell(1, 44).textSet, 'en');
  assert.equal(art.getCell(1, 44).frame.join(), set('en').cells[0].frame.join());
  const change = async next => { locale = next; for (const fn of listeners) fn(next); await new Promise(r => setTimeout(r, 0)); };
  await change('zh-Hant');
  assert.equal(art.getCell(1, 44).textSet, 'zh-Hant');
  assert.ok(!PIXI.unloads.includes(set('en').image.src), 'old atlas kept until the deferred release runs');
  assert.deepEqual(art.getReviewDiagnostics().text.retiring, ['en']);
  releases.at(-1).run();
  assert.ok(PIXI.unloads.includes(set('en').image.src));
  assert.deepEqual(art.getReviewDiagnostics().text.retiring, []);
  // back and forth before the release runs: the retiring set is reclaimed, not reloaded
  await change('ja'); await change('zh-Hant');
  assert.equal(art.getCell(1, 142).textSet, 'zh-Hant');
  assert.equal(PIXI.loads.filter(p => p === set('zh-Hant').image.src).length, 1, 'reclaimed without a second load');
  // an unknown game locale falls back to English
  await change('th');
  assert.equal(art.getCell(1, 50).textSet, 'en');
  await art.dispose();
  assert.equal(listeners.size, 0, 'settings observer removed');
  assert.ok(PIXI.textures.every(t => t.destroyed));
  const loaded = PIXI.loads.filter(p => p !== manifest.image.src), unloaded = PIXI.unloads.filter(p => p !== manifest.image.src);
  assert.deepEqual([...loaded].sort(), [...unloaded].sort(), 'every text atlas loaded was released');
});

test('a blank-state mismatch against the loaded art stops the review before textures load', async () => {
  const PIXI = fakePixi(), base = fakeBase(), c = manifest.cells[0];
  const getCell = base.getCell;
  base.getCell = (b, k) => (b === c.bankId && k === c.cell ? {...getCell(b, k), blank:!c.blank} : getCell(b, k));
  await assert.rejects(loadOriginalSharedVfxReview({PIXI, baseArt:base, href, baseUrl:'http://127.0.0.1:8746/', fetchImpl}), /BLANK_DRIFT/);
  assert.equal(PIXI.loads.length, 0);
});

test('existing projection keeps native scale, own anchor and facing flip for remade cells', () => {
  const cell = manifest.cells.find(c => !c.blank);
  const effect = {point:[100 * 4096, 80 * 4096, 0], sin:0, cos:4096, scaleX:4096, scaleY:4096, flip:0, alpha:31, tint:32767};
  const p = projectBattleEffectSprite(effect, cell, {x:10, y:20}, 0.9375);
  assert.equal(p.scaleX, 0.9375 / 4); assert.equal(p.scaleY, 0.9375 / 4);
  assert.equal(p.anchorX, cell.origin[0] / cell.frame[2]); assert.equal(p.anchorY, cell.origin[1] / cell.frame[3]);
  assert.equal(p.x, 10 + 100 * 0.9375); assert.equal(p.y, 20 + 80 * 0.9375);
  assert.equal(projectBattleEffectSprite({...effect, flip:1}, cell, {x:10, y:20}, 0.9375).scaleX, -0.9375 / 4);
});

test('remade cells draw no larger quads than the reference cells they replace, in one 8 MiB atlas page', () => {
  // Same-screen cost guard: each sprite is one textured quad, so per bank the summed quad
  // area (native px^2) must not exceed what the loaded reference cells would draw.
  const ref = new Map(reference.cells.map(c => [`${c.bankId}:${c.cell}`, c]));
  const area = new Map();
  for (const c of manifest.cells) {
    const r = ref.get(`${c.bankId}:${c.cell}`), k = r.pixelsPerNativePixel ?? 1;
    const [own, base] = area.get(c.bankId) ?? [0, 0];
    area.set(c.bankId, [own + c.frame[2] * c.frame[3] / 16, base + r.frame[2] * r.frame[3] / (k * k)]);
  }
  for (const [bank, [own, base]] of area) assert.ok(own <= base, `bank ${bank}: ${own} > ${base}`);
  assert.deepEqual([manifest.image.width, manifest.image.height], [1024, 2048]);
  assert.ok(manifest.image.width * manifest.image.height * 4 <= 8 * 1024 * 1024);
});

test('the review bundle never reaches a public build', () => {
  assert.equal(isPrivateRepositoryPath(ORIGINAL_SHARED_VFX_MANIFEST), true);
  assert.equal(isPrivateRepositoryPath(manifest.image.src), true);
  assert.equal(isShippingArtEntry(entry), false);
  assert.equal(publicArtIndex(index).entries.some(e => e.assetId === manifest.assetId), false);
  assert.equal(index.entries.length, index.summary.registeredRuntimeBundles);
});
