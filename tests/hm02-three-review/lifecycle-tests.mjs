import assert from 'node:assert/strict';
import fs from 'node:fs';
import {abortable,createResourceDisposer,shaderFailureGuard} from './hm02Lifecycle.mjs';
import {actorLocalQuad,actorWorldBounds} from './hm02ActorBounds.mjs';
import {installSharedPass} from './hm02SharedPass.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
let count=0;
for(const phase of ['fetch','body','hash','parse']){
 const c=new AbortController(),d=deferred();let cleaned=0;const p=abortable(d.promise,c.signal,()=>cleaned++);
 c.abort();await assert.rejects(p,{name:'AbortError'});d.resolve({phase});await Promise.resolve();assert.equal(cleaned,1);count++;
}
const resource=createResourceDisposer();let disposals=0,closed=0;const geometry={dispose(){disposals++;}},material={dispose(){disposals++;}},image={close(){closed++;}},texture={isTexture:true,source:{data:image},dispose(){disposals++;}};material.map=texture;
const gltf={scene:{traverse(fn){fn({geometry,material});fn({geometry,material});}}};resource.gltf(gltf);resource.gltf(gltf);assert.equal(disposals,3);assert.equal(closed,1);
const batch={dispose(){disposals++;}};resource.once(batch);resource.once(batch);assert.equal(disposals,4);
const events=[],gl={},canvas={},root={};const pixi={gl,render(o){events.push(o.clear===false?'overlay':'fallback');},resetState(){events.push('pixiReset');}};
const three={debug:{},getContext:()=>gl,domElement:canvas,resetState(){events.push('threeReset');}};const guard=shaderFailureGuard(three);
installSharedPass({app:{renderer:pixi,canvas,stage:root},threeRenderer:three,draw(){guard.draw(()=>{events.push('renderBegin');three.debug.onShaderError();events.push('renderEnd');});},onFailure(){events.push('restore');}});
pixi.render({container:root});assert.deepEqual(events,['threeReset','renderBegin','renderEnd','restore','pixiReset','fallback']);
// Test actual inline MAIN gate, not a replica helper. Module failure is local.
const main=fs.readFileSync(new URL('./main.candidate.js',import.meta.url),'utf8');
const code=main.split('// HM02_REVIEW_ENTRY_BEGIN:')[1].split('// HM02_REVIEW_ENTRY_END')[0].replace(/^.*\n/,'').replace("import('../presentation/vs2/loadHM02ThreePilot.mjs')","importer()");
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
const entry=new AsyncFunction('location','fieldArt','signal','stage','fieldSource','own','console','importer',code+'\nreturn threePilot;');
for(const [href,fieldId]of [['https://example.com/?hm02ThreeReview=1','field_hm02_01'],['http://localhost/','field_hm02_01'],['http://localhost/?hm02ThreeReview=1','field_hm01_01'],['http://localhost/?hm02ThreeReview=1','field_hm08_01']]){
 let imports=0;assert.equal(await entry({href},{getDiagnostics:()=>({fieldId})},new AbortController().signal,null,null,p=>p,{warn(){}},()=>{imports++;throw Error();}),null);assert.equal(imports,0);count++;
}
let warnings=0;assert.equal(await entry({href:'http://localhost/?hm02ThreeReview=1'},{getDiagnostics:()=>({fieldId:'field_hm02_01'})},new AbortController().signal,null,null,p=>p,{warn(){warnings++;}},()=>Promise.reject(new Error('MODULE_FAILURE'))),null);assert.equal(warnings,1);
const node={scale:{x:-1,y:-1},characterSprite:{x:90,y:-75,scale:{x:2,y:3},anchor:{x:.5,y:.5},texture:{orig:{width:40,height:60},trim:{x:5,y:8,width:23,height:45}}}};
const q=actorLocalQuad(node),bounds=actorWorldBounds({worldX:10,worldY:20,worldZ:7},node);
assert.equal(bounds.left,10+Math.min(...q.map(p=>p[0])));assert.equal(bounds.top,13+Math.min(...q.map(p=>p[1])));
console.log(JSON.stringify({status:'PASS',abortPhases:4,lateCleanupAndImageClose:true,instanceDisposeOnce:true,shaderFailureUnwindsBeforeFallback:true,actualMainNegativePaths:4,mainModuleFailureFallback:true,sharedBoundsOffsets:true}));
const targetEvents=[],targetRoot={},targetPixi={gl,resetState(){},render(...args){targetEvents.push(args);}};
const targetApp={renderer:targetPixi,stage:targetRoot,canvas};const targetPass=installSharedPass({app:targetApp,threeRenderer:three,draw(){throw Error('must bypass');},onFailure(){throw Error('must bypass');}});
const target={};targetPixi.render({container:targetRoot,target});targetPixi.render(targetRoot,{renderTexture:target});assert.equal(targetEvents.length,2);assert.equal(targetEvents[0][0].target,target);assert.equal(targetEvents[1][1].renderTexture,target);targetPass.dispose();
console.log(JSON.stringify({sameStageRenderTargetAndLegacyTargetBypass:'PASS',fullThreeCompositeExtractionSupported:false}));
