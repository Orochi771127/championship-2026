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
import { battleMenuLabels, cageName, gateName, generationName, helpText, shopItemName, speciesName, starterName, tamerRankName, titleEventText } from "../src/championship/text/zhHant.js";
import { raisingMessageSender, raisingMessageText } from "../src/championship/text/raisingMessages.zhHant.js";
import { tutorialLine, tutorialPrompt } from "../src/championship/text/tutorialMessages.zhHant.js";
import { buildLocaleCoverage } from "../scripts/check-locale-coverage.mjs";

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
