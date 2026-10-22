import {createChampionshipDiagnosticPort} from './ChampionshipPersistentSavePort.js';

export const DIAGNOSTIC_LIMIT = Object.freeze({entries:32,bytes:8192});
const TYPES=new Set(['BOOT','PAGE_SHOW','PAGE_HIDE','VISIBILITY','SCREEN','LOAD','LOAD_FAILED','ASSET_FAILED',
  'TITLE_RETURN','DOCUMENT_RELOAD','CONTEXT_LOST','CONTEXT_RESTORED','ERROR','REJECTION','CONTINUE_FAILED']);
const SCREENS=new Set(['TITLE','RAISING_HOME','HUNT_FIELD','HUNT_RESULT','HUNT_LOADOUT','GATE_SELECT','BATTLE_SELECT',
  'BATTLE_FIELD','BATTLE_RESULT','CHAMPIONSHIP','SHOP','DATABASE','MEDALS','CAGE_EDIT','DIGIMON_LIST','SCHEDULE','HELP','TAMER_INFO']);
const STAGES=new Set(['engine','facilities','partners','scene','arena','fighters','effects','overlay','loading','ready','error','cancelled',
  'loading-card','first-render','audio','gpu-warmup','first-vfx-render']);
const CODES=['NATIVE_CHARACTER_TEXTURE_MISSING','UNVERIFIED_NATIVE_CHARACTER_FRAME','RESIDENT_ART_UNAVAILABLE',
  'RAISING_CORE_ART_UNAVAILABLE','BATTLE_CORE_ART_UNAVAILABLE','BATTLE_CORE_VFX_UNAVAILABLE','LOAD_TIMEOUT','LOAD_STALLED','SAVE_FAILED',
  'CHAMPIONSHIP_MODERN_SAVE_CONFLICT','CHARACTER_RUNTIME_BUNDLE_DISPOSED'];
const NAMES=new Set(['Error','TypeError','RangeError','SyntaxError','SecurityError','QuotaExceededError','AbortError']);
const SOURCES=new Set(['save-and-quit','raising-load-return','raising-load-reload']);
const kind='CHAMPIONSHIP_RUNTIME_DIAGNOSTICS';
const boundedInt=n=>Number.isFinite(n)?Math.max(0,Math.min(2147483647,Math.round(n))):0;
const code=message=>CODES.find(c=>typeof message==='string'&&message.includes(c))??'OTHER';

// Never retain raw messages, URL queries, stacks, names or application state.
function sanitize(row) {
  if(!row||!TYPES.has(row.type)||!/^[a-f0-9]{8}$/.test(row.document))return null;
  const out={type:row.type,document:row.document,build:/^main-[A-Z0-9]+\.js$/.test(row.build)?row.build:'source',
    elapsedMs:boundedInt(row.elapsedMs),screen:SCREENS.has(row.screen)?row.screen:'UNKNOWN'};
  if(STAGES.has(row.stage))out.stage=row.stage;
  if(['start','done','error'].includes(row.phase))out.phase=row.phase;
  if(['raising','hunt','battle'].includes(row.area))out.area=row.area;
  if(CODES.includes(row.code)||row.code==='OTHER')out.code=row.code;
  if(NAMES.has(row.errorName))out.errorName=row.errorName;
  if(SOURCES.has(row.source))out.source=row.source;
  if(Number.isInteger(row.gpuWarmupGroups)&&row.gpuWarmupGroups>=0&&row.gpuWarmupGroups<=82)out.gpuWarmupGroups=row.gpuWarmupGroups;
  for(const key of ['persisted','wasDiscarded'])if(typeof row[key]==='boolean')out[key]=row[key];
  if(['navigate','reload','back_forward'].includes(row.navigation))out.navigation=row.navigation;
  if(['hidden','visible'].includes(row.visibility))out.visibility=row.visibility;
  if(['PIXI','OTHER'].includes(row.renderer))out.renderer=row.renderer;
  if(typeof row.module==='string'&&/^src\/championship\/[a-zA-Z0-9_/-]+\.js:\d+:\d+$/.test(row.module))out.module=row.module.slice(0,200);
  if(typeof row.asset==='string'&&/^assets\/production\/[a-zA-Z0-9_/-]+(?:\/[a-zA-Z0-9_.-]+)*\.(png|webp|json|svg|glb)$/.test(row.asset)
    &&!row.asset.split('/').some(p=>p==='..'||p==='.')&&row.asset.length<=200)out.asset=row.asset;
  return out;
}
function read(text) {
  try{if(typeof text!=='string'||text.length>DIAGNOSTIC_LIMIT.bytes)return [];
    const p=JSON.parse(text);return p?.kind===kind&&p.schemaVersion===1&&Array.isArray(p.events)
      ?p.events.slice(-DIAGNOSTIC_LIMIT.entries).map(sanitize).filter(Boolean):[];
  }catch{return [];}
}

// Drop routine progress before document/lifecycle/failure and battle-boundary
// evidence. Keep chronological order and the newest event within the same cap.
function evict(events) {
  let index=events.findIndex((e,i)=>i<events.length-1&&e.type==='LOAD'
    &&!(e.area==='battle'&&['overlay','scene','ready','loading-card','first-render','audio','gpu-warmup','first-vfx-render'].includes(e.stage)));
  if(index<0)index=events.findIndex((e,i)=>i<events.length-1&&e.type==='SCREEN');
  events.splice(index<0?0:index,1);
}

// Observe one existing renderer call, without rendering, ticking or waiting.
// A successful return confirms command submission, not compositor/GPU paint.
export function observeBattleFirstRender({renderer,record,isActive=()=>true}={}) {
  const original=renderer?.render;
  if(typeof original!=='function')return ()=>{};
  let started=false,stopped=false;
  const write=phase=>{try{record('LOAD',{area:'battle',stage:'first-render',phase,renderer:'PIXI'});}catch{}};
  function observed(...args){
    const target=args[0]?.target??args[1]?.renderTexture;
    if(stopped||started||!isActive()||(target&&target!==renderer.view?.renderTarget))return original.apply(this,args);
    started=true;write('start');
    try{const result=original.apply(this,args);write('done');return result;}
    finally{stop();}
  }
  function stop(){stopped=true;if(renderer.render===observed)renderer.render=original;}
  try{renderer.render=observed;}catch{return ()=>{};}
  return stop;
}

export function createRuntimeRecoveryDiagnostics({storage=()=>globalThis.localStorage,win=globalThis.window,
  doc=globalThis.document,now=()=>globalThis.performance.now(),getScreen=()=> 'TITLE',getRenderer=()=> 'OTHER',build='source',
  documentId=()=>{let n;try{n=globalThis.crypto.getRandomValues(new Uint32Array(1))[0];}catch{n=Math.floor(Math.random()*4294967296);}return n.toString(16).padStart(8,'0');}}={}) {
  const document=documentId(),start=now(),cleanups=[];
  let port=null,events=[],persistent=false;
  try{port=createChampionshipDiagnosticPort(typeof storage==='function'?storage():storage);events=read(port.read());persistent=true;}catch{}
  function record(type,data={}) {
    if(!TYPES.has(type))return;
    const error=data.error;
    const module=typeof error?.stack==='string'?error.stack.match(/src\/championship\/[a-zA-Z0-9_/-]+\.js:\d+:\d+/)?.[0]:null;
    let asset=null;
    try{const path=new URL(data.url,doc?.baseURI).pathname;asset=path.match(/assets\/production\/.+$/)?.[0];}catch{}
    let screen='UNKNOWN';try{screen=getScreen();}catch{}
    const row=sanitize({...data,type,document,build,elapsedMs:now()-start,screen,
      ...(error?{code:code(error.message),errorName:error.name,module}:{}),...(asset?{asset}:{})});
    if(!row)return;
    // Native frame errors may repeat every tick. One identical event is enough.
    const signature=r=>JSON.stringify({...r,elapsedMs:0});
    if(events.at(-1)&&signature(events.at(-1))===signature(row))return;
    // A failed write leaves newer evidence only in memory; rereading the stale
    // stored ring must not discard it on the next event.
    try{if(port&&persistent){const stored=read(port.read());if(stored.length)events=stored;}}catch{persistent=false;}
    events.push(row);while(events.length>DIAGNOSTIC_LIMIT.entries)evict(events);
    let text=JSON.stringify({schemaVersion:1,kind,events});
    while(new TextEncoder().encode(text).length>DIAGNOSTIC_LIMIT.bytes-64&&events.length){evict(events);text=JSON.stringify({schemaVersion:1,kind,events});}
    try{if(port){port.write(text);persistent=true;}}catch{persistent=false;}
  }
  const listen=(target,event,fn,capture=false)=>{target?.addEventListener?.(event,fn,capture);cleanups.push(()=>target?.removeEventListener?.(event,fn,capture));};
  record('BOOT',{navigation:win?.performance?.getEntriesByType?.('navigation')?.[0]?.type,wasDiscarded:doc?.wasDiscarded});
  listen(win,'pageshow',e=>record('PAGE_SHOW',{persisted:e.persisted}));
  listen(win,'pagehide',e=>record('PAGE_HIDE',{persisted:e.persisted}));
  listen(doc,'visibilitychange',()=>record('VISIBILITY',{visibility:doc.visibilityState}));
  listen(win,'error',e=>record('ERROR',{error:e.error??{name:'Error',message:''}}));
  listen(win,'unhandledrejection',e=>record('REJECTION',{error:e.reason instanceof Error?e.reason:{name:'Error',message:''}}));
  for(const [event,type]of [['webglcontextlost','CONTEXT_LOST'],['webglcontextrestored','CONTEXT_RESTORED']])
    listen(win,event,e=>record(type,{renderer:getRenderer(e.target)}),true);
  return Object.freeze({record,exportText(){return JSON.stringify({schemaVersion:1,kind,persistent,events});},
    dispose(){for(const cleanup of cleanups)cleanup();}});
}
