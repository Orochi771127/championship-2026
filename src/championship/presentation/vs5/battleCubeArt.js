import manifest from "../../../../assets/production/battle/menu-cube-v1/manifest.json" with { type: "json" };
import productionIndex from "../../../../assets/production/ART_PRODUCTION_INDEX.json" with { type: "json" };

export const BATTLE_CUBE_ART_ID = "art:battle-select:menu-cube:v1";
export const BATTLE_CUBE_ART_MANIFEST = manifest;

export function resolveBattleCubeArt(pack = manifest, index = productionIndex) {
  const approved = index.entries?.find(row => row.assetId === BATTLE_CUBE_ART_ID);
  if (!approved?.runtimeEligible || approved.manifestPath !== "assets/production/battle/menu-cube-v1/manifest.json"
    || pack.assetId !== BATTLE_CUBE_ART_ID || pack.runtimeEligible !== true) return [];
  const ids = ["CHAMPIONSHIP", "TITLE_MATCH", "FREE_BATTLE", "LINK_BATTLE"];
  if (pack.faces?.length !== 4 || new Set(pack.faces.map(row => row.id)).size !== 4) return [];
  if (pack.faces.some(row => !ids.includes(row.id) || row.width !== 512 || row.height !== 512
    || !/^assets\/production\/battle\/menu-cube-v1\/[a-z-]+\.png$/.test(row.texture))) return [];
  return pack.faces.map(row => Object.freeze({
    ...row, url: new URL(`../../../../${row.texture}`, import.meta.url).href
  }));
}
