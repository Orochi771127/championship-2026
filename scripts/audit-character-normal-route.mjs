// Audit whether a candidate species is reachable through current source-owned
// Hunt and Battle rules. This is read-only and never changes gameplay data.
import fs from 'node:fs';
import path from 'node:path';
import {CHAMPIONSHIP_GATES} from '../src/championship/gate/gateCatalog.js';
import {resolveNativeHuntSceneSources} from '../src/championship/hunt/capture/nativeHuntSceneSources.js';
import {NATIVE_HUNT_MODIFIER_COUNTS,nativeHuntSpeciesByIndex,resolveNativeHuntPoolSources}
  from '../src/championship/hunt/capture/nativeHuntSources.js';
import {expandNativeHuntCandidates} from '../src/championship/hunt/capture/nativeHuntIndividualPool.js';
import {battlePartyAdmission} from '../src/championship/battle/battleParty.js';

const [entityId,speciesText,outputText]=process.argv.slice(2);
const speciesIndex=Number(speciesText);
if(!entityId||!Number.isInteger(speciesIndex)||!outputText)throw Error(
  'usage: node scripts/audit-character-normal-route.mjs ENTITY SPECIES_INDEX OUTPUT_JSON');

const modifiers=NATIVE_HUNT_MODIFIER_COUNTS.map(count=>new Array(count).fill(0));
const matchingPools=[];
let checked=0;
for(const gate of CHAMPIONSHIP_GATES)for(let season=0;season<4;season+=1)for(let hour=2;hour<=23;hour+=1){
  const scene=resolveNativeHuntSceneSources({biomeId:gate.biomeId,hour,season});
  const pool=resolveNativeHuntPoolSources({nativeHuntIndex:scene.nativeHuntIndex,season,modifiers});
  const candidates=expandNativeHuntCandidates(pool.candidateInput);
  checked+=1;
  if(candidates.includes(speciesIndex))matchingPools.push({gateId:gate.gateId,biomeId:gate.biomeId,
    nativeHuntIndex:scene.nativeHuntIndex,season,hour,entranceFeeBits:gate.entranceFeeBits,
    unlockKind:gate.unlockKind,unlockParameter:gate.unlockParameter});
}
const species=nativeHuntSpeciesByIndex(speciesIndex);
const admission=battlePartyAdmission({fields:{'000':speciesIndex,'134':0,'138':0,'13c':0},narrowFields:{}});
const huntReachable=matchingPools.length>0;
const freshTamerHuntReachable=matchingPools.some(pool=>pool.entranceFeeBits===0&&pool.unlockKind===0);
const anyRoute=huntReachable||admission.ok;
const freshRoute=freshTamerHuntReachable||admission.ok;
const report={entityId,speciesId:`species-${String(speciesIndex).padStart(3,'0')}`,speciesIndex,
  generation:species.generation,status:anyRoute
    ?freshRoute?'SOURCE_ROUTE_AVAILABLE_REQUIRES_BROWSER_QA':'SOURCE_ROUTE_AVAILABLE_AFTER_PROGRESSION_RENDERER_QA_ONLY'
    :'PASS_SOURCE_ROUTE_AUDIT_WITH_EXPECTED_INELIGIBILITY',
  hunt:{sourceCombinationsChecked:checked,gateCount:CHAMPIONSHIP_GATES.length,seasons:[0,1,2,3],hours:[2,23],
    matchingPools,freshTamerAccessible:freshTamerHuntReachable,normalCaptureRoute:huntReachable
      ?freshTamerHuntReachable?'AVAILABLE_TO_FRESH_TAMER':'AVAILABLE_AFTER_GATE_PROGRESSION'
      :'NOT_REACHABLE_BY_CURRENT_SOURCE_SPAWN_CONTRACT'},
  battle:{admission,normalBattleRoute:admission.ok?'AVAILABLE':'NOT_REACHABLE_BY_CURRENT_SOURCE_ADMISSION'},
  rendererValidation:'PENDING_LOOPBACK_RUNTIME_RENDERER_REVIEW',runtimeChanged:false,
  interpretation:anyRoute
    ?freshRoute?'At least one ordinary fresh-tamer source route exists and must be exercised in browser QA.'
      :'An ordinary source route exists only behind existing gate progression. Renderer QA is required; a fresh-tamer browser run must report the gate as inaccessible rather than bypassing progression.'
    :'Art bank may be renderer-tested, but normal Hunt and Battle cannot be claimed for this donor without changing source gameplay semantics.'};
fs.mkdirSync(path.dirname(outputText),{recursive:true});
fs.writeFileSync(outputText,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
