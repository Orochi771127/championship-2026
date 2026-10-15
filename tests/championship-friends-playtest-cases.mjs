import {createGateHuntPresentationSource} from '../src/championship/app/gateHuntPresentationSource.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY as policy,purchaseTestRanchRow,grantFriendsPlaytestCoins} from '../src/championship/app/friendsPlaytestPolicy.js';
import {medalCollection} from '../src/championship/app/medalCollection.js';
import {createShopRuntime} from '../src/championship/shop/shopRuntime.js';
import {listShopRecords} from '../src/championship/shop/shopCatalog.js';
import {gateAdmission} from '../src/championship/gate/gateAdmission.js';
import {listChampionshipGates} from '../src/championship/gate/gateCatalog.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
function setup(){const data=new Map();let blocked=false;const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(blocked)throw Error('DISK_FULL');data.set(k,v)},removeItem:k=>data.delete(k)};const create=(extra={})=>createChampionshipStandaloneApp({playtestPolicy:policy,storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,...extra});return {create,data,block:v=>blocked=v};}
test('new local save exact100000 coins/10000 test diamonds; spend/save/reload never regrants',async()=>{
 const h=setup();let a=h.create();try{await a.newGame();assert.equal(a.getShopFrame().bits,100000);assert.equal(a.getCageEditFrame().testDiamonds,10000);assert.deepEqual(a.getBattleBadges(),[]);assert.equal(a.getTamerRank(),0);
 const row=a.getShopFrame().listings.find(x=>x.owned<x.maxOwned&&x.unitPriceBits>0);a.openShop();const r=a.buyShopItem(row.shopRecordIndex);assert.equal(r.ok,true);const bits=a.getShopFrame().bits;assert.equal(bits,100000-row.unitPriceBits);assert.equal(a.save().phase,'SAVED');await a.dispose();a=h.create();await a.continueGame();assert.equal(a.getShopFrame().bits,bits);assert.equal(a.getCageEditFrame().testDiamonds,10000);assert.equal(a.save().phase,'SAVED');}finally{await a.dispose();}
});
test('existing save gets no automatic money or diamonds; true badges and rank persist',async()=>{const h=setup();let a=h.create({playtestPolicy:null});try{await a.newGame();a.creditBits(1234);a.setBattleBadges([0,2]);a.save();await a.dispose();a=h.create();await a.continueGame();assert.equal(a.getShopFrame().bits,1234);assert.equal(a.getCageEditFrame().testDiamonds,0);assert.deepEqual(a.getBattleBadges(),[0,2]);}finally{await a.dispose();}});
test('all shop records visible with real prices, stock, insufficiency and no free ownership',()=>{
 const shop=createShopRuntime({bits:100000,allItemsVisible:true});assert.equal(shop.getFrame().listings.length,listShopRecords().length);const before=shop.toSave();const row=listShopRecords().find(r=>before.visibility[r.shopRecordIndex]===0&&r.unitPriceBits>0&&r.maxOwned>0);assert.ok(row);const r=shop.buy(row.shopRecordIndex);assert.equal(r.ok,true);assert.equal(shop.getBits(),100000-row.unitPriceBits);assert.equal(shop.buy(row.shopRecordIndex,0).ok,false);const poor=createShopRuntime({allItemsVisible:true,bits:0});assert.equal(poor.buy(row.shopRecordIndex).reason,'INSUFFICIENT_FUNDS');assert.deepEqual(poor.toSave().quantities,createShopRuntime().toSave().quantities);assert.deepEqual(poor.toSave().cageOwned,createShopRuntime().toSave().cageOwned);
});
test('all map unlock overrides preserve exact fees and insufficient funds',()=>{for(const gate of listChampionshipGates()){let a=gateAdmission(gate,100000,{playtestUnlocks:true});assert.equal(a.canEnter,true);assert.equal(a.chargeBits,gate.entranceFeeBits);assert.equal(a.afterBits,100000-gate.entranceFeeBits);if(gate.entranceFeeBits>0)assert.equal(gateAdmission(gate,0,{playtestUnlocks:true}).reason,'INSUFFICIENT_FUNDS');}});
test('full Dex is display-only; genuine discovery and collection counts do not change',async()=>{const h=setup(),a=h.create();try{await a.newGame();const f=a.getDatabaseFrame();assert.equal(f.fullView,true);assert.ok(f.entries.every(x=>x.viewable));assert.ok(f.registeredCount<f.slotCount);assert.ok(f.entries.some(x=>x.state==='UNDISCOVERED'&&x.instanceCount===0));assert.deepEqual(a.getBattleBadges(),[]);a.save();const save=JSON.parse([...h.data.values()][0]);assert.equal(save.progression.registeredSpecies.length,0);assert.equal(save.progression.battleBadges.length,0);}finally{await a.dispose();}});
test('31 advanced medals preview only; early remain natural, existing earned retained, production off restores view',()=>{const rows=medalCollection([0],policy);assert.equal(rows.filter(x=>x.testPreview).length,31);assert.ok(rows.filter(x=>x.requiredRank<=2&&x.titleId!==0).every(x=>!x.acquired));assert.equal(rows[0].earned,true);assert.equal(rows[0].testPreview,false);assert.equal(medalCollection([],null).filter(x=>x.acquired).length,0);assert.equal(medalCollection([2],null)[2].earned,true);});
test('test diamonds purchase idempotent, bounded and never affects game coins',()=>{const g=grantFriendsPlaytestCoins(0,null,9999999);let s=g.state;for(let row=2;row<5;row++){const p=purchaseTestRanchRow(s,row);assert.equal(p.ok,true);s=p.state;assert.equal(purchaseTestRanchRow(s,row).ok,false);}assert.equal(s.diamonds,7000);assert.equal(g.bits,100000);assert.equal(purchaseTestRanchRow(null,2).reason,'INSUFFICIENT_TEST_DIAMONDS');assert.equal(purchaseTestRanchRow(s,5).ok,false);});
test('three row purchases atomically deduct1000 each, survive reload, duplicate no charge',async()=>{const h=setup();let a=h.create();try{await a.newGame();a.openCageEdit();for(let row=2;row<5;row++){const r=a.buyRanchTestRow(row);assert.equal(r.ok,true,JSON.stringify(r));const duplicate=a.buyRanchTestRow(row);assert.equal(duplicate.ok,false);}assert.equal(a.getCageEditFrame().testDiamonds,7000);assert.equal(a.getShopFrame().bits,100000);await a.dispose();a=h.create();await a.continueGame();assert.equal(a.getCageEditFrame().testDiamonds,7000);assert.deepEqual(a.getCageEditFrame().gridAccess.testUnlockedRows,[2,3,4]);}finally{await a.dispose();}});
test('failed row save rolls back entitlement and diamonds; generic retry cannot commit hidden purchase',async()=>{const h=setup(),a=h.create();try{await a.newGame();a.save();a.openCageEdit();const before=JSON.stringify(a.getCageEditFrame().gridAccess),stored=[...h.data.values()][0];h.block(true);const r=a.buyRanchTestRow(2);assert.equal(r.ok,false);assert.equal(a.getCageEditFrame().testDiamonds,10000);assert.equal(JSON.stringify(a.getCageEditFrame().gridAccess),before);h.block(false);a.savePort.retry();assert.equal([...h.data.values()][0],stored);assert.equal(a.buyRanchTestRow(2).ok,true);assert.equal(a.getCageEditFrame().testDiamonds,9000);}finally{await a.dispose();}});
test('hunt cancelled at loadout costs nothing; entry charges exactly once; field exit keeps normal no-refund',async()=>{const h=setup(),a=h.create({huntCaptureReplay:{},huntRuntimeFactory:({world})=>({world,hasPendingCaptureAnimation:()=>false,abortEnclosureStroke(){},getOnCardEntries:()=>[]})});try{await a.newGame();const gate=a.getGates().find(g=>g.entranceFeeBits>0&&g.unlockKind!==0);assert.ok(gate);a.openGate();a.selectGate(gate.gateId);a.confirmGate();assert.equal(a.getShopFrame().bits,100000);a.leaveScreen();assert.equal(a.getShopFrame().bits,100000);a.selectGate(gate.gateId);a.confirmGate();await a.beginHunt();assert.equal(a.getScreen(),'HUNT_FIELD',a.getHuntEntryError());assert.equal(a.getShopFrame().bits,100000-gate.entranceFeeBits);await a.beginHunt();assert.equal(a.getShopFrame().bits,100000-gate.entranceFeeBits);a.exitHunt();assert.equal(a.getShopFrame().bits,100000-gate.entranceFeeBits);}finally{await a.dispose();}});
test('test row purchase preserves live unconfirmed edit draft and selected module',async()=>{const h=setup(),a=h.create();try{await a.newGame();a.openCageEdit();const moduleId='championship:2026:cage:0';a.removeCagePlacement(moduleId);a.selectCageModule(moduleId);const before=a.getCageEditFrame();assert.equal(before.dirty,true);assert.equal(a.buyRanchTestRow(2).ok,true);const after=a.getCageEditFrame();assert.equal(after.dirty,true);assert.equal(after.selectedModuleId,before.selectedModuleId);assert.deepEqual(after.placements,before.placements);assert.equal(after.testDiamonds,9000);}finally{await a.dispose();}});
test('Dex preview exposes routes/conditions without inventing route or capture history',async()=>{const h=setup(),a=h.create();try{await a.newGame();a.openDatabase();a.selectDatabaseSpecies(17);const f=a.getDatabaseFrame();assert.equal(f.selected.viewable,true);assert.ok(f.selected.evolutionRoutes.length>0);assert.ok(f.selected.evolutionRoutes.every(r=>r.revealed&&r.displayPreview&&r.historyState!=='RECORDED'));assert.ok(f.selected.evolutionRoutes.some(r=>r.conditions));assert.equal(f.selected.instanceCount,0);}finally{await a.dispose();}});

test('ordinary app defaults retain original economy and grid; public entry explicitly enables test policy',async()=>{
 const h=setup(),a=h.create({playtestPolicy:null});
 try {await a.newGame();assert.equal(a.getShopFrame().bits,0);assert.equal(a.getCageEditFrame().testDiamonds,0);assert.equal(a.getCageEditFrame().unlockedCount,14);assert.equal(a.getCageEditFrame().layoutVersion,'NATIVE_ANCHORS_V1');}
 finally {await a.dispose();}
 const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
 assert.match(main,/createChampionshipStandaloneApp\(\{\s*playtestPolicy: FRIENDS_PLAYTEST_POLICY/);
 assert.match(main,/createMedalCollectionView\(\{root, playtestPolicy: FRIENDS_PLAYTEST_POLICY/);
 assert.match(main,/unlockedSlots: cageFrame\?\.unlockedSlots \?\? null/);
 assert.match(main,/productGrid: plan\.productGrid \?\? null/);
});

test('public grid rejects old free expansion grant and preserves balance and open cells',async()=>{
 const h=setup(),a=h.create();try {await a.newGame();a.openCageEdit();const before=a.getCageEditFrame();a.grantRanchExpansionPrototype();const after=a.getCageEditFrame();assert.equal(after.unlockedCount,20);assert.equal(after.testDiamonds,10000);assert.deepEqual(after.unlockedSlots,before.unlockedSlots);assert.deepEqual(after.gridAccess.testUnlockedRows,[]);}finally{await a.dispose();}
});


test('normal presentation intent purchases one row through the app and republishes the balance',async()=>{
 const h=setup(),a=h.create();let unsubscribe;
 try {await a.newGame();const source=createGateHuntPresentationSource(a);let frame;unsubscribe=source.subscribe(f=>frame=f);source.intents.openCageEdit();const result=source.intents.buyRanchTestRow(2);assert.equal(result.ok,true);assert.equal(a.getCageEditFrame().testDiamonds,9000);assert.equal(a.getCageEditFrame().unlockedCount,30);assert.equal(source.intents.buyRanchTestRow(2).ok,false);assert.equal(a.getCageEditFrame().testDiamonds,9000);assert.ok(frame);}
 finally {unsubscribe?.();await a.dispose();}
});

test('header projects only test balance, supports all locales, and preserves no-wallet preview',async()=>{
 const {createControlledDocument}=await import('./helpers/controlled-database-dom.mjs');
 const {createChampionshipStatusBar}=await import('../src/championship/app/championshipStatusBar.js');
 const {LOCALES,setLocale}=await import('../src/championship/text/locale.js');
 const {uiText}=await import('../src/championship/text/uiText.js');
 const previous=globalThis.document,doc=createControlledDocument();const create=doc.createElement.bind(doc);doc.createElement=tag=>{const n=create(tag);n.offsetHeight=44;return n;};globalThis.document=doc;
 const host=doc.createElement('main');doc.body.append(host);let bar;
 try {bar=createChampionshipStatusBar({root:host});const diamond=host.querySelector('.cm-status-bar__diamond');
  bar.render({testDiamonds:null});assert.equal(diamond.dataset.testWallet,'false');assert.equal(diamond.textContent,uiText('HUD_PREVIEW'));
  for(const locale of LOCALES){setLocale(locale);for(const amount of [10000,9000,8000,7000,0]){bar.render({testDiamonds:amount});bar.relabel();assert.equal(diamond.dataset.testWallet,'true');assert.equal(Number(diamond.getAttribute('aria-label').replace(/[^0-9]/g,'')),amount);assert.notEqual(diamond.textContent,uiText('HUD_PREVIEW'));}}
  bar.render({testDiamonds:null});assert.equal(diamond.dataset.testWallet,'false');assert.equal(diamond.textContent,uiText('HUD_PREVIEW'));
 }finally{bar?.dispose();setLocale('zh-Hant');globalThis.document=previous;}
});
