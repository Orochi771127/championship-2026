# Continue existing Higgsfield batch; do not regenerate completed jobs

> Completed continuation: the four repair sheets were imported into current r03 candidate banks and validated. Use `BATCH_STATUS_20260920.md` and each entity's `higgsfield-r03` reports for current state; the steps below remain historical handoff context.

Owner requests switching the conversation to GPT-5.6-Sol with high reasoning to conserve usage. Image provider remains Higgsfield, model `gpt_image_2_5`. Owner authorizes paid automatic candidate generation; this batch's self-imposed cap is 30 credits. Current six jobs were estimated at 18 credits total, not proven settled charges. No jobs are running. Do not imply work continues in the background.

## Current evidence and boundaries

- Product root: `R:/Projects/Championship2026/championship-2026`; read its AGENTS.md. Preserve unrelated dirty files, especially cage work and scripts/serve.mjs. No commit/push/deploy or runtime architecture changes.
- Reuse `scripts/character-batch-job.py`, `character-sheet-job.py`, `m001-full-sheet.py`; these use the existing donor review, decoder, mapping and assembler. No new dependencies.
- m001 existing `docs/art/production/original-character-cage-r1/m001-pipeline-v1/full-sheet-r05/acceptance.json` records PASS_M001_LOCAL_VERTICAL_SLICE. Batch loader checks its bank hash. Do not redo this slice.
- m002 `m002_choromon/candidate-r03-higgsfield-final` retains completed earlier repairs. `m002_choromon/higgsfield-r01/browser-validation.json` verifies 83 cells, 53 sequences, 1969 ticks, scales 1/4/8 and origin [24,38]. Full art acceptance is false; normal game QA NOT_RUN.
- m003/m004 whole sheets AND targeted repair sheets have already been generated and downloaded. Their first candidate banks are structurally assembled, not visually accepted. Four repair sheets still need normalization/import/QA.
- Native source origin, timing, sequence and cell mapping remain authority. Do not bbox-center or independently scale frames. Preserve native body size in 64x64 transparent containers. Main/Sub reuse follows canonical aliases and translations. Keep expression/limb/restraint semantics; never invent feet or actions.
- Source research images remain outside the product under `../_archive/character-sheet-jobs-v1` and private art archive. Never package raw donor references.

## Completed paid calls (do not resubmit)

Initial jobs: `batch-20260920-01-submission.json` and `batch-20260920-01-completed.json`.

| Character | Whole-sheet job | Generated masters | Origin | Counts |
|---|---|---|---|---|
| m003_nyokimon | f6718827-3d0e-4d71-bef2-fe5c70804760 | 43 | [23,37] | 64 Main + 18 Sub, 53 sequences |
| m004_bubbmon | 4f4caf03-5c2b-415a-a5bf-70ff530902e3 | 45 | [24,37] | 65 Main + 18 Sub, 53 sequences |

Each entity has `batch-r02/job.json`, `original-identity.png`, `prompt.txt`, `raw-sheet.png`; imported bank at `candidate-hf-batch-r01`. Whole-sheet shared normalization: m003 sample size 40 offset [5,5]; m004 sample size 48 offset [3,4]. All origins are donor coordinate origins, not bbox centers.

Repair calls: `batch-20260920-01-repair-request.json`, `-repair-submission.json`, `-repair-completed.json`. All four are terminal/completed and the generation gallery has already been displayed. Each character has `repair-batch-r01/{bound,normal}-job.json`, `-prompt.txt`, `-raw.png`.

| Character/group | Job | Grid | Main cells, row-major |
|---|---|---|---|
| m003 bound | 3a7dec02-189a-4706-ae2f-89bc978f9559 | 4x3 | 26,27,28,29,30,31,34,35; last 4 blank |
| m003 normal | 5bf3dccf-1c9e-4611-a079-a5fe696c6eba | 4x4 | 13,14,22,48,49,50,51,52,53,54,55,56,57,58,59; last blank |
| m004 bound | ff437558-7762-4aee-95a5-3be9a5f9dcc7 | 3x2 | 27,28,29,30,32,35 |
| m004 normal | 98e9e62f-71dd-4609-b9d2-8a86b70d834f | 5x4 | 9,10,13,14,23,25,49,50,51,52,54,55,56,57,58,59,60,62,63; last blank |

## Next actions, in order

1. Inspect repair alpha and native-size preview. Alpha threshold 128 (not 254); raw body alpha may be 253. Clear RGB where transparent. Choose one documented shared scale and offset per sheet; do not auto-fit each frame. Inspect m003 bound extra gold at leaf roots; binding should express donor body restraint, not invent restraint of free leaves. Unbound repairs now remove the first sheet's unwanted gold wrapping.
2. Extend the existing batch importer to replace only listed NG canonical masters into NEW `candidate-hf-batch-r02`; preserve r01. Reassemble all aliases with existing assembler. Reapply deterministic special states after repairs: especially m004 stone61 depends on repaired10. m003 white63 has a distinct source contour and must not simply reuse alpha000. Keep original palette/appearance, never donor RGB.
3. Verify 82/83 cells, 64x64 binary alpha, canonical translations, no clipping, exact 53 source sequences/timing, and provenance hashes. Record visual NGs separately from structural PASS. Seeds came from STANDARD_POSE_REVIEWED_NOT_SETTING_PASS; whole-character identity acceptance remains pending.
4. Reuse `m002_choromon/review.html` for m003/m004, adjusting entity, bank folder and BOTH origin coordinates. Existing native timeline is `/src/championship/presentation/characterAnimationTimeline.js`. Browser preview clock is not a claim about donor Hz.
5. `tests/character-sheet-review-browser.mjs` was generalized this turn to accept base URL, bank folder, report folder and dynamic donor counts; it still needs execution for m003/m004 and one m002 regression. Local server was running at http://127.0.0.1:8732; verify before reuse. Do not start a second server unnecessarily.
6. Persist final budget/job ledger and a small candidate dashboard/NG queue. Package only original candidate assets and reports. Do not call all characters game-ready until visual and normal-game checks actually pass. No next batch solely because generation finished.

## Efficiency policy

- Do not re-research tools, reread all past dialogue, or generate concept posters. Use the saved donor inventories/reviews and current job manifests.
- Let Higgsfield do image generation; let existing scripts do slicing, state derivation, aliases, packing and tests. Do not add Blender or ComfyUI unless a specific remaining failure needs them.
- Reuse completed outputs, repair only NG cells, cache prompts/job IDs/hashes. A known job ID is polled/downloaded, never resubmitted on ambiguous timeout.
- No extra paid calls until these four repair sheets have been evaluated. Current estimated spend is 18 of the 30-credit batch cap; actual billing is unconfirmed.
- Short progress updates; report concrete files and checks. Do not equate API success, contract PASS, visual acceptance and normal-game acceptance.
