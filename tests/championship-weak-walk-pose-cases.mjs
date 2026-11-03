import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reviewedNumericClip} from '../src/championship/presentation/reviewedCharacterAnimation.js';
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
const KNOWN_SINGLE_DRAWING_MAIN12=['MA03','MA04','MA05','MA06','MA07','MA08','MA09','MA10','MA11','MA12','MA13','MA14','MA15',
 'MA16','MA17','MA18','MA19','MA20','MA21','MA22','MA23','MA25','MA26','MA27','MA28','MA29','MA30','MA31','MA32','MA35','MA36',
 'MA37','MA38','MA39','MA40','MA41','MA42','MA43','MA44','MA45','MA46','MA47','MA48','MA49','MA51','MA52','MA53','MA62','MA65',
 'MA66','MA67','MA68','MA69'];

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
