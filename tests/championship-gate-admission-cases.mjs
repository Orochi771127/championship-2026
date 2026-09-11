import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { evaluateGateFee, isGateUnlocked } from "../src/championship/gate/gateAdmission.js";
import gateTable from "../src/data/championship/catalogs/gate-table.r1.json" with { type: "json" };
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { createGateHuntPresentationSource } from "../src/championship/app/gateHuntPresentationSource.js";
import { createHuntRuntime } from "../src/championship/hunt/huntRuntime.js";
import { getMatchRecord } from "../src/championship/battle/battleMatchSelection.js";

const oracle = JSON.parse(fs.readFileSync("docs/research/GATE_ADMISSION_CPU_CHECK_2026-09-08.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const cages = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8")).cages;
function storage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k), keys: () => [...data.keys()] };
}
const make = (overrides = {}) => createChampionshipStandaloneApp({ catalog, cages, storage: storage(),
  rngClock: () => ({ hour:13, minute:20, second:50 }), ...overrides });
function configure(app, biome = "Canyon") {
  app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === biome).gateId); app.confirmGate();
}

test("Gate fee decisions and balances match 158 original CPU cases", () => {
  for (const row of oracle.feeCases) {
    const result = evaluateGateFee(gateTable.records[row.recordIndex].entranceFeeBits, row.bits, row.waiver !== 0);
    assert.equal(result.canEnter, row.accepted);
    assert.equal(result.afterBits, row.afterBits);
  }
});

test("Gate initial visibility and rank/result unlocks match original CPU and table", () => {
  for (const row of gateTable.records) {
    const raw = oracle.records[row.recordIndex];
    assert.equal(row.unlockKind, raw.unlockKind);
    assert.equal(row.unlockParameter, raw.unlockParameter);
    assert.equal(isGateUnlocked(row), oracle.initialVisibility[row.recordIndex] !== 0);
  }
  for (const c of oracle.unlockCases) {
    const revealed = gateTable.records.filter(g => {
      const rankCrossed = g.unlockKind === 1 && !isGateUnlocked(g, {tamerRank:c.oldRank}) && isGateUnlocked(g, {tamerRank:c.newRank});
      const battleWon = g.unlockKind === 2 && isGateUnlocked(g, {battleBadges:c.won ? [c.matchIndex] : []});
      return rankCrossed || battleWon;
    }).map(g => g.recordIndex);
    assert.deepEqual(revealed, c.revealed);
  }
});

test("rank zero exposes Grass admission; locked previews cannot bypass confirmation", async () => {
  const app = make(); await app.newGame();
  try {
    assert.deepEqual(app.getGates().filter(g => g.state === "AVAILABLE").map(g => g.biomeId), ["Grass"]);
    app.creditBits(10000); configure(app);
    assert.equal(app.getScreen(), "GATE_SELECT");
    assert.equal(app.getGateAdmission().reason, "GATE_LOCKED");
    await app.beginHunt(); assert.equal(app.getHuntRuntime(), null);
    assert.equal(app.getShopFrame().bits, 10000);
  } finally { await app.dispose(); }
});

test("insufficient fee refuses before RNG, history, clock, runtime or wallet mutation", async () => {
  let calls = 0;
  const app = make({huntRuntimeFactory: opts => { calls++; return createHuntRuntime(opts); }});
  await app.newGame();
  try {
    app.setTamerRank(3); app.creditBits(449); configure(app);
    const before = [app.getGameplayRngState(), app.getHuntPersistentState(), app.getSnapshot()];
    const source = createGateHuntPresentationSource(app);
    assert.equal(source.getFrame().huntLoadout.canBegin, false);
    await app.beginHunt();
    assert.equal(app.getScreen(), "HUNT_LOADOUT"); assert.equal(calls, 0);
    assert.equal(app.getHuntEntryError(), "INSUFFICIENT_FUNDS");
    assert.deepEqual([app.getGameplayRngState(), app.getHuntPersistentState(), app.getSnapshot()], before);
    assert.equal(app.getShopFrame().bits, 449);
  } finally { await app.dispose(); }
});

test("selection and cancellation cost nothing; actual paid entry debits once and survives Continue", async () => {
  const disk = storage(), app = make({storage:disk}); await app.newGame();
  let restored;
  try {
    app.setTamerRank(3); app.creditBits(900); configure(app);
    app.leaveScreen(); app.leaveScreen(); assert.equal(app.getShopFrame().bits, 900);
    configure(app); await app.beginHunt();
    assert.equal(app.getScreen(), "HUNT_FIELD"); assert.equal(app.getShopFrame().bits, 450);
    await app.beginHunt(); assert.equal(app.getShopFrame().bits, 450);
    app.exitHunt(); assert.equal(app.getShopFrame().bits, 450);
    assert.equal(app.save().phase, "SAVED");
    restored = make({storage:disk}); await restored.continueGame();
    assert.equal(restored.getShopFrame().bits, 450); assert.equal(restored.getTamerRank(), 3);
    configure(restored); await restored.beginHunt();
    assert.equal(restored.getScreen(), "HUNT_FIELD"); assert.equal(restored.getShopFrame().bits, 0);
    restored.exitHunt(); configure(restored); await restored.beginHunt();
    assert.equal(restored.getScreen(), "HUNT_LOADOUT");
    assert.equal(disk.keys().length, 1);
  } finally { await app.dispose(); await restored?.dispose(); }
});

test("free Grass works with zero Bits; runtime construction failure never charges", async () => {
  const app = make(); await app.newGame();
  try { configure(app, "Grass"); await app.beginHunt(); assert.equal(app.getScreen(), "HUNT_FIELD"); assert.equal(app.getShopFrame().bits, 0); }
  finally { await app.dispose(); }
  const broken = make({huntRuntimeFactory: () => {throw Error("TEST_RUNTIME_FAILURE");}});
  await broken.newGame();
  try {
    broken.setTamerRank(3); broken.creditBits(450); configure(broken);
    const before = [broken.getGameplayRngState(), broken.getHuntPersistentState(), broken.getSnapshot()];
    await broken.beginHunt();
    assert.equal(broken.getHuntEntryError(), "TEST_RUNTIME_FAILURE");
    assert.equal(broken.getShopFrame().bits, 450); assert.equal(broken.getScreen(), "HUNT_LOADOUT");
    assert.deepEqual([broken.getGameplayRngState(), broken.getHuntPersistentState(), broken.getSnapshot()], before);
  } finally { await broken.dispose(); }
});

test("wallet observers see a committed Hunt and cannot reenter or change the fee transaction", async () => {
  const app = make(); await app.newGame();
  try {
    app.setTamerRank(3); app.creditBits(450); configure(app);
    const observations = [];
    const refusals = [];
    const unsub = app.subscribeShop(() => {
      observations.push([app.getScreen(), !!app.getHuntRuntime(), app.getShopFrame().bits]);
      // Not awaited: the re-entrancy refusal is synchronous, and awaiting in
      // this observer would change what it records.
      app.beginHunt(); app.leaveScreen();
      for (const attempt of [()=>app.creditBits(10),()=>app.setTamerRank(0),()=>app.save()]) {
        try { attempt(); refusals.push(null); } catch (error) { refusals.push(error.message); }
      }
    });
    await app.beginHunt(); unsub();
    assert.deepEqual(observations, [["HUNT_FIELD", true, 0]]);
    assert.equal(refusals.length,3);
    assert.match(refusals[0],/HUNT_TRANSACTION_ACTIVE/);assert.match(refusals[1],/HUNT_TRANSACTION_ACTIVE/);assert.match(refusals[2],/HUNT_COMMIT_ACTIVE/);
    assert.equal(app.getScreen(), "HUNT_FIELD"); assert.equal(app.getShopFrame().bits, 0);
  } finally { await app.dispose(); }
});

for (const [matchIndex,biome] of [[7,"Ice"],[45,"Factory"],[46,"Jungle"]]) {
  test(`ordinary match ${matchIndex} victory unlocks ${biome} and survives duplicate results and Continue`,async()=>{
    const disk=storage(),app=make({storage:disk});await app.newGame();let restored;
    try {
      const match=getMatchRecord(matchIndex);
      app.setTamerRank(match.field10*2);
      app.advanceClock({units:(match.field14*8+match.field18)*1440*400});
      app.creditBits(100000);
      const gate=()=>app.getGates().find(g=>g.biomeId===biome);
      assert.equal(gate().state,"LOCKED");
      app.openBattle();const attempt=await app.enterMatch({recordIndex:matchIndex,mode:1,battleType:0});assert.equal(attempt.ok,true);
      const result={attemptId:attempt.attempt.attemptId,ended:true,mode:1,battleType:0,matchIndex,outcomeEntries:[1]};
      app.finishMatch(result);assert.equal(gate().state,"AVAILABLE");assert.deepEqual(app.getBattleBadges(),[matchIndex]);
      app.finishMatch(result);assert.deepEqual(app.getBattleBadges(),[matchIndex]);
      app.exitBattle();assert.equal(app.save().phase,"SAVED");
      restored=make({storage:disk});await restored.continueGame();
      assert.equal(restored.getGates().find(g=>g.biomeId===biome).state,"AVAILABLE");
      assert.deepEqual(restored.getBattleBadges(),[matchIndex]);
      assert.equal(disk.keys().length,1);
    } finally {await app.dispose();await restored?.dispose();}
  });
}

test('the final title victory grants the original gate waiver and actual paid-biome entry retains it across Continue',async()=>{
  const disk=storage();let app=make({storage:disk});await app.newGame();app.save();await app.dispose();
  // A controlled save supplies the first 60 wins. The final win uses the normal
  // admission/result transaction, including its own duplicate-result guard.
  const key=disk.keys()[0],save=JSON.parse(disk.getItem(key)),last=60;
  save.progression.tamerRank=8;save.progression.battleBadges=Array.from({length:60},(_,i)=>i);
  save.progression.nativeTitles.registered=[last];disk.setItem(key,JSON.stringify(save));
  app=make({storage:disk});await app.continueGame();
  const match=getMatchRecord(last);app.advanceClock({units:(match.field14*8+match.field18)*1440*400});app.creditBits(100000);
  app.openBattle();const entry=await app.enterMatch({recordIndex:last,mode:1,battleType:0});assert.equal(entry.ok,true);
  const result={attemptId:entry.attempt.attemptId,ended:true,mode:1,battleType:0,matchIndex:last,outcomeEntries:[1]};
  app.finishMatch(result);app.finishMatch(result);assert.equal(app.getTamerRank(),9);app.exitBattle();app.save();
  assert.equal(JSON.parse(disk.getItem(key)).progression.nativeTitles.feeWaiver,true);
  await app.dispose();app=make({storage:disk});await app.continueGame();
  configure(app);const before=app.getShopFrame().bits;
  assert.equal(app.getGateAdmission().chargeBits,0);await app.beginHunt();
  assert.equal(app.getScreen(),'HUNT_FIELD');assert.equal(app.getShopFrame().bits,before);
  app.exitHunt();app.save();assert.equal(JSON.parse(disk.getItem(key)).progression.nativeTitles.feeWaiver,true);await app.dispose();
});
