// Diagnostic (fixed-seed) battle stall scanner (2026-10-13). Not normal-game
// evidence: practice matches built from hunt individuals with explicit seeds.
// Usage: node scripts/research/battle-stall-scan.mjs seeds=30 arenas=2 size=3 [min=120] [out=file.json]
// [policy=ai-v1] runs the Owner-approved improved AI (IMPROVED_V1) on both teams.
// Runs practice battles headless and reports intervals where a living,
// non-suspended combatant neither moves nor has an action in flight.
const ROOT = new URL('../../', import.meta.url).href;
const {createBattleRuntime} = await import(ROOT + 'src/championship/app/battleRuntime.js');
const {createNativeHuntIndividual} = await import(ROOT + 'src/championship/hunt/capture/nativeHuntIndividual.js');
const {nativeHuntSpeciesByIndex} = await import(ROOT + 'src/championship/hunt/capture/nativeHuntSources.js');
const {nativeIndividualProfile} = await import(ROOT + 'src/championship/raising/nativeIndividualProfile.js');
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => a.split('=')));
const SEEDS = Number(args.seeds ?? 20), MIN = Number(args.min ?? 120), SIZE = Number(args.size ?? 3);
const ARENAS = (args.arenas ?? '2,7').split(',').map(Number);
const OUT = args.out ?? null;
const AI = args.policy === 'ai-v1' ? 'IMPROVED_V1' : 'ORIGINAL';

const v_end = src => src.getView().combatants.map(c => c?.present ? c.hp.current : null);
function individual(id, species, personality, rngSeed) {
  const p = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  if (personality !== undefined) p.fields['018'] = personality;
  return {instanceId: id, nativeProfile: p};
}
// Species pool: whatever the hunt source can build.
const pool = [];
for (let s = 0; s < 260 && pool.length < 200; s++) { try { individual('x', s, 0, 3); pool.push(s); } catch {} }

function pick(n, seed, k) { const out = []; let x = (seed * 2654435761 + k * 97) >>> 0; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; out.push(pool[x % pool.length]); } return out; }

const report = [];
for (let seed = 1; seed <= SEEDS; seed++) for (const arena of ARENAS) {
  const a = pick(SIZE, seed, 1), b = pick(SIZE, seed, 2);
  const rt = createBattleRuntime({mode: 5, battleType: 0, seed, aiPolicy: AI,
    playerIndividuals: a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals: b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  let src;
  try { rt.choosePracticeBattle({arenaIndex: arena}); src = rt.startMatch(); } catch (e) { report.push({seed, arena, error: e.message}); continue; }
  const last = [], run = [], launchesSeen = [];
  const stalls = [];
  let frame = 0, tickError = null;
  const adapt = new Map(), seen = new Set(), dealt = [0, 0];
  for (; frame < 9000 && !src.getView().outcome.ended; frame++) {
    try { src.tick(); } catch (e) { tickError = {frame: src.getView().clock.frames, message: e.message}; break; }
    const v = src.getView();
    const nf = v.nativeLifecycle.normalFlow.slots, re = v.nativeLifecycle.reactions.combatants;
    for (const e of v.nativeLifecycle.normalFlow.history) { const k = e.frame + ":" + e.slot + ":" + e.type + ":" + (e.action ?? ""); if (seen.has(k)) continue; seen.add(k); if (e.type === "AI_ADAPTATION") adapt.set(e.action, (adapt.get(e.action) ?? 0) + 1); }
    const active = new Set((v.nativeLifecycle.active ?? []).map(l => l.ownerSlot));
    v.combatants.forEach((c, i) => {
      if (!c?.present || !nf[i]) return;
      const p = nf[i].point, prev = last[i];
      const moved = prev ? Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) / 4096 : 1;
      last[i] = p;
      const busy = active.has(i) || nf[i].launches.some(x => x !== null);
      const live = c.hp.current > 0 && !c.down && !re[i].suspended;
      const still = live && moved < 0.25 && !busy;
      if (still) {
        if (!run[i]) run[i] = {slot: i, species: c.speciesId, team: c.team, start: v.clock.frames, startPoint: p.map(n => Math.round(n / 4096)), states: {}, notes: {}, sp: c.resource.current, hp: c.hp.current, status: c.status.code};
        const r = run[i]; r.end = v.clock.frames;
        const key = `s${nf[i].state}/n${re[i].notification}`; r.states[key] = (r.states[key] ?? 0) + 1;
        r.target = nf[i].targetSlot; r.cooldown = c.cooldown; r.spEnd = c.resource.current;
      } else if (run[i]) {
        const r = run[i]; run[i] = null;
        if (r.end - r.start >= MIN) stalls.push({...r, frames: r.end - r.start, endedBy: live ? (busy ? 'ACTION' : 'MOVE') : 'NOT_LIVE'});
      }
    });
  }
  for (const r of run) if (r && r.end - r.start >= MIN) stalls.push({...r, frames: r.end - r.start, endedBy: 'BATTLE_END'});
  const o = src.getView().outcome;
  report.push({seed, arena, a, b, frames: frame, verdict: o.verdict, reason: o.reason, winningTeam: o.winningTeam ?? null, hp: v_end(src), stalls, tickError, adaptations: Object.fromEntries(adapt)});
  rt.dispose();
}
const all = report.flatMap(r => (r.stalls ?? []).map(s => ({seed: r.seed, arena: r.arena, ...s})));
console.log(JSON.stringify({battles: report.length, errors: report.filter(r => r.error).length, tickErrors: report.filter(r => r.tickError).map(r => [r.seed, r.arena, r.a, r.b, r.tickError]), stallCount: all.length,
  longest: all.sort((x, y) => y.frames - x.frames).slice(0, 12)}, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
