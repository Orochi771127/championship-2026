import test from 'node:test';
import assert from 'node:assert/strict';
import mappings from './fixtures/medal-original-name-mapping-20261015.json' with {type:'json'};
import {titleEventText,speciesName} from '../src/championship/text/zhHant.js';
import {setLocale,getLocale} from '../src/championship/text/locale.js';
import {describeMedalDetails,medalQualificationSpecies} from '../src/championship/app/medalDetails.js';
import {nativeBattleQualification,battlePartyCondition} from '../src/championship/battle/battleParty.js';
import qualification from '../src/data/championship/battlePartyConditions.json' with {type:'json'};
const locales=['zh-Hant','en','ja','th','vi'];
const forbidden=[...new Set(mappings.flatMap(row=>Object.values(row.oldTokensByLocale)))];
const otherLegacy=/豆豆獸|マメモン|มาเมมอน|Mamemon|數碼怪獸|Digital Monster|デジタルモンスター|Digimon|Digi-Egg|Ｄ無限|Dインフィニット|黛莉西亞薔薇|デリシアローズ|艾克斯龍騎士|エクスドラグナー/;

test('all 61 medals and tutorial copy across five locales resolve original species names and no legacy brand strings',()=>{
 const previous=getLocale();try{for(const locale of locales){setLocale(locale);
  for(let id=0;id<62;id++){
   const text=[titleEventText(id,'name',''),titleEventText(id,'description','')].join('\n');
   assert.ok(text.trim(),`${locale}/${id}`);for(const token of forbidden)assert.ok(!text.includes(token),`${locale}/${id}: ${token}`);assert.doesNotMatch(text,otherLegacy);
   if(id<61){const details=describeMedalDetails(id);const display=[...details.facts.flatMap(f=>[f.label,f.value]),...details.notes].join('\n');assert.doesNotMatch(display,otherLegacy);assert.ok(!display.includes('{names}'));}
  }
  for(const row of mappings)assert.ok(titleEventText(row.eventRecordIndex,'description','').includes(speciesName(row.speciesIndex)),`${locale}/${row.eventRecordIndex} must use species ${row.speciesIndex}`);
  assert.ok(titleEventText(17,'description','').includes(speciesName(106)));assert.ok(!titleEventText(17,'description','').includes(speciesName(215)));
 }}finally{setLocale(previous);}
});

test('displayed restriction groups match native species predicates, including both-origin flag 3',()=>{
 const defaultCondition=battlePartyCondition(-1);
 for(const filter of [{type:6},{origin:1},{origin:2}]){
  const condition={...defaultCondition,species014:filter.type??0,field14:filter.origin??0};
  const expected=qualification.species.flatMap((record,index)=>{
   if(index<8||index>=224||record.fields['0c']<=1)return [];
   const profile={fields:{'000':index,'010':255,'018':0},narrowFields:{'03c':255}};
   return nativeBattleQualification(profile,condition)?[index]:[];
  });
  assert.deepEqual(medalQualificationSpecies(filter),expected);assert.ok(Object.isFrozen(medalQualificationSpecies(filter)));
 }
 assert.deepEqual(medalQualificationSpecies({type:6}),[157,164,205]);
 const origin=medalQualificationSpecies({origin:1}),pendulum=medalQualificationSpecies({origin:2});
 assert.equal(origin.length,52);assert.equal(pendulum.length,100);assert.equal(origin.filter(id=>pendulum.includes(id)).length,19);
});
