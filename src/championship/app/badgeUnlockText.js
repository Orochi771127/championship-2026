// Owner 2026-11-04: what winning a title opens -- hunt grounds, shop cages, tools -- as one
// localized line for the badge sheet, or null. Read from the gate and shop tables
// (rankUnlocks.js); main.js passes it to the import-free medal screen.
import {uiText} from '../text/uiText.js';
import {gateName,shopItemName} from '../text/zhHant.js';
import {badgeUnlocks} from './rankUnlocks.js';

export function badgeUnlockText(titleId) {
  const unlocks=badgeUnlocks(titleId),parts=[];
  for(const index of unlocks.gates)parts.push(uiText('狩獵場「{name}」',{name:gateName(index)}));
  // A badge opens only a few rows, so each is named: cages first, then the tools and plug-ins.
  const cages=new Set(unlocks.shop.cages);
  for(const index of unlocks.shop.cages)parts.push(uiText('商店籠舍「{name}」',{name:shopItemName(index)}));
  for(const index of unlocks.shopRecords)if(!cages.has(index))parts.push(uiText('商店「{name}」',{name:shopItemName(index)}));
  return parts.length?parts.join('・'):null;
}
