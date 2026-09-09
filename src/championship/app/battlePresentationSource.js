// BATTLE presentation boundary.
//
// The only runtime seam the battle screen consumes, published as
// docs/contracts/championship/battle-field-presentation.v1.json.
//
// It projects a running battleSession into small immutable frames and hands the
// scene a per-tick view. It owns no gameplay state, no save state, no router, no
// renderer and no clock: every number below is read off the session the battle
// modules already drive.
//
// TWO CADENCES, ONE AUTHORITY
// ---------------------------
// `getFrame()` publishes on DISCRETE change -- a battle starting, a combatant
// going down, the battle ending. `getView()` is read every tick by the scene,
// because the clock and the HP bars move continuously and republishing a frame
// sixty times a second would drag every DOM observer along with it. Both read
// the same session; neither holds a second copy of it.
//
// NOTHING IS INVENTED HERE
// ------------------------
// Every field this projects is one the battle lane traced to a ROM read site,
// and the contract records which. There is no accuracy, no damage number and no
// turn counter, because the original has none of the three. Where the screen
// needs something the ROM does not decide -- where the six stand on the field --
// this reports it as product-authored placement and labels it as such.

import contract from "../../../docs/contracts/championship/battle-field-presentation.v1.json" with { type: "json" };
import { deepFreeze } from "../contracts/championshipContracts.js";
import speciesCatalog from "../../data/championship/catalogs/creature-species.r1.json" with { type: "json" };
import { SPECIES_NAMES_ZH } from "../text/catalogs.zhHant.js";
import { projectBattleCharacterRequest } from "../presentation/battleCharacterAction.js";
import {
  BATTLE_OUTCOME_END_NONE,
  BATTLE_OUTCOME_END_TEAM_DOWN,
  BATTLE_OUTCOME_END_TIME_UP,
  BATTLE_OUTCOME_LEVEL,
  BATTLE_OUTCOME_RUNNING,
  BATTLE_OUTCOME_TEAM_ONE_AHEAD,
  BATTLE_OUTCOME_TEAM_ZERO_AHEAD,
  BATTLE_OUTCOME_TIER_FRAMES,
  BATTLE_OUTCOME_TIER_MAX,
  BATTLE_OUTCOME_TIME_LIMIT_FRAMES,
  battleTeamOfSlot
} from "../battle/battleOutcome.js";
import { BATTLE_FRAME_SLOT_COUNT } from "../battle/battleFrameLoop.js";

export const BATTLE_PRESENTATION_CONTRACT_VERSION = "championship-modern-battle-field-presentation/v1";

export const BATTLE_PRESENTATION_BANDS = deepFreeze(contract.bands.map((band) => deepFreeze({ ...band })));

/** The end-reason and verdict vocabularies, so the scene never spells a code. */
export const BATTLE_PRESENTATION_END_REASONS = deepFreeze({
  [BATTLE_OUTCOME_END_NONE]: "RUNNING",
  [BATTLE_OUTCOME_END_TIME_UP]: "TIME_UP",
  [BATTLE_OUTCOME_END_TEAM_DOWN]: "TEAM_DOWN"
});

export const BATTLE_PRESENTATION_VERDICTS = deepFreeze({
  [BATTLE_OUTCOME_RUNNING]: "RUNNING",
  [BATTLE_OUTCOME_TEAM_ONE_AHEAD]: "TEAM_ONE_AHEAD",
  [BATTLE_OUTCOME_TEAM_ZERO_AHEAD]: "TEAM_ZERO_AHEAD",
  [BATTLE_OUTCOME_LEVEL]: "LEVEL"
});

function sourceError(message) {
  return new Error(`BATTLE_PRESENTATION_${message}`);
}

function ratio(current, maximum) {
  // A zero maximum is not a full bar and not a crash: it is nothing to draw.
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.max(0, Math.min(1, current / maximum));
}

/**
 * Where a slot stands on the field. PRODUCT-AUTHORED: the ROM's approach
 * geometry lives in states 4 and 5 and is not traced, so this is an even lay-out
 * and the frame says so rather than implying the original placed them here.
 */
export function battleStandPosition(slot) {
  if (!Number.isSafeInteger(slot) || slot < 0 || slot >= BATTLE_FRAME_SLOT_COUNT) {
    throw sourceError("SLOT_OUT_OF_RANGE");
  }
  const team = battleTeamOfSlot(slot);
  const withinTeam = slot % 3;
  return deepFreeze({
    // Three across, the player's row nearer the viewer.
    x: 0.5 + (withinTeam - 1) * 0.24,
    y: team === 0 ? 0.74 : 0.34,
    facing: team === 0 ? 1 : -1,
    evidence: "PRODUCT_AUTHORED"
  });
}

function projectCombatant(combatant, slot) {
  if (!combatant) {
    return deepFreeze({ slot, team: battleTeamOfSlot(slot), present: false });
  }
  const currentHp = combatant.currentHp ?? 0;
  const maxHp = combatant.maxHp ?? 0;
  const species = Number.isSafeInteger(combatant.speciesId)
    ? speciesCatalog.records.find(record => record.recordIndex === combatant.speciesId) : null;
  return deepFreeze({
    slot,
    team: battleTeamOfSlot(slot),
    present: true,
    speciesId: species ? `species-${String(species.recordIndex).padStart(3, "0")}` : null,
    displayName: species ? (SPECIES_NAMES_ZH[species.recordIndex] ?? species.identifier) : null,
    animationRequest: projectBattleCharacterRequest(combatant),
    hp: deepFreeze({ current: currentHp, maximum: maxHp, ratio: ratio(currentHp, maxHp) }),
    resource: deepFreeze({
      current: combatant.metricLimit ?? 0,
      maximum: combatant.metricBase ?? 0,
      ratio: ratio(combatant.metricLimit ?? 0, combatant.metricBase ?? 0)
    }),
    cooldown: combatant.field28 ?? 0,
    status: deepFreeze({ code: combatant.statusCode ?? 0, remaining: combatant.statusRemaining ?? 0 }),
    state: combatant.state ?? 0,
    // +0x94 is the in-flight object this combatant is committed to.
    engaged: (combatant.field94 ?? 0) !== 0,
    // R8: 0x17 is also ordinary hit recovery. HP and the final-down flag carry
    // liveness; a living combatant waiting in 0x17 must remain upright/selectable.
    down: currentHp<=0 || ((combatant.flags9A??0)&2)!==0,
    stand: battleStandPosition(slot)
  });
}

function projectClock(session) {
  const frames = session.clock ?? 0;
  return deepFreeze({
    frames,
    tier: session.tier ?? 0,
    tierMax: BATTLE_OUTCOME_TIER_MAX,
    tierFrames: BATTLE_OUTCOME_TIER_FRAMES,
    limit: BATTLE_OUTCOME_TIME_LIMIT_FRAMES,
    // The compare is `ble`, so frame 7200 still plays and the bar is not empty
    // until it has passed.
    remaining: Math.max(0, BATTLE_OUTCOME_TIME_LIMIT_FRAMES - frames),
    ratio: ratio(BATTLE_OUTCOME_TIME_LIMIT_FRAMES - frames, BATTLE_OUTCOME_TIME_LIMIT_FRAMES)
  });
}

function projectOutcome(session) {
  return deepFreeze({
    ended: session.ended === true,
    reason: BATTLE_PRESENTATION_END_REASONS[session.endReason ?? BATTLE_OUTCOME_END_NONE] ?? "RUNNING",
    verdict: BATTLE_PRESENTATION_VERDICTS[session.verdict ?? BATTLE_OUTCOME_RUNNING] ?? "RUNNING",
    // The screen says which side, not "you won": which team the viewer is on is
    // the caller's business, and the ROM only names team 0 and team 1.
    winningTeam: session.verdict === BATTLE_OUTCOME_TEAM_ZERO_AHEAD ? 0
      : session.verdict === BATTLE_OUTCOME_TEAM_ONE_AHEAD ? 1
        : null
  });
}

function requireSession(session) {
  if (!session || typeof session !== "object" || !Array.isArray(session.slots)) {
    throw sourceError("REQUIRES_A_BATTLE_SESSION");
  }
  if (session.slots.length !== BATTLE_FRAME_SLOT_COUNT) {
    throw sourceError(`SESSION_MUST_HAVE_${BATTLE_FRAME_SLOT_COUNT}_SLOTS`);
  }
  return session;
}

/**
 * Create the battle presentation boundary over a live session.
 *
 * `step` is the caller's frame advance, normally stepBattleSession. It is passed
 * in rather than imported so the scene can be driven by a test at any cadence,
 * and so this module never becomes a second clock.
 */
export function createBattlePresentationSource({ session, step, arenaIndex = 0, getSpecialPrelude = () => null,
  getNativeActor = () => null, getNativeLifecycle = () => null, getImpactEffects = () => [] } = {}) {
  requireSession(session);
  if (typeof step !== "function") {
    throw sourceError("REQUIRES_A_STEP_FUNCTION");
  }
  const arena = contract.arenaArt.arenas[arenaIndex];
  if (!arena) {
    throw sourceError("UNKNOWN_ARENA_INDEX");
  }

  const listeners = new Set();
  let frame = null;
  // Presentation history sampled at each EXISTING simulation step, including
  // steps between GPU redraws. It neither selects actions nor advances a clock.
  const animationStarts=new Map();
  function sampleAnimationStarts() {
    const focus=getSpecialPrelude();
    session.slots.forEach((combatant,slot)=>{
      if(!combatant){animationStarts.delete(slot);return;}
      const request=focus?.slot===slot ? {sequenceId:focus.sequence} : projectBattleCharacterRequest(combatant);
      const prior=animationStarts.get(slot);
      if(!prior || prior.sequenceId!==request.sequenceId || prior.speciesId!==combatant.speciesId)
        animationStarts.set(slot,{sequenceId:request.sequenceId,speciesId:combatant.speciesId,
          frame:focus?.slot===slot ? focus.startFrame+focus.sequenceStart : session.frame??session.clock??0});
    });
  }
  function projectSlot(combatant,slot) {
    const projected=projectCombatant(combatant,slot);
    if(!projected.present)return projected;
    const native=getNativeActor(slot);
    const focus=getSpecialPrelude();
    const focusRequest=focus?.slot===slot ? {sequenceId:focus.sequence,
      sequenceStartFrame:focus.startFrame+focus.sequenceStart,nativeRequest:true,timingEvidence:focus.timingEvidence} : null;
    // Only an explicit caller supplies this graph projection. The default
    // session has no original world positions and keeps its labeled stand-in.
    return deepFreeze({...projected,
      ...(native ? {stand:native.stand,nativeMotion:native.motion,nativeAnimation:native.nativeAnimation} : {}),
      animationRequest:focusRequest ?? native?.animationRequest ?? {...projected.animationRequest,
        sequenceStartFrame:animationStarts.get(slot)?.frame??null}});
  }
  sampleAnimationStarts();

  function buildFrame() {
    return deepFreeze({
      contractVersion: BATTLE_PRESENTATION_CONTRACT_VERSION,
      arena: deepFreeze({
        index: arena.index,
        identifier: arena.identifier,
        field: arena.field,
        // Ten of eleven arenas share one common ring; cyberspace has none, and
        // the scene must not draw one for it.
        hasCommonLayer: arena.common !== null,
        artStatus: contract.arenaArt.status
      }),
      combatants: deepFreeze(session.slots.map(projectSlot)),
      outcome: projectOutcome(session)
    });
  }

  function publish() {
    frame = buildFrame();
    for (const listener of [...listeners]) {
      try { listener(frame); } catch { /* a failing observer must not stop the battle */ }
    }
    return frame;
  }

  publish();

  return {
    /** The discrete frame. Republished only when something a viewer would notice changes. */
    getFrame() {
      return frame;
    },
    subscribe(listener) {
      if (typeof listener !== "function") throw sourceError("SUBSCRIBER_MUST_BE_A_FUNCTION");
      listeners.add(listener);
      listener(frame);
      return () => listeners.delete(listener);
    },
    /** Read every tick by the scene. Continuous, and never published to observers. */
    getView() {
      return deepFreeze({
        clock: projectClock(session),
        animationFrame: session.frame ?? session.clock ?? 0,
        specialPrelude: getSpecialPrelude(),
        nativeLifecycle: getNativeLifecycle(),
        impactEffects: getImpactEffects(),
        combatants: deepFreeze(session.slots.map(projectSlot)),
        outcome: projectOutcome(session)
      });
    },
    /**
     * Advance one frame and republish only on a discrete change: someone went
     * down, someone's engagement changed, or the battle ended.
     */
    tick() {
      const before = frame;
      const stepped = step(session);
      sampleAnimationStarts();
      const after = buildFrame();
      const changed = after.outcome.ended !== before.outcome.ended
        || after.combatants.some((entry, index) => {
          const was = before.combatants[index];
          return entry.present !== was.present
            || (entry.present && (entry.down !== was.down || entry.engaged !== was.engaged
              || entry.hp.current !== was.hp.current || entry.resource.current !== was.resource.current
              || entry.status.code !== was.status.code || entry.status.remaining !== was.status.remaining));
        });
      if (changed) publish();
      return stepped;
    },
    dispose() {
      listeners.clear();
      animationStarts.clear();
    }
  };
}
