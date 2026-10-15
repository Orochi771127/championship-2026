import test from 'node:test';
import assert from 'node:assert/strict';
import { uiText, UI_COPY } from '../src/championship/text/uiText.js';
import { getLocale, setLocale, LOCALES } from '../src/championship/text/locale.js';
import { TEXT_EN, UI_COPY_EN } from '../src/championship/text/uiText.en.js';
import { TEXT_JA, UI_COPY_JA } from '../src/championship/text/uiText.ja.js';
import { TEXT_TH, UI_COPY_TH } from '../src/championship/text/uiText.th.js';
import { TEXT_VI, UI_COPY_VI } from '../src/championship/text/uiText.vi.js';
import * as en from '../src/championship/text/catalogs.en.js';
import * as zh from '../src/championship/text/catalogs.zhHant.js';
import * as ja from '../src/championship/text/catalogs.ja.js';
import * as th from '../src/championship/text/catalogs.th.js';
import * as vi from '../src/championship/text/catalogs.vi.js';
import { scanLiterals } from '../scripts/check-locale-coverage.mjs';
const legacy = /數碼獸|數碼寶貝|digimon|デジモン/i;
const tables=[UI_COPY,UI_COPY_EN,UI_COPY_JA,UI_COPY_TH,UI_COPY_VI,TEXT_EN,TEXT_JA,TEXT_TH,TEXT_VI];

test('entry eligibility screenshot and all authored legacy UI keys display neutral companion copy in five locales',()=>{
  const previous=getLocale();
  const keys=new Set(tables.flatMap(table=>Object.keys(table)).filter(key=>legacy.test(key)));
  // Existing source scan excludes identifiers/comments and checks genuine Han copy.
  for(const {text} of scanLiterals())if(legacy.test(text))keys.add(text);
  try{for(const locale of LOCALES){
    setLocale(locale);
    for(const key of keys)assert.doesNotMatch(uiText(key,{limit:3}),legacy,`${locale}: ${key}`);
    if(locale==='zh-Hant')assert.equal(uiText('這隻數碼獸目前的身體狀況無法參賽。'),'這隻夥伴目前的身體狀況無法參賽。');
  }}finally{setLocale(previous);}
});

test('catalog display values and translated UI values never expose the legacy collective name',()=>{
  const strings=value=>typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
  for(const table of [...tables,en,zh,ja,th,vi])for(const value of strings(table))assert.doesNotMatch(value,legacy);
});

test('exact authored aliases do not rewrite player input, identifiers, or template parameters',()=>{
  const previous=getLocale();
  try{for(const locale of LOCALES){setLocale(locale);
    const nickname='我的數碼獸 Digimon デジモン';
    assert.equal(uiText(nickname),nickname);
    assert.equal(uiText('CHAMPIONSHIP_DIGIMON_LIST_NOT_ACTIVE'),'CHAMPIONSHIP_DIGIMON_LIST_NOT_ACTIVE');
    assert.equal(uiText('{name}',{name:nickname}),nickname);
  }}finally{setLocale(previous);}
});
