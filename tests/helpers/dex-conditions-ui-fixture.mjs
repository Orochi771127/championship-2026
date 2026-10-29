import {databaseHeroPortrait,databaseHeroSilhouette} from '../../src/championship/presentation/databaseHeroPortraits.js';
import {databaseStory,databaseStoryHeading,databaseVerifiedData,databaseVerifiedHeading} from '../../src/championship/database/databaseStories.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {deepFreeze} from '../../src/championship/contracts/championshipContracts.js';
import {projectDatabase} from '../../src/championship/database/databaseRuntime.js';
import {databaseDisplayRows,getDatabaseDisplayEntry} from '../../src/championship/database/databaseDisplayCatalog.js';
import {databaseIllustrationText} from '../../src/championship/database/databaseIllustrations.js';
import {speciesName,generationName} from '../../src/championship/text/zhHant.js';
import {setLabel,setText,uiText} from '../../src/championship/text/uiText.js';
import {setLocale} from '../../src/championship/text/locale.js';
import {isDesktopBrowseLayout} from '../../src/championship/app/portraitFrame.js';
import {taxonomyBadge} from '../../src/championship/presentation/taxonomyBadgeArt.js';
import {elementChartButton} from '../../src/championship/app/elementChartModal.js';
import {ControlledEvent,createControlledDocument} from './controlled-database-dom.mjs';
const candidateScreen=new URL('../../src/championship/app/vs4Screens.js',import.meta.url);
const inDocument=(doc,fn)=>(...args)=>{const previous=globalThis.document;globalThis.document=doc;try{return fn(...args);}finally{globalThis.document=previous;}};
const fixtureCollection=()=>[{speciesId:'species-008',instanceId:'fixture-individual-8',displayName:'Unsubmitted name',originGateId:'fixture-gate'}];

export function makeView({locale='zh-Hant',selectedSpeciesIndex=8,registeredSpecies=[8,20],evolutionBranches=[0],collection=fixtureCollection(),screenUrl=candidateScreen,projection=projectDatabase,width=390,height=844,wideLayout=null}={}) {
  setLocale(locale);
  const input=deepFreeze({registeredSpecies:[...registeredSpecies],evolutionBranches:[...evolutionBranches],collection});
  const inputSnapshot=JSON.stringify(input);
  let selected=selectedSpeciesIndex;
  let frame={screen:'DATABASE',database:projection({...input,selectedSpeciesIndex:selected})};
  const document=createControlledDocument(locale),root=document.createElement('main');document.body.append(root);
  const calls={select:[],rename:[],leave:0,art:[],forbidden:[]};
  const forbidden=name=>()=>{calls.forbidden.push(name);throw new Error(`FORBIDDEN_${name}`);};
  const storage=new Proxy({}, {get:forbidden('STORAGE_READ'),set:forbidden('STORAGE_WRITE')});
  const safeMath=Object.create(Math);safeMath.random=forbidden('RNG');
  const listeners=new Map();
  let view;
  const source={getFrame:()=>frame,intents:{
    selectDatabaseSpecies(value){calls.select.push(value);selected=value;frame={screen:'DATABASE',database:projection({...input,selectedSpeciesIndex:selected})};view?.render(frame);},
    renameDatabaseInstance(...args){calls.rename.push(args);},leaveScreen(){calls.leave++;},
    save:forbidden('SAVE'),saveGame:forbidden('SAVE'),next:forbidden('RNG')
  }};
  for(const field of ['save','saveStore','rng','nativeProfile','profile'])Object.defineProperty(source,field,{get:forbidden(field)});
  const context=vm.createContext({
    document,console,URLSearchParams,AbortController,Promise,Math:safeMath,
    location:{search:''},innerWidth:width,innerHeight:height,
    localStorage:storage,sessionStorage:storage,fetch:forbidden('NETWORK'),
    setTimeout:forbidden('TIMER'),setInterval:forbidden('TIMER'),requestAnimationFrame:forbidden('RAF'),
    addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    databaseHeroPortrait,databaseHeroSilhouette,databaseStory,databaseStoryHeading,databaseVerifiedData,databaseVerifiedHeading,databaseDisplayRows,getDatabaseDisplayEntry,databaseIllustrationText,speciesName,generationName,setLabel,setText,uiText,isDesktopBrowseLayout,
    // Emblem helpers draw into this fixture's document.
    taxonomyBadge:inDocument(document,taxonomyBadge),elementChartButton:inDocument(document,elementChartButton),
    originalDatabaseIcon:()=>null,
    openingEggChoices:()=>Array.from({length:8},(_,speciesIndex)=>({speciesIndex,formalName:`Fixture egg ${speciesIndex}`,src:''})),
    openingEggText:()=>({nameNote:''}),
    loadAcceptedDatabasePortrait(speciesIndex,options){calls.art.push({speciesIndex,signal:options.signal});return Promise.resolve(null);},
    PRODUCT_GIVEN_NAME_MAX_LENGTH:24,VS2_UI_AUTHORITY:'FIXTURE',VS2_PRESENTATION_MODES:{PLAYER:'PLAYER',DEVELOPER:'DEVELOPER'},
    RANCH_EXPANSION_DECK_SLOTS:5,NATIVE_RANCH_LAYOUT:{},prefersReducedMotion:()=>true,
    cageUiImage:()=>null,cageUiLidImage:()=>null,shopCageUiImage:()=>null,cageEditorArtCells:()=>[],cageUiName:()=>'',shopCageUiName:()=>'',cageUiSummary:()=>'',
    ranchBoardCell:()=>({x:0,y:0}),openRanchExpansionPreview:()=>{},shopGoodsPresentation:()=>null,getHuntCatalogItem:()=>null,showChoiceDialog:()=>{},shopDescriptionText:()=>'',shopItemName:()=>''
  });
  const fullModule=readFileSync(screenUrl,'utf8');
  // Strip ESM declarations, never extract/rewrite the createDatabaseView body.
  const executable=fullModule.replace(/^import\s[\s\S]*?;\s*/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/g,'');
  new vm.Script(`${executable}\nglobalThis.fixtureCreateDatabaseView=createDatabaseView;`,{filename:screenUrl.pathname}).runInContext(context);
  view=context.fixtureCreateDatabaseView({root,source,...(wideLayout?{isWideLayout:()=>wideLayout({width:context.innerWidth,height:context.innerHeight})}:{})});
  return {root,document,view,source,calls,input,inputSnapshot,context,
    frame:()=>frame,
    resize(w,h){context.innerWidth=w;context.innerHeight=h;for(const fn of listeners.get('resize')??[])fn(new ControlledEvent('resize'));},
    select(value){source.intents.selectDatabaseSpecies(value);},
    assertUnchanged(){assert.equal(JSON.stringify(input),inputSnapshot);assert.deepEqual(calls.forbidden,[]);},
    dispose(){view.dispose();},listeners};
}
