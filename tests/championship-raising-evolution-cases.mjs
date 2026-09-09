import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {mergeNativeIndividualForm} from "../src/championship/raising/nativeIndividualEvolution.js";
import {nativeIndividualProfile} from "../src/championship/raising/nativeIndividualProfile.js";
import {nativeHuntSpeciesByIndex} from "../src/championship/hunt/capture/nativeHuntSources.js";

const inputs=JSON.parse(fs.readFileSync("docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json","utf8")).individualVectors;
const oracle=JSON.parse(fs.readFileSync("docs/research/RAISING_EVOLUTION_CPU_CHECK_2026-09-08.json","utf8"));
test("form merge matches 1824 original CPU vectors, all species and eight rebirth boundaries",()=>{
  for(const row of oracle.cases) {
    const previous=structuredClone(inputs[row.sourceIndex].after);previous.narrowFields["03c"]=row.cycles;
    const constructed=inputs[row.targetIndex].after;
    const result=mergeNativeIndividualForm(nativeIndividualProfile(previous),nativeIndividualProfile(constructed),
      nativeHuntSpeciesByIndex(row.sourceIndex).generation);
    assert.deepEqual(result,nativeIndividualProfile(row.after),`${row.sourceIndex} -> ${row.targetIndex}, cycles ${row.cycles}`);
  }
});
