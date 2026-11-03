// Owner 2026-11-03 phone test (six fixes): one land key with climbing diamond prices, gachapon
// items in the bag with use / mount keys, a collect that really pays the toolbar's tools, and
// greetings only on a real meeting once passages link the cages.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY} from '../src/championship/app/friendsPlaytestPolicy.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY} from '../src/championship/app/championshipStandaloneSave.js';
import {LAND_EXPANSION,landExpansionPrice} from '../src/championship/gacha/diamondRewards.js';
import {BACKPACK_TABS,backpackTabs,createBackpackPanel} from '../src/championship/app/ranchBackpack.js';
import {pendingStrollEntries} from '../src/championship/raising/ranchPartnerLife.js';

const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const source=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const species=read('src/data/championship/catalogs/creature-species.r1.json');
const cages=read('docs/contracts/championship/raising-home-presentation.v1.json').cages;

function harness({seed=null,partnerLife=false}={}){
  const data=new Map(seed?[[CHAMPIONSHIP_MODERN_SAVE_KEY,JSON.stringify(seed)]]:[]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  const make=()=>createChampionshipStandaloneApp({playtestPolicy:FRIENDS_PLAYTEST_POLICY,storage,locks:null,cages,catalog:species,partnerLife});
  return {data,make};
}

// A small document: enough of the DOM for the bag panel (elements, classes, data-*, clicks, queries).
function fakeDocument(){
  const camel=name=>name.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  function make(tag){
    const node={tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},listeners:{},className:'',hidden:false,disabled:false,parent:null,_text:'',
      get textContent(){return this._text+this.children.map(c=>c.textContent).join('');},
      set textContent(v){this._text=String(v);this.children=[];},
      setAttribute(k,v){this.attributes[k]=String(v);if(k.startsWith('data-'))this.dataset[camel(k)]=String(v);},
      getAttribute(k){return k in this.attributes?this.attributes[k]:null;},
      removeAttribute(k){delete this.attributes[k];},
      addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);},
      dispatchEvent(event){for(const fn of this.listeners[event.type]??[])fn(event);return true;},
      click(){if(!this.disabled)this.dispatchEvent({type:'click'});},
      append(...items){for(const item of items){if(typeof item==='string'){const t=make('#text');t._text=item;item=t;}item.parent=this;this.children.push(item);}},
      prepend(...items){const kids=this.children;this.children=[];this.append(...items);this.children.push(...kids);},
      replaceChildren(...items){this.children=[];this.append(...items);},
      matches(selector){
        const m=/^(?:\.([\w-]+))?(?:\[([\w-]+)="([^"]*)"\])?$/.exec(selector);if(!m)throw new Error('selector '+selector);
        const [,cls,attr,value]=m;
        if(cls&&!this.className.split(/\s+/).includes(cls))return false;
        if(attr){const v=attr.startsWith('data-')?this.dataset[camel(attr)]:this.attributes[attr];if(v!==value)return false;}
        return true;
      },
      querySelectorAll(selector){const out=[];const walk=n=>{for(const c of n.children){if(c.tagName!=='#TEXT'&&c.matches(selector))out.push(c);walk(c);}};walk(this);return out;},
      querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
    };
    return node;
  }
  return {createElement:make,createElementNS:(_ns,tag)=>make(tag)};
}

test('the land key: one per editor, the census capsule reads land tier, prices climb 200 → 2,200', () => {
  assert.deepEqual(LAND_EXPANSION.prices,[200,400,600,800,1000,1200,1600,2200]);
  assert.equal(LAND_EXPANSION.prices.reduce((a,b)=>a+b,0),8000);
  assert.deepEqual([20,30,40,50,60,70,80,90].map(landExpansionPrice),LAND_EXPANSION.prices);
  assert.equal(landExpansionPrice(100),null);
  // The rank capsule (vs4Screens) no longer builds a land key -- the hex board's key beside 可用土地 is the only one.
  const census=source('src/championship/app/vs4Screens.js');
  assert.doesNotMatch(census,/cm-vs2-cage-rank__expand|dataset\.landExpand/);
  assert.match(census,/土地階級 \{tier\} · 已用 \{used\} \/ \{total\} 格/);
  const board=source('src/championship/app/hexWorldEditor.js');
  // One key node, swapped between the buy key and the crowned closed key; never a second one.
  assert.equal(board.split('landKeyNode = landKey()').length-1,1);
  assert.equal(board.split('toolbar.append(landKeyNode)').length-1,1);
  assert.match(board,/cost = cage\.land\?\.price/);
  assert.doesNotMatch(board,/\(1000\)\.toLocaleString/,'no fixed 1,000 price on the key');
});

test('app: the land frame quotes the next step and the bought step is what was paid', async () => {
  const h=harness();const app=h.make();
  try{
    await app.newGame();app.openCageEdit();
    const seen=[];
    for(let i=0;i<8;i+=1){
      const frame=app.getCageEditFrame(),before=frame.testDiamonds;
      seen.push(frame.land.price);
      assert.equal(app.expandRanchLand().ok,true);
      assert.equal(before-app.getCageEditFrame().testDiamonds,frame.land.price);
      assert.equal(app.getCageEditFrame().lastVerdict.price,frame.land.price);
    }
    assert.deepEqual(seen,[200,400,600,800,1000,1200,1600,2200]);
    assert.equal(app.getCageEditFrame().land.max,true);assert.equal(app.getCageEditFrame().land.tier,8);
  }finally{await app.dispose();}
});

test('bag: gachapon chips, metals and cores all appear in the four tabs, each with a use / mount key', async (t) => {
  const h=harness();const app=h.make();
  try{
    await app.newGame();
    assert.equal(app.grantGachaTickets(20,'TEST').ok,true);
    app.openShop();
    assert.equal(app.gachaPull('PREMIUM',10).ok,true);
    assert.equal(app.gachaPull('PREMIUM',10).ok,true);
    assert.equal(app.grantAutomationItem('auto:feed-core',1,'TEST').ok,true);
    assert.equal(app.grantAutomationItem('auto:clean-core',1,'TEST').ok,true);
    const gacha=app.getCyberGachaFrame(),tabs=backpackTabs(app.getShopFrame(),gacha);
    assert.deepEqual(BACKPACK_TABS.map(t=>t.id),['supplies','chips','metals','automation']);
    for(const chip of gacha.chips.filter(c=>c.owned>0))assert.ok(tabs.chips.some(i=>i.id===chip.id),chip.id);
    for(const metal of gacha.metals.filter(m=>m.owned>0))assert.ok(tabs.metals.some(i=>i.id===metal.id),metal.id);
    // The pulls may add a royal cage too; every owned automation item is listed.
    assert.deepEqual(tabs.automation.map(i=>i.id).sort(),gacha.automation.filter(i=>i.owned>0).map(i=>i.id).sort());
    for(const id of ['auto:clean-core','auto:feed-core'])assert.ok(tabs.automation.some(i=>i.id===id),id);
    assert.ok(tabs.chips.length+tabs.metals.length>0,'twenty pulls give chips or metals');
    const doc=fakeDocument(),calls=[];
    // Shared gachapon helpers (the partner nameplate) build with the global document.
    const previousDocument=globalThis.document;globalThis.document=doc;t.after(()=>{globalThis.document=previousDocument;});
    const panel=createBackpackPanel({doc,getShopFrame:()=>app.getShopFrame(),getGachaFrame:()=>app.getCyberGachaFrame(),tab:'automation',
      intents:{mountCore:(core,cage)=>{calls.push(['mount',core,cage]);return app.gachaMountCore(core,cage);},useItem:(...a)=>app.gachaUseItem(...a)}});
    for(const tab of ['chips','metals','automation']){
      panel.element.querySelector(`.cm-backpack__tab[data-tab="${tab}"]`).click();
      const rows=panel.element.querySelectorAll('.cm-backpack__item');
      assert.equal(rows.length,tabs[tab].length,tab);
      assert.equal(panel.element.querySelectorAll('.cm-backpack__use').length,rows.length,`${tab}: every row has its key`);
    }
    // Mount the feed core on the first placed cage straight from the bag.
    panel.element.querySelector('.cm-backpack__use[data-use="auto:feed-core"]').click();
    const cage=panel.element.querySelector('.cm-backpack__cage');
    assert.ok(cage,'the placed cages are listed');
    cage.click();
    assert.equal(calls.length,1);
    assert.equal(panel.element.querySelector('.cm-backpack__receipt').dataset.ok,'true');
    assert.ok(app.getCyberGachaFrame().cages.some(c=>c.instanceId===calls[0][2]&&c.feed));
    // A metal is used on a partner from its row.
    panel.element.querySelector('.cm-backpack__tab[data-tab="metals"]').click();
    const metal=tabs.metals[0];
    if(metal){
      const before=app.getCyberGachaFrame().metals.find(m=>m.id===metal.id).owned;
      panel.element.querySelector(`.cm-backpack__use[data-use="${metal.id}"]`).click();
      panel.element.querySelector('.cm-backpack__choice').click();
      panel.element.querySelector('.cm-backpack__key[data-use-mode="ENHANCE"]').click();
      assert.equal(app.getCyberGachaFrame().metals.find(m=>m.id===metal.id).owned,before-1);
    }
  }finally{await app.dispose();}
});

test('the partner card, the bag and the facility editor each reach the gachapon items', () => {
  const card=source('src/championship/app/raisingHomeP1RView.js');
  assert.match(card,/使用晶片／進化金屬催化/);
  for (const line of card.split('\n').filter(l=>/companion__boost|使用晶片/.test(l)))
    assert.doesNotMatch(line,/\p{Extended_Pictographic}/u,'no system emoji on the boost key');
  assert.match(card,/portraitFallback/,'the portrait falls back to the encyclopedia thumbnail');
  assert.match(card,/cm-open-backpack/);
  const main=source('src/championship/app/main.js');
  assert.match(main,/addEventListener\('cm-open-backpack'/);
  assert.match(main,/gachaUseItem\(itemId, instanceId, options\)/);
  const editor=source('src/championship/app/hexWorldEditor.js');
  assert.match(editor,/掛載自動餵食／清掃機/);
  assert.match(editor,/source\.intents\.gachaMountCore/);
});

test('收下發現 pays waiting finds: two feed ×2 finds add 4 to the feed tool and say so', async () => {
  const seed=read('qa/championship-full-qa-save.json');seed.shop.quantities[0]=70;
  const h=harness({seed,partnerLife:true});const app=h.make();
  try{
    await app.continueGame();
    const partner=app.getRaisingInstances().map(i=>i.instanceId).find(id=>(app.getRaisingActorFrame(id)?.speciesIndex??0)>=8);
    const feed=()=>app.getShopFrame().listings.find(r=>r.shopRecordIndex===0).owned;
    assert.equal(feed(),70);
    for(let i=0;i<2;i+=1)assert.equal(app.grantStrollDiscoveryReward({partnerId:partner,reward:'feed',quantity:2}).ok,true);
    assert.equal(feed(),70,'still 70 before 收下發現');
    assert.equal(pendingStrollEntries(app.getPartnerLifeFrame().log).length,2);
    const heard=[];const stop=app.subscribePartnerLife(e=>heard.push(e));const repaint=[];const off=app.subscribeShop(f=>repaint.push(f));
    const result=app.collectRanchDiscoveries();
    assert.equal(result.ok,true,result.reason);
    assert.equal(feed(),74,'70 → 74 on collect');
    assert.equal(result.gains.feed,4);
    assert.equal(repaint.at(-1).listings.find(r=>r.shopRecordIndex===0).owned,74,'the toolbar badge source reads 74');
    assert.equal(heard.find(e=>e.kind==='collected').gains.feed,4,'the toolbar floats +4');
    stop();off();
    // The journal says when a find waits and when it was collected.
    const journal=source('src/championship/app/ranchDiscoveryJournal.js');
    assert.match(journal,/（點擊下方收下發現領取）/);assert.match(journal,/（已領取入袋）/);
    assert.doesNotMatch(journal,/同一區域內的拍檔仍會相遇/);
  }finally{await app.dispose();}
});

test('with no passage between cages, partners in one cage never greet or find on a stroll', async () => {
  const seed=read('qa/championship-full-qa-save.json');
  const h=harness({seed,partnerLife:true});const app=h.make();
  try{
    await app.continueGame();
    app.refreshRanchDiscoveries();
    const connections=app.getRaisingFrame?.()?.exploration?.connections?.length;
    const events=[];const stop=app.subscribePartnerLife(e=>events.push(e));
    if(connections===0||connections===undefined){
      for(let i=0;i<40;i+=1)app.advanceNaturalClock({frames:120});
      assert.equal(events.filter(e=>e.kind==='greeting'||e.kind==='find').length,0,'no greeting spam in a closed cage');
    }
    stop();
    // The rule itself: passages first, then a real meeting with one partner off its own cage.
    const code=source('src/championship/app/championshipStandaloneApp.js');
    assert.match(code,/if\(!\(raisingGround\?\.navigation\?\.connections\?\.length>0\)\)return;/);
    assert.match(code,/if\(!partnerOffHome\(a\)&&!partnerOffHome\(b\)\)continue;/);
  }finally{await app.dispose();}
});
