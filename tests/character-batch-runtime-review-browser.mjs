import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const entity=process.argv[2];
const revisions={m002_choromon:'r01',m003_nyokimon:'r03',m004_bubbmon:'r03',m005_pitchmon:'r06',m006_punimon:'r06',m007_botamon:'r06',m008_poyomon:'r03',m009_mokumon:'r06',m010_yukimibotamon:'r01',m011_yuramon:'r02',m012_petimon:'r03',m101_caprimon:'r06',m102_koromon:'r03',m103_tanemon:'r03',m104_tunomon:'r02',m105_tokomon:'r01'};
assert.ok(entity in revisions);
const revision=revisions[entity];
const bundleFolder='assets/production/internal-character-review/'+entity+'-hf-'+revision;
// Most review folders are named higgsfield-<revision>; entities prepared through the batch job keep
// the batch folder they were prepared in, so they are named here rather than renamed on disk.
const reviewFolders={m105_tokomon:'batch-r02'};
const reportFolder='docs/art/production/characters/appearance-refresh-v1/sheet-jobs-v1/'+entity+'/'
  +(reviewFolders[entity]??('higgsfield-'+revision));
let priorReport={};
try { priorReport=JSON.parse(await fs.readFile(reportFolder+'/runtime-renderer-validation.json','utf8')); } catch {}
const priorNormalGameQa=String(priorReport.normalGameNavigationQa??'');
const runtime=JSON.parse(await fs.readFile(bundleFolder+'/runtime.review.json','utf8'));
const expectedCells=Object.keys(runtime.reviewGeometry.frames).length;
const expectedSequences=Object.values(runtime.sides).reduce((count,side)=>count+side.animations.length,0);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:720,height:720}});
const errors=[];page.on('pageerror',error=>errors.push(String(error)));
try {
  await page.goto('http://127.0.0.1:8732/tests/fixtures/championship-owned-party.html');
  const result=await page.evaluate(async({entity,bundleFolder,revision})=>{
    const PIXI=await import('/node_modules/pixi.js/dist/pixi.mjs');
    const {loadPixiCharacterRuntimeBundle}=await import('/src/championship/presentation/pixiCharacterRuntimeBundle.js');
    const {applyNativeCharacterCellGeometry}=await import('/src/championship/presentation/nativeHuntCharacterAction.js');
    const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl:'/'+bundleFolder+'/runtime.review.json',
      cachePrefix:entity+'-hf-'+revision+':'});
    const app=new PIXI.Application();await app.init({width:512,height:512,background:0x26323f,autoStart:false});
    document.body.replaceChildren(app.canvas);
    const failures=[],origin=bundle.runtime.reviewGeometry.frames[entity+'/main/cell_000'].origin;
    let sequenceCount=0,frameCount=0,battleFrame=0;
    for(const side of ['main','sub'])for(const sequence of bundle.runtime.sides[side].animations){
      const actor=bundle.createActor({side,animation:sequence.id,nativeSequence:true,reducedMotion:false,
        nativeFramePresentation:true,nativeGeometry:bundle.runtime.reviewGeometry,battleGeometry:bundle.runtime.reviewGeometry});
      app.stage.addChild(actor.sprite);actor.sprite.position.set(256,304);
      for(const [index,frame] of sequence.frames.entries()){
        const state=actor.sequencePlayer.getSnapshot();
        if(state.cell!==frame.cell)failures.push('sequence '+side+'/'+sequence.id+'/'+index);
        const projected=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',
          sequenceId:sequence.id,frameIndex:index,flipBits:0});
        if(projected.cell!==frame.cell||projected.geometry.origin.join(',')!==origin.join(','))failures.push({kind:'native projection',expected:frame.cell,actual:projected.cell,origin:projected.geometry.origin});
        const battle=actor.battleAnimator.apply({battleFrame:battleFrame++,sequenceId:sequence.id,nativeRequest:true,
          nativeSample:{sequenceId:sequence.id,frameIndex:index,cell:frame.cell,active:1,elapsedQ12:0,playMode:sequence.playbackMode}});
        if(battle.cell!==frame.cell||battle.geometry.origin.join(',')!==origin.join(','))failures.push({kind:'battle projection',expected:frame.cell,actual:battle.cell,origin:battle.geometry.origin});
        for(const scale of [1,4,8]){
          applyNativeCharacterCellGeometry(actor.sprite,{geometry:projected.geometry},scale);
          const localOrigin=new PIXI.Point(origin[0]-actor.sprite.anchor.x*actor.sprite.texture.orig.width,
            origin[1]-actor.sprite.anchor.y*actor.sprite.texture.orig.height);
          let point=actor.sprite.toGlobal(localOrigin);
          if(point.x!==256||point.y!==304||actor.sprite.scale.x!==scale||actor.sprite.texture.source.scaleMode!=='nearest')failures.push('origin/scale');
          actor.sprite.scale.x=-scale;point=actor.sprite.toGlobal(localOrigin);
          if(point.x!==256||point.y!==304)failures.push('mirror origin');
          actor.sprite.scale.x=scale;
        }
        for(let tick=0;tick<frame.ticks;tick++)actor.sequencePlayer.advanceNative(4096);
        frameCount++;
      }
      app.render();actor.sprite.destroy();sequenceCount++;
    }
    const diagnostics=bundle.getDiagnostics();
    await bundle.dispose();app.destroy(true);
    return {entity,origin,sequenceCount,frameCount,diagnostics,projections:['native-hunt','battle'],
      scales:[1,4,8],transparentPaddingExcludedFromBodySize:true,failures};
  },{entity,bundleFolder,revision});
  assert.deepEqual(result.failures,[]);
  assert.equal(result.sequenceCount,expectedSequences);
  assert.equal(result.diagnostics.textureCount,expectedCells);
  assert.equal(result.diagnostics.reviewOnly,true);
  assert.equal(result.diagnostics.runtimeEligible,false);
  assert.deepEqual(errors,[]);
  await fs.writeFile(reportFolder+'/runtime-renderer-validation.json',JSON.stringify({
    status:'PASS_LOOPBACK_RUNTIME_RENDERER_REVIEW',...result,pageErrors:errors,
    normalGameNavigationQa:priorNormalGameQa.startsWith('PASS_')?priorNormalGameQa:'NOT_RUN',
    defaultRuntimeChanged:false,fullCharacterArtAcceptance:false
  },null,2)+'\n');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
