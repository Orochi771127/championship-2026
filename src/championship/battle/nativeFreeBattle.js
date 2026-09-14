// ARM9 02068C04..02069184; CPU replay: FREE_BATTLE_CPU_2026-09-14.json.
// Functional tables and the existing shared RNG; no scene or save authority.
import catalog from '../../data/championship/catalogs/free-battle.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';

export const FREE_BATTLE_ARENAS=Object.freeze([0,1,2,3,4,5,7]);
export function freeBattlePreset(index){
  const row=catalog.presets[index-catalog.presetStart];
  if(!row||row.recordIndex!==index)throw new TypeError('FREE_BATTLE_PRESET_REQUIRED');
  return row;
}
export function freeBattlePayout(indices){return indices.reduce((sum,id)=>sum+freeBattlePreset(id).field0C,0);}
export function normalizeFreeBattleMenu(menu){
  if(menu==null)return null;
  if(typeof menu!=='object'||Object.keys(menu).some(k=>!['singles','teams'].includes(k))
    ||!Array.isArray(menu.singles)||!Array.isArray(menu.teams)
    ||[menu.singles,menu.teams].some(rows=>rows.length<5||rows.length>9)
    ||new Set(menu.singles).size!==menu.singles.length
    ||menu.teams.some(ids=>!Array.isArray(ids)||ids.length!==3)
    ||new Set(menu.teams.map(ids=>ids[0])).size!==menu.teams.length)throw new TypeError('INVALID_FREE_BATTLE_MENU');
  for(const id of [...menu.singles,...menu.teams.flat()]){if(!Number.isInteger(id))throw new TypeError('INVALID_FREE_BATTLE_MENU');freeBattlePreset(id);}
  return deepFreeze({singles:[...menu.singles],teams:menu.teams.map(ids=>[...ids])});
}
export function generateNativeFreeBattleMenu({season,nextChannel}){
  if(!Number.isInteger(season)||season<0||season>3||typeof nextChannel!=='function')throw new TypeError('FREE_BATTLE_CONTEXT_REQUIRED');
  const draw=n=>{
    const value=nextChannel(0);
    if(!Number.isInteger(value)||value<0||value>0x7fffffff||n<1)throw new TypeError('FREE_BATTLE_RANDOM_INPUT');
    return value%n;
  };
  const extraSingles=draw(5),extraTeams=draw(5);
  const singleTiers=[0,2,4,6,8],teamTiers=[0,2,4,6,8];
  for(let i=0;i<extraSingles;i++)singleTiers.push(draw(10));
  for(let i=0;i<extraTeams;i++)teamTiers.push(draw(10));
  singleTiers.sort((a,b)=>a-b);teamTiers.sort((a,b)=>a-b);
  const singles=[],teams=[];
  const candidates=(tier,used,cap)=>[...catalog.pools[tier][season],...catalog.pools[tier][4]].filter(id=>!used.includes(id)).slice(0,cap);
  for(const tier of singleTiers){const pool=candidates(tier,singles,32);singles.push(pool[draw(pool.length)]);}
  for(const tier of teamTiers){
    const used=teams.map(t=>t[0]);
    let pool=candidates(tier,used,64);const leader=pool[draw(pool.length)];
    // Both source branches run independently: the upper tier replaces the
    // lower-tier candidate list for 1..8. Preserve this instead of merging them.
    if(tier!==0)pool=candidates(tier-1,used,64);
    if(tier<9)pool=candidates(tier+1,used,64);
    teams.push([leader,pool[draw(pool.length)],pool[draw(pool.length)]]);
  }
  return deepFreeze({singles,teams});
}

export function listNativeFreeBattleMatches(menu){
  if(!menu)return [];
  return deepFreeze([
    ...menu.singles.map((id,index)=>({id:`single:${index}`,kind:'SINGLE',presetIndices:[id],slots:1})),
    ...menu.teams.map((ids,index)=>({id:`team:${index}`,kind:'TEAM',presetIndices:ids,slots:3}))
  ].map(row=>({...row,entryFee:0,payout:freeBattlePayout(row.presetIndices),speciesIndices:row.presetIndices.map(id=>freeBattlePreset(id).field00)})));
}
