// Championship Modern -- standalone application core.
//
// Owns the standalone game lifecycle: New Game, Continue, interaction, save,
// and restore-after-reload. Deliberately DOM-free so the whole loop is testable
// without a browser; main.js is the thin browser shell on top of it.
//
// The only durable write is the standalone Championship 2026 save key.

import { createChampionshipR2Session } from "../r2/createChampionshipR2Session.js";
import { createChampionshipSavePortR2 } from "../kernel/ChampionshipSavePortR2.js";
import {
  deserializeRaisingHomeSaveR2,
  restoreRaisingHomeSnapshotR2,
  stageRaisingResidentRelease
} from "../raising/raisingHomePersistenceR2.js";
import { RAISING_HOME_COMMANDS } from "../raising/raisingHomeDefinition.js";
import {
  assignCreatureToCage,
  createRaisingProductionState,
  normalizeRaisingProductionState,
  recordCareInteraction,
  recordCapturedCardCreature,
  recordNativeGiftCreature,
  releaseRaisingMembership,
  normalizeProductGivenName,
  renameEnclosedCreature
} from "./championshipRaisingProduction.js";
import { createChampionshipPersistentSavePort } from "./ChampionshipPersistentSavePort.js";
import {battlePartyAdmission,battlePartyCondition,buildOwnedBattleCreature} from '../battle/battleParty.js';
import {normalizeNativeIndividualProfile} from '../raising/nativeIndividualProfile.js';
import { selectPhase1FirstCreature } from "./phase1ProductCreatures.js";
import { CHAMPIONSHIP_SCREENS, createChampionshipScreenStack } from "./championshipScreenStack.js";
import { getChampionshipGate, listChampionshipGates } from "../gate/gateCatalog.js";
import { gateAdmission, isGateUnlocked } from "../gate/gateAdmission.js";
import { createHuntWorld } from "../hunt/huntWorld.js";
import { createHuntRuntime } from "../hunt/huntRuntime.js";
import { prepareNativeHuntEntry } from "../hunt/capture/nativeHuntEntryTransaction.js";
import { applyNativeHuntReturn } from "../hunt/capture/nativeHuntHistory.js";
import { nativeHuntCatalogForBiome, nativeHuntSpeciesByIndex } from "../hunt/capture/nativeHuntSources.js";
import { nativeIndividualProfile } from "../raising/nativeIndividualProfile.js";
import { createNativeRaisingStarter } from "../raising/nativeRaisingStarter.js";
import {createNativeHuntIndividual} from '../hunt/capture/nativeHuntIndividual.js';
import {createNativeRaisingMessages,normalizeNativeRaisingMessages,selectNativeMorningMessages,enqueueNativeRaisingMessage,
  ageNativeRaisingMessages,openNativeRaisingMessage,closeNativeRaisingMessage,nativeRaisingMessageEffect} from '../raising/nativeRaisingMessages.js';
import {normalizeNativeOpening} from './nativeOpeningState.js';
import {nativeTreatmentAdmission} from '../raising/nativeRaisingTreatment.js';
import {treatNativeRaisingActor,notifyNativeRaisingResidentAdded} from '../raising/nativeRaisingActor.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,interruptNativeRaisingFeeding,removeNativeRaisingFoodTarget,projectNativeRaisingActor,stepNativeRaisingActor,stepNativeRaisingAgeClock,touchNativeRaisingEgg,wakeNativeRaisingActor,startNativeRaisingMorning,stepNativeRaisingEvolution,enterNativeRaisingCage} from "../raising/nativeRaisingActor.js";
import {createNativeRaisingGround,nativeRaisingSpawnPosition,nativeRaisingEntryPosition} from "../raising/nativeRaisingGround.js";
import {createNativeRaisingFood,stepNativeRaisingFood,foodVisualQuarter,nativeRaisingFeast} from "../raising/nativeRaisingFood.js";
import {normalizeNativeRaisingHome,nativeRaisingRebuiltListOrder} from "../raising/nativeRaisingHomeState.js";
import {allocateNativeRaisingWaste} from '../raising/nativeRaisingWaste.js';
import {projectNativeRaisingCalendar} from '../raising/nativeRaisingCalendar.js';
import {createNativeTitleProgress,emptyNativeTitleProgress,normalizeNativeTitleProgress,
  toggleNativeTitleRegistration,toggleNativeChampionshipRegistration,resolveNativeTitleResult} from '../battle/nativeTitleProgression.js';
import {settleNativeRaisingCage,nativeCageConditionEffects} from '../raising/nativeRaisingOvernight.js';
import { maxGFromInventory } from "../hunt/capture/memoryCardCapacity.js";
import { createHuntInventory } from "../hunt/loadout/huntInventory.js";
import { createHuntLoadout } from "../hunt/loadout/huntLoadoutRuntime.js";
import { HUNT_STARTING_INVENTORY } from "../hunt/loadout/huntEquipmentCatalog.js";
import {
  applyMappedHuntInventoryFromShop,
  createShopRuntime
} from "../shop/shopRuntime.js";
import { projectDatabase } from "../database/databaseRuntime.js";
import { getDatabaseSlot } from "../database/databaseCatalog.js";
import { registerNativeBookSpecies, retainOwnedBookSpecies } from "../database/nativeBookRegistration.js";
import { createCageEditRuntime } from "../cage/cageEditRuntime.js";
import { normalizeTamerRank, slotCountForTamerRank } from "../cage/cageCatalog.js";
import { validateNativeRanch } from '../cage/nativeRanchLayout.js';
import { getMatchRecord, matchEntryFee, matchPayout, resolveMatchList } from "../battle/battleMatchSelection.js";
import { DAY_END_MINUTES, projectWorldClockDisplay } from "../time/championshipWorldClock.js";
import { NATIVE_CLOCK_CADENCE } from "./championshipClockDriver.js";
import { createClockChannelRng, restoreChannelRng } from "../battle/battleRngChannel.js";
import { createNativeHuntPersistentState, projectNativeHuntPersistentSave,
  restoreNativeHuntPersistentSave } from "../hunt/capture/nativeHuntPersistentState.js";
import {
  createRaisingInstanceIdentityState,
  normalizeRaisingInstanceIdentityState,
  listRaisingInstances,
  resolveRaisingInstance,
  allocateRaisingInstanceIdentity
} from "../raising/raisingInstanceIdentity.js";
import {
  createBattleEconomyState,
  normalizeBattleEconomyState,
  nextBattleAttemptId,
  beginBattleAttempt,
  settleBattleAttempt,
  abandonBattleAttempt
} from "../battle/battleEconomyTransaction.js";

export const STANDALONE_SESSION_ID = "championship-modern-home";
export const STANDALONE_SLOT_ID = "raising-home";

// Copy for the standalone build. The R2 defaults say "in memory ... this page
// session", which is true of the research port and false here: this save
// survives a reload.
export const STANDALONE_SAVE_PHASE_COPY = Object.freeze({
  DIRTY: "Unsaved changes. Save to keep them after you close the game.",
  CLEAN: "Your saved game matches what is on screen.",
  SAVED: "Saved. This game will still be here after you close and reopen it.",
  RESTORED: "Restored from your saved game.",
  RECOVERED: "Recovered your last good saved game.",
  DISPOSED: "This session is closed."
});
export const STANDALONE_SAVE_UNAVAILABLE_COPY = "Save status is unavailable.";

export function createChampionshipStandaloneApp({
  storage,
  locks = globalThis.navigator?.locks,
  catalog,
  cages = [],
  sessionId = STANDALONE_SESSION_ID,
  slotId = STANDALONE_SLOT_ID,
  huntStartingInventory = HUNT_STARTING_INVENTORY,
  huntCaptureReplay = null,
  huntRuntimeFactory = createHuntRuntime,
  rngClock = () => {
    const date = new Date();
    return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
  },
  now = () => new Date().toISOString(),
  deviceBirthday = () => null
} = {}) {
  if (!catalog) throw new TypeError("Championship standalone app requires a product entities catalog");
  const savePort = createChampionshipPersistentSavePort({ storage, now, locks });

  const cageIds = cages.map((cage) => cage.cageId);
  let session = null;
  let creature = null;
  let revision = 0;
  let interactionCount = 0;
  // Production Raising state. Owned here, never by the frozen R2 reducer.
  let raising = null;
  let selectedCreatureId = null;
  const raisingActors = new Map();
  let raisingGround=null;
  let raisingFoods=[];
  let raisingWaste=[];
  let raisingDayTransition=null;
  let raisingDayConfirmation=false;
  let raisingLifecycleMessage=null;
  const raisingDirtySignals=new Map();
  let raisingPoolSlots={};
  const raisingListeners = new Set();
  let raisingAgeRemainder = 0;
  let instanceIdentity = null;
  let battleEconomy = createBattleEconomyState();
  let battleTransactionActive = false;
  let battlePartyIds = null;
  const battleRngPreparations = new WeakMap();
  let huntCommitActive = false;
  // One application-owned sequence. Expedition resets never replace it.
  // Legacy saves lack history: initialize on the first native RNG use only.
  let gameplayRng = null;
  // Durable history belongs to the same application as RNG and Raising. It is
  // independent of the transient expedition and never reconstructed from art.
  let huntPersistentState = null;

  function gameplayRngSnapshot() {
    return gameplayRng ? { version: 1, ...gameplayRng.snapshot() } : null;
  }

  function nextGameplayRandom(channel) {
    requireSession();
    if (huntCommitActive) throw new Error("CHAMPIONSHIP_RNG_WHILE_HUNT_COMMIT_ACTIVE");
    // Validate before even reading the clock, so rejected requests do not
    // initialize or mutate the durable sequence.
    if (!Number.isInteger(channel) || channel < 0 || channel >= 217) {
      throw new RangeError("CHAMPIONSHIP_RNG_CHANNEL_OUT_OF_RANGE");
    }
    if (!gameplayRng) gameplayRng = createClockChannelRng(rngClock());
    const value = gameplayRng.next(channel);
    savePort.markDirty();
    return value;
  }

  // Expedition state stays session-scoped. Original history/modifiers above
  // have their own verified durable projection; Gate choice, field positions
  // and live individuals do not survive a reload.
  const screens = createChampionshipScreenStack({ initial: CHAMPIONSHIP_SCREENS.RAISING_HOME });
  let selectedGateId = null;
  let confirmedGateId = null;
  let huntRuntime = null;
  let huntDeadlineMinute = null;
  let huntEntryError = null;
  // The Shop owns the inventory; the loadout only reads it.
  let huntInventory = null;
  let huntLoadout = null;
  let shop = null;
  let lastShopReceipt = null;
  let selectedDatabaseSpeciesIndex = null;
  let cageEdit = null;
  // Original PlayerData +0xAE8. Title matches write it; until battle exists this
  // is a PRODUCT_AUTHORED seam (setTamerRank), same shape as creditBits.
  let tamerRankValue = 0;
  let battleBadgesValue = [];
  let nativeTitles=emptyNativeTitleProgress();
  let nativeMessages=createNativeRaisingMessages();
  let nativeOpening=null;
  let registeredSpeciesValue = Object.freeze([]);
  // Snapshot of the last enclosed wild, for Hunt Result. Session-scoped: the
  // durable write is the raising.collection entry, not this screen payload.
  let huntResult = null;
  const screenListeners = new Set();
  const shopListeners = new Set();
  let shopRuntimeUnsubscribe = null;

  function speciesDisplayName(speciesId) {
    const slug = String(speciesId ?? "").split(":").pop() || "creature";
    return slug.replace(/-/g, " ").toUpperCase();
  }

  function publishScreens() {
    for (const listener of [...screenListeners]) {
      try { listener(screens.current()); } catch { /* observers never break navigation */ }
    }
  }

  /** Drop every expedition choice and leave the player at Raising Home. */
  function resetExpedition() {
    huntRuntime = null;
    huntDeadlineMinute = null;
    huntEntryError = null;
    huntLoadout = null;
    huntResult = null;
    selectedGateId = null;
    confirmedGateId = null;
    if (screens.canExit()) screens.exit();
    else while (screens.canGoBack()) screens.back();
  }

  function requireShop() {
    if (!shop) throw new Error("CHAMPIONSHIP_SHOP_NOT_OPEN");
    return shop;
  }

  function bindShopRuntime() {
    shopRuntimeUnsubscribe?.();
    shopRuntimeUnsubscribe = shop.subscribe(() => {
      for (const listener of [...shopListeners]) {
        try { listener(shop.getFrame()); } catch { /* observers never break the shop */ }
      }
    });
  }

  function shopCageOwned() {
    return shop?.toSave()?.cageOwned ?? [];
  }

  function tamerRank() {
    return tamerRankValue;
  }

  function progressionContext() {
    return { tamerRank: tamerRankValue, battleBadges: [...battleBadgesValue],feeWaiver:nativeTitles.feeWaiver };
  }

  function applyProgression() {
    const progression = progressionContext();
    shop?.setProgression(progression);
    huntInventory?.setProgression(progression);
  }

  function cageEditArgs() {
    return [shopCageOwned(), tamerRank()];
  }

  function requireCageEdit() {
    if (!cageEdit) throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_OPEN");
    return cageEdit;
  }

  function openShopAndHunt({ shopSnapshot = null } = {}) {
    lastShopReceipt = null;
    const progression = progressionContext();
    if (shopSnapshot) {
      // Continue: Shop snapshot is the inventory authority. Hunt starts empty
      // and receives only the mapped SKUs the Shop currently owns.
      huntInventory = createHuntInventory({ entries: [], ...progression });
      shop = createShopRuntime({ huntInventory, snapshot: shopSnapshot, progression });
      applyMappedHuntInventoryFromShop(shop, huntInventory);
    } else {
      huntInventory = createHuntInventory({ entries: huntStartingInventory, ...progression });
      // Custom starting inventories are a controlled fixture seam. Seed the
      // same Shop authority that purchases, consumption and saves will use.
      shop = createShopRuntime({ huntInventory, progression, initialHuntInventory:huntInventory });
    }
    bindShopRuntime();
  }

  function requireLoadout() {
    if (!huntLoadout) throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
    return huntLoadout;
  }

  function requireSession() {
    if (!session) throw new Error("CHAMPIONSHIP_SESSION_NOT_OPEN");
    return session;
  }

  /** Seed a fresh in-memory R2 port with a restored snapshot, so the existing
   *  coordinator restore path -- savePort.readSnapshot() -> initialSnapshot --
   *  does the rehydration instead of a second, parallel one. */
  function seededRealmPort(restoredSnapshot) {
    const port = createChampionshipSavePortR2();
    port.issueWriterToken();
    const seeded = port.requestWrite({
      requestId: `${sessionId}:restore`,
      expectedRevision: 0,
      slotId,
      snapshot: restoredSnapshot
    });
    if (!seeded.accepted) throw new Error(`CHAMPIONSHIP_RESTORE_SEED_FAILED: ${seeded.code}`);
    return port;
  }

  async function openSession(realmPort) {
    const opened = createChampionshipR2Session({
      sessionId,
      raisingSavePort: realmPort,
      raisingSaveSlotId: slotId
    });
    await opened.open();
    session = opened;
    return opened;
  }

  /** Shared by dispatch() and endDay() so neither depends on `this`. */
  function dispatchRaisingHomeCommand(command) {
    if (huntCommitActive) return Object.freeze({ accepted: false, code: "HUNT_HOME_COMMIT_ACTIVE" });
    const active = requireSession();
    const snapshot = active.getRaisingHomeSnapshot();
    const publication = active.dispatchRaisingHome({
      ...command,
      commandId: command.commandId ?? `${sessionId}:${command.type}:${interactionCount + 1}`,
      expectedRevision: command.expectedRevision ?? snapshot.revision
    });
    if (publication?.accepted) interactionCount += 1;
    return publication;
  }

  function instanceSources() {
    const residents = session?.getRaisingHomeSnapshot().residents ?? [];
    return {
      creature: residents.some((entry) => entry.residentId === creature?.creatureId) ? creature : null,
      residents,
      collection: raising?.collection ?? [],
      assignments: raising?.assignments ?? {},
      interactions: raising?.interactions ?? {}
    };
  }

  function raisingNativeProfile(instanceId) {
    if(instanceId===creature?.creatureId && raising?.assignments[instanceId]) return creature.nativeProfile ?? null;
    return raising?.collection.find(entry=>entry.instanceId===instanceId)?.nativeProfile ?? null;
  }

  function publishRaising() {
    for(const listener of [...raisingListeners])try {listener();} catch { /* observers cannot change native state */ }
  }

  function writeRaisingNativeProfile(instanceId,profile,{markDirty=true}={}) {
    registeredSpeciesValue = registerNativeBookSpecies(registeredSpeciesValue, profile.fields["000"]);
    const speciesId=`species-${String(profile.fields["000"]).padStart(3,"0")}`;
    if(instanceId===creature?.creatureId) creature=Object.freeze({...creature,speciesId,nativeProfile:profile});
    else raising=Object.freeze({...raising,collection:Object.freeze(raising.collection.map(entry=>entry.instanceId===instanceId
      ? Object.freeze({...entry,speciesId,nativeProfile:profile}) : entry))});
    if(markDirty)savePort.markDirty();
  }

  function nativeRaisingActor(instanceId) {
    const profile=raisingNativeProfile(instanceId);
    if(!profile)return null;
    let actor=raisingActors.get(instanceId);
    if(!actor || actor.speciesIndex!==profile.fields["000"]) {
      const slot=raisingPoolSlots[instanceId]??listRaisingInstances(instanceSources()).findIndex(entry=>entry.instanceId===instanceId);
      actor=createNativeRaisingActor(profile,slot);raisingActors.set(instanceId,actor);
    }
    return actor;
  }

  function storeNativeRaisingHome() {
    if(!raisingGround)return;
    const foods=raisingFoods.filter(f=>f.present&&raisingGround.origin(f.cageDefinitionIndex)).map(f=>{
      const origin=raisingGround.origin(f.cageDefinitionIndex);
      return {slot:f.slot,cageDefinitionIndex:f.cageDefinitionIndex,localPositionQ12:f.positionQ12.map((n,i)=>n-origin[i]*4096),
        protein:f.protein,...(f.kind>=2?{kind:f.kind}:{}),remaining:f.remaining,freshness:f.freshness};
    });
    const waste=raisingWaste.filter(w=>w.present&&raisingGround.origin(w.cageDefinitionIndex)).map(w=>{
      const origin=raisingGround.origin(w.cageDefinitionIndex);return {slot:w.slot,speciesIndex:w.speciesIndex,cageDefinitionIndex:w.cageDefinitionIndex,
        localPositionQ12:w.positionQ12.map((n,i)=>n-origin[i]*4096)};});
    raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({version:1,poolSlots:raisingPoolSlots,foods,waste,
      evolutionBranches:raising.nativeHome?.evolutionBranches??[],
      ...(raising.nativeHome?.pendingOvernightMinutes!==undefined?{pendingOvernightMinutes:raising.nativeHome.pendingOvernightMinutes}:{})})});
  }

  function storeNativeRaisingPositions() {
    if(!raisingGround)return;
    for(const [id,actor] of raisingActors) {
      const current=raisingNativeProfile(id),origin=raisingGround.origin(actor.cageDefinitionIndex);
      if(!current||!origin||!actor.positionQ12)continue;
      const x=((actor.positionQ12[0]-origin[0]*4096)>>12)>>>0,y=((actor.positionQ12[1]-origin[1]*4096)>>12)>>>0;
      if(current.fields["014"]!==actor.cageDefinitionIndex||current.fields["1c0"]!==x||current.fields["1c4"]!==y) {
        const next=structuredClone(current);next.fields["014"]=actor.cageDefinitionIndex;next.fields["1c0"]=x;next.fields["1c4"]=y;
        writeRaisingNativeProfile(id,next);
      }
    }
  }

  function initializeNativeRaisingHome() {
    raisingGround=createNativeRaisingGround({...cageEdit.toSave(),unlockedCount:slotCountForTamerRank(tamerRankValue)});
    raisingFoods=[];raisingWaste=[];raisingDayTransition=null;raisingDayConfirmation=false;raisingLifecycleMessage=null;raisingDirtySignals.clear();raisingPoolSlots={...raising?.nativeHome?.poolSlots};
    if(!raisingGround)return;
    for(const f of raising.nativeHome?.foods??[]) {
      const origin=raisingGround.origin(f.cageDefinitionIndex);
      if(origin)raisingFoods.push(createNativeRaisingFood({...f,positionQ12:f.localPositionQ12.map((n,i)=>n+origin[i]*4096),restored:true}));
    }
    for(const w of raising.nativeHome?.waste??[]){const origin=raisingGround.origin(w.cageDefinitionIndex);
      if(origin)raisingWaste.push({...w,present:true,positionQ12:w.localPositionQ12.map((n,i)=>n+origin[i]*4096)});}
    if(raising.nativeHome?.pendingOvernightMinutes!==undefined)settleRaisingOvernight();
    else synchronizeNativeRaisingActors();
    storeNativeRaisingHome();
  }

  function spawnRaisingWaste(definition,speciesIndex,positionQ12) {
    const waste=allocateNativeRaisingWaste(raisingWaste,{speciesIndex,cageDefinitionIndex:definition,positionQ12});
    if(!waste)return false;raisingWaste=raisingWaste.filter(w=>w.present);raisingWaste.push(waste);
    raisingDirtySignals.set(definition,{dirtyAdded:true});savePort.markDirty();return true;
  }

  function settleRaisingOvernight() {
    const remaining=raising?.nativeHome?.pendingOvernightMinutes;
    if(!raisingGround||remaining===undefined)return;
    // 02083358 constructs all actors (including their new positions) before
    // 02083910 settles daylight and night. Cage pool record order is distinct
    // from screen slot order: the original start is definitions 35, 0, 1, 15.
    const rng={next:nextGameplayRandom};
    raisingActors.clear();synchronizeNativeRaisingActors({deferActivity:true});
    for(const food of raisingFoods){food.occupants.fill(null);food.positionQ12[2]=0;}
    for(const [minutes,night] of [[remaining,false],[540,true]]) {
      for(const placement of raisingGround.placements){
        const definition=placement.definitionIndex;
        const entries=nativeRaisingRebuiltListOrder([...raisingActors].filter(([,actor])=>actor.cageDefinitionIndex===definition).sort((a,b)=>a[1].poolSlot-b[1].poolSlot));
        const foods=nativeRaisingRebuiltListOrder(raisingFoods.filter(f=>f.present&&f.cageDefinitionIndex===definition).sort((a,b)=>a.slot-b.slot));
        const result=settleNativeRaisingCage(entries.map(([id])=>raisingNativeProfile(id)),{
          definition,minutes,night,foods,wasteCount:raisingWaste.filter(w=>w.present&&w.cageDefinitionIndex===definition).length,rng,
          effects:nativeCageConditionEffects(definition,requireSession().getRaisingHomeSnapshot().season),
          spawnWaste:species=>spawnRaisingWaste(definition,species,nativeRaisingSpawnPosition(raisingGround,definition,rng))});
        entries.forEach(([id],i)=>writeRaisingNativeProfile(id,result.profiles[i]));foods.forEach((food,i)=>Object.assign(food,result.foods[i]));
      }
    }
    for(const [id,actor] of [...raisingActors].sort((a,b)=>a[1].poolSlot-b[1].poolSlot)) {
      const profile=raisingNativeProfile(id);if(!profile)continue;
      const next=startNativeRaisingMorning(actor,profile,rng);if(next!==profile)writeRaisingNativeProfile(id,next);
    }
    const {pendingOvernightMinutes,...completedHome}=raising.nativeHome;
    raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome(completedHome)});
    raisingAgeRemainder=0;storeNativeRaisingHome();
  }

  function synchronizeNativeRaisingActors({deferActivity=false}={}) {
    if(!raisingGround)return;
    const ids=listRaisingInstances(instanceSources()).map(e=>e.instanceId),live=new Set(ids);
    for(const id of Object.keys(raisingPoolSlots))if(!live.has(id)) {
      const actor=raisingActors.get(id);if(actor)interruptNativeRaisingFeeding(actor,raisingFoods,{next:nextGameplayRandom});
      delete raisingPoolSlots[id];raisingActors.delete(id);
    }
    for(const id of ids.sort((a,b)=>(raisingPoolSlots[a]??16)-(raisingPoolSlots[b]??16))) {
      let profile=raisingNativeProfile(id);if(!profile)continue;
      if(raisingPoolSlots[id]===undefined) {
        const used=new Set(Object.values(raisingPoolSlots)),slot=Array.from({length:16},(_,i)=>i).find(i=>!used.has(i));
        if(slot===undefined)throw new Error("NATIVE_RAISING_POOL_FULL");raisingPoolSlots[id]=slot;
      }
      const actor=nativeRaisingActor(id);if(actor.positionQ12)continue;
      let definition=profile.fields["014"];
      if(!raisingGround.placement(definition)) {
        profile=structuredClone(profile);profile.fields["014"]=35;profile.fields["1c0"]=0;profile.fields["1c4"]=0;
        definition=35;writeRaisingNativeProfile(id,profile);
      }
      const origin=raisingGround.origin(definition),rng={next:nextGameplayRandom};
      const position=[(profile.fields["1c0"]|0)*4096+origin[0]*4096,(profile.fields["1c4"]|0)*4096+origin[1]*4096,0];
      // Initialize the per-slot RNG fields before the original source-grid
      // spawn. Hatch keeps the same body; adults entering Home select a point.
      actor.poolSlot=raisingPoolSlots[id];
      initializeNativeRaisingActor(actor,profile,position,definition,rng,
        actor.speciesIndex>=8||(profile.fields["1c0"]===0&&profile.fields["1c4"]===0)
          ? ()=>actor.speciesIndex>=8?nativeRaisingEntryPosition(raisingGround,definition,rng,actor.poolSlot)
            :nativeRaisingSpawnPosition(raisingGround,definition,rng):null,{deferActivity,
              onJoin:()=>notifyNativeRaisingResidentAdded(actor,raisingActors.values(),rng)});
    }
  }

  function advanceNativeRaising(frames,before) {
    synchronizeNativeRaisingActors();
    const ids=listRaisingInstances(instanceSources()).map(entry=>entry.instanceId);
    let priorMinutes=0,changed=false;
    for(let frame=1;frame<=frames;frame++) {
      const minutes=Math.floor((before.clockUnits+before.clockSubunits/1000+frame*NATIVE_CLOCK_CADENCE.elapsedUnitsPerFrame)/NATIVE_CLOCK_CADENCE.trainingDivisor);
      const age=stepNativeRaisingAgeClock(raisingAgeRemainder,minutes-priorMinutes);
      priorMinutes=minutes;raisingAgeRemainder=age.remainder;
      const signals=new Map();
      for(const food of raisingFoods) {
        const wasFresh=food.present&&food.freshness>0;
        const result=stepNativeRaisingFood(food,age.ageDelta);
        if(wasFresh&&food.freshness<=0)raisingDirtySignals.set(food.cageDefinitionIndex,{dirtyAdded:true});
        if(result.search||result.landed){const previous=signals.get(food.cageDefinitionIndex)??{};
          signals.set(food.cageDefinitionIndex,{search:previous.search||result.search,landed:previous.landed||result.landed});}
      }
      for(const id of ids.sort((a,b)=>raisingPoolSlots[a]-raisingPoolSlots[b])) {
        const actor=nativeRaisingActor(id);
        if(!actor)continue;
        const residents=[...raisingActors].filter(([,other])=>other.cageDefinitionIndex===actor.cageDefinitionIndex).sort((a,b)=>a[1].poolSlot-b[1].poolSlot);
        const result=stepNativeRaisingActor(actor,raisingNativeProfile(id),{ageDelta:age.ageDelta,rng:{next:nextGameplayRandom},
          feeding:raisingGround?{ground:raisingGround,foods:raisingFoods,signals,actors:raisingActors.values()}:null,
          lifecycle:raisingGround?{rank:Math.min(9,tamerRankValue),minute:before.clockMinutes+minutes,season:before.season,
            roster:[actor.speciesIndex,...ids.filter(other=>other!==id).map(other=>raisingNativeProfile(other).fields['000'])],
            residents:residents.map(([other])=>raisingNativeProfile(other)),wasteCount:raisingWaste.filter(w=>w.present&&w.cageDefinitionIndex===actor.cageDefinitionIndex).length,
            rottenFoodCount:raisingFoods.filter(f=>f.present&&f.cageDefinitionIndex===actor.cageDefinitionIndex&&f.freshness<=0).length,
            ...raisingDirtySignals.get(actor.cageDefinitionIndex),spawnWaste:(species,position)=>spawnRaisingWaste(actor.cageDefinitionIndex,species,position)}:null});
        if(result.changed) {writeRaisingNativeProfile(id,result.profile);changed=true;}
        if(result.evolutionStarted){publishRaising();return;}
      }
      raisingDirtySignals.clear();
    }
    if(raisingGround)storeNativeRaisingHome();
    if(changed)publishRaising();
  }

  function battleSchedule() {
    const snapshot = requireSession().getRaisingHomeSnapshot();
    if (!Number.isInteger(snapshot.season) || !Number.isInteger(snapshot.dayOfSeason)) return null;
    return Object.freeze({
      // Keep the current ordinary-list entry fixture. This is not the
      // untraced mapping of the four cube buttons to original modes.
      entryMode: 0,
      scheduleSlotA: snapshot.season,
      scheduleSlotB: snapshot.dayOfSeason,
      progressCounter: tamerRankValue
    });
  }

  function restoreCandidate(save) {
    const { document } = deserializeRaisingHomeSaveR2(save.raisingHome);
    const snapshot = restoreRaisingHomeSnapshotR2(document, { sessionId });
    const sources = {
      creature: snapshot.residents.some((entry) => entry.residentId === save.creature.creatureId) ? save.creature : null,
      residents: snapshot.residents,
      collection: save.raising?.collection ?? [],
      assignments: save.raising?.assignments ?? {},
      interactions: save.raising?.interactions ?? {}
    };
    // Validate raw identities before legacy normalization can discard a
    // duplicate collection entry, and before replacing an open session.
    listRaisingInstances(sources);
    const identity = normalizeRaisingInstanceIdentityState(save.instanceIdentity, sources);
    const production = normalizeRaisingProductionState(save.raising, {
      cageIds, creatureIds: snapshot.residents.map((resident) => resident.residentId)
    });
    const rng = save.gameplayRng === null ? null : restoreChannelRng(save.gameplayRng);
    const huntHistory = restoreNativeHuntPersistentSave(save.huntHistory);
    return { snapshot, identity, production, rng, huntHistory };
  }

  function applyBattleTransaction(result, individualResults=[], preparedRng=null) {
    if (!result.ok || result.duplicate) return result;
    const before = battleEconomy;
    const beforeCreature=creature,beforeRaising=raising,beforeRegistered=registeredSpeciesValue;
    const beforeRng=gameplayRng;
    const beforeBadges = battleBadgesValue;
    const beforeRank=tamerRankValue,beforeTitles=nativeTitles,beforeMessages=nativeMessages;
    const expectedBits = requireShop().getBits();
    // One rollback for both ways this can fail. The wallet is committed last, so
    // until it succeeds every one of these is still the pre-transaction value.
    const rollback = () => {
      battleEconomy = before;
      creature=beforeCreature;raising=beforeRaising;registeredSpeciesValue=beforeRegistered;
      gameplayRng=beforeRng;
      battleBadgesValue = beforeBadges;
      tamerRankValue=beforeRank;nativeTitles=beforeTitles;nativeMessages=beforeMessages;
    };
    battleTransactionActive = true;
    try {
      // Publish the wallet only after its matching transaction state exists.
      // A synchronous observer therefore sees one consistent app snapshot.
      battleEconomy = result.state;
      if(preparedRng)gameplayRng=preparedRng;
      for(const entry of individualResults)writeRaisingNativeProfile(entry.instanceId,entry.nativeProfile,{markDirty:false});
      if (result.receipt?.status === "SETTLED") {
        const r=resolveNativeTitleResult({rank:tamerRankValue,category:result.receipt.mode,matchIndex:result.receipt.matchIndex,
          won:battleBadgesValue,...nativeTitles,rounds:[result.receipt.won?1:0]});
        battleBadgesValue=[...r.won];tamerRankValue=r.rank;
        nativeTitles=normalizeNativeTitleProgress({...nativeTitles,registered:r.registered,championship:r.championship,feeWaiver:r.feeWaiver});
        if(r.rankNotice!==null)nativeMessages=enqueueNativeRaisingMessage(nativeMessages,r.rankNotice);
      }
      const committed = requireShop().applyBitsTransaction({ expectedBits, bits: result.wallet });
      if (!committed.ok) {
        rollback();
        return Object.freeze({ ok: false, reason: committed.reason });
      }
      if (battleBadgesValue !== beforeBadges) applyProgression();
      interactionCount += 1;
      savePort.markDirty();
      return result;
    } catch (error) {
      // The title/rank writers run between the economy state and the wallet
      // commit. A throw there used to leave the attempt settled with its payout
      // never credited -- the one shape of this transaction that loses a
      // player's prize. Unwind to the pre-transaction state and let the error
      // out unchanged; a caller that saw an exception must not also inherit a
      // half-applied match.
      rollback();
      throw error;
    } finally {
      battleTransactionActive = false;
    }
  }

  return Object.freeze({
    savePort,
    // Core consumers share this draw boundary; projections receive copies.
    nextGameplayRandom,
    getGameplayRngState: gameplayRngSnapshot,
    getHuntPersistentState: () => structuredClone(huntPersistentState),

    hasSave() {
      return savePort.read().present;
    },

    inspectSave() {
      return savePort.read();
    },

    getCreature() {
      return creature;
    },

    getSession() {
      return session;
    },

    getSnapshot() {
      return session ? session.getRaisingHomeSnapshot() : null;
    },

    getInteractionCount() {
      return interactionCount;
    },

    async newGame({trainerName=null,eggName=null}={}) {
      if (huntCommitActive) return null;
      const opening=trainerName===null?null:normalizeNativeOpening({version:1,trainerName:trainerName.trim(),tutorialStep:null});
      const givenName=eggName===null?null:normalizeProductGivenName(eggName);
      if(givenName!==null&&givenName.length>5)throw new TypeError('INVALID_NATIVE_OPENING_EGG_NAME');
      const initialRng = createClockChannelRng(rngClock());
      const initialHuntHistory = createNativeHuntPersistentState();
      if (session) await this.dispose();
      if(!await savePort.acquireSession())throw new Error('另一個分頁正在遊玩。請先關閉該分頁，再開始遊戲。');
      try {savePort.clear();}catch(error){await savePort.releaseSession();throw error;}
      const startingIdentity = selectPhase1FirstCreature(catalog);
      let nativeProfile = createNativeRaisingStarter(initialRng);
      if(givenName!==null)nativeProfile=Object.freeze({...nativeProfile,name:givenName});
      creature = Object.freeze({ ...startingIdentity, displayName:nativeProfile.name, nativeProfile });
      revision = 0;
      interactionCount = 0;
      tamerRankValue = 0;
      battleBadgesValue = [];
      nativeTitles=createNativeTitleProgress();
      nativeMessages=createNativeRaisingMessages();
      nativeOpening=opening;
      registeredSpeciesValue = Object.freeze([]);
      battleEconomy = createBattleEconomyState();
      gameplayRng = initialRng;
      huntPersistentState = initialHuntHistory;
      await openSession(createChampionshipSavePortR2());
      const creatureIds = session.getRaisingHomeSnapshot().residents.map((r) => r.residentId);
      raising = createRaisingProductionState({ cageIds, creatureIds });
      raisingActors.clear();raisingAgeRemainder=0;
      instanceIdentity = createRaisingInstanceIdentityState(instanceSources());
      selectedCreatureId = null;
      openShopAndHunt();
      cageEdit = createCageEditRuntime({ initializeOriginal: true });
      initializeNativeRaisingHome();
      selectedDatabaseSpeciesIndex = null;
      resetExpedition();
      return { creature, snapshot: session.getRaisingHomeSnapshot(), raising };
    },

    /** Restore a previously saved standalone game. Returns null when there is
     *  nothing loadable, so the shell can fall back to New Game rather than
     *  stranding the player on an error. */
    /**
     * Whether the stored save can actually be opened.
     *
     * `savePort.read()` reports `present` for anything that deserializes as JSON,
     * which is a weaker test than the R2 layer applies: a save written before a
     * schema change can be present and still be rejected by
     * restoreRaisingHomeSnapshotR2. Offering Continue on `present` alone therefore
     * enables a button that is guaranteed to fail. This dry-runs the same restore
     * the real load performs, changing no state, so the title screen can tell the
     * truth about what the button will do.
     */
    canContinue() {
      const read = savePort.read();
      if (!read.present) return Object.freeze({ loadable: false, reason: read.error ?? null });
      try {
        restoreCandidate(read.save);
        return Object.freeze({ loadable: true, reason: null });
      } catch (error) {
        return Object.freeze({ loadable: false, reason: error.message });
      }
    },

    async continueGame() {
      if (huntCommitActive) return null;
      if(!await savePort.acquireSession())throw new Error('另一個分頁正在遊玩。請先關閉該分頁，再繼續遊戲。');
      const read = savePort.read({adopt:true});
      if (!read.present) {if(!session)await savePort.releaseSession();return null;}
      let candidate;
      try {candidate=restoreCandidate(read.save);}catch(error){if(!session)await savePort.releaseSession();throw error;}
      if (session) {
        const closing=session;session=null;await closing.dispose();
        battlePartyIds=null;
      }
      creature = Object.freeze({ ...read.save.creature });
      revision = read.save.progression.revision ?? 0;
      interactionCount = read.save.progression.interactionCount ?? 0;
      tamerRankValue = normalizeTamerRank(read.save.progression.tamerRank);
      battleBadgesValue = [...read.save.progression.battleBadges];
      nativeTitles=normalizeNativeTitleProgress(read.save.progression.nativeTitles)??emptyNativeTitleProgress();
      nativeMessages=normalizeNativeRaisingMessages(read.save.progression.nativeMessages)??createNativeRaisingMessages();
      nativeOpening=normalizeNativeOpening(read.save.progression.nativeOpening);
      registeredSpeciesValue = Object.freeze([...read.save.progression.registeredSpecies]);
      battleEconomy = normalizeBattleEconomyState(read.save.battleEconomy);
      gameplayRng = candidate.rng;
      huntPersistentState = candidate.huntHistory;
      await openSession(seededRealmPort(candidate.snapshot));
      raising = candidate.production;
      raisingActors.clear();raisingAgeRemainder=0;
      instanceIdentity = candidate.identity;
      selectedCreatureId = null;
      openShopAndHunt({ shopSnapshot: read.save.shop });
      cageEdit = createCageEditRuntime({ snapshot: read.save.cageEdit });
      initializeNativeRaisingHome();
      selectedDatabaseSpeciesIndex = null;
      resetExpedition();
      return { creature, snapshot: session.getRaisingHomeSnapshot(), save: read.save, raising };
    },

    dispatch(command) {
      return dispatchRaisingHomeCommand(command);
    },

    getRaisingState() {
      return raising;
    },

    getRaisingActorFrame(instanceId) {
      const actor=nativeRaisingActor(instanceId);
      return actor ? projectNativeRaisingActor(actor) : null;
    },

    getRaisingFoodFrame() {
      return Object.freeze(raisingFoods.filter(f=>f.present).map(f=>Object.freeze({slot:f.slot,cageDefinitionIndex:f.cageDefinitionIndex,
        positionQ12:Object.freeze([...f.positionQ12]),heightQ12:f.heightQ12,protein:f.protein,kind:f.kind,remaining:f.remaining,
        freshness:f.freshness,quarter:foodVisualQuarter(f)})));
    },

    getRaisingWasteFrame(){return Object.freeze(raisingWaste.filter(w=>w.present).map(w=>Object.freeze({slot:w.slot,speciesIndex:w.speciesIndex,cageDefinitionIndex:w.cageDefinitionIndex,present:true,positionQ12:Object.freeze([...w.positionQ12])})));},
    getRaisingLifecycleFrame(){
      const evolving=[...raisingActors].find(([,actor])=>actor.evolution);
      return Object.freeze({confirmation:raisingDayConfirmation,day:raisingDayTransition?Object.freeze({...raisingDayTransition,
        calendar:projectNativeRaisingCalendar({...requireSession().getRaisingHomeSnapshot(),progressCounter:tamerRankValue,
          won:battleBadgesValue,registered:nativeTitles.registered,championship:nativeTitles.championship})}):null,
        evolution:evolving?Object.freeze({instanceId:evolving[0],...projectNativeRaisingActor(evolving[1]).evolution}):null,
        mailbox:nativeMessages,message:raisingLifecycleMessage});
    },
    hasRaisingPresentation(){return raisingDayConfirmation||raisingDayTransition!==null||nativeMessages.activeId!==null||[...raisingActors.values()].some(a=>a.evolution);},
    requestRaisingDayEnd(){
      if(this.hasRaisingPresentation()||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return false;
      raisingDayConfirmation=true;publishRaising();return true;
    },
    confirmRaisingDayEnd(accepted){
      if(!raisingDayConfirmation||typeof accepted!=='boolean')return false;
      raisingDayConfirmation=false;
      if(accepted)return this.endDay();
      publishRaising();return true;
    },
    advanceRaisingPresentation({frames}={}) {
      if(!Number.isInteger(frames)||frames<0||frames>120)throw new TypeError('INVALID_RAISING_PRESENTATION_FRAMES');
      if(raisingDayTransition){for(let i=0;i<frames&&raisingDayTransition;i++){
        if(raisingDayTransition.phase==='calendar'||(raisingDayTransition.phase==='saving'&&raisingDayTransition.savePhase==='SAVE_FAILED'))break;
        raisingDayTransition.frames++;
        if(raisingDayTransition.phase==='fade-out'&&raisingDayTransition.frames>=8){raisingDayTransition.phase='saving';raisingDayTransition.frames=0;const status=this.save();raisingDayTransition.savePhase=status.phase;}
        else if(raisingDayTransition.phase==='saving'&&raisingDayTransition.savePhase==='SAVED'){raisingDayTransition.phase='calendar-in';raisingDayTransition.frames=0;}
        else if(raisingDayTransition.phase==='calendar-in'&&raisingDayTransition.frames>=16){raisingDayTransition.phase='calendar';raisingDayTransition.frames=0;}
        else if(raisingDayTransition.phase==='calendar-out'&&raisingDayTransition.frames>=16){settleRaisingOvernight();raisingDayTransition.phase='fade-in';raisingDayTransition.frames=0;}
        else if(raisingDayTransition.phase==='fade-in'&&raisingDayTransition.frames>=8){raisingDayTransition=null;this.prepareMorningMessages();}
      }
        publishRaising();return true;
      }
      if(nativeMessages.activeId!==null){nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,activeFrames:Math.min(61,nativeMessages.activeFrames+frames)});publishRaising();return true;}
      const entry=[...raisingActors].find(([,actor])=>actor.evolution);if(!entry)return false;
      const [id,actor]=entry;
      for(let i=0;i<frames&&actor.evolution;i++){
        const result=stepNativeRaisingEvolution(actor,raisingNativeProfile(id),{next:nextGameplayRandom});
        if(result.changed)writeRaisingNativeProfile(id,result.profile);
        if(result.disappeared){
          const prior=requireSession().getRaisingHomeSnapshot();
          if(prior.residents.some(r=>r.residentId===id))requireSession().commitRaisingResidentRelease([id],prior.revision);
          raising=releaseRaisingMembership(raising,id);delete raisingPoolSlots[id];raisingActors.delete(id);
          if(selectedCreatureId===id)selectedCreatureId=null;
          raisingLifecycleMessage={kind:'DISAPPEARED',instanceId:id};storeNativeRaisingHome();savePort.markDirty();break;
        }
        if(result.evolved){const event=result.event;raisingLifecycleMessage={kind:event.target<8?'REBORN':'EVOLVED',instanceId:id,target:event.target};
          if(event.target>=8&&!event.inherited){const branches=[...new Set([...(raising.nativeHome?.evolutionBranches??[]),(event.oldSpecies-8)*5+event.index])];
            raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,evolutionBranches:branches})});}
          savePort.markDirty();}
      }
      publishRaising();return true;
    },
    acknowledgeRaisingCalendar(){
      if(raisingDayTransition?.phase!=='calendar')return false;
      raisingDayTransition.phase='calendar-out';raisingDayTransition.frames=0;publishRaising();return true;
    },

    // OVL18 02119280..021192A0: settled ground determines native membership.
    // This binds position/membership only; training-module reaction/effect
    // programs after 021192A8 remain a separate lifecycle boundary.
    moveRaisingResidentToGround(instanceId,{x,y}={}) {
      if(this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||!raisingGround
        ||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>=raisingGround.pixelWidth)return false;
      const cage=raisingGround.cageAt(x,y),actor=raisingActors.get(instanceId);
      if(!cage||!actor?.positionQ12||raisingGround.readTerrain(Math.trunc(x/8),Math.trunc(y/8))===1)return false;
      const profile=raisingNativeProfile(instanceId);if(!profile)return false;
      if(actor.speciesIndex>=8){const woke=wakeNativeRaisingActor(actor,profile,raisingFoods,{next:nextGameplayRandom});if(woke)writeRaisingNativeProfile(instanceId,woke);
        else interruptNativeRaisingFeeding(actor,raisingFoods,{next:nextGameplayRandom});}
      const previousDefinition=actor.cageDefinitionIndex;
      actor.positionQ12=[Math.trunc(x)*4096,Math.trunc(y)*4096,0];actor.destinationQ12=[...actor.positionQ12];
      actor.cageDefinitionIndex=cage.definitionIndex;
      if(actor.speciesIndex>=8)writeRaisingNativeProfile(instanceId,enterNativeRaisingCage(actor,raisingNativeProfile(instanceId),{
        previousDefinition,ground:raisingGround,season:requireSession().getRaisingHomeSnapshot().season}, {next:nextGameplayRandom}));
      storeNativeRaisingPositions();storeNativeRaisingHome();interactionCount++;savePort.markDirty();publishRaising();return true;
    },

    treatRaisingResident(instanceId,kind) {
      if(this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||!raisingGround
        ||(kind!==0&&kind!==1))return Object.freeze({ok:false,reason:'HOME_REQUIRED'});
      const actor=raisingActors.get(instanceId),profile=raisingNativeProfile(instanceId);
      if(!actor||!profile)return Object.freeze({ok:false,reason:'UNKNOWN_RESIDENT'});
      const stock=requireShop().toSave().quantities[kind===0?3:2];
      const admission=nativeTreatmentAdmission({species:actor.speciesIndex,state:actor.state,condition:profile.fields[kind===0?'134':'138'],stock});
      if(!admission.dispatch)return Object.freeze({ok:false,reason:stock<1?'EMPTY':'EGG'});
      const result=treatNativeRaisingActor(actor,profile,kind,{foods:raisingFoods,ground:raisingGround,rng:{next:nextGameplayRandom}});
      if(result.profile!==profile)writeRaisingNativeProfile(instanceId,result.profile);
      // Commit the corresponding individual/reaction before inventory observers
      // run, so they cannot save a debited item with the old condition fields.
      if(admission.consume&&!shop.consumeRaisingMedicine(kind).ok)throw new Error('RAISING_MEDICINE_INVENTORY_DRIFT');
      if(result.applied||admission.consume){interactionCount++;savePort.markDirty();publishRaising();}
      return Object.freeze({ok:true,consumed:admission.consume,applied:result.applied,success:result.success});
    },

    cleanRaisingFood({x,y}={}) {
      if(this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||!Number.isFinite(x)||!Number.isFinite(y))return false;
      // 02121308 and live body +5A: inclusive native box [-6,-19,10,5].
      const waste=raisingWaste.find(w=>w.present&&x>=(w.positionQ12[0]>>12)-6&&x<=(w.positionQ12[0]>>12)+10&&y>=(w.positionQ12[1]>>12)-19&&y<=(w.positionQ12[1]>>12)+5);
      if(waste){waste.present=false;raisingDirtySignals.set(waste.cageDefinitionIndex,{dirtyRemoved:true});storeNativeRaisingHome();interactionCount++;savePort.markDirty();publishRaising();return true;}
      const food=raisingFoods.find(f=>f.present&&x>=(f.positionQ12[0]>>12)-15&&x<=(f.positionQ12[0]>>12)+17
        &&y>=(f.positionQ12[1]>>12)-19&&y<=(f.positionQ12[1]>>12)+5);
      if(!food)return false;
      food.present=false;
      if(food.freshness<=0)raisingDirtySignals.set(food.cageDefinitionIndex,{dirtyRemoved:true});
      for(const actor of raisingActors.values())if(actor.foodSlot===food.slot)removeNativeRaisingFoodTarget(actor,raisingFoods,{next:nextGameplayRandom});
      storeNativeRaisingHome();interactionCount++;savePort.markDirty();publishRaising();return true;
    },

    placeRaisingFood({x,y,protein=false}={}) {
      if(this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return Object.freeze({ok:false,reason:"HOME_REQUIRED"});
      if(!raisingGround)return Object.freeze({ok:false,reason:"NATIVE_RANCH_REQUIRED"});
      if(!Number.isFinite(x)||!Number.isFinite(y)||typeof protein!=="boolean"||x<0||x>=raisingGround.pixelWidth)return Object.freeze({ok:false,reason:"INVALID_POSITION"});
      const cage=raisingGround.cageAt(x,y);
      if(!cage||raisingGround.readTerrain(Math.trunc(x/8),Math.trunc(y/8))===1)return Object.freeze({ok:false,reason:"INVALID_GROUND"});
      // Food's native touch box is inclusive; a touch already on an object
      // cannot place a second object or consume another inventory unit.
      const px=Math.trunc(x),py=Math.trunc(y);
      if(raisingFoods.some(f=>f.present&&f.cageDefinitionIndex===cage.definitionIndex&&px>=(f.positionQ12[0]>>12)-15&&px<=(f.positionQ12[0]>>12)+17
        &&py>=(f.positionQ12[1]>>12)-19&&py<=(f.positionQ12[1]>>12)+5))return Object.freeze({ok:false,reason:"FOOD_AT_POINT"});
      const used=new Set(raisingFoods.filter(f=>f.present).map(f=>f.slot)),slot=Array.from({length:10},(_,i)=>i).find(i=>!used.has(i));
      if(slot===undefined)return Object.freeze({ok:false,reason:"FOOD_POOL_FULL"});
      if(requireShop().toSave().quantities[protein?1:0]<1)return Object.freeze({ok:false,reason:"EMPTY"});
      const food=createNativeRaisingFood({slot,cageDefinitionIndex:cage.definitionIndex,positionQ12:[px*4096,py*4096,0],protein});
      raisingFoods=raisingFoods.filter(f=>f.present);raisingFoods.push(food);storeNativeRaisingHome();
      const consumed=shop.consumeRaisingFood(protein);
      if(!consumed.ok)throw new Error("RAISING_FOOD_INVENTORY_DRIFT");
      interactionCount++;savePort.markDirty();publishRaising();
      return Object.freeze({ok:true,slot,owned:consumed.owned});
    },

    subscribeRaising(listener) {
      if(typeof listener!=="function")throw new TypeError("RAISING_LISTENER_REQUIRED");
      raisingListeners.add(listener);return ()=>raisingListeners.delete(listener);
    },

    touchRaisingEgg(instanceId) {
      if(huntCommitActive || screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return false;
      const actor=nativeRaisingActor(instanceId);
      return actor ? touchNativeRaisingEgg(actor) : false;
    },

    getInstanceIdentityState() { return instanceIdentity; },

    getRaisingInstances() {
      requireSession();
      return listRaisingInstances(instanceSources());
    },

    resolveRaisingInstance(instanceId) {
      requireSession();
      return resolveRaisingInstance(instanceSources(), instanceId);
    },

    getCalendar() {
      const snapshot = requireSession().getRaisingHomeSnapshot();
      return projectWorldClockDisplay(snapshot);
    },

    getBattleSchedule() { return battleSchedule(); },

    getTitleProgress(){return Object.freeze({...nativeTitles,rank:tamerRankValue,won:Object.freeze([...battleBadgesValue])});},
    getRaisingMailbox(){return nativeMessages;},
    getOpeningState(){return nativeOpening;},
    deliverRaisingFeast(){
      if(!nativeMessages.cake||nativeMessages.activeId!==null||raisingDayTransition||!raisingGround)return false;
      for(const [kind,height] of nativeRaisingFeast(nativeMessages.cake)){
        const used=new Set(raisingFoods.filter(f=>f.present).map(f=>f.slot));
        const slot=Array.from({length:6},(_,i)=>i+10).find(i=>!used.has(i));
        if(slot===undefined)continue;
        const positionQ12=nativeRaisingSpawnPosition(raisingGround,35,{next:nextGameplayRandom});
        raisingFoods.push(createNativeRaisingFood({slot,cageDefinitionIndex:35,positionQ12,kind,heightQ12:height*4096}));
      }
      nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,cake:0});storeNativeRaisingHome();savePort.markDirty();publishRaising();return true;
    },
    prepareMorningMessages(){
      if(!nativeMessages.morningPending)return false;
      const c=this.getCalendar(),roster=this.getRaisingInstances(),birthday=deviceBirthday(),date=new Date(now());
      const match=!!birthday&&birthday.month===date.getMonth()+1&&birthday.day===date.getDate();
      const selection=selectNativeMorningMessages({...c,cursor:nativeMessages.cursor,birthday:match,
        birthdayClaimed:nativeMessages.birthdayClaimed,rosterCount:roster.length},{next:nextGameplayRandom});
      nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,cursor:selection.cursor,morningPending:false});
      for(const id of selection.ids)nativeMessages=enqueueNativeRaisingMessage(nativeMessages,id,{subjectName:selection.selected===null?'':raisingNativeProfile(roster[selection.selected].instanceId)?.name??''});
      savePort.markDirty();publishRaising();return true;
    },
    openRaisingMail(){
      if(raisingDayTransition||raisingDayConfirmation||[...raisingActors.values()].some(a=>a.evolution))return false;
      nativeMessages=openNativeRaisingMessage(nativeMessages);
      const q=nativeMessages.queue.find(q=>q.id===nativeMessages.activeId);
      if(!q)return false;
      // Money is applied when the original opens the letter (0208CED4),
      // inventory/individual effects follow its acknowledgement.
      const effect=nativeRaisingMessageEffect(q.effectId);
      if(!q.effectApplied&&effect?.kind===4){
        const amount=effect.extra?effect.value+Math.trunc((effect.extra-effect.value)*nextGameplayRandom(199)/102):effect.value;
        nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,queue:nativeMessages.queue.map(n=>n.id===q.id?{...n,effectApplied:true}:n)});
        requireShop().creditBits(amount,{evidence:'ROM_VERIFIED'});
      }
      savePort.markDirty();publishRaising();return true;
    },
    acknowledgeRaisingMail(){
      const q=nativeMessages.queue.find(q=>q.id===nativeMessages.activeId);
      if(!q||(!q.system&&nativeMessages.activeFrames<61))return false;
      const effect=nativeRaisingMessageEffect(q.effectId);
      if(!q.effectApplied&&effect){
        if(effect.kind===3)requireShop().receiveNativeGift(effect.value,effect.extra);
        else if(effect.kind===2){
          if(this.getRaisingInstances().length>=16)return false;
          const profile=nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(effect.value),rng:{next:nextGameplayRandom}}));
          const allocation=allocateRaisingInstanceIdentity(instanceIdentity,instanceSources());
          raising=recordNativeGiftCreature(raising,{instanceId:allocation.instanceId,speciesId:`species-${String(effect.value).padStart(3,'0')}`,
            displayName:profile.name,enclosedAt:now(),cageId:cageIds[0],nativeProfile:profile});
          instanceIdentity=allocation.state;synchronizeNativeRaisingActors();
          registeredSpeciesValue=retainOwnedBookSpecies(registeredSpeciesValue,creature,raising.collection);
        }else if(effect.kind===5)nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,cake:effect.value});
      }
      nativeMessages=closeNativeRaisingMessage(nativeMessages);savePort.markDirty();publishRaising();return true;
    },
    toggleTitleRegistration(recordIndex){
      if(screens.current()!==CHAMPIONSHIP_SCREENS.SCHEDULE||battleTransactionActive)return false;
      const next=toggleNativeTitleRegistration(nativeTitles,{recordIndex,rank:tamerRankValue,won:battleBadgesValue});
      if(!next)return false;nativeTitles=next;interactionCount++;savePort.markDirty();return true;
    },
    toggleChampionshipRegistration(){
      if(screens.current()!==CHAMPIONSHIP_SCREENS.SCHEDULE||battleTransactionActive)return false;
      const next=toggleNativeChampionshipRegistration(nativeTitles,this.getCalendar().year);
      if(!next)return false;nativeTitles=next;interactionCount++;savePort.markDirty();return true;
    },

    getAvailableBattleRecordIndices() {
      const schedule = battleSchedule();
      return schedule ? resolveMatchList(schedule).records : Object.freeze([]);
    },

    // A narrow pure-clock seam, not a raising action. It consumes no player
    // command IDs and never invokes the old ADVANCE resident side effects.
    advanceClock({ units, subunits = 0, divisor = 400, clearElapsed = false, expectedClockRevision } = {}) {
      if (huntCommitActive) return Object.freeze({ accepted: false, code: "HUNT_HOME_COMMIT_ACTIVE" });
      const active = requireSession();
      const before = active.getRaisingHomeSnapshot();
      const result = active.advanceRaisingClock({ units, subunits, divisor, clearElapsed,
        expectedClockRevision: expectedClockRevision ?? before.clockRevision });
      if (active.getRaisingHomeSnapshot() !== before) savePort.markDirty();
      return result;
    },

    getClockRunState() {
      if (!session) return Object.freeze({ running: false, reason: "NO_SESSION" });
      if(this.hasRaisingPresentation())return Object.freeze({running:false,reason:'RAISING_PRESENTATION'});
      const snapshot = session.getRaisingHomeSnapshot();
      if (snapshot.paused) return Object.freeze({ running: false, reason: "PAUSED" });
      if (snapshot.clockMinutes >= DAY_END_MINUTES) return Object.freeze({ running: false, reason: "DAY_END" });
      // OVL0 02116CB0 resumes normal Hunt (the tutorial mode 2 is separate).
      // 02116D28 stores min(entry minute + 8 hours, 22:00) in session+18.
      if (screens.current() === CHAMPIONSHIP_SCREENS.HUNT_FIELD && huntDeadlineMinute !== null) {
        return Object.freeze({ running: snapshot.clockMinutes < huntDeadlineMinute,
          reason: snapshot.clockMinutes < huntDeadlineMinute ? "NORMAL_HUNT" : "HUNT_TIME_UP" });
      }
      // Only normal Raising entry is mapped in this slice. Other screens and
      // modal identities have unresolved original session/handler conditions.
      if (screens.current() !== CHAMPIONSHIP_SCREENS.RAISING_HOME) {
        return Object.freeze({ running: false, reason: "MODE_REQUIRES_TRACE" });
      }
      return Object.freeze({ running: true, reason: "NORMAL_RAISING" });
    },

    settleNaturalRaisingDay() {
      if(screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||this.getClockRunState().reason!=='DAY_END')return false;
      // OVL18 0210D610 -> state 10 -> 0210FAFC. Reuse the existing calendar
      // command; overnight growth/evolution effects retain their own boundary.
      return this.endDay()?.accepted===true;
    },

    advanceNaturalClock({ frames } = {}) {
      if (!Number.isSafeInteger(frames) || frames < 0 || frames > 120) throw new TypeError("INVALID_NATIVE_CLOCK_FRAME_COUNT");
      const runState = this.getClockRunState();
      if (!runState.running || frames === 0) return Object.freeze({ accepted: false, code: runState.reason ?? "NO_ELAPSED_FRAMES" });
      const snapshot = requireSession().getRaisingHomeSnapshot();
      const inHunt = runState.reason === "NORMAL_HUNT";
      const divisor = inHunt ? 400 : NATIVE_CLOCK_CADENCE.trainingDivisor;
      const endMinute = inHunt ? huntDeadlineMinute : DAY_END_MINUTES;
      const remaining = (endMinute - snapshot.clockMinutes) * divisor
        - snapshot.clockUnits - snapshot.clockSubunits / 1000;
      // Original update first carries raw units into minutes, then checks 22
      // and calls stop (which clears the remainder). Even a restored raw
      // remainder above the Training divisor must receive its first update.
      const framesUntilStop = Math.max(1, Math.ceil(remaining / NATIVE_CLOCK_CADENCE.elapsedUnitsPerFrame));
      const activeFrames = Math.min(frames, framesUntilStop);
      if(!inHunt){let last={accepted:false,code:'NO_ELAPSED_FRAMES'};
        for(let i=0;i<activeFrames;i++){
          const beforeFrame=requireSession().getRaisingHomeSnapshot();
          last=this.advanceClock({units:NATIVE_CLOCK_CADENCE.elapsedUnitsPerFrame,divisor,clearElapsed:frames>=framesUntilStop&&i===activeFrames-1});
          if(last.accepted){advanceNativeRaising(1,beforeFrame);
            const c=this.getCalendar();nativeMessages=ageNativeRaisingMessages(nativeMessages,c.clockMinutes-beforeFrame.clockMinutes);
            if(nativeMessages.morningPending)this.prepareMorningMessages();
            this.deliverRaisingFeast();
            if(!nativeMessages.entryChecked&&c.clockMinutes>=420&&c.clockMinutes<900){
              const championship=c.season===2&&c.dayOfSeason===4&&nativeTitles.championship[c.year%4===3?'worldEntry':'entry'];
              const registered=this.getAvailableBattleRecordIndices().some(id=>nativeTitles.registered.includes(id)&&!battleBadgesValue.includes(id));
              if(championship||registered){nativeMessages=enqueueNativeRaisingMessage(nativeMessages,null,{system:true,textId:94,minutes:900-c.clockMinutes,required:false});}
              nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,entryChecked:true});
            }
            if(nativeMessages.queue.some(q=>q.system&&!q.opened)||(nativeMessages.activeId!==null&&nativeMessages.queue.some(q=>q.id===nativeMessages.activeId&&!q.opened)))this.openRaisingMail();
          }
          if(this.hasRaisingPresentation())break;
        }
        return last;
      }
      const result = this.advanceClock({ units: activeFrames * NATIVE_CLOCK_CADENCE.elapsedUnitsPerFrame,
        divisor, clearElapsed: frames >= framesUntilStop });
      if (inHunt) this.checkHuntDeadline();
      return result;
    },

    getSelectedCreatureId() {
      return selectedCreatureId;
    },

    getCages() {
      return cages;
    },

    /** Direct touch selection. Product-owned: it never reaches the R2 reducer. */
    select(creatureId) {
      if (huntCommitActive) return selectedCreatureId;
      if (creatureId !== null && !raising?.assignments[creatureId]) {
        throw new Error(`CHAMPIONSHIP_UNKNOWN_CREATURE: ${creatureId}`);
      }
      selectedCreatureId = creatureId;
      return selectedCreatureId;
    },

    /** Drag-and-drop relocation. No effect is applied, because none is verified. */
    moveToCage(creatureId, cageId) {
      if (huntCommitActive) throw new Error("HUNT_HOME_COMMIT_ACTIVE");
      raising = assignCreatureToCage(raising, creatureId, cageId, { cageIds });
      interactionCount += 1;
      savePort.markDirty();
      return raising;
    },

    /**
     * Use a care tool.
     *
     * Records a product-authored interaction flag and nothing else. The R2
     * `+14 satiety / +5 ease` numbers are adaptation-only (see
     * ORIGINAL_RAISING_GAMEPLAY_CONTRACT), so production mutates no stat and
     * invents no replacement number. The player gets a reaction, not arithmetic.
     */
    care(creatureId) {
      if (huntCommitActive) throw new Error("HUNT_HOME_COMMIT_ACTIVE");
      raising = recordCareInteraction(raising, creatureId, now());
      interactionCount += 1;
      savePort.markDirty();
      return raising;
    },

    /**
     * Close the calendar day.
     *
     * The original's Raising Home submenu carries an End Day entry, so a day can
     * be ended on demand rather than only running out. This goes through the R2
     * reducer like any other raising command; the clock cascade lives there.
     */
    endDay() {
      if(this.hasRaisingPresentation())return Object.freeze({accepted:false,code:'RAISING_PRESENTATION'});
      const before=requireSession().getRaisingHomeSnapshot();
      const result = dispatchRaisingHomeCommand({ type: RAISING_HOME_COMMANDS.END_DAY });
      if (result?.accepted){
        storeNativeRaisingPositions();storeNativeRaisingHome();
        if(raisingGround)raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,pendingOvernightMinutes:Math.max(0,1320-before.clockMinutes)})});
        nativeMessages=normalizeNativeRaisingMessages({...ageNativeRaisingMessages(nativeMessages,1440-before.clockMinutes+420),entryChecked:false,morningPending:true});
        raisingDayTransition={phase:'fade-out',frames:0,savePhase:null};savePort.markDirty();publishRaising();
      }
      return result;
    },

    save() {
      const active = requireSession();
      if (!creature) throw new Error("CHAMPIONSHIP_NO_CREATURE");
      if (battleTransactionActive || battleEconomy.active) throw new Error("CHAMPIONSHIP_SAVE_WHILE_BATTLE_ACTIVE");
      if (huntCommitActive) throw new Error("CHAMPIONSHIP_SAVE_WHILE_HUNT_COMMIT_ACTIVE");
      if (huntRuntime?.getOnCardEntries().length) throw new Error("CHAMPIONSHIP_SAVE_REQUIRES_CAPTURE_HOME_COMMIT");
      storeNativeRaisingPositions();storeNativeRaisingHome();
      revision += 1;
      const status=savePort.save({
        snapshot: active.getRaisingHomeSnapshot(),
        creature,
        sessionId,
        revision,
        interactionCount,
        tamerRank: tamerRankValue,
        battleBadges: battleBadgesValue,
        nativeTitles,
        nativeMessages,
        nativeOpening,
        registeredSpecies: registeredSpeciesValue,
        raising,
        shop: shop ? shop.toSave() : null,
        cageEdit: cageEdit ? cageEdit.toSave() : null,
        battleEconomy,
        instanceIdentity,
        gameplayRng: gameplayRngSnapshot(),
        huntHistory: projectNativeHuntPersistentSave(huntPersistentState)
      });
      if(raisingDayTransition?.phase==='saving'){raisingDayTransition.savePhase=status.phase;publishRaising();}
      return status;
    },

    // ---------------------------------------------------------------------
    // VS2 -- Gate Select, Hunt Loadout, Hunt Field
    // ---------------------------------------------------------------------

    getScreen() {
      return screens.current();
    },

    getScreenTrail() {
      return screens.trail();
    },

    subscribeScreen(listener) {
      if (typeof listener !== "function") throw new TypeError("A screen observer must be a function");
      screenListeners.add(listener);
      return () => screenListeners.delete(listener);
    },

    getGates() {
      return Object.freeze(listChampionshipGates().map(gate => Object.freeze({ ...gate,
        state: isGateUnlocked(gate, progressionContext()) ? "AVAILABLE" : "LOCKED" })));
    },

    getGateAdmission(gateId = confirmedGateId ?? selectedGateId) {
      return gateAdmission(getChampionshipGate(gateId), requireShop().getBits(), progressionContext());
    },

    getSelectedGateId() {
      return selectedGateId;
    },

    getConfirmedGate() {
      return confirmedGateId === null ? null : getChampionshipGate(confirmedGateId);
    },

    getHuntInventory() {
      return huntInventory;
    },

    getHuntLoadout() {
      return huntLoadout;
    },


    getHuntRuntime() {
      return huntRuntime;
    },

    getHuntEntryError() { return huntEntryError; },

    getHuntResult() {
      if (!huntResult?.pendingHomeCommit) return huntResult;
      const released = new Set(huntResult.releasedHomeIds ?? []);
      const rows = [
        ...(huntRuntime?.getOnCardEntries() ?? []).map((entry) => Object.freeze({
          key: `card:${entry.wildId}`, kind: "CARD", id: entry.wildId, speciesId: entry.speciesId,
          displayName: entry.displayName ?? speciesDisplayName(entry.speciesId), canRelease: true })),
        ...listRaisingInstances(instanceSources()).filter((entry) => !released.has(entry.instanceId)).map((entry) => Object.freeze({
          key: `home:${entry.instanceId}`, kind: "HOME", id: entry.instanceId, speciesId: entry.speciesId,
          displayName: entry.displayName ?? speciesDisplayName(entry.speciesId),
          canRelease: true }))
      ];
      return Object.freeze({ ...huntResult, rows: Object.freeze(rows),
        pendingRelease: rows.find((row) => row.key === huntResult.pendingReleaseKey) ?? null });
    },

    getShopFrame() {
      if (!shop) return null;
      return Object.freeze({ ...shop.getFrame(), lastReceipt: lastShopReceipt });
    },

    subscribeShop(listener) {
      if (typeof listener !== "function") throw new TypeError("A shop observer must be a function");
      shopListeners.add(listener);
      return () => shopListeners.delete(listener);
    },

    /** Explicit test / other income seam; battle settlement does not use it. */
    creditBits(amount) {
      if (battleTransactionActive) throw new Error("CHAMPIONSHIP_BATTLE_TRANSACTION_ACTIVE");
      if (huntCommitActive) throw new Error("CHAMPIONSHIP_HUNT_TRANSACTION_ACTIVE");
      const result = requireShop().creditBits(amount);
      savePort.markDirty();
      return result;
    },

    getTamerRank() {
      return tamerRankValue;
    },
    getBattleBadges() { return Object.freeze([...battleBadgesValue]); },

    /**
     * Write tamer rank. Original store is PlayerData +0xAE8 after battle result.
     * Until title matches exist this is the same PRODUCT_AUTHORED seam as creditBits.
     */
    setTamerRank(nextRank) {
      requireSession();
      if (huntCommitActive) throw new Error("CHAMPIONSHIP_HUNT_TRANSACTION_ACTIVE");
      if (!Number.isSafeInteger(nextRank) || nextRank < 0) {
        throw new Error("INVALID_TAMER_RANK");
      }
      const previousRank = tamerRankValue;
      const ranch = this.getCageEditFrame();
      if (ranch?.layoutVersion && (!validateNativeRanch(ranch.placements, slotCountForTamerRank(nextRank))
        || !validateNativeRanch(cageEdit.toSave().placements, slotCountForTamerRank(nextRank)))) return previousRank;
      tamerRankValue = normalizeTamerRank(nextRank);
      applyProgression();
      if (tamerRankValue !== previousRank) savePort.markDirty();
      publishScreens();
      return tamerRankValue;
    },

    openShop() {
      requireSession();
      requireShop();
      if (screens.current() === CHAMPIONSHIP_SCREENS.SHOP) return screens.current();
      lastShopReceipt = null;
      // OVL18 exit and OVL17 entry both call the shared clock stop routine.
      if (screens.current() === CHAMPIONSHIP_SCREENS.RAISING_HOME) this.advanceClock({ units: 0, clearElapsed: true });
      screens.enter(CHAMPIONSHIP_SCREENS.SHOP);
      publishScreens();
      return screens.current();
    },

    buyShopItem(shopRecordIndex, quantity = 1) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.SHOP) {
        throw new Error("CHAMPIONSHIP_SHOP_NOT_ACTIVE");
      }
      lastShopReceipt = requireShop().buy(shopRecordIndex, quantity);
      if (lastShopReceipt.ok) savePort.markDirty();
      publishScreens();
      return lastShopReceipt;
    },

    getDatabaseFrame() {
      const frame = projectDatabase({
        starterSpeciesId: creature?.speciesId ?? null,
        collection: raising?.collection ?? [],
        registeredSpecies: registeredSpeciesValue,
        selectedSpeciesIndex: selectedDatabaseSpeciesIndex
      });
      if (!frame.selected) return frame;
      const instances = frame.selected.instances.map((entry) => {
        const gate = entry.originGateId ? getChampionshipGate(entry.originGateId) : null;
        return { ...entry, originGateName: gate?.displayName ?? null };
      });
      return Object.freeze({
        ...frame,
        selected: Object.freeze({ ...frame.selected, instances })
      });
    },

    /** The toolbar's management submenu reaches the roster through here. */
    openDigimonList() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.DIGIMON_LIST) return screens.current();
      screens.enter(CHAMPIONSHIP_SCREENS.DIGIMON_LIST);
      publishScreens();
      return screens.current();
    },

    /** The toolbar's management submenu reaches the fixture board through here. */
    openSchedule() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.SCHEDULE) return screens.current();
      screens.enter(CHAMPIONSHIP_SCREENS.SCHEDULE);
      publishScreens();
      return screens.current();
    },

    /** The toolbar's system submenu reaches the cartridge's help through here. */
    openHelp() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.HELP) return screens.current();
      screens.enter(CHAMPIONSHIP_SCREENS.HELP);
      publishScreens();
      return screens.current();
    },

    /** The toolbar's management submenu reaches the tamer profile through here. */
    openTamerInfo() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.TAMER_INFO) return screens.current();
      screens.enter(CHAMPIONSHIP_SCREENS.TAMER_INFO);
      publishScreens();
      return screens.current();
    },

    openDatabase() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.DATABASE) return screens.current();
      selectedDatabaseSpeciesIndex = null;
      screens.enter(CHAMPIONSHIP_SCREENS.DATABASE);
      publishScreens();
      return screens.current();
    },

    selectDatabaseSpecies(speciesIndex) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.DATABASE) {
        throw new Error("CHAMPIONSHIP_DATABASE_NOT_ACTIVE");
      }
      if (speciesIndex === null) {
        selectedDatabaseSpeciesIndex = null;
        publishScreens();
        return this.getDatabaseFrame();
      }
      getDatabaseSlot(speciesIndex);
      selectedDatabaseSpeciesIndex = speciesIndex;
      publishScreens();
      return this.getDatabaseFrame();
    },

    renameDatabaseInstance(instanceId, displayName) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.DATABASE) {
        throw new Error("CHAMPIONSHIP_DATABASE_NOT_ACTIVE");
      }
      raising = renameEnclosedCreature(raising, instanceId, displayName);
      publishScreens();
      return raising.collection.find((entry) => entry.instanceId === instanceId)?.displayName ?? null;
    },

    getCageEditFrame() {
      if (!cageEdit) return null;
      return requireCageEdit().getFrame(...cageEditArgs());
    },

    openCageEdit() {
      requireSession();
      requireCageEdit();
      if (screens.current() === CHAMPIONSHIP_SCREENS.CAGE_EDIT) return screens.current();
      cageEdit.selectModule(null, ...cageEditArgs());
      screens.enter(CHAMPIONSHIP_SCREENS.CAGE_EDIT);
      publishScreens();
      return screens.current();
    },

    selectCageModule(moduleId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().selectModule(moduleId, ...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    placeCageAt(slotIndex) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().placeAt(slotIndex, ...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    removeCagePlacement(moduleId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().removePlacement(moduleId, ...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    confirmCageEdit() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      const editor = requireCageEdit();
      const before = JSON.stringify(editor.toSave());
      storeNativeRaisingPositions();storeNativeRaisingHome();
      editor.confirm(...cageEditArgs());
      if (JSON.stringify(editor.toSave()) !== before) {
        raisingActors.clear();initializeNativeRaisingHome();savePort.markDirty();
      }
      publishScreens();
      return this.getCageEditFrame();
    },

    openGate() {
      requireSession();
      screens.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
      publishScreens();
      return screens.current();
    },

    // --- VS5 Auto Battle ---------------------------------------------------
    // Three named intents rather than a generic enter, so the stack keeps its
    // declared-transition guarantee: a match cannot be reached except from the
    // menu, and the result cannot be reached except from a match.

    openBattle() {
      requireSession();
      screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_SELECT);
      publishScreens();
      return screens.current();
    },

    getBattleEconomyState() {
      return battleEconomy;
    },

    getBattleReceipt() {
      return battleEconomy.lastReceipt;
    },

    getBattlePartyCandidates(recordIndex) {
      return this.getRaisingInstances().map(entry=>{
        const nativeProfile=entry.instanceId===creature?.creatureId?creature.nativeProfile:raisingNativeProfile(entry.instanceId);
        return Object.freeze({...entry,admission:battlePartyAdmission(nativeProfile,recordIndex)});
      });
    },

    getBattlePartyLimit(recordIndex) {return battlePartyCondition(getMatchRecord(recordIndex).field0C).slots;},

    prepareBattleRng() {
      requireSession();
      const base=gameplayRngSnapshot();
      const rng=base?restoreChannelRng(base):createClockChannelRng(rngClock());
      const preparation=Object.freeze({rng});
      battleRngPreparations.set(preparation,{base:JSON.stringify(base),rng,session});
      return preparation;
    },

    prepareBattleParty(recordIndex,instanceIds) {
      const limit=battlePartyCondition(getMatchRecord(recordIndex).field0C).slots;
      if(!Array.isArray(instanceIds)||!instanceIds.length||instanceIds.length>limit||new Set(instanceIds).size!==instanceIds.length)
        return {ok:false,reason:'PARTY_SIZE',message:`請選擇 1 至 ${limit} 隻符合條件的數碼獸。`};
      const candidates=this.getBattlePartyCandidates(recordIndex),individuals=[];
      for(const instanceId of instanceIds){
        const entry=candidates.find(c=>c.instanceId===instanceId);
        if(!entry)return {ok:false,reason:'UNKNOWN_INDIVIDUAL',message:'選擇的數碼獸已不在目前名冊。'};
        if(!entry.admission.ok)return entry.admission;
        const nativeProfile=instanceId===creature?.creatureId?creature.nativeProfile:raisingNativeProfile(instanceId);
        buildOwnedBattleCreature({instanceId,nativeProfile});
        individuals.push({instanceId,nativeProfile:structuredClone(nativeProfile)});
      }
      return {ok:true,individuals};
    },

    enterMatch({ attemptId = nextBattleAttemptId(battleEconomy), recordIndex, mode, battleType, playerInstanceIds=null, rngPreparation=null } = {}) {
      requireSession();
      if (battleTransactionActive) return Object.freeze({ ok: false, reason: "TRANSACTION_ACTIVE" });
      const duplicateActive = battleEconomy.active?.attemptId === attemptId;
      if (screens.current() !== CHAMPIONSHIP_SCREENS.BATTLE_SELECT && !duplicateActive) {
        throw new Error("CHAMPIONSHIP_BATTLE_SELECT_NOT_ACTIVE");
      }
      // Recheck today's date/rank at the actual debit, not only at menu mount.
      if (!duplicateActive && !this.getAvailableBattleRecordIndices().includes(recordIndex)) {
        return Object.freeze({ ok: false, reason: "MATCH_NOT_AVAILABLE",
          message: "這場比賽不符合目前日期或資格，請重新選擇。" });
      }
      if(!duplicateActive && playerInstanceIds!==null){
        const admission=this.prepareBattleParty(recordIndex,playerInstanceIds);
        if(!admission.ok)return admission;
        if(mode!==1||battleType!==0)return {ok:false,reason:'OWNED_PARTY_MODE_REQUIRES_TRACE'};
      }
      const preparedRng=rngPreparation===null?null:battleRngPreparations.get(rngPreparation);
      if(!duplicateActive && rngPreparation!==null && (!preparedRng||preparedRng.session!==session||preparedRng.base!==JSON.stringify(gameplayRngSnapshot())))
        return {ok:false,reason:'BATTLE_PREPARATION_STALE',message:'遊戲進度已更新，請重新選擇參賽隊伍。'};
      const result = applyBattleTransaction(beginBattleAttempt(battleEconomy, {
        attemptId, matchIndex: recordIndex, mode, battleType,
        entryFee: matchEntryFee(recordIndex), payout: matchPayout(recordIndex), expectedRounds: 1
      }, requireShop().getBits()),[],preparedRng?.rng);
      if (!result.ok || result.duplicate) return result;
      if(rngPreparation)battleRngPreparations.delete(rngPreparation);
      battlePartyIds=playerInstanceIds===null?null:[...playerInstanceIds];
      screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD);
      publishScreens();
      return result;
    },

    /** The battle judges itself; nothing else may push the result screen. */
    finishMatch({ attemptId, ended, mode, battleType, matchIndex, outcomeEntries, individualResults=[] } = {}) {
      requireSession();
      if (battleTransactionActive) return Object.freeze({ ok: false, reason: "TRANSACTION_ACTIVE" });
      // A result already consumed can be queried after returning or reloading,
      // but it can never reopen the match or credit the wallet again.
      if (!battleEconomy.active) {
        // Every other refusal on this method is a reason, not a throw. An
        // unparseable attempt id was the one input that escaped as an
        // exception, which a caller reading `.ok` would never see coming.
        try {
          return settleBattleAttempt(battleEconomy, { attemptId, outcomeEntries }, requireShop().getBits());
        } catch {
          return Object.freeze({ ok: false, reason: "BATTLE_ATTEMPT_NOT_ACTIVE" });
        }
      }
      if (screens.current() !== CHAMPIONSHIP_SCREENS.BATTLE_FIELD) {
        return Object.freeze({ ok: false, reason: "BATTLE_FIELD_NOT_ACTIVE" });
      }
      const active = battleEconomy.active;
      if (ended !== true || mode !== active.mode || battleType !== active.battleType || matchIndex !== active.matchIndex) {
        return Object.freeze({ ok: false, reason: "BATTLE_RESULT_CONTEXT_MISMATCH" });
      }
      let updates=[];
      if(battlePartyIds){
        if(!Array.isArray(individualResults)||individualResults.length!==battlePartyIds.length||
          individualResults.some((entry,i)=>entry.instanceId!==battlePartyIds[i]))
          return {ok:false,reason:'BATTLE_PARTY_RESULT_MISMATCH'};
        updates=individualResults.map(entry=>({instanceId:entry.instanceId,nativeProfile:normalizeNativeIndividualProfile(
          entry.nativeProfile,this.resolveRaisingInstance(entry.instanceId).speciesId)}));
      }
      const result = applyBattleTransaction(settleBattleAttempt(battleEconomy, { attemptId, outcomeEntries }, requireShop().getBits()),updates);
      if (!result.ok || result.duplicate) return result;
      for(const entry of updates)raisingActors.delete(entry.instanceId);
      battlePartyIds=null;
      screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_RESULT);
      publishScreens();
      return result;
    },

    /** Leaving a match or its result unwinds to Home rather than popping back
     *  into a round that has already been judged. */
    exitBattle() {
      const from = screens.current();
      if (from !== CHAMPIONSHIP_SCREENS.BATTLE_FIELD && from !== CHAMPIONSHIP_SCREENS.BATTLE_RESULT) {
        return screens.current();
      }
      if (battleTransactionActive) return screens.current();
      if (battleEconomy.active) {
        // Preserve the existing LEAVE seam without inventing a fee refund.
        // Original cancellation/refund semantics remain a separate trace gate.
        const result = applyBattleTransaction(abandonBattleAttempt(battleEconomy, {
          attemptId: battleEconomy.active.attemptId
        }, requireShop().getBits()));
        if (!result.ok) return screens.current();
      }
      battlePartyIds = null;
      screens.exit();
      publishScreens();
      return screens.current();
    },

    selectGate(gateId) {
      if (huntCommitActive) return selectedGateId;
      if (screens.current() !== CHAMPIONSHIP_SCREENS.GATE_SELECT) {
        throw new Error("CHAMPIONSHIP_GATE_SELECT_NOT_ACTIVE");
      }
      if (gateId !== null && !getChampionshipGate(gateId)) {
        throw new Error(`CHAMPIONSHIP_UNKNOWN_GATE: ${gateId}`);
      }
      selectedGateId = gateId;
      huntEntryError = null;
      publishScreens();
      return selectedGateId;
    },

    /** Commit the gate choice and move to loadout. A no-op with no selection. */
    confirmGate() {
      if (huntCommitActive) return screens.current();
      if (screens.current() !== CHAMPIONSHIP_SCREENS.GATE_SELECT) return screens.current();
      if (selectedGateId === null) return screens.current();
      if (!this.getGateAdmission(selectedGateId).canConfigure) return screens.current();
      confirmedGateId = selectedGateId;
      // Entering the loadout builds it over the Shop-owned inventory.
      huntLoadout = createHuntLoadout({ inventory: huntInventory });
      screens.enter(CHAMPIONSHIP_SCREENS.HUNT_LOADOUT);
      publishScreens();
      return screens.current();
    },

    selectHuntEquipment(equipmentClass, itemId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
      }
      const result = requireLoadout().selectEquipment(equipmentClass, itemId);
      publishScreens();
      return result;
    },

    fitHuntPlugin(position, itemId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
      }
      const result = requireLoadout().fitPlugin(position, itemId);
      publishScreens();
      return result;
    },

    selectHuntMemoryCard(itemId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        throw new Error("CHAMPIONSHIP_HUNT_LOADOUT_NOT_ACTIVE");
      }
      const result = requireLoadout().selectMemoryCard(itemId);
      publishScreens();
      return result;
    },

    /**
     * DEVELOPER_PROTOTYPE_ONLY.
     *
     * The VS2 companion placeholder, kept for developer inspection and never
     * surfaced by the Player Mode seam. It gates nothing and enters nothing.
     */

    /**
     * Enter the field.
     *
     * Prepare the native encounter on isolated RNG/history candidates, then
     * commit only after the existing world and runtime both construct.
     */
    beginHunt() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) return screens.current();
      if (confirmedGateId === null) return screens.current();
      requireSession();
      // Entry is gated on the loadout being internally consistent, not on
      // anything being equipped: no original rule requires a full loadout.
      if (!requireLoadout().getConfirmationState().canConfirm) return screens.current();
      if (huntCommitActive) return screens.current();
      const gate = getChampionshipGate(confirmedGateId);
      const admission = this.getGateAdmission(gate.gateId);
      if (!admission.canEnter) {
        huntEntryError = admission.reason;
        publishScreens();
        return screens.current();
      }
      huntCommitActive = true;
      try {
        // Replay is explicitly requested by research fixtures only. Normal
        // startup has no recorded actor, fixed seed or prototype encounter.
        const entry = huntCaptureReplay === null ? prepareNativeHuntEntry({ biomeId:gate.biomeId,
          clock:requireSession().getRaisingHomeSnapshot(),
          rngSnapshot:gameplayRngSnapshot(), persistentState:huntPersistentState }) : null;
        const world = createHuntWorld(gate, entry);
        const candidateRuntime = huntRuntimeFactory({ world, nativeEntry:entry,
          captureReplay:huntCaptureReplay, maxCardG:maxGFromInventory(huntInventory),
          nativeControls:entry ? {loadout:requireLoadout(),consumeItem:(id,n=1)=>requireShop().consumeHuntItem(id,n),onChange:publishScreens} : null,
          fieldActor:{ actorId:"championship:2026:actor:tamer", displayName:"Tamer" } });
        if (!candidateRuntime || candidateRuntime.world !== world) throw Error("HUNT_ENTRY_RUNTIME_INVALID");
        if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT || confirmedGateId !== gate.gateId) {
          throw Error("HUNT_ENTRY_CONTEXT_CHANGED");
        }
        if (requireShop().getBits() !== admission.walletBits) throw Error("HUNT_ENTRY_WALLET_CHANGED");
        screens.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD);
        if (entry) { gameplayRng = entry.rng; huntPersistentState = entry.persistentState; }
        huntRuntime = candidateRuntime;
        huntDeadlineMinute = entry ? Math.min(requireSession().getRaisingHomeSnapshot().clockMinutes + 480, DAY_END_MINUTES) : null;
        // Hunt resume discards the prior scene's raw sub-minute remainder.
        if (entry) requireSession().advanceRaisingClock({ units: 0, divisor: 400, clearElapsed: true,
          expectedClockRevision: requireSession().getRaisingHomeSnapshot().clockRevision });
        huntEntryError = null;
        // The candidate is now complete. Publish one wallet debit while the
        // commit guard prevents callbacks from entering/saving a partial Hunt.
        if (admission.chargeBits > 0) {
          const paid = requireShop().applyBitsTransaction({ expectedBits: admission.walletBits, bits: admission.afterBits });
          if (!paid.ok) throw Error("HUNT_ENTRY_WALLET_CHANGED");
        }
        // Save observers see a fully committed screen/runtime/RNG/history set.
        if (entry || admission.chargeBits > 0) savePort.markDirty();
      } catch (error) {
        huntEntryError = error instanceof Error ? error.message : "HUNT_ENTRY_FAILED";
        publishScreens();
        return screens.current();
      } finally { huntCommitActive = false; }
      publishScreens();
      return screens.current();
    },

    /**
     * Leave an empty expedition, or enter Result with already-inserted card
     * records. A gesture or unfinished animation is never a Home commit.
     */
    getHuntTimeState() {
      if (huntDeadlineMinute === null || screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD) return null;
      return Object.freeze({ deadlineMinute: huntDeadlineMinute,
        remainingMinutes: Math.max(0, huntDeadlineMinute - requireSession().getRaisingHomeSnapshot().clockMinutes),
        evidence: "ROM_NORMAL_HUNT_CLOCK_AND_DEADLINE" });
    },

    checkHuntDeadline() {
      if (screens.current() === CHAMPIONSHIP_SCREENS.HUNT_FIELD && huntDeadlineMinute !== null
        && requireSession().getRaisingHomeSnapshot().clockMinutes >= huntDeadlineMinute) this.exitHunt();
    },

    exitHunt() {
      if (huntCommitActive) return screens.current();
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD) return screens.current();
      if (huntRuntime?.hasPendingCaptureAnimation()) return screens.current();
      huntCommitActive = true;
      try {
        const returnContext = huntRuntime?.getNativeReturnContext?.();
        if (returnContext) {
          const cards = huntRuntime.getOnCardEntries();
          const returnRng = restoreChannelRng(gameplayRngSnapshot());
          const returned = applyNativeHuntReturn({ ...returnContext, ...huntPersistentState,
            catalog:nativeHuntCatalogForBiome(returnContext.biomeIndex), speciesByIndex:nativeHuntSpeciesByIndex, rng:returnRng,
            records:cards.map(({nativeProfile:{fields,narrowFields,name}}) => ({fields,narrowFields,name})) });
          // Validate every candidate before publishing any record, RNG or history.
          const candidates = returned.records.map((individual,i) => {
            nativeIndividualProfile(individual, cards[i].speciesId);
            return {wildId:cards[i].wildId,individual};
          });
          huntRuntime.applyReturnedIndividuals(candidates);
          gameplayRng = returnRng;
          huntPersistentState = {history:returned.history,modifiers:returned.modifiers};
        }
        huntRuntime?.abortEnclosureStroke();
        if (huntDeadlineMinute !== null) {
          const active = requireSession();
          active.advanceRaisingClock({ units: 0, divisor: 400, clearElapsed: true,
            expectedClockRevision: active.getRaisingHomeSnapshot().clockRevision });
        }
        huntDeadlineMinute = null;
        const entries = huntRuntime?.getOnCardEntries() ?? [];
        if (entries.length > 0) {
          const entry = entries[0];
          huntResult = Object.freeze({ ...entry, displayName: entry.displayName ?? speciesDisplayName(entry.speciesId),
            title: "HUNT RESULT", outcomeLabel: "ON MEMORY CARD", speciesLabel: speciesDisplayName(entry.speciesId),
            outcome: "ON_CARD", originGateId: confirmedGateId, pendingHomeCommit: true });
          screens.enter(CHAMPIONSHIP_SCREENS.HUNT_RESULT);
          if (returnContext) savePort.markDirty();
          return screens.current();
        }
        huntRuntime = null;
        huntLoadout = null;
        huntResult = null;
        confirmedGateId = null;
        selectedGateId = null;
        screens.exit();
        if (returnContext) savePort.markDirty();
        return screens.current();
      } finally {
        huntCommitActive = false;
        publishScreens();
      }
    },

    beginEnclosureStroke(worldX, worldY) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return false;
      return huntRuntime.beginEnclosureStroke(worldX, worldY);
    },

    extendEnclosureStroke(worldX, worldY) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return false;
      return huntRuntime.extendEnclosureStroke(worldX, worldY);
    },

    // Geometry cannot allocate a Raising ID or change the wallet/save/roster.
    // Native replay card insertion and Home commit use separate methods below.
    endEnclosureStroke() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return null;
      return huntRuntime.endEnclosureStroke();
    },

    abortEnclosureStroke() {
      return huntRuntime?.abortEnclosureStroke() ?? false;
    },

    /** Close Hunt Result and return to Raising Home. */
    confirmHuntResult() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_RESULT) return screens.current();
      if (huntCommitActive) return screens.current();
      if (huntResult?.pendingReleaseKey) return screens.current();
      const entries = huntRuntime?.getOnCardEntries() ?? [];
      const releasedHomeIds = huntResult?.releasedHomeIds ?? [];
      if (entries.length > 0 || releasedHomeIds.length > 0) {
        let candidateRaising = raising, candidateIdentity = instanceIdentity;
        const beforeSnapshot = requireSession().getRaisingHomeSnapshot();
        const releasedResidents = releasedHomeIds.filter((id) => beforeSnapshot.residents.some((entry) => entry.residentId === id));
        const candidateSnapshot = releasedResidents.length ? stageRaisingResidentRelease(beforeSnapshot, releasedResidents) : beforeSnapshot;
        for (const id of releasedHomeIds) candidateRaising = releaseRaisingMembership(candidateRaising, id);
        const sources = { ...instanceSources(), residents: candidateSnapshot.residents,
          creature: releasedHomeIds.includes(creature.creatureId) ? null : instanceSources().creature,
          collection: candidateRaising.collection,
          assignments: candidateRaising.assignments, interactions: candidateRaising.interactions };
        // Native pool 02061BB4 has 16 slots. A confirmed release is staged in
        // this same Home transaction; failure cannot remove a saved individual.
        if (listRaisingInstances(sources).length + entries.length > 16) {
          huntResult = Object.freeze({ ...huntResult, commitError: "HOME_ROSTER_FULL" });
          publishScreens(); return screens.current();
        }
        for (const entry of entries) {
          const allocation = allocateRaisingInstanceIdentity(candidateIdentity, { ...sources, collection: candidateRaising.collection,
            assignments: candidateRaising.assignments });
          candidateIdentity = allocation.state;
          candidateRaising = recordCapturedCardCreature(candidateRaising, { instanceId: allocation.instanceId,
            speciesId: entry.speciesId, displayName: entry.displayName, enclosedAt: now(), originGateId: confirmedGateId,
            cageId: Object.values(candidateRaising.assignments)[0] ?? cageIds[0],
            capturedVitals: { ...entry.sourceVitals, traceId: entry.traceId },
            nativeProfile: entry.nativeProfile });
        }
        const candidateBook = retainOwnedBookSpecies(registeredSpeciesValue, creature, candidateRaising.collection);
        huntCommitActive = true;
        let status;
        try {
          status = savePort.save({ snapshot: candidateSnapshot, creature, sessionId,
            revision: revision + 1, interactionCount, tamerRank: tamerRankValue, battleBadges:battleBadgesValue, nativeTitles, nativeMessages, nativeOpening, raising: candidateRaising,
            registeredSpecies: candidateBook,
            shop: shop ? shop.toSave() : null, cageEdit: cageEdit ? cageEdit.toSave() : null,
            battleEconomy, instanceIdentity: candidateIdentity, gameplayRng: gameplayRngSnapshot(),
            huntHistory: projectNativeHuntPersistentSave(huntPersistentState) });
          if (status.phase === "SAVED") {
            raising = candidateRaising; instanceIdentity = candidateIdentity; revision += 1;
            registeredSpeciesValue = candidateBook;
            if (releasedHomeIds.includes(selectedCreatureId)) selectedCreatureId = null;
            if (releasedResidents.length) requireSession().commitRaisingResidentRelease(releasedResidents, beforeSnapshot.revision);
            huntRuntime.completeHomeCaptureCommit();
          }
        } finally { huntCommitActive = false; }
        if (status.phase !== "SAVED") {
          huntResult = Object.freeze({ ...huntResult, commitError: "SAVE_FAILED" });
          publishScreens(); return screens.current();
        }
      }
      huntRuntime?.abortEnclosureStroke();
      huntRuntime = null;
      huntLoadout = null;
      huntResult = null;
      confirmedGateId = null;
      selectedGateId = null;
      screens.exit();
      publishScreens();
      return screens.current();
    },

    requestHuntResultRelease(key) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_RESULT || huntCommitActive) return false;
      const row = this.getHuntResult()?.rows?.find((entry) => entry.key === key);
      if (!row?.canRelease) return false;
      huntResult = Object.freeze({ ...huntResult, pendingReleaseKey: key });
      publishScreens(); return true;
    },
    cancelHuntResultRelease() {
      if (!huntResult?.pendingReleaseKey || huntCommitActive) return false;
      huntResult = Object.freeze({ ...huntResult, pendingReleaseKey: null });
      publishScreens(); return true;
    },
    confirmHuntResultRelease() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_RESULT || huntCommitActive) return false;
      const row = this.getHuntResult()?.pendingRelease;
      if (!row?.canRelease) return false;
      let releasedHomeIds = huntResult.releasedHomeIds ?? [];
      if (row.kind === "CARD") {
        if (!huntRuntime.releaseOnCardEntry(row.id)) return false;
      } else releasedHomeIds = [...releasedHomeIds, row.id];
      const selected = huntRuntime.getOnCardEntries()[0] ?? null;
      huntResult = Object.freeze({ ...huntResult, wildId: selected?.wildId ?? null,
        speciesId: selected?.speciesId ?? null, speciesLabel: selected ? speciesDisplayName(selected.speciesId) : null,
        displayName: selected ? selected.displayName ?? speciesDisplayName(selected.speciesId) : null,
        releasedHomeIds: Object.freeze(releasedHomeIds), pendingReleaseKey: null, commitError: null });
      publishScreens(); return true;
    },

    /**
     * Hunt Result name edit (original OVL4 plate).
     *
     * The original charset is untraced; this uses the product given-name rule.
     */
    setHuntResultName(displayName) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_RESULT || !huntResult) {
        throw new Error("CHAMPIONSHIP_HUNT_RESULT_NOT_ACTIVE");
      }
      if (huntResult.pendingHomeCommit) {
        if (!huntResult.wildId) return null;
        const name = normalizeProductGivenName(displayName);
        huntRuntime.renameOnCardEntry(huntResult.wildId, name);
        huntResult = Object.freeze({ ...huntResult, displayName: name });
        publishScreens(); return name;
      }
      raising = renameEnclosedCreature(raising, huntResult.instanceId, displayName);
      const givenName = raising.collection.find((entry) => entry.instanceId === huntResult.instanceId)?.displayName;
      huntResult = Object.freeze({ ...huntResult, displayName: givenName });
      publishScreens();
      return huntResult.displayName;
    },

    /** Step one screen back. Clears the choice the popped screen owned. */
    leaveScreen() {
      if (huntCommitActive) return screens.current();
      const from = screens.current();
      if (from === CHAMPIONSHIP_SCREENS.HUNT_FIELD) return this.exitHunt();
      if (from === CHAMPIONSHIP_SCREENS.BATTLE_FIELD || from === CHAMPIONSHIP_SCREENS.BATTLE_RESULT) {
        return this.exitBattle();
      }
      if (from === CHAMPIONSHIP_SCREENS.HUNT_RESULT) return this.confirmHuntResult();
      if (from === CHAMPIONSHIP_SCREENS.HUNT_LOADOUT) {
        huntLoadout = null;
        confirmedGateId = null;
      }
      if (from === CHAMPIONSHIP_SCREENS.GATE_SELECT) selectedGateId = null;
      if (from === CHAMPIONSHIP_SCREENS.SHOP) {
        this.advanceClock({ units: 0, clearElapsed: true });
        shop?.markNewSeen();
        lastShopReceipt = null;
      }
      if (from === CHAMPIONSHIP_SCREENS.DATABASE) selectedDatabaseSpeciesIndex = null;
      if (from === CHAMPIONSHIP_SCREENS.CAGE_EDIT) cageEdit?.revert(...cageEditArgs());
      screens.back();
      publishScreens();
      return screens.current();
    },

    /** The controller dispatches through here, so interactions driven from the
     *  UI are counted the same as ones driven from a test. */
    runtimeFacade() {
      const active = requireSession();
      const app = this;
      return Object.freeze({
        getSnapshot: active.getRaisingHomeSnapshot,
        dispatch: (command) => app.dispatch(command),
        subscribe: active.subscribeRaisingHome
      });
    },

    persistenceFacade() {
      const app = this;
      return Object.freeze({
        getStatus: () => savePort.getStatus(),
        subscribe: (listener) => savePort.subscribe(listener),
        save: () => app.save(),
        retry: () => {
          if (huntResult?.pendingHomeCommit) {
            app.confirmHuntResult();
            return savePort.getStatus();
          }
          return app.save();
        },
        exportRecovery: () => savePort.exportRecovery()
      });
    },

    async dispose() {
      if (huntCommitActive) return false;
      battlePartyIds = null;
      resetExpedition();
      if (!session) {await savePort.releaseSession();return;}
      const closing = session;
      session = null;
      await closing.dispose();
      await savePort.releaseSession();
    }
  });
}
