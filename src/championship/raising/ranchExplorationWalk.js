// Optional waypoints inside the existing native actor state machine.
// No new actor, animation loop, movement speed, home assignment or gameplay RNG.
import data from '../../data/championship/catalogs/raising-activity.r1.json' with {type:'json'};
import {productBaseSpeciesIndex} from '../contracts/productSpeciesData.js';
export function ranchEnvironmentPreference(speciesIndex,definitionIndex){
  const flags=data.species[productBaseSpeciesIndex(speciesIndex)]?.field18??0,row=data.cage[definitionIndex];
  if(!row)return 0;
  return flags&row[2]?1:flags&row[3]?-1:0;
}
export function beginRanchExplorationWalk(actor,ground) {
  const nav=ground?.navigation;if(!nav)return false;
  delete actor.explorationMood;
  const owner=nav.ownerAt(actor.positionQ12.map(v=>v/4096));
  if(!owner)return false;
  const preference=i=>ranchEnvironmentPreference(actor.speciesIndex,ground.placements.find(p=>p.ownerIndex===i)?.definitionIndex);
  const neighbours=nav.connectedOwners(owner.ownerIndex).filter(i=>i!==owner.ownerIndex&&preference(i)>=0);
  if(!neighbours.length){
    if(preference(owner.ownerIndex)<0)actor.explorationMood='RESTING';
    return false;
  }
  const liked=neighbours.filter(i=>preference(i)>0),choices=liked.length?liked:neighbours;
  actor.explorationOrdinal=(actor.explorationOrdinal??0)+1;
  const target=choices[(actor.explorationOrdinal+actor.poolSlot)%choices.length];
  const route=nav.plan(actor.positionQ12.map(v=>v/4096),target,actor.explorationOrdinal+actor.poolSlot);
  if(!route?.length)return false;
  actor.explorationRoute=route.map(([x,y])=>[x*4096,y*4096,0]);
  actor.explorationGround=ground;actor.explorationTarget=target;
  actor.destinationQ12=[...actor.explorationRoute[0]];
  return true;
}
export function advanceRanchExplorationWalk(actor,ground) {
  if(!actor.explorationRoute)return false;
  if(actor.explorationGround!==ground||actor.state!==2||actor.mode!==0||actor.foodSlot!==null
    ||actor.destinationQ12.some((v,i)=>v!==actor.explorationRoute[0]?.[i])){
    delete actor.explorationRoute;delete actor.explorationGround;return false;
  }
  if(Math.hypot(...actor.positionQ12.slice(0,2).map((v,i)=>v-actor.destinationQ12[i]))>=20480)return true;
  actor.explorationRoute.shift();
  if(actor.explorationRoute.length){actor.destinationQ12=[...actor.explorationRoute[0]];return true;}
  delete actor.explorationRoute;delete actor.explorationGround;return false;
}
