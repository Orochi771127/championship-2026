import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import {
  parseOriginalCageAtr,
  parseOriginalCageBsar,
  parseOriginalCageCol,
  parseOriginalCageNbs,
  parseOriginalCageOpm,
} from "../scripts/lib/cage-original-formats.mjs";

const root = "docs/art/production/cage/faithful-hd40";
const ownerDirectives = JSON.parse(fs.readFileSync("docs/art/production/cage/CAGE_OWNER_ADAPTATION_DIRECTIVES.json", "utf8"));

test("CM27 remake removes the center Digimon mark without rewriting the exact reference baseline", () => {
  assert.equal(ownerDirectives.baselinePolicy, "KEEP_EXACT_ORIGINAL_REFERENCE_UNCHANGED_FOR_COMPARISON");
  assert.equal(ownerDirectives.directives.length, 1);
  const directive = ownerDirectives.directives[0];
  assert.equal(directive.directiveId, "CAGE-CM27-REMOVE-CENTER-DIGIMON-MARK");
  assert.equal(directive.fieldId, "field_cm27_01");
  assert.equal(directive.instruction, "REMOVE_FROM_REMADE_ART");
  assert.ok(directive.appliesTo.includes("SHIPPING_ART"));
  assert.ok(directive.doesNotApplyTo.includes("EXACT_ORIGINAL_REFERENCE_BASELINE"));
  assert.match(directive.dataBoundary, /PRESERVE_ORIGINAL_LAYOUT_COLLISION_ATTRIBUTE_AND_PLACEMENT_DATA/);
});
const manifest = JSON.parse(fs.readFileSync(`${root}/manifest.json`, "utf8"));
const digest = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

test("faithful Cage HD baseline covers all 40 original visual fields", () => {
  assert.equal(manifest.fieldCount, 40);
  assert.equal(manifest.fields.length, 40);
  assert.equal(new Set(manifest.fields.map((field) => field.fieldId)).size, 40);
  assert.equal(manifest.fullCompositionConfidenceCount, 38);
  assert.deepEqual(manifest.partialObjectConflictFields, ["field_cm12_01", "field_cm18_01"]);
  assert.equal(manifest.animatedLayerFieldCount, 4);
  assert.deepEqual(manifest.animatedLayerFields, ["field_cm07_01", "field_cm09_01", "field_cm21_01", "field_cm39_01"]);
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
    const records = [field.nativeOriginal, field.faithfulHd4x, field.coreTilemap, field.collision, field.attribute, field.objectPlacement];
    records.push(
      { file: field.exactStaticAssembly.coreFile, sha256: field.exactStaticAssembly.coreSha256 },
      { file: field.exactStaticAssembly.staticCompositeFile, sha256: field.exactStaticAssembly.staticCompositeSha256 },
    );
    if (field.objectCellBank.status !== "NOT_PRESENT") records.push(field.objectCellBank);
    if (field.animatedLayer.status === "PRESENT_VERIFIED_ROM_DECODED") {
      records.push(field.animatedLayer, ...field.animatedLayer.layerFrames, field.animatedLayer.alternateCompositeFrame, field.animatedLayer.alternateFaithfulHd4xFrame);
      assert.equal(field.animatedLayer.frameCount, 2);
      assert.notEqual(field.nativeOriginal.sha256, field.nativeOriginal.staticCoreObjectSourceSha256);
    }
    for (const record of records) {
      const file = `${root}/${record.file}`;
      assert.equal(fs.existsSync(file), true, file);
      assert.equal(digest(file), record.sha256, file);
    }
    if (field.objectCellBank.status !== "NOT_PRESENT") {
      const bank = JSON.parse(fs.readFileSync(`${root}/${field.objectCellBank.file}`, "utf8"));
      assert.equal(bank.renderedCells.length, field.objectCellBank.renderedCellCount);
      for (const cell of bank.renderedCells) {
        const file = `${root}/${cell.file}`;
        assert.equal(fs.existsSync(file), true, file);
        assert.equal(digest(file), cell.sha256, file);
      }
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
    assert.equal(tilemap.format, "YDIJ_NBSR_DIRECT14_TILEMAP_V2");
    assert.equal(tilemap.tileEntrySemantics, "DIRECT_14_BIT_TILE_INDEX_PLUS_HIGH_2_FLIP_FLAGS");
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
  assert.equal(manifest.qa.allFourAnimatedLayerBundlesDecoded, true);
  assert.equal(manifest.qa.animatedLayerFramesDecoded, 8);
  assert.equal(manifest.qa.all40CoreAndStaticLayersRecomposedPixelExactly, true);
  assert.equal(manifest.qa.objectCellBanksExactlyRecomposed, 36);
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
  nbsView.setUint16(20, 7 | 0x4000, true);
  nbsView.setUint16(22, 4097 | 0x8000, true);
  const nbs = parseOriginalCageNbs(nbsBytes);
  assert.equal(nbs.format, "YDIJ_NBSR_DIRECT14_TILEMAP_V2");
  assert.deepEqual(nbs.cells.map(({ tileIndex, horizontalFlip, verticalFlip }) => [tileIndex, horizontalFlip, verticalFlip]), [[7, true, false], [4097, false, true]]);

  const opmBytes = new Uint8Array(36);
  opmBytes.set(new TextEncoder().encode("OPMD"));
  const opmView = new DataView(opmBytes.buffer);
  opmView.setUint32(4, 4, true);
  opmBytes[8] = 3;
  opmBytes.set(new TextEncoder().encode("obj"), 9);
  opmView.setUint32(16, 1, true);
  opmView.setUint16(20, 2 | 0x4000, true);
  opmView.setUint16(22, 68, true);
  opmView.setUint16(24, 88, true);
  opmView.setFloat32(28, 1, true);
  const opm = parseOriginalCageOpm(opmBytes);
  assert.equal(opm.placementCount, 1);
  assert.deepEqual([opm.placements[0].cellId, opm.placements[0].sourceX, opm.placements[0].sourceY], [2, 68, 88]);
  assert.deepEqual(
    [opm.placements[0].rawCellWord, opm.placements[0].horizontalFlip, opm.placements[0].verticalFlip],
    [2 | 0x4000, false, true],
  );

  const bsarBytes = new Uint8Array(46);
  bsarBytes.set(new TextEncoder().encode("BSAR"));
  const bsarView = new DataView(bsarBytes.buffer);
  bsarView.setUint32(4, 2, true);
  bsarView.setUint32(8, 1, true);
  bsarView.setUint32(12, 2, true);
  bsarView.setUint32(16, 1, true);
  bsarView.setUint32(20, 20, true);
  bsarView.setUint32(24, 20, true);
  bsarView.setUint32(28, 1, true);
  bsarView.setUint32(32, 1, true);
  bsarView.setUint16(36, 0, true);
  bsarView.setUint32(38, 1, true);
  bsarView.setUint16(42, 3 | 0x0400, true);
  bsarView.setUint16(44, 5 | 0x0800, true);
  const bsar = parseOriginalCageBsar(bsarBytes);
  assert.deepEqual([bsar.frameCount, bsar.width, bsar.height, bsar.symbolCount], [2, 1, 1, 1]);
  assert.deepEqual(bsar.symbols[0].frameTileEntries.map(({ tileIndex, horizontalFlip, verticalFlip }) => [tileIndex, horizontalFlip, verticalFlip]), [[3, true, false], [5, false, true]]);
});
