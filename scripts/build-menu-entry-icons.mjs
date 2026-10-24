// Original vector source for the eleven missing toolbar menu entry icons.
// No raster tracing, external artwork, fonts or runtime generation.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const folder = 'assets/production/ui/menu-entry-original-20261024/';
const shapes = {
  tamer: `<rect x="5" y="10" width="38" height="29" rx="4" fill="#e5f2f8"/><path d="M7 16h34"/><path d="M21 8h6v5h-6z" fill="#e9bc57"/><circle cx="16" cy="24" r="4" fill="#e9bc57"/><path d="M10 34v-2a6 6 0 0 1 12 0v2" fill="#8ec6df"/><path d="M28 23h9m-9 5h7m-7 5h9"/><path d="M8 12h10" stroke="#fff"/>`,
  schedule: `<rect x="7" y="9" width="34" height="33" rx="4" fill="#e5f2f8"/><path d="M7 19V13a4 4 0 0 1 4-4h26a4 4 0 0 1 4 4v6z" fill="#8ec6df"/><path d="M16 5v9m16-9v9M8 19h32"/><path d="M14 25h3m7 0h3m7 0h1m-21 7h3m7 0h3"/><path d="m29 34 4 4 8-9" stroke="#b17b18" stroke-width="3"/>`,
  cageEdit: `<path d="m5 16 15-9 16 9v18l-15 9-16-9z" fill="#d9edf6"/><path d="m5 16 16 9 15-9M21 25v18m-8-23 15-9M13 21v17m15-17v18m-23-13 16 9 15-9" stroke="#5c93ab"/><path d="m28 33 11-16 5 4-11 16-7 4z" fill="#e9bc57"/><path d="m36 21 5 4m-13 8 5 4m-7 4 2-8"/>`,
  digimon: `<path d="M8 7h26a3 3 0 0 1 3 3v31H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z" fill="#e5f2f8"/><path d="M11 8v32m27-27h5v7h-5m0 7h5v7h-5" fill="#8ec6df"/><path d="m17 23 1-8 6 4 6-4 2 8-2 9H19z" fill="#e9bc57"/><path d="M21 25v2m6-2v2m-6 5h6M16 36h16"/>`,
  endDay: `<path d="M32 7A17 17 0 1 0 41 34 18 18 0 0 1 32 7z" fill="#a2cfe3"/><path d="m34 15 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" fill="#e9bc57"/><path d="M11 34a13 13 0 0 1-2-13" stroke="#fff"/><path d="M16 42h23m-5-5 5 5-5 4" stroke="#b17b18"/>`,
  help: `<path d="M6 10q9-4 18 1 9-5 18-1v29q-9-4-18 1-9-5-18-1z" fill="#e5f2f8"/><path d="M24 11v29M10 15l8 1m-8 5 8 1m-8 5 8 1m-8 5 8 1" stroke="#5c93ab"/><path d="M29 20a4 4 0 1 1 6 3c-2 1-3 2-3 4" stroke="#b17b18" stroke-width="2.5"/><circle cx="32" cy="32" r="1.5" fill="#b17b18" stroke="none"/>`,
  saveQuit: `<path d="M7 6h26l6 6v29H7z" fill="#8ec6df"/><path d="M13 6h17v13H13z" fill="#e5f2f8"/><path d="M25 8v8"/><path d="M13 27h20v14H13z" fill="#e5f2f8"/><path d="M17 31h9m-9 5h6" stroke="#5c93ab"/><path d="M27 26h17m-6-6 6 6-6 6" stroke="#b17b18" stroke-width="3"/>`,
  hunt: `<circle cx="24" cy="25" r="17" fill="#e5f2f8"/><path d="M21 8V4h6v4" fill="#e9bc57"/><circle cx="24" cy="25" r="12" stroke="#8ec6df"/><path d="m30 15-4 12-8 8 4-12z" fill="#e9bc57"/><path d="m22 23 4 4M24 10v3m0 24v3M9 25h3m24 0h3"/><circle cx="24" cy="25" r="2" fill="#fff"/>`,
  battle: `<path d="m8 5 9 3 20 24-6 5L11 13z" fill="#e5f2f8"/><path d="m40 5-9 3L11 32l6 5 20-24z" fill="#b2d8e8"/><path d="m8 29 12 11m8 0 12-11" stroke="#b17b18" stroke-width="4"/><path d="m10 38-5 6m33-6 5 6" stroke-width="4"/><path d="m13 12 10 12m12-12-9 11" stroke="#fff"/>`,
  shop: `<path d="m10 17-3 25h34l-3-25z" fill="#e5f2f8"/><path d="M17 20V12a7 7 0 0 1 14 0v8" stroke="#b17b18" stroke-width="3"/><path d="M11 18h26M10 37h28" stroke="#8ec6df"/><path d="m24 24 2 4 5 1-4 3 1 5-4-2-4 2 1-5-4-3 5-1z" fill="#e9bc57"/>`,
  settings: `<path d="m20 5 8 0 1 6 5 3 6-2 4 7-5 4v5l5 4-4 7-6-2-5 3-1 5h-8l-1-5-5-3-6 2-4-7 5-4v-5l-5-4 4-7 6 2 5-3z" fill="#b2d8e8"/><circle cx="24" cy="25" r="9" fill="#e5f2f8"/><circle cx="24" cy="25" r="4" fill="#e9bc57"/><path d="m21 8 5 0m-15 8 3 1m20 19 3 1" stroke="#fff"/>`
};
const manifest = { schemaVersion: 1, evidence: 'PRODUCT_AUTHORED', provenance: 'Original SVG paths authored for the authorized menu completion candidate, 2026-10-24. No external source assets.', entries: [] };
await mkdir(new URL(folder, root), { recursive: true });
for (const [entryId, shape] of Object.entries(shapes)) {
  const src = `${folder}${entryId}.svg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><g fill="none" stroke="#203e53" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${shape}</g></svg>\n`;
  if (process.argv.includes('--check')) {
    if (await readFile(new URL(src, root), 'utf8') !== svg) throw Error(`MENU_ICON_DRIFT:${entryId}`);
  } else await writeFile(new URL(src, root), svg);
  manifest.entries.push({ entryId, src, sha256: createHash('sha256').update(svg).digest('hex'), bytes: Buffer.byteLength(svg) });
}
const manifestUrl = new URL('src/data/championship/toolbar-menu-icons.r1.json', root);
const text = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(manifestUrl, 'utf8') !== text) throw Error('MENU_ICON_MANIFEST_DRIFT');
} else await writeFile(manifestUrl, text);
// A closed player projection keeps authoring provenance and hashes internal.
const runtimeUrl = new URL('src/data/championship/toolbar-menu-icons.runtime.r1.json', root);
const runtimeText = `${JSON.stringify({ schemaVersion: 1, entries: manifest.entries.map(({ entryId, src }) => ({ entryId, src })) }, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (await readFile(runtimeUrl, 'utf8') !== runtimeText) throw Error('MENU_ICON_RUNTIME_DRIFT');
} else await writeFile(runtimeUrl, runtimeText);
console.log(`${manifest.entries.length} original menu icons ${process.argv.includes('--check') ? 'verified' : 'written'} at ${fileURLToPath(new URL(folder, root))}`);
