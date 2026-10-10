import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {medalCollection} from '../src/championship/app/medalCollection.js';
import {createChampionshipScreenStack} from '../src/championship/app/championshipScreenStack.js';
import {originalMedalArt,originalShopItemArt,originalDatabaseIcon,isOriginalUiIntakeLocal} from '../src/championship/presentation/completedOriginalUi20261007.js';
import {shopGoodsPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
import {getShopRecord} from '../src/championship/shop/shopCatalog.js';
const local='http://127.0.0.1:8766/championship.html';
const manifest=JSON.parse(readFileSync(new URL('../assets/production/original-ui-intake-20261007/manifest.json',import.meta.url)));
test('collection reads the 61 canonical title flags without fabricating old history or tutorial awards',()=>{
 const old=Object.freeze([0,4,60]);const snapshot=JSON.stringify(old);
 assert.equal(medalCollection().filter(x=>x.acquired).length,0);
 assert.equal(medalCollection(undefined).length,61);
 assert.deepEqual(medalCollection(old).filter(x=>x.acquired).map(x=>x.titleId),[0,4,60]);
 assert.equal(JSON.stringify(old),snapshot);
 assert.equal(medalCollection(Array.from({length:61},(_,i)=>i)).filter(x=>x.acquired).length,61);
 assert.equal(medalCollection([61,228,229,230,-1,'0']).filter(x=>x.acquired).length,0);
 for(const m of medalCollection())assert.equal(m.requiredRank,m.event.unlockThreshold*2);
 const stack=createChampionshipScreenStack();stack.enter('MEDALS');assert.deepEqual(stack.trail(),['RAISING_HOME','MEDALS']);stack.back();assert.equal(stack.current(),'RAISING_HOME');
});
test('all 164 delivered PNGs retain exact hashes and full fourfold raster density',()=>{
 const all=[...manifest.medals,...manifest.database,...manifest.items];assert.equal(all.length,164);
 for(const a of all){const data=readFileSync(new URL('../'+a.src,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256,a.src);const native=a.nativeSize??[a.width,a.height];assert.deepEqual(a.rasterSize,native.map(n=>n*4),a.src);}
});
test('83 non-cage goods preserve record/item identity and deferred cage icons',()=>{
 for(let i=0;i<83;i++){const a=originalShopItemArt(i,local),record=getShopRecord(i);assert.equal(a.itemIndex,record.itemIndex);assert.equal(a.category,record.category);assert.equal(shopGoodsPresentation(i,local).src,a.src);}
 for(let i=83;i<118;i++)assert.equal(originalShopItemArt(i,local),null);
 assert.deepEqual([0,1,2,3].map(i=>shopGoodsPresentation(i,local).itemIndex),[0,1,3,2]);
});
test('new art never inherits old public-playtest permission and unknown third icon is not guessed',()=>{
 for(const url of ['https://example.com/game','file:///R:/game','https://orochi771127.github.io/championship-2026/']){assert.equal(isOriginalUiIntakeLocal(url),false);assert.equal(originalMedalArt(0,url),null);}
 assert.equal(originalDatabaseIcon('DATABASE',local).cell,0);assert.equal(originalDatabaseIcon('MEDALS',local).cell,1);assert.equal(originalDatabaseIcon('HELP',local),null);
 assert.equal(originalMedalArt(61,local),null);
});
