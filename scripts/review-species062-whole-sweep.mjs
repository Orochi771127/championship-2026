// Complete-bank candidate-only native timeline and actual Pixi render proof.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const [base,out='.tmp/browser-qa/species062-whole-bank']=process.argv.slice(2);
assert.ok(base&&['localhost','127.0.0.1'].includes(new URL(base).hostname));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:896,height:444},deviceScaleFactor:2});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(new URL('tests/fixtures/species062-whole-bank/index.html',base).href);
 const result=await page.evaluate(async({base})=>{
  const checked=(x,m)=>{if(!x)throw Error(m)},prefix='tests/fixtures/species062-whole-bank/';
  const json=async p=>{const r=await fetch(new URL(p,base));checked(r.ok,'HTTP '+p);return r.json()};
  const manifest=await json(prefix+'manifest.json'),contract=await json(prefix+'NUMERIC_MOTION_CONTRACT.json');
  const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
  for(const f of manifest.bankFiles){const r=await fetch(new URL(prefix+'bank/'+f.file,base));checked(r.ok,'BANK_HTTP');checked(await hash(await r.arrayBuffer())===f.sha256,'BANK_HASH '+f.file);}
  const PIXI=await import(new URL('node_modules/pixi.js/dist/pixi.mjs',base));
  const {loadPixiCharacterRuntimeBundle}=await import(new URL('src/championship/presentation/pixiCharacterRuntimeBundle.js',base));
  const {createNativeCharacterAnimationTimeline}=await import(new URL('src/championship/presentation/characterAnimationTimeline.js',base));
  const {applyNativeCharacterCellGeometry}=await import(new URL('src/championship/presentation/nativeHuntCharacterAction.js',base));
  const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl:new URL(prefix+'bank/runtime.review.json',base).href,sides:['main','sub'],cachePrefix:'whole-sweep:'});
  const runtime=bundle.runtime;checked(runtime.artProfile.reviewOnly===true&&runtime.artProfile.runtimeEligible===false,'REVIEW_GATE');
  checked(bundle.getDiagnostics().textureCount===81,'81_TEXTURES');
  const app=new PIXI.Application();await app.init({width:896,height:444,resolution:2,antialias:false,backgroundAlpha:0,preference:'webgl'});app.stop();
  document.body.replaceChildren(app.canvas);document.body.style.margin='0';
  const geometry=runtime.reviewGeometry,sequenceReports=[],cellBindings=new Map();
  const alphaMeasurements=[],atlasFrames=new Map();
  const rect=r=>r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
  function checkTexture(key,texture){
   const a=atlasFrames.get(key);checked(a&&texture.trim,'PIXI_TRIM_REQUIRED '+key);
   const r=a.resolution,f=a.frame,s=a.spriteSourceSize;
   const expected={frame:{x:f.x/r,y:f.y/r,width:f.w/r,height:f.h/r},orig:{x:0,y:0,width:256/r,height:256/r},trim:{x:s.x/r,y:s.y/r,width:s.w/r,height:s.h/r}};
   const actual={frame:rect(texture.frame),orig:rect(texture.orig),trim:rect(texture.trim)};
   checked(texture.source.resolution===r&&texture.rotate===0,'PIXI_ATLAS_RESOLUTION_OR_ROTATION '+key);
   checked(JSON.stringify(actual)===JSON.stringify(expected),'PIXI_ATLAS_RECTANGLES '+key);
   return{...actual,resolution:r,alphaBounds:a.alphaBounds,halfAlphaBounds:a.halfAlphaBounds};
  }
  for(const side of ['main','sub'])for(const page of runtime.sides[side].atlases){
   const atlas=await json(prefix+'bank/'+page.data);const response=await fetch(new URL(prefix+'bank/'+page.image,base));checked(response.ok,'ATLAS_IMAGE_HTTP');
   const bitmap=await createImageBitmap(await response.blob());const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();
   const resolution=Number(atlas.meta.scale);checked(Number.isFinite(resolution)&&resolution>0,'ATLAS_RESOLUTION');
   for(const [key,meta]of Object.entries(atlas.frames)){
    const f=meta.frame,s=meta.spriteSourceSize,o=meta.sourceSize;
    checked(!atlasFrames.has(key)&&meta.trimmed===true&&meta.rotated===false,'TRIMMED_ATLAS_REQUIRED '+key);
    checked(o?.w===256&&o.h===256&&f&&s&&[f.x,f.y,f.w,f.h,s.x,s.y,s.w,s.h].every(Number.isInteger),'ATLAS_RECT_INTEGERS '+key);
    checked(f.x>=0&&f.y>=0&&f.w>0&&f.h>0&&f.x+f.w<=c.width&&f.y+f.h<=c.height&&s.x>=0&&s.y>=0&&s.w===f.w&&s.h===f.h&&s.x+s.w<=256&&s.y+s.h<=256,'ATLAS_RECT_BOUNDS '+key);
    // Reconstruct the untouched256px source canvas from the packed rectangle.
    // No rescale, draw-time translation, alpha thresholding or re-grounding.
    const packed=ctx.getImageData(f.x,f.y,f.w,f.h).data,d=new Uint8ClampedArray(256*256*4);
    for(let y=0;y<f.h;y++)d.set(packed.subarray(y*f.w*4,(y+1)*f.w*4),((s.y+y)*256+s.x)*4);
    let x0=256,y0=256,x1=0,y1=0,ax0=256,ay0=256,ax1=0,ay1=0;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
     const a=d[(y*256+x)*4+3];if(a>0){ax0=Math.min(ax0,x);ay0=Math.min(ay0,y);ax1=Math.max(ax1,x+1);ay1=Math.max(ay1,y+1);}
     if(a>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
    }
    const alphaBounds=[ax0,ay0,ax1,ay1];checked(JSON.stringify(alphaBounds)===JSON.stringify([s.x,s.y,s.x+s.w,s.y+s.h]),'TIGHT_NONZERO_ALPHA_TRIM '+key);
    const bounds=[x0,y0,x1,y1],native=bounds.map((v,i)=>(v-(i%2===0?112:148))/4);
    checked(JSON.stringify(native)===JSON.stringify(geometry.frames[key].nativeBounds),'HALF_ALPHA_GEOMETRY '+key);
    checked(JSON.stringify(geometry.frames[key].sourceSize)==='[256,256]'&&JSON.stringify(geometry.frames[key].origin)==='[112,148]','UNTRIMMED_SOURCE_ORIGIN '+key);
    atlasFrames.set(key,{frame:f,spriteSourceSize:s,resolution,alphaBounds,halfAlphaBounds:bounds});
    alphaMeasurements.push({key,bounds,nativeBounds:native,alphaBounds,frame:f,spriteSourceSize:s,sourceSize:o,trimmed:true,reconstructedDecodedRgbaSha256:await hash(d.buffer)});
   }
  }
  checked(alphaMeasurements.length===81,'81_GEOMETRY_CHECKS');

  for(const item of contract){
   const sequence=runtime.sides[item.side].animations.find(a=>a.id===item.id);
   checked(sequence.playbackMode===item.mode&&JSON.stringify(sequence.frames.map(f=>[f.cell,f.ticks]))===JSON.stringify(item.frames),'NUMERIC_CONTRACT');
   const actor=bundle.createActor({side:item.side,animation:item.id,nativeFramePresentation:true,nativeGeometry:geometry,nativeSequence:true});
   const total=item.frames.reduce((s,f)=>s+f[1],0);let boundaries=[0],sum=0;for(const f of item.frames){sum+=f[1];boundaries.push(sum-1,sum)}boundaries.push(total+1);if(item.mode===2)boundaries.push(total*2,total*2+1);
   const unique=[...new Set(boundaries)].sort((a,b)=>a-b),samples=[];let frameIndex=0,remaining=item.frames[0][1];
   for(let tick=0;tick<=unique.at(-1);tick++){
    const snap=actor.sequencePlayer.getSnapshot();
    const phase=item.mode===2?tick%total:Math.min(tick,total-1);let t=phase,expected=item.frames.at(-1)[0];for(const [cell,duration]of item.frames){if(t<duration){expected=cell;break}t-=duration;}
    checked(snap.cell===expected,'SEQUENCE_CELL '+item.side+item.id+' tick'+tick);checked(snap.active===(item.mode===1&&tick>=total?0:1),'NUMERIC_ACTIVE');
    const presentation=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:item.id,frameIndex:snap.frameIndex,flipBits:0});applyNativeCharacterCellGeometry(actor.sprite,presentation,1);
    checked(actor.sprite.anchor.x===112/256&&actor.sprite.anchor.y===148/256,'ORIGIN');checked(actor.sprite.scale.x===actor.sprite.texture.source.resolution/4,'DENSITY');
    if(unique.includes(tick))samples.push({tick,cell:snap.cell,frameIndex:snap.frameIndex,active:snap.active,texture:snap.texture,geometry:presentation.geometry});
    actor.sequencePlayer.advanceNative(4096);
   }
   for(let fi=0;fi<sequence.frames.length;fi++){const f=sequence.frames[fi];cellBindings.set(f.texture,{side:item.side,cell:f.cell,sequence:item.id,frameIndex:fi});}
   sequenceReports.push({side:item.side,id:item.id,mode:item.mode,totalTicks:total,samples});actor.sprite.destroy({texture:false,textureSource:false});
  }
  checked(sequenceReports.length===53&&cellBindings.size===81,'COMPLETE_SWEEP');
  const sheets=[],samples=[];
  const groups=[['main',0,20],['main',21,41],['main',42,62],['sub',0,17]];
  for(const [side,start,end]of groups){
   app.stage.removeChildren().forEach(c=>c.destroy({children:true,texture:false,textureSource:false}));
   for(let cell=start;cell<=end;cell++){
    const i=cell-start,x=i%7*128,y=Math.floor(i/7)*148,key=`m237_renamon/${side}/cell_${String(cell).padStart(3,'0')}`,binding=cellBindings.get(key);checked(binding,'CELL_REFERENCED');
    const bg=new PIXI.Graphics().rect(x,y,64,148).fill(0xece9e2).rect(x+64,y,64,148).fill(0x233241);app.stage.addChild(bg);
    const label=new PIXI.Text({text:`${side} ${String(cell).padStart(3,'0')}`,style:{fontFamily:'Arial',fontSize:10,fill:0x111111}});label.position.set(x+4,y+3);app.stage.addChild(label);
    const actor=bundle.createActor({side,animation:binding.sequence,nativeFramePresentation:true,nativeGeometry:geometry});
    const f=actor.nativeFramePresenter.apply({contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:binding.sequence,frameIndex:binding.frameIndex,flipBits:0});applyNativeCharacterCellGeometry(actor.sprite,f,2);
    // Same native display factor2 observed in actual Raising context. Full cell128 CSS,256 physical atDPR2.
    actor.sprite.position.set(x+56,y+20+74);app.stage.addChild(actor.sprite);
    checked(actor.sprite.texture.source.scaleMode==='nearest','FILTER');const g=f.geometry;checked(JSON.stringify(g.sourceSize)==='[256,256]'&&JSON.stringify(g.origin)==='[112,148]','CELL_GEOMETRY');
    app.render();
    // Read the actual stage cell, not generateTexture(target:sprite), whose
    // local-bounds extraction loses positioned atlas sprites in this Pixi build.
    const probe=document.createElement('canvas');probe.width=probe.height=256;const pc=probe.getContext('2d',{willReadFrequently:true});
    pc.drawImage(app.canvas,x*2,(y+20)*2,256,256,0,0,256,256);const px=pc.getImageData(0,0,256,256).data;
    checked(px.length===256*256*4,'PIXEL_READBACK');
    for(const j of [0,255,65280,65535]){const bg=j%256<128?[236,233,226]:[35,50,65],o=j*4;checked(px[o]===bg[0]&&px[o+1]===bg[1]&&px[o+2]===bg[2]&&px[o+3]===255,'CELL_BACKGROUND_READBACK');}
    let nonblank=0;
    for(let j=0;j<65536;j++){const bg=j%256<128?[236,233,226]:[35,50,65],o=j*4;
     if(px[o+3]>0&&(px[o]!==bg[0]||px[o+1]!==bg[1]||px[o+2]!==bg[2]))nonblank++;}
    checked(nonblank>0,'NONBLANK '+key);
    const texture=checkTexture(key,actor.sprite.texture);
    samples.push({side,cell,key,scale:[actor.sprite.scale.x,actor.sprite.scale.y],geometry:g,texture,visiblePixelCount:nonblank,bounds:actor.sprite.getBounds().rectangle??actor.sprite.getBounds()});
   }
   app.render();sheets.push({name:`${side}-${String(start).padStart(3,'0')}-${String(end).padStart(3,'0')}-actualscale.png`,png:app.canvas.toDataURL('image/png').split(',')[1]});
  }
  checked(samples.length===81&&sheets.length===4,'SHEET_BUDGET');
  const report={status:'NUMERIC_AND_RENDER_BINDINGS_PASS_VISUAL_REVIEW_PENDING',sequenceReports,samples,alphaMeasurements,logicalCanvas:[64,64],origin:[112,148],density:4,renderer:{resolution:app.renderer.resolution,css:[896,444],canvas:[app.canvas.width,app.canvas.height],nativeDisplayFactor:2,fullCellCss:[128,128],fullCellPhysical:[256,256]},files:manifest.bankFiles,limits:['Four sheets are actual Pixi samples at native display factor2; not game scene context','Trim is tight alpha>0 packaging only; orig256/source origin112148 and alpha>=128 native geometry are separately asserted','Reconstructed RGBA hashes describe browser-decoded pixels, not an independent prepack source equality proof','No per-frame fit, no shared offset, no atlas mutation','Native numeric playback, not legacy generic English labels, is asserted']};
  return{report,sheets};
 },{base});
 assert.deepEqual(errors,[]);for(const s of result.sheets)await fs.writeFile(`${out}/${s.name}`,Buffer.from(s.png,'base64'));await fs.writeFile(`${out}/SWEEP_REPORT.json`,JSON.stringify(result.report,null,2));
}catch(error){await fs.writeFile(`${out}/SWEEP_FAILURE.json`,JSON.stringify({error:String(error),stack:error.stack},null,2));throw error;}finally{await browser.close();}
