# Original video observations: capture VFX, infirmary VFX, and Shop

Date: 2026-09-12  
Evidence class: `OWNER_SUPPLIED_VIDEO_OBSERVED`  
Scope: presentation evidence only; gameplay values remain under existing ROM/CPU-derived runtime contracts.

## Inputs

| input | decoded display | duration | observed subject |
|---|---:|---:|---|
| `C:\Users\USER\Downloads\video3.MOV` | 360 x 480 portrait | 7.38 s | successful Hunt capture and storage feedback |
| `C:\Users\USER\Downloads\video2.MOV` | 360 x 480 portrait | 22.38 s | resident recovering in the mini infirmary |
| `C:\Users\USER\Downloads\video.MOV` | 360 x 480 portrait | 39.55 s | original Shop browsing and purchase layout |

These files are local evidence inputs. They are not copied into the product or build output.

## Capture into memory card

Observed in `video3.MOV`, principally 4.0-6.5 s:

1. The captured target stops being drawn.
2. A compact cyan-white light condenses at the target's last position.
3. The light lifts, then travels on a curved path toward the lower tool/card rail.
4. It finishes near the right side of that rail with a short arrival flash/card bracket.

The existing native hand controller already supplies the authoritative 94-frame sequence and event boundaries:

| native event | frame |
|---|---:|
| `HIDE_WILD` | 396 |
| `HAND_LIFT` | 427 |
| `CARD_FLIGHT` | 438 |
| `CARD_ARRIVAL` | 469 |
| `INSERT_CARD` | 480 |

`common/e002_hunt_digicach` is a strong visual/identity match for this family. The decoded research cells show the cyan light and card-like bracket, but the runtime implementation does not load those cells. Timing continues to come from the traced hand controller, not from an inferred animation duration.

## Mini-infirmary recovery

Observed in `video2.MOV`:

- Recovery is passive while the resident remains in the mini infirmary.
- When recovery applies, a small cyan/green starburst appears around the resident for roughly 0.4 seconds.
- This is distinct from the active wound/illness medicine-treatment presentation.

The existing Raising growth writer already owns the numeric HP change. The video establishes feedback, not a new healing amount or schedule. Therefore the presentation may start only after the canonical profile reports `currentHp` increasing while the resident is assigned to a verified `RECOVER_HP_STRESS` cage.

`common/e001_ikusei` contains a cyan star sequence that visually matches the observed pulse, but that family also contains unrelated Raising/evolution effects. This is a bounded visual match to a sub-sequence, not evidence that the whole family means "heal" and not a new gameplay trigger trace.

## Shop

Observed throughout `video.MOV`:

- Blue patterned screen background.
- One large selected-item detail panel at the top: large art, item name, explanatory text, price, and owned quantity.
- A lower horizontal shelf showing about two large product cards at portrait width.
- Category controls and left/right navigation are separate from the product cards.
- Purchase and Back are separate actions for the currently selected product; the screen is not a long vertical list with one Buy button per row.

The recording is sufficient to restore this structure and interaction model. It does not by itself recover every original Japanese help string.

Follow-up verification on 2026-09-13 found the handoff catalog at the external research path `R:\NEXUS LINK\原作\YDIJ_RAW_RESEARCH_EVIDENCE\SHOP_REVERSE_CATALOG_118.csv`. Correct CSV parsing yields 118 rows, not 318 physical lines: every row has `name_jp` and `description_jp`, and all 118 identity/price/unlock rows match the product catalog. The runtime now uses independently written Traditional Chinese translations keyed by those verified record indices; it does not import the external file or ship its Japanese text. See [Shop reverse catalog verification](SHOP_REVERSE_CATALOG_VERIFICATION_2026-09-13.md).

Latest Owner direction takes precedence over the recording's apparent filled highlight: the selected card uses a dark fill with a green rim and green label, not a green-filled card.

## Rights boundary

The registry marks both reference families as:

- `shippingStatus: ORIGINAL_REPLACEMENT_REQUIRED`
- `rightsStatus: ROM_COPYRIGHTED_REFERENCE`
- `disposition: REBUILD`

Accordingly, the new effects are original-created PixiJS vector shapes and the Shop correction is original-created DOM/CSS. No ROM image, decoded cell, video frame, or original pixel is included in shipping runtime.

## What this evidence does not prove

- Exact original VFX pixel geometry, palette indices, blend modes, or every frame duration.
- A new recovery amount, recovery cadence, or medicine behavior.
- Official Traditional Chinese Shop wording; the included Traditional Chinese remains product-authored from verified Japanese source text.
- Full original parity, public-release rights, or physical-device acceptance.
