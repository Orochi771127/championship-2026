import test from 'node:test';import assert from 'node:assert/strict';
import {createDataArenaSimulation}from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import {createDataArenaGrid}from '../src/championship/modes/dataArena/dataArenaGrid.js';
import {DATA_ARENA_DUEL_MAP,DATA_ARENA_GRID_RULES,DATA_ARENA_TERRAIN as T}from '../src/championship/modes/dataArena/dataArenaConfig.js';
import {loadDataArenaInteractionArt}from '../src/championship/presentation/dataArena/dataArenaInteractionArt.js';
import {mountDataArenaInteractionView}from '../src/championship/presentation/dataArena/dataArenaInteractionView.js';
import fs from 'node:fs';import {createHash}from 'node:crypto';
const run=(sim,seconds,input={})=>{const events=[];for(let i=0;i<Math.round(seconds*60);i++){sim.step(typeof input==='function'?input(i):input);events.push(...sim.drainEvents());}return events;};
function quiet(partnerId='ember-lizard'){const sim=createDataArenaSimulation({seed:7,partnerId});const state=sim.getState();state.spawnTimer=Infinity;state.mate.jetTimer=Infinity;return{sim,state};}
test('real fixed-step inputs cannot dash over the unfrozen tournament channel',()=>{
 const sim=createDataArenaSimulation({seed:7,mode:'TOURNAMENT'});run(sim,3.25);
 for(let i=0;i<180&&sim.getState().player.y>672;i++)sim.step({moveY:-1});
 sim.step({moveY:-1,dash:true});run(sim,.4,{moveY:-1});
 assert.ok(sim.getState().player.y>=656);assert.equal(sim.grid.iceCount,0);assert.equal(sim.getState().stats.falls,0);
});
test('an explicit swimmer capability permits water traversal and dash without sinking',()=>{
 const{sim,state}=quiet();state.player.canSwim=true;Object.assign(state.player,{x:14.5*64,y:27.5*64});
 run(sim,.6,{moveY:1});assert.equal(sim.grid.surfaceAt(state.player.x,state.player.y),'WATER');assert.equal(state.player.state,'NORMAL');
 run(sim,.3,i=>({moveY:1,dash:i===0}));assert.equal(state.stats.falls,0);assert.equal(state.player.canSwim,true);
});
test('frostStep creates real ice under its full footprint before landing, without crossing solids',()=>{
 const{sim,state}=quiet('frost-drake');Object.assign(state.player,{x:14.5*64,y:27.5*64});
 assert.equal(sim.internals.beginCast(state.player,'frostStep',14.5*64,32*64),true);run(sim,.08);
 assert.ok(state.player.y>28*64);assert.ok(sim.grid.iceCount>0);assert.notEqual(sim.grid.surfaceAt(state.player.x,state.player.y),'WATER');assert.equal(state.stats.falls,0);
});
test('occupied ice melting interrupts a dash immediately and recovers on safe land',()=>{
 const{sim,state}=quiet();const p=state.player;Object.assign(p,{x:14.5*64,y:29.5*64,state:'DASH',dashTimer:.5,dashDirX:0,dashDirY:0});
 sim.grid.freezeCell(sim.grid.index(14,29),.025,[],'TEST');const events=run(sim,.85);
 assert.ok(events.some(e=>e.type==='FELL_IN_WATER'));assert.ok(events.some(e=>e.type==='RECOVERED'));assert.equal(p.state,'NORMAL');assert.equal(p.lunge,null);assert.equal(sim.grid.surfaceAt(p.x,p.y),'GROUND');assert.ok(p.hp>0);
});
test('a swimmer stays safe when occupied ice melts',()=>{
 const{sim,state}=quiet();Object.assign(state.player,{x:14.5*64,y:29.5*64,canSwim:true});sim.grid.freezeCell(sim.grid.index(14,29),.02,[]);
 run(sim,.2);assert.equal(state.stats.falls,0);assert.equal(state.player.state,'NORMAL');assert.equal(sim.grid.surfaceAt(state.player.x,state.player.y),'WATER');
});
test('only the authored timber allowlist can burn or lose blocking collision',()=>{
 const grid=createDataArenaGrid({map:DATA_ARENA_DUEL_MAP});assert.equal(grid.props.length,4);
 const protectedCell=grid.index(3,4);assert.equal(grid.propAtCell(protectedCell),null);assert.equal(grid.ignite(protectedCell,[]),false);
 const revision=grid.navRevision;const prop=grid.props[0];assert.equal(grid.blocksMove(prop.cells[0],'walker'),true);assert.equal(grid.blocksLaser(prop.cells[0]),true);
 grid.damageProp(prop,1000,[]);assert.equal(grid.blocksMove(prop.cells[0],'walker'),false);assert.equal(grid.blocksLaser(prop.cells[0]),false);assert.ok(grid.navRevision>revision);
 assert.equal(grid.terrain[protectedCell],T.SOLID);assert.equal(grid.terrain[0],T.STANDS);assert.equal(grid.damageProp(null,1000,[]),false);
});
test('existing laser hits damage and destroy timber, opening the actual ray and route',()=>{
 const{sim,state}=quiet();const prop=sim.grid.props[0];Object.assign(state.player,{x:(prop.col+1)*64,y:(prop.row+2)*64});
 const events=run(sim,3,{fire:true,aimX:(prop.col+1)*64,aimY:(prop.row+.5)*64});
 assert.equal(prop.destroyed,true);assert.ok(events.some(e=>e.type==='PROP_DESTROYED'));assert.equal(sim.grid.blocksLaser(prop.cells[0]),false);
});
test('a fire skill ignites timber and an ice skill douses it, leaving match scorch',()=>{
 const{sim,state}=quiet('frost-drake');const prop=sim.grid.props[0];Object.assign(state.player,{x:(prop.col+1)*64,y:(prop.row+2)*64});
 sim.grid.ignite(prop.cells[0],[],'SKILL');run(sim,.05);assert.ok(prop.charred);
 sim.internals.beginCast(state.player,'iceShard',(prop.col+1)*64,(prop.row+.5)*64);run(sim,.6);
 assert.ok(prop.hp<prop.maxHp);assert.equal(sim.grid.fire[prop.cells[0]],0);assert.ok(sim.grid.scorch[prop.cells[0]]>0);assert.ok(sim.grid.wet[prop.cells[0]]>0);
});
test('fire consumes a marked wooden prop; metal cover and stands remain protected',()=>{
 const grid=createDataArenaGrid();const prop=grid.props[0];grid.ignite(prop.cells[0],[]);const events=[];
 for(let i=0;i<620;i++)grid.step(1/60,events);
 assert.equal(prop.destroyed,true);assert.equal(prop.charred,true);assert.ok(events.some(e=>e.type==='PROP_DESTROYED'));assert.equal(grid.terrain[grid.index(7,7)],T.SOLID);assert.equal(grid.terrain[0],T.STANDS);
});
test('scorch survives extinguishing, cooldown expiry and tournament rounds, but not a new match',()=>{
 const grid=createDataArenaGrid();const i=grid.index(4,19);grid.ignite(i,[]);grid.applyWater(4.5*64,19.5*64,.3,[]);
 const mark=grid.scorch[i];assert.ok(mark>0);grid.step(100,[]);assert.equal(grid.scorch[i],mark);grid.resetDynamic();assert.equal(grid.scorch[i],mark);assert.equal(grid.wet[i],0);
 const fresh=createDataArenaGrid();assert.equal(fresh.scorch[i],0);
});
test('destructible prop damage persists across rounds and resets for a fresh simulation',()=>{
 const grid=createDataArenaGrid({map:DATA_ARENA_DUEL_MAP});const prop=grid.props[0];grid.damageProp(prop,1000,[]);grid.resetDynamic();assert.equal(prop.destroyed,true);assert.equal(grid.terrain[prop.cells[0]],T.GROUND);
 assert.equal(createDataArenaGrid({map:DATA_ARENA_DUEL_MAP}).props[0].destroyed,false);
});
test('player fire projectiles shorten ice just like hostile embers',()=>{
 const{sim}=quiet();const c=14,r=29;sim.grid.freezeCell(sim.grid.index(c,r),10,[]);
 sim.internals.spawnProjectile({owner:'player',kind:'PBOLT',onTerrain:'IGNITE',moveId:'emberBolt',x:(c+.5)*64,y:(r+.5)*64,vx:0,vy:0,radius:11,damage:20,hits:new Set(),pierce:0});
 const events=run(sim,.03);assert.ok(events.some(e=>e.type==='ICE_MELT_HIT'));assert.ok(sim.grid.ice[sim.grid.index(c,r)]<10-DATA_ARENA_GRID_RULES.emberIceMelt+.01);
});
test('an area skill damages a two-cell prop once and protects adjacent metal',()=>{
 const{sim,state}=quiet();const prop=sim.grid.props[0];Object.assign(state.player,{x:(prop.col+1)*64,y:(prop.row+2)*64});
 sim.internals.beginCast(state.player,'flameRing',(prop.col+1)*64,(prop.row+.5)*64);run(sim,1.08);
 assert.ok(prop.hp<90&&prop.hp>80,'one 34 damage blast plus a few burn ticks, not one hit per cell');assert.ok(prop.cells.some(i=>sim.grid.fire[i]>0));assert.equal(sim.grid.terrain[sim.grid.index(7,7)],T.SOLID);
});
test('a frost lens beam douses burning timber instead of re-igniting it',()=>{
 const{sim,state}=quiet('frost-drake');const prop=sim.grid.props[0];Object.assign(state.player,{x:(prop.col+1)*64,y:(prop.row+2)*64});sim.grid.ignite(prop.cells[0],[]);run(sim,.05);
 run(sim,.3,{fire:true,aimX:(prop.col+1)*64,aimY:(prop.row+.5)*64});assert.equal(prop.cells.some(i=>sim.grid.fire[i]>0),false);assert.ok(prop.cells.some(i=>sim.grid.scorch[i]>0));
});
test('the original interaction kit and its collision-bound state variants retain exact file hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../assets/production/data-arena/interactions-v1/manifest.json',import.meta.url)));
 assert.deepEqual(Object.keys(manifest.props),['INTACT','DAMAGED','BURNT','DESTROYED']);assert.equal(manifest.harborPatches.length,4);assert.equal(manifest.rights,'PROJECT_ORIGINAL');assert.deepEqual(manifest.weights,[]);
 for(const f of manifest.files){const data=fs.readFileSync(new URL('../'+f.src,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),f.sha256);}
});
test('interaction art waits for in-flight decoders and unloads the complete partial scope after failure',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../assets/production/data-arena/interactions-v1/manifest.json',import.meta.url)));const live=new Set();let n=0;
 const PIXI={Assets:{async load(src){src=typeof src==='string'?src:src.src;if(src.endsWith('manifest.json')){live.add(src);return manifest;}if(n++===0)throw Error('decode failed');await new Promise(r=>setTimeout(r,4));live.add(src);return{};},async unload(src){live.delete(src);}}};
 await assert.rejects(loadDataArenaInteractionArt({PIXI,map:DATA_ARENA_DUEL_MAP,href:'http://localhost/championship.html'}),/decode failed/);assert.equal(live.size,0);
});
test('physical damage never selects the burned texture and low debris sorts below traversing actors',()=>{
 const grid=createDataArenaGrid({map:DATA_ARENA_DUEL_MAP}),manifest=JSON.parse(fs.readFileSync(new URL('../assets/production/data-arena/interactions-v1/manifest.json',import.meta.url)));
 const textures=new Map(Object.values(manifest.props).map(p=>[p.high.src,p.high.src]));
 class Sprite{constructor(texture){this.texture=texture;this.position={set(x,y){this.x=x;this.y=y;}};}}
 const objects={children:[],addChild(s){this.children.push(s);}},ground={addChild(){}};
 const view=mountDataArenaInteractionView({PIXI:{Sprite},grid,art:{manifest,textures,tier:'high'},objects,ground});
 const prop=grid.props[0],bounds={left:0,top:0,right:2000,bottom:2000};grid.damageProp(prop,90,[],'PROJECTILE');view.update(bounds);
 assert.equal(view.diagnostics().props[0].texture,'DAMAGED');assert.equal(prop.charred,false);
 grid.damageProp(prop,1,[],'FIRE');view.update(bounds);assert.equal(view.diagnostics().props[0].texture,'BURNT');
 grid.damageProp(prop,100,[],'PROJECTILE');view.update(bounds);assert.equal(view.diagnostics().props[0].texture,'DESTROYED');assert.ok(objects.children[0].zIndex<prop.row*grid.cell);
});
