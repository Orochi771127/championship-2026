import {CHARACTER_NATIVE_SIZING} from '../../data/championship/characterNativeSizing.js';
import {BATTLE_CHARACTER_GEOMETRY} from '../../data/championship/battleCharacterGeometry.js';
import {selectCharacterAppearance,createCharacterAppearanceGuard} from './characterAppearanceReplacement.js';
import {loadPixiCharacterRuntimeBundle} from './pixiCharacterRuntimeBundle.js';
import {isRegisteredAlternateEntity} from './alternateFormAssetContracts.js';
import {loadCharacterRosterCore} from './characterRosterCore.js';
export function getCharacterStaticNativeSizing(record, runtime, side = "main", acceptedOriginGeometry = null) {
  const sizing = CHARACTER_NATIVE_SIZING[record?.entityId];
  if (side !== "main" || !sizing
    || runtime?.sides?.main?.animations?.find((item) => item.id === 0)?.frames[0]?.texture !== sizing.texture
    || sizing.files.some(([name, hash]) => record.files?.find((file) => file.path === name)?.sha256?.toLowerCase() !== hash)) return null;
  return Object.freeze({ texture: sizing.texture,
    packedPixelsPerNativePixel: acceptedOriginGeometry?.sourcePixelScaleBySide?.main ?? sizing.packedPixelsPerNativePixel,
    evidence: "VERIFIED_STATIC_MAIN_FIRST_SOURCE_FRAME" });
}


export const LICENSED_CHARACTER_ASSET_ID="art:characters:licensed-internal:v1";
export const LICENSED_CHARACTER_MANIFEST="assets/production/internal-faithful-baseline/characters-v1/manifest.json";

// Retained private review registration. The public adapter uses its own
// closed render catalog and never manufactures these registration flags.
export async function loadLicensedCharacterRoster(options){
 const {sides=['main'],productionIndex,manifest}=options;
 if(!Array.isArray(sides)||!sides.length||sides.some(side=>!['main','sub'].includes(side)))throw new Error('CHARACTER_ROSTER_SIDES_INVALID');
 const entry=productionIndex?.entries?.find(candidate=>candidate.assetId===LICENSED_CHARACTER_ASSET_ID);
 if(entry?.runtimeEligible!==true||entry.manifestPath!==LICENSED_CHARACTER_MANIFEST
   ||entry.publicReleasePermitted!==false||manifest?.assetId!==entry.assetId
   ||manifest.runtimeEligible!==true||manifest.publicReleasePermitted!==false)
   throw Error('CHARACTER_ROSTER_NOT_REGISTERED_FOR_INTERNAL_RUNTIME');
 const {PIXI,manifestUrl,signal,appearanceReplacements=manifest.appearanceReplacements??[],
  baselineMotionContracts=manifest.motionContractHashes??{},baselineOriginGeometryContracts=manifest.originGeometryContractHashes??{},loadBundle=loadPixiCharacterRuntimeBundle}=options;
 const loadAppearanceBundle=async({entityId,record,initialSequenceIds,isDisposed})=>{
  const appearance=selectCharacterAppearance({entityId,descriptors:appearanceReplacements,record,productionIndex,
   baselineMotionContracts,baselineOriginGeometryContracts,manifestUrl,baselineManifestPath:LICENSED_CHARACTER_MANIFEST});
  if(!appearance||sides.length!==1||sides[0]!=='main')return null;
  const baselineRuntimeUrl=new URL(record.runtime,manifestUrl).href;let baselineLoaded=false;
  try{
   const baselineRuntime=await PIXI.Assets.load({src:baselineRuntimeUrl,parser:'json'});baselineLoaded=true;if(isDisposed())return null;
   const bundle=await loadBundle({PIXI,runtimeUrl:appearance.runtimeUrl,sides:['main'],cachePrefix:appearance.cachePrefix,signal,initialSequenceIds,
    replacementGuard:await createCharacterAppearanceGuard({entityId,record,baselineRuntime,originGeometry:appearance.originGeometry,
     geometryContractSha256:appearance.geometryContractSha256,expectedGeometryContractSha256:appearance.expectedGeometryContractSha256,
     motionContractSha256:appearance.manifest.motionContractSha256})});
   return {bundle,appearance:appearance.manifest};
  }finally{if(baselineLoaded)await Promise.allSettled([PIXI.Assets.unload?.(baselineRuntimeUrl)]);}
 };
 return loadCharacterRosterCore({...options,loadAppearanceBundle,nativeSizingResolver:getCharacterStaticNativeSizing,
  geometryResolver:({entityId,record,side,appearance})=>{
   const candidate=BATTLE_CHARACTER_GEOMETRY[entityId];return side==='main'&&!appearance&&candidate?.files.every(([name,hash])=>record.files.find(f=>f.path===name)?.sha256.toLowerCase()===hash)?candidate:null;
  },

  validateRecordRuntime:(record,entityId)=>record?.runtime===`${entityId}/runtime.json`
   &&(/^[em]\d{3}_[a-z0-9_]+$/.test(entityId)||isRegisteredAlternateEntity(entityId))});
}
