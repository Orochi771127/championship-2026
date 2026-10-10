// Uses the existing Owner playtest authority; private review query routes stay local.
import policy from '../../data/championship/public-playtest.r1.json' with {type:'json'};
export const ACCEPTED_ORIGINAL_SELECTION_ID='ACCEPTED_ORIGINAL_RUNTIME_20261010';
function locationUrl(value){
 try{
  if(typeof value==='string'||value instanceof URL)return new URL(value);
  if(value?.href)return new URL(value.href);
  if(value?.protocol&&(value.host||value.hostname)&&typeof value.pathname==='string')
   return new URL(`${value.protocol}//${value.host??value.hostname}${value.pathname}${value.search??''}`);
 }catch{/* Invalid destinations cannot enter the public selection. */}
 return null;
}
export function isOriginalLoopbackLocation(value=globalThis.location){
 const url=locationUrl(value),protocol=url?.protocol??value?.protocol,hostname=url?.hostname??value?.hostname;
 return (protocol===undefined||['http:','https:'].includes(protocol))&&['localhost','127.0.0.1','[::1]','::1'].includes(hostname);
}
export function isApprovedOriginalPublicLocation(value=globalThis.location){
 const url=locationUrl(value),selection=policy.acceptedOriginalRuntime;
 return Boolean(url&&!url.username&&!url.password&&policy.status==='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'
  &&selection?.status==='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'&&selection.selectionId===ACCEPTED_ORIGINAL_SELECTION_ID
  &&url.origin===policy.origin&&url.pathname.startsWith(policy.basePath));
}
export function isOriginalRuntimeLocation(value=globalThis.location){
 return isOriginalLoopbackLocation(value)||isApprovedOriginalPublicLocation(value);
}
