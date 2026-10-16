// Candidate-only actual PIXI. Run from the repo with its existing Playwright install.
import {chromium} from 'playwright';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const [base,prefix,out='qa035-idle']=process.argv.slice(2);assert.ok(base&&prefix,'BASE_URL FIXTURE_PREFIX OUTPUT_DIR required');assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1300,height:940},deviceScaleFactor:1});const errors=[],network=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>network.push({url:r.url(),status:r.status()}));
try{
 await page.goto(new URL(prefix+'index.html',base).href);
 const setup=await page.evaluate(async({base,prefix})=>{
  const PIXI=await import(new URL('node_modules/pixi.js/dist/pixi.mjs',base).href);
  const {createNativeCharacterAnimationTimeline}=await import(new URL('src/championship/presentation/characterAnimationTimeline.js',base).href);
  const {applyNativeCharacterCellGeometry}=await import(new URL('src/championship/presentation/nativeHuntCharacterAction.js',base).href);
  const response=await fetch(new URL(prefix+'manifest.json',base));if(!response.ok)throw Error('MANIFEST_HTTP');const m=await response.json();
  if(m.scope!=='CANDIDATE_ONLY_TWO_FRAME_IDLE_NOT_RUNTIME_ACCEPTANCE'||JSON.stringify(m.logicalOrigin)!=='[27,38]'||JSON.stringify(m.sequence.frames.map(x=>x.ticks))!=='[31,22]'||m.sequence.playbackMode!==2)throw Error('FIXTURE_CONTRACT');
  const app=new PIXI.Application();await app.init({width:1280,height:900,background:0x1d2630,autoStart:false,antialias:false,resolution:1});document.body.replaceChildren(app.canvas);const textures={};
  for(const a of m.assets){const url=new URL(prefix+a.path,base).href;const r=await fetch(url);if(!r.ok)throw Error('PNG_HTTP');const bytes=await r.arrayBuffer();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(digest!==a.sha256)throw Error('PNG_HASH');const t=await PIXI.Assets.load(url);t.source.scaleMode='nearest';if(t.width!==64*a.density||t.height!==64*a.density)throw Error('PNG_SIZE');textures[a.group+'-'+a.frame]=t;}
  const timeline=createNativeCharacterAnimationTimeline(m.sequence),actors=[];
  for(const [row,group] of ['current','candidate'].entries())for(const [col,zoom] of m.zooms.entries()){
   const density=group==='current'?4:8,origin=[27*density,38*density],ground={x:40+col*410+27*zoom,y:60+row*430+38*zoom};
   const g=new PIXI.Graphics().rect(ground.x-27*zoom,ground.y-38*zoom,64*zoom,64*zoom).fill(col%2?0xe6dfd1:0x283b49).moveTo(ground.x-27*zoom,ground.y).lineTo(ground.x+37*zoom,ground.y).stroke({color:0x55cbbc,width:1}).moveTo(ground.x,ground.y-6).lineTo(ground.x,ground.y+6).stroke({color:0xff5566,width:1});app.stage.addChild(g);
   const s=new PIXI.Sprite(textures[group+'-0']);app.stage.addChild(s);s.position.set(ground.x,ground.y);applyNativeCharacterCellGeometry(s,{geometry:{scale:density,origin,sourceSize:[64*density,64*density]}},zoom);
   const label=new PIXI.Text({text:group+' | native '+zoom+'x',style:{fontSize:16,fill:0xffffff}});label.position.set(60+col*410,16+row*430);app.stage.addChild(label);actors.push({s,group,density,zoom,ground});
  }
  let tick=0;const samples=[];
  function sample(){const snap=timeline.getSnapshot(),expected=tick%53<31?0:1;if(snap.cell!==expected)throw Error('TICK_TRANSITION');for(const a of actors){a.s.texture=textures[a.group+'-'+snap.cell];if(a.s.anchor.x!==27/64||a.s.anchor.y!==38/64||Math.abs(a.s.scale.x-a.zoom*a.s.texture.source.resolution/a.density)>1e-9||a.s.x!==a.ground.x||a.s.y!==a.ground.y)throw Error('PIVOT_SCALE_ROOT_DRIFT');}app.render();const entry={tick,cell:snap.cell,elapsedQ12:snap.elapsedQ12};samples.push(entry);return entry;}
  globalThis.__qa035={advanceTo(target){while(tick<target){timeline.advanceNative(4096);tick++;sample();}return sample();},result(){return {samples,assets:m.assets,registration:m.registration,contactMeasurements:m.contactMeasurements,rawAlphaNotes:m.rawAlphaNotes,scope:m.scope};}};sample();return {scope:m.scope,zooms:m.zooms,origin:m.logicalOrigin};
 },{base,prefix});
 for(const tick of [0,30,31,52,53,84,106]){await page.evaluate(t=>globalThis.__qa035.advanceTo(t),tick);await page.screenshot({path:out+`/035-idle-tick-${String(tick).padStart(3,'0')}.png`,fullPage:true});}
 const result=await page.evaluate(()=>globalThis.__qa035.result());assert.deepEqual(errors,[]);assert.equal(network.filter(x=>x.url.includes('/assets/production/')).length,0,'No live runtime loads or replacement');
 await fs.writeFile(out+'/renderer-result.json',JSON.stringify({status:'PASS_ISOLATED_TWO_FRAME_RENDERER_ONLY',...setup,...result,pageErrors:errors,network,limits:['Not 80 cells/53 sequences','Not normal game integration','Provisional common registration','Visual anatomy/alpha/contact review required','Nominal60Hz ticks stepped deterministically, not GPU wall-time equivalence']},null,2));
}catch(e){await fs.writeFile(out+'/renderer-failure.json',JSON.stringify({error:String(e),errors,network},null,2));await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
