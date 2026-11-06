// Isolated QA descriptor adapter. No renderer, image loader, timer, or mutation of
// the game runtime. verifiedPins must originate from independently hashed bytes.
const SPECIES='species-218', ENTITY='m535_slayerdramon', STAGE=.396;
const HASH=/^[a-f0-9]{64}$/;
const finitePair=v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw Error(message);};
export function qaGate(url) {
 try {const u=new URL(url);return ['http:','https:'].includes(u.protocol)
  &&['localhost','127.0.0.1','[::1]'].includes(u.hostname)&&!u.username&&!u.password
  &&u.searchParams.getAll('animHandoff').length===1&&u.searchParams.get('animHandoff')==='1'
  &&u.searchParams.getAll('animGeneralCandidate').length===1&&u.searchParams.get('animGeneralCandidate')===SPECIES;
 }catch{return false;}
}
const closed=()=>Object.freeze({kind:'BASELINE_FALLBACK',reason:'QA_GATE_CLOSED',candidate:null});
export function createSnapshotQaAdapter({assembly,runtime,manifest,url,verifiedPins}={}) {
 // Default path must not inspect candidate data or trigger a candidate fetch.
 if(!qaGate(url))return Object.freeze({enabled:false,inspect:closed,getDrawSpec:closed});
 // Defensive copies keep later callers from changing the validated contract.
 assembly=structuredClone(assembly);runtime=structuredClone(runtime);manifest=structuredClone(manifest);
 if(manifest?.kind!=='SPECIES218_SNAPSHOT_QA_CALIBRATION_TRIAL'||manifest.schemaVersion!==1
  ||manifest.status!=='HOLD'||manifest.runtimeApproved!==false||manifest.speciesId!==SPECIES||manifest.entityId!==ENTITY
  ||assembly?.identity?.species_id!==218||assembly.identity.native_entity!==ENTITY||runtime?.entityId!==ENTITY)fail('IDENTITY_OR_HOLD_CONTRACT');
 for(const key of ['assemblySha256','runtimeSha256'])if(!HASH.test(verifiedPins?.[key])||manifest.sourcePins?.[key]!==verifiedPins[key])fail('SOURCE_HASH_MISMATCH');
 const assets=new Map(assembly.assets.map(a=>[a.path,a]));
 const candidates=new Map(assembly.candidate_records.map(c=>[c.representative,c]));
 const allowed=['m535_slayerdramon/main/cell_009','m535_slayerdramon/main/cell_011'];
 if(assembly.assets.length!==2||assembly.candidate_records.length!==2||candidates.size!==2||!allowed.every(key=>candidates.has(key))
  ||Object.keys(manifest.records??{}).length!==2||!allowed.every(key=>manifest.records?.[key]))fail('TWO_FRAME_DISCLOSURE_CONTRACT');
 const sequences=new Map();let events=0;
 for(const s of assembly.sequences){
  const [side,raw]=s.key.split(':');const id=Number(raw);
  const current=runtime.sides?.[side]?.animations.find(c=>c.id===id);
  if(!['main','sub'].includes(side)||!Number.isSafeInteger(id)||sequences.has(`${side}:${id}`)||!current||current.playbackMode!==s.mode_raw
   ||current.frames.length!==s.frames.length||!s.frames.every((f,i)=>f.ordinal===i&&f.native_texture===current.frames[i].texture
   &&f.ticks_raw===current.frames[i].ticks&&(f.candidate_record===null||candidates.has(f.candidate_record))))fail('EVENT_CONTRACT_MISMATCH');
  sequences.set(`${side}:${id}`,s);events+=s.frames.length;
 }
 if(sequences.size!==53||events!==87)fail('EVENT_COUNTS_MISMATCH');
 if(!manifest.records||Array.isArray(manifest.records)||typeof manifest.records!=='object')fail('INVALID_RECORDS');
 for(const [representative,r] of Object.entries(manifest.records)){
  const c=candidates.get(representative),a=assets.get(c?.asset_path);
  if(!c||!a||!r||!same(r.rect,c.rect_xywh)||r.assetPath!==c.asset_path||!HASH.test(r.fileSha256)||r.fileSha256!==a.sha256
   ||!HASH.test(r.cropRgbaSha256)||r.cropRgbaSha256!==c.crop_rgba_sha256)fail('ASSET_HASH_OR_BINDING_MISMATCH');
  if(!Array.isArray(r.rect)||r.rect.length!==4||!r.rect.every(Number.isSafeInteger)||r.rect.some((v,i)=>i<2?v<0:v<=0)
   ||r.rect[0]+r.rect[2]>a.size[0]||r.rect[1]+r.rect[3]>a.size[1]||!finitePair(r.origin)||!Number.isFinite(r.density)||r.density<=0
   ||r.stageScale!==STAGE||r.calibrationStatus!=='PROVISIONAL_VISUAL_LANDMARK_FIT')fail('INVALID_CALIBRATION_SHAPE_OR_STAGE');
 }
 const inspect=owner=>{
  if(owner?.speciesId!==SPECIES||owner.entityId!==ENTITY)fail('OWNER_IDENTITY_MISMATCH');
  const {side,sequenceId,frameIndex,elapsedQ12,active,flipBits}=owner;
  if(!['main','sub'].includes(side)||!Number.isSafeInteger(sequenceId)||!Number.isSafeInteger(frameIndex)||frameIndex<0
   ||!Number.isSafeInteger(elapsedQ12)||elapsedQ12<0||![0,1,false,true].includes(active)||!Number.isInteger(flipBits)||flipBits<0||flipBits>3)fail('OWNER_FRAME_REQUIRED');
  const sequence=sequences.get(`${side}:${sequenceId}`),event=sequence?.frames[frameIndex];if(!event)fail('OWNER_FRAME_REQUIRED');
  const common={speciesId:SPECIES,entityId:ENTITY,side,sequenceId,eventOrdinal:frameIndex,elapsedQ12,active:Number(active),flipBits,
   rawTicks:event.ticks_raw,rawMode:sequence.mode_raw,sourceTexture:event.native_texture,representative:event.candidate_record,
   timebase:'OWNER_SNAPSHOT_ONLY_NO_HZ_CONVERSION',effects:'SEPARATE_UNBOUND',runtimeApproved:false};
  const record=manifest.records[event.candidate_record];
  if(!record)return Object.freeze({...common,kind:'BASELINE_FALLBACK',reason:'CALIBRATION_NOT_AVAILABLE',candidate:null});
  const r=structuredClone(record),scale=STAGE/r.density;
  // Crop-local p -> ((p - origin) * sign) * stageScale/density. Stage applied once.
  const sx=(flipBits&1)?-scale:scale,sy=(flipBits&2)?-scale:scale;
  return Object.freeze({...common,kind:'QA_CANDIDATE_DESCRIPTOR',status:'HOLD',candidate:r,
   rect:[...r.rect],origin:[...r.origin],pixelScale:scale,assetPath:r.assetPath,
   localToStage:[sx,0,0,sy,-r.origin[0]*sx,-r.origin[1]*sy],stageScaleAppliedOnce:STAGE});
 };
 return Object.freeze({enabled:true,inspect,getDrawSpec:inspect});
}

// Recommended trust boundary: verify source bytes before parsing. cryptoProvider
// is Web Crypto; inject node:crypto.webcrypto in Node. No networking is performed.
export async function createVerifiedSnapshotQaAdapter({url,manifest,assemblyBytes,runtimeBytes,cryptoProvider=globalThis.crypto}){
 if(!qaGate(url))return createSnapshotQaAdapter({url});
 const hash=async bytes=>Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const verifiedPins={assemblySha256:await hash(assemblyBytes),runtimeSha256:await hash(runtimeBytes)};
 const decoder=new TextDecoder();
 return createSnapshotQaAdapter({url,manifest,verifiedPins,assembly:JSON.parse(decoder.decode(assemblyBytes)),runtime:JSON.parse(decoder.decode(runtimeBytes))});
}

// A rendering consumer must verify original encoded file bytes AND tightly packed
// crop RGBA bytes before drawing. Decoder/canvas color management is caller-owned.
export async function verifyCandidateBytes(drawSpec,{fileBytes,cropRgbaBytes,cryptoProvider=globalThis.crypto}){
 if(drawSpec?.kind!=='QA_CANDIDATE_DESCRIPTOR')throw Error('CANDIDATE_DESCRIPTOR_REQUIRED');
 const r=drawSpec.candidate;
 if(cropRgbaBytes?.byteLength!==r.rect[2]*r.rect[3]*4)throw Error('CROP_BYTE_LENGTH_MISMATCH');
 const hash=async bytes=>Array.from(new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(await hash(fileBytes)!==r.fileSha256||await hash(cropRgbaBytes)!==r.cropRgbaSha256)throw Error('ASSET_BYTES_HASH_MISMATCH');
 return true;
}
