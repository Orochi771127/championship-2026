// Which kit effect a move plays (OWNER_APPROVED_ADAPTATION 2026-11-05,
// MOVE_VFX_KIT_20261105: 「技能特效能夠多樣一點…藤蔓啊樹啊，或是有一些飛彈」).
//
// A move keeps its approved VFX style; the recipe then picks a more specific
// archetype when the move says what it is. Order of evidence:
//   1. NAME    the approved zh-Hant name names the thing (藤 -> vine, 飛彈 -> missile);
//   2. FAMILY  the original record's effect bank family (rose00 -> vine, missile01 -> missile),
//              used as a design reference only: no original pixel is drawn;
//   3. STYLE   the approved style's default archetype (moveVfxKit.js).
// Presentation only: a recipe never changes a move's power, element, range or timing.
import {moveVfxArchetype, moveVfxArchetypeIsMelee} from './moveVfxKit.js';

// [rule, archetype, guard]. A guard keeps a word to the moves it fits (水砲 is water, not a cannon).
const NAME_RULES = Object.freeze([
  [/藤|蔓|鞭/, 'vine'],
  [/根/, 'roots'],
  [/樹|森|林|神木/, 'tree'],
  [/飛彈|導彈|火箭|齊射/, 'missile'],
  [/機槍|連射|掃射|速射|彈幕/, 'gatling'],
  [/砲|炮/, 'cannon', ({element}) => element === 'METAL' || element === 'EARTH'],
  [/隕|流星/, 'meteor'],
  [/柱|噴泉|火山/, 'pillar'],
  [/龍捲|旋風|颶|渦/, 'tornado'],
  [/箭雨|星雨|光箭/, 'arrows'],
  [/黑洞|深淵|吞噬|侵蝕|虛空/, 'blackhole'],
  [/地刺|冰刺|岩刺|針山|劍山/, 'spikes'],
  [/咬|牙|顎/, 'bite', ({style}) => moveVfxArchetypeIsMelee(moveVfxArchetype(style))],
  // UNIQUE_PIXEL_MOVE_VFX_20261108: the thing a ranged move throws, by name.
  [/手裏劍|手里劍|飛刀|苦無|飛鏢/, 'shuriken', ranged],
  [/鐮|新月|弦月|月刃|月輪/, 'crescent', ranged],
  [/泡/, 'bubble', ranged],
  [/歌|音|聲|鈴|曲|吟|詠|唱|鳴/, 'note', ranged],
  [/羽|翼|翅/, 'feather', ranged],
  [/花|瓣|櫻|薔薇|蕾/, 'petal', ranged],
  [/雪|冰晶|霜晶/, 'snowflake', ranged],
  [/鑽|螺旋|錐/, 'drill', ranged],
  // 星 last: in 星糯泡泡 it only colours the bubbles.
  [/星/, 'star', ranged]
]);
function ranged({style}) { return !moveVfxArchetypeIsMelee(moveVfxArchetype(style)); }
const FAMILY_RULES = Object.freeze([
  [/^rose/, 'vine'],
  [/missile|rocketpunch/, 'missile'],
  [/kikanzyu/, 'gatling'],
  [/tatumaki/, 'tornado'],
  [/genocideattack|abduction/, 'blackhole'],
  [/holyarrow|infinitiarrow/, 'arrows'],
  [/icerock|koorituno|toge/, 'spikes'],
  [/magmaball/, 'meteor']
]);

/**
 * {archetype, source} for one move. `families` are the record's effect bank
 * family names without the e003_ prefix (optional), `element` its effect element.
 */
export function moveVfxRecipe({style = null, element = null, name = '', families = []} = {}) {
  const context = {style, element};
  for (const [rule, archetype, guard] of NAME_RULES) if (rule.test(name ?? '') && (!guard || guard(context))) return Object.freeze({archetype, source: 'NAME'});
  for (const family of families ?? []) for (const [rule, archetype] of FAMILY_RULES) if (rule.test(family ?? '')) return Object.freeze({archetype, source: 'FAMILY'});
  return Object.freeze({archetype: moveVfxArchetype(style), source: 'STYLE'});
}

/** Data Arena pool moves (no record): each gets the effect its mechanic and name describe. */
export const DATA_ARENA_POOL_ARCHETYPE = Object.freeze({
  emberBolt: 'fire', fangRush: 'bite', flameRing: 'pillar', coreNova: 'meteor',
  iceShard: 'shard', frostStep: 'shard', iceCage: 'pillar', frostFan: 'shard', whiteout: 'tornado',
  sunSpear: 'lance', scatterLight: 'arrows', radiantDash: 'pierce', haloPulse: 'pillar', dawnLance: 'lance',
  tideBolt: 'water', tideWave: 'water', foamZone: 'water', surfRush: 'strike', vortex: 'tornado',
  shardVolley: 'shard', quakeSlam: 'quake', brutalCharge: 'strike', shardStorm: 'spikes',
  arcBolt: 'thunder', arcFan: 'thunder', arcField: 'thunder', boltDash: 'pierce', arcStorm: 'thunder',
  seedBolt: 'leaf', vineSnare: 'roots', leafFan: 'leaf', thornRush: 'vine', grovePulse: 'tree',
  shadeBolt: 'orb', shadeStep: 'orb', shadeField: 'blackhole', nightPulse: 'blackhole',
  impactShot: 'missile', impactNova: 'cannon', clawSweep: 'claw'
});
