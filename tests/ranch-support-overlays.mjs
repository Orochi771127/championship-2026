// Priority A1: actual low-overlay terrain diagnostics; no guessed support override.
import {chromium,webkit} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const [base,engine,out,baselineFile,planFile,matrixFile,rosterFile]=process.argv.slice(2);assert.ok(base&&out&&baselineFile&&planFile&&matrixFile&&rosterFile);assert.ok(['chromium','webkit'].includes(engine));assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const sha=s=>createHash('sha256').update(s).digest('hex'),sourcePath='src/championship/presentation/ranchThreeScene.js',baselineRevision='4f64421314f0d0f5d0c04b916d30e821587c1a6a';
const plan=JSON.parse(await fs.readFile(planFile)),matrix=JSON.parse(await fs.readFile(matrixFile)),roster=JSON.parse(await fs.readFile(rosterFile));
assert.equal(sha(await fs.readFile(planFile)),'314f2fa3d6b86b36e72ddbc28b28bf9d12b0b91c82859afbcf3f3aba37fba9d6','Frozen exact 24-probe plan');assert.equal(plan.probes.length,24);assert.equal(plan.probes.filter(p=>p.kind==='interior').length,6);assert.equal(plan.baselineRevision,baselineRevision);assert.ok(Array.isArray(plan.probes)&&plan.probes.length);assert.equal(new Set(plan.probes.map(p=>p.id)).size,plan.probes.length);
const required=['field_cm02_01','field_cm09_01','field_cm19_01','field_cm21_01','field_cm35_01','field_cm39_01'];assert.deepEqual([...new Set(plan.probes.map(p=>p.fieldId))].sort(),required);
assert.deepEqual(plan.probes.filter(p=>p.kind==='interior').map(p=>p.fieldId).sort(),required);
const inventory=JSON.parse(await fs.readFile('assets/production/cage/three-20261021/manifest.json'));for(const fieldId of required){const spec=inventory.fields.find(f=>f.fieldId===fieldId),pin=plan.models.find(f=>f.fieldId===fieldId);assert.ok(spec&&pin);assert.equal(spec.sha256,pin.sha256);assert.equal(sha(await fs.readFile(spec.url)),pin.sha256);}
const character=roster.characters.find(c=>c.entityId==='m106_nyaromon');assert.ok(character);const [sequenceId,frameIndex,texture]=character.idle;
const baseline=await fs.readFile(baselineFile,'utf8'),candidate=await fs.readFile(sourcePath,'utf8');assert.equal(sha(baseline),sha(execFileSync('git',['show',baselineRevision+':'+sourcePath])));assert.equal(sha(candidate),'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb');
const phase=process.env.SUPPORT_PHASE??'interior';assert.ok(['interior','all'].includes(phase));const probes=plan.probes.filter(p=>phase==='all'||p.kind==='interior');assert.deepEqual([...new Set(probes.map(p=>p.fieldId))].sort(),required);
const cases=probes.flatMap(probe=>['actor','food','waste'].flatMap(subjectKind=>[1,.7].map(zoom=>({id:`${probe.id}-${subjectKind}-z${zoom}`,fieldId:probe.fieldId,character,sequenceId,frameIndex,texture,nativeZ:0,zoom,viewport:{width:390,height:844},subjectKind,probe}))));
await fs.mkdir(out,{recursive:true});const probesByMode={};for(const mode of ['baseline','floor-only']){const file=out+'/'+mode+'-mask-probe.js';execFileSync(process.execPath,['tests/ranch-mask-probe/inject-actor-mask.mjs','--input',mode==='baseline'?baselineFile:sourcePath,'--output',file,'--expected-sha',sha(mode==='baseline'?baseline:candidate)]);probesByMode[mode]=await fs.readFile(file,'utf8');}
const browser=await ({chromium,webkit}[engine]).launch({headless:true}),results=[];let failure=null;
const save=()=>fs.writeFile(out+'/support-results.json',JSON.stringify({baselineRevision,engine,phase,expectedCount:cases.length*2,plannedIds:cases.map(c=>c.id),results,failure,releaseApproved:false,status:failure?'FAIL':'DIAGNOSTIC_NOT_SUPPORT_APPROVAL',supportSemantics:plan.supportSemantics??'UNVERIFIED'},null,2));
try{for(const mode of ['baseline','floor-only']){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];let routed=0;page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{let s=0x137ab;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};});
 page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push(m.text())});await page.route('**/'+sourcePath,async route=>{routed++;await route.fulfill({status:200,contentType:'text/javascript',body:probesByMode[mode]})});
 try{
  await page.goto(new URL('tests/fixtures/ranch-support-audit.html',base).href);await page.waitForFunction(()=>!!globalThis.ranchAudit);assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight,devicePixelRatio,visualViewport.scale]),[390,844,1,1]);
  const bindings=await page.evaluate(({matrix,required})=>globalThis.ranchAudit.buildBindings(matrix,required),{matrix,required});
  for(const input of cases){const fixture=bindings[input.fieldId];assert.ok(fixture);const test={...input,pointNative:input.probe.pointLocalNative.map((v,k)=>v+fixture.targetOriginNative[k])},prefix=mode+'-'+test.id;
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
   const controls=await page.evaluate(kind=>globalThis.ranchAudit.validateTerrainMaskControls(kind),test.subjectKind);const mask=await page.evaluate(kind=>globalThis.ranchAudit.captureTerrainMask(kind,true),test.subjectKind);assert.deepEqual(errors,[]);
   for(const kind of ['reference','visible']){await fs.writeFile(out+'/'+prefix+'-'+kind+'-mask.png',Buffer.from(mask[kind+'Png'].split(',')[1],'base64'));delete mask[kind+'Png'];}
   const restored=await page.screenshot();if(sha(restored)!==sha(actual)){await fs.writeFile(out+'/'+prefix+'-restored-mismatch.png',restored);await fs.writeFile(out+'/'+prefix+'-failure.json',JSON.stringify({stage:'POSTPROBE_RESTORATION',data,controls,mask},null,2));}assert.equal(sha(restored),sha(actual),'Mask probe must restore normal rendering');
   const stateHashes=Object.fromEntries(Object.entries({...controls.debugStates,...mask.debugStates}).map(([k,v])=>[k,sha(JSON.stringify(v))]));delete controls.debugStates;delete mask.debugStates;
   results.push({id:test.id,mode,settling,stateHashes,fieldId:test.fieldId,subjectKind:test.subjectKind,zoom:test.zoom,probe:test.probe,data,controls,mask,normalImageSha256:sha(actual),restoredImageSha256:sha(restored),images:{actual:prefix+'-actual.png',reference:prefix+'-reference-mask.png',visible:prefix+'-visible-mask.png'},sourceSha256:sha(mode==='baseline'?baseline:candidate)});await save();
  }assert.ok(routed>0);
 }finally{await context.close();}
}}catch(error){failure=String(error);throw error;}finally{await browser.close();await save();}
assert.equal(results.length,cases.length*2);
