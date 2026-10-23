import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:8765/',out=process.argv[3]||'.tmp/browser-qa/cm07';fs.mkdirSync(out,{recursive:true});
const fixture='tests/fixtures/cm07-review/',candidate=fs.readFileSync(fixture+'field_cm07_01.geometry-r2.glb');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={status:'RUNNING',kind:'ISOLATED_PRODUCTION_RANCH_RENDERER_NOT_NORMAL_GAME_OR_PHYSICAL_MOBILE',head:process.env.CM07_HEAD_SHA,errors:[],rows:[]};
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 report.browser=browser.version();
 for(const version of ['baseline','candidate'])for(const adjacent of [false,true]){
  const context=await browser.newContext({viewport:{width:960,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==new URL(base).origin)return route.abort();
   const rel=url.pathname.slice(1);
   if(version==='candidate'&&rel==='assets/production/cage/three-20261021/manifest.json'){
    const m=JSON.parse(fs.readFileSync(rel));const f=m.fields.find(f=>f.fieldId==='field_cm07_01');f.bytes=candidate.length;f.sha256=hash(candidate);return route.fulfill({json:m});
   }
   if(version==='candidate'&&rel==='assets/production/cage/three-20261021/field_cm07_01.glb')return route.fulfill({body:candidate,contentType:'model/gltf-binary'});
   if(version==='candidate'&&rel==='assets/production/cage/three-20261021/walk-surfaces.json'){
    const m=JSON.parse(fs.readFileSync(rel));Object.assign(m,JSON.parse(fs.readFileSync(fixture+'candidate-walk-surfaces.json')));return route.fulfill({json:m});
   }
   return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(new URL(fixture+'renderer.html',base).href);await page.waitForFunction(()=>window.cm07Review);
  const row={version,adjacent};report.rows.push(row);row.mount=await page.evaluate(adjacent=>cm07Review.mount({adjacent}),adjacent);
  if(adjacent)assert.ok(row.mount.boundaries.some(b=>b.compatible));
  row.device=await page.evaluate(()=>cm07Review.device());row.start=await page.evaluate(()=>cm07Review.tick(1));
  assert.ok(row.start.drawCalls>0);assert.ok(row.start.triangles>0);assert.equal(row.start.lost,false);
  const stem=version+(adjacent?'-adjacent':'-single');
  await page.screenshot({path:path.join(out,stem+'-start.png')});
  row.motion=await page.evaluate(()=>cm07Review.tick(30));await page.screenshot({path:path.join(out,stem+'-motion.png')});
  row.height=await page.evaluate(()=>cm07Review.height(80,90));if(version==='candidate')assert.ok(row.height>.5);
  row.pan=[];for(const [dx,dy]of [[70,0],[-70,0],[0,70],[0,-70],[70,70],[-70,70],[70,-70],[-70,-70]]){
   row.pan.push(await page.evaluate(([x,y])=>cm07Review.pan(x,y),[dx,dy]));await page.screenshot({path:path.join(out,stem+'-pan-'+row.pan.length+'.png')});await page.evaluate(([x,y])=>cm07Review.pan(-x,-y),[dx,dy]);
  }
  await page.evaluate(()=>cm07Review.motion(true));const reducedA=await page.screenshot();await page.evaluate(()=>cm07Review.tick(4));const reducedB=await page.screenshot();row.reducedMotionPixelStable=hash(reducedA)===hash(reducedB);assert.ok(row.reducedMotionPixelStable);
  await page.evaluate(()=>cm07Review.motion(false));await page.evaluate(()=>cm07Review.tick(1,true));const coveredA=await page.screenshot();await page.evaluate(()=>cm07Review.tick(4,true));const coveredB=await page.screenshot();row.coveredPixelStable=hash(coveredA)===hash(coveredB);assert.ok(row.coveredPixelStable);
  row.offscreen=await page.evaluate(()=>cm07Review.pan(10000,10000));assert.equal(row.offscreen.drawCalls,0);
  row.cleanup=await page.evaluate(()=>cm07Review.dispose());assert.equal(row.cleanup.terrainCanvasCount,0);
  row.remount=await page.evaluate(()=>cm07Review.mount({width:390,height:844,quality:'saver'}));await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,stem+'-390-saver-emulation.png')});
  row.saver=await page.evaluate(()=>cm07Review.tick(1));assert.equal(row.saver.textureCap,512);await page.evaluate(()=>cm07Review.dispose());
  console.log(JSON.stringify({version,adjacent,device:row.device,drawCalls:row.start.drawCalls,triangles:row.start.triangles,textureCount:row.start.memory.textures,reducedMotionPixelStable:row.reducedMotionPixelStable,coveredPixelStable:row.coveredPixelStable}));await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS_SCOPED_RENDERER';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}finally{fs.writeFileSync(path.join(out,'RESULTS.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
