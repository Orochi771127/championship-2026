import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../../src/championship/app/championshipStandaloneApp.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
  cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
await app.newGame();app.openGate();app.selectGate(app.getGates().find(g=>g.biomeId==='Grass').gateId);app.confirmGate();
app.getHuntLoadout().selectEquipment('ROPE','championship:2026:hunt-item:rope-i');app.beginHunt();
const runtime=app.getHuntRuntime(),frame=1000*560190/33513982;
runtime.selectTool('ROPE');runtime.tick(frame);
let target=runtime.getWildCreatures().sort((a,b)=>a.maxHp-b.maxHp)[0];
const id=target.wildId;
console.log('START',target.speciesId,target.maxHp,target.worldX,target.worldY);
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
 console.log('CIRCLE',attempt,target?.bound,target?.aiState,runtime.getToolState().closure);
 if(target?.bound)break;
}
target=runtime.getWildCreatures().find(a=>a.wildId===id);
if(target?.bound){
 runtime.toolPointerDown(target.worldX,target.worldY-10);
 for(let i=0;i<1000;i++){
  target=runtime.getWildCreatures().find(a=>a.wildId===id);
  if(!target||target.currentHp<=0)break;
  const tool=runtime.getToolState();
  runtime.toolPointerMove(target.worldX+(tool.rope?.durability<30?50:120),target.worldY-20);
  runtime.tick(frame);
 }
 runtime.toolPointerUp(target.worldX,target.worldY);for(let i=0;i<25;i++)runtime.tick(frame);
 console.log('PULL',runtime.getCaptureRecord(id),runtime.getToolState().notice);
 runtime.selectTool('HAND');target=runtime.getWildCreatures().find(a=>a.wildId===id);
 if(target){runtime.toolPointerDown(target.worldX,target.worldY-5);runtime.toolPointerUp(target.worldX,target.worldY-5);}
 for(let i=0;i<100;i++)runtime.tick(frame);
 console.log('CARD',runtime.getOnCardEntries());
 if(runtime.getOnCardEntries().length){app.exitHunt();console.log('RESULT',app.getScreen());app.confirmHuntResult();console.log('HOME',app.getScreen());}
}
await app.dispose();
