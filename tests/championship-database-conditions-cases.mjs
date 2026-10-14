import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import lifecycle from '../src/data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {deepFreeze} from '../src/championship/contracts/championshipContracts.js';
import {nativeEvolutionRequirements} from '../src/championship/raising/nativeRaisingLifecycle.js';
import {projectDatabaseEvolutionRoutes} from '../src/championship/database/databaseEvolutionRoutes.js';
import {DATABASE_EVOLUTION_CONDITION_DESCRIPTORS as descriptors,
  projectDatabaseEvolutionConditions as project} from '../src/championship/database/databaseEvolutionConditions.js';

const registeredSpecies=Array.from({length:216},(_,i)=>i+8);
const options=(source,branch)=>({sourceRegistered:true,registeredSpecies,evolutionBranches:[(source-8)*5+branch]});
const before=JSON.stringify(lifecycle);
deepFreeze(lifecycle);
const frozen=value=>{
  if(value&&typeof value==='object'){
    assert.ok(Object.isFrozen(value));
    for(const entry of Object.values(value))frozen(entry);
  }
};
const isolated=(mode,fixture)=>{
  const script=fileURLToPath(new URL('./helpers/database-evolution-condition-isolated-case.mjs',import.meta.url));
  const child=spawnSync(process.execPath,[script,mode,...(fixture?[JSON.stringify(fixture)]:[])],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr||child.stdout);
  return JSON.parse(child.stdout);
};

test('all 477 real branches preserve exact rules/order, freeze output and leave frozen inputs unchanged',()=>{
  let count=0,rows=0;
  const active=new Set(),kinds={ORDINARY:0,LIFETIME_ONLY:0};
  assert.equal(lifecycle.rules.length,179);
  assert.equal(lifecycle.rules.filter(group=>group.length).length,178);
  assert.equal(Math.max(...lifecycle.rules.map(group=>group.length)),5);
  lifecycle.rules.forEach((group,i)=>group.forEach((rule,branch)=>{
    const source=i+8,context=deepFreeze(options(source,branch)),snapshot=JSON.stringify(context);
    const result=project(source,branch,context);assert.ok(result);
    assert.equal(result.evaluationOrder,branch+1);
    assert.equal(result.lifetimeOnly,rule.kind===1);
    const requirements=nativeEvolutionRequirements(rule);
    const expected=rule.thresholds.flatMap((value,thresholdIndex)=>{
      if(value===0||(rule.kind===1&&thresholdIndex<24))return [];
      return [{thresholdIndex,value:thresholdIndex>=11&&thresholdIndex<=21?requirements.stats[thresholdIndex-11].minimum:value,
        operator:thresholdIndex===25&&rule.kind===0?'LTE':'GTE'}];
    });
    assert.deepEqual(result.conditions.map(({thresholdIndex,value,operator})=>({thresholdIndex,value,operator})),expected);
    result.conditions.forEach(row=>active.add(row.id));rows+=result.conditions.length;
    kinds[result.ruleKind]++;count++;frozen(result);
    assert.deepEqual(project(source,branch,context),result);
    assert.equal(JSON.stringify(context),snapshot);
  }));
  assert.equal(count,477);assert.equal(rows,473);assert.equal(active.size,15);
  assert.deepEqual(kinds,{ORDINARY:323,LIFETIME_ONLY:154});
  assert.equal(JSON.stringify(lifecycle),before);
});

test('26 unique typed descriptors use the exact counts/stat/channel order without identifying a species',()=>{
  assert.equal(descriptors.length,26);frozen(descriptors);
  assert.equal(new Set(descriptors.map(d=>d.id)).size,26);
  assert.deepEqual(descriptors.map(d=>d.thresholdIndex),Array.from({length:26},(_,i)=>i));
  assert.deepEqual(descriptors.slice(0,11).map(d=>d.id),[
    'VACCINE_ATTRIBUTE','DATA_ATTRIBUTE','VIRUS_ATTRIBUTE','DRAGON_ATTRIBUTE','BEAST_ATTRIBUTE','AQUATIC_ATTRIBUTE',
    'BIRD_ATTRIBUTE','INSECT_PLANT_ATTRIBUTE','HOLY_ATTRIBUTE','DARK_ATTRIBUTE','MACHINE_ATTRIBUTE']);
  assert.deepEqual(descriptors.slice(11,22).map(d=>d.id),[
    'MAX_HP','MAX_TP','ATTACK','DEFENSE','WISDOM','SPEED','HEAT_RESISTANCE','COLD_RESISTANCE','LIGHT_RESISTANCE','DARK_RESISTANCE','THUNDER_RESISTANCE']);
  assert.equal(descriptors[25].ordinaryOperator,'LTE');assert.equal(descriptors[25].lifetimeOperator,'GTE');
  assert.ok(descriptors.slice(0,24).every(d=>d.lifetimeOperator===null));
  assert.equal(descriptors[23].valueType,'NATIVE_Q12_INTEGER_PERCENT');
  assert.equal(descriptors[24].unit,'TIMES');assert.equal(descriptors[25].unit,'VALUE');
  assert.ok(lifecycle.rules.flat().every(rule=>rule.thresholds.slice(11,22).every(value=>value===0)));
});

test('unknown source/branch returns no conditions, including target-only registration and contradictory history',()=>{
  for(const context of [undefined,{},null,{...options(8,0),sourceRegistered:false},{...options(8,0),sourceRegistered:1},
    {...options(8,0),evolutionBranches:[]},{...options(8,0),evolutionBranches:[5]},
    {...options(8,0),registeredSpecies:[8]},{...options(8,0),evolutionBranches:null},
    {...options(8,0),registeredSpecies:null},{...options(8,0),evolutionBranches:['0',0.5,-1,9999]}]){
    assert.equal(project(8,0,context),null);
  }
  const edges=lifecycle.rules.flatMap((group,i)=>group.map((rule,branch)=>({source:i+8,target:rule.target,branch,offset:i*5+branch})));
  const first=edges[0],other=edges.find(edge=>edge.target===first.target&&edge.source!==first.source);
  assert.ok(other);
  assert.equal(project(other.source,other.branch,{sourceRegistered:true,registeredSpecies,evolutionBranches:[first.offset]}),null);
  // Exact valid flags retain the published route behavior even with unrelated malformed flags.
  const context={sourceRegistered:true,registeredSpecies,evolutionBranches:[0,760]};
  assert.equal(projectDatabaseEvolutionRoutes(8,context)[0].revealed,true);
  assert.ok(project(8,0,context));assert.equal(project(8,1,context),null);
});

test('invalid sources, branches, eggs, empty groups and terminal species fail closed without changing history',()=>{
  const context=deepFreeze(options(8,0)),snapshot=JSON.stringify(context);
  for(const source of [-1,0,7,8.5,'8',NaN,Infinity,224,227,228,160,187,211,222,223,null,undefined])assert.equal(project(source,0,context),null);
  for(const branch of [-1,0.5,'0',NaN,Infinity,3,4,5,99,null,undefined])assert.equal(project(8,branch,context),null);
  assert.equal(JSON.stringify(context),snapshot);
});

test('zero disables rows; all-zero lifetime routes retain their lifetime-only condition',()=>{
  const first=project(8,0,options(8,0));
  assert.deepEqual(first.conditions.map(row=>[row.id,row.value]),[['MACHINE_ATTRIBUTE',20]]);
  const lifetime=project(8,2,options(8,2));
  assert.equal(lifetime.lifetimeOnly,true);assert.equal(lifetime.ruleKind,'LIFETIME_ONLY');
  assert.deepEqual(lifetime.conditions,[]);
  let allZero=0;
  lifecycle.rules.forEach((group,i)=>group.forEach((rule,branch)=>{
    if(rule.kind===1&&rule.thresholds.every(t=>t===0)){
      allZero++;const result=project(i+8,branch,options(i+8,branch));
      assert.deepEqual(result.conditions,[]);assert.equal(result.lifetimeOnly,true);
    }
  }));assert.equal(allZero,140);
});

test('real lifetime care uses a lower bound; synthetic ordinary care uses an upper bound',()=>{
  const real=project(22,2,options(22,2));
  assert.deepEqual(real.conditions.map(({id,operator,value})=>({id,operator,value})),[
    {id:'CARE_MISTAKE_VALUE',operator:'GTE',value:3}]);
  const thresholds=Array(26).fill(0);thresholds[25]=3;
  const ordinary=isolated('synthetic',{kind:0,thresholds}).result;
  assert.equal(ordinary.conditions[0].operator,'LTE');assert.equal(ordinary.conditions[0].value,3);
  thresholds[25]=0;assert.deepEqual(isolated('synthetic',{kind:0,thresholds}).result.conditions,[]);
});

test('synthetic lifetime rows ignore nonzero fields 0..23 and retain only cycles/care lower bounds',()=>{
  const thresholds=Array(26).fill(20);thresholds[24]=2;thresholds[25]=4;
  const {result}=isolated('synthetic',{kind:1,thresholds});
  assert.deepEqual(result.conditions.map(({thresholdIndex,operator,value})=>({thresholdIndex,operator,value})),[
    {thresholdIndex:24,operator:'GTE',value:2},{thresholdIndex:25,operator:'GTE',value:4}]);
});

test('11 synthetic stat percentages reuse native target-curve truncation; nonzero raw rounding to zero stays active',()=>{
  const thresholds=Array(26).fill(0);for(let i=11;i<=21;i++)thresholds[i]=i===11?37:1;
  const {result,requirements}=isolated('synthetic',{kind:0,thresholds});
  assert.equal(result.conditions.length,11);
  result.conditions.forEach((row,i)=>{
    assert.equal(row.thresholdIndex,11+i);assert.equal(row.value,requirements.stats[i].minimum);
    assert.equal(row.sourcePercent,thresholds[11+i]);assert.equal(row.valueType,'NATIVE_TARGET_CURVE_PERCENT_TRUNCATED');
  });
  assert.ok(result.conditions.some(row=>row.value===0&&row.sourcePercent!==0));
});

test('output contains no species/profile/name/raw rule fields and never reports current attainment',()=>{
  const rootKeys=['ruleKind','lifetimeOnly','evaluationOrder','conditions','comparison','caveatIds'].sort();
  const rowKeys=['id','thresholdIndex','operator','value','unit','valueType'].sort();
  const context=options(171,0);
  for(const key of ['profile','nativeProfile','rng','runtime','save'])Object.defineProperty(context,key,{get(){throw new Error('MUST_NOT_READ_INDIVIDUAL_CONTEXT');}});
  const result=project(171,0,context);
  assert.deepEqual(Object.keys(result).sort(),rootKeys);
  for(const row of result.conditions)assert.deepEqual(Object.keys(row).sort(),rowKeys);
  assert.deepEqual(result.comparison,{state:'NOT_COMPARED',reason:'NO_INDIVIDUAL_CONTEXT'});
  assert.equal(result.conditions.find(row=>row.id==='EVOLUTION_WIN_PERCENT').value,70);
  assert.equal(result.conditions.find(row=>row.id==='EVOLUTION_WIN_PERCENT').valueType,'NATIVE_Q12_INTEGER_PERCENT');
  const serialized=JSON.stringify(result);
  for(const forbidden of ['species-','sourceSpecies','targetSpecies','nativeProfile','displayName','"name"','"current"','"met"','"eligible"','"progress"','"thresholds"'])assert.ok(!serialized.includes(forbidden),forbidden);
  assert.ok(result.caveatIds.includes('THRESHOLDS_DO_NOT_GUARANTEE_EVOLUTION'));
});

test('pure import and all 477 projections do not invoke resolver/normalizer/constructor, RNG, timers, storage or network',()=>{
  assert.deepEqual(isolated('purity'),{count:477,importAndProjectionSideEffects:0,forbiddenProjectionCalls:0,functionTrapsVerified:5,globalTrapsVerified:8});
  const text=readFileSync(new URL('../src/championship/database/databaseEvolutionConditions.js',import.meta.url),'utf8');
  for(const forbidden of [/evaluateNativeEvolution\s*\(/,/evaluateNativeRebirth\s*\(/,/Math\.random\s*\(/,/localStorage/,/setTimeout\s*\(/,/\.next\s*\(/])assert.doesNotMatch(text,forbidden);
});
