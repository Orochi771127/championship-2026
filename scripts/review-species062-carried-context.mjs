// Additive candidate-only fixture. Real scene mounts own all sprite/shadow placement.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='.tmp/browser-qa/species062-carried-context']=process.argv.slice(2);
assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let captures=0;
try{
 for(const sceneName of ['raising'])for(const variant of ['base','candidate']){
  const page=await browser.newPage({viewport:{width:390,height:780},deviceScaleFactor:2});
  const errors=[],network=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>network.push({url:r.url(),status:r.status()}));
  try{
   await page.goto(new URL('tests/fixtures/species062-carried-context/index.html',base).href);
   await page.evaluate(async({base,sceneName,variant})=>{
    // Runtime scoped asset loaders deliberately resolve against location.href.
    // Match the real root entry URL without navigating or modifying production code.
    history.replaceState(null,'',new URL('championship.html?groundingFixture=1',base));
    const imp=p=>import(new URL('src/championship/presentation/'+p,base));
    const PIXI=await import(new URL('node_modules/pixi.js/dist/pixi.mjs',base));
    const {createChampionshipPixiStage}=await imp('championshipPixiStage.js');
    const {loadPixiCharacterRuntimeBundle}=await imp('pixiCharacterRuntimeBundle.js');
    const {createNativeHuntCharacterFramePresenter}=await imp('nativeHuntCharacterAction.js');
    const {createPixiCharacterAnimationController}=await imp('pixiCharacterAnimationController.js');
    const {createNativeCharacterAnimationTimeline,nativeAnimationCellAt}=await imp('characterAnimationTimeline.js');
    const {validateRuntimeMapArtBundle,createRuntimeMapArtTileSetLoader,createRuntimeMapArtFieldLoader}=await imp('runtimeMapArtBundle.js');
    const checked=(x,msg)=>{if(!x)throw Error(msg);};
    async function json(path){const r=await fetch(new URL(path,base));checked(r.ok,'HTTP '+path+' '+r.status);return r.json();}
    const prefix='tests/fixtures/species062-carried-context/',m=await json(prefix+'manifest.json');
    checked(m.captureBudget===14&&m.density===4&&JSON.stringify(m.origin)==='[112,148]','FIXTURE_CONTRACT');
    const stage=await createChampionshipPixiStage({PIXI,canvasHost:document.querySelector('#host'),resolutionCap:2,antialias:true});stage.app.stop();
    const runtimeUrl=new URL(m.baseline.path,base).href;
    const baseline=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl,sides:['main'],cachePrefix:'ground-'+sceneName+'-'+variant+':'});
    const runtime=baseline.runtime,animations=runtime.sides.main.animations;
    checked(runtime.sourceBankSha256===m.baseline.sourceBankSha256,'BASELINE_BANK');
    const seq11=animations.find(a=>a.id===11);checked(seq11.playbackMode===2&&JSON.stringify(seq11.frames.map(f=>[f.cell,f.ticks]))==='[[19,5],[20,6]]','NATIVE_CARRY_TIMING');
    const candidateTextures={},candidateGeometry={frames:{}},alpha=[];
    if(variant!=='base')for(const a of m.assets){
     const url=new URL(prefix+a.staged,base),r=await fetch(url);checked(r.ok,'CANDIDATE_HTTP');const bytes=await r.arrayBuffer();
     const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');checked(hash===a.sha256,'CANDIDATE_HASH');
     const bitmap=await createImageBitmap(new Blob([bytes]));checked(bitmap.width===256&&bitmap.height===256,'CELL_SIZE');
     const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
     const data=ctx.getImageData(0,0,256,256).data;function bounds(threshold){let x0=256,y0=256,x1=0,y1=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(data[(y*256+x)*4+3]>=threshold){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}return[x0,y0,x1,y1];}
     const soft=bounds(1),solid=bounds(128);checked(soft[0]>0&&soft[1]>0&&soft[2]<256&&soft[3]<256,'TRANSLATION_CLIPPING');
     const key='m237_renamon/main/cell_'+String(a.cell).padStart(3,'0'),t=PIXI.Texture.from(canvas);t.source.scaleMode='nearest';candidateTextures[key]=t;
     // The documented half-opacity support controls diagnostic geometry, not a per-pose fit.
     candidateGeometry.frames[key]={blank:false,scale:4,origin:[112,148],sourceSize:[256,256],nativeBounds:solid.map((v,i)=>(v-(i%2===0?112:148))/4)};
     alpha.push({cell:a.cell,soft,solid,nativeBounds:candidateGeometry.frames[key].nativeBounds});
    }
    let createdActor=null;
    const bundle={createActor(options){if(options.speciesId!=='championship:creature:species-062')return null;
     let actor;if(variant==='base')actor=baseline.createActor({side:'main',animation:0,nativeFramePresentation:true,nativeGeometry:runtime.reviewGeometry});
     else{const sprite=new PIXI.Sprite(candidateTextures['m237_renamon/main/cell_000']);const available=animations.filter(a=>[0,11,15].includes(a.id));actor={sprite,controller:createPixiCharacterAnimationController({sprite,animations:available,textureResolver:k=>candidateTextures[k],initialAnimation:0,reducedMotion:false}),nativeFramePresenter:createNativeHuntCharacterFramePresenter({sprite,animations:available,textureResolver:k=>candidateTextures[k],entityId:runtime.entityId,geometry:candidateGeometry})};}
     actor.sprite.texture.source.scaleMode='nearest';createdActor={...actor,entityId:runtime.entityId,nativeSizing:{packedPixelsPerNativePixel:4,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'}};return createdActor;},dispose(){},getDiagnostics(){return{fixture:true,variant};}};
    let native={contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:0,frameIndex:0,flipBits:0,speciesIndex:62,positionQ12:[144*4096,100*4096,0],state:0},revision=0,actorFrames=null;
    const failures=[];let scene,source,fieldArt,frame;
    if(sceneName==='raising'){
     const {createRanchCageArtPlan}=await imp('raisingRanchArtPlan.js');
     const {createCageEditRuntime}=await import(new URL('src/championship/cage/cageEditRuntime.js',base));
     const cage=createCageEditRuntime({initializeOriginal:true,publicTestGrid:true}).getFrame([83,85,112],0);
     const manifest=validateRuntimeMapArtBundle(await json('assets/production/cage/final-intake-20261008/manifest.json'));
     const plan=createRanchCageArtPlan({manifest,placements:cage.placements,layoutVersion:cage.layoutVersion,unlockedCount:cage.unlockedCount,unlockedSlots:cage.unlockedSlots,expansion:cage.expansion});
     fieldArt=await createRuntimeMapArtTileSetLoader({PIXI}).load({manifest,placements:plan.placements,residentViewport:plan.residentViewport,wrapWidthPx:plan.wrapWidthPx,...(plan.fold?{fold:plan.fold}:{}),placementEvidence:plan.placementEvidence,presentationMode:plan.mode,productGrid:plan.productGrid??null});
     const {withCageForeground}=await imp('cageForeground.js');fieldArt=await withCageForeground({PIXI,art:fieldArt,manifest,placements:plan.placements});
     checked(fieldArt.field.presentationMode==='NATIVE_RANCH','REAL_NATIVE_RANCH_REQUIRED');
     frame={revision:0,ranch:cage,tutorial:null,foods:[],lifecycle:null,cages:[],residents:[{creatureId:'qa062',speciesId:'championship:creature:species-062',displayName:'062 grounding candidate',lane:{x:.5,y:.5},facing:'left',selected:false,intent:'idle'}]};
     source={getFrame:()=>frame,getActorFrame:()=>native,subscribe:()=>()=>{},intents:{selectCreature(){},relocateCreature(){}}};
     const {mountRaisingFieldPixiPresentation}=await imp('intRh2/createRaisingFieldPixiPresentation.js');
     scene=await mountRaisingFieldPixiPresentation({stage,source,fieldArt,characterBundle:bundle,onActorFrame:x=>actorFrames=x,onFallback:x=>failures.push(String(x)),reducedMotion:false});
    }
    checked(createdActor,'MISSING_REAL_ACTOR');stage.app.stop();
    const cp=p=>import(new URL('src/championship/'+p,base));
    const {createChannelRng}=await cp('battle/battleRngChannel.js');
    const {nativeHuntSpeciesByIndex}=await cp('hunt/capture/nativeHuntSources.js');
    const {createNativeHuntIndividual}=await cp('hunt/capture/nativeHuntIndividual.js');
    const {nativeIndividualProfile}=await cp('raising/nativeIndividualProfile.js');
    const {createRanchRaisingGround,ranchRaisingEntryPosition}=await cp('raising/nativeRaisingRanchRing.js');
    const A=await cp('raising/nativeRaisingActor.js');
    const rng=createChannelRng(20);let profile=nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(62),rng}));
    const ground=createRanchRaisingGround(frame.ranch),actor=A.createNativeRaisingActor(profile,0),initial=ranchRaisingEntryPosition(ground,35,rng,0);
    A.initializeNativeRaisingActor(actor,profile,initial,35,rng);
    const foods=[],feeding={ground,foods,signals:new Map(),actors:[actor]},pointer={x:initial[0]/4096,y:initial[1]/4096};
    function tick(){const r=A.stepNativeRaisingActor(actor,profile,{ageDelta:0,rng,feeding,lifecycle:{rank:0,minute:480,season:0,roster:[62],residents:actor.detached?[]:[profile],getResidents:()=>[profile],wasteCount:0,rottenFoodCount:0}});profile=r.profile;return r;}
    const records=[],timing=[];let heldTicks=0,presentationTime=performance.now(),landing=null;
    function render(label){
     native=A.projectNativeRaisingActor(actor);frame.revision=++revision;scene.render(frame);stage.app.ticker.update(presentationTime+=1000/60);scene.render({...frame,revision:++revision});stage.app.render();
     const sprite=createdActor.sprite,root=sprite.parent,shadow=root.children[0],b=sprite.getBounds(),g=createdActor.nativeFramePresenter.getSnapshot().geometry;
     checked(sprite.anchor.x===28/64&&sprite.anchor.y===37/64,'ORIGIN_DRIFT');checked(sprite.texture.source.scaleMode==='nearest','FILTER_DRIFT');
     checked(b.x>=0&&b.y>=0&&b.x+b.width<=390&&b.y+b.height<=780,'FRAME_CROPPED');
     if(actor.state===6){checked(native.sequenceId===11&&native.positionQ12[2]===81920,'NATIVE_CARRY_STATE');checked(sprite.y===-20,'REAL_RENDERER_Z20');}
     const origin=root.toGlobal(new PIXI.Point(0,0));const r={label,native,heldTicks,pointer,origin:{x:origin.x,y:origin.y},root:{x:root.x,y:root.y,scaleX:root.scale.x,scaleY:root.scale.y},sprite:{anchor:[sprite.anchor.x,sprite.anchor.y],scale:[sprite.scale.x,sprite.scale.y],position:[sprite.x,sprite.y],bounds:{x:b.x,y:b.y,width:b.width,height:b.height}},geometry:g,shadow:{x:shadow.x,y:shadow.y,visible:shadow.visible},actorFrames,diagnostics:scene.getDiagnostics()};records.push(r);return r;
    }
    function start(){profile=A.beginNativeRaisingCarry(actor,profile,pointer,{foods,rng,ground});checked(profile,'REAL_CARRY_ADMISSION');heldTicks=0;}
    function advanceHeld(target){while(heldTicks<target){tick();heldTicks++;const s=A.projectNativeRaisingActor(actor),expected=heldTicks%11<5?19:20;checked(s.cell===expected&&s.state===6&&s.sequenceId===11&&s.positionQ12[2]===81920,'CARRY_22_TICKS');checked(s.positionQ12[1]/4096===pointer.y+(expected===19?16:20),'NATIVE_HEIGHT_OWNER');timing.push({tick:heldTicks,cell:s.cell,positionQ12:s.positionQ12});}}
    globalThis.__carry={action(label){
     if(label==='idle')return render(label);
     if(label==='carry0'){start();return render(label);}
     if(label.startsWith('carry')){advanceHeld(Number(label.slice(5)));return render(label);}
     if(label==='cancel'){advanceHeld(22);checked(A.cancelNativeRaisingCarry(actor),'REAL_CANCEL');checked(JSON.stringify(actor.positionQ12)===JSON.stringify(initial)&&actor.state===1&&actor.sequenceId===0,'CANCEL_RETURN');return render(label);}
     if(label==='release'){start();advanceHeld(22);profile=A.releaseNativeRaisingCarry(actor,profile);checked(profile&&actor.state===7,'REAL_RELEASE');return render(label);}
     throw Error('UNKNOWN_ACTION');
    },result(){
     // Exercise actual flight until landing without substituting unsupported visual reaction art.
     for(let i=0;i<300;i++){const r=tick();if(r.landed){landing={ticks:i+1,frame:A.projectNativeRaisingActor(actor)};break;}}
     checked(landing&&landing.frame.positionQ12[2]===0,'NATIVE_RELEASE_LANDED');
     const before=records.find(r=>r.label==='idle'),after=records.find(r=>r.label==='cancel');checked(JSON.stringify(before.sprite.bounds)===JSON.stringify(after.sprite.bounds),'CANCEL_VISUAL_RETURN');
     return{scene:sceneName,variant,records,timing,alpha,failures,landing,renderer:{resolution:stage.app.renderer.resolution,canvas:[stage.app.canvas.width,stage.app.canvas.height],css:[stage.app.canvas.clientWidth,stage.app.canvas.clientHeight],deviceDpr:devicePixelRatio},baseline:m.baseline,limits:['Real carry actor API and Raising scene, not pointer DOM hit-testing','Actual cancel returns to original ground; cancellation is NOT ordinary release','Ordinary release entry rendered, flight/landing verified numerically only; full landing art not accepted','Candidate cursor anchor remains subject to visual review; native boxes unchanged','No production replacement']};}};
   },{base,sceneName,variant});
   for(const action of ['idle','carry0','carry5','carry11','carry16','cancel','release']){
    await page.evaluate(action=>__carry.action(action),action);await page.screenshot({path:`${out}/${variant}-${action}.png`,timeout:60000});captures++;
   }
   const result=await page.evaluate(()=>__carry.result());assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[]);assert.deepEqual(result.renderer.canvas,[780,1560]);assert.deepEqual(result.renderer.css,[390,780]);assert.equal(result.renderer.resolution,2);
   await fs.writeFile(`${out}/${sceneName}-${variant}.json`,JSON.stringify({status:'PASS_REAL_SCENE_CONTRACTS_VISUAL_REVIEW_PENDING',...result,network,pageErrors:errors},null,2));
  }catch(error){await fs.writeFile(`${out}/${sceneName}-${variant}-failure.json`,JSON.stringify({error:String(error),stack:error.stack,errors,network},null,2));throw error;}finally{await page.close();}
 }
 assert.equal(captures,14);
}finally{await browser.close();}
