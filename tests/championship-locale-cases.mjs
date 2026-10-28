// Settings round (2026-09-29): the display language. zh-Hant stays the source
// and the default; English comes from the *.en.js tables; a string without
// English falls back to its zh-Hant source (never undefined, never a key).
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LOCALE, LOCALES, formatDateTime, formatList, formatNumber, getLocale, onLocaleChange, pluralCategory, setLocale } from "../src/championship/text/locale.js";
import { UI_COPY, fillTemplate, listMissingTranslations, retranslate, setLabel, setText, templateParts, uiText } from "../src/championship/text/uiText.js";
import { UI_COPY_EN, TEXT_EN } from "../src/championship/text/uiText.en.js";
import { UI_COPY_JA, TEXT_JA } from "../src/championship/text/uiText.ja.js";
import { UI_COPY_TH, TEXT_TH } from "../src/championship/text/uiText.th.js";
import { UI_COPY_VI, TEXT_VI } from "../src/championship/text/uiText.vi.js";
import { SPECIES_NAMES_ZH } from "../src/championship/text/catalogs.zhHant.js";
import { battleMenuLabels, cageName, gateName, generationName, helpText, shopItemName, shopItemDescription, speciesName, starterName, tamerRankName, titleEventText, raisingDisplayName } from "../src/championship/text/zhHant.js";
import { AWAKENED_FORM_NAMES, AWAKENED_RADAR_NAMES, GROWTH_STAGE_TERM_REVIEW } from "../src/championship/text/growthStageTerms.js";
import { nativeHuntAnalyzedFields, nativeHuntRadarMask, nativeHuntRadarMatches } from "../src/championship/hunt/loadout/nativeHuntPluginRules.js";
import { HUNT_PLUGIN_ITEMS } from "../src/championship/hunt/loadout/huntEquipmentCatalog.js";
import { raisingMessageSender, raisingMessageText } from "../src/championship/text/raisingMessages.zhHant.js";
import { tutorialLine, tutorialPrompt } from "../src/championship/text/tutorialMessages.zhHant.js";
import { buildLocaleCoverage, inspectScopedLocaleCopy } from "../scripts/check-locale-coverage.mjs";
import { DATABASE_STORY_COPY, DATABASE_ORIGINAL_PROFILES } from "../src/championship/database/databaseStories.js";

test('Owner display stage five is Awakened in all five locales; legacy UI keys remain compatible',t=>{
  t.after(()=>setLocale('zh-Hant'));
  const names={'zh-Hant':'覺醒體',en:'Awakened',ja:'覚醒体',th:'ร่างตื่นพลัง',vi:'Thức tỉnh'};
  for(const [locale,name] of Object.entries(names)){
    setLocale(locale);
    assert.equal(generationName(5),name);
    assert.equal(uiText('完全體'),name);
    assert.equal(uiText('覺醒體'),name);
    assert.equal(generationName(999),null);
  }
});

test('stage copy covers ropes, radar, analyzed fields, help and title restrictions without changing selectors',t=>{
  t.after(()=>setLocale('zh-Hant'));
  const radar=HUNT_PLUGIN_ITEMS.find(r=>r.pluginKind==='RADAR_SEARCH'&&r.nativeItemIndex===3);
  assert.equal(radar.displayName,AWAKENED_RADAR_NAMES['zh-Hant']);
  assert.equal(radar.capability.nativeRadarIndex,3);
  assert.equal(nativeHuntRadarMask([3]),8);
  assert.equal(nativeHuntRadarMatches(137,8),true);
  const fields=nativeHuntAnalyzedFields({speciesIndex:137,maxHp:345},['GENERATION','HP']);
  assert.equal(fields.generation,'覺醒體');assert.equal(fields.hp,'345');assert.equal(fields.family,'???');
  for(const locale of LOCALES){
    setLocale(locale);const name=AWAKENED_FORM_NAMES[locale];
    assert.equal(uiText(fields.generation),name);
    assert.equal(uiText(radar.displayName),AWAKENED_RADAR_NAMES[locale]);
    assert.equal(uiText('完全體雷達'),AWAKENED_RADAR_NAMES[locale]);
    for(const record of [13,14,15,70])assert.ok(shopItemDescription(record).toLowerCase().includes(name.toLowerCase()),`${locale} shop ${record}`);
    const helpStage=['th','vi'].includes(locale)?26:32;
    assert.equal(helpText(helpStage,'title'),name);
    for(const record of [10,27])assert.ok(titleEventText(record,'description').toLowerCase().includes(name.toLowerCase()),`${locale} event ${record}`);
  }
  assert.equal(GROWTH_STAGE_TERM_REVIEW.nativeSpeakerReview.th,false);
  assert.equal(GROWTH_STAGE_TERM_REVIEW.nativeSpeakerReview.vi,false);
});

test('stage aliases never rewrite placeholder names, ordinary perfect adjectives or other stages',t=>{
  t.after(()=>setLocale('zh-Hant'));
  const nickname='完全體 PERFECT Perfect Fighter';
  for(const locale of LOCALES){
    setLocale(locale);
    assert.ok(uiText('{name}，查看詳細資料',{name:nickname}).includes(nickname));
    assert.equal(fillTemplate('{name} / {stage}',{name:nickname,stage:AWAKENED_FORM_NAMES[locale]}),`${nickname} / ${AWAKENED_FORM_NAMES[locale]}`);
    assert.equal(raisingDisplayName({displayName:nickname,source:{kind:'COLLECTION'}}),nickname);
    assert.equal(uiText('Perfect Fighter'),'Perfect Fighter');
    assert.equal(uiText('完全に回復'),'完全に回復');
    assert.equal(uiText('perfect timing'),'perfect timing');
  }
  setLocale('en');assert.equal(generationName(6),'Ultimate');
  assert.equal(titleEventText(28,'name'),'Perfect Fighter');
  assert.ok(titleEventText(57,'description').includes('ultimate beauty'));
  setLocale('ja');assert.equal(generationName(6),'究極体');
});

function inEnglish(t) {
  setLocale("en");
  t.after(() => setLocale("zh-Hant"));
}

function inJapanese(t) {
  setLocale("ja");
  t.after(() => setLocale("zh-Hant"));
}

function inThai(t) {
  setLocale("th");
  t.after(() => setLocale("zh-Hant"));
}

function inVietnamese(t) {
  setLocale("vi");
  t.after(() => setLocale("zh-Hant"));
}

test("zh-Hant is the default and an unknown locale is refused", () => {
  assert.equal(DEFAULT_LOCALE, "zh-Hant");
  assert.deepEqual(LOCALES, ["zh-Hant", "en", "ja", "th", "vi"]);
  assert.equal(getLocale(), "zh-Hant");
  assert.equal(setLocale("fr"), false);
  assert.equal(getLocale(), "zh-Hant");
});

test("Chinese output is unchanged by the English layer", () => {
  assert.equal(uiText("SAVE"), "儲存");
  assert.equal(uiText("1,250 Bits"), "1,250 位元幣");
  assert.equal(uiText("{bits} 位元幣", { bits: 1250 }), "1,250 位元幣");
  assert.equal(uiText("第 {n} 日", { n: 3 }), "第 3 日");
  assert.equal(speciesName(34), SPECIES_NAMES_ZH[34]);
  assert.equal(gateName(1), "驅動莽原");
  assert.equal(raisingMessageText(196, "小蛋"), "小蛋 好像找到了什麼！");
});

test("English: design keys, zh-Hant sources, patterns, plurals and contexts", (t) => {
  inEnglish(t);
  assert.equal(uiText("SAVE"), "Save");
  assert.equal(uiText("SYSTEM"), "Menu");
  assert.equal(uiText("1,250 Bits"), "1,250 Bits");
  assert.equal(uiText("Spring — Day 3"), "Spring · Day 3");
  assert.equal(uiText("返回牧場"), "Back to ranch");
  assert.equal(uiText("{bits} 位元幣", { bits: 1250 }), "1,250 Bits");
  assert.equal(uiText("今日有 {count} 場頭銜賽，開啟對戰選單", { count: 1 }), "1 title match today. Open the Battle menu");
  assert.equal(uiText("今日有 {count} 場頭銜賽，開啟對戰選單", { count: 4 }), "4 title matches today. Open the Battle menu");
  assert.equal(uiText("關閉"), "Close");
  assert.equal(uiText("關閉", { context: "state" }), "Off");
  assert.equal(uiText("資料", { context: "menu" }), "Reference");
  assert.equal(uiText("資料"), "Data");
  assert.deepEqual(templateParts("第 {n} 日"), ["Day", ""]);
});

test("English keeps player names and approved proper nouns, and never shows a key", (t) => {
  inEnglish(t);
  assert.equal(uiText("{name}，查看詳細資料", { name: "小蛋" }), "小蛋, see details", "a player's name is inserted as typed");
  assert.equal(speciesName(34), SPECIES_NAMES_ZH[34], "species names keep their approved zh-Hant form");
  assert.equal(speciesName(3), "Creature Egg");
  assert.equal(starterName("デジデジ"), "迪吉迪吉");
  const before = listMissingTranslations().length;
  uiText(SPECIES_NAMES_ZH[40]);
  assert.equal(listMissingTranslations().length, before, "an approved proper noun is not a missing translation");
  assert.equal(uiText("完全不存在的字串"), "完全不存在的字串", "an untranslated string falls back to its source");
  assert.ok(listMissingTranslations().includes("完全不存在的字串"), "and is recorded for the report");
  assert.equal(uiText(undefined), undefined);
  assert.equal(fillTemplate("{a} and {b}", { a: 1 }), "1 and {b}", "an absent value leaves the slot visible, not 'undefined'");
});

test("English catalogs: names, help, events, shop, mail, tutorial", (t) => {
  inEnglish(t);
  assert.equal(gateName(0), "Dyna Grassland");
  assert.equal(cageName(18), "Hot Spring");
  assert.equal(generationName(6), "Ultimate");
  assert.equal(tamerRankName(9), "Master");
  assert.equal(helpText(20, "title"), "Capture basics");
  assert.equal(titleEventText(8, "name"), "Spring Ace");
  assert.equal(shopItemName(0), "Feed");
  assert.equal(battleMenuLabels().chooseMatch, "Choose a match");
  assert.equal(raisingMessageText(196, "Pico"), "Pico seems to have found something!");
  assert.equal(raisingMessageSender(4), "Shop Manager");
  assert.equal(raisingMessageSender(5), "浩司", "a personal name without an approved English form");
  assert.equal(tutorialLine(1500), "First, choose the meat icon.");
  assert.equal(tutorialPrompt("ROPE_ENCLOSE"), "Circle it with the rope");
});

test("Japanese: design keys, catalogs, shop, tutorial, and battle", (t) => {
  inJapanese(t);
  assert.equal(uiText("SAVE"), "セーブ");
  assert.equal(uiText("1,250 Bits"), "1,250 Bits");
  assert.equal(gateName(0), "ダイナ草原");
  assert.equal(cageName(18), "温泉");
  assert.equal(generationName(6), "究極体");
  assert.equal(tamerRankName(9), "マスター");
  assert.equal(shopItemName(0), "エサ");
  assert.equal(battleMenuLabels().chooseMatch, "対戦を選択");
  assert.equal(raisingMessageSender(4), "ショップ店長");
  assert.equal(tutorialPrompt("ROPE_ENCLOSE"), "ロープで囲む");
  assert.equal(speciesName(3), "タマゴ");
});

test("Thai: design keys, catalogs, shop, tutorial, and Gregorian calendar dates", (t) => {
  inThai(t);
  assert.equal(uiText("SAVE"), "บันทึก");
  assert.equal(uiText("1,250 Bits"), "1,250 Bits");
  assert.equal(gateName(0), "ทุ่งหญ้าไดนา");
  assert.equal(cageName(18), "น้ำพุร้อน");
  assert.equal(generationName(6), "ขั้นสุดยอด");
  assert.equal(tamerRankName(9), "มาสเตอร์");
  assert.equal(shopItemName(0), "อาหาร");
  assert.equal(battleMenuLabels().chooseMatch, "เลือกการแข่งขัน");
  assert.equal(raisingMessageSender(4), "ผู้จัดการร้านค้า");
  assert.equal(tutorialPrompt("ROPE_ENCLOSE"), "ใช้เชือกล้อม");
  assert.equal(speciesName(3), "ไข่");
  // Explicit Western Gregorian calendar verification: must format with 2026, not Buddhist Era (2569)
  const dt = formatDateTime("2026-09-29T08:05:00Z");
  assert.match(dt, /2026/, "Thai date format must remain Gregorian 2026");
});

test("Vietnamese: design keys, catalogs, shop, tutorial, and battle", (t) => {
  inVietnamese(t);
  assert.equal(uiText("SAVE"), "Lưu");
  assert.equal(uiText("1,250 Bits"), "1,250 Bits");
  assert.equal(gateName(0), "Đồng cỏ Dyna");
  assert.equal(cageName(18), "Suối nước nóng");
  assert.equal(generationName(6), "Tối hậu");
  assert.equal(tamerRankName(9), "Bậc thầy");
  assert.equal(shopItemName(0), "Thức ăn");
  assert.equal(battleMenuLabels().chooseMatch, "Chọn trận đấu");
  assert.equal(raisingMessageSender(4), "Chủ cửa hàng");
  assert.equal(tutorialPrompt("ROPE_ENCLOSE"), "Dùng dây thừng khoanh vùng");
  assert.equal(speciesName(3), "Trứng");
});

test("numbers, dates, lists and plurals follow the language", (t) => {
  assert.equal(formatNumber(9999999), "9,999,999");
  assert.equal(formatList(["甲", "乙", "丙"]), "甲、乙、丙");
  assert.match(formatDateTime("2026-09-29T08:05:00Z"), /2026/);
  inEnglish(t);
  assert.equal(formatList(["A", "B", "C"]), "A, B, and C");
  assert.equal(pluralCategory(1), "one");
  assert.equal(pluralCategory(2), "other");
  assert.equal(formatDateTime("not a date"), null);
});

test("long-lived labels relabel in place when the language changes", () => {
  class Node {
    constructor() { this.children = []; this.attributes = {}; this.textContent = ""; }
    get childElementCount() { return this.children.length; }
    get childNodes() { return []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    querySelectorAll() { return this.children; }
  }
  const root = new Node();
  const label = new Node();
  const button = new Node();
  root.children.push(label, button);
  setText(label, "返回牧場");
  setLabel(button, "aria-label", "第 {n} 日", { n: 2 });
  assert.equal(label.textContent, "返回牧場");
  let heard = null;
  const stop = onLocaleChange((locale) => { heard = locale; });
  setLocale("en");
  assert.equal(heard, "en");
  assert.equal(retranslate(root), 2);
  assert.equal(label.textContent, "Back to ranch");
  assert.equal(button.attributes["aria-label"], "Day 2");
  setLocale("ja");
  retranslate(root);
  assert.equal(label.textContent, "牧場に戻る");
  setLocale("zh-Hant");
  retranslate(root);
  assert.equal(label.textContent, "返回牧場");
  stop();
});

test("every design key and text table carries no empty entry across all languages", () => {
  for (const [lang, uiCopy, textTable] of [
    ["en", UI_COPY_EN, TEXT_EN],
    ["ja", UI_COPY_JA, TEXT_JA],
    ["th", UI_COPY_TH, TEXT_TH],
    ["vi", UI_COPY_VI, TEXT_VI]
  ]) {
    for (const key of Object.keys(UI_COPY)) {
      assert.ok(Object.hasOwn(uiCopy, key), `${lang}: missing UI_COPY[${key}]`);
    }
    for (const [key, value] of Object.entries(textTable)) {
      const values = typeof value === "string" ? [value] : Object.values(value);
      for (const text of values) assert.ok(typeof text === "string" && text.length > 0, `${lang}: empty TEXT[${key}]`);
      const holes = [...key.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort();
      for (const text of values) {
        assert.deepEqual([...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort(), holes, `${lang}: placeholders of ${key}`);
      }
    }
  }
});

test("coverage: every display string in the source and catalog record is translated across all 5 locales", async () => {
  const report = await buildLocaleCoverage();
  assert.equal(report.counts.missing, 0, JSON.stringify(report.missing.slice(0, 5)));
  assert.equal(report.counts.uiCopyMissing, 0, JSON.stringify(report.uiCopyMissing));
  assert.equal(report.counts.catalogGaps, 0, JSON.stringify(report.catalogGaps));
  assert.ok(report.counts.distinctDisplayStrings > 600);
  assert.deepEqual(report.locales, ["zh-Hant", "en", "ja", "th", "vi"]);
  for (const loc of report.locales) {
    assert.equal(report.byLocale[loc].missing, 0, `${loc} has missing strings`);
    assert.equal(report.byLocale[loc].uiCopyMissing, 0, `${loc} has missing UI copy`);
    assert.equal(report.byLocale[loc].catalogGaps, 0, `${loc} has catalog gaps`);
  }
  // One template still builds zh-Hant around values: the rope names in the hunt catalog.
  assert.deepEqual(report.interpolatedZh.map((entry) => entry.file), ["src/championship/hunt/loadout/huntEquipmentCatalog.js"]);
  for (const grade of ["基礎", "強化", "高階", "頂級"]) for (const tier of ["α", "β", "γ"]) assert.ok(TEXT_EN[`${grade}捕捉繩 ${tier}`], `${grade}捕捉繩 ${tier}`);
});

test('Dex named dictionaries validate every locale and keep stray literals outside the coverage exemption',async()=>{
  const file='src/championship/database/databaseStories.js';
  const checked=inspectScopedLocaleCopy(file,DATABASE_STORY_COPY);
  assert.equal(checked.keys.length,26);assert.deepEqual(checked.gaps,[]);
  for(const locale of LOCALES){
    assert.ok(Object.isFrozen(DATABASE_STORY_COPY[locale]));
    for(const text of Object.values(DATABASE_STORY_COPY[locale]))assert.equal(checked.covers({file,text}),true);
    const missing=JSON.parse(JSON.stringify(DATABASE_STORY_COPY));delete missing[locale].storyHeading;
    assert.deepEqual(inspectScopedLocaleCopy(file,missing).gaps,[`${locale}:SCOPED_COPY[${file}:storyHeading]`]);
    missing[locale].storyHeading=DATABASE_STORY_COPY[locale].storyHeading;missing[locale]['field.cost']=' ';
    assert.deepEqual(inspectScopedLocaleCopy(file,missing).gaps,[`${locale}:SCOPED_COPY[${file}:field.cost]`]);
  }
  assert.equal(checked.covers({file,text:'這是尚未翻譯的新顯示文字'}),false);
  assert.equal(checked.covers({file:'src/championship/app/not-a-dictionary.js',text:DATABASE_STORY_COPY['zh-Hant'].storyHeading}),false);
  const profileFile='src/data/championship/database-original-profiles.r1.json';
  const profileCopy=Object.fromEntries(LOCALES.map(locale=>[locale,Object.fromEntries(DATABASE_ORIGINAL_PROFILES.entries.map(entry=>[entry.speciesId,entry.textByLocale[locale]]))]));
  assert.equal(inspectScopedLocaleCopy(profileFile,profileCopy).keys.length,216);
  for(const locale of LOCALES){
    const missing=JSON.parse(JSON.stringify(profileCopy));delete missing[locale]['species-008'];
    assert.deepEqual(inspectScopedLocaleCopy(profileFile,missing).gaps,[`${locale}:SCOPED_COPY[${profileFile}:species-008]`]);
  }
  const report=await buildLocaleCoverage();
  assert.deepEqual(report.scopedCopy.find(row=>row.file===file),{file,keyCount:26,gaps:[]});
  assert.deepEqual(report.scopedCopy.find(row=>row.file===profileFile),{file:profileFile,keyCount:216,gaps:[]});
  assert.equal(report.counts.missing,0);assert.equal(report.counts.catalogGaps,0);
});

// Owner-requested 2026-10-16: remove age-descriptive 幼 only from canonical character names.
import { speciesNameForId as ageRenameSpeciesNameForId } from '../src/championship/text/zhHant.js';
import { SPECIAL_SPECIES_NAMES_ZH as ageRenameSpecialNames } from '../src/championship/text/catalogs.zhHant.js';
import { listProductExtensions as ageRenameExtensions } from '../src/championship/contracts/productSpeciesExtensions.js';
const AGE_NAME_RENAMES = Object.freeze([{"speciesIndex":31,"old":"焰角幼龍","new":"噴火仔"},{"speciesIndex":40,"old":"霜裘幼龍","new":"毛皮龍"},{"speciesIndex":44,"old":"葉角幼蟲","new":"菜蟲仔"},{"speciesIndex":54,"old":"花藤幼姬","new":"阿花仔"},{"speciesIndex":58,"old":"聖鈴幼犬","new":"鈴鐺狗"},{"speciesIndex":61,"old":"雪晶幼龍","new":"堆雪龍"},{"speciesIndex":63,"old":"翠冠幼龍","new":"綠冠龍"},{"speciesIndex":64,"old":"曦冕幼獅","new":"火鬃獅"},{"speciesIndex":66,"old":"灰燼幼龍","new":"黑炭龍"},{"speciesIndex":67,"old":"幻紋幼獸","new":"花紋狗"},{"speciesIndex":70,"old":"星角幼龍","new":"樂天龍"},{"speciesIndex":71,"old":"裂焰幼龍","new":"大嘴龍"}]);


test('canonical character names omit age descriptor without changing species identity in five locales', t => {
  t.after(() => setLocale('zh-Hant'));
  for (const locale of LOCALES) {
    setLocale(locale);
    for (const {speciesIndex, old, new: name} of AGE_NAME_RENAMES) {
      assert.equal(SPECIES_NAMES_ZH[speciesIndex], name);
      assert.equal(speciesName(speciesIndex), name);
      assert.equal(ageRenameSpeciesNameForId(`species-${speciesIndex}`), name);
      assert.equal(ageRenameSpeciesNameForId(`championship:creature:species-${speciesIndex}`), name);
      assert.equal(raisingDisplayName({speciesId:`species-${speciesIndex}`, displayName:old}), old, 'player nickname is never migrated');
    }
  }
});

test('renamed canonical characters have no name collisions including special forms and extensions', () => {
  const names = {...SPECIES_NAMES_ZH, ...ageRenameSpecialNames};
  for (const e of ageRenameExtensions()) names[e.speciesIndex] = e.displayNameZh;
  for (const {speciesIndex, new:name} of AGE_NAME_RENAMES) {
    assert.deepEqual(Object.entries(names).filter(([,n]) => n === name).map(([id]) => Number(id)), [speciesIndex]);
  }
  assert.equal(Object.values(SPECIES_NAMES_ZH).some(name => name.includes('幼')), false);
});

test('title-event references use renamed proper names in every locale without replacing growth stages', t => {
  t.after(() => setLocale('zh-Hant'));
  for (const locale of LOCALES) {
    setLocale(locale);
    const descriptions = Array.from({length:80}, (_,i) => titleEventText(i, 'description')).filter(Boolean).join('\n');
    assert.ok(descriptions.includes('堆雪龍'));
    assert.ok(descriptions.includes('花紋狗'));
    for (const {old} of AGE_NAME_RENAMES) assert.equal(descriptions.includes(old), false);
  }
  setLocale('zh-Hant');
  assert.equal(generationName(1), '幼年期Ⅰ');
  assert.equal(generationName(2), '幼年期Ⅱ');
  assert.equal(uiText('幼年期 I'), '幼年期 I');
  assert.equal(uiText('幼年期 II'), '幼年期 II');
});
