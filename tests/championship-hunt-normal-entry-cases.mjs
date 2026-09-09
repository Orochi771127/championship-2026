import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from "../src/championship/app/championshipStandaloneSave.js";
import { createHuntRuntime } from "../src/championship/hunt/huntRuntime.js";
import { resolveNativeHuntEnvironment, resolveNativeHuntSceneSources } from "../src/championship/hunt/capture/nativeHuntSceneSources.js";
import { prepareNativeHuntEntry } from "../src/championship/hunt/capture/nativeHuntEntryTransaction.js";
import { createNativeHuntPersistentState } from "../src/championship/hunt/capture/nativeHuntPersistentState.js";
import { stepNativeHuntMovement } from "../src/championship/hunt/capture/nativeHuntMovement.js";
import { listChampionshipGates } from "../src/championship/gate/gateCatalog.js";

const read = p => JSON.parse(fs.readFileSync(p,"utf8"));
const sceneCatalog = read("src/data/championship/catalogs/hunt-scene.r1.json");
const entryCpu = read("docs/research/HUNT_ACTOR_ENTRY_CPU_CHECK_2026-09-06.json").entry;
const catalog = read("src/data/championship/catalogs/creature-species.r1.json");
const { cages } = read("docs/contracts/championship/raising-home-presentation.v1.json");
const store = () => { const map=new Map(); return { fail:false, getItem:k=>map.get(k)??null,
  setItem(k,v) { if (this.fail) throw Error("FULL"); map.set(k,v); }, removeItem:k=>map.delete(k) }; };
const appFor = (storage, options={}) => createChampionshipStandaloneApp({ storage,catalog,cages,
  rngClock:()=>({hour:13,minute:20,second:50}), ...options });
function enter(app, biomeId="Grass") {
  app.openGate(); app.selectGate(app.getGates().find(g=>g.biomeId===biomeId).gateId); app.confirmGate();
  return app.beginHunt();
}

test("all Gate node positions and 352 supported native variant cases use identity, never UI ordinal", () => {
  const cpu=read("docs/research/HUNT_GATE_SOURCE_CPU_CHECK_2026-09-06.json");
  for (const row of cpu.positions.filter(v=>v.gateRecordIndex<16)) assert.deepEqual(sceneCatalog.gates[row.gateRecordIndex].positionQ12,row.positionQ12);
  let count=0;
  for (const row of cpu.vectors.filter(v=>v.hour>=2&&v.gateRecordIndex<16)) {
    const gate=sceneCatalog.gates[row.gateRecordIndex];
    const result=resolveNativeHuntSceneSources({biomeId:gate.biomeId,hour:row.hour,season:0});
    assert.equal(result.variant.night,row.night); assert.equal(result.variant.dotQ12,row.dotQ12);
    assert.equal(result.nativeHuntIndex,row.night?gate.nightIndex:gate.dayIndex); count++;
  }
  assert.equal(count,352);
  assert.equal(resolveNativeHuntSceneSources({biomeId:"Grass",hour:13,season:0}).fieldId,"field_hm01_02");
  assert.throws(()=>resolveNativeHuntSceneSources({biomeId:"Grass",hour:0,season:0}),/NEGATIVE_TRIG/);
});

test("29 complete initial terrain readers match 475136 original CPU cell results and outside bounds", () => {
  const cpu=read("docs/research/HUNT_SCENE_READERS_CPU_CHECK_2026-09-06.json");
  assert.equal(cpu.fields.length,29);
  for(const row of cpu.fields) {
    const env=resolveNativeHuntEnvironment(row.fieldId);
    const cells=Buffer.from(Array.from({length:env.width*env.height},(_,i)=>env.readTerrain(i%env.width,Math.floor(i/env.width))));
    assert.equal(createHash("sha256").update(cells).digest("hex"),row.atrReaderSha256,row.fieldId);
    assert.deepEqual([[-1,0],[0,-1],[128,0],[0,128]].map(([x,y])=>env.readTerrain(x,y)),row.atrOutside);
    assert.deepEqual(row.escOutside,[0,0,0,0]);
    for (let i=0;i<cells.length;i++) assert.equal(env.isBlocked(i%128,Math.floor(i/128)),cells[i]===1);
    assert.deepEqual(env.readDirectionCell(-1,0),{targetQ12:[0,-4096,0],blendQ12:205});
  }
});

test("production terrain/direction providers reproduce all 208 actual movement calls without query receipts", () => {
  const env=resolveNativeHuntEnvironment("field_hm01_01");
  const calls=read("docs/research/HUNT_MOVEMENT_REPLAY_2026-09-06.json").calls;
  for(const call of calls) {
    const point=pc=>call.steps.find(s=>s.pc===pc);
    const result=stepNativeHuntMovement(call.before,call.mode,{...env,camera:call.before.camera,
      queryControllers(candidate) {
        assert.deepEqual(candidate,point("0x210e24c").candidateQ12);
        return {obstacle:point("0x210e2ac").obstacle,secondaryBlocked:!!point("0x210e2ac").secondaryBlocked,sideEffectsClosed:true};
      }});
    assert.deepEqual(result.state,call.after,`tick ${call.tick}`);
  }
  assert.equal(calls.length,208);
});

test("normal functional sources reproduce original full entry actors and all 217 final RNG channels", () => {
  const candidate=prepareNativeHuntEntry({biomeId:"Grass",clock:{clockMinutes:780,season:0},
    rngSnapshot:entryCpu.rngBefore,persistentState:createNativeHuntPersistentState()});
  const after=entryCpu.events.find(e=>e.kind==="group-boundary"&&e.pc==="0x211b2f0");
  const effect=entryCpu.events.find(e=>e.kind==="scene-effect-input");
  for (const key of ["primaryPresent","threshold","secondaryPresent","parameter"]) assert.equal(candidate.scene.sceneEffect[key],effect[key]);
  assert.deepEqual(candidate.rng.snapshot(),entryCpu.rngAfter);
  assert.equal(candidate.encounter.actors.length,15);
  candidate.encounter.actors.forEach((a,i)=>{
    assert.equal(a.speciesIndex,after.wildRecords[i].speciesIndex);
    assert.deepEqual(a.positionQ12.slice(0,2),after.wildRecords[i].positionQ12);
    assert.equal(a.individual.fields["050"],after.wildRecords[i].wildHp);
    assert.equal(a.individual.fields["004"],i);
  });
});

test("all 16 Gate identities across four seasons and three playable hours generate from the continuing RNG", () => {
  let rng=entryCpu.rngBefore;
  for(const gate of listChampionshipGates()) for(const season of [0,1,2,3]) for(const hour of [7,13,22]) {
    const result=prepareNativeHuntEntry({biomeId:gate.biomeId,clock:{clockMinutes:hour*60,season},
      rngSnapshot:rng,persistentState:createNativeHuntPersistentState()});
    assert.ok(result.encounter.actors.length>0);
    assert.ok(result.encounter.actors.every((a,i)=>a.individual.fields["004"]===i));
    assert.notDeepEqual(result.rng.snapshot(),rng); rng=result.rng.snapshot();
  }
});

test("persistent released history enters the native candidate path without clearing history on entry", () => {
  const persistentState=createNativeHuntPersistentState();
  persistentState.history.entries[1]={speciesIndex:10,biomeIndex:0,trait:4,name:"BACK"};
  persistentState.modifiers[0].fill(15); // original reduction removes ordinary candidates
  const before=structuredClone(persistentState);
  const result=prepareNativeHuntEntry({biomeId:"Grass",clock:{clockMinutes:780,season:0},
    rngSnapshot:entryCpu.rngBefore,persistentState});
  assert.equal(result.releasedSlot,1);
  const released=result.encounter.records.filter(r=>r.fields["048"]===2);
  assert.equal(released.length,1); assert.equal(released[0].fields["018"],4); assert.equal(released[0].name,"BACK");
  assert.deepEqual(result.persistentState,before); assert.deepEqual(persistentState,before);
});

test("original carried post-registration probe proves common slot binding and an additional whole-batch state update", () => {
  const cpu=read("docs/research/HUNT_CARRIED_REGISTRATION_CPU_CHECK_2026-09-06.json");
  const ordinary=cpu.cases[0], carried=cpu.cases[1];
  assert.deepEqual(ordinary.after,ordinary.before.entities); assert.equal(ordinary.dispatch.length,0);
  assert.equal(carried.before.guard,0); assert.equal(carried.rolls.length,0);
  carried.before.entities.forEach((e,i)=>assert.equal(e.individualSlot,i));
  assert.equal(carried.after[0].visible,0); assert.equal(carried.after[0].wildState,3);
  assert.equal(carried.after[0].aiState,0);
  for (const [i,e] of carried.after.entries()) {
    assert.deepEqual(e.positionQ12,carried.before.entities[i].positionQ12);
    assert.equal(e.aiFields["1d4"],1);
    if(i>0) { assert.equal(e.aiState,1); assert.equal(e.aiRequest,4); }
  }
});

test("normal app entry commits once, advances native AI on the shared RNG, and reentry continues it", async () => {
  const app=appFor(store()); await app.newGame();
  const before=app.getGameplayRngState(); enter(app);
  assert.equal(app.getHuntEntryError(),null); assert.ok(app.getHuntRuntime().world.nativeEntry);
  const first=app.getHuntRuntime().getNativeEntryState(), committed=app.getGameplayRngState();
  assert.notDeepEqual(committed,before);
  app.beginHunt(); assert.deepEqual(app.getGameplayRngState(),committed);
  const wilds=app.getHuntRuntime().getWildCreatures();
  app.getHuntRuntime().tick(1000);
  assert.notDeepEqual(app.getHuntRuntime().getWildCreatures(),wilds);
  assert.notDeepEqual(app.getGameplayRngState(),committed);
  assert.ok(wilds.every(w=>w.hpEvidence==="NATIVE_NORMAL_HUNT_CONTROLLER"&&w.nativeAnimation));
  assert.equal(app.getHuntRuntime().getCaptureAvailability().canCollect,false);
  first.encounter.actors[0].individual.fields["050"]=0;
  assert.notEqual(app.getHuntRuntime().getNativeEntryState().encounter.actors[0].individual.fields["050"],0);
  app.exitHunt(); enter(app); assert.notDeepEqual(app.getGameplayRngState(),committed);
  await app.dispose();
});

test("runtime failure after generation preserves RNG/history/save/Loadout; retry equals an uninterrupted entry", async () => {
  const s=store(); let fail=true;
  const app=appFor(s,{huntRuntimeFactory(args) { assert.ok(args.nativeEntry.encounter.actors.length); if(fail)throw Error("CONTROLLED_RUNTIME_FAILURE"); return createHuntRuntime(args); }});
  const control=appFor(store()); await app.newGame(); await control.newGame(); app.save();
  const rng=app.getGameplayRngState(), history=app.getHuntPersistentState(), saved=s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  enter(app); assert.equal(app.getHuntRuntime(),null); assert.equal(app.getHuntEntryError(),"CONTROLLED_RUNTIME_FAILURE");
  assert.equal(app.getScreen(),"HUNT_LOADOUT");
  assert.deepEqual(app.getGameplayRngState(),rng); assert.deepEqual(app.getHuntPersistentState(),history);
  assert.equal(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY),saved);
  fail=false; app.beginHunt(); enter(control);
  assert.deepEqual(app.getHuntRuntime().getNativeEntryState(),control.getHuntRuntime().getNativeEntryState());
  assert.deepEqual(app.getGameplayRngState(),control.getGameplayRngState());
  await app.dispose(); await control.dispose();
});

test("entry save observers see one complete committed owner and cannot reenter RNG or leave mid-commit", async () => {
  const app=appFor(store()); await app.newGame(); app.save();
  let armed=false, observed=0; const errors=[];
  const stop=app.savePort.subscribe(status=>{
    if(!armed||status.phase!=="DIRTY")return;
    observed++;
    // Observer exceptions are intentionally swallowed by the production port;
    // surface assertion failures outside that callback instead.
    try {
      assert.equal(app.getScreen(),"HUNT_FIELD"); assert.ok(app.getHuntRuntime()?.world.nativeEntry);
      const rng=app.getGameplayRngState(); app.beginHunt(); app.exitHunt();
      assert.equal(app.getScreen(),"HUNT_FIELD"); assert.deepEqual(app.getGameplayRngState(),rng);
      assert.throws(()=>app.nextGameplayRandom(0),/WHILE_HUNT_COMMIT_ACTIVE/);
    } catch(error) { errors.push(error.message); }
  });
  app.openGate(); app.selectGate(app.getGates().find(g=>g.biomeId==="Grass").gateId); app.confirmGate();
  armed=true; app.beginHunt(); armed=false; assert.equal(observed,1); assert.deepEqual(errors,[]); stop(); await app.dispose();
});

test("Save/Continue after entry produces the same next encounter, including a failed save retry", async () => {
  const s=store(), app=appFor(s); await app.newGame(); app.save(); const saved=s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY);
  enter(app); app.exitHunt(); const rng=app.getGameplayRngState(); s.fail=true;
  assert.notEqual(app.save().phase,"SAVED"); assert.equal(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY),saved);
  assert.deepEqual(app.getGameplayRngState(),rng); s.fail=false; assert.equal(app.save().phase,"SAVED");
  const restored=appFor(s); await restored.continueGame();
  // Continue constructs the original egg body (two slot-0 Home draws).
  // Advance the control by those same draws before comparing the next Hunt.
  app.nextGameplayRandom(0x26);app.nextGameplayRandom(0x26);
  assert.deepEqual(restored.getGameplayRngState(),app.getGameplayRngState());
  enter(app); enter(restored);
  assert.deepEqual(restored.getHuntRuntime().getNativeEntryState(),app.getHuntRuntime().getNativeEntryState());
  assert.deepEqual(restored.getGameplayRngState(),app.getGameplayRngState());
  await app.dispose(); await restored.dispose();
});

test("legacy history and non-null carried actor fail before normal entry can mutate durable inputs", async () => {
  const s=store(), app=appFor(s); await app.newGame(); app.save(); const old=JSON.parse(s.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  old.schemaVersion=4; delete old.huntHistory; s.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY,JSON.stringify(old));
  const legacy=appFor(s); await legacy.continueGame(); const rng=legacy.getGameplayRngState(); enter(legacy);
  assert.equal(legacy.getHuntEntryError(),"HUNT_ENTRY_LEGACY_HISTORY_UNKNOWN");
  assert.equal(legacy.getHuntRuntime(),null); assert.equal(legacy.getHuntPersistentState(),null);
  assert.deepEqual(legacy.getGameplayRngState(),rng);
  const state=createNativeHuntPersistentState(), before=structuredClone(state);
  assert.throws(()=>prepareNativeHuntEntry({biomeId:"Grass",clock:{clockMinutes:780,season:0},
    persistentState:state,rngSnapshot:rng,carried:{}}),/CARRIED_ACTOR_REQUIRES_TRACE/);
  assert.deepEqual(state,before); await app.dispose(); await legacy.dispose();
});
