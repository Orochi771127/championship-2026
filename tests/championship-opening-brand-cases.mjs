import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setLocale} from '../src/championship/text/locale.js';
import {openingStoryText} from '../src/championship/text/openingStoryText.js';
import {getOpeningBrandTerms,PENDING_TERMS_REGISTRY} from '../src/championship/text/brandTerms.js';
const source=fs.readFileSync(new URL('../src/championship/app/openingStoryPresentation.js',import.meta.url),'utf8');
const paragraphs=Function('return '+source.match(/const TEXT=(\[[\s\S]*?\]);/)[1])();
for(const [locale,four,eligibility,invitation]of [
 ['zh-Hant','每四年','取得參賽資格','你也迎來'],['en','four years','Earning a place','your own chance'],
 ['ja','4年に一度','出場資格','あなたにも'],['th','ทุกสี่ปี','ได้สิทธิ์เข้าร่วม','คุณเองก็ได้รับโอกาส'],
 ['vi','bốn năm','quyền tham dự','bạn cũng đã có cơ hội']])test(locale+' four opening paragraphs preserve story meanings and registered pending terms',()=>{
 setLocale(locale);const result=paragraphs.map(openingStoryText),terms=getOpeningBrandTerms(locale);
 assert.equal(result.length,4);assert.ok(result[0].includes(four));assert.ok(result[1].includes(eligibility));assert.ok(result[2].includes(invitation));
 assert.ok(result[0].includes(terms.tournament));assert.ok(result[2].includes(terms.tournament));assert.ok(result[1].includes(terms.creature));
 assert.equal(terms.creature,PENDING_TERMS_REGISTRY.CREATURE_SPECIES_TERM.candidates[locale][0]);
 assert.ok(result.every(t=>! /數碼獸|數碼寶貝|Digimon|デジモン|ดิจิมอน/i.test(t)));
 assert.equal(openingStoryText('OWNER_PLAYER_NAME_123'),'OWNER_PLAYER_NAME_123');
});

import {waitForOpeningComicImages} from '../src/championship/app/openingStoryPresentation.js';
test('cold comic startup waits for every successful decode without advancing native time',async()=>{
 let first,second,settled=false;const a={complete:false,naturalWidth:0,decode:()=>new Promise(r=>{first=()=>{a.naturalWidth=640;r();};})},b={complete:false,naturalWidth:0,decode:()=>new Promise(r=>{second=()=>{b.naturalWidth=560;r();};})};
 const ready=waitForOpeningComicImages([a,b]).then(v=>{settled=true;return v;});await Promise.resolve();first();await Promise.resolve();assert.equal(settled,false);second();assert.equal(await ready,true);
});
test('cached images, decode failures, timeout and dispose settle without hanging the opening',async()=>{
 assert.equal(await waitForOpeningComicImages([{complete:true,naturalWidth:1}]),true);
 assert.equal(await waitForOpeningComicImages([{complete:true,naturalWidth:0}]),false);
 assert.equal(await waitForOpeningComicImages([{complete:false,decode:async()=>{throw Error('NETWORK');}}]),false);
 const pending={complete:false,decode:()=>new Promise(()=>{})};assert.equal(await waitForOpeningComicImages([pending],{timeoutMs:1}),false);
 const c=new AbortController(),promise=waitForOpeningComicImages([pending],{signal:c.signal});c.abort();assert.equal(await promise,false);
});
