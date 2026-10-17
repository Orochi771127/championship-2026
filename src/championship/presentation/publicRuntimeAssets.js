import catalog from '../../../assets/production/PUBLIC_RUNTIME_INDEX.json' with {type:'json'};
const keys=['id','src','sha256','width','height'];
export function validatePublicRuntimeAssets(value){
  if(!value||value.schemaVersion!==1||!Array.isArray(value.assets)
    ||Object.keys(value).some(key=>!['schemaVersion','assets'].includes(key)))throw Error('PUBLIC_RUNTIME_INDEX_SCHEMA');
  const ids=new Set();
  for(const asset of value.assets){
    if(!asset||Object.keys(asset).some(key=>!keys.includes(key))||typeof asset.id!=='string'||!/^[a-z0-9][a-z0-9:._-]{1,159}$/i.test(asset.id)||/libfile_|Sentinel_/i.test(asset.id)||ids.has(asset.id)
      ||!/^assets\/production\/[A-Za-z0-9_.\/-]+$/.test(asset.src)||asset.src.split('/').some(part=>part==='..'||part==='.')
      ||/\/internal-[^/]+\//.test(asset.src)||/\.(?:nds|srl|ncer|ncgr|nclr|nanr|nsbmd|nsbtx|nsbca|ram|dst|psd|blend)$/i.test(asset.src)
      ||/\/(?:ART_PRODUCTION_INDEX|RIGHTS_EVIDENCE_REGISTRY)\.json$/.test(asset.src)||!/^[a-f0-9]{64}$/.test(asset.sha256)
      ||((asset.width!==undefined||asset.height!==undefined)&&![asset.width,asset.height].every(n=>Number.isInteger(n)&&n>0&&n<=32768)))throw Error('PUBLIC_RUNTIME_ASSET_INVALID');
    ids.add(asset.id);
  }
  return value;
}
const assets=new Map(validatePublicRuntimeAssets(catalog).assets.map(asset=>[asset.id,Object.freeze({...asset})]));
export function publicRuntimeAsset(id){return assets.get(id)??null;}
