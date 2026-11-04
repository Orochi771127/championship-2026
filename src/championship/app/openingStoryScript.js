// The New Game opening's reading script (Owner-approved layered v3, 2026-11-02;
// paging and interaction completed by Claude 2026-11-03 under that approval).
// Pure data: no DOM, save, router or ticker.
//
// Four separate layers: the 80-second silent 16:9 background video, Ai-chan's
// transparent portrait, the DOM text and the music. Text is never squeezed into
// the video's timing: every page owns one segment of the background, which
// plays once and then holds on its last frame until the player reads on (the connection grid loops). The
// package's paragraphs are one page each; a section's video scene is shared
// evenly between its pages. Ai-chan stands full size inside the package's 38-50 s
// guide window (timeline.json visibleWindows) and stays docked after it, with the package's dialogue
// timings (master_visual_seconds).
//
// speaker  narrator | ai | player
// guide    null (not shown) | cat | catgirl | chosen (the player's choice) | docked (the chosen form, small,
//          in the corner while she narrates)
// loop     a background range played round and round under the page instead of holding its last frame
//
// Owner 2026-11-03 (phone test): once Ai-chan has connected and asked 「現在，可以好好聽我介紹了嗎？」 she
// no longer vanishes for an unnamed narrator; she tells the rest of the prologue herself, docked small
// in the corner so the partner's scenes stay clear. The connection grid (32-50 s) keeps flowing under
// the phone's last page and her whole conversation instead of freezing on one frame.

const page = (id, section, paragraph, video) => Object.freeze({ id, kind: "narration", section, paragraph, speaker: "narrator", guide: null, video: Object.freeze(video) });
const line = (id, dialogue, speaker, guide, video, kind = "dialogue") => Object.freeze({ id, kind, section: "guide", dialogue, speaker, guide, video: Object.freeze(video), loop: GRID_LOOP });
/** A page Ai-chan tells, docked in the corner, after she has introduced herself. */
const told = (id, section, paragraph, video) => Object.freeze({ ...page(id, section, paragraph, video), speaker: "ai", guide: "docked" });

export const OPENING_STORY_BACKGROUND = Object.freeze({
  src: "assets/production/opening/ai-chan-layered-v3-20261103/background.mp4",
  width: 1280, height: 720, durationSeconds: 80, fps: 24
});
/** Seconds of the background during which Ai-chan stands full size (afterwards she is docked). */
export const AI_CHAN_GUIDE_WINDOW = Object.freeze([38, 50]);
/** The connection grid: the phone's last page and the whole conversation loop inside it. */
const GRID_LOOP = Object.freeze([32, 50]);

export const OPENING_STORY_BEATS = Object.freeze([
  page("world-1", "world", 0, [0, 4]), page("world-2", "world", 1, [4, 8]),
  page("birth-1", "birth", 0, [8, 12.5]), page("birth-2", "birth", 1, [12.5, 17]),
  page("rift-1", "rift", 0, [17, 20.5]), page("rift-2", "rift", 1, [20.5, 24]),
  // The phone section spans the phone scene and the six-second connection grid.
  page("phone-1", "phone", 0, [24, 32]), Object.freeze({ ...page("phone-2", "phone", 1, [32, 38]), loop: GRID_LOOP }),
  line("ai-greeting", "greeting", "ai", "cat", [38, 40.6]),
  line("ai-surprise", "surprise", "player", "cat", [40.6, 41.5]),
  line("ai-offer", "offer", "ai", "cat", [41.5, 43.6]),
  // She changes form, then lets the player choose; both forms are the same guide.
  line("ai-choose", "choose", "ai", "catgirl", [43.6, 45.2], "choice"),
  line("ai-ready", "ready", "ai", "chosen", [45.2, 50]),
  told("encounter-1", "encounter", 0, [50, 54]), told("encounter-2", "encounter", 1, [54, 58]),
  told("arena-1", "arena", 0, [58, 61.5]), told("arena-2", "arena", 1, [61.5, 65]),
  told("gate-1", "gate", 0, [65, 68.5]), told("gate-2", "gate", 1, [68.5, 72]),
  told("invitation-1", "invitation", 0, [72, 76]), told("invitation-2", "invitation", 1, [76, 80])
]);
export const OPENING_STORY_BEAT_IDS = Object.freeze(OPENING_STORY_BEATS.map(beat => beat.id));
export const OPENING_STORY_FIRST_GUIDE_BEAT = OPENING_STORY_BEAT_IDS.indexOf("ai-greeting");
export const OPENING_STORY_CHOICE_BEAT = OPENING_STORY_BEAT_IDS.indexOf("ai-choose");

/** The beat index a stored resume id points at, or 0 for anything unknown. */
export function openingStoryResumeIndex(id) {
  const index = OPENING_STORY_BEAT_IDS.indexOf(id);
  return index < 0 ? 0 : index;
}

/**
 * Where the skip key goes. Until the player has picked Ai-chan's form, skipping
 * still meets her (a skip can never take the choice away for good): before her
 * greeting it jumps to the greeting, between the greeting and the choice it
 * jumps to the choice. Afterwards, or once a form is chosen, it ends the story.
 */
export function openingStorySkipTarget(index, chosen) {
  if (chosen) return null;
  if (index < OPENING_STORY_FIRST_GUIDE_BEAT) return OPENING_STORY_FIRST_GUIDE_BEAT;
  if (index < OPENING_STORY_CHOICE_BEAT) return OPENING_STORY_CHOICE_BEAT;
  return null;
}
