# Public browser playtest — 2026-09-10

The Owner explicitly requested committing and pushing all completed work to main,
making the repository public, and publishing the current game for browser play.

- Repository: https://github.com/Orochi771127/championship-2026
- Game: https://orochi771127.github.io/championship-2026/
- Delivery: explicit GitHub Pages workflow dispatch from main.
- Build: `npm ci`, `npm run test:ci`, `npm run build:playtest`, `npm run validate:playtest`.
- Runtime selection: 6,233 reviewed input files, each pinned by SHA-256 in
  `docs/contracts/championship/WEB_BUILD_INPUTS.v1.json`.

This checkpoint collects completed implementation, research receipts, art outputs,
and documentation from the shared working tree. The browser artifact contains only
the selected runtime files. Native ROM/Nitro payloads, emulator RAM/saves, private
legal documents, local agent notes, and the parent archive are excluded.

The public-playtest policy adds this exact Pages destination to the existing local
reference-art loader. Existing asset provenance remains intact. The separate fully
verified public-release target still rejects pending rights and art acceptance;
this publication does not assert third-party licence verification, commercial
release approval, complete character behavior restoration, or physical-device QA.

The new release tests cover missing Owner approval, changed asset bytes, forbidden
private documents, the exact permitted HTTPS destination, and rejection of other
hosts/paths. Art manifest/atlas line endings are byte-preserved across checkouts
because existing provenance receipts hash those files. Code line endings stay LF.

Saves use the existing browser-local repository. A localhost save is not shared
with GitHub Pages. Use New Game for the first visit, then Save and Continue on the
same browser and origin. No extra router, save authority, renderer, or global
ticker is introduced by deployment.
