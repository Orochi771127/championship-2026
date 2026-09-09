import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const batch = path.join(root, 'docs/art/production/battle/light-fence-pilot-r1');
const manifest = JSON.parse(fs.readFileSync(path.join(batch, 'manifest.json'), 'utf8'));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').toUpperCase();

test('light-fence pilot records the Owner decision and remains internal-only', () => {
  assert.equal(manifest.ownerDecision, 'CANCEL_HEAVY_STONE_RING_USE_LIGHT_METAL_FENCE');
  assert.equal(manifest.runtimeMutation, false);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
  assert.equal(manifest.referencePixelsInOutputs, false);
});

test('pilot is bounded to BM08 and BM10 with product-authored fixed geometry', () => {
  assert.deepEqual(manifest.assets.map(asset => asset.fieldId), ['field_bm08_01', 'field_bm10_01']);
  assert.equal(manifest.geometryConstraint.floorTopY, 301);
  assert.equal(manifest.geometryConstraint.slotBoxes.length, 6);
  assert.match(manifest.geometryConstraint.claim, /NOT_ROM_VERIFIED/);
});

test('each field has a distinct adapted fence, contact shadow, background, and composite', () => {
  const fenceHashes = new Set();
  for (const asset of manifest.assets) {
    for (const item of [asset.background, asset.adaptedFence, asset.contactShadow, asset.composites[0], asset.layoutPreview]) {
      assert.equal(digest(item.file), item.sha256);
    }
    fenceHashes.add(asset.adaptedFence.sha256);
  }
  assert.equal(fenceHashes.size, 2);
});

test('neutral shared layer is reproducible and does not reuse the rejected stone-ring asset', () => {
  assert.equal(digest(manifest.sharedLayer.file), manifest.sharedLayer.sha256);
  assert.match(manifest.sharedLayer.file, /light-metal-fence-neutral\.png$/);
  assert.doesNotMatch(JSON.stringify(manifest), /human-paint-migration-r4\/review\/layers/);
});
