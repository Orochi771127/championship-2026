import {separateGroundFootpoints,canTraverseGroundStep} from '../field/groundFootpointSeparation.js';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../../data/championship/battleCharacterProfiles.js';
import {productBaseSpeciesIndex} from '../contracts/productSpeciesData.js';
import {stageBodyScale} from '../presentation/stageBodySize.js';

const Q12=4096;
const MIN_RADIUS_PX=8;
const MAX_RADIUS_PX=14;

/**
 * Compute an actor's footpoint separation radius in Q12 native pixels from its
 * visual idle footprint width, clamped to [8, 14] px (16–28 px diameter) so
 * large partners separate visually while still fitting inside compact cages
 * such as the mini infirmary without pinning against walls.
 */
export function nativeRaisingActorRadiusQ12(actor){
  const idx=actor?.speciesIndex;
  if(!Number.isInteger(idx)||idx<8)return MIN_RADIUS_PX*Q12;
  let baseIdx=idx;
  try{baseIdx=productBaseSpeciesIndex(idx);}catch{baseIdx=idx;}
  const entity=BATTLE_SPECIES_ENTITIES[baseIdx];
  const cell=entity?BATTLE_CHARACTER_PROFILES[entity]?.cells?.[0]:null;
  if(!cell)return MIN_RADIUS_PX*Q12;
  const rawWidth=Math.max(0,cell[2]-cell[0]);
  const scale=stageBodyScale(`species-${String(idx).padStart(3,'0')}`);
  const effectiveWidth=rawWidth*(Number.isFinite(scale)&&scale>0?scale:1);
  const radiusPx=Math.max(MIN_RADIUS_PX,Math.min(MAX_RADIUS_PX,Math.round(effectiveWidth*0.36)));
  return radiusPx*Q12;
}

// Ordinary-ground adaptation; native cages, fixed states and food stations
// retain their existing owners. Eggs and sleeping bodies are never translated.
export function nativeRaisingSpacingRole(actor){
  if(!actor.positionQ12||actor.positionQ12[2]!==0||actor.detached||actor.tutorialSpecial||actor.evolution||[6,7,12,13,15,21,22].includes(actor.state)||actor.foodSlot!=null)return null;
  if([1,2,3,16].includes(actor.state))return 'MOVE';
  return [4,8,9,10,11,14,17,18,19,20,25,26].includes(actor.state)?'FIXED':null;
}
export function separateNativeRaisingGroundActors(actors,ground){
  // On connected hex ranches (`ground.navigation`), partners from different
  // home cages can stroll into the same room (e.g., an infirmary). Group them
  // by the cage they physically stand in so visitors also separate cleanly.
  const connected=Boolean(ground?.navigation);
  const cageKeyOf=cage=>cage?(cage.instanceId??cage.ownerIndex??cage.definitionIndex):null;
  const entries=[...actors].filter(a=>nativeRaisingSpacingRole(a)).map(a=>{
    const physical=connected?cageKeyOf(ground.cageAt?.(a.positionQ12[0]/Q12,a.positionQ12[1]/Q12)):null;
    const home=a.cageInstanceId??a.cageDefinitionIndex;
    return {
      actor:a,poolSlot:a.poolSlot,group:physical??home,
      positionQ12:a.positionQ12,movable:nativeRaisingSpacingRole(a)==='MOVE',
      radiusQ12:nativeRaisingActorRadiusQ12(a)
    };
  });
  const wrapXQ12=ground.pixelWidth*Q12;
  const result=separateGroundFootpoints(entries,{wrapXQ12,canPlace:(entry,to,from)=>canTraverseGroundStep(from,to,{wrapXQ12,
    canStand:p=>{
      if(p[1]<0||p[1]>=ground.height*32768||ground.readTerrain(Math.floor(p[0]/32768),Math.floor(p[1]/32768))===1)return false;
      const cage=ground.cageAt(p[0]/Q12,p[1]/Q12);
      if(!cage)return false;
      return connected?cageKeyOf(cage)===entry.group:(cage.instanceId??cage.definitionIndex)===entry.group;
    }})});
  entries.forEach((entry,i)=>{if(result.correctionQ12[i])entry.actor.positionQ12=result.points[i];});
  return result;
}
