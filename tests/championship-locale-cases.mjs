// Settings round (2026-09-29): the display language. zh-Hant stays the source
// and the default; English comes from the *.en.js tables; a string without
// English falls back to its zh-Hant source (never undefined, never a key).
import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_LOCALE, LOCALES, formatDateTime, formatList, formatNumber, getLocale, onLocaleChange, pluralCategory, setLocale } from "../src/championship/text/locale.js";
import { UI_COPY, fillTemplate, listMissingTranslations, retranslate, setLabel, setText, templateParts, uiText } from "../src/championship/text/uiText.js";
import { UI_COPY_EN, TEXT_EN } from "../src/championship/text/uiText.en.js";
import { SPECIES_NAMES_ZH } from "../src/championship/text/catalogs.zhHant.js";
import { battleMenuLabels, cageName, gateName, generationName, helpText, shopItemName, speciesName, starterName, tamerRankName, titleEventText } from "../src/championship/text/zhHant.js";
import { raisingMessageSender, raisingMessageText } from "../src/championship/text/raisingMessages.zhHant.js";
import { tutorialLine, tutorialPrompt } from "../src/championship/text/tutorialMessages.zhHant.js";
import { buildLocaleCoverage } from "../scripts/check-locale-coverage.mjs";

function inEnglish(t) {
  setLocale("en");
  t.after(() => setLocale("zh-Hant"));
}

test("zh-Hant is the default and an unknown locale is refused", () => {
  assert.equal(DEFAULT_LOCALE, "zh-Hant");
  assert.deepEqual(LOCALES, ["zh-Hant", "en"]);
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
  assert.equal(speciesName(3), "Digi-Egg");
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
  setLocale("zh-Hant");
  retranslate(root);
  assert.equal(label.textContent, "返回牧場");
  stop();
});

test("every English design key has English, and the tables carry no empty entry", () => {
  for (const key of Object.keys(UI_COPY)) assert.ok(Object.hasOwn(UI_COPY_EN, key), key);
  for (const [key, value] of Object.entries(TEXT_EN)) {
    const values = typeof value === "string" ? [value] : Object.values(value);
    for (const text of values) assert.ok(typeof text === "string" && text.length > 0, key);
    // Every placeholder in the source reaches the English.
    const holes = [...key.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort();
    for (const text of values) assert.deepEqual([...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort(), holes, `placeholders of ${key}`);
  }
});

test("coverage: every display string in the source has English and every catalog record is translated", async () => {
  const report = await buildLocaleCoverage();
  assert.equal(report.counts.missing, 0, JSON.stringify(report.missing.slice(0, 5)));
  assert.equal(report.counts.uiCopyMissing, 0, JSON.stringify(report.uiCopyMissing));
  assert.equal(report.counts.catalogGaps, 0, JSON.stringify(report.catalogGaps));
  assert.ok(report.counts.distinctDisplayStrings > 600);
  // One template still builds zh-Hant around values: the rope names in the
  // hunt catalog. Its twelve results are translated one by one.
  assert.deepEqual(report.interpolatedZh.map((entry) => entry.file), ["src/championship/hunt/loadout/huntEquipmentCatalog.js"]);
  for (const grade of ["基礎", "強化", "高階", "頂級"]) for (const tier of ["α", "β", "γ"]) assert.ok(TEXT_EN[`${grade}捕捉繩 ${tier}`], `${grade}捕捉繩 ${tier}`);
});
