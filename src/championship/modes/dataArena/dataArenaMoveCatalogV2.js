// Data Arena V2 Move Architecture (2026-11-21).
//
// Re-architects ALL 666 moves (own-31..622, 49 Relay pool moves, basics, and
// 8 Tactical Arts) from the legacy 6-template layout into 14 distinct real-time
// combat archetypes paired 1:1 with pure MIT-licensed patch-gg/pixelfx baked
// animations (moveVfxPieceSprites.js).
//
// Legacy mode (`moveSystem: 'legacy'`) remains 100 % intact and switchable.
// Pure & deterministic: zero DOM, zero Pixi, zero wall-clock reads.

import { moveVfxSignature } from "../../presentation/vfx/moveVfxSignatures.js";
import { moveVfxChoreography } from "../../presentation/vfx/moveVfxChoreography.js";
import { battleMoveName } from "../../text/battleMoveNames.js";
import { relayOwnMove, relayOwnMoveInfo } from "./dataArenaRelayKits.js";
import { battleFxFamilyForm, battleFxMoveBanks } from "../../presentation/battleFx/battleFxRecipes.js";
import battleMoves from "../../../data/championship/catalogs/battle-moves.r1.json" with { type: "json" };

const BATTLE_MOVE_BY_RECORD = new Map(battleMoves.records.map((move) => [move.recordIndex, move]));
/** Form of the effect an own move's record throws (its body bank, else launch): projectile, beam, area, ... */
function ownBodyForm(record) {
  const banks = battleFxMoveBanks(BATTLE_MOVE_BY_RECORD.get(record));
  const body = banks.find((b) => b.role === "body") ?? banks.find((b) => b.role === "launch");
  return body ? battleFxFamilyForm(body.family) : null;
}
import { pb324Move } from "./dataArenaPb324Catalog.js";

export const MOVE_SYSTEMS = Object.freeze(["v2", "legacy"]);

export function normalizeMoveSystem(system) {
  return system === "v2" ? "v2" : "legacy";
}

export const V2_ARCHETYPES = Object.freeze([
  "FLURRY_COMBO",     // Auto-approach sprint -> 3-hit close-range martial-arts combo
  "MULTI_DASH",       // 2-stage rapid flanking dash strikes
  "SHADOW_BACKSTAB",  // Brief untargetable vanish -> blink behind foe -> crit slash
  "UTURN_STRIKE",     // Fast lunge impact -> automatic rebound retreat
  "LEAP_SLAM",        // Parabolic high jump -> aerial dive slam + shockwave + Guard-Break
  "SHOCKWAVE_RING",   // Floor stomp releasing an expanding 360-degree ground shockwave ring
  "GRAB_SLAM",        // Rush-in grab -> lift foe into the air -> violent floor slam
  "TELEKINESIS_SLAM", // Ranged telekinetic levitation -> mid-air hold -> violent floor slam
  "GUARD_BREAK_SLAM", // Heavy committed blow shattering active Guard & Protect Dome
  "STREAM_BEAM",      // Piercing high-speed energy beam / lance stream
  "VOLLEY_BARRAGE",   // Multi-projectile fan / needle / leaf / ice barrage
  "HOMING_ORB",       // Gently steering homing energy orb
  "METEOR_RAIN",      // Sky-drop delayed impact zone with thin reticle
  "DRAG_WAVE",        // Wide advancing wave pushing targets backward
  "VORTEX_PULL",      // Ground vortex pulling nearby foes inward and lifting them midair
  "BURROW_AMBUSH",    // Dive underground (untargetable, 2x weak to shockwave) -> rush mound -> violent eruption launch
  "GROUND_SPIKES",    // Traveling sequential line of jagged 3D elemental spires bursting from the floor
  "SELF_BUFF",        // In-place stat-stage cheer/boost (ATK/SPD or DEF, 2 per stay)
  "PROTECT_COUNTER",  // Raise physical elemental barrier wall + Protect/Counter stance
  "RECOVERY_SUPPORT"  // Capped 30 % Max HP recovery & status cleanse
]);

/**
 * Per-archetype combat feel calibration (PB-Rank x 666-move unified rhythm):
 * ensures every move's range, windup, recovery, projectile/lunge speed, AoE radius,
 * and ground telegraph shape distinctly match its combat identity.
 */
export const V2_ARCHETYPE_COMBAT_TUNING = Object.freeze({
  FLURRY_COMBO:     Object.freeze({ range: 140, windup: 0.13, recovery: 0.20, speed: 920,  radius: 74,  telegraphShape: "sector" }),
  MULTI_DASH:       Object.freeze({ range: 225, windup: 0.14, recovery: 0.20, speed: 1020, radius: 60,  telegraphShape: "rect" }),
  SHADOW_BACKSTAB:  Object.freeze({ range: 320, windup: 0.16, recovery: 0.22, speed: 980,  radius: 72,  telegraphShape: "none" }),
  UTURN_STRIKE:     Object.freeze({ range: 175, windup: 0.14, recovery: 0.18, speed: 940,  radius: 68,  telegraphShape: "rect" }),
  LEAP_SLAM:        Object.freeze({ range: 290, windup: 0.24, recovery: 0.30, speed: 780,  radius: 145, telegraphShape: "circle" }),
  SHOCKWAVE_RING:   Object.freeze({ range: 185, windup: 0.24, recovery: 0.28, speed: 0,    radius: 185, telegraphShape: "circle" }),
  GRAB_SLAM:        Object.freeze({ range: 150, windup: 0.20, recovery: 0.28, speed: 880,  radius: 120, telegraphShape: "sector" }),
  TELEKINESIS_SLAM: Object.freeze({ range: 460, windup: 0.26, recovery: 0.28, speed: 0,    radius: 125, telegraphShape: "circle" }),
  GUARD_BREAK_SLAM: Object.freeze({ range: 175, windup: 0.26, recovery: 0.32, speed: 860,  radius: 118, telegraphShape: "sector" }),
  STREAM_BEAM:      Object.freeze({ range: 780, windup: 0.26, recovery: 0.30, speed: 1180, radius: 15,  telegraphShape: "rect" }),
  VOLLEY_BARRAGE:   Object.freeze({ range: 540, windup: 0.18, recovery: 0.24, speed: 790,  radius: 11,  telegraphShape: "sector" }),
  HOMING_ORB:       Object.freeze({ range: 620, windup: 0.16, recovery: 0.22, speed: 650,  radius: 13,  telegraphShape: "none" }),
  METEOR_RAIN:      Object.freeze({ range: 560, windup: 0.28, recovery: 0.32, speed: 0,    radius: 138, telegraphShape: "circle" }),
  DRAG_WAVE:        Object.freeze({ range: 580, windup: 0.24, recovery: 0.28, speed: 480,  radius: 36,  telegraphShape: "rect" }),
  VORTEX_PULL:      Object.freeze({ range: 520, windup: 0.26, recovery: 0.30, speed: 0,    radius: 132, telegraphShape: "circle" }),
  BURROW_AMBUSH:    Object.freeze({ range: 360, windup: 0.20, recovery: 0.28, speed: 720,  radius: 112, telegraphShape: "rect" }),
  GROUND_SPIKES:    Object.freeze({ range: 480, windup: 0.22, recovery: 0.26, speed: 680,  radius: 92,  telegraphShape: "rect" }),
  SELF_BUFF:        Object.freeze({ range: 0,   windup: 0.14, recovery: 0.18, speed: 0,    radius: 85,  telegraphShape: "none" }),
  PROTECT_COUNTER:  Object.freeze({ range: 0,   windup: 0.10, recovery: 0.16, speed: 0,    radius: 80,  telegraphShape: "none" }),
  RECOVERY_SUPPORT: Object.freeze({ range: 0,   windup: 0.18, recovery: 0.22, speed: 0,    radius: 95,  telegraphShape: "none" })
});

// Map signature / element archetype -> 100% pure patch-gg/pixelfx looping projectile head (`shot-*`)
// (Purged custom mismatched props like fish/xp/heart so every shot speaks one unified pixelfx style!)
const FLIGHT_LOOK_BY_ARCHETYPE = Object.freeze({
  fire: "shot-fire",
  meteor: "shot-fire",
  cannon: "shot-plasma",
  water: "shot-water",
  bubble: "shot-water",
  ice: "shot-ice",
  shard: "shot-ice",
  snowflake: "shot-ice",
  thunder: "shot-laser",
  lance: "shot-laser",
  beam: "shot-laser",
  star: "shot-star",
  holy: "shot-star",
  leaf: "shot-leaf",
  petal: "shot-leaf",
  seed: "shot-leaf",
  vine: "shot-leaf",
  roots: "shot-leaf",
  tree: "shot-leaf",
  wind: "shot-tornado",
  tornado: "shot-tornado",
  feather: "shot-arrow",
  arrows: "shot-arrow",
  shuriken: "shot-disc",
  crescent: "shot-disc",
  gear: "shot-disc",
  missile: "shot-rocket",
  bomb: "shot-fire",
  bullet: "shot-plasma",
  orb: "shot-arcane",
  blackhole: "shot-void",
  dark: "shot-void",
  mist: "shot-wisp",
  heart: "shot-star",
  note: "shot-arcane",
  fish: "shot-water"
});

// Strict whitelist of cohesive, authentic patch-gg/pixelfx impact/set pieces (zero mismatched cartoon props!)
const PURE_PIXELFX_CONTACT_SET = new Set([
  "jaws", "horn", "claws", "core", "fist", "rush", "quake", "spin", "roar", "cross", "slash", "iai",
  "knives", "stream", "wisps", "orb", "splat", "eye", "lance", "rain", "clock", "drop", "bolt",
  "vortex", "vines", "mist", "wave", "ring-burst", "ring-pop", "heal", "cleanse",
  "buff-atk", "buff-def", "buff-spd", "buff-hit", "buff-tol", "flurry-leaf", "flurry-feather", "flurry-shard", "flurry-bubble"
]);

// Map paletteKey -> subtle heavy ground mark (`mark-*`)
const GROUND_LOOK_BY_PALETTE = Object.freeze({
  water: "mark-ripple",
  ice: "mark-frost",
  nature: "mark-roots",
  earth: "prop-dust",
  fire: "prop-dust",
  thunder: "ring-pop",
  light: "sigil-rune",
  dark: "zone-sigil",
  metal: "prop-dust",
  wind: "ring-burst",
  neutral: "prop-dust"
});

// Explicit hand-crafted V2 archetype mapping for all 49 Data Arena pool moves + 9 basics
const POOL_V2_ARCHETYPE = Object.freeze({
  // Fire
  emberBolt: "HOMING_ORB",
  fangRush: "FLURRY_COMBO",
  flameRing: "METEOR_RAIN",
  cinderGuard: "PROTECT_COUNTER",
  coreNova: "METEOR_RAIN",
  // Frost
  iceShard: "VOLLEY_BARRAGE",
  frostStep: "SHADOW_BACKSTAB",
  iceCage: "VORTEX_PULL",
  frostFan: "VOLLEY_BARRAGE",
  glacierGuard: "PROTECT_COUNTER",
  whiteout: "VORTEX_PULL",
  // Light
  sunSpear: "STREAM_BEAM",
  sunShield: "PROTECT_COUNTER",
  scatterLight: "VOLLEY_BARRAGE",
  radiantDash: "MULTI_DASH",
  haloPulse: "SELF_BUFF",
  dawnLance: "STREAM_BEAM",
  // Water
  tideBolt: "HOMING_ORB",
  tideWave: "DRAG_WAVE",
  foamZone: "VORTEX_PULL",
  surfRush: "UTURN_STRIKE",
  tideGuard: "PROTECT_COUNTER",
  vortex: "VORTEX_PULL",
  // Earth
  shardVolley: "GROUND_SPIKES",
  quakeSlam: "SHOCKWAVE_RING",
  brutalCharge: "LEAP_SLAM",
  rockGuard: "PROTECT_COUNTER",
  shardStorm: "VORTEX_PULL",
  // Storm
  arcBolt: "STREAM_BEAM",
  arcFan: "VOLLEY_BARRAGE",
  arcField: "SHOCKWAVE_RING",
  boltDash: "MULTI_DASH",
  stormGuard: "PROTECT_COUNTER",
  arcStorm: "STREAM_BEAM",
  // Nature
  seedBolt: "HOMING_ORB",
  vineSnare: "VORTEX_PULL",
  leafFan: "VOLLEY_BARRAGE",
  thornRush: "GRAB_SLAM",
  barkGuard: "PROTECT_COUNTER",
  grovePulse: "SHOCKWAVE_RING",
  // Shadow
  shadeBolt: "HOMING_ORB",
  shadeStep: "SHADOW_BACKSTAB",
  shadeField: "TELEKINESIS_SLAM",
  duskGuard: "PROTECT_COUNTER",
  nightPulse: "TELEKINESIS_SLAM",
  // Physical / Neutral
  impactShot: "HOMING_ORB",
  clawSweep: "FLURRY_COMBO",
  ironGuard: "PROTECT_COUNTER",
  impactNova: "GRAB_SLAM",
  // Basics
  relaySlash: "FLURRY_COMBO",
  relayPunch: "FLURRY_COMBO",
  relayClaw: "FLURRY_COMBO",
  relayRam: "GUARD_BREAK_SLAM",
  relaySweep: "UTURN_STRIKE",
  relayShot: "HOMING_ORB",
  relayRay: "STREAM_BEAM",
  relayGust: "VOLLEY_BARRAGE",
  relayBreath: "VOLLEY_BARRAGE"
});

const cache = new Map();

/**
 * Classify ANY of the 666 moves (`own-31..622`, numeric record, or 49 pool IDs)
 * into one of the 14 rich V2 combat archetypes + pure patch-gg/pixelfx visual pieces.
 */
export function resolveMoveSpecV2(moveId, baseMove = null) {
  const key = `${moveId}|${baseMove?.type ?? ""}`;
  if (cache.has(key)) return cache.get(key);

  // Wave 8-B: PB-324 original 10-element move catalog resolves directly with exact timing, VFX & hit-feel!
  const pb = pb324Move(moveId);
  if (pb) {
    const v2Archetype = pb.archetype;
    const paletteKey = pb.palette;
    const tuning = V2_ARCHETYPE_COMBAT_TUNING[v2Archetype] ?? V2_ARCHETYPE_COMBAT_TUNING.HOMING_ORB;
    const isUltTier = pb.ultimate;
    const combatRange = pb.range > 0 ? pb.range : Math.round(tuning.range * (isUltTier ? 1.12 : 1));
    const combatRadius = Math.round(tuning.radius * (isUltTier ? 1.18 : 1));
    const combatSpeed = tuning.speed > 0 ? Math.round(tuning.speed * (isUltTier ? 1.08 : 1)) : 0;
    const telegraphShape = isUltTier && tuning.telegraphShape === "none" && combatRange > 0 ? "circle" : tuning.telegraphShape;
    const spec = Object.freeze({
      moveId: pb.id,
      name: pb.nameZh,
      nameEn: pb.nameEn,
      element10: pb.element,
      v2Archetype,
      paletteKey,
      tier: isUltTier ? "ultimate" : "skill",
      melee: ["FLURRY_COMBO", "MULTI_DASH", "SHADOW_BACKSTAB", "UTURN_STRIKE", "LEAP_SLAM", "GRAB_SLAM", "GUARD_BREAK_SLAM"].includes(v2Archetype),
      guardBreak: ["GUARD_BREAK_SLAM", "LEAP_SLAM", "GRAB_SLAM", "TELEKINESIS_SLAM"].includes(v2Archetype),
      homing: v2Archetype === "HOMING_ORB",
      rebound: v2Archetype === "UTURN_STRIKE",
      surfRider: v2Archetype === "DRAG_WAVE" && pb.type === "LUNGE",
      pullForce: v2Archetype === "VORTEX_PULL" ? 235 : 0,
      flurryHits: v2Archetype === "FLURRY_COMBO" ? Math.max(3, pb.multiHit || 3) : 0,
      beamTether: v2Archetype === "STREAM_BEAM",
      laysHazard: v2Archetype === "GROUND_SPIKES",
      spawnsDecoy: false,
      shiftsWeather: isUltTier && ["FIRE", "WATER", "ICE", "EARTH"].includes(pb.element),
      combatRange,
      combatRadius,
      combatWindup: pb.windup,
      combatRecovery: pb.recovery,
      combatSpeed,
      telegraphShape,
      flightLook: "shot-plasma",
      releaseLook: "muzzle",
      contactLook: "core",
      groundLook: GROUND_LOOK_BY_PALETTE[paletteKey] ?? "prop-dust",
      scale: isUltTier ? 1.35 : 1.0,
      hitStopMs: Math.round((pb.hitFeel.hitstop / 60) * 1000),
      pb324: pb
    });
    cache.set(key, spec);
    return spec;
  }

  const own = relayOwnMoveInfo(moveId);
  const ownMatch = /^own-(\d+)$/.exec(String(moveId));
  const recordIdx = own?.record ?? (ownMatch ? Number(ownMatch[1]) : (typeof moveId === "number" ? moveId : null));
  const name = recordIdx !== null ? (battleMoveName(recordIdx) ?? "") : "";
  const sig = moveVfxSignature(moveId);
  const choreo = moveVfxChoreography(moveId);
  const paletteKey = sig?.paletteKey ?? own?.palette ?? "fire";

  let v2Archetype = POOL_V2_ARCHETYPE[moveId] ?? null;
  // ORIGINAL_MOVES_ARENA_20261126: a partner's own shot flies as its original effect did
  // (a lion head, a missile, a thrown spear). Its name never turns it into a ring, a
  // spike line or a lift: the style the original body effect gave it decides.
  const ownType = own ? (relayOwnMove(moveId)?.type ?? null) : null;
  const ownForm = own ? ownBodyForm(own.record) : null;
  if (!v2Archetype && own && ["BOLT", "SPREAD", "WAVE", "LANCE"].includes(baseMove?.type ?? ownType)) {
    const shotType = baseMove?.type ?? ownType;
    if (ownForm === "projectile" || ownForm === "character") {
      v2Archetype = shotType === "SPREAD" || shotType === "LANCE" ? "VOLLEY_BARRAGE" : shotType === "WAVE" ? "DRAG_WAVE" : "HOMING_ORB";
    } else if (ownForm === "beam" && (shotType === "BOLT" || shotType === "LANCE")) v2Archetype = "STREAM_BEAM";
  }

  if (!v2Archetype) {
    const type = baseMove?.type ?? ownType ?? (sig?.melee ? "LUNGE" : "BOLT");
    const rawPiece = choreo?.contact?.piece ?? "";
    const isExplicitShot = /(彈|球|珠|火球|妖火|鬼火|神火|飛彈|導彈|投射|砲|炮|光束|射線|吐息|雷射)$/.test(name);
    // Priority 1: Support, Shield Walls, Buffs (absorbs former Tactical Arts cleanly into native 666 moves!)
    if (/癒|療|回復|恢復|治療|再生|祝福|聖療|甦醒|光合|晨光|吸取|吸血|回春/.test(name)) v2Archetype = "RECOVERY_SUPPORT";
    else if (/盾|壁|護|屏障|結界|鐵壁|光牆|壁壘|反擊|鏡面|守住/.test(name) || type === "BARRIER") v2Archetype = "PROTECT_COUNTER";
    else if (/勉|鼓舞|激勵|增幅|蓄力|凝聚|戰舞|劍舞|龍舞|氣合|威嚇|祈願|強化|祈禱|冥想|充能|沸騰|超載/.test(name)) v2Archetype = "SELF_BUFF";
    // Priority 2: Signature 3D Volumetric Moves (Burrow, Ground Spikes, Waves, Tornado/Storm Vortexes) & Ranged Beams/Volleys/Meteors
    else if (/鑽地|潛地|挖洞|地底|地行|遁地|穿地|潛襲|潛行|掘|伏擊|潛影|潛突|深潛/.test(name)) v2Archetype = "BURROW_AMBUSH";
    else if (/地刺|尖石|岩棘|岩刺|石棘|石筍|冰柱|冰棘|荊棘|藤刺|棘刺|根刺|破土|突岩|裂岩|岩柱|岩槍|碎岩|刺突|地牙|岩牙|冰牙|根芽|撒菱|毒菱|地釘|陷阱/.test(name)) v2Archetype = "GROUND_SPIKES";
    else if (/旋風|龍捲|颶風|風暴|裂風|渦|漩|黑洞|吞噬|吹雪|藤縛|束縛|領域|牢籠/.test(name)) v2Archetype = "VORTEX_PULL";
    else if (/浪|潮|海嘯|洪|濤|沖流|巨浪|奔流/.test(name) && !/刃|斬|落雷|天雷/.test(name) || type === "WAVE") v2Archetype = "DRAG_WAVE";
    else if (/砲|炮|光束|射線|吐息|雷射|死光|貫光|極光|魔光|雷砲/.test(name) || type === "LANCE") v2Archetype = "STREAM_BEAM";
    else if (/飛彈|導彈|投射|羽刃|葉刃|針雨|棘針|飛刀|手裏劍|亂射|彈幕|齊射|碎晶|冰錐|火花|星雨|棘舞/.test(name) || type === "SPREAD") v2Archetype = "VOLLEY_BARRAGE";
    else if (/天墜|墜擊|俯衝|飛撲|泰山|壓頂|飛踢|天翔擊|空墜|躍擊|跳斬|重砸/.test(name)) v2Archetype = "LEAP_SLAM";
    else if (/天雷|落雷|隕石|星墜|落石|火雨|毒雨|箭雨|冰雨|酸雨|流星雨|轟雷|天火|隕落/.test(name)) v2Archetype = "METEOR_RAIN";
    // Priority 3: Signature Physical / Psychic / Sonic Archetypes
    else if (/念|超能|精神|重力|浮空|支配|心靈|念動|提線|操線|神諭|刻時|引力|催眠/.test(name) && !isExplicitShot && !/爪$/.test(name)) v2Archetype = "TELEKINESIS_SLAM";
    else if (/摔|投擲|過肩|抱摔|擒拿|絞殺|抓摔|猛摔|壓制/.test(name)) v2Archetype = "GRAB_SLAM";
    else if (/震地|地震|衝擊波|音波|咆哮|獅吼|烈吼|怒吼|嚎|震盪|大地|霜踏|踐踏|震波|吼/.test(name)) v2Archetype = "SHOCKWAVE_RING";
    else if (isExplicitShot) v2Archetype = "HOMING_ORB";
    // Priority 4: Martial Arts, Ambush, Mobility & Heavy Guard-Breaks
    else if (/影閃|瞬斬|夜刃|背襲|暗殺|幽刃|幻爪|閃襲|影步|霧閃|影|瞬|夜/.test(name) && (sig?.melee || type === "LUNGE" || type === "BLINK" || /爪|刃|斬/.test(name))) v2Archetype = "SHADOW_BACKSTAB";
    else if (/連打|連擊|連斬|連爪|連啄|亂舞|百裂|連踢|爪|牙|咬|啃|剪|掌|拳|踢/.test(name) && !/重拳|重擊/.test(name)) v2Archetype = "FLURRY_COMBO";
    else if (/迴旋|折返|燕返|掠擊|翼斬|迴翔|疾掠|翼|飛/.test(name) && (sig?.melee || type === "LUNGE")) v2Archetype = "UTURN_STRIKE";
    else if (/突刺|角刺|角衝|雷突|猛衝|突進|衝刺|疾衝|極速|神速|電光|衝/.test(name) && (sig?.melee || type === "LUNGE")) v2Archetype = "MULTI_DASH";
    else if (/聖裁|審判|聖斬|破甲|碎岩|碎|破|重拳|重擊|重裝|鎚|錘|崩|裂地|粉碎|斷|劈|斬|刃|劍|刀/.test(name)) v2Archetype = "GUARD_BREAK_SLAM";
    // Priority 5: Balanced piece-driven fallback (never over-packs a single archetype!)
    else if (type === "ZONE") v2Archetype = (rawPiece === "vortex" || rawPiece === "vines" || rawPiece === "mist") ? "VORTEX_PULL" : rawPiece === "quake" ? "SHOCKWAVE_RING" : "METEOR_RAIN";
    else if (type === "NOVA") v2Archetype = (rawPiece === "roar" || rawPiece === "quake" || rawPiece === "ring-burst") ? "SHOCKWAVE_RING" : (rawPiece === "vortex" || rawPiece === "vines" || rawPiece === "mist") ? "VORTEX_PULL" : (rawPiece === "claws" || rawPiece === "slash" || rawPiece === "fist") ? "FLURRY_COMBO" : "SHOCKWAVE_RING";
    else if (type === "LUNGE") v2Archetype = (rawPiece === "quake" || rawPiece === "drop") ? "LEAP_SLAM" : rawPiece === "roar" ? "SHOCKWAVE_RING" : rawPiece === "fist" ? "GRAB_SLAM" : (rawPiece === "claws" || rawPiece === "slash" || rawPiece === "jaws") ? "FLURRY_COMBO" : rawPiece === "spin" ? "UTURN_STRIKE" : (rawPiece === "cross" || rawPiece === "iai") ? "SHADOW_BACKSTAB" : "MULTI_DASH";
    else v2Archetype = (rawPiece === "lance" || rawPiece === "stream" || rawPiece === "bolt") ? "STREAM_BEAM" : (rawPiece === "knives" || rawPiece === "rain" || rawPiece === "flurry") ? "VOLLEY_BARRAGE" : rawPiece === "wave" ? "DRAG_WAVE" : rawPiece === "drop" ? "METEOR_RAIN" : rawPiece === "roar" ? "SHOCKWAVE_RING" : "HOMING_ORB";
  }

  // Pick pure patch-gg/pixelfx flight look with strict element-coherence guard!
  const defaultFlightByPalette = {
    fire: "shot-fire",
    water: "shot-water",
    ice: "shot-ice",
    thunder: "shot-laser",
    nature: "shot-leaf",
    dark: "shot-void",
    light: "shot-star",
    wind: "shot-tornado",
    earth: "shot-plasma",
    metal: "shot-rocket",
    neutral: "shot-plasma"
  };
  let flightLook = FLIGHT_LOOK_BY_ARCHETYPE[sig?.archetype] ?? defaultFlightByPalette[paletteKey] ?? "shot-plasma";
  if (flightLook === "shot-leaf" && !["nature", "wind"].includes(paletteKey)) flightLook = defaultFlightByPalette[paletteKey] ?? "shot-plasma";
  if (flightLook === "shot-water" && !["water", "ice"].includes(paletteKey)) flightLook = defaultFlightByPalette[paletteKey] ?? "shot-plasma";
  if (flightLook === "shot-ice" && !["ice", "earth", "metal"].includes(paletteKey)) flightLook = defaultFlightByPalette[paletteKey] ?? "shot-plasma";

  const defaultContactByArch = {
    FLURRY_COMBO: "claws",
    MULTI_DASH: "rush",
    SHADOW_BACKSTAB: "iai",
    UTURN_STRIKE: "spin",
    LEAP_SLAM: "quake",
    SHOCKWAVE_RING: "ring-burst",
    GRAB_SLAM: "fist",
    TELEKINESIS_SLAM: "orb",
    GUARD_BREAK_SLAM: "quake",
    STREAM_BEAM: "lance",
    VOLLEY_BARRAGE: "knives",
    HOMING_ORB: "core",
    METEOR_RAIN: "drop",
    DRAG_WAVE: "wave",
    VORTEX_PULL: "vortex",
    BURROW_AMBUSH: "quake",
    GROUND_SPIKES: "quake",
    SELF_BUFF: "buff-atk",
    PROTECT_COUNTER: "buff-tol",
    RECOVERY_SUPPORT: "heal"
  };
  const defaultContactByPalette = {
    fire: "core",
    water: "wave",
    ice: "flurry-shard",
    thunder: "bolt",
    nature: "flurry-leaf",
    dark: "orb",
    light: "lance",
    wind: "spin",
    earth: "quake",
    metal: "slash",
    neutral: "fist"
  };

  let contactLook = choreo?.contact?.piece ?? defaultContactByArch[v2Archetype] ?? "core";
  // Resolve flurry/drop cleanly and purge ANY non-pixelfx custom props (mushrooms/bombs/gears/hearts/notes)!
  if (contactLook === "flurry") {
    const sp = choreo?.contact?.sprite;
    contactLook = sp === "feather_sm" ? "flurry-feather" : sp === "shard" ? "flurry-shard" : sp === "bubble_sm" ? "flurry-bubble"
      : (sp === "leaf" || sp === "petal") ? "flurry-leaf" : (defaultContactByArch[v2Archetype] ?? "core");
  } else if (contactLook === "drop") {
    contactLook = "drop";
  }
  // Strict element-coherence guard: never play leaves on thunder/fire, vines on earth/ice, bubbles on fire/light, or ice shards on fire!
  if ((contactLook === "flurry-leaf" || contactLook === "vines") && !["nature", "wind"].includes(paletteKey)) {
    contactLook = defaultContactByPalette[paletteKey] ?? defaultContactByArch[v2Archetype] ?? "core";
  }
  if ((contactLook === "flurry-bubble" || contactLook === "wave") && !["water", "ice"].includes(paletteKey)) {
    contactLook = defaultContactByPalette[paletteKey] ?? defaultContactByArch[v2Archetype] ?? "core";
  }
  if (contactLook === "flurry-shard" && !["ice", "earth", "metal"].includes(paletteKey)) {
    contactLook = defaultContactByPalette[paletteKey] ?? defaultContactByArch[v2Archetype] ?? "core";
  }
  if (!PURE_PIXELFX_CONTACT_SET.has(contactLook)) {
    contactLook = defaultContactByArch[v2Archetype] ?? "core";
  }

  const releaseLook = v2Archetype === "SELF_BUFF" ? "buff-spd"
    : v2Archetype === "PROTECT_COUNTER" ? "buff-def"
      : v2Archetype === "RECOVERY_SUPPORT" ? "cleanse"
        : v2Archetype === "FLURRY_COMBO" ? "slash"
          : v2Archetype === "SHADOW_BACKSTAB" ? "cross"
            : v2Archetype === "MULTI_DASH" ? "horn"
              : v2Archetype === "LEAP_SLAM" ? "rush"
                : v2Archetype === "SHOCKWAVE_RING" ? "ring-pop"
                  : v2Archetype === "GRAB_SLAM" ? "fist"
                    : v2Archetype === "TELEKINESIS_SLAM" ? "sigil-rune"
                      : (sig?.tier === "ultimate" ? "muzzle-spiral" : "muzzle");

  const groundLook = GROUND_LOOK_BY_PALETTE[paletteKey] ?? "prop-dust";
  const tier = sig?.tier ?? "skill";
  const tuning = V2_ARCHETYPE_COMBAT_TUNING[v2Archetype] ?? V2_ARCHETYPE_COMBAT_TUNING.HOMING_ORB;
  const isUltTier = tier === "ultimate";
  const isBasicTier = tier === "basic";
  const combatRange = Math.round(tuning.range * (isUltTier ? 1.12 : 1));
  const combatRadius = Math.round(tuning.radius * (isUltTier ? 1.18 : 1));
  const combatWindup = Number((tuning.windup * (isBasicTier ? 0.85 : 1) + (isUltTier ? 0.05 : 0)).toFixed(2));
  const combatRecovery = Number((tuning.recovery * (isBasicTier ? 0.85 : 1) + (isUltTier ? 0.04 : 0)).toFixed(2));
  const combatSpeed = tuning.speed > 0 ? Math.round(tuning.speed * (isUltTier ? 1.08 : 1)) : 0;
  const telegraphShape = isUltTier && tuning.telegraphShape === "none" && tuning.range > 0
    ? "circle"
    : tuning.telegraphShape;

  const spec = Object.freeze({
    moveId,
    name,
    v2Archetype,
    paletteKey,
    tier,
    melee: ["FLURRY_COMBO", "MULTI_DASH", "SHADOW_BACKSTAB", "UTURN_STRIKE", "LEAP_SLAM", "GRAB_SLAM", "GUARD_BREAK_SLAM"].includes(v2Archetype),
    guardBreak: ["GUARD_BREAK_SLAM", "LEAP_SLAM", "GRAB_SLAM", "TELEKINESIS_SLAM"].includes(v2Archetype),
    homing: v2Archetype === "HOMING_ORB",
    rebound: v2Archetype === "UTURN_STRIKE",
    surfRider: Boolean(moveId === "surfRush" || /衝浪|踏浪|乘浪/.test(name) || (v2Archetype === "DRAG_WAVE" && (baseMove?.type === "LUNGE" || sig?.melee))),
    pullForce: v2Archetype === "VORTEX_PULL" ? 235 : 0,
    flurryHits: v2Archetype === "FLURRY_COMBO" ? 3 : 0,
    beamTether: v2Archetype === "STREAM_BEAM",
    laysHazard: Boolean(v2Archetype === "GROUND_SPIKES" || /菱|釘|陷阱|地雷|隱形岩|撒/.test(name)),
    spawnsDecoy: Boolean(/替身|分身|幻影|殘影|鏡像|假身|迷幻/.test(name)),
    shiftsWeather: Boolean(/烈日|晴天|祈雨|暴雨|豪雨|吹雪|冰雹|暴風雪|沙暴|砂嵐|沙塵/.test(name) || ["whiteout", "flameRing", "coreNova", "shardStorm", "vortex"].includes(moveId)),
    combatRange,
    combatRadius,
    combatWindup,
    combatRecovery,
    combatSpeed,
    telegraphShape,
    flightLook,
    releaseLook,
    contactLook,
    groundLook,
    scale: choreo?.contact?.scale ?? (isUltTier ? 1.35 : 1.0),
    hitStopMs: choreo?.hitStopMs ?? (isUltTier ? 105 : ["GUARD_BREAK_SLAM", "LEAP_SLAM", "GRAB_SLAM", "TELEKINESIS_SLAM", "BURROW_AMBUSH"].includes(v2Archetype) ? 65 : 55)
  });

  cache.set(key, spec);
  return spec;
}

const calibratedMoveCache = new WeakMap();
/**
 * Apply calibrated V2 per-archetype x tier range, windup, recovery, speed & radius
 * onto a base RELAY skill/ultimate move without mutating shared config objects.
 */
export function calibrateV2Move(moveId, baseMove, { ultimate = false } = {}) {
  if (!baseMove || (baseMove.energy ?? 0) <= 0) return baseMove;
  let byKey = calibratedMoveCache.get(baseMove);
  if (!byKey) { byKey = new Map(); calibratedMoveCache.set(baseMove, byKey); }
  const cacheKey = `${moveId}|${ultimate ? 1 : 0}`;
  if (byKey.has(cacheKey)) return byKey.get(cacheKey);
  const spec = resolveMoveSpecV2(moveId, baseMove);
  const next = { ...baseMove };
  if (spec.combatWindup > 0) next.windup = spec.combatWindup;
  if (spec.combatRecovery > 0) next.recovery = spec.combatRecovery;
  if (spec.combatRange > 0) {
    if (baseMove.type === "LUNGE") next.distance = Math.max(baseMove.distance ?? 0, spec.combatRange);
    else next.range = spec.combatRange;
  }
  if (spec.combatSpeed > 0 && typeof baseMove.speed === "number") next.speed = spec.combatSpeed;
  if (spec.combatRadius > 0 && (baseMove.type === "ZONE" || baseMove.type === "NOVA")) {
    next.radius = Math.max(baseMove.radius ?? 0, spec.combatRadius);
  }
  next.telegraphShape = spec.telegraphShape;
  // A move staged one at a time keeps the numbers taken from its reference (windup, speed, ...).
  if (baseMove.stagedTuning) Object.assign(next, baseMove.stagedTuning);
  const frozen = Object.freeze(next);
  byKey.set(cacheKey, frozen);
  return frozen;
}
