import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {publicRuntimeIndex,assertPublicBytes,assertPublicArtifact,PUBLIC_RUNTIME_ALLOWLIST_PATH,PUBLIC_RUNTIME_INDEX_PATH,forbiddenPublicPath} from '../scripts/lib/public-runtime-boundary.mjs';
import {publicRuntimeAsset,validatePublicRuntimeAssets} from '../src/championship/presentation/publicRuntimeAssets.js';
import {publicCleanMedia,stripPngMetadata} from '../scripts/lib/public-clean-media.mjs';
import {publicProgramData} from '../scripts/lib/public-program-data.mjs';
import {transform} from 'esbuild';
import {openingFilmPublicationFiles} from '../scripts/lib/opening-film-publication.mjs';
const sha=data=>createHash('sha256').update(data).digest('hex');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function fixture(t){
  const base=path.join(root,'.tmp');fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'public-runtime-'));
  t.after(()=>{const rel=path.relative(fs.realpathSync(base),fs.realpathSync(dir));assert.ok(rel.startsWith('public-runtime-')&&!rel.includes(path.sep)&&!path.isAbsolute(rel));fs.rmSync(dir,{recursive:true});});
  const manifest='assets/production/public-test/manifest.json',bytes=Buffer.from('{"frames":[{"id":1,"width":32}]}\n');
  const allowlist={schemaVersion:1,assets:[{id:'art:public:test',src:manifest,sha256:sha(bytes)}],files:[{path:manifest,sha256:sha(bytes),jsonFields:['frames','id','width']}]};
  const runtime=publicRuntimeIndex(allowlist),indexBytes=Buffer.from(JSON.stringify(runtime,null,2)+'\n');
  allowlist.files.push({path:PUBLIC_RUNTIME_INDEX_PATH,sha256:sha(indexBytes)});
  const files=[manifest,PUBLIC_RUNTIME_INDEX_PATH,'index.html','.nojekyll','pages-build.json'];
  const write=(file,data)=>{fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});fs.writeFileSync(path.join(dir,file),data);};
  for(const row of openingFilmPublicationFiles()){
    write(row.path,fs.readFileSync(path.join(root,row.path)));
    allowlist.files.push({...row});files.push(row.path);
  }
  write(manifest,bytes);write(PUBLIC_RUNTIME_INDEX_PATH,indexBytes);write('index.html','<main>game</main>');write('.nojekyll','');write('pages-build.json','{"schemaVersion":2,"files":[]}');
  const plan={files:allowlist.files.map(f=>f.path),allowlist,runtime,indexBytes,importMap:{}};
  return {dir,manifest,bytes,allowlist,runtime,files,write,plan};
}
test('closed public schema copies only explicit IDs, relative runtime paths, hashes and dimensions',()=>{
  const a={schemaVersion:1,files:[{path:'assets/production/hero.webp',sha256:'a'.repeat(64)}],assets:[{id:'species-116:hero',src:'assets/production/hero.webp',sha256:'a'.repeat(64),width:683,height:1024}]};
  assert.deepEqual(publicRuntimeIndex(a),{schemaVersion:1,assets:[{id:'species-116:hero',src:'assets/production/hero.webp',sha256:'a'.repeat(64),width:683,height:1024}]});
  for(const extra of [{localOnly:false},{approvalMessage:'approved'},{library_file_id:'libfile_hidden'},{provenance:{}}])assert.throws(()=>publicRuntimeIndex({...a,assets:[{...a.assets[0],...extra}]}),/PUBLIC_ALLOWLIST_ASSET/);
});
test('all localOnly authority IDs and roots are vetoed even if renamed or claimed public',()=>{
  const authority={entries:Array.from({length:11},(_,i)=>({assetId:'private-'+i,manifestPath:`assets/production/source-${i}/manifest.json`,localOnly:true}))};
  for(const e of authority.entries){
    const file=e.manifestPath.replace('manifest.json','moved.json'),a={schemaVersion:1,files:[{path:file,sha256:'a'.repeat(64)}],assets:[{id:'new-public-name',src:file,sha256:'a'.repeat(64)}]};
    assert.throws(()=>publicRuntimeIndex(a,authority),/PUBLIC_ALLOWLIST_FILE/);
    a.files[0].path='assets/production/elsewhere.json';a.assets[0]={id:e.assetId,src:a.files[0].path,sha256:'a'.repeat(64)};
    assert.throws(()=>publicRuntimeIndex(a,authority),/PUBLIC_ALLOWLIST_ASSET/);
  }
});
test('actual upload directory passes a selected runtime-only payload and preserves resource identities',t=>{
  const f=fixture(t);assert.equal(assertPublicArtifact({root:f.dir,files:f.files,plan:f.plan}).authorityIndexIncluded,false);
  const parsed=JSON.parse(fs.readFileSync(path.join(f.dir,PUBLIC_RUNTIME_INDEX_PATH)));assert.equal(parsed.assets[0].id,'art:public:test');assert.equal(parsed.assets[0].src,f.manifest);assert.equal(parsed.assets[0].sha256,sha(f.bytes));
});
test('actual upload directory rejects a renamed full index and nested private metadata even with matching selected hash',t=>{
  const f=fixture(t);
  for(const data of [{schemaVersion:1,entries:Array.from({length:11},(_,i)=>({assetId:`private-${i}`,localOnly:true,rightsStatus:'ROM_COPYRIGHTED_REFERENCE'})),summary:{}},{frames:[{id:1,localOnly:true}]},{frames:[{id:1,ownerReplyId:'message'}]},{frames:[{id:1,note:'libfile_secret'}]},{frames:[{id:1,note:'R:\\Projects\\private.png'}]}]){
    const bytes=Buffer.from(JSON.stringify(data));f.write(f.manifest,bytes);f.allowlist.files[0].sha256=sha(bytes);
    assert.throws(()=>assertPublicArtifact({root:f.dir,files:f.files,plan:f.plan}),/PUBLIC_PAYLOAD_(?:PRIVATE|UNSELECTED)/);
  }
});
test('actual upload rejects an extra internal index, stale bytes, missing approved files and injected metadata in the build receipt',t=>{
  const f=fixture(t),privateFile='assets/production/ART_PRODUCTION_INDEX.json';f.write(privateFile,'{"entries":[]}');
  assert.throws(()=>assertPublicArtifact({root:f.dir,files:[...f.files,privateFile],plan:f.plan}),/PUBLIC_PAYLOAD_FILE_SET/);
  assert.throws(()=>assertPublicArtifact({root:f.dir,files:f.files.slice(1),plan:f.plan}),/PUBLIC_PAYLOAD_FILE_SET/);
  f.write(f.manifest,'{"frames":[]}');assert.throws(()=>assertPublicArtifact({root:f.dir,files:f.files,plan:f.plan}),/PUBLIC_PAYLOAD_SELECTION_HASH/);
  f.write(f.manifest,f.bytes);f.write('pages-build.json','{"schemaVersion":2,"secretNotes":"not runtime"}');
  assert.throws(()=>assertPublicArtifact({root:f.dir,files:f.files,plan:f.plan}),/PUBLIC_PAYLOAD_UNSELECTED_JSON_FIELD/);
});
test('raw/source payloads and media metadata are never made safe merely by a new filename',()=>{
  for(const file of ['assets/production/source.nds','assets/production/source.ncer','research/a.json','assets/production/internal-faithful-baseline/a.webp'])assert.equal(forbiddenPublicPath(file),true);
  const prefix=Buffer.from([137,80,78,71,13,10,26,10]),chunk=Buffer.alloc(12);chunk.writeUInt32BE(0);chunk.write('tEXt',4,'ascii');
  assert.throws(()=>assertPublicBytes('assets/production/renamed.png',Buffer.concat([prefix,chunk])),/PUBLIC_MEDIA_METADATA/);
  const webp=Buffer.alloc(20);webp.write('RIFF',0);webp.writeUInt32LE(12,4);webp.write('WEBP',8);webp.write('EXIF',12);webp.writeUInt32LE(0,16);
  assert.throws(()=>assertPublicBytes('assets/production/renamed.webp',webp),/PUBLIC_MEDIA_METADATA/);
});
test('public JSON requires an explicit field schema, not arbitrary copied metadata',()=>{
  assert.throws(()=>assertPublicBytes('assets/production/a.json','{"anything":1}'),/PUBLIC_JSON_SCHEMA_REQUIRED/);
  assert.throws(()=>assertPublicBytes('assets/production/a.json','{"anything":1}',{jsonFields:['id']}),/PUBLIC_PAYLOAD_UNSELECTED_JSON_FIELD/);
});

test('private reference rejection distinguishes SDK protocol examples from actual local files and human tracking IDs',()=>{
  for(const source of ["const scheme='file://';",'// e.g. file:///, data URIs',"throw Error('PRODUCT_SPECIES_SENTINEL_NOT_ENTITY');"])
    assert.doesNotThrow(()=>assertPublicBytes('src/example.js',source));
  for(const value of ['file:///C:/Users/User/private.png','file:///private/image.png','file://localhost/private.png',
    'libfile_962ab32091688191b3da3449655d2fd7','Sentinel_5afd9489c7a48191bcdd183bfe5d729c','R:\\Projects\\private.png'])
    assert.throws(()=>assertPublicBytes('src/example.js',JSON.stringify(value)),/PUBLIC_PAYLOAD_PRIVATE_VALUE/);
});

test('clean PNG derivations retain every pixel-bearing and color chunk byte-for-byte',()=>{
  const chunks=bytes=>{const rows=[];for(let pos=8;pos<bytes.length;){const end=pos+12+bytes.readUInt32BE(pos);rows.push({type:bytes.toString('ascii',pos+4,pos+8),bytes:bytes.subarray(pos,end)});pos=end;}return rows;};
  const recipe=JSON.parse(fs.readFileSync(path.join(root,'docs/contracts/championship/PUBLIC_CLEAN_MEDIA_SOURCES.v1.json')));
  const files=publicCleanMedia({root});assert.equal(recipe.files.length,17);assert.equal(files.length,7);
  assert.deepEqual(files.map(row=>row.path).sort(),[...recipe.publicationPaths].sort());
  assert.equal(files.filter(row=>row.path.includes('/currency-hud-r1/')).length,4);
  assert.ok(files.filter(row=>row.path.includes('/currency-hud-r1/')).every(row=>/-(?:24|48)\.png$/.test(row.path)));
  for(const file of recipe.files){
    const source=fs.readFileSync(path.join(root,file.sourcePath)),output=fs.readFileSync(path.join(root,file.path));
    assert.deepEqual(chunks(output),chunks(source).filter(row=>!['tEXt','iTXt','zTXt','eXIf'].includes(row.type)));
    assert.doesNotThrow(()=>assertPublicBytes(file.path,output));
    assert.deepEqual(stripPngMetadata(output),output);
    assert.throws(()=>stripPngMetadata(Buffer.concat([output,Buffer.from([0])])),/PNG_TRAILING_BYTES/);
  }
});

test('pinned gameplay data retains all values; derived vendor module has identical executable code',async()=>{
 const recipe=JSON.parse(fs.readFileSync(path.join(root,'docs/contracts/championship/PUBLIC_PROGRAM_SOURCES.v1.json')));
 const descriptors=publicProgramData({root});assert.equal(descriptors.length,45);
 for(const row of descriptors)assert.doesNotThrow(()=>assertPublicBytes(row.path,row.bytes,{jsonFields:row.jsonFields}));
 for(const row of recipe.sources.filter(row=>['NATIVE_GAMEPLAY','PRESENTATION_CONTRACT'].includes(row.kind))){
  const selected=descriptors.find(item=>item.path===row.path);assert.deepEqual(selected.bytes,fs.readFileSync(path.join(root,row.path)));
 }
 const vendor=recipe.sources.find(row=>row.kind==='VENDOR_DOCUMENTATION');
 const normalize=source=>transform(source,{loader:'js',format:'esm',minify:true,legalComments:'none'}).then(result=>result.code);
 assert.equal(await normalize(fs.readFileSync(path.join(root,vendor.path),'utf8')),await normalize(fs.readFileSync(path.join(root,vendor.output),'utf8')));
 assert.match(fs.readFileSync(path.join(root,vendor.output),'utf8'),/MIT|license/i);
 const careSource=recipe.sources.find(row=>row.kind==='CARE_CELLS'),care=JSON.parse(fs.readFileSync(path.join(root,careSource.path)));
 const projected=JSON.parse(descriptors.find(row=>row.path===careSource.output).bytes);
 assert.equal(projected.cells.length,16);
 for(const [i,cell] of projected.cells.entries())for(const key of careSource.jsonFields.filter(key=>!['schemaVersion','cells'].includes(key)))assert.deepEqual(cell[key],care.cells[i][key]);
 const selected=new Map(JSON.parse(fs.readFileSync(path.join(root,PUBLIC_RUNTIME_ALLOWLIST_PATH))).files.map(row=>[row.path,row.sha256]));
 for(const cell of projected.cells)assert.equal(selected.get(cell.src),cell.sha256);
});
test('selected public hero mappings retain exact ID, image hash, dimensions and per-role resolution; authoring versions remain intact',()=>{
  const heroes=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/database-hero-portraits.public.v1.json'),'utf8'));
  const authoring=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/database-hero-portraits.r1.json'),'utf8'));
  assert.equal(authoring.entries.length,96);assert.equal(heroes.entries.length,214);
  for(const hero of heroes.entries)assert.deepEqual(publicRuntimeAsset(`${hero.speciesId}:database-hero`),{id:`${hero.speciesId}:database-hero`,src:hero.src,sha256:hero.sha256,width:hero.width,height:hero.height});
  assert.equal(publicRuntimeAsset('species-188:database-hero'),null);
  assert.throws(()=>validatePublicRuntimeAssets({schemaVersion:1,assets:[{...publicRuntimeAsset('species-116:database-hero'),approvalMessage:'private'}]}),/PUBLIC_RUNTIME_ASSET_INVALID/);
});

test('95 display renditions and thumbnails preserve exact approved source identity while retaining owner-confirmed unarmed designs',()=>{
 const recipe=JSON.parse(fs.readFileSync('docs/contracts/championship/DATABASE_HERO_DISPLAY_RENDITIONS.v1.json','utf8'));
 const masters=JSON.parse(fs.readFileSync('src/data/championship/database-hero-portraits.r1.json','utf8')).entries;
 const heroes=JSON.parse(fs.readFileSync('src/data/championship/database-hero-portraits.public.v1.json','utf8')).entries;
 assert.equal(recipe.rows.length,95);assert.equal(masters.length,96);assert.equal(recipe.displayMaxEdge,864);assert.equal(recipe.thumbnailMaxEdge,128);
 assert.equal(recipe.encoding,'WEBP_LOSSLESS_RGBA_EXACT_AFTER_RESIZE');assert.equal(recipe.framingChanged,false);
 const dimensions=bytes=>{for(let offset=12;offset+8<bytes.length;){const type=bytes.toString('ascii',offset,offset+4),n=bytes.readUInt32LE(offset+4),start=offset+8;
  if(type==='VP8X')return [bytes.readUIntLE(start+4,3)+1,bytes.readUIntLE(start+7,3)+1];
  if(type==='VP8L'){const bits=bytes.readUInt32LE(start+1);return [(bits&16383)+1,((bits>>>14)&16383)+1];}offset=start+n+(n%2);
 }throw Error('WEBP_DIMENSIONS_MISSING');};
 const replacement=JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-215-20261018/manifest.json','utf8'));
 const replacementFlowers=JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-054-059-20261018/manifest.json','utf8'));
 const superseded=[...replacement.supersededEntries,...replacementFlowers.supersededEntries];
 for(const row of recipe.rows){
  const master=masters.find(e=>e.speciesIndex===row.speciesIndex),liveHero=heroes.find(e=>e.speciesIndex===row.speciesIndex),hero=superseded.find(e=>e.speciesIndex===row.speciesIndex)??liveHero;
  for(const field of ['speciesId','displayCode'])assert.equal(hero[field],master[field]);
  for(const field of ['src','sha256','width','height'])assert.equal(row.source[field],master[field]);
  assert.equal(sha(fs.readFileSync(master.src)),master.sha256,'Original approved media remains intact');
  for(const [kind,edge,actual] of [['display',864,hero],['thumbnail',128,hero.thumbnail]]){
   const media=row[kind],bytes=fs.readFileSync(media.src);assert.equal(sha(bytes),media.sha256);assert.equal(bytes.length,media.bytes);
   assert.deepEqual(dimensions(bytes),[media.width,media.height]);assert.ok(bytes.includes(Buffer.from('VP8L')),'Lossless WebP payload');
   assert.equal(media.rgbaExactlyMatchesResizedSource,true);assert.ok(Math.max(media.width,media.height)<=edge);
   const scale=Math.min(1,edge/Math.max(master.width,master.height));assert.ok(Math.abs(media.width-master.width*scale)<=0.500001);assert.ok(Math.abs(media.height-master.height*scale)<=0.500001);
   for(const key of ['src','sha256','width','height'])assert.equal(actual[key],media[key]);
   if(!superseded.some(e=>e.speciesIndex===row.speciesIndex))assert.deepEqual(publicRuntimeAsset(`${hero.speciesId}:database-${kind==='display'?'hero':'thumbnail'}`),{id:`${hero.speciesId}:database-${kind==='display'?'hero':'thumbnail'}`,src:media.src,sha256:media.sha256,width:media.width,height:media.height});
  }
 }
 for(const id of [184,186,187,188])assert.equal(heroes.some(row=>row.speciesIndex===id),false);
 assert.equal(masters.some(row=>row.speciesIndex===82),true);assert.notEqual(heroes.find(row=>row.speciesIndex===82)?.src,masters.find(row=>row.speciesIndex===82)?.src);assert.equal(heroes.find(row=>row.speciesIndex===82)?.displayCode,'MA15');
});
