// OVL10 02111350 sets category 1 for title matches; category 0 is the
// championship. OVL8 0210D0C8 prepares the result; 0210E328 commits rank.
import {titleEventAt} from './titleEventSchedule.js';

export const NATIVE_TITLE_RANK_RULES=Object.freeze([[0,2],[0,4],[1,3],[1,6],[2,3],[2,7],[3,3]].map(Object.freeze));
const fail=()=>{throw new TypeError('INVALID_NATIVE_TITLE_PROGRESS_SAVE');};
export function normalizeNativeTitleProgress(input){
  if(input===undefined||input===null)return null;
  if(typeof input!=='object'||Array.isArray(input)||input.version!==1
    ||Object.keys(input).some(k=>!['version','registered','championship','feeWaiver','record'].includes(k)))fail();
  const registered=input.registered,c=input.championship;
  if(!Array.isArray(registered)||registered.length>61||new Set(registered).size!==registered.length
    ||Array.from(registered).some(n=>!Number.isInteger(n)||n<0||n>=61)
    ||!c||Object.keys(c).some(k=>!['stage','entry','worldEntry'].includes(k))
    ||!Number.isInteger(c.stage)||c.stage<0||c.stage>3
    ||![0,1].includes(c.entry)||![0,1].includes(c.worldEntry)||typeof input.feeWaiver!=='boolean')fail();
  const record=input.record;
  if(record!==undefined&&(!record||Object.keys(record).some(k=>!['battles','wins'].includes(k))
    ||![record.battles,record.wins].every(n=>Number.isInteger(n)&&n>=0&&n<=9999)||record.wins>record.battles))fail();
  return Object.freeze({version:1,registered:Object.freeze([...registered].sort((a,b)=>a-b)),
    championship:Object.freeze({...c}),feeWaiver:input.feeWaiver,
    ...(record===undefined?{}:{record:Object.freeze({...record})})});
}
export function createNativeTitleProgress(){
  // ARM9 02067B38 / 02067B44: the two original new-player registrations.
  return normalizeNativeTitleProgress({version:1,registered:[4,8],championship:{stage:0,entry:0,worldEntry:0},feeWaiver:false,record:{battles:0,wins:0}});
}
export function emptyNativeTitleProgress(){
  // A legacy save has no registration history. Do not invent new-game flags.
  const {record,...legacy}=createNativeTitleProgress();
  return normalizeNativeTitleProgress({...legacy,registered:[]});
}

// OVL19 0210E21C..27C, player+4D8/4DA. Network (3) and mode 5 do
// not enter these counters. Legacy saves have no recoverable aggregate history.
export function applyNativeBattleRecord(state,{mode,won}){
  if(!state.record||[3,5].includes(mode))return state;
  return normalizeNativeTitleProgress({...state,record:{battles:Math.min(9999,state.record.battles+1),wins:Math.min(9999,state.record.wins+Number(won))}});
}

// OVL8 0210DB84..DBD8, ARM9 02002738: Q12 rounded division, then
// percentage rounded only when the fractional part is strictly above one half.
export function nativeBattleWinPercent(record){
  if(!record||record.battles===0)return null;
  const q=Number(((BigInt(record.wins)<<32n)/BigInt(record.battles)+0x80000n)>>20n);
  const percent=q*100;
  return (percent>>12)+Number((percent&4095)>2048);
}
export function toggleNativeTitleRegistration(state,{recordIndex,rank,won=[]}){
  const event=titleEventAt(recordIndex);
  if(!event?.scannedByGame||event.unlockThreshold>(rank>>>1)||won.includes(recordIndex))return null;
  const registered=new Set(state.registered);
  if(registered.has(recordIndex))registered.delete(recordIndex);else registered.add(recordIndex);
  return normalizeNativeTitleProgress({...state,registered:[...registered]});
}
export function toggleNativeChampionshipRegistration(state,year){
  if(state.championship.stage<1||!Number.isInteger(year)||year<0)return null;
  const key=year%4===3?'worldEntry':'entry';
  return normalizeNativeTitleProgress({...state,championship:{...state.championship,[key]:1-state.championship[key]}});
}
export function resolveNativeTitleResult({rank,category,matchIndex,won,registered,championship,rounds,feeWaiver=false}){
  let nextRank=rank,championshipNotice=0,rankNotice=null;
  const wins=new Set(won),entries=new Set(registered),c={...championship};
  if(rounds.every(n=>n!==0)&&!(category===1&&matchIndex===61)){
    if(category===1&&matchIndex>=0&&matchIndex<61){
      wins.add(matchIndex);entries.delete(matchIndex);
      const rule=NATIVE_TITLE_RANK_RULES[rank];
      if(rule&&[...wins].filter(i=>titleEventAt(i)?.unlockThreshold===rule[0]).length>=rule[1]){
        nextRank=rank+1;
        if(nextRank===4&&c.stage<1){c.stage=1;championshipNotice=1;}
      }
      if(rank===8&&Array.from({length:61},(_,i)=>i).every(i=>wins.has(i))){nextRank=9;feeWaiver=true;}
    }else if(category===0){
      if(matchIndex===0&&c.stage<2){c.stage=2;c.entry=0;championshipNotice=2;}
      else if(matchIndex===1){if(c.stage<3){c.stage=3;c.worldEntry=0;}if(rank<8)nextRank=8;}
    }
  }
  if(nextRank!==rank)rankNotice=({1:117,3:118,5:119,7:120})[nextRank]??null;
  return Object.freeze({rank:nextRank,won:Object.freeze([...wins].sort((a,b)=>a-b)),
    registered:Object.freeze([...entries].sort((a,b)=>a-b)),championship:Object.freeze(c),feeWaiver,rankNotice,championshipNotice});
}
