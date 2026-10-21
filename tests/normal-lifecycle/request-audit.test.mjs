import assert from 'node:assert/strict';import {matchExpectedMusicDisposal} from './request-audit.mjs';
const origin='http://127.0.0.1:8765',state={screen:'RAISING_HOME',titleHidden:true,music:{scene:'raising',cue:'ranch',requestedCue:'ranch',error:null}},context={origin,engine:'chromium'};
const good={url:origin+'/assets/production/original-music-r1/bgm_login_page.mp3',resourceType:'media',error:'net::ERR_ABORTED',responseStatus:200,phase:'leaving-login',observedAfterFailure:state,requestStartedAt:1000,failedAt:2100};
const release={id:1,url:good.url,at:2000,loadAt:2001,nativeLoadWithoutSrc:true};let checks=0;
const yes=(f,s,r,c)=>{assert.equal(matchExpectedMusicDisposal(f,s,r,c)?.id,1);checks++;},no=(f,s,r,c)=>{assert.equal(matchExpectedMusicDisposal(f,s,r,c),null);checks++;};
yes(good,state,[release],context);yes({...good,error:'Load request cancelled'},state,[release],{...context,engine:'webkit'});
for(const patch of [{url:origin+'/assets/body.webp'},{url:'https://example.com/assets/production/original-music-r1/bgm_login_page.mp3'},{resourceType:'image'},{error:'net::ERR_FAILED'},{error:'Load request cancelled'},{responseStatus:404},{responseStatus:null},{phase:'capture'},{observedAfterFailure:null},{observedAfterFailure:{...state,music:{...state.music,cue:'login'}}}])no({...good,...patch},state,[release],context);
for(const patch of [{screen:'TITLE'},{titleHidden:false},{music:{...state.music,error:'LOAD_FAILED'}},{music:{...state.music,scene:null}},{music:{...state.music,requestedCue:'login'}}])no(good,{...state,...patch},[release],context);
for(const patch of [{nativeLoadWithoutSrc:false},{at:999},{loadAt:900},{loadAt:2800},{at:-5000,loadAt:-4999},{url:origin+'/other.mp3'}])no(good,state,[{...release,...patch}],context);
no(good,state,[],context);yes({...good,url:origin+'/assets/production/scene-music-r1/raising/a_quiet_evening_training.mp3'},state,[{...release,url:origin+'/assets/production/scene-music-r1/raising/a_quiet_evening_training.mp3'}],context);
for(const cue of ['', '   ']){no(good,{...state,music:{...state.music,cue}},[release],context);no(good,{...state,music:{...state.music,requestedCue:cue}},[release],context);}
for(const url of [good.url+'?x=1',good.url+'#x'])no({...good,url},state,[{...release,url}],context);
no(good,state,[release],{...context,engine:'unknown'});no(good,state,[{...release,at:2200,loadAt:2201}],context);
console.log('PASS '+checks+' strict native-media-disposal classification assertions');
