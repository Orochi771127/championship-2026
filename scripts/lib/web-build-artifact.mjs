import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {auditWebBuild,auditOwnerPlaytest,readBuildInputs,ART_INDEX_PATH,BUILD_INPUT_PATH,sha256,checkedInput,permittedCopyPath} from './web-build-plan.mjs';
import {isPrivateRepositoryPath} from './public-art-boundary.mjs';
import {assertPagesModuleClosure} from './pages-module-closure.mjs';
import {compileBrowserBundle,bundledBrowserHtml,compiledPublicArtifactPlan} from './browser-bundle.mjs';
import {publicArtifactPlan,assertPublicBytes,assertPublicArtifact,PUBLIC_RUNTIME_INDEX_PATH} from './public-runtime-boundary.mjs';
import {encodePublicBuildManifest,decodeBuildManifest} from './build-manifest-codec.mjs';
export const INTERNAL_TARGET='LOCAL_INTERNAL_REVIEW';
export const PUBLIC_TARGET='GITHUB_PAGES_STATIC';
export const PLAYTEST_TARGET='GITHUB_PAGES_OWNER_PLAYTEST';
export const manifestName=target=>target===INTERNAL_TARGET?'internal-build.json':'pages-build.json';
// Resolve every existing parent before any recursive replacement, including junctions.
export function checkedOutput(root,output,target){
  const base=fs.realpathSync(root),out=path.resolve(output),rel=path.relative(base,out).replaceAll('\\','/');
  if(!rel.startsWith('dist/')||rel.split('/').some(p=>p==='..'||!p))throw Error('UNSAFE_BUILD_OUTPUT');
  let current=base;
  for(const part of rel.split('/')){
    current=path.join(current,part);
    if(fs.existsSync(current)&&fs.realpathSync(current)!==current)throw Error('BUILD_OUTPUT_JUNCTION');
  }
  if(fs.existsSync(out)){
    const marker=path.join(out,manifestName(target));
    if(!fs.existsSync(marker)||JSON.parse(fs.readFileSync(marker,'utf8')).target!==target)throw Error('BUILD_OUTPUT_NOT_OWNED');
  }
  return out;
}
export function collectArtifactFiles(root){
  const files=[];
  function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const absolute=path.join(dir,entry.name);
    if(entry.isSymbolicLink())throw Error('ARTIFACT_LINK_FORBIDDEN');
    if(entry.isDirectory())visit(absolute);
    else if(entry.isFile())files.push(path.relative(root,absolute).replaceAll('\\','/'));
    else throw Error('ARTIFACT_NON_FILE');
  }}
  visit(root);return files.sort();
}
export function buildWebArtifact({root,output,target}){
  if(![INTERNAL_TARGET,PUBLIC_TARGET,PLAYTEST_TARGET].includes(target))throw Error('UNKNOWN_BUILD_TARGET');
  const internal=target===INTERNAL_TARGET,playtest=target===PLAYTEST_TARGET;
  // All public targets use the same boundary; playtest is never a privacy bypass.
  const plan=internal?null:publicArtifactPlan({root,input:readBuildInputs(root),index:JSON.parse(fs.readFileSync(checkedInput(root,ART_INDEX_PATH),'utf8'))});
  const audit=auditWebBuild(root);
  if(!audit.technical.ok)throw Error('WEB_INPUTS_NOT_CLOSED (previous output preserved): '+JSON.stringify(audit.technical.issues));
  if(playtest){const check=auditOwnerPlaytest(root,audit);if(!check.ok)throw Error('PUBLIC_PLAYTEST_NOT_APPROVED: '+JSON.stringify(check.issues));}
  if(!internal&&!playtest&&!audit.release.ok){
    const counts={};for(const row of audit.release.issues)counts[row.kind]=(counts[row.kind]??0)+1;
    throw Error('PUBLIC_RELEASE_NOT_APPROVED (previous output preserved): '+JSON.stringify(counts));
  }
  const out=checkedOutput(root,output,target);
  // Capture bytes before replacing a previous artifact.
  const sources=(internal?audit.input.files:plan.files).map(file=>({file,bytes:!internal&&file===PUBLIC_RUNTIME_INDEX_PATH?plan.indexBytes:fs.readFileSync(checkedInput(root,file))}));
  const bundle=compileBrowserBundle(root,internal?audit.input:{...audit.input,files:plan.files,moduleEntries:plan.moduleEntries});
  const publication=internal?null:compiledPublicArtifactPlan(plan,bundle),published=new Set(publication?.files??[]);
  const entrySource=sources.find(r=>r.file==='championship.html').bytes;
  const entryBytes=bundle?Buffer.from(bundledBrowserHtml(entrySource.toString('utf8'),bundle.metadata,publication?.importMap)):entrySource;
  if(!internal){
    for(const {file,bytes} of sources){
      const selected=plan.allowlist.files.find(row=>row.path===file);
      if(selected?.sha256!==sha256(bytes))throw Error('PUBLIC_SOURCE_SELECTION_HASH: '+file);
      assertPublicBytes(file,bytes,{jsonFields:selected.jsonFields,renderedMedia:plan.renderedMedia});
    }
    for(const file of bundle?.files??[])assertPublicBytes(file.path,file.bytes);
    assertPublicBytes('index.html',entryBytes);
  }
  if(fs.existsSync(out))fs.rmSync(out,{recursive:true});
  fs.mkdirSync(out,{recursive:true});
  const rows=[];
  const write=(file,bytes)=>{
    const destination=path.join(out,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
    rows.push({path:file,sha256:sha256(bytes),bytes:Buffer.byteLength(bytes)});
  };
  for(const {file,bytes} of sources)if(internal||published.has(file))write(file,file==='championship.html'?entryBytes:bytes);
  for(const file of bundle?.files??[])write(file.path,file.bytes);
  write('index.html',entryBytes);
  if(!internal)write('.nojekyll','');
  rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const moduleEntries=internal?[...audit.input.moduleEntries,...(bundle?.metadata.generatedFiles??[])]:publication.moduleEntries;
  const importMap=internal?audit.input.importMap:publication.importMap;
  const closure=assertPagesModuleClosure({root:out,files:rows.map(row=>row.path),entries:moduleEntries,importMap});
  const inputSha256=sha256(fs.readFileSync(path.join(root,BUILD_INPUT_PATH)));
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
  const buildId=sha256(JSON.stringify({target,inputSha256,files:rows}));
  const manifest={schemaVersion:2,target,buildId,commit,inputSha256,entry:'index.html',
    publicReleasePermitted:!internal,loopbackOnly:internal,sourcePayloadIncluded:false,
    faithfulInternalVfxIncluded:internal&&rows.some(r=>isPrivateRepositoryPath(r.path)),
    romDerivedBattleCatalogsIncluded:rows.some(r=>r.path==='src/championship/battle/battleCatalogs.js'),
    ...(playtest?{ownerSelectedReferenceArtIncluded:rows.some(r=>isPrivateRepositoryPath(r.path))}:{}),
    staticModuleClosure:{checked:true,moduleCount:closure.visited.length},moduleEntries,importMap,
    ...(bundle?{browserBundle:internal?bundle.metadata:publicBundleMetadata(bundle.metadata)}:{}),
    release:{approved:!internal&&!playtest,...(internal?{scope:audit.input.release}:{})},
    ...(playtest?{publicPlaytest:{ownerApproved:true,policyId:audit.input.publicPlaytest.policyId,
      rightsDocumentVerified:false,commercialReleaseAccepted:false,fullOriginalParityAccepted:false}}:{}),
    fileCount:rows.length+1,files:rows,saveStorage:'BROWSER_LOCAL_STORAGE'};
  // Lossless receipt compression only: every published runtime byte is unchanged.
  fs.writeFileSync(path.join(out,manifestName(target)),JSON.stringify(internal?manifest:encodePublicBuildManifest(manifest),null,internal?2:undefined)+'\n');
  if(!internal)assertPublicArtifact({root:out,files:collectArtifactFiles(out),plan:publication});
  return {root:out,manifest};
}
export function validateWebArtifact({root,output,target}){
  const out=checkedOutput(root,output,target),name=manifestName(target),internal=target===INTERNAL_TARGET,playtest=target===PLAYTEST_TARGET;
  const m=decodeBuildManifest(JSON.parse(fs.readFileSync(path.join(out,name),'utf8')));
  if(![2,3].includes(m.schemaVersion)||(internal&&m.schemaVersion!==2)||m.target!==target||m.publicReleasePermitted!==!internal||m.loopbackOnly!==internal
    ||m.release?.approved!==(!internal&&!playtest)||m.sourcePayloadIncluded!==false||!Array.isArray(m.files))throw Error('BUILD_BOUNDARY_INVALID');
  if(playtest&&(m.publicPlaytest?.ownerApproved!==true||m.publicPlaytest.rightsDocumentVerified!==false
    ||m.publicPlaytest.commercialReleaseAccepted!==false||m.publicPlaytest.fullOriginalParityAccepted!==false))throw Error('PLAYTEST_BOUNDARY_INVALID');
  const files=collectArtifactFiles(out),expected=[...m.files.map(r=>r.path),name].sort();
  if(new Set(expected).size!==expected.length||JSON.stringify(files)!==JSON.stringify(expected)||m.fileCount!==files.length)throw Error('BUILD_FILE_LIST_MISMATCH');
  for(const row of m.files){
    if(!['index.html','.nojekyll'].includes(row.path)&&!permittedCopyPath(row.path))throw Error('BUILD_UNSAFE_FILE');
    const bytes=fs.readFileSync(checkedInput(out,row.path));
    if(row.sha256!==sha256(bytes)||row.bytes!==bytes.length)throw Error('BUILD_HASH_MISMATCH: '+row.path);
    if(!internal&&!playtest&&isPrivateRepositoryPath(row.path))throw Error('BUILD_PRIVATE_INPUT');
  }
  if(m.buildId!==sha256(JSON.stringify({target,inputSha256:m.inputSha256,files:m.files})))throw Error('BUILD_ID_MISMATCH');
  if(sha256(fs.readFileSync(path.join(out,'index.html')))!==sha256(fs.readFileSync(path.join(out,'championship.html'))))throw Error('BUILD_ENTRY_MISMATCH');
  assertPagesModuleClosure({root:out,files,entries:m.moduleEntries,importMap:m.importMap});
  if(!internal){
    const audit=auditWebBuild(root);
    if(!audit.technical.ok||(!playtest&&!audit.release.ok)||m.inputSha256!==sha256(fs.readFileSync(path.join(root,BUILD_INPUT_PATH))))throw Error('PUBLIC_RELEASE_NOT_APPROVED');
    if(playtest){const check=auditOwnerPlaytest(root,audit);if(!check.ok||m.publicPlaytest.policyId!==check.policy.id)throw Error('PUBLIC_PLAYTEST_NOT_APPROVED');}
    const plan=publicArtifactPlan({root,input:audit.input,index:audit.index});
    const bundle=compileBrowserBundle(root,{...audit.input,files:plan.files,moduleEntries:plan.moduleEntries}),generated=bundle?.metadata.generatedFiles??[];
    const publication=compiledPublicArtifactPlan(plan,bundle);
    if(JSON.stringify(m.browserBundle??null)!==JSON.stringify(bundle?publicBundleMetadata(bundle.metadata):null))throw Error('PUBLIC_BUNDLE_RECIPE_MISMATCH');
    if(JSON.stringify([...publication.files,...generated,'index.html','.nojekyll'].sort())!==JSON.stringify(m.files.map(r=>r.path).sort()))throw Error('PUBLIC_INPUT_LIST_MISMATCH');
    if(JSON.stringify(m.importMap)!==JSON.stringify(publication.importMap))throw Error('PUBLIC_BUNDLE_IMPORT_MAP_CHANGED');
    if(bundle){
      for(const file of bundle.files)if(sha256(fs.readFileSync(checkedInput(out,file.path)))!==sha256(file.bytes))throw Error('PUBLIC_BUNDLE_CHANGED: '+file.path);
      const expected=bundledBrowserHtml(fs.readFileSync(checkedInput(root,'championship.html'),'utf8'),bundle.metadata,publication.importMap);
      if(sha256(fs.readFileSync(path.join(out,'championship.html')))!==sha256(expected))throw Error('PUBLIC_BUNDLE_HTML_CHANGED');
      if(JSON.stringify(m.moduleEntries)!==JSON.stringify(publication.moduleEntries))throw Error('PUBLIC_BUNDLE_ENTRIES_CHANGED');
    }
    for(const row of m.files.filter(r=>!['index.html','.nojekyll',PUBLIC_RUNTIME_INDEX_PATH,...generated,...(bundle?['championship.html']:[])].includes(r.path))){
      if(row.sha256!==sha256(fs.readFileSync(checkedInput(root,row.path))))throw Error('PUBLIC_SOURCE_CHANGED: '+row.path);
    }
    assertPublicArtifact({root:out,files,plan:publication});
  }
  return m;
}
function publicBundleMetadata(metadata){
  const {version,tool,toolVersion,entry,startupModules,generatedFiles}=metadata;
  return {version,tool,toolVersion,entry,startupModules,generatedFiles};
}
