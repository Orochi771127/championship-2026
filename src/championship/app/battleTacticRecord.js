// Battle-plan record (TACTIC_PRACTICE_LOOP_20261116) -- a read-only tap over
// the presentation views an auto battle already publishes.
//
// It never feeds anything back into the simulation: it reads the normal flow's
// LAUNCHED records (a move that actually left the combatant, with its record
// index) and each combatant's HP and SP ("resource") as they were on screen,
// and turns them into counts and a few dated moments. The post-battle line and
// the stage-1 measurement both read this one summary, so what the result screen
// says is exactly what the battle did -- never a line chosen from the plan.

import {listMoveRecordsForSpecies} from '../battle/battleCatalogs.js';

export const BATTLE_RECORD_FPS = 60;
const SLOT_COUNT = 6;
const teamOf = slot => (slot < 3 ? 0 : 1);
const speciesIndexOf = id => {
  if (Number.isInteger(id)) return id;
  const m = /^species-(\d+)$/.exec(String(id ?? ''));
  return m ? Number(m[1]) : null;
};

const kitCache = new Map();
/** Record index -> {kind, cost} for one species, plus its cheapest SP move. */
function kitOf(speciesId) {
  const index = speciesIndexOf(speciesId);
  if (index === null) return null;
  if (!kitCache.has(index)) {
    let records = [];
    try { records = listMoveRecordsForSpecies(index); } catch { records = []; }
    const moves = new Map(records.map(r => [r.recordIndex, {kind: r.kind, cost: Math.max(0, r.actionCost ?? 0)}]));
    const costs = records.filter(r => (r.actionCost ?? 0) > 0).map(r => r.actionCost);
    kitCache.set(index, {moves, cheapest: costs.length ? Math.min(...costs) : null});
  }
  return kitCache.get(index);
}

/**
 * Which column a launched move counts in: NORMAL (kind 0, no SP), SUPPORT (an
 * SP move aimed at its own team) or SKILL (an SP move aimed at the other team).
 */
export function classifyLaunch({slot, targetSlot, moveId, speciesId}) {
  const move = kitOf(speciesId)?.moves.get(moveId) ?? null;
  if (!move || move.cost === 0 || move.kind === 0) return 'normal';
  if (Number.isInteger(targetSlot) && teamOf(targetSlot) === teamOf(slot)) return 'support';
  return 'skill';
}

/** Call `observe(view)` with every view the battle publishes. */
export function createBattleRecordTap({localTeamIndex = 0} = {}) {
  const seen = new Set();
  const slots = Array.from({length: SLOT_COUNT}, () => null);
  let lastFrame = 0;
  const slotState = (c) => slots[c.slot] ??= {
    slot: c.slot, team: c.team ?? teamOf(c.slot), speciesId: c.speciesId, displayName: c.displayName ?? null,
    counts: {normal: 0, skill: 0, support: 0}, moves: {}, launches: [],
    spLast: null, spSpent: 0, spEmptyFrames: 0, spEmptyAt: null, firstSkillAt: null,
    hpMax: c.hp?.maximum ?? 0, hpLast: c.hp?.current ?? 0, downAt: null
  };
  return {
    localTeamIndex,
    observe(view) {
      const frame = view?.clock?.frames ?? lastFrame;
      const step = Math.max(0, frame - lastFrame);
      lastFrame = frame;
      for (const c of view?.combatants ?? []) {
        if (!c?.present) continue;
        const s = slotState(c);
        s.speciesId = c.speciesId ?? s.speciesId;
        const sp = c.resource?.current;
        if (Number.isFinite(sp)) {
          if (s.spLast !== null && sp < s.spLast) s.spSpent += s.spLast - sp;
          s.spLast = sp;
          const cheapest = kitOf(s.speciesId)?.cheapest;
          if (cheapest !== null && cheapest !== undefined && sp < cheapest) {
            s.spEmptyFrames += step;
            if (s.spEmptyAt === null && s.spSpent > 0) s.spEmptyAt = frame;
          }
        }
        if (Number.isFinite(c.hp?.current)) {
          s.hpLast = c.hp.current; s.hpMax = c.hp.maximum ?? s.hpMax;
          if (c.hp.current <= 0 && s.downAt === null) s.downAt = frame;
        }
      }
      for (const e of view?.nativeLifecycle?.normalFlow?.history ?? []) {
        if (e?.type !== 'LAUNCHED') continue;
        const key = `${e.frame}:${e.slot}:${e.moveId}:${e.actionIndex ?? ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = slots[e.slot];
        if (!s) continue;
        const column = classifyLaunch({slot: e.slot, targetSlot: e.targetSlot, moveId: e.moveId, speciesId: s.speciesId});
        s.counts[column] += 1;
        if (column !== 'normal' && Number.isInteger(e.moveId)) s.moves[e.moveId] = (s.moves[e.moveId] ?? 0) + 1;
        if (column === 'skill' && s.firstSkillAt === null) s.firstSkillAt = e.frame;
        s.launches.push({frame: e.frame, moveId: e.moveId ?? null, column, targetSlot: e.targetSlot ?? null});
        if (s.launches.length > 256) s.launches.shift();
      }
    },
    snapshot: () => ({frame: lastFrame, slots: slots.map(s => s && structuredClone(s))})
  };
}

const seconds = frames => (frames === null || frames === undefined ? null : Math.round((frames / BATTLE_RECORD_FPS) * 10) / 10);

/**
 * The per-battle record: the outcome, each local partner's columns and dated
 * moments. `diagnostics` (the runtime's personality read-out) is optional and
 * only contributes the plan each partner actually fought with.
 */
export function summariseBattleRecord({tap, view, diagnostics = null, localTeamIndex = tap?.localTeamIndex ?? 0}) {
  const snap = tap.snapshot();
  const outcome = view?.outcome?.ended
    ? (view.outcome.winningTeam === localTeamIndex ? 'WIN' : Number.isInteger(view.outcome.winningTeam) ? 'LOSS' : 'DRAW')
    : 'UNFINISHED';
  const foes = snap.slots.filter(s => s && s.team !== localTeamIndex);
  const foeHpMax = foes.reduce((a, s) => a + (s.hpMax || 0), 0);
  const foeHpLost = foes.reduce((a, s) => a + Math.max(0, (s.hpMax || 0) - Math.max(0, s.hpLast || 0)), 0);
  const planOf = slot => diagnostics?.slots?.[slot]?.tactic ?? null;
  const profileOf = slot => diagnostics?.slots?.[slot]?.profile ?? null;
  // The AI's own counters: ACTION / TARGETED_ACTION commit to a move, MOVE
  // spends the decision repositioning (the ladder's walk states).
  const decisionsOf = slot => {
    const d = diagnostics?.slots?.[slot];
    if (!d || !Number.isFinite(d.decisions)) return null;
    return {total: d.decisions, attack: (d.action ?? 0) + (d.targeted ?? 0), reposition: d.move ?? 0};
  };
  const local = snap.slots.filter(s => s && s.team === localTeamIndex).map(s => {
    const total = s.counts.normal + s.counts.skill + s.counts.support;
    return {
      slot: s.slot, instanceId: diagnostics?.slots?.[s.slot]?.instanceId ?? null, speciesId: s.speciesId, displayName: s.displayName,
      tactic: planOf(s.slot), profile: profileOf(s.slot),
      decisions: decisionsOf(s.slot),
      counts: {...s.counts}, total,
      share: {normal: total ? s.counts.normal / total : 0, skill: total ? s.counts.skill / total : 0, support: total ? s.counts.support / total : 0},
      moves: Object.entries(s.moves).map(([id, n]) => ({moveId: Number(id), count: n})).sort((a, b) => b.count - a.count),
      spSpent: s.spSpent, spEmptySeconds: seconds(s.spEmptyFrames) ?? 0, spEmptyAt: seconds(s.spEmptyAt),
      firstSkillAt: seconds(s.firstSkillAt), downAt: seconds(s.downAt),
      hpLeftRatio: s.hpMax ? Math.max(0, s.hpLast) / s.hpMax : 0,
      damageDealtRatio: foeHpMax ? foeHpLost / foeHpMax : 0
    };
  });
  return {outcome, seconds: seconds(snap.frame) ?? 0, local, foeHpLostRatio: foeHpMax ? foeHpLost / foeHpMax : 0};
}
