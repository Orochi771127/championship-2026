# Battle character identities and four Shop goods — R2

Completed 2026-09-07 (Asia/Taipei); work began September 6. Repository: championship-2026, main, HEAD d0c48f340baac61cf399bf5bd5922ce58f3d38c7. Shared dirty work preserved; no commit or release.

This extends facility-battle-mobile-r1 with visible character identity and four named Shop goods. It does not close original battle animation, party selection or the full Shop artwork inventory.

The later [battle-animation-r3](../battle-animation-r3/README.md) adds bounded raw-sequence playback for the three tested combatants. The static-animation description below records R2; original launch timing and party selection remain open in R3.

## Implemented

- Battle presentation now projects the existing session species into the existing character loader and Chinese name catalog. The normal `main.js` entry loads only participating species, retains the production-index and appearance replacement checks, and mounts sprites in the existing Pixi scene.
- Visible characters replace their circular stand markers. Sprite enlargement is derived from each character's verified first-frame native sizing and the arena's native width. Source texture resolution and trimming are accounted for. Resizing keeps the feet on the same authored stand; missing identity or sizing retains the neutral marker. The renderer disposes its roster once on exit.
- Four Training Goods rows show 飼料, 蛋白質, 傷藥, 藥品 with existing ORIGINAL_CREATED toolbar illustrations. The original Shop record order 0,1,2,3 maps to item indices 0,1,3,2; wound and illness medicine are not swapped. Buying still sends the original shopRecordIndex to the existing Shop authority. Prices, quantities, unlock conditions and wallet logic are unchanged.
- No raw reference-pack pixels were copied, promoted or loaded. Existing eligible production packages are reused. No dependency installation was necessary.

## Evidence and boundary

- Evidence MCP: `SHOP_REVERSE_SPEC_v1.md:139-144`; `YDIJ_RAW_RESEARCH_EVIDENCE/SHOP_REVERSE_CATALOG_118.csv:1-12`, SHA-256 `58e5beb04f8c75c388710291c5c5506a560453872743ca34c7c3a7ef2bf1bc28`. These identify the four records and original Japanese names. Chinese labels are display translations; atlas drawings are original-created illustrations, not original UI portraits.
- `CLAUDE_CODE_YDIJ_SYSTEMS_HANDOFF/06_BATTLE_STATS_DATA/BATTLE_MASTER_SPEC.md:41-52` distinguishes Main actor animation from Secondary effect calls. The hard link sequence 34 → raw Main slot 33 is not a general attack/idle mapping. Current `battleMoveScriptRun.js` still stops at native animation calls that require an object graph. No guessed aliases, attack timing or motion were introduced.
- Battle uses static Main animation 0 first-frame identity. Original approach paths, camera framing, action animation and effects are **UNKNOWN_REQUIRES_TRACE** for this presentation binding. Existing stands and facing remain PRODUCT_AUTHORED. This is native pixel-ratio alignment, not a claim that the complete original battle camera or choreography is restored.
- Existing player team remains a preset stand-in; binding the Home roster to the original entry/team selection flow is still open. Normal Spring Day 1 has no eligible match; the QA fixture does not make one appear in normal play.

## Validation

- Focused: **35/35** (`qa/focused.log`), covering character scale/feet through resizing, actor reuse/disposal, missing sizing fallback, unknown species, Shop record mapping and existing battle/loader regressions.
- Complete serial regression: **1144/1144** (`qa/regression.log`). `git diff --check` passed; only existing CRLF normalization warnings in `qa/diff-check.log`.
- Browser normal saved game → Continue → System → Shop: four named goods and icon crops rendered, prices 5/300/20/200 bit, quantities 50/10/10/10. With the existing 0-bit wallet, all four purchases remain disabled. No money was inserted into the normal save. Existing Cage category thumbnails retained.
- Shop at **390×844 and 320×568**: no horizontal page overflow, buy and return buttons at least 44 px, the narrow list has its own vertical scroll area and the footer remains on screen. Screenshots: `qa/shop-goods-390.png`, `qa/shop-goods-320.png`.
- Battle at **390×844 and 320×740**: actual Pixi renders show 加魯哥獸 (species-081, 8 packed pixels/native pixel), 火焰獸 (species-113, 8), 玩具亞古獸 (species-050, 12), with corresponding HUD names. No page horizontal overflow. Screenshots: `qa/battle-390.png`, `qa/battle-320.png`.
- Battle QA used `tests/fixtures/championship-facility-battle-review.html`, clearly labelled with isolated in-memory save, Autumn Day 4 and 10,000 test bit. It uses the actual app, runtime, character loader, arena, DOM screens and Pixi stage. Start prepared the runtime then debited 150 (9,850 remaining); real automatic play reached a win and credited 7,000 (16,850 remaining); next page showed that receipt and Return completed. Screenshots: `qa/battle-result-320.png`, `qa/battle-prize-320.png`.
- Browser viewport emulation only; physical Android/iOS testing not performed. No public/shipping acceptance claim.

## Still open

Original battle action animation/object targets and original world movement; Home roster entry flow; four battle-kind routing; complete post-match progression; remaining Hunt-item and Plugin portraits/names; original Shop portrait/UI-cell bindings. Ranch membership and training writers are unchanged by this slice.

Contract: `docs/contracts/championship/CHAMPIONSHIP_BATTLE_CHARACTERS_SHOP_GOODS.v1.json`.
