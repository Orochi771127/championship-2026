// Research/test fixture only: actual Gate 0 / Spring native record and RNG
// observations. Never imported by championship.html or a shipping catalog.
export function liveCaptureReplay(encounter, touch, gateId) {
  if (encounter.nativeGateIndex !== 0 || touch.gateIndex !== 0) throw new Error("WRONG_NATIVE_GATE");
  const record = encounter.wildRecords[touch.wildIndex];
  const observedRope = touch.events.find((event) => event.pc === "0x2114f54").rope;
  if (observedRope.ropeIndex !== 0 || observedRope.damageQ12 !== 3584 || record.sourceHp !== 210) throw new Error("NATIVE_FIXTURE_DRIFT");
  return { mode: "NATIVE_LIVE_STATE_REPLAY", encounter: { gateId, wildRecords: encounter.wildRecords },
    records: [{ ...record, traceId: "YDIJ_GATE0_SPRING_LIVE_WILD7_B7_81",
      rope: { generation: 1, coefficient: 80, durabilityByte: observedRope.maxDurability / 60,
        temperament71: observedRope.temperament71 } }] };
}
