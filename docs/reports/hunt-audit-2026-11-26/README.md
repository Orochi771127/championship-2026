# Hunt maps self-audit, 2026-11-26

Owner request after #308-#314: check every hunt map for errors, for web-suitable formats, for
partner movement (walking, fleeing, avoiding), for hunt tools, and for the hunt experience on
phone portrait, phone landscape and desktop.

**Result:** no errors found in display, movement or tools on any of the 16 maps. One format
problem was found and fixed in this PR (hm02-hm06 shipped uncompressed geometry). One layout
weakness is left for the Owner to decide (phone landscape side panel).

## 1. Files and formats (all 16 maps)

Tool: `node scripts/qa/hunt-map-static-audit.mjs`.

- Every manifest, GLB, picture, mask, height grid and fallback picture exists and matches its pinned hash.
- Every map, walkability grid and fallback picture is 2880 px (180 x 180 tiles).
- Pictures are WebP. GLBs embed their images and have no external buffers.
- **Fixed: hm02-hm06 GLBs had no mesh compression.** GitHub Pages serves `.glb` without gzip, so players downloaded 14.95 MB for these five maps.
  - They are now Draco-compressed at file level (`hunt-expansion-20261125/scripts/draco_compress_glb.py`): 5.43 MB.
  - Nodes, meshes, materials, images and names are unchanged; triangle order is preserved.
  - Measured drift: positions at most 0.0006 units (0.03 px), UVs at most 0.00003.
  - New folders (`hm0x-three-v*d-20261126`), so no stale cache is served.
- All 16 maps together: 74.4 MB before, 64.8 MB after. A new test keeps every map Draco-compressed and inside a size budget.

Not changed, for the record:
- The two pre-baked maps hold the most texture memory on a phone: hm01 about 95 MB and hm08 about 63 MB (estimates: RGBA frames plus mask). hm01 already runs on iPhone; hm08 is smaller, but was not measured on a real phone.
- The largest downloads are hm18 (9.9 MB), hm01 (8.6 MB), hm14 (7.1 MB) and hm11 (6.9 MB). They are already Draco-compressed; their size is triangle count (300k+).

## 2. Partner movement (simulation, no browser)

Tool: `node scripts/qa/hunt-behaviour-audit.mjs` (exit code 1 on a failure).

32 sessions: 16 gates at a day hour and a night hour, 90 s of game time each, with the tamer
walking at the nearest partner every 3 s. 290,812 position samples.

| Check | Result |
|---|---|
| Partner standing on a blocked tile | 0 |
| Partner leaving through the new east or south edge | 0 |
| Partner leaving through the north or west edge | 439 samples; these are the original escape edges |
| Partner flagged as moving but still for 2 s | 13 incidents in 3 sessions |

The 13 stalls are at three inner wall corners inside the original 128 x 128 area (Desert night
tile 101,120; Ruins day 26,117-119; Sewer day 91-92,120). A partner pressed into the corner
stays there about 2 s and then moves on. These tiles carry the original steering data. I did
not confirm whether the un-expanded original maps stall at the same spots.

## 3. Browser check (Chromium, real game build from this branch)

Viewports: phone portrait 390 x 844, phone landscape 844 x 390 (both touch, DPR 2), desktop 1440 x 900.

- **Round 1, before the compression:** 16 maps x 3 layouts = 48 cases.
- **Round 2, with the compressed GLBs:** 14 cases (hm02-hm06 and hm08).

Results over the 62 cases:
- Three was active in every case; there were no page errors or console errors.
- Field load took 3.2-4.2 s (local files and a desktop GPU; not a phone-network figure).
- The rope caught a partner in 22 of 22 portrait cases, using the game's own tools.
- The view never left the map. Both far corners can be reached on all three layouts.
  - One round-2 case (forest, portrait) stopped 210 px short on one axis. The same map and layout reached the corner in round 1. The cause was not confirmed; a test drag starting on a partner is the likely one.
- Every screenshot was looked at (`*-16-maps-*.jpg`): no black ground, blank area or missing texture, including the new strips.

Layouts as measured:

| Layout | Map area | Tools |
|---|---|---|
| Phone portrait | full screen | bottom dock |
| Desktop | full screen | bottom dock, centred |
| Phone landscape | 586 x 390 of 844 x 390 | side panel, 258 px wide, mostly empty |

## 4. Hunt tools (Chromium, portrait, 5 maps)

Maps: canyon (hm08), factory (hm10), ice (hm13), crag (hm14), grass (hm01), with one item of
every class equipped. Evidence: `browser-tools-5-maps.json`, `tools-in-new-strips.jpg`.

| Tool | Checked | Result |
|---|---|---|
| Rope | catch a partner | works (22 of 22 in section 3) |
| Shot (麻痺散彈) | fire at a partner | fires every time; HP dropped when it hit |
| Lure lamp (藍色誘引燈) | place on open ground in the new strip | placed on 5 of 5 maps |
| Capture trap (強化捕捉陷阱) | place on open ground in the new strip | placed on 5 of 5 maps |
| Wire (電擊鋼索) | pull a line on open ground | placed in the original area on 5 of 5 maps and in the new strips on 5 of 5 |

Notes:
- The game allows one lure lamp and one capture trap at a time, and a wire must be longer than about 50 screen px and is cut by walls. My first test runs broke these rules, which looked like failures until the test was corrected.
- Each tools run ended with a rope capture: 11 of 13 caught. The two that did not (one timeout, one miss) started with only seconds left of the 60 s hunt.
- Not exercised: meat, decoy, bomb and mine items, and the tools' effect over time (a partner walking into a trap or wire).

## 5. Left for the Owner

1. **Phone landscape layout.** The side panel takes 30% of the width and is mostly empty. The desktop already uses the bottom dock over a full-width map (Owner 2026-11-25). Using the same on phone landscape would show about 44% more map. It touches three browser tests and several style sheets, so it needs its own change and browser pass.
2. **Real-phone check of hm08 at 2880.** Memory is estimated, not measured on a device.

## Limits of this audit

- Phone layouts were emulated in desktop Chromium. No real iPhone or Android device and no local WebKit run; the PR's CI runs the WebKit mobile tests.
- The simulation drives the game logic without rendering; the browser check renders but samples one visit per case.
