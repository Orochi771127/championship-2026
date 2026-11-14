#!/usr/bin/env node
// One-off source transform (Owner brief 2026-11-11): make 設定 → 文字大小 reach every sheet.
//
// The reading-size preference multiplies --text-scale (tokens.css). Sheets written after the
// 2026-09-29 settings round typed their sizes as literal pixels, so at 130% less than half of
// the text on the ranch, the menus, the battle menu and the licence grew. This rewrites
//   font-size: 13px            →  font-size: calc(13px * var(--text-scale, 1))
//   font: 800 13px/1 <family>  →  font: 800 calc(13px * var(--text-scale, 1))/1 <family>
// Live HUD sheets (a fight or a hunt in progress) use --text-scale-hud, half the step, so a
// larger reading size cannot push a key off a 667x375 screen. At 100% every computed value
// is unchanged. Sizes already built from var(), calc(), clamp(), min() or max() are left.
//
//   node scripts/qa/apply-text-scale.mjs [--check]
//
// --check exits 1 when a listed sheet still has a literal pixel size (used by the settings cases).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const READING_SHEETS = Object.freeze([
  'src/championship/app/ui/screenLayout.css', 'src/championship/app/ui/layoutSets.css', 'src/championship/app/cyberGacha.css',
  'src/championship/app/ui/storyTheater.css', 'src/championship/app/ui/storyVn.css', 'src/championship/app/ui/social.css',
  'src/championship/app/ui/journey.css', 'src/championship/app/ui/juicyShowcase.css', 'src/championship/app/ui/online.css',
  'src/championship/app/ui/taxonomy.css', 'src/championship/app/ui/arcade.css', 'src/championship/app/ui/arcadeMotion.css',
  'src/championship/app/ui/ceremony.css', 'src/championship/app/styles.css', 'src/championship/app/vs2Styles.css',
  'src/championship/app/vs5Styles.css', 'src/championship/app/intRh2Styles.css', 'src/championship/app/daylightSkin.css',
  'src/championship/app/medalCollection.css'
]);
export const HUD_SHEETS = Object.freeze([
  'src/championship/app/dataArena.css', 'src/championship/app/facilityBattleMobile.css',
  'src/championship/app/huntMobile.css', 'src/championship/app/raisingHomeHud.css'
]);

const SIZE = /(font-size\s*:\s*)(\d+(?:\.\d+)?px)(\s*(?:!important)?\s*[;}])/g;
// font shorthand: [style/weight tokens] <size>px[/line-height] <family>
const SHORTHAND = /(\bfont\s*:\s*(?:[a-z0-9-]+\s+|var\([^)]*\)\s+)*)(\d+(?:\.\d+)?px)(?=\s*(?:\/|\s)\s*[^;{}]+[;}])/g;

export function scaleSheet(source, variable) {
  const scaled = px => `calc(${px} * var(${variable}, 1))`;
  return source.replace(SIZE, (_, head, px, tail) => `${head}${scaled(px)}${tail}`)
    .replace(SHORTHAND, (_, head, px) => `${head}${scaled(px)}`);
}
export function literalSizes(source) {
  return [...source.matchAll(SIZE), ...source.matchAll(SHORTHAND)].length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let remaining = 0, changed = 0;
  for (const [files, variable] of [[READING_SHEETS, '--text-scale'], [HUD_SHEETS, '--text-scale-hud']]) {
    for (const file of files) {
      const full = path.join(repo, file);
      if (!fs.existsSync(full)) continue;
      const source = fs.readFileSync(full, 'utf8');
      const count = literalSizes(source);
      if (check) { if (count) { remaining += count; console.log(`${file}: ${count} literal pixel sizes`); } continue; }
      if (!count) continue;
      fs.writeFileSync(full, scaleSheet(source, variable));
      changed += count;
      console.log(`${file}: ${count} sizes now follow ${variable}`);
    }
  }
  if (check) { console.log(remaining ? `FAIL: ${remaining} literal sizes` : 'PASS: every listed sheet follows the reading size'); process.exit(remaining ? 1 : 0); }
  console.log(`${changed} sizes rewritten`);
}
