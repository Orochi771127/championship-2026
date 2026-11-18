// Tamer skill cards (ROADMAP_R4_20261118, OWNER_APPROVED_ADAPTATION). Owner 2026-11-18: 「馴獸師可以有 20 個技能，
// 自動對戰的時候會從 20 個技能中隨機選三個技能卡來施放…也可以加入到天賦技能樹」 and, on who casts: 「玩家點擊釋放，做成一個
// 技能卡片三張手牌在手中的樣子，然後玩家可以把它往上提以後丟出去的樣子」. The whole roadmap is Claude's to decide
// (TAMER_PROGRESSION_ROADMAP_20261118), so the numbers below are Claude's starting values.
//
// Pure rules: the 20 cards, which of them a tamer owns (4 basic, 16 by the talent lines), the hand a battle draws, how
// many cards each battle mode allows and when each card may be played. The battle effects live in
// battle/battleSkillCards.js; nothing here touches a native field, a save or the gachapon.
import {deepFreeze} from './championshipContracts.js';
import {normalizeTamerTalents, talentSpentInLine, TALENT_LINES} from './productTamerTalents.js';

export const SKILL_CARD_FPS = 60;
/** The first card can be played this long after the fight starts; each later one this much after it. A free battle can end
 * in about 13 s (measured from the normal entry), so all three must fit in that: 3 s, 9 s, 15 s. */
export const SKILL_CARD_FIRST_FRAMES = 3 * SKILL_CARD_FPS;
export const SKILL_CARD_STEP_FRAMES = 6 * SKILL_CARD_FPS;
export const SKILL_CARD_HAND_MAX = 3;
/** Points spent in a talent line that give its four cards, in order. */
export const SKILL_CARD_LINE_GATES = Object.freeze([3, 9, 15, 22]);

// kind: what the battle module does. Amounts are percents of the maximum unless named otherwise.
//   TEAM_TP      local team TP +amount% of its base          HEAL_LOWEST  the local partner lowest in HP heals amount%
//   NEXT_SIGNATURE the local team's next signature hit +amount%  GUARD    local damage taken -amount% for seconds
//   FOE_DELAY    one foe's next action waits seconds          MARK        one foe takes +amount% for seconds
//   FOE_TP       foes lose amount% of their base TP           FOES_DELAY  every foe's next action waits seconds
//   TEAM_HEAL    local team heals amount%                     CLEANSE     local team's status cleared
//   REGEN        local team heals amount% every 2 s for seconds  GUTS     the next fatal hit on the team leaves 1 HP
//   TEAM_DAMAGE  local damage dealt +amount% for seconds      TEAM_CRIT   local critical chance +amount for seconds
//   TEAM_HASTE   local cooldowns now x (100-amount)%          BURST_GAUGE local burst gauges +amount%
//   BITS / SYNC_EXP / CRYSTALS / TICKET  paid only by a won match: +amount% Bits, +amount% Sync EXP, +amount crystals,
//                amount% chance of 1 gachapon ticket
export const SKILL_CARDS = deepFreeze([
  {id: 'basic.cheer', line: 'basic', kind: 'TEAM_TP', amount: 20},
  {id: 'basic.firstAid', line: 'basic', kind: 'HEAL_LOWEST', amount: 15},
  {id: 'basic.focus', line: 'basic', kind: 'NEXT_SIGNATURE', amount: 25},
  {id: 'basic.cover', line: 'basic', kind: 'GUARD', amount: 20, seconds: 8},
  {id: 'hunter.stunShot', line: 'hunter', kind: 'FOE_DELAY', seconds: 2},
  {id: 'hunter.weakMark', line: 'hunter', kind: 'MARK', amount: 15, seconds: 10},
  {id: 'hunter.smoke', line: 'hunter', kind: 'FOE_TP', amount: 30},
  {id: 'hunter.snare', line: 'hunter', kind: 'FOES_DELAY', seconds: 1},
  {id: 'breeder.nutrient', line: 'breeder', kind: 'TEAM_HEAL', amount: 10},
  {id: 'breeder.calm', line: 'breeder', kind: 'CLEANSE'},
  {id: 'breeder.vitality', line: 'breeder', kind: 'REGEN', amount: 2, seconds: 10},
  {id: 'breeder.guts', line: 'breeder', kind: 'GUTS'},
  {id: 'commander.charge', line: 'commander', kind: 'TEAM_DAMAGE', amount: 15, seconds: 8},
  {id: 'commander.critDrill', line: 'commander', kind: 'TEAM_CRIT', amount: 15, seconds: 8},
  {id: 'commander.link', line: 'commander', kind: 'TEAM_HASTE', amount: 50},
  {id: 'commander.awaken', line: 'commander', kind: 'BURST_GAUGE', amount: 25},
  {id: 'trader.bounty', line: 'trader', kind: 'BITS', amount: 20},
  {id: 'trader.sync', line: 'trader', kind: 'SYNC_EXP', amount: 25},
  {id: 'trader.probe', line: 'trader', kind: 'CRYSTALS', amount: 30},
  {id: 'trader.lucky', line: 'trader', kind: 'TICKET', amount: 30}
]);
export const SKILL_CARD_IDS = Object.freeze(SKILL_CARDS.map(card => card.id));
export const SKILL_CARD_REWARD_KINDS = Object.freeze(['BITS', 'SYNC_EXP', 'CRYSTALS', 'TICKET']);
const BY_ID = new Map(SKILL_CARDS.map(card => [card.id, card]));
export const getSkillCard = id => BY_ID.get(id) ?? null;

/** The gate (points spent in its line) that gives a card; 0 for the basic four. */
export function skillCardGate(id) {
  const card = getSkillCard(id);
  if (!card || card.line === 'basic') return card ? 0 : null;
  return SKILL_CARD_LINE_GATES[SKILL_CARDS.filter(entry => entry.line === card.line).indexOf(card)];
}

/** Every card the tamer owns: the four basic ones and, per talent line, one for each gate its spent points reached. */
export function ownedSkillCards(talents) {
  const state = normalizeTamerTalents(talents);
  return SKILL_CARD_IDS.filter(id => {
    const card = BY_ID.get(id);
    return card.line === 'basic' || (TALENT_LINES.includes(card.line) && talentSpentInLine(state, card.line) >= skillCardGate(id));
  });
}

/**
 * How many cards a battle allows. Free (2) and Practice (5) battles take a full hand; title matches (1) and tournaments
 * (0) one card at title ranks 0-2, two at 3-5 and three from 6, like the commander line's rank cap; password and link
 * battles (3, 4), online and the tutorial none (the application passes no hand for those).
 */
export function skillCardHandSize(mode, rank = 0) {
  if (mode === 2 || mode === 5) return SKILL_CARD_HAND_MAX;
  if (mode === 0 || mode === 1) return rank >= 6 ? 3 : rank >= 3 ? 2 : 1;
  return 0;
}

/** Draw `size` different cards from `owned` with the product random function (never the battle's own RNG). */
export function drawSkillHand(owned, size, random = Math.random) {
  const pool = [...new Set((owned ?? []).filter(id => BY_ID.has(id)))];
  const hand = [];
  for (let n = Math.min(size, pool.length); n > 0; n -= 1) {
    const index = Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * pool.length));
    hand.push(pool.splice(index, 1)[0]);
  }
  return Object.freeze(hand);
}

/** How many cards may have been played by `frame`: none before 3 s, then one more every 6 s, up to the hand. */
export function skillCardsAllowedAt(frame, handSize) {
  if (!(frame >= SKILL_CARD_FIRST_FRAMES)) return 0;
  return Math.min(handSize, 1 + Math.floor((frame - SKILL_CARD_FIRST_FRAMES) / SKILL_CARD_STEP_FRAMES));
}
/** The frame at which the `played + 1`-th card becomes playable. */
export function skillCardNextFrame(played) {
  return SKILL_CARD_FIRST_FRAMES + Math.max(0, played) * SKILL_CARD_STEP_FRAMES;
}
