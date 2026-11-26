# Batch 2 — lighter coverage masks on the two pre-baked maps (hm01, hm08)

2026-11-26. Second batch of `PLAN.md`.

## What changed

戴納草原 (hm01) and 南橋峽谷 (hm08) are pre-baked: an opaque colour picture per field plus one
coverage mask that says which pixels are scenery in front of the partners. The mask is a grey
picture with one channel of information, but it went to the GPU as RGBA8: 33.2 MB at 2880 x 2880.

It now goes up as **R8** (one channel, 8.3 MB), still at full resolution, so no edge gets coarser.
(The plan said "half resolution"; one channel saves the same memory without touching the picture.)

| In the hunt, GL textures | Before | After |
| --- | --- | --- |
| hm01 戴納草原 (two colour frames + mask) | 103.7 MB | 80.0 MB |
| hm08 南橋峽谷 (one colour frame + mask) | 72.1 MB | 48.4 MB |

Measured in Chromium, phone portrait, DPR 2, with the GL call tracker
(`memory-audit-tools-20261117/tracker.js`); the game's own diagnostics
(`threePilot.externalAssets.gpuTextureBytes`, `maskFormat`) report the same 23.7 MB difference.
The decoded bitmaps are freed after upload as before (PR #241).

## How

`src/championship/presentation/vs2/huntThree/externalMapAssets.mjs`

- The mask texture gets `format = RedFormat`.
- Three's alpha map reads the green channel, which R8 does not have. The foreground material
  reads red instead (`onBeforeCompile` replaces the `alphamap_fragment` include; its own program
  cache key). Red is also right for an RGBA upload of the same grey picture.
- Safety nets:
  - If the Three build does not have the expected shader include, nothing changes (RGBA mask,
    stock alpha map).
  - `createHuntThreeMap.mjs` checks the GL error flag after the upload pass. If the driver refused
    the compact upload, `useRgbaMasks()` gives the masks back to RGBA8 and they are uploaded again,
    before the decoded bitmaps are released.

## Checks

- `tests/championship-hunt-ios-memory-cases.mjs`: mask is R8, colour frames stay RGBA, GPU bytes
  74.6 MB vs 99.5 MB for the hm01 day field, the shader reads red, the RGBA fallback, and the
  unknown-shader path.
- Browser, Chromium, hm01 and hm08, R8 against the old RGBA path (same build, compact path
  switched off): Three active, no GL or page errors, same picture (`batch2-rgba-vs-r8.jpg`:
  RGBA left, R8 right for each map; the 0.3-0.5 % of differing pixels are the moving partners).
- WebKit: Playwright's Windows WebKit cannot load the hunt at all through the test route (also
  on the unchanged RGBA path), so the game could not be compared there. The upload itself was
  probed directly in both engines: an ImageBitmap into `texStorage2D(R8)` +
  `texSubImage2D(RED, UNSIGNED_BYTE)` gives no GL error and reads back 255 / 0 in the red channel.
- Not verified on a real iPhone. The GL-error fallback above is there for that case.
