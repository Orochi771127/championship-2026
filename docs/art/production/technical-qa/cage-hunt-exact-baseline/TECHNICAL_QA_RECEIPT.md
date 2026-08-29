# Cage/Hunt exact-baseline technical QA

Date: 2026-08-29

Status: `REFERENCE TECHNICAL QA PASSED / RUNTIME PROMOTION BLOCKED`

## Result

- Cage: 40/40 fields preserve exact 4× pixel blocks; 40/40 collision, attribute and tilemap grids align to the same 8-pixel native cells.
- One un-tinted CM01–CM40 master contact sheet proves all forty art fields in a single view; four separate pages retain the collision overlays for enlarged review.
- Hunt: 30/30 variants contain no large connected pure-red diagnostic region; 13 animated variants retain 28 source frames.
- Portrait review uses a fixed 390×844 centre crop with no scaling. It is a presentation check, not a runtime camera contract.
- Loading all thirty 2048×2048 RGBA fields at once would consume 480 MiB before texture overhead. The reference packet therefore requires one-field loading or tile streaming; mass preloading is rejected.

## Boundaries

The collision colours are diagnostic overlays only. Raw class numbers are preserved and no passability or gameplay meaning is inferred. CM12 and CM18 remain quarantined object-index conflicts. These outputs remain exact enlarged reference baselines, not genuinely redrawn HD masters, runtime assets, or shipping-ready art.
