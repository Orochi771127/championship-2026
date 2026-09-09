import { createBattleNativeMemory } from './battleNativeMemory.js';
import { BATTLE_CHARACTER_PROFILES, BATTLE_SPECIES_ENTITIES } from '../../data/championship/battleCharacterProfiles.js';
import { BATTLE_CHARACTER_GEOMETRY } from '../../data/championship/battleCharacterGeometry.js';
import { createNativeCharacterAnimationTimeline } from '../presentation/characterAnimationTimeline.js';
import { readSpriteCellBox, cellBoxToLaunchCell } from './battleSpriteCellBox.js';
import { launchPosition } from './battleLaunchPool.js';
import {BATTLE_CREATURE_STAT_MAP} from './battleCreatureBuild.js';
import {BATTLE_WORLD_FLAGS} from './battleNormalFlow.js';
import {callBattlePresentationHost} from './battlePresentationHost.js';
import presentationProfiles from '../../data/championship/battlePresentationProfiles.json' with {type:'json'};

// Execution memory belongs to one existing battle runtime. These addresses are
// relocated handles, not cartridge addresses or a second simulation authority.
export function createBattleNativeActors({ slots, stands, creatures=[] }) {
  const memory = createBattleNativeMemory(), actors = new Map();
  // The app publishes 02131C40 after attaching its 2D resource/actor pool to
  // this same memory. Standalone character fixtures need only the scalar block.
  const worldAddress=0x20000000;
  memory.writeU32(worldAddress,0x5ea8,BATTLE_WORLD_FLAGS.initial(0));
  presentationProfiles.preludeTintTable.forEach((value,i)=>memory.writeU16(0x02131bdc,i*2,value));
  memory.writeU32(worldAddress,0x481ec,4096);
  const wrappers = slots.map((c,i)=>c ? 0x10000000+i*0x20000 : 0);
  const w=memory.writeU32, h=memory.writeU16;
  let frame=0, requestSerial=0;

  function select(actor, id, initialFrame, force=false) {
    const entry=actors.get(actor); if (!entry) return undefined;
    if (!force && entry.sequenceId===id) return 1;
    const sequence=entry.sequences.find(s=>s.id===id); if (!sequence) return undefined;
    entry.sequenceId=id;
    const start=Number.isInteger(initialFrame)&&initialFrame>=0&&initialFrame<sequence.frames.length
      ? initialFrame : sequence.loopStartFrame;
    entry.timeline=createNativeCharacterAnimationTimeline(sequence,{initialSnapshot:{frameIndex:start,elapsedQ12:0,active:1}});
    entry.request={sequenceId:id,sequenceStartFrame:frame,sequenceInitialFrame:start,
      sequenceRequestId:++requestSerial,nativeRequest:true,timingEvidence:'NORMAL_MOVE_VM_NATIVE_REQUEST'};
    memory.writeU8(actor,0x59,memory.readU8(actor,0x58)); memory.writeU8(actor,0x58,id);
    const table=actor+0x1200, data=actor+0x1220;
    w(actor,0x8c,table);h(table,0,sequence.frames.length);w(table,0xc,data);
    sequence.frames.forEach((f,i)=>h(data,i*8+4,f.ticks));
    updateCell(actor,entry);
    return 1;
  }
  function updateCell(actor,entry) {
    const sample=entry.timeline.getSnapshot();
    h(actor+0x1100,0,sample.cell);
    // 02047C48/5C/6C read the animator. The table and index aliases are shared
    // with the exact cell-box natives, never derived from trimmed atlas size.
    entry.sample=sample;
  }
  slots.forEach((c,i)=>{
    if (!c) return;
    const wrapper=wrappers[i],actor=wrapper+0x400,entity=BATTLE_SPECIES_ENTITIES[c.speciesId];
    const profile=BATTLE_CHARACTER_PROFILES[entity],geometry=BATTLE_CHARACTER_GEOMETRY[entity];
    if (!profile || !geometry) return;
    const stand=stands[i], entry={slot:i,entity,standEvidence:stand.evidence,sequences:profile.sequences.map(s=>({...s,
      frames:s.frames.map(f=>({...f,texture:`${entity}/main/cell_${String(f.cell).padStart(3,'0')}`}))}))};
    actors.set(actor,entry);w(wrapper,0,actor-4);w(wrapper,4,actor);w(wrapper,0x2c,wrapper+0x300);
    const stats=wrapper+0x18000;w(wrapper,0x10,stats);w(stats,0,c.speciesId);
    for(const [key,value] of Object.entries(creatures[i]?.stats??{})){
      const match=/^field([0-9A-F]+)$/.exec(key);if(match)w(stats,parseInt(match[1],16),value);
    }
    for(const field of BATTLE_CREATURE_STAT_MAP)if(field.level!==null)w(stats,field.level,creatures[i]?.levels[field.preset]??0);
    w(actor,4,4096);w(actor,8,4096);w(actor,0x10,4096);w(actor,0x24,Math.round(stand.x*416*4096));w(actor,0x28,Math.round(stand.y*272*4096));
    [0,4,8].forEach(o=>w(wrapper+0x300,o,memory.readU32(actor,0x24+o)));
    w(actor,0x6dc,stand.facing===1?1:0);memory.writeU8(actor,0x14,stand.facing===1?0:1);
    memory.writeU8(actor,0x15,31);h(actor,0x18,32767);
    memory.writeU8(actor,0x5b,1);
    const holder=actor+0x1000,ref=actor+0x1010,bank=actor+0x1020,data=actor+0x2000;
    w(actor,0xc8,holder);w(holder,4,ref);w(ref,0,bank);
    w(actor,0x70,actor+0x10f0);w(actor+0x10f0,0,actor+0x1100);
    // Gameplay reads the NCER CELL box, not the visible-pixel alpha bounds.
    // Even a transparent animation cell has a valid original collision record.
    const frames=Object.entries(profile.cells);h(bank,0,frames.length);h(bank,2,1);w(bank,4,data);
    frames.forEach(([key,bounds])=>{
      const index=Number(key),[lx,ly,hx,hy]=bounds;
      [hx,hy,lx,ly].forEach((v,j)=>h(data,index*16+8+j*2,v));
    });
    select(actor,0,0,true);
  });
  const initialRequestCount=requestSerial;
  const address=slot=>wrappers[slot]??0;
  const actorOf=slot=>memory.readU32(address(slot),4);
  const box=slot=>readSpriteCellBox(memory,actorOf(slot),1)?.box??null;
  const position=slot=>[0x24,0x28,0x2c].map(o=>memory.readU32(actorOf(slot),o)|0);
  function syncCombatants(){slots.forEach((c,i)=>{
    if(!c||!actors.has(actorOf(i)))return;const wrapper=address(i),stats=memory.readU32(wrapper,0x10);
    for(const [o,v] of [[0x50,c.currentHp],[0x54,c.metricLimit],[0x58,c.maxHp],[0x5c,c.metricBase]])w(stats,o,v??0);
    for(const [o,v] of [[0x54,c.field54],[0x94,c.field94],[0x158,c.statusCode],[0x160,c.field160],[0x17c,c.field17C],
      [0x84,c.field84],[0x88,c.field88],[0x8c,c.field8C],[0x90,c.field90],[0x180,c.field180],
      [0x168,c.state],[0x16c,c.stateCounter],[0x170,c.statePeriod]])w(wrapper,o,v??0);
  });}
  syncCombatants();
  return {
    memory,address,actorOf,box,position,syncCombatants,worldAddress,
    worldFlags:()=>memory.readU32(worldAddress,0x5ea8),
    updateWorldFlags(){w(worldAddress,0x5ea8,BATTLE_WORLD_FLAGS.frame(memory.readU32(worldAddress,0x5ea8),slots.some(c=>c?.field94)));},
    markBattleEnding(){w(worldAddress,0x5ea8,BATTLE_WORLD_FLAGS.knockout(memory.readU32(worldAddress,0x5ea8)));w(worldAddress,0x1f12c,1);},
    requestSequence(slot,sequenceId,timingEvidence,restore=null){
      const actor=actorOf(slot),entry=actors.get(actor);if(!entry)return;
      select(actor,sequenceId,undefined,restore!==null);
      // A translated notification entry and a direct VM force/seek request
      // share one animator graph, but retain their distinct timing evidence.
      if(entry.request)entry.request={...entry.request,timingEvidence};
      if(restore){
        entry.request={...entry.request,sequenceStartFrame:restore.startFrame};
        for(let i=restore.startFrame;i<restore.currentFrame;i++)entry.timeline.advanceNative(4096);
        updateCell(actor,entry);
      }
    },
    targetPoint(slot) {const b=box(slot);if(!b)return null;
      const p=memory.readU32(address(slot),0x2c),[x,y,z]=[0,4,8].map(o=>memory.readU32(p,o)|0);
      return launchPosition({x,y,z},cellBoxToLaunchCell(b));},
    setFrame(value){frame=value;},
    advance(onlySlot=null){syncCombatants();for(const [actor,entry] of actors){
      const p=memory.readU32(wrappers[entry.slot],0x2c);
      [0,4,8].forEach(o=>w(actor,0x24+o,memory.readU32(p,o)));
      if(onlySlot!==null&&!(Array.isArray(onlySlot)?onlySlot.includes(entry.slot):entry.slot===onlySlot))continue;
      entry.timeline.advanceNative(4096);updateCell(actor,entry);}},
    call(routine,args){
      const presentation=callBattlePresentationHost(memory,worldAddress,routine,args);if(presentation!==undefined)return presentation;
      const [actor,id,initialFrame]=args,entry=actors.get(actor);
      if(routine===0x020472cc){memory.writeU8(actor,0x15,id);return actor;}
      if(routine===0x020472ec){h(actor,0x18,id);return actor;}
      if(routine===0x020472fc){memory.writeU8(actor,0x17,id);return actor;}
      if(routine===0x0204730c){w(actor,0xc,id);w(actor,0x10,initialFrame);return actor;}
      if(!entry)return undefined;
      if(routine===0x02047904)return select(actor,id,undefined);
      if(routine===0x020479a4)return select(actor,id,initialFrame,true);
      if(routine===0x02047c48)return 1-entry.sample.active;
      if(routine===0x02047c5c)return entry.sample.frameIndex;
      if(routine===0x02047c6c)return entry.sequences.find(s=>s.id===entry.sequenceId).frames.length;
      if(routine===0x02047e38)return entry.sequences.find(s=>s.id===entry.sequenceId).frames[entry.sample.frameIndex].ticks;
      if(routine===0x02047d98){const b=readSpriteCellBox(memory,actor,0)?.box;return b?(b.highY-b.lowY)<<16>>16:undefined;}
      return undefined;
    },
    project(slot){
      const actor=actorOf(slot),entry=actors.get(actor);if(!entry)return null;
      const [x,y,z]=position(slot),tint=memory.readU16(actor,0x18),channel=n=>Math.round((n&31)*255/31);
      return {stand:{x:x/4096/416,y:y/4096/272,facing:memory.readU32(actor,0x6dc)===1?1:-1,
        evidence:entry.standEvidence==='ROM_0210FD40_READY_POSITION'?'ROM_READY_STAND_AND_NATIVE_WORLD_MOTION':'EXISTING_AUTHORED_INITIAL_STAND_WITH_NATIVE_VM_MOTION'},
        motion:{heightNativePx:z/4096,rotationSinQ12:memory.readU32(actor,0xc)|0,rotationCosQ12:memory.readU32(actor,0x10)|0,
          alpha:Math.min(31,memory.readU8(actor,0x15))/31,
          tintRgb:(channel(tint)<<16)|(channel(tint>>5)<<8)|channel(tint>>10)},
        nativeAnimation:{...entry.sample},
        animationRequest:entry.request.sequenceRequestId>initialRequestCount?entry.request:null};
    }
  };
}
