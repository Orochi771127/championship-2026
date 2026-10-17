import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {selectedShopCageProjection,SHOP_CAGE_PUBLIC,SHOP_CAGE_FIELDS,SHOP_CAGE_SOURCE} from '../scripts/lib/public-shop-cage-projection.mjs';
import {publicRuntimeIndex,assertPublicArtifact,assertPublicBytes,PUBLIC_RUNTIME_INDEX_PATH} from '../scripts/lib/public-runtime-boundary.mjs';
import {originalShopCageThumbnail} from '../src/championship/presentation/originalShopCageArt.js';
import {publicRuntimeAsset} from '../src/championship/presentation/publicRuntimeAssets.js';
import {shopGoodsPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const input=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'),index=read('assets/production/ART_PRODUCTION_INDEX.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){
  const base=path.join(root,'.tmp');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'public-shop-'));
  t.after(()=>{const rel=path.relative(fs.realpathSync(base),fs.realpathSync(dir));assert.ok(rel.startsWith('public-shop-')&&!rel.includes(path.sep)&&!path.isAbsolute(rel));fs.rmSync(dir,{recursive:true});});
  const write=(file,data)=>{fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),data);};
  return {dir,write};
}
test('original thumbnail projection retains exact 35 runtime image and identity bindings without intake data',()=>{
  const selected=selectedShopCageProjection({root,input,index});
  const source=read(SHOP_CAGE_SOURCE),manifest=read(SHOP_CAGE_PUBLIC);
  assert.deepEqual(manifest,selected.manifest);assert.equal(selected.files.size,35);
  assert.deepEqual(Object.keys(manifest),['schemaVersion','records']);
  for(const row of manifest.records){
    assert.deepEqual(Object.keys(row),SHOP_CAGE_FIELDS.slice(2));
    const original=source.records.find(other=>other.shopRecordIndex===row.shopRecordIndex);
    for(const [key,value] of Object.entries(row))assert.deepEqual(value,original[key]);
    assert.equal(hash(fs.readFileSync(path.join(root,row.src))),row.sha256);
    for(const url of ['http://localhost/','https://orochi771127.github.io/championship-2026/'])assert.deepEqual(originalShopCageThumbnail(row.shopRecordIndex,url),row);
  }
  assertPublicBytes(SHOP_CAGE_PUBLIC,JSON.stringify(manifest),{jsonFields:SHOP_CAGE_FIELDS});
  assert.equal(hash(fs.readFileSync(path.join(root,SHOP_CAGE_SOURCE))),'4f709ad7713901eeaa7963b4edf21e91649b11b8f0b383e701f90ec10383c9ad');
});
test('four licensed fallback icons keep the same rest poses without the source toolbar manifest or authority import',()=>{
  const expected=['feed','protein','woundMedicine','medicine'].map(name=>`assets/production/toolbar/licensed-runtime-v1/${name}-rest.png`);
  assert.deepEqual([0,1,2,3].map(id=>shopGoodsPresentation(id)?.src),expected);
  for(const name of ['feed','protein','woundMedicine','medicine']){
    const selected=publicRuntimeAsset(`art:toolbar:licensed:${name}-rest`);
    assert.equal(hash(fs.readFileSync(path.join(root,selected.src))),selected.sha256);
  }
  const code=fs.readFileSync(path.join(root,'src/championship/presentation/shopGoodsUiArt.js'),'utf8');
  assert.equal(code.includes('ART_PRODUCTION_INDEX'),false);assert.equal(code.includes('licensed-runtime-v1/manifest.json'),false);
});
test('only the exact accepted original PNGs receive a projection grant, never a source manifest or ROM record',()=>{
  const selected=selectedShopCageProjection({root,input,index});
  assert.equal(selected.files.has(SHOP_CAGE_SOURCE),false);
  const row=selected.manifest.records[0];
  const a={schemaVersion:1,files:[{path:row.src,sha256:row.sha256}],assets:[{id:'art:shop:cage:83',src:row.src,sha256:row.sha256}]};
  assert.throws(()=>publicRuntimeIndex(a,index),/PUBLIC_ALLOWLIST_FILE/);
  assert.equal(publicRuntimeIndex(a,index,selected.files).assets[0].src,row.src);
  assert.throws(()=>publicRuntimeIndex({...a,files:[{...a.files[0],sha256:'a'.repeat(64)}]},index,selected.files),/PUBLIC_ALLOWLIST_FILE/);
  const bad=structuredClone(index);bad.entries.find(e=>e.assetId==='art:cage:shop-final:20261008').rightsStatus='ROM_COPYRIGHTED_REFERENCE';
  assert.throws(()=>selectedShopCageProjection({root,input,index:bad}),/PUBLIC_SHOP_CAGE_AUTHORIZATION/);
});
test('projection rejects a changed intake and invalid public destination instead of promoting local provenance',t=>{
  const f=fixture(t),policyPath='src/data/championship/public-playtest.r1.json',policy=read(policyPath);
  f.write(policyPath,JSON.stringify({...policy,origin:'https://example.com'}));
  f.write(SHOP_CAGE_SOURCE,fs.readFileSync(path.join(root,SHOP_CAGE_SOURCE)));
  assert.throws(()=>selectedShopCageProjection({root:f.dir,input,index}),/PUBLIC_SHOP_CAGE_AUTHORIZATION/);
  f.write(policyPath,JSON.stringify(policy));f.write(SHOP_CAGE_SOURCE,JSON.stringify({...read(SHOP_CAGE_SOURCE),ownerDirection:'changed'}));
  assert.throws(()=>selectedShopCageProjection({root:f.dir,input,index}),/PUBLIC_SHOP_CAGE_SOURCE_HASH/);
});
test('actual thumbnail upload payload keeps original bytes and rejects copied private metadata or extra source files',t=>{
  const f=fixture(t),selected=selectedShopCageProjection({root,input,index});
  const manifestBytes=fs.readFileSync(path.join(root,SHOP_CAGE_PUBLIC));
  const allowlist={schemaVersion:1,files:[{path:SHOP_CAGE_PUBLIC,sha256:hash(manifestBytes),jsonFields:SHOP_CAGE_FIELDS},...[...selected.files].map(([file,sha256])=>({path:file,sha256}))],assets:[{id:'art:shop:cage-thumbnails:v1',src:SHOP_CAGE_PUBLIC,sha256:hash(manifestBytes)}]};
  const runtime=publicRuntimeIndex(allowlist,index,selected.files),indexBytes=Buffer.from(JSON.stringify(runtime,null,2)+'\n');
  allowlist.files.push({path:PUBLIC_RUNTIME_INDEX_PATH,sha256:hash(indexBytes)});
  for(const row of allowlist.files)f.write(row.path,row.path===PUBLIC_RUNTIME_INDEX_PATH?indexBytes:fs.readFileSync(path.join(root,row.path)));
  f.write('index.html','<main>shop</main>');f.write('.nojekyll','');f.write('pages-build.json','{"schemaVersion":2,"files":[]}');
  const plan={files:allowlist.files.map(row=>row.path),allowlist,runtime,indexBytes,importMap:{}},files=[...plan.files,'index.html','.nojekyll','pages-build.json'];
  assert.equal(assertPublicArtifact({root:f.dir,files,plan}).checkedFiles,40);
  const injected={...selected.manifest,records:selected.manifest.records.map((row,i)=>i===0?{...row,source:{path:'/workspace/private/master.png'}}:row)};
  f.write(SHOP_CAGE_PUBLIC,JSON.stringify(injected));
  assert.throws(()=>assertPublicArtifact({root:f.dir,files,plan}),/PUBLIC_PAYLOAD_UNSELECTED_JSON_FIELD/);
  f.write(SHOP_CAGE_PUBLIC,manifestBytes);f.write(SHOP_CAGE_SOURCE,fs.readFileSync(path.join(root,SHOP_CAGE_SOURCE)));
  assert.throws(()=>assertPublicArtifact({root:f.dir,files:[...files,SHOP_CAGE_SOURCE],plan}),/PUBLIC_PAYLOAD_FILE_SET/);
});
