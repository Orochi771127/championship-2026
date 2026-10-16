// Additive candidate-only fixture. Real scene mounts own all sprite/shadow placement.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='.tmp/browser-qa/species062-grounding-context']=process.argv.slice(2);
assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let captures=0;
try{
 for(const sceneName of ['raising','hunt'])for(const variant of ['base','unchanged','shift8']){
  const page=await browser.newPage({viewport:{width:390,height:780},deviceScaleFactor:2});
  const errors=[],network=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>network.push({url:r.url(),status:r.status()}));
  try{
   await page.goto(new URL('tests/fixtures/species062-grounding-context/index.html',base).href);
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
    const prefix='tests/fixtures/species062-grounding-context/',m=await json(prefix+'manifest.json');
    checked(m.captureBudget===42&&m.density===4&&JSON.stringify(m.origin)==='[112,148]','FIXTURE_CONTRACT');
    const stage=await createChampionshipPixiStage({PIXI,canvasHost:document.querySelector('#host'),resolutionCap:2,antialias:true});stage.app.stop();
    const runtimeUrl=new URL(m.baseline.path,base).href;
    const baseline=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl,sides:['main'],cachePrefix:'ground-'+sceneName+'-'+variant+':'});
    const runtime=baseline.runtime,animations=runtime.sides.main.animations;
    checked(runtime.sourceBankSha256===m.baseline.sourceBankSha256,'BASELINE_BANK');
    const expected=[[0,2,[[0,31],[1,22]]],[2,2,[[4,15],[5,12]]],[13,1,[[23,37]]],[14,2,[[24,25],[25,31]]]];
    checked(JSON.stringify(animations.filter(a=>[0,2,13,14].includes(a.id)).map(a=>[a.id,a.playbackMode,a.frames.map(f=>[f.cell,f.ticks])]))===JSON.stringify(expected),'NATIVE_TIMING');
    const candidateTextures={},candidateGeometry={frames:{}},alpha=[];
    if(variant!=='base')for(const a of m.assets){
     const url=new URL(prefix+a.staged,base),r=await fetch(url);checked(r.ok,'CANDIDATE_HTTP');const bytes=await r.arrayBuffer();
     const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');checked(hash===a.sha256,'CANDIDATE_HASH');
     const bitmap=await createImageBitmap(new Blob([bytes]));checked(bitmap.width===256&&bitmap.height===256,'CELL_SIZE');
     const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,variant==='shift8'?8:0);bitmap.close();
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
     else{const sprite=new PIXI.Sprite(candidateTextures['m237_renamon/main/cell_000']);const available=animations.filter(a=>[0,2,13,14].includes(a.id));actor={sprite,controller:createPixiCharacterAnimationController({sprite,animations:available,textureResolver:k=>candidateTextures[k],initialAnimation:0,reducedMotion:false}),nativeFramePresenter:createNativeHuntCharacterFramePresenter({sprite,animations:available,textureResolver:k=>candidateTextures[k],entityId:runtime.entityId,geometry:candidateGeometry})};}
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
    }else{
     const manifest=validateRuntimeMapArtBundle(await json('assets/production/hunt/accepted-20261010/manifest.json'));
     const field=manifest.fields.find(f=>f.fieldId==='field_hm00_01');checked(field&&field.worldWidthPx>=1024&&field.worldHeightPx>=1024,'REAL_HUNT_FIELD_REQUIRED');
     fieldArt=await createRuntimeMapArtFieldLoader({PIXI}).load({manifest,fieldId:field.fieldId});
     const {loadHuntDepthOccluders,withHuntDepthOccluders}=await imp('vs2/huntDepthOccluders.js');fieldArt=withHuntDepthOccluders(fieldArt,await loadHuntDepthOccluders({PIXI,field}));
     const {huntViewportTransform,huntViewportToWorld,huntWorldToViewport}=await import(new URL('src/championship/hunt/huntFieldCoordinates.js',base));
     source={field:{tick(){},getView({viewportWidth,viewportHeight}){
      // Source-defined tutorial actor 0: native [400,400], world [800,800].
      // nativeTutorialHuntEntry.js and nativeTutorialHuntScript.js; 3x3 terrain neighborhood is clear.
      const worldX=800,worldY=800,transform=huntViewportTransform(viewportWidth,viewportHeight),camera={left:worldX-transform.worldWidth/2,top:worldY-transform.worldHeight/2};
      return{gateId:'qa062-fixed',worldWidthPx:field.worldWidthPx,worldHeightPx:field.worldHeightPx,transform,camera,objects:[],visibleChunks:[],player:{worldX:0,worldY:0,facing:'left'},wildCreatures:[{wildId:'qa062',speciesId:'championship:creature:species-062',worldX,worldY,worldZ:0,facing:'left',moving:false,currentHp:100,maxHp:100,nativeAnimation:native}],selectedWildId:null,toWorldPoint:p=>huntViewportToWorld(p,camera,transform),toViewportPoint:p=>huntWorldToViewport(p,camera,transform)};
     }},intents:{panCamera(){},selectWildAt(){},abortEnclosureStroke(){}}};
     const {mountHuntFieldPixiPresentation}=await imp('vs2/createHuntFieldPixiPresentation.js');
     scene=await mountHuntFieldPixiPresentation({stage,source,fieldArt,characterBundle:bundle,onActorFrame:x=>actorFrames=x,onFallback:x=>failures.push(String(x))});
    }
    checked(createdActor,'MISSING_REAL_ACTOR');stage.app.stop();
    function rect(b){return{x:b.x,y:b.y,width:b.width,height:b.height};}
    const records=[],timing=[];let presentationTime=performance.now();
    function sample(sequenceId,tick,mirror=false){
     const sequence=animations.find(a=>a.id===sequenceId),timeline=createNativeCharacterAnimationTimeline(sequence);for(let t=0;t<tick;t++)timeline.advanceNative(4096);const snap=timeline.getSnapshot();checked(snap.cell===nativeAnimationCellAt(sequence,tick),'TIMELINE_CELL');
     if(sequenceId===13&&tick>=37)checked(snap.active===0,'SLEEP_HOLD');if([0,2,14].includes(sequenceId))checked(snap.active===1,'LOOP_ACTIVE');
     native={...native,sequenceId,frameIndex:snap.frameIndex,flipBits:mirror?1:0};revision++;if(frame)frame.revision=revision;
     if(sceneName==='raising')scene.render(frame);else scene.render();
     // Execute the real scene-owned presentation ticker once at each frozen native snapshot.
     // This initializes lifecycle visibility and actor-frame diagnostics; source clocks stay frozen.
     stage.app.ticker.update(presentationTime+=1000/60);
     if(sceneName==='raising')scene.render({...frame,revision:++revision});else scene.render();
     stage.app.render();
     const sprite=createdActor.sprite,root=sprite.parent,shadow=sceneName==='hunt'?root.contactShadow:root.children[0];
     checked(sprite.anchor.x===28/64&&sprite.anchor.y===37/64,'ORIGIN_DRIFT');checked(sprite.texture.source.scaleMode==='nearest','FILTER_DRIFT');
     const geom=createdActor.nativeFramePresenter.getSnapshot().geometry,b=geom.nativeBounds;
     const support=sprite.toGlobal(new PIXI.Point(0,(b[3]*4))); // local texture pixels relative to sprite origin
     const origin=root.toGlobal(new PIXI.Point(0,0)),shadowBounds=rect(shadow.getBounds()),spriteBounds=rect(sprite.getBounds());
     const record={scene:sceneName,variant,sequenceId,tick,cell:snap.cell,active:snap.active,mirror,origin:{x:origin.x,y:origin.y},root:{x:root.x,y:root.y,scaleX:root.scale.x,scaleY:root.scale.y},sprite:{anchor:[sprite.anchor.x,sprite.anchor.y],scale:[sprite.scale.x,sprite.scale.y],position:[sprite.x,sprite.y],bounds:spriteBounds},geometry:geom,supportScreenY:support.y,shadow:{bounds:shadowBounds,centerY:shadowBounds.y+shadowBounds.height/2},gapToShadowCenter:shadowBounds.y+shadowBounds.height/2-support.y,actorFrames,diagnostics:scene.getDiagnostics()};
     checked(spriteBounds.x>=0&&spriteBounds.y>=0&&spriteBounds.x+spriteBounds.width<=390&&spriteBounds.y+spriteBounds.height<=780,'FRAME_CROPPED');
     if(records.length){checked(Math.abs(record.origin.x-records[0].origin.x)<1e-6&&Math.abs(record.origin.y-records[0].origin.y)<1e-6,'ACTOR_POSITION_DRIFT');checked(Math.abs(Math.abs(root.scale.x)-Math.abs(records[0].root.scaleX))<1e-6&&root.scale.y===records[0].root.scaleY,'CAMERA_SCALE_DRIFT');}
     records.push(record);return record;
    }
    // Validate both complete walk cycles and the mirror seam without additional screenshots.
    const walk=animations.find(a=>a.id===2),walkTimeline=createNativeCharacterAnimationTimeline(walk);
    for(let t=0;t<54;t++){const r=walkTimeline.getSnapshot();checked(r.cell===(t%27<15?4:5)&&r.cell===nativeAnimationCellAt(walk,t)&&r.active===1,'WALK_PHASE');timing.push({tick:t,cell:r.cell});walkTimeline.advanceNative(4096);}
    // Render the actual phase boundaries and cycle seam, not 54 redundant GPU readbacks.
    for(const t of [0,14,15,26,27,41,42,53])sample(2,t);
    sample(2,27,true);sample(13,37);sample(0,0);
    globalThis.__ground={sample,result:()=>({scene:sceneName,variant,records,timing,alpha,failures,renderer:{resolution:stage.app.renderer.resolution,canvas:[stage.app.canvas.width,stage.app.canvas.height],css:[stage.app.canvas.clientWidth,stage.app.canvas.clientHeight],deviceDpr:devicePixelRatio},baseline:m.baseline,limits:['Fixed native source snapshots, not full gameplay','Sleep baseline bottom differs from upright; uniform shift is not exact sleep proof','No art source changes, runtime registration changes, or release approval']})};
   },{base,sceneName,variant});
   for(const [sequence,tick] of [[0,0],[0,31],[2,0],[2,15],[14,0],[14,25],[13,0]]){
    const sample=await page.evaluate(([s,t])=>__ground.sample(s,t),[sequence,tick]);await page.screenshot({path:`${out}/${sceneName}-${variant}-cell${String(sample.cell).padStart(3,'0')}.png`,timeout:60000});captures++;
   }
   const result=await page.evaluate(()=>__ground.result());assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[]);assert.deepEqual(result.renderer.canvas,[780,1560]);assert.deepEqual(result.renderer.css,[390,780]);assert.equal(result.renderer.resolution,2);
   await fs.writeFile(`${out}/${sceneName}-${variant}.json`,JSON.stringify({status:'PASS_REAL_SCENE_CONTRACTS_VISUAL_REVIEW_PENDING',...result,network,pageErrors:errors},null,2));
  }catch(error){await fs.writeFile(`${out}/${sceneName}-${variant}-failure.json`,JSON.stringify({error:String(error),stack:error.stack,errors,network},null,2));throw error;}finally{await page.close();}
 }
 assert.equal(captures,42);
}finally{await browser.close();}
