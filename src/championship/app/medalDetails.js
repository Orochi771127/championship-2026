// Read-only presentation projection. No save, inventory, admission or reward writes.
// Acquisition/rank/date remain owned by medalCollection + titleEventSchedule.
// Conditions: battlePartyCondition / nativeBattleQualification, ARM9 02092380 / 02092244.
// Fees/prizes: battleMatchSelection's traced +24/+20 accessors, NOT unconditional credit.
// Direct unlocks: canonical Shop BATTLE_BADGE_ID_0_BASED rows and Gate kind 2 rows.
// Audited against original_medals_61_evidence.json and runtime-integration-audit.md,
// 2026-10-14, source b01ed619375641f5578b2bc65883ebfa32ad8914. Research never imports here.
// The adapter does not prove original UI pixels, equipped titles, or full rank-branch coverage.
import { TITLE_EVENT_SCAN_LIMIT } from '../battle/titleEventSchedule.js';
import { getMatchRecord, matchEntryFee, matchPayout } from '../battle/battleMatchSelection.js';
import { battlePartyCondition } from '../battle/battleParty.js';
import { listShopRecords, SHOP_UNLOCK_KINDS } from '../shop/shopCatalog.js';
import { listChampionshipGates } from '../gate/gateCatalog.js';
import { shopItemName, gateName, generationName, personalityName, rosterFamilyName } from '../text/zhHant.js';
import { formatList, formatNumber } from '../text/locale.js';
import { uiText } from '../text/uiText.js';
import { medalDetailText as text, medalDetailTerm } from '../text/medalDetailText.js';
import { deepFreeze } from '../contracts/championshipContracts.js';

function conditionText(condition) {
  const parts = [];
  if (condition.family !== 0) {
    // species+18 uses a bit mask: bit 0 Beast, 1 Machine, 2 Insect/Plant,
    // 3 Bird, 4 Dragon, 5 Aquatic, 6 Holy, 7 Dark. A match is OR, not AND.
    const families = Array.from({ length: 8 }, (_, bit) => condition.family & (1 << bit) ? rosterFamilyName(bit + 1) : null).filter(Boolean);
    parts.push(condition.family & ~255 ? text('unknown') : text('family', { names: formatList(families) }));
  }
  if (condition.generation !== 7) parts.push(generationName(condition.generation) ? text('generation', { value: generationName(condition.generation) }) : text('unknown'));
  if (condition.attribute !== 0) parts.push(medalDetailTerm('attributes', condition.attribute) ? text('attribute', { value: medalDetailTerm('attributes', condition.attribute) }) : text('unknown'));
  if (condition.minimum03c !== 0) parts.push(text('rebirth', { count: formatNumber(condition.minimum03c) }));
  if (condition.minimum010 !== 0) parts.push(text('capacity', { count: formatNumber(condition.minimum010) }));
  if (condition.individual018 !== -1) parts.push(personalityName(condition.individual018) ? text('personality', { value: personalityName(condition.individual018) }) : text('unknown'));
  if (condition.species014 !== 0) parts.push(text(({ 5: 'plantType', 6: 'mamemonType' })[condition.species014] ?? 'unknown'));
  if (condition.field14 !== 0) parts.push(text(({ 1: 'originDigital', 2: 'originPendulum' })[condition.field14] ?? 'unknown'));
  return parts.length ? parts.join('\n') : text('unrestricted');
}

/** Uses the active display locale without changing it. Invalid/tutorial IDs return null. */
export function describeMedalDetails(titleId) {
  if (!Number.isInteger(titleId) || titleId < 0 || titleId >= TITLE_EVENT_SCAN_LIMIT) return null;
  const match = getMatchRecord(titleId);
  const condition = battlePartyCondition(match.field0C);
  const shopUnlocks = listShopRecords()
    .filter(record => record.unlockKind === SHOP_UNLOCK_KINDS.BATTLE_BADGE_ID_0_BASED && record.unlockParameter === titleId)
    .map(record => ({ shopRecordIndex: record.shopRecordIndex, name: shopItemName(record.shopRecordIndex, record.displayName), category: record.category, unitPriceBits: record.unitPriceBits, purchaseDomain: record.purchaseDomain, unlockEvidence: record.unlockEvidence }));
  const gateUnlocks = listChampionshipGates()
    .filter(gate => gate.unlockKind === 2 && gate.unlockParameter === titleId)
    .sort((a, b) => a.romRecordIndex - b.romRecordIndex)
    .map(gate => ({ gateId: gate.gateId, recordIndex: gate.romRecordIndex, name: gateName(gate.romRecordIndex, gate.originalName), entranceFeeBits: gate.entranceFeeBits, unlockEvidence: gate.unlockEvidence }));
  const entryFeeBits = matchEntryFee(titleId), victoryPrizeBits = matchPayout(titleId);
  const fact = (key, value) => ({ key, label: text(key), value });
  const restrictions = [
    fact('teamSize', text('slots', { count: formatNumber(condition.slots) })),
    fact('participation', conditionText(condition))
  ];
  // Match the non-random branches of drawNativeTitleBattleArena: the caller
  // pins condition -1 to arena 9 (OVL10 02112E50..02112F58), even though the
  // default qualification object has field10=-1. Never draw RNG for a detail.
  // A fixed arena is a field choice, not an extra species qualification.
  const fixedArenaIndex = match.field0C === -1 ? 9 : condition.field10 === -1 ? null : condition.field10;
  if (fixedArenaIndex !== null) restrictions.push(fact('arena', fixedArenaIndex === 9 ? uiText('STADIUM') : medalDetailTerm('arenas', fixedArenaIndex) ?? text('unknown')));
  restrictions.push(fact('entryFee', text('bits', { value: formatNumber(entryFeeBits) })));
  const functions = [];
  if (shopUnlocks.length) functions.push(text('shop', { names: formatList(shopUnlocks.map(row => row.name)) }));
  if (gateUnlocks.length) functions.push(text('gate', { names: formatList(gateUnlocks.map(row => row.name)) }));
  if (!functions.length) functions.push(text('noDirectUnlock'));
  const unlocks = [
    fact('victoryPrize', text('bits', { value: formatNumber(victoryPrizeBits) })),
    fact('functions', functions.join('\n'))
  ];
  return deepFreeze({
    titleId, conditionIndex: match.field0C, condition, fixedArenaIndex, entryFeeBits, victoryPrizeBits,
    shopUnlocks, gateUnlocks, restrictions, unlocks, facts: [...restrictions, ...unlocks],
    notes: [text('ageHealth'), text('collection'), text('noEquipment'), text('prizeNote')]
  });
}

export const medalDetails = describeMedalDetails;
