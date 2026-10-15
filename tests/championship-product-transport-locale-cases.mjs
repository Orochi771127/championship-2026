import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LOCALES,setLocale,getLocale} from '../src/championship/text/locale.js';
import {BATTLE_TRANSPORT_COPY,battleTransportText} from '../src/championship/text/battleTransportText.js';
import {PRODUCT_FORM_TEXT} from '../src/championship/text/productFormText.js';
import {inspectScopedLocaleCopy,buildLocaleCoverage} from '../scripts/check-locale-coverage.mjs';
import {CHAMPIONSHIP_PASSWORD_V2_NOTICE,championshipPasswordProfileAdmission,championshipPasswordTeamAdmission}
  from '../src/championship/battle/nativePasswordBattle.js';
import {CHAMPIONSHIP_LINK_V2_NOTICE} from '../src/championship/battle/nativeLinkBattle.js';
const keys=['SPECIES_NOT_READY','CATALOG_MISMATCH','V2_INVITE_REQUIRED','V2_REQUIRED','VERSION_MISMATCH',
  'VALUES_UNSUPPORTED','INVALID_CODE','PASSWORD_V2_NOTICE','LINK_V2_NOTICE','PASSWORD_INPUT_HINT','LINK_VERSION_HINT',
  'CREATE_V2_INVITE','CREATE_V2_INVITE_LABEL','PASSWORD_SPECIES_NOT_READY','PROFILE_UNAVAILABLE','EMPTY_TEAM'];
const file='src/championship/text/battleTransportText.js';
test('all 16 transport display keys have nonempty native-language copy in all five supported locales',()=>{
 assert.deepEqual(Object.keys(BATTLE_TRANSPORT_COPY),LOCALES);
 for(const locale of LOCALES){
  assert.deepEqual(Object.keys(BATTLE_TRANSPORT_COPY[locale]),keys);
  assert.ok(Object.isFrozen(BATTLE_TRANSPORT_COPY[locale]));
  for(const key of keys){
   const value=battleTransportText(key,locale);assert.equal(value,BATTLE_TRANSPORT_COPY[locale][key]);
   assert.ok(value.trim().length>5,`${locale}:${key}`);assert.notEqual(value,key);
   if(locale!=='zh-Hant')assert.notEqual(value,BATTLE_TRANSPORT_COPY['zh-Hant'][key]);
  }
  assert.match(battleTransportText('PASSWORD_INPUT_HINT',locale),/CM26-PASSWORD-2/);
 }
 assert.throws(()=>battleTransportText('MISSING_KEY'),/BATTLE_TRANSPORT_COPY_UNKNOWN/);
 assert.throws(()=>battleTransportText(keys[0],'unlisted'),/BATTLE_TRANSPORT_COPY_UNKNOWN/);
});
test('codec notices and runtime admission use the current locale after module initialization',()=>{
 const before=getLocale();
 try{for(const locale of LOCALES){
  setLocale(locale);
  assert.equal(CHAMPIONSHIP_PASSWORD_V2_NOTICE.message,BATTLE_TRANSPORT_COPY[locale].PASSWORD_V2_NOTICE);
  assert.equal(CHAMPIONSHIP_LINK_V2_NOTICE.message,BATTLE_TRANSPORT_COPY[locale].LINK_V2_NOTICE);
  for(const id of [229,230]){
   const result=championshipPasswordProfileAdmission({fields:{'000':id}});
   assert.equal(result.reason,'PRODUCT_SPECIES_NOT_READY');
   assert.equal(result.message,BATTLE_TRANSPORT_COPY[locale].PASSWORD_SPECIES_NOT_READY);
  }
  const empty=championshipPasswordTeamAdmission({members:[null,null,null]});
  assert.equal(empty.reason,'EMPTY_TEAM');assert.equal(empty.message,BATTLE_TRANSPORT_COPY[locale].EMPTY_TEAM);
 }}finally{setLocale(before);}
 assert.equal(CHAMPIONSHIP_PASSWORD_V2_NOTICE.prefix,'CM26-PASSWORD-2.');
 assert.equal(CHAMPIONSHIP_LINK_V2_NOTICE.prefix,'CM26-LINK-2.');
});
test('global locale gate registers both new dictionaries and detects a removed translation',async()=>{
 assert.deepEqual(inspectScopedLocaleCopy(file,BATTLE_TRANSPORT_COPY).gaps,[]);
 const broken=structuredClone(BATTLE_TRANSPORT_COPY);delete broken.vi.V2_INVITE_REQUIRED;
 assert.deepEqual(inspectScopedLocaleCopy(file,broken).gaps,[`vi:SCOPED_COPY[${file}:V2_INVITE_REQUIRED]`]);
 assert.deepEqual(inspectScopedLocaleCopy('src/championship/text/productFormText.js',PRODUCT_FORM_TEXT).gaps,[]);
 const report=await buildLocaleCoverage();
 for(const [name,count] of [['battleTransportText.js',16],['productFormText.js',2]]){
  const table=report.scopedCopy.find(table=>table.file.endsWith('/'+name));assert.ok(table,name);
  assert.equal(table.keyCount,count);assert.deepEqual(table.gaps,[]);
 }
 assert.equal(report.counts.missing,0,JSON.stringify(report.missing));
 assert.equal(report.counts.uiCopyMissing,0);assert.equal(report.counts.catalogGaps,0);
});
test('transport display call sites resolve dictionary copy instead of adding untranslated literals',()=>{
 for(const name of ['nativeLinkBattle.js','nativePasswordBattle.js']){
  const source=readFileSync(new URL('../src/championship/battle/'+name,import.meta.url),'utf8');
  assert.match(source,/get message\(\)\{return battleTransportText\('/);
 }
 const source=readFileSync(new URL('../src/championship/app/vs5Screens.js',import.meta.url),'utf8');
 for(const key of ['PASSWORD_INPUT_HINT','LINK_VERSION_HINT','CREATE_V2_INVITE','CREATE_V2_INVITE_LABEL'])
  assert.ok(source.includes(`battleTransportText('${key}')`),key);
 const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
 assert.match(main,/from '\.\.\/contracts\/productBattleTransport.js'/);
});
