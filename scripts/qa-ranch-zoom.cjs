// Isolated loopback QA; route-only read access to the current scene.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:8741';
const out=process.env.CHAMPIONSHIP_QA_OUTPUT;
if(!out)throw Error('CHAMPIONSHIP_QA_OUTPUT required');
fs.mkdirSync(out,{recursive:true});
const report={origin,physicalDevice:false,readOnlyRouteHooks:true,views:[],gestures:[],errors:[]};
const sample=page=>page.evaluate(()=>{
  const q=__qaRanch,v=q.view(),fit=q.fit(),r=q.stage.app.canvas.getBoundingClientRect();
  return {viewport:[innerWidth,innerHeight],host:[r.width,r.height],stage:[v.width,v.height],
    camera:q.camera(),zoom:v.zoom,nativePixels:fit.scale*q.fieldArt.field.nativePixelWorldScale,
    columns:v.width/(96*fit.scale*q.fieldArt.field.nativePixelWorldScale),
    overviewAreaMultiplier:1/v.zoom**2,
    actors:[...q.actors].map(([id,e])=>({id,state:q.source.getActorFrame(id)?.state,
      pos:q.source.getActorFrame(id)?.positionQ12,
      point:[e.root.x,e.root.y],hit:[e.root.hitArea.width*e.root.scale.x,e.root.hitArea.height*e.root.scale.y]})),
    canvasCount:document.querySelectorAll('canvas.cm-raising-pixi-canvas').length,
    overflow:document.documentElement.scrollWidth>innerWidth};
});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Users/User/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const seed=fs.readFileSync(path.join(root,'qa/championship-full-qa-save.json'),'utf8');
  await page.addInitScript(seed=>{if(!localStorage.getItem('championshipModernSave:v1'))localStorage.setItem('championshipModernSave:v1',seed);},seed);
  await page.route('**/src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',async route=>{
   let body=fs.readFileSync(path.join(root,'src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js'),'utf8');
   body=body.replace('function updateAnimations(ticker) {','function updateAnimations(ticker) { globalThis.__qaRanch={stage,source,fieldArt,actors,view:()=>view,input:()=>({tool:getSelectedTool(),drag:drag?{id:drag.creatureId,nativeHand:drag.nativeHand,moved:drag.moved}:null}),camera:()=>[cameraX,cameraY],fit:()=>raisingFieldViewport(fieldArt.field,view,12,cameraX)};');
   await route.fulfill({body,contentType:'text/javascript'});
  });
  await page.goto(origin+'/championship.html');await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.waitForFunction(()=>document.querySelector('.int-rh2-field-host')?.dataset.loadState==='ready'&&window.__qaRanch,{},{timeout:60000});
  await page.waitForTimeout(700);
  const cdp=await context.newCDPSession(page);
  for(const [width,height] of [[390,844],[844,390],[1280,720]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(500);
   const button=page.locator('.cm-ranch-zoom');
   if((await sample(page)).zoom!==1)await button.click();
   await page.waitForTimeout(150);
   report.views.push(await sample(page));
   await page.screenshot({path:path.join(out,`${width}x${height}-detail.png`)});
   const canvas=await page.locator('canvas.cm-raising-pixi-canvas').boundingBox();
   const x=canvas.x+canvas.width*.5,y=canvas.y+canvas.height*.5;
   if(width<1024){
    const touch=(type,dx)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:x-dx,y,id:1},{x:x+dx,y,id:2}]});
    await touch('touchStart',80);await touch('touchMove',76);
    assert.equal((await sample(page)).zoom,1,'tiny pinch ignored');
    await touch('touchMove',50);await touch('touchEnd');await page.waitForTimeout(180);
    assert.equal((await sample(page)).zoom,.7,'two fingers zoom out');
    report.gestures.push({viewport:[width,height],pinch:true,jitterIgnored:true});
   }else{
    await page.mouse.move(x,y);await page.mouse.wheel(0,120);await page.waitForTimeout(200);
    assert.equal((await sample(page)).zoom,.7,'wheel zoom out');
    report.gestures.push({viewport:[width,height],wheel:true});
   }
   const overview=await sample(page);report.views.push(overview);
   assert.equal(overview.canvasCount,1);assert.equal(overview.overflow,false);
   assert.ok(overview.actors.every(e=>e.hit.every(n=>n>=44-1e-5)),'minimum touch target retained');
   await page.screenshot({path:path.join(out,`${width}x${height}-overview.png`)});
   // Pointer coordinates must still select the visible actor at the smaller size.
   const point=await page.evaluate(()=>{
    const q=__qaRanch,r=q.stage.app.canvas.getBoundingClientRect();
    for(const [id,e]of q.actors){
     const h=e.root.hitArea,p=e.root.toGlobal({x:h.x+h.width/2,y:h.y+h.height/2});
     const x=r.x+p.x*r.width/q.view().width,y=r.y+p.y*r.height/q.view().height;
     if(x>50&&x<innerWidth-80&&y>120&&y<innerHeight-140)return {id,x,y};
    }return null;
   });
   if(point){
    if(await page.locator('.cm-toolbar').getAttribute('data-selected-tool')!=='hand')await page.locator('.cm-toolbar [data-tool-id="hand"]').click();
    await page.mouse.click(point.x,point.y);await page.waitForTimeout(150);
    assert.ok(await page.evaluate(()=>__qaRanch.source.getFrame().selection?.creatureId),'small actor selectable');
    report.gestures.at(-1).overviewSelect=true;
   }
  }
  // Carry uses the normal pointer owner and native state; no actor mutation.
  if(await page.locator('.cm-toolbar').getAttribute('data-selected-tool')!=='hand')await page.locator('.cm-toolbar [data-tool-id="hand"]').click();
  await page.mouse.click(160,250);await page.waitForTimeout(200);
  report.carryAttempts=[];
  let carried=null;
  for(let attempt=0;attempt<6&&!carried;attempt++){
   const p=await page.evaluate(()=>{
    const q=__qaRanch,r=q.stage.app.canvas.getBoundingClientRect();
    for(const [id,e] of q.actors){
     const a=q.source.getActorFrame(id);
     if(![1,2,3,5,13,17].includes(a?.state)||a.speciesIndex<8)continue;
     const h=e.root.hitArea,p=e.root.toGlobal({x:h.x+h.width/2,y:h.y+h.height/2});
     const x=r.x+p.x*r.width/q.view().width,y=r.y+p.y*r.height/q.view().height;
     if(x>100&&x<innerWidth-120&&y>130&&y<innerHeight-170
       &&document.elementFromPoint(x,y)===q.stage.app.canvas)return {id,x,y};
    }return null;
   });
   if(!p){await page.waitForTimeout(250);continue;}
   await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(300);
   report.carryAttempts.push({point:p,state:await page.evaluate(()=>({input:__qaRanch.input(),
    actors:[...__qaRanch.actors.keys()].map(id=>({id,state:__qaRanch.source.getActorFrame(id)?.state}))}))});
   const actual=await page.evaluate(()=>[...__qaRanch.actors.keys()].find(id=>__qaRanch.source.getActorFrame(id)?.state===6));
   if(actual){carried={...p,id:actual};break;}
   await page.mouse.up();await page.waitForTimeout(200);
  }
  assert.ok(carried,'normal pointer picks up a partner');
  await page.mouse.move(1274,carried.y,{steps:10});await page.waitForTimeout(100);
  const before=await sample(page),start=Date.now();
  await page.waitForTimeout(750);
  const after=await sample(page),elapsed=Date.now()-start;
  const moved=((after.camera[0]-before.camera[0]+3840)%3840)*after.nativePixels/4;
  const observedPxPerSecond=moved/(elapsed/1000);
  assert.ok(observedPxPerSecond>150&&observedPxPerSecond<235,`carry scroll observed ${observedPxPerSecond}`);
  await page.mouse.move(carried.x,carried.y,{steps:10});await page.waitForTimeout(80);await page.mouse.up();
  await page.waitForTimeout(80);
  assert.notEqual(await page.evaluate(id=>__qaRanch.source.getActorFrame(id)?.state,carried.id),6);
  report.carry={observedPxPerSecond,elapsedMs:elapsed,normalPointerPickupAndRelease:true,
   speedCandidates:[180,207,216,225].map(speed=>({cssPxPerSecond:speed,one288pxHexSeconds:288/speed})),chosenCssPxPerSecond:216};
  assert.deepEqual(report.errors,[]);
  await context.close();
 }finally{
  fs.writeFileSync(path.join(out,'zoom-browser.json'),JSON.stringify(report,null,2));await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
