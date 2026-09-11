import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { steerNativeHuntDirection, steerNativeHuntDirectionCell, stepNativeHuntMovement, UNASSIGNED_TARGET_Q12 } from "../src/championship/hunt/capture/nativeHuntMovement.js";
import { nativeNormalizeQ12 } from "../src/championship/hunt/capture/nativeCapturePhases.js";
import {createNativeHuntFieldControls} from '../src/championship/hunt/capture/nativeHuntFieldControls.js';

// OVL0 0210D9AC dispatches only low nibbles 0..11; 12..15 fall through to
// 0210DAD4 and consume caller stack the original never wrote. See
// docs/research/HUNT_DIRECTION_UNASSIGNED_2026-09-10.json.
const receipt = JSON.parse(fs.readFileSync("docs/research/HUNT_DIRECTION_UNASSIGNED_2026-09-10.json", "utf8"));
const NATIVE_UNASSIGNED_DIRECTION_SCRATCH = receipt.liveProducer.stackAtEntry;
const scene = JSON.parse(fs.readFileSync("src/data/championship/catalogs/hunt-scene.r1.json", "utf8"));
const degrees = ([x, y]) => (Math.atan2(y, x) * 180) / Math.PI;
// Only these three attribute bytes reach the branch in the shipped fields.
const SHIPPED = [0x0e, 0x0f, 0x8f];
const INCOMING = [[0, 1, 0], [0, -4096, 0], [4096, 0, 0], [-4096, 0, 0], [2633, 3138, 0], [-2633, -3138, 0]];

function environment(cell) {
  return { width: 128, height: 128, camera: [0, 0],
    readDirectionCell: () => cell,
    readTerrain: () => 0,
    queryControllers: () => ({ obstacle: 0, secondaryBlocked: false, sideEffectsClosed: true }) };
}
const actor = () => ({ positionQ12: [40 * 8 * 4096, 12 * 8 * 4096, 0], destinationQ12: [0, 0, 0],
  directionQ12: [0, 1, 0], speedQ12: 4096, pull13: 0, followFlag: 0, followTarget: 0,
  distanceAccumulatorQ12: 0, facing: 1, terrainPose: 7 });

test("the port consumes the same scratch words the live original left, and normalizes to the traced result", () => {
  assert.deepEqual([...NATIVE_UNASSIGNED_DIRECTION_SCRATCH], receipt.liveProducer.stackAtEntry);
  assert.deepEqual([...nativeNormalizeQ12([...NATIVE_UNASSIGNED_DIRECTION_SCRATCH])], receipt.liveProducer.normalized);
  assert.equal(Number(degrees(receipt.liveProducer.normalized).toFixed(3)), receipt.liveProducer.deg);
  // 0210DADC re-zeroes the Z slot before either blend branch reads it.
  assert.equal(NATIVE_UNASSIGNED_DIRECTION_SCRATCH[2], 0);
});

test("captured scratch replay for each shipped attribute remains inside the measured cone", () => {
  const { degMin, degMax } = receipt.bound;
  let checked = 0;
  for (const attribute of SHIPPED) {
    for (const before of INCOMING) {
      const steered = steerNativeHuntDirection(before, attribute, NATIVE_UNASSIGNED_DIRECTION_SCRATCH);
      const angle = degrees([...nativeNormalizeQ12([...steered])]);
      assert.ok(angle >= degMin && angle <= degMax, `attribute ${attribute} before ${before} gave ${angle}`);
      checked++;
    }
  }
  assert.equal(checked, SHIPPED.length * INCOMING.length);
});

test("the direction-cell reader reaches the same branch as the raw attribute", () => {
  for (const before of INCOMING) {
    const cell = steerNativeHuntDirectionCell(before, { unknownDirection: 15, scratchQ12:NATIVE_UNASSIGNED_DIRECTION_SCRATCH, blendQ12: 0xcd });
    assert.deepEqual([...cell], [...steerNativeHuntDirection(before, 0x0f, NATIVE_UNASSIGNED_DIRECTION_SCRATCH)]);
  }
});

test("captured mode 3 replay matches the bounded source vector without granting normal-play parity", () => {
  const cell = { unknownDirection: 15, scratchQ12:NATIVE_UNASSIGNED_DIRECTION_SCRATCH, blendQ12: 0xcd, escapeAnchor: false, escapeBoundary: true };
  const before = actor();
  const result = stepNativeHuntMovement(before, 3, environment(cell));
  const angle = degrees(result.state.directionQ12);
  assert.ok(angle >= receipt.bound.degMin && angle <= receipt.bound.degMax, `direction ${angle}`);
  // Down-right: the traced cone never crosses an axis, so both steps are positive.
  assert.ok(result.deltaQ12[0] > 0 && result.deltaQ12[1] > 0);
  assert.equal(result.state.facing, 1);
  assert.deepEqual(result.state.positionQ12.slice(2), [0]);
  // Nibble 14 is blocked terrain in every shipped field; it must still resolve.
  assert.doesNotThrow(() => stepNativeHuntMovement(actor(), 3,
    { ...environment({ unknownDirection: 14, scratchQ12:NATIVE_UNASSIGNED_DIRECTION_SCRATCH, blendQ12: 0xcd }), readTerrain: () => 1 }));
});

test("the assigned dispatch range is untouched by the unassigned branch", () => {
  const table = [[0, -4096], [2633, -3138], [3138, -2633], [4096, 0], [3138, 2633], [2633, 3138],
    [0, 4096], [-2633, 3138], [-3138, 2633], [-4096, 0], [-3138, -2633], [-2633, -3138]];
  assert.equal(receipt.staticDecode.assignedCases.length, table.length);
  for (const [low, target] of table.entries()) {
    assert.ok(receipt.staticDecode.assignedCases[low].writesX && receipt.staticDecode.assignedCases[low].writesY);
    // 0x20 selects the full-replace branch at 0210DAE8, so the table value survives verbatim.
    assert.deepEqual([...steerNativeHuntDirection([0, 1, 0], 0x20 | low)], [...target, 0]);
  }
  assert.throws(() => steerNativeHuntDirection([0, 1, 0], 256), /NATIVE_DIRECTION_BYTE_REQUIRED/);
});

test("every shipped field carries the blend rate the unassigned branch consumes", () => {
  let cells = 0;
  for (const [fieldId, data] of Object.entries(scene.environments)) {
    for (const cell of data.directionPalette) {
      if (cell.unknownDirection === undefined) continue;
      assert.ok([12, 13, 14, 15].includes(cell.unknownDirection), fieldId);
      assert.equal(cell.blendQ12, 0xcd, `${fieldId} nibble ${cell.unknownDirection}`);
      assert.equal(cell.escapeBoundary, cell.unknownDirection === 15);
      cells++;
    }
  }
  assert.ok(cells >= Object.keys(scene.environments).length, `only ${cells} unassigned palette cells`);
});

test('an unobserved encounter steers at the swept bound instead of stopping',()=>{
  const sweep=JSON.parse(fs.readFileSync('docs/research/HUNT_DIRECTION_ACTOR_SWEEP_2026-09-11.json','utf8'));
  // The substitute is the output the original was observed producing, and the
  // sweep says no address main RAM can hold moves the real one further than a
  // few degrees -- far inside one entry of the original's own direction table.
  assert.deepEqual([...UNASSIGNED_TARGET_Q12],[...sweep.liveProducer.observedNormalized]);
  assert.ok(sweep.sweep.spreadDeg<sweep.tableStepDeg,'cone must be finer than the original table step');
  const deg=degrees(UNASSIGNED_TARGET_Q12);
  assert.ok(deg>=sweep.sweep.degMin&&deg<=sweep.sweep.degMax,'substitute must sit inside the swept cone');

  // Every shipped attribute now returns a direction rather than throwing, and a
  // caller that captured the encounter's own words still gets those exactly.
  for(const attribute of SHIPPED){
    const bounded=steerNativeHuntDirection([0,1,0],attribute);
    assert.equal(bounded.length,3);
    assert.ok(bounded.some(n=>n!==0),`attribute ${attribute} produced no steering`);
    const replayed=steerNativeHuntDirection([0,1,0],attribute,NATIVE_UNASSIGNED_DIRECTION_SCRATCH);
    assert.notDeepEqual([...replayed],[...bounded],'captured replay must not collapse onto the bound');
  }
});

test('an untraced encounter keeps running, keeps its tools and still commits its cards',()=>{
  const pool=JSON.parse(fs.readFileSync('docs/research/HUNT_INDIVIDUAL_POOL_CPU_CHECK_2026-09-06.json','utf8'));
  const individual=structuredClone(pool.poolVectors[0].records[0]);
  const record={speciesIndex:individual.fields['000'],individual,positionQ12:[80*4096,80*4096,0],facing:1,
    ai:{state:8,speedQ12:4096,field054:8,field1e0:0,field1d8:600}};
  const controls=createNativeHuntFieldControls({records:[record,structuredClone(record)],wildIds:['moving','collected'],
    environment:environment({unknownDirection:15,blendQ12:205,escapeBoundary:false}),
    rng:{next:()=>0},loadout:{getSelectedEquipment:()=>[]},consumeItem:()=>assert.fail('unexpected inventory write'),
    maxCardG:32,onChange:()=>{}});
  controls.actors[1].cardState='ON_CARD';
  const entries=controls.getOnCardEntries();
  const before=[...controls.actors[0].directionQ12];
  assert.doesNotThrow(()=>controls.tick(17));
  assert.notDeepEqual([...controls.actors[0].directionQ12],before,'the wild must have steered');
  assert.equal(controls.getState().notice,null);
  assert.equal(controls.selectTool('HAND'),true);
  assert.doesNotThrow(()=>controls.tick(1000));
  assert.deepEqual(controls.getOnCardEntries(),entries);
  controls.commit();assert.equal(controls.actors[1].cardState,'HOME_COMMITTED');
});
