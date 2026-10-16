// Six native-owner Battle contexts, baseline/candidate; no full-match or VM claim.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='.tmp/browser-qa/species062-whole-bank/battle']=process.argv.slice(2);assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let captures=0;
try{for(const scenario of ['attack1','attack2','hit26','recovery54','block57','knockback61'])for(const variant of ['base','candidate']){
 const page=await browser.newPage({viewport:{width:390,height:780},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(new URL('tests/fixtures/species062-whole-bank/index.html',base).href);
  const result=await page.evaluate(async({base,scenario,variant})=>{
   history.replaceState(null,'',new URL('championship.html?wholeBankFixture=1',base));
   const check=(x,m)=>{if(!x)throw Error(m)},imp=p=>import(new URL('src/championship/presentation/'+p,base)),json=async p=>{const r=await fetch(new URL(p,base));check(r.ok,'HTTP '+p);return r.json()};
   const PIXI=await import(new URL('node_modules/pixi.js/dist/pixi.mjs',base));const {createChampionshipPixiStage}=await imp('championshipPixiStage.js');const {loadPixiCharacterRuntimeBundle}=await imp('pixiCharacterRuntimeBundle.js');const {validateRuntimeMapArtBundle,createRuntimeMapArtFieldLoader}=await imp('runtimeMapArtBundle.js');
   const {createNativeBattleContextFixture,mountNativeBattleContext}=await import(new URL('scripts/whole-bank-battle-native-helper.mjs',base));
   const prefix='tests/fixtures/species062-whole-bank/',m=await json(prefix+'manifest.json');
   const runtimeUrl=new URL(variant==='base'?m.baseline.path:prefix+'bank/runtime.review.json',base).href;
   const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl,sides:['main'],cachePrefix:'whole-battle-'+variant+':'});
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
   const output={scenario,variant,native:result.native,placement:result.placement,diagnostics:diag,geometry:motion.geometry,
    sprite:{position:[sprite.x,sprite.y],scale:[sprite.scale.x,sprite.scale.y],anchor:[sprite.anchor.x,sprite.anchor.y],rotation:sprite.rotation,tint:sprite.tint,alpha:sprite.alpha,bounds:{x:b.x,y:b.y,width:b.width,height:b.height}},
    renderer:{canvas:[stage.app.canvas.width,stage.app.canvas.height],css:[stage.app.canvas.clientWidth,stage.app.canvas.clientHeight],resolution:stage.app.renderer.resolution,dpr:devicePixelRatio},
    limits:['Actual Battle mount and native actors own cell,worldZ,recoil,rotation; controlled notification/hit inputs, not full AI/skill VM or match approval','Baseline and candidate use the same configured native size and original geometry origins; no silhouette auto-fit','Recovery uses actual lethal-hit owner with living ally and seed8']};
   globalThis.__wholeBattle={fixture,context,stage};return output;
  },{base,scenario,variant});
  await page.screenshot({path:`${out}/${scenario}-${variant}.png`,timeout:60000});captures++;
  if(scenario==='recovery54')result.continuation=await page.evaluate(()=>{
   const f=__wholeBattle.fixture,changes=[];let last=null;
   for(let i=0;i<220;i++){const p=f.actors.project(0),cell=p.nativeAnimation.cell;if(cell!==last){changes.push({frame:f.session.frame,cell,sequence:p.nativeAnimation.sequenceId,position:p.stand});last=cell;}f.step();}
   return{changes,terminal:f.sample('recovery-continuation')};
  });
  assert.deepEqual(errors,[]);assert.equal(result.renderer.resolution,2);await fs.writeFile(`${out}/${scenario}-${variant}.json`,JSON.stringify(result,null,2));
 }catch(error){await fs.writeFile(`${out}/${scenario}-${variant}-failure.json`,JSON.stringify({error:String(error),stack:error.stack,errors},null,2));throw error;}finally{await page.close();}
}assert.equal(captures,12);}finally{await browser.close();}
