// Bounded PR47 actual-Pixi fixture adaptation. Existing 035/041 gates are unchanged.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='qa062-actions-resolution']=process.argv.slice(2);assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {for(const dpr of [1,2,3]){
 const page=await browser.newPage({viewport:{width:720,height:1220},deviceScaleFactor:dpr});const errors=[],network=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>network.push({url:r.url(),status:r.status()}));
 await page.goto(new URL('tests/fixtures/species062-actions-resolution/index.html',base).href);
 const setup=await page.evaluate(async({base,dpr})=>{
  const PIXI=await import(new URL('node_modules/pixi.js/dist/pixi.mjs',base));
  const {createNativeCharacterAnimationTimeline,nativeAnimationCellAt}=await import(new URL('src/championship/presentation/characterAnimationTimeline.js',base));
  const {applyNativeCharacterCellGeometry,createNativeHuntCharacterFramePresenter}=await import(new URL('src/championship/presentation/nativeHuntCharacterAction.js',base));
  const {resolutionFor}=await import(new URL('src/championship/presentation/championshipPixiStage.js',base));
  const {QUALITY_TIERS}=await import(new URL('src/championship/presentation/presentationPreferences.js',base));
  const prefix='tests/fixtures/species062-actions-resolution/',response=await fetch(new URL(prefix+'manifest.json',base));if(!response.ok)throw Error('MANIFEST_HTTP');const m=await response.json();
  if(m.scope!=='FOUR_FRAME_062_RESOLUTION_COMPARISON_NOT_RUNTIME_ACCEPTANCE'||m.assets.length!==8||m.facing!=='LEFT'||JSON.stringify(m.logicalOrigin)!=='[28,37]'||JSON.stringify(m.logicalCanvas)!=='[64,64]'||JSON.stringify(m.zooms)!=='[2,4]')throw Error('FIXTURE_SCOPE');
  if(JSON.stringify(m.sequences.map(s=>[s.id,s.playbackMode,s.frames.map(f=>[f.cell,f.ticks])]))!==JSON.stringify([[7,1,[[11,15],[12,37]]],[14,2,[[24,25],[25,31]]]]))throw Error('NATIVE_SEQUENCE_CONTRACT');
  const quality=QUALITY_TIERS.balanced,resolution=resolutionFor(quality.pixiResolutionCap,dpr),app=new PIXI.Application();await app.init({width:720,height:1220,resolution,autoDensity:true,background:0x233441,autoStart:false,antialias:quality.pixiAntialias,preference:'webgl'});document.body.replaceChildren(app.canvas);
  const variants=[{name:'128 d2 NEAREST baseline',group:'d2',density:2,filter:'nearest'},{name:'256 d4 NEAREST comparison',group:'d4',density:4,filter:'nearest'},{name:'128 d2 LINEAR diagnostic',group:'d2',density:2,filter:'linear'},{name:'256 d4 LINEAR diagnostic',group:'d4',density:4,filter:'linear'}],textures={},actors=[],samples=[];
  for(const [vi,v] of variants.entries())for(const a of m.assets.filter(x=>x.group===v.group)){
   const url=new URL(prefix+a.path+'?variant='+vi,base).href,r=await fetch(url);if(!r.ok)throw Error('ASSET_HTTP');const bytes=await r.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==a.sha256)throw Error('ASSET_HASH');
   const t=await PIXI.Assets.load(url);t.source.scaleMode=v.filter;if(t.width!==64*v.density||t.height!==64*v.density)throw Error('ASSET_SIZE');textures[vi+'-'+a.cell]=t;
  }
  for(const [row,v] of variants.entries())for(const [col,zoom] of m.zooms.entries()){
   const panel=new PIXI.Container();panel.position.set(col*360,row*300+20);app.stage.addChild(panel);const g=new PIXI.Graphics();panel.addChild(g);const ground={x:150.375,y:190.375};const s=new PIXI.Sprite(textures[row+'-11']);panel.addChild(s);s.position.set(ground.x,ground.y);
   const text=new PIXI.Text({text:v.name+'\nzoom'+zoom+' | CSS cell '+64*zoom+'px',style:{fontSize:12,fill:0xffffff}});text.position.set(8,4);panel.addChild(text);
   const geometry={frames:Object.fromEntries(Object.entries(m.geometry.frames).map(([key,value])=>[key,{...value,scale:v.density,origin:m.logicalOrigin.map(x=>x*v.density),sourceSize:[64*v.density,64*v.density]}]))};const presenter=createNativeHuntCharacterFramePresenter({sprite:s,animations:m.sequences,textureResolver:key=>textures[row+'-'+Number(key.split('_').at(-1))],entityId:'m237_renamon',geometry});actors.push({s,g,ground,v,zoom,presenter});
  }
  let sequence,timeline,tick;function reset(id){sequence=m.sequences.find(s=>s.id===id);if(!sequence)throw Error('SEQUENCE');timeline=createNativeCharacterAnimationTimeline(sequence);tick=0;}
  function sample(target,{mirror=false,phase=0,bg='dark'}={}){
   if(target<tick)throw Error('BACKWARD_TICK');while(tick<target){timeline.advanceNative(4096);tick++;}const snap=timeline.getSnapshot();if(snap.cell!==nativeAnimationCellAt(sequence,tick))throw Error('TICK_CELL');if(sequence.id===7&&tick>=52&&snap.active!==0)throw Error('ATTACK_DID_NOT_HOLD');if(sequence.id===14&&snap.active!==1)throw Error('EAT_DID_NOT_LOOP');
   for(const a of actors){a.g.clear().rect(4,36,352,260).fill(bg==='light'?0xf0e8d8:0x1c2733).moveTo(4,a.ground.y).lineTo(356,a.ground.y).stroke({width:.5,color:0x4fbba3}).moveTo(a.ground.x,a.ground.y-4).lineTo(a.ground.x,a.ground.y+4).stroke({width:.5,color:0xff5555});const f=a.presenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:sequence.id,frameIndex:snap.frameIndex,flipBits:mirror?1:0});applyNativeCharacterCellGeometry(a.s,f,a.zoom);a.s.scale.x*=f.flipX?-1:1;a.s.position.set(a.ground.x+phase,a.ground.y);
    if(a.s.anchor.x!==28/64||a.s.anchor.y!==37/64||Math.abs(Math.abs(a.s.scale.x)-a.zoom*a.s.texture.source.resolution/a.v.density)>1e-9||a.s.y!==a.ground.y||a.s.texture.source.scaleMode!==a.v.filter)throw Error('GEOMETRY_FILTER_DRIFT');if(Math.abs(a.s.width-64*a.zoom)>1e-6||Math.abs(a.s.height-64*a.zoom)>1e-6)throw Error('LOGICAL_FOOTPRINT_CHANGED');}
   app.render();const record={sequence:sequence.id,tick,cell:snap.cell,active:snap.active,mirror,phase,bg,actors:actors.map(a=>({variant:a.v.name,density:a.v.density,filter:a.s.texture.source.scaleMode,zoom:a.zoom,anchor:[a.s.anchor.x,a.s.anchor.y],position:[a.s.x,a.s.y],scale:[a.s.scale.x,a.s.scale.y],cssLocalFootprint:[a.s.width,a.s.height]}))};samples.push(record);return record;
  }
  reset(7);sample(0);globalThis.__qa062resolution={reset,sample,result:()=>({samples,assets:m.assets,canvas:{width:app.canvas.width,height:app.canvas.height,cssWidth:app.canvas.clientWidth,cssHeight:app.canvas.clientHeight},renderer:app.renderer.name,rendererResolution:app.renderer.resolution,deviceDpr:globalThis.devicePixelRatio,quality:{name:'balanced',...quality},webglVersion:app.renderer.context?.webGLVersion,notes:m.notes})};return {pixi:PIXI.VERSION,dpr,resolution,zooms:m.zooms,scope:m.scope};
 },{base,dpr});
 for(const [sequence,ticks] of [[7,[0,14,15,51,52,100]],[14,[0,24,25,55,56,81,112]]]){
  await page.evaluate(id=>__qa062resolution.reset(id),sequence);for(const tick of ticks){await page.evaluate(t=>__qa062resolution.sample(t),tick);if((sequence===7&&[0,15,52].includes(tick))||(sequence===14&&[0,25,56].includes(tick)))await page.screenshot({path:`${out}/dpr${dpr}-seq${sequence}-tick${tick}.png`,timeout:30000});}
 }
 await page.evaluate(()=>{__qa062resolution.reset(7);__qa062resolution.sample(15,{mirror:true,phase:.5,bg:'light'});});await page.screenshot({path:`${out}/dpr${dpr}-mirror-subpixel-light.png`,timeout:30000});
 const result=await page.evaluate(()=>__qa062resolution.result());assert.deepEqual(errors,[]);assert.equal(network.filter(x=>x.url.includes('/assets/production/')).length,0,'No production asset loads');assert.equal(result.rendererResolution,Math.min(dpr,2));assert.equal(result.canvas.width,720*Math.min(dpr,2));assert.equal(result.canvas.cssWidth,720);await fs.writeFile(`${out}/dpr${dpr}-renderer-result.json`,JSON.stringify({status:'PASS_ACTUAL_PIXI_CONTRACTS_ONLY_VISUAL_REVIEW_REQUIRED',...setup,...result,pageErrors:errors,network,limits:['No game integration or shipping approval','Four action frames only','Chromium DPR emulation is not physical iOS/WebKit','Zoom4 is diagnostic, not verified live scene scale','Linear rows are diagnostic, not current character policy']},null,2));await page.close();
}}finally{await browser.close();}
