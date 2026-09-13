// SHOP_REVERSE_SPEC_v1.md:139-144; SHOP_REVERSE_CATALOG_118.csv:1-12.
// Display binding only. Record order 0,1,2,3 maps to item indices 0,1,3,2.
//
// The four care goods share the existing toolbar cells. Other goods use the
// separately registered complete-cell selections during local art review.
// Each bundle keeps its own runtime scope and production-index validation.
import manifest from '../../../assets/production/toolbar/licensed-runtime-v1/manifest.json' with {type:'json'};
import productionIndex from '../../../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import {getShopRecord} from '../shop/shopCatalog.js';
import {assembledShopArt} from './assembledUiArt.js';

const goods = Object.freeze([
  {itemIndex:0, name:'飼料', icon:'feed'},
  {itemIndex:1, name:'蛋白質', icon:'protein'},
  {itemIndex:3, name:'傷藥', icon:'woundMedicine'},
  {itemIndex:2, name:'藥品', icon:'medicine'}
].map(Object.freeze));

export function shopGoodsPresentation(shopRecordIndex, baseUrl) {
  if (!Number.isSafeInteger(shopRecordIndex)) return null;
  const complete = assembledShopArt(shopRecordIndex, baseUrl);
  if (complete && complete.category !== 'CAGES') return Object.freeze({
    ...complete, name:null, icon:complete.subcategory.toLowerCase(), backgroundPosition:'center',
    identityEvidence:'VERIFIED_BINARY', imageEvidence:'OWNER_AUTHORIZED_LOCAL_REFERENCE'
  });
  const binding = goods[shopRecordIndex];
  if (!binding) return null;
  const record = getShopRecord(shopRecordIndex);
  if (record.category !== 'TRAINING_GOODS' || record.itemIndex !== binding.itemIndex) return null;
  const enabled = manifest.runtimeEligible === true && productionIndex.entries.some(entry =>
    entry.assetId === manifest.assetId && entry.runtimeEligible === true);
  // A shop row shows an item at rest, so it takes the rest pose, not the lit
  // one the rail uses for the tool currently in hand.
  const cell = manifest.cells.find(entry => entry.role === `${binding.icon}-rest`);
  return Object.freeze({name:binding.name, icon:binding.icon, itemIndex:binding.itemIndex,
    src:enabled && cell ? cell.src : null,
    backgroundPosition:'center',
    identityEvidence:'VERIFIED_BINARY', imageEvidence:manifest.productionStatus});
}
