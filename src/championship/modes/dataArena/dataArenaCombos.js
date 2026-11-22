// DATA_ARENA_TEN_ELEMENT_COMBOS_20261122:
// Canonical 10-element reaction rules (金木水火土日月雷冰風), cross-ring physical-chemistry
// ground surface interactions (Poison Pool + Fire gasoline detonation, Water + Ice flash freeze,
// Water + Thunder electrify, Ice + Fire melt, Fire + Wind spread, Vine + Fire wildfire),
// 6 full status ailments (冰凍/燒傷/麻痺/中毒/催眠/緩速 + 沾濕), Spell-to-Spell Tornado Evolutions,
// and Directional Destructible Shield-Wall Shatter & Elemental Interactions across ALL 666 moves.
// Pure deterministic logic — zero DOM/Pixi dependencies.

import { battleMoveName } from "../../text/battleMoveNames.js";
import { moveNameElement } from "../../text/moveNameElements.js";

export const CANONICAL_TEN_ELEMENTS = Object.freeze([
  "METAL", "WOOD", "EARTH", "WATER", "FIRE",
  "SUN", "ICE", "WIND", "THUNDER", "MOON"
]);

const ELEMENT_MAP = Object.freeze({
  metal: "METAL", iron: "METAL", steel: "METAL",
  wood: "WOOD", nature: "WOOD", grass: "WOOD", leaf: "WOOD", plant: "WOOD",
  earth: "EARTH", rock: "EARTH", stone: "EARTH", ground: "EARTH",
  water: "WATER", aqua: "WATER", tide: "WATER",
  fire: "FIRE", flame: "FIRE", ember: "FIRE", basalt: "FIRE",
  sun: "SUN", light: "SUN", holy: "SUN", solar: "SUN",
  ice: "ICE", frost: "ICE", cryo: "ICE", snow: "ICE",
  wind: "WIND", aero: "WIND", gale: "WIND",
  thunder: "THUNDER", storm: "THUNDER", volt: "THUNDER", electric: "THUNDER",
  moon: "MOON", shadow: "MOON", dark: "MOON", dusk: "MOON", psychic: "MOON", toxic: "WOOD"
});

/** Resolve display zh-Hant move name for own-XX moves (so all 666 moves match keywords). */
export function resolveMoveKeywordText(moveId) {
  const idStr = String(moveId ?? "");
  const m = /^own-(\d+)$/.exec(idStr);
  if (m) {
    const zh = battleMoveName(Number(m[1])) ?? "";
    return `${idStr} ${zh}`;
  }
  return idStr;
}

/** Normalize any arena/palette/taxonomy element key or 666-move ID into one of the 10 canonical elements (or null). */
export function normalizeCanonicalElement(el, moveId = null) {
  const key = String(el ?? "").toLowerCase();
  if (ELEMENT_MAP[key]) return ELEMENT_MAP[key];
  const m = /^own-(\d+)$/.exec(String(moveId ?? ""));
  if (m) {
    const zh = battleMoveName(Number(m[1])) ?? "";
    const inferred = moveNameElement(zh);
    if (inferred && ELEMENT_MAP[String(inferred).toLowerCase()]) {
      return ELEMENT_MAP[String(inferred).toLowerCase()];
    }
  }
  const text = resolveMoveKeywordText(moveId).toLowerCase();
  if (/wind|gale|gust|cyclone|tornado|wing|feather|風|嵐|颶|羽/.test(text)) return "WIND";
  if (/thunder|bolt|volt|arc|spark|shock|storm|雷|電|霹靂/.test(text)) return "THUNDER";
  if (/ice|frost|glacier|blizz|whiteout|freeze|snow|冰|凍|霜|雪|寒/.test(text)) return "ICE";
  if (/water|tide|surf|foam|wave|hydro|bubble|aqua|水|浪|潮|雨|泡|瀑/.test(text)) return "WATER";
  if (/fire|flame|ember|inferno|cinder|burn|magma|lava|火|焰|炎|燒|熔/.test(text)) return "FIRE";
  if (/earth|quake|rock|stone|sand|dig|burrow|mud|岩|石|土|地|沙|泥/.test(text)) return "EARTH";
  if (/wood|leaf|vine|bark|grove|thorn|seed|spore|poison|venom|毒|木|葉|藤|草|孢|瘴/.test(text)) return "WOOD";
  if (/sun|dawn|halo|radiant|light|solar|flash|日|光|陽|曙|輝|曜/.test(text)) return "SUN";
  if (/moon|night|dusk|shade|shadow|dark|lullaby|sleep|hypno|dream|月|夜|影|暗|夢|眠/.test(text)) return "MOON";
  if (/metal|iron|steel|claw|blade|sword|gear|鐵|鋼|金|刃|劍/.test(text)) return "METAL";
  return null;
}

/** Map canonical 10 elements -> PixelFX 3D palette key. */
export const CANONICAL_TO_PALETTE = Object.freeze({
  METAL: "metal", WOOD: "nature", EARTH: "earth", WATER: "water", FIRE: "fire",
  SUN: "light", ICE: "ice", WIND: "wind", THUNDER: "thunder", MOON: "dark"
});

export const AILMENT_RULES = Object.freeze({
  freezeSeconds: 1.55,
  burnSeconds: 3.6,
  burnDps: 8.5,
  burnAtkScale: 0.85,
  paralyzeSeconds: 3.4,
  paralyzeMoveScale: 0.65,
  paralyzeTwitchInterval: 0.95,
  paralyzeTwitchStun: 0.26,
  poisonSeconds: 4.5,
  poisonMaxStacks: 3,
  poisonHpSharePerSec: [0, 0.014, 0.024, 0.035],
  sleepSeconds: 2.4,
  wetSeconds: 4.0,
  wakeSlapMultiplier: 1.35,
  meltMultiplier: 1.35,
  shatterCritMultiplier: 1.35,
  toxicBlastBonus: 24,
  electroChargeBonus: 16,
  steamBurstBonus: 16,
  ccImmunitySeconds: 3.2
});

export const SURFACE_KINDS = Object.freeze({
  POISON_POOL: "POISON_POOL",
  WATER_PUDDLE: "WATER_PUDDLE",
  ICE_PATCH: "ICE_PATCH",
  FIRE_PATCH: "FIRE_PATCH",
  VINE_PATCH: "VINE_PATCH",
  ELECTRIFIED_WATER: "ELECTRIFIED_WATER",
  MUD_PATCH: "MUD_PATCH"
});

/**
 * Derive balanced status ailment procs from move identity (all 666 moves) & canonical 10 elements.
 * Never overrides explicit move.onHit; adds authentic 6-ailment + wet coverage across all 666 moves.
 */
export function inferMoveAilment(moveId, arenaElement, attackElement, move = null, { isBasic = false } = {}) {
  if (isBasic) return null;
  const text = resolveMoveKeywordText(moveId);
  const el = normalizeCanonicalElement(attackElement ?? arenaElement, moveId);
  if (/sleep|lullaby|hypno|yawn|dream|drowsy|沉眠|催眠|夢霧|夜詠|咒歌|安魂|搖籃/i.test(text)) {
    return { sleep: AILMENT_RULES.sleepSeconds };
  }
  if (/poison|venom|spore|toxic|miasma|sludge|acid|blight|毒|腐沼|腐泥|瘴|孢子|毒漿/i.test(text)) {
    return { poison: AILMENT_RULES.poisonSeconds, poisonStacks: 1 };
  }
  if (/paraly|stun|shock|volt|thunder|arc|落雷|雷陣|電珠|轟雷|電轟|蒼電|雷斬/i.test(text) || el === "THUNDER") {
    return { paralyze: AILMENT_RULES.paralyzeSeconds };
  }
  if (/freeze|glacier|icecage|whiteout|blizz|冰華|極凍|冰原|吹雪|雪崩/i.test(text)) {
    return { root: AILMENT_RULES.freezeSeconds };
  }
  if (/burn|flame|inferno|ember|cinder|fire|火球|焰|烈鎧|熾芯|蒼焰|燭火/i.test(text) || el === "FIRE" || move?.effect === "IGNITE") {
    return { burn: AILMENT_RULES.burnSeconds };
  }
  if (el === "ICE") return { slow: 0.38, slowSeconds: 2.0 };
  if (el === "WATER") return { wet: AILMENT_RULES.wetSeconds, slow: 0.24, slowSeconds: 1.4 };
  if (el === "WOOD") return move?.type === "ZONE" || move?.type === "NOVA" ? { poison: AILMENT_RULES.poisonSeconds, poisonStacks: 1 } : { slow: 0.3, slowSeconds: 1.6 };
  if (el === "MOON") return move?.type === "ZONE" || move?.type === "NOVA" ? { sleep: AILMENT_RULES.sleepSeconds } : { poison: AILMENT_RULES.poisonSeconds, poisonStacks: 1 };
  if (el === "WIND" || el === "SUN") return { slow: 0.28, slowSeconds: 1.4 };
  return null;
}

/**
 * Determine if a move leaves an interactive physical-chemistry ground surface patch on impact/cast.
 * Covers all 666 moves systematically:
 *  - Poison/sludge/oil/spore moves -> POISON_POOL (flammable like gasoline!)
 *  - Water waves/zones/foams/rains -> WATER_PUDDLE (freezable by ICE, electrifiable by THUNDER!)
 *  - Ice waves/zones/spikes/blizzards -> ICE_PATCH (meltable by FIRE/SUN!)
 *  - Fire meteors/zones/novas -> FIRE_PATCH (fannable by WIND, steamable by WATER/ICE!)
 *  - Wood vines/snares/zones/spikes -> VINE_PATCH (ignitable by FIRE into wildfire!)
 *  - Mud/swamp earth moves -> MUD_PATCH (heavy slow!)
 */
export function inferMoveSurfacePatch(moveId, arenaElement, attackElement, move = null, { isBasic = false } = {}) {
  if (isBasic) return null;
  const text = resolveMoveKeywordText(moveId);
  const el = normalizeCanonicalElement(attackElement ?? arenaElement, moveId);
  const v2 = move?.v2Archetype ?? "";
  const type = move?.type ?? "";
  const isAreaOrHeavy = type === "ZONE" || type === "NOVA" || type === "WAVE"
    || v2 === "VORTEX_PULL" || v2 === "METEOR_RAIN" || v2 === "DRAG_WAVE" || v2 === "GROUND_SPIKES" || v2 === "SHOCKWAVE_RING";

  if (/毒沼|毒漿|腐沼|腐泥|毒雨|毒核|瘴霧|孢子|poison|venom|toxic|sludge|miasma|acid|oil|tar|spore/i.test(text)) {
    return { kind: SURFACE_KINDS.POISON_POOL, radius: isAreaOrHeavy ? 88 : 66, ttl: 8.5 };
  }
  if (/泥沼|淤泥|mud|bog|swamp/i.test(text)) {
    return { kind: SURFACE_KINDS.MUD_PATCH, radius: 74, ttl: 7.5 };
  }
  if (el === "WATER" && (isAreaOrHeavy || /水砲|潮|浪|雨|泡|tide|foam|surf|wave/i.test(text))) {
    return { kind: SURFACE_KINDS.WATER_PUDDLE, radius: isAreaOrHeavy ? 92 : 64, ttl: 8.5 };
  }
  if (el === "ICE" && (isAreaOrHeavy || /冰原|冰華|雪崩|霜|blizz|whiteout|glacier|iceCage/i.test(text))) {
    return { kind: SURFACE_KINDS.ICE_PATCH, radius: isAreaOrHeavy ? 88 : 64, ttl: 8.0 };
  }
  if (el === "FIRE" && (isAreaOrHeavy || /火雨|天火|岩漿|熔|inferno|flameRing|coreNova/i.test(text))) {
    return { kind: SURFACE_KINDS.FIRE_PATCH, radius: isAreaOrHeavy ? 86 : 62, ttl: 6.5 };
  }
  if (el === "WOOD" && (isAreaOrHeavy || /荊棘|藤|根|vine|grove|thorn/i.test(text))) {
    return { kind: SURFACE_KINDS.VINE_PATCH, radius: isAreaOrHeavy ? 84 : 62, ttl: 8.0 };
  }
  return null;
}

/**
 * Cross-Ring Ground Surface Physical-Chemistry Reactions!
 *   POISON_POOL + FIRE      -> POISON_IGNITE   (毒沼爆燃! Like gasoline: chain-detonates into huge fiery blast + FIRE_PATCH!)
 *   POISON_POOL + WIND      -> POISON_SPREAD   (毒瘴擴散! Pushes poison pool forward along wind heading!)
 *   POISON_POOL + ICE       -> TOXIC_FROST     (凍毒冰封! Freezes poison pool into chilled ICE_PATCH!)
 *   WATER_PUDDLE + ICE      -> WATER_FREEZE    (水面結冰! Turns puddle to ICE_PATCH + FLASH-FREEZES anyone standing in it!)
 *   WATER_PUDDLE + THUNDER  -> WATER_ELECTRIFY (水域導電! Electrifies puddle + PARALYZES everyone in it!)
 *   WATER_PUDDLE + FIRE     -> STEAM_CLOUD     (沸騰蒸氣爆! Evaporates puddle in scalding blast!)
 *   WATER_PUDDLE + EARTH    -> MUD_BOG         (水土成泥! Turns puddle into heavy-slow MUD_PATCH!)
 *   ICE_PATCH + FIRE/SUN    -> ICE_MELT        (融冰蒸氣! Melts ice patch into WATER_PUDDLE + steam burst!)
 *   FIRE_PATCH + WIND       -> FIRE_FAN        (風助火勢! Spawns forward FIRE_PATCH along wind heading!)
 *   FIRE_PATCH + WATER/ICE  -> STEAM_CLOUD     (澆熄蒸氣爆! Extinguishes fire into steam blast + WATER_PUDDLE!)
 *   VINE_PATCH + FIRE       -> WILDFIRE_IGNITE (野火焚林! Ignites vines into blazing FIRE_PATCH + AoE burn!)
 *   VINE_PATCH + WATER      -> OVERGROW        (蔓生狂長! Expands vine patch radius & duration!)
 *   VINE_PATCH + METAL      -> VINE_SHRED      (斬藤破陣! Slices and removes vine patch!)
 */
export function resolveSurfaceReaction(patch, rawHitElement, hitMoveId = null) {
  if (!patch || patch.done) return null;
  const hitEl = normalizeCanonicalElement(rawHitElement, hitMoveId);
  if (!hitEl) return null;

  if (patch.kind === SURFACE_KINDS.POISON_POOL) {
    if (hitEl === "FIRE") {
      return {
        kind: "POISON_IGNITE",
        chainSameKind: true,
        nextKind: SURFACE_KINDS.FIRE_PATCH,
        nextTtl: 6.0,
        nextRadiusMult: 1.25,
        burstDamage: 42,
        burstRadius: Math.max(118, patch.radius * 1.45),
        knockback: 310,
        status: { burn: AILMENT_RULES.burnSeconds },
        paletteKey: "fire"
      };
    }
    if (hitEl === "WIND") {
      return {
        kind: "POISON_SPREAD",
        spreadForward: true,
        spawnKind: SURFACE_KINDS.POISON_POOL,
        spawnTtl: 6.5,
        paletteKey: "nature"
      };
    }
    if (hitEl === "ICE") {
      return {
        kind: "TOXIC_FROST",
        nextKind: SURFACE_KINDS.ICE_PATCH,
        nextTtl: 6.5,
        nextRadiusMult: 1.0,
        burstDamage: 16,
        burstRadius: patch.radius * 1.1,
        status: { slow: 0.45, slowSeconds: 2.2 },
        paletteKey: "ice"
      };
    }
  }

  if (patch.kind === SURFACE_KINDS.WATER_PUDDLE) {
    if (hitEl === "ICE") {
      return {
        kind: "WATER_FREEZE",
        chainSameKind: true,
        nextKind: SURFACE_KINDS.ICE_PATCH,
        nextTtl: 8.0,
        nextRadiusMult: 1.06,
        burstDamage: 20,
        burstRadius: patch.radius * 1.15,
        status: { root: AILMENT_RULES.freezeSeconds, slow: 0.42, slowSeconds: 2.0 },
        paletteKey: "ice"
      };
    }
    if (hitEl === "THUNDER") {
      return {
        kind: "WATER_ELECTRIFY",
        chainSameKind: true,
        nextKind: SURFACE_KINDS.ELECTRIFIED_WATER,
        nextTtl: 4.5,
        nextRadiusMult: 1.12,
        burstDamage: 28,
        burstRadius: Math.max(115, patch.radius * 1.28),
        status: { paralyze: AILMENT_RULES.paralyzeSeconds },
        paletteKey: "thunder"
      };
    }
    if (hitEl === "FIRE") {
      return {
        kind: "STEAM_CLOUD",
        consume: true,
        burstDamage: 22,
        burstRadius: Math.max(105, patch.radius * 1.25),
        knockback: 230,
        paletteKey: "water"
      };
    }
    if (hitEl === "EARTH") {
      return {
        kind: "MUD_BOG",
        nextKind: SURFACE_KINDS.MUD_PATCH,
        nextTtl: 7.5,
        nextRadiusMult: 1.05,
        burstDamage: 12,
        burstRadius: patch.radius,
        status: { slow: 0.5, slowSeconds: 2.2 },
        paletteKey: "earth"
      };
    }
  }

  if (patch.kind === SURFACE_KINDS.ICE_PATCH) {
    if (hitEl === "FIRE" || hitEl === "SUN") {
      return {
        kind: "ICE_MELT",
        nextKind: SURFACE_KINDS.WATER_PUDDLE,
        nextTtl: 7.5,
        nextRadiusMult: 1.08,
        burstDamage: 20,
        burstRadius: patch.radius * 1.18,
        knockback: 180,
        paletteKey: "water"
      };
    }
  }

  if (patch.kind === SURFACE_KINDS.FIRE_PATCH) {
    if (hitEl === "WIND") {
      return {
        kind: "FIRE_FAN",
        spreadForward: true,
        spawnKind: SURFACE_KINDS.FIRE_PATCH,
        spawnTtl: 5.5,
        burstDamage: 18,
        burstRadius: patch.radius * 1.15,
        status: { burn: AILMENT_RULES.burnSeconds },
        paletteKey: "fire"
      };
    }
    if (hitEl === "WATER" || hitEl === "ICE") {
      return {
        kind: "STEAM_CLOUD",
        nextKind: SURFACE_KINDS.WATER_PUDDLE,
        nextTtl: 5.5,
        nextRadiusMult: 0.95,
        burstDamage: 22,
        burstRadius: Math.max(108, patch.radius * 1.25),
        knockback: 220,
        paletteKey: "water"
      };
    }
  }

  if (patch.kind === SURFACE_KINDS.VINE_PATCH) {
    if (hitEl === "FIRE") {
      return {
        kind: "WILDFIRE_IGNITE",
        chainSameKind: true,
        nextKind: SURFACE_KINDS.FIRE_PATCH,
        nextTtl: 6.0,
        nextRadiusMult: 1.2,
        burstDamage: 34,
        burstRadius: Math.max(112, patch.radius * 1.35),
        knockback: 240,
        status: { burn: AILMENT_RULES.burnSeconds },
        paletteKey: "fire"
      };
    }
    if (hitEl === "WATER") {
      return {
        kind: "OVERGROW",
        growRadiusMult: 1.32,
        extendTtl: 4.5,
        paletteKey: "nature"
      };
    }
    if (hitEl === "METAL") {
      return {
        kind: "VINE_SHRED",
        consume: true,
        burstDamage: 12,
        burstRadius: patch.radius,
        paletteKey: "metal"
      };
    }
  }

  return null;
}

/**
 * Spell-to-Spell Tornado / Vortex Elemental Evolution (cross-ring physical-chemistry combos!).
 */
export function resolveVortexTransform(zone, rawHitElement, hitMoveId = null) {
  if (!zone || !zone.vortexLift || zone.done || zone.evolvedKind) return null;
  const baseEl = normalizeCanonicalElement(zone.canonicalElement ?? zone.arenaElement ?? zone.attackElement, zone.moveId) ?? "WIND";
  const hitEl = normalizeCanonicalElement(rawHitElement, hitMoveId);
  if (!hitEl || hitEl === baseEl) return null;

  if ((baseEl === "WATER" || baseEl === "WIND") && hitEl === "ICE") {
    return {
      kind: "ICE_TORNADO",
      canonicalElement: "ICE",
      paletteKey: "ice",
      radiusMult: 1.14,
      damageMult: 1.3,
      extraDelay: 0.42,
      status: { root: AILMENT_RULES.freezeSeconds, slow: 0.45, slowSeconds: 2.2 },
      freezeGround: true,
      spawnPatch: SURFACE_KINDS.ICE_PATCH
    };
  }
  if ((baseEl === "WIND" || baseEl === "WOOD" || baseEl === "EARTH") && hitEl === "FIRE") {
    return {
      kind: "FIRE_TORNADO",
      canonicalElement: "FIRE",
      paletteKey: "fire",
      radiusMult: 1.24,
      damageMult: 1.35,
      extraDelay: 0.35,
      status: { burn: AILMENT_RULES.burnSeconds },
      igniteGround: true,
      spawnPatch: SURFACE_KINDS.FIRE_PATCH
    };
  }
  if (baseEl === "ICE" && (hitEl === "FIRE" || hitEl === "SUN")) {
    return {
      kind: "STEAM_TORNADO",
      canonicalElement: "WATER",
      paletteKey: "water",
      radiusMult: 1.26,
      damageMult: 1.4,
      extraDelay: 0.1,
      status: { slow: 0.38, slowSeconds: 2.0 },
      spawnPatch: SURFACE_KINDS.WATER_PUDDLE
    };
  }
  if ((baseEl === "WATER" || baseEl === "WIND" || baseEl === "METAL") && hitEl === "THUNDER") {
    return {
      kind: "STORM_TORNADO",
      canonicalElement: "THUNDER",
      paletteKey: "thunder",
      radiusMult: 1.18,
      damageMult: 1.3,
      extraDelay: 0.35,
      status: { paralyze: AILMENT_RULES.paralyzeSeconds },
      spawnPatch: baseEl === "WATER" ? SURFACE_KINDS.ELECTRIFIED_WATER : null
    };
  }
  if ((baseEl === "WIND" || baseEl === "WATER" || baseEl === "WOOD") && hitEl === "MOON") {
    return {
      kind: "MOON_TORNADO",
      canonicalElement: "MOON",
      paletteKey: "dark",
      radiusMult: 1.15,
      damageMult: 1.25,
      extraDelay: 0.4,
      status: { sleep: AILMENT_RULES.sleepSeconds, poison: AILMENT_RULES.poisonSeconds, poisonStacks: 2 },
      spawnPatch: SURFACE_KINDS.POISON_POOL
    };
  }
  if (baseEl === "MOON" && hitEl === "SUN") {
    return {
      kind: "ECLIPSE_BURST",
      canonicalElement: "SUN",
      paletteKey: "light",
      radiusMult: 1.3,
      damageMult: 1.45,
      extraDelay: 0.05,
      status: { slow: 0.45, slowSeconds: 2.2 }
    };
  }
  return null;
}

/**
 * Elemental reaction when an attack strikes one of the 6 organic shield wall materials:
 */
export function resolveWallElementReaction(prop, rawHitElement, hitMoveId = null) {
  if (!prop || prop.destroyed) return null;
  const mat = String(prop.material ?? "").toUpperCase();
  const hitEl = normalizeCanonicalElement(rawHitElement, hitMoveId);
  if (!hitEl) return null;

  if (mat === "WOOD" && hitEl === "FIRE") {
    return { kind: "WOOD_BURN", damageMult: 2.2, igniteRadius: 88, status: { burn: AILMENT_RULES.burnSeconds }, burstDamage: 18, spawnPatch: SURFACE_KINDS.FIRE_PATCH };
  }
  if (mat === "ICE" && (hitEl === "FIRE" || hitEl === "SUN")) {
    return { kind: "ICE_MELT_STEAM", damageMult: 2.4, steamRadius: 112, knockback: 260, burstDamage: 16, spawnPatch: SURFACE_KINDS.WATER_PUDDLE };
  }
  if ((mat === "ICE" || mat === "METAL") && hitEl === "THUNDER") {
    return { kind: "CONDUCT", damageMult: 1.4, conductRadius: 175, status: { paralyze: AILMENT_RULES.paralyzeSeconds }, burstDamage: 20 };
  }
  if (mat === "BASALT" && (hitEl === "WATER" || hitEl === "ICE")) {
    return { kind: "QUENCH_BLAST", damageMult: 2.2, steamRadius: 120, knockback: 280, burstDamage: 22 };
  }
  if (mat === "STONE" && hitEl === "WOOD") {
    return { kind: "ROOT_CRACK", damageMult: 2.0, status: { slow: 0.4, slowSeconds: 2.0 }, burstDamage: 14, spawnPatch: SURFACE_KINDS.VINE_PATCH };
  }
  return null;
}

/**
 * Directional Shield-Wall Shatter Shards!
 * When a melee/lunge/fighting attack (or lethal elemental hit) shatters a temporary shield wall,
 * launch 6 physical directional shards in a tight 54° forward cone along `strikeAngle`.
 */
export function buildWallShatterShards(prop, strikeAngle, attackerTeam, baseDamage = 18) {
  const mat = String(prop?.material ?? "STONE").toUpperCase();
  const count = 6;
  const spread = 0.94; // ~54 degrees focused forward cone
  const profile = mat === "ICE"
    ? { arenaElement: "frost", canonical: "ICE", moveId: "iceShard", speed: 620, range: 290, onHit: { slow: 0.42, slowSeconds: 2.0 }, guardBreak: false }
    : mat === "BASALT"
      ? { arenaElement: "fire", canonical: "FIRE", moveId: "emberBolt", speed: 590, range: 270, onHit: { burn: AILMENT_RULES.burnSeconds }, guardBreak: false }
      : mat === "WOOD"
        ? { arenaElement: "nature", canonical: "WOOD", moveId: "thornVolley", speed: 600, range: 280, onHit: { poison: AILMENT_RULES.poisonSeconds, poisonStacks: 1 }, guardBreak: false }
        : mat === "METAL"
          ? { arenaElement: "physical", canonical: "METAL", moveId: "impactShot", speed: 660, range: 300, onHit: { slow: 0.3, slowSeconds: 1.2 }, guardBreak: true }
          : mat === "CRYSTAL"
            ? { arenaElement: prop?.element ?? "light", canonical: normalizeCanonicalElement(prop?.element) ?? "SUN", moveId: "scatterLight", speed: 640, range: 310, onHit: { slow: 0.32, slowSeconds: 1.4 }, guardBreak: false }
            : { arenaElement: "earth", canonical: "EARTH", moveId: "quakeSlam", speed: 580, range: 275, onHit: { slow: 0.35, slowSeconds: 1.5 }, guardBreak: true };

  const dmg = Math.max(10, Math.round(baseDamage * 0.58));
  const shards = [];
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0;
    const ang = strikeAngle + t * spread;
    const speedJitter = profile.speed * (0.92 + (i % 3) * 0.08);
    shards.push({
      angle: ang,
      vx: Math.cos(ang) * speedJitter,
      vy: Math.sin(ang) * speedJitter,
      damage: dmg,
      range: profile.range,
      radius: 10,
      knockback: 220,
      owner: attackerTeam === "player" ? "player" : "rival",
      kind: attackerTeam === "player" ? "PBOLT" : "RBOLT",
      moveId: profile.moveId,
      arenaElement: profile.arenaElement,
      attackElement: profile.canonical,
      onHit: profile.onHit,
      guardBreak: profile.guardBreak,
      isWallShard: true,
      shardMaterial: mat
    });
  }
  return { material: mat, canonical: profile.canonical, shards };
}
