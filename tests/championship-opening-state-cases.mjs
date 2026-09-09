import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeNativeOpening} from '../src/championship/app/nativeOpeningState.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
test('opening rejects invalid names before clearing an existing save and restores both confirmed names',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const create=()=>createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages});
  let app=create();await app.newGame({trainerName:'阿光',eggName:'小光'});app.save();const before=[...data.values()][0];
  for(const trainerName of ['', '一二三四五六','阿\u200b光','阿\u0000光']){
    await assert.rejects(app.newGame({trainerName,eggName:'小光'}));assert.equal([...data.values()][0],before);}
  await app.dispose();app=create();await app.continueGame();assert.equal(app.getOpeningState().trainerName,'阿光');
  assert.equal(app.getRaisingInstances()[0].displayName,'小光');await app.dispose();
  assert.equal(normalizeNativeOpening(undefined),null);
});
