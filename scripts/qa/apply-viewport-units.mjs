#!/usr/bin/env node
// One-off source transform (Owner brief 2026-11-11): viewport units that follow the desktop
// interface zoom.
//
// A desktop window larger than 1366x768 shows the desktop layout zoomed (portraitFrame.js puts
// `zoom` on <html>). CSS viewport units ignore that zoom: under a 1.4 zoom `100dvh` is 1.4
// windows tall in the page's own pixels, so a sheet sized `max-height: 80dvh` grew past the
// top of the screen. tokens.css therefore defines one unit per viewport unit
//   --cm-vw: 1vw   --cm-vh: 1vh   --cm-dvh: 1dvh   --cm-lvh: 1lvh   --cm-vmin: 1vmin   --cm-vmax: 1vmax
// and divides each by the zoom while <html data-ui-zoom> is set. This rewrites
//   80dvh  →  calc(80 * var(--cm-dvh, 1dvh))
// in the game's sheets. Without a zoom every computed value is unchanged. The title and the
// opening (opening.css) are never zoomed and keep their units as typed.
//
//   node scripts/qa/apply-viewport-units.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const UNITS = ['dvh', 'lvh', 'vh', 'vw', 'vmin', 'vmax'];
export const UNZOOMED_SHEETS = Object.freeze(['src/championship/app/opening.css']);

export function viewportSheets() {
  const out = [];
  for (const dir of ['src/championship/app', 'src/championship/app/ui']) {
    for (const name of fs.readdirSync(path.join(repo, dir))) {
      const file = `${dir}/${name}`;
      if (name.endsWith('.css') && !UNZOOMED_SHEETS.includes(file) && name !== 'tokens.css') out.push(file);
    }
  }
  return out.sort();
}

// A number directly followed by a viewport unit, not already inside our own var() fallback
// ("1dvh" after a comma) and not part of a longer word.
const LENGTH = new RegExp(`(?<![\\w.#-])(-?\\d*\\.?\\d+)(${UNITS.join('|')})\\b`, 'g');

export function zoomAwareUnits(source) {
  // Leave comments as they are: they quote sizes in prose.
  return source.split(/(\/\*[\s\S]*?\*\/)/).map((part, index) => {
    if (index % 2) return part;
    return part.replace(LENGTH, (match, number, unit, offset, whole) => {
      if (/var\(--cm-[a-z]+,\s*$/.test(whole.slice(0, offset))) return match;
      return `calc(${number} * var(--cm-${unit}, 1${unit}))`;
    });
  }).join('');
}
export function literalUnits(source) {
  let count = 0;
  source.split(/(\/\*[\s\S]*?\*\/)/).forEach((part, index) => {
    if (index % 2) return;
    part.replace(LENGTH, (match, number, unit, offset, whole) => { if (!/var\(--cm-[a-z]+,\s*$/.test(whole.slice(0, offset))) count += 1; return match; });
  });
  return count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let remaining = 0, changed = 0;
  for (const file of viewportSheets()) {
    const full = path.join(repo, file);
    const source = fs.readFileSync(full, 'utf8');
    const count = literalUnits(source);
    if (!count) continue;
    if (check) { remaining += count; console.log(`${file}: ${count} raw viewport lengths`); continue; }
    fs.writeFileSync(full, zoomAwareUnits(source));
    changed += count;
    console.log(`${file}: ${count} viewport lengths now follow the interface zoom`);
  }
  if (check) { console.log(remaining ? `FAIL: ${remaining} raw viewport lengths` : 'PASS: every game sheet follows the interface zoom'); process.exit(remaining ? 1 : 0); }
  console.log(`${changed} lengths rewritten`);
}
