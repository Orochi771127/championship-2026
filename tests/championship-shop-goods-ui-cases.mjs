import assert from 'node:assert/strict';
import test from 'node:test';
import {shopGoodsPresentation,huntToolIconPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
import {HUNT_EQUIPMENT_ITEMS} from '../src/championship/hunt/loadout/huntEquipmentCatalog.js';
import {createBattlePresentationSource} from '../src/championship/app/battlePresentationSource.js';
import {originalToolbarArt} from '../src/championship/presentation/completedOriginalUi20261007.js';
import publicCare from '../assets/production/public-runtime/raising-care.v1.json' with {type:'json'};

test('Shop feed shares the full-quantity raising meat pixels while tools and hunt bait keep their identities',()=>{
  const field=publicCare.cells.find(cell=>cell.role==='meat'&&cell.pose===0);
  for(const url of ['http://127.0.0.1:18743/championship.html','https://orochi771127.github.io/championship-2026/']){
    const feed=shopGoodsPresentation(0,url);
    assert.equal(feed.src,field.src);assert.equal(feed.sha256,field.sha256);
    assert.equal(feed.width,field.nativeWidth);assert.equal(feed.height,field.nativeHeight);
    assert.equal(feed.itemIndex,0);assert.equal(feed.category,'TRAINING_GOODS');
    assert.match(originalToolbarArt('feed',url).src,/feed-rest\.png$/);
    assert.notEqual(originalToolbarArt('feed',url).src,feed.src);
    for(const item of HUNT_EQUIPMENT_ITEMS.filter(item=>item.equipmentClass==='ENTRAP'))
      assert.notEqual(shopGoodsPresentation(item.shopRecordIndex,url).src,feed.src,item.itemId);
  }
});

test('shop display follows original record/item permutation, including wound versus illness medicine',()=>{
  const rows=[0,1,2,3].map(shopGoodsPresentation);
  assert.deepEqual(rows.map(r=>r.itemIndex),[0,1,3,2]);
  assert.deepEqual(rows.map(r=>r.name),['飼料','蛋白質','傷藥','藥品']);
  assert.deepEqual(rows.map(r=>r.icon),['feed','protein','woundMedicine','medicine']);
  // One icon language: a shop row draws the same approved toolbar cell the rail
  // draws, in its rest pose. Asserting the exact cell is a stronger guard than
  // the atlas offset it replaces -- an offset can be right while the art is
  // from the wrong set.
  assert.deepEqual(rows.map(r=>r.backgroundPosition),['center','center','center','center']);
  assert.deepEqual(rows.map(r=>r.src),[
    'assets/production/toolbar/licensed-runtime-v1/feed-rest.png',
    'assets/production/toolbar/licensed-runtime-v1/protein-rest.png',
    'assets/production/toolbar/licensed-runtime-v1/woundMedicine-rest.png',
    'assets/production/toolbar/licensed-runtime-v1/medicine-rest.png'
  ]);
  for(const index of [4,83,-1,'0',null,1.5])assert.equal(shopGoodsPresentation(index),null);
});

test('battle identity projects the existing session species; unknown species does not become a guessed creature',()=>{
  const session={slots:[{speciesId:10},null,null,{speciesId:999},null,null]};
  const source=createBattlePresentationSource({session,step:()=>{}});
  assert.equal(source.getFrame().combatants[0].speciesId,'species-010');
  assert.equal(source.getFrame().combatants[0].displayName,'星豆芽');
  assert.equal(source.getFrame().combatants[3].speciesId,null);
  assert.equal(source.getFrame().combatants[3].displayName,null);
  assert.equal(session.slots[0].speciesId,10);
  source.dispose();
});

test('all 46 Hunt equipment variants use the same exact art as their Shop and Loadout identity',()=>{
 const local='http://127.0.0.1:18743/championship.html';
 const approved='https://orochi771127.github.io/championship-2026/';
 assert.equal(HUNT_EQUIPMENT_ITEMS.length,46);
 for(const item of HUNT_EQUIPMENT_ITEMS){
  const tool={id:item.equipmentClass,itemId:item.itemId,shopRecordIndex:item.shopRecordIndex};
  const expected=shopGoodsPresentation(item.shopRecordIndex,local);
  assert.equal(huntToolIconPresentation(tool,local)?.src,expected.src,item.itemId);
  assert.equal(huntToolIconPresentation(tool,approved)?.src,expected.src,item.itemId);
  assert.equal(huntToolIconPresentation({...tool,shopRecordIndex:item.shopRecordIndex+1},local),null);
 }
 assert.match(huntToolIconPresentation({id:'HAND'},local).src,/toolbar-point64-r1-20261009\/hand-rest\.png$/);
 assert.equal(huntToolIconPresentation({id:'ENTRAP',itemId:'unknown'},local),null);
 assert.equal(huntToolIconPresentation({id:'ROPE'},local),null);
 assert.equal(huntToolIconPresentation({id:'HAND'},'https://example.com/'),null);
});
