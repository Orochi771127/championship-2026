// Builds the fixed, isolated save used by the ranch load diagnostics
// (tests/championship-ranch-load-diagnostics-browser.cjs). It drives the real
// standalone app with an in-memory storage, so the result is a save the game
// itself wrote -- never a player's profile. Run:
//   node tests/fixtures/build-ranch-load-diagnostic-save.mjs [--check]
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createChampionshipStandaloneApp} from '../../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../../src/championship/app/championshipStandaloneSave.js';
import {createNativeHuntIndividual} from '../../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../../src/championship/raising/nativeIndividualProfile.js';
import {FRIENDS_PLAYTEST_POLICY} from '../../src/championship/app/friendsPlaytestPolicy.js';
import {RAISING_CAGES} from '../../src/championship/app/cageRoster.js';

const root=new URL('../../',import.meta.url);
const out=fileURLToPath(new URL('tests/fixtures/ranch-load-diagnostic-save.json',root));
const json=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'));
// Main partner GR01 (species-034, generation 3, reviewed art) whose catalyst
// route targets species-096 (reviewed art). Two more reviewed residents and one
// natively streamed resident make a realistic, mixed ranch.
const MAIN=34,OTHERS=[38,35,36];
// The real-time clock reads the injected wall clock; a fixed instant makes the save byte-stable.
const FIXED_NOW='2026-11-05T13:20:50.000Z';
// Local hour comes from the process time zone: pin it so the ranch clock is 13:20 everywhere.
process.env.TZ='UTC';
const species=index=>`species-${String(index).padStart(3,'0')}`;
const individual=index=>nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(index),rng:{next:()=>11}}));

function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i]??null,get length(){return m.size;}};}

async function build(){
  const storage=memoryStorage();
  const catalog=json('src/data/championship/catalogs/creature-species.r1.json');
  // Same sequence as tests/fixtures/championship-owned-party.html: one app
  // instance writes the new game, the profile is replaced, then the same
  // instance re-opens it so the real save authority normalizes every field.
  // The public entry's own options (main.js): a save written by the default
  // app is refused there as unreadable.
  const app=createChampionshipStandaloneApp({storage,catalog,cages:RAISING_CAGES,locks:null,playtestPolicy:FRIENDS_PLAYTEST_POLICY,
    productEconomy:true,partnerLife:true,clockPolicy:'REALTIME_V1',now:()=>FIXED_NOW,rngClock:()=>({hour:13,minute:20,second:50})});
  try{
    await app.newGame();app.save();
    const save=JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
    save.creature.nativeProfile=individual(MAIN);save.creature.speciesId=species(MAIN);save.creature.displayName='載入診斷';
    const cage=save.raising.assignments[save.creature.creatureId];
    for(const index of OTHERS){
      const instanceId=`diagnostic:${species(index)}`;
      save.raising.collection.push({instanceId,speciesId:species(index),displayName:`診斷${index}`,nativeProfile:individual(index),
        enclosedAt:null,originGateId:null,successAuthority:'CONTROLLED_TEST_PROFILE'});
      save.raising.assignments[instanceId]=cage;
    }
    // One SR shard is the minimum catalyst for generation 3 (cyberGacha.catalystRarityForGeneration).
    save.progression.cyberGacha={...(save.progression.cyberGacha??{}),metals:{'metal:chrono-ore-shard':2}};
    storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY,JSON.stringify(save));
    await app.continueGame();app.save();
  }finally{await app.dispose();}
  const final=JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));
  // Fixed wall-clock fields keep the fixture byte-stable between builds. The
  // diagnostics harness re-stamps both to its own install time, so no offline
  // growth is credited when the fixture is opened.
  final.updatedAt=FIXED_NOW;
  if(final.raising?.nativeHome?.discoveries)final.raising.nativeHome.discoveries.lastAt=Date.parse(final.updatedAt);
  return JSON.stringify(final,null,1)+'\n';
}

const text=await build();
if(process.argv.includes('--check')){
  const current=fs.existsSync(out)?fs.readFileSync(out,'utf8'):null;
  if(current!==text){console.error('ranch-load-diagnostic-save.json is stale; rebuild it');process.exit(1);}
  console.log('ranch-load-diagnostic-save.json is current');
}else{fs.writeFileSync(out,text);console.log(`wrote ${out}`);}
