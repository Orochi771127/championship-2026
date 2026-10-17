// Per-mode defaults use the existing Owner-supplied MP3 catalog and shared bus.
// The ordinary Battle preference and all original audio files remain intact.
export const DATA_ARENA_MODE_MUSIC = Object.freeze({
  TOURNAMENT: Object.freeze({ id: 'unison_under_fire', scene: 'data_arena_tournament' }),
  HARBOR: Object.freeze({ id: 'federation_siege', scene: 'data_arena_harbor' })
});

export function dataArenaMusicForMode(mode) {
  const cue = DATA_ARENA_MODE_MUSIC[mode];
  if (!cue) throw new RangeError(`UNKNOWN_DATA_ARENA_MUSIC_MODE_${mode}`);
  return cue;
}
