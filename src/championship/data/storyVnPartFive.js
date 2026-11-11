// Story mode part five: "The Source of the Echoes" (OWNER_APPROVED_ADAPTATION
// 2026-11-11: the Owner chose this direction -- back to part one's unheard
// echoes, to find who tore the first rift). The finale. Chapters 26-31 and four
// requests, taken at the Tamer Union hall's counter (vn3-hub); the beat schema
// is the one documented in storyVnCampaign.js. Pure data: no imports.
//
// Plot: Hush's coordinates lead to the Silent Server, the ruins of the very
// first world. The first rift was torn from the inside, by a voice. In the
// Archive of Closed Worlds the partner learns of Zero, the first partner, who
// was still waiting when its world was switched off. Its cry grew into the
// Spiral: if every voice became one, it reasoned, no one would ever go unheard
// again. Everyone the partner has met lends a "welcome back" for it; in the
// heart of the Spiral the partner wins, and Ai-chan -- made from the same kind
// of unanswered greeting -- says the words Zero waited for.

const P5 = "PART_FIVE";

export const STORY_VN_PART_FIVE_BACKGROUNDS = {
  ruins: { src: "assets/production/story/vn-backgrounds-v3/ruins.3a3aff7e732620a4.webp", motion: "assets/production/story/vn-backgrounds-v3/ruins.d870a74cbe66acb7.mp4", ambient: "petals", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] },
  rift: { src: "assets/production/story/vn-backgrounds-v3/rift.ff095b72b578e5c3.webp", motion: "assets/production/story/vn-backgrounds-v3/rift.e950fa5ba1a1c059.mp4", ambient: "shards", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] },
  archive: { src: "assets/production/story/vn-backgrounds-v3/archive.b2a531d692e51265.webp", motion: "assets/production/story/vn-backgrounds-v3/archive.4da297874d1317cc.mp4", ambient: "dust", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] },
  core: { src: "assets/production/story/vn-backgrounds-v3/core.19675bf6b4640a3e.webp", motion: "assets/production/story/vn-backgrounds-v3/core.3ca264c9d44e33ed.mp4", ambient: "shards", ground: 0.8, focus: 0.55, walk: [0.76, 0.95] }
};

export const STORY_VN_PART_FIVE_CAST = {
  zeroMon: { species: 203, tagKey: "TAG_ZERO" }, // Zero, the first partner
  guardianMon: { species: 196, tagKey: "TAG_GUARDIAN", scale: 1.2, preset: 559 }, // the rift's old guardian
  heraldMon: { species: 197, tagKey: "TAG_HERALD", overwritten: true, preset: 561 }, // the Spiral's herald
  spiralLord: { species: 202, tagKey: "TAG_SPIRAL", overwritten: true, scale: 1.6, preset: 565 } // the Spiral's true form
};

export const STORY_VN_PART_FIVE_SPEAKERS = {
  zero: { nameKey: "SPEAKER_ZERO", cast: "zeroMon" },
  guardian: { nameKey: "SPEAKER_GUARDIAN", cast: "guardianMon" },
  herald: { nameKey: "SPEAKER_HERALD", cast: "heraldMon" },
  spiral: { nameKey: "SPEAKER_SPIRAL", cast: "spiralLord" }
};

const say = (speaker, key, mood) => (mood ? { type: "line", speaker, key, mood } : { type: "line", speaker, key });
const nar = key => ({ type: "line", speaker: "narrator", key });
const won = (speaker, key, mood) => ({ ...say(speaker, key, mood), label: "won" });
const lost = (speaker, key, mood) => ({ ...say(speaker, key, mood), label: "lost" });

export const STORY_VN_PART_FIVE_CHAPTERS = {
  // ---- chapter 26: the Silent Server ----
  "vn5-c1": {
    part: 5, partKey: P5, number: 1, mapNumber: 26, titleKey: "P5C1_TITLE", summaryKey: "P5C1_SUMMARY", echoKey: "P5C1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "ruins", titleKey: "LOC_RUINS" },
      nar("P5C1_N1"),
      { type: "enter", who: "partner", x: 0.3, from: "warp", face: "right" },
      { type: "enter", who: "hushMon", x: 0.62, from: "right", face: "left" },
      say("hush", "P5C1_H1", "serious"),
      say("partner", "P5C1_P1", "think"),
      { type: "explore", field: "ruins", titleKey: "LOC_RUINS", goalKey: "P5C1_GOAL", count: ["fountain", "monument"], start: [12, 88], spots: [
        { id: "fountain", kind: "inspect", at: [15, 55], labelKey: "P5C1_L_FOUNTAIN", beats: [nar("P5C1_F1"), say("aichan", "P5C1_A1", "think")] },
        { id: "monument", kind: "inspect", at: [51, 54], labelKey: "P5C1_L_MONUMENT", beats: [{ type: "file", key: "P5C1_NOTICE" }, say("partner", "P5C1_P2", "sad")] },
        { id: "arch", kind: "npc", who: "hushMon", at: [84, 84], goal: true, after: ["fountain", "monument"], end: true, beats: [
          say("hush", "P5C1_H2", "sad"),
          say("hush", "P5C1_H3", "serious"),
          say("aichan", "P5C1_A2", "serious")
        ] }
      ] },
      nar("P5C1_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 27: the First Rift; torn from the inside ----
  "vn5-c2": {
    part: 5, partKey: P5, number: 2, mapNumber: 27, needs: 1, titleKey: "P5C2_TITLE", summaryKey: "P5C2_SUMMARY", echoKey: "P5C2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "rift", titleKey: "LOC_RIFT" },
      nar("P5C2_N1"),
      say("aichan", "P5C2_A1", "shock"),
      { type: "explore", field: "rift", titleKey: "LOC_RIFT", goalKey: "P5C2_GOAL", count: ["ice", "tower"], start: [10, 88], spots: [
        { id: "ice", kind: "inspect", at: [30, 76], labelKey: "P5C2_L_ICE", beats: [{ type: "fx", kind: "noise" }, nar("P5C2_I1"), { type: "fx", kind: "noise", on: false }, say("partner", "P5C2_P1", "shock")] },
        { id: "tower", kind: "inspect", at: [86, 40], labelKey: "P5C2_L_TOWER", beats: [nar("P5C2_T1")] },
        { id: "guardian", kind: "npc", who: "guardianMon", at: [62, 84], goal: true, after: ["ice", "tower"], end: true, beats: [
          say("guardian", "P5C2_G1", "serious"),
          say("guardian", "P5C2_G2", "serious"),
          { type: "battle", presets: [559], titleKey: "CLASH_TITLE_GUARDIAN", win: "won", lose: "lost" },
          won("guardian", "P5C2_G_WIN", "calm"),
          { type: "jump", next: "after" },
          lost("guardian", "P5C2_G_LOSE", "calm"),
          { ...say("guardian", "P5C2_G3", "sad"), label: "after" },
          say("hush", "P5C2_H1", "shock")
        ] }
      ] },
      nar("P5C2_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 28: the Archive of Closed Worlds; Zero ----
  "vn5-c3": {
    part: 5, partKey: P5, number: 3, mapNumber: 28, needs: 1, titleKey: "P5C3_TITLE", summaryKey: "P5C3_SUMMARY", echoKey: "P5C3_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "archive", titleKey: "LOC_ARCHIVE" },
      nar("P5C3_N1"),
      say("aichan", "P5C3_A1", "think"),
      { type: "explore", field: "archive", titleKey: "LOC_ARCHIVE", goalKey: "P5C3_GOAL", count: ["g1", "g2", "g3"], start: [10, 88], spots: [
        { id: "g1", kind: "inspect", at: [13, 40], labelKey: "P5C3_L1", beats: [{ type: "file", key: "P5C3_F1" }] },
        { id: "g2", kind: "inspect", at: [57, 60], labelKey: "P5C3_L2", beats: [{ type: "file", key: "P5C3_F2" }, say("partner", "P5C3_P1", "sad")] },
        { id: "g3", kind: "inspect", at: [50, 24], labelKey: "P5C3_L3", goal: true, requires: ["g1", "g2"], lockedKey: "P5C3_LOCK", end: true, beats: [{ type: "file", key: "P5C3_F3" }] }
      ] },
      say("aichan", "P5C3_A2", "sad"),
      say("hush", "P5C3_H1", "serious"),
      { type: "enter", who: "partner", x: 0.4, from: "left", face: "right" },
      { type: "choice", key: "P5C3_CHOICE", options: [{ key: "P5C3_OPT_SAVE", next: "save" }, { key: "P5C3_OPT_STOP", next: "stop" }] },
      { ...say("partner", "P5C3_P_SAVE", "serious"), label: "save" },
      { type: "jump", next: "join" },
      { ...say("partner", "P5C3_P_STOP", "serious"), label: "stop" },
      { ...say("aichan", "P5C3_A3", "serious"), label: "join" },
      nar("P5C3_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 29: the heart of the Spiral ----
  "vn5-c4": {
    part: 5, partKey: P5, number: 4, mapNumber: 29, needs: 2, titleKey: "P5C4_TITLE", summaryKey: "P5C4_SUMMARY", echoKey: "P5C4_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "core", titleKey: "LOC_CORE" },
      nar("P5C4_N1"),
      { type: "enter", who: "partner", x: 0.3, from: "rift", face: "right" },
      { type: "enter", who: "heraldMon", x: 0.72, from: "rift", face: "left" },
      say("herald", "P5C4_HR1", "serious"),
      { type: "battle", presets: [561], titleKey: "CLASH_TITLE_HERALD", win: "won", lose: "lost" },
      won("herald", "P5C4_HR_WIN", "shock"),
      { type: "jump", next: "after" },
      lost("partner", "P5C4_P_LOSE", "angry"),
      { type: "exit", who: "heraldMon", to: "warp", label: "after" },
      { type: "fx", kind: "warning", subKey: "P5C4_WARN" },
      { type: "enter", who: "spiralLord", x: 0.74, from: "rift", face: "left" },
      say("spiral", "P5C4_S1", "serious"),
      say("spiral", "P5C4_S2", "serious"),
      say("spiral", "P5C4_S3", "sad"),
      say("aichan", "P5C4_A1", "angry"),
      say("spiral", "P5C4_S4", "serious"),
      { type: "fx", kind: "shake" },
      { type: "exit", who: "partner", to: "warp" },
      nar("P5C4_N2"),
      say("aichan", "P5C4_A2", "serious"),
      { type: "end" }
    ]
  },

  // ---- chapter 30: everyone's voices ----
  "vn5-c5": {
    part: 5, partKey: P5, number: 5, mapNumber: 30, needs: 3, titleKey: "P5C5_TITLE", summaryKey: "P5C5_SUMMARY", echoKey: "P5C5_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "lobby", titleKey: "LOC_LOBBY" },
      nar("P5C5_N1"),
      say("aichan", "P5C5_A1", "talk"),
      { type: "explore", field: "lobby", titleKey: "LOC_LOBBY", goalKey: "P5C5_GOAL", count: ["rin", "subaru", "frost", "twins", "shizu"], start: [44, 90], spots: [
        { id: "rin", kind: "npc", who: "rivalMon", at: [18, 84], beats: [say("rival", "P5C5_R1", "calm")] },
        { id: "subaru", kind: "npc", who: "subaruMon", at: [32, 80], beats: [say("subaru", "P5C5_S1", "happy")] },
        { id: "frost", kind: "npc", who: "frostMon", at: [60, 86], beats: [say("frost", "P5C5_F1", "calm")] },
        { id: "twins", kind: "npc", who: "twinMon", at: [74, 80], beats: [say("twins", "P5C5_T1", "happy")] },
        { id: "shizu", kind: "npc", who: "caretakerMon", at: [86, 86], beats: [say("caretaker", "P5C5_C1", "calm")] },
        { id: "desk", kind: "npc", who: "aichan", at: [50, 79], goal: true, after: ["rin", "subaru", "frost", "twins", "shizu"], end: true, beats: [
          say("aichan", "P5C5_A2", "happy"),
          say("registrar", "P5C5_O1", "calm"),
          say("aichan", "P5C5_A3", "serious")
        ] }
      ] },
      say("partner", "P5C5_P1", "serious"),
      nar("P5C5_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 31: welcome back, Zero ----
  "vn5-c6": {
    part: 5, partKey: P5, number: 6, mapNumber: 31, needs: 4, titleKey: "P5C6_TITLE", summaryKey: "P5C6_SUMMARY", echoKey: "P5C6_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "core", titleKey: "LOC_CORE" },
      nar("P5C6_N1"),
      { type: "enter", who: "partner", x: 0.3, from: "rift", face: "right" },
      { type: "enter", who: "spiralLord", x: 0.74, from: "rift", face: "left" },
      say("spiral", "P5C6_S1", "serious"),
      { type: "enter", who: "rivalMon", x: 0.12, from: "left", face: "right" },
      { type: "enter", who: "frostMon", x: 0.2, from: "left", face: "right" },
      { type: "enter", who: "subaruMon", x: 0.46, from: "left", face: "right" },
      say("partner", "P5C6_P1", "serious"),
      say("spiral", "P5C6_S2", "angry"),
      { type: "battle", presets: [565], titleKey: "CLASH_TITLE_SPIRAL", win: "won", lose: "lost" },
      { type: "act", who: "spiralLord", action: "hit", label: "won" },
      say("spiral", "P5C6_S_WIN", "shock"),
      { type: "jump", next: "after" },
      lost("partner", "P5C6_P_LOSE", "sad"),
      say("rival", "P5C6_R_LOSE", "serious"),
      { type: "exit", who: "spiralLord", to: "warp", label: "after" },
      { type: "fx", kind: "resonance" },
      nar("P5C6_N2"),
      { type: "enter", who: "zeroMon", x: 0.7, from: "rift", face: "left" },
      say("zero", "P5C6_Z1", "sad"),
      say("zero", "P5C6_Z2", "sad"),
      say("aichan", "P5C6_A1", "happy"),
      { type: "bubble", who: "zeroMon", glyph: "heart" },
      say("zero", "P5C6_Z3", "happy"),
      { type: "act", who: "partner", action: "cheer" },
      say("partner", "P5C6_P2", "happy"),
      say("hush", "P5C6_H1", "calm"),
      nar("P5C6_N3"),
      nar("P5C6_N4"),
      { type: "end" }
    ]
  },

  // ---- requests ----
  "vn5-r1": {
    part: 5, partKey: P5, side: true, request: true, number: 1, after: "vn5-c1", titleKey: "P5R1_TITLE", summaryKey: "P5R1_SUMMARY", echoKey: "P5R1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "ruins", titleKey: "LOC_RUINS" },
      say("hush", "P5R1_H1", "calm"),
      { type: "explore", field: "ruins", titleKey: "LOC_RUINS", goalKey: "P5R1_GOAL", count: ["l1", "l2", "l3"], start: [10, 88], spots: [
        { id: "l1", kind: "inspect", at: [24, 66], labelKey: "P5R1_L", beats: [nar("P5R1_X1")] },
        { id: "l2", kind: "inspect", at: [62, 66], labelKey: "P5R1_L", beats: [nar("P5R1_X2")] },
        { id: "l3", kind: "inspect", at: [86, 60], labelKey: "P5R1_L", beats: [nar("P5R1_X3")] },
        { id: "hush", kind: "npc", who: "hushMon", at: [44, 84], goal: true, requires: ["l1", "l2", "l3"], lockedKey: "P5R1_LOCK", end: true, beats: [say("hush", "P5R1_H2", "sad")] }
      ] },
      say("hush", "P5R1_H3", "calm"),
      { type: "end" }
    ]
  },
  "vn5-r2": {
    part: 5, partKey: P5, side: true, request: true, number: 2, after: "vn5-c1", titleKey: "P5R2_TITLE", summaryKey: "P5R2_SUMMARY", echoKey: "P5R2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "lotus", titleKey: "LOC_LOTUS" },
      { type: "enter", who: "caretakerMon", x: 0.7, from: "right", face: "left" },
      { type: "enter", who: "hushMon", x: 0.84, from: "right", face: "left" },
      { type: "enter", who: "partner", x: 0.3, from: "left", face: "right" },
      say("caretaker", "P5R2_C1", "calm"),
      say("hush", "P5R2_H1", "think"),
      { type: "choice", key: "P5R2_Q", options: [{ key: "P5R2_A1", next: "a1" }, { key: "P5R2_A2", next: "a2" }] },
      { ...say("partner", "P5R2_P1", "happy"), label: "a1" },
      { type: "jump", next: "end" },
      { ...say("partner", "P5R2_P2", "calm"), label: "a2" },
      { ...say("hush", "P5R2_H2", "calm"), label: "end" },
      say("caretaker", "P5R2_C2", "happy"),
      { type: "end" }
    ]
  },
  "vn5-r3": {
    part: 5, partKey: P5, side: true, request: true, number: 3, after: "vn5-c2", titleKey: "P5R3_TITLE", summaryKey: "P5R3_SUMMARY", echoKey: "P5R3_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "arena", titleKey: "LOC_TRAINING" },
      { type: "enter", who: "rivalMon", x: 0.62, from: "right", face: "left" },
      { type: "enter", who: "frostMon", x: 0.82, from: "right", face: "left" },
      { type: "enter", who: "partner", x: 0.28, from: "left", face: "right" },
      say("rival", "P5R3_R1", "angry"),
      say("frost", "P5R3_F1", "calm"),
      say("partner", "P5R3_P1", "happy"),
      { type: "battle", presets: [491], titleKey: "CLASH_TITLE_SPAR", win: "won", lose: "lost" },
      won("rival", "P5R3_R_WIN", "think"),
      { type: "jump", next: "after" },
      lost("rival", "P5R3_R_LOSE", "happy"),
      { ...say("frost", "P5R3_F2", "happy"), label: "after" },
      say("rival", "P5R3_R2", "calm"),
      { type: "end" }
    ]
  },
  "vn5-r4": {
    part: 5, partKey: P5, side: true, request: true, number: 4, after: "vn5-c4", titleKey: "P5R4_TITLE", summaryKey: "P5R4_SUMMARY", echoKey: "P5R4_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "lobby", titleKey: "LOC_LOBBY" },
      say("registrar", "P5R4_O1", "calm"),
      { type: "explore", field: "lobby", titleKey: "LOC_LOBBY", goalKey: "P5R4_GOAL", count: ["n1", "n2", "n3"], start: [44, 90], spots: [
        { id: "n1", kind: "inspect", at: [14, 58], labelKey: "P5R4_L", beats: [nar("P5R4_X1")] },
        { id: "n2", kind: "inspect", at: [38, 60], labelKey: "P5R4_L", beats: [nar("P5R4_X2")] },
        { id: "n3", kind: "inspect", at: [89, 60], labelKey: "P5R4_L", beats: [nar("P5R4_X3")] },
        { id: "aichan", kind: "npc", who: "aichan", at: [50, 79], goal: true, requires: ["n1", "n2", "n3"], lockedKey: "P5R4_LOCK", end: true, beats: [say("aichan", "P5R4_A1", "happy"), say("partner", "P5R4_P1", "happy")] }
      ] },
      say("aichan", "P5R4_A2", "happy"),
      { type: "end" }
    ]
  }
};
