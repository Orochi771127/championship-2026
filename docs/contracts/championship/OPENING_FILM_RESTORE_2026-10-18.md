# Opening film restoration — 2026-10-18

Owner explicitly requested restoration, allowed publication after self-review, and ultimately accepted either 720p or 540p. This supplement supersedes the automatic startup/idle and multi-resolution selection in the [original contract](NS33_OPENING_FILM_2026-10-12.md). It does not change gameplay, saves, the independent New Game story, or commercial rights.

## Verified source and capacity

The current player was deliberately paused by `OPENING_FILM_ENABLED=false` with a release-pause comment. Available shallow history does not establish the original reason for that pause. Enabling it unchanged would start downloading on entry and select a 73,388,752-byte desktop video; the three old selected encodings plus poster total 101,816,930 bytes.

The exact approved 58-second 1080×1920 master remains unchanged (`30b173920b3ad776aa9fc85949c720715f2d0b6fad6bca2a443ae30686a770ce`). FFmpeg generated two comparison derivatives, without speed, pitch or content edits:

| Candidate | Actual bytes | Publication choice |
| --- | ---: | --- |
| 540×960, H.264 High level 3.1, 24 fps, AAC LC 48 kHz stereo | 4,755,124 | Selected |
| 720×1280, H.264 High level 3.1, 24 fps, AAC LC 48 kHz stereo | 7,046,343 | Local comparison only |

Representative frames at 12, 28, 41 and 53 seconds were inspected. Both preserve recognizable characters and scenes; 720p is sharper, but adds 2,291,219 bytes. These samples and full-frame comparison do not establish subjective full-motion or listening acceptance. The selected 540p file decodes completely, has 1,392 video frames / 58.000 seconds, uses faststart, and has integrated loudness −15.9 LUFS, LRA 8.5 LU and true peak −3.1 dBFS. There is no measured clipping or retiming. The compression recipe and exact hash are in the [production manifest](../../../assets/production/opening-film-ns33-r1/manifest.json).

The published camera baseline `e14e7c82cf24ca40d3cf34d6a169092888d2809c` measured 7,751 files / 988,881,946 bytes. Adding this file and the unchanged 233,617-byte poster gives 993,870,687 bytes before program/metadata changes, approximately 6.13 MB below a conservative 1,000,000,000-byte ceiling. This is an estimate only: the final build must be measured, remain below 1 GB, and preserve at least 6 MB of headroom. Only the new derivative and poster are public; all old movie files stay in the source repository and outside the artifact. No other assets are deleted to create space.

## Playback contract

- Startup and idle show a usable TITLE and request no MP4. The existing translated Watch button explicitly starts the one small source on every viewport. No HD fallback or second download is selected on resize.
- Playback is inline and initially muted. The existing trusted sound button respects global mute and master × music volume. A zero master/music level explicitly mutes the element and disables its sound button, including on browsers that ignore element volume. Browser gesture restrictions still apply; audible autoplay on an iPhone is not promised.
- The existing `onActiveChange` → `syncMusic()` path requests no BGM scene during playback. It restores the current TITLE music only after the movie stops. No second music bus is introduced.
- Skip is immediate during loading or playback, consumes the trailing gesture, and restores entry controls. Escape also skips; keyboard focus stays within the film controls while active.
- Natural end, skip, errors, rejected play, startup/stall timeout, background, pagehide and TITLE departure pause/mute the video, remove its source, call `load()` to cancel/release it and clear deadlines. Foreground and TITLE return never restart it automatically. Explicit Watch can retry.
- Existing TITLE decoration and buffer-aware warmup remain bounded and independent of entry. The movie never becomes a requirement for Login, New Game or Continue.

## Validation and publication

Focused source/asset/public-boundary tests precede integration. `tests/championship-opening-film-browser.cjs` now covers cold/idle no-download, native 58-second finish, audio/BGM exclusion, skip/replay/resize, controlled background and rapid departure, rejected/404/network/slow recovery, all five locales, mute/reduced-motion and normal Continue with unchanged save authority. Controlled visibility events are not physical-device coverage.

The single main publisher integrates this commit on top of the camera release, runs real Chrome and formal build/validate/payload gates once, measures the final artifact and verifies the public MP4/hash/entry path. Physical iPhone and subjective listening acceptance remain pending. R has unrelated uncommitted work and must not be overwritten or reset.
