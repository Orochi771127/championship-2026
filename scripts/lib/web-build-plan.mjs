import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {auditPagesModuleClosure} from './pages-module-closure.mjs';
import {isPrivateRepositoryPath,isShippingArtEntry} from './public-art-boundary.mjs';

export const BUILD_INPUT_PATH='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json';
export const ART_INDEX_PATH='assets/production/ART_PRODUCTION_INDEX.json';
export const RIGHTS_PATH='docs/legal/RIGHTS_EVIDENCE_REGISTRY.json';
export const PLAYTEST_PATH='src/data/championship/public-playtest.r1.json';
export const SOURCE_PAYLOAD=/\.(?:nds|srl|nxr|ncer|ncgr|nclr|nanr|nscr|nbs|nbsr|atr|datr|col|esc|opm|opmd|nsbmd|nsbtx|nsbca|nsbta|nsbma|nsbva|bsar|ram|dst)$/i;
export const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function permittedCopyPath(file){
  return safeInputPath(file) && !SOURCE_PAYLOAD.test(file)
    && (file==='championship.html'||file.startsWith('src/championship/')||file.startsWith('src/data/championship/')
      ||file.startsWith('assets/production/')||/^docs\/contracts\/championship\/[^/]+\.json$/.test(file)
      ||/^node_modules\/(?:pixi\.js\/dist\/pixi\.mjs|three\/(?:build\/three\.(?:module|core)\.js|examples\/jsm\/(?:loaders\/GLTFLoader|utils\/(?:BufferGeometryUtils|SkeletonUtils))\.js))$/.test(file));
}
export function safeInputPath(file){
  return typeof file==='string' && file.length>0 && !/[\\:\0?#]/.test(file)
    && !file.startsWith('/') && file.split('/').every(p=>p&&p!=='.'&&p!=='..');
}
export function checkedInput(root,file){
  if(!safeInputPath(file)||SOURCE_PAYLOAD.test(file))throw new Error(`UNSAFE_BUILD_INPUT: ${file}`);
  const base=fs.realpathSync(root),absolute=path.resolve(base,file);
  if(!fs.existsSync(absolute))throw new Error(`BUILD_INPUT_MISSING: ${file}`);
  const real=fs.realpathSync(absolute),relative=path.relative(base,real);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.statSync(real).isFile())throw new Error(`BUILD_INPUT_OUTSIDE_ROOT: ${file}`);
  return real;
}
export function readBuildInputs(root){
  const input=JSON.parse(fs.readFileSync(checkedInput(root,BUILD_INPUT_PATH),'utf8'));
  if(input.schemaVersion!==1||!Array.isArray(input.files)||new Set(input.files).size!==input.files.length
    ||!Array.isArray(input.moduleEntries)||!input.moduleEntries.includes('src/championship/app/main.js')
    ||!input.files.includes('championship.html')||!input.files.includes(ART_INDEX_PATH)
    ||input.files.some(f=>!permittedCopyPath(f))||!input.release||typeof input.importMap!=='object')throw new Error('INVALID_WEB_BUILD_INPUTS');
  return input;
}
function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
export function auditReleaseRights({registry,evidenceIds,platform,territories,asOf}){
  const issues=[];
  if(!validDate(asOf)||!Array.isArray(evidenceIds)||!evidenceIds.length||!Array.isArray(territories)||!territories.length||!platform)
    return [{kind:'RELEASE_SCOPE_OR_RIGHTS_NOT_DECLARED'}];
  for(const evidenceId of evidenceIds){
    const matches=registry?.entries?.filter(e=>e.evidenceId===evidenceId)??[];
    const e=matches.length===1?matches[0]:null,d=e?.document,s=e?.scope;
    if(!e||d?.status!=='VERIFIED'||!/^([a-f0-9]{64})$/i.test(d?.sha256??'')
      ||!d.privateVaultReference||!d.verifiedBy||!validDate(d.verifiedOn)||d.verifiedOn>asOf
      ||e.decisions?.shippingPermitted!==true||!s?.platforms?.includes(platform)
      ||!territories.every(t=>s.territories?.includes(t))
      ||!validDate(e.authorizationRecordedOn)||e.authorizationRecordedOn>asOf
      ||(e.expiresOn!=null&&(!validDate(e.expiresOn)||e.expiresOn<asOf)))issues.push({kind:'RIGHTS_NOT_VERIFIED_FOR_RELEASE',evidenceId});
  }
  return issues;
}
export function auditWebBuild(root,{asOf=new Date().toISOString().slice(0,10)}={}){
  const input=readBuildInputs(root),technicalIssues=[];
  for(const file of input.files){try{checkedInput(root,file);}catch(error){technicalIssues.push({kind:'INVALID_INPUT',file,reason:error.message});}}
  const closure=technicalIssues.length?{visited:[],issues:[]}:auditPagesModuleClosure({root,files:input.files,entries:input.moduleEntries,importMap:input.importMap});
  technicalIssues.push(...closure.issues);
  const available=new Set(input.files);
  // CSS and HTML resources are not ESM dependencies. Check them independently.
  for(const file of input.files.filter(f=>/\.(?:css|html)$/.test(f))){
    if(!fs.existsSync(path.join(root,file)))continue;
    const source=fs.readFileSync(path.join(root,file),'utf8');
    const matches=file.endsWith('.css')?[...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)]:[...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)];
    for(const [,url] of matches){
      if(/^(?:data:|https?:|#)/.test(url))continue;
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),url.split(/[?#]/)[0]));
      if(!available.has(target))technicalIssues.push({kind:'EXCLUDED_STATIC_RESOURCE',file,target});
    }
  }
  const index=JSON.parse(fs.readFileSync(checkedInput(root,ART_INDEX_PATH),'utf8'));
  const registry=JSON.parse(fs.readFileSync(checkedInput(root,RIGHTS_PATH),'utf8'));
  const releaseIssues=auditReleaseRights({registry,...input.release,asOf});
  for(const file of input.files){if(isPrivateRepositoryPath(file))releaseIssues.push({kind:'PRIVATE_INPUT_NOT_DISTRIBUTABLE',file});}
  // Every copied asset must belong to an explicitly approved bundle. The
  // actual file list is checked, not merely a filtered registration index.
  const approvals=index.entries.filter(isShippingArtEntry);
  for(const file of input.files.filter(f=>f.startsWith('assets/production/')&&f!==ART_INDEX_PATH)){
    const owners=approvals.filter(e=>e.releaseFiles?.some(r=>r.path===file));
    if(owners.length!==1){releaseIssues.push({kind:'ASSET_FILE_NOT_APPROVED',file});continue;}
    const entry=owners[0],row=entry.releaseFiles.find(r=>r.path===file);
    if(!/^[a-f0-9]{64}$/i.test(row.sha256??'')||row.sha256.toLowerCase()!==sha256(fs.readFileSync(checkedInput(root,file))))releaseIssues.push({kind:'ASSET_APPROVAL_HASH_MISMATCH',file});
    releaseIssues.push(...auditReleaseRights({registry,evidenceIds:entry.rightsEvidenceIds,platform:input.release.platform,territories:input.release.territories,asOf}));
  }
  return {input,technical:{ok:technicalIssues.length===0,issues:technicalIssues,moduleCount:closure.visited.length},
    release:{ok:releaseIssues.length===0,issues:releaseIssues},index};
}

// Public playtest permission is a distinct, explicit Owner decision. Keep the
// verified-rights release gate above intact; never fabricate licence evidence.
export function auditOwnerPlaytest(root,audit){
  const issues=[],approval=audit.input.publicPlaytest;
  let policy;
  try{policy=JSON.parse(fs.readFileSync(checkedInput(root,PLAYTEST_PATH),'utf8'));}
  catch{return {ok:false,issues:[{kind:'PUBLIC_PLAYTEST_POLICY_MISSING'}]};}
  if(policy.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'||approval?.policyId!==policy.id
    ||policy.origin!=='https://orochi771127.github.io'||policy.basePath!=='/championship-2026/'
    ||policy.rightsDocumentVerified!==false||policy.commercialReleaseAccepted!==false
    ||!Array.isArray(approval?.files)||!audit.input.files.includes(PLAYTEST_PATH)){
    return {ok:false,issues:[{kind:'PUBLIC_PLAYTEST_NOT_AUTHORIZED'}]};
  }
  const approved=new Map(approval.files.map(row=>[row.path,row.sha256]));
  if(approved.size!==approval.files.length||approved.size!==audit.input.files.length)issues.push({kind:'PLAYTEST_APPROVED_FILE_LIST_MISMATCH'});
  for(const file of audit.input.files){
    const hash=approved.get(file);
    if(!/^[a-f0-9]{64}$/.test(hash??''))issues.push({kind:'PLAYTEST_FILE_NOT_APPROVED',file});
    else if(hash!==sha256(fs.readFileSync(checkedInput(root,file))))issues.push({kind:'PLAYTEST_APPROVED_BYTES_CHANGED',file});
  }
  return {ok:issues.length===0,issues,policy};
}
