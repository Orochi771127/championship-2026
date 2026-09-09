// ARM9 02002C00..0200323C, 020669D8, 02066A40. Integer arithmetic throughout:
// Math.atan2/sin/cos do not preserve the original lookup and rounding boundaries.
import { BATTLE_NATIVE_MATH_TABLES as tables } from '../../data/championship/battleNativeMathTables.js';
import { divFx } from './battleScriptVm.js';

const ONE = 1n << 32n;
const MASK = ONE - 1n;
const high = (a, b) => (a * b) >> 32n;
const mulFx = (a, b) => Number(BigInt.asIntN(32, (BigInt(a) * BigInt(b) + 2048n) >> 12n));

function polynomial(fraction, cosine) {
  if (fraction === ONE) return 0xb504f334n;
  const square = high(fraction, fraction) & MASK;
  const c = (cosine ? tables.cosCoefficients : tables.sinCoefficients).map(BigInt);
  let value = ONE - high(square, c[0]);
  value = ONE - high(value, high(square, c[1]));
  value = ONE - high(value, high(square, c[2]));
  value = (cosine ? ONE : c[4]) - high(value, high(square, c[3]));
  return cosine ? value : high(value, fraction) & MASK;
}

function trigQ32(angle, cosine) {
  if (!Number.isSafeInteger(angle) || angle < -2147483647 || angle > 2147483647) {
    throw new Error('BATTLE_NATIVE_MATH_ANGLE_OUT_OF_RANGE');
  }
  const scaled = (BigInt(Math.abs(angle)) * 0x145f306ddn) >> 12n;
  const segment = Number(scaled >> 32n);
  let fraction = scaled & MASK;
  if (segment & 1) fraction = ONE - fraction;
  const alternate = ((segment + 1) & 2) !== 0;
  let value = polynomial(fraction, cosine ? !alternate : alternate);
  if (((segment + (cosine ? 2 : 0)) & 7) > 3) value = -value;
  return angle < 0 && !cosine ? -value : value;
}

/** 02066A40: angle in radians Q12, length Q12, resulting XYZ Q12. */
export function battleVectorQ12(angle, length) {
  if (!Number.isSafeInteger(length) || length !== (length | 0)) {
    throw new Error('BATTLE_NATIVE_MATH_LENGTH_OUT_OF_RANGE');
  }
  return [mulFx(Number(trigQ32(angle, true) >> 20n), length),
    mulFx(Number(trigQ32(angle, false) >> 20n), length), 0];
}

function atan(y, x, indexed) {
  if (![y, x].every(n => Number.isSafeInteger(n) && n === (n | 0) && n !== -2147483648)) {
    throw new Error('BATTLE_NATIVE_MATH_COORDINATE_OUT_OF_RANGE');
  }
  const quarter = indexed ? 0x4000 : 0x1922;
  const eighth = indexed ? 0x2000 : 0xc91;
  const half = indexed ? 0x8000 : 0x3244;
  const threeEighths = indexed ? 0x6000 : 0x25b3;
  const ay = Math.abs(y), ax = Math.abs(x);
  let result;
  if (!y) result = x < 0 ? half : 0;
  else if (!x) result = y < 0 ? -quarter : quarter;
  else if (ax === ay) result = y > 0 ? (x > 0 ? eighth : threeEighths) : (x > 0 ? -eighth : -threeEighths);
  else {
    const table = indexed ? tables.atanIndex : tables.atanQ12;
    const value = table[divFx(Math.min(ax, ay), Math.max(ax, ay)) >> 5];
    if (y > 0 && x > 0) result = ax > ay ? value : quarter - value;
    else if (y > 0) result = ax > ay ? half - value : quarter + value;
    else if (x < 0) result = ax > ay ? -half + value : -quarter - value;
    else result = ax > ay ? -value : -quarter + value;
  }
  return indexed ? result & 0xffff : (result << 16) >> 16;
}

/** 02002EE0: signed Q12 radians. */
export const battleAngleQ12 = (y, x) => atan(y, x, false);
/** 02003098: unsigned 16-bit turn index, used by native 0211E338. */
export const battleAngleIndex = (y, x) => atan(y, x, true);

/** Native-host adapter. Undefined means this is not one of these math helpers. */
export function callBattleNativeMath(address, args, host) {
  if (address === 0x02003098) return battleAngleIndex(...args);
  if (address === 0x02066a40) return battleVectorQ12(...args);
  if (address === 0x020669d8) {
    if (!args[0] || !args[1]) throw new Error('BATTLE_NATIVE_NEEDS_OBJECT_GRAPH: direction positions');
    return battleAngleQ12((host.readU32(args[1], 4) - host.readU32(args[0], 4)) | 0,
      (host.readU32(args[1], 0) - host.readU32(args[0], 0)) | 0);
  }
  return undefined;
}
