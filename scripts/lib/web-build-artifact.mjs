import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {auditWebBuild,ART_INDEX_PATH,BUILD_INPUT_PATH,sha256,checkedInput,permittedCopyPath} from './web-build-plan.mjs';
import {publicArtIndex,isPrivateRepositoryPath} from './public-art-boundary.mjs';
import {assertPagesModuleClosure} from './pages-module-closure.mjs';
export const INTERNAL_TARGET='LOCAL_INTERNAL_REVIEW';
export const PUBLIC_TARGET='GITHUB_PAGES_STATIC';
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
  if(![INTERNAL_TARGET,PUBLIC_TARGET].includes(target))throw Error('UNKNOWN_BUILD_TARGET');
  const audit=auditWebBuild(root),internal=target===INTERNAL_TARGET;
  if(!audit.technical.ok)throw Error('WEB_INPUTS_NOT_CLOSED (previous output preserved): '+JSON.stringify(audit.technical.issues));
  if(!internal&&!audit.release.ok){
    const counts={};for(const row of audit.release.issues)counts[row.kind]=(counts[row.kind]??0)+1;
    throw Error('PUBLIC_RELEASE_NOT_APPROVED (previous output preserved): '+JSON.stringify(counts));
  }
  const out=checkedOutput(root,output,target);
  // Capture bytes before replacing a previous artifact.
  const sources=audit.input.files.map(file=>({file,bytes:fs.readFileSync(checkedInput(root,file))}));
  if(fs.existsSync(out))fs.rmSync(out,{recursive:true});
  fs.mkdirSync(out,{recursive:true});
  const rows=[];
  const write=(file,bytes)=>{
    const destination=path.join(out,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
    rows.push({path:file,sha256:sha256(bytes),bytes:Buffer.byteLength(bytes)});
  };
  for(const {file,bytes} of sources)write(file,file===ART_INDEX_PATH&&!internal?JSON.stringify(publicArtIndex(audit.index),null,2)+'\n':bytes);
  write('index.html',sources.find(r=>r.file==='championship.html').bytes);
  if(!internal)write('.nojekyll','');
  rows.sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const inputSha256=sha256(fs.readFileSync(path.join(root,BUILD_INPUT_PATH)));
  const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
  const buildId=sha256(JSON.stringify({target,inputSha256,files:rows}));
  const manifest={schemaVersion:2,target,buildId,commit,inputSha256,entry:'index.html',
    publicReleasePermitted:!internal,loopbackOnly:internal,sourcePayloadIncluded:false,
    faithfulInternalVfxIncluded:internal&&rows.some(r=>isPrivateRepositoryPath(r.path)),
    romDerivedBattleCatalogsIncluded:internal&&rows.some(r=>r.path==='src/championship/battle/battleCatalogs.js'),
    staticModuleClosure:{checked:true,moduleCount:audit.technical.moduleCount},
    moduleEntries:audit.input.moduleEntries,importMap:audit.input.importMap,
    release:{approved:!internal,scope:audit.input.release},fileCount:rows.length+1,files:rows,saveStorage:'BROWSER_LOCAL_STORAGE'};
  fs.writeFileSync(path.join(out,manifestName(target)),JSON.stringify(manifest,null,2)+'\n');
  return {root:out,manifest};
}
export function validateWebArtifact({root,output,target}){
  const out=checkedOutput(root,output,target),name=manifestName(target),internal=target===INTERNAL_TARGET;
  const m=JSON.parse(fs.readFileSync(path.join(out,name),'utf8'));
  if(m.schemaVersion!==2||m.target!==target||m.publicReleasePermitted!==!internal||m.loopbackOnly!==internal
    ||m.release?.approved!==!internal||m.sourcePayloadIncluded!==false||!Array.isArray(m.files))throw Error('BUILD_BOUNDARY_INVALID');
  const files=collectArtifactFiles(out),expected=[...m.files.map(r=>r.path),name].sort();
  if(new Set(expected).size!==expected.length||JSON.stringify(files)!==JSON.stringify(expected)||m.fileCount!==files.length)throw Error('BUILD_FILE_LIST_MISMATCH');
  for(const row of m.files){
    if(!['index.html','.nojekyll'].includes(row.path)&&!permittedCopyPath(row.path))throw Error('BUILD_UNSAFE_FILE');
    const bytes=fs.readFileSync(checkedInput(out,row.path));
    if(row.sha256!==sha256(bytes)||row.bytes!==bytes.length)throw Error('BUILD_HASH_MISMATCH: '+row.path);
    if(!internal&&isPrivateRepositoryPath(row.path))throw Error('BUILD_PRIVATE_INPUT');
  }
  if(m.buildId!==sha256(JSON.stringify({target,inputSha256:m.inputSha256,files:m.files})))throw Error('BUILD_ID_MISMATCH');
  if(sha256(fs.readFileSync(path.join(out,'index.html')))!==sha256(fs.readFileSync(path.join(out,'championship.html'))))throw Error('BUILD_ENTRY_MISMATCH');
  assertPagesModuleClosure({root:out,files,entries:m.moduleEntries,importMap:m.importMap});
  if(!internal){
    const audit=auditWebBuild(root);
    if(!audit.technical.ok||!audit.release.ok||m.inputSha256!==sha256(fs.readFileSync(path.join(root,BUILD_INPUT_PATH))))throw Error('PUBLIC_RELEASE_NOT_APPROVED');
    if(JSON.stringify([...audit.input.files,'index.html','.nojekyll'].sort())!==JSON.stringify(m.files.map(r=>r.path).sort()))throw Error('PUBLIC_INPUT_LIST_MISMATCH');
    for(const row of m.files.filter(r=>!['index.html','.nojekyll',ART_INDEX_PATH].includes(r.path))){
      if(row.sha256!==sha256(fs.readFileSync(checkedInput(root,row.path))))throw Error('PUBLIC_SOURCE_CHANGED: '+row.path);
    }
    const index=JSON.parse(fs.readFileSync(path.join(out,ART_INDEX_PATH),'utf8'));
    if(JSON.stringify(index)!==JSON.stringify(publicArtIndex(audit.index)))throw Error('PUBLIC_INDEX_NOT_APPROVED');
  }
  return m;
}
