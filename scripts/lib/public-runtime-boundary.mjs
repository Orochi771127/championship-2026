import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {auditPagesModuleClosure} from './pages-module-closure.mjs';
import {selectedShopCageProjection,SHOP_CAGE_PUBLIC} from './public-shop-cage-projection.mjs';
import {assertPublicRanchStreaming} from './public-ranch-streaming-boundary.mjs';
import {assertPagesPayloadSize} from './pages-payload-size.mjs';
import {assertPublicCharacterSelection} from './public-character-boundary.mjs';
import {projectPublicRenderSources,PUBLIC_RENDER_FIELDS} from './public-render-projection.mjs';
import {selectedMapProjections,PUBLIC_MAP_FIELDS} from './public-map-projection.mjs';
import {projectPublicMetadata} from './public-metadata-projection.mjs';
import {publicCleanMedia} from './public-clean-media.mjs';
import {publicProgramData} from './public-program-data.mjs';

export const PUBLIC_RUNTIME_INDEX_PATH='assets/production/PUBLIC_RUNTIME_INDEX.json';
export const PUBLIC_RUNTIME_ALLOWLIST_PATH='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';
const INTERNAL_INDEX='assets/production/ART_PRODUCTION_INDEX.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const safePath=value=>typeof value==='string'&&value.length>0&&!/[\\:\0?#]/.test(value)&&!value.startsWith('/')&&value.split('/').every(part=>part&&part!=='.'&&part!=='..');
const privateExtension=/\.(?:nds|srl|nxr|ncer|ncgr|nclr|nanr|nscr|nbs|nbsr|atr|datr|col|esc|opm|opmd|nsbmd|nsbtx|nsbca|nsbta|nsbma|nsbva|bsar|ram|dst|psd|blend|kra)$/i;
const selectedMedia=(file,hash,selection)=>/\.(?:png|webp|jpe?g|wav|mp3|mp4)$/i.test(file)
 &&selection?.get(file)===hash;
const privateKey=/^(?:localOnly|reviewOnly|qaOnly|runtimeEligible|shippingReady|humanApproved|assistantReviewed|runtimeQaPassed|productionStatus|shippingStatus|artifactMaturity|rightsStatus|rightsEvidenceIds|ownerReply(?:Id)?|ownerInstruction|ownerDirection|scopeQuestionId|commitPushPublishInstructionId|approval.*|library(?:File)?Id|library_file_id|source(?:Reference.*|Review.*|Master.*|Archive.*|BankSha256|BindingEvidence)|prompt.*|artDirection|designRevision|selectedGenerationVersion|review|provenance|localPackagingProvenance|privateVaultReference|evidence_record)$/i;
const privateValue=/(?:libfile_[a-z0-9]+|Sentinel_[a-f0-9]{32}\b|\bSentinel_[a-z0-9]+|\b[A-Za-z]:[\\/]+(?:Users|Projects|Workspace|Private|Temp)|YDIJ_PRIVATE_ROM_ART_PACK|ROM_COPYRIGHTED_REFERENCE|LOOPBACK_RESEARCH_ONLY|file:\/\/(?=[^\s\'"<>]*[a-z0-9]))/i;
const manifestFields=['schemaVersion','target','buildId','commit','inputSha256','entry','publicReleasePermitted','loopbackOnly','sourcePayloadIncluded','faithfulInternalVfxIncluded','romDerivedBattleCatalogsIncluded','ownerSelectedReferenceArtIncluded','staticModuleClosure','checked','moduleCount','moduleEntries','importMap','browserBundle','version','tool','toolVersion','startupModules','generatedFiles','release','approved','publicPlaytest','ownerApproved','policyId','rightsDocumentVerified','commercialReleaseAccepted','fullOriginalParityAccepted','fileCount','files','path','sha256','bytes','saveStorage'];

export function forbiddenPublicPath(file){
  return !safePath(file)||file===INTERNAL_INDEX||privateExtension.test(file)
    ||/(?:^|\/)(?:research|private|\.git|\.codex|\.claude|source-masters?)(?:\/|$)/i.test(file)
    ||/^tools\/authoring\//i.test(file)
    ||/^assets\/production\/internal-[^/]+\//i.test(file)
    ||/(?:APPROVED_HERO_LEDGER|ART_PRODUCTION_INDEX|RIGHTS_EVIDENCE_REGISTRY)\.json$/i.test(file);
}

// This is a new, closed runtime schema. Never spread/clone an authority-index row.
export function publicRuntimeIndex(allowlist,internalIndex={entries:[]},selectedOriginalFiles=new Map()){
  if(!exactKeys(allowlist,['schemaVersion','files','assets'])||allowlist.schemaVersion!==1
    ||!Array.isArray(allowlist.files)||!Array.isArray(allowlist.assets))throw Error('PUBLIC_ALLOWLIST_SCHEMA');
  const fileMap=new Map(),ids=new Set(),blockedIds=new Set(),blockedRoots=[];
  for(const entry of internalIndex.entries??[]){
    if(entry.localOnly===true||entry.reviewOnly===true||entry.rightsStatus==='ROM_COPYRIGHTED_REFERENCE'){
      blockedIds.add(entry.assetId);if(safePath(entry.manifestPath))blockedRoots.push(path.posix.dirname(entry.manifestPath)+'/');
    }
  }
  for(const row of allowlist.files){
    if(!exactKeys(row,['path','sha256','jsonFields'])||forbiddenPublicPath(row.path)&&!selectedMedia(row.path,row.sha256,selectedOriginalFiles)||(blockedRoots.some(root=>row.path.startsWith(root))&&selectedOriginalFiles.get(row.path)!==row.sha256)
      ||!/^[a-f0-9]{64}$/.test(row.sha256)||fileMap.has(row.path))throw Error('PUBLIC_ALLOWLIST_FILE: '+row?.path);
    if(row.jsonFields!==undefined&&(!Array.isArray(row.jsonFields)||new Set(row.jsonFields).size!==row.jsonFields.length
      ||row.jsonFields.some(key=>typeof key!=='string'||privateKey.test(key))))throw Error('PUBLIC_JSON_SCHEMA_INVALID: '+row.path);
    fileMap.set(row.path,row.sha256);
  }
  const assets=allowlist.assets.map(row=>{
    if(!exactKeys(row,['id','src','sha256','width','height'])||typeof row.id!=='string'||!/^[a-z0-9][a-z0-9:._-]{1,159}$/i.test(row.id)
      ||ids.has(row.id)||blockedIds.has(row.id)||privateValue.test(row.id)||!row.src?.startsWith('assets/production/')
      ||forbiddenPublicPath(row.src)||(blockedRoots.some(root=>row.src.startsWith(root))&&selectedOriginalFiles.get(row.src)!==row.sha256)||fileMap.get(row.src)!==row.sha256
      ||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('PUBLIC_ALLOWLIST_ASSET: '+row?.id);
    ids.add(row.id);
    const result={id:row.id,src:row.src,sha256:row.sha256};
    if(row.width!==undefined||row.height!==undefined){
      if(![row.width,row.height].every(n=>Number.isInteger(n)&&n>0&&n<=32768))throw Error('PUBLIC_ALLOWLIST_DIMENSIONS');
      result.width=row.width;result.height=row.height;
    }
    return result;
  });
  return {schemaVersion:1,assets};
}

export function assertPublicBytes(file,bytes,{jsonFields,generated=false,renderedMedia}={}){
  if(forbiddenPublicPath(file)&&!selectedMedia(file,sha(bytes),renderedMedia))throw Error('PUBLIC_PAYLOAD_FORBIDDEN_PATH: '+file);
  if(/\.(?:png|webp|jpe?g|gif|wav|mp3|mp4)$/i.test(file)){
    const data=Buffer.from(bytes);
    if(privateValue.test(data.toString('latin1')))throw Error('PUBLIC_MEDIA_PRIVATE_VALUE: '+file);
    if(file.endsWith('.png')&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
      for(let pos=8;pos+12<=data.length;){const size=data.readUInt32BE(pos),type=data.toString('ascii',pos+4,pos+8);
        if(pos+12+size>data.length)throw Error('PUBLIC_MEDIA_INVALID_PNG: '+file);
        if(['tEXt','iTXt','zTXt','eXIf'].includes(type))throw Error('PUBLIC_MEDIA_METADATA: '+file);
        pos+=12+size;
      }
    }
    if(file.endsWith('.webp')&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'){
      for(let pos=12;pos+8<=data.length;){const type=data.toString('ascii',pos,pos+4),size=data.readUInt32LE(pos+4);
        if(pos+8+size>data.length)throw Error('PUBLIC_MEDIA_INVALID_WEBP: '+file);
        if(['EXIF','XMP '].includes(type))throw Error('PUBLIC_MEDIA_METADATA: '+file);
        pos+=8+size+(size%2);
      }
    }
    if(/\.jpe?g$/i.test(file)&&data.includes(Buffer.from('Exif\0\0')))throw Error('PUBLIC_MEDIA_METADATA: '+file);
  }
  if(!/\.(?:json|js|mjs|css|html|svg|txt)$/i.test(file)&&!['.nojekyll'].includes(file))return;
  const text=Buffer.from(bytes).toString('utf8');
  if(privateValue.test(text)||text.includes(INTERNAL_INDEX))throw Error('PUBLIC_PAYLOAD_PRIVATE_VALUE: '+file);
  if(file.endsWith('.json')){
    if(!generated&&file!==PUBLIC_RUNTIME_INDEX_PATH&&!Array.isArray(jsonFields))throw Error('PUBLIC_JSON_SCHEMA_REQUIRED: '+file);
    let json;try{json=JSON.parse(text);}catch{throw Error('PUBLIC_PAYLOAD_INVALID_JSON: '+file);}
    const visit=value=>{if(Array.isArray(value)){value.forEach(visit);return;}
      if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){
        if(privateKey.test(key))throw Error('PUBLIC_PAYLOAD_PRIVATE_KEY: '+file+' / '+key);
        if(Array.isArray(jsonFields)&&!jsonFields.includes(key))throw Error('PUBLIC_PAYLOAD_UNSELECTED_JSON_FIELD: '+file+' / '+key);
        visit(item);
      }
      else if(typeof value==='string'&&privateValue.test(value))throw Error('PUBLIC_PAYLOAD_PRIVATE_VALUE: '+file);
    };visit(json);
  }
}

export function publicArtifactPlan({root,input,index}){
  if(input.schemaVersion!==2)throw Error('PUBLIC_MANIFEST_V2_REQUIRED_AUTHORING_INDEX_MUST_NOT_BE_A_PUBLIC_INPUT');
  const filename=path.join(root,PUBLIC_RUNTIME_ALLOWLIST_PATH);
  if(!fs.existsSync(filename))throw Error('PUBLIC_ALLOWLIST_REQUIRED');
  const allowlist=JSON.parse(fs.readFileSync(filename,'utf8'));
  const projection=selectedShopCageProjection({root,input,index});
  const render=input.files.includes('src/championship/presentation/publicRenderDescriptors.js')?projectPublicRenderSources({root,input,index}):{descriptors:[],media:new Map()};
  const maps=input.files.includes('src/championship/presentation/publicMapRequests.js')?selectedMapProjections({root,input}):{descriptors:[],files:new Map()};
  const metadata=input.files.includes('src/championship/presentation/publicMetadata.js')?projectPublicMetadata({root,input}):{descriptors:[],media:new Map()};
  const clean=input.files.some(file=>file.startsWith('assets/production/public-media-clean-20261017/'))?publicCleanMedia({root}):[];
  const program=input.authoring?.programRecipePath?publicProgramData({root}):[];
  const renderedMedia=new Map([...projection.files,...render.media,...maps.files,...metadata.media]);
  const runtime=publicRuntimeIndex(allowlist,index,renderedMedia),files=allowlist.files.map(row=>row.path),available=new Set(files);
  for(const descriptor of render.descriptors){
    const selected=allowlist.assets.find(row=>row.id===descriptor.id),file=path.join(root,descriptor.path);
    if(selected?.src!==descriptor.path||selected.sha256!==descriptor.sha256||!available.has(descriptor.path)
      ||!fs.existsSync(file)||!fs.readFileSync(file).equals(descriptor.bytes))throw Error('PUBLIC_RENDER_PROJECTION_DRIFT:'+descriptor.role);
    assertPublicBytes(descriptor.path,descriptor.bytes,{jsonFields:PUBLIC_RENDER_FIELDS});
  }
  for(const [file,hash] of render.media)if(allowlist.files.find(row=>row.path===file)?.sha256!==hash)throw Error('PUBLIC_RENDER_MEDIA_NOT_SELECTED:'+file);
  for(const descriptor of maps.descriptors){
    const selected=allowlist.assets.find(row=>row.id===descriptor.id),file=path.join(root,descriptor.path);
    if(selected?.src!==descriptor.path||selected.sha256!==descriptor.sha256||!available.has(descriptor.path)
      ||!fs.existsSync(file)||!fs.readFileSync(file).equals(descriptor.bytes))throw Error('PUBLIC_MAP_PROJECTION_DRIFT:'+descriptor.role);
    assertPublicBytes(descriptor.path,descriptor.bytes,{jsonFields:PUBLIC_MAP_FIELDS});
  }
  for(const [file,hash] of maps.files)if(allowlist.files.find(row=>row.path===file)?.sha256!==hash)throw Error('PUBLIC_MAP_MEDIA_NOT_SELECTED:'+file);
  for(const descriptor of metadata.descriptors){
    const selected=allowlist.assets.find(row=>row.id===descriptor.id),file=path.join(root,descriptor.path);
    if(selected?.src!==descriptor.path||selected.sha256!==descriptor.sha256||!available.has(descriptor.path)||!fs.existsSync(file)||!fs.readFileSync(file).equals(descriptor.bytes))throw Error('PUBLIC_METADATA_PROJECTION_DRIFT:'+descriptor.role);
    assertPublicBytes(descriptor.path,descriptor.bytes,{jsonFields:descriptor.jsonFields});
  }
  for(const row of clean)if(allowlist.files.find(file=>file.path===row.path)?.sha256!==row.sha256)throw Error('PUBLIC_CLEAN_MEDIA_SELECTION:'+row.path);
  for(const row of program){const selected=allowlist.files.find(file=>file.path===row.path);
    if(selected?.sha256!==row.sha256||JSON.stringify(selected.jsonFields)!==JSON.stringify(row.jsonFields))throw Error('PUBLIC_PROGRAM_SELECTION:'+row.path);
    assertPublicBytes(row.path,row.bytes,{jsonFields:row.jsonFields});
  }
  if(projection.manifest){
    const bytes=Buffer.from(JSON.stringify(projection.manifest,null,2)+'\n');
    if(!available.has(SHOP_CAGE_PUBLIC)||!fs.readFileSync(path.join(root,SHOP_CAGE_PUBLIC)).equals(bytes)
      ||allowlist.files.find(row=>row.path===SHOP_CAGE_PUBLIC)?.sha256!==sha(bytes)
      ||[...projection.files].some(([file,hash])=>allowlist.files.find(row=>row.path===file)?.sha256!==hash))throw Error('PUBLIC_SHOP_CAGE_PROJECTION_MISMATCH');
  }
  if(!available.has('championship.html')||!available.has(PUBLIC_RUNTIME_INDEX_PATH))throw Error('PUBLIC_ALLOWLIST_ENTRY_REQUIRED');
  for(const file of files)if(!input.files.includes(file))throw Error('PUBLIC_ALLOWLIST_OUTSIDE_BUILD_INPUTS: '+file);
  const expected=Buffer.from(JSON.stringify(runtime,null,2)+'\n');
  if(allowlist.files.find(row=>row.path===PUBLIC_RUNTIME_INDEX_PATH)?.sha256!==sha(expected))throw Error('PUBLIC_INDEX_SELECTION_MISMATCH');
  const moduleEntries=input.moduleEntries.filter(file=>available.has(file));
  if(!moduleEntries.includes('src/championship/app/main.js'))throw Error('PUBLIC_MODULE_ENTRY_REQUIRED');
  const closure=auditPagesModuleClosure({root,files,entries:moduleEntries,importMap:input.importMap});
  if(closure.issues.length)throw Error('PUBLIC_MODULE_CLOSURE_BLOCKED: '+JSON.stringify(closure.issues.slice(0,8)));
  assertPublicRanchStreaming({root,files,allowlist,assertBytes:assertPublicBytes});
  assertPublicCharacterSelection({root,files,allowlist,assertBytes:assertPublicBytes});
  return {files,moduleEntries,allowlist,runtime,indexBytes:expected,importMap:input.importMap,renderedMedia};
}

// Inspect the actual upload directory, independently of a new JSON's contents.
export function assertPublicArtifact({root,files,plan,manifestName='pages-build.json'}){
  const expected=new Set([...plan.files,...(plan.generatedFiles??[]),'index.html','.nojekyll',manifestName]);
  if(expected.size!==files.length||[...expected].some(file=>!files.includes(file)))throw Error('PUBLIC_PAYLOAD_FILE_SET');
  const actualSizes=[];
  for(const file of files){
    if(!expected.has(file))throw Error('PUBLIC_PAYLOAD_UNSELECTED_FILE: '+file);
    const selected=plan.allowlist.files.find(row=>row.path===file);
    const bytes=fs.readFileSync(path.join(root,file));actualSizes.push({path:file,bytes:bytes.length});assertPublicBytes(file,bytes,{jsonFields:file===manifestName?[...manifestFields,...Object.keys(plan.importMap??{})]:selected?.jsonFields,generated:file===manifestName,renderedMedia:plan.renderedMedia});
    if(selected&&file!=='championship.html'&&selected.sha256!==sha(bytes))throw Error('PUBLIC_PAYLOAD_SELECTION_HASH: '+file);
  }
  if(files.some(file=>file===INTERNAL_INDEX))throw Error('PUBLIC_AUTHORITY_INDEX_INCLUDED');
  if(!files.includes(PUBLIC_RUNTIME_INDEX_PATH))throw Error('PUBLIC_RUNTIME_INDEX_MISSING');
  if(!fs.readFileSync(path.join(root,PUBLIC_RUNTIME_INDEX_PATH)).equals(plan.indexBytes))throw Error('PUBLIC_RUNTIME_INDEX_CHANGED');
  assertPagesPayloadSize(actualSizes);
  return {checkedFiles:files.length,authorityIndexIncluded:false,allowlist:true};
}
