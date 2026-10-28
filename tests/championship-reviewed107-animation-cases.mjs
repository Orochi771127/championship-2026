import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {reviewedNumericClip,reviewedArenaClip,reviewedArenaKoClip,reviewedKoCandidateClips,sampleReviewedClip,sampleReviewedCharacterClip,reviewedDirection,createReviewedArenaPlayback,REVIEWED_DIRECTIONS} from '../src/championship/presentation/reviewedCharacterAnimation.js';
import {createNativeCharacterAnimationTimeline} from '../src/championship/presentation/characterAnimationTimeline.js';
import {attachReviewedCharacterAnimation,reviewedCharacterSelection,reviewedSpeciesForEntity,loadReviewedResultSub} from '../src/championship/presentation/reviewedCharacterLoader.js';
import {applyReviewedArenaPoseScale} from '../src/championship/presentation/dataArena/dataArenaPixiScene.js';
import {loadCharacterRosterCore} from '../src/championship/presentation/characterRosterCore.js';
import {loadPixiCharacterRuntimeBundle} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';
import {PUBLIC_CHARACTER_DATA} from '../src/championship/presentation/publicCharacterCatalog.js';
import {getProductExtension} from '../src/championship/contracts/productSpeciesExtensions.js';
import {isKnownSpeciesIndex} from '../src/championship/contracts/productSpeciesData.js';
const root=path.resolve(import.meta.dirname,'..');
const selection=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/reviewed-animation-selection.v1.json'),'utf8'));
const read=code=>JSON.parse(fs.readFileSync(path.join(root,(e=>e.authoringPath??e.path)(selection.characters.find(c=>c.displayCode===code))),'utf8'));
// v1 storage superseded by web-v2 moved to a local archive with repo-relative layout; provenance checks read it there.
const v1Archive=process.env.CHAMPIONSHIP_REVIEWED107_V1_ARCHIVE??path.resolve(root,'..','reviewed107-v1-repo-archive-20261028');
const provenance=rel=>fs.existsSync(path.join(root,rel))?path.join(root,rel):path.join(v1Archive,rel);
const sampleState={time:0,hp:100,vx:0,vy:0,facing:1};
const cast=(id,t,type='CAST',angle=0)=>({type,actionId:id,t,angle,moveId:'pulse',moveType:'PROJECTILE'});

test('107 canonical growth/mature selections plus Owner-directed awakened pilots; excluded growth codes keep legal fallback',()=>{
 assert.equal(selection.characters.length,114);assert.equal(selection.errors.length,0);
 assert.equal(selection.characters.filter(c=>c.displayCode.startsWith('GR')).length,38);
 assert.equal(selection.characters.filter(c=>c.displayCode.startsWith('MA')).length,69);
 assert.deepEqual(selection.characters.filter(c=>c.displayCode.startsWith('AW')).map(c=>c.displayCode),['AW29','AW25','AW28','AW32','AW26','AW27','AW31']);
 assert.deepEqual(selection.excluded,['GR04','GR13','GR32']);
 assert.equal(new Set(selection.characters.map(c=>c.speciesId)).size,114);
 for(const entry of selection.characters){assert.ok(!selection.excluded.includes(entry.displayCode));
  assert.equal(read(entry.displayCode).speciesId,entry.speciesId);}
});

test('reviewed individual attacks and authored context ids retain their semantic caller families',()=>{
 const expected={GR31:['beak_attack','talon_attack','wing_bash','gust'],GR33:['paw_swipe','pounce','shoulder_bump','bell_pulse'],
  GR36:['paw_swipe','pounce','tail_sweep','ice_breath'],GR37:['attack_paw_swipe','attack_leaping_forepaw_strike','attack_low_body_charge','shoot_mouth_release']};
 for(const [code,actions] of Object.entries(expected)){
  const d=read(code);
  for(let i=0;i<4;i++)assert.equal(reviewedNumericClip(d,'main',i+7).clip.action,actions[i],code);
  assert.equal(reviewedNumericClip(d,'main',35).clip.action,actions[3],code);
  assert.equal(reviewedNumericClip(d,'sub',2).clip.action,actions[0],code);
 }
 for(const code of ['GR34','GR38']){
  const d=read(code);
  for(const id of [7,8,9,10]){
   const b=reviewedNumericClip(d,'main',id);
   assert.equal(b.mappingEvidence,'SOURCE_AUTHORED_CONTEXT_ALIAS');assert.ok(b.clip.source.sourceContextIds.includes(id));
  }
 }
 // The numeric declaration wins over any generic action with a similar name.
 const numeric={id:'main:7',mode:'main',action:'author_selected',frames:[]};
 assert.equal(reviewedNumericClip({clips:[{mode:'main',action:'melee',frames:[]},numeric]},'main',7).clip,numeric);
});

test('ordinary movement/eating remains; MA31 original HOLD changes only with the frozen approved new pixels',()=>{
 for(const [code,id,action] of [['MA05',2,'flipper_crawl'],['MA08',0,'hover_idle'],['MA31',3,'fast_hover'],
  ['MA33',2,'swim_move'],['MA49',12,'weak_glide'],['MA44',14,'eat_mime'],['GR21',2,'locomotion']]){
  assert.equal(reviewedNumericClip(read(code),'main',id).clip.action,action);
 }
 const d=read('MA31'),old=JSON.parse(fs.readFileSync(provenance(d.koRepairApproval.previousManifestPath),'utf8'));
 for(const id of [15,25])assert.equal(reviewedNumericClip(old,'main',id),null);
 assert.equal(reviewedNumericClip(old,'sub',5),null);
 assert.ok(reviewedNumericClip(d,'main',15).clip.frames[0].assetId.startsWith('root-ko-repair-v1/'));
});

test('the eight illustration-only identities stay unknown to gameplay; test templates contain no fabricated production data',()=>{
 const template=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/reviewed107-unregistered-species.template.json'),'utf8'));
 assert.equal(template.kind,'TEST_ONLY_UNREADY_CONTENT_TEMPLATE');assert.equal(template.productionImportPermitted,false);
 assert.deepEqual(template.entries.map(e=>e.displayCode),['GR39','GR40','GR41','MA65','MA66','MA67','MA68','MA69']);
 for(const e of template.entries){
  const index=Number(e.speciesId.split('-')[1]);assert.equal(isKnownSpeciesIndex(index),false);assert.equal(getProductExtension(index),null);
  assert.equal(PUBLIC_CHARACTER_DATA.speciesBindings.some(b=>b.speciesId===e.speciesId),false);
  assert.equal(e.runtimeReady,false);assert.equal(e.evolutionReady,false);assert.equal(e.reversibleActivation.productionRegistrationEnabled,false);
  assert.ok(Object.values(e.gameplay).every(v=>v===null));assert.equal(e.animation.sha256,selection.characters.find(c=>c.speciesId===e.speciesId).sha256);
 }
});

for(const entry of selection.characters)test(`${entry.displayCode}: Main40/Sub13 caller matrix and 8 x 4 Arena clips resolve reviewed files`,()=>{
 const d=read(entry.displayCode);
 for(const clip of d.clips){
  assert.ok(['main','sub','arena'].includes(clip.mode));assert.ok(clip.frames.length>0);
  for(const f of clip.frames){assert.ok(d.frames[f.assetId]);assert.ok(Number.isFinite(f.durationMs)&&f.durationMs>0);}
  if(clip.neutralReturn)assert.ok(d.frames[clip.neutralReturn.assetId]);
 }
 for(const direction of REVIEWED_DIRECTIONS)for(const action of ['move','melee','ranged','hurt']){
  const clip=reviewedArenaClip(d,action,direction);assert.ok(clip,`${direction}/${action}`);
  for(const f of clip.frames){assert.ok(d.frames[f.assetId]);assert.ok(f.durationMs>0);}
 }
 for(const side of ['main','sub'])for(let id=0;id<(side==='main'?40:13);id++){
  const binding=reviewedNumericClip(d,side,id);
  // Missing mappings must stay explicit; absence never manufactures a pose.
  if(binding)for(const f of binding.clip.frames)assert.ok(d.frames[f.assetId]);
 }
});

test('actions listed as nativeFallback keep the original route: no clip, no alias stand-in',()=>{
 // AW26/AW27 recipe-only effects were filled by dot's finished rasters (2026-10-28); none are listed now
 const listed=selection.characters.map(e=>read(e.displayCode)).filter(d=>d.nativeFallback);
 assert.deepEqual(listed.map(d=>d.displayCode),[]);
 const probe={...read('AW26'),nativeFallback:['main:26']};assert.equal(reviewedNumericClip(probe,'main',26),null);
 for(const d of listed)for(const key of d.nativeFallback){
  const [side,id]=key.split(':');assert.equal(d.clips.some(c=>c.id===key),false,key);
  assert.equal(reviewedNumericClip(d,side,Number(id)),null,d.displayCode+' '+key);
 }
});

test('Owner 2026-10-28 replacement: 103 fully covered roles retire the original atlas; KO without approval holds the hurt key',async()=>{
 const flagged=selection.characters.filter(c=>c.replacesOriginal===true).map(c=>c.displayCode);
 assert.equal(flagged.length,103);
 for(const code of ['GR01','MA33','MA34','GR39','MA65'])assert.ok(!flagged.includes(code),code);
 for(const code of flagged){const d=read(code);assert.equal(d.nativeFallback,undefined,code);
  for(const [side,n] of [['main',40],['sub',13]])for(let id=0;id<n;id++)assert.ok(reviewedNumericClip(d,side,id),code+' '+side+id);}
 // a replaced selection is used on any origin; other reviewed sets stay loopback-only
 assert.equal(reviewedCharacterSelection(selection.characters.find(c=>c.displayCode==='MA04').speciesId,'https://example.test/')?.displayCode,'MA04');
 assert.equal(reviewedCharacterSelection(selection.characters.find(c=>c.displayCode==='GR01').speciesId,'https://example.test/')?.displayCode,'GR01');
 const aw25=read('AW25');assert.equal(reviewedArenaKoClip(aw25),null);
 assert.equal(createReviewedArenaPlayback(aw25).sample({...sampleState,hp:0}).fallbackSequenceId,15);
 const hold=createReviewedArenaPlayback(aw25,{nativeFallback:false});hold.sample({...sampleState,time:0,vx:-80});
 const ko=hold.sample({...sampleState,time:1,hp:0}),hurt=reviewedArenaClip(aw25,'hurt',ko.direction);
 assert.equal(ko.phase,'KO_HURT_HOLD_NO_APPROVED_KO');assert.equal(ko.terminal,true);assert.equal(ko.assetId,hurt.frames.at(-1).assetId);
 // with pixels:false the base bundle never requests an atlas page; timing and actors still work
 const loads=[];const PIXI={Assets:{load:async u=>{loads.push(u);throw Error('no atlas expected');}},Spritesheet:class{},
  Texture:{EMPTY:{empty:true}},Sprite:class{constructor({texture}){this.texture=texture;this.anchor={set(){}};}}};
 // MA04's real shipped runtime (its atlas pages are retired from the repository)
 const ma04=PUBLIC_CHARACTER_DATA.characters.find(c=>c.speciesId===selection.characters.find(e=>e.displayCode==='MA04').speciesId);
 const runtime=JSON.parse(fs.readFileSync(path.join(root,ma04.runtimePath),'utf8'));
 const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl:'http://127.0.0.1/'+ma04.runtimePath,runtimeDocument:runtime,sides:['main'],initialSequenceIds:[0,2],pixels:false});
 const actor=bundle.createActor({side:'main',animation:0});assert.equal(actor.sprite.texture.empty,true);
 assert.equal(loads.length,0);assert.equal(bundle.getDiagnostics().nativePixels,false);await bundle.dispose();
});

test('idle -> move -> cast -> release uses one action id and leaves gameplay untouched',()=>{
 const p=createReviewedArenaPlayback(read('MA04'));
 assert.equal(p.sample(sampleState).action,'move');
 assert.equal(p.sample({...sampleState,time:.1,vx:80}).direction,'R');
 p.observe(cast(1,.2));let f=p.sample({...sampleState,time:.3,castId:1});
 assert.equal(f.phase,'WINDUP');assert.equal(f.actionId,1);assert.equal(f.frameIndex,0);
 p.observe(cast(1,.4,'CAST_RELEASE'));f=p.sample({...sampleState,time:.41});
 assert.equal(f.phase,'RELEASE');assert.equal(f.actionId,1);assert.ok(f.frameIndex>0);
 assert.equal(sampleState.hp,100);
});

test('duplicate release and stale release cannot restart or replace a new cast',()=>{
 const p=createReviewedArenaPlayback(read('MA04'));
 p.observe(cast(1,0));p.observe(cast(1,.1,'CAST_RELEASE'));p.observe(cast(1,8,'CAST_RELEASE'));
 assert.notEqual(p.sample({...sampleState,time:1}).phase,'RELEASE');
 p.observe(cast(2,2));p.observe(cast(1,3,'CAST_RELEASE'));
 assert.equal(p.sample({...sampleState,time:3,castId:2}).actionId,2);
 p.observe(cast(2,3.1,'CAST_RELEASE'));assert.equal(p.sample({...sampleState,time:3.11}).actionId,2);
});

test('direction follows exact authored headings without synthesizing a mirror',()=>{
 const p=createReviewedArenaPlayback(read('MA13'));
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,expected=['R','DR','D','DL','L','UL','U','UR'][i];
  const f=p.sample({...sampleState,time:i,vx:Math.cos(angle)*40,vy:Math.sin(angle)*40});
  assert.equal(f.direction,expected);assert.ok(f.assetId);assert.equal(reviewedDirection(Math.cos(angle),Math.sin(angle)),expected);
 }
});

test('finite recoil returns to approved same-heading neutral, KO interrupts and holds',()=>{
 const d=read('MA04'),p=createReviewedArenaPlayback(d);
 const hurt=reviewedArenaClip(d,'hurt','DR');assert.ok(hurt.frames.at(-1).neutral);
 p.sample({...sampleState,vx:40,vy:40});
 assert.equal(p.sample({...sampleState,time:.1,hit:true}).action,'hurt');
 assert.equal(p.sample({...sampleState,time:.3,hp:0}).terminal,true);
 assert.equal(p.sample({...sampleState,time:50,hp:0}).terminal,true);
 assert.equal(p.sample({...sampleState,time:51,hp:100}).terminal,undefined);
});

test('held recoil completes without replaying when the hit flash remains true',()=>{
 const p=createReviewedArenaPlayback(read('MA04'));
 p.sample({...sampleState,time:0,hit:true});
 assert.equal(p.sample({...sampleState,time:10,hit:true}).action,'move');
});

test('GR24/26/29 loader data consumes all 24 exact hurt-to-neutral overrides; KO wins',()=>{
 let count=0;
 for(const code of ['GR24','GR26','GR29']){
  const d=read(code);assert.equal(d.reviewDelta.consumedNeutralReturns,8);
  for(const direction of REVIEWED_DIRECTIONS){
   const hurt=reviewedArenaClip(d,'hurt',direction),ret=hurt.neutralReturn;
   assert.ok(ret);assert.equal(ret.heading,direction);
   assert.ok(Math.abs(ret.afterHoldMs-(code==='GR24'?400:1000/6))<0.00001);
   assert.equal(sampleReviewedClip(hurt,ret.afterHoldMs-0.01).neutralHold,undefined);
   const returned=sampleReviewedClip(hurt,ret.afterHoldMs+1);
   assert.equal(returned.assetId,ret.assetId);assert.equal(returned.neutralHold,true);
   assert.equal(sampleReviewedClip(hurt,1e8).assetId,ret.assetId);
   const p=createReviewedArenaPlayback(d);p.sample({...sampleState,time:0,hit:true});
   assert.equal(p.sample({...sampleState,time:4,hit:true,hp:0}).terminal,true);count++;
  }
 }
 assert.equal(count,24);
});

test('Owner 2026-10-29 publication: every playable selected set is active on loopback and public hosts and ships its public manifest',()=>{
 assert.equal(selection.publicReleasePermitted,true);assert.equal(selection.scope,'PUBLIC_PLAYTEST_OWNER_APPROVED_20261029');
 for(const entry of selection.characters){
  assert.deepEqual(reviewedCharacterSelection(entry.speciesId,'http://127.0.0.1:8768/championship.html'),entry);
  assert.deepEqual(reviewedCharacterSelection(entry.speciesId,'https://example.com/championship.html'),entry.playableIdentity===false?null:entry);
  assert.match(entry.path,/animation\.public-v1\.json$/);assert.notEqual(entry.authoringPath,entry.path);
  const pub=JSON.parse(fs.readFileSync(path.join(root,entry.path),'utf8')),full=read(entry.displayCode);
  assert.equal(pub.kind,'REVIEWED_CHARACTER_ANIMATION_PUBLIC');assert.equal(pub.frames.length,Object.keys(full.frames).length);
  assert.ok(!/[A-Za-z]:[\/]|approvalSha256|provenance/.test(JSON.stringify(pub)),entry.displayCode);
 }
});

test('canonical MA50/MA62 consume the opposite archived labels without swapping species or original names',()=>{
 const a=read('MA50'),b=read('MA62');
 assert.equal(a.speciesId,'species-121');assert.equal(a.displayName,'焰鋼獅');assert.equal(a.source.sourceDisplayCode,'MA62');
 assert.equal(b.speciesId,'species-125');assert.equal(b.displayName,'日焰獅');assert.equal(b.source.sourceDisplayCode,'MA50');
 assert.equal(a.source.declaredSpeciesId,a.speciesId);assert.equal(b.source.declaredSpeciesId,b.speciesId);
});

function dimensions(bytes){
 if(bytes.subarray(1,4).toString()==='PNG')return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
 let offset=12;
 while(offset+8<bytes.length){const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),p=offset+8;
  if(kind==='VP8X')return [1+bytes.readUIntLE(p+4,3),1+bytes.readUIntLE(p+7,3)];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(p+1);return [(bits&16383)+1,((bits>>>14)&16383)+1];}
  offset=p+length+(length%2);
 }
 throw Error('UNKNOWN_IMAGE_DIMENSIONS');
}
function mockPixi(){
 const cached=new Map(),loads=[],unloads=[];
 class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
 class Texture{constructor(options){Object.assign(this,options);}destroy(){this.destroyed=true;}}
 return {PIXI:{Rectangle,Texture,Assets:{async load(url){loads.push(url);const file=path.join(root,new URL(url).pathname);const [pixelWidth,pixelHeight]=dimensions(fs.readFileSync(file));
  const texture={source:{pixelWidth,pixelHeight,resolution:1}};cached.set(url,texture);return texture;},
  async unload(url){unloads.push(url);cached.get(url).source.destroyed=true;cached.delete(url);}}},loads,unloads};
}
const fileFetch=async url=>{const bytes=fs.readFileSync(path.join(root,new URL(url).pathname));return {ok:true,text:async()=>bytes.toString(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
function baseline(){let disposals=0;return {get disposals(){return disposals;},runtime:{sides:{main:{animations:[{id:0,frames:[{ticks:60}]}]},sub:{animations:[]}}},
 getDiagnostics:()=>({}),async dispose(){disposals++;},createActor(){return {sprite:{texture:{},anchor:{set(x,y){this.x=x;this.y=y;}}},controller:{setAnimation(){},getSnapshot:()=>null},nativeFramePresenter:{apply:()=>({fallback:true})}};}};}

test('MA33 follows canonical species-097 through the real roster core; the shared species-227 entity alias keeps its own baseline',async()=>{
 const config=PUBLIC_CHARACTER_DATA.characters.find(c=>c.entityId==='m331_seadramon');
 const canonical=reviewedSpeciesForEntity(config,PUBLIC_CHARACTER_DATA.speciesBindings,'http://127.0.0.1:8768/championship.html');
 assert.equal(config.speciesId,'species-227');assert.equal(canonical,'species-097');
 assert.throws(()=>reviewedSpeciesForEntity(config,[{entityId:config.entityId,speciesId:'species-097'},
  {entityId:config.entityId,speciesId:'species-034'}],'http://127.0.0.1:8768/'),/CANONICAL_IDENTITY_CONFLICT/);
 const mock=mockPixi(),base=baseline();
 const roster=await loadCharacterRosterCore({PIXI:mock.PIXI,speciesIds:['species-097','species-227'],sides:['main'],
  manifest:{records:[{entityId:config.entityId,runtime:'runtime.json'}],speciesBindings:PUBLIC_CHARACTER_DATA.speciesBindings.filter(b=>b.entityId===config.entityId)},
  manifestUrl:'http://127.0.0.1:8768/manifest.json',validateRecordRuntime:()=>true,
  loadBundle:()=>attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:canonical,baseUrl:'http://127.0.0.1:8768/championship.html',usage:'general',fetchImpl:fileFetch})});
 const original=roster.createActor({speciesId:'championship:creature:species-097',presentation:'raising'});
 assert.equal(original.nativeFramePresenter.apply({sequenceId:0,frameIndex:0,elapsedQ12:0,flipBits:0}).clipId,reviewedNumericClip(read('MA33'),'main',0).clip.id);
 const alias=roster.createActor({speciesId:'species-227',presentation:'raising'});
 assert.equal(alias.nativeFramePresenter.apply({sequenceId:0,frameIndex:0,elapsedQ12:0,flipBits:0}).fallback,true);
 await roster.dispose();assert.equal(base.disposals,1);assert.equal(mock.loads.length,mock.unloads.length);
});

test('loader consumes override PNGs, per-frame non-256 geometry, and releases resources idempotently',async()=>{
 const entry=selection.characters.find(c=>c.displayCode==='MA01'),base=baseline(),mock=mockPixi();
 const bundle=await attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:entry.speciesId,baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
 const actor=bundle.createActor({side:'main',nativeFramePresentation:true});
 const f=actor.nativeFramePresenter.apply({sequenceId:0,frameIndex:0,elapsedQ12:0,flipBits:0});
 assert.ok(f.geometry.scale>0);assert.equal(f.geometry.sourceSize[0],actor.sprite.texture.orig.width);
 const all=Object.values(bundle.reviewedAnimation.frames);assert.ok(all.some(f=>f.sourceSize[0]!==256||f.sourceSize[1]!==256));
 assert.equal(actor.nativeFramePresenter.apply({sequenceId:0,frameIndex:0,elapsedQ12:0,flipBits:1}).fallback,true);
 assert.ok(mock.loads.length>0);await bundle.dispose();await bundle.dispose();assert.equal(base.disposals,1);assert.equal(mock.loads.length,mock.unloads.length);
 assert.throws(()=>bundle.createActor(),/DISPOSED/);
});

test('switch/evolution replacement keeps a shared image alive until the last scene releases it',async()=>{
 const mock=mockPixi(),entry=selection.characters.find(c=>c.displayCode==='GR02');
 const options=()=>({bundle:baseline(),PIXI:mock.PIXI,speciesId:entry.speciesId,baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
 const one=await attachReviewedCharacterAnimation(options()),two=await attachReviewedCharacterAnimation(options());
 const count=mock.loads.length;await one.dispose();assert.equal(mock.unloads.length,0);
 assert.ok(two.createActor({side:'main'}));await two.dispose();assert.equal(mock.unloads.length,count);
});

test('approved held KO -> flipped native frame keeps the reviewed pose (Owner 2026-10-28 mirror decision)',async()=>{
 const mock=mockPixi(),base=baseline();let baselineSets=0;
 base.createActor=()=>({sprite:{texture:{legacy:true},anchor:{x:.3,y:.7,set(x,y){this.x=x;this.y=y;}}},
  controller:{setAnimation(id){baselineSets++;return {legacy:true,id};},getSnapshot:()=>({legacy:true})},
  nativeFramePresenter:{apply:()=>({legacy:true})}});
 const bundle=await attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:read('MA31').speciesId,
  baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
 const actor=bundle.createActor({side:'main'});assert.ok(actor.controller.getSnapshot().assetId);
 actor.controller.setAnimation(15);const held=actor.controller.getSnapshot().assetId;actor.controller.update({deltaMS:10000});
 assert.equal(actor.controller.getSnapshot().assetId,held);assert.equal(baselineSets,0);
 actor.controller.setAnimation(0);assert.ok(actor.controller.getSnapshot().assetId);
 // Owner 2026-10-28: a flipped frame keeps the reviewed pose; the presenter mirrors the sprite.
 const flipped=actor.nativeFramePresenter.apply({sequenceId:0,frameIndex:0,elapsedQ12:0,flipBits:1});
 assert.equal(flipped.assetId,reviewedNumericClip(read('MA31'),'main',0).clip.frames[0].assetId);
 assert.notDeepEqual([actor.sprite.anchor.x,actor.sprite.anchor.y],[.3,.7]);await bundle.dispose();
});

test('formal scene usage loads only its approved mode and re-entry releases all sources',async()=>{
 const entry=selection.characters.find(c=>c.displayCode==='GR02');
 for(const usage of ['general','arena']){
  const mock=mockPixi(),base=baseline();
  const bundle=await attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:entry.speciesId,usage,
    baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  // web-v2 stores each mode on its own pages; a mode must load exactly those pages.
  const manifest=JSON.parse(fs.readFileSync(path.join(root,entry.authoringPath??entry.path),'utf8'));
  const expectedImages=manifest.webDelivery.pages.filter(p=>p.mode===usage).length;
  assert.ok(expectedImages>=1);
  assert.equal(bundle.getDiagnostics().reviewedAnimation.usage,usage);assert.equal(mock.loads.length,expectedImages);
  assert.ok(bundle.getDiagnostics().reviewedAnimation.loadedFrames<entry.frameCount);
  await bundle.dispose();assert.equal(mock.unloads.length,expectedImages);
 }
});

test('formal result Sub9 uses reviewed victory on the existing sprite and Sub5 keeps legal fallback if absent',async()=>{
 const mock=mockPixi(),sprite={texture:{},anchor:{set(x,y){this.x=x;this.y=y;}}};
 const victory=await loadReviewedResultSub({PIXI:mock.PIXI,sprite,speciesId:'species-034',sequenceId:9,
    baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
 assert.ok(victory);assert.ok(victory.sample(0).geometry);assert.ok(victory.sample(30).assetId);
 assert.ok(victory.bounds.right>victory.bounds.left);await victory.dispose();assert.equal(mock.loads.length,mock.unloads.length);
 const before=mock.loads.length;
 const missing=await loadReviewedResultSub({PIXI:mock.PIXI,sprite,speciesId:'species-228',sequenceId:5,
    baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
 assert.equal(missing,null);assert.equal(mock.loads.length,before);
});

test('late abort and hash failure release baseline and every loaded image',async()=>{
 const mock=mockPixi(),base=baseline(),entry=selection.characters.find(c=>c.displayCode==='GR02'),abort=new AbortController();
 const fetchImpl=async(url,options)=>{const result=await fileFetch(url,options);if(url.endsWith('.webp'))abort.abort();return result;};
 await assert.rejects(attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:entry.speciesId,baseUrl:'http://127.0.0.1:8768/championship.html',signal:abort.signal,fetchImpl}));
 assert.equal(base.disposals,1);assert.equal(mock.loads.length,mock.unloads.length);
 const corrupt=baseline();await assert.rejects(attachReviewedCharacterAnimation({bundle:corrupt,PIXI:mock.PIXI,speciesId:entry.speciesId,baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:async()=>({ok:true,text:async()=>'{}'})}),/HASH/);
 assert.equal(corrupt.disposals,1);
});

test('all 107 loaders validate actual PNG/WebP bounds, crop/trim geometry and disposal',async()=>{
 for(const entry of selection.characters){
  const mock=mockPixi(),base=baseline();
  const bundle=await attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:entry.speciesId,
    baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  assert.equal(bundle.getDiagnostics().reviewedAnimation.loadedFrames,entry.frameCount,entry.displayCode);
  const actor=bundle.createActor({side:'main'});assert.ok(actor.reviewedArena,entry.displayCode);
  for(const direction of REVIEWED_DIRECTIONS){
   const clip=reviewedArenaClip(bundle.reviewedAnimation,'move',direction);
   assert.ok(clip.frames.every(f=>bundle.reviewedAnimation.frames[f.assetId]),entry.displayCode);
  }
  await bundle.dispose();assert.equal(mock.loads.length,mock.unloads.length,entry.displayCode);
 }
});

const rootApprovalFile=path.join(root,'tests/fixtures/reviewed107-root-art-approval.v1.json');
const rootCandidateFile=path.join(root,'tests/fixtures/reviewed107-root-candidate-map.v1.json');
const rootApproval=JSON.parse(fs.readFileSync(rootApprovalFile,'utf8'));
const rootCandidate=JSON.parse(fs.readFileSync(rootCandidateFile,'utf8'));
test('pinned root approval consumes precisely the 76 authorized context holds, preserving original clip/frame/source identity and geometry',()=>{
 assert.equal(createHash('sha256').update(fs.readFileSync(rootApprovalFile)).digest('hex'),'98dd5a0ab968b2c0e1a374a84f5b97486486b3d4b0514d5178e7f17f2ca36d16');
 assert.equal(createHash('sha256').update(fs.readFileSync(rootCandidateFile)).digest('hex'),rootApproval.sourceCandidateMapSha256);
 assert.equal(rootApproval.sourceDecisionListSha256,'c4460e99366cc8fb6709b5f5994e5d41c9dd8a021dfbe5d1f71e1dd3843347ea');
 let contexts=0;const codes=new Set();
 for(const approval of rootApproval.approvals){
  const code=approval.decisionId.split(':')[0],d=read(code),expected=approval.exactAssetIdOrFrameIndex.assetId;
  const targets=approval.permittedContextMain15Main25Sub5ArenaOrMainFlip.flatMap(c=>c==='Main15'?[['main',15]]:c.startsWith('Sub5_')?[['sub',5]]:c==='Main25_BOUND_ONLY'?[['main',25]]:c==='Main1_weak_idle'?[['main',1]]:[]);
  assert.ok(targets.length);codes.add(code);
  for(const [side,id] of targets){
   const b=reviewedNumericClip(d,side,id);assert.equal(b.mappingEvidence,'EXPLICIT_NUMERIC_SELECTION');
   assert.equal(b.clip.frames.length,1);assert.equal(b.clip.loop,false);assert.equal(b.clip.frames[0].assetId,expected);
   for(const elapsed of [0,0.01,2000,1e9])assert.equal(sampleReviewedClip(b.clip,elapsed).assetId,expected,code+'/'+side+id);
   // Approval identity is the v1 storage the root reviewed; web-v2 records it per frame as `v1`.
   const f=d.frames[expected],e=approval.sourceIdentity,s=f.v1??f;
   assert.deepEqual(f.origin,e.origin);assert.deepEqual(f.sourceSize,e.sourceSize);assert.deepEqual(s.trim,e.trim);assert.deepEqual(s.frame,e.frameRect);
   assert.deepEqual(b.clip.frames[0].offset??[0,0],e.offset);assert.equal(f.density,e.density);assert.equal(s.sha256,e.sha256);
   assert.equal(f.selectedSourceFileSha256??s.sha256,e.localSha256);
   assert.equal(b.clip.source.originalClipRef,approval.exactClipRef);assert.equal(b.clip.source.originalZeroBasedFrameIndex,approval.heldFrameIndex);
   assert.equal(b.clip.source.ArenaKoApproved,false);assert.equal(b.clip.source.MainFlipApproved,false);contexts++;
  }
 }
 assert.equal(contexts,76);assert.equal(codes.size,25);assert.ok(!codes.has('MA31'));
 for(const code of codes){
  const d=read(code),oldPath=provenance(d.rootArtContextApproval.previousManifestPath),old=JSON.parse(fs.readFileSync(oldPath,'utf8'));
  assert.equal(createHash('sha256').update(fs.readFileSync(oldPath)).digest('hex'),d.rootArtContextApproval.previousManifestSha256);
  // web-v2 moves storage only; identity/geometry must match and `v1` must point at the old storage.
  const identity=frames=>Object.fromEntries(Object.entries(frames).map(([k,{image,sha256,frame,trim,arena,v1,...rest}])=>[k,rest]));
  assert.deepEqual(identity(d.frames),identity(old.frames));assert.deepEqual(d.clips.slice(0,old.clips.length),old.clips);
  for(const [k,f] of Object.entries(d.frames)){const o=old.frames[k],s=f.v1??f;
   assert.deepEqual([s.image,s.sha256,s.frame??null,s.trim??null],[o.image,o.sha256,o.frame??null,o.trim??null],code+'/'+k);}
  assert.deepEqual(d.clips.filter(c=>c.mode==='arena'&&c.action!=='ko'),old.clips.filter(c=>c.mode==='arena'&&c.action!=='ko'));
 }
 assert.equal(reviewedNumericClip(read('MA08'),'main',15).clip.source.originalClipAction,'rest_coil');
 assert.notEqual(reviewedNumericClip(read('MA08'),'main',15).clip.source.originalClipAction,'hover_curl');
 assert.equal(reviewedNumericClip(read('MA33'),'main',15).clip.frames[0].assetId,'assets/MAIN_B16/cell_08.png');
 assert.equal(reviewedNumericClip(read('GR28'),'main',1).clip.frames[0].assetId,'M02_03');
 assert.notEqual(sampleReviewedClip(reviewedNumericClip(read('GR28'),'main',12).clip,0).assetId,
  sampleReviewedClip(reviewedNumericClip(read('GR28'),'main',12).clip,250).assetId,'weak walking remains walking in its own context');
});

test('real loader enters approved unbound/bound KO immediately and exits only on a new authoritative owner request; no Main mirror permission is inferred',async()=>{
 for(const code of ['GR28','MA08','MA33']){
  const d=read(code),base=baseline(),mock=mockPixi();
  base.runtime.sides.main.animations=[0,1,15,25].map(id=>({id,frames:[{ticks:1},{ticks:600}]}));
  const bundle=await attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:d.speciesId,usage:'general',
   baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  const actor=bundle.createActor({side:'main',nativeFramePresentation:true});
  for(const id of [15,25,15]){
   const expected=reviewedNumericClip(d,'main',id).clip.frames[0].assetId;
   assert.equal(actor.nativeFramePresenter.apply({sequenceId:id,frameIndex:0,elapsedQ12:0,flipBits:0}).assetId,expected);
   assert.equal(actor.nativeFramePresenter.apply({sequenceId:id,frameIndex:1,elapsedQ12:40960000,flipBits:0}).assetId,expected);
   assert.equal(actor.nativeFramePresenter.apply({sequenceId:id,frameIndex:1,elapsedQ12:0,flipBits:1}).fallback,true);
  }
  const recovered=actor.nativeFramePresenter.apply({sequenceId:0,frameIndex:0,elapsedQ12:0,flipBits:0});
  assert.equal(recovered.clipId,reviewedNumericClip(d,'main',0).clip.id);
  if(code==='GR28')for(const elapsedQ12 of [0,4096,40960000])assert.equal(actor.nativeFramePresenter.apply({sequenceId:1,frameIndex:0,elapsedQ12,flipBits:0}).assetId,'M02_03');
  await bundle.dispose();assert.equal(mock.loads.length,mock.unloads.length);
  const sub=await loadReviewedResultSub({PIXI:mock.PIXI,sprite:{texture:{},anchor:{set(){}}},speciesId:d.speciesId,sequenceId:5,
   baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  assert.equal(sub.sample(0).assetId,reviewedNumericClip(d,'main',15).clip.frames[0].assetId);
  assert.equal(sub.sample(1e8).assetId,reviewedNumericClip(d,'main',15).clip.frames[0].assetId);await sub.dispose();
 }
});

test('Main-only approval never implicitly grants Arena KO, including when an unapproved ko file exists',()=>{
 const d=read('MA08'),previous=JSON.parse(fs.readFileSync(provenance(d.rootArenaContextApproval.previousManifestPath),'utf8'));
 assert.ok(reviewedNumericClip(previous,'main',15));
 assert.equal(createReviewedArenaPlayback(previous).sample({...sampleState,hp:0}).fallbackSequenceId,15);
 const noApproval=structuredClone(d);delete noApproval.rootArenaContextApproval;
 assert.equal(reviewedArenaKoClip(noApproval),null);
 assert.equal(createReviewedArenaPlayback(noApproval).sample({...sampleState,hp:0}).fallbackSequenceId,15);
});

test('GR01 inventory resolves the reviewed numeric Main15 contract even with null action; discovery alone grants no flip or Arena reuse',()=>{
 const d=read('GR01'),numeric=d.clips.find(c=>c.id==='main:15');assert.equal(numeric.source.action,null);
 const inventory=reviewedKoCandidateClips(d),found=inventory.find(x=>x.clip.id==='main:15');
 assert.ok(found);assert.equal(found.clip.frames[0].assetId,'GR01_MAIN_pose_023');
 assert.equal(found.discovery,'REVIEWED_NUMERIC_MAIN15_CONTRACT');assert.equal(found.arenaReuseApproved,false);
 const noLabel=structuredClone(d);noLabel.clips.find(c=>c.id==='main:15').action=null;
 assert.ok(reviewedKoCandidateClips(noLabel).some(x=>x.clip.id==='main:15'));
 assert.equal(reviewedArenaKoClip(d).frames[0].assetId,'GR01_MAIN_pose_023');
});

test('all 99 registered actors consume separately approved static Arena KO; eight unregistered identities stay blocked',async()=>{
 let count=0;
 for(const entry of selection.characters){
  const d=read(entry.displayCode),ko=reviewedArenaKoClip(d);
  if(!entry.playableIdentity){assert.equal(ko,null);continue;}
  // Awakened deliveries: Arena KO only where root approved a shared General static pose; otherwise the native Main15 fallback.
  if(entry.displayCode.startsWith('AW')&&!d.rootArenaContextApproval){assert.equal(ko,null);
   assert.equal(createReviewedArenaPlayback(d).sample({...sampleState,hp:0}).fallbackSequenceId,15,entry.displayCode);continue;}
  assert.ok(ko,entry.displayCode);assert.equal(ko.frames.length,1);assert.equal(ko.loop,false);
  const playback=createReviewedArenaPlayback(d);playback.sample({...sampleState,time:0,vx:70});
  for(const time of [0.01,1,1000000]){
   const f=playback.sample({...sampleState,time,hp:0,vx:99});assert.equal(f.assetId,ko.frames[0].assetId);assert.equal(f.phase,'KO_STATIC_HOLD');assert.equal(f.terminal,true);
  }
  const alive=playback.sample({...sampleState,time:1000001,hp:100,vx:70});assert.equal(alive.action,'move');assert.notEqual(alive.assetId,ko.frames[0].assetId);
  const mock=mockPixi(),bundle=await attachReviewedCharacterAnimation({bundle:baseline(),PIXI:mock.PIXI,speciesId:entry.speciesId,usage:'arena',
   baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  const actor=bundle.createActor({side:'main'}),sample=actor.reviewedArena.sample({...sampleState,time:0,hp:0});
  assert.equal(sample.assetId,ko.frames[0].assetId);assert.equal(sample.mirrorX,false);assert.ok(sample.geometry);
  assert.equal(actor.reviewedArena.sample({...sampleState,time:5e6,hp:0}).assetId,sample.assetId);
  assert.equal(actor.reviewedArena.sample({...sampleState,time:5e6+1,hp:100,vx:40}).action,'move');
  await bundle.dispose();assert.equal(mock.loads.length,mock.unloads.length);if(!entry.displayCode.startsWith('AW'))count++;
 }
 assert.equal(count,99);
 assert.deepEqual(selection.characters.filter(e=>e.displayCode.startsWith('AW')&&reviewedArenaKoClip(read(e.displayCode))).map(e=>e.displayCode),['AW29','AW32','AW26']);
});

test('actual Arena scale function preserves native canvas/pivot and world placement across move/KO/revive including MA51 256x266',async()=>{
 for(const code of ['GR01','MA01','MA03','MA17','MA31','MA49','MA51','MA62']){
  const d=read(code),mock=mockPixi(),bundle=await attachReviewedCharacterAnimation({bundle:baseline(),PIXI:mock.PIXI,speciesId:d.speciesId,usage:'arena',
   baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  const actor=bundle.createActor({side:'main'}),sprite=actor.sprite;
  sprite.x=320;sprite.y=240;sprite.scale={set(x,y){this.x=x;this.y=y;}};
  const move=actor.reviewedArena.sample({...sampleState,time:0,vx:80});applyReviewedArenaPoseScale(sprite,move,78);
  const ko=actor.reviewedArena.sample({...sampleState,time:.1,hp:0}),f=d.frames[ko.assetId];
  const scale=applyReviewedArenaPoseScale(sprite,ko,78);
  assert.equal(scale,78/ko.geometry.referenceHeight/f.density);assert.ok(ko.geometry.referenceHeight>0&&ko.geometry.referenceHeight<64);assert.deepEqual([sprite.x,sprite.y],[320,240]);
  assert.deepEqual([sprite.anchor.x,sprite.anchor.y],[f.origin[0]/f.sourceSize[0],f.origin[1]/f.sourceSize[1]]);
  assert.deepEqual([sprite.texture.orig.width,sprite.texture.orig.height],f.sourceSize);
  const trim=f.trim??[0,0,...f.sourceSize];
  assert.ok(Math.abs((trim[0]-sprite.texture.orig.width*sprite.anchor.x)*sprite.scale.x-(trim[0]-f.origin[0])*78/ko.geometry.referenceHeight/f.density)<1e-8);
  assert.ok(Math.abs((trim[1]-sprite.texture.orig.height*sprite.anchor.y)*sprite.scale.y-(trim[1]-f.origin[1])*78/ko.geometry.referenceHeight/f.density)<1e-8);
  if(code==='MA51'){assert.deepEqual(f.sourceSize,[256,266]);assert.deepEqual(f.origin,[128,224]);}
  if(code==='MA31')assert.deepEqual(f.origin,[128,220]);
  const recovered=actor.reviewedArena.sample({...sampleState,time:20,hp:100,vx:80});applyReviewedArenaPoseScale(sprite,recovered,78);
  assert.equal(recovered.action,'move');assert.notEqual(recovered.assetId,ko.assetId);assert.deepEqual([sprite.x,sprite.y],[320,240]);
  await bundle.dispose();assert.equal(mock.loads.length,mock.unloads.length);
 }
});

test('four repaired native PNG selections are exact, scoped, and preserve MA31 restraint and MA51 full tail canvas',()=>{
 const review=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/reviewed107-ko-repair-root-review.v1.json'),'utf8'));
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,'tests/fixtures/reviewed107-ko-repair-frozen-manifest.v1.json'))).digest('hex'),'bd6edcc45b7f6f5c63f93e21a8ff4d3546ed22f08c03a04bb00db1acc2c167ec');
 for(const r of review.selected){
  const code=r.character.split('-')[0],d=read(code),bound=r.character.endsWith('-bound');
  const clip=reviewedNumericClip(d,'main',bound?25:15).clip,f=d.frames[clip.frames[0].assetId];
  const s=f.v1??f;
  assert.equal(s.sha256,r.sha256);assert.deepEqual(f.sourceSize,r.canvas);assert.deepEqual(f.origin,r.pivot);assert.equal(f.density,4);
  assert.equal(createHash('sha256').update(fs.readFileSync(provenance(path.join(path.dirname(selection.characters.find(e=>e.displayCode===code).path),s.image)))).digest('hex'),r.sha256);
  if(!bound){assert.equal(reviewedNumericClip(d,'sub',5).clip.frames[0].assetId,clip.frames[0].assetId);assert.equal(reviewedArenaKoClip(d).frames[0].assetId,clip.frames[0].assetId);}
 }
 assert.notEqual(reviewedNumericClip(read('MA31'),'main',25).clip.frames[0].assetId,reviewedArenaKoClip(read('MA31')).frames[0].assetId);
});


for(const [code,target] of [['MA01','MAIN_B16_v1/cell_09'],['MA02','MAIN_B16/cell_09'],['MA03','MAIN_B16/cell_11']]){
 test(`${code}: Main15 preserves falling transition then holds root-approved final KO through native stop, controller and battle`,async()=>{
  const d=read(code),policy=d.main15Terminal,clip=reviewedNumericClip(d,'main',15).clip;
  const oldBytes=fs.readFileSync(provenance(policy.previousManifestPath));
  assert.equal(createHash('sha256').update(oldBytes).digest('hex'),policy.previousManifestSha256);
  // web-v2 may move storage (image/sha256/frame/trim, Arena placement) but never identity or geometry.
  const identity=frames=>Object.fromEntries(Object.entries(frames).map(([k,{image,sha256,frame,trim,arena,v1,...rest}])=>[k,rest]));
  const old=JSON.parse(oldBytes);assert.deepEqual(identity(d.frames),identity(old.frames));assert.deepEqual(d.clips,old.clips);
  for(const [k,f] of Object.entries(d.frames)){const o=old.frames[k],s=f.v1??f;
   assert.deepEqual([s.image,s.sha256,s.frame??null,s.trim??null],[o.image,o.sha256,o.frame??null,o.trim??null],k);}
  assert.equal(policy.scope,'MAIN15_UNBOUND_ONLY');assert.equal(policy.frameIndex,1);assert.equal(policy.assetId,target);
  assert.equal(clip.frames[1].assetId,target);assert.notEqual(clip.frames[0].assetId,target);
  const transitionMs=clip.frames[0].durationMs;
  for(const t of [0,transitionMs-.001])assert.equal(sampleReviewedCharacterClip(d,'main',15,clip,t,{terminal:true}).assetId,clip.frames[0].assetId);
  for(const t of [transitionMs,1000,60000])assert.equal(sampleReviewedCharacterClip(d,'main',15,clip,t,{terminal:true}).assetId,target);
  assert.equal(sampleReviewedCharacterClip(d,'main',15,clip,0,{terminal:true,nativeActive:0}).assetId,target);
  assert.equal(sampleReviewedCharacterClip(d,'main',15,clip,0,{terminal:true,holdFirst:true}).assetId,target);
  assert.equal(sampleReviewedCharacterClip(d,'main',15,clip,NaN,{terminal:true,nativeActive:0}),null);
  // Ordinary previews and explicit recovery actions still have their own contract.
  assert.notEqual(sampleReviewedClip(clip,60000).assetId,target);
  const recovery=d.clips.find(c=>/recover/i.test(c.action));assert.ok(recovery);
  assert.deepEqual(sampleReviewedCharacterClip(d,'main',15,recovery,60000,{terminal:false}),sampleReviewedClip(recovery,60000));
  for(const [side,id] of [['main',25],['sub',5]]){
   const unchanged=reviewedNumericClip(d,side,id).clip;
   assert.deepEqual(sampleReviewedCharacterClip(d,side,id,unchanged,60000,{terminal:true}),sampleReviewedClip(unchanged,60000,{terminal:true}));
  }
  const config=PUBLIC_CHARACTER_DATA.characters.find(c=>c.entityId===PUBLIC_CHARACTER_DATA.speciesBindings.find(b=>b.speciesId===d.speciesId).entityId);
  const runtime=JSON.parse(fs.readFileSync(path.join(root,config.runtimePath),'utf8'));
  const sequence=runtime.sides.main.animations.find(s=>s.id===15);
  assert.equal(sequence.playbackMode,1);assert.equal(sequence.frames.length,1);
  const base=baseline(),mock=mockPixi();base.runtime=runtime;
  base.createActor=()=>({sprite:{texture:{legacy:true},anchor:{x:.3,y:.7,set(x,y){this.x=x;this.y=y;}}},
   controller:{setAnimation:id=>({legacy:true,id}),getSnapshot:()=>({legacy:true})},
   nativeFramePresenter:{apply:()=>({fallback:true})},battleAnimator:{apply:request=>request.nativeSample}});
  const bundle=await attachReviewedCharacterAnimation({bundle:base,PIXI:mock.PIXI,speciesId:d.speciesId,usage:'general',
   baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  const actor=bundle.createActor({side:'main'}),timeline=createNativeCharacterAnimationTimeline(sequence);
  for(let tick=0;tick<=3600;tick++){
   const snapshot=tick?timeline.advanceNative(4096):timeline.getSnapshot();
   const f=actor.nativeFramePresenter.apply({...snapshot,flipBits:0});
   const expected=tick*1000/60<transitionMs&&snapshot.active?clip.frames[0].assetId:target;
   assert.equal(f.assetId,expected,`${code} native tick${tick}`);
   if(tick===60||tick===3600){assert.equal(snapshot.active,0);assert.equal(snapshot.elapsedQ12,0);assert.equal(f.assetId,target);}
  }
  assert.equal(actor.nativeFramePresenter.apply({...timeline.getSnapshot(),flipBits:1}).fallback,true);
  assert.equal(actor.nativeFramePresenter.apply({...timeline.getSnapshot(),flipBits:0}).assetId,target);
  const idle=actor.nativeFramePresenter.apply({sequenceId:0,frameIndex:0,elapsedQ12:0,active:1,flipBits:0});
  assert.equal(idle.clipId,reviewedNumericClip(d,'main',0).clip.id);
  assert.equal(actor.nativeFramePresenter.apply({sequenceId:15,frameIndex:0,elapsedQ12:0,active:1,flipBits:0}).assetId,clip.frames[0].assetId);
  assert.equal(actor.controller.setAnimation(15).assetId,clip.frames[0].assetId);
  assert.equal(actor.controller.update({deltaMS:transitionMs-.001}).assetId,clip.frames[0].assetId);
  assert.equal(actor.controller.update({deltaMS:.001}).assetId,target);
  assert.equal(actor.controller.update({deltaMS:1000-transitionMs}).assetId,target);
  assert.equal(actor.controller.update({deltaMS:59000}).assetId,target);
  assert.equal(actor.controller.setAnimation(0).clipId,reviewedNumericClip(d,'main',0).clip.id);
  const battle=bundle.createActor({side:'main'});
  assert.equal(battle.battleAnimator.apply({sequenceId:15,nativeSample:{frameIndex:0,elapsedQ12:0,active:1}}).assetId,clip.frames[0].assetId);
  assert.equal(battle.battleAnimator.apply({sequenceId:15,nativeSample:{frameIndex:0,elapsedQ12:10*4096,active:1}}).assetId,target);
  for(const battleFrame of [60,3600])assert.equal(battle.battleAnimator.apply({sequenceId:15,battleFrame,nativeSample:{frameIndex:0,elapsedQ12:0,active:0}}).assetId,target);
  assert.equal(battle.battleAnimator.apply({sequenceId:0,nativeSample:{frameIndex:0,elapsedQ12:0,active:1}}).clipId,reviewedNumericClip(d,'main',0).clip.id);
  const arena=createReviewedArenaPlayback(d);
  for(const time of [0,1,60])assert.equal(arena.sample({...sampleState,time,hp:0}).assetId,target);
  assert.notEqual(arena.sample({...sampleState,time:61,hp:100}).action,'ko');
  await bundle.dispose();assert.equal(mock.loads.length,mock.unloads.length);
 });
}

test('Main15 final-pose policy is limited to three approved identities; other104 and all Sub/bound/recovery sampling remain identical',()=>{
 assert.deepEqual(selection.characters.filter(e=>read(e.displayCode).main15Terminal).map(e=>e.displayCode),['MA01','MA02','MA03']);
 for(const e of selection.characters){
  const d=read(e.displayCode);
  for(const side of ['main','sub'])for(let id=0;id<(side==='main'?40:13);id++){
   if(d.main15Terminal&&side==='main'&&id===15)continue;
   const binding=reviewedNumericClip(d,side,id);if(!binding)continue;
   for(const terminal of [false,true])for(const elapsed of [0,159,320,1000,60000])
    assert.deepEqual(sampleReviewedCharacterClip(d,side,id,binding.clip,elapsed,{terminal}),sampleReviewedClip(binding.clip,elapsed,{terminal}),`${e.displayCode}/${side}${id}`);
  }
 }
});

test('generalMirror roles load General frames mirrored about the pivot; Arena loads and other roles stay as stored',async()=>{
 // By-eye review 2026-10-29 (audit batch6/facing): these General sets are drawn facing away from the native cells.
 const flagged=selection.characters.filter(c=>c.generalMirror===true).map(c=>c.displayCode).sort();
 assert.deepEqual(flagged,['GR23','MA03','MA04','MA05','MA11','MA12','MA18','MA28','MA33','MA42','MA58','MA59','MA60']);
 for(const code of [...flagged,'GR10','MA16']){
  const entry=selection.characters.find(c=>c.displayCode===code),d=read(code),mirrored=entry.generalMirror===true;
  for(const usage of ['general','arena']){
   const mock=mockPixi(),bundle=await attachReviewedCharacterAnimation({bundle:baseline(),PIXI:mock.PIXI,speciesId:entry.speciesId,usage,
    baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
   const actor=bundle.createActor({animation:0});
   const s=usage==='general'?actor.controller.update({deltaMS:0}):actor.reviewedArena.sample({...sampleState});
   const f={...d.frames[s.assetId],...(usage==='arena'?d.frames[s.assetId].arena??{}:{})},trim=f.trim??[0,0,...f.sourceSize];
   const flip=mirrored&&usage==='general',off=(s.offset??[0,0])[0];
   assert.equal(actor.sprite.texture.rotate,flip?12:undefined,code+usage);
   assert.equal(actor.sprite.anchor.x,(flip?f.sourceSize[0]-f.origin[0]+off:f.origin[0]-off)/f.sourceSize[0],code+usage);
   if(flip)assert.deepEqual([actor.sprite.texture.trim.x,actor.sprite.texture.trim.width],[f.sourceSize[0]-trim[0]-trim[2],trim[2]],code);
   await bundle.dispose();
  }
 }
});

test('stage body size: Arena bodies reach the role height from one per-role reference; General Awakened sets draw at the stage scale',async()=>{
 // Measured 2026-10-29 (audit batch6/size): drawn idle height GR ~20, MA ~35, new AW ~87 native px; target AW ~49 (between MA and UL ~68).
 assert.deepEqual(selection.characters.filter(c=>c.generalDisplayScale!==undefined).map(c=>[c.displayCode,c.generalDisplayScale]),
  ['AW29','AW25','AW28','AW32','AW26','AW27','AW31'].map(c=>[c,0.56]));
 for(const code of ['GR01','MA05','AW29']){
  const entry=selection.characters.find(c=>c.displayCode===code),d=read(code);
  const load=async usage=>{const mock=mockPixi();return attachReviewedCharacterAnimation({bundle:baseline(),PIXI:mock.PIXI,speciesId:entry.speciesId,usage,baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});};
  const arena=await load('arena'),a=arena.createActor({animation:0}),walk=a.reviewedArena.sample({...sampleState,vy:1});
  const sprite={scale:{set(x,y){this.x=x;this.y=y;}}},scale=applyReviewedArenaPoseScale(sprite,walk,78);
  const b=walk.geometry.nativeBounds;assert.ok(Math.abs((b[3]-b[1])*walk.geometry.scale*scale-78)<78*0.2,code);// a D walk frame stands near the role height
  await arena.dispose();
  const general=await load('general'),g=general.createActor({animation:0}).controller.update({deltaMS:0}),f=d.frames[g.assetId];
  assert.equal(g.geometry.scale,f.density/(entry.generalDisplayScale??1),code);await general.dispose();
 }
});

test('arenaGroundFromWalk sets put the walking feet of each direction on the pivot with one shift per direction',async()=>{
 // Audit 2026-10-29 (batch6/fullcanvas): these Arena pivots sit inside the body (median feet 6-19 native px below).
 assert.deepEqual(selection.characters.filter(c=>c.arenaGroundFromWalk===true).map(c=>c.displayCode).sort(),['GR10','GR17','GR22','GR37','GR39','GR40','GR41']);
 for(const code of ['GR37','GR10','MA05']){
  const entry=selection.characters.find(c=>c.displayCode===code),mock=mockPixi();
  const bundle=await attachReviewedCharacterAnimation({bundle:baseline(),PIXI:mock.PIXI,speciesId:entry.speciesId,usage:'arena',baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  const s=bundle.createActor({animation:0}).reviewedArena.sample({...sampleState,vy:1}),feet=s.geometry.nativeBounds[3];
  if(entry.arenaGroundFromWalk)assert.ok(Math.abs(feet)<3&&s.geometry.groundShift>4,code);else assert.equal(s.geometry.groundShift,undefined,code);
  await bundle.dispose();
 }
});
