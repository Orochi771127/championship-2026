// Bounded adaptation of PR47's actual-Pixi idle-candidate runner. No game replacement.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='qa041-clarity']=process.argv.slice(2);assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {for(const dpr of [1,2,3]){
 const page=await browser.newPage({viewport:{width:1000,height:540},deviceScaleFactor:dpr});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(new URL('tests/fixtures/species041-clarity/index.html',base).href);
 const setup=await page.evaluate(async({base,dpr})=>{
  const PIXI=await import(new URL('node_modules/pixi.js/dist/pixi.mjs',base));
  const {createNativeCharacterAnimationTimeline,nativeAnimationCellAt}=await import(new URL('src/championship/presentation/characterAnimationTimeline.js',base));
  const {applyNativeCharacterCellGeometry,createNativeHuntCharacterFramePresenter}=await import(new URL('src/championship/presentation/nativeHuntCharacterAction.js',base));
  const prefix='tests/fixtures/species041-clarity/',m=await(await fetch(new URL(prefix+'manifest.json',base))).json();
  if(m.scope!=='SIX_FRAME_041_CLARITY_ONLY_NOT_SHIPPING_APPROVAL'||m.assets.length!==12||JSON.stringify(m.logicalOrigin)!=='[26,41]')throw Error('FIXTURE_SCOPE');
  const app=new PIXI.Application();await app.init({width:1000,height:540,resolution:dpr,autoDensity:true,background:0x233441,autoStart:false,antialias:false,preference:'webgl'});document.body.replaceChildren(app.canvas);
  const variants=[{name:'current256 nearest',group:'current',filter:'nearest',density:4},{name:'own-source128 nearest',group:'candidate',filter:'nearest',density:2},{name:'own-source128 linear',group:'candidate',filter:'linear',density:2}],textures={},actors=[],samples=[];
  for(const [v,variant] of variants.entries())for(const a of m.assets.filter(x=>x.group===variant.group)){
   const url=new URL(prefix+a.path+'?variant='+v,base).href,r=await fetch(url),bytes=await r.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==a.sha256)throw Error('ASSET_HASH');
   const t=await PIXI.Assets.load(url);t.source.scaleMode=variant.filter;if(t.width!==64*a.density||t.height!==64*a.density)throw Error('SIZE');textures[v+'-'+a.cell]=t;
  }
  for(const [row,variant] of variants.entries())for(const [col,zoom] of m.zooms.entries()){
   const panel=new PIXI.Container();panel.position.set(col*330,row*170);app.stage.addChild(panel);
   const g=new PIXI.Graphics();panel.addChild(g);const ground={x:110.375,y:140.375};
   const s=new PIXI.Sprite(textures[row+'-0']);panel.addChild(s);s.position.set(ground.x,ground.y);
   const label=new PIXI.Text({text:variant.name+' | '+zoom+' CSS/native',style:{fontSize:13,fill:0xffffff}});label.position.set(8,4);panel.addChild(label);
   const geometry={frames:Object.fromEntries(Object.entries(m.geometry.frames).map(([key,value])=>[key,{...value,scale:variant.density,origin:m.logicalOrigin.map(x=>x*variant.density),sourceSize:[64*variant.density,64*variant.density]}]))};
   const presenter=createNativeHuntCharacterFramePresenter({sprite:s,animations:m.sequences,textureResolver:key=>textures[row+'-'+Number(key.split('_').at(-1))],entityId:'m209_kamemon',geometry});actors.push({s,g,ground,variant,zoom,presenter});
  }
  function background(kind){for(const a of actors){const {g,ground,zoom}=a;g.clear();if(kind==='checker'){for(let y=25;y<165;y+=10)for(let x=5;x<325;x+=10)g.rect(x,y,10,10).fill(((x+y)/10)%2?0xa3bfd0:0x5a8cab);}else g.rect(5,25,320,140).fill(kind==='light'?0xf0e8d8:0x1c2733);g.moveTo(5,ground.y).lineTo(325,ground.y).stroke({width:.5,color:0x4fbba3});g.moveTo(ground.x,ground.y-4).lineTo(ground.x,ground.y+4).stroke({width:.5,color:0xff5555});}}
  let sequence,timeline,tick;
  function reset(id){sequence=m.sequences.find(s=>s.id===id);timeline=createNativeCharacterAnimationTimeline(sequence);tick=0;}
  function sample(target,{mirror=false,phase=0,bg='checker'}={}){if(target<tick)throw Error('BACKWARD_TICK');while(tick<target){timeline.advanceNative(4096);tick++;}const snap=timeline.getSnapshot();if(snap.cell!==nativeAnimationCellAt(sequence,tick))throw Error('NATIVE_TICK_MISMATCH');background(bg);
   for(const a of actors){const f=a.presenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:sequence.id,frameIndex:snap.frameIndex,flipBits:mirror?1:0});applyNativeCharacterCellGeometry(a.s,f,a.zoom);a.s.scale.x*=f.flipX?-1:1;a.s.position.set(a.ground.x+phase,a.ground.y);if(a.s.anchor.x!==26/64||a.s.anchor.y!==41/64||Math.abs(a.s.scale.x)!==a.zoom/a.variant.density||a.s.y!==a.ground.y||a.s.texture.source.scaleMode!==a.variant.filter)throw Error('GEOMETRY_OR_FILTER_DRIFT');}
   app.render();const record={sequence:sequence.id,tick,cell:snap.cell,mirror,phase,bg,actors:actors.map(a=>({variant:a.variant.name,density:a.variant.density,filter:a.s.texture.source.scaleMode,zoom:a.zoom,anchor:[a.s.anchor.x,a.s.anchor.y],position:[a.s.x,a.s.y],scale:[a.s.scale.x,a.s.scale.y]}))};samples.push(record);return record;}
  reset(0);sample(0);globalThis.__qa041={reset,sample,result:()=>({samples,canvas:{width:app.canvas.width,height:app.canvas.height,cssWidth:app.canvas.clientWidth,cssHeight:app.canvas.clientHeight},renderer:app.renderer.name,webglVersion:app.renderer.context?.webGLVersion,notes:m.notes})};return {pixi:PIXI.VERSION,dpr,zooms:m.zooms};
 },{base,dpr});
 for(const [sequence,ticks] of [[0,[0,30,31,52,53,84,106]],[2,[0,14,15,26,27,42,54]],[4,[0,37]],[6,[0,7]]]){await page.evaluate(id=>__qa041.reset(id),sequence);for(const tick of ticks){await page.evaluate(({tick})=>__qa041.sample(tick),{tick});await page.screenshot({path:`${out}/dpr${dpr}-seq${sequence}-tick${tick}.png`});}}
 for(const bg of ['light','dark']){await page.evaluate(bg=>{__qa041.reset(0);__qa041.sample(0,{bg});},bg);await page.screenshot({path:`${out}/dpr${dpr}-${bg}.png`});}
 await page.evaluate(()=>{__qa041.reset(2);for(let tick=0;tick<108;tick++)__qa041.sample(tick,{phase:(tick%8)/8,mirror:true,bg:'light'});});await page.screenshot({path:`${out}/dpr${dpr}-motion-mirror.png`});
 const result=await page.evaluate(()=>__qa041.result());assert.deepEqual(errors,[]);await fs.writeFile(`${out}/dpr${dpr}-renderer-result.json`,JSON.stringify({status:'PASS_ACTUAL_PIXI_GEOMETRY_TIMING_FILTER_CONTRACTS_ONLY',...setup,...result,pageErrors:errors,limits:['Visual acceptance pending','Chromium DPR simulation is not iOS/WebKit or a physical phone','Only six frames; no production loads or replacement','Subpixel motion is a fixture phase sweep, not game AI']},null,2));await page.close();
}}finally{await browser.close();}
