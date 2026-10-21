// LOCAL diagnostic: idle request + source-predicted risk only; no all-frame claim.
import {chromium,webkit}from'playwright';import fs from'node:fs/promises';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const[base,engine,out,baselineFile,candidateFile,planFile,matrixFile,pointsFile,calibrationFile,selectionFile]=process.argv.slice(2);assert.ok(base&&calibrationFile);assert.ok(['chromium','webkit'].includes(engine));assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const sha=b=>createHash('sha256').update(b).digest('hex'),revision='4f64421314f0d0f5d0c04b916d30e821587c1a6a',scenePath='src/championship/presentation/ranchThreeScene.js';
const baseline=await fs.readFile(baselineFile,'utf8'),candidate=await fs.readFile(candidateFile,'utf8');assert.equal(sha(baseline),'1d60444883f996bcf939a4989b84bd602efe03cbe7ec35db59ef84f3abb134a6');assert.equal(sha(candidate),'8a65acb62685e1c00dec88b3023301dcfba332c33b9378ebb6bb1366b9228284');assert.equal(sha(baseline),sha(execFileSync('git',['show',revision+':'+scenePath])));
const bytes=await fs.readFile(planFile);assert.equal(sha(bytes),'5fdbf59f5c4a1aa52b7438fd9cfe4308a192c90bef9e9b46f27281bb51535d8d');const plan=JSON.parse(bytes),matrix=JSON.parse(await fs.readFile(matrixFile)),points=JSON.parse(await fs.readFile(pointsFile)),calibration=JSON.parse(await fs.readFile(calibrationFile));assert.equal(calibration.engine,engine);assert.equal(calibration.runnerSha256,'5d165899817841f75fcccf136231d984a4f2ddf1167c0975bccb4953711363db');assert.deepEqual(calibration.coverage,{expectedCases:4,successfulCases:4});const measured=calibration.results.filter(r=>r.zoom===1).map(r=>r.evidence.positions.find(p=>p.speciesIndex===25).nativeScreenPixels);assert.deepEqual(measured,[3,3]);assert.equal(calibration.baselineRevision,revision);assert.equal(calibration.fixtureSha256,'e2a7ffcab9d0e37ea15fafcdc312aed4ea5d2c3afdc218c2de1467ac117c3211');assert.equal(calibration.results.length,4);
for(const zoom of [1,.7]){const rows=calibration.results.filter(r=>r.zoom===zoom);assert.deepEqual(rows.map(r=>r.mode).sort(),['baseline','floor-only']);for(const row of rows){assert.equal(row.status,'PAIRED_IDENTITY_ACTIVATION_CAPTURED_VISUAL_PENDING');assert.equal(row.probeSha256,'325ad54f05ff89b01b7bdb69d3cfc10357a462b12019134b87eb32e42e161224');assert.equal(row.contactVariant,'old');assert.deepEqual(row.contactSourceSha256,{roster:'5a810256912ba9faec9825480ccf789b78537848742e2163f4aa0bf695d6e4b5',helper:'5db6ea2ee5e4d06bc2b52a70fed79fa94cec55e6cb3e96caec114c152f4efe17'});assert.equal(row.cameraCalibration.hostAriaBusy,'false');assert.equal(row.cameraCalibration.hostLoadState,'ready');assert.equal(row.species,25);assert.deepEqual(row.viewport,{width:390,height:844,dpr:1});assert.equal(row.sceneSha256,row.mode==='baseline'?sha(baseline):'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb');assert.ok(row.cameraCalibration.zoomButtonText.includes(zoom===1?'100%':'70%'));const p=row.evidence.positions.find(p=>p.speciesIndex===25),d=p?.testOnlyContactDiagnostic;assert.ok(p&&d);assert.equal(p.nativeScreenPixels,d.root.scaleX);assert.equal(d.root.scaleX,d.root.scaleY);}}

assert.equal(sha(await fs.readFile(pointsFile)),'d46aefced53ef24c6210aef7048e936c38c27896a37d09e95773079fe0c2769e');
const inventory=JSON.parse(await fs.readFile('assets/production/cage/three-20261021/manifest.json')),field=inventory.fields.find(f=>f.fieldId==='field_cm28_01');
assert.equal(field.sha256,'43099ad42413cba74f6d9c2e0323f2937832757eb2d39447ec5ee9e9c1100d21');assert.equal(sha(await fs.readFile(field.url)),field.sha256);
const selection=JSON.parse(await fs.readFile(selectionFile));assert.equal(selection.inventorySha256,sha(bytes));assert.ok([8,226].includes(selection.routes.length));assert.equal(new Set(selection.routes.map(r=>r.formIndex)).size,selection.routes.length);
const manifest=JSON.parse(await fs.readFile('tests/ranch-contact-pilot/manifest.json'));
const path=await import('node:path');const selectionTarget=['tests/ranch-contact-pilot/pilot.json','tests/ranch-contact-pilot/bounded226.json'].find(p=>path.resolve(p)===path.resolve(selectionFile));assert.ok(selectionTarget,'EXACT_APPROVED_SELECTION_PATH_REQUIRED');
const selectedManifest=manifest.files.find(f=>f.target===selectionTarget);assert.ok(selectedManifest);assert.equal(sha(await fs.readFile(selectionFile)),selectedManifest.sha256,'SELECTION_BYTES_DRIFT');
for(const r of selection.routes)assert.deepEqual(r.seedRoles.map(s=>s.role),['IDLE_REQUEST_SEED','SOURCE_PREDICTED_RISK_NOT_MEASURED_WORST']);
for(const f of manifest.files)assert.equal(sha(await fs.readFile(f.target)),f.sha256,'LOCAL_DIAGNOSTIC_FILE_DRIFT:'+f.target);
const fragment=await fs.readFile('tests/ranch-contact-pilot/normal-read.fragment.js','utf8');
await fs.mkdir(out,{recursive:true});const sources={};
for(const[mode,file,source]of[['raw4f',baselineFile,baseline],['recovery8a65',candidateFile,candidate]]){
 const dest=out+'/'+mode+'-mask.js';execFileSync(process.execPath,['tests/ranch-split/probe/inject-actor-mask.mjs','--input',file,'--output',dest,'--expected-sha',sha(source)]);
 let generated=await fs.readFile(dest,'utf8');const seam='  function dispose(){',api='captureActorMask,captureActorMaskTriangleControl,captureActorMaskState,';assert.equal(generated.split(seam).length,2);assert.equal(generated.split(api).length,2);generated=generated.replace(seam,fragment+'\n'+seam).replace(api,api+'captureNormalDrawingBuffer,captureBatchMaterialConfiguration,');sources[mode]=generated;await fs.writeFile(out+'/'+mode+'-probe.js',generated);
}
const browser=await({chromium,webkit}[engine]).launch({headless:true}),results=[];let failure=null;
const save=()=>fs.writeFile(out+'/contact-results.json',JSON.stringify({engine,selectionSha256:sha(JSON.stringify(selection)),routes:selection.routes.length,expectedRows:selection.routes.length*4,results,failure,scope:'IDLE_REQUEST_AND_SOURCE_PREDICTED_RISK_ONLY_NOT_MEASURED_WORST',anatomicalReview:'PENDING_MANUAL',releaseApproved:false},null,2));
try{for(const route of selection.routes){
 const form=plan.forms.find(f=>f.formIndex===route.formIndex);assert.equal(form.runtimeSha256,route.runtimeSha256);assert.equal(form.entityId,route.entityId);
 const seedCases=route.seedRoles.map(({role,frame})=>{const actual=form.frames.find(f=>f.id===frame.id);assert.deepEqual(actual,frame);return {role,frame:actual};});
 // Conservative native origin-centered fit selection. Exact displayed quad + every ellipse is checked in browser; no shrinking.
 const halfSpan=Math.max(...seedCases.flatMap(({frame})=>[Math.abs(frame.nativeBounds[0]),Math.abs(frame.nativeBounds[2])]))*3+24;
 let width=390; // Actual per-route fit, not raw-bounds-only viewport inference.
 for(const[mode,source]of Object.entries(sources)){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.setDefaultTimeout(180000);
  page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push(m.text())});
  await page.route('**/'+scenePath,r=>r.fulfill({status:200,contentType:'text/javascript',body:source}));
  for(const f of manifest.files.filter(f=>f.route)){const body=await fs.readFile(f.target,'utf8');await page.route('**/'+f.route,r=>r.fulfill({status:200,contentType:'text/javascript',body}));}
  try{
   await page.goto(new URL('tests/fixtures/ranch-contact-pilot.html',base).href);await page.waitForFunction(()=>!!globalThis.ranchAudit);
   const fixtures=await page.evaluate(matrix=>ranchAudit.buildBindings(matrix,['field_cm28_01']),matrix),fixture=fixtures.field_cm28_01;
   fixture.baseNativePixels=3;fixture.nativeScaleAuthority={kind:'MEASURED_PHONE_UNIT_3_NO_SPRITE_SHRINK',calibrationSha256:sha(await fs.readFile(calibrationFile)),nativeScreenPixels:3};
   const point=points.routes.find(r=>r.formIndex===form.formIndex).point,first=seedCases[0].frame;
   const test={...first,character:form,fieldId:'field_cm28_01',subjectKind:'actor',ownerMode:'missing',navigationPolicy:'REQUIRE_ADMISSION',nativeZ:0,zoom:1,viewport:{width,height:844},pointNative:point.map((v,i)=>v+fixture.targetOriginNative[i])};
   let initial=await page.evaluate(({test,fixture})=>ranchAudit.render(test,fixture),{test,fixture});assert.equal(initial.admission.ownerInstance,fixture.targetCageInstanceId);
   let fit=await page.evaluate(async frames=>{const rows=[];for(const f of frames)rows.push(await ranchAudit.probeContactFit(f));return rows;},seedCases.map(s=>s.frame));
   if(!fit.every(r=>r.fits)){width=768;await page.setViewportSize({width,height:844});test.viewport.width=width;initial=await page.evaluate(({test,fixture})=>ranchAudit.render(test,fixture),{test,fixture});fit=await page.evaluate(async frames=>{const rows=[];for(const f of frames)rows.push(await ranchAudit.probeContactFit(f));return rows;},seedCases.map(s=>s.frame));}
   assert.ok(fit.every(r=>r.fits&&r.nativeUnitPixels===3),'FULL_BODY_AND_ALL_SHADOW_ELLIPSES_MUST_FIT_WITHOUT_SHRINK');
   for(const[index,{role,frame}]of seedCases.entries()){
    const batch=await page.evaluate(({frame,authority})=>ranchAudit.runRaisingFrameBatch([frame],authority),{frame:{...frame,index,runtimeSha256:form.runtimeSha256},authority:{runtimeSha256:form.runtimeSha256,sourceSha256:sha(mode==='raw4f'?baseline:candidate),fieldId:'field_cm28_01',viewport:[width,844],dpr:1,engine}});
    const evidence=await page.evaluate(()=>ranchAudit.captureContactEvidence());
    const prefix=`route-${form.formIndex}-${role}-${mode}`;
    for(const[target,pair]of Object.entries(evidence.masks))for(const[kind,b64]of Object.entries(pair))await fs.writeFile(out+'/'+prefix+'-'+target+'-'+kind+'.png',Buffer.from(b64,'base64'));
    delete evidence.masks;await page.screenshot({path:out+'/'+prefix+'-normal.png'});
    assert.deepEqual(errors,[]);results.push({formIndex:form.formIndex,entityId:form.entityId,form:form.form,mode,role,frameId:frame.id,sourceSha256:sha(mode==='raw4f'?baseline:candidate),viewport:{width,height:844,dpr:1},omittedStaticTextures:form.frames.length-new Set(seedCases.map(s=>s.frame.id)).size,nativeZ:0,scope:'NO_LIVE_JUMP_OR_TRANSITION_COVERAGE',prefix,initial,fit,batch,evidence});await save();
   }
  }catch(e){await fs.writeFile(out+`/route-${form.formIndex}-${mode}-failure.json`,JSON.stringify(await page.evaluate(()=>({atlas:globalThis.lastContactAtlasIdentity??null,batch:globalThis.lastBatchFailure??null})).catch(()=>({})),null,2));await page.screenshot({path:out+`/route-${form.formIndex}-${mode}-failure.png`}).catch(()=>{});throw e;}finally{await context.close();}
 }
}}catch(e){failure=String(e);throw e;}finally{await browser.close();await save();}
assert.equal(results.length,selection.routes.length*4);
