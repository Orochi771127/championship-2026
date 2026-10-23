import {publicRuntimeAsset} from './publicRuntimeAssets.js';
const roles=['cage-ui','cage-final','hunt-accepted','hunt-night','hunt-hm01x2','hunt-three-fallback'];
export function publicMapManifestPath(role){const row=publicRuntimeAsset(`art:public:map:${role}:v1`);if(!row)throw Error('PUBLIC_MAP_SELECTION_MISSING:'+role);return row.src;}
export async function fetchRuntimeMapResponse(url,baseUrl,{signal,fetchImpl=globalThis.fetch}={}){
 const absolute=new URL(url,baseUrl);const selected=roles.map(role=>publicRuntimeAsset(`art:public:map:${role}:v1`)).find(row=>row&&new URL(row.src,baseUrl).href===absolute.href);
 if(!selected){
  const base=new URL(baseUrl);const review=['industrialReview','caveReview','factoryShutters','huntReview','battleReview','cageReview'].some(key=>base.searchParams.has(key));
  if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||!review)throw Error('PRIVATE_MAP_METADATA_NOT_A_PUBLIC_RUNTIME_INPUT');
  return fetchImpl(absolute,{signal});
 }
 const response=await fetchImpl(absolute,{signal});if(!response.ok)return response;
 const text=await response.text(),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==selected.sha256)throw Error('PUBLIC_MAP_RUNTIME_HASH');
 return {ok:true,status:response.status,json:async()=>JSON.parse(text)};
}
