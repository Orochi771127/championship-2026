# Two public import-chain repairs (2026-10-17)

Base checkpoint: `81a05725d39cc59e0b185ebcce91a9f85a4a26df`. Repair code commit: `9b79d884a2da0022e18d941cbc43430a3883390b`. This is a local candidate. No asset bytes, gameplay, save IDs, character bindings, native animation, original39 heroes, species116, A-frame or MA50/MA62 data were changed by this round. No push, merge or deployment occurred.

## Changes and focused validation

- Removed only three legacy modules from the public allowlist and matching playtest hash selection: `alternateFormQaCharacters.js`, `characterHudArt.js`, `completedOriginalCharacters.js`. Their original files and local `WEB_BUILD_INPUTS.files` / module entries remain intact for private QA. Normal Main already loads `publicCharacterRoster.js` and `publicCharacterHudArt.js`; no selected source retains a literal import URL to those legacy adapters. This resolves the excluded battle-packed source manifest through the obsolete public entry, without copying that manifest.
- Removed the `assembledUiArt.js` import and its fallback branch from `shopGoodsUiArt.js`. Existing original public UI data covers every non-cage Shop record (0 through82), and all46 Hunt equipment variants use the same existing goods identities. The four exact approved toolbar rest-pose fallbacks remain. No unapproved replacement art or minimal fabricated review registry was introduced.
- Character entry/native loading/HUD focused checks: **5 passed** (`CHARACTER_FOCUSED.txt`). Shop,83 original goods,46 Hunt variants,35 cage projection and privacy-boundary focused checks: **9 passed** (`SHOP_FOCUSED.txt`). These are focused checks, not a full game/browser/release pass.
- Selected shop module SHA256: `57ebccc1ddc8a18c2d1085e3a565c1490bc537be537bfec3abe309a37fb8e5f5`. Full private authority index remains unchanged at `3e7b7694a88c3b7d75e444b1e04bb769923480bfeecb2df19e68005c6b6eb87f`.

## One build preflight and next concrete blocker

Exactly one `node scripts/build-github-pages.mjs --playtest` invocation was made this round. Exit **1**, `WEB_INPUTS_NOT_CLOSED` at `scripts/lib/web-build-artifact.mjs:45`. The selected static module closure, Ranch and public-character guards completed. The following global `auditWebBuild` audits all local build inputs rather than only the selected public slice. It found **8,429 missing inputs**, comprising **2,197 selected** and **6,232 unselected** paths.

First blocked file: `assets/production/battle/licensed-runtime-v1/fields/field_bm01_01/frame-00.png`; reason `BUILD_INPUT_MISSING`. The same first set continues through `field_bm02_01` to `field_bm11_01`. Selected missing groups also include1,089 accepted character files,142 harbor-r6 files,101 accepted Hunt images and100 original item images. Counts and representative paths are in `BUILD_PREFLIGHT.json`.

This is a failed local preflight, not an automatic-approval denial or uncertain execution. No missing legacy or ROM-referenced file was restored, uploaded or relabelled. Presence in the old allowlist does not provide new publication permission. The next bounded work must distinguish missing approved runtime bytes from unselected private preparation inputs and unsupported legacy selections, then keep the build audit scoped correctly without weakening privacy/rights checks. It is outside this two-chain repair round.

Owner-playtest approval validation, bundle construction, full selected byte/schema/hash audit, built artifact quota and normal full-game browser validation were not reached. No second build was run. Raw local log: `C:\Users\User\Documents\Codex\2026-10-17\task-3\local-preparation\two-import-repair-preflight.log`; 2173014 bytes; SHA256 `d5c271c6f2f56c8ae930b425d8f450ea8cbe121c77f25799b02217e6b10137ad`.

## Current capacity (metadata/report reads only)

Current selection: **7,625 files / 1,144,919,258 bytes**, **144,919,258 bytes above** the conservative1,000,000,000-byte guard, before generated artifact overhead. Zero unknown sizes. The previous larger total was1,144,942,982; this round removes23,724 source-code bytes. This is source selection size, not a built artifact. Existing local metadata and the matching cached public receipt supplied sizes; no new download, decoding, image probe or conversion was performed.

### Largest ten current individual files

| File (under assets/production/) | Bytes |
| --- | ---: |
| `opening-film-ns33-r1/opening-1080p-30b17392.mp4` | 73,388,752 |
| `opening-film-ns33-r1/opening-720p-ef50993b.mp4` | 19,412,041 |
| `opening-film-ns33-r1/opening-540p-6869b2cb.mp4` | 8,782,520 |
| `original-music-r1/bgm_southern_harbor_nexus.mp3` | 6,583,124 |
| `original-music-r1/bgm_southwest_tidal_frontier.mp3` | 6,510,296 |
| `hunt/accepted-20261010/images/fe719c5f4c97f827f58e252806437abebabbaf76b32db0e9d72bc31162b44dd9.webp` | 6,231,294 |
| `hunt/accepted-20261010/images/cb1cd68328341ffcd5ffd99c611a17ed331838c61c20d2f2ffd6811235633de2.webp` | 6,108,190 |
| `hunt/accepted-20261010/images/4ac709d5f4ce1145026ded02ffcf606b98243bb871889e4f0ac271c01c458b69.webp` | 6,092,288 |
| `hunt/accepted-20261010/images/32535b2f9ee784ff749cf7fc172928b1038697794d4c49f98e8827f60f2719a4.webp` | 5,765,622 |
| `characters/alternate-forms-20261015/m540_imperialdramon_fm-r10_quadruped-r1/main-00.png` | 5,594,761 |

### Largest ten current groups

| Group | Files | Bytes |
| --- | ---: | ---: |
| `ranch-streaming/webp` | 2,127 | 430,127,610 |
| `assets/production/hunt/accepted-20261010` | 126 | 240,551,122 |
| `assets/production/opening-film-ns33-r1/opening-1080p-30b17392.mp4` | 1 | 73,388,752 |
| `assets/production/characters/accepted-20261010` | 1,311 | 41,203,886 |
| `assets/production/characters/alternate-forms-20261015` | 98 | 37,500,159 |
| `assets/production/characters/battle-packed-20261013` | 28 | 33,271,546 |
| `assets/production/opening-film-ns33-r1/opening-720p-ef50993b.mp4` | 1 | 19,412,041 |
| `src` | 481 | 14,580,953 |
| `assets/production/data-arena/harbor-blender-r6` | 143 | 10,655,589 |
| `assets/production/temporary/int-rh2` | 12 | 9,258,683 |

### Current extension totals

| Extension | Files | Bytes |
| --- | ---: | ---: |
| `.webp` | 3,784 | 806,937,756 |
| `.png` | 557 | 150,419,193 |
| `.mp4` | 3 | 101,583,313 |
| `.mp3` | 12 | 51,160,070 |
| `.json` | 2,769 | 18,281,112 |
| `.js` | 419 | 10,809,256 |
| `.mjs` | 1 | 2,087,231 |
| `.m4a` | 5 | 1,487,682 |
| `.ogg` | 5 | 1,002,279 |
| `.css` | 21 | 592,305 |
| `.glb` | 26 | 265,304 |
| `.jpg` | 1 | 233,617 |
| `.html` | 1 | 36,812 |
| `.svg` | 21 | 23,328 |

### Lossless possibilities and limits

- **PNG to lossless WebP:** technically a candidate when full dimensions and decoded RGBA remain exact and runtime/role hashes are updated consistently. The557 current PNGs total150,419,193 bytes. Existing MA62 measured1,765,019 to1,267,930 bytes (28.16% saved, exact full-resolution RGBA). Applying that one-image ratio to every PNG would arithmetically suggest42,363,128 bytes, but is only sensitivity arithmetic, not a corpus estimate or permission to rewrite protected existing portrait hashes. Coverage and actual ratios remain unmeasured. PNG-only savings sufficient for the present deficit would require more than96% reduction.
- **Ranch lossless page trimming/repack:** the existing two bounded probes saved4.68% and8.93%, with all tested RGBA reconstructed exactly. Applying those ratios to430,127,610 page bytes gives20,109,844 to38,393,896 bytes only as sensitivity arithmetic. No full repack result exists; no pages were changed.
- **Already encoded WebP / current video / audio:** no measured exact-pixel or exact-sample smaller encoding is available in the existing reports. All three remaining film qualities are active; dropping or lowering them would violate this round. Accepted Hunt image references are active. Re-encoding already lossy media is not assumed lossless.
- **Duplicate hashes:**12 groups, at most2,104,060 bytes before reference changes. The temporary int-rh2 group is9,258,683 bytes but has not been proven unused. Already-pruned old atlas/HUD/hero/video sources cannot be counted again.

There is still no evidence-backed lossless plan covering144,919,258 bytes plus final artifact overhead. Even the illustrative PNG+ranch+duplicate arithmetic is only64.6 to82.9MB and is not a guaranteed achievable saving. No batch conversion, quality reduction, content removal, new hosting or fee proposal was made.

## Publication and safety status

Local repair and reports only. Pushed: no. Merged: no. Deployed: no. New public verification URL: none. The previous full-index upload rejection, repair-source read restriction and different-destination Google Drive refusal remain binding; none was retried. The imported loading handoff remains local and is not represented as a completed remote handoff or accepted deployment.
