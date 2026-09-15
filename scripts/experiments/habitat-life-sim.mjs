// Research-only deterministic Habitat life simulation.
// No runtime imports; this is a design experiment, not production gameplay.

const ACTIONS = Object.freeze([
  'EAT', 'SLEEP', 'REST', 'PLAY', 'SOCIAL', 'TRAIN',
  'WORK', 'OBSERVE', 'WANDER', 'PLAYER_INTERACTION', 'DRINK', 'INSPECT',
]);

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export function createResident(spec) {
  return {
    id: spec.id,
    personality: { ...spec.personality },
    preferences: { ...spec.preferences },
    needs: {
      hunger: 0.25,
      energy: 0.8,
      social: 0.5,
      fun: 0.5,
      stress: 0.2,
      curiosity: 0.5,
      ...spec.needs,
    },
    relationships: { ...(spec.relationships ?? {}) },
    history: [],
    currentAction: 'OBSERVE',
  };
}

export const DEFAULT_AFFORDANCES = Object.freeze([
  { id: 'food', actions: ['EAT'], quality: 0.9 },
  { id: 'bed', actions: ['SLEEP', 'REST'], quality: 0.9 },
  { id: 'pond', actions: ['DRINK', 'PLAY', 'OBSERVE'], quality: 0.75 },
  { id: 'toy', actions: ['PLAY'], quality: 0.85 },
  { id: 'training', actions: ['TRAIN'], quality: 0.8 },
  { id: 'tree', actions: ['INSPECT', 'OBSERVE', 'REST'], quality: 0.7 },
  { id: 'workbench', actions: ['WORK', 'INSPECT'], quality: 0.8 },
]);

function scoreAction(resident, action, context) {
  const n = resident.needs;
  const p = resident.personality;
  const pref = resident.preferences[action] ?? 0;
  const affordance = context.affordances
    .filter((a) => a.actions.includes(action))
    .reduce((best, a) => Math.max(best, a.quality), 0);

  let score = pref * 0.35 + affordance * 0.2;
  switch (action) {
    case 'EAT': score += n.hunger * 1.2; break;
    case 'SLEEP': score += (1 - n.energy) * 1.35 + n.stress * 0.2; break;
    case 'REST': score += (1 - n.energy) * 0.7 + n.stress * 0.5; break;
    case 'PLAY': score += (1 - n.fun) * 0.9 + (p.playful ?? 0) * 0.6; break;
    case 'SOCIAL': score += (1 - n.social) * 0.9 + (p.social ?? 0) * 0.7; break;
    case 'TRAIN': score += (p.diligent ?? 0) * 0.75 + (p.competitive ?? 0) * 0.4; break;
    case 'WORK': score += (p.diligent ?? 0) * 0.8 + (p.independent ?? 0) * 0.25; break;
    case 'OBSERVE': score += n.curiosity * 0.55 + (p.curious ?? 0) * 0.55; break;
    case 'INSPECT': score += n.curiosity * 0.75 + (p.curious ?? 0) * 0.65; break;
    case 'PLAYER_INTERACTION': score += (p.affectionate ?? 0) * 0.9 + (1 - n.social) * 0.35; break;
    case 'WANDER': score += n.curiosity * 0.35 + 0.2; break;
    case 'DRINK': score += 0.25; break;
  }
  if (action === resident.currentAction) score += 0.08; // short-term continuity
  return score;
}

export function chooseAction(resident, context) {
  const candidates = ACTIONS
    .map((action) => ({ action, score: scoreAction(resident, action, context) }))
    .sort((a, b) => b.score - a.score || a.action.localeCompare(b.action));
  return candidates[0];
}

export function applyAction(resident, action) {
  const n = resident.needs;
  n.hunger = clamp01(n.hunger + 0.02);
  n.energy = clamp01(n.energy - 0.012);
  n.social = clamp01(n.social - 0.01);
  n.fun = clamp01(n.fun - 0.008);
  n.curiosity = clamp01(n.curiosity + 0.004);
  switch (action) {
    case 'EAT': n.hunger = clamp01(n.hunger - 0.55); break;
    case 'SLEEP': n.energy = clamp01(n.energy + 0.6); n.stress = clamp01(n.stress - 0.25); break;
    case 'REST': n.energy = clamp01(n.energy + 0.22); n.stress = clamp01(n.stress - 0.18); break;
    case 'PLAY': n.fun = clamp01(n.fun + 0.4); n.stress = clamp01(n.stress - 0.1); break;
    case 'SOCIAL': n.social = clamp01(n.social + 0.45); break;
    case 'PLAYER_INTERACTION': n.social = clamp01(n.social + 0.35); n.stress = clamp01(n.stress - 0.08); break;
    case 'TRAIN': n.energy = clamp01(n.energy - 0.08); n.stress = clamp01(n.stress + 0.04); break;
    case 'WORK': n.energy = clamp01(n.energy - 0.06); break;
    case 'INSPECT': n.curiosity = clamp01(n.curiosity - 0.28); break;
    case 'OBSERVE': n.curiosity = clamp01(n.curiosity - 0.12); break;
  }
  resident.currentAction = action;
  resident.history.push(action);
}

export function simulate(residents, { ticks = 600, affordances = DEFAULT_AFFORDANCES } = {}) {
  const context = { affordances };
  for (let tick = 0; tick < ticks; tick += 1) {
    for (const resident of residents) {
      const { action } = chooseAction(resident, context);
      applyAction(resident, action);
    }
  }
  return residents.map((r) => ({
    id: r.id,
    counts: Object.fromEntries(ACTIONS.map((a) => [a, r.history.filter((x) => x === a).length])),
    finalNeeds: { ...r.needs },
  }));
}

export function createThreeResidentFixture() {
  return [
    createResident({
      id: 'curious-social',
      personality: { curious: 0.95, social: 0.85, playful: 0.7, affectionate: 0.5 },
      preferences: { INSPECT: 0.9, SOCIAL: 0.8, PLAY: 0.65 },
    }),
    createResident({
      id: 'lazy-affectionate',
      personality: { affectionate: 0.95, playful: 0.35, social: 0.55, diligent: 0.1 },
      preferences: { REST: 0.9, SLEEP: 0.8, PLAYER_INTERACTION: 1.0 },
      needs: { energy: 0.55, social: 0.35 },
    }),
    createResident({
      id: 'independent-diligent',
      personality: { independent: 0.9, diligent: 0.95, competitive: 0.7, curious: 0.25 },
      preferences: { WORK: 1.0, TRAIN: 0.9, SOCIAL: -0.4 },
    }),
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(simulate(createThreeResidentFixture()), null, 2));
}
