import assert from 'node:assert/strict';
import {projection,hm02PilotAllowed} from './hm02Projection.mjs';
import {installSharedPass} from './hm02SharedPass.mjs';
const p=projection({worldWidthPx:2880,worldHeightPx:2880,unitsPerWorldPixel:1/45,elevationDegrees:55});
let checks=0;const near=(a,b)=>{checks++;assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);};
for(const x of [0,16,1024,2048,2880])for(const y of [0,512,2048,2880])for(const h of [-.005,.009,.012]){const q=p.screen(p.ground(x,y,h));near(q[0],x);near(q[1],y);}
// Native cell origin remains unchanged for standing, sleep, jump, flipped frames.
for(const z of [0,4,38])for(const supportOffsetY of [-8,0,12,24])for(const dx of [-40,0,40])for(const dy of [-65,0,12]){
 const q=p.screen(p.actorVertex({worldX:812,worldY:1234,worldZ:z,supportOffsetY,groundHeight:.009},dx,dy));near(q[0],812+dx);near(q[1],1234+dy-z);
}
assert.throws(()=>p.actorVertex({worldX:0,worldY:0},0,0),/SUPPORT/);
const gl={getContextAttributes:()=>({stencil:true})};const r={gl,resetState(){}};
const base={enabled:true,fieldId:'field_hm02_01',manifest:{schema:'HM02_THREE_PILOT.v1',qaApproved:true},renderer:r};
assert(hm02PilotAllowed(base));for(const fieldId of ['field_hm01_01','field_hm08_01','field_hm03_01'])assert(!hm02PilotAllowed({...base,fieldId}));
assert(!hm02PilotAllowed({...base,enabled:false}));assert(!hm02PilotAllowed({...base,manifest:{...base.manifest,qaApproved:false}}));
let events=[];const root={},canvas={};const pixi={gl,resetState(){events.push('pixiReset');},render(o){events.push(o.clear===false?'overlay':'original');}};const original=pixi.render;
const app={renderer:pixi,stage:root,canvas};const three={getContext:()=>gl,domElement:canvas,resetState(){events.push('threeReset');}};
const pass=installSharedPass({app,threeRenderer:three,draw(){events.push('threeDraw');},onFailure(){events.push('failure');}});
pixi.render({container:root});assert.deepEqual(events,['threeReset','threeDraw','pixiReset','overlay']);events=[];
pixi.render({container:{}});assert.deepEqual(events,['original']);
assert.throws(()=>installSharedPass({app,threeRenderer:three}),/OWNED/);pass.dispose();pass.dispose();assert.equal(pixi.render,original);
const failing=installSharedPass({app,threeRenderer:three,draw(){throw new Error('GPU');},onFailure(){events.push('fallback');}});events=[];pixi.render({container:root});assert.deepEqual(events,['threeReset','fallback','pixiReset','original']);assert.equal(pixi.render,original);failing.dispose();
console.log(JSON.stringify({status:'PASS',numericProjectionAssertions:checks,sharedPass:'order/extraction/dispose/failure',browserGPU:false},null,2));
const {cameraFacingVertex,flatGroundRayPoint}=await import('./hm02FlatGroundDepthCandidate.mjs');
for(const z of [0,12,40])for(const dy of [-60,0,28]){
 const v=cameraFacingVertex(p,{worldX:900,worldY:1230,worldZ:z,groundHeight:-.005},-13,dy),q=p.screen(v),g=flatGroundRayPoint(p,v,-.005),gs=p.screen(g);
 near(q[0],887);near(q[1],1230+dy-z);near(gs[0],q[0]);near(gs[1],q[1]);near(g[1],-.005);
}
console.log(JSON.stringify({flatGroundAlternative:'45 projection/ray assertions PASS',totalNumericAssertions:checks,GPUShaderCompiled:false}));
const {loadHM02ThreePilot}=await import('./loadHM02ThreePilot.mjs');
const oldLocation=globalThis.location;
globalThis.location={href:'https://example.com/?hm02ThreeReview=1',hostname:'example.com'};
assert.equal(await loadHM02ThreePilot({stage:null}),null);
globalThis.location={href:'http://localhost/?hm02ThreeReview=1',hostname:'localhost'};
assert.equal(await loadHM02ThreePilot({stage:null,fieldArt:{getDiagnostics:()=>({fieldId:'field_hm01_01'})}}),null);
assert.equal(await loadHM02ThreePilot({stage:{app:{screen:{width:390,height:844}}},fieldArt:{getDiagnostics:()=>({fieldId:'field_hm02_01'})},fieldSource:{field:{getView:()=>({worldWidthPx:2048,worldHeightPx:2048})}}}),null);
globalThis.location=oldLocation;
console.log(JSON.stringify({entryGate:'production domain, HM01 and old2048 return before Three imports: PASS'}));
