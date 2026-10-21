// A1 explicit test-only shared WATER + ICE repair and framebuffer depth diagnostic reference. NOT raw production baseline.
import {chromium,webkit} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const [base,engine,out,baselineFile,planFile,matrixFile,rosterFile,referenceOverlayFile,candidateOverlayFile]=process.argv.slice(2);assert.ok(base&&out&&baselineFile&&planFile&&matrixFile&&rosterFile&&referenceOverlayFile&&candidateOverlayFile);assert.ok(['chromium','webkit'].includes(engine));assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const sha=s=>createHash('sha256').update(s).digest('hex'),sourcePath='src/championship/presentation/ranchThreeScene.js',baselineRevision='4f64421314f0d0f5d0c04b916d30e821587c1a6a';
const plan=JSON.parse(await fs.readFile(planFile)),matrix=JSON.parse(await fs.readFile(matrixFile)),roster=JSON.parse(await fs.readFile(rosterFile));
assert.equal(sha(await fs.readFile(planFile)),'da74c6c56859281a60898e6d07dbf2a53c47e95bb8064d0f09491f226c2b7018');assert.equal(plan.probes.length,6);assert.equal(plan.baselineRevision,baselineRevision);
const required=['field_cm02_01','field_cm09_01','field_cm21_01','field_cm35_01'];
const inventory=JSON.parse(await fs.readFile('assets/production/cage/three-20261021/manifest.json'));for(const fieldId of required){const spec=inventory.fields.find(f=>f.fieldId===fieldId),pin=plan.models.find(f=>f.fieldId===fieldId);assert.ok(spec&&pin);assert.equal(spec.sha256,pin.sha256);assert.equal(sha(await fs.readFile(spec.url)),pin.sha256);}
const character=roster.characters.find(c=>c.entityId==='m106_nyaromon');assert.ok(character);const [sequenceId,frameIndex,texture]=character.idle;
const rawBaseline=await fs.readFile(baselineFile,'utf8'),rawCandidate=await fs.readFile(sourcePath,'utf8');assert.equal(sha(rawBaseline),sha(execFileSync('git',['show',baselineRevision+':'+sourcePath])));assert.equal(sha(rawCandidate),'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb');
const baseline=await fs.readFile(referenceOverlayFile,'utf8'),candidate=await fs.readFile(candidateOverlayFile,'utf8');assert.equal(sha(baseline),'c71ae0661bc447176fa3bf3f8981fee861cd0e32b5915ddac9484411f1c03135');assert.equal(sha(candidate),'184d6c5322242bb45d2346d5a536c8844157d59723504bb48e99010abe79b1d7');
const phase='FOUR_ADMITTED_INTERIOR_DEPTH_DIAGNOSTICS';const probes=plan.probes.filter(p=>required.includes(p.fieldId));assert.equal(probes.length,4);assert.deepEqual(probes.map(p=>p.fieldId).sort(),required);
const cases=probes.map(probe=>({id:`depth-v2-${probe.fieldId}-food-z1`,fieldId:probe.fieldId,character,sequenceId,frameIndex,texture,nativeZ:0,zoom:1,viewport:{width:390,height:844},subjectKind:'food',probe}));
assert.equal(sha(await fs.readFile('tests/ranch-depth-probe/inject-actor-mask.mjs')),'493d59598fd6c64d7015a45473aca34d637719e4ed3a33ef438759ef7a5d2a2e');assert.equal(sha(await fs.readFile('tests/ranch-depth-probe/actor-mask-probe.fragment.js')),'fdc4b26470629ce1dcc31b262c0504af098ef569500c709d128178dbaaf3649d');await fs.mkdir(out,{recursive:true});const probesByMode={};for(const mode of ['4f-plus-water-ice-repair','floor1ae-plus-water-ice-repair']){const file=out+'/'+mode+'-mask-probe.js';execFileSync(process.execPath,['tests/ranch-depth-probe/inject-actor-mask.mjs','--input',mode==='4f-plus-water-ice-repair'?referenceOverlayFile:candidateOverlayFile,'--output',file,'--expected-sha',sha(mode==='4f-plus-water-ice-repair'?baseline:candidate)]);const effectInjector='tests/ranch-water-review/inject-effect-diagnostics.mjs';assert.equal(sha(await fs.readFile(effectInjector)),'1b8a80bc2eeefd71966bc4ffcd4190568973df2b2065bbfd2a2fd52cbc26bf55');const finalFile=out+'/'+mode+'-mask-effects-probe.js';execFileSync(process.execPath,[effectInjector,'--input',file,'--output',finalFile,'--expected-sha',sha(await fs.readFile(file))]);probesByMode[mode]=await fs.readFile(finalFile,'utf8');}
const browser=await ({chromium,webkit}[engine]).launch({headless:true}),results=[],fieldFailures=[],effectChecks=[];let failure=null;
const save=()=>fs.writeFile(out+'/depth-results.json',JSON.stringify({baselineRevision,referencePolicy:'RAW_4F_PLUS_EXPLICIT_SHARED_WATER_ICE_REPAIR_NOT_RAW_BASELINE',candidatePolicy:'FLOOR_1AE_PLUS_SAME_WATER_ICE_REPAIR',rawSourceHashes:{baseline:sha(rawBaseline),floor:sha(rawCandidate)},routedSourceHashes:{reference:sha(baseline),candidate:sha(candidate)},engine,phase,expectedCount:cases.length*2,plannedIds:cases.map(c=>c.id),results,fieldFailures,effectChecks,coverage:cases.flatMap(c=>['4f-plus-water-ice-repair','floor1ae-plus-water-ice-repair'].map(mode=>({id:c.id,mode,fieldId:c.fieldId,status:results.some(r=>r.id===c.id&&r.mode===mode)?'CAPTURED':fieldFailures.some(f=>f.fieldId===c.fieldId&&f.mode===mode)?'BLOCKED_BY_RECORDED_FIELD_FAILURE':'NOT_YET_EXECUTED'}))),failure:failure??(fieldFailures.length?'ONE_OR_MORE_FIELDS_FAILED':null),releaseApproved:false,status:failure||fieldFailures.length?'FAIL':'DIAGNOSTIC_NOT_SUPPORT_APPROVAL',supportSemantics:plan.supportSemantics??'UNVERIFIED'},null,2));
try{for(const fieldId of required)for(const mode of ['4f-plus-water-ice-repair','floor1ae-plus-water-ice-repair']){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];let routed=0;page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{let s=0x137ab;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};});
 page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push(m.text())});await page.route('**/'+sourcePath,async route=>{routed++;await route.fulfill({status:200,contentType:'text/javascript',body:probesByMode[mode]})});
 try{
  await page.goto(new URL('tests/fixtures/ranch-depth-audit.html',base).href);await page.waitForFunction(()=>!!globalThis.ranchAudit);assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight,devicePixelRatio,visualViewport.scale]),[390,844,1,1]);
  const bindings=await page.evaluate(({matrix,fieldId})=>globalThis.ranchAudit.buildBindings(matrix,[fieldId]),{matrix,fieldId});
  for(const input of cases.filter(c=>c.fieldId===fieldId)){const fixture=bindings[input.fieldId];assert.ok(fixture);const test={...input,pointNative:input.probe.pointLocalNative.map((v,k)=>v+fixture.targetOriginNative[k])},prefix=mode+'-'+test.id;
   const data=await page.evaluate(({test,fixture})=>globalThis.ranchAudit.render(test,fixture),{test,fixture});assert.ok(Number.isFinite(data.projectionError)&&data.projectionError<=.5);assert.ok(data.diagnostics.frames>0&&!data.diagnostics.lost);assert.deepEqual(errors,[]);
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
    const optionsList=[{target,debugGPU:true}];if(fieldId==='field_cm02_01')for(const thinHeight of [0,.014,.015,.0155,.016,.0165,.02])optionsList.push({target,debugGPU:true,control:'thin-ground',thinHeight});
    const samples=[];
    for(const options of optionsList){
     const tag=target+'-'+(options.control?'thin-'+options.thinHeight:'terrain');
     const mask=await page.evaluate(({kind,options})=>globalThis.ranchAudit.captureTerrainMask(kind,true,options),{kind:test.subjectKind,options});
     for(const kind of ['reference','visible']){await fs.writeFile(out+'/'+prefix+'-'+tag+'-'+kind+'-mask.png',Buffer.from(mask[kind+'Png'].split(',')[1],'base64'));delete mask[kind+'Png'];}
     const restored=await page.screenshot({path:out+'/'+prefix+'-'+tag+'-restored.png'});
     await fs.writeFile(out+'/'+prefix+'-'+tag+'-raw-debug.json',JSON.stringify(mask,null,2));
     assert.equal(sha(restored),sha(actual),'Every default/offscreen probe group restores settled normal image');
     for(const role of ['reference','actual'])for(const stage of ['original','mask']){
      const gpu=mask.gpuDebug[role]?.[stage];assert.ok(gpu,'GPU_DEBUG_UNAVAILABLE');
      if(stage==='original')assert.equal(gpu.framebuffer.target,null,'Original readout must be actual default framebuffer');
      else assert.equal(gpu.framebuffer.target===null,target==='default');
      assert.ok(gpu.programAvailable&&gpu.shaders.length>0,'COMPILED_PROGRAM_UNAVAILABLE_NOT_FLOOR_ABSENT');
      for(const shader of gpu.shaders){const sourceSha256=sha(shader.source);await fs.writeFile(out+'/shader-'+sourceSha256+'.glsl',shader.source);delete shader.source;shader.sourceSha256=sourceSha256;}
      if(mode.startsWith('floor'))assert.ok(gpu.shaders.some(x=>x.hasFloorProxy)&&gpu.shaders.some(x=>x.hasFragDepth),'Candidate actual compiled floor hook required');
     }
     delete mask.debugStates;samples.push({tag,mask,normalRestoredSha256:sha(restored)});assert.deepEqual(errors,[]);
    }
    delete controls.debugStates;pipelines.push({target,controls,samples});
   }
   results.push({id:test.id,mode,settling,fieldId:test.fieldId,subjectKind:test.subjectKind,zoom:test.zoom,probe:test.probe,data,pipelines,normalImageSha256:sha(actual),sourceSha256:sha(mode.startsWith('4f')?baseline:candidate),scope:'DEFAULT_AND_OFFSCREEN_NOT_ASSUMED_EQUIVALENT_MSAA_AND_EQUAL_DEPTH_ORDER_DIFFER;ADMITTED_XY_NOT_ACTUAL_APP_MOVE_OR_VERTICAL_AUTHORITY'});await save();
  }
  if(['field_cm09_01','field_cm21_01'].includes(fieldId)){
   await page.evaluate(()=>globalThis.ranchAudit.settleNormalFrame());const before=await page.evaluate(()=>globalThis.ranchAudit.environmentEffectState());
   const beforePng=await page.screenshot({path:out+'/'+mode+'-'+fieldId+'-effect-time0.png'});
   const after=await page.evaluate(()=>globalThis.ranchAudit.advanceEnvironment(20));await page.evaluate(()=>globalThis.ranchAudit.settleNormalFrame());const afterPng=await page.screenshot({path:out+'/'+mode+'-'+fieldId+'-effect-time1.png'});
   const kind=fieldId==='field_cm21_01'?'ice':'water';assert.equal(before.sceneClock,0);assert.ok(Math.abs(after.sceneClock-1)<1e-9);
   for(const state of [before,after]){const surfaces=state.surfaces.filter(s=>s[kind+'Hooked']&&s.visible&&s.compiled);assert.ok(surfaces.length>0);for(const surface of surfaces){assert.ok(surface.uv?.count>0&&surface.uv.itemSize===2);assert.ok(Math.abs(surface[kind+'Time']-state.sceneClock)<1e-9);}}
   assert.notEqual(sha(beforePng),sha(afterPng));assert.deepEqual(errors,[]);effectChecks.push({fieldId,mode,kind,before,after,status:'LOCALLY_VISIBLE_COMPILED_EFFECT_TIME_ADVANCED_AND_SCENE_CHANGED_NOT_ONSCREEN_EFFECT_ATTRIBUTION'});await save();
  }
  assert.ok(routed>0);
 }catch(error){
  const lastDepthDiagnostic=await page.evaluate(()=>globalThis.lastDepthDiagnostic??null).catch(()=>null);if(lastDepthDiagnostic)await fs.writeFile(out+'/'+mode+'-'+fieldId+'-last-depth-diagnostic.json',JSON.stringify(lastDepthDiagnostic,null,2));
  const fieldFailure={fieldId,mode,error:String(error),errors,sourceSha256:sha(mode==='4f-plus-water-ice-repair'?baseline:candidate),routed,completedIds:results.filter(r=>r.fieldId===fieldId&&r.mode===mode).map(r=>r.id),blockedIds:cases.filter(c=>c.fieldId===fieldId&&!results.some(r=>r.id===c.id&&r.mode===mode)).map(c=>c.id)};fieldFailures.push(fieldFailure);
  await page.screenshot({path:out+'/'+mode+'-'+fieldId+'-field-failure.png'}).catch(()=>{});await fs.writeFile(out+'/'+mode+'-'+fieldId+'-field-failure.json',JSON.stringify(fieldFailure,null,2));await save();
 }finally{await context.close();}
}}catch(error){failure=String(error);throw error;}finally{await browser.close();await save();}
assert.equal(fieldFailures.length,0,'Every field failure remains fatal after unaffected fields are recorded');assert.equal(results.length,cases.length*2);
