import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const remixRoot = path.join(root, "docs/art/production/characters/cat-dog-remix-v1");
const seedRoot = path.join(remixRoot, "m201-seed");
const workPacket = JSON.parse(fs.readFileSync(path.join(remixRoot, "m201-work-packet.json"), "utf8"));
const candidates = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-main-12-high-risk-remix-candidates.json"), "utf8"));
const sourceGuides = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-main-12-high-risk-source-guides.json"), "utf8"));
const all83Reuse = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-all83-source-reuse.json"), "utf8"));
const motionClosure = JSON.parse(fs.readFileSync(path.join(seedRoot, "m201-motion-family-closure-01-candidates.json"), "utf8"));
const reviewRoot = path.join(root, "assets/production/internal-character-review/m201-remix-v1");
const reviewManifest = JSON.parse(fs.readFileSync(path.join(reviewRoot, "manifest.json"), "utf8"));
const reviewRuntime = JSON.parse(fs.readFileSync(path.join(reviewRoot, "runtime.review.json"), "utf8"));
const motionClosureCells = [1, 5, 12, 50, 54];

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
  assert.equal(all83Reuse.technicalCandidateUniqueCount, 14);
  assert.equal(all83Reuse.pendingUniqueCount, 33);
  assert.equal(fs.existsSync(path.join(root, all83Reuse.canonicalSourceContactSheet)), true);
  assert.equal(sha256(path.join(root, all83Reuse.canonicalSourceContactSheet)), all83Reuse.canonicalSourceContactSheetSha256);
  assert.equal(all83Reuse.reuseGroups.every((group) => fs.existsSync(path.join(root, group.sourceGuide))), true);
  assert.equal(all83Reuse.slots.filter((slot) => slot.side === "sub").every((slot) => slot.canonical.side === "main"), true);
});

test("M201 hybrid review atlas exposes all 83 stable texture keys without promotion", () => {
  assert.deepEqual(reviewManifest.slotCounts, { main: 65, sub: 18, total: 83 });
  assert.deepEqual(reviewManifest.sequenceCounts, { main: 40, sub: 13, total: 53 });
  assert.equal(reviewManifest.candidateSlotCount + reviewManifest.faithfulFallbackSlotCount, 83);
  assert.equal(reviewManifest.technicalCandidateUniqueCount, 14);
  assert.equal(reviewManifest.pendingUniqueCount, 33);
  assert.equal(reviewManifest.candidateSlotCount, 31);
  assert.equal(reviewManifest.faithfulFallbackSlotCount, 52);
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
    FULL_REMIX: 13,
    PARTIAL_REMIX: 1,
    FAITHFUL_FALLBACK_ONLY: 26
  });
  assert.deepEqual(reviewManifest.sequenceCoverage.sub.counts, {
    FULL_REMIX: 7,
    PARTIAL_REMIX: 0,
    FAITHFUL_FALLBACK_ONLY: 6
  });
  for (const semanticAlias of ["idle", "walk", "run", "attack_1", "attack_3", "happy", "cheer_victory"]) {
    const animation = reviewManifest.sequenceCoverage.main.animations.find(
      (entry) => entry.semanticAlias === semanticAlias
    );
    assert.equal(animation?.state, "FULL_REMIX", semanticAlias);
  }
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
  const pagesBuilder = fs.readFileSync(path.join(root, "scripts/build-github-pages.mjs"), "utf8");
  assert.match(pagesBuilder, /privateRepositoryOnlyPath[^\n]+internal-character-review/);
  assert.match(pagesBuilder, /forbiddenPath[^\n]+internal-character-review/);
  assert.equal(reviewManifest.runtimeEligible, false);
  assert.equal(reviewManifest.shippingReady, false);
});
