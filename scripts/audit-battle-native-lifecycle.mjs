import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';

const scenarios=[];
for(const schedule of [{entryMode:0,scheduleSlotA:2,scheduleSlotB:3,progressCounter:0},
  {entryMode:0,scheduleSlotA:2,scheduleSlotB:6,progressCounter:4}]){
  const runtime=createBattleRuntime({schedule});runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
  const source=runtime.startMatch(),initial=source.getView();
  const moves=new Set(),issues=new Set(),impacts=new Map(),poses=new Set();let peakEffects=0,steps=0;
  for(;steps<10000&&!source.getView().outcome.ended;steps++){
    source.tick();const v=source.getView();peakEffects=Math.max(peakEffects,v.impactEffects.length);
    for(const effect of v.impactEffects)if(!impacts.has(effect.id))impacts.set(effect.id,
      {id:effect.id,type:effect.type,clock:v.clock.frames,systemId:effect.systemId});
    for(const c of v.combatants)if(c.present&&c.animationRequest?.sequenceRequestId)poses.add(`${c.speciesId}:${c.animationRequest.sequenceId}`);
    for(const x of [...v.nativeLifecycle.active,...v.nativeLifecycle.recent]){
      moves.add(x.moveId);
      if(x.error||x.unresolvedHostCalls.length||x.needsObjectGraph.length)issues.add(JSON.stringify({moveId:x.moveId,
        error:x.error,unresolvedHostCalls:x.unresolvedHostCalls.map(a=>'0x'+a.toString(16)),needsObjectGraph:x.needsObjectGraph}));
    }
  }
  const v=source.getView();
  scenarios.push({schedule,match:runtime.getChosenMatch().recordIndex,steps,clock:v.clock.frames,
    species:initial.combatants.filter(c=>c.present).map(c=>c.speciesId),moves:[...moves],poses:[...poses],
    hpBefore:initial.combatants.map(c=>c.hp?.current??null),hpAfter:v.combatants.map(c=>c.hp?.current??null),
    resourceBefore:initial.combatants.map(c=>c.resource?.current??null),resourceAfter:v.combatants.map(c=>c.resource?.current??null),
    outcome:v.outcome,settlement:runtime.getSettlementResult(),peakEffects,impacts:v.nativeLifecycle.impacts,
    activeLaunchesAfter:v.nativeLifecycle.active.length,impactStarts:[...impacts.values()],issues:[...issues].map(JSON.parse)});
  runtime.dispose();
}
const files=['battleNativeActors.js','battleNativeLaunch.js','battleImpactEffects.js','battleScriptVm.js',
  'battleScriptNatives.js','battleMoveScriptRun.js','battleActionApplication.js','battleSession.js'].map(n=>'src/championship/battle/'+n);
files.push('src/championship/app/battleRuntime.js','src/championship/app/battlePresentationSource.js');
files.push('src/championship/app/main.js','src/championship/presentation/vs5/createBattleVfxThreeOverlay.js',
  'src/championship/presentation/vs5/createBattleFieldPixiPresentation.js');
const report={scope:'NORMAL_AI_RUNTIME_WITH_EXPLICIT_SCHEDULE_FIXTURES',originalParityClaim:false,
  sourceHashes:Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),scenarios};
const target='docs/art/production/battle-native-lifecycle-r7/normal-runtime.json';
fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(scenarios.map(({impactStarts,...s})=>s),null,2));
if(scenarios.some(s=>!s.outcome.ended||s.activeLaunchesAfter||s.impacts.active))process.exitCode=1;
