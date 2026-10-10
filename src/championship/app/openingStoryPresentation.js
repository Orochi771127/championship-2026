import {createOpeningStoryState,advanceOpeningStory,openingStoryTrajectory} from './nativeOpeningStory.js';
import {uiText} from '../text/uiText.js';
import {openingStoryText} from '../text/openingStoryText.js';

// The four observed story cards retain their timing and DOM text.
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

export function createOpeningStoryPresentation({host,onComplete}){
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=uiText(text);return n;};
  const root=el('section','cm-opening-story');root.tabIndex=0;root.setAttribute('role','button');
  root.setAttribute('aria-label',uiText('開場故事，閱讀後點按繼續'));
  const cards=[],parts=[];
  const readiness=new AbortController();
  root.setAttribute("aria-busy","true");root.dataset.comicReady="loading";
  function addComic(picture,index){
    const art=COMIC[index],img=document.createElement('img');
    img.src=art.src;img.width=art.width;img.height=art.height;img.alt='';img.draggable=false;
    img.decoding='async';img.loading='eager';img.dataset.comicSlot=art.slot;
    picture.setAttribute('aria-hidden','true');picture.append(img);return picture;
  }
  for(let i=0;i<4;i++){
    const card=el('article',`cm-opening-story__card cm-opening-story__card--${i}`),row=[el('p','cm-opening-story__text',TEXT[i])];
    row[0].textContent=openingStoryText(TEXT[i]);
    if(i===0)for(let n=0;n<3;n++){
      const picture=el('div',`cm-opening-story__picture cm-opening-story__arena cm-opening-story__arena--${n}`);
      row.push(addComic(picture,n));
    }
    if(i===1||i===2){const picture=el('div',`cm-opening-story__picture cm-opening-story__${i===1?'world':'champion'}`);row.push(addComic(picture,i+2));}
    card.append(...row);root.append(card);cards.push(card);parts.push(row);
  }
  const loading=el('p','cm-opening-story__loading',uiText('OPENING_COMIC_LOADING'));
  loading.setAttribute('role','status');root.append(loading);
  host.replaceChildren(root);host.hidden=false;
  let animations=[],clock=null,frames=[],generation=0,disposed=false,finishing=false;
  // Keep both edges of a constant span so a long reading hold cannot interpolate
  // toward a later movement. Interior duplicate frames need no animation keys.
  function keys(values){
    const result=[];
    for(let i=0;i<values.length;i++)if(i===0||i===values.length-1||values[i]!==values[i-1]||values[i]!==values[i+1])result.push({offset:i/(values.length-1||1),value:values[i]});
    return result;
  }
  function cancel(){for(const a of animations)a.cancel();animations=[];clock=null;}
  function animate(node,property,values,duration){
    const animation=node.animate(keys(values).map(k=>({offset:k.offset,[property]:k.value})),{duration,fill:'both',easing:'linear'});
    // Cancellation is normal when tapping or returning to LOGIN.
    animation.finished.catch(()=>{});animations.push(animation);return animation;
  }
  function visibility(){for(const a of animations)document.hidden?a.pause():a.play();}
  async function finish(token){
    if(disposed||finishing||token!==generation)return;finishing=true;
    for(const a of animations)a.commitStyles();cancel();
    const fade=animate(root,'opacity',['1','0'],16*FRAME_MS);visibility();
    await fade.finished.catch(()=>{});
    if(disposed||token!==generation)return;
    dispose();onComplete();
  }
  function play(initial){
    const token=++generation;cancel();frames=openingStoryTrajectory(initial);
    if(initial.done){void finish(token);return;}
    const duration=(frames.length-1)*FRAME_MS;
    clock=animate(root,'opacity',['1','1'],duration);
    for(let i=0;i<4;i++){
      // Each original 49-frame scroll moves the current lower panel to the upper
      // half. The paired DS panels are composed into this one portrait surface.
      animate(cards[i],'transform',frames.map(f=>`translateY(${i*100-f.scrollPixels/196*100}%)`),duration);
      animate(cards[i],'opacity',frames.map(f=>f.cards[i].phase===0?'0':'1'),duration);
      for(let n=0;n<parts[i].length;n++){
        animate(parts[i][n],'opacity',frames.map(f=>{const c=f.cards[i];return c.phase>0&&(c.revealed>=n||c.phase>=2)?'1':'0';}),duration);
        animate(parts[i][n],'transform',frames.map(f=>{const c=f.cards[i];return `scaleX(${c.phase===1&&c.revealed===n?c.scale/4096:1})`;}),duration);
      }
    }
    // Creating the part animations takes measurable time on a phone. Start all
    // of them at one DOM timeline instant after preparation has finished.
    const startTime=document.timeline.currentTime;
    for(const a of animations)a.startTime=startTime;
    void clock.finished.then(()=>finish(token)).catch(()=>{});visibility();
  }
  function advance(){
    if(disposed||finishing||!clock)return;
    const frame=Math.min(frames.length-1,Math.floor(Number(clock.currentTime??0)/FRAME_MS)),state=structuredClone(frames[frame]);
    if(!state.cards.some(c=>c.phase===2))return;
    advanceOpeningStory(state,true);play(state);
  }
  function dispose(){if(disposed)return;disposed=true;readiness.abort();generation++;cancel();document.removeEventListener('visibilitychange',visibility);root.remove();}
  root.addEventListener('click',advance);
  root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();advance();}});
  document.addEventListener('visibilitychange',visibility);root.focus({preventScroll:true});
  void waitForOpeningComicImages([...root.querySelectorAll('img')],{signal:readiness.signal}).then(ready=>{
    if(disposed)return;loading.remove();root.setAttribute('aria-busy','false');root.dataset.comicReady=ready?'ready':'partial';
    // A failed request must not permanently block New Game; surviving text and
    // images retain the same story path, while the status is inspectable.
    play(createOpeningStoryState());
  });
  return {dispose};
}
