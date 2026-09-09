import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { listDatabaseSlots } from "../src/championship/database/databaseCatalog.js";
import { registerNativeBookSpecies, normalizeRegisteredSpecies, retainOwnedBookSpecies } from "../src/championship/database/nativeBookRegistration.js";
import { projectDatabase } from "../src/championship/database/databaseRuntime.js";
import { createChampionshipModernSave } from "../src/championship/app/championshipStandaloneSave.js";

test("all 228 original CPU registration calls select the correct original book ordinal", () => {
  const oracle=JSON.parse(fs.readFileSync("docs/research/RAISING_BOOK_CPU_CHECK_2026-09-08.json","utf8"));
  const slots=listDatabaseSlots();
  assert.deepEqual(slots.map(row=>row.speciesIndex),oracle.regularSpeciesOrder);
  for(const row of oracle.cases){
    const registered=registerNativeBookSpecies([],row.species);
    assert.deepEqual(slots.flatMap(slot=>registered.includes(slot.speciesIndex)?[slot.bookOrdinal]:[]),row.registeredOrdinals);
    assert.equal(registerNativeBookSpecies(registered,row.species),registered);
  }
});

test("a registered species stays registered with no held instance, without creating unseen history", () => {
  const book=retainOwnedBookSpecies([223],{speciesId:"species-000"},[{speciesId:"species-014"}]);
  const frame=projectDatabase({registeredSpecies:book,selectedSpeciesIndex:223});
  assert.deepEqual(book,[14,223]);
  assert.equal(frame.registeredCount,2);
  assert.equal(frame.selected.state,"REGISTERED");
  assert.equal(frame.selected.source,"HISTORY");
  assert.deepEqual(frame.selected.instances,[]);
});

test("the save validator rejects egg, duplicate, sparse and malformed book flags", () => {
  for(const bad of [[0],[224],[14,14],[NaN],["14"],null,{},new Array(2)]) {
    assert.throws(()=>normalizeRegisteredSpecies(bad),/INVALID_REGISTERED_SPECIES/);
  }
  const create=progression=>createChampionshipModernSave({sessionId:"book-test",
    creature:{creatureId:"book-one",speciesId:"species-000",displayName:"Egg"},
    raisingHomeSerialized:'{"payload":{"residents":[]}}',progression});
  assert.deepEqual(create({registeredSpecies:[223,14]}).progression.registeredSpecies,[14,223]);
  assert.throws(()=>create({registeredSpecies:[224]}),/INVALID_REGISTERED_SPECIES/);
});
