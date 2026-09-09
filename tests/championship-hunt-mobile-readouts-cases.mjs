import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { huntGateThumbnail, huntTargetReadout, huntPluginReadout } from '../src/championship/presentation/huntMobileReadouts.js';
import {createHuntInventory} from '../src/championship/hunt/loadout/huntInventory.js';
import {createHuntLoadout} from '../src/championship/hunt/loadout/huntLoadoutRuntime.js';
import {HUNT_PLUGIN_ITEMS} from '../src/championship/hunt/loadout/huntEquipmentCatalog.js';

test('each of the 30 fitted plugins reaches the matching display without changing gameplay',()=>{
  const wild={wildId:'one',speciesIndex:34,personalityIndex:7,maxHp:270,currentHp:90,worldX:100,worldY:300};
  const state={tools:['SHOT','WIRE','ENTRAP','DAMAGE_TRAP'].map((id,i)=>({id,quantity:10+i})),usedG:12,maxG:32};
  const runtime={getToolState:()=>state,getWildCreatures:()=>[wild],getSelectedWildId:()=>wild.wildId,world:{worldWidthPx:1024,worldHeightPx:1024}};
  for(const plugin of HUNT_PLUGIN_ITEMS){
    const inventory=createHuntInventory({tamerRank:6,battleBadges:[7,17,34,54]});inventory.grant(plugin.itemId,1);
    const loadout=createHuntLoadout({inventory});loadout.fitPlugin(0,plugin.itemId);
    const caps=loadout.getHudCapabilities(),hud=huntPluginReadout(runtime,caps),target=huntTargetReadout(runtime,caps);
    if(plugin.pluginKind==='ANALYZER'){
      for(const key of ['GENERATION','FAMILY','ALIGNMENT','HP','PERSONALITY','CAPACITY'])assert.equal(target[key.toLowerCase()]!=='???',plugin.capability.analyzerFields.includes(key),plugin.itemId+key);
      assert.equal(target.name,'亞古獸');
    }else assert.equal(target.name,'???');
    assert.equal(hud.memory!==null,plugin.pluginKind==='MEMORY_CHECKER');
    assert.equal(hud.radar!==null,plugin.pluginKind==='RADAR_SEARCH');
    assert.deepEqual(hud.counters.map(c=>c.id),caps.itemCounters);
    assert.equal(wild.currentHp,90);assert.equal(state.usedG,12);
  }
});
import { listChampionshipGates } from '../src/championship/gate/gateCatalog.js';
import { createChampionshipStandaloneApp } from '../src/championship/app/championshipStandaloneApp.js';
import { createGateHuntPresentationSource } from '../src/championship/app/gateHuntPresentationSource.js';

test('all sixteen Gate previews resolve real production images by field identity, including shared variants', () => {
  for (const gate of listChampionshipGates()) {
    const thumbnail = huntGateThumbnail(gate);
    assert.equal(thumbnail.fieldId, gate.originalFields.dayFieldId);
    assert.ok(thumbnail.src.startsWith('assets/production/hunt/'));
    assert.ok(fs.existsSync(thumbnail.src));
    assert.equal(thumbnail.evidence, 'PRODUCTION_DAY_FIELD_PREVIEW');
    assert.match(gate.codeString, /^ID:/);
  }
  assert.equal(huntGateThumbnail({}), null);
});

test('selected target readout does not leak hidden identity or HP without an analyzer', () => {
  let selectedId = null;
  const wild = { wildId: 'wild-1', speciesId: 'species-010', currentHp: 90, maxHp: 210, hpEvidence: 'ROM_VERIFIED_INITIALIZATION' };
  const runtime = { getWildCreatures: () => [wild], getSelectedWildId: () => selectedId };
  assert.equal(huntTargetReadout(runtime, {}), null);
  selectedId = wild.wildId;
  const hidden = huntTargetReadout(runtime, { analyzerFields: [] });
  assert.equal(hidden.hp, '???');
  assert.equal(hidden.hpEvidence, 'PLUGIN_GATED');
  assert.equal(hidden.speciesId, undefined);
  const visible = huntTargetReadout(runtime, { analyzerFields: ['HP'] });
  assert.equal(visible.hp, '210');
  assert.equal(visible.capacity, '???');
  selectedId = 'removed';
  assert.equal(huntTargetReadout(runtime, { analyzerFields: ['HP'] }), null);
});

test('normal selection publishes target changes once through the existing source without adding save keys', async () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  const app = createChampionshipStandaloneApp({ storage,
    catalog: JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json')),
    cages: JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json')).cages });
  await app.newGame();
  const source = createGateHuntPresentationSource(app);
  let events = 0;
  const unsubscribe = source.subscribe(() => events++);
  try {
    source.intents.openGate();
    const grass = source.getFrame().gateSelect.gates.find((gate) => gate.biomeId === 'Grass');
    source.intents.selectGate(grass.gateId);
    assert.equal(grass.codeString, 'ID:031SD6JH');
    assert.equal(grass.entranceFeeBits, 0);
    assert.equal(source.getFrame().gateSelect.walletBits, app.getShopFrame().bits);
    source.intents.confirmGate();
    source.intents.beginHunt();
    const target = app.getHuntRuntime().getWildCreatures()[0];
    const before = events;
    const savedKeys = [...data.keys()];
    assert.equal(source.intents.selectWildAt(target.worldX, target.worldY), true);
    assert.equal(events, before + 1);
    assert.equal(source.getFrame().huntField.hud.target.hp, '???');
    assert.deepEqual([...data.keys()], savedKeys);
    source.intents.selectWildAt(-999, -999);
    assert.equal(source.getFrame().huntField.hud.target, null);
  } finally { unsubscribe(); await app.dispose(); }
});
