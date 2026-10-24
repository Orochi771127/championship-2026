// Finite review-only reuse of already-selected public 2D fallback roles.
// Do not resolve arbitrary roles, widen hosts, or alter the native field/catalog.
export function huntThreePublicFallbackRole(location=globalThis.location,fieldId=null){
  if(!location?.href)return null;
  const url=new URL(location.href);
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return null;
  const key=url.searchParams.get('huntThreeReview');
  if(key==='hm01'&&url.searchParams.get('huntReview')==='hm01x2-20261019'
    &&['field_hm01_01','field_hm01_02'].includes(fieldId))return 'hunt-hm01x2';
  if(key==='hm08'&&['field_hm08_01','field_hm08_02'].includes(fieldId))return 'hunt-accepted';
  return null;
}
