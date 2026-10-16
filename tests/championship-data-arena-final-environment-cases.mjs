import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataArenaSimulation}from '../src/championship/modes/dataArena/dataArenaSimulation.js';
const run=(sim,n)=>{const out=[];for(let i=0;i<n;i++){sim.step({});out.push(...sim.drainEvents());}return out;};
function setup(){const sim=createDataArenaSimulation({seed:7}),s=sim.getState();s.spawnTimer=Infinity;s.mate.jetTimer=Infinity;return{sim,s};}
for(const offset of[-.001,0,.001])test(`resolved fire area includes cell centers on/inside radius but excludes outside (${offset})`,()=>{
 const{sim,s}=setup();Object.assign(s.player,{x:818,y:1728});
 const inside=sim.grid.index(14,28),diagonal=sim.grid.index(14,29);
 sim.grid.freezeCell(inside,30,[]);sim.grid.freezeCell(diagonal,30,[]);
 assert.equal(sim.internals.beginCast(s.player,'flameRing',818+offset,1824),true);
 const hits=run(sim,120).filter(e=>e.type==='ICE_MELT_HIT');
 assert.equal(hits.filter(e=>e.cell===inside).length,offset<0?0:1);
 assert.equal(hits.some(e=>e.cell===diagonal),false);
});
for(const action of['dash','cast'])test(`occupied melting cancels ${action}, clears motion and recovers onto nonburning safe ground`,()=>{
 const{sim,s}=setup(),p=s.player;Object.assign(p,{x:928,y:1888});
 sim.grid.freezeCell(sim.grid.index(14,29),.025,[]);
 // Unit fixture deliberately makes the closest bank unsafe, to exercise the
 // existing recovery search. This is not a browser acceptance state mutation.
 for(let c=12;c<=16;c++)sim.grid.fire[sim.grid.index(c,27)]=5;
 if(action==='dash')Object.assign(p,{state:'DASH',dashTimer:.5,dashDirX:0,dashDirY:0,vx:20,vy:20});
 else assert.equal(sim.internals.beginCast(p,'flamePillar',928,1760),true);
 let events=run(sim,8);assert.equal(p.state,'FALLING');assert.equal(p.cast,null);assert.equal(p.lunge,null);assert.equal(p.dashTimer,0);assert.equal(p.vx,0);assert.equal(p.vy,0);
 assert.equal(sim.getSnapshot().kit.casting,null);
 events.push(...run(sim,60));assert.equal(events.filter(e=>e.type==='FELL_IN_WATER').length,1);assert.ok(events.some(e=>e.type==='RECOVERED'));
 assert.equal(p.state,'NORMAL');assert.equal(sim.grid.surfaceAt(p.x,p.y),'GROUND');assert.equal(sim.grid.burningAt(p.x,p.y),false);assert.equal(sim.grid.blocksMove(sim.grid.index(sim.grid.cellOf(p.x),sim.grid.cellOf(p.y)),'walker'),false);
 assert.equal(events.some(e=>e.type==='ZONE_BURST'),false);
});
test('the configured rival AI resolves its own fire-area cast and thaws ice without player casts',()=>{
 const sim=createDataArenaSimulation({seed:7,mode:'TOURNAMENT'});run(sim,190);
 const s=sim.getState(),rival=s.rivals[0];assert.equal(rival.definitionId,'flame');assert.equal(s.tournament.status,'FIGHT');
 // Place the two bodies in an unobstructed encounter around the frozen
 // channel. Do not call beginCast or write the AI's kit, cooldowns or decisions.
 Object.assign(s.player,{x:928,y:576});Object.assign(rival,{x:928,y:448});
 for(let row=8;row<=9;row++)for(let col=0;col<24;col++)sim.grid.freezeCell(sim.grid.index(col,row),20,[]);
 let proved=false;const casts=[];
 for(let n=0;n<900;n++){
  const events=run(sim,1);const zone=events.find(e=>e.type==='ZONE_BURST'&&e.team==='rival'&&e.effect==='IGNITE');
  if(rival.cast)casts.push(rival.cast.id);
  if(zone&&events.some(e=>e.type==='ICE_MELT_HIT'&&Math.hypot((e.cell%24+.5)*64-zone.x,(Math.floor(e.cell/24)+.5)*64-zone.y)<=zone.radius)){proved=true;break;}
 }
 assert.equal(proved,true,'natural rival AI did not produce a fire area over the frozen encounter');assert.equal(s.stats.movesCast,0);
});
