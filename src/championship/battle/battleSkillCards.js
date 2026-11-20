// Tamer skill cards in one auto battle (ROADMAP_R4_20261118, OWNER_APPROVED_ADAPTATION; rules in
// contracts/productTamerSkillCards.js). Opt-in like the taxonomy and the burst: with no hand the module does nothing,
// so parity fixtures and replays keep the original rules.
//
// The player throws a card (request); the effect lands on the next battle step, after the native step, where the
// taxonomy's regeneration and the burst already write HP -- never inside AI dispatch. It writes only fields product
// rules already write: HP, TP (metricLimit), the decision cooldown (field28) and the status code. Damage and critical
// changes ride the runtime's existing scaling chain. Reward cards change nothing in the fight; the settlement reads them.
import {getSkillCard, skillCardsAllowedAt, skillCardNextFrame, SKILL_CARD_FPS, SKILL_CARD_REWARD_KINDS} from '../contracts/productTamerSkillCards.js';

const REGEN_EVERY_FRAMES = 2 * SKILL_CARD_FPS;

/**
 * @param {object} options
 * @param {string[]} [options.hand]   card ids, at most 3; empty or missing turns the module off
 * @param {number} [options.team]     the local team index
 * @param {(slot:number)=>number} options.teamOf
 */
export function createBattleSkillCards({hand = [], playedIds = [], team = 0, teamOf} = {}) {
  const cards = (Array.isArray(hand) ? hand : []).map(getSkillCard).filter(Boolean).slice(0, 3);
  const on = cards.length > 0 && typeof teamOf === 'function';
  const priorPlayed = new Set((Array.isArray(playedIds) ? playedIds : []).filter(id => cards.some(c => c.id === id)));
  const played = new Map([...priorPlayed].map(id => [id, -1])); // id -> frame it landed (-1 = earlier wave)
  const queue = [];
  const effects = []; // {card, until, slot?}
  let signatureBoost = 0, guts = false;
  const mine = slot => teamOf(slot) === team;
  const alive = c => c && c.currentHp > 0;
  const active = (kind, frame) => effects.filter(e => e.card.kind === kind && e.until > frame);
  let lastFrame = 0;
  const usedThisWave = () => (played.size - priorPlayed.size) + queue.length;
  const remainingCount = () => Math.max(0, cards.length - priorPlayed.size);

  function land(card, frame, slots) {
    let changed = false;
    const locals = slots.map((c, slot) => (c && mine(slot) && alive(c) ? slot : -1)).filter(slot => slot >= 0);
    const foes = slots.map((c, slot) => (c && !mine(slot) && alive(c) ? slot : -1)).filter(slot => slot >= 0);
    const heal = (slot, percent) => { const c = slots[slot]; const before = c.currentHp;
      c.currentHp = Math.min(c.maxHp, c.currentHp + Math.max(1, Math.trunc(c.maxHp * percent / 100))); changed ||= c.currentHp !== before; };
    // the foe that matters most: the one closest to falling (ties: the lowest slot)
    const target = () => foes.reduce((best, slot) => (best < 0 || slots[slot].currentHp * slots[best].maxHp < slots[best].currentHp * slots[slot].maxHp ? slot : best), -1);
    switch (card.kind) {
      case 'FOE_TP': for (const slot of foes) { const c = slots[slot]; c.metricLimit = Math.max(0, c.metricLimit - Math.trunc(c.metricBase * card.amount / 100)); } break;
      case 'TEAM_TP': for (const slot of locals) { const c = slots[slot]; c.metricLimit = Math.min(c.metricBase * 2, c.metricLimit + Math.trunc(c.metricBase * card.amount / 100)); } break;
      case 'HEAL_LOWEST': { const slot = locals.reduce((best, s) => (best < 0 || slots[s].currentHp * slots[best].maxHp < slots[best].currentHp * slots[s].maxHp ? s : best), -1);
        if (slot >= 0) heal(slot, card.amount); break; }
      case 'TEAM_HEAL': for (const slot of locals) heal(slot, card.amount); break;
      case 'CLEANSE': for (const slot of locals) slots[slot].statusCode = 0; break;
      case 'NEXT_SIGNATURE': signatureBoost += card.amount; break;
      case 'GUTS': guts = true; break;
      case 'FOE_DELAY': { const slot = target(); if (slot >= 0) slots[slot].field28 = Math.max(slots[slot].field28 | 0, 0) + card.seconds * SKILL_CARD_FPS; break; }
      case 'FOES_DELAY': for (const slot of foes) slots[slot].field28 = Math.max(slots[slot].field28 | 0, 0) + card.seconds * SKILL_CARD_FPS; break;
      case 'TEAM_HASTE': for (const slot of locals) slots[slot].field28 = Math.trunc(Math.max(slots[slot].field28 | 0, 0) * (100 - card.amount) / 100); break;
      case 'MARK': { const slot = target(); if (slot >= 0) effects.push({card, slot, until: frame + card.seconds * SKILL_CARD_FPS}); break; }
      case 'BURST_GAUGE': break; // the runtime pays it through its burst module (burstGaugePercent)
      default:
        if (card.seconds) effects.push({card, until: frame + card.seconds * SKILL_CARD_FPS, from: frame});
    }
    return changed;
  }

  return Object.freeze({
    on,
    /** The player throws a card. Refused when it is not in the hand, already played, or not yet allowed. */
    request(id, frame = lastFrame) {
      if (!on) return Object.freeze({ok: false, reason: 'NO_HAND'});
      const card = cards.find(entry => entry.id === id);
      if (!card) return Object.freeze({ok: false, reason: 'NOT_IN_HAND'});
      if (played.has(id) || queue.includes(card)) return Object.freeze({ok: false, reason: 'ALREADY_PLAYED'});
      if (usedThisWave() >= skillCardsAllowedAt(frame, remainingCount())) return Object.freeze({ok: false, reason: 'NOT_READY'});
      queue.push(card);
      return Object.freeze({ok: true, id});
    },
    /** After a native battle step. Returns {changed, landed, burstGaugePercent}; `changed` means HP moved. */
    step(frame, slots) {
      lastFrame = frame;
      if (!on) return {changed: false, landed: [], burstGaugePercent: 0};
      let changed = false, burstGaugePercent = 0;
      const landed = [];
      while (queue.length) {
        const card = queue.shift();
        played.set(card.id, frame);
        landed.push(card.id);
        if (card.kind === 'BURST_GAUGE') burstGaugePercent += card.amount;
        changed = land(card, frame, slots) || changed;
      }
      for (const effect of effects) {
        if (effect.card.kind !== 'REGEN' || effect.until < frame || (frame - effect.from) % REGEN_EVERY_FRAMES !== 0 || frame === effect.from) continue;
        slots.forEach((c, slot) => { if (c && mine(slot) && alive(c) && c.currentHp < c.maxHp) {
          c.currentHp = Math.min(c.maxHp, c.currentHp + Math.max(1, Math.trunc(c.maxHp * effect.card.amount / 100))); changed = true; } });
      }
      return {changed, landed, burstGaugePercent};
    },
    /** One resolved hit, after the taxonomy and the burst. */
    scaleDamage({attackerSlot, defenderSlot, damage, signature = false, defenderHp = null}) {
      if (!on || !(damage > 0)) return damage;
      let scaled = damage;
      if (mine(attackerSlot)) {
        const up = active('TEAM_DAMAGE', lastFrame).reduce((sum, e) => sum + e.card.amount, 0)
          + active('MARK', lastFrame).filter(e => e.slot === defenderSlot).reduce((sum, e) => sum + e.card.amount, 0)
          + (signature ? signatureBoost : 0);
        if (signature && signatureBoost) signatureBoost = 0;
        if (up) scaled = scaled * (100 + up) / 100;
      } else {
        const guard = active('GUARD', lastFrame).reduce((sum, e) => sum + e.card.amount, 0);
        if (guard) scaled = scaled * Math.max(0, 100 - guard) / 100;
      }
      scaled = Math.max(1, Math.trunc(scaled));
      // 毅力: the next hit that would knock a local partner out leaves it 1 HP, once.
      if (guts && mine(defenderSlot) && Number.isFinite(defenderHp) && defenderHp > 1 && scaled >= defenderHp) { guts = false; scaled = defenderHp - 1; }
      return scaled;
    },
    critBonus(slot) {
      if (!on) return 0;
      // never negative: the original resolver takes only a bonus
      return mine(slot) ? active('TEAM_CRIT', lastFrame).reduce((sum, e) => sum + e.card.amount, 0) : 0;
    },
    /** For the hand on screen: each card's state and when the next one becomes playable. */
    snapshot(frame = lastFrame) {
      const rem = remainingCount(), waveUsed = usedThisWave(), allowed = skillCardsAllowedAt(frame, rem);
      const totalUsed = played.size + queue.length;
      return Object.freeze({on, frame, nextFrame: waveUsed < rem ? skillCardNextFrame(waveUsed) : null, allowed, used: totalUsed,
        cards: Object.freeze(cards.map(card => Object.freeze({id: card.id, line: card.line, kind: card.kind,
          state: played.has(card.id) || queue.includes(card) ? 'PLAYED' : waveUsed < allowed ? 'READY' : 'WAIT'})))});
    },
    /** Cross-wave carry-over state: restore cards already played in earlier waves of the same run. */
    restorePlayed(ids = []) {
      if (!on || !Array.isArray(ids)) return;
      for (const id of ids) {
        if (cards.some(card => card.id === id) && !played.has(id)) {
          priorPlayed.add(id);
          played.set(id, -1);
        }
      }
    },
    /** Cross-wave carry-over state: exact drawn hand and which cards are already spent (never redrawn or refilled). */
    exportState() {
      return Object.freeze({
        hand: Object.freeze(cards.map(card => card.id)),
        playedIds: Object.freeze([...new Set([...played.keys(), ...queue.map(card => card.id)])])
      });
    },
    /** The reward cards played this battle, for a won settlement: {bitsPercent, syncPercent, crystals, ticketPercent}. */
    rewards() {
      const sum = kind => [...played.keys()].map(getSkillCard).filter(card => card?.kind === kind).reduce((total, card) => total + card.amount, 0);
      return Object.freeze({bitsPercent: sum('BITS'), syncPercent: sum('SYNC_EXP'), crystals: sum('CRYSTALS'), ticketPercent: sum('TICKET'),
        played: Object.freeze([...played.keys()])});
    }
  });
}
export {SKILL_CARD_REWARD_KINDS};
