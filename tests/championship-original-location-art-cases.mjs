import test from 'node:test';
import assert from 'node:assert/strict';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {originalCageLocationArt} from '../src/championship/presentation/originalCageLocationArt.js';
import {originalShopCageThumbnail} from '../src/championship/presentation/originalShopCageArt.js';
import {cageUiImage,cageUiThumbnail} from '../src/championship/presentation/cageUiArt.js';
import {uiText} from '../src/championship/text/uiText.js';
import {setLocale} from '../src/championship/text/locale.js';

test('every existing cage keeps its identity and uses its accepted picture for the location marker',()=>{
 const base='https://orochi771127.github.io/championship-2026/';
 for(const definition of listCageDefinitions()){
  const actual=originalCageLocationArt(definition.cageDefinitionIndex,base);
  // Owner 2026-11-02: the shop picture is now the 3D render; the 10/08 original stays its fallback.
  assert.ok(originalShopCageThumbnail(definition.shopRecordIndex,base)||definition.cageDefinitionIndex===35);
  const expected=definition.cageDefinitionIndex===35?cageUiImage(definition.moduleId,base)
   :cageUiThumbnail(definition.moduleId);
  assert.equal(actual,expected);assert.doesNotMatch(actual,/internal-|assembled-ui/);
 }
 for(const value of [null,undefined,-1,36,'1'])assert.equal(originalCageLocationArt(value,base),null);
});

test('title prefetch status is localized and interpolated in all five supported languages',t=>{
 t.after(()=>setLocale('zh-Hant'));
 for(const locale of ['zh-Hant','en','ja','th','vi']){
  setLocale(locale);
  for(const key of ['RANCH_PREFETCH_PLANNING','RANCH_PREFETCH_COMPLETE','RANCH_PREFETCH_PARTIAL'])assert.notEqual(uiText(key),key);
  const status=uiText('RANCH_PREFETCH_PROGRESS',{done:2,files:12,mib:'8.7'});
  assert.match(status,/2\/12/);assert.match(status,/8\.7/);assert.doesNotMatch(status,/[{}]|RANCH_PREFETCH/);
 }
});
