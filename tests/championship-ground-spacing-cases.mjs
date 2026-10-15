import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {separateGroundFootpoints,canTraverseGroundStep} from '../src/championship/spatial/groundFootpointSeparation.js';
import {separateNativeRaisingGroundActors,nativeRaisingSpacingRole} from '../src/championship/raising/nativeGroundSpacing.js';
import {stepNativeRaisingMovement,nativeRaisingPeerStopDistanceQ12} from '../src/championship/raising/nativeRaisingMovement.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,stepNativeRaisingActor,projectNativeRaisingActor,
  interruptNativeRaisingFeeding,beginNativeRaisingCarry,beginNativeRaisingEvolution,enterNativeRaisingCage} from '../src/championship/raising/nativeRaisingActor.js';
import {createNativeRaisingFood,reconcileNativeFoodReservations} from '../src/championship/raising/nativeRaisingFood.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {createNativeHuntFieldControls,nativeHuntGroundSpacingEligible,separateNativeHuntGroundActors} from '../src/championship/hunt/capture/nativeHuntFieldControls.js';
import {HUNT_EQUIPMENT_ITEMS} from '../src/championship/hunt/loadout/huntEquipmentCatalog.js';
import {queryNativeHuntActors} from '../src/championship/hunt/capture/nativeWildSpatial.js';
import {updateNormalBattleGeometry} from '../src/championship/battle/battleNormalFlow.js';
import {createBattleNormalRuntime} from '../src/championship/battle/battleNormalRuntime.js';
import {createBattleNativeActors} from '../src/championship/battle/battleNativeActors.js';
import {createBattleSession,createSessionCombatant,stepBattleSession} from '../src/championship/battle/battleSession.js';
import {createBattlePresentationSource} from '../src/championship/app/battlePresentationSource.js';
const Q=4096,point=(x,y,z=0)=>[x*Q,y*Q,z*Q],rng={next:()=>51};
const entry=(slot,x=100,y=100)=>({poolSlot:slot,group:35,positionQ12:point(x,y)});
const ground={width:84,height:24,pixelWidth:672,readTerrain:()=>0,readClearance:()=>4,cageAt:()=>({definitionIndex:35})};
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('ordinary footpoints separate two/six coincident residents deterministically within the total two-pixel frame budget',()=>{
  for(const count of [2,6]){
    let entries=Array.from({length:count},(_,i)=>entry(i));
    const first=separateGroundFootpoints(entries),reverse=separateGroundFootpoints([...entries].reverse());
    assert.deepEqual(first.points,[...reverse.points].reverse(),'stable physical slots, independent of input ordering');
    for(let frame=0;frame<120;frame++){
      const before=entries.map(e=>[...e.positionQ12]),r=separateGroundFootpoints(entries);
      r.correctionQ12.forEach((cost,i)=>{assert.ok(cost<=2*Q);assert.ok(distance(before[i],r.points[i])<=2*Q);});
      entries=entries.map((e,i)=>({...e,positionQ12:r.points[i]}));
    }
    assert.equal(separateGroundFootpoints(entries).unresolved,0);
  }
  const noOverlap=[entry(0,50,50),entry(1,66,50),entry(2,100,100)];
  assert.deepEqual(separateGroundFootpoints(noOverlap).points,noOverlap.map(e=>e.positionQ12));
  assert.deepEqual(separateGroundFootpoints([entry(0),entry(1),entry(2)],{passes:99}),separateGroundFootpoints([entry(0),entry(1),entry(2)],{passes:2}));
  const source=fs.readFileSync(new URL('../src/championship/spatial/groundFootpointSeparation.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|Date\.|performance\.|\.next\(/,'helper has no RNG/clock authority');
});

test('same-cage ground spacing keeps sleeping bodies fixed and excludes carried, airborne, evolving and legal feeding positions',()=>{
  const actor=(slot,state=1)=>({...entry(slot),state,cageDefinitionIndex:35,foodSlot:null});
  const sleeper=actor(0,4),walker=actor(1),otherCage={...actor(2),cageDefinitionIndex:36};
  const sleepPoint=[...sleeper.positionQ12],foreignPoint=[...otherCage.positionQ12];
  separateNativeRaisingGroundActors([sleeper,walker,otherCage],ground);
  assert.deepEqual(sleeper.positionQ12,sleepPoint);assert.deepEqual(otherCage.positionQ12,foreignPoint);
  assert.notDeepEqual(walker.positionQ12,sleepPoint);
  for(const extra of [{state:6},{state:7},{positionQ12:point(100,100,1)},{evolution:{}},{detached:true},{state:12}])
    assert.equal(nativeRaisingSpacingRole({...actor(0),...extra}),null);
  const foodActors=[{...actor(0,5),foodSlot:0,station:0,positionQ12:point(84,96)},
    {...actor(1,5),foodSlot:0,station:3,positionQ12:point(84,104)}];
  const before=structuredClone(foodActors);assert.equal(separateNativeRaisingGroundActors(foodActors,ground).changed,false);
  assert.deepEqual(foodActors,before,'the native same-side food stations remain eight pixels apart');
});

test('trial correction respects walls, crossed corners, wrap seams, narrow spaces and cage ownership without teleporting',()=>{
  assert.equal(canTraverseGroundStep(point(7,7),point(9,9),{canStand:p=>!(p[0]>=8*Q&&p[1]<8*Q)}),false);
  const blocked=[entry(0),entry(1)];assert.equal(separateGroundFootpoints(blocked,{canPlace:()=>false}).changed,false);
  const seam=[entry(0,1,50),entry(1,671,50)],r=separateGroundFootpoints(seam,{wrapXQ12:672*Q});
  assert.ok(r.changed);r.points.forEach(p=>assert.ok(p[0]>=0&&p[0]<672*Q));
  const boundaryGround={...ground,cageAt:x=>({definitionIndex:x<100?35:36})};
  const actors=[{state:1,foodSlot:null,poolSlot:0,cageDefinitionIndex:35,positionQ12:point(99,50)},
    {state:1,foodSlot:null,poolSlot:1,cageDefinitionIndex:35,positionQ12:point(99,50)}];
  for(let i=0;i<12;i++)separateNativeRaisingGroundActors(actors,boundaryGround);
  actors.forEach(a=>assert.ok(a.positionQ12[0]<100*Q));
  assert.equal(separateGroundFootpoints(blocked,{canPlace:()=>false}).unresolved,1,'no room remains unresolved');
});

test('continuous peer approach stops at the existing target-width distance and resumes without another timer or RNG',()=>{
  const peer={speciesIndex:8,state:1,positionQ12:point(200,100)},radius=nativeRaisingPeerStopDistanceQ12(peer);
  let a={mode:2,ticks:500,threshold:0,angleQ12:0,desiredAngleQ12:0,state:2,slow:0,fast:0,peer,
    positionQ12:[200*Q-radius+Q/2,100*Q,0],destinationQ12:point(200,100)};
  const before=[...a.positionQ12];a=stepNativeRaisingMovement(a,ground);
  assert.deepEqual(a.positionQ12,before);assert.equal(a.ticks,499);
  peer.positionQ12[0]+=40*Q;a=stepNativeRaisingMovement(a,ground);
  assert.ok(a.positionQ12[0]>before[0]);assert.equal(a.ticks,498);
  for(let i=0;i<100;i++)a=stepNativeRaisingMovement(a,ground);
  assert.ok(distance(a.positionQ12,peer.positionQ12)>=radius-2,'approach cannot advance through its stop radius');
});

function hungryResidents(){
  const species=nativeHuntSpeciesByIndex(8),actors=[],profiles=[];
  for(let i=0;i<4;i++){
    const raw=createNativeHuntIndividual({species,rng});Object.assign(raw.fields,{'008':species.field1c-1,'050':raw.fields['058'],'00c':0,'134':0,'138':0});
    const p=nativeIndividualProfile(raw),a=createNativeRaisingActor(p,i);
    initializeNativeRaisingActor(a,p,point(i<2?70:130,i%2?120:80),35,rng);actors.push(a);profiles.push(p);
  }
  const food=createNativeRaisingFood({slot:0,cageDefinitionIndex:35,positionQ12:point(100,100),restored:true});
  const feeding={ground,foods:[food],signals:new Map([[35,{search:true}]]),actors};
  actors.forEach((a,i)=>{profiles[i]=stepNativeRaisingActor(a,profiles[i],{ageDelta:0,rng,feeding}).profile;});
  return {actors,profiles,food,feeding};
}
test('food stations are reserved before arrival, retain four unique claims and release on carry/interruption/evolution/cage/invalid/eaten',()=>{
  const {actors,profiles,food}=hungryResidents();
  assert.equal(food.remaining,16);assert.equal(new Set(food.occupants).size,4);
  actors.forEach(a=>{assert.equal(a.state,2);assert.equal(food.occupants[a.station],a.poolSlot);});
  beginNativeRaisingCarry(actors[0],profiles[0],{x:70,y:80},{foods:[food],rng});assert.ok(!food.occupants.includes(0));
  interruptNativeRaisingFeeding(actors[1],[food],rng);assert.ok(!food.occupants.includes(1));
  beginNativeRaisingEvolution(actors[2],{target:8},rng,[food]);assert.ok(!food.occupants.includes(2));
  enterNativeRaisingCage(actors[3],profiles[3],{previousDefinition:35,ground,season:0,foods:[food]},rng);assert.ok(!food.occupants.includes(3));
  for(const mutate of [({actors})=>actors[0].detached=true,({actors})=>actors[0].cageDefinitionIndex=36,
    ({actors})=>actors[0].state=12,({food})=>food.present=false,({actors})=>actors.splice(0,1)]){
    const fixture=hungryResidents();mutate(fixture);reconcileNativeFoodReservations(fixture.actors,[fixture.food]);
    assert.ok(!fixture.food.occupants.includes(0));
  }
  const a=hungryResidents();a.food.present=false;
  stepNativeRaisingActor(a.actors[0],a.profiles[0],{ageDelta:0,rng,feeding:a.feeding});
  assert.equal(a.actors[0].foodSlot,null);assert.ok(!a.food.occupants.includes(0));
  const projected=projectNativeRaisingActor(actors[1]);assert.deepEqual(projected.positionQ12,actors[1].positionQ12);
});

test('Hunt only spaces visible ordinary ground roaming and probes pure terrain without tool-controller side effects',()=>{
  const base={actorActive:1,wildActive:1,aiState:1,currentHp:100,positionQ12:point(80,80)};
  assert.equal(nativeHuntGroundSpacingEligible(base),true);
  for(const extra of [{hidden:true},{cardState:'HAND_ANIMATION'},{cardState:'ON_CARD'},{tutorialScripted:true},{bound:1},
    {pull13:1},{pull11:1},{trapReady:true},{handReady:true},{aiState:10},{aiState:6},{aiState:4},{positionQ12:point(80,80,1)},
    {currentHp:0},{foodTarget:{}},{seekingFood:1},{decoyCenter:[0,0]},{movementRestricted:1},{shotShakeTicks:1}])
    assert.equal(nativeHuntGroundSpacingEligible({...base,...extra}),false,JSON.stringify(extra));
  let reads=0;const actors=[structuredClone(base),structuredClone(base)];
  assert.ok(separateNativeHuntGroundActors(actors,{width:128,height:128,readTerrain:()=>{reads++;return 0;},
    queryControllers:()=>assert.fail('trial position must not trigger mines, wires or traps')}).changed);
  assert.ok(reads>0);
});

test('normal Hunt controller tick updates its authoritative Q12 point before selection, display and rope read it',()=>{
  const pool=JSON.parse(fs.readFileSync('docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json','utf8'));
  const individual=structuredClone(pool.poolVectors[0].records[0]);
  const record={speciesIndex:individual.fields['000'],individual,positionQ12:point(80,80),facing:1,
    ai:{state:1,speedQ12:4096,field054:1,field1e0:0,field1d8:600}};
  const controls=createNativeHuntFieldControls({records:[record,structuredClone(record)],wildIds:['left','right'],
    environment:{width:128,height:128,readTerrain:()=>0,readDirectionCell:()=>({blendQ12:205,unknownDirection:0,escapeBoundary:false})},
    rng:{next:()=>51},loadout:{getSelectedEquipment:()=>[{...HUNT_EQUIPMENT_ITEMS.find(i=>i.equipmentClass==='ROPE'),quantity:1}]},
    consumeItem:()=>assert.fail('spacing cannot consume inventory'),maxCardG:32});
  controls.actors.forEach(a=>{a.counter=0;a.awakeCounter=0;});
  controls.tick(17);
  assert.notDeepEqual(controls.actors[0].positionQ12,point(80,80));
  for(const a of controls.actors){const v=controls.getActors().find(v=>v.wildId===a.wildId);
    assert.equal(v.worldX,a.positionQ12[0]/2048);assert.equal(v.worldY,a.positionQ12[1]/2048);
    assert.ok(distance(a.positionQ12,point(80,80))<=2*Q);}
  const tap=controls.actors[1].positionQ12.map(n=>Math.floor(n/Q)*Q);
  const a=queryNativeHuntActors(controls.actors,tap,[0,0,0,0]).at(-1);
  assert.equal(controls.selectAt(tap[0]/2048,tap[1]/2048),true);
  assert.equal(controls.getAvailability().targetWildId,a.wildId);
  a.bound=1;controls.selectTool('ROPE');controls.pointerDown(a.positionQ12[0]/2048,a.positionQ12[1]/2048);
  assert.deepEqual(controls.getState().rope.from,[a.positionQ12[0]/2048,a.positionQ12[1]/2048-20]);
});

test('Battle retains its native 8-to-16 separation, exact-boundary/skip/XYZ semantics and deterministic coincidence',()=>{
  const far=()=>[point(100,100),point(108,100),point(300,300),point(400,400),point(500,500),point(600,600)];
  const p=far();updateNormalBattleGeometry(p);assert.deepEqual(p.slice(0,2),[point(96,100),point(112,100)]);
  const exact=far();exact[1]=point(116,100);const copy=structuredClone(exact);updateNormalBattleGeometry(exact);assert.deepEqual(exact,copy);
  const skipped=far(),before=structuredClone(skipped);updateNormalBattleGeometry(skipped,true);assert.deepEqual(skipped,before);
  const xyz=far();xyz[1]=point(100,100,20);const original=structuredClone(xyz);updateNormalBattleGeometry(xyz);assert.deepEqual(xyz,original);
  const same=far();same[1]=[...same[0]];const repeat=structuredClone(same);updateNormalBattleGeometry(same);updateNormalBattleGeometry(repeat);
  assert.deepEqual(same,repeat);assert.deepEqual(same.slice(0,2).map(p=>p[2]),[0,0]);
});

test('one actual Battle session tick calls the existing normal resolver once and projects the same memory footpoints',()=>{
  const roster=Array(6).fill(null);for(const i of [0,3])roster[i]=createSessionCombatant({speciesId:8,currentHp:100,maxHp:100});
  const session=createBattleSession({roster,rng:{next:()=>0}});
  const actors=createBattleNativeActors({slots:session.slots,stands:Array.from({length:6},()=>({x:.5,y:.5,facing:1,evidence:'CONTROLLED'}))});
  const normal=createBattleNormalRuntime({session,actors,creatures:[],initialize:()=>{},applyStatus:()=>{}});let calls=0;
  session.normalFlow={...normal,afterActions(){calls++;normal.afterActions();}};
  session.slots.forEach(c=>{if(c){c.state=0;c.stateCounter=1;c.statePeriod=999;}});
  for(const [i,p] of [[0,point(100,100)],[3,point(108,100)]]){const ptr=actors.memory.readU32(actors.address(i),0x2c);p.forEach((v,j)=>actors.memory.writeU32(ptr,j*4,v));}
  const source=createBattlePresentationSource({session,step:s=>{stepBattleSession(s);actors.advance();},getNativeActor:actors.project});
  source.tick();assert.equal(calls,1);assert.equal(session.frame,1);
  for(const [i,p] of [[0,point(96,100)],[3,point(112,100)]]){
    assert.deepEqual(normal.snapshot().slots[i].point,p);assert.deepEqual(actors.position(i),p);
    const v=source.getView().combatants[i];assert.equal(v.stand.x*416*Q,p[0]);assert.equal(v.stand.y*272*Q,p[1]);
  }
  source.dispose();
});
