import {sourceAsset,sourceHash,huntPackaging} from './helpers/packaged-hunt-art.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadHuntDepthOccluders,withHuntDepthOccluders,validateHuntDepthPieces} from '../src/championship/presentation/vs2/huntDepthOccluders.js';
import {factoryShutterSpec} from '../src/championship/presentation/vs2/huntFactoryShutters.js';
import {validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {resolveNativeHuntSceneSources} from '../src/championship/hunt/capture/nativeHuntSceneSources.js';
import {isPrivateRepositoryPath} from '../scripts/lib/public-art-boundary.mjs';
const root='assets/production/hunt/industrial-review-r1/hm10/warehouse-r3-20261008/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const bundle=validateRuntimeMapArtBundle(read('assets/production/hunt/accepted-20261010/manifest.json'));
const field=bundle.fields.find(f=>f.fieldId==='field_hm10_01');
const night=validateRuntimeMapArtBundle(read('assets/production/hunt/accepted-20261010/hm10-night.manifest.json'));
test('HM10 day and night keep one three-frame field, native timing, privacy and real anchors',()=>{
 assert.equal(field.fieldId,'field_hm10_01');assert.deepEqual(night.fields.map(f=>f.fieldId),['field_hm10_01']);assert.equal(bundle.publicReleasePermitted,false);assert.equal(bundle.shippingReady,false);
 for(const [hour,index] of [[7,17],[14,16]]){const scene=resolveNativeHuntSceneSources({biomeId:'Factory',hour,season:0});assert.equal(scene.nativeHuntIndex,index);assert.equal(scene.fieldId,field.fieldId);}
 assert.deepEqual(field.frames.map(f=>f.durationRawTicks),[13,12,12]);
 assert.deepEqual(night.fields[0].frames.map(f=>f.durationRawTicks),[13,12,12]);
 assert.deepEqual(night.fields[0].frames.map(f=>f.durationMs),field.frames.map(f=>f.durationMs));
 const old=huntPackaging.nativeBaselineManifest.fields.find(f=>f.fieldId===field.fieldId);
 assert.deepEqual(field.frames.map(f=>f.durationMs),old.frames.map(f=>f.durationMs));
 const location={hostname:'127.0.0.1',search:'?factoryShutters=r3'};
 assert.deepEqual(factoryShutterSpec(field,bundle.assetId,location).portals.map(p=>[p.x,p.anchorY]),[[256,1616],[1280,1040]]);
 assert.equal(factoryShutterSpec(field,'art:hunt:original-opus:v1',location),null);
 assert.equal(factoryShutterSpec(field,bundle.assetId,{...location,hostname:'example.com'}),null);
});
test('all three atlases and images are hash-selected new geometry output, with one shared piece layout',()=>{
 const spec=field.depthOccluders;assert.equal(spec.animationFrames.length,3);assert.deepEqual(spec.atlases,spec.animationFrames[0].atlases);
 assert.equal(spec.geometrySha256,'6db280e774fda6d1fd4897cfc570bad6686e4be55fe47c8988cd7a922fe0a958');
 const assets=[...field.frames,field.thumbnail,spec.pieces,...spec.animationFrames.flatMap(f=>f.atlases)];
 for(const a of assets){assert.ok(sourceAsset(a).source.startsWith(root));assert.ok(isPrivateRepositoryPath(sourceAsset(a).source));assert.equal(isPrivateRepositoryPath(a.src),false);assert.equal(createHash('sha256').update(fs.readFileSync(a.src)).digest('hex'),a.sha256);}
 const pieces=validateHuntDepthPieces(read(spec.pieces.src),2048,2048,spec.atlases.length);assert.equal(pieces.length,spec.pieceCount);
 assert.equal(new Set(spec.animationFrames.flatMap(f=>f.atlases.map(a=>a.sha256))).size,3);
});
function pixi(){const loads=[],unloads=[],dead=[];
 class Texture{constructor(o){Object.assign(this,o);}destroy(){dead.push(this);}}
 class Sprite{constructor(texture){this.texture=texture;this.position={set:(x,y)=>Object.assign(this,{x,y})};}destroy(){}}
 class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
 return {loads,unloads,dead,PIXI:{Texture,Sprite,Rectangle,Assets:{load:async src=>{loads.push(src);return {source:{id:src,width:128,height:128}};},unload:async src=>unloads.push(src)}}};}
const src=i=>'assets/production/hunt/test/phase'+i+'.webp';
const animated={worldWidthPx:2048,worldHeightPx:2048,frames:[{},{},{}],depthOccluders:{atlases:[{src:src(0)}],animationFrames:[0,1,2].map(i=>({atlases:[{src:src(i)}]})),pieces:{src:'assets/production/hunt/test/pieces.json'}}};
const fetchImpl=async()=>({ok:true,json:async()=>({pieces:[[10,20,8,9,1,2,70,0,1]]})});
test('occluder images follow the existing map frame, retain depth/alpha, and dispose every phase',async()=>{
 const f=pixi(),o=await loadHuntDepthOccluders({PIXI:f.PIXI,field:animated,baseHref:'http://localhost/',fetchImpl});
 const layer={children:[],addChild(n){n.parent=this;this.children.push(n);},removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parent=null;}};o.attach(layer);const sprite=layer.children[0];let index=0;
 const art=withHuntDepthOccluders({update(){index=(index+1)%3;},getDiagnostics:()=>({frameIndex:index}),dispose(){}},o);
 for(const want of [1,2,0,1]){art.update(201);assert.equal(sprite.texture.source.id,src(want));assert.equal(o.getAnimationDiagnostics().frameIndex,want);assert.deepEqual([sprite.x,sprite.y,sprite.zIndex],[10,20,70]);assert.equal(o.revealActors([{x:11,y:25,halfWidth:8,height:20}]),0);}
 assert.throws(()=>o.syncFrame(3),/ATLAS_FRAME_INDEX/);await art.dispose();o.syncFrame(1);assert.equal(layer.children.length,0);assert.equal(f.dead.length,3);assert.deepEqual(f.loads,[src(0),src(1),src(2)]);assert.deepEqual(f.unloads,f.loads);
});
test('animated atlases reject missing phases, inconsistent first page and undersized texture bounds',async()=>{
 for(const edit of [f=>f.depthOccluders.animationFrames.pop(),f=>f.depthOccluders.atlases[0].src=src(8)]){const bad=structuredClone(animated);edit(bad);await assert.rejects(loadHuntDepthOccluders({PIXI:pixi().PIXI,field:bad,baseHref:'http://localhost/',fetchImpl}),/ATLAS_(ANIMATION_SHAPE|FIRST_FRAME_MISMATCH)/);}
 const f=pixi();await assert.rejects(loadHuntDepthOccluders({PIXI:f.PIXI,field:animated,baseHref:'http://localhost/',fetchImpl:async()=>({ok:true,json:async()=>({pieces:[[10,20,9,8,125,0,70,0,1]]})})}),/ATLAS_RECT_BOUNDS/);assert.deepEqual(f.unloads,[src(0),src(1),src(2)]);
});
