# Friends browser baseline comparison — 2026-10-25

## Scope and conclusion

The observed `source-wrap-desktop` failure is a 90-second ordinary tool transaction exhausted after a naturally appearing calendar. Evidence establishes that severe browser/UI latency and incomplete Friends desktop acceptance existed before growth38. It does **not** prove the exact failure occurs on main, exonerate every changed runtime path, or constitute a passing performance/browser acceptance. Do not waive a required check on this report's authority. No test, deadline, clock, assertion, or runtime was modified for this diagnosis.

## Current failure

- Run [40219428200](https://github.com/Orochi771127/championship-2026/actions/runs/40219428200), commit `a2204f036f496e5da4791dabb612dacd33072a7d`, job `121247559256`.
- Diagnostic artifact `12609108279`: `result.json`, `failure.png`; trace artifact `12608893313`: `source-wrap-desktop-trace.zip`.
- `tool:clean` began 18:14:29.178Z; ended 18:16:00.434Z, 91,256.8 ms. A normal tool click was intercepted by the native calendar and timed out at its existing 30-second cap. The calendar was then normally acknowledged. The last raw preparation observation was `{overlay:{kind:"canvas"},three:null}`; the original shared 90-second deadline had expired. This is not evidence of a calendar stuck on screen.
- Trace network contains 1,655 requests and **zero `growth-authored` asset requests**. Residents were original accepted-20261010 Botamon, Wargraymon, Shinegraymon, Blackwargreymon, Metalgarurumon VA, and Dukemon.
- No recorded page errors or network errors. Console records SwiftShader GPU ReadPixels stalls and `Raising reaction art unavailable Error: LOAD_TIMEOUT` warnings. Three readiness eventually passed for all six residents.

## Pre-growth comparison and exact-main limitation

- Pre-growth run [40106705703](https://github.com/Orochi771127/championship-2026/actions/runs/40106705703), 2026-10-24, commit `c61153b750000ba9f824eab4869903b98b65ddfe`, branch `release/ui-menu-cues-20261024`; diagnostic artifact `12565851366` for the same source-wrap-desktop scenario.
- Its ledger remains RUNNING at boundary 90 (`mouse.move`) without a final failure record, consistent with the workflow/job timeout rather than a completed successful acceptance. It already records SwiftShader ReadPixels stalls and reaction LOAD_TIMEOUT. It progressed farther than this current failure; it is **not an identical assertion reproduction**.
- GitHub Actions API query `actions/runs?head_sha=105fafbd4d6a736476a414825e0dcfcf8ef8611c&per_page=100` returned only successful general CI `40050337781` and Pages deployment `40050337779`; no exact-main Friends run was returned. The unchanged Friends workflow triggers on pull requests or workflow_dispatch, not main pushes.

Matched wall-clock ledger boundaries (seconds):

| Boundary | Pre-growth | Current |
|---|---:|---:|
| 22 home | 40.676 | 43.625 |
| 26 saved read-only | 6.039 | 6.035 |
| 42 home | 43.445 | 44.027 |
| 46 saved read-only | 6.332 | 5.948 |
| 49 saved read-only | 6.409 | 6.232 |
| 51 home | 60.842 | 58.960 |
| 54 tool:clean | 37.543 | 91.257 (failed) |

## Source identity checks

Compared exact main `105fafbd4d6a736476a414825e0dcfcf8ef8611c`, pre-growth `c61153b750000ba9f824eab4869903b98b65ddfe`, and local integration `47af1588` (the local equivalent of the new test-only revision). All three have identical Git blobs for:

| File | Git blob |
|---|---|
| tests/championship-friends-playtest-browser.cjs | de91cb2f9f2436fb3b69b7eb06a6d19a210e57d2 |
| .github/workflows/friends-playtest-browser.yml | d0f82e352766e65824fe9dae19a3cbcf20324bba |
| tests/friends-installer-fixture-support.cjs | b796e8dcbed22ccd57a9a7771540c6150ea40e10 |
| qa/championship-full-qa-save.json | 82b18c83c3cf6cff290274d700ab3c634e0b545d |
| src/championship/presentation/ranchThreeScene.js | 19fff3b74e96248833a4fb78a2d6c93fa56d9bfd |
| src/championship/presentation/characterAtlasQueue.js | a1beee04f2442781e0add49679fddca185878cbc |
| src/championship/raising/createRaisingHomeRuntime.js | 8f338deaeb42cba983b456c67869c2d9a343bc78 |
| src/championship/app/raisingHomeP1RView.js | c96e72caac448866363fae2b7a78ec4d18db329e |

The current branch also leaves `assets/production/characters/accepted-20261010` and `assets/production/cage/three-20261021` unchanged from exact main. The pre-growth branch adds toolbar menu icons/UI cues, including callbacks in main/toolbar; it is therefore not a byte-identical main runtime. Current growth38 changes shared character-loader/presenter code even for legacy actors (authored lookup returns no replacement when absent), plus raising normalization/evolution support. Thus not all exercised code is identical, and an exact-main controlled performance comparison would still be needed for a full regression ruling.

## Release handling

Classify **preexisting latency/acceptance incompleteness established; exact-main identical failure and full performance non-regression not established**. Retain current failure and fresh rerun results, honor branch protection, and do not convert this diagnostic into a passing check. Local browser reproduction remains unavailable under the existing sandbox socket restriction; no bypass was attempted.
