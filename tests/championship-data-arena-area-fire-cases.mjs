import test from 'node:test';import assert from 'node:assert/strict';
import{createDataArenaSimulation}from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import{DATA_ARENA_MOVES,DATA_ARENA_GRID_RULES}from '../src/championship/modes/dataArena/dataArenaConfig.js';
const run=(sim,seconds)=>{const events=[];for(let i=0;i<Math.round(seconds*60);i++){sim.step({});events.push(...sim.drainEvents());}return events;};
const setup=()=>{const sim=createDataArenaSimulation({seed:7}),s=sim.getState();s.spawnTimer=Infinity;s.mate.jetTimer=Infinity;Object.assign(s.player,{x:928,y:1728});return{sim,s,i:sim.grid.index(14,28),x:928,y:1824};};
const relevant=['flameRing','coreNova','flamePillar','inferno'];
test('the four configured fire-area moves explicitly use IGNITE and only those area moves do',()=>{
 assert.deepEqual(Object.entries(DATA_ARENA_MOVES).filter(([,m])=>['ZONE','NOVA'].includes(m.type)&&m.effect==='IGNITE').map(([id])=>id),relevant);
});
for(const id of relevant)test(id+' thaws once per resolved burst, supports a second cast, and safely recovers an occupied melt',()=>{
 const move=DATA_ARENA_MOVES[id],{sim,s,i,x,y}=setup();sim.grid.freezeCell(i,30,[]);
 const cast=()=>assert.equal(sim.internals.beginCast(s.player,id,x,y,{ultimate:move.type==='NOVA'}),true);
 cast();let events=run(sim,2);assert.equal(events.filter(e=>e.type==='ICE_MELT_HIT'&&e.cell===i).length,1);
 assert.ok(Math.abs(sim.grid.ice[i]-(28-DATA_ARENA_GRID_RULES.emberIceMelt))<.002);
 const before=sim.grid.ice[i];events=run(sim,1);assert.equal(events.some(e=>e.type==='ICE_MELT_HIT'),false);assert.ok(Math.abs(before-sim.grid.ice[i]-1)<.002);
 run(sim,Math.max(0,(move.cooldown??0)-3+.1));const prior=sim.grid.ice[i];cast();events=run(sim,2);
 assert.equal(events.filter(e=>e.type==='ICE_MELT_HIT'&&e.cell===i).length,1);assert.ok(Math.abs(prior-sim.grid.ice[i]-2-DATA_ARENA_GRID_RULES.emberIceMelt)<.002);
 const occupied=setup();Object.assign(occupied.s.player,{x,y});
 occupied.sim.grid.freezeCell(occupied.i,(move.windup??0)+(move.delay??0)+DATA_ARENA_GRID_RULES.emberIceMelt*.5,[]);
 assert.equal(occupied.sim.internals.beginCast(occupied.s.player,id,x,y,{ultimate:move.type==='NOVA'}),true);
 events=run(occupied.sim,3.5);assert.ok(events.some(e=>e.type==='ICE_MELT_HIT'&&e.cell===occupied.i));assert.equal(events.filter(e=>e.type==='FELL_IN_WATER').length,1);assert.ok(events.some(e=>e.type==='RECOVERED'));assert.equal(occupied.sim.getSnapshot().player.surface,'GROUND');assert.ok(occupied.s.player.hp>0);
 assert.equal(events.some(e=>e.type==='FIRE_IGNITE'&&e.cell===occupied.i),false);
});
for(const id of ['quakeSlam','vortex','whiteout'])test(id+' does not gain fire melting from NONE, SLOW or ROOT tags',()=>{
 const{sim,s,i,x,y}=setup();sim.grid.freezeCell(i,20,[]);const move=DATA_ARENA_MOVES[id];assert.equal(sim.internals.beginCast(s.player,id,x,y,{ultimate:move.type==='NOVA'}),true);
 const events=run(sim,2);assert.equal(events.some(e=>e.type==='ICE_MELT_HIT'),false);assert.ok(sim.grid.ice[i]>17.9);assert.equal(sim.getSnapshot().stats.falls,0);
});
