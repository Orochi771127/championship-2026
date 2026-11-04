// Data Arena entry rights and telemetry routing (OWNER_APPROVED_ADAPTATION 2026-11-02).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dataArenaEntries, dataArenaPartnerPower, dataArenaEntryUsable, DATA_ARENA_ENTRY } from "../src/championship/modes/dataArena/dataArenaEligibility.js";
import { createDataArenaSimulation } from "../src/championship/modes/dataArena/dataArenaSimulation.js";
import { RELAY_ROSTER } from "../src/championship/modes/dataArena/dataArenaRelayRoster.js";
import { DATA_ARENA_PARTNERS } from "../src/championship/modes/dataArena/dataArenaConfig.js";

const relay = RELAY_ROSTER.map(({ id, speciesId }) => ({ id, speciesId }));
const legacy = DATA_ARENA_PARTNERS.map(({ id, speciesId }) => ({ id, speciesId }));
const index = (speciesId) => Number(speciesId.slice(8));

test("only partners raised or registered in the Dex may enter; raised ones lead the list", () => {
  const registered = [index(relay[5].speciesId), index(relay[9].speciesId), index(relay[12].speciesId)];
  const rows = dataArenaEntries(relay, { registeredSpecies: registered, ownedSpecies: [relay[12].speciesId],
    ownedInstances: [{ speciesId: relay[12].speciesId, instanceId: "championship:2026:instance:0007" }] });
  assert.equal(rows.length, relay.length, "every roster partner is listed (locked ones as locked)");
  assert.equal(rows[0].id, relay[12].id);
  assert.equal(rows[0].entry, DATA_ARENA_ENTRY.BRED);
  assert.equal(rows[0].instanceId, "championship:2026:instance:0007", "a raised partner keeps its ranch individual");
  assert.equal(rows[1].instanceId, null, "a Dex-only partner has none");
  assert.deepEqual(rows.filter(dataArenaEntryUsable).map((row) => row.id), [relay[12].id, relay[5].id, relay[9].id]);
  assert.ok(rows.slice(3).every((row) => row.entry === DATA_ARENA_ENTRY.LOCKED));
  const power = dataArenaPartnerPower(rows);
  assert.equal(power[relay[12].id], 1.1);
  assert.equal(power[relay[5].id], 1);
  assert.equal(power[relay[40].id], undefined, "a locked partner has no power entry");
});

test("a thin save is lent practice partners up to 3 at 85 % so 3v3 Relay and every mode can start", () => {
  for (const roster of [relay, legacy]) {
    const rows = dataArenaEntries(roster, { registeredSpecies: [], ownedSpecies: ["species-000"] });
    const usable = rows.filter(dataArenaEntryUsable);
    assert.equal(usable.length, 3);
    assert.ok(usable.every((row) => row.entry === DATA_ARENA_ENTRY.RENTAL));
    assert.deepEqual(usable.map((row) => row.speciesId).sort(), ["species-034", "species-061", "species-064"]);
    assert.deepEqual(Object.values(dataArenaPartnerPower(rows)), [0.85, 0.85, 0.85]);
  }
  // Two registered partners: one loan tops the list up to three.
  const two = dataArenaEntries(relay, { registeredSpecies: [index(relay[30].speciesId), index(relay[31].speciesId)], ownedSpecies: [] });
  assert.deepEqual(two.filter(dataArenaEntryUsable).map((row) => row.entry), [DATA_ARENA_ENTRY.RENTAL, DATA_ARENA_ENTRY.REGISTERED, DATA_ARENA_ENTRY.REGISTERED]);
  // Three registered partners: no loan.
  const three = dataArenaEntries(relay, { registeredSpecies: [index(relay[30].speciesId), index(relay[31].speciesId), index(relay[32].speciesId)], ownedSpecies: [] });
  assert.ok(three.every((row) => row.entry !== DATA_ARENA_ENTRY.RENTAL));
});

test("a controlled harness without save progress keeps every partner open", () => {
  const rows = dataArenaEntries(legacy, null);
  assert.ok(rows.every((row) => row.entry === DATA_ARENA_ENTRY.REGISTERED));
});

test("entry power scales the partner's HP and damage, never the rivals", () => {
  const base = createDataArenaSimulation({ seed: 3, mode: "TOURNAMENT", partnerId: "ember-lizard" });
  const raised = createDataArenaSimulation({ seed: 3, mode: "TOURNAMENT", partnerId: "ember-lizard", partnerPower: { "ember-lizard": 1.1 } });
  const loan = createDataArenaSimulation({ seed: 3, mode: "TOURNAMENT", partnerId: "ember-lizard", partnerPower: { "ember-lizard": 0.85 } });
  const hp = (sim) => sim.getState().player.maxHp;
  assert.equal(hp(raised), Math.round(hp(base) * 1.1));
  assert.equal(hp(loan), Math.round(hp(base) * 0.85));
  assert.equal(raised.getState().rivals[0].maxHp, base.getState().rivals[0].maxHp);
  const relayIds = [relay[0].id, relay[1].id];
  const relaySim = createDataArenaSimulation({ seed: 3, mode: "RELAY", partnerId: relayIds[0], relayReserveId: relayIds[1], partnerPower: { [relayIds[1]]: 1.1 } });
  const plain = createDataArenaSimulation({ seed: 3, mode: "RELAY", partnerId: relayIds[0], relayReserveId: relayIds[1] });
  assert.equal(relaySim.getState().relay.team[1].maxHp, Math.round(plain.getState().relay.team[1].maxHp * 1.1));
  assert.equal(relaySim.getState().relay.team[0].maxHp, plain.getState().relay.team[0].maxHp);
});

test("the arena screen draws no native select and keeps combat words off the field", () => {
  const screen = fs.readFileSync("src/championship/app/dataArenaScreen.js", "utf8");
  assert.doesNotMatch(screen, /el\(\s*['"]select['"]/, "no native <select> is created");
  assert.doesNotMatch(screen, /da-toast\b/, "the boxed toast pool is gone");
  assert.match(screen, /TACTICAL_MERGE_MS = 1800/);
  assert.match(screen, /kitKey\(touchActive/, "kit labels follow the input device");
  const scene = fs.readFileSync("src/championship/presentation/dataArena/dataArenaPixiScene.js", "utf8");
  assert.match(scene, /function floatText\(/);
  assert.match(scene, /x: \(near % 2 \? 14 : -14\)/, "repeat spawns step aside");
  const css = fs.readFileSync("src/championship/app/dataArena.css", "utf8");
  assert.match(css, /\.da-tactical \{[^}]*top:calc\(max\(8px, env\(safe-area-inset-top\)\) \+ 100px\); height:24px/);
  assert.match(css, /\.da-boss \{[^}]*height:26px/);
});
