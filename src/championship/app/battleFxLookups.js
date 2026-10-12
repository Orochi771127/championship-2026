// Dynamic battle presentation -- the look-ups the Pixi layer needs from the
// battle catalogs and the text layer (OWNER_APPROVED_ADAPTATION 2026-10-12).
//
// The presentation never imports the battle lane; the application hands it
// these functions. Everything returned is display data.
//
// MOVE NAMES (Owner 2026-10-12): only an approved name is ever shown. The 30
// learnable special skills (records 1..30) keep their names in zhHant.js; the
// 565 species moves use the approved five-language table in battleMoveNames.js.
// A record with no approved name falls back to 技能／絕招 with the character's
// name. Local acceptance (?battleFxDebug on loopback) appends the stable ID.
import {getBattleCatalogRecord, listMoveRecordsForSpecies} from '../battle/battleCatalogs.js';
import {describeBattleFxMove} from '../presentation/battleFx/battleFxRecipes.js';
import {battleMoveName} from '../text/battleMoveNames.js';
import {specialSkillName} from '../text/zhHant.js';
import {uiText} from '../text/uiText.js';

/** The approved display name of a move record, or null when none is approved. */
export function battleFxApprovedMoveName(moveId) {
  if (Number.isSafeInteger(moveId) && moveId >= 1 && moveId <= 30) return specialSkillName(moveId) ?? null;
  return battleMoveName(moveId);
}

export function createBattleFxLookups({getView, onFeed = null, showIds = false}) {
  const looks = new Map();
  function describeMove(slot, moveId) {
    if (!Number.isSafeInteger(moveId)) return null;
    if (!looks.has(moveId)) {
      let look = null;
      try {
        const move = getBattleCatalogRecord('moves', moveId);
        look = describeBattleFxMove(move, listMoveRecordsForSpecies(move.speciesId));
      } catch { look = null; }
      looks.set(moveId, look);
    }
    return looks.get(moveId);
  }
  const nameOfSlot = slot => getView()?.combatants?.[slot]?.displayName ?? '';
  /** Callout title: the approved name, the skill ID in local acceptance, else ''. */
  function moveNameOf(moveId) {
    const name = battleFxApprovedMoveName(moveId);
    if (!showIds) return name ?? '';
    return name ? `${name} #${moveId}` : `#${moveId}`;
  }
  return Object.freeze({
    describeMove,
    nameOfSlot,
    moveNameOf,
    text: value => uiText(value),
    onEvent(event) {
      if (typeof onFeed !== 'function') return;
      if (event.type === 'LAUNCH') {
        const look = describeMove(event.slot, event.moveId);
        if (!look || look.tier === 'basic') return;
        const move = moveNameOf(event.moveId), ultimate = look.tier === 'ultimate';
        const template = move ? (ultimate ? '{name}發動絕招「{move}」！' : '{name}使出「{move}」！')
          : (ultimate ? '{name}發動絕招！' : '{name}使出技能！');
        onFeed(uiText(template, {name: nameOfSlot(event.slot), move}));
      } else if (event.type === 'KO') {
        onFeed(uiText('{name}倒下了！', {name: nameOfSlot(event.slot)}));
      }
    }
  });
}
