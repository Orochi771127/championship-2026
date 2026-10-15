import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {originalMedalArt} from '../src/championship/presentation/completedOriginalUi20261007.js';
import {medalCollection} from '../src/championship/app/medalCollection.js';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const source=JSON.parse(read('assets/production/original-ui-intake-20261007/manifest.json'));
const corrections=JSON.parse(read('assets/production/medal-name-corrections-20261014/manifest.json'));
const local='http://127.0.0.1:8766/championship.html';
const approved='https://orochi771127.github.io/championship-2026/';
const changed=[3,7,8,10,11,13,14,15,16,22,25,29,31,32,35,36,37,38,42,43,44,45,47,49,52,54,55,56,57,58,59];
const original=id=>source.medals.find(m=>m.titleId===id);

function rgbaPng(bytes){
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 assert.equal(bytes[24],8,'8-bit channel depth');assert.equal(bytes[25],6,'true RGBA');
 assert.equal(bytes[28],0,'non-interlaced');
 const chunks=[];
 for(let p=8;p<bytes.length;){const n=bytes.readUInt32BE(p);if(bytes.toString('ascii',p+4,p+8)==='IDAT')chunks.push(bytes.subarray(p+8,p+8+n));p+=n+12;}
 const packed=inflateSync(Buffer.concat(chunks)),stride=width*4,pixels=Buffer.alloc(stride*height);
 assert.equal(packed.length,(stride+1)*height);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const type=packed[y*(stride+1)];assert.ok(type<=4);
  for(let x=0;x<stride;x++){
   const i=y*stride+x,a=x>=4?pixels[i-4]:0,b=y?pixels[i-stride]:0,c=y&&x>=4?pixels[i-stride-4]:0;
   const prediction=type===0?0:type===1?a:type===2?b:type===3?Math.floor((a+b)/2):paeth(a,b,c);
   pixels[i]=(packed[y*(stride+1)+1+x]+prediction)&255;
  }
 }
 return {width,height,pixels};
}

test('exactly 31 presentation IDs change, all 61 canonical IDs remain stable',()=>{
 assert.deepEqual(corrections.medals.map(m=>m.titleId),changed);
 for(let id=0;id<61;id++){
  const art=originalMedalArt(id,local);assert.equal(art.titleId,id);
  if(changed.includes(id))assert.notEqual(art.src,original(id).src);
  else assert.deepEqual(art,original(id));
 }
 for(const id of [-1,61,62,null,undefined,'29',NaN])assert.equal(originalMedalArt(id,local),null);
});

test('moon, virus, blizzard and volcano use inspected motifs without wrong-art donor backfill',()=>{
 for(const [target,donor] of [[29,52],[57,56],[36,32],[37,36],[15,43],[45,59],[59,47]]){
  const art=originalMedalArt(target,local);
  assert.equal(art.src,original(donor).src);assert.equal(art.sha256,original(donor).sha256);
  assert.equal(art.sourceTitleId,donor);assert.equal(art.artIdentity,original(donor).artIdentity);
  assert.equal(art.previousArt.src,original(target).src);
  assert.notEqual(originalMedalArt(donor,local).src,original(target).src,'no wrong-art backfill');
 }
 assert.match(originalMedalArt(56,local).src,/rainbow-flyer-grid\.png$/);
 assert.match(originalMedalArt(52,local).src,/infinite-soul-grid\.png$/);
 assert.match(originalMedalArt(32,local).src,/noise-divider-grid\.png$/);
 assert.equal(new Set(changed.map(id=>originalMedalArt(id,local).src)).size,31);
});

test('original-runtime location gate remains unchanged, not a publication authorization',()=>{
 for(const id of changed){
  assert.deepEqual(originalMedalArt(id,approved),originalMedalArt(id,local));
  for(const url of ['https://example.com/game','file:///game','https://orochi771127.github.io/other/'])assert.equal(originalMedalArt(id,url),null);
 }
 assert.equal(corrections.publicReleasePermitted,false);assert.equal(corrections.shippingReady,false);
 assert.equal(corrections.status,'CANDIDATE_ONLY_NOT_PUBLISHED');
});

test('all original delivered medal bytes and source manifest retain exact provenance',()=>{
 assert.equal(hash(read(corrections.sourceManifest.src)),corrections.sourceManifest.sha256);
 assert.equal(source.medals.length,61);
 for(const art of source.medals)assert.equal(hash(read(art.src)),art.sha256,art.src);
 for(const art of corrections.medals){
  assert.equal(hash(read(art.src)),art.sha256);assert.equal(read(art.src).length,art.bytes);
  assert.match(art.mappingEvidence,/NOT_ROM_ART_MAPPING/);
  assert.doesNotMatch(art.src,/internal-faithful|research\//);
 }
});

test('generated128px grids and512px details have genuine alpha and stable master provenance',()=>{
 for(const id of [3,7,8,10,11,13,14,16,22,25,31,32,35,38,42,43,44,47,49,52,54,55,56,58]){
  const art=originalMedalArt(id,local);
  assert.equal(Math.max(...art.rasterSize),128);assert.equal(Math.max(...art.detailRasterSize),512);
  assert.equal(art.width*art.density,art.rasterSize[0]);assert.equal(art.height*art.density,art.rasterSize[1]);
  for(const [src,sha,byteLength,dimensions] of [[art.src,art.sha256,art.bytes,art.rasterSize],[art.detailSrc,art.detailSha256,art.detailBytes,art.detailRasterSize]]){
   const bytes=read(src),image=rgbaPng(bytes);assert.equal(hash(bytes),sha);assert.equal(bytes.length,byteLength);
   const [width,height]=dimensions;assert.deepEqual([image.width,image.height],dimensions);
   assert.equal(lstatSync(new URL(src,root)).isSymbolicLink(),false);
   let transparent=0,nearlyOpaque=0,partial=0,visible=0;
   // Preserve the generator's mostly252–253 alpha rather than forcing255.
   for(let i=3;i<image.pixels.length;i+=4){const a=image.pixels[i];if(a===0)transparent++;if(a>=16)visible++;if(a>=250)nearlyOpaque++;if(a>0&&a<250)partial++;}
   assert.ok(transparent>width*height*0.1,'transparent surround');assert.ok(visible>width*height*0.05,'meaningful visible motif');assert.ok(nearlyOpaque>visible*0.5,'most meaningful artwork is nearly opaque');assert.ok(partial>0,'antialiased alpha edges');
   for(const [x,y] of [[0,0],[width-1,0],[0,height-1],[width-1,height-1]])assert.equal(image.pixels[(y*width+x)*4+3],0);
  }
  assert.match(art.generation.masterSha256,/^[a-f0-9]{64}$/);
  assert.match(art.generation.master,/^assets\/production\/medal-name-corrections-20261014\/masters\//);
  assert.notEqual(art.src,art.generation.master);assert.notEqual(art.detailSrc,art.generation.master);
  assert.equal(art.generation.tool,'host-native image_gen.imagegen');
 }
});

test('grid payload stays128px while optional selected detail is512px',()=>{
 const generated=corrections.medals.filter(a=>a.detailSrc);
 assert.equal(generated.length,24);assert.ok(generated.reduce((n,a)=>n+a.bytes,0)<generated.length*50000);
 for(const a of generated){assert.ok(a.bytes<a.detailBytes/4);assert.notEqual(a.src,a.detailSrc);}
 for(const a of corrections.medals.filter(a=>!a.detailSrc))assert.deepEqual(a.rasterSize,[128,128]);
});

test('award flags and event records are unaffected by image remapping',()=>{
 const saved=Object.freeze([...changed]),before=JSON.stringify(saved);
 const entries=medalCollection(saved);
 for(const entry of entries){
  originalMedalArt(entry.titleId,local);
  assert.equal(entry.acquired,saved.includes(entry.titleId));
  assert.equal(entry.conditionEvidence,'ROM_VERIFIED_TITLE_WIN');
 }
 assert.equal(entries.length,61);assert.equal(JSON.stringify(saved),before);
 assert.deepEqual(entries.filter(e=>e.acquired).map(e=>e.titleId),changed);
});

test('bounded correction records remaining semantic work without claiming all 61 complete',()=>{
 assert.equal(corrections.audit.reviewedCount,61);assert.equal(corrections.audit.initialCounts.mismatch,30);
 assert.deepEqual(corrections.audit.correctedTitleIds,changed);
 assert.equal(corrections.audit.remainingMismatchCount,0);
 assert.equal(corrections.audit.remainingMismatchTitleIds.length,0);
 assert.equal(corrections.audit.remainingAmbiguousCount,28);
 assert.equal(corrections.audit.all61Corrected,false);
 for(const id of changed)assert.equal(corrections.audit.remainingMismatchTitleIds.includes(id),false);
});

test('later batches preserve sealed first-four identities and original detail image hashes',()=>{
 const receipt=JSON.parse(read('assets/production/medal-name-corrections-20261014/batch-01-four-id-receipt.json'));
 assert.deepEqual(receipt.titleIds,[29,52,56,57]);
 for(const art of receipt.manifestSnapshot.medals){
  const current=originalMedalArt(art.titleId,local);
  if(art.generation){
   assert.equal(current.detailSrc,art.src);assert.equal(current.detailSha256,art.sha256);
   assert.equal(current.artIdentity,art.artIdentity);assert.deepEqual(current.generation,art.generation);
  }else assert.deepEqual(current,art);
  assert.equal(hash(read(art.src)),art.sha256);
 }
 assert.deepEqual(corrections.batchEvidence.map(b=>b.titleIds),[[29,52,56,57],[32,36,37],[15,43,45,47,59],[7,8,10,11],[3,31,49,55],[22,35,38,42,54,58],[13,14,16,25,44]]);
 const divider=originalMedalArt(32,local);
 assert.equal(divider.generation.promptRecord,'batch-02-noise-divider-prompt.json');
});

// Frozen categories from the original actual-PNG audit, not inferred from batch size.
test('corrected set covers all30 original mismatches plus only the necessary ambiguous donor47',()=>{
 const originalMismatch=[3,7,8,10,11,13,14,15,16,22,25,29,31,32,35,36,37,38,42,43,44,45,49,52,54,55,56,57,58,59];
 const originalAmbiguous=[0,1,4,5,6,9,12,17,18,19,21,23,24,26,27,28,30,33,34,39,40,41,46,47,48,50,51,53,60];
 const originalConfident=[2,20];
 assert.deepEqual(changed.filter(id=>originalMismatch.includes(id)),originalMismatch);
 assert.deepEqual(changed.filter(id=>originalAmbiguous.includes(id)),[47]);
 assert.deepEqual(changed.filter(id=>originalConfident.includes(id)),[]);
 assert.deepEqual(corrections.audit.remainingAmbiguousTitleIds,originalAmbiguous.filter(id=>id!==47));
 assert.deepEqual(corrections.audit.correctedOriginalCategoryCounts,{mismatch:30,ambiguous:1,confident:0});
 for(const id of [...originalConfident,...originalAmbiguous.filter(id=>id!==47)])assert.deepEqual(originalMedalArt(id,local),original(id));
});
