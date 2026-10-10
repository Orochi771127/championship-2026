import test from 'node:test';
import assert from 'node:assert/strict';
import {getLocale,setLocale} from '../src/championship/text/locale.js';
import {uiText} from '../src/championship/text/uiText.js';
import {normalizePreferences,serializePreferences,parsePreferences} from '../src/championship/app/settings/preferenceSchema.js';
import {validateOriginalSharedVfx,ORIGINAL_SHARED_BEAM_MANIFEST,originalTextSetFor} from '../src/championship/presentation/originalSharedVfxReview.js';
import {isPrivateRepositoryPath} from '../scripts/lib/public-art-boundary.mjs';
import candidate from '../assets/production/vfx/original-shared-beam-seamfix-r1/manifest.json' with {type:'json'};
import base from '../assets/production/vfx/original-shared-review-v1/manifest.json' with {type:'json'};
import index from '../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};

test('Japanese battle-text choice persists through the existing preference schema with Chinese UI fallback',()=>{
 const saved=serializePreferences(normalizePreferences({locale:'ja'}));
 assert.equal(parsePreferences(saved).preferences.locale,'ja');
 try {assert.equal(setLocale('ja'),true);assert.equal(getLocale(),'ja');assert.equal(originalTextSetFor(getLocale()),'ja');assert.equal(uiText('SAVE'),'儲存');}
 finally {setLocale('zh-Hant');}
});
test('beam seam candidate changes only the two authorized RGBA hashes and never the saved 157 geometry/ticks',()=>{
 validateOriginalSharedVfx(candidate,index,{manifestPath:ORIGINAL_SHARED_BEAM_MANIFEST});
 assert.throws(()=>validateOriginalSharedVfx(candidate,index),/IMAGE_INVALID/);
 assert.throws(()=>validateOriginalSharedVfx(candidate,index,{manifestPath:'elsewhere.json'}),/PATH_INVALID/);
 assert.deepEqual(candidate.banks,base.banks);assert.deepEqual(candidate.localizedText,base.localizedText);assert.deepEqual(candidate.nativeTimingSource,base.nativeTimingSource);
 const changed=[];
 for(let i=0;i<base.cells.length;i++){const {rgbaSha256:a,candidateSource:as,...aa}=base.cells[i],{rgbaSha256:b,candidateSource:bs,...bb}=candidate.cells[i];assert.deepEqual(aa,bb);if(a!==b)changed.push(`${aa.bankId}:${aa.cell}`);}
 assert.deepEqual(changed,['12:0','138:0']);assert.equal(isPrivateRepositoryPath(ORIGINAL_SHARED_BEAM_MANIFEST),true);assert.equal(candidate.humanApproved,false);
});
