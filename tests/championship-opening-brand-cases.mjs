import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setLocale} from '../src/championship/text/locale.js';
import {openingStoryText} from '../src/championship/text/openingStoryText.js';
import {getOpeningBrandTerms,PENDING_TERMS_REGISTRY} from '../src/championship/text/brandTerms.js';
import {uiText} from '../src/championship/text/uiText.js';
import {speciesName,starterName} from '../src/championship/text/zhHant.js';

test('shared tutorial, battle, database and error labels use neutral partner terms in five languages',()=>{
 const labels=['選擇參賽數碼獸','選擇參賽數碼獸（1 至 3 隻）','參賽數碼獸',
   '目前沒有符合這場比賽條件的數碼獸。','將自己培育的數碼獸分成兩隊，每隊最多 3 隻。',
   '練習對戰需要至少兩隻可以參賽的數碼獸。','選擇最多 3 隻自己的數碼獸，產生可以分享給朋友的密碼。密碼保存的是現在的狀態。',
   '目前沒有可以密碼化的數碼獸。','選擇本輪參賽數碼獸；確認後抽出對手。','目前沒有可以參賽的數碼獸。',
   '數碼獸圖鑑','尚未登錄這隻數碼獸。','這隻數碼獸的名字無法更改。',
   '數碼獸物種名稱與初始夥伴的自動名稱在英文正式名稱核定前，沿用已核定的繁體中文名稱；你取的名字不會被翻譯。',
   '同一隻數碼獸只能加入一隊。','通訊碼內含不能參戰的數碼獸。','請選擇 1 至 3 隻數碼獸。',
   '請選擇 1 至 {limit} 隻符合條件的數碼獸。','選擇的數碼獸已不在目前名冊。'];
 try{for(const locale of ['zh-Hant','en','ja','th','vi']){
   setLocale(locale);
   for(const label of labels){const rendered=uiText(label,{limit:3});assert.ok(rendered.length>0);assert.doesNotMatch(rendered,/數碼獸|Digimon|デジモン|ดิจิมอน/i,locale+': '+label);}
   assert.doesNotMatch(speciesName(-1),/數碼獸|Digimon|デジモン|ดิจิมอน/i);
 }}finally{setLocale('zh-Hant');}
});

test('neutral authored labels never replace terms inside player nicknames or fallback parameters',()=>{
 const nickname='數碼獸小寶 Digimon デジモン';
 try{for(const locale of ['zh-Hant','en','ja','th','vi']){
   setLocale(locale);assert.equal(starterName(nickname),nickname);
   assert.equal(uiText('{name}',{name:nickname}),nickname);
   assert.equal(speciesName(-1,nickname),nickname);
 }}finally{setLocale('zh-Hant');}
});
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
test('five-language opening gift letters and egg naming use central terms without rewriting player input',()=>{
 const tamer='從現在起，你也是數碼獸馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。',egg='這顆數碼蛋送給你。\n請替牠取個名字。';
 try{for(const locale of ['zh-Hant','en','ja','th','vi']){
  setLocale(locale);const terms=getOpeningBrandTerms(locale),letters=[openingStoryText(tamer),openingStoryText(egg),openingStoryText('請替數碼蛋取名字')];
  assert.ok(letters[0].includes(terms.creature));assert.ok(letters.slice(1).every(t=>t.includes(terms.egg)));
  assert.ok(letters.every(t=>! /數碼獸|數碼蛋|Digimon|Digi[- ]?Egg|デジモン|デジタマ|ดิจิมอน/i.test(t)));
  assert.equal(openingStoryText('數碼獸小蛋'),'數碼獸小蛋');
 }
 setLocale('zh-Hant');assert.equal(setLocale('unsupported'),false);
 assert.equal(openingStoryText(egg),'這顆培育蛋送給你。\n請替牠取個名字。');
 assert.equal(openingStoryText(tamer).split('\n')[0],'從現在起，你也是拍檔馴獸師了。');
 assert.equal(getOpeningBrandTerms('unsupported').egg,'培育蛋');
 }finally{setLocale('zh-Hant');}
});
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
