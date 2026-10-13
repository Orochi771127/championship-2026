// Original vs improved battle AI on identical fixed-seed practice matches
// (2026-10-13). Diagnostic only; not normal-game evidence.
// Usage: node scripts/research/battle-ai-fairness.mjs seeds=60 size=3 [sp=low] [out=file.json]
// sp=low sets every fighter to 20 TP so most skills are unaffordable.
//
// "Idle while able": a living, non-suspended combatant with a walk speed, not
// in a hit/down/recovery notification, no negative status, nothing in flight,
// that keeps its world point. Zero-walk species (eggs/babies, original data)
// have no legal movement and are reported separately.
const ROOT = new URL('../../', import.meta.url).href;
const {createBattleRuntime} = await import(ROOT + 'src/championship/app/battleRuntime.js');
const {createNativeHuntIndividual} = await import(ROOT + 'src/championship/hunt/capture/nativeHuntIndividual.js');
const {nativeHuntSpeciesByIndex} = await import(ROOT + 'src/championship/hunt/capture/nativeHuntSources.js');
const {nativeIndividualProfile} = await import(ROOT + 'src/championship/raising/nativeIndividualProfile.js');
const {BATTLE_SPECIES_MOVEMENT} = await import(ROOT + 'src/data/championship/battleCharacterProfiles.js');
const {battleAngleIndex} = await import(ROOT + 'src/championship/battle/battleNativeMath.js');
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const SEEDS = Number(args.seeds ?? 60), SIZE = Number(args.size ?? 3);
function individual(id, species, personality, rngSeed) {
  const p = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  p.fields['018'] = personality; if (args.sp === 'low') p.fields['054'] = p.fields['05c'] = 20; return {instanceId: id, nativeProfile: p};
}
const pool = []; for (let s = 0; s < 260 && pool.length < 200; s++) { try { individual('x', s, 0, 3); pool.push(s); } catch {} }
function pick(n, seed, k) { const out = []; let x = (seed * 2654435761 + k * 97) >>> 0; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; out.push(pool[x % pool.length]); } return out; }
const vertical = a => (a > 0x2000 && a < 0x6000) || (a > 0xa000 && a < 0xe000);
const HIT = new Set([15, 18, 19, 20, 21]);

function run(seed, aiPolicy) {
  const a = pick(SIZE, seed, 1), b = pick(SIZE, seed, 2);
  const rt = createBattleRuntime({mode: 5, battleType: 0, seed, aiPolicy,
    playerIndividuals: a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals: b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  rt.choosePracticeBattle({arenaIndex: 2});
  const src = rt.startMatch();
  const m = {idleAble: 0, idleAbleRuns: [], idleZeroWalk: 0, outOfBounds: 0, launches: 0, launchFar: 0, launchVertical: 0,
    reversals: 0, adaptations: {}, awayAfterKick: 0, kicks: 0, damage: [0, 0], tickError: null};
  const last = [], run = [], prevState = [], prevHp = [], dirHist = [], seen = new Set(), kickWatch = [];
  let lastClock = -1;
  for (let t = 0; t < 12000 && !src.getView().outcome.ended; t++) {
    try { src.tick(); } catch (e) { m.tickError = e.message; break; }
    const v = src.getView();
    for (const e of v.nativeLifecycle.normalFlow.history) {
      const k = `${e.frame}:${e.slot}:${e.type}:${e.action ?? ''}`; if (seen.has(k)) continue; seen.add(k);
      if (e.type === 'STATE_CHANGED' && [4, 5].includes(e.from) && [14, 15].includes(e.to)) { m.launches++; if (e.distance >= 32 * 4096) m.launchFar++; if (vertical(e.angle)) m.launchVertical++; }
      if (e.type === 'AI_ADAPTATION') { m.adaptations[e.action] = (m.adaptations[e.action] ?? 0) + 1;
        if (e.action.startsWith('WALK')) { m.kicks++; kickWatch.push({slot: e.slot, target: e.targetSlot, until: v.clock.frames + 30, start: null, aim: null}); } }
    }
    if (v.clock.frames === lastClock) continue; lastClock = v.clock.frames;
    const nf = v.nativeLifecycle.normalFlow.slots, re = v.nativeLifecycle.reactions.combatants;
    const pt = i => nf[i]?.point;
    v.combatants.forEach((c, i) => {
      if (!c?.present || !nf[i]) return;
      const p = pt(i), x = p[0] / 4096;
      if (x < 31.99 || x > 384.01) m.outOfBounds++;
      if (prevHp[i] !== undefined && c.hp.current < prevHp[i]) m.damage[1 - c.team] += prevHp[i] - c.hp.current;
      prevHp[i] = c.hp.current;
      prevState[i] = nf[i].state;
      // Direction reversals while approaching: x velocity sign flips within 8 frames.
      if (last[i]) { const vx = Math.sign(p[0] - last[i][0]); if (vx) { const h = dirHist[i] ??= []; h.push([v.clock.frames, vx]); while (h.length && h[0][0] < v.clock.frames - 8) h.shift();
        if (h.length >= 2 && h.at(-2)[1] !== vx && [4, 5].includes(nf[i].state)) m.reversals++; } }
      const moved = last[i] ? Math.hypot(p[0] - last[i][0], p[1] - last[i][1], p[2] - last[i][2]) / 4096 : 1;
      last[i] = p;
      const zeroWalk = !(BATTLE_SPECIES_MOVEMENT[Number(c.speciesId.slice(8))]?.walkQ12 > 0);
      const able = c.hp.current > 0 && !c.down && !re[i].suspended && !HIT.has(re[i].notification) && !c.status.code && !nf[i].launches.some(x => x !== null);
      const idle = able && moved < 0.25;
      if (idle && zeroWalk) m.idleZeroWalk++;
      else if (idle) { m.idleAble++; run[i] = (run[i] ?? 0) + 1; }
      else if (run[i]) { m.idleAbleRuns.push(run[i]); run[i] = 0; }
    });
    // A kick that moves its own fighter away from where its target stood at the kick.
    for (const w of kickWatch) { if (w.done) continue; const p = pt(w.slot), q = pt(w.target); if (!p || !q) { w.done = true; continue; }
      if (!w.start) { w.start = p; w.aim = q; w.gap0 = Math.hypot(q[0] - p[0], q[1] - p[1]); }
      if (HIT.has(re[w.slot]?.notification) || [14, 15, 16].includes(nf[w.slot]?.state)) w.engaged = true;
      if (v.clock.frames >= w.until) { w.done = true; const d0 = Math.hypot(w.aim[0] - w.start[0], w.aim[1] - w.start[1]), d1 = Math.hypot(w.aim[0] - p[0], w.aim[1] - p[1]); if (d1 - d0 > 8 * 4096) m.awayAfterKick++; if (Math.hypot(q[0] - p[0], q[1] - p[1]) - w.gap0 > 8 * 4096) m.separatedAfterKick = (m.separatedAfterKick ?? 0) + 1;
        const ux = w.aim[0] - w.start[0], uy = w.aim[1] - w.start[1], n = Math.hypot(ux, uy) || 1, along = ((p[0] - w.start[0]) * ux + (p[1] - w.start[1]) * uy) / n;
        if (!w.engaged && along < -8 * 4096) m.fledAfterKick = (m.fledAfterKick ?? 0) + 1; if (!w.engaged) m.quietKicks = (m.quietKicks ?? 0) + 1; } }
  }
  for (const r of run) if (r) m.idleAbleRuns.push(r);
  const o = src.getView().outcome;
  rt.dispose();
  const longest = Math.max(0, ...m.idleAbleRuns);
  delete m.idleAbleRuns;
  return {...m, longestIdleAble: longest, frames: lastClock, winningTeam: o.winningTeam ?? null, verdict: o.verdict, reason: o.reason};
}

const rows = [];
for (let seed = 1; seed <= SEEDS; seed++) rows.push({seed, original: run(seed, 'ORIGINAL'), improved: run(seed, 'IMPROVED_V1')});
const sum = (k, p) => rows.reduce((a, r) => a + (r[p][k] ?? 0), 0);
const summary = {};
for (const p of ['original', 'improved']) summary[p] = {
  battles: rows.length, tickErrors: rows.filter(r => r[p].tickError).length,
  idleAbleFrames: sum('idleAble', p), longestIdleAble: Math.max(...rows.map(r => r[p].longestIdleAble)),
  idleZeroWalkFrames: sum('idleZeroWalk', p), outOfBounds: sum('outOfBounds', p),
  launches: sum('launches', p), launchFar: sum('launchFar', p), launchVertical: sum('launchVertical', p), reversals: sum('reversals', p),
  kicks: sum('kicks', p), awayAfterKick: sum('awayAfterKick', p), separatedAfterKick: sum('separatedAfterKick', p), quietKicks: sum('quietKicks', p), fledAfterKick: sum('fledAfterKick', p),
  teamAWins: rows.filter(r => r[p].winningTeam === 0).length, teamBWins: rows.filter(r => r[p].winningTeam === 1).length,
  timeouts: rows.filter(r => /TIME/i.test(r[p].reason ?? '')).length,
  meanFrames: Math.round(sum('frames', p) / rows.length), damageA: sum('damage', p) && rows.reduce((a, r) => a + r[p].damage[0], 0), damageB: rows.reduce((a, r) => a + r[p].damage[1], 0)};
summary.sameWinner = rows.filter(r => r.original.winningTeam === r.improved.winningTeam).length;
console.log(JSON.stringify({size: SIZE, sp: args.sp ?? "normal", summary}, null, 1));
if (args.out) fs.writeFileSync(args.out, JSON.stringify({size: SIZE, summary, rows}, null, 1));
