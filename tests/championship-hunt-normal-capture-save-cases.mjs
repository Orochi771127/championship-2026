import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {restoreChannelRng} from '../src/championship/battle/battleRngChannel.js';
import {nativeHuntSpeciesByIndex,nativeHuntCatalogForBiome} from '../src/championship/hunt/capture/nativeHuntSources.js';
test('normal gestures capture, commit once and restore through Continue',async()=>{
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
  cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
await app.newGame();const before=app.getRaisingInstances().map(r=>r.instanceId);try {app.openGate();app.selectGate(app.getGates().find(g=>g.biomeId==='Grass').gateId);app.confirmGate();
app.getHuntLoadout().selectEquipment('ROPE','championship:2026:hunt-item:rope-i');app.beginHunt();
const runtime=app.getHuntRuntime(),frame=1000*560190/33513982;
runtime.selectTool('ROPE');runtime.tick(frame);
let target=runtime.getWildCreatures().sort((a,b)=>a.maxHp-b.maxHp)[0];
const id=target.wildId;
for(let attempt=0;attempt<3;attempt++){
 target=runtime.getWildCreatures().find(a=>a.wildId===id);
 const x=target.worldX,y=target.worldY-10;
 for(let i=0;i<16;i++){
  const angle=i/16*Math.PI*2,p=[x+70*Math.cos(angle),y+70*Math.sin(angle)];
  if(i===0)runtime.toolPointerDown(...p);else runtime.toolPointerMove(...p);
  runtime.tick(frame);
 }
 runtime.toolPointerUp(x+70,y);runtime.tick(frame);
 for(let i=0;i<35;i++)runtime.tick(frame);
 target=runtime.getWildCreatures().find(a=>a.wildId===id);
 if(target?.bound)break;
}
target=runtime.getWildCreatures().find(a=>a.wildId===id);
assert.equal(target?.bound,true);if(target?.bound){
 runtime.toolPointerDown(target.worldX,target.worldY-10);
 // The original starter constructor consumes gameplay RNG before Hunt now.
 // Follow this individual's actual stamina instead of assuming the old
 // unconstructed starter's encounter will fall within 1,000 native frames.
 for(let i=0;i<6000;i++){
  target=runtime.getWildCreatures().find(a=>a.wildId===id);
  if(!target||target.currentHp<=0)break;
  const tool=runtime.getToolState();
  if(!tool.rope) {
   // A wild can reach its native escape point. Re-select and attach to the
   // still-bound actor using the same pointer route a player uses.
   runtime.selectTool('ROPE');runtime.toolPointerDown(target.worldX,target.worldY-10);
  }
  runtime.toolPointerMove(target.worldX+(tool.rope?.durability<30?40:180),target.worldY-20);
  runtime.tick(frame);
 }
 assert.equal(target.currentHp,0,'the hand capture must follow an actual downed individual');
 runtime.toolPointerUp(target.worldX,target.worldY);for(let i=0;i<25;i++)runtime.tick(frame);
 runtime.selectTool('HAND');target=runtime.getWildCreatures().find(a=>a.wildId===id);
 if(target){runtime.toolPointerDown(target.worldX,target.worldY-5);runtime.toolPointerUp(target.worldX,target.worldY-5);}
 for(let i=0;i<100;i++)runtime.tick(frame);
 assert.equal(runtime.getOnCardEntries().length,1,JSON.stringify({target,tool:runtime.getToolState()}));
 const nativeBefore=runtime.getOnCardEntries()[0].nativeProfile;
 const species=nativeHuntSpeciesByIndex(nativeBefore.fields['000']);
 const rng=restoreChannelRng(app.getGameplayRngState()),roll=rng.next(1);
 const modifiersBefore=app.getHuntPersistentState().modifiers[0];
 const speciesColumn=nativeHuntCatalogForBiome(0).findIndex(s=>s.speciesIndex===nativeBefore.fields['000']);
 app.exitHunt();
 assert.deepEqual(app.getGameplayRngState(),{version:1,...rng.snapshot()},'return consumes channel 1 exactly once');
 const nativeAfter=runtime.getOnCardEntries()[0].nativeProfile;
 assert.equal(nativeAfter.fields['008'],species.field1c>>>1);
 assert.equal(nativeAfter.fields['00c'],0);
 assert.equal(nativeAfter.fields['178'],species.field20+(species.field22===species.field20?0:roll%(species.field22-species.field20)));
 assert.equal(app.getHuntPersistentState().modifiers[0][speciesColumn],Math.min(8,modifiersBefore[speciesColumn]+1));
 assert.equal(nativeAfter.fields['060'],nativeBefore.fields['060']);
 app.exitHunt();
 assert.deepEqual(app.getGameplayRngState(),{version:1,...rng.snapshot()},'repeated exit cannot rerun the native return writer');
 assert.deepEqual(runtime.getOnCardEntries()[0].nativeProfile,nativeAfter);
 await app.confirmHuntResult();const captured=app.getRaisingInstances().filter(r=>!before.includes(r.instanceId));assert.equal(captured.length,1);
 assert.equal(captured[0].profile.currentHp,nativeAfter.fields['050']);
 assert.equal(captured[0].profile.maxTp,nativeAfter.fields['05c']);
 assert.equal(captured[0].profile.stats.field60,nativeAfter.fields['060']);
 assert.equal(captured[0].source.successAuthority,'NATIVE_NORMAL_HUNT_CONTROLLER');
 assert.equal(app.getDatabaseFrame().entries.find(row=>row.speciesId===captured[0].speciesId).state,'REGISTERED');
 await app.confirmHuntResult();assert.deepEqual(app.getRaisingInstances().filter(r=>!before.includes(r.instanceId)),captured,'repeated result confirmation cannot duplicate a resident');
 await app.save();assert.equal(app.canContinue().loadable,true);await app.continueGame();assert.deepEqual(app.getRaisingInstances().filter(r=>!before.includes(r.instanceId)),captured);
}
}finally{await app.dispose();}
});
