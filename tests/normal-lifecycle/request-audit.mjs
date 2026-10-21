import assert from 'node:assert/strict';
const PATHS=new Set(['/assets/production/original-music-r1/bgm_login_page.mp3','/assets/production/scene-music-r1/raising/a_quiet_evening_training.mp3']);
const healthy=s=>s?.screen==='RAISING_HOME'&&s.titleHidden===true&&s.music?.scene==='raising'&&typeof s.music.cue==='string'&&s.music.cue.trim().length>0&&s.music.cue!=='login'&&typeof s.music.requestedCue==='string'&&s.music.requestedCue.trim().length>0&&s.music.requestedCue!=='login'&&s.music.error===null;
export function matchExpectedMusicDisposal(f,finalState,releases,{origin,engine}){
 let u;try{u=new URL(f.url);}catch{return null;}
 const expectedError=engine==='chromium'?'net::ERR_ABORTED':engine==='webkit'?'Load request cancelled':null;
 if(u.origin!==origin||!PATHS.has(u.pathname)||u.search||u.hash||f.resourceType!=='media'||!expectedError||f.error!==expectedError||![200,206].includes(f.responseStatus)||!['leaving-login','raising-loading'].includes(f.phase)||!(Number.isFinite(f.requestStartedAt)&&f.requestStartedAt>0&&Number.isFinite(f.failedAt))||!healthy(f.observedAfterFailure)||!healthy(finalState))return null;
 return releases.find(r=>r.url===f.url&&r.nativeLoadWithoutSrc===true&&Number.isFinite(r.at)&&Number.isFinite(r.loadAt)&&r.at>=f.requestStartedAt&&r.at<=f.failedAt&&r.loadAt>=r.at&&r.loadAt<=f.failedAt+500&&f.failedAt-r.loadAt<3000)??null;
}
export async function watchNormalRequests(page,base,engine){
 // Observation only: call the same native methods, with unchanged args/this and
 // exact return values. No src replacement, cancellation, timing or audio mute.
 await page.addInitScript(()=>{
  const releases=[],pending=new WeakMap(),elementIds=new WeakMap(),remove=Element.prototype.removeAttribute,load=HTMLMediaElement.prototype.load;let id=0,elementId=0;
  globalThis.__normalMusicReleases=releases;
  HTMLMediaElement.prototype.removeAttribute=function(name){
   const audio=this instanceof HTMLAudioElement&&String(name).toLowerCase()==='src';
   const url=audio?(this.currentSrc||this.src):null,at=Date.now();
   const result=Reflect.apply(remove,this,arguments);
   if(audio&&url){if(!elementIds.has(this))elementIds.set(this,++elementId);const entry={id:++id,elementId:elementIds.get(this),url,at,nativeLoadWithoutSrc:false};releases.push(entry);pending.set(this,entry);}
   return result;
  };
  HTMLMediaElement.prototype.load=function(){
   const entry=pending.get(this),withoutSrc=!this.getAttribute('src');const result=Reflect.apply(load,this,arguments);
   if(entry&&withoutSrc){entry.nativeLoadWithoutSrc=true;entry.loadAt=Date.now();pending.delete(this);}
   return result;
  };
 });
 const requests=new Map(),failures=[],observations=[];let phase='fixture',id=0;
 const observe=()=>page.evaluate(()=>({screen:document.querySelector('#cm-root')?.dataset.activeScreen??null,titleHidden:document.querySelector('#cm-title')?.hidden===true,music:JSON.parse(document.documentElement.dataset.musicState||'null')}));
 page.on('request',r=>requests.set(r,{requestId:++id,url:r.url(),resourceType:r.resourceType(),requestObservedAt:Date.now(),responseStatus:null}));
 page.on('response',r=>{const entry=requests.get(r.request());if(entry){entry.responseStatus=r.status();entry.responseObservedAt=Date.now();}});
 page.on('requestfailed',r=>{
  const record={...requests.get(r),url:r.url(),resourceType:r.resourceType(),requestStartedAt:r.timing().startTime,error:r.failure()?.errorText??null,failedAt:Date.now(),phase};failures.push(record);
  observations.push(observe().then(v=>{record.observedAfterFailure=v;},e=>{record.observationError=String(e);}));
 });
 const snapshot=async()=>{await Promise.all(observations);return {rawFailures:structuredClone(failures),observedNativeReleases:await page.evaluate(()=>globalThis.__normalMusicReleases??[]),finalState:await observe()};};
 return {setPhase(value){phase=value;},snapshot,async assertClean(){
  const proof=await snapshot(),used=new Set(),expected=[];
  try{
   for(const f of proof.rawFailures){const release=matchExpectedMusicDisposal(f,proof.finalState,proof.observedNativeReleases.filter(r=>!used.has(r.id)),{origin:new URL(base).origin,engine});assert.ok(release&&!used.has(release.id),'Unexpected request failure or missing unique production audio-disposal proof: '+JSON.stringify(f));used.add(release.id);expected.push({requestId:f.requestId,releaseId:release.id,classification:'OBSERVED_PRODUCTION_SRC_REMOVAL_AND_LOAD'});}
   assert.ok(expected.length<=2,'At most two uniquely evidenced retired audio slots per fresh context');
  }catch(error){error.auditEvidence={...proof,expectedDisposals:expected};throw error;}
  return {...proof,expectedDisposals:expected};
 }};
}
