// ARM9 02067920: initial visibility; OVL8 0210CFD8: rank/result unlocks;
// OVL12 0210F7D0: fee comparison and debit. The app supplies progression and
// commits through its existing Shop wallet. This module owns no mutable state.
export const GATE_ADMISSION_EVIDENCE = "ROM_VERIFIED";

export function isGateUnlocked(gate, { tamerRank = 0, battleBadges = [] } = {}) {
  switch (gate.unlockKind) {
    case 0: return true;
    case 1: return tamerRank >= gate.unlockParameter;
    case 2: return battleBadges.includes(gate.unlockParameter);
    default: throw new Error("GATE_UNLOCK_KIND_REQUIRES_TRACE");
  }
}

// OVL8 0210D0C8 now supplies the durable waiver after all 61 title wins.
// Selection, loadout projection and actual entry read the same flag.
export function evaluateGateFee(entranceFeeBits, walletBits, waived = false) {
  if (!Number.isSafeInteger(entranceFeeBits) || entranceFeeBits < 0 || entranceFeeBits > 65535 ||
      !Number.isSafeInteger(walletBits) || walletBits < 0 || walletBits > 9999999 || typeof waived !== "boolean") {
    throw new TypeError("INVALID_GATE_FEE_INPUT");
  }
  const chargeBits = waived ? 0 : entranceFeeBits;
  const canEnter = walletBits >= chargeBits;
  return Object.freeze({ canEnter, reason: canEnter ? null : "INSUFFICIENT_FUNDS", entranceFeeBits,
    chargeBits, walletBits, afterBits: canEnter ? walletBits - chargeBits : walletBits });
}

export function gateAdmission(gate, walletBits, progression) {
  if (!gate) return Object.freeze({ canEnter: false, canConfigure: false, reason: "NO_GATE_SELECTED" });
  const fee = evaluateGateFee(gate.entranceFeeBits, walletBits, progression?.feeWaiver??false);
  const unlocked = isGateUnlocked(gate, progression);
  return Object.freeze({ ...fee, gateId: gate.gateId, canConfigure: unlocked,
    canEnter: unlocked && fee.canEnter, reason: unlocked ? fee.reason : "GATE_LOCKED",
    unlockKind: gate.unlockKind, unlockParameter: gate.unlockParameter, evidence: GATE_ADMISSION_EVIDENCE });
}
