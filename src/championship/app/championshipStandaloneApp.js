import {readRaisingGroundSupport} from './raisingGroundSupport.js';
import {habitatMatch,speciesTaxonomy} from '../contracts/speciesTaxonomy.js';
import {GACHA_CHIPS,GACHA_METALS,GACHA_GOODS,GACHA_PITY_MAX,GACHA_MACHINES,GACHA_BLOODLINES,getGachaChip,getGachaMetal,getGachaGoods,gachaRarityRank,
  grantGachaWelcome,grantGachaTickets,pullCyberGacha,claimGachaPity,autoFillSynthesizer,synthesizeGachaMetal,applyGachaBoost,metalBoostEffect,
  inscribesBloodline,catalystRarityForGeneration,spendGachaItem,fuseGachaShards,shardFusionTarget,GACHA_SHARD_FUSION_COST,settleGachaBattleWin,takeArmedHuntChips,gachaBloodlineOf,claimGachaReward} from '../gacha/cyberGacha.js';
import { grantFriendsPlaytestCoins, migrateFriendsPlaytestDiamonds, normalizeFriendsPlaytestState, purchaseTestRanchRow, creditTestDiamonds, productDiamondWallet } from './friendsPlaytestPolicy.js';
import {recordGachaClaims,automationForgePlan,forgeAutomationItem,deployAutomationCore,tickAutomationRuns,settleRanchAutomation,
  setGachaBondCarry,claimGachaBundle,grantGachaAutomation} from '../gacha/cyberGacha.js';
import {AUTOMATION_ITEMS,AUTOMATION_RECIPES,AUTOMATION_RULES,getAutomationItem,cageAutomation,royalTotal,autoFeedAffection,royalSleepBonus,
  coreModules,FOUNDER_PACK_ART} from '../gacha/ranchAutomation.js';
import {AUTO_CARE_RULES,createCleanerBot,stepCleanerBot,cleanerCuriosity,stepCleanerRider,createFeederTower,stepFeederTower,machineHome} from '../raising/autoCareMachines.js';
import {LAND_EXPANSION,DIAMOND_REWARDS,FOUNDER_PACK,diamondRewardKey,dueDiamondMilestones,landExpansionTier,landExpansionPrice,landMemoryBonusG,
  founderPackUnlocked} from '../gacha/diamondRewards.js';
import { planOnlineBindReward } from './onlineBindRewardPolicy.js';
import {GACHA_PERSONALITY_CHOICES,GACHA_TICKET_PRIZE,getGachaBitsBag,disarmGachaItem,useGachaChipNow,huntMinutesToSeconds} from '../gacha/cyberGacha.js';
import {getGachaSupplyPack,getGachaTicketPrize,gachaChipEffectLines,gachaMetalEffectLines,shardTierSmeltPlan,smeltGachaShardTier,
  GACHA_TIER_SMELT,GACHA_TIER_SMELT_COST} from '../gacha/cyberGacha.js';
import {resolveGachaEffect,evolutionRouteGaps,beaconBattleWords,SHARD_CATALYST_WAIVER} from '../gacha/gachaItemExecutor.js';
import {beginNativeRaisingEvolution} from '../raising/nativeRaisingActor.js';
import {productRebirth,PRODUCT_GROWTH_RULES} from '../raising/productGrowthPolicy.js';
import {growthBranchHistoryIndex} from '../contracts/productGrowthRules.js';
import {constructNativeIndividualForm} from '../raising/nativeIndividualEvolution.js';
import {normalizeBurstEvolution,createBurstEvolutionState,withBurstMigrated,legacyBurstMigration,unlockBurstForms,
  burstUnlocksOf,burstFormsFor,evaluateBurstConditions,preferBurstForm,preferredBurstForm,burstPlanFor,burstTierForRank,burstFormTier,
  AWAKENING_RULES,partnerAwakenings,awakeningFocus,awakeningTargetOf,awakeningAppearanceOf,transcendStarsOf,feedAwakeningEnergy,
  addTranscendStar,setAwakeningTarget,setAwakeningAppearance,clearAwakeningShown,learnAwakening,awakeningDisplayFor,awakeningItemEnergy} from '../contracts/productBurstEvolution.js';
import {overdriveOf,withOverdrive,awakeningSeedOf,withAwakeningSeed,sponsorContractOf,sponsorEscrowOf,withSponsorContract,withSponsorEscrow,sponsorContractsSignedOn,withSponsorSigned,
  BURST_CONDITION_IDS,BURST_CONDITION_FIELDS} from '../contracts/productBurstEvolution.js';
import {OVERDRIVE_RULES,overdriveHeatAt,overdriveCooling,resolveOverdriveTraining,instinctNoise,
  SPONSOR_CONTRACTS,SPONSOR_STAKES,sponsorContract,validSponsorStake,settleSponsorContract,WILD_INSTINCT_BLOODLINES,wildInstinct,
  settleWildInstincts,ownPointCondition,sponsorOdds,SPONSOR_STAKE_CAPS,SPONSOR_DAILY_LIMIT,SPONSOR_ODDS} from '../contracts/productAwakeningOverdrive.js';
import {localDayNumber} from '../time/realtimeClock.js';
import {spreadHuntActors} from '../hunt/capture/productHuntSpawnSpread.js';
import {applyProductTrainingGains} from '../raising/nativeRaisingTraining.js';
import {inscribeGachaBloodline,grantGachaMetal} from '../gacha/cyberGacha.js';
import {REALTIME_TRAINING_POLICY,recommendedCages,TRAINING_KIND_OF_CONDITION} from '../raising/productTrainingPolicy.js';
import {normalizeSyncLevels,createSyncLevelState,syncOf,syncCapForRank,syncBattleExp,grantSyncExp,feedSyncCrystals,reconcileSyncRebirth,
  boostSyncNativeProfile,restoreSyncNativeProfile,syncArenaPower,SYNC_LEVEL_MAX} from '../contracts/productSyncLevel.js';
import {normalizeJourney,createJourneyState,TOWER_FLOORS,towerBand,towerOpponents,towerOpponentSpecies,towerRewards,towerNextFloor,
  clearTowerFloor,patrolStatus,claimPatrol,quickPatrol} from '../contracts/productJourney.js';
import {CAMPAIGN_ZONES,CAMPAIGN_STAGES,CAMPAIGN_ZONE_CHEST,campaignRivals,campaignStars,campaignRewards,recordCampaignStage,sweepCampaignStage,
  sweepsLeft,stageOpen,starsOf,zoneStars,totalStars} from '../contracts/productCampaign.js';
import {ranchPositionAfterLayout} from '../raising/ranchLayoutPositions.js';
import {assertPlayableProductSaveData,PRODUCT_RAISING_LIFECYCLE_RULES,productPartnerG} from '../contracts/productSpeciesData.js';
import {selectNativeRaisingEvolutionChoice} from '../raising/nativeRaisingActor.js';
import {getProductExtension,requirePlayableProductExtension} from '../contracts/productSpeciesExtensions.js';
import {settleRanchDiscoveries,removeCollectedDiscoveries,RANCH_DISCOVERY_REWARDS} from '../raising/ranchDiscoveries.js';
import {PARTNER_LIFE_RULES,PARTNER_MOODS,STROLL_REWARDS,partnerHabitatFit,partnerMood,partnerAffectionHearts,partnerTypeBits,partnerPeerRelation,
  strollFindChance,rollStrollFind,strollIntervalFrames,strollDayKey,appendStrollEntry,canStrollFind,canGreet,canTapAffection,recordTap,strollLogName,strollPairKey,renameStrollLogPartners,
  pendingStrollEntries,claimStrollEntries,greetingGapFrames} from '../raising/ranchPartnerLife.js';
import {localizeSpeciesCodes,speciesNameForId} from '../text/zhHant.js';
import {holdNativeRaisingActorForGreeting} from '../raising/nativeRaisingActor.js';
import {nativeRaisingPeerStopDistanceQ12} from '../raising/nativeRaisingMovement.js';
import { panHuntPresentationCamera } from "../hunt/huntPresentationBinding.js";
import {tutorialHuntStep,TUTORIAL_GATE} from './interactiveTutorialHuntSteps.js';
import {tutorialBattleStep} from './interactiveTutorialBattleSteps.js';
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
import { deserializeChampionshipModernSave, normalizeBattleTactics, BATTLE_TACTIC_DEFAULT } from "./championshipStandaloneSave.js";
import { createChampionshipPersistentSavePort } from "./ChampionshipPersistentSavePort.js";
import {normalizeNativeIndividualProfile} from '../raising/nativeIndividualProfile.js';
import { selectPhase1FirstCreature } from "./phase1ProductCreatures.js";
import { CHAMPIONSHIP_SCREENS, createChampionshipScreenStack } from "./championshipScreenStack.js";
import { getChampionshipGate, listChampionshipGates } from "../gate/gateCatalog.js";
import { gateAdmission, isGateUnlocked } from "../gate/gateAdmission.js";
import { createHuntWorld } from "../hunt/huntWorld.js";
import { applyNativeHuntReturn } from "../hunt/capture/nativeHuntHistory.js";
import { productHuntCatalogForBiome, resolveProductHuntPoolSources, nativeHuntSpeciesByIndex } from "../hunt/capture/nativeHuntSources.js";
import { nativeIndividualProfile, projectNativeIndividualStats } from "../raising/nativeIndividualProfile.js";
import { createNativeRaisingStarter } from "../raising/nativeRaisingStarter.js";
import {createNativeHuntIndividual} from '../hunt/capture/nativeHuntIndividual.js';
import {createNativeRaisingMessages,normalizeNativeRaisingMessages,selectNativeMorningMessages,enqueueNativeRaisingMessage,
  ageNativeRaisingMessages,openNativeRaisingMessage,closeNativeRaisingMessage,nativeRaisingMessageEffect} from '../raising/nativeRaisingMessages.js';
import {normalizeNativeOpening} from './nativeOpeningState.js';
import {deepFreeze} from '../contracts/championshipContracts.js';
import {interactiveTutorialInProgress, sameInteractiveTutorialCheckpoint} from './interactiveTutorialCheckpoint.js';
import {initializeNativeTutorialRaisingActor,requestNativeTutorialHatch,stepNativeTutorialRaisingActor,restoreNativeTutorialHatchedActor,tutorialRaisingIdle,tutorialRaisingPosition as placeNativeTutorialRaisingActor,tutorialRaisingCondition,tutorialRaisingSleep,tutorialRaisingFeed,tutorialRaisingTreat,tutorialRaisingCarry,tutorialRaisingRelease,tutorialRaisingTraining,tutorialRaisingStatus} from '../raising/nativeTutorialRaisingActor.js';
import {tutorialRaisingStep,TUTORIAL_RAISING_STEPS} from './interactiveTutorialRaisingSteps.js';
import {TUTORIAL_STEP_COUNT,createTutorialCursor, tutorialFinished, tutorialStepAt, advanceTutorial as advanceTutorialStep,
  skipTutorial as skipTutorialCursor} from './nativeTutorialProgression.js';
import {tutorialLine, tutorialPrompt} from '../text/tutorialMessages.zhHant.js';
import { uiText } from '../text/uiText.js';
import {nativeTreatmentAdmission} from '../raising/nativeRaisingTreatment.js';
import {treatNativeRaisingActor,notifyNativeRaisingResidentAdded,beginNativeRaisingCarry,releaseNativeRaisingCarry,cancelNativeRaisingCarry,beginNativeRaisingStroke,releaseNativeRaisingStroke,touchNativeRaisingActor} from '../raising/nativeRaisingActor.js';
import {classifyNativeRaisingHand,stepNativeRaisingStrokeInput,nativeRaisingHandAdmission} from '../raising/nativeRaisingHand.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,interruptNativeRaisingFeeding,removeNativeRaisingFoodTarget,projectNativeRaisingActor,stepNativeRaisingActor,stepNativeRaisingAgeClock,touchNativeRaisingEgg,wakeNativeRaisingActor,startNativeRaisingMorning,stepNativeRaisingEvolution,enterNativeRaisingCage,beginNativeRaisingNap} from "../raising/nativeRaisingActor.js";
import {NATIVE_RAISING_LIFECYCLE_RULES} from '../raising/nativeRaisingLifecycle.js';
import {CLOCK_POLICIES,CLOCK_POLICY_NATIVE,CLOCK_POLICY_REALTIME,REALTIME_FOOD_UNITS_PER_SECOND,REALTIME_WAKE_SECONDS,REALTIME_DISTURBANCE,isNightNap,offlineGrowthSeconds,
  realtimeAgeRate,realtimeClockAdvance,realtimeDayPeriod,takeAgeUnits,REALTIME_RECOVERY_CAGES,REALTIME_RECOVERY_TICKS_PER_SECOND,
  realtimeRecoveryEffect} from '../time/realtimeClock.js';
import {monthlyCalendarFor,monthlyCalendarMatches} from '../time/monthlyCalendar.js';
import {selectWeeklyEligibleMatches,projectWeeklyRaisingCalendar} from '../time/weeklyTitleSchedule.js';
import {applyNativeRaisingCondition} from '../raising/nativeRaisingCare.js';
// The ranch ground for either layout: the original board, or (expansion
// prototype) the same ring continued into its annex.
import {createRanchRaisingGround as createNativeRaisingGround,ranchRaisingSpawnPosition as nativeRaisingSpawnPosition,
  ranchRaisingEntryPosition as nativeRaisingEntryPosition,alignRanchRaisingPosition} from "../raising/nativeRaisingRanchRing.js";
import {createNativeRaisingFood,stepNativeRaisingFood,foodVisualQuarter,nativeRaisingFeast,reconcileNativeFoodReservations} from "../raising/nativeRaisingFood.js";
import {separateNativeRaisingGroundActors} from '../raising/nativeGroundSpacing.js';
import {stepRanchConveyor} from '../raising/ranchConveyor.js';
import {PRODUCT_RANCH_GRID,PRODUCT_WAITING_ROOM_SLOT,productGridCell,productPlacementCells,repairProductRanchPlacements} from '../cage/productRanchGrid.js';
import {ownedModuleCount} from '../cage/cageInventory.js';
import {WAITING_ROOM_MODULE} from '../cage/nativeRanchLayout.js';
import {normalizeNativeRaisingHome,nativeRaisingRebuiltListOrder} from "../raising/nativeRaisingHomeState.js";
import {allocateNativeRaisingWaste} from '../raising/nativeRaisingWaste.js';
import {projectNativeRaisingCalendar} from '../raising/nativeRaisingCalendar.js';
import {createNativeTitleProgress,emptyNativeTitleProgress,normalizeNativeTitleProgress,
  toggleNativeTitleRegistration,toggleNativeChampionshipRegistration,resolveNativeTitleResult,applyNativeBattleRecord} from '../battle/nativeTitleProgression.js';
import {settleNativeRaisingCage,nativeCageConditionEffects} from '../raising/nativeRaisingOvernight.js';
import { maxGFromInventory } from "../hunt/capture/memoryCardCapacity.js";
import { createHuntInventory } from "../hunt/loadout/huntInventory.js";
import { createHuntLoadout } from "../hunt/loadout/huntLoadoutRuntime.js";
import { HUNT_STARTING_INVENTORY, getHuntCatalogItem } from "../hunt/loadout/huntEquipmentCatalog.js";
import {
  applyMappedHuntInventoryFromShop,
  createShopRuntime
} from "../shop/shopRuntime.js";
import { projectDatabase } from "../database/databaseRuntime.js";
import { getDatabaseSlot } from "../database/databaseCatalog.js";
import {getDatabaseIllustration} from '../database/databaseIllustrations.js';
import { registerNativeBookSpecies, retainOwnedBookSpecies } from "../database/nativeBookRegistration.js";
import {getShopRecord,BITS_WALLET_CAP} from '../shop/shopCatalog.js';
import { createCageEditRuntime } from "../cage/cageEditRuntime.js";
import { normalizeTamerRank, slotCountForTamerRank, listCageDefinitions } from "../cage/cageCatalog.js";
import { getCageDefinitionByModuleId, getGachaCageDefinitionByEdition } from "../cage/productCageCatalog.js";
import { validateRanchLayout } from '../cage/ranchExpansion.js';
import { getMatchRecord, matchEntryFee, matchPayout, resolveMatchList } from "../battle/battleMatchSelection.js";
import { BATTLE_OUTCOME_TEAM_ZERO_AHEAD, BATTLE_OUTCOME_TEAM_ONE_AHEAD } from "../battle/battleOutcome.js";
import { NATIVE_CHAMPIONSHIP_CATEGORIES, CHAMPIONSHIP_ARENA_INDEX, createNativeChampionshipRun,
  normalizeNativeChampionshipRun, recordNativeChampionshipRound, nativeChampionshipContinues,
  nativeChampionshipFinalRound, nativeChampionshipPayable, selectNativeChampionshipOpponent } from "../battle/nativeChampionshipRounds.js";
import {generateNativeFreeBattleMenu,listNativeFreeBattleMatches,FREE_BATTLE_ARENAS,freeBattlePreset} from '../battle/nativeFreeBattle.js';
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

/** The six persistent stats an evolution panel rolls, before -> after (display only). */
export function evolutionStatChange(before, after) {
  try {
    const a = projectNativeIndividualStats(before), b = projectNativeIndividualStats(after);
    return Object.freeze([['hp', 'maxHp'], ['tp', 'maxTp'], ['attack', 'attack'], ['defense', 'defense'], ['wisdom', 'wisdom'], ['speed', 'speed']]
      .map(([key, field]) => Object.freeze({key, before: a[field] | 0, after: b[field] | 0})));
  } catch { return null; }
}

// Owner 2026-11-10: a real-time hunt lasts one real minute; chrono cartridges add the rest.
export const REALTIME_HUNT_BASE_MINUTES = 144;

export function createChampionshipStandaloneApp({
  storage,
  playtestPolicy = null,
  // Owner 2026-11-04: the product economy -- the diamond wallet, the 10 x 10 hex land and its diamond
  // rows -- stands apart from the friends playtest (which only adds its grant and opens everything).
  // The public entry turns it on; the default app keeps the original economy and grid.
  productEconomy = false,
  locks = globalThis.window?.navigator?.locks,
  catalog,
  cages = [],
  sessionId = STANDALONE_SESSION_ID,
  slotId = STANDALONE_SLOT_ID,
  huntStartingInventory = HUNT_STARTING_INVENTORY,
  huntCaptureReplay = null,
  // Local review only: async (gate) => expansion catalogue or null.
  huntExpansionLoader = null,
  // Local review only (?huntInstinctQa, HUNT_INSTINCT_VFX_20261110): (index) => an instinct id that replaces the roll.
  huntInstinctOverride = null,
  // HUNT_SPAWN_SPREAD_20261110: false keeps the native entry positions (a test that scripts one partner's path).
  huntSpawnSpread = true,
  // Null means the built-in one, fetched when a hunt starts. Its subtree is
  // the field controls, the wild actors and their tables, which nothing before
  // the field reads. A caller that supplies its own factory never fetches it.
  huntRuntimeFactory = null,
  rngClock = () => {
    const date = new Date();
    return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
  },
  now = () => new Date().toISOString(),
  deviceBirthday = () => null,
  // Owner 2026-10-28 partner life (moods, stroll finds, greetings). The product
  // shell turns it on; harnesses keep the original frame-for-frame behaviour.
  partnerLife = false,
  // OWNER_APPROVED_ADAPTATION 2026-11-02: the product shell runs the ranch on the device's local time
  // (REALTIME_V1); harnesses keep the native fast clock (time/realtimeClock.js).
  clockPolicy = CLOCK_POLICY_NATIVE,
  // Cyber Gachapon draws (product randomness, not the ROM channel sequence).
  gachaRandom = Math.random,
  // Harness seam: a fixed ranch capacity in G for flows that test the 16 native slots (null = rank + land).
  ranchCapacityOverrideG = null
} = {}) {
  if (!catalog) throw new TypeError("Championship standalone app requires a product entities catalog");
  const savePort = createChampionshipPersistentSavePort({ storage, now, locks });

  const cageIds = cages.map((cage) => cage.cageId);
  if (!CLOCK_POLICIES.includes(clockPolicy)) throw new TypeError("CHAMPIONSHIP_CLOCK_POLICY_UNKNOWN");
  const realtime = clockPolicy === CLOCK_POLICY_REALTIME;
  // Real time: when the clock last matched the device, fractional age per partner, and who is awake at night.
  let realtimeLastMs = null, realtimeSyncAt = -Infinity, huntRealtime = null;
  const realtimeAge = new Map(), realtimeWake = new Map();
  const realNowMs = () => { const ms = Date.parse(now()); return Number.isFinite(ms) ? ms : Date.now(); };
  // The original clock runs 02:00-23:59 and its field lighting is undefined at 00:xx/01:xx (negative trig index).
  // The real-time clock does reach those hours, where every hunt entry threw and the loadout's Start did nothing;
  // a hunt then uses the earliest defined night hour, 02:00. The native clock never gets there and is unchanged.
  const huntSceneClock = clock => realtime && clock.clockMinutes < 120 ? { ...clock, clockMinutes: 120 } : clock;
  let session = null;
  let creature = null;
  let revision = 0;
  let interactionCount = 0;
  // Production Raising state. Owned here, never by the frozen R2 reducer.
  let raising = null;
  let selectedCreatureId = null;
  const raisingActors = new Map();
  let raisingHand=null;
  let raisingGround=null;
  let discoveryCheckAt=0;
  let raisingFoods=[];
  let raisingWaste=[];
  let automationPatrolFrames=0;
  let raisingDayTransition=null;
  let raisingDayConfirmation=false;
  let raisingLifecycleMessage=null;
  let raisingEvolutionRate=1;
  const raisingDirtySignals=new Map();
  let raisingPoolSlots={};
  const raisingListeners = new Set();
  let raisingAgeRemainder = 0;
  let instanceIdentity = null;
  let battleEconomy = createBattleEconomyState();
  let battleTransactionActive = false;
  let battlePartyIds = null;
  // Party admission, slot rules and owned-creature building are only read while
  // the player is picking a team at the battle menu. Fetched then, cached after,
  // and warmed in the background by main.js once any screen is up.
  let battlePartyModule = null;
  const loadBattleParty = async () =>
    (battlePartyModule ??= await import("../battle/battleParty.js"));
  let passwordBattleModule = null;
  const loadPasswordBattle = async () =>
    (passwordBattleModule ??= await import("../battle/nativePasswordBattle.js"));
  let linkBattleModule = null;
  const loadLinkBattle = async () =>
    (linkBattleModule ??= await import("../battle/nativeLinkBattle.js"));
  // The attempt a tournament round is being fought under, if any. A round is an
  // ordinary battle; what differs is that its verdict belongs to the run, and
  // the title result waits for the whole run rather than reading one round.
  let championshipAttemptId = null;
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
  // Wild instinct of this hunt's wild partners by wildId (AWAKENING_OVERDRIVE_20261109); cleared at the Home commit.
  let huntInstincts = new Map();
  let huntDeadlineMinute = null;
  let huntEntryError = null;
  // The Shop owns the inventory; the loadout only reads it.
  let huntInventory = null;
  let huntLoadout = null;
  let shop = null;
  let friendsPlaytest = null;
  // Owner 2026-11-04: what the last Continue repaired in a refused ranch layout (null when nothing).
  let ranchLoadRepair = null;
  /**
   * The cage editor for a saved layout. A layout the editor refuses (a full ranch saved on 2026-11-04
   * was refused with ChampionshipCageEditError and locked the whole save) is repaired rather than
   * refusing Continue. The editor is opened and its frame built, so the ownership check runs here too:
   * copies placed beyond the copies owned go back to storage (saved order kept), then the largest
   * valid hex world in the saved order, else the starting ranch. Every cage stays owned; partners
   * whose cage is gone move to the waiting room as on any load.
   */
  function loadCageEditor(snapshot) {
    ranchLoadRepair = null;
    const open = value => {
      const editor = createCageEditRuntime({ snapshot: value, publicTestGrid: productLand, initialTamerRank: tamerRankValue });
      editor.getFrame(...cageEditArgs());
      return editor;
    };
    try { return open(snapshot); }
    catch (error) {
      const code = typeof error?.message === 'string' ? error.message : 'UNKNOWN';
      if (error?.name !== 'ChampionshipCageEditError' && !/RANCH|CAGE/.test(code)) throw error;
      console.warn('CHAMPIONSHIP_RANCH_LAYOUT_REPAIRED', code);
      if (snapshot?.layoutVersion === PRODUCT_RANCH_GRID && Array.isArray(snapshot.placements)) {
        // Copies beyond what is owned (bought copies plus royal editions) first, then the cell rules.
        const [stock] = cageEditArgs(), placedOf = new Map();
        const owned = snapshot.placements.filter(entry => {
          const placed = (placedOf.get(entry?.moduleId) ?? 0) + 1;
          placedOf.set(entry?.moduleId, placed);
          return entry?.moduleId === WAITING_ROOM_MODULE || placed <= ownedModuleCount(entry?.moduleId, stock);
        });
        const repair = repairProductRanchPlacements(owned);
        try {
          const editor = open({ ...snapshot, placements: repair.placements });
          ranchLoadRepair = Object.freeze({ code, removed: snapshot.placements.length - repair.placements.length, reset: false });
          return editor;
        } catch { /* fall through to the starting ranch */ }
      }
      ranchLoadRepair = Object.freeze({ code, removed: Array.isArray(snapshot?.placements) ? snapshot.placements.length : 0, reset: true });
      return createCageEditRuntime({ initializeOriginal: true, publicTestGrid: productLand, initialTamerRank: tamerRankValue });
    }
  }
  const productLand = productEconomy === true || playtestPolicy?.enabled === true;
  // Owner 2026-10-29: the save's record of a paid first-bind reward (onlineBindRewardPolicy.js).
  let onlineBindReward = null;
  let lastShopReceipt = null;
  let lastGachaResult = null;
  let lastBattleGachaDrop = null;
  let lastHuntGachaBoosts = Object.freeze([]);
  let lastHuntRareLure = null;
  let gachaSerial = 0;
  let selectedDatabaseSpeciesIndex = null;
  let cageEdit = null;
  // Original PlayerData +0xAE8. Title matches write it; until battle exists this
  // is a PRODUCT_AUTHORED seam (setTamerRank), same shape as creditBits.
  let tamerRankValue = 0;
  let battleBadgesValue = [];
  let nativeTitles=emptyNativeTitleProgress();
  // The tournament in progress, or null. Carried through save so a round
  // boundary is not a place the player can lose a run by closing the tab.
  let championshipRun=null;
  let freeBattleMenu=null;
  // Each partner's battle plan (作戰方針): instance id -> 0 or 2; absent = 1.
  let battleTactics={};
  // OWNER_APPROVED_ADAPTATION 2026-10-29: Cyber Gachapon (tickets, chips, metals, bloodlines).
  let cyberGacha=null;
  // DIAMOND_ECONOMY_20261102: royal cages placed in the facility draft (instanceId -> edition),
  // the royal card picked in the tray, the last automation events and diamond rewards for the UI.
  let draftRoyalEditions=null;
  let pendingRoyalEdition=null;
  let automationEvents=[];
  let automationSerial=0;
  // AUTO_CARE_3D_20261103: the deployed machines on the current ground (never saved: the save keeps only
  // each machine's seconds left), the robots leaving after their hour, and the run clock's carry.
  let autoCare={ground:null,cleaners:new Map(),feeders:new Map(),retiring:[],runCarry:0,saveCarry:0,wasteKeys:new WeakMap(),wasteSerial:0};
  let lastDiamondRewards=Object.freeze([]);
  let lastLandExpansion=null;
  // OWNER_APPROVED_ADAPTATION 2026-11-02: burst evolution unlocks per partner (STAGE_REDESIGN_BURST_20261102).
  let burstEvolution=null;
  // OWNER_APPROVED_ADAPTATION 2026-11-09: Sync Level per partner (BATTLE_MODE_PRISM_AND_JOURNEY_20261109).
  let syncLevels=null,lastSyncGains=null;
  // OWNER_APPROVED_ADAPTATION 2026-11-10: Journey (tower and patrol pod).
  let journey=null,pendingTower=null,lastTowerResult=null,pendingCampaign=null;
  let nativeMessages=createNativeRaisingMessages();
  let nativeOpening=null;
  // Immutable rollback data, never another live session/store or storage key.
  let tutorialBaseline=null;
  let tutorialPendingOpening=null;
  let tutorialTransitionActive=false;
  let tutorialCommitActive=false;
  let tutorialOfferEligible=false;
  let tutorialHuntCandidate=null;
  let tutorialBattleCandidate=null;
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
    if(screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)cancelRaisingHand();
    for (const listener of [...screenListeners]) {
      try { listener(screens.current()); } catch { /* observers never break navigation */ }
    }
  }

  /** Drop every expedition choice and leave the player at Raising Home. */
  function resetExpedition() {
    tutorialBattleCandidate?.runtime.dispose();tutorialBattleCandidate=null;
    tutorialHuntCandidate=null;
    huntRuntime = null;
    huntDeadlineMinute = null; huntRealtime = null;
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
    const stock=shop?.toSave() ?? [];
    // Owner 2026-11-03: a royal cage (bag or placed) is a copy of its own module, counted from the gachapon.
    const royal=royalCageCopies();
    if(!royal.size)return stock;
    return Array.isArray(stock)?{cageOwned:stock,gachaCages:Object.fromEntries(royal)}:{...stock,gachaCages:Object.fromEntries(royal)};
  }

  function tamerRank() {
    return tamerRankValue;
  }

  function progressionContext() {
    return { tamerRank: tamerRankValue, battleBadges: [...battleBadgesValue],feeWaiver:nativeTitles.feeWaiver, playtestUnlocks: playtestPolicy?.enabled === true && playtestPolicy.huntOpen };
  }

  function applyProgression() {
    const progression = progressionContext();
    shop?.setProgression(progression);
    huntInventory?.setProgression(progression);
  }

  function cageEditArgs() {
    return [shopCageOwned(), tamerRank()];
  }

  // The grant changes the saved layout version, so the ground is rebuilt from
  // the committed layout exactly as a confirmed edit rebuilds it.
  function changeRanchExpansion(change) {
    if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
    const editor = requireCageEdit();
    const before = JSON.stringify(editor.toSave());
    storeNativeRaisingPositions(); storeNativeRaisingHome();
    const frame = change(editor);
    if (JSON.stringify(editor.toSave()) !== before) {
      raisingActors.clear(); initializeNativeRaisingHome(); savePort.markDirty();
    }
    publishScreens();
    return frame;
  }

  function requireCageEdit() {
    if (!cageEdit) throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_OPEN");
    return cageEdit;
  }

  function openShopAndHunt({ shopSnapshot = null, newSave = false } = {}) {
    lastShopReceipt = null;
    const progression = progressionContext();
    if (shopSnapshot) {
      // Continue: Shop snapshot is the inventory authority. Hunt starts empty
      // and receives only the mapped SKUs the Shop currently owns.
      huntInventory = createHuntInventory({ entries: [], ...progression });
      shop = createShopRuntime({ allowRepeatedCages:playtestPolicy?.enabled===true, allItemsVisible: playtestPolicy?.enabled === true && playtestPolicy.shopOpen, huntInventory, snapshot: shopSnapshot, progression });
      applyMappedHuntInventoryFromShop(shop, huntInventory);
    } else {
      huntInventory = createHuntInventory({ entries: huntStartingInventory, ...progression });
      // Custom starting inventories are a controlled fixture seam. Seed the
      // same Shop authority that purchases, consumption and saves will use.
      shop = createShopRuntime({ allowRepeatedCages:playtestPolicy?.enabled===true, allItemsVisible: playtestPolicy?.enabled === true && playtestPolicy.shopOpen, huntInventory, progression, initialHuntInventory:huntInventory });
    }
    const grant = newSave ? grantFriendsPlaytestCoins(shop.getBits(), friendsPlaytest, shop.getFrame().bitsCap, playtestPolicy) : {bits:shop.getBits(),state:friendsPlaytest,granted:0};
    if (grant.granted) shop.applyBitsTransaction({expectedBits:shop.getBits(),bits:grant.bits});
    // Owner 2026-11-04: with the product economy every save has the diamond wallet; the playtest grant only fills it.
    friendsPlaytest = productEconomy ? productDiamondWallet(grant.state) : grant.state;
    if (grant.granted) savePort.markDirty();
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
    if(tutorialBaseline)return Object.freeze({accepted:false,code:"INTERACTIVE_TUTORIAL_ACTIVE"});
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

  // listRaisingInstances answers by deep-cloning every source, revalidating each
  // individual's hundred-odd ROM words twice and freezing the result, and the
  // raising frame advance asks it for the roster on every frame. Profiled in the
  // enclosure on a throttled phone that was about a fifth of the main thread
  // with a single resident, and it grows with the collection.
  //
  // Every source here is immutable: a change replaces the object rather than
  // writing into it, and the results are deep-frozen, so when all five are the
  // same objects as last time the answer cannot have changed. Any new reference
  // recomputes, so this sees a change exactly when the old code did -- it only
  // stops redoing the work on data that did not move.
  //
  // Only the frame advance uses this. The public roster readers keep calling
  // listRaisingInstances directly: they hand the array outward, and callers
  // there are entitled to a fresh one.
  //
  // Every caller gets its own copy. Both frame-advance callers sort the list in
  // place, which was harmless while each call built a new array and corrupts a
  // shared one: caching without the copy fails the enclosure carry gate. The
  // copy is sixteen strings; the work being skipped is the clone and the
  // revalidation.
  let instanceListCache = null;
  function currentInstanceIds() {
    const sources = instanceSources();
    const cached = instanceListCache;
    if (cached
      && cached.creature === sources.creature
      && cached.residents === sources.residents
      && cached.collection === sources.collection
      && cached.assignments === sources.assignments
      && cached.interactions === sources.interactions) return cached.entries.slice();
    const entries = listRaisingInstances(sources).map((entry) => entry.instanceId);
    instanceListCache = { ...sources, entries };
    return entries.slice();
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

  /** Cage instances that are currently a partner's home (live actors and saved assignments). */
  function ranchResidentInstances() {
    const homes=new Set(Object.values(raising?.nativeHome?.cageAssignments??{}));
    for(const actor of raisingActors.values())if(actor.cageInstanceId)homes.add(actor.cageInstanceId);
    return homes;
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
    if(tutorialBaseline||!raisingGround)return;
    const foods=raisingFoods.filter(f=>f.present&&raisingGround.origin(f.cageInstanceId??f.cageDefinitionIndex)).map(f=>{
      const origin=raisingGround.origin(f.cageInstanceId??f.cageDefinitionIndex);
      return {slot:f.slot,cageDefinitionIndex:f.cageDefinitionIndex,...(f.cageInstanceId?{cageInstanceId:f.cageInstanceId}:{}),localPositionQ12:f.positionQ12.map((n,i)=>n-origin[i]*4096),
        protein:f.protein,...(f.kind>=2?{kind:f.kind}:{}),remaining:f.remaining,freshness:f.freshness};
    });
    const waste=raisingWaste.filter(w=>w.present&&raisingGround.origin(w.cageInstanceId??w.cageDefinitionIndex)).map(w=>{
      const origin=raisingGround.origin(w.cageInstanceId??w.cageDefinitionIndex);return {slot:w.slot,speciesIndex:w.speciesIndex,cageDefinitionIndex:w.cageDefinitionIndex,...(w.cageInstanceId?{cageInstanceId:w.cageInstanceId}:{}),
        localPositionQ12:w.positionQ12.map((n,i)=>n-origin[i]*4096)};});
    raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({version:1,poolSlots:raisingPoolSlots,foods,waste,
      ...(raising.nativeHome?.discoveries?{discoveries:raising.nativeHome.discoveries}:{}),
      ...(raising.nativeHome?.strollLog?{strollLog:raising.nativeHome.strollLog}:{}),
      cageAssignments:Object.fromEntries([...raisingActors].filter(([,a])=>a.cageInstanceId).map(([id,a])=>[id,a.cageInstanceId])),
      evolutionBranches:raising.nativeHome?.evolutionBranches??[],
      ...(raising.nativeHome?.productEvolutionBranches?{productEvolutionBranches:raising.nativeHome.productEvolutionBranches}:{}),
      ...(raising.nativeHome?.pendingOvernightMinutes!==undefined?{pendingOvernightMinutes:raising.nativeHome.pendingOvernightMinutes}:{})})});
    settleDiscoveries();
  }

  function settleDiscoveries() {
    if(tutorialBaseline||!raisingGround?.navigation||!raising?.nativeHome)return;
    const time=new Date(now()).getTime();if(!Number.isSafeInteger(time)||time<0)return;
    const participants=[...raisingActors].filter(([,a])=>a.speciesIndex>=8&&a.cageInstanceId&&raisingGround.placement(a.cageInstanceId))
      .map(([id,a])=>({id,cageId:a.cageInstanceId}));
    const previous=raising.nativeHome.discoveries;
    const discoveries=settleRanchDiscoveries(previous,time,participants);
    discoveryCheckAt=time;
    if(JSON.stringify(previous)===JSON.stringify(discoveries))return;
    raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,discoveries})});
    savePort.markDirty();
  }

  // Partner life (OWNER_APPROVED_ADAPTATION 2026-10-28). A stroll now and then
  // turns up an item, partners who meet in one connected area greet each other
  // and find twice as much, and a tap reads the partner's mood from its own
  // fields. A find is saved to nativeHome.strollLog as waiting and paid into the
  // Shop inventory by 收下發現, together with the discoveries (Owner 2026-11-03).
  const partnerLifeState={strollFrames:new Map(),nextFindAt:new Map(),greetings:[],pairsSeen:new Map(),events:[],eventSeq:0,quietFrames:0,greetingGap:null};
  const partnerLifeListeners=new Set();
  // Product draws only: the native gameplay stream is never consumed here.
  let partnerLifeSeed=(Date.now()^0x5bd1e995)>>>0;
  function partnerLifeRandom(){
    partnerLifeSeed=(partnerLifeSeed+0x6d2b79f5)>>>0;let t=partnerLifeSeed;
    t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;
  }
  // The player's nickname, else the catalog name; never the internal species code.
  function partnerName(id){
    const entry=resolveRaisingInstance(instanceSources(),id);
    return strollLogName(localizeSpeciesCodes(entry?.displayName??'')||(entry?speciesNameForId(entry.speciesId):null));
  }
  function partnerReading(id,actor=nativeRaisingActor(id)){
    const profile=raisingNativeProfile(id);if(!actor||!profile||actor.speciesIndex<8)return null;
    const fields=profile.fields,maxHp=Number(fields['058'])||0,home=actor.cageInstanceId??actor.cageDefinitionIndex;
    const dirty=Boolean(actor.growthFields?.['408'])||raisingWaste.some(w=>w.present&&(w.cageInstanceId??w.cageDefinitionIndex)===home);
    // A clean race habitat (Owner 2026-10-29) is a cozy home: the partner's mood lifts and its finds grow.
    const raceHabitat=habitatMatch(actor.speciesIndex,actor.cageDefinitionIndex);
    const native=partnerHabitatFit({speciesIndex:actor.speciesIndex,cageDefinitionIndex:actor.cageDefinitionIndex,dirty,
      hpRatio:maxHp>0?(Number(fields['050'])||0)/maxHp:1});
    const habitat=raceHabitat&&!dirty?'cozy':native;
    const mood=partnerMood({fields,growth:actor.growthFields??{},state:actor.state,statusMusic:actor.statusMusic,habitat});
    return Object.freeze({mood,emoji:PARTNER_MOODS[mood].emoji,habitat,raceHabitat,hearts:partnerAffectionHearts(fields),
      affection:Math.max(0,Math.min(100,Number(fields['020'])||0)),greeting:partnerLifeState.greetings.some(g=>g.a===id||g.b===id),
      // Owner 2026-11-04: its next form would overfill the cage for this tamer rank.
      crowded:Boolean(actor.capacityBlocked)});
  }
  function partnerRegion(actor){
    const nav=raisingGround?.navigation,home=`cage:${actor.cageInstanceId??actor.cageDefinitionIndex}`;
    if(!nav?.ownerAt||!actor.positionQ12)return home;
    const owner=nav.ownerAt([actor.positionQ12[0]>>12,actor.positionQ12[1]>>12]);
    const region=owner?nav.regionOf(owner.ownerIndex):null;
    return region===null||region===undefined?home:`region:${region}`;
  }
  function emitPartnerLife(event){
    const row=Object.freeze({...event,seq:++partnerLifeState.eventSeq,at:Date.now()});
    partnerLifeState.events.push(row);if(partnerLifeState.events.length>24)partnerLifeState.events.splice(0,partnerLifeState.events.length-24);
    for(const listener of [...partnerLifeListeners])try{listener(row);}catch{/* observers never change partner life */}
    return row;
  }
  // Owner 2026-11-03: a find is written to the saved log as waiting (claimed:false); 收下發現
  // (collectRanchDiscoveries) pays it into the same Shop inventory the toolbar and the bag read.
  // A slot already full refuses the find, so nothing waits that could never be paid.
  function grantStrollDiscoveryReward({partnerId,partnerB=null,relation=null,reward,quantity=1,cage=null,calendar}){
    if(!session||tutorialBaseline||!raising?.nativeHome||battleTransactionActive||huntCommitActive)return {ok:false,reason:'UNAVAILABLE'};
    const spec=STROLL_REWARDS[reward];
    if(!spec||!Number.isInteger(quantity)||quantity<1||quantity>2||!calendar)return {ok:false,reason:'INVALID_REWARD'};
    storeNativeRaisingPositions();storeNativeRaisingHome();
    const listing=spec.record===undefined?null:requireShop().getFrame().listings?.find(row=>row.shopRecordIndex===spec.record)??null;
    const room=spec.bits?(requireShop().getBits()<BITS_WALLET_CAP?quantity:0):listing?Math.min(quantity,Math.max(0,listing.maxOwned-listing.owned)):quantity;
    if(!room)return {ok:false,reason:'INVENTORY_FULL'};
    const at=Date.now(),dayKey=strollDayKey(calendar);
    const strollLog=appendStrollEntry(raising.nativeHome.strollLog,{kind:partnerB?'greeting':'find',reward,quantity:room,partnerId,
      partnerName:partnerName(partnerId),cage:Number.isInteger(cage)?cage:null,season:calendar.season,day:calendar.day,minute:calendar.minute,
      ...(partnerB?{partnerB,partnerBName:partnerName(partnerB),relation}:{}),claimed:false},{dayKey,at});
    const nextRaising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,strollLog})});
    const status=savePort.save({...liveSaveRequest(revision+1),raising:nextRaising});
    if(status.phase!=='SAVED'){savePort.discardPendingWrite();return {ok:false,reason:'SAVE_FAILED'};}
    raising=nextRaising;revision++;
    const entry=strollLog.entries.at(-1),owned=listing?.owned??null;
    emitPartnerLife({kind:'find',entry,tool:spec.tool,owned,pending:true});
    publishRaising();
    return {ok:true,entry,tool:spec.tool,owned,pending:true};
  }
  /** Is this partner out of its own cage (walking a passage or in a neighbour's cage)? */
  function partnerOffHome(actor){
    if(actor.explorationRoute?.length)return true;
    const nav=raisingGround?.navigation;if(!nav?.ownerAt||!actor.positionQ12)return false;
    const owner=nav.ownerAt([actor.positionQ12[0]>>12,actor.positionQ12[1]>>12]);if(!owner)return false;
    const placement=raisingGround.placements?.find(p=>p.ownerIndex===owner.ownerIndex);
    if(!placement)return false;
    return actor.cageInstanceId?placement.instanceId!==actor.cageInstanceId:placement.definitionIndex!==actor.cageDefinitionIndex;
  }
  function partnerCanMeet(actor){
    return actor.speciesIndex>=8&&!actor.detached&&Boolean(actor.positionQ12)&&!actor.evolution&&!(actor.greetingHold>0)
      &&(actor.state===1||(actor.state===2&&actor.foodSlot===null&&actor.mode===0))&&!actor.explorationVisit;
  }
  function partnerSpecies(actor){
    const species=nativeHuntSpeciesByIndex(actor.speciesIndex);
    return {speciesIndex:actor.speciesIndex,typeBits:partnerTypeBits(actor.speciesIndex),attribute:species?.attribute};
  }
  function stepPartnerLife(before){
    if(!partnerLife||tutorialBaseline||!raisingGround||!raising?.nativeHome||raisingHand||raisingDayTransition
      ||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return;
    const calendar={season:before.season,day:before.dayOfSeason,minute:before.clockMinutes},dayKey=strollDayKey(calendar),at=Date.now();
    // A greeting ends after its hold and pays the pair one doubled find.
    for(const greeting of partnerLifeState.greetings)greeting.frames--;
    const finished=partnerLifeState.greetings.filter(g=>g.frames<=0);
    partnerLifeState.greetings=partnerLifeState.greetings.filter(g=>g.frames>0);
    for(const greeting of finished){
      const actor=nativeRaisingActor(greeting.a),find=rollStrollFind(partnerLifeRandom(),actor?.cageDefinitionIndex??null,{greeting:true});
      grantStrollDiscoveryReward({partnerId:greeting.a,partnerB:greeting.b,relation:greeting.relation,reward:find.kind,quantity:find.quantity,
        cage:actor?.cageDefinitionIndex??null,calendar});
    }
    // Owner 2026-11-03: partners only stroll -- and so only meet or find things -- once a passage links
    // two cages; in one closed cage they rest and do not greet each other every minute.
    if(!(raisingGround?.navigation?.connections?.length>0))return;
    const free=[...raisingActors].filter(([,actor])=>partnerCanMeet(actor));
    partnerLifeState.quietFrames++;
    partnerLifeState.greetingGap??=greetingGapFrames(partnerLifeRandom());
    if(partnerLifeState.quietFrames>=partnerLifeState.greetingGap)meet:for(let i=0;i<free.length;i++)for(let j=i+1;j<free.length;j++){
      const [idA,a]=free[i],[idB,b]=free[j];
      // A real meeting on the way: at least one of the two is out walking, off its own cage.
      if(!partnerOffHome(a)&&!partnerOffHome(b))continue;
      const radius=Math.max(nativeRaisingPeerStopDistanceQ12(a)??0,nativeRaisingPeerStopDistanceQ12(b)??0)/4096+8;
      const dx=(a.positionQ12[0]-b.positionQ12[0])/4096,dy=(a.positionQ12[1]-b.positionQ12[1])/4096;
      if(dx*dx+dy*dy>radius*radius||partnerRegion(a)!==partnerRegion(b))continue;
      const key=strollPairKey(idA,idB),seen=partnerLifeState.pairsSeen.get(key);
      if((seen!==undefined&&at-seen<PARTNER_LIFE_RULES.pairCooldownMs)||!canGreet(raising.nativeHome.strollLog,dayKey,idA,idB,at))continue;
      partnerLifeState.pairsSeen.set(key,at);
      if(!holdNativeRaisingActorForGreeting(a,b.positionQ12,PARTNER_LIFE_RULES.greetingFrames))continue;
      if(!holdNativeRaisingActorForGreeting(b,a.positionQ12,PARTNER_LIFE_RULES.greetingFrames)){a.greetingHold=0;continue;}
      const relation=partnerPeerRelation(partnerSpecies(a),partnerSpecies(b));
      partnerLifeState.greetings.push({a:idA,b:idB,relation,frames:PARTNER_LIFE_RULES.greetingFrames});
      partnerLifeState.quietFrames=0;partnerLifeState.greetingGap=greetingGapFrames(partnerLifeRandom());
      emitPartnerLife({kind:'greeting',a:idA,b:idB,relation});
      break meet;
    }
    // Solo strolls: each partner keeps its own interval of walking time.
    for(const [id,actor] of free){
      if(!(actor.state===1||actor.state===2)||actor.greetingHold>0)continue;
      let next=partnerLifeState.nextFindAt.get(id);
      if(next===undefined){next=strollIntervalFrames(partnerLifeRandom());partnerLifeState.nextFindAt.set(id,next);}
      const walked=(partnerLifeState.strollFrames.get(id)??0)+1;
      if(walked<next){partnerLifeState.strollFrames.set(id,walked);continue;}
      partnerLifeState.strollFrames.set(id,0);partnerLifeState.nextFindAt.set(id,strollIntervalFrames(partnerLifeRandom()));
      if(!canStrollFind(raising.nativeHome.strollLog,dayKey))continue;
      const reading=partnerReading(id,actor);
      if(!reading||partnerLifeRandom()>=strollFindChance(reading.habitat,reading.mood,{raceHabitat:Boolean(reading.raceHabitat)}))continue;
      const find=rollStrollFind(partnerLifeRandom(),actor.cageDefinitionIndex);
      grantStrollDiscoveryReward({partnerId:id,reward:find.kind,quantity:find.quantity,cage:actor.cageDefinitionIndex,calendar});
      break;
    }
  }

  function storeNativeRaisingPositions() {
    if(tutorialBaseline||!raisingGround)return;
    for(const [id,actor] of raisingActors) {
      const current=raisingNativeProfile(id),origin=raisingGround.origin(actor.cageInstanceId??actor.cageDefinitionIndex);
      if(!current||!origin||!actor.positionQ12)continue;
      const x=((actor.positionQ12[0]-origin[0]*4096)>>12)>>>0,y=((actor.positionQ12[1]-origin[1]*4096)>>12)>>>0;
      if(current.fields["014"]!==actor.cageDefinitionIndex||current.fields["1c0"]!==x||current.fields["1c4"]!==y) {
        const next=structuredClone(current);next.fields["014"]=actor.cageDefinitionIndex;next.fields["1c0"]=x;next.fields["1c4"]=y;
        writeRaisingNativeProfile(id,next);
      }
    }
  }

  function initializeNativeRaisingHome({tutorialBoundary=false,restoreLayoutPositions=false}={}) {
    raisingGround=createNativeRaisingGround({...cageEdit.toSave(),unlockedCount:slotCountForTamerRank(tamerRankValue)});
    raisingFoods=[];raisingWaste=[];raisingDayTransition=null;raisingDayConfirmation=false;raisingLifecycleMessage=null;raisingDirtySignals.clear();raisingPoolSlots={...raising?.nativeHome?.poolSlots};
    if(!raisingGround)return;
    for(const f of raising.nativeHome?.foods??[]) {
      const origin=raisingGround.origin(f.cageInstanceId??f.cageDefinitionIndex);
      if(origin)raisingFoods.push(createNativeRaisingFood({...f,cageInstanceId:f.cageInstanceId??raisingGround.placement(f.cageDefinitionIndex)?.instanceId,positionQ12:f.localPositionQ12.map((n,i)=>n+origin[i]*4096),restored:true}));
    }
    for(const w of raising.nativeHome?.waste??[]){const origin=raisingGround.origin(w.cageInstanceId??w.cageDefinitionIndex);
      if(!origin)continue;
      const positionQ12=w.localPositionQ12.map((n,i)=>n+origin[i]*4096);
      raisingWaste.push({...w,cageInstanceId:w.cageInstanceId??cageInstanceAt(positionQ12)??raisingGround.placement(w.cageDefinitionIndex)?.instanceId,present:true,positionQ12});}
    // Owner 2026-11-03: an auto-clean cage never keeps droppings from before it was cleaned, or from an older save.
    sweepAllAutomatedCages();
    if(restoreInteractiveTutorialActor()) {storeNativeRaisingHome();return;}
    if(raising.nativeHome?.pendingOvernightMinutes!==undefined&&!tutorialBoundary)settleRaisingOvernight();
    else synchronizeNativeRaisingActors(tutorialBoundary||restoreLayoutPositions?{
      restorePositions:true,initializationRng:restoreChannelRng(gameplayRngSnapshot())
    }:{});
    storeNativeRaisingHome();
  }

  function spawnRaisingWaste(definition,speciesIndex,positionQ12,cageInstanceId=null) {
    // DIAMOND_ECONOMY_20261102: a royal cage clears it at once (the partner still counts it as done). A deployed
    // cleaning robot (AUTO_CARE_3D_20261103) drives over and sweeps it up instead.
    if(cageInstanceId&&cyberGacha&&cageAutomation(cyberGacha,cageInstanceId).royal){autoCleanWaste(cageInstanceId,positionQ12);return true;}
    const waste=allocateNativeRaisingWaste(raisingWaste,{speciesIndex,cageDefinitionIndex:definition,positionQ12});
    if(!waste)return false;if(cageInstanceId)waste.cageInstanceId=cageInstanceId;raisingWaste=raisingWaste.filter(w=>w.present);raisingWaste.push(waste);
    raisingDirtySignals.set(cageInstanceId??definition,{dirtyAdded:true});savePort.markDirty();return true;
  }

  function settleRaisingOvernight() {
    const remaining=raising?.nativeHome?.pendingOvernightMinutes;
    if(!raisingGround||remaining===undefined)return;
    // 02083358 constructs all actors (including their new positions) before
    // 02083910 settles daylight and night. Cage pool record order is distinct
    // from screen slot order: the original start is definitions 35, 0, 1, 15.
    const rng={next:nextGameplayRandom};
    raisingHand=null;raisingActors.clear();synchronizeNativeRaisingActors({deferActivity:true});
    for(const food of raisingFoods){food.occupants.fill(null);food.positionQ12[2]=0;}
    for(const [minutes,night] of [[remaining,false],[540,true]]) {
      for(const placement of raisingGround.placements){
        const definition=placement.definitionIndex,owner=placement.instanceId??definition;
        const entries=nativeRaisingRebuiltListOrder([...raisingActors].filter(([,actor])=>(actor.cageInstanceId??actor.cageDefinitionIndex)===owner).sort((a,b)=>a[1].poolSlot-b[1].poolSlot));
        const foods=nativeRaisingRebuiltListOrder(raisingFoods.filter(f=>f.present&&(f.cageInstanceId??f.cageDefinitionIndex)===owner).sort((a,b)=>a.slot-b.slot));
        const result=settleNativeRaisingCage(entries.map(([id])=>raisingNativeProfile(id)),{
          definition,minutes,night,foods,wasteCount:raisingWaste.filter(w=>w.present&&(w.cageInstanceId??w.cageDefinitionIndex)===owner).length,rng,
          effects:nativeCageConditionEffects(definition,requireSession().getRaisingHomeSnapshot().season),
          spawnWaste:species=>spawnRaisingWaste(definition,species,nativeRaisingSpawnPosition(raisingGround,owner,rng),placement.instanceId)});
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

  function synchronizeNativeRaisingActors({deferActivity=false,restorePositions=false,initializationRng=null}={}) {
    if(!raisingGround)return;
    const ids=currentInstanceIds(),live=new Set(ids);
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
      const savedOwner=raising.nativeHome?.cageAssignments?.[id];
      let placement=raisingGround.placement(savedOwner??definition);
      if(!placement) {
        profile=structuredClone(profile);profile.fields["014"]=35;profile.fields["1c0"]=0;profile.fields["1c4"]=0;
        definition=35;placement=raisingGround.placement(35);writeRaisingNativeProfile(id,profile);
      }
      actor.cageInstanceId=placement.instanceId;
      const origin=raisingGround.origin(placement.instanceId??definition),rng=initializationRng??{next:nextGameplayRandom};
      const position=[(profile.fields["1c0"]|0)*4096+origin[0]*4096,(profile.fields["1c4"]|0)*4096+origin[1]*4096,0];
      // Initialize the per-slot RNG fields before the original source-grid
      // spawn. Hatch keeps the same body; adults entering Home select a point.
      actor.poolSlot=raisingPoolSlots[id];
      initializeNativeRaisingActor(actor,profile,position,definition,rng,
        !restorePositions&&(actor.speciesIndex>=8||(profile.fields["1c0"]===0&&profile.fields["1c4"]===0))
          ? ()=>actor.speciesIndex>=8?nativeRaisingEntryPosition(raisingGround,placement.instanceId??definition,rng,actor.poolSlot)
            :nativeRaisingSpawnPosition(raisingGround,placement.instanceId??definition,rng):null,{deferActivity,
              onJoin:()=>notifyNativeRaisingResidentAdded(actor,raisingActors.values(),rng)});
      const aligned=alignRanchRaisingPosition(raisingGround,actor.positionQ12,placement.instanceId??definition);
      if(aligned!==actor.positionQ12){actor.positionQ12=aligned;actor.destinationQ12=[...aligned];}
    }
  }

  function advanceNativeRaising(frames,before) {
    synchronizeNativeRaisingActors();
    // Real time: each partner ages at its stage's pace and the night is a nap (time/realtimeClock.js).
    const nowMs=realtime?realNowMs():0,night=realtime&&isNightNap(before.clockMinutes);
    // Training and care move the awakening conditions; refresh the ranch signs about once a second of play.
    burstCheckFrames+=frames;if(burstCheckFrames>=60){burstCheckFrames=0;refreshAwakeningSigns();}
    const ids=currentInstanceIds();
    let priorMinutes=0,changed=false;
    for(let frame=1;frame<=frames;frame++) {
      advanceRaisingHand();
      const minutes=realtime?0:Math.floor((before.clockUnits+before.clockSubunits/1000+frame*NATIVE_CLOCK_CADENCE.elapsedUnitsPerFrame)/NATIVE_CLOCK_CADENCE.trainingDivisor);
      const age=realtime?{ageDelta:takeAgeUnits(realtimeAge,'food',REALTIME_FOOD_UNITS_PER_SECOND/60)}:stepNativeRaisingAgeClock(raisingAgeRemainder,minutes-priorMinutes);
      if(!realtime){priorMinutes=minutes;raisingAgeRemainder=age.remainder;}
      const signals=new Map();
      for(const food of raisingFoods) {
        const wasFresh=food.present&&food.freshness>0;
        const result=stepNativeRaisingFood(food,age.ageDelta);
        if(wasFresh&&food.freshness<=0)raisingDirtySignals.set(food.cageInstanceId??food.cageDefinitionIndex,{dirtyAdded:true});
        if(result.search||result.landed){const previous=signals.get(food.cageInstanceId??food.cageDefinitionIndex)??{};
          signals.set(food.cageInstanceId??food.cageDefinitionIndex,{search:previous.search||result.search,landed:previous.landed||result.landed});}
      }
      reconcileNativeFoodReservations(raisingActors.values(),raisingFoods);
      for(const id of ids.sort((a,b)=>raisingPoolSlots[a]-raisingPoolSlots[b])) {
        const actor=nativeRaisingActor(id);
        if(!actor)continue;
        const residents=[...raisingActors].filter(([,other])=>!other.detached&&(other.cageInstanceId??other.cageDefinitionIndex)===(actor.cageInstanceId??actor.cageDefinitionIndex)).sort((a,b)=>a[1].poolSlot-b[1].poolSlot);
        let ageDelta=age.ageDelta;
        if(realtime){
          ageDelta=takeAgeUnits(realtimeAge,id,realtimeAgeRate(nativeHuntSpeciesByIndex(actor.speciesIndex).generation,{starterEgg:isStarterEgg(id,raisingNativeProfile(id))})/60);
          if(night&&!((realtimeWake.get(id)??0)>nowMs)){
            const napped=beginNativeRaisingNap(actor,raisingNativeProfile(id),{next:nextGameplayRandom});
            if(napped){writeRaisingNativeProfile(id,napped);changed=true;}
          }
        }
        const result=stepNativeRaisingActor(actor,raisingNativeProfile(id),{ageDelta,rng:{next:nextGameplayRandom},
          feeding:raisingGround?{ground:raisingGround,foods:raisingFoods,signals,actors:raisingActors.values()}:null,
          // The playtest lifts the rank's evolution ceiling and cage capacity (Owner 2026-11-04).
          lifecycle:raisingGround?{rank:playtestPolicy?.enabled===true?9:Math.min(9,tamerRankValue),minute:before.clockMinutes+minutes,season:before.season,
            training:realtime?REALTIME_TRAINING_POLICY:null,trainingBonus:royalTrainingBonus(actor),capacityBonusG:ranchLandBonusG(),
            overdrive:realtime?training=>overdriveTraining(id,training):null,
            cageEffects:realtime&&REALTIME_RECOVERY_CAGES.includes(actor.cageDefinitionIndex)?[]:undefined,
            onJoin:()=>notifyNativeRaisingResidentAdded(actor,[...raisingActors.values()].filter(a=>!a.detached),{next:nextGameplayRandom}),
            getResidents:()=>[...raisingActors].filter(([,a])=>!a.detached&&(a.cageInstanceId??a.cageDefinitionIndex)===(actor.cageInstanceId??actor.cageDefinitionIndex)).sort((a,b)=>a[1].poolSlot-b[1].poolSlot).map(([key])=>raisingNativeProfile(key)),
            roster:[actor.speciesIndex,...ids.filter(other=>other!==id).map(other=>raisingNativeProfile(other).fields['000'])],
            residents:residents.map(([other])=>raisingNativeProfile(other)),wasteCount:raisingWaste.filter(w=>w.present&&(w.cageInstanceId??w.cageDefinitionIndex)===(actor.cageInstanceId??actor.cageDefinitionIndex)).length,
            rottenFoodCount:raisingFoods.filter(f=>f.present&&(f.cageInstanceId??f.cageDefinitionIndex)===(actor.cageInstanceId??actor.cageDefinitionIndex)&&f.freshness<=0).length,
            ...raisingDirtySignals.get(actor.cageInstanceId??actor.cageDefinitionIndex),spawnWaste:(species,position)=>spawnRaisingWaste(actor.cageDefinitionIndex,species,position,actor.cageInstanceId)}:null});
        if(result.changed) {writeRaisingNativeProfile(id,result.profile);changed=true;}
        // Owner 2026-11-03: a partner fresh out of its egg stays up a while before any night nap.
        if(result.hatched)realtimeWake.set(id,realNowMs()+REALTIME_WAKE_SECONDS*1000);
        // DIAMOND_ECONOMY_20261102: a royal cage feeds a hungry partner and speeds up its sleep (a deployed
        // feeding tower throws meat instead: stepAutoCare).
        if(autoFeedRaisingPartner(id,actor))changed=true;
        if(royalSleepStep(id,actor,ageDelta))changed=true;
        if(realtime&&realtimeRecoveryStep(id,actor,before.season))changed=true;
        if(result.landed){storeNativeRaisingPositions();savePort.markDirty();}
        if(result.evolutionStarted){publishRaising();return;}
      }
      reconcileNativeFoodReservations(raisingActors.values(),raisingFoods);
      if(raisingGround)for(const actor of raisingActors.values())if(stepRanchConveyor(actor,raisingGround))changed=true;
      if(raisingGround&&separateNativeRaisingGroundActors(raisingActors.values(),raisingGround).changed)changed=true;
      if(stepAutoCare(1/60))changed=true;
      raisingDirtySignals.clear();
      if(++automationPatrolFrames>=60){automationPatrolFrames=0;if(sweepAllAutomatedCages())changed=true;}
      stepPartnerLife(before);
    }
    if(raisingGround)storeNativeRaisingHome();
    if(changed)publishRaising();
  }

  // ---- Real-time clock (OWNER_APPROVED_ADAPTATION 2026-11-02; time/realtimeClock.js) ----
  /** Move the world clock to the device's local time (whole real days, then the minute). Returns minutes moved. */
  function syncRealtimeClock(nowMs=realNowMs(),{rollForward=false}={}){
    if(!realtime||!session||tutorialBaseline||huntCommitActive)return 0;
    const active=requireSession(),before=active.getRaisingHomeSnapshot();
    // A device clock set back: the world clock waits for it to catch up.
    if(realtimeLastMs!==null&&nowMs<realtimeLastMs)return 0;
    const advance=realtimeClockAdvance({clockMinutes:before.clockMinutes,lastMs:realtimeLastMs??nowMs,nowMs,rollForward});
    realtimeLastMs=nowMs;
    // WEEKLY_SEASON_20261110 (Owner 2026-11-10): one real week per season, one month per championship year
    // (time/monthlyCalendar.js). The season and day follow the device date, also for a save from the old clock.
    const target=monthlyCalendarFor(nowMs),realign=Boolean(target)&&!monthlyCalendarMatches(before,target);
    if(advance<=0&&!realign)return 0;
    const minutes=Math.max(0,advance);
    active.advanceRaisingClock({units:minutes*400,divisor:400,clearElapsed:true,expectedClockRevision:before.clockRevision,
      ...(target?{calendar:{year:target.year,season:target.season,dayOfSeason:target.dayOfSeason}}:{})});
    const after=active.getRaisingHomeSnapshot();
    if(after.season!==before.season||after.dayOfSeason!==before.dayOfSeason)rebuildFreeBattleMenu();
    nativeMessages=ageNativeRaisingMessages(nativeMessages,minutes);
    const start=before.clockMinutes,end=start+minutes;
    // 07:00 opens the day's messages and entry check; each new hour every partner may check its evolution again.
    if(Math.floor((end-420)/1440)>Math.floor((start-420)/1440))nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,entryChecked:false,morningPending:true});
    if(Math.floor(end/60)>Math.floor(start/60))for(const actor of raisingActors.values())actor.evolutionChecked=false;
    savePort.markDirty();
    return minutes;
  }
  /** Growth while the game was closed: age only (no hunger, sickness or death), at most to the end of a stage. */
  function applyOfflineGrowth(seconds){
    if(!realtime||!(seconds>0))return;
    for(const id of partnerIds()){
      const profile=partnerProfile(id);if(!profile)continue;
      const index=profile.fields['000'],rule=NATIVE_RAISING_LIFECYCLE_RULES.species[index];
      const generation=index<8?0:nativeHuntSpeciesByIndex(index).generation;
      if(generation>=4||(index>=8&&!rule))continue;
      const life=index<8?60:profile.fields['04c']?NATIVE_RAISING_LIFECYCLE_RULES.extendedLife[generation]:rule.life;
      const age=profile.fields['18c']>>>0,grown=Math.min(Math.max(age,life),age+Math.floor(realtimeAgeRate(generation,{starterEgg:isStarterEgg(id,profile)})*seconds));
      if(grown>age){const next=structuredClone(profile);next.fields['18c']=grown>>>0;writeRaisingNativeProfile(id,next,{markDirty:false});}
    }
  }
  /**
   * At night a touch, feeding or treatment wakes a partner for ten minutes. Handling a sleeping partner awake
   * (`disturb`: a tap, the hand, a carry) also disturbs it (OWNER_APPROVED_ADAPTATION 2026-11-02, night disturbance):
   * 育成妨礙 on the native care-mistake count and lost affection. Returns true when it disturbed a sleeper.
   */
  function wakeRealtimePartner(id,{disturb=false}={}){
    if(!realtime||!session||!isNightNap(requireSession().getRaisingHomeSnapshot().clockMinutes))return false;
    realtimeWake.set(id,realNowMs()+REALTIME_WAKE_SECONDS*1000);
    const actor=raisingActors.get(id),profile=raisingNativeProfile(id);
    if(!actor||!profile)return false;
    let woken=wakeNativeRaisingActor(actor,profile,raisingFoods,{next:nextGameplayRandom});
    if(!woken)return false;
    const disturbed=disturb&&actor.speciesIndex>=8;
    if(disturbed){
      const next=structuredClone(woken),rule=REALTIME_DISTURBANCE;
      next.narrowFields['03d']=Math.min(rule.careMistakeMaximum,(next.narrowFields['03d']|0)+rule.careMistakes);
      next.fields['020']=Math.max(0,(next.fields['020']|0)-rule.affectionLoss);
      woken=normalizeNativeIndividualProfile(next);
    }
    writeRaisingNativeProfile(id,woken);
    if(disturbed)emitPartnerLife({kind:'disturbed',partnerId:id});
    publishRaising();
    return disturbed;
  }
  /** 「讓拍檔休息」: every idle partner lies down now (at night it sleeps until morning). */
  function restRaisingPartners(){
    let changed=false;
    for(const [id,actor] of raisingActors){
      realtimeWake.delete(id);
      const profile=raisingNativeProfile(id);if(!profile)continue;
      const napped=beginNativeRaisingNap(actor,profile,{next:nextGameplayRandom});
      if(napped){writeRaisingNativeProfile(id,napped);changed=true;}
    }
    if(changed){savePort.markDirty();publishRaising();}
    return Object.freeze({accepted:true,code:'REST'});
  }

  function advanceRaisingHand(){
    const hand=raisingHand;if(!hand)return;
    const actor=raisingActors.get(hand.id),profile=raisingNativeProfile(hand.id);
    if(!actor||!profile){raisingHand=null;return;}
    const write=p=>{if(p){writeRaisingNativeProfile(hand.id,p);savePort.markDirty();}};
    if(hand.mode===3){
      if(!hand.held){write(releaseNativeRaisingCarry(actor,profile));raisingHand=null;}
      else if(actor.state===6){actor.carryPointer={...hand.pointer};actor.carryCameraX=hand.pointer.cameraX??0;}
      else raisingHand=null;
      return;
    }
    if(hand.mode===4){
      const step=stepNativeRaisingStrokeInput({held:hand.held,elapsed:hand.elapsed,previous:hand.previous,pointer:hand.pointer,
        actorScreen:{x:actor.positionQ12[0]/4096,y:(actor.positionQ12[1]-actor.positionQ12[2])/4096}});
      hand.elapsed=step.counter;hand.previous={...hand.pointer};
      if(step.result===0){releaseNativeRaisingStroke(actor);raisingHand=null;}
      return;
    }
    const result=classifyNativeRaisingHand({held:hand.held,elapsed:hand.elapsed,origin:hand.origin,pointer:hand.pointer,
      admit:command=>nativeRaisingHandAdmission(actor,command),inside:hand.inside});
    hand.elapsed=(hand.elapsed+1)&65535;
    if(result===-1)return;
    if(result===3){const p=beginNativeRaisingCarry(actor,profile,hand.pointer,{ground:raisingGround,foods:raisingFoods,rng:{next:nextGameplayRandom}});
      if(p){actor.carryCameraX=hand.pointer.cameraX??0;write(p);hand.mode=3;return;}}
    if(result===4){const p=beginNativeRaisingStroke(actor,profile,{foods:raisingFoods,rng:{next:nextGameplayRandom}});
      if(p){write(p);hand.mode=4;hand.elapsed=0;hand.previous={...hand.pointer};return;}}
    if(result===2)write(touchNativeRaisingActor(actor,profile,{foods:raisingFoods,rng:{next:nextGameplayRandom}}));
    raisingHand=null;
  }

  function cancelRaisingHand(){
    if(!raisingHand)return;
    if(raisingHand.mode===1){raisingHand=null;return;}
    raisingHand.held=false;advanceRaisingHand();
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
      progressCounter: tamerRankValue,
      // WEEKLY_SEASON_20261110: on the real-time clock the open list is the weekly schedule's current slot
      // (time/weeklyTitleSchedule.js); battleRuntime.listMatches takes it instead of the native filter.
      ...(realtime ? { weeklyRecords: selectWeeklyEligibleMatches({ season: snapshot.season, dayOfSeason: snapshot.dayOfSeason,
        minute: snapshot.clockMinutes, progressCounter: tamerRankValue }) } : {})
    });
  }

  function rebuildFreeBattleMenu(){
    const season=requireSession().getRaisingHomeSnapshot().season;
    if(!Number.isInteger(season)||season<0||season>3){freeBattleMenu=null;return;}
    freeBattleMenu=generateNativeFreeBattleMenu({season,nextChannel:nextGameplayRandom});
    savePort.markDirty();
  }

  function enterPreparedLocalBattle({mode,attemptId,playerInstanceIds=[],passwords=null,linkKey=null,rngPreparation}){
    requireSession();
    if(battleTransactionActive)return {ok:false,reason:'TRANSACTION_ACTIVE'};
    if(screens.current()!==CHAMPIONSHIP_SCREENS.BATTLE_SELECT)return {ok:false,reason:'BATTLE_SELECT_NOT_ACTIVE'};
    const prepared=battleRngPreparations.get(rngPreparation);
    const passwordMode=mode===4,linkMode=mode===3,transientMode=passwordMode||linkMode;
    if(!prepared||prepared.localMode!==mode||prepared.session!==session||prepared.base!==JSON.stringify(gameplayRngSnapshot())
      ||(mode===2&&prepared.freeMenu!==freeBattleMenu)
      ||(transientMode
        ?(passwordMode?JSON.stringify(passwords)!==JSON.stringify(prepared.passwords):linkKey!==prepared.linkKey)
        :JSON.stringify(playerInstanceIds)!==JSON.stringify(prepared.individuals.map(p=>p.instanceId)))
      // A Sync-boosted copy is checked against the same boost of the saved individual.
      ||(!transientMode&&prepared.individuals.some(p=>JSON.stringify(boostSyncNativeProfile(raisingNativeProfile(p.instanceId),p.syncLevel??1))!==JSON.stringify(p.nativeProfile))))
      return {ok:false,reason:'BATTLE_PREPARATION_STALE',message:'隊伍或遊戲進度已更新，請重新選擇。'};
    const result=applyBattleTransaction(beginBattleAttempt(battleEconomy,{attemptId,matchIndex:-1,mode,battleType:0,
      entryFee:0,payout:mode===2?prepared.freeMatch.payout:0,expectedRounds:1},requireShop().getBits()),[],prepared.rng,[],mode===2?{begin:attemptId,kind:'FREE'}:null);
    if(!result.ok||result.duplicate)return result;
    battleRngPreparations.delete(rngPreparation);battlePartyIds=transientMode?null:[...playerInstanceIds];
    screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD);publishScreens();return result;
  }

  function restoreCandidate(save) {
    assertPlayableProductSaveData(save);
    for(const entry of [save.creature,...(save.raising?.collection??[])]){
      const index=entry?.nativeProfile?.fields?.['000']??Number(entry?.speciesId?.replace(/^championship:creature:/,'').replace(/^species-/,''));
      if(getProductExtension(index))requirePlayableProductExtension(index);
    }
    if(interactiveTutorialInProgress(save.progression.nativeOpening)&&save.gameplayRng===null)
      throw new Error("INTERACTIVE_TUTORIAL_RNG_REQUIRED");
    const { document } = deserializeRaisingHomeSaveR2(save.raisingHome);
    const snapshot = restoreRaisingHomeSnapshotR2(document, { sessionId });
    for(const entry of snapshot.residents){const index=entry?.nativeProfile?.fields?.['000']??Number(entry?.speciesId?.replace(/^championship:creature:/,'').replace(/^species-/,''));if(getProductExtension(index))requirePlayableProductExtension(index);}
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

  // ---- Sync Level (OWNER_APPROVED_ADAPTATION 2026-11-09) -----------------
  // The level is read from the save and, once per rebirth, cut to 30 %. A
  // battle copy of the individual carries the boost; finishMatch takes it off.
  function syncState(){return syncLevels??(syncLevels=createSyncLevelState());}
  function syncProfileOf(instanceId){return instanceId===creature?.creatureId?creature.nativeProfile??null:raisingNativeProfile(instanceId);}
  function syncLevelOf(instanceId){
    const rebirths=Math.max(0,((syncProfileOf(instanceId)?.narrowFields?.['03c']??0)<<24)>>24);
    const seen=normalizeSyncLevels(syncLevels).partners[instanceId]?.rebirths??0;
    if(rebirths>seen)syncLevels=reconcileSyncRebirth(syncLevels,instanceId,rebirths);
    return syncOf(syncLevels,instanceId);
  }
  /** Level a battle reads: capped by tamer rank in title matches and championships. */
  function syncBattleLevel(instanceId,sync){
    if(!sync)return 1;
    const lv=syncLevelOf(instanceId).level;
    return sync.capped?Math.min(lv,syncCapForRank(tamerRankValue)):lv;
  }
  /** Pay one settled battle's Sync EXP to the partners that fought it. */
  function grantBattleSync(instanceIds,{kind,won,attemptId=null}){
    const gains=[];
    for(const instanceId of instanceIds){
      const amount=syncBattleExp(syncLevelOf(instanceId).level,{kind,won});
      if(amount<=0)continue;
      const granted=grantSyncExp(syncState(),instanceId,amount);
      syncLevels=granted.state;gains.push(granted.gain);
    }
    lastSyncGains=gains.length?Object.freeze({attemptId,kind,won,gains:Object.freeze(gains)}):null;
    return lastSyncGains;
  }
  const SYNC_KIND_BY_MODE=Object.freeze({0:'CHAMPIONSHIP',1:'TITLE',2:'FREE',5:'PRACTICE'});

  // ---- Journey: tower and patrol (OWNER_APPROVED_ADAPTATION 2026-11-10) ----
  function journeyState(){return journey??(journey=createJourneyState());}
  function journeyNow(){return Date.now();}
  function journeyLocalDay(){const d=new Date(journeyNow());return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function addSyncCrystals(amount){
    if(!(amount>0))return;
    const state=normalizeSyncLevels(syncState());syncLevels={...state,crystals:Math.min(1e9,state.crystals+amount)};
  }
  /** A finished tower floor: the climb, and on a first clear its crystals, tickets and guardian diamonds. */
  function settleTowerFloor(attemptId,won){
    const tower=pendingTower;
    if(!tower||tower.attemptId!==attemptId)return null;
    pendingTower=null;
    if(!won){lastTowerResult=Object.freeze({attemptId,floor:tower.floor,won:false,rewards:null,next:tower.floor,team:tower.team});return lastTowerResult;}
    const cleared=clearTowerFloor(journeyState(),tower.floor,tower.team);
    journey=cleared.state;
    const rewards=cleared.rewards;
    let tickets=0,diamonds=0;
    if(rewards){
      addSyncCrystals(rewards.crystals);
      let gacha=gachaState();
      if(rewards.tickets){const grant=grantGachaTickets(gacha,rewards.tickets);gacha=grant.state;tickets=grant.granted;}
      const paid=rewards.diamonds?payDiamondRewards([Object.freeze({key:`dia:tower:${rewards.floor}`,kind:'TOWER',value:rewards.floor,amount:rewards.diamonds})],{state:gacha}):null;
      if(paid?.ok&&paid.granted)diamonds=paid.granted;
      else if(tickets&&!commitGacha({state:gacha}))tickets=0;
    }
    savePort.markDirty();
    lastTowerResult=Object.freeze({attemptId,floor:tower.floor,won:true,team:tower.team,
      rewards:rewards?Object.freeze({...rewards,tickets,diamonds}):null,next:tower.floor<TOWER_FLOORS?tower.floor+1:null});
    return lastTowerResult;
  }

  // Free Battle and Practice read the plan (they run the original personality
  // wiring); the individuals carry it to buildOwnedBattleCreature.
  function withBattleTactics(party) {
    if (!party?.ok) return party;
    return {...party,individuals:party.individuals.map(individual=>({...individual,tactic:battleTactics[individual.instanceId]??BATTLE_TACTIC_DEFAULT}))};
  }


  // ---- Cyber Gachapon (OWNER_APPROVED_ADAPTATION 2026-10-29) --------------
  // Every pull, synthesis or item use is one durable save before it is shown,
  // the same rule as a playtest cage purchase: no prize exists until it is saved.
  function gachaState(){return cyberGacha??(cyberGacha=grantGachaWelcome(null).state);}
  function gachaProfile(instanceId){return instanceId===creature?.creatureId?creature.nativeProfile??null:raisingNativeProfile(instanceId);}
  function gachaShopCandidate(){
    return createShopRuntime({snapshot:requireShop().toSave(),allowRepeatedCages:playtestPolicy?.enabled===true,
      allItemsVisible:playtestPolicy?.shopOpen===true,progression:progressionContext()});
  }
  function commitGacha({state,friends=friendsPlaytest,shopCandidate=null}){
    const status=savePort.save({...liveSaveRequest(revision+1),cyberGacha:state,friendsPlaytest:friends,
      shop:(shopCandidate??shop)?(shopCandidate??shop).toSave():null});
    if(status.phase!=='SAVED'){savePort.discardPendingWrite();return false;}
    cyberGacha=state;friendsPlaytest=friends;revision+=1;
    if(shopCandidate){
      shop=createShopRuntime({snapshot:shopCandidate.toSave(),huntInventory,allowRepeatedCages:playtestPolicy?.enabled===true,
        allItemsVisible:playtestPolicy?.shopOpen===true,progression:progressionContext()});
      applyMappedHuntInventoryFromShop(shop,huntInventory);bindShopRuntime();
    }
    return true;
  }
  function gachaPrizeView(prize){
    const entry=prize.kind==='CHIP'?getGachaChip(prize.id):prize.kind==='METAL'?getGachaMetal(prize.id)
      :prize.kind==='BITS'?getGachaBitsBag(prize.id):prize.kind==='TICKETS'?(getGachaTicketPrize(prize.id)??GACHA_TICKET_PRIZE)
      :prize.kind==='AUTOMATION'?getAutomationItem(prize.id):getGachaSupplyPack(prize.id)??getGachaGoods(prize.id);
    return Object.freeze({...prize,name:entry?.name??prize.id,art:entry?.art??null,
      shopRecordIndex:prize.shopRecordIndex??entry?.shopRecordIndex??null,family:entry?.family??null,
      ...(prize.kind==='GOODS'&&getGachaSupplyPack(prize.id)?{itemName:getShopRecord(prize.shopRecordIndex)?.name??null}:{}),
      ...(prize.bonus?{bonus:gachaPrizeView(prize.bonus)}:{})});
  }
  function gachaReceipt(result){
    lastGachaResult=Object.freeze({...result,serial:++gachaSerial});publishScreens();return lastGachaResult;
  }
  function gachaRefusal(reason){return gachaReceipt({ok:false,reason});}

  // ---- Ranch automation and diamonds (OWNER_APPROVED_ADAPTATION 2026-11-02, DIAMOND_ECONOMY_20261102) ----
  // Cores and royal cages live in the gachapon state; the cage instances stay in cageEdit. Since 2026-11-03
  // (Owner) a royal cage is its own module and map (cageCatalog.js definitions 36, 37) and still carries its
  // edition by instance id, which runs its built-in feeding, cleaning and bonuses.
  const ROYAL_ITEMS=AUTOMATION_ITEMS.filter(item=>item.edition);
  const royalModuleOf=item=>getGachaCageDefinitionByEdition(item.edition)?.moduleId??null;
  function royalCageCopies(){
    const copies=new Map();if(!cyberGacha)return copies;
    for(const item of ROYAL_ITEMS){const n=royalTotal(cyberGacha,item.edition),moduleId=royalModuleOf(item);
      if(n>0&&moduleId)copies.set(moduleId,n);}
    return copies;
  }
  /** Royal editions of the facility draft: the committed ones until the draft places or removes one. */
  function royalDraft(){return draftRoyalEditions??{...(cyberGacha?.editions??{})};}
  function royalTrayView(frame){
    const draft=royalDraft(),live=new Set((frame.placements??[]).map(p=>p.instanceId).filter(Boolean));
    return ROYAL_ITEMS.map(item=>{
      const moduleId=royalModuleOf(item),total=royalTotal(gachaState(),item.edition);
      const placed=Object.entries(draft).filter(([id,edition])=>edition===item.edition&&live.has(id)).length;
      return Object.freeze({id:item.id,edition:item.edition,name:item.name,rarity:item.rarity,art:item.art,moduleId,total,
        available:Math.max(0,total-placed),selected:pendingRoyalEdition===item.edition&&frame.selectedModuleId===moduleId});
    }).filter(entry=>entry.total>0);
  }
  /** What each placed cage runs by itself, by instance id (the draft's royal cages included). */
  function cageAutomationView(frame){
    const state={...gachaState(),editions:royalDraft()},out={};
    for(const p of frame.placements??[]){
      if(!p.instanceId)continue;
      const auto=cageAutomation(state,p.instanceId);
      if(auto.clean||auto.feed)out[p.instanceId]=Object.freeze({edition:auto.edition,royal:auto.royal,clean:auto.clean,feed:auto.feed,mounted:auto.mounted,
        cleanSeconds:auto.cleanSeconds,feedSeconds:auto.feedSeconds});
    }
    return Object.freeze(out);
  }
  function landView(frame){
    const grid=frame.productGrid;if(!grid)return null;
    const capacity=Math.min(grid.cellCap,frame.landCapacity??grid.landCapacity),next=grid.landRows?.[0]??null;
    return Object.freeze({capacity,cap:grid.cellCap,used:grid.usedCells,tier:landExpansionTier(capacity),tiers:LAND_EXPANSION.prices.length,price:landExpansionPrice(capacity)??0,
      step:next?.cells??0,nextRow:next?.row??null,max:!next,diamonds:friendsPlaytest?.diamonds??0,
      available:productLand&&Boolean(friendsPlaytest),memoryBonusG:landExpansionTier(capacity)*LAND_EXPANSION.memoryGPerTier});
  }
  function pushAutomationEvent(event){
    automationEvents=[...automationEvents,Object.freeze({...event,serial:++automationSerial})].slice(-12);
  }
  function cageAutomationOf(actor){return actor?.cageInstanceId&&cyberGacha?cageAutomation(cyberGacha,actor.cageInstanceId):null;}
  /** An automated cage clears a dropping at once and pays the cleaning bonus into the bits wallet. */
  function autoCleanWaste(cageInstanceId,positionQ12){
    const credited=shop?Math.max(0,Math.min(AUTOMATION_RULES.cleanBits,BITS_WALLET_CAP-shop.getBits())):0;
    if(credited>0)shop.creditBits(credited,{evidence:'OWNER_APPROVED_ADAPTATION'});
    pushAutomationEvent({kind:'CLEAN',cageInstanceId,bits:credited,positionQ12:positionQ12?[...positionQ12]:null});
    savePort.markDirty();
  }
  /** The placed cage instance whose ground holds this native position, or null. */
  function cageInstanceAt(positionQ12){
    const nav=raisingGround?.navigation;if(!nav?.ownerAt||!positionQ12)return null;
    const owner=nav.ownerAt([positionQ12[0]>>12,positionQ12[1]>>12]);if(!owner)return null;
    return raisingGround.placements?.find(p=>p.ownerIndex===owner.ownerIndex)?.instanceId??null;
  }
  /** Droppings already lying in a royal cage are cleared too -- by owner or by where they lie. */
  function sweepAutomatedCage(instanceId){
    let swept=0;
    for(const waste of raisingWaste)if(waste.present&&(waste.cageInstanceId===instanceId||cageInstanceAt(waste.positionQ12)===instanceId)){
      waste.present=false;swept++;autoCleanWaste(instanceId,waste.positionQ12);}
    if(swept){raisingWaste=raisingWaste.filter(w=>w.present);raisingDirtySignals.set(instanceId,{dirtyRemoved:true});storeNativeRaisingHome();}
    return swept;
  }
  /** Every royal cage on the ground swept at once (a deployed robot sweeps its own cluster). */
  function sweepAllAutomatedCages(){
    if(!raisingGround||!cyberGacha)return 0;
    let swept=0;
    for(const p of raisingGround.placements??[])if(p.instanceId&&cageAutomation(cyberGacha,p.instanceId).royal)swept+=sweepAutomatedCage(p.instanceId);
    return swept;
  }
  /** Whether a partner shows the hungry bubble (native status 3, growth flag 418) or is down to the native hungry satiety. */
  function partnerWantsMeat(id,actor){
    if(actor.detached||actor.evolution||actor.state===4||actor.speciesIndex<8)return false;
    const profile=raisingNativeProfile(id);if(!profile)return false;
    const species=nativeHuntSpeciesByIndex(profile.fields['000']);
    if(!species||species.generation===0)return false;
    return Boolean(actor.growthFields?.['418'])||(profile.fields['008']|0)<=AUTOMATION_RULES.hungrySatiety;
  }
  /** A hungry partner in a royal cage is fed to full at once: +2.4 affection. */
  function autoFeedRaisingPartner(id,actor){
    const auto=cageAutomationOf(actor);
    if(!auto?.royal||!partnerWantsMeat(id,actor))return false;
    return feedPartnerToFull(id,actor,{meat:0});
  }
  /** Feed one partner to full (auto-feed rules): satiety, the hunger counters and the hungry bubble reset, +2.4 affection. */
  function feedPartnerToFull(id,actor,{meat}){
    const profile=raisingNativeProfile(id);if(!profile)return false;
    const species=nativeHuntSpeciesByIndex(profile.fields['000']);if(!species)return false;
    const gain=autoFeedAffection(gachaState().bondCarry?.[id]??0),next=structuredClone(profile);
    next.fields['008']=species.field1c;next.fields['174']=0;next.fields['170']=0;next.fields['184']=0;
    next.fields['020']=Math.min(100,(next.fields['020']|0)+gain.points)>>>0;
    if(actor.growthFields)actor.growthFields['418']=0;
    writeRaisingNativeProfile(id,normalizeNativeIndividualProfile(next));
    cyberGacha=setGachaBondCarry(gachaState(),id,gain.carry,currentInstanceIds());
    pushAutomationEvent({kind:'FEED',cageInstanceId:actor.cageInstanceId,instanceId:id,affection:gain.points,meat,
      positionQ12:actor.positionQ12?[...actor.positionQ12]:null});
    savePort.markDirty();return true;
  }

  // ---- 3D auto-care machines (OWNER_APPROVED_ADAPTATION 2026-11-03, AUTO_CARE_3D_20261103) ----
  // Each deployed core runs a machine for its hour: a cleaning robot that strolls its cage's connected
  // cluster and sweeps droppings, or a feeding tower that throws the player's own meat (one 餵食 each) at
  // partners showing the hungry bubble. The run clock counts real play time; a tower without meat waits.
  function resetAutoCare(){
    for(const bot of autoCare.cleaners.values())releaseRider(bot);
    autoCare={ground:null,cleaners:new Map(),feeders:new Map(),retiring:[],runCarry:0,saveCarry:0,wasteKeys:new WeakMap(),wasteSerial:0};
  }
  function wasteKey(waste){let key=autoCare.wasteKeys.get(waste);if(!key){key='w'+(++autoCare.wasteSerial);autoCare.wasteKeys.set(waste,key);}return key;}
  function placementCellsOf(p){return (productPlacementCells(p)??[]).map(slot=>productGridCell(slot));}
  /** Machines follow the save's runs: a new run brings its machine out, an ended one folds away. */
  function syncAutoCareMachines(){
    if(autoCare.ground!==raisingGround){
      for(const bot of autoCare.cleaners.values())releaseRider(bot);
      autoCare.cleaners.clear();autoCare.feeders.clear();autoCare.retiring=[];autoCare.ground=raisingGround;
    }
    const ground=raisingGround,want=new Set();
    if(ground&&ground.layoutVersion===PRODUCT_RANCH_GRID&&cyberGacha&&!tutorialBaseline)for(const p of ground.placements??[]){
      if(!p.instanceId)continue;
      const auto=cageAutomation(cyberGacha,p.instanceId);
      if(auto.royal||!(auto.cleanSeconds>0||auto.feedSeconds>0))continue;
      if(auto.feedSeconds>0){const key='feed:'+p.instanceId;want.add(key);
        if(!autoCare.feeders.has(key)){const home=machineHome(ground,p.ownerIndex,placementCellsOf(p));
          if(home)autoCare.feeders.set(key,createFeederTower({id:key,instanceId:p.instanceId,home,ground}));}}
      if(auto.cleanSeconds>0){const key='clean:'+p.instanceId;want.add(key);
        if(!autoCare.cleaners.has(key)){const home=machineHome(ground,p.ownerIndex,placementCellsOf(p),{along:30});
          if(home)autoCare.cleaners.set(key,createCleanerBot({id:key,instanceId:p.instanceId,home,ground}));}}
    }
    for(const map of [autoCare.cleaners,autoCare.feeders])for(const [key,machine] of map)if(!want.has(key)){
      if(machine.kind==='CLEANER')releaseRider(machine);
      map.delete(key);autoCare.retiring.push({machine,t:0});
      pushAutomationEvent({kind:'EXPIRE',machine:machine.kind,cageInstanceId:machine.instanceId,positionQ12:[machine.x*4096,machine.y*4096,0]});
    }
  }
  /** A partner riding a robot hops back down where the robot is. */
  function releaseRider(bot){
    const id=bot?.rider?.id;if(!id)return;bot.rider=null;
    const actor=raisingActors.get(id);if(actor?.positionQ12){actor.positionQ12[2]=0;actor.autoCareRide=false;}
  }
  /** One sixtieth of a second for every machine. Returns true when the ranch changed. */
  function stepAutoCare(dt){
    if(!raisingGround||!cyberGacha)return false;
    syncAutoCareMachines();
    autoCare.retiring=autoCare.retiring.filter(entry=>(entry.t+=dt)<AUTO_CARE_RULES.retireSeconds);
    if(!autoCare.cleaners.size&&!autoCare.feeders.size)return false;
    let changed=false;
    const actors=[...raisingActors].filter(([,a])=>!a.detached&&a.positionQ12&&a.speciesIndex>=8);
    // Cleaners: droppings on the ground, nearest first; each robot claims the one it goes for.
    if(autoCare.cleaners.size){
      const waste=raisingWaste.filter(w=>w.present).map(w=>({key:wasteKey(w),x:w.positionQ12[0]/4096,y:w.positionQ12[1]/4096,waste:w}));
      const claimed=new Set(),partners=actors.map(([id,a])=>({id,x:a.positionQ12[0]/4096,y:a.positionQ12[1]/4096,
        generation:nativeHuntSpeciesByIndex(a.speciesIndex)?.generation??9,busy:a.state===4||a.state===6||Boolean(a.evolution)||a.autoCareRide===true||raisingHand?.id===id}));
      for(const bot of autoCare.cleaners.values()){
        for(const event of stepCleanerBot(bot,dt,{ground:raisingGround,waste,claimed})){
          if(event.kind==='LOCK')pushAutomationEvent({kind:'LOCK',cageInstanceId:bot.instanceId,positionQ12:[bot.x*4096,bot.y*4096,0]});
          else if(event.kind==='SWEPT'){const hit=waste.find(w=>w.key===event.key);if(!hit||!hit.waste.present)continue;
            hit.waste.present=false;const owner=hit.waste.cageInstanceId??hit.waste.cageDefinitionIndex;
            raisingWaste=raisingWaste.filter(w=>w.present);raisingDirtySignals.set(owner,{dirtyRemoved:true});
            autoCleanWaste(bot.instanceId,hit.waste.positionQ12);storeNativeRaisingHome();changed=true;}
        }
        for(const event of cleanerCuriosity(bot,partners)){
          pushAutomationEvent({kind:event.kind,cageInstanceId:bot.instanceId,instanceId:event.partnerId,positionQ12:[bot.x*4096,bot.y*4096,0]});
          if(event.kind==='RIDE'){const a=raisingActors.get(event.partnerId);if(a)a.autoCareRide=true;}
        }
        const off=stepCleanerRider(bot,dt);
        if(off){const a=raisingActors.get(off);if(a?.positionQ12){a.positionQ12[2]=0;a.autoCareRide=false;}}
        // A rider sits on the robot's lid and goes where it goes.
        const rider=bot.rider?raisingActors.get(bot.rider.id):null;
        // A rider hops off before the robot leaves its own cage (it never rides into a neighbour's).
        const home=rider?raisingGround.cageAt(bot.x,bot.y):null;
        if(rider?.positionQ12&&!rider.detached&&!rider.evolution&&rider.state!==6&&rider.state!==4
          &&(home?.instanceId??null)===(rider.cageInstanceId??null)){
          rider.positionQ12[0]=Math.round(bot.x*4096);rider.positionQ12[1]=Math.round(bot.y*4096)+1;
          rider.positionQ12[2]=AUTO_CARE_RULES.rideLift*4096;
        }else if(bot.rider)releaseRider(bot);
      }
    }
    // Feeders: partners showing the hungry bubble; one piece of meat per throw, taken when it lands.
    if(autoCare.feeders.size){
      const hungry=actors.filter(([id,a])=>a.autoCareRide!==true&&partnerWantsMeat(id,a)).map(([id,a])=>({id,x:a.positionQ12[0]/4096,y:a.positionQ12[1]/4096}));
      const meat=shop?shop.toSave().quantities[0]??0:0,claimed=new Set();
      for(const tower of autoCare.feeders.values()){
        for(const event of stepFeederTower(tower,dt,{ground:raisingGround,hungry,meat,claimed})){
          if(event.kind==='THROW')pushAutomationEvent({kind:'THROW',cageInstanceId:tower.instanceId,instanceId:event.targetId,positionQ12:[tower.x*4096,tower.y*4096,0]});
          if(event.kind!=='LAND')continue;
          const actor=raisingActors.get(event.targetId);
          if(!actor||!partnerWantsMeat(event.targetId,actor))continue;
          const spent=shop?.consumeRaisingFood(false);
          if(!spent?.ok)continue;
          if(feedPartnerToFull(event.targetId,actor,{meat:AUTOMATION_RULES.feedMeat}))changed=true;
        }
      }
    }
    // The run clock: whole seconds of play, a tower out of meat holding its own.
    autoCare.runCarry+=dt;
    if(autoCare.runCarry>=1){
      const seconds=Math.floor(autoCare.runCarry);autoCare.runCarry-=seconds;
      const paused={};for(const tower of autoCare.feeders.values())if(tower.noMeat)paused[tower.instanceId]=['AUTO_FEED'];
      const ticked=tickAutomationRuns(cyberGacha,seconds,{paused});
      cyberGacha=ticked.state;
      autoCare.saveCarry+=seconds;
      if(ticked.expired.length||autoCare.saveCarry>=15){autoCare.saveCarry=0;savePort.markDirty();}
      if(ticked.expired.length){syncAutoCareMachines();changed=true;}
    }
    return changed;
  }
  /** The machines for the ranch field, in native px (the field turns them into 3D props and tags). */
  function autoCareFrame(){
    if(!raisingGround||!cyberGacha||autoCare.ground!==raisingGround)return Object.freeze({cleaners:Object.freeze([]),feeders:Object.freeze([])});
    const seconds=(machine)=>{const auto=cageAutomation(cyberGacha,machine.instanceId);return machine.kind==='CLEANER'?auto.cleanSeconds:auto.feedSeconds;};
    const cleaner=(bot,retire=null)=>Object.freeze({key:bot.id,instanceId:bot.instanceId,x:bot.x,y:bot.y,heading:bot.heading,mode:bot.mode,
      brush:bot.brush,alert:bot.alert,sweep:bot.sweep,rider:bot.rider?.id??null,retire,seconds:retire===null?seconds(bot):0});
    const feeder=(tower,retire=null)=>Object.freeze({key:tower.id,instanceId:tower.instanceId,x:tower.x,y:tower.y,yaw:tower.yaw,phase:tower.phase,
      t:tower.t,from:tower.from,to:tower.to,targetId:tower.targetId,noMeat:tower.noMeat,retire,seconds:retire===null?seconds(tower):0});
    const leaving=autoCare.retiring.map(entry=>({machine:entry.machine,retire:entry.t/AUTO_CARE_RULES.retireSeconds}));
    return Object.freeze({
      cleaners:Object.freeze([...[...autoCare.cleaners.values()].map(bot=>cleaner(bot)),
        ...leaving.filter(e=>e.machine.kind==='CLEANER').map(e=>cleaner(e.machine,e.retire))]),
      feeders:Object.freeze([...[...autoCare.feeders.values()].map(tower=>feeder(tower)),
        ...leaving.filter(e=>e.machine.kind==='FEEDER').map(e=>feeder(e.machine,e.retire))])
    });
  }
  /** Sleep in a royal cage recovers 30% faster (the native sleep counter 17c advances 1.3x). */
  function royalSleepStep(id,actor,units){
    const auto=cageAutomationOf(actor);if(!auto?.royal||actor.state!==4||!(units>0))return false;
    const bonus=royalSleepBonus(units,actor.royalSleepCarry??0,auto.sleepPercent);actor.royalSleepCarry=bonus.carry;
    if(!bonus.units)return false;
    const profile=raisingNativeProfile(id);if(!profile)return false;
    const next=structuredClone(profile);next.fields['17c']=((next.fields['17c']|0)+bonus.units)>>>0;
    writeRaisingNativeProfile(id,normalizeNativeIndividualProfile(next));return true;
  }
  /** Real time: a recovery cage's condition commands tick once a real second (time/realtimeClock.js). */
  function realtimeRecoveryStep(id,actor,season){
    if(actor.detached||actor.speciesIndex<8||!REALTIME_RECOVERY_CAGES.includes(actor.cageDefinitionIndex))return false;
    const ticks=takeAgeUnits(realtimeAge,`${id}:recovery`,REALTIME_RECOVERY_TICKS_PER_SECOND/60);
    if(!ticks)return false;
    const profile=raisingNativeProfile(id);if(!profile)return false;
    const effects=nativeCageConditionEffects(actor.cageDefinitionIndex,season),satietyMaximum=nativeHuntSpeciesByIndex(actor.speciesIndex).field1c;
    let next=profile;
    for(let i=0;i<ticks;i++){
      actor.recoveryTicks=((actor.recoveryTicks??0)+1)%240;
      for(const e of effects)if(actor.recoveryTicks%e.interval===0)
        next=applyNativeRaisingCondition(next,{...realtimeRecoveryEffect(e,next.fields['058']),satietyMaximum});
    }
    if(['050','01c','020'].every(k=>next.fields[k]===profile.fields[k]))return false;
    writeRaisingNativeProfile(id,next);return true;
  }
  const royalTrainingBonus=actor=>cageAutomationOf(actor)?.royal
    ?Object.freeze({kind:AUTOMATION_RULES.trainingKind,points:AUTOMATION_RULES.royalTrainingPoints}):null;
  /**
   * Ranch tags (Owner 2026-11-03: no banner over the cage): one small countdown per running machine, over the
   * machine itself, with what a battery would do. Native Q12; `lift` is how high above the ground it floats (px).
   */
  function autoCareTags(){
    const frame=autoCareFrame(),state=gachaState(),tags=[];
    const owned=id=>state.automation?.[id]??0;
    for(const [list,kind] of [[frame.feeders,'FEED'],[frame.cleaners,'CLEAN']])for(const m of list){
      if(m.retire!==null)continue;
      const module=kind==='FEED'?'AUTO_FEED':'AUTO_CLEAN',coreId=kind==='FEED'?'auto:feed-core':'auto:clean-core';
      tags.push(Object.freeze({id:m.key,kind,instanceId:m.instanceId,seconds:m.seconds,noMeat:kind==='FEED'&&m.noMeat,alert:kind==='CLEAN'&&m.alert>0,
        coreId,owned:owned(coreId),extendable:m.seconds+AUTOMATION_RULES.runSeconds<=AUTOMATION_RULES.runCapSeconds,module,
        positionQ12:Object.freeze([Math.round(m.x*4096),Math.round(m.y*4096),0]),lift:kind==='FEED'?30:12}));
    }
    return Object.freeze(tags);
  }
  /** Tamer rank and encyclopedia diamonds reached and not yet claimed (the player claims them in the gachapon). */
  function pendingDiamondMilestones(){
    if(!friendsPlaytest||!session)return Object.freeze([]);
    const claimed=gachaState().claimed;
    // A chapter cleared before diamonds existed pays them here once.
    const story=claimed.filter(key=>key.startsWith('story:')).map(key=>key.slice(6))
      .map(id=>Object.freeze({key:diamondRewardKey.story(id),kind:'STORY',value:id,amount:DIAMOND_REWARDS.storyChapter}))
      .filter(entry=>entry.key.length<=60&&!claimed.includes(entry.key));
    return Object.freeze([...story,...dueDiamondMilestones({claimed,rank:tamerRankValue,registeredCount:registeredSpeciesValue.length})]);
  }
  /** Every confirmed cage that can take a core, with what it runs (for the bag's mount list). */
  function automationCageList(state){
    return Object.freeze((cageEdit?.toSave().placements??[]).filter(p=>p.instanceId).map(p=>{
      const auto=cageAutomation(state,p.instanceId);
      return Object.freeze({instanceId:p.instanceId,moduleId:p.moduleId,
        definitionIndex:getCageDefinitionByModuleId(p.moduleId)?.cageDefinitionIndex??null,
        royal:auto.royal,edition:auto.edition,mounted:auto.mounted,clean:auto.clean,feed:auto.feed,
        cleanSeconds:auto.cleanSeconds,feedSeconds:auto.feedSeconds});
    }));
  }
  /** Pay `due` rewards (and record their keys) in one durable save; nothing is paid unless it is saved. */
  function payDiamondRewards(due,{state=gachaState()}={}){
    const fresh=due.filter(entry=>!state.claimed.includes(entry.key));
    if(!friendsPlaytest||!fresh.length)return Object.freeze({ok:true,granted:0,rewards:Object.freeze([])});
    const recorded=recordGachaClaims(state,fresh.map(entry=>entry.key));
    const credit=creditTestDiamonds(friendsPlaytest,fresh.reduce((sum,entry)=>sum+entry.amount,0));
    if(!commitGacha({state:recorded.state,friends:credit.state}))return Object.freeze({ok:false,reason:'SAVE_FAILED'});
    lastDiamondRewards=Object.freeze(fresh.map(entry=>Object.freeze({...entry,serial:++automationSerial})));
    return Object.freeze({ok:true,granted:credit.granted,diamonds:friendsPlaytest.diamonds,rewards:lastDiamondRewards});
  }
  function founderPackView(){
    const claimed=gachaState().claimed.includes(FOUNDER_PACK.key),unlocked=founderPackUnlocked({medals:battleBadgesValue});
    return Object.freeze({key:FOUNDER_PACK.key,art:FOUNDER_PACK_ART,diamonds:FOUNDER_PACK.diamonds,tickets:FOUNDER_PACK.tickets,
      items:Object.freeze(FOUNDER_PACK.items.map(([id,quantity])=>Object.freeze({id,quantity,name:getAutomationItem(id).name,art:getAutomationItem(id).art}))),
      frame:FOUNDER_PACK.frame,unlock:FOUNDER_PACK.unlock,unlocked,claimed,available:Boolean(friendsPlaytest)&&unlocked&&!claimed});
  }
  /** The rope colour an emergency bundle refills: the rope in hand, else the best colour ever held. */
  function emergencyRopeFamily(itemId){
    const families=requireShop().getFrame().huntFamilies.filter(f=>f.kind==='ROPE');
    return families.find(f=>f.productItemId===itemId&&f.tier>=0)??families.filter(f=>f.tier>=0).at(-1)??families[0];
  }
  // GACHA_FULL_EFFECTS_20261109 (Owner 2026-11-09): the ranch holds partners up to its capacity in G -- the rank's
  // capacity plus the land bonus (memoryGPerTier per expansion, the same G the memory card gains) -- and never more
  // than the 16 native slots. The playtest lifts the rank as it does for evolution.
  function ranchLandBonusG(){
    let land=null;try{land=cageEdit?.getFrame(...cageEditArgs())?.landCapacity??null;}catch{land=null;}
    return Number.isFinite(land)?landExpansionTier(land)*LAND_EXPANSION.memoryGPerTier:0;
  }
  function ranchCapacityG(){
    if(Number.isSafeInteger(ranchCapacityOverrideG))return ranchCapacityOverrideG;
    const rank=playtestPolicy?.enabled===true?9:Math.min(9,Math.max(0,tamerRankValue|0));
    return PRODUCT_RAISING_LIFECYCLE_RULES.ranks[rank].capacity+ranchLandBonusG();
  }
  const partnerGOf=speciesId=>{const m=/species-(\d+)$/.exec(speciesId??'');return m?productPartnerG(Number(m[1])):0;};
  function huntMemoryCapacityG(){
    // HUNT_TOOL_TIERS_20261103: the one memory card grows past the three ROM sizes (128 → 256 G).
    const card=Math.max(maxGFromInventory(huntInventory),shop?.memoryCardCapacityG?.()??0);
    // The land bonus never blocks a hunt: an unreadable layout falls back to the card alone.
    let land=null;try{land=cageEdit?.getFrame(...cageEditArgs())?.landCapacity??null;}catch{land=null;}
    return card+(Number.isFinite(land)?landMemoryBonusG(land,card):0);
  }

  // ---- Burst evolution (OWNER_APPROVED_ADAPTATION 2026-11-02, STAGE_REDESIGN_BURST_20261102) ----
  // A 成熟期 partner earns burst forms by the former evolution conditions or by an SSR/UR metal; the record is
  // saved under progression.burstEvolution. A partner saved as a former 覺醒體/究極體 returns to its 成熟期.
  function burstState(){return burstEvolution??(burstEvolution=withBurstMigrated(createBurstEvolutionState()));}
  function partnerProfile(instanceId){return instanceId===creature?.creatureId?creature.nativeProfile??null:raisingNativeProfile(instanceId);}
  /** The egg a new game starts with, before it is ever reborn (it hatches in 30 s; time/realtimeClock.js). */
  function isStarterEgg(id,profile){return id===creature?.creatureId&&(profile?.fields?.['000']??8)<8&&((((profile.narrowFields?.['03c']??0)<<24)>>24)===0);}
  function partnerIds(){return [...new Set([...(creature?.creatureId?[creature.creatureId]:[]),...(raising?.collection??[]).map(e=>e.instanceId)])];}
  // Every load scans: a partner can only be a 覺醒體/究極體 in a save written before the redesign (or a fixture
  // built on one), and after this pass none is, so the scan is idempotent.
  function migrateLegacyBurstPartners(){
    let state=normalizeBurstEvolution(burstEvolution),changed=false;
    for(const id of partnerIds()){
      const profile=partnerProfile(id),plan=profile?legacyBurstMigration(profile):null;
      if(!plan)continue;
      const formed=structuredClone(constructNativeIndividualForm(profile,plan.base,{next:nextGameplayRandom}));
      // Like any 成熟期 it records no 成熟期/覺醒體/究極體 ancestor (slots 0x14C/0x150/0x154): its former forms
      // live in the burst record now, and its Link/password transport stays native.
      for(const slot of ['14c','150','154'])formed.fields[slot]=228;
      writeRaisingNativeProfile(id,formed,{markDirty:false});
      state=unlockBurstForms(state,id,plan.unlock)??state;
      if(plan.preferred!==null)state=preferBurstForm(state,id,plan.preferred)??state;
      changed=true;
    }
    burstEvolution=withBurstMigrated(state);
    if(changed)savePort.markDirty();
  }
  let lastBurstUnlocks=Object.freeze([]),burstCheckFrames=0;const awakeningSigns=new Map();
  /**
   * Awakening raising (OWNER_APPROVED_ADAPTATION 2026-11-02): a form is learned in its ceremony on the ranch, never
   * on its own. This refreshes each partner's ranch sign (its focus form: glow from glowPercent, ready at 100 with
   * every gate met) and returns the partners that just became ready, for a ranch notice.
   */
  function refreshAwakeningSigns(ids=partnerIds(),{publish=true}={}){
    const state=burstState(),notices=[];let changed=false;
    for(const id of ids){
      const profile=partnerProfile(id),awakenings=profile?partnerAwakenings(profile,state,id):[];
      const ready=awakenings.find(a=>a.ready)??null,focus=ready??awakeningFocus(awakenings,awakeningTargetOf(state,id));
      const sign=focus?Object.freeze({form:focus.form,tier:focus.tier,percent:focus.percent,glow:focus.glow,ready:Boolean(ready)}):null;
      const before=awakeningSigns.get(id)??null;
      if(JSON.stringify(before)!==JSON.stringify(sign)){changed=true;if(sign)awakeningSigns.set(id,sign);else awakeningSigns.delete(id);}
      if(sign?.ready&&!before?.ready)notices.push(Object.freeze({instanceId:id,forms:Object.freeze([sign.form]),ready:true}));
    }
    if(notices.length)lastBurstUnlocks=Object.freeze([...lastBurstUnlocks,...notices].slice(-8));
    if(changed&&publish)publishRaising();
    return notices;
  }
  /** After a battle or a hunt the ranch partners train once more (REALTIME_V1; raising/productTrainingPolicy.js). */
  function queueRanchTraining(){if(!realtime)return;for(const actor of raisingActors.values())if(actor.speciesIndex>=8)actor.trainingDue=true;}
  /** One partner's awakening path (roster card): its forms with progress rows and their cages, gates, usable items. */
  function partnerAwakeningView(instanceId){
    const profile=partnerProfile(instanceId);if(!profile)return null;
    const state=burstState(),awakenings=partnerAwakenings(profile,state,instanceId);if(!awakenings.length)return null;
    const target=awakeningTargetOf(state,instanceId),focus=awakeningFocus(awakenings,target),plan=partnerBurstPlan(instanceId);
    const learned=new Set(burstUnlocksOf(state,instanceId)),owned=id=>gachaState().metals[id]??0,rules=AWAKENING_RULES.transcendence;
    // Each button says what the item really adds now: items stop at the item cap, so a metal near it adds less.
    const room=Math.max(0,AWAKENING_RULES.itemCap-(focus?.energy??0));
    const feeds=GACHA_METALS.filter(m=>owned(m.id)>0).map(m=>{const {amount:nominal,fill}=focus?awakeningItemEnergy(m,focus.tier):{amount:0,fill:false};
      return {itemId:m.id,name:m.name,rarity:m.rarity,family:m.family,art:m.art,owned:owned(m.id),amount:fill?nominal:Math.min(nominal,room),fill};}).filter(f=>f.amount>0);
    const bond=profile.fields['020']|0,stars=transcendStarsOf(state,instanceId);
    const transcendItems=GACHA_METALS.filter(m=>!m.id.endsWith('-shard')&&rules.metalRarities.includes(m.rarity)&&owned(m.id)>0).map(m=>m.id);
    return deepFreeze({instanceId,base:profile.fields['000'],focus:focus?.form??null,target,appearance:awakeningAppearanceOf(state,instanceId),
      bloodline:gachaBloodlineOf(cyberGacha,instanceId)?.family??null,bond,stars,maxStars:rules.maxStars,bondMinimum:rules.bondMinimum,
      canTranscend:stars<rules.maxStars&&bond>=rules.bondMinimum&&transcendItems.length>0,transcendItems,feeds,itemCap:AWAKENING_RULES.itemCap,
      overdrive:overdriveView(instanceId),seed:awakeningSeedOf(state,instanceId),
      forms:awakenings.map(a=>({...a,rows:a.rows.map(row=>({...row,cages:recommendedCages(row.id)})),
        planned:plan&&[a.form,...a.alternates].includes(plan.form)?plan.form:null,alternatesUnlocked:a.alternates.filter(x=>learned.has(x))}))});
  }
  // ---- Awakening overdrive (OWNER_APPROVED_ADAPTATION 2026-11-09, AWAKENING_OVERDRIVE_20261109) ----
  // Overdrive cage training on the real-time ranch: a few bits per training multiply its awakening points, a core
  // heat builds and backfires past backlashAbove; a recovery cage next door (or the partner inside one) cools it.
  const overdriveEvents=[];let overdriveSerial=0,productRollSerial=0;
  // Product rolls never read the gameplay RNG, so native draws stay where they were.
  const productRoll=(...keys)=>instinctNoise(Math.floor(realNowMs()),++productRollSerial,...keys);
  /** Recovery-cage cooling where the partner stands: 'inside', 'adjacent' or 'base'. */
  function overdriveCoolingOf(instanceId){
    const actor=raisingActors.get(instanceId),placements=raisingGround?.placements??[];
    const own=actor?.cageInstanceId?placements.find(p=>p.instanceId===actor.cageInstanceId):null;
    const neighbours=[];
    if(own)for(const edge of raisingGround?.navigation?.boundaries??[]){
      const other=edge.left===own.ownerIndex?edge.right:edge.right===own.ownerIndex?edge.left:null;
      const definition=other===null?null:getCageDefinitionByModuleId(placements[other]?.moduleId)?.cageDefinitionIndex;
      if(Number.isInteger(definition))neighbours.push(definition);
    }
    return overdriveCooling(actor?.cageDefinitionIndex??null,neighbours);
  }
  function overdriveHeatNow(instanceId,record=overdriveOf(burstState(),instanceId)){
    return record?overdriveHeatAt(record,realNowMs(),OVERDRIVE_RULES.coolPerMinute[overdriveCoolingOf(instanceId)]):0;
  }
  function overdriveView(instanceId){
    const record=overdriveOf(burstState(),instanceId),now=realNowMs(),heat=Math.round(overdriveHeatNow(instanceId,record));
    return Object.freeze({on:record?.on===true,heat,cooling:overdriveCoolingOf(instanceId),costBits:OVERDRIVE_RULES.costBits,
      backlashAbove:OVERDRIVE_RULES.backlashAbove,danger:heat>OVERDRIVE_RULES.backlashAbove,
      fatigueSeconds:record?.fatigueUntil>now?Math.ceil((record.fatigueUntil-now)/1000):0,
      multiplier:OVERDRIVE_RULES.multiplier,available:Boolean(realtime)});
  }
  /** The actor's training hook: null keeps the plain training. */
  function overdriveTraining(instanceId,{before,after,commands}){
    const state=burstState(),record=overdriveOf(state,instanceId);
    if(!record?.on||!burstFormsFor(after.fields['000']).length||!shop)return null;
    const now=realNowMs();
    if(record.fatigueUntil>now)return null;
    const bits=shop.getBits(),cost=OVERDRIVE_RULES.costBits;
    if(bits<cost){pushOverdriveEvent({instanceId,kind:'NO_BITS'});return null;}
    const heat=overdriveHeatNow(instanceId,record);
    const outcome=resolveOverdriveTraining({commands,heat,roll:()=>productRoll(0x0d)});
    if(!shop.applyBitsTransaction({expectedBits:bits,bits:bits-cost}).ok)return null;
    if(outcome.backlash){
      // Core backlash: the training gives nothing and the partner tires for a short while.
      const tired=structuredClone(before);tired.fields['040']=Math.min(100,(tired.fields['040']|0)+OVERDRIVE_RULES.backlashFatigue);
      burstEvolution=withOverdrive(state,instanceId,{on:true,heat:Math.round(heat),at:now,fatigueUntil:now+OVERDRIVE_RULES.backlashSeconds*1000});
      pushOverdriveEvent({instanceId,kind:'BACKLASH',heat:Math.round(heat)});
      savePort.markDirty();
      return {profile:normalizeNativeIndividualProfile(tired),commands:[]};
    }
    const gained=applyProductTrainingGains(after,outcome.extra);
    burstEvolution=withOverdrive(state,instanceId,{on:true,heat:Math.round(outcome.heat),at:now});
    pushOverdriveEvent({instanceId,kind:outcome.epiphany?'EPIPHANY':'BOOST',multiplier:outcome.multiplier,heat:Math.round(outcome.heat)});
    savePort.markDirty();
    // The rising labels show each point row at its overdrive total, then the epiphany's stat rows.
    const extraByKind=new Map();for(const row of gained.commands)if(row.kind<11)extraByKind.set(row.kind,(extraByKind.get(row.kind)??0)+row.delta);
    const shown=commands.map(c=>extraByKind.has(c.kind)?{...c,delta:c.delta+extraByKind.get(c.kind)}:c);
    return {profile:gained.profile,commands:[...shown,...gained.commands.filter(row=>row.kind>=11)]};
  }
  function pushOverdriveEvent(event){
    overdriveEvents.push(Object.freeze({serial:++overdriveSerial,...event}));
    while(overdriveEvents.length>12)overdriveEvents.shift();
  }

  /** The battle plan with what the battle reads besides the form: its tier-1 form (tier 2), bloodline and bond. */
  function battleBurstPlanOf(instanceId,plan=partnerBurstPlan(instanceId)){
    const profile=partnerProfile(instanceId);if(!plan||!profile)return plan??null;
    const entry=burstFormsFor(profile.fields['000']).find(f=>f.form===plan.form||f.alternates?.includes(plan.form));
    return Object.freeze({...plan,via:plan.tier===2?entry?.via??null:null,bloodline:gachaBloodlineOf(cyberGacha,instanceId)?.family??null,
      bond:profile.fields['020']|0});
  }
  /** One partner's burst forms with their conditions, current values and unlock state (roster, battle setup). */
  function partnerBurstView(instanceId){
    const profile=partnerProfile(instanceId);if(!profile)return null;
    const unlocked=new Set(burstUnlocksOf(burstState(),instanceId)),plan=partnerBurstPlan(instanceId);
    return Object.freeze(burstFormsFor(profile.fields['000']).map(form=>{const check=evaluateBurstConditions(profile,form);
      const alternates=[...(form.alternates??[])];
      return Object.freeze({form:form.form,tier:form.tier,via:form.via,alternates:Object.freeze(alternates),
        alternatesUnlocked:Object.freeze(alternates.filter(a=>unlocked.has(a))),unlocked:unlocked.has(form.form),
        planned:plan&&[form.form,...alternates].includes(plan.form)?plan.form:null,met:check.met,rows:check.rows});}));
  }
  /** Unlocked forms (alternates included) whose tier the tamer rank allows: what a match may see it burst into. */
  function partnerBurstForms(instanceId){
    const maxTier=burstTierForRank(tamerRankValue);
    return burstUnlocksOf(burstState(),instanceId).filter(form=>(burstFormTier(form)??9)<=maxTier);
  }
  /** The form this partner bursts into in battle now (tamer rank gates the tier), or null. */
  function partnerBurstPlan(instanceId){
    const profile=partnerProfile(instanceId);if(!profile)return null;
    const state=burstState();
    return burstPlanFor(profile.fields['000'],burstUnlocksOf(state,instanceId),{maxTier:burstTierForRank(tamerRankValue),preferred:preferredBurstForm(state,instanceId)});
  }

  function liveSaveRequest(nextRevision=revision) {
    return {
      snapshot:requireSession().getRaisingHomeSnapshot(),creature,sessionId,revision:nextRevision,
      interactionCount,friendsPlaytest,onlineBindReward,tamerRank:tamerRankValue,battleBadges:battleBadgesValue,nativeTitles,
      championshipRun,freeBattleMenu,battleTactics,cyberGacha,burstEvolution,syncLevels,journey,nativeMessages,nativeOpening,registeredSpecies:registeredSpeciesValue,
      raising,shop:shop?shop.toSave():null,cageEdit:cageEdit?cageEdit.toSave():null,battleEconomy,
      instanceIdentity,gameplayRng:gameplayRngSnapshot(),huntHistory:projectNativeHuntPersistentSave(huntPersistentState)
    };
  }

  function requestFromSavedGame(saved,candidate) {
    return {
      ...saved.progression,friendsPlaytest:saved.flags.friendsPlaytest??null,onlineBindReward:saved.flags.onlineBindReward??null,snapshot:candidate.snapshot,creature:saved.creature,sessionId,
      raising:candidate.production,shop:saved.shop,cageEdit:saved.cageEdit,battleEconomy:saved.battleEconomy,
      instanceIdentity:candidate.identity,gameplayRng:saved.gameplayRng,huntHistory:saved.huntHistory
    };
  }

  function retainTutorialBaseline(request) {
    return deepFreeze(structuredClone({...request,nativeOpening:{
      version:1,trainerName:request.nativeOpening.trainerName,tutorialStep:null
    }}));
  }

  function interactiveOpening(checkpoint) {
    return normalizeNativeOpening({version:2,trainerName:tutorialBaseline.nativeOpening.trainerName,
      tutorialStep:null,checkpoint:{version:1,...checkpoint}});
  }

  function tutorialInput(expected,action=null,tool=null){
    if(!tutorialBaseline||tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive
      ||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||!expected)return false;
    try{if(!sameInteractiveTutorialCheckpoint(nativeOpening.checkpoint,expected))return false;}catch{return false;}
    const step=tutorialRaisingStep(nativeOpening.checkpoint),actor=raisingActors.get(creature.creatureId);
    return Boolean(actor?.tutorialSpecial&&step&&!step.dialogue&&(!action||step.action===action)
      &&(!tool||actor.tutorialSelectedTool===tool));
  }
  const tutorialNext=(stage,message=0)=>commitTutorialOpening(interactiveOpening({stage,message}));
  const tutorialStep=cp=>tutorialRaisingStep(cp)??tutorialHuntStep(cp)??tutorialBattleStep(cp);
  function tutorialBattleInput(expected,action){
    if(!tutorialBaseline||tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive||!expected)return false;
    try{if(!sameInteractiveTutorialCheckpoint(nativeOpening.checkpoint,expected))return false;}catch{return false;}
    const step=tutorialBattleStep(nativeOpening.checkpoint);
    return Boolean(step&&!step.dialogue&&step.action===action&&screens.current()===step.screen);
  }
  async function prepareTutorialBattle(){
    const {prepareNativeTutorialBattleEntry}=await import('./nativeTutorialBattleEntry.js');
    return prepareNativeTutorialBattleEntry(tutorialBaseline.gameplayRng);
  }
  function tutorialExpeditionInput(expected,action=null){
    if(!tutorialBaseline||tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive||!expected)return false;
    try{if(!sameInteractiveTutorialCheckpoint(nativeOpening.checkpoint,expected))return false;}catch{return false;}
    const step=tutorialHuntStep(nativeOpening.checkpoint);
    return Boolean(step&&!step.dialogue&&!step.boundary&&(!action||step.action===action));
  }
  async function prepareTutorialHunt(){
    const {prepareNativeTutorialHuntEntry}=await import('../hunt/capture/nativeTutorialHuntEntry.js');
    const {createHuntRuntime}=await import('../hunt/huntRuntime.js');
    const entry=prepareNativeTutorialHuntEntry(tutorialBaseline.gameplayRng);
    const world=createHuntWorld(TUTORIAL_GATE,entry);
    const runtime=createHuntRuntime({world,nativeEntry:entry,maxCardG:32,fieldActor:{actorId:'championship:2026:actor:tamer',displayName:'Tamer'},
      nativeControls:{loadout:entry.loadout,consumeItem:(id,n=1)=>{
        const quantity=entry.inventory.getQuantity(id);if(quantity<n)return {ok:false,reason:'NOT_OWNED'};
        entry.inventory.setQuantityFromShop(id,quantity-n);return {ok:true};
      },onChange:publishScreens}});
    return {runtime,loadout:entry.loadout};
  }
  function restoreTutorialScreen(){
    if(!tutorialBaseline)return;
    const cp=nativeOpening.checkpoint,step=tutorialHuntStep(cp)??tutorialBattleStep(cp);if(!step)return;
    if(step.screen.startsWith('BATTLE_')){
      if(!tutorialBattleCandidate)return;
      if(screens.current()==='RAISING_HOME')screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_SELECT);
      if(step.screen==='BATTLE_FIELD'||step.screen==='BATTLE_RESULT'){
        if(step.screen==='BATTLE_FIELD')tutorialBattleCandidate.runtime.startMatch();
        if(screens.current()==='BATTLE_SELECT')screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD);
        if(step.screen==='BATTLE_RESULT'&&screens.current()==='BATTLE_FIELD')screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_RESULT);
      }
      publishScreens();return;
    }
    if(step.screen==='GATE_SELECT'){
      if(screens.current()==='RAISING_HOME')screens.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
    }else if(step.screen==='HUNT_FIELD'){
      if(!tutorialHuntCandidate)return;
      huntRuntime=tutorialHuntCandidate.runtime;huntLoadout=tutorialHuntCandidate.loadout;
      selectedGateId=confirmedGateId=TUTORIAL_GATE.gateId;huntDeadlineMinute=null;huntRealtime=null;
      if(screens.current()==='RAISING_HOME')screens.enter(CHAMPIONSHIP_SCREENS.GATE_SELECT);
      if(screens.current()==='GATE_SELECT')screens.enter(CHAMPIONSHIP_SCREENS.HUNT_LOADOUT);
      if(screens.current()==='HUNT_LOADOUT')screens.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD);
      huntRuntime.configureTutorialHunt(cp,step);
    }else if(step.screen==='RAISING_HOME'){
      // OVL0 0211EA94 discards demo cards. Never ordinary Hunt return or Home commit.
      if(screens.canExit())screens.exit();
      huntRuntime=null;huntLoadout=null;huntResult=null;tutorialHuntCandidate=null;selectedGateId=confirmedGateId=null;
    }
    publishScreens();
  }
  async function confirmTutorialGate(expected){
    if(screens.current()!=='GATE_SELECT'||selectedGateId!==TUTORIAL_GATE.gateId||!tutorialExpeditionInput(expected,'gate'))return screens.current();
    tutorialTransitionActive=true;publishRaising();
    try{tutorialHuntCandidate=await prepareTutorialHunt();}
    catch(error){huntEntryError=error.message;return screens.current();}
    finally{tutorialTransitionActive=false;publishRaising();}
    tutorialNext('hunt-intro');return screens.current();
  }

  // The tutorial's points are original-board coordinates. A new game on the
  // hex world lays that same board into the world at the legacy offset
  // (grid100ToHexWorld), so every scripted point moves with it; the original
  // layout keeps offset zero and its exact native bytes.
  function tutorialBoardOffset(){
    if(raisingGround?.layoutVersion!==PRODUCT_RANCH_GRID)return [0,0];
    const origin=productGridCell(PRODUCT_WAITING_ROOM_SLOT);return [origin.x,origin.y];
  }
  function tutorialPointQ12(x,y){const [dx,dy]=tutorialBoardOffset();return [(x+dx)*4096,(y+dy)*4096,0];}
  function tutorialRaisingPosition(actor,x,y,cage=35){const [dx,dy]=tutorialBoardOffset();placeNativeTutorialRaisingActor(actor,x+dx,y+dy,cage);}

  function restoreInteractiveTutorialActor() {
    const cp=nativeOpening?.checkpoint,stage=cp?.stage,step=tutorialRaisingStep(cp)??(tutorialStep(cp)?.screen==='RAISING_HOME'?tutorialStep(cp):null);
    if(!tutorialBaseline||tutorialTransitionActive||['declined','completed'].includes(tutorialPendingOpening?.checkpoint?.stage)||!step)return false;
    const id=creature.creatureId;
    let actor=raisingActors.get(id),rebuilding=!actor?.tutorialSpecial;
    if(rebuilding){
      raisingActors.clear();raisingHand=null;raisingFoods=[];raisingWaste=[];
      // The tutorial always starts with its original species0 demo egg.
      // Preserve any selected egg (and older hatched web baseline) unchanged.
      if(creature.nativeProfile.fields['000']!==0){
        const demo=createNativeRaisingStarter({next:nextGameplayRandom});
        writeRaisingNativeProfile(id,{...demo,name:creature.nativeProfile.name},{markDirty:false});
      }
      actor=createNativeRaisingActor(creature.nativeProfile,raisingPoolSlots[id]??0);
      initializeNativeTutorialRaisingActor(actor);tutorialRaisingPosition(actor,128,96);raisingActors.set(id,actor);
      if(!["raising-intro","raising-hatch"].includes(stage)){
        const result=restoreNativeTutorialHatchedActor(actor,creature.nativeProfile,{next:nextGameplayRandom});
        writeRaisingNativeProfile(id,result.profile,{markDirty:false});
      }
    }
    const key=stage+":"+cp.message;
    if(actor.tutorialCheckpointKey===key)return true;
    const prior=actor.tutorialStage,changed=prior!==stage;
    actor.tutorialCheckpointKey=key;actor.tutorialStage=stage;actor.tutorialElapsed=0;actor.tutorialCleanPending=[0,0,0];raisingHand=null;
    actor.tutorialSelectedTool=step.action==="select"||step.action==="camera"?null:step.tool??"hand";
    const stages=Object.keys(TUTORIAL_RAISING_STEPS),index=stages.indexOf(stage),at=name=>index>=stages.indexOf(name);
    actor.tutorialCameraX=at("raising-injury-intro")?200:at("raising-recovery-intro")?260:at("raising-carry-intro")?100:0;
    let profile=raisingNativeProfile(id);
    if(stage.startsWith("raising-clean")){
      if(rebuilding||stage==="raising-clean"||changed&&stage==="raising-clean-intro"){
        tutorialRaisingIdle(actor);tutorialRaisingPosition(actor,120,100);
        raisingFoods=[createNativeRaisingFood({slot:0,cageDefinitionIndex:35,positionQ12:tutorialPointQ12(100,120),freshness:6,restored:true}),
          createNativeRaisingFood({slot:1,cageDefinitionIndex:35,positionQ12:tutorialPointQ12(80,80),freshness:-1,restored:true})];
        raisingWaste=[{slot:0,speciesIndex:17,present:true,cageDefinitionIndex:35,positionQ12:tutorialPointQ12(160,100)}];
      }
      const mask=stage==="raising-clean"?Math.max(0,cp.message-1):stage==="raising-clean-wait"?7:0;
      if(mask&1)raisingFoods[0].present=false;if(mask&2)raisingWaste[0].present=false;if(mask&4)raisingFoods[1].present=false;
    }else if(stage==="raising-feed-eat"&&rebuilding){
      raisingFoods=[createNativeRaisingFood({slot:0,cageDefinitionIndex:35,positionQ12:tutorialPointQ12(100,120)})];
      tutorialRaisingFeed(actor,profile,raisingFoods);
    }else if(stage.startsWith("raising-illness")){
      if(rebuilding||changed&&stage==="raising-illness-intro"){raisingFoods=[];raisingWaste=[];tutorialRaisingIdle(actor);tutorialRaisingPosition(actor,100,100);}
      if(stage!=="raising-illness-wait")profile=tutorialRaisingCondition(profile,cp.message===0&&stage==="raising-illness-intro"?3:2);
      else if(rebuilding)profile=tutorialRaisingTreat(actor,tutorialRaisingCondition(profile,2),1,{next:nextGameplayRandom}).profile;
    }else if(["raising-camera-intro","raising-camera","raising-carry-intro","raising-training-drop"].includes(stage)){
      if(rebuilding||changed){tutorialRaisingIdle(actor);tutorialRaisingPosition(actor,150,100);profile=tutorialRaisingCondition(profile,3);}
    }else if(stage==="raising-training-wait"&&rebuilding){
      tutorialRaisingPosition(actor,280,100,1);profile=tutorialRaisingTraining(actor,profile,{rng:{next:nextGameplayRandom},season:requireSession().getRaisingHomeSnapshot().season});
    }else if(stage==="raising-training-done"&&rebuilding){tutorialRaisingIdle(actor);tutorialRaisingPosition(actor,280,100,1);}
    else if(stage.startsWith("raising-recovery")){
      if(rebuilding||changed&&stage==="raising-recovery-intro"){
        tutorialRaisingPosition(actor,stage==="raising-recovery-done"?380:280,stage==="raising-recovery-done"?132:110,stage==="raising-recovery-done"?15:1);
        profile=tutorialRaisingCondition(profile,4);actor.state=stage==="raising-recovery-done"?16:15;
        actor.sequenceId=null; // next step selects the special weak pose
      }
    }else if(stage.startsWith("raising-injury")){
      if(rebuilding||changed&&stage==="raising-injury-intro"){tutorialRaisingIdle(actor);tutorialRaisingPosition(actor,280,100,1);profile=tutorialRaisingCondition(profile,5);}
      if(stage!=="raising-injury-wait")profile=tutorialRaisingCondition(profile,cp.message===0&&stage==="raising-injury-intro"?7:6);
      else if(rebuilding)profile=tutorialRaisingTreat(actor,tutorialRaisingCondition(profile,6),0,{next:nextGameplayRandom}).profile;
    }else if(stage.startsWith("raising-sleep")||stage.startsWith("raising-gate")||stage==="raising-after-hunt"||stage==="raising-battle-ready"||stage==="raising-after-battle"){
      if(stage==="raising-after-hunt"||stage==="raising-battle-ready")actor.tutorialCameraX=200;
      if(rebuilding||changed&&stage==="raising-sleep-wait"){profile=tutorialRaisingCondition(tutorialRaisingCondition(profile,5),7);tutorialRaisingPosition(actor,280,100,1);tutorialRaisingSleep(actor);}
    }
    if(profile!==raisingNativeProfile(id))writeRaisingNativeProfile(id,profile,{markDirty:false});
    tutorialRaisingStatus(actor,profile,stage.startsWith("raising-feed"));
    return true;
  }
  function advanceInteractiveRaising(frames){
    if(tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive)return false;
    const cp=nativeOpening?.checkpoint,step=tutorialRaisingStep(cp),actor=raisingActors.get(creature.creatureId);
    if(!step||!actor?.tutorialSpecial||step.dialogue||step.boundary)return false;
    const key=actor.tutorialCheckpointKey,id=creature.creatureId,rng={next:nextGameplayRandom};
    for(let i=0;i<frames&&actor.tutorialCheckpointKey===key&&!tutorialPendingOpening;i++){
      let profile=raisingNativeProfile(id);
      if(cp.stage==="raising-hatch"&&actor.eggPhase===0&&!actor.pendingHatch&&++actor.hatchWait>=180)requestNativeTutorialHatch(actor);
      if(raisingHand?.tutorialKey===key&&raisingHand.held){
        if(raisingHand.mode===1){
          const result=classifyNativeRaisingHand({held:true,elapsed:raisingHand.elapsed,origin:raisingHand.origin,pointer:raisingHand.pointer,
            inside:raisingHand.inside,admit:command=>command===0x80&&[1,15,16].includes(actor.state)});
          raisingHand.elapsed++;
          if(result===3&&tutorialRaisingCarry(actor,raisingHand.pointer,raisingGround))raisingHand.mode=3;
          else if(result!==-1)raisingHand=null;
        }
        if(raisingHand?.mode===3)actor.carryPointer={...raisingHand.pointer};
      }
      for(const food of raisingFoods)stepNativeRaisingFood(food,0);
      const result=stepNativeTutorialRaisingActor(actor,profile,{rng,ground:raisingGround,foods:raisingFoods,season:requireSession().getRaisingHomeSnapshot().season});
      if(result.profile!==profile)writeRaisingNativeProfile(id,result.profile,{markDirty:false});
      if(result.hatched){tutorialNext("raising-hatched");break;}
      actor.tutorialElapsed++;
      if(cp.stage==="raising-hunger-wait"&&actor.tutorialElapsed>=40)tutorialRaisingStatus(actor,raisingNativeProfile(id),true);
      if(step.action==="carry"&&result.landed){
        if(actor.cageDefinitionIndex===step.cage&&actor.state!==7){tutorialNext(step.cage===1?"raising-training-wait":"raising-recovery-done");break;}
        actor.tutorialViewRevision=(actor.tutorialViewRevision??0)+1;
        tutorialRaisingIdle(actor);tutorialRaisingPosition(actor,step.cage===1?150:280,step.cage===1?100:110,step.cage===1?35:1);
        if(step.cage===15){actor.state=15;actor.sequenceId=null;}
      }
      if(step.action==="clean"){
        const pending=actor.tutorialCleanPending,mask=Math.max(0,cp.message-1);
        let next=mask;
        pending.forEach((count,index)=>{if(count>0&&++pending[index]>20)next|=1<<index;});
        if(next!==mask){tutorialNext("raising-clean",next+1);break;}
        if(mask===7){tutorialNext("raising-clean-wait");break;}
      }
      if(step.wait&&actor.tutorialElapsed>=step.wait&&(cp.stage!=="raising-training-wait"||actor.state===1)){tutorialNext(step.next);break;}
    }
    publishRaising();return true;
  }

  function commitTutorialOpening(nextOpening) {
    if(tutorialTransitionActive)throw new Error("INTERACTIVE_TUTORIAL_TRANSITION_ACTIVE");
    if(tutorialCommitActive)return savePort.getStatus();
    tutorialPendingOpening=normalizeNativeOpening(nextOpening);
    tutorialCommitActive=true;
    let status;
    try {
      if(['declined','completed'].includes(tutorialPendingOpening.checkpoint.stage)) {
        // A failed exit can be retried after more transient changes. Reapply the
        // baseline on EVERY attempt before releasing isolation, not only once.
        // The R2 snapshot is already restored; ordinary clock/Hunt writers are
        // blocked throughout this interval.
        const {save:normal}=savePort.prepare({...tutorialBaseline,nativeOpening,revision});
        applySavedGameData(normal,restoreCandidate(normal),{tutorialBoundary:true});
      }
      status=savePort.save({...tutorialBaseline,revision:revision+1,nativeOpening:tutorialPendingOpening});
      if(status.phase==="SAVED") {
        revision+=1;nativeOpening=tutorialPendingOpening;tutorialPendingOpening=null;
        if(!interactiveTutorialInProgress(nativeOpening)){tutorialBaseline=null;publishScreens();}
        else {restoreInteractiveTutorialActor();restoreTutorialScreen();}
      }
    } finally {tutorialCommitActive=false;}
    publishRaising();
    return status;
  }

  // Stroll logs saved before 2026-10-28 kept "SPECIES 084" as a partner name;
  // the loaded log carries the catalog name, written back on the next save.
  function repairStrollLogNames(state){
    const log=state?.nativeHome?.strollLog;
    const repaired=log?renameStrollLogPartners(log,localizeSpeciesCodes):log;
    return repaired===log?state:Object.freeze({...state,nativeHome:normalizeNativeRaisingHome({...state.nativeHome,strollLog:repaired})});
  }

  function applySavedGameData(saved,candidate,{tutorialBoundary=false}={}) {
    creature = Object.freeze({ ...saved.creature });
    revision = saved.progression.revision ?? 0;
    interactionCount = saved.progression.interactionCount ?? 0;
    tamerRankValue = normalizeTamerRank(saved.progression.tamerRank);
    battleBadgesValue = [...saved.progression.battleBadges];
    nativeTitles=normalizeNativeTitleProgress(saved.progression.nativeTitles)??emptyNativeTitleProgress();
    championshipRun=saved.progression.championshipRun==null?null
      :normalizeNativeChampionshipRun(saved.progression.championshipRun);
    nativeMessages=normalizeNativeRaisingMessages(saved.progression.nativeMessages)??createNativeRaisingMessages();
    nativeOpening=normalizeNativeOpening(saved.progression.nativeOpening);
    registeredSpeciesValue = Object.freeze([...saved.progression.registeredSpecies]);
    battleEconomy = normalizeBattleEconomyState(saved.battleEconomy);
    gameplayRng = candidate.rng;
    huntPersistentState = candidate.huntHistory;
    raising = repairStrollLogNames(candidate.production);
    burstEvolution = normalizeBurstEvolution(saved.progression.burstEvolution ?? null);
    syncLevels = saved.progression.syncLevels===undefined?null:normalizeSyncLevels(saved.progression.syncLevels);lastSyncGains=null;
    journey = saved.progression.journey===undefined?null:normalizeJourney(saved.progression.journey);pendingTower=null;lastTowerResult=null;
    migrateLegacyBurstPartners();
    if (realtime) {
      // Up to twelve hours of growth while the game was closed, then the clock shows the device's time.
      realtimeAge.clear(); realtimeWake.clear(); realtimeSyncAt = -Infinity;
      realtimeLastMs = Date.parse(saved.updatedAt);
      applyOfflineGrowth(offlineGrowthSeconds(realtimeLastMs, realNowMs()));
      if (!(realtimeLastMs <= realNowMs())) realtimeLastMs = realNowMs();
      syncRealtimeClock(realNowMs(), { rollForward: true });
    }
    raisingHand=null;raisingActors.clear();raisingAgeRemainder=0;
    instanceIdentity = candidate.identity;
    selectedCreatureId = null;
    friendsPlaytest = saved.flags.friendsPlaytest ?? null;
    onlineBindReward = saved.flags.onlineBindReward ?? null;
    openShopAndHunt({ shopSnapshot: saved.shop });
    // The welcome tickets ride the next save; an unsaved grant is simply granted again.
    // Restored before the cage editor: royal cages count as copies of their base cage (DIAMOND_ECONOMY_20261102).
    cyberGacha=grantGachaWelcome(saved.progression.cyberGacha??null).state;
    draftRoyalEditions=null;pendingRoyalEdition=null;automationEvents=[];resetAutoCare();
// Owner 2026-11-04: the 10 x 10 hex land (20 cells, rows bought with diamonds) belongs to the product
    // economy, not only to the playtest; tamer rank no longer sets the cell count there.
    cageEdit = loadCageEditor(saved.cageEdit);
    freeBattleMenu=saved.progression.freeBattleMenu??null;
    battleTactics=normalizeBattleTactics(saved.progression.battleTactics);
    initializeNativeRaisingHome({tutorialBoundary});
    selectedDatabaseSpeciesIndex = null;
    resetExpedition();
  }

  async function hydrateSavedGame(saved,candidate,options={}) {
    if(session){const closing=session;session=null;await closing.dispose();battlePartyIds=null;}
    await openSession(seededRealmPort(candidate.snapshot));
    applySavedGameData(saved,candidate,options);
  }

  // Sponsor stake contracts (OWNER_APPROVED_ADAPTATION 2026-11-09, AWAKENING_OVERDRIVE_20261109). The armed contract
  // takes its stake with the match's own entry (`sponsor.begin`) and pays at its settlement (`sponsor.settle`), in
  // the same wallet commit; a match left unfinished keeps the stake.
  let lastSponsorSettlement=null,sponsorMatchOdds=null,lastSponsorRefusal=null;
  /**
   * Whether the armed contract may ride a match of `kind` (FREE / TITLE / CHAMPIONSHIP / ARENA) at these odds:
   * {ok, odds} or {ok:false, reason, cap?}. The contract stays armed when it is refused.
   */
  function sponsorAdmission(armed,kind,odds,bits){
    if(!armed)return {ok:false,reason:'NO_CONTRACT'};
    const cap=SPONSOR_STAKE_CAPS[kind]??SPONSOR_STAKE_CAPS.FREE;
    if(armed.stake>cap)return {ok:false,reason:'OVER_CAP',cap};
    if(sponsorContractsSignedOn(burstState(),localDayNumber(realNowMs()))>=SPONSOR_DAILY_LIMIT)return {ok:false,reason:'DAILY_LIMIT'};
    if(odds&&!odds.accepted)return {ok:false,reason:'FOE_TOO_WEAK'};
    if(bits<armed.stake)return {ok:false,reason:'NOT_ENOUGH_BITS'};
    return {ok:true};
  }
  function refuseSponsor(armed,admission){
    lastSponsorRefusal=armed&&admission.reason!=='NO_CONTRACT'?Object.freeze({contractId:armed.contractId,stake:armed.stake,reason:admission.reason,cap:admission.cap??null}):null;
  }
  function sponsorReward(reward,partyIds){
    const gains=[];
    for(const instanceId of partyIds??[]){
      const view=partnerAwakeningView(instanceId),focus=view?.forms.find(f=>f.form===view.focus)??null,profile=partnerProfile(instanceId);
      if(!focus||!profile)continue;
      if(reward.awakeningPoints>0){
        // The point row furthest behind on the focus form takes the points.
        const row=[...focus.rows].filter(r=>BURST_CONDITION_IDS.includes(r.id)).sort((a,b)=>a.current/a.value-b.current/b.value)[0];
        if(row){const next=structuredClone(profile),field=BURST_CONDITION_FIELDS[BURST_CONDITION_IDS.indexOf(row.id)];
          next.fields[field]=((next.fields[field]>>>0)+reward.awakeningPoints)>>>0;
          writeRaisingNativeProfile(instanceId,normalizeNativeIndividualProfile(next),{markDirty:false});
          gains.push(Object.freeze({instanceId,points:reward.awakeningPoints,condition:row.id}));}
      }
      if(reward.awakeningPercent>0){
        const fed=feedAwakeningEnergy(burstState(),instanceId,focus.form,{amount:reward.awakeningPercent});
        if(fed){burstEvolution=fed;gains.push(Object.freeze({instanceId,percent:reward.awakeningPercent,form:focus.form}));}
      }
    }
    if(reward.shard){
      const shard=['metal:emma-shard','metal:beta-shard'][Math.floor(productRoll(0x51)*2)];
      cyberGacha=grantGachaMetal(gachaState(),shard,1);gains.push(Object.freeze({metal:shard}));
    }
    return Object.freeze(gains);
  }
  function applyBattleTransaction(result, individualResults=[], preparedRng=null, burstForms=[], sponsor=null) {
    if(tutorialBaseline)return {ok:false,reason:'INTERACTIVE_TUTORIAL_ISOLATED'};
    if (!result.ok || result.duplicate) return result;
    const before = battleEconomy;
    const beforeCreature=creature,beforeRaising=raising,beforeRegistered=registeredSpeciesValue;
    const beforeRng=gameplayRng;
    const beforeBadges = battleBadgesValue;
    const beforeRank=tamerRankValue,beforeTitles=nativeTitles,beforeMessages=nativeMessages,beforeRun=championshipRun;
    const beforeGacha=cyberGacha,beforeGachaDrop=lastBattleGachaDrop,beforeBurst=burstEvolution,beforeBurstUnlocks=lastBurstUnlocks,beforeSponsor=lastSponsorSettlement;
    const beforeSync=syncLevels,beforeSyncGains=lastSyncGains;
    const expectedBits = requireShop().getBits();
    // One rollback for both ways this can fail. The wallet is committed last, so
    // until it succeeds every one of these is still the pre-transaction value.
    const rollback = () => {
      battleEconomy = before;
      creature=beforeCreature;raising=beforeRaising;registeredSpeciesValue=beforeRegistered;
      gameplayRng=beforeRng;
      battleBadgesValue = beforeBadges;
      tamerRankValue=beforeRank;nativeTitles=beforeTitles;nativeMessages=beforeMessages;championshipRun=beforeRun;
      cyberGacha=beforeGacha;lastBattleGachaDrop=beforeGachaDrop;burstEvolution=beforeBurst;lastBurstUnlocks=beforeBurstUnlocks;lastSponsorSettlement=beforeSponsor;
      syncLevels=beforeSync;lastSyncGains=beforeSyncGains;
    };
    battleTransactionActive = true;
    try {
      // Publish the wallet only after its matching transaction state exists.
      // A synchronous observer therefore sees one consistent app snapshot.
      battleEconomy = result.state;
      if(preparedRng)gameplayRng=preparedRng;
      for(const entry of individualResults)writeRaisingNativeProfile(entry.instanceId,entry.nativeProfile,{markDirty:false});
      // Sync EXP for the partners that fought a settled owned-party match (never password or link battles).
      const syncKind=SYNC_KIND_BY_MODE[result.receipt?.mode];
      if(result.receipt?.status==="SETTLED"&&syncKind&&individualResults.length)
        grantBattleSync(individualResults.map(entry=>entry.instanceId),{kind:syncKind,won:result.receipt.won===true,attemptId:result.receipt.attemptId??null});
      // Battles and wins are awakening conditions; the ranch partners also train once after the match.
      queueRanchTraining();refreshAwakeningSigns(individualResults.map(entry=>entry.instanceId),{publish:false});
      // A form the player's partner burst into this match is registered in the encyclopedia.
      for(const form of burstForms)registeredSpeciesValue=registerNativeBookSpecies(registeredSpeciesValue,form);
      if (result.receipt?.status === "SETTLED") {
        nativeTitles=applyNativeBattleRecord(nativeTitles,result.receipt);
        // A tournament round is not a title on its own: the payout gate and the
        // title result both read the whole run, so settleChampionship resolves
        // it once the last round is in.
        const r=championshipAttemptId===result.receipt.attemptId?null
          :resolveNativeTitleResult({rank:tamerRankValue,category:result.receipt.mode,matchIndex:result.receipt.matchIndex,
            won:battleBadgesValue,...nativeTitles,rounds:[result.receipt.won?1:0]});
        if(r){
        battleBadgesValue=[...r.won];tamerRankValue=r.rank;
        nativeTitles=normalizeNativeTitleProgress({...nativeTitles,registered:r.registered,championship:r.championship,feeWaiver:r.feeWaiver});
        if(r.rankNotice!==null)nativeMessages=enqueueNativeRaisingMessage(nativeMessages,r.rankNotice);
        }
      }
      // Cyber Gachapon: a won settled match drops tickets, and an armed bounty
      // beacon multiplies this match's purse (OWNER_APPROVED_ADAPTATION 2026-10-29).
      let wallet=result.wallet;
      if(result.receipt?.status==="SETTLED"&&result.receipt.won){
        const drop=settleGachaBattleWin(gachaState(),{bits:Math.max(0,result.wallet-expectedBits),random:gachaRandom});
        cyberGacha=drop.state;wallet=Math.min(BITS_WALLET_CAP,result.wallet+drop.bonusBits);
        // GACHA_FULL_EFFECTS_20261109: the beacon's extra battles/wins and race/faction points land on every
        // partner who fought, in this same transaction (the rollback restores them with the rest).
        if(drop.battles||drop.exp)for(const entry of individualResults){
          const current=gachaProfile(entry.instanceId)??entry.nativeProfile;
          writeRaisingNativeProfile(entry.instanceId,normalizeNativeIndividualProfile(beaconBattleWords(current,drop)),{markDirty:false});
        }
        lastBattleGachaDrop=Object.freeze({attemptId:result.receipt.attemptId??null,tickets:drop.tickets,bonusBits:wallet-result.wallet,beacon:drop.beacon,metals:drop.metals,
          battles:drop.battles,exp:drop.exp});
      }
      const armed=sponsorContractOf(burstState());
      if(sponsor?.begin&&armed){
        const odds=sponsorMatchOdds,admission=sponsorAdmission(armed,sponsor.kind,odds,wallet);
        if(admission.ok){
          wallet-=armed.stake;
          burstEvolution=withSponsorSigned(withSponsorEscrow(withSponsorContract(burstState(),null),{...armed,attemptId:sponsor.begin,
            foeBoostPercent:sponsorContract(armed.contractId)?.condition.foeBoostPercent??0,...(odds?.bonus?{oddsBonus:true}:{})}),localDayNumber(realNowMs()));
          lastSponsorRefusal=null;
        } else refuseSponsor(armed,admission);
      }
      if(sponsor?.begin)sponsorMatchOdds=null;
      const escrow=sponsorEscrowOf(burstState());
      if(sponsor?.settle&&escrow&&escrow.attemptId===result.receipt?.attemptId){
        const settled=settleSponsorContract(escrow,{won:result.receipt.won===true,...(sponsor.settle.stats??{}),foeBoostPercent:escrow.foeBoostPercent});
        wallet=Math.min(BITS_WALLET_CAP,wallet+settled.payout);
        burstEvolution=withSponsorEscrow(burstState(),null);
        const gains=settled.met?sponsorReward(settled.reward,sponsor.settle.partyIds):Object.freeze([]);
        lastSponsorSettlement=Object.freeze({attemptId:escrow.attemptId,contractId:escrow.contractId,stake:escrow.stake,met:settled.met,payout:settled.payout,gains});
      }
      const committed = requireShop().applyBitsTransaction({ expectedBits, bits: wallet });
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

    /** Data Arena entry rights (Owner 2026-11-02): Dex-registered species and the partners held on the ranch now. */
    getDataArenaProgress() {
      // Current membership only: a starter that disappeared or was released keeps
      // its save record but is no longer a raising instance, so it earns no bonus.
      const held = (session ? listRaisingInstances(instanceSources()) : []).map(({ speciesId, instanceId }) => ({ speciesId, instanceId }))
        .filter((entry) => /^species-\d{3}$/.test(entry.speciesId ?? "")).map((entry) => Object.freeze(entry));
      return Object.freeze({ registeredSpecies: Object.freeze([...registeredSpeciesValue]), ownedSpecies: Object.freeze([...new Set(held.map((entry) => entry.speciesId))]),
        ownedInstances: Object.freeze(held) });
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

    async newGame({trainerName=null,eggName=null,eggSpeciesIndex=0}={}) {
      if(tutorialTransitionActive||tutorialCommitActive)return null;
      if (huntCommitActive) return null;
      const opening=trainerName===null?null:normalizeNativeOpening({version:1,trainerName:trainerName.trim(),tutorialStep:null});
      const givenName=eggName===null?null:normalizeProductGivenName(eggName);
      if(givenName!==null&&givenName.length>5)throw new TypeError('INVALID_NATIVE_OPENING_EGG_NAME');
      if(!Number.isInteger(eggSpeciesIndex)||eggSpeciesIndex<0||eggSpeciesIndex>7)throw new TypeError('INVALID_STARTER_EGG_SELECTION');
      // Species choice must retain the existing R2 starter slot identity, just
      // as evolution changes its species without creating a second resident.
      const startingIdentity={
        ...selectPhase1FirstCreature(catalog,{residentId:`resident:species-${String(eggSpeciesIndex).padStart(3,'0')}`}),
        creatureId:selectPhase1FirstCreature(catalog).creatureId
      };
      const initialRng = createClockChannelRng(rngClock());
      const initialHuntHistory = createNativeHuntPersistentState();
      if (session) await this.dispose();
      if(!await savePort.acquireSession())throw new Error('另一個分頁正在遊玩。請先關閉該分頁，再開始遊戲。');
      try {savePort.clear();}catch(error){await savePort.releaseSession();throw error;}
      let nativeProfile = createNativeRaisingStarter(initialRng,eggSpeciesIndex);
      if(givenName!==null)nativeProfile=Object.freeze({...nativeProfile,name:givenName});
      creature = Object.freeze({ ...startingIdentity, displayName:nativeProfile.name, nativeProfile });
      revision = 0;
      interactionCount = 0;
      tamerRankValue = 0;
      battleBadgesValue = [];
      nativeTitles=createNativeTitleProgress();
      championshipRun=null;
      nativeMessages=createNativeRaisingMessages();
      nativeOpening=opening;
      cyberGacha=grantGachaWelcome(null).state;
      burstEvolution=withBurstMigrated(createBurstEvolutionState());
      syncLevels=null;lastSyncGains=null;journey=null;pendingTower=null;lastTowerResult=null;
      tutorialBaseline=null;tutorialPendingOpening=null;tutorialOfferEligible=opening!==null;
      registeredSpeciesValue = Object.freeze([]);
      battleEconomy = createBattleEconomyState();
      gameplayRng = initialRng;
      huntPersistentState = initialHuntHistory;
      await openSession(createChampionshipSavePortR2());
      const creatureIds = session.getRaisingHomeSnapshot().residents.map((r) => r.residentId);
      raising = createRaisingProductionState({ cageIds, creatureIds });
      raisingHand=null;raisingActors.clear();raisingAgeRemainder=0;
      instanceIdentity = createRaisingInstanceIdentityState(instanceSources());
      selectedCreatureId = null;
      friendsPlaytest = null;
      onlineBindReward = null;
      openShopAndHunt({newSave:true});
      cageEdit = createCageEditRuntime({ initializeOriginal: true, publicTestGrid: productLand, initialTamerRank: tamerRankValue });
      rebuildFreeBattleMenu();
      initializeNativeRaisingHome();
      selectedDatabaseSpeciesIndex = null;
      resetExpedition();
      // Real time: the first day starts at the device's current time.
      if (realtime) { realtimeAge.clear(); realtimeWake.clear(); realtimeSyncAt = -Infinity; realtimeLastMs = realNowMs(); syncRealtimeClock(realtimeLastMs, { rollForward: true }); }
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
      if(tutorialTransitionActive||tutorialCommitActive)return null;
      if (huntCommitActive) return null;
      if(!await savePort.acquireSession())throw new Error('另一個分頁正在遊玩。請先關閉該分頁，再繼續遊戲。');
      let read = savePort.read({adopt:true});
      if (!read.present) {if(!session)await savePort.releaseSession();return null;}
      let candidate;
      try {candidate=restoreCandidate(read.save);}catch(error){if(!session)await savePort.releaseSession();throw error;}
      const migration=migrateFriendsPlaytestDiamonds(read.save.flags.friendsPlaytest,playtestPolicy);
      if(migration.changed){
        // Grant+marker are one durable transaction before hydration. Failure
        // leaves the original save intact and never exposes spendable credit.
        const status=savePort.save({...requestFromSavedGame(read.save,candidate),
          revision:(read.save.progression.revision??0)+1,friendsPlaytest:migration.state});
        if(status.phase!=='SAVED'){
          savePort.discardPendingWrite();if(!session)await savePort.releaseSession();
          throw new Error('TEST_DIAMOND_MIGRATION_SAVE_FAILED');
        }
        read=savePort.read({adopt:true});
        if(!read.present){if(!session)await savePort.releaseSession();throw new Error('TEST_DIAMOND_MIGRATION_READ_FAILED');}
      }
      tutorialOfferEligible=false;tutorialPendingOpening=null;
      tutorialBaseline=interactiveTutorialInProgress(read.save.progression.nativeOpening)
        ?retainTutorialBaseline(requestFromSavedGame(read.save,candidate)):null;
      await hydrateSavedGame(read.save,candidate,{tutorialBoundary:tutorialBaseline!==null});
      if(tutorialBaseline){
        if(tutorialHuntStep(nativeOpening.checkpoint)?.screen==='HUNT_FIELD'){
          tutorialTransitionActive=true;
          try{tutorialHuntCandidate=await prepareTutorialHunt();}finally{tutorialTransitionActive=false;}
        }
        if(tutorialBattleStep(nativeOpening.checkpoint)?.screen.startsWith('BATTLE_')){
          tutorialTransitionActive=true;
          try{tutorialBattleCandidate=await prepareTutorialBattle();}finally{tutorialTransitionActive=false;}
        }
        restoreTutorialScreen();restoreInteractiveTutorialActor();
      }
      return { creature, snapshot: session.getRaisingHomeSnapshot(), save: read.save, raising };
    },

    dispatch(command) {
      return dispatchRaisingHomeCommand(command);
    },

    getRaisingState() {
      return raising;
    },

    getRaisingGroundSupport(x,y){return readRaisingGroundSupport(raisingGround,x,y);},

    getRaisingActorFrame(instanceId) {
      const actor=nativeRaisingActor(instanceId);
      const profile=raisingNativeProfile(instanceId);
      return actor&&profile ? Object.freeze({
        ...projectNativeRaisingActor(actor),
        // Presentation only: on its way to look at a newly opened passage.
        visitingPassage:Boolean(actor.explorationVisit&&actor.explorationRoute?.length),
        // Current and maximum HP for frame readers. These reads do not create
        // a second HP owner; the recovery-cage stars do not read them.
        currentHp:profile.fields["050"],
        maxHp:profile.fields["058"],
        // The map the partner lives on: a royal cage (Owner 2026-11-03) runs by its base cage's rules
        // (cageDefinitionIndex) but is drawn and named as itself.
        cageMapDefinitionIndex:raisingGround?.placement?.(actor.cageInstanceId)?.fieldDefinitionIndex??actor.cageDefinitionIndex??null
      }) : null;
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
        calendar:(realtime?projectWeeklyRaisingCalendar:projectNativeRaisingCalendar)({...requireSession().getRaisingHomeSnapshot(),progressCounter:tamerRankValue,
          won:battleBadgesValue,registered:nativeTitles.registered,championship:nativeTitles.championship})}):null,
        evolution:evolving?Object.freeze({instanceId:evolving[0],...projectNativeRaisingActor(evolving[1]).evolution}):null,
        mailbox:nativeMessages,message:raisingLifecycleMessage});
    },
    hasRaisingPresentation(){return tutorialBaseline!==null||raisingDayConfirmation||raisingDayTransition!==null||nativeMessages.activeId!==null||[...raisingActors.values()].some(a=>a.evolution);},
    // Arcade evolution (Owner 2026-10-28): the clock driver multiplies the frames
    // it hands advanceRaisingPresentation by this rate. Only a running evolution
    // with nothing else on screen is sped; its phase counts, its single RNG draw
    // and the frozen ranch around it are unchanged -- only wall time shrinks.
    raisingPresentationRate(){
      const evolving=tutorialBaseline===null&&!raisingDayTransition&&nativeMessages.activeId===null
        &&[...raisingActors.values()].some(a=>a.evolution&&!a.evolution.choicePending);
      if(!evolving)raisingEvolutionRate=1;
      return raisingEvolutionRate;
    },
    setRaisingEvolutionPlayback(rate){
      if(!Number.isFinite(rate))return false;
      raisingEvolutionRate=Math.min(8,Math.max(1,Math.round(rate)));return true;
    },
    requestRaisingDayEnd(){
      if(this.hasRaisingPresentation()||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return false;
      // Real time has no day to end: the toolbar entry lets the partners rest instead.
      if(realtime)return restRaisingPartners().accepted;
      raisingDayConfirmation=true;publishRaising();return true;
    },
    confirmRaisingDayEnd(accepted){
      if(!raisingDayConfirmation||typeof accepted!=='boolean')return false;
      raisingDayConfirmation=false;
      if(accepted)return this.endDay();
      publishRaising();return true;
    },
    selectRaisingEvolutionChoice(instanceId,target){
      const actor=raisingActors.get(instanceId);
      if(!actor||!selectNativeRaisingEvolutionChoice(actor,target,{next:nextGameplayRandom}))return false;
      savePort.markDirty();publishRaising();return true;
    },
    advanceRaisingPresentation({frames}={}) {
      if(!Number.isInteger(frames)||frames<0||frames>120)throw new TypeError('INVALID_RAISING_PRESENTATION_FRAMES');
      if(tutorialBaseline)return advanceInteractiveRaising(frames);
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
        const profileBefore=raisingNativeProfile(id);
        const result=stepNativeRaisingEvolution(actor,profileBefore,{next:nextGameplayRandom});
        if(!actor.evolution)raisingEvolutionRate=1;
        if(result.changed)writeRaisingNativeProfile(id,result.profile);
        if(result.disappeared){
          const prior=requireSession().getRaisingHomeSnapshot();
          if(prior.residents.some(r=>r.residentId===id))requireSession().commitRaisingResidentRelease([id],prior.revision);
          raising=releaseRaisingMembership(raising,id);delete raisingPoolSlots[id];raisingActors.delete(id);
          if(selectedCreatureId===id)selectedCreatureId=null;
          raisingLifecycleMessage={kind:'DISAPPEARED',instanceId:id};storeNativeRaisingHome();savePort.markDirty();break;
        }
        // Owner 2026-11-03: a new form stays up a while before any night nap, like a fresh hatch.
        if(result.evolved&&result.event.target>=8)realtimeWake.set(id,realNowMs()+REALTIME_WAKE_SECONDS*1000);
        if(result.evolved){const event=result.event;raisingLifecycleMessage={kind:event.target<8?'REBORN':'EVOLVED',instanceId:id,target:event.target,
            // Display only: the persistent stats before and after the form write.
            oldSpecies:event.oldSpecies,stats:evolutionStatChange(profileBefore,result.profile)};
          if(event.productRouteId){const productEvolutionBranches=[...new Set([...(raising.nativeHome?.productEvolutionBranches??[]),event.productRouteId])];
            raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,productEvolutionBranches})});}
          else if(event.target>=8&&!event.inherited){const branches=[...new Set([...(raising.nativeHome?.evolutionBranches??[]),(event.oldSpecies-8)*5+growthBranchHistoryIndex(event.oldSpecies,event.index)])];
            raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,evolutionBranches:branches})});}
          savePort.markDirty();}
      }
      publishRaising();return true;
    },
    acknowledgeRaisingCalendar(){
      if(raisingDayTransition?.phase!=='calendar')return false;
      raisingDayTransition.phase='calendar-out';raisingDayTransition.frames=0;publishRaising();return true;
    },

    beginRaisingHand(instanceId,pointer){
      if(tutorialBaseline){
        if(instanceId!==creature.creatureId||raisingHand||!tutorialInput(pointer?.checkpoint,"carry","hand")
          ||!Number.isFinite(pointer?.x)||!Number.isFinite(pointer?.y))return false;
        raisingHand={id:instanceId,mode:1,elapsed:0,held:true,inside:true,origin:{...pointer},pointer:{...pointer},tutorialKey:raisingActors.get(instanceId).tutorialCheckpointKey};
        return true;
      }
      if(raisingHand||this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME
        ||!raisingGround||!raisingActors.has(instanceId)||!Number.isFinite(pointer?.x)||!Number.isFinite(pointer?.y))return false;
      const point={...pointer,x:Math.floor(pointer.x),y:Math.floor(pointer.y)};
      // Only a hand that takes hold wakes it; a tap on release of this press is the same handling, not a second one.
      const disturbed=wakeRealtimePartner(instanceId,{disturb:true});
      raisingHand={id:instanceId,mode:1,elapsed:0,held:true,inside:true,origin:{...point},pointer:{...point},previous:{...point},disturbed};return true;
    },
    updateRaisingHand(instanceId,pointer){
      if(tutorialBaseline&&!tutorialInput(pointer?.checkpoint,"carry","hand"))return false;
      if(raisingHand?.id!==instanceId||!Number.isFinite(pointer?.x)||!Number.isFinite(pointer?.y))return false;
      raisingHand.pointer={...pointer,x:Math.floor(pointer.x),y:Math.floor(pointer.y)};raisingHand.inside=pointer.inside!==false;return true;
    },
    endRaisingHand(instanceId,{cancelled=false,checkpoint=null,reason=null}={}){
      if(tutorialBaseline){
        if(raisingHand?.id!==instanceId||!tutorialInput(checkpoint,"carry","hand"))return false;
        const actor=raisingActors.get(instanceId),hand=raisingHand;raisingHand=null;
        if(cancelled){actor.tutorialViewRevision=(actor.tutorialViewRevision??0)+1;tutorialRaisingIdle(actor);const recovery=nativeOpening.checkpoint.stage==="raising-recovery-drop";
          tutorialRaisingPosition(actor,recovery?280:150,recovery?110:100,recovery?1:35);if(recovery){actor.state=15;actor.sequenceId=null;}publishRaising();return true;}
        if(hand.mode!==3)return false;
        const released=tutorialRaisingRelease(actor);publishRaising();return released;
      }
      if(raisingHand?.id!==instanceId)return false;
      if(cancelled&&raisingHand.mode===1){raisingHand=null;return true;}
      if(cancelled&&reason==='viewport-resize'&&raisingHand.mode===3){
        const actor=raisingActors.get(instanceId);
        if(actor&&cancelNativeRaisingCarry(actor)){
          raisingHand=null;publishRaising();return true;
        }
        // Missing rollback data must never route a resize into normal drop.
        return false;
      }
      raisingHand.held=false;advanceRaisingHand();publishRaising();return true;
    },
    beginRaisingCarry(instanceId,pointer){
      if(this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||!raisingGround
        ||!Number.isFinite(pointer?.x)||!Number.isFinite(pointer?.y))return false;
      const actor=raisingActors.get(instanceId);
      if(!actor||!raisingNativeProfile(instanceId)||[...raisingActors.values()].some(a=>a.state===6))return false;
      wakeRealtimePartner(instanceId,{disturb:true});
      const p=beginNativeRaisingCarry(actor,raisingNativeProfile(instanceId),pointer,{ground:raisingGround,foods:raisingFoods,rng:{next:nextGameplayRandom}});if(!p)return false;
      actor.carryCameraX=pointer.cameraX??0;writeRaisingNativeProfile(instanceId,p);savePort.markDirty();publishRaising();return true;
    },
    updateRaisingCarry(instanceId,pointer){
      if(tutorialBaseline)return false;
      const actor=raisingActors.get(instanceId);if(actor?.state!==6||!Number.isFinite(pointer?.x)||!Number.isFinite(pointer?.y))return false;
      actor.carryPointer={x:pointer.x,y:pointer.y};actor.carryCameraX=pointer.cameraX??actor.carryCameraX;return true;
    },
    releaseRaisingCarry(instanceId,{cancelled=false,reason=null}={}){
      if(tutorialBaseline)return false;
      const actor=raisingActors.get(instanceId),profile=raisingNativeProfile(instanceId);if(!actor||!profile)return false;
      if(cancelled&&reason==='viewport-resize'){
        if(!cancelNativeRaisingCarry(actor))return false;
        publishRaising();return true;
      }
      const p=releaseNativeRaisingCarry(actor,profile);if(!p)return false;
      writeRaisingNativeProfile(instanceId,p);interactionCount++;savePort.markDirty();publishRaising();return true;
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
      actor.cageDefinitionIndex=cage.definitionIndex;actor.cageInstanceId=cage.instanceId;
      if(actor.speciesIndex>=8)writeRaisingNativeProfile(instanceId,enterNativeRaisingCage(actor,raisingNativeProfile(instanceId),{
        previousDefinition,ground:raisingGround,foods:raisingFoods,season:requireSession().getRaisingHomeSnapshot().season,trainingCooldown:realtime}, {next:nextGameplayRandom}));
      storeNativeRaisingPositions();storeNativeRaisingHome();interactionCount++;savePort.markDirty();publishRaising();return true;
    },

    treatRaisingResident(instanceId,kind,checkpoint=null) {
      wakeRealtimePartner(instanceId);
      if(tutorialBaseline){
        const illness=kind===1,action=illness?"illness":"injury";
        if((kind!==0&&kind!==1)||instanceId!==creature.creatureId||!tutorialInput(checkpoint,action,illness?"medicine":"woundMedicine"))return {ok:false};
        const actor=raisingActors.get(instanceId),result=tutorialRaisingTreat(actor,raisingNativeProfile(instanceId),kind,{next:nextGameplayRandom});
        if(!result)return {ok:false};
        writeRaisingNativeProfile(instanceId,result.profile,{markDirty:false});
        tutorialNext(illness?"raising-illness-wait":"raising-injury-wait");
        return {ok:true,applied:true,success:result.success,consumed:false};
      }
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

    cleanRaisingFood({x,y,checkpoint=null}={}) {
      if(tutorialBaseline){
        if(!tutorialInput(checkpoint,"clean","clean")||!Number.isFinite(x)||!Number.isFinite(y))return false;
        const actor=raisingActors.get(creature.creatureId),mask=Math.max(0,nativeOpening.checkpoint.message-1);
        const targets=[[100,120,15,17],[160,100,6,10],[80,80,15,17]],[dx,dy]=tutorialBoardOffset();
        const hit=targets.findIndex(([px,py,l,r],i)=>!(mask&(1<<i))&&!actor.tutorialCleanPending[i]&&x-dx>=px-l&&x-dx<=px+r&&y-dy>=py-19&&y-dy<=py+5);
        if(hit<0)return false;
        actor.tutorialCleanPending[hit]=1;
        [raisingFoods[0],raisingWaste[0],raisingFoods[1]][hit].present=false;publishRaising();return true;
      }
      if(this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||!Number.isFinite(x)||!Number.isFinite(y))return false;
      // 02121308 and live body +5A: inclusive native box [-6,-19,10,5].
      const waste=raisingWaste.find(w=>w.present&&x>=(w.positionQ12[0]>>12)-6&&x<=(w.positionQ12[0]>>12)+10&&y>=(w.positionQ12[1]>>12)-19&&y<=(w.positionQ12[1]>>12)+5);
      if(waste){waste.present=false;raisingDirtySignals.set(waste.cageInstanceId??waste.cageDefinitionIndex,{dirtyRemoved:true});storeNativeRaisingHome();interactionCount++;savePort.markDirty();publishRaising();return true;}
      const food=raisingFoods.find(f=>f.present&&x>=(f.positionQ12[0]>>12)-15&&x<=(f.positionQ12[0]>>12)+17
        &&y>=(f.positionQ12[1]>>12)-19&&y<=(f.positionQ12[1]>>12)+5);
      if(!food)return false;
      food.present=false;
      if(food.freshness<=0)raisingDirtySignals.set(food.cageInstanceId??food.cageDefinitionIndex,{dirtyRemoved:true});
      for(const actor of raisingActors.values())if(actor.foodSlot===food.slot)removeNativeRaisingFoodTarget(actor,raisingFoods,{next:nextGameplayRandom});
      storeNativeRaisingHome();interactionCount++;savePort.markDirty();publishRaising();return true;
    },

    placeRaisingFood({x,y,protein=false,checkpoint=null}={}) {
      for(const id of raisingActors.keys())wakeRealtimePartner(id);
      if(tutorialBaseline){
        const [dx,dy]=tutorialBoardOffset();
        if(protein||!tutorialInput(checkpoint,"feed","feed")||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x-dx-100)>12||Math.abs(y-dy-120)>12)return {ok:false,reason:"TUTORIAL_TARGET_REQUIRED"};
        const actor=raisingActors.get(creature.creatureId);
        raisingFoods=[createNativeRaisingFood({slot:0,cageDefinitionIndex:35,positionQ12:tutorialPointQ12(100,120)})];
        if(!tutorialRaisingFeed(actor,raisingNativeProfile(creature.creatureId),raisingFoods)){raisingFoods=[];return {ok:false,reason:"TUTORIAL_FOOD_TARGET_UNAVAILABLE"};}
        tutorialNext("raising-feed-eat");return {ok:true,slot:0};
      }
      if(this.hasRaisingPresentation()||huntCommitActive||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return Object.freeze({ok:false,reason:"HOME_REQUIRED"});
      if(!raisingGround)return Object.freeze({ok:false,reason:"NATIVE_RANCH_REQUIRED"});
      if(!Number.isFinite(x)||!Number.isFinite(y)||typeof protein!=="boolean"||x<0||x>=raisingGround.pixelWidth)return Object.freeze({ok:false,reason:"INVALID_POSITION"});
      const cage=raisingGround.cageAt(x,y);
      if(!cage||raisingGround.readTerrain(Math.trunc(x/8),Math.trunc(y/8))===1)return Object.freeze({ok:false,reason:"INVALID_GROUND"});
      // Food's native touch box is inclusive; a touch already on an object
      // cannot place a second object or consume another inventory unit.
      const px=Math.trunc(x),py=Math.trunc(y);
      if(raisingFoods.some(f=>f.present&&(f.cageInstanceId??f.cageDefinitionIndex)===(cage.instanceId??cage.definitionIndex)&&px>=(f.positionQ12[0]>>12)-15&&px<=(f.positionQ12[0]>>12)+17
        &&py>=(f.positionQ12[1]>>12)-19&&py<=(f.positionQ12[1]>>12)+5))return Object.freeze({ok:false,reason:"FOOD_AT_POINT"});
      const used=new Set(raisingFoods.filter(f=>f.present).map(f=>f.slot)),slot=Array.from({length:10},(_,i)=>i).find(i=>!used.has(i));
      if(slot===undefined)return Object.freeze({ok:false,reason:"FOOD_POOL_FULL"});
      if(requireShop().toSave().quantities[protein?1:0]<1)return Object.freeze({ok:false,reason:"EMPTY"});
      const food=createNativeRaisingFood({slot,cageDefinitionIndex:cage.definitionIndex,cageInstanceId:cage.instanceId,positionQ12:[px*4096,py*4096,0],protein});
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

    touchRaisingEgg(instanceId,expectedCheckpoint=null) {
      if(tutorialBaseline){
        if(tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive
          ||nativeOpening?.checkpoint?.stage!=="raising-hatch"||!expectedCheckpoint
          ||!sameInteractiveTutorialCheckpoint(nativeOpening.checkpoint,expectedCheckpoint)
          ||instanceId!==creature.creatureId||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return false;
        return requestNativeTutorialHatch(raisingActors.get(instanceId));
      }
      if(huntCommitActive || screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return false;
      const actor=nativeRaisingActor(instanceId);
      return actor ? touchNativeRaisingEgg(actor) : false;
    },

    getInstanceIdentityState() { return instanceIdentity; },

    getRaisingInstances() {
      requireSession();
      return listRaisingInstances(instanceSources());
    },

    getRanchExplorationFrame() {
      if(tutorialBaseline||!raisingGround?.navigation)return null;
      const nav=raisingGround.navigation,state=raising?.nativeHome?.discoveries;
      const instances=new Map(listRaisingInstances(instanceSources()).map(p=>[p.instanceId,p]));
      return Object.freeze({
        connections:nav.connections,boundaries:nav.boundaries.map(({id,reason})=>({id,reason})),
        pending:state?.pending.map(p=>({...p,name:instances.get(p.partnerId)?.displayName??null}))??[],
        collected:state?.collected??0,active:!!state?.participants.length,
        resting:state?.pending.length===12,
        walkers:[...raisingActors].filter(([,a])=>a.explorationRoute?.length).map(([id,a])=>({id,target:a.explorationTarget}))
      });
    },

    refreshRanchDiscoveries() {
      if(!session||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME||this.hasRaisingPresentation())return false;
      settleDiscoveries();publishRaising();return true;
    },

    collectRanchDiscoveries() {
      if(!session||tutorialBaseline||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME
        ||this.hasRaisingPresentation()||battleTransactionActive||huntCommitActive)return {ok:false,reason:'UNAVAILABLE'};
      storeNativeRaisingPositions();storeNativeRaisingHome();
      const state=raising.nativeHome?.discoveries,waiting=pendingStrollEntries(raising.nativeHome?.strollLog);
      if(!state?.pending.length&&!waiting.length)return {ok:false,reason:'EMPTY'};
      // Speculative inventory has no live Hunt binding or observers.
      const candidate=createShopRuntime({snapshot:requireShop().toSave(),allowRepeatedCages:playtestPolicy?.enabled===true,
        allItemsVisible:playtestPolicy?.shopOpen===true,progression:progressionContext()});
      // Owner 2026-11-03: what each tool gained, so the toolbar can count up (+4 ▲) at once.
      const accepted=[],claimed=[],gains={},toolOfRecord=Object.fromEntries(Object.values(STROLL_REWARDS).filter(r=>r.record!==undefined).map(r=>[r.record,r.tool]));
      const gain=(tool,n)=>{if(tool&&n>0)gains[tool]=(gains[tool]??0)+n;};
      for(const entry of state?.pending??[]){
        const reward=RANCH_DISCOVERY_REWARDS[entry.kind];
        if(reward.bits){
          const before=candidate.getBits();
          if(before+reward.bits>BITS_WALLET_CAP)continue;
          candidate.creditBits(reward.bits);accepted.push(entry.id);gain('bits',reward.bits);
        }else{
          const record=getShopRecord(reward.record);
          if(candidate.toSave().quantities[reward.record]+reward.quantity>record.maxOwned)continue;
          candidate.receiveNativeGift(reward.record,reward.quantity);accepted.push(entry.id);gain(toolOfRecord[reward.record],reward.quantity);
        }
      }
      for(const entry of waiting){
        const spec=STROLL_REWARDS[entry.reward];
        if(spec.bits){
          const amount=spec.bits*entry.quantity;
          if(candidate.getBits()+amount>BITS_WALLET_CAP)continue;
          candidate.creditBits(amount);claimed.push(entry.id);gain('bits',amount);
        }else{
          const record=getShopRecord(spec.record);
          if(candidate.toSave().quantities[spec.record]+entry.quantity>record.maxOwned)continue;
          candidate.receiveNativeGift(spec.record,entry.quantity);claimed.push(entry.id);gain(spec.tool,entry.quantity);
        }
      }
      if(!accepted.length&&!claimed.length)return {ok:false,reason:'INVENTORY_FULL'};
      const nextRaising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({
        ...raising.nativeHome,...(state?{discoveries:removeCollectedDiscoveries(state,accepted)}:{}),
        ...(claimed.length?{strollLog:claimStrollEntries(raising.nativeHome.strollLog,claimed)}:{})})});
      // Cyber Gachapon: every fifth journal find is a milestone worth 3 tickets, once.
      let nextGacha=gachaState(),journalTickets=0;
      for(let mark=Math.floor((state?.collected??0)/5)+1;mark<=Math.floor((nextRaising.nativeHome.discoveries?.collected??0)/5);mark++){
        const claim=claimGachaReward(nextGacha,`journal:${mark*5}`,3);nextGacha=claim.state;journalTickets+=claim.granted;
      }
      const status=savePort.save({...liveSaveRequest(revision+1),raising:nextRaising,shop:candidate.toSave(),cyberGacha:nextGacha});
      if(status.phase!=='SAVED'){savePort.discardPendingWrite();return {ok:false,reason:'SAVE_FAILED'};}
      raising=nextRaising;cyberGacha=nextGacha;
      shop=createShopRuntime({snapshot:candidate.toSave(),huntInventory,allowRepeatedCages:playtestPolicy?.enabled===true,
        allItemsVisible:playtestPolicy?.shopOpen===true,progression:progressionContext()});
      applyMappedHuntInventoryFromShop(shop,huntInventory);bindShopRuntime();revision++;
      // The toolbar badges and the bag read the Shop: tell them now, then say what each tool gained.
      const frame=shop.getFrame();
      emitPartnerLife({kind:'collected',gains:Object.freeze({...gains})});
      for(const listener of [...shopListeners])try{listener(frame);}catch{/* observers never break the shop */}
      publishRaising();return {ok:true,collected:accepted.length+claimed.length,remaining:raising.nativeHome.discoveries?.pending.length??0,
        gachaTickets:journalTickets,gains:Object.freeze({...gains})};
    },

    // Partner life (Owner 2026-10-28). Readers are pure; the two writers below
    // use the same save path as the discoveries above.
    isPartnerLifeEnabled(){return partnerLife===true;},
    getPartnerReading(instanceId){return partnerLife?partnerReading(instanceId):null;},
    getPartnerLifeFrame(){
      if(!partnerLife)return null;
      return Object.freeze({greetings:Object.freeze(partnerLifeState.greetings.map(g=>Object.freeze({a:g.a,b:g.b,relation:g.relation,frames:g.frames}))),
        events:Object.freeze([...partnerLifeState.events]),log:raising?.nativeHome?.strollLog??null});
    },
    subscribePartnerLife(listener){
      if(typeof listener!=='function')throw new TypeError('A partner life observer must be a function');
      partnerLifeListeners.add(listener);return ()=>partnerLifeListeners.delete(listener);
    },
    /** A tap on a partner: its mood emote, and +1 affection (field 020) at most once per cooldown. */
    touchRaisingPartner(instanceId){
      const disturbed=wakeRealtimePartner(instanceId,{disturb:true})||(raisingHand?.id===instanceId&&raisingHand.disturbed===true);
      if(!partnerLife||!session||tutorialBaseline||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return null;
      const actor=nativeRaisingActor(instanceId),profile=raisingNativeProfile(instanceId),reading=partnerReading(instanceId,actor);
      if(!reading)return null;
      // A partner woken in the night is cross, not pleased: no affection and no mood emote for that tap.
      if(disturbed)return Object.freeze({...reading,gained:0,disturbed:true});
      const at=Date.now(),c=this.getCalendar(),dayKey=strollDayKey({season:c.season,day:c.dayOfSeason});
      let gained=0;
      if(raising?.nativeHome&&reading.affection<100&&canTapAffection(raising.nativeHome.strollLog,instanceId,at)){
        const next=structuredClone(profile);next.fields['020']=Math.min(100,(next.fields['020']|0)+PARTNER_LIFE_RULES.tapAffection);
        writeRaisingNativeProfile(instanceId,normalizeNativeIndividualProfile(next),{markDirty:false});gained=PARTNER_LIFE_RULES.tapAffection;
        raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,strollLog:recordTap(raising.nativeHome.strollLog,instanceId,at,dayKey)})});
        savePort.markDirty();
      }
      const after=partnerReading(instanceId,actor)??reading;
      emitPartnerLife({kind:'tap',partnerId:instanceId,mood:after.mood,emoji:after.emoji,habitat:after.habitat,gained});
      publishRaising();
      return Object.freeze({...after,gained});
    },
    /** Pay one stroll find now (also the QA seam): reward kind and quantity 1 or 2. */
    grantStrollDiscoveryReward({partnerId,reward,quantity=1,partnerB=null,relation=null}={}){
      if(!partnerLife||!session||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME)return {ok:false,reason:'UNAVAILABLE'};
      const actor=nativeRaisingActor(partnerId);if(!actor||actor.speciesIndex<8)return {ok:false,reason:'NO_PARTNER'};
      if(partnerB!==null&&!nativeRaisingActor(partnerB))return {ok:false,reason:'NO_PARTNER'};
      const c=this.getCalendar();
      return grantStrollDiscoveryReward({partnerId,partnerB,relation:partnerB?(relation==='rival'?'rival':'friendly'):null,reward,quantity,
        cage:actor.cageDefinitionIndex,calendar:{season:c.season,day:c.dayOfSeason,minute:c.clockMinutes}});
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

    getInteractiveTutorial() {
      const opening=nativeOpening?.version===2?nativeOpening:tutorialPendingOpening;
      if(!opening)return null;
      const checkpoint=opening.checkpoint,step=tutorialStep(checkpoint),actor=raisingActors.get(creature?.creatureId);
      const mask=checkpoint.stage==="raising-clean"?Math.max(0,checkpoint.message-1):0;
      const [dx,dy]=tutorialBoardOffset();
      const targets=(step?.action==="feed"?[[100,120]]:step?.action==="clean"?[[100,112],[160,92],[80,72]].filter((_,i)=>!(mask&(1<<i))):step?.cage===1?[[280,100]]:step?.cage===15?[[380,132]]:[])
        .map(([x,y])=>[x+dx,y+dy]);
      return Object.freeze({checkpoint,finished:['declined','completed'].includes(checkpoint.stage),textId:step?.textId??null,
        dialogue:step?.dialogue??false,action:step?.action??null,waiting:Boolean(step?.wait)||checkpoint.stage==="raising-hatch",
        tool:step?.tool??"hand",menuEntry:step?.menuEntry??'hunt',selectTool:step?.action!=="select"&&step?.action!=="camera",
        targets:Object.freeze(targets.map(Object.freeze)),cameraX:actor?.tutorialCameraX??0,viewRevision:actor?.tutorialViewRevision??0,
        boundary:step?.boundary??false,pendingSave:tutorialPendingOpening!==null,restoring:tutorialTransitionActive,
        available:!step?.boundary});
    },
    selectInteractiveTutorialTool(tool,checkpoint){
      if(!tutorialInput(checkpoint))return false;
      const step=tutorialRaisingStep(nativeOpening.checkpoint),actor=raisingActors.get(creature.creatureId);
      if(step.tool!==tool)return false;actor.tutorialSelectedTool=tool;
      if(step.action==="select")tutorialNext(step.next);else publishRaising();return true;
    },
    panInteractiveTutorial({x,checkpoint,tool}={}){
      if(!tutorialInput(checkpoint,"camera","hand")||tool!=="hand"||!Number.isFinite(x)||x<100)return false;
      tutorialNext("raising-carry-intro");return true;
    },
    openInteractiveTutorialMenu(entry,checkpoint){
      if(entry==='battle'){
        if(!tutorialExpeditionInput(checkpoint,'menu')||checkpoint.stage!=='raising-battle-ready'||screens.current()!=='RAISING_HOME')return false;
        return (async()=>{
        tutorialTransitionActive=true;publishRaising();
        try{tutorialBattleCandidate=await prepareTutorialBattle();}
        finally{tutorialTransitionActive=false;publishRaising();}
        tutorialNext('battle-kind-intro');return true;
        })();
      }
      if(entry!=="hunt"||!tutorialInput(checkpoint,"menu"))return false;
      tutorialNext("raising-gate-wait");return true; // Gate16 adapter is the next bounded slice.
    },

    getInteractiveTutorialBattle(){
      if(!tutorialBaseline||!tutorialBattleCandidate)return null;
      const step=tutorialBattleStep(nativeOpening.checkpoint);if(!step?.screen.startsWith('BATTLE_'))return null;
      const {runtime,individuals}=tutorialBattleCandidate;
      // Reload projects the previously judged verdict, without rerunning combat.
      return {runtime,individuals,step,match:runtime.getChosenMatch(),
        participants:individuals.map(({instanceId,speciesId})=>({instanceId,speciesId})),
        outcome:step.verdict?{ended:true,reason:nativeOpening.checkpoint.message===1?'TIME_UP':'TEAM_DOWN',verdict:step.verdict,winningTeam:step.winningTeam}:null};
    },
    interactiveBattleInput(action,value,checkpoint){
      if(!tutorialBattleInput(checkpoint,action))return false;
      const step=tutorialBattleStep(checkpoint);
      if(action==='kind'&&value!=='TITLE_MATCH'||action==='match'&&value!==61)return false;
      if(action==='member'){
        if(!Number.isInteger(value)||value<0||value>2)return false;
        const mask=checkpoint.message^(1<<value);
        tutorialNext(mask===7?'battle-options-intro':'battle-party-select',mask===7?0:mask);return true;
      }
      if(action==='judged'||action==='end')return false;
      if(action==='start')tutorialBattleCandidate.runtime.startMatch();
      tutorialNext(step.next);return true;
    },
    finishInteractiveTutorialBattle(expected){
      if(!tutorialBattleInput(expected,'judged')||!tutorialBattleCandidate)return false;
      const runtime=tutorialBattleCandidate.runtime,result=runtime.getSettlementResult(),outcome=runtime.outcome();
      if(!result.ended||result.matchIndex!==61||result.mode!==1||result.battleType!==0)return false;
      const stage={TEAM_ZERO_AHEAD:'battle-result-win',TEAM_ONE_AHEAD:'battle-result-loss',LEVEL:'battle-result-draw'}[outcome.verdict];
      if(!stage)return false;
      if(!['TIME_UP','TEAM_DOWN'].includes(outcome.reason))return false;
      tutorialNext(stage,outcome.reason==='TIME_UP'?1:0);return true;
    },
    endInteractiveTutorialBattle(expected){
      if(!tutorialBattleInput(expected,'end'))return false;
      tutorialNext('raising-after-battle');return true;
    },

    // Main offers this only for loopback new games, including the explicit review preview.
    // A Continue session (including every V1 legacy cursor) cannot opt in.
    offerInteractiveTutorial() {
      requireSession();
      if(!tutorialOfferEligible||nativeOpening?.version!==1||nativeOpening.tutorialStep!==null)
        return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_NEW_GAME_REQUIRED"});
      if(tutorialBaseline||tutorialTransitionActive||tutorialCommitActive||battleTransactionActive
        ||battleEconomy.active||huntCommitActive||huntRuntime||screens.current()!==CHAMPIONSHIP_SCREENS.RAISING_HOME
        ||this.hasRaisingPresentation())return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_UNSAFE_ENTRY"});
      storeNativeRaisingPositions();storeNativeRaisingHome();
      const request=liveSaveRequest();
      savePort.prepare(request); // Strict normal-save validation before isolation.
      tutorialBaseline=retainTutorialBaseline(request);tutorialOfferEligible=false;
      const status=commitTutorialOpening(interactiveOpening({stage:"invitation",message:0}));
      return Object.freeze({ok:status.phase==="SAVED",status,tutorial:this.getInteractiveTutorial()});
    },

    async chooseInteractiveTutorial(accepted,expectedCheckpoint=null) {
      requireSession();
      if(typeof accepted!=="boolean")throw new TypeError("INTERACTIVE_TUTORIAL_BOOLEAN_REQUIRED");
      if(!tutorialBaseline||tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive
        ||nativeOpening?.checkpoint?.stage!=="invitation")
        return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_CHOICE_UNAVAILABLE"});
      if(expectedCheckpoint&&!sameInteractiveTutorialCheckpoint(nativeOpening.checkpoint,expectedCheckpoint))
        return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_STALE_CHECKPOINT"});
      const next=interactiveOpening({stage:accepted?"raising-intro":"declined",message:0});
      if(!accepted) {
        // Restore via the same hydration as Continue before committing the exit.
        // Until a successful save, the baseline and pending exit remain isolated.
        const {save:normal}=savePort.prepare({...tutorialBaseline,nativeOpening,revision});
        const candidate=restoreCandidate(normal);
        tutorialTransitionActive=true;
        try {await hydrateSavedGame(normal,candidate,{tutorialBoundary:true});}
        finally {tutorialTransitionActive=false;}
      }
      const status=commitTutorialOpening(next);
      return Object.freeze({ok:status.phase==="SAVED",status,tutorial:this.getInteractiveTutorial()});
    },

    async exitInteractiveTutorial(expectedCheckpoint) {
      requireSession();
      if(!tutorialBaseline||tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive)
        return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_EXIT_UNAVAILABLE"});
      if(!sameInteractiveTutorialCheckpoint(nativeOpening.checkpoint,expectedCheckpoint))
        return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_STALE_CHECKPOINT"});
      const next=interactiveOpening({stage:"declined",message:0});
      const {save:normal}=savePort.prepare({...tutorialBaseline,nativeOpening,revision});
      const candidate=restoreCandidate(normal);
      tutorialTransitionActive=true;
      try {await hydrateSavedGame(normal,candidate,{tutorialBoundary:true});}
      finally {tutorialTransitionActive=false;}
      const status=commitTutorialOpening(next);
      publishScreens();
      return Object.freeze({ok:status.phase==="SAVED",status,tutorial:this.getInteractiveTutorial()});
    },

    acknowledgeInteractiveTutorial(expectedCheckpoint) {
      requireSession();
      if(!tutorialBaseline||tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive
        ||!tutorialStep(nativeOpening?.checkpoint)?.dialogue)
        return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_ACK_UNAVAILABLE"});
      if(!sameInteractiveTutorialCheckpoint(nativeOpening.checkpoint,expectedCheckpoint))
        return Object.freeze({ok:false,reason:"INTERACTIVE_TUTORIAL_STALE_CHECKPOINT"});
      const message=nativeOpening.checkpoint.message+1;
      const step=tutorialStep(nativeOpening.checkpoint);
      const next=interactiveOpening(message<step.texts.length||step.action?{stage:nativeOpening.checkpoint.stage,message}:{stage:step.next,message:0});
      if(next.checkpoint.stage==='completed')return (async()=>{
        const {save:normal}=savePort.prepare({...tutorialBaseline,nativeOpening,revision});
        tutorialTransitionActive=true;publishRaising();
        try{await hydrateSavedGame(normal,restoreCandidate(normal),{tutorialBoundary:true});}
        finally{tutorialTransitionActive=false;}
        const status=commitTutorialOpening(next);publishScreens();
        return Object.freeze({ok:status.phase==='SAVED',status,tutorial:this.getInteractiveTutorial()});
      })();
      const status=commitTutorialOpening(next);
      return Object.freeze({ok:status.phase==="SAVED",status,tutorial:this.getInteractiveTutorial()});
    },


    /**
     * The guided tutorial's cursor and the line it is on. The step catalogue is
     * built from the observed original run; the wording is product copy. New
     * games still start with no cursor, so this reads null until a caller opens
     * the tutorial — turning it on for every new game is a separate change that
     * has to move the existing flows with it.
     */
    getTutorial(){
      const step=nativeOpening?.tutorialStep;
      if(step===null||step===undefined)return null;
      if(step>=TUTORIAL_STEP_COUNT)return Object.freeze({step,finished:false,available:false,reason:'TUTORIAL_CURSOR_REQUIRES_TRACE'});
      if(tutorialFinished(step))return Object.freeze({step,finished:true,phase:null,textId:null,line:null,prompt:null,expected:null});
      const record=tutorialStepAt(step);
      return Object.freeze({step,finished:false,phase:record.phase,textId:record.textId,
        line:tutorialLine(record.textId),prompt:tutorialPrompt(record.advance),expected:record.advance});
    },

    beginTutorial(){
      requireSession();
      if(!nativeOpening)return Object.freeze({ok:false,reason:'TUTORIAL_REQUIRES_OPENING'});
      if(nativeOpening.version===2||tutorialBaseline)return Object.freeze({ok:false,reason:'INTERACTIVE_TUTORIAL_OWNS_OPENING'});
      nativeOpening=normalizeNativeOpening({...nativeOpening,tutorialStep:createTutorialCursor()});
      savePort.markDirty();publishRaising();
      return Object.freeze({ok:true,tutorial:this.getTutorial()});
    },

    /** One taught action. A mismatch leaves the cursor and the save untouched. */
    advanceTutorial(action){
      requireSession();
      const step=nativeOpening?.tutorialStep;
      if(step===null||step===undefined)return Object.freeze({ok:false,reason:'TUTORIAL_NOT_STARTED'});
      if(step>=TUTORIAL_STEP_COUNT)return Object.freeze({ok:false,reason:'TUTORIAL_CURSOR_REQUIRES_TRACE'});
      const result=advanceTutorialStep(step,action);
      if(!result.ok)return result;
      nativeOpening=normalizeNativeOpening({...nativeOpening,tutorialStep:result.step});
      savePort.markDirty();publishRaising();
      return Object.freeze({ok:true,finished:result.finished,completed:result.completed,
        phase:result.phase,tutorial:this.getTutorial()});
    },

    skipTutorial(){
      requireSession();
      const step=nativeOpening?.tutorialStep;
      if(step===null||step===undefined)return Object.freeze({ok:false,reason:'TUTORIAL_NOT_STARTED'});
      if(step>=TUTORIAL_STEP_COUNT)return Object.freeze({ok:false,reason:'TUTORIAL_CURSOR_REQUIRES_TRACE'});
      nativeOpening=normalizeNativeOpening({...nativeOpening,tutorialStep:skipTutorialCursor(step)});
      savePort.markDirty();publishRaising();
      return Object.freeze({ok:true,tutorial:this.getTutorial()});
    },
    deliverRaisingFeast(){
      if(!nativeMessages.cake||nativeMessages.activeId!==null||raisingDayTransition||!raisingGround)return false;
      for(const [kind,height] of nativeRaisingFeast(nativeMessages.cake)){
        const used=new Set(raisingFoods.filter(f=>f.present).map(f=>f.slot));
        const slot=Array.from({length:6},(_,i)=>i+10).find(i=>!used.has(i));
        if(slot===undefined)continue;
        const positionQ12=nativeRaisingSpawnPosition(raisingGround,35,{next:nextGameplayRandom});
        raisingFoods.push(createNativeRaisingFood({slot,cageDefinitionIndex:35,cageInstanceId:raisingGround.placement(35)?.instanceId,positionQ12,kind,heightQ12:height*4096}));
      }
      nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,cake:0});storeNativeRaisingHome();savePort.markDirty();publishRaising();return true;
    },
    prepareMorningMessages(){
      if(!nativeMessages.morningPending)return false;
      const c=this.getCalendar(),roster=this.getRaisingInstances(),birthday=deviceBirthday(),date=new Date(now());
      const match=!!birthday&&birthday.month===date.getMonth()+1&&birthday.day===date.getDate();
      // WEEKLY_SEASON_20261110: on the real-time clock a year is a calendar month, so the sixteen season letters
      // (four seasons x four years) come round every four months instead of stopping after the first four years.
      const selection=selectNativeMorningMessages({...c,year:realtime&&Number.isInteger(c.year)?c.year%4:c.year,cursor:nativeMessages.cursor,birthday:match,
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
      if (!schedule) return Object.freeze([]);
      // WEEKLY_SEASON_20261110: on the real-time clock today's titles open by time slot (time/weeklyTitleSchedule.js).
      return schedule.weeklyRecords ?? resolveMatchList(schedule).records;
    },
    /** Every title on today's calendar, whatever its slot (the native list on the native clock). */
    getTodayBattleRecordIndices() {
      const schedule = battleSchedule();
      if (!schedule) return Object.freeze([]);
      if (realtime) return selectWeeklyEligibleMatches({ season: schedule.scheduleSlotA, dayOfSeason: schedule.scheduleSlotB,
        minute: null, progressCounter: schedule.progressCounter });
      return resolveMatchList(schedule).records;
    },
    /** NATIVE (4 x 8 days, all day) or WEEKLY (4 x 7 days with time slots, real-time clock). */
    getTitleCalendarKind() { return realtime ? 'WEEKLY' : 'NATIVE'; },

    // A narrow pure-clock seam, not a raising action. It consumes no player
    // command IDs and never invokes the old ADVANCE resident side effects.
    advanceClock({ units, subunits = 0, divisor = 400, clearElapsed = false, expectedClockRevision } = {}) {
      if(tutorialBaseline)return Object.freeze({accepted:false,code:"INTERACTIVE_TUTORIAL_ACTIVE"});
      if (huntCommitActive) return Object.freeze({ accepted: false, code: "HUNT_HOME_COMMIT_ACTIVE" });
      const active = requireSession();
      const before = active.getRaisingHomeSnapshot();
      const result = active.advanceRaisingClock({ units, subunits, divisor, clearElapsed,
        expectedClockRevision: expectedClockRevision ?? before.clockRevision });
      const after=active.getRaisingHomeSnapshot();
      if(after.season!==before.season||after.dayOfSeason!==before.dayOfSeason)rebuildFreeBattleMenu();
      if (active.getRaisingHomeSnapshot() !== before) savePort.markDirty();
      return result;
    },

    getClockRunState() {
      if (!session) return Object.freeze({ running: false, reason: "NO_SESSION" });
      if(tutorialBaseline)return Object.freeze({running:false,reason:"INTERACTIVE_TUTORIAL_ACTIVE"});
      if(this.hasRaisingPresentation())return Object.freeze({running:false,reason:'RAISING_PRESENTATION'});
      const snapshot = session.getRaisingHomeSnapshot();
      if (snapshot.paused) return Object.freeze({ running: false, reason: "PAUSED" });
      // Real time has no 22:00 day end: the night is a nap and the clock keeps the device's time.
      if (!realtime && snapshot.clockMinutes >= DAY_END_MINUTES) return Object.freeze({ running: false, reason: "DAY_END" });
      if (realtime && screens.current() === CHAMPIONSHIP_SCREENS.HUNT_FIELD && huntRealtime) {
        const left = huntRealtime.limitMinutes * 400 - huntRealtime.elapsedUnits;
        return Object.freeze({ running: left > 0, reason: left > 0 ? "NORMAL_HUNT" : "HUNT_TIME_UP" });
      }
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
      if(new Date(now()).getTime()-discoveryCheckAt>=5000)settleDiscoveries();
      const runState = this.getClockRunState();
      if (!runState.running || frames === 0) return Object.freeze({ accepted: false, code: runState.reason ?? "NO_ELAPSED_FRAMES" });
      if (realtime) {
        // The world clock follows the device; a hunt counts down on its own (480 hunt minutes, 25 frames each).
        const nowMs = realNowMs();
        if (nowMs - realtimeSyncAt >= 1000) { realtimeSyncAt = nowMs; syncRealtimeClock(nowMs); }
        if (runState.reason === "NORMAL_HUNT") {
          huntRealtime.elapsedUnits += frames * NATIVE_CLOCK_CADENCE.elapsedUnitsPerFrame;
          this.checkHuntDeadline();
          return Object.freeze({ accepted: true, code: "HUNT_COUNTDOWN" });
        }
        let last = Object.freeze({ accepted: false, code: "NO_ELAPSED_FRAMES" });
        for (let i = 0; i < frames; i++) {
          const beforeFrame = requireSession().getRaisingHomeSnapshot();
          advanceNativeRaising(1, beforeFrame);
          last = Object.freeze({ accepted: true, code: "REALTIME" });
          this.settleRaisingFrameMessages(beforeFrame.clockMinutes);
          if (this.hasRaisingPresentation()) break;
        }
        return last;
      }
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
          if(last.accepted){advanceNativeRaising(1,beforeFrame);this.settleRaisingFrameMessages(beforeFrame.clockMinutes);}
          if(this.hasRaisingPresentation())break;
        }
        return last;
      }
      const result = this.advanceClock({ units: activeFrames * NATIVE_CLOCK_CADENCE.elapsedUnitsPerFrame,
        divisor, clearElapsed: frames >= framesUntilStop });
      if (inHunt) this.checkHuntDeadline();
      return result;
    },

    /** After one raising frame: message ageing (native clock), morning mail, feast, the day's entry notice. */
    settleRaisingFrameMessages(beforeMinutes) {
      const c=this.getCalendar();
      if(!realtime)nativeMessages=ageNativeRaisingMessages(nativeMessages,c.clockMinutes-beforeMinutes);
      if(nativeMessages.morningPending)this.prepareMorningMessages();
      this.deliverRaisingFeast();
      if(!nativeMessages.entryChecked&&c.clockMinutes>=420&&c.clockMinutes<900){
        const championship=c.season===2&&c.dayOfSeason===4&&nativeTitles.championship[c.year%4===3?'worldEntry':'entry'];
        const registered=this.getTodayBattleRecordIndices().some(id=>nativeTitles.registered.includes(id)&&!battleBadgesValue.includes(id));
        if(championship||registered){nativeMessages=enqueueNativeRaisingMessage(nativeMessages,null,{system:true,textId:94,minutes:900-c.clockMinutes,required:false});}
        nativeMessages=normalizeNativeRaisingMessages({...nativeMessages,entryChecked:true});
      }
      if(nativeMessages.queue.some(q=>q.system&&!q.opened)||(nativeMessages.activeId!==null&&nativeMessages.queue.some(q=>q.id===nativeMessages.activeId&&!q.opened)))this.openRaisingMail();
    },

    /** NATIVE or REALTIME_V1 (time/realtimeClock.js). */
    getClockPolicy() { return clockPolicy; },
    /** Real time only: MORNING / DAY / DUSK / NIGHT for the ranch light, and whether it is the night nap. */
    getDayPeriod() {
      if (!realtime || !session) return null;
      const minute = requireSession().getRaisingHomeSnapshot().clockMinutes;
      return Object.freeze({ period: realtimeDayPeriod(minute), nightNap: isNightNap(minute) });
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
      if(realtime)return restRaisingPartners();
      cancelRaisingHand();
      const before=requireSession().getRaisingHomeSnapshot();
      const result = dispatchRaisingHomeCommand({ type: RAISING_HOME_COMMANDS.END_DAY });
      if (result?.accepted){
        rebuildFreeBattleMenu();
        storeNativeRaisingPositions();storeNativeRaisingHome();
        if(raisingGround)raising=Object.freeze({...raising,nativeHome:normalizeNativeRaisingHome({...raising.nativeHome,pendingOvernightMinutes:Math.max(0,1320-before.clockMinutes)})});
        nativeMessages=normalizeNativeRaisingMessages({...ageNativeRaisingMessages(nativeMessages,1440-before.clockMinutes+420),entryChecked:false,morningPending:true});
        raisingDayTransition={phase:'fade-out',frames:0,savePhase:null};savePort.markDirty();publishRaising();
      }
      return result;
    },

    save() {
      requireSession();
      if(tutorialTransitionActive)throw new Error("INTERACTIVE_TUTORIAL_TRANSITION_ACTIVE");
      if(tutorialBaseline)return commitTutorialOpening(tutorialPendingOpening??nativeOpening);
      if (!creature) throw new Error("CHAMPIONSHIP_NO_CREATURE");
      if (battleTransactionActive || battleEconomy.active) throw new Error("CHAMPIONSHIP_SAVE_WHILE_BATTLE_ACTIVE");
      if (huntCommitActive) throw new Error("CHAMPIONSHIP_SAVE_WHILE_HUNT_COMMIT_ACTIVE");
      if (huntRuntime?.getOnCardEntries().length) throw new Error("CHAMPIONSHIP_SAVE_REQUIRES_CAPTURE_HOME_COMMIT");
      storeNativeRaisingPositions();storeNativeRaisingHome();
      revision += 1;
      const status=savePort.save(liveSaveRequest());
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
      if(tutorialBaseline)return Object.freeze([TUTORIAL_GATE]);
      return Object.freeze(listChampionshipGates().map(gate => Object.freeze({ ...gate,
        state: isGateUnlocked(gate, progressionContext()) ? "AVAILABLE" : "LOCKED" })));
    },

    getGateAdmission(gateId = confirmedGateId ?? selectedGateId) {
      if(tutorialBaseline)return Object.freeze({canConfigure:gateId===TUTORIAL_GATE.gateId&&!tutorialPendingOpening&&!tutorialTransitionActive&&nativeOpening.checkpoint.stage==='gate-select',
        canEnter:false,chargeBits:0,walletBits:requireShop().getBits(),reason:gateId===TUTORIAL_GATE.gateId?'AVAILABLE':'NO_GATE_SELECTED'});
      return gateAdmission(getChampionshipGate(gateId), requireShop().getBits(), progressionContext());
    },

    getSelectedGateId() {
      return selectedGateId;
    },

    getConfirmedGate() {
      return confirmedGateId === null ? null : tutorialBaseline&&confirmedGateId===TUTORIAL_GATE.gateId?TUTORIAL_GATE:getChampionshipGate(confirmedGateId);
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
    /** What the last Continue repaired in a refused ranch layout, once; null afterwards (Owner 2026-11-04). */
    takeRanchLoadRepair() { const repair = ranchLoadRepair; ranchLoadRepair = null; return repair; },
    advanceHunt(deltaMs){
      if(!huntRuntime)return;
      if(!tutorialBaseline){huntRuntime.tick(deltaMs);return;}
      const step=tutorialHuntStep(nativeOpening.checkpoint);
      if(!step||step.dialogue||tutorialPendingOpening||tutorialTransitionActive||tutorialCommitActive)return;
      huntRuntime.tick(deltaMs);
      if(huntRuntime.getTutorialHuntProgress()?.ready)tutorialNext(step.next);
    },
    interactiveHuntInput(kind,args,expected){
      if(!tutorialExpeditionInput(expected)||screens.current()!=='HUNT_FIELD'||!huntRuntime)return false;
      const step=tutorialHuntStep(nativeOpening.checkpoint);
      if(kind==='select'){
        if(args[0]!==step.tool||step.action!=='select')return false;
        const ok=huntRuntime.selectTool(args[0]);if(ok)tutorialNext(step.next);return ok;
      }
      if(kind==='camera'){
        if(step.action!=='camera')return false;
        const target=huntRuntime.getWildCreatures()[0];
        const projected=panHuntPresentationCamera(huntRuntime,args[0],args[1],args[4],target);
        const ok=projected?projected.accepted:huntRuntime.panCamera(...args);
        const camera=projected?null:huntRuntime.getCamera(args[2],args[3]);
        const visible=projected?projected.targetVisible:target&&target.worldX>=camera.left&&target.worldX<=camera.right&&target.worldY>=camera.top&&target.worldY<=camera.bottom;
        if(ok&&args.some((v,i)=>i<2&&Math.abs(v)>0)&&visible) tutorialNext(step.next);
        return ok;
      }
      if(step.action==='select'||step.demo||step.wait||step.action==='camera')return false;
      if(kind==='down'&&step.action==='food'&&(Math.abs(args[0]/2-640)>12||Math.abs(args[1]/2-584)>12))return false;
      return ({down:()=>huntRuntime.toolPointerDown(...args),move:()=>huntRuntime.toolPointerMove(...args),up:()=>huntRuntime.toolPointerUp(...args)})[kind]?.()??false;
    },


    getHuntResult() {
      if (!huntResult?.pendingHomeCommit) return huntResult;
      const released = new Set(huntResult.releasedHomeIds ?? []);
      const rows = [
        ...(huntRuntime?.getOnCardEntries() ?? []).map((entry) => Object.freeze({
          key: `card:${entry.wildId}`, kind: "CARD", id: entry.wildId, speciesId: entry.speciesId,
          displayName: entry.displayName ?? speciesDisplayName(entry.speciesId), canRelease: true,
          instinct: huntInstincts.get(entry.wildId) ?? 'NORMAL',
          selected: entry.wildId === huntResult.wildId })),
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
      return Object.freeze({ ...shop.getFrame(), lastReceipt: lastShopReceipt, testDiamonds: friendsPlaytest?.diamonds ?? null });
    },

    /**
     * Hunt tool families (HUNT_TOOL_TIERS_20261103): raise one tool a tier in
     * place. The memory card's sizes past 96 G also take test diamonds, which
     * are spent in the same save as the upgrade.
     */
    upgradeHuntTool(familyId, currency = 'BITS') {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.SHOP) throw new Error("CHAMPIONSHIP_SHOP_NOT_ACTIVE");
      if (currency === 'DIAMONDS') {
        const price = requireShop().getFrame().huntFamilies.find(f => f.familyId === familyId)?.next?.diamonds;
        if (!friendsPlaytest || !Number.isSafeInteger(price)) lastShopReceipt = Object.freeze({ ok:false, reason:'UNAVAILABLE', familyId });
        else if (friendsPlaytest.diamonds < price) lastShopReceipt = Object.freeze({ ok:false, reason:'INSUFFICIENT_DIAMONDS', familyId, cost:price });
        else {
          const candidate = gachaShopCandidate(), receipt = candidate.upgradeHuntFamily(familyId, { currency:'DIAMONDS' });
          const friends = receipt.ok ? normalizeFriendsPlaytestState({ ...friendsPlaytest, diamonds:friendsPlaytest.diamonds - price }) : null;
          if (!receipt.ok) lastShopReceipt = receipt;
          else {
            const status = savePort.save({ ...liveSaveRequest(revision + 1), friendsPlaytest:friends, shop:candidate.toSave() });
            if (status.phase !== 'SAVED') { savePort.discardPendingWrite(); lastShopReceipt = Object.freeze({ ok:false, reason:'SAVE_FAILED' }); }
            else {
              friendsPlaytest = friends; revision += 1;
              shop = createShopRuntime({ snapshot:candidate.toSave(), huntInventory, allowRepeatedCages:playtestPolicy?.enabled === true,
                allItemsVisible:playtestPolicy?.shopOpen === true, progression:progressionContext() });
              applyMappedHuntInventoryFromShop(shop, huntInventory); bindShopRuntime();
              lastShopReceipt = receipt;
            }
          }
        }
      } else {
        lastShopReceipt = requireShop().upgradeHuntFamily(familyId);
        if (lastShopReceipt.ok) savePort.markDirty();
      }
      publishScreens();
      return lastShopReceipt;
    },

    refillHuntTool(familyId, quantity = 1) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.SHOP) throw new Error("CHAMPIONSHIP_SHOP_NOT_ACTIVE");
      lastShopReceipt = requireShop().refillHuntFamily(familyId, quantity);
      if (lastShopReceipt.ok) savePort.markDirty();
      publishScreens();
      return lastShopReceipt;
    },

    /** Every rope snapped out on the field: five more of the rope in hand (or the best colour held), paid in bits. */
    buyEmergencyHuntRopes() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return Object.freeze({ ok:false, reason:'UNAVAILABLE' });
      const selected = huntLoadout?.getSelectedEquipment().find(s => s.equipmentClass === 'ROPE')?.itemId ?? null;
      const receipt = requireShop().buyEmergencyRopes(emergencyRopeFamily(selected).familyId);
      if (receipt.ok) {
        const itemId = getShopRecord(receipt.shopRecordIndex).productItemId;
        huntLoadout?.selectEquipment('ROPE', itemId);
        savePort.markDirty();
      }
      publishScreens();
      return receipt;
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
      if (battleTransactionActive) throw new Error("CHAMPIONSHIP_BATTLE_TRANSACTION_ACTIVE");
      if (!Number.isSafeInteger(nextRank) || nextRank < 0) {
        throw new Error("INVALID_TAMER_RANK");
      }
      const previousRank = tamerRankValue;
      const ranch = this.getCageEditFrame();
      // Rank opens the main board's slots only; an expansion annex is not rank-gated.
      const layout = { layoutVersion: ranch?.layoutVersion, mainUnlocked: slotCountForTamerRank(nextRank), expansion: ranch?.expansion ?? null };
      if (ranch?.layoutVersion && (!validateRanchLayout(ranch.placements, layout)
        || !validateRanchLayout(cageEdit.toSave().placements, layout))) return previousRank;
      tamerRankValue = normalizeTamerRank(nextRank);
      applyProgression();
      if (tamerRankValue !== previousRank) savePort.markDirty();
      publishScreens();
      return tamerRankValue;
    },

    /**
     * Write the earned battle badges. Gate unlock kind 2 reads this list, and
     * until every title match exists the only other writer is a battle result,
     * so this is the same PRODUCT_AUTHORED seam `setTamerRank` is -- symmetric
     * with it on purpose, so a caller that can set one can set the other.
     */
    setBattleBadges(badges) {
      requireSession();
      if (huntCommitActive) throw new Error("CHAMPIONSHIP_HUNT_TRANSACTION_ACTIVE");
      if (battleTransactionActive) throw new Error("CHAMPIONSHIP_BATTLE_TRANSACTION_ACTIVE");
      if (!Array.isArray(badges) || badges.length > 62
        || [...badges].some((badge) => !Number.isSafeInteger(badge) || badge < 0 || badge > 61)) {
        throw new Error("INVALID_BATTLE_BADGES");
      }
      const next = [...new Set(badges)].sort((a, b) => a - b);
      const changed = next.length !== battleBadgesValue.length
        || next.some((badge, index) => badge !== battleBadgesValue[index]);
      battleBadgesValue = next;
      applyProgression();
      if (changed) savePort.markDirty();
      publishScreens();
      return Object.freeze([...battleBadgesValue]);
    },

    openShop() {
      requireSession();
      requireShop();
      if (screens.current() === CHAMPIONSHIP_SCREENS.SHOP) return screens.current();
      lastShopReceipt = null;
      lastGachaResult = null;
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
      // Cage copies and wallet become visible only after one durable save.
      let record;try{record=getShopRecord(shopRecordIndex);}catch{lastShopReceipt=Object.freeze({ok:false,reason:"UNAVAILABLE"});publishScreens();return lastShopReceipt;}
      if(playtestPolicy?.enabled && record.purchaseDomain==='CAGE_OWNERSHIP'){
        const candidate=createShopRuntime({snapshot:requireShop().toSave(),huntInventory,allowRepeatedCages:true,
          allItemsVisible:playtestPolicy.shopOpen,progression:progressionContext()});
        const receipt=candidate.buy(shopRecordIndex,quantity);
        if(!receipt.ok){lastShopReceipt=receipt;publishScreens();return receipt;}
        const status=savePort.save({...liveSaveRequest(revision+1),shop:candidate.toSave()});
        if(status.phase!=='SAVED'){savePort.discardPendingWrite();lastShopReceipt=Object.freeze({ok:false,reason:'SAVE_FAILED'});publishScreens();return lastShopReceipt;}
        shop=candidate;bindShopRuntime();revision++;lastShopReceipt=receipt;publishScreens();return receipt;
      }
      lastShopReceipt = requireShop().buy(shopRecordIndex, quantity);
      if (lastShopReceipt.ok) savePort.markDirty();
      publishScreens();
      return lastShopReceipt;
    },

    getDatabaseFrame() {
      const frame = projectDatabase({
        fullView: playtestPolicy?.enabled === true && playtestPolicy.fullDexView,
        starterSpeciesId: creature?.speciesId ?? null,
        collection: raising?.collection ?? [],
        registeredSpecies: registeredSpeciesValue,
        evolutionBranches: raising?.nativeHome?.evolutionBranches ?? [],
        productEvolutionBranches: raising?.nativeHome?.productEvolutionBranches ?? [],
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
    /** The tournaments board, reached from the battle menu as the original does. */
    openChampionship() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.CHAMPIONSHIP) return screens.current();
      screens.enter(CHAMPIONSHIP_SCREENS.CHAMPIONSHIP);
      publishScreens();
      return screens.current();
    },

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

    // Owner 2026-10-07: read the existing won-title flags; no new save authority.
    openMedals() {
      requireSession();
      if (screens.current() === CHAMPIONSHIP_SCREENS.MEDALS) return screens.current();
      screens.enter(CHAMPIONSHIP_SCREENS.MEDALS);
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
      if (!getDatabaseIllustration(speciesIndex)) getDatabaseSlot(speciesIndex);
      selectedDatabaseSpeciesIndex = speciesIndex;
      publishScreens();
      return this.getDatabaseFrame();
    },

    renameDatabaseInstance(instanceId, displayName) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.DATABASE) {
        throw new Error("CHAMPIONSHIP_DATABASE_NOT_ACTIVE");
      }
      raising = renameEnclosedCreature(raising, instanceId, displayName);
      savePort.markDirty();
      publishScreens();
      return raising.collection.find((entry) => entry.instanceId === instanceId)?.displayName ?? null;
    },

    /**
     * The roster's Name Edit, on the same product given-name rule the
     * Database and Hunt Result already apply to collected individuals. The
     * starter's name lives in its native profile, which this rule does not
     * write, so it is refused rather than half-renamed.
     */
    renameRosterInstance(instanceId, displayName) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.DIGIMON_LIST) {
        throw new Error("CHAMPIONSHIP_DIGIMON_LIST_NOT_ACTIVE");
      }
      if (!raising?.collection?.some((entry) => entry.instanceId === instanceId)) {
        return Object.freeze({ ok: false, reason: "NOT_RENAMEABLE" });
      }
      try { raising = renameEnclosedCreature(raising, instanceId, displayName); }
      catch { return Object.freeze({ ok: false, reason: "INVALID_GIVEN_NAME" }); }
      savePort.markDirty();
      publishScreens();
      return Object.freeze({ ok: true, displayName: raising.collection.find((entry) => entry.instanceId === instanceId)?.displayName ?? null });
    },

    /**
     * The player's own rebirth of a 成熟期 partner (OWNER_APPROVED_ADAPTATION 2026-11-02: 成熟期 no longer ages
     * out). The native rebirth record (cycle +1, egg) plays through the ranch's evolution presentation, as the
     * metal catalyst does, so the partner must be in the ranch.
     */
    rebirthRaisingPartner(instanceId) {
      requireSession();
      const profile=raisingNativeProfile(instanceId),actor=raisingActors.get(instanceId);
      if(!profile)return Object.freeze({ok:false,reason:'UNKNOWN_INDIVIDUAL'});
      if(!actor)return Object.freeze({ok:false,reason:'PARTNER_NOT_IN_RANCH'});
      if([...raisingActors.values()].some(a=>a.evolution))return Object.freeze({ok:false,reason:'EVOLUTION_RUNNING'});
      const rebirth=productRebirth(profile);
      if(!rebirth.ok)return Object.freeze({ok:false,reason:rebirth.reason});
      writeRaisingNativeProfile(instanceId,rebirth.profile);
      // Awakening raising (Owner 2026-11-02): a reborn partner keeps every form it learned; it bursts into them
      // again once it is a 成熟期 that can (awakeningDisplayFor and burstPlanFor read its current 成熟期).
      beginNativeRaisingEvolution(actor,{target:rebirth.target},{next:nextGameplayRandom},raisingFoods);
      publishRaising();
      return Object.freeze({ok:true,target:rebirth.target});
    },

    getCageEditFrame() {
      if (!cageEdit) return null;
      const frame=requireCageEdit().getFrame(...cageEditArgs());
      if(!frame.productGrid)return Object.freeze({...frame,testDiamonds:friendsPlaytest?.diamonds??0});
      // DIAMOND_ECONOMY_20261102: royal cages get their own tray cards (their own modules since 2026-11-03).
      const royal=royalTrayView(frame);
      const tray=frame.tray;
      return Object.freeze({...frame,tray:Object.freeze(tray),testDiamonds:friendsPlaytest?.diamonds??0,royalTray:Object.freeze(royal),
        automation:cageAutomationView(frame),land:landView(frame),landExpansion:lastLandExpansion,
        // Owner 2026-11-03: the cores in the bag, so a selected cage can take one in place.
        cores:Object.freeze(AUTOMATION_ITEMS.filter(item=>item.kind==='CORE').map(item=>Object.freeze({id:item.id,name:item.name,module:item.module??null,
          modules:item.modules,owned:cyberGacha?.automation?.[item.id]??0}))),gachaResult:lastGachaResult});
    },

    openCageEdit() {
      requireSession();
      requireCageEdit();
      if (screens.current() === CHAMPIONSHIP_SCREENS.CAGE_EDIT) return screens.current();
      cageEdit.selectModule(null, ...cageEditArgs());
      draftRoyalEditions=null;pendingRoyalEdition=null;
      screens.enter(CHAMPIONSHIP_SCREENS.CAGE_EDIT);
      publishScreens();
      return screens.current();
    },

    selectCageModule(moduleId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().selectModule(moduleId, ...cageEditArgs());
      pendingRoyalEdition=null;
      publishScreens();
      return this.getCageEditFrame();
    },

    /** Pick a royal cage card (DIAMOND_ECONOMY_20261102): its base cage is selected and the next placement is royal. */
    selectRoyalCage(itemId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      const item=getAutomationItem(itemId),editor=requireCageEdit();
      const card=item?.edition?royalTrayView(editor.getFrame(...cageEditArgs())).find(entry=>entry.id===itemId):null;
      if(!card||card.available<1){editor.selectModule(null,...cageEditArgs());pendingRoyalEdition=null;publishScreens();return this.getCageEditFrame();}
      editor.selectModule(card.moduleId,...cageEditArgs());
      pendingRoyalEdition=item.edition;
      publishScreens();
      return this.getCageEditFrame();
    },

    placeCageAt(slotIndex) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      const editor=requireCageEdit(),before=new Set(editor.getFrame(...cageEditArgs()).placements.map(p=>p.instanceId));
      const frame=editor.placeAt(slotIndex, ...cageEditArgs());
      // A royal cage's placement carries its edition by instance id (its module is the royal map).
      const added=frame.placements.find(p=>p.instanceId&&!before.has(p.instanceId));
      if(added){
        const edition=getCageDefinitionByModuleId(added.moduleId)?.gachaEdition??null;
        if(edition)draftRoyalEditions={...royalDraft(),[added.instanceId]:edition};
        pendingRoyalEdition=null;
      }
      publishScreens();
      return this.getCageEditFrame();
    },

    removeCagePlacement(moduleId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      // Hex cage world v1: a cage that is some partner's home cannot be taken
      // away; the player moves the partner first (Owner direction 2026-10-26).
      requireCageEdit().removePlacement(moduleId, ...cageEditArgs(), { residentInstances: ranchResidentInstances() });
      // A royal cage taken off the board goes back to its card (the edition follows the instance id).
      const live=new Set(requireCageEdit().getFrame(...cageEditArgs()).placements.map(p=>p.instanceId));
      const draft=royalDraft();
      if(Object.keys(draft).some(id=>!live.has(id)))draftRoyalEditions=Object.fromEntries(Object.entries(draft).filter(([id])=>live.has(id)));
      publishScreens();
      return this.getCageEditFrame();
    },

    moveCagePlacement(instanceId, slotIndex) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) {
        throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      }
      requireCageEdit().movePlacement(instanceId, slotIndex, ...cageEditArgs());
      publishScreens();
      return this.getCageEditFrame();
    },

    /**
     * Ranch expansion PROTOTYPE (2026-10-05): grant or revoke one annex deck
     * without any payment. Price, free unlock path, cap and competitive rules
     * are undecided; nothing here charges, sells or records a purchase.
     */
    grantRanchExpansionPrototype() {
      return changeRanchExpansion((editor) => editor.grantExpansion(...cageEditArgs()));
    },

    // Stage row entitlement and simulated diamond debit together; publish only
    // after the same durable save succeeds. A failed write cannot be retried as
    // a hidden purchase after the UI has reported rollback.
    buyRanchTestRow(row) {
      requireSession();
      if (!productLand || screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT || tutorialBaseline || battleTransactionActive || huntCommitActive || battleEconomy.active) return {ok:false,reason:'TEST_ROW_PURCHASE_UNAVAILABLE'};
      const editor = requireCageEdit();
      const quote = editor.quoteTestRow(row, ...cageEditArgs());
      // Owner 2026-11-03: the step price climbs with the land already open (200 → 2,200).
      const price = this.getCageEditFrame()?.land?.price
        || LAND_EXPANSION.prices[Math.min(LAND_EXPANSION.prices.length - 1, friendsPlaytest?.purchases?.length ?? 0)];
      const purchase = quote.ok ? purchaseTestRanchRow(friendsPlaytest,row,price) : quote;
      if (!purchase.ok) {
        editor.rejectTestRowPurchase(purchase.reason,...cageEditArgs());publishScreens();
        return Object.freeze({...this.getCageEditFrame(),ok:false,reason:purchase.reason});
      }
      const candidateEditor = createCageEditRuntime({snapshot:editor.toSave(),publicTestGrid:true,initialTamerRank:tamerRankValue});
      candidateEditor.applyTestRowPurchase(row,...cageEditArgs());
      storeNativeRaisingPositions();storeNativeRaisingHome();
      const status = savePort.save({...liveSaveRequest(revision+1),friendsPlaytest:purchase.state,cageEdit:candidateEditor.toSave()});
      if (status.phase !== 'SAVED') {
        savePort.discardPendingWrite();
        editor.rejectTestRowPurchase('SAVE_FAILED',...cageEditArgs());publishScreens();
        return Object.freeze({...this.getCageEditFrame(),ok:false,reason:'SAVE_FAILED'});
      }
      friendsPlaytest=purchase.state;editor.applyTestRowPurchase(row,...cageEditArgs(),price);revision+=1;
      raisingActors.clear();initializeNativeRaisingHome();publishScreens();
      return Object.freeze({...this.getCageEditFrame(),ok:true,receipt:purchase.receipt});
    },

    /**
     * Diamond land expansion (DIAMOND_ECONOMY_20261102): the next +10 cells for the step's price (200 → 2,200), saved at once
     * (the same atomic row purchase), up to 100 cells. Each step also lifts the hunt memory card by 8 G.
     */
    expandRanchLand() {
      requireSession();
      const frame=this.getCageEditFrame(),land=frame?.land;
      if(!land)return Object.freeze({...frame,ok:false,reason:'LAND_EXPANSION_UNAVAILABLE'});
      if(land.max)return Object.freeze({...frame,ok:false,reason:'LAND_AT_MAXIMUM'});
      const result=this.buyRanchTestRow(land.nextRow);
      if(!result.ok)return Object.freeze({...result,before:land.capacity,after:land.capacity});
      const after=this.getCageEditFrame().land?.capacity??land.capacity;
      lastLandExpansion=Object.freeze({serial:++automationSerial,before:land.capacity,after,row:land.nextRow,tier:landExpansionTier(after)});
      publishScreens();
      return Object.freeze({...this.getCageEditFrame(),ok:true,receipt:result.receipt,before:land.capacity,after});
    },

    revokeRanchExpansionPrototype() {
      return changeRanchExpansion((editor) => editor.revokeExpansion(...cageEditArgs()));
    },

    /** Drop the unconfirmed draft; the committed layout and save are untouched. */
    revertCageEdit() {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.CAGE_EDIT) throw new Error("CHAMPIONSHIP_CAGE_EDIT_NOT_ACTIVE");
      requireCageEdit().revert(...cageEditArgs());
      draftRoyalEditions=null;pendingRoyalEdition=null;
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
      // DIAMOND_ECONOMY_20261102: the confirmed layout settles royal cages and cores (bag <-> board).
      const liveIds=editor.toSave().placements.map(p=>p.instanceId).filter(Boolean);
      const royalBefore=JSON.stringify(cyberGacha?.editions??{}),mountsBefore=JSON.stringify(cyberGacha?.mounts??{});
      if(cyberGacha&&(draftRoyalEditions||Object.keys(cyberGacha.mounts??{}).length||Object.keys(cyberGacha.editions??{}).length)){
        const settled=settleRanchAutomation(cyberGacha,{editions:royalDraft(),liveInstanceIds:liveIds});
        if(settled.ok){cyberGacha=settled.state;savePort.markDirty();}
      }
      draftRoyalEditions=null;pendingRoyalEdition=null;
      const automationChanged=JSON.stringify(cyberGacha?.editions??{})!==royalBefore||JSON.stringify(cyberGacha?.mounts??{})!==mountsBefore;
      if (automationChanged&&JSON.stringify(editor.toSave()) === before) {
        for(const id of Object.keys(cyberGacha?.editions??{}))sweepAutomatedCage(id);
        publishRaising();
      }
      if (JSON.stringify(editor.toSave()) !== before) {
        const nextGround=createNativeRaisingGround({...editor.toSave(),unlockedCount:slotCountForTamerRank(tamerRankValue)});
        // Owner 2026-10-27: partners beside a newly opened passage go and look.
        const opened=raisingGround?.navigation&&nextGround?.navigation
          ?nextGround.navigation.connections.filter(c=>!raisingGround.navigation.connections.some(o=>o.id===c.id)):[];
        const visits=new Map();
        for(const c of opened){
          const left=nextGround.placements[c.left]?.instanceId,right=nextGround.placements[c.right]?.instanceId;
          if(left&&right){visits.set(left,right);visits.set(right,left);}
        }
        if(raisingGround?.navigation&&nextGround?.navigation){
          for(const actor of raisingActors.values())actor.positionQ12=ranchPositionAfterLayout(raisingGround,nextGround,actor.positionQ12,actor.cageInstanceId??actor.cageDefinitionIndex);
          for(const item of [...raisingFoods,...raisingWaste])item.positionQ12=ranchPositionAfterLayout(raisingGround,nextGround,item.positionQ12,item.cageInstanceId??item.cageDefinitionIndex);
          raisingGround=nextGround;storeNativeRaisingPositions();storeNativeRaisingHome();
        }
        raisingActors.clear();initializeNativeRaisingHome({restoreLayoutPositions:true});savePort.markDirty();
        for(const actor of raisingActors.values()){const across=visits.get(actor.cageInstanceId);if(across)actor.passageVisit=across;}
        for(const id of Object.keys(cyberGacha?.editions??{}))sweepAutomatedCage(id);
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
      if(tutorialBaseline)return screens.current();
      screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_SELECT);
      publishScreens();
      return screens.current();
    },

    getBattleEconomyState() {
      return battleEconomy;
    },


    getCyberGachaFrame(){
      requireSession();
      const state=gachaState();
      const partners=this.getRaisingInstances().map(entry=>{
        const profile=gachaProfile(entry.instanceId),index=profile?.fields['000']??null;
        const species=Number.isInteger(index)?nativeHuntSpeciesByIndex(index):null;
        // displayName/speciesId/source let the views show the partner as everywhere else (raisingDisplayName), not its raw native name.
        return Object.freeze({instanceId:entry.instanceId,name:profile?.name||entry.displayName,speciesIndex:index,
          displayName:entry.displayName??null,speciesId:entry.speciesId??null,source:entry.source??null,
          generation:species?.generation??null,inRanch:raisingActors.has(entry.instanceId),
          stats:profile?projectNativeIndividualStats(profile):null,bloodline:gachaBloodlineOf(state,entry.instanceId),
          // GACHA_FULL_EFFECTS_20261109: each evolution route with what it still lacks (the catalyst picks one).
          routes:profile&&species&&species.generation>=1&&species.generation<=3?evolutionRouteGaps(profile,PRODUCT_GROWTH_RULES)
            .map(route=>({ruleIndex:route.ruleIndex,target:route.target,unmetCount:route.unmetCount,
              unmet:route.unmet.map(row=>({kind:row.kind,field:row.field,need:row.need,current:row.current}))})):[]});
      });
      return deepFreeze({tickets:state.tickets,diamonds:friendsPlaytest?.diamonds??null,bits:shop?.getBits()??0,
        pity:state.pity,pityMax:GACHA_PITY_MAX,pulls:state.pulls,machines:GACHA_MACHINES,
        chips:GACHA_CHIPS.map(chip=>({...chip,owned:state.chips[chip.id]??0,
          armed:state.armed.hunt?.includes(chip.id)===true||state.armed.bounty===chip.id})),
        metals:GACHA_METALS.map(metal=>{const into=shardFusionTarget(metal.id);
          // What it does for an awakening (the bag explains 「催化進化」 on a 成熟期 from these numbers).
          const tier1=awakeningItemEnergy(metal,1),tier2=awakeningItemEnergy(metal,2);
          return {...metal,owned:state.metals[metal.id]??0,awaken:{fill:tier1.fill,tier1:tier1.amount,tier2:tier2.amount,cap:AWAKENING_RULES.itemCap},
            ...(into?{fusesInto:{id:into.id,name:into.name,rarity:into.rarity},fusionCost:GACHA_SHARD_FUSION_COST}:{})};}),
        goods:GACHA_GOODS,bloodlines:GACHA_BLOODLINES,autoFill:autoFillSynthesizer(state),
        tierSmelt:Object.keys(GACHA_TIER_SMELT).map(rarity=>{const plan=shardTierSmeltPlan(state,rarity),target=getGachaMetal(GACHA_TIER_SMELT[rarity]);
          return {rarity,cost:GACHA_TIER_SMELT_COST,target:{id:target.id,name:target.name,rarity:target.rarity,art:target.art},ready:plan.ok,shards:plan.ok?plan.shards:[]};}),
        armed:state.armed,partners,lastResult:lastGachaResult,
        // DIAMOND_ECONOMY_20261102: ranch automation items, directed recipes, placed cages, rewards and the founder box.
        automation:AUTOMATION_ITEMS.map(item=>{
          const recipe=AUTOMATION_RECIPES.find(r=>r.id===item.id),plan=automationForgePlan(state,item.id);
          return Object.freeze({...item,owned:state.automation?.[item.id]??0,
            placed:item.edition?Object.values(state.editions??{}).filter(e=>e===item.edition).length
              :Object.values(state.runs??{}).filter(run=>coreModules(item).some(m=>run[m]>0)).length,
            runSeconds:AUTOMATION_RULES.runSeconds,runCapSeconds:AUTOMATION_RULES.runCapSeconds,
            recipe:recipe?Object.freeze({chips:recipe.chips,shards:recipe.shards,ready:plan.ok,reason:plan.ok?null:plan.reason}):null});
        }),
        cages:automationCageList(state),
        diamondRewards:pendingDiamondMilestones(),lastDiamondRewards,founder:founderPackView()});
    },

    /** Forge one automation item from its fixed recipe (the furnace's pity path). */
    gachaForgeAutomation(itemId){
      if(screens.current()!==CHAMPIONSHIP_SCREENS.SHOP)throw new Error('CHAMPIONSHIP_SHOP_NOT_ACTIVE');
      const result=forgeAutomationItem(gachaState(),itemId);
      if(!result.ok)return gachaRefusal(result.reason);
      if(!commitGacha({state:result.state}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'FORGE',consumed:result.consumed,prizes:[gachaPrizeView(result.prize)]});
    },
    /**
     * Deploy a core from the bag on a placed (confirmed) cage for one hour, or add an hour to the machine already
     * running there (AUTO_CARE_3D_20261103). The core is used up; the machine comes out on the ranch at once.
     */
    gachaDeployCore(coreId,instanceId){
      requireSession();
      if(!cageEdit?.toSave().placements.some(p=>p.instanceId===instanceId))return gachaRefusal('UNKNOWN_CAGE');
      const result=deployAutomationCore(gachaState(),coreId,instanceId);
      if(!result.ok)return gachaRefusal(result.reason);
      if(!commitGacha({state:result.state}))return gachaRefusal('SAVE_FAILED');
      if(raisingGround)syncAutoCareMachines();
      publishRaising();
      const auto=cageAutomation(cyberGacha,instanceId);
      return gachaReceipt({ok:true,kind:result.extended?'EXTEND':'DEPLOY',itemId:coreId,instanceId,
        cleanSeconds:auto.cleanSeconds,feedSeconds:auto.feedSeconds});
    },
    /** Claim every rank and encyclopedia diamond reward reached so far, in one save. */
    claimDiamondRewards(){
      requireSession();
      const paid=payDiamondRewards(pendingDiamondMilestones());
      publishScreens();
      return paid;
    },
    getDiamondRewards(){return Object.freeze({pending:pendingDiamondMilestones(),last:lastDiamondRewards});},
    /** The founder box (fixed contents, no randomness): free once in the playtest after a first tournament medal. */
    getFounderPack(){return session?founderPackView():null;},
    claimFounderPack(){
      requireSession();
      const view=founderPackView();
      if(!friendsPlaytest)return gachaRefusal('NO_DIAMOND_WALLET');
      if(view.claimed)return gachaRefusal('ALREADY_CLAIMED');
      if(!view.unlocked)return gachaRefusal('FOUNDER_PACK_LOCKED');
      const bundle=claimGachaBundle(gachaState(),{key:FOUNDER_PACK.key,items:FOUNDER_PACK.items,tickets:FOUNDER_PACK.tickets});
      if(!bundle.ok)return gachaRefusal(bundle.reason);
      const credit=creditTestDiamonds(friendsPlaytest,FOUNDER_PACK.diamonds);
      if(!commitGacha({state:bundle.state,friends:credit.state}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'FOUNDER',diamonds:credit.granted,tickets:FOUNDER_PACK.tickets,
        prizes:FOUNDER_PACK.items.map(([id,quantity])=>gachaPrizeView({kind:'AUTOMATION',id,rarity:getAutomationItem(id).rarity,quantity}))});
    },
    /** Automation items into the bag (loopback QA and future grants), saved at once. */
    grantAutomationItem(itemId,quantity=1,reason='REWARD'){
      requireSession();
      const result=grantGachaAutomation(gachaState(),itemId,quantity);
      if(!result.ok)return Object.freeze({ok:false,reason:result.reason});
      if(!commitGacha({state:result.state}))return Object.freeze({ok:false,reason:'SAVE_FAILED'});
      publishScreens();
      return Object.freeze({ok:true,itemId,quantity,reason});
    },
    /** Whether the brag card wears the founder's gold frame. */
    hasFounderFrame(){return Boolean(cyberGacha?.claimed?.includes(FOUNDER_PACK.key));},
    /** The ranch field's machine countdown tags (one per running machine, native Q12). */
    getCageAutomationFrame(){return session?autoCareTags():Object.freeze([]);},
    /** The deployed 3D machines (cleaning robots, feeding towers, the ones folding away), native px. */
    getAutoCareFrame(){return session?autoCareFrame():Object.freeze({cleaners:Object.freeze([]),feeders:Object.freeze([])});},
    /** Recent auto-clean / auto-feed events, newest last (each has a serial for the UI). */
    getAutomationEvents(){return Object.freeze([...automationEvents]);},

    /** The bloodline inscribed on one partner, or null (name badges, rings, cards). */
    getPartnerBloodline(instanceId){return gachaBloodlineOf(cyberGacha,instanceId);},
    /** The partner's burst forms, conditions, current values and unlock state (OWNER_APPROVED_ADAPTATION 2026-11-02). */
    getPartnerBurst(instanceId){return partnerBurstView(instanceId);},
    getBattleBurstPlan(instanceId){return battleBurstPlanOf(instanceId);},
    /** Awakening raising (OWNER_APPROVED_ADAPTATION 2026-11-02): the partner's awakening path, or null. */
    getPartnerAwakening(instanceId){return partnerAwakeningView(instanceId);},
    /** Sponsor stake contracts (AWAKENING_OVERDRIVE_20261109): the three, the stakes, the armed one and the wallet. */
    getSponsorContracts(){
      if(!session)return null;
      const used=sponsorContractsSignedOn(burstState(),localDayNumber(realNowMs()));
      return Object.freeze({contracts:SPONSOR_CONTRACTS,stakes:SPONSOR_STAKES,armed:sponsorContractOf(burstState()),
        escrow:sponsorEscrowOf(burstState()),bits:shop?.getBits()??0,caps:SPONSOR_STAKE_CAPS,odds:SPONSOR_ODDS,
        today:Object.freeze({used,limit:SPONSOR_DAILY_LIMIT,left:Math.max(0,SPONSOR_DAILY_LIMIT-used)})});
    },
    /** Arm one contract for the next AI title match, free battle or tournament round (null contractId disarms). */
    armSponsorContract(contractId,stake=SPONSOR_STAKES.defaultStake){
      requireSession();
      if(contractId===null){burstEvolution=withSponsorContract(burstState(),null);savePort.markDirty();return Object.freeze({ok:true,armed:null});}
      if(!sponsorContract(contractId))return Object.freeze({ok:false,reason:'UNKNOWN_CONTRACT'});
      if(!validSponsorStake(stake))return Object.freeze({ok:false,reason:'INVALID_STAKE'});
      if((shop?.getBits()??0)<stake)return Object.freeze({ok:false,reason:'NOT_ENOUGH_BITS'});
      burstEvolution=withSponsorContract(burstState(),{contractId,stake});savePort.markDirty();
      return Object.freeze({ok:true,armed:sponsorContractOf(burstEvolution)});
    },
    getSponsorEscrow(){return session?sponsorEscrowOf(burstState()):null;},
    /** Both teams' power for the match about to start (total maximum HP); the next begin reads the odds. */
    setSponsorMatchOdds(playerPower,foePower){sponsorMatchOdds=sponsorOdds(playerPower,foePower);return sponsorMatchOdds;},
    /** Why the armed contract did not ride the last match, once (null when it did or none was armed). */
    takeSponsorRefusal(){const refusal=lastSponsorRefusal;lastSponsorRefusal=null;return refusal;},
    /** Data Arena: the armed contract takes its stake as a tournament or relay starts. Returns {ok, foeBoostPercent}. */
    beginArenaSponsorContract({playerPower=0,foePower=0}={}){
      requireSession();
      const armed=sponsorContractOf(burstState()),bits=shop?.getBits()??0,odds=sponsorOdds(playerPower,foePower);
      // A stake still held by an arena match that never reached its result stays with the sponsor.
      const stale=sponsorEscrowOf(burstState());
      if(stale?.attemptId.startsWith('arena:')){burstEvolution=withSponsorEscrow(burstState(),null);
        lastSponsorSettlement=Object.freeze({attemptId:stale.attemptId,contractId:stale.contractId,stake:stale.stake,met:false,payout:0,gains:Object.freeze([]),forfeited:true});}
      const admission=armed&&!sponsorEscrowOf(burstState())?sponsorAdmission(armed,'ARENA',odds,bits):{ok:false,reason:'NO_CONTRACT'};
      if(!admission.ok){refuseSponsor(armed,admission);savePort.markDirty();return Object.freeze({ok:false,reason:admission.reason,cap:admission.cap??null});}
      if(!shop.applyBitsTransaction({expectedBits:bits,bits:bits-armed.stake}).ok)return Object.freeze({ok:false,reason:'WALLET_CHANGED'});
      const foeBoostPercent=sponsorContract(armed.contractId)?.condition.foeBoostPercent??0;
      burstEvolution=withSponsorSigned(withSponsorEscrow(withSponsorContract(burstState(),null),{...armed,attemptId:`arena:${realNowMs()}`,foeBoostPercent,
        ...(odds.bonus?{oddsBonus:true}:{})}),localDayNumber(realNowMs()));
      savePort.markDirty();
      return Object.freeze({ok:true,contractId:armed.contractId,stake:armed.stake,foeBoostPercent,oddsBonus:odds.bonus});
    },
    /** Data Arena: settle the staked contract on the match result ({won, partnerDowns, seconds, partyIds}). */
    settleArenaSponsorContract({won=false,partnerDowns=0,seconds=Infinity,partyIds=[]}={}){
      requireSession();
      const escrow=sponsorEscrowOf(burstState());
      if(!escrow?.attemptId.startsWith('arena:'))return Object.freeze({ok:false,reason:'NO_ESCROW'});
      const settled=settleSponsorContract(escrow,{won:won===true,partnerDowns,seconds,foeBoostPercent:escrow.foeBoostPercent});
      const before={creature,raising,burst:burstEvolution,gacha:cyberGacha},bits=shop.getBits();
      burstEvolution=withSponsorEscrow(burstState(),null);
      const gains=settled.met?sponsorReward(settled.reward,partyIds.filter(id=>partnerProfile(id))):Object.freeze([]);
      if(settled.payout>0&&!shop.applyBitsTransaction({expectedBits:bits,bits:Math.min(BITS_WALLET_CAP,bits+settled.payout)}).ok){
        creature=before.creature;raising=before.raising;burstEvolution=before.burst;cyberGacha=before.gacha;
        return Object.freeze({ok:false,reason:'WALLET_CHANGED'});
      }
      lastSponsorSettlement=Object.freeze({attemptId:escrow.attemptId,contractId:escrow.contractId,stake:escrow.stake,met:settled.met,payout:settled.payout,gains});
      savePort.markDirty();publishRaising();
      return Object.freeze({ok:true,...lastSponsorSettlement});
    },
    /** The last settled (or forfeited) contract, for the result screen. */
    getLastSponsorSettlement(){return lastSponsorSettlement;},
    /** Overdrive training switch for one awakening partner (AWAKENING_OVERDRIVE_20261109). */
    setPartnerOverdrive(instanceId,on){
      requireSession();
      const view=partnerAwakeningView(instanceId);if(!view)return Object.freeze({ok:false,reason:'NOT_AWAKENABLE'});
      if(!realtime)return Object.freeze({ok:false,reason:'REALTIME_ONLY'});
      const record=overdriveOf(burstState(),instanceId),now=realNowMs();
      const heat=Math.round(overdriveHeatNow(instanceId,record));
      const next={on:on===true,heat,at:now,...(record?.fatigueUntil>now?{fatigueUntil:record.fatigueUntil}:{})};
      burstEvolution=withOverdrive(burstState(),instanceId,next.on||next.heat>0||next.fatigueUntil?next:null);
      savePort.markDirty();publishRaising();
      return Object.freeze({ok:true,on:next.on,heat});
    },
    /** Overdrive training results since the last read (boosts, epiphanies, backlashes, no bits). */
    takeOverdriveEvents(){return Object.freeze(overdriveEvents.splice(0));},
    /** Ranch signs of partners still raising a form: {instanceId: {form, tier, percent, glow, ready}}. */
    getAwakeningSigns(){return Object.freeze(Object.fromEntries(awakeningSigns));},
    /** The learned form a 成熟期 shows on the ranch now (its ceremony's display, or its chosen look), or null. */
    getRaisingDisplaySpecies(instanceId){
      const profile=partnerProfile(instanceId);
      return profile?awakeningDisplayFor(burstState(),instanceId,profile.fields['000'],realNowMs()):null;
    },
    /** The form shards and metals push for this partner (null: the default focus). */
    setAwakeningTarget(instanceId,form){
      requireSession();
      const view=partnerAwakeningView(instanceId);if(!view)return Object.freeze({ok:false,reason:'NOT_AWAKENABLE'});
      if(form!==null&&!view.forms.some(f=>f.form===form&&!f.learned))return Object.freeze({ok:false,reason:'NOT_A_TARGET'});
      const next=setAwakeningTarget(burstState(),instanceId,form);
      if(next){burstEvolution=next;savePort.markDirty();refreshAwakeningSigns([instanceId]);}
      return Object.freeze({ok:true,target:form});
    },
    /**
     * Feed a shard or a metal to the partner's focus form: shards and SSR metals add awakening energy up to the
     * item cap, a UR metal fills the form and lifts its rebirth gate. A full metal also raises every stat and
     * inscribes its bloodline, as using it always did.
     */
    feedAwakening(instanceId,itemId){
      requireSession();
      const metal=getGachaMetal(itemId),state=gachaState();
      if(!metal)return gachaRefusal('UNKNOWN_ITEM');
      if((state.metals[itemId]??0)<1)return gachaRefusal('NOT_OWNED');
      const profile=gachaProfile(instanceId);if(!profile)return gachaRefusal('UNKNOWN_INDIVIDUAL');
      const view=partnerAwakeningView(instanceId),focus=view?.forms.find(f=>f.form===view.focus)??null;
      if(!focus)return gachaRefusal('NO_AWAKENING_TARGET');
      const shard=metal.id.endsWith('-shard'),{amount:nominal,fill}=awakeningItemEnergy(metal,focus.tier);
      if(!nominal)return gachaRefusal('NOT_AN_AWAKENING_ITEM');
      // The receipt reports what was really added: items stop at the item cap.
      const amount=fill?nominal:Math.min(nominal,Math.max(0,AWAKENING_RULES.itemCap-(focus.energy??0)));
      const nextBurst=feedAwakeningEnergy(burstState(),instanceId,focus.form,{amount,fill});
      if(!nextBurst)return gachaRefusal('AWAKENING_ENERGY_FULL');
      const bloodline=inscribesBloodline(metal)?metal.family:null;
      const spent=spendGachaItem(state,itemId,{instanceId,bloodline});
      if(!spent.ok)return gachaRefusal(spent.reason);
      const before={creature,raising,registered:registeredSpeciesValue,burst:burstEvolution};
      if(!shard)writeRaisingNativeProfile(instanceId,normalizeNativeIndividualProfile(applyGachaBoost(profile,metalBoostEffect(metal)),
        this.resolveRaisingInstance(instanceId).speciesId),{markDirty:false});
      burstEvolution=nextBurst;
      if(!commitGacha({state:spent.state})){
        creature=before.creature;raising=before.raising;registeredSpeciesValue=before.registered;burstEvolution=before.burst;return gachaRefusal('SAVE_FAILED');
      }
      refreshAwakeningSigns([instanceId],{publish:false});publishRaising();
      const after=partnerAwakeningView(instanceId)?.forms.find(f=>f.form===focus.form);
      return gachaReceipt({ok:true,kind:'AWAKEN_ENERGY',itemId,instanceId,target:focus.form,tier:focus.tier,amount,fill,
        percent:after?.percent??null,ready:after?.ready===true,bloodline});
    },
    /** Core transcendence: with bond at bondMinimum, a full SSR/UR metal lights a star that counts as a rebirth. */
    transcendPartner(instanceId,itemId){
      requireSession();
      const metal=getGachaMetal(itemId),state=gachaState(),rules=AWAKENING_RULES.transcendence;
      if(!metal||metal.id.endsWith('-shard')||!rules.metalRarities.includes(metal.rarity))return gachaRefusal('NOT_A_TRANSCEND_METAL');
      if((state.metals[itemId]??0)<1)return gachaRefusal('NOT_OWNED');
      const profile=gachaProfile(instanceId);
      if(!profile||!burstFormsFor(profile.fields['000']).length)return gachaRefusal('NOT_AWAKENABLE');
      if((profile.fields['020']|0)<rules.bondMinimum)return gachaRefusal('BOND_TOO_LOW');
      const nextBurst=addTranscendStar(burstState(),instanceId);if(!nextBurst)return gachaRefusal('STARS_FULL');
      const bloodline=inscribesBloodline(metal)?metal.family:null;
      const spent=spendGachaItem(state,itemId,{instanceId,bloodline});if(!spent.ok)return gachaRefusal(spent.reason);
      const before=burstEvolution;burstEvolution=nextBurst;
      if(!commitGacha({state:spent.state})){burstEvolution=before;return gachaRefusal('SAVE_FAILED');}
      refreshAwakeningSigns([instanceId],{publish:false});publishRaising();
      return gachaReceipt({ok:true,kind:'TRANSCEND',itemId,instanceId,stars:transcendStarsOf(burstEvolution,instanceId),bloodline});
    },
    /**
     * The first awakening, played on the ranch: a ready form is learned, the account remembers it, the
     * encyclopedia registers it and the ranch shows it for ceremonyDisplaySeconds. A tier-2 form plays through
     * its tier-1 form (`via`).
     */
    awakenPartner(instanceId,form=null){
      requireSession();
      const view=partnerAwakeningView(instanceId);if(!view)return Object.freeze({ok:false,reason:'NOT_AWAKENABLE'});
      const ready=view.forms.filter(f=>f.ready),chosen=ready.find(f=>f.form===form)??ready.find(f=>f.form===view.focus)??ready[0];
      if(!chosen)return Object.freeze({ok:false,reason:'NOT_READY'});
      const until=realNowMs()+AWAKENING_RULES.ceremonyDisplaySeconds*1000;
      burstEvolution=learnAwakening(burstState(),instanceId,chosen.form,{shownUntil:until});
      for(const f of [chosen.form,...chosen.alternates])registeredSpeciesValue=registerNativeBookSpecies(registeredSpeciesValue,f);
      savePort.markDirty();refreshAwakeningSigns([instanceId],{publish:false});publishRaising();
      const bloodline=gachaBloodlineOf(cyberGacha,instanceId);
      return Object.freeze({ok:true,instanceId,form:chosen.form,tier:chosen.tier,via:chosen.tier===2?chosen.via:null,base:view.base,
        bloodline:bloodline?Object.freeze({family:bloodline.family,color:bloodline.color,ring:bloodline.ring}):null,until});
    },
    /** The ranch look: a learned form, or null for the 成熟期 itself; it also ends the ceremony's display. */
    setPartnerAppearance(instanceId,form){
      requireSession();
      if(!partnerProfile(instanceId))return Object.freeze({ok:false,reason:'UNKNOWN_INDIVIDUAL'});
      if(form!==null&&!burstUnlocksOf(burstState(),instanceId).includes(form))return Object.freeze({ok:false,reason:'BURST_FORM_LOCKED'});
      const current=burstState(),chosen=setAwakeningAppearance(current,instanceId,form)??current,next=clearAwakeningShown(chosen,instanceId)??chosen;
      if(next!==current){burstEvolution=next;savePort.markDirty();publishRaising();}
      return Object.freeze({ok:true,appearance:form});
    },
    /** Choose which unlocked form (an alternate included) this partner bursts into. */
    setPartnerBurstForm(instanceId,form){
      requireSession();
      if(!partnerProfile(instanceId))return Object.freeze({ok:false,reason:'UNKNOWN_INDIVIDUAL'});
      if(!burstUnlocksOf(burstState(),instanceId).includes(form))return Object.freeze({ok:false,reason:'BURST_FORM_LOCKED'});
      const next=preferBurstForm(burstState(),instanceId,form);
      if(next){burstEvolution=next;savePort.markDirty();publishRaising();}
      return Object.freeze({ok:true,form});
    },
    /** Burst unlocks earned since the last read (for a ranch notice). */
    takeBurstUnlockNotices(){const notices=lastBurstUnlocks;lastBurstUnlocks=Object.freeze([]);return notices;},

    /** Tickets (and beacon bonus) the last won match dropped, for the result podium. */
    getLastBattleGachaDrop(){return lastBattleGachaDrop;},
    /** Sync Level of one partner: { level, exp, next } (OWNER_APPROVED_ADAPTATION 2026-11-09). */
    getSyncLevel(instanceId){return syncLevelOf(instanceId);},
    /** The cap a title match or championship applies at the current tamer rank. */
    getSyncCap(){return syncCapForRank(tamerRankValue);},
    getSyncCrystals(){return normalizeSyncLevels(syncLevels).crystals;},
    getLastSyncGains(){return lastSyncGains;},
    /** Data Arena partner power from Sync Level, by instance. */
    getSyncArenaPower(instanceId){return syncArenaPower(syncLevelOf(instanceId).level);},
    /** A finished Data Arena match pays Sync EXP to the ranch partners that fought it. */
    grantArenaSync({instanceIds=[],won=false,attemptId=null}={}){
      if(tutorialBaseline)return null;
      const ids=[...new Set(instanceIds.filter(id=>typeof id==='string'&&syncProfileOf(id)))];
      if(!ids.length)return null;
      const gains=grantBattleSync(ids,{kind:'ARENA',won:won===true,attemptId});
      savePort.markDirty();publishRaising();return gains;
    },
    /** Journey: the tower's floors and the patrol pod, display-ready. */
    getJourneyFrame(){
      const state=journeyState(),next=towerNextFloor(state),pod=patrolStatus(state,journeyNow());
      return deepFreeze({best:state.tower.best,next,floors:TOWER_FLOORS,team:[...state.tower.team],
        crystals:normalizeSyncLevels(syncLevels).crystals,patrol:{...pod,quickAvailable:state.patrol.quickDay!==journeyLocalDay()}});
    },
    /** One tower floor for display: its band, opponents' species and first-clear rewards. */
    getTowerFloor(floor){
      const value=Math.max(1,Math.min(TOWER_FLOORS,floor|0)),state=journeyState();
      return deepFreeze({floor:value,stage:towerBand(value).stage,species:[...towerOpponentSpecies(value)],rewards:{...towerRewards(value)},
        cleared:value<=state.tower.best,open:value<=towerNextFloor(state)});
    },
    getLastTowerResult(){return lastTowerResult;},
    /** Journey zones: every stage's stars and whether it is open, display-ready. */
    getCampaignFrame(){
      const campaign=journeyState().campaign,day=journeyLocalDay();
      return deepFreeze({totalStars:totalStars(campaign),sweepsLeft:sweepsLeft(campaign,day),chestStars:CAMPAIGN_ZONE_CHEST.stars,
        zones:CAMPAIGN_ZONES.map(zone=>({zone:zone.zone,map:zone.map,field:zone.field,midBoss:zone.midBoss,boss:zone.boss,
          stars:zoneStars(campaign,zone.zone),chest:campaign.chests.includes(zone.zone),open:stageOpen(campaign,zone.zone,1),
          stages:Array.from({length:CAMPAIGN_STAGES},(_,i)=>{const stage=i+1;
            return {stage,stars:starsOf(campaign,zone.zone,stage),open:stageOpen(campaign,zone.zone,stage),boss:stage===3||stage===6,
              lead:campaignRivals(zone.zone,stage)[2].speciesId,rewards:{...campaignRewards(zone.zone,stage)}};})}))});
    },
    /** The Data Arena set-up for one open zone stage; the next arena result settles it. */
    beginCampaignStage(zone,stage){
      if(tutorialBaseline)return {ok:false,reason:'INTERACTIVE_TUTORIAL_ISOLATED'};
      if(!stageOpen(journeyState().campaign,zone,stage))return {ok:false,reason:'STAGE_LOCKED'};
      const info=CAMPAIGN_ZONES[zone-1];
      pendingCampaign=Object.freeze({zone,stage});
      return {ok:true,zone,stage,field:info.field,map:info.map,rivals:campaignRivals(zone,stage)};
    },
    /** A finished zone stage: stars, its first-clear prize and, at 18 stars, the zone chest. */
    settleCampaignStage({outcome,timeSeconds,fainted}={}){
      // The stage stays armed until another begins: the arena's retry key fights it again.
      const pending=pendingCampaign;
      if(!pending)return null;
      const stars=campaignStars({outcome,timeSeconds,fainted});
      const recorded=recordCampaignStage(journeyState().campaign,pending.zone,pending.stage,stars);
      journey={...journeyState(),campaign:recorded.campaign};
      let tickets=0,diamonds=0;
      const crystals=recorded.firstClear?.crystals??0;
      addSyncCrystals(crystals);
      let gacha=gachaState();
      const ticketCount=(recorded.firstClear?.tickets??0)+(recorded.chest?.tickets??0);
      if(ticketCount){const grant=grantGachaTickets(gacha,ticketCount);gacha=grant.state;tickets=grant.granted;}
      const paid=recorded.chest?payDiamondRewards([Object.freeze({key:`dia:zone:${pending.zone}`,kind:'ZONE',value:pending.zone,amount:recorded.chest.diamonds})],{state:gacha}):null;
      if(paid?.ok&&paid.granted)diamonds=paid.granted;
      else if(tickets&&!commitGacha({state:gacha}))tickets=0;
      savePort.markDirty();publishRaising();
      return Object.freeze({zone:pending.zone,stage:pending.stage,stars,best:starsOf(recorded.campaign,pending.zone,pending.stage),
        firstClear:Boolean(recorded.firstClear),crystals,tickets,diamonds,chest:Boolean(recorded.chest)});
    },
    /** Sweep a three-star stage for crystal points (ten a day). */
    sweepCampaignStage(zone,stage){
      if(tutorialBaseline)return {ok:false,reason:'INTERACTIVE_TUTORIAL_ISOLATED'};
      const swept=sweepCampaignStage(journeyState().campaign,zone,stage,journeyLocalDay());
      if(!swept)return {ok:false,reason:'SWEEP_UNAVAILABLE'};
      journey={...journeyState(),campaign:swept.campaign};addSyncCrystals(swept.crystals);savePort.markDirty();
      return {ok:true,crystals:swept.crystals};
    },
    /** Collect the patrol pod (the first collect starts it). */
    claimPatrol(){
      if(tutorialBaseline)return {ok:false,reason:'INTERACTIVE_TUTORIAL_ISOLATED'};
      const claimed=claimPatrol(journeyState(),journeyNow());
      journey=claimed.state;addSyncCrystals(claimed.crystals);savePort.markDirty();
      return {ok:true,crystals:claimed.crystals};
    },
    quickPatrol(){
      if(tutorialBaseline)return {ok:false,reason:'INTERACTIVE_TUTORIAL_ISOLATED'};
      const quick=quickPatrol(journeyState(),journeyLocalDay());
      if(!quick)return {ok:false,reason:'QUICK_PATROL_USED'};
      journey=quick.state;addSyncCrystals(quick.crystals);savePort.markDirty();
      return {ok:true,crystals:quick.crystals};
    },
    /** Prepare a tower floor like a Free Battle against that floor's presets, Sync uncapped. */
    async prepareTowerBattle(floor,instanceIds){
      const state=journeyState(),value=floor|0;
      if(value<1||value>towerNextFloor(state))return {ok:false,reason:'FLOOR_LOCKED'};
      const party=withBattleTactics(await this.prepareBattleParty(null,instanceIds,{sync:{capped:false}}));
      if(!party.ok)return party;
      if(!freeBattleMenu)rebuildFreeBattleMenu();
      const rngPreparation=this.prepareBattleRng(),prepared=battleRngPreparations.get(rngPreparation);
      const presetIndices=[...towerOpponents(value)];
      prepared.localMode=2;prepared.freeMenu=freeBattleMenu;prepared.individuals=party.individuals;
      prepared.freeMatch=Object.freeze({id:`tower:${value}`,kind:'TOWER',presetIndices,slots:3,entryFee:0,payout:0});
      prepared.towerFloor=value;
      const arenaIndex=FREE_BATTLE_ARENAS[prepared.rng.next(0)%FREE_BATTLE_ARENAS.length];
      return {ok:true,floor:value,presetIndices,arenaIndex,individuals:party.individuals,rngPreparation};
    },
    /**
     * Story battle (OWNER_APPROVED_ADAPTATION 2026-11-11): an ordinary free battle against
     * fixed native presets (the chapter's opponent), no entry fee and no purse -- the
     * chapter pays its own first-clear reward. Entered with enterFreeBattle.
     */
    async prepareStoryBattle(presetIndices,instanceIds){
      if(!Array.isArray(presetIndices)||!presetIndices.length||presetIndices.length>3)return {ok:false,reason:'STORY_PRESETS_REQUIRED'};
      try{for(const id of presetIndices)freeBattlePreset(id);}catch{return {ok:false,reason:'STORY_PRESET_UNKNOWN'};}
      const party=withBattleTactics(await this.prepareBattleParty(null,instanceIds,{sync:{capped:false}}));
      if(!party.ok)return party;
      if(!freeBattleMenu)rebuildFreeBattleMenu();
      const rngPreparation=this.prepareBattleRng(),prepared=battleRngPreparations.get(rngPreparation);
      prepared.localMode=2;prepared.freeMenu=freeBattleMenu;prepared.individuals=party.individuals;
      prepared.freeMatch=Object.freeze({id:'story',kind:'STORY',presetIndices:[...presetIndices],slots:3,entryFee:0,payout:0});
      const arenaIndex=FREE_BATTLE_ARENAS[prepared.rng.next(0)%FREE_BATTLE_ARENAS.length];
      return {ok:true,presetIndices:[...presetIndices],arenaIndex,individuals:party.individuals,rngPreparation};
    },
    /** The once-only reward keys already claimed (read only; story progress reads its own prefix). */
    getGachaClaimedRewards(){requireSession();return Object.freeze([...gachaState().claimed]);},
    enterTowerBattle({attemptId=nextBattleAttemptId(battleEconomy),playerInstanceIds,rngPreparation}={}){
      const prepared=battleRngPreparations.get(rngPreparation),floor=prepared?.towerFloor;
      const result=enterPreparedLocalBattle({mode:2,attemptId,playerInstanceIds,rngPreparation});
      if(result.ok&&!result.duplicate&&Number.isInteger(floor))pendingTower=Object.freeze({attemptId,floor,team:[...playerInstanceIds]});
      return result;
    },
    /** Add crystal points (tower chests, patrol, QA). */
    grantSyncCrystals(amount){
      const value=Number.isSafeInteger(amount)&&amount>0?amount:0;
      if(!value||tutorialBaseline)return {ok:false,reason:'NOTHING_TO_GRANT'};
      const state=normalizeSyncLevels(syncState());
      syncLevels={...state,crystals:Math.min(1e9,state.crystals+value)};savePort.markDirty();return {ok:true,crystals:syncLevels.crystals};
    },
    /** Spend crystal points on one partner. */
    feedSyncCrystals(instanceId,amount){
      if(!syncProfileOf(instanceId))return {ok:false,reason:'UNKNOWN_INDIVIDUAL'};
      syncLevelOf(instanceId);
      const fed=feedSyncCrystals(syncState(),instanceId,amount);
      if(!fed)return {ok:false,reason:'NO_CRYSTALS'};
      syncLevels=fed.state;savePort.markDirty();publishRaising();return {ok:true,gain:fed.gain};
    },
    getGachaTickets(){return session?gachaState().tickets:0;},
    /** Cartridges this hunt started with (the field readout names them). */
    getHuntGachaBoosts(){return screens.current()===CHAMPIONSHIP_SCREENS.HUNT_FIELD?lastHuntGachaBoosts:Object.freeze([]);},
    /** The chrono cartridges in the bag and how many ran this hunt (the HUD's key reads it). */
    getHuntChronoState(){
      if(screens.current()!==CHAMPIONSHIP_SCREENS.HUNT_FIELD||huntDeadlineMinute===null||tutorialBaseline||!session)return null;
      return Object.freeze({owned:gachaState().chips['chip:chrono']??0,used:lastHuntGachaBoosts.filter(id=>id==='chip:chrono').length,
        seconds:huntMinutesToSeconds(getGachaChip('chip:chrono').effect.extraSeconds)});
    },
    /**
     * Owner 2026-11-10: use a chrono cartridge inside the running hunt -- its minutes join the live deadline at
     * once; the hunt is one minute, so several may be used. Kept in memory like the armed cartridges; the next
     * save writes it.
     */
    useHuntChrono(){
      const chrono=this.getHuntChronoState();
      if(!chrono)return Object.freeze({ok:false,reason:'NOT_IN_HUNT'});
      const spent=useGachaChipNow(gachaState(),'chip:chrono');
      if(!spent.ok)return Object.freeze({ok:false,reason:spent.reason});
      cyberGacha=spent.state;
      if(huntRealtime)huntRealtime.limitMinutes+=spent.minutes;
      huntDeadlineMinute=Math.min(huntDeadlineMinute+spent.minutes,DAY_END_MINUTES);
      lastHuntGachaBoosts=Object.freeze([...lastHuntGachaBoosts,'chip:chrono']);
      savePort.markDirty();publishScreens();
      return Object.freeze({ok:true,minutes:spent.minutes,time:this.getHuntTimeState()});
    },

    gachaPull(machine,count=1){
      if(screens.current()!==CHAMPIONSHIP_SCREENS.SHOP)throw new Error('CHAMPIONSHIP_SHOP_NOT_ACTIVE');
      const result=pullCyberGacha(gachaState(),{machine,count,diamonds:friendsPlaytest?.diamonds??null,
        bits:requireShop().getBits(),random:gachaRandom});
      if(!result.ok)return gachaRefusal(result.reason);
      const friends=result.charge.diamonds?normalizeFriendsPlaytestState({...friendsPlaytest,
        diamonds:friendsPlaytest.diamonds-result.charge.diamonds}):friendsPlaytest;
      // Goods, and the supply riding with a premium R chip, land in the shop's own
      // stacks; what a full stack cannot hold comes back at its shop price.
      // Coin bags pay the wallet in the same transaction as the Bits charge.
      const goods=result.prizes.flatMap(prize=>prize.kind==='GOODS'?[prize]:prize.bonus?[prize.bonus]:[]);
      const coins=result.prizes.reduce((sum,prize)=>sum+(prize.kind==='BITS'?prize.bits:0),0);
      let candidate=null,refundBits=0;
      if(result.charge.bits||goods.length||coins){
        candidate=gachaShopCandidate();
        for(const prize of goods){
          const kept=candidate.receiveNativeGift(prize.shopRecordIndex,prize.quantity);
          refundBits+=(prize.quantity-kept)*getShopRecord(prize.shopRecordIndex).unitPriceBits;
        }
        const bits=candidate.getBits(),after=Math.min(BITS_WALLET_CAP,bits-result.charge.bits+coins+refundBits);
        if(after!==bits&&!candidate.applyBitsTransaction({expectedBits:bits,bits:after}).ok)return gachaRefusal('WALLET_CHANGED');
      }
      if(!commitGacha({state:result.state,friends,shopCandidate:candidate}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'PULL',machine,count,charge:result.charge,refundBits,prizes:result.prizes.map(gachaPrizeView)});
    },

    gachaClaimPity(metalId){
      if(screens.current()!==CHAMPIONSHIP_SCREENS.SHOP)throw new Error('CHAMPIONSHIP_SHOP_NOT_ACTIVE');
      const result=claimGachaPity(gachaState(),metalId);
      if(!result.ok)return gachaRefusal(result.reason);
      if(!commitGacha({state:result.state}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'PITY',prizes:[gachaPrizeView(result.prize)]});
    },

    /** Five chips in, one metal out. `null` takes the one-tap fill (spare R chips). */
    gachaSynthesize(chipIds=null){
      if(screens.current()!==CHAMPIONSHIP_SCREENS.SHOP)throw new Error('CHAMPIONSHIP_SHOP_NOT_ACTIVE');
      const ids=chipIds??autoFillSynthesizer(gachaState());
      const result=synthesizeGachaMetal(gachaState(),ids,{random:gachaRandom});
      if(!result.ok)return gachaRefusal(result.reason);
      if(!commitGacha({state:result.state}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'SYNTH',critical:result.critical,consumed:result.consumed,prizes:[gachaPrizeView(result.prize)]});
    },

    /**
     * Use one chip or metal. Growth chips and metals (mode ENHANCE) write the
     * partner's persistent words; mode CATALYST forces the partner's next
     * evolution in the ranch. Hunt and bounty chips are armed for the next
     * hunt / win. SSR+ metals inscribe the partner's bloodline.
     */
    gachaUseItem(itemId,instanceId=null,{mode='ENHANCE',form=null}={}){
      requireSession();
      const chip=getGachaChip(itemId),metal=getGachaMetal(itemId),state=gachaState();
      if(!chip&&!metal)return gachaRefusal('UNKNOWN_ITEM');
      if(((chip?state.chips:state.metals)[itemId]??0)<1)return gachaRefusal('NOT_OWNED');
      if(chip&&chip.kind!=='GROWTH'){
        const spent=spendGachaItem(state,itemId);
        if(!spent.ok)return gachaRefusal(spent.reason);
        if(!commitGacha({state:spent.state}))return gachaRefusal('SAVE_FAILED');
        return gachaReceipt({ok:true,kind:'ARMED',itemId});
      }
      const profile=instanceId?gachaProfile(instanceId):null;
      if(!profile)return gachaRefusal('UNKNOWN_INDIVIDUAL');
      const speciesId=this.resolveRaisingInstance(instanceId).speciesId;
      // A catalyst of 時之 shards also inscribes its family (GACHA_FULL_EFFECTS_20261109); otherwise SSR+ metals do.
      const bloodline=metal&&(inscribesBloodline(metal)||(mode==='CATALYST'&&metal.family.startsWith('chrono')))?metal.family:null;
      // Awakening raising (Owner 2026-11-02): a metal or shard used on a 成熟期 feeds its awakening.
      if(metal&&mode==='CATALYST'&&nativeHuntSpeciesByIndex(profile.fields['000']).generation===4)return this.feedAwakening(instanceId,itemId);
      if(metal&&mode==='CATALYST'){
        const actor=raisingActors.get(instanceId),index=profile.fields['000'];
        if(!actor)return gachaRefusal('PARTNER_NOT_IN_RANCH');
        if([...raisingActors.values()].some(a=>a.evolution))return gachaRefusal('EVOLUTION_RUNNING');
        const species=nativeHuntSpeciesByIndex(index);
        if(gachaRarityRank(metal.rarity)<gachaRarityRank(catalystRarityForGeneration(species.generation)))return gachaRefusal('METAL_TOO_WEAK');
        const rules=PRODUCT_GROWTH_RULES.rules[index-8]??[];
        const routes=evolutionRouteGaps(profile,PRODUCT_GROWTH_RULES);
        if(species.generation===0||species.generation>=4||!routes.length)return gachaRefusal('NO_EVOLUTION_ROUTE');
        // The player picks the route (`form` is its target); without a pick the nearest one. A shard waives
        // at most two unmet conditions, a whole metal any number (GACHA_FULL_EFFECTS_20261109).
        const route=Number.isInteger(form)?routes.find(r=>r.target===form):routes[0];
        if(!route)return gachaRefusal('NO_EVOLUTION_ROUTE');
        if(metal.id.endsWith('-shard')&&route.unmetCount>SHARD_CATALYST_WAIVER)return gachaRefusal('TOO_MANY_UNMET');
        const spent=spendGachaItem(state,itemId,{instanceId,bloodline});
        if(!spent.ok)return gachaRefusal(spent.reason);
        if(!commitGacha({state:spent.state}))return gachaRefusal('SAVE_FAILED');
        // The ranch plays it: the same native evolution its predicates would have started.
        const ruleIndex=route.ruleIndex,rule=rules[ruleIndex];
        beginNativeRaisingEvolution(actor,{target:rule.target,actor:{'1f4':ruleIndex,'1f0':Number(ruleIndex===rules.length-1),'464':0}},
          {next:nextGameplayRandom},raisingFoods);
        publishRaising();
        return gachaReceipt({ok:true,kind:'CATALYST',itemId,instanceId,target:rule.target,
          waived:route.unmetCount,bloodline});
      }
      // Race/faction/gap points and growth age become this partner's own native words.
      const actor=raisingActors.get(instanceId);
      const effect=resolveGachaEffect(chip?chip.effect:metalBoostEffect(metal),profile,{table:PRODUCT_GROWTH_RULES,
        lifeThreshold:actor?.growthFields?.['428']??null,gapExp:metal?.gapExp??0});
      const nextProfile=normalizeNativeIndividualProfile(applyGachaBoost(profile,effect),speciesId);
      const spent=spendGachaItem(state,itemId,{instanceId,bloodline});
      if(!spent.ok)return gachaRefusal(spent.reason);
      const before={creature,raising,registered:registeredSpeciesValue};
      writeRaisingNativeProfile(instanceId,nextProfile,{markDirty:false});
      if(!commitGacha({state:spent.state})){
        creature=before.creature;raising=before.raising;registeredSpeciesValue=before.registered;return gachaRefusal('SAVE_FAILED');
      }
      // The ranch checks evolution again on the partner's next idle step: a chip that carried it over a
      // threshold starts the evolution there and then.
      if(actor)actor.evolutionChecked=false;
      publishRaising();
      const routesAfter=evolutionRouteGaps(nextProfile,PRODUCT_GROWTH_RULES);
      return gachaReceipt({ok:true,kind:'ENHANCE',itemId,instanceId,bloodline,
        counters:effect.counters??null,evolutionReady:routesAfter.some(route=>route.unmetCount===0),
        before:projectNativeIndividualStats(profile),after:projectNativeIndividualStats(nextProfile)});
    },

    /** Three shards of one rarity rise one tier: R into a 時之合金碎片, SR into a 時之合金 (GACHA_FULL_EFFECTS_20261109). */
    gachaSmeltShardTier(rarity){
      requireSession();
      const smelted=smeltGachaShardTier(gachaState(),rarity);
      if(!smelted.ok)return gachaRefusal(smelted.reason);
      if(!commitGacha({state:smelted.state}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'TIER_SMELT',consumed:smelted.consumed,prizes:[gachaPrizeView(smelted.prize)]});
    },

    /** Three shards of one family fuse into that family's metal (OWNER_APPROVED_ADAPTATION 2026-11-02). */
    gachaFuseShards(shardId){
      requireSession();
      const fused=fuseGachaShards(gachaState(),shardId);
      if(!fused.ok)return gachaRefusal(fused.reason);
      if(!commitGacha({state:fused.state}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'FUSE',itemId:shardId,prize:gachaPrizeView(fused.prize)});
    },

    /** Once-only reward (a story chapter): tickets the first time its key is claimed. */
    claimGachaReward(key,amount){
      requireSession();
      const result=claimGachaReward(gachaState(),key,amount);
      // DIAMOND_ECONOMY_20261102: a story chapter's first clear also pays diamonds, in the same save.
      const story=typeof key==='string'&&key.startsWith('story:')&&friendsPlaytest
        ?[Object.freeze({key:diamondRewardKey.story(key.slice(6)),kind:'STORY',value:key.slice(6),amount:DIAMOND_REWARDS.storyChapter})]
          .filter(entry=>!result.state.claimed.includes(entry.key)):[];
      if(story.length){
        const paid=payDiamondRewards(story,{state:result.state});
        if(!paid.ok)return Object.freeze({ok:false,reason:'SAVE_FAILED'});
        publishScreens();
        return Object.freeze({ok:true,granted:result.granted,tickets:cyberGacha.tickets,diamonds:paid.granted,key});
      }
      // A key recorded for the first time is saved even when it pays nothing (ticket cap, a bond mark),
      // so story progress never depends on the ticket count.
      const recorded=!gachaState().claimed.includes(key)&&result.state.claimed.includes(key);
      if(!result.granted&&!recorded)return Object.freeze({ok:true,granted:0,key});
      if(!commitGacha({state:result.state}))return Object.freeze({ok:false,reason:'SAVE_FAILED'});
      publishScreens();
      return Object.freeze({ok:true,granted:result.granted,tickets:result.state.tickets,key});
    },

    /**
     * A Data Arena win (Owner 2026-11-10): the same settlement as an AI win without a purse -- a ticket 60% of the
     * time, a cup 2-4 more, and an armed beacon is spent (its tickets, shard, and battles/points on the party).
     */
    settleDataArenaWin({tournament=false,partyIds=[]}={}){
      requireSession();
      const drop=settleGachaBattleWin(gachaState(),{bits:0,tournamentChampion:tournament===true,random:gachaRandom});
      const before={creature,raising,registered:registeredSpeciesValue};
      if(drop.battles||drop.exp)for(const id of new Set(partyIds)){
        const profile=typeof id==='string'?gachaProfile(id):null;
        if(profile)writeRaisingNativeProfile(id,normalizeNativeIndividualProfile(beaconBattleWords(profile,drop)),{markDirty:false});
      }
      if(!commitGacha({state:drop.state})){
        creature=before.creature;raising=before.raising;registeredSpeciesValue=before.registered;
        return Object.freeze({ok:false,reason:'SAVE_FAILED',granted:0});
      }
      lastBattleGachaDrop=Object.freeze({attemptId:'DATA_ARENA',tickets:drop.tickets,bonusBits:0,beacon:drop.beacon,metals:drop.metals,battles:drop.battles,exp:drop.exp});
      publishScreens();
      return Object.freeze({ok:true,granted:drop.tickets,beacon:drop.beacon,metals:drop.metals,battles:drop.battles,exp:drop.exp});
    },

    /** Arena wins: tickets straight into the save. */
    grantGachaTickets(amount,reason='REWARD'){
      requireSession();
      const result=grantGachaTickets(gachaState(),amount);
      if(!result.granted)return Object.freeze({ok:true,granted:0,reason});
      if(!commitGacha({state:result.state}))return Object.freeze({ok:false,reason:'SAVE_FAILED'});
      publishScreens();
      return Object.freeze({ok:true,granted:result.granted,tickets:result.state.tickets,reason});
    },

    /**
     * Hunt cartridges (kind HUNT) or bounty beacons (BOUNTY) the player holds or
     * has loaded, for the hunt loadout and the battle menu (Owner 2026-11-02).
     * Loading goes through gachaUseItem; gachaDisarmItem takes one back out.
     */
    getGachaTacticalSlots(kind){
      if(!session||(kind!=='HUNT'&&kind!=='BOUNTY'))return Object.freeze([]);
      const state=gachaState();
      return deepFreeze(GACHA_CHIPS.filter(chip=>chip.kind===kind).map(chip=>({id:chip.id,kind,name:chip.name,rarity:chip.rarity,
        effect:chip.effect,shopRecordIndex:chip.shopRecordIndex,owned:state.chips[chip.id]??0,
        armed:kind==='HUNT'?state.armed.hunt?.includes(chip.id)===true:state.armed.bounty===chip.id})).filter(slot=>slot.owned>0||slot.armed));
    },

    gachaDisarmItem(itemId){
      requireSession();
      const result=disarmGachaItem(gachaState(),itemId);
      if(!result.ok)return gachaRefusal(result.reason);
      if(!commitGacha({state:result.state}))return gachaRefusal('SAVE_FAILED');
      return gachaReceipt({ok:true,kind:'DISARMED',itemId});
    },

    /** The reshape chip on one partner: it takes the personality the player picked. */
    gachaReshapePersonality(instanceId,personalityIndex){
      requireSession();
      const chip=getGachaChip('chip:personality'),state=gachaState();
      if((state.chips[chip.id]??0)<1)return gachaRefusal('NOT_OWNED');
      if(!Number.isInteger(personalityIndex)||personalityIndex<0||personalityIndex>=GACHA_PERSONALITY_CHOICES)return gachaRefusal('CHOOSE_PERSONALITY');
      const profile=instanceId?gachaProfile(instanceId):null;
      if(!profile)return gachaRefusal('UNKNOWN_INDIVIDUAL');
      if(profile.fields['018']===personalityIndex)return gachaRefusal('SAME_PERSONALITY');
      const nextProfile=normalizeNativeIndividualProfile(applyGachaBoost(profile,{...chip.effect,personalityIndex}),
        this.resolveRaisingInstance(instanceId).speciesId);
      const spent=spendGachaItem(state,chip.id);
      if(!spent.ok)return gachaRefusal(spent.reason);
      const before={creature,raising,registered:registeredSpeciesValue};
      writeRaisingNativeProfile(instanceId,nextProfile,{markDirty:false});
      if(!commitGacha({state:spent.state})){
        creature=before.creature;raising=before.raising;registeredSpeciesValue=before.registered;return gachaRefusal('SAVE_FAILED');
      }
      publishRaising();
      return gachaReceipt({ok:true,kind:'ENHANCE',itemId:chip.id,instanceId,personality:personalityIndex,
        before:projectNativeIndividualStats(profile),after:projectNativeIndividualStats(nextProfile)});
    },

    /** The partner the rare-lure cartridge called into this hunt, or null. */
    getHuntRareLure(){return screens.current()===CHAMPIONSHIP_SCREENS.HUNT_FIELD?lastHuntRareLure:null;},

    getFreeBattleMatches(){return listNativeFreeBattleMatches(freeBattleMenu);},

    /** The partner's battle plan: 0 必殺技優先, 1 普通攻擊 (default), 2 支援優先. */
    getBattleTactic(instanceId){return battleTactics[instanceId]??BATTLE_TACTIC_DEFAULT;},

    setBattleTactic(instanceId,tactic){
      requireSession();
      if(![0,1,2].includes(tactic))return Object.freeze({ok:false,reason:'TACTIC_INVALID'});
      if(!this.getRaisingInstances().some(entry=>entry.instanceId===instanceId))return Object.freeze({ok:false,reason:'UNKNOWN_INDIVIDUAL'});
      const next={...battleTactics};
      if(tactic===BATTLE_TACTIC_DEFAULT)delete next[instanceId];else next[instanceId]=tactic;
      battleTactics=normalizeBattleTactics(next);savePort.markDirty();
      return Object.freeze({ok:true,instanceId,tactic});
    },

    openFreeBattle(){
      requireSession();if(screens.current()!==CHAMPIONSHIP_SCREENS.BATTLE_SELECT)return [];
      // Old saves contain no daily menu. Resolve the missing slice only on an
      // explicit mode-entry action; Continue and inspection never spend RNG.
      if(!freeBattleMenu)rebuildFreeBattleMenu();return this.getFreeBattleMatches();
    },

    async prepareFreeBattle(matchId,instanceIds,selectedArena=null){
      const match=this.getFreeBattleMatches().find(row=>row.id===matchId);
      if(!match)return {ok:false,reason:'MATCH_NOT_AVAILABLE'};
      const party=withBattleTactics(await this.prepareBattleParty(null,instanceIds,{sync:{capped:false}}));
      if(!party.ok)return party;
      if(instanceIds.length>match.slots)return {ok:false,reason:'PARTY_SIZE',message:uiText('這場對戰最多 {count} 隻。',{count:match.slots})};
      const rngPreparation=this.prepareBattleRng(),prepared=battleRngPreparations.get(rngPreparation);
      prepared.localMode=2;prepared.freeMatch=match;prepared.freeMenu=freeBattleMenu;prepared.individuals=party.individuals;
      const drawnArena=FREE_BATTLE_ARENAS[prepared.rng.next(0)%FREE_BATTLE_ARENAS.length];
      if(selectedArena!==null&&!FREE_BATTLE_ARENAS.includes(selectedArena))return {ok:false,reason:'ARENA_UNAVAILABLE'};
      const arenaIndex=selectedArena??drawnArena;
      return {ok:true,match,arenaIndex,individuals:party.individuals,rngPreparation};
    },

    async preparePracticeBattle(teams,selectedArena=null){
      if(!Array.isArray(teams)||teams.length!==2||teams.some(ids=>!Array.isArray(ids)||ids.length<1||ids.length>3))return {ok:false,reason:'TWO_PARTIES_REQUIRED'};
      const ids=teams.flat();if(new Set(ids).size!==ids.length)return {ok:false,reason:'DUPLICATE_PARTICIPANT',message:'同一隻拍檔只能加入一隊。'};
      const parties=[];
      for(const team of teams){const party=withBattleTactics(await this.prepareBattleParty(null,team,{sync:{capped:false}}));if(!party.ok)return party;parties.push(party.individuals);}
      if(selectedArena!==null&&!FREE_BATTLE_ARENAS.includes(selectedArena))return {ok:false,reason:'ARENA_UNAVAILABLE'};
      const rngPreparation=this.prepareBattleRng(),prepared=battleRngPreparations.get(rngPreparation);
      const drawnArena=FREE_BATTLE_ARENAS[prepared.rng.next(0)%FREE_BATTLE_ARENAS.length];
      prepared.localMode=5;prepared.individuals=parties.flat();
      return {ok:true,parties,arenaIndex:selectedArena??drawnArena,rngPreparation};
    },

    async createLinkBattleInvite(instanceIds,{transportVersion}={}){
      requireSession();
      if(screens.current()!==CHAMPIONSHIP_SCREENS.BATTLE_SELECT)return {ok:false,reason:'BATTLE_SELECT_NOT_ACTIVE'};
      const party=await this.prepareBattleParty(null,instanceIds);if(!party.ok)return party;
      const preview=this.prepareBattleRng(),prepared=battleRngPreparations.get(preview);
      try{
        const arenaIndex=FREE_BATTLE_ARENAS[prepared.rng.next(0)%FREE_BATTLE_ARENAS.length];
        const {createChampionshipLinkInvite}=await loadLinkBattle();
        const invite=createChampionshipLinkInvite({individuals:party.individuals,arenaIndex,transportVersion});
        return {ok:true,inviteCode:invite.code,arenaIndex};
      }catch(error){
        return {ok:false,reason:error?.message??'LINK_BATTLE_INVITE_FAILED',message:'無法建立通訊邀請碼，請重新選擇隊伍。'};
      }finally{battleRngPreparations.delete(preview);}
    },

    async prepareLinkBattle({role,inviteCode,replyCode=null,instanceIds=[]}={}){
      requireSession();
      if(screens.current()!==CHAMPIONSHIP_SCREENS.BATTLE_SELECT)return {ok:false,reason:'BATTLE_SELECT_NOT_ACTIVE'};
      if(!['HOST','GUEST'].includes(role))return {ok:false,reason:'LINK_ROLE_REQUIRED'};
      try{
        const link=await loadLinkBattle();let packet,responseCode=null,hostIndividuals,guestIndividuals;
        if(role==='GUEST'){
          const party=await this.prepareBattleParty(null,instanceIds);if(!party.ok)return party;
          const response=link.createChampionshipLinkReply({inviteCode,individuals:party.individuals});responseCode=response.code;
          packet=link.readChampionshipLinkInvite(inviteCode);hostIndividuals=packet.hostIndividuals;guestIndividuals=party.individuals;
        }else{
          packet=link.readChampionshipLinkReply(inviteCode,replyCode);hostIndividuals=packet.hostIndividuals;guestIndividuals=packet.guestIndividuals;
        }
        const {battlePartyAdmission,buildOwnedBattleCreature}=await loadBattleParty();
        for(const individual of [...hostIndividuals,...guestIndividuals]){
          const admission=battlePartyAdmission(individual.nativeProfile,null);if(!admission.ok)
            return {ok:false,reason:'LINK_TEAM_INELIGIBLE',message:'通訊碼內含不能參戰的拍檔。'};
          buildOwnedBattleCreature(individual);
        }
        const rng=link.createNativeLinkBattleRng(),rngPreparation=Object.freeze({rng});
        const replyId=(responseCode??replyCode).split('.')[1],linkKey=`${role}:${packet.id??packet.inviteId}:${replyId}`;
        battleRngPreparations.set(rngPreparation,{base:JSON.stringify(gameplayRngSnapshot()),rng,session,localMode:3,linkKey,
          individuals:[...hostIndividuals,...guestIndividuals]});
        return {ok:true,role,inviteCode:packet.code??inviteCode,replyCode:responseCode??replyCode,linkKey,
          parties:[hostIndividuals,guestIndividuals],localTeamIndex:role==='HOST'?0:1,arenaIndex:packet.arenaIndex,rngPreparation};
      }catch(error){
        const known=/^(?:LINK_BATTLE_|PRODUCT_BATTLE_TRANSPORT_)/.test(error?.message??'');
        return {ok:false,reason:known?error.message:'LINK_BATTLE_CODE_INVALID',
          message:known?'通訊碼無法辨識、已損壞，或不是同一場邀請。':'通訊對戰準備失敗，請重新交換通訊碼。'};
      }
    },

    async getPasswordTeamCandidates(){
      requireSession();
      const {championshipPasswordProfileAdmission}=await loadPasswordBattle();
      return this.getRaisingInstances().map(entry=>{
        const nativeProfile=entry.instanceId===creature?.creatureId?creature.nativeProfile:raisingNativeProfile(entry.instanceId);
        return Object.freeze({...entry,admission:championshipPasswordProfileAdmission(nativeProfile)});
      });
    },

    // The original team panel prints the code of the team on it (ARM9 020511A4
    // -> 020950B8). Making a code reads current profiles only: no save, RNG,
    // roster or screen state changes.
    async createTeamPassword(instanceIds){
      requireSession();
      if(!Array.isArray(instanceIds)||instanceIds.length<1||instanceIds.length>3||new Set(instanceIds).size!==instanceIds.length)
        return {ok:false,reason:'PARTY_SIZE',message:'請選擇 1 至 3 隻拍檔。'};
      const {encodeChampionshipPasswordTeamFromProfiles,championshipPasswordProfileAdmission}=await loadPasswordBattle();
      const owned=new Set(this.getRaisingInstances().map(entry=>entry.instanceId)),profiles=[];
      for(const instanceId of instanceIds){
        const nativeProfile=!owned.has(instanceId)?null
          :instanceId===creature?.creatureId?creature.nativeProfile:raisingNativeProfile(instanceId);
        const admission=championshipPasswordProfileAdmission(nativeProfile);
        if(!admission.ok)return admission;
        profiles.push(nativeProfile);
      }
      return {ok:true,password:encodeChampionshipPasswordTeamFromProfiles(profiles),members:profiles.length};
    },

    async preparePasswordBattle(passwords){
      requireSession();
      if(screens.current()!==CHAMPIONSHIP_SCREENS.BATTLE_SELECT)return {ok:false,reason:'BATTLE_SELECT_NOT_ACTIVE'};
      if(!Array.isArray(passwords)||passwords.length!==2||passwords.some(value=>typeof value!=='string'||value.length<1))
        return {ok:false,reason:'TWO_PASSWORDS_REQUIRED',message:'請輸入 A 隊與 B 隊的密碼。'};
      const {createNativePasswordPlaceholders,decodeChampionshipPasswordTeam,championshipPasswordTeamAdmission}=await loadPasswordBattle();
      const rngPreparation=this.prepareBattleRng(),prepared=battleRngPreparations.get(rngPreparation);
      try{
        const teams=passwords.map((password,index)=>decodeChampionshipPasswordTeam(password,{
          placeholders:createNativePasswordPlaceholders(prepared.rng),instancePrefix:`password-${index===0?'a':'b'}`
        }));
        for(const team of teams){const admission=championshipPasswordTeamAdmission(team);if(!admission.ok){
          battleRngPreparations.delete(rngPreparation);return admission;
        }}
        const normalized=teams.map(team=>team.password);
        const parties=teams.map(team=>team.members.filter(Boolean).map(member=>({
          instanceId:member.instanceId,nativeProfile:member.nativeProfile
        })));
        const arenaIndex=FREE_BATTLE_ARENAS[prepared.rng.next(0)%FREE_BATTLE_ARENAS.length];
        prepared.localMode=4;prepared.passwords=normalized;prepared.individuals=parties.flat();
        return {ok:true,passwords:normalized,teams,parties,arenaIndex,rngPreparation};
      }catch(error){
        battleRngPreparations.delete(rngPreparation);
        const known=/^(?:PASSWORD_BATTLE_|PRODUCT_BATTLE_TRANSPORT_)/.test(error?.message??'');
        return {ok:false,reason:known?error.message:'PASSWORD_BATTLE_INVALID',
          message:known?'密碼無法辨識或校驗不正確，請確認後再輸入。':'密碼隊伍準備失敗，請重新輸入。'};
      }
    },

    enterPracticeBattle({attemptId=nextBattleAttemptId(battleEconomy),playerInstanceIds,rngPreparation}={}){
      return enterPreparedLocalBattle({mode:5,attemptId,playerInstanceIds,rngPreparation});
    },

    enterFreeBattle({attemptId=nextBattleAttemptId(battleEconomy),playerInstanceIds,rngPreparation}={}){
      return enterPreparedLocalBattle({mode:2,attemptId,playerInstanceIds,rngPreparation});
    },

    enterPasswordBattle({attemptId=nextBattleAttemptId(battleEconomy),passwords,rngPreparation}={}){
      return enterPreparedLocalBattle({mode:4,attemptId,passwords,rngPreparation});
    },

    enterLinkBattle({attemptId=nextBattleAttemptId(battleEconomy),linkKey,rngPreparation}={}){
      return enterPreparedLocalBattle({mode:3,attemptId,linkKey,rngPreparation});
    },

    getBattleReceipt() {
      return battleEconomy.lastReceipt;
    },

    async getBattlePartyCandidates(recordIndex) {
      const {battlePartyAdmission}=await loadBattleParty();
      return this.getRaisingInstances().map(entry=>{
        const nativeProfile=entry.instanceId===creature?.creatureId?creature.nativeProfile:raisingNativeProfile(entry.instanceId);
        return Object.freeze({...entry,tactic:this.getBattleTactic(entry.instanceId),
          admission:battlePartyAdmission(nativeProfile,recordIndex,{burstForms:partnerBurstForms(entry.instanceId)})});
      });
    },

    async getBattlePartyLimit(recordIndex) {
      const {battlePartyCondition}=await loadBattleParty();
      return battlePartyCondition(recordIndex===null?-1:getMatchRecord(recordIndex).field0C).slots;
    },

    /**
     * The two multi-round tournaments as OVL10 sets them up: how many rounds,
     * what a clean sweep pays, and how large the draw is each round. The round
     * pools and bookkeeping feed the same owned-party battle and durable
     * settlement path as the ordinary title match.
     * See docs/research/CHAMPIONSHIP_POOLS_CPU_2026-09-10.json.
     */
    getChampionshipCategories() {
      // stage 1 opens the Championship; winning it opens the World tournament.
      // Registration is the existing native flag, not a new gate.
      const stage=nativeTitles.championship.stage;
      return NATIVE_CHAMPIONSHIP_CATEGORIES.map(record => Object.freeze({
        category:record.category, id:record.id, rounds:record.rounds, prize:record.prize,
        poolSizes:record.poolSizes, arenaIndex:CHAMPIONSHIP_ARENA_INDEX,
        unlocked:stage>=record.category+1,
        registered:(record.category===0?nativeTitles.championship.entry:nativeTitles.championship.worldEntry)===1,
        active:championshipRun?.category===record.category,
      }));
    },

    /** The tournament in progress, with the round it is waiting on. */
    getChampionshipRun() {
      if(!championshipRun)return null;
      const record=NATIVE_CHAMPIONSHIP_CATEGORIES[championshipRun.category];
      return Object.freeze({...championshipRun, id:record.id,
        round:championshipRun.cursor, finalRound:nativeChampionshipFinalRound(championshipRun),
        continues:nativeChampionshipContinues(championshipRun),
        payable:nativeChampionshipPayable(championshipRun)});
    },

    /**
     * Open a tournament. The original starts a run by zeroing the cursor and
     * taking the round count from the category descriptor; entry is refused
     * unless the category is unlocked and entered, and a run already in
     * progress is never replaced.
     */
    beginChampionship(category) {
      requireSession();
      if(battleTransactionActive)return Object.freeze({ok:false,reason:'TRANSACTION_ACTIVE'});
      if(championshipRun)return Object.freeze({ok:false,reason:'CHAMPIONSHIP_ALREADY_RUNNING'});
      const record=NATIVE_CHAMPIONSHIP_CATEGORIES[category];
      if(!record)return Object.freeze({ok:false,reason:'UNKNOWN_CATEGORY'});
      if(nativeTitles.championship.stage<record.category+1)
        return Object.freeze({ok:false,reason:'CHAMPIONSHIP_LOCKED'});
      const entered=(record.category===0?nativeTitles.championship.entry:nativeTitles.championship.worldEntry)===1;
      if(!entered)return Object.freeze({ok:false,reason:'CHAMPIONSHIP_NOT_ENTERED'});
      championshipRun=createNativeChampionshipRun(record.category);
      savePort.markDirty();
      return Object.freeze({ok:true,run:this.getChampionshipRun()});
    },

    /** The round's opponent, drawn on channel 0 over that round's pool. */
    drawChampionshipOpponent() {
      requireSession();
      if(!championshipRun)return Object.freeze({ok:false,reason:'NO_CHAMPIONSHIP_RUNNING'});
      if(!nativeChampionshipContinues(championshipRun))
        return Object.freeze({ok:false,reason:'CHAMPIONSHIP_ALREADY_ENDED'});
      const opponent=selectNativeChampionshipOpponent({category:championshipRun.category,
        round:championshipRun.cursor,nextChannel:nextGameplayRandom});
      return Object.freeze({ok:true,opponent});
    },

    /**
     * Fight the round the run is waiting on. The tournament descriptor carries
     * rounds, prize and two more fields and no entry fee, so a round is entered
     * free; the prize is the run's, paid once at 0210D0C8's gate rather than per
     * round. Everything else is an ordinary battle attempt.
     */
    enterChampionshipRound({ attemptId, playerInstanceIds = null, opponent = null, rngPreparation=null } = {}) {
      requireSession();
      if (battleTransactionActive) return Object.freeze({ ok: false, reason: "TRANSACTION_ACTIVE" });
      if (!championshipRun) return Object.freeze({ ok: false, reason: "NO_CHAMPIONSHIP_RUNNING" });
      if (!nativeChampionshipContinues(championshipRun))
        return Object.freeze({ ok: false, reason: "CHAMPIONSHIP_ALREADY_ENDED" });
      if (battleEconomy.active) return Object.freeze({ ok: false, reason: "BATTLE_ATTEMPT_ACTIVE" });
      const prepared=rngPreparation===null?null:battleRngPreparations.get(rngPreparation);
      if(playerInstanceIds!==null||rngPreparation!==null){
        if(!prepared||prepared.session!==session||prepared.base!==JSON.stringify(gameplayRngSnapshot())
          ||prepared.championshipRun!==JSON.stringify(championshipRun)
          ||JSON.stringify(playerInstanceIds)!==JSON.stringify(prepared.individuals?.map(p=>p.instanceId))
          ||prepared.individuals.some(p=>JSON.stringify(boostSyncNativeProfile(raisingNativeProfile(p.instanceId),p.syncLevel??1))!==JSON.stringify(p.nativeProfile)))
          return {ok:false,reason:'BATTLE_PREPARATION_STALE',message:'隊伍或遊戲進度已更新，請重新選擇參賽隊伍。'};
        opponent=prepared.opponent;
      }
      // The caller may have drawn already to build the match; drawing twice
      // would spend the channel twice.
      const drawn = opponent ? { ok: true, opponent } : this.drawChampionshipOpponent();
      if (!drawn.ok) return drawn;
      const result = applyBattleTransaction(beginBattleAttempt(battleEconomy, {
        attemptId, matchIndex: championshipRun.category, mode: 0, battleType: 0,
        entryFee: 0, payout: 0, expectedRounds: 1
      }, requireShop().getBits()),[],prepared?.rng??null,[],{begin:attemptId,kind:'CHAMPIONSHIP'});
      if (!result.ok || result.duplicate) return result;
      if(rngPreparation)battleRngPreparations.delete(rngPreparation);
      championshipAttemptId = attemptId;
      battlePartyIds = playerInstanceIds === null ? null : [...playerInstanceIds];
      screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD);
      publishScreens();
      return Object.freeze({ ...result, opponent: drawn.opponent, round: championshipRun.cursor });
    },

    /**
     * One round's verdict. A lost round ends the run where it stands, which is
     * what the payout gate at 0210D0C8 then reads.
     */
    recordChampionshipRound({verdict,battleType=0}={}) {
      requireSession();
      if(!championshipRun)return Object.freeze({ok:false,reason:'NO_CHAMPIONSHIP_RUNNING'});
      if(!nativeChampionshipContinues(championshipRun))
        return Object.freeze({ok:false,reason:'CHAMPIONSHIP_ALREADY_ENDED'});
      const recorded=recordNativeChampionshipRound(championshipRun,{verdict,battleType});
      championshipRun=recorded.run;
      savePort.markDirty();
      return Object.freeze({ok:true,won:recorded.won,complete:recorded.complete,
        payable:recorded.payable,run:this.getChampionshipRun()});
    },

    /**
     * Close a finished run. Every round played must be a win for the prize, and
     * the title result reads the same flags, so a run that ended early settles
     * to nothing rather than being abandoned silently.
     */
    settleChampionship() {
      requireSession();
      if(battleTransactionActive)return Object.freeze({ok:false,reason:'TRANSACTION_ACTIVE'});
      if(!championshipRun)return Object.freeze({ok:false,reason:'NO_CHAMPIONSHIP_RUNNING'});
      if(nativeChampionshipContinues(championshipRun))
        return Object.freeze({ok:false,reason:'CHAMPIONSHIP_STILL_RUNNING'});
      const run=championshipRun,payable=nativeChampionshipPayable(run);
      const before=nativeTitles,beforeRank=tamerRankValue,beforeBadges=battleBadgesValue,beforeMessages=nativeMessages;
      const r=resolveNativeTitleResult({rank:tamerRankValue,category:0,matchIndex:run.category,
        won:battleBadgesValue,...nativeTitles,rounds:run.flags});
      battleBadgesValue=[...r.won];tamerRankValue=r.rank;
      nativeTitles=normalizeNativeTitleProgress({...nativeTitles,registered:r.registered,
        championship:r.championship,feeWaiver:r.feeWaiver});
      if(r.rankNotice!==null)nativeMessages=enqueueNativeRaisingMessage(nativeMessages,r.rankNotice);
      if(r.championshipNotice)nativeMessages=enqueueNativeRaisingMessage(nativeMessages,r.championshipNotice);
      // creditBits throws on an invalid amount and otherwise reports the wallet;
      // the descriptor prize is always a valid amount, so a throw here is a bug
      // rather than a refusal, and the title result is rolled back with it.
      let wallet=null;
      if(payable){
        try{wallet=requireShop().creditBits(run.prize,{evidence:'ROM_VERIFIED'}).bits;}
        catch(error){
          nativeTitles=before;tamerRankValue=beforeRank;battleBadgesValue=beforeBadges;nativeMessages=beforeMessages;
          return Object.freeze({ok:false,reason:'PRIZE_CREDIT_FAILED',message:error.message});
        }
      }
      championshipRun=null;
      if(battleBadgesValue!==beforeBadges)applyProgression();
      // A paid tournament is a title won: 2-4 gacha tickets beside the prize (GACHA_FULL_EFFECTS_20261109 balance).
      let championTickets=0;
      if(payable){const grant=grantGachaTickets(gachaState(),2+Math.floor(gachaRandom()*3));cyberGacha=grant.state;championTickets=grant.granted;}
      savePort.markDirty();
      return Object.freeze({ok:true,payable,prize:payable?run.prize:0,bits:wallet,gachaTickets:championTickets,
        flags:Object.freeze([...run.flags]),rank:tamerRankValue,
        championship:nativeTitles.championship});
    },

    prepareBattleRng() {
      requireSession();
      const base=gameplayRngSnapshot();
      const rng=base?restoreChannelRng(base):createClockChannelRng(rngClock());
      const preparation=Object.freeze({rng});
      battleRngPreparations.set(preparation,{base:JSON.stringify(base),rng,session});
      return preparation;
    },

    async prepareChampionshipBattle(instanceIds) {
      const run=championshipRun;
      if(!run||!nativeChampionshipContinues(run))return {ok:false,reason:'NO_CHAMPIONSHIP_ROUND'};
      const party=await this.prepareBattleParty(null,instanceIds,{sync:{capped:true}});
      if(!party.ok)return party;
      if(championshipRun!==run)return {ok:false,reason:'BATTLE_PREPARATION_STALE'};
      const rngPreparation=this.prepareBattleRng(),prepared=battleRngPreparations.get(rngPreparation);
      const opponent=selectNativeChampionshipOpponent({category:run.category,round:run.cursor,
        nextChannel:channel=>prepared.rng.next(channel)});
      prepared.championshipRun=JSON.stringify(run);prepared.individuals=party.individuals;prepared.opponent=opponent;
      return {ok:true,individuals:party.individuals,opponent,rngPreparation};
    },

    async prepareBattleParty(recordIndex,instanceIds,{sync=null}={}) {
      const {battlePartyCondition,buildOwnedBattleCreature,nativeBattleQualification,burstFormFitting}=await loadBattleParty();
      const condition=battlePartyCondition(recordIndex===null?-1:getMatchRecord(recordIndex).field0C);
      const limit=battlePartyCondition(recordIndex===null?-1:getMatchRecord(recordIndex).field0C).slots;
      if(!Array.isArray(instanceIds)||!instanceIds.length||instanceIds.length>limit||new Set(instanceIds).size!==instanceIds.length)
        return {ok:false,reason:'PARTY_SIZE',message:uiText('請選擇 1 至 {limit} 隻符合條件的拍檔。',{limit})};
      const candidates=await this.getBattlePartyCandidates(recordIndex),individuals=[];
      for(const instanceId of instanceIds){
        const entry=candidates.find(c=>c.instanceId===instanceId);
        if(!entry)return {ok:false,reason:'UNKNOWN_INDIVIDUAL',message:'選擇的拍檔已不在目前名冊。'};
        if(!entry.admission.ok)return entry.admission;
        const nativeProfile=instanceId===creature?.creatureId?creature.nativeProfile:raisingNativeProfile(instanceId);
        buildOwnedBattleCreature({instanceId,nativeProfile});
        // A 成熟期 admitted to a 覺醒體/究極體 match bursts into the form that admitted it.
        const fitting=nativeBattleQualification(nativeProfile,condition)?null:burstFormFitting(nativeProfile,condition,partnerBurstForms(instanceId));
        const syncLevel=syncBattleLevel(instanceId,sync);
        individuals.push({instanceId,nativeProfile:boostSyncNativeProfile(nativeProfile,syncLevel),syncLevel,
          ...(fitting!==null?{burst:battleBurstPlanOf(instanceId,Object.freeze({form:fitting,tier:burstFormTier(fitting)}))}:{})});
      }
      return {ok:true,individuals};
    },

    async enterMatch({ attemptId = nextBattleAttemptId(battleEconomy), recordIndex, mode, battleType, playerInstanceIds=null, rngPreparation=null } = {}) {
      requireSession();
      if(tutorialBaseline)return {ok:false,reason:'INTERACTIVE_TUTORIAL_ISOLATED'};
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
        const admission=await this.prepareBattleParty(recordIndex,playerInstanceIds);
        if(!admission.ok)return admission;
        if(mode!==1||battleType!==0)return {ok:false,reason:'OWNED_PARTY_MODE_REQUIRES_TRACE'};
      }
      const preparedRng=rngPreparation===null?null:battleRngPreparations.get(rngPreparation);
      if(!duplicateActive && rngPreparation!==null && (!preparedRng||preparedRng.session!==session||preparedRng.base!==JSON.stringify(gameplayRngSnapshot())))
        return {ok:false,reason:'BATTLE_PREPARATION_STALE',message:'遊戲進度已更新，請重新選擇參賽隊伍。'};
      const result = applyBattleTransaction(beginBattleAttempt(battleEconomy, {
        attemptId, matchIndex: recordIndex, mode, battleType,
        entryFee: matchEntryFee(recordIndex), payout: matchPayout(recordIndex), expectedRounds: 1
      }, requireShop().getBits()),[],preparedRng?.rng,[],{begin:attemptId,kind:'TITLE'});
      if (!result.ok || result.duplicate) return result;
      if(rngPreparation)battleRngPreparations.delete(rngPreparation);
      battlePartyIds=playerInstanceIds===null?null:[...playerInstanceIds];
      screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_FIELD);
      publishScreens();
      return result;
    },

    /** The battle judges itself; nothing else may push the result screen. */
    finishMatch({ attemptId, ended, mode, battleType, matchIndex, outcomeEntries, individualResults=[], rewardPercent, bursts=[], contractStats=null } = {}) {
      requireSession();
      if(tutorialBaseline)return {ok:false,reason:'INTERACTIVE_TUTORIAL_ISOLATED'};
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
        // The battle fought a Sync-boosted copy; the saved individual keeps its own vitals and curve steps.
        updates=individualResults.map(entry=>{const saved=syncProfileOf(entry.instanceId);
          return {instanceId:entry.instanceId,nativeProfile:normalizeNativeIndividualProfile(
            saved?restoreSyncNativeProfile(entry.nativeProfile,saved):entry.nativeProfile,this.resolveRaisingInstance(entry.instanceId).speciesId)};});
      }
      const result = applyBattleTransaction(settleBattleAttempt(battleEconomy, { attemptId, outcomeEntries, ...(rewardPercent===undefined?{}:{rewardPercent}) }, requireShop().getBits()),updates,null,
        Array.isArray(bursts)?bursts.filter(form=>Number.isSafeInteger(form)&&burstFormTier(form)!==null):[],
        {settle:{stats:{partnerDowns:Number(contractStats?.partnerDowns)||0,seconds:Number.isFinite(contractStats?.seconds)?contractStats.seconds:Infinity},
          partyIds:battlePartyIds??[]}});
      if (!result.ok || result.duplicate) return result;
      for(const entry of updates)raisingActors.delete(entry.instanceId);
      battlePartyIds=null;
      settleTowerFloor(attemptId,result.receipt?.won===true);
      // A round fought under a run writes its flag here, from the same verdict
      // the economy just settled on, so nothing judges the round twice.
      if(championshipAttemptId===attemptId){
        championshipAttemptId=null;
        if(championshipRun&&nativeChampionshipContinues(championshipRun)){
          championshipRun=recordNativeChampionshipRound(championshipRun,
            {verdict:result.receipt.won?BATTLE_OUTCOME_TEAM_ZERO_AHEAD:BATTLE_OUTCOME_TEAM_ONE_AHEAD}).run;
          savePort.markDirty();
        }
      }
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
        const abandoned = battleEconomy.active.attemptId;
        const result = applyBattleTransaction(abandonBattleAttempt(battleEconomy, {
          attemptId: abandoned
        }, requireShop().getBits()));
        if (!result.ok) return screens.current();
        // A sponsor contract's stake stays with the sponsor when the match is left unfinished.
        const escrow = sponsorEscrowOf(burstState());
        if (escrow?.attemptId === abandoned) {
          burstEvolution = withSponsorEscrow(burstState(), null);
          lastSponsorSettlement = Object.freeze({ attemptId: abandoned, contractId: escrow.contractId, stake: escrow.stake, met: false, payout: 0, gains: Object.freeze([]), forfeited: true });
          savePort.markDirty();
        }
      }
      battlePartyIds = null;
      championshipAttemptId = null;
      screens.exit();
      // A run still owed a round sends the player back to its board rather than
      // to Home. The judged round is behind the reset either way.
      if (championshipRun && nativeChampionshipContinues(championshipRun)
        && screens.current() === CHAMPIONSHIP_SCREENS.RAISING_HOME) {
        screens.enter(CHAMPIONSHIP_SCREENS.BATTLE_SELECT);
        screens.enter(CHAMPIONSHIP_SCREENS.CHAMPIONSHIP);
      }
      publishScreens();
      return screens.current();
    },

    selectGate(gateId,expected=null) {
      if(tutorialBaseline){
        if(screens.current()==='GATE_SELECT'&&gateId===TUTORIAL_GATE.gateId&&tutorialExpeditionInput(expected,'gate')){selectedGateId=gateId;publishScreens();}
        return selectedGateId;
      }
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
    confirmGate(expected=null) {
      if(tutorialBaseline)return confirmTutorialGate(expected);
      if (huntCommitActive) return screens.current();
      if (screens.current() !== CHAMPIONSHIP_SCREENS.GATE_SELECT) return screens.current();
      if (selectedGateId === null) return screens.current();
      if (!this.getGateAdmission(selectedGateId).canConfigure) return screens.current();
      confirmedGateId = selectedGateId;
      // Entering the loadout builds it over the Shop-owned inventory.
      huntLoadout = createHuntLoadout({ inventory: huntInventory });
      // HUNT_TOOL_TIERS_20261103: the strongest rope colour held is tied on first.
      const bestRope = huntLoadout.listAvailableEquipment().find(c => c.equipmentClass === "ROPE")?.items.at(-1);
      if (bestRope) huntLoadout.selectEquipment("ROPE", bestRope.itemId);
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
    async beginHunt() {
      if(tutorialBaseline)return screens.current(); // Dedicated tutorial entry adapter is not bound yet.
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
        // The scene catalog behind this is 1.5MB of run-length direction data
        // for all 29 fields, and a hunt reads one. Nothing before this screen
        // touches it, so it is fetched here; main.js warms it once a screen is
        // up, which is several taps before anyone can reach this.
        const { prepareNativeHuntEntry, appendNativeRareLureActor } = await import("../hunt/capture/nativeHuntEntryTransaction.js");
        const expansion = huntCaptureReplay === null && typeof huntExpansionLoader === 'function' ? await huntExpansionLoader(gate) : null;
        // Cyber Gachapon cartridges armed for this hunt (OWNER_APPROVED_ADAPTATION 2026-10-29).
        const armed = takeArmedHuntChips(gachaState());
        const boosts = Object.assign({}, ...armed.chips.map(id => getGachaChip(id).effect));
        // The rare lure lifts this hunt's appearance decay; the saved decay itself is kept.
        const lurePersistent = boosts.rareLure ? { ...huntPersistentState,
          modifiers: huntPersistentState.modifiers.map(row => row.map(() => 0)) } : huntPersistentState;
        const lured = huntCaptureReplay === null ? prepareNativeHuntEntry({ biomeId:gate.biomeId, expansion,
          clock:huntSceneClock(requireSession().getRaisingHomeSnapshot()),
          rngSnapshot:gameplayRngSnapshot(), persistentState:lurePersistent, resolvePool:resolveProductHuntPoolSources }) : null;
        // It also calls one more partner, this field's rarest (2026-11-02), from the same product pool.
        const luredEntry = lured && boosts.rareLure ? appendNativeRareLureActor({ ...lured, persistentState:{ ...lured.persistentState,
          modifiers:structuredClone(huntPersistentState.modifiers) } }) : lured;
        // Wild awakening instinct (AWAKENING_OVERDRIVE_20261109): each wild partner rolls a hidden instinct from a product
        // roll (the native RNG is never read); a veteran elite moves faster, an ancestral one stands larger.
        // HUNT_INSTINCT_RARITY_20261110: rolled for the whole hunt at once, so the per-hunt caps and the
        // premium radars (boosts.eliteCall / boosts.ancestorCall) see every partner.
        const instincts = luredEntry ? (huntInstinctOverride ? luredEntry.encounter.actors.map((_, i) => huntInstinctOverride(i))
          : settleWildInstincts(luredEntry.encounter.actors.map((actor, i) => {
            // Keyed by the individual's own native values, so a retried entry rolls the same instincts.
            const f = actor.individual.fields;
            return instinctNoise(0x4e, i, actor.speciesIndex, f['058'], f['060'], f['064'], f['068'], f['06c'], f['018']);
          }), boosts)) : [];
        const rolled = luredEntry ? { ...luredEntry, encounter: { ...luredEntry.encounter, actors: luredEntry.encounter.actors.map((actor, i) => {
          const instinct = instincts[i], rule = wildInstinct(instinct);
          return { ...actor, instinct, ...(rule.speedMultiplier ? { ai: { ...actor.ai, speedQ12: Math.round(actor.ai.speedQ12 * rule.speedMultiplier) } } : {}) };
        }) } } : null;
        // HUNT_SPAWN_SPREAD_20261110: positions only, after the native generation and without its RNG -- loose
        // same-species groups, a third of a screen between groups, one or two partners in the opening view.
        const entry = rolled && huntCaptureReplay === null && huntSpawnSpread ? { ...rolled, encounter: { ...rolled.encounter,
          actors: spreadHuntActors(rolled.encounter.actors, rolled.scene.environment) } } : rolled;
        huntInstincts = new Map((entry?.encounter.actors ?? []).map((actor, i) => [`${gate.gateId}:native-wild:${i}`, actor.instinct]));
        lastHuntRareLure = entry?.rareLure ? Object.freeze({ speciesId:`species-${String(entry.rareLure.speciesIndex).padStart(3, "0")}` }) : null;
        const world = createHuntWorld(gate, entry);
        const factory = huntRuntimeFactory
          ?? (await import("../hunt/huntRuntime.js")).createHuntRuntime;
        const candidateRuntime = factory({ world, nativeEntry:entry,
          captureReplay:huntCaptureReplay, maxCardG:huntMemoryCapacityG(),
          nativeControls:entry ? {loadout:requireLoadout(),consumeItem:(id,n=1)=>{
              // A snapped rope is spent in the save at once (HUNT_TOOL_TIERS_20261103).
              const spent=requireShop().consumeHuntItem(id,n);if(spent.ok&&getHuntCatalogItem(id)?.equipmentClass==='ROPE')savePort.markDirty();return spent;},
            ropeLedger:{wear:id=>requireShop().getRopeWear(id),setWear:(id,fraction)=>requireShop().setRopeWear(id,fraction),
              emergencyBits:id=>emergencyRopeFamily(id)?.emergencyBits??null},onChange:publishScreens,
            ...(armed.chips.length ? {boosts} : {})} : null,
          fieldActor:{ actorId:"championship:2026:actor:tamer", displayName:"Tamer" } });
        if (!candidateRuntime || candidateRuntime.world !== world) throw Error("HUNT_ENTRY_RUNTIME_INVALID");
        if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_LOADOUT || confirmedGateId !== gate.gateId) {
          throw Error("HUNT_ENTRY_CONTEXT_CHANGED");
        }
        if (requireShop().getBits() !== admission.walletBits) throw Error("HUNT_ENTRY_WALLET_CHANGED");
        screens.enter(CHAMPIONSHIP_SCREENS.HUNT_FIELD);
        if (entry) { gameplayRng = entry.rng; huntPersistentState = entry.persistentState; }
        huntRuntime = candidateRuntime;
        huntDeadlineMinute = entry ? Math.min(requireSession().getRaisingHomeSnapshot().clockMinutes + 480 + (boosts.extraSeconds ?? 0), DAY_END_MINUTES) : null;
        // Real time: the hunt's own countdown, no 22:00 cut. Owner 2026-11-10: one real minute (144 hunt minutes at
        // 400 units a minute, 16 a frame); more time only from chrono cartridges (armed, or used during the hunt).
        huntRealtime = realtime && entry ? { elapsedUnits: 0, limitMinutes: REALTIME_HUNT_BASE_MINUTES + (boosts.extraSeconds ?? 0) } : null;
        if (armed.chips.length) { cyberGacha = armed.state; lastHuntGachaBoosts = Object.freeze([...armed.chips]); }
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
        if (entry || admission.chargeBits > 0 || armed.chips.length) savePort.markDirty();
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
      if (huntRealtime) return Object.freeze({ deadlineMinute: huntRealtime.limitMinutes,
        remainingMinutes: Math.max(0, huntRealtime.limitMinutes - Math.floor(huntRealtime.elapsedUnits / 400)),
        // Owner 2026-11-10: the real-time hunt is shown in real seconds (16 clock units a frame at 60 fps).
        remainingSeconds: Math.max(0, Math.ceil((huntRealtime.limitMinutes * 400 - huntRealtime.elapsedUnits) / 16 / 60)),
        evidence: "PRODUCT_REALTIME_HUNT_COUNTDOWN" });
      return Object.freeze({ deadlineMinute: huntDeadlineMinute,
        remainingMinutes: Math.max(0, huntDeadlineMinute - requireSession().getRaisingHomeSnapshot().clockMinutes),
        evidence: "ROM_NORMAL_HUNT_CLOCK_AND_DEADLINE" });
    },

    checkHuntDeadline() {
      if (huntRealtime) {
        if (screens.current() === CHAMPIONSHIP_SCREENS.HUNT_FIELD && huntRealtime.elapsedUnits >= huntRealtime.limitMinutes * 400) this.exitHunt();
        return;
      }
      if (screens.current() === CHAMPIONSHIP_SCREENS.HUNT_FIELD && huntDeadlineMinute !== null
        && requireSession().getRaisingHomeSnapshot().clockMinutes >= huntDeadlineMinute) this.exitHunt();
    },

    exitHunt() {
      if(tutorialBaseline)return screens.current();
      if (huntCommitActive) return screens.current();
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD) return screens.current();
      if (huntRuntime?.hasPendingCaptureAnimation()) return screens.current();
      huntCommitActive = true;
      queueRanchTraining();
      try {
        const returnContext = huntRuntime?.getNativeReturnContext?.();
        if (returnContext) {
          const cards = huntRuntime.getOnCardEntries();
          const returnRng = restoreChannelRng(gameplayRngSnapshot());
          const returned = applyNativeHuntReturn({ ...returnContext, ...huntPersistentState,
            catalog:productHuntCatalogForBiome(returnContext.biomeIndex), speciesByIndex:nativeHuntSpeciesByIndex, rng:returnRng,
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
        huntDeadlineMinute = null; huntRealtime = null;
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
      if (tutorialBaseline || screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return false;
      return huntRuntime.beginEnclosureStroke(worldX, worldY);
    },

    extendEnclosureStroke(worldX, worldY) {
      if (tutorialBaseline || screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return false;
      return huntRuntime.extendEnclosureStroke(worldX, worldY);
    },

    // Geometry cannot allocate a Raising ID or change the wallet/save/roster.
    // Native replay card insertion and Home commit use separate methods below.
    endEnclosureStroke() {
      if (tutorialBaseline || screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_FIELD || !huntRuntime) return null;
      return huntRuntime.endEnclosureStroke();
    },

    abortEnclosureStroke() {
      return huntRuntime?.abortEnclosureStroke() ?? false;
    },

    /** Close Hunt Result and return to Raising Home. */
    confirmHuntResult() {
      if(tutorialBaseline)return screens.current(); // No ordinary Home commit for demo cards.
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
        // GACHA_FULL_EFFECTS_20261109: the ranch's capacity in G decides how many come home (release one, rank up or expand).
        const ranchUsedG = listRaisingInstances(sources).reduce((sum, entry) => sum + partnerGOf(entry.speciesId), 0)
          + entries.reduce((sum, entry) => sum + partnerGOf(entry.speciesId), 0);
        if (ranchUsedG > ranchCapacityG()) {
          huntResult = Object.freeze({ ...huntResult, commitError: "RANCH_CAPACITY_FULL", ranchG: Object.freeze({ used: ranchUsedG, max: ranchCapacityG() }) });
          publishScreens(); return screens.current();
        }
        let candidateBurst = burstState(), candidateGacha = cyberGacha;
        for (const entry of entries) {
          const allocation = allocateRaisingInstanceIdentity(candidateIdentity, { ...sources, collection: candidateRaising.collection,
            assignments: candidateRaising.assignments });
          candidateIdentity = allocation.state;
          // A caught elite brings its own-race awakening points and stronger stats; an ancestral one a head start on its
          // first awakening and a natural bloodline (AWAKENING_OVERDRIVE_20261109).
          const instinct = huntInstincts.get(entry.wildId) ?? 'NORMAL', rule = wildInstinct(instinct);
          let nativeProfile = entry.nativeProfile;
          if (instinct === 'ELITE') {
            const condition = ownPointCondition(speciesTaxonomy(nativeProfile.fields['000']));
            const kind = condition ? TRAINING_KIND_OF_CONDITION[condition] : null;
            nativeProfile = applyProductTrainingGains(nativeProfile, [...(Number.isInteger(kind) ? [{ kind, delta: rule.awakeningPoints }] : []),
              ...[18, 19, 20, 21].map((stat) => ({ kind: stat, delta: rule.statGain }))]).profile;
          }
          if (instinct === 'ANCESTOR') {
            candidateBurst = withAwakeningSeed(candidateBurst, allocation.instanceId, rule.awakeningPercent);
            const family = WILD_INSTINCT_BLOODLINES[Math.floor(productRoll(0x4f) * WILD_INSTINCT_BLOODLINES.length)];
            candidateGacha = inscribeGachaBloodline(candidateGacha ?? gachaState(), allocation.instanceId, family);
          }
          candidateRaising = recordCapturedCardCreature(candidateRaising, { instanceId: allocation.instanceId,
            speciesId: entry.speciesId, displayName: entry.displayName, enclosedAt: now(), originGateId: confirmedGateId,
            cageId: Object.values(candidateRaising.assignments)[0] ?? cageIds[0],
            capturedVitals: { ...entry.sourceVitals, traceId: entry.traceId },
            nativeProfile });
        }
        const candidateBook = retainOwnedBookSpecies(registeredSpeciesValue, creature, candidateRaising.collection);
        // OWNER_APPROVED_ADAPTATION 2026-10-28: a lure -> disable -> rope chain
        // (and a Clone Rope imprint) pays bonus bits in this same Home save.
        const comboBits = entries.reduce((sum, entry) => sum + (Number.isSafeInteger(entry.combo?.bits) ? entry.combo.bits : 0), 0);
        const bonusShop = comboBits > 0 && shop ? createShopRuntime({ snapshot: shop.toSave(), allowRepeatedCages: playtestPolicy?.enabled === true,
          allItemsVisible: playtestPolicy?.shopOpen === true, progression: progressionContext() }) : null;
        bonusShop?.creditBits(comboBits, { evidence: 'OWNER_APPROVED_ADAPTATION' }); // capped at the wallet limit
        huntCommitActive = true;
        let status;
        try {
          status = savePort.save({ snapshot: candidateSnapshot, creature, sessionId,
            revision: revision + 1, interactionCount, friendsPlaytest, onlineBindReward, tamerRank: tamerRankValue, battleBadges:battleBadgesValue, nativeTitles, nativeMessages, nativeOpening, championshipRun, freeBattleMenu, battleTactics, cyberGacha: candidateGacha, burstEvolution: candidateBurst, syncLevels, journey, raising: candidateRaising,
            registeredSpecies: candidateBook,
            shop: (bonusShop ?? shop) ? (bonusShop ?? shop).toSave() : null, cageEdit: cageEdit ? cageEdit.toSave() : null,
            battleEconomy, instanceIdentity: candidateIdentity, gameplayRng: gameplayRngSnapshot(),
            huntHistory: projectNativeHuntPersistentSave(huntPersistentState) });
          if (status.phase === "SAVED") {
            if (bonusShop) {
              shop = createShopRuntime({ snapshot: bonusShop.toSave(), huntInventory, allowRepeatedCages: playtestPolicy?.enabled === true,
                allItemsVisible: playtestPolicy?.shopOpen === true, progression: progressionContext() });
              applyMappedHuntInventoryFromShop(shop, huntInventory); bindShopRuntime();
            }
            raising = candidateRaising; instanceIdentity = candidateIdentity; revision += 1;
            burstEvolution = candidateBurst; cyberGacha = candidateGacha; huntInstincts = new Map();
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
     * Which catch on the memory card the name plate edits. Every catch is
     * brought Home with its own name; the plate used to stay on the first one,
     * so a second or third catch could not be named (Owner report, 2026-10-05).
     */
    selectHuntResultEntry(wildId) {
      if (screens.current() !== CHAMPIONSHIP_SCREENS.HUNT_RESULT || !huntResult?.pendingHomeCommit || huntCommitActive) return false;
      const entry = (huntRuntime?.getOnCardEntries() ?? []).find((candidate) => candidate.wildId === wildId);
      if (!entry) return false;
      if (entry.wildId !== huntResult.wildId) {
        huntResult = Object.freeze({ ...huntResult, wildId: entry.wildId, speciesId: entry.speciesId,
          speciesLabel: speciesDisplayName(entry.speciesId),
          displayName: entry.displayName ?? speciesDisplayName(entry.speciesId) });
        publishScreens();
      }
      return true;
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
      if(tutorialBaseline)return screens.current();
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
      if (from === CHAMPIONSHIP_SCREENS.CAGE_EDIT) {cageEdit?.revert(...cageEditArgs());draftRoyalEditions=null;pendingRoyalEdition=null;}
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

    /** Cloud / transfer-code restore (Owner 2026-10-28): the imported text must pass the same complete candidate
     * validation Continue uses (not only the envelope deserializer) before it may replace the stored save. */
    adoptExternalSaveText(text) {
      let save;
      try { save = deserializeChampionshipModernSave(text); } catch (error) { return Object.freeze({ ok: false, reason: `SAVE_TEXT_INVALID: ${error.message}` }); }
      try { restoreCandidate(save); } catch (error) { return Object.freeze({ ok: false, reason: `SAVE_NOT_LOADABLE: ${error.message}` }); }
      return savePort.adoptExternalText(text);
    },

    /** Owner 2026-10-29: this save's paid first-bind gift, or null. */
    getOnlineBindReward() { return onlineBindReward; },
    /** The open save's own id; the online layer hashes it before it leaves the device (claim idempotency). */
    getSaveReference() { return session ? sessionId : null; },
    /**
     * Pays the first-bind gift once the cloud ledger accepted the claim: the Bits
     * and the save's paid marker are one durable write; a failed save changes neither.
     */
    claimOnlineBindReward({ provider, rewardBits } = {}) {
      if (!session || tutorialBaseline || battleTransactionActive || huntCommitActive || battleEconomy.active) return Object.freeze({ ok: false, reason: "BIND_REWARD_UNAVAILABLE" });
      const wallet = requireShop();
      const plan = planOnlineBindReward({ bits: wallet.getBits(), cap: wallet.getFrame().bitsCap, current: onlineBindReward, provider, rewardBits, claimedAt: new Date(now()).toISOString() });
      if (!plan.ok) return plan;
      storeNativeRaisingPositions(); storeNativeRaisingHome();
      const candidate = createShopRuntime({ snapshot: wallet.toSave(), allowRepeatedCages: playtestPolicy?.enabled === true,
        allItemsVisible: playtestPolicy?.shopOpen === true, progression: progressionContext() });
      if (plan.credited > 0) candidate.creditBits(plan.credited, { evidence: "OWNER_APPROVED_ADAPTATION" });
      const status = savePort.save({ ...liveSaveRequest(revision + 1), onlineBindReward: plan.record, shop: candidate.toSave() });
      if (status.phase !== "SAVED") { savePort.discardPendingWrite(); return Object.freeze({ ok: false, reason: "SAVE_FAILED" }); }
      onlineBindReward = plan.record;
      shop = createShopRuntime({ snapshot: candidate.toSave(), huntInventory, allowRepeatedCages: playtestPolicy?.enabled === true,
        allItemsVisible: playtestPolicy?.shopOpen === true, progression: progressionContext() });
      applyMappedHuntInventoryFromShop(shop, huntInventory); bindShopRuntime(); revision++;
      publishScreens();
      return Object.freeze({ ok: true, credited: plan.credited, bits: shop.getBits(), record: plan.record });
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
        exportRecovery: () => {
          const recovery = savePort.exportRecovery();
          // Use the same complete validation as Continue, without adopting,
          // writing, migrating stored bytes, or replacing the active session.
          const save = deserializeChampionshipModernSave(recovery.text);
          restoreCandidate(save);
          return Object.freeze({ ...recovery, backupSource: recovery.pendingText ? 'pending' : 'stored' });
        }
      });
    },

    async dispose() {
      if(tutorialTransitionActive||tutorialCommitActive)return false;
      if (huntCommitActive) return false;
      cancelRaisingHand();
      battlePartyIds = null;
      resetExpedition();
      if (!session) {await savePort.releaseSession();return;}
      const closing = session;
      session = null;
      await closing.dispose();
      tutorialBaseline=null;tutorialPendingOpening=null;tutorialOfferEligible=false;
      await savePort.releaseSession();
    }
  });
}

