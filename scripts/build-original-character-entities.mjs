// Character entities of the playable original characters (Owner 2026-11-03: the ones with motion art).
//
// The ranch, battle and HUD rosters load one entity per species: a numeric runtime (timing, geometry) plus
// pixels. An original has no cartridge pages, so its entity is its behavior donor's runtime and HUD manifest
// under the original's own entity id, and its reviewed motion set replaces every pixel (replacesOriginal):
// the donor's atlas pages are never fetched. HUD portraits already show the Dex illustration.
//
// Writes assets/production/characters/original-roster-20261103/<entityId>/{runtime,hud}.render.json and the
// matching rows of public-character-catalog.v1.json and reviewed-animation-selection.v1.json.
// Deterministic. usage (repo root): node scripts/build-original-character-entities.mjs [--check]
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const CATALOG = 'src/data/championship/public-character-catalog.v1.json';
const SELECTION = 'src/data/championship/reviewed-animation-selection.v1.json';
const ROOT = 'assets/production/characters/original-roster-20261103';
const check = process.argv.includes('--check');

const originals = read('src/data/championship/product-species-originals.r1.json').entries.filter(e => e.runtimeReady && e.evolutionReady);
const catalog = read(CATALOG);
const selectionText = fs.readFileSync(SELECTION, 'utf8');
const writes = new Map();
const speciesId = index => `species-${String(index).padStart(3, '0')}`;

const characters = catalog.characters.filter(c => !originals.some(e => e.entityId === c.entityId));
const bindings = catalog.speciesBindings.filter(b => !originals.some(e => speciesId(e.speciesIndex) === b.speciesId));
for (const e of originals) {
  const donorBinding = catalog.speciesBindings.find(b => b.speciesId === speciesId(e.behaviorDonor));
  const donor = catalog.characters.find(c => c.entityId === donorBinding?.entityId);
  if (!donor) throw new Error(`ORIGINAL_ENTITY_DONOR_MISSING ${e.speciesIndex}`);
  const runtime = {...read(donor.runtimePath), entityId: e.entityId};
  const hud = read(donor.hudPath);
  const renamed = cell => ({...cell, entityId: e.entityId, speciesId: speciesId(e.speciesIndex)});
  const hudOut = {...hud, entityId: e.entityId, portrait: renamed(hud.portrait), battle: {...hud.battle, cells: hud.battle.cells.map(renamed)}};
  const runtimeText = JSON.stringify(runtime), hudText = JSON.stringify(hudOut);
  const runtimePath = `${ROOT}/${e.entityId}/runtime.render.json`, hudPath = `${ROOT}/${e.entityId}/hud.render.json`;
  writes.set(runtimePath, runtimeText); writes.set(hudPath, hudText);
  characters.push({...donor, entityId: e.entityId, speciesId: speciesId(e.speciesIndex), runtimePath, runtimeSha256: sha(runtimeText),
    hudPath, hudSha256: sha(hudText)});
  bindings.push({speciesId: speciesId(e.speciesIndex), entityId: e.entityId});
}
writes.set(CATALOG, JSON.stringify({...catalog, characters, speciesBindings: bindings}) + '\n');

// The reviewed set is the only art an original has.
const ids = new Set(originals.map(e => speciesId(e.speciesIndex)));
const lines = selectionText.split('\n');
let current = null;
for (let i = 0; i < lines.length; i++) {
  const id = /"speciesId": "([^"]+)"/.exec(lines[i]); if (id) current = id[1];
  if (ids.has(current) && /"playableIdentity": true,/.test(lines[i]) && !/"replacesOriginal"/.test(lines[i + 1])) {
    lines.splice(i + 1, 0, lines[i].replace(/"playableIdentity": true,/, '"replacesOriginal": true,'));
  }
}
writes.set(SELECTION, lines.join('\n'));

let stale = 0;
for (const [file, text] of writes) {
  const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (now === text) continue;
  stale++;
  if (!check) { fs.mkdirSync(file.slice(0, file.lastIndexOf('/')), {recursive: true}); fs.writeFileSync(file, text); }
}
if (check && stale) { console.error(`${stale} original character entity file(s) are stale`); process.exit(1); }
console.log(JSON.stringify({entities: originals.map(e => e.entityId), files: writes.size, changed: stale}));
