// Controlled native-body review. Starting positions/target selection are test
// inputs. No AI, HP/contact, projectile pool, save or normal encounter is claimed.
import { createBattleNativeMemory } from '../../src/championship/battle/battleNativeMemory.js';
import { callBattleNativeMath } from '../../src/championship/battle/battleNativeMath.js';
import { callBattleNative } from '../../src/championship/battle/battleScriptNatives.js';
import { getBattleCatalogRecord } from '../../src/championship/battle/battleCatalogs.js';

export function createNativeMotionReview(moveId) {
  if (![337,455].includes(moveId)) throw new Error('REVIEW_MOVE_NOT_BOUND');
  const move = getBattleCatalogRecord('moves',moveId),air=moveId===455;
  const memory=createBattleNativeMemory();
  const action=0x2300000,caller=0x2301000,owner=0x2302000,target=0x2303000;
  const actor=0x2304000,targetActor=0x2305000,position=0x2306000,record=0x2307000;
  const write=memory.writeU32;
  [[action,0xe4,owner],[action,0xe8,target],[action,0x20,record],[caller,0x2c,position],
    [owner,4,actor],[owner,0x2c,position],[target,4,targetActor],[record,0x10,move.field10],
    [actor,0x24,100*4096],[actor,0x28,180*4096],[targetActor,0x24,280*4096],[targetActor,0x28,130*4096],
    [position,0,100*4096],[position,4,180*4096]].forEach(v=>write(...v));
  memory.writeU8(actor,0x15,31);memory.writeU16(actor,0x18,32767);
  let frame=0,result=0,requestId=0,request={sequenceId:0,sequenceStartFrame:0,nativeRequest:true};
  const host={...memory,yield(){},call(address,...args){
    const math=callBattleNativeMath(address,args,memory);if(math!==undefined)return math;
    if(address===0x020472cc){memory.writeU8(args[0],0x15,args[1]);return args[0];}
    if(address===0x020472ec){memory.writeU16(args[0],0x18,args[1]);return args[0];}
    if(address===0x020479a4){
      request={sequenceId:args[1],sequenceInitialFrame:args[2],sequenceStartFrame:frame,
        sequenceRequestId:++requestId,nativeRequest:true,timingEvidence:'CONTROLLED_NATIVE_BODY_REQUEST'};
      return 1;
    }
    throw new Error('REVIEW_UNBOUND_NATIVE_HELPER_'+address.toString(16));
  }};
  function project(slot){
    if(slot===3)return {stand:{x:280/416,y:130/272,facing:-1,evidence:'CONTROLLED_TARGET'},
      motion:{heightNativePx:0,alpha:1,tintRgb:0xffffff},animationRequest:{sequenceId:0,nativeRequest:true}};
    if(slot!==0)return null;
    const tint=memory.readU16(actor,0x18),channel=n=>Math.round((n&31)*255/31);
    return {stand:{x:(memory.readU32(actor,0x24)|0)/4096/416,y:(memory.readU32(actor,0x28)|0)/4096/272,
      facing:1,evidence:'CONTROLLED_INITIAL_POSITION_ORIGINAL_NATIVE_MOTION'},
      motion:{heightNativePx:(memory.readU32(actor,0x2c)|0)/4096,alpha:Math.min(31,memory.readU8(actor,0x15))/31,
        tintRgb:(channel(tint)<<16)|(channel(tint>>5)<<8)|channel(tint>>10)},animationRequest:request};
  }
  return {move,memory,project,step(){frame++;result=callBattleNative(air?0x0211ea68:0x0211e5a0,[caller,action],host);},
    snapshot(){return {moveId,frame,state:memory.readU32(action,8),result,
      positionQ12:[0x24,0x28,0x2c].map(o=>memory.readU32(actor,o)|0),
      complete:memory.readU32(action,8)===(air?8:5),request,projection:project(0)};}};
}
