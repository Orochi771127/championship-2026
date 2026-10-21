import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [dir,planPath]=process.argv.slice(2),sha=s=>createHash('sha256').update(s).digest('hex');
const planBytes=await fs.readFile(planPath),plan=JSON.parse(planBytes),data=JSON.parse(await fs.readFile(dir+'/support-c1-results.json'));
assert.equal(sha(planBytes),'5a03781ee039c68350a0880b0c4bb1ae88043dfed5f91e3a6fc5a752371c203e');assert.equal(plan.count,72);assert.equal(plan.cases.length,72);assert.equal(data.expectedCount,144);assert.equal(data.results.length,144);assert.deepEqual(data.fieldFailures,[]);assert.equal(data.failure,null);
assert.equal(data.grassControls.length,1);const grass=data.grassControls[0];assert.equal(grass.status,'EXACT_TRIANGLE_COUNTERFACTUAL_ATTRIBUTION_WITH_STRICT_RESTORE_NOT_REMOVAL_APPROVAL');assert.equal(grass.samples.length,3);if(data.engine==='chromium')assert.equal(grass.causalAttributionObserved,true);
const rows=[];for(const c of plan.cases){
 const a=data.results.find(r=>r.id===c.id&&r.mode==='floor1ae-plus-water-ice-repair'),b=data.results.find(r=>r.id===c.id&&r.mode==='support-sheets-plus-water-ice-repair');assert.ok(a&&b);assert.equal(a.settling.converged,true);assert.equal(b.settling.converged,true);
 assert.deepEqual(a.data.subjectGroundScreen,b.data.subjectGroundScreen);assert.deepEqual(a.data.geometry,b.data.geometry);assert.equal(a.data.runtimeHash,b.data.runtimeHash);assert.equal(a.data.nativeZ,b.data.nativeZ);assert.equal(a.data.height,b.data.height);
 const exactFallback=c.ownerMode==='missing'||c.ownerMode==='wrong-index';if(exactFallback)assert.equal(a.normalImageSha256,b.normalImageSha256,'Denied/unverified owner must retain exact floor-reference normal image:'+c.id);
 for(const target of ['offscreen','default']){
  const am=a.pipelines.find(p=>p.target===target).samples[0].mask,bm=b.pipelines.find(p=>p.target===target).samples[0].mask;
  assert.equal(am.coverageHashes.referenceRGBA,bm.coverageHashes.referenceRGBA,'Same-target exact source alpha reference');
  assert.equal(am.coverageHashes.upperRows,bm.coverageHashes.upperRows);assert.equal(am.coverageHashes.actualUpperRGBA,bm.coverageHashes.actualUpperRGBA,'Conservative above-floor coverage invariant:'+c.id);
  assert.equal(bm.resolvedCoverage.excessIntensity,0,'No coverage beyond same-target source reference');
  if(exactFallback)assert.equal(am.coverageHashes.actualRGBA,bm.coverageHashes.actualRGBA,'Denied/unverified owner exact floor-reference coverage:'+c.id);
  rows.push({id:c.id,lane:c.lane,target,exactFallback,referenceCoverage:am.resolvedCoverage,candidateCoverage:bm.resolvedCoverage,status:exactFallback?'EXACT_EXISTING_FLOOR_FALLBACK_INVARIANCE':'CAPTURED_ABOVE_FLOOR_INVARIANCE_FULL_FOOTPRINT_ORACLE_REQUIRED'});
 }
}
assert.equal(new Set(data.results.map(r=>r.id+'|'+r.mode)).size,144);
const out={engine:data.engine,grassControl:{status:grass.status,deficitReproduced:grass.deficitReproduced,causalAttributionObserved:grass.causalAttributionObserved},planSha256:sha(planBytes),rows,status:'C1_BOUNDED_INVARIANCE_GATES_PASSED_NOT_ALL_MAP_OR_ORIGINAL4F_FOREGROUND_APPROVAL',releaseApproved:false};await fs.writeFile(dir+'/support-c1-comparison.json',JSON.stringify(out,null,2));console.log(JSON.stringify({cases:72,pairedTargetObservations:rows.length,status:out.status}));
