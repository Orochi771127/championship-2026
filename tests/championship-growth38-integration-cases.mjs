import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {getProductExtension} from '../src/championship/contracts/productSpeciesExtensions.js';
import {productHuntSpecies,productEvolutionOptions,PRODUCT_RAISING_LIFECYCLE_RULES} from '../src/championship/contracts/productSpeciesData.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeIndividualProfile,normalizeNativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import * as actor from '../src/championship/raising/nativeRaisingActor.js';
import {normalizeNativeRaisingHome} from '../src/championship/raising/nativeRaisingHomeState.js';
import {listMoveRecordsForSpecies} from '../src/championship/battle/battleCatalogs.js';
import {getDatabaseDisplayEntry,DATABASE_DISPLAY_CATALOG} from '../src/championship/database/databaseDisplayCatalog.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {sampleAuthoredArenaFrame} from '../src/championship/presentation/authoredCharacterFrame.js';
import {validatePublicCharacterRender} from '../src/championship/presentation/publicCharacterRoster.js';
const rng={next:()=>50},ids=[231,237,239],profile=id=>nativeIndividualProfile(createNativeHuntIndividual({species:productHuntSpecies(id),rng}));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
test('38 selected original art banks validate hashes and complete eight-direction four-action lookup',async()=>{
 const cat=read('src/data/championship/public-character-catalog.v1.json');
 const rows=cat.characters.filter(c=>c.runtimePath.includes('/growth-authored-20261025/'));assert.equal(rows.length,38);
 for(const c of rows){const bytes=fs.readFileSync(c.runtimePath);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.runtimeSha256);const r=JSON.parse(bytes);await validatePublicCharacterRender(r,c);
  for(let direction=0;direction<8;direction++)for(const action of ['walk','melee','ranged','hurt']){
   const clip=r.authoredArena.clips[`${direction}/${action}`];assert.ok(clip?.frames.length>=(action==='hurt'?1:2),`${c.speciesId}/${direction}/${action}`);
   for(const f of clip.frames)assert.ok(r.authoredArena.geometry[f.texture]);
   const seq=r.sides.main.animations.find(s=>s.id===2);assert.ok(sampleAuthoredArenaFrame(r.authoredArena,{direction,action,sequence:seq,sample:{frameIndex:0,elapsedQ12:0,active:1}}));
  }
 }
 for(const id of ['species-036','species-044','species-070'])assert.ok(!cat.characters.find(c=>c.speciesId===id).runtimePath.includes('/growth-authored-'));
});
test('new growth identities retain distinct stats, append-only codes, move kits and persisted profiles',()=>{
 for(const [n,id] of ids.entries()){
  const e=getProductExtension(id);assert.equal(e.huntOverrides.rungs.reduce((a,b)=>a+b),55);
  assert.equal(getDatabaseDisplayEntry(id).displayCode,`GR${39+n}`);assert.equal(DATABASE_DISPLAY_CATALOG.entries.filter(e=>e.speciesIndex===id).length,1);
  assert.ok(productEvolutionOptions(e.baseSpeciesIndex).includes(id));assert.ok(listMoveRecordsForSpecies(id).length>0);
  const p=profile(id);assert.equal(normalizeNativeIndividualProfile(JSON.parse(JSON.stringify(p))).fields['000'],id);
  const a=actor.createNativeRaisingActor(p,0);actor.initializeNativeRaisingActor(a,p,[0,0,0],0,rng);assert.ok(actor.projectNativeRaisingActor(a));
  const target=PRODUCT_RAISING_LIFECYCLE_RULES.rules[id-8][0].target;
  actor.beginNativeRaisingEvolution(a,{target,actor:{'1f4':0,'1f0':1}},rng);
  let result;for(let t=0;t<1000;t++){result=actor.stepNativeRaisingEvolution(a,p,rng);if(result.evolved)break;}
  assert.ok(result.evolved);assert.equal(result.profile.fields['000'],target);assert.equal(result.event.productRouteId,`${id}:${target}:${target}`);
  assert.doesNotThrow(()=>normalizeNativeRaisingHome({version:1,poolSlots:{},foods:[],productEvolutionBranches:[result.event.productRouteId]}));
 }
 assert.ok(profile(239).fields['06c']>profile(231).fields['06c'],'wolf speed exceeds boar');
 assert.ok(profile(237).fields['068']>profile(231).fields['068'],'bean wisdom exceeds boar');
});
for(const id of ids)test(`new species ${id} runs the normal battle simulation with attacks and settlement`,()=>{
 const make=id=>({instanceId:`growth-${id}`,nativeProfile:profile(id)});
 const runtime=createBattleRuntime({mode:3,battleType:0,playerIndividuals:[make(id)],opponentIndividuals:[make(34)],localTeamIndex:0,seed:20});
 try{runtime.chooseLinkBattle({arenaIndex:0});const source=runtime.startMatch();assert.ok(source.getFrame().combatants.some(c=>c.speciesId===`species-${id}`&&c.animationRequest));
  let ticks=0,attacks=0;for(;ticks<18000&&!source.getView().outcome.ended;ticks++){source.tick();attacks=Math.max(attacks,source.getView().normalEvents?.filter(e=>e.type==='LAUNCHED').length??0);}
  const view=source.getView();assert.ok(view.outcome.ended,`settlement after ${ticks}`);assert.ok(view.combatants.some(c=>c.hp.current<c.hp.maximum),'combat caused real damage');
 }finally{runtime.dispose();}
});
