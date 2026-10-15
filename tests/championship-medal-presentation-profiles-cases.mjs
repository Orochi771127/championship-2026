import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MEDAL_PRESENTATION_PROFILES,getMedalPresentationProfile} from '../src/championship/presentation/medals/medalPresentationProfiles.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/medal-presentation-profiles-20261014.json',import.meta.url),'utf8'));

test('all61 shapes use source alpha; historical fixture remains original reference evidence',()=>{
  assert.equal(fixture.evidenceStatus,'RETAINED_REFERENCE_IMAGE_OBSERVATION');
  assert.equal(fixture.presentationStatus,'OWNER_APPROVED_ADAPTATION');
  assert.equal(MEDAL_PRESENTATION_PROFILES.length,61);
  const sourceMaterials=JSON.parse(readFileSync(new URL('./fixtures/medal-source-materials-20261015.json',import.meta.url),'utf8'));
  assert.deepEqual(MEDAL_PRESENTATION_PROFILES,sourceMaterials.records);
  assert.equal(getMedalPresentationProfile(53).material,'silver');
  assert.deepEqual(MEDAL_PRESENTATION_PROFILES.filter(p=>p.material==='crystal').map(p=>p.titleId),[15,35,50]);
  assert.ok(MEDAL_PRESENTATION_PROFILES.every(p=>p.shape==='free'));
  for(let id=0;id<61;id++){
    const profile=getMedalPresentationProfile(id);
    assert.equal(profile,MEDAL_PRESENTATION_PROFILES[id]);assert.equal(profile.titleId,id);
    assert.deepEqual(Object.keys(profile).sort(),['material','shape','titleId']);
  }
});
test('presentation descriptors are deeply immutable and unknown IDs are not guessed',()=>{
  assert.ok(Object.isFrozen(MEDAL_PRESENTATION_PROFILES));
  assert.ok(MEDAL_PRESENTATION_PROFILES.every(Object.isFrozen));
  assert.throws(()=>{MEDAL_PRESENTATION_PROFILES[0].material='gold';},TypeError);
  for(const id of [-1,61,999,1.5,NaN,Infinity,null,undefined,'0',{},[]])assert.equal(getMedalPresentationProfile(id),null);
});
test('profile module is presentation-only and never imports gameplay, research, or heavy renderer dependencies',()=>{
  const source=readFileSync(new URL('../src/championship/presentation/medals/medalPresentationProfiles.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/^import\s/m);
  assert.doesNotMatch(source,/requiredRank|unlockThreshold|eligibilityTier|rankTier|battleBadges|localStorage|fetch\s*\(/);
  assert.ok(MEDAL_PRESENTATION_PROFILES.every(p=>!['diamond','rainbow','color'].includes(p.material)));
});
test('static grid and fallback art never acquire an artificial plate or outline',()=>{
  const css=readFileSync(new URL('../src/championship/app/medalCollection.css',import.meta.url),'utf8');
  for(const material of ['copper','silver','gold','paleBlueSilver'])assert.ok(css.includes(`[data-medal-material="${material}"]`));
  assert.doesNotMatch(css,/data-medal-shape="(?:round|hex)"|clip-path:polygon/);
  assert.doesNotMatch(css,/\.cm-medals__artwork[^}]*::(?:before|after)|\.cm-medal-display__flat[^}]*::(?:before|after)/);
  const artworkRule=css.match(/^\.cm-medals__artwork \{([^}]+)\}/m)?.[1]??'';
  assert.doesNotMatch(artworkRule,/border-radius|background|clip-path|overflow/);
  assert.match(css,/state-icon--locked::before/);
});
