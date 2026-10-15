import { FRIENDS_PLAYTEST_POLICY, isLateMedalPreview } from './friendsPlaytestPolicy.js';
import { battlePartyCondition } from '../battle/battleParty.js';
import {TITLE_EVENT_SCAN_LIMIT,titleEventAt,tamerRankRequiredFor} from '../battle/titleEventSchedule.js';
export function medalCollection(battleBadges = [], policy = null) {
  const won = new Set(Array.isArray(battleBadges) ? battleBadges : []);
  return Object.freeze(Array.from({length:TITLE_EVENT_SCAN_LIMIT},(_,titleId)=> {
    const event = titleEventAt(titleId);
    const earned = won.has(titleId);
    const testPreview = !earned && policy?.enabled === true && policy.lateMedalPreview && isLateMedalPreview(event, battlePartyCondition(event.field0C));
    return Object.freeze({titleId,acquired:earned || testPreview,earned,testPreview,previewPolicy:testPreview ? FRIENDS_PLAYTEST_POLICY.grantId : null,event,
      requiredRank:event ? tamerRankRequiredFor(event.unlockThreshold) : null,
      conditionEvidence:event?.scannedByGame ? 'ROM_VERIFIED_TITLE_WIN' : 'UNKNOWN_REQUIRES_TRACE'});
  }));
}
