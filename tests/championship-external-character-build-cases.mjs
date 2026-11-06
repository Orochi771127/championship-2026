import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as esbuild from 'esbuild';
import {createHash} from 'node:crypto';
import {readExternalCharacterRelease,externalCharacterPublicationPlan,assertExternalCharacterPartition,
 validateCharacterAssetSnapshot,EXTERNAL_CHARACTER_CONTRACT,EXTERNAL_CHARACTER_FILES} from '../scripts/lib/external-character-assets.mjs';
import {buildWebArtifact,validateWebArtifact,PLAYTEST_TARGET} from '../scripts/lib/web-build-artifact.mjs';
import {PUBLIC_RUNTIME_INDEX_PATH,PUBLIC_RUNTIME_ALLOWLIST_PATH,publicRuntimeIndex,assertPublicBytes} from '../scripts/lib/public-runtime-boundary.mjs';
import {BUILD_INPUT_PATH,ART_INDEX_PATH,RIGHTS_PATH,PLAYTEST_PATH} from '../scripts/lib/web-build-plan.mjs';
import {openingFilmPublicationFiles} from '../scripts/lib/opening-film-publication.mjs';
import {decodeBuildManifest} from '../scripts/lib/build-manifest-codec.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const version='63776034296faa32f3498f94396c0e825403a340';
const baseUrl=`https://orochi771127.github.io/cyber-partner-runtime-assets/v/${version}/`;
const prefix='assets/production/characters/';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');

function fixture(t){
 const temp=path.join(repo,'.tmp');fs.mkdirSync(temp,{recursive:true});const root=fs.mkdtempSync(path.join(temp,'external-character-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const write=(file,value)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
 const read=file=>fs.readFileSync(path.join(root,file));
 const image=prefix+'fixture/main.png',runtime=prefix+'fixture/runtime.render.json';
 write(image,png);write(runtime,{schemaVersion:1,image:'main.png'});
 const entry='src/championship/app/main.js',helper='src/championship/presentation/characterAssetDelivery.js';
 write(helper,fs.readFileSync(path.join(repo,helper)));
 write(entry,`import {characterAssetUrl} from '../presentation/characterAssetDelivery.js'; export const spriteUrl=characterAssetUrl(${JSON.stringify(runtime)},'https://orochi771127.github.io/championship-2026/');`);
 write('championship.html','<script type="importmap">{"imports":{}}</script>\n    <!-- modulepreload: fixture -->\n    <!-- /modulepreload -->\n<script type="module" src="./src/championship/app/main.js?v=settings-2"></script>');
 write(ART_INDEX_PATH,{entries:[]});write(RIGHTS_PATH,{entries:[]});
 write(PLAYTEST_PATH,{id:'EXTERNAL_CHARACTER_TEST',status:'OWNER_AUTHORIZED_PUBLIC_PLAYTEST',origin:'https://orochi771127.github.io',basePath:'/championship-2026/',rightsDocumentVerified:false,commercialReleaseAccepted:false});
 const selected=['championship.html',entry,helper,image,runtime,PUBLIC_RUNTIME_INDEX_PATH];
 for(const row of openingFilmPublicationFiles()){write(row.path,fs.readFileSync(path.join(repo,row.path)));selected.push(row.path);}
 const allowlist={schemaVersion:1,files:selected.map(file=>({path:file,sha256:file===PUBLIC_RUNTIME_INDEX_PATH?'0'.repeat(64):sha(read(file)),
  ...(file===runtime?{jsonFields:['schemaVersion','image']}:{})})),assets:[{id:'character:test:image',src:image,sha256:sha(png),width:1,height:1}]};
 write(PUBLIC_RUNTIME_INDEX_PATH,publicRuntimeIndex(allowlist));allowlist.files.find(row=>row.path===PUBLIC_RUNTIME_INDEX_PATH).sha256=sha(read(PUBLIC_RUNTIME_INDEX_PATH));
 write(PUBLIC_RUNTIME_ALLOWLIST_PATH,allowlist);
 const input={schemaVersion:2,authoring:{indexPath:ART_INDEX_PATH,policyPath:PLAYTEST_PATH},files:selected,moduleEntries:[entry,helper],importMap:{},
  browserBundle:{version:1,entry,outputDirectory:'src/championship/app/_bundled',toolVersion:esbuild.version},
  release:{evidenceIds:[],platform:'WEB',territories:['TW']},publicPlaytest:{policyId:'EXTERNAL_CHARACTER_TEST',files:allowlist.files.map(({path,sha256})=>({path,sha256}))}};
 write(BUILD_INPUT_PATH,input);
 const rows=[image,runtime].map(file=>({path:file,bytes:read(file).length,sha256:sha(read(file))}));
 const manifest={schemaVersion:1,sourceRepository:'Orochi771127/championship-2026',sourceCommit:version,assetPrefix:prefix,files:rows,
  totalBytes:rows.reduce((n,row)=>n+row.bytes,0),fileCount:rows.length,generatedAt:'2026-11-04T20:21:05Z'};
 function release(status='VERIFIED',value=manifest){
  write(EXTERNAL_CHARACTER_FILES,value);write(EXTERNAL_CHARACTER_CONTRACT,{schemaVersion:1,status,assetBaseUrl:baseUrl,manifestPath:EXTERNAL_CHARACTER_FILES,manifestSha256:sha(read(EXTERNAL_CHARACTER_FILES))});
 }
 release();
 const sourcePlan={files:selected,allowlist};
 const snapshot=path.join(root,'host-version');
 function makeSnapshot(){
  for(const row of rows){const dest=path.join(snapshot,row.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,read(row.path));}
  fs.writeFileSync(path.join(snapshot,'runtime-manifest.json'),read(EXTERNAL_CHARACTER_FILES));
 }
 return {root,write,read,image,runtime,entry,helper,allowlist,input,manifest,rows,release,sourcePlan,snapshot,makeSnapshot};
}

test('a verified immutable release matches the exact selected source bytes and partition',t=>{
 const f=fixture(t),release=readExternalCharacterRelease(f.root,f.sourcePlan);
 assert.equal(release.receipt.fileCount,2);assert.equal(release.receipt.totalBytes,f.manifest.totalBytes);assert.equal(release.receipt.manifestUrl,baseUrl+'runtime-manifest.json');
 const plan=externalCharacterPublicationPlan(f.sourcePlan,release);
 assert.ok(!plan.files.some(file=>file.startsWith(prefix)));assert.equal(plan.files.length+release.files.length,f.sourcePlan.files.length);
 assert.doesNotThrow(()=>assertExternalCharacterPartition(plan,plan.files));
 assert.throws(()=>assertExternalCharacterPartition(plan,[...plan.files,f.image]),/STILL_IN_GAME_ARTIFACT/);
 assert.throws(()=>externalCharacterPublicationPlan(f.sourcePlan,{...release,files:release.files.slice(1)}),/PARTITION_CLOSURE/);
 const forged={...release,files:release.files.map((row,i)=>i?row:{...row,sha256:'0'.repeat(64)})};
 assert.throws(()=>externalCharacterPublicationPlan(f.sourcePlan,forged),/PARTITION_HASH/);
});

test('unverified endpoints, changed bytes, missing files and incomplete releases fail closed',t=>{
 const f=fixture(t);
 f.release('PENDING_ENDPOINT_VERIFICATION');assert.throws(()=>readExternalCharacterRelease(f.root,f.sourcePlan),/NOT_VERIFIED/);f.release();
 f.write(f.image,Buffer.concat([png,Buffer.from('changed')]));assert.throws(()=>readExternalCharacterRelease(f.root,f.sourcePlan),/SOURCE_HASH/);f.write(f.image,png);
 fs.unlinkSync(path.join(f.root,f.image));assert.throws(()=>readExternalCharacterRelease(f.root,f.sourcePlan),/FILE_MISSING/);f.write(f.image,png);
 const incomplete={...f.manifest,files:f.rows.slice(1),fileCount:1,totalBytes:f.rows[1].bytes};f.release('VERIFIED',incomplete);
 assert.throws(()=>readExternalCharacterRelease(f.root,f.sourcePlan),/SELECTION_CLOSURE/);f.release();
 f.write(EXTERNAL_CHARACTER_FILES,JSON.stringify(f.manifest)+' ');assert.throws(()=>readExternalCharacterRelease(f.root,f.sourcePlan),/MANIFEST_HASH/);
});

test('the host snapshot validator rejects extra private files, missing images and changed bytes',t=>{
 const f=fixture(t);f.makeSnapshot();
 const options={expectedManifestSha256:sha(f.read(EXTERNAL_CHARACTER_FILES)),allowlist:f.allowlist,assertBytes:assertPublicBytes};
 assert.deepEqual(validateCharacterAssetSnapshot(f.snapshot,options),{manifestSha256:options.expectedManifestSha256,fileCount:2,totalBytes:f.manifest.totalBytes,sourceCommit:version});
 fs.writeFileSync(path.join(f.snapshot,'private-notes.txt'),'not public');assert.throws(()=>validateCharacterAssetSnapshot(f.snapshot,options),/FILE_SET/);fs.unlinkSync(path.join(f.snapshot,'private-notes.txt'));
 fs.writeFileSync(path.join(f.snapshot,f.image),Buffer.from('changed'));assert.throws(()=>validateCharacterAssetSnapshot(f.snapshot,options),/SNAPSHOT_HASH/);fs.writeFileSync(path.join(f.snapshot,f.image),png);
 fs.unlinkSync(path.join(f.snapshot,f.image));assert.throws(()=>validateCharacterAssetSnapshot(f.snapshot,options),/FILE_SET/);
});

test('default full build preserves assets; explicit external build omits only verified assets and validates its receipt',async t=>{
 const f=fixture(t),full=path.join(f.root,'dist/full'),external=path.join(f.root,'dist/external');
 f.release('PENDING_ENDPOINT_VERIFICATION');
 const local=buildWebArtifact({root:f.root,output:full,target:PLAYTEST_TARGET});assert.equal(local.manifest.externalCharacterAssets,undefined);
 assert.ok(fs.existsSync(path.join(full,f.image)));assert.ok(fs.existsSync(path.join(full,f.runtime)));
 assert.doesNotThrow(()=>validateWebArtifact({root:f.root,output:full,target:PLAYTEST_TARGET}));
 const preserved=fs.readFileSync(path.join(full,'pages-build.json'));
 assert.throws(()=>buildWebArtifact({root:f.root,output:full,target:PLAYTEST_TARGET,externalCharacters:true}),/NOT_VERIFIED/);
 assert.ok(fs.readFileSync(path.join(full,'pages-build.json')).equals(preserved));
 f.release();f.makeSnapshot();validateCharacterAssetSnapshot(f.snapshot,{allowlist:f.allowlist,assertBytes:assertPublicBytes});
 const result=buildWebArtifact({root:f.root,output:external,target:PLAYTEST_TARGET,externalCharacters:true});
 assert.equal(result.manifest.externalCharacterAssets.manifestSha256,sha(f.read(EXTERNAL_CHARACTER_FILES)));
 assert.ok(!fs.existsSync(path.join(external,'assets/production/characters')));
 assert.doesNotThrow(()=>validateWebArtifact({root:f.root,output:external,target:PLAYTEST_TARGET,externalCharacters:true}));
 const program=fs.readFileSync(path.join(external,result.manifest.browserBundle.entry));
 const module=await import('data:text/javascript;base64,'+program.toString('base64'));assert.equal(module.spriteUrl,baseUrl+f.runtime);
 const receipt=decodeBuildManifest(JSON.parse(fs.readFileSync(path.join(external,'pages-build.json'),'utf8')));
 assert.ok(receipt.files.every(row=>!row.path.startsWith(prefix)));assert.equal(receipt.externalCharacterAssets.fileCount,2);
 const contract=JSON.parse(f.read(EXTERNAL_CHARACTER_CONTRACT));f.write(EXTERNAL_CHARACTER_CONTRACT,{...contract,status:'PENDING_ENDPOINT_VERIFICATION'});
 assert.throws(()=>validateWebArtifact({root:f.root,output:external,target:PLAYTEST_TARGET}),/NOT_VERIFIED/);
});
