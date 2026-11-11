// Story mode part two: "Crown of the Spiral" (OWNER_APPROVED_ADAPTATION
// 2026-11-11: the Owner chose the regional-cup direction). Chapters 8-13 and
// two side stories of the half-body story theater; the beat schema is the one
// documented in storyVnCampaign.js. Pure data: no imports.
//
// Plot: the local champion is invited to the Regional Cup in the Sky Arena City.
// A new rival, Subaru, and her Holy Shield Knight; Rin returns as a rival. The
// cup's sponsor, Victor, harvests the crowd's cheers so the Spiral Void Lord can
// crown one "perfect champion" and leave a single cheer for everyone. Hush, the
// Black Lotus extremist of part one, begins to doubt him.

export const STORY_VN_PART_TWO_BACKGROUNDS = {
  train: { src: "assets/production/story/vn-backgrounds-v2/train.c1b8aa9918c19eea.webp", motion: "assets/production/story/vn-backgrounds-v2/train.4cbd56a627a8165c.mp4", ambient: "dust", ground: 0.8, focus: 0.55 },
  skycity: { src: "assets/production/story/vn-backgrounds-v2/skycity.94237e61376c3d95.webp", motion: "assets/production/story/vn-backgrounds-v2/skycity.123624f9fcc5ebb4.mp4", ambient: "confetti", ground: 0.8, focus: 0.58 },
  locker: { src: "assets/production/story/vn-backgrounds-v2/locker.53f6ae4eca0c6a1b.webp", motion: "assets/production/story/vn-backgrounds-v2/locker.0608c55079a212b4.mp4", ambient: "dust", ground: 0.8, focus: 0.55 },
  undercroft: { src: "assets/production/story/vn-backgrounds-v2/undercroft.570ed9c00f721b8a.webp", motion: "assets/production/story/vn-backgrounds-v2/undercroft.1948cae6b97b4cc5.mp4", ambient: "data", ground: 0.8, focus: 0.6 },
  night: { src: "assets/production/story/vn-backgrounds-v2/night.24242366af9eaf34.webp", motion: "assets/production/story/vn-backgrounds-v2/night.81500fcf15c06bf4.mp4", ambient: "confetti", ground: 0.8, focus: 0.55 },
  throne: { src: "assets/production/story/vn-backgrounds-v2/throne.ff202a95a60f15c0.webp", motion: "assets/production/story/vn-backgrounds-v2/throne.1ab7dcd5a6cc7b4b.mp4", ambient: "shards", ground: 0.8, focus: 0.6 }
};

export const STORY_VN_PART_TWO_CAST = {
  subaruMon: { species: 153, tagKey: "TAG_SUBARU", faction: "lumen", preset: 530 }, // AW22 Holy Shield Knight
  victorMon: { species: 200, tagKey: "TAG_VICTOR", scale: 1.1, preset: 568 }, // UL21
  hostMon: { species: 205, tagKey: "TAG_HOST" }, // UL27
  axleMon: { species: 157, tagKey: "TAG_AXLE", preset: 551 }, // AW26
  puppetMon: { species: 201, tagKey: "TAG_PUPPET", overwritten: true, preset: 563 }, // UL23
  starKid: { species: 99, tagKey: "TAG_STARKID" }, // MA36
  crownVessel: { species: 211, tagKey: "TAG_CROWN", overwritten: true, scale: 1.6, preset: 574 } // UL33
};

export const STORY_VN_PART_TWO_SPEAKERS = {
  subaru: { nameKey: "SPEAKER_SUBARU", cast: "subaruMon", faction: "lumen", tamer: true },
  victor: { nameKey: "SPEAKER_VICTOR", cast: "victorMon", tamer: true },
  host: { nameKey: "SPEAKER_HOST", cast: "hostMon", tamer: true },
  axle: { nameKey: "SPEAKER_AXLE", cast: "axleMon" },
  starKid: { nameKey: "SPEAKER_STARKID", cast: "starKid" },
  crown: { nameKey: "SPEAKER_CROWN", cast: "crownVessel" }
};

const P2 = "PART_TWO";

export const STORY_VN_PART_TWO_CHAPTERS = {
  "vn2-c1": {
    part: 2, partKey: P2, number: 1, mapNumber: 8, titleKey: "P2C1_TITLE", summaryKey: "P2C1_SUMMARY", echoKey: "P2C1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "train", titleKey: "LOC_TRAIN" },
      { type: "line", speaker: "narrator", key: "P2C1_N1" },
      { type: "enter", who: "partner", x: 0.5, from: "left", face: "right" },
      { type: "bubble", who: "partner", glyph: "spark" },
      { type: "line", speaker: "partner", key: "P2C1_P1", mood: "happy" },
      { type: "line", speaker: "navi", key: "P2C1_NAVI1", mood: "serious" },
      { type: "enter", who: "subaruMon", x: 0.82, from: "right", face: "left" },
      { type: "line", speaker: "subaru", key: "P2C1_S1", mood: "happy" },
      { type: "line", speaker: "subaru", key: "P2C1_S2", mood: "happy" },
      { type: "bubble", who: "partner", glyph: "!" },
      { type: "line", speaker: "partner", key: "P2C1_P2", mood: "shock" },
      { type: "line", speaker: "narrator", key: "P2C1_N2" },
      { type: "line", speaker: "victor", key: "P2C1_V1", mood: "serious" },
      { type: "line", speaker: "victor", key: "P2C1_V2", mood: "happy" },
      { type: "line", speaker: "subaru", key: "P2C1_S3", mood: "think" },
      { type: "line", speaker: "subaru", key: "P2C1_S4", mood: "happy" },
      { type: "battle", presets: [530], titleKey: "CLASH_TITLE_SUBARU", win: "won", lose: "lost" },
      { type: "line", speaker: "subaru", key: "P2C1_S_WIN", mood: "happy", label: "won" },
      { type: "jump", next: "after" },
      { type: "line", speaker: "partner", key: "P2C1_P_LOSE", mood: "sad", label: "lost" },
      { type: "line", speaker: "subaru", key: "P2C1_S_LOSE", mood: "happy" },
      { type: "bg", id: "skycity", titleKey: "LOC_SKYCITY", label: "after" },
      { type: "line", speaker: "narrator", key: "P2C1_N3" },
      { type: "enter", who: "partner", x: 0.5, from: "warp", face: "right" },
      { type: "act", who: "partner", action: "cheer" },
      { type: "line", speaker: "partner", key: "P2C1_P3", mood: "happy" },
      { type: "line", speaker: "narrator", key: "P2C1_N4" },
      { type: "end" }
    ]
  },
  "vn2-c2": {
    part: 2, partKey: P2, number: 2, mapNumber: 9, titleKey: "P2C2_TITLE", summaryKey: "P2C2_SUMMARY", echoKey: "P2C2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "night", titleKey: "LOC_NIGHT" },
      { type: "enter", who: "hostMon", x: 0.84, face: "left" },
      { type: "line", speaker: "host", key: "P2C2_H1", mood: "happy" },
      { type: "enter", who: "puppetMon", x: 0.62, from: "warp", face: "left" },
      { type: "line", speaker: "narrator", key: "P2C2_N1" },
      { type: "line", speaker: "host", key: "P2C2_H2", mood: "shock" },
      { type: "fx", kind: "noise", on: true },
      { type: "line", speaker: "narrator", key: "P2C2_N2" },
      { type: "enter", who: "partner", x: 0.4, from: "left", face: "right" },
      { type: "bubble", who: "partner", glyph: "?" },
      { type: "line", speaker: "partner", key: "P2C2_P1", mood: "sad" },
      { type: "line", speaker: "navi", key: "P2C2_NAVI1", mood: "serious" },
      { type: "enter", who: "rivalMon", x: 0.22, from: "left", face: "right" },
      { type: "line", speaker: "rival", key: "P2C2_R1", mood: "serious" },
      { type: "line", speaker: "rival", key: "P2C2_R2", mood: "happy" },
      { type: "line", speaker: "host", key: "P2C2_H3", mood: "happy" },
      { type: "battle", presets: [563], titleKey: "CLASH_TITLE_PUPPET", win: "won", lose: "lost" },
      { type: "line", speaker: "narrator", key: "P2C2_N_WIN", label: "won" },
      { type: "jump", next: "after" },
      { type: "line", speaker: "narrator", key: "P2C2_N_LOSE", label: "lost" },
      { type: "fx", kind: "noise", on: false, label: "after" },
      { type: "exit", who: "puppetMon", to: "warp" },
      { type: "line", speaker: "victor", key: "P2C2_VI1", mood: "serious" },
      { type: "line", speaker: "partner", key: "P2C2_P2", mood: "angry" },
      { type: "line", speaker: "rival", key: "P2C2_R3", mood: "think" },
      { type: "end" }
    ]
  },
  "vn2-c3": {
    part: 2, partKey: P2, number: 3, mapNumber: 10, titleKey: "P2C3_TITLE", summaryKey: "P2C3_SUMMARY", echoKey: "P2C3_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "undercroft", titleKey: "LOC_UNDER" },
      { type: "line", speaker: "narrator", key: "P2C3_N1" },
      { type: "enter", who: "partner", x: 0.4, from: "warp", face: "right" },
      { type: "enter", who: "rivalMon", x: 0.22, from: "warp", face: "right" },
      { type: "line", speaker: "navi", key: "P2C3_NAVI1", mood: "serious" },
      { type: "enter", who: "axleMon", x: 0.82, from: "right", face: "left" },
      { type: "tag", who: ["axleMon"], to: "contestant", quiet: true },
      { type: "line", speaker: "axle", key: "P2C3_A1", mood: "glitch" },
      { type: "line", speaker: "partner", key: "P2C3_P1", mood: "sad" },
      { type: "line", speaker: "rival", key: "P2C3_R1", mood: "serious" },
      { type: "battle", presets: [551], titleKey: "CLASH_TITLE_AXLE", win: "stop", lose: "stop" },
      { type: "tap", promptKey: "TASK_COLLECT", targets: [{ at: [48, 55] }, { at: [66, 55] }, { at: [83, 55] }], label: "stop" },
      { type: "fx", kind: "flash" },
      { type: "line", speaker: "narrator", key: "P2C3_N2" },
      { type: "tag", who: ["axleMon"], to: "restore" },
      { type: "line", speaker: "axle", key: "P2C3_A2", mood: "happy" },
      { type: "file", key: "P2_FILE_CONTRACT" },
      { type: "line", speaker: "rival", key: "P2C3_R2", mood: "angry" },
      { type: "line", speaker: "partner", key: "P2C3_P2", mood: "serious" },
      { type: "line", speaker: "narrator", key: "P2C3_N3" },
      { type: "end" }
    ]
  },
  "vn2-c4": {
    part: 2, partKey: P2, number: 4, mapNumber: 11, titleKey: "P2C4_TITLE", summaryKey: "P2C4_SUMMARY", echoKey: "P2C4_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "locker", titleKey: "LOC_LOCKER" },
      { type: "enter", who: "partner", x: 0.42, face: "right" },
      { type: "enter", who: "subaruMon", x: 0.78, from: "right", face: "left" },
      { type: "line", speaker: "subaru", key: "P2C4_S1", mood: "happy" },
      { type: "line", speaker: "subaru", key: "P2C4_S2", mood: "think" },
      { type: "line", speaker: "partner", key: "P2C4_P1", mood: "think" },
      { type: "bg", id: "night", titleKey: "LOC_NIGHT" },
      { type: "enter", who: "partner", x: 0.4, face: "right" },
      { type: "enter", who: "subaruMon", x: 0.72, face: "left" },
      { type: "line", speaker: "host", key: "P2C4_H1", mood: "happy" },
      { type: "battle", presets: [530], titleKey: "CLASH_TITLE_QUARTER", win: "mid", lose: "mid" },
      { type: "fx", kind: "noise", on: true, label: "mid" },
      { type: "fx", kind: "shake" },
      { type: "tag", who: ["subaruMon"], to: "contestant" },
      { type: "line", speaker: "subaru", key: "P2C4_S3", mood: "shock" },
      { type: "line", speaker: "narrator", key: "P2C4_N1" },
      { type: "line", speaker: "victor", key: "P2C4_VI1", mood: "happy" },
      { type: "choice", key: "P2C4_CHOICE", options: [{ key: "P2C4_OPT_PAUSE", next: "pause" }, { key: "P2C4_OPT_CALL", next: "call" }] },
      { type: "line", speaker: "partner", key: "P2C4_P_PAUSE", mood: "serious", label: "pause" },
      { type: "jump", next: "save" },
      { type: "line", speaker: "partner", key: "P2C4_P_CALL", mood: "serious", label: "call" },
      { type: "enter", who: "envoyMon", x: 0.2, from: "warp", face: "right", label: "save" },
      { type: "line", speaker: "envoy", key: "P2C4_E1", mood: "serious" },
      { type: "enter", who: "caretakerMon", x: 0.56, from: "warp", face: "right" },
      { type: "line", speaker: "caretaker", key: "P2C4_Z1", mood: "happy" },
      { type: "line", speaker: "subaru", key: "P2C4_S4", mood: "sad" },
      { type: "tag", who: ["subaruMon"], to: "restore" },
      { type: "fx", kind: "noise", on: false },
      { type: "act", who: "subaruMon", action: "cheer" },
      { type: "line", speaker: "subaru", key: "P2C4_S5", mood: "happy" },
      { type: "line", speaker: "host", key: "P2C4_H2", mood: "shock" },
      { type: "line", speaker: "partner", key: "P2C4_P2", mood: "angry" },
      { type: "end" }
    ]
  },
  "vn2-c5": {
    part: 2, partKey: P2, number: 5, mapNumber: 12, titleKey: "P2C5_TITLE", summaryKey: "P2C5_SUMMARY", echoKey: "P2C5_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "night", titleKey: "LOC_NIGHT" },
      { type: "line", speaker: "narrator", key: "P2C5_N1" },
      { type: "enter", who: "partner", x: 0.36, from: "left", face: "right" },
      { type: "enter", who: "victorMon", x: 0.76, from: "warp", face: "left" },
      { type: "line", speaker: "victor", key: "P2C5_VI1", mood: "serious" },
      { type: "line", speaker: "victor", key: "P2C5_VI2", mood: "serious" },
      { type: "line", speaker: "victor", key: "P2C5_VI3", mood: "happy" },
      { type: "enter", who: "hushMon", x: 0.18, from: "warp", face: "right" },
      { type: "line", speaker: "hush", key: "P2C5_HU1", mood: "serious" },
      { type: "line", speaker: "victor", key: "P2C5_VI4", mood: "glitch" },
      { type: "line", speaker: "hush", key: "P2C5_HU2", mood: "sad" },
      { type: "line", speaker: "partner", key: "P2C5_P1", mood: "serious" },
      { type: "line", speaker: "victor", key: "P2C5_VI5", mood: "angry" },
      { type: "battle", presets: [568], titleKey: "CLASH_TITLE_VICTOR", win: "crown", lose: "crown" },
      { type: "bg", id: "throne", cut: "glitch", titleKey: "LOC_THRONE", label: "crown" },
      { type: "fx", kind: "warning", subKey: "WARNING_SUB_CROWN" },
      { type: "fx", kind: "noise", on: true },
      { type: "enter", who: "partner", x: 0.4, face: "right" },
      { type: "enter", who: "crownVessel", x: 0.74, from: "rift", face: "left" },
      { type: "fx", kind: "shake" },
      { type: "line", speaker: "crown", key: "P2C5_C1", mood: "glitch" },
      { type: "enter", who: "hushMon", x: 0.56, from: "warp", face: "right" },
      { type: "line", speaker: "hush", key: "P2C5_HU3", mood: "serious" },
      { type: "line", speaker: "narrator", key: "P2C5_N2" },
      { type: "end" }
    ]
  },
  "vn2-c6": {
    part: 2, partKey: P2, number: 6, mapNumber: 13, titleKey: "P2C6_TITLE", summaryKey: "P2C6_SUMMARY", echoKey: "P2C6_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "throne", titleKey: "LOC_THRONE" },
      { type: "objectives", keys: ["OBJ2_CROWD", "OBJ2_SUBARU", "OBJ2_CROWN"], done: 0 },
      { type: "fx", kind: "noise", on: true },
      { type: "line", speaker: "narrator", key: "P2C6_N1" },
      { type: "enter", who: "partner", x: 0.4, from: "warp", face: "right" },
      { type: "enter", who: "rivalMonAwake", x: 0.2, from: "warp", face: "right" },
      { type: "enter", who: "subaruMon", x: 0.58, from: "warp", face: "right" },
      { type: "line", speaker: "rival", key: "P2C6_R1", mood: "serious", alt: true },
      { type: "line", speaker: "subaru", key: "P2C6_S1", mood: "serious" },
      { type: "tap", promptKey: "TASK_CHEER", targets: [{ at: [16, 50] }, { at: [34, 56] }, { at: [86, 52] }] },
      { type: "objectives", done: 1 },
      { type: "line", speaker: "host", key: "P2C6_H1", mood: "shock" },
      { type: "objectives", done: 2 },
      { type: "enter", who: "crownVessel", x: 0.8, from: "rift", face: "left" },
      { type: "line", speaker: "crown", key: "P2C6_C1", mood: "glitch" },
      { type: "line", speaker: "partner", key: "P2C6_P1", mood: "serious" },
      { type: "fx", kind: "resonance" },
      { type: "line", speaker: "narrator", key: "P2C6_N2" },
      { type: "battle", presets: [574], titleKey: "CLASH_TITLE_CROWN", win: "won", lose: "held" },
      { type: "line", speaker: "rival", key: "P2C6_R_HELD", mood: "angry", alt: true, label: "held" },
      { type: "objectives", done: 3, label: "won" },
      { type: "fx", kind: "noise", on: false },
      { type: "exit", who: "crownVessel", to: "rift" },
      { type: "line", speaker: "narrator", key: "P2C6_N3" },
      { type: "bg", id: "night", titleKey: "LOC_AWARDS" },
      { type: "enter", who: "hostMon", x: 0.84, face: "left" },
      { type: "enter", who: "partner", x: 0.5, from: "warp", face: "right" },
      { type: "line", speaker: "host", key: "P2C6_H2", mood: "happy" },
      { type: "act", who: "partner", action: "cheer" },
      { type: "bubble", who: "partner", glyph: "heart" },
      { type: "line", speaker: "partner", key: "P2C6_P2", mood: "happy" },
      { type: "enter", who: "subaruMon", x: 0.68, from: "right", face: "left" },
      { type: "line", speaker: "subaru", key: "P2C6_S2", mood: "happy" },
      { type: "enter", who: "rivalMonAwake", x: 0.28, from: "left", face: "right" },
      { type: "line", speaker: "rival", key: "P2C6_R2", mood: "happy", alt: true },
      { type: "line", speaker: "hush", key: "P2C6_HU1", mood: "serious" },
      { type: "line", speaker: "narrator", key: "P2C6_N4" },
      { type: "line", speaker: "narrator", key: "P2C6_END" },
      { type: "end" }
    ]
  },
  "vn2-s1": {
    part: 2, partKey: P2, number: 1, side: true, after: "vn2-c1", titleKey: "P2S1_TITLE", summaryKey: "P2S1_SUMMARY", echoKey: "P2S1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "train", titleKey: "LOC_TRAIN" },
      { type: "enter", who: "starKid", x: 0.74, face: "left" },
      { type: "enter", who: "partner", x: 0.46, from: "left", face: "right" },
      { type: "bubble", who: "starKid", glyph: "sad" },
      { type: "line", speaker: "starKid", key: "P2S1_K1", mood: "sad" },
      { type: "line", speaker: "partner", key: "P2S1_P1", mood: "happy" },
      { type: "tap", promptKey: "P2S1_HINT", targets: [{ at: [40, 12] }] },
      { type: "line", speaker: "narrator", key: "P2S1_F1" },
      { type: "tap", promptKey: "P2S1_HINT", targets: [{ at: [64, 64] }] },
      { type: "line", speaker: "narrator", key: "P2S1_F2" },
      { type: "tap", promptKey: "P2S1_HINT", targets: [{ at: [83, 34] }] },
      { type: "line", speaker: "narrator", key: "P2S1_F3" },
      { type: "act", who: "starKid", action: "cheer" },
      { type: "line", speaker: "starKid", key: "P2S1_K2", mood: "happy" },
      { type: "enter", who: "subaruMon", x: 0.9, from: "right", face: "left" },
      { type: "line", speaker: "subaru", key: "P2S1_S1", mood: "happy" },
      { type: "end" }
    ]
  },
  "vn2-s2": {
    part: 2, partKey: P2, number: 2, side: true, after: "vn2-c3", titleKey: "P2S2_TITLE", summaryKey: "P2S2_SUMMARY", echoKey: "P2S2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "arena", titleKey: "LOC_TRAINING" },
      { type: "enter", who: "rivalMonAwake", x: 0.74, face: "left" },
      { type: "enter", who: "partner", x: 0.44, from: "left", face: "right" },
      { type: "line", speaker: "rival", key: "P2S2_R1", mood: "serious", alt: true },
      { type: "line", speaker: "rival", key: "P2S2_R2", mood: "serious", alt: true },
      { type: "line", speaker: "partner", key: "P2S2_P1", mood: "serious" },
      { type: "line", speaker: "rival", key: "P2S2_R3", mood: "happy", alt: true },
      { type: "battle", presets: [491], titleKey: "CLASH_TITLE_TRAINING", win: "after", lose: "after" },
      { type: "line", speaker: "rival", key: "P2S2_R4", mood: "happy", alt: true, label: "after" },
      { type: "end" }
    ]
  }
};
