// BATTLE presentation boundary.
//
// The fact worth guarding hardest is that the screen shows only fields the ROM
// tracks. A HUD is where invented mechanics get in: an accuracy percentage or a
// damage number would look ordinary on screen and would be a claim the original
// does not support. These cases hold that line from the contract side and from
// the source side.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  BATTLE_PRESENTATION_BANDS,
  BATTLE_PRESENTATION_CONTRACT_VERSION,
  BATTLE_PRESENTATION_END_REASONS,
  BATTLE_PRESENTATION_VERDICTS,
  battleStandPosition,
  createBattlePresentationSource
} from "../src/championship/app/battlePresentationSource.js";

import {
  createBattleSession,
  createSessionCombatant,
  stepBattleSession
} from "../src/championship/battle/battleSession.js";

import {
  BATTLE_OUTCOME_TEAM_ZERO_AHEAD,
  BATTLE_OUTCOME_TIER_FRAMES,
  BATTLE_OUTCOME_TIME_LIMIT_FRAMES,
  battleTeamOfSlot
} from "../src/championship/battle/battleOutcome.js";

import { BATTLE_FRAME_SLOT_COUNT } from "../src/championship/battle/battleFrameLoop.js";
import { BATTLE_RNG_TRACED_MASTER_SEED, createChannelRng } from "../src/championship/battle/battleRngChannel.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "docs/contracts/championship/battle-field-presentation.v1.json"), "utf8"));

const fighter = (currentHp, extra = {}) => createSessionCombatant({
  state: 1, statePeriod: 0, currentHp, maxHp: 100, metricBase: 100, metricLimit: 60, ...extra
});

function sessionOf(hps, options = {}) {
  return createBattleSession({
    roster: hps.map((hp) => (hp === null ? null : fighter(hp))),
    rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED),
    ...options
  });
}

function sourceOf(hps, options = {}) {
  return createBattlePresentationSource({ session: sessionOf(hps), step: stepBattleSession, ...options });
}

test("the frame is 9:16 and the field band is exactly the 3:2 the arena art is drawn at", () => {
  assert.equal(contract.frame.aspect, "9:16");
  assert.equal(contract.frame.referenceWidth / contract.frame.referenceHeight, 9 / 16, "an exact 9:16, not an approximation of one");
  const field = contract.bands.find((band) => band.id === "FIELD");
  // A full-width band 0.375 of a 9:16 frame tall is 3:2. That is why the 1536x1024
  // arena renders need no crop and no regeneration.
  const width = 1;
  const height = field.height * (16 / 9);
  assert.equal(Number((width / height).toFixed(6)), 1.5);
  assert.equal(field.aspect, 1.5);
});

test("the bands tile the frame exactly once, with no gap and no overlap", () => {
  assert.equal(BATTLE_PRESENTATION_BANDS.length, 5);
  let cursor = 0;
  for (const band of BATTLE_PRESENTATION_BANDS) {
    assert.equal(Number(band.top.toFixed(6)), Number(cursor.toFixed(6)), `${band.id} starts where the last ended`);
    cursor += band.height;
  }
  assert.equal(Number(cursor.toFixed(6)), 1, "and together they are the whole frame");
  assert.deepEqual(BATTLE_PRESENTATION_BANDS.map((band) => band.id),
    ["CLOCK", "OPPONENT_HUD", "FIELD", "PLAYER_HUD", "EVENT_LOG"]);
});

test("the HUD bands carry the teams the roster init proves", () => {
  const opponent = BATTLE_PRESENTATION_BANDS.find((band) => band.id === "OPPONENT_HUD");
  const player = BATTLE_PRESENTATION_BANDS.find((band) => band.id === "PLAYER_HUD");
  assert.deepEqual([...opponent.slots], [3, 4, 5]);
  assert.deepEqual([...player.slots], [0, 1, 2]);
  for (const slot of player.slots) assert.equal(battleTeamOfSlot(slot), 0);
  for (const slot of opponent.slots) assert.equal(battleTeamOfSlot(slot), 1);
  assert.deepEqual([...contract.teams.player, ...contract.teams.opponent], [0, 1, 2, 3, 4, 5]);
});

test("every HUD field names a traced read site, and the invented ones are refused by name", () => {
  for (const [name, field] of Object.entries(contract.hudFields)) {
    assert.equal(field.evidence, "VERIFIED_BINARY", name);
    assert.match(field.site, /^OVL\d+:0x[0-9A-F]{8}$/, `${name} names a site`);
  }
  // The three the original does not have are recorded as deliberately absent,
  // so a later pass cannot add them believing they were an oversight.
  assert.deepEqual(Object.keys(contract.notShown).sort(),
    ["accuracy", "commandMenu", "damageNumbers", "note", "turnOrder"]);
  const shown = new Set(contract.bands.flatMap((band) => band.shows ?? []));
  for (const forbidden of ["accuracy", "hitChance", "damage", "turn"]) {
    assert.equal([...shown].some((entry) => entry.toLowerCase().includes(forbidden.toLowerCase())), false, forbidden);
  }
  // And the module itself carries no such identifier. Comments are stripped
  // first: the header explains WHY there is no accuracy field, and saying so is
  // the opposite of shipping one.
  const module = fs.readFileSync(path.join(root, "src/championship/app/battlePresentationSource.js"), "utf8");
  const code = module.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/\b(accuracy|hitChance|evasion|damageNumber|turnCount)\b/i.test(code), false);
  // The phrase wraps across comment lines, so the gap has to be allowed for.
  assert.match(module, /no accuracy, no damage number and no\s*\n\/\/ turn counter/, "but the header still says why");
});

test("the clock the screen shows is the traced one, and 7200 is not yet empty", () => {
  const source = sourceOf([100, 100, 100, 100, 100, 100]);
  const view = source.getView();
  assert.equal(view.clock.limit, BATTLE_OUTCOME_TIME_LIMIT_FRAMES);
  assert.equal(view.clock.tierFrames, BATTLE_OUTCOME_TIER_FRAMES);
  assert.equal(view.clock.frames, 0);
  assert.equal(view.clock.ratio, 1);

  for (let frame = 0; frame < 900; frame += 1) source.tick();
  const later = source.getView();
  assert.equal(later.clock.frames, 900);
  assert.equal(later.clock.tier, 1);
  assert.equal(later.clock.remaining, 6300);
  assert.equal(Number(later.clock.ratio.toFixed(4)), Number((6300 / 7200).toFixed(4)));
});

test("cyberspace has no common ring, and the frame says so", () => {
  const normal = sourceOf([100, 100, 100, 100, 100, 100], { arenaIndex: 0 }).getFrame();
  assert.equal(normal.arena.identifier, "BATTLE_NORMAL");
  assert.equal(normal.arena.field, "field_bm01_01");
  assert.equal(normal.arena.hasCommonLayer, true);

  const cyber = sourceOf([100, 100, 100, 100, 100, 100], { arenaIndex: 6 }).getFrame();
  assert.equal(cyber.arena.identifier, "BATTLE_CYBERSPACE");
  assert.equal(cyber.arena.field, "field_bm07_01");
  assert.equal(cyber.arena.hasCommonLayer, false, "string08 is empty on this record alone");

  // Exactly one of the eleven is the odd one out.
  const withoutCommon = contract.arenaArt.arenas.filter((entry) => entry.common === null);
  assert.deepEqual(withoutCommon.map((entry) => entry.identifier), ["BATTLE_CYBERSPACE"]);
  assert.equal(contract.arenaArt.arenas.length, 11);
});

test("no runtime art path is declared while the arena art is unpromoted", () => {
  assert.equal(contract.arenaArt.status, "NOT_PROMOTED");
  assert.equal(contract.arenaArt.runtimeSource, null);
  // The layer names are ROM identifiers, not file paths, so importing this
  // contract into src/ cannot smuggle in an art path. A path is what a loader
  // would accept: an asset extension, or a tree prefix.
  const values = [];
  (function collect(node) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (node && typeof node === "object") return Object.values(node).forEach(collect);
    if (typeof node === "string") values.push(node);
  })(contract);
  const offenders = values.filter((value) => /\.(png|webp|jpe?g|json)$/i.test(value) || /^(assets|docs|src)\//.test(value));
  assert.deepEqual(offenders, [], "no value in this contract is loadable as a path");
});

test("a combatant projects only what the battle modules already read", () => {
  const source = sourceOf([100, 50, null, 80, 0, -1]);
  const view = source.getView();
  assert.equal(view.combatants.length, BATTLE_FRAME_SLOT_COUNT);

  assert.equal(view.combatants[0].hp.ratio, 1);
  assert.equal(view.combatants[1].hp.ratio, 0.5);
  assert.equal(view.combatants[2].present, false);
  assert.equal(view.combatants[3].team, 1);
  assert.equal(view.combatants[0].resource.ratio, 0.6);

  // R8 resolver 02114FA4 handles exact zero immediately. State 23 is also used
  // by ordinary living hit reactions and is not a liveness marker.
  assert.equal(view.combatants[4].hp.current, 0);
  assert.equal(view.combatants[4].down, true, "zero HP is incapacitated, with revival still possible");
  assert.equal(view.combatants[5].down, true);
});

test("a zero maximum is nothing to draw rather than a full bar or a crash", () => {
  const session = createBattleSession({
    roster: [createSessionCombatant({ currentHp: 0, maxHp: 0, metricBase: 0, metricLimit: 0 }), null, null, null, null, null],
    rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED)
  });
  const source = createBattlePresentationSource({ session, step: stepBattleSession });
  const first = source.getView().combatants[0];
  assert.equal(first.hp.ratio, 0);
  assert.equal(first.resource.ratio, 0);
  assert.equal(Number.isNaN(first.hp.ratio), false);
});

test("stand positions are product-authored and say so", () => {
  for (let slot = 0; slot < BATTLE_FRAME_SLOT_COUNT; slot += 1) {
    const stand = battleStandPosition(slot);
    assert.equal(stand.evidence, "PRODUCT_AUTHORED");
    assert.ok(stand.x > 0 && stand.x < 1);
    assert.ok(stand.y > 0 && stand.y < 1);
  }
  // The two teams face each other and do not overlap.
  assert.equal(battleStandPosition(0).facing, 1);
  assert.equal(battleStandPosition(3).facing, -1);
  assert.notEqual(battleStandPosition(0).y, battleStandPosition(3).y);
  assert.throws(() => battleStandPosition(6), /SLOT_OUT_OF_RANGE/);
  // And the contract records that the real geometry is untraced.
  assert.equal(contract.standPositions.status, "UNKNOWN_REQUIRES_TRACE");
});

test("the discrete frame republishes on a real change and stays put otherwise", () => {
  const source = sourceOf([100, 100, 100, 100, 100, 100]);
  const seen = [];
  const unsubscribe = source.subscribe((frame) => seen.push(frame));
  assert.equal(seen.length, 1, "a subscriber is given the current frame at once");

  source.tick();
  assert.equal(seen.length, 1, "a quiet frame publishes nothing");

  // Take a combatant down and the frame republishes.
  source.getFrame();
  const before = seen.length;
  const session = sessionOf([100, 100, 100, 100, 100, 100]);
  const live = createBattlePresentationSource({ session, step: stepBattleSession });
  const heard = [];
  live.subscribe((frame) => heard.push(frame));
  // Ordinary hit reaction alone must not be shown as death.
  session.slots[4].state = 0x17;
  live.tick();
  assert.equal(heard.length,1);
  assert.equal(live.getView().combatants[4].down,false);
  session.slots[4].currentHp=0;
  live.tick();
  assert.equal(heard.length, 2, "going down is a discrete change");
  assert.equal(heard[1].combatants[4].down, true);
  assert.equal(seen.length, before);
  unsubscribe();
});

test("the end of a battle reaches the screen as a side, not as a winner", () => {
  const session = createBattleSession({
    roster: [fighter(100), fighter(100), fighter(100), fighter(0), fighter(0), fighter(0)],
    rng: createChannelRng(BATTLE_RNG_TRACED_MASTER_SEED),
    downed: [0, 3]
  });
  const source = createBattlePresentationSource({ session, step: stepBattleSession });
  source.tick();
  const outcome = source.getFrame().outcome;
  assert.equal(outcome.ended, true);
  assert.equal(outcome.reason, "TEAM_DOWN");
  assert.equal(outcome.verdict, "TEAM_ZERO_AHEAD");
  assert.equal(outcome.winningTeam, 0);
  assert.equal(session.verdict, BATTLE_OUTCOME_TEAM_ZERO_AHEAD);
  // The vocabularies never leak a raw code to the scene.
  assert.equal(BATTLE_PRESENTATION_VERDICTS[BATTLE_OUTCOME_TEAM_ZERO_AHEAD], "TEAM_ZERO_AHEAD");
  assert.deepEqual(Object.values(BATTLE_PRESENTATION_END_REASONS).sort(), ["RUNNING", "TEAM_DOWN", "TIME_UP"]);
});

test("the source refuses anything that is not a six-slot session", () => {
  assert.throws(() => createBattlePresentationSource({}), /REQUIRES_A_BATTLE_SESSION/);
  assert.throws(() => createBattlePresentationSource({ session: sessionOf([100, 100, 100, 100, 100, 100]) }),
    /REQUIRES_A_STEP_FUNCTION/);
  assert.throws(() => createBattlePresentationSource({
    session: sessionOf([100, 100, 100, 100, 100, 100]), step: stepBattleSession, arenaIndex: 99
  }), /UNKNOWN_ARENA_INDEX/);
  assert.equal(BATTLE_PRESENTATION_CONTRACT_VERSION, "championship-modern-battle-field-presentation/v1");
});

test("the module imports nothing outside src and the contracts", () => {
  const module = fs.readFileSync(path.join(root, "src/championship/app/battlePresentationSource.js"), "utf8");
  for (const specifier of module.match(/from "([^"]+)"/g) ?? []) {
    assert.match(specifier, /from "\.\.?\//, specifier);
  }
});
