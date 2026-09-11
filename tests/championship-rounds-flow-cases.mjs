import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { NATIVE_CHAMPIONSHIP_CATEGORIES } from "../src/championship/battle/nativeChampionshipRounds.js";
import { BATTLE_OUTCOME_TEAM_ZERO_AHEAD, BATTLE_OUTCOME_TEAM_ONE_AHEAD } from "../src/championship/battle/battleOutcome.js";

// OVL19 0210E280: on the ordinary battle types a round is won on verdict 4.
const WON = { verdict: BATTLE_OUTCOME_TEAM_ZERO_AHEAD };
const LOST = { verdict: BATTLE_OUTCOME_TEAM_ONE_AHEAD };

const catalog = JSON.parse(fs.readFileSync("src/data/championship/catalogs/creature-species.r1.json", "utf8"));
const presentation = JSON.parse(fs.readFileSync("docs/contracts/championship/raising-home-presentation.v1.json", "utf8"));
const rounds = JSON.parse(fs.readFileSync("docs/research/CHAMPIONSHIP_ROUNDS_2026-09-10.json", "utf8"));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    keys() { return [...data.keys()]; }
  };
}

const appFor = (storage) => createChampionshipStandaloneApp({
  storage, catalog, cages: presentation.cages, now: () => "2026-09-05T10:00:00.000Z"
});

/**
 * A save that has already reached the stage a tournament needs. Winning through
 * sixty-one title matches is the normal route and is covered elsewhere; this
 * suite is about what happens once a run is open.
 */
async function appAtStage(storage, { stage, entry = 1, worldEntry = 0, run } = {}) {
  const seed = appFor(storage);
  await seed.newGame();
  seed.save();
  const save = JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  save.progression.nativeTitles = { ...save.progression.nativeTitles, championship: { stage, entry, worldEntry } };
  if (run !== undefined) save.progression.championshipRun = run;
  storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = appFor(storage);
  await app.continueGame();
  return app;
}

test("the descriptor rounds and prizes the port ships are the ones the ROM table holds", () => {
  assert.equal(NATIVE_CHAMPIONSHIP_CATEGORIES[0].rounds, rounds.descriptors.championship.rounds);
  assert.equal(NATIVE_CHAMPIONSHIP_CATEGORIES[0].prize, rounds.descriptors.championship.prize);
  assert.equal(NATIVE_CHAMPIONSHIP_CATEGORIES[1].rounds, rounds.descriptors.world.rounds);
  assert.equal(NATIVE_CHAMPIONSHIP_CATEGORIES[1].prize, rounds.descriptors.world.prize);
});

test("a tournament refuses to open until its stage is reached and its entry is taken", async () => {
  const fresh = appFor(memoryStorage());
  await fresh.newGame();
  assert.deepEqual(fresh.getChampionshipCategories().map((c) => c.unlocked), [false, false]);
  assert.equal(fresh.beginChampionship(0).reason, "CHAMPIONSHIP_LOCKED");
  assert.equal(fresh.getChampionshipRun(), null);

  const unentered = await appAtStage(memoryStorage(), { stage: 1, entry: 0 });
  assert.equal(unentered.beginChampionship(0).reason, "CHAMPIONSHIP_NOT_ENTERED");
  // The World tournament needs its own stage, not the Championship's.
  assert.equal(unentered.beginChampionship(1).reason, "CHAMPIONSHIP_LOCKED");
  assert.equal(unentered.beginChampionship(7).reason, "UNKNOWN_CATEGORY");
});

test("a clean sweep pays the descriptor prize once and moves the championship stage", async () => {
  const app = await appAtStage(memoryStorage(), { stage: 1 });
  const wallet = app.getShopFrame().bits;
  const opened = app.beginChampionship(0);
  assert.equal(opened.ok, true);
  assert.equal(opened.run.totalRounds, 3);
  assert.equal(app.beginChampionship(0).reason, "CHAMPIONSHIP_ALREADY_RUNNING");

  for (let round = 0; round < 3; round += 1) {
    const run = app.getChampionshipRun();
    assert.equal(run.round, round);
    assert.equal(run.finalRound, round === 2);
    const drawn = app.drawChampionshipOpponent();
    assert.equal(drawn.ok, true);
    assert.equal(drawn.opponent.round, round);
    assert.equal(drawn.opponent.poolSize, NATIVE_CHAMPIONSHIP_CATEGORIES[0].poolSizes[round]);
    assert.ok(drawn.opponent.index < drawn.opponent.poolSize);
    const recorded = app.recordChampionshipRound(WON);
    assert.equal(recorded.won, true);
    assert.equal(recorded.complete, round === 2);
  }
  assert.equal(app.drawChampionshipOpponent().reason, "CHAMPIONSHIP_ALREADY_ENDED");

  const settled = app.settleChampionship();
  assert.equal(settled.ok, true);
  assert.equal(settled.payable, true);
  assert.equal(settled.prize, 50000);
  assert.deepEqual([...settled.flags], [1, 1, 1]);
  assert.equal(settled.championship.stage, 2);
  assert.equal(app.getShopFrame().bits, wallet + 50000);
  assert.equal(app.getChampionshipRun(), null);
  assert.equal(app.settleChampionship().reason, "NO_CHAMPIONSHIP_RUNNING");
  // Winning the Championship is what opens the World tournament.
  assert.deepEqual(app.getChampionshipCategories().map((c) => c.unlocked), [true, true]);
});

test("a lost round ends the run where it stands and pays nothing", async () => {
  const app = await appAtStage(memoryStorage(), { stage: 1 });
  const wallet = app.getShopFrame().bits;
  app.beginChampionship(0);
  assert.equal(app.recordChampionshipRound(WON).complete, false);
  const lost = app.recordChampionshipRound(LOST);
  assert.equal(lost.won, false);
  assert.equal(lost.complete, true);
  assert.equal(lost.payable, false);
  assert.equal(app.recordChampionshipRound(WON).reason, "CHAMPIONSHIP_ALREADY_ENDED");

  const settled = app.settleChampionship();
  assert.equal(settled.ok, true);
  assert.equal(settled.payable, false);
  assert.equal(settled.prize, 0);
  assert.deepEqual([...settled.flags], [1, 0]);
  assert.equal(app.getShopFrame().bits, wallet);
  // The stage only moves on a clean sweep.
  assert.equal(settled.championship.stage, 1);
});

test("a run survives Save and Continue, and settles on the other side", async () => {
  const storage = memoryStorage();
  const app = await appAtStage(storage, { stage: 1 });
  app.beginChampionship(0);
  app.recordChampionshipRound(WON);
  app.save();

  const resumed = appFor(storage);
  await resumed.continueGame();
  const run = resumed.getChampionshipRun();
  assert.equal(run.category, 0);
  assert.equal(run.round, 1);
  assert.deepEqual([...run.flags], [1]);
  assert.equal(run.continues, true);

  resumed.recordChampionshipRound(WON);
  resumed.recordChampionshipRound(WON);
  const settled = resumed.settleChampionship();
  assert.equal(settled.payable, true);
  assert.equal(settled.prize, 50000);
});

test("the World tournament runs its own five rounds off its own stage", async () => {
  const app = await appAtStage(memoryStorage(), { stage: 2, entry: 0, worldEntry: 1 });
  assert.equal(app.beginChampionship(0).reason, "CHAMPIONSHIP_NOT_ENTERED");
  const opened = app.beginChampionship(1);
  assert.equal(opened.ok, true);
  assert.equal(opened.run.totalRounds, 5);
  for (let round = 0; round < 5; round += 1) {
    assert.equal(app.drawChampionshipOpponent().opponent.poolSize,
      NATIVE_CHAMPIONSHIP_CATEGORIES[1].poolSizes[round]);
    app.recordChampionshipRound(WON);
  }
  const settled = app.settleChampionship();
  assert.equal(settled.prize, 300000);
  assert.equal(settled.championship.stage, 3);
});

test("a round is fought as an ordinary battle attempt, and its verdict writes the flag", async () => {
  const app = await appAtStage(memoryStorage(), { stage: 1 });
  const wallet = app.getShopFrame().bits;
  app.openBattle(); app.openChampionship();
  app.beginChampionship(0);

  const entered = app.enterChampionshipRound({ attemptId: "battle:1" });
  assert.equal(entered.ok, true);
  assert.equal(entered.round, 0);
  assert.equal(entered.opponent.poolSize, NATIVE_CHAMPIONSHIP_CATEGORIES[0].poolSizes[0]);
  // The descriptor carries no entry fee, so entering a round costs nothing.
  assert.equal(app.getShopFrame().bits, wallet);
  assert.equal(app.getScreen(), "BATTLE_FIELD");
  // The run does not advance until the battle says so.
  assert.deepEqual([...app.getChampionshipRun().flags], []);
  assert.equal(app.enterChampionshipRound({ attemptId: "battle:2" }).reason, "BATTLE_ATTEMPT_ACTIVE");

  const finished = app.finishMatch({ attemptId: "battle:1", ended: true, mode: 0, battleType: 0,
    matchIndex: 0, outcomeEntries: [1] });
  assert.equal(finished.ok, true);
  assert.deepEqual([...app.getChampionshipRun().flags], [1]);
  assert.equal(app.getChampionshipRun().round, 1);
  // A round pays nothing on its own; the prize is the run's.
  assert.equal(app.getShopFrame().bits, wallet);
  // And it is not a title on its own either.
  assert.equal(app.getTitleProgress().championship.stage, 1);
});

test("losing a fought round ends the run and refuses another", async () => {
  const app = await appAtStage(memoryStorage(), { stage: 1 });
  app.openBattle(); app.openChampionship();
  app.beginChampionship(0);
  app.enterChampionshipRound({ attemptId: "battle:1" });
  app.finishMatch({ attemptId: "battle:1", ended: true, mode: 0, battleType: 0,
    matchIndex: 0, outcomeEntries: [0] });
  const run = app.getChampionshipRun();
  assert.deepEqual([...run.flags], [0]);
  assert.equal(run.continues, false);
  app.exitBattle();
  assert.equal(app.enterChampionshipRound({ attemptId: "battle:2" }).reason, "CHAMPIONSHIP_ALREADY_ENDED");
  assert.equal(app.settleChampionship().payable, false);
});

test("a tournament without a run refuses to start a round", async () => {
  const app = await appAtStage(memoryStorage(), { stage: 1 });
  app.openBattle(); app.openChampionship();
  assert.equal(app.enterChampionshipRound({ attemptId: "battle:1" }).reason, "NO_CHAMPIONSHIP_RUNNING");
});
