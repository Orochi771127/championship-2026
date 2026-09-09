import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRaisingCageArtPlan } from "../src/championship/presentation/raisingCageArtPlan.js";
const manifest = JSON.parse(fs.readFileSync(new URL("../assets/production/cage/licensed-runtime-v1/manifest.json", import.meta.url), "utf8"));
const placed = (module, slotIndex) => ({ moduleId: `championship:2026:cage:${module === 35 ? "waiting-room" : module}`, slotIndex });

test("four current owned modules retain slot identity and the Waiting Room crosswalk", () => {
  const placements = [placed(35,3),placed(0,0),placed(15,2),placed(1,1)];
  const before = structuredClone(placements);
  const plan = createRaisingCageArtPlan({manifest,placements});
  assert.equal(plan.mode,"PLAYER_PLACEMENTS");
  assert.equal(plan.placementEvidence,"PRODUCT_AUTHORED");
  assert.deepEqual(plan.placements.map(item=>item.slotIndex),[0,1,2,3]);
  assert.deepEqual(plan.placements.map(item=>item.fieldId),["field_cm01_01","field_cm02_01","field_cm16_01","field_cm28_01"]);
  assert.deepEqual(plan.placements.map(item=>item.cageDefinitionIndex),[0,1,15,35]);
  assert.deepEqual(placements,before);
  placements[1].slotIndex=9;
  assert.equal(plan.placements[0].slotIndex,0);
  assert.ok(Object.isFrozen(plan.placements[0]));
});
test("missing field or module refuses the entire nonempty ranch, never a partial or preview substitute", () => {
  const missing=structuredClone(manifest);
  missing.fields=missing.fields.filter(item=>item.fieldId!=="field_cm02_01");
  assert.throws(()=>createRaisingCageArtPlan({manifest:missing,placements:[placed(0,0),placed(1,1)]}),/FIELD_MISSING_FOR_MODULE/);
  assert.throws(()=>createRaisingCageArtPlan({manifest,placements:[placed(999,0)]}),/MODULE_UNKNOWN/);
});
test("duplicate module or slot, out of range slots and absent placement arrays refuse", () => {
  for(const [placements,reason] of [
    [[placed(0,0),placed(0,1)],/DUPLICATE_MODULE/],
    [[placed(0,0),placed(1,0)],/DUPLICATE_SLOT/],
    [[placed(0,20)],/SLOT_OUT_OF_RANGE/],
    [[placed(0,.5)],/SLOT_OUT_OF_RANGE/],
    [undefined,/PLACEMENTS_REQUIRED/]
  ]) assert.throws(()=>createRaisingCageArtPlan({manifest,placements}),reason);
});
test("empty-ranch and explicit art previews are distinguished from player placement truth", () => {
  const empty=createRaisingCageArtPlan({manifest,placements:[]});
  assert.equal(empty.mode,"EMPTY_RANCH_ART_PREVIEW");
  assert.equal(empty.placements[0].fieldId,"field_cm01_01");
  assert.equal(empty.placementEvidence,"PREVIEW_ONLY_NOT_PLAYER_PLACEMENT");
  const preview=createRaisingCageArtPlan({manifest,placements:[placed(0,0)],previewFieldId:"field_cm09_01"});
  assert.equal(preview.mode,"EXPLICIT_ART_PREVIEW");
  assert.equal(preview.placements[0].fieldId,"field_cm09_01");
  assert.throws(()=>createRaisingCageArtPlan({manifest,placements:[],previewFieldId:"missing"}),/FIELD_UNKNOWN/);
});
