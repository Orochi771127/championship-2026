# Higgsfield character-art batch status - 2026-09-20

This is a candidate-production checkpoint, not publication approval.

## Paid generation ledger

- Provider: Higgsfield; image model: GPT Image 2.5, Flare, high, 2K, transparent.
- Completed jobs: 22; failed submissions: 1; duplicated submissions: 0.
- Initial whole sheets: m003 f6718827-3d0e-4d71-bef2-fe5c70804760, m004 4f4caf03-5c2b-415a-a5bf-70ff530902e3.
- Targeted repairs: 3a7dec02-189a-4706-ae2f-89bc978f9559, 5bf3dccf-1c9e-4611-a079-a5fe696c6eba, ff437558-7762-4aee-95a5-3be9a5f9dcc7, 98e9e62f-71dd-4609-b9d2-8a86b70d834f.
- m005 full-sheet attempts: failed 14c0eefe-d7d3-439c-8d47-5f737b0264c1; completed 92ac7eec-fdd2-4a69-8b9a-9586cd575cc3. Targeted m005 repairs: e31cc3f2-6a3f-4ec8-b000-9230e396a512 and 35e1b294-df4e-4da2-ae61-cb04e1efc4a4.
- m006 full sheet: 7f4c24cb-d935-49cc-bdf7-697ed404daf3. Targeted restraint repair: 46303027-8088-4d8f-abf2-0440a8733290.
- m007 full sheet: f6c1a0a5-d95b-41f6-9a78-97aa26735587. Targeted canonical restraint sheet: bdd3f478-1289-4169-82b3-f489c22d38fd.
- m008 full sheet: 58ad583a-e607-4177-bf0d-27c0968eaad7. No paid repair was needed.
- m009 full sheet: d90e9558-96ff-4e5a-b463-3e03f86289e7. No paid repair was needed.
- m010 full sheet: 5e20fd71-662a-4386-bcf6-3fb1e4644678. No paid repair was needed.
- m011 full sheet: a34fbbb9-05f9-422a-82a4-b3e6a3a0efd6. No paid repair was needed.
- m012 full sheet: 3f749ccd-2c6a-4879-a8eb-8a694cb08685. No paid repair was needed.
- m101 full sheet: f7a43ae5-55ed-4ec5-9763-a9a08be58959. No paid repair was needed.
- m102 full sheet: 198e5213-8aa5-468e-b1cf-f1cc7fccf128. No paid repair was needed.
- m103 full sheet: 1a46d0b8-1cfc-4fe3-bea4-b2410a7d06a3. No paid repair was needed.
- m104 full sheet: e0bc0a48-953e-4ba5-9982-5dfed0abaaa0. No paid repair was needed; deterministic restraint and special-state refinement produced r02.
- Submission estimates: 18 credits for m003/m004, 6 credits for m005, 4 credits for m006, 5 credits for m007, and 3 credits each for m008, m009, m010, m011, m012, m101, m102, m103 and m104. This is not proof of settled billing.
- Balance snapshot after m104 completion: 3010 credits, Ultra plan. The provider did not expose a per-job settled-charge ledger in this workflow.
- Additional paid repair generation after the m007 restraint repair: 0. Current m104 r02 visual review found no cell requiring another generation.

## Delivered candidate banks

| Entity | Candidate | Main + Sub | Canonical masters | Sequences | Browser ticks | Origin |
|---|---|---:|---:|---:|---:|---:|
| m003_nyokimon | candidate-hf-batch-r03 | 64 + 18 | 48 | 53 | 1980 | [23,37] |
| m004_bubbmon | candidate-hf-batch-r03 | 65 + 18 | 51 | 53 | 1969 | [24,37] |
| m005_pitchmon | candidate-hf-batch-r06 | 65 + 18 | 45 | 53 | 1863 | [31,38] |
| m006_punimon | candidate-hf-batch-r06 | 65 + 18 | 47 | 53 | 1863 | [24,38] |
| m007_botamon | candidate-hf-batch-r06 | 65 + 18 | 39 | 53 | 1863 | [24,42] |
| m008_poyomon | candidate-hf-batch-r03 | 65 + 18 | 31 | 53 | 1863 | [31,38] |
| m009_mokumon | candidate-hf-batch-r06 | 62 + 18 | 47 | 53 | 1863 | [28,38] |
| m010_yukimibotamon | candidate-hf-batch-r02 | 65 + 18 | 39 | 53 | 1863 | [24,42] |
| m011_yuramon | candidate-hf-batch-r02 | 64 + 18 | 43 | 53 | 1863 | [23,42] |
| m012_petimon | candidate-hf-batch-r03 | 64 + 18 | 38 | 53 | 1863 | [32,45] |
| m101_caprimon | candidate-hf-batch-r06 | 65 + 18 | 55 | 53 | 1863 | [24,44] |
| m102_koromon | candidate-hf-batch-r03 | 64 + 18 | 47 | 53 | 1788 | [23,38] |
| m103_tanemon | candidate-hf-batch-r03 | 62 + 18 | 50 | 53 | 1863 | [22,38] |
| m104_tunomon | candidate-hf-batch-r02 | 65 + 18 | 48 | 53 | 1863 | [22,34] |

All fourteen banks use 64x64 RGBA cells with binary transparency. Every alias is rebuilt from its canonical master plus the recorded donor translation. Timing, loop/stop behavior and Main/Sub sequence records are byte-equivalent JSON structures from each current motion contract. Browser previews use nearest-neighbor rendering at 1x, 4x and 8x.

Loopback PixiJS review bundles are exported under assets/production/internal-character-review. All fourteen loaded all Main/Sub textures and passed 53-sequence native-hunt and battle projections, fixed-origin mirroring, and 1x/4x/8x renderer checks. These bundles are review-only and do not replace default production assets.

## Efficiency decisions

- One whole sheet per character established most poses.
- Bound and unbound NG cells were repaired as four grouped sheets rather than individual calls.
- Glow removal, native scaling, common-origin placement, aliases, atlases, grayscale stone and other proven deterministic states were processed locally.
- A local test caught restraint gold leaking into an unbound palette. The fix restricted restraint colors to bound groups and rebuilt r03 without another provider call.
- r01/r02 are retained as provenance. r03 is the current candidate.
- m005 used one shared full-sheet scale/offset, then two grouped repair sheets. A local test caught restraint-only colors entering unbound cells; panel-class quantization rebuilt the current r06 without another provider call. Earlier candidates remain as provenance.
- m006 used one full sheet plus one cell_030 restraint repair. Low-alpha generator backdrop was removed by deterministic alpha thresholding. A single 15px/4px cell_062 translation, recorded against donor visible bounds, restored the defeated pose's source origin without redrawing it.
- m007 used one full sheet plus one 4x3 restraint repair sheet covering 11 canonical bound masters. Eight model-invented cells in slots explicitly reserved as blank were removed locally before slicing. Black facial silhouette, stone gray and white evolution states were rebuilt deterministically from accepted original poses, and cell_062 received a recorded 17px horizontal donor-bounds correction.
- m008 used one full sheet and no paid repair. The black facial state was derived from the accepted low pose with donor-proven identical alpha, aliases were rebuilt from canonical mappings, and main cell_009 received a recorded [5,2] donor-bounds correction that also propagates to main cell_062.
- m009 used one full sheet and no paid repair. Orange-red, black, stone-gray and white states were rebuilt deterministically from accepted original poses. One omitted restraint on main cell_031 was added from its own body bounds as a one-pixel wrapped band and propagated to alias cell_033. `find-character-review-clock.mjs` now searches the 141 distinct production RNG clock seeds locally before opening a browser, avoiding repeated full browser attempts and leaving spawn authority unchanged.
- m010 used one full sheet and no paid repair. The fixed alpha threshold removed the provider's low-alpha backdrop before slicing. Orange-red and tall black states reuse donor-proven alpha relations; the compact black, stone-gray and white states retain their distinct generated original contours while their state colors are assigned deterministically. The same shared 43px scale and [4,7] offset is used for all 36 generated masters.
- m011 used one full sheet and no paid repair. The fixed alpha threshold removed the provider's low-alpha backdrop before slicing. One shared 53px scale and [2,-1] offset covers all 39 generated masters. Twelve canonical restrained masters received a deterministic one-pixel bent two-tone band from their own accepted body bounds, making every main cell 026-042 visibly restrained at native size without donor pixels or another provider call. Black, stone-gray and white special-state colors are deterministic.
- m012 used one full sheet and no paid repair. One shared 51px scale and [6,7] offset covers all 33 generated panels; four provider-invented sprites in unused panels were cleared locally. Ten canonical bound masters received deterministic bent vertical gold bands from their accepted body bounds, and aliases rebuilt the complete main026-042 restraint block. Special-state colors were assigned deterministically. The source-aware clock search found the season-2 Ruins 08:00 route before browser QA, avoiding paid or browser retries.
- m101 used one full sheet and no paid repair. One shared 55px scale and [1,4] offset covers all 48 generated panels. Five source-proven special states were rebuilt deterministically from accepted original poses, while fifteen canonical bound masters received body-mask-clipped two-tone gold restraint sashes and aliases rebuilt the complete main027-043 bound block. The source audit selected the season-0 Sewer 08:00 route and RNG clock seed before browser QA, avoiding paid or browser retries.
- m102 used one full sheet and no paid repair. One shared 48px scale and [2,9] offset covers all 40 manifest panels. Eight provider-populated cells in manifest-reserved blank panels were recorded as source evidence and ignored at the import boundary. Five source-proven special states were rebuilt deterministically from accepted original poses, while fourteen canonical bound masters received body-mask-clipped two-tone gold restraint bands and aliases rebuilt the complete main026-042 bound block. The source audit selected the season-0 Savanna 08:00 route and RNG clock seed before browser QA.
- m103 used one full sheet and no paid repair. One shared 58px scale and [-2,0] offset covers all 45 generated masters. Five source-proven special states were assigned deterministically where their distinct contours permit, while thirteen canonical bound masters received body-mask-clipped two-tone gold restraint bands and aliases rebuilt the complete main026-042 bound block. A local RNG scan selected the lowest-HP legal season-0 Damp 08:00 source encounter before browser QA; the captured candidate then passed TETHERED, Hunt Result and ten-sample Raising Home animation checks without changing runtime or spawn data.
- m104 used one full sheet and no paid repair. One shared 46px scale and [2,5] offset covers all 48 generated masters. Fourteen canonical bound masters received body-mask-clipped two-tone gold restraint bands and aliases rebuilt the complete main027-043 bound block. Black, stone-gray and white states were assigned deterministically; main cell 062 received a recorded [14,7] displacement correction without resizing or recentering. The source audit selected the season-0 Desert 08:00 route after the two-day gate progression; the captured candidate then passed TETHERED, Hunt Result and ten-sample Raising Home animation checks without changing runtime or spawn data.
- `validate-character-batch-candidate.py` now produces repeatable structural reports and 8x normal/bound/special review sheets. `audit-character-normal-route.mjs` searches all 1,408 gate/season/hour source combinations before browser QA.

## Remaining gates

- Full-character art acceptance remains false because the saved design setting records standard-pose review rather than a final whole-character sign-off.
- Loopback runtime renderer and native-hunt/battle projection QA pass for m003-m012 and m101-m103. m004 and m006 passed ordinary Hunt, bound-state capture, Hunt Result and Raising Home navigation. m006 used the normal new-game/loadout flow at Grass Gate and captured species-013 without state injection. m008 passed native spawn, pointer binding, capture, Hunt Result and Raising Home animation at Damp Gate through the existing isolated `qa=unlock` review path; the source audit separately proves its fee-free Grass Gate route is available in autumn and winter, so no runtime or spawn-table change was made. Current source data places m005 species-012 behind the existing Damp/Seaside gate progression, m007 species-014 behind Savanna/Volcano progression, m009 species-016 behind Canyon/Desert/Mine/Volcano progression, m010 species-017 behind Ice/Ruins progression, m011 species-018 behind existing gate or season progression, m012 species-019 behind Ruins rank/fee plus season-2 progression, m101 species-020 behind the existing Sewer rank and fee rules, and m102 species-021 behind Savanna/Volcano progression. Fresh-game browser runs confirmed the requested locked-gate actions remain disabled and no progression bypass was introduced. The isolated review route captured species-016 from Canyon at 08:00:00, species-018 from Ice at 01:00:00, species-020 from Sewer at 08:00:00, and species-021 from Savanna at 08:00:00, proving moving actors, tethered states, result portraits and Raising Home native animation. m010's full 83-frame loopback renderer, Main/Sub mapping and 1x/4x/8x native-origin playback pass; its source capture route is correctly unavailable to a fresh season-zero tamer. m012 passed fresh-game Ruins gate-lock QA, then an isolated QA grant and a normal season-2 save captured species-019 at 08:00, including TETHERED, Hunt Result portrait and ten advancing Raising Home samples. m101 passed fresh-game Sewer gate-lock QA, then an isolated QA grant and a normal saved season-0 calendar captured species-020 at 08:00, including TETHERED, Hunt Result portrait and ten advancing Raising Home samples. m102 passed fresh-game Savanna gate-lock QA, then an isolated QA grant and a normal saved season-0 calendar captured species-021 at 08:00, including TETHERED, the candidate Hunt Result portrait and ten advancing Raising Home samples. m103 passed fresh-game Damp gate-lock QA, then an isolated QA grant and a normal saved season-0 calendar captured species-022 at 08:00, including TETHERED, the candidate Hunt Result portrait and ten advancing Raising Home samples. Source battle admission for m005-m012 returns `TOO_YOUNG`; m101, m102 and m103 source battle admission is available and both battle projections passed the loopback renderer review.
- m104 additionally passed fresh-game Desert gate-lock review and a normal two-day saved calendar capture at 08:00, including TETHERED, the candidate Hunt Result portrait and ten advancing Raising Home samples. Its source battle admission is available and both native-hunt and battle projections passed the loopback renderer review.
- Default runtime, save data and gameplay architecture were not changed.
