import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as THREE from "../node_modules/three/build/three.module.js";

import {
  ORIGINAL_NITRO_VFX_EVENT_ALIASES,
  ORIGINAL_NITRO_VFX_SYSTEM_COUNT,
  ORIGINAL_NITRO_VFX_SYSTEMS,
  resolveOriginalNitroVfxSystemId
} from "../src/championship/presentation/vfx/originalVfxSystemBindings.js";
import {
  createLicensedVfxRuntime,
  LICENSED_VFX_ASSET_ID,
  validateLicensedVfxRuntimeManifest
} from "../src/championship/presentation/vfx/licensedVfxRuntimeBundle.js";

const MANIFEST_PATH = "assets/production/vfx/licensed-runtime-v1/manifest.json";
const HITSPARK_SHA256 = "56FDB4267A5FA08FE0437DA69E821777496BBFF94F562522E0F2C3493E7513F2";
const NITRO_EXTENSIONS = [".nsbmd", ".nsbca", ".nsbta", ".nsbma", ".nsbva"];

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function walkFiles(relativeDir) {
  const start = path.resolve(relativeDir);
  const output = [];
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const item = path.join(start, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(item));
    else output.push(path.relative(".", item).replaceAll("\\", "/"));
  }
  return output;
}

const registry = JSON.parse(fs.readFileSync("docs/art/ART_ASSET_REGISTRY.json", "utf8"));
const nitroFamilies = registry.assets.filter((asset) => asset.assetKind === "NITRO_3D_EFFECT_FAMILY");
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const checked = validateLicensedVfxRuntimeManifest(manifest);

test("licensed VFX runtime stores exactly the 26 Nitro 3D families", () => {
  assert.equal(checked.assetId, LICENSED_VFX_ASSET_ID);
  assert.equal(checked.family, "VFX");
  assert.equal(checked.runtimeEligible, true);
  assert.equal(checked.shippingReady, false);
  assert.equal(checked.gateEarthMounted, false);
  assert.equal(checked.defaultPreviewSystemId, null);
  assert.equal(checked.tickerPolicy, "CALLER_OWNED_UPDATE_DELTA_MS");
  assert.equal(checked.systems.length, ORIGINAL_NITRO_VFX_SYSTEM_COUNT);
  assert.equal(nitroFamilies.length, ORIGINAL_NITRO_VFX_SYSTEM_COUNT);
  assert.deepEqual(
    checked.systems.map((system) => system.logicalGroup).sort(),
    nitroFamilies.map((asset) => asset.logicalGroup).sort()
  );
  assert.deepEqual(
    ORIGINAL_NITRO_VFX_SYSTEMS.map((entry) => entry.systemId),
    checked.systems.map((system) => system.systemId)
  );
  assert.ok(checked.systems.some((system) => system.systemId === "battle-test_buff"));
  assert.ok(checked.systems.some((system) => system.systemId === "battle-test_eff"));
  assert.ok(checked.systems.some((system) => system.systemId === "battle-earth_hit"));
});

test("preview aliases map the four traced events onto licensed system ids", () => {
  assert.equal(resolveOriginalNitroVfxSystemId("hitspark_big"), "battle-hitspark_big");
  assert.equal(resolveOriginalNitroVfxSystemId("hypereffect"), "battle-hypereffect");
  assert.equal(resolveOriginalNitroVfxSystemId("spark"), "common-spark");
  assert.equal(resolveOriginalNitroVfxSystemId("rain"), "common-rain");
  assert.deepEqual(checked.previewAliases, ORIGINAL_NITRO_VFX_EVENT_ALIASES);
});

test("licensed VFX models live under production, hash-match, and keep sidecars to hyper and spark", () => {
  for (const system of checked.systems) {
    assert.match(system.model, /^assets\/production\/vfx\/licensed-runtime-v1\//);
    assert.equal(fs.existsSync(system.model), true, system.model);
    assert.equal(sha256File(system.model), system.modelSha256, system.model);
    assert.equal(system.triggerBinding, "EXTERNAL_PRESENTATION_EVENT_REQUIRED");
    assert.equal(system.playback, "CALLER_CONTROLLED_NO_PRIVATE_TICKER");
    for (const texture of system.textures) {
      assert.equal(fs.existsSync(texture.src), true, texture.src);
      assert.equal(sha256File(texture.src), texture.sha256, texture.src);
    }
  }
  const hitspark = checked.systems.find((system) => system.systemId === "battle-hitspark_big");
  const hyper = checked.systems.find((system) => system.systemId === "battle-hypereffect");
  const spark = checked.systems.find((system) => system.systemId === "common-spark");
  assert.equal(hitspark.modelSha256, HITSPARK_SHA256);
  assert.deepEqual(hyper.sidecars, [
    "assets/production/vfx/licensed-runtime-v1/battle/hypereffect/hypereffect.visibility.json"
  ]);
  assert.deepEqual(spark.sidecars, [
    "assets/production/vfx/licensed-runtime-v1/common/spark/spark.material-animation.json"
  ]);
  for (const system of checked.systems) {
    if (system.systemId === "battle-hypereffect" || system.systemId === "common-spark") continue;
    assert.deepEqual(system.sidecars, [], system.systemId);
  }
});

test("licensed VFX runtime does not carry Nitro binaries or Gate Earth", () => {
  const files = walkFiles("assets/production/vfx/licensed-runtime-v1");
  assert.ok(files.every((file) => (
    file.endsWith(".glb") || file.endsWith(".png") || file.endsWith(".json")
  )));
  assert.ok(files.every((file) => NITRO_EXTENSIONS.every((ext) => !file.toLowerCase().endsWith(ext))));
  assert.ok(files.every((file) => !/gate[_-]?earth|gate[_-]?select/i.test(file)));
  assert.equal(checked.gateEarthMounted, false);
  assert.throws(
    () => validateLicensedVfxRuntimeManifest({ ...checked, gateEarthMounted: true }),
    /GATE_EARTH/
  );
});

test("licensed VFX loader resolves aliases, advances from caller delta, and refuses Gate Earth", async () => {
  const loader = {
    async loadAsync() {
      const scene = new THREE.Group();
      scene.name = "effect_root";
      return {
        scene,
        animations: [],
        parser: { json: { animations: [] }, associations: new Map() }
      };
    }
  };
  const runtime = createLicensedVfxRuntime({ manifest: checked, loader });
  assert.equal(runtime.listSystems().length, ORIGINAL_NITRO_VFX_SYSTEM_COUNT);
  assert.equal(runtime.resolveSystemId("hitspark_big"), "battle-hitspark_big");
  const instance = await runtime.load("hitspark_big", { channel: "preview", loop: true });
  assert.equal(instance.systemId, "battle-hitspark_big");
  assert.equal(instance.getDiagnostics().ticker, "CALLER_OWNED");
  instance.update(16);
  assert.equal(instance.getDiagnostics().elapsedSeconds > 0, true);
  instance.sampleNativeFrame(8);
  const sampled=instance.getDiagnostics().elapsedSeconds;
  instance.sampleNativeFrame(8);
  assert.equal(instance.getDiagnostics().elapsedSeconds,sampled,'redraw must not advance animation');
  instance.sampleNativeFrame(0);
  assert.equal(instance.getDiagnostics().elapsedSeconds,0,'next attack restarts the cached resource');
  assert.throws(()=>instance.sampleNativeFrame(-1),/INVALID_NATIVE_FRAME/);
  await assert.rejects(runtime.load("gate-earth"), /UNKNOWN_SYSTEM/);
  await runtime.unloadAll();
  assert.equal(runtime.getActive("preview"), null);
});

test("battle VFX overlay uses the Pixi ticker, authored camera, and no pointer", () => {
  const overlay = fs.readFileSync("src/championship/presentation/vs5/createBattleVfxThreeOverlay.js", "utf8");
  const styles = fs.readFileSync("src/championship/app/vs5Styles.css", "utf8");
  const main = fs.readFileSync("src/championship/app/main.js", "utf8");
  assert.doesNotMatch(overlay, /requestAnimationFrame|setAnimationLoop/);
  assert.match(overlay, /stage\.app\.ticker\.add/);
  assert.match(overlay, /PRODUCT_AUTHORED_PREVIEW_FRAMING/);
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /\.cm-vs5-vfx-overlay/);
  assert.match(main, /vfxArt/);
  assert.doesNotMatch(main, /battleWeatherVfx|publishWeather/);
});

// CPU/fake renderer checks do not establish real WebGL/iOS crash acceptance.
import {prepareBattleVfxGpu} from '../src/championship/presentation/vs5/prepareBattleVfxGpu.js';
function warmupFixture(count=3){
 const groups=Array.from({length:count},(_,i)=>({visible:i===0,frustumCulled:i%2===0,
  traverse(fn){fn(this);}}));
 const records=[],draws=[],scene={},camera={};let clears=0;
 const renderer={domElement:{style:{visibility:'inherit'}},pixelRatio:1,context:{same:true,isContextLost:()=>false},getContext(){return this.context;},
  render(s,c){assert.equal(s,scene);assert.equal(c,camera);assert.equal(this.domElement.style.visibility,'hidden');
   assert.equal(groups.filter(g=>g.visible).length,1);assert.ok(groups.every(g=>g.frustumCulled===false));draws.push(groups.findIndex(g=>g.visible));},
  clear(){clears++;}};
 const original=groups.map(g=>({visible:g.visible,frustumCulled:g.frustumCulled}));
 const options={renderer,groups,scene,camera,yieldTask:async()=>{},record:(t,r)=>records.push({type:t,...r})};
 const restored=(expectedVisibility='inherit')=>{assert.deepEqual(groups.map(g=>({visible:g.visible,frustumCulled:g.frustumCulled})),original);
  assert.equal(renderer.domElement.style.visibility,expectedVisibility);assert.equal(renderer.pixelRatio,1);assert.equal(renderer.context.same,true);};
 return {options,groups,renderer,records,draws,restored,clears:()=>clears};
}
test('VFX first-use preparation submits one existing group at a time with no visible flash or context replacement',async()=>{
 const h=warmupFixture(81);const result=await prepareBattleVfxGpu(h.options);
 assert.equal(result.groups,81);assert.equal(result.submissionOnly,true);assert.deepEqual(h.draws,Array.from({length:81},(_,i)=>i));
 assert.deepEqual(h.records.map(r=>[r.phase,r.gpuWarmupGroups]),[['start',0],['done',81]]);assert.equal(h.clears(),1);h.restored();
});
test('VFX preparation restores flags/canvas on render failure and never claims ready',async()=>{
 const h=warmupFixture(),failure=Error('controlled render failure');h.renderer.render=()=>{throw failure;};
 h.renderer.clear=()=>{throw Error('secondary clear failure');};
 await assert.rejects(prepareBattleVfxGpu(h.options),e=>e===failure);h.restored('hidden');
 assert.deepEqual(h.records.map(r=>r.phase),['start','error']);assert.equal(h.records.at(-1).gpuWarmupGroups,0);
});
test('VFX preparation cancellation during yielded work prevents the next submission and restores state',async()=>{
 const h=warmupFixture();let active=true;
 await assert.rejects(prepareBattleVfxGpu({...h.options,isActive:()=>active,yieldTask:async()=>{active=false;}}),/WARMUP_CANCELLED/);
 assert.equal(h.draws.length,0);assert.equal(h.records.some(r=>r.phase==='done'),false);h.restored();
});
test('VFX preparation validates finite unique pool and diagnostic failures do not affect submission',async()=>{
 for(const count of [0,83]){const h=warmupFixture(count);await assert.rejects(prepareBattleVfxGpu(h.options),/GROUP_BOUND/);assert.equal(h.draws.length,0);h.restored();}
 const h=warmupFixture();await assert.rejects(prepareBattleVfxGpu({...h.options,groups:[h.groups[0],h.groups[0]]}),/GROUP_BOUND/);
 await prepareBattleVfxGpu({...h.options,record(){throw Error('diagnostic unavailable');}});assert.equal(h.draws.length,3);h.restored();
});
test('VFX first-use preparation stays before overlay ticker registration and opening-ready gate',()=>{
 const source=fs.readFileSync('src/championship/presentation/vs5/createBattleVfxThreeOverlay.js','utf8');
 assert.ok(source.indexOf('await prepareBattleVfxGpu')<source.indexOf('stage.app.ticker.add(advance'));
 assert.ok(source.includes("stage:'first-vfx-render'"));
 const main=fs.readFileSync('src/championship/app/main.js','utf8');
 assert.ok(main.indexOf('vfxOverlay = await loadOptionalBattleVfxOverlay')<main.indexOf('activeRuntime.markOpeningReady()'));
 assert.ok(main.includes('() => !disposed'));
});

test('VFX context loss before or during render rejects instead of recording false completion',async()=>{
 for(const during of [false,true]){
  const h=warmupFixture();let lost=!during;h.renderer.context.isContextLost=()=>lost;
  const render=h.renderer.render;h.renderer.render=function(...args){render.apply(this,args);lost=true;};
  await assert.rejects(prepareBattleVfxGpu(h.options),/CONTEXT_LOST/);
  assert.equal(h.records.some(r=>r.phase==='done'),false);assert.equal(h.records.at(-1).gpuWarmupGroups,0);h.restored('hidden');
 }
});
test('VFX clear-only failure remains failure and never exposes a preparation frame',async()=>{
 const h=warmupFixture(),failure=Error('clear failed');h.renderer.clear=()=>{throw failure;};
 await assert.rejects(prepareBattleVfxGpu(h.options),e=>e===failure);
 assert.equal(h.records.some(r=>r.phase==='done'),false);assert.equal(h.records.at(-1).gpuWarmupGroups,3);h.restored('hidden');
});
test('VFX nested sidecar visibility restores exactly and PWA430x932/DPR3 context is not resized by preparation',async()=>{
 const h=warmupFixture(1),children=[{visible:false,frustumCulled:true},{visible:true,frustumCulled:false}];
 h.groups[0].traverse=fn=>{fn(h.groups[0]);children.forEach(fn);};
 const original=structuredClone(children),canvasSize={width:430,height:932},devicePixelRatio=3;
 h.renderer.canvasSize=canvasSize;
 const render=h.renderer.render;h.renderer.render=function(...args){assert.ok(children.every(c=>c.visible&&!c.frustumCulled));render.apply(this,args);};
 await prepareBattleVfxGpu(h.options);assert.deepEqual(children,original);h.restored();
 assert.deepEqual(h.renderer.canvasSize,{width:430,height:932});assert.equal(devicePixelRatio,3);assert.equal(h.renderer.pixelRatio,1);
 const source=fs.readFileSync('src/championship/presentation/vs5/createBattleVfxThreeOverlay.js','utf8');
 const prepared=source.indexOf('await prepareBattleVfxGpu');
 assert.ok(source.indexOf('resize();',prepared)<source.indexOf('stage.onResize(resize)',prepared));
});
