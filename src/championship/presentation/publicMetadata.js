import {publicRuntimeAsset} from './publicRuntimeAssets.js';
import {validateRuntimeMapArtBundle} from './runtimeMapArtBundle.js';
export const PUBLIC_METADATA_ROLES=['battle-original','battle-baseline','cage-foreground-cm03','cage-foreground-cm24','arena-harbor','arena-interactions','arena-tournament','vfx-runtime','vfx-visibility','vfx-material'];
const roots={HUNT_DEPTH:['schemaVersion','renderType','pieces'],CAGE_FOREGROUND:['schemaVersion','renderType','fieldId','width','height','pixelScale','nativeOrigin','objects'],VFX_VISIBILITY:['schemaVersion','renderType','kind','animationName','frameCount','nodeCount','nodeNames','frames'],VFX_MATERIAL:['schemaVersion','renderType','kind','animationName','frameCount','tracks'],VFX_RUNTIME:['schemaVersion','renderType','assetId','family','tickerPolicy','gateEarthMounted','systems'],ARENA_INTERACTIONS:['schemaVersion','renderType','id','props','ice','harborPatches'],ARENA_HARBOR:['schemaVersion','renderType','id','kind','layoutSignature','decodedBytes','actorFloorOffsets','pylonLampHeightPx','waterFxRect','waterWaveAlpha','causticsAlpha','crowdCount','world','layout','ground','props','mechanisms','bridge','waves','caustics','shoreDecor','dynamicProps','crowdFrames','foregroundBanks'],ARENA_TOURNAMENT:['schemaVersion','renderType','id','kind','layoutSignature','decodedBytes','crowdCount','frameDurationMs','world','projection','ground','foreground','props','dynamicProps','crowd','pennants','waves']};
const privateKey=/^(?:localOnly|reviewOnly|rights|rightsStatus|shippingReady|runtimeEligible|humanApproved|source|sourceArchive|sourceLibraryId|masterSha256|sourceComposite|provenance|ownerDirection|weights|customNodes|externalAssets)$/i;
export function validatePublicMetadata(value){
 if(value?.kind==='MAP_ART_RENDER_V1')return validateRuntimeMapArtBundle(value);
 const allowed=roots[value?.renderType];if(!allowed||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('PUBLIC_METADATA_SCHEMA');
 const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(privateKey.test(k))throw Error('PUBLIC_METADATA_PRIVATE_FIELD:'+k);visit(x);}else if(typeof v==='string'&&/libfile_|Sentinel_|file:\/\/|[A-Za-z]:[\\/](?:Users|Projects|Private)/i.test(v))throw Error('PUBLIC_METADATA_PRIVATE_VALUE');};visit(value);return value;
}
export function publicMetadataPath(role){const row=publicRuntimeAsset(`art:public:metadata:${role}:v1`);if(!row)throw Error('PUBLIC_METADATA_SELECTION:'+role);return row.src;}
export async function fetchPublicMetadataResponse(url,baseHref,{fetchImpl=globalThis.fetch,signal}={}){
 const base=baseHref??globalThis.location?.href??'http://localhost/',absolute=new URL(url,base);
 const selected=PUBLIC_METADATA_ROLES.map(role=>publicRuntimeAsset(`art:public:metadata:${role}:v1`)).find(row=>row&&new URL(row.src,base).href===absolute.href);
 if(!selected){const loc=new URL(base);if(!['localhost','127.0.0.1','[::1]'].includes(loc.hostname)||!loc.searchParams.has('battleReview'))throw Error('PRIVATE_METADATA_NOT_PUBLIC_RUNTIME');return fetchImpl(absolute,{signal});}
 const response=await fetchImpl(absolute,{signal});if(!response.ok)return response;const text=await response.text();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));if(Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')!==selected.sha256)throw Error('PUBLIC_METADATA_HASH');
 const value=validatePublicMetadata(JSON.parse(text));return {ok:true,status:response.status,json:async()=>value};
}
export async function loadPublicMetadata(role,{fetchImpl=globalThis.fetch,signal,baseHref}={}){const response=await fetchPublicMetadataResponse(publicMetadataPath(role),baseHref,{fetchImpl,signal});if(!response.ok)throw Error('PUBLIC_METADATA_HTTP_'+response.status);return response.json();}
