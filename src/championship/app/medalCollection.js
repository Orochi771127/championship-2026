import {TITLE_EVENT_SCAN_LIMIT,titleEventAt,tamerRankRequiredFor} from '../battle/titleEventSchedule.js';
export function medalCollection(battleBadges = []) {
  const won = new Set(Array.isArray(battleBadges) ? battleBadges : []);
  return Object.freeze(Array.from({length:TITLE_EVENT_SCAN_LIMIT},(_,titleId)=> {
    const event = titleEventAt(titleId);
    return Object.freeze({titleId,acquired:won.has(titleId),event,
      requiredRank:event ? tamerRankRequiredFor(event.unlockThreshold) : null,
      conditionEvidence:event?.scannedByGame ? 'ROM_VERIFIED_TITLE_WIN' : 'UNKNOWN_REQUIRES_TRACE'});
  }));
}
