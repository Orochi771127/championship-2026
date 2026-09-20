import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin='http://127.0.0.1:8732';
const output='docs/art/production/original-character-cage-r1/m001-pipeline-v1/full-sheet-r05';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
const page=await context.newPage();page.setDefaultTimeout(60000);
const errors=[],loaded=new Set();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(/CHARACTER_REVIEW_FALLBACK/.test(m.text()))errors.push(m.text());});
page.on('response',r=>{if(r.ok()&&r.url().includes('/internal-character-review/m001-r05-anchored/'))loaded.add(new URL(r.url()).pathname.split('/').at(-1));});
try{
  await page.goto(origin+'/tests/fixtures/championship-owned-party.html');
  const renderer=await page.evaluate(async()=>{
    const PIXI=await import('/node_modules/pixi.js/dist/pixi.mjs');
    const {loadPixiCharacterRuntimeBundle}=await import('/src/championship/presentation/pixiCharacterRuntimeBundle.js');
    const {applyNativeCharacterCellGeometry}=await import('/src/championship/presentation/nativeHuntCharacterAction.js');
    const {loadM001CharacterArtReview,isM001CharacterArtReview}=await import('/src/championship/presentation/m001CharacterArtReview.js');
    if(isM001CharacterArtReview('https://example.com/?characterArtReview=m001')||isM001CharacterArtReview(location.origin+'/championship.html'))throw Error('REVIEW_SCOPE_LEAK');
    const manifestUrl=location.origin+'/assets/production/internal-faithful-baseline/characters-v1/manifest.json';
    const manifest=await fetch(manifestUrl).then(r=>r.json());
    const productionIndex=await fetch('/assets/production/ART_PRODUCTION_INDEX.json').then(r=>r.json());
    const roster=await loadM001CharacterArtReview({PIXI,manifestUrl,manifest,productionIndex,speciesIds:['species-008','species-034']},location.origin+'/championship.html?characterArtReview=m001');
    const rosterDiagnostics=roster.getDiagnostics();
    if(rosterDiagnostics.failures.length||!rosterDiagnostics.originalArtReview.loaded)throw Error(JSON.stringify(rosterDiagnostics));
    const original=roster.createActor({speciesId:'species-008',presentation:'raising'});
    if(!original?.nativeFramePresenter||original.nativeSizing.packedPixelsPerNativePixel!==1)throw Error('M001_ACTOR_NOT_MOUNTABLE');
    if(!original.sprite.texture.trim||original.sprite.texture.trim.width>=64)throw Error('TRANSPARENT_PADDING_USED_AS_BODY_SIZE');
    const review=await fetch('/assets/production/internal-character-review/m001-r05-anchored/runtime.review.json').then(r=>r.json());
    const hunt=roster.createActor({speciesId:'species-008',presentation:'hunt'});
    const battle=roster.createActor({speciesId:'species-008',presentation:'battle'});
    let projectedMainFrames=0,battleFrame=0;
    for(const sequence of review.sides.main.animations)for(const [index,frame] of sequence.frames.entries()){
      for(const [actor,units] of [[original,1],[hunt,2]]){
        const projected=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:sequence.id,frameIndex:index,flipBits:0});
        applyNativeCharacterCellGeometry(actor.sprite,projected,units);
        if(projected.cell!==frame.cell||projected.geometry.scale!==1||actor.sprite.scale.x!==units)throw Error('OWNER_FRAME_OR_SCALE_DRIFT');
      }
      const sample={sequenceId:sequence.id,frameIndex:index,cell:frame.cell,active:1,elapsedQ12:0,playMode:sequence.playbackMode};
      const projected=battle.battleAnimator.apply({battleFrame:battleFrame++,sequenceId:sequence.id,nativeRequest:true,nativeSample:sample});
      if(projected.cell!==frame.cell||projected.geometry.origin.join(',')!=='31,38')throw Error('BATTLE_FRAME_OR_ORIGIN_DRIFT');
      projectedMainFrames++;
    }
    const other=roster.createActor({speciesId:'species-034',presentation:'raising'});
    if(!other||other.entityId==='m001_zurumon'||other.nativeSizing.packedPixelsPerNativePixel===1)throw Error('OTHER_SPECIES_CHANGED');
    original.sprite.destroy();hunt.sprite.destroy();battle.sprite.destroy();other.sprite.destroy();await roster.dispose();
    const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl:'/assets/production/internal-character-review/m001-r05-anchored/runtime.review.json'});
    const app=new PIXI.Application();await app.init({width:512,height:512,backgroundAlpha:0,autoStart:false});
    const failures=[],scales=[1,4,8];let sequenceCount=0,frameCount=0;
    for(const side of ['main','sub'])for(const sequence of bundle.runtime.sides[side].animations){
      const actor=bundle.createActor({side,animation:sequence.id,nativeSequence:true,reducedMotion:true});
      app.stage.addChild(actor.sprite);actor.sprite.position.set(256,304);
      for(const frame of sequence.frames){
        const state=actor.sequencePlayer.getSnapshot();
        if(state.cell!==frame.cell)failures.push('frame order');
        for(const scale of scales){
          applyNativeCharacterCellGeometry(actor.sprite,{geometry:bundle.runtime.reviewGeometry.frames[frame.texture]},scale);
          const localOrigin=new PIXI.Point(31-actor.sprite.anchor.x*actor.sprite.texture.orig.width,
            38-actor.sprite.anchor.y*actor.sprite.texture.orig.height);
          const p=actor.sprite.toGlobal(localOrigin);
          if(p.x!==256||p.y!==304||actor.sprite.scale.x!==scale||actor.sprite.texture.source.scaleMode!=='nearest')failures.push('origin/scale');
          // Mirroring must keep the same actor origin, rather than recentering visible pixels.
          actor.sprite.scale.x=-scale;
          const mirrored=actor.sprite.toGlobal(localOrigin);
          if(mirrored.x!==256||mirrored.y!==304)failures.push('flip origin');
          actor.sprite.scale.x=scale;app.render();
        }
        for(let t=0;t<frame.ticks;t++)actor.sequencePlayer.advanceNative(4096);
        frameCount++;
      }
      actor.sprite.destroy();sequenceCount++;
    }
    const diagnostics=bundle.getDiagnostics();app.destroy(true);await bundle.dispose();
    return {sequenceCount,frameCount,scales,diagnostics,rosterDiagnostics,projectedMainFrames,
      ownerProjection:['raising','hunt','battle'],transparentPaddingExcludedFromBodySize:true,failures};
  });
  assert.deepEqual(renderer.failures,[]);assert.equal(renderer.sequenceCount,53);assert.equal(renderer.diagnostics.textureCount,83);
  // Fresh ephemeral browser storage only. Controlled m001 profile; subsequent entry uses the real Continue flow.
  await page.evaluate(async()=>{
    const {createChampionshipStandaloneApp}=await import('/src/championship/app/championshipStandaloneApp.js');
    const {createNativeHuntIndividual}=await import('/src/championship/hunt/capture/nativeHuntIndividual.js');
    const {nativeHuntSpeciesByIndex}=await import('/src/championship/hunt/capture/nativeHuntSources.js');
    const {nativeIndividualProfile}=await import('/src/championship/raising/nativeIndividualProfile.js');
    const catalog=await fetch('/src/data/championship/catalogs/creature-species.r1.json').then(r=>r.json());
    const {cages}=await fetch('/docs/contracts/championship/raising-home-presentation.v1.json').then(r=>r.json());
    const app=createChampionshipStandaloneApp({storage:localStorage,catalog,cages,rngClock:()=>({hour:13,minute:20,second:50})});
    await app.newGame();app.save();const key='championshipModernSave:v1',save=JSON.parse(localStorage.getItem(key));
    await app.dispose();
    save.creature.nativeProfile=nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(8),rng:{next:()=>11}}));
    save.creature.speciesId='species-008';save.creature.displayName='琥珀凝靈';
    localStorage.setItem(key,JSON.stringify(save));
  });
  loaded.clear();
  const reviewImage=page.waitForResponse(r=>r.ok()&&r.url().endsWith('/internal-character-review/m001-r05-anchored/main.png'));
  await page.goto(origin+'/championship.html?characterArtReview=m001&presentation=developer');
  await page.locator('#cm-login').click();await page.locator('#cm-continue').click();
  await page.locator('.cm-raising-pixi-canvas').waitFor();
  await reviewImage;
  await page.locator('.int-rh2-field-host[data-resident-screen-positions]').waitFor();
  const ownerSamples=[];
  for(let i=0;i<8;i++){
    ownerSamples.push(await page.locator('.int-rh2-field-host').evaluate(el=>JSON.parse(el.dataset.residentScreenPositions)));
    await page.waitForTimeout(300);
  }
  assert.ok(ownerSamples.every(rows=>rows.some(r=>r.speciesIndex===8)),'actual native owner must be m001 / species 008');
  assert.ok(new Set(ownerSamples.map(rows=>rows.find(r=>r.speciesIndex===8).nativeFrame)).size>1,'native owner clock must advance');
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('canvas').count(),1);
  assert.equal(await page.locator('#cm-root').getAttribute('data-field-fallback'),null);
  for(const asset of ['runtime.review.json','main.json','main.png'])assert.ok(loaded.has(asset),asset);
  const screenshots=[];
  for(const viewport of [{width:390,height:844},{width:820,height:1180}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(600);
    const name=`game-raising-${viewport.width}.png`;await page.screenshot({path:`${output}/${name}`});screenshots.push(name);
  }
  assert.deepEqual(errors,[]);
  const report={result:'PASS_LOCAL_REVIEW',renderer,normalGame:{scope:'CONTROLLED_M001_SAVE_THEN_REAL_CONTINUE_AND_RAISING',
    speciesId:'species-008',entityId:'m001_zurumon',canvasCount:1,screenshots,ownerSamples,loadedAssets:[...loaded],
    naturalHatching:false,hunt:'NOT_RUN',battle:'NOT_RUN'},errors,humanApproved:false,batchGate:'CLOSED_PENDING_COMPLETE_GAME_AND_VISUAL_ACCEPTANCE'};
  await fs.writeFile(`${output}/runtime-browser-validation.json`,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}finally{await context.close();await browser.close();}
