// Owner-authored rules for RELAY only. No source-game IDs, PP, stats or code.
// The existing creature binding and the canonical save remain authoritative.
import { DATA_ARENA_PARTNERS, DATA_ARENA_MOVES, DATA_ARENA_KITS } from './dataArenaConfig.js';
import { RELAY_ROSTER, relayPartner } from './dataArenaRelayRoster.js';
import { RELAY_POOL_MOVE_ELEMENT, relayOwnMove, relayOwnMoveInfo, relaySpeciesKit } from './dataArenaRelayKits.js';
import { RELAY_PALETTE_ELEMENT } from './dataArenaRelayElements.js';

export const DATA_ARENA_RELAY = Object.freeze({ seconds: 150, switchCooldown: 6, knockoutSeconds: 1.1,
  tpMax: 100, tpRegen: 16, tpDelay: 0.6, ultimateTp: 80, ultimateCooldown: 12, playerHpScale: 1.8, rivalHpScale: 0.55 });

// Anatomy-specific intentions, using approved existing action clips. These are
// presentation adapters, not claims that new eight-direction drawings exist.
export const RELAY_ACTION_PROFILES = Object.freeze({
  ...Object.fromEntries(RELAY_ROSTER.map(p=>[p.id,p.action])),
  'ember-lizard': Object.freeze({ basic: 'relayClaw', intent: 'claw-and-bite', thrust: 10, lift: 0, releaseSlot: 1, melee: 7, ranged: 8, burst: 10 }),
  'corona-cub': Object.freeze({ basic: 'relayRay', intent: 'crest-projection', thrust: 2, lift: 4, releaseSlot: 1, melee: 9, ranged: 8, burst: 7 }),
  'frost-drake': Object.freeze({ basic: 'relayBreath', intent: 'breath', thrust: 4, lift: 1, releaseSlot: 1, melee: 7, ranged: 8, burst: 10 })
});
const basics = Object.freeze({
  relaySlash: { type:'LUNGE',energy:0,cooldown:.65,windup:.18,recovery:.24,distance:84,speed:430,width:86,damage:18 },
  relayPunch: { type:'LUNGE',energy:0,cooldown:.55,windup:.14,recovery:.2,distance:64,speed:500,width:60,damage:17 },
  relayShot: { type:'BOLT',energy:0,cooldown:.7,windup:.24,recovery:.28,range:650,speed:850,radius:10,damage:14 },
  relayGust: { type:'SPREAD',energy:0,cooldown:.8,windup:.2,recovery:.3,range:410,speed:630,radius:8,damage:7,count:2,spread:.25 },
  relaySweep: { type:'NOVA',energy:0,cooldown:.85,windup:.25,recovery:.3,radius:92,damage:18,effect:'NONE' },
  relayRam: { type:'LUNGE',energy:0,cooldown:.8,windup:.25,recovery:.3,distance:110,speed:520,width:68,damage:21 },
  relayClaw: { type: 'LUNGE', energy: 0, cooldown: 0.6, windup: 0.14, recovery: 0.24, distance: 72, speed: 430, width: 70, damage: 18 },
  relayRay: { type: 'BOLT', energy: 0, cooldown: 0.65, windup: 0.18, recovery: 0.26, range: 570, speed: 790, radius: 9, damage: 13 },
  relayBreath: { type: 'SPREAD', energy: 0, cooldown: 0.8, windup: 0.22, recovery: 0.3, range: 370, speed: 570, radius: 9, damage: 6, count: 3, spread: 0.38 }
});
const extraMoves = Object.freeze({
  arcBolt:{type:'BOLT',energy:18,cooldown:1.2,windup:.22,range:650,speed:900,radius:10,damage:23},
  arcFan:{type:'SPREAD',energy:26,cooldown:3.5,windup:.24,range:500,speed:850,radius:8,damage:11,count:5,spread:.85},
  arcField:{type:'ZONE',energy:28,cooldown:6,windup:.25,range:520,radius:110,delay:.8,damage:29,effect:'SLOW',slow:.4,slowSeconds:1.2},
  arcStorm:{type:'LANCE',windup:.6,range:800,speed:1000,radius:16,damage:34,count:5,spread:.65,pierce:3},
  seedBolt:{type:'BOLT',energy:16,cooldown:1,windup:.2,range:570,speed:630,radius:11,damage:21},
  vineSnare:{type:'ZONE',energy:28,cooldown:6,windup:.22,range:500,radius:105,delay:.8,damage:22,effect:'ROOT',rootSeconds:1.2},
  leafFan:{type:'SPREAD',energy:24,cooldown:3,windup:.24,range:480,speed:700,radius:9,damage:12,count:4,spread:.65},
  grovePulse:{type:'NOVA',windup:.65,radius:245,damage:58,effect:'ROOT',rootSeconds:1.3},
  shadeBolt:{type:'BOLT',energy:18,cooldown:1.2,windup:.22,range:640,speed:690,radius:12,damage:23},
  shadeStep:{type:'BLINK',energy:22,cooldown:4.5,windup:.16,distance:260},
  shadeField:{type:'ZONE',energy:28,cooldown:6,windup:.24,range:520,radius:120,delay:.85,damage:28,effect:'SLOW',slow:.4,slowSeconds:1.5},
  nightPulse:{type:'NOVA',windup:.65,radius:250,damage:64,effect:'SLOW',slow:.4,slowSeconds:1.5},
  impactShot:{type:'BOLT',energy:18,cooldown:1.3,windup:.24,range:520,speed:640,radius:13,damage:25,knockback:170},
  impactNova:{type:'NOVA',windup:.7,radius:230,damage:74,effect:'NONE'},
  cinderGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.2, radius:60, arc:2.2 },
  clawSweep: { type:'NOVA', energy:18, cooldown:3, windup:.2, radius:105, damage:24, effect:'NONE' },
  radiantDash: { type:'LUNGE', energy:22, cooldown:4.5, windup:.2, distance:230, speed:1050, width:56, damage:27, invulnerable:true },
  haloPulse: { type:'NOVA', energy:28, cooldown:5, windup:.3, radius:155, damage:29, effect:'NONE' },
  frostFan: { type:'SPREAD', energy:22, cooldown:2.6, windup:.24, range:450, speed:650, radius:9, damage:11, count:4, spread:.65, onHit:{slow:.3,slowSeconds:1.2}, onTerrain:'FREEZE' },
  glacierGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.4, radius:64, arc:2.2 },
  // Same-element replacements for the guards and dashes pools used to borrow
  // from other elements (2026-10-28): numbers copied from the borrowed move.
  tideGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.4, radius:64, arc:2.2 },
  rockGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.2, radius:60, arc:2.2 },
  stormGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.4, radius:64, arc:2.2 },
  barkGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.4, radius:64, arc:2.2 },
  duskGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.2, radius:60, arc:2.2 },
  ironGuard: { type:'BARRIER', energy:20, cooldown:7, windup:.16, duration:1.4, radius:64, arc:2.2 },
  boltDash: { type:'LUNGE', energy:22, cooldown:4.5, windup:.2, distance:230, speed:1050, width:56, damage:27, invulnerable:true },
  thornRush: { type:'LUNGE', energy:22, cooldown:6, windup:.55, distance:300, speed:950, width:56, damage:24 }
});
// A roster partner's five choices: its own moves first, then its element pool.
const RELAY_SPECIES_KITS = Object.freeze(Object.fromEntries(RELAY_ROSTER.map(p=>[p.id,relaySpeciesKit(p.speciesIndex,p.element,id=>relayMove(id)?.type)])));
export const RELAY_LOADOUTS = Object.freeze({
  ...Object.fromEntries(RELAY_ROSTER.map(p=>[p.id,RELAY_SPECIES_KITS[p.id].moves])),
  'ember-lizard': Object.freeze(['emberBolt','fangRush','flameRing','cinderGuard','clawSweep']),
  'corona-cub': Object.freeze(['sunSpear','sunShield','scatterLight','radiantDash','haloPulse']),
  'frost-drake': Object.freeze(['iceShard','frostStep','iceCage','frostFan','glacierGuard'])
});
export function relayKit(partnerId, selection) {
  const allowed = RELAY_LOADOUTS[partnerId], base = DATA_ARENA_KITS[partnerId] ?? RELAY_SPECIES_KITS[partnerId];
  if (!allowed || !base) throw new RangeError('RELAY_UNKNOWN_PARTNER');
  const moves = [...new Set((Array.isArray(selection) ? selection : []).filter(id => allowed.includes(id)))];
  for (const id of base.moves) if (!moves.includes(id)) moves.push(id);
  return {moves:moves.slice(0,3),ultimate:base.ultimate};
}
// Three pilot characters have visually reviewed slots. The other anatomy-based
// mappings remain provisional; new art does not change simulation or species IDs.
export function relaySequence(partnerId, moveId) {
  const p=RELAY_ACTION_PROFILES[partnerId]; if(!p)return 7;
  const type=relayMove(moveId)?.type;
  return type==='LUNGE'?p.melee:['BOLT','SPREAD','LANCE','WAVE'].includes(type)?p.ranged:p.burst;
}
const styles = Object.freeze({
  storm: Object.freeze({tint:0xbfc4ff,texture:'relayLance',cue:'ray'}),
  nature: Object.freeze({tint:0x98e694,texture:'relayCrystal',cue:'frost'}),
  shadow: Object.freeze({tint:0xc18aff,texture:'relayFlame',cue:'flame'}),
  earth: Object.freeze({tint:0xd5b18a,texture:'relayCrystal',cue:'claw'}),
  fire: Object.freeze({tint:0xff9646,texture:'relayFlame',cue:'flame'}),
  light: Object.freeze({tint:0xffe48e,texture:'relayLance',cue:'ray'}),
  frost: Object.freeze({tint:0x9fe8ff,texture:'relayCrystal',cue:'frost'}),
  claw: Object.freeze({tint:0xffba73,texture:'relaySlash',cue:'claw'}),
  water: Object.freeze({tint:0x7cdace,texture:'wave',cue:'splash'}),
  toxic: Object.freeze({tint:0xb98ae6,texture:'relayCrystal',cue:'splash'})
});
// Stage two looks (2026-10-28): every move draws as one of the 23 approved VFX
// styles. `impact` names the hit burst, `tether` draws a beam from the caster
// to the shot. Presentation only: no rule reads this table.
const STYLE_LOOKS = Object.freeze({
  strike:{texture:'relaySlash',impact:'star'}, claw:{texture:'relaySlash',impact:'star'}, slash:{texture:'relaySlash',impact:'star'},
  pierce:{texture:'relayLance',impact:'star'}, vine:{texture:'relayThorn',impact:'leaf'}, thorn:{texture:'relayThorn',impact:'leaf'},
  leaf:{texture:'relayLeaf',impact:'leaf'}, seed:{texture:'relaySeed',impact:'leaf'}, spore:{texture:'relaySpore',impact:'puff'},
  missile:{texture:'relayMissile',impact:'blast'}, gatling:{texture:'relayBullet',impact:'spark'}, shell:{texture:'relayCrystal',impact:'spark'},
  fireball:{texture:'relayFlame',impact:'ember'}, flame:{texture:'relayFlame',impact:'ember'}, water:{texture:'relayDrop',impact:'drop'},
  ice:{texture:'relayCrystal',impact:'shard'}, thunder:{texture:'relayBolt',impact:'spark',tether:true}, quake:{texture:'relayRock',impact:'rock'},
  wind:{texture:'relayWind',impact:'puff'}, holy:{texture:'relayLance',impact:'star',tether:true}, dark:{texture:'relayOrb',impact:'puff'},
  sound:{texture:'relayRing',impact:'ring'}, beam:{texture:'relayLance',impact:'star',tether:true}
});
const POOL_STYLE = Object.freeze({
  emberBolt:'fireball', fangRush:'pierce', flameRing:'flame', cinderGuard:'shell', clawSweep:'claw', coreNova:'flame',
  iceShard:'ice', frostStep:'ice', iceCage:'ice', frostFan:'ice', glacierGuard:'shell', whiteout:'ice',
  sunSpear:'holy', sunShield:'shell', scatterLight:'holy', radiantDash:'pierce', haloPulse:'holy', dawnLance:'beam',
  tideBolt:'water', tideWave:'water', foamZone:'water', surfRush:'strike', tideGuard:'shell', vortex:'water',
  shardVolley:'ice', quakeSlam:'quake', brutalCharge:'strike', rockGuard:'shell', shardStorm:'ice',
  arcBolt:'thunder', arcFan:'thunder', arcField:'thunder', boltDash:'pierce', stormGuard:'shell', arcStorm:'thunder',
  seedBolt:'seed', vineSnare:'vine', leafFan:'leaf', thornRush:'thorn', barkGuard:'shell', grovePulse:'vine',
  shadeBolt:'dark', shadeStep:'dark', shadeField:'dark', duskGuard:'shell', nightPulse:'dark',
  impactShot:'missile', ironGuard:'shell', impactNova:'quake',
  relaySlash:'slash', relayPunch:'strike', relaySweep:'claw', relayRam:'strike', relayClaw:'claw'
});
// Ranged basics are shared by many partners, so they take the caster's element.
const ELEMENT_SHOT = Object.freeze({ fire:'fireball', frost:'ice', light:'holy', water:'water', earth:'quake', storm:'thunder', nature:'seed', shadow:'dark', physical:'gatling' });
const ELEMENT_LOOK = Object.freeze({ fire:'fire', frost:'frost', light:'light', water:'water', earth:'earth', storm:'storm', nature:'nature', shadow:'shadow', physical:'claw' });
const RANGED_BASICS = new Set(['relayShot','relayRay','relayBreath','relayGust']);
const paletteStyle = Object.freeze({ fire:'fire', water:'water', ice:'frost', thunder:'storm', wind:'storm', light:'light', dark:'shadow',
  nature:'nature', toxic:'toxic', earth:'earth', metal:'earth', neutral:'claw', psychic:'light' });
const look = (base, style) => Object.freeze({ ...base, style, ...STYLE_LOOKS[style] });
/**
 * The element a hit carries against cover (stage three): an own move's colour,
 * a pool move's element, ranged basics take the caster's; body moves are physical.
 */
export function relayMoveElement(id, casterElement = null) {
  const own = relayOwnMoveInfo(id);
  if(own)return RELAY_PALETTE_ELEMENT[own.palette] ?? 'physical';
  const element = RELAY_POOL_MOVE_ELEMENT[id];
  if(element)return element === 'neutral' ? 'physical' : element;
  if(RANGED_BASICS.has(id))return casterElement ?? 'physical';
  return basics[id] ? 'physical' : casterElement ?? 'physical';
}
/** Colour, texture, cue, style, impact and tether for a move; `element` is the caster's (for basics). */
export function relayEffectStyle(id, element = null) {
  const own = relayOwnMoveInfo(id);
  if(own)return look(styles[paletteStyle[own.palette] ?? 'claw'], own.style);
  if(element && styles[ELEMENT_LOOK[element]] && (RANGED_BASICS.has(id) || /^relay/.test(id)))
    return look(styles[ELEMENT_LOOK[element]], RANGED_BASICS.has(id) ? (id === 'relayGust' && element === 'physical' ? 'wind' : ELEMENT_SHOT[element]) : POOL_STYLE[id]);
  const legacy = relayLegacyStyle(id);
  return POOL_STYLE[id] ? look(legacy, POOL_STYLE[id]) : legacy;
}
function relayLegacyStyle(id) {
  const element = RELAY_POOL_MOVE_ELEMENT[id];
  if(styles[element])return styles[element];
  if(/^arc/.test(id))return styles.storm;
  if(/seed|vine|leaf|grove/.test(id))return styles.nature;
  if(/shade|night/.test(id))return styles.shadow;
  if(/shard|quake|brutal|impact|relayShot|relayRam/.test(id))return styles.earth;
  if(/relaySlash|relayPunch|relaySweep/.test(id))return styles.claw;
  if(['relayClaw','fangRush','clawSweep'].includes(id))return styles.claw;
  if(/ice|frost|whiteout|glacier|relayBreath/i.test(id))return styles.frost;
  if(/tide|foam|surf|vortex/.test(id))return styles.water;
  return /sun|Light|dawn|relayRay|radiant|halo/.test(id)?styles.light:styles.fire;
}
export function relayTeamIds(firstId, reserveId) {
  if (!relayPartner(firstId)) throw new RangeError('RELAY_UNKNOWN_PARTNER');
  if(reserveId!==firstId&&relayPartner(reserveId))return [firstId,reserveId];
  const first=DATA_ARENA_PARTNERS.findIndex(p=>p.id===firstId);
  return [firstId,DATA_ARENA_PARTNERS[(first+1)%DATA_ARENA_PARTNERS.length].id];
}
export function relayMove(id, ultimate = false) {
  const base = basics[id] ?? extraMoves[id] ?? DATA_ARENA_MOVES[id] ?? relayOwnMove(id);
  if (!base) return null;
  return { ...base, ...(id==='iceCage'?{freezeWater:true}:{}), windup: Math.max(base.windup ?? 0, 0.14),
    recovery: base.recovery ?? (base.type === 'LUNGE' ? 0.32 : base.type === 'NOVA' ? 0.48 : 0.28),
    ...(ultimate ? { energy: DATA_ARENA_RELAY.ultimateTp, cooldown: DATA_ARENA_RELAY.ultimateCooldown } : {}) };
}
/** 0=south, then southeast/east/northeast/north/northwest/west/southwest. */
export function relayFacing8(angle) { return (Math.round((Math.PI / 2 - angle) / (Math.PI / 4)) + 8) % 8; }
