// English for the tables in zhHant.js, keyed identically (record index or
// the same key). PRODUCT_AUTHORED, 2026-09-29, translated from the approved
// zh-Hant copy; not yet reviewed by a native English editor.
//
// Deliberately absent: species names and the starter's automatic names. They
// are proper nouns with no approved English form, so English shows their
// approved zh-Hant names (docs/reports/settings-2026-09-29/GLOSSARY_ZH_TW.md).
// The generation names are a literal rendering of the zh-Hant terms; the
// franchise has more than one English convention, and choosing one is an
// Owner decision recorded in the glossary.

export const GENERATIONS_EN = Object.freeze(["Digi-Egg", "Baby I", "Baby II", "Child", "Adult", "Perfect", "Ultimate"]);
export const PERSONALITIES_EN = Object.freeze(["Honest", "Selfish", "Impatient", "Easygoing", "Passionate", "Calm", "Bold", "Timid", "???"]);
export const ROSTER_FAMILIES_EN = Object.freeze(["None", "Beast", "Machine", "Insect & Plant", "Bird", "Dragon", "Aquatic", "Holy", "Dark"]);
export const TAMER_RANK_NAMES_EN = Object.freeze(["Green", "Blue", "Red", "White", "Bronze", "Silver", "Gold", "Platinum", "Champion", "Master"]);
export const SPECIAL_SKILLS_EN = Object.freeze(["None", "Taunt", "Heal α", "Heal β", "Heal γ", "Heal All α", "Heal All β", "Heal All γ",
  "Cleanse", "Cleanse All", "Power Up", "Power Up All", "Guard", "Guard All", "Speed Up", "Speed Up All", "Sense", "Sense All",
  "Fireproof", "Fireproof All", "Waterproof", "Waterproof All", "Thunderproof", "Thunderproof All", "Lightproof", "Lightproof All",
  "Darkproof", "Darkproof All", "Revive α", "Revive β", "Courage"]);

export const MODE_LABELS_EN = Object.freeze({ RAISING: "Raising", BATTLE: "Battle", HUNT: "Hunt", SHOP: "Shop" });
export const STAT_LABELS_EN = Object.freeze({ HP: "HP", TP: "TP", ATTACK: "Attack", DEFENSE: "Defense", WISDOM: "Wisdom", SPEED: "Speed" });
export const RESIST_LABELS_EN = Object.freeze({ ねつ: "Heat resistance", さむさ: "Cold resistance", かみなり: "Thunder resistance", ひかり: "Light resistance", やみ: "Dark resistance" });
export const FAMILY_LABELS_EN = Object.freeze({
  ワクチン: "Vaccine", データ: "Data", リュウ: "Dragon", ケモノ: "Beast", ミズ: "Aquatic", トリ: "Bird",
  キカイ: "Machine", セイ: "Holy", ムシクサ: "Insect & Plant", アンコク: "Dark", ウイルス: "Virus"
});

export const CAGE_NAMES_EN = Object.freeze({
  0: "Vacant Lot", 1: "Sports Ground", 2: "Arena", 3: "Dojo",
  4: "Gym", 5: "Laboratory", 6: "Volcano", 7: "Grassland",
  8: "Beach", 9: "Mountain", 10: "Forest", 11: "Jungle",
  12: "Sanctuary", 13: "Graveyard", 14: "Factory", 15: "Mini Infirmary",
  16: "Hospital", 17: "Flower Garden", 18: "Hot Spring", 19: "Desert",
  20: "Ice Field", 21: "Power Plant", 22: "Gas Room", 23: "Temple",
  24: "Zoo", 25: "Ranch", 26: "Ring", 27: "Mini Sports Ground",
  28: "Infirmary", 29: "Mini Garden", 30: "Mini Gym", 31: "Mini Volcano",
  32: "Mini Mountain", 33: "Mini Beach", 34: "Cave", 35: "Waiting Room"
});

export const CAGE_EFFECT_LABELS_EN = Object.freeze({
  "STAT_UP:HP": "HP up",
  "STAT_UP:TP": "TP up",
  "STAT_UP:ATTACK": "Attack up",
  "STAT_UP:DEFENSE": "Defense up",
  "STAT_UP:SPEED": "Speed up",
  "STAT_UP:WISDOM": "Wisdom up",
  "STAT_UP:BATTLE_COUNT": "Battle count up",
  "RECOVER:HP_AND_STRESS": "Recovers HP and stress",
  "AUTO_CARE:FOOD_AND_DROPPINGS": "Feeds and cleans automatically"
});

// Place names: the descriptive parts are translated; the syllables the zh-Hant
// names transliterate are rendered from the cartridge's katakana. Listed for
// review in the glossary.
export const GATE_NAMES_EN = Object.freeze({
  0: "Dyna Grassland", 1: "Drive Savanna", 2: "Module Forest", 3: "Boot Jungle",
  4: "Slimy Swamp", 5: "Wave Coast", 6: "Southbridge Valley", 7: "Clone Mines",
  8: "Dolbi Plant", 9: "Sewer Road", 10: "Snowland", 11: "Crack Rocks",
  12: "Magma Mountain", 13: "Scorching Desert", 14: "Clear Oasis", 15: "Critical Ruins",
  16: "Tutorial"
});

export const BATTLE_FACE_LABELS_EN = Object.freeze({
  CHAMPIONSHIP: "Championship",
  TITLE_MATCH: "Title Match",
  FREE_BATTLE: "Free Battle",
  LINK_BATTLE: "Link Battle",
  PASSWORD_BATTLE: "Password Battle",
  PRACTICE_BATTLE: "Practice Battle"
});

export const BATTLE_MENU_LABELS_EN = Object.freeze({
  menu: "Battle menu", kicker: "Battle", chooseMatch: "Choose a match",
  faceNotice: "Drag the cube or use the left and right arrow keys to pick a mode, then choose a match to enter.",
  availableMatches: "Available matches", noMatch: "No matches are open right now.",
  match: "Match", noPayout: "No prize", returnHome: "Back to ranch", conference: "Multi-round events"
});

export const UNKNOWN_DIGIMON_EN = "Unknown Digimon";
export const DIGI_EGG_EN = "Digi-Egg";
