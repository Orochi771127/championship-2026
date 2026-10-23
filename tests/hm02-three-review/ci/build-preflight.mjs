// Compile the actual main+renderer candidates with canonical import locations,
// without altering production files or their public input allowlist.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import * as esbuild from 'esbuild';
const root=process.cwd(),base=path.join(root,'tests/hm02-three-review'),out=path.join(root,'artifacts/hm02-three-review');fs.mkdirSync(out,{recursive:true});
const dep=execFileSync(process.execPath,[path.join(base,'dependency-preflight.mjs'),root],{encoding:'utf8'});fs.writeFileSync(path.join(out,'dependency-preflight.json'),dep);
const sourcePairs=[['src/championship/app/main.js','main.candidate.js','36b5345f4acc0e894594f45053e06edd2bfea264'],['src/championship/presentation/vs2/createHuntFieldPixiPresentation.js','createHuntFieldPixiPresentation.candidate.js','fcebbbdf4a92f253a2152cfe9de6f30e7ce8bfa5']];
for(const [source,,sha]of sourcePairs){const bytes=fs.readFileSync(path.join(root,source));assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),sha,`fresh main source changed: ${source}; rebase before test`);}
const overrides=new Map(sourcePairs.map(([source,candidate])=>[path.join(root,source),path.join(base,candidate)]));
for(const name of ['createHM02ThreePilot.mjs','loadHM02ThreePilot.mjs','hm02Projection.mjs','hm02SharedPass.mjs','hm02FlatGroundDepthCandidate.mjs','hm02Lifecycle.mjs','hm02ActorBounds.mjs','manifest.candidate.json'])overrides.set(path.join(root,'src/championship/presentation/vs2',name),path.join(base,name));
const result=await esbuild.build({absWorkingDir:root,entryPoints:['src/championship/app/main.js'],outdir:path.join(out,'not-published-bundle'),bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',metafile:true,write:false,external:['node:*'],plugins:[{name:'isolated-canonical-review-overlay',setup(build){
 build.onResolve({filter:/.*/},args=>{const candidate=path.resolve(args.resolveDir||root,args.path);if(overrides.has(candidate))return {path:candidate};});
 build.onLoad({filter:/.*/},args=>{const file=overrides.get(args.path);if(file)return {contents:fs.readFileSync(file,'utf8'),resolveDir:path.dirname(args.path),loader:file.endsWith('.json')?'json':'js'};});
}}]});
const inputs=Object.keys(result.metafile.inputs);for(const expected of ['node_modules/three/build/three.module.js','node_modules/three/examples/jsm/loaders/GLTFLoader.js','assets/production/public-runtime/vendor-pixi.mjs','src/championship/presentation/vs2/loadHM02ThreePilot.mjs'])assert(inputs.some(k=>k.endsWith(expected)),`missing actual caller dependency: ${expected}`);
fs.writeFileSync(path.join(out,'caller-build-preflight.json'),JSON.stringify({status:'PASS',esbuild:esbuild.version,productionFilesModified:false,sourcePairs,inputs,outputCount:result.outputFiles.length,publishedOutputs:0},null,2));
