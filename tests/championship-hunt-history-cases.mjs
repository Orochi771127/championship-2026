import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { restoreChannelRng } from "../src/championship/battle/battleRngChannel.js";
import { createNativeHuntHistory, selectNativeReleasedHistory, applyNativeCarriedHistoryWrite,
  projectNativeHuntHistorySave, restoreNativeHuntHistorySave, projectNativeHuntModifierSave,
  applyNativeHuntReturn } from "../src/championship/hunt/capture/nativeHuntHistory.js";

const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_HISTORY_CPU_CHECK_2026-09-06.json", "utf8"));
const speciesByIndex = i => cpu.speciesInputs[i];
const catalogFor = i => cpu.packedSpeciesCatalogs[i].map(n => ({ speciesIndex: n & 0xfff, releaseMatchValue: n & 0x700 }));
function inputFor(v, rng) {
  return { history: v.historyBefore, modifiers: v.modifiersBefore, biomeIndex: v.biomeIndex, catalog: catalogFor(v.biomeIndex),
    records: v.recordsBefore.map(r => ({ fields: { "000": r.speciesIndex, "048": r.sourceTag, "008": 0, "00c": 0, "178": 0 } })),
    carriedAtEntry: v.carriedAtEntry, releasedSlot: v.releasedSlot, speciesByIndex, rng };
}

test("history constructor and first-match selection follow original CPU across all 16 biomes", () => {
  assert.deepEqual(createNativeHuntHistory(cpu.initialHistory.entries[0].name), cpu.initialHistory);
  assert.equal(cpu.selectionVectors.length, 80);
  for (const v of cpu.selectionVectors) {
    const before = structuredClone(v.history);
    assert.deepEqual(selectNativeReleasedHistory(v.history, v.biomeIndex), v.selected);
    assert.deepEqual(v.history, before);
  }
  const carried = JSON.parse(fs.readFileSync("docs/research/HUNT_CARRIED_POOL_CPU_CHECK_2026-09-06.json", "utf8")).poolVectors[0];
  const actual = applyNativeCarriedHistoryWrite(cpu.initialHistory, carried.historyWrite);
  assert.deepEqual(actual.entries[3], carried.historyWrite.entry);
  assert.deepEqual(actual.entries.slice(0, 3), cpu.initialHistory.entries.slice(0, 3));
  assert.equal(actual.cursor, 0);
});

test("return writers and every returned species match original CPU and continuing channel1 RNG", () => {
  assert.equal(cpu.returnVectors.length, 22);
  let total = 0;
  for (const v of cpu.returnVectors) {
    const source = restoreChannelRng(v.rngBefore);
    let draw = 0;
    const input = inputFor(v, { next(channel) {
      const expected = v.rolls[draw++];
      assert.ok(expected, `${v.case}: unexpected draw`);
      assert.equal(channel, expected.channel);
      const n = source.next(channel); assert.equal(n, expected.value); return n;
    } });
    const before = structuredClone({ history: input.history, modifiers: input.modifiers, records: input.records });
    const out = applyNativeHuntReturn(input);
    assert.deepEqual(out.history, v.historyAfter, v.case);
    assert.deepEqual(out.modifiers, v.modifiersAfter, v.case);
    assert.deepEqual(out.records.map(r => ({ speciesIndex: r.fields["000"], sourceTag: r.fields["048"],
      field008: r.fields["008"], field00c: r.fields["00c"], field178: r.fields["178"] })), v.recordsAfter, v.case);
    assert.deepEqual({ history: input.history, modifiers: input.modifiers, records: input.records }, before);
    assert.equal(draw, v.rolls.length); assert.deepEqual(source.snapshot(), v.rngAfter);
    total += draw;
  }
  assert.equal(total, 242);
});

test("native save roundtrip preserves three slots and cursor, restores trait8, excludes carried slot", () => {
  assert.equal(cpu.saveVectors.length, 3);
  for (const v of cpu.saveVectors) {
    const before = structuredClone(v.historyBefore);
    const saved = projectNativeHuntHistorySave(v.historyBefore);
    assert.equal(saved.entries.length, 3);
    assert.ok(saved.entries.every(e => !Object.hasOwn(e, "trait")));
    const text = JSON.stringify(saved);
    assert.deepEqual(restoreNativeHuntHistorySave(JSON.parse(text), v.loadBaseline), v.historyAfter);
    assert.deepEqual(v.historyBefore, before);
    assert.deepEqual(projectNativeHuntModifierSave(v.modifiersBefore), v.modifiersAfter);
    assert.equal(v.packedModifierByteCount, 154);
    const fresh = restoreNativeHuntHistorySave(saved, createNativeHuntHistory(cpu.initialHistory.entries[0].name));
    assert.deepEqual(fresh.entries[3], cpu.initialHistory.entries[3]);
  }
});

test("missing sources fail before RNG; returned candidates cannot mutate the current history", () => {
  const v = cpu.returnVectors.find(v => v.case === "recaptured-clear-selected");
  const next = () => assert.fail("invalid source must not consume RNG");
  for (const invalid of [{ history: null }, { modifiers: null }, { releasedSlot: null },
    { catalog: [] }, { carriedAtEntry: undefined }, { speciesByIndex: () => null }]) {
    assert.throws(() => applyNativeHuntReturn({ ...inputFor(v, { next }), ...invalid }), /HUNT_/);
  }
  assert.throws(() => restoreNativeHuntHistorySave(null, cpu.initialHistory), /SAVE_INVALID/);
  assert.throws(() => restoreNativeHuntHistorySave({ ...projectNativeHuntHistorySave(cpu.initialHistory), cursor: 3 }, cpu.initialHistory), /SAVE_INVALID/);
  assert.throws(() => applyNativeCarriedHistoryWrite(cpu.initialHistory, { slot: 2, entry: cpu.initialHistory.entries[0] }), /CARRIED_WRITE_INVALID/);
  const selected = selectNativeReleasedHistory(v.historyBefore, 0);
  selected.entry.name = "EDIT";
  assert.equal(v.historyBefore.entries[0].name, "HIST0");
  const bytes = cpu.modifiers ?? cpu.returnVectors[0].modifiersBefore;
  const boundary = structuredClone(bytes); boundary[0][0] = 255;
  assert.equal(projectNativeHuntModifierSave(boundary)[0][0], 15);
});
