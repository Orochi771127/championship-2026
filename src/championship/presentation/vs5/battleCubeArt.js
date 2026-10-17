import manifest from "../../../../assets/production/battle/menu-cube-v1/public-manifest.json" with { type: "json" };
import {publicRuntimeAsset} from '../publicRuntimeAssets.js';

export const BATTLE_CUBE_ART_ID = "art:battle-select:menu-cube:v1";
export const BATTLE_CUBE_ART_MANIFEST = manifest;

export function resolveBattleCubeArt(pack = manifest, index = null) {
  const canonical=publicRuntimeAsset(BATTLE_CUBE_ART_ID);
  const selected = index===null?canonical:index.assets?.find(row=>row.id===BATTLE_CUBE_ART_ID);
  const legacy = index?.entries?.find(row=>row.assetId===BATTLE_CUBE_ART_ID);
  const registered=(selected&&canonical&&selected.src===canonical.src&&selected.sha256===canonical.sha256)
    || (legacy?.runtimeEligible===true&&legacy.manifestPath==='assets/production/battle/menu-cube-v1/manifest.json');
  if(!registered||pack.assetId!==BATTLE_CUBE_ART_ID||pack.runtimeEligible===false)return [];
  if(selected&&(Object.keys(pack).some(key=>!['schemaVersion','assetId','faces'].includes(key))
    ||pack.faces?.some(row=>Object.keys(row).some(key=>!['id','label','texture','width','height','sha256','bytes'].includes(key)))))return [];
  if(selected&&JSON.stringify(pack.faces)!==JSON.stringify(manifest.faces))return [];
  const ids = ["CHAMPIONSHIP", "TITLE_MATCH", "FREE_BATTLE", "LINK_BATTLE"];
  if (pack.faces?.length !== 4 || new Set(pack.faces.map(row => row.id)).size !== 4) return [];
  if (pack.faces.some(row => !ids.includes(row.id) || row.width !== 512 || row.height !== 512
    || !/^assets\/production\/battle\/menu-cube-v1\/[a-z-]+\.png$/.test(row.texture))) return [];
  return pack.faces.map(row => Object.freeze({
    ...row, url: new URL(`../../../../${row.texture}`, import.meta.url).href
  }));
}
