// Story mode, part one: "Unheard Echoes" as a half-body visual novel
// (OWNER_APPROVED_ADAPTATION 2026-11-11: the Owner handed the story mode over;
// the six-chapter script first written 2026-10-29 is restaged as portrait
// dialogue over painted scene plates). Pure data and lookups: no imports, no
// ROM evidence, never a save field. Every actor is one of the product's own
// partners (species index -> the public character runtime and the Database
// hero art); tamers speak through their partners' figures.
//
// Progress rides the Cyber Gachapon once-only reward ledger: a chapter is
// cleared once its key `story:vn1:cN` was claimed, so the canonical save carries
// it without a new field.
//
// Beat schema (presentation/story/storyVnDirector.js reads exactly these):
//   bg        {id, cut?:'fade'|'cut'|'glitch', titleKey?, keep?}   scene plate; clears actors unless keep
//   enter     {who, x, from?:'left'|'right'|'warp'|'rift', face?:'left'|'right'}
//   exit      {who, to?:'left'|'right'|'warp'|'rift'}
//   move      {who, x, face?}          walk along the ground line
//   act       {who, action:'idle'|'walk'|'attack'|'hit'|'cheer', face?}
//   bubble    {who, glyph:'!'|'?'|'...'|'heart'|'note'|'sad'|'spark'|'anger'}
//   line      {speaker, key, mood?, overwrite?}   portrait dialogue; overwrite = the key the line is glitched into
//   choice    {key, options:[{key, next}]}
//   fx        {kind:'noise'|'shake'|'flash'|'warning'|'resonance', on?, subKey?}
//   file      {key}                   a document card (KEY + KEY_BODY)
//   form      {}                      the entry form the partner signs itself
//   tag       {who:[...], to:'contestant'|'restore', quiet?}   name plates overwritten / restored
//   tap       {promptKey, targets:[{at:[x,y]}|{who}], labels?:[key]}   the player taps each target in order
//   objectives{keys?, done}
//   battle    {presets:[n], titleKey, win, lose}   the game's own auto battle; branches on the result
//   wait      {ms}   jump {next}   end
// x runs 0 (left edge) .. 1 (right edge) along the ground line; tap `at` is in
// plate percent [x, y] (of the scene picture). `label` on any beat is a jump target.
// Text keys resolve in STORY_VN_COPY (text/storyVnText.js).

export const STORY_VN_SCHEMA_VERSION = 1;
export const STORY_VN_REWARD_PREFIX = "story:vn1:";
export const STORY_VN_BEAT_TYPES = Object.freeze(["bg", "enter", "exit", "move", "act", "bubble", "line", "choice", "fx", "file", "form", "tag",
  "tap", "objectives", "battle", "wait", "jump", "end"]);
export const STORY_VN_ACTIONS = Object.freeze(["idle", "walk", "attack", "hit", "cheer"]);
/** Native sequences the stage loads for every actor (the Data Arena's audited ids). */
export const STORY_VN_SEQUENCES = Object.freeze({ idle: 0, walk: 2, attack: 7, hit: 6, cheer: 33 });
export const STORY_VN_BUBBLES = Object.freeze(["!", "?", "...", "heart", "note", "sad", "spark", "anger"]);
/** Portrait moods: how the speaking bust moves and is lit (ui/storyVn.css). */
export const STORY_VN_MOODS = Object.freeze(["calm", "happy", "angry", "sad", "shock", "think", "serious", "glitch"]);
export const STORY_VN_FX = Object.freeze(["noise", "shake", "flash", "warning", "resonance"]);

const freezeDeep = value => {
  if (Array.isArray(value)) { for (const item of value) freezeDeep(item); return Object.freeze(value); }
  if (value && typeof value === "object") { for (const item of Object.values(value)) freezeDeep(item); return Object.freeze(value); }
  return value;
};

/**
 * Living scene plates (original art, 2026-11-11). Side view, ground band from
 * `ground` (fraction of the height) down; `focus` is the horizontal point a
 * narrow (portrait) screen keeps in view. `src` is the still (also the poster
 * under reduced motion and the saver tier), `motion` a seamless 2.5D parallax
 * loop whose focus plane is the ground band, `ambient` the drifting motes.
 */
export const STORY_VN_BACKGROUNDS = freezeDeep({
  habitat: { src: "assets/production/story/vn-backgrounds-v2/habitat.cf2beca88e5e8a24.webp", motion: "assets/production/story/vn-backgrounds-v2/habitat.9da50f44606a900b.mp4", ambient: "leaves", ground: 0.8, focus: 0.58 },
  plaza: { src: "assets/production/story/vn-backgrounds-v2/plaza.f12972526bf251c0.webp", motion: "assets/production/story/vn-backgrounds-v2/plaza.a86b9322315f1847.mp4", ambient: "confetti", ground: 0.8, focus: 0.6 },
  arena: { src: "assets/production/story/vn-backgrounds-v2/arena.88c052817c8f310b.webp", motion: "assets/production/story/vn-backgrounds-v2/arena.05853a915c2cc7c7.mp4", ambient: "dust", ground: 0.8, focus: 0.55 },
  town: { src: "assets/production/story/vn-backgrounds-v2/town.816b0dd6b46815e3.webp", motion: "assets/production/story/vn-backgrounds-v2/town.033a97a34dbc7bab.mp4", ambient: "fireflies", ground: 0.8, focus: 0.6 },
  grid: { src: "assets/production/story/vn-backgrounds-v2/grid.3b996755ec684c99.webp", motion: "assets/production/story/vn-backgrounds-v2/grid.ec3c2966b3eb17ca.mp4", ambient: "data", ground: 0.8, focus: 0.62 },
  lotus: { src: "assets/production/story/vn-backgrounds-v2/lotus.c9b267dff44c05bb.webp", motion: "assets/production/story/vn-backgrounds-v2/lotus.95dc28f3e29284d2.mp4", ambient: "petals", ground: 0.8, focus: 0.58 },
  vault: { src: "assets/production/story/vn-backgrounds-v2/vault.c15e52ec75eeee08.webp", motion: "assets/production/story/vn-backgrounds-v2/vault.e47068fdef606163.mp4", ambient: "dust", ground: 0.8, focus: 0.52 },
  safezone: { src: "assets/production/story/vn-backgrounds-v2/safezone.d1fc2a444f02962e.webp", motion: "assets/production/story/vn-backgrounds-v2/safezone.4b09f36d99163e05.mp4", ambient: "sparks", ground: 0.8, focus: 0.55 },
  void: { src: "assets/production/story/vn-backgrounds-v2/void.cf751a51984f8cf8.webp", motion: "assets/production/story/vn-backgrounds-v2/void.8318fb0b26958986.mp4", ambient: "shards", ground: 0.8, focus: 0.55 }
});

/**
 * Actors and busts. `species` is the product species index; the player's
 * partner is resolved at play time. `tagKey` is the floating name tag the
 * overwrite glitch rewrites; `scale` grows heavy and boss bodies on stage.
 */
export const STORY_VN_CAST = freezeDeep({
  partner: { species: null, tagKey: null },
  navi: { species: null, navi: true },
  rivalMon: { species: 50, tagKey: "TAG_RIVAL_MON", faction: "iron", scale: 1.15, preset: 491 }, // GR23 Clockwork Dragon
  rivalMonAwake: { species: 169, tagKey: "TAG_RIVAL_MON", faction: "iron", scale: 1.2 },
  envoyMon: { species: 92, tagKey: "TAG_ENVOY", faction: "lumen" },
  caretakerMon: { species: 175, tagKey: "TAG_CARETAKER", faction: "lotus" },
  hushMon: { species: 176, tagKey: "TAG_HUSH", faction: "lotus" },
  registrarMon: { species: 88, tagKey: "TAG_REGISTRAR" },
  mechanicMon: { species: 52, tagKey: "TAG_MECHANIC" },
  resident: { species: 65, tagKey: "TAG_RESIDENT", faction: "lotus" },
  residentB: { species: 177, tagKey: "TAG_RESIDENT_B" },
  residentC: { species: 58, tagKey: "TAG_RESIDENT_C" },
  neighborA: { species: 18, tagKey: "TAG_NEIGHBOR_A" },
  neighborB: { species: 25, tagKey: "TAG_NEIGHBOR_B" },
  guide: { species: 51, tagKey: "TAG_GUIDE" },
  vanguard: { species: 78, overwritten: true, preset: 515 },
  vanguardB: { species: 78, overwritten: true },
  vessel: { species: 148, tagKey: "TAG_VESSEL", overwritten: true, scale: 1.6, preset: 542 }
});

/** Speakers: name-plate key, the cast member whose bust and body speak, and the human behind it (if any). */
export const STORY_VN_SPEAKERS = freezeDeep({
  narrator: { nameKey: null, cast: null },
  navi: { nameKey: "SPEAKER_NAVI", cast: "navi" },
  partner: { nameKey: "SPEAKER_PARTNER", cast: "partner" },
  rival: { nameKey: "SPEAKER_RIVAL", cast: "rivalMon", alt: "rivalMonAwake", faction: "iron", tamer: true },
  envoy: { nameKey: "SPEAKER_ENVOY", cast: "envoyMon", faction: "lumen", tamer: true },
  caretaker: { nameKey: "SPEAKER_CARETAKER", cast: "caretakerMon", faction: "lotus", tamer: true },
  hush: { nameKey: "SPEAKER_HUSH", cast: "hushMon", faction: "lotus", tamer: true },
  registrar: { nameKey: "SPEAKER_REGISTRAR", cast: "registrarMon", tamer: true },
  mechanic: { nameKey: "SPEAKER_MECHANIC", cast: "mechanicMon", tamer: true },
  resident: { nameKey: "SPEAKER_RESIDENT", cast: "resident" },
  guide: { nameKey: "SPEAKER_GUIDE", cast: "guide" },
  vessel: { nameKey: "SPEAKER_VESSEL", cast: "vessel" },
  neighborA: { nameKey: "TAG_NEIGHBOR_A", cast: "neighborA" },
  neighborB: { nameKey: "TAG_NEIGHBOR_B", cast: "neighborB" },
  residentB: { nameKey: "TAG_RESIDENT_B", cast: "residentB" }
});

export const STORY_VN_CHAPTERS = freezeDeep({
  "vn1-c1": {
    number: 1, mapNumber: 2, titleKey: "C1_TITLE", summaryKey: "C1_SUMMARY", echoKey: "C1_ECHO", reward: { tickets: 6 },
    beats: [
      { type: "bg", id: "habitat", titleKey: "LOC_HABITAT" },
      { type: "line", speaker: "narrator", key: "C1_N1" },
      { type: "enter", who: "partner", x: 0.86, from: "right", face: "left" },
      { type: "bubble", who: "partner", glyph: "note" },
      { type: "enter", who: "neighborA", x: 0.42, from: "left", face: "right" },
      { type: "line", speaker: "neighborA", key: "HAB_A_1", mood: "happy" },
      { type: "line", speaker: "neighborA", key: "HAB_A_2" },
      { type: "act", who: "partner", action: "walk", face: "left" },
      { type: "line", speaker: "partner", key: "V1_P_SEARCH", mood: "happy" },
      { type: "move", who: "partner", x: 0.62, face: "left" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "act", who: "partner", action: "cheer" },
      { type: "line", speaker: "partner", key: "C1_P_GIFT", mood: "happy" },
      { type: "line", speaker: "narrator", key: "C1_N2" },
      { type: "enter", who: "neighborB", x: 0.84, from: "right", face: "left" },
      { type: "line", speaker: "neighborB", key: "HAB_B_1", mood: "calm" },
      { type: "line", speaker: "partner", key: "HAB_B_2", mood: "happy" },
      { type: "line", speaker: "navi", key: "V1_NAVI_INVITE", mood: "happy" },
      { type: "line", speaker: "partner", key: "C1_P_DOOR", mood: "happy" },
      { type: "exit", who: "partner", to: "right" },
      { type: "bg", id: "plaza", titleKey: "LOC_PLAZA" },
      { type: "enter", who: "registrarMon", x: 0.82, face: "left" },
      { type: "enter", who: "partner", x: 0.52, from: "warp", face: "right" },
      { type: "line", speaker: "narrator", key: "V1_N_AVATAR" },
      { type: "line", speaker: "registrar", key: "C1_REG1", mood: "happy" },
      { type: "form", label: "sign" },
      { type: "line", speaker: "registrar", key: "C1_REG2", mood: "shock" },
      { type: "line", speaker: "partner", key: "C1_P_NAME", mood: "serious" },
      { type: "line", speaker: "narrator", key: "PLAZA_STANDS" },
      { type: "fx", kind: "shake" },
      { type: "line", speaker: "narrator", key: "V1_N_HEAVY" },
      { type: "exit", who: "registrarMon", to: "right" },
      { type: "enter", who: "rivalMon", x: 0.8, from: "right", face: "left" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "rival", key: "C1_RIN1", mood: "think" },
      { type: "line", speaker: "rival", key: "C1_RIN2", mood: "happy" },
      { type: "line", speaker: "rival", key: "C1_RIN3", mood: "serious" },
      { type: "battle", presets: [491], titleKey: "CLASH_TITLE_SPAR", win: "won", lose: "lost" },
      { type: "line", speaker: "rival", key: "C1_RIN_WIN", mood: "happy", label: "won" },
      { type: "jump", next: "after" },
      { type: "act", who: "partner", action: "cheer", label: "lost" },
      { type: "bubble", who: "partner", glyph: "heart" },
      { type: "line", speaker: "partner", key: "C1_P_LOSE", mood: "happy" },
      { type: "line", speaker: "rival", key: "C1_RIN_LOSE", mood: "happy" },
      { type: "line", speaker: "narrator", key: "C1_N_END", label: "after" },
      { type: "end" }
    ]
  },
  "vn1-c2": {
    number: 2, mapNumber: 3, titleKey: "C2_TITLE", summaryKey: "C2_SUMMARY", echoKey: "C2_ECHO", reward: { tickets: 6 },
    beats: [
      { type: "bg", id: "arena", titleKey: "LOC_ARENA" },
      { type: "enter", who: "registrarMon", x: 0.82, face: "left" },
      { type: "enter", who: "partner", x: 0.5, from: "left", face: "right" },
      { type: "line", speaker: "narrator", key: "C2_N1" },
      { type: "fx", kind: "noise", on: true },
      { type: "line", speaker: "registrar", key: "C2_REG1", mood: "think" },
      { type: "tag", who: ["registrarMon"], to: "contestant" },
      { type: "line", speaker: "registrar", key: "C2_REG2", mood: "glitch" },
      { type: "bg", id: "town", cut: "glitch", titleKey: "LOC_TOWN" },
      { type: "enter", who: "partner", x: 0.5, face: "right" },
      { type: "enter", who: "mechanicMon", x: 0.8, from: "right", face: "left" },
      { type: "tag", who: ["mechanicMon"], to: "contestant" },
      { type: "line", speaker: "mechanic", key: "C2_BARD1", mood: "glitch" },
      { type: "line", speaker: "narrator", key: "C2_N2" },
      { type: "bubble", who: "partner", glyph: "?" },
      { type: "line", speaker: "partner", key: "C2_P1", mood: "sad" },
      { type: "fx", kind: "warning", subKey: "WARNING_SUB_EVAC" },
      { type: "fx", kind: "shake" },
      { type: "act", who: "partner", action: "hit", face: "left" },
      { type: "exit", who: "mechanicMon", to: "warp" },
      { type: "enter", who: "rivalMon", x: 0.78, from: "right", face: "left" },
      { type: "act", who: "rivalMon", action: "attack", face: "left" },
      { type: "line", speaker: "rival", key: "C2_RIN1", mood: "angry" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "partner", key: "C2_P2", mood: "shock" },
      { type: "fx", kind: "noise", on: false },
      { type: "enter", who: "envoyMon", x: 0.3, from: "warp", face: "right" },
      { type: "line", speaker: "envoy", key: "C2_EI1", mood: "serious" },
      { type: "file", key: "C2_FILE_COUNCIL" },
      { type: "line", speaker: "rival", key: "C2_RIN2", mood: "angry" },
      { type: "file", key: "C2_FILE_IRON" },
      { type: "line", speaker: "narrator", key: "C2_N3" },
      { type: "choice", key: "C2_CHOICE", options: [{ key: "C2_OPT_COUNCIL", next: "council" }, { key: "C2_OPT_IRON", next: "iron" }] },
      { type: "line", speaker: "envoy", key: "C2_EI_PICK", mood: "think", label: "council" },
      { type: "jump", next: "rejoin" },
      { type: "line", speaker: "rival", key: "C2_RIN_PICK", mood: "serious", label: "iron" },
      { type: "line", speaker: "partner", key: "C2_P3", mood: "think", label: "rejoin" },
      { type: "line", speaker: "envoy", key: "C2_EI2", mood: "serious" },
      { type: "line", speaker: "navi", key: "V2_NAVI_TRUCE", mood: "think" },
      { type: "act", who: "partner", action: "cheer" },
      { type: "line", speaker: "partner", key: "C2_P4", mood: "happy" },
      { type: "end" }
    ]
  },
  "vn1-c3": {
    number: 3, mapNumber: 4, titleKey: "C3_TITLE", summaryKey: "C3_SUMMARY", echoKey: "C3_ECHO", reward: { tickets: 7 },
    beats: [
      { type: "bg", id: "grid", titleKey: "LOC_GRID" },
      { type: "line", speaker: "narrator", key: "C3_N1" },
      { type: "enter", who: "partner", x: 0.46, from: "warp", face: "right" },
      { type: "line", speaker: "navi", key: "V3_NAVI_DIVE", mood: "serious" },
      { type: "enter", who: "rivalMon", x: 0.3, from: "warp", face: "right" },
      { type: "line", speaker: "rival", key: "C3_RIN1", mood: "serious" },
      { type: "enter", who: "guide", x: 0.84, from: "rift", face: "left" },
      { type: "bubble", who: "guide", glyph: "..." },
      { type: "line", speaker: "narrator", key: "C3_N2" },
      { type: "act", who: "rivalMon", action: "attack", face: "right" },
      { type: "line", speaker: "rival", key: "C3_RIN2", mood: "angry" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "move", who: "partner", x: 0.64, face: "left" },
      { type: "line", speaker: "partner", key: "C3_P1", mood: "shock" },
      { type: "line", speaker: "narrator", key: "C3_N3" },
      { type: "line", speaker: "guide", key: "C3_HUM1", mood: "sad" },
      { type: "line", speaker: "rival", key: "C3_RIN3", mood: "think" },
      { type: "tap", promptKey: "TASK_BREAK", targets: [{ at: [59, 34] }, { at: [72, 30] }, { at: [66, 46] }] },
      { type: "fx", kind: "flash" },
      { type: "line", speaker: "narrator", key: "C3_N4" },
      { type: "bubble", who: "guide", glyph: "heart" },
      { type: "bg", id: "lotus", titleKey: "LOC_LOTUS" },
      { type: "enter", who: "resident", x: 0.82, face: "left" },
      { type: "enter", who: "caretakerMon", x: 0.66, face: "left" },
      { type: "enter", who: "partner", x: 0.42, from: "warp", face: "right" },
      { type: "line", speaker: "caretaker", key: "C3_SHIZU1", mood: "happy" },
      { type: "bubble", who: "resident", glyph: "sad" },
      { type: "line", speaker: "resident", key: "C3_RES_TRUE", mood: "sad", overwrite: "C3_RES_FORCED", label: "overwrite" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "partner", key: "C3_P2", mood: "angry" },
      { type: "line", speaker: "caretaker", key: "C3_SHIZU2", mood: "sad" },
      { type: "line", speaker: "caretaker", key: "C3_SHIZU3", mood: "think" },
      { type: "line", speaker: "narrator", key: "C3_N5" },
      { type: "end" }
    ]
  },
  "vn1-c4": {
    number: 4, mapNumber: 5, titleKey: "C4_TITLE", summaryKey: "C4_SUMMARY", echoKey: "C4_ECHO", reward: { tickets: 7 },
    beats: [
      { type: "bg", id: "vault", titleKey: "LOC_VAULT" },
      { type: "enter", who: "envoyMon", x: 0.3, face: "right" },
      { type: "enter", who: "rivalMon", x: 0.82, face: "left" },
      { type: "enter", who: "partner", x: 0.56, from: "warp", face: "left" },
      { type: "line", speaker: "narrator", key: "C4_N1" },
      { type: "line", speaker: "navi", key: "V4_NAVI_SEAL", mood: "think" },
      { type: "tap", promptKey: "TASK_COSIGN", targets: [{ at: [43, 62] }, { at: [57, 62] }], labels: ["SEAL_LUMEN", "SEAL_IRON"] },
      { type: "fx", kind: "flash" },
      { type: "file", key: "C4_FILE_PLAN" },
      { type: "line", speaker: "envoy", key: "C4_EI1", mood: "sad" },
      { type: "line", speaker: "rival", key: "C4_RIN1", mood: "serious" },
      { type: "line", speaker: "partner", key: "C4_P1", mood: "think" },
      { type: "line", speaker: "narrator", key: "C4_N2" },
      { type: "bg", id: "safezone", titleKey: "LOC_SAFEZONE" },
      { type: "enter", who: "residentB", x: 0.62, face: "left" },
      { type: "enter", who: "resident", x: 0.75, face: "left" },
      { type: "enter", who: "residentC", x: 0.88, face: "left" },
      { type: "tag", who: ["residentB", "resident", "residentC"], to: "contestant", quiet: true },
      { type: "enter", who: "partner", x: 0.4, from: "warp", face: "right" },
      { type: "tap", promptKey: "TASK_IDENTIFY", targets: [{ who: "residentB" }, { who: "resident" }, { who: "residentC" }], restore: true },
      { type: "act", who: "partner", action: "cheer" },
      { type: "line", speaker: "partner", key: "C4_P2", mood: "happy" },
      { type: "line", speaker: "rival", key: "C4_RIN2", mood: "serious" },
      { type: "choice", key: "C4_CHOICE", options: [{ key: "C4_OPT_DONE", next: "done" }, { key: "C4_OPT_SWAP", next: "swap" }] },
      { type: "line", speaker: "rival", key: "C4_RIN_DONE", mood: "happy", label: "done" },
      { type: "jump", next: "rejoin" },
      { type: "line", speaker: "rival", key: "C4_RIN_SWAP", mood: "happy", label: "swap" },
      { type: "line", speaker: "narrator", key: "C4_N3", label: "rejoin" },
      { type: "end" }
    ]
  },
  "vn1-c5": {
    number: 5, mapNumber: 6, titleKey: "C5_TITLE", summaryKey: "C5_SUMMARY", echoKey: "C5_ECHO", reward: { tickets: 8 },
    beats: [
      { type: "bg", id: "void", cut: "glitch", titleKey: "LOC_VOID" },
      { type: "fx", kind: "noise", on: true },
      { type: "line", speaker: "narrator", key: "C5_N1" },
      { type: "enter", who: "partner", x: 0.44, from: "warp", face: "right" },
      { type: "enter", who: "envoyMon", x: 0.28, from: "warp", face: "right" },
      { type: "line", speaker: "navi", key: "V5_NAVI_ALERT", mood: "shock" },
      { type: "enter", who: "hushMon", x: 0.8, from: "rift", face: "left" },
      { type: "line", speaker: "hush", key: "C5_HUSH1", mood: "serious" },
      { type: "line", speaker: "hush", key: "C5_HUSH2", mood: "glitch" },
      { type: "tag", who: ["envoyMon"], to: "contestant" },
      { type: "line", speaker: "hush", key: "C5_HUSH3", mood: "serious" },
      { type: "choice", key: "C5_CHOICE", options: [{ key: "C5_OPT_KEEP", next: "answer" }, { key: "C5_OPT_REST", next: "answer" }] },
      { type: "act", who: "partner", action: "cheer", label: "answer" },
      { type: "line", speaker: "partner", key: "C5_ANSWER", mood: "serious" },
      { type: "tag", who: ["envoyMon"], to: "restore" },
      { type: "fx", kind: "warning", subKey: "WARNING_SUB_OVERWRITE" },
      { type: "exit", who: "hushMon", to: "rift" },
      { type: "enter", who: "vanguard", x: 0.74, from: "rift", face: "left" },
      { type: "enter", who: "vanguardB", x: 0.88, from: "rift", face: "left" },
      { type: "exit", who: "envoyMon", to: "warp" },
      { type: "enter", who: "rivalMon", x: 0.3, from: "left", face: "right" },
      { type: "line", speaker: "rival", key: "C5_RIN1", mood: "happy" },
      { type: "battle", presets: [515], titleKey: "CLASH_TITLE_VANGUARD", win: "after", lose: "after" },
      { type: "line", speaker: "partner", key: "C5_P2", mood: "serious", label: "after" },
      { type: "fx", kind: "noise", on: false },
      { type: "line", speaker: "narrator", key: "C5_N2" },
      { type: "end" }
    ]
  },
  "vn1-c6": {
    number: 6, mapNumber: 7, titleKey: "C6_TITLE", summaryKey: "C6_SUMMARY", echoKey: "C6_ECHO", reward: { tickets: 12 },
    beats: [
      { type: "bg", id: "void", titleKey: "LOC_VOID" },
      { type: "objectives", keys: ["OBJ_CUT", "OBJ_CONTEXT", "OBJ_CHOICE"], done: 0 },
      { type: "line", speaker: "narrator", key: "C6_N1" },
      { type: "enter", who: "partner", x: 0.44, from: "warp", face: "right" },
      { type: "enter", who: "rivalMonAwake", x: 0.76, from: "warp", face: "left" },
      { type: "line", speaker: "navi", key: "V6_NAVI_ALL", mood: "serious" },
      { type: "line", speaker: "rival", key: "C6_RIN1", mood: "serious", alt: true },
      { type: "objectives", done: 1 },
      { type: "enter", who: "envoyMon", x: 0.28, from: "warp", face: "right" },
      { type: "line", speaker: "envoy", key: "C6_EI1", mood: "serious" },
      { type: "exit", who: "envoyMon", to: "warp" },
      { type: "objectives", done: 2 },
      { type: "enter", who: "caretakerMon", x: 0.28, from: "warp", face: "right" },
      { type: "line", speaker: "caretaker", key: "C6_SHIZU1", mood: "serious" },
      { type: "exit", who: "caretakerMon", to: "warp" },
      { type: "fx", kind: "noise", on: true },
      { type: "exit", who: "rivalMonAwake", to: "right" },
      { type: "enter", who: "vessel", x: 0.7, from: "rift", face: "left" },
      { type: "fx", kind: "shake" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "vessel", key: "C6_VOID1", mood: "glitch" },
      { type: "line", speaker: "rival", key: "C6_RIN2", mood: "shock", alt: true },
      { type: "move", who: "partner", x: 0.36, face: "right" },
      { type: "line", speaker: "partner", key: "C6_P_LEFT", mood: "serious", label: "left" },
      { type: "fx", kind: "resonance" },
      { type: "line", speaker: "narrator", key: "V6_RESONANCE" },
      { type: "battle", presets: [542], titleKey: "CLASH_TITLE_BOSS", win: "saved", lose: "held" },
      { type: "line", speaker: "rival", key: "V6_LOSE", mood: "angry", alt: true, label: "held" },
      { type: "objectives", done: 3, label: "saved" },
      { type: "fx", kind: "noise", on: false },
      { type: "exit", who: "vessel", to: "rift" },
      { type: "line", speaker: "narrator", key: "C6_N2" },
      { type: "bg", id: "arena", titleKey: "LOC_FINAL" },
      { type: "line", speaker: "narrator", key: "C6_EP1" },
      { type: "line", speaker: "narrator", key: "C6_EP2" },
      { type: "enter", who: "registrarMon", x: 0.82, face: "left" },
      { type: "enter", who: "partner", x: 0.52, from: "warp", face: "right" },
      { type: "tag", who: ["registrarMon"], to: "contestant", quiet: true },
      { type: "line", speaker: "registrar", key: "C6_REG1", mood: "think" },
      { type: "tag", who: ["registrarMon"], to: "restore" },
      { type: "line", speaker: "registrar", key: "C6_REG2", mood: "happy" },
      { type: "act", who: "partner", action: "cheer" },
      { type: "bubble", who: "partner", glyph: "heart" },
      { type: "enter", who: "rivalMonAwake", x: 0.3, from: "left", face: "right" },
      { type: "act", who: "rivalMonAwake", action: "cheer" },
      { type: "line", speaker: "rival", key: "C6_RIN3", mood: "happy", alt: true },
      { type: "line", speaker: "narrator", key: "C6_END" },
      { type: "end" }
    ]
  },
  // Side stories (first written 2026-10-29 for chapter two): open once chapter two is cleared; never gate the main line.
  "vn1-s1": {
    number: 1, side: true, after: "vn1-c2", titleKey: "S21_TITLE", summaryKey: "S21_SUMMARY", echoKey: "S21_ECHO", reward: { tickets: 3 },
    beats: [
      { type: "bg", id: "town", titleKey: "LOC_TOWN" },
      { type: "enter", who: "residentB", x: 0.78, face: "left" },
      { type: "tag", who: ["residentB"], to: "contestant", quiet: true },
      { type: "enter", who: "partner", x: 0.48, from: "left", face: "right" },
      { type: "bubble", who: "residentB", glyph: "sad" },
      { type: "line", speaker: "residentB", key: "S21_ASK", mood: "sad" },
      { type: "line", speaker: "partner", key: "S21_P1", mood: "happy" },
      { type: "tap", promptKey: "S21_HINT", targets: [{ at: [11, 60] }] },
      { type: "line", speaker: "narrator", key: "S21_F1" },
      { type: "tap", promptKey: "S21_HINT", targets: [{ at: [52, 64] }] },
      { type: "line", speaker: "narrator", key: "S21_F2" },
      { type: "tap", promptKey: "S21_HINT", targets: [{ at: [33, 66] }] },
      { type: "line", speaker: "narrator", key: "S21_F3" },
      { type: "act", who: "partner", action: "cheer" },
      { type: "line", speaker: "partner", key: "S21_P2", mood: "happy" },
      { type: "tag", who: ["residentB"], to: "restore" },
      { type: "line", speaker: "residentB", key: "S21_READ", mood: "happy" },
      { type: "bubble", who: "residentB", glyph: "heart" },
      { type: "line", speaker: "partner", key: "S21_P3", mood: "calm" },
      { type: "end" }
    ]
  },
  "vn1-s2": {
    number: 2, side: true, after: "vn1-c2", titleKey: "S22_TITLE", summaryKey: "S22_SUMMARY", echoKey: "S22_ECHO", reward: { tickets: 3 },
    beats: [
      { type: "bg", id: "plaza", titleKey: "LOC_PLAZA" },
      { type: "enter", who: "partner", x: 0.5, from: "warp", face: "right" },
      { type: "line", speaker: "narrator", key: "S22_N1" },
      { type: "line", speaker: "partner", key: "S22_P1", mood: "sad" },
      { type: "tap", promptKey: "S22_HINT", targets: [{ at: [50, 50] }] },
      { type: "line", speaker: "narrator", key: "S22_STANDS" },
      { type: "tap", promptKey: "S22_HINT", targets: [{ at: [86, 58] }] },
      { type: "line", speaker: "narrator", key: "S22_TERMINAL" },
      { type: "tap", promptKey: "S22_HINT", targets: [{ at: [12, 66] }] },
      { type: "line", speaker: "narrator", key: "S22_FOUND" },
      { type: "enter", who: "neighborB", x: 0.24, from: "left", face: "right" },
      { type: "bubble", who: "neighborB", glyph: "..." },
      { type: "move", who: "partner", x: 0.4, face: "left" },
      { type: "line", speaker: "partner", key: "S22_P2", mood: "calm" },
      { type: "line", speaker: "neighborB", key: "S22_NEI1", mood: "sad" },
      { type: "line", speaker: "partner", key: "S22_P3", mood: "happy" },
      { type: "act", who: "neighborB", action: "cheer" },
      { type: "line", speaker: "neighborB", key: "S22_NEI2", mood: "happy" },
      { type: "end" }
    ]
  }
});

export const STORY_VN_CHAPTER_IDS = Object.freeze(Object.keys(STORY_VN_CHAPTERS));
/** The main line, in order (side stories excluded). */
export const STORY_VN_MAIN_IDS = Object.freeze(STORY_VN_CHAPTER_IDS.filter(id => !STORY_VN_CHAPTERS[id].side));
export const STORY_VN_SIDE_IDS = Object.freeze(STORY_VN_CHAPTER_IDS.filter(id => STORY_VN_CHAPTERS[id].side));

export const storyVnChapter = id => STORY_VN_CHAPTERS[id] ?? null;
/** `story:vn1:c3` for the main line, `story:vn1:s1` for a side story. */
export const storyVnRewardKey = id => `${STORY_VN_REWARD_PREFIX}${STORY_VN_CHAPTERS[id]?.side ? "s" : "c"}${STORY_VN_CHAPTERS[id]?.number ?? 0}`;
export const storyVnBackground = id => STORY_VN_BACKGROUNDS[id] ?? null;

/**
 * Chapter states from the claimed reward keys: 'cleared' once claimed; 'open'
 * when the gate before it is passed (the first chapter opens once `entryOpen`);
 * otherwise 'locked'.
 */
export function storyVnChapterStates(claimedKeys = [], { entryOpen = true } = {}) {
  const claimed = new Set(Array.isArray(claimedKeys) ? claimedKeys : []);
  const cleared = id => claimed.has(storyVnRewardKey(id));
  let previousCleared = Boolean(entryOpen);
  const main = STORY_VN_MAIN_IDS.map(id => {
    const state = cleared(id) ? "cleared" : previousCleared ? "open" : "locked";
    previousCleared = cleared(id);
    return Object.freeze({ id, number: STORY_VN_CHAPTERS[id].number, side: false, state });
  });
  // A side story opens once the chapter it follows is cleared.
  const side = STORY_VN_SIDE_IDS.map(id => Object.freeze({ id, number: STORY_VN_CHAPTERS[id].number, side: true,
    state: cleared(id) ? "cleared" : cleared(STORY_VN_CHAPTERS[id].after) ? "open" : "locked" }));
  return Object.freeze([...main, ...side]);
}

/** The structural problems of a chapter (empty when it is playable). */
export function validateStoryVnChapter(id, chapter = STORY_VN_CHAPTERS[id]) {
  const problems = [];
  if (!chapter) return [`${id}: missing`];
  const labels = new Set(chapter.beats.map(beat => beat.label).filter(Boolean));
  const onStage = new Set();
  chapter.beats.forEach((beat, index) => {
    const at = `${id}#${index}`;
    if (!STORY_VN_BEAT_TYPES.includes(beat.type)) problems.push(`${at}: type ${beat.type}`);
    if (beat.type === "bg" && !STORY_VN_BACKGROUNDS[beat.id]) problems.push(`${at}: background ${beat.id}`);
    if (["enter", "exit", "move", "act", "bubble"].includes(beat.type) && !STORY_VN_CAST[beat.who]) problems.push(`${at}: cast ${beat.who}`);
    if (beat.type === "enter") onStage.add(beat.who);
    if (beat.type === "line") {
      if (!STORY_VN_SPEAKERS[beat.speaker]) problems.push(`${at}: speaker ${beat.speaker}`);
      if (beat.mood && !STORY_VN_MOODS.includes(beat.mood)) problems.push(`${at}: mood ${beat.mood}`);
    }
    if (beat.type === "act" && !STORY_VN_ACTIONS.includes(beat.action)) problems.push(`${at}: action ${beat.action}`);
    if (beat.type === "bubble" && !STORY_VN_BUBBLES.includes(beat.glyph)) problems.push(`${at}: bubble ${beat.glyph}`);
    if (beat.type === "fx" && !STORY_VN_FX.includes(beat.kind)) problems.push(`${at}: fx ${beat.kind}`);
    if (beat.type === "tag" && beat.who.some(who => !STORY_VN_CAST[who])) problems.push(`${at}: tag cast`);
    if (beat.type === "tap" && (!beat.targets?.length || beat.targets.some(t => !(Array.isArray(t.at) || STORY_VN_CAST[t.who])))) problems.push(`${at}: tap targets`);
    if (beat.type === "battle" && (!beat.presets?.length || !labels.has(beat.win) || !labels.has(beat.lose))) problems.push(`${at}: battle branches`);
    if (beat.type === "jump" && !labels.has(beat.next)) problems.push(`${at}: jump ${beat.next}`);
    if (beat.type === "choice" && beat.options.some(option => !labels.has(option.next))) problems.push(`${at}: choice target`);
  });
  if (chapter.beats.at(-1)?.type !== "end") problems.push(`${id}: no end`);
  return problems;
}

/** Every text key a chapter reads (for the locale gate and the tests). */
export function storyVnChapterKeys(id) {
  const chapter = STORY_VN_CHAPTERS[id];
  if (!chapter) return [];
  const keys = new Set([chapter.titleKey, chapter.summaryKey, chapter.echoKey]);
  for (const beat of chapter.beats) {
    for (const field of ["key", "titleKey", "subKey", "promptKey", "overwrite"]) if (typeof beat[field] === "string") keys.add(beat[field]);
    if (beat.type === "file") keys.add(`${beat.key}_BODY`);
    if (beat.type === "line") { const name = STORY_VN_SPEAKERS[beat.speaker]?.nameKey; if (name) keys.add(name); }
    for (const option of beat.options ?? []) keys.add(option.key);
    for (const key of beat.keys ?? []) keys.add(key);
    for (const key of beat.labels ?? []) keys.add(key);
  }
  return [...keys];
}
