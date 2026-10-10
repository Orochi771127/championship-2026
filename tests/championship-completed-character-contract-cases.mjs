import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {COMPLETED_ORIGINAL_CHARACTERS} from '../src/championship/presentation/completedOriginalCharacterCatalog.js';
import {applyCompletedOriginalHudArt,validateCompletedOriginalRuntime} from '../src/championship/presentation/completedOriginalCharacters.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const packaged=read('tests/fixtures/packaged-character-integrity-20261010.json');
const root=packaged.root;
const config=COMPLETED_ORIGINAL_CHARACTERS.find(c=>c.entityId==='m202_armadimon');
const runtime=read(`${root}${config.folder}/runtime.review.json`);
const baseline=read(`assets/production/internal-faithful-baseline/characters-v1/${config.entityId}/runtime.json`);

test('all 222 packaged runtimes, including the 38 growth sidecar exceptions, preserve full native motion and geometry',()=>{
 assert.equal(COMPLETED_ORIGINAL_CHARACTERS.length,222);
 assert.deepEqual(COMPLETED_ORIGINAL_CHARACTERS.map(c=>c.entityId),packaged.entityIds);
 assert.equal(packaged.sourceSidecarsWithoutDensity.length,38);
 const exceptions=new Set(packaged.sourceSidecarsWithoutDensity.map(c=>c.entityId));
 assert.equal(exceptions.size,38);
 for(const c of COMPLETED_ORIGINAL_CHARACTERS){
  const runtime=read(`${root}${c.folder}/runtime.review.json`);
  validateCompletedOriginalRuntime(runtime,c,
    read(`assets/production/internal-faithful-baseline/characters-v1/${c.entityId}/runtime.json`));
  exceptions.delete(c.entityId);
 }
 assert.equal(exceptions.size,0);
});
test('all 5422 actual packaged runtime, atlas and HUD files match the frozen candidate bytes',()=>{
 assert.equal(root,'assets/production/characters/accepted-20261010/');
 assert.equal(packaged.files.length,5422);
 assert.equal(new Set(packaged.files.map(f=>f.path)).size,5422);
 for(const file of packaged.files){
  assert.ok(!file.path.startsWith('/')&&!file.path.includes('..')&&!file.path.includes('\\'));
  const bytes=fs.readFileSync(root+file.path);
  assert.equal(bytes.length,file.bytes,file.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
 }
});
for(const [name,change,error] of [
 ['missing schema version',r=>{delete r.schemaVersion;},/RUNTIME_SCHEMA/],
 ['wrong renderer',r=>{r.renderer='OTHER';},/RUNTIME_SCHEMA/],
 ['missing profile',r=>{delete r.artProfile;},/PROFILE_DRIFT/],
 ['missing runtime scale',r=>{delete r.artProfile.scale;},/PROFILE_DRIFT/],
 ['wrong runtime scale',r=>{r.artProfile.scale=2;},/PROFILE_DRIFT/],
 ['missing frame scale',r=>{delete Object.values(r.reviewGeometry.frames)[0].scale;},/ORIGIN_DRIFT/],
 ['wrong frame scale',r=>{Object.values(r.reviewGeometry.frames)[0].scale=2;},/ORIGIN_DRIFT/],
 ['missing geometry',r=>{delete r.reviewGeometry;},/ORIGIN_DRIFT/],
 ['changed native origin',r=>{Object.values(r.reviewGeometry.frames)[0].origin[0]++;},/ORIGIN_DRIFT/],
 ['changed animation ticks',r=>{r.sides.main.animations[0].frames[0].ticks++;},/MOTION_DRIFT/]
])test(`${name} cannot pass the shared live-loader contract`,()=>{
 const candidate=structuredClone(runtime);change(candidate);
 assert.throws(()=>validateCompletedOriginalRuntime(candidate,config,baseline),error);
});

test("public image aliases preserve exact source bytes within each character directory",()=>{
 for(const a of packaged.sameDirectoryImageAliases){assert.equal(a.original.slice(0,a.original.lastIndexOf("/")),a.canonical.slice(0,a.canonical.lastIndexOf("/")));for(const f of [a.original,a.canonical])assert.equal(createHash("sha256").update(fs.readFileSync(root+f)).digest("hex"),a.sha256);}
});

const publicBase='https://orochi771127.github.io/championship-2026/';
function hudMaps(){
 const hud=read('assets/production/internal-faithful-baseline/character-hud-v1/manifest.json');
 return {portraits:new Map(hud.portraits.map(p=>[p.speciesId,p])),battle:new Map(hud.battle.map(b=>[b.speciesId,{sequences:b.sequences,cells:new Map(b.cells.map(c=>[c.cell,c]))}]))};
}
test('cold HUD fetches overlap within six requests, retry one transient failure, and retain all 222 bindings and aliases',async()=>{
 const maps=hudMaps(),counts=new Map(),warnings=[];let active=0,peak=0;
 const first=COMPLETED_ORIGINAL_CHARACTERS[0].folder;
 const warn=console.warn;console.warn=(...a)=>warnings.push(a);
 try{await applyCompletedOriginalHudArt({baseUrl:publicBase,...maps,fetchImpl:async url=>{
   const p=url.href.slice(publicBase.length),n=(counts.get(p)??0)+1;counts.set(p,n);active++;peak=Math.max(peak,active);
   await new Promise(setImmediate);active--;
   if(p.includes('/'+first+'/')&&n===1)return {ok:false,status:503};
   return {ok:true,status:200,json:async()=>read(p)};
 }});}finally{console.warn=warn;}
 assert.equal(peak,6);assert.equal(active,0);assert.equal(counts.size,222);assert.equal([...counts.values()].reduce((a,b)=>a+b,0),223);assert.deepEqual(warnings,[]);
 for(const c of COMPLETED_ORIGINAL_CHARACTERS){assert.equal(maps.portraits.get(c.speciesId).entityId,c.entityId);assert.ok(maps.battle.get(c.speciesId).cells.size>0);}
 for(const [id,entity] of [['species-096','m330_geograymon'],['species-097','m331_seadramon'],['species-224','m201_agumon'],['species-225','m509_shinegraymon']])assert.equal(maps.portraits.get(id).entityId,entity);
});
test('HUD retries stay bounded and missing or invalid manifests retain their original fallback',async()=>{
 const maps=hudMaps(),before=new Map(maps.portraits),configs=COMPLETED_ORIGINAL_CHARACTERS.slice(0,3),counts=new Map(),warnings=[];
 const warn=console.warn;console.warn=(...a)=>warnings.push(a);
 try{await applyCompletedOriginalHudArt({baseUrl:publicBase,...maps,fetchImpl:async url=>{
   const p=url.href.slice(publicBase.length);counts.set(p,(counts.get(p)??0)+1);
   if(p.includes('/'+configs[0].folder+'/'))return {ok:false,status:404};
   if(p.includes('/'+configs[1].folder+'/'))return {ok:false,status:503};
   const m=read(p);if(p.includes('/'+configs[2].folder+'/'))m.battle.sequences[0].frames[0].ticks++;
   return {ok:true,status:200,json:async()=>m};
 }});}finally{console.warn=warn;}
 for(const c of configs)assert.equal(maps.portraits.get(c.speciesId),before.get(c.speciesId));
 assert.equal(counts.get(root+configs[0].folder+'/hud-r01/manifest.json'),1);
 assert.equal(counts.get(root+configs[1].folder+'/hud-r01/manifest.json'),2);
 assert.equal(counts.get(root+configs[2].folder+'/hud-r01/manifest.json'),1);
 assert.equal(warnings.length,3);assert.ok(warnings.some(w=>w[2]==='CANDIDATE_HUD_TIMING_DRIFT'));
});
