#!/usr/bin/env node
// Stage 1 of the tactic practice loop (2026-11-16): measure what the battle plan
// (作戰方針, policy 0/1/2) actually changes in a headless auto battle.
//
// Read-only: builds fresh hunt individuals, runs the real battle runtime the
// menu battles use (ORIGINAL personality wiring, IMPROVED_V1 AI, TAXONOMY_V1,
// burst OFF so a burst cannot mask the plan) and tallies the AI's own decision
// counters. Nothing touches a save.
//
// Usage: node scripts/analysis/measure-battle-tactics.mjs [--seeds 20] [--out dir]
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createBattleRuntime} from '../../src/championship/app/battleRuntime.js';
import {createNativeHuntIndividual} from '../../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../../src/championship/raising/nativeIndividualProfile.js';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const SEEDS = Number(arg('--seeds', 20));
const OUT = arg('--out', null);
const PLAYERS = [41, 53, 57, 61];
const OPPONENTS = [34, 38, 57];
const TACTICS = [0, 1, 2];
const MAX_TICKS = 90000;
// A fixed 3-vs-3 so team play (allies, focus, support targets) is measured too.
const TEAM_PLAYER = [41, 53, 57], TEAM_OPPONENT = [34, 38, 61];

function individual(id, species, personality, rngSeed, tactic) {
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  profile.fields['018'] = personality;
  return {instanceId: id, nativeProfile: profile, tactic};
}

function runOne({player, opponent, tactic, seed}) {
  const mine = Array.isArray(player) ? player : [player], theirs = Array.isArray(opponent) ? opponent : [opponent];
  const runtime = createBattleRuntime({mode: 5, battleType: 0, seed, aiPolicy: 'IMPROVED_V1', personalityPolicy: 'ORIGINAL',
    taxonomyPolicy: 'TAXONOMY_V1', burstPolicy: 'OFF',
    // Same individuals and personalities for every plan: only the plan differs.
    playerIndividuals: mine.map((s, i) => individual('A' + i, s, (seed + i) % 8, 1000 + seed * 7 + i, tactic)),
    opponentIndividuals: theirs.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, 2000 + seed * 7 + i, 1))});
  try {
    runtime.choosePracticeBattle({arenaIndex: 2});
    const source = runtime.startMatch();
    let ticks = 0;
    for (; ticks < MAX_TICKS && !source.getView().outcome.ended; ticks++) source.tick();
    const view = source.getView();
    // The same record the result screen reads (runtime-internal tap).
    const record = runtime.getTacticRecord();
    return {player, opponent, tactic, seed, ticks, ended: view.outcome.ended, ...record};
  } finally { runtime.dispose(); }
}

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const runs = [];
for (const player of PLAYERS) for (const opponent of OPPONENTS) for (const tactic of TACTICS)
  for (let seed = 1; seed <= SEEDS; seed++) runs.push({scenario: 'SINGLE', ...runOne({player, opponent, tactic, seed})});
for (const tactic of TACTICS) for (let seed = 1; seed <= SEEDS * 2; seed++)
  runs.push({scenario: 'TEAM', ...runOne({player: TEAM_PLAYER, opponent: TEAM_OPPONENT, tactic, seed}), player: 'TEAM', opponent: 'TEAM'});

function aggregate(rows) {
  const me = rows.flatMap(r => r.local).filter(Boolean);
  return {
    runs: rows.length,
    winRate: mean(rows.map(r => r.outcome === 'WIN' ? 1 : 0)),
    seconds: mean(rows.map(r => r.seconds)),
    normalShare: mean(me.map(m => m.share.normal)),
    skillShare: mean(me.map(m => m.share.skill)),
    supportShare: mean(me.map(m => m.share.support)),
    skillsUsed: mean(me.map(m => m.counts.skill)),
    spSpent: mean(me.map(m => m.spSpent)),
    spEmptySeconds: mean(me.map(m => m.spEmptySeconds)),
    damageDealtRatio: mean(me.map(m => m.damageDealtRatio)),
    hpLeftRatio: mean(me.map(m => m.hpLeftRatio)),
    launches: mean(me.map(m => m.total)),
    repositionShare: mean(me.map(m => m.decisions?.total ? m.decisions.reposition / m.decisions.total : 0)),
    firstSkillAt: mean(me.map(m => m.firstSkillAt).filter(x => x !== null))
  };
}
const single = runs.filter(r => r.scenario === 'SINGLE'), team = runs.filter(r => r.scenario === 'TEAM');
const byTactic = Object.fromEntries(TACTICS.map(t => [t, aggregate(single.filter(r => r.tactic === t))]));
const teamByTactic = Object.fromEntries(TACTICS.map(t => [t, aggregate(team.filter(r => r.tactic === t))]));
const cells = [];
for (const player of PLAYERS) for (const opponent of OPPONENTS) {
  const row = {player, opponent};
  for (const t of TACTICS) row[t] = aggregate(single.filter(r => r.player === player && r.opponent === opponent && r.tactic === t));
  // Does any single plan win every cell? Then the plan is a fixed answer.
  row.best = TACTICS.reduce((b, t) => row[t].winRate > row[b].winRate ? t : b, 1);
  cells.push(row);
}
const unended = runs.filter(r => !r.ended).length;
const summary = {generated: new Date().toISOString(), seeds: SEEDS, players: PLAYERS, opponents: OPPONENTS, unended, byTactic, teamByTactic, cells};
const pct = x => `${Math.round(x * 100)}%`;
console.log(`runs ${runs.length}, unended ${unended}`);
const line = (label, a) => console.log(`${label}: win ${pct(a.winRate)}  ${a.seconds.toFixed(1)} s  launches ${a.launches.toFixed(1)}  reposition ${pct(a.repositionShare)}  normal ${pct(a.normalShare)} skill ${pct(a.skillShare)} support ${pct(a.supportShare)}  skills ${a.skillsUsed.toFixed(1)} (first ${a.firstSkillAt.toFixed(1)} s)  SP ${a.spSpent.toFixed(1)}  SP-empty ${a.spEmptySeconds.toFixed(1)} s  dealt ${pct(a.damageDealtRatio)}  hp-left ${pct(a.hpLeftRatio)}`);
for (const t of TACTICS) line(`single plan ${t}`, byTactic[t]);
for (const t of TACTICS) line(`team   plan ${t}`, teamByTactic[t]);
for (const c of cells) console.log(`P${c.player} vs ${c.opponent}: ` + TACTICS.map(t => `${t}=${pct(c[t].winRate)}/${c[t].seconds.toFixed(0)}s/sk${c[t].skillsUsed.toFixed(1)}`).join('  ') + `  best ${c.best}`);
// Compact rows (one per local partner per run) keep the committed file small.
const columns = ['scenario', 'player', 'opponent', 'tactic', 'seed', 'outcome', 'seconds', 'launches', 'normal', 'skill', 'support',
  'decisions', 'reposition', 'firstSkillAt', 'spEmptySeconds', 'hpLeftRatio'];
const rows = runs.flatMap(r => r.local.map(m => [r.scenario, r.player, r.opponent, r.tactic, r.seed, r.outcome, r.seconds, m.total,
  m.counts.normal, m.counts.skill, m.counts.support, m.decisions?.total ?? null, m.decisions?.reposition ?? null, m.firstSkillAt,
  m.spEmptySeconds, Math.round(m.hpLeftRatio * 1000) / 1000]));
if (OUT) { mkdirSync(OUT, {recursive: true}); writeFileSync(join(OUT, 'measurement.json'), JSON.stringify({summary, columns, rows})); console.log(`wrote ${join(OUT, 'measurement.json')}`); }
