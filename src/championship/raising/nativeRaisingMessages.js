// Original four-entry mailbox: ARM9 0208BFD4 / 0208C1FC.
// This module owns no clock/storage/ticker. The app persists it in v5.
import data from '../../data/championship/catalogs/raising-messages.r1.json' with {type:'json'};
export const nativeRaisingMessageDefinition=id=>data.notes[id]??null;
export const nativeRaisingMessageEffect=id=>data.effects[id]??null;
export function selectNativeMorningMessages({year,season,dayOfSeason,cursor,birthday,birthdayClaimed,rosterCount},rng){
  const ids=[];let selected=null;
  if(birthday&&!birthdayClaimed)ids.push(197+rng.next(215)%3);
  if(dayOfSeason===0){const id=66+season+year*4;if(id<=81)ids.push(id);}
  else if(rng.next(213)%25===0){
    let id=175+rng.next(214)%21;
    if(id>=185){if(rosterCount<=0)id=-1;else selected=rng.next(210)%rosterCount;}
    if(id>=0)ids.push(id);
  }else if(cursor+3<=65){ids.push(cursor+3);cursor++;}
  return {cursor,selected,ids};
}
export function createNativeRaisingMessages(){return normalizeNativeRaisingMessages({version:1,cursor:0,nextId:1,
  queue:[],activeId:null,activeFrames:0,birthdayClaimed:false,entryChecked:false,morningPending:false,readFlags:[],cake:0});}
export function normalizeNativeRaisingMessages(s){
  if(s===undefined||s===null)return null;
  const fail=()=>{throw new TypeError('INVALID_NATIVE_RAISING_MESSAGES_SAVE');};
  const int=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
  const keys=['version','cursor','nextId','queue','activeId','activeFrames','birthdayClaimed','entryChecked','morningPending','readFlags','cake'];
  if(s.version!==1||Object.keys(s).some(k=>!keys.includes(k))||!int(s.cursor,255)||!int(s.nextId,Number.MAX_SAFE_INTEGER)||s.nextId<1
    ||!Array.isArray(s.queue)||s.queue.length>4||!int(s.activeFrames,61)
    ||['birthdayClaimed','entryChecked','morningPending'].some(k=>typeof s[k]!=='boolean')
    ||!Array.isArray(s.readFlags)||s.readFlags.some(n=>!int(n,11))||new Set(s.readFlags).size!==s.readFlags.length||!int(s.cake,5))fail();
  const ids=new Set(),queue=s.queue.map(q=>{
    if(!q||Object.keys(q).some(k=>!['id','textId','sender','system','minutes','required','effectId','opened','effectApplied','subjectName'].includes(k))
      ||!int(q.id,s.nextId-1)||q.id===0||ids.has(q.id)||!int(q.textId,280)||!int(q.sender,12)
      ||!Number.isInteger(q.minutes)||q.minutes< -1||q.minutes>1440
      ||!Number.isInteger(q.effectId)||q.effectId< -1||q.effectId>=86
      ||['system','required','opened','effectApplied'].some(k=>typeof q[k]!=='boolean')
      ||typeof q.subjectName!=='string'||q.subjectName.length>5)fail();
    ids.add(q.id);return Object.freeze({...q});
  });
  if(s.activeId!==null&&!ids.has(s.activeId))fail();
  return Object.freeze({...s,queue:Object.freeze(queue),readFlags:Object.freeze([...s.readFlags])});
}
export function enqueueNativeRaisingMessage(state,id,{subjectName='',system=false,textId=null,minutes=null,required=null}={}){
  if(state.queue.length>=4)return state;
  const d=nativeRaisingMessageDefinition(id);
  if(!d&&textId===null)throw new TypeError('UNKNOWN_NATIVE_RAISING_MESSAGE');
  const q={id:state.nextId,textId:textId??d.textId,sender:system?12:d.sender,system,
    minutes:minutes??d.minutes,required:required??d.required,effectId:system?-1:d.effectId,opened:false,effectApplied:false,subjectName};
  return normalizeNativeRaisingMessages({...state,nextId:state.nextId+1,queue:[...state.queue,q]});
}
export function ageNativeRaisingMessages(state,minutes){
  if(minutes<=0)return state;
  let activeId=state.activeId;
  const queue=state.queue.flatMap(q=>{
    if(q.opened||q.minutes<0)return [q];
    const remaining=q.minutes-minutes;
    if(remaining<0){if(q.required){activeId??=q.id;return [q];}return [];}
    return [{...q,minutes:remaining}];
  });
  return normalizeNativeRaisingMessages({...state,queue,activeId});
}
export function openNativeRaisingMessage(state){
  const q=state.activeId!==null?state.queue.find(q=>q.id===state.activeId):state.queue.findLast(q=>q.system&&!q.opened)??state.queue[0];
  if(q?.opened)return state;
  return q?normalizeNativeRaisingMessages({...state,activeId:q.id,activeFrames:0,queue:state.queue.map(n=>n.id===q.id?{...n,opened:true}:n)}):state;
}
export function closeNativeRaisingMessage(state){
  const q=state.queue.find(n=>n.id===state.activeId);
  if(!q)return state;
  const readFlags=q.textId>=95&&q.textId<=106?[...new Set([...state.readFlags,q.textId-95])]:state.readFlags;
  return normalizeNativeRaisingMessages({...state,queue:state.queue.filter(n=>n!==q),activeId:null,activeFrames:0,
    birthdayClaimed:state.birthdayClaimed||(q.textId>=197&&q.textId<=200),readFlags});
}
