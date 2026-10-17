import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const BATTLE_PAGE_POLICY='docs/contracts/championship/PUBLIC_BATTLE_ATLAS_POLICY.v1.json';
export const BATTLE_PAGE_ENTITIES=Object.freeze(['m450_warumonzaemon','m503_warglaymon','m504_gigaseadramon','m521_heraklekabuterimon','m527_mugendramon','m529_metalgarurumon_va']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const nativeBattleContract=runtime=>({geometry:runtime.geometry,animations:Object.fromEntries(['main','sub'].map(side=>[side,runtime.sides[side].animations]))});
export function readBattlePagePolicy(root){
 const policy=JSON.parse(fs.readFileSync(path.join(root,BATTLE_PAGE_POLICY),'utf8'));
 if(policy.schemaVersion!==1||!['SHARED_EXISTING_MAIN_PAGES','INDEPENDENT_PACKS'].includes(policy.mode)
  ||JSON.stringify(policy.characters.map(row=>row.entityId).sort())!==JSON.stringify([...BATTLE_PAGE_ENTITIES].sort()))throw Error('PUBLIC_BATTLE_PAGE_POLICY');
 return policy;
}
function runtime(root,file,expected){
 if(!file.startsWith('assets/production/characters/')||file.includes('..')||file.includes('\\')||!/^[a-f0-9]{64}$/.test(expected))throw Error('PUBLIC_BATTLE_PAGE_PATH');
 const bytes=fs.readFileSync(path.join(root,file));if(sha(bytes)!==expected)throw Error('PUBLIC_BATTLE_PAGE_SOURCE_REVIEW_REQUIRED:'+file);
 return JSON.parse(bytes);
}
export function applyBattlePagePolicy(root,catalog,policy=readBattlePagePolicy(root)){
 const result=structuredClone(catalog);
 for(const row of policy.characters){
  const config=result.characters.find(value=>value.entityId===row.entityId);
  if(!config||config.runtimePath!==row.sharedRuntimePath||config.runtimeSha256!==row.sharedRuntimeSha256)throw Error('PUBLIC_BATTLE_PAGE_BINDING');
  const shared=runtime(root,row.sharedRuntimePath,row.sharedRuntimeSha256),packed=runtime(root,row.independentRuntimePath,row.independentRuntimeSha256);
  if(shared.kind!=='CHARACTER_RENDER_V1'||packed.kind!==shared.kind||shared.entityId!==row.entityId||packed.entityId!==row.entityId)throw Error('PUBLIC_BATTLE_PAGE_IDENTITY');
  const native=JSON.stringify(canonical(nativeBattleContract(shared)));
  if(native!==JSON.stringify(canonical(nativeBattleContract(packed)))||sha(native)!==row.nativeContractSha256)throw Error('PUBLIC_BATTLE_PAGE_NATIVE_CONTRACT');
  if(policy.mode==='SHARED_EXISTING_MAIN_PAGES'){delete config.battleRuntimePath;delete config.battleRuntimeSha256;}
  else{config.battleRuntimePath=row.independentRuntimePath;config.battleRuntimeSha256=row.independentRuntimeSha256;}
 }
 return result;
}
export function independentBattleFiles(root){
 const policy=readBattlePagePolicy(root);
 return policy.mode==='INDEPENDENT_PACKS'?policy.independentFiles:[];
}
