import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const args=process.argv.slice(2),opt=n=>args[args.indexOf(n)+1],input=opt('--input'),output=opt('--output'),expected=opt('--expected-sha');
if(!args.includes('--input')||!args.includes('--output')||!args.includes('--expected-sha')||!input||!output||!/^[a-f0-9]{64}$/.test(expected??''))throw Error('REQUIRED_INPUT_OUTPUT_SHA');
if(path.resolve(input)===path.resolve(output))throw Error('REFUSE_SOURCE_OVERWRITE');
const source=fs.readFileSync(input,'utf8'),sha=crypto.createHash('sha256').update(source).digest('hex');if(sha!==expected)throw Error('SOURCE_HASH_MISMATCH:'+sha);
function once(s,n,r){if(s.split(n).length!==2)throw Error('NON_UNIQUE_SEAM:'+n);return s.replace(n,r);}
const helper=`
  // TEST-ONLY readout; no clock/mixer/material changes and no render calls.
  function captureEnvironmentEffectState(){
    const surfaces=[];
    scene.traverse(o=>{for(const m of [].concat(o.material??[]))if(dynamicShaders.has(m)){
      const uniforms=m.userData.shader?.uniforms,uv=o.geometry?.attributes?.uv;
      surfaces.push({objectId:o.id,materialId:m.id,name:o.name,visible:o.visible,
        waterHooked:Boolean(m.userData.waterHooked),iceHooked:Boolean(m.userData.iceHooked),windHooked:Boolean(m.userData.windHooked),
        compiled:Boolean(uniforms),waterTime:uniforms?.uWaterTime?.value??null,iceTime:uniforms?.uIceTime?.value??null,windTime:uniforms?.uWindTime?.value??null,
        uv:uv?{count:uv.count,itemSize:uv.itemSize}:null,map:m.map?{uuid:m.map.uuid,channel:m.map.channel}:null});
    }});
    return {kind:'TEST_ONLY_ENVIRONMENT_EFFECT_STATE',sceneClock,frames,surfaces};
  }
`;
let patched=once(source,'  function dispose(){',helper+'\n  function dispose(){');
patched=once(patched,'return {render,dispose,groundHeight,pickGroundNative,','return {render,dispose,groundHeight,pickGroundNative,captureEnvironmentEffectState,');
patched='// GENERATED TEST-ONLY ENVIRONMENT DIAGNOSTICS. NEVER SHIP.\n'+patched;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,patched,{flag:'wx'});
console.log(JSON.stringify({inputSha256:sha,outputSha256:crypto.createHash('sha256').update(patched).digest('hex'),productionSourceUnchanged:fs.readFileSync(input,'utf8')===source}));
