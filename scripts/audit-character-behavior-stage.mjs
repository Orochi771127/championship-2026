// Coverage inventory only. Passing resource/helper checks never promote a
// normal behavior/visual/device acceptance column.
import fs from 'node:fs';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../src/data/championship/battleCharacterProfiles.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const contract=read('docs/contracts/championship/CHARACTER_BEHAVIOR_RESTORATION_STAGE.v1.json');
const cpu=read('docs/research/RAISING_REACTION_DISPATCH_CPU_2026-09-10.json');
const reactions=cpu.reactions.filter(r=>r.state===9);
const output='reports/character-behavior-stage-2026-09-10';
const rows=Object.entries(BATTLE_SPECIES_ENTITIES).map(([index,entityId])=>{
  const speciesIndex=Number(index),bank=BATTLE_CHARACTER_PROFILES[entityId];
  if(!bank)throw Error(`MISSING_MAIN_BANK:${speciesIndex}`);
  const egg=speciesIndex<8;
  return {speciesIndex,entityId,kind:egg?'EGG':'REGULAR',mainSequences:bank.sequences.length,
    mainFrameReferences:bank.sequences.reduce((n,s)=>n+s.frames.length,0),
    reactionCasesExercisedByFocusedTest:egg?0:reactions.length*2,
    reactionScope:egg?'ADULT_REACTIONS_NOT_APPLIED':'CONTROLLED_HELPER_ONLY',
    normalAllBehaviors:'NOT_ACCEPTED',visualAllBehaviors:'NOT_ACCEPTED',device:'NOT_TESTED'};
});
if(rows.length!==contract.roster.speciesBindings||new Set(rows.map(r=>r.entityId)).size!==contract.roster.uniqueResourceSets)throw Error('ROSTER_COUNT_CHANGED');
const report={contract:contract.id,fullOriginalStageComplete:false,
  note:'Numbers describe data and the separately recorded focused test coverage. This script does not execute tests or certify normal behavior.',
  summary:{speciesBindings:rows.length,uniqueResources:new Set(rows.map(r=>r.entityId)).size,
    controlledReactionCases:rows.reduce((n,r)=>n+r.reactionCasesExercisedByFocusedTest,0),
    wholeBehaviorAcceptedSpecies:0},rows,workflows:contract.workflows};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(`${output}/coverage.json`,JSON.stringify(report,null,2)+'\n');
const columns=Object.keys(rows[0]);
fs.writeFileSync(`${output}/species-coverage.csv`,columns.join(',')+'\n'+rows.map(r=>columns.map(k=>r[k]).join(',')).join('\n')+'\n');
console.log(JSON.stringify(report.summary));
