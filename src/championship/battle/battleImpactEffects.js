// OVL19 021319F8 order; each family has 16 slots (0211ADEC).
// NSBCA J0AC frame counts, checked against ARM9 0208AE6C/AF28 completion.
export const BATTLE_IMPACT_FAMILIES = Object.freeze([
  ['battle-hitspark_small',18],['battle-hitspark_big',18],
  ['battle-s_impact_s',30],['battle-s_impact_b',30],['battle-earth_hit',20]
].map(([systemId,frameCount])=>Object.freeze({systemId,frameCount})));

import {readSpriteCellBox} from './battleSpriteCellBox.js';
import profiles from '../../data/championship/battlePresentationProfiles.json' with {type:'json'};

export function createBattleImpactEffects() {
  const pools=BATTLE_IMPACT_FAMILIES.map(()=>Array(16).fill(null));
  let serial=0,created=0,released=0;
  const api={
    // 0211AF20 keys off the TARGET species; AF60 keys off the OWNER species.
    spawn({owner,target,targetSpeciesId,ownerSpeciesId,secondary=false,point,type:explicitType=null,nativeCopy=null,offset=[0,0,0]}) {
      if(!owner||!target)return null;
      const type=explicitType??(secondary ? (ownerSpeciesId>=0x48?3:2) : (targetSpeciesId>=0x48?1:0));
      if(!pools[type])throw new RangeError('BATTLE_IMPACT_TYPE');
      const slot=pools[type].indexOf(null);if(slot<0)return null;
      const effect={id:++serial,type,slot,owner,target,frame:0,point:{...point},nativeCopy,offset:[...offset],...BATTLE_IMPACT_FAMILIES[type]};
      pools[type][slot]=effect;created++;return effect.id;
    },
    // Called from the existing normal battle step, never from a render clock.
    spawnNative(memory,{owner,target,type,offset=[0,0,0]}){
      if(!owner||!target)return null;
      const actor=memory.readU32(target,4),box=readSpriteCellBox(memory,actor,0)?.box;
      if(!actor||!box)throw Error('BATTLE_IMPACT_SOURCE_ACTOR_REQUIRED');
      // ADEC copies the source sprite, then adds raw NCER height to BOTH y/z.
      // 02048378 projects y-z first; the impact offset is added afterwards.
      const height=(box.highY-box.lowY)<<12;
      const copy=[0x24,0x28,0x2c].map(o=>memory.readU32(actor,o)|0);
      copy[1]=(copy[1]+height)|0;copy[2]=(copy[2]+height)|0;
      return api.spawn({owner,target,type,nativeCopy:copy,offset,
        point:{x:(copy[0]+offset[0])|0,y:(copy[1]-copy[2]+offset[1])|0,z:0}});
    },
    call(memory,routine,args){
      if(![0x0211af20,0x0211af60,0x0211afa4].includes(routine))return undefined;
      const [,owner,target,offset]=args;
      const species=wrapper=>memory.readU32(memory.readU32(wrapper,0x10),0);
      const type=routine===0x0211afa4?4:routine===0x0211af60?(species(memory.readU32(owner,0xe4))>=72?3:2):(species(target)>=72?1:0);
      return api.spawnNative(memory,{owner,target,type,offset})??0;
    },
    advance({exclusiveOwner=0,isOwnerActive=null}={}){for(const pool of pools)for(let i=0;i<pool.length;i++){
      const effect=pool[i];if(!effect)continue;
      if(isOwnerActive&&!isOwnerActive(effect.owner))effect.ownerRetired=true;
      // 0211A778 checks completion BEFORE 0211A89C advances the animation.
      if(effect.frame>=effect.frameCount){pool[i]=null;released++;}
      else if(!exclusiveOwner||(!effect.ownerRetired&&exclusiveOwner===effect.owner))effect.frame++;
    }},
    retireOwner(owner){for(const pool of pools)for(const effect of pool)if(effect?.owner===owner)effect.ownerRetired=true;},
    clear(){for(const pool of pools)for(let i=0;i<pool.length;i++)if(pool[i]){pool[i]=null;released++;}},
    snapshot({cameraY=0,exclusiveOwner=0}={}){return pools.flat().filter(Boolean).map(e=>({...e,point:{...e.point},
      offset:[...e.offset],nativeCopy:e.nativeCopy?[...e.nativeCopy]:null,
      depthQ12:e.nativeCopy?((((e.nativeCopy[1]>>12)-(cameraY>>12))<<12)
        -(exclusiveOwner===e.owner&&!e.ownerRetired?0x180000:0x300000)+e.offset[2]+profiles.impactDepthBiasQ12[e.type])|0:0}));},
    diagnostics(){return {created,released,active:created-released};}
  };
  return api;
}
