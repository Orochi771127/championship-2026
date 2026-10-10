import {isApprovedOriginalPublicLocation} from '../presentation/originalRuntimeLocation.js';
// Local tutorial UI: normal onboarding and explicit review share the same controller.
// Reads the app checkpoint and uses the existing modal/focus owner.
import {showChoiceDialog} from "./uiDialog.js";
import {INTERACTIVE_TUTORIAL_NORMAL_ONBOARDING_ELIGIBLE,sameInteractiveTutorialCheckpoint} from "./interactiveTutorialCheckpoint.js";
import {tutorialLine} from "../text/tutorialMessages.zhHant.js";
import {tutorialPreviewText} from "../text/interactiveTutorialPreviewText.js";
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

export function mountInteractiveTutorialPreview({app,doc=globalThis.document,showDialog=showChoiceDialog,preview=true}={}) {
  const banner=doc.createElement("aside"),label=doc.createElement("span"),exit=doc.createElement("button"),resume=doc.createElement("button");
  banner.className=preview?"cm-tutorial-preview":"cm-tutorial-guidance";banner.dataset.preview=String(preview);
  banner.setAttribute("aria-live","polite");
  // Preview chrome only; no modification to toolbar text/clamp/touch styles.
  if(preview)banner.style.cssText="position:fixed;top:8px;left:8px;right:8px;z-index:150;display:flex;align-items:center;gap:8px;padding:8px 12px;background:#10242a;color:#e9fff8;border:1px solid #65dbc4;border-radius:10px;font-size:13px;line-height:1.4";
  label.style.cssText="flex:1;min-width:0;overflow-wrap:anywhere";
  exit.type="button";exit.dataset.tutorialAction="exit";
  exit.style.cssText="min-height:44px;max-width:42%;padding:8px;border-radius:8px;border:1px solid #65dbc4;background:#163b3a;color:inherit;font:inherit;white-space:normal";
  resume.type="button";resume.dataset.tutorialAction="resume";resume.style.cssText=exit.style.cssText;
  banner.append(label,resume,exit);doc.body.append(banner);
  let disposed=false,busy=false,lastShown=null,dialogAbort=null;
  const key=t=>t.checkpoint.stage+":"+t.checkpoint.message+":"+t.pendingSave;
  const current=()=>app.getSession()?app.getInteractiveTutorial():null;
  const same=t=>{const now=current();return now&&!now.finished&&sameInteractiveTutorialCheckpoint(now.checkpoint,t.checkpoint);};
  function render(){
    if(disposed)return;
    const t=current(),copy=tutorialPreviewText(preview);
    banner.hidden=!t||t.finished;
    banner.style.display=banner.hidden?"none":"flex";
    if(banner.hidden){syncLayout();dialogAbort?.abort();return;}
    banner.dataset.stage=t.checkpoint.stage;
    banner.setAttribute("aria-label",getActiveGameTitle(getLocale())+" — "+copy.title);
    label.textContent=copy.title+" · "+(t.pendingSave?copy.failed:t.waiting?copy.waiting:t.textId?tutorialLine(t.textId):copy.next);
    exit.textContent=copy.exit;exit.disabled=busy||t.restoring||t.pendingSave;
    resume.textContent=t.pendingSave?copy.retry:copy.next;resume.hidden=!t.pendingSave&&!t.dialogue&&!t.boundary&&t.checkpoint.stage!=="invitation";resume.disabled=busy||t.restoring;
    syncLayout();
    if(busy||t.restoring||key(t)===lastShown||!t.pendingSave&&!t.dialogue&&!t.boundary&&t.checkpoint.stage!=="invitation")return;
    void prompt(t);
  }
  async function prompt(t){
    busy=true;exit.disabled=true;const copy=tutorialPreviewText(preview),expected=t.checkpoint;
    const stage=expected.stage,controller=new AbortController();dialogAbort=controller;
    let message="",actions=[];
    if(t.pendingSave){message=copy.failed;actions=[{id:"keep",label:copy.keep},{id:"retry",label:copy.retry,tone:"primary"}];}
    else if(stage==="invitation"){message=copy.invite;actions=[{id:"decline",label:copy.decline},{id:"accept",label:copy.accept,tone:"primary"}];}
    else if(t.dialogue){message=tutorialLine(t.textId);actions=[{id:"exit",label:copy.exit},{id:"next",label:copy.next,tone:"primary"}];}
    else if(t.boundary){message=copy.boundary;actions=[{id:"exit",label:copy.exit},{id:"keep",label:copy.keep,tone:"primary"}];}
    try{
      const action=await showDialog({title:copy.title,message,actions,cancelId:"keep",focusId:actions[0].id,signal:controller.signal,doc});
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
  const stop=app.subscribeRaising(render);
  const stopLocale=onLocaleChange(()=>{lastShown=null;dialogAbort?.abort();render();});
  render();
  return Object.freeze({dispose(){if(disposed)return;disposed=true;dialogAbort?.abort();stop();stopLocale();resize?.disconnect();if(!preview){doc.body.removeAttribute("data-tutorial-guide");doc.body.style.removeProperty("--cm-tutorial-guide-height");}banner.remove();}});
}
