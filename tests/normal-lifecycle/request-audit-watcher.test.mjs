import assert from 'node:assert/strict';import vm from 'node:vm';import {EventEmitter} from 'node:events';import {watchNormalRequests} from './request-audit.mjs';
const base='http://127.0.0.1:8765/',url=base+'assets/production/original-music-r1/bgm_login_page.mp3';
function fakePage(){
 let removes=0,loads=0;
 class Element{removeAttribute(name){removes++;this.attrs.delete(name);return 'native-remove-return';}getAttribute(name){return this.attrs.get(name)??null;}}
 class Media extends Element{constructor(){super();this.attrs=new Map([['src',url]]);this.src=url;this.currentSrc=url;}load(){loads++;return 'native-load-return';}}
 class Audio extends Media{}
 const music={scene:'raising',cue:'ranch',requestedCue:'ranch',error:null};
 const context=vm.createContext({Element,HTMLMediaElement:Media,HTMLAudioElement:Audio,Date,document:{querySelector:s=>s==='#cm-root'?{dataset:{activeScreen:'RAISING_HOME'}}:{hidden:true},documentElement:{dataset:{musicState:JSON.stringify(music)}}}});
 const page=new EventEmitter();page.addInitScript=async fn=>vm.runInContext('('+fn.toString()+')()',context);page.evaluate=async fn=>vm.runInContext('('+fn.toString()+')()',context);
 return {page,Audio,counts:()=>({removes,loads})};
}
const request=()=>({url:()=>url,resourceType:()=> 'media',failure:()=>({errorText:'net::ERR_ABORTED'}),timing:()=>({startTime:Date.now()-100})});
async function exercise({count=1,wrongRequest=false,duplicate=false}={}){
 const {page,Audio,counts}=fakePage(),audit=await watchNormalRequests(page,base,'chromium');audit.setPhase('raising-loading');
 for(let i=0;i<count;i++){
  const r=request();page.emit('request',r);page.emit('response',{request:()=>wrongRequest?request():r,status:()=>200});const audio=new Audio();
  assert.equal(audio.removeAttribute('src'),'native-remove-return');assert.equal(audio.load(),'native-load-return');page.emit('requestfailed',r);if(duplicate)page.emit('requestfailed',r);
 }
 assert.deepEqual(counts(),{removes:count,loads:count});return {audit,count};
}
let {audit}=await exercise();assert.equal((await audit.assertClean()).expectedDisposals.length,1);
({audit}=await exercise({count:2}));assert.equal((await audit.assertClean()).expectedDisposals.length,2);
for(const options of [{wrongRequest:true},{duplicate:true},{count:3}]){({audit}=await exercise(options));await assert.rejects(()=>audit.assertClean(),error=>{assert.ok(error.auditEvidence.rawFailures.length>0);assert.ok(error.auditEvidence.observedNativeReleases.length>0);assert.equal(error.auditEvidence.finalState.screen,'RAISING_HOME');return true;});}
console.log('PASS watcher: native method return/this preserved, Same Request response correlation, unique release, max2, FAIL evidence retained');
