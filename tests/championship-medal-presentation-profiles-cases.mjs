import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MEDAL_PRESENTATION_PROFILES,getMedalPresentationProfile} from '../src/championship/presentation/medals/medalPresentationProfiles.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/medal-presentation-profiles-20261014.json',import.meta.url),'utf8'));

test('explicit all61 presentation profiles match retained image observations, not rank inference',()=>{
  assert.equal(fixture.evidenceStatus,'RETAINED_REFERENCE_IMAGE_OBSERVATION');
  assert.equal(fixture.presentationStatus,'OWNER_APPROVED_ADAPTATION');
  assert.equal(MEDAL_PRESENTATION_PROFILES.length,61);
  assert.deepEqual(MEDAL_PRESENTATION_PROFILES,fixture.records);
  for(let id=0;id<61;id++){
    const profile=getMedalPresentationProfile(id);
    assert.equal(profile,MEDAL_PRESENTATION_PROFILES[id]);assert.equal(profile.titleId,id);
    assert.deepEqual(Object.keys(profile).sort(),['material','shape','titleId']);
  }
});
test('all11 free gold silhouettes remain exceptions across eligibility families',()=>{
  assert.deepEqual(MEDAL_PRESENTATION_PROFILES.filter(p=>p.shape==='free').map(p=>p.titleId),[40,41,42,43,44,45,46,47,58,59,60]);
  assert.ok(MEDAL_PRESENTATION_PROFILES.filter(p=>p.shape==='free').every(p=>p.material==='gold'));
  const counts={};for(const {shape,material} of MEDAL_PRESENTATION_PROFILES){const key=`${material}:${shape}`;counts[key]=(counts[key]??0)+1;}
  assert.deepEqual(counts,{'copper:round':11,'silver:round':11,'gold:hex':6,'gold:round':11,'paleBlueSilver:hex':11,'gold:free':11});
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
test('static styles share material families, clip only backed bases, and never add plates to free artwork',()=>{
  const css=readFileSync(new URL('../src/championship/app/medalCollection.css',import.meta.url),'utf8');
  for(const material of ['copper','silver','gold','paleBlueSilver'])assert.ok(css.includes(`[data-medal-material="${material}"]`));
  for(const shape of ['round','hex'])assert.ok(css.includes(`[data-medal-shape="${shape}"] :is(.cm-medals__artwork,.cm-medal-display__flat)::before`));
  assert.ok(css.includes('clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)'));
  assert.match(css,/\[data-medal-shape="free"\] :is\(\.cm-medals__art,\.cm-medal-dialog__art\) \{ filter:drop-shadow/);
  assert.doesNotMatch(css,/\[data-medal-shape="free"\][^{]*::(?:before|after)/);
  const artworkRule=css.match(/^\.cm-medals__artwork \{([^}]+)\}/m)?.[1]??'';
  assert.doesNotMatch(artworkRule,/border-radius|background|clip-path|overflow/);
  assert.doesNotMatch(css,/\.cm-medals__art\s*\{[^}]*clip-path|\.cm-medal-dialog__art\s*\{[^}]*clip-path/);
});
