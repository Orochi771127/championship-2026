// OVL19 normal target/positioning branches. One existing session owns state;
// the host supplies its native world, animator and shared launch pool.
import tables from '../../data/championship/battleNormalFlowTables.json' with {type:'json'};
import {actionInterrupted,hasFreeLaunchSlot,runWaitToLaunchState,launchStateAborts,launchNotifyCode} from './battleTurnStates.js';
import {battleAngleIndex} from './battleNativeMath.js';
import {divFx} from './battleScriptVm.js';
import hitTables from '../../data/championship/battleHitTables.json' with {type:'json'};

export const BATTLE_NORMAL_FIELDS=Object.freeze(['field1C','field1E','field20','field48','field154','field184','field188']);
// 0210CDD0 constructor; 0210D3A4 frame head; 02115068 last-team HP-zero.
// Preserve unrelated flag bits. Launches read bit 1, not equality with 2.
export const BATTLE_WORLD_FLAGS=Object.freeze({
  initial:value=>(value&~3)>>>0,
  frame:(value,engaged)=>(engaged?value&~1:value|1)>>>0,
  knockout:value=>(value|2)>>>0
});
const signed16=n=>(n<<16)>>16;
const verticalAngle=a=>(a>0x2000&&a<0x6000)||(a>0xa000&&a<0xe000);
const enter=(c,s)=>{c.state=s;c.stateCounter=-255;};
const fx=(a,b)=>Number(BigInt.asIntN(32,(BigInt(a)*BigInt(b)+2048n)>>12n));
export function normalBattleVector(angle,length){
  const i=(angle&65535)>>4;return [fx(length,hitTables.sinCos[i*2+1]),fx(length,hitTables.sinCos[i*2])];
}
function distance(a,b){
  let sum=0n;for(let i=0;i<3;i++){const d=BigInt((a[i]-b[i])|0);sum+=d*d;}
  const value=BigInt.asUintN(64,sum<<2n);if(!value)return 0;
  let x=value,y=(x+1n)>>1n;while(y<x){x=y;y=(x+value/x)>>1n;}
  return Number((x+1n)>>1n)|0;
}
/** 0210F5D8: one symmetric matrix, including original <16px separation. */
export function updateNormalBattleGeometry(points,skipSeparation=false){
  const distances=Array.from({length:6},()=>Array(6).fill(0));
  const angles=Array.from({length:6},()=>Array(6).fill(65535));
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
    let d=distance(points[i],points[j]);const a=battleAngleIndex(points[j][1]-points[i][1],points[j][0]-points[i][0]);
    const reverse=(a+32768)&65535;
    if(!skipSeparation&&d<65536){
      const amount=Math.trunc((65536-d)/2),v=normalBattleVector(a,amount),r=normalBattleVector(reverse,amount);
      for(let axis=0;axis<2;axis++){points[i][axis]=(points[i][axis]-v[axis])|0;points[j][axis]=(points[j][axis]-r[axis])|0;}d=65536;
    }
    distances[i][j]=distances[j][i]=d;angles[i][j]=a;angles[j][i]=reverse;
  }
  return {distances,angles};
}

/** 02112A38..12C20, before the existing R8 bounds/counter tail. */
export function moveNormalBattleNotification(c,h){
  c.field44&=65535;c.field50&=65535;
  if(c.field3C>0){
    if([6,13].includes(c.statusCode)&&c.field40>0){c.field40=h.walk()>>1;h.writeActor(0x440,0);}
    let length=fx(c.field3C,c.field40);if(c.field160===3)length=fx(length,5120);
    const v=normalBattleVector(c.field44,length);for(let i=0;i<2;i++)h.point[i]=(h.point[i]+v[i])|0;
  }
  if(c.field4C>512){
    const v=normalBattleVector(c.field50,fx(c.field48,c.field4C));for(let i=0;i<2;i++)h.point[i]=(h.point[i]+v[i])|0;
    c.field4C=fx(c.field4C,tables.impulseDecay);if(c.field4C<=512)c.field4C=0;
  }
}

/** 02112D5C..130BC. Called only for 0..12, using the one native animator. */
export function updateNormalBattleNotification(c,h){
  const n=c.field17C,k=c.field180;
  if(k===0){
    if(n<=1){c.field40=0;h.sequence(n===1||c.currentHp>0?0:15);if(n===1)h.writeActor(0x440,0);}
    else if(n<=7){c.field40=[3,7].includes(n)?h.run():h.walk();h.sequence([3,7].includes(n)?3:2);h.writeActor(0x440,[3,7].includes(n)?1:0);}
    else if(n<=11){h.sequence(n-1);c.field48=c.field3C;c.field4C=c.field40;c.field40=0;h.writeActor(0x440,0);}
    else if(n===12){h.sequence(35);c.field40=0;}
  }
  // 02112E68's float subtraction is verified separately by the CPU oracle.
  if(n===3&&k>240&&k%8!==0&&c.field40>h.walk())c.field40=Math.trunc(Math.fround(Math.fround(c.field40)-tables.runDecay));
}

/** 02111F20. Collection order is original packed team order, not six slots. */
export function selectNormalBattleTarget(entries,selector,rng,cache={}){
  if(selector===10)return cache.count20>0?cache.target28??null:null;
  if(selector===11)return cache.count24>0?cache.target34??null:null;
  if(selector===12){
    let pick=entries.length?rng.next(216)%entries.length:(rng.next(216),0);
    for(let i=0;i<entries.length;i++){
      // The two different indices are in 02112324/330/340, including the
      // original quirk: the notification check uses i, the flags use pick.
      if(!entries[pick]||actionInterrupted(entries[i]??{}))continue;
      if(!(entries[pick].flags9A&2))return pick;
      pick=(pick+1)%entries.length;
    }
    return null;
  }
  const fields={1:'stat84',2:'stat88',3:'maxHp',4:'metricBase',6:'stat84',8:'currentHp',9:'metricLimit'};
  if(![0,5].includes(selector)&&!fields[selector])return null;
  let best=selector<5?0:9999999,index=null;
  entries.forEach((c,i)=>{
    if(!c||actionInterrupted(c))return;
    const value=[0,5].includes(selector)?signed16(c.field1C??1)+(signed16(c.field1E)>0?3000:0)
      +(signed16(c.field20)>0?-3000:0):c[fields[selector]];
    if(selector<5?value>best:value<best){best=value;index=i;}
  });
  return index;
}
export function normalBattleTargetSelector(profile){
  const value=tables.targetProfiles[profile];
  if(value===undefined)throw new Error('BATTLE_TARGET_PROFILE_UNTRACED');
  return value;
}

/** 0210FD40..FDA0 table; ready positions after the intro removes +800 Y. */
export function normalBattleStands(slots){
  const next=[0,0],counts=[0,1].map(t=>slots.filter((c,i)=>c&&Math.floor(i/3)===t).length);
  return slots.map((c,i)=>{
    if(!c)return null;const team=Math.floor(i/3),ordinal=next[team]++;
    const [x,y]=tables.placements[team*3+ordinal+(counts[team]===2?1:0)];
    return {x:x/416,y:y/272,facing:team===0?1:-1,evidence:'ROM_0210FD40_READY_POSITION'};
  });
}

/** 02114154..141B4 uses two RNG calls, including the sign-test call. */
export function normalBattleSpeedScalar(rng){rng.next(216);return divFx((300+rng.next(216))*4096,0x193000);}

/** 0211240C, packed team slots and their persistent support-selection counters. */
export function updateNormalBattleTeam(team,members){
  let alive=0,below40=0,below50=0,below60=0,below80=0,statusCount=0;
  members.forEach((c,j)=>{
    if(!c)return;
    if(c.currentHp===0){team.metric44[j]=team.metric54[j]=0;return;}
    alive++;const ratio=Math.trunc(Math.imul(c.currentHp,100)/c.maxHp);
    if(ratio<40){below40++;team.metric44[j]=(team.metric44[j]+(ratio<20?2:1))|0;}
    if(ratio<50)below50++;if(ratio<60)below60++;if(ratio<80)below80++;
    const s=c.statusCode;
    if(s===0||s===14)team.metric54[j]=0;
    else if(s>=1&&s<=13){statusCount++;team.metric54[j]=(team.metric54[j]+([1,2,3,6].includes(s)?1:[5,12,13].includes(s)?3:2))|0;}
  });
  team.guard40=(below60===alive||below40>0||(below50>0&&below80===alive))?(team.guard40+1)|0:0;
  team.guard50=statusCount;
}

/** 0211C144 guard order before VM/prelude; +5C may be null. */
export function normalBattleLaunchGuard({owner,move,globalLock,objectFlags,target}){
  if(owner.field154)return {accepted:false,reason:'OWNER_LOCK',moveAssigned:false};
  if(!move)return {accepted:false,reason:'NO_MOVE',moveAssigned:false};
  const reject=reason=>({accepted:false,reason,moveAssigned:true});
  if(globalLock)return reject('GLOBAL_PRESENTATION_LOCK');
  if(objectFlags&1)return reject('OBJECT_IN_USE');
  if(target&&target.currentHp<=0)return reject('TARGET_HP');
  if(owner.metricLimit<(move.actionCost&65535))return reject('RESOURCE');
  return {accepted:true,moveAssigned:true,resourceAfter:owner.metricLimit-(move.actionCost&65535)};
}

/** 02115F38 state 3. Angle/distance are the previous frame's world matrix. */
export function stepNormalBattlePosition(c,h){
  if(c.stateCounter===0)c.statePeriod=h.rng.next(216)%16+15;
  if(!h.target||actionInterrupted(h.target)){h.gate();return;}
  const a=h.angle,d=h.distance,near=c.field184,[x,y]=h.point,ty=h.targetPoint[1];
  if(d<near){
    if(x<near)c.field44=a+(y<near?0x4000:y>272*4096-near?-0x4000:y<ty?-0x4000:0x4000);
    else if(x>416*4096-near)c.field44=a+(y<near?-0x4000:y>272*4096-near?0x4000:y<ty?0x4000:-0x4000);
    else c.field44=a+0x8000+(h.rng.next(216)%5)*4096-0x2000;
    h.notify(3);
  }else if(d>near+c.field188){h.notify(7);c.field44=a;}
  else{
    const right=a<0x4000||a>=0xc000;
    c.field44=a+((right===(y<ty))?0x3000:-0x3000);
    if(verticalAngle(a))h.notify(3);
    else if(h.rng.next(216)%4)h.notify(2);
    else {c.field44=a;h.notify(1);}
  }
  if(c.field28<=0)h.gate();
}

/** 021161F0 / 02116314: offset aim, near-distance and nonvertical launch. */
export function stepNormalBattleApproach(c,h){
  if(!h.target||actionInterrupted(h.target)){h.gate();return;}
  const a=h.angle,[x,y]=h.point,[tx,ty]=h.targetPoint;
  const offsetX=tx+((a<0x4000||a>=0xc000)?-65536:65536);
  c.field44=battleAngleIndex(ty-y,offsetX-x);
  if(h.distance>=48*4096)h.notify(7);
  else if(!verticalAngle(a)&&h.distance<32*4096&&hasFreeLaunchSlot(h.launchSlots)){
    enter(c,c.state===4?14:15);return;
  }
  c.statePeriod=4;if(c.field28<=0)h.gate();
}

/** 02112394: closest nonsuspended packed opponent; no HP/notify filter here. */
export function selectBattlePursuitTarget(entries,distances){
  let nearest=0x270f000,index=null;
  entries.forEach((c,i)=>{if(!(c.flags9A&2)&&distances[i]<nearest){nearest=distances[i];index=i;}});
  return index;
}

/** 021164C8. Entry target/move selection is bound by battleNormalRuntime. */
export function stepBattlePursuit(c,h){
  if(!h.target||actionInterrupted(h.target)){h.gate();return;}
  const a=h.angle,[x,y]=h.point,[tx,ty]=h.targetPoint;
  c.field44=battleAngleIndex(ty-y,tx+((a<0x4000||a>=0xc000)?-65536:65536)-x);
  if(h.distance>=48*4096)h.notify(7);
  else if(!verticalAngle(a)&&h.distance<32*4096&&hasFreeLaunchSlot(h.launchSlots)&&c.field24<=0){enter(c,14);return;}
  c.statePeriod=4;
}

/** 02116FD8: action 1 applies status 1 to eligible packed opponents. The
 * final notification belongs to the owner in the ROM, including repeats. */
export function finishBattleTargetedAction(moveId,opponents,h){
  if(moveId!==1)return;
  opponents.forEach((c,i)=>{
    if(c.currentHp<=0||actionInterrupted(c))return;
    h.status(i,1);c.stateCounter=1;h.targetOwner(i);h.chooseOrdinary(i);h.notifyOwner(7);
  });
}

/** 14/15 entry, allocation, launch and animation/lock completion. */
export function stepNormalBattleLaunch(c,h){
  const state=c.state;
  if(c.stateCounter===0){
    if(launchStateAborts(state,{counter:0,field17C:c.field17C,field180:c.field180})!==null){enter(c,1);return;}
    if(state===14)c.statePeriod=1;
    if(state===16&&h.globalAbort){enter(c,1);return;}
    if(state===16)h.notify(12);
    const slot=h.launchSlots.findIndex(x=>!x);
    if(slot>=0){
      const action=h.allocate(slot,state===16);
      if(action){
        if(h.globalAbort||!h.initialize(action)){
          h.release(slot,action);enter(c,1);return;
        }
        if(state!==16){
          c.field44=h.angle;h.face(h.angle);
          const n=launchNotifyCode(h.move.field10);if(n!==null)h.notify(n);
          if(state===14){c.field50=h.angle;c.field48=c.field3C;c.field4C=4096;}
        }
        c.field1C=signed16(c.field1C+(state===15?120:60));
      }
    }
    if(state!==14){c.statePeriod=1;return;}
  }
  if(!c.field154&&h.finished()){
    const old=c.stateCounter;c.stateCounter++;
    if(old>=2){enter(c,1);if(state===16)h.afterTargeted?.();}
  }else c.stateCounter=1;
}

export function stepNormalBattleWait(c,h){
  const r=runWaitToLaunchState(c.state,{counter:c.stateCounter,cooldown:c.field28,launchSlots:h.launchSlots});
  if(r.notify!==null)h.notify(r.notify);
  if(r.nextState!==null)enter(c,r.nextState);
  if(r.reEntersGate)h.gate();
}
