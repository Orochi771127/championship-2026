import catalog from '../../data/championship/alternate-form-assets.r1.json' with {type:'json'};
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from './championshipStandaloneSave.js';
const reports=[];let repaint=()=>{};
export function reportQaCharacterLoad(value){reports.push(value);repaint();}
export function setupQaDiagnostics(app,storage){
 const doc=globalThis.document;if(!doc?.body)return;
 const panel=doc.createElement('details'),summary=doc.createElement('summary'),button=doc.createElement('button'),out=doc.createElement('pre');
 panel.id='alternate-form-qa-diagnostics';panel.style.cssText='position:fixed;bottom:4px;right:4px;z-index:99998;max-width:90vw;max-height:70vh;overflow:auto;background:#102230;color:white;padding:8px;font:12px monospace';
 summary.textContent='Alternate-form QA diagnostics';button.textContent='Refresh read-only diagnostics';button.type='button';out.id='alternate-form-qa-report';panel.append(summary,button,out);doc.body.append(panel);
 const errors=[];
 repaint=()=>{let saved,saveReadError=null;try{saved=JSON.parse(storage.getItem(CHAMPIONSHIP_MODERN_SAVE_KEY));}catch(error){saveReadError=String(error?.message??error);}
  const saveInspection=app.inspectSave(),continueInspection=app.canContinue();
  let instances=[];try{instances=app.getRaisingInstances().map(entry=>{const actor=app.getRaisingActorFrame(entry.instanceId),id=Number(entry.speciesId.split('-').at(-1)),config=catalog.characters.find(c=>c.speciesIndex===id);return {instanceId:entry.instanceId,speciesIndex:id,actorSpeciesIndex:actor?.speciesIndex,sequenceId:actor?.sequenceId,cell:actor?.cell,configuredEntity:config?.entityId??null,configuredMotionDonor:config?.motionDonorEntityId??null};});}catch{}
  out.textContent=JSON.stringify({qaOnly:true,namespace:'championshipAlternateFormsQA:r1:',storage:'sessionStorage only',saveSchema:saved?.schemaVersion??null,saveReadError,saveInspectionError:saveInspection.error??null,continueInspection,screen:app.getScreen(),instances,actualLoaderReports:reports,errors},null,2);
 };
 button.addEventListener('click',repaint);panel.addEventListener('toggle',()=>{if(panel.open)repaint();});
 globalThis.addEventListener?.('error',event=>{errors.push(String(event.message??'runtime error'));repaint();});
 globalThis.addEventListener?.('unhandledrejection',event=>{errors.push(String(event.reason?.message??event.reason));repaint();});
 repaint();
}
