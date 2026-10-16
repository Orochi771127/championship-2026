// Six native-owner Battle contexts, baseline/candidate; no full-match or VM claim.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='.tmp/browser-qa/species062-whole-bank/battle']=process.argv.slice(2);assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const screenshotClipCSS={x:32,y:240,width:326,height:244};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let captures=0;
try{for(const scenario of ['attack1','attack2','hit26','recovery54','block57','knockback61'])for(const variant of ['base','candidate']){
 const page=await browser.newPage({viewport:{width:390,height:780},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(new URL('tests/fixtures/species062-whole-bank/index.html',base).href);
  const result=await page.evaluate(async({base,scenario,variant,screenshotClipCSS})=>{
   history.replaceState(null,'',new URL('championship.html?wholeBankFixture=1',base));
   const check=(x,m)=>{if(!x)throw Error(m)},imp=p=>import(new URL('src/championship/presentation/'+p,base)),json=async p=>{const r=await fetch(new URL(p,base));check(r.ok,'HTTP '+p);return r.json()};
   const PIXI=await import(new URL('node_modules/pixi.js/dist/pixi.mjs',base));const {createChampionshipPixiStage}=await imp('championshipPixiStage.js');const {loadPixiCharacterRuntimeBundle}=await imp('pixiCharacterRuntimeBundle.js');const {validateRuntimeMapArtBundle,createRuntimeMapArtFieldLoader}=await imp('runtimeMapArtBundle.js');
   const {createNativeBattleContextFixture,mountNativeBattleContext}=await import(new URL('scripts/whole-bank-battle-native-helper.mjs',base));
   const prefix='tests/fixtures/species062-whole-bank/',m=await json(prefix+'manifest.json');
   const runtimeUrl=new URL(variant==='base'?m.baseline.path:prefix+'bank/runtime.review.json',base).href;
   const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl,sides:['main'],cachePrefix:'whole-battle-'+variant+':'});
   const atlasFrames=new Map(),rect=r=>r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
   if(variant==='candidate')for(const page of bundle.runtime.sides.main.atlases){
    const atlas=await json(prefix+'bank/'+page.data),response=await fetch(new URL(prefix+'bank/'+page.image,base));check(response.ok,'CANDIDATE_ATLAS_IMAGE_HTTP');
    const bitmap=await createImageBitmap(await response.blob()),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
    const resolution=Number(atlas.meta.scale);check(Number.isFinite(resolution)&&resolution>0,'CANDIDATE_ATLAS_RESOLUTION');
    for(const [key,meta]of Object.entries(atlas.frames)){check(!atlasFrames.has(key),'DUPLICATE_ATLAS_KEY');atlasFrames.set(key,{meta,ctx,width:canvas.width,height:canvas.height,resolution});}
   }
   function candidateTextureProof(key,texture,geometry){
    const a=atlasFrames.get(key);check(a&&texture.trim,'CANDIDATE_ALPHA_BACKED_TRIM_REQUIRED '+key);
    const {meta,ctx,resolution:r}=a,f=meta.frame,s=meta.spriteSourceSize,o=meta.sourceSize;
    check(meta.trimmed===true&&meta.rotated===false&&o?.w===256&&o.h===256&&f&&s,'CANDIDATE_TRIM_METADATA '+key);
    check([f.x,f.y,f.w,f.h,s.x,s.y,s.w,s.h].every(Number.isInteger)&&f.x>=0&&f.y>=0&&f.w>0&&f.h>0&&f.x+f.w<=a.width&&f.y+f.h<=a.height&&s.x>=0&&s.y>=0&&s.w===f.w&&s.h===f.h&&s.x+s.w<=256&&s.y+s.h<=256,'CANDIDATE_TRIM_RECT_BOUNDS '+key);
    const pixels=ctx.getImageData(f.x,f.y,f.w,f.h).data;let x0=f.w,y0=f.h,x1=0,y1=0,hx0=f.w,hy0=f.h,hx1=0,hy1=0;
    for(let y=0;y<f.h;y++)for(let x=0;x<f.w;x++){const alpha=pixels[(y*f.w+x)*4+3];
     if(alpha>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
     if(alpha>=128){hx0=Math.min(hx0,x);hy0=Math.min(hy0,y);hx1=Math.max(hx1,x+1);hy1=Math.max(hy1,y+1);}}
    const alphaBounds=[s.x+x0,s.y+y0,s.x+x1,s.y+y1],halfAlphaBounds=[s.x+hx0,s.y+hy0,s.x+hx1,s.y+hy1];
    check(JSON.stringify(alphaBounds)===JSON.stringify([s.x,s.y,s.x+s.w,s.y+s.h]),'CANDIDATE_TRIM_NOT_TIGHT_ALPHA '+key);
    check(JSON.stringify(halfAlphaBounds.map((v,i)=>(v-(i%2===0?112:148))/4))===JSON.stringify(geometry.nativeBounds),'CANDIDATE_ALPHA_GEOMETRY '+key);
    check(JSON.stringify(geometry.sourceSize)==='[256,256]'&&JSON.stringify(geometry.origin)==='[112,148]','CANDIDATE_SOURCE_ORIGIN '+key);
    const expected={frame:{x:f.x/r,y:f.y/r,width:f.w/r,height:f.h/r},orig:{x:0,y:0,width:256/r,height:256/r},trim:{x:s.x/r,y:s.y/r,width:s.w/r,height:s.h/r}};
    const actual={frame:rect(texture.frame),orig:rect(texture.orig),trim:rect(texture.trim)};
    check(texture.source.resolution===r&&texture.rotate===0&&JSON.stringify(actual)===JSON.stringify(expected),'CANDIDATE_PIXI_TRIM_MISMATCH '+key);
    return{key,...actual,resolution:r,alphaBounds,halfAlphaBounds,metadata:{frame:f,spriteSourceSize:s,sourceSize:o,trimmed:meta.trimmed},status:'ALPHA_BACKED_ATLAS_AND_ACTUAL_PIXI_TRIM_MATCH'};
   }
   const created=[],roster={createActor({speciesId}){
    check(speciesId==='species-062','SPECIES');const actor=bundle.createActor({side:'main',animation:0,battleGeometry:bundle.runtime.reviewGeometry});
    const a={...actor,entityId:bundle.runtime.entityId,nativeSizing:{packedPixelsPerNativePixel:4,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'}};created.push(a);return a;
   },dispose(){},getDiagnostics(){return{reviewOnly:true,variant}}};
   const stage=await createChampionshipPixiStage({PIXI,canvasHost:document.querySelector('#host'),resolutionCap:2,antialias:true});stage.app.stop();
   const manifest=validateRuntimeMapArtBundle(await json('assets/production/battle/original-opus-v1/manifest.json'));
   const fieldArt=await createRuntimeMapArtFieldLoader({PIXI}).load({manifest,fieldId:'field_bm01_01'});
   const fixture=await createNativeBattleContextFixture({base,scenario,seed:scenario==='recovery54'?8:20,arenaIndex:0});
   const context=await mountNativeBattleContext({base,fixture,stage,fieldArt,characterRoster:roster,dynamicFx:true,responsiveLayout:true});
   const result=context.seekCapture();check(created.length===3,'THREE_ACTUAL_ACTORS');
   const sprite=created[0].sprite,diag=context.scene.getDiagnostics();check(diag.characters[0].slot===0,'TARGET_SLOT');
   check(sprite.anchor.x===112/256&&sprite.anchor.y===148/256,'ORIGIN');check(sprite.texture.source.scaleMode==='nearest','FILTER');
   const motion=created[0].battleAnimator.getSnapshot();check(motion.cell===fixture.spec.captureCell,'CAPTURE_CELL');
   const b=sprite.getBounds();check(sprite.visible&&b.width>0&&b.height>0,'VISIBLE_TARGET');
   check(b.x>=screenshotClipCSS.x&&b.y>=screenshotClipCSS.y&&b.x+b.width<=screenshotClipCSS.x+screenshotClipCSS.width&&b.y+b.height<=screenshotClipCSS.y+screenshotClipCSS.height,'TARGET_OUTSIDE_SCREENSHOT_CLIP');
   const textureProofs=variant==='candidate'?created.map(a=>{const m=a.battleAnimator.getSnapshot();return candidateTextureProof(m.texture,a.sprite.texture,m.geometry);}):[];
   const texture=sprite.texture,effectiveTrim=texture.trim??{x:0,y:0,width:texture.orig.width,height:texture.orig.height};
   const nativeScale=result.placement.nativeScale,zoom=result.placement.zoom,packedScale=motion.geometry.scale;
   check(nativeScale>0&&zoom>0&&packedScale===4&&diag.dynamicFx&&diag.groundShadows===null,'EXPECTED_REAL_DYNAMIC_ELLIPSE_PATH');
   // Read-only prediction of the actual scene's unchanged line448 ellipse.
   // Its unsquashed scale excludes hit dressing and uses texture.trim, not orig.
   const sceneScale=nativeScale*texture.source.resolution/packedScale;
   const radiusX=effectiveTrim.width*sceneScale*.42,radiusY=Math.max(1,effectiveTrim.width*sceneScale*.13);
   const expectedNativeEllipse={authority:'PRODUCTION_CREATE_BATTLE_FIELD_ELLIPSE_NO_OVERRIDE',source:'src/championship/presentation/vs5/createBattleFieldPixiPresentation.js:347,448',effectiveTextureTrim:rect(effectiveTrim),textureOrig:rect(texture.orig),packedScale,textureResolution:texture.source.resolution,nativeScale,cameraZoom:zoom,sceneScale,
    fieldRadii:[radiusX,radiusY],nativeDiameters:[2*radiusX/nativeScale,2*radiusY/nativeScale],screenDiametersCss:[2*radiusX*zoom,2*radiusY*zoom],groundOffsetNative:sceneScale/nativeScale,
    formula:'radiusX = trim.width * nativeScale * resolution / packedScale * .42; radiusY = max(1, trim.width * nativeScale * resolution / packedScale * .13)',measurementLimit:'Expected dimensions from real texture/scene inputs; not an independent pixel measurement of the rendered ellipse'};
   const output={scenario,variant,native:result.native,placement:result.placement,captureReadiness:result.captureReadiness,screenshotClipCSS,diagnostics:diag,geometry:motion.geometry,textureProofs,expectedNativeEllipse,
    sprite:{position:[sprite.x,sprite.y],scale:[sprite.scale.x,sprite.scale.y],anchor:[sprite.anchor.x,sprite.anchor.y],rotation:sprite.rotation,tint:sprite.tint,alpha:sprite.alpha,bounds:{x:b.x,y:b.y,width:b.width,height:b.height}},
    renderer:{canvas:[stage.app.canvas.width,stage.app.canvas.height],css:[stage.app.canvas.clientWidth,stage.app.canvas.clientHeight],resolution:stage.app.renderer.resolution,dpr:devicePixelRatio},
    limits:['Actual Battle mount and native actors own cell,worldZ,recoil,rotation; controlled notification/hit inputs, not full AI/skill VM or match approval','Baseline and candidate use the same configured native size and original geometry origins; no silhouette auto-fit','Candidate trim must match tight nonzero-alpha atlas bounds and actual Pixi trim/orig; the scene still draws its production ellipse','Screenshot is an identical fixed CSS crop of the actual390x780 viewport, never resized; full viewport safety and overlay assertions remain active','Recovery uses actual lethal-hit owner with living ally and seed8']};
   globalThis.__wholeBattle={fixture,context,stage};return output;
  },{base,scenario,variant,screenshotClipCSS});
  await page.screenshot({path:`${out}/${scenario}-${variant}.png`,clip:screenshotClipCSS,timeout:60000});captures++;
  if(scenario==='recovery54')result.continuation=await page.evaluate(()=>{
   const f=__wholeBattle.fixture,changes=[];let last=null;
   for(let i=0;i<220;i++){const p=f.actors.project(0),cell=p.nativeAnimation.cell;if(cell!==last){changes.push({frame:f.session.frame,cell,sequence:p.nativeAnimation.sequenceId,position:p.stand});last=cell;}f.step();}
   return{changes,terminal:f.sample('recovery-continuation')};
  });
  assert.deepEqual(errors,[]);assert.equal(result.renderer.resolution,2);await fs.writeFile(`${out}/${scenario}-${variant}.json`,JSON.stringify(result,null,2));
 }catch(error){await fs.writeFile(`${out}/${scenario}-${variant}-failure.json`,JSON.stringify({error:String(error),stack:error.stack,errors},null,2));throw error;}finally{await page.close();}
}assert.equal(captures,12);}finally{await browser.close();}
