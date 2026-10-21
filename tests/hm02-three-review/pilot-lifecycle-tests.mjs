import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createHM02ThreePilot} from './createHM02ThreePilot.mjs';
// CPU-only installed exact Three package, no WebGL/browser/context creation.
const THREE=await import(process.env.HM02_THREE_MODULE??'/tmp/ranch-three-math/node_modules/three/build/three.module.js');
const originalFetch=globalThis.fetch,originalLocation=globalThis.location;
globalThis.location={hostname:'localhost'};
const bytes={terrain:new Uint8Array([1]).buffer,trees:new Uint8Array([2]).buffer,instances:new TextEncoder().encode(JSON.stringify({coordinateSpace:'glTF_Y_UP',prototypes:[{id:0,nodeName:'tree'}],instances:Array.from({length:37},()=>({prototype:0,position:[0,0,0],scale:[1,1,1]}))})).buffer};
const hashes={};for(const [k,v]of Object.entries(bytes))hashes[k]=Buffer.from(await webcrypto.subtle.digest('SHA-256',v)).toString('hex');
const manifest={schema:'HM02_THREE_PILOT.v1',qaApproved:false,projection:{worldWidthPx:2880,worldHeightPx:2880,unitsPerWorldPixel:1/45,elevationDegrees:55},glb:{url:'terrain',sha256:hashes.terrain},treePrototypes:{url:'trees',sha256:hashes.trees},treeInstances:{url:'instances',sha256:hashes.instances}};
async function exercise({cut=null,failure=null,shader=false,raceDepth=0,raceAsset='terrain'}={}){
 const events=[],signalOwner=new AbortController();let release,startedResolve,listenerCount=0,created=0,disposed=0,assetDisposals=0,batchDisposals=0;
 const started=new Promise(r=>startedResolve=r),hold=new Promise(r=>release=r);
 async function phase(name){events.push(name);if(name===cut){startedResolve();await hold;}if(name===failure)throw new Error(name);}
 const canvas={addEventListener(){},removeEventListener(){}},root={},gl={getContextAttributes:()=>({stencil:true})};
 const pixi={gl,resolution:1,resetState(){events.push('reset');},render(){events.push('originalRender');}};
 const stage={PIXI:{VERSION:'8.19.0'},app:{destroy(){events.push("appDestroy");},renderer:pixi,canvas,stage:root,screen:{width:390,height:844}},onContextLost(){listenerCount++;return ()=>listenerCount--;}};
 class Renderer{constructor(){created++;events.push('constructor');this.debug={};this.domElement=canvas;this.info={};}getContext(){return gl;}resetState(){}setClearColor(){}setPixelRatio(){}setSize(){}setScissorTest(){}dispose(){disposed++;events.push('rendererDispose');}render(){events.push('threeDraw');if(shader)this.debug.onShaderError();events.push('threeDrawDone');}}
 class Batch extends THREE.InstancedMesh{dispose(){batchDisposals++;super.dispose();}}
 class Loader{async parseAsync(b){const name=new Uint8Array(b)[0]===1?'terrain':'trees';const scene=new THREE.Scene(),geometry=new THREE.BufferGeometry(),material=new THREE.MeshBasicMaterial();geometry.addEventListener('dispose',()=>assetDisposals++);material.addEventListener('dispose',()=>assetDisposals++);const mesh=new THREE.Mesh(geometry,material);mesh.name='tree';scene.add(mesh);await phase('parse:'+name);if(raceDepth&&name===raceAsset){let n=raceDepth;const tick=()=>{if(--n===0)signalOwner.abort();else queueMicrotask(tick);};queueMicrotask(tick);}return {scene};}}
 globalThis.fetch=async(url,options)=>{assert(options.signal);await phase('fetch:'+url);return {ok:true,arrayBuffer:async()=>{await phase('body:'+url);return bytes[url];}};}; 
 const m=structuredClone(manifest);if(failure==='hash')m.glb.sha256='0'.repeat(64);
 const result=createHM02ThreePilot({THREE:{...THREE,WebGLRenderer:Renderer,InstancedMesh:Batch},GLTFLoader:Loader,stage,enabled:true,reviewHarness:true,fieldId:'field_hm02_01',manifest:m,signal:signalOwner.signal,resolveSupport(){},onFallback(){events.push('fallback');}});
 if(raceDepth){const pilot=await result;await new Promise(r=>setTimeout(r,0));assert.equal(pilot,null);assert.equal(assetDisposals,raceAsset==='terrain'?2:4);assert.equal(created,0);assert.equal(listenerCount,0);return events;}
 if(cut){await started;signalOwner.abort();const pilot=await Promise.race([result,new Promise((_,reject)=>setTimeout(()=>reject(Error('abort did not settle promptly')),1000))]);assert.equal(pilot,null);assert.equal(created,0);assert.equal(listenerCount,0);release();await new Promise(r=>setTimeout(r,0));if(cut.startsWith('parse:'))assert(assetDisposals>=2);}
 else{const pilot=await result;if(failure){assert.equal(pilot,null);assert.equal(created,0);assert.equal(listenerCount,0);pixi.render({container:root});assert.equal(events.at(-1),'originalRender');}
 else {assert(pilot);assert.equal(events[events.indexOf('constructor')+1],'reset');const background={renderable:true};pilot.setFallbackRestore(()=>events.push('occluderRestore'));pilot.sync({view:{wildCreatures:[],transform:{scale:1},viewRect:{left:0,top:0}},wildNodes:new Map(),backgroundNodes:[background]});assert.equal(background.renderable,false);
 if(shader){pixi.render({container:root});assert.equal(background.renderable,true);assert(events.indexOf('threeDrawDone')<events.indexOf('occluderRestore'));assert.equal(events.at(-1),'originalRender');assert(events.indexOf('occluderRestore')<events.indexOf('originalRender'));}
 pilot.dispose();pilot.dispose();assert.equal(disposed,0);stage.app.destroy();assert.equal(disposed,1);assert.equal(batchDisposals,1);assert.equal(listenerCount,0);assert.equal(assetDisposals,4);}}
 return events;
}
try{
 for(const cut of ['fetch:terrain','body:terrain','parse:terrain','fetch:trees','body:trees','parse:trees','fetch:instances','body:instances'])await exercise({cut});
 for(const failure of ['fetch:terrain','hash','parse:terrain','parse:trees'])await exercise({failure});
 await exercise();await exercise({shader:true});
 for(const raceAsset of ['terrain','trees'])for(let raceDepth=1;raceDepth<=10;raceDepth++)await exercise({raceAsset,raceDepth});
 console.log(JSON.stringify({status:'PASS',actualPilotAborts:8,parseHandoffMicrotaskRaces:20,actualPilotFailures:4,successAndShaderFallback:true,lateParseCleanup:true,rendererCreatedAfterCPUAssets:true,instanceDisposeOnce:true,browserGPU:false}));
}finally{globalThis.fetch=originalFetch;globalThis.location=originalLocation;}
