# Character asset delivery

The game retains its approved logical paths and source bytes. An explicit public
build can deliver the selected `assets/production/characters/` subtree from the
versioned `Orochi771127/cyber-partner-runtime-assets` Pages site. Production files,
main illustration masters, drafts, review records and partial handoffs belong to
the private `Orochi771127/cyber-partner-animation` repository; that archive is not
a browser asset server.

## Build modes

`npm run build:playtest` remains a full, self-contained publication. Source/dev
imports and loopback review keep local URLs, including the existing handoff switch.
For an isolated full build:

```sh
npm run build:playtest -- dist/character-bridge-full
npm run validate:playtest -- dist/character-bridge-full
```

External delivery is explicit:

```sh
npm run build:playtest -- --external-characters dist/character-bridge-external
npm run validate:playtest -- --external-characters dist/character-bridge-external
node scripts/assert-public-payload.mjs dist/character-bridge-external
node tests/championship-external-character-browser.cjs
```

The browser gate fulfills only the built game files at the existing approved game
origin, then requests character files from the real asset host. It uses isolated
contexts and the repository QA fixture, covers portrait, landscape and desktop,
and also runs a fresh New Game. Its response hashes, screenshots and normal UI
checks are controlled Chromium evidence, not physical-device acceptance. The
`Verify external character delivery` PR/manual workflow runs this gate without
deploying the game.

## Pinned release and exact partition

`docs/contracts/championship/EXTERNAL_CHARACTER_ASSETS.v1.json` identifies one
verified immutable release. `EXTERNAL_CHARACTER_ASSET_FILES.v1.json` is the exact
host `runtime-manifest.json`, pinned by SHA-256. The first release uses source
snapshot `63776034296faa32f3498f94396c0e825403a340` and preserves the logical
`assets/production/characters/` prefix under its version directory.

The full source closure, reviewed file hashes, privacy boundary and existing
public-playtest/rights gates run before partitioning. External mode requires
the release file set to equal the whole selected character subtree, then checks
every file's SHA-256 and size against the local source and approved allowlist.
It compiles the pinned delivery constant into the existing browser bundle and
omits exactly those files from the final game artifact. Its build receipt records
the external manifest hash, base URL, version, count and byte total. Validation
reconstructs both the normal selection and the partition and rejects extra,
missing or changed files. The existing actual-output Pages size cap remains.

The resolver changes only URL transport on the approved public game origin.
Legacy and reviewed runtime JSON, relative atlas/image URLs, title parade,
prefetch, HUD, Dex motion, Arena and opening eggs all use the same release.
The original page URL continues to control eligibility and local QA. Character
IDs, frame coordinates, geometry, timing and source images are unchanged.

## Updating or reverting a release

1. Complete and approve the new animation selection through the existing source
   process. A source/manifest mismatch fails the external build.
2. Build and validate the full approved game snapshot. Extract only its selected
   character subtree into a new immutable asset-host version; validate every
   host file and preserve older versions used by deployed games.
3. Verify the deployed host manifest and sampled live bytes, copy the exact
   manifest here, update the pinned contract and record the verification. Keep
   its status pending until the endpoint is verified.
4. Run source tests, both artifact validators and the normal browser gate before
   merging the candidate. Update the game workflow to use the explicit external
   option only after these checks pass.

To stop using external delivery, rebuild without `--external-characters`; the
full selected bytes remain available in this source snapshot. That larger
artifact must still satisfy the unchanged Pages size limit. Downloading or
copying an archive alone does not reduce a site's deployed size, and removing
source files or rewriting Git history is outside this delivery change.
