import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';

const scenarios=[];
for(const fixture of [{name:'single-opponent-final-down',match:0,seed:20},
  {name:'recovery-aborted-by-ending',match:1,seed:1},{name:'recovery-completes',match:1,seed:8}]){
  const schedule={entryMode:0,scheduleSlotA:2,scheduleSlotB:fixture.match?6:3,progressCounter:fixture.match?4:0};
  const runtime=createBattleRuntime({schedule,seed:fixture.seed});runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
  const source=runtime.startMatch(),initial=source.getView();
  let previous=initial,steps=0,hitFrames=0,peakEffects=0;const events=[],seen=new Set(),issues=new Map(),moves=new Set(),restorations=[];
  for(;steps<10000&&!source.getView().outcome.ended;steps++){
    source.tick();const v=source.getView();
    peakEffects=Math.max(peakEffects,v.impactEffects.length);
    if(v.nativeLifecycle.reactions.combatants.some(c=>c?.notification===15))hitFrames++;
    for(const event of v.nativeLifecycle.reactions.history){
      const key=JSON.stringify(event);if(!seen.has(key)){seen.add(key);events.push(event);}
    }
    v.combatants.forEach((c,slot)=>{
      if(c.present&&v.nativeLifecycle.reactions.combatants[slot].notification===20&&c.hp.current>previous.combatants[slot].hp.current)
        restorations.push({frame:v.animationFrame,clock:v.clock.frames,slot,hpBefore:previous.combatants[slot].hp.current,
          hpAfter:c.hp.current,maxHp:c.hp.maximum,resourceBefore:previous.combatants[slot].resource.current,
          resourceAfter:c.resource.current,sequence:c.animationRequest.sequenceId});
    });
    for(const launch of [...v.nativeLifecycle.active,...v.nativeLifecycle.recent]){
      moves.add(launch.moveId);
      if(launch.error||launch.unresolvedHostCalls.length||launch.needsObjectGraph.length){
        const issue={moveId:launch.moveId,error:launch.error,unresolvedHostCalls:launch.unresolvedHostCalls.map(a=>'0x'+a.toString(16)),needsObjectGraph:launch.needsObjectGraph};
        issues.set(JSON.stringify(issue),issue);
      }
    }
    previous=v;
  }
  const final=source.getView();
  scenarios.push({...fixture,schedule,steps,clock:final.clock.frames,moves:[...moves],hitFrames,peakEffects,
    hpBefore:initial.combatants.map(c=>c.hp?.current??null),hpAfter:final.combatants.map(c=>c.hp?.current??null),
    events,restorations,outcome:final.outcome,impacts:final.nativeLifecycle.impacts,
    activeLaunchesAfter:final.nativeLifecycle.active.length,issues:[...issues.values()]});runtime.dispose();
}
const files=['battleHitState.js','battleHitRuntime.js','battleSession.js','battleFrameLoop.js','battleDamageInputs.js','battleStatus.js','battleNativeActors.js','battleNativeLaunch.js']
  .map(f=>'src/championship/battle/'+f).concat(['src/championship/app/battleRuntime.js',
    'src/championship/app/battlePresentationSource.js','src/championship/presentation/vs5/createBattleFieldPixiPresentation.js',
    'src/data/championship/battleHitTables.json']);
const report={scope:'Normal existing AI with explicit schedule and RNG fixtures; no injected hits, HP or recovery outcomes',
  originalFullMatchParity:false,sourceHashes:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),scenarios};
fs.writeFileSync('docs/art/production/battle-hit-recovery-r8/normal-runtime.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(scenarios.map(({events,...s})=>({...s,eventCount:events.length})),null,2));
if(scenarios.some(s=>!s.outcome.ended||s.activeLaunchesAfter||s.impacts.active))process.exitCode=1;
