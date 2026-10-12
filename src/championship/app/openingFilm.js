import {openingFilmCopy} from '../text/openingFilmText.js';
export {openingFilmCopy} from '../text/openingFilmText.js';
// Owner-approved NS33 film; DOM-only TITLE presentation, no save/router/ticker.
import {getActiveGameTitle, getTitleHeadingHtml} from '../text/brandTerms.js';
export const OPENING_FILM = Object.freeze({
  src:'assets/production/opening-film-ns33-r1/opening-720p-74e171ba.mp4',
  sha256:'74e171baa7a3893a7e5e1274dab699339e9753733c1681ee18aff4f5dbaaf184',
  bytes:14563538, duration:48.5, logoTime:46.2, idleMs:15000, startupWaitMs:8000, waitMs:3000
});
export function canAutoPlayOpening({titleVisible,titleReady,menuOpen,dialogOpen,hidden,reducedMotion,failed}){
  return Boolean(titleVisible&&titleReady&&!menuOpen&&!dialogOpen&&!hidden&&!reducedMotion&&!failed);
}
export function createOpeningFilm({title,controls,login,menu,opening,getPreferences,onActiveChange=()=>{},
  document:doc=globalThis.document,window:win=globalThis.window}){
  const node=(tag,cls)=>{const n=doc.createElement(tag);n.className=cls;return n;};
  const watch=node('button','cm-title__film-watch');watch.id='cm-watch-film';watch.type='button';controls.append(watch);
  const host=node('section','cm-title__film');host.id='cm-opening-film';host.hidden=true;
  host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');
  const video=node('video','cm-title__film-video');video.preload='none';video.muted=true;video.defaultMuted=true;
  video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('disablepictureinpicture','');
  video.setAttribute('aria-hidden','true');video.tabIndex=-1;
  const art=node('div','cm-title__art'),brand=title.querySelector('.cm-title__logo').cloneNode(true);
  brand.hidden=true;art.append(brand);
  const bar=node('div','cm-title__film-controls'),sound=node('button',''),skip=node('button','');
  sound.id='cm-film-sound';skip.id='cm-film-skip';sound.type=skip.type='button';bar.append(sound,skip);
  const status=node('p','cm-title__film-status');status.setAttribute('role','status');
  host.append(video,art,bar,status);title.append(host);
  let active=false,attached=false,disposed=false,failed=false,token=0,wantsSound=false,autoPlaying=false,lastLocale=null;
  let idle=null,wait=null,deadline=null,guardUntil=0,oldFocus=null,restoreInert=[];
  const clear=key=>{if(key!==null)win.clearTimeout(key);};
  function clearIdle(){clear(idle);idle=null;}
  function clearWait(){clear(wait);wait=null;}
  const locale=()=>doc.documentElement.lang||'zh-Hant';
  const reduced=()=>doc.documentElement.dataset.motion==='reduced';
  const visible=()=>!title.hidden;
  const dialogOpen=()=>[...doc.querySelectorAll('dialog[open],[role="dialog"],[role="menu"]')]
    .some(n=>n!==host&&!host.contains(n)&&!n.closest('[hidden]')&&n.getClientRects().length>0);
  const ready=()=>visible()&&!login.disabled&&menu.hidden&&opening.hidden&&!dialogOpen()&&doc.visibilityState!=='hidden';
  const autoReady=()=>canAutoPlayOpening({titleVisible:visible(),titleReady:!login.disabled,
    menuOpen:!menu.hidden||!opening.hidden,dialogOpen:dialogOpen(),hidden:doc.visibilityState==='hidden',reducedMotion:reduced(),failed});
  function labels(){
    if(lastLocale===locale()){audio();return;}lastLocale=locale();
    const c=openingFilmCopy(locale());watch.textContent=c[0];skip.textContent=c[1];
    host.setAttribute('aria-label',c[0]);status.textContent=c[5];
    const heading=brand.querySelector('.cm-title__name');
    heading.innerHTML=getTitleHeadingHtml(locale());heading.lang=locale();heading.setAttribute('aria-label',getActiveGameTitle(locale()));
    audio();
  }
  function audio(){
    const p=getPreferences(),c=openingFilmCopy(locale());
    video.muted=p.muted||!wantsSound;video.volume=Math.max(0,Math.min(1,p.masterVolume*p.musicVolume/10000));
    const label=p.muted?c[4]:video.muted?c[2]:c[3];
    if(sound.textContent!==label)sound.textContent=label;sound.disabled=p.muted;
    sound.setAttribute('aria-pressed',String(!video.muted));
  }
  function resetIdle(){
    clearIdle();
    if(!active&&autoReady())idle=win.setTimeout(()=>{idle=null;if(autoReady())play(false);},OPENING_FILM.idleMs);
  }
  function finish(reason){
    if(!active)return;
    active=false;++token;clearIdle();clearWait();clear(deadline);deadline=null;
    video.pause();video.muted=true;video.preload='none';wantsSound=false;
    host.hidden=true;host.dataset.state='idle';host.dataset.result=reason;brand.hidden=true;
    for(const [n,inert] of restoreInert)n.inert=inert;restoreInert=[];
    if(['error','timeout','rejected'].includes(reason))failed=true;
    // Cancel an unfinished request; finished media can reuse the browser cache.
    if(video.readyState<2||failed||reason==='leave'){video.removeAttribute('src');video.load();}
    onActiveChange(false);
    if(reason==='skip')guardUntil=win.performance.now()+350;
    if(visible()&&doc.visibilityState!=='hidden'&&reason!=='leave'){
      (oldFocus?.isConnected&&oldFocus!==doc.body&&!oldFocus.closest('[hidden]')?oldFocus:login).focus({preventScroll:true});
    }
    resetIdle();
  }
  function armWait(){
    if(!active||wait!==null)return;
    // Cold Pages requests compete with TITLE art. Once playback starts,
    // retain the shorter stall bound; Skip is available throughout.
    const delay=host.dataset.state==='playing'?OPENING_FILM.waitMs:OPENING_FILM.startupWaitMs;
    wait=win.setTimeout(()=>finish('timeout'),delay);
  }
  function playing(){if(!active)return;clearWait();status.hidden=true;host.dataset.state='playing';}
  function time(){if(active){const show=video.currentTime>=OPENING_FILM.logoTime;if(brand.hidden===show)brand.hidden=!show;}}
  function ended(){finish('ended');}
  function error(){finish('error');}
  function play(manual=false){
    if(disposed||active||!ready()||(!manual&&!autoReady()))return false;
    failed=false;clearIdle();oldFocus=doc.activeElement;
    active=true;autoPlaying=!manual;const request=++token;wantsSound=false;labels();
    restoreInert=[...title.children].filter(n=>n!==host).map(n=>[n,n.inert]);
    for(const [n] of restoreInert)n.inert=true;
    host.hidden=false;host.dataset.state='loading';status.hidden=false;brand.hidden=true;
    onActiveChange(true);skip.focus({preventScroll:true});
    if(!video.getAttribute('src'))video.src=new URL(OPENING_FILM.src,doc.baseURI).href;
    else video.currentTime=0;
    video.preload='auto';armWait();
    deadline=win.setTimeout(()=>finish('timeout'),OPENING_FILM.duration*1000+OPENING_FILM.startupWaitMs+OPENING_FILM.waitMs);
    try{Promise.resolve(video.play()).then(()=>{
      if(request!==token){if(!active)video.pause();return;}
      if(video.readyState>=2)playing();
    }).catch(()=>{if(request===token)finish('rejected');});}catch{finish('rejected');}
    return true;
  }
  function consume(e){e.preventDefault();e.stopImmediatePropagation();}
  function input(e){
    if(win.performance.now()<guardUntil&&['pointerdown','pointerup','click','keydown','keyup'].includes(e.type)){consume(e);return;}
    if(!active){resetIdle();return;}
    if(e.type==='keydown'){
      if(e.key==='Escape'){consume(e);finish('skip');}
      else if(e.key==='Tab'){
        consume(e);const buttons=[sound,skip].filter(n=>!n.disabled);
        const at=buttons.indexOf(doc.activeElement),next=(at+(e.shiftKey?-1:1)+buttons.length)%buttons.length;
        buttons[next].focus({preventScroll:true});
      }
    }
  }
  function visibility(){if(doc.visibilityState==='hidden'){finish('hidden');clearIdle();}else resetIdle();}
  function hide(){finish('hidden');clearIdle();}
  const events=['pointerdown','pointerup','pointermove','click','keydown','keyup','wheel','focusin'];
  const mediaEvents={playing,timeupdate:time,ended,error,waiting:armWait,stalled:armWait};
  const observer=new win.MutationObserver(()=>sync());
  function attach(){
    if(attached)return;attached=true;
    for(const e of events)doc.addEventListener(e,input,true);
    doc.addEventListener('visibilitychange',visibility);win.addEventListener('pagehide',hide);win.addEventListener('pageshow',visibility);
    for(const [e,fn] of Object.entries(mediaEvents))video.addEventListener(e,fn);
    observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open']});
    observer.observe(doc.documentElement,{attributes:true,attributeFilter:['lang','data-motion']});
  }
  function detach(){
    if(!attached)return;attached=false;observer.disconnect();clearIdle();clearWait();clear(deadline);deadline=null;
    for(const e of events)doc.removeEventListener(e,input,true);
    doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('pagehide',hide);win.removeEventListener('pageshow',visibility);
    for(const [e,fn] of Object.entries(mediaEvents))video.removeEventListener(e,fn);
    video.pause();video.removeAttribute('src');video.load();
  }
  function sync(){
    if(disposed)return;
    if(!visible()){finish('leave');detach();return;}
    attach();labels();
    if(active&&(!ready()||(reduced()&&autoPlaying)))finish(reduced()&&autoPlaying?'motion':'blocked');
    const show=ready();if(watch.hidden===show)watch.hidden=!show;
    if(!active){if(!autoReady())clearIdle();else if(idle===null)resetIdle();}
  }
  watch.addEventListener('click',e=>{consume(e);play(true);});
  skip.addEventListener('click',e=>{consume(e);finish('skip');});
  sound.addEventListener('click',e=>{consume(e);if(e.isTrusted===false)return;wantsSound=!wantsSound;audio();});
  // The app owns the title-hidden observer and calls sync on title transitions.
  return Object.freeze({start(){sync();if(autoReady())play(false);},sync,isPlaying:()=>active,
    dispose(){if(disposed)return;finish('leave');disposed=true;detach();watch.remove();host.remove();}});
}
