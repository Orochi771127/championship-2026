// Pure read-only projections connecting raising/care decisions to visible branching
// evolution progress and individual partner identity.
//
// Reads existing native individual fields, Sync level and product growth rules only.
// Writes no save data, calls no RNG and respects Database discovery privacy.

import { PRODUCT_GROWTH_RULES as growthRules, growthBranchHistoryIndex } from "../contracts/productGrowthRules.js";
import { deepFreeze } from "../contracts/championshipContracts.js";
import { evolutionLevelShort } from "../contracts/productSyncLevel.js";
import { nativeHuntSpeciesByIndex } from "../hunt/capture/nativeHuntSources.js";
import { nativeEvolutionRequirements } from "../raising/nativeRaisingLifecycle.js";
import { DATABASE_EVOLUTION_CONDITION_DESCRIPTORS } from "../database/databaseEvolutionConditions.js";
import { speciesName } from "../text/zhHant.js";

const hex = (n) => n.toString(16).padStart(3, "0");
const signed = (n) => n | 0;

function nativeWinPercent(fields) {
  const battles = fields["024"] | 0;
  const wins = fields["028"] | 0;
  if ((battles << 12) <= 0) return 0;
  const q = Number((BigInt(wins << 12) << 12n) / BigInt(battles << 12));
  return Number((BigInt(q) * 409600n + 2048n) >> 12n) >> 12;
}

/**
 * Evaluate the partner's real progress toward its closest natural branching
 * evolution routes. Returns null for eggs or forms with no natural branches.
 */
export function buildPartnerEvolutionCompass({
  profile,
  sync = null,
  registeredSpecies = [],
  evolutionBranches = [],
  maxBranches = 2,
  pinnedBranchIndex = null
} = {}) {
  const fields = profile?.fields;
  const narrow = profile?.narrowFields;
  if (!fields || !narrow) return null;
  const speciesIndex = fields["000"] | 0;
  if (!Number.isInteger(speciesIndex) || speciesIndex < 8) return null;
  const rules = growthRules.rules[speciesIndex - 8];
  if (!Array.isArray(rules) || !rules.length) return null;

  let species = null;
  try { species = nativeHuntSpeciesByIndex(speciesIndex); } catch { return null; }
  if (!species || species.generation === 0 || species.generation === 6) return null;

  const registered = new Set(Array.isArray(registeredSpecies) ? registeredSpecies : []);
  const recordedBranches = new Set(Array.isArray(evolutionBranches) ? evolutionBranches : []);
  const winPercent = nativeWinPercent(fields);
  const battles = signed(fields["024"]);
  const rebirths = narrow["03c"] ?? 0;
  const careMistakes = narrow["03d"] ?? 0;

  const evaluated = [];
  for (let branchIndex = 0; branchIndex < rules.length; branchIndex++) {
    const rule = rules[branchIndex];
    if (!rule || rule.kind !== 0 || !Array.isArray(rule.thresholds)) continue;
    const req = nativeEvolutionRequirements(rule);
    const items = [];
    for (const desc of DATABASE_EVOLUTION_CONDITION_DESCRIPTORS) {
      const idx = desc.thresholdIndex;
      const raw = rule.thresholds[idx];
      if (!raw || desc.ordinaryOperator === null) continue;
      let current = 0;
      let target = raw;
      if (idx < 11) {
        current = signed(fields[req.counts[idx].field]);
        target = req.counts[idx].minimum;
      } else if (idx <= 21) {
        const s = req.stats[idx - 11];
        current = signed(fields[s.field]);
        target = s.minimum;
      } else if (idx === 22) {
        current = battles;
      } else if (idx === 23) {
        current = winPercent;
      } else if (idx === 24) {
        current = rebirths;
      } else if (idx === 25) {
        current = careMistakes;
      }
      const met = desc.ordinaryOperator === "LTE" ? current <= target : current >= target;
      const gap = desc.ordinaryOperator === "LTE" ? Math.max(0, current - target) : Math.max(0, target - current);
      items.push({
        id: desc.id,
        labelKey: `DEX_CONDITION_${desc.id}`,
        operator: desc.ordinaryOperator,
        current,
        target,
        met,
        gap
      });
    }
    const totalCount = items.length;
    const metCount = items.filter((item) => item.met).length;
    const ratio = totalCount > 0 ? metCount / totalCount : 1;
    const legacyOffset = (speciesIndex - 8) * 5 + growthBranchHistoryIndex(speciesIndex, branchIndex);
    const revealed = registered.has(rule.target) && recordedBranches.has(legacyOffset);
    evaluated.push({
      branchIndex,
      targetSpeciesIndex: rule.target,
      revealed,
      targetName: revealed ? speciesName(rule.target) : null,
      pinned: pinnedBranchIndex === branchIndex,
      metCount,
      totalCount,
      ratio,
      ready: metCount === totalCount,
      unmet: items.filter((item) => !item.met).slice(0, 3),
      met: items.filter((item) => item.met)
    });
  }

  if (!evaluated.length) return null;
  evaluated.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.ready !== b.ready) return a.ready ? -1 : 1;
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    if (a.unmet.length !== b.unmet.length) return a.unmet.length - b.unmet.length;
    return a.branchIndex - b.branchIndex;
  });

  const syncLevel = sync?.level ?? 1;
  const syncGate = evolutionLevelShort(species.generation, syncLevel);
  const pinnedBranch = evaluated.find((b) => b.pinned) ?? null;
  const visible = evaluated.slice(0, Math.max(1, maxBranches));
  return deepFreeze({
    speciesIndex,
    totalBranches: evaluated.length,
    syncGate: syncGate ? { need: syncGate.need, level: syncGate.level } : null,
    pinnedGoal: pinnedBranch ? {
      branchIndex: pinnedBranch.branchIndex,
      revealed: pinnedBranch.revealed,
      targetName: pinnedBranch.targetName,
      metCount: pinnedBranch.metCount,
      totalCount: pinnedBranch.totalCount,
      ratio: pinnedBranch.ratio,
      ready: pinnedBranch.ready,
      syncGate: syncGate ? { need: syncGate.need, level: syncGate.level } : null,
      nextGap: pinnedBranch.unmet[0] ?? null
    } : null,
    branches: visible
  });
}

export const EVOLUTION_PIN_STORAGE_KEY = "championship:evolutionPins:v1";

function readPinStore(storage) {
  try {
    const raw = storage?.getItem?.(EVOLUTION_PIN_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function getPinnedEvolutionBranch(storage, instanceId, speciesIndex) {
  if (!instanceId || !Number.isInteger(speciesIndex)) return null;
  const entry = readPinStore(storage)[instanceId];
  if (!entry || entry.speciesIndex !== speciesIndex || !Number.isInteger(entry.branchIndex)) return null;
  return entry.branchIndex;
}

export function togglePinnedEvolutionBranch(storage, instanceId, speciesIndex, branchIndex) {
  if (!storage || !instanceId || !Number.isInteger(speciesIndex) || !Number.isInteger(branchIndex)) return null;
  const store = readPinStore(storage);
  const current = store[instanceId];
  let next = null;
  if (current && current.speciesIndex === speciesIndex && current.branchIndex === branchIndex) {
    delete store[instanceId];
  } else {
    store[instanceId] = { speciesIndex, branchIndex };
    next = branchIndex;
  }
  try { storage.setItem?.(EVOLUTION_PIN_STORAGE_KEY, JSON.stringify(store)); } catch {}
  return next;
}

// Six core stats: HP(058), TP(05c), ATK(060), DEF(064), WIS(068), SPD(06c) with bounds at 0xa8 + i*8.
const CORE_STAT_KEYS = Object.freeze(["058", "05c", "060", "064", "068", "06c"]);

/**
 * Derive an individual partner's recognizable build archetype & living story
 * from its own real native fields (distinguishing two partners of the same species).
 */
export function buildPartnerIdentityCard({ profile, sync = null, tactic = 0, grade = null, mood = null } = {}) {
  const fields = profile?.fields;
  const narrow = profile?.narrowFields;
  if (!fields || !narrow) return null;
  const speciesIndex = fields["000"] | 0;
  if (!Number.isInteger(speciesIndex) || speciesIndex < 8) return null;

  // Normalize each of the 6 stats within this species' own [lower..upper] training span.
  const ratios = CORE_STAT_KEYS.map((statKey, i) => {
    const val = signed(fields[statKey]);
    const hi = signed(fields[hex(0xa8 + i * 8)]);
    const lo = signed(fields[hex(0xac + i * 8)]);
    const span = Math.max(1, hi - lo);
    return Math.max(0, Math.min(1, (val - lo) / span));
  });
  const [hpR, tpR, atkR, defR, wisR, spdR] = ratios;
  const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  const axes = [
    { id: "TANK", score: (hpR + defR) / 2 },
    { id: "STRIKER", score: atkR },
    { id: "CASTER", score: (wisR + tpR) / 2 },
    { id: "SPEED", score: spdR }
  ].sort((a, b) => b.score - a.score);

  const archetype = axes[0].score - avg >= 0.06 && axes[0].score >= 0.12 ? axes[0].id : "BALANCED";
  const careMistakes = Math.max(0, narrow["03d"] ?? 0);
  const affection = Math.max(0, Math.min(100, signed(fields["020"])));
  const battles = Math.max(0, signed(fields["024"]));
  const wins = Math.max(0, Math.min(battles, signed(fields["028"])));
  const winPercent = battles > 0 ? Math.round((wins / battles) * 100) : 0;
  const rebirths = Math.max(0, narrow["03c"] ?? 0);

  // Pick a vivid, factually-grounded story line rather than a spreadsheet readout.
  let storyKey = "PARTNER_STORY_ROOKIE";
  if (rebirths > 0) storyKey = "PARTNER_STORY_REBIRTH";
  else if (battles >= 5 && winPercent >= 60) storyKey = "PARTNER_STORY_VETERAN";
  else if (affection >= 75 && battles > 0) storyKey = "PARTNER_STORY_BONDED";
  else if (affection >= 75) storyKey = "PARTNER_STORY_BONDED_CALM";
  else if (battles > 0 && careMistakes > 0) storyKey = "PARTNER_STORY_SCRAPPY";
  else if (battles > 0) storyKey = "PARTNER_STORY_FIGHTER";

  // Milestones only light up when genuinely earned (max 3).
  const milestones = [];
  if (careMistakes === 0 && (battles > 0 || affection >= 50 || rebirths > 0)) milestones.push("CARE_PERFECT");
  if (affection >= 80) milestones.push("DEEP_BOND");
  if (battles >= 5 && winPercent >= 70) milestones.push("VETERAN");
  if (rebirths > 0) milestones.push("REBIRTH");

  return deepFreeze({
    archetype,
    traitKey: `PARTNER_TRAIT_${archetype}`,
    careKey: careMistakes === 0 ? "PARTNER_CARE_PHRASE_CLEAN" : "PARTNER_CARE_PHRASE_LIVELY",
    storyKey,
    milestones: milestones.slice(0, 3),
    mood: mood ? { emoji: mood.emoji, tier: mood.tier, label: mood.label } : null,
    tactic: Number.isInteger(tactic) && tactic >= 0 && tactic <= 2 ? tactic : 0,
    grade: typeof grade === "string" ? grade : grade?.grade ?? null,
    star: sync?.star ?? 1,
    level: sync?.level ?? 1,
    careMistakes,
    affection,
    battles,
    wins,
    winPercent,
    rebirths
  });
}
