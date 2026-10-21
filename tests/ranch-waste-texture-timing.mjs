import {watchNormalRequests} from './normal-lifecycle/request-audit.mjs';
import {createHash} from 'node:crypto';import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {chromium,webkit} from 'playwright';
const [base,out,candidateDir,probeFile,admittedFile,sceneProbeFile]=process.argv.slice(2);assert.ok(base&&out&&candidateDir&&probeFile&&admittedFile);assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const sourcePins={"assets/production/cage/three-20261021/physical-ground-tops.r1.json": "ea99645776fb657de4d91baf9853583af51f677fad39c3fda73ba5b37fb065d5", "src/championship/app/championshipStandaloneApp.js": "4dd6ca1d708c78e779c0cb7e4041c87a647550f4dc3373d7996e4e75cbd01713", "src/championship/app/raisingGroundSupport.js": "ffd6a4e62213b1ee7b967fbf341d89f7a8f3e4c6da6a8ab76fd5bf73aff520c9", "src/championship/app/raisingPresentationSource.js": "9f5c0d23af6360e21682c0683c8424743907eb6fc384bdd0a7c8e56ad547d8a3", "src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js": "38f81afdeee79d0d6205c5769225b90ae4f1bcd3b074cee22d13561606f310f9", "src/championship/presentation/ranchPhysicalSupport.js": "fb42d410ba895a578507bf985a6f7dd471e274a5238d19b1ae070d536b2b4979", "src/championship/presentation/ranchSupportOwner.js": "10ee4a275e2e696366630e5476ac94e78984d6d0080685b93246910bd859cd81", "src/championship/presentation/ranchThreeScene.js": "253b395eeae17428d1868aa3886b4723ebad34ad646ee250b4047aae50181549"};
const presenterPath='src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js';
const files={};for(const [path,hash] of Object.entries(sourcePins)){files[path]=await fs.readFile(candidateDir+'/'+path);assert.equal(sha(files[path]),hash,'Exact reviewed candidate '+path);}
const sceneProbe=await fs.readFile(sceneProbeFile);assert.equal(sha(sceneProbe),'311bb32e46116fe076403eb3673bca8e878f05d700701705b19e02521ea75355');
const probe=await fs.readFile(probeFile),admitted=await fs.readFile(admittedFile);assert.equal(sha(probe),'f0997d5f632456753f490b7daee5162089f9a8a290ace7bf8ae8b65c607cfa26');assert.equal(sha(admitted),'da74c6c56859281a60898e6d07dbf2a53c47e95bb8064d0f09491f226c2b7018');
assert.equal(sha(await fs.readFile(new URL('./normal-lifecycle/request-audit.mjs',import.meta.url))),'b2255fb0255def1cf31770fd5dc442239d34462a260a34d2d28400ae2d29a0ad');
const fixturePath='tests/fixtures/ranch-normal-support-v2.html',fixtureSha256=sha(await fs.readFile(fixturePath)),runnerSha256=sha(await fs.readFile(new URL(import.meta.url)));
const engine=process.env.BROWSER_ENGINE??'chromium';assert.ok(['chromium','webkit'].includes(engine));const browser=await ({chromium,webkit}[engine]).launch({headless:true}),results=[];
const fields=['field_cm02_01'];
const ready=()=>{const h=document.querySelector('.int-rh2-field-host'),a=JSON.parse(h?.dataset.residentAssets||'[]'),p=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];return h?.dataset.loadState==='ready'&&h.getAttribute('aria-busy')==='false'&&a.length>0&&a.every(x=>x.state==='ready'&&!x.error)&&p.length>0&&p.every(x=>x.hidden);};
try{for(const observerEnabled of [false,true])for(const attemptWaste of [true])for(const fieldId of fields){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}),page=await context.newPage(),errors=[],requests={};const audit=await watchNormalRequests(page,base,engine);let preparation=null,postReadyPlacement=null;
 page.on('console',m=>{if(m.type()==='error'||/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))errors.push('console:'+m.text());});page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url());});
 try{
  for(const [path,body] of Object.entries(files))await page.route('**/'+path,async route=>{requests[path]=(requests[path]??0)+1;await route.fulfill({status:200,contentType:path.endsWith('.json')?'application/json':'text/javascript',body:path===presenterPath?probe:path==='src/championship/presentation/ranchThreeScene.js'?sceneProbe:body});});
  await page.route('**/tests/ranch-floor-data/admitted-probes-v2.json',r=>r.fulfill({status:200,contentType:'application/json',body:admitted}));
  await page.addInitScript(enabled=>{globalThis.__ranchWasteBindingObserver=enabled;},observerEnabled);
  await page.addInitScript(()=>{let state=0x137ab;Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};});
  await page.goto(new URL(fixturePath,base).href);await page.waitForFunction(()=>!!globalThis.prepareNormalSupport);preparation=await page.evaluate(a=>globalThis.prepareNormalSupport(a),{fieldId,attemptWaste});
  if(attemptWaste&&preparation.waste.length===0){assert.deepEqual(errors,[]);results.push({fieldId,attemptWaste,status:'WASTE_NOT_OBSERVED_BOUNDED_REAL_CLOCK',preparation,requests,requestAuditEvidence:await audit.assertClean()});continue;}
  audit.setPhase('login');await page.goto(new URL('championship.html?presentation=developer',base).href);await page.locator('#cm-login').waitFor();if(await page.locator('#cm-film-skip').isVisible()){await page.locator('#cm-film-skip').click();await page.locator('#cm-opening-film').waitFor({state:'hidden'});}
  await page.waitForFunction(()=>document.querySelector('#cm-login')?.disabled===false);audit.setPhase('leaving-login');await page.locator('#cm-login').click();await page.locator('#cm-continue').click();await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();audit.setPhase('raising-loading');await page.waitForFunction(ready,null,{timeout:180000});
  const initial=await page.evaluate(()=>globalThis.__ranchContactAudit?.snapshot());assert.ok(initial?.serial>0);await page.waitForFunction(s=>{const a=globalThis.__ranchContactAudit?.snapshot();return a?.serial>s.serial+2&&a.three?.frames>s.three.frames+2&&a.positions.some(p=>p.nativeFrame>s.positions[0].nativeFrame);},initial,{timeout:30000});await audit.assertClean();audit.setPhase('capture');
  if(!attemptWaste){
   postReadyPlacement=await page.evaluate(({residentId,point,instanceId,triangle,origin})=>{
    const actions=globalThis.__ranchContactAudit?.sourceActions;if(!actions)throw Error('REVIEWED_ACTUAL_SOURCE_ACTIONS_REQUIRED');
    const inside=(p,t)=>{const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const signs=t.map((a,i)=>cross(a,t[(i+1)%3],p));return Math.min(...signs)>=-1e-8||Math.max(...signs)<=1e-8;};
    const choices=[[24,0],[-24,0],[0,24],[0,-24],[16,0],[-16,0],[0,16],[0,-16],[8,0],[-8,0],[0,8],[0,-8]].map(([dx,dy])=>({x:point.x+dx,y:point.y+dy}));
    const actorPoint=choices.find(p=>inside([p.x-origin[0],p.y-origin[1]],triangle)&&actions.getGroundSupport(p.x,p.y)?.instanceId===instanceId);if(!actorPoint)throw Error('NO_ACTUAL_ADMITTED_NEARBY_TRIANGLE_POINT');
    const before=actions.getActorFrame(residentId),relocated=actions.relocateToGround(residentId,actorPoint),after=actions.getActorFrame(residentId);
    if(!relocated||after?.positionQ12?.[0]!==actorPoint.x*4096||after.positionQ12[1]!==actorPoint.y*4096||after.cageInstanceId!==instanceId)throw Error('POSTREADY_ACTUAL_MOVE_READBACK_FAILED');
    return {before,actorPoint,planningOnlyTriangle:triangle,relocated,after,relocateSerial:globalThis.__ranchContactAudit.snapshot().serial,placementAttempts:[]};
   },{residentId:preparation.residentId,point:preparation.point,instanceId:preparation.placement.instanceId,triangle:preparation.planningTriangleNative,origin:preparation.admission.originNative});
   await page.waitForFunction(({serial,id})=>{const s=globalThis.__ranchContactAudit?.snapshot();return s?.serial>serial&&s.positions.some(p=>p.creatureId===id);},{serial:postReadyPlacement.relocateSerial,id:preparation.residentId},{timeout:15000});
   // Use the actual public ground-drag camera control; never assign view/camera state.
   const panPlan=await page.evaluate(({point,residentId})=>{
    const s=globalThis.__ranchContactAudit.snapshot(),p=s.positions.find(p=>p.creatureId===residentId),v=s.viewport,canvases=document.querySelectorAll('canvas.cm-raising-pixi-canvas');if(canvases.length!==1)throw Error('EXACT_PIXI_CANVAS_REQUIRED_FOR_PAN');const canvas=canvases[0],r=canvas.getBoundingClientRect();
    for(const k of ['left','top','width','height'])if(Math.abs(r[k]-v.canvasRect[k])>1e-6)throw Error('PAN_VIEWPORT_CHANGED');
    const css={x:r.left+(p.groundScreen.x+(point.x-p.nativePositionQ12[0]/4096)*p.nativeScreenPixels)*r.width/v.appScreen.width,y:r.top+(p.groundScreen.y+(point.y-p.nativePositionQ12[1]/4096)*p.nativeScreenPixels)*r.height/v.appScreen.height};
    if(css.x>=60&&css.x<=innerWidth-60)return {needed:false,css,serial:s.serial};
    const dx=innerWidth/2-css.x;if(Math.abs(dx)>260)throw Error('BOUNDED_PUBLIC_PAN_DISTANCE_EXCEEDED');
    const startX=dx>0?55:innerWidth-55,endX=startX+dx;
    for(const y of [600,550,500,650]){
     if(startX<=r.left||endX<=r.left||startX>=r.right||endX>=r.right||y<=r.top||y>=r.bottom||y>=innerHeight-100)continue;
     const hitsActor=(s.three?.spriteDiagnostics??[]).some(t=>{const q=t.screenQuad;if(!q)return false;const b={x:r.left+q.x*r.width/v.appScreen.width,y:r.top+q.y*r.height/v.appScreen.height,w:q.width*r.width/v.appScreen.width,h:q.height*r.height/v.appScreen.height};return y>=b.y-20&&y<=b.y+b.h+20&&Math.max(startX,endX)>=b.x-20&&Math.min(startX,endX)<=b.x+b.w+20;});if(hitsActor)continue;
     if(Array.from({length:17},(_,i)=>document.elementFromPoint(startX+dx*i/16,y)).some(el=>el!==canvas))continue;
     return {needed:true,css,serial:s.serial,viewport:v,start:{x:startX,y},end:{x:endX,y},expectedCssDelta:dx};
    }throw Error('NO_UNOBSTRUCTED_PUBLIC_GROUND_PAN_PATH');
   },{point:preparation.point,residentId:preparation.residentId});
   postReadyPlacement.cameraPan={plan:panPlan};
   if(panPlan.needed){
    await page.mouse.move(panPlan.start.x,panPlan.start.y);await page.mouse.down();try{await page.mouse.move(panPlan.end.x,panPlan.end.y,{steps:8});}finally{await page.mouse.up();}
    const releaseSerial=await page.evaluate(()=>globalThis.__ranchContactAudit.snapshot().serial);postReadyPlacement.cameraPan.releaseSerial=releaseSerial;await page.waitForFunction(serial=>globalThis.__ranchContactAudit.snapshot().serial>serial,releaseSerial,{timeout:15000});
    const afterPan=await page.evaluate(({point,residentId})=>{const s=globalThis.__ranchContactAudit.snapshot(),p=s.positions.find(p=>p.creatureId===residentId),v=s.viewport;return {serial:s.serial,position:p,css:{x:v.canvasRect.left+(p.groundScreen.x+(point.x-p.nativePositionQ12[0]/4096)*p.nativeScreenPixels)*v.canvasRect.width/v.appScreen.width,y:v.canvasRect.top+(p.groundScreen.y+(point.y-p.nativePositionQ12[1]/4096)*p.nativeScreenPixels)*v.canvasRect.height/v.appScreen.height}};},{point:preparation.point,residentId:preparation.residentId});
    postReadyPlacement.cameraPan.after=afterPan;assert.ok(Math.abs(afterPan.css.x-panPlan.css.x-panPlan.expectedCssDelta)<2,'Actual public camera drag moved intended ground point');assert.ok(afterPan.css.x>=60&&afterPan.css.x<=330,'Exact food probe now planned within viewport');assert.ok(Number.isInteger(afterPan.position.state)&&![6,7].includes(afterPan.position.state),'Post-release sampled state must be known noncarry; not a whole-gesture state trace');
   }
   const placed=await page.evaluate(({point,instanceId,residentId})=>{
    const api=globalThis.__ranchContactAudit,a=api.sourceActions,s=api.snapshot(),p=s.positions.find(p=>p.creatureId===residentId),v=s.viewport;if(!p?.nativePositionQ12||!v?.appScreen||!v.canvasRect)throw Error('ACTUAL_PLACEMENT_CAMERA_REQUIRED');
    const attempts=[];for(const [dx,dy] of [[0,0]]){
     const input={x:point.x+dx,y:point.y+dy,protein:false},admission=a.getGroundSupport(input.x,input.y);if(admission?.instanceId!==instanceId){attempts.push({input,admission,skip:'NO_ACTUAL_ADMISSION'});continue;}
     const local={x:p.groundScreen.x+(input.x-p.nativePositionQ12[0]/4096)*p.nativeScreenPixels,y:p.groundScreen.y+(input.y-p.nativePositionQ12[1]/4096)*p.nativeScreenPixels};
     const css={x:v.canvasRect.left+local.x*v.canvasRect.width/v.appScreen.width,y:v.canvasRect.top+local.y*v.canvasRect.height/v.appScreen.height};
     // Conservative placement planning only; actual rendered quad gates remain mandatory.
     if(css.x<60||css.x>innerWidth-60||css.y<90||css.y>innerHeight-60){attempts.push({input,admission,css,skip:'PLANNED_FOOD_OUTSIDE_VIEW'});continue;}
     const result=a.placeFood(input);attempts.push({input,admission,css,result});if(result?.ok)return {attempts,result,foodKey:'food:'+result.slot,foods:a.getFoodFrame(),placementSerial:api.snapshot().serial};
    }throw Error('NO_REAL_POSTREADY_FOOD_PLACEMENT:'+JSON.stringify(attempts));
   },{point:preparation.point,instanceId:preparation.placement.instanceId,residentId:preparation.residentId});
   postReadyPlacement={...postReadyPlacement,...placed};
  }

  let previousPose=null,previousSerial=null,wasteKey=null;
  for(let captureOrdinal=0;captureOrdinal<3;captureOrdinal++){
  await page.waitForFunction(({instanceId,residentId,fieldId,attemptWaste,requiredFoodKey,afterSerial,desiredPose,requiredWasteKey,previousSerial})=>{
   const h=document.querySelector('.int-rh2-field-host'),a=JSON.parse(h?.dataset.residentAssets||'[]'),panels=[...document.querySelectorAll('.int-rh2-resident-assets[data-load-owner="raising"]')];if(h?.dataset.loadState!=='ready'||h.getAttribute('aria-busy')!=='false'||!a.length||a.some(x=>x.state!=='ready'||x.error)||!panels.length||panels.some(x=>!x.hidden))return false;
   const snap=globalThis.__ranchContactAudit?.snapshot(),targets=snap?.supportTargets??[],three=snap?.three?.spriteDiagnostics??[],viewport=snap?.viewport;
   const pc=document.querySelectorAll('canvas.cm-raising-pixi-canvas'),tc=document.querySelectorAll('canvas.cm-ranch-three-canvas');if(pc.length!==1||tc.length!==1||!viewport?.appScreen||!viewport.canvasRect||!(viewport.rendererResolution>0))return false;
   const logical=viewport.appScreen,rect=pc[0].getBoundingClientRect(),threeRect=tc[0].getBoundingClientRect();if(!(logical.width>0&&logical.height>0&&rect.width>0&&rect.height>0))return false;
   for(const k of ['left','top','width','height'])if(Math.abs(rect[k]-viewport.canvasRect[k])>1e-6||Math.abs(rect[k]-threeRect[k])>1e-6)return false;
   if(devicePixelRatio!==1||Math.abs(pc[0].width-logical.width*viewport.rendererResolution)>1||Math.abs(pc[0].height-logical.height*viewport.rendererResolution)>1||Math.abs(tc[0].width-logical.width)>1||Math.abs(tc[0].height-logical.height)>1)return false;
   if(afterSerial!=null&&snap.serial<=afterSerial)return false;
   if(previousSerial!==null&&snap.serial<=previousSerial)return false;
   const mapped=[];
   const qualify=t=>{const v=three.find(x=>x.key===t.key),q=v?.screenQuad;if(!q||!(q.width>0&&q.height>0))return false;
    const css={x:rect.left+q.x*rect.width/logical.width,y:rect.top+q.y*rect.height/logical.height,width:q.width*rect.width/logical.width,height:q.height*rect.height/logical.height};
    const inside=css.x>=rect.left&&css.y>=rect.top&&css.x+css.width<=rect.right&&css.y+css.height<=rect.bottom&&css.x>=0&&css.y>=0&&css.x+css.width<=innerWidth&&css.y+css.height<=innerHeight;
    if(inside)mapped.push({key:t.key,canvasLocalQuad:q,viewportCssQuad:css});
    return inside&&t.visible&&t.admission?.instanceId===instanceId&&t.owner?.fieldId===fieldId&&t.sprite?.textureFrame?.width>0&&t.sprite.textureFrame.height>0&&v?.physicalSupport?.status==='VERIFIED_OWNER_PROJECTED_TOPS'&&Number.isInteger(v.physicalSupport.candidateCount)&&v.physicalSupport.candidateCount>=0&&v.physicalSupport.rawCount>0&&(attemptWaste||v.physicalSupport.candidateCount>0)&&v.physicalSupport.owner?.ownerIndex===t.owner.ownerIndex;};
   const actor=targets.find(t=>t.kind==='actor'&&t.key===residentId),foods=targets.filter(t=>t.kind==='food'),waste=targets.filter(t=>t.kind==='waste');
   if(!actor||!qualify(actor)||(!attemptWaste&&(!foods.some(t=>t.key===requiredFoodKey&&qualify(t))))||(attemptWaste&&!waste.some(qualify)))return false;
   const selectedWaste=waste.find(t=>(requiredWasteKey===null||t.key===requiredWasteKey)&&qualify(t));if(!selectedWaste||![0,1].includes(selectedWaste.careIdentity?.pose)||(desiredPose!==null&&selectedWaste.careIdentity.pose!==desiredPose))return false;globalThis.__normalTimingWasteKey=selectedWaste.key;
   const pos=snap.positions.find(p=>p.creatureId===residentId),d=pos?.testOnlyContactDiagnostic;if(!d?.frame||d.frame.cell==null||d.frame.sequenceId==null||!d.entityId||d.nativeLift!==0)return false;
   globalThis.__normalSupportScreenProof={viewport,threeCanvas:{width:tc[0].width,height:tc[0].height,rect:{left:threeRect.left,top:threeRect.top,width:threeRect.width,height:threeRect.height}},mapped};globalThis.__normalSupportPaused=globalThis.__ranchContactAudit.pause();return true;
  },{instanceId:preparation.placement.instanceId,residentId:preparation.residentId,fieldId,attemptWaste,requiredFoodKey:postReadyPlacement?.foodKey??null,afterSerial:postReadyPlacement?.placementSerial??null,desiredPose:previousPose===null?null:1-previousPose,requiredWasteKey:wasteKey,previousSerial},{timeout:60000});
  const selectedWasteKey=await page.evaluate(()=>globalThis.__normalTimingWasteKey);if(wasteKey!==null)assert.equal(selectedWasteKey,wasteKey);wasteKey=selectedWasteKey;
  const evidence=await page.evaluate(()=>globalThis.__normalSupportPaused),screenProof=await page.evaluate(()=>globalThis.__normalSupportScreenProof);assert.ok(evidence.serial>0);const targets=evidence.supportTargets.filter(t=>t.admission?.instanceId===preparation.placement.instanceId),position=evidence.positions.find(p=>p.creatureId===preparation.residentId);
  assert.equal(position.nativeScreenPixels,3);assert.equal(position.testOnlyContactDiagnostic.root.scaleX,3);assert.equal(position.testOnlyContactDiagnostic.root.scaleY,3);
  for(const target of targets){assert.equal(target.admission.kind,'CURRENT_GROUND_XY_ADMISSION_V1');assert.equal(target.admission.moduleId,preparation.placement.moduleId);assert.equal(target.admission.slotIndex,preparation.placement.slotIndex);assert.equal(target.admission.definitionIndex,preparation.definitionIndex);assert.ok(target.admission.navigationComponent>=0);assert.equal(target.owner.fieldId,fieldId);assert.equal(target.owner.groundComponent,'NOMINAL_GROUND');const draw=evidence.three.spriteDiagnostics.find(d=>d.key===target.key);assert.deepEqual(draw.physicalSupport.owner,target.owner);assert.equal(draw.depthTest,true);}
  for(const path of Object.keys(files))assert.ok(requests[path]>0,'Actual routed source consumed '+path);
  const captureId=fieldId+'-'+(observerEnabled?'observer-on':'observer-off')+'-'+captureOrdinal;
  const immediatePng=await page.screenshot({path:out+'/'+captureId+'-immediate.png'});
  assert.deepEqual(await page.evaluate(()=>globalThis.__ranchContactAudit.snapshot()),evidence,'Immediate PNG frozen state');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const settledPng=await page.screenshot({path:out+'/'+captureId+'-two-raf-no-readback.png'});
  assert.deepEqual(await page.evaluate(()=>globalThis.__ranchContactAudit.snapshot()),evidence,'Two RAF no simulation');assert.equal(await page.evaluate(ready),true);
  const timingControl={immediate:{file:captureId+'-immediate.png',sha256:sha(immediatePng)},twoRafNoReadback:{file:captureId+'-two-raf-no-readback.png',sha256:sha(settledPng)},identicalImmediateVsTwoRaf:sha(immediatePng)===sha(settledPng),ordering:'PAUSE_METADATA_IMMEDIATE_PNG_TWO_RAF_PNG_THEN_DECODE_AND_TEXTURE_READBACK'};
  const expectedWasteSources=await page.evaluate(async()=>{
   const rows=[];for(const [pose,expected] of [[0,'9c952e3cbfdb72466e8cdab70285a2263c6232d0267cffb6c4c19f244c373fa9'],[1,'45d2db04d58d67b5391c061ae370243cf1e1d8b603090cd2065c50147fc9920e']]){
    const path='assets/production/original-ui-intake-20261007/items/care19/waste-'+pose+'.png',response=await fetch(new URL(path,location.href));if(!response.ok)throw Error('EXPECTED_WASTE_SOURCE_HTTP');const bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('EXPECTED_WASTE_SOURCE_HASH');
    const image=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);rows.push({pose,path,sha256:hash,width:image.width,height:image.height,decodedPng:canvas.toDataURL('image/png')});image.close();
   }return rows;
  });
  const textureIdentity=await page.evaluate(()=>globalThis.__ranchWasteTextureAudit());
  textureIdentity.expectedWasteSources=expectedWasteSources;

  assert.ok(textureIdentity.targets.some(t=>t.key.startsWith('waste:')),'Actual waste identity required');
  for(const t of textureIdentity.targets.filter(t=>t.key.startsWith('waste:')&&t.visible&&observerEnabled)){assert.ok(t.drawBinding,'Actual waste draw binding required');assert.equal(t.drawBinding.frame+1,textureIdentity.frames,'Same rendered frame binding required');assert.equal(t.drawBinding.activeTextureRestored,true,'Texture selector restored');}
  if(!observerEnabled)for(const t of textureIdentity.targets)assert.equal(t.drawBinding,null,'OFF mode must have no GL observer samples');
  for(const t of textureIdentity.targets){assert.ok(t.pixi.cropPng.startsWith('data:image/png;base64,'));assert.ok(t.three.imageCropPng.startsWith('data:image/png;base64,'));}
  assert.equal(await page.evaluate(ready),true);assert.deepEqual(errors,[]);const screenshot=captureId+'-after-decode-readback.png',png=await page.screenshot({path:out+'/'+screenshot});assert.equal(png.readUInt32BE(16),390);assert.equal(png.readUInt32BE(20),844);assert.deepEqual(await page.evaluate(()=>globalThis.__ranchContactAudit.snapshot()),evidence);assert.equal(await page.evaluate(ready),true);assert.deepEqual(errors,[]);
  const afterTextureIdentity=await page.evaluate(()=>globalThis.__ranchWasteTextureAudit());assert.deepEqual(afterTextureIdentity,{frames:textureIdentity.frames,targets:textureIdentity.targets},'Same paused texture identity after PNG');
  for(const t of textureIdentity.targets)if(t.key.startsWith('waste:'))t.sourceMatchesExpectedPose=expectedWasteSources.filter(x=>x.decodedPng===t.pixi.cropPng).map(x=>x.pose);
  for(const x of expectedWasteSources){const bytes=Buffer.from(x.decodedPng.split(',')[1],'base64'),file=captureId+'-expected-waste-'+x.pose+'.png';await fs.writeFile(out+'/'+file,bytes);x.decodedPng={file,sha256:sha(bytes)};}
  for(const t of textureIdentity.targets)for(const [lane,value] of [['pixi',t.pixi],['three',t.three]]){const key=lane==='pixi'?'cropPng':'imageCropPng',bytes=Buffer.from(value[key].split(',')[1],'base64'),file=captureId+'-'+t.key.replace(':','-')+'-'+lane+'-source-crop.png';await fs.writeFile(out+'/'+file,bytes);value[key]={file,sha256:sha(bytes)};}
  results.push({observerEnabled,captureOrdinal,wasteKey,timingControl:{...timingControl,afterDecodeSha256:sha(png),identicalTwoRafVsDecoded:sha(settledPng)===sha(png)},textureIdentity,fieldId,attemptWaste,status:'ACTUAL_NORMAL_SUPPORT_CAPTURED_VISUAL_PENDING',preparation,requests,evidence,screenProof,postReadyPlacement,supportIntersections:evidence.three.spriteDiagnostics.map(d=>({key:d.key,owner:d.physicalSupport?.owner,candidateCount:d.physicalSupport?.candidateCount,classification:d.physicalSupport?.status==='VERIFIED_OWNER_PROJECTED_TOPS'?(d.physicalSupport.candidateCount>0?'OWNER_VERIFIED_PROJECTED_SUPPORT_CANDIDATES_PRESENT':'OWNER_VERIFIED_NO_PROJECTED_SUPPORT_CANDIDATES_AT_ACTUAL_LOCATION'):d.physicalSupport?.status})),screenshot,requestAuditEvidence:await audit.assertClean(),manualHints:false,actualPointDriftFromPostReadyMove:postReadyPlacement?[position.nativePositionQ12[0]/4096-postReadyPlacement.actorPoint.x,position.nativePositionQ12[1]/4096-postReadyPlacement.actorPoint.y]:null,actualPointDeltaFromOriginalProbeNative:[position.nativePositionQ12[0]/4096-preparation.point.x,position.nativePositionQ12[1]/4096-preparation.point.y]});
  previousPose=evidence.supportTargets.find(t=>t.kind==='waste'&&t.key===wasteKey).careIdentity.pose;previousSerial=evidence.serial;
  if(captureOrdinal<2)await page.evaluate(()=>globalThis.__ranchContactAudit.resume());
  }
 }catch(error){results.push({observerEnabled,fieldId,attemptWaste,status:'FAIL',error:String(error),errors,preparation,postReadyPlacement,requests,failureEvidence:await page.evaluate(()=>({snapshot:globalThis.__ranchContactAudit?.snapshot(),textureIdentity:globalThis.__ranchWasteTextureAudit?.(),preparationLedger:globalThis.__normalSupportPreparationLedger})).catch(()=>null),requestAuditEvidence:error.auditEvidence??await audit.snapshot().catch(e=>({error:String(e)}))});await page.screenshot({path:out+'/'+fieldId+'-'+observerEnabled+'-failure.png'}).catch(()=>{});}
 finally{await page.evaluate(()=>globalThis.__ranchContactAudit?.resume()).catch(()=>{});await context.close();await fs.writeFile(out+'/normal-support-results.json',JSON.stringify({engine,runnerSha256,fixtureSha256,sourcePins,probeSha256:sha(probe),sceneProbeSha256:sha(sceneProbe),admittedSha256:sha(admitted),releaseApproved:false,results,coverage:{requiredOrdinaryFoodPerPrimaryCapture:1,expectedActorFoodCases:0,capturedActorFoodCases:results.filter(r=>!r.attemptWaste&&r.status==='ACTUAL_NORMAL_SUPPORT_CAPTURED_VISUAL_PENDING').length,expectedNaturalWasteAttempts:2,expectedPoseCaptures:6,capturedNaturalWasteCases:results.filter(r=>r.attemptWaste&&r.status==='ACTUAL_NORMAL_SUPPORT_CAPTURED_VISUAL_PENDING').length,naturalWasteAbsent:results.filter(r=>r.status==='WASTE_NOT_OBSERVED_BOUNDED_REAL_CLOCK').length},scope:'REAL_APP_QUERY_OWNER_JOIN_NO_MANUAL_TOKENS',uncovered:['mobile','lowzoom','sameframe baseline pairs','waste if naturally absent','C1 edge-depth visual approval']},null,2));}
 }
 assert.equal(results.filter(r=>r.attemptWaste&&r.status==='ACTUAL_NORMAL_SUPPORT_CAPTURED_VISUAL_PENDING').length,6,'Both modes each initial plus two pose transitions required');assert.equal(results.length,6);for(const enabled of [false,true]){const rows=results.filter(r=>r.observerEnabled===enabled);assert.deepEqual(rows.map(r=>r.captureOrdinal),[0,1,2]);assert.ok(rows.every(r=>r.wasteKey===rows[0].wasteKey));assert.ok(rows[1].evidence.serial>rows[0].evidence.serial&&rows[2].evidence.serial>rows[1].evidence.serial);const poses=rows.map(r=>r.evidence.supportTargets.find(t=>t.kind==='waste'&&t.key===r.wasteKey).careIdentity.pose);assert.equal(poses[1],1-poses[0]);assert.equal(poses[2],poses[0]);};assert.ok(!results.some(r=>r.status==='FAIL'),'All failures preserved and fatal; absent natural waste is explicit incomplete coverage');
}finally{await browser.close();}
