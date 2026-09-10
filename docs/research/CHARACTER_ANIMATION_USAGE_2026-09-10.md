# Original character animation usage — active integration

Owner scope: every character in Raising, Hunt and Battle. Preserve each
character's own resource, raw sequence, cell geometry, timing and transitions.
This record is partial integration evidence, not completion of that scope.

## Whole-roster source inventory

`scripts/research/audit-character-rom-animation-usage.py` reads the owner's
SHA-256-verified YDIJ ROM directly and compares all Main/Sub NANR timelines
with the current internal character runtime bundle. The manifest contains
228 species bindings to 224 unique character resources. Their four banks
(`digimon` Main/Sub and `db_digimon` Main/Sub) contain 13,008 sequences across
896 banks. The comparison found zero Main/Sub differences in numeric
sequence IDs, playback modes, loop starts, cell order or duration.

This is `STATIC_BINARY_READ`. The 228 bindings are enumerated from the current
manifest; this inventory does not independently prove every species-to-resource
loader call. It also does not prove normal gameplay reaches every animation.
NANR element type is checked explicitly; unsupported transform elements fail
instead of being silently reduced to cell indices.

The numeric report, including every character and bank, is kept in the private
archive at `_archive/animation-stage-2026-09-10/all-character-rom-usage.json`
under the parent workspace. Original pixel bundles remain internal research
assets; this work does not change their shipping status.

## Source-backed integration corrections

* Native character poses in Raising and Battle now keep playing when the OS
  requests reduced motion. Scene effects retain their existing preference.
  This fixes a path which selected the first frame during movement and attacks;
  it does not establish that this preference caused the owner's observation.
* OVL18 `02112378` dispatches through conditional `02047984`. Re-entering the
  same sequence must retain its frame and elapsed ticks. Idle, reaction entry,
  walk entry, sleep/morning, training and injury now preserve that distinction.
  Explicit fixed-frame and form-replacement requests remain separate.
* Food arrival at `02116800` dispatches reactions 9, 14 or 6 according to
  personality. The implementation now uses the full existing reaction
  dispatcher, including reaction 14's fixed common feedback frame 2 while
  retaining the character's existing pose.
* Full feeding at `02118810` dispatches reaction 27: character sequence 28
  together with common feedback sequence 6, frame 5. It now reaches the full
  dispatcher. The existing food writer still owns stress reduction.
* Food removal at `02118844` requests sequence 1, feedback 0 and 30 updates.
  The missing feedback is restored without borrowing reaction 18's stress
  side effect. Ad hoc timed reactions also clear stale feedback and preserve
  the current sequence phase on equal requests.

All requests select the resident's own species resource. No character-specific
stand-in animation or additional animation clock was introduced.

## Verification and remaining scope

The ten existing feedback and lifecycle integration checks passed after these
corrections; focused `git diff --check` passed. The previously recorded full
1,411-test run predates these latest changes and is not a fresh full-suite result.
The normal browser flow was reopened and a food item placed in Raising;
successive screenshots showed the resident at different positions. This is
not a frame-by-frame original/current comparison or whole-roster browser QA.

Still open: original Raising music-state caller integration, complete
normal-path Battle notification timing, and a per-behavior original/current
visual comparison covering all species. Asset presence and matching timelines
must not be reported as those tasks being finished.
