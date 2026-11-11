// Story mode part three: "Ai-chan's Entry Form" (OWNER_APPROVED_ADAPTATION
// 2026-11-11: the Owner handed the whole story mode over, plot included, and
// asked for it to follow the story so far and the Moonlight research). Six
// chapters, six requests and the reception hall hub of the half-body story
// theater; the beat schema is the one documented in storyVnCampaign.js. Pure
// data: no imports.
//
// Plot: after the regional cup the reception moves into the new Tamer Union
// hall, and Ai-chan hands out requests from its counter. A request arrives
// with no sender, signed "AI-00": Ai-chan's own old serial. Its echoes lead
// through an abandoned channel street and the Echo Forest to the truth: Ai-chan
// was put together from the greeting of a partner whose tamer stopped coming
// back, the "welcome back" nobody heard. The Recycler, a remnant of the spiral,
// gathers unheard echoes for scrap, and Ai-chan is on its list. She goes alone
// to the forgotten ranch she came from; the partner and friends follow, and she
// signs an entry form with her own name.
//
// Structure (from the Moonlight research brief, built as our own): a walkable
// hub hands out the chapters; each chapter after the first opens once enough
// requests are cleared (1, 2, 3, 4, 5), so the story alternates with side jobs;
// places are painted plates you walk on, with people, clues and exits as spots.

const P3 = "PART_THREE";

export const STORY_VN_PART_THREE_BACKGROUNDS = {
  lobby: { src: "assets/production/story/vn-backgrounds-v3/lobby.2c367b4820a17a00.webp", motion: "assets/production/story/vn-backgrounds-v3/lobby.209770b2be1568ed.mp4", ambient: "dust", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] },
  oldstreet: { src: "assets/production/story/vn-backgrounds-v3/oldstreet.4fda664e2deb7d20.webp", motion: "assets/production/story/vn-backgrounds-v3/oldstreet.11178d526f1574c1.mp4", ambient: "leaves", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] },
  forest: { src: "assets/production/story/vn-backgrounds-v3/forest.00e31d9cef53e5cb.webp", motion: "assets/production/story/vn-backgrounds-v3/forest.ba98a1ca7ff0e8bb.mp4", ambient: "fireflies", ground: 0.8, focus: 0.45, walk: [0.76, 0.95] },
  origin: { src: "assets/production/story/vn-backgrounds-v3/origin.97894bac68efbd6e.webp", motion: "assets/production/story/vn-backgrounds-v3/origin.ab2c3a7b12ae3fa6.mp4", ambient: "petals", ground: 0.8, focus: 0.5, walk: [0.76, 0.95] }
};

export const STORY_VN_PART_THREE_CAST = {
  recyclerMon: { species: 148, tagKey: "TAG_RECYCLER", overwritten: true, scale: 1.5, preset: 542 }, // the Recycler (a spiral remnant)
  echoA: { species: 51, tagKey: "TAG_ECHO", overwritten: true },
  echoB: { species: 65, tagKey: "TAG_ECHO", overwritten: true },
  echoC: { species: 177, tagKey: "TAG_ECHO", overwritten: true }
};

export const STORY_VN_PART_THREE_SPEAKERS = {
  recycler: { nameKey: "SPEAKER_RECYCLER", cast: "recyclerMon" },
  echoA: { nameKey: "SPEAKER_ECHO", cast: "echoA" },
  echoB: { nameKey: "SPEAKER_ECHO", cast: "echoB" },
  echoC: { nameKey: "SPEAKER_ECHO", cast: "echoC" }
};

const say = (speaker, key, mood) => (mood ? { type: "line", speaker, key, mood } : { type: "line", speaker, key });
const nar = key => ({ type: "line", speaker: "narrator", key });

export const STORY_VN_PART_THREE_CHAPTERS = {
  // ---- the hub: walk the hall, talk to Ai-chan at the counter to take a chapter or a request ----
  "vn3-hub": {
    part: 3, partKey: P3, hub: true, after: "vn2-c6", number: 0, mapNumber: 14,
    titleKey: "P3H_TITLE", summaryKey: "P3H_SUMMARY", echoKey: "P3H_ECHO",
    beats: [
      { type: "bg", id: "lobby", titleKey: "LOC_LOBBY" },
      { type: "explore", field: "lobby", titleKey: "LOC_LOBBY", goalKey: "P3H_GOAL", start: [26, 88], spots: [
        { id: "desk", kind: "npc", who: "aichan", at: [50, 79], goal: true, repeat: true, beats: [say("aichan", "P3H_A1", "happy"), { type: "board" }] },
        { id: "board", kind: "inspect", at: [14, 58], labelKey: "P3H_BOARD", repeat: true, beats: [{ type: "board" }] },
        { id: "orlan", kind: "npc", who: "registrarMon", at: [70, 83], repeat: true, beats: [say("registrar", "P3H_O1", "calm")] },
        { id: "door", kind: "exit", at: [89, 84], labelKey: "P3H_EXIT", end: true, repeat: true }
      ] },
      { type: "end" }
    ]
  },

  // ---- chapter 14: the hall opens; a request with no sender ----
  "vn3-c1": {
    part: 3, partKey: P3, number: 1, mapNumber: 14, titleKey: "P3C1_TITLE", summaryKey: "P3C1_SUMMARY", echoKey: "P3C1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "lobby", titleKey: "LOC_LOBBY" },
      nar("P3C1_N1"),
      say("aichan", "P3C1_A1", "happy"),
      { type: "enter", who: "partner", x: 0.35, from: "left", face: "right" },
      { type: "bubble", who: "partner", glyph: "spark" },
      say("partner", "P3C1_P1", "happy"),
      say("aichan", "P3C1_A2", "talk"),
      { type: "explore", field: "lobby", titleKey: "LOC_LOBBY", goalKey: "P3C1_GOAL", count: ["subaru", "rin", "orlan"], start: [44, 90], spots: [
        { id: "subaru", kind: "npc", who: "subaruMon", at: [24, 80], beats: [say("subaru", "P3C1_S1", "happy"), say("partner", "P3C1_P2", "happy")] },
        { id: "rin", kind: "npc", who: "rivalMon", at: [64, 85], beats: [say("rival", "P3C1_R1", "calm"), say("rival", "P3C1_R2", "think")] },
        { id: "orlan", kind: "npc", who: "registrarMon", at: [80, 80], beats: [say("registrar", "P3C1_O1", "calm"), say("registrar", "P3C1_O2", "think")] },
        { id: "board", kind: "inspect", at: [14, 58], labelKey: "P3H_BOARD", goal: true, requires: ["subaru", "rin", "orlan"], lockedKey: "P3C1_LOCK", end: true, beats: [
          nar("P3C1_N2"),
          { type: "file", key: "P3C1_NOTE" },
          say("aichan", "P3C1_A3", "shock"),
          say("aichan", "P3C1_A4", "sad"),
          say("partner", "P3C1_P3", "serious"),
          say("rival", "P3C1_R3", "serious"),
          say("aichan", "P3C1_A5", "serious")
        ] }
      ] },
      nar("P3C1_N3"),
      { type: "end" }
    ]
  },

  // ---- chapter 15: the abandoned channel street; echoes that sound like her ----
  "vn3-c2": {
    part: 3, partKey: P3, number: 2, mapNumber: 15, needs: 1, titleKey: "P3C2_TITLE", summaryKey: "P3C2_SUMMARY", echoKey: "P3C2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "oldstreet", titleKey: "LOC_OLDSTREET" },
      nar("P3C2_N1"),
      say("partner", "P3C2_P1", "think"),
      say("aichan", "P3C2_A1", "talk"),
      { type: "explore", field: "oldstreet", titleKey: "LOC_OLDSTREET", goalKey: "P3C2_GOAL", count: ["shop", "mailbox", "clock"], start: [10, 88], spots: [
        { id: "shop", kind: "inspect", at: [12, 60], labelKey: "P3C2_L_SHOP", beats: [{ type: "fx", kind: "noise" }, nar("P3C2_E1"), { type: "fx", kind: "noise", on: false }, say("partner", "P3C2_P2", "shock")] },
        { id: "mailbox", kind: "inspect", at: [73, 60], labelKey: "P3C2_L_MAIL", beats: [nar("P3C2_E2"), say("aichan", "P3C2_A2", "sad")] },
        { id: "clock", kind: "inspect", at: [48, 60], labelKey: "P3C2_L_CLOCK", beats: [nar("P3C2_E3"), say("partner", "P3C2_P3", "sad")] },
        { id: "hush", kind: "npc", who: "hushMon", at: [88, 84], goal: true, after: ["shop", "mailbox", "clock"], end: true, beats: [
          say("hush", "P3C2_H1", "serious"),
          say("hush", "P3C2_H2", "think"),
          say("partner", "P3C2_P4", "serious"),
          say("hush", "P3C2_H3", "serious"),
          { type: "fx", kind: "warning", subKey: "P3C2_WARN" },
          { type: "battle", presets: [515], titleKey: "CLASH_TITLE_ECHOEATER", win: "won", lose: "lost" },
          { ...say("hush", "P3C2_H_WIN", "calm"), label: "won" },
          { type: "jump", next: "after" },
          { ...say("partner", "P3C2_P_LOSE", "sad"), label: "lost" },
          say("hush", "P3C2_H_LOSE", "calm"),
          { ...say("aichan", "P3C2_A3", "serious"), label: "after" }
        ] }
      ] },
      nar("P3C2_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 16: the old records; where "welcome back" came from ----
  "vn3-c3": {
    part: 3, partKey: P3, number: 3, mapNumber: 16, needs: 2, titleKey: "P3C3_TITLE", summaryKey: "P3C3_SUMMARY", echoKey: "P3C3_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "vault", titleKey: "LOC_VAULT" },
      { type: "enter", who: "rivalMon", x: 0.7, from: "right", face: "left" },
      say("rival", "P3C3_R1", "serious"),
      say("aichan", "P3C3_A1", "think"),
      { type: "explore", field: "vault", titleKey: "LOC_VAULT", goalKey: "P3C3_GOAL", count: ["f1", "f2", "f3"], start: [18, 88], spots: [
        { id: "f1", kind: "inspect", at: [57, 47], labelKey: "P3C3_L1", beats: [{ type: "file", key: "P3C3_F1" }, say("aichan", "P3C3_A_F1", "think")] },
        { id: "f2", kind: "inspect", at: [71, 47], labelKey: "P3C3_L2", beats: [{ type: "file", key: "P3C3_F2" }, say("partner", "P3C3_P_F2", "sad")] },
        { id: "f3", kind: "inspect", at: [64, 30], labelKey: "P3C3_L3", goal: true, requires: ["f1", "f2"], lockedKey: "P3C3_LOCK", end: true, beats: [{ type: "file", key: "P3C3_F3" }] }
      ] },
      say("aichan", "P3C3_A2", "sad"),
      say("aichan", "P3C3_A3", "sad"),
      { type: "enter", who: "partner", x: 0.4, from: "left", face: "right" },
      { type: "choice", key: "P3C3_CHOICE", options: [{ key: "P3C3_OPT_SELF", next: "self" }, { key: "P3C3_OPT_BACK", next: "back" }] },
      { ...say("partner", "P3C3_P_SELF", "serious"), label: "self" },
      say("aichan", "P3C3_A_SELF", "happy"),
      { type: "jump", next: "join" },
      { ...say("partner", "P3C3_P_BACK", "happy"), label: "back" },
      say("aichan", "P3C3_A_BACK", "happy"),
      { ...say("rival", "P3C3_R2", "calm"), label: "join" },
      nar("P3C3_N1"),
      { type: "end" }
    ]
  },

  // ---- chapter 17: the Echo Forest; partners still waiting, and the Recycler ----
  "vn3-c4": {
    part: 3, partKey: P3, number: 4, mapNumber: 17, needs: 3, titleKey: "P3C4_TITLE", summaryKey: "P3C4_SUMMARY", echoKey: "P3C4_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "forest", titleKey: "LOC_FOREST" },
      nar("P3C4_N1"),
      say("aichan", "P3C4_A1", "think"),
      { type: "explore", field: "forest", titleKey: "LOC_FOREST", goalKey: "P3C4_GOAL", count: ["w1", "w2", "w3"], start: [8, 88], spots: [
        { id: "w1", kind: "npc", who: "echoA", at: [24, 82], beats: [say("echoA", "P3C4_E1", "sad"), say("partner", "P3C4_P1", "happy"), { type: "fx", kind: "resonance" }, nar("P3C4_FADE")] },
        { id: "w2", kind: "npc", who: "echoB", at: [48, 80], beats: [say("echoB", "P3C4_E2", "sad"), say("partner", "P3C4_P2", "happy"), { type: "fx", kind: "resonance" }, nar("P3C4_FADE")] },
        { id: "w3", kind: "npc", who: "echoC", at: [66, 84], beats: [say("echoC", "P3C4_E3", "sad"), say("partner", "P3C4_P3", "serious"), { type: "fx", kind: "resonance" }, nar("P3C4_FADE")] },
        { id: "sign", kind: "inspect", at: [85, 52], labelKey: "P3C4_L_SIGN", beats: [nar("P3C4_SIGN")] },
        { id: "recycler", kind: "npc", who: "recyclerMon", at: [86, 84], goal: true, after: ["w1", "w2", "w3"], end: true, beats: [
          { type: "fx", kind: "shake" },
          say("recycler", "P3C4_C1", "serious"),
          say("recycler", "P3C4_C2", "serious"),
          say("aichan", "P3C4_A2", "shock"),
          say("partner", "P3C4_P4", "angry"),
          { type: "battle", presets: [563], titleKey: "CLASH_TITLE_RECYCLER_HAND", win: "won", lose: "lost" },
          { ...say("recycler", "P3C4_C_WIN", "serious"), label: "won" },
          { type: "jump", next: "after" },
          { ...say("recycler", "P3C4_C_LOSE", "serious"), label: "lost" },
          { ...say("recycler", "P3C4_C3", "serious"), label: "after" }
        ] }
      ] },
      say("aichan", "P3C4_A3", "happy"),
      nar("P3C4_N2"),
      { type: "end" }
    ]
  },

  // ---- chapter 18: a morning with no receptionist; the partner keeps the counter ----
  "vn3-c5": {
    part: 3, partKey: P3, number: 5, mapNumber: 18, needs: 4, host: false, titleKey: "P3C5_TITLE", summaryKey: "P3C5_SUMMARY", echoKey: "P3C5_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "lobby", titleKey: "LOC_LOBBY" },
      nar("P3C5_N1"),
      { type: "enter", who: "partner", x: 0.4, from: "left", face: "right" },
      say("partner", "P3C5_P1", "sad"),
      { type: "enter", who: "registrarMon", x: 0.74, from: "right", face: "left" },
      say("registrar", "P3C5_O1", "think"),
      say("registrar", "P3C5_O2", "calm"),
      { type: "explore", field: "lobby", titleKey: "LOC_LOBBY", goalKey: "P3C5_GOAL", count: ["v1", "v2", "v3"], start: [50, 90], spots: [
        { id: "v1", kind: "npc", who: "starKid", at: [26, 84], beats: [say("starKid", "P3C5_V1", "happy"), say("partner", "P3C5_P_V1", "calm"), nar("P3C5_N_V1")] },
        { id: "v2", kind: "npc", who: "neighborB", at: [66, 82], beats: [say("neighborB", "P3C5_V2", "sad"), say("partner", "P3C5_P_V2", "happy")] },
        { id: "v3", kind: "npc", who: "subaruMon", at: [82, 86], beats: [say("subaru", "P3C5_V3", "think"), say("partner", "P3C5_P_V3", "sad")] },
        { id: "desk", kind: "inspect", at: [52, 60], labelKey: "P3C5_L_DESK", goal: true, after: ["v1", "v2", "v3"], end: true, beats: [
          nar("P3C5_N2"),
          { type: "file", key: "P3C5_NOTE" },
          say("partner", "P3C5_P2", "shock"),
          say("rival", "P3C5_R1", "serious"),
          say("subaru", "P3C5_S1", "serious"),
          say("partner", "P3C5_P3", "serious")
        ] }
      ] },
      nar("P3C5_N3"),
      { type: "end" }
    ]
  },

  // ---- chapter 19: the forgotten ranch; Ai-chan signs her own name ----
  "vn3-c6": {
    part: 3, partKey: P3, number: 6, mapNumber: 19, needs: 5, host: "teaser", titleKey: "P3C6_TITLE", summaryKey: "P3C6_SUMMARY", echoKey: "P3C6_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "origin", titleKey: "LOC_ORIGIN" },
      nar("P3C6_N1"),
      { type: "explore", field: "origin", titleKey: "LOC_ORIGIN", goalKey: "P3C6_GOAL", count: ["gate", "bowl"], start: [8, 88], spots: [
        { id: "gate", kind: "inspect", at: [20, 46], labelKey: "P3C6_L_GATE", beats: [nar("P3C6_GATE"), say("partner", "P3C6_P_GATE", "sad")] },
        { id: "bowl", kind: "inspect", at: [67, 62], labelKey: "P3C6_L_BOWL", beats: [nar("P3C6_BOWL")] },
        { id: "aichan", kind: "npc", who: "aichan", at: [54, 80], goal: true, after: ["gate", "bowl"], end: true, beats: [
          say("aichan", "P3C6_A1", "sad"),
          say("aichan", "P3C6_A2", "sad"),
          say("partner", "P3C6_P1", "serious")
        ] }
      ] },
      { type: "fx", kind: "warning", subKey: "P3C6_WARN" },
      { type: "enter", who: "recyclerMon", x: 0.78, from: "rift", face: "left" },
      say("recycler", "P3C6_C1", "serious"),
      say("recycler", "P3C6_C2", "serious"),
      { type: "enter", who: "partner", x: 0.32, from: "left", face: "right" },
      { type: "enter", who: "rivalMon", x: 0.14, from: "left", face: "right" },
      { type: "enter", who: "subaruMon", x: 0.5, from: "left", face: "right" },
      say("rival", "P3C6_R1", "angry"),
      say("subaru", "P3C6_S1", "serious"),
      say("partner", "P3C6_P2", "angry"),
      { type: "battle", presets: [542], titleKey: "CLASH_TITLE_RECYCLER", win: "won", lose: "lost" },
      { type: "act", who: "recyclerMon", action: "hit", label: "won" },
      say("recycler", "P3C6_C_WIN", "shock"),
      { type: "jump", next: "after" },
      { ...say("partner", "P3C6_P_LOSE", "sad"), label: "lost" },
      say("aichan", "P3C6_A_LOSE", "serious"),
      { type: "exit", who: "recyclerMon", to: "warp", label: "after" },
      { type: "fx", kind: "resonance" },
      say("aichan", "P3C6_A3", "serious"),
      { type: "form", titleKey: "P3C6_FORM_TITLE", tamerLabelKey: "P3C6_FORM_ROLE_LABEL", tamerKey: "P3C6_FORM_ROLE", nameLabelKey: "P3C6_FORM_NAME_LABEL", nameKey: "SPEAKER_AICHAN", hintKey: "P3C6_FORM_HINT" },
      say("aichan", "P3C6_A4", "happy"),
      { type: "act", who: "partner", action: "cheer" },
      say("partner", "P3C6_P3", "happy"),
      nar("P3C6_N2"),
      { type: "end" }
    ]
  },

  // ---- requests (side jobs from the board): each opens after a chapter ----
  "vn3-r1": {
    part: 3, partKey: P3, side: true, request: true, number: 1, after: "vn3-c1", titleKey: "P3R1_TITLE", summaryKey: "P3R1_SUMMARY", echoKey: "P3R1_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "habitat", titleKey: "LOC_HABITAT" },
      { type: "enter", who: "neighborB", x: 0.7, from: "right", face: "left" },
      say("neighborB", "P3R1_B1", "sad"),
      { type: "explore", field: "habitat", titleKey: "LOC_HABITAT", goalKey: "P3R1_GOAL", start: [12, 88], spots: [
        { id: "pond", kind: "inspect", at: [22, 62], labelKey: "P3R1_L1", doneKey: "P3R1_AGAIN", beats: [nar("P3R1_F1")] },
        { id: "sign", kind: "inspect", at: [50, 58], labelKey: "P3R1_L2", doneKey: "P3R1_AGAIN", beats: [nar("P3R1_F2")] },
        { id: "nest", kind: "inspect", at: [34, 60], labelKey: "P3R1_L3", goal: true, requires: ["pond", "sign"], lockedKey: "P3R1_LOCK", end: true, beats: [nar("P3R1_F3")] }
      ] },
      say("neighborB", "P3R1_B2", "happy"),
      { type: "bubble", who: "neighborB", glyph: "heart" },
      { type: "end" }
    ]
  },
  "vn3-r2": {
    part: 3, partKey: P3, side: true, request: true, number: 2, after: "vn3-c1", titleKey: "P3R2_TITLE", summaryKey: "P3R2_SUMMARY", echoKey: "P3R2_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "plaza", titleKey: "LOC_PLAZA" },
      { type: "enter", who: "registrarMon", x: 0.3, from: "left", face: "right" },
      say("registrar", "P3R2_O1", "shock"),
      { type: "explore", field: "plaza", titleKey: "LOC_PLAZA", goalKey: "P3R2_GOAL", start: [20, 88], spots: [
        { id: "kid", kind: "npc", who: "starKid", at: [46, 84], beats: [say("starKid", "P3R2_K1", "think")] },
        { id: "flowers", kind: "inspect", at: [12, 66], labelKey: "P3R2_L1", doneKey: "P3R1_AGAIN", beats: [nar("P3R2_F1")] },
        { id: "counter", kind: "inspect", at: [86, 60], labelKey: "P3R2_L2", goal: true, requires: ["kid"], lockedKey: "P3R2_LOCK", end: true, beats: [nar("P3R2_F2")] }
      ] },
      say("registrar", "P3R2_O2", "happy"),
      { type: "end" }
    ]
  },
  "vn3-r3": {
    part: 3, partKey: P3, side: true, request: true, number: 3, after: "vn3-c2", titleKey: "P3R3_TITLE", summaryKey: "P3R3_SUMMARY", echoKey: "P3R3_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "skycity", titleKey: "LOC_SKYCITY" },
      { type: "enter", who: "starKid", x: 0.3, from: "left", face: "right" },
      say("starKid", "P3R3_K1", "happy"),
      say("partner", "P3R3_P1", "happy"),
      { type: "explore", field: "skycity", titleKey: "LOC_SKYCITY", goalKey: "P3R3_GOAL", start: [18, 88], spots: [
        { id: "billboard", kind: "inspect", at: [14, 66], labelKey: "P3R3_L1", beats: [nar("P3R3_F1")] },
        { id: "subaru", kind: "npc", who: "subaruMon", at: [74, 84], goal: true, end: true, beats: [say("subaru", "P3R3_S1", "shock"), say("subaru", "P3R3_S2", "happy")] }
      ] },
      nar("P3R3_N1"),
      { type: "end" }
    ]
  },
  "vn3-r4": {
    part: 3, partKey: P3, side: true, request: true, number: 4, after: "vn3-c3", titleKey: "P3R4_TITLE", summaryKey: "P3R4_SUMMARY", echoKey: "P3R4_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "arena", titleKey: "LOC_TRAINING" },
      { type: "enter", who: "rivalMon", x: 0.72, from: "right", face: "left" },
      { type: "enter", who: "partner", x: 0.3, from: "left", face: "right" },
      say("rival", "P3R4_R1", "calm"),
      say("partner", "P3R4_P1", "happy"),
      say("rival", "P3R4_R2", "serious"),
      { type: "battle", presets: [491], titleKey: "CLASH_TITLE_SPAR", win: "won", lose: "lost" },
      { ...say("rival", "P3R4_R_WIN", "happy"), label: "won" },
      { type: "jump", next: "after" },
      { ...say("rival", "P3R4_R_LOSE", "calm"), label: "lost" },
      { ...say("rival", "P3R4_R3", "think"), label: "after" },
      say("partner", "P3R4_P2", "happy"),
      { type: "end" }
    ]
  },
  "vn3-r5": {
    part: 3, partKey: P3, side: true, request: true, number: 5, after: "vn3-c4", titleKey: "P3R5_TITLE", summaryKey: "P3R5_SUMMARY", echoKey: "P3R5_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "town", titleKey: "LOC_TOWN" },
      { type: "enter", who: "mechanicMon", x: 0.55, from: "right", face: "left" },
      say("mechanic", "P3R5_M1", "think"),
      { type: "explore", field: "town", titleKey: "LOC_TOWN", goalKey: "P3R5_GOAL", count: ["g1", "g2", "g3"], start: [10, 88], spots: [
        { id: "g1", kind: "inspect", at: [11, 60], labelKey: "P3R5_L", beats: [nar("P3R5_F1")] },
        { id: "g2", kind: "inspect", at: [33, 66], labelKey: "P3R5_L", beats: [nar("P3R5_F2")] },
        { id: "g3", kind: "inspect", at: [76, 64], labelKey: "P3R5_L", beats: [nar("P3R5_F3")] },
        { id: "bard", kind: "npc", who: "mechanicMon", at: [55, 84], goal: true, requires: ["g1", "g2", "g3"], lockedKey: "P3R5_LOCK", end: true, beats: [say("mechanic", "P3R5_M2", "happy")] }
      ] },
      say("mechanic", "P3R5_M3", "happy"),
      { type: "end" }
    ]
  },
  "vn3-r6": {
    part: 3, partKey: P3, side: true, request: true, number: 6, after: "vn3-c5", titleKey: "P3R6_TITLE", summaryKey: "P3R6_SUMMARY", echoKey: "P3R6_ECHO", reward: { tickets: 1 },
    beats: [
      { type: "bg", id: "lotus", titleKey: "LOC_LOTUS" },
      { type: "enter", who: "caretakerMon", x: 0.7, from: "right", face: "left" },
      say("caretaker", "P3R6_C1", "calm"),
      say("caretaker", "P3R6_C2", "sad"),
      { type: "explore", field: "lotus", titleKey: "LOC_LOTUS", goalKey: "P3R6_GOAL", count: ["l1", "l2", "l3"], start: [10, 88], spots: [
        { id: "l1", kind: "inspect", at: [16, 64], labelKey: "P3R6_L", beats: [{ type: "fx", kind: "flash" }, nar("P3R6_F")] },
        { id: "l2", kind: "inspect", at: [50, 30], labelKey: "P3R6_L", beats: [{ type: "fx", kind: "flash" }, nar("P3R6_F")] },
        { id: "l3", kind: "inspect", at: [74, 64], labelKey: "P3R6_L", beats: [{ type: "fx", kind: "flash" }, nar("P3R6_F")] },
        { id: "jing", kind: "npc", who: "caretakerMon", at: [86, 84], goal: true, requires: ["l1", "l2", "l3"], lockedKey: "P3R6_LOCK", end: true, beats: [say("caretaker", "P3R6_C3", "happy")] }
      ] },
      say("caretaker", "P3R6_C4", "calm"),
      { type: "end" }
    ]
  }
};
