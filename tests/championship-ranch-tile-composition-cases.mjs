import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { composeOriginalRanchTilePlanes } from "../src/championship/cage/ranchTileComposition.js";

const receipt = JSON.parse(readFileSync(new URL(
  "../docs/research/ranch-assembly-2026-09-06/native-compositor-receipt.json", import.meta.url), "utf8"));
function digest(values, stride) {
  const bytes = new Uint8Array(values.length * stride);
  const view = new DataView(bytes.buffer);
  values.forEach((value, i) => {
    if (stride === 1) view.setUint8(i, value);
    else if (stride === 2) view.setUint16(i * 2, value, true);
    else view.setInt32(i * 4, value, true);
  });
  return createHash("sha256").update(bytes).digest("hex");
}

test("all original ARM copy-loop outputs match for actual source maps, four ranks and ordered mixed compositions", () => {
  assert.equal(receipt.caseCount, 582);
  assert.equal(receipt.cases.length, receipt.caseCount);
  assert.equal(Object.keys(receipt.sources).length, 38);
  for (const vector of receipt.cases) {
    const result = composeOriginalRanchTilePlanes({ width: vector.width, initial: vector.initial ?? receipt.initialPlanes,
      steps: vector.steps.map((step) => ({ ...step, definitionIndex: step.definition,
        shapeIndex: step.shape, source: receipt.sources[step.fieldId] })) });
    for (const [plane, stride] of [["tiles",2],["attributes",1],["collision",1],["owners",4]]) {
      assert.equal(digest(result[plane], stride), vector.digests[plane], `${vector.name}: ${plane}`);
    }
  }
});

const source = (tiles, attributes, collision, width = tiles.length) =>
  ({ width, height: tiles.length/width, tiles, attributes, collision });

test("transparent tile rules differ between ordinary material and empty-cell filler", () => {
  const src = source([0,0,0,2], [0,1,2,3], [6,6,6,6]);
  const step = { source: src, anchor: 5, shapeIndex: 0, definitionIndex: 0, tileBase: 32 };
  const ordinary = composeOriginalRanchTilePlanes({ width:84, steps:[{...step,mode:"ordinary"}] });
  const filler = composeOriginalRanchTilePlanes({ width:84, steps:[{...step,mode:"filler"}] });
  const base = 8*84+30;
  assert.deepEqual(Array.from(ordinary.attributes.slice(base,base+4)), [0,1,2,3]);
  assert.deepEqual(Array.from(ordinary.collision.slice(base,base+4)), [6,0,6,6]);
  assert.deepEqual(Array.from(filler.attributes.slice(base,base+4)), [1,1,1,1]);
  assert.deepEqual(Array.from(filler.collision.slice(base,base+4)), [0,0,0,6]);
});

test("upper source rows crop out and a right-edge crossing stays on its destination row", () => {
  const src = source(Array.from({length:48},(_,i)=>i+1), Array(48).fill(0), Array(48).fill(0), 12);
  const result = composeOriginalRanchTilePlanes({ width:84, steps:[{
    mode:"ordinary",source:src,anchor:12,shapeIndex:3,definitionIndex:0,tileBase:0
  }] }); // origin X 78; crop source rows 0..2, then split 6+6 across boundary
  assert.deepEqual(Array.from(result.tiles.slice(78,84)), [37,38,39,40,41,42]);
  assert.deepEqual(Array.from(result.tiles.slice(0,6)), [43,44,45,46,47,48]);
  assert.ok(result.tiles.slice(84).every((value)=>value===0));
});

test("wall writes only graphics; raw flip bits and 16-bit addition survive", () => {
  const result = composeOriginalRanchTilePlanes({ width:84, steps:[{
    mode:"wall",source:{width:2,height:1,tiles:[0,0xffff]},tileBase:2
  }] });
  for (let x=0;x<84;x+=12) {
    assert.equal(result.tiles[19*84+x],0);
    assert.equal(result.tiles[19*84+x+1],1);
  }
  assert.ok(result.attributes.every((value)=>value===1));
  assert.ok(result.collision.every((value)=>value===0));
  assert.ok(result.owners.every((value)=>value===-1));
});

test("composition is ordered, input-preserving and returns fresh planes", () => {
  const src = source([3], [0], [4]);
  const first = {mode:"ordinary",source:src,anchor:5,shapeIndex:0,definitionIndex:2,tileBase:0};
  const second = {...first,source:source([0],[1],[0]),definitionIndex:3};
  const before = JSON.stringify([first,second]);
  const a = composeOriginalRanchTilePlanes({width:84,steps:[first,second]});
  assert.equal(a.tiles[8*84+30],3);
  assert.equal(a.owners[8*84+30],2);
  assert.equal(JSON.stringify([first,second]),before);
  const b = composeOriginalRanchTilePlanes({width:84,steps:[first,second]});
  a.tiles.fill(99);
  assert.equal(b.tiles[8*84+30],3);
});

test("invalid source and destination input refuses instead of silently producing a partial map", () => {
  assert.throws(()=>composeOriginalRanchTilePlanes({width:85,steps:[]}), /WIDTH/);
  assert.throws(()=>composeOriginalRanchTilePlanes({width:84,steps:null}), /STEPS/);
  const valid = {mode:"ordinary",source:source([1],[0],[0]),anchor:5,shapeIndex:0,definitionIndex:0,tileBase:0};
  for (const bad of [null, {...valid,tileBase:-1}, {...valid,source:source([1],[],[0])},
    {...valid,source:source([1.5],[0],[0])}, {...valid,anchor:20}, {...valid,shapeIndex:16},
    {...valid,mode:"wall",source:{width:13,height:1,tiles:Array(13).fill(1)}}]) {
    assert.throws(()=>composeOriginalRanchTilePlanes({width:84,steps:[valid,bad]}));
  }
});
