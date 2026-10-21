// TEST-ONLY terrain visibility masks; never ship injected scene sources.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const [base,engine,out,baselineFile,planFile,matrixFile]=process.argv.slice(2);
assert.ok(base&&out&&baselineFile&&planFile&&matrixFile);assert.ok(['chromium','webkit'].includes(engine));
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const sourcePath='src/championship/presentation/ranchThreeScene.js',sha=s=>createHash('sha256').update(s).digest('hex');
const plan=JSON.parse(await fs.readFile(planFile)),matrix=JSON.parse(await fs.readFile(matrixFile));
assert.equal(plan.baselineRevision,'4f64421314f0d0f5d0c04b916d30e821587c1a6a');
const inventory=JSON.parse(await fs.readFile('assets/production/cage/three-20261021/manifest.json'));
const cm07=inventory.fields.find(f=>f.fieldId==='field_cm07_01');assert.ok(cm07);assert.equal(cm07.sha256,plan.modelSha256);assert.equal(sha(await fs.readFile(cm07.url)),plan.modelSha256);
assert.equal(plan.cases.length,16);assert.equal(new Set(plan.cases.map(c=>c.id)).size,16);
const baseline=await fs.readFile(baselineFile,'utf8');assert.equal(sha(baseline),sha(execFileSync('git',['show',plan.baselineRevision+':'+sourcePath])));
const candidate=await fs.readFile(sourcePath,'utf8');assert.equal(sha(candidate),'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb');
await fs.mkdir(out,{recursive:true});
const probeFiles={baseline:out+'/baseline-mask-probe.js','floor-only':out+'/floor-only-mask-probe.js'};
for(const mode of ['baseline','floor-only'])execFileSync(process.execPath,['tests/ranch-mask-probe/inject-actor-mask.mjs','--input',mode==='baseline'?baselineFile:sourcePath,'--output',probeFiles[mode],'--expected-sha',sha(mode==='baseline'?baseline:candidate)]);
const browser=await ({chromium,webkit}[engine]).launch({headless:true}),results=[];
try{for(const mode of ['baseline','floor-only']){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];let baselineRequests=0;
 page.setDefaultTimeout(180000);await page.addInitScript(()=>{let s=0x137ab;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};});
 page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push(m.text())});
 const injected=await fs.readFile(probeFiles[mode],'utf8');assert.ok(injected.startsWith('// GENERATED TEST-ONLY MASK PROBE.'));
 await page.route('**/'+sourcePath,async route=>{baselineRequests++;await route.fulfill({status:200,contentType:'text/javascript',body:injected})});
 try{
  await page.goto(new URL('tests/fixtures/ranch-mask-audit.html',base).href);await page.waitForFunction(()=>!!globalThis.ranchAudit);
  const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visualWidth:visualViewport.width,visualScale:visualViewport.scale,pixiWidth:document.querySelector('canvas').getBoundingClientRect().width,pixiHeight:document.querySelector('canvas').getBoundingClientRect().height}));assert.deepEqual(viewport,{width:390,height:844,dpr:1,visualWidth:390,visualScale:1,pixiWidth:390,pixiHeight:844},'Actual CSS phone viewport');
  const fixtures=await page.evaluate(m=>globalThis.ranchAudit.buildBindings(m,['field_cm07_01']),matrix);
  for(const test of plan.cases){
   assert.equal(test.fieldId,'field_cm07_01','Stationary reuse is same verified model only');
   const fixture=fixtures[test.fieldId];assert.ok(fixture);const prefix=mode+'-'+test.id;
   // Stationary samples all use deltaMS0. Reuse the single real CM07 scene/context;
   // beginMotion intentionally creates fresh contexts for time-advancing clips.
   await page.evaluate(({test,fixture})=>globalThis.ranchAudit.render({...test,subjectKind:'actor'},fixture),{test,fixture});
   const sample={...test.sample,index:0,animated:false,nativeTicks:0,deltaMS:0,pointNative:test.sample.pointLocalNative.map((v,k)=>v+fixture.targetOriginNative[k]),cameraCenterNative:test.sample.cameraCenterLocalNative.map((v,k)=>v+fixture.targetOriginNative[k])};
   const data=await page.evaluate(s=>globalThis.ranchAudit.stepMotion(s),sample);
   assert.equal(await page.evaluate(()=>globalThis.ranchAudit.maskState().sceneClock),0,'Stationary reused scene must remain at zero time');
   assert.equal(await page.locator('.cm-ranch-three-canvas').count(),1,'One actual Three canvas per mode');
   assert.ok(Number.isFinite(data.projectionError)&&data.projectionError<=.5);assert.ok(data.diagnostics.frames>0&&!data.diagnostics.lost);assert.deepEqual(errors,[]);
   const rect=await page.locator('.cm-ranch-three-canvas').evaluate(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}));assert.deepEqual(rect,{width:390,height:844});
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
   const redrawStates=await page.evaluate(async()=>{const before=globalThis.ranchAudit.maskState();await globalThis.ranchAudit.redrawNormal();return {before,after:globalThis.ranchAudit.maskState()};});const preprobeRedraw=await page.screenshot();
   if(sha(preprobeRedraw)!==sha(actual)){await fs.writeFile(out+'/'+prefix+'-preprobe-redraw.png',preprobeRedraw);await fs.writeFile(out+'/'+prefix+'-failure.json',JSON.stringify({stage:'BEFORE_PROBE_ZERO_DELTA_REDRAW',redrawStates,data,actualSha256:sha(actual),redrawSha256:sha(preprobeRedraw),errors},null,2));}
   assert.equal(sha(preprobeRedraw),sha(actual),'Normal zero-delta redraw must be reproducible before diagnostic');
   const controls=await page.evaluate(()=>globalThis.ranchAudit.validateTerrainMaskControls('actor'));assert.equal(controls.status,'GPU_KNOWN_CONTROL_ASSERTIONS_PASSED');
   const mask=await page.evaluate(()=>globalThis.ranchAudit.captureTerrainMask('actor',true));assert.equal(mask.width,390);assert.equal(mask.height,844);assert.ok(mask.referencePixels>0);assert.ok(mask.visiblePixels<=mask.referencePixels);assert.deepEqual(errors,[]);
   for(const kind of ['reference','visible']){await fs.writeFile(out+'/'+prefix+'-'+kind+'-mask.png',Buffer.from(mask[kind+'Png'].split(',')[1],'base64'));delete mask[kind+'Png'];}
   const restored=await page.screenshot();if(sha(restored)!==sha(actual)){await fs.writeFile(out+'/'+prefix+'-restored-mismatch.png',restored);await fs.writeFile(out+'/'+prefix+'-failure.json',JSON.stringify({stage:'POST_PROBE_RESTORATION',data,controls,mask,actualSha256:sha(actual),restoredSha256:sha(restored),errors},null,2));}assert.equal(sha(restored),sha(actual),'Diagnostic must restore identical normal image at same scene clock');
   const stateHashes=Object.fromEntries(Object.entries({...controls.debugStates,...mask.debugStates}).map(([k,v])=>[k,sha(JSON.stringify(v))]));delete controls.debugStates;delete mask.debugStates;
   results.push({id:test.id,mode,engine,settling,stateHashes,sceneSha256:sha(mode==='baseline'?baseline:candidate),injectedSourceSha256:sha(injected),data,controls,mask,images:{actual:prefix+'-actual.png',reference:prefix+'-reference-mask.png',visible:prefix+'-visible-mask.png'},normalImageSha256:sha(actual),restoredImageSha256:sha(restored),status:'TERRAIN_MASK_MEASURED_NOT_EXPECTED_DEPTH_APPROVAL'});
   await fs.writeFile(out+'/terrain-mask-results.json',JSON.stringify({results,releaseApproved:false,expectedCount:32,coverageAuthority:plan.authority,pending:plan.requiredReview},null,2));
  }
  assert.ok(baselineRequests>0,'Injected scene module actually served for '+mode);
 }finally{await context.close();}
}}finally{await browser.close();await fs.writeFile(out+'/terrain-mask-results.json',JSON.stringify({results,releaseApproved:false,expectedCount:32,coverageAuthority:plan.authority,pending:plan.requiredReview},null,2));}
assert.equal(results.length,32);
