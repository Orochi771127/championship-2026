import {loadRegisteredHuntFeedbackArt,originalHuntMeatCells,ORIGINAL_HUNT_MEAT_MANIFEST} from '../tools/authoring/legacy-render/huntFeedbackArt.mjs';
import {loadRegisteredHuntFeedbackArt as loadPublicHuntFeedback} from '../src/championship/presentation/huntFeedbackArt.js';
import {publicRuntimeFetchFixture} from './helpers/public-runtime-fetch.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeCharacterAnimationTimeline} from '../src/championship/presentation/characterAnimationTimeline.js';
import {createPixiAssetScope} from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';
import {huntFeedbackCell,huntFeedbackBinding,huntTrapLayers,HUNT_FEEDBACK_ART_ID,HUNT_FEEDBACK_ART_MANIFEST} from '../src/championship/presentation/huntFeedbackArt.js';
import {loadRegisteredCharacterHudArt,validateCharacterHudArt,CHARACTER_HUD_ART_ID,CHARACTER_HUD_ART_MANIFEST} from '../src/championship/presentation/characterHudArt.js';

test('Hunt feedback clock matches the verified native timeline for every catalog tool duration',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../src/data/championship/catalogs/hunt-tools.r1.json',import.meta.url)));
  for(const banks of Object.values(catalog.controllerAnimations))for(const bank of banks)for(const row of bank){
    const sequence={id:0,playbackMode:row.mode,loopStartFrame:row.loop,frames:row.ticks.map((ticks,cell)=>({ticks,cell,texture:String(cell)}))};
    const native=createNativeCharacterAnimationTimeline(sequence);
    for(let age=0;age<200;age++){assert.equal(huntFeedbackCell(sequence,age),native.getSnapshot().cell);native.advanceNative(4096);}
  }
});

test('Hunt feedback selects the existing shot selector and original burst sequence without inventing a trap binding',()=>{
  assert.deepEqual(huntFeedbackBinding({kind:'SHOT_IMPACT',status:2,remaining:7}),{kind:'SHOT',item:2,sequence:0,remaining:7});
  assert.deepEqual(huntFeedbackBinding({kind:'TOOL_BURST',sourceKind:'MINE',itemIndex:1,sequence:4,remaining:12}),{kind:'MINE',item:1,sequence:4,remaining:12});
  assert.equal(huntFeedbackBinding({kind:'CAPTURE_TRAP',triggered:true}),null);
  assert.equal(huntFeedbackBinding({kind:'WIRE'}),null);
});

test('New reference art loaders refuse all public hosts before reading a manifest',async()=>{
  for(const load of [loadRegisteredHuntFeedbackArt,loadRegisteredCharacterHudArt])for(const baseUrl of ['https://game.example/championship.html','https://127.0.0.1.example/']){
    assert.equal(await load({baseUrl,fetchImpl:()=>assert.fail('public asset read')}),null);
  }
});

test('carried kinds load only their own banks, retain burst frames, and release the same textures',async()=>{
  // A complete synthetic 19-bank manifest keeps this portable and independent
  // of the optional local reference pack. Identity/timelines remain validated.
  const entry={assetId:HUNT_FEEDBACK_ART_ID,manifestPath:HUNT_FEEDBACK_ART_MANIFEST,runtimeEligible:true,localOnly:true,runtimeScope:'LOOPBACK_RESEARCH_ONLY',publicReleasePermitted:false,shippingReady:false,rightsStatus:'ROM_COPYRIGHTED_REFERENCE'};
  const banks=Array.from({length:19},(_,i)=>{
    const bank=`e002_hunt_test${i}`,kind=i<3?'SHOT':'MINE';
    return {bank,kind,itemIndex:i,cells:[{cell:0,src:HUNT_FEEDBACK_ART_MANIFEST.replace('manifest.json',`${bank}/cell-000.png`),width:8,height:8,origin:[0,0],sha256:'a'.repeat(64)}],sequences:[{id:0,playbackMode:1,frames:[{cell:0,ticks:20}]}]};
  });
  for(const kinds of [['HAND','ROPE'],['SHOT'],['MINE']]){
    const loaded=[],unloaded=[];
    const art=await loadRegisteredHuntFeedbackArt({baseUrl:'http://127.0.0.1:8732/',kinds,
      fetchImpl:async url=>({ok:true,json:async()=>String(url).endsWith('ART_PRODUCTION_INDEX.json')?{entries:[entry]}:{schemaVersion:1,...entry,banks}}),
      PIXI:{Assets:{load:async src=>{loaded.push(src);return {width:8,height:8,source:{}};},unload:async src=>unloaded.push(src)}}});
    const expected=banks.filter(b=>kinds.includes(b.kind)).flatMap(b=>b.cells.map(c=>c.src));
    assert.deepEqual(loaded,expected);
    assert.equal(Boolean(art.getFrame({kind:'SHOT_IMPACT',status:0,remaining:20})),kinds.includes('SHOT'));
    assert.equal(Boolean(art.getFrame({kind:'TOOL_BURST',sourceKind:'MINE',itemIndex:3,sequence:0,remaining:20})),kinds.includes('MINE'));
    await art.dispose();await art.dispose();assert.deepEqual(unloaded,expected);
  }
});

test('Trap secondary animation switches at the original 31-update boundary and prison retains four parts',()=>{
  const trap={kind:'CAPTURE_TRAP',itemIndex:0,triggered:true,x:20,y:40,visualTicks:30};
  assert.deepEqual(huntTrapLayers(trap).slice(1).map(o=>o.visualBinding),[{sequence:2,elapsed:30}]);
  assert.deepEqual(huntTrapLayers({...trap,visualTicks:31}).slice(1).map(o=>o.visualBinding),[{sequence:4,elapsed:0}]);
  assert.deepEqual(huntTrapLayers({...trap,itemIndex:1}).slice(1).map(o=>o.visualBinding.sequence),[2,3,7]);
  assert.equal(huntTrapLayers({...trap,triggered:false}).length,1);
});

test('Raising HUD rejects Main art, changed native scale and shipping promotion',()=>{
  const entry={assetId:CHARACTER_HUD_ART_ID,manifestPath:CHARACTER_HUD_ART_MANIFEST,runtimeEligible:true,localOnly:true,runtimeScope:'LOOPBACK_RESEARCH_ONLY',publicReleasePermitted:false,shippingReady:false,rightsStatus:'ROM_COPYRIGHTED_REFERENCE'};
  const manifest={schemaVersion:1,...entry,binding:'OVL18_SELECTED_DB_SUB_SEQUENCE_0_FIRST_FRAME_STATIC',portraits:[{speciesId:'species-021',entityId:'m102_koromon',src:CHARACTER_HUD_ART_MANIFEST.replace('manifest.json','m102_koromon.png'),sourceBank:'m102_koromon_db_sub',sequenceId:0,nativeScale:2,width:20,height:20,sha256:'a'.repeat(64)}]};
  const index={entries:[entry]};assert.equal(validateCharacterHudArt(manifest,index).portraits.length,1);
  for(const patch of [{sourceBank:'m102_koromon_main'},{nativeScale:4},{sequenceId:1}]){
    const copy=structuredClone(manifest);Object.assign(copy.portraits[0],patch);assert.throws(()=>validateCharacterHudArt(copy,index));
  }
  assert.throws(()=>validateCharacterHudArt({...manifest,shippingReady:true},index));
});

test('ordinary Hunt meat uses the four original care tiers at native world size; big, poison and stun meat keep their banks',async()=>{
  const read=p=>JSON.parse(readFileSync(new URL(`../${p}`,import.meta.url)));
  const hunt=read(HUNT_FEEDBACK_ART_MANIFEST),care=read(ORIGINAL_HUNT_MEAT_MANIFEST);
  const index={entries:[{assetId:HUNT_FEEDBACK_ART_ID,manifestPath:HUNT_FEEDBACK_ART_MANIFEST,runtimeEligible:true,localOnly:true,runtimeScope:'LOOPBACK_RESEARCH_ONLY',publicReleasePermitted:false,shippingReady:false,rightsStatus:'ROM_COPYRIGHTED_REFERENCE'}]};
  const pngSize=src=>{const b=readFileSync(new URL(`../${src}`,import.meta.url));return {width:b.readUInt32BE(16),height:b.readUInt32BE(20)};};
  const cellSize=new Map(hunt.banks.flatMap(b=>b.cells.map(c=>[c.src,{width:c.width,height:c.height}])));
  const run=async({careResponse={ok:true,json:async()=>structuredClone(care)},size=src=>src.includes('/care19/')?pngSize(src):cellSize.get(src)}={})=>{
    const loaded=[],unloaded=[];
    const art=loadRegisteredHuntFeedbackArt({baseUrl:'http://127.0.0.1:8897/championship.html',kinds:['MEAT'],
      fetchImpl:async url=>{const s=String(url);if(s.endsWith('ART_PRODUCTION_INDEX.json'))return {ok:true,json:async()=>index};
        if(s.endsWith(ORIGINAL_HUNT_MEAT_MANIFEST))return careResponse;return {ok:true,json:async()=>structuredClone(hunt)};},
      PIXI:{Assets:{load:async src=>{loaded.push(src);return {...size(src),source:{}};},unload:async src=>unloaded.push(src)}}});
    return {art,loaded,unloaded};
  };
  const {art:pending,loaded}=await run(),art=await pending;
  // tier 3 -> meat-0 ... tier 0 -> meat-3; logical 32x24, origin [15,19], 128x96 raster drawn at 0.5 = 64x48.
  for(const tier of [3,2,1,0]){
    const frame=art.getFrame({kind:'MEAT',itemIndex:0,tier});
    assert.equal(frame.src,`assets/production/original-ui-intake-20261007/items/care19/meat-${3-tier}.png`);
    assert.deepEqual([frame.width,frame.height,frame.origin,frame.texture.width,frame.texture.height],[32,24,[15,19],128,96]);
    assert.deepEqual([frame.texture.width*frame.displayScale,frame.texture.height*frame.displayScale],[64,48]);
  }
  assert.equal(loaded.filter(src=>/e002_hunt_niku_nomal\/cell-00[0-3]\.png$/.test(src)).length,0);
  for(const [item,bank] of [[1,'e002_hunt_niku_big'],[2,'e002_hunt_niku_poison'],[3,'e002_hunt_niku_stun']])for(const tier of [3,2,1,0]){
    const frame=art.getFrame({kind:'MEAT',itemIndex:item,tier}),native=hunt.banks.find(b=>b.bank===bank).cells.find(c=>c.cell===3-tier);
    assert.equal(frame.src,native.src);assert.equal(frame.displayScale,undefined);assert.deepEqual(frame.origin,native.origin);
  }
  await art.dispose();
  // Failure never falls back to the old ordinary-meat cells: load rejects and releases what it loaded.
  await assert.rejects((await run({careResponse:{ok:false}})).art,/HUNT_ORIGINAL_MEAT_MANIFEST_UNAVAILABLE/);
  const wrong=await run({size:src=>src.includes('/care19/')?{width:32,height:24}:cellSize.get(src)});
  await assert.rejects(wrong.art,/HUNT_FEEDBACK_DIMENSIONS/);assert.deepEqual(wrong.unloaded.sort(),wrong.loaded.sort());
  const moved=structuredClone(care);moved.cells.find(c=>c.role==='meat'&&c.pose===2).nativeAnchorY=18;
  assert.throws(()=>originalHuntMeatCells(moved,hunt.banks.find(b=>b.bank==='e002_hunt_niku_nomal')),/HUNT_ORIGINAL_MEAT_CELL_INVALID/);
  assert.throws(()=>originalHuntMeatCells({...care,scale:2},hunt.banks.find(b=>b.bank==='e002_hunt_niku_nomal')),/HUNT_ORIGINAL_MEAT_MANIFEST_INVALID/);
});

test('shared care19 texture lifecycle across Raising -> Hunt -> Raising -> Hunt preserves textures without cross-scene corruption', async () => {
  const loaded = [], unloaded = [];
  const mockPixiAssets = {
    load: async src => { loaded.push(src); return { src, texture: { valid: true } }; },
    unload: async src => { unloaded.push(src); }
  };
  const PIXI = { Assets: mockPixiAssets };
  const meatSrc = 'assets/production/original-ui-intake-20261007/items/care19/meat-0.png';

  // 1. Raising Home opens and loads care19 meat
  const raisingScope1 = createPixiAssetScope(PIXI, 'http://127.0.0.1:8897/championship.html');
  const r1Tex = await raisingScope1.Assets.load(meatSrc);
  assert.equal(loaded.filter(s => s.endsWith('meat-0.png')).length, 1);
  assert.equal(unloaded.length, 0);

  // 2. Player enters Hunt; Hunt loads the same care19 meat
  const huntScope1 = createPixiAssetScope(PIXI, 'http://127.0.0.1:8897/championship.html');
  const h1Tex = await huntScope1.Assets.load(meatSrc);
  assert.equal(h1Tex, r1Tex, 'both scopes receive the shared texture instance');
  assert.equal(loaded.filter(s => s.endsWith('meat-0.png')).length, 1, 'no redundant network download');

  // 3. Player exits Hunt back to Raising; Hunt unloads its scope
  await huntScope1.Assets.unload(meatSrc);
  assert.equal(unloaded.length, 0, 'shared texture is not unloaded while Raising still holds it');

  // 4. Raising continues using texture safely; then Raising unloads
  await raisingScope1.Assets.unload(meatSrc);
  assert.equal(unloaded.filter(s => s.endsWith('meat-0.png')).length, 1, 'unloaded once all scopes release it');

  // 5. Player re-enters Hunt; Hunt re-loads care19 meat fresh
  const huntScope2 = createPixiAssetScope(PIXI, 'http://127.0.0.1:8897/championship.html');
  const h2Tex = await huntScope2.Assets.load(meatSrc);
  assert.equal(loaded.filter(s => s.endsWith('meat-0.png')).length, 2, 'successfully re-loaded after release');
  assert.ok(h2Tex.texture.valid);
  await huntScope2.Assets.unload(meatSrc);
  assert.equal(unloaded.filter(s => s.endsWith('meat-0.png')).length, 2);
});

test('mountHuntFieldPixiPresentation supports dynamic setFeedbackArt recovery, swaps art seamlessly, and disposes active art', async () => {
  const { mountHuntFieldPixiPresentation } = await import('../src/championship/presentation/vs2/createHuntFieldPixiPresentation.js');
  let disposed1 = false, disposed2 = false;
  const mockArt1 = {
    getFrame: () => ({ texture: { id: 'tex1' }, origin: [15, 19], width: 32, height: 24, displayScale: 2 }),
    dispose: () => { disposed1 = true; }
  };
  const mockArt2 = {
    getFrame: () => ({ texture: { id: 'tex2' }, origin: [15, 19], width: 32, height: 24, displayScale: 2 }),
    dispose: () => { disposed2 = true; }
  };

  class MockContainer {
    constructor() { this.children = []; this.position = { set() {} }; this.scale = { set() {} }; }
    addChild(...c) { this.children.push(...c); }
    removeChild() {}
    removeChildren() { this.children.length = 0; }
    destroy() {}
  }
  class MockGraphics extends MockContainer {
    constructor() {
      super();
      const proxy = new Proxy(this, {
        get(target, prop) {
          if (prop in target) return typeof target[prop] === 'function' ? target[prop].bind(target) : target[prop];
          return () => proxy;
        }
      });
      return proxy;
    }
  }
  class MockSprite extends MockContainer {
    constructor(texture) {
      super();
      this.texture = texture;
      this.anchor = { set() {} };
      this.scale = { set() {} };
      this.position = { set() {} };
      this.visible = false;
    }
  }

  const stage = {
    PIXI: { Container: MockContainer, Graphics: MockGraphics, Sprite: MockSprite },
    app: {
      screen: { width: 390, height: 844 },
      ticker: { add() {}, remove() {} },
      stage: { on() {}, off() {} },
      renderer: {}
    },
    createSceneRoot: () => new MockContainer(),
    markScene: () => () => {},
    onContextLost: () => () => {},
    onResize: () => () => {}
  };

  const source = {
    getFrame: () => ({
      huntField: {
        camera: { x: 0, y: 0, zoom: 1 },
        actor: { worldX: 0, worldY: 0 },
        wilds: [],
        toolState: { tools: [] }
      }
    }),
    getTerrainTheme: () => 'grass',
    intents: {
      panCamera: () => {},
      selectWildAt: () => {},
      abortEnclosureStroke: () => {}
    },
    field: {
      tick: () => {},
      getView: () => ({
        transform: { scale: 1 },
        camera: { left: 0, top: 0 },
        visibleChunks: [],
        player: { worldX: 0, worldY: 0, facing: 'right' },
        actor: { worldX: 0, worldY: 0, isMoving: false },
        wildCreatures: [],
        objects: [],
        tools: { objects: [{ kind: 'MEAT', itemIndex: 0, tier: 2, x: 10, y: 10 }], points: [] }
      }),
      world: {
        getBounds: () => ({ minX: -100, minY: -100, maxX: 100, maxY: 100 })
      }
    }
  };

  const scene = await mountHuntFieldPixiPresentation({ stage, source });
  assert.equal(scene.getFeedbackArt(), null, 'initial feedbackArt is null on fallback');
  scene.render(); // Renders with fallback geometry without throwing

  // Dynamically attach reloaded art
  scene.setFeedbackArt(mockArt1);
  assert.equal(scene.getFeedbackArt(), mockArt1, 'setFeedbackArt updates active art');
  assert.equal(disposed1, false);
  scene.render(); // Renders with reloaded mockArt1 sprite

  // Subsequent swap disposes previous art
  scene.setFeedbackArt(mockArt2);
  assert.equal(disposed1, true, 'previous art disposed on swap');
  assert.equal(scene.getFeedbackArt(), mockArt2, 'active art updated to new instance');
  assert.equal(disposed2, false);
  scene.render(); // Renders with mockArt2

  // Scene disposal disposes currently active art
  scene.dispose();
  assert.equal(disposed2, true, 'active art disposed on scene teardown');
});
// The original-source validator above remains exercised as authoring evidence.
// This normal runtime check reads only selected public descriptions and media.
test('public Hunt loader retains carried banks, original meat poses and exact frame clocks without authoring requests',async()=>{
 const calls=[],descriptor=JSON.parse(readFileSync('assets/production/public-runtime/hunt-feedback.render.v1.json','utf8'));
 const cells=new Map(descriptor.banks.flatMap(bank=>bank.cells.map(cell=>[cell.src,cell])));
 const loaded=[],unloaded=[];
 const art=await loadPublicHuntFeedback({baseUrl:'https://orochi771127.github.io/championship-2026/',fetchImpl:publicRuntimeFetchFixture({calls}),kinds:['MEAT','SHOT'],PIXI:{Assets:{load:async src=>{loaded.push(src);const c=cells.get(src);return {width:c.rasterWidth??c.width,height:c.rasterHeight??c.height,source:{}};},unload:async src=>unloaded.push(src)}}});
 assert.deepEqual(loaded,descriptor.banks.filter(b=>['MEAT','SHOT'].includes(b.kind)).flatMap(b=>b.cells.map(c=>c.src)));
 for(const tier of [0,1,2,3])assert.equal(art.getFrame({kind:'MEAT',itemIndex:0,tier}).src,`assets/production/original-ui-intake-20261007/items/care19/meat-${3-tier}.png`);
 assert.equal(art.getFrame({kind:'TOOL_BURST',sourceKind:'MINE',itemIndex:3,sequence:0,remaining:20}),null);
 assert.deepEqual(calls,['assets/production/public-runtime/hunt-feedback.render.v1.json']);
 await art.dispose();await art.dispose();assert.deepEqual(unloaded,loaded);
});
