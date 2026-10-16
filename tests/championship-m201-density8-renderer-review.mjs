// Execute only inside an authorized repo browser-QA environment after applying overlay.
// Uses the existing owned-party fixture and actual PIXI/runtime/presenters; no mock renderer.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const base=process.argv[2],prefix=process.argv[3],out=process.argv[4]??'qa034-density8';
assert.ok(base&&prefix,'Usage: node renderer-review.mjs BASE_URL ASSET_PREFIX OUTPUT_DIR');
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1060,height:760}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto(new URL('tests/fixtures/championship-owned-party.html',base).href);
 const network=[];page.on('response',response=>{if(/runtime\.review\.json|\/(main|sub)\.(png|webp|json)/.test(response.url()))network.push({url:response.url(),status:response.status()})});
 const result=await page.evaluate(async({prefix})=>{
  const PIXI=await import('/node_modules/pixi.js/dist/pixi.mjs');
  const {loadPixiCharacterRuntimeBundle}=await import('/src/championship/presentation/pixiCharacterRuntimeBundle.js');
  const {applyNativeCharacterCellGeometry}=await import('/src/championship/presentation/nativeHuntCharacterAction.js');
  const {completedCharacterBundleLocation}=await import('/src/championship/presentation/completedOriginalCharacters.js');
  const selection=await (await fetch('/src/data/championship/accepted-original-character-selection.r1.json')).json();
  const config=selection.characters.find(c=>c.speciesId==='species-034');
  const route=completedCharacterBundleLocation(config,{battleAtlas:true,sides:['main']},location.href);
  if(route.packed||!route.runtimeUrl.endsWith('/'+prefix+'runtime.review.json'))throw Error('STALE_OR_UNEXPECTED_RUNTIME_ROUTE');
  const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl:route.runtimeUrl,cachePrefix:'034-density8-qa:'});
  const app=new PIXI.Application();await app.init({width:1040,height:1400,background:0x18212d,autoStart:false});document.body.replaceChildren(app.canvas);let frames=0,sequences=0;const failures=[],covered=new Set();
  for(const side of ['main','sub'])for(const sequence of bundle.runtime.sides[side].animations){
   const actor=bundle.createActor({side,animation:sequence.id,nativeSequence:true,nativeFramePresentation:true,nativeGeometry:bundle.runtime.reviewGeometry,battleGeometry:bundle.runtime.reviewGeometry});app.stage.addChild(actor.sprite);actor.sprite.position.set(300,400);
   for(const [index,frame] of sequence.frames.entries()){
    covered.add(frame.texture);if(actor.sequencePlayer.getSnapshot().cell!==frame.cell)failures.push('timeline '+side+'/'+sequence.id+'/'+index);
    const projected=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:sequence.id,frameIndex:index,flipBits:0});
    const battle=actor.battleAnimator.apply({battleFrame:frames,sequenceId:sequence.id,nativeRequest:true,nativeSample:{sequenceId:sequence.id,frameIndex:index,cell:frame.cell,active:1,elapsedQ12:0,playMode:sequence.playbackMode}});
    if(projected.cell!==frame.cell||battle.cell!==frame.cell)failures.push('projection');
    for(const zoom of [2,4,6]){applyNativeCharacterCellGeometry(actor.sprite,{geometry:projected.geometry},zoom);if(projected.geometry.scale!==8||actor.sprite.scale.x!==zoom*actor.sprite.texture.source.resolution/8||actor.sprite.anchor.x!==.4375||actor.sprite.anchor.y!==.640625)failures.push('native scale/origin');app.render();}
    for(let t=0;t<frame.ticks;t++)actor.sequencePlayer.advanceNative(4096);frames++;
   }actor.sprite.destroy();sequences++;
  }
  // Real sprite screenshot grid: three native zooms, idle/walk/eat current legacy actions.
  for(const [row,pose] of [[0,0],[0,1],[2,0],[2,1],[14,0],[14,1]].entries())for(const [col,zoom] of [2,4,6].entries()){const [id,frameIndex]=pose;
   const actor=bundle.createActor({side:'main',animation:id,nativeFramePresentation:true,nativeGeometry:bundle.runtime.reviewGeometry});const p=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:id,frameIndex,flipBits:0});applyNativeCharacterCellGeometry(actor.sprite,{geometry:p.geometry},zoom);actor.sprite.position.set(170+col*330,180+row*210);app.stage.addChild(actor.sprite);
  }app.render();return {frames,sequences,coveredCells:covered.size,route,failures,diagnostics:bundle.getDiagnostics(),zoomColumns:[2,4,6],actionFrameRows:[[0,0],[0,1],[2,0],[2,1],[14,0],[14,1]],disclaimer:'Real isolated runtime renderer, not normal-game navigation acceptance'};
 },{prefix});
 await page.screenshot({path:out+'/actual-pixi-2x-4x-6x.png',fullPage:true});assert.deepEqual(result.failures,[]);assert.deepEqual(errors,[]);assert.equal(result.diagnostics.textureCount,83);assert.equal(result.coveredCells,83);assert.equal(result.sequences,53);assert.ok(network.some(n=>n.url.endsWith('/'+prefix+'main.png')&&n.status===200));assert.ok(network.some(n=>n.url.endsWith('/'+prefix+'sub.png')&&n.status===200));assert.ok(!network.some(n=>n.url.includes('battle-packed-20261013')));
 await fs.writeFile(out+'/renderer-result.json',JSON.stringify({status:'PASS_ISOLATED_ACTUAL_PIXI_RUNTIME',...result,network,pageErrors:errors,normalGameNavigation:'NOT_RUN'},null,2));
}catch(error){await fs.writeFile(out+'/renderer-failure.json',JSON.stringify({status:'FAIL',error:String(error),pageErrors:errors},null,2));await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close()}
