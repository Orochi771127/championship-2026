import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {nativeIndividualProfile, normalizeNativeIndividualProfile, projectNativeIndividualStats} from "../src/championship/raising/nativeIndividualProfile.js";
import {recordCapturedCardCreature, createRaisingProductionState, renameEnclosedCreature, normalizeRaisingProductionState} from "../src/championship/app/championshipRaisingProduction.js";
import {listRaisingInstances} from "../src/championship/raising/raisingInstanceIdentity.js";
import {createNativeWildActor} from "../src/championship/hunt/capture/nativeWildActor.js";
import {prepareNativeHuntEntry} from "../src/championship/hunt/capture/nativeHuntEntryTransaction.js";
import {createNativeHuntPersistentState} from "../src/championship/hunt/capture/nativeHuntPersistentState.js";
import {createChampionshipStandaloneApp} from "../src/championship/app/championshipStandaloneApp.js";
import {serializeChampionshipModernSave,deserializeChampionshipModernSave,CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES} from "../src/championship/app/championshipStandaloneSave.js";

const read = p => JSON.parse(fs.readFileSync(p,"utf8"));
const inputs=read("docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json");
const copies=read("docs/research/NATIVE_INDIVIDUAL_HOME_CPU_CHECK_2026-09-08.json");
const sample=()=>nativeIndividualProfile(structuredClone(inputs.individualVectors[8].after),"species-008");

test("all 228 persistent profiles retain the fields preserved by 684 original Home copies",()=>{
  for(const v of inputs.individualVectors){
    const p=nativeIndividualProfile(v.after,`species-${String(v.speciesIndex).padStart(3,"0")}`);
    const values=[...Object.keys(p.fields).sort().map(k=>p.fields[k]),...Object.values(p.narrowFields)];
    const bytes=Buffer.alloc(values.length*4);values.forEach((n,i)=>bytes.writeUInt32LE(n,i*4));
    const hash=createHash("sha256").update(bytes).update(Buffer.from(p.name,"utf16le")).digest("hex");
    for(const c of copies.cases.filter(c=>c.speciesIndex===v.speciesIndex))assert.equal(hash,c.profileSha256);
    const stats=projectNativeIndividualStats(p);
    assert.equal(stats.currentHp,v.after.fields["050"]);
    assert.equal(stats.maxTp,v.after.fields["05c"]);
    assert.equal(stats.stats.field60,v.after.fields["060"]);
  }
});

test("profile rejects unknown fields, missing values, invalid widths, mixed species and corrupt vitals",()=>{
  for(const mutate of [p=>p.fields.extra=1,p=>delete p.fields["060"],p=>p.fields["060"]=-1,
    p=>p.fields["060"]=NaN,p=>p.narrowFields["03c"]=256,p=>p.name="123456",
    p=>p.fields["050"]=p.fields["058"]+1,p=>p.version=2]){
    const p=structuredClone(sample());mutate(p);assert.throws(()=>normalizeNativeIndividualProfile(p),/INVALID_NATIVE/);
  }
  assert.throws(()=>normalizeNativeIndividualProfile(sample(),"species-009"),/SPECIES_MISMATCH/);
});

test("same-species individuals keep distinct stats through naming and restore; legacy remains unknown",()=>{
  const cageId="cage:home", first=sample(),second=structuredClone(first);second.fields["060"]++;
  const cageIds=[cageId,"cage:other"];
  let state=createRaisingProductionState({cageIds,creatureIds:[]});
  for(const [index,nativeProfile] of [first,second].entries())state=recordCapturedCardCreature(state,{
    instanceId:`championship:2026:instance:000${index+1}`,speciesId:"species-008",cageId,displayName:`name${index}`,
    nativeProfile,capturedVitals:{currentHp:nativeProfile.fields["050"],maxHp:nativeProfile.fields["058"],traceId:"normal"}});
  state=renameEnclosedCreature(state,"championship:2026:instance:0001","新名字");
  const restored=normalizeRaisingProductionState(JSON.parse(JSON.stringify(state)),{cageIds});
  assert.deepEqual(restored.collection.map(c=>c.nativeProfile),[first,second]);
  const instances=listRaisingInstances(restored);
  assert.equal(instances[1].profile.stats.field60-instances[0].profile.stats.field60,1);
  assert.equal(instances[0].profileEvidence,"ROM_VERIFIED_INDIVIDUAL_FIELDS");
  const legacy=structuredClone(restored);delete legacy.collection[0].nativeProfile;
  assert.equal(listRaisingInstances(legacy)[0].profile,null);
  assert.equal(Object.isFrozen(instances[0].profile.stats),true);
});

test("native actor reads the original lowercase activity counter without creating undefined or NaN",()=>{
  const input=read("docs/research/HUNT_ACTOR_ENTRY_CPU_CHECK_2026-09-06.json").entry;
  const entry=prepareNativeHuntEntry({biomeId:"Grass",clock:{clockMinutes:780,season:0},rngSnapshot:input.rngBefore,
    persistentState:createNativeHuntPersistentState()});
  for(const record of entry.encounter.actors){
    const actor=createNativeWildActor(record,"test:wild");
    assert.equal(actor.awakeCounter,record.individual.fields["00c"]);
    assert.ok(Number.isInteger(actor.awakeCounter));
  }
});

test("full 16-member Home fits the existing save boundary and rejects malformed native/progression extensions",async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const cages=read("docs/contracts/championship/raising-home-presentation.v1.json").cages;
  const app=createChampionshipStandaloneApp({storage,cages,catalog:read("src/data/championship/catalogs/creature-species.r1.json"),
    rngClock:()=>({hour:13,minute:20,second:50})});
  try {
    await app.newGame();assert.equal(app.save().phase,"SAVED");
    const save=deserializeChampionshipModernSave([...data.values()][0]);
    let raising=save.raising;
    const cageId=Object.values(raising.assignments)[0];
    // Controlled storage-capacity fixture; the normal-capture test separately
    // proves how player input earns an individual. This creates no runtime API.
    for(let i=1;i<=15;i++){
      const nativeProfile=structuredClone(sample());nativeProfile.fields["060"]+=i;
      raising=recordCapturedCardCreature(raising,{instanceId:`championship:2026:instance:${String(i).padStart(4,"0")}`,
        speciesId:"species-008",displayName:`Resident ${i}`,cageId,nativeProfile,
        capturedVitals:{currentHp:nativeProfile.fields["050"],maxHp:nativeProfile.fields["058"],traceId:"controlled-save-capacity"}});
    }
    const candidate={...save,raising,instanceIdentity:{nextSequence:16},progression:{...save.progression,battleBadges:[7,45,46]}};
    const text=serializeChampionshipModernSave(candidate),restored=deserializeChampionshipModernSave(text);
    assert.ok(Buffer.byteLength(text)<CHAMPIONSHIP_MODERN_SAVE_MAX_BYTES);
    assert.equal(Object.keys(restored.raising.assignments).length,16);
    assert.deepEqual(restored.raising.collection,raising.collection);
    assert.deepEqual(restored.progression.battleBadges,[7,45,46]);
    for(const battleBadges of [null,{},[7,7],[-1],[62],[1.5],["7"],Array(1)]){
      assert.throws(()=>serializeChampionshipModernSave({...candidate,progression:{...candidate.progression,battleBadges}}),/INVALID_BATTLE_BADGES/);
    }
    const damaged=structuredClone(candidate);delete damaged.raising.collection[0].nativeProfile.fields["060"];
    assert.throws(()=>deserializeChampionshipModernSave(JSON.stringify(damaged)),/INVALID_NATIVE_INDIVIDUAL_PROFILE/);
    const legacy=structuredClone(save);delete legacy.progression.battleBadges;
    assert.deepEqual(deserializeChampionshipModernSave(JSON.stringify(legacy)).progression.battleBadges,[]);
  } finally {await app.dispose();}
});
