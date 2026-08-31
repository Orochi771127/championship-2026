// Per-cage training identity from original cage descriptions (text ids 534–573)
// and the glossary entry for しゅうようすう (help_text id 133).
//
// WHAT THIS FILE IS ALLOWED TO CLAIM
// ----------------------------------
// • Channel identity (Defense up, HP recover, Data family…) — VERIFIED_TEXT
// • Recommended Digimon count per cage — VERIFIED_TEXT
// • Overfill is allowed; Digimon then tend to accumulate stress more easily —
//   VERIFIED_TEXT (help_text 133). This is a soft cap, not a hard lock.
//
// WHAT IT MUST NOT CLAIM
// ----------------------
// Tick magnitudes, stacking, which resident field is written, and how much
// extra stress overfill adds. CageDefinition +0x08 / +0x10 / +0x14 / +0x18 /
// +0x1C / +0x20 / +0x24 still have no raising reader+writer. OVL18
// `ldrb [r2,#8]` at 0x0210A9E8 / 0x0210AA34 is a 4-slot type==5 state poke,
// not a CageDefinition load. OVL15 0x0210C650 is a generic ~0x62-byte copy,
// not a 40-byte cage record writer.
//
// Japanese ROM strings stay out of src/. English labels are product copy of the
// verified meaning. Waiting Room (definition 35) has an empty original description.

export const CAGE_TRAINING_CHANNEL_EVIDENCE = "VERIFIED_TEXT";
export const CAGE_TRAINING_CAPACITY_EVIDENCE = "VERIFIED_TEXT";
export const CAGE_TRAINING_MAGNITUDE_PARITY = "UNKNOWN_REQUIRES_TRACE";

// Original glossary: you MAY exceed the recommended count. The only named
// consequence is that stress accumulates more easily — no delta is given.
export const CAGE_CAPACITY_RULE = "SOFT_CAP_OVERFILL_ALLOWED";
export const CAGE_CAPACITY_RULE_EVIDENCE = "VERIFIED_TEXT";
export const CAGE_CAPACITY_OVERFILL_CONSEQUENCE = "STRESS_ACCUMULATES_MORE_EASILY";
export const CAGE_CAPACITY_OVERFILL_MAGNITUDE_PARITY = CAGE_TRAINING_MAGNITUDE_PARITY;

export const CAGE_TRAINING_MODES = Object.freeze({
  UP: "UP",
  RECOVER: "RECOVER",
  AUTO_CARE: "AUTO_CARE"
});

export const CAGE_TRAINING_CHANNELS = Object.freeze({
  DEFENSE: "DEFENSE",
  HP: "HP",
  SPEED: "SPEED",
  TP: "TP",
  ATTACK: "ATTACK",
  WISDOM: "WISDOM",
  FAMILY_DATA: "FAMILY_DATA",
  FAMILY_DRAGON: "FAMILY_DRAGON",
  FAMILY_BEAST: "FAMILY_BEAST",
  FAMILY_WATER: "FAMILY_WATER",
  FAMILY_BIRD: "FAMILY_BIRD",
  FAMILY_INSECT_PLANT: "FAMILY_INSECT_PLANT",
  FAMILY_DARK: "FAMILY_DARK",
  FAMILY_MACHINE: "FAMILY_MACHINE",
  FAMILY_VACCINE: "FAMILY_VACCINE",
  FAMILY_HOLY: "FAMILY_HOLY",
  FAMILY_VIRUS: "FAMILY_VIRUS",
  RESIST_LIGHT: "RESIST_LIGHT",
  RESIST_HEAT: "RESIST_HEAT",
  RESIST_COLD: "RESIST_COLD",
  RESIST_THUNDER: "RESIST_THUNDER",
  RESIST_DARK: "RESIST_DARK",
  RECOVER_HP_STRESS: "RECOVER_HP_STRESS",
  AUTO_CARE: "AUTO_CARE",
  BATTLE_COUNT: "BATTLE_COUNT"
});

const CHANNEL_COPY = Object.freeze({
  DEFENSE: "Defense up",
  HP: "HP up",
  SPEED: "Speed up",
  TP: "TP up",
  ATTACK: "Attack up",
  WISDOM: "Wisdom up",
  FAMILY_DATA: "Data family up",
  FAMILY_DRAGON: "Dragon family up",
  FAMILY_BEAST: "Beast family up",
  FAMILY_WATER: "Water family up",
  FAMILY_BIRD: "Bird family up",
  FAMILY_INSECT_PLANT: "Insect-plant family up",
  FAMILY_DARK: "Dark family up",
  FAMILY_MACHINE: "Machine family up",
  FAMILY_VACCINE: "Vaccine family up",
  FAMILY_HOLY: "Holy family up",
  FAMILY_VIRUS: "Virus family up",
  RESIST_LIGHT: "Light resist up",
  RESIST_HEAT: "Heat resist up",
  RESIST_COLD: "Cold resist up",
  RESIST_THUNDER: "Thunder resist up",
  RESIST_DARK: "Dark resist up",
  RECOVER_HP_STRESS: "HP & stress recover",
  AUTO_CARE: "Auto feed & waste",
  BATTLE_COUNT: "Battle count up"
});

function up(id) {
  return Object.freeze({ id, mode: CAGE_TRAINING_MODES.UP });
}

function recoverHpStress() {
  return Object.freeze({
    id: CAGE_TRAINING_CHANNELS.RECOVER_HP_STRESS,
    mode: CAGE_TRAINING_MODES.RECOVER
  });
}

function autoCare() {
  return Object.freeze({
    id: CAGE_TRAINING_CHANNELS.AUTO_CARE,
    mode: CAGE_TRAINING_MODES.AUTO_CARE
  });
}

function summarize(channels, capacity) {
  const parts = channels.map((channel) => CHANNEL_COPY[channel.id]).filter(Boolean);
  // "Best for N" is the glossary sense (さいてきな数), not a hard lock.
  if (capacity != null) parts.push(`Best for ${capacity}`);
  return parts.length > 0 ? parts.join(" · ") : "No listed training";
}

/**
 * Compare how many Digimon sit in a cage against its recommended count.
 *
 * This does not refuse the assignment and does not add stress. Original help
 * text 133 says overfill is allowed; the extra-stress amount is still untraced.
 *
 * `capacity === null` means the original description listed no count (Waiting
 * Room). We do not invent a cap, so overRecommended stays false.
 */
export function evaluateCageOccupancy({ capacity = null, occupantCount = 0 } = {}) {
  const count = Number.isSafeInteger(occupantCount) && occupantCount >= 0 ? occupantCount : 0;
  const hasRecommended = Number.isSafeInteger(capacity) && capacity >= 0;
  return Object.freeze({
    occupantCount: count,
    capacity: hasRecommended ? capacity : null,
    overRecommended: hasRecommended ? count > capacity : false,
    capacityRule: CAGE_CAPACITY_RULE,
    capacityRuleEvidence: CAGE_CAPACITY_RULE_EVIDENCE,
    overfillConsequence: CAGE_CAPACITY_OVERFILL_CONSEQUENCE,
    stressParity: CAGE_CAPACITY_OVERFILL_MAGNITUDE_PARITY
  });
}

function training(channels, capacity) {
  const frozenChannels = Object.freeze(channels);
  return Object.freeze({
    channels: frozenChannels,
    capacity,
    summary: summarize(frozenChannels, capacity),
    channelEvidence: channels.length > 0 ? CAGE_TRAINING_CHANNEL_EVIDENCE : "EMPTY_ORIGINAL_DESCRIPTION",
    capacityEvidence: capacity == null ? "EMPTY_ORIGINAL_DESCRIPTION" : CAGE_TRAINING_CAPACITY_EVIDENCE,
    magnitudeParity: CAGE_TRAINING_MAGNITUDE_PARITY
  });
}

// Index = original CageDefinition 0..35 (SHOP_CAGE_CROSSWALK standard_cage_index).
const BY_DEFINITION_INDEX = Object.freeze([
  training([up(CAGE_TRAINING_CHANNELS.DEFENSE)], 2),
  training([up(CAGE_TRAINING_CHANNELS.HP)], 6),
  training([up(CAGE_TRAINING_CHANNELS.SPEED)], 10),
  training([up(CAGE_TRAINING_CHANNELS.TP)], 6),
  training([up(CAGE_TRAINING_CHANNELS.ATTACK)], 8),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_DATA)], 8),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_DRAGON)], 8),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_BEAST)], 6),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_WATER)], 8),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_BIRD)], 8),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_INSECT_PLANT)], 6),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_INSECT_PLANT)], 6),
  training([up(CAGE_TRAINING_CHANNELS.RESIST_LIGHT)], 6),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_DARK)], 6),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_MACHINE)], 6),
  training([recoverHpStress()], 2),
  // ROM name is the hospital; the paired description is the vaccine lab. Keep the text.
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_VACCINE)], 6),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_HOLY)], 4),
  training([recoverHpStress()], 8),
  training([up(CAGE_TRAINING_CHANNELS.RESIST_HEAT)], 6),
  training([up(CAGE_TRAINING_CHANNELS.RESIST_COLD)], 8),
  training([up(CAGE_TRAINING_CHANNELS.RESIST_THUNDER)], 6),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_VIRUS)], 4),
  training([up(CAGE_TRAINING_CHANNELS.WISDOM)], 2),
  training([autoCare()], 2),
  training([autoCare()], 8),
  training([up(CAGE_TRAINING_CHANNELS.BATTLE_COUNT)], 6),
  training([up(CAGE_TRAINING_CHANNELS.HP)], 2),
  training([recoverHpStress()], 6),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_HOLY)], 2),
  training([up(CAGE_TRAINING_CHANNELS.ATTACK)], 2),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_DRAGON)], 2),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_BIRD)], 2),
  training([up(CAGE_TRAINING_CHANNELS.FAMILY_WATER)], 2),
  training([up(CAGE_TRAINING_CHANNELS.RESIST_DARK)], 2),
  training([], null)
]);

export function getCageTraining(cageDefinitionIndex) {
  return BY_DEFINITION_INDEX[cageDefinitionIndex] ?? null;
}

export function trainingViewFromDefinition(definition) {
  const trainingRecord = definition?.training ?? getCageTraining(definition?.cageDefinitionIndex);
  if (!trainingRecord) {
    return Object.freeze({
      summary: "No listed training",
      capacity: null,
      channels: Object.freeze([]),
      channelEvidence: "EMPTY_ORIGINAL_DESCRIPTION",
      capacityEvidence: "EMPTY_ORIGINAL_DESCRIPTION",
      magnitudeParity: CAGE_TRAINING_MAGNITUDE_PARITY
    });
  }
  return trainingRecord;
}
