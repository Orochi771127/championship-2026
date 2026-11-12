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
import {resolveMoveVfx} from '../presentation/vfx/unifiedMoveVfxResolver.js';
import {battleMoveName} from '../text/battleMoveNames.js';
import {specialSkillName} from '../text/zhHant.js';
import {uiText} from '../text/uiText.js';

/** The approved display name of a move record, or null when none is approved. */
export function battleFxApprovedMoveName(moveId) {
  if (Number.isSafeInteger(moveId) && moveId >= 1 && moveId <= 30) return specialSkillName(moveId) ?? null;
  return battleMoveName(moveId);
}

/** Ordinary hits feed the record at most this often, so it keeps moving without flickering. */
export const BATTLE_FEED_HIT_INTERVAL_MS = 900;

export function createBattleFxLookups({getView, localTeam = () => 0, onFeed = null, onCutIn = null, onTally = null, showIds = false, now = () => globalThis.performance?.now?.() ?? Date.now()}) {
  const looks = new Map();
  let lastSkillFeedAt = -Infinity, lastHitFeedAt = -Infinity;
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
  // The one effect-element authority (VFX_FIVE_LAYER_20261101): name, record,
  // bank, then the caster's taxonomy element.
  const resolved = new Map();
  function resolveMove(slot, moveId) {
    if (!Number.isSafeInteger(moveId)) return null;
    if (!resolved.has(moveId)) {
      let vfx = null;
      try {
        const move = getBattleCatalogRecord('moves', moveId);
        vfx = resolveMoveVfx(move, {speciesMoves: listMoveRecordsForSpecies(move.speciesId)});
      } catch { vfx = null; }
      resolved.set(moveId, vfx);
    }
    return resolved.get(moveId);
  }
  const nameOfSlot = slot => getView()?.combatants?.[slot]?.displayName ?? '';
  // The record names a side when both sides field the same name (Owner 2026-11-11 recording:
  // 「阿花仔攻擊阿花仔」 could not be read). A unique name is left as it is.
  function feedName(slot) {
    const combatants = getView()?.combatants ?? [], self = combatants[slot], name = self?.displayName ?? '';
    if (!self || !name) return name;
    const shared = combatants.some(c => c && c.present !== false && c.slot !== slot && c.team !== self.team && c.displayName === name);
    return shared ? `${uiText(self.team === localTeam() ? '我方' : '對手')}・${name}` : name;
  }
  /** Callout title: the approved name, the skill ID in local acceptance, else ''. */
  function moveNameOf(moveId) {
    const name = battleFxApprovedMoveName(moveId);
    if (!showIds) return name ?? '';
    return name ? `${name} #${moveId}` : `#${moveId}`;
  }
  return Object.freeze({
    describeMove,
    resolveMove,
    nameOfSlot,
    moveNameOf,
    text: value => uiText(value),
    onEvent(event) {
      if (typeof onTally === 'function') onTally(event);
      if (typeof onFeed !== 'function') return;
      if (event.type === 'LAUNCH') {
        const look = describeMove(event.slot, event.moveId);
        if (!look || look.tier === 'basic') return;
        const move = moveNameOf(event.moveId), ultimate = look.tier === 'ultimate';
        const template = move ? (ultimate ? '{name}發動絕招「{move}」！' : '{name}使出「{move}」！')
          : (ultimate ? '{name}發動絕招！' : '{name}使出技能！');
        // The cue tells the record band which line is a signature move, and whose.
        onFeed(uiText(template, {name: feedName(event.slot), move}), {tier: look.tier, slot: event.slot});
        lastSkillFeedAt = now();
        // Arcade cut-in (2026-10-28): a signature move's strip, decoration only.
        if (ultimate && typeof onCutIn === 'function') {
          const combatant = getView()?.combatants?.[event.slot];
          onCutIn({slot: event.slot, team: combatant?.team ?? null, speciesId: combatant?.speciesId ?? null,
            casterName: nameOfSlot(event.slot), moveName: move, palette: look.palette});
        }
      } else if (event.type === 'KO') {
        onFeed(uiText('{name}倒下了！', {name: feedName(event.slot)}));
        lastSkillFeedAt = now();
      } else if (event.type === 'HIT' && event.damage > 0) {
        // Owner 2026-11-03: the record kept a knockout line for the rest of the
        // match. Ordinary exchanges now feed it too, throttled, and never over
        // a fresh skill or knockout line.
        const at = now();
        if (at - lastSkillFeedAt < 1200 || at - lastHitFeedAt < BATTLE_FEED_HIT_INTERVAL_MS) return;
        lastHitFeedAt = at;
        const attacker = Number.isInteger(event.attackerSlot) ? feedName(event.attackerSlot) : '';
        onFeed(attacker ? uiText('{name}攻擊{target}，造成 {damage} 傷害', {name: attacker, target: feedName(event.slot), damage: event.damage})
          : uiText('{target}受到 {damage} 傷害', {target: feedName(event.slot), damage: event.damage}), {tier: 'basic', slot: event.attackerSlot ?? event.slot});
      } else if (event.type === 'HEAL' && event.amount > 0) {
        onFeed(uiText('{name}回復了 {amount} 生命值', {name: feedName(event.slot), amount: event.amount}), {tier: 'support', slot: event.slot});
        lastSkillFeedAt = now();
      }
    }
  });
}
