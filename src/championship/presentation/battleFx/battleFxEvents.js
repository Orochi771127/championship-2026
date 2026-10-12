// Dynamic battle presentation -- events read off the published battle view.
//
// OWNER_APPROVED_ADAPTATION 2026-10-12. The tracker only compares successive
// views the presentation source already publishes (HP, down flags, the live
// launch list and the hit runtime's own history). It never reaches into the
// session, so it cannot change a rule, a draw or a timing. Feeding it the same
// views always yields the same events.

/** History entries are copied per view; key one entry stably. */
const historyKey = (entry, index) => `${entry.frame}:${entry.slot}:${entry.type}:${index}`;

export function createBattleFxEventTracker() {
  let previous = null;
  let started = false, ended = false;
  const liveLaunches = new Set();
  const seenHistory = new Set();
  let historyFrame = -1;
  const lastLaunchBySlot = new Map();

  function launchesOf(view) {
    return (view.nativeLifecycle?.active ?? [])
      .filter(launch => Number.isInteger(launch?.ownerSlot) && Number.isInteger(launch?.moveId) && launch.phase !== 'DONE');
  }

  /** The most recent launch by the opposing team, for knockback direction. */
  function attackerFor(slot, combatants) {
    const team = combatants[slot]?.team;
    let best = null;
    for (const [owner, info] of lastLaunchBySlot) {
      if (combatants[owner]?.team === team) continue;
      if (!best || info.frame > best.frame) best = {slot: owner, ...info};
    }
    return best;
  }

  return Object.freeze({
    /** Events since the previous view, in a stable order. */
    consume(view) {
      const events = [];
      if (!view || !Array.isArray(view.combatants)) return events;
      const frame = view.animationFrame ?? view.clock?.frames ?? 0;
      const combatants = view.combatants;
      if (!started) {
        started = true;
        events.push(Object.freeze({type: 'START', frame}));
      }

      const live = new Set();
      for (const launch of launchesOf(view)) {
        const key = `${launch.object}:${launch.moveId}:${launch.ownerSlot}`;
        live.add(key);
        if (liveLaunches.has(key)) continue;
        lastLaunchBySlot.set(launch.ownerSlot, {moveId: launch.moveId, frame});
        events.push(Object.freeze({type: 'LAUNCH', frame, slot: launch.ownerSlot, moveId: launch.moveId}));
      }
      liveLaunches.clear();
      for (const key of live) liveLaunches.add(key);

      const history = view.nativeLifecycle?.reactions?.history ?? [];
      if (history.length) {
        const latest = history[history.length - 1].frame;
        // Entries older than the last processed frame were already seen. Equal
        // (frame, slot, type) entries are told apart by their occurrence.
        const occurrences = new Map();
        history.forEach(entry => {
          const base = `${entry.frame}:${entry.slot}:${entry.type}`;
          const occurrence = occurrences.get(base) ?? 0;
          occurrences.set(base, occurrence + 1);
          if (entry.frame < historyFrame) return;
          const key = historyKey(entry, occurrence);
          if (seenHistory.has(key)) return;
          seenHistory.add(key);
          if (entry.type === 'STATUS_APPLIED') events.push(Object.freeze({type: 'STATUS', frame, slot: entry.slot, code: entry.code}));
          else if (entry.type === 'SUPPORT_APPLIED') events.push(Object.freeze({type: 'SUPPORT', frame, slot: entry.slot, statusCode: entry.statusCode}));
          else if (entry.type === 'LANDED') events.push(Object.freeze({type: 'LANDED', frame, slot: entry.slot}));
        });
        if (latest > historyFrame) {
          for (const key of [...seenHistory]) if (Number(key.split(':')[0]) < latest) seenHistory.delete(key);
          historyFrame = latest;
        }
      }

      if (previous) {
        combatants.forEach((combatant, slot) => {
          const before = previous[slot];
          if (!combatant?.present || !before?.present) return;
          const hpBefore = before.hp?.current ?? 0, hpAfter = combatant.hp?.current ?? 0, maxHp = Math.max(1, combatant.hp?.maximum ?? 1);
          if (hpAfter < hpBefore) {
            const attacker = attackerFor(slot, combatants);
            events.push(Object.freeze({type: 'HIT', frame, slot, damage: hpBefore - hpAfter, hpBefore, hpAfter, maxHp,
              ratio: (hpBefore - hpAfter) / maxHp, attackerSlot: attacker?.slot ?? null, moveId: attacker?.moveId ?? null}));
          } else if (hpAfter > hpBefore) {
            events.push(Object.freeze({type: 'HEAL', frame, slot, amount: hpAfter - hpBefore, maxHp}));
          }
          if (combatant.down && !before.down) {
            const teamLeft = combatants.filter(c => c?.present && c.team === combatant.team && !c.down).length;
            events.push(Object.freeze({type: 'KO', frame, slot, teamDown: teamLeft === 0}));
          }
        });
      }
      if (view.nativeLifecycle?.flash?.active) events.push(Object.freeze({type: 'FLASH', frame}));
      if (view.outcome?.ended && !ended) {
        ended = true;
        events.push(Object.freeze({type: 'END', frame, verdict: view.outcome.verdict, winningTeam: view.outcome.winningTeam ?? null}));
      }
      previous = combatants.map(c => c ? {present: c.present, down: c.down, hp: {current: c.hp?.current ?? 0}} : null);
      return events;
    }
  });
}
