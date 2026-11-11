// Story mode sound cues (OWNER_APPROVED_ADAPTATION 2026-11-11). Synthesized on
// the spot by the ceremony synth (ceremony/ceremonyAudio.js): oscillators and a
// short noise burst, no audio file. They play through the product audio bus's
// sfx output, so mute, master and sfx volume apply; a cue that cannot play is
// silent, and nothing waits on a sound.

import { playCeremonyCue } from "../ceremony/ceremonyAudio.js";

const N = Object.freeze({ G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.51, G6: 1567.98 });

/** [startSeconds, type, freq, toFreq|null, duration, peak] per voice, as the ceremony cues. */
export const STORY_VN_CUES = Object.freeze({
  // Someone answers when spoken to: two soft blips.
  talk: Object.freeze([[0, "triangle", N.E5, null, 0.08, 0.18], [0.09, "triangle", N.G5, null, 0.1, 0.16]]),
  // A clue: a small glint.
  discover: Object.freeze([[0, "sine", N.C6, N.G6, 0.18, 0.18], [0.05, "noise", 6200, 9000, 0.14, 0.05]]),
  // Through an exit: a soft step of air.
  step: Object.freeze([[0, "noise", 700, 1800, 0.22, 0.12]]),
  // A choice or the request board opens: a pluck.
  choice: Object.freeze([[0, "triangle", N.A5, null, 0.12, 0.16], [0.06, "sine", N.E6, null, 0.16, 0.08]]),
  // A bond moment: a warm open chord and a sparkle.
  bond: Object.freeze([[0, "sine", N.C5, null, 0.7, 0.14], [0, "sine", N.G5, null, 0.7, 0.1], [0.12, "triangle", N.E6, null, 0.5, 0.14], [0.2, "noise", 5600, 8400, 0.3, 0.05]]),
  // The warning card: a low two-tone.
  warning: Object.freeze([[0, "square", N.G4, null, 0.16, 0.08], [0.2, "square", N.G4, null, 0.16, 0.08]]),
  // A chapter cleared: a bright little arpeggio.
  clear: Object.freeze([[0, "triangle", N.C6, null, 0.14, 0.22], [0.08, "triangle", N.E6, null, 0.14, 0.2], [0.16, "triangle", N.G6, null, 0.4, 0.22]])
});

/** Play a story cue on an audio output ({ context, destination }); returns the cue's handle or null. */
export function playStoryVnCue(name, output, { gain = 0.32 } = {}) {
  if (!STORY_VN_CUES[name]) return null;
  return playCeremonyCue(name, output, { gain, cues: STORY_VN_CUES });
}
