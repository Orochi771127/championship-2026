# NS33 opening film — bounded presentation contract

Authority: the 2026-10-12 NS33 entry in [Owner Direction](../../coordination/OWNER_DIRECTION.md). This is `OWNER_APPROVED_ADAPTATION`, not ROM evidence. The exact media source, hash, size and incomplete acceptance labels are in [the production manifest](../../../assets/production/opening-film-ns33-r1/manifest.json).

- Reuse the existing TITLE DOM, approved brand registry and preferences. The independent new-game story/onboarding still follows New Game. No new router, save, global state, Pixi application/ticker or simulation authority.
- Startup shows the film muted and inline with immediately available skip. Sound requires a trusted explicit click and respects global mute and master × music volume. Existing TITLE BGM pauses while the film plays.
- Finish and skip restore TITLE and start a fresh 15-second idle interval. Every pointer, key, wheel or focus input resets idle. Menus, native dialogs, hidden documents and other screens block automatic replay.
- Consume the skip gesture and its trailing input before LOGIN/New Game/Continue can activate. Keyboard users receive focus, a contained Tab order and Escape skip.
- Hiding the page pauses the film and clears idle; foreground shows TITLE and begins a fresh interval. Leaving TITLE removes listeners, timers and the media source. Late play-promise results cannot affect a newer playback.
- Reduced-motion preferences prohibit automatic playback and retain manual watch. Media rejection, error, an 8-second startup timeout or a 3-second playback stall restores TITLE, cancels the request and suppresses repeated automatic failures; manual retry remains available. Startup allows cold Pages delivery to compete with TITLE art; Skip remains immediately available.
- While the film is active, reuse the existing TITLE image lifecycle to pause unfinished decorative downloads. Resume TITLE art on return, retaining the existing music-buffer priority and decoded cache.
- Lazy media source assignment, content-hashed filename, explicit build-input selection and the existing Pages subpath apply. Publish only the final reviewed video and its manifest. No service-worker/cache authority is added.
- Reuse all five approved brand names and accessible translated watch/skip/sound labels. Show the existing DOM brand near the film ending. Preserve title art, mobile labels and touch targets.

Validation separates normal Chromium UI/media flow, controlled clock/network/background cases, exact-byte checks, public deployment checks, physical-device validation and subjective listening. The last two are **not accepted** by automated tests.
