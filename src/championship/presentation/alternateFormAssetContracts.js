import catalog from '../../data/championship/alternate-form-assets.r1.json' with {type:'json'};
const ALLOWED=Object.freeze({211:['m528_metaletemon','m528_metaletemon'],222:['m540_imperialdramon_fm','m506_griffomon'],229:['oc_crownbrass_mandrill','m528_metaletemon'],230:['oc_celestyrant_battle_r10','m540_imperialdramon_fm']});
export function validateAlternateFormAsset(config){
 const expected=ALLOWED[config?.speciesIndex];
 if(!expected||config.entityId!==expected[0]||config.motionDonorEntityId!==expected[1]
  ||config.speciesId!==`species-${config.speciesIndex}`||config.density!==4
  ||config.assetRoot!=='assets/production/characters/alternate-forms-20261015/'
  ||!/^[-a-z0-9_]+$/.test(config.folder)
  ||!['sourceBankSha256','motionContractSha256','originGeometryContractSha256','runtimeSha256','baselineRuntimeSha256'].every(k=>/^[a-f0-9]{64}$/.test(config[k]??'')))
  throw Error('ALTERNATE_FORM_ASSET_CONTRACT_INVALID');
 if(config.runtimeReady===true&&!Object.entries({design:"APPROVED",motion:"PASS",technical:"PASS",geometry:"PASS",normalPath:"PASS"}).every(([key,value])=>config.qa?.[key]===value))throw Error("ALTERNATE_FORM_QA_REQUIRED");
 return config;
}
export const ALTERNATE_FORM_ASSET_CANDIDATES=Object.freeze(catalog.characters.map(validateAlternateFormAsset));
export const ACTIVE_ALTERNATE_FORM_ASSETS=Object.freeze(ALTERNATE_FORM_ASSET_CANDIDATES.filter(c=>c.runtimeReady===true));
export const alternateFormAsset=(entityId)=>ACTIVE_ALTERNATE_FORM_ASSETS.find(c=>c.entityId===entityId)??null;
export const isRegisteredAlternateEntity=(entityId)=>['oc_crownbrass_mandrill','oc_celestyrant_battle_r10'].includes(entityId)&&alternateFormAsset(entityId)!==null;
export function mergeAlternateFormConfigs(configs,active=ACTIVE_ALTERNATE_FORM_ASSETS){
 const replacements=new Map(active.map(c=>[validateAlternateFormAsset(c).entityId,c]));
 return [...configs.filter(c=>!replacements.has(c.entityId)),...replacements.values()];
}
export function rekeyAlternateDonorRuntime(runtime,config){
 validateAlternateFormAsset(config);
 if(runtime?.entityId!==config.motionDonorEntityId)throw Error('ALTERNATE_FORM_WRONG_DONOR');
 const result=structuredClone(runtime);result.entityId=config.entityId;
 for(const side of ['main','sub'])for(const animation of result.sides[side].animations)for(const frame of animation.frames){
  const prefix=config.motionDonorEntityId+'/';
  if(!frame.texture.startsWith(prefix))throw Error('ALTERNATE_FORM_DONOR_TEXTURE_MISMATCH');
  frame.texture=config.entityId+'/'+frame.texture.slice(prefix.length);
 }
 return result;
}
/** Clone immutable source evidence; product binding and donor are deliberately separate. */
export function bindAlternateFormManifest(manifest,active=ACTIVE_ALTERNATE_FORM_ASSETS){
 if(!active.length)return manifest;
 const records=new Map(manifest.records.map(r=>[r.entityId,r]));
 const replacements=new Map();
 for(const config of active){
  validateAlternateFormAsset(config);const donor=records.get(config.motionDonorEntityId);
  if(!donor)throw Error('ALTERNATE_FORM_DONOR_RECORD_MISSING');
  replacements.set(config.entityId,{...structuredClone(donor),entityId:config.entityId,runtime:config.entityId+'/runtime.json'});
 }
 const species=new Set(active.map(c=>c.speciesId));
 return {...manifest,appearanceReplacements:(manifest.appearanceReplacements??[]).filter(r=>!replacements.has(r.entityId)),records:[...manifest.records.filter(r=>!replacements.has(r.entityId)),...replacements.values()],
  speciesBindings:[...manifest.speciesBindings.filter(b=>!species.has(b.speciesId)),...active.map(c=>({speciesId:c.speciesId,entityId:c.entityId}))]};
}
