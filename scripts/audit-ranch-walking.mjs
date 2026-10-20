import fs from 'node:fs';
import path from 'node:path';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {PRODUCT_RANCH_GRID,productGridSlot} from '../src/championship/cage/productRanchGrid.js';
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {applyRaisingGroundReview} from '../src/championship/raising/raisingGroundReview.js';
import {stepNativeRaisingMovement,nativeRaisingMovementArrived} from '../src/championship/raising/nativeRaisingMovement.js';
import {advanceRanchExplorationWalk} from '../src/championship/raising/ranchExplorationWalk.js';
import review from '../src/data/championship/catalogs/raising-ground.review-20261019.json' with {type:'json'};
applyRaisingGroundReview(review);
const root=path.resolve(process.argv[2]),audit=JSON.parse(fs.readFileSync(path.join(root,'all-cages.json')));
const defs=listCageDefinitions(),results=[];
for(const record of audit.records)for(const speed of ['normal','fast','slow']){
  const e=record.examples[0];
  const ground=composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,unlockedSlots:Array.from({length:100},(_,i)=>i),placements:[
    {moduleId:defs[35].moduleId,slotIndex:0,instanceId:'cage:waiting'},
    {moduleId:defs[record.definition].moduleId,slotIndex:productGridSlot(5,4),rotation:record.rotation,instanceId:'cage:a'},
    {moduleId:defs[e.other].moduleId,slotIndex:e.slotIndex,rotation:e.rotation,instanceId:'cage:b'}]});
  const start=ground.navigation.connections.find(c=>c.left===1&&c.right===2).route[0];
  const route=ground.navigation.plan(start,2,1);
  if(!route?.length){results.push({definition:record.definition,rotation:record.rotation,speed,status:'NO_PATH'});continue;}
  const actor={state:2,mode:0,ticks:0,threshold:0,angleQ12:0,desiredAngleQ12:0,slow:speed==='slow'?1:0,
    foodSlot:null,positionQ12:[start[0]*4096,start[1]*4096,0],destinationQ12:[route[0][0]*4096,route[0][1]*4096,0],
    explorationRoute:route.map(([x,y])=>[x*4096,y*4096,0]),explorationGround:ground};
  let status='TIMEOUT',steps=0;
  for(;steps<6000;steps++){
    Object.assign(actor,stepNativeRaisingMovement({...actor,fast:speed==='fast'?1:0,hasFood:false},ground));
    if(ground.readTerrain(Math.floor(actor.positionQ12[0]/32768),Math.floor(actor.positionQ12[1]/32768))===1){status='OBSTACLE';break;}
    const continuing=advanceRanchExplorationWalk(actor,ground);
    if(!continuing){
      status=nativeRaisingMovementArrived(actor)&&ground.navigation.ownerAt(actor.positionQ12.map(n=>n/4096))?.ownerIndex===2?'ARRIVED':'INTERRUPTED';
      break;
    }
  }
  results.push({definition:record.definition,name:record.name,rotation:record.rotation,speed,status,steps});
}
const failures=results.filter(r=>r.status!=='ARRIVED'),report={cases:results.length,passed:results.length-failures.length,failures,results};
fs.writeFileSync(path.join(root,'native-walking.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({cases:report.cases,passed:report.passed,failures},null,2));
if(failures.length)process.exitCode=1;
