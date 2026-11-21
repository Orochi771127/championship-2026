// Cyber Dungeon (網域地牢) Roguelike Phase 1 (OWNER_APPROVED_ADAPTATION 2026-11-21):
//
// Pure, deterministic 5-room dungeon-crawler push-map built over the existing free-battle
// presets and HP/TP carry-over loop:
//   * 4 Sectors spanning Free Battle tiers 1..8
//   * 5 rooms per run: Combat / Elite / Campfire / Resonance Altar / Wild Signal -> Room 5 Boss
//   * 3-pick-1 temporary Roguelike Data Chips (10 chips) after every cleared combat room
//   * 2-door branching fork between rooms
//   * Resonance Altar directly feeds Wave 2 Open Blind-Box Evolution (real race/faction points!)
//   * Dedicated localStorage persistence key (never touches the main save schema)

import { deepFreeze } from './championshipContracts.js';
import catalog from '../../data/championship/catalogs/free-battle.r1.json' with { type: 'json' };
import { OPEN_EVOLUTION_FACTION_FIELDS, OPEN_EVOLUTION_RACE_FIELDS } from '../raising/productOpenEvolution.js';

export const CYBER_DUNGEON_STORAGE_KEY = 'championship:cyberDungeon:v1';
export const CYBER_DUNGEON_ROOMS_TOTAL = 5;

export const CYBER_DUNGEON_SECTORS = deepFreeze([
  { id: 1, baseTier: 1, bossTier: 2, roomCrystals: 28, roomBits: 90, bossCrystals: 90, bossBits: 220, arenaIndex: 2 },
  { id: 2, baseTier: 3, bossTier: 4, roomCrystals: 44, roomBits: 150, bossCrystals: 140, bossBits: 340, arenaIndex: 4 },
  { id: 3, baseTier: 5, bossTier: 6, roomCrystals: 68, roomBits: 230, bossCrystals: 210, bossBits: 480, arenaIndex: 6 },
  { id: 4, baseTier: 7, bossTier: 8, roomCrystals: 96, roomBits: 320, bossCrystals: 300, bossBits: 680, arenaIndex: 8 }
]);

export const CYBER_DUNGEON_CHIPS = deepFreeze([
  { id: 'TP_SURGE', startTpBonusPct: 30, postHealPct: 0, crystalsBonusPct: 0, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'VAMP_LINK', startTpBonusPct: 0, postHealPct: 25, crystalsBonusPct: 0, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'FIRST_STRIKE', startTpBonusPct: 10, postHealPct: 5, crystalsBonusPct: 0, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'AEGIS_SHELL', startTpBonusPct: 0, postHealPct: 15, crystalsBonusPct: 0, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'TEMPO_CHIP', startTpBonusPct: 15, postHealPct: 10, crystalsBonusPct: 0, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'CRIT_OVERCLOCK', startTpBonusPct: 0, postHealPct: 0, crystalsBonusPct: 25, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'BOND_HARMONY', startTpBonusPct: 20, postHealPct: 0, crystalsBonusPct: 10, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'CRYSTAL_MAGNET', startTpBonusPct: 0, postHealPct: 0, crystalsBonusPct: 40, bitsPerRoom: 0, bossCrystalsBonus: 0 },
  { id: 'BITS_SIPHON', startTpBonusPct: 0, postHealPct: 0, crystalsBonusPct: 0, bitsPerRoom: 80, bossCrystalsBonus: 0 },
  { id: 'BOSS_BREAKER', startTpBonusPct: 0, postHealPct: 0, crystalsBonusPct: 0, bitsPerRoom: 0, bossCrystalsBonus: 120 }
]);

const CHIP_BY_ID = new Map(CYBER_DUNGEON_CHIPS.map((c) => [c.id, c]));
const SECTOR_BY_ID = new Map(CYBER_DUNGEON_SECTORS.map((s) => [s.id, s]));

// Deterministic seeded PRNG stream (never touches battle RNG).
function stream(seed, ...keys) {
  let h = (Number(seed) >>> 0) ^ 0x9e3779b9;
  for (const key of keys) {
    h = Math.imul(h ^ (Number(key) >>> 0), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_TIER = catalog.pools.length - 1;
function tierPool(tier) {
  const clamped = Math.max(0, Math.min(MAX_TIER, tier | 0));
  return [...new Set(catalog.pools[clamped].flat())];
}

function drawPresets(tier, count, random) {
  const pool = tierPool(tier);
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    out.push(pool.splice(idx, 1)[0]);
  }
  return Object.freeze(out);
}

const ALTAR_POOL = deepFreeze([
  ...OPEN_EVOLUTION_RACE_FIELDS.map((r) => ({ kind: 'RACE', key: r.race, field: r.field, points: 12 })),
  ...OPEN_EVOLUTION_FACTION_FIELDS.map((f) => ({ kind: 'FACTION', key: f.faction, field: f.field, points: 12 }))
]);

function makeAltarOptions(seed, roomIndex) {
  const random = stream(seed, 71, roomIndex);
  const copy = [...ALTAR_POOL];
  const a = copy.splice(Math.floor(random() * copy.length), 1)[0];
  const b = copy.splice(Math.floor(random() * copy.length), 1)[0];
  return Object.freeze([a, b]);
}

function buildRoom(sector, roomIndex, kind, seed, side = 0) {
  const random = stream(seed, 19, roomIndex, side);
  if (kind === 'BOSS') {
    return deepFreeze({
      roomIndex,
      kind: 'BOSS',
      tier: sector.bossTier,
      presets: drawPresets(sector.bossTier, 3, random),
      arenaIndex: sector.arenaIndex
    });
  }
  if (kind === 'ELITE') {
    const tier = Math.min(MAX_TIER, sector.baseTier + 1);
    return deepFreeze({
      roomIndex,
      kind: 'ELITE',
      tier,
      presets: drawPresets(tier, 2, random),
      arenaIndex: sector.arenaIndex
    });
  }
  if (kind === 'COMBAT') {
    const count = roomIndex === 0 ? 1 : 2;
    return deepFreeze({
      roomIndex,
      kind: 'COMBAT',
      tier: sector.baseTier,
      presets: drawPresets(sector.baseTier, count, random),
      arenaIndex: sector.arenaIndex
    });
  }
  if (kind === 'ALTAR') {
    return deepFreeze({
      roomIndex,
      kind: 'ALTAR',
      options: makeAltarOptions(seed, roomIndex)
    });
  }
  if (kind === 'CAMPFIRE') {
    return deepFreeze({ roomIndex, kind: 'CAMPFIRE' });
  }
  return deepFreeze({
    roomIndex,
    kind: 'SIGNAL',
    supplyBits: sector.roomBits + 40,
    supplyCrystals: Math.round(sector.roomCrystals * 0.75)
  });
}

function buildNextDoors(sector, nextRoomIndex, seed) {
  if (nextRoomIndex >= CYBER_DUNGEON_ROOMS_TOTAL - 1) {
    return Object.freeze([buildRoom(sector, CYBER_DUNGEON_ROOMS_TOTAL - 1, 'BOSS', seed, 0)]);
  }
  const random = stream(seed, 43, nextRoomIndex);
  // Guarantee varied roguelike choices: one combat/elite route + one tactical event route!
  const leftKind = nextRoomIndex === 1 ? (random() < 0.5 ? 'COMBAT' : 'ELITE') : 'ELITE';
  const eventPool = nextRoomIndex === 3 ? ['CAMPFIRE', 'ALTAR'] : ['ALTAR', 'CAMPFIRE', 'SIGNAL'];
  const rightKind = eventPool[Math.floor(random() * eventPool.length)];
  return Object.freeze([
    buildRoom(sector, nextRoomIndex, leftKind, seed, 0),
    buildRoom(sector, nextRoomIndex, rightKind, seed, 1)
  ]);
}

function drawChipChoices(ownedChipIds, seed, roomIndex) {
  const owned = new Set(ownedChipIds ?? []);
  const available = CYBER_DUNGEON_CHIPS.filter((c) => !owned.has(c.id));
  const random = stream(seed, 89, roomIndex);
  const pool = [...available];
  const draft = [];
  while (draft.length < 3 && pool.length > 0) {
    const idx = Math.floor(random() * pool.length);
    draft.push(pool.splice(idx, 1)[0].id);
  }
  return Object.freeze(draft);
}

/** Aggregate all active temporary Roguelike Data Chips for the run. */
export function aggregateDungeonChips(chipIds = []) {
  const out = {
    startTpBonusPct: 0,
    postHealPct: 0,
    crystalsBonusPct: 0,
    bitsPerRoom: 0,
    bossCrystalsBonus: 0
  };
  for (const id of chipIds) {
    const chip = CHIP_BY_ID.get(id);
    if (!chip) continue;
    out.startTpBonusPct += chip.startTpBonusPct;
    out.postHealPct += chip.postHealPct;
    out.crystalsBonusPct += chip.crystalsBonusPct;
    out.bitsPerRoom += chip.bitsPerRoom;
    out.bossCrystalsBonus += chip.bossCrystalsBonus;
  }
  return Object.freeze(out);
}

/** Create a brand-new 5-room Cyber Dungeon run. */
export function createCyberDungeonRun({ sectorId = 1, party = [], seed = 1, runId = `dg-${Date.now()}` } = {}) {
  const sector = SECTOR_BY_ID.get(Number(sectorId)) ?? CYBER_DUNGEON_SECTORS[0];
  const ids = (Array.isArray(party) ? party : []).filter((id) => typeof id === 'string' && id.length > 0).slice(0, 3);
  if (!ids.length) throw new TypeError('CYBER_DUNGEON_PARTY_REQUIRED');
  const cleanSeed = (Number(seed) >>> 0) || 1;
  const carryRatioById = Object.fromEntries(ids.map((id) => [id, Object.freeze({ hp: 1, tp: 1 })]));
  const room0 = buildRoom(sector, 0, 'COMBAT', cleanSeed, 0);
  return deepFreeze({
    version: 1,
    runId: String(runId),
    sectorId: sector.id,
    seed: cleanSeed,
    party: ids,
    totalRooms: CYBER_DUNGEON_ROOMS_TOTAL,
    roomIndex: 0,
    status: 'READY',
    activeRoom: room0,
    doors: [],
    chips: [],
    chipDraft: [],
    clearedRooms: 0,
    totalCrystals: 0,
    totalBits: 0,
    altarGains: [],
    settledAttempts: [],
    carryRatioById
  });
}

function clampRatio(v) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
}

function healCarry(carryRatioById, hpDeltaPct, tpDeltaPct) {
  const next = {};
  for (const [id, r] of Object.entries(carryRatioById ?? {})) {
    const alive = (r?.hp ?? 1) > 0;
    next[id] = Object.freeze({
      hp: alive ? clampRatio((r?.hp ?? 1) + hpDeltaPct / 100) : Math.min(1, Math.max(0.25, hpDeltaPct / 100)),
      tp: clampRatio((r?.tp ?? 1) + tpDeltaPct / 100)
    });
  }
  return next;
}

/** Record the real outcome of a Combat / Elite / Boss room once per attemptId. */
export function resolveDungeonCombat(run, { attemptId, won, partyRatios = null } = {}) {
  if (!run || !['READY', 'FIGHTING'].includes(run.status)) return { run, delta: null };
  if (attemptId && run.settledAttempts.includes(attemptId)) return { run, delta: null };
  const sector = SECTOR_BY_ID.get(run.sectorId) ?? CYBER_DUNGEON_SECTORS[0];
  const mods = aggregateDungeonChips(run.chips);
  const attempts = attemptId ? [...run.settledAttempts, attemptId].slice(-16) : run.settledAttempts;

  const updatedCarry = {};
  for (const id of run.party) {
    const incoming = partyRatios?.[id];
    const prev = run.carryRatioById?.[id] ?? { hp: 1, tp: 1 };
    updatedCarry[id] = Object.freeze({
      hp: clampRatio(incoming?.hp ?? prev.hp),
      tp: clampRatio(incoming?.tp ?? prev.tp)
    });
  }

  if (!won) {
    const nextRun = deepFreeze({
      ...run,
      status: 'DEFEATED',
      settledAttempts: attempts,
      carryRatioById: updatedCarry
    });
    return { run: nextRun, delta: Object.freeze({ crystals: 0, bits: 0, cleared: false }) };
  }

  const isBoss = run.activeRoom?.kind === 'BOSS' || run.roomIndex >= run.totalRooms - 1;
  const isElite = run.activeRoom?.kind === 'ELITE';
  const baseCrystals = isBoss ? sector.bossCrystals : Math.round(sector.roomCrystals * (isElite ? 1.35 : 1));
  const baseBits = isBoss ? sector.bossBits : Math.round(sector.roomBits * (isElite ? 1.35 : 1));
  const crystalsGain = Math.round(baseCrystals * (1 + mods.crystalsBonusPct / 100)) + (isBoss ? mods.bossCrystalsBonus : 0);
  const bitsGain = baseBits + mods.bitsPerRoom;

  const healedCarry = mods.postHealPct > 0 ? healCarry(updatedCarry, mods.postHealPct, 0) : updatedCarry;
  const clearedRooms = run.clearedRooms + 1;

  if (isBoss) {
    const nextRun = deepFreeze({
      ...run,
      status: 'CLEARED',
      clearedRooms,
      totalCrystals: run.totalCrystals + crystalsGain,
      totalBits: run.totalBits + bitsGain,
      settledAttempts: attempts,
      carryRatioById: healedCarry,
      chipDraft: [],
      doors: []
    });
    return { run: nextRun, delta: Object.freeze({ crystals: crystalsGain, bits: bitsGain, cleared: true }) };
  }

  const draft = drawChipChoices(run.chips, run.seed, run.roomIndex);
  const nextDoors = buildNextDoors(sector, run.roomIndex + 1, run.seed);
  const nextRun = deepFreeze({
    ...run,
    status: draft.length > 0 ? 'CHIP_DRAFT' : 'DOOR_CHOICE',
    clearedRooms,
    totalCrystals: run.totalCrystals + crystalsGain,
    totalBits: run.totalBits + bitsGain,
    settledAttempts: attempts,
    carryRatioById: healedCarry,
    chipDraft: draft,
    doors: nextDoors
  });
  return { run: nextRun, delta: Object.freeze({ crystals: crystalsGain, bits: bitsGain, cleared: false }) };
}

/** Pick 1 of the drafted Data Chips after a won combat room, unlocking the next doors. */
export function pickDungeonChip(run, chipId) {
  if (!run || run.status !== 'CHIP_DRAFT' || !run.chipDraft.includes(chipId)) return run;
  const chips = [...run.chips, chipId];
  const sector = SECTOR_BY_ID.get(run.sectorId) ?? CYBER_DUNGEON_SECTORS[0];
  const doors = run.doors.length ? run.doors : buildNextDoors(sector, run.roomIndex + 1, run.seed);
  return deepFreeze({
    ...run,
    chips,
    chipDraft: [],
    doors,
    status: 'DOOR_CHOICE'
  });
}

/** Choose one of the offered doors to advance into the next room. */
export function chooseDungeonDoor(run, doorIndex = 0) {
  if (!run || run.status !== 'DOOR_CHOICE') return run;
  const door = run.doors[doorIndex] ?? run.doors[0];
  if (!door) return run;
  const isCombat = ['COMBAT', 'ELITE', 'BOSS'].includes(door.kind);
  return deepFreeze({
    ...run,
    roomIndex: door.roomIndex,
    activeRoom: door,
    doors: [],
    status: isCombat ? 'READY' : 'EVENT'
  });
}

/** Resolve an interactive Event Room (Campfire / Resonance Altar / Wild Signal). */
export function resolveDungeonEvent(run, optionId) {
  if (!run || run.status !== 'EVENT' || !run.activeRoom) return { run, reward: null };
  const sector = SECTOR_BY_ID.get(run.sectorId) ?? CYBER_DUNGEON_SECTORS[0];
  const nextDoors = buildNextDoors(sector, run.roomIndex + 1, run.seed);
  const kind = run.activeRoom.kind;

  if (kind === 'CAMPFIRE') {
    if (optionId === 'REST') {
      const nextRun = deepFreeze({
        ...run,
        clearedRooms: run.clearedRooms + 1,
        carryRatioById: healCarry(run.carryRatioById, 50, 50),
        doors: nextDoors,
        status: 'DOOR_CHOICE'
      });
      return { run: nextRun, reward: Object.freeze({ kind: 'REST' }) };
    }
    const bonusChip = drawChipChoices(run.chips, run.seed, run.roomIndex + 100)[0] ?? null;
    const nextRun = deepFreeze({
      ...run,
      clearedRooms: run.clearedRooms + 1,
      chips: bonusChip ? [...run.chips, bonusChip] : run.chips,
      doors: nextDoors,
      status: 'DOOR_CHOICE'
    });
    return { run: nextRun, reward: Object.freeze({ kind: 'CHIP', chipId: bonusChip }) };
  }

  if (kind === 'ALTAR') {
    const idx = Number(optionId) === 1 ? 1 : 0;
    const blessing = run.activeRoom.options?.[idx] ?? run.activeRoom.options?.[0];
    if (!blessing) return { run, reward: null };
    const nextRun = deepFreeze({
      ...run,
      clearedRooms: run.clearedRooms + 1,
      altarGains: [...run.altarGains, blessing],
      doors: nextDoors,
      status: 'DOOR_CHOICE'
    });
    return { run: nextRun, reward: Object.freeze({ kind: 'ALTAR', blessing }) };
  }

  if (kind === 'SIGNAL') {
    const bits = run.activeRoom.supplyBits ?? sector.roomBits;
    const crystals = run.activeRoom.supplyCrystals ?? Math.round(sector.roomCrystals * 0.75);
    const nextRun = deepFreeze({
      ...run,
      clearedRooms: run.clearedRooms + 1,
      totalBits: run.totalBits + bits,
      totalCrystals: run.totalCrystals + crystals,
      doors: nextDoors,
      status: 'DOOR_CHOICE'
    });
    return {
      run: nextRun,
      reward: Object.freeze({ kind: optionId === 'HUNT' ? 'SIGNAL_HUNT' : 'SIGNAL_SUPPLY', bits, crystals })
    };
  }

  return { run, reward: null };
}

export function serializeCyberDungeonRun(run) {
  return run ? JSON.stringify(run) : null;
}

export function deserializeCyberDungeonRun(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.party) || !parsed.party.length) return null;
    return deepFreeze(parsed);
  } catch {
    return null;
  }
}
