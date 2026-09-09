// SHOP_REVERSE_SPEC_v1.md:139-144; SHOP_REVERSE_CATALOG_118.csv:1-12.
// Display binding only. Record order 0,1,2,3 maps to item indices 0,1,3,2.
// Original-created toolbar illustrations are reused; no reference pixels load.
import manifest from '../../../assets/production/ui/tooling-pilot-r1/manifest.json' with {type:'json'};
import productionIndex from '../../../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import {getShopRecord} from '../shop/shopCatalog.js';

const goods = Object.freeze([
  {itemIndex:0, name:'飼料', icon:'feed'},
  {itemIndex:1, name:'蛋白質', icon:'protein'},
  {itemIndex:3, name:'傷藥', icon:'woundMedicine'},
  {itemIndex:2, name:'藥品', icon:'medicine'}
].map(Object.freeze));

export function shopGoodsPresentation(shopRecordIndex) {
  if (!Number.isSafeInteger(shopRecordIndex)) return null;
  const binding = goods[shopRecordIndex];
  if (!binding) return null;
  const record = getShopRecord(shopRecordIndex);
  if (record.category !== 'TRAINING_GOODS' || record.itemIndex !== binding.itemIndex) return null;
  const enabled = manifest.runtimeEligible === true && productionIndex.entries.some(entry =>
    entry.assetId === manifest.assetId && entry.runtimeEligible === true);
  const cell = manifest.iconAtlas.mapping.indexOf(binding.icon);
  return Object.freeze({name:binding.name, icon:binding.icon, itemIndex:binding.itemIndex,
    src:enabled && cell >= 0 ? manifest.iconAtlas.src : null,
    backgroundPosition:`${(cell % 3) * 50}% ${Math.floor(cell / 3) * 50}%`,
    identityEvidence:'VERIFIED_BINARY', imageEvidence:'ORIGINAL_CREATED'});
}
