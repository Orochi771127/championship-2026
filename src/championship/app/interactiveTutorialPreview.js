import {isApprovedOriginalPublicLocation} from '../presentation/originalRuntimeLocation.js';
// Local tutorial UI: normal onboarding and explicit review share the same controller.
// Reads the app checkpoint and uses the existing modal/focus owner.
//
// Owner 2026-10-28 tactical guide: the strip and the tutorial dialogs carry an
// AI guide badge, the lesson ("STEP 2 / 10 · 餵食") and arcade keys, and a
// spotlight frames the control a lesson needs. The first prompt waits until
// Raising Home and its toolbar have mounted and laid out; a spotlight target
// that is not there yet is retried for a bounded number of frames and then
// dropped, so a missing anchor can never hide the guide.
import {showChoiceDialog} from "./uiDialog.js";
import {INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE,sameInteractiveTutorialCheckpoint} from "./interactiveTutorialCheckpoint.js";
import {tutorialLine} from "../text/tutorialMessages.zhHant.js";
import {tutorialPreviewText} from "../text/interactiveTutorialPreviewText.js";
import {onboardingText} from "../text/onboardingText.js";
import {getLocale,onLocaleChange} from "../text/locale.js";
import {getActiveGameTitle} from "../text/brandTerms.js";

export function isInteractiveTutorialPreviewLocation(location) {
  return ["localhost","127.0.0.1","[::1]"].includes(location.hostname)
    &&new URLSearchParams(location.search).get("tutorialPreview")==="raising";
}

export function shouldOfferInteractiveTutorial(location){
  const local=["localhost","127.0.0.1","[::1]"].includes(location.hostname);
  return (local||isApprovedOriginalPublicLocation(location))&&(INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE||isInteractiveTutorialPreviewLocation(location));
}

// Lessons in play order, by checkpoint stage prefix. Presentation grouping only.
export const TUTORIAL_GUIDE_LESSONS=Object.freeze([
  ["raising-intro","raising-hatch"],["raising-hunger","raising-feed"],["raising-clean"],["raising-illness"],
  ["raising-camera","raising-carry","raising-training"],["raising-recovery"],["raising-injury"],["raising-sleep","raising-gate"],
  ["gate-","hunt-","raising-after-hunt"],["raising-battle-ready","battle-","raising-after-battle"]
].map(Object.freeze));
/** { index, total } of the lesson a stage belongs to, or null outside the lessons. */
export function tutorialGuideLesson(stage){
  const index=TUTORIAL_GUIDE_LESSONS.findIndex(prefixes=>prefixes.some(prefix=>stage===prefix||stage?.startsWith(prefix)));
  return index<0?null:Object.freeze({index,total:TUTORIAL_GUIDE_LESSONS.length});
}

const SPOTLIGHT_RETRY_FRAMES=45,LAYOUT_WAIT_FRAMES=120;

export function mountInteractiveTutorialPreview({app,doc=globalThis.document,showDialog=showChoiceDialog,preview=true}={}) {
  const win=doc.defaultView??globalThis;
  const frame=callback=>typeof win.requestAnimationFrame==="function"?win.requestAnimationFrame(callback):win.setTimeout(callback,16);
  const cancelFrame=id=>typeof win.cancelAnimationFrame==="function"?win.cancelAnimationFrame(id):win.clearTimeout(id);
  const banner=doc.createElement("aside"),label=doc.createElement("span"),exit=doc.createElement("button"),resume=doc.createElement("button");
  const badge=doc.createElement("span"),meta=doc.createElement("span"),step=doc.createElement("span"),lesson=doc.createElement("span"),line=doc.createElement("span");
  banner.className=preview?"cm-tutorial-preview":"cm-tutorial-guidance";banner.dataset.preview=String(preview);
  banner.setAttribute("aria-live","polite");
  // Preview chrome only; no modification to toolbar text/clamp/touch styles.
  if(preview)banner.style.cssText="position:fixed;top:8px;left:8px;right:8px;z-index:150;display:flex;align-items:center;gap:8px;padding:8px 12px;background:#10242a;color:#e9fff8;border:1px solid #65dbc4;border-radius:10px;font-size:13px;line-height:1.4";
  badge.className="cm-guide-badge";badge.setAttribute("aria-hidden","true");badge.append(Object.assign(doc.createElement("span"),{textContent:"AI"}));
  label.className="cm-guide-copy";meta.className="cm-guide-meta";step.className="cm-guide-step";lesson.className="cm-guide-lesson-name";line.className="cm-guide-line";
  meta.append(step,lesson);label.append(meta,line);
  label.style.cssText="flex:1;min-width:0;overflow-wrap:anywhere";
  exit.type="button";exit.dataset.tutorialAction="exit";
  resume.type="button";resume.dataset.tutorialAction="resume";
  if(preview){exit.style.cssText="min-height:44px;max-width:42%;padding:8px;border-radius:8px;border:1px solid #65dbc4;background:#163b3a;color:inherit;font:inherit;white-space:normal";resume.style.cssText=exit.style.cssText;}
  banner.append(badge,label,resume,exit);doc.body.append(banner);
  // The spotlight frames a control; it never takes input itself.
  const spotlight=doc.createElement("div"),spotFrame=doc.createElement("span"),spotArrow=doc.createElement("span");
  spotlight.className="cm-guide-spotlight";spotlight.hidden=true;spotlight.setAttribute("aria-hidden","true");
  spotFrame.className="cm-guide-spotlight__frame";spotArrow.className="cm-guide-spotlight__arrow";
  spotlight.append(spotFrame,spotArrow);doc.body.append(spotlight);
  let disposed=false,busy=false,lastShown=null,dialogAbort=null,layoutReady=false,layoutFrame=null,spotFrameId=null,spotTries=0,spotStep=null;
  const key=t=>t.checkpoint.stage+":"+t.checkpoint.message+":"+t.pendingSave;
  const current=()=>app.getSession()?app.getInteractiveTutorial():null;
  const same=t=>{const now=current();return now&&!now.finished&&sameInteractiveTutorialCheckpoint(now.checkpoint,t.checkpoint);};
  const visible=node=>{if(!node?.isConnected)return null;const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&!node.closest("[hidden]")?r:null;};
  function stepLabel(t){
    const found=tutorialGuideLesson(t.checkpoint.stage),copy=onboardingText();
    return found?{step:`STEP ${found.index+1} / ${found.total}`,name:copy.lessons[found.index],index:found.index,total:found.total}:{step:"BRIEFING",name:copy.guideName,index:-1,total:TUTORIAL_GUIDE_LESSONS.length};
  }
  // Raising Home and the toolbar must be mounted and laid out before the
  // first prompt; after the bounded wait the guide shows regardless. Raising
  // Home waits for its field and toolbar; the tutorial's hunt and battle only
  // for their mounted screen root. Already settled means no wait at all, so
  // the invitation still opens in the task that settles the field.
  function layoutSettled(){
    const screen=doc.getElementById("cm-root")?.dataset.activeScreen,host=doc.querySelector(".int-rh2-field-host"),toolbar=doc.querySelector(".cm-toolbar");
    return screen==="RAISING_HOME"?["ready","error"].includes(host?.dataset.loadState)&&Boolean(visible(toolbar)):Boolean(screen);
  }
  function awaitLayout(){
    if(layoutReady)return true;
    if(layoutSettled()){layoutReady=true;return true;}
    if(layoutFrame!==null)return false;
    let frames=0;
    const check=()=>{
      layoutFrame=null;if(disposed)return;
      if(layoutSettled()||++frames>=LAYOUT_WAIT_FRAMES){layoutReady=true;render();return;}
      layoutFrame=frame(check);
    };
    layoutFrame=frame(check);
    return false;
  }
  function spotlightTarget(t){
    if(!t||t.finished||t.dialogue||t.pendingSave||t.boundary||t.restoring||t.checkpoint.stage==="invitation")return null;
    const toolbar=doc.querySelector(".cm-toolbar");
    if(t.action==="select")return {node:toolbar?.querySelector(`[data-tool-id="${t.tool}"]`)};
    if(t.action==="menu"){
      const entry=doc.querySelector(`.cm-toolbar__menu:not([hidden]) [data-entry-id="${t.menuEntry??"hunt"}"]`);
      return {node:visible(entry)?entry:toolbar?.querySelector('[data-menu-id="SYSTEM"]')};
    }
    if(t.checkpoint.stage==="raising-hatch"||["illness","injury","carry"].includes(t.action))return {resident:true};
    return null;
  }
  // Renders follow every Raising publish; restyle only when the frame moves.
  let placedKey=null;
  function placeSpotlight(rect,shape){
    const box=[rect.left,rect.top,rect.width,rect.height].map(Math.round),next=shape+":"+box.join(",");
    if(next!==placedKey){
      placedKey=next;
      spotlight.dataset.shape=shape;spotlight.dataset.arrow=box[1]<96?"below":"above";
      ["--spot-x","--spot-y","--spot-w","--spot-h"].forEach((name,i)=>spotlight.style.setProperty(name,`${box[i]}px`));
    }
    spotlight.hidden=false;
  }
  function residentRect(){
    const host=doc.querySelector(".int-rh2-field-host"),hostRect=visible(host);
    let positions=null;try{positions=JSON.parse(host?.dataset.residentScreenPositions??"null");}catch{positions=null;}
    const actor=Array.isArray(positions)?positions[0]:null;
    if(!hostRect||!Number.isFinite(actor?.x)||!Number.isFinite(actor?.y))return null;
    const top=Number.isFinite(actor.bodyTop)?actor.bodyTop:actor.y-24,bottom=Number.isFinite(actor.footY)?actor.footY:actor.y+24;
    const size=Math.max(64,(bottom-top)*1.8),cx=hostRect.left+actor.x,cy=hostRect.top+(top+bottom)/2;
    if(cx<hostRect.left||cx>hostRect.right||cy<hostRect.top||cy>hostRect.bottom)return null;
    return {left:cx-size/2,top:cy-size/2,width:size,height:size};
  }
  function syncSpotlight(){
    if(disposed)return;
    if(spotFrameId!==null){cancelFrame(spotFrameId);spotFrameId=null;}
    const t=current(),target=layoutReady&&!preview?spotlightTarget(t):null;
    // Each lesson step gets its own bounded retry budget.
    const stepKey=t?t.checkpoint.stage+":"+t.checkpoint.message:null;
    if(stepKey!==spotStep){spotStep=stepKey;spotTries=0;}
    if(!target){spotlight.hidden=true;spotTries=0;delete banner.dataset.spotlight;return;}
    const rect=target.resident?residentRect():visible(target.node);
    if(rect){spotTries=0;banner.dataset.spotlight="target";placeSpotlight(rect,target.resident?"point":"control");return;}
    spotlight.hidden=true;
    // Not laid out yet: retry next frame, a bounded number of times.
    if(++spotTries<=SPOTLIGHT_RETRY_FRAMES){spotFrameId=frame(()=>{spotFrameId=null;syncSpotlight();});return;}
    banner.dataset.spotlight="fallback";
  }
  function render(){
    if(disposed)return;
    const t=current(),copy=tutorialPreviewText(preview),words=onboardingText();
    banner.hidden=!t||t.finished;
    banner.style.display=banner.hidden?"none":"flex";
    if(banner.hidden){syncLayout();syncSpotlight();dialogAbort?.abort();return;}
    banner.dataset.stage=t.checkpoint.stage;
    const steps=stepLabel(t);banner.dataset.lesson=String(steps.index);
    banner.setAttribute("aria-label",getActiveGameTitle(getLocale())+" — "+copy.title);
    step.textContent=steps.step;lesson.textContent=`${words.guideName} · ${steps.name}`;
    line.textContent=t.pendingSave?copy.failed:t.waiting?copy.waiting:t.textId?tutorialLine(t.textId):copy.next;
    exit.textContent=copy.exit;exit.disabled=busy||t.restoring||t.pendingSave;
    resume.textContent=t.pendingSave?copy.retry:copy.next;resume.hidden=!t.pendingSave&&!t.dialogue&&!t.boundary&&t.checkpoint.stage!=="invitation";resume.disabled=busy||t.restoring;
    if(!awaitLayout()){syncLayout();syncSpotlight();return;}
    syncLayout();syncSpotlight();
    if(busy||t.restoring||key(t)===lastShown||!t.pendingSave&&!t.dialogue&&!t.boundary&&t.checkpoint.stage!=="invitation")return;
    void prompt(t);
  }
  function guideHead(t){
    const words=onboardingText(),steps=stepLabel(t),head=doc.createElement("div"),who=doc.createElement("div");
    const icon=badge.cloneNode(true),name=doc.createElement("p"),lessonLine=doc.createElement("p"),chip=doc.createElement("span"),progress=doc.createElement("span");
    head.className="cm-guide-head";head.style.order="-1";who.className="cm-guide-who";
    name.className="cm-guide-name";name.textContent=words.guideName;
    lessonLine.className="cm-guide-lesson";chip.className="cm-guide-step";chip.textContent=steps.step;
    lessonLine.append(chip,doc.createTextNode(steps.index>=0?steps.name:""));
    progress.className="cm-guide-progress";progress.setAttribute("aria-hidden","true");
    for(let i=0;i<steps.total;i++){const pip=doc.createElement("i");pip.dataset.state=i<steps.index?"done":i===steps.index?"current":"next";progress.append(pip);}
    who.append(name,lessonLine);head.append(icon,who,progress);
    return head;
  }
  async function prompt(t){
    busy=true;exit.disabled=true;const copy=tutorialPreviewText(preview),words=onboardingText(),expected=t.checkpoint;
    const stage=expected.stage,controller=new AbortController();dialogAbort=controller;
    let message="",actions=[];
    if(t.pendingSave){message=copy.failed;actions=[{id:"keep",label:copy.keep},{id:"retry",label:copy.retry,tone:"primary"}];}
    else if(stage==="invitation"){message=copy.invite;actions=[{id:"decline",label:copy.decline},{id:"accept",label:copy.accept,tone:"primary"}];}
    else if(t.dialogue){message=tutorialLine(t.textId);actions=[{id:"exit",label:preview?copy.exit:words.guideSkip},{id:"next",label:preview?copy.next:`${words.guideNext} ➔`,tone:"primary"}];}
    else if(t.boundary){message=copy.boundary;actions=[{id:"exit",label:copy.exit},{id:"keep",label:copy.keep,tone:"primary"}];}
    try{
      // The panel lays out as a column; the guide head is ordered above the message.
      const content=preview?null:guideHead(t);
      const action=await showDialog({title:copy.title,message,actions,cancelId:"keep",focusId:actions[0].id,signal:controller.signal,doc,
        ...(preview?{}:{variant:"tutorial-guide",content})});
      if(disposed||controller.signal.aborted||!same(t))return;
      if(action==="accept"||action==="decline")await app.chooseInteractiveTutorial(action==="accept",expected);
      else if(action==="next")await app.acknowledgeInteractiveTutorial(expected);
      else if(action==="exit")await app.exitInteractiveTutorial(expected);
      else if(action==="retry")app.persistenceFacade().retry();
      else lastShown=key(t);
    }catch(error){lastShown=key(t);console.warn("TUTORIAL_PREVIEW: "+error.message);}
    finally{if(dialogAbort===controller)dialogAbort=null;busy=false;queueMicrotask(render);}
  }
  resume.addEventListener("click",()=>{lastShown=null;render();});
  exit.addEventListener("click",async()=>{
    const t=current();if(!t||busy||t.pendingSave||t.restoring)return;
    busy=true;exit.disabled=true;
    try{await app.exitInteractiveTutorial(t.checkpoint);}
    finally{busy=false;render();}
  });
  function syncLayout(){
    if(preview)return;
    doc.body.toggleAttribute('data-tutorial-guide',!banner.hidden);
    if(banner.hidden)doc.body.style.removeProperty('--cm-tutorial-guide-height');
    else doc.body.style.setProperty('--cm-tutorial-guide-height',banner.offsetHeight+'px');
  }
  const resize=!preview&&typeof ResizeObserver==='function'?new ResizeObserver(syncLayout):null;
  resize?.observe(banner);
  const reposition=()=>syncSpotlight();
  win.addEventListener?.("resize",reposition);
  const stop=app.subscribeRaising(render);
  const stopLocale=onLocaleChange(()=>{lastShown=null;dialogAbort?.abort();render();});
  render();
  return Object.freeze({dispose(){if(disposed)return;disposed=true;dialogAbort?.abort();stop();stopLocale();resize?.disconnect();win.removeEventListener?.("resize",reposition);
    if(layoutFrame!==null)cancelFrame(layoutFrame);if(spotFrameId!==null)cancelFrame(spotFrameId);
    if(!preview){doc.body.removeAttribute("data-tutorial-guide");doc.body.style.removeProperty("--cm-tutorial-guide-height");}banner.remove();spotlight.remove();}});
}
