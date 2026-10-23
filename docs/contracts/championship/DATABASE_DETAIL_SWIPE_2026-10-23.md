# Database detail swipe — Owner-approved presentation adaptation

Owner requests left/right browsing between encyclopedia character details and
explicitly authorizes a feature branch/PR, normal main integration after tests,
and the existing GitHub Pages release. Publication confirmation:
`Sentinel_727daf9208a88191b29a881eee0e716b` (2026-10-23 09:19:17 UTC), following
the exact scoped permission question. Feature request/publication instruction:
`Sentinel_85551f2040bc8191be4a8e0caeee4b58`.

Classification: `OWNER_APPROVED_ADAPTATION`. This changes detail navigation,
not original-game evidence, character data, art, stories, evolution or save truth.

## Behavior

- Ordinary hero images and non-interactive detail areas accept single-finger
  left/next and right/previous swipes. Existing list click and swipe share the
  same `selectDatabaseSpecies` intent (and existing view-local egg selection).
- Read neighbors from `databaseDisplayRows(book, activeStage)` each time. Keep
  existing ordering, filtering and locked-detail redaction. Stop at boundaries;
  a one-row result cannot navigate. No queue, wrap or new selection authority.
- Preserve the original list position/filter/return anchor; reset the new
  detail scroll and focus its heading. Existing native controls and Escape work.
- Require clear horizontal intent and final travel of at least 56 CSS px.
  Reject vertical/ambiguous diagonal movement, changed contacts, multi-touch,
  pinch, selection, drag, cancellation and viewport-edge starts. Exclude
  interactive controls/ancestors and explicitly draggable images, not all images.
- Keep existing portrait generation/abort guards and local loading/error states.
  No full-catalog image preload, new art or gameplay/save mutation.

## Verification boundaries

`tests/championship-database-swipe-cases.mjs`: 28 controlled-DOM cases at the
initial candidate, using actual view bodies with synthetic catalog/frame/art
transport. This is not native browser or device acceptance.

`tests/championship-database-swipe-browser.cjs` extends the existing Dex portrait
workflow after fresh normal public-build onboarding. Chromium CDP touch input
must produce trusted browser events. Required cases include loaded hero-image
swipes, vertical scrolling, consecutive directions, filtered first/last stops,
cancel/multi-touch/interactive exclusions, list return and screen re-entry.
Screenshots and `swipe-result.json` join the existing workflow artifacts.

The current stage filters all contain multiple entries. Browser evidence must
record actual stage counts and the single-row condition as unreachable through
the current controls; controlled-DOM single-row coverage must remain. Do not
alter the production catalog or player registration to manufacture this case.

Actual workflow conclusions are required before merge; queued jobs or local
unit results are not a browser PASS. Chromium portrait touch emulation does not
prove physical iPhone/iOS system-back, pinch, accessibility or visual acceptance.
Owner physical-device confirmation remains pending.

## Integration

Base: main `945a95a0470c8b430f28182e4305a17a68b4ae7e` (PR72), preserving its
hero `speciesId` binding. Reuse existing CI and Pages, add the new deterministic
test to the explicit CI scope, and update only the exact changed runtime hash in
`WEB_BUILD_INPUTS.v1.json`. Keep every prior asset selection and all build gates.
No branch-protection bypass, unrelated feature merge, or asset substitution.
