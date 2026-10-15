import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import lifecycle from '../src/data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {deepFreeze} from '../src/championship/contracts/championshipContracts.js';
import {projectDatabase} from '../src/championship/database/databaseRuntime.js';
import {projectDatabaseEvolutionRoutes} from '../src/championship/database/databaseEvolutionRoutes.js';
import {projectDatabaseEvolutionConditions, DATABASE_EVOLUTION_CONDITION_DESCRIPTORS} from '../src/championship/database/databaseEvolutionConditions.js';
import {nativeEvolutionRequirements} from '../src/championship/raising/nativeRaisingLifecycle.js';
import {uiText,UI_COPY} from '../src/championship/text/uiText.js';
import {setLocale,formatNumber} from '../src/championship/text/locale.js';
import {ControlledEvent,simulateButtonKeyActivation,serializeControlledNode} from './helpers/controlled-database-dom.mjs';

// This suite exercises the real runtime/helper and the unmodified function
// bodies from the FULL vs4Screens module in a controlled DOM. No real browser,
// pixels, native keyboard default actions, screen reader or visual layout is
// exercised. Only unrelated screen dependencies and art delivery are stubbed.
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
const allRegistered = Array.from({length:216},(_,i)=>i+8);
const allOffsets=lifecycle.rules.flatMap((group,i)=>group.map((_,branch)=>i*5+branch));
const plain = value=>JSON.parse(JSON.stringify(value));
const frozen=value=>{if(value&&typeof value==='object'){assert.ok(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}};


const q=(fixture,selector)=>fixture.root.querySelector(selector);
const qa=(fixture,selector)=>fixture.root.querySelectorAll(selector);
const toggle=(fixture,branch=0)=>q(fixture,`.cm-dex-conditions__toggle[data-condition-branch="${branch}"]`);
const panelFor=(fixture,button)=>fixture.document.getElementById(button.getAttribute('aria-controls'));
const toggleSnapshot=fixture=>({art:fixture.calls.art.length,select:[...fixture.calls.select],rename:[...fixture.calls.rename],leave:fixture.calls.leave,input:q(fixture,'input'),detail:q(fixture,'.cm-vs2-database__detail'),title:q(fixture,'h2'),routes:qa(fixture,'.cm-dex-routes__target')});
function assertNoToggleSideEffects(fixture,before){
  assert.equal(fixture.calls.art.length,before.art);assert.deepEqual(fixture.calls.select,before.select);assert.deepEqual(fixture.calls.rename,before.rename);assert.equal(fixture.calls.leave,before.leave);
  assert.equal(q(fixture,'input'),before.input);assert.equal(q(fixture,'.cm-vs2-database__detail'),before.detail);assert.equal(q(fixture,'h2'),before.title);assert.deepEqual(qa(fixture,'.cm-dex-routes__target'),before.routes);fixture.assertUnchanged();
}

test('real projectDatabase joins all 477 exact branches; original route and book field contracts remain intact; native inputs and results are frozen',()=>{
  const snapshot=JSON.stringify(lifecycle);deepFreeze(lifecycle);let count=0;
  for(let i=0;i<lifecycle.rules.length;i++){
    const source=i+8;const options=deepFreeze({registeredSpecies:[...allRegistered],evolutionBranches:[...allOffsets],selectedSpeciesIndex:source});
    const result=projectDatabase(options),originalRoutes=projectDatabaseEvolutionRoutes(source,{sourceRegistered:true,registeredSpecies:allRegistered,evolutionBranches:allOffsets});frozen(result);
    assert.deepEqual(Object.keys(result).sort(),['slotCount','eggCount','regularCount','registeredCount','unlockEvidence','entries','selected'].sort());
    assert.equal(result.slotCount,218);assert.equal(result.eggCount,0);assert.equal(result.regularCount,218);assert.equal(result.registeredCount,216);assert.equal(result.entries.length,218);
    assert.ok(result.entries.filter(e=>[229,230].includes(e.speciesIndex)).every(e=>e.state==='UNDISCOVERED'));
    assert.equal(result.selected.speciesIndex,source);assert.equal(result.selected.state,'REGISTERED');assert.deepEqual(plain(result.selected.instances),[]);
    assert.deepEqual(Object.keys(result.selected).sort(),['bookOrdinal','speciesIndex','speciesId','displayName','kind','state','source','instanceCount','identityEvidence','instances','evolutionRoutes'].sort());
    const nativeRoutes=result.selected.evolutionRoutes.filter(route=>!route.productRouteId);
    assert.equal(nativeRoutes.length,lifecycle.rules[i].length);
    for(const route of result.selected.evolutionRoutes.filter(route=>route.productRouteId)){
      assert.equal(route.conditions,null);assert.equal(route.legacyBranchOffset,null);assert.equal(route.historyState,'NOT_RECORDED');assert.equal(route.revealed,false);
    }
    nativeRoutes.forEach((route,branch)=>{
      const {conditions,...unchanged}=route;assert.deepEqual(plain(unchanged),plain(originalRoutes[branch]));
      const expected=projectDatabaseEvolutionConditions(source,branch,{sourceRegistered:true,registeredSpecies:allRegistered,evolutionBranches:allOffsets});
      assert.deepEqual(plain(conditions),plain(expected));assert.deepEqual(plain(conditions.comparison),{state:'NOT_COMPARED',reason:'NO_INDIVIDUAL_CONTEXT'});
      const native=nativeEvolutionRequirements(lifecycle.rules[i][branch]);for(const row of conditions.conditions)if(row.thresholdIndex>=11&&row.thresholdIndex<=21)assert.equal(row.value,native.stats[row.thresholdIndex-11].minimum);
      frozen(conditions);count++;
    });
  }
  assert.equal(count,477);assert.equal(JSON.stringify(lifecycle),snapshot);
});

test('exact source8/history0/registered target20 is required; unknown, target-only and contradictory histories emit no condition DOM or aria',()=>{
  for(const spec of [
    {registeredSpecies:[8,20],evolutionBranches:[]},
    {registeredSpecies:[20],evolutionBranches:[0],collection:[]},
    {registeredSpecies:[8],evolutionBranches:[0],collection:[]},
    {registeredSpecies:[8,20],evolutionBranches:[5]},
    {registeredSpecies:[8,20],evolutionBranches:[99999]}
  ]){
    const f=makeView(spec);for(const route of f.frame().database.selected.evolutionRoutes)assert.equal(route.conditions,null);
    assert.equal(qa(f,'.cm-dex-conditions__toggle').length,0);assert.equal(qa(f,'.cm-dex-conditions__panel').length,0);
    assert.doesNotMatch(JSON.stringify(serializeControlledNode(f.root)),/DEX_CONDITION_|conditionBranch|aria-controls|MACHINE_ATTRIBUTE/);f.assertUnchanged();f.dispose();
  }
  const f=makeView();assert.ok(f.frame().database.selected.evolutionRoutes[0].conditions);assert.ok(toggle(f));
  assert.equal(qa(f,'.cm-dex-conditions__toggle').length,1);assert.equal(qa(f,'.cm-dex-conditions__panel').length,1);
  assert.ok(f.frame().database.selected.evolutionRoutes.slice(1).every(route=>route.conditions===null));f.dispose();
});

test('controls are sibling native buttons; aria references are linked; disclosure changes no route intents, art loads or nickname node',()=>{
  const f=makeView(),button=toggle(f),panel=panelFor(f,button),before=toggleSnapshot(f),input=q(f,'input');
  input.value='Still editing';input.focus();
  assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');assert.equal(button.dataset.conditionBranch,'0');assert.equal(button.getAttribute('aria-expanded'),'false');
  assert.equal(panel.tagName,'SECTION');assert.equal(panel.getAttribute('aria-labelledby'),button.id);assert.ok(button.id);assert.ok(panel.hidden);assert.equal(panel.childNodes.length,0);
  assert.equal(button.parentNode,q(f,'.cm-dex-routes__target').parentNode);assert.equal(panel.parentNode,button.parentNode);
  for(const item of qa(f,'button'))assert.equal(item.querySelectorAll('button').length,0);
  button.focus();button.click();
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(panel.hidden,false);assert.ok(panel.childNodes.length>0);assert.equal(f.document.activeElement,button);
  assert.equal(input.value,'Still editing');assertNoToggleSideEffects(f,before);
  const list=panel.querySelector('dl.cm-dex-conditions__list');assert.ok(list);
  const rows=list.querySelectorAll('div.cm-dex-conditions__row');assert.equal(rows.length,1);assert.equal(rows[0].children[0].tagName,'DT');assert.equal(rows[0].children[1].tagName,'DD');
  button.click();assert.equal(button.getAttribute('aria-expanded'),'false');assert.ok(panel.hidden);assert.equal(panel.childNodes.length,0);assert.equal(f.document.activeElement,button);assertNoToggleSideEffects(f,before);f.dispose();
});

test('only one branch stays expanded; old panels are emptied on branch/species/close/dispose; late old toggles cannot reopen',()=>{
  const f=makeView({registeredSpecies:allRegistered,evolutionBranches:[0,1,2]});
  const first=toggle(f,0),second=toggle(f,1),firstPanel=panelFor(f,first),secondPanel=panelFor(f,second);
  first.click();second.click();assert.ok(firstPanel.hidden);assert.equal(firstPanel.childNodes.length,0);assert.equal(first.getAttribute('aria-expanded'),'false');assert.equal(secondPanel.hidden,false);
  f.select(20);assert.equal(secondPanel.childNodes.length,0);assert.ok(secondPanel.hidden);assert.equal(second.getAttribute('aria-expanded'),'false');second.click();assert.equal(secondPanel.childNodes.length,0);assert.ok(secondPanel.hidden);
  f.select(8);const closeToggle=toggle(f),closePanel=panelFor(f,closeToggle);closeToggle.click();q(f,'.cm-vs2-footer button').click();assert.equal(f.frame().database.selected,null);assert.equal(closePanel.childNodes.length,0);assert.ok(closePanel.hidden);closeToggle.click();assert.equal(closePanel.childNodes.length,0);
  f.select(8);const deadToggle=toggle(f),deadPanel=panelFor(f,deadToggle);deadToggle.click();f.dispose();assert.equal(deadPanel.childNodes.length,0);assert.ok(deadPanel.hidden);deadToggle.click();assert.equal(deadPanel.childNodes.length,0);assert.equal(f.root.childNodes.length,0);assert.equal(f.listeners.get('resize').size,0);f.assertUnchanged();
});

test('resize preserves nickname input, expanded content identity, focus and list/detail nodes without repainting artwork',()=>{
  const f=makeView(),button=toggle(f);button.click();const panel=panelFor(f,button),nodes=[...panel.childNodes],before=toggleSnapshot(f),input=q(f,'input'),count=panel.replaceCount;
  input.value='Uncommitted edit';input.focus();
  for(const [w,h] of [[1280,800],[390,844],[1366,768],[844,390]]){
    f.resize(w,h);assert.equal(toggle(f),button);assert.equal(panelFor(f,button),panel);assert.deepEqual(panel.childNodes,nodes);assert.equal(panel.replaceCount,count);assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(input.value,'Uncommitted edit');assert.equal(f.document.activeElement,input);assertNoToggleSideEffects(f,before);
  }f.dispose();
});

test('fixture-simulated Enter/Space activate real buttons; existing Escape/back and target navigation intents remain intact',()=>{
  const f=makeView(),button=toggle(f),panel=panelFor(f,button);
  simulateButtonKeyActivation(button,'Enter');assert.equal(panel.hidden,false);assert.equal(f.document.activeElement,button);
  simulateButtonKeyActivation(button,' ');assert.equal(panel.hidden,true);assert.equal(f.document.activeElement,button);
  const target=qa(f,'.cm-dex-routes__target')[0];target.click();assert.equal(f.calls.select.at(-1),20);assert.equal(f.frame().database.selected.speciesIndex,20);assert.equal(f.document.activeElement,q(f,'h2'));
  f.root.dispatchEvent(new ControlledEvent('keydown',{key:'Escape'}));assert.equal(f.calls.select.at(-1),null);assert.equal(f.frame().database.selected,null);
  f.root.dispatchEvent(new ControlledEvent('keydown',{key:'Escape'}));assert.equal(f.calls.leave,1);f.assertUnchanged();f.dispose();
});

test('all-zero source8 branch2 keeps lifetime-only and no-numeric copy; no profile is compared',()=>{
  const f=makeView({registeredSpecies:allRegistered,evolutionBranches:[2]});
  const branch=f.frame().database.selected.evolutionRoutes[2].conditions;assert.equal(branch.lifetimeOnly,true);assert.deepEqual(plain(branch.conditions),[]);assert.deepEqual(plain(branch.comparison),{state:'NOT_COMPARED',reason:'NO_INDIVIDUAL_CONTEXT'});
  const button=toggle(f,2);button.click();const panel=panelFor(f,button);assert.equal(panel.querySelectorAll('.cm-dex-conditions__row').length,0);
  assert.ok(panel.textContent.length>0);assert.doesNotMatch(panel.textContent,/DEX_CONDITION_|LIFETIME_ONLY|NOT_COMPARED/);f.assertUnchanged();f.dispose();
});

test('initial artwork requests match source plus each existing target; toggles preserve serialized route controls and add no art loads',()=>{
  const candidate=makeView({registeredSpecies:allRegistered,evolutionBranches:[0,1,2]});
  const selected=candidate.frame().database.selected;
  assert.deepEqual(candidate.calls.art.map(x=>x.speciesIndex),[selected.speciesIndex,...selected.evolutionRoutes.map(r=>r.targetSpeciesIndex)]);
  const routeNodes=qa(candidate,'.cm-dex-routes__target');const controls=routeNodes.map(serializeControlledNode);
  const initial=candidate.calls.art.length;
  for(const button of qa(candidate,'.cm-dex-conditions__toggle')){button.click();button.click();}
  assert.equal(candidate.calls.art.length,initial);assert.deepEqual(qa(candidate,'.cm-dex-routes__target'),routeNodes);assert.deepEqual(routeNodes.map(serializeControlledNode),controls);candidate.assertUnchanged();candidate.dispose();
});

test('controlled global/storage/source save and RNG traps are active, while read-only rendering and toggling leave inputs unchanged',()=>{
  const f=makeView();const button=toggle(f);button.click();button.click();f.assertUnchanged();
  for(const probe of [()=>f.context.Math.random(),()=>f.context.localStorage.getItem,()=>f.context.sessionStorage.setItem,()=>f.source.save,()=>f.source.rng,()=>f.source.intents.save()])assert.throws(probe,/FORBIDDEN_/);
  assert.equal(f.calls.forbidden.length,6);assert.equal(JSON.stringify(f.input),f.inputSnapshot);f.dispose();
});

const conditionKeys=[
  'DEX_CONDITIONS','DEX_CONDITIONS_TOGGLE','DEX_CONDITIONS_RULES_ONLY','DEX_CONDITIONS_LIFETIME','DEX_CONDITIONS_NO_NUMERIC','DEX_CONDITIONS_LIMITS',
  'DEX_CONDITIONS_GTE','DEX_CONDITIONS_LTE','DEX_CONDITIONS_PERCENT','DEX_CONDITIONS_BATTLES','DEX_CONDITIONS_TIMES',
  ...DATABASE_EVOLUTION_CONDITION_DESCRIPTORS.map(d=>`DEX_CONDITION_${d.id}`)
];
function expectedValue(row){
  const unitKey={PERCENT:'DEX_CONDITIONS_PERCENT',BATTLES:'DEX_CONDITIONS_BATTLES',TIMES:'DEX_CONDITIONS_TIMES'}[row.unit];
  const value=unitKey?uiText(unitKey,{value:row.value,count:row.value}):String(formatNumber(row.value));
  return uiText(row.operator==='LTE'?'DEX_CONDITIONS_LTE':'DEX_CONDITIONS_GTE',{value});
}

test('five real locale dictionaries own all 37 condition keys and format labels, branch aria, bounds, percent and singular/plural units without raw keys',async()=>{
  assert.equal(conditionKeys.length,37);assert.equal(new Set(conditionKeys).size,37);
  const {UI_COPY_EN}=await import('../src/championship/text/uiText.en.js');
  const {UI_COPY_JA}=await import('../src/championship/text/uiText.ja.js');
  const {UI_COPY_TH}=await import('../src/championship/text/uiText.th.js');
  const {UI_COPY_VI}=await import('../src/championship/text/uiText.vi.js');
  const dictionaries={'zh-Hant':UI_COPY,en:UI_COPY_EN,ja:UI_COPY_JA,th:UI_COPY_TH,vi:UI_COPY_VI};
  const expectedUnits={
    'zh-Hant':['至少 20','至多 3','70%','1 場','2 場','1 次','2 次'],
    en:['At least 20','At most 3','70%','1 battle','2 battles','1 time','2 times'],
    ja:['20 以上','3 以下','70%','1 戦','2 戦','1 回','2 回'],
    th:['อย่างน้อย 20','ไม่เกิน 3','70%','1 ครั้ง','2 ครั้ง','1 ครั้ง','2 ครั้ง'],
    vi:['Ít nhất 20','Tối đa 3','70%','1 trận','2 trận','1 lần','2 lần']
  };
  for(const [locale,dictionary] of Object.entries(dictionaries)){
    setLocale(locale);
    assert.deepEqual(Object.keys(dictionary).filter(key=>/^DEX_CONDITION/.test(key)).sort(),[...conditionKeys].sort());
    for(const key of conditionKeys){assert.ok(Object.hasOwn(dictionary,key),`${locale}:${key}`);const text=uiText(key,{branch:1,value:20,count:20});assert.notEqual(text,key);assert.doesNotMatch(text,/DEX_CONDITION|\{(?:branch|value|count)\}/);}
    const values=[uiText('DEX_CONDITIONS_GTE',{value:20}),uiText('DEX_CONDITIONS_LTE',{value:3}),uiText('DEX_CONDITIONS_PERCENT',{value:70}),
      ...[1,2].map(value=>uiText('DEX_CONDITIONS_BATTLES',{value,count:value})),...[1,2].map(value=>uiText('DEX_CONDITIONS_TIMES',{value,count:value}))];
    assert.deepEqual(values,expectedUnits[locale]);
    for(const [source,branch] of [[8,0],[8,2],[20,0],[43,1],[73,0],[22,2]]){
      const f=makeView({locale,selectedSpeciesIndex:source,registeredSpecies:allRegistered,evolutionBranches:[(source-8)*5+branch]});
      const button=toggle(f,branch);assert.ok(button,`${locale}:${source}:${branch}`);assert.equal(button.textContent,uiText('DEX_CONDITIONS'));assert.equal(button.getAttribute('aria-label'),uiText('DEX_CONDITIONS_TOGGLE',{branch:branch+1}));
      button.click();const panel=panelFor(f,button),model=f.frame().database.selected.evolutionRoutes[branch].conditions;
      const rows=panel.querySelectorAll('.cm-dex-conditions__row');assert.equal(rows.length,model.conditions.length);
      rows.forEach((node,i)=>{assert.equal(node.querySelector('dt').textContent,uiText(`DEX_CONDITION_${model.conditions[i].id}`));assert.equal(node.querySelector('dd').textContent,expectedValue(model.conditions[i]));});
      const notices=panel.querySelectorAll('.cm-dex-conditions__notice').map(node=>node.textContent);
      assert.ok(notices.includes(uiText('DEX_CONDITIONS_RULES_ONLY')));assert.ok(notices.includes(uiText('DEX_CONDITIONS_LIMITS')));
      assert.equal(notices.includes(uiText('DEX_CONDITIONS_LIFETIME')),model.lifetimeOnly);assert.equal(notices.includes(uiText('DEX_CONDITIONS_NO_NUMERIC')),model.conditions.length===0);
      assert.doesNotMatch(JSON.stringify(serializeControlledNode(panel)),/DEX_CONDITION|MACHINE_ATTRIBUTE|NOT_COMPARED|LIFETIME_ONLY/);
      f.assertUnchanged();f.dispose();
    }
  }
});

test('isolated synthetic native rule exercises all 26 real helper rows and actual UI formatting, including 11 converted stats and ordinary-care LTE, in five locales',async()=>{
  const {spawnSync}=await import('node:child_process');const {fileURLToPath}=await import('node:url');
  const runner=fileURLToPath(new URL('./helpers/database-conditions-ui-synthetic.mjs',import.meta.url));
  const child=spawnSync(process.execPath,[runner],{encoding:'utf8'});assert.equal(child.status,0,child.stderr||child.stdout);
  const {results,thresholds,requirements}=JSON.parse(child.stdout);assert.equal(results.length,5);
  for(const result of results){
    setLocale(result.locale);assert.equal(result.rows.length,26);assert.equal(result.model.conditions.length,26);
    assert.deepEqual(result.model.comparison,{state:'NOT_COMPARED',reason:'NO_INDIVIDUAL_CONTEXT'});
    result.model.conditions.forEach((row,index)=>{
      assert.equal(row.id,DATABASE_EVOLUTION_CONDITION_DESCRIPTORS[index].id);assert.equal(row.thresholdIndex,index);
      assert.equal(row.operator,index===25?'LTE':'GTE');
      assert.equal(row.value,index>=11&&index<=21?requirements.stats[index-11].minimum:thresholds[index]);
      if(index>=11&&index<=21)assert.equal(row.sourcePercent,thresholds[index]);
      assert.equal(result.rows[index].label,uiText(`DEX_CONDITION_${row.id}`));assert.equal(result.rows[index].value,expectedValue(row));
    });
    assert.deepEqual(result.notices,[uiText('DEX_CONDITIONS_RULES_ONLY'),uiText('DEX_CONDITIONS_LIMITS')]);
    assert.doesNotMatch(JSON.stringify(result.rows),/DEX_CONDITION|NATIVE_TARGET_CURVE/);
  }
});

test('same-species relabel keeps expansion and toggle focus, replaces language text and invalidates detached toggles',()=>{
  const f=makeView({locale:'zh-Hant'});const old=toggle(f),oldPanel=panelFor(f,old);old.focus();old.click();
  setLocale('en');f.document.documentElement.lang='en';f.view.relabel();
  const current=toggle(f),panel=panelFor(f,current);assert.notEqual(current,old);assert.equal(current.getAttribute('aria-expanded'),'true');assert.equal(f.document.activeElement,current);
  assert.equal(current.textContent,'Conditions');assert.ok(panel.textContent.includes(uiText('DEX_CONDITIONS_RULES_ONLY')));
  assert.ok(oldPanel.hidden);assert.equal(oldPanel.childNodes.length,0);old.click();assert.equal(oldPanel.childNodes.length,0);assert.equal(current.getAttribute('aria-expanded'),'true');
  f.assertUnchanged();f.dispose();
});

test('CSS source contracts provide 44px minimum controls, wrap-safe single-column rows, visible focus and hidden panels; no actual dimensions are asserted',()=>{
  const css=readFileSync(new URL('../src/championship/app/vs2Styles.css',import.meta.url),'utf8');
  const block=selector=>{const start=css.indexOf(`${selector} {`);assert.ok(start>=0,selector);return css.slice(start,css.indexOf('}',start)+1);};
  const control=block('.cm-dex-conditions__toggle');assert.match(control,/min-width:\s*44px/);assert.match(control,/min-height:\s*44px/);assert.match(control,/max-width:\s*100%/);assert.match(control,/overflow-wrap:\s*anywhere/);assert.match(control,/white-space:\s*normal/);
  assert.match(block('.cm-dex-conditions__toggle:focus-visible'),/outline:/);assert.match(block('.cm-dex-conditions__panel[hidden]'),/display:\s*none/);
  assert.match(block('.cm-dex-conditions__panel'),/overflow-wrap:\s*anywhere/);assert.match(block('.cm-dex-conditions__row'),/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(block('.cm-dex-conditions__panel'),/overflow(?:-y)?:\s*(?:auto|scroll)/);
});

test('leaving and returning to a database frame rebuilds usable controls; old events and post-dispose render cannot restore stale panels',()=>{
  const f=makeView(),button=toggle(f),panel=panelFor(f,button);button.click();const artCount=f.calls.art.length;
  f.view.render({screen:'RAISING_HOME'});assert.ok(panel.hidden);assert.equal(panel.childNodes.length,0);assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(f.calls.art.length,artCount);
  button.click();assert.ok(panel.hidden);assert.equal(panel.childNodes.length,0);
  f.view.render(f.frame());const returned=toggle(f),returnedPanel=panelFor(f,returned);assert.notEqual(returned,button);assert.equal(returned.getAttribute('aria-expanded'),'false');returned.click();assert.equal(returnedPanel.hidden,false);
  button.click();assert.equal(panel.childNodes.length,0);assert.ok(panel.hidden);assert.equal(returned.getAttribute('aria-expanded'),'true');assert.equal(returnedPanel.hidden,false);
  f.dispose();f.view.render(f.frame());assert.equal(f.root.childNodes.length,0);button.click();assert.equal(panel.childNodes.length,0);f.assertUnchanged();
});

test('real host-imported runtime/helpers and VM screen execution never touch host RNG, storage, network, timers or unprovided profile/save context',()=>{
  let attempts=0;const fail=()=>{attempts++;throw new Error('HOST_SIDE_EFFECT_TRAP');};
  const names=['localStorage','sessionStorage','fetch','setTimeout','setInterval','requestAnimationFrame'];
  const prior=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const random=Math.random;
  try{
    for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:name.endsWith('Storage')?new Proxy({}, {get:fail,set:fail}):fail});
    Math.random=fail;
    const options={registeredSpecies:[8,20],evolutionBranches:[0],selectedSpeciesIndex:8};
    for(const name of ['profile','nativeProfile','save','rng'])Object.defineProperty(options,name,{get:fail});
    Object.freeze(options);const projected=projectDatabase(options);assert.equal(projected.selected.evolutionRoutes[0].conditions.comparison.state,'NOT_COMPARED');
    const f=makeView();const button=toggle(f);button.click();button.click();f.resize(1280,800);f.assertUnchanged();f.dispose();
    assert.equal(attempts,0);
    for(const probe of [()=>Math.random(),()=>globalThis.localStorage.getItem,()=>globalThis.sessionStorage.setItem,()=>fetch(),()=>setTimeout(),()=>setInterval(),()=>requestAnimationFrame(),()=>options.nativeProfile,()=>options.save])assert.throws(probe,/HOST_SIDE_EFFECT_TRAP/);
    assert.equal(attempts,9);
  }finally{
    Math.random=random;for(const [name,descriptor] of prior)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  }
});


test('production product route conditions use their independent history and never fabricate native offsets',()=>{
  const expected=[[139,229,'139:211:229'],[143,229,'143:211:229'],[144,230,'144:222:230']];
  for(const [source,target,id] of expected){
    const input={registeredSpecies:[...allRegistered,229,230],evolutionBranches:[...allOffsets],selectedSpeciesIndex:source};
    const before=JSON.stringify(input),unrecorded=projectDatabase(input).selected.evolutionRoutes.find(r=>r.productRouteId===id);
    assert.equal(unrecorded.targetSpeciesIndex,target);assert.equal(unrecorded.conditions,null);assert.equal(unrecorded.legacyBranchOffset,null);
    const recorded=projectDatabase({...input,productEvolutionBranches:[id]}).selected.evolutionRoutes.find(r=>r.productRouteId===id);
    assert.equal(recorded.historyState,'RECORDED');assert.equal(recorded.revealed,true);assert.ok(recorded.conditions);
    assert.equal(recorded.conditions.comparison.state,'NOT_COMPARED');frozen(recorded.conditions);
    assert.equal(JSON.stringify(input),before);
  }
});
