import test from 'node:test';
import assert from 'node:assert/strict';
import {createControlledDocument} from './helpers/controlled-database-dom.mjs';
import {createChampionshipStatusBar,compactHudCurrency} from '../src/championship/app/championshipStatusBar.js';
import {LOCALES,setLocale,formatNumber} from '../src/championship/text/locale.js';
import {uiText} from '../src/championship/text/uiText.js';

test('compact projection is exact through six digits, truncates only display, and marks undisplayed remainders',()=>{
 for(const locale of LOCALES){setLocale(locale);
  for(const value of [0,1,10000,100000,999999])assert.equal(compactHudCurrency(value),String(formatNumber(value)));
  for(const [value,label] of [[1000000,'1M'],[1999999,String(formatNumber(1.9,{useGrouping:false,maximumFractionDigits:1}))+'M+'],[9999999,String(formatNumber(9.9,{useGrouping:false,maximumFractionDigits:1}))+'M+'],[1000000000,'1B'],[1000000000001,'1T+'],[Number.MAX_SAFE_INTEGER,'9Q+']])assert.equal(compactHudCurrency(value),label);
 }
 setLocale('zh-Hant');for(const value of [null,undefined,NaN,-1,1.1,Number.MAX_SAFE_INTEGER+1])assert.equal(compactHudCurrency(value),'—');
});
test('all locales preserve exact wallet names and save-slot identity across tutorial/save readings',()=>{
 const previous=globalThis.document,doc=createControlledDocument();globalThis.document=doc;
 const create=doc.createElement.bind(doc);doc.createElement=tag=>{const n=create(tag);n.offsetHeight=44;return n;};
 let opens=0;const bar=createChampionshipStatusBar({root:doc.body,onOpenSave:()=>opens++});
 try {const slot=doc.querySelector('.cm-status-bar__save-slot'),save=doc.querySelector('.cm-status-bar__save');
  assert.ok(slot);assert.equal(save.parentNode,slot);
  for(const locale of LOCALES){setLocale(locale);bar.relabel();
   for(const value of [0,10000,100000,999999,1000001,Number.MAX_SAFE_INTEGER])for(const phase of ['SAVED','RESTORED','DIRTY','SAVING','SAVE_FAILED']){
    const reading={screen:'RAISING_HOME',bits:value,testDiamonds:value,save:{phase}},before=JSON.stringify(reading);bar.render(reading);
    assert.equal(JSON.stringify(reading),before,'presentation must not mutate its source reading');
    assert.equal(doc.querySelector('.cm-status-bar__bits').getAttribute('aria-label'),uiText('持有 {bits} 位元幣',{bits:value}));
    assert.equal(doc.querySelector('.cm-status-bar__diamond').getAttribute('aria-label'),uiText('CAGE_TEST_DIAMOND_BALANCE',{amount:formatNumber(value)}));
    assert.equal(doc.querySelector('.cm-status-bar__save-slot'),slot);assert.equal(save.hidden,phase==='DIRTY');
   }
  }
  save.click();assert.equal(opens,1);
 }finally{bar.dispose();globalThis.document=previous;setLocale('zh-Hant');}
});
