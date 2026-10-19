import test from 'node:test';
import assert from 'node:assert/strict';
import {createRanchRowPurchasePrompt} from '../src/championship/app/ranchRowPurchasePrompt.js';
import {purchaseTestRanchRow} from '../src/championship/app/friendsPlaytestPolicy.js';
import {LOCALES,setLocale} from '../src/championship/text/locale.js';
function harness(diamonds=10000,rows=5){
 let wallet={version:2,grants:[],diamonds,purchases:[]},frame={screen:'CAGE_EDIT',cageEdit:{productGrid:{rows},testDiamonds:diamonds,slots:Array.from({length:rows*10},(_,i)=>({row:Math.floor(i/10),unlocked:i<20}))}},resolve,options,calls=0,dialogs=0;
 const source={getFrame:()=>frame,intents:{buyRanchTestRow(row){calls++;const buy=purchaseTestRanchRow(wallet,row);if(buy.ok){wallet=buy.state;frame.cageEdit.testDiamonds=wallet.diamonds;for(const slot of frame.cageEdit.slots)if(slot.row===row)slot.unlocked=true;}}}};
 const prompt=createRanchRowPurchasePrompt({source,ask:opts=>{dialogs++;options=opts;return new Promise(r=>resolve=r);}});
 return{prompt,source,get wallet(){return wallet},get frame(){return frame},get options(){return options},get calls(){return calls},get dialogs(){return dialogs},resolve:value=>resolve(value)};
}
test('opening, cancel and repeated taps never debit; explicit Buy purchases once',async()=>{
 const h=harness(),pending=h.prompt.open(2);await h.prompt.open(2);await h.prompt.open(3);
 assert.equal(h.dialogs,1);assert.equal(h.calls,0);assert.equal(h.wallet.diamonds,10000);assert.equal(h.options.focusId,'cancel');assert.equal(h.options.cancelId,'cancel');
 h.resolve('cancel');await pending;assert.equal(h.calls,0);
 const buy=h.prompt.open(2);h.resolve('buy');await buy;await h.prompt.open(2);
 assert.equal(h.calls,1);assert.equal(h.wallet.diamonds,9000);assert.equal(h.frame.cageEdit.slots.filter(s=>s.unlocked).length,30);
 const reload=JSON.parse(JSON.stringify(h.wallet));assert.equal(purchaseTestRanchRow(reload,2).reason,'ALREADY_OPEN');assert.equal(reload.diamonds,9000);
});
test('insufficient funds disable Buy and cannot debit even if an injected dialog returns buy',async()=>{
 const h=harness(999),p=h.prompt.open(2);assert.equal(h.options.actions[1].disabled,true);h.resolve('buy');await p;assert.equal(h.calls,0);assert.equal(h.wallet.diamonds,999);
});
test('dismissal, navigation, disposal and a stale unlocked row cannot dispatch',async()=>{
 for(const mode of ['escape','navigate','dispose','unlocked']){const h=harness(),p=h.prompt.open(2);if(mode==='navigate')h.frame.screen='HOME';if(mode==='dispose'){h.prompt.dispose();assert.equal(h.options.signal.aborted,true);}if(mode==='unlocked')h.frame.cageEdit.slots.forEach(s=>{if(s.row===2)s.unlocked=true;});h.resolve(mode==='escape'?null:'buy');await p;assert.equal(h.calls,0,mode);}
});
test('all three purchases preserve 20 base + 30 unlocked = 50 and 7000 balance',async()=>{
 const h=harness();for(const row of [2,3,4]){const p=h.prompt.open(row);h.resolve('buy');await p;}assert.equal(h.wallet.diamonds,7000);assert.equal(h.frame.cageEdit.slots.filter(s=>s.unlocked).length,50);assert.deepEqual([...h.wallet.purchases],[2,3,4]);
});
test('dialog copy resolves row, count, price, balance and actions across five locales',async()=>{
 try{for(const locale of LOCALES){setLocale(locale);const h=harness(),p=h.prompt.open(2);assert.match(h.options.title,/3/);for(const n of ['10','1000','10000'])assert.ok(h.options.message.replace(/[^0-9]/g,'').includes(n),locale+': '+n);assert.doesNotMatch(JSON.stringify(h.options),/CAGE_TEST_|\{(?:row|count|price|amount)\}/);h.resolve('cancel');await p;}}finally{setLocale('zh-Hant');}
});

test('100-cell dialog permits all eight expansion rows and rejects row11',async()=>{
 const h=harness(20000,10);
 for(let row=2;row<10;row++){const pending=h.prompt.open(row);assert.ok(h.options.title.includes(String(row+1)));h.resolve('buy');await pending;}
 await h.prompt.open(10);assert.equal(h.dialogs,8);assert.equal(h.calls,8);assert.equal(h.wallet.diamonds,12000);assert.equal(h.frame.cageEdit.slots.filter(s=>s.unlocked).length,100);
});
