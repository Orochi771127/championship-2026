import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataArenaSimulation } from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import { relayFacing8, relayMove, relayTeamIds, relayKit, RELAY_LOADOUTS } from '../src/championship/modes/dataArena/dataArenaRelay.js';
import { sampleDataArenaRelayAction, dataArenaRelaySlotPlacement } from '../src/championship/presentation/dataArena/dataArenaCharacterAction.js';
import { sanitizeDataArenaRecords, defaultDataArenaRecords } from '../src/championship/modes/dataArena/dataArenaSave.js';
import { RELAY_ROSTER } from '../src/championship/modes/dataArena/dataArenaRelayRoster.js';
import { RELAY_MAP_IDS, relayBattleMap, relayRotateCell } from '../src/championship/modes/dataArena/dataArenaRelayMaps.js';
import { createDataArenaGrid } from '../src/championship/modes/dataArena/dataArenaGrid.js';
import { createDataArenaCamera } from '../src/championship/presentation/dataArena/dataArenaCamera.js';
const run = (sim, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.step(input); };
const create = () => { const sim = createDataArenaSimulation({ mode:'RELAY', partnerId:'corona-cub', seed:19 }); run(sim, 2.1); return sim; };

test('relay adapters keep our identities and eight movement directions', () => {
  assert.deepEqual(relayTeamIds('corona-cub'), ['corona-cub','frost-drake']);
  assert.equal(new Set(Array.from({length:8},(_,i)=>relayFacing8(i*Math.PI/4))).size,8);
  assert.equal(relayMove('relayRay').energy,0);
  assert.equal(relayMove('dawnLance',true).energy,80);
});
test('relay spends TP once, releases once and locks another skill through recovery', () => {
  const sim=create(),p=sim.getState().player; sim.drainEvents();
  sim.step({cast:0,autoAim:true});
  assert.equal(p.energy,78); assert.equal(p.action.moveId,'sunSpear');
  run(sim,.3); assert.ok(p.recovery>0);
  assert.equal(sim.internals.beginCast(p,'scatterLight',900,700),false);
  const events=sim.drainEvents(); assert.equal(events.filter(e=>e.type==='CAST_RELEASE'&&e.casterId===p.id).length,1);
  run(sim,.35); assert.equal(p.action,null);
  assert.ok(sim.internals.beginCast(p,'scatterLight',900,700));
});
test('switch preserves independent HP TP and cooldowns and cannot reset the resource', () => {
  const sim=create(),p=sim.getState().player;
  p.hp=110; p.energy=41; p.cooldowns.sunSpear=5;
  sim.step({switchPartner:true});
  assert.equal(p.speciesId,'species-061'); assert.equal(p.energy,100);
  assert.equal(sim.getSnapshot().relay.team[0].hp,110);
  assert.equal(sim.getSnapshot().relay.team[0].tp,41);
  sim.step({switchPartner:true}); assert.equal(p.speciesId,'species-061');
  // Disable rival damage for this isolated resource contract, not browser proof.
  sim.getState().rivals[0].active=false;
  run(sim,6.1); sim.step({switchPartner:true});
  assert.equal(p.speciesId,'species-064'); assert.equal(p.hp,110);
  assert.ok(p.energy<42); assert.equal(p.cooldowns.sunSpear,0);
});
test('knockout replaces the player once and whole-team defeat settles', () => {
  const sim=create(),state=sim.getState();
  state.rivals[0].active=false;
  sim.internals.hurtPlayer(1000,'TEST',0,0); run(sim,1.2);
  assert.equal(state.player.speciesId,'species-061'); assert.equal(state.player.state,'NORMAL');
  run(sim,1); sim.internals.hurtPlayer(1000,'TEST',0,0); run(sim,1.5);
  assert.equal(state.result.outcome,'DEFEAT'); assert.equal(state.result.mode,'RELAY');
  assert.equal(state.result.tournament,null);
});
test('both rival knockouts settle victory and a new match has clean team resources', () => {
  const sim=create(),state=sim.getState();
  state.rivals[0].invulnerable=0; sim.internals.damageRival(state.rivals[0],1000,'TEST'); run(sim,1.2);
  assert.equal(state.relay.enemyIndex,1); assert.equal(state.rivals[0].definitionId,'flame');
  state.rivals[0].invulnerable=0; sim.internals.damageRival(state.rivals[0],1000,'TEST'); run(sim,1.5);
  assert.equal(state.result.outcome,'VICTORY');
  assert.equal(create().getSnapshot().relay.team[0].tp,100);
});
test('relay animation maps ticks around release without dropping repeated slots or anchors', () => {
  const animation={id:8,hitFrame:2,frames:[{texture:'same',ticks:3,anchor:[1,2]},{texture:'same',ticks:9,anchor:[5,7]},{texture:'next',ticks:6,anchor:[8,9]}]};
  const original=JSON.stringify(animation),action={id:12,moveId:'sunSpear',startedAt:1,releasedAt:null,windup:.4,recovery:.3};
  assert.ok(Math.abs(sampleDataArenaRelayAction({animation,action,time:1.2}).elapsedMs - 100) < 1e-9);
  action.releasedAt=1.4;
  const release=sampleDataArenaRelayAction({animation,action,time:1.4});
  assert.equal(release.elapsedMs,200); assert.equal(release.phase,'RECOVERY');
  assert.equal(JSON.stringify(animation),original);
});
test('old arena records remain compatible while relay records use the same writer schema', () => {
  const old=defaultDataArenaRecords(); assert.deepEqual(sanitizeDataArenaRecords(old),old);
  const next=sanitizeDataArenaRecords({...old,lastMode:'RELAY',modes:{RELAY:{runs:1,wins:1,bestScore:5}}});
  assert.equal(next.lastMode,'RELAY'); assert.equal(next.modes.RELAY.wins,1); assert.equal(next.schemaVersion,1);
});

test('equipped moves are validated per body and every selectable move releases', () => {
  assert.deepEqual(relayKit('ember-lizard',['iceShard','emberBolt','emberBolt']).moves,['emberBolt','fangRush','flameRing']);
  for(const [partnerId,moves] of Object.entries(RELAY_LOADOUTS))for(const id of moves) {
    const sim=createDataArenaSimulation({mode:'RELAY',partnerId,relayLoadouts:{[partnerId]:[id]},seed:19});
    run(sim,2.1);sim.drainEvents();sim.step({cast:0,autoAim:true});run(sim,.7);
    assert.ok(sim.drainEvents().some(e=>e.type==='CAST_RELEASE'&&e.moveId===id),id);
    assert.equal(sim.getSnapshot().kit.moves[0].id,id);
  }
});
test('texture reuse preserves slot-local anchors and displacement', () => {
  const geometry={frames:{shared:{origin:[12,18],sourceSize:[32,32],scale:4}}};
  const first=dataArenaRelaySlotPlacement({texture:'shared',anchor:[4,8],offset:[2,3]},geometry,{});
  const second=dataArenaRelaySlotPlacement({texture:'shared',anchor:[8,16],offset:[-2,5]},geometry,{});
  assert.deepEqual(first.anchor,{x:.125,y:.25});assert.deepEqual(second.anchor,{x:.25,y:.5});
  assert.deepEqual(first.offset,[2,3]);assert.deepEqual(second.offset,[-2,5]);
});

test('all 196 eligible identities keep stable species IDs, kits and independently selectable reserve',()=>{
  assert.equal(RELAY_ROSTER.length,199);assert.equal(new Set(RELAY_ROSTER.map(p=>p.speciesId)).size,199);
  for(const p of RELAY_ROSTER){assert.ok(p.generationIndex>=3&&p.generationIndex<=6);assert.equal(Number(p.speciesId.slice(-3)),p.speciesIndex);assert.equal(relayKit(p.id).moves.length,3);assert.ok(relayMove(relayKit(p.id).ultimate,true));}
  assert.ok(RELAY_ROSTER.some(p=>p.speciesIndex===230));assert.ok(!RELAY_ROSTER.some(p=>p.speciesIndex===228));
  const reserve=RELAY_ROSTER.at(-1).id,sim=createDataArenaSimulation({mode:'RELAY',partnerId:'ember-lizard',relayReserveId:reserve});run(sim,2.1);sim.step({switchPartner:true});
  assert.equal(sim.getState().player.speciesId,RELAY_ROSTER.at(-1).speciesId);
  const saved=sanitizeDataArenaRecords({...defaultDataArenaRecords(),lastPartnerId:reserve,relayReserveId:'ember-lizard',relayArenaId:RELAY_MAP_IDS[10],relayLoadouts:{[reserve]:relayKit(reserve).moves}});
  assert.equal(saved.lastPartnerId,reserve);assert.equal(saved.relayArenaId,RELAY_MAP_IDS[10]);
});

test('all 11 maps rotate every terrain and ice cell and both safe spawns together',()=>{
  assert.equal(RELAY_MAP_IDS.length,11);
  for(const id of RELAY_MAP_IDS){
    const wide=relayBattleMap(id,false),tall=relayBattleMap(id,true),a=createDataArenaGrid({map:wide}),b=createDataArenaGrid({map:tall});
    assert.equal(b.cols,34);assert.equal(b.rows,52);
    assert.deepEqual(tall.playerSpawn,relayRotateCell(wide.playerSpawn));assert.deepEqual(tall.rivalSpawn,relayRotateCell(wide.rivalSpawn));
    for(let r=0;r<34;r++)for(let c=0;c<52;c++){const [x,y]=relayRotateCell([c,r]);assert.equal(a.terrain[a.index(c,r)],b.terrain[b.index(x,y)]);assert.equal(a.naturalIce[a.index(c,r)],b.naturalIce[b.index(x,y)]);}
    const sim=createDataArenaSimulation({mode:'RELAY',relayArenaId:id,portrait:true});run(sim,2.1,{moveX:1});
    const p=sim.getState().player;assert.notEqual(sim.grid.surfaceAt(p.x,p.y),'SOLID');assert.equal(p.hp,p.maxHp);
  }
});

test('portrait and landscape cameras cover the map without black gutters',()=>{
  for(const [width,height] of [[390,844],[1280,720]]) {
    const tall=height>width,worldWidth=tall?1088:1664,worldHeight=tall?1664:1088;
    const cam=createDataArenaCamera({worldWidth,worldHeight,cover:true,shake:false});
    for(const target of [{x:100,y:300},{x:worldWidth-100,y:worldHeight-100}]){
      const v=cam.update({dtMs:16,viewport:{width,height},target,opponent:{x:worldWidth/2,y:worldHeight/2}});
      assert.ok(v.x<=.001&&v.y<=.001);assert.ok(v.x+worldWidth*v.zoom>=width-.001);assert.ok(v.y+worldHeight*v.zoom>=height-.001);
    }
  }
});

test('relay area attacks cannot damage through solid cover or apply status during invulnerability',()=>{
  const sim=create(),s=sim.getState(),p=s.player,r=s.rivals[0];
  r.active=true;r.hp=300;r.invulnerable=2;p.x=600;p.y=700;r.x=650;r.y=700;
  assert.equal(sim.internals.damageRival(r,50,'SKILL'),false);assert.equal(r.hp,300);
  r.invulnerable=0;
  // Separate bodies with the existing solid columns at grid col=9,row=5.
  p.x=560;p.y=350;r.x=730;r.y=350;r.root=2;
  assert.equal(sim.internals.beginCast(p,'haloPulse',r.x,r.y),true);run(sim,.32);
  assert.equal(r.hp,300);
});

test('free basic attacks allow TP recovery and overlapping fighters separate without crossing cover',()=>{
  const sim=create(),s=sim.getState(),p=s.player,r=s.rivals[0];
  r.active=false;p.energy=30;p.energySpentAt=-10;run(sim,3,{fire:true,autoAim:true});
  assert.ok(p.energy>=77);assert.ok(s.stats.movesCast>=3);
  r.active=true;r.root=3;p.x=780;p.y=760;r.x=780;r.y=760;
  run(sim,.1);assert.ok(Math.hypot(r.x-p.x,r.y-p.y)>30);
});

test('zone targeting cannot place an attack beyond cover or spend TP on a blocked cast',()=>{
  const sim=create(),p=sim.getState().player;
  p.x=560;p.y=350;const before=p.energy;
  assert.equal(sim.internals.beginCast(p,'iceCage',730,350),false);
  assert.equal(p.energy,before);assert.equal(p.cast,null);
});
