// Optional waypoints inside the existing native actor state machine.
// No new actor, animation loop, movement speed, home assignment or gameplay RNG.
//
// Core gameplay rule: strolling exploration (and strolling item discoveries)
// ONLY activates for partners standing inside a connected cage region where at
// least one passage links two compatible cages. Partners in isolated cages keep
// ordinary native wandering untouched.
import data from '../../data/championship/catalogs/raising-activity.r1.json' with {type:'json'};
import lifecycle from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {productBaseSpeciesIndex} from '../contracts/productSpeciesData.js';

export function ranchEnvironmentPreference(speciesIndex,definitionIndex){
  const flags=data.species[productBaseSpeciesIndex(speciesIndex)]?.field18??0,row=data.cage[definitionIndex];
  if(!row)return 0;
  return flags&row[2]?1:flags&row[3]?-1:0;
}

/**
 * True only when this actor's current or home cage is linked by at least one
 * open passage to another cage (`connectedOwners.length > 1`). Isolated cages
 * always return false so ordinary wandering never triggers stroll discoveries.
 */
export function actorInConnectedRanchRegion(actor,ground){
  const nav=ground?.navigation;
  if(!nav||!(nav.connections?.length>0)||!actor)return false;
  let ownerIndex=null;
  if(actor.positionQ12){
    ownerIndex=nav.ownerAt([actor.positionQ12[0]/4096,actor.positionQ12[1]/4096])?.ownerIndex??null;
  }
  if(ownerIndex===null&&actor.cageInstanceId&&typeof ground.placement==='function'){
    ownerIndex=ground.placement(actor.cageInstanceId)?.ownerIndex??null;
  }
  if(ownerIndex===null)return false;
  return nav.connectedOwners(ownerIndex).length>1;
}

function ownerCrowdCounts(nav,actors,self){
  const counts=new Map();
  if(!actors)return counts;
  for(const other of actors){
    if(!other||other===self||other.detached||!other.positionQ12)continue;
    const standing=nav.ownerAt(other.positionQ12.map(v=>v/4096));
    if(standing)counts.set(standing.ownerIndex,(counts.get(standing.ownerIndex)??0)+1);
    if(Number.isInteger(other.explorationTarget)&&other.explorationTarget!==standing?.ownerIndex){
      counts.set(other.explorationTarget,(counts.get(other.explorationTarget)??0)+1);
    }
  }
  return counts;
}

/**
 * Score a connected same-ecology neighbour cage for casual strolling.
 * Passages only open between adjacent compatible cages; crowding penalty simply
 * spreads strollers evenly across connected rooms.
 */
export function scoreRanchExplorationTarget({definitionIndex,preference,occupancy}){
  let score=preference>0?20:0;
  const capacity=lifecycle.cages[definitionIndex]?.capacity??4;
  score-=occupancy*12;
  if(occupancy>=capacity)score-=25;
  return score;
}

export function beginRanchExplorationWalk(actor,ground,{actors=null}={}) {
  const nav=ground?.navigation;if(!nav)return false;
  delete actor.explorationMood;delete actor.explorationVisit;
  // Owner 2026-10-27: after a layout opens a passage, a partner living beside
  // it takes its next outing across it once. Only the choice among already
  // allowed neighbours changes; disliked land is still declined.
  const visit=actor.passageVisit;delete actor.passageVisit;
  const owner=nav.ownerAt(actor.positionQ12.map(v=>v/4096));
  if(!owner)return false;
  const defOf=i=>ground.placements.find(p=>p.ownerIndex===i)?.definitionIndex;
  const preference=i=>ranchEnvironmentPreference(actor.speciesIndex,defOf(i));
  const neighbours=nav.connectedOwners(owner.ownerIndex).filter(i=>i!==owner.ownerIndex&&preference(i)>=0);
  if(!neighbours.length){
    if(preference(owner.ownerIndex)<0)actor.explorationMood='RESTING';
    return false;
  }
  let choices;
  if(actors){
    const counts=ownerCrowdCounts(nav,actors,actor);
    const scored=neighbours.map(i=>({ownerIndex:i,score:scoreRanchExplorationTarget({
      definitionIndex:defOf(i),preference:preference(i),occupancy:counts.get(i)??0
    })}));
    const best=Math.max(...scored.map(s=>s.score));
    choices=scored.filter(s=>s.score>=best-6).map(s=>s.ownerIndex);
  }else{
    const liked=neighbours.filter(i=>preference(i)>0);
    choices=liked.length?liked:neighbours;
  }
  actor.explorationOrdinal=(actor.explorationOrdinal??0)+1;
  const visitOwner=visit==null?null:ground.placements.find(p=>p.instanceId===visit)?.ownerIndex??null;
  const target=visitOwner!==null&&neighbours.includes(visitOwner)?visitOwner:choices[(actor.explorationOrdinal+actor.poolSlot)%choices.length];
  const route=nav.plan(actor.positionQ12.map(v=>v/4096),target,actor.explorationOrdinal+actor.poolSlot);
  if(!route?.length)return false;
  actor.explorationRoute=route.map(([x,y])=>[x*4096,y*4096,0]);
  actor.explorationGround=ground;actor.explorationTarget=target;
  if(target===visitOwner)actor.explorationVisit=true;
  actor.destinationQ12=[...actor.explorationRoute[0]];
  return true;
}
export function advanceRanchExplorationWalk(actor,ground) {
  if(!actor.explorationRoute)return false;
  if(actor.explorationGround!==ground||actor.state!==2||actor.mode!==0||actor.foodSlot!==null
    ||actor.destinationQ12.some((v,i)=>v!==actor.explorationRoute[0]?.[i])){
    delete actor.explorationRoute;delete actor.explorationGround;delete actor.explorationVisit;return false;
  }
  if(Math.hypot(...actor.positionQ12.slice(0,2).map((v,i)=>v-actor.destinationQ12[i]))>=20480)return true;
  actor.explorationRoute.shift();
  if(actor.explorationRoute.length){actor.destinationQ12=[...actor.explorationRoute[0]];return true;}
  delete actor.explorationRoute;delete actor.explorationGround;delete actor.explorationVisit;return false;
}
