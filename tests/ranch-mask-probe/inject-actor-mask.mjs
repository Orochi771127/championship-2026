import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2),option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const input=option('--input'),output=option('--output'),expected=option('--expected-sha');
if(!input||!output||!expected||!/^[a-f0-9]{64}$/.test(expected))throw Error('REQUIRED --input --output --expected-sha EXACT_SHA256');
if(path.resolve(input)===path.resolve(output))throw Error('DO_NOT_OVERWRITE_PRODUCTION_SOURCE');
if(fs.existsSync(output)){
 const original=fs.statSync(input),destination=fs.statSync(output);
 if(fs.realpathSync(input)===fs.realpathSync(output)||(original.dev===destination.dev&&original.ino===destination.ino))throw Error('DO_NOT_OVERWRITE_PRODUCTION_SOURCE_ALIAS');
}
const source=fs.readFileSync(input,'utf8'),sha=crypto.createHash('sha256').update(source).digest('hex');
if(sha!==expected)throw Error(`ACTOR_MASK_SOURCE_HASH_MISMATCH:${sha}`);
const shim=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'actor-mask-probe.fragment.js'),'utf8');
function once(s,needle,replacement){if(s.split(needle).length!==2)throw Error('ACTOR_MASK_SOURCE_SEAM_NOT_UNIQUE:'+needle);return s.replace(needle,replacement);}
let patched=once(source,'  function dispose(){',shim+'\n  function dispose(){');
patched=once(patched,'    if(disposed)return;disposed=true;','    if(disposed)return;disposed=true;\n    disposeActorMaskProbe();');
patched=once(patched,'return {render,dispose,groundHeight,pickGroundNative,getDiagnostics:','return {render,dispose,groundHeight,pickGroundNative,captureActorMask,getDiagnostics:');
patched='// GENERATED TEST-ONLY MASK PROBE. MUST NOT REPLACE PRODUCTION MODULE.\n'+patched;
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,patched,{flag:'wx'});
console.log(JSON.stringify({inputSha256:sha,output,outputSha256:crypto.createHash('sha256').update(patched).digest('hex'),productionSourceUnchanged:fs.readFileSync(input,'utf8')===source}));
