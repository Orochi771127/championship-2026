import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NATIVE_CHAMPIONSHIP_CATEGORIES, CHAMPIONSHIP_ARENA_INDEX, nativeChampionshipCategory,
  createNativeChampionshipRun, normalizeNativeChampionshipRun, nativeChampionshipFinalRound,
  nativeChampionshipContinues, recordNativeChampionshipRound, nativeChampionshipPayable,
  nativeChampionshipPoolSize, selectNativeChampionshipOpponent }
  from "../src/championship/battle/nativeChampionshipRounds.js";
import { settleOwnedBattleIndividual } from "../src/championship/battle/battleParty.js";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
function makeApp() {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k), keys: () => [...data.keys()] };
  return createChampionshipStandaloneApp({ storage, catalog, cages: presentation.cages,
    now: () => "2026-09-05T10:00:00.000Z" });
}

const receipt = JSON.parse(fs.readFileSync("docs/research/CHAMPIONSHIP_ROUNDS_2026-09-10.json", "utf8"));
// 0210DF9C judges team 0 ahead as verdict 4; type 0 wins on exactly that.
const WIN = { verdict: 4, battleType: 0 };
const LOSS = { verdict: 3, battleType: 0 };
const playRun = (category, results) => results.reduce(
  (run, result) => recordNativeChampionshipRound(run, result).run, createNativeChampionshipRun(category));

test("the category table carries what the ROM descriptors say", () => {
  assert.equal(NATIVE_CHAMPIONSHIP_CATEGORIES.length, Object.keys(receipt.descriptors).length);
  for (const record of NATIVE_CHAMPIONSHIP_CATEGORIES) {
    const source = receipt.descriptors[record.id === "CHAMPIONSHIP" ? "championship" : "world"];
    assert.equal(record.rounds, source.rounds);
    assert.equal(record.prize, source.prize);
    assert.equal(record.descriptor, source.descriptor);
    const pools = receipt.opponentSelection.categories[record.id === "CHAMPIONSHIP" ? "championship" : "world"];
    assert.deepEqual([...record.poolSizes], pools.rounds.map((entry) => entry.poolSize));
    assert.equal(record.poolSizes.length, record.rounds);
  }
  assert.equal(CHAMPIONSHIP_ARENA_INDEX, 10);
  assert.throws(() => nativeChampionshipCategory(2), /UNKNOWN_CATEGORY/);
});

test("a clean sweep of every round is the only way a run pays", () => {
  for (const record of NATIVE_CHAMPIONSHIP_CATEGORIES) {
    const swept = playRun(record.category, Array.from({ length: record.rounds }, () => WIN));
    assert.equal(swept.cursor, record.rounds);
    assert.deepEqual([...swept.flags], Array.from({ length: record.rounds }, () => 1));
    assert.equal(nativeChampionshipPayable(swept), true);
    assert.equal(nativeChampionshipContinues(swept), false);
    // Winning every round but the last still pays nothing.
    const stumbled = playRun(record.category,
      [...Array.from({ length: record.rounds - 1 }, () => WIN), LOSS]);
    assert.equal(nativeChampionshipPayable(stumbled), false);
  }
});

test("a lost round ends the run where it stands instead of playing on", () => {
  const run = playRun(0, [WIN, LOSS]);
  assert.equal(run.cursor, 2);
  assert.deepEqual([...run.flags], [1, 0]);
  assert.equal(nativeChampionshipContinues(run), false);
  assert.equal(nativeChampionshipPayable(run), false);
  const step = recordNativeChampionshipRound(createNativeChampionshipRun(0), LOSS);
  assert.equal(step.won, false);
  assert.equal(step.complete, true);
  assert.equal(step.payable, false);
});

test("the final round is the one the cursor has reached total minus one", () => {
  let run = createNativeChampionshipRun(1);
  const seen = [];
  for (let round = 0; round < 5; round += 1) {
    seen.push(nativeChampionshipFinalRound(run));
    run = recordNativeChampionshipRound(run, WIN).run;
  }
  assert.deepEqual(seen, [false, false, false, false, true]);
  assert.equal(nativeChampionshipCategory(1).rounds, 5);
});

test("a run survives being written out and read back, and refuses impossible state", () => {
  const run = playRun(1, [WIN, WIN]);
  assert.deepEqual(normalizeNativeChampionshipRun(JSON.parse(JSON.stringify(run))), run);
  assert.throws(() => normalizeNativeChampionshipRun({ category: 0, cursor: 4 }), /CURSOR_OUT_OF_RANGE/);
  assert.throws(() => normalizeNativeChampionshipRun({ category: 0, flags: [1, 1, 1, 1] }), /FLAGS_LONGER/);
  assert.throws(() => normalizeNativeChampionshipRun({ category: 0, flags: [2] }), /FLAG_MUST_BE_0_OR_1/);
  assert.throws(() => recordNativeChampionshipRound(playRun(0, [WIN, WIN, WIN]), WIN), /RUN_ALREADY_COMPLETE/);
});

test("all 824 original draw prefixes select the initialized team's existing presets on channel zero", () => {
  assert.deepEqual([0, 1, 2].map((round) => nativeChampionshipPoolSize(0, round)), [6, 6, 4]);
  assert.deepEqual([0, 1, 2, 3, 4].map((round) => nativeChampionshipPoolSize(1, round)), [4, 3, 2, 2, 1]);
  assert.throws(() => nativeChampionshipPoolSize(0, 3), /ROUND_OUT_OF_RANGE/);
  const drawn = selectNativeChampionshipOpponent({ category: 1, round: 1, nextChannel: () => 7 });
  assert.equal(drawn.poolSize, 3);
  assert.equal(drawn.index, 1);            // 7 % 3
  assert.throws(() => selectNativeChampionshipOpponent({ category: 0, round: 0 }), /REQUIRES_RNG/);
  const source=JSON.parse(fs.readFileSync('docs/research/CHAMPIONSHIP_POOLS_CPU_2026-09-10.json','utf8'));
  assert.equal(source.draws.length,824);
  for(const row of source.draws){const channels=[];
    const result=selectNativeChampionshipOpponent({category:row.category,round:row.round,nextChannel:channel=>{channels.push(channel);return row.roll;}});
    assert.equal(result.teamIndex,row.teamIndex);assert.deepEqual([...result.presets],row.presets);assert.deepEqual(channels,row.channels);}
  assert.equal(receipt.opponentSelection.poolsContiguous, true);
});

test("winning a round that is not the last restores the original share of HP and TP", () => {
  const profile = { fields: { '000': 20, '014': 0, '020': 0, '024': 0, '028': 0, '040': 0,
      '050': 40, '054': 20, '058': 300, '05c': 200 }, narrowFields: { '044': 1, '046': 1 } };
  // The cursor here is the one 0210E394 leaves behind: rounds completed, not the
  // index just played. After the last round of three it reads 3, and the restore
  // is skipped because there is no next round to walk into.
  const mid = settleOwnedBattleIndividual(profile,
    { currentHp: 40, metricLimit: 20, verdict: 4, mode: 1, event: 0, cursor: 1, totalRounds: 3 });
  // 0210E5AC restores trunc(max/10)*3 of each, capped at the maximum.
  assert.equal(mid.fields['050'], 40 + Math.trunc(300 / 10) * 3);
  assert.equal(mid.fields['054'], 20 + Math.trunc(200 / 10) * 3);
  const last = settleOwnedBattleIndividual(profile,
    { currentHp: 40, metricLimit: 20, verdict: 4, mode: 1, event: 0, cursor: 3, totalRounds: 3 });
  assert.equal(last.fields['050'], 40);
  assert.equal(last.fields['054'], 20);
  // The single-match default must keep behaving exactly as it did before.
  const single = settleOwnedBattleIndividual(profile, { currentHp: 40, metricLimit: 20, verdict: 4, mode: 1 });
  assert.equal(single.fields['050'], 40);
});

test("the application reports both tournaments, each shut until its own stage", () => {
  const rows = makeApp().getChampionshipCategories();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.id, row.rounds, row.prize]),
    [["CHAMPIONSHIP", 3, 50000], ["WORLD", 5, 300000]]);
  for (const row of rows) {
    assert.equal(row.poolSizes.length, row.rounds);
    assert.equal(row.arenaIndex, CHAMPIONSHIP_ARENA_INDEX);
    // A new game has reached neither stage and has neither entry taken.
    assert.equal(row.unlocked, false);
    assert.equal(row.registered, false);
    assert.equal(row.active, false);
  }
  // The run itself is covered in championship-rounds-flow-cases.
});

test('tournament progress rejects missing wins, future flags and any result after a lost round',()=>{
  for(const value of [{category:0,cursor:3,flags:[]},{category:0,cursor:1,flags:[1,1]}])
    assert.throws(()=>normalizeNativeChampionshipRun(value),/FLAGS_CURSOR_MISMATCH/);
  assert.throws(()=>normalizeNativeChampionshipRun({category:0,cursor:2,flags:[0,1]}),/ROUNDS_AFTER_LOSS/);
  assert.throws(()=>recordNativeChampionshipRound(playRun(0,[LOSS]),WIN),/RUN_ALREADY_ENDED/);
});
