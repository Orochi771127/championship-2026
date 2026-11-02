// Owner 2026-11-02: the shop and the facility editor show each cage as the ranch draws it:
// renders of the 3D cage models (ranchThreeScene, layout view 52 deg, 4 px per native px).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import threeUi from '../assets/production/public-runtime/cage-ui-three.v1.json' with { type: 'json' };
import uiMap from '../assets/production/public-runtime/cage-ui.map.v1.json' with { type: 'json' };
import models from '../assets/production/cage/three-20261021/manifest.json' with { type: 'json' };
import { validateCageThreeUi, cageUiImage, cageUiThumbnail, shopCageUiImage, cageUiLidImage } from '../src/championship/presentation/cageUiArt.js';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { getOriginalCageVisualBinding } from '../src/championship/presentation/originalCageVisualBindings.js';

const sha = (path) => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const webpSize = (bytes) => {
  // RIFF....WEBPVP8X: canvas width-1 / height-1 as 24-bit little endian at 24 / 27.
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(bytes.toString('ascii', 12, 16), 'VP8X', 'an alpha WebP carries a VP8X header');
  return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
};

test('37 renders, one per runtime field: exact files, sizes and the GLB each was rendered from', () => {
  assert.equal(threeUi.fields.length, uiMap.fields.length);
  for (const row of threeUi.fields) {
    const field = uiMap.fields.find((f) => f.fieldId === row.fieldId);
    const model = models.fields.find((f) => f.fieldId === row.fieldId);
    assert.ok(field && model, row.fieldId);
    // A changed cage model must be rendered again (pack_ui_three.py).
    assert.equal(row.modelSha256, model.sha256, `${row.fieldId} picture is stale against its GLB`);
    for (const [image, size] of [[row.frame, [field.worldWidthPx, field.worldHeightPx]], [row.thumbnail, [256, 192]]]) {
      assert.equal(sha(image.src), image.sha256, image.src);
      assert.deepEqual([image.width, image.height], size, image.src);
      assert.deepEqual(webpSize(fs.readFileSync(image.src)), size, image.src);
    }
  }
});

test('the runtime check rejects a wrong size, a foreign path, a missing field or a bad hash', () => {
  for (const change of [
    (m) => { m.fields[0].frame.width += 1; },
    (m) => { m.fields[0].thumbnail.src = 'assets/production/cage/three-20261021/x.webp'; },
    (m) => { m.fields[0].frame.src = 'assets/production/cage/ui-three-20261102/../x.webp'; },
    (m) => { m.fields.pop(); },
    (m) => { m.fields[1] = m.fields[0]; },
    (m) => { m.fields[0].modelSha256 = 'x'; },
    (m) => { m.assetId = 'art:cage:other'; }
  ]) {
    const copy = structuredClone(threeUi); change(copy);
    assert.throws(() => validateCageThreeUi(copy), /CAGE_THREE_UI_INVALID/);
  }
});

test('shop cards, the editor, the lid and location markers all use the renders', () => {
  for (const definition of listCageDefinitions()) {
    const row = threeUi.fields.find((f) => f.fieldId === getOriginalCageVisualBinding(definition.cageDefinitionIndex).fieldId);
    assert.equal(cageUiImage(definition.moduleId), row.frame.src);
    assert.equal(cageUiThumbnail(definition.moduleId), row.thumbnail.src);
    if (definition.shopRecordIndex !== null) assert.equal(shopCageUiImage(definition.shopRecordIndex), row.thumbnail.src);
  }
  assert.equal(cageUiLidImage(), threeUi.fields.find((f) => f.fieldId === 'field_cm29_01').frame.src);
  assert.equal(cageUiThumbnail(null), null);
});
