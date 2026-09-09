import {divFx} from './battleScriptVm.js';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../../data/championship/battleCharacterProfiles.js';

export const BATTLE_SPECIAL_PRELUDE = 0x02120900;

// Numeric Main sequence metadata already audited by battleCharacterGeometry.
// Raw 33 is requested by 02120900, not inferred from archive semantic aliases.
export function battleSpecialPreludeInputs(speciesId, move) {
  const profile = BATTLE_CHARACTER_PROFILES[BATTLE_SPECIES_ENTITIES[speciesId]];
  const pointer = typeof move?.pointer1C === 'string' ? Number(move.pointer1C) : move?.pointer1C;
  const restoredSequence = (move?.field10 ?? -8) + 7;
  const pose=profile?.sequences.find(s=>s.id===33);
  const restored=profile?.sequences.find(s=>s.id===restoredSequence);
  const returnTicks=restored?.frames[restored.loopStartFrame]?.ticks;
  if (pointer !== BATTLE_SPECIAL_PRELUDE || pose?.playbackMode!==1 || !returnTicks || !(move.field22 > 0)) return null;
  const poseTicks=pose.frames.slice(pose.loopStartFrame).reduce((sum,frame)=>sum+frame.ticks,0);
  return Object.freeze({zoomInTicks:move.field22,poseTicks,returnTicks,restoredSequence});
}

// ARM9 02002758 -> NDS sqrt -> 02002818. The inputs here are bounded Q12
// fractions, for which double precision represents the integer radicand exactly.
function sqrtQ12(value) { return Math.floor((Math.floor(Math.sqrt(value * 2 ** 32)) + 512) / 1024); }

/** Original prelude's yielded-frame projection. No clock, RNG or actor writes.
 * CPU oracle: BATTLE_FOCUS_CPU_2026-09-07.json, controlled actor adapters.
 * Launch/approach and actual target geometry are separate unresolved inputs.
 */
export function sampleBattleSpecialPrelude(input, frame) {
  const {zoomInTicks,poseTicks,returnTicks,restoredSequence=8} = input;
  if (![zoomInTicks,poseTicks,returnTicks].every(n=>Number.isSafeInteger(n)&&n>0&&n<=65535)
      || !Number.isSafeInteger(frame) || frame<0) throw new TypeError('BATTLE_PRELUDE_INVALID_INPUT');
  const returnStart = Math.max(zoomInTicks,poseTicks) + 1;
  const endFrame = returnStart + returnTicks;
  const returning = frame >= returnStart;
  const active = frame < endFrame;
  let zoomQ12 = 4096;
  if (frame>0 && active) zoomQ12 = returning
    ? 8192 - sqrtQ12(divFx((frame-returnStart+1)*4096,returnTicks*4096))
    : 4096 + sqrtQ12(divFx(Math.min(frame,zoomInTicks)*4096,zoomInTicks*4096));
  const visible = active && zoomQ12>4096 && zoomQ12<=8192;
  return Object.freeze({frame,endFrame,active,zoomQ12,
    phase:!active?'complete':frame===0?'entry':returning?'return':frame<=zoomInTicks?'zoom':'hold',
    sequence:frame>0&&!returning?33:restoredSequence,
    sequenceStart:frame===0?0:returning?returnStart:1,
    tintIndex:frame>0&&!returning?(frame-1)%11:null,
    cameraEnabled:active,
    overlayVisible:visible, hyperVisible:visible&&!returning,
    overlayAlpha:visible?(1+((30*(zoomQ12-4096))>>12))/31:0,
    brightnessQ12:visible?4096-Math.trunc(2*(zoomQ12-4096)/3):4096
  });
}

/** Exact camera native operands for supplied Q12 direction and bounds.
 * Production mobile framing is explicitly separate until world positions port.
 */
export function battleSpecialCamera({ownerX,ownerY,midX,midY,cosQ12,sinQ12}, sample) {
  const distance = sample.frame===0?80:64;
  return [ownerX-128*4096+divFx(distance*cosQ12+midX,sample.zoomQ12),
    ownerY-96*4096+divFx(distance*sinQ12+midY,sample.zoomQ12)];
}
