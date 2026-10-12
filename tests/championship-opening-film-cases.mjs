import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OPENING_FILM,canAutoPlayOpening,openingFilmCopy} from '../src/championship/app/openingFilm.js';
import {APPROVED_GAME_TITLES} from '../src/championship/text/brandTerms.js';
const eligible={titleVisible:true,titleReady:true,menuOpen:false,dialogOpen:false,hidden:false,reducedMotion:false,failed:false};
test('automatic film is confined to interactive, uninterrupted TITLE',()=>{
  assert.equal(canAutoPlayOpening(eligible),true);
  for(const key of Object.keys(eligible))assert.equal(canAutoPlayOpening({...eligible,[key]:!eligible[key]}),false,key);
  assert.equal(OPENING_FILM.idleMs,15000);assert.equal(OPENING_FILM.waitMs,3000);
});
test('all five locales expose film controls alongside the approved brand registry',()=>{
  for(const locale of Object.keys(APPROVED_GAME_TITLES)){
    const copy=openingFilmCopy(locale);assert.equal(copy.length,6);
    assert.equal(new Set(copy).size,6);assert.ok(copy.every(s=>typeof s==='string'&&s.length>0));
    assert.ok(!/CHAMPIONSHIP 2026/.test(APPROVED_GAME_TITLES[locale]));
  }
  assert.deepEqual(openingFilmCopy('unknown'),openingFilmCopy('zh-Hant'));
});
test('the publication selection is the exact reviewed textless NS33 asset',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/production/opening-film-ns33-r1/manifest.json',import.meta.url)));
  const bytes=readFileSync(new URL('../'+OPENING_FILM.src,import.meta.url));
  assert.equal(bytes.length,14563538);assert.equal(createHash('sha256').update(bytes).digest('hex'),OPENING_FILM.sha256);
  assert.equal(manifest.sha256,OPENING_FILM.sha256);assert.equal(manifest.publicPlaytestPermitted,true);
  assert.equal(manifest.fullSubjectiveListeningAccepted,false);assert.equal(manifest.physicalDeviceAccepted,false);
});
