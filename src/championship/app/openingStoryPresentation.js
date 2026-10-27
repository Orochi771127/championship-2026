import {OPENING_STORY_CARDS} from './nativeOpeningStory.js';
import {uiText} from '../text/uiText.js';
import {openingStoryText} from '../text/openingStoryText.js';
import {onboardingText} from '../text/onboardingText.js';
import {validateStoryChapter} from './futureSystemsPort.js';
import {createStoryCutsceneStage} from './storyCutsceneStage.js';

// The four observed story cards keep their text and order. Owner 2026-10-28
// replaced the scrolling card strip with the cinematic stage: each card is one
// beat, and its original reading hold (OPENING_STORY_CARDS frames at 60 Hz)
// becomes the beat's auto-advance, so an untouched prologue still paces itself.
// R2 original comic art is narrative illustration, not a player identity or hatch mapping.
const TEXT=[
  '每四年舉辦一次的\n數碼獸冠軍賽。',
  '取得參賽資格，\n正是身為真正數碼獸馴獸師的證明。',
  '而今天，你也迎來了\n參加數碼獸冠軍賽的機會。\n\n奪下勝利吧！\n數碼獸冠軍賽！',
  '好像已經收到郵件了。'
];
const COMIC=[
  {
    "slot": "01_arena",
    "src": "assets/production/opening/original-comic-r2-20261010/01_arena.webp",
    "width": 640,
    "height": 640
  },
  {
    "slot": "02_blaze_action",
    "src": "assets/production/opening/original-comic-r2-20261010/02_blaze_action.webp",
    "width": 560,
    "height": 640
  },
  {
    "slot": "03_cloud_action",
    "src": "assets/production/opening/original-comic-r2-20261010/03_cloud_action.webp",
    "width": 640,
    "height": 480
  },
  {
    "slot": "04_partnership",
    "src": "assets/production/opening/original-comic-r2-20261010/04_partnership.webp",
    "width": 549,
    "height": 768
  },
  {
    "slot": "05_invitation",
    "src": "assets/production/opening/original-comic-r2-20261010/05_invitation.webp",
    "width": 768,
    "height": 768
  }
];
const FRAME_MS=1000/60;
// Card → panels: the arena stand-off with both partners' close-ups, the tamer
// and partners, the invitation, then the mail signal (text only).
const CARD_ART=[[0,1,2],[3],[4],[]];

/** The prologue as a story chapter, the same schema story mode loads. */
export function openingPrologueChapter(){
  return validateStoryChapter({schemaVersion:1,chapterId:'prologue-opening',title:'prologue',unlockCondition:{kind:'newGame'},
    beats:TEXT.map((text,i)=>({id:`card-${i}`,speaker:null,text,cameraEffect:CARD_ART[i].length>1?'pushIn':'kenBurns',
      illustration:CARD_ART[i].map(n=>COMIC[n]),autoAdvanceMs:Math.round(OPENING_STORY_CARDS[i].frames*FRAME_MS)}))});
}

// Delay presentation startup until eager image decoding settles. The original
// card/frame trajectory remains unchanged, including every click/hold interval.
export async function waitForOpeningComicImages(images,{timeoutMs=60000,signal}={}){
  if(signal?.aborted)return false;
  let timer,abort;
  const ready=Promise.all(images.map(img=>img.complete?Promise.resolve(img.naturalWidth>0)
    :Promise.resolve().then(()=>img.decode()).then(()=>img.naturalWidth>0,()=>false))).then(states=>states.every(Boolean));
  const stopped=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeoutMs);abort=()=>resolve(false);signal?.addEventListener('abort',abort,{once:true});});
  try{return await Promise.race([ready,stopped]);}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

export function createOpeningStoryPresentation({host,onComplete,onCancel=()=>{}}){
  const copy=onboardingText(),el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=uiText(text);return n;};
  const stage=createStoryCutsceneStage({host,chapter:openingPrologueChapter(),rootClass:'cm-opening-story',
    labels:{chapter:`PROLOGUE · ${copy.prologue}`,skip:copy.skipPrologue,tapToContinue:copy.tapToContinue,narrator:copy.narrator,
      ariaLabel:uiText('開場故事，閱讀後點按繼續')},
    resolveText:openingStoryText,onComplete:()=>finish(),onSkip:()=>finish()});
  const root=stage.root,readiness=new AbortController();
  root.setAttribute('aria-busy','true');root.dataset.comicReady='loading';
  // Every panel starts downloading now; only the first beat holds the start.
  const images=COMIC.map(art=>{const img=new Image(art.width,art.height);img.decoding='async';img.src=art.src;return img;});
  const loading=el('div','cm-opening-story__loading');
  const loadingText=el('p','','OPENING_COMIC_LOADING');loadingText.setAttribute('role','status');
  const readText=el('button','','OPENING_TEXT_FIRST'),back=el('button','','OPENING_RETURN');
  readText.type=back.type='button';readText.dataset.storyAction='text';back.dataset.storyAction='return';
  loading.append(loadingText,readText,back);root.append(loading);
  const artNotice=el('p','cm-opening-story__art-status','OPENING_ART_PENDING');
  artNotice.hidden=true;artNotice.setAttribute('role','status');root.append(artNotice);
  let disposed=false,started=false;
  function updateArtNotice(){
    if(disposed||!started)return;
    const complete=images.every(img=>img.complete&&img.naturalWidth>0);
    artNotice.hidden=complete;root.dataset.comicReady=complete?'ready':'partial';
  }
  for(const img of images){img.addEventListener('load',updateArtNotice);img.addEventListener('error',updateArtNotice);}
  function beginPlayback(){
    if(disposed||started)return;started=true;readiness.abort();loading.remove();
    root.setAttribute('aria-busy','false');updateArtNotice();stage.start();
  }
  function dispose(){
    if(disposed)return;disposed=true;readiness.abort();
    for(const img of images){img.removeEventListener('load',updateArtNotice);img.removeEventListener('error',updateArtNotice);if(!img.complete)img.removeAttribute('src');}
    stage.dispose();
  }
  function finish(){if(disposed)return;dispose();onComplete();}
  readText.addEventListener('click',beginPlayback);
  back.addEventListener('click',()=>{if(disposed)return;dispose();onCancel();});
  void waitForOpeningComicImages(CARD_ART[0].map(n=>images[n]),{timeoutMs:8000,signal:readiness.signal}).then(beginPlayback);
  return {dispose};
}
