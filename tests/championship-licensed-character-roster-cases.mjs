import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { LICENSED_CHARACTER_MANIFEST, loadLicensedCharacterRoster } from "../src/championship/presentation/licensedCharacterRoster.js";
import { loadPixiCharacterRuntimeBundle } from "../src/championship/presentation/pixiCharacterRuntimeBundle.js";
import { NATIVE_HUNT_CHARACTER_FRAME_CONTRACT, applyNativeCharacterCellGeometry } from "../src/championship/presentation/nativeHuntCharacterAction.js";

const manifest = JSON.parse(fs.readFileSync(LICENSED_CHARACTER_MANIFEST, "utf8"));
const productionIndex = JSON.parse(fs.readFileSync("assets/production/ART_PRODUCTION_INDEX.json", "utf8"));
const directory = path.dirname(LICENSED_CHARACTER_MANIFEST);
const manifestUrl = pathToFileURL(path.resolve(LICENSED_CHARACTER_MANIFEST)).href;
const args = { manifest, productionIndex, manifestUrl, PIXI: {}, speciesIds: ["species-000"] };

test("the complete 224-art/228-species material set has intact cells, source ticks and independent Main/Sub atlases", () => {
  assert.equal(manifest.records.length, 224);
  assert.equal(manifest.speciesBindings.length, 228);
  assert.equal(manifest.records.filter((record) => record.kind === "egg").length, 8);
  let cells = 0, sequences = 0, pages = 0;
  for (const record of manifest.records) {
    for (const file of record.files) {
      const bytes = fs.readFileSync(path.join(directory, file.path));
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), file.sha256, file.path);
    }
    const runtime = JSON.parse(fs.readFileSync(path.join(directory, record.runtime), "utf8"));
    for (const side of ["main", "sub"]) {
      const textures = new Set();
      for (const atlas of runtime.sides[side].atlases) {
        const data = JSON.parse(fs.readFileSync(path.join(directory, record.entityId, atlas.data), "utf8"));
        Object.keys(data.frames).forEach((key) => textures.add(key));
        pages += 1;
      }
      cells += textures.size;
      sequences += runtime.sides[side].animations.length;
      for (const animation of runtime.sides[side].animations) {
        assert.equal(animation.semanticAlias, null);
        for (const frame of animation.frames) { assert.ok(textures.has(frame.texture)); assert.ok(frame.ticks > 0); }
      }
    }
  }
  assert.deepEqual({ cells, sequences, pages }, { cells: 17235, sequences: 11480, pages: 503 });
});

test("scene loading uses the species lookup crosswalk, deduplicates shared art and never assigns M201 to unknown species", async () => {
  const loaded = [], disposed = [], created = [];
  const bundle = await loadLicensedCharacterRoster({ ...args,
    speciesIds: ["species-000", "championship:creature:species-000", "species-224", "species-999"],
    async loadBundle(options) {
      loaded.push(options);
      return { createActor(request) { created.push(request); return { sprite: { identity: options.runtimeUrl } }; },
        async dispose() { disposed.push(options.runtimeUrl); } };
    }
  });
  assert.equal(loaded.length, 2);
  assert.ok(loaded.every((item) => item.sides.length === 1 && item.sides[0] === "main"));
  assert.match(bundle.createActor({ speciesId: "species-000" }).sprite.identity, /e000_digitama/);
  assert.match(bundle.createActor({ speciesId: "species-224" }).sprite.identity, /m201_agumon/);
  assert.equal(bundle.createActor({ speciesId: "species-999" }), null);
  assert.ok(created.every((item) => item.animation === 0 && item.reducedMotion === true));
  await bundle.dispose(); await bundle.dispose();
  assert.equal(disposed.length, 2);
  assert.throws(() => bundle.createActor(), /DISPOSED/);
});

test("missing art is isolated, unregistered/private-release-invalid entries are refused, and malformed paths cannot escape", async () => {
  let attempts = 0;
  const loadBundle = async () => { attempts += 1; throw new Error("MISSING_TEST_IMAGE"); };
  const bundle = await loadLicensedCharacterRoster({ ...args, loadBundle });
  assert.equal(bundle.createActor({ speciesId: "species-000" }), null);
  assert.equal(bundle.getDiagnostics().failures[0].reason, "MISSING_TEST_IMAGE");
  await bundle.dispose();
  await assert.rejects(loadLicensedCharacterRoster({ ...args, productionIndex: { entries: [] }, loadBundle }), /NOT_REGISTERED/);
  const broken = structuredClone(manifest);
  broken.records[0].runtime = "../../outside/runtime.json";
  await assert.rejects(loadLicensedCharacterRoster({ ...args, manifest: broken, loadBundle }), /INVALID_CHARACTER_RUNTIME_PATH/);
  assert.equal(attempts, 1);
});

test("the real Pixi bundle loader loads Main only and releases resources when a cell reference is broken", async () => {
  const unloaded = [], loaded = [];
  const runtimeFile = path.join(directory, manifest.records[0].runtime);
  const runtime = JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
  const runtimeUrl = pathToFileURL(path.resolve(runtimeFile)).href;
  class Sprite { constructor({ texture }) { this.texture = texture; this.anchor = { set() {} }; } }
  class Spritesheet {
    constructor({ data }) { this.textures = Object.fromEntries(Object.keys(data.frames).map((key) => [key, { key, source: {} }])); }
    async parse() {} destroy() {}
  }
  const PIXI = { Sprite, Spritesheet, Assets: {
    async load(url) { loaded.push(url); return url === runtimeUrl ? runtime : url.endsWith(".json") ? JSON.parse(fs.readFileSync(new URL(url), "utf8")) : { source: {} }; },
    async unload(url) { unloaded.push(url); }
  } };
  const bundle = await loadPixiCharacterRuntimeBundle({ PIXI, runtimeUrl, sides: ["main"] });
  assert.equal(bundle.getDiagnostics().textureCount, 13);
  assert.ok(loaded.every((url) => !url.includes("sub-atlas")));
  assert.throws(() => bundle.createActor({ side: "sub", animation: 0 }), /unloaded/);
  assert.equal(bundle.createActor({ animation: 0 }).sprite.texture.source.scaleMode, "nearest");
  await bundle.dispose();
  assert.equal(unloaded.length, 3);
  runtime.sides.main.animations[0].frames[0].texture = "MISSING_CELL";
  await assert.rejects(loadPixiCharacterRuntimeBundle({ PIXI, runtimeUrl, sides: ["main"] }), /texture is missing/);
  assert.equal(unloaded.length, 6);
});

test('decoded bitmaps close after asset-source destruction and repeated dispose awaits the same unload',async()=>{
  let closed=0,finishUnload;
  const gate=new Promise(resolve=>{finishUnload=resolve;});
  const resource={close(){closed++;}},source={resource,destroyed:false};
  const runtimeUrl='https://fixture.invalid/e000/runtime.json';
  const runtime={entityId:'e000',sides:{main:{atlases:[{data:'atlas.json',image:'atlas.png'}],animations:[{id:0,frames:[{texture:'frame',ticks:1}]}]}}};
  class Spritesheet{constructor(){this.textures={frame:{source}};}async parse(){}destroy(){}}
  const PIXI={Sprite:class{},Spritesheet,Assets:{
    async load(url){return url===runtimeUrl?runtime:url.endsWith('.json')?{frames:{frame:{}}}:{source};},
    async unload(url){if(url.endsWith('.png')){await gate;source.destroyed=true;source.resource=null;}}
  }};
  const bundle=await loadPixiCharacterRuntimeBundle({PIXI,runtimeUrl,sides:['main']});
  const first=bundle.dispose(),second=bundle.dispose();
  assert.equal(first,second);
  assert.equal(closed,0,'a bitmap must remain open until its texture source is unloaded');
  finishUnload();await second;
  assert.equal(closed,1);
  await bundle.dispose();assert.equal(closed,1);
});

test('hatching loads one shared atlas per entity and disposal waits for a pending decode', async()=>{
  const loads=[],releases=[];
  let completeDecode,notifyStarted;
  const decoding=new Promise(resolve=>{completeDecode=resolve;});
  const started=new Promise(resolve=>{notifyStarted=resolve;});
  const roster=await loadLicensedCharacterRoster({...args,async loadBundle({runtimeUrl}){
    loads.push(runtimeUrl);
    if(loads.length===2){notifyStarted();await decoding;}
    return {createActor(){return {sprite:{}};},async dispose(){releases.push(runtimeUrl);}};
  }});
  const first=roster.ensureSpecies('species-014');
  assert.equal(first,roster.ensureSpecies('championship:creature:species-014'));
  await started;
  const queued=roster.ensureSpecies('species-021');
  const closing=roster.dispose();
  assert.equal(closing,roster.dispose());
  assert.equal(releases.length,0);
  await assert.rejects(roster.ensureSpecies('species-015'),/DISPOSED/);
  completeDecode();await closing;
  assert.equal(await first,true);
  assert.equal(await queued,false,'queued species is never decoded after disposal');
  assert.equal(loads.length,2);
  assert.equal(new Set(releases).size,2);
  assert.deepEqual(roster.getDiagnostics().loadedEntityIds,[]);
});

test('all registered Main frames reach the Hunt, Raising and Battle presenters through the real roster', async()=>{
  // Real metadata, loader, roster and presenters; decoded images are represented
  // by keyed textures. Browser QA separately verifies actual GPU rendering.
  class Sprite { constructor({texture}) { this.texture=texture;this.anchor={x:.5,y:1,set(x,y){this.x=x;this.y=y;}};
    this.scale={x:1,y:1,set(x,y){this.x=x;this.y=y;}}; } }
  class Spritesheet {
    constructor({data}) { this.textures=Object.fromEntries(Object.entries(data.frames).map(([key,value])=>[key,{key,source:{resolution:1},packed:value}])); }
    async parse() {} destroy() {}
  }
  const PIXI={Sprite,Spritesheet,Assets:{
    async load(url){const source=typeof url==='string'?url:url.src;return source.endsWith('.json')?JSON.parse(fs.readFileSync(new URL(source),'utf8')):{source:{}};},
    async unload(){}
  }};
  const counts={hunt:0,raising:0,battle:0};
  for(const record of manifest.records){
    const speciesId=manifest.speciesBindings.find(b=>b.entityId===record.entityId).speciesId;
    const roster=await loadLicensedCharacterRoster({...args,PIXI,speciesIds:[speciesId]});
    const runtime=JSON.parse(fs.readFileSync(path.join(directory,record.runtime),'utf8'));
    for(const presentation of ['hunt','raising','battle']){
      const actor=roster.createActor({speciesId,presentation});
      assert.ok(presentation==='battle'?actor.battleAnimator:actor.nativeFramePresenter,`${record.entityId}:${presentation}`);
      let tick=0;
      for(const sequence of runtime.sides.main.animations){
        for(const [frameIndex,frame]of sequence.frames.entries()){
          const sample={contract:NATIVE_HUNT_CHARACTER_FRAME_CONTRACT,sequenceId:sequence.id,
            frameIndex,cell:frame.cell,flipBits:tick%4,elapsedQ12:0,active:1};
          const before=JSON.stringify(sample);
          const projected=presentation==='battle'?actor.battleAnimator.apply({battleFrame:tick,sequenceId:sequence.id,
            nativeRequest:true,nativeSample:sample}):actor.nativeFramePresenter.apply(sample);
          assert.equal(actor.sprite.texture.key,frame.texture,`${record.entityId}:${presentation}:${sequence.id}:${frameIndex}`);
          assert.equal(projected.cell,frame.cell);
          if(presentation!=='battle'){
            const units=presentation==='hunt'?2:1;
            assert.equal(applyNativeCharacterCellGeometry(actor.sprite,projected,units),true);
            assert.equal(actor.sprite.visible,!projected.geometry.blank);
            if(!projected.geometry.blank){
              const {spriteSourceSize:t,sourceSize:z}=actor.sprite.texture.packed;
              const sprite=actor.sprite;
              const box=[(t.x-z.w*sprite.anchor.x)*sprite.scale.x,(t.y-z.h*sprite.anchor.y)*sprite.scale.y,
                (t.x+t.w-z.w*sprite.anchor.x)*sprite.scale.x,(t.y+t.h-z.h*sprite.anchor.y)*sprite.scale.y];
              box.forEach((v,i)=>assert.ok(Math.abs(v-projected.geometry.nativeBounds[i]*units)<1e-8,
                `${record.entityId}:${presentation}:${frame.texture}: original origin/scale ${i}`));
            }
          }
          assert.equal(JSON.stringify(sample),before,'rendering must not mutate the owning simulation frame');
          counts[presentation]++;tick++;
        }
      }
    }
    await roster.dispose();
  }
  assert.deepEqual(counts,{hunt:14283,raising:14283,battle:14283});
});
