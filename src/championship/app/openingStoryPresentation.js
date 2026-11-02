import {uiText} from '../text/uiText.js';
import {onboardingText} from '../text/onboardingText.js';
import {aiChanStoryText,fillAiChanText} from '../text/aiChanStoryText.js';
import {validateStoryChapter} from './futureSystemsPort.js';
import {createStoryCutsceneStage} from './storyCutsceneStage.js';
import {OPENING_STORY_BACKGROUND,OPENING_STORY_BEATS,openingStoryResumeIndex,openingStorySkipTarget} from './openingStoryScript.js';
import {createAiChanPortrait,AI_CHAN_APPEARANCES} from '../presentation/aiChanGuide.js';

// New Game opening story (Owner-approved Ai-chan layered v3, 2026-11-02; this
// replaces the four comic cards of 2026-10-10/10-28 after New Game only; the
// title, its logo and the NS33 title film are untouched).
//
// Four separate layers: the approved silent 16:9 background video, Ai-chan's
// transparent half-body portrait, the DOM text of the existing cutscene stage,
// and the music, which main.js routes through the shared music presentation.
// Nothing here touches the game save, gameplay RNG, router or ticker. The
// player's form choice and the reading bookmark are handed to the caller, which
// keeps them in the preference document.
//
// The reader controls the pace: each page plays its own segment of the
// background once and holds on its last frame. With reduced motion the
// background never plays; it holds a still of the page's segment. A background
// that cannot load leaves a readable dark stage and a status line.

const story=OPENING_STORY_BEATS;
const textKey=beat=>beat.kind==='narration'?`story:${beat.section}:${beat.paragraph}`:`ai:${beat.dialogue}`;

/** The prologue as a story chapter, the same schema story mode loads. Text is keyed, resolved per locale when shown. */
export function openingPrologueChapter(){
  return validateStoryChapter({schemaVersion:1,chapterId:'prologue-opening',title:'prologue',unlockCondition:{kind:'newGame'},
    beats:story.map(beat=>({id:beat.id,speaker:beat.speaker,text:textKey(beat),cameraEffect:'none',illustration:[],
      choices:beat.kind==='choice'?AI_CHAN_APPEARANCES.slice().reverse().map(form=>({id:form,label:`choice:${form}`})):[]}))});
}

/** Locale text for a chapter key (story:<section>:<n>, ai:<line>, choice:<form>). */
export function resolveOpeningStoryText(key,copy=aiChanStoryText()){
  const [kind,a,b]=String(key).split(':');
  if(kind==='story')return copy.sections[a]?.[1]?.[Number(b)]??'';
  if(kind==='ai')return a==='choose'?copy.chooseLine:copy.dialogue[a]??'';
  if(kind==='choice')return copy.choose[a]??'';
  return String(key);
}

/** Whether motion is reduced, from the resolved preference, else the OS. */
function motionReduced(doc){
  const motion=doc.documentElement?.dataset.motion;
  if(motion)return motion==='reduced';
  return Boolean(doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * host        #cm-opening
 * onComplete  after the last page (or a skip once the form is chosen)
 * onCancel    the loading screen's return key
 * guide       { appearance(): '' | 'cat' | 'catgirl', choose(form), resume(): beat id, progress(beatId) }
 */
export function createOpeningStoryPresentation({host,onComplete,onCancel=()=>{},guide={},doc=globalThis.document}){
  const copy=onboardingText(),words=aiChanStoryText();
  const el=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text)n.textContent=uiText(text);return n;};
  const raw=(tag,cls,text)=>{const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const stored=guide.appearance?.()??'';
  let chosen=AI_CHAN_APPEARANCES.includes(stored)?stored:'';
  let pickedThisRun=false;
  const resumeIndex=openingStoryResumeIndex(guide.resume?.()??'');
  const stage=createStoryCutsceneStage({host,chapter:openingPrologueChapter(),rootClass:'cm-opening-story',panels:false,startAt:resumeIndex,doc,
    labels:{chapter:`PROLOGUE · ${copy.prologue}`,skip:copy.skipPrologue,tapToContinue:copy.tapToContinue,narrator:copy.narrator,
      ariaLabel:uiText('開場故事，閱讀後點按繼續')},
    resolveText:key=>resolveOpeningStoryText(key,words),
    resolveSpeaker:speaker=>speaker==='ai'?words.name:speaker==='player'?words.player:copy.narrator,
    onBeat:(index)=>showBeat(index),
    onChoice:(id)=>{if(!AI_CHAN_APPEARANCES.includes(id))return;chosen=id;pickedThisRun=true;guide.choose?.(id);},
    skipTo:index=>openingStorySkipTarget(index,Boolean(chosen)),
    onComplete:()=>finish(),onSkip:()=>finish()});
  const root=stage.root;
  root.dataset.backdrop='loading';root.dataset.guide='hidden';
  root.setAttribute('aria-busy','true');

  // Layer 1: the background video. Muted and inline; it never carries sound.
  const backdrop=raw('div','cm-opening-story__backdrop');backdrop.setAttribute('aria-hidden','true');
  const video=raw('video','cm-opening-story__video');
  video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='auto';video.disablePictureInPicture=true;
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  video.width=OPENING_STORY_BACKGROUND.width;video.height=OPENING_STORY_BACKGROUND.height;
  video.src=OPENING_STORY_BACKGROUND.src;
  backdrop.append(video,raw('span','cm-opening-story__shade'));
  // Layer 2: Ai-chan, only inside the package's guide window.
  const guideLayer=raw('div','cm-opening-story__guide');
  const portrait=createAiChanPortrait({doc,mode:'half',appearance:'cat',name:words.name,label:form=>fillAiChanText(words.portraitLabel,{form:words.forms[form]})});
  guideLayer.append(portrait.root);
  root.querySelector('.cm-cutscene__sky')?.after(backdrop,guideLayer);
  // Reading tools beside the skip key: the previous page and play-from-start.
  const top=root.querySelector('.cm-cutscene__top'),skip=root.querySelector('.cm-cutscene__skip');
  const previous=raw('button','cm-cutscene__tool'),replay=raw('button','cm-cutscene__tool');
  previous.type=replay.type='button';previous.dataset.storyAction='previous';replay.dataset.storyAction='replay';
  previous.append(raw('span','cm-cutscene__tool-icon','‹'),raw('span','cm-cutscene__tool-label',words.previous));
  replay.append(raw('span','cm-cutscene__tool-icon','↺'),raw('span','cm-cutscene__tool-label',words.replay));
  previous.setAttribute('aria-label',words.previous);replay.setAttribute('aria-label',words.replay);
  top.insertBefore(previous,skip);top.insertBefore(replay,skip);
  // Return to the title at any page, including the form choice: the reading
  // bookmark and the chosen form stay stored, so the next New Game resumes here.
  const leave=raw('button','cm-cutscene__tool');leave.type='button';leave.dataset.storyAction='title';
  const leaveLabel=uiText('OPENING_RETURN');
  leave.append(raw('span','cm-cutscene__tool-icon','⌂'),raw('span','cm-cutscene__tool-label',leaveLabel));
  leave.setAttribute('aria-label',leaveLabel);top.insertBefore(leave,previous);
  const kicker=root.querySelector('.cm-cutscene__chapter');
  // Portrait places Ai-chan just above the text box, whatever its height.
  const dialogue=root.querySelector('.cm-cutscene__dialogue');
  const view=doc.defaultView;
  const measure=new (view?.ResizeObserver??class{observe(){}disconnect(){}})(()=>root.style.setProperty('--story-dialogue-h',`${Math.round(dialogue.offsetHeight)}px`));
  measure.observe(dialogue);
  const status=raw('p','cm-opening-story__status');status.setAttribute('role','status');status.hidden=true;
  root.append(status);

  // The loading screen keeps its existing hooks: read text first, or return.
  const loading=el('div','cm-opening-story__loading');
  const loadingText=el('p','','OPENING_COMIC_LOADING');loadingText.setAttribute('role','status');
  const readText=el('button','','OPENING_TEXT_FIRST'),back=el('button','','OPENING_RETURN');
  readText.type=back.type='button';readText.dataset.storyAction='text';back.dataset.storyAction='return';
  loading.append(loadingText,readText,back);root.append(loading);

  let disposed=false,started=false,segment=null,frameHandle=null,frameKind=null,current=-1;
  const notices=new Set();
  function renderStatus(){
    const lines=[...notices];status.textContent=lines.join(' ');status.hidden=lines.length===0;
  }
  function notice(text,on=true){if(on)notices.add(text);else notices.delete(text);renderStatus();}
  // --- background segments -------------------------------------------------------
  function stopWatch(){
    if(frameHandle===null)return;
    if(frameKind==='video')video.cancelVideoFrameCallback?.(frameHandle);else doc.defaultView?.cancelAnimationFrame?.(frameHandle);
    frameHandle=null;frameKind=null;
  }
  function watch(){
    stopWatch();if(disposed||!segment||video.paused)return;
    const check=(now,meta)=>{
      frameHandle=null;if(disposed||!segment)return;
      const at=meta?.mediaTime??video.currentTime;
      // Hold a frame and a half before the boundary, so the next scene never flashes.
      if(at>=segment[1]-0.06){video.pause();root.dataset.backdropHold='true';return;}
      watch();
    };
    if(typeof video.requestVideoFrameCallback==='function'){frameKind='video';frameHandle=video.requestVideoFrameCallback(check);}
    else{frameKind='frame';frameHandle=doc.defaultView?.requestAnimationFrame?.(()=>check())??null;}
  }
  function seek(seconds){try{video.currentTime=seconds;}catch{/* metadata not ready; applied on loadedmetadata */}}
  function playSegment(range){
    segment=range;root.dataset.backdropHold='false';
    if(root.dataset.backdrop==='failed')return;
    const [start,end]=range,at=video.currentTime;
    if(motionReduced(doc)){
      // A still of the page's own scene; the background never plays.
      stopWatch();video.pause();seek(Math.min(start+1,(start+end)/2));root.dataset.backdropHold='true';return;
    }
    // Continue straight on from the previous page; otherwise jump to this page's start.
    if(!(at>=start-0.25&&at<end-0.1))seek(start);
    if(doc.hidden)return;
    const playing=video.play();
    if(playing?.then)playing.then(watch,()=>{root.dataset.backdropHold='true';});else watch();
  }
  video.addEventListener('loadedmetadata',()=>{if(segment&&video.currentTime<segment[0]-0.25)seek(motionReduced(doc)?Math.min(segment[0]+1,(segment[0]+segment[1])/2):segment[0]);});
  video.addEventListener('loadeddata',()=>{if(disposed)return;if(root.dataset.backdrop!=='failed')root.dataset.backdrop='ready';notice(words.backdropFailed,false);beginPlayback();});
  video.addEventListener('play',watch);
  video.addEventListener('error',()=>{
    if(disposed)return;stopWatch();root.dataset.backdrop='failed';notice(words.backdropFailed);beginPlayback();
  });
  function visibility(){
    if(disposed)return;
    if(doc.hidden){stopWatch();video.pause();}
    else if(started&&segment&&root.dataset.backdropHold!=='true')playSegment(segment);
  }
  doc.addEventListener('visibilitychange',visibility);
  // --- pages ------------------------------------------------------------------------
  function guideForm(beat){
    if(beat.guide==='chosen')return chosen||'cat';
    return beat.guide;
  }
  function showBeat(index){
    if(disposed)return;
    const beat=story[index];if(!beat)return;
    const leftGuide=current>=0&&story[current]?.guide&&!beat.guide;current=index;
    root.dataset.beatId=beat.id;root.dataset.beatKind=beat.kind;
    const title=beat.section==='guide'?words.guideSection:words.sections[beat.section]?.[0];
    kicker.textContent=`PROLOGUE · ${title??copy.prologue}`;
    previous.disabled=index===0;
    const form=guideForm(beat);
    root.dataset.guide=form?'visible':leftGuide?'leaving':'hidden';
    if(form){portrait.setAppearance(form);guideLayer.dataset.form=form;}
    guide.progress?.(beat.id);
    if(started)playSegment(beat.video);else segment=beat.video;
  }
  previous.addEventListener('click',event=>{event.stopPropagation();if(current>0)stage.goTo(current-1);});
  replay.addEventListener('click',event=>{event.stopPropagation();notice(words.resumed,false);seek(0);stage.goTo(0);});

  function beginPlayback(){
    if(disposed||started)return;started=true;loading.remove();
    root.setAttribute('aria-busy','false');stage.start();
    if(resumeIndex>0)notice(words.resumed);
    if(segment)playSegment(segment);
  }
  function dispose(){
    if(disposed)return;disposed=true;stopWatch();
    doc.removeEventListener('visibilitychange',visibility);measure.disconnect();
    video.pause();video.removeAttribute('src');video.load?.();
    stage.dispose();
  }
  function finish(){if(disposed)return;clearTimeout(timer);dispose();onComplete({chosen,pickedThisRun});}
  readText.addEventListener('click',beginPlayback);
  function leaveToTitle(){if(disposed)return;clearTimeout(timer);dispose();onCancel();}
  back.addEventListener('click',leaveToTitle);
  leave.addEventListener('click',event=>{event.stopPropagation();leaveToTitle();});
  // The text never waits long for the picture: eight seconds, then read anyway.
  const timer=setTimeout(beginPlayback,8000);
  video.load?.();
  return {dispose(){clearTimeout(timer);dispose();},root,video,stage};
}
