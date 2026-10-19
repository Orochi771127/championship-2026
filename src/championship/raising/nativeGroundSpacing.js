import {separateGroundFootpoints,canTraverseGroundStep} from '../field/groundFootpointSeparation.js';
// Ordinary-ground adaptation; native cages, fixed states and food stations
// retain their existing owners. Eggs and sleeping bodies are never translated.
export function nativeRaisingSpacingRole(actor){
  if(!actor.positionQ12||actor.positionQ12[2]!==0||actor.detached||actor.tutorialSpecial||actor.evolution||[6,7,12,13,15,21,22].includes(actor.state)||actor.foodSlot!=null)return null;
  if([1,2,3,16].includes(actor.state))return 'MOVE';
  return [4,8,9,10,11,14,17,18,19,20,25,26].includes(actor.state)?'FIXED':null;
}
export function separateNativeRaisingGroundActors(actors,ground){
  const entries=[...actors].filter(a=>nativeRaisingSpacingRole(a)).map(a=>({actor:a,poolSlot:a.poolSlot,group:a.cageInstanceId??a.cageDefinitionIndex,
    positionQ12:a.positionQ12,movable:nativeRaisingSpacingRole(a)==='MOVE'}));
  const wrapXQ12=ground.pixelWidth*4096;
  const result=separateGroundFootpoints(entries,{wrapXQ12,canPlace:(entry,to,from)=>canTraverseGroundStep(from,to,{wrapXQ12,
    canStand:p=>p[1]>=0&&p[1]<ground.height*32768&&ground.readTerrain(Math.floor(p[0]/32768),Math.floor(p[1]/32768))!==1
      &&(ground.cageAt(p[0]/4096,p[1]/4096)?.instanceId??ground.cageAt(p[0]/4096,p[1]/4096)?.definitionIndex)===entry.group})});
  entries.forEach((entry,i)=>{if(result.correctionQ12[i])entry.actor.positionQ12=result.points[i];});
  return result;
}
