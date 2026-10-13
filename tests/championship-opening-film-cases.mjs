import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OPENING_FILM,selectOpeningFilmSource,canAutoPlayOpening,hasOpeningPreloadBuffer,openingFilmCopy} from '../src/championship/app/openingFilm.js';
import {APPROVED_GAME_TITLES} from '../src/championship/text/brandTerms.js';
const eligible={titleVisible:true,titleReady:true,menuOpen:false,dialogOpen:false,hidden:false,reducedMotion:false,failed:false};
test('automatic film is confined to interactive, uninterrupted TITLE',()=>{
  assert.equal(canAutoPlayOpening(eligible),true);
  for(const key of Object.keys(eligible))assert.equal(canAutoPlayOpening({...eligible,[key]:!eligible[key]}),false,key);
  assert.equal(OPENING_FILM.duration,58.0);assert.equal(OPENING_FILM.logoTime,55.71);
  assert.equal(OPENING_FILM.idleMs,15000);assert.equal(OPENING_FILM.startupWaitMs,8000);assert.equal(OPENING_FILM.waitMs,3000);
});
test('TITLE preload requires actual playback and six seconds in the current buffered range',()=>{
 const video={paused:false,seeking:false,readyState:3,currentTime:5,duration:58,buffered:{length:1,start:()=>0,end:()=>11}};
 assert.equal(hasOpeningPreloadBuffer(video),true);
 for(const change of [{paused:true},{seeking:true},{readyState:2},{duration:NaN},{buffered:{length:1,start:()=>12,end:()=>58}}])assert.equal(hasOpeningPreloadBuffer({...video,...change}),false);
 assert.equal(hasOpeningPreloadBuffer({...video,buffered:{length:1,start:()=>0,end:()=>10.9}}),false);
 assert.equal(hasOpeningPreloadBuffer({...video,currentTime:57,buffered:{length:1,start:()=>50,end:()=>58}}),true);
});
test('film selects one existing portrait source: mobile 720p, desktop 1080p, constrained 540p',()=>{
  assert.equal(selectOpeningFilmSource({connection:{saveData:true}}),OPENING_FILM.liteSrc);
  assert.equal(selectOpeningFilmSource({connection:{effectiveType:'2g'}}),OPENING_FILM.liteSrc);
  assert.equal(selectOpeningFilmSource({connection:{effectiveType:'slow-2g'}}),OPENING_FILM.liteSrc);
  assert.equal(selectOpeningFilmSource({connection:{effectiveType:'4g'}}),OPENING_FILM.src);
  assert.equal(selectOpeningFilmSource({}),OPENING_FILM.src);
  assert.equal(selectOpeningFilmSource(null),OPENING_FILM.src);
  const desktop={innerWidth:1366,matchMedia:()=>({matches:false})};
  const phone={innerWidth:390,matchMedia:()=>({matches:true})};
  assert.equal(selectOpeningFilmSource({},desktop),OPENING_FILM.desktopSrc);
  assert.equal(selectOpeningFilmSource({},phone),OPENING_FILM.src);
  assert.equal(selectOpeningFilmSource({userAgentData:{mobile:true}},desktop),OPENING_FILM.src);
  assert.equal(selectOpeningFilmSource({connection:{saveData:true}},desktop),OPENING_FILM.liteSrc);
});
test('all five locales expose film controls alongside the approved brand registry',()=>{
  for(const locale of Object.keys(APPROVED_GAME_TITLES)){
    const copy=openingFilmCopy(locale);assert.equal(copy.length,6);
    assert.equal(new Set(copy).size,6);assert.ok(copy.every(s=>typeof s==='string'&&s.length>0));
    assert.ok(!/CHAMPIONSHIP 2026/.test(APPROVED_GAME_TITLES[locale]));
  }
  assert.deepEqual(openingFilmCopy('unknown'),openingFilmCopy('zh-Hant'));
});
test('the publication selection is the exact reviewed textless 58s NS33 asset and poster',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../assets/production/opening-film-ns33-r1/manifest.json',import.meta.url)));
  const bytes720=readFileSync(new URL('../'+OPENING_FILM.src,import.meta.url));
  assert.equal(bytes720.length,19412041);assert.equal(createHash('sha256').update(bytes720).digest('hex'),OPENING_FILM.sha256);
  assert.equal(manifest.sha256,OPENING_FILM.sha256);
  const bytes1080=readFileSync(new URL('../'+OPENING_FILM.desktopSrc,import.meta.url));
  assert.equal(bytes1080.length,73388752);assert.equal(createHash('sha256').update(bytes1080).digest('hex'),OPENING_FILM.desktopSha256);
  assert.equal(manifest.desktopSha256,OPENING_FILM.desktopSha256);
  assert.equal(manifest.desktopWidth,1080);assert.equal(manifest.desktopHeight,1920);
  const bytes540=readFileSync(new URL('../'+OPENING_FILM.liteSrc,import.meta.url));
  assert.equal(bytes540.length,8782520);assert.equal(createHash('sha256').update(bytes540).digest('hex'),OPENING_FILM.liteSha256);
  assert.equal(manifest.liteSha256,OPENING_FILM.liteSha256);
  const bytesPoster=readFileSync(new URL('../'+OPENING_FILM.poster,import.meta.url));
  assert.equal(bytesPoster.length,233617);assert.equal(createHash('sha256').update(bytesPoster).digest('hex'),OPENING_FILM.posterSha256);
  assert.equal(manifest.posterSha256,OPENING_FILM.posterSha256);
  assert.equal(manifest.seconds,58.0);assert.equal(manifest.frames,1392);
  assert.equal(manifest.publicPlaytestPermitted,true);
  assert.equal(manifest.fullSubjectiveListeningAccepted,false);assert.equal(manifest.physicalDeviceAccepted,false);
});
