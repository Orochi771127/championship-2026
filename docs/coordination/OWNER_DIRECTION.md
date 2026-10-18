# Championship Owner Direction

<!-- record-id: INSTALLED_GAME_SAFE_AREA_20261018 -->
## 2026-10-18 — Inner-page standalone safe area

Owner confirms the title bottom strip is fixed on iPhone, but reports the strip on every game inner page. Authorizes shared game container/viewport/canvas repair across portrait and landscape, tests and publication, preserving saves and all latest icons/Dex work. Coordinate with art and music publishers and fetch current main before integration. No cache clearing, save reset, app deletion or repeated title acceptance required. See [scope and validation boundaries](../reports/installed-game-safe-area-2026-10-18/REPORT_ZH_TW.md).

<!-- record-id: IPHONE_CANVAS_FOLLOWUP_20261018 -->
## 2026-10-18 — Actual iPhone bottom strip persists

Owner reports the pale bottom strip remains after reopening standalone; do not mark the prior height change as device accepted. Authorizes focused canvas/background investigation and minimal visible build/viewport evidence, preserving saves and control safe areas. Publish through existing main gates; keep approved icon and concurrent Dex work. See [separate evidence and device limits](../reports/iphone-canvas-followup-2026-10-18/REPORT_ZH_TW.md).

<!-- record-id: APP_ICON_APPROVED_20261018 -->
## 2026-10-18 — Publish the approved app icon

Owner approved the exact head-and-shoulder fire dragon icon and manually downloaded its master. Authorizes three opaque square downsampled icons, versioned install references and existing approved zh-Hant brand labels; commit/push/main/Pages and safe R-main synchronization. Preserve current viewport repair and concurrent Dex changes; no PR56 merge, regenerated art or save changes. See [source identity and validation](../reports/app-icon-2026-10-18/REPORT_ZH_TW.md).

<!-- record-id: IPHONE_HOME_SCREEN_REPAIR_20261018 -->
## 2026-10-18 — iPhone Home Screen repair and publication

Owner requests the standalone bottom-gap repair and a compact top install entry, preserving touch safe areas and existing saves. Existing explicit commit/push/main/Pages and R-drive synchronization authorization applies to this focused repair. Use only supported installation APIs with system confirmation. Do not merge independent PR56 or replace concurrent Dex commits. See [implementation, platform evidence and device limits](../reports/iphone-home-screen-2026-10-18/REPORT_ZH_TW.md).

<!-- record-id: REFERENCE_POLISH_PUBLICATION_20261018 -->
## 2026-10-18 — Publish the reviewed reference polish and synchronize local main

The Owner explicitly directs: 「是 請 COMMIT 跟PUSH 並整合發布至MAIN 並確認本機端跟GITHUB的進度一致」.
This authorizes the scoped title-delivery, idle/feedback, upgrade-preview, Web App installation and reliability candidate,
its necessary build/public allowlist hashes and release records, commit/push to the existing main and Pages playtest,
and safe synchronization of the existing R-drive checkout. Preserve unreviewed local hatch-cutscene work and unrelated
untracked research; do not publish them or overwrite them. Complete existing CI, formal playtest build/validate and
payload checks, then verify remote workflows, public hashes and both local/main commits. Physical iPhone acceptance,
commercial rights and unrelated technical debt remain separate. See [candidate and release evidence](../reports/reference-polish-2026-10-18/REPORT_ZH_TW.md).

## 2026-10-15 — UI/HUD, scene presentation and ceremony upgrade (arena daylight)

The Owner hands over the UI/HUD, scene presentation and animation upgrade for direct integration, with a sellable, polished 2.5D monster game as the quality bar: 「先同步最新 main，理解現有引擎與流程，再訂一套一致的視覺與動效規範。設計要明亮、俐落、有輕科技感與世界觀辨識度；場景滿版、HUD 浮層、資訊清楚」. Scope: desktop, portrait and landscape UI/HUD with stable layouts and 44px targets; complete presentations for medal acquisition, hunt entry, capture success, evolution, battle opening and settlement, with skip, reduced motion and power saving; one art language; reuse approved original art (character art and style calibration stay with dot) and keep source/licence records; load only what a screen needs and release it on exit; keep gameplay, save, reward settlement and evolution/capture timing exactly. Build Raising → Hunt → reward/medal first as the quality template, then extend the rules. Verify at 390×844, 844×390 and 1366×768 with before/after captures, list what tools cannot verify, then 「自行審查修正通過後，依 repo 現有流程提交與發布」.

Decisions recorded under this entry (OWNER_APPROVED_ADAPTATION of presentation): the bright 「晴空競技」 arena palette becomes the default theme (explicit saved themes are kept); a ceremony layer (DOM + CSS timeline, synthesized cues through the existing sfx bus, no extra ticker) decorates only already-settled moments; the native evolution sequence and the native READY/FIGHT cue are untouched and the new reveals play after or beside them; the Hunt field frame gains one read-only `onCard` projection of the memory card. No new raster art, 3D model, font, gameplay value, save field or Battle core. See [spec](../reports/ui-ceremony-2026-10-15/SPEC_ZH_TW.md) and [report](../reports/ui-ceremony-2026-10-15/REPORT_ZH_TW.md).

## 2026-10-15 — Data Arena round 2: four-move kits and a short tournament (supplement, same batch)

Owner supplements the Data Arena task without restarting it. A playable reference, Pokémon Zarza Arena, guides the round:

- Controls and pacing to learn from: footwork, aimed attacks, dodging, four-move cooldown/energy kits and clear attack warnings, instead of standing and trading hits.
- Cover, obstacles and terrain must really change attack lines and positioning, keeping the fire/water/ice interactions.
- The short tournament stays separate from endless survival, and six rounds are not six waves. One complete, replayable slice comes first.
- Big Kid Nation is a reference for crowd and staging only; PokéSurvivor for upgrade and replay rhythm only.
- Use our own characters, art, skills and engine, with a few distinct characters rather than a large roster.
- Private-room 2v2 and other multiplayer stay as extension research. Build single-player/AI first; scope must not widen without a multiplayer backend.

Branch and scope rules:

- Continue on the independent mode branch.
- Protect existing UI, Database, medals, ranch and save work.
- List the minimal diff before implementing.
- Acceptance includes real operation and regression of existing features, at commercial-game quality.

Mechanics may be adopted by type only, under our own names, numbers, visuals and audio. See the [round-2 contract section](../contracts/championship/DATA_ARENA_SLICE_2026-10-15.md#第二輪補充2026-10-15同日-owner-補充指示).

## 2026-10-15 — Data Arena: Tidal Data Harbor Challenge (original real-time 1vE slice)

Owner authorizes a new original mode, 「Data Arena／數據競技場」, built as a complete playable vertical slice rather than a specification: title-menu entry → partner select → ten-second briefing → about four minutes of real-time 1vE (movement, aim, dash, sustained heat-limited laser, cooldown mate command, riding the water mate across a channel, fire/water/ice interactions, telegraphed bullet patterns, at least three three-choice upgrades, a final guardian) → victory/defeat → retry/return. It is an OWNER_APPROVED_ADAPTATION outside ROM parity: reuse existing approved creatures through a read-only adapter, the existing single Pixi Application/ticker, music presentation, audio bus and build/publication flow; keep mode data in its own namespace isolated from the raising save and economy; no Unity/Godot/Unreal engine switch, dependency upgrade or site rewrite; do not overwrite main menu, key art, Database, medals, shadows or character-form work owned by others; original or clearly licensed assets only, with a provenance list; honest physical-device and performance reporting. Commit, push, PR and the existing preview/publication flow are authorized after full checks, a real browser playthrough and a conflict-free comparison with latest main; no force push or rewriting others' commits. Swim relay and obstacle race stay as second-phase planning until this slice is accepted. See [slice contract](../contracts/championship/DATA_ARENA_SLICE_2026-10-15.md) and [batch report](../reports/data-arena-2026-10-15/REPORT_ZH_TW.md).

## 2026-10-15 — Integrate reviewed Database stories and twelve approved portraits

Owner authorizes completing and publishing the reviewed Dex batch through the existing public playtest. Integrate the corrected 216-species five-language stories, native attribute/family and species move display, and only B101–B112 approved portraits. Preserve latest main Hunt PR #3, registration/masking, IDs, save and existing gameplay. Refresh only this batch's build inputs/hashes and run full hosted CI plus public-playtest build/validation. Exclude unrelated candidate medal, viewport, Hunt-result, evolution and presentation work. Prepare a draft PR for serial final review before merge; the separate shadow batch remains separate.

## 2026-10-14 — Four-language TITLE logo integration and final local acceptance

Owner authorizes dot's complete en/ja/vi r1 and th r2 logo package for integration after self-review and final QA (Sentinel_12915bfd3898819189f1d26f133caa89). After cloud/Library transfer limitations, Owner approves local finishing and supplies `integration-handoff.tar.gz` by manual download (Sentinel_935b4aa7b9a08191907f5cd53f41e517),6575393 bytes, SHA256 `ecebbe66ce66f7381dd1ba74fe3049edd69c53b53fb1c562d637b7a20b65ff0d`, matching private Library `libfile_e760dc7c59f88191aed97a019f147dcc`. This is a local Owner handoff, not official-helper materialization or an xattr claim. Apply the reviewed three-product-file patch, copy only four exact PNGs, bound build approvals to five additions and three product hashes, then focused/normal-browser/aggregate/build/compiled/film validation, own-file commit, normal main push and exact-SHA CI/Pages/live checks. Necessary foreign-logo fit and fallback-text corrections stay inside opening.css; preserve original Chinese bytes/composition, names, film/audio/warmup/lifecycle, app/save/ticker and unrelated approvals. Character art remains dot's separate private Library batch; portrait/landscape,600→420,Battle/Hunt and atlas work are excluded. See [results and limits](../reports/title-multilingual-2026-10-14/REPORT_ZH_TW.md).

## 2026-10-14 — Database one-level candidate routes and limited missing-art audit

Owner delegates the bounded next slice after published `636e9efa`: project the existing 477 ordered candidates and `(oldSpecies-8)*5+index` completion history into registered ordinary Database details, with independent registration/history, unknown masking, approved existing HUD portraits, conservative invalid history, eggs/empty states, and existing mobile/desktop/five-language/two-HUD navigation. Preserve writers, resolver, economy, save, IDs/fixed codes, RNG, app and ticker. Only inspect the named missing species211/222 local masters, CSV, HUD delivery and approvals; preserve96/97 aliases and species9/20 鐵鈴芽 naming. Parent handles cloud masters and candidate review. The latest Owner direction has dot finish and review the entire art batch into private Library before deciding whether Codex downloads it; do not integrate individual candidates, including prior R1/R2/R3 or old coloring. Continue engineering with neutral missing-art placeholders (Sentinel_a6f7084b3ed48191af0bdb89f92b1f93 / Sentinel_29402c895b3c81919d2d152ff4f2a9f0). No new art is integrated in this batch. Self-review, focused/aggregate/build/isolated browser checks, own-file commit, non-force main push and exact-SHA CI/Pages/public artifact verification remain authorized for the route slice. See [contract](../contracts/championship/DATABASE_EVOLUTION_ROUTES_2026-10-14.md) and [results and outstanding art](../reports/database-routes-2026-10-14/REPORT_ZH_TW.md).

## 2026-10-13 — TITLE logo visibility and readable pending brand

After published Database batch `125ad364`, Owner delegates two bounded TITLE improvements from dot's existing source/controlled analysis: request the Chinese logo only in its visible language, and keep the existing approved text heading readable until the attached logo decodes or on failure. Preserve completed cache, language-synchronized ready/error/retry, original pixels/final composition, movie clone, music priority, six-second video preload headroom, 720/1080/540 choices, skip guard, idle/reduced-motion, background cancellation and Blob URL disposal. No new art, compression, deployment or Database expansion. An optional art ordering candidate requires spare scope and clear measurements; this batch retains the existing order. Use isolated QA and current app/save owners, then self-review, commit/push/publish and verify exact SHA and public artifact. See [results and limits](../reports/title-visibility-2026-10-13/REPORT_ZH_TW.md).

## 2026-10-13 — Database stage filter and explicit fixed codes

Owner delegates a separate small batch from published `391cbe78`: seven-stage filters and explicit stage-local append-only codes EG/B1/B2/GR/MA/AW/UL, with at least two serial digits and no 99 cap. Bootstrap the existing 216 species by legacy book order within stage, preserve all IDs/ordinals, and use the existing approved eight-egg catalog as untracked content outside regular registration. Do not add seen/egg saves, rewrite capture registration/rollback, invent stories/routes, promote special224–227 or copy research runtime. Preserve unknown masking and independent branch history, five languages, both HUD styles and desktop/mobile focus flow. After focused and necessary aggregate/build/browser checks, commit only this batch, integrate safely by normal push, publish and verify exact-SHA CI/Pages/live bytes. Three readable private Library attachments replace the Windows-incompatible ZIP materialization path. See [contract](../contracts/championship/DATABASE_DISPLAY_2026-10-13.md) and [evidence](../reports/database-display-2026-10-13/REPORT_ZH_TW.md).

## 2026-10-13 — Measure and reduce mobile Chrome TITLE entry cost

After publishing desktop browse `12c4b61a`, Owner delegates an independent small entry-performance batch. Measure URL→usable Skip, actual video first frame, and Skip→operable TITLE on the current formal artifact with isolated cold/warm cache and representative throttling; controlled Chromium is not Owner-device evidence. Modify measured costs only, starting with non-TITLE screen presenters. Keep the same app/router/save, already-lazy Pixi/Three/battleRuntime, approved 720p/1080p/540p media, image quality, skip/failure/reduced-motion/background/idle/music contracts and save validation. No deployment migration, ROM work or large rewrite. After focused/regression/CI/build checks, commit only this batch, normally push and publish, and verify exact-SHA CI/Pages/live bytes. See [measurement and bounded result](../reports/title-entry-2026-10-13/REPORT_ZH_TW.md).

## 2026-10-13 — Desktop Shop / Database browse layout

Owner delegates the small desktop layout batch: use horizontal space for the existing Shop list/detail and Database list/detail, retain mobile operation and both modern/classic styles. Scope is layout, readability and navigation/focus only; preserve registration, numbering, story, prices, economy, save and Battle. No new art, runtime, engine or ticker. Use an isolated QA context, check desktop/short desktop/390px phone, resize, five languages, scrolling and return focus. After self-review and tests, commit only this batch, integrate without force or moving Owner's main checkout, push and publish via existing Pages; verify exact-SHA CI/Pages and public bytes. Existing Pages size warnings do not authorize asset deletion or reduced quality. See [batch report](../reports/desktop-browse-2026-10-13/REPORT_ZH_TW.md).

## 2026-10-13 — Focused capture recovery, startup, classic UI and neutral authored labels

Owner delegated this focused batch after confirming quota reset: 「完成自審後可 commit、push 並發佈」 and 「通過後已授權提交相關檔案、非強制推送main並部署，核對exact SHA的CI/Pages」. Use an isolated worktree and QA context; preserve the user's main, other uncommitted work, AI/special fixes and Antigravity's tutorial asset routing work. Follow-ups include the provided tutorial battle MP4, bounded classic HUD/tool alignment and meat ground-depth corrections, and removal of the confirmed legacy branding from authored UI/error labels while preserving keys, IDs, research and player nicknames.

No new agent, art recreation, species/evolution change or unrelated debt scan is authorized. Unknown original save/TITLE restart and physical Safari causes stay unverified; do not infer OOM or claim an unreproduced issue fixed. Publication uses only the reviewed existing public-playtest selection and normal main push. See [batch evidence](../reports/capture-raising-recovery-2026-10-13/REPORT_ZH_TW.md).

## 2026-10-13 — Special hit on its launch frame: stop the battle-wide freeze

The Owner delegates the fix choice: 「修復方式交由你自行判斷，不限定一定恢復起手動畫。請根據根因，選擇對玩法影響最小、可驗證且不會再次卡死的方案；必要的演出流程調整，我授權你處理並記錄原因。」 They also direct:

- Start from the latest main and keep other people's changes.
- Do not just swallow the exception or force a result.
- Avoid double damage, double resource cost, a lingering presentation lock and accidental invincibility.
- Ask again before any large battle-rule or balance change.
- Reproduce with a test first, then verify the fix and normal battles.
- After self-review, commit, push and publish.

- **Root cause:**
  - An unengaged projectile can hit a special's owner on the launch frame (0210D690 / 0211D7C0).
  - The owner's hit reaction keeps running in the exclusive branch (0210D534). It replaces the script's pose and ends on a looping idle.
  - The script waits only on 0211D3A8 → 02047C48. The CPU oracle shows the prelude has no other exit.
  - The battle then freezes: in the prelude (the timeline throw) or silently in the primary.
- **Fix (OWNER_APPROVED_ADAPTATION, presentation flow):** while the special holds the owner's +94 lock, a script pose replaced by the owner's own notification lane counts as finished.
- **Unchanged:** hits, damage, costs, the reaction, the timeline detector and victory rules.
- **Original behaviour:** the original very likely waits forever too, but this stays PARTIAL until a full-encounter replay confirms it. See [the report](../reports/battle-prelude-hit-softlock-2026-10-13/REPORT_ZH_TW.md).

## 2026-10-13 — Corner stall: restore the original first, then a bounded improved AI

The Owner reports 「對戰角色被連續打到角落後，長時間停住、不移動也不出招」. They direct:

- Reproduce the stall first.
- Separate normal-game evidence from fixed-seed diagnostics.
- Trace the original ROM before changing anything.
- If it is a port error, apply a minimal fix with a regression test, and do not mask it.
- Then build a bounded improved AI prototype:
  - it may use only known positions, visible state and legal actions, with no future RNG and no unrevealed opponent decisions;
  - it must not add invincibility or endless kiting;
  - it must not disturb the existing simulation RNG sequence;
  - it must stay on the existing clock.
- Commit and record the original restoration and the improved AI separately, and label the improvement an Owner-authorized adaptation.
- After self-review and tests, handle it under the current publication authorization.

- **Original restoration:** a launch whose target was cleared on the same frame is refused by the initialiser, as in ROM 0211C0A0, instead of being refused at allocation. Before this fix the combatant held state 14 behind a looping walk and stood in a corner. See [the root-cause report](../reports/battle-corner-stall-2026-10-13/ROOT_CAUSE_ZH_TW.md).
- **Original behaviour kept:** the approach dead band in states 4 and 5 (021161F0 / 02116314) is CPU-verified against the ROM and stays unchanged in the original mode.
- **Not fixed in this batch:** the special-prelude timeline throw, whose root cause was still open (fixed in the later 2026-10-13 entry above).
- **Improved AI v1 (OWNER_APPROVED_ADAPTATION, separate commit):** when the original rule leaves a standing fighter idle inside the approach dead band for 20 battle frames, it issues the original walk notification toward the original aim point, using the reachable side when the target hugs a wall. It does this at most three times per decision and never in hit, down or recovery states. It draws no RNG. The runtime default stays ORIGINAL; menu battles use IMPROVED_V1, and ?battleAi=original restores the original rule. See [the AI report](../reports/battle-corner-stall-2026-10-13/IMPROVED_AI_V1_ZH_TW.md).

## 2026-10-12 — Approve move names, rename three characters, publish the remade shared VFX

The Owner delegated the move-name review: 「那些名稱你幫我審核啊，然後角色名稱也幫我更改。……你幫我核准以後就可以寫入遊戲並補齊翻譯。完成以後就commit 並push整合發佈至main」. On the private VFX pack: 「那包當然可以發佈啊，都已經重做了。你幫我審查一下吧若沒問題就是接入遊戲使用然後發佈啊」.

- **Move names (approved by delegated review):** every one of the 565 species moves has an approved five-language name in `src/championship/text/battleMoveNames.js`, keyed by stable skill ID. 504 generic rule candidates were rewritten. Values, IDs and owner links are unchanged. See [the review document](../reports/battle-move-names-2026-10-12/REVIEW_ZH_TW.md) and [the approved table](../reports/battle-move-names-2026-10-12/MOVE_NAMES_APPROVED.v1.csv).
- **Character names:** the three in-game names that were still original-work names now use the Owner's own name table:
  - 181 地嘯暴龍;
  - 211 黃銅王猿 (OC-220, chosen over OC-211);
  - 222 天穹帝龍.

  The other five table differences keep the in-game spelling.
- **Remade shared VFX (published):** revision `original-shared-review-210-seamfix-r1` (210 cells; Blender procedural; no original pixels; bank 110 excluded) and its three battle-text atlases now play on the approved public playtest URL. The approval is recorded as `acceptedOriginalSharedVfx` in `src/data/championship/public-playtest.r1.json` and hash-selected in the build inputs. The manifest's review flags stay as provenance, as for the accepted characters. Unselected revisions and candidates stay local. Pixels, timing, collision and damage are unchanged; `?vfxOriginal=off` shows the base art.

Still not authorized: gameplay changes; redrawing bank 110 (assigned to dot).

## 2026-10-12 — Dynamic battle presentation: original proportions, moving camera, skill–field interaction

The Owner shared two screen recordings of an arena fan game and asked for battles with that feel, built with the project's own original characters, moves and effects: 「我想讓我的戰鬥系統我的自創腳色們，也能擁由如同影片中的對戰動態效果感」, then 「就是全權交給你去設計跟處理…是我們自己的角色跟我們自己的招式絕招」. They then fixed the direction:

> 「角色維持原作的相對大小，取消額外放大 1.5 倍；原創圖片的清晰度照樣保留。我剛才建議保留 1.5 倍當基準，就不採用了。動感靠鏡頭拉近、拉遠與跟拍，加上既有技能特效和場地的互動，例如落地揚塵、命中衝擊波、爆炸碎屑、短暫焦痕。這些要對準真正的出招位置、命中點與地面，不能只是浮在角色身上的光效。這就是給 Claude 的最新方向：原作角色比例＋動態鏡頭＋技能與場地互動；先做視覺演出，保持傷害、碰撞與勝負規則不變。」

`OWNER_APPROVED_ADAPTATION` for the battle field presentation only:
- **Proportions:** under the dynamic presentation, completed original bodies are drawn at the original relative size (no 1.5× display factor) at their full density-4 resolution. The 2026-10-10 1.5× factor remains only in the `?battleFx=classic` comparison view.
- **Camera:** the camera follows the fight on the existing Pixi world container. It pushes in on a launch, follows live projectiles, pulls out to the whole group, punches and shakes on heavy hits, and holds on a knockout. Reduced motion keeps a steady shot.
- **Skill–field interaction:** take-off and landing dust, run dust, hit shockwaves, explosion debris and short-lived scorch are placed at the real launch point (the effect actor's first position), the real contact point (the native impact or the projectile's last position) and the ground beneath it (native ground y, height removed). These are not glows floating on a body.
- **Existing effects:** the Owner's own shared VFX pack and the existing native effect pool keep their timing and positions.
- **Unchanged:** simulation, damage, collision, timing, RNG, verdicts and save; classic view via `?battleFx=classic`.

Then the Owner authorized delivery: 「都做好後自審沒問題就commit 並push整合至main」, 「要發佈」 and 「都做好後就一樣commit並push然後發佈整合至main」 — self-review, commit, push, integration into `main` and publication through the existing Pages playtest.

On move names the Owner directed: 「我沒有另外的招式表，請你從現有技能資料、角色對應和已完成的原創特效清單整理。保留穩定的技能 ID、角色關聯及傷害、屬性、射程等既有規則，區分『技能本身』與『共用特效配方』…先查找專案裡已有的核准名稱與五語翻譯，有就沿用；缺少名稱的…擬定原創名稱，標記為待審候選，不要把通用組字當成已核准的正式招名。先交一小批代表角色的對照表供審查…演出驗收可以先用技能 ID 對照。」
- Display: only approved names are shown. The 30 special skills keep their approved five-language names. A species move without an approved name shows the character's name with 技能／絕招, and local acceptance (`?battleFxDebug`) shows the stable skill ID. The generic composed wording is withdrawn.
- Candidates: the review batch of 24 moves across 9 characters, plus rule candidates for the remaining 541 moves, are in [the review document](../reports/battle-move-names-2026-10-12/REVIEW_ZH_TW.md). All are pending review and unused at runtime. No skill ID, owner link or value changes.

Still not authorized: gameplay changes such as a beam clash; showing candidate names before approval.

## 2026-10-12 — Correct and publish the new-game gift-letter brand wording

Owner reports the two TITLE opening gift letters still show 「數碼獸／數碼蛋」 (Sentinel_cfc02d51dad48191b422823d4462a773), then explicitly directs 「改完自己審查沒有問題就送上去commit跟push並發佈」 (Sentinel_34621683f3508191bb44e93ffef6ca07). Dot relays this bounded implementation and release: use the existing centralized 拍檔／培育蛋 terms across five locales, check the actual envelope/letter flow, preserve player names and old saves, run focused/CI/build/validate checks, then normal main push and existing Pages exact-SHA verification. Three existing product hashes may be updated for these three changed modules. Do not change registry-wide term approval, research, IDs, gameplay, player storage or unrelated assets. Keep Owner main and Claude's battle conflict untouched. The newly reported full-tutorial actor/texture and return-to-TITLE issues are a separate diagnostic task. See [scope and checks](../reports/opening-letter-brand-2026-10-12/REPORT_ZH_TW.md).

## 2026-10-12 — Publish the independently reviewed eight-egg size and CSS touch correction

Owner requests native-sized eggs (Sentinel_ec2469868d0c8191b5fc1f129a04b880) and explicitly includes every egg (Sentinel_0ad6158a0628819197b140ea7ae3f3c4). After independent R1/R2 hash, geometry and landscape edge-tap review, Parent authorizes this bounded release under the Owner's self-review then publish instruction (Sentinel_cac9fa4b6e18819182496a5bde0bea78), local synchronization instruction (Sentinel_bc03219eebf48191bc531dfda959e940), and commit/push/publication instruction (Sentinel_7bfe8e2ba1848191a3eb73643142988c).

Only e000–e007 Raising visual normalization and their 44 CSS-pixel minimum touch area are approved, with the focused test and necessary release records. Preserve original art, cage/layout, other actors, Battle, evolution and save authority. Update exactly the two existing product approval hashes. Run the repository CI and formal build/validate, commit, integrate latest main without force, push and verify exact-SHA CI/Pages plus public artifacts. Preserve all Claude work and its unmerged VS5 conflict. This supersedes the pre-review no-push pause solely for this reviewed egg batch. Physical-device acceptance and commercial rights remain unverified. See [evidence and R2 correction](../reports/egg-native-sizing-2026-10-12/REPORT_ZH_TW.md).

## 2026-10-12 — Publish the reviewed NS33 opening film in the existing TITLE flow

Owner message `Sentinel_3dfc9984246c81918d9ca360d66ce7f3` at 2026-10-11 23:20 UTC: 「用好了就接入然後發佈啊。之後如果有有問題，我們再修就好。」 The Owner selected their original `ns33.mp3` music and authorized integration, isolated-worktree commit, normal main push and the existing Pages publication after the necessary checks. Only the reviewed 48.5-second textless 720×1280 H.264/AAC final file (SHA-256 `74e171baa7a3893a7e5e1274dab699339e9753733c1681ee18aff4f5dbaaf184`, 14,563,538 bytes) is selected. No production sources or music stems are published.

The film is a DOM presentation inside existing TITLE: immediate skip, muted inline startup, explicit sound consent respecting preferences, uninterrupted 15-second TITLE idle replay, graceful media failure, reduced-motion manual playback and existing five-language brand copy. Keep the same router, save, Pixi application/ticker and gameplay. Preserve collaborator work and the player's 8732 origin. Physical-device acceptance and complete subjective listening remain unverified; publication permission does not change those labels or commercial rights. See the [implementation contract](../contracts/championship/NS33_OPENING_FILM_2026-10-12.md) and [validation report](../reports/ns33-opening-2026-10-12/REPORT_ZH_TW.md).

## 2026-10-12 — Ranch opens right under the HUD; locked covers under the whole board

Looking at the published preview, the Owner asked 「你上方一定要留空白嗎?不能像圖一那樣不空白嗎做好就COMMIT PUSH跟整合至MAIN」 and, with a phone screenshot of a hole below the ranch, 「但是這塊空白能補上就好嗎」. A ranch with rows below its board (the locked preview or a granted annex) now opens with the board right under the HUD. The headroom stays above it: a drag down shows it, and tapping a resident brings its whole body into view. The locked covers now run under every column of the board, so panning never opens a hole; the padlocks stay on the expansion's ten bays. For Cage Edit the Owner added 「這裡也要補上可擴充開放的格子」, so the locked rows there now run under all ten board columns as well. The sheet says the other locked hexes are kept for later expansions, how many and how still undecided, and the expansion cap remains the Owner's call. The tutorial and legacy layouts keep their centred view. This authorizes the commit, the push and the integration into `main`, with publication through the existing Pages. Nothing else changes: no walkability, save, price or payment change.

## 2026-10-12 — Ranch expansion for every player (locked preview), real loading progress, UI polish

The Owner attached dot's UI handoff (`CLAUDE_UI_HANDOFF_20261011.md`, base `6d712b90`) and directed: 「請依附件接續 UI／HUD、使用者體驗與轉場打磨。沿用現有藍色蓋板完成後排擴充預覽，加入真實載入進度；先核對已發布版本，不要重做已完成的方塊旋轉、觸控／貼上與貨幣图示。片頭影片另案繼續，兩邊避免同時修改相同檔案。把籠子擴充系統也上線,全頁面或分頁跟功能頁面設計或籠子能容納的寵物數量都交由你評估跟決定,你只要跟我說為什麼你會這樣決定,請把這些UI /HUD介面再一次打磨優化…完成後請自審」.

「上線」 together with 「完成後請自審」 authorizes committing this batch to `main` and publishing it to the existing public-playtest Pages destination after the self-review and gates. Scope:
- **Ranch:** a native ranch without the expansion shows the annex's rows 3–4 locked under the original blue Lid, with a few padlocks.
- **Entry points:** a 查看擴充 entry on the ranch and in Cage Edit opens one sheet. The sheet says what the expansion adds, the rules it keeps, that the 16-resident limit stays, and that obtaining it is 尚未開放, with its purchase action disabled.
- **Loading:** ranch and battle loads show real step and byte progress. A ranch load is given up on when it stalls, no longer at a fixed 60 s.
- **Dialogs:** dialogs return focus to their opener.

The Owner delegated the page design and the resident capacity. The decisions are:
- no separate page or tab: Cage Edit plus one sheet, because the annex is the same honeycomb;
- the 16-resident limit stays, because it is the original's 16-slot resident pool, and keeping it also serves fairness and phone performance.

Not authorized and not included:
- price, a free unlock path, an expansion cap, fairness rules, payment, entitlement or a diamond ledger;
- any ordinary-player grant (the prototype grant stays QA/developer-only);
- walkability, save-format or gameplay changes;
- cube, touch/paste, currency icons or HUD logic;
- intro-video or TITLE files.

Existing granted annexes, layouts and saves are kept as they are. See [scope and evidence](../reports/ui-expansion-loading-2026-10-12/REPORT_ZH_TW.md).

## 2026-10-11 — Publish reviewed Touch R3 / Currency HUD R1 separately

The Owner directly authorized this receiving release chat: 「我授權發布已審查的 Touch R3／Currency HUD 這批 32 檔變更，包含手機防誤觸、明確複製貼上及貨幣列。請核對差異與測試後 commit、push 至 main、部署既有 Pages，並同步本機。保留其他協作者改動，不包含儲值、支付或付費開通。」 Publish its exact32 reviewed files plus necessary records with normal main push and existing Pages, then verify same-commit CI/Pages, local main and public hashes. Runtime25 paths match reviewed sequential candidate overlay; CI1679/1679, focused77, mobile16, four browser gates and formal build/validate9308 files pass. Diamond remains preview only; existing Bits balance and save authority unchanged. Physical iOS/OS clipboard remain UNVERIFIED; prior12 missing internal reference paths and public C long-flow limitations remain open. No recharge, payment, paid unlock, diamond ledger, new online LINK backend or other collaborator changes. See [scope and evidence](../reports/touch-hud-r3-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-11 — Publish reviewed and accepted six-face Cube R2 separately

The Owner directly authorized this receiving release chat: 「我授權發布已審查的 CM03／CM24 蜂巢前景修復，以及接下來完成並通過驗收的六面方塊自由旋轉。請各自核對差異、測試及 build／validate 後，分批 commit、push 至 main、部署既有 Pages 並同步本機。保留其他協作者改動，不混入金流、付費開通或其他未驗收功能。」 Cube R2 is now locally accepted with the reviewed product bytes unchanged: focused25, full LINK/PASSWORD16, CI1663/1663 and three browser gates, formal build/validate9292 files. Publish only its six-file allowlist plus necessary records using normal main push and existing Pages, then verify same-commit CI/Pages, local main and public hashes. Physical iOS remains UNVERIFIED. Mobile R3, paste UI, currency HUD, payment/unlock and other unaccepted work are excluded; no new online LINK backend or player-save migration. See [scope and evidence](../reports/cube-r2-2026-10-11/REPORT_ZH_TW.md).

> Reading guide — instruction maintenance, 2026-09-14: the dated Owner records below are preserved. Match authorization to the current task, batch, assets and destination. Later scope-specific continuation supersedes an older batch's stop only within that scope; it does not approve new gameplay, rights or publication. Use [authority by question](../README.md#authority-by-question) for evidence claims and [the current shared-file protocol](SHARED_FILE_UPDATE_PROTOCOL.md) for coordination. No new product or publication authorization is created by this annotation.

## 2026-10-11 — Reviewed CM03/CM24 fold foreground integration and bounded visual acceptance

Parent/dot explicitly selected the exact original two-file stencil candidate on C base 53939f7ec46de322d7d2d1d349eaef104d0f5b3b, rejected the mesh experiment and directed integration, formal build/validate and handoff to the existing release task. The original framebuffer zero-tolerance result remains FAIL. Parent's independent visual review accepts only the exact recorded hashes, viewport/DPR/poses and tiny differences in [VISUAL_ACCEPTANCE.json](../reports/annex-foreground-2026-10-11/VISUAL_ACCEPTANCE.json): desktop actor-free three listed pixels have per-channel differences at most one with alpha unchanged; the separately recorded front blue-channel point is not expected occlusion. Other coordinates, larger differences, art/shape/displacement changes remain blocked. Mobile retains the original zero-difference criterion. This is a bounded presentation acceptance decision, not source evidence or a generic test relaxation.

Only fold base lookup, clipping/projection and foreground depth are changed. Preserve existing maps, actor scale, collision, save, single Pixi owner and ordinary-player entitlement. No paid unlock, UI/B/cube or renderer monkey patch is included. Existing Owner quotes about annex checks and self-review/publication remain dated provenance; do not treat the earlier receiving-chat C-only authorization as publication approval for this batch. The receiving release task must validate applicable authorization and stop if direct authorization is required. See [scope and evidence](../reports/annex-foreground-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-11 — Publish reviewed Performance C: optional Battle audio, required VFX retained

The Owner directly authorized this receiving local chat: 「授權將已審查的 C 四檔及必要發布紀錄，經正式 build／validate 後 commit、一般 push 至既有 main、發布至既有公開 Pages，並完成本機同步與公開 hash 核對。」 This is a separate C batch based on 89b4ffa1faf78a182e5d54171f19c4761dde791a and supersedes the earlier A-only exclusion solely for the exact C candidate and necessary release records. The four reviewed hashes are recorded in the release file list; the handoff records independent review, 58 package hash checks, 17 independent checks, five controlled browser scenarios and complete CI 1,642/1,642 with loopback revalidation. Only audio is optional; core visual resources and required Three VFX retain their readiness gate. Update exactly two existing product approval hashes. Preserve all unrelated work, run formal build/validate before commit, then verify the existing CI/Pages, local main and public hashes. At most one bounded public normal-flow smoke; retain failures without claiming PASS. Expansion/UI, B, cube, actor geometry and the pre-existing CM03/CM24 fold foreground issue are excluded. See [scope and evidence](../reports/performance-c-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-11 — Publish independently reviewed Performance A: two-worker character loading

Owner's explicit commit/push/public integration instruction (Sentinel_d01bb93584408191bde36e59ea90a3de), self-review then publication (Sentinel_cac9fa4b6e18819182496a5bde0bea78), local synchronization (Sentinel_bc03219eebf48191bc531dfda959e940), and 「好你繼續工作，用好的就去發佈」 (Sentinel_ede15a1f2c8c81919b776025a59ba9fc) remain applicable to this reviewed release. Parent independently matched all eight before/after hashes, reconstructed the four-file patch and browser inputs, passed five queue/race/retry plus seven ownership checks, and explicitly approved these exact four files through the existing public-playtest release gates, commit/push, CI/Pages, live hashes and local-main synchronization. Update only the three changed product approval hashes and necessary release records. Describe a bounded two-worker scheduler; do not claim public speed halves or decode peak memory cannot rise. Public cold testing is at most one diagnostic round, with failures retained rather than repeated long waits. B is a separate uncommitted candidate after this release receipt; C, cube changes and actor geometry are excluded. See [scope and evidence](../reports/performance-a-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-11 — Publish the independently reviewed three-file resident-readiness clock P1

Owner explicitly directed commit/push/public integration (Sentinel_d01bb93584408191bde36e59ea90a3de), self-review then publication (Sentinel_cac9fa4b6e18819182496a5bde0bea78), local synchronization (Sentinel_bc03219eebf48191bc531dfda959e940), continuation and repair after quota reset (Sentinel_41317edf3a5c8191be84c51ce1c4b7a8), and 「好你繼續工作，用好的就去發佈」 (Sentinel_ede15a1f2c8c81919b776025a59ba9fc). After independent review of the exact three-file clock candidate, its readiness/getter boundaries, counters, RNG boundary and visual evidence, Parent approves this separate release after the seven-file hotfix. Run complete release gates and verify the remote CI/Pages, live hashes and isolated public hold→ready→normal input smoke. Update only the two existing product approval hashes and necessary publication records; preserve all unrelated worktrees/untracked files. Parent subsequently confirmed that the observed public Hunt download timeout is a separate reliability issue and must not block this independently reviewed clock release; retain the incomplete Hunt capture/text smoke as incomplete. Battle loading and brand wording remain separate. See [scope and evidence](../reports/clock-ready-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-11 — Publish the independently reviewed seven-file tutorial and rope hotfix

Parent independently approved the exact seven-file candidate after verifying 14 before/after hashes, six product bundle inputs, focused regressions and five-language UI evidence, and directed: 「核准這個精確7檔集進入公開測試版hotfix build/發布流程」. Commit/push to the existing main/Pages playtest only after required gates; update exactly six existing product approval hashes and necessary release records. Preserve unrelated worktrees/untracked files. Keep the unreviewed clock P1, Battle-loading work and further debranding separate; this authorization does not declare all main-flow P1 issues resolved. See [release scope and evidence](../reports/tutorial-rope-hotfix-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-11 — Publish the independently reviewed loading recovery R1 + R2

Owner authorizes the exact reviewed R1 16-file set with the six R2 replacements for the existing public playtest. Parent independently verified file hashes, the permanent Pixi-request document recovery, failed-save no-reload behavior, and retained gameplay/tutorial data, then directed: 「先完整必要release gates／CI與production build，再commit/push/Pages」. Update only the 14 selected product-file approval hashes; necessary generated preload output and publication records are listed separately. Preserve room, values and all unrelated untracked work; no force/reset/clean. Confirm remote main, CI/Pages and live build/assets at the same SHA, then continue the original organic tutorial save. Gate double-tap wording and the second-target legacy species name remain separate follow-up defects. See [the release scope and pre-publication validation](../reports/loading-recovery-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-11 — Reviewed handoff reconciliation, two-species contact shadows and reversible local migration

Owner requests direct file/result coordination, says 「做好後請你自我審查沒問題就發佈」 and 「本機端檔案也要記得更新喔」, and delegates the local branch integration with 「這些交給你去處理，好嗎？」 / 「我只負責看成果」 / 「嗯嗯」. Parent independently reviewed the bounded candidate and R2 preservation ledgers, then authorized exact allowlist commits, required CI/build/normal-flow gates, main/Pages publication and reversible original-checkout migration after those gates pass.

Scope: preserve selected offline handoff tools and tests; isolate synthetic save stores without changing the production lock default; publish only the visually reviewed contact-shadow renderer/helper for species-218 and species-034. Unknown species retain the prior fallback. Add the helper to the existing hash-selected build/module list; no new art, movement rule, application, save, destination or rights claim. The r18 production-promoter change is explicitly excluded: keep main's original r17 script and archive local r18 bytes. Preserve all local research, two unique commits, dirty-file originals and final-target collisions before migration; do not force checkout, clean, reset or restore intentionally excluded bytes over main. The independent room worktree is outside this release. See [the scoped integration record](../reports/reconcile-main-2026-10-11/REPORT_ZH_TW.md).

## 2026-10-10 — R7 / R9 / R10 reviewed fixes and safe local content sync

Owner says 「做好後請你自我審查沒問題就發佈」 (`Sentinel_cac9fa4b6e18819182496a5bde0bea78`) and 「本機端檔案也要記得更新喔」 (`Sentinel_bc03219eebf48191bc531dfda959e940`), then confirms continuation after a tool cancellation (`Sentinel_660355a8b82881918bff1bcce1b8b7aa`). This authorizes the reviewed Gate disposal, title controls, tutorial drag/cancel and bounded evolution-symbol replacement, their required validation and unused-symbol public artifact exclusion, commit/push to main and the existing Pages playtest after the gates pass. It does not authorize a rights-clearance claim, history rewrite, room candidate or actor/art scaling. Original-project content is backed up and merged by hunk; title files with missing R8 prerequisites remain explicit semantic conflicts. See [the scoped validation and local-sync report](../reports/release-r11-2026-10-10/REPORT_ZH_TW.md).

## 2026-10-10 — Publish the explicitly selected original runtime batch

Owner requests 「做好請commit 跟push並整合至公開發佈版」 and explicitly replies 「可以公開」 at 00:28 UTC (`Sentinel_8d960f4a95048191aaceee1ffa0fa441`) to the scoped question covering 222 original characters/HUD and UI art, 37 cages/35 thumbnails, 17 hunt terrain families, 11 arenas, comic R2 and accepted CM03/CM24 foregrounds. CM24 final ZIP download was confirmed at 00:27 UTC. This authorizes commit/push/integration and deployment to the existing Owner playtest site after required checks. Preserve all 195 original CI modules and add the 20 required modules; do not skip tests for publication. Exact selected outputs and hashes are recorded by the existing public-playtest policy and build-input contract. ROM, research payloads, masters and private candidates remain excluded; commercial rights and full-game acceptance remain unverified.

Owner additionally requests updated descriptions (`Sentinel_f0def42cca508191a40f88f42c9b9ff5`): README and GitHub About describe original creature companion raising, hunt/capture, cage management, automated tournaments, portrait web and five languages. Championship remains a working title; neither Candidate A nor real-time PvP is claimed as finalized. Preserve historical evidence and rights limitations. See [the bounded integration report](../reports/public-original-intake-2026-10-10/REPORT_ZH_TW.md).

## 2026-10-06 — Publish the ranch, personality and annex batch

The Owner asks 「新做好的籠子地圖對於牧場跟擴充都適用嗎?」 and directs 「自審沒問題就COMMIT跟PUSH整合至正式版看看」. After the self-review, commit the three work packages below to `main` and publish them to the existing public-playtest destination once the gates pass on the built artifact. This adds the batch's three new first-party modules (`src/championship/cage/ranchExpansion.js`, `src/championship/raising/nativeRaisingRanchRing.js`, `src/championship/presentation/raisingRanchArtPlan.js`) to `WEB_BUILD_INPUTS.v1.json` and its public-playtest approval list, refreshes the hashes of the listed files the batch changed and regenerates the startup module preload list. It adds no asset, destination or rights claim. The new original cage maps arrived on `main` meanwhile (`79f63dd3`, entry below) and are merged in, not re-authored: they keep the shipped manifest's field IDs, sizes and frame counts, and the annex draws through the same loader and art plan as the main ranch, so both use them. The annex grant appears only with `?presentation=developer` or `?ranchExpansion=prototype` and charges nothing. During the self-review the Owner added 「本來想說都是六角形應該可以拼起來」 and 「這中間空白區域也太大了吧!」 about the gap between the main ranch and the annex band. The annex is therefore drawn as the honeycomb's next two rows, with no gap, both on the ranch and in Cage Edit, and it is published with the batch. No force push, rebase, reset or cleanup is authorized.

## 2026-10-06 — Publish the highlight burst module the settings publication missed

The 2026-09-29 redesign approved the bounded Three.js highlight prop, and the 2026-10-04 publication was to register the batch's new first-party modules, but `src/championship/presentation/highlight/createHighlightBurstThree.js` was left out of `WEB_BUILD_INPUTS.v1.json`: `main.js` imports it dynamically, and the Pages closure check follows only static imports and the listed `moduleEntries`. The public playtest answered 404 for it, so a won battle landed the result plate without the shards. The Owner chose 「Commit and publish」: add the module to `files`, `moduleEntries` and the public-playtest approval list at its current hash, and publish `main` to the existing public-playtest destination once `build:playtest`, `validate:playtest` and a won battle on the built artifact pass. No other file changes; this adds no asset, destination or rights claim. No force push, rebase, reset or cleanup is authorized.

## 2026-10-06 — The new original cage maps replace the old ones in the game

After the opus cage-art rounds r1–r17 were reported (35 of the 36 in-use cages redrawn as original Blender 2.5D fields; the Waiting Room kept by its spec; final layout review PASS 11 / REVIEW 26 / FAIL 0), the Owner asks: 「能用新的籠子地圖版本替換掉舊的原作版本並確認地圖的功能都有接入遊戲,也有實質作用或累積數值 然後COMMIT跟PUSH並整合發布至正式版嗎」.
- The ranch and the cage editor now read `assets/production/cage/original-opus-v1` (registered in `ART_PRODUCTION_INDEX.json` as `art:cage:original-opus:v1`, rights `PROJECT_ORIGINAL`, no ROM pixels). `licensed-runtime-v1` stays stored and indexed but is no longer loaded. Shop goods icons are unchanged.
- Art only: collision, walkability, ranch placement, capacity and cage training stay in the Cage runtime, keyed by cage definition. Their existing parity cases (all 28 training writers, capacity and waste allocation, overnight Cage effects against 168 original CPU calls, live growth) pass unchanged.
- Commit to `main` and publish to the existing public-playtest destination once the gates pass on the built artifact. The new bundle's 42 files are added to the publication list; this adds no new destination and no shipping or commercial-release claim (`shippingReady` stays false).

## 2026-10-05 — Ranch top edge, personality in battle, and a non-paid ranch annex prototype

After the read-only review of the non-animation handoff and the report on the ranch edge and paid expansion, the Owner directs three work packages, each reported when finished without asking again before the next; only destructive changes, undecided payment rules or real blockers stop for a question:

1. 「修正牧場角色越過上緣及高個角色被遮住。依實際程式證據做最小修正，移動邊界、腳底／影子與畫面轉換必須一致；不要靠單獨下移角色掩蓋。必要的原作追證只用來解決具體疑點，不讓它無限阻擋可確認的修復。」
2. 「接入性格＋當下狀態的自動戰鬥偏好。把 W1 必要的資料接線與紀錄，和第一個能實際看出性格差異的 W2a 一起推進。先在自由／練習模式做兩種對照策略，保留原有合法動作、傷害公式與 baseline 回退。用正常進場流程驗收，不停在只加紀錄、沒有行為改變。」
3. 「完成牧場＋10格擴充的必要設計，並實作可操作的非付費原型：增加空間、保持格子清晰、支援直向捲動，驗證配置、碰撞與保存重開。」 A reversible technical choice between a single row and zones is the implementer's; only real player-rule divergences go to the Owner. Old saves are kept, new data is versioned with a migration, and the Owner's save is never reset.

Also: 「價格、免費解鎖途徑、擴充上限、競技公平規則與真實金流尚未定案；先做原型與必要介面，不自行接支付或決定收費。訓練數值未進戰鬥的疑點請記錄精確證據，不順手改整套平衡。」 Character animation in production and the paused Tamer Info change are not touched. To 「增加格子數量後(例如上下兩排)_現在籠子場地的大小就可以再縮小一點 你覺得呢?」 the answer was whole-number scaling (2× on phones) with vertical scrolling only where the frame needs it, which the first package implements. The cage-map vanishing seen once on a QA save is recorded, not investigated. Personality wiring under this entry restores traced original behaviour; the annex is `OWNER_APPROVAL_PENDING_ADAPTATION`.

## 2026-10-05 — Battle facing, naming every catch, and the state of game values

After 「繼續發佈」 (the Retro Blue & Gold theme was published as `bb6c7ef8`), the Owner reports: 「戰鬥時腳色的面朝方向不對,還有捕捉狩獵有複數時,沒辦法改抓到的其他隻的名稱只能改第一隻的,然後很多遊戲數值都沒接上,說是因為原作DOM的反向解讀還沒做完還是甚麼的,像個性跟進化條件之類的」.
- Fix the battle facing and let every catch of one hunt be named. Both are presentation and flow fixes; the traced battle simulation and capture records are unchanged.
- For game values, report which ones read traced original data and which remain untraced. Rules are not invented: untraced behaviour stays `UNKNOWN_REQUIRES_TRACE` until the evidence closes it.
- Shown the fixes, the Owner chose 「提交並發佈」: commit to `main` and publish to the existing public-playtest destination once the gates pass on the built artifact. This refreshes the hashes of the listed files the fixes changed and adds no new file, asset, destination or rights claim.
- For the values, the Owner chose 「先做完整盤點表」: an inventory of every player-facing value, its evidence status, where it is used and what evidence is missing, before any tracing work is prioritised.

## 2026-10-04 — The earlier interface skin returns as a theme

The Owner asks: 「原本仿原作的介面皮膚能不能加回去並放進設定的介面選擇就用然後另外取個名字不要提到原作之類的」, then 「就是舊皮膚但用改版後的樣式」. Bring the earlier interface skin (`src/championship/app/nativeUiSkin.css`, unlinked by the 2026-09-29 redesign) back as a fourth appearance theme. It looks like the earlier skin but keeps the redesigned layout and components, applies only when the player chooses it, and carries a player-facing name that does not refer to the original game: 「復古藍金」 / Retro Blue & Gold (internal id `classic`). Internal records keep its provenance: the design notes in `docs/art/production/ui/` and this entry. The skin is authored CSS. Its only runtime art is the already-approved toolbar cell set, and no ROM-derived, decoded or reference file is added. The other retired layers (the daylight glass layer and the per-screen layout layers) stay unlinked. Gameplay, numbers and the save format are unchanged. Shown the result, the Owner chose 「提交並發佈到正式站」: commit to `main` and publish to the existing public-playtest destination once the gates pass on the built artifact. This refreshes the approved hashes of the listed files the batch changed and adds no new file, asset, destination or rights claim. No force push, rebase, reset or cleanup is authorized.

## 2026-10-04 — Finish the settings round and publish it

The Owner directs: 「請繼續把之前沒做完的完成」, then 「全部完成後自檢沒問題就COMMIT跟PUSH且整合到MAIN發布」. With the settings-round instruction 「做完請你commit並push整合至main,且推到正式版」, this covers the work left open after `bfb1f28`: the settings report and glossary, per-tier performance measurement, the regenerated startup module preload list, the fixes found by the final checks and by the separate acceptance session, and publication. Once those fixes and the self-checks pass, add the batch's new first-party modules and stylesheets to `WEB_BUILD_INPUTS.v1.json` and its public-playtest approval list, refresh the approved hashes of the listed files the batch changed, and publish `main` to the existing public-playtest destination after `build:playtest`, `validate:playtest` and the local gates pass. It adds no asset, destination or rights claim; physical-device, rights and commercial-release acceptance stay separate. No force push, rebase, reset or cleanup is authorized.

The Owner also asks which skills and plugins can help game development and game UI/HUD art and construction, and to use them more. Third-party skills are installed only after the Owner confirms each install.

## 2026-09-29 — Commit and merge the UI redesign and settings to main

The Owner directs: 「先把做好的都commit 跟push整合至main」, and hands the settings acceptance checks (open, back button, Esc, persistence, save-failure retry, reset keeps the save, live language switch) to a separate session. This authorizes committing this session's UI redesign and settings work to `main` and pushing it, leaving other agents' uncommitted files untouched. It does not authorize publication: `WEB_BUILD_INPUTS.v1.json` is not refreshed, so the Pages build stops at its input check until the Owner approves publishing after acceptance. No force push, rebase, reset or cleanup is authorized.

## 2026-09-29 — Formal settings: appearance, quality, sound, language, access and data

The Owner adds a formal settings screen to the existing game: three themes (night, clear, warm) plus follow-system; graphics quality auto/saver/balanced/high with real renderer parameters; mute, master volume and only the sound categories that have real sources; Traditional Chinese and English across the whole player flow with a glossary and coverage check; text size 100/115/130, HUD density and reduced motion; flash intensity and a full/compact important highlight, with the highlight composition fixed so nothing covers the verdict or the amount. Preferences are versioned, kept apart from the game save, report storage failures honestly with a retry, and resetting them never touches progress. The 2026-09-29 redesign boundaries still apply: no invented rules or rewards, no second app, router, save or state, and no fake sign-in or cloud-sync claim.

## 2026-09-29 — Whole-game UI/HUD redesign, Hunt slow-network loading, local autosave and account direction

The Owner asks: 「請處理狩獵場慢速網路載入的問題」, then for a commercial-grade takeover that completes 「全遊戲 UI／HUD、頁面構圖、視覺配色與重要事件演出的整體重設計」 directly in the existing game, acting as UI/UX designer, art director, front-end engineer and QA. The highest priority is the empty band above the Raising Home habitat: find its real cause, design three Home states (none selected, selected, full record) and one consistent HUD behaviour for tools, dragging, switching, menus and lifecycle moments. A new art direction is chosen from compared candidates, with colour codes, type scale, component rules and one signature element, and is carried to every page (title, new game, continue, Home, roster, record, cage edit, shop, database, schedule, tamer, help, system menu, Gate, loadout, Hunt HUD, capture result, battle select, party, battle HUD, result) with 44×44 targets, focus handling, safe areas and tablet columns. Feedback is tiered (daily, ordinary result, important highlight); one high-quality highlight template runs from a real event in five phases (prepare, build, charge 0.6–1.0 s, burst, reveal and settle) with bounded Three.js props, Web Audio, reduced-motion support, no fabricated rewards and presentation kept separate from state. Engineering uses design tokens and a component system instead of stacked skins or `!important`. Verification covers 390×844, 360px, 820×1180, 1024×1366 and 1440×900 through normal entry, with measured frame times, and keeps browser emulation separate from real devices.

Authorized to change: UI/HUD position, size, layout and display; character cards, status bar, toolbar, menus and dialogs; page composition; colours, backgrounds, panels, borders, type and icons; entry grouping and return paths; responsive layouts; feedback, transitions and event presentation. The old glass panels, blue hex ground, gold frames, capsule buttons and fixed character data area are explicitly open to re-evaluation (this reopens the 2026-09-16 preference for the original ground). Unchanged: characters, animations, habitats and cages, maps, gameplay, numbers, evolution, collision and the save format; verified original behaviour stays; unknown behaviour stays unknown; no invented evolution conditions, battle rules, capture odds, refund rules or rewards; no second app, router, save, battle core or world state. Last round's fixes are kept (save on leaving any screen, New Game confirmation, purchase and stock sync, the unconfirmed cage-layout prompt, database return position, schedule detail and the battle leave confirmation).

A pasted addition, confirmed by the Owner for this round (「納入本輪」): write the local save automatically after important operations through the existing save entry, only in safe states and with coalesced writes; show only real save states (保存中／已存到本機／保存失敗) and keep manual save as a fallback; verify purchase, rename, cage confirmation, settlement, background and reload; design login, logout, account switching, sync status, first-login import and conflict flows as a developer preview only, never in the player flow; write an account/cloud plan. Until a cloud service exists there is no fake sign-in and no local save is labelled as cloud-synced.

This round is local implementation and verification only: 「本次不自動 commit、push、merge 或 deploy；不 reset、clean、不刪除既有成果、不覆寫我的正常存檔」, using an isolated browser and test saves; other agents' changes, assets and tests are kept; normal-entry flows are not replaced by developer jumps, and fixtures that prepare legal progress are labelled. Presentation changes under this entry are `OWNER_APPROVED_ADAPTATION` of presentation, not original evidence; the bounded Three.js highlight prop is approved by this entry. Accounts, cloud services, paid services and save-format migration still need the Owner's decision. Scope, evidence and results: [UI redesign report](../reports/ui-redesign-2026-09-29/REPORT_ZH_TW.md) and [account and cloud save plan](../planning/ACCOUNT_CLOUD_SAVE_PLAN_2026-09-29_ZH_TW.md).

## 2026-09-28 — Publish the page and flow integration to the public playtest

After the merge below, the Owner directs: 「請發佈到正式站」. Publish the page and flow integration merged into `main` at `fd6cb67` to the existing public-playtest destination in `public-playtest.r1.json`. This authorizes adding the batch's new first-party module `src/championship/app/uiDialog.js` to `WEB_BUILD_INPUTS.v1.json` and its public-playtest approval list, and refreshing the approved hashes of the 23 already-listed files the batch changed, once `build:playtest`, `validate:playtest` and the local gates pass. It adds no asset, destination or rights claim; physical-device, rights and commercial-release acceptance stay separate. No force push, rebase, reset or cleanup is authorized.

## 2026-09-28 — Commit and merge the page and flow integration to main

After the local page, flow and system-integration pass below was reported, the Owner directs: 「請commit提交push合併到main」. Commit this batch's own paths on `feat/ui-integration-2026-09-28`, push that branch, merge it into `main` and push `main`. The two files that also hold other agents' uncommitted edits (`championship.html`, `tests/championship-browser-opening.cjs`) are committed with this batch's lines only; the other 614 uncommitted entries stay in the working tree as found.

Deployment is not part of this instruction: the pass below left it for a separate instruction, and this one names commit, push and merge only. `WEB_BUILD_INPUTS.v1.json` is not refreshed and the new `src/championship/app/uiDialog.js` is not added to it, so the GitHub Pages run for this `main` push stops at `WEB_INPUTS_NOT_CLOSED` and the public playtest keeps the `c63f591` build. Later `main` pushes stop at the same check until the Owner asks for this batch to be published; the 2026-09-18 publication covered that batch only. No force push, rebase, reset or cleanup is authorized.

## 2026-09-28 — Whole-game page, flow and system-integration pass

The Owner asks for 「全遊戲頁面、操作流程與既有系統整合改善」: walk every existing player screen from the normal entry, list the problems with evidence, propose one overall page plan that fits the existing screens, then implement it in P0 → P1 → P2 batches with browser verification and before/after screenshots, without stopping at a proposal. Routine layout, component, existing-behaviour fixes and tests are in scope without per-item approval.

Keep the existing app, screen stack, session/store, single save authority and key, the one Pixi Application and ticker, DOM-for-UI / Pixi-for-play and bounded Three.js. Keep verified original gameplay; invent no numbers, evolution rules, capture odds or rewards; unknown original behaviour stays `UNKNOWN_REQUIRES_TRACE`. New gameplay, accounts or cloud services, save-format migration, a replacement technology or paid services need the Owner's decision. The forum images are inspiration only. Presentation changes made under this entry are `OWNER_APPROVED_ADAPTATION` of presentation, not original evidence.

This entry authorizes local implementation and verification only. Commit, push, merge and deploy are left for a separate instruction; no reset, clean, deletion of existing work, overwriting the player's save, or moving research material into the product. Scope, evidence and results: [page and flow integration report](../reports/ui-integration-2026-09-28/REPORT_ZH_TW.md).

## 2026-09-18 — Commit, merge the completed Cage work to main, and publish it

After reviewing the completed local Volcano animation repair and the inherited Raising/Cage convergence changes, the Owner explicitly directs: 「請COMMIT提交PUSH合併到MAIN」. Commit the coherent completed work in `championship-2026-convergence-20260916`, push its planning branch, merge it into `main`, and push `main`. Because the repository's existing GitHub Pages workflow publishes every accepted `main` push, this also authorizes refreshing the already-listed public-playtest hashes for the changed Cage/Raising files and publishing them to the existing destination in `public-playtest.r1.json` after the recorded local gates pass.

This supersedes the 2026-09-17 stop after the named planning branch for this completed batch only. Preserve the evidence labels: the pixel-match Volcano reconstruction does not prove the original CPU/VRAM binding; physical-device, foreground-occlusion, rights and commercial shipping acceptance remain separate. No force push, rebase, reset, cleanup deletion, unrelated asset addition or publication-target expansion is authorized.

## 2026-09-17 — Cage proof acceptance and bounded Raising/Cage wide layout

The Owner explicitly authorizes continuing the completed convergence handoff in `championship-2026-convergence-20260916`, on `planning/nexus-link-product-scope-2026-09-16`: technically accept the existing `field_cm01_01` contract/template/compositor, repair only concrete gaps, then minimally reflow the existing Raising/Cage screens at 390×844, 820×1180 and 1024×1366. Preserve compact quality, glass styling, scene proportions, input coordinates, selection and progress through repeated resizing. This is `OWNER_APPROVED_ADAPTATION` of presentation, not new original-game evidence.

Reuse the same app, router, store, save, DOM components, Pixi Application and ticker. No new cage/character art, other 39 cages, sprite factory, side-system, Battle/Habitat rewrite, Nexus app, Async PvP or broad screen redesign. Prior Creature readiness is carried forward only. Browser proof does not close physical-device or art/occlusion acceptance.

This batch explicitly permits focused implementation, self-review, relevant full/CI/preload/browser checks, exact-path staging, commit, push to the named planning branch, and updating Draft PR #2 plus concise acceptance evidence and the existing convergence entry. Preserve the prior report. No merge to main, deploy, force push, reset, clean, stash/drop or deletion. Stop after this batch; routine implementation/commit/push needs no repeat approval.

## 2026-09-16 — Rebuild Raising Home around the habitat

From phone screenshots of the public playtest the Owner directs: 「下面籠子格會偏移」, 「上方角色資料格能不能清楚簡潔比較現代游戲的設計感」, 「把上方儲存拿掉,因為工具列裡已經有儲存離開選項,未來也打算改成及時存檔跟帳號登入」, 「把最下面有尚未儲存的變更那格拿掉」, 「這樣整個籠子框架可以重新設計」.

Four options were put to the Owner, who chose: the resident readout becomes a card floating over the habitat; the session is written when the page is hidden, in place of the SAVE button; the habitat fills the frame's height and is panned sideways; and the batch goes to the public playtest once local verification passes.

Later the same day, from a reference image: 「那全遊戲介面風格配色先調整這樣看看」, with 「上方資料卡不要有底框,可能像你說的透明玻璃感」, 「春季 第一日 時間 那邊也是同樣的透明感」, 「下面工具列改成圓角膠囊」, 「數值可以直接顯示在那個長條計量條內」, 「還有些長條選項除了圓角外,也能做比較現在未來科技感的設計感嗎」 and, after a first pass, 「因為都圓角又變一堆膠囊」 and 「那個背景的圖我喜歡原來的 全遊戲的底圖背景先用原來的」. The restyle therefore keeps the original ground and puts the new look in the panels: one added stylesheet, `src/championship/app/daylightSkin.css`, linked last.

Scope: the Raising Home screen and its stylesheets, the ranch viewport transform, and the page-hidden save. No gameplay, save-format, rights or art-source change. Save & Quit in the toolbar's System menu is unchanged, and the traced lifecycle overlays keep their own screens. A real-time save and account sign-in remain a later decision.

## 2026-09-15 — Build team passwords before any online service

After a discussion of free hosting for uploaded teams, the Owner directs: 「好 先做 顯示我的密碼」.

Build the password-making half of Password Battle first; a shared team board, room codes and other online services remain a later decision. The original prints a team's code on its team panel. This build offers the code in the Password Battle screen for one to three owned Digimon, with the codec replayed against the original. It adds no storage key, account or network service. Publishing this batch still needs the Owner's go-ahead.

## 2026-09-15 — Publish the QA fixes and show the assembled UI cells on the public playtest

After a local review and QA pass, the Owner was told the 2026-09-13 assembled shop, cage-editor, HUD and evolution cells only render on localhost. The Owner directs: 「現在推上去新圖示也顯示」. The cells now render on the exact Owner-approved playtest destination in `public-playtest.r1.json`, the same host rule used by the other source-reference bundles. Publish the local QA fixes in the same push. Provenance stays `LOOPBACK_RESEARCH_ONLY` / `ROM_COPYRIGHTED_REFERENCE` with `publicReleasePermitted:false`; no rights evidence or commercial release is created.

## 2026-09-15 — Delete the merged research branch and art the game does not use

Owner directs: 「研究分支刪掉 順便查沒用到的圖,刪除重複的圖或用不到的圖」. The `research/digimon-design-synthesis-2026-09-14` branch was fully merged into `main` and has been deleted on GitHub. Art bundles that no runtime path loads were removed from the public playtest and from the repository. Repeated animation cells, which the manifests address one file per cell, were kept. See [Current Product Status](../CURRENT_PRODUCT_STATUS.md) for the exact scope and checks.

## 2026-09-15 — Integrate everything into main and publish the current build to the public playtest

Owner asks Claude Code to commit, push and merge all outstanding local work into `main`, and to change the rules if anything blocks it: 「所以現在這專案還有本地還沒COMMIT或PUSH 整合至MAIN的能請你處理嗎? 若有被擋就修改一下規則」. The Owner also directs that the `research/digimon-design-synthesis-2026-09-14` branch be merged: 「研究分之一起併」.

Offered two options, (A) publish the current build including the 2026-09-13 assembled-UI batch, or (B) merge without updating the public site, the Owner chose A: 「選A」. This supersedes the 2026-09-13 stop 「do not … publish this batch」 for the public playtest destination only. Scope: the 218 assembled-UI images and 7 runtime files added by `8f270dc` and `c8cd053` join `CHAMPIONSHIP_OWNER_PUBLIC_PLAYTEST_2026_09_10`, and the file `c8cd053` removed leaves it. The images keep `LOOPBACK_RESEARCH_ONLY` provenance, `publicReleasePermitted:false` and `shippingReady:false`, like the source-derived bundles already on the playtest. No rights evidence, commercial release or full-parity acceptance is created.

## 2026-09-15 — Original character and cage production first

Owner supplies a critique of the expanded launch plan and directs: 「這是CHATGPT給的建議 我想我們先完成原作內容的原創開發尤其在腳色跟棲地籠子」. Prioritize original-created characters and the existing game's cage environments while preserving the completed gameplay and finishing applicable original-content gaps. The current work is not the combined Habitat AI / offline lifecycle / dispatch / backend / async-PvP launch previously discussed. Those remain future candidates; the pasted author's alternative offline policy and roster counts are not automatically Owner decisions.

Implementation order for this scope: use existing animation and cage contracts, finish a small whole-character batch and the four starting cage definitions (35, 0, 1, 15), validate them in normal scenes, then expand the retained full production inventory. Do not wait for all 224 concept settings before validating the first complete character; this scheduling change applies to the new original batch without rewriting historical approvals or weakening individual art/motion/normal-path gates. Do not turn the trial batch into a reduced final roster. Current deliverables and limits: [original character/cage priority](../planning/ORIGINAL_CHARACTER_CAGE_FIRST_2026-09-15.md).

Keep the current DOM/Pixi/bounded-Three runtime. Blender is an optional offline art tool for reusable original masters; Godot, desktop shell selection and production backend provisioning are outside this batch. Preserve existing identities/choices as historical work, but do not relabel derivative remixes or source-reconstruction art as original-commercial acceptance. This direction does not authorize commit, push, deployment or shipping.

## 2026-09-13 — Integrate the assembled-art audit in sequential local batches

Owner approves starting the preceding assembled-art audit: 「自己分批完成一批結束後 再進下一批」. Batch 1 completes missing Shop/Hunt equipment pictures and dedicated cage previews. Batch 2 integrates useful original UI/HUD details into the existing portrait interface. Batch 3 checks remaining evolution/capture/recovery/reward presentation against existing events and source evidence, applying verified visual bindings and preserving unknowns. Finish with integrated local browser and regression acceptance. This is continuation authorization for the selected internal reference-art workflow; new source-derived images remain registered local research references, excluded from public authorization and commercial shipping. Do not copy the whole archive, redraw already-correct characters/maps, invent gameplay from an image, or publish this batch. Preserve the approved centered portrait frame.

## 2026-09-13 — Complete portrait-first orientation stabilization locally

Owner confirms the first landscape option: keep the existing 9:16 portrait game centered with empty sides when the phone is sideways; discuss a fully redesigned landscape interface later. Preserve character/ground proportions and gameplay. Complete this bounded stage with Skills and browser-plugin verification. The current session explicitly prohibits push, merge, deploy, rebase, reset or deleting existing work without authorization; earlier publication instructions do not authorize publication of this new batch. Record local acceptance separately from physical Safari acceptance and unresolved shop art, four-mode Battle wiring and cage-floor visual alignment. See `docs/reports/mobile-photo-repair-2026-09-13/直向優先階段驗收.md`.

## 2026-09-10 — Commit completed work, open repository and publish the game

Owner explicitly requests: 「請你把所有的完成的資料做好的資料全部都commit跟push至main。並且開放repo。讓我可以在網頁上就進行遊玩。」 Commit and push the integrated completed work to main, make `Orochi771127/championship-2026` public, and deploy the current game to its GitHub Pages URL. This supersedes earlier no-push/no-publication and loopback-only decisions for the selected rendered game files, as an Owner-authorized public playtest. Record exact reviewed input hashes under `WEB_BUILD_INPUTS.v1.json`; runtime destination is `src/data/championship/public-playtest.r1.json`. Keep ROM/native payloads, emulator states, private documents and credentials excluded. This instruction authorizes publication but does not assert a verified third-party licence, commercial-release acceptance, device QA or full original parity. Keep those facts pending and retain the separate verified-rights release target.

## 2026-09-10 — One continuing all-character behavior restoration stage

Owner asks to continue the earlier behavior corrections, verify whether every character and behavior is fully restored, and handle the remaining work in one stage. Continue source tracing, existing-owner fixes and normal-path acceptance under `docs/contracts/championship/CHARACTER_BEHAVIOR_RESTORATION_STAGE.v1.json`. Preserve the full Raising/Hunt/Battle scope; resource inventory and controlled helper coverage cannot close the stage. This is continuation authorization, not a new approval gate.

## 2026-09-10 — Complete the video comparison findings in one repair stage

Owner: 「延續話題,這些請你用一個階段修復跟做完,可以嗎?」. Complete the seven findings in `docs/reports/parity-audit/2026-09-10/VIDEO_GAME_ANIMATION_COMPARISON_ZH_TW.md` as one implementation and acceptance stage: original request continuity, Raising needs/reaction icons and hand interactions, character status presentation, Hunt tool art, battle results and the integrated 9:16 layout. Continue original ROM tracing where needed; preserve existing authorities and original gameplay. The existing internal-reference authorization and final public-release licence gate continue to apply. Do not mark the stage complete on resource coverage or isolated tests alone.

## 2026-09-09 — Integrate original character animations in Hunt, Battle and Raising

Owner requests all original character motions in the three existing scenes and supplies `YDIJ_PRIVATE_ROM_ART_PACK/02_CHARACTERS`. Continue internal animation integration using those existing reference materials, the verified native frame/state contracts and the current scene owners. The supplied 503 atlas PNGs already match the registered 224-entry baseline; this authorization does not require duplicate resource copies. Preserve source sequence IDs, timing, origins, flips and intentional blanks. Full resource/frame binding and full original action-trigger parity are separate acceptance statements. Licence verification remains at the final public-release gate.

## 2026-09-09 — Prefer original Hunt steering behavior

After approving a proposed keep-current-direction workaround, Owner asks 「不能照著原作去做嗎？」. The workaround was not applied. Continue tracing the original live stack producers and call order before adopting an adaptation; retain the original-fidelity priority. Synthetic stack probes alone do not establish the normal producer.

## 2026-09-09 — Complete the current remaining inventory in at most two stages

Owner: 「目前還沒做好的項目，請你最多兩個階段完成」。Complete the current checkpoint inventory within two execution stages: playable flows and fault correction, then final content and release acceptance. Continue between them without another start approval. Rights verification remains at the final release gate; unknown original behavior requires tracing or explicit bounded adaptation approval. See [the current two-stage execution record](../reports/commercial-readiness/2026-09-09/TWO_STAGE_COMPLETION_ZH_TW.md).

## 2026-09-09 — Commercial readiness engineering; licence verification deferred

Owner requests the four priority commercial-readiness issues in one stage, then asks: 「如果沒授權的話怎辦」 and 「能把授權留到最後嗎？」. Continue the authorized internal engineering and acceptance work along the existing faithful-rebuild direction. Schedule formal licence-document verification at the final public-release gate; do not require the document to perform internal build/test work, infer an original-IP conversion decision, or mark a pending document verified. Internal review, gameplay completion, asset approval and public distribution remain distinct. The user has not authorized publishing. The current engineering record is [the deferred-rights build report](../reports/commercial-readiness/2026-09-09/DEFERRED_RIGHTS_ENGINEERING_ZH_TW.md).

## 2026-09-09 — Finish lifecycle and opening in two stages

Owner: 「還有遊戲一開始的引導教學，以及遊戲一開始的畫面就是點選開始遊戲或者是繼續遊戲畫面的風格跟原遊戲也不太一樣這些都分兩個階段就要完成」. This extends the immediately preceding lifecycle stage. Stage 1 closes schedule registration/cancellation, entry and championship results/rank/calendar persistence, morning message order/effects, opening tutorial control flow, and Home reconstruction/RNG comparison. Stage 2 closes title/login/start/continue presentation, tutorial and training presentation, sound, form-pair checks, and browser/device acceptance. Continue between these two stages without another approval request. Both stages retain the existing product authorities and require original ROM/video evidence; an unavailable physical phone remains an explicit external acceptance boundary, never a simulated pass.

## 2026-09-09 — One lifecycle stage

Owner requests ROM and video verification plus evolution conditions/presentation, complete waste generation, sleep and overnight growth/food, and the original day-change transition in one stage. These remain one bounded lifecycle stage; no additional approval is required for work within that scope. [Current implementation and acceptance](../research/RAISING_LIFECYCLE_STAGE_2026-09-08.md) distinguishes the integrated normal flow from unresolved championship calendar flags, complete morning notices, full-scene differential and audio/device acceptance. Do not mark the whole original stage complete while those gates remain open.

## 2026-09-08 — Finish the proposed Feeding slice in one stage

Owner: 「OK 開始吧 一個階段就請你做好完成」. This accepts the immediately proposed Home native position / Cage membership / actor state -> food placement -> approach/eating -> individual and inventory Save/Continue slice. Implement and accept that normal playable flow in one stage using the existing authorities. This does not rename the entire Raising system or whole game complete. Completion, evidence and remaining original lifecycle boundaries are recorded in [the Feeding stage report](../research/RAISING_FEEDING_STAGE_2026-09-08.md).

## 2026-09-08 — Complete the open current-stage work

Owner:「把那些未完成的 這個階段都做完」。This continues the existing two-stage authorization and is not a new approval gate. Original starter/hatching/persistent book work is now implemented; verified care/growth helpers must not be described as playable care while native Cage/position/state callers remain incomplete. Overall status remains PARTIAL. Current evidence and explicit remaining work: [Raising continuation](../research/RAISING_NATIVE_CONTINUATION_2026-09-08.md).

Repository authority: `CHAMPIONSHIP_2026_PRODUCT_SSOT` (`.`).  
Migration state: standalone product; historical Nexus integration decisions are preserved below as superseded/frozen context only.

Authority: **OWNER ONLY**  
Historical header (superseded by the later dated entries above): **2026-09-08 — begin the continuation of the ROM/video/current-game audit in two implementation stages**

Agents may index this file and may transcribe a later explicit Owner directive,
but may not reinterpret or independently change product direction.

## 2026-09-08 — Implement the audit continuation in two stages

Owner: **「好的 請按照延續話題的部分開始開工,請分兩個階段就要做好」**. This follows the ROM, supplied Bilibili video, art-pack and current-runtime audit. Proceed with implementation and verification using the existing authorities. Stage 1 addresses original rules and the playable capture/individual/raising/battle chain; Stage 2 addresses content, art integration, regression, contracts and mobile acceptance. These are work stages, not repeated approval gates. Read and trace unresolved original behavior rather than inventing it. Record completed portions separately from remaining gameplay, art and device gaps; do not relabel a partial stage complete. Preserve shared work and existing release boundaries. Current work record: `docs/reports/parity-audit/2026-09-08/TWO_STAGE_IMPLEMENTATION.md`.

## 2026-09-08 — Bounded scatter Shot bug correction

After the assistant proposed replacing scatter Shot's uninitialized event response byte with ordinary Shot's species response, while retaining seven pellets, offsets, RNG order, cooldown, consumption and stun conditions, the Owner replied: **「好的請開始開工」**. Apply that exact correction in normal Hunt. Classify this byte initialization as `OWNER_APPROVED_ADAPTATION`; the original uninitialized-stack behavior remains documented and is not relabelled `ROM_VERIFIED`. This does not authorize other gameplay redesigns or alter art, device QA or shipping status. Continue within the existing second stage.

## 2026-09-08 — Hunt core and all tools in at most two stages

Owner: **「延續話題，請你最多兩個階段把這套核心玩法給做完，包括每個道具的使用。如果有不懂的就請你回去找Rom 內容。」** Implement the verified original Hunt flow through the existing normal entry and authorities. Stage 1 connects Rope drawing/binding/pulling/breakage, original target reactions/down/hand/card and Result/Home/save. Stage 2 completes all Shot/Wire/attraction/damage-trap items and information/capacity tools, with consumption, invalid placement, effectiveness, expiry and normal-play regression. Resolve missing semantics from original ROM evidence rather than prototype values. These stages are implementation and acceptance work, not further approval gates; progress without requesting repeated start permission. Preserve the original functionality, existing mobile presentation direction and shared work. This request does not change public-release or art-rights status.

## 2026-09-08 — Complete remaining battle move presentation

Owner: **「你說:所有招式的完整演出仍未全部完成。請你這一次就全部弄完,因為還有很多要處裡的不能一直停在這裡」**. Continue implementation and validation in the existing battle using the supplied source material. Avoid repeated small planning-only stages and generated substitutes for available original effects. R13 covers original sequence/prelude/primary/auxiliary execution, native geometry, special engagement, secondary and earth impacts, battle sound lookup/playback and cleanup. The same loopback research exception applies to the prepared original battle one-shot audio bundle; no public distribution, license, device acceptance or original full-match acceptance is authorized or inferred. Controlled execution of all scripts must remain distinguishable from normal AI and visual acceptance of every move.

## 2026-09-08 — Use supplied original battle effects for local comparison

The Owner asked whether the supplied ROM art pack already contained move effects and whether the assistant had generated the R11 pictures. After the assistant confirmed both and proposed prioritizing the supplied original effects, resolving the local-version boundary and completing their existing bindings, the Owner replied: **「對,請處理好」**.

For this correction, use the supplied original effect PNGs with their native cell origins and existing animation timeline in the local research preview. Stop using the independently generated R11 effect pictures as the default. Keep the existing gameplay, pool, render layer and ticker. This is a bounded local-use direction; it is not a new license or public-release authorization. The prepared reference bundle lives under the already-public-build-excluded `assets/production/internal-faithful-baseline/battle-effects-v1`, is loopback-only and is explicitly `publicReleasePermitted:false`, `shippingReady:false`, and `humanApproved:false`. Do not fetch the private backup archive directly from the game or change other character/art programs.

## 2026-09-06 — Whole-roster creature identity transformation and parallel start

Owner example: 「我舉個例子像這樣就把它貓化或者是可愛大眼化，犬化 ，龍人話、獸人化」, followed by 「好，那請你開始開工」. The subsequent explicit steering is: 「我覺得你可以盤點全部有的角色後，把全部都開始做了，不要每次都只做M 201」.

Continue the native-pixel, source-motion-preserving appearance program across all 224 actual entities. Apply the requested feline, canine, large-eye, dragonfolk and beastfolk design directions per body type; routine selection and repair remain delegated. Do not require M201 completion before other characters start. Keep source-reviewed design briefs, actual new drawings, representative-pose acceptance and whole-motion/runtime replacement as separate statuses. Existing Owner-selected first-four identities and gameplay boundaries remain in force.

## 2026-09-06 — Pixel workflow revision and complete-roster automatic replacement

Latest continuation: the Owner asked whether completing all 224 single-character designs before full motions would be more efficient and consistent, then explicitly directed: 「請開始自動開工，每一階段完成請自我審查沒問題再進入下一階段。」 Proceed with the revised sequence in pixel-v2/PLAN.md: representative body-type setting/pose checks, complete-roster pixel settings, then full per-entity animation packs and verified replacement. Self-review each stage, repair actual issues, and advance only after its checks pass. Routine stage progression does not require another permission request; pending art or normal-game/device evidence must not be labelled passed.

The Owner selected original-grid pixel art instead of HD hand-drawn art, then explicitly requested implementation of the revised plan. Use editable indexed-pixel masters, one shared normal palette (up to 15 visible colors plus transparency), exact whole-image reuse, evidence-backed linked pixel patches and the original animation tables. Stop independent per-frame image generation. Preserve M201 A / M001 B / M226 B / E000 A as identities adapted to pixels; retain earlier HD candidates as history.

The Owner explicitly requires changing the appearance of **every entity in the folder** and automatically replacing each complete verified entity. The remembered number 284 was corrected by the Owner to the actual audited count: **224 = 216 regular + 8 eggs**. All 56 four-entity packets are required, not only representatives. Continue delegated design selection and repair. No repeated per-entity replacement instruction is required after the whole-entity art, motion, technical, normal-path and registration gates pass. Record delegated review separately from actual human/device checks; do not fabricate QA. Gameplay and public-release boundaries remain unchanged.

Current plan and coverage requirements: `docs/art/production/characters/appearance-refresh-v1/pixel-v2/PLAN.md`, `policy.json`, and `production-queue.json` in the same directory. The following HD wording is historical and superseded only for art style, production method and repeated final replacement instructions.

## 2026-09-06 — Implement the 224-character appearance refresh plan (historical HD method)

Subsequent explicit choices: **M201 A, M001 B, M226 B, E000 A**. The Owner then delegated subsequent design selection to the assistant: choose the options less likely to produce errors and continue automatically. Preserve these four choices. The art director records each later decision and prefers source-compatible topology, stable identity through extreme poses, simple color regions/materials and no added moving ornaments. Routine option selection and production iteration no longer require a separate Owner response; technical, motion and normal-path checks remain required. This does not authorize new gameplay or public release.

Transcription of the Owner's explicit implementation request: redesign each entity individually, without a cat/dog quota; use clean-outline HD hand-drawn artwork; submit two concepts per entity in groups of four. Preserve every source Main/Sub key, sequence, frame reference, duration tick, raw playback mode and verified pose landmark. Do not add frames, impose a new FPS, or recenter each frame independently.

First review: M201, M001, M226, E000. Finish M201 end to end before completing the other three. Second review: M222, M228, M352, M431. Keep all 224 entities tracked in their original seven groups of 32. The approved workflow is in `docs/art/production/characters/appearance-refresh-v1/program.json`.

Use Multi-Agent V2 with isolated candidates and one root integrator. Owner design selection precedes full production. A complete entity can become the normal default after the separate art, motion, package and normal-path checks and Owner final visual review. Reuse the existing roster, species bindings, actor creation and disposal. Do not add a player skin menu, save format, router, store or ticker.

For this appearance-refresh program, ROM/source pixels remain research references; new drawings are registered through the existing production index. Existing source bundles and historical evidence are preserved. Unbound normal action events remain explicit gameplay dependencies and cannot be invented by art production. Public release remains a separate status.

## 2026-09-02 — Licensed pixels as runtime materials; production index is the unique rights source

The Owner directed that Championship 2026 is a licensed remake and that
decoded original pixels may be used as game materials, not only as layout
contracts. Private-viewing / non-distribution labels on the ROM art pack were
applied in error and are withdrawn.

Unique runtime rights authority is `assets/production/ART_PRODUCTION_INDEX.json`.
A bundle is runtime-eligible only when it is copied under `assets/production/`,
listed in that index, and declares `runtimeEligible: true`. The research pack
(`YDIJ_PRIVATE_ROM_ART_PACK`) remains a backup and must not be fetched by the
game. Shipping still requires human visual QA; `shippingReady` stays false until
that QA is recorded.

First bounded batch: Hunt tutorial field `field_hm00_01` (`HUNT_TUTORIAL`). Do
not treat hm00 as a 17th Gate biome. Do not embed RAW collision/encounter tables
in art bundles. Do not mount unused ROM families (`gate_select/earth`,
`desktop/Desktop_Launcher`). UI keeps Championship Modern DOM; NXR JSON is a
layout contract, with optional icon cells rather than full DS-screen paste.

Later Hunt maps, Cage, Battle fields, characters, and VFX follow the same copy →
runtime manifest → index path. Collision, capture, battle arithmetic, and save
truth stay with existing runtime authorities.

## 2026-09-01 — Motion-compatible cat/dog 224-slot creature remix

The Owner explicitly requested a redesign of all 224 character slots using the
previously discussed cat-and-dog direction. The Owner then clarified that each
design should be a substantial remix of its corresponding original creature so
the existing action artwork is less error-prone to reproduce. Cats and dogs are
the majority; valuable other creature species may remain. The character style
retains a lightly hand-drawn quality.

The remix therefore preserves motion-compatible anatomy, pose topology,
grounding, animation slots, frame timing, and collision while changing breed
anatomy, face, ears, muzzle, coat, tail, markings, and selected ornaments. This
is an internally authorized licensed derivative presentation, not a claim that
adding cat/dog elements alone creates an unrelated clean-room character.

This is a presentation-pack direction. It does not change stable simulation
IDs, evolution results or conditions, battle, capture, Raising, progression,
economy, or save truth. The faithful internal baseline remains available as a
development fallback while the licensed remix roster is designed and reviewed.

## 2026-08-30 — Option A default skin, logic-first, skinnable

The Owner confirmed:

- Default public visual family is licensed faithful remake (Option A). Cat/dog
  anatomy from the 2026-08-29 art-production amendment is a later alternate
  presentation pack, not the current production line.
- Visual style is not a single locked shipping look. Simulation IDs, the screen
  stack, and presentation slots stay stable so packs can swap without forking
  gameplay.
- Translate original gameplay and architecture into JavaScript first. Art binds
  through presentation packs. Do not wait for 224 sprites, and do not ship ROM
  payloads.
- Unknown original formulas stay neutral. Do not invent care numbers, capture
  odds, per-species G-cost tables, hit/miss, or TP as original truth.

This direction does not change renderer boundaries, save truth, or the
shape-aware Cage requirement.

## 2026-08-29 A1 map-direction approval

The Owner explicitly approved the A1 `cage-12-module-direction.png` board as the
visual direction for the Cage/Training modular terrain, and approved the paired
`hunt-hm01-hm09-direction.png` board as the visual direction for the Hunt large
maps. The next bounded batch is authorized to technicalize these two directions.

This approval permits deterministic review crops, stable asset IDs, source-hash
locking, layer contracts, anchors, and map-production specifications. It does
not invent Cage footprints, raising effects, collision, spawn, ATR/ESC, or other
unknown gameplay semantics; it does not make a flattened concept board a native
layered master; and it does not promote any file to runtime or shipping status.

The Owner subsequently directed work to continue. This authorizes the bounded
transparent-master pass for the same twelve approved Cage modules. It does not
expand the batch to all forty visual fields, reconcile the forty visual fields
to the thirty-six verified `CageDefinition` records, or authorize runtime use.

The Owner subsequently authorized the next Cage step, requested classification,
and explicitly authorized commit and push after successful QA. The Owner also
directed the remake to inspect and follow the original Cage terrain construction.
The verified production interpretation is core tile field plus separate object
bundle and separate ATR/COL data; a guessed four-way split of flattened concept
art is not authoritative. Full visual production is scheduled as four batches
of ten actual fields (CM01–CM40), while the twelve concept modules remain a
pipeline and style pilot.

The Owner then directed work to continue according to those results. This
authorizes the bounded CM01–CM10 clean-room visual review packet using separate
core-field and object-bundle art. It does not authorize invention of placement,
ATR/COL meanings, Raising effects or runtime promotion.

The Owner rejected the generated CM01–CM10 object staging because its positions
did not match the original. The current Cage authority supersedes that packet:
reproduce original art, composition, object positions, collision and art code
100%, changing only resolution to HD. Do not recolour, redesign, replace props
or manually reposition them. Preserve raw NBS/OPM/ATR/COL values. CM12 and CM18
were resolved by the original OPMD → NANR → NCER decode chain; preserve that
verified sequence binding and do not replace it with direct-cell guessing.

The Owner then identified that the lower-row penultimate CM09 review image was
visually incomplete. Inspection confirmed that the static clean archive omitted
the original `field_cm09_01_anim` BSAR/NCGR/NCLR water layer. Restore every
verified native Cage animated terrain layer rather than presenting transparent
holes as a complete result; retain intentional blue-edged irregular cut-outs.

## 2026-08-29 art-production amendment

The Owner explicitly approved the previously proposed art plan for implementation with these decisions:

- use the licensed faithful-remake route; the Owner reports that complete rights have been obtained, while each production promotion still requires a linked licence document reference;
- preserve original structural identity, topology, composition and hand-drawn character while rebuilding high-definition production masters rather than shipping enlarged ROM payloads;
- make the roster cuter and use real-world cat and dog breed anatomy as the majority visual vocabulary, while retaining valuable bird, fish, insect, plant, machine, spirit and giant-creature silhouettes;
- preserve each source asset's major palette family for the current production pass; create remake distinction through changed anatomy, silhouettes, proportions, markings, props, terrain contours, materials and 2026 rendering quality. Palette replacement remains optional future work, not a current requirement;
- keep the overall presentation fresh and bright; only maps whose original role is dark should remain dark, and even those retain readable walkable surfaces and controlled reflected light;
- target a 96-character launch roster, then four post-launch packs of 32 to reach all 224 slots;
- lock the launch mix at 32 cats, 28 dogs, 32 other species and 4 eggs; lock the full-catalog mix at 72 cats, 64 dogs, 80 other species and 8 eggs;
- retain the function-first sequence and permit only the bounded A1 Golden Art Slice before mass production.

This amendment changes content and art direction only. It does not change gameplay authority, renderer boundaries, save truth, the shape-aware Cage requirement, or the rule that unknown behavior remains neutral.

The 2026-08-30 Owner direction supersedes the cat/dog majority-vocabulary and
launch-mix bullets as the *active* default skin. Those roster-mix numbers remain
recorded as a later alternate presentation pack, not as current production.

## Current product authority — Championship 2026

### 2026-09-01 internal production authorization and skin-pack boundary

The Owner directed the project to continue under
`OWNER_AUTHORIZED_INTERNAL_PRODUCTION / FORMAL_DOCUMENT_LINK_PENDING` until the
complete faithful presentation can be reviewed as a whole. Public release and
shipping approval remain separate gates.

The product is to use a replaceable presentation-pack architecture. The
faithful Original Championship reconstruction is completed first; later visual
changes, including the previously discussed cat/dog presentation, are separate
skins over the same stable gameplay identities and are not the active batch.

The Owner further directed that whole-game functional completion must not wait
for final art review. During internal development, the 2026 mobile game should
bind the faithful Original baseline directly rather than adding a separate
user-facing pack loader. Safe temporary presentation remains only as a fallback
for slots that have not yet been connected. The internal baseline is excluded
from public release and must not commit ROM or Nitro source payloads. After the
complete game can be reviewed end to end, the Owner will decide which
presentation-pack elements to retain or replace.

Public release remains the eventual production target, but the project is not
near release and will not publish immediately after functional completion. The
Owner therefore directed that licence-document closure must not block current
internal game completion. Internal candidates remain non-public and release
classification is revisited at the later release gate.

Translation from NDS to browser and all recovered Original Championship
behaviour semantics must remain faithful to the original evidence. A
presentation pack may replace characters, UI, maps, VFX, 3D and packaging, but
must not change simulation IDs, damage, AI, capture, collision, Raising,
progression, rewards, economy or save truth. Verified behaviour is preserved;
partial evidence preserves only the known structure; unresolved behaviour
remains `UNKNOWN_REQUIRES_TRACE` rather than being invented.

### 2026-09-01 faithful full-roster and completion directive

The Owner explicitly directed the art lane to complete the Original
Championship presentation in this order:

- first complete all 224 default characters as faithful high-definition
  reconstructions in seven batches of 32;
- preserve Main/Sub identity, original major palettes, the hand-drawn visual
  character and every original animation state, with consistent transparent
  bounds, ground anchors and PixiJS atlases;
- keep the previously discussed cat/dog variants as later replacement skins,
  not the default roster;
- continue the complete 96-scene UI/HUD in original screen order with a modern
  portrait 9:16 layout;
- batch-convert and progressively integrate the ROM-observed VFX;
- finish battle maps, final Gate 3D and release packaging last.

This latest explicit directive supersedes the earlier launch-96 roster split
and the synchronization-only production freeze for this art work. It does not
waive licence-document linkage, human visual approval or runtime QA before
promotion into `assets/production` or shipping.

- One human Owner plus AI will first complete all game systems, modes and the New Game → Championship loop with IP-neutral stable IDs and original-neutral temporary content.
- Final public branding, original creatures, world, art, text and audio are selected after the functional-completion gate; the public product does not ship Digimon names, characters or source media without rights.
- The original Cage/Training mechanic is a required shape-aware spatial assembly system: functional terrain pieces have specific footprints and affect different raising values. Exact untraced shapes, rules and values remain evidence-gated.
- `docs/README.md` is the documentation entrance; `docs/CURRENT_PRODUCT_STATUS.md` indexes current integrated `main`. Earlier coordination snapshots remain provenance and do not override later committed source/tests.

- Target product: `DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD`.
- Delivery target: standalone, web-first, mobile-first, portrait 9:16,
  touch-first, with desktop-browser compatibility.
- Nexus Link integration is `FROZEN / OUT_OF_CURRENT_PRODUCT_SCOPE`. Historical
  Nexus decisions remain recorded but are superseded for the current product.
- `ROM_VERIFIED` Original Championship gameplay is `DEFAULT_PRESERVE`.
  `PARTIAL` preserves its known structure, `UNKNOWN_REQUIRES_TRACE` remains
  neutral, and only `OWNER_APPROVED_ADAPTATION` may intentionally change
  gameplay.
- Modernization may update renderer, resolution, responsive layout, controls,
  loading, save infrastructure, animation technology, asset resolution, VFX,
  accessibility, mobile UX, performance, and packaging. It must not silently
  redesign auto battle, Hunt tether/circle capture, the contextual toolbar, or
  Raising systems.
- Renderer authority: DOM for UI/menus/panels/toolbar/text; PixiJS for playable
  2D fields/creatures/sprites/VFX; Three.js only for verified or explicitly
  Owner-approved bounded 3D scenes. No React rewrite, second global
  router/store/save/ticker authority, or Nexus-specific gameplay dependency.
- INT-RH2 Raising Home is accepted as the first Championship 2026 playable
  baseline. Its current environment and creature visuals remain temporary.
- Development proceeds by vertical slices: VS1 Raising Home; VS2 Gate Select to
  Hunt exploration and return; VS3 Capture/Result; VS4 Training/Cage/Shop/
  Database; VS5 Battle Setup/Auto Battle/Result; VS6 progression/save
  integration; VS7 production art/animation/VFX/audio/packaging.
- Original decoded art remains `ROM_COPYRIGHTED_REFERENCE / RESEARCH_ONLY` and
  must stay separate from 2026 production assets.

> Historical batch applicability: the documentation-only/VS2 restriction below belongs to the standalone migration reconciliation. Later 2026-09-08 through 2026-09-13 continuation entries supersede it for their named work; retain the original record for provenance.

- The current authorization is documentation reconciliation only. Stop after
  updating coordination/integration documentation; it is not a VS2
  implementation GO.

## Coordination authority

> Historical location/precedence wording below describes the pre-migration shared repository. Current coordination lives at this repository's `docs/coordination/`; Nexus Link is outside product scope. Owner direction controls permitted changes, not historical ROM facts or proof of rights. The current authority-by-question and shared-file documents linked above govern those questions.

- The canonical coordination root is `docs/coordination/championship/` in the
  formal NexusLink repository.
- Chat history is not project-progress truth. Claude Code and Codex Art must
  synchronize through the repository coordination SSOT.
- Owner product decisions override runtime evidence and presentation/art truth.
- `CHAMPIONSHIP_MASTER_SYNC.md` is a human-readable index and status summary;
  it never replaces source reports, manifests, tests, Git state, or evidence.

## Ownership

> The named status-file ownership remains protected. Historical runtime/art lane assignments below describe that collaboration; the current explicitly authorized task defines an agent's work scope. Agent identity cannot determine gameplay evidence or grant another agent's status-writing rights.

- Claude Code exclusively owns `CLAUDE_REBUILD_STATUS.json` and
  `CLAUDE_SYNC_DELTA.json`, plus the runtime implementation/reconstruction lane.
- Codex Art exclusively owns `CODEX_ART_STATUS.json` and
  `CODEX_SYNC_DELTA.json`, plus the art/presentation lane.
- Neither agent may overwrite the other agent's status file.
- Codex is the single merge writer for Master Sync, Dependency Matrix, and
  Blocker Ledger. That role is coordination-only and grants no gameplay or
  Owner authority. Shared coordination files may be updated only from verified
  repo evidence and both owned deltas.

## Historical Cursor → Claude Code handoff (2026-08-31)

> Arithmetic-only/no-BATTLE restrictions and the not-started status below describe the 2026-08-31 handoff. The 2026-09-08 battle continuation and later stage records supersede that restriction for authorized existing Battle work. Unproven hit/miss, TP or Sense semantics remain evidence-gated; this note does not invent them.

Cursor left battle **arithmetic only** (not a BATTLE screen) for Claude Code
to **review first, then continue** from original ROM numbers.

- Canonical brief: `docs/coordination/CURSOR_BATTLE_ARITHMETIC_HANDOFF.md`
- Serena: `mem:core` and `mem:claude-code/battle-arithmetic-handoff`
- Product files: `src/championship/battle/{battleDamageCore,battleDamageResolver,battleSupport,battleStatus}.js`
- `CLAUDE_REBUILD_STATUS.json` still records `BATTLE_RUNTIME` as not started
  until Claude Code reviews and updates it. Cursor did not overwrite that file.

Gameplay truth belongs to Claude/runtime evidence. Presentation and art truth
belongs to Codex Art. Unknown gameplay contracts require neutral presentation;
missing art does not authorize Claude to invent visual production authority.

## Required synchronization

> Applicability: the batch-wide sequence below is retained as the historical synchronization workflow. Today it applies when performing shared coordination or a handoff, using [the current protocol](SHARED_FILE_UPDATE_PROTOCOL.md). Read-only audits and unrelated small edits do not open a sync round or update statuses.

Before each bounded batch, record Git status, branch, and HEAD, then read this
direction, both agent status files, the Master Sync, Dependency Matrix, and
Blocker Ledger. When an owned file is absent, record it as not reported; do not
infer its content.

At the end of each bounded batch, the responsible agent updates its own status
with completed/current/blocked/outputs/checkpoint/dependenciesChanged/
recommendedNext. Shared blocker, decision, and dependency files change only
when the underlying fact changes.

Owner/QA-approved bounded work should receive a recoverable local checkpoint.
A commit is not a merge, shipping promotion, or deployment.

## Historical synchronization-only gate — SYNC-2

> This gate belongs to the recorded SYNC-2 round. Master Sync records a later syncRevision 3, and subsequent dated Owner entries authorize further bounded work. Do not copy `syncRevision: 2` or the STOP below into a new task. Preserve the unchanged-base-hash, stable-ID, validation and ownership protections in the current protocol.

SYNC-2 may run only after both local checkpoints, both owned status updates,
both owned deltas, the Claude-owned toolbar contract, and CL-007 hardening are
present. The merge writer must re-read and hash each shared file, merge by
stable record ID, validate a temporary output, atomically replace only when the
base hash is unchanged, and record `syncRevision: 2`.

This round remains `SYNC ONLY`:

- Claude Code updates its own runtime status and runtime architecture.
- Codex Art updates its own art status.
- Shared Master Sync, Dependency Matrix, and Blocker Ledger are then reconciled.
- No new production batch starts in this round.
- Complete the synchronization and **STOP FOR OWNER REVIEW**. Do not start O2,
  O4, P3-P6, a new environment, gameplay phase, or reverse batch.

## Historical art direction carried into the synchronization round

- O1 Original UI: complete and Owner-approved reference baseline.
- ART-R2R Character Fidelity Pipeline: Owner-approved reference baseline.
- Training/Cage: 40/40 core recovered; 40/40 full composition confidence.
- Hunt: 16/16 biome representative coverage.
- Battle: 11/11 static field coverage; Owner-approved reference baseline;
  BM03/BM04 animation placement/timing remains unknown and non-blocking for the
  static archive.
- ART-R4 VFX/3D representative baseline: complete and Owner-approved reference
  baseline.
- ART-P1R Modern UI: Owner-approved production standard; not shipping-ready.
- ART-P2/P2R Modern Environment: technical/visual proof retained; no automatic
  production-standard or shipping promotion.
- P3-P6 and further modern original production remain frozen.


## 2026-10-18 Music default, lifecycle and field repair

Owner explicitly requested public release of Quiet Evening Training as the Raising default, preserve explicit player selections, conservative all-track audio repair, stable pitch/rate after foreground return including iPhone/PWA, and existing specified field songs in combat and new modes. Four exact Owner Downloads tracks are assigned to island/south pole/desert/hell. Owner delegated the two Data Arena assignments: paired Harbor survival uses Unison Under Fire; Tournament uses Federation Siege, recorded as reversible inference without human listening. Grass/volcano retain current cues pending earlier dedicated-file identification. See docs/reports/music-repair-2026-10-18/REPORT_ZH_TW.md, all 26 encoded-file measurements and 53 route inventory. No new generation, paid service or source modification; listening and physical iPhone acceptance remain pending. Preserve current Dex/icon/viewport changes; normal main integration only, no force push or unrelated PR56.
