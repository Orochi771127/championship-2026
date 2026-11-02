import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {publicRuntimeIndex,assertPublicArtifact,PUBLIC_RUNTIME_INDEX_PATH} from '../scripts/lib/public-runtime-boundary.mjs';
import {publicRuntimeAsset} from '../src/championship/presentation/publicRuntimeAssets.js';
import {shopGoodsPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
import {openingFilmPublicationFiles} from '../scripts/lib/opening-film-publication.mjs';
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

test('all 83 normal Shop goods retain selected original pixels without the private assembled fallback',()=>{
  const ui=read('src/data/championship/public-ui-selection.v1.json');
  const selected=new Map(read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json').files.map(row=>[row.path,row.sha256]));
  const items=ui.items.filter(row=>Number.isSafeInteger(row.shopRecordIndex));
  assert.deepEqual(items.map(row=>row.shopRecordIndex).sort((a,b)=>a-b),Array.from({length:83},(_,i)=>i));
  for(const item of items){
    assert.equal(selected.get(item.src),item.sha256,item.src);
    for(const url of ['http://127.0.0.1:18743/championship.html','https://orochi771127.github.io/championship-2026/']){
      const shown=shopGoodsPresentation(item.shopRecordIndex,url);
      const art=item.shopRecordIndex===0?ui.items.find(row=>row.assetId==='care19/meat-0'):item;
      for(const key of ['src','sha256','nativeSize','rasterSize'])assert.deepEqual(shown[key],art[key],item.shopRecordIndex+': '+key);
      for(const key of ['itemIndex','category','productItemId'])assert.deepEqual(shown[key],item[key],item.shopRecordIndex+': '+key);
      assert.equal(selected.get(shown.src),shown.sha256);
      assert.equal(shown.width,art.nativeSize[0]);assert.equal(shown.height,art.nativeSize[1]);
    }
  }
  for(const id of [83,117,-1,118,1.5,'0',null])assert.equal(shopGoodsPresentation(id,'https://orochi771127.github.io/championship-2026/'),null);
  const code=fs.readFileSync(path.join(root,'src/championship/presentation/shopGoodsUiArt.js'),'utf8');
  assert.doesNotMatch(code,/assembledUiArt|assembledShopArt|ART_PRODUCTION_INDEX|internal-faithful-baseline/);
});
// Owner 2026-11-02: the cage pictures are renders of the 3D cages (cage-ui-three.v1.json).
test('actual cage picture payload keeps the selected bytes and rejects copied private metadata or extra source files',t=>{
  const f=fixture(t),manifestPath='assets/production/public-runtime/cage-ui-three.v1.json';
  const allowed=read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json').files,pick=file=>allowed.find(row=>row.path===file);
  const three=read(manifestPath),manifestBytes=fs.readFileSync(path.join(root,manifestPath));
  const allowlist={schemaVersion:1,files:[pick(manifestPath),...three.fields.flatMap(row=>[pick(row.frame.src),pick(row.thumbnail.src)])],assets:[]};
  assert.ok(allowlist.files.every(Boolean));assert.equal(pick(manifestPath).sha256,hash(manifestBytes));
  allowlist.files.push(...openingFilmPublicationFiles());
  const runtime=publicRuntimeIndex(allowlist,index),indexBytes=Buffer.from(JSON.stringify(runtime,null,2)+'\n');
  allowlist.files.push({path:PUBLIC_RUNTIME_INDEX_PATH,sha256:hash(indexBytes)});
  for(const row of allowlist.files)f.write(row.path,row.path===PUBLIC_RUNTIME_INDEX_PATH?indexBytes:fs.readFileSync(path.join(root,row.path)));
  f.write('index.html','<main>shop</main>');f.write('.nojekyll','');f.write('pages-build.json','{"schemaVersion":2,"files":[]}');
  const plan={files:allowlist.files.map(row=>row.path),allowlist,runtime,indexBytes,importMap:{}},files=[...plan.files,'index.html','.nojekyll','pages-build.json'];
  assert.equal(assertPublicArtifact({root:f.dir,files,plan}).checkedFiles,1+2*three.fields.length+4+openingFilmPublicationFiles().length);
  const injected={...three,fields:three.fields.map((row,i)=>i===0?{...row,source:{path:'/workspace/private/master.blend'}}:row)};
  f.write(manifestPath,JSON.stringify(injected));
  assert.throws(()=>assertPublicArtifact({root:f.dir,files,plan}),/PUBLIC_PAYLOAD_UNSELECTED_JSON_FIELD/);
  const source='assets/production/cage/ui-three-20261102/manifest.json';
  f.write(manifestPath,manifestBytes);f.write(source,fs.readFileSync(path.join(root,source)));
  assert.throws(()=>assertPublicArtifact({root:f.dir,files:[...files,source],plan}),/PUBLIC_PAYLOAD_FILE_SET/);
});
