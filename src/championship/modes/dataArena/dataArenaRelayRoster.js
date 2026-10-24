// Product-authored arena roles. Original species identity is read-only.
// Stage controls eligibility, never a stat advantage. Art resolves separately
// through the approved public catalog; unreviewed motion stays provisional.
import roster from '../../../data/championship/data-arena-relay-roster.v1.json' with { type: 'json' };
import { DATA_ARENA_PARTNERS } from './dataArenaConfig.js';

const forms = Object.freeze({
  weapon: { basic:'relaySlash', intent:'weapon-swing', thrust:8, lift:0, melee:7, ranged:8, burst:10 },
  cannon: { basic:'relayShot', intent:'mounted-projector', thrust:2, lift:0, melee:9, ranged:8, burst:10 },
  fist: { basic:'relayPunch', intent:'arm-strike', thrust:12, lift:1, melee:7, ranged:8, burst:10 },
  wing: { basic:'relayGust', intent:'wing-projection', thrust:3, lift:6, melee:9, ranged:8, burst:10 },
  quadruped: { basic:'relayClaw', intent:'four-leg-pounce', thrust:14, lift:2, melee:9, ranged:8, burst:10 },
  jaw: { basic:'relayBreath', intent:'jaw-breath', thrust:4, lift:1, melee:7, ranged:8, burst:10 },
  tail: { basic:'relaySweep', intent:'tail-body-sweep', thrust:6, lift:0, melee:9, ranged:8, burst:10 },
  core: { basic:'relayRay', intent:'core-projection', thrust:0, lift:4, melee:7, ranged:8, burst:10 },
  body: { basic:'relayRam', intent:'body-charge', thrust:16, lift:0, melee:9, ranged:8, burst:10 }
});
export const RELAY_ROSTER = Object.freeze(roster.entries.map(row => {
  const speciesId=`species-${String(row.speciesIndex).padStart(3,'0')}`;
  const legacy=DATA_ARENA_PARTNERS.find(p=>p.speciesId===speciesId);
  const heavy=['cannon','fist','body'].includes(row.body);
  return Object.freeze({id:`relay-${speciesId}`,speciesId,hp:heavy?135:120,speed:heavy?235:260,
    laserDps:44,startingUpgrades:{},canSwim:row.element==='water',...legacy,...row,
    motionStatus:[34,61,64].includes(row.speciesIndex)?'REVIEWED_EXISTING_CLIPS':'PROVISIONAL',
    action:Object.freeze({...forms[row.body],releaseSlot:1})});
}));
const byId=new Map(RELAY_ROSTER.map(p=>[p.id,p]));
export function relayPartner(id) { return byId.get(id) ?? null; }

export const RELAY_ELEMENT_KITS=Object.freeze({
 fire:{moves:['emberBolt','fangRush','flameRing','cinderGuard','clawSweep'],ultimate:'coreNova'},
 frost:{moves:['iceShard','frostStep','iceCage','frostFan','glacierGuard'],ultimate:'whiteout'},
 light:{moves:['sunSpear','sunShield','scatterLight','radiantDash','haloPulse'],ultimate:'dawnLance'},
 water:{moves:['tideBolt','tideWave','foamZone','surfRush','glacierGuard'],ultimate:'vortex'},
 earth:{moves:['shardVolley','quakeSlam','brutalCharge','cinderGuard','clawSweep'],ultimate:'shardStorm'},
 storm:{moves:['arcBolt','arcFan','arcField','radiantDash','sunShield'],ultimate:'arcStorm'},
 nature:{moves:['seedBolt','vineSnare','leafFan','surfRush','glacierGuard'],ultimate:'grovePulse'},
 shadow:{moves:['shadeBolt','shadeStep','shadeField','clawSweep','cinderGuard'],ultimate:'nightPulse'},
 physical:{moves:['impactShot','clawSweep','brutalCharge','sunShield','quakeSlam'],ultimate:'impactNova'}
});
