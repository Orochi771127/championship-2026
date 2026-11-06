# Species 218: two-frame public test candidate

**HOLD. Public test-branch disclosure only. Not accepted art, not a complete animation set, not ready to merge or deploy.**

This package contains exactly two existing 384 × 256 candidate PNG frames, cells 009 and 011, plus the data and code needed to try them through the game's existing General loader. Their decoded RGBA pixels, dimensions and alpha are unchanged from the original candidate crops. The original multi-pose sheet, other candidate images, unrelated metadata and private backup links are excluded.

## Scope

- Only HTTP(S) loopback URLs with exactly one `animHandoff=1` and `animGeneralCandidate=species-218` enable the candidate. Use isolated port 8761, never the Owner's save on port 8732.
- The existing native owner selects all 53 sequences and 87 ordered events. Six events use these two candidate frames; the other 81 keep native fallback. No new clock, timer, app, save, controller or gameplay authority is introduced.
- Existing reviewed selection takes precedence. Public hosts, ordinary URLs, Arena and other species do not load this package. Static, Battle and result-Sub controllers are unchanged.
- Runtime and art acceptance flags remain false. Public test disclosure is separate from shipping or commercial rights acceptance.

## Verification

Run from repository root:

    node --test tests/championship-species218-snapshot-qa-cases.mjs tests/championship-character-animation-timeline-cases.mjs

The isolated source subset passes 23 focused checks: exact PNG/crop hashes, two-frame disclosure boundary, gates, all native events, scale/flip handling, streaming fallback, cancellation and repeated disposal, plus unchanged timeline regressions. The PNG decoder is real, but these renderer tests use Pixi substitutes.

`npm run test:ci` cannot complete in the isolated subset because most repository tests are absent. Full CI, build/preload/public-contract checks and real browser/Pixi/GPU playback have not passed for this candidate. Branch-only pushes do not trigger the repository's main/PR CI workflow.

The previous supported browser initialization stopped before opening a page (`native pipe path unavailable`). An earlier Chromium attempt was blocked by sandbox socket restrictions. No security bypass was attempted. Portrait 390 × 844, landscape 844 × 390, desktop 1366 × 768 and physical-device checks remain open.

The calibration is provisional. The raised-foot comparison differs by approximately 9.88 game units, and pose 011 still differs in leg spread and weapon silhouette. Numeric fit and CPU checks do not establish visual acceptance. No omitted frames or effects are silently accepted or bound.

## Integrity

- 009 RGBA SHA-256: `964e1e04fdac583c39b09c868ff88054f98fa093b68bc23f7012d5c73da27181`
- 011 RGBA SHA-256: `21fd7c425fc1f74db12df2fc068546c167a9a4c3ee5d55f4ba1a6c2f5b453ad7`
- Native metadata matches public main `63776034296faa32f3498f94396c0e825403a340` and is pinned independently from these candidate images.

The next acceptance step is an ordinary game session containing species 218 on a working authorized browser surface, followed by the full repository gates. Merge and deployment require a separate decision.
