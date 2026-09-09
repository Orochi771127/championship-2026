// Shared Nitro mathematics, with OVL0's Hunt-specific degree conversion.
import tables from "../../../data/championship/battleHitTables.json" with { type:"json" };
import { battleAngleIndex } from "../../battle/battleNativeMath.js";
const Q12 = 4096;
export function nativeHuntDegreeVector(degrees, radius = 1) {
  const turn = Math.trunc(Math.trunc(degrees) * 65535 / 360);
  const index = ((turn < 0 ? turn + 65535 : turn) >> 4) * 2;
  return [tables.sinCos[index + 1] * radius, tables.sinCos[index] * radius, 0];
}

// 0210D8DC..0210DE D8. The caller supplies the live light and target object.
export function resolveNativeHuntFollow(state, mode, { light, target }) {
  let { followFlag, followTarget, followTicks, headingQ12 } = state;
  let destinationQ12 = [...state.destinationQ12], directionQ12;
  if (mode !== 2 && followFlag === 1) {
    if (light?.active) destinationQ12 = [...light.positionQ12];
    else { followFlag = 0; destinationQ12 = [...state.positionQ12]; }
  }
  if (followTarget) {
    followTicks--;
    let desired = headingQ12;
    if (target?.actorActive) {
      desired = Math.trunc(battleAngleIndex(target.positionQ12[1] - state.positionQ12[1],
        target.positionQ12[0] - state.positionQ12[0]) * 360 / 65535) * Q12;
    } else followTicks = 0;
    const full = 360 * Q12;
    let heading = ((headingQ12 % full) + full) % full;
    desired = ((desired % full) + full) % full;
    if (heading < desired - 180 * Q12) heading += full;
    if (heading > desired + 180 * Q12) heading -= full;
    // Literal 0x333 at 0210E53C, with signed rounded FX multiplication.
    const increment = Number((BigInt(desired - heading) * 819n + 2048n) >> 12n);
    headingQ12 += Math.max(-10 * Q12, Math.min(10 * Q12, increment));
    if (headingQ12 < 0) headingQ12 += full;
    if (headingQ12 >= full) headingQ12 -= full;
    directionQ12 = nativeHuntDegreeVector(headingQ12 >> 12);
  } else directionQ12 = destinationQ12.map((n,i) => n - state.positionQ12[i]);
  return { followFlag, followTarget, followTicks, headingQ12, destinationQ12, directionQ12 };
}
