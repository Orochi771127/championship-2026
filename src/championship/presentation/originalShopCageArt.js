// Accepted original thumbnails retain their exact images and catalog bindings.
// Source intake, review flags and local paths stay in the build-only authority.
import manifest from '../../../assets/production/public-runtime/shop-cage-thumbnails.v1.json' with {type:'json'};
import {publicRuntimeAsset} from './publicRuntimeAssets.js';
import {getShopRecord} from '../shop/shopCatalog.js';
import {getCageDefinitionByShopRecord} from '../cage/cageCatalog.js';
import {getOriginalCageVisualBinding} from './originalCageVisualBindings.js';
import {isOriginalRuntimeLocation} from './originalRuntimeLocation.js';

const manifestId='art:shop:cage-thumbnails:v1';
const manifestPath='assets/production/public-runtime/shop-cage-thumbnails.v1.json';
const fields=['shopRecordIndex','itemIndex','cageDefinitionIndex','moduleId','fieldId','src','width','height','sha256','category','subcategory','logicalOrigin','density'];
export function validateOriginalShopCageArt(candidate, selection = publicRuntimeAsset) {
  const fail = reason => { throw new Error('ORIGINAL_SHOP_CAGE_ART_INVALID:'+reason); };
  if(candidate?.schemaVersion!==1||Object.keys(candidate).some(key=>!['schemaVersion','records'].includes(key)))fail('SCHEMA');
  const entry = typeof selection==='function' ? selection(manifestId) : null;
  if(entry?.src!==manifestPath||!/^[a-f0-9]{64}$/.test(entry.sha256))fail('PUBLIC_REGISTRATION');
  if(!Array.isArray(candidate.records) || candidate.records.length !== 35) fail('COUNT');
  const seen = new Set();
  for(const art of candidate.records) {
    if(!art||Object.keys(art).length!==fields.length||Object.keys(art).some(key=>!fields.includes(key))
      || !Number.isSafeInteger(art.shopRecordIndex) || art.shopRecordIndex < 83 || art.shopRecordIndex > 117
      || seen.has(art.shopRecordIndex)) fail('SHOP_ID');
    seen.add(art.shopRecordIndex);
    const record = getShopRecord(art.shopRecordIndex), definition = getCageDefinitionByShopRecord(art.shopRecordIndex);
    if(record.category !== 'CAGES' || art.category !== record.category || art.subcategory !== record.subcategory
      || art.itemIndex !== record.itemIndex || art.cageDefinitionIndex !== definition?.cageDefinitionIndex
      || art.moduleId !== definition?.moduleId || art.fieldId !== getOriginalCageVisualBinding(art.cageDefinitionIndex)?.fieldId) fail('IDENTITY');
    const selected=selection(`art:shop:cage:${art.shopRecordIndex}`);
    if(art.src !== 'assets/production/cage/shop-final-20261008/thumbnails/shop-'+String(art.shopRecordIndex).padStart(3,'0')
      +'_item-'+String(art.itemIndex).padStart(2,'0')+'_'+art.fieldId+'.png'
      || !/^[a-f0-9]{64}$/.test(art.sha256)||selected?.src!==art.src||selected.sha256!==art.sha256
      ||selected.width!==art.width||selected.height!==art.height) fail('SOURCE');
    if(art.width !== 256 || art.height !== 192 || art.density !== 4
      || JSON.stringify(art.logicalOrigin) !== '[32,23]') fail('RASTER_CONTRACT');
  }
  return candidate;
}
const checked = validateOriginalShopCageArt(manifest);
export function originalShopCageThumbnail(shopRecordIndex, baseUrl) {
  if(!isOriginalRuntimeLocation(baseUrl) || !Number.isSafeInteger(shopRecordIndex)) return null;
  return checked.records.find(row => row.shopRecordIndex === shopRecordIndex) ?? null;
}
