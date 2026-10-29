// Data Area story mode, part one: "Unheard Echoes" (OWNER_APPROVED_ADAPTATION
// 2026-10-29). Six playable chapters staged on the Data Area grid theater
// (presentation/story/DataAreaCyberStage.js). Pure data plus lookups: no
// imports, no ROM evidence, never a save field. Every actor is one of the
// product's own 218 partners (species index -> the public character runtime);
// the human cast speak through name plates only.
//
// Progress is derived from the Cyber Gachapon once-only reward ledger: a
// chapter is cleared once its reward key `story:da1:cN` was claimed, so the
// canonical save carries it without a new field.
//
// Beat schema (dataAreaStoryDirector.js reads exactly these):
//   scene     {set, props:[{id, kind, at:[x,y]}]}      stage set and props
//   enter     {who, at:[x,y], from?:'left'|'right'|'warp'|'rift', face?}
//   exit      {who, to?:'left'|'right'|'warp'}
//   move      {who, to:[x,y]}                          walks with the walk cells
//   act       {who, action:'idle'|'walk'|'attack'|'hit'|'cheer', face?}
//   bubble    {who, glyph:'!'|'?'|'...'|'heart'|'note'|'sad'|'spark'}
//   line      {speaker, key}                           dialogue (speaker -> name plate)
//   choice    {key, options:[{key, next}]}
//   mech      {id:'sign'|'flower'|'overwrite-names'|'overwrite-line'|'awaken', ...}
//   task      {id:'gift'|'break-echo'|'cosign'|'identify', count?}
//   clash     {id, foe, ally?, rounds, kind:'spar'|'vanguard'|'boss', win, lose}
//   file      {key}          a document card     warning {}        noise {on}
//   objectives{keys?, done?}                       wait {ms}   jump {next}   end
// Positions are on the floating platform's top face: x -1 (left) .. 1 (right),
// y -1 (back) .. 1 (front). `label` on any beat is a jump target.
// Text keys resolve in DATA_AREA_STORY_COPY (text/dataAreaStoryText.js).

export const DATA_AREA_STORY_SCHEMA_VERSION = 1;
export const DATA_AREA_REWARD_PREFIX = "story:da1:";
export const DATA_AREA_BEAT_TYPES = Object.freeze(["scene", "enter", "exit", "move", "act", "bubble", "line", "choice", "mech", "task", "clash",
  "file", "warning", "noise", "objectives", "wait", "jump", "end", "field", "explore", "camera", "fade"]);
/** 3-D locations modelled in Blender (scripts/build-story-field.py -> assets/production/story/fields-v1/<id>/). */
export const DATA_AREA_FIELDS = Object.freeze(["habitat", "plaza"]);
export const DATA_AREA_ACTIONS = Object.freeze(["idle", "walk", "attack", "hit", "cheer"]);
export const DATA_AREA_BUBBLES = Object.freeze(["!", "?", "...", "heart", "note", "sad", "spark"]);
export const DATA_AREA_MECHANISMS = Object.freeze(["sign", "flower", "overwrite-names", "overwrite-line", "awaken"]);
export const DATA_AREA_TASKS = Object.freeze(["gift", "break-echo", "cosign", "identify"]);
export const DATA_AREA_PROP_KINDS = Object.freeze(["warp", "terminal", "flower", "broadcast", "rift", "desk", "banner-lumen", "banner-iron", "banner-lotus",
  "lotus-lamp", "bed", "gate", "spiral"]);
export const DATA_AREA_SETS = Object.freeze(["hub", "habitat", "arena", "rift", "lotus", "terminal", "void", "final"]);
/** Native sequences the stage loads for every actor (the Data Arena's audited ids). */
export const DATA_AREA_SEQUENCES = Object.freeze({ idle: 0, walk: 2, attack: 7, hit: 6, cheer: 33 });

const freezeDeep = value => {
  if (Array.isArray(value)) { for (const item of value) freezeDeep(item); return Object.freeze(value); }
  if (value && typeof value === "object") { for (const item of Object.values(value)) freezeDeep(item); return Object.freeze(value); }
  return value;
};

/** The three factions: crest colours for the badges, copy keys for stance and blind spot. */
export const DATA_AREA_FACTIONS = freezeDeep({
  lumen: { nameKey: "FACTION_LUMEN", stanceKey: "FACTION_LUMEN_STANCE", blindKey: "FACTION_LUMEN_BLIND", colors: ["#2fd18b", "#ffd36a"], crest: "leaf" },
  iron: { nameKey: "FACTION_IRON", stanceKey: "FACTION_IRON_STANCE", blindKey: "FACTION_IRON_BLIND", colors: ["#2a2f3a", "#3ab8ff"], crest: "gear" },
  lotus: { nameKey: "FACTION_LOTUS", stanceKey: "FACTION_LOTUS_STANCE", blindKey: "FACTION_LOTUS_BLIND", colors: ["#4a2366", "#e6e9f5"], crest: "lotus" }
});

/**
 * Actors on the stage. `species` is the product species index; the player's
 * partner is resolved at play time. `tagKey` is the floating name tag that
 * the overwrite glitch rewrites; `faction` tints the tag.
 */
export const DATA_AREA_CAST = freezeDeep({
  partner: { species: null, tagKey: null, faction: null },
  partnerAwake: { species: null, tagKey: null, faction: null, awakenOf: "partner" },
  rivalMon: { species: 50, tagKey: "TAG_RIVAL_MON", faction: "iron", heavy: true, preset: 491 }, // GR23 Clockwork Dragon
  rivalMonAwake: { species: 169, tagKey: "TAG_RIVAL_MON", faction: "iron", heavy: true },
  envoyMon: { species: 92, tagKey: "TAG_ENVOY", faction: "lumen" },
  caretakerMon: { species: 175, tagKey: "TAG_CARETAKER", faction: "lotus" },
  hushMon: { species: 176, tagKey: "TAG_HUSH", faction: "lotus" },
  registrarMon: { species: 88, tagKey: "TAG_REGISTRAR", faction: null },
  mechanicMon: { species: 52, tagKey: "TAG_MECHANIC", faction: null },
  resident: { species: 65, tagKey: "TAG_RESIDENT", faction: "lotus" },
  residentB: { species: 177, tagKey: "TAG_RESIDENT_B", faction: null },
  residentC: { species: 58, tagKey: "TAG_RESIDENT_C", faction: null },
  neighborA: { species: 18, tagKey: "TAG_NEIGHBOR_A", faction: null },
  neighborB: { species: 25, tagKey: "TAG_NEIGHBOR_B", faction: null },
  guide: { species: 51, tagKey: "TAG_GUIDE", faction: null },
  vanguard: { species: 78, tagKey: null, faction: null, overwritten: true, preset: 515 },
  vanguardB: { species: 78, tagKey: null, faction: null, overwritten: true },
  vessel: { species: 148, tagKey: "TAG_VESSEL", faction: null, overwritten: true, boss: true, preset: 542 }
});

/** Speakers: name-plate key, and the actor that "talks" on stage (or none). */
export const DATA_AREA_SPEAKERS = freezeDeep({
  narrator: { nameKey: "SPEAKER_NARRATOR", actor: null },
  partner: { nameKey: "SPEAKER_PARTNER", actor: "partner" },
  rival: { nameKey: "SPEAKER_RIVAL", actor: "rivalMon", faction: "iron" },
  envoy: { nameKey: "SPEAKER_ENVOY", actor: "envoyMon", faction: "lumen" },
  caretaker: { nameKey: "SPEAKER_CARETAKER", actor: "caretakerMon", faction: "lotus" },
  hush: { nameKey: "SPEAKER_HUSH", actor: "hushMon", faction: "lotus" },
  registrar: { nameKey: "SPEAKER_REGISTRAR", actor: "registrarMon" },
  mechanic: { nameKey: "SPEAKER_MECHANIC", actor: "mechanicMon" },
  resident: { nameKey: "SPEAKER_RESIDENT", actor: "resident" },
  guide: { nameKey: "SPEAKER_GUIDE", actor: "guide" },
  vessel: { nameKey: "SPEAKER_VESSEL", actor: "vessel" },
  neighborA: { nameKey: "TAG_NEIGHBOR_A", actor: "neighborA" },
  neighborB: { nameKey: "TAG_NEIGHBOR_B", actor: "neighborB" }
});

const P = (id, kind, x, y) => ({ id, kind, at: [x, y] });

export const DATA_AREA_CHAPTERS = freezeDeep({
  "da1-c1": {
    number: 1, titleKey: "C1_TITLE", summaryKey: "C1_SUMMARY", echoKey: "C1_ECHO",
    reward: { tickets: 6, metals: { "metal:emma-shard": 2 } }, link: "FREE_BATTLE", factions: ["iron"],
    cast: ["partner", "registrarMon", "rivalMon", "neighborA", "neighborB"],
    beats: [
      // The partner habitat (3-D field): walk, meet the neighbours, find the gift, then the warp gate.
      { type: "field", location: "habitat" },
      { type: "enter", who: "partner", at: "spawn", face: "left" },
      { type: "fade", dir: "in" },
      { type: "line", speaker: "narrator", key: "C1_N1" },
      { type: "bubble", who: "partner", glyph: "note" },
      { type: "explore", hintKey: "HINT_GIFT", mark: "gift",
        npcs: [
          { who: "neighborA", at: "npc_moon", face: "right", talk: [{ speaker: "neighborA", key: "HAB_A_1" }, { speaker: "neighborA", key: "HAB_A_2" }] },
          { who: "neighborB", at: "npc_bell", face: "left", talk: [{ speaker: "neighborB", key: "HAB_B_1" }, { speaker: "partner", key: "HAB_B_2" }] }
        ],
        triggers: {
          gift: { once: true, required: true, mark: "gate", hintAfter: "HINT_GATE", beats: [
            { type: "camera", target: "partner", ms: 500 },
            { type: "bubble", who: "partner", glyph: "!" },
            { type: "task", id: "gift" },
            { type: "line", speaker: "partner", key: "C1_P_GIFT" },
            { type: "line", speaker: "narrator", key: "C1_N2" }] },
          nest: { beats: [{ type: "act", who: "partner", action: "cheer" }, { type: "line", speaker: "partner", key: "HAB_NEST" }] },
          sign: { beats: [{ type: "line", speaker: "narrator", key: "HAB_SIGN" }] },
          lookout: { beats: [{ type: "camera", target: "partner", ms: 400 }, { type: "bubble", who: "partner", glyph: "spark" }, { type: "line", speaker: "partner", key: "HAB_LOOKOUT" }] }
        },
        exits: { gate: { requires: ["gift"], lockedKey: "HAB_GATE_LOCKED" } } },
      { type: "act", who: "partner", action: "cheer", face: "right" },
      { type: "line", speaker: "partner", key: "C1_P_DOOR" },
      { type: "fade", dir: "out" },
      // The tournament plaza (3-D field): sign up at the terminal, then the rival arrives.
      { type: "field", location: "plaza", label: "plaza" },
      { type: "enter", who: "partner", at: "spawn", from: "warp", face: "left" },
      { type: "fade", dir: "in" },
      { type: "explore", hintKey: "HINT_SIGNUP", mark: "terminal",
        npcs: [{ who: "registrarMon", at: "registrar", face: "left", talk: [{ speaker: "registrar", key: "C1_REG1" }] }],
        triggers: {
          terminal: { once: true, required: true, ends: true, beats: [
            { type: "camera", target: "partner", ms: 500 },
            { type: "line", speaker: "registrar", key: "C1_REG1" },
            { type: "mech", id: "sign", label: "sign", spot: "sign_spot" },
            { type: "line", speaker: "registrar", key: "C1_REG2" },
            { type: "line", speaker: "partner", key: "C1_P_NAME" }] },
          stands: { beats: [{ type: "line", speaker: "narrator", key: "PLAZA_STANDS" }] }
        },
        exits: { arena: { requires: ["terminal"], lockedKey: "PLAZA_ARENA_LOCKED" } } },
      { type: "move", who: "partner", to: "duel", face: "right" },
      { type: "camera", target: "flower", ms: 700 },
      { type: "mech", id: "flower", label: "flower", who: "rivalMon", prop: "flower", from: "rival_enter", to: "rival_stop" },
      { type: "camera", target: "partner", ms: 600 },
      { type: "line", speaker: "rival", key: "C1_RIN1" },
      { type: "line", speaker: "rival", key: "C1_RIN2" },
      { type: "line", speaker: "rival", key: "C1_RIN3" },
      { type: "clash", id: "c1-spar", foe: "rivalMon", rounds: 3, kind: "spar", win: "won", lose: "lost" },
      { type: "line", speaker: "rival", key: "C1_RIN_WIN", label: "won" },
      { type: "jump", next: "after" },
      { type: "act", who: "partner", action: "cheer", label: "lost" },
      { type: "bubble", who: "partner", glyph: "heart" },
      { type: "line", speaker: "partner", key: "C1_P_LOSE" },
      { type: "line", speaker: "rival", key: "C1_RIN_LOSE" },
      { type: "line", speaker: "narrator", key: "C1_N_END", label: "after" },
      { type: "end" }
    ]
  },
  "da1-c2": {
    number: 2, titleKey: "C2_TITLE", summaryKey: "C2_SUMMARY", echoKey: "C2_ECHO",
    reward: { tickets: 6, metals: { "metal:beta-shard": 2 } }, link: "CHAMPIONSHIP", factions: ["lumen", "iron"],
    cast: ["partner", "registrarMon", "mechanicMon", "rivalMon", "envoyMon"],
    beats: [
      { type: "scene", set: "arena", props: [P("desk", "desk", 0.5, -0.5), P("flag", "banner-iron", -0.78, -0.62), P("flag2", "banner-lumen", 0.84, -0.66), P("bc", "broadcast", -0.6, -0.2)] },
      { type: "enter", who: "partner", at: [-0.2, 0.35], face: "right" },
      { type: "enter", who: "registrarMon", at: [0.55, -0.42], face: "left" },
      { type: "line", speaker: "narrator", key: "C2_N1" },
      { type: "noise", on: true },
      { type: "line", speaker: "registrar", key: "C2_REG1" },
      { type: "mech", id: "overwrite-names", targets: ["registrar"], to: "contestant" },
      { type: "line", speaker: "registrar", key: "C2_REG2" },
      { type: "enter", who: "mechanicMon", at: [0.3, 0.55], from: "right", face: "left" },
      { type: "mech", id: "overwrite-names", targets: ["mechanic"], to: "contestant" },
      { type: "line", speaker: "mechanic", key: "C2_BARD1" },
      { type: "line", speaker: "narrator", key: "C2_N2" },
      { type: "bubble", who: "partner", glyph: "?" },
      { type: "line", speaker: "partner", key: "C2_P1" },
      { type: "warning", subKey: "WARNING_SUB_EVAC" },
      { type: "scene", set: "arena", props: [P("rift", "rift", -0.7, -0.1), P("flag", "banner-iron", -0.78, -0.62), P("gate", "gate", 0.82, -0.3)] },
      { type: "act", who: "partner", action: "hit", face: "left" },
      { type: "enter", who: "rivalMon", at: [-0.4, 0.3], from: "right", face: "left" },
      { type: "act", who: "rivalMon", action: "attack", face: "left" },
      { type: "line", speaker: "rival", key: "C2_RIN1" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "partner", key: "C2_P2" },
      { type: "noise", on: false },
      { type: "enter", who: "envoyMon", at: [0.55, -0.15], from: "warp", face: "left" },
      { type: "line", speaker: "envoy", key: "C2_EI1" },
      { type: "file", key: "C2_FILE_COUNCIL" },
      { type: "line", speaker: "rival", key: "C2_RIN2" },
      { type: "file", key: "C2_FILE_IRON" },
      { type: "line", speaker: "narrator", key: "C2_N3" },
      { type: "choice", key: "C2_CHOICE", options: [{ key: "C2_OPT_COUNCIL", next: "council" }, { key: "C2_OPT_IRON", next: "iron" }] },
      { type: "line", speaker: "envoy", key: "C2_EI_PICK", label: "council" },
      { type: "jump", next: "rejoin" },
      { type: "line", speaker: "rival", key: "C2_RIN_PICK", label: "iron" },
      { type: "line", speaker: "partner", key: "C2_P3", label: "rejoin" },
      { type: "line", speaker: "envoy", key: "C2_EI2" },
      { type: "act", who: "partner", action: "cheer" },
      { type: "line", speaker: "partner", key: "C2_P4" },
      { type: "end" }
    ]
  },
  "da1-c3": {
    number: 3, titleKey: "C3_TITLE", summaryKey: "C3_SUMMARY", echoKey: "C3_ECHO",
    reward: { tickets: 7, metals: { "metal:chrono-ore-shard": 1 } }, link: "HUNT", factions: ["iron", "lotus"],
    cast: ["partner", "rivalMon", "guide", "caretakerMon", "resident"],
    beats: [
      { type: "scene", set: "rift", props: [P("rift", "rift", -0.72, -0.35), P("bc", "broadcast", 0.6, -0.45), P("warp", "warp", 0.05, 0.55)] },
      { type: "line", speaker: "narrator", key: "C3_N1" },
      { type: "enter", who: "partner", at: [0.05, 0.45], from: "warp", face: "left" },
      { type: "enter", who: "rivalMon", at: [0.45, 0.4], from: "warp", face: "left" },
      { type: "line", speaker: "rival", key: "C3_RIN1" },
      { type: "enter", who: "guide", at: [-0.45, -0.2], from: "rift", face: "right" },
      { type: "bubble", who: "guide", glyph: "..." },
      { type: "line", speaker: "narrator", key: "C3_N2" },
      { type: "line", speaker: "rival", key: "C3_RIN2" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "move", who: "partner", to: [-0.15, 0.05] },
      { type: "line", speaker: "partner", key: "C3_P1" },
      { type: "line", speaker: "narrator", key: "C3_N3" },
      { type: "line", speaker: "guide", key: "C3_HUM1" },
      { type: "line", speaker: "rival", key: "C3_RIN3" },
      { type: "task", id: "break-echo", count: 3, prop: "bc" },
      { type: "line", speaker: "narrator", key: "C3_N4" },
      { type: "scene", set: "lotus", props: [P("lamp1", "lotus-lamp", -0.75, -0.45), P("lamp2", "lotus-lamp", 0.78, -0.42), P("bed", "bed", -0.35, -0.5), P("term", "terminal", 0.4, -0.55), P("flag", "banner-lotus", 0, -0.75)] },
      { type: "enter", who: "partner", at: [-0.5, 0.45], from: "warp", face: "right" },
      { type: "enter", who: "caretakerMon", at: [0.55, 0.05], face: "left" },
      { type: "enter", who: "resident", at: [-0.05, -0.2], face: "right" },
      { type: "line", speaker: "caretaker", key: "C3_SHIZU1" },
      { type: "bubble", who: "resident", glyph: "sad" },
      { type: "mech", id: "overwrite-line", label: "overwrite", speaker: "resident", fromKey: "C3_RES_TRUE", toKey: "C3_RES_FORCED" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "partner", key: "C3_P2" },
      { type: "line", speaker: "caretaker", key: "C3_SHIZU2" },
      { type: "line", speaker: "caretaker", key: "C3_SHIZU3" },
      { type: "line", speaker: "narrator", key: "C3_N5" },
      { type: "end" }
    ]
  },
  "da1-c4": {
    number: 4, titleKey: "C4_TITLE", summaryKey: "C4_SUMMARY", echoKey: "C4_ECHO",
    reward: { tickets: 7, metals: { "metal:chrono-metal-shard": 1 } }, link: "DATA_ARENA", factions: ["lumen", "iron"],
    cast: ["partner", "rivalMon", "envoyMon", "residentB", "residentC", "resident"],
    beats: [
      { type: "scene", set: "terminal", props: [P("term", "terminal", 0, -0.55), P("flag", "banner-lumen", -0.8, -0.6), P("flag2", "banner-iron", 0.8, -0.6)] },
      { type: "enter", who: "partner", at: [0, 0.45], from: "warp", face: "left" },
      { type: "enter", who: "envoyMon", at: [-0.6, 0.05], face: "right" },
      { type: "enter", who: "rivalMon", at: [0.6, 0.05], face: "left" },
      { type: "line", speaker: "narrator", key: "C4_N1" },
      { type: "task", id: "cosign", prop: "term" },
      { type: "file", key: "C4_FILE_PLAN" },
      { type: "line", speaker: "envoy", key: "C4_EI1" },
      { type: "line", speaker: "rival", key: "C4_RIN1" },
      { type: "line", speaker: "partner", key: "C4_P1" },
      { type: "line", speaker: "narrator", key: "C4_N2" },
      { type: "scene", set: "terminal", props: [P("flag", "banner-iron", 0, -0.72), P("gate", "gate", -0.82, -0.25), P("gate2", "gate", 0.82, -0.25)] },
      { type: "enter", who: "partner", at: [0, 0.5], from: "warp", face: "left" },
      { type: "enter", who: "residentB", at: [-0.55, -0.15], face: "right" },
      { type: "enter", who: "resident", at: [0, -0.35], face: "right" },
      { type: "enter", who: "residentC", at: [0.55, -0.15], face: "left" },
      { type: "mech", id: "overwrite-names", targets: ["resident", "residentB", "residentC"], to: "contestant", quiet: true },
      { type: "task", id: "identify", count: 3, targets: ["residentB", "resident", "residentC"] },
      { type: "line", speaker: "partner", key: "C4_P2" },
      { type: "line", speaker: "rival", key: "C4_RIN2" },
      { type: "choice", key: "C4_CHOICE", options: [{ key: "C4_OPT_DONE", next: "done" }, { key: "C4_OPT_SWAP", next: "swap" }] },
      { type: "line", speaker: "rival", key: "C4_RIN_DONE", label: "done" },
      { type: "jump", next: "rejoin" },
      { type: "line", speaker: "rival", key: "C4_RIN_SWAP", label: "swap" },
      { type: "line", speaker: "narrator", key: "C4_N3", label: "rejoin" },
      { type: "end" }
    ]
  },
  "da1-c5": {
    number: 5, titleKey: "C5_TITLE", summaryKey: "C5_SUMMARY", echoKey: "C5_ECHO",
    reward: { tickets: 8, metals: { "metal:supernova-shard": 1 } }, link: "DATA_ARENA", factions: ["lotus", "iron", "lumen"],
    cast: ["partner", "hushMon", "rivalMon", "vanguard", "vanguardB", "envoyMon"],
    beats: [
      { type: "scene", set: "void", props: [P("spiral", "spiral", 0, -0.7), P("rift", "rift", -0.75, -0.3), P("rift2", "rift", 0.78, -0.3)] },
      { type: "noise", on: true },
      { type: "line", speaker: "narrator", key: "C5_N1" },
      { type: "enter", who: "partner", at: [-0.45, 0.42], from: "warp", face: "right" },
      { type: "enter", who: "envoyMon", at: [-0.78, -0.28], from: "warp", face: "right" },
      { type: "enter", who: "hushMon", at: [0.4, -0.3], from: "rift", face: "left" },
      { type: "line", speaker: "hush", key: "C5_HUSH1" },
      { type: "line", speaker: "hush", key: "C5_HUSH2" },
      { type: "mech", id: "overwrite-names", targets: ["envoy"], to: "contestant" },
      { type: "line", speaker: "hush", key: "C5_HUSH3" },
      { type: "choice", key: "C5_CHOICE", options: [{ key: "C5_OPT_KEEP", next: "answer" }, { key: "C5_OPT_REST", next: "answer" }] },
      { type: "act", who: "partner", action: "cheer", label: "answer" },
      { type: "line", speaker: "partner", key: "C5_ANSWER" },
      { type: "mech", id: "overwrite-names", targets: ["envoy"], to: "restore" },
      { type: "warning", subKey: "WARNING_SUB_OVERWRITE" },
      { type: "exit", who: "hushMon", to: "rift" },
      { type: "enter", who: "vanguard", at: [0.45, -0.1], from: "rift", face: "left" },
      { type: "enter", who: "vanguardB", at: [0.74, 0.4], from: "rift", face: "left" },
      { type: "enter", who: "rivalMon", at: [-0.08, 0.66], from: "left", face: "right" },
      { type: "line", speaker: "rival", key: "C5_RIN1" },
      { type: "clash", id: "c5-vanguard", foe: "vanguard", ally: "rivalMon", rounds: 3, kind: "vanguard", win: "after", lose: "after" },
      { type: "line", speaker: "partner", key: "C5_P2", label: "after" },
      { type: "noise", on: false },
      { type: "line", speaker: "narrator", key: "C5_N2" },
      { type: "end" }
    ]
  },
  "da1-c6": {
    number: 6, titleKey: "C6_TITLE", summaryKey: "C6_SUMMARY", echoKey: "C6_ECHO",
    reward: { tickets: 12, metals: { "metal:supernova": 1 } }, link: "CHAMPIONSHIP", factions: ["iron", "lumen", "lotus"],
    cast: ["partner", "partnerAwake", "rivalMonAwake", "envoyMon", "caretakerMon", "vessel", "registrarMon"],
    beats: [
      { type: "scene", set: "final", props: [P("gate", "gate", -0.85, 0.05), P("rift", "rift", 0.78, -0.45), P("spiral", "spiral", 0.2, -0.78), P("warp", "warp", -0.2, 0.6)] },
      { type: "objectives", keys: ["OBJ_CUT", "OBJ_CONTEXT", "OBJ_CHOICE"], done: 0 },
      { type: "line", speaker: "narrator", key: "C6_N1" },
      { type: "enter", who: "partner", at: [-0.35, 0.42], from: "warp", face: "right" },
      { type: "enter", who: "rivalMonAwake", at: [0.62, 0.36], from: "warp", face: "left" },
      { type: "line", speaker: "rival", key: "C6_RIN1" },
      { type: "objectives", done: 1 },
      { type: "enter", who: "envoyMon", at: [-0.7, -0.15], from: "warp", face: "right" },
      { type: "line", speaker: "envoy", key: "C6_EI1" },
      { type: "exit", who: "envoyMon", to: "warp" },
      { type: "objectives", done: 2 },
      { type: "enter", who: "caretakerMon", at: [-0.1, -0.4], from: "warp", face: "left" },
      { type: "line", speaker: "caretaker", key: "C6_SHIZU1" },
      { type: "exit", who: "caretakerMon", to: "warp" },
      { type: "noise", on: true },
      { type: "enter", who: "vessel", at: [0.12, -0.42], from: "rift", face: "left" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "vessel", key: "C6_VOID1" },
      { type: "line", speaker: "rival", key: "C6_RIN2" },
      { type: "move", who: "partner", to: [-0.6, 0.3] },
      { type: "act", who: "partner", action: "idle", face: "right" },
      { type: "line", speaker: "partner", key: "C6_P_LEFT", label: "left" },
      { type: "mech", id: "awaken", who: "partner", into: "partnerAwake" },
      { type: "clash", id: "c6-boss", foe: "vessel", ally: "rivalMonAwake", rounds: 4, kind: "boss", win: "saved", lose: "saved" },
      { type: "objectives", done: 3, label: "saved" },
      { type: "noise", on: false },
      { type: "exit", who: "vessel", to: "rift" },
      { type: "line", speaker: "narrator", key: "C6_N2" },
      { type: "scene", set: "arena", props: [P("desk", "desk", 0.5, -0.5), P("flag", "banner-iron", -0.8, -0.62), P("flag2", "banner-lumen", 0.84, -0.66), P("flag3", "banner-lotus", 0, -0.78), P("gate", "gate", -0.82, 0.2)] },
      { type: "line", speaker: "narrator", key: "C6_EP1" },
      { type: "line", speaker: "narrator", key: "C6_EP2" },
      { type: "enter", who: "partnerAwake", at: [-0.1, 0.35], from: "warp", face: "right" },
      { type: "enter", who: "registrarMon", at: [0.55, -0.42], face: "left" },
      { type: "mech", id: "overwrite-names", targets: ["registrar"], to: "contestant", quiet: true },
      { type: "line", speaker: "registrar", key: "C6_REG1" },
      { type: "mech", id: "overwrite-names", targets: ["registrar"], to: "restore" },
      { type: "line", speaker: "registrar", key: "C6_REG2" },
      { type: "act", who: "partnerAwake", action: "cheer" },
      { type: "bubble", who: "partnerAwake", glyph: "heart" },
      { type: "enter", who: "rivalMonAwake", at: [-0.62, 0.25], from: "left", face: "right" },
      { type: "act", who: "rivalMonAwake", action: "cheer" },
      { type: "line", speaker: "rival", key: "C6_RIN3" },
      { type: "line", speaker: "narrator", key: "C6_END" },
      { type: "end" }
    ]
  }
});

export const DATA_AREA_CHAPTER_IDS = Object.freeze(Object.keys(DATA_AREA_CHAPTERS));

/**
 * The investigation log (Story Echo Log): three one-line answers that unlock
 * as chapters clear, so a new player can follow the cause without the jargon.
 */
export const DATA_AREA_ECHO_LOG = freezeDeep([
  { id: "why-rift", titleKey: "LOG_Q1", bodyKey: "LOG_A1", unlockAfter: "da1-c3", icon: "rift" },
  { id: "why-together", titleKey: "LOG_Q2", bodyKey: "LOG_A2", unlockAfter: "da1-c4", icon: "handshake" },
  { id: "partner-choice", titleKey: "LOG_Q3", bodyKey: "LOG_A3", unlockAfter: "da1-c6", icon: "heart" }
]);

/** Where each chapter's "go play" link leads (main.js resolves these). */
export const DATA_AREA_LINKS = Object.freeze(["FREE_BATTLE", "CHAMPIONSHIP", "HUNT", "DATA_ARENA"]);

export const dataAreaChapter = id => DATA_AREA_CHAPTERS[id] ?? null;
export const dataAreaRewardKey = id => `${DATA_AREA_REWARD_PREFIX}c${DATA_AREA_CHAPTERS[id]?.number ?? 0}`;

/**
 * Chapter states from the claimed reward keys: 'cleared' once claimed, 'open'
 * for the first chapter and any whose predecessor cleared, else 'locked'.
 * The current chapter is the first open one (or the last when all cleared).
 */
export function dataAreaChapterStates(claimedKeys = []) {
  const claimed = new Set(Array.isArray(claimedKeys) ? claimedKeys : []);
  let previousCleared = true;
  const states = DATA_AREA_CHAPTER_IDS.map(id => {
    const cleared = claimed.has(dataAreaRewardKey(id));
    const state = cleared ? "cleared" : previousCleared ? "open" : "locked";
    previousCleared = cleared;
    return { id, number: DATA_AREA_CHAPTERS[id].number, state };
  });
  const current = states.find(entry => entry.state === "open")?.id ?? states.at(-1).id;
  return Object.freeze({ chapters: freezeDeep(states), current, cleared: states.filter(entry => entry.state === "cleared").length, total: states.length });
}

/** Whether a chapter may be played: open or cleared (replay). */
export function dataAreaChapterPlayable(id, claimedKeys = []) {
  const entry = dataAreaChapterStates(claimedKeys).chapters.find(chapter => chapter.id === id);
  return Boolean(entry) && entry.state !== "locked";
}

/** The log entries with their unlock state. */
export function dataAreaEchoLog(claimedKeys = []) {
  const claimed = new Set(Array.isArray(claimedKeys) ? claimedKeys : []);
  return Object.freeze(DATA_AREA_ECHO_LOG.map(entry => Object.freeze({ ...entry, unlocked: claimed.has(dataAreaRewardKey(entry.unlockAfter)) })));
}

/** Structural problems of one chapter (empty when valid). Copy is checked by the text module. */
export function validateDataAreaChapter(chapter) {
  const problems = [];
  if (!chapter || !Array.isArray(chapter.beats) || !chapter.beats.length) return ["NO_BEATS"];
  const labels = new Set(chapter.beats.map(beat => beat.label).filter(Boolean));
  const cast = new Set(chapter.cast ?? []);
  const actorOk = who => Object.hasOwn(DATA_AREA_CAST, who) && cast.has(who);
  chapter.beats.forEach((beat, index) => {
    const at = `BEAT_${index}`;
    if (!DATA_AREA_BEAT_TYPES.includes(beat.type)) problems.push(`${at}_TYPE`);
    if (["enter", "exit", "move", "act", "bubble"].includes(beat.type) && !actorOk(beat.who)) problems.push(`${at}_ACTOR_${beat.who}`);
    if (beat.type === "field" && !DATA_AREA_FIELDS.includes(beat.location)) problems.push(`${at}_FIELD`);
    if (beat.type === "explore") {
      for (const npc of beat.npcs ?? []) if (!actorOk(npc.who) || (npc.talk ?? []).some(line => !Object.hasOwn(DATA_AREA_SPEAKERS, line.speaker))) problems.push(`${at}_NPC_${npc.who}`);
      for (const [id, trigger] of Object.entries(beat.triggers ?? {})) problems.push(...validateDataAreaChapter({ cast: chapter.cast, beats: [...(trigger.beats ?? []), { type: "end" }] }).map(p => `${at}_${id}_${p}`));
      for (const exit of Object.values(beat.exits ?? {})) if ((exit.requires ?? []).some(flag => !beat.triggers?.[flag])) problems.push(`${at}_EXIT_FLAG`);
      if (!Object.keys(beat.exits ?? {}).length) problems.push(`${at}_NO_EXIT`);
    }
    if (beat.type === "act" && !DATA_AREA_ACTIONS.includes(beat.action)) problems.push(`${at}_ACTION`);
    if (beat.type === "bubble" && !DATA_AREA_BUBBLES.includes(beat.glyph)) problems.push(`${at}_GLYPH`);
    if (beat.type === "line" && !Object.hasOwn(DATA_AREA_SPEAKERS, beat.speaker)) problems.push(`${at}_SPEAKER`);
    if (beat.type === "scene" && (!DATA_AREA_SETS.includes(beat.set) || (beat.props ?? []).some(prop => !DATA_AREA_PROP_KINDS.includes(prop.kind)))) problems.push(`${at}_SCENE`);
    if (beat.type === "mech" && !DATA_AREA_MECHANISMS.includes(beat.id)) problems.push(`${at}_MECH`);
    if (beat.type === "task" && !DATA_AREA_TASKS.includes(beat.id)) problems.push(`${at}_TASK`);
    if (beat.type === "clash" && (!actorOk(beat.foe) || (beat.ally && !actorOk(beat.ally)) || !labels.has(beat.win) || !labels.has(beat.lose))) problems.push(`${at}_CLASH`);
    if (beat.type === "jump" && !labels.has(beat.next)) problems.push(`${at}_JUMP`);
    if (beat.type === "choice" && (!Array.isArray(beat.options) || beat.options.length < 2 || beat.options.some(option => !labels.has(option.next)))) problems.push(`${at}_CHOICE`);
  });
  if (chapter.beats.at(-1)?.type !== "end") problems.push("NO_END");
  return problems;
}

/** Every copy key a chapter uses (lines, choices, files, titles, tags, warnings). */
export function dataAreaChapterKeys(chapter) {
  const keys = new Set([chapter.titleKey, chapter.summaryKey, chapter.echoKey]);
  for (const beat of chapter.beats) {
    for (const field of ["key", "fromKey", "toKey", "subKey", "hintKey"]) if (beat[field]) keys.add(beat[field]);
    if (beat.type === "file") keys.add(`${beat.key}_BODY`);
    if (beat.type === "explore") {
      for (const npc of beat.npcs ?? []) for (const line of npc.talk ?? []) keys.add(line.key);
      for (const trigger of Object.values(beat.triggers ?? {})) {
        if (trigger.hintAfter) keys.add(trigger.hintAfter);
        for (const key of dataAreaChapterKeys({ beats: trigger.beats ?? [], cast: [] })) if (key) keys.add(key);
      }
      for (const exit of Object.values(beat.exits ?? {})) if (exit.lockedKey) keys.add(exit.lockedKey);
    }
    for (const option of beat.options ?? []) keys.add(option.key);
    for (const key of beat.keys ?? []) keys.add(key);
  }
  for (const who of chapter.cast ?? []) if (DATA_AREA_CAST[who]?.tagKey) keys.add(DATA_AREA_CAST[who].tagKey);
  return [...keys];
}
