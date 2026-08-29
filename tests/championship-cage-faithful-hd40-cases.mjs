import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import {
  parseOriginalCageAtr,
  parseOriginalCageCol,
  parseOriginalCageNbs,
  parseOriginalCageOpm,
} from "../scripts/lib/cage-original-formats.mjs";

const root = "docs/art/production/cage/faithful-hd40";
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("faithful Cage HD baseline covers all 40 original visual fields", () => {
  assert.equal(manifest.fieldCount, 40);
  assert.equal(manifest.fields.length, 40);
  assert.equal(new Set(manifest.fields.map((field) => field.fieldId)).size, 40);
  assert.equal(manifest.fullCompositionConfidenceCount, 38);
  assert.deepEqual(manifest.partialObjectConflictFields, ["field_cm12_01", "field_cm18_01"]);
  assert.match(manifest.visualPolicy, /NO_RELAYOUT_NO_RECOLOR_NO_REDESIGN/);
  assert.equal(manifest.runtimeEligible, false);
  assert.equal(manifest.shippingReady, false);
});

test("every HD image is exactly 4x the verified native dimensions and all derived files are hash locked", () => {
  for (const field of manifest.fields) {
    assert.equal(field.faithfulHd4x.scale, 4);
    assert.equal(field.faithfulHd4x.filter, "NEAREST");
    assert.equal(field.faithfulHd4x.width, field.nativeOriginal.width * 4);
    assert.equal(field.faithfulHd4x.height, field.nativeOriginal.height * 4);
    assert.equal(field.faithfulHd4x.downsampleRoundTripEqualsOriginal, true);
    for (const record of [field.nativeOriginal, field.faithfulHd4x, field.coreTilemap, field.collision, field.attribute, field.objectPlacement]) {
      const file = `${root}/${record.file}`;
      assert.equal(fs.existsSync(file), true, file);
      assert.equal(digest(file), record.sha256, file);
    }
  }
});

test("collision, attribute, tilemap and placement data preserve original raw classes and coordinates", () => {
  for (const field of manifest.fields) {
    const tilemap = JSON.parse(fs.readFileSync(`${root}/${field.coreTilemap.file}`, "utf8"));
    const collision = JSON.parse(fs.readFileSync(`${root}/${field.collision.file}`, "utf8"));
    const attribute = JSON.parse(fs.readFileSync(`${root}/${field.attribute.file}`, "utf8"));
    const placement = JSON.parse(fs.readFileSync(`${root}/${field.objectPlacement.file}`, "utf8"));
    assert.equal(collision.cells.length, collision.width * collision.height);
    assert.equal(attribute.cells.length, attribute.width * attribute.height);
    assert.equal(tilemap.cells.length, tilemap.width * tilemap.height);
    assert.deepEqual([collision.width, collision.height], [tilemap.width, tilemap.height]);
    assert.deepEqual([attribute.width, attribute.height], [tilemap.width, tilemap.height]);
    assert.equal(collision.classSemantics, "RAW_CLASS_XX_NOT_REINTERPRETED");
    assert.equal(attribute.classSemantics, "RAW_CLASS_XX_NOT_REINTERPRETED");
    assert.equal(placement.placementCount, placement.placements.length);
    assert.equal(field.objectPlacement.count, placement.placementCount);
    for (const item of placement.placements) {
      assert.equal(item.coordinateAuthority, "VERIFIED_SOURCE_REFERENCE_COORDINATES");
    }
    if (manifest.partialObjectConflictFields.includes(field.fieldId)) {
      assert.equal(placement.quarantined, true);
      assert.equal(placement.authority, "ORIGINAL_OBJECT_INDEX_CONFLICT_DO_NOT_BIND");
    } else {
      assert.equal(placement.quarantined, false);
    }
  }
  assert.equal(manifest.qa.objectPlacementRelayoutPerformed, false);
  assert.equal(manifest.qa.unknownClassSemanticsInvented, false);
});

test("browser-side original Cage format parsers preserve raw values", () => {
  const col = parseOriginalCageCol(Uint8Array.of(1, 2, 2, 0, 1, 2, 3));
  assert.deepEqual([...col.cells], [0, 1, 2, 3]);

  const atrBytes = new Uint8Array(20);
  atrBytes.set(new TextEncoder().encode("DATR"));
  const atrView = new DataView(atrBytes.buffer);
  atrView.setUint32(4, 2, true);
  atrView.setUint32(8, 2, true);
  atrView.setUint32(12, 2, true);
  atrBytes.set([1, 0, 1, 0], 16);
  assert.deepEqual([...parseOriginalCageAtr(atrBytes).cells], [1, 0, 1, 0]);

  const nbsBytes = new Uint8Array(24);
  nbsBytes.set(new TextEncoder().encode("NBSR"));
  const nbsView = new DataView(nbsBytes.buffer);
  nbsView.setUint32(4, 2, true);
  nbsView.setUint32(8, 2, true);
  nbsView.setUint32(12, 1, true);
  nbsView.setUint32(16, 1, true);
  nbsView.setUint16(20, 7 | 0x0400, true);
  nbsView.setUint16(22, 9 | 0x0800, true);
  const nbs = parseOriginalCageNbs(nbsBytes);
  assert.deepEqual(nbs.cells.map(({ tileIndex, horizontalFlip, verticalFlip }) => [tileIndex, horizontalFlip, verticalFlip]), [[7, true, false], [9, false, true]]);

  const opmBytes = new Uint8Array(36);
  opmBytes.set(new TextEncoder().encode("OPMD"));
  const opmView = new DataView(opmBytes.buffer);
  opmView.setUint32(4, 4, true);
  opmBytes[8] = 3;
  opmBytes.set(new TextEncoder().encode("obj"), 9);
  opmView.setUint32(16, 1, true);
  opmView.setUint16(20, 2, true);
  opmView.setUint16(22, 68, true);
  opmView.setUint16(24, 88, true);
  opmView.setFloat32(28, 1, true);
  const opm = parseOriginalCageOpm(opmBytes);
  assert.equal(opm.placementCount, 1);
  assert.deepEqual([opm.placements[0].cellId, opm.placements[0].sourceX, opm.placements[0].sourceY], [2, 68, 88]);
});
