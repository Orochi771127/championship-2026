# Codex Handoff — 2026-09-16 產品／美術／Cage／Adaptive UI 收束

用途：可直接貼給 Codex。  
目標：先驗證 Repo current truth，再收束文件，最後只落地最小必要 proof；**禁止把 Nexus Link 另做成第二款遊戲。**

---

## 可直接貼給 Codex 的指令

```text
你現在在 Windows 本機的 repository `Orochi771127/championship-2026` 工作。

這次不是重新規劃一款新遊戲，也不是把 Nexus Link 另開專案。
你的任務是：把 2026-09-16 已經寫入 GitHub planning branch 的產品、美術、Cage/Habitat、iPad/Fold 設計，先與目前 repo source/tests/evidence 做交叉驗證；修正不正確之處；去掉重複與過度設計；最後把最小、可重用、直接建立在 Championship 2026 上的基礎 proof 落地。

==================================================
0. 安全與 Git 狀態
==================================================

先執行並回報：

- git status --short
- git branch --show-current
- git remote -v
- git log --oneline --decorate -n 12

然後：

- git fetch --all --prune
- 確認 `origin/main`
- 確認 branch `origin/planning/nexus-link-product-scope-2026-09-16`
- 確認 Draft PR #2

若 working tree 有未提交工作：
- 不 reset
- 不 checkout 覆蓋
- 不 stash/drop 未確認工作
- 先列出衝突與安全方案

不要 force push。
不要直接 merge PR #2。

==================================================
1. 不可違反的 Owner Direction
==================================================

Nexus Link / 原創商業版必須「原地演進」於現有 Championship 2026。

禁止：
- 第二個 app
- 第二個 src tree 當新遊戲
- 第二套 router
- 第二套 save
- 第二個 Pixi Application
- 平行 Battle core
- 平行 Habitat simulation truth
- 因為世界觀、美術、命名不同就重寫 Raising/Hunt/Battle/Cage
- 將 Godot/Unity/Phaser 等變成 replacement runtime

正確模式：

inspect existing subsystem
→ identify reusable authority
→ adapt / extend
→ preserve parity tests
→ progressively replace content / presentation

如果你認為某 subsystem 必須重寫，先 STOP 並提供：
1. 現有 subsystem 無法承載的具體證據；
2. 哪些 tests/contracts 被卡住；
3. migration/save risk；
4. 最小替代方案；
5. Owner decision needed。

==================================================
2. 必讀順序
==================================================

先讀 repo authority：

1. AGENTS.md
2. docs/README.md
3. docs/planning/CHAMPIONSHIP_2026_MASTER_GAME_PRODUCTION_PLAN.md
4. docs/planning/CHAMPIONSHIP_POST_PARITY_MODERNIZATION_PLAN_ZH_TW.md
5. docs/planning/CHAMPIONSHIP_2026_MODULAR_CAGE_SYSTEM_SPEC_ZH_TW.md

再讀 2026-09-16 收束入口：

6. docs/planning/NEXUS_LINK_PRODUCTIZATION_CONVERGENCE_INDEX_2026-09-16_ZH_TW.md
7. docs/planning/NEXUS_LINK_IN_PLACE_PRODUCTIZATION_PLAN_2026-09-16_ZH_TW.md
8. docs/planning/NEXUS_LINK_ART_PRODUCTION_WORKFLOW_2026-09-16_ZH_TW.md
9. docs/planning/CAGE_ART_REPLACEMENT_CONTRACT_2026-09-16_ZH_TW.md
10. docs/planning/CAGE_AUTHORING_TOOLCHAIN_WORKFLOW_2026-09-16_ZH_TW.md
11. docs/planning/NEXUS_LINK_ADAPTIVE_LAYOUT_STRATEGY_2026-09-16_ZH_TW.md

接著讀 Cage current truth：

12. src/championship/cage/ranchSlotGeometry.js
13. src/championship/cage/ranchTileComposition.js
14. src/championship/cage/nativeRanchLayout.js
15. src/championship/cage/cageCatalog.js
16. docs/art/production/cage/faithful-hd40/
17. assets/production/cage/licensed-runtime-v1/manifest.json

並用 repo search 找出：
- Cage/Habitat runtime renderer
- Cage asset loader
- current compositor / exporter / image processing scripts
- Playwright / screenshot infrastructure
- responsive viewport / visualViewport handling
- any existing Sharp/Jimp/Canvas/Python image compositor
- any existing Tiled/TMX support
- art manifest promotion scripts

不要假設這些不存在；先搜尋。

==================================================
3. Current Truth 分類
==================================================

對每個主要主張只准使用下列狀態：

CONFIRMED
CORRECTED
DEFERRED
REJECTED
UNKNOWN_REQUIRES_TRACE

特別確認：

A. Cage 不是單一背景圖
- core/tilemap
- object cells
- object placement
- NANR/NCER binding
- shape masks
- field destination tile composition
- collision/attribute
- runtime composite

B. 座標空間是否真的分離
- Cage Edit board coordinates
- shape/occupancy slots
- field destination tile coordinates
- object local/pivot/placement coordinates

C. `field_cm01_01`
驗證 planning 文件列出的：
- 4 object placements
- 4 rendered object cells
- anchors / bounds
- source coordinate semantics

若數字或語意不對，直接修文件；不要硬讓 code 配合錯文件。

D. Adaptive UI
確認現有 DOM/Pixi 架構可否用同元件做 Compact/Medium/Expanded。
不要新增 device-model detection。
不要做 Tablet-only gameplay state。

E. Art pipeline
先盤點 repo 已有工具，再判斷：
- 哪些需補
- 哪些其實已存在
- 哪些 GitHub 工具只研究、不必安裝

==================================================
4. 外部 GitHub 工具：先驗證，不要一次全部安裝
==================================================

重新核對 upstream、license、維護狀態與我們的實際需要：

- mapeditor/tiled
- mapeditor/tiled-extensions
- Garhoogin/NitroPaint
- lovell/sharp
- pixijs-userland/tilemap
- microsoft/playwright（若 repo 已使用，以現有版本為準）
- mapbox/pixelmatch 或 repo 既有等價工具
- Aseprite CLI / slices（tool only）
- Blender（tool only）

原則：
- 不要因為「可能有用」就增加 dependency；
- tool-only 優先；
- repo 已有等價能力就不要重做；
- 沒有 license 的第三方 code/workflow 不 copy；
- GPL 等工具若只作外部 authoring / inspection，先記錄邊界；不要無意間 vendor 進 runtime；
- `@pixi/tilemap` 只有 profiling / product need 證明必要才考慮，不准現在重寫 Cage renderer。

==================================================
5. 先收束文件，不新增競爭 roadmap
==================================================

對 PR #2 的 planning 做一次 consistency pass。

要求：
- 產品核心只保留 `Raise → Explore → Battle → Evolve → Rebuild`
- Nexus Link 是 Championship 2026 原地產品化，不是新遊戲
- 1.0 延後 async PvP / trade / LLM companion / seamless open world / 500 forms 等非核心 scope
- Habitat-lite 從現有 Cage 演進
- responsive layout 是 presentation composition，不是第二套 UI
- Cage art 改成 contract-driven modular authoring，不准只換 full PNG
- art pipeline 以 canonical anchor / whole-action / normalization / runtime QA 為主

若舊 planning 有矛盾：
- 更新 canonical 文件或加 superseded note
- 不再新增第 N 份 roadmap

把修改原因記在 commit message / summary。

==================================================
6. 落地 Proof A：field_cm01_01 Cage Art Contract
==================================================

在確認 repo current truth 後，實作最小、renderer-neutral 的 Cage art authoring proof。

目標不是重畫 40 個 Cage。
目標是證明：現在已有的 field evidence 可以被 deterministic 地重建，未來換美術不會再把物件放錯。

優先重用現有 script/tooling；若沒有，才新增最小工具。

最小功能：

1. 讀取 `field_cm01_01` 已有 evidence；
2. 產生 machine-readable art contract；
3. 產生 debug authoring template：
   - field bounds
   - object IDs
   - object pivot/anchor
   - placement cross
   - safe area / geometry guide
4. deterministic compositor 用現有 core + 4 object cells 重建 preview；
5. 公式與 coordinate transform 必須集中在一處，不散落 magic offsets；
6. 產生 overlay/debug preview；
7. compare against existing reference/composite；
8. 加 tests；
9. 如 repo 已有 Playwright visual test，加入最小 screenshot proof；否則不要為此導入巨大測試框架，先輸出 deterministic image + structural tests。

重要：
- 第一輪完全不要生成新美術；
- 第一輪先證明原素材能重建；
- 如果原素材都重建不對，STOP，修 contract/compositor；
- 不准用手工 X/Y patch 讓 screenshot 看起來對。

建議命令名稱可依 repo conventions 調整，例如：

npm run cage:contract -- field_cm01_01
npm run cage:template -- field_cm01_01
npm run cage:build -- field_cm01_01
npm run cage:validate -- field_cm01_01

但不要為了符合這些名字破壞既有 scripts 命名。

==================================================
7. 落地 Proof B：Responsive Composition Foundation
==================================================

只在不破壞現有 UI 的前提下盤點/補最小 foundation：

COMPACT < 600
MEDIUM 600–839
EXPANDED >= 840

第一階段只驗證同一個現有 screen / component 可以在：

390×844
820×1180
1024×1366

重新排列或合理擴展。

禁止：
- copy 一份 Tablet screen
- duplicate gameplay state
- iPad/Z Fold model sniffing
- 為 tablet 重做角色 assets

如果 current UI 還不適合安全修改，則只補 design tokens / layout measurement / tests，標記 runtime change 為 DEFERRED；不要為了完成任務硬重構整個 UI。

Fold Tabletop/Book Mode 是 later progressive enhancement，不是本次 blocker。

==================================================
8. Creature Art 只做 pipeline readiness，不大量生成
==================================================

這次不要生成 20/60/100 隻角色，也不要付費批量生圖。

只確認 pipeline 能支援未來一隻 pilot：

Idle
Move
Attack
Hit
Eat
Sleep

要求：
- approved identity / canonical anchor
- whole-action strip 或 pose-control
- shared scale
- bottom-center anchor
- alpha cleanup
- runtime preview

若 repo 已有對應 script，整理入口；若沒有，本次可只留下明確 TODO/contract，不要同時做 Cage tooling + full sprite factory + 大量美術。

==================================================
9. 測試與驗證
==================================================

執行與本次變更相關的：
- unit tests
- regression tests
- lint/type/syntax checks（依 repo 現有）
- Cage placement/composition tests
- save/replay tests若有觸及相關 shared code
- visual/screenshot tests若已有基礎

任何 baseline failure 必須區分：
- pre-existing
- introduced by this work

不可把失敗 test 刪掉只為了變綠。

==================================================
10. 最終交付格式
==================================================

最後請只交付一份收束報告，不要再寫新的大型 roadmap。

報告必須包含：

A. CURRENT TRUTH
- CONFIRMED
- CORRECTED
- UNKNOWN_REQUIRES_TRACE

B. REUSED
- 哪些 Championship 現有 subsystem / scripts / contracts 直接沿用

C. ADDED
- 新增了哪些最小 contract / template / compositor / tests / responsive foundation

D. NOT ADDED
- 明確列出哪些候選工具/功能沒有導入，以及原因

E. TEST RESULTS
- 精確命令
- pass/fail counts

F. FILES CHANGED
- 每個檔案一句用途

G. NEXT 3 ACTIONS ONLY
最多三項，依優先順序。

H. STOP POINT
完成 field_cm01_01 proof 與必要 responsive foundation 後 STOP。
不要批量轉 40 Cage。
不要批量生成角色。
不要開始 async PvP。
不要另做 Nexus Link app。

如果 PR #2 planning 經驗證後可收束，更新 PR #2 的文件與描述即可；不要自行 merge main，等 Owner review。
```
