import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {COMPLETED_ORIGINAL_CHARACTERS} from '../src/championship/presentation/completedOriginalCharacterCatalog.js';
import {validateCompletedOriginalRuntime} from '../src/championship/presentation/completedOriginalCharacters.js';
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
