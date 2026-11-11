// Story mode part four: "Stars of the Nationals" (OWNER_APPROVED_ADAPTATION
// 2026-11-11: the Owner chose the national-championship direction -- the
// tournament goes on, the rivals are stronger, and the spiral works the whole
// event from behind). Chapters 20-25 and four requests, taken at the Tamer
// Union hall's counter (vn3-hub); the beat schema is the one documented in
// storyVnCampaign.js. Pure data: no imports.
//
// Plot: the partner and Ai-chan go to the capital for the National Championship.
// The committee's chair, Celine, runs a "perfect schedule": every result is
// written before the match, and every contestant gets a script telling them
// when to lose. Frost, the cold champion of the north, and the Tide Twins of the
// southern port were handed scripts too. Rin hacks the committee tower and finds
// the spiral behind the schedule: the Script King, a vessel that turns cheers
// into fixed outcomes. In the semi-final the partner and Frost both tear up
// their scripts and fight for real; in the final, under an eclipse, the whole
// stadium answers the Script King and the first unscripted champion is crowned.

const P4 = "PART_FOUR";

export const STORY_VN_PART_FOUR_BACKGROUNDS = {
  capital: { src: "assets/production/story/vn-backgrounds-v3/capital.d039f79766631957.webp", motion: "assets/production/story/vn-backgrounds-v3/capital.e9b58eb93fa7f317.mp4", ambient: "confetti", ground: 0.8, focus: 0.55, walk: [0.76, 0.95] },
  village: { src: "assets/production/story/vn-backgrounds-v3/village.f92baef41e6c8589.webp", motion: "assets/production/story/vn-backgrounds-v3/village.16ef9783e84b81fd.mp4", ambient: "fireflies", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] },
  tower: { src: "assets/production/story/vn-backgrounds-v3/tower.1d1fe25c515bd6fe.webp", motion: "assets/production/story/vn-backgrounds-v3/tower.db577bef3655529b.mp4", ambient: "data", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] },
  final: { src: "assets/production/story/vn-backgrounds-v3/final.5efa21a42e4cac59.webp", motion: "assets/production/story/vn-backgrounds-v3/final.b06dc2a34b495ab0.mp4", ambient: "shards", ground: 0.8, focus: 0.55, walk: [0.76, 0.95] }
};

export const STORY_VN_PART_FOUR_CAST = {
  frostMon: { species: 212, tagKey: "TAG_FROST", faction: "iron", scale: 1.1, preset: 570 }, // Frost's ice cannon wolf
  twinMon: { species: 190, tagKey: "TAG_TWINS", faction: "lumen", preset: 566 }, // the Tide Twins' submarine dragon
  twinMonB: { species: 206, tagKey: "TAG_TWINS", faction: "lumen" },
  celineMon: { species: 221, tagKey: "TAG_CELINE", scale: 1.1 }, // the committee chair's moon partner
  guardMon: { species: 188, tagKey: "TAG_GUARD", preset: 562 }, // the tower guard
  scriptKing: { species: 198, tagKey: "TAG_SCRIPT", overwritten: true, scale: 1.6, preset: 569 }, // the Script King (spiral vessel)
  announcerMon: { species: 220, tagKey: "TAG_ANNOUNCER" }, // the nationals announcer
  fanMon: { species: 174, tagKey: "TAG_FAN" },
  reporterMon: { species: 184, tagKey: "TAG_REPORTER" }
};

export const STORY_VN_PART_FOUR_SPEAKERS = {
  frost: { nameKey: "SPEAKER_FROST", cast: "frostMon", faction: "iron", tamer: true },
  twins: { nameKey: "SPEAKER_TWINS", cast: "twinMon", faction: "lumen", tamer: true },
  celine: { nameKey: "SPEAKER_CELINE", cast: "celineMon", tamer: true },
  guard: { nameKey: "SPEAKER_GUARD", cast: "guardMon" },
  scriptKing: { nameKey: "SPEAKER_SCRIPT", cast: "scriptKing" },
  announcer: { nameKey: "SPEAKER_ANNOUNCER", cast: "announcerMon", tamer: true },
  fan: { nameKey: "SPEAKER_FAN", cast: "fanMon" },
  reporter: { nameKey: "SPEAKER_REPORTER", cast: "reporterMon", tamer: true }
};

const say = (speaker, key, mood) => (mood ? { type: "line", speaker, key, mood } : { type: "line", speaker, key });
const nar = key => ({ type: "line", speaker: "narrator", key });
const won = (speaker, key, mood) => ({ ...say(speaker, key, mood), label: "won" });
const lost = (speaker, key, mood) => ({ ...say(speaker, key, mood), label: "lost" });

export const STORY_VN_PART_FOUR_CHAPTERS = {
  // ---- chapter 20: the capital; registration, and the rivals of the nationals ----
  "vn4-c1": {
    part: 4, partKey: P4, number: 1, mapNumber: 20, titleKey: "P4C1_TITLE", summaryKey: "P4C1_SUMMARY", echoKey: "P4C1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "capital", titleKey: "LOC_CAPITAL" },
      nar("P4C1_N1"),
      { type: "enter", who: "partner", x: 0.3, from: "left", face: "right" },
      say("partner", "P4C1_P1", "happy"),
      say("aichan", "P4C1_A1", "talk"),
      { type: "explore", field: "capital", titleKey: "LOC_CAPITAL", goalKey: "P4C1_GOAL", count: ["frost", "twins", "announcer"], start: [14, 88], spots: [
        { id: "twins", kind: "npc", who: "twinMon", at: [30, 82], beats: [say("twins", "P4C1_T1", "happy"), say("twins", "P4C1_T2", "think")] },
        { id: "frost", kind: "npc", who: "frostMon", at: [52, 85], beats: [say("frost", "P4C1_F1", "calm"), say("partner", "P4C1_P2", "think"), say("frost", "P4C1_F2", "serious")] },
        { id: "announcer", kind: "npc", who: "announcerMon", at: [74, 80], beats: [say("announcer", "P4C1_H1", "happy")] },
        { id: "stairs", kind: "inspect", at: [70, 62], labelKey: "P4C1_L_GATE", goal: true, requires: ["frost", "twins", "announcer"], lockedKey: "P4C1_LOCK", end: true, beats: [
          nar("P4C1_N2"),
          say("celine", "P4C1_C1", "calm"),
          say("celine", "P4C1_C2", "serious"),
          say("aichan", "P4C1_A2", "think")
        ] }
      ] },
      nar("P4C1_N3"),
      { type: "end" }
    ]
  },

  // ---- chapter 21: the perfect schedule; results shown before the match ----
  "vn4-c2": {
    part: 4, partKey: P4, number: 2, mapNumber: 21, needs: 1, titleKey: "P4C2_TITLE", summaryKey: "P4C2_SUMMARY", echoKey: "P4C2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "night", titleKey: "LOC_NATIONALS" },
      { type: "enter", who: "partner", x: 0.3, from: "left", face: "right" },
      { type: "enter", who: "twinMon", x: 0.72, from: "right", face: "left" },
      { type: "enter", who: "twinMonB", x: 0.86, from: "right", face: "left" },
      say("announcer", "P4C2_H1", "happy"),
      say("twins", "P4C2_T1", "happy"),
      { type: "battle", presets: [566], titleKey: "CLASH_TITLE_TWINS", win: "won", lose: "lost" },
      won("twins", "P4C2_T_WIN", "shock"),
      { type: "jump", next: "after" },
      lost("twins", "P4C2_T_LOSE", "calm"),
      { type: "bg", id: "village", titleKey: "LOC_VILLAGE", label: "after" },
      nar("P4C2_N1"),
      { type: "explore", field: "village", titleKey: "LOC_VILLAGE", goalKey: "P4C2_GOAL", count: ["board", "fountain"], start: [12, 88], spots: [
        { id: "fountain", kind: "inspect", at: [14, 58], labelKey: "P4C2_L_FOUNTAIN", beats: [nar("P4C2_F1")] },
        { id: "board", kind: "inspect", at: [47, 50], labelKey: "P4C2_L_BOARD", beats: [nar("P4C2_B1"), { type: "fx", kind: "noise" }, nar("P4C2_B2"), { type: "fx", kind: "noise", on: false }, say("partner", "P4C2_P1", "shock")] },
        { id: "twins", kind: "npc", who: "twinMon", at: [80, 84], goal: true, after: ["board", "fountain"], end: true, beats: [
          say("twins", "P4C2_T2", "sad"),
          say("twins", "P4C2_T3", "serious"),
          say("aichan", "P4C2_A1", "serious")
        ] }
      ] },
      nar("P4C2_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 22: the losers in the script; everyone was handed one ----
  "vn4-c3": {
    part: 4, partKey: P4, number: 3, mapNumber: 22, needs: 1, titleKey: "P4C3_TITLE", summaryKey: "P4C3_SUMMARY", echoKey: "P4C3_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "village", titleKey: "LOC_VILLAGE" },
      nar("P4C3_N1"),
      { type: "file", key: "P4C3_SCRIPT" },
      say("partner", "P4C3_P1", "angry"),
      say("aichan", "P4C3_A1", "sad"),
      { type: "explore", field: "village", titleKey: "LOC_VILLAGE", goalKey: "P4C3_GOAL", count: ["fan", "reporter", "subaru"], start: [12, 88], spots: [
        { id: "fan", kind: "npc", who: "fanMon", at: [26, 84], beats: [say("fan", "P4C3_FAN1", "sad")] },
        { id: "reporter", kind: "npc", who: "reporterMon", at: [46, 82], beats: [say("reporter", "P4C3_R1", "think"), say("reporter", "P4C3_R2", "serious")] },
        { id: "subaru", kind: "npc", who: "subaruMon", at: [64, 86], beats: [say("subaru", "P4C3_S1", "sad"), say("subaru", "P4C3_S2", "serious")] },
        { id: "frost", kind: "npc", who: "frostMon", at: [84, 82], goal: true, after: ["fan", "reporter", "subaru"], end: true, beats: [
          say("frost", "P4C3_F1", "calm"),
          say("frost", "P4C3_F2", "sad"),
          say("partner", "P4C3_P2", "serious"),
          say("frost", "P4C3_F3", "serious")
        ] }
      ] },
      say("rival", "P4C3_R_RIN", "serious"),
      nar("P4C3_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 23: the committee tower; who writes the schedule ----
  "vn4-c4": {
    part: 4, partKey: P4, number: 4, mapNumber: 23, needs: 2, titleKey: "P4C4_TITLE", summaryKey: "P4C4_SUMMARY", echoKey: "P4C4_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "tower", titleKey: "LOC_TOWER" },
      { type: "enter", who: "rivalMon", x: 0.2, from: "left", face: "right" },
      say("rival", "P4C4_R1", "serious"),
      { type: "explore", field: "tower", titleKey: "LOC_TOWER", goalKey: "P4C4_GOAL", count: ["desk", "window", "door"], start: [10, 88], spots: [
        { id: "window", kind: "inspect", at: [12, 45], labelKey: "P4C4_L_WINDOW", beats: [nar("P4C4_W1")] },
        { id: "desk", kind: "inspect", at: [50, 56], labelKey: "P4C4_L_DESK", beats: [{ type: "file", key: "P4C4_BRACKET" }, say("partner", "P4C4_P1", "shock")] },
        { id: "door", kind: "inspect", at: [91, 48], labelKey: "P4C4_L_DOOR", requires: ["desk"], lockedKey: "P4C4_LOCK", beats: [{ type: "file", key: "P4C4_ORDER" }, say("aichan", "P4C4_A1", "shock")] },
        { id: "guard", kind: "npc", who: "guardMon", at: [70, 84], goal: true, after: ["desk", "window", "door"], end: true, beats: [
          say("guard", "P4C4_G1", "serious"),
          { type: "battle", presets: [562], titleKey: "CLASH_TITLE_GUARD", win: "won", lose: "lost" },
          won("guard", "P4C4_G_WIN", "shock"),
          { type: "jump", next: "after" },
          lost("rival", "P4C4_R_LOSE", "serious"),
          { ...say("celine", "P4C4_C1", "calm"), label: "after" },
          say("celine", "P4C4_C2", "serious")
        ] }
      ] },
      say("rival", "P4C4_R2", "angry"),
      nar("P4C4_N1"),
      { type: "end" }
    ]
  },

  // ---- chapter 24: the semi-final nobody scripted ----
  "vn4-c5": {
    part: 4, partKey: P4, number: 5, mapNumber: 24, needs: 3, titleKey: "P4C5_TITLE", summaryKey: "P4C5_SUMMARY", echoKey: "P4C5_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "night", titleKey: "LOC_NATIONALS" },
      { type: "enter", who: "partner", x: 0.3, from: "left", face: "right" },
      { type: "enter", who: "frostMon", x: 0.72, from: "right", face: "left" },
      say("announcer", "P4C5_H1", "happy"),
      nar("P4C5_N1"),
      say("frost", "P4C5_F1", "calm"),
      { type: "choice", key: "P4C5_CHOICE", options: [{ key: "P4C5_OPT_TEAR", next: "tear" }, { key: "P4C5_OPT_ASK", next: "ask" }] },
      { ...say("partner", "P4C5_P_TEAR", "angry"), label: "tear" },
      { type: "jump", next: "fight" },
      { ...say("partner", "P4C5_P_ASK", "serious"), label: "ask" },
      { ...say("frost", "P4C5_F2", "happy"), label: "fight" },
      { type: "fx", kind: "flash" },
      { type: "battle", presets: [570], titleKey: "CLASH_TITLE_FROST", win: "won", lose: "lost" },
      won("frost", "P4C5_F_WIN", "happy"),
      { type: "jump", next: "after" },
      lost("frost", "P4C5_F_LOSE", "calm"),
      { ...say("announcer", "P4C5_H2", "shock"), label: "after" },
      nar("P4C5_N2"),
      say("aichan", "P4C5_A1", "happy"),
      { type: "end" }
    ]
  },

  // ---- chapter 25: the final under the eclipse ----
  "vn4-c6": {
    part: 4, partKey: P4, number: 6, mapNumber: 25, needs: 4, titleKey: "P4C6_TITLE", summaryKey: "P4C6_SUMMARY", echoKey: "P4C6_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "final", titleKey: "LOC_FINAL_NATIONALS" },
      nar("P4C6_N1"),
      { type: "enter", who: "partner", x: 0.3, from: "left", face: "right" },
      { type: "enter", who: "celineMon", x: 0.8, from: "right", face: "left" },
      say("celine", "P4C6_C1", "calm"),
      say("celine", "P4C6_C2", "serious"),
      { type: "fx", kind: "warning", subKey: "P4C6_WARN" },
      { type: "exit", who: "celineMon", to: "warp" },
      { type: "enter", who: "scriptKing", x: 0.72, from: "rift", face: "left" },
      say("scriptKing", "P4C6_K1", "serious"),
      { type: "enter", who: "frostMon", x: 0.12, from: "left", face: "right" },
      { type: "enter", who: "rivalMon", x: 0.2, from: "left", face: "right" },
      { type: "enter", who: "subaruMon", x: 0.44, from: "left", face: "right" },
      say("frost", "P4C6_F1", "serious"),
      say("subaru", "P4C6_S1", "serious"),
      say("partner", "P4C6_P1", "angry"),
      { type: "battle", presets: [569], titleKey: "CLASH_TITLE_SCRIPT", win: "won", lose: "lost" },
      { type: "act", who: "scriptKing", action: "hit", label: "won" },
      say("scriptKing", "P4C6_K_WIN", "shock"),
      { type: "jump", next: "after" },
      lost("partner", "P4C6_P_LOSE", "sad"),
      say("frost", "P4C6_F_LOSE", "serious"),
      { type: "exit", who: "scriptKing", to: "warp", label: "after" },
      { type: "fx", kind: "resonance" },
      nar("P4C6_N2"),
      say("announcer", "P4C6_H1", "happy"),
      { type: "act", who: "partner", action: "cheer" },
      say("partner", "P4C6_P2", "happy"),
      say("frost", "P4C6_F2", "happy"),
      say("hush", "P4C6_HUSH", "serious"),
      { type: "end" }
    ]
  },

  // ---- requests ----
  "vn4-r1": {
    part: 4, partKey: P4, side: true, request: true, number: 1, after: "vn4-c1", titleKey: "P4R1_TITLE", summaryKey: "P4R1_SUMMARY", echoKey: "P4R1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "capital", titleKey: "LOC_CAPITAL" },
      { type: "enter", who: "fanMon", x: 0.6, from: "right", face: "left" },
      say("fan", "P4R1_F1", "sad"),
      { type: "explore", field: "capital", titleKey: "LOC_CAPITAL", goalKey: "P4R1_GOAL", start: [14, 88], spots: [
        { id: "banner", kind: "inspect", at: [30, 36], labelKey: "P4R1_L1", doneKey: "P3R1_AGAIN", beats: [nar("P4R1_X1")] },
        { id: "rings", kind: "inspect", at: [34, 10], labelKey: "P4R1_L2", doneKey: "P3R1_AGAIN", beats: [nar("P4R1_X2")] },
        { id: "stairs", kind: "inspect", at: [70, 64], labelKey: "P4R1_L3", goal: true, requires: ["banner", "rings"], lockedKey: "P4R1_LOCK", end: true, beats: [nar("P4R1_X3")] }
      ] },
      say("fan", "P4R1_F2", "happy"),
      { type: "end" }
    ]
  },
  "vn4-r2": {
    part: 4, partKey: P4, side: true, request: true, number: 2, after: "vn4-c1", titleKey: "P4R2_TITLE", summaryKey: "P4R2_SUMMARY", echoKey: "P4R2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "village", titleKey: "LOC_VILLAGE" },
      { type: "enter", who: "reporterMon", x: 0.66, from: "right", face: "left" },
      { type: "enter", who: "partner", x: 0.32, from: "left", face: "right" },
      say("reporter", "P4R2_R1", "happy"),
      { type: "choice", key: "P4R2_Q1", options: [{ key: "P4R2_A1", next: "a1" }, { key: "P4R2_A2", next: "a2" }] },
      { ...say("partner", "P4R2_P1", "happy"), label: "a1" },
      { type: "jump", next: "q2" },
      { ...say("partner", "P4R2_P2", "serious"), label: "a2" },
      { ...say("reporter", "P4R2_R2", "think"), label: "q2" },
      { type: "choice", key: "P4R2_Q2", options: [{ key: "P4R2_B1", next: "b1" }, { key: "P4R2_B2", next: "b2" }] },
      { ...say("partner", "P4R2_P3", "happy"), label: "b1" },
      { type: "jump", next: "end" },
      { ...say("partner", "P4R2_P4", "happy"), label: "b2" },
      { ...say("reporter", "P4R2_R3", "happy"), label: "end" },
      { type: "end" }
    ]
  },
  "vn4-r3": {
    part: 4, partKey: P4, side: true, request: true, number: 3, after: "vn4-c3", titleKey: "P4R3_TITLE", summaryKey: "P4R3_SUMMARY", echoKey: "P4R3_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "capital", titleKey: "LOC_CAPITAL" },
      { type: "enter", who: "starKid", x: 0.4, from: "left", face: "right" },
      say("starKid", "P4R3_K1", "happy"),
      { type: "explore", field: "capital", titleKey: "LOC_CAPITAL", goalKey: "P4R3_GOAL", count: ["b1", "b2", "b3"], start: [10, 88], spots: [
        { id: "b1", kind: "inspect", at: [28, 36], labelKey: "P4R3_L", beats: [{ type: "fx", kind: "flash" }, nar("P4R3_X")] },
        { id: "b2", kind: "inspect", at: [53, 30], labelKey: "P4R3_L", beats: [{ type: "fx", kind: "flash" }, nar("P4R3_X")] },
        { id: "b3", kind: "inspect", at: [93, 42], labelKey: "P4R3_L", beats: [{ type: "fx", kind: "flash" }, nar("P4R3_X")] },
        { id: "subaru", kind: "npc", who: "subaruMon", at: [62, 84], goal: true, requires: ["b1", "b2", "b3"], lockedKey: "P4R3_LOCK", end: true, beats: [say("subaru", "P4R3_S1", "happy")] }
      ] },
      say("starKid", "P4R3_K2", "happy"),
      { type: "end" }
    ]
  },
  "vn4-r4": {
    part: 4, partKey: P4, side: true, request: true, number: 4, after: "vn4-c4", titleKey: "P4R4_TITLE", summaryKey: "P4R4_SUMMARY", echoKey: "P4R4_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "village", titleKey: "LOC_VILLAGE" },
      { type: "enter", who: "frostMon", x: 0.72, from: "right", face: "left" },
      { type: "enter", who: "partner", x: 0.3, from: "left", face: "right" },
      say("frost", "P4R4_F1", "calm"),
      say("partner", "P4R4_P1", "happy"),
      { type: "battle", presets: [570], titleKey: "CLASH_TITLE_SPAR", win: "won", lose: "lost" },
      won("frost", "P4R4_F_WIN", "happy"),
      { type: "jump", next: "after" },
      lost("frost", "P4R4_F_LOSE", "calm"),
      { ...say("frost", "P4R4_F2", "think"), label: "after" },
      { type: "end" }
    ]
  }
};
