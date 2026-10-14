// Test-only fresh process. The same file is an asynchronous module loader on
// its loader thread; node:module.register is available before the repo's Node22
// floor. Fixtures and side-effect traps never enter a game save or the helper.
import {register} from 'node:module';
import {isMainThread} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
let loaderConfig;
export function initialize(data) { loaderConfig=data; }
export async function load(url,context,nextLoad) {
  if(loaderConfig.mode==='synthetic'&&url===loaderConfig.catalogUrl)
    return {format:'json',source:JSON.stringify(loaderConfig.catalog),shortCircuit:true};
  const result=await nextLoad(url,context);
  if(loaderConfig.mode!=='purity'||result.format!=='module'||!url.includes('/src/'))return result;
  let source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString();
  for(const name of ['evaluateNativeEvolution','evaluateNativeRebirth','normalizeNativeIndividualProfile','createNativeHuntIndividual','initializeNativeHuntAi']) {
    const marker=new RegExp(`(export function ${name}\\([^]*?\\) \\{)`);
    source=source.replace(marker,`$1 globalThis.__dexConditionForbiddenCalls=(globalThis.__dexConditionForbiddenCalls??0)+1; throw new Error('FORBIDDEN_${name}');`);
  }
  return {...result,source};
}

if(isMainThread) {
  const mode=process.argv[2];
  const catalogUrl=new URL('../../src/data/championship/catalogs/raising-lifecycle.r1.json',import.meta.url).href;
  const original=JSON.parse(readFileSync(new URL(catalogUrl),'utf8'));
  if(mode==='synthetic') {
    const fixture=JSON.parse(process.argv[3]);
    original.rules[0][0]={target:20,kind:fixture.kind,thresholds:fixture.thresholds};
  } else if(mode!=='purity') throw new Error('UNKNOWN_TEST_MODE');
  register(import.meta.url,{data:{mode,catalogUrl,catalog:original}});
  let sideEffectAttempts=0;
  if(mode==='purity') {
    globalThis.__dexConditionForbiddenCalls=0;
    const fail=()=>{sideEffectAttempts++;throw new Error('FORBIDDEN_SIDE_EFFECT');};
    globalThis.fetch=fail;
    globalThis.setTimeout=fail;globalThis.setInterval=fail;
    globalThis.requestAnimationFrame=fail;Math.random=fail;Date.now=fail;
    globalThis.localStorage=new Proxy({}, {get:fail,set:fail});
    globalThis.sessionStorage=new Proxy({}, {get:fail,set:fail});
  }
  const {projectDatabaseEvolutionConditions:project}=await import('../../src/championship/database/databaseEvolutionConditions.js');
  if(mode==='synthetic') {
    const result=project(8,0,{sourceRegistered:true,registeredSpecies:[8,20],evolutionBranches:[0]});
    const {nativeEvolutionRequirements}=await import('../../src/championship/raising/nativeRaisingLifecycle.js');
    process.stdout.write(JSON.stringify({result,requirements:nativeEvolutionRequirements(original.rules[0][0])}));
  } else {
    let count=0;
    original.rules.forEach((group,i)=>group.forEach((rule,branch)=>{
      const result=project(i+8,branch,{sourceRegistered:true,registeredSpecies:[i+8,rule.target],evolutionBranches:[i*5+branch]});
      if(!result)throw new Error('EXPECTED_REVEALED_RESULT');count++;
    }));
    const projectionSideEffects=sideEffectAttempts;
    const forbiddenProjectionCalls=globalThis.__dexConditionForbiddenCalls;
    if(projectionSideEffects!==0||forbiddenProjectionCalls!==0)throw new Error('PROJECTION_CAUGHT_FORBIDDEN_SIDE_EFFECT');
    // Prove the injected function traps actually fire, instead of merely
    // trusting text replacement. Their first statement prevents any mutation.
    const modules=[
      [await import('../../src/championship/raising/nativeRaisingLifecycle.js'),['evaluateNativeEvolution','evaluateNativeRebirth']],
      [await import('../../src/championship/raising/nativeIndividualProfile.js'),['normalizeNativeIndividualProfile']],
      [await import('../../src/championship/hunt/capture/nativeHuntIndividual.js'),['createNativeHuntIndividual']],
      [await import('../../src/championship/hunt/capture/nativeHuntActorInitialization.js'),['initializeNativeHuntAi']]
    ];
    for(const [module,names] of modules)for(const name of names){
      let trapped=false;
      try { module[name]({}, {}, {}); } catch(error) { trapped=error.message===`FORBIDDEN_${name}`; }
      if(!trapped)throw new Error(`TRAP_NOT_ACTIVE_${name}`);
    }
    const globals=[()=>fetch(),()=>setTimeout(()=>{},0),()=>setInterval(()=>{},0),()=>requestAnimationFrame(()=>{}),
      ()=>Math.random(),()=>Date.now(),()=>localStorage.getItem('probe'),()=>sessionStorage.getItem('probe')];
    for(const probe of globals){let trapped=false;try{probe();}catch(error){trapped=error.message==='FORBIDDEN_SIDE_EFFECT';}
      if(!trapped)throw new Error('GLOBAL_TRAP_NOT_ACTIVE');}
    process.stdout.write(JSON.stringify({count,importAndProjectionSideEffects:projectionSideEffects,forbiddenProjectionCalls,
      functionTrapsVerified:globalThis.__dexConditionForbiddenCalls,globalTrapsVerified:sideEffectAttempts}));
  }
}
