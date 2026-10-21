// Early actual GPU smoke only: no all-roster/map or continuous-video PASS claim.
import {chromium,webkit} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const [base,engine,out,baselineFile]=process.argv.slice(2);assert.ok(base&&out&&baselineFile);assert.ok(['chromium','webkit'].includes(engine));assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const baselineRevision='4f64421314f0d0f5d0c04b916d30e821587c1a6a',sourcePath='src/championship/presentation/ranchThreeScene.js';
const baseline=await fs.readFile(baselineFile,'utf8'),candidate=await fs.readFile(sourcePath,'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(sha(baseline),sha(execFileSync('git',['show',baselineRevision+':'+sourcePath])),'Exact baseline response source');
assert.equal(sha(candidate),'1ae46df21194a20536fb8319681cce06026c058c94bce5c2b1c0d3d09ea5b9bb','Final minimal floor-only overlay identity');
const plan=JSON.parse(await fs.readFile('tests/ranch-floor-data/coverage-plan.json','utf8'));
const matrix=JSON.parse(await fs.readFile('tests/ranch-floor-data/coverage-37fields-100slots.json','utf8'));
const motion=JSON.parse(await fs.readFile('tests/ranch-floor-data/cm07-motion-plan.json','utf8'));
const cat=plan.characters.find(c=>c.entityId==='m106_nyaromon');assert.ok(cat);
const capturePhone=async(page,file)=>{const bytes=await page.screenshot({path:file});assert.equal(bytes.readUInt32BE(16),390,'PNG physical width at DPR1');assert.equal(bytes.readUInt32BE(20),844,'PNG physical height at DPR1');return bytes;};
await fs.mkdir(out,{recursive:true});const results=[],browser=await ({chromium,webkit}[engine]).launch({headless:true});let failure=null;
try{
 for(const mode of ['baseline','floor-only']){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}),page=await context.newPage();page.setDefaultTimeout(120000);const errors=[],consoleMessages=[];let baselineRequests=0;
  await page.addInitScript(()=>{let state=0x137ab;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};});
  page.on('pageerror',e=>errors.push(String(e)));page.on('requestfailed',r=>errors.push(r.url()+':'+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});
  page.on('console',m=>{if(['warning','error'].includes(m.type()))consoleMessages.push({type:m.type(),text:m.text()});if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push(m.text());});
  if(mode==='baseline')await page.route('**/'+sourcePath,async route=>{baselineRequests++;await route.fulfill({status:200,contentType:'text/javascript',body:baseline});});
  const record={mode,engine,sceneSha256:sha(mode==='baseline'?baseline:candidate),samples:[],motionSamples:[],errors,consoleMessages,status:'RUNNING'};results.push(record);
  try{
   await page.goto(new URL('tests/fixtures/ranch-audit.html',base).href);await page.waitForFunction(()=>!!globalThis.ranchAudit);
   const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visualWidth:visualViewport.width,visualScale:visualViewport.scale,pixiWidth:document.querySelector('canvas').getBoundingClientRect().width,pixiHeight:document.querySelector('canvas').getBoundingClientRect().height}));
   assert.deepEqual(viewport,{width:390,height:844,dpr:1,visualWidth:390,visualScale:1,pixiWidth:390,pixiHeight:844},'Actual phone CSS viewport and Pixi canvas must match');record.viewport=viewport;
   const bindings=await page.evaluate(matrix=>globalThis.ranchAudit.buildBindings(matrix,['field_cm07_01']),matrix),fixture=bindings.field_cm07_01;assert.ok(fixture);
   for(const zoom of [1,.7])for(const [pose,ref] of [['idle',cat.idle],['lower-extent',cat.supportExtreme]]){
    const test={id:mode+'-cat-'+pose+'-'+zoom,fieldId:'field_cm07_01',character:cat,sequenceId:ref[0],frameIndex:ref[1],texture:ref[2],nativeZ:0,zoom,viewport:{width:390,height:844}};
    const data=await page.evaluate(({test,fixture})=>globalThis.ranchAudit.render(test,fixture),{test,fixture});
    await capturePhone(page,path.join(out,test.id+'.png'));
    const threeRect=await page.locator('.cm-ranch-three-canvas').evaluate(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}));assert.deepEqual(threeRect,{width:390,height:844},'Three CSS canvas must match phone viewport');record.samples.push(data);
    assert.ok(Number.isFinite(data.projectionError)&&data.projectionError<=.5,'Actual Three subpixel projection bound');assert.ok(data.diagnostics.frames>0&&!data.diagnostics.lost);assert.deepEqual(errors,[]);
   }
   // Eight consecutive real native-tick samples per mode, not a full orbit gate.
   for(const animated of [false,true]){
    const first=motion.nativeWalkSequence.frames[0],test={id:'pilot-motion',fieldId:'field_cm07_01',character:motion.character,sequenceId:2,frameIndex:0,texture:first.texture,nativeZ:0,zoom:.7,viewport:motion.viewport};
    await page.evaluate(({test,fixture})=>globalThis.ranchAudit.beginMotion(test,fixture),{test,fixture});
    for(const source of motion.clips.find(c=>c.zoom===.7&&c.camera==='fixed'&&c.animated===animated&&c.lift==='ground').samples.slice(0,8)){
     const sample={...source,pointNative:source.pointLocalNative.map((v,k)=>v+fixture.targetOriginNative[k]),cameraCenterNative:source.cameraCenterLocalNative.map((v,k)=>v+fixture.targetOriginNative[k])};
     const data=await page.evaluate(s=>globalThis.ranchAudit.stepMotion(s),sample);record.motionSamples.push(data);assert.ok(Number.isFinite(data.projectionError)&&data.projectionError<=.5,'Actual Three subpixel projection bound');assert.deepEqual(errors,[]);
     if(source.index===0||source.index===7)await capturePhone(page,path.join(out,mode+'-motion-'+(animated?'native':'frozen')+'-'+source.index+'.png'));
    }
   }
   if(mode==='baseline')assert.ok(baselineRequests>0,'Baseline module was actually served');
   record.baselineResponseRequests=baselineRequests;record.status='PILOT_RENDERED_NOT_VISUAL_OR_RELEASE_APPROVAL';
  }catch(error){record.status='FAIL';record.failure=String(error);await page.screenshot({path:path.join(out,mode+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();await fs.writeFile(path.join(out,'pilot-result.json'),JSON.stringify({engine,baselineRevision,results,scope:'BOUNDED_CM07_SHADER_AND_RENDER_SMOKE_ONLY',releaseApproved:false},null,2));}
 }
}catch(error){failure=String(error);throw error;}finally{await browser.close();await fs.writeFile(path.join(out,'pilot-summary.json'),JSON.stringify({engine,failure,sceneCandidateSha256:sha(candidate),baselineRevision,actualStaticSamples:results.reduce((n,r)=>n+r.samples.length,0),actualMotionSamples:results.reduce((n,r)=>n+r.motionSamples.length,0),pending:['full2400framecontinuousnonregression','all226alpha+renders','all37mapcrossings','verifiedsupportheights','actualnormalCM07save+food/waste','humanvisualreview']},null,2));}
