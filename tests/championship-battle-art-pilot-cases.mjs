import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const pilotRoot = path.join(root, "docs/art/production/battle/bm00-bm01-pilot");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const manifest = readJson("docs/art/production/battle/bm00-bm01-pilot/manifest.json");
const receipt = readJson("docs/art/production/battle/bm00-bm01-pilot/receipt.json");
const crosswalk = readJson("docs/art/ART_PRODUCTION_CROSSWALK.json");

function pngHeader(file) {
  const bytes = fs.readFileSync(file);
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25]
  };
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

test("Battle pilot keeps BM00 canonical and BM01 dependency-only", () => {
  assert.equal(manifest.assets.length, 2);
  assert.equal(manifest.assets[0].id, "production:battle:shared:field-bm00-00");
  assert.deepEqual(manifest.assets[0].dependencies, []);
  assert.equal(manifest.assets[1].id, "production:battle:arena:field-bm01-01");
  assert.deepEqual(manifest.assets[1].dependencies, [manifest.assets[0].id]);

  const byId = new Map(crosswalk.records.map((record) => [record.productionAssetId, record]));
  assert.ok(byId.has(manifest.assets[0].id));
  assert.deepEqual(byId.get(manifest.assets[1].id).productionDependencies, [manifest.assets[0].id]);
});

test("Battle pilot review files have the required dimensions and alpha roles", () => {
  const shared = path.join(pilotRoot, receipt.sharedLayer.file);
  const arena = path.join(pilotRoot, receipt.arena.file);
  const composite = path.join(pilotRoot, receipt.compositeReview.file);
  assert.deepEqual(pngHeader(shared), { width: 1536, height: 1024, colorType: 6 });
  assert.deepEqual(pngHeader(arena), { width: 1536, height: 1024, colorType: 2 });
  assert.deepEqual(pngHeader(composite), { width: 1536, height: 1024, colorType: 2 });
  assert.equal(receipt.sharedLayer.transparentRgbZero, true);
  assert.deepEqual(receipt.sharedLayer.alphaRange, [0, 255]);
  assert.equal(sha256(shared), receipt.sharedLayer.sha256);
  assert.equal(sha256(arena), receipt.arena.sha256);
  assert.equal(sha256(composite), receipt.compositeReview.sha256);
});

test("standing-zone rings are exact mirrored pairs on one perspective axis", () => {
  const geometry = receipt.sharedLayer.standingZoneGeometry;
  assert.equal(geometry.centerAxisX, 768);
  assert.equal(geometry.rows.length, 3);
  assert.deepEqual(geometry.rows.map((row) => row.name), ["rear", "middle", "front"]);
  assert.ok(geometry.rows[0].width < geometry.rows[1].width);
  assert.ok(geometry.rows[1].width < geometry.rows[2].width);
  assert.ok(geometry.rows[0].height < geometry.rows[1].height);
  assert.ok(geometry.rows[1].height < geometry.rows[2].height);
  for (const row of geometry.rows) {
    const leftX = geometry.centerAxisX - row.centerOffsetX;
    const rightX = geometry.centerAxisX + row.centerOffsetX;
    assert.equal(leftX + rightX, geometry.centerAxisX * 2);
    assert.ok(leftX - row.width / 2 > 0);
    assert.ok(rightX + row.width / 2 < 1536);
  }
  assert.deepEqual(manifest.assets[0].standingZoneGeometry.rows, geometry.rows);
});

test("Battle pilot checks every contract viewport but promotes nothing", () => {
  assert.deepEqual(receipt.viewportChecks.map((entry) => entry.viewport), [
    [360, 800],
    [390, 844],
    [393, 852],
    [412, 915],
    [430, 932]
  ]);
  for (const entry of receipt.viewportChecks) {
    const file = path.join(pilotRoot, entry.file);
    assert.deepEqual(pngHeader(file).width, entry.viewport[0]);
    assert.deepEqual(pngHeader(file).height, entry.viewport[1]);
    assert.equal(sha256(file), entry.sha256);
  }
  assert.equal(manifest.promotion.runtimeIndexEntry, true);
  assert.equal(receipt.promotion.humanApproved, true);
  assert.equal(receipt.promotion.runtimeQaPassed, null);
  assert.match(receipt.promotion.runtimeQaAuthority, /browser-qa\.json$/);
  assert.equal(receipt.promotion.readyForRuntime, false);
  assert.equal(receipt.promotion.shippingReady, false);
});
