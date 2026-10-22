import assert from'node:assert/strict';import{assertContactRestoration as check}from'./restore-contract.mjs';
const b={frames:4,three:'exact-three',pixi:'exact-pixi',sceneClock:0,state:{camera:1,materials:[2],objects:[3]},pose:{cell:0}},a={...b,frames:5};check(b,a);let n=1;
for(const d of [{frames:4},{frames:6},{three:'changed'},{pixi:'changed'},{sceneClock:1},{state:{camera:2}},{pose:{cell:1}}]){assert.throws(()=>check(b,{...a,...d}));n++;}
console.log(JSON.stringify({checks:n,status:'PASS',unchangedPixelsRequired:true,exactFrameProgressRequired:1}));
