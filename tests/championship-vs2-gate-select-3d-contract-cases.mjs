// VS2-R1 -- the Original Gate Select 3D parity contract.
//
// This contract is the only place the recovered Gate Select evidence lives inside
// the product. The original research tree is external and read-only, so if a
// value here drifts there is nothing in the repository to catch it -- except this
// file.
//
// These cases pin three kinds of claim:
//   * the ROM_VERIFIED facts, which must not be edited without new evidence
//   * the UNKNOWN_REQUIRES_TRACE fields, which must not be quietly upgraded
//   * the policy boundaries: no ROM payload, one selection state, 2D grid kept
//
// They deliberately do NOT assert anything about a Gate Select 3D implementation,
// because none is authorized yet.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  listChampionshipBiomeIdentities,
  listChampionshipGates
} from "../src/championship/gate/gateCatalog.js";

const CONTRACT_PATH = "docs/contracts/championship/VS2_GATE_SELECT_3D_RUNTIME_CONTRACT.v1.json";
const contractText = fs.readFileSync(CONTRACT_PATH, "utf8");
const contract = JSON.parse(contractText);

// Recovered from gate_select/3D_worldMap_model.nsbmd MDL0, 16-byte name-table
// stride, offsets 432 through 928. Alphabetical name-table order, which is NOT
// proven to be display order.
const RECOVERED_BIOMES = Object.freeze([
  "Canyon", "Crag", "Damp", "Desert", "Factory", "Forest", "Grass", "Ice",
  "Jungle", "Mine", "Oasis", "Ruins", "Savanna", "Seaside", "Sewer", "Volcano"
]);

test("the recovered 16 biome identities are exactly the ROM name-table set", () => {
  const biomes = contract.answers["4_sixteenBiomeGateNodeRelationship"].biomes;
  assert.equal(biomes.length, 16);
  assert.deepEqual(biomes.map((entry) => entry.node), [...RECOVERED_BIOMES]);

  // Every biome is a parent/child PAIR at a uniform 16-byte stride. The pairing
  // is the structure a 3D restoration has to author against.
  for (const entry of biomes) {
    assert.equal(entry.parent, `${entry.node}parent`, `${entry.node} lost its parent node`);
    assert.equal(entry.nodeOffset - entry.parentOffset, 16, `${entry.node} broke the 16-byte stride`);
  }
  assert.equal(biomes[0].parentOffset, 432);
  assert.equal(biomes[15].nodeOffset, 928);

  // Ice is the one node missing from GATE_SELECT_NODE_CANDIDATES.csv; it was
  // recovered by reading the model bytes. If this entry ever loses its note, the
  // correction has been edited away.
  const ice = biomes.find((entry) => entry.node === "Ice");
  assert.match(ice.note, /direct byte read/i);
});

test("the model identities keep their exact provenance", () => {
  const world = contract.answers["2_worldMapModelIdentity"];
  assert.equal(world.path, "gate_select/3D_worldMap_model.nsbmd");
  assert.equal(world.sizeBytes, 164912);
  assert.equal(world.sha256, "4852ce8731b9b221864d219870bcf7f5f0332645d429893c107b4478e8fef539");
  assert.equal(world.loader.overlay, 12);
  assert.equal(world.loader.callAddress, "0x0210C6FC");
  assert.equal(world.evidence, "ROM_VERIFIED");

  const earth = contract.answers["3_earthModelIdentity"];
  assert.equal(earth.path, "gate_select/earth.nsbmd");
  assert.equal(earth.sizeBytes, 81620);
  assert.equal(earth.sha256, "fc811f61f6093a3e35588267fa5dc3e0815a60772adde9bda43b797c27c2878b");
});

test("the earth model keeps its no-traced-loader finding", () => {
  const earth = contract.answers["3_earthModelIdentity"];
  // The only `earth` string in the binary scan resolves to battle/earth_hit via
  // OVL19. Nothing shows gate_select/earth being loaded. Claiming an earth stage
  // as original behaviour would need new evidence, not a contract edit.
  assert.equal(earth.loaderStatus.verdict, "NO LOADER TRACED ANYWHERE");
  assert.match(earth.loaderStatus.detail, /earth_hit/);
  assert.match(earth.evidence, /PARTIAL/);
});

test("the day/night structure stays a paired-state model", () => {
  const dayNight = contract.answers["5_dayNightNodeRelationship"];
  assert.deepEqual(dayNight.verified.geometryNodes, ["world_day", "world_night"]);
  assert.deepEqual(dayNight.verified.textureFixNodes,
    ["Map_fix_day", "Map_fix_night", "Map_fix_day_pl", "Map_fix_night_pl"]);
  assert.equal(dayNight.unknown.evidence, "UNKNOWN_REQUIRES_TRACE");
  // Two states, not a clock. A continuous time-of-day cycle would be invention.
  assert.match(dayNight.presentationRule, /TWO paired states/);
});

test("the 3D layer keeps its verified no-animation-asset finding", () => {
  const animation = contract.answers["11_animationEvidence"];
  assert.equal(animation.threeD.evidence, "ROM_VERIFIED negative");
  assert.match(animation.threeD.consequence, /CODE-DRIVEN/);
  // The 2D overlay animations are a separate, positive finding.
  assert.equal(animation.twoD.evidence, "ROM_VERIFIED");
  assert.equal(animation.twoD.resources.length, 6);
});

test("rotation, camera and input stay unresolved until traced", () => {
  // The whole point of the evidence policy: these are the fields a 3D build is
  // most tempted to assert. Upgrading one needs a trace, not an edit.
  for (const key of ["7_rotationState", "8_cameraState", "10_inputBehaviorEvidence"]) {
    assert.equal(contract.answers[key].evidence, "UNKNOWN_REQUIRES_TRACE", `${key} was upgraded without evidence`);
  }
  assert.match(contract.answers["7_rotationState"].hardConstraint, /T1/);
  assert.match(contract.answers["7_rotationState"].presentationRule, /PRODUCT_AUTHORED|OWNER_APPROVED_ADAPTATION/);
});

test("all twelve Owner questions are answered and carry an evidence level", () => {
  const keys = Object.keys(contract.answers);
  assert.equal(keys.length, 12);
  for (let index = 1; index <= 12; index += 1) {
    assert.ok(keys.some((key) => key.startsWith(`${index}_`)), `question ${index} is unanswered`);
  }
  for (const [key, answer] of Object.entries(contract.answers)) {
    const level = answer.evidence ?? answer.verdict;
    assert.ok(typeof level === "string" && level.length > 0, `${key} carries no evidence level`);
  }
});

test("the 2D grid is preserved as a fallback and never the sole player mode", () => {
  const fallback = contract.fallbackPolicy;
  assert.deepEqual([...fallback.retainedAs].sort(),
    ["ACCESSIBILITY_FALLBACK", "DEBUG_FALLBACK", "LOW_CAPABILITY_FALLBACK"]);
  assert.match(fallback.mustNotBe, /sole formal Player Mode/);
  assert.match(fallback.rule, /PRESERVED/);
});

test("Three.js stays presentation-only over a single selection state", () => {
  const three = contract.threeJsContract;
  assert.match(three.authority, /PRESENTATION ONLY/);
  assert.ok(three.rules.some((rule) => /no second selection authority/i.test(rule)));
  assert.ok(three.rules.some((rule) => /must not load or convert|must not be loaded|No original ROM model/i.test(rule)));

  const shared = contract.sharedSelectionStateContract;
  assert.match(shared.rule, /ONE destination truth/);
  assert.ok(shared.forbidden.some((entry) => /second gate selection variable/i.test(entry)));
  assert.ok(shared.forbidden.some((entry) => /new save schema/i.test(entry)));
  // Adding the 3D mode must not need a new seam: that is why VS2 published one.
  assert.match(shared.existingSeam.note, /No new intent, no new state field and no new save field/);
});

test("the contract carries provenance without carrying a payload or a machine path", () => {
  // House style: the absolute research root lives in exactly one place.
  assert.equal(/[A-Za-z]:[\\/]/.test(contractText), false, "an absolute machine path entered the contract");
  assert.match(contract.evidenceSources.root, /research\/original-evidence\/README\.md/);

  const firewall = fs.readFileSync("research/original-evidence/README.md", "utf8");
  assert.match(firewall, /ORIGINAL_EVIDENCE_ROOT/);
  assert.match(firewall, /VS2_GATE_SELECT_3D_RUNTIME_CONTRACT/);

  // Metadata only. No decoded geometry, no texture, no base64 payload.
  assert.equal(/base64|data:image|"vertices"|"indices"|"triangles"/i.test(contractText), false);
  assert.ok(contract.ipPolicy.forbidden.length >= 3);
});

test("the recovered biome identities are adopted as canonical, completely and in order", () => {
  // This case previously asserted the OPPOSITE: that the catalog had NOT adopted
  // the recovered names, so that adoption could not happen by accident. The Owner
  // authorized adoption on 2026-08-28, so the guard inverts - a partial or
  // reordered adoption is now the failure.
  const gap = contract.parityGap;
  assert.equal(gap.status, "RESOLVED_OWNER_AUTHORIZED");

  assert.deepEqual([...listChampionshipBiomeIdentities()], [...RECOVERED_BIOMES]);
  const gates = listChampionshipGates();
  assert.equal(gates.length, 16);
  assert.deepEqual(gates.map((gate) => gate.biomeId), [...RECOVERED_BIOMES]);
  assert.deepEqual(gates.map((gate) => gate.gateId),
    RECOVERED_BIOMES.map((biome) => `championship:2026:gate:${biome.toLowerCase()}`));

  for (const gate of gates) {
    assert.equal(gate.identityEvidence, "ROM_VERIFIED");
    assert.equal(gate.biomeNodeName, gate.biomeId);
    assert.equal(gate.biomeParentNodeName, `${gate.biomeId}parent`);
    // Recovering a node name is not recovering the label the player saw.
    assert.equal(gate.displayNameEvidence, "PRESENTATION_DEFAULT_NOT_RECOVERED");
  }

  // No product-authored placeholder may survive as an identity.
  const catalog = fs.readFileSync("src/championship/gate/gateCatalog.js", "utf8");
  for (const stale of ["Shallow Verge", "Quiet Basin", "Ashen Steps", "Far Meridian"]) {
    assert.equal(catalog.includes(stale), false, `${stale} survived the identity adoption`);
  }
});
