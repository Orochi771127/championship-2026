import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {isPrivateRepositoryPath, publicArtIndex} from '../scripts/lib/public-art-boundary.mjs';

const root = process.cwd();
const remixRoot = path.join(root, "docs/art/production/characters/cat-dog-remix-v1");
const seedRoot = path.join(remixRoot, "m201-seed");
const workPacket = JSON.parse(fs.readFileSync(path.join(remixRoot, "m201-work-packet.json"), "utf8"));
const candidates = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-main-12-high-risk-remix-candidates.json"), "utf8"));
const sourceGuides = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-main-12-high-risk-source-guides.json"), "utf8"));
const all83Reuse = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-all83-source-reuse.json"), "utf8"));
const motionClosure = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-01-candidates.json"), "utf8"));
const motionClosure02 = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-02-candidates.json"), "utf8"));
const motionClosure03 = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-03-candidates.json"), "utf8"));
const motionClosure04 = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-04-candidates.json"), "utf8"));
const motionClosure05 = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-05-candidates.json"), "utf8"));
const motionClosure06 = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-06-candidates.json"), "utf8"));
const motionClosure07 = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-07-candidates.json"), "utf8"));
const reviewRoot = path.join(root, "assets/production/internal-character-review/m201-remix-v1");
const reviewManifest = JSON.parse(fs.readFileSync(path.join(reviewRoot, "manifest.json"), "utf8"));
const reviewRuntime = JSON.parse(fs.readFileSync(path.join(reviewRoot, "runtime.review.json"), "utf8"));
const motionClosureCells = [1, 5, 12, 50, 54];
const motionClosure02Cells = [2, 3, 8, 13, 14, 24];
const motionClosure03Cells = [19, 22, 25];
const motionClosure04Cells = [44, 47];
const motionClosure05Cells = [26, 48, 51, 52];
const motionClosure06Cells = [27, 28, 29, 30, 32, 35, 36, 37, 39, 40, 41, 42];
const motionClosure07Cells = [55, 57, 58, 59, 60, 61, 64];

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();
}

function readPngHeader(file) {
  const data = fs.readFileSync(file);
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data[25]
  };
}

test("M201 high-risk packet preserves twelve slots and nine unique ROM drawings", () => {
  assert.deepEqual(workPacket.keyPoseCells, [0, 4, 6, 9, 11, 15, 23, 49, 53, 56, 62, 63]);
  assert.equal(workPacket.keyPoseDecodedArt.requestedPoseSlotCount, 12);
  assert.equal(workPacket.keyPoseDecodedArt.uniqueSourcePoseCount, 9);
  assert.equal(sourceGuides.requestedPoseSlotCount, 12);
  assert.equal(sourceGuides.uniqueDecodedSourcePoseCount, 9);
  assert.deepEqual(sourceGuides.sourceReuseGroups.filter((group) => group.cells.length > 1), [
    { canonicalCell: 0, cells: [0, 4, 6] },
    { canonicalCell: 11, cells: [11, 15] }
  ]);
});

test("all twelve M201 candidates are 384x352 RGBA PNGs with hash-locked QA", () => {
  assert.equal(candidates.poseSlotCount, 12);
  assert.equal(candidates.cells.length, 12);
  assert.equal(candidates.state, "TWELVE_OF_TWELVE_TECHNICAL_CANDIDATES_VISUAL_LANDMARK_REVIEW_REQUIRED");
  for (const entry of candidates.cells) {
    const candidatePath = path.join(root, entry.candidate);
    const qaPath = path.join(root, entry.qa);
    assert.equal(fs.existsSync(candidatePath), true, entry.candidate);
    assert.equal(fs.existsSync(qaPath), true, entry.qa);
    assert.deepEqual(readPngHeader(candidatePath), { width: 384, height: 352, colorType: 6 });
    assert.equal(sha256(candidatePath), entry.candidateSha256);
    const qa = JSON.parse(fs.readFileSync(qaPath, "utf8"));
    assert.equal(qa.outputSha256, entry.candidateSha256);
    assert.equal(qa.checks.canvas384x352, true);
    assert.equal(qa.checks.rgba, true);
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    assert.equal(qa.sourceFacing, entry.sourceFacing);
    assert.equal(qa.runtimeEligible, false);
  }
});

test("pixel-identical ROM source cells reuse byte-identical remix candidates", () => {
  const byCell = new Map(candidates.cells.map((entry) => [entry.cell, entry]));
  assert.equal(byCell.get(0).candidateSha256, byCell.get(4).candidateSha256);
  assert.equal(byCell.get(0).candidateSha256, byCell.get(6).candidateSha256);
  assert.equal(byCell.get(11).candidateSha256, byCell.get(15).candidateSha256);
});

test("the first motion-family closure imports five canonical redraws with exact reuse", () => {
  assert.equal(motionClosure.batch, "MOTION_FAMILY_CLOSURE_01");
  assert.equal(motionClosure.canonicalCellCount, 5);
  assert.deepEqual(motionClosure.cells.map((entry) => entry.cell), motionClosureCells);
  assert.equal(sha256(path.join(root, motionClosure.contactSheet)), motionClosure.contactSheetSha256);
  assert.equal(motionClosure.runtimeEligible, false);
  assert.equal(motionClosure.shippingReady, false);
  const expectedReuse = new Map([
    [1, ["main:1", "sub:1"]],
    [5, ["main:5", "main:7"]],
    [12, ["main:12", "main:16"]],
    [50, ["main:50", "sub:10"]],
    [54, ["main:54", "sub:14"]]
  ]);
  for (const cell of motionClosureCells) {
    const candidate = path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate.png`);
    const qa = JSON.parse(fs.readFileSync(
      path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate-qa.json`),
      "utf8"
    ));
    assert.deepEqual(readPngHeader(candidate), { width: 384, height: 352, colorType: 6 });
    assert.equal(qa.outputSha256, sha256(candidate));
    assert.equal(qa.checks.canvas384x352, true);
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    const group = all83Reuse.reuseGroups.find(
      (entry) => entry.canonical.side === "main" && entry.canonical.cell === cell
    );
    assert.ok(group, `missing reuse group for Main Cell ${cell}`);
    assert.equal(group.candidateState, "TECHNICAL_CANDIDATE_AVAILABLE_VISUAL_REVIEW_REQUIRED");
    assert.deepEqual(
      group.members.map((entry) => `${entry.side}:${entry.cell}`),
      expectedReuse.get(cell)
    );
  }
});

test("the second motion-family closure imports six redraws and reaches fourteen runtime slots", () => {
  assert.equal(motionClosure02.batch, "MOTION_FAMILY_CLOSURE_02");
  assert.equal(motionClosure02.canonicalCellCount, 6);
  assert.deepEqual(motionClosure02.cells.map((entry) => entry.cell), motionClosure02Cells);
  assert.equal(sha256(path.join(root, motionClosure02.contactSheet)), motionClosure02.contactSheetSha256);
  assert.equal(motionClosure02.runtimeEligible, false);
  assert.equal(motionClosure02.shippingReady, false);
  const expectedReuse = new Map([
    [2, ["main:2", "main:21", "sub:2"]],
    [3, ["main:3", "sub:3"]],
    [8, ["main:8", "main:20", "main:45"]],
    [13, ["main:13", "main:17"]],
    [14, ["main:14", "main:18"]],
    [24, ["main:24"]]
  ]);
  for (const cell of motionClosure02Cells) {
    const candidate = path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate.png`);
    const qa = JSON.parse(fs.readFileSync(
      path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate-qa.json`),
      "utf8"
    ));
    assert.deepEqual(readPngHeader(candidate), { width: 384, height: 352, colorType: 6 });
    assert.equal(qa.outputSha256, sha256(candidate));
    assert.equal(qa.checks.canvas384x352, true);
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    const group = all83Reuse.reuseGroups.find(
      (entry) => entry.canonical.side === "main" && entry.canonical.cell === cell
    );
    assert.ok(group, `missing reuse group for Main Cell ${cell}`);
    assert.equal(group.candidateState, "TECHNICAL_CANDIDATE_AVAILABLE_VISUAL_REVIEW_REQUIRED");
    assert.deepEqual(group.members.map((entry) => `${entry.side}:${entry.cell}`), expectedReuse.get(cell));
  }
  for (const family of [
    "raw-motion-family-04-idle-alert-v1",
    "raw-motion-family-05-attack-eat-v1"
  ]) {
    const strip = path.join(seedRoot, `${family}.png`);
    const receipt = JSON.parse(fs.readFileSync(path.join(seedRoot, `${family}-normalization-receipt.json`), "utf8"));
    assert.equal(readPngHeader(strip).colorType, 6);
    assert.equal(receipt.backgroundExtraction, "EDGE_CONNECTED_BRIGHT_NEUTRAL_CHECKERBOARD");
    assert.ok(receipt.removedBackgroundPixels > 0);
    assert.equal(receipt.candidateStripSha256, sha256(strip));
  }
});

test("the third motion-family closure finishes flee and tired-walk without cross-slot fragments", () => {
  assert.equal(motionClosure03.batch, "MOTION_FAMILY_CLOSURE_03");
  assert.equal(motionClosure03.canonicalCellCount, 3);
  assert.deepEqual(motionClosure03.cells.map((entry) => entry.cell), motionClosure03Cells);
  assert.equal(sha256(path.join(root, motionClosure03.contactSheet)), motionClosure03.contactSheetSha256);
  const expectedReuse = new Map([
    [19, ["main:19"]],
    [22, ["main:22"]],
    [25, ["main:25", "main:53", "sub:13"]]
  ]);
  for (const cell of motionClosure03Cells) {
    const candidate = path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate.png`);
    const qa = JSON.parse(fs.readFileSync(
      path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate-qa.json`),
      "utf8"
    ));
    assert.deepEqual(readPngHeader(candidate), { width: 384, height: 352, colorType: 6 });
    assert.equal(qa.outputSha256, sha256(candidate));
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    assert.ok(qa.candidateAlphaBounds[0] > 0, `detached fragment reached left edge for Cell ${cell}`);
    const group = all83Reuse.reuseGroups.find(
      (entry) => entry.canonical.side === "main" && entry.canonical.cell === cell
    );
    assert.deepEqual(group.members.map((entry) => `${entry.side}:${entry.cell}`), expectedReuse.get(cell));
  }
  const family = "raw-motion-family-06-continuity-v1";
  const strip = path.join(seedRoot, `${family}.png`);
  const receipt = JSON.parse(fs.readFileSync(path.join(seedRoot, `${family}-normalization-receipt.json`), "utf8"));
  assert.equal(readPngHeader(strip).colorType, 6);
  assert.equal(receipt.backgroundExtraction, "EDGE_CONNECTED_BRIGHT_NEUTRAL_CHECKERBOARD");
  assert.equal(receipt.splitPolicy, "NEAREST_TRANSPARENT_COLUMN_RUN_AROUND_NOMINAL_BOUNDARY");
  assert.deepEqual(receipt.splitBoundaries, [0, 436, 893, 1309]);
  assert.equal(receipt.candidateStripSha256, sha256(strip));
});

test("the fourth motion-family closure completes the original four-frame zapped sequence", () => {
  assert.equal(motionClosure04.batch, "MOTION_FAMILY_CLOSURE_04");
  assert.equal(motionClosure04.canonicalCellCount, 2);
  assert.deepEqual(motionClosure04.cells.map((entry) => entry.cell), motionClosure04Cells);
  assert.equal(sha256(path.join(root, motionClosure04.contactSheet)), motionClosure04.contactSheetSha256);
  const expectedReuse = new Map([
    [44, ["main:44", "main:46"]],
    [47, ["main:47"]]
  ]);
  for (const cell of motionClosure04Cells) {
    const candidate = path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate.png`);
    const qa = JSON.parse(fs.readFileSync(
      path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate-qa.json`),
      "utf8"
    ));
    assert.deepEqual(readPngHeader(candidate), { width: 384, height: 352, colorType: 6 });
    assert.equal(qa.outputSha256, sha256(candidate));
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    assert.ok(qa.candidateAlphaBounds[0] > 0, `detached fragment reached left edge for Cell ${cell}`);
    const group = all83Reuse.reuseGroups.find(
      (entry) => entry.canonical.side === "main" && entry.canonical.cell === cell
    );
    assert.deepEqual(group.members.map((entry) => `${entry.side}:${entry.cell}`), expectedReuse.get(cell));
  }
  const family = "raw-motion-family-07-zapped-v1";
  const strip = path.join(seedRoot, `${family}.png`);
  const receipt = JSON.parse(fs.readFileSync(path.join(seedRoot, `${family}-normalization-receipt.json`), "utf8"));
  assert.equal(readPngHeader(strip).colorType, 6);
  assert.equal(receipt.backgroundExtraction, "EDGE_CONNECTED_BRIGHT_NEUTRAL_CHECKERBOARD");
  assert.equal(receipt.splitPolicy, "NEAREST_TRANSPARENT_COLUMN_RUN_AROUND_NOMINAL_BOUNDARY");
  assert.deepEqual(receipt.splitBoundaries, [0, 655, 1310]);
  assert.equal(receipt.candidateStripSha256, sha256(strip));
});

test("the fifth motion-family closure completes rest, post-zap and angry with Main/Sub reuse", () => {
  assert.equal(motionClosure05.batch, "MOTION_FAMILY_CLOSURE_05");
  assert.equal(motionClosure05.canonicalCellCount, 4);
  assert.deepEqual(motionClosure05.cells.map((entry) => entry.cell), motionClosure05Cells);
  assert.equal(sha256(path.join(root, motionClosure05.contactSheet)), motionClosure05.contactSheetSha256);
  const expectedReuse = new Map([
    [26, ["main:26", "sub:7"]],
    [48, ["main:48", "sub:8"]],
    [51, ["main:51", "sub:11"]],
    [52, ["main:52", "sub:12"]]
  ]);
  for (const cell of motionClosure05Cells) {
    const candidate = path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate.png`);
    const qa = JSON.parse(fs.readFileSync(
      path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate-qa.json`),
      "utf8"
    ));
    assert.deepEqual(readPngHeader(candidate), { width: 384, height: 352, colorType: 6 });
    assert.equal(qa.outputSha256, sha256(candidate));
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    assert.ok(qa.candidateAlphaBounds[0] > 0, `detached fragment reached left edge for Cell ${cell}`);
    const group = all83Reuse.reuseGroups.find(
      (entry) => entry.canonical.side === "main" && entry.canonical.cell === cell
    );
    assert.deepEqual(group.members.map((entry) => `${entry.side}:${entry.cell}`), expectedReuse.get(cell));
  }
  const family = "raw-motion-family-08-rest-postzap-angry-v1";
  const strip = path.join(seedRoot, `${family}.png`);
  const receipt = JSON.parse(fs.readFileSync(path.join(seedRoot, `${family}-normalization-receipt.json`), "utf8"));
  assert.equal(readPngHeader(strip).colorType, 6);
  assert.equal(receipt.backgroundExtraction, "EDGE_CONNECTED_BRIGHT_NEUTRAL_CHECKERBOARD");
  assert.equal(receipt.splitPolicy, "NEAREST_TRANSPARENT_COLUMN_RUN_AROUND_NOMINAL_BOUNDARY");
  assert.deepEqual(receipt.splitBoundaries, [0, 505, 887, 1330, 1774]);
  assert.equal(receipt.candidateStripSha256, sha256(strip));
});

test("the sixth motion-family closure completes every restrained Main timeline without partial identity", () => {
  assert.equal(motionClosure06.batch, "MOTION_FAMILY_CLOSURE_06");
  assert.equal(motionClosure06.canonicalCellCount, 12);
  assert.deepEqual(motionClosure06.cells.map((entry) => entry.cell), motionClosure06Cells);
  assert.equal(sha256(path.join(root, motionClosure06.contactSheet)), motionClosure06.contactSheetSha256);
  const expectedReuse = new Map([
    [27, ["main:27", "main:31", "main:33"]], [28, ["main:28"]],
    [29, ["main:29", "main:38"]], [30, ["main:30"]],
    [32, ["main:32", "main:34"]], [35, ["main:35"]],
    [36, ["main:36"]], [37, ["main:37"]], [39, ["main:39"]],
    [40, ["main:40", "main:43"]], [41, ["main:41"]], [42, ["main:42"]]
  ]);
  for (const cell of motionClosure06Cells) {
    const candidate = path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate.png`);
    const qa = JSON.parse(fs.readFileSync(path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate-qa.json`), "utf8"));
    assert.deepEqual(readPngHeader(candidate), { width: 384, height: 352, colorType: 6 });
    assert.equal(qa.outputSha256, sha256(candidate));
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    const group = all83Reuse.reuseGroups.find((entry) => entry.canonical.side === "main" && entry.canonical.cell === cell);
    assert.deepEqual(group.members.map((entry) => `${entry.side}:${entry.cell}`), expectedReuse.get(cell));
  }
  const families = new Map([
    ["raw-motion-family-09-restrained-idles-v1", [0, 444, 887, 1330, 1774]],
    ["raw-motion-family-10-restrained-motion-v1", [0, 444, 834, 1278, 1774]],
    ["raw-motion-family-11-restrained-care-v1", [0, 444, 898, 1330, 1774]]
  ]);
  for (const [family, boundaries] of families) {
    const strip = path.join(seedRoot, `${family}.png`);
    const receipt = JSON.parse(fs.readFileSync(path.join(seedRoot, `${family}-normalization-receipt.json`), "utf8"));
    assert.equal(readPngHeader(strip).colorType, 6);
    assert.equal(receipt.backgroundExtraction, "EDGE_CONNECTED_BRIGHT_NEUTRAL_CHECKERBOARD");
    assert.equal(receipt.splitPolicy, "NEAREST_TRANSPARENT_COLUMN_RUN_AROUND_NOMINAL_BOUNDARY");
    assert.deepEqual(receipt.splitBoundaries, boundaries);
    assert.equal(receipt.candidateStripSha256, sha256(strip));
  }
});

test("the seventh motion-family closure removes every remaining faithful fallback", () => {
  assert.equal(motionClosure07.batch, "MOTION_FAMILY_CLOSURE_07");
  assert.equal(motionClosure07.canonicalCellCount, 7);
  assert.deepEqual(motionClosure07.cells.map((entry) => entry.cell), motionClosure07Cells);
  assert.equal(sha256(path.join(root, motionClosure07.contactSheet)), motionClosure07.contactSheetSha256);
  const expectedReuse = new Map([
    [55, ["main:55", "sub:15"]], [57, ["main:57"]],
    [58, ["main:58"]], [59, ["main:59"]], [60, ["main:60"]],
    [61, ["main:61", "sub:16"]], [64, ["main:64"]]
  ]);
  for (const cell of motionClosure07Cells) {
    const candidate = path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate.png`);
    const qa = JSON.parse(fs.readFileSync(path.join(seedRoot, `m201-main-cell-${String(cell).padStart(3, "0")}-remix-candidate-qa.json`), "utf8"));
    assert.deepEqual(readPngHeader(candidate), { width: 384, height: 352, colorType: 6 });
    assert.equal(qa.outputSha256, sha256(candidate));
    assert.equal(qa.checks.trueAlpha, true);
    assert.equal(qa.checks.sourceVerticalPlacementPreserved, true);
    const group = all83Reuse.reuseGroups.find((entry) => entry.canonical.side === "main" && entry.canonical.cell === cell);
    assert.deepEqual(group.members.map((entry) => `${entry.side}:${entry.cell}`), expectedReuse.get(cell));
  }

  const family12 = "raw-motion-family-12-guard-shout-v1";
  const receipt12 = JSON.parse(fs.readFileSync(path.join(seedRoot, `${family12}-normalization-receipt.json`), "utf8"));
  assert.equal(receipt12.backgroundExtraction, "EDGE_CONNECTED_BRIGHT_NEUTRAL_CHECKERBOARD");
  assert.deepEqual(receipt12.splitBoundaries, [0, 470, 940, 1411, 1881]);
  assert.equal(receipt12.candidateStripSha256, sha256(path.join(seedRoot, `${family12}.png`)));

  const family13 = "raw-motion-family-13-final-status-v3-transparent";
  const receipt13 = JSON.parse(fs.readFileSync(path.join(seedRoot, `${family13}-normalization-receipt.json`), "utf8"));
  assert.equal(receipt13.backgroundExtraction, "SOURCE_ALPHA");
  assert.deepEqual(receipt13.splitBoundaries, [0, 384, 768, 1152]);
  assert.equal(receipt13.candidateStripSha256, sha256(path.join(seedRoot, `${family13}.png`)));

  const spriteQc = JSON.parse(fs.readFileSync(
    path.join(seedRoot, "motion-family-normalization-inputs/family13-hd-generate2dsprite/pipeline-meta.json"),
    "utf8"
  ));
  assert.equal(spriteQc.qc_config.strict_qc, true);
  assert.equal(spriteQc.qc_config.allow_source_edge_touch, true);
  assert.deepEqual(spriteQc.output_edge_touch_frames, []);
  assert.deepEqual(spriteQc.paste_clamped_frames, []);
  assert.ok(spriteQc.qc_summary.body_scale_cv <= 0.08);
  assert.ok(spriteQc.qc_summary.anchor_y_std <= 0.05);
});

test("M201 remix artifacts remain review-gated and portable", () => {
  assert.equal(workPacket.runtimeEligible, false);
  assert.equal(workPacket.shippingReady, false);
  assert.equal(candidates.runtimeEligible, false);
  assert.equal(candidates.shippingReady, false);
  assert.doesNotMatch(JSON.stringify({ workPacket, candidates, sourceGuides, all83Reuse }), /[A-Z]:[\\/]/);
});

test("M201 all-83 audit locks 47 unique visuals and complete Sub-to-Main reuse", () => {
  assert.deepEqual(all83Reuse.slotCounts, { main: 65, sub: 18, total: 83 });
  assert.equal(all83Reuse.slots.length, 83);
  assert.equal(all83Reuse.uniqueDecodedVisualCount, 47);
  assert.equal(all83Reuse.uniqueGeometryCount, 36);
  assert.equal(all83Reuse.mainUniqueDecodedVisualCount, 47);
  assert.equal(all83Reuse.subUniqueDecodedVisualCount, 18);
  assert.equal(all83Reuse.subSlotsReusedFromMain, 18);
  assert.equal(all83Reuse.allSubSlotsReuseMain, true);
  assert.equal(all83Reuse.reuseGroups.length, 47);
  assert.equal(all83Reuse.geometryFamilies.length, 36);
  assert.deepEqual(
    all83Reuse.geometryFamilies
      .filter((family) => family.visualCanonicals.length > 1)
      .map((family) => family.visualCanonicals.map((entry) => entry.cell)),
    [[0, 2, 11, 48], [1, 3, 57], [8, 44, 47], [10, 61], [23, 26], [27, 29], [28, 30]]
  );
  assert.equal(all83Reuse.technicalCandidateUniqueCount, 47);
  assert.equal(all83Reuse.pendingUniqueCount, 0);
  assert.equal(fs.existsSync(path.join(root, all83Reuse.canonicalSourceContactSheet)), true);
  assert.equal(sha256(path.join(root, all83Reuse.canonicalSourceContactSheet)), all83Reuse.canonicalSourceContactSheetSha256);
  assert.equal(all83Reuse.reuseGroups.every((group) => fs.existsSync(path.join(root, group.sourceGuide))), true);
  assert.equal(all83Reuse.slots.filter((slot) => slot.side === "sub").every((slot) => slot.canonical.side === "main"), true);
});

test("M201 hybrid review atlas exposes all 83 stable texture keys without promotion", () => {
  assert.deepEqual(reviewManifest.slotCounts, { main: 65, sub: 18, total: 83 });
  assert.deepEqual(reviewManifest.sequenceCounts, { main: 40, sub: 13, total: 53 });
  assert.equal(reviewManifest.candidateSlotCount + reviewManifest.faithfulFallbackSlotCount, 83);
  assert.equal(reviewManifest.technicalCandidateUniqueCount, 47);
  assert.equal(reviewManifest.pendingUniqueCount, 0);
  assert.equal(reviewManifest.candidateSlotCount, 83);
  assert.equal(reviewManifest.faithfulFallbackSlotCount, 0);
  assert.equal(reviewManifest.state, "COMPLETE_MOTION_PREVIEW_REVIEW_ONLY");
  assert.equal(reviewManifest.runtimeEligible, false);
  assert.equal(reviewManifest.shippingReady, false);
  assert.equal(reviewRuntime.artProfile.reviewOnly, true);
  assert.equal(reviewRuntime.artProfile.runtimeEligible, false);

  const atlasKeys = new Set();
  for (const sideName of ["main", "sub"]) {
    const side = reviewManifest.sides[sideName];
    for (const page of side.atlasPages) {
      assert.ok(page.width <= 2048);
      assert.ok(page.height <= 2048);
      assert.equal(sha256(path.join(reviewRoot, page.image)), page.imageSha256);
      assert.equal(sha256(path.join(reviewRoot, page.data)), page.dataSha256);
      const atlas = JSON.parse(fs.readFileSync(path.join(reviewRoot, page.data), "utf8"));
      assert.equal(atlas.meta.reviewOnly, true);
      Object.keys(atlas.frames).forEach((key) => atlasKeys.add(key));
    }
  }
  const runtimeKeys = new Set(
    ["main", "sub"].flatMap((sideName) =>
      reviewRuntime.sides[sideName].animations.flatMap((animation) =>
        animation.frames.map((frame) => frame.texture)
      )
    )
  );
  assert.equal(atlasKeys.size, 83);
  assert.deepEqual(atlasKeys, runtimeKeys);
  assert.equal(reviewManifest.sourceTicksAndPlaybackPreserved, true);
  assert.equal(reviewManifest.stableTextureKeysPreserved, true);
  assert.deepEqual(reviewManifest.sequenceCoverage.main.counts, {
    FULL_REMIX: 40,
    PARTIAL_REMIX: 0,
    FAITHFUL_FALLBACK_ONLY: 0
  });
  assert.deepEqual(reviewManifest.sequenceCoverage.sub.counts, {
    FULL_REMIX: 13,
    PARTIAL_REMIX: 0,
    FAITHFUL_FALLBACK_ONLY: 0
  });
  for (const semanticAlias of [
    "idle", "idle_blink", "walk", "run", "alert", "attack_1", "attack_2", "attack_3",
    "attack_4", "flee", "tired_walk", "eat", "rest", "zapped", "post_zap_transition",
    "happy", "angry", "cheer_victory", "restrained_idle_a", "restrained_idle_b",
    "restrained_walk", "restrained_run", "restrained_alert", "restrained_flee",
    "restrained_tired_walk", "restrained_sleep", "restrained_eat", "restrained_rest",
    "guard", "train", "shout", "guard_variant", "shout_continuation",
    "battle_status_unknown", "knocked_out", "jump_hit_action", "training_effect_state"
  ]) {
    const animation = reviewManifest.sequenceCoverage.main.animations.find(
      (entry) => entry.semanticAlias === semanticAlias
    );
    assert.equal(animation?.state, "FULL_REMIX", semanticAlias);
  }
  assert.equal(reviewManifest.sequenceCoverage.main.animations.every((entry) => entry.state === "FULL_REMIX"), true);
  assert.equal(reviewManifest.sequenceCoverage.sub.animations.every((entry) => entry.state === "FULL_REMIX"), true);
  for (const sideName of ["main", "sub"]) {
    const coverage = reviewManifest.sequenceCoverage[sideName];
    assert.equal(
      coverage.counts.FULL_REMIX + coverage.counts.PARTIAL_REMIX + coverage.counts.FAITHFUL_FALLBACK_ONLY,
      reviewManifest.sequenceCounts[sideName]
    );
    assert.equal(coverage.animations.length, reviewManifest.sequenceCounts[sideName]);
  }
});

test("M201 internal review art is denied from the public Pages package", () => {
  const manifestPath = 'assets/production/internal-character-review/m201-remix-v1/manifest.json';
  assert.equal(isPrivateRepositoryPath(manifestPath), true);
  assert.equal(isPrivateRepositoryPath(manifestPath.replace('/manifest.json', '/main.png')), true);
  const projected = publicArtIndex({entries: [{assetId: reviewManifest.assetId, manifestPath}], summary: {}});
  assert.equal(projected.entries.length, 0);
  assert.equal(reviewManifest.runtimeEligible, false);
  assert.equal(reviewManifest.shippingReady, false);
});
