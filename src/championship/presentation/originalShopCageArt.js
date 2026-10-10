// Owner 2026-10-09: final shop thumbnails in local play only.
// Shop/catalog IDs remain canonical; these are display bindings, not cage fields.
import manifest from '../../../assets/production/cage/shop-final-20261008/manifest.json' with {type:'json'};
import index from '../../../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import {getShopRecord} from '../shop/shopCatalog.js';
import {getCageDefinitionByShopRecord} from '../cage/cageCatalog.js';
import {getOriginalCageVisualBinding} from './originalCageVisualBindings.js';
import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';

export function validateOriginalShopCageArt(candidate, productionIndex = index) {
  const fail = reason => { throw new Error('ORIGINAL_SHOP_CAGE_ART_INVALID:'+reason); };
  const entry = productionIndex?.entries?.find(row => row.assetId === candidate?.assetId);
  if(candidate?.assetId !== 'art:cage:shop-final:20261008' || candidate.localOnly !== true
    || candidate.runtimeScope !== 'LOOPBACK_ONLY' || candidate.runtimeEligible !== true
    || candidate.publicReleasePermitted !== false || !entry?.runtimeEligible || entry.localOnly !== true
    || entry.publicReleasePermitted !== false) fail('LOCAL_REGISTRATION');
  if(!Array.isArray(candidate.records) || candidate.records.length !== 35) fail('COUNT');
  const seen = new Set();
  for(const art of candidate.records) {
    if(!Number.isSafeInteger(art.shopRecordIndex) || art.shopRecordIndex < 83 || art.shopRecordIndex > 117
      || seen.has(art.shopRecordIndex)) fail('SHOP_ID');
    seen.add(art.shopRecordIndex);
    const record = getShopRecord(art.shopRecordIndex), definition = getCageDefinitionByShopRecord(art.shopRecordIndex);
    if(record.category !== 'CAGES' || art.category !== record.category || art.subcategory !== record.subcategory
      || art.itemIndex !== record.itemIndex || art.cageDefinitionIndex !== definition?.cageDefinitionIndex
      || art.moduleId !== definition?.moduleId || art.fieldId !== getOriginalCageVisualBinding(art.cageDefinitionIndex)?.fieldId) fail('IDENTITY');
    if(art.src !== 'assets/production/cage/shop-final-20261008/thumbnails/shop-'+String(art.shopRecordIndex).padStart(3,'0')
      +'_item-'+String(art.itemIndex).padStart(2,'0')+'_'+art.fieldId+'.png'
      || !/^[a-f0-9]{64}$/.test(art.sha256)) fail('SOURCE');
    if(art.width !== 256 || art.height !== 192 || art.density !== 4
      || JSON.stringify(art.logicalOrigin) !== '[32,23]' || JSON.stringify(art.rasterOrigin) !== '[128,92]'
      || JSON.stringify(art.legacyCanvas) !== '[64,48]' || art.sourceFrame !== 0
      || art.sourceCrop !== null || art.alphaPreserved !== true) fail('RASTER_CONTRACT');
  }
  return candidate;
}
const checked = validateOriginalShopCageArt(manifest);
export function originalShopCageThumbnail(shopRecordIndex, baseUrl) {
  if(!isOriginalRuntimeLocation(baseUrl) || !Number.isSafeInteger(shopRecordIndex)) return null;
  return checked.records.find(row => row.shopRecordIndex === shopRecordIndex) ?? null;
}
