import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {attachReviewedCharacterAnimation} from '../src/championship/presentation/reviewedCharacterLoader.js';
import {loadPixiCharacterRuntimeBundle} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';
import {applyNativeCharacterCellGeometry} from '../src/championship/presentation/nativeHuntCharacterAction.js';
import {createNativeCharacterAnimationTimeline} from '../src/championship/presentation/characterAnimationTimeline.js';
import {scaleNativeGeometry,stageBodyScale} from '../src/championship/presentation/stageBodySize.js';
import {decodeSnapshotQaPng,snapshotQaCrop,snapshotQaPremultiply} from '../src/championship/presentation/snapshotQaPng.js';
import {loadCharacterRosterCore} from '../src/championship/presentation/characterRosterCore.js';
import {getRaisingNativeActorGeometry} from '../src/championship/presentation/intRh2/raisingNativeSizing.js';
const root=path.resolve(import.meta.dirname,'..');
const local='assets/production/internal-character-review/species218-snapshot-qa-v1/';
const json=name=>JSON.parse(fs.readFileSync(path.join(root,local,name),'utf8'));
const runtime=json('public-runtime.json'),manifest=json('manifest.json'),assembly=json('candidate-assembly.json');
const baseUrl='http://127.0.0.1:8761/championship.html?animHandoff=1&animGeneralCandidate=species-218';
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const point=()=>({x:0,y:0,set(x,y){this.x=x;this.y=y;}});
function fixture(){
 const sources=[],textures=[],requests=[];
 const PIXI={Assets:{load:async()=>{throw Error('Unexpected Pixi URL loader');},unload:async()=>{}},Spritesheet:class{},
  BufferImageSource:class {constructor(o){Object.assign(this,o,{pixelWidth:o.width,pixelHeight:o.height});sources.push(this);}destroy(){this.destroyed=true;}},
  Rectangle:class {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},
  Texture:class {constructor(o){Object.assign(this,o);textures.push(this);}destroy(){this.destroyed=true;}},
  Sprite:class {constructor({texture}){this.texture=texture;this.anchor=point();this.scale=point();this.visible=true;}}
 };
 PIXI.Texture.EMPTY={baseline:true,source:{resolution:1}};
 const fetchImpl=async url=>{requests.push(url);const b=fs.readFileSync(path.join(root,new URL(url).pathname));return {ok:true,arrayBuffer:async()=>b};};
 return {PIXI,sources,textures,requests,fetchImpl};
}
async function setup(extra={}){
 const f=fixture();
 const native=await loadPixiCharacterRuntimeBundle({PIXI:f.PIXI,runtimeUrl:'http://127.0.0.1:8761/baseline.json',runtimeDocument:structuredClone(runtime),pixels:false});
 const bundle=await attachReviewedCharacterAnimation({bundle:native,PIXI:f.PIXI,speciesId:'species-218',usage:'general',baseUrl,fetchImpl:f.fetchImpl,...extra});
 const actor=bundle.createActor({animation:0,speciesId:'championship:creature:species-218',nativeFramePresentation:true,nativeGeometry:scaleNativeGeometry(runtime.geometry,stageBodyScale('species-218'))});
 return {...f,native,bundle,actor};
}
const owner=(sequenceId,frameIndex=0,flipBits=0)=>({contract:'HUNT_CHARACTER_PRESENTATION.v1',speciesIndex:218,sequenceId,frameIndex,elapsedQ12:0,active:1,flipBits});

test('actual game loader defaults remain exact native objects and never fetch a candidate',async()=>{
 for(const change of [{baseUrl:'http://127.0.0.1:8761/championship.html'},
  {baseUrl:baseUrl.replace('127.0.0.1:8761','example.com')},{usage:'arena'},
  {baseUrl:baseUrl+'&animHandoff=1'},{speciesId:'species-219'}]){
  const f=await setup(change);assert.equal(f.bundle,f.native);assert.equal(f.requests.filter(url=>url.includes(local)).length,0);assert.equal(f.sources.length,0);await f.bundle.dispose();
 }
});
test('both disclosed PNGs decode to the exact original crop RGBA without Canvas conversion',async()=>{
 const expected={'m535_slayerdramon/main/cell_009':'964e1e04fdac583c39b09c868ff88054f98fa093b68bc23f7012d5c73da27181',
  'm535_slayerdramon/main/cell_011':'21fd7c425fc1f74db12df2fc068546c167a9a4c3ee5d55f4ba1a6c2f5b453ad7'};
 for(const [key,r] of Object.entries(manifest.records)){
  const b=fs.readFileSync(path.join(root,local,'images',r.fileSha256+'.png')),decoded=await decodeSnapshotQaPng(b);
  assert.equal(hash(b),r.fileSha256);assert.equal(decoded.width,384);assert.equal(decoded.height,256);
  assert.deepEqual(r.rect,[0,0,384,256]);assert.equal(hash(decoded.rgba),expected[key]);
  assert.equal(hash(snapshotQaCrop(decoded,r.rect)),r.cropRgbaSha256);
  const before=hash(decoded.rgba),premult=snapshotQaPremultiply(decoded.rgba);assert.equal(hash(decoded.rgba),before);
  assert.notEqual(premult,decoded.rgba);for(let i=3;i<premult.length;i+=4)assert.equal(premult[i],decoded.rgba[i]);
 }
});
test('disclosure package contains only two candidate records and PNGs; other 81 events bind no candidate',()=>{
 const expected=['m535_slayerdramon/main/cell_009','m535_slayerdramon/main/cell_011'];
 assert.deepEqual(Object.keys(manifest.records).sort(),expected);assert.deepEqual(assembly.candidate_records.map(r=>r.representative).sort(),expected);
 assert.equal(assembly.assets.length,2);assert.deepEqual(fs.readdirSync(path.join(root,local,'images')).sort(),assembly.assets.map(a=>path.basename(a.path)).sort());
 const frames=assembly.sequences.flatMap(s=>s.frames);assert.equal(frames.length,87);
 assert.equal(frames.filter(f=>f.candidate_record===null).length,81);
 assert.ok(frames.every(f=>f.candidate_record===null||expected.includes(f.candidate_record)));
 assert.equal(manifest.runtimeApproved,false);assert.equal(manifest.status,'HOLD');
});
test('real PNG invalid header, colour format, truncated stream and crop bounds fail closed',async()=>{
 const r=Object.values(manifest.records)[0],b=fs.readFileSync(path.join(root,local,'images',r.fileSha256+'.png'));
 await assert.rejects(decodeSnapshotQaPng(b.subarray(0,40)));
 const bad=Buffer.from(b);bad[25]=2;await assert.rejects(decodeSnapshotQaPng(bad),/PNG_FORMAT/);
 assert.throws(()=>snapshotQaCrop({width:1,height:1,rgba:new Uint8Array(4)},[0,0,2,1]),/CROP_RANGE/);
});
test('actual game loader binds two verified Pixi texture sources; no second URL decoder or ticker',async()=>{
 const f=await setup();assert.equal(f.sources.length,2);assert.equal(f.requests.length,5);
 for(const s of f.sources){assert.equal(s.pixelWidth,384);assert.equal(s.pixelHeight,256);assert.equal(s.format,'rgba8unorm');assert.equal(s.alphaMode,'premultiplied-alpha');assert.equal(s.scaleMode,'linear');}
 assert.equal(f.bundle.getDiagnostics().snapshotQa.estimatedBaseRgbaBytes,786432);
 assert.equal(f.bundle.getDiagnostics().snapshotQa.runtimeApproved,false);await f.bundle.dispose();
});
test('all 53 sequences and 87 owner events project through actual game presenter: 6 candidate, 81 fallback',async()=>{
 const f=await setup();let candidate=0,native=0;
 const saved=JSON.stringify(runtime);
 for(const [side,data] of Object.entries(runtime.sides)){
  const actor=f.bundle.createActor({side,animation:0,nativeFramePresentation:true,nativeGeometry:scaleNativeGeometry(runtime.geometry,stageBodyScale('species-218'))});
  for(const seq of data.animations)for(let i=0;i<seq.frames.length;i++){
   const sample=actor.nativeFramePresenter.apply(owner(seq.id,i));
   if(sample.snapshotQa){candidate++;assert.equal(sample.snapshotQa.eventOrdinal,i);assert.equal(sample.snapshotQa.rawTicks,seq.frames[i].ticks);assert.equal(sample.snapshotQa.rawMode,seq.playbackMode);}
   else {native++;assert.equal(actor.sprite.texture,f.PIXI.Texture.EMPTY);}
  }
 }
 assert.equal(candidate,6);assert.equal(native,81);assert.equal(JSON.stringify(runtime),saved);await f.bundle.dispose();
});
test('calibration uses the stage body size once and preserves all native flips and authority',async()=>{
 const f=await setup(),r=manifest.records['m535_slayerdramon/main/cell_009'];
 for(let bits=0;bits<4;bits++){
  const sample=f.actor.nativeFramePresenter.apply(owner(5,0,bits));
  assert.equal(sample.flipX,Boolean(bits&1));assert.equal(sample.flipY,Boolean(bits&2));
  assert.equal(sample.authority,'HUNT_CHARACTER_PRESENTATION.v1');
  assert.equal(sample.geometry.scale,r.density/.396);
  applyNativeCharacterCellGeometry(f.actor.sprite,sample);
  assert.equal(f.actor.sprite.scale.x,.396/r.density);
  assert.equal(f.actor.sprite.anchor.x,r.origin[0]/384);assert.equal(f.actor.sprite.anchor.y,r.origin[1]/256);
 }
 await f.bundle.dispose();
});
test('original native clock boundary at 15 advances switches 011 to native 012 and restores native geometry',async()=>{
 const f=await setup();const seq=runtime.sides.main.animations.find(s=>s.id===7),timeline=createNativeCharacterAnimationTimeline(seq);
 const apply=s=>f.actor.nativeFramePresenter.apply({...owner(7,s.frameIndex),...s});
 assert.ok(apply(timeline.getSnapshot()).snapshotQa);
 for(let i=0;i<14;i++)assert.ok(apply(timeline.advanceNative(4096)).snapshotQa);
 const sample=apply(timeline.advanceNative(4096));assert.equal(sample.snapshotQa,undefined);assert.equal(sample.cell,12);
 assert.equal(f.actor.sprite.texture,f.PIXI.Texture.EMPTY);
 applyNativeCharacterCellGeometry(f.actor.sprite,sample);assert.equal(f.actor.sprite.scale.x,.396/4);
 assert.deepEqual([f.actor.sprite.anchor.x,f.actor.sprite.anchor.y],[.5,512/768]);await f.bundle.dispose();
});
test('reduced motion respects the original presenter frame selection; wrong actor identity remains native',async()=>{
 const f=await setup();const a=f.bundle.createActor({animation:0,nativeFramePresentation:true,reducedMotion:true});
 assert.equal(a.nativeFramePresenter.apply(owner(7,1)).snapshotQa.representative,'m535_slayerdramon/main/cell_011');
 const other=f.bundle.createActor({animation:0,nativeFramePresentation:true,speciesId:'species-219'});
 assert.equal(other.nativeFramePresenter.apply(owner(5)).snapshotQa,undefined);
 assert.throws(()=>f.actor.nativeFramePresenter.apply({...owner(5),speciesIndex:217}),/OWNER_IDENTITY/);
 assert.equal(f.actor.nativeFramePresenter.apply(null),null);await f.bundle.dispose();
});
test('image/source tampering, changed event order, and abort prevent candidate exposure',async()=>{
 for(const suffix of ['manifest.json','candidate-assembly.json','public-runtime.json','.png']){
  const f=fixture();const bundle={runtime,dispose:async()=>{}};
  const fetchImpl=async url=>{const r=await f.fetchImpl(url);if(!url.endsWith(suffix))return r;const b=Buffer.from(await r.arrayBuffer());b[Math.min(50,b.length-1)]^=1;return {ok:true,arrayBuffer:async()=>b};};
  await assert.rejects(attachReviewedCharacterAnimation({bundle,PIXI:f.PIXI,speciesId:'species-218',usage:'general',baseUrl,fetchImpl}));
  assert.equal(f.sources.length,0);
 }
 const f=fixture(),changed=structuredClone(runtime);changed.sides.main.animations[0].frames.reverse();
 // Sequence 0 may be a single frame; a changed raw tick is definitely observable.
 changed.sides.main.animations[0].frames[0].ticks++;
 await assert.rejects(attachReviewedCharacterAnimation({bundle:{runtime:changed},PIXI:f.PIXI,speciesId:'species-218',usage:'general',baseUrl,fetchImpl:f.fetchImpl}),/OWNER_EVENTS_CHANGED/);
 await assert.rejects(setup({signal:AbortSignal.abort(Error('QA_CANCELLED'))}),/QA_CANCELLED/);
});
test('repeated mount/dispose releases every texture and source exactly through the bundle lifecycle',async()=>{
 for(let i=0;i<3;i++){
  const f=await setup();f.actor.nativeFramePresenter.apply(owner(5));const a=f.bundle.dispose(),b=f.bundle.dispose();assert.equal(a,b);await a;
  assert.ok(f.sources.every(s=>s.destroyed));assert.ok(f.textures.every(s=>s.destroyed));
  assert.throws(()=>f.bundle.createActor(),/DISPOSED/);assert.throws(()=>f.actor.nativeFramePresenter.apply(owner(5)),/DISPOSED/);
 }
});

test('existing roster creates the Raising actor and counts QA texture memory in its aggregate',async()=>{
 const f=await setup(),entityId=runtime.entityId;
 const roster=await loadCharacterRosterCore({PIXI:f.PIXI,speciesIds:['championship:creature:species-218'],
  manifest:{assetId:'TEST_SINGLE_PUBLIC_BINDING',records:[{entityId,runtime:'baseline.json'}],speciesBindings:[{speciesId:'species-218',entityId}]},
  manifestUrl:baseUrl,validateRecordRuntime:()=>true,loadBundle:async()=>f.bundle,
  geometryResolver:()=>scaleNativeGeometry(runtime.geometry,.396),nativeSizingResolver:()=>({packedPixelsPerNativePixel:4})});
 const actor=roster.createActor({speciesId:'championship:creature:species-218',presentation:'raising'});
 assert.equal(actor.controller,null,'the roster exposes only the native owner presenter');
 const frame=actor.nativeFramePresenter.apply(owner(5));applyNativeCharacterCellGeometry(actor.sprite,frame);
 const geometry=getRaisingNativeActorGeometry(actor.sprite,{packedPixelsPerNativePixel:frame.geometry.scale},2,{frameGeometry:frame.geometry});
 assert.equal(geometry.spriteScale,.396/manifest.records['m535_slayerdramon/main/cell_009'].density);
 assert.equal(geometry.offset.x,0);assert.equal(geometry.offset.y,0);
 assert.equal(roster.getDiagnostics().rgbaBytes,786432);await roster.dispose();
 assert.ok(f.sources.every(s=>s.destroyed));
});

test('abort after the first crop releases the already allocated QA source',async()=>{
 const f=fixture(),abort=new AbortController(),Original=f.PIXI.BufferImageSource;let disposed=0;
 f.PIXI.BufferImageSource=class extends Original {constructor(o){super(o);abort.abort(Error('CANCEL_AFTER_FIRST_CROP'));}};
 await assert.rejects(attachReviewedCharacterAnimation({bundle:{runtime,dispose:async()=>disposed++},PIXI:f.PIXI,speciesId:'species-218',usage:'general',baseUrl,fetchImpl:f.fetchImpl,signal:abort.signal}),/CANCEL_AFTER_FIRST_CROP/);
 assert.equal(f.sources.length,1);assert.ok(f.sources[0].destroyed);assert.ok(f.textures[0].destroyed);assert.equal(disposed,1);
});

test('invalid owner frames leave the previous visible texture and presenter snapshot unchanged',async()=>{
 const f=await setup(),presenter=f.actor.nativeFramePresenter;
 const snapshot=presenter.apply(owner(5)),texture=f.actor.sprite.texture;
 for(const bad of [{...owner(5),speciesIndex:217},{...owner(5),elapsedQ12:undefined},
  {...owner(5),active:3},{...owner(5),flipBits:4},{...owner(5),contract:'UNTRUSTED'},owner(5,100)]){
  assert.throws(()=>presenter.apply(bad));assert.equal(presenter.getSnapshot(),snapshot);assert.equal(f.actor.sprite.texture,texture);
 }
 await f.bundle.dispose();
});

test('streamed native-pixel bundle preserves page readiness, exact native texture fallback and disposal',async()=>{
 const f=fixture(),nativeImages=new Map(),unloaded=[];
 f.PIXI.Spritesheet=class {
  constructor({texture,data}){this.texture=texture;this.data=data;this.textures={};}
  async parse(){for(const [key,frame] of Object.entries(this.data.frames)){
   const texture=new f.PIXI.Texture({source:this.texture.source,
    orig:new f.PIXI.Rectangle(0,0,frame.sourceSize.w,frame.sourceSize.h),
    frame:new f.PIXI.Rectangle(frame.frame.x,frame.frame.y,frame.frame.w,frame.frame.h),
    trim:new f.PIXI.Rectangle(frame.spriteSourceSize.x,frame.spriteSourceSize.y,frame.spriteSourceSize.w,frame.spriteSourceSize.h)});
   texture.key=key;this.textures[key]=texture;
  }}
  destroy(){for(const t of Object.values(this.textures))t.destroy(false);}
 };
 f.PIXI.Assets.load=async url=>{
  const p=runtime.streaming.pages.find(p=>url.endsWith(p.image));assert.ok(p);
  const texture={source:{pixelWidth:p.width,pixelHeight:p.height,resolution:1}};nativeImages.set(url,texture);return texture;
 };
 f.PIXI.Assets.unload=async url=>{unloaded.push(url);if(nativeImages.has(url))nativeImages.get(url).source.destroyed=true;};
 const fetchImpl=async url=>{
  if(!url.includes('/native/'))return f.fetchImpl(url);
  const bytes=fs.readFileSync(path.join(root,'tests/fixtures/species218-native-streaming',path.basename(new URL(url).pathname)));
  return {ok:true,text:async()=>bytes.toString()};
 };
 const native=await loadPixiCharacterRuntimeBundle({PIXI:f.PIXI,runtimeUrl:'http://127.0.0.1:8761/native/runtime.json',
  runtimeDocument:structuredClone(runtime),sides:['main'],initialSequenceIds:[5],fetchImpl});
 const bundle=await attachReviewedCharacterAnimation({bundle:native,PIXI:f.PIXI,speciesId:'species-218',usage:'general',baseUrl,fetchImpl});
 const actor=bundle.createActor({animation:0,nativeFramePresentation:true,nativeGeometry:scaleNativeGeometry(runtime.geometry,.396)}),presenter=actor.nativeFramePresenter;
 assert.equal(native.getDiagnostics().nativePixels,true);assert.equal(native.getDiagnostics().streaming.readyPages,2);
 assert.equal(presenter.isFrameReady(owner(8)),false);
 const sample=presenter.apply(owner(5)),candidateTexture=actor.sprite.texture;
 assert.ok(sample.snapshotQa);assert.notEqual(candidateTexture,nativeImages.values().next().value);
 assert.throws(()=>presenter.apply(owner(8)),/TEXTURE_MISSING/);
 assert.equal(actor.sprite.texture,candidateTexture);assert.equal(presenter.getSnapshot(),sample);
 await presenter.ensureFrame(owner(8));assert.equal(presenter.isFrameReady(owner(8)),true);
 assert.equal(native.getDiagnostics().streaming.readyPages,3);
 assert.equal(presenter.apply(owner(8)).snapshotQa,undefined);assert.equal(actor.sprite.texture.key,'m535_slayerdramon/main/cell_013');
 assert.ok(presenter.apply(owner(7)).snapshotQa);
 const fallback=presenter.apply(owner(7,1));assert.equal(fallback.snapshotQa,undefined);
 assert.equal(actor.sprite.texture.key,'m535_slayerdramon/main/cell_012');
 applyNativeCharacterCellGeometry(actor.sprite,fallback);assert.equal(actor.sprite.scale.x,.396/4);
 const baselineBytes=native.getDiagnostics().textureMemory.estimatedBaseRgbaBytes;
 assert.equal(bundle.getDiagnostics().textureMemory.estimatedBaseRgbaBytes,baselineBytes+786432);
 await bundle.dispose();assert.equal(unloaded.length,3);assert.ok([...nativeImages.values()].every(t=>t.source.destroyed));
 assert.ok(f.sources.every(s=>s.destroyed));assert.ok(f.textures.every(t=>t.destroyed));
 await assert.rejects(presenter.ensureFrame(owner(8)),/DISPOSED/);
});
