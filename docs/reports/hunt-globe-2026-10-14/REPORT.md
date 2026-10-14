# Hunt selector authored geography

Base: `b01ed619375641f5578b2bc65883ebfa32ad8914`. Isolated implementation for serial parent integration; no main push or deployment from this task.

The Owner asks that the drag/tap hint move below the sixteen-region label and that every region agree with its globe terrain. The supplied screenshot shows Savanna / 驅動莽原 selected over ocean. Reference bytes were inspected locally (225,633 bytes, SHA-256 `71406ae0faa29e248c53674680fb1691094844e722c086afbb0f29b3e2e23c3f`). This is `OWNER_APPROVED_ADAPTATION` of the existing presentation, with no claim of recovered ROM geography.

## Change

The prior sine/cosine ocean thresholds and independent Fibonacci markers are replaced by one canonical `biomeId` layout. Joined footprints form four landmasses. The same entries determine surface ownership, local landmarks, and inland marker anchors; array order and `romRecordIndex` do not choose geography. Day and night use identical vertex positions and the same static landmark geometry.

| Ordinal / biome | Surface and landmark |
|---|---|
| 01 Canyon | Terracotta earth, layered mesas |
| 02 Crag | Pale rock, jagged ridges |
| 03 Damp | Moss ground, pools and wetland trees |
| 04 Desert | Sand, dunes |
| 05 Factory | Industrial ground, buildings and chimneys |
| 06 Forest | Green woodland, broad tree crowns |
| 07 Grass | Open green meadow, scattered trees |
| 08 Ice | Pale ice, snowy peaks |
| 09 Jungle | Dark green ground, dense larger crowns |
| 10 Mine | Earth and dark rock, quarry entrance |
| 11 Oasis | Sand, spring and trees |
| 12 Ruins | Moss and stone, broken columns |
| 13 Savanna | Dry grass, flat acacia crowns |
| 14 Seaside | Beach, shallow water and shore trees |
| 15 Sewer | Industrial stone, channels and bridges |
| 16 Volcano | Cooled dark ground, caldera and warm fissures |

The hint now follows the sixteen-region label in normal wrapping flow, preserving its view-mode hiding. The body can scroll while the globe retains its canvas minimum and the footer remains available. Tall hosts fit the complete globe; selected labels stay within the host edges. Canvas cancellation cannot select a gate, and ray hits on hidden backface markers are excluded.

Existing renderer count, quality caps, event-driven drawing, source/intent selection, list fallback, names, IDs, fees, unlock rules, day/night field bindings, gameplay and saves retain their owners. No art bytes are added or changed. The build contract adds one source module and refreshes only this scope's exact code hashes.

## Executed validation

- Focused Gate runtime/admission/presentation/contract checks: **47/47 PASS**.
- Rendered controlled presentation: **16/16** matching previews and front markers after rotation/tilt; tap selection, drag suppression, cancelled-pointer suppression and backface hiding.
- Five locales × six viewports: **30/30 PASS** at 390×844, 320×568, 1280×720, 1024×600, 844×390 and 720×320. Includes current opt-in landscape, wrapping hint, locked preview without confirmation, pinned reachable footer and full-canvas scrolling on short portrait phones.
- Accessibility fallback, simulated WebGL failure and tutorial view: **3/3 PASS**, sixteen list entries and no globe renderer.
- Six mounts followed by disposal: one renderer while mounted, zero afterwards. Saver at DPR 2 caps at 1; high at DPR 3 caps at 3; reduced-motion presentation keeps event-driven drawing.
- All sixteen current accepted day-field previews and actual locally rendered pixels were inspected, including Savanna, short Vietnamese phone and the region overview. Screenshots remain internal local QA artifacts.
- Startup preload check and scoped whitespace check: PASS.
- Desktop layout regression after changing its old fixed-basis assertion to content height: **12/12 PASS** (59 focused checks in total).
- Public playtest build and validator: **PASS**, 9,414 files, build ID `d64181ffc730c25bf38cbf151c994a37c442afe94fe6b2ddecb9a54d3acce052`.
- Normal compiled-artifact UI: **PASS**, New Game/opening → Ranch → Gate → list → locked Savanna preview → free Grass admission → Loadout → Gate remount → Ranch; zero page errors and no retained Gate canvas after returning Home.

Aggregate `test:ci` after all selected build files arrived: **1,886 pass / 22 fail out of 1,908**. One failure was the desktop test's obsolete fixed-basis source assertion; its corrected module subsequently passed 12/12. The other 21 cases require existing source-reference images, CPU receipts, CSVs or non-build HUD images absent from this sparse checkout. No failing case is disabled or reclassified. Full CI remains blocked here and must pass in the parent's complete integration workspace.

The historical VS2-R1 browser gate twice timed out on its initial 30-second `networkidle` navigation before Gate was reached. The scoped normal-path gate waits for document readiness, then reuses the existing opening helper's real LOGIN/film-ended/UI conditions. It passed against the compiled artifact without bypassing onboarding or writing game state. The old gate's timeout is retained as a harness limitation.

Physical iPhone/Safari and commercial clearance are not established by these local Chromium checks. Publication remains coordinated by the parent after concurrent releases are integrated serially.
