# Championship 2026 original-character art pipeline handoff

This handoff is for Claude Code continuing the original-character animation
production lane. The product repository and all production outputs are on:

`R:\Projects\Championship2026\championship-2026`

Do not assume the current shell directory is the repository. Start with:

```powershell
$repo = 'R:\Projects\Championship2026\championship-2026'
git -c safe.directory=$repo -C $repo status --short
git -c safe.directory=$repo -C $repo rev-parse --show-toplevel
git -c safe.directory=$repo -C $repo branch --show-current
git -c safe.directory=$repo -C $repo rev-parse HEAD
```

The current baseline at handoff is branch `main`, HEAD
`2d11821ff159dc6ca40e182be281c61968c17219`. The worktree is intentionally
dirty with art-pipeline and unrelated project changes. Preserve every existing
change. Do not reset, clean, delete, force-push, or overwrite existing work.

## Storage authority

Production and review data is under the R drive repository:

- donor review and motion contracts: `docs/art/production/characters/appearance-refresh-v1/donor-review-v1/`
- original character settings: `docs/art/production/characters/appearance-refresh-v1/pixel-v2/settings/`
- Higgsfield job receipts, raw sheets and candidate banks:
  `docs/art/production/characters/appearance-refresh-v1/sheet-jobs-v1/`
- loopback review bundles:
  `assets/production/internal-character-review/`
- deterministic and validation scripts: `scripts/`
- browser QA captures and temporary evidence: `.tmp/browser-qa/`

The C drive may contain user-supplied attachment cache or unrelated preview
visualizations. Those are not production outputs. Do not copy donor pixels or
reference-ROM art into the product repo.

## Source-of-truth rules

The donor motion contract is authoritative for cell occupancy, Main/Sub
mapping, aliases, timing, native origin, pose semantics, facial expression
changes, restrained states and special states. The original character changes
appearance only. Do not invent a new action, add a limb/appendage, recenter a
cell, independently resize a cell, or alter a sequence to make a generated
pose look nicer.

Higgsfield with GPT Image 2.5 is used only for one complete original-character
sheet. Use local deterministic operations for aliases, black silhouette,
stone-gray, white silhouette, palette/special-state transforms and restrained
binding overlays whenever the contract permits. Do not submit a new paid job
just to fix a single cell. Reuse the existing raw sheet and repair/import plan
first. Do not change CUDA, Python or runtime architecture.

Every candidate remains review-only until all structural, visual and normal-game
checks pass. Do not set `humanApproved`, `runtimeEligible`, `shippingReady` or
`publicReleasePermitted` to true, and do not change the default runtime bundle.

## Completed checkpoint: m103

`m103_tanemon` is complete as a review-only candidate:

- review bundle: `assets/production/internal-character-review/m103_tanemon-hf-r03/`
- 62 Main + 18 Sub slots, 50 masters, 53 sequences, 1863 browser ticks
- native origin `[22, 38]`, 64x64 binary-alpha cells
- normal game route passed through Damp, including bound/tethered wild result,
  hunt result portrait, Raising Home animation samples and 1x/4x/8x renderer
- default runtime was not changed

Evidence is in the m103 `higgsfield-r03` directory, especially
`structural-validation.json`, `runtime-renderer-validation.json`,
`normal-game-route-audit.json`, `normal-game-browser-validation.json`,
`visual-validation.json` and the review bundle `manifest.json`.

## Completed checkpoint: m104

`m104_tunomon` is the next candidate, original identity **Tidal Compass Bead /
潮汐羅盤珠**, donor review `m104_tunomon`.

Source and design:

- donor review: `docs/art/production/characters/appearance-refresh-v1/donor-review-v1/m104_tunomon/review.json`
- setting: `docs/art/production/characters/appearance-refresh-v1/pixel-v2/settings/m104_tunomon/setting.json`
- identity seed and raw sheet:
  `docs/art/production/characters/appearance-refresh-v1/sheet-jobs-v1/m104_tunomon/batch-r02/`
- accepted candidate: `candidate-hf-batch-r02/`
- visual review sheets: `higgsfield-r02/normal-visual-review-8x.png`,
  `bound-visual-review-8x.png`, `special-visual-review-8x.png`

The single paid job submitted was Higgsfield GPT Image 2.5 job
`e0bc0a48-953e-4ba5-9982-5dfed0abaaa0`, estimated at 3 credits. Do not submit
another paid generation for m104. The raw result is already local at
`batch-r02/raw-sheet.png`. The deterministic refinement is recorded in
`candidate-hf-batch-r02/repair-import-plan.json`.

m104 structural validation and normal-game review now pass:

- 65 Main + 18 Sub slots, 48 canonical masters, 53 sequences, 1863 ticks
- native origin `[22, 34]`
- exact alias and timing mapping to the donor contract
- binary alpha, no per-cell resize/recenter
- deterministic displaced defeat correction for `main/cell_062` is `[14, 7]`
- binding is deterministic and limited to donor `main/cell_027` through
  `main/cell_043` bound states
- black, stone-gray and white specials are deterministic

Normal route evidence is complete. The fresh Desert gate remains locked until
source progression is performed; after two public End Day operations, the
normal saved calendar at 08:00 captured `species-023`, observed `TETHERED`,
loaded the candidate Hunt Result portrait, returned to Raising Home, and
recorded ten advancing native-frame samples. No default runtime, save data or
gameplay architecture was changed.

The provider balance/settlement must be reported truthfully from the provider;
the local ledger records the 3-credit estimate and one paid submission. Do not
claim that a charge settled if the provider does not expose settlement.

## Historical m104 execution steps

m104 is already complete. The numbered m104 actions below are retained as an
audit trail only; do not rerun them, do not submit another m104 job, and do not
re-export its existing review bundle.

1. Add m104 to the existing review-only routing maps, preserving the same
   pattern used by m103:

   - `scripts/export-character-batch-review.py`:
     candidate `candidate-hf-batch-r02`, review `higgsfield-r02`, folder
     `m104_tunomon-hf-r02`, species `species-023`
   - `src/championship/presentation/candidateCharacterArtReview.js`:
     origin `[22,34]`, folder `m104_tunomon-hf-r02`
   - `src/championship/presentation/candidateCharacterHudReview.js`:
     m104/species-023 mapping
   - the existing allow-list in `characterHudArt.js` and `src/championship/app/main.js`
   - `tests/character-batch-runtime-review-browser.mjs` revision mapping
   - `tests/championship-vs3-browser.cjs` review config for species-023

2. Create m104 `higgsfield-r02/visual-validation.json` and
   `generation-ledger.json`. Visual status may be
   `PASS_CANDIDATE_VISUAL_REVIEW`; it must not claim normal-game PASS yet.

3. Run the exporter:

   ```powershell
   Set-Location $repo
   python scripts/export-character-batch-review.py m104_tunomon
   ```

   Expected bundle: `assets/production/internal-character-review/m104_tunomon-hf-r02/`.

4. Run focused validation before any browser capture:

   ```powershell
   node tests/character-batch-runtime-review-browser.mjs m104_tunomon
   python -m unittest tests.test_character_batch_job
   python scripts/validate-character-batch-candidate.py m104_tunomon --candidate candidate-hf-batch-r02
   ```

5. Audit the normal route and then perform the isolated loopback browser QA.
   Use the same normal source progression gate method as m103. The candidate
   URL is:

   `http://127.0.0.1:8732/championship.html?characterArtReview=m104&qa=unlock`

   Keep the default runtime unchanged. Capture species `species-023` through a
   real normal route, verify the donor state/semantics, bound or tethered
   state, hunt result portrait, Raising Home animation frames, and page errors.

6. Only after that capture passes, write m104 `normal-game-browser-validation.json`,
   `normal-game-route-audit.json`, `runtime-renderer-validation.json`, update
   `visual-validation.json` to
   `PASS_CANDIDATE_VISUAL_AND_NORMAL_GAME_REVIEW`, set bundle `normalGameQa`
   to `PASS`, and update the batch status/ledger from 21 to 22 completed jobs.

7. Run the focused test set again and report any failure as a blocker. Do not
   begin a new paid character job until m104 is fully validated. This item is
   complete and is retained only to document the gate that was used.

## Next character handoff

For the next donor, repeat the same donor-review-first process: inspect the
complete Main/Sub motion contract and all-cell/sequence sheets, record species,
body plan, expressions, restraint semantics, special states, native origin and
timing, then author an original setting. Submit at most one complete GPT Image
2.5 sheet, slice it with the existing local scripts, and use deterministic
repairs before considering any paid repair. Add a review-only route mapping,
run structural and renderer checks, then run the real normal progression and
capture path. Only after that candidate passes may the next donor begin.

## Do not do

- Do not use Higgsfield video or motion-control generation for this sprite lane.
- Do not use ComfyUI as a new production dependency merely because it is
  available; the current deterministic Python pipeline is the maintenance and
  rollback authority.
- Do not use donor pixels, donor palette, commercial character appearance or
  ROM-derived art as output.
- Do not modify gameplay/runtime architecture or the default art registry.
- Do not delete older revisions. A revision directory is evidence and rollback
  material.
