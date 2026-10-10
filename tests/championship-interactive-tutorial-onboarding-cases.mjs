import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldOfferInteractiveTutorial,isInteractiveTutorialPreviewLocation} from '../src/championship/app/interactiveTutorialPreview.js';
import {tutorialPreviewText} from '../src/championship/text/interactiveTutorialPreviewText.js';
import {setLocale,LOCALES} from '../src/championship/text/locale.js';

test('normal tutorial invitation is enabled only on loopback, including explicit preview requests',()=>{
 for(const hostname of ['localhost','127.0.0.1','[::1]']){
  assert.equal(shouldOfferInteractiveTutorial({hostname,search:''}),true);
  assert.equal(shouldOfferInteractiveTutorial({hostname,search:'?tutorialPreview=raising'}),true);
  assert.equal(isInteractiveTutorialPreviewLocation({hostname,search:''}),false);
 }
 for(const hostname of ['example.com','localhost.example.com','127.0.0.2','192.168.1.2'])
  for(const search of ['','?tutorialPreview=raising'])assert.equal(shouldOfferInteractiveTutorial({hostname,search}),false);
});

test('five normal onboarding locales use complete teaching copy independently of review-only wording',()=>{
 const titles=new Set(),forbidden=/預覽|preview|プレビュー|ตัวอย่างบทสอน|Bản xem trước/i;
 try{for(const locale of LOCALES){setLocale(locale);const normal=tutorialPreviewText(false),review=tutorialPreviewText(true);
  titles.add(normal.title);assert.notEqual(normal.title,review.title);assert.equal(forbidden.test([normal.title,normal.invite,normal.accept,normal.decline,normal.exit,normal.boundary].join(' ')),false);
  for(const key of ['title','invite','accept','decline','exit','next','waiting','keep','retry','failed'])assert.ok(normal[key]?.length>0,locale+':'+key);
 }}finally{setLocale('zh-Hant');}
 assert.equal(titles.size,5);
});
