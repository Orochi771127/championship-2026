// Ai-chan New Game story and tutorial guide (Owner-approved layered v3, 2026-11-02).
// Logic and data only; the DOM flow is covered by championship-onboarding-cinematic-browser.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {DEFAULT_PREFERENCES,PREFERENCE_DEFINITIONS,normalizePreferences,parsePreferences,createPreferencesDocument,coercePreference,preferenceIdsIn} from '../src/championship/app/settings/preferenceSchema.js';
import {createPreferenceStore} from '../src/championship/app/settings/preferenceStore.js';
import {AI_CHAN_APPEARANCES,AI_CHAN_PORTRAITS,AI_CHAN_HALF_WINDOW,resolveGuideAppearance,halfWindowBottomRow,
  getGuideAppearance,setGuideAppearance,onGuideAppearanceChange} from '../src/championship/presentation/aiChanGuide.js';
import {OPENING_STORY_BEATS,OPENING_STORY_BEAT_IDS,OPENING_STORY_BACKGROUND,AI_CHAN_GUIDE_WINDOW,OPENING_STORY_FIRST_GUIDE_BEAT,
  OPENING_STORY_CHOICE_BEAT,openingStoryResumeIndex,openingStorySkipTarget} from '../src/championship/app/openingStoryScript.js';
import {openingPrologueChapter,resolveOpeningStoryText} from '../src/championship/app/openingStoryPresentation.js';
import {aiChanStoryText,AI_CHAN_TEXT_LOCALES,OPENING_STORY_SECTION_IDS} from '../src/championship/text/aiChanStoryText.js';
import {onboardingText,ONBOARDING_TEXT_LOCALES} from '../src/championship/text/onboardingText.js';
import {ORIGINAL_MUSIC_CUES,ONBOARDING_MUSIC,selectOriginalMusic} from '../src/championship/presentation/originalMusicCatalog.js';
import {musicChoicesForScene,resolveSceneMusic} from '../src/championship/presentation/sceneMusicCatalog.js';
import {TUTORIAL_GUIDE_LESSONS} from '../src/championship/app/interactiveTutorialPreview.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('Ai-chan form is a presentation preference: account scope, appearance page, "" until chosen',()=>{
  const definition=PREFERENCE_DEFINITIONS.guideAppearance;
  assert.deepEqual({category:definition.category,scope:definition.scope,values:[...definition.values],default:definition.default},
    {category:'appearance',scope:'account',values:['','cat','catgirl'],default:''});
  assert.equal(DEFAULT_PREFERENCES.guideAppearance,'');
  for(const form of AI_CHAN_APPEARANCES)assert.equal(coercePreference('guideAppearance',form),form);
  for(const bad of ['dog','CAT',' cat',null,1,true,{}])assert.equal(coercePreference('guideAppearance',bad),undefined);
  assert.ok(preferenceIdsIn('appearance').includes('guideAppearance'));
});

test('stored form survives a write and read, and illegal or legacy documents fall back safely',()=>{
  const saved=createPreferencesDocument({...DEFAULT_PREFERENCES,guideAppearance:'catgirl',openingStoryResume:'ai-choose'});
  assert.equal(saved.account.guideAppearance,'catgirl');assert.equal(saved.device.openingStoryResume,'ai-choose');
  assert.equal(saved.device.guideAppearance,undefined);assert.equal(saved.account.openingStoryResume,undefined);
  const back=parsePreferences(JSON.stringify(saved));
  assert.equal(back.status,'OK');assert.equal(back.preferences.guideAppearance,'catgirl');assert.equal(back.preferences.openingStoryResume,'ai-choose');
  // A document written before this field existed reads as "not chosen yet", keeping every other choice.
  const legacy=parsePreferences(JSON.stringify({schemaVersion:1,kind:'CHAMPIONSHIP_PREFERENCES',account:{theme:'night'},device:{musicVolume:40}}));
  assert.deepEqual([legacy.preferences.guideAppearance,legacy.preferences.theme,legacy.preferences.musicVolume],['','cyber',40]); // 深色夜景 is 電子生命 since 2026-11-11
  // Version 0 (a flat map) migrates; illegal values become defaults.
  const flat=parsePreferences(JSON.stringify({guideAppearance:'catgirl',openingStoryResume:'nope'}));
  assert.deepEqual([flat.status,flat.preferences.guideAppearance,flat.preferences.openingStoryResume],['MIGRATED','catgirl','']);
  const tampered=normalizePreferences({guideAppearance:'<img onerror>',openingStoryResume:'../../save'});
  assert.deepEqual([tampered.guideAppearance,tampered.openingStoryResume],['','']);
  // A newer document is not understood and is not overwritten.
  assert.equal(parsePreferences(JSON.stringify({schemaVersion:99,account:{guideAppearance:'cat'}})).status,'NEWER');
});

test('the preference store refuses illegal forms, resets with its category, and never touches the save key',()=>{
  const writes=new Map();
  const port={storageKey:'qa:preferences',read:()=>({text:writes.get('qa:preferences')??null,error:null}),write:text=>{writes.set('qa:preferences',text);return {ok:true,error:null};}};
  const store=createPreferenceStore({port,setTimer:()=>1,clearTimer(){}});
  assert.equal(store.set('guideAppearance','fox'),false);assert.equal(store.get().guideAppearance,'');
  assert.equal(store.set('guideAppearance','catgirl'),true);store.flush();
  assert.deepEqual([...writes.keys()],['qa:preferences']);
  assert.equal(JSON.parse(writes.get('qa:preferences')).account.guideAppearance,'catgirl');
  store.resetCategory('appearance');assert.equal(store.get().guideAppearance,'');
  store.set('openingStoryResume','phone-2');store.resetCategory('access');assert.equal(store.get().openingStoryResume,'');
});

test('portraits are the approved stills, unchanged, with fixed windows that keep the cat\'s paws out',()=>{
  const expected={cat:['453f97fdcba19ea82cee4d6eebd54bd375b41f3c4b12c15b779370e4355da6d6',79144,716,768],
    catgirl:['fd22302d4abfb8d047d3f77e1dec315aa4cd34fb9fe03a28c7c04a20674bed3c',78444,631,768]};
  for(const form of AI_CHAN_APPEARANCES){
    const art=AI_CHAN_PORTRAITS[form],bytes=read(art.src);
    assert.deepEqual([sha(bytes),bytes.length,art.width,art.height],expected[form]);
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    assert.ok(bytes.length<80000,'already web-sized; never re-encoded');
    // The face window lies inside the picture.
    assert.ok(art.face.cx-art.face.size/2>=0&&art.face.cx+art.face.size/2<=art.width&&art.face.cy-art.face.size/2>=0);
  }
  assert.deepEqual({...AI_CHAN_HALF_WINDOW},{width:1,height:0.815});
  // The cat sits; its front paws start below row 640 of the 768-row still. The window ends well above.
  assert.ok(halfWindowBottomRow('cat')<600,String(halfWindowBottomRow('cat')));
  assert.ok(halfWindowBottomRow('catgirl')<600,String(halfWindowBottomRow('catgirl')));
  assert.equal(AI_CHAN_PORTRAITS.catgirl.halfTopPercent,-14);
});

test('form resolution and the published form follow one value; unknown values show the cat',()=>{
  for(const value of ['',null,undefined,'dog'])assert.equal(resolveGuideAppearance(value),'cat');
  assert.equal(resolveGuideAppearance('catgirl'),'catgirl');
  const seen=[];const stop=onGuideAppearanceChange(form=>seen.push(form));
  try{
    setGuideAppearance('catgirl');setGuideAppearance('catgirl');setGuideAppearance('nonsense');
    assert.deepEqual(seen,['catgirl','cat']);assert.equal(getGuideAppearance(),'cat');
  }finally{stop();setGuideAppearance('cat');}
});

test('background is the approved 16:9 video and every page owns an ordered segment of it',()=>{
  const bytes=read(OPENING_STORY_BACKGROUND.src);
  assert.equal(sha(bytes),'b0962103da22b392fd787e07db81830ffab6930d66bd74aa2e88d6fe5bf075d0');assert.equal(bytes.length,9904450);
  assert.equal(bytes.subarray(4,8).toString(),'ftyp');
  assert.deepEqual([OPENING_STORY_BACKGROUND.width,OPENING_STORY_BACKGROUND.height,OPENING_STORY_BACKGROUND.durationSeconds],[1280,720,80]);
  let end=0;
  for(const beat of OPENING_STORY_BEATS){
    assert.equal(beat.video[0],end,beat.id);assert.ok(beat.video[1]>beat.video[0],beat.id);end=beat.video[1];
    // Ai-chan stands full size inside the 38-50 s guide window; before it she is absent, after it she
    // tells the rest docked in the corner (Owner 2026-11-03), never vanishing for a narrator.
    const inWindow=beat.video[0]>=AI_CHAN_GUIDE_WINDOW[0]&&beat.video[1]<=AI_CHAN_GUIDE_WINDOW[1];
    const after=beat.video[0]>=AI_CHAN_GUIDE_WINDOW[1];
    assert.equal(Boolean(beat.guide),inWindow||after,beat.id);
    if(after)assert.deepEqual([beat.guide,beat.speaker],['docked','ai'],beat.id);
    // The connection grid flows under the phone's last page and the whole conversation.
    if(inWindow||beat.id==='phone-2')assert.deepEqual([...beat.loop],[32,50],beat.id);else assert.equal(beat.loop,undefined,beat.id);
  }
  assert.equal(end,80);
  assert.deepEqual(OPENING_STORY_BEATS.filter(beat=>beat.guide&&beat.guide!=='docked').map(beat=>[beat.id,beat.speaker,beat.guide]),
    [['ai-greeting','ai','cat'],['ai-surprise','player','cat'],['ai-offer','ai','cat'],['ai-choose','ai','catgirl'],['ai-ready','ai','chosen']]);
  // Every approved paragraph is one page, in package order.
  assert.deepEqual(OPENING_STORY_BEATS.filter(beat=>beat.kind==='narration').map(beat=>beat.section+beat.paragraph),
    OPENING_STORY_SECTION_IDS.flatMap(id=>[id+'0',id+'1']));
});

test('skip can never take the form choice away; resume points at a real page',()=>{
  assert.equal(OPENING_STORY_BEAT_IDS[OPENING_STORY_FIRST_GUIDE_BEAT],'ai-greeting');assert.equal(OPENING_STORY_BEAT_IDS[OPENING_STORY_CHOICE_BEAT],'ai-choose');
  for(let index=0;index<OPENING_STORY_BEATS.length;index++){
    const target=openingStorySkipTarget(index,false);
    if(index<OPENING_STORY_FIRST_GUIDE_BEAT)assert.equal(target,OPENING_STORY_FIRST_GUIDE_BEAT);
    else if(index<OPENING_STORY_CHOICE_BEAT)assert.equal(target,OPENING_STORY_CHOICE_BEAT);
    else assert.equal(target,null);
    assert.equal(openingStorySkipTarget(index,true),null,'a chosen form lets skip end the story');
  }
  assert.equal(openingStoryResumeIndex(''),0);assert.equal(openingStoryResumeIndex('missing'),0);
  for(const [index,id] of OPENING_STORY_BEAT_IDS.entries())assert.equal(openingStoryResumeIndex(id),index);
  assert.deepEqual([...PREFERENCE_DEFINITIONS.openingStoryResume.values],['',...OPENING_STORY_BEAT_IDS]);
});

test('every locale has the whole story, both forms and the same guide in both forms',()=>{
  assert.deepEqual([...AI_CHAN_TEXT_LOCALES].sort(),[...ONBOARDING_TEXT_LOCALES].sort());
  const chapter=openingPrologueChapter();
  for(const locale of AI_CHAN_TEXT_LOCALES){
    const copy=aiChanStoryText(locale);
    for(const id of OPENING_STORY_SECTION_IDS){assert.ok(copy.sections[id][0].trim(),locale+id);assert.equal(copy.sections[id][1].length,2,locale+id);}
    for(const beat of chapter.beats)assert.ok(resolveOpeningStoryText(beat.text,copy).trim(),locale+' '+beat.id);
    for(const form of AI_CHAN_APPEARANCES){assert.ok(copy.forms[form]);assert.ok(copy.choose[form]);}
    for(const key of ['name','player','chooseLine','previous','replay','resumed','backdropFailed','guideAppearance','guideAppearanceHint','portraitLabel'])assert.ok(String(copy[key]).trim(),locale+key);
    // One name for the guide everywhere; the tutorial copy does not depend on the form.
    assert.equal(onboardingText(locale).guideName,copy.name);
    assert.ok(!/愛將|澄音/.test(JSON.stringify(copy)+onboardingText(locale).guideName));
    assert.equal(onboardingText(locale).lessons.length,TUTORIAL_GUIDE_LESSONS.length);
  }
  assert.deepEqual([aiChanStoryText('zh-Hant').name,aiChanStoryText('ja').name,aiChanStoryText('en').name],['愛醬','アイちゃん','Ai-chan']);
});

test('story and tutorial share the approved web music, at scene level, outside the ranch and battle choices',()=>{
  assert.equal(ONBOARDING_MUSIC,'hexagon_cradles');
  const cue=ORIGINAL_MUSIC_CUES.hexagon_cradles,bytes=read(cue.path.slice(2));
  assert.equal(sha(bytes),'5227d9193d545a72349dfbd3ff79b672116b0748c7748c82dc7b41404845d535');assert.equal(bytes.length,2040101);
  assert.equal(cue.loop,true);assert.ok(cue.crossfade>0&&cue.crossfade<=0.8);
  const manifest=JSON.parse(read('assets/production/scene-music-r1/manifest.json'));
  const record=manifest.files.find(file=>file.id==='hexagon_cradles');
  assert.ok(Math.abs(record.measuredIntegratedLufs+cue.gainDb+24)<0.2,'about -24 LUFS like the other scene music');
  for(const scene of ['raising','battle'])assert.ok(!musicChoicesForScene(scene).some(track=>track.id==='hexagon_cradles'));
  // Title shows the login cue until the New Game story opens; the story hands over to the tutorial without a cue change.
  assert.equal(selectOriginalMusic({titleVisible:true}).id,'login');
  assert.equal(selectOriginalMusic({titleVisible:true,openingVisible:true}).id,'hexagon_cradles');
  assert.equal(selectOriginalMusic({screen:'RAISING_HOME',tutorial:true}).id,'hexagon_cradles');
  assert.equal(resolveSceneMusic('hexagon_cradles',null,{raisingMusic:'moon'}),'hexagon_cradles');
  // After the tutorial, the ranch's own default and the player's choice return.
  assert.equal(resolveSceneMusic(selectOriginalMusic({screen:'RAISING_HOME'}).id,'raising',{raisingMusic:'moon'}),'moon');
});

test('the story layer stays DOM presentation: no save, router, ticker or third-party names',()=>{
  const sources=['src/championship/app/openingStoryPresentation.js','src/championship/app/openingStoryScript.js','src/championship/presentation/aiChanGuide.js']
    .map(path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'));
  for(const source of sources){
    assert.ok(!/localStorage|championshipModernSave|createRouter|Ticker|PIXI|from ['"]pixi/.test(source));
    assert.ok(!/數碼獸|Digimon|デジモン/.test(source));
  }
  // The four layers stay separate: the video is muted and never the music.
  assert.match(sources[0],/video\.muted=true/);
});
