import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY, normalizeBattleTactics, BATTLE_TACTIC_DEFAULT} from '../src/championship/app/championshipStandaloneSave.js';
import {buildOwnedBattleCreature} from '../src/championship/battle/battleParty.js';
import {originalPersonalityFields} from '../src/championship/app/battleRosterSource.js';
import {createBattleSelectView} from '../src/championship/app/vs5Screens.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';

// Battle plan (作戰方針), Owner 2026-10-28. The ROM team-setup menu stores the
// chosen row: 0 スペシャルアタック, 1 ノーマルアタック (default), 2 サポート
// (docs/reports/battle-tactics-policy-trace-2026-10-28/TRACE_ZH_TW.md).

const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));

function harness(){
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const cages=read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make=()=>createChampionshipStandaloneApp({storage,locks:null,cages,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    rngClock:()=>({hour:13,minute:20,second:50}),now:()=>'2026-09-15T00:00:00.000Z'});
  return {data,cages,make};
}
async function qaSaveApp(){
  const {data,cages,make}=harness();
  const first=make();await first.newGame();first.save();
  const text=createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)),{cageIds:cages.map(entry=>entry.cageId)});
  await first.dispose();data.set(CHAMPIONSHIP_MODERN_SAVE_KEY,text);
  const app=make();await app.continueGame();
  return {app,data,make};
}

test('the stored plan keeps only the two non-default rows of a well-formed id',()=>{
  assert.equal(BATTLE_TACTIC_DEFAULT,1);
  assert.deepEqual(normalizeBattleTactics({'championship:2026:instance:0001':0,'championship:2026:instance:0002':2,
    'championship:2026:instance:0003':1,'championship:2026:instance:0004':3,'championship:2026:instance:0005':'2','bad id':0}),
    {'championship:2026:instance:0001':0,'championship:2026:instance:0002':2});
  for(const value of [null,undefined,[],'x',7])assert.deepEqual(normalizeBattleTactics(value),{});
});

test('a plan is chosen, saved, reloaded and carried into Free Battle and Practice only',async()=>{
  const {app,data,make}=await qaSaveApp();
  let reopened=null;
  try{
    const ready=(await app.getBattlePartyCandidates(null)).filter(entry=>entry.admission.ok);
    assert.ok(ready.length>=2);
    assert.ok(ready.every(entry=>entry.tactic===1),'every partner starts on ノーマルアタック');
    const [a,b]=ready.map(entry=>entry.instanceId);
    assert.equal(app.setBattleTactic(a,0).ok,true);
    assert.equal(app.setBattleTactic(b,2).ok,true);
    assert.equal(app.setBattleTactic(a,3).reason,'TACTIC_INVALID','policy 3 is never offered by the menu');
    assert.equal(app.setBattleTactic('not-in-roster',0).reason,'UNKNOWN_INDIVIDUAL');
    assert.deepEqual((await app.getBattlePartyCandidates(null)).filter(e=>[a,b].includes(e.instanceId)).map(e=>e.tactic),[0,2]);

    app.openBattle();
    const practice=await app.preparePracticeBattle([[a],[b]]);
    assert.equal(practice.ok,true,practice.message);
    assert.deepEqual(practice.parties.map(team=>team[0].tactic),[0,2]);
    const match=app.openFreeBattle()[0];
    const free=await app.prepareFreeBattle(match.id,[b]);
    assert.equal(free.ok,true,free.message);
    assert.equal(free.individuals[0].tactic,2);
    // Each row reaches the battle as the original policy, which the ORIGINAL
    // personality wiring keeps as the combatant profile.
    for(const individual of [practice.parties[0][0],free.individuals[0]]){
      const creature=buildOwnedBattleCreature(individual);
      assert.equal(creature.tactic,individual.tactic);
      const wired=originalPersonalityFields({...creature,personality:creature.personality??0});
      assert.equal(wired.fields.profileIndex,individual.tactic);
    }
    // Modes that do not read the plan keep their individuals unchanged.
    const link=await app.createTeamPassword([a]);
    assert.equal(link.ok,true,link.message);

    app.save();
    assert.deepEqual(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).progression.battleTactics,{[a]:0,[b]:2});
    await app.dispose();
    reopened=make();await reopened.continueGame();
    assert.equal(reopened.getBattleTactic(a),0);
    assert.equal(reopened.getBattleTactic(b),2);
    assert.equal(reopened.setBattleTactic(a,1).ok,true);
    reopened.save();
    assert.deepEqual(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).progression.battleTactics,{[b]:2},'the default is not stored');
  }finally{await (reopened??app).dispose();}
});

// A small DOM boundary for the picker; layout is checked in the browser.
class Node {
  constructor(tagName){this.tagName=tagName;this.children=[];this.dataset={};this.attributes={};this.listeners={};this.textContent='';this.className='';this.hidden=false;this.value='';
    this.classList={add:name=>{this.className+=` ${name}`;}};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this.attributes[name]=value;}
  getAttribute(name){return this.attributes[name]??null;}
  addEventListener(name,listener){this.listeners[name]=listener;}
  click(){if(!this.disabled)this.listeners.click?.();}
}
const all=node=>[node,...node.children.flatMap(all)];
const byClass=(root,name)=>all(root).filter(node=>node.className.split(' ').includes(name));

test('Practice rows and chosen Free Battle partners offer the three plans in ROM order',async t=>{
  const before=globalThis.document;globalThis.document={createElement:tag=>new Node(tag),createDocumentFragment:()=>new Node('fragment')};
  t.after(()=>{globalThis.document=before;});
  const candidates=[{instanceId:'p1',displayName:'甲',tactic:1,admission:{ok:true}},{instanceId:'p2',displayName:'乙',tactic:2,admission:{ok:true}}];
  const writes=[];
  const root=new Node('main');
  const view=createBattleSelectView({root,matches:[],onEnter:()=>({ok:true}),onExit(){},menuCopy:{menu:'對戰選單',kicker:'對戰',chooseMatch:'選擇對戰',availableMatches:'目前可用的對戰',noMatch:'沒有對戰'},
    getModeMatches:async()=>[{recordIndex:'single:0',title:'單隻對戰 — 甲',entryFee:0,payout:50}],
    getPartySelection:async()=>({candidates,limit:3}),getPracticeSelection:async()=>({candidates}),
    setBattleTactic:(id,value)=>{writes.push([id,value]);return {ok:true};},
    mountCube:({onSelect})=>{globalThis.__select=onSelect;return {dispose(){}};}});
  globalThis.__select('PRACTICE_BATTLE');await new Promise(r=>setTimeout(r,0));
  const selects=byClass(root,'cm-vs5-tactic__select');
  assert.equal(selects.length,2);
  assert.deepEqual(selects[0].children.map(o=>o.textContent),['必殺技優先','普通攻擊','支援優先']);
  assert.deepEqual(selects.map(s=>s.value),['1','2']);
  selects[0].value='0';selects[0].listeners.change();
  assert.deepEqual(writes,[['p1',0]]);
  // Practice keeps the A / B keys as the row's only buttons.
  assert.deepEqual(byClass(root,'cm-vs5-practice-member').map(row=>row.children.filter(c=>c.tagName==='button').length),[2,2]);

  globalThis.__select('FREE_BATTLE');await new Promise(r=>setTimeout(r,0));
  byClass(root,'cm-vs5-match__enter')[0].click();await new Promise(r=>setTimeout(r,0));
  const box=byClass(root,'cm-vs5-tactics')[0];
  assert.equal(box.hidden,true,'no plan rows before a partner is chosen');
  all(root).find(node=>node.dataset.instanceId==='p2').click();
  assert.equal(box.hidden,false);
  assert.deepEqual(byClass(box,'cm-vs5-tactic__select').map(s=>s.value),['2']);
  view.dispose();delete globalThis.__select;
});
