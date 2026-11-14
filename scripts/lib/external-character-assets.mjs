import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {CHARACTER_ASSET_PREFIX,validateCharacterAssetDelivery} from '../../src/championship/presentation/characterAssetDelivery.js';

export const EXTERNAL_CHARACTER_CONTRACT='docs/contracts/championship/EXTERNAL_CHARACTER_ASSETS.v1.json';
export const EXTERNAL_CHARACTER_FILES='docs/contracts/championship/EXTERNAL_CHARACTER_ASSET_FILES.v1.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const safe=file=>typeof file==='string'&&/^[A-Za-z0-9_.\/-]+$/.test(file)&&file.split('/').every(part=>part&&part!=='.'&&part!=='..');
const sameSet=(a,b)=>a.length===b.length&&JSON.stringify([...a].sort())===JSON.stringify([...b].sort());

function checkedFile(root,file){
 if(!safe(file))throw Error('EXTERNAL_CHARACTER_UNSAFE_PATH:'+file);
 const base=fs.realpathSync(root),absolute=path.join(base,file);
 if(!fs.existsSync(absolute))throw Error('EXTERNAL_CHARACTER_FILE_MISSING:'+file);
 const real=fs.realpathSync(absolute);
 if(real!==absolute||!fs.statSync(real).isFile())throw Error('EXTERNAL_CHARACTER_FILE_LINK:'+file);
 return real;
}

/** The public host receipt describes exact, already selected runtime bytes. */
export function parseCharacterAssetManifest(bytes){
 let manifest;try{manifest=JSON.parse(bytes);}catch{throw Error('EXTERNAL_CHARACTER_MANIFEST_JSON');}
 if(!exactKeys(manifest,['schemaVersion','sourceRepository','sourceCommit','assetPrefix','files','totalBytes','fileCount','generatedAt'])
  ||manifest.schemaVersion!==1||manifest.sourceRepository!=='Orochi771127/championship-2026'
  ||!/^[a-f0-9]{40}$/.test(manifest.sourceCommit??'')||manifest.assetPrefix!==CHARACTER_ASSET_PREFIX
  ||!Array.isArray(manifest.files)||manifest.files.length===0||manifest.fileCount!==manifest.files.length)
  throw Error('EXTERNAL_CHARACTER_MANIFEST_SCHEMA');
 const seen=new Set();let total=0;
 for(const row of manifest.files){
  if(!exactKeys(row,['path','sha256','bytes'])||!safe(row.path)||!row.path.startsWith(CHARACTER_ASSET_PREFIX)
   ||!/^.+\.(?:json|png|webp|jpe?g|gif|svg)$/.test(row.path)||seen.has(row.path)
   ||!/^[a-f0-9]{64}$/.test(row.sha256??'')||!Number.isSafeInteger(row.bytes)||row.bytes<0)
   throw Error('EXTERNAL_CHARACTER_MANIFEST_FILE:'+row?.path);
  seen.add(row.path);total+=row.bytes;
 }
 if(!Number.isSafeInteger(total)||manifest.totalBytes!==total)throw Error('EXTERNAL_CHARACTER_MANIFEST_SIZE');
 return manifest;
}

/** Read only when the caller explicitly requests the external-character build. */
export function readExternalCharacterRelease(root,sourcePlan){
 const contract=JSON.parse(fs.readFileSync(checkedFile(root,EXTERNAL_CHARACTER_CONTRACT),'utf8'));
 if(!exactKeys(contract,['schemaVersion','status','assetBaseUrl','manifestPath','manifestSha256','localPaths'])
  ||contract.schemaVersion!==1||contract.status!=='VERIFIED'||contract.manifestPath!==EXTERNAL_CHARACTER_FILES
  ||!/^[a-f0-9]{64}$/.test(contract.manifestSha256??''))throw Error('EXTERNAL_CHARACTER_RELEASE_NOT_VERIFIED');
 const runtime=validateCharacterAssetDelivery({schemaVersion:1,assetPrefix:CHARACTER_ASSET_PREFIX,assetBaseUrl:contract.assetBaseUrl,
  ...(contract.localPaths!==undefined?{localPaths:contract.localPaths}:{})});
 const manifestBytes=fs.readFileSync(checkedFile(root,contract.manifestPath));
 if(sha(manifestBytes)!==contract.manifestSha256)throw Error('EXTERNAL_CHARACTER_MANIFEST_HASH');
 const manifest=parseCharacterAssetManifest(manifestBytes);
 if(!runtime.assetBaseUrl.endsWith('/'+manifest.sourceCommit+'/'))throw Error('EXTERNAL_CHARACTER_VERSION_MISMATCH');
 const selected=new Map(sourcePlan.allowlist.files.map(row=>[row.path,row]));
 const local=new Set(runtime.localPaths??[]),hosted=new Set(manifest.files.map(row=>row.path));
 for(const file of local){
  if(!sourcePlan.files.includes(file)||!selected.has(file)||hosted.has(file))throw Error('EXTERNAL_CHARACTER_LOCAL_CLOSURE:'+file);
  if(sha(fs.readFileSync(checkedFile(root,file)))!==selected.get(file).sha256)throw Error('EXTERNAL_CHARACTER_LOCAL_HASH:'+file);
 }
 const expected=sourcePlan.files.filter(file=>file.startsWith(CHARACTER_ASSET_PREFIX)&&!local.has(file));
 if(!sameSet(expected,manifest.files.map(row=>row.path)))throw Error('EXTERNAL_CHARACTER_SELECTION_CLOSURE');
 for(const row of manifest.files){
  if(selected.get(row.path)?.sha256!==row.sha256)throw Error('EXTERNAL_CHARACTER_SELECTION_HASH:'+row.path);
  const bytes=fs.readFileSync(checkedFile(root,row.path));
  if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('EXTERNAL_CHARACTER_SOURCE_HASH:'+row.path);
 }
 const receipt={schemaVersion:1,assetPrefix:CHARACTER_ASSET_PREFIX,assetBaseUrl:runtime.assetBaseUrl,
  sourceCommit:manifest.sourceCommit,manifestUrl:new URL('runtime-manifest.json',runtime.assetBaseUrl).href,
  manifestSha256:contract.manifestSha256,fileCount:manifest.fileCount,totalBytes:manifest.totalBytes,
  ...(runtime.localPaths?{localPaths:runtime.localPaths}:{})};
 return {runtime,receipt,files:manifest.files,manifestBytes};
}

/** Partition only after the complete source selection has passed its existing audit. */
export function externalCharacterPublicationPlan(plan,release){
 if(!release)return plan;
 const external=new Map(release.files.map(row=>[row.path,row])),selected=new Map(plan.allowlist.files.map(row=>[row.path,row]));
 const local=new Set(release.receipt.localPaths??[]);
 for(const file of local)if(!plan.files.includes(file)||!selected.has(file)||external.has(file))throw Error('EXTERNAL_CHARACTER_LOCAL_CLOSURE:'+file);
 const expected=plan.files.filter(file=>file.startsWith(CHARACTER_ASSET_PREFIX)&&!local.has(file));
 if(external.size!==release.files.length||!sameSet(expected,[...external.keys()]))throw Error('EXTERNAL_CHARACTER_PARTITION_CLOSURE');
 for(const row of external.values())if(selected.get(row.path)?.sha256!==row.sha256)throw Error('EXTERNAL_CHARACTER_PARTITION_HASH:'+row.path);
 const files=plan.files.filter(file=>!external.has(file));
 return {...plan,files,externalCharacterAssets:release.receipt,externalCharacterFiles:release.files};
}

export function assertExternalCharacterPartition(plan,actualFiles){
 if(!plan.externalCharacterAssets){
  if(plan.externalCharacterFiles?.length)throw Error('EXTERNAL_CHARACTER_RECEIPT_REQUIRED');
  return;
 }
 const rows=plan.externalCharacterFiles??[],external=new Map(rows.map(row=>[row.path,row]));
 const localPaths=plan.externalCharacterAssets.localPaths??[];
 validateCharacterAssetDelivery({schemaVersion:1,assetPrefix:CHARACTER_ASSET_PREFIX,assetBaseUrl:plan.externalCharacterAssets.assetBaseUrl,localPaths});
 const local=new Set(localPaths);
 for(const file of local)if(!plan.allowlist.files.some(row=>row.path===file)||external.has(file)||!actualFiles.includes(file))throw Error('EXTERNAL_CHARACTER_LOCAL_CLOSURE:'+file);
 const approved=plan.allowlist.files.filter(row=>row.path.startsWith(CHARACTER_ASSET_PREFIX)&&!local.has(row.path));
 if(external.size!==rows.length||!sameSet(approved.map(row=>row.path),[...external.keys()])
  ||rows.length!==plan.externalCharacterAssets.fileCount||rows.reduce((n,row)=>n+row.bytes,0)!==plan.externalCharacterAssets.totalBytes)
  throw Error('EXTERNAL_CHARACTER_PARTITION_CLOSURE');
 for(const row of approved)if(external.get(row.path)?.sha256!==row.sha256)throw Error('EXTERNAL_CHARACTER_PARTITION_HASH:'+row.path);
 if(actualFiles.some(file=>file.startsWith(CHARACTER_ASSET_PREFIX)&&!local.has(file)))throw Error('EXTERNAL_CHARACTER_STILL_IN_GAME_ARTIFACT');
}

/** Validate a version directory before upload: exact file set, bytes and receipt. */
export function validateCharacterAssetSnapshot(root,{expectedManifestSha256,assertBytes,allowlist}={}){
 const manifestBytes=fs.readFileSync(checkedFile(root,'runtime-manifest.json'));
 if(expectedManifestSha256&&sha(manifestBytes)!==expectedManifestSha256)throw Error('EXTERNAL_CHARACTER_MANIFEST_HASH');
 const manifest=parseCharacterAssetManifest(manifestBytes),files=[];
 const visit=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const absolute=path.join(dir,entry.name);
  if(entry.isSymbolicLink())throw Error('EXTERNAL_CHARACTER_FILE_LINK');
  if(entry.isDirectory())visit(absolute);else if(entry.isFile())files.push(path.relative(root,absolute).replaceAll('\\','/'));
  else throw Error('EXTERNAL_CHARACTER_NON_FILE');
 }};visit(root);
 if(!sameSet(files,['runtime-manifest.json',...manifest.files.map(row=>row.path)]))throw Error('EXTERNAL_CHARACTER_SNAPSHOT_FILE_SET');
 const approved=allowlist?new Map(allowlist.files.map(row=>[row.path,row])):null;
 if(approved&&!sameSet([...approved.keys()].filter(file=>file.startsWith(CHARACTER_ASSET_PREFIX)),manifest.files.map(row=>row.path)))
  throw Error('EXTERNAL_CHARACTER_SELECTION_CLOSURE');
 for(const row of manifest.files){
  const bytes=fs.readFileSync(checkedFile(root,row.path));
  if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('EXTERNAL_CHARACTER_SNAPSHOT_HASH:'+row.path);
  if(approved&&approved.get(row.path)?.sha256!==row.sha256)throw Error('EXTERNAL_CHARACTER_SELECTION_HASH:'+row.path);
  assertBytes?.(row.path,bytes,{jsonFields:approved?.get(row.path)?.jsonFields});
 }
 return {manifestSha256:sha(manifestBytes),fileCount:manifest.fileCount,totalBytes:manifest.totalBytes,sourceCommit:manifest.sourceCommit};
}
