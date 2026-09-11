// Battle runtime — what the three VS5 screens share.
//
// The menu chooses a match, the match runs it, the result reports it. Something
// has to hold the chosen match and the live session across those three mounts
// without any of them owning the others, and this is it.
//
// It owns no DOM, no renderer and no screen stack. It advances the session on a
// clock the caller supplies, because the Pixi scene already advances the same
// session from the stage ticker and a second clock would run the battle twice.
//
// WHERE THE SIX COME FROM
// -----------------------
// battleMatchSelection resolves which matches are open and which opponent team
// a match names; battleRosterSource turns that team's preset indices into
// creatures through the ROM's own builder, and the player's three through the
// same builder over declared levels. Nothing here computes a stat.

import { deepFreeze } from "../contracts/championshipContracts.js";
import {
  BATTLE_MATCH_LIST_CAP,
  expandOpponentTeam,
  getMatchRecord,
  matchEntryFee,
  matchPayout,
  resolveMatchList
} from "../battle/battleMatchSelection.js";
import {
  createBattleSession,
  createSessionCombatant,
  stepBattleSession
} from "../battle/battleSession.js";
import { BATTLE_STATE_COOLDOWN_GATE } from "../battle/battleStateMachine.js";
import { BATTLE_RNG_TRACED_MASTER_SEED, createChannelRng } from "../battle/battleRngChannel.js";
import { getBattleCatalogRecord, listMoveRecordsForCombatant } from "../battle/battleCatalogs.js";
import { damageInputsFor } from "../battle/battleDamageInputs.js";
import { resolveBattleDamage } from "../battle/battleDamageResolver.js";
import {
  isSingleTargetSelector,
  planBattleContactTargets,
  BATTLE_CONTACT_ACCEPTED
} from "../battle/battleContactTargeting.js";
import { battleTeamOfSlot, recordRoundOutcome } from "../battle/battleOutcome.js";
import {
  BATTLE_ACTION_APPLY_BODY,
  battleNativeMeleeContact,
  selectActionTargets
} from "../battle/battleActionApplication.js";
import { BATTLE_CREATURE_STAT_MAP } from "../battle/battleCreatureBuild.js";
import {buildOwnedBattleCreature,settleOwnedBattleIndividual} from '../battle/battleParty.js';
import {
  BATTLE_LAUNCH_POOL_SIZE,
  allocateLaunchObject,
  releaseLaunchObject
} from "../battle/battleLaunchPool.js";
import { createBattleNativeActors } from '../battle/battleNativeActors.js';
import {createBattleEffectActors,battleEffectBankDemand} from '../battle/battleEffectActors.js';
import {battleNativeProjectileContact} from '../battle/battleProjectileContact.js';
import { createBattleNativeLaunch, nextBattleImpactOffset } from '../battle/battleNativeLaunch.js';
import { createBattleImpactEffects } from '../battle/battleImpactEffects.js';
import {createBattleSoundEvents} from '../battle/battleSoundEvents.js';
import {beginBattlePresentationEngagement,endBattlePresentationEngagement,writeBattleHitTiming,advanceBattlePresentationTiming} from '../battle/battlePresentationHost.js';
import { createBattleHitRuntime } from '../battle/battleHitRuntime.js';
import {createBattleNormalRuntime} from '../battle/battleNormalRuntime.js';
import {normalBattleStands,normalBattleLaunchGuard} from '../battle/battleNormalFlow.js';
import { battleHitEligible } from '../battle/battleHitState.js';
import { projectBattleCharacterRequest } from '../presentation/battleCharacterAction.js';
import { battleSpecialPreludeInputs, sampleBattleSpecialPrelude } from "../battle/battleSpecialPrelude.js";
import { BATTLE_SPECIES_MOVEMENT } from "../../data/championship/battleCharacterProfiles.js";
import { createBattlePresentationSource } from "./battlePresentationSource.js";
import {
  BATTLE_ROSTER_PROFILES,
  buildBattleRoster,
  combatantFieldsFor,
  rosterEvidence
} from "./battleRosterSource.js";

export const BATTLE_RUNTIME_MATCH_CAP = BATTLE_MATCH_LIST_CAP;

/** No caller calendar means no eligible matches, never an invented date. */
export const BATTLE_RUNTIME_DEFAULT_SCHEDULE_EVIDENCE = "UNKNOWN_REQUIRES_TRACE";
export const BATTLE_RUNTIME_DEFAULT_ECONOMY_CONTEXT_EVIDENCE = "PRODUCT_AUTHORED";

function runtimeError(message) {
  return new Error(`BATTLE_RUNTIME_${message}`);
}

/**
 * `resolve` supplies whatever battleMatchSelection needs to filter the schedule;
 * the default asks for the ordinary list rather than the entry-mode override.
 */
export function createBattleRuntime(options = {}) {
  // The normal title entry supplies the selected owned individuals. Legacy
  // research fixtures can still request their explicitly declared preset team.
  // Ownership and current individual fields are resolved by the application;
  // this runtime cannot create, heal or reroll a player's party at entry.
  const residentIds = options.residentIds ?? [];
  const playerIndividuals = options.playerIndividuals ?? null;
  if(playerIndividuals!==null&&(!Array.isArray(playerIndividuals)||playerIndividuals.length<1||playerIndividuals.length>3))
    throw runtimeError('OWNED_PARTY_REQUIRED');
  // Which team stands in for the player is a stand-in, not a reading: a title
  // record names ONE opponent team and the player's own party is what fills the
  // other side in the original.
  const playerTeamIndex = options.playerTeamIndex ?? 1;
  const seed = options.seed ?? BATTLE_RNG_TRACED_MASTER_SEED;
  const arenaIndex = options.arenaIndex ?? 0;
  // These are separate from menu entryMode. The existing single-match fixture
  // uses zero; no four-face-to-mode mapping is implied or enabled by this seam.
  const mode = options.mode ?? 0;
  const battleType = options.battleType ?? 0;
  if (!Number.isSafeInteger(mode) || mode < 0 || mode > 5) throw runtimeError("MODE_MUST_BE_0_TO_5");
  if (!Number.isSafeInteger(battleType) || battleType < 0) throw runtimeError("INVALID_BATTLE_TYPE");
  const economyContextEvidence = options.mode === undefined || options.battleType === undefined
    ? BATTLE_RUNTIME_DEFAULT_ECONOMY_CONTEXT_EVIDENCE : "CALLER_SUPPLIED";
  // The app supplies the same calendar/rank read by the status and Schedule
  // views. A missing legacy date does not silently select Autumn Day 4.
  const schedule = options.schedule ? { ...options.schedule } : null;
  const scheduleEvidence = options.schedule ? "CALLER_SUPPLIED" : BATTLE_RUNTIME_DEFAULT_SCHEDULE_EVIDENCE;

  /**
   * A creature's level fields keyed by the creature offsets the resolver reads,
   * which is the shape battleDamageInputs asks for. The mapping between preset
   * field and creature offset is battleCreatureBuild's, so this only re-keys it.
   */
  function defenceLevelsOf(creature) {
    const levels = {};
    for (const entry of BATTLE_CREATURE_STAT_MAP) {
      if (entry.level === null) continue;
      levels[entry.level] = creature.levels[entry.preset] ?? 0;
    }
    return levels;
  }

  // The 596-record move table keyed by the id AI selection returned. A decision
  // that named no action has no record, and the walk then does nothing.
  function moveRecordFor(decision) {
    const actionId = decision?.action?.actionId??decision?.actionId;
    if (!Number.isSafeInteger(actionId)) return null;
    // The catalog key is "moves". It was "battle-moves" here for a while and the
    // try/catch swallowed the miss, so every committed action carried a null
    // move and neither the script path nor the contact walk ever ran. A lookup
    // that fails is now a thrown error rather than a silent null.
    return getBattleCatalogRecord("moves", actionId);
  }

  /**
   * OVL19 0x0211C714 into 0x0211C92C, with the roster the walk sees.
   *
   * The contact walk visits the OTHER team's three slots, because a combatant's
   * three target slots are its opponents. Which three the ROM puts there is the
   * move script's business and is not traced, so the opposing team in slot order
   * is a PRODUCT_AUTHORED stand-in and this is the one place that says so.
   */
  /**
   * The committed action's move script, run on the traced VM.
   *
   * This is the ordinary attack path: kinds 0 and 1 reach the damage term, and
   * they get there through a script that calls 0x0211D71C. The contact walk
   * below is the smaller sibling for kinds 2 and 3.
   */
  // The VM and its memory hang off the action HERE rather than on the action
  // itself: battleSession puts committed actions into its event stream and deep
  // freezes it, and a live VM's slots are typed arrays that cannot be frozen. It
  // also keeps the battle lane's data plain, which is where that line belongs.
  const scriptStates = new WeakMap();
  let nativeActors=null,effectActors=null;
  const nativeLaunches=new Set(), nativeHistory=[];
  const impactEffects=createBattleImpactEffects();
  const soundEvents=createBattleSoundEvents();
  let impactFlashFrame=-1;
  const timingIssues=new Set();
  const contacts={projectileCalls:0,projectileHits:0,meleeCalls:0,history:[]};
  let specialPrelude = null;

  function prepareActionLaunch(slot,action){
    const state=scriptStateFor(action);if(state.prepared)return !state.refused;
    state.prepared=true;
    const actor=session.slots[slot],m=nativeActors.memory,wrapper=nativeActors.address(slot);
    const targetAddress=m.readU32(wrapper,0x5c),targetIndex=session.slots.findIndex((c,i)=>c&&nativeActors.address(i)===targetAddress);
    if(!actor){state.refused=true;return false;}
    actor.field154=m.readU32(wrapper,0x154);
    const guard=normalBattleLaunchGuard({owner:actor,move:action.move,globalLock:session.slots.some(c=>c?.field94),
      objectFlags:m.readU32(0x11000000+action.index*0x2000,0),target:session.slots[targetIndex]});
    state.guard=guard;
    if(!guard.accepted){state.refused=true;return false;}
    actor.metricLimit=guard.resourceAfter;nativeActors.syncCombatants();
    beginBattlePresentationEngagement({slots:session.slots,actors:nativeActors,slot,targetSlot:targetIndex,action,
      notify:(i,n)=>hitRuntime.notify(i,n)});
    // Notification 1 is the completed recovery's idle entry. The existing
    // launch adapter now requests its committed move's family as on first launch.
    if(!session.normalFlow){const request=projectBattleCharacterRequest(actor.field17C===1?{...actor,field17C:0}:actor);
      if(request.sequenceId!==null)nativeActors.requestSequence(slot,request.sequenceId,request.timingEvidence);}
    return true;
  }

  // Reuse the exclusive prelude frame branch after the normal launch guards.
  // Its screen framing remains a separately bounded mobile adaptation.
  function prepareSpecialPrelude(slot, action) {
    const state = scriptStateFor(action);
    if (state.preludeDone) return false;
    const input = battleSpecialPreludeInputs(session.slots[slot]?.speciesId, action.move);
    if (!input) return false;
    if (!specialPrelude) {
      specialPrelude = {slot,action,input,startFrame:session.frame+1,sample:sampleBattleSpecialPrelude(input,0)};
      runCommittedScript({slot,action,slots:session.slots,rng:session.rng,session,preludeOnly:true});
    }
    return true;
  }

  function getSpecialPrelude() {
    if (!specialPrelude) return null;
    const {slot,action,startFrame,sample} = specialPrelude;
    return {slot,moveId:action.move.recordIndex,startFrame,...sample,
      timingEvidence:'ROM_PRELUDE_VM_FROM_NORMAL_SELECTION',
      framingEvidence:'MOBILE_VIEWPORT_ADAPTATION_WORLD_POSITIONS_PARTIAL'};
  }

  function scriptStateFor(action) {
    let state = scriptStates.get(action);
    if (!state) {
      state = { memory: new Map(), script: {} };
      scriptStates.set(action, state);
    }
    return state;
  }

  function runCommittedScript({ slot, action, slots, rng, session,preludeOnly=false }) {
    const move = action?.move;
    if (!move) return null;
    const state = scriptStateFor(action);
    // runMoveScript can initialize an inactive VM for a NEW invocation. A
    // committed action has only one invocation: completion must not restart it
    // and apply its damage again on the following frame.
    if (state.finished) return state.lastRun;
    const ownerObject=nativeActors.address(slot);
    if(!state.launch){
      const targetSlot=action.targetSlot,point=nativeActors.targetPoint(targetSlot);
      if(!point)return null;
      state.launch=createBattleNativeLaunch({memory:nativeActors.memory,index:action.index,
        owner:ownerObject,ownerSlot:slot,target:nativeActors.address(targetSlot),point,record:move,
        skipPrelude:state.preludeDone===true,onSupport:()=>applySupportFromLaunch(slot,action,state),
        advanceOwned:object=>effectActors.advanceOwned(object),callNative(routine,args) {
        const actorResult=nativeActors.call(routine,args);if(actorResult!==undefined)return actorResult;
        const effectResult=effectActors.call(routine,args);if(effectResult!==undefined)return effectResult;
        const soundResult=soundEvents.call(routine,args,session.frame,move.recordIndex);if(soundResult!==undefined)return soundResult;
        const impactResult=impactEffects.call(nativeActors.memory,routine,args);if(impactResult!==undefined)return impactResult;
        if ((routine===0x02114320 || routine===0x0211436c) && args[0]===ownerObject) {
          const movement=BATTLE_SPECIES_MOVEMENT[slots[slot]?.speciesId];
          return movement?.[routine===0x02114320?'walkQ12':'runQ12'];
        }
        // The attack native delegates its body here, where the roster is.
        if (routine === BATTLE_ACTION_APPLY_BODY) {
          const applied = applyActionFromScript(session, slot, move, rng,args[2]??0,state,args[0]);
          return applied ? applied.hits.length : 0;
        }
        if(routine===0x020431d4)return rng.next(args[0]);
        return undefined;
      }});
      nativeLaunches.add(state.launch);
    }
    const run=state.launch.step({preludeOnly});
    state.lastRun = run;
    state.finished = state.launch.snapshot().phase==='DONE';
    return {...run,active:!state.finished};
  }

  function applySupportFromLaunch(slot,action,state) {
    const move=action.move,slots=session.slots,ownTeam=battleTeamOfSlot(slot);
    const targetSlots=slots.flatMap((c,i)=>c&&battleTeamOfSlot(i)===ownTeam?[{slot:i,currentHp:c.currentHp}]:[]);
    const singleTarget=slots[action.targetSlot]?{slot:action.targetSlot,currentHp:slots[action.targetSlot].currentHp}:null;
    const plan=planBattleContactTargets({actionField50:move.kind,actionField54:move.targetMode,singleTarget,targetSlots});
    for(const visit of plan.visits){
      if(visit.outcome!==BATTLE_CONTACT_ACCEPTED)continue;
      const targetSlot=isSingleTargetSelector(move.targetMode)?action.targetSlot:targetSlots[visit.slot].slot;
      state.launch.startImpact({targetObject:nativeActors.address(targetSlot),xyz:nativeActors.position(targetSlot)});
      hitRuntime.support(targetSlot,move);
    }
  }

  /**
   * OVL19 0x0211D740, the body both attack natives enter. The script reaches it
   * through 0x0211D71C with a kind read out of Q12, or through 0x0211D70C with
   * the kind forced to 13.
   *
   * battleScriptNatives deliberately knows nothing about battle state, so it
   * delegates here. This is where the roster walk, the resolver and the HP write
   * meet -- all three of them modules this lane already traced.
   */
  function applyActionFromScript(session, slot, move, rng,parameters=0,state=null,nativeKind=13) {
    const roster = session.slots;
    const attacker = roster[slot];
    if (!attacker || !move) return null;
    contacts[parameters?'projectileCalls':'meleeCalls']++;

    const walk = selectActionTargets({ roster, attacker });
    const hits = [];
    for (const targetSlot of walk.targets) {
      if (targetSlot === slot) continue;
      const defender = roster[targetSlot];
      const attackerCreature = builtRoster?.[slot];
      const defenderCreature = builtRoster?.[targetSlot];
      if (!defender || !attackerCreature || !defenderCreature) continue;
      if(!battleHitEligible(defender,move.kind))continue;
      if(nativeActors){
        const b=nativeActors.box(targetSlot),m=nativeActors.memory;if(!b)continue;
        if(parameters!==0){
          if(!effectActors.has(parameters)||!battleNativeProjectileContact(effectActors.box(parameters),effectActors.position(parameters),
            m.readU32(parameters,0xc)|0,m.readU32(parameters,0x10)|0,b,nativeActors.position(targetSlot)))continue;
        }else if(!nativeActors.box(slot)||!battleNativeMeleeContact(nativeActors.box(slot),nativeActors.position(slot),
          m.readU32(nativeActors.actorOf(slot),0x6dc),b,nativeActors.position(targetSlot)))continue;
      }
      const impactOffset=state?.launch ? nextBattleImpactOffset(nativeActors.memory,state.launch.object,0x20000000) : [0,0,0];
      const inputs = damageInputsFor({
        attacker: {
          attackerLevel: attackerCreature.levels.field18 ?? 0,
          buffCode: attacker.field160 ?? 0,
          statusCode: attacker.statusCode ?? 0
        },
        defender: {
          currentHp: defender.currentHp,
          levels: defenceLevelsOf(defenderCreature),
          buffCode: defender.field160 ?? 0
        },
        action: { power: move.power ?? 0, elementSelector: move.elementSelect ?? 0 }
      });
      if (!inputs) continue;
      const resolved = resolveBattleDamage({ ...inputs, rng });
      const result=hitRuntime.apply(targetSlot,{move,damage:resolved.damage,critical:resolved.critical,nativeKind,
        sourcePoint:parameters?effectActors.position(parameters):nativeActors.position(slot),statusInputs:{attackerIndex:inputs.statusAttackerIndex,
          selectedDefenseIndex:inputs.statusDefenderIndex,
          defenseIndex0x9C:defenceLevelsOf(defenderCreature)[0x9c],
          defenseIndex0xA0:defenceLevelsOf(defenderCreature)[0xa0],
          defenseIndex0xA4:defenceLevelsOf(defenderCreature)[0xa4]}});
      if(parameters){contacts.projectileHits++;contacts.history.push({frame:session.frame,moveId:move.recordIndex,slot,targetSlot,
        actor:parameters,sourcePoint:effectActors.position(parameters),hpAfter:defender.currentHp,result:result.code});
        if(contacts.history.length>128)contacts.history.shift();}
      hits.push({ slot: targetSlot, damage: resolved.damage, critical: resolved.critical });
      state?.launch?.startImpact({targetObject:nativeActors.address(targetSlot),xyz:nativeActors.position(targetSlot),
        targetBox:nativeActors.box(targetSlot),resultCode:result.code,nativeKind,offset:impactOffset,
        onSpark:kind=>{
          return impactEffects.spawnNative(nativeActors.memory,{owner:state.launch.object,target:nativeActors.address(targetSlot),
            type:kind==='SECONDARY_3D'?(attacker.speciesId>=72?3:2):(defender.speciesId>=72?1:0),offset:impactOffset});
        }});
    }
    return { hits, rejected: walk.rejected };
  }

  let builtRoster = null;
  let chosen = null;
  let source = null;
  let roster = null;
  const observers = new Set();
  let unsubscribe = null;

  let session = null;
  let hitRuntime = null;
  let completedRound = null;

  function stepMatch(liveSession) {
    if(liveSession.ended)return deepFreeze({frame:liveSession.frame,events:[],ended:true});
    nativeActors?.setFrame(liveSession.frame);
    nativeActors.updateWorldFlags();
    if(!advanceBattlePresentationTiming(nativeActors.memory,nativeActors.worldAddress)){
      liveSession.frame++;
      return deepFreeze({frame:liveSession.frame,events:[],ended:false});
    }
    const exclusiveOwner=liveSession.slots.find(c=>c?.field94)?.field94??0;
    if (exclusiveOwner) {
      nativeActors.updateWorldFlags(); // 0210D3A4 also precedes the exclusive branch.
      // D490 and D694 are mutually exclusive paths (D5F8 jumps to DA00).
      // CC7C additionally requires the owner's lock to name this exact action.
      for(const {slot,action} of liveSession.normalFlow.inFlight()){
        if(liveSession.slots[slot].field94!==0x11000000+action.index*0x2000)continue;
        const focus=specialPrelude?.action===action&&specialPrelude.sample.active?specialPrelude:null;
        const run=runCommittedScript({slot,action,slots:liveSession.slots,rng:liveSession.rng,session:liveSession,preludeOnly:!!focus});
        if(focus){
          focus.sample=sampleBattleSpecialPrelude(focus.input,focus.sample.frame+1);
          if(!focus.sample.active){
            if(scriptStateFor(action).launch.snapshot().phase==='PRELUDE')throw runtimeError('PRELUDE_NATIVE_TIMELINE_MISMATCH');
            scriptStateFor(action).preludeDone=true;
          }
        }
        if(run?.started&&!run.active&&!run.error)action.release();
      }
      const engaged=liveSession.slots.flatMap((c,i)=>c?.field94?[i]:[]);
      for(const slot of engaged)hitRuntime.step(slot); // D534: reaction/notification, not AI dispatch.
      nativeActors.advance(engaged);
      effectActors.advance({exclusive:true});
      impactEffects.advance({exclusiveOwner:liveSession.slots.find(c=>c?.field94)?.field94??0,
        isOwnerActive:owner=>Boolean(nativeActors.memory.readU32(owner,0xe4))});
      // Script contact, target reactions and their RNG continue; ordinary AI,
      // status timers, cooldown and the D93C battle clock remain paused.
      liveSession.frame += 1;
      if(!engaged.length)specialPrelude=null;
      return deepFreeze({frame:liveSession.frame,events:[],ended:false});
    }
    specialPrelude = null;
    impactEffects.advance({isOwnerActive:owner=>Boolean(nativeActors.memory.readU32(owner,0xe4))});
    const result = stepBattleSession(liveSession);
    nativeActors?.advance();
    effectActors?.advance();
    if (liveSession.ended && completedRound === null) {
      // A stopped session receives no more VM frames. Release at the owning
      // runtime boundary so result navigation cannot strand scripts or VFX.
      for(const combatant of liveSession.slots){for(const action of [...(combatant?.launchSlots??[])])action?.release?.();
        combatant?.committedAction?.release?.();if(combatant)combatant.committedAction=null;}
      impactEffects.clear();
      effectActors.clear();
      completedRound = recordRoundOutcome({
        verdict: liveSession.verdict, battleType, flags: [], cursor: 0
      });
    }
    return result;
  }

  function listMatches() {
    if (!schedule) return deepFreeze([]);
    const resolved = resolveMatchList(schedule);
    return deepFreeze(resolved.records.slice(0, BATTLE_RUNTIME_MATCH_CAP).map((recordIndex) => {
      const record = getMatchRecord(recordIndex);
      return deepFreeze({
        recordIndex,
        // The title is the record's own field; no name is invented for it.
        title: `MATCH ${String(recordIndex).padStart(2, "0")}`,
        payout: matchPayout(recordIndex),
        entryFee: matchEntryFee(recordIndex),
        source: resolved.source,
        record
      });
    }));
  }

  return Object.freeze({
    listMatches,

    /** Whether the schedule that produced this list was given or defaulted. */
    scheduleEvidence() {
      return scheduleEvidence;
    },

    /**
     * A tournament round names its opponent from the run's own pool rather than
     * from a title record, so it hands the team index straight in. startMatch
     * reads the same field either way, and a round carries no fee or payout of
     * its own: the prize belongs to the run.
     */
    chooseChampionshipRound({ category, teamIndex } = {}) {
      if (source) throw runtimeError("MATCH_ALREADY_STARTED");
      if (!Number.isSafeInteger(category) || category < 0) throw runtimeError("CHAMPIONSHIP_CATEGORY_REQUIRED");
      if (!Number.isSafeInteger(teamIndex) || teamIndex < 0) throw runtimeError("CHAMPIONSHIP_TEAM_REQUIRED");
      chosen = deepFreeze({ recordIndex: category, payout: 0, entryFee: 0,
        championship: true, record: { field08: teamIndex } });
      return chosen;
    },

    chooseMatch(recordIndex) {
      if (source) throw runtimeError("MATCH_ALREADY_STARTED");
      const match = listMatches().find((entry) => entry.recordIndex === recordIndex);
      if (!match) throw runtimeError("MATCH_IS_NOT_OPEN");
      chosen = match;
      return match;
    },

    getChosenMatch() {
      return chosen;
    },

    economyContextEvidence() {
      return economyContextEvidence;
    },

    getEconomyContext() {
      if (!chosen) throw runtimeError("NO_MATCH_CHOSEN");
      return deepFreeze({
        recordIndex: chosen.recordIndex, mode, battleType,
        payout: chosen.payout, entryFee: chosen.entryFee, expectedRounds: 1
      });
    },

    // Domain result, independent of the view's translated verdict labels.
    // This runtime runs one match; it does not initialize or claim unused rounds.
    getSettlementResult() {
      if (!session) throw runtimeError("NO_MATCH_STARTED");
      return deepFreeze({
        ended: session.ended,
        verdict: session.verdict,
        reason: session.endReason,
        battleType, mode, matchIndex: chosen.recordIndex,
        roundCursor: completedRound?.cursor ?? 0,
        outcomeEntries: completedRound ? [...completedRound.flags] : [],
        ...(playerIndividuals&&session.ended?{individualResults:roster.slice(0,3).flatMap((creature,i)=>creature?[{
          instanceId:creature.instanceId,nativeProfile:settleOwnedBattleIndividual(creature.nativeProfile,{
            currentHp:session.slots[i].currentHp,metricLimit:session.slots[i].metricLimit,
            verdict:session.verdict,mode})}]:[])}:{})
      });
    },

    /** Build the six and open a presentation source over the live session. */
    startMatch() {
      if (!chosen) throw runtimeError("NO_MATCH_CHOSEN");
      if (source) return source;

      // A title record names an opponent team; the team names preset indices.
      // +0x08 is the permutation this lane already found is NOT the identity.
      const teamIndex = chosen.record.field08 ?? -1;
      const presetIndices = expandOpponentTeam(teamIndex);
      const playerPresets = residentIds.length > 0 || playerIndividuals ? [] : expandOpponentTeam(playerTeamIndex);
      roster = buildBattleRoster({ residentIds, presetIndices, playerPresetIndices: playerPresets });
      if(playerIndividuals){
        const owned=playerIndividuals.map(buildOwnedBattleCreature);
        while(owned.length<3)owned.push(null);
        roster=deepFreeze([...owned,...roster.slice(3)]);
      }
      builtRoster = roster;

      // The twelve shared in-flight objects, as battleLaunchPool models them:
      // bit 0 of each first word is the in-use flag, and the allocator returns
      // the lowest free index or -1. A committed action claims one; a battle
      // that has exhausted the pool simply cannot launch, which is the ROM's
      // behaviour and not an error.
      const pool = new Array(BATTLE_LAUNCH_POOL_SIZE).fill(0);
      session = createBattleSession({
        waitForNativeAction:true,
        stepNotification:slot=>hitRuntime.step(slot),
        onFrameEvents:(slot,events,before)=>hitRuntime.frameEvents(slot,events,before),
        notify:(slot,code)=>hitRuntime.notify(slot,code),
        roster: roster.map((creature, slot) => {
          const fields = combatantFieldsFor(creature, slot);
          // State 3 is the cooldown gate, which is where a combatant waits
          // between actions. Starting them in state 1 let every one of them
          // commit on every frame and a match was over in three.
          return fields
            ? createSessionCombatant({ state: BATTLE_STATE_COOLDOWN_GATE, field28: 0, statePeriod: 1, ...fields })
            : null;
        }),
        rng: options.rng ?? createChannelRng(seed),
        allocateAction(slot, decision, launchContext=null) {
          const move=moveRecordFor(decision);if(!move)return null;
          // Normal states supply the original packed-team target. Preserve the
          // scalar fixture fallback for callers without the normal adapter.
          const targetSlot=launchContext?.targetSlot??(decision.target?.kind==='SELF'?slot
            : Number.isInteger(decision.target?.index)?decision.target.index
            : session.slots.findIndex((c,i)=>c&&c.currentHp>0&&battleTeamOfSlot(i)!==battleTeamOfSlot(slot)));
          if(targetSlot<0)return null;
          const index = allocateLaunchObject(pool);
          if (index < 0) return null;
          pool[index] = 1;
          if(!session.normalFlow)nativeActors.memory.writeU32(nativeActors.address(slot),0x5c,nativeActors.address(targetSlot));
          const action = {
            index,
            slot,
            // The move record the action names, which is what the contact walk
            // and the resolver both read their fields off.
            move,targetSlot,targetEvidence:launchContext?'ROM_NORMAL_TARGET_02111F20':decision.target?'ORIGINAL_TARGETED_DECISION':'EXISTING_SINGLE_TARGET_ADAPTER_PARTIAL',
            release() { const launch=scriptStates.get(action)?.launch;
              endBattlePresentationEngagement({slots:session.slots,actors:nativeActors,slot,object:0x11000000+index*0x2000});
              impactEffects.retireOwner(0x11000000+index*0x2000);
              if(launch){nativeHistory.push(launch.snapshot());if(nativeHistory.length>32)nativeHistory.shift();launch.dispose();nativeLaunches.delete(launch);}
              if(launchContext)session.normalFlow.releaseSlot(slot,launchContext.launchIndex,action);
              else if(session.slots[slot]?.currentHp>0 && ![15,18,19,20,21].includes(session.slots[slot].field17C))nativeActors.requestSequence(slot,0,'EXISTING_DISPATCH_RELEASE_TIMING_PARTIAL');
              pool[index] = releaseLaunchObject(pool[index]); }
          };
          return action;
        },
        resolveContact(input) {
          const lock=session.slots[input.slot]?.field94;
          if(lock&&lock!==0x11000000+input.action.index*0x2000)return null;
          if(!prepareActionLaunch(input.slot,input.action))return {hits:[],terminal:true};
          if (prepareSpecialPrelude(input.slot,input.action)) return null;
          // The launch owns prelude/primary/auxiliary ordering; kind2/3 support
          // is called once at C714 after the prelude, not on every frame.
          const run = runCommittedScript({ ...input, session });

          // Existing 0211CD80 completion seam now receives real VM completion.
          // It still does not claim missing child/native object-graph lifetime.
          return run?.started && !run.active && !run.error ? {hits:[],terminal:true} : null;
        }
      });
      nativeActors=createBattleNativeActors({slots:session.slots,creatures:roster,stands:normalBattleStands(session.slots)});
      soundEvents.attach(nativeActors.memory);
      // Use the same species move list as current normal selection. Appended
      // resident moves remain outside this roster adapter until connected.
      const demand=battleEffectBankDemand(session.slots.map(c=>c?listMoveRecordsForCombatant(c):[]));
      effectActors=createBattleEffectActors({memory:nativeActors.memory,worldAddress:nativeActors.worldAddress,
        loadedBankIds:demand.flatMap((n,id)=>id&&n?[id]:[])});
      demand.forEach((n,id)=>nativeActors.memory.writeU16(effectActors.base,4+id*2,n));
      nativeActors.memory.writeU32(0x02131c40,0,nativeActors.worldAddress);
      hitRuntime=createBattleHitRuntime({session,actors:nativeActors,
        onSound:id=>soundEvents.call(0x0203ea30,[id,127,0],session.frame),
        onHitTiming:detail=>{const issue=writeBattleHitTiming(nativeActors.memory,nativeActors.worldAddress,detail);if(issue)timingIssues.add(issue);},
        onImpactFeedback:({move,blocked,critical})=>{
          soundEvents.call(0x0203ea30,[soundEvents.impactId(move,blocked),127,0],session.frame,move.recordIndex);
          // FC68 -> 02043B9C(1,1); 02043A6C displays one white frame, then restores.
          if(!blocked&&(move.field46||critical))impactFlashFrame=session.frame;
        }});
      session.normalFlow=createBattleNormalRuntime({session,actors:nativeActors,creatures:roster,initialize:prepareActionLaunch,applyStatus:hitRuntime.status});
      source = createBattlePresentationSource({ session, step: stepMatch, arenaIndex, getSpecialPrelude,
        getNativeActor:slot=>nativeActors.project(slot),getImpactEffects:()=>impactEffects.snapshot({
          exclusiveOwner:session.slots.find(c=>c?.field94)?.field94??0}),getNativeLifecycle:()=>({
          active:[...nativeLaunches].map(v=>v.snapshot()),recent:[...nativeHistory],impacts:impactEffects.diagnostics(),sound:soundEvents.snapshot(),
          timing:{pause:nativeActors.memory.readU32(nativeActors.worldAddress,0x1f134),slowdown:nativeActors.memory.readU32(nativeActors.worldAddress,0x1f138),issues:[...timingIssues]},
          flash:{active:!session.ended&&impactFlashFrame===session.frame-1,frame:impactFlashFrame,source:'0210FC68'},
          effectPool:effectActors.diagnostics(),effectActors:effectActors.snapshot(),contacts:{...contacts,history:[...contacts.history]},reactions:hitRuntime.snapshot(),normalFlow:session.normalFlow.snapshot()}) });
      unsubscribe = source.subscribe(() => {
        const view = source.getView();
        for (const observer of [...observers]) {
          try { observer(view); } catch { /* a failing observer must not stop a battle */ }
        }
      });
      return source;
    },

    /** Called with a fresh view whenever the source publishes a discrete change. */
    observe(observer) {
      if (typeof observer !== "function") throw runtimeError("OBSERVER_MUST_BE_A_FUNCTION");
      observers.add(observer);
      if (source) observer(source.getView());
      return () => observers.delete(observer);
    },

    rosterEvidence() {
      return roster ? playerIndividuals?'ROM_VERIFIED_INDIVIDUAL_FIELDS':rosterEvidence(roster) : null;
    },

    outcome() {
      if (!source) throw runtimeError("NO_MATCH_STARTED");
      return source.getView().outcome;
    },
    getResultParticipants(){
      if(!session?.ended)throw runtimeError('MATCH_NOT_ENDED');
      return deepFreeze(roster.slice(0,3).map(creature=>creature?{speciesId:`species-${String(creature.speciesId).padStart(3,'0')}`,instanceId:creature.instanceId??null}:null));
    },

    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      observers.clear();
      source?.dispose?.();
      source = null;
      roster = null;
      builtRoster = null;
      chosen = null;
      session = null;
      hitRuntime = null;
      for(const launch of nativeLaunches)launch.dispose();nativeLaunches.clear();nativeHistory.length=0;nativeActors=null;
      impactEffects.clear();
      soundEvents.clear();
      effectActors?.clear();effectActors=null;
      contacts.projectileCalls=0;contacts.projectileHits=0;contacts.meleeCalls=0;contacts.history.length=0;
      specialPrelude = null;
      completedRound = null;
    }
  });
}
