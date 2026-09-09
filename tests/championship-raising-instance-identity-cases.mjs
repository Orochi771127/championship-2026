import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateRaisingInstanceIdentity,
  canonicalRaisingSpeciesId,
  createRaisingInstanceIdentityState,
  listRaisingInstances,
  normalizeRaisingInstanceIdentityState,
  resolveRaisingInstance
} from "../src/championship/raising/raisingInstanceIdentity.js";
import {
  createRaisingProductionState,
  normalizeRaisingProductionState,
  recordEnclosedCreature,
  renameEnclosedCreature
} from "../src/championship/app/championshipRaisingProduction.js";

const INSTANCE_1 = "championship:2026:instance:0001";
const INSTANCE_9 = "championship:2026:instance:0009";

function sources() {
  return {
    creature: { creatureId: "resident:species-000", speciesId: "species-000", displayName: "DIGITAMA_0" },
    residents: [
      { residentId: "resident:species-000", speciesId: "championship:creature:species-000", name: "DIGITAMA_0", satiety: 72 }
    ],
    collection: [
      { instanceId: INSTANCE_1, speciesId: "species-008", displayName: "First", enclosedAt: "2026-09-05T01:00:00Z", originGateId: "gate:grass", successAuthority: "PRODUCT_AUTHORED_ENCLOSURE" },
      { instanceId: INSTANCE_9, speciesId: "championship:creature:species-008", displayName: "Second", enclosedAt: "2026-09-05T02:00:00Z", originGateId: "gate:desert", successAuthority: "PRODUCT_AUTHORED_ENCLOSURE" }
    ],
    assignments: { "resident:species-000": "cage:first", [INSTANCE_1]: "cage:first", [INSTANCE_9]: "cage:second" },
    interactions: { [INSTANCE_1]: { careCount: 2, lastCaredAt: "2026-09-05T01:10:00Z" }, [INSTANCE_9]: { careCount: 7, lastCaredAt: null } }
  };
}

test("starter and resident references resolve once while same-species individuals remain independent", () => {
  const frame = listRaisingInstances(sources());
  assert.equal(frame.length, 3);
  assert.equal(frame[0].instanceId, "resident:species-000");
  assert.equal(frame[0].source.kind, "STARTER");
  assert.equal(frame[0].source.residentId, "resident:species-000");
  assert.equal(frame[1].speciesId, frame[2].speciesId);
  assert.notEqual(frame[1].instanceId, frame[2].instanceId);
  assert.deepEqual(frame.slice(1).map((entry) => [entry.displayName, entry.cageId, entry.interaction.careCount]), [
    ["First", "cage:first", 2], ["Second", "cage:second", 7]
  ]);
  assert.equal(frame[1].source.originGateId, "gate:grass");
  assert.equal(frame[2].source.originGateId, "gate:desert");
});

test("identity lookup is exact, leaves unknowns null, and never presents species data as an individual profile", () => {
  const input = sources();
  input.residents[0].hp = 200;
  input.residents[0].rungs = [0, 0, 0];
  input.collection[0].stats = { hp: 900, attack: 99 };
  const starter = resolveRaisingInstance(input, "resident:species-000");
  assert.equal(starter.profile, null);
  assert.equal(starter.profileEvidence, "UNKNOWN_REQUIRES_TRACE");
  assert.equal(starter.identityEvidence, "PARTIAL");
  assert.equal("hp" in starter, false);
  assert.equal("stats" in starter, false);
  assert.equal("rungs" in starter, false);
  assert.equal(resolveRaisingInstance(input, "species-008"), null);
  assert.equal(resolveRaisingInstance(input, "championship:2026:instance:0999"), null);
  assert.equal(resolveRaisingInstance(input, INSTANCE_1).profile, null);
});

test("collection provenance is preserved without upgrading enclosure to original capture", () => {
  const input = sources();
  delete input.collection[1].successAuthority;
  delete input.collection[1].originGateId;
  delete input.collection[1].enclosedAt;
  input.collection[1].displayName = null;
  const entries = listRaisingInstances(input);
  assert.deepEqual(entries[1].source, {
    kind: "COLLECTION", residentId: null, successAuthority: "PRODUCT_AUTHORED_ENCLOSURE",
    enclosedAt: "2026-09-05T01:00:00Z", originGateId: "gate:grass"
  });
  assert.deepEqual(entries[2].source, {
    kind: "COLLECTION", residentId: null, successAuthority: null, enclosedAt: null, originGateId: null
  });
  assert.equal(entries[2].displayName, null);
});

test("collection restore and rename preserve prior source and keep missing legacy source unknown", () => {
  const input = sources();
  const settings = { cageIds: ["cage:first", "cage:second"], creatureIds: ["resident:species-000"] };
  const initial = createRaisingProductionState(settings);
  const first = recordEnclosedCreature(initial, { instanceId: INSTANCE_1, speciesId: "species-008", displayName: "First" });
  assert.equal(first.collection[0].successAuthority, "PRODUCT_AUTHORED_ENCLOSURE", "only a new existing enclosure transaction assigns its own source");
  input.collection[0].successAuthority = "LEGACY_RECORDED_SOURCE";
  delete input.collection[1].successAuthority;
  const restored = normalizeRaisingProductionState(input, settings);
  assert.equal(restored.collection[0].successAuthority, "LEGACY_RECORDED_SOURCE");
  assert.equal(restored.collection[1].successAuthority, null);
  const renamedFirst = renameEnclosedCreature(restored, INSTANCE_1, "New First");
  const renamedBoth = renameEnclosedCreature(renamedFirst, INSTANCE_9, "New Second");
  assert.equal(renamedBoth.collection[0].successAuthority, "LEGACY_RECORDED_SOURCE");
  assert.equal(renamedBoth.collection[1].successAuthority, null);
  const resolved = listRaisingInstances({ ...input, collection: renamedBoth.collection });
  assert.equal(resolved[1].source.successAuthority, "LEGACY_RECORDED_SOURCE");
  assert.equal(resolved[2].source.successAuthority, null);
});

test("conflicting identity references and duplicate collection IDs are refused without dropping a member", () => {
  const conflict = sources();
  conflict.residents[0].speciesId = "species-001";
  assert.throws(() => listRaisingInstances(conflict), /INSTANCE_SPECIES_CONFLICT/);
  const repeatedResident = sources();
  repeatedResident.residents.push({ ...repeatedResident.residents[0] });
  assert.throws(() => listRaisingInstances(repeatedResident), /DUPLICATE_RESIDENT_ID/);
  const repeatedCollection = sources();
  repeatedCollection.collection[1].instanceId = INSTANCE_1;
  assert.throws(() => listRaisingInstances(repeatedCollection), /DUPLICATE_INSTANCE_ID/);
  const crossSource = sources();
  crossSource.collection[0].instanceId = "resident:species-000";
  assert.throws(() => listRaisingInstances(crossSource), /DUPLICATE_INSTANCE_ID/);
});

test("legacy migration scans surviving IDs rather than collection length and accepts durable R2 residents", () => {
  const input = sources();
  input.residents = [{ residentId: "resident:species-000", position: { x: 5, y: 7 } }];
  const identity = createRaisingInstanceIdentityState(input);
  assert.deepEqual(identity, { nextSequence: 10 });
  const reservation = allocateRaisingInstanceIdentity(identity, input);
  assert.equal(reservation.instanceId, "championship:2026:instance:0010");
  assert.deepEqual(reservation.state, { nextSequence: 11 });
  assert.equal(input.collection.length, 2, "reservation alone must not create a capture");
  assert.equal(input.collection[0].instanceId, INSTANCE_1);
  assert.equal(input.collection[1].instanceId, INSTANCE_9);
});

test("persisted high-water mark prevents ID reuse after removal and reconstruction", () => {
  const input = sources();
  const first = allocateRaisingInstanceIdentity(createRaisingInstanceIdentityState(input), input);
  // Removing all collection members cannot rewind a successfully saved mark.
  input.collection = [];
  input.assignments = { "resident:species-000": "cage:first" };
  const restored = normalizeRaisingInstanceIdentityState(JSON.parse(JSON.stringify(first.state)), input);
  const next = allocateRaisingInstanceIdentity(restored, input);
  assert.equal(next.instanceId, "championship:2026:instance:0011");
  assert.deepEqual(next.state, { nextSequence: 12 });
});

test("assignment-only reservations and retained custom IDs survive legacy lookup", () => {
  const input = sources();
  input.collection[0].instanceId = "legacy:individual:alpha";
  input.assignments["championship:2026:instance:0042"] = "cage:first";
  assert.deepEqual(createRaisingInstanceIdentityState(input), { nextSequence: 43 });
  assert.equal(resolveRaisingInstance(input, "legacy:individual:alpha").instanceId, "legacy:individual:alpha");
  assert.equal(canonicalRaisingSpeciesId("championship:creature:species-008"), "species-008");
  assert.equal(canonicalRaisingSpeciesId("legacy:species:008"), "legacy:species:008", "unrecognized namespaces cannot become invented aliases");
});

test("current-schema state rejects rewind, malformed marks, additional payloads, and exhaustion", () => {
  for (const value of [null, {}, [], { nextSequence: 0 }, { nextSequence: 1.5 }, { nextSequence: Infinity }, { nextSequence: 10, roster: [] }]) {
    assert.throws(() => normalizeRaisingInstanceIdentityState(value, sources()));
  }
  assert.throws(() => normalizeRaisingInstanceIdentityState({ nextSequence: 9 }, sources()), /INSTANCE_SEQUENCE_BEHIND_ROSTER/);
  assert.throws(() => allocateRaisingInstanceIdentity({ nextSequence: Number.MAX_SAFE_INTEGER }), /INSTANCE_SEQUENCE_EXHAUSTED/);
  assert.throws(() => createRaisingInstanceIdentityState({ collection: [{ instanceId: `${"championship:2026:instance:"}${Number.MAX_SAFE_INTEGER}` }] }), /INSTANCE_SEQUENCE_EXHAUSTED/);
});

test("projections and reservations are immutable copies and do not invoke accessor-shaped source payloads", () => {
  const input = sources();
  const before = JSON.stringify(input);
  const frame = listRaisingInstances(input);
  assert.throws(() => { frame[1].interaction.careCount = 100; }, TypeError);
  assert.throws(() => { frame[1].source.originGateId = "gate:other"; }, TypeError);
  assert.equal(JSON.stringify(input), before);
  input.collection[0].displayName = "Changed";
  assert.equal(frame[1].displayName, "First");
  const reservation = allocateRaisingInstanceIdentity({ nextSequence: 10 }, input);
  assert.throws(() => { reservation.state.nextSequence = 1; }, TypeError);
  let accessed = false;
  const hostile = { get nextSequence() { accessed = true; return 1; } };
  assert.throws(() => normalizeRaisingInstanceIdentityState(hostile), /Accessor property/);
  assert.equal(accessed, false);
});

test("new game identity has no fabricated individual and the first allocation retains the existing ID format", () => {
  assert.deepEqual(listRaisingInstances(), []);
  assert.deepEqual(createRaisingInstanceIdentityState(), { nextSequence: 1 });
  assert.deepEqual(allocateRaisingInstanceIdentity(createRaisingInstanceIdentityState()), {
    state: { nextSequence: 2 }, instanceId: INSTANCE_1
  });
});
