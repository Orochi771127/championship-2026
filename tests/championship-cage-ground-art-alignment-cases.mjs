// Cage ground vs cage picture — can a resident stand where no floor is drawn?
//
// Owner report 2026-09-13 (photo 1): large residents appeared to stand outside
// their cage. The ground a resident may walk on comes from the original field
// arrays (raising-ground catalog, ARM9 020502D8 copy loops); the picture comes
// from the flattened cage frames. They are placed by two different modules, so
// this composes both through the real runtime functions and checks every
// walkable block against the drawn pixels, for every cage in both board rows.
//
// It does not claim front-object occlusion: the original ranch compositor
// replay covers ground planes only (no live camera, objects or animations).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createNativeRaisingGround } from '../src/championship/raising/nativeRaisingGround.js';
import { createRaisingCageArtPlan } from '../src/championship/presentation/raisingCageArtPlan.js';
import { NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE, validateNativeRanch } from '../src/championship/cage/nativeRanchLayout.js';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { getOriginalCageVisualBinding, ORIGINAL_CAGE_STRUCTURAL_VISUALS } from '../src/championship/presentation/originalCageVisualBindings.js';

const repo = new URL('../', import.meta.url);
const readJson = path => JSON.parse(readFileSync(new URL(path, repo), 'utf8'));
const manifest = readJson('assets/production/cage/licensed-runtime-v1/manifest.json');
const ground = readJson('src/data/championship/catalogs/raising-ground.r1.json');
const fields = new Map(manifest.fields.map(field => [field.fieldId, field]));

// 8-bit RGBA, non-interlaced — the only form the cage bundle uses (checked on
// all 40 frames). Anything else is refused rather than misread.
function decodeRgbaPng(bytes) {
  assert.equal(bytes.readUInt32BE(12), 0x49484452, 'PNG_IHDR_REQUIRED');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert.deepEqual([bytes[24], bytes[25], bytes[28]], [8, 6, 0], 'PNG_RGBA8_NON_INTERLACED_REQUIRED');
  const idat = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * 4, out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const at = y * stride, up = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[at + x - 4] : 0, b = y > 0 ? out[up + x] : 0, c = x >= 4 && y > 0 ? out[up + x - 4] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else assert.equal(filter, 0, 'PNG_FILTER_UNKNOWN');
      out[at + x] = v & 0xff;
    }
  }
  return { width, height, rgba: out };
}

const nativeAlpha = new Map();
function fieldAlpha(fieldId) {
  if (nativeAlpha.has(fieldId)) return nativeAlpha.get(fieldId);
  const field = fields.get(fieldId), unit = field.worldWidthPx / field.nativeWidthPx;
  const png = decodeRgbaPng(readFileSync(new URL(field.frames[0].src, repo)));
  assert.deepEqual([png.width, png.height], [field.worldWidthPx, field.worldHeightPx], `FRAME_SIZE:${fieldId}`);
  const alpha = new Uint8Array(field.nativeWidthPx * field.nativeHeightPx);
  for (let y = 0; y < field.nativeHeightPx; y++) for (let x = 0; x < field.nativeWidthPx; x++)
    alpha[y * field.nativeWidthPx + x] = png.rgba[(y * unit * png.width + x * unit) * 4 + 3];
  const record = { unit, width: field.nativeWidthPx, height: field.nativeHeightPx, alpha };
  nativeAlpha.set(fieldId, record);
  return record;
}

const definitions = listCageDefinitions();
const moduleOf = index => definitions.find(definition => definition.cageDefinitionIndex === index).moduleId;

/** Compose the art plan onto a native-pixel board and check every walkable block. */
function uncoveredWalkableBlocks(unlockedCount, placements) {
  const frame = { layoutVersion: NATIVE_RANCH_LAYOUT, unlockedCount, placements };
  const board = createNativeRaisingGround(frame);
  const plan = createRaisingCageArtPlan({ manifest, placements, layoutVersion: NATIVE_RANCH_LAYOUT, unlockedCount });
  const width = board.pixelWidth, height = board.height * 8, drawn = new Uint8Array(width * height);
  for (const placement of plan.placements) {
    const art = fieldAlpha(placement.fieldId), s = placement.sourceRect, unit = art.unit;
    const [sx, sy, sw, sh] = [s.x / unit, s.y / unit, s.width / unit, s.height / unit];
    const [dx, dy] = [placement.x / unit, placement.y / unit];
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const bx = dx + x, by = dy + y;
      if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
      if (art.alpha[(sy + y) * art.width + sx + x]) drawn[by * width + bx] = 1;
    }
  }
  const misses = [];
  for (let ty = 0; ty < board.height; ty++) for (let tx = 0; tx < board.width; tx++) {
    const i = ty * board.width + tx;
    if (board.terrain[i] === 1 || board.owners[i] < 0 || board.owners[i] === 36) continue;
    let covered = true;
    for (let y = 0; y < 8 && covered; y++) for (let x = 0; x < 8; x++) if (!drawn[(ty * 8 + y) * width + tx * 8 + x]) { covered = false; break; }
    if (!covered) misses.push({ definition: board.owners[i], tx, ty });
  }
  return misses;
}

test('every original ground field has exactly its cage picture size', () => {
  assert.equal(ground.fields.length, 37);
  for (const field of ground.fields) {
    const fieldId = field.definitionIndex === 36 ? ORIGINAL_CAGE_STRUCTURAL_VISUALS[0].fieldId
      : getOriginalCageVisualBinding(field.definitionIndex).fieldId;
    const art = fields.get(fieldId);
    assert.deepEqual([field.width * 8, field.height * 8], [art.nativeWidthPx, art.nativeHeightPx], `definition ${field.definitionIndex}`);
  }
});

test('starting ranch: walkable ground is fully drawn at all four ranch sizes', () => {
  const placements = [[35, 0], [0, 8], [1, 4], [15, 7]].map(([index, slotIndex]) => ({ moduleId: moduleOf(index), slotIndex }));
  for (const unlockedCount of [14, 16, 18, 20]) assert.deepEqual(uncoveredWalkableBlocks(unlockedCount, placements), [], `ranch ${unlockedCount}`);
});

test('every shop cage, in each board row it may occupy, stands its residents on drawn floor', () => {
  let checked = 0;
  for (let index = 0; index < 35; index++) {
    for (const row of [0, 1]) {
      for (const unlockedCount of [14, 20]) {
        let slotIndex = null;
        for (let slot = 4; slot < unlockedCount; slot++) {
          if (slot % 2 !== row) continue;
          const candidate = [{ moduleId: WAITING_ROOM_MODULE, slotIndex: 0 }, { moduleId: moduleOf(index), slotIndex: slot }];
          if (validateNativeRanch(candidate, unlockedCount)) { slotIndex = slot; break; }
        }
        if (slotIndex === null) continue; // two-row shapes may not start in the lower row
        const placements = [{ moduleId: WAITING_ROOM_MODULE, slotIndex: 0 }, { moduleId: moduleOf(index), slotIndex }];
        assert.deepEqual(uncoveredWalkableBlocks(unlockedCount, placements), [], `cage ${index} slot ${slotIndex} ranch ${unlockedCount}`);
        checked++;
      }
      // The rightmost legal slot wraps a wide cage's right strip onto the left edge.
      const unlockedCount = 14;
      for (let slot = unlockedCount - 1; slot >= 4; slot--) {
        if (slot % 2 !== row) continue;
        const placements = [{ moduleId: WAITING_ROOM_MODULE, slotIndex: 0 }, { moduleId: moduleOf(index), slotIndex: slot }];
        if (!validateNativeRanch(placements, unlockedCount)) continue;
        assert.deepEqual(uncoveredWalkableBlocks(unlockedCount, placements), [], `cage ${index} last slot ${slot}`);
        checked++;
        break;
      }
    }
  }
  assert.ok(checked >= 70, `only ${checked} placements were legal`);
});
