import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';
import acceptedManifest from '../../../assets/production/public-runtime/hunt-accepted.map.v1.json' with {type:'json'};
import rebuiltManifest from '../../../assets/production/public-runtime/hunt-hm01x2.map.v1.json' with {type:'json'};
import threeFallbackManifest from '../../../assets/production/public-runtime/hunt-three-fallback.map.v1.json' with {type:'json'};
// Read-only projections for the continuous mobile Hunt screen.
// Daytime field thumbnails are previews, never the original field_image_icon.
import { validateRuntimeMapArtBundle } from './runtimeMapArtBundle.js';
import {nativeHuntAnalyzedFields,nativeHuntRadarMask,nativeHuntRadarMatches} from '../hunt/loadout/nativeHuntPluginRules.js';
import {SPECIES_NAMES_ZH} from '../text/catalogs.zhHant.js';

const threeFallbackArt = validateRuntimeMapArtBundle(threeFallbackManifest);
const acceptedArt = validateRuntimeMapArtBundle(acceptedManifest);
// HM01 is the rebuilt whole-map hunt (2026-10-21); its Gate preview is a packaged 1440 px thumbnail.
const rebuiltArt = validateRuntimeMapArtBundle(rebuiltManifest);

export function huntGateThumbnail(gate,location=globalThis.location) {
  if(!isOriginalRuntimeLocation(location))return null;
  const dayFieldId = gate?.originalFields?.dayFieldId;
  const field = [rebuiltArt, threeFallbackArt, acceptedArt].map((art) => art.fields.find((entry) => entry.fieldId === dayFieldId)).find(Boolean);
  return field ? { src: (field.thumbnail ?? field.frames[0]).src, fieldId: field.fieldId,
    evidence: 'PRODUCTION_DAY_FIELD_PREVIEW' } : null;
}

export function huntTargetReadout(runtime, capabilities) {
  const target = runtime.getWildCreatures().find((wild) => wild.wildId === runtime.getSelectedWildId());
  if (!target) return null;
  const hpAllowed = capabilities?.analyzerFields?.includes('HP');
  return {
    selected: true,
    // No species identity or hidden stat leaks through the display seam.
    hp: hpAllowed && Number.isFinite(target.maxHp) ? String(target.maxHp) : '???',
    hpEvidence: hpAllowed ? target.hpEvidence : 'PLUGIN_GATED',
    generation: '???', family: '???', alignment: '???', personality: '???', capacity: '???',
    ...nativeHuntAnalyzedFields(target,capabilities?.analyzerFields),
    name:capabilities?.analyzerFields?.length?SPECIES_NAMES_ZH[target.speciesIndex]??'野生夥伴':'???'
  };
}

export function huntPluginReadout(runtime,capabilities={}){
  const state=runtime.getToolState?.(),mask=nativeHuntRadarMask(capabilities.nativeRadarIndices);
  return {
    counters:(state?.tools??[]).filter(t=>capabilities.itemCounters?.includes(t.id)).map(t=>({id:t.id,quantity:t.quantity})),
    memory:capabilities.memoryReadout&&state?{usedG:state.usedG,maxG:state.maxG}:null,
    radar:capabilities.radar?runtime.getWildCreatures().filter(a=>Number.isInteger(a.speciesIndex)&&nativeHuntRadarMatches(a.speciesIndex,mask))
      .slice(0,24).map(a=>({wildId:a.wildId,x:a.worldX/runtime.world.worldWidthPx,y:a.worldY/runtime.world.worldHeightPx})):null
  };
}
