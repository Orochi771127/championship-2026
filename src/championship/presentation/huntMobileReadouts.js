// Read-only projections for the continuous mobile Hunt screen.
// Daytime field thumbnails are previews, never the original field_image_icon.
import manifest from '../../../assets/production/hunt/licensed-runtime-v1/manifest.json' with { type: 'json' };
import { validateRuntimeMapArtBundle } from './runtimeMapArtBundle.js';
import {nativeHuntAnalyzedFields,nativeHuntRadarMask,nativeHuntRadarMatches} from '../hunt/loadout/nativeHuntPluginRules.js';
import {SPECIES_NAMES_ZH} from '../text/catalogs.zhHant.js';

const art = validateRuntimeMapArtBundle(manifest);

export function huntGateThumbnail(gate) {
  const field = art.fields.find((entry) => entry.fieldId === gate?.originalFields?.dayFieldId);
  return field ? { src: field.frames[0].src, fieldId: field.fieldId,
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
    name:capabilities?.analyzerFields?.length?SPECIES_NAMES_ZH[target.speciesIndex]??'野生數碼獸':'???'
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
