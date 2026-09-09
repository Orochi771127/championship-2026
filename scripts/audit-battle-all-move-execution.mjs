import fs from 'node:fs';
import {createHash} from 'node:crypto';
import moves from '../src/data/championship/catalogs/battle-moves.r1.json' with {type:'json'};
import {createBattleNativeActors} from '../src/championship/battle/battleNativeActors.js';
import {createBattleNativeLaunch} from '../src/championship/battle/battleNativeLaunch.js';
import {createBattleEffectActors,battleEffectBankDemand} from '../src/championship/battle/battleEffectActors.js';
import {createBattleSoundEvents} from '../src/championship/battle/battleSoundEvents.js';
import {createBattleImpactEffects} from '../src/championship/battle/battleImpactEffects.js';
import {BATTLE_SPECIES_MOVEMENT} from '../src/data/championship/battleCharacterProfiles.js';

// Controlled actor/target native-script exercise. It does not claim the AI
// selected every move, original battle RNG history, or physical-device QA.
const results=[];
const maximum=Number(process.argv.find(x=>x.startsWith('--frames='))?.split('=')[1]??1000);
const resultCode=Number(process.argv.find(x=>x.startsWith('--result='))?.split('=')[1]??2);
const interruptAt=Number(process.argv.find(x=>x.startsWith('--interrupt='))?.split('=')[1]??-1);
if(![0,1,2].includes(resultCode))throw Error('INVALID_CONTROLLED_RESULT');
for(const record of moves.records.filter(r=>r.pointer1C)) {
  const actorSpeciesId=record.recordIndex<=30?81:record.speciesId;
  const slots=[{speciesId:actorSpeciesId,currentHp:1000,maxHp:1000},null,null,{speciesId:81,currentHp:1000,maxHp:1000},null,null];
  const stands=slots.map((c,i)=>({x:(i===0?180:200)/416,y:120/272,facing:i===0?1:-1,evidence:'EXPLICIT_CONTROLLED_SCRIPT_INPUT'}));
  const actors=createBattleNativeActors({slots,stands}),m=actors.memory,world=actors.worldAddress;
  const demand=battleEffectBankDemand([[record]]),effects=createBattleEffectActors({memory:m,worldAddress:world,loadedBankIds:demand.flatMap((n,i)=>n&&i?[i]:[])});
  const sound=createBattleSoundEvents(),impacts=createBattleImpactEffects();sound.attach(m);m.writeU32(0x02131c40,0,world);
  const owner=actors.address(0),target=actors.address(3),unknown=new Map(),seenCells=new Set(),seenImpactTypes=new Set();
  m.writeU32(owner,0x5c,target);
  // Normal launch C144 requests the move family before entering its script.
  actors.requestSequence(0,record.field10+7,'CONTROLLED_ORIGINAL_LAUNCH_FAMILY');
  let frame=0,hits=0,launch;
  launch=createBattleNativeLaunch({memory:m,index:0,owner,target,point:actors.targetPoint(3),record,ownerSlot:0,
    advanceOwned:o=>effects.advanceOwned(o),onSupport:()=>launch.startImpact({targetObject:target,xyz:actors.position(3)}),
    callNative(routine,args){
      const a=actors.call(routine,args);if(a!==undefined)return a;
      const e=effects.call(routine,args);if(e!==undefined)return e;
      const s=sound.call(routine,args,frame,record.recordIndex);if(s!==undefined)return s;
      const i=impacts.call(m,routine,args);if(i!==undefined)return i;
      if(routine===0x02114320||routine===0x0211436c)return BATTLE_SPECIES_MOVEMENT[actorSpeciesId][routine===0x02114320?'walkQ12':'runQ12'];
      if(routine===0x020431d4)return 0; // explicit lower RNG boundary
      if(routine===0x0211d740){if(!resultCode)return 0;hits++;
        launch.startImpact({targetObject:target,xyz:actors.position(3),targetBox:actors.box(3),resultCode,nativeKind:args[0],
          onSpark:kind=>impacts.spawnNative(m,{owner:launch.object,target,type:kind==='SECONDARY_3D'?(actorSpeciesId>=72?3:2):1})});return 1;}
      unknown.set(routine,args);return undefined;
    }});
  for(;frame<maximum;frame++){
    actors.setFrame(frame);launch.step();actors.advance();effects.advance();impacts.advance();
    for(const e of effects.snapshot())seenCells.add(`${e.bankId}:${e.cell}`);
    for(const e of impacts.snapshot())seenImpactTypes.add(e.type);
    const state=launch.snapshot();if(state.phase==='DONE'||state.phase==='ERROR')break;
    if(frame===interruptAt)break;
  }
  const final=launch.snapshot();launch.dispose();effects.advance();
  const releasedChildren=effects.diagnostics().active===0;
  for(let i=0;i<=30;i++)impacts.advance({isOwnerActive:()=>false});
  effects.clear();
  results.push({moveId:record.recordIndex,speciesId:record.speciesId,actorSpeciesId,kind:record.kind,frames:frame,phase:final.phase,error:final.error,
    missing:final.needsObjectGraph,unresolved:[...unknown].map(([address,args])=>({address:`0x${address.toString(16)}`,args})),
    effectsUnavailable:effects.diagnostics().unavailable,seenCells:[...seenCells],seenImpactTypes:[...seenImpactTypes],hits,sounds:sound.snapshot(),pool:effects.diagnostics(),
    releasedChildren,impacts:impacts.diagnostics(),interrupted:interruptAt>=0&&frame===interruptAt});
}
const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6);
if(out){const sourceFiles=fs.readdirSync('src/championship/battle').filter(f=>f.endsWith('.js')).map(f=>'src/championship/battle/'+f)
  .concat(['src/data/championship/battlePresentationProfiles.json']);
  fs.writeFileSync(out,JSON.stringify({scope:'CONTROLLED_NATIVE_ACTOR_TARGET_SCRIPTS_NOT_NORMAL_AI_ACCEPTANCE',resultCode,interruptAt,
    sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),results},null,2)+'\n');}
const groups=new Map();
for(const r of results){const key=JSON.stringify({phase:r.phase,error:r.error,missing:r.missing,unresolved:r.unresolved.map(x=>x.address),unavailable:r.effectsUnavailable});
  const g=groups.get(key)??{...JSON.parse(key),count:0,examples:[]};g.count++;if(g.examples.length<6)g.examples.push(r.moveId);groups.set(key,g);}
console.log(JSON.stringify({records:results.length,groups:[...groups.values()]},null,2));
if(results.some(r=>(!r.interrupted&&r.phase!=='DONE')||r.error||r.missing.length||r.unresolved.length||r.effectsUnavailable.length
  ||!r.releasedChildren||r.pool.active||r.impacts.active))process.exitCode=1;
