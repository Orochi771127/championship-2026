import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  applyNitroMaterialAnimation,
  applyNitroVisibility,
  sampleNitroMaterialAnimation,
  sampleNitroVisibility
} from "../src/championship/presentation/vfx/nitroVfxAnimationSidecar.js";

const root = process.cwd();
const visibility = JSON.parse(fs.readFileSync(path.join(root, "assets/production/vfx/original-rom-conversion-v1/hypereffect/hypereffect.visibility.json"), "utf8"));
const materialAnimation = JSON.parse(fs.readFileSync(path.join(root, "assets/production/vfx/original-rom-conversion-v1/spark/spark.material-animation.json"), "utf8"));

test('converted Hyper primitive visibility uses original skin node indices, never the synthetic wrapper',()=>{
  const receipt=JSON.parse(fs.readFileSync('docs/research/BATTLE_HYPER_VISIBILITY_BINDING_2026-09-07.json','utf8'));
  const bones=receipt.nodeNames.map(name=>({name,visible:true}));
  const meshes=receipt.primitives.map(({jointIndices})=>({isSkinnedMesh:true,visible:true,skeleton:{bones},geometry:{
    index:{count:3,getX:i=>i},getAttribute:name=>Object.fromEntries(['X','Y','Z','W'].map(axis=>['get'+axis,()=>axis==='X'?(name==='skinIndex'?jointIndices[0]:1):0]))
  }}));
  const root={visible:true,traverse:visit=>meshes.forEach(visit)};
  assert.equal(meshes.length,16);
  applyNitroVisibility(root,visibility,0);
  assert.deepEqual(meshes.map(m=>m.visible),[true,...new Array(15).fill(false)]);
  applyNitroVisibility(root,visibility,13);
  assert.deepEqual(meshes.map(m=>m.visible),[...new Array(15).fill(true),false]);
  assert.ok(root.visible && bones.every(b=>b.visible));
  applyNitroVisibility(root,visibility,26);
  assert.deepEqual(meshes.map(m=>m.visible),[true,...new Array(15).fill(false)]);
});

test("hypereffect VIS0 sidecar preserves all 26 x 19 visibility samples", () => {
  assert.equal(visibility.frameCount, 26);
  assert.equal(visibility.nodeCount, 19);
  assert.equal(visibility.frames.length, 26);
  assert.ok(visibility.frames.every((frame) => /^[01]{19}$/.test(frame)));
  assert.equal(visibility.frames[0], "1110000100000000000");
  assert.equal(visibility.frames[13], "1111111111111111110");
  assert.deepEqual(sampleNitroVisibility(visibility, 26), sampleNitroVisibility(visibility, 0));

  const nodes = new Map(visibility.nodeNames.map((name) => [name, { name, visible: false }]));
  applyNitroVisibility({ getObjectByName: (name) => nodes.get(name) }, visibility, 0);
  assert.equal(nodes.get(visibility.nodeNames[0]).visible, true);
  assert.equal(nodes.get(visibility.nodeNames[3]).visible, false);
});

test("spark MAT0 sidecar preserves exact four-track alpha runs", () => {
  assert.equal(materialAnimation.frameCount, 480);
  assert.deepEqual(materialAnimation.tracks.map((track) => track.materialName), ["spark_a", "spark_a1", "spark_a2", "spark_a3"]);
  const samples0 = sampleNitroMaterialAnimation(materialAnimation, 0);
  assert.deepEqual(samples0.map((sample) => sample.polygonAlpha), [31, 0, 0, 0]);
  const samples110 = sampleNitroMaterialAnimation(materialAnimation, 110);
  assert.deepEqual(samples110.map((sample) => sample.polygonAlpha), [0, 31, 0, 31]);

  const materials = new Map(materialAnimation.tracks.map(({ materialName }) => [materialName, {
    name: materialName,
    opacity: 1,
    transparent: false,
    color: { setRGB(red, green, blue) { this.value = [red, green, blue]; } }
  }]));
  applyNitroMaterialAnimation({ traverse: (visit) => [...materials.values()].forEach((material) => visit({ material })) }, materialAnimation, 110);
  assert.equal(materials.get("spark_a").opacity, 0);
  assert.equal(materials.get("spark_a1").opacity, 1);
  assert.equal(materials.get("spark_a").needsUpdate, true);
});

test("runtime sidecars contain no ROM payload or source-machine path", () => {
  const serialized = JSON.stringify([visibility, materialAnimation]);
  assert.doesNotMatch(serialized, /[A-Z]:\\|\.(?:nds|srl|nsbmd|nsbca|nsbta|nsbma|nsbva)\b/i);
  assert.match(visibility.timebase.status, /UNRESOLVED/);
  assert.match(materialAnimation.timebase.status, /UNRESOLVED/);
});
