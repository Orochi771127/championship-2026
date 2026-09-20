/** Find a reproducible production RNG clock that spawns a reviewed species. */
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {prepareNativeHuntEntry} from '../src/championship/hunt/capture/nativeHuntEntryTransaction.js';
import {createNativeHuntPersistentState} from '../src/championship/hunt/capture/nativeHuntPersistentState.js';
import {resolveNativeHuntSceneSources} from '../src/championship/hunt/capture/nativeHuntSceneSources.js';
import {NATIVE_HUNT_MODIFIER_COUNTS,resolveNativeHuntPoolSources} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {expandNativeHuntCandidates} from '../src/championship/hunt/capture/nativeHuntIndividualPool.js';

const speciesIndex=Number(process.argv[2]);
const biomeId=process.argv[3];
const requestedSeason=process.argv[4]===undefined?null:Number(process.argv[4]);
const requestedHour=process.argv[5]===undefined?null:Number(process.argv[5]);
if(!Number.isInteger(speciesIndex)||speciesIndex<0||speciesIndex>227||!biomeId)throw Error(
  'usage: node scripts/find-character-review-clock.mjs SPECIES_INDEX BIOME_ID [SEASON] [HOUR]');
if(requestedSeason!==null&&(!Number.isInteger(requestedSeason)||requestedSeason<0||requestedSeason>3))throw Error('SEASON_MUST_BE_0_TO_3');
if(requestedHour!==null&&(!Number.isInteger(requestedHour)||requestedHour<0||requestedHour>23))throw Error('HOUR_MUST_BE_0_TO_23');
const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const catalog=read('src/data/championship/catalogs/creature-species.r1.json');
const {cages}=read('docs/contracts/championship/raising-home-presentation.v1.json');
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const clockForSum=sum=>{const hour=Math.min(23,sum),remaining=sum-hour;
  const minute=Math.min(59,remaining),second=remaining-minute;return {hour,minute,second};};

const modifiers=NATIVE_HUNT_MODIFIER_COUNTS.map(count=>new Array(count).fill(0));
const sourceWindows=[];
// The native trig selector has no recovered negative-angle contract before 02:00;
// use the same source-owned 02:00..23:00 audit window as the route auditor.
for(let season=0;season<4;season+=1)for(let hour=2;hour<24;hour+=1){
  if(requestedSeason!==null&&season!==requestedSeason)continue;
  if(requestedHour!==null&&hour!==requestedHour)continue;
  const scene=resolveNativeHuntSceneSources({biomeId,hour,season});
  const pool=resolveNativeHuntPoolSources({nativeHuntIndex:scene.nativeHuntIndex,season,modifiers});
  if(expandNativeHuntCandidates(pool.candidateInput).includes(speciesIndex))sourceWindows.push({season,hour});
}
if(sourceWindows.length===0)throw Error(`NO_SOURCE_WINDOW_FOR_SPECIES_${speciesIndex}_IN_${biomeId}`);

let match=null;
// createClockChannelRng is seeded by hour + minute + second, so 1..141 covers
// every distinct non-zero production seed without launching 86,400 browsers.
for(let sum=1;sum<=141&&!match;sum++){
  const rngClock=clockForSum(sum);
  const app=createChampionshipStandaloneApp({storage:storage(),catalog,cages,rngClock:()=>rngClock});
  await app.newGame();
  const baseClock=app.runtimeFacade().getSnapshot();
  for(const sourceWindow of sourceWindows){
    const clock={...baseClock,season:sourceWindow.season,clockMinutes:sourceWindow.hour*60};
    const entry=prepareNativeHuntEntry({biomeId,clock,
      rngSnapshot:app.getGameplayRngState(),persistentState:createNativeHuntPersistentState()});
    const species=entry.encounter.actors.map(actor=>actor.speciesIndex);
    if(species.includes(speciesIndex)){
      match={speciesIndex,biomeId,seedSum:sum,rngClock,...sourceWindow,species,
        freshGameEndDays:sourceWindow.season*8,
        worldMinutesAfterDayStart:Math.max(0,sourceWindow.hour*60-7*60)};
      break;
    }
  }
  await app.dispose();
}
if(!match)throw Error(`NO_REVIEW_CLOCK_FOR_SPECIES_${speciesIndex}_IN_${biomeId}`);
console.log(JSON.stringify(match,null,2));
