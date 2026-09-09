import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { selectNativeHuntGateVariant } from "../src/championship/hunt/capture/nativeHuntGateVariant.js";
const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_GATE_SOURCE_CPU_CHECK_2026-09-06.json", "utf8"));

test("Gate variant follows original node resolver and CPU rotation across all 17 nodes and supported hours", () => {
  assert.equal(cpu.positions.length, 17);
  let compared = 0;
  for (const v of cpu.vectors.filter(v => v.hour >= 2)) {
    const result = selectNativeHuntGateVariant({ positionQ12:cpu.positions[v.gateRecordIndex].positionQ12, hour:v.hour });
    assert.deepEqual(result, { night:v.night, angle:v.angle, dotQ12:v.dotQ12 }, `Gate ${v.gateRecordIndex} hour ${v.hour}`);
    compared++;
  }
  assert.equal(compared, 374);
});

test("unresolved negative native trig indices and missing node inputs cannot silently select a field", () => {
  for (const hour of [0,1]) assert.throws(() => selectNativeHuntGateVariant({ positionQ12:cpu.positions[0].positionQ12, hour }), /NEGATIVE_TRIG_INDEX_REQUIRES_TRACE/);
  assert.throws(() => selectNativeHuntGateVariant({ positionQ12:[0,0,0], hour:13 }), /POSITION_ZERO_REQUIRES_TRACE/);
  assert.throws(() => selectNativeHuntGateVariant({ positionQ12:null, hour:13 }), /INPUT_REQUIRED/);
});
