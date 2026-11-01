// Animation handoff (Owner 2026-11-01). Exact owner-accepted scopes without a style hold
// (GR16 seated sleep, GR18 Bound8) are in the default reviewed selection; scopes whose
// style is not confirmed (GR02/06/08 Walk8) load only from a loopback QA registry behind
// ?animHandoff=1, off by default, never on public hosts and never shipped; so do the
// accepted UL11/UL12 N Walk, partial Arena sets of roles with no reviewed selection. The painted
// art is stored at up to 2x density and drawn with mipmapped linear sampling.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {ANIMATION_HANDOFF_REGISTRY,animationHandoffEnabled,resetAnimationHandoffRegistry,reviewedDocumentRef,handoffOnlyArenaEntry} from '../src/championship/presentation/animationHandoff.js';
import {attachReviewedCharacterAnimation} from '../src/championship/presentation/reviewedCharacterLoader.js';
const root=path.resolve(import.meta.dirname,'..');
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const selection=readJson('src/data/championship/reviewed-animation-selection.v1.json');
const registry=readJson(ANIMATION_HANDOFF_REGISTRY);
const LOOP='http://127.0.0.1:8773/championship.html';
const fileFetch=async url=>{const bytes=fs.readFileSync(path.join(root,new URL(url).pathname));
 return {ok:true,json:async()=>JSON.parse(bytes.toString()),text:async()=>bytes.toString(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};

test('the switch is off by default, loopback-only and read from ?animHandoff=1 alone (nothing is stored)',()=>{
 assert.equal(animationHandoffEnabled(LOOP),false);
 assert.equal(animationHandoffEnabled(LOOP+'?animHandoff=1'),true);
 assert.equal(animationHandoffEnabled(LOOP),false,'dropping the parameter rolls back');
 assert.equal(animationHandoffEnabled(LOOP+'?animHandoff=0'),false);
 assert.equal(animationHandoffEnabled('https://example.github.io/championship.html?animHandoff=1'),false,'public hosts never switch');
 assert.equal(animationHandoffEnabled('http://192.168.1.5:8773/championship.html?animHandoff=1'),false,'LAN hosts never switch');
});

test('the registry is QA-only, never a build input, and each alternative is built on the current manifest',()=>{
 assert.equal(registry.kind,'ANIMATION_HANDOFF_QA_REGISTRY');assert.equal(registry.loopbackOnly,true);
 const inputs=fs.readFileSync(path.join(root,'docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'),'utf8');
 const allow=fs.readFileSync(path.join(root,'docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'),'utf8');
 assert.ok(!inputs.includes(ANIMATION_HANDOFF_REGISTRY)&&!allow.includes(ANIMATION_HANDOFF_REGISTRY));
 assert.deepEqual(registry.entries.map(e=>e.displayCode),['GR02','GR06','GR08','UL11','UL12']);
 for(const e of registry.entries){
  const current=selection.characters.find(c=>c.speciesId===e.speciesId);
  if(e.partialArena){   // a QA-only partial set of a role drawn natively everywhere else
   assert.equal(current,undefined,e.displayCode);assert.equal(e.basePath,null);assert.equal(e.baseSha256,null);
   assert.equal(sha(e.path),e.sha256,e.displayCode);assert.equal(e.runtimeApproved,false);assert.deepEqual(e.scopes,['Walk:N']);
   assert.ok(!inputs.includes(e.path)&&!allow.includes(e.path),e.displayCode+' never ships');continue;
  }
  assert.equal(e.basePath,current.path,e.displayCode);assert.equal(e.baseSha256,current.sha256,e.displayCode+' stale base');
  assert.equal(sha(e.path),e.sha256,e.displayCode);assert.equal(e.runtimeApproved,false);assert.equal(e.status,'OWNER_APPROVED_SCOPED_QA_ONLY');
  assert.ok(!inputs.includes(e.path)&&!allow.includes(e.path),e.displayCode+' handoff manifest never ships');
 }
});

// Every handoff scope, as stored: the QA alternatives and the default selection's authoring web-v3.
const scopes=[...registry.entries.map(e=>({code:e.displayCode,path:e.path,meta:'handoff'})),
 ...['GR16','GR18'].map(code=>({code,path:selection.characters.find(c=>c.displayCode===code).authoringPath,meta:'handoff20261101'}))];
test('handoff clips keep native ticks and leave hit frames, launch points and engine timing unbound',()=>{
 for(const e of scopes){
  const d={...readJson(e.path)};d.handoff=d[e.meta];const clips=d.clips.filter(c=>String(c.source?.handoff)==='20261101');e.displayCode=e.code;
  const frames=Array.isArray(d.frames)?Object.fromEntries(d.frames.map(f=>[f.id,f])):d.frames;
  assert.equal(d.handoff.timebase.sourceHz,60);assert.equal(d.handoff.timebase.engineHzVerified,false);
  for(const k of ['hitFrame','projectileOrigin','worldMotion','enginePivot'])assert.ok(d.handoff.unbound.includes(k),e.displayCode+' '+k);
  for(const c of clips){
   assert.equal(c.loop,true,c.id);
   for(const s of c.frames){const ticks=s.durationMs*60/1000;assert.ok(Math.abs(ticks-Math.round(ticks))<1e-6,c.id+' whole 60 Hz ticks');assert.ok(frames[s.assetId]?.handoffSourceSha256,c.id);
    // painted art: smooth sampling, stored at least at the density-4 game grid
    assert.equal(frames[s.assetId].sampling,'smooth',c.id);assert.ok(frames[s.assetId].density>=4,c.id);}
  }
  if(['UL11','UL12'].includes(e.displayCode)){
   // the accepted N Walk only: heading U, source event order and ticks, the repeated neutral event kept
   const want=e.displayCode==='UL11'?{assets:['A','B','A','C'],ticks:[10,12,10,12],mirror:[false,false,false,true]}:{assets:['0','1','0','2'],ticks:[12,14,12,14],mirror:[false,false,false,false]};
   assert.deepEqual(clips.map(c=>[c.id,c.mode,c.action,c.direction]),[['handoff:arena:U:walk','arena','move','U']]);
   assert.deepEqual(clips[0].source.events.map(x=>x.assetId),want.assets);
   assert.deepEqual(clips[0].frames.map(s=>Math.round(s.durationMs*60/1000)),want.ticks);
   assert.deepEqual(clips[0].frames.map(s=>frames[s.assetId].mirrorX===true),want.mirror,e.displayCode+' only the delivered C flip');
   assert.equal(clips[0].frames[0].assetId,clips[0].frames[2].assetId,'repeated neutral event');
   assert.equal(d.clips.length,1,e.displayCode+' nothing beyond the accepted scope');
  }else if(e.displayCode==='GR16'){
   assert.deepEqual(clips.map(c=>[c.id,c.facingLocked,c.frames.map(f=>Math.round(f.durationMs))]),[['main:13',true,[500,583]]]);
  }else{
   assert.deepEqual(clips.map(c=>c.direction),['D','DR','R','UR','U','UL','L','DL'],e.displayCode);
   // Only GR18's DL/UL are mirrored (Owner 2026-11-01: renderer flip of the unchanged DR/UR images, no mirrored pixels stored).
   const mirrored=new Set(clips.filter(c=>c.frames.some(s=>frames[s.assetId].mirrorX)).map(c=>c.direction));
   assert.deepEqual([...mirrored],e.displayCode==='GR18'?['UL','DL']:[],e.displayCode+' mirrored directions');
   if(e.displayCode==='GR18'){
    const sources=dir=>clips.find(c=>c.direction===dir).frames.map(s=>frames[s.assetId].handoffSourceSha256);
    assert.deepEqual(sources('DL'),sources('DR'));assert.deepEqual(sources('UL'),sources('UR'));
    for(const c of clips){assert.deepEqual(c.frames.map(s=>Math.round(s.durationMs*60/1000)),[6,4,6,6,4,6,4],c.id);
     assert.equal(c.frames.every(s=>frames[s.assetId].mirrorX===true),['UL','DL'].includes(c.direction),c.id);}
   }
   assert.ok(!d.clips.some(c=>c.mode==='arena'&&c.action==='move'&&!String(c.id).startsWith('handoff:')),e.displayCode+' one walk per direction');
  }
 }
});

test('reviewedDocumentRef swaps only when switched on and the base manifest still matches',async()=>{
 const gr02=selection.characters.find(c=>c.displayCode==='GR02'),alt=registry.entries.find(e=>e.displayCode==='GR02');
 resetAnimationHandoffRegistry();
 assert.deepEqual(await reviewedDocumentRef(gr02,LOOP+'?animHandoff=0',fileFetch),{path:gr02.path,sha256:gr02.sha256,handoff:false});
 const on=await reviewedDocumentRef(gr02,LOOP+'?animHandoff=1',fileFetch);
 assert.deepEqual([on.path,on.sha256,on.handoff],[alt.path,alt.sha256,true]);
 const gr05=selection.characters.find(c=>c.displayCode==='GR05');
 assert.equal((await reviewedDocumentRef(gr05,LOOP+'?animHandoff=1',fileFetch)).handoff,false,'roles without a handoff keep the current art');
 resetAnimationHandoffRegistry();
 const stale=async url=>url.endsWith(ANIMATION_HANDOFF_REGISTRY)?{ok:true,json:async()=>({...registry,entries:registry.entries.map(e=>({...e,baseSha256:'0'.repeat(64)}))})}:fileFetch(url);
 assert.equal((await reviewedDocumentRef(gr02,LOOP+'?animHandoff=1',stale)).handoff,false,'an alternative built on an older manifest is ignored');
 resetAnimationHandoffRegistry();
 const missing=async()=>({ok:false});
 assert.equal((await reviewedDocumentRef(gr02,LOOP+'?animHandoff=1',missing)).handoff,false,'a deleted registry rolls back');
 resetAnimationHandoffRegistry();
});

test('default selection: GR16 seated sleep and GR18 Bound8 ship in the public manifest without source metadata',()=>{
 for(const code of ['GR16','GR18']){
  const entry=selection.characters.find(c=>c.displayCode===code);
  assert.equal(sha(entry.path),entry.sha256);assert.equal(sha(entry.authoringPath),entry.authoringSha256);
  assert.match(entry.authoringPath,/animation\.web-v3-20261101\.json$/);
  const pub=readJson(entry.path),aut=readJson(entry.authoringPath),frames=Object.fromEntries(pub.frames.map(f=>[f.id,f]));
  assert.equal(pub.frames.length,Object.keys(aut.frames).length);assert.equal(pub.clips.length,aut.clips.length);
  const clips=pub.clips.filter(c=>String(c.id).startsWith('handoff:')||c.id==='main:13');
  // the added clips/frames carry no source metadata in the public payload (it stays in the authoring web-v3)
  assert.ok(!('handoff'in pub)&&!('handoff20261101'in pub)&&clips.every(c=>!('source'in c)),code);
  assert.ok(pub.frames.every(f=>!('handoffSourceSha256'in f)),code);
  if(code==='GR16')assert.deepEqual(clips.map(c=>[c.id,c.facingLocked,c.frames.map(f=>Math.round(f.durationMs*60/1000))]),[['main:13',true,[30,35]]]);
  else{
   assert.deepEqual(clips.map(c=>c.direction),['D','DR','R','UR','U','UL','L','DL']);
   assert.ok(!pub.clips.some(c=>c.mode==='arena'&&c.action==='move'&&!c.id.startsWith('handoff:')),'one walk per direction');
   const cells=dir=>clips.find(c=>c.direction===dir).frames.map(s=>frames[s.assetId].frame.join());
   assert.deepEqual(cells('DL'),cells('DR'));assert.deepEqual(cells('UL'),cells('UR'));   // the same pixels, flipped by the renderer
   for(const c of clips){assert.deepEqual(c.frames.map(s=>Math.round(s.durationMs*60/1000)),[6,4,6,6,4,6,4],c.id);
    assert.equal(c.frames.every(s=>frames[s.assetId].mirrorX===true),['UL','DL'].includes(c.direction),c.id);}
  }
  for(const c of clips)for(const s of c.frames)assert.equal(frames[s.assetId].sampling,'smooth',c.id);
 }
});

test('GR16 seated sleep plays as ranch main 13 whatever the switch, never mirrored, with mipmapped linear sampling',async()=>{
 const gr16=selection.characters.find(c=>c.displayCode==='GR16');
 const sources=[];
 const PIXI={Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},Texture:class{constructor(o){Object.assign(this,o);}destroy(){}},
  Assets:{async load(url){const source={pixelWidth:2048,pixelHeight:2048,resolution:1,url};sources.push(source);return {source};},async unload(){}}};
 const baseline={runtime:{sides:{main:{animations:[{id:0,frames:[{ticks:60}]},{id:13,frames:[{ticks:30},{ticks:35}]}]},sub:{animations:[]}}},getDiagnostics:()=>({}),async dispose(){},
  createActor(){return {sprite:{texture:{},anchor:{set(x,y){this.x=x;this.y=y;}}},controller:{setAnimation(){},getSnapshot:()=>null},nativeFramePresenter:{apply:()=>({fallback:true})}};}};
 for(const flag of [0,1]){
  resetAnimationHandoffRegistry();sources.length=0;
  const bundle=await attachReviewedCharacterAnimation({bundle:baseline,PIXI,speciesId:gr16.speciesId,usage:'general',baseUrl:`${LOOP}?animHandoff=${flag}`,fetchImpl:fileFetch});
  const s=bundle.createActor({animation:0}).nativeFramePresenter.apply({sequenceId:13,frameIndex:0,elapsedQ12:0,active:true});await bundle.dispose();
  assert.equal(s.clipId,'main:13');assert.match(s.assetId,/^handoff20261101_GR16_D_00_/);assert.equal(s.facingLocked,true);
  const page=frame=>sources.find(x=>x.url.endsWith(frame.image));
  const pub=readJson(gr16.path),art=pub.frames.find(f=>f.id===s.assetId),pixel=pub.frames.find(f=>!f.sampling);
  assert.equal(page(art).scaleMode,'linear');assert.equal(page(art).autoGenerateMipmaps,true);
  assert.equal(page(pixel).scaleMode,'nearest','pixel art keeps hard texels');
 }
 resetAnimationHandoffRegistry();
});

test('UL11/UL12 N Walk: a QA-only partial Arena set, loaded only behind the switch and only for the Data Arena',async()=>{
 const fixtures=[['species-194','UL11'],['species-195','UL12']];
 const PIXI={Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},Texture:class{constructor(o){Object.assign(this,o);}destroy(){}},
  Assets:{async load(){return {source:{pixelWidth:4096,pixelHeight:4096,resolution:1}};},async unload(){}}};
 const baseline={runtime:{sides:{main:{animations:[{id:0,frames:[{ticks:60}]}]},sub:{animations:[]}}},getDiagnostics:()=>({}),async dispose(){},
  createActor(){return {sprite:{texture:{},anchor:{set(x,y){this.x=x;this.y=y;}}},controller:{setAnimation(){},update(){},getSnapshot:()=>null}};}};
 for(const [speciesId,code] of fixtures){
  resetAnimationHandoffRegistry();
  assert.equal(await handoffOnlyArenaEntry(speciesId,LOOP,fileFetch),null,'off by default');
  assert.equal(await handoffOnlyArenaEntry(speciesId,'https://example.github.io/championship.html?animHandoff=1',fileFetch),null,'never on public hosts');
  const entry=await handoffOnlyArenaEntry(speciesId,LOOP+'?animHandoff=1',fileFetch);
  assert.equal(entry.displayCode,code);assert.equal(entry.partialArena,true);
  const arena=await attachReviewedCharacterAnimation({bundle:baseline,PIXI,speciesId,usage:'arena',baseUrl:LOOP+'?animHandoff=1',fetchImpl:fileFetch});
  const actor=arena.createActor({animation:0});
  assert.equal(actor.reviewedArena.partial,true);assert.equal(typeof actor.controller.resumeNative,'function');
  // heading U draws the accepted walk; any other heading reports it missing, so the scene keeps the native body
  const north=actor.reviewedArena.sample({time:0.1,hp:1,vx:0,vy:-200,facing:1,hit:false,attack:false,castId:null,angle:null,moveRate:1,victory:false});
  assert.equal(north.clipId,'handoff:arena:U:walk');assert.ok(north.geometry);
  const east=actor.reviewedArena.sample({time:0.2,hp:1,vx:200,vy:0,facing:-1,hit:false,attack:false,castId:null,angle:null,moveRate:1,victory:false});
  assert.ok(!east?.geometry,code+' other headings stay native');
  await arena.dispose();
  const general=await attachReviewedCharacterAnimation({bundle:baseline,PIXI,speciesId,usage:'general',baseUrl:LOOP+'?animHandoff=1',fetchImpl:fileFetch});
  assert.equal(general,baseline,code+' General is not part of the accepted scope');
 }
 resetAnimationHandoffRegistry();
});
