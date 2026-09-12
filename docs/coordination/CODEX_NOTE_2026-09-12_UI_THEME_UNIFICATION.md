# UI theme unification — reviewed handoff

Date: 2026-09-12. Branch: `main`.
Clean starting HEAD: `b42ead6f9ab420d548df1f8cd363f2de9b2569f5`.
The earlier Codex repairs are already committed in `f48e7bd`; the concern about
mixing this pass with those uncommitted repairs is superseded by current Git.

## Owner direction and scope

Keep the new style, automatic orientation and QA maximum grant. The Owner
explicitly chose to keep calendar/letter content characteristics while unifying
frames and controls. No gameplay, world coordinates, camera, pointer conversion,
save, unlock or renderer code changed in this pass. The added HTML fixture uses
the real Raising view with controlled presentation inputs and no app/save/renderer.

## Completed

- Removed 280 redundant paint declarations with exact selector/property and
  conditional-context witnesses, plus six empty rules. No whole CSS file removed.
- Removed the old per-screen mode-label backgrounds while preserving layout
  reservation. Appearance is owned by the common skin.
- Shared window/action materials now have named tokens, also used by existing
  windows/actions rather than duplicated gradient strings.
- Calendar grey date material, four seasonal grids, today marker and counts
  remain. Frames now use the common gold/dark treatment.
- Paper mail preserves its paper, ink and ruling; the acknowledgement shares
  the Raising system-button style, including disabled/focus/hover states.
  System mail and the end-day prompt use the shared dark window.
- Schedule registered/won rules live with the skin's base/selected rules. The
  earlier registered inset was visible when unselected; this is consistent
  framing/ownership, **not a claim that registration was previously invisible**.
  Selected appearance retains precedence over registered appearance.
- Gate host background uses the established green/dark material; the globe and
  native scene transform are unchanged.
- Corrected the VS5 comment: two stacked DS screens are 2:3; the current 9:16
  shell is a modern adaptation. The dimensions/evidence guide below separates
  source pixels, reference export scale, CSS viewport and gameplay coordinates.

## Validation

| Check | Result / limit |
|---|---|
| Full regression | `npm test`: 1476/1476; 0 failures |
| Isolated deletion stage | 7 frozen real DOM screens × 4 sizes = 28 comparisons; zero changes to standard computed CSS, rectangles or before/after pseudo styles |
| State matrix after intentional restyling | Real Raising DOM view, 36 cases: four seasons + mail/mail-wait/system-mail/confirm/save-error at 360×640, 390×844, 740×360, 844×390; actual viewport verified; no panel clipping or document overflow |
| Interaction | Real Save/Continue, End Day/Yes/calendar acknowledgement; controlled mail acknowledgement closes the real view's dialog |
| Actual Gate | Current app reaches rotating globe, one canvas, transparent shared mode-label background; no browser errors recorded |
| CSS structure | Parser reports 0 errors; all original media/supports contexts preserved |
| Technical build audit | `technical.ok=true`, `issues=[]` |
| Playtest build / validation | Both 6279 files, build ID `d08eb96385efa5ecab9288b1fbf3b31c30da023970feaca298994d576653f2a6` |
| Diff hygiene | `git diff --check` passes |

The first validator invocation happened before the asynchronous build completed
and read an incomplete output (`BUILD_FILE_LIST_MISMATCH`). After build completion,
the sequential validation passed with the matching ID above. This was review
orchestration, not a product defect or a reason to change the build logic.

All ten linked CSS files together, measured with Node `gzipSync` (same settings):
Git base 238875 raw / 52976 gzip bytes; current 228748 raw / 51346 gzip bytes.
Net reduction: 10127 raw / 1630 gzip bytes. This is not a claim of removing all
legacy CSS, and compression varies slightly with tool/version/line endings.

## References and reusable review surface

- `docs/art/production/ui/UI_STYLE_OWNERSHIP_2026-09-12.md`: source/size table,
  theme ownership, measurement pitfalls and next-component migration rule.
- `docs/art/production/ui/UI_THEME_PRUNE_RECEIPT_2026-09-12.json`: every removal
  with source position and later replacement witness.
- `tests/fixtures/championship-ui-state-review.html`: normal browser fixture;
  `?case=calendar&season=0..3`, `mail`, `system-mail`, `mail-wait`, `confirm`,
  `save-error` (see guide for full query syntax).
- `.tmp/prune-ui-theme.py`, `.tmp/ui-theme-prune-proof.json`,
  `.tmp/build-ui-frozen.mjs`, `.tmp/ui-frozen-states.json`, `.tmp/ui-unification/`:
  local scratch, not production/CI dependencies. The pruning helper requires
  the local review-only `tinycss2` installation; the committed receipt is the
  portable source of what was removed, not an instruction to rerun deletion.
- Screenshots, test/build logs and state/comparison JSON are under
  `C:/Users/USER/.codex/visualizations/2026/09/12/01a0952d-67da-7980-9cf0-fb088aff9e12/`,
  with `unification-` prefixes.

## Still open

Do not use the earlier 1136/219 numbers as declaration deletion truth. The
measurement misses cascade semantics and keys separate occurrences together.
The full legacy/skin stack remains partly layered, including higher-specificity
root/context overrides. Do not drop those selectors or delete structural files.
Further consolidation needs component/state ownership checks, especially dynamic
Hunt/battle states and historical single-stylesheet fixtures. Frozen DOM comparisons
do not test live canvas pixels or all original behavior. Physical phone QA,
full original parity and complete commercial release acceptance remain open.

No commit, push, merge or deployment was performed in this pass. The selected
public-playtest hashes were refreshed for exactly nine changed CSS inputs; the
file allowlist was not widened. No private ROM art was copied into runtime.
Claude-owned status/delta files were left intact.
