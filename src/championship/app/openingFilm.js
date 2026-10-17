import {openingFilmCopy} from '../text/openingFilmText.js';
export {openingFilmCopy} from '../text/openingFilmText.js';
// Owner-approved NS33 film; DOM-only TITLE presentation, no save/router/ticker.
import {getActiveGameTitle, getTitleHeadingHtml} from '../text/brandTerms.js';
// Release pause: keep the original player and media for an explicit restoration.
export const OPENING_FILM_ENABLED = false;
export const OPENING_FILM = Object.freeze({
  src:'assets/production/opening-film-ns33-r1/opening-720p-ef50993b.mp4',
  sha256:'ef50993b1856da8f7fb4ec62ca6d6ab50489f5e81e4b7b799469a4b154b8831d',
  bytes:19412041,
  desktopSrc:'assets/production/opening-film-ns33-r1/opening-1080p-30b17392.mp4',
  desktopSha256:'30b173920b3ad776aa9fc85949c720715f2d0b6fad6bca2a443ae30686a770ce',
  desktopBytes:73388752,
  liteSrc:'assets/production/opening-film-ns33-r1/opening-540p-6869b2cb.mp4',
  liteSha256:'6869b2cb08b3e225b634525d350a4529ea707640a157d355abc85e283670cc46',
  liteBytes:8782520,
  poster:'assets/production/opening-film-ns33-r1/poster-048c2ee9.jpg',
  posterSha256:'048c2ee9cd049398421631536e99e3b72aaa8f79c53068ecf3617371ef183b38',
  duration:58.0, logoTime:55.71, idleMs:15000, startupWaitMs:8000, waitMs:3000
});
export function selectOpeningFilmSource(nav = globalThis.navigator, win = globalThis.window) {
  const conn = nav?.connection;
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
    return OPENING_FILM.liteSrc;
  }
  const mobile = nav?.userAgentData?.mobile === true
    || (win?.matchMedia?.('(pointer: coarse)').matches && win.innerWidth < 1024);
  return win?.innerWidth && !mobile ? OPENING_FILM.desktopSrc : OPENING_FILM.src;
}
export function hasOpeningPreloadBuffer(video) {
  if (video.paused || video.seeking || video.readyState < 3) return false;
  const remaining = video.duration - video.currentTime;
  if (!Number.isFinite(remaining) || remaining <= 0) return false;
  for (let i=0;i<video.buffered.length;i++) {
    if (video.buffered.start(i) <= video.currentTime && video.buffered.end(i) - video.currentTime >= Math.min(6,remaining)) return true;
  }
  return false;
}
export function canAutoPlayOpening({titleVisible,titleReady,menuOpen,dialogOpen,hidden,reducedMotion,failed}){
  return Boolean(titleVisible&&titleReady&&!menuOpen&&!dialogOpen&&!hidden&&!reducedMotion&&!failed);
}
export function createOpeningFilm({title,controls,login,menu,opening,getPreferences,onActiveChange=()=>{},onBufferChange=()=>{},
  document:doc=globalThis.document,window:win=globalThis.window,enabled=OPENING_FILM_ENABLED}){
  if(!enabled)return Object.freeze({start(){},sync(){},isPlaying:()=>false,canPreloadTitle:()=>false,dispose(){}});
  const node=(tag,cls)=>{const n=doc.createElement(tag);n.className=cls;return n;};
  const watch=node('button','cm-title__film-watch');watch.id='cm-watch-film';watch.type='button';controls.append(watch);
  const host=node('section','cm-title__film');host.id='cm-opening-film';host.hidden=true;
  host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');
  const video=node('video','cm-title__film-video');video.preload='none';video.muted=true;video.defaultMuted=true;
  video.poster=new URL(OPENING_FILM.poster,doc.baseURI).href;
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
  let selectedSrc=null,bufferBlocked=true;
  const canPreloadTitle=()=>active&&!bufferBlocked&&hasOpeningPreloadBuffer(video);
  // Finish owns the handoff through onActiveChange (music first, art second).
  // A synchronous pause or late progress event must not start art beforehand.
  const bufferChange=()=>{if(active)onBufferChange();};
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
    active=false;bufferBlocked=true;++token;clearIdle();clearWait();clear(deadline);deadline=null;
    video.pause();video.muted=true;video.preload='none';wantsSound=false;
    host.hidden=true;host.dataset.state='idle';host.dataset.result=reason;brand.hidden=true;
    for(const [n,inert] of restoreInert)n.inert=inert;restoreInert=[];
    if(['error','timeout','rejected'].includes(reason))failed=true;
    // Cancel an unfinished request; finished media can reuse the browser cache.
    // Skip immediately aborts in-flight downloads so user entering game never waits on video.
    if(video.readyState<2||failed||reason==='skip'||reason==='leave'){video.removeAttribute('src');video.load();}
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
  function playing(){if(!active)return;clearWait();bufferBlocked=false;status.hidden=true;host.dataset.state='playing';bufferChange();}
  function waiting(){bufferBlocked=true;bufferChange();armWait();}
  function pause(){bufferBlocked=true;bufferChange();}
  function time(){if(active){const show=video.currentTime>=OPENING_FILM.logoTime;if(brand.hidden===show)brand.hidden=!show;bufferChange();}}
  function ended(){finish('ended');}
  function error(){finish('error');}
  function play(manual=false){
    if(disposed||active||!ready()||(!manual&&!autoReady()))return false;
    failed=false;clearIdle();oldFocus=doc.activeElement;
    active=true;bufferBlocked=true;autoPlaying=!manual;const request=++token;wantsSound=false;labels();
    restoreInert=[...title.children].filter(n=>n!==host).map(n=>[n,n.inert]);
    for(const [n] of restoreInert)n.inert=true;
    host.hidden=false;host.dataset.state='loading';status.hidden=false;brand.hidden=true;
    onActiveChange(true);skip.focus({preventScroll:true});
    // Pin before the first assignment; resize/replay never switches downloads.
    selectedSrc??=selectOpeningFilmSource(win?.navigator,win);
    if(!video.getAttribute('src'))video.src=new URL(selectedSrc,doc.baseURI).href;
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
  const mediaEvents={playing,timeupdate:time,progress:bufferChange,pause,ended,error,waiting,stalled:waiting};
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
  return Object.freeze({start(){sync();if(autoReady())play(false);},sync,isPlaying:()=>active,canPreloadTitle,
    dispose(){if(disposed)return;finish('leave');disposed=true;detach();watch.remove();host.remove();}});
}
