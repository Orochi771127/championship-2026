// OVL19 0211A000 / ABFC / ACF8 / A568. Execution data in the one battle
// memory; presentation consumes snapshots and never allocates or ticks actors.
import profiles from '../../data/championship/battleEffectProfiles.json' with {type:'json'};
import {createNativeCharacterAnimationTimeline} from '../presentation/characterAnimationTimeline.js';
import {readSpriteCellBox} from './battleSpriteCellBox.js';
export const BATTLE_EFFECT_POOL_CAPACITY=496;

// 0211A054..A17C consumes each combatant's completed move list, including
// appended moves when its caller has them. Bank zero is counted but never loaded.
export function battleEffectBankDemand(moveLists){
 const demand=[...profiles.initialDemand];
 for(const moves of moveLists)for(const move of moves){
  const add=(field,n)=>{const id=((move[field]??0)>>>8)&255;
   if(id>=demand.length)throw new Error('BATTLE_EFFECT_BANK_OUT_OF_RANGE');
   demand[id]=(demand[id]+n)&65535;};
  for(const f of ['field24','field30','field36'])add(f,3);
  if(profiles.extraDemandScripts.includes(move.pointer28))for(const f of ['field30','field36'])add(f,3);
  add('field44',9);
 }return demand;
}

export function createBattleEffectActors({memory:m,worldAddress,loadedBankIds}){
 const base=worldAddress+0x1f218,entries=new Map(),banks=new Map(),w=m.writeU32,h=m.writeU16,b=m.writeU8;
 const freeAt=0x1add4,liveAt=0x1a614,freeCount=0x1b598,liveCount=0x1b594,modeAt=0x19e54;
 const actorAt=i=>base+0x394+i*0xd4,indexOf=a=>(a-(base+0x394))/0xd4;
 let serial=0,created=0,released=0,peak=0;const unavailable=new Set();
 for(let i=0;i<496;i++){w(base,freeAt+i*4,actorAt(i));w(base,modeAt+i*4,0);b(actorAt(i),0x5b,0);w(actorAt(i),0x54,0xffffffff);}
 w(base,freeCount,496);w(base,liveCount,0);
 for(const id of loadedBankIds){
  const bank=profiles.banks[id-1];if(!bank)continue;
  const addr=0x30000000+id*0x10000;w(base,0x134+id*4,addr);banks.set(id,{...bank,address:addr});
  h(addr,0,bank.boxes.length);h(addr,2,1);w(addr,4,addr+0x100);
  bank.boxes.forEach((box,i)=>box.forEach((v,j)=>h(addr+0x100,i*16+8+j*2,v)));
 }
 function updateCell(e){
  e.sample=e.timeline.getSnapshot();h(e.data+0x30,0,e.sample.cell);
 }
 function select(actor,id,initialFrame,force=false){
  const e=entries.get(actor);if(!e)return undefined;
  if(!force&&e.sequenceId===id)return 1;
  const s=e.bank.sequences[id];if(!s){unavailable.add(`SEQUENCE:${e.bank.id}:${id}`);return 0;}
  const start=Number.isInteger(initialFrame)&&initialFrame>=0&&initialFrame<s.frames.length?initialFrame:s.loopStartFrame;
  e.sequenceId=id;e.timeline=createNativeCharacterAnimationTimeline({...s,frames:s.frames.map(f=>({...f,texture:`effect:${e.bank.id}:${f.cell}`}))},
   {allowZeroTicks:true,initialSnapshot:{frameIndex:start,elapsedQ12:0,active:1}});
  b(actor,0x59,m.readU8(actor,0x58));b(actor,0x58,id);
  w(actor,0x8c,e.data+0x40);h(e.data+0x40,0,s.frames.length);w(e.data+0x40,0xc,e.data+0x80);
  s.frames.forEach((f,i)=>h(e.data+0x80,i*8+4,f.ticks));updateCell(e);return 1;
 }
 function allocate(encoded,mode){
  const id=(encoded>>8)&255,sequence=(encoded&255)-1;
  if(sequence<0||!id||id>=152)return 0;
  const bank=banks.get(id);if(!bank){unavailable.add(`BANK:${id}`);return 0;}
  const count=m.readU32(base,freeCount);if(!count)return 0;
  w(base,freeCount,count-1);const actor=m.readU32(base,freeAt+(count-1)*4),live=m.readU32(base,liveCount),index=indexOf(actor);
  w(base,liveAt+live*4,actor);w(base,liveCount,live+1);
  // 020475F8 reset preserves ownership fields not touched by that routine.
  for(const o of [0x24,0x28,0x2c,0xc,0x30,0x38,0x3c,0x40,0x44,0x48,0x4c,0x50])w(actor,o,0);
  for(const o of [4,8,0x10])w(actor,o,4096);w(actor,0x34,0x7fffffff);
  for(const o of [0x14,0x16,0x1a,0x58,0x59,0x5b])b(actor,o,0);
  b(actor,0x15,31);b(actor,0x17,255);h(actor,0x18,32767);
  const data=0x40000000+index*0x1000,e={actor,data,bank,id:++serial,sequenceId:null};entries.set(actor,e);
  w(actor,0xc8,data);w(data,4,data+0x10);w(data+0x10,0,bank.address);
  w(actor,0x70,data+0x20);w(data+0x20,0,data+0x30);
  // Resource setup initializes sequence0 before allocator selects lowByte-1.
  select(actor,0,undefined,true);select(actor,sequence);
  b(actor,0x5b,1);w(base,modeAt+index*4,mode);created++;peak=Math.max(peak,live+1);return actor;
 }
 function release(actor){
  const live=m.readU32(base,liveCount);
  for(let i=0;i<live;i++)if(m.readU32(base,liveAt+i*4)===actor){
   w(base,liveCount,live-1);w(base,liveAt+i*4,m.readU32(base,liveAt+(live-1)*4));
   const n=m.readU32(base,freeCount);w(base,freeAt+n*4,actor);w(base,freeCount,n+1);w(base,modeAt+indexOf(actor)*4,0);
   // ACF8 only removes the live handle. Resource/animator memory survives
   // until the next allocation resets that slot; a VM may still query it.
   released++;return true;
  }return false;
 }
 function animate(actor,delta=4096){const e=entries.get(actor);if(!e)return undefined;e.timeline.advanceNative(delta);updateCell(e);return actor;}
 function physics(actor,delta=4096){
  // 0204819C scales acceleration, then adds velocity without scaling position.
  // Signed long multiply includes the native +2048 rounding before ASR 12.
  for(let i=0;i<3;i++){const acc=m.readU32(actor,0x48+i*4)|0;
   const scaled=delta===4096?acc:Number(BigInt.asIntN(32,(BigInt(acc)*BigInt(delta|0)+2048n)>>12n));
   const v=((m.readU32(actor,0x3c+i*4)|0)+scaled)|0;
   w(actor,0x3c+i*4,v);w(actor,0x24+i*4,(m.readU32(actor,0x24+i*4)+v)|0);}
  return actor;
 }
 return {
  base,allocate,release,has:actor=>entries.has(actor),box:actor=>readSpriteCellBox(m,actor,1)?.box??null,
  position:actor=>[0x24,0x28,0x2c].map(o=>m.readU32(actor,o)|0),
  advanceOwned(object){for(let i=0;i<24;i++){const a=m.readU32(object,0x24+i*4);if(a&&m.readU8(a,0x5b)){animate(a);physics(a);}}},
  advance({exclusive=false}={}){for(let i=0;i<m.readU32(base,liveCount);i++){
   const a=m.readU32(base,liveAt+i*4),e=entries.get(a),mode=m.readU32(base,modeAt+indexOf(a)*4);
   if(!m.readU8(a,0x5b)||(mode===0&&!e.sample.active)){release(a);i--;}
   else if(mode===0&&!exclusive){animate(a);physics(a);}
  }},
  clear(){while(m.readU32(base,liveCount)){const a=m.readU32(base,liveAt);b(a,0x5b,0);release(a);}},
  call(routine,args){const [actor,id,start]=args;
   if(routine===0x0211b264)return allocate(id,start);
   // AD9C compares the actor's resource against loaded banks, not its sequence.
   if(routine===0x0211ad9c){if(actor!==base)return undefined;return entries.get(id)?.bank.id??0;}
   if(!entries.has(actor))return undefined;const e=entries.get(actor);
   if(routine===0x02047904)return select(actor,id);
   if(routine===0x020479a4)return select(actor,id,start,true);
   if(routine===0x02047a08)return animate(actor,id);
   if(routine===0x0204819c)return physics(actor,id);
   if(routine===0x02047c48)return 1-e.sample.active;
   if(routine===0x02047c5c)return e.sample.frameIndex;
   if(routine===0x02047c6c)return e.bank.sequences[e.sequenceId].frames.length;
   if(routine===0x02047e38)return e.bank.sequences[e.sequenceId].frames[e.sample.frameIndex].ticks;
   if(routine===0x02047d98){const box=readSpriteCellBox(m,actor,0)?.box;return box?(box.highY-box.lowY)<<16>>16:0;}
   return undefined;
  },
  snapshot(){return Array.from({length:m.readU32(base,liveCount)},(_,i)=>entries.get(m.readU32(base,liveAt+i*4)))
   .filter(e=>m.readU8(e.actor,0x5b)).map(e=>({id:e.id,actor:e.actor,bankId:e.bank.id,name:e.bank.name,
   sequenceId:e.sequenceId,cell:e.sample.cell,frame:e.sample.frameIndex,active:e.sample.active,
   point:[0x24,0x28,0x2c].map(o=>m.readU32(e.actor,o)|0),box:readSpriteCellBox(m,e.actor,1)?.box,
   sin:m.readU32(e.actor,0xc)|0,cos:m.readU32(e.actor,0x10)|0,scaleX:m.readU32(e.actor,4)|0,scaleY:m.readU32(e.actor,8)|0,
   flip:m.readU8(e.actor,0x14),alpha:m.readU8(e.actor,0x15),tint:m.readU16(e.actor,0x18)}));},
  diagnostics:()=>({created,released,peak,active:m.readU32(base,liveCount),free:m.readU32(base,freeCount),loadedBanks:[...banks.keys()],unavailable:[...unavailable]})
 };
}
