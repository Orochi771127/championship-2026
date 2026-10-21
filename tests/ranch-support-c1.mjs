// A1 explicit test-only shared WATER + ICE repair and framebuffer depth diagnostic reference. NOT raw production baseline.
import {chromium,webkit} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const [base,engine,out,baselineFile,planFile,matrixFile,rosterFile,referenceOverlayFile,candidateOverlayFile,supportMetadataFile]=process.argv.slice(2);assert.ok(base&&out&&baselineFile&&planFile&&matrixFile&&rosterFile&&referenceOverlayFile&&candidateOverlayFile&&supportMetadataFile);assert.ok(['chromium','webkit'].includes(engine));assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const sha=s=>createHash('sha256').update(s).digest('hex'),sourcePath='src/championship/presentation/ranchThreeScene.js',baselineRevision='4f64421314f0d0f5d0c04b916d30e821587c1a6a';
const plan=JSON.parse(await fs.readFile(planFile)),matrix=JSON.parse(await fs.readFile(matrixFile)),roster=JSON.parse(await fs.readFile(rosterFile));
assert.equal(sha(await fs.readFile(planFile)),'5a03781ee039c68350a0880b0c4bb1ae88043dfed5f91e3a6fc5a752371c203e');assert.equal(plan.baselineRevision,baselineRevision);assert.equal(plan.count,72);assert.equal(plan.cases.length,72);assert.equal(new Set(plan.cases.map(c=>c.id)).size,72);const required=['field_cm02_01','field_cm07_01','field_cm09_01','field_cm19_01','field_cm21_01','field_cm35_01','field_cm39_01'];
const inventory=JSON.parse(await fs.readFile('assets/production/cage/three-20261021/manifest.json'));for(const fieldId of required){const spec=inventory.fields.find(f=>f.fieldId===fieldId),pin=plan.models.find(f=>f.fieldId===fieldId);assert.ok(spec&&pin);assert.equal(spec.sha256,pin.sha256);assert.equal(sha(await fs.readFile(spec.url)),pin.sha256);}
const character=roster.characters.find(c=>c.entityId==='m106_nyaromon');assert.ok(character);const [sequenceId,frameIndex,texture]=character.idle;
const rawBaseline=await fs.readFile(baselineFile,'utf8'),rawCandidate=await fs.readFile(sourcePath,'utf8');assert.equal(sha(rawBaseline),sha(execFileSync('git',['show',baselineRevision+':'+sourcePath])));assert.equal(sha(rawCandidate),'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb');
const baseline=await fs.readFile(referenceOverlayFile,'utf8'),candidate=await fs.readFile(candidateOverlayFile,'utf8');assert.equal(sha(baseline),'184d6c5322242bb45d2346d5a536c8844157d59723504bb48e99010abe79b1d7');assert.equal(sha(candidate),'1639fed915ac80207177e1339b0f8725f832f446c1d61ec6d7c467c98e9eec40');
const metadataText=await fs.readFile(supportMetadataFile,'utf8');assert.equal(sha(metadataText),'ea99645776fb657de4d91baf9853583af51f677fad39c3fda73ba5b37fb065d5');
const helper=await fs.readFile('tests/ranch-support-review/ranchSupportAudit.mjs','utf8');assert.equal(sha(helper),'fb42d410ba895a578507bf985a6f7dd471e274a5238d19b1ae070d536b2b4979');
const admittedBytes=await fs.readFile('tests/ranch-floor-data/admitted-probes-v2.json');assert.equal(sha(admittedBytes),'da74c6c56859281a60898e6d07dbf2a53c47e95bb8064d0f09491f226c2b7018');const grassProbe=JSON.parse(admittedBytes).probes.find(p=>p.fieldId==='field_cm02_01');assert.ok(grassProbe);
const phase='C1_FINITE_BOUNDARY_DENIAL_LIFT_FOREGROUND';const cases=plan.cases.map(c=>({...c,probe:{pointLocalNative:c.pointLocalNative,scope:c.lane}}));assert.deepEqual([...new Set(cases.map(c=>c.fieldId))].sort(),required);
assert.equal(sha(await fs.readFile('tests/ranch-grass-probe/inject-actor-mask.mjs')),'70b5fdf502296308af5393c78bc5bfb7aae9de40931e126010b84503830a5bbe');assert.equal(sha(await fs.readFile('tests/ranch-grass-probe/actor-mask-probe.fragment.js')),'30078391e521cee6edecb82856a22fde38dc15ecdf5369f40dd86d59e763f6d8');await fs.mkdir(out,{recursive:true});const probesByMode={};for(const mode of ['floor1ae-plus-water-ice-repair','support-sheets-plus-water-ice-repair']){const file=out+'/'+mode+'-mask-probe.js';execFileSync(process.execPath,['tests/ranch-grass-probe/inject-actor-mask.mjs','--input',mode==='floor1ae-plus-water-ice-repair'?referenceOverlayFile:candidateOverlayFile,'--output',file,'--expected-sha',sha(mode==='floor1ae-plus-water-ice-repair'?baseline:candidate)]);const effectInjector='tests/ranch-water-review/inject-effect-diagnostics.mjs';assert.equal(sha(await fs.readFile(effectInjector)),'1b8a80bc2eeefd71966bc4ffcd4190568973df2b2065bbfd2a2fd52cbc26bf55');const finalFile=out+'/'+mode+'-mask-effects-probe.js';execFileSync(process.execPath,[effectInjector,'--input',file,'--output',finalFile,'--expected-sha',sha(await fs.readFile(file))]);probesByMode[mode]=await fs.readFile(finalFile,'utf8');}
const browser=await ({chromium,webkit}[engine]).launch({headless:true}),results=[],fieldFailures=[],effectChecks=[],grassControls=[];let failure=null;
const save=()=>fs.writeFile(out+'/support-c1-results.json',JSON.stringify({baselineRevision,referencePolicy:'FLOOR_1AE_PLUS_MATCHED_WATER_ICE_REPAIR_SUPPORT_INCREMENT_ONLY_NOT_RAW4F_FOREGROUND_GATE',candidatePolicy:'EXACT_REVIEWED_SIX_FIELD_SUPPORT_PLUS_MATCHED_WATER_ICE_REPAIR',rawSourceHashes:{baseline:sha(rawBaseline),floor:sha(rawCandidate)},routedSourceHashes:{reference:sha(baseline),candidate:sha(candidate)},engine,phase,expectedCount:cases.length*2,plannedIds:cases.map(c=>c.id),results,fieldFailures,effectChecks,grassControls,coverage:cases.flatMap(c=>['floor1ae-plus-water-ice-repair','support-sheets-plus-water-ice-repair'].map(mode=>({id:c.id,mode,fieldId:c.fieldId,status:results.some(r=>r.id===c.id&&r.mode===mode)?'CAPTURED':fieldFailures.some(f=>f.fieldId===c.fieldId&&f.mode===mode)?'BLOCKED_BY_RECORDED_FIELD_FAILURE':'NOT_YET_EXECUTED'}))),failure:failure??(fieldFailures.length?'ONE_OR_MORE_FIELDS_FAILED':null),releaseApproved:false,status:failure||fieldFailures.length?'FAIL':'DIAGNOSTIC_NOT_SUPPORT_APPROVAL',supportSemantics:plan.supportSemantics??'UNVERIFIED'},null,2));
try{for(const fieldId of required)for(const mode of ['floor1ae-plus-water-ice-repair','support-sheets-plus-water-ice-repair']){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];let routed=0,helperRouted=0;page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{let s=0x137ab;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};});
 page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push(m.text())});await page.route('**/'+sourcePath,async route=>{routed++;await route.fulfill({status:200,contentType:'text/javascript',body:probesByMode[mode]})});
 await page.route('**/src/championship/presentation/ranchSupportAudit.mjs',async route=>{helperRouted++;await route.fulfill({status:200,contentType:'text/javascript',body:helper})});
 try{
  await page.goto(new URL('tests/fixtures/ranch-support-c1-audit.html',base).href);await page.waitForFunction(()=>!!globalThis.ranchAudit);assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight,devicePixelRatio,visualViewport.scale]),[390,844,1,1]);
  const bindings=await page.evaluate(({matrix,fieldId})=>globalThis.ranchAudit.buildBindings(matrix,[fieldId]),{matrix,fieldId});
  for(const input of cases.filter(c=>c.fieldId===fieldId)){const fixture=bindings[input.fieldId];assert.ok(fixture);fixture.supportAudit=mode.startsWith('support')?{metadataText}:null;const test={...input,pointNative:input.probe.pointLocalNative.map((v,k)=>v+fixture.targetOriginNative[k])},prefix=mode+'-'+test.id;
   const data=await page.evaluate(({test,fixture})=>globalThis.ranchAudit.render(test,fixture),{test,fixture});assert.ok(Number.isFinite(data.projectionError)&&data.projectionError<=.5);assert.ok(data.diagnostics.frames>0&&!data.diagnostics.lost);if(mode.startsWith('support')){const key={actor:'audit',food:'food:probe',waste:'waste:probe'}[test.subjectKind],support=data.diagnostics.spriteDiagnostics.find(x=>x.key===key)?.physicalSupport;assert.ok(support);if(test.ownerMode==='missing')assert.equal(support.status,'DENIED_MISSING_OWNER');else if(test.ownerMode==='wrong-index')assert.equal(support.status,'DENIED_OWNER_NOT_UNIQUE');else{assert.equal(support.status,'VERIFIED_OWNER_PROJECTED_TOPS');assert.ok(support.candidateCount>=0);assert.deepEqual(support.bufferSize,[390,844]);}}assert.deepEqual(errors,[]);
   const rect=await page.locator('.cm-ranch-three-canvas').evaluate(c=>[c.getBoundingClientRect().width,c.getBoundingClientRect().height]);assert.deepEqual(rect,[390,844]);
   let actual=await page.screenshot({path:out+'/'+prefix+'-actual.png'});assert.equal(actual.readUInt32BE(16),390);assert.equal(actual.readUInt32BE(20),844);
   const initialActual=actual,settling={limit:4,frames:[{sha256:sha(actual),stage:'INITIAL_ORDINARY_FRAME'}],converged:false};
   for(let attempt=1;attempt<=settling.limit;attempt++){
    const state=await page.evaluate(()=>globalThis.ranchAudit.settleNormalFrame()),next=await page.screenshot();settling.frames.push({attempt,sha256:sha(next),state});
    if(sha(next)===sha(actual)){actual=next;settling.converged=true;break;}
    actual=next;
   }
   await fs.writeFile(out+'/'+prefix+'-settling.json',JSON.stringify(settling,null,2));
   if(sha(initialActual)!==sha(actual))await fs.writeFile(out+'/'+prefix+'-initial-unsettled.png',initialActual);
   if(!settling.converged){await fs.writeFile(out+'/'+prefix+'-settle-last.png',actual);throw Error('ORDINARY_FRAME_SETTLE_DID_NOT_CONVERGE_WITHIN_4_REDRAWS');}
   await fs.writeFile(out+'/'+prefix+'-actual.png',actual);
   const preState=await page.evaluate(()=>globalThis.ranchAudit.maskState());await page.evaluate(()=>globalThis.ranchAudit.redrawNormal());const repeat=await page.screenshot();if(sha(repeat)!==sha(actual)){await fs.writeFile(out+'/'+prefix+'-preprobe-redraw.png',repeat);await fs.writeFile(out+'/'+prefix+'-failure.json',JSON.stringify({stage:'PREPROBE_REDRAW',data,preState,postState:await page.evaluate(()=>globalThis.ranchAudit.maskState())},null,2));}assert.equal(sha(repeat),sha(actual),'Normal zero-delta redraw reproducibility');
   const pipelines=[];
   for(const target of ['offscreen','default']){
    const controls=await page.evaluate(({kind,target})=>globalThis.ranchAudit.validateTerrainMaskControls(kind,target),{kind:test.subjectKind,target});
    await page.evaluate(()=>globalThis.ranchAudit.redrawNormal());
    const controlRestored=await page.screenshot({path:out+'/'+prefix+'-'+target+'-controls-restored.png'});assert.equal(sha(controlRestored),sha(actual),'Known controls normal restoration');
    const optionsList=[{target,debugGPU:true}];
    const samples=[];
    for(const options of optionsList){
     const tag=target+'-'+(options.control?'thin-'+options.thinHeight:'terrain');
     const mask=await page.evaluate(({kind,options})=>globalThis.ranchAudit.captureTerrainMask(kind,true,options),{kind:test.subjectKind,options});
     for(const kind of ['reference','visible']){await fs.writeFile(out+'/'+prefix+'-'+tag+'-'+kind+'-mask.png',Buffer.from(mask[kind+'Png'].split(',')[1],'base64'));delete mask[kind+'Png'];}
     const restored=await page.screenshot({path:out+'/'+prefix+'-'+tag+'-restored.png'});
     await fs.writeFile(out+'/'+prefix+'-'+tag+'-raw-debug.json',JSON.stringify(mask,null,2));
     assert.equal(sha(restored),sha(actual),'Every default/offscreen probe group restores settled normal image');
     for(const role of ['reference','actual'])for(const stage of ['original','mask']){
      const gpu=mask.gpuDebug[role]?.[stage];assert.ok(gpu,'GPU_DEBUG_UNAVAILABLE');assert.deepEqual(gpu.framebuffer.viewport,[0,0,390,844],'Actual physical viewport origin and full size');assert.equal(gpu.framebuffer.scissorTest,false,'Support projection requires scissor disabled');
      if(stage==='original')assert.equal(gpu.framebuffer.target,null,'Original readout must be actual default framebuffer');
      else assert.equal(gpu.framebuffer.target===null,target==='default');
      assert.ok(gpu.programAvailable&&gpu.shaders.length>0,'COMPILED_PROGRAM_UNAVAILABLE_NOT_FLOOR_ABSENT');
      for(const shader of gpu.shaders){const sourceSha256=sha(shader.source);await fs.writeFile(out+'/shader-'+sourceSha256+'.glsl',shader.source);delete shader.source;shader.sourceSha256=sourceSha256;}
      if(mode.startsWith('support'))assert.ok(gpu.shaders.some(x=>x.hasFloorProxy)&&gpu.shaders.some(x=>x.hasFragDepth),'Candidate actual compiled floor hook required');
     }
     delete mask.debugStates;samples.push({tag,mask,normalRestoredSha256:sha(restored)});assert.deepEqual(errors,[]);
    }
    delete controls.debugStates;pipelines.push({target,controls,samples});
   }
   results.push({id:test.id,mode,lane:test.lane,ownerMode:test.ownerMode,navigationPolicy:test.navigationPolicy,nativeZ:test.nativeZ,settling,fieldId:test.fieldId,subjectKind:test.subjectKind,zoom:test.zoom,probe:test.probe,data,pipelines,normalImageSha256:sha(actual),sourceSha256:sha(mode.startsWith('floor1ae')?baseline:candidate),coverageStatus:'CAPTURED_INTENSITY_METRICS_NOT_UNOCCLUDED_WHOLE_FOOTPRINT_APPROVAL',scope:'DEFAULT_AND_OFFSCREEN_NOT_ASSUMED_EQUIVALENT_MSAA_AND_EQUAL_DEPTH_ORDER_DIFFER;ADMITTED_XY_NOT_ACTUAL_APP_MOVE_OR_VERTICAL_AUTHORITY'});await save();
  }
  if(fieldId==='field_cm02_01'&&mode.startsWith('support')){
   const fixture=bindings[fieldId];fixture.supportAudit={metadataText};
   const test={id:'c1-single-grass-attribution-c0-food',fieldId,character,sequenceId,frameIndex,texture,nativeZ:0,zoom:1,viewport:{width:390,height:844},subjectKind:'food',ownerMode:'verified',navigationPolicy:'REQUIRE_ADMISSION',pointNative:grassProbe.pointLocalNative.map((v,k)=>v+fixture.targetOriginNative[k])};
   const data=await page.evaluate(({test,fixture})=>globalThis.ranchAudit.render(test,fixture),{test,fixture});let ordinary=await page.screenshot(),converged=false;
   for(let i=0;i<4;i++){await page.evaluate(()=>globalThis.ranchAudit.settleNormalFrame());const next=await page.screenshot();if(sha(next)===sha(ordinary)){ordinary=next;converged=true;break;}ordinary=next;}assert.ok(converged,'Grass ordinary frame convergence');await fs.writeFile(out+'/grass-normal.png',ordinary);
   const control={fieldId,mode,data,sourceSha256:sha(candidate),normalSha256:sha(ordinary),samples:[],status:'PENDING'};grassControls.push(control);await save();
   for(const triangleMode of [null,'without-grass','only-grass']){
    const tag=triangleMode??'full-scene';const options={target:'default',debugGPU:true,evidencePixel:[184,530],...(triangleMode?{triangleMode}:{})};
    const mask=await page.evaluate(options=>globalThis.ranchAudit.captureTerrainMask('food',true,options),options);
    for(const kind of ['reference','visible']){await fs.writeFile(out+'/grass-'+tag+'-'+kind+'.png',Buffer.from(mask[kind+'Png'].split(',')[1],'base64'));delete mask[kind+'Png'];}
    const restored=await page.screenshot({path:out+'/grass-'+tag+'-restored.png'});await fs.writeFile(out+'/grass-'+tag+'-debug.json',JSON.stringify(mask,null,2));assert.equal(sha(restored),sha(ordinary),'Grass control restores unchanged normal rendering');
    const framebuffer=mask.gpuDebug.actual.mask.framebuffer;assert.equal(framebuffer.target,null);assert.deepEqual(framebuffer.viewport,[0,0,390,844]);assert.equal(framebuffer.scissorTest,false);assert.deepEqual(errors,[]);
    control.samples.push({tag,mask,restoredSha256:sha(restored)});await save();
   }
   const [full,without,only]=control.samples.map(s=>s.mask);
   for(const m of [without,only])assert.equal(m.coverageHashes.referenceRGBA,full.coverageHashes.referenceRGBA,'Identical source alpha in grass counterfactuals');
   assert.equal(without.coverageHashes.actualRGBA,without.coverageHashes.referenceRGBA,'Excluding exact retained grass removes all deficit in this bounded food control');
   assert.equal(only.coverageHashes.actualRGBA,full.coverageHashes.actualRGBA,'Exact retained grass alone reproduces full-scene resolved coverage');
   for(const m of [without,only]){assert.equal(m.triangleControl.triangleIndex,26543);assert.equal(m.triangleControl.ownerIndex,1);assert.equal(m.triangleControl.shift,0);assert.equal(m.triangleControl.instanceId,'audit:target');}
   control.deficitReproduced=full.resolvedCoverage.deficitPixels>0;control.causalAttributionObserved=control.deficitReproduced;
   if(engine==='chromium'){assert.deepEqual(full.resolvedCoverage.transitions,{'255->192':1},'Reproduce exact Chromium C0 grass deficit');assert.deepEqual(full.pixelEvidence.actualRGBA,[192,192,192,255]);assert.deepEqual(without.pixelEvidence.actualRGBA,[255,255,255,255]);}
   control.status='EXACT_TRIANGLE_COUNTERFACTUAL_ATTRIBUTION_WITH_STRICT_RESTORE_NOT_REMOVAL_APPROVAL';await save();
  }
  if(['field_cm09_01','field_cm19_01','field_cm21_01','field_cm39_01'].includes(fieldId)){
   await page.evaluate(()=>globalThis.ranchAudit.settleNormalFrame());const before=await page.evaluate(()=>globalThis.ranchAudit.environmentEffectState());
   const beforePng=await page.screenshot({path:out+'/'+mode+'-'+fieldId+'-effect-time0.png'});
   const after=await page.evaluate(()=>globalThis.ranchAudit.advanceEnvironment(20));await page.evaluate(()=>globalThis.ranchAudit.settleNormalFrame());const afterPng=await page.screenshot({path:out+'/'+mode+'-'+fieldId+'-effect-time1.png'});
   const kind=fieldId==='field_cm21_01'?'ice':'water';assert.equal(before.sceneClock,0);assert.ok(Math.abs(after.sceneClock-1)<1e-9);
   for(const state of [before,after]){const surfaces=state.surfaces.filter(s=>s[kind+'Hooked']&&s.visible&&s.compiled);assert.ok(surfaces.length>0);for(const surface of surfaces){assert.ok(surface.uv?.count>0&&surface.uv.itemSize===2);assert.ok(Math.abs(surface[kind+'Time']-state.sceneClock)<1e-9);}}
   assert.notEqual(sha(beforePng),sha(afterPng));assert.deepEqual(errors,[]);effectChecks.push({fieldId,mode,kind,before,after,status:'LOCALLY_VISIBLE_COMPILED_EFFECT_TIME_ADVANCED_AND_SCENE_CHANGED_NOT_ONSCREEN_EFFECT_ATTRIBUTION'});await save();
  }
  assert.ok(routed>0);if(mode.startsWith('support'))assert.ok(helperRouted>0);
 }catch(error){
  const lastDepthDiagnostic=await page.evaluate(()=>globalThis.lastDepthDiagnostic??null).catch(()=>null);if(lastDepthDiagnostic)await fs.writeFile(out+'/'+mode+'-'+fieldId+'-last-depth-diagnostic.json',JSON.stringify(lastDepthDiagnostic,null,2));
  const fieldFailure={fieldId,mode,error:String(error),errors,sourceSha256:sha(mode==='floor1ae-plus-water-ice-repair'?baseline:candidate),routed,completedIds:results.filter(r=>r.fieldId===fieldId&&r.mode===mode).map(r=>r.id),blockedIds:cases.filter(c=>c.fieldId===fieldId&&!results.some(r=>r.id===c.id&&r.mode===mode)).map(c=>c.id)};fieldFailures.push(fieldFailure);
  await page.screenshot({path:out+'/'+mode+'-'+fieldId+'-field-failure.png'}).catch(()=>{});await fs.writeFile(out+'/'+mode+'-'+fieldId+'-field-failure.json',JSON.stringify(fieldFailure,null,2));await save();
 }finally{await context.close();}
}}catch(error){failure=String(error);throw error;}finally{await browser.close();await save();}
assert.equal(fieldFailures.length,0,'Every field failure remains fatal after unaffected fields are recorded');assert.equal(results.length,cases.length*2);assert.equal(grassControls.length,1);assert.equal(grassControls[0].status,'EXACT_TRIANGLE_COUNTERFACTUAL_ATTRIBUTION_WITH_STRICT_RESTORE_NOT_REMOVAL_APPROVAL');
