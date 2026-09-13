# Codex handoff — tool installation and original parity audit

Owner asked to install the previously recommended missing tools, then to use them to consolidate original evidence and diagnose divergence, especially blank Hunt, loadout icons/hierarchy, and the missing accept/decline tutorial invitation. Owner offered source locations only if genuinely missing; existing ROM and pack were located without requiring uploads.

Product root: `R:\Projects\Championship2026\championship-2026`. Started at main `0ee41dc83c89d66627da5840ba84193b349062e1`; shared work advanced to `08445ba4629aac5757f31b0c1e68fbf40e7966de` during this read-only product audit. Initial unrelated `tests/fixtures/championship-capture-vfx-review.html` modification was preserved and later disappeared through another actor's work. Do not attribute those changes to this task.

## Ownership

- This task adds only `docs/reports/tooling-parity-audit-2026-09-13/` and this handoff inside the product repository.
- External installation/configuration: `../tools/development-toolkit/`, four added user Codex MCP entries, pyghidra-mcp uv tool, Playwright-managed Chrome for Testing, and one corrected stale canonical-project line in `C:\Users\USER\.agents\skills\championship-art-production\SKILL.md` (backup in tool directory).
- No gameplay, art, save, router, ticker, release hashes, or application runtime dependency changed. No commit/push/merge/deploy.
- Existing configuration preserved semantically. Private config backup stays outside product; do not publish the tool directory or its research/profile/backups.

## Findings and next safe work

Read [原作對照與修復順序](../reports/tooling-parity-audit-2026-09-13/原作對照與修復順序.md).

1. Public Hunt reproduced as blank at ~3 and ~10 seconds, visible by ~30 seconds in one extended fresh-context run. Network requests remained pending; no JS errors or failing HTTP responses. Clock advances while field is not visible. `main.js:mountHuntField` serially awaits character, map and feedback assets before mounting. This is a load-readiness defect; do not replace map art to address it.
2. `beginTutorial()` exists but has no production caller; existing tests explicitly call it. New Game has no accept/decline invitation. Original accepted-path observation is partial; trace decline/writer/return conditions before wiring the complete invitation and interactive progression.
3. Loadout screenshot is text-row based. Original source retains 11 setting scenes; contract still marks some hierarchy/order/release semantics unknown. Build from source scene/cell/timeline and observed navigation, not filenames alone.

Fresh ndspy verification: all 6,419 ROM file hashes and all 96 NXR scene-file hashes agree with the existing catalog. 1,369 indexed nodes. Raw inventory completeness does not close visual/functional parity. Keep the two battle runtime scenes omitted by the old 94-scene summaries in the checklist.

## Validation

- 4 MCPs: initialize/list/call succeeded (Ghidra 20 tools, Serena 24, Playwright 43, PixiJS 13).
- Ghidra 12.0.4 + NTRGhidra 1.5.1 registered; NitroPaint process responsive; apicula read original Gate model; ndspy and py-desmume opened the supplied ROM.
- PixiJS Devtools 3.4.0 enabled in dedicated Chrome for Testing profile. Daily Chrome profile installation is not claimed: desktop capture returned `SetIsBorderRequired ... 0x80004002`. The supplied launcher provides the verified alternative.
- Focused tests: 32/32 pass, tutorial/opening/loadout/migration-firewall.
- Portable CI and final diff check: see final validation follow-up appended below.

The tool browsers use isolated profiles. Captured art screenshots are the currently rendered product; no raw ROM or original decoded pixels were copied into this report or runtime. Tool versions, downloads/hashes and repeatable checks are in `../tools/development-toolkit/README.md`.

## Expanded all-page / item / cage / VFX audit

Owner expanded scope to every functional page, every shop/hunt item, all cage/map effects and capture-storage VFX, and explicitly requested deeper ROM tool use. The completed inventory and bounded verification are in [全功能頁與特效審查](../reports/tooling-parity-audit-2026-09-13/全功能頁與特效審查.md). Its CSVs cover 118 items, 36 functional cage definitions, 26 Nitro VFX systems and all 96 original NXR scenes. This is a coverage ledger, not full parity acceptance.

- Fresh full local suite: **1487/1487 PASS**. Portable CI: **1270/1270 PASS**.
- INT-RH2 browser: **6 viewports PASS**, including save/reload and Pixi fallback. VS3 normal opening/loadout/capture/result/home: **PASS**, frame-synchronized input, no HP/result injection.
- Main menu page walk reached ordinary accessible pages; clicked Help 68 topics and Schedule 61 fixtures. Battle selection/conference return follow-up PASS after correcting harness selector/transition waits. Normal new-game Battle Field and Battle Result were NOT reached. Source review for those screens is separately labeled.
- Shop browser: existing explicit QA grant, isolated context, all **118** rows reviewed; **113 purchases** correct quantity and debit, **5 capped rows** correctly disabled; no page errors. Does not prove natural unlocking, each item's field use or each post-purchase persistence branch.
- Shop art binding: **39 individual images / 79 generic placeholders**. Do not repaint the approved Shop structure to fix this.
- All 36 cage definitions have images, 108 native programs. Fresh ROM/RAM lifecycle catalog equals the current catalog. Old `cageEffects` UNKNOWN metadata and legacy comments are stale relative to native training/layout paths; do not report those features missing from comments alone.
- Fresh original CPU: 4009 Hunt tool probes; capture-to-card/home chain; 672 training vectors / 6 training timelines; 768 growth calls. Lifecycle includes 2736 evolution eligibility cases, 880 sleep pairs, 168 overnight cases, 216 waste cases. Synthetic/stub boundaries retained in external receipts.
- DeSmuME original `first-home.dst` replay: invitation observed; Yes enters care explanation, No returns to running Home clock. Both use ordinary touch with 5 held + 240 released frames. Post-decline save and full tutorial writer remain open.
- Ghidra: ARM9/OVL0/OVL18 imported explicitly at original bases, analyzed (3285/494/376 functions); MCP decompilation of `02113C2C`/`0211459C` and disassembly of `02061BB4` PASS. Original NTR loader prompts for SDK/CPU/overlays and cannot be unattended through generic import; source confirmed. Correct fallback uses ndspy + BinaryLoader, not guesses or marking an incomplete analysis complete.
- Confirmed additional gaps: roster three disabled controls and 13 omitted rows; 8 unsourced Tamer fields; 4 disabled Battle-kind selectors; result rank art/transitions open. Existing capture-storage and recovery VFX ARE wired; not all animation frames / each facility visually accepted.

No product patch, commit, push or deployment. Next safe vertical slice: public Hunt asset readiness, then tutorial invitation, then Shop/loadout/tool-use/storage parity. Keep findings separated from implementation and normal/device acceptance. Numeric/tool receipts are summarized in `審查驗證摘要.json`; large private research outputs remain external.

Final documentation verification: `git diff --check` PASS; all report links resolve; CSV row counts 118/36/26/96 match expected. HEAD remained `08445ba4629aac5757f31b0c1e68fbf40e7966de`, with only this task's two new documentation paths untracked.
