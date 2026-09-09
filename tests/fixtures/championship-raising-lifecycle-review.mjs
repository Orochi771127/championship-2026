// Local test fixture. Calls public application commands; never injects a form,
// actor, RNG state or ROM payload. The product build does not ship tests/.
import * as PIXI from '../../node_modules/pixi.js/dist/pixi.mjs';
import {createChampionshipStandaloneApp} from '../../src/championship/app/championshipStandaloneApp.js';
import {createRaisingPresentationSource} from '../../src/championship/app/raisingPresentationSource.js';
import {createChampionshipPixiStage} from '../../src/championship/presentation/championshipPixiStage.js';
import {mountRaisingFieldPixiPresentation} from '../../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js';
import {LICENSED_CHARACTER_MANIFEST,loadLicensedCharacterRoster} from '../../src/championship/presentation/licensedCharacterRoster.js';
import {createRaisingCageArtPlan} from '../../src/championship/presentation/raisingCageArtPlan.js';
import {createRuntimeMapArtTileSetLoader} from '../../src/championship/presentation/runtimeMapArtBundle.js';
import catalog from '../../src/data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import {RAISING_CAGES} from '../../src/championship/app/cageRoster.js';
const host=document.querySelector('#field'),result=document.querySelector('#result'),prepare=document.querySelector('#prepare'),advance=document.querySelector('#advance'),finish=document.querySelector('#finish');
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const app=createChampionshipStandaloneApp({storage,catalog,cages:RAISING_CAGES});let stage,port,source,id;
const step=()=>app.hasRaisingPresentation()?app.advanceRaisingPresentation({frames:1}):app.advanceNaturalClock({frames:1});
const report=()=>{const a=app.getRaisingActorFrame(id);result.textContent=JSON.stringify({date:app.getSnapshot().dayOfSeason+1,minute:app.getSnapshot().clockMinutes,instanceId:id,species:a?.speciesIndex,state:a?.state,evolution:a?.evolution?{phase:a.evolution.phase,elapsed:a.evolution.elapsed,totalFrames:a.evolution.totalFrames,target:a.evolution.target}:null,renderer:port?.getDiagnostics()},null,2);};
const json=async path=>{const response=await fetch(new URL('../../'+path,import.meta.url));if(!response.ok)throw Error('HTTP '+response.status);return response.json();};
prepare.onclick=async()=>{prepare.disabled=true;try{
  await app.newGame();id=app.getRaisingInstances()[0].instanceId;
  for(let i=0;i<3;i++){app.touchRaisingEgg(id);step();}for(let i=0;i<200;i++)step();
  let found=false;
  for(let day=0;day<12&&!found;day++){
    const a=app.getRaisingActorFrame(id);if(!a)throw Error('No living actor');app.placeRaisingFood({x:a.positionQ12[0]/4096,y:a.positionQ12[1]/4096});
    for(let i=0;i<600;i++){const e=app.getRaisingLifecycleFrame().evolution;if(e?.target>=8){found=true;break;}step();}
    if(found)break;app.endDay();for(let i=0;i<40;i++)step();app.acknowledgeRaisingCalendar();for(let i=0;i<26;i++)step();
  }
  if(!found)throw Error('No evolution reached');
  source=createRaisingPresentationSource(app);stage=await createChampionshipPixiStage({PIXI,canvasHost:host});
  const productionIndex=await json('assets/production/ART_PRODUCTION_INDEX.json'),manifest=await json(LICENSED_CHARACTER_MANIFEST);
  const speciesIds=[...source.getFrame().residents.map(r=>r.speciesId),`species-${String(app.getRaisingLifecycleFrame().evolution.target).padStart(3,'0')}`];
  const characterBundle=await loadLicensedCharacterRoster({PIXI,speciesIds,productionIndex,manifest,manifestUrl:new URL('../../'+LICENSED_CHARACTER_MANIFEST,import.meta.url).href});
  const art=await json('assets/production/cage/licensed-runtime-v1/manifest.json'),cage=app.getCageEditFrame(),plan=createRaisingCageArtPlan({manifest:art,placements:cage.placements,layoutVersion:cage.layoutVersion,unlockedCount:cage.unlockedCount});
  const fieldArt=await createRuntimeMapArtTileSetLoader({PIXI}).load({manifest:art,placements:plan.placements,residentViewport:plan.residentViewport,placementEvidence:plan.placementEvidence,presentationMode:plan.mode});
  port=await mountRaisingFieldPixiPresentation({stage,source,fieldArt,characterBundle});advance.disabled=finish.disabled=false;report();
}catch(e){result.textContent=e.stack;}};
advance.onclick=()=>{for(let i=0;i<20;i++)step();report();};finish.onclick=()=>{while(app.getRaisingLifecycleFrame().evolution)step();report();};
document.querySelector('#narrow').onclick=()=>{host.style.width='320px';report();};
