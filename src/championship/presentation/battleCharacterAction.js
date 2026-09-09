import {createNativeCharacterAnimationTimeline} from './characterAnimationTimeline.js';

// OVL19 notification entry handlers -> 02114310 -> ARM9 02047984.
// These are raw sequence requests, never archive semantic aliases.
export function resolveBattleCharacterRequest({notification, counter = 0, currentHp, hitReaction, statusCode, battleEnding}) {
  if (!Number.isSafeInteger(notification) || !Number.isSafeInteger(counter)) return null;
  if (counter !== 0) return null;
  if (notification === 0) return Number.isFinite(currentHp) ? (currentHp > 0 ? 0 : 15) : null;
  if (notification===20) return battleEnding===0 ? 33 : null;
  if (notification===15) {
    if (!Number.isSafeInteger(hitReaction)) return null;
    if ([3,4,5].includes(hitReaction)) return 37;
    if (hitReaction===6) return 38;
    if ([8,9,10].includes(hitReaction)) return 6;
    if (hitReaction===7) return 26;
    if (hitReaction===11) return 36;
    if (hitReaction===12) return [8,9,10].includes(statusCode) ? 6 : statusCode===12 ? 36 : null;
    if (hitReaction===13) return 34;
    return hitReaction===1 ? 5 : 6;
  }
  return ({1:0,2:2,3:3,4:2,5:2,6:2,7:3,8:7,9:8,10:9,11:10,12:35,18:15,19:15,21:15})[notification] ?? null;
}

/** Projection at the current implementation's action-dispatch boundary.
 * The sequence selector is CPU checked. Full original launch/approach timing
 * remains partial; this never writes notifications back into the simulation.
 */
export function projectBattleCharacterRequest(combatant) {
  // An actual notification takes precedence over the temporary dispatch
  // projection. The notification's own handler decides the raw sequence.
  if (Number.isSafeInteger(combatant.field17C) && combatant.field17C>0) {
    const sequenceId=resolveBattleCharacterRequest({notification:combatant.field17C,currentHp:combatant.currentHp,
      hitReaction:combatant.field84,statusCode:combatant.statusCode,battleEnding:combatant.battleEnding});
    return Object.freeze({sequenceId,notification:combatant.field17C,
      nativeRequest:sequenceId!==null,timingEvidence:'ORIGINAL_NOTIFICATION_ENTRY_DISPATCH_TIMING_PARTIAL'});
  }
  const family = combatant.committedAction?.move?.field10;
  const notification = combatant.currentHp <= 0 ? 18
    : Number.isSafeInteger(family) && family >= 0 && family <= 3 ? family + 8
    : combatant.committedAction ? null : 1;
  return Object.freeze({sequenceId:resolveBattleCharacterRequest({notification,currentHp:combatant.currentHp}),
    notification, timingEvidence:'EXISTING_DISPATCH_ORIGINAL_LAUNCH_TIMING_PARTIAL'});
}

/** Uses battle frame numbers, never GPU elapsed time or its own ticker.
 * Equal requests do not restart (ARM9 02047984); raw mode 1 stops, mode 2 loops.
 */
export function createBattleCharacterAnimator({sprite,animations,textureResolver,geometry,reducedMotion=false}) {
  const sequences = new Map(animations.map(a=>[a.id,a]));
  const initialTexture=sprite.texture;
  const initialAnchor=sprite.anchor ? {x:sprite.anchor.x,y:sprite.anchor.y} : null;
  let timeline=null, lastFrame=null, current=null, lastRequestId=null;
  return Object.freeze({
    apply({battleFrame,sequenceId,sequenceStartFrame,sequenceInitialFrame,sequenceRequestId=null,specialPrelude=false,nativeRequest=false,nativeSample=null}) {
      if (!Number.isSafeInteger(battleFrame) || battleFrame < 0 || (lastFrame!==null && battleFrame<lastFrame)) {
        throw new TypeError('BATTLE_ANIMATION_FRAME_MUST_BE_MONOTONIC');
      }
      const sequence=sequences.get(sequenceId);
      if ((!([0,2,3,5,6,7,8,9,10,15,26,34,35,36,37,38].includes(sequenceId)) && !(specialPrelude && sequenceId===33) && !nativeRequest) || !sequence || ![1,2].includes(sequence.playbackMode)) {
        sprite.texture=initialTexture;
        if(initialAnchor)Object.assign(sprite.anchor,initialAnchor);
        timeline=null;current=null;lastFrame=battleFrame;lastRequestId=null;return null;
      }
      const changed=!timeline || timeline.getSnapshot().sequenceId!==sequenceId || sequenceRequestId!==lastRequestId;
      const previousFrame=changed && Number.isSafeInteger(sequenceStartFrame) && sequenceStartFrame>=0 && sequenceStartFrame<=battleFrame
        ? sequenceStartFrame : changed ? battleFrame : lastFrame ?? battleFrame;
      if(changed) {
        // 020479A4 -> 0202FA68 -> 0202E144 explicitly resets and seeks the
        // requested frame, even when the sequence id is unchanged. An invalid
        // index leaves the just-reset animation at its original loop start.
        const initialSnapshot=Number.isInteger(sequenceInitialFrame) && sequenceInitialFrame>=0 && sequenceInitialFrame<sequence.frames.length
          ? {frameIndex:sequenceInitialFrame,elapsedQ12:0,active:1} : null;
        timeline=createNativeCharacterAnimationTimeline(sequence,{initialSnapshot});
      }
      lastRequestId=sequenceRequestId;
      if(!nativeSample)for(let frame=previousFrame;frame<battleFrame;frame++)timeline.advanceNative(4096);
      lastFrame=battleFrame;
      // The battle actor already owns its animator. Reading that exact sample
      // keeps uninvolved actors frozen during exclusive attacks and survives a
      // late GPU mount without replaying the global frame clock independently.
      const native=nativeSample??timeline.getSnapshot();
      if(native.sequenceId!==sequenceId||!Number.isInteger(native.frameIndex)||!sequence.frames[native.frameIndex]
        ||native.cell!==sequence.frames[native.frameIndex].cell)throw Error('BATTLE_NATIVE_ANIMATION_SAMPLE_MISMATCH');
      const frame=reducedMotion ? sequence.frames[sequence.loopStartFrame??0] : sequence.frames[native.frameIndex];
      const placement=geometry.frames[frame.texture];
      const texture=textureResolver(frame.texture);
      if (!texture || !placement) throw new Error('BATTLE_ANIMATION_FRAME_BINDING_MISSING');
      sprite.texture=texture;
      current=Object.freeze({...native,texture:frame.texture,cell:frame.cell,
        frameIndex:reducedMotion ? sequence.loopStartFrame??0 : native.frameIndex,
        geometry:placement,baseBounds:geometry.frames[sequences.get(0).frames[0].texture].nativeBounds,
        reducedMotion,originalTimingParity:false});
      return current;
    },
    getSnapshot:()=>current
  });
}
