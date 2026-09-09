import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';

// Only declared match/seed inputs. No direct damage, action or recovery writes.
export function auditNormalBattle({match=1,seed}){
 const schedule={entryMode:0,scheduleSlotA:2,scheduleSlotB:match?6:3,progressCounter:match?4:0};
 const runtime=createBattleRuntime({schedule,seed});runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
 const source=runtime.startMatch(),initial=source.getView();
 let previous=initial,steps=0,peakEffects=0,resumed=false;const history=new Map(),normal=new Map(),issues=new Map(),moves=new Set(),restorations=[];
 const effectBanks=new Set(),effectSequences=new Set();let movingEffects=0;const lastEffects=new Map();
 const exclusiveFlags={samples:0,cleared:0};
 const timing={pauseSamples:0,slowdownSamples:0,issues:[]};
 for(;steps<10000&&!source.getView().outcome.ended;steps++){
  source.tick();const v=source.getView(),life=v.nativeLifecycle;
  if(life.timing?.pause>0)timing.pauseSamples++;if(life.timing?.slowdown>0)timing.slowdownSamples++;
  for(const issue of life.timing?.issues??[])if(!timing.issues.includes(issue))timing.issues.push(issue);
  peakEffects=Math.max(peakEffects,v.impactEffects.length);
  for(const a of life.effectActors??[]){effectBanks.add(a.bankId);effectSequences.add(`${a.bankId}:${a.sequenceId}`);
   const old=lastEffects.get(a.id);if(old&&old.point.some((x,i)=>x!==a.point[i]))movingEffects++;
   lastEffects.set(a.id,a);
  }
  if(v.specialPrelude?.active&&v.specialPrelude.frame>1){exclusiveFlags.samples++;if(!(life.normalFlow.worldFlags&1))exclusiveFlags.cleared++;}
  for(const e of life.reactions.history)history.set(JSON.stringify(e),e);
  for(const e of life.normalFlow.history)normal.set(JSON.stringify(e),e);
  v.combatants.forEach((c,slot)=>{
   if(c.present&&life.reactions.combatants[slot].notification===20&&c.hp.current>previous.combatants[slot].hp.current)
    restorations.push({frame:v.animationFrame,clock:v.clock.frames,slot,hp:c.hp.current,maxHp:c.hp.maximum,sequence:c.animationRequest.sequenceId});
  });
  const ready=[...history.values()].filter(e=>e.type==='NOTIFICATION_CHANGED'&&e.from===20&&e.to===1);
  if(ready.some(e=>life.active.some(a=>a.ownerSlot===e.slot)))resumed=true;
  for(const launch of [...life.active,...life.recent]){
   moves.add(launch.moveId);
   if(launch.error||launch.unresolvedHostCalls.length||launch.needsObjectGraph.length){
    const issue={moveId:launch.moveId,error:launch.error,unresolvedHostCalls:launch.unresolvedHostCalls,needsObjectGraph:launch.needsObjectGraph,
      unresolvedDetails:launch.unresolvedDetails};issues.set(JSON.stringify(issue),issue);
   }
  }
  previous=v;
 }
 const v=source.getView(),events=[...history.values()],normalEvents=[...normal.values()];
 const result={match,seed,schedule,steps,clock:v.clock.frames,initial:initial.nativeLifecycle.normalFlow.slots,
  moves:[...moves],events,normalEvents,restorations,resumed,peakEffects,outcome:v.outcome,impacts:v.nativeLifecycle.impacts,
  effectPool:v.nativeLifecycle.effectPool,effectBanks:[...effectBanks],effectSequences:[...effectSequences],movingEffectFrames:movingEffects,
  contacts:v.nativeLifecycle.contacts,timing,
  activeLaunchesAfter:v.nativeLifecycle.active.length,slotsAfter:v.nativeLifecycle.normalFlow.slots,worldFlags:v.nativeLifecycle.normalFlow.worldFlags,exclusiveFlags,issues:[...issues.values()]};
 runtime.dispose();return result;
}

if(process.argv[1]?.replaceAll('\\','/').endsWith('/audit-battle-normal-flow.mjs')){
 const survey=process.argv.includes('--survey'),start=Number(process.argv.find(x=>x.startsWith('--start='))?.split('=')[1]??1),end=Number(process.argv.find(x=>x.startsWith('--end='))?.split('=')[1]??32);
 const fixtures=survey?Array.from({length:end-start+1},(_,i)=>({match:1,seed:start+i})):
  [{match:0,seed:20},...process.argv.filter(x=>x.startsWith('--seed=')).map(x=>({match:1,seed:Number(x.split('=')[1])}))];
 const scenarios=[];
 for(const f of fixtures){const s=auditNormalBattle(f);scenarios.push(s);
  console.log(JSON.stringify({match:s.match,seed:s.seed,steps:s.steps,clock:s.clock,restorations:s.restorations,resumed:s.resumed,
   cancel:s.events.some(e=>e.type==='NOTIFICATION_CHANGED'&&e.from===20&&e.to===21),outcome:s.outcome,
   launches:s.normalEvents.filter(e=>e.type==='LAUNCHED').length,issues:s.issues}));}
 const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6);
 if(out){const files=['battleNormalFlow.js','battleNormalRuntime.js','battleSession.js','battleNativeLaunch.js','battleScriptNatives.js','battleHitRuntime.js','battleNativeActors.js','battleEffectActors.js','battleProjectileContact.js']
  .map(f=>'src/championship/battle/'+f).concat(['src/championship/app/battleRuntime.js','src/data/championship/battleNormalFlowTables.json','src/data/championship/battleEffectProfiles.json']);
  fs.writeFileSync(out,JSON.stringify({scope:'Normal AI; explicit schedule and constructor RNG inputs; no injected hits or outcomes',originalFullMatchParity:false,
   sourceHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scenarios},null,2)+'\n');}
 if(scenarios.some(s=>!s.outcome.ended||s.activeLaunchesAfter||s.impacts.active||s.effectPool.active||s.effectPool.created!==s.effectPool.released||s.timing.issues.length))process.exitCode=1;
}
