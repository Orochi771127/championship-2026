import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {originalSharedVfxManifestFor,loadOriginalSharedVfxReview,validateOriginalSharedVfx,ORIGINAL_SHARED_VFX_MANIFEST,ORIGINAL_SHARED_157_MANIFEST,ORIGINAL_SHARED_BEAM_MANIFEST} from '../src/championship/presentation/originalSharedVfxReview.js';
import repaired from '../assets/production/vfx/original-shared-review-157-seamfix-r1/manifest.json' with {type:'json'};
import candidate from '../assets/production/vfx/original-shared-beam-seamfix-r1/manifest.json' with {type:'json'};
import reference from '../assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json' with {type:'json'};
import index from '../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import {isPrivateRepositoryPath} from '../scripts/lib/public-art-boundary.mjs';
const href='http://localhost/championship.html?vfxOriginal=shared-v1&vfxRevision=157-seamfix';
test('local VFX selection promotes accepted seam repair while saved157 and explicit candidate stay reachable',()=>{
 assert.equal(originalSharedVfxManifestFor(href),ORIGINAL_SHARED_157_MANIFEST);
 assert.equal(originalSharedVfxManifestFor(href.replace('157-seamfix','157-baseline')),ORIGINAL_SHARED_VFX_MANIFEST);
 assert.equal(originalSharedVfxManifestFor(href+'&vfxCandidate=beam-body-seamfix-r1'),ORIGINAL_SHARED_BEAM_MANIFEST);
 assert.equal(isPrivateRepositoryPath(ORIGINAL_SHARED_157_MANIFEST),true);
 validateOriginalSharedVfx(repaired,index,{manifestPath:ORIGINAL_SHARED_157_MANIFEST});
 assert.deepEqual(repaired.cells,candidate.cells);assert.deepEqual(repaired.banks,candidate.banks);assert.deepEqual(repaired.localizedText,candidate.localizedText);assert.deepEqual(repaired.nativeTimingSource,candidate.nativeTimingSource);
 assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+repaired.image.src,import.meta.url))).digest('hex'),candidate.image.sha256);
});
test('real loader retains explicit repaired157 rollback and exposes the same reviewed source cells without a candidate query',async()=>{
 const refs=new Map(reference.cells.map(c=>[`${c.bankId}:${c.cell}`,c])),images=new Map([[repaired.image.src,repaired.image],...Object.values(repaired.localizedText.sets).map(s=>[s.image.src,s.image])]),loads=[],requests=[];
 const PIXI={Assets:{async load(src){loads.push(src);const i=images.get(src);return{source:{},width:i.width,height:i.height};},async unload(){}},Rectangle:class{constructor(...v){this.value=v}},Texture:class{constructor(o){Object.assign(this,o)}destroy(){}}};
 const art=await loadOriginalSharedVfxReview({PIXI,baseArt:{assetId:reference.assetId,getCell:(b,c)=>refs.get(`${b}:${c}`),dispose:async()=>{}},href,baseUrl:'http://localhost/',getLocale:()=> 'ja',onLocaleChange:()=>()=>{},fetchImpl:async url=>{const path=new URL(url).pathname.slice(1);requests.push(path);return {ok:true,json:async()=>path==='assets/production/ART_PRODUCTION_INDEX.json'?index:repaired};}});
 assert.ok(requests.includes(ORIGINAL_SHARED_157_MANIFEST));assert.equal(loads[0],repaired.image.src);assert.equal(art.getReviewDiagnostics().revision,'original-shared-review-157-seamfix-r1');assert.equal(art.getReviewDiagnostics().candidate,null);assert.equal(art.getReviewDiagnostics().text.set,'ja');
 for(const bank of [12,138])assert.equal(art.getCell(bank,0).rgbaSha256,candidate.cells.find(c=>c.bankId===bank&&c.cell===0).rgbaSha256);
 await art.dispose();
});
