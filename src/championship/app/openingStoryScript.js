// The New Game opening's reading script (Owner-approved layered v3, 2026-11-02;
// paging and interaction completed by Claude 2026-11-03 under that approval).
// Pure data: no DOM, save, router or ticker.
//
// Four separate layers: the 80-second silent 16:9 background video, Ai-chan's
// transparent portrait, the DOM text and the music. Text is never squeezed into
// the video's timing: every page owns one segment of the background, which
// plays once and then holds on its last frame until the player reads on. The
// package's paragraphs are one page each; a section's video scene is shared
// evenly between its pages. Ai-chan appears only inside the package's 38-50 s
// guide window (timeline.json visibleWindows), with the package's dialogue
// timings (master_visual_seconds).
//
// speaker  narrator | ai | player
// guide    null (not shown) | cat | catgirl | chosen (the player's choice)

const page = (id, section, paragraph, video) => Object.freeze({ id, kind: "narration", section, paragraph, speaker: "narrator", guide: null, video: Object.freeze(video) });
const line = (id, dialogue, speaker, guide, video, kind = "dialogue") => Object.freeze({ id, kind, section: "guide", dialogue, speaker, guide, video: Object.freeze(video) });

export const OPENING_STORY_BACKGROUND = Object.freeze({
  src: "assets/production/opening/ai-chan-layered-v3-20261103/background.mp4",
  width: 1280, height: 720, durationSeconds: 80, fps: 24
});
/** Seconds of the background during which Ai-chan's layer may be visible. */
export const AI_CHAN_GUIDE_WINDOW = Object.freeze([38, 50]);

export const OPENING_STORY_BEATS = Object.freeze([
  page("world-1", "world", 0, [0, 4]), page("world-2", "world", 1, [4, 8]),
  page("birth-1", "birth", 0, [8, 12.5]), page("birth-2", "birth", 1, [12.5, 17]),
  page("rift-1", "rift", 0, [17, 20.5]), page("rift-2", "rift", 1, [20.5, 24]),
  // The phone section spans the phone scene and the six-second connection grid.
  page("phone-1", "phone", 0, [24, 32]), page("phone-2", "phone", 1, [32, 38]),
  line("ai-greeting", "greeting", "ai", "cat", [38, 40.6]),
  line("ai-surprise", "surprise", "player", "cat", [40.6, 41.5]),
  line("ai-offer", "offer", "ai", "cat", [41.5, 43.6]),
  // She changes form, then lets the player choose; both forms are the same guide.
  line("ai-choose", "choose", "ai", "catgirl", [43.6, 45.2], "choice"),
  line("ai-ready", "ready", "ai", "chosen", [45.2, 50]),
  page("encounter-1", "encounter", 0, [50, 54]), page("encounter-2", "encounter", 1, [54, 58]),
  page("arena-1", "arena", 0, [58, 61.5]), page("arena-2", "arena", 1, [61.5, 65]),
  page("gate-1", "gate", 0, [65, 68.5]), page("gate-2", "gate", 1, [68.5, 72]),
  page("invitation-1", "invitation", 0, [72, 76]), page("invitation-2", "invitation", 1, [76, 80])
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
