import assert from'node:assert/strict';
export function assertContactV4Prerequisite(r){
 assert.equal(r.candidateSha256,'4eebd5f756597164a1be9223c30aba6c521f312844a2b36c00064d71cd7b0338');
 assert.equal(r.sourceManifestSha256,'31f728bb9753abbb408edfb62d01f169369bdfb7dd6c8640e79bf0d3e52e939f');
 assert.equal(r.physicalMetadataSha256,'a8c073714c9457a880f6df0b5424fbed00d28ca64a2d10925b04a3068767f599');assert.equal(r.physicalTopCount,156);assert.equal(r.fieldCount,8);
 assert.equal(r.runId,39720832710);assert.equal(r.headSha,'f88332a52900a56a579ec32994720f57fc0cdf88');
 assert.equal(r.originalWorkflowConclusion,'failure');assert.equal(r.acceptanceBasis,'INDEPENDENT_CORRECTED_OFFLINE_VERIFIER_NOT_GREEN_WORKFLOW');
 assert.deepEqual(r.engines,[{"engine":"chromium","artifactSha256":"f33e39e95fd4f83c8de34287e62b83318cad559e7eda8d03efe7e4cd2234c207","artifactId":12401420733,"originalJobConclusion":"failure","correctedReportSha256":"7c3b7a1fc4d8045b82165e2dd739b765d2c5016724588470d07efba223dc47ea","correctedStatus":"BOUNDED_SCALAR_VERTEX_TRIAL_PASS_NOT_RELEASE","independentlyReviewed":true},{"engine":"webkit","artifactSha256":"abe5282b95d268909c9cc79bf588a4dd917becd73982811b3398fce51230ff4f","artifactId":12400549988,"originalJobConclusion":"failure","correctedReportSha256":"74ae2162d5c70617d7af204011ba70f1fcd4c12412b5c766993beca6757b22ba","correctedStatus":"BOUNDED_SCALAR_VERTEX_TRIAL_PASS_NOT_RELEASE","independentlyReviewed":true}]);
 for(const e of r.engines){assert.equal(e.originalJobConclusion,'failure');assert.equal(e.correctedStatus,'BOUNDED_SCALAR_VERTEX_TRIAL_PASS_NOT_RELEASE');assert.equal(e.independentlyReviewed,true);assert.match(e.artifactSha256,/^[a-f0-9]{64}$/);assert.match(e.correctedReportSha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(e.artifactId)&&e.artifactId>0)}
 assert.equal(r.reviewReportSha256,'dd950ad1bc4f92f27a211a626ece3d5ec0358337716d32d05054de401e8491a2');assert.equal(r.artifactReceiptSha256,'5d6a98d4d9ae89f46361b57c767814eb359b272b103c7fff3f785ef669c0285d');
 assert.deepEqual(r.requestedCoverage,{routes:8,rolesPerRoute:2,sources:2,capturesPerEngine:32});assert.equal(r.releaseApproved,false);
 assert.equal(r.historicalContact8.candidateSha256,'8a65acb62685e1c00dec88b3023301dcfba332c33b9378ebb6bb1366b9228284');assert.equal(r.historicalContact8.runId,39668946580);assert.equal(r.historicalContact8.qualifiesFinalSource,false);
}
