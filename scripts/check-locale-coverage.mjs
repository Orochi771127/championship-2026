#!/usr/bin/env node
// English coverage report for the display text (settings round, 2026-09-29).
//
// Every zh-Hant string literal in src/championship that reaches the screen is
// a source key of the text layer (uiText). This scans the source for them and
// checks each against the English tables, so a new string without English is
// found by a command instead of by a player. Catalog text (help, shop, title
// events, raising mail, tutorial) is checked record by record against its own
// English file. Proper nouns without an approved English name are listed
// separately: they are shown in their approved zh-Hant form on purpose.
//
//   node scripts/check-locale-coverage.mjs            prints a summary, exits 1 on gaps
//   node scripts/check-locale-coverage.mjs --json F   also writes the report to F

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "src/championship");
const HAN = /[㐀-鿿豈-﫿]/;

// Text-layer files hold the tables themselves.
const TABLE_FILES = /[\\/]text[\\/].+\.js$/;

// Literals that are data, not display text: the Password Battle alphabets
// (the codec's character sets) and a list separator.
const NOT_DISPLAY = [
  (text, file) => /nativePasswordBattle\.js$/.test(file) && !/[。？]$/.test(text),
  (text) => text === "、"
];

export function scanLiterals(dir = SOURCE) {
  const found = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".js") && !TABLE_FILES.test(file)) found.push(...literalsOf(file));
    }
  };
  walk(dir);
  return found;
}

/** String literals with Han characters, with their line, skipping comments. */
function literalsOf(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  let i = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line += 1; i += 1; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i += 1; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line += 1; i += 1; } i += 2; continue; }
    if (c === "\"" || c === "'" || c === "`") {
      const quote = c, startLine = line;
      let text = "", raw = "", interpolated = false;
      i += 1;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") { raw += src[i] + src[i + 1]; i += 2; continue; }
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          interpolated = true;
          let depth = 1; i += 2;
          while (i < src.length && depth > 0) { if (src[i] === "{") depth += 1; else if (src[i] === "}") depth -= 1; if (src[i] === "\n") line += 1; i += 1; }
          raw += "${}";
          continue;
        }
        if (src[i] === "\n") line += 1;
        raw += src[i]; i += 1;
      }
      i += 1;
      if (!HAN.test(raw)) continue;
      // Resolve the escapes a key can carry (\n, \", \').
      text = raw.replace(/\\n/g, "\n").replace(/\\(["'`\\])/g, "$1");
      out.push({ file: path.relative(root, file).replace(/\\/g, "/"), line: startLine, text, interpolated });
    }
    else i += 1;
  }
  return out;
}

export async function buildLocaleCoverage() {
  const { UI_COPY } = await import("../src/championship/text/uiText.js");
  const uiEn = await import("../src/championship/text/uiText.en.js");
  const uiJa = await import("../src/championship/text/uiText.ja.js");
  const uiTh = await import("../src/championship/text/uiText.th.js");
  const uiVi = await import("../src/championship/text/uiText.vi.js");

  const catalogsZh = await import("../src/championship/text/catalogs.zhHant.js");
  const catalogsEn = await import("../src/championship/text/catalogs.en.js");
  const catalogsJa = await import("../src/championship/text/catalogs.ja.js");
  const catalogsTh = await import("../src/championship/text/catalogs.th.js");
  const catalogsVi = await import("../src/championship/text/catalogs.vi.js");

  const tutorialZh = await import("../src/championship/text/tutorialMessages.zhHant.js");
  const tutorialEn = await import("../src/championship/text/tutorialMessages.en.js");
  const tutorialJa = await import("../src/championship/text/tutorialMessages.ja.js");
  const tutorialTh = await import("../src/championship/text/tutorialMessages.th.js");
  const tutorialVi = await import("../src/championship/text/tutorialMessages.vi.js");

  const raisingEn = await import("../src/championship/text/raisingMessages.en.js");
  const raisingJa = await import("../src/championship/text/raisingMessages.ja.js");
  const raisingTh = await import("../src/championship/text/raisingMessages.th.js");
  const raisingVi = await import("../src/championship/text/raisingMessages.vi.js");

  const gameEn = await import("../src/championship/text/gameText.en.js");
  const gameJa = await import("../src/championship/text/gameText.ja.js");
  const gameTh = await import("../src/championship/text/gameText.th.js");
  const gameVi = await import("../src/championship/text/gameText.vi.js");

  const literals = scanLiterals().filter((entry) => !NOT_DISPLAY.some((rule) => rule(entry.text, entry.file)));
  const interpolatedZh = literals.filter((entry) => entry.interpolated);
  const plain = literals.filter((entry) => !entry.interpolated);
  const distinct = new Set(plain.map((entry) => entry.text));

  const localesConfig = {
    "zh-Hant": {
      uiCopy: UI_COPY,
      text: {},
      properNouns: new Set(plain.map((e) => e.text)),
      catalogs: {
        shopNames: catalogsZh.SHOP_NAMES_ZH,
        shopDescriptions: catalogsZh.SHOP_DESCRIPTIONS_ZH,
        help: catalogsZh.HELP_ZH,
        titleEvents: catalogsZh.TITLE_EVENTS_ZH
      },
      tutorial: {
        lines: tutorialZh.TUTORIAL_TEXT_IDS.reduce((acc, id) => ({ ...acc, [id]: tutorialZh.tutorialLine(id) }), {}),
        prompts: tutorialZh.TUTORIAL_PROMPT_ACTIONS.reduce((acc, a) => ({ ...acc, [a]: tutorialZh.tutorialPrompt(a) }), {})
      },
      raising: {
        sequential: new Array(63).fill("ok"),
        seasons: new Array(16).fill("ok"),
        random: new Array(10).fill("ok"),
        extra: new Array(20).fill("ok"),
        senders: new Array(13).fill("ok")
      },
      game: {
        cages: new Array(36).fill("ok"),
        gates: new Array(17).fill("ok")
      }
    },
    "en": {
      uiCopy: uiEn.UI_COPY_EN,
      text: uiEn.TEXT_EN,
      properNouns: uiEn.UNTRANSLATED_PROPER_NOUNS,
      catalogs: {
        shopNames: catalogsEn.SHOP_NAMES_EN,
        shopDescriptions: catalogsEn.SHOP_DESCRIPTIONS_EN,
        help: catalogsEn.HELP_EN,
        titleEvents: catalogsEn.TITLE_EVENTS_EN
      },
      tutorial: {
        lines: tutorialEn.TUTORIAL_LINES_EN,
        prompts: tutorialEn.TUTORIAL_PROMPTS_EN
      },
      raising: {
        sequential: raisingEn.SEQUENTIAL_EN,
        seasons: raisingEn.SEASONS_EN,
        random: raisingEn.RANDOM_EN,
        extra: Object.values(raisingEn.EXTRA_EN),
        senders: raisingEn.SENDERS_EN
      },
      game: {
        cages: Object.values(gameEn.CAGE_NAMES_EN),
        gates: Object.values(gameEn.GATE_NAMES_EN)
      }
    },
    "ja": {
      uiCopy: uiJa.UI_COPY_JA,
      text: uiJa.TEXT_JA,
      properNouns: uiJa.UNTRANSLATED_PROPER_NOUNS_JA,
      catalogs: {
        shopNames: catalogsJa.SHOP_NAMES_JA,
        shopDescriptions: catalogsJa.SHOP_DESCRIPTIONS_JA,
        help: catalogsJa.HELP_JA,
        titleEvents: catalogsJa.TITLE_EVENTS_JA
      },
      tutorial: {
        lines: tutorialJa.TUTORIAL_LINES_JA,
        prompts: tutorialJa.TUTORIAL_PROMPTS_JA
      },
      raising: {
        sequential: raisingJa.SEQUENTIAL_JA ?? raisingJa.SEQUENTIAL,
        seasons: raisingJa.SEASONS_JA ?? raisingJa.SEASONS,
        random: raisingJa.RANDOM_JA ?? raisingJa.RANDOM,
        extra: Object.values(raisingJa.EXTRA_JA ?? raisingJa.EXTRA),
        senders: raisingJa.SENDERS_JA ?? raisingJa.SENDERS
      },
      game: {
        cages: Object.values(gameJa.CAGE_NAMES_JA),
        gates: Object.values(gameJa.GATE_NAMES_JA)
      }
    },
    "th": {
      uiCopy: uiTh.UI_COPY_TH,
      text: uiTh.TEXT_TH,
      properNouns: uiTh.UNTRANSLATED_PROPER_NOUNS_TH,
      catalogs: {
        shopNames: catalogsTh.SHOP_NAMES_TH,
        shopDescriptions: catalogsTh.SHOP_DESCRIPTIONS_TH,
        help: catalogsTh.HELP_TH,
        titleEvents: catalogsTh.TITLE_EVENTS_TH
      },
      tutorial: {
        lines: tutorialTh.TUTORIAL_LINES_TH,
        prompts: tutorialTh.TUTORIAL_PROMPTS_TH
      },
      raising: {
        sequential: raisingTh.SEQUENTIAL_TH ?? raisingTh.SEQUENTIAL,
        seasons: raisingTh.SEASONS_TH ?? raisingTh.SEASONS,
        random: raisingTh.RANDOM_TH ?? raisingTh.RANDOM,
        extra: Object.values(raisingTh.EXTRA_TH ?? raisingTh.EXTRA),
        senders: raisingTh.SENDERS_TH ?? raisingTh.SENDERS
      },
      game: {
        cages: Object.values(gameTh.CAGE_NAMES_TH),
        gates: Object.values(gameTh.GATE_NAMES_TH)
      }
    },
    "vi": {
      uiCopy: uiVi.UI_COPY_VI,
      text: uiVi.TEXT_VI,
      properNouns: uiVi.UNTRANSLATED_PROPER_NOUNS_VI,
      catalogs: {
        shopNames: catalogsVi.SHOP_NAMES_VI,
        shopDescriptions: catalogsVi.SHOP_DESCRIPTIONS_VI,
        help: catalogsVi.HELP_VI,
        titleEvents: catalogsVi.TITLE_EVENTS_VI
      },
      tutorial: {
        lines: tutorialVi.TUTORIAL_LINES_VI,
        prompts: tutorialVi.TUTORIAL_PROMPTS_VI
      },
      raising: {
        sequential: raisingVi.SEQUENTIAL_VI ?? raisingVi.SEQUENTIAL,
        seasons: raisingVi.SEASONS_VI ?? raisingVi.SEASONS,
        random: raisingVi.RANDOM_VI ?? raisingVi.RANDOM,
        extra: Object.values(raisingVi.EXTRA_VI ?? raisingVi.EXTRA),
        senders: raisingVi.SENDERS_VI ?? raisingVi.SENDERS
      },
      game: {
        cages: Object.values(gameVi.CAGE_NAMES_VI),
        gates: Object.values(gameVi.GATE_NAMES_VI)
      }
    }
  };

  const byLocale = {};
  let totalMissing = [];
  let totalUiCopyMissing = [];
  let totalCatalogGaps = [];

  for (const [locale, cfg] of Object.entries(localesConfig)) {
    const covered = (t) => Object.hasOwn(cfg.text, t) || Object.hasOwn(cfg.uiCopy, t) || cfg.properNouns.has(t);
    const missing = plain.filter((entry) => !covered(entry.text));
    const uiCopyGaps = Object.keys(UI_COPY).filter((key) => !Object.hasOwn(cfg.uiCopy, key));

    const gaps = [];
    const compare = (name, zh, target, key = (row, index) => index) => {
      zh.forEach((row, index) => {
        const k = key(row, index);
        const val = Array.isArray(target) ? target[k] : target?.[k];
        if (val === undefined || val === null || val === "") gaps.push(`${locale}:${name}[${k}]`);
      });
    };

    compare("SHOP_NAMES", catalogsZh.SHOP_NAMES_ZH, cfg.catalogs.shopNames);
    compare("SHOP_DESCRIPTIONS", catalogsZh.SHOP_DESCRIPTIONS_ZH, cfg.catalogs.shopDescriptions);
    compare("HELP.title", catalogsZh.HELP_ZH, (cfg.catalogs.help || []).map((row) => row.title));
    catalogsZh.HELP_ZH.forEach((row, index) => {
      if (row.body && !cfg.catalogs.help[index]?.body) gaps.push(`${locale}:HELP.body[${index}]`);
    });
    compare("TITLE_EVENTS.name", catalogsZh.TITLE_EVENTS_ZH, (cfg.catalogs.titleEvents || []).map((row) => row.name));
    compare("TITLE_EVENTS.description", catalogsZh.TITLE_EVENTS_ZH, (cfg.catalogs.titleEvents || []).map((row) => row.description));

    for (const id of tutorialZh.TUTORIAL_TEXT_IDS) {
      if (!cfg.tutorial.lines?.[id]) gaps.push(`${locale}:TUTORIAL[${id}]`);
    }
    for (const action of tutorialZh.TUTORIAL_PROMPT_ACTIONS) {
      if (!cfg.tutorial.prompts?.[action]) gaps.push(`${locale}:TUTORIAL_PROMPT[${action}]`);
    }

    if (cfg.raising.sequential.length < 63) gaps.push(`${locale}:RAISING_SEQUENTIAL`);
    if (cfg.raising.seasons.length < 16) gaps.push(`${locale}:RAISING_SEASONS`);
    if (cfg.raising.random.length < 10) gaps.push(`${locale}:RAISING_RANDOM`);
    if (cfg.raising.extra.length < 20) gaps.push(`${locale}:RAISING_EXTRA`);
    if (cfg.raising.senders.length < 13) gaps.push(`${locale}:RAISING_SENDERS`);
    if (cfg.game.cages.length < 36) gaps.push(`${locale}:GAME_CAGES`);
    if (cfg.game.gates.length < 17) gaps.push(`${locale}:GAME_GATES`);

    byLocale[locale] = {
      displayLiterals: plain.length,
      distinctDisplayStrings: distinct.size,
      translated: [...distinct].filter((text) => Object.hasOwn(cfg.text, text) || Object.hasOwn(cfg.uiCopy, text)).length,
      properNounsKept: [...distinct].filter((text) => cfg.properNouns.has(text)).length,
      missing: new Set(missing.map((e) => e.text)).size,
      uiCopyKeys: Object.keys(cfg.uiCopy).length,
      uiCopyMissing: uiCopyGaps.length,
      catalogGaps: gaps.length,
      catalogRecords: {
        shopNames: cfg.catalogs.shopNames.length,
        shopDescriptions: cfg.catalogs.shopDescriptions.length,
        help: cfg.catalogs.help.length,
        titleEvents: cfg.catalogs.titleEvents.length,
        tutorialLines: Object.keys(cfg.tutorial.lines).length,
        tutorialPrompts: Object.keys(cfg.tutorial.prompts).length,
        raisingMail: cfg.raising.sequential.length + cfg.raising.seasons.length + cfg.raising.random.length + cfg.raising.extra.length,
        cages: cfg.game.cages.length,
        gates: cfg.game.gates.length
      }
    };

    totalMissing.push(...missing);
    totalUiCopyMissing.push(...uiCopyGaps.map((k) => `${locale}:${k}`));
    totalCatalogGaps.push(...gaps);
  }

  const enSummary = byLocale["en"];
  const counts = {
    displayLiterals: plain.length,
    distinctDisplayStrings: distinct.size,
    translated: enSummary.translated,
    properNounsKeptInZhHant: enSummary.properNounsKept,
    missing: new Set(totalMissing.map((entry) => entry.text)).size,
    interpolatedZhTemplates: interpolatedZh.length,
    uiCopyKeys: Object.keys(UI_COPY).length,
    uiCopyMissing: totalUiCopyMissing.length,
    catalogRecords: enSummary.catalogRecords,
    catalogGaps: totalCatalogGaps.length
  };

  return {
    schemaVersion: 2,
    generatedBy: "scripts/check-locale-coverage.mjs",
    locales: ["zh-Hant", "en", "ja", "th", "vi"],
    counts,
    byLocale,
    missing: [...new Map(totalMissing.map((entry) => [entry.text, entry])).values()],
    interpolatedZh: interpolatedZh.map(({ file, line, text }) => ({ file, line, text })),
    uiCopyMissing: totalUiCopyMissing,
    catalogGaps: totalCatalogGaps,
    properNounPolicy: "Species names, starter automatic names, and personal names (浩司, 惠子) follow approved proper noun policy across locales."
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await buildLocaleCoverage();
  const at = process.argv.indexOf("--json");
  if (at > 0 && process.argv[at + 1]) {
    fs.mkdirSync(path.dirname(path.resolve(process.argv[at + 1])), { recursive: true });
    fs.writeFileSync(process.argv[at + 1], JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report.counts, null, 2));
  console.log("BY LOCALE:", JSON.stringify(report.byLocale, null, 2));
  for (const entry of report.missing) console.log(`MISSING ${entry.file}:${entry.line} ${JSON.stringify(entry.text)}`);
  for (const entry of report.interpolatedZh) console.log(`INTERPOLATED ${entry.file}:${entry.line} ${JSON.stringify(entry.text)}`);
  for (const key of report.uiCopyMissing) console.log(`UI_COPY_MISSING ${JSON.stringify(key)}`);
  for (const gap of report.catalogGaps) console.log(`CATALOG_GAP ${gap}`);
  process.exitCode = report.counts.missing || report.counts.uiCopyMissing || report.counts.catalogGaps ? 1 : 0;
}
