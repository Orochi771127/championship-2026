// Research-only deterministic Habitat life simulation v2.
// Purpose: test whether a small reusable action vocabulary can still produce
// visibly different resident behaviour without action lock-in.

const ACTIONS = ['EAT','SLEEP','REST','PLAY','SOCIAL','TRAIN','WORK','OBSERVE','WANDER','PLAYER_INTERACTION','DRINK','INSPECT'];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function createResident(spec) {
  return {
    id: spec.id,
    personality: { ...(spec.personality || {}) },
    preferences: { ...(spec.preferences || {}) },
    needs: { hunger:0.25, energy:0.8, social:0.5, fun:0.5, stress:0.2, curiosity:0.5, ...(spec.needs || {}) },
    history: [], recentActions: [], currentAction: 'OBSERVE',
  };
}

export const DEFAULT_AFFORDANCES = [
  { id:'food', actions:['EAT'], quality:0.9 },
  { id:'bed', actions:['SLEEP','REST'], quality:0.9 },
  { id:'pond', actions:['DRINK','PLAY','OBSERVE'], quality:0.75 },
  { id:'toy', actions:['PLAY'], quality:0.85 },
  { id:'training', actions:['TRAIN'], quality:0.8 },
  { id:'tree', actions:['INSPECT','OBSERVE','REST'], quality:0.7 },
  { id:'workbench', actions:['WORK','INSPECT'], quality:0.8 },
];

function score(resident, action, context) {
  const n = resident.needs, p = resident.personality;
  const pref = resident.preferences[action] || 0;
  const affordance = Math.max(0, ...context.affordances.filter((a)=>a.actions.includes(action)).map((a)=>a.quality));
  let s = pref * 0.24 + affordance * 0.14;
  if (action==='EAT') s += (n.hunger**2)*1.7;
  else if (action==='SLEEP') s += ((1-n.energy)**2)*1.65 + n.stress*0.3;
  else if (action==='REST') s += ((1-n.energy)**2)*0.85 + n.stress*0.6;
  else if (action==='PLAY') s += ((1-n.fun)**2)*1.05 + (p.playful||0)*0.35;
  else if (action==='SOCIAL') s += ((1-n.social)**2) + (p.social||0)*0.35;
  else if (action==='TRAIN') s += (p.diligent||0)*0.32 + (p.competitive||0)*0.28 + n.energy*0.18 - n.hunger*0.15;
  else if (action==='WORK') s += (p.diligent||0)*0.35 + (p.independent||0)*0.22 + n.energy*0.15 - n.hunger*0.15;
  else if (action==='OBSERVE') s += n.curiosity*0.38 + (p.curious||0)*0.25;
  else if (action==='INSPECT') s += n.curiosity*0.45 + (p.curious||0)*0.3;
  else if (action==='PLAYER_INTERACTION') s += (p.affectionate||0)*0.4 + ((1-n.social)**2)*0.55;
  else if (action==='WANDER') s += n.curiosity*0.25 + 0.12;
  else if (action==='DRINK') s += 0.18;

  const repeats = resident.recentActions.filter((x)=>x===action).length;
  s -= repeats * 0.18;
  const recent = resident.recentActions;
  if (recent.length>=2 && recent[recent.length-1]===action && recent[recent.length-2]===action) s -= 0.22;
  return s;
}

export function chooseAction(resident, context) {
  return ACTIONS.map((action)=>({action,score:score(resident,action,context)}))
    .sort((a,b)=>b.score-a.score || a.action.localeCompare(b.action))[0];
}

export function applyAction(resident, action) {
  const n = resident.needs;
  n.hunger=clamp01(n.hunger+0.02); n.energy=clamp01(n.energy-0.012);
  n.social=clamp01(n.social-0.01); n.fun=clamp01(n.fun-0.008); n.curiosity=clamp01(n.curiosity+0.004);
  if (action==='EAT') n.hunger=clamp01(n.hunger-0.55);
  else if (action==='SLEEP') { n.energy=clamp01(n.energy+0.6); n.stress=clamp01(n.stress-0.25); }
  else if (action==='REST') { n.energy=clamp01(n.energy+0.22); n.stress=clamp01(n.stress-0.18); }
  else if (action==='PLAY') { n.fun=clamp01(n.fun+0.4); n.stress=clamp01(n.stress-0.1); }
  else if (action==='SOCIAL') n.social=clamp01(n.social+0.45);
  else if (action==='PLAYER_INTERACTION') { n.social=clamp01(n.social+0.35); n.stress=clamp01(n.stress-0.08); }
  else if (action==='TRAIN') { n.energy=clamp01(n.energy-0.08); n.stress=clamp01(n.stress+0.04); }
  else if (action==='WORK') n.energy=clamp01(n.energy-0.06);
  else if (action==='INSPECT') n.curiosity=clamp01(n.curiosity-0.28);
  else if (action==='OBSERVE') n.curiosity=clamp01(n.curiosity-0.12);
  resident.currentAction=action; resident.history.push(action); resident.recentActions.push(action);
  if (resident.recentActions.length>8) resident.recentActions.shift();
}

export function createThreeResidentFixture() {
  return [
    createResident({ id:'curious-social', personality:{curious:0.95,social:0.85,playful:0.7,affectionate:0.5}, preferences:{INSPECT:0.9,SOCIAL:0.8,PLAY:0.65} }),
    createResident({ id:'lazy-affectionate', personality:{affectionate:0.95,playful:0.35,social:0.55,diligent:0.1}, preferences:{REST:0.9,SLEEP:0.8,PLAYER_INTERACTION:1.0}, needs:{energy:0.55,social:0.35} }),
    createResident({ id:'independent-diligent', personality:{independent:0.9,diligent:0.95,competitive:0.7,curious:0.25}, preferences:{WORK:1.0,TRAIN:0.9,SOCIAL:-0.4} }),
  ];
}

export function simulate(residents, ticks=600, affordances=DEFAULT_AFFORDANCES) {
  const context={affordances};
  for (let tick=0; tick<ticks; tick+=1) for (const resident of residents) applyAction(resident, chooseAction(resident,context).action);
  return residents.map((resident)=>({ id:resident.id, counts:Object.fromEntries(ACTIONS.map((a)=>[a,resident.history.filter((x)=>x===a).length])) }));
}

if (import.meta.url===`file://${process.argv[1]}`) console.log(JSON.stringify(simulate(createThreeResidentFixture()),null,2));
