import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {medalCollection} from '../src/championship/app/medalCollection.js';
import {describeMedalDetails} from '../src/championship/app/medalDetails.js';
import {titleEventText,tamerRankName} from '../src/championship/text/zhHant.js';
import {uiText} from '../src/championship/text/uiText.js';
import {setLocale,LOCALES} from '../src/championship/text/locale.js';
import {medalPresentationText} from '../src/championship/presentation/medals/medalPresentationText.js';
import {getMedalPresentationProfile} from '../src/championship/presentation/medals/medalPresentationProfiles.js';
import {originalMedalArt,originalDatabaseIcon} from '../src/championship/presentation/completedOriginalUi20261007.js';
import {ControlledEvent,createControlledDocument} from './helpers/controlled-database-dom.mjs';

// The complete, unchanged screen function body runs in a controlled DOM with
// only the separately-tested Three adapter stubbed. No real browser acceptance.
function fixture({badges=[],locale='zh-Hant',missingArt=false,artOverride=null}={}){
  setLocale(locale);const doc=createControlledDocument(locale),create=doc.createElement.bind(doc),mounts=[],imageAssignments=[],root=doc.createElement('main');doc.body.append(root);
  doc.createElement=tag=>{const node=create(tag);if(tag==='img'){let src='';Object.defineProperty(node,'src',{get:()=>src,set(value){src=value;imageAssignments.push({src:value,className:node.className});}});}if(tag==='dialog'){node.open=false;node.showModal=()=>{node.open=true;};node.close=()=>{node.open=false;node.dispatchEvent(new ControlledEvent('close',{bubbles:false}));};}return node;};
  const input=Object.freeze([...badges]),snapshot=JSON.stringify(input);let exits=0;
  const forbidden=()=>{throw Error('FORBIDDEN_STATE_OR_NETWORK');};
  const storage=new Proxy({}, {get:forbidden,set:forbidden});
  const context=vm.createContext({document:doc,medalCollection,describeMedalDetails,titleEventText,tamerRankName,uiText,medalPresentationText,getMedalPresentationProfile,
    originalMedalArt:id=>missingArt?null:artOverride?.(id)??originalMedalArt(id,'http://127.0.0.1:8766/championship.html'),originalDatabaseIcon:screen=>originalDatabaseIcon(screen,'http://127.0.0.1:8766/championship.html'),
    localStorage:storage,sessionStorage:storage,fetch:forbidden,setInterval:forbidden,requestAnimationFrame:forbidden,
    mountSelectedMedalPresentation(args){const record={...args,disposed:false,resets:0};mounts.push(record);args.onState('loading');return {dispose(){record.disposed=true;},reset(){record.resets++;},getDiagnostics(){return {rendererCount:record.disposed?0:1};}};}
  });
  const source=readFileSync(new URL('../src/championship/app/medalCollectionScreen.js',import.meta.url),'utf8').replace(/^import\s[^;]+;\s*/gm,'').replace('export function createMedalCollectionView','function createMedalCollectionView');
  new vm.Script(`${source}\nglobalThis.createView=createMedalCollectionView;`).runInContext(context);
  const view=context.createView({root,battleBadges:input,onExit(){exits++;}});
  return {doc,root,mounts,imageAssignments,view,input,snapshot,exits:()=>exits,tile:id=>root.querySelector(`.cm-medals__tile[data-title-id="${id}"]`),dialog:()=>root.querySelector('dialog'),assertUnchanged(){assert.equal(JSON.stringify(input),snapshot);},close(){root.querySelector('dialog .cm-vs2-action').click();}};
}

test('all61 collection cards are static and retain canonical acquisition flags',()=>{
  const f=fixture({badges:[0,4,60]});assert.equal(f.root.querySelectorAll('.cm-medals__tile').length,61);assert.equal(f.mounts.length,0);
  for(let i=0;i<61;i++){const acquired=[0,4,60].includes(i);assert.equal(f.tile(i).dataset.acquired,String(acquired));assert.ok(f.tile(i).querySelector(`.cm-medals__state-icon--${acquired?'earned':'locked'}`));}
  assert.equal(f.root.querySelectorAll('canvas').length,0);f.assertUnchanged();f.view.dispose();
});
test('unacquired details remain flat with lock, canonical facts, and no renderer request',()=>{
  const f=fixture();for(const id of [0,29,57,60]){f.tile(id).click();assert.equal(f.dialog().dataset.acquired,'false');assert.equal(f.root.querySelector('.cm-medal-display').dataset.state,'locked');assert.ok(f.root.querySelector('.cm-medal-display__lock'));assert.equal(f.mounts.length,0);
    for(const fact of describeMedalDetails(id).facts)assert.ok(f.dialog().textContent.includes(fact.value));for(const note of describeMedalDetails(id).notes)assert.ok(f.dialog().textContent.includes(note));f.close();}
  f.assertUnchanged();f.view.dispose();
});
test('earned detail owns exactly one display and ready/fallback preserve truthful static UI',()=>{
  const f=fixture({badges:[0,4]});f.tile(0).click();assert.equal(f.mounts.length,1);assert.equal(f.doc.activeElement,f.root.querySelector('.cm-medal-display__stage'));assert.equal(f.dialog().scrollTop,0);
  const first=f.mounts[0],art=f.root.querySelector('.cm-medal-dialog__art'),reset=f.root.querySelector('.cm-medal-display__reset');assert.equal(art.hidden,false);assert.equal(reset.hidden,true);
  const firstArt=originalMedalArt(0,'http://127.0.0.1:8766/championship.html');assert.equal(first.src,firstArt.detailSrc??firstArt.src);first.onState('ready');assert.equal(art.hidden,true);assert.equal(reset.hidden,false);reset.click();assert.equal(first.resets,1);
  assert.equal(f.root.querySelector('.cm-medal-display__stage').tabIndex,0);assert.equal(f.root.querySelector('.cm-medal-display__status').hidden,true);
  first.onState('fallback');assert.equal(art.hidden,false);assert.equal(reset.hidden,true);assert.equal(f.root.querySelector('.cm-medal-display__stage').tabIndex,-1);assert.equal(f.root.querySelector('.cm-medal-display__status').textContent,medalPresentationText('fallback'));
  f.close();assert.equal(first.disposed,true);assert.equal(f.view.getDiagnostics().activePresentation,null);f.tile(4).click();assert.equal(f.mounts.length,2);assert.equal(f.mounts.filter(m=>!m.disposed).length,1);f.view.dispose();assert.ok(f.mounts.every(m=>m.disposed));f.assertUnchanged();
});
test('switch, Escape/cancel, close and screen dispose each release active ownership',()=>{
  const f=fixture({badges:[0,1]});f.tile(0).click();f.tile(1).click();assert.equal(f.mounts[0].disposed,true);assert.equal(f.mounts[1].disposed,false);
  f.dialog().dispatchEvent(new ControlledEvent('cancel',{bubbles:false}));assert.equal(f.mounts[1].disposed,true);f.dialog().close();
  f.tile(0).click();f.dialog().close();assert.equal(f.mounts[2].disposed,true);
  f.tile(1).click();const deadTile=f.tile(0);f.view.dispose();f.view.dispose();deadTile.click();assert.equal(f.mounts.length,4);assert.ok(f.mounts.every(m=>m.disposed));assert.equal(f.root.childNodes.length,0);f.assertUnchanged();
});
test('visiting all61 earned details still owns at most one renderer and never changes the input save flags',()=>{
  const f=fixture({badges:Array.from({length:61},(_,i)=>i)});
  for(let id=0;id<61;id++){
    f.tile(id).click();assert.equal(f.mounts.filter(m=>!m.disposed).length,1);
    const selected=originalMedalArt(id,'http://127.0.0.1:8766/championship.html');assert.equal(f.mounts.at(-1).src,selected.detailSrc??selected.src);
    f.close();assert.equal(f.mounts.filter(m=>!m.disposed).length,0);
  }
  assert.equal(f.mounts.length,61);f.assertUnchanged();f.view.dispose();
});
test('missing art never invokes 3D; state and facts remain readable',()=>{
  const f=fixture({badges:[0],missingArt:true});f.tile(0).click();assert.equal(f.mounts.length,0);assert.equal(f.root.querySelector('.cm-medal-display').dataset.state,'fallback');assert.equal(f.root.querySelector('.cm-medal-display__placeholder').hidden,false);assert.ok(f.dialog().textContent.includes(describeMedalDetails(0).facts[0].value));f.view.dispose();
});
test('failed flat artwork keeps an earned/locked emblem without exposing a broken image on fallback',()=>{
  const f=fixture({badges:[0]});f.tile(0).click();const art=f.root.querySelector('.cm-medal-dialog__art'),placeholder=f.root.querySelector('.cm-medal-display__placeholder');
  art.dispatchEvent(new ControlledEvent('error',{bubbles:false}));assert.equal(art.hidden,true);assert.equal(placeholder.hidden,false);
  f.mounts[0].onState('ready');assert.equal(placeholder.hidden,true);f.mounts[0].onState('fallback');assert.equal(art.hidden,true);assert.equal(placeholder.hidden,false);f.close();
  f.tile(1).click();f.root.querySelector('.cm-medal-dialog__art').dispatchEvent(new ControlledEvent('error',{bubbles:false}));assert.equal(f.root.querySelector('.cm-medal-display__placeholder').hidden,false);f.view.dispose();
});
test('all five locales preserve localized status, detail facts/notes and interaction guidance',()=>{
  for(const locale of LOCALES){const f=fixture({badges:[29],locale});f.tile(29).click();const text=f.dialog().textContent;for(const row of describeMedalDetails(29).facts){assert.ok(text.includes(row.label),`${locale} ${row.key}`);assert.ok(text.includes(row.value));}
    for(const note of describeMedalDetails(29).notes)assert.ok(text.includes(note));f.mounts[0].onState('ready');assert.equal(f.root.querySelector('.cm-medal-display__status').hidden,true);assert.equal(f.root.querySelector('.cm-medal-display__controls').textContent,medalPresentationText('controls',locale));f.assertUnchanged();f.view.dispose();}
  setLocale('zh-Hant');
});
test('existing exit intent is retained without save writes or art mapping changes',()=>{
  const f=fixture();f.root.querySelector('footer button').click();assert.equal(f.exits(),1);f.assertUnchanged();f.view.dispose();
});

test('grid keeps only thumbnail sources; selected flat and3D detail load detailSrc on demand',()=>{
  const faces=Array.from({length:61},(_,id)=>Object.freeze({src:`assets/production/grid-${id}-128.png`,detailSrc:`assets/production/detail-${id}-512.png`}));
  const f=fixture({badges:[3,4],artOverride:id=>faces[id]});
  assert.equal(f.imageAssignments.filter(item=>item.className==='cm-medals__art').length,61);
  assert.ok(f.imageAssignments.every(item=>!item.src.includes('detail-')));assert.equal(f.mounts.length,0);
  for(let id=0;id<61;id++)assert.equal(f.tile(id).querySelector('img').src,faces[id].src);
  f.tile(3).click();assert.equal(f.root.querySelector('.cm-medal-dialog__art').src,faces[3].detailSrc);assert.equal(f.mounts.at(-1).src,faces[3].detailSrc);
  assert.deepEqual(f.imageAssignments.filter(item=>item.src.includes('detail-')).map(item=>item.src),[faces[3].detailSrc]);
  f.close();assert.ok(f.mounts[0].disposed);f.tile(4).click();assert.equal(f.mounts.at(-1).src,faces[4].detailSrc);f.close();
  f.tile(5).click();assert.equal(f.root.querySelector('.cm-medal-dialog__art').src,faces[5].detailSrc);assert.equal(f.mounts.length,2,'locked details remain flat');
  assert.deepEqual(f.imageAssignments.filter(item=>item.src.includes('detail-')).map(item=>item.src),[faces[3].detailSrc,faces[4].detailSrc,faces[5].detailSrc]);
  f.assertUnchanged();f.view.dispose();
});
test('original128 artwork with absent or null detailSrc keeps the same source for grid, flat and3D',()=>{
  for(const optional of [{},{detailSrc:null}]){
    const original=Object.freeze({src:'assets/production/original-title-128.png',...optional});
    const f=fixture({badges:[0],artOverride:()=>original});assert.ok(f.imageAssignments.filter(item=>item.className==='cm-medals__art').every(item=>item.src===original.src));
    f.tile(0).click();assert.equal(f.root.querySelector('.cm-medal-dialog__art').src,original.src);assert.equal(f.mounts[0].src,original.src);
    f.mounts[0].onState('fallback');assert.equal(f.root.querySelector('.cm-medal-dialog__art').src,original.src);assert.equal(f.root.querySelector('.cm-medal-dialog__art').hidden,false);
    f.assertUnchanged();f.view.dispose();
  }
});

test('all61 grid, locked detail and earned detail share their explicit material/shape descriptor',()=>{
  for(const acquired of [false,true]){
    const f=fixture({badges:acquired?Array.from({length:61},(_,id)=>id):[]});
    for(let id=0;id<61;id++){
      const profile=getMedalPresentationProfile(id),tile=f.tile(id);
      assert.equal(tile.dataset.medalMaterial,profile.material);assert.equal(tile.dataset.medalShape,profile.shape);
      tile.click();const display=f.root.querySelector('.cm-medal-display');
      for(const node of [f.dialog(),display]){assert.equal(node.dataset.medalMaterial,profile.material);assert.equal(node.dataset.medalShape,profile.shape);}
      assert.ok(f.root.querySelector('.cm-medal-display__flat .cm-medal-dialog__art'));
      if(acquired)assert.equal(f.mounts.at(-1).presentationProfile,profile);
      else assert.equal(f.mounts.length,0);
      f.close();
    }
    assert.equal(f.mounts.length,acquired?61:0);f.assertUnchanged();f.view.dispose();
  }
});
test('static material backing disappears with the flat face only while selected3D is ready',()=>{
  const f=fixture({badges:[2,42]});
  for(const id of [2,42]){
    f.tile(id).click();const flat=f.root.querySelector('.cm-medal-display__flat'),mount=f.mounts.at(-1);
    assert.equal(flat.hidden,false);mount.onState('ready');assert.equal(flat.hidden,true);
    mount.onState('fallback');assert.equal(flat.hidden,false);f.close();
  }
  f.view.dispose();
});
