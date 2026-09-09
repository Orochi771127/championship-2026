// OVL18 0211837C / 02116348 / 0211490C. Rules over an existing individual.
// Callers supply actual food, native animation frame and original RNG channel.
// This module owns no inventory, clock, actor loop or persistent storage.
import { normalizeNativeIndividualProfile } from "./nativeIndividualProfile.js";

export const NATIVE_FOOD_BITE_BY_GENERATION = Object.freeze([0, 1, 1, 1, 2, 3, 4]);
const treatmentChance = Object.freeze([
  Object.freeze([0, 100, 100, 90, 80, 60, 50]),
  Object.freeze([0, 50, 50, 60, 80, 90, 100])
]);
const int = (n, lo, hi, label) => {
  if (!Number.isInteger(n) || n < lo || n > hi) throw new TypeError(`INVALID_RAISING_${label}`);
  return n;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n | 0));
const copy = profile => structuredClone(normalizeNativeIndividualProfile(profile));

export function applyNativeRaisingCondition(profile, { kind, delta, satietyMaximum }) {
  const p = copy(profile), f = p.fields;
  int(kind, 0, 0xffffffff, "CONDITION_KIND");
  int(delta, -0x80000000, 0x7fffffff, "CONDITION_DELTA");
  int(satietyMaximum, 0, 255, "SATIETY_MAXIMUM");
  const key = ["008", "050", "01c", "020", "024"][kind];
  if (key) {
    const sum = (f[key] + delta) | 0;
    // Kind 4 only has an upper clamp. Preserve native signed underflow as u32.
    f[key] = (kind === 4 ? Math.min(999, sum) : clamp(sum, kind === 1 ? 1 : 0,
      kind === 0 ? satietyMaximum : kind === 1 ? f["058"] : 100)) >>> 0;
  }
  return normalizeNativeIndividualProfile(p);
}

export function applyNativeFoodFrame(profile, { generation, satietyMaximum, food, animationFrame, biteLatched = false }) {
  const p = copy(profile), f = p.fields, n = p.narrowFields;
  int(generation, 0, 6, "GENERATION"); int(satietyMaximum, 0, 255, "SATIETY_MAXIMUM");
  int(animationFrame, 0, 0xffff, "ANIMATION_FRAME");
  if (typeof biteLatched !== "boolean" || !food || typeof food.present !== "boolean" || typeof food.protein !== "boolean") throw new TypeError("INVALID_RAISING_FOOD");
  int(food.remaining, 0, 0x7fffffff, "FOOD_REMAINING");
  int(food.freshness, -0x80000000, 0x7fffffff, "FOOD_FRESHNESS");
  const nextFood = { ...food }, result = { profile, food:nextFood, biteLatched, consumed:0, leave:false, reaction:null, sound:null };
  if (animationFrame === 0) return { ...result, biteLatched:false };
  if (animationFrame !== 1 || biteLatched) return result;
  result.biteLatched = true;
  if (!food.present) return { ...result, leave:true };
  const amount = Math.min(food.remaining, NATIVE_FOOD_BITE_BY_GENERATION[generation]);
  nextFood.remaining -= amount;
  if (food.freshness <= 0 || nextFood.remaining === 0) { nextFood.remaining = 0; nextFood.present = false; }
  result.consumed = amount;
  f["174"] = 0; f["170"] = 0; f["00c"] = (f["00c"] + 1) >>> 0;
  if (food.protein) {
    n["046"] = (n["046"] + amount) & 0xffff;
    if (n["046"] >= 16) {
      if ((f["040"] | 0) < 100) f["040"] = (f["040"] + 1) >>> 0;
      n["046"] -= 16;
      if (n["044"] < 5) n["044"]++;
    }
    result.sound = 0x605;
  } else result.sound = generation <= 3 ? 0x606 : 0x604;
  if (food.freshness <= 0) f["01c"] = Math.min(100, (f["01c"] + 50) | 0) >>> 0;
  n["194"] = (n["194"] + amount) & 0xffff;
  // One carry, including the generation-six four-unit bite. Not a while loop.
  if (n["194"] >= 4) {
    f["008"] = Math.min(satietyMaximum, (f["008"] + 1) | 0) >>> 0;
    f["050"] = Math.min(f["058"], f["050"] + Math.trunc(f["058"] / 100));
    n["194"] -= 4;
  }
  result.leave = (f["008"] | 0) >= satietyMaximum || !nextFood.present;
  if ((f["008"] | 0) >= satietyMaximum) {
    f["01c"] = Math.max(0, (f["01c"] - 10) | 0); result.reaction = 0x1b;
  }
  result.profile = normalizeNativeIndividualProfile(p);
  return result;
}

// kind 0 addresses individual +134 (wound), kind 1 addresses +138 (illness).
// Original mode 6 supplies the all-100 tutorial tables, independently of text.
export function applyNativeMedicine(profile, { kind, generation, poolSlot, mode, rng }) {
  const p = copy(profile), f = p.fields;
  int(kind, 0, 1, "MEDICINE_KIND"); int(generation, 0, 6, "GENERATION");
  int(poolSlot, 0, 15, "POOL_SLOT"); int(mode, 0, 0xffffffff, "MODE");
  if (!rng || typeof rng.next !== "function") throw new TypeError("RAISING_MEDICINE_RNG_REQUIRED");
  const condition = kind === 0 ? "134" : "138";
  if (f[condition] === 0) return { profile, success:false, reaction:22, hasCondition:false, channel:null };
  const channel = 0x66 + poolSlot;
  const roll = int(rng.next(channel), 0, 0x7fffffff, "RNG_VALUE") % 100;
  const success = roll < (mode === 6 ? 100 : treatmentChance[kind][generation]);
  if (success) {
    f[condition] = 0; f["020"] = clamp(f["020"] + 2, 0, 100); f["180"] = 0;
    f[kind === 0 ? "040" : "01c"] = 0;
  }
  return { profile:normalizeNativeIndividualProfile(p), success, reaction:success ? 9 : 0x12, hasCondition:true, channel };
}
