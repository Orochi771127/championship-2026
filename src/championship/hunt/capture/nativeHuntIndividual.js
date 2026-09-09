// ARM9 02062100 -> 02062C28. Executable rules, with explicit caller-supplied
// functional inputs. No ROM/state/research fixture imports. This constructor is
// one part of A; it does not prove actor initialization or normal Hunt binding.
import { creatureStatValue } from "../../battle/battleCreatureBuild.js";

const key = (offset) => offset.toString(16).padStart(3, "0");
const restrictedAncestors = new Set([19, 31, 63, 123, 124]);

function integer(n, label, min, max) {
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`HUNT_INDIVIDUAL_INVALID_${label}`);
  return n;
}

export function validateNativeSpeciesInput(s) {
  if (!s || typeof s !== "object") throw new Error("HUNT_INDIVIDUAL_SPECIES_INPUT_REQUIRED");
  integer(s.speciesIndex, "SPECIES", 0, 227);
  integer(s.generation, "GENERATION", 0, 6);
  integer(s.attribute, "ATTRIBUTE", 0, 4);
  for (const k of ["field1c", "field1e"]) integer(s[k], k, 0, 255);
  integer(s.field20, "FIELD20", 0, 65535);
  integer(s.field22, "FIELD22", s.field20, 65535);
  if (!Array.isArray(s.rungs) || s.rungs.length !== 11) throw new Error("HUNT_INDIVIDUAL_RUNG_INPUTS_REQUIRED");
  for (const n of s.rungs) integer(n, "RUNG", 0, 26);
  if (!Array.isArray(s.aiSelectors) || s.aiSelectors.length !== 2 || !Array.isArray(s.aiPairs) || s.aiPairs.length !== 3) {
    throw new Error("HUNT_INDIVIDUAL_AI_INPUTS_REQUIRED");
  }
  for (const n of s.aiSelectors) integer(n, "AI_SELECTOR", 0, 0xffffffff);
  for (const pair of s.aiPairs) {
    if (!Array.isArray(pair) || pair.length !== 2) throw new Error("HUNT_INDIVIDUAL_AI_PAIR_REQUIRED");
    for (const n of pair) integer(n, "AI_SOURCE", 0, 0xffffffff);
  }
  if (!Array.isArray(s.ancestors)) throw new Error("HUNT_INDIVIDUAL_ANCESTRY_INPUT_REQUIRED");
  for (const n of s.ancestors) integer(n, "ANCESTOR", 0, 227);
  if (typeof s.baseName !== "string" || !s.baseName.length) throw new Error("HUNT_INDIVIDUAL_BASE_NAME_REQUIRED");
  return s;
}

// 0202B558 returns remainder 0 for a zero divisor. It still consumes the roll.
const remainder = (value, divisor) => divisor === 0 ? 0 : value % divisor;

export function nativeIndividualName(base, variant) {
  if (typeof base !== "string" || !base.length) throw new Error("HUNT_INDIVIDUAL_BASE_NAME_REQUIRED");
  integer(variant, "NAME_VARIANT", 0, 24);
  const start = base.slice(0, 2), second = base[1];
  const suffixes = [null, null, "オ", "リン", "リータ", "ポン", "タロウ", "ジロウ", null,
    "スケ", "ルス", "ヨン", null, null, "ノスケ", "エモン", null, "ジ", null, "プー", "プス", null, null, "ドン", "ヤン"];
  let result;
  switch (variant) {
    case 0: result = start + (second === "ン" ? "ドン" : start); break;
    case 1: result = start + (second === "ン" ? "スケ" : "コ"); break;
    case 8: result = start + (second === "ッ" ? "チ" : "ッチ"); break;
    case 12: result = start + (second === "ン" ? "ライズ" : second === "ー" ? "ラ" : "ーン"); break;
    case 13: result = start + (second === "ッ" ? "クス" : "ックス"); break;
    case 16: result = base.slice(0, 3) + "ナ"; break;
    case 18: result = start + (second === "ー" ? "タ" : "ータ"); break;
    case 21: result = start + (second === "ン" ? "ザス" : second === "ー" ? "サー" : second === "ッ" ? "クル" : (second ?? "")); break;
    case 22: result = start + base[0]; break;
    default: result = start + suffixes[variant];
  }
  // The original limit is five UTF-16 code units, not five Unicode code points.
  return result.slice(0, 5);
}

function initialTrait(attribute, roll) {
  const pair = ({ 1: [6, 5], 2: [4, 6], 3: [5, 4] })[attribute];
  if (!pair) return roll % 8;
  if (roll === 0) return pair[0];
  if (roll <= 4) return pair[1];
  const value = roll % 8;
  return pair.includes(value) ? 0 : value;
}

export function createNativeHuntIndividual({ species, rng, traitOverride = -1, nameOverride = null }) {
  validateNativeSpeciesInput(species);
  if (!rng || typeof rng.next !== "function") throw new Error("HUNT_INDIVIDUAL_RNG_REQUIRED");
  integer(traitOverride, "TRAIT_OVERRIDE", -1, 8);
  if (nameOverride !== null && typeof nameOverride !== "string") throw new Error("HUNT_INDIVIDUAL_NAME_OVERRIDE_INVALID");
  // Offsets are deliberate neutral names until each writer/consumer is traced.
  const fields = {};
  const set = (off, n) => { fields[key(off)] = n >>> 0; };
  // Only the words explicitly written by 02092FC8. Do not turn padding or
  // unobserved fields into invented zero-valued gameplay state.
  const zeroWords = [0x134,0x138,0x13c,0x38,0x1c,0x20,0x24,0x28,0x40,0x48,0x4c,
    ...Array.from({ length:9 }, (_, i) => 0x170+i*4),
    ...Array.from({ length:8 }, (_, i) => 0x198+i*4),
    ...Array.from({ length:13 }, (_, i) => 0x100+i*4),0x1bc,0x1c0,0x1c4];
  for (const off of zeroWords) set(off, 0);
  for (let off = 0x140; off < 0x170; off += 4) set(off, 228);
  set(4, -1); set(0x1b8, -1);
  set(0, species.speciesIndex);
  set(8, Math.trunc(species.field1c / 5) * 4);
  set(0x0c, 0);
  set(0x178, species.field20 + remainder(rng.next(0xb3), species.field22 - species.field20));
  set(0x10, species.field1e); set(0x14, 35);
  const trait = traitOverride === -1 ? initialTrait(species.attribute, rng.next(0xb5)) : traitOverride;
  set(0x18, trait);
  const name = nameOverride === null ? nativeIndividualName(species.baseName, rng.next(0xb6) % 25) : nameOverride.split("\0", 1)[0].slice(0, 5);
  const destinations = [0x50, 0x54, 0x60, 0x64, 0x68, 0x6c, 0x70, 0x74, 0x78, 0x7c, 0x80];
  for (let i = 0; i < 11; i++) {
    const rung = species.rungs[i], column = Math.min(i, 6), unit = i === 0 ? 10 : 1;
    const lower = creatureStatValue(i >= 6 ? Math.max(0, rung - 3) : rung, column);
    const upper = creatureStatValue(Math.min(24, rung + 3), column) - unit;
    const next = creatureStatValue(Math.min(24, rung + 1), column);
    const divisor = Math.trunc(Math.trunc((next - lower) / 2) / unit);
    const value = lower + unit * remainder(rng.next(0xb7 + i), divisor);
    set(0xa8 + i * 8, upper); set(0xac + i * 8, lower);
    set(destinations[i], value);
    if (i < 2) set(destinations[i] + 8, value);
    else set(0x84 + (i - 2) * 4, rung);
  }
  const aiIndex = species.aiSelectors.indexOf(trait);
  const pair = species.aiPairs[aiIndex < 0 ? 2 : aiIndex];
  set(0x12c, pair[0]); set(0x130, pair[1]);
  return { fields, name, narrowFields: { "03c":0, "03d":0, "044":0, "046":0, "194":0 } };
}

export function updateNativeHuntIndividual(individual, { speciesByIndex, rng }) {
  const fields = individual.fields, originalSpecies = fields["000"];
  let currentSpecies = originalSpecies;
  let generation = speciesByIndex(currentSpecies).generation;
  if (generation === 6) {
    if (currentSpecies !== 217) return individual;
    currentSpecies = 173; generation = 5;
  }
  if (generation > 0) fields["18c"] = (fields["18c"] + Math.trunc(180 * rng.next(0xc5) / 102)) >>> 0;
  while (generation > 1) {
    const candidates = speciesByIndex(currentSpecies).ancestors;
    if (candidates.length === 0) return individual;
    let retries = 0;
    do {
      currentSpecies = candidates[rng.next(0xc4) % candidates.length];
      if (!restrictedAncestors.has(currentSpecies) || restrictedAncestors.has(originalSpecies)) break;
      retries++;
    } while (retries <= 10);
    fields[key(0x140 + (generation - 2) * 4)] = currentSpecies;
    generation--;
  }
  return individual;
}
