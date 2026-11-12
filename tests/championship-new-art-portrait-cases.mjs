// Owner 2026-10-30: UI portraits show the current design (published Dex illustration), not the
// original HUD cell, wherever one exists; the HUD record still gates readiness and sizing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newArtPortrait, newArtPortraitLike} from '../src/championship/presentation/newArtPortrait.js';
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
import {dataArenaArtRecord} from '../src/championship/presentation/dataArena/dataArenaRoster.js';
const source = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('a species with a published illustration resolves to it; others keep nothing', () => {
  const hero = databaseHeroPortrait(159);
  assert.deepEqual({...newArtPortrait('species-159')}, {src: hero.src, sha256: hero.sha256, width: hero.width, height: hero.height});
  assert.equal(newArtPortrait('championship:creature:species-159').src, hero.src);
  assert.equal(newArtPortrait('species-999'), null);
  assert.equal(newArtPortrait(null), null);
});

test('in place of a HUD record: same longest side, the illustration aspect, other fields kept', () => {
  const hud = {src: 'assets/production/characters/x/hud-r01/main-cell_000.webp', width: 40, height: 56, nativeScale: 2, cell: 0};
  const p = newArtPortraitLike('species-159', hud), hero = databaseHeroPortrait(159);
  assert.equal(p.src, hero.src); assert.equal(p.art, 'DATABASE_ILLUSTRATION');
  assert.equal(Math.max(p.width, p.height), 56);
  assert.ok(Math.abs(p.width / p.height - hero.width / hero.height) < 1e-9);
  assert.equal(p.nativeScale, 2); assert.equal(p.cell, 0);
  assert.equal(newArtPortraitLike('species-999', hud), hud, 'no illustration: the HUD record unchanged');
  assert.equal(newArtPortraitLike('species-159', null), null, 'no HUD record yet: still not ready');
});

// Owner 2026-11-12 (supersedes 2026-10-30 for every screen outside the Database): 「圖鑑插畫就請讓他出現在圖鑑就好
// ... 其他都可以用成角色的動作動畫」. The Dex keeps the illustration; the HUD art, the Data Arena select and
// every other partner portrait draw the character's own action animation (presentation/juicy/actionPortrait.js).
test('the Dex keeps the illustration; HUD art and the Data Arena select no longer substitute it', () => {
  const hud = source('src/championship/presentation/publicCharacterHudArt.js');
  assert.doesNotMatch(hud, /newArtPortrait/, 'the HUD record never hands out the Database illustration');
  assert.match(hud, /getPortrait:id=>get\(id\)\?\.portrait\?\?null/);
  const dex = source('src/championship/app/vs4Screens.js');
  assert.match(dex, /const hero = databaseHeroPortrait\(speciesIndex\);\s*if \(hero\) \{\s*holder\.dataset\.source = 'illustration';/);
  const art = dataArenaArtRecord('species-159', 'http://127.0.0.1:8768/championship.html');
  assert.notEqual(new URL(art.portraitUrl).pathname, '/' + databaseHeroPortrait(159).src);
  assert.match(art.portraitUrl, /main-cell_000\.webp$/);
  assert.equal(art.speciesId, 'species-159', 'the select card draws the body from the species');
  // Outside the Database, the screens that showed a partner now stand its animated body.
  for (const [file, pattern] of [
    ['src/championship/app/raisingHomeP1RView.js', /actionPortraits\?\.set\?\.\(portraitSlot,resident\?\.speciesId/],
    ['src/championship/app/vs5Screens.js', /speciesBody\(\{species,still:true\}\)/],
    ['src/championship/app/vs5Screens.js', /hudArt\?\.setActionPortrait\?\.\(miniImage,next\.speciesId/],
    ['src/championship/app/digimonListScreen.js', /createActionPortrait\(\{ species: entry\.identity\.recordIndex, still: true \}\)/],
    ['src/championship/app/dataArenaScreen.js', /createActionPortrait\(\{ species: art\.speciesId, still: true/],
    ['src/championship/app/journeyScreen.js', /createActionPortrait\(\{ species: src\.species, still: true \}\)/],
    ['src/championship/app/ui/syncGainPanel.js', /createActionPortrait\(\{ species: portrait\.species/],
    ['src/championship/presentation/juicy/skillCutIn.js', /sequence: ACTION_PORTRAIT_SEQUENCES\.attack/],
    ['src/championship/presentation/ceremony/ceremonyScenes.js', /sequence: ACTION_PORTRAIT_SEQUENCES\.cheer/]]) assert.match(source(file), pattern, file);
  for (const file of ['src/championship/app/main.js', 'src/championship/app/digimonListScreen.js'])
    assert.doesNotMatch(source(file), /databaseHeroPortrait\(/, `${file} no longer reaches for the Database illustration`);
  assert.match(source('src/championship/app/styles.css'), /img\[src\*="\/production\/database-"\]\[src\] \{ image-rendering: auto; \}/);
});
