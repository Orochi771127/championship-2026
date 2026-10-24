// Complete LOCAL review artifacts; exact and instrumented are distinct claims.
// No source/core overwrite, deletion, chmod, git, network, browser or publication.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {here,sha,read,json,walkFiles,safeRelative,verifyRow,verifyBaseline,preflight} from './preflight.mjs';
const args=process.argv.slice(2),options={mode:'exact',root:process.cwd(),compileOnly:false,verifyArtifact:null,provisionalSeal:null,baselineVariant:'current-reviewed-test-repairs'};
for(let i=0;i<args.length;i++){
 const name=args[i];if(name==='--compile-only')options.compileOnly=true;
 else if(['--mode','--root','--verify-artifact','--provisional-seal','--baseline-variant'].includes(name)){assert(args[i+1]&&!args[i+1].startsWith('--'),'MISSING_ARGUMENT');options[name==='--verify-artifact'?'verifyArtifact':name==='--provisional-seal'?'provisionalSeal':name==='--baseline-variant'?'baselineVariant':name.slice(2)]=args[++i];}
 else throw Error('UNKNOWN_ARGUMENT: '+name);
}
assert(['exact','instrumented'].includes(options.mode),'UNKNOWN_BUILD_MODE');assert(!(options.compileOnly&&options.verifyArtifact),'CONFLICTING_BUILD_MODE');
assert(!options.provisionalSeal||(options.compileOnly&&!options.verifyArtifact),'PROVISIONAL_SEAL_COMPILE_ONLY_NO_ARTIFACT');
assert(options.baselineVariant==='current-reviewed-test-repairs'||(options.baselineVariant==='frozen-local-reference'&&(options.compileOnly||options.verifyArtifact)),'CURRENT_REPAIRS_REQUIRED_FOR_MATERIALIZATION');
const {root,core,base,candidate,contracts,packet,summary:before}=await preflight({root:options.root,provisionalSeal:options.provisionalSeal,baselineVariant:options.baselineVariant});
const {baseline,overlay,resources,expected}=contracts;
let completed=false;
try {
const instrumented=options.mode==='instrumented';
const out=options.verifyArtifact?path.resolve(options.verifyArtifact):path.join(root,'.tmp/hunt-three-admission',options.mode);
if(options.verifyArtifact){assert(fs.existsSync(out),'VERIFY_ARTIFACT_REQUIRED');assert(!fs.lstatSync(out).isSymbolicLink(),'VERIFY_ARTIFACT_LINK');}
else if(!options.compileOnly){
 assert(!fs.existsSync(out),'OUTPUT_MUST_BE_ABSENT_NO_CLEANUP_PERMITTED');
 // Existing ancestors must not redirect output into the readonly source/core.
 let current=root;for(const part of ['.tmp','hunt-three-admission',options.mode]){current=path.join(current,part);if(fs.existsSync(current))assert(!fs.lstatSync(current).isSymbolicLink(),'OUTPUT_PARENT_LINK');}
}
const {encodePublicBuildManifest}=await import(path.join(root,'scripts/lib/build-manifest-codec.mjs'));
const {bundledBrowserHtml}=await import(path.join(root,'scripts/lib/browser-bundle.mjs'));
const {assertPagesModuleClosure}=await import(path.join(root,'scripts/lib/pages-module-closure.mjs'));
const {assertPublicBytes}=await import(path.join(root,'scripts/lib/public-runtime-boundary.mjs'));
const {assertPagesPayloadSize}=await import(path.join(root,'scripts/lib/pages-payload-size.mjs'));
const {validateExternalManifest,validateGeometryOnlyGlb}=await import(path.join(candidate,'src/championship/presentation/vs2/huntThree/externalMapAssets.mjs'));
const {MAPS}=await import(path.join(candidate,'src/championship/presentation/vs2/huntThree/manifestBindings.mjs'));
const input=json(path.join(root,'docs/contracts/championship/WEB_BUILD_INPUTS.v1.json'));
const allowlist=json(path.join(root,'docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'));
const selected=new Map(allowlist.files.map(r=>[r.path,r]));
const inheritedMedia=new Map(base.files.filter(r=>/\.(?:png|webp|jpe?g|wav|mp3|mp4)$/i.test(r.path)).map(r=>[r.path,r.sha256]));
const recipe=input.browserBundle,outdir=path.join(root,recipe.outputDirectory);
const files=overlay.files.map(r=>r.path),allowed=new Set([...input.files,...files]);
const changedPaths=new Set(['src/championship/app/main.js','src/championship/presentation/vs2/createHuntFieldPixiPresentation.js','src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs']);
const extraPath='src/championship/presentation/vs2/huntThree/actionsReviewBridge.mjs';
let adapter=null,extras=new Map();
if(instrumented){
 adapter=await import('./adapter.mjs');assert.equal(typeof adapter.instrument,'function','INSTRUMENT_ADAPTER_REQUIRED');
 const entries=adapter.extraInputs instanceof Map?[...adapter.extraInputs]:Object.entries(adapter.extraInputs??{});
 assert.equal(entries.length,1,'FINITE_EXTRA_INPUT_REQUIRED');assert.equal(entries[0][0],extraPath);
 const actual=entries[0][1] instanceof URL?fileURLToPath(entries[0][1]):path.resolve(here,entries[0][1]);
 assert.equal(actual,path.join(here,'bridge.mjs'),'BRIDGE_SOURCE_BOUNDARY');extras.set(extraPath,actual);allowed.add(extraPath);
}
const esbuild=await import(path.join(root,'node_modules/esbuild/lib/main.js'));assert.equal(esbuild.version,recipe.toolVersion);
const sources=new Map(),adapterDelta=[];
const result=await esbuild.build({absWorkingDir:root,entryPoints:[recipe.entry],outdir,entryNames:'main-[hash]',chunkNames:'chunk-[hash]',bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',metafile:true,write:false,minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:true,keepNames:false,charset:'utf8',external:['node:*'],logLevel:'silent',plugins:[{name:'finite-local-admission-overlay',setup(build){
 build.onResolve({filter:/.*/},args=>{
  if(args.path==='three'||args.path==='pixi.js')return {path:path.resolve(root,input.importMap[args.path])};
  if(args.path.startsWith('.')){const absolute=path.resolve(args.resolveDir||root,args.path),rel=path.relative(root,absolute).replaceAll('\\','/');if(extras.has(rel)||fs.existsSync(path.join(candidate,rel))||fs.existsSync(absolute))return {path:absolute};}
 });
 build.onLoad({filter:/\.(?:m?js|json)$/},async args=>{
  const rel=path.relative(root,args.path).replaceAll('\\','/');assert(allowed.has(rel),'UNSELECTED_COMPILER_INPUT: '+rel);
  const override=path.join(candidate,rel),isOverlay=files.includes(rel),bytes=read(extras.get(rel)??(isOverlay?override:args.path));
  if(!isOverlay&&!extras.has(rel))assert.equal(sha(bytes),selected.get(rel)?.sha256,'BASELINE_SOURCE_HASH: '+rel);
  let contents=bytes.toString('utf8');const loader=rel.endsWith('.json')?'json':'js';
  if(instrumented&&!extras.has(rel)){
   const next=adapter.instrument(rel,contents);assert.equal(typeof next,'string');
   if(next!==contents){assert(changedPaths.has(rel),'INSTRUMENTATION_OUTSIDE_FINITE_PATHS');adapterDelta.push({path:rel,beforeSHA256:sha(bytes),afterSHA256:sha(Buffer.from(next)),beforeBytes:bytes.length,afterBytes:Buffer.byteLength(next)});contents=next;}
  }
  sources.set(rel,{path:rel,sha256:sha(Buffer.from(contents)),bytes:Buffer.byteLength(contents)});
  if(loader==='js'&&contents.includes('import.meta.url')){const original=path.relative(outdir,args.path).replaceAll('\\','/');contents=(await esbuild.transform(contents,{loader:'js',format:'esm',target:'esnext',sourcefile:rel,define:{'import.meta.url':'__cmOriginalModuleURL'},banner:`const __cmOriginalModuleURL=new URL(${JSON.stringify(original)},import.meta.url).href;`})).code;}
  return {contents,loader,resolveDir:path.dirname(args.path)};
 });
}}]});
for(const name of Object.keys(result.metafile.inputs))assert(allowed.has(name),name);
if(instrumented)assert.deepEqual(adapterDelta.map(r=>r.path).sort(),[...changedPaths].sort(),'EXPECTED_THREE_FINITE_INSTRUMENTATION_EDITS');
else assert.equal(adapterDelta.length,0);
const threeInputs=Object.keys(result.metafile.inputs).filter(p=>/^node_modules\/three\/build\//.test(p)).sort();assert.deepEqual(threeInputs,['node_modules/three/build/three.core.js','node_modules/three/build/three.module.js']);
const outputs=result.metafile.outputs,entry=Object.keys(outputs).find(p=>outputs[p].entryPoint===recipe.entry);assert(entry);
for(const [name,item]of Object.entries(outputs))for(const edge of item.imports){assert(!edge.external,'EXTERNAL_OUTPUT_IMPORT');assert(outputs[edge.path],'MISSING_STATIC_OR_DYNAMIC_OUTPUT_EDGE');}
const startup=new Set();function visit(p){if(startup.has(p))return;startup.add(p);for(const i of outputs[p].imports)if(i.kind==='import-statement'&&!i.external)visit(i.path);}visit(entry);
const startupInputs=new Set([...startup].flatMap(p=>Object.keys(outputs[p].inputs)));assert(![...startupInputs].some(p=>p.startsWith('node_modules/three/')),'THREE_IN_TITLE_STARTUP');
const generated=result.outputFiles.map(f=>({path:path.relative(root,f.path).replaceAll('\\','/'),bytes:Buffer.from(f.contents)}));assert(generated.every(f=>f.path.startsWith(recipe.outputDirectory+'/')&&f.path.endsWith('.js')));
const metadata={version:1,tool:'esbuild',toolVersion:esbuild.version,entry,startupModules:[...startup].sort(),generatedFiles:generated.map(f=>f.path).sort()};
const html=Buffer.from(bundledBrowserHtml(read(path.join(root,'championship.html')).toString('utf8'),metadata,base.importMap));
const MANIFEST_FIELDS=['schema','map','qaApproved','glb','file','sha256','bytes','materials','textures','compression','extension','meshes','node','category','primitives','triangles','vertices','fields','field_hm01_01','field_hm01_02','field_hm08_01','field_hm08_02','variant','clearColor','frames','width','height','projection','kind','elevationDegrees','azimuthDegrees','nativePxPerUnit','worldPxPerNativePx','nativeSize','worldSize','orthoScaleUnits','cameraForwardGltf','cameraUpGltf','groundSupport','walkableHeightUnits','measured','miss','groundHeights'];
const HEIGHT_FIELDS=['field','tile','units','grid','summary','walk','water','count','min','max','miss'];
const resource=[];
for(const key of ['hm01','hm08']){
 const binding=MAPS[key],manifestPath=binding.directory+binding.manifest.file,b=read(path.join(candidate,manifestPath));assert.equal(sha(b),binding.manifest.sha256);assert.equal(b.length,binding.manifest.bytes);const m=JSON.parse(b);assert.equal(m.map,key);assert.equal(m.qaApproved,false);for(const field of binding.fields)validateExternalManifest(m,field);
 assertPublicBytes(manifestPath,b,{jsonFields:MANIFEST_FIELDS});resource.push({path:manifestPath,bytes:b,jsonFields:MANIFEST_FIELDS});
 for(const asset of [m.glb,m.groundHeights,...Object.values(m.fields).flatMap(f=>f.frames)]){
  const name=binding.directory+asset.file,bytes=read(path.join(candidate,name));assert.equal(sha(bytes),asset.sha256,name);assert.equal(bytes.length,asset.bytes,name);assertPublicBytes(name,bytes,{jsonFields:name.endsWith('.json')?HEIGHT_FIELDS:undefined});
  if(name.endsWith('.glb')){validateGeometryOnlyGlb(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),m);const text=bytes.toString('utf8',20,20+bytes.readUInt32LE(12));assert(!/"uri"\s*:/.test(text));assert(!text.toLowerCase().includes(String.fromCharCode(46)+'blend'));}
  resource.push({path:name,bytes,jsonFields:name.endsWith('.json')?HEIGHT_FIELDS:undefined});
 }
}
for(const d of resources.files.filter(r=>r.owner==='npm')){const bytes=verifyRow(root,d);assertPublicBytes(d.path,bytes);resource.push({path:d.path,bytes});}
assert.equal(resource.length,15);assert.equal(resource.reduce((n,r)=>n+r.bytes.length,0),14739579);
assert.deepEqual(resource.map(r=>({path:r.path,sha256:sha(r.bytes),bytes:r.bytes.length})),resources.files.map(({path,sha256,bytes})=>({path,sha256,bytes})),'RESOURCE_ORDER_OR_IDENTITY');
const newBytes=new Map([...resource,...generated,{path:'championship.html',bytes:html},{path:'index.html',bytes:html}].map(r=>[r.path,r.bytes]));
const oldBundle=new Set(base.browserBundle.generatedFiles),inherited=base.files.filter(r=>!oldBundle.has(r.path)&&!['index.html','championship.html'].includes(r.path));assert(inherited.every(r=>!newBytes.has(r.path)),'NEW_RESOURCE_CANNOT_OVERWRITE_CORE');
for(const r of generated)assertPublicBytes(r.path,r.bytes);assertPublicBytes('index.html',html);
const rows=[...inherited,...[...newBytes].map(([p,b])=>({path:p,sha256:sha(b),bytes:b.length}))].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const admittedInputs={schema:instrumented?'LOCAL_HUNT_ACTIONS_INSTRUMENTED_INPUTS.v1':'LOCAL_HUNT_ADMISSION_INPUTS.v1',baselineBuildId:base.buildId,sourceInputs:[...sources.values()].sort((a,b)=>a.path.localeCompare(b.path,'en')),resources:resource.map(r=>({path:r.path,sha256:sha(r.bytes),bytes:r.bytes.length})),...(instrumented?{reviewAdapter:{sha256:sha(read(path.join(here,'adapter.mjs'))),bridgeSHA256:sha(read(path.join(here,'bridge.mjs'))),exactCandidateBuildId:expected.buildId,delta:adapterDelta.slice().sort((a,b)=>a.path.localeCompare(b.path,'en'))}}:{})};
const inputBytes=Buffer.from(JSON.stringify(admittedInputs,null,2)+'\n'),inputSha256=sha(inputBytes),target=instrumented?expected.instrumentedTarget:expected.target,buildId=sha(JSON.stringify({target,inputSha256,files:rows}));
const moduleEntries=[...base.moduleEntries.filter(p=>!oldBundle.has(p)),...metadata.generatedFiles];
const manifest={schemaVersion:2,target,buildId,commit:baseline.coreCommit,inputSha256,entry:'index.html',publicReleasePermitted:false,loopbackOnly:true,sourcePayloadIncluded:false,faithfulInternalVfxIncluded:false,romDerivedBattleCatalogsIncluded:base.romDerivedBattleCatalogsIncluded,staticModuleClosure:{checked:true,moduleCount:moduleEntries.length},moduleEntries,importMap:base.importMap,browserBundle:metadata,release:{approved:false},fileCount:rows.length+1,files:rows,saveStorage:'BROWSER_LOCAL_STORAGE'};
const manifestBytes=Buffer.from(JSON.stringify(encodePublicBuildManifest(manifest))+'\n');
const total=rows.reduce((n,r)=>n+r.bytes,0)+manifestBytes.length,bundleDelta=generated.reduce((n,r)=>n+r.bytes.length,0)-base.files.filter(r=>oldBundle.has(r.path)).reduce((n,r)=>n+r.bytes,0),metadataDelta=manifestBytes.length-baseline.coreManifest.bytes+html.length*2-base.files.filter(r=>['index.html','championship.html'].includes(r.path)).reduce((n,r)=>n+r.bytes,0);
assert.equal(total,baseline.coreCompleteBytes+14739579+bundleDelta+metadataDelta);assert(total<=(instrumented?expected.instrumentedCompleteCeilingBytes:expected.completeCeilingBytes),'MODE_COMPLETE_CEILING');assert(bundleDelta<=expected.bundleGrowthCapBytes);assert(metadataDelta<=expected.metadataGrowthCapBytes);assertPagesPayloadSize([...rows,{path:'pages-build.json',bytes:manifestBytes.length}]);
if(instrumented){assert.notEqual(buildId,expected.buildId);assert(total<=expected.completeBytes+expected.instrumentedAdditionalCompleteBytesCap,'INSTRUMENTED_EXTRA_BUDGET');}
else{assert.equal(buildId,expected.buildId,'EXACT_BUILD_ID_DRIFT');assert.equal(inputSha256,expected.inputSHA256,'EXACT_INPUT_DRIFT');assert.equal(total,expected.completeBytes);assert.equal(rows.length+1,expected.fileCount);assert.equal(sha(manifestBytes),expected.pagesReceipt.sha256);assert.equal(manifestBytes.length,expected.pagesReceipt.bytes);}
assertPublicBytes('pages-build.json',manifestBytes,{generated:true});
let artifactInspected=false,closure=null;
if(!options.compileOnly){
 if(!options.verifyArtifact){
  const stat=fs.statfsSync(root),free=Number(stat.bavail)*Number(stat.bsize),newAllocated=[...newBytes.values()].reduce((n,b)=>n+b.length,0)+manifestBytes.length;assert(free>newAllocated+64*1024*1024,'INSUFFICIENT_FREE_SPACE_FOR_THIN_ARTIFACT');
  fs.mkdirSync(out,{recursive:true});for(const row of inherited){const dest=path.join(out,row.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.linkSync(path.join(core,row.path),dest);}
  for(const [p,b]of [...newBytes,['pages-build.json',manifestBytes]]){const dest=path.join(out,p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b,{flag:'wx'});}
 }
 assert.equal(sha(read(path.join(out,'pages-build.json'))),sha(manifestBytes),'ARTIFACT_RECEIPT_DRIFT');
 const actual=walkFiles(out);assert.deepEqual(actual,[...rows.map(r=>r.path),'pages-build.json'].sort(),'ARTIFACT_FILE_SET');
 for(const row of rows){const b=verifyRow(out,row),extra=resource.find(r=>r.path===row.path);assertPublicBytes(row.path,b,{jsonFields:extra?.jsonFields??selected.get(row.path)?.jsonFields,renderedMedia:inheritedMedia});}
 closure=assertPagesModuleClosure({root:out,files:actual,entries:moduleEntries,importMap:base.importMap});assert.equal(closure.visited.length,moduleEntries.length);artifactInspected=true;
}
const {summary:after}=await verifyBaseline(root,contracts,{baselineVariant:options.baselineVariant});assert.deepEqual(after,before);for(const row of overlay.files)verifyRow(candidate,row);
console.log(JSON.stringify({status:options.compileOnly?'PASS_COMPILE_ONLY_NO_MATERIALIZED_ARTIFACT':'PASS_COMPLETE_LOCAL_ARTIFACT_NOT_BROWSER_OR_PUBLIC_AUTHORITY',mode:options.mode,claim:options.compileOnly?(instrumented?'INSTRUMENTED_COMPILE_ONLY_NOT_PACKAGED_EVIDENCE':'EXACT_CANDIDATE_COMPILE_ONLY_NOT_PACKAGED_EVIDENCE'):(instrumented?expected.instrumentedClaim:'EXACT_PACKAGED_CANDIDATE'),candidateSHA256:overlay.candidateSHA256,packetSealSHA256:packet.sealSHA256,packetProvisional:packet.provisional,baselineBuildId:base.buildId,buildId,inputSha256,artifactReceiptSHA256:sha(manifestBytes),artifactFiles:rows.length+1,completeBytes:total,completeCeilingBytes:(instrumented?expected.instrumentedCompleteCeilingBytes:expected.completeCeilingBytes),remainingCeilingBytes:(instrumented?expected.instrumentedCompleteCeilingBytes:expected.completeCeilingBytes)-total,resourceIncrementBytes:14739579,bundleDeltaBytes:bundleDelta,metadataDeltaBytes:metadataDelta,instrumentedAdditionalBytes:instrumented?total-expected.completeBytes:0,adapterDelta,generatedBundleFiles:generated.length,compilerInputs:sources.size,oneThreeDependencyGraph:threeInputs,externalCompiledImports:0,titleStartupThreeInputs:0,artifactInspected,staticClosureModules:closure?.visited.length??null,unchangedCoreHardlinks:inherited.length,newWrittenBytes:options.compileOnly||options.verifyArtifact?0:[...newBytes.values()].reduce((n,b)=>n+b.length,0)+manifestBytes.length,before,after,publicReleasePermitted:false,browserGPU:false,physicalPhoneApproved:false,qaApproved:false,warnings:result.warnings.map(w=>({id:w.id,text:w.text,file:w.location?.file}))},null,2));

completed=true;
} finally {
 if(!completed){const {summary:failureAfter}=await verifyBaseline(root,contracts,{baselineVariant:options.baselineVariant});assert.deepEqual(failureAfter,before);for(const row of overlay.files)verifyRow(candidate,row);console.error(JSON.stringify({status:'FAILED_BUILD_REFERENCES_REHASHED_UNCHANGED',core:failureAfter,partialOutputMustNotBeReused:true,publicReleasePermitted:false}));}
}
