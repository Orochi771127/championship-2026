# UI skin review and repairs — 2026-09-12

Reviewed checkout: `R:/Projects/Championship2026/championship-2026`, `main`,
base HEAD `96424e3073794d8609b3723d023c073fc170e9eb`. Initially clean.
Review request: `CLAUDE_NOTE_2026-09-12_UI_SKIN_REVIEW_REQUEST.md`.
No commit, push or deployment performed by this review.

## Owner clarifications during this review

- Automatic portrait/landscape was explicitly requested from Claude. Preserve it.
- QA should grant maximum money, rank and badges, to inspect all items, fields
  and cages. It is an approved QA adaptation, not an original-game defect.
- How to restore ordinary progression is deferred until after QA. Do not
  automatically roll back, create another save key or erase existing progress.
- Ask before changing a presentation/gameplay difference that may be intentional.

## Confirmed issues repaired

1. **P1 — Normal owned-party battle entered a blank screen.** Reproduced through
   Login → Continue → System → Battle → match 0 → owned fighter → Confirm.
   `app.enterMatch()` publishes BATTLE_FIELD before its promise resolves;
   `main.js` previously handed over the prepared runtime afterwards. The screen
   therefore called `startMatch()` on the old unchosen runtime and threw
   `BATTLE_RUNTIME_NO_MATCH_CHOSEN`. `enterPreparedBattle()` now publishes the
   prepared runtime/attempt binding before entry, retains the previous runtime
   until acceptance, and restores it on refusal, duplicate or exception. Both
   ordinary and tournament entry call the same bounded helper; no new authority.
2. **P1 — QA Continue replaced earned titles and could downgrade rank.** The old
   grant assigned rank 8 and badges [7,45,46], only the gate minimum. It now grants
   native rank 9 and all 61 ordinary title indices 0..60, unions existing flags,
   and never lowers an existing rank. Tutorial 61 is preserved if already present,
   not invented by the grant. Money remains capped at 9,999,999. All 118 shop rows
   and all 16 gates are available through existing admission rules.
3. **P2 — Badge setter accepted data the save rejects.** `setBattleBadges` now
   refuses holes, out-of-range indices and oversized arrays before mutating state.
   `setTamerRank` now also rejects a reentrant write during a battle transaction,
   matching the badge/wallet guard. Grant, settlement, refusal, duplicate handling,
   aggregate battle records and Save/Continue are covered together.
4. **P2 — Cube browser contexts were not explicitly retired.** The existing
   async-mount cleanup was sound, but Three's `dispose()` does not lose its WebGL
   context. The private battle-select canvas now calls `forceContextLoss()` after
   disposing Three resources. Existing synchronous/late-resolution tests remain;
   the browser fixture measured 20 created, 20 released, 0 remaining canvases.
   This conclusion is for the battle-select cube, not a claim about every renderer.
5. **P2 — Short landscape Continue was covered by the save notice.** At 740×360,
   the Continue button was y302.4..360.4 and the higher-z notice was y330.4..345.6;
   its center click was intercepted. Short-screen actions now fit above the
   notice (44px controls), and the informational notice does not consume pointers.
   A real click now reaches Continue and restores the saved game.
6. **P2 — Landscape CSS resurrected a hidden match list.** The new grid selector
   outranked `.cm-vs5-matches[hidden]`, putting the match list and party chooser in
   the same grid cell. `#cm-root [hidden]` now preserves view-owned visibility
   across responsive skins, including other hidden panels.
7. **P2 — Battle skin missed existing light-theme fields.** HP text was
   `rgb(69,107,96)` on dark cards; it now uses the skin's white text. The result
   body/rank and arena letterbox no longer retain the old pale treatment. Arena
   fit, simulation coordinates, camera math, timing and character motion stay
   unchanged. This is presentation repair, not source pixel-parity promotion.
8. **P2 — QA test omitted from CI classification.** The baseline `test:ci` failed
   before executing tests because `championship-qa-unlock-cases.mjs` was not in
   either scope. It and the new entry-handoff regression are classified portable.
9. **Debt mitigation — payload and text consistency.** Long CSS rationale moved
   to `docs/art/production/ui/NATIVE_UI_SKIN_IMPLEMENTATION_NOTES.md`, with the
   non-comment rules compared unchanged during extraction. Final skin gzip is
   16,176 bytes (baseline 19,335); all ten stylesheets total 53,077 bytes gzip,
   with 36,901 bytes in the other nine. The skin adds about 44%, not a doubling of
   the complete stylesheet set. Database's unchanged visible “返回牧場” now goes
   through `uiText`. The stale startup modulepreload list is regenerated.

## Validation and evidence boundaries

- Skills used: engineering code-review, frontend-testing-debugging, Browser.
  Original-evidence MCP queried; local runtime/research contracts read before fixes.
- Full local suite: **1,476/1,476 PASS**. Portable CI: **1,259/1,259 PASS**.
  These are engineering tests, not physical-phone or full-original acceptance.
- New binding tests execute the actual `main.js` handoff helper under synchronous
  screen publication plus accepted/refused/duplicate/thrown entry conditions.
- Real browser: Codex in-app Browser, isolated origin `http://127.0.0.1:8777`.
  Existing `tests/fixtures/championship-owned-party.html` supplied an explicit adult
  and date; all subsequent actions used `championship.html?qa=unlock` and real UI.
  This is controlled save preparation with normal application entry, not natural
  growth into an eligible fighter. The user's other browser origins were untouched.
- Normal flow exercised: actual automatic match → defeat → prize 0 → wallet
  9,999,849 after the 150 fee → record 1, win rate 0%, title count 61 → Home → Save
  → reload → Login → Continue. A second match verified the repaired white HP text
  and dark letterbox while actual HP changed. No new app error after the repaired
  entry; the log retains the original pre-fix exception as reproduction evidence.
- Additional responsive samples: 320×568, 390×680, 390×844, 740×360, 932×430,
  1024×768. Ranch frame did not collapse or create document horizontal overflow.
  Resize measurements must be taken after the ResizeObserver settles; immediate
  same-task reads still show the previous canvas size. At settled 932×430 both
  ranch host and canvas were 530×318. Short battle/result screens scroll vertically.
- Browser release fixture: `tests/fixtures/battle-cube.html`, button
  “檢查 20 次立方體建立與釋放”. It retains actual WebGL contexts until after disposal
  and checks `isContextLost()`, so detached canvas counts alone cannot pass it.
- Build verification is local only; final result is recorded below after the
  completed build/validation pair. Earlier validation deliberately rejected source
  bytes changed while browser fixes were still in progress; final build is rebuilt
  after source freeze, without bypassing the approved file/hash check.

## Original-fidelity questions from Claude

- **4:3 ranch frame:** DS screen proportions do not prove the whole ranch should
  fill a 4:3 window. Existing `raisingFieldViewport` uses a 256-native-pixel camera
  window and shared art/input transforms. Keep the present frame as a presentation
  adaptation; no original camera/world/drag change is justified by this review.
- **Six authored icons:** retain their existing semantic IDs and palette states.
  Recognizability requires Owner visual QA; they are authored presentation, not
  recovered original pixels. No speculative replacement was made.
- **Shop care icons:** existing four shop IDs still resolve to the matching
  toolbar care IDs. Shop-art regression passes. Keep the recorded single-icon
  language direction; no price, inventory or effect change.
- **Database exit copy:** now uses the shared text adapter; visible wording and
  return destination preserved.
- **Battle evidence:** `battle-field-presentation.v1.json` and
  `CHAMPIONSHIP_FACILITY_BATTLE_MOBILE_UI.v1.json` explicitly distinguish authored
  band layout from traced values. `nativeTitleProgression.js`,
  `titleEventSchedule.js` and existing CPU-vector tests govern result values.
  MCP source `R:/NEXUS LINK/原作/BATTLE_REVERSE_SPEC_v1.md:852-854` confirms result
  scene names only; it does not establish this skin's color/spacing parity.

## Remaining and ownership

The general equal-specificity/load-order skin stack is still architectural debt.
The concrete visibility, contrast and result leaks found here are repaired; this
review does not claim every future color override will be caught automatically.
Unifying the old theme layers should be a bounded change with all screen/state
comparisons, preserving the Owner's chosen skin and automatic orientation.

Full character/move visual parity, original tutorial triggers, complete tournament
presentation, icon human approval and physical-device acceptance remain their
existing open stages. This review does not certify the whole original game or
commercial/public release. Claude's owned status files are not overwritten.

Next safe step: Owner QA on a build containing these repairs, keeping `qa=unlock`;
report the screen, action and expected feedback. Defer progression restoration
until the Owner selects the post-QA workflow.

## Final source-freeze receipt

- Final full local run: **1,476 passed, 0 failed**, 61.974 seconds.
- Portable CI: **1,259 passed, 0 failed**; the final subsequent source edit was
  the CSS hidden-state rule, also covered by the final local suite and browser.
- `build:playtest` and `validate:playtest`: **PASS**, 6,279 files, identical build ID
  `94b9359db7967246806db81520fe83faec1a912fe0e42190959292c98d219daa`.
- `build-module-preload.mjs --check`: **PASS**, 177 startup modules.
- `git diff --check`: **PASS**. Base HEAD unchanged; changes remain local.
- Final 740×360 browser check: match list invisible while selecting a fighter;
  Back makes it visible again; reselect and Confirm enter the actual battle.
- `tests/fixtures/championship-ui-result-review.html` adds a repeatable isolated
  presentation check with the complete stylesheet order. Its supplied victory/
  loss/receipt data is explicitly a fixture, not another gameplay producer. Final
  result body measured white text on the dark green gradient; capped victory
  correctly displays 150 credited against 7,000 nominal and 9,999,999 held, then
  advances to statistics and Home. This complements the real defeat flow above.
- Logs and screenshots are outside the repository at
  `C:/Users/USER/.codex/visualizations/2026/09/12/01a0952d-67da-7980-9cf0-fb088aff9e12/`:
  `ui-review-full-tests.log`, `ui-review-ci.log`, `ui-review-build.log`,
  `ui-review-validate.log`, `battle-hud-after.jpg`, `landscape-party-after.jpg`,
  `result-prize-after.jpg`.
