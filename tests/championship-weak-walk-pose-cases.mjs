import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reviewedNumericClip,reviewedArenaKoClip,createReviewedArenaPlayback} from '../src/championship/presentation/reviewedCharacterAnimation.js';
const root=path.resolve(import.meta.dirname,'..');
const json=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const selection=json('src/data/championship/reviewed-animation-selection.v1.json');
const catalog=json('src/data/championship/public-character-catalog.v1.json');
const runtimeOf=new Map(catalog.characters.map(c=>[c.speciesId,c.runtimePath]));
const manifest=entry=>{const d=json(entry.path);return {...d,frames:Object.fromEntries(d.frames.map(({id,...f})=>[id,f]))};};

// Locomotion sequences the ranch moves a body with while the native timeline plays.
const LOCOMOTION=[2,3,12,18,19,22];
// A body moved across the ranch on one held drawing reads as a sliding statue whenever the original
// alternates two or more drawings there. Main12 (weak walk, cells 37/37 ticks) is still one drawing for
// these selected roles; each needs its own second drawing (no healthy-walk stand-in). Shrink, never grow.
// 2026-11-04: MA23, MA31 and MA51 got dot's two-pose weak moves; MA05, MA07, MA09, MA10, MA13, MA14, MA17, MA36,
// MA47, MA49 and MA66 got dot's four-slot cycles.
const KNOWN_SINGLE_DRAWING_MAIN12=['MA03','MA04','MA06','MA08','MA11','MA12','MA15',
 'MA16','MA18','MA19','MA20','MA21','MA22','MA25','MA26','MA27','MA28','MA29','MA30','MA32','MA35',
 'MA37','MA38','MA39','MA40','MA41','MA42','MA43','MA44','MA45','MA46','MA48','MA52','MA53','MA62','MA65',
 'MA67','MA68','MA69'];

test('a moving body never holds one drawing where the original alternates drawings (known Main12 gaps only)',()=>{
 const found=[];
 for(const entry of selection.characters){
  const runtimePath=runtimeOf.get(entry.speciesId);if(!runtimePath)continue;
  const native=new Map(json(runtimePath).sides.main.animations.map(a=>[a.id,a])),doc=manifest(entry);
  for(const id of LOCOMOTION){
   const cells=new Set((native.get(id)?.frames??[]).map(f=>f.cell)),binding=reviewedNumericClip(doc,'main',id);
   if(binding&&cells.size>1&&new Set(binding.clip.frames.map(f=>f.assetId)).size===1)found.push(`${entry.displayCode}:${id}`);
  }
 }
 assert.deepEqual(found,KNOWN_SINGLE_DRAWING_MAIN12.map(code=>`${code}:12`));
});

test('MA24 weak walk plays its two delivered drawings at the native 37/37 ticks',()=>{
 const entry=selection.characters.find(c=>c.displayCode==='MA24'),binding=reviewedNumericClip(manifest(entry),'main',12);
 assert.equal(binding.mappingEvidence,'EXPLICIT_NUMERIC_SELECTION');
 assert.deepEqual(binding.clip.frames.map(f=>[f.assetId,Math.round(f.durationMs*60/1000)]),
  [['ma24-main12:20261103:1',37],['ma24-main12:20261103:2',37]]);
 const native=json(runtimeOf.get(entry.speciesId)).sides.main.animations.find(a=>a.id===12);
 assert.deepEqual(native.frames.map(f=>f.ticks),[37,37]);
});

// Owner 2026-11-03 「Fix now with existing art」: walks whose original keeps both cells on the ground no longer jump,
// and the bound weak idle (Main17) no longer flips between standing and lying flat. Feet = alpha-box bottom below
// the pivot plus the clip offset, in native px.
const byCode=code=>manifest(selection.characters.find(c=>c.displayCode===code));
const feet=(d,clip)=>clip.frames.map(fr=>{const f0=d.frames[fr.assetId],f=clip.mode==='arena'&&f0.arena?{...f0,...f0.arena}:f0;
 return (f.trim[1]+f.trim[3]-f.origin[1]+(fr.offset?.[1]??0))/f.density;});
const GROUNDED_WALKS={MA02:['general/MAIN_A16/source_left_threequarter/walk','general/MAIN_A16/source_left_threequarter/run',
 'arena/ARENA_R_UR16/R/walk','arena/ARENA_L_DL16/L/walk'],MA15:['arena/ARENA_D_DR16_v1/DR/walk','arena/ARENA_L_DL16_v1/DL/walk'],
 MA21:['arena/ARENA_D_DR16_v1/D/walk'],MA01:['general/MAIN_A16/main_reference_facing/walk','general/MAIN_A16/main_reference_facing/run']};
// Still airborne: their only other drawings repeat the first pose, so removing the jump would leave a slide. Needs dot.
const KNOWN_AIRBORNE_WALKS=['MA02:arena/ARENA_D_DR16/DR/walk','MA02:arena/ARENA_R_UR16/UR/walk','MA02:arena/ARENA_U_UL16/UL/walk','MA02:arena/ARENA_L_DL16/DL/walk'];

test('re-bound walks keep every frame on the ground and keep at least two distinct drawings',()=>{
 for(const [code,ids] of Object.entries(GROUNDED_WALKS)){
  const d=byCode(code);
  for(const id of ids){
   const clip=d.clips.find(c=>c.id===id);assert.ok(clip,code+' '+id);
   assert.ok(new Set(clip.frames.map(f=>f.assetId)).size>=2,code+' '+id+' must still alternate');
   for(const v of feet(d,clip))assert.ok(Math.abs(v)<=3,`${code} ${id} feet ${v}`);
  }
  assert.ok(d.patch20261103===undefined,'public manifests carry no authoring block');
 }
 const airborne=[];
 for(const code of ['MA02']){const d=byCode(code);
  for(const clip of d.clips.filter(c=>c.action==='move'))if(feet(d,clip).some(v=>v<-3))airborne.push(`${code}:${clip.id}`);}
 assert.deepEqual(airborne,KNOWN_AIRBORNE_WALKS);
});

test('Main17 bound weak idle stays a standing pose (no lying-flat frame) for GR03 and GR37',()=>{
 for(const code of ['GR03','GR37']){
  const d=byCode(code),weak=reviewedNumericClip(d,'main',17).clip,stand=reviewedNumericClip(d,'main',16).clip;
  const h=clip=>clip.frames.map(f=>d.frames[f.assetId].trim[3]/d.frames[f.assetId].density);
  const standing=Math.max(...h(stand));
  for(const v of h(weak))assert.ok(v>=0.8*standing,`${code} Main17 frame height ${v} vs standing ${standing}`);
  assert.equal(Math.round(weak.frames.reduce((n,f)=>n+f.durationMs,0)*60/1000),37+28);
 }
});

test('MA23, MA31 and MA51 weak moves alternate two delivered drawings at the native 37/37 ticks, on the old weak ground line',()=>{
 for(const code of ['MA23','MA31','MA51']){
  const entry=selection.characters.find(c=>c.displayCode===code),doc=manifest(entry),binding=reviewedNumericClip(doc,'main',12);
  assert.equal(binding.mappingEvidence,'EXPLICIT_NUMERIC_SELECTION',code);
  assert.deepEqual(binding.clip.frames.map(f=>[f.assetId,Math.round(f.durationMs*60/1000)]),
   [[`weak12:${code}:20261104:1`,37],[`weak12:${code}:20261104:2`,37]],code);
  const native=json(runtimeOf.get(entry.speciesId)).sides.main.animations.find(a=>a.id===12);
  assert.deepEqual(native.frames.map(f=>f.ticks),[37,37],code);
  for(const f of binding.clip.frames)assert.ok(doc.frames[f.assetId].density<=8,code+' stays within the 2x grid');
 }
});

// Owner 2026-11-04 「Allow 4-pose cycle」: four sequence positions keep the original's 74-tick cycle (37+37).
test('four-slot weak cycles keep the native 74-tick cycle and stay within the 2x grid',()=>{
 for(const code of ['MA05','MA07','MA09','MA10','MA13','MA14','MA17','MA36','MA47','MA49','MA66']){
  const entry=selection.characters.find(c=>c.displayCode===code),doc=manifest(entry),binding=reviewedNumericClip(doc,'main',12);
  assert.equal(binding.mappingEvidence,'EXPLICIT_NUMERIC_SELECTION',code);
  const ticks=binding.clip.frames.map(f=>Math.round(f.durationMs*60/1000));
  assert.deepEqual(ticks,[19,18,19,18],code);
  const native=json(runtimeOf.get(entry.speciesId)).sides.main.animations.find(a=>a.id===12);
  assert.equal(native.frames.reduce((n,f)=>n+f.ticks,0),ticks.reduce((n,t)=>n+t,0),code);
  assert.ok(new Set(binding.clip.frames.map(f=>f.assetId)).size>=3,code+' keeps at least three drawings');
  for(const f of binding.clip.frames){assert.ok(f.assetId.startsWith(`weak12:${code}:20261104b:`),code);assert.ok(doc.frames[f.assetId].density<=8,code);}
 }
});

test('the eight playable originals hold their own static Arena KO frame when knocked out',()=>{
 for(const code of ['GR39','GR40','GR41','MA65','MA66','MA67','MA68','MA69']){
  const doc=manifest(selection.characters.find(c=>c.displayCode===code)),ko=reviewedArenaKoClip(doc);
  assert.ok(ko,code+' has an approved KO clip');assert.equal(ko.frames.length,1,code);
  const pb=createReviewedArenaPlayback(doc,{nativeFallback:false});
  pb.sample({time:0,hp:100,vx:1,vy:0,facing:1});
  const s=pb.sample({time:2000,hp:0,vx:0,vy:0,facing:1});
  assert.equal(s.phase,'KO_STATIC_HOLD',code);assert.equal(s.assetId,ko.frames[0].assetId,code);
 }
});
