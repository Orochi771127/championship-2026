import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {speciesName} from '../src/championship/text/zhHant.js';
import {getLocale,setLocale} from '../src/championship/text/locale.js';
import {databaseStory} from '../src/championship/database/databaseStories.js';
import {listProductExtensions,planUltimateDisplayOrder} from '../src/championship/contracts/productSpeciesExtensions.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../src/data/championship/'+p,import.meta.url)));
test('new form names and independent profiles exist in all five locales',()=>{
 const old=getLocale();try{for(const locale of ['zh-Hant','en','ja','th','vi']){setLocale(locale);for(const id of [229,230]){const name=speciesName(id),story=databaseStory(id);assert.ok(name.length>3);assert.ok(story.length>30);if(locale!=='zh-Hant')assert.notEqual(name,listProductExtensions().find(x=>x.speciesIndex===id).displayNameZh);}}}finally{setLocale(old);}
});
test('new portraits are distinct approved public images and never replace either mother form',()=>{
 const entries=read('database-hero-portraits.r1.json').entries;
 assert.equal(new Set(entries.map(x=>x.speciesIndex)).size,entries.length);
 for(const id of [211,222,229,230]){const e=entries.find(x=>x.speciesIndex===id);assert.ok(e);assert.match(e.src,/^assets\/production\//);assert.match(e.sha256,/^[0-9a-f]{64}$/);}
 assert.equal(entries.find(x=>x.speciesIndex===229).sha256,'f1e1a23e891b9345f4b759e910c5f67efd8a844a2de53e14183a1a2fe3310424');
 assert.equal(entries.find(x=>x.speciesIndex===230).sha256,'09ebff7fb323886eae495e557158cdd204a04dc2d18aa686ad0060ac250e2e39');
});
test('display-only ultimate ordering preserves IDs and four owner-assigned positions',()=>{
 const old=read('database-display.r1.json').entries,plan=planUltimateDisplayOrder(old);
 for(const [id,serial] of [[222,2],[230,3],[211,33],[229,34]])assert.equal(plan.find(e=>e.speciesIndex===id).serial,serial);
 const originals=old.filter(e=>e.numberingStageIndex===6&&![211,222].includes(e.speciesIndex)).sort((a,b)=>a.serial-b.serial).map(e=>e.speciesIndex);
 assert.deepEqual(plan.filter(e=>![211,222,229,230].includes(e.speciesIndex)).map(e=>e.speciesIndex),originals);
 assert.equal(plan.some(e=>e.speciesIndex===228),false);
});
