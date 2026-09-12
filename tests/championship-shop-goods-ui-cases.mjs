import assert from 'node:assert/strict';
import test from 'node:test';
import {shopGoodsPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
import {createBattlePresentationSource} from '../src/championship/app/battlePresentationSource.js';

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
  assert.equal(source.getFrame().combatants[0].displayName,'種子獸');
  assert.equal(source.getFrame().combatants[3].speciesId,null);
  assert.equal(source.getFrame().combatants[3].displayName,null);
  assert.equal(session.slots[0].speciesId,10);
  source.dispose();
});
