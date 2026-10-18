import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OPENING_FILM,OPENING_FILM_ENABLED,createOpeningFilm,selectOpeningFilmSource,hasOpeningPreloadBuffer,openingFilmCopy} from '../src/championship/app/openingFilm.js';
import {openingFilmPublicationFiles,assertOpeningFilmPublication} from '../scripts/lib/opening-film-publication.mjs';
import {APPROVED_GAME_TITLES} from '../src/championship/text/brandTerms.js';

test('restoration publishes only the small web film and poster; explicit disabling still creates no media',()=>{
 assert.equal(OPENING_FILM_ENABLED,true);
 const unavailable=new Proxy({}, {get(){throw Error('Paused film must not access DOM or window');}});
 const controller=createOpeningFilm({enabled:false,document:unavailable,window:unavailable,onActiveChange(){assert.fail('No film activity');},onBufferChange(){assert.fail('No video buffering');}});
 controller.start();controller.sync();controller.dispose();
 assert.equal(controller.isPlaying(),false);assert.equal(controller.canPreloadTitle(),false);
 assert.deepEqual(openingFilmPublicationFiles(false),[]);
 assert.doesNotThrow(()=>assertOpeningFilmPublication(['championship.html'],false));
 assert.throws(()=>assertOpeningFilmPublication([OPENING_FILM.src]),/TITLE_FILM_PUBLICATION_POLICY/);
 const restore=openingFilmPublicationFiles(true);
 assert.equal(restore.length,2);assert.ok(restore.every(row=>/^[a-f0-9]{64}$/.test(row.sha256)));
 assert.deepEqual(restore.map(row=>row.path),[OPENING_FILM.webSrc,OPENING_FILM.poster]);
 assert.doesNotThrow(()=>assertOpeningFilmPublication(restore.map(row=>row.path),true));
 assert.throws(()=>assertOpeningFilmPublication([],true),/TITLE_FILM_PUBLICATION_POLICY/);
});
test('restored film retains its approved timeline and bounded startup/stall waits',()=>{
  assert.equal(OPENING_FILM.duration,58.0);assert.equal(OPENING_FILM.logoTime,55.71);
  assert.equal(OPENING_FILM.startupWaitMs,8000);assert.equal(OPENING_FILM.waitMs,3000);
});
test('TITLE preload requires actual playback and six seconds in the current buffered range',()=>{
 const video={paused:false,seeking:false,readyState:3,currentTime:5,duration:58,buffered:{length:1,start:()=>0,end:()=>11}};
 assert.equal(hasOpeningPreloadBuffer(video),true);
 for(const change of [{paused:true},{seeking:true},{readyState:2},{duration:NaN},{buffered:{length:1,start:()=>12,end:()=>58}}])assert.equal(hasOpeningPreloadBuffer({...video,...change}),false);
 assert.equal(hasOpeningPreloadBuffer({...video,buffered:{length:1,start:()=>0,end:()=>10.9}}),false);
 assert.equal(hasOpeningPreloadBuffer({...video,currentTime:57,buffered:{length:1,start:()=>50,end:()=>58}}),true);
});
test('all displays and connections select one web source with no HD fallback download',()=>{
  for(const nav of [null,{}, {connection:{saveData:true}},{connection:{effectiveType:'2g'}},{connection:{effectiveType:'4g'}}])assert.equal(selectOpeningFilmSource(nav),OPENING_FILM.webSrc);
  const desktop={innerWidth:1366,matchMedia:()=>({matches:false})};
  const phone={innerWidth:390,matchMedia:()=>({matches:true})};
  assert.equal(selectOpeningFilmSource({},desktop),OPENING_FILM.webSrc);
  assert.equal(selectOpeningFilmSource({},phone),OPENING_FILM.webSrc);
});
test('all five locales expose film controls alongside the approved brand registry',()=>{
  for(const locale of Object.keys(APPROVED_GAME_TITLES)){
    const copy=openingFilmCopy(locale);assert.equal(copy.length,6);
    assert.equal(new Set(copy).size,6);assert.ok(copy.every(s=>typeof s==='string'&&s.length>0));
    assert.ok(!/CHAMPIONSHIP 2026/.test(APPROVED_GAME_TITLES[locale]));
  }
  assert.deepEqual(openingFilmCopy('unknown'),openingFilmCopy('zh-Hant'));
});
test('reviewed originals stay exact; the separately pinned web derivative is below 5MB',()=>{
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
  const web=readFileSync(new URL('../'+OPENING_FILM.webSrc,import.meta.url));
  assert.equal(web.length,OPENING_FILM.webBytes);assert.ok(web.length<5_000_000);
  assert.equal(createHash('sha256').update(web).digest('hex'),OPENING_FILM.webSha256);
  assert.equal(manifest.webRestore.sha256,OPENING_FILM.webSha256);
  assert.equal(manifest.webRestore.sourceSha256,OPENING_FILM.desktopSha256);
  assert.equal(manifest.publicPlaytestPermitted,true);
  assert.equal(manifest.fullSubjectiveListeningAccepted,false);assert.equal(manifest.physicalDeviceAccepted,false);
  const input=JSON.parse(readFileSync(new URL('../docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',import.meta.url)));
  assert.deepEqual(input.files.filter(file=>file.startsWith('assets/production/opening-film-ns33-r1/')).sort(),openingFilmPublicationFiles().map(row=>row.path).sort());
});
