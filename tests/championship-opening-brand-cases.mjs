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
// Owner 2026-11-02: the New Game story is the Ai-chan layered v3 text. zh-Hant is the
// approved wording; the other four locales are product-authored translations that must
// keep the approved core in every language.
for(const [locale,four,eligibility,heartCore,name]of [
 ['zh-Hant','每四年','取得參賽資格','心核','愛醬'],['en','every four years','Earning a place','heart core','Ai-chan'],
 ['ja','四年に一度','出場資格','心核','アイちゃん'],['th','ทุกสี่ปี','ได้สิทธิ์เข้าร่วม','แกนหัวใจ','ไอจัง'],
 ['vi','bốn năm một lần','tư cách dự giải','lõi tâm','Ai-chan']])test(locale+' New Game story keeps the approved core and Ai-chan\'s name',()=>{
 try{
  setLocale(locale);const chapter=openingPrologueChapter(),pages=chapter.beats.map(beat=>resolveOpeningStoryText(beat.text));
  assert.ok(pages.every(page=>typeof page==='string'&&page.trim().length>0));
  const all=pages.join('\n');
  for(const phrase of [four,eligibility,heartCore,name])assert.ok(all.includes(phrase),locale+' '+phrase);
  assert.ok(!/數碼獸|數碼寶貝|Digimon|デジモン|ดิจิมอน|愛將|澄音/i.test(all));
  for(const choice of chapter.beats.flatMap(beat=>beat.choices))assert.ok(resolveOpeningStoryText(choice.label).length>0);
 }finally{setLocale('zh-Hant');}
});
import {openingPrologueChapter,resolveOpeningStoryText} from '../src/championship/app/openingStoryPresentation.js';
test('five-language opening gift letters and egg naming use central terms without rewriting player input',()=>{
 const tamer='從現在起，你也是數碼獸馴獸師了。\n與夥伴一起，朝冠軍賽優勝邁進吧！\n贈禮應該就快送到了。',egg='這顆數碼蛋送給你。\n請替牠取個名字。';
 try{for(const locale of ['zh-Hant','en','ja','th','vi']){
  setLocale(locale);const terms=getOpeningBrandTerms(locale),letters=[openingStoryText(tamer),openingStoryText(egg),openingStoryText('請替數碼蛋取名字')];
  assert.ok(letters[0].includes(terms.creature));assert.ok(letters.slice(1).every(t=>t.includes(terms.egg)));
  assert.ok(letters.every(t=>! /數碼獸|數碼蛋|Digimon|Digi[- ]?Egg|デジモン|デジタマ|ดิจิมอน/i.test(t)));
  assert.equal(openingStoryText('數碼獸小蛋'),'數碼獸小蛋');
 }
 setLocale('zh-Hant');assert.equal(setLocale('unsupported'),false);
 assert.equal(openingStoryText(egg),'這顆培育蛋就交給你保管囉！\n快幫裡頭的小傢伙取個響亮的名字吧。');
 assert.equal(openingStoryText(tamer).split('\n')[0],'從今天起，你也是正式的拍檔馴獸師了！');
 assert.equal(getOpeningBrandTerms('unsupported').egg,'培育蛋');
 }finally{setLocale('zh-Hant');}
});
test('the approved zh-Hant story is used verbatim, page by page, in the package order',()=>{
 setLocale('zh-Hant');
 const pages=openingPrologueChapter().beats.map(beat=>resolveOpeningStoryText(beat.text));
 assert.equal(pages[0],'每天都有數不清的片段掉進網線深處——旅途中隨手拍下的暮色、剛端上桌的晚飯香氣，還有凌晨兩點反覆打完又刪掉、始終沒勇氣寄出的那句話。');
 assert.equal(pages[8],'連線接通！嗨嗨，我是愛醬，從今天起就是你的專屬導覽員喔！');assert.equal(pages[9],'等、等等……貓居然開口說話了？！');
 assert.equal(pages[10],'哎呀，嚇到你啦？換成這個樣子，會不會比較好講話呢？');assert.equal(pages[12],'嘿嘿，那現在可以專心聽我帶路了嗎？');
 assert.equal(pages.at(-1),'前方的賽場有多艱險、裂隙深處藏著什麼真相，誰都說不準。但當你偏過頭，牠依然牢牢守在你腳邊。那麼——就從今天起，去寫下只屬於你們的故事吧。');
});
