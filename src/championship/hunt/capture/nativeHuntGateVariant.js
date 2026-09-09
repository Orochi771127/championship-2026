// OVL12 0210D1A4. Gate model-node position is a required functional input;
// browser camera/world rotation and the UI's alphabetical order are unrelated.
import { nativeNormalizeQ12 } from "./nativeCapturePhases.js";

export function selectNativeHuntGateVariant({ positionQ12, hour }) {
  if (!Array.isArray(positionQ12) || positionQ12.length !== 3
    || positionQ12.some(n => !Number.isInteger(n) || n < -0x80000000 || n > 0x7fffffff)
    || !Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("NATIVE_GATE_VARIANT_INPUT_REQUIRED");
  if (positionQ12[0] === 0 && positionQ12[2] === 0) throw new Error("NATIVE_GATE_POSITION_ZERO_REQUIRES_TRACE");
  // FX_Div rounds to Q12 before the 16-bit angle conversion. Its operands
  // here are whole hours, so none of the 24 inputs lands on a rounding tie.
  const quotient = Math.floor((hour - 7) * 4096 / 15 + 0.5);
  const angle = (quotient * 16 + 0x6000) % 65536;
  // Original 00:xx/01:xx reads before the trig table. Keep it unresolved rather
  // than wrapping that invalid index. The established playable day is 07..22.
  if (angle < 0) throw new Error("NATIVE_GATE_NEGATIVE_TRIG_INDEX_REQUIRES_TRACE");
  const theta = (angle >> 4) * (Math.PI * 2 / 4096);
  const sun = nativeNormalizeQ12([Math.round(Math.sin(theta) * 4096), 0, Math.round(Math.cos(theta) * 4096)]);
  const node = nativeNormalizeQ12([positionQ12[0], 0, positionQ12[2]]);
  const product = node.reduce((sum,n,i) => sum + BigInt(n) * BigInt(sun[i]), 0n);
  const dotQ12 = Number(BigInt.asIntN(32, (product + 2048n) >> 12n));
  return { night:dotQ12 < 0 ? 1 : 0, angle, dotQ12 };
}
