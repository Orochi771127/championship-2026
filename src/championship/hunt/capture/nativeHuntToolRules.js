// Native Hunt tool consumers. Plain functional values, no research bytecode,
// source art, secondary state owner or clock. Call once per native update.
import source from "../../../data/championship/catalogs/hunt-tools.r1.json" with { type: "json" };
import { deepFreeze } from "../../contracts/championshipContracts.js";
import { stepNativeRope } from "./wildCaptureFlow.js";
import { nativeNormalizeQ12 } from "./nativeCapturePhases.js";

deepFreeze(source);
const Q12 = 4096;
function item(rows, index) {
  if (!Number.isInteger(index) || rows[index]?.itemIndex !== index) throw Error("NATIVE_HUNT_TOOL_INDEX_REQUIRED");
  return rows[index];
}
export function nativeHuntToolSpecies(speciesIndex) {
  const row = source.species[speciesIndex];
  if (!Number.isInteger(speciesIndex) || row?.speciesIndex !== speciesIndex) throw Error("NATIVE_HUNT_TOOL_SPECIES_REQUIRED");
  return row;
}
// 0210F0A4: distraction/blindness overrides the species response category.
export function nativeToolEffectiveness(speciesIndex, selector, { distracted = 0, blinded = 0 } = {}) {
  const species = nativeHuntToolSpecies(speciesIndex);
  if (distracted || blinded) return 1;
  return species.effectiveness[selector] ?? 0;
}
const responseColumn = value => Math.max(value - 1, 0);

// 02115838..02115980; unsupported generations leave the rate at zero. A zero
// divisor produces zero after Nitro's rounded 64-bit divider result (-1).
export function nativeRopeParameters(ropeIndex, speciesIndex, maxHp) {
  const row = item(source.ropes, ropeIndex), species = nativeHuntToolSpecies(speciesIndex);
  if (!Number.isInteger(maxHp) || maxHp < 1 || maxHp > 32767) throw Error("NATIVE_ROPE_SOURCE_HP_REQUIRED");
  const coefficient = row.coefficients[species.generation - 1]?.[responseColumn(species.effectiveness[0])] ?? 0;
  const divisor = coefficient * (species.generation === 1 ? 3 : 6);
  return Object.freeze({ damageQ12:divisor === 0 ? 0 : Math.floor(maxHp * Q12 / divisor + 0.5),
    accumulatorQ12:0, durability:row.durabilityByte * 60, maxDurability:row.durabilityByte * 60,
    baseDurability:row.durabilityByte * 60, temperament71:species.ropeTemperament, band:"SLACK", controllerState:3 });
}

// Controller 3/4/5 surrounds the existing verified 02114F54 numerical writer.
// A transition changes the next update's cap; it does not retroactively clamp
// the current durability. 02115C8C / 02115EE8 / 02116050 preserve that lag.
export function stepNativeRopeController(rope, currentHp, input) {
  const previousState = rope.controllerState;
  if (![3, 4, 5].includes(previousState)) throw Error("NATIVE_ROPE_CONTROLLER_STATE_REQUIRED");
  const result = stepNativeRope(rope, currentHp, input);
  const nextState = ({ SLACK:3, PULL:4, STRONG:5, BROKEN:6 })[result.rope.band];
  const events = previousState === 3 ? [0x25] : previousState === 4 ? [0x13] : [];
  if (result.event !== null) events.push(result.event);
  let maxDurability = result.rope.maxDurability;
  if (nextState !== previousState) maxDurability = nextState === 3 ? rope.baseDurability
    : nextState === 4 ? 7 * Math.trunc(rope.baseDurability / 10)
      : nextState === 5 ? 2 * Math.trunc(rope.baseDurability / 5) : maxDurability;
  return Object.freeze({ ...result, events:Object.freeze(events),
    rope:Object.freeze({ ...result.rope, maxDurability, controllerState:nextState }) });
}

// Strong pull writes the movement destination 56 native pixels back along the
// tether before event 11 is delivered (0211515C..02115208).
export function nativeStrongPullDestination(positionQ12, pointerQ12) {
  const delta = pointerQ12.map((n, i) => n - positionQ12[i]);
  const normal = nativeNormalizeQ12(delta);
  return Object.freeze(pointerQ12.map((n, i) => n - normal[i] * 56));
}

export function nativeShotParameters(index) {
  const row = item(source.shots, index);
  return Object.freeze({ ...row, cooldownTicks:[30, 5, 60][row.fireMode],
    spread:row.fireMode === 2, consumedUnits:1 });
}

// Ordinary Shot's event response. The Owner also approved using this value for
// scatter's uninitialized payload byte; that use is an adaptation, not ROM parity.
export function nativeShotSpeciesResponse(speciesIndex) {
  return Math.max(1, nativeHuntToolSpecies(speciesIndex).effectiveness[1]);
}

// 0210E748; incoming event 2E carries strength, status and species response.
// Shot impact accumulates a shake timer. Its display "power" is not HP damage.
export function nativeShotReaction(state, { strength, statusSelector, response }, { nextChannel, wildRandom }) {
  if (![1, 2].includes(strength) || ![0, 1, 2].includes(statusSelector)
    || !Number.isInteger(response) || response<0 || response>255) throw Error("NATIVE_SHOT_EVENT_REQUIRED");
  const next = { ...state, shotShakeTicks:Math.min(900, state.shotShakeTicks + response * (strength === 2 ? 120 : 60)) };
  if (statusSelector === 0) {
    next.returnAiState = 3;
    next.destinationQ12 = [state.positionQ12[0] + (wildRandom(0x7fff) % 256 - 128) * Q12,
      state.positionQ12[1] + (wildRandom(0x7fff) % 256 - 128) * Q12, 0];
  } else if (statusSelector === 1) {
    const effect = nativeToolEffectiveness(state.speciesIndex, 8, state);
    if (effect <= 1 || (effect === 2 && nextChannel(0xb2) % 2 === 0)) {
      next.awakeCounter = Math.trunc(state.maxAwakeCounter / 10) * 8;
    }
    next.returnAiState = 1;
  } else {
    const effect = nativeToolEffectiveness(state.speciesIndex, 10, state);
    next.returnAiState = effect <= 1 || (effect === 2 && nextChannel(0xb3) % 2 === 0) ? 17 : 1;
  }
  return Object.freeze(next);
}

// Percent effects divide the source max HP first; moving /100 after the multiply
// changes the game's integer result (210 HP and 40 gives 80, not 84).
export function nativeToolDamage(subcategory, index, speciesIndex, sourceMaxHp, status = {}) {
  const table = ({ BOMB:source.bombs, MINE:source.mines, WIRE:source.wires })[subcategory];
  if (!table) throw Error("NATIVE_DAMAGE_TOOL_KIND_REQUIRED");
  const selector = ({ BOMB:2, MINE:7, WIRE:10 })[subcategory];
  const percent = item(table, index).damagePercent[responseColumn(nativeToolEffectiveness(speciesIndex, selector, status))];
  if (!Number.isInteger(sourceMaxHp) || sourceMaxHp < 1 || sourceMaxHp > 32767) throw Error("NATIVE_DAMAGE_HP_REQUIRED");
  return Math.trunc(sourceMaxHp / 100) * percent;
}

export function nativeWireParameters(index, speciesIndex, status = {}) {
  const row = item(source.wires, index);
  return Object.freeze({ maxLength:row.maxLength, kind:index < 2 ? "BLOCK" : index < 4 ? "BIND" : "DAMAGE",
    bindingTicks:row.bindingSeconds[responseColumn(nativeToolEffectiveness(speciesIndex, 12, status))] * 60 });
}

export function nativeMeatParameters(index) { return item(source.meats,index); }
export function nativeBombParameters(index) { return item(source.bombs,index); }
export function nativeAttractionPercent(kind,index,state) {
  const selector=({MEAT:4,DECOY:6,LIGHT:5})[kind];
  return item(({MEAT:source.meats,DECOY:source.decoys,LIGHT:source.lights})[kind],index)
    .attractionPercent[responseColumn(nativeToolEffectiveness(state.speciesIndex,selector,state))];
}

export function nativeToolAnimation(kind,index,sequence=0) {
  const animation=source.controllerAnimations[kind]?.[index]?.[sequence];
  if(!animation)throw Error(`NATIVE_TOOL_ANIMATION_REQUIRED:${kind}:${index}:${sequence}`);
  return animation;
}

// AI5 02110620: the bite is tied to the original character's frame index 1.
// A final bite consumes the remaining food without the non-final awake tick.
export function stepNativeFoodBite(state,food,frameIndex,nextChannel,foodThreshold) {
  const a={...state}, f={...food};
  if(frameIndex===0)a.biteLatch=0;
  if(frameIndex!==1 || a.biteLatch)return {state:a,food:f,nextAi:-1};
  a.biteLatch=1;
  if(!f.active)return {state:a,food:f,nextAi:1};
  const row=nativeMeatParameters(f.itemIndex);
  if(row.statusSelector===1 && !a.poisonPending) {
    const chance=row.poisonPercent[responseColumn(nativeToolEffectiveness(a.speciesIndex,9,a))];
    if(nextChannel(0xb3)%100<chance)a.poisonPending=240;
  } else if(row.statusSelector===2 && !a.stunPending && nativeToolEffectiveness(a.speciesIndex,10,a)!==3) a.stunPending=120;
  const amount=[0,1,1,1,2,3,4][nativeHuntToolSpecies(a.speciesIndex).generation];
  if(f.nutrition>amount) {f.nutrition-=amount;a.satiety+=amount;a.awakeCounter++;}
  else {a.satiety+=f.nutrition;f.nutrition=0;f.active=false;return {state:a,food:f,nextAi:1};}
  return {state:a,food:f,nextAi:a.satiety>=foodThreshold?1:-1};
}
